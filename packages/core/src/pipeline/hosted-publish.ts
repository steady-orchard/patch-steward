import type { Result, StewardFailure } from '../result.js';
import { err } from '../result.js';
import type { Outcome, SubmissionType } from '../vocabulary.js';
import type { GitHubAnyFetch } from '../github/writer.js';
import { createGitHubClient } from '../github/client.js';
import { createGitHubWriter } from '../github/writer.js';
import { createGitHubBudget, githubBudgetForPreflight } from '../github/budget.js';
import { repositoryRefFromFullName } from '../github/reader.js';
import { mintInstallationToken, revokeInstallationToken } from '../github/app-auth.js';
import type { InstallationToken } from '../github/app-auth.js';
import { loadPolicyRevision } from '../policy/loader.js';
import { downloadOwnershipRecord, listOwnershipArtifacts } from '../github/artifacts.js';
import { findOwnOwnershipArtifact } from '../ownership/freshness.js';
import { artifactRetentionDays, ownershipRetentionShort } from '../ownership/artifacts.js';
import { ownershipArtifactName } from '../ownership/record.js';
import { evidenceStoreLocation, hostedEvidenceLocation } from '../evidence/git-store.js';
import { writeEvidenceCommit } from '../evidence/store-readback.js';
import { prepareClosureEvidence, prepareSupersessionEvidence } from '../evidence/prepare-records.js';
import { metricsStorePath } from '../evidence/layout.js';
import type { EvidenceRedactFn } from '../evidence/redact-records.js';
import { acceptGateHandoff } from './sequence.js';
import { decodeClosureContext, decodeGateContext, decodeHandoffBytes } from './gate-context.js';
import type { ClosureContextRecord, GateContextRecord, HostedRunExpectation } from './gate-context.js';
import { prepareHostedRunEvidence } from './hosted-evidence.js';
import { publishFreshnessFailure, verifyPublishFreshness } from './hosted-freshness.js';
import { stewardVersion } from '../version.js';
import type { StewardVersionFailureCode } from '../version.js';
import { fitJobSummary, renderJobSummary } from './job-summary.js';
import type { JobSummaryFreshness } from './job-summary.js';
import { reportCodeSpan } from '../report/escape.js';
import { JOB_SUMMARY_MAX_LENGTH } from '../policy/bounds.js';
import type { Clock } from '../clock.js';
import { systemClock } from '../clock.js';
import { httpsAttachmentTransport, systemAttachmentResolver } from '../net/https-transport.js';
import type { AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import type { HostedPublishEnvironment } from './hosted-environment.js';

export interface HostedPublishFiles {
  readonly handoff: Uint8Array | null;
  readonly gateContext: Uint8Array | null;
  readonly closure: Uint8Array | null;
}

export interface HostedPublishInput {
  readonly environment: HostedPublishEnvironment;
  readonly files: HostedPublishFiles;
}

export interface HostedPublishDeps {
  readonly fetch?: GitHubAnyFetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly clock?: Clock;
  readonly attachmentResolver?: AttachmentResolver;
  readonly attachmentTransport?: AttachmentTransport;
  readonly mask: (secret: string) => void;
  readonly writeSummary: (text: string) => Promise<void>;
  readonly version?: () => Result<string, StewardVersionFailureCode>;
  readonly settleMs?: number;
  readonly redact?: EvidenceRedactFn;
}

export type HostedPublishStatus = Outcome | 'queued' | 'closure';

export type HostedPublishResult =
  | {
      readonly ok: true;
      readonly status: HostedPublishStatus;
      readonly outputs: Readonly<Record<string, string>>;
      readonly logLines: readonly string[];
    }
  | {
      readonly ok: false;
      readonly failure: StewardFailure;
      readonly evidenceCommit: string | null;
      readonly logLines: readonly string[];
    };

interface SummaryContext {
  readonly repository: string;
  readonly subjectType: SubmissionType;
  readonly subjectNumber: number;
  readonly runId: number;
  readonly runAttempt: number;
}

const INTERNAL_ERROR: StewardFailure = err(
  'steward.internal-error',
  'steward-defect',
  'An internal error stopped the run.',
).failure;

function bindingFailure(): StewardFailure {
  return err('pipeline.handoff-binding', 'steward-defect', 'The same-run record is not bound to this run.').failure;
}

function invalidFailure(): StewardFailure {
  return err('pipeline.handoff-invalid', 'steward-defect', 'The same-run record failed validation.').failure;
}

export async function runHostedPublish(input: HostedPublishInput, deps: HostedPublishDeps): Promise<HostedPublishResult> {
  const clock = deps.clock ?? systemClock;
  const resolver = deps.attachmentResolver ?? systemAttachmentResolver;
  const transport = deps.attachmentTransport ?? httpsAttachmentTransport;
  const started = clock.now();
  const env = input.environment;
  const logLines: string[] = [];
  const minted: InstallationToken[] = [];
  const bootstrap = githubBudgetForPreflight();

  let summaryContext: SummaryContext | null = null;
  let snapshotHashForSummary: string | null = null;
  let policyRevisionForSummary: string | null = null;
  let evidenceForSummary: { readonly commit: string; readonly location: string } | null = null;
  let freshnessForSummary: JobSummaryFreshness | null = null;
  let retentionDaysForSummary: number | null = null;

  function credentialsForRedaction(): readonly string[] {
    return [env.credentials.privateKey, ...minted.map((token) => token.secret())];
  }

  async function revokeAll(): Promise<void> {
    for (const token of minted) {
      try {
        await revokeInstallationToken(token, {
          budget: bootstrap,
          ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
          ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
        });
      } catch {
        // ignored: revocation is best-effort and must never fail the run
      }
    }
  }

  async function fail(failure: StewardFailure, evidenceCommit: string | null): Promise<HostedPublishResult> {
    await revokeAll();
    if (summaryContext === null) {
      await deps.writeSummary(
        fitJobSummary(
          ['## Patch Steward publish', '', '- Status: ' + reportCodeSpan('failed'), '- Failure: ' + reportCodeSpan(failure.code)],
          JOB_SUMMARY_MAX_LENGTH,
        ),
      );
    } else {
      await deps.writeSummary(
        renderJobSummary({
          job: 'publish',
          repository: summaryContext.repository,
          subjectType: summaryContext.subjectType,
          subjectNumber: summaryContext.subjectNumber,
          runId: summaryContext.runId,
          runAttempt: summaryContext.runAttempt,
          status: 'failed',
          snapshotHash: snapshotHashForSummary,
          policyRevision: policyRevisionForSummary,
          owner: null,
          caps: null,
          evidence: evidenceForSummary,
          freshness: freshnessForSummary,
          retentionDays: retentionDaysForSummary,
          failureCode: failure.code,
        }),
      );
    }
    return { ok: false, failure, evidenceCommit, logLines };
  }

  async function succeed(status: HostedPublishStatus, outputs: Readonly<Record<string, string>>): Promise<HostedPublishResult> {
    await revokeAll();
    const ctx = summaryContext as SummaryContext;
    await deps.writeSummary(
      renderJobSummary({
        job: 'publish',
        repository: ctx.repository,
        subjectType: ctx.subjectType,
        subjectNumber: ctx.subjectNumber,
        runId: ctx.runId,
        runAttempt: ctx.runAttempt,
        status,
        snapshotHash: snapshotHashForSummary,
        policyRevision: policyRevisionForSummary,
        owner: null,
        caps: null,
        evidence: evidenceForSummary,
        freshness: freshnessForSummary,
        retentionDays: retentionDaysForSummary,
        failureCode: null,
      }),
    );
    return { ok: true, status, outputs, logLines };
  }

  try {
    const versionResult = (deps.version ?? stewardVersion)();
    if (!versionResult.ok) {
      return await fail(versionResult.failure, null);
    }
    const version = versionResult.value;

    const expectation: HostedRunExpectation = {
      runId: Number(env.runId),
      maxAttempt: Number(env.runAttempt),
      repository: env.repository,
      repositoryId: Number(env.repositoryId),
    };

    const committed = !env.gate.recordOnly;
    let gateContext: GateContextRecord | null = null;
    let closureContext: ClosureContextRecord | null = null;
    let handoffCandidate: unknown = null;

    if (!committed) {
      if (env.gate.disposition !== 'closure') {
        return await fail(bindingFailure(), null);
      }
      if (input.files.closure === null) {
        return await fail(invalidFailure(), null);
      }
      const decoded = decodeClosureContext(input.files.closure, expectation);
      if (!decoded.ok) {
        return await fail(decoded.failure, null);
      }
      closureContext = decoded.value;
      if (closureContext.policy.revision !== env.gate.policyRevision) {
        return await fail(bindingFailure(), null);
      }
      summaryContext = {
        repository: closureContext.repository.full_name,
        subjectType: closureContext.subject.type,
        subjectNumber: closureContext.subject.number,
        runId: closureContext.run.run_id,
        runAttempt: closureContext.run.run_attempt,
      };
      policyRevisionForSummary = closureContext.policy.revision;
    } else {
      if (env.gate.disposition !== 'runnable' && env.gate.disposition !== 'early-exit' && env.gate.disposition !== 'queued') {
        return await fail(bindingFailure(), null);
      }
      if (input.files.gateContext === null || input.files.handoff === null) {
        return await fail(invalidFailure(), null);
      }
      const decoded = decodeGateContext(input.files.gateContext, expectation);
      if (!decoded.ok) {
        return await fail(decoded.failure, null);
      }
      gateContext = decoded.value;
      if (
        gateContext.disposition !== env.gate.disposition ||
        gateContext.snapshot_hash !== env.gate.snapshotHash ||
        gateContext.policy.revision !== env.gate.policyRevision
      ) {
        return await fail(bindingFailure(), null);
      }
      const handoffDecoded = decodeHandoffBytes(input.files.handoff);
      if (!handoffDecoded.ok) {
        return await fail(handoffDecoded.failure, null);
      }
      handoffCandidate = handoffDecoded.value;
      summaryContext = {
        repository: gateContext.repository.full_name,
        subjectType: gateContext.subject.type,
        subjectNumber: gateContext.subject.number,
        runId: gateContext.run.run_id,
        runAttempt: gateContext.run.run_attempt,
      };
      snapshotHashForSummary = gateContext.snapshot_hash;
      policyRevisionForSummary = gateContext.policy.revision;
    }

    const ctxRepositoryFullName = committed
      ? (gateContext as GateContextRecord).repository.full_name
      : (closureContext as ClosureContextRecord).repository.full_name;
    const ctxPolicy = committed ? (gateContext as GateContextRecord).policy : (closureContext as ClosureContextRecord).policy;
    const ctxStore = committed ? (gateContext as GateContextRecord).store : (closureContext as ClosureContextRecord).store;
    const runId = committed ? (gateContext as GateContextRecord).run.run_id : (closureContext as ClosureContextRecord).run.run_id;
    const runAttempt = committed
      ? (gateContext as GateContextRecord).run.run_attempt
      : (closureContext as ClosureContextRecord).run.run_attempt;
    const subjectType = committed
      ? (gateContext as GateContextRecord).subject.type
      : (closureContext as ClosureContextRecord).subject.type;
    const subjectNumber = committed
      ? (gateContext as GateContextRecord).subject.number
      : (closureContext as ClosureContextRecord).subject.number;

    const target = repositoryRefFromFullName(ctxRepositoryFullName);
    if (target === null) {
      return await fail(INTERNAL_ERROR, null);
    }

    const role = ctxStore.type === 'orphan-branch' ? 'publish-target-and-store' : 'publish-target';
    const targetTokenResult = await mintInstallationToken(env.credentials, target, role, {
      budget: bootstrap,
      ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
      ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    });
    if (!targetTokenResult.ok) {
      return await fail(targetTokenResult.failure, null);
    }
    const targetToken = targetTokenResult.value;
    deps.mask(targetToken.secret());
    minted.push(targetToken);

    const loadedResult = await loadPolicyRevision({
      client: createGitHubClient({
        token: targetToken.secret(),
        budget: bootstrap,
        ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
        ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
      }),
      repository: target,
      treeId: ctxPolicy.revision,
      commit: ctxPolicy.commit,
      ref: ctxPolicy.ref,
    });
    if (!loadedResult.ok) {
      return await fail(loadedResult.failure, null);
    }
    const loaded = loadedResult.value;
    logLines.push(`policy revision ${ctxPolicy.revision}`);

    const storeLocationResult = evidenceStoreLocation(loaded.policy.evidence.store, ctxRepositoryFullName);
    if (!storeLocationResult.ok) {
      return await fail(storeLocationResult.failure, null);
    }
    const store = storeLocationResult.value;
    const storeFullName = `${store.repository.owner}/${store.repository.name}`;
    if (
      loaded.policy.evidence.store.type !== ctxStore.type ||
      storeFullName !== ctxStore.repository ||
      store.branch !== ctxStore.branch
    ) {
      return await fail(bindingFailure(), null);
    }

    let handoff: import('./handoff.js').HandoffRecord | null = null;
    if (committed) {
      const accepted = acceptGateHandoff(
        handoffCandidate,
        {
          run_id: runId,
          run_attempt: runAttempt,
          snapshot_hash: (gateContext as GateContextRecord).snapshot_hash,
          policy_revision: ctxPolicy.revision,
        },
        loaded.policy.stages.challenge_rounds,
      );
      if (!accepted.ok) {
        return await fail(accepted.failure, null);
      }
      handoff = accepted.value;
    }

    let storeToken: InstallationToken = targetToken;
    if (ctxStore.type !== 'orphan-branch') {
      const storeTokenResult = await mintInstallationToken(env.credentials, store.repository, 'publish-store', {
        budget: bootstrap,
        ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
        ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
      });
      if (!storeTokenResult.ok) {
        return await fail(storeTokenResult.failure, null);
      }
      storeToken = storeTokenResult.value;
      deps.mask(storeToken.secret());
      minted.push(storeToken);
    }

    const runBudget = createGitHubBudget({
      requests: committed
        ? (handoff as import('./handoff.js').HandoffRecord).budget_remaining.github_requests
        : (closureContext as ClosureContextRecord).github_requests_remaining,
      retriesPerRequest: loaded.policy.limits.github.retries_per_request,
    });

    const targetClient = createGitHubClient({
      token: targetToken.secret(),
      budget: runBudget,
      ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
      ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    });
    const storeClient = createGitHubClient({
      token: storeToken.secret(),
      budget: runBudget,
      ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
      ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    });
    const storeWriter = createGitHubWriter({
      token: storeToken.secret(),
      scope: { kind: 'installation', store: { repository: store.repository, branch: store.branch } },
      budget: runBudget,
      ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
      ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    });

    if (!committed) {
      const closure = closureContext as ClosureContextRecord;
      const prepared = await prepareClosureEvidence({
        runId,
        runAttempt,
        event: closure.event,
        credentials: credentialsForRedaction(),
      });
      if (!prepared.ok) {
        return await fail(prepared.failure, null);
      }
      const location = hostedEvidenceLocation(
        store,
        ctxRepositoryFullName,
        metricsStorePath(closure.event.recorded_at, runId, runAttempt),
      );
      const commitResult = await writeEvidenceCommit(
        {
          store,
          targetRepository: ctxRepositoryFullName,
          subject: { type: subjectType, number: subjectNumber },
          runId,
          runAttempt,
          groups: prepared.value.groups,
          maxBytes: loaded.policy.limits.evidence.run_bytes,
          writeRetries: loaded.policy.limits.evidence.write_retries,
        },
        { client: storeClient, writer: storeWriter, ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}) },
      );
      if (!commitResult.ok) {
        return await fail(commitResult.failure, null);
      }
      logLines.push(`evidence commit ${commitResult.value.commit} rebuilds ${String(commitResult.value.rebuilds)}`);
      evidenceForSummary = { commit: commitResult.value.commit, location };
      const outputs: Record<string, string> = {
        status: 'closure',
        freshness: '',
        evidence_commit: commitResult.value.commit,
        supersession_commit: '',
      };
      return await succeed('closure', outputs);
    }

    const context = gateContext as GateContextRecord;
    const resolvedHandoff = handoff as import('./handoff.js').HandoffRecord;

    // committed path: own artifact, before any evidence request
    const name = ownershipArtifactName(subjectType, subjectNumber);
    const listingResult = await listOwnershipArtifacts(targetClient, target, name);
    if (!listingResult.ok) {
      return await fail(
        err('ownership.listing-unavailable', 'github-unavailable', 'The ownership listing could not be read.').failure,
        null,
      );
    }
    const ownLookup = findOwnOwnershipArtifact(listingResult.value, name, runId);
    if (ownLookup.kind !== 'found') {
      return await fail(
        err('ownership.listing-unavailable', 'github-unavailable', 'The ownership listing could not be read.').failure,
        null,
      );
    }
    const own = ownLookup.artifact;
    const downloadedResult = await downloadOwnershipRecord(
      targetClient,
      target,
      own,
      {
        repository: ctxRepositoryFullName,
        type: subjectType,
        number: subjectNumber,
        artifactName: name,
        workflowRunId: own.workflowRunId,
      },
      { resolver, transport },
    );
    if (!downloadedResult.ok) {
      return await fail(err('ownership.record-invalid', 'github-unavailable', 'The ownership record is invalid.').failure, null);
    }
    const record = downloadedResult.value;
    if (
      record.run_id !== runId ||
      record.run_attempt !== runAttempt ||
      record.snapshot_hash !== context.snapshot_hash ||
      record.policy_revision !== context.policy.revision ||
      record.disposition !== context.disposition
    ) {
      return await fail(bindingFailure(), null);
    }

    const retention = artifactRetentionDays(own.createdAt, own.expiresAt ?? '');
    retentionDaysForSummary = retention;
    logLines.push(`ownership retention ${retention === null ? 'unknown' : String(retention)} days`);
    if (ownershipRetentionShort(retention)) {
      logLines.push('warning ownership.retention-short');
    }

    const finishedAtForEvidence = clock.now().toISOString();
    const evidencePrepared = await prepareHostedRunEvidence(
      {
        context,
        handoff: resolvedHandoff,
        loadedPolicy: loaded,
        stewardVersion: version,
        store,
        arrivalAt: own.createdAt,
        publishStartedAt: started.toISOString(),
        finishedAt: finishedAtForEvidence,
        publishRequests: bootstrap.requestsUsed() + runBudget.requestsUsed(),
        retries: 0,
        logLines,
        credentials: credentialsForRedaction(),
      },
      deps.redact !== undefined ? { redact: deps.redact } : {},
    );
    if (!evidencePrepared.ok) {
      return await fail(evidencePrepared.failure, null);
    }

    const commitResult = await writeEvidenceCommit(
      {
        store,
        targetRepository: ctxRepositoryFullName,
        subject: { type: subjectType, number: subjectNumber },
        runId,
        runAttempt,
        groups: evidencePrepared.value.groups,
        maxBytes: loaded.policy.limits.evidence.run_bytes,
        writeRetries: loaded.policy.limits.evidence.write_retries,
      },
      { client: storeClient, writer: storeWriter, ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}) },
    );
    if (!commitResult.ok) {
      return await fail(commitResult.failure, null);
    }
    logLines.push(`evidence commit ${commitResult.value.commit} rebuilds ${String(commitResult.value.rebuilds)}`);
    evidenceForSummary = { commit: commitResult.value.commit, location: evidencePrepared.value.location };

    const fromStatus: Outcome | 'queued' = evidencePrepared.value.kind === 'outcome' ? evidencePrepared.value.outcome : 'queued';

    const freshnessResult = await verifyPublishFreshness(
      {
        client: targetClient,
        repository: target,
        defaultBranch: context.repository.default_branch,
        subject: { type: subjectType, number: subjectNumber },
        own: { id: own.id, createdAt: own.createdAt, workflowRunId: runId },
        record,
      },
      {
        resolver,
        transport,
        sleep: deps.sleep ?? (async () => undefined),
        ...(deps.settleMs !== undefined ? { settleMs: deps.settleMs } : {}),
      },
    );
    logLines.push(...freshnessResult.logLines);
    const freshness = freshnessResult.freshness;

    if (freshness.kind === 'current') {
      freshnessForSummary = { state: 'current' };
      const outputs: Record<string, string> = {
        status: fromStatus,
        freshness: 'current',
        evidence_commit: commitResult.value.commit,
        supersession_commit: '',
      };
      return await succeed(fromStatus, outputs);
    }

    if (freshness.kind === 'superseded') {
      freshnessForSummary = { state: 'superseded', reason: freshness.reason };
      const supersessionPrepared = await prepareSupersessionEvidence({
        runId,
        runAttempt,
        subject: { repository: ctxRepositoryFullName, type: subjectType, number: subjectNumber },
        reason: freshness.reason,
        successor: freshness.reason === 'newer-owner' ? freshness.successor : null,
        recordedSnapshotHash: context.snapshot_hash,
        liveSnapshotHash: freshness.reason === 'snapshot-changed' ? freshness.liveSnapshotHash : null,
        from: fromStatus,
        recordedAt: clock.now().toISOString(),
        credentials: credentialsForRedaction(),
      });
      if (!supersessionPrepared.ok) {
        return await fail(supersessionPrepared.failure, commitResult.value.commit);
      }
      const supersessionCommitResult = await writeEvidenceCommit(
        {
          store,
          targetRepository: ctxRepositoryFullName,
          subject: { type: subjectType, number: subjectNumber },
          runId,
          runAttempt,
          groups: supersessionPrepared.value.groups,
          maxBytes: loaded.policy.limits.evidence.run_bytes,
          writeRetries: loaded.policy.limits.evidence.write_retries,
        },
        { client: storeClient, writer: storeWriter, ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}) },
      );
      if (!supersessionCommitResult.ok) {
        return await fail(supersessionCommitResult.failure, commitResult.value.commit);
      }
      const outputs: Record<string, string> = {
        status: 'superseded',
        freshness: 'superseded',
        evidence_commit: commitResult.value.commit,
        supersession_commit: supersessionCommitResult.value.commit,
      };
      return await succeed('superseded', outputs);
    }

    freshnessForSummary = { state: 'unknown' };
    return await fail(publishFreshnessFailure(freshness.reason).failure, commitResult.value.commit);
  } catch {
    return await fail(INTERNAL_ERROR, null);
  }
}
