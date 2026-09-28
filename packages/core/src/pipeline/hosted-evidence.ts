import { decisionFindings, prepareFindings } from '../evidence/assemble.js';
import type { EvidenceRedactFn } from '../evidence/redact-records.js';
import { hostedEvidenceLocation } from '../evidence/git-store.js';
import type { EvidenceStoreGroup, EvidenceStoreLocation } from '../evidence/git-store.js';
import { runStorePath } from '../evidence/layout.js';
import type { RunPhaseLatency } from '../evidence/metrics.js';
import { prepareRunEvidence } from '../evidence/publish.js';
import type { RunEvidenceFailureCode } from '../evidence/publish.js';
import { prepareWaitingEvidence } from '../evidence/prepare-waiting.js';
import type { WaitingEvidenceFailureCode } from '../evidence/prepare-waiting.js';
import { runEvidenceGroups } from '../evidence/prepare-records.js';
import type { EvidenceGroupFailureCode } from '../evidence/prepare-records.js';
import { findingTemplateContext } from '../evidence/report-input.js';
import { decideOutcome } from '../decision/table.js';
import type { DecisionInput, DecisionResult } from '../decision/table.js';
import type { LoadedPolicy } from '../policy/loader.js';
import type { Outcome } from '../vocabulary.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import { gateContextClassification } from './gate-context.js';
import type { GateContextRecord } from './gate-context.js';
import { localDecisionInput } from './publish-phase.js';
import type { HandoffRecord } from './handoff.js';

export interface HostedEvidenceInput {
  readonly context: GateContextRecord;
  readonly handoff: HandoffRecord;
  readonly loadedPolicy: LoadedPolicy;
  readonly stewardVersion: string;
  readonly store: EvidenceStoreLocation;
  readonly arrivalAt: string;
  readonly publishStartedAt: string;
  readonly finishedAt: string;
  readonly publishRequests: number;
  readonly retries: number;
  readonly logLines: readonly string[];
  readonly credentials: readonly string[];
}

export type HostedRunEvidence =
  | {
      readonly kind: 'outcome';
      readonly outcome: Outcome;
      readonly decisionRow: number;
      readonly storePath: string;
      readonly location: string;
      readonly groups: readonly EvidenceStoreGroup[];
    }
  | {
      readonly kind: 'waiting';
      readonly storePath: string;
      readonly location: string;
      readonly groups: readonly EvidenceStoreGroup[];
    };

export type HostedEvidenceFailureCode =
  RunEvidenceFailureCode | WaitingEvidenceFailureCode | EvidenceGroupFailureCode | 'pipeline.decision-invalid';

export interface HostedEvidenceOptions {
  readonly redact?: EvidenceRedactFn;
  readonly decide?: (input: DecisionInput) => DecisionResult;
}

function elapsedSeconds(from: string, to: string): number {
  return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 1000);
}

export async function prepareHostedRunEvidence(
  input: HostedEvidenceInput,
  options: HostedEvidenceOptions = {},
): Promise<Result<HostedRunEvidence, HostedEvidenceFailureCode>> {
  try {
    const { context, handoff, loadedPolicy } = input;
    const runId = context.run.run_id;
    const runAttempt = context.run.run_attempt;
    const storePath = runStorePath(context.subject.type, context.subject.number, runId, runAttempt);
    const location = hostedEvidenceLocation(input.store, context.repository.full_name, storePath);

    const phases: readonly RunPhaseLatency[] = [
      { phase: 'gate', seconds: elapsedSeconds(context.started_at, context.completed_at), recordedAt: context.completed_at },
      { phase: 'publish', seconds: elapsedSeconds(input.publishStartedAt, input.finishedAt), recordedAt: input.finishedAt },
    ];

    const githubRequests = context.github_requests + input.publishRequests;
    const logLines = [...context.log_lines, ...input.logLines];

    if (context.disposition === 'queued') {
      const { cap } = context;
      if (cap === null || (cap.state !== 'daily-runs' && cap.state !== 'per-author-concurrent-runs')) {
        return err('evidence.record-invalid', 'steward-defect', 'An evidence record failed its schema.');
      }

      const waiting = await prepareWaitingEvidence(
        {
          runId,
          runAttempt,
          startedAt: context.started_at,
          queuedAt: context.completed_at,
          finishedAt: input.finishedAt,
          phases,
          stewardVersion: input.stewardVersion,
          loadedPolicy,
          policyLoadedAt: context.policy.loaded_at,
          submission: context.submission,
          baseCommit: context.base_commit,
          mode: context.mode,
          githubRequests,
          retries: input.retries,
          waiting: {
            reason: cap.state,
            counts: {
              daily_count: cap.daily_count,
              daily_limit: cap.daily_limit,
              author_count: cap.author_count,
              author_limit: cap.author_limit,
            },
            arrivalAt: input.arrivalAt,
          },
          logLines,
          credentials: input.credentials,
        },
        options.redact !== undefined ? { redact: options.redact } : {},
      );
      if (!waiting.ok) {
        return waiting;
      }

      const groups = runEvidenceGroups({
        storePath: waiting.value.storePath,
        files: waiting.value.files,
        manifestBytes: waiting.value.manifestBytes,
        metrics: waiting.value.metrics,
      });
      if (!groups.ok) {
        return groups;
      }

      return ok({ kind: 'waiting', storePath: waiting.value.storePath, location, groups: groups.value });
    }

    const prepared = prepareFindings(
      handoff.findings,
      findingTemplateContext(context.submission, loadedPolicy.policy, context.repository.default_branch),
    );
    if (!prepared.ok) {
      return prepared;
    }

    const decisionInput = localDecisionInput(handoff, [], context.required_stages, decisionFindings(prepared.value));

    let decisionResult: DecisionResult;
    try {
      decisionResult = (options.decide ?? decideOutcome)(decisionInput);
    } catch {
      return err('pipeline.decision-invalid', 'steward-defect', 'The decision could not be made.');
    }
    if (decisionResult.kind !== 'outcome') {
      return err('pipeline.decision-invalid', 'steward-defect', 'The decision could not be made.');
    }
    const decision = decisionResult;

    const decisionLogLines = [
      ...logLines,
      `decision row ${decision.row} outcome ${decision.outcome}`,
      ...decision.causes.map((cause) => `decision cause ${cause.cause} ${cause.code}`),
    ];

    const runEvidence = await prepareRunEvidence(
      {
        assembly: {
          runId,
          runAttempt,
          startedAt: context.started_at,
          gateCompletedAt: context.completed_at,
          finishedAt: input.finishedAt,
          phases,
          stewardVersion: input.stewardVersion,
          loadedPolicy,
          policyLoadedAt: context.policy.loaded_at,
          submission: context.submission,
          baseCommit: context.base_commit,
          mode: context.mode,
          findings: prepared.value,
          decision,
          githubRequests,
          retries: input.retries,
        },
        classification: gateContextClassification(context),
        defaultBranch: context.repository.default_branch,
        logLines: decisionLogLines,
        credentials: input.credentials,
        localRun: false,
        createdAt: input.finishedAt,
        evidenceLocation: location,
      },
      options.redact !== undefined ? { redact: options.redact } : {},
    );
    if (!runEvidence.ok) {
      return runEvidence;
    }

    const groups = runEvidenceGroups({
      storePath: runEvidence.value.storePath,
      files: runEvidence.value.files,
      manifestBytes: runEvidence.value.manifestBytes,
      metrics: runEvidence.value.metrics,
    });
    if (!groups.ok) {
      return groups;
    }

    return ok({
      kind: 'outcome',
      outcome: decision.outcome,
      decisionRow: decision.row,
      storePath: runEvidence.value.storePath,
      location,
      groups: groups.value,
    });
  } catch {
    return err('evidence.write-failed', 'steward-defect', 'The evidence write failed.');
  }
}
