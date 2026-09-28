import type { Result, StewardFailure } from '../result.js';
import { err, ok } from '../result.js';
import type { FailureCause, GateDisposition, ResolutionKind, SubmissionType } from '../vocabulary.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import type { GitHubAnyFetch } from '../github/writer.js';
import { createGitHubClient } from '../github/client.js';
import { githubBudgetForPolicy, githubBudgetForPreflight } from '../github/budget.js';
import { repositoryRefFromFullName } from '../github/reader.js';
import { lookupAppBotUserId, mintInstallationToken, revokeInstallationToken } from '../github/app-auth.js';
import type { InstallationToken } from '../github/app-auth.js';
import { loadPolicy } from '../policy/loader.js';
import { dedupListingRead, readOwnershipListing } from '../github/artifacts.js';
import { appliesListingDeduplication, decideDeduplication, isVerifiedEcho } from '../ownership/dedup.js';
import type { DedupFallbackRead } from '../ownership/dedup.js';
import { readPublishedSnapshot } from '../evidence/fallback-read.js';
import { evidenceStoreLocation } from '../evidence/git-store.js';
import { readCapRunLists } from '../github/runs.js';
import { evaluateCaps } from '../ownership/caps.js';
import { encodeOwnershipRecord, ownershipArtifactName } from '../ownership/record.js';
import type { OwnershipRecord } from '../ownership/record.js';
import { buildClosureMetricsEvent } from '../evidence/metrics.js';
import { initialBudget } from './budget.js';
import { handoffRecordSchema, validateHandoff } from './handoff.js';
import { canonicalJson } from '../canonical-json.js';
import { redactEvidenceStrings } from '../evidence/redact-records.js';
import { fitJobSummary, renderJobSummary } from './job-summary.js';
import { reportCodeSpan } from '../report/escape.js';
import type { Clock } from '../clock.js';
import { systemClock } from '../clock.js';
import { httpsAttachmentTransport, systemAttachmentResolver } from '../net/https-transport.js';
import type { AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import { authenticateEvent, closureResolution, eventIdentity, stewardConcurrencyGroup } from '../ownership/events.js';
import { hostedEventEnvironment } from './hosted-environment.js';
import type { HostedGateEnvironment } from './hosted-environment.js';
import { buildGateHandoff, gateCaptureSubmission } from './gate.js';
import {
  classificationRecord,
  closureContextRecordSchema,
  encodeClosureContext,
  encodeGateContext,
  gateContextRecordSchema,
  GATE_CONTEXT_LOG_LINES_MAX,
} from './gate-context.js';
import type { ClosureContextRecord, GateContextRecord } from './gate-context.js';
import { JOB_SUMMARY_MAX_LENGTH } from '../policy/bounds.js';

export const HOSTED_GATE_FAILURE_CODES = [
  'gate.policy-missing',
  'gate.policy-invalid',
  'gate.repository-gate-unsupported',
] as const;
export type HostedGateFailureCode = (typeof HOSTED_GATE_FAILURE_CODES)[number];

export const HOSTED_GATE_FAILURE_CAUSES: { readonly [K in HostedGateFailureCode]: FailureCause } = Object.freeze({
  'gate.policy-missing': 'policy-unavailable',
  'gate.policy-invalid': 'policy-invalid',
  'gate.repository-gate-unsupported': 'policy-invalid',
});

export function hostedRepositoryGateActive(policy: ResolvedPolicy): boolean {
  if (policy.modes.default !== 'observe') {
    return true;
  }
  const perCategory = policy.modes.per_category;
  return Object.values(perCategory).some((mode) => mode !== undefined && mode !== 'observe');
}

export function repositoryGateRefusal(policy: ResolvedPolicy): Result<null, 'gate.repository-gate-unsupported'> {
  if (hostedRepositoryGateActive(policy)) {
    return err(
      'gate.repository-gate-unsupported',
      HOSTED_GATE_FAILURE_CAUSES['gate.repository-gate-unsupported'],
      'The repository gate is not supported by this steward version.',
    );
  }
  return ok(null);
}

export function mapHostedPolicyFailure(failure: StewardFailure): StewardFailure {
  if (failure.code === 'policy-source.not-published') {
    return err(
      'gate.policy-missing',
      HOSTED_GATE_FAILURE_CAUSES['gate.policy-missing'],
      'The repository has no published policy on its default branch.',
    ).failure;
  }
  if (failure.cause === 'policy-invalid') {
    return err(
      'gate.policy-invalid',
      HOSTED_GATE_FAILURE_CAUSES['gate.policy-invalid'],
      'The published policy on the default branch is invalid.',
      failure.details,
    ).failure;
  }
  return failure;
}

export type HostedGateFileName = 'handoff' | 'gate-context' | 'ownership' | 'closure';

export interface HostedGateFile {
  readonly name: HostedGateFileName;
  readonly bytes: Uint8Array;
}

export interface HostedGateInput {
  readonly environment: HostedGateEnvironment;
  readonly payload: Uint8Array;
}

export interface HostedGateDeps {
  readonly fetch?: GitHubAnyFetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly clock?: Clock;
  readonly attachmentResolver?: AttachmentResolver;
  readonly attachmentTransport?: AttachmentTransport;
  readonly mask: (secret: string) => void;
  readonly writeSummary: (text: string) => Promise<void>;
  readonly receipts?: (record: OwnershipRecord) => readonly number[];
}

export type HostedGateResult =
  | {
      readonly ok: true;
      readonly disposition: GateDisposition;
      readonly outputs: Readonly<Record<string, string>>;
      readonly files: readonly HostedGateFile[];
      readonly logLines: readonly string[];
    }
  | { readonly ok: false; readonly failure: StewardFailure; readonly logLines: readonly string[] };

interface OwnershipCapValue {
  readonly state: 'within' | 'daily-runs' | 'per-author-concurrent-runs';
  readonly daily_count: number;
  readonly daily_limit: number;
  readonly author_count: number;
  readonly author_limit: number;
}

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

export async function runHostedGate(input: HostedGateInput, deps: HostedGateDeps): Promise<HostedGateResult> {
  const clock = deps.clock ?? systemClock;
  const resolver = deps.attachmentResolver ?? systemAttachmentResolver;
  const transport = deps.attachmentTransport ?? httpsAttachmentTransport;
  const receiptsOf = deps.receipts ?? ((): readonly number[] => []);
  const started = clock.now();
  const logLines: string[] = [];
  const minted: InstallationToken[] = [];
  const bootstrap = githubBudgetForPreflight();

  let summaryContext: SummaryContext | null = null;
  let capsForSummary: {
    readonly dailyCount: number;
    readonly dailyLimit: number;
    readonly authorCount: number;
    readonly authorLimit: number;
  } | null = null;
  let ownerForSummary: { readonly action: 'kept' | 'committed'; readonly runId: number; readonly runAttempt: number } | null = null;
  let snapshotHashForSummary: string | null = null;
  let policyRevisionForSummary: string | null = null;

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

  async function fail(failure: StewardFailure): Promise<HostedGateResult> {
    await revokeAll();
    if (summaryContext === null) {
      await deps.writeSummary(
        fitJobSummary(
          ['## Patch Steward gate', '', '- Status: ' + reportCodeSpan('failed'), '- Failure: ' + reportCodeSpan(failure.code)],
          JOB_SUMMARY_MAX_LENGTH,
        ),
      );
    } else {
      await deps.writeSummary(
        renderJobSummary({
          job: 'gate',
          repository: summaryContext.repository,
          subjectType: summaryContext.subjectType,
          subjectNumber: summaryContext.subjectNumber,
          runId: summaryContext.runId,
          runAttempt: summaryContext.runAttempt,
          status: 'failed',
          snapshotHash: snapshotHashForSummary,
          policyRevision: policyRevisionForSummary,
          owner: ownerForSummary,
          caps: capsForSummary,
          evidence: null,
          freshness: null,
          retentionDays: null,
          failureCode: failure.code,
        }),
      );
    }
    return { ok: false, failure, logLines };
  }

  async function succeed(
    disposition: GateDisposition,
    outputs: Readonly<Record<string, string>>,
    files: readonly HostedGateFile[],
  ): Promise<HostedGateResult> {
    await revokeAll();
    const ctx = summaryContext as SummaryContext;
    await deps.writeSummary(
      renderJobSummary({
        job: 'gate',
        repository: ctx.repository,
        subjectType: ctx.subjectType,
        subjectNumber: ctx.subjectNumber,
        runId: ctx.runId,
        runAttempt: ctx.runAttempt,
        status: disposition,
        snapshotHash: snapshotHashForSummary,
        policyRevision: policyRevisionForSummary,
        owner: ownerForSummary,
        caps: capsForSummary,
        evidence: null,
        freshness: null,
        retentionDays: null,
        failureCode: null,
      }),
    );
    return { ok: true, disposition, outputs, files, logLines };
  }

  try {
    const eventResult = authenticateEvent(hostedEventEnvironment(input.environment), input.payload);
    if (!eventResult.ok) {
      return await fail(eventResult.failure);
    }
    const event = eventResult.value;
    logLines.push(
      `event ${event.eventName} ${event.action} ${event.subject.type === 'pull_request' ? 'pr' : 'issue'} ${String(event.subject.number)} sender ${event.senderType}`,
    );

    summaryContext = {
      repository: event.repository.fullName,
      subjectType: event.subject.type,
      subjectNumber: event.subject.number,
      runId: event.runId,
      runAttempt: event.runAttempt,
    };

    const target = repositoryRefFromFullName(event.repository.fullName);
    if (target === null) {
      return await fail(INTERNAL_ERROR);
    }

    const tokenResult = await mintInstallationToken(input.environment.credentials, target, 'gate-target', {
      budget: bootstrap,
      ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
      ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    });
    if (!tokenResult.ok) {
      return await fail(tokenResult.failure);
    }
    const token = tokenResult.value;
    deps.mask(token.secret());
    minted.push(token);

    const botResult = await lookupAppBotUserId(input.environment.credentials, token, {
      budget: bootstrap,
      ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
      ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    });
    if (!botResult.ok) {
      return await fail(botResult.failure);
    }
    const botUserId = botResult.value;

    const bootstrapClient = createGitHubClient({
      token: token.secret(),
      budget: bootstrap,
      ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
      ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    });
    const loadedResult = await loadPolicy({
      kind: 'github',
      client: bootstrapClient,
      repository: target,
      branch: event.repository.defaultBranch,
    });
    const policyLoadedAt = clock.now().toISOString();
    if (!loadedResult.ok) {
      return await fail(mapHostedPolicyFailure(loadedResult.failure));
    }
    const loaded = loadedResult.value;
    if (loaded.revision.kind !== 'git-tree') {
      return await fail(
        err(
          'gate.policy-invalid',
          HOSTED_GATE_FAILURE_CAUSES['gate.policy-invalid'],
          'The published policy on the default branch is invalid.',
        ).failure,
      );
    }
    const policyRevision = loaded.revision.id;
    policyRevisionForSummary = policyRevision;
    const policy = loaded.policy;
    logLines.push(`policy trusted-branch revision ${policyRevision}`);

    const refusal = repositoryGateRefusal(policy);
    if (!refusal.ok) {
      return await fail(refusal.failure);
    }

    const runBudget = githubBudgetForPolicy(policy);
    const client = createGitHubClient({
      token: token.secret(),
      budget: runBudget,
      ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
      ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    });

    const listing = await readOwnershipListing(client, target, event.subject, { resolver, transport });
    if (listing.kind === 'unique' && listing.record.kind === 'valid') {
      logLines.push(
        `listing ${listing.kind} owner ${String(listing.record.record.run_id)}-${String(listing.record.record.run_attempt)}`,
      );
    } else if (listing.kind === 'unique') {
      logLines.push(`listing ${listing.kind} record ${listing.record.kind}`);
    } else {
      logLines.push(`listing ${listing.kind}`);
    }

    let listingFailure: StewardFailure | null = null;
    if (listing.kind === 'unavailable') {
      listingFailure = err(
        'ownership.listing-unavailable',
        'github-unavailable',
        'The ownership listing could not be read.',
      ).failure;
    } else if (listing.kind === 'unique' && listing.record.kind === 'unavailable') {
      listingFailure = err(
        'ownership.listing-unavailable',
        'github-unavailable',
        'The ownership listing could not be read.',
      ).failure;
    } else if (listing.kind === 'unique' && listing.record.kind === 'invalid') {
      listingFailure = err('ownership.record-invalid', 'github-unavailable', 'The newest ownership record is invalid.').failure;
    }

    if (event.closure) {
      if (listingFailure !== null) {
        return await fail(listingFailure);
      }
      const paired =
        listing.kind === 'unique' && listing.record.kind === 'valid'
          ? {
              runId: listing.record.record.run_id,
              runAttempt: listing.record.record.run_attempt,
              snapshotHash: listing.record.record.snapshot_hash,
            }
          : null;
      const resolution = closureResolution(event) as ResolutionKind;
      const eventRecordResult = buildClosureMetricsEvent({
        repository: event.repository.fullName,
        type: event.subject.type,
        number: event.subject.number,
        resolution,
        pairedRun: paired === null ? null : { runId: paired.runId, runAttempt: paired.runAttempt },
        pairedSnapshotHash: paired === null ? null : paired.snapshotHash,
        recordedAt: clock.now().toISOString(),
      });
      if (!eventRecordResult.ok) {
        return await fail(eventRecordResult.failure);
      }
      const storeLocationResult = evidenceStoreLocation(policy.evidence.store, event.repository.fullName);
      if (!storeLocationResult.ok) {
        return await fail(storeLocationResult.failure);
      }
      const storeLocation = storeLocationResult.value;
      const closureRecordCandidate: ClosureContextRecord = {
        schema_version: 1,
        record_type: 'closure',
        run: { run_id: event.runId, run_attempt: event.runAttempt },
        repository: {
          full_name: event.repository.fullName,
          id: event.repository.id,
          default_branch: event.repository.defaultBranch,
        },
        subject: event.subject,
        policy: { revision: policyRevision, commit: loaded.revision.commit, ref: loaded.revision.ref, loaded_at: policyLoadedAt },
        store: {
          type: policy.evidence.store.type,
          repository: `${storeLocation.repository.owner}/${storeLocation.repository.name}`,
          branch: storeLocation.branch,
        },
        github_requests_remaining: Math.max(0, policy.limits.github.requests_per_run - runBudget.requestsUsed()),
        event: eventRecordResult.value,
      };

      const redactedResult = await redactEvidenceStrings(
        [{ value: closureRecordCandidate, schema: closureContextRecordSchema }],
        [],
        {
          credentials: [input.environment.credentials.privateKey, ...minted.map((t) => t.secret())],
          policyPatterns: policy.evidence.redaction_patterns.map((p) => ({ id: p.id, pattern: p.pattern })),
        },
      );
      if (!redactedResult.ok) {
        return await fail(redactedResult.failure);
      }
      const redactedClosure = redactedResult.value.records[0] as ClosureContextRecord;
      const closureBytesResult = encodeClosureContext(redactedClosure);
      if (!closureBytesResult.ok) {
        return await fail(closureBytesResult.failure);
      }

      logLines.push(`disposition closure resolution ${resolution}`);

      const outputs: Record<string, string> = {
        disposition: 'closure',
        commit: 'false',
        record_only: 'true',
        concurrency_group: '',
        snapshot_hash: '',
        policy_revision: policyRevision,
        ownership_artifact: '',
      };
      return await succeed('closure', outputs, [{ name: 'closure', bytes: closureBytesResult.value }]);
    }

    if (listingFailure !== null && appliesListingDeduplication(event.runAttempt, event.action)) {
      return await fail(listingFailure);
    }

    const receipts = listing.kind === 'unique' && listing.record.kind === 'valid' ? receiptsOf(listing.record.record) : [];
    const echo = isVerifiedEcho({ senderId: event.senderId, botUserId, triggeringResourceId: event.objectId, receipts });
    if (echo) {
      logLines.push('dedup duplicate echo');
      const outputs: Record<string, string> = {
        disposition: 'duplicate',
        commit: 'false',
        record_only: 'false',
        concurrency_group: '',
        snapshot_hash: '',
        policy_revision: policyRevision,
        ownership_artifact: '',
      };
      return await succeed('duplicate', outputs, []);
    }

    const captureResult = await gateCaptureSubmission(
      {
        client,
        repository: target,
        policy,
        policyRevision,
        attachmentResolver: resolver,
        attachmentTransport: transport,
        authorResponses: [],
      },
      event.subject,
    );
    if (!captureResult.ok) {
      return await fail(captureResult.failure);
    }
    const capture = captureResult.value;
    snapshotHashForSummary = capture.submission.snapshot_hash;

    let fallback: DedupFallbackRead | null = null;
    if (listing.kind === 'none' && appliesListingDeduplication(event.runAttempt, event.action)) {
      const storeLocationResult = evidenceStoreLocation(policy.evidence.store, event.repository.fullName);
      if (!storeLocationResult.ok) {
        fallback = { kind: 'unavailable' };
      } else {
        const storeLocation = storeLocationResult.value;
        if (storeLocation.repository.owner === target.owner && storeLocation.repository.name === target.name) {
          fallback = await readPublishedSnapshot(client, {
            store: storeLocation,
            targetRepository: event.repository.fullName,
            subject: event.subject,
          });
        } else {
          const storeTokenResult = await mintInstallationToken(
            input.environment.credentials,
            storeLocation.repository,
            'store-read',
            {
              budget: bootstrap,
              ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
              ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
            },
          );
          if (!storeTokenResult.ok) {
            fallback = { kind: 'unavailable' };
          } else {
            deps.mask(storeTokenResult.value.secret());
            minted.push(storeTokenResult.value);
            const storeClient = createGitHubClient({
              token: storeTokenResult.value.secret(),
              budget: runBudget,
              ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
              ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
            });
            fallback = await readPublishedSnapshot(storeClient, {
              store: storeLocation,
              targetRepository: event.repository.fullName,
              subject: event.subject,
            });
          }
        }
      }
    }

    const dedupResult = decideDeduplication({
      runAttempt: event.runAttempt,
      action: event.action,
      echo: false,
      listing: dedupListingRead(listing),
      fallback,
      captured: { snapshotHash: capture.submission.snapshot_hash, policyRevision },
    });
    if (!dedupResult.ok) {
      return await fail(dedupResult.failure);
    }
    const dedup = dedupResult.value;
    if (dedup.kind === 'duplicate') {
      logLines.push(
        `dedup duplicate ${dedup.reason}` +
          (dedup.keptOwner !== null ? ` owner ${String(dedup.keptOwner.runId)}-${String(dedup.keptOwner.runAttempt)}` : ''),
      );
      if (dedup.keptOwner !== null) {
        ownerForSummary = { action: 'kept', runId: dedup.keptOwner.runId, runAttempt: dedup.keptOwner.runAttempt };
      }
      const outputs: Record<string, string> = {
        disposition: 'duplicate',
        commit: 'false',
        record_only: 'false',
        concurrency_group: '',
        snapshot_hash: capture.submission.snapshot_hash,
        policy_revision: policyRevision,
        ownership_artifact: '',
      };
      return await succeed('duplicate', outputs, []);
    }
    logLines.push(`dedup commit ${dedup.reason}`);

    let disposition: 'runnable' | 'early-exit' | 'queued';
    let cap: OwnershipCapValue | null = null;
    if (capture.earlyExit !== null) {
      disposition = 'early-exit';
    } else {
      const lists = await readCapRunLists(client, target, clock.now());
      if (lists.failure !== null) {
        return await fail(
          err('caps.run-list-unavailable', 'github-unavailable', 'The run list could not be read completely.').failure,
        );
      }
      const capsResult = evaluateCaps({
        createdToday: lists.createdToday,
        inProgress: lists.inProgress,
        queued: lists.queued,
        now: clock.now(),
        botUserId,
        authorId: event.authorId,
        currentRunId: event.runId,
        dailyLimit: policy.limits.caps.daily_runs,
        authorLimit: policy.limits.caps.per_author_concurrent_runs,
      });
      if (!capsResult.ok) {
        return await fail(
          err('caps.run-list-unavailable', 'github-unavailable', 'The run list could not be read completely.').failure,
        );
      }
      const evaluated = capsResult.value;
      cap = {
        state: evaluated.state,
        daily_count: evaluated.dailyCount,
        daily_limit: evaluated.dailyLimit,
        author_count: evaluated.authorCount,
        author_limit: evaluated.authorLimit,
      };
      capsForSummary = {
        dailyCount: evaluated.dailyCount,
        dailyLimit: evaluated.dailyLimit,
        authorCount: evaluated.authorCount,
        authorLimit: evaluated.authorLimit,
      };
      disposition = evaluated.state === 'within' ? 'runnable' : 'queued';
      logLines.push(
        `caps ${evaluated.state} daily ${String(evaluated.dailyCount)} of ${String(evaluated.dailyLimit)} author ${String(evaluated.authorCount)} of ${String(evaluated.authorLimit)}`,
      );
    }
    logLines.push(`disposition ${disposition}`);

    const handoffCandidate = buildGateHandoff(capture, {
      run: { run_id: event.runId, run_attempt: event.runAttempt },
      policyRevision,
      budgetRemaining: initialBudget(policy, { githubRequests: runBudget.requestsUsed() }),
    });
    const handoffValidated = validateHandoff(handoffCandidate, {
      previous: null,
      gate: null,
      maxRounds: policy.stages.challenge_rounds,
    });
    if (!handoffValidated.ok) {
      return await fail(handoffValidated.failure);
    }

    const ownershipRecordCandidate: OwnershipRecord = {
      schema_version: 1,
      record_type: 'ownership',
      repository: event.repository.fullName,
      subject: event.subject,
      run_id: event.runId,
      run_attempt: event.runAttempt,
      check_id: null,
      snapshot_hash: capture.submission.snapshot_hash,
      policy_revision: policyRevision,
      disposition,
      admission: 'not-required',
      cap,
      event: eventIdentity(event),
      author_id: event.authorId,
      created_at: clock.now().toISOString(),
    };

    const storeLocationForContextResult = evidenceStoreLocation(policy.evidence.store, event.repository.fullName);
    if (!storeLocationForContextResult.ok) {
      return await fail(storeLocationForContextResult.failure);
    }
    const storeLocationForContext = storeLocationForContextResult.value;

    const completedAt = clock.now().toISOString();
    const contextLogLines = logLines.slice(0, GATE_CONTEXT_LOG_LINES_MAX);

    const gateContextCandidate: GateContextRecord = {
      schema_version: 1,
      record_type: 'gate-context',
      run: { run_id: event.runId, run_attempt: event.runAttempt },
      repository: { full_name: event.repository.fullName, id: event.repository.id, default_branch: event.repository.defaultBranch },
      subject: event.subject,
      disposition,
      snapshot_hash: capture.submission.snapshot_hash,
      policy: { revision: policyRevision, commit: loaded.revision.commit, ref: loaded.revision.ref, loaded_at: policyLoadedAt },
      store: {
        type: policy.evidence.store.type,
        repository: `${storeLocationForContext.repository.owner}/${storeLocationForContext.repository.name}`,
        branch: storeLocationForContext.branch,
      },
      submission: capture.submission,
      base_commit: capture.baseCommit,
      mode: capture.mode,
      classification: classificationRecord(capture.classification),
      required_stages: [...capture.requiredStages],
      cap,
      github_requests: bootstrap.requestsUsed() + runBudget.requestsUsed(),
      started_at: started.toISOString(),
      completed_at: completedAt,
      log_lines: contextLogLines,
    };

    const redactedResult = await redactEvidenceStrings(
      [
        { value: handoffValidated.value, schema: handoffRecordSchema },
        { value: gateContextCandidate, schema: gateContextRecordSchema },
      ],
      [],
      {
        credentials: [input.environment.credentials.privateKey, ...minted.map((t) => t.secret())],
        policyPatterns: policy.evidence.redaction_patterns.map((p) => ({ id: p.id, pattern: p.pattern })),
      },
    );
    if (!redactedResult.ok) {
      return await fail(redactedResult.failure);
    }
    const redactedHandoff = redactedResult.value.records[0];
    const redactedContext = redactedResult.value.records[1] as GateContextRecord;

    const handoffCanonical = canonicalJson(redactedHandoff);
    if (!handoffCanonical.ok) {
      return await fail(handoffCanonical.failure);
    }
    const handoffBytes = new TextEncoder().encode(handoffCanonical.value);
    const contextBytesResult = encodeGateContext(redactedContext);
    if (!contextBytesResult.ok) {
      return await fail(contextBytesResult.failure);
    }

    const ownershipBytesResult = encodeOwnershipRecord(ownershipRecordCandidate);
    if (!ownershipBytesResult.ok) {
      return await fail(ownershipBytesResult.failure);
    }

    const outputs: Record<string, string> = {
      disposition,
      commit: 'true',
      record_only: 'false',
      concurrency_group: stewardConcurrencyGroup(event.repository.id, event.subject.type, event.subject.number),
      snapshot_hash: capture.submission.snapshot_hash,
      policy_revision: policyRevision,
      ownership_artifact: ownershipArtifactName(event.subject.type, event.subject.number),
    };
    ownerForSummary = { action: 'committed', runId: event.runId, runAttempt: event.runAttempt };

    return await succeed(disposition, outputs, [
      { name: 'handoff', bytes: handoffBytes },
      { name: 'gate-context', bytes: contextBytesResult.value },
      { name: 'ownership', bytes: ownershipBytesResult.value },
    ]);
  } catch {
    return await fail(INTERNAL_ERROR);
  }
}
