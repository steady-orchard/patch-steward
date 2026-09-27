import type { Clock, RandomSource } from '../clock.js';
import { systemClock, systemRandom } from '../clock.js';
import { localRunId } from '../evidence/layout.js';
import type { PublishedRun, RunEvidenceOptions } from '../evidence/publish.js';
import type { RunPhaseLatency } from '../evidence/metrics.js';
import type { GitHubFetch } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type { AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import { httpsAttachmentTransport, systemAttachmentResolver } from '../net/https-transport.js';
import { findPolicyLimit } from '../policy/bounds.js';
import type { LoadedPolicy } from '../policy/loader.js';
import type { DecidedOutcome, DecisionInput, DecisionResult } from '../decision/table.js';
import type { Result, StewardFailure } from '../result.js';
import { err } from '../result.js';
import type { StewardVersionFailureCode } from '../version.js';
import { stewardVersion } from '../version.js';
import type { SubmissionType } from '../vocabulary.js';

import type { GateFailureStage, GateInput, GateResult, ScreenPolicySource } from './gate.js';
import { runGate } from './gate.js';
import type { PhaseImplementations } from './phases.js';
import { LOCAL_PHASES, runWithPhaseTimeout } from './phases.js';
import { PIPELINE_FAILURE_MESSAGES, acceptGateHandoff, runPhaseSequence } from './sequence.js';
import type { LocalDecision, LocalPublishInput } from './publish-phase.js';
import { publishLocalRun } from './publish-phase.js';

export interface ScreenDeps {
  readonly repository: GitHubRepositoryRef;
  readonly submission: { readonly type: SubmissionType; readonly number: number };
  readonly policySource: ScreenPolicySource;
  readonly token: string | null;
  readonly evidenceDir: string;
  readonly fetch?: GitHubFetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly attachmentResolver?: AttachmentResolver;
  readonly attachmentTransport?: AttachmentTransport;
  readonly clock?: Clock;
  readonly random?: RandomSource;
  readonly phaseTimeoutMs?: number;
  readonly gate?: (input: GateInput) => Promise<GateResult>;
  readonly phases?: Partial<PhaseImplementations>;
  readonly evidence?: RunEvidenceOptions;
  readonly decide?: (input: DecisionInput) => DecisionResult;
  readonly version?: () => Result<string, StewardVersionFailureCode>;
}

export interface ScreenPolicyInfo {
  readonly source: 'trusted-branch' | 'local-file';
  readonly revision: string;
  readonly ref: string | null;
  readonly commit: string | null;
  readonly path: string | null;
  readonly authoritative: boolean;
}

export type ScreenPreRunStage = 'version' | GateFailureStage | 'gate';

export type ScreenResult =
  | {
      readonly kind: 'not-started';
      readonly stage: ScreenPreRunStage;
      readonly repository: string | null;
      readonly policy: ScreenPolicyInfo | null;
      readonly failure: StewardFailure;
      readonly exitStatus: 1 | 2;
    }
  | {
      readonly kind: 'publish-failed';
      readonly repository: string;
      readonly policy: ScreenPolicyInfo;
      readonly run: { readonly run_id: string; readonly run_attempt: number; readonly snapshot_hash: string };
      readonly failure: StewardFailure;
      readonly exitStatus: 2;
    }
  | {
      readonly kind: 'completed';
      readonly repository: string;
      readonly policy: ScreenPolicyInfo;
      readonly published: PublishedRun;
      readonly decision: LocalDecision;
      readonly exitStatus: 0 | 1 | 3;
    };

export const SCREEN_FAILURE_CODES = ['screen.evidence-write-failed', 'steward.internal-error'] as const;
export type ScreenFailureCode = (typeof SCREEN_FAILURE_CODES)[number];

export const SCREEN_EXIT_BY_OUTCOME: { readonly [K in DecidedOutcome]: 0 | 1 | 3 } = Object.freeze({
  pass: 0,
  'needs-changes': 1,
  uncertain: 1,
  inconclusive: 3,
  superseded: 1,
});

export function screenPolicyInfo(loaded: LoadedPolicy): ScreenPolicyInfo {
  if (loaded.revision.kind === 'git-tree') {
    return {
      source: 'trusted-branch',
      revision: loaded.revision.id,
      ref: loaded.revision.ref,
      commit: loaded.revision.commit,
      path: null,
      authoritative: true,
    };
  }
  return {
    source: 'local-file',
    revision: loaded.revision.id,
    ref: null,
    commit: null,
    path: loaded.revision.path,
    authoritative: false,
  };
}

export function screenPreRunExitStatus(failure: StewardFailure): 1 | 2 {
  return failure.code === 'screen.policy-file-invalid' ? 1 : 2;
}

export function screenPublishFailure(failure: StewardFailure): StewardFailure<'screen.evidence-write-failed'> {
  return err('screen.evidence-write-failed', failure.cause, 'The run evidence could not be written; no report was produced.', [
    { code: failure.code, path: '', message: failure.message, line: null, column: null },
  ]).failure;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function screenSubmission(deps: ScreenDeps): Promise<ScreenResult> {
  const clock = deps.clock ?? systemClock;
  const random = deps.random ?? systemRandom;
  let retries = 0;
  const sleep = (ms: number): Promise<void> => {
    retries += 1;
    return (deps.sleep ?? defaultSleep)(ms);
  };

  const runAttempt = 1;
  let runId: string | undefined;
  let repositoryKnown: string | null = null;
  let policyKnown: ScreenPolicyInfo | null = null;
  let snapshotHashKnown: string | null = null;
  let runExists = false;

  try {
    const version = (deps.version ?? stewardVersion)();
    if (!version.ok) {
      return { kind: 'not-started', stage: 'version', repository: null, policy: null, failure: version.failure, exitStatus: 2 };
    }

    const startedAt = clock.now();
    runId = localRunId(startedAt, random);

    const gateInput: GateInput = {
      repository: deps.repository,
      submission: deps.submission,
      policySource: deps.policySource,
      token: deps.token,
      sleep,
      attachmentResolver: deps.attachmentResolver ?? systemAttachmentResolver,
      attachmentTransport: deps.attachmentTransport ?? httpsAttachmentTransport,
      run: { run_id: runId, run_attempt: runAttempt },
      clock,
      ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
    };

    const stageSecondsMaxMs = (findPolicyLimit('limits.stage_seconds')?.max ?? 21600) * 1000;
    const gateOutcome = await runWithPhaseTimeout<GateResult>(
      () => (deps.gate ?? runGate)(gateInput),
      deps.phaseTimeoutMs ?? stageSecondsMaxMs,
    );

    if (gateOutcome.kind !== 'done') {
      const failure =
        gateOutcome.kind === 'timeout'
          ? err('pipeline.phase-timeout', 'budget-exhausted', PIPELINE_FAILURE_MESSAGES['pipeline.phase-timeout']).failure
          : err('pipeline.phase-failed', 'steward-defect', PIPELINE_FAILURE_MESSAGES['pipeline.phase-failed']).failure;
      return { kind: 'not-started', stage: 'gate', repository: repositoryKnown, policy: policyKnown, failure, exitStatus: 2 };
    }

    const gateResult = gateOutcome.value;
    if (!gateResult.ok) {
      const policy = gateResult.loadedPolicy !== null ? screenPolicyInfo(gateResult.loadedPolicy) : null;
      return {
        kind: 'not-started',
        stage: gateResult.stage,
        repository: gateResult.repository,
        policy,
        failure: gateResult.failure,
        exitStatus: screenPreRunExitStatus(gateResult.failure),
      };
    }

    const gate = gateResult.value;
    const repository = gate.repository;
    const policy = screenPolicyInfo(gate.loadedPolicy);
    repositoryKnown = repository;
    policyKnown = policy;
    snapshotHashKnown = gate.submission.snapshot_hash;
    const maxRounds = gate.loadedPolicy.policy.stages.challenge_rounds;

    const accepted = acceptGateHandoff(
      gate.handoff,
      {
        run_id: runId,
        run_attempt: runAttempt,
        snapshot_hash: gate.submission.snapshot_hash,
        policy_revision: gate.loadedPolicy.revision.id,
      },
      maxRounds,
    );
    if (!accepted.ok) {
      return { kind: 'not-started', stage: 'gate', repository, policy, failure: accepted.failure, exitStatus: 2 };
    }

    runExists = true;

    const gateEnded = clock.now();
    const gateLatency: RunPhaseLatency = {
      phase: 'gate',
      seconds: Math.max(0, (gateEnded.getTime() - startedAt.getTime()) / 1000),
      recordedAt: gateEnded.toISOString(),
    };
    const gateLine =
      accepted.value.early_exit === null ? 'gate complete' : `gate complete; early exit ${accepted.value.early_exit}`;

    const sequence = await runPhaseSequence({
      gate: accepted.value,
      maxRounds,
      timeoutMs: deps.phaseTimeoutMs ?? gate.loadedPolicy.policy.limits.stage_seconds * 1000,
      policy: gate.loadedPolicy.policy,
      phases: { ...LOCAL_PHASES, ...deps.phases },
      clock,
    });

    const finishedAt = clock.now().toISOString();

    const publishInput: LocalPublishInput = {
      context: {
        runId,
        runAttempt,
        startedAt: startedAt.toISOString(),
        gateCompletedAt: gateEnded.toISOString(),
        stewardVersion: version.value,
        loadedPolicy: gate.loadedPolicy,
        policyLoadedAt: gate.policyLoadedAt,
        defaultBranch: gate.defaultBranch,
        submission: gate.submission,
        baseCommit: gate.baseCommit,
        mode: gate.mode,
        classification: gate.classification,
        requiredStages: gate.requiredStages,
        githubRequests: gate.githubRequests,
        retries,
      },
      handoff: sequence.last,
      runnerCauses: sequence.causes,
      phases: [gateLatency, ...sequence.phases],
      logLines: [...gate.logLines, gateLine, ...sequence.logLines],
      evidenceDir: deps.evidenceDir,
      credentials: deps.token === null ? [] : [deps.token],
      finishedAt,
    };

    const result = await publishLocalRun(publishInput, {
      ...(deps.evidence !== undefined ? { evidence: deps.evidence } : {}),
      ...(deps.decide !== undefined ? { decide: deps.decide } : {}),
    });

    if (!result.ok) {
      return {
        kind: 'publish-failed',
        repository,
        policy,
        run: { run_id: runId, run_attempt: runAttempt, snapshot_hash: gate.submission.snapshot_hash },
        failure: screenPublishFailure(result.failure),
        exitStatus: 2,
      };
    }

    return {
      kind: 'completed',
      repository,
      policy,
      published: result.value.published,
      decision: result.value.decision,
      exitStatus: SCREEN_EXIT_BY_OUTCOME[result.value.decision.outcome],
    };
  } catch {
    const failure = err('steward.internal-error', 'steward-defect', 'An internal error stopped the run.').failure;
    if (runExists && runId !== undefined && repositoryKnown !== null && policyKnown !== null) {
      return {
        kind: 'publish-failed',
        repository: repositoryKnown,
        policy: policyKnown,
        run: { run_id: runId, run_attempt: runAttempt, snapshot_hash: snapshotHashKnown ?? '' },
        failure,
        exitStatus: 2,
      };
    }
    return { kind: 'not-started', stage: 'gate', repository: repositoryKnown, policy: policyKnown, failure, exitStatus: 2 };
  }
}
