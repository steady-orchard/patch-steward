import { prepareFindings, decisionFindings } from '../evidence/assemble.js';
import { findingTemplateContext } from '../evidence/report-input.js';
import { publishRunEvidence } from '../evidence/publish.js';
import type { RunEvidenceOptions, RunEvidenceFailureCode, PublishedRun } from '../evidence/publish.js';
import { decideOutcome } from '../decision/table.js';
import type { DecisionFinding, DecisionInput, DecisionResult } from '../decision/table.js';
import type { RunPhaseLatency } from '../evidence/metrics.js';
import type { LoadedPolicy } from '../policy/loader.js';
import type { SubmissionRecord } from '../records/submission.js';
import type { RecordCause } from '../records/decision.js';
import type { Mode, PipelineStage } from '../vocabulary.js';
import type { ClassificationInput } from '../report/templates.js';
import type { HandoffRecord } from './handoff.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export interface LocalRunContext {
  readonly runId: string;
  readonly runAttempt: number;
  readonly startedAt: string;
  readonly gateCompletedAt: string;
  readonly stewardVersion: string;
  readonly loadedPolicy: LoadedPolicy;
  readonly policyLoadedAt: string;
  readonly defaultBranch: string;
  readonly submission: SubmissionRecord;
  readonly baseCommit: string | null;
  readonly mode: Mode;
  readonly classification: ClassificationInput;
  readonly requiredStages: readonly PipelineStage[];
  readonly githubRequests: number;
  readonly retries: number;
}

export interface LocalPublishInput {
  readonly context: LocalRunContext;
  readonly handoff: HandoffRecord;
  readonly runnerCauses: readonly RecordCause[];
  readonly phases: readonly RunPhaseLatency[];
  readonly logLines: readonly string[];
  readonly evidenceDir: string;
  readonly credentials: readonly string[];
  readonly finishedAt: string;
}

export interface LocalPublishOptions {
  readonly evidence?: RunEvidenceOptions;
  readonly decide?: (input: DecisionInput) => DecisionResult;
}

export type LocalDecision = Extract<DecisionResult, { readonly kind: 'outcome' }>;

export interface LocalPublishResult {
  readonly published: PublishedRun;
  readonly decision: LocalDecision;
}

export type LocalPublishFailureCode = RunEvidenceFailureCode | 'pipeline.decision-invalid';

export function localDecisionInput(
  handoff: HandoffRecord,
  runnerCauses: readonly RecordCause[],
  requiredStages: readonly PipelineStage[],
  findings: readonly DecisionFinding[],
): DecisionInput {
  return {
    freshness: 'current',
    capacity: 'available',
    admission: 'not-required',
    findings: [...findings],
    causes: [...handoff.causes, ...runnerCauses],
    requiredStages: [...requiredStages],
    stageResults: [...handoff.stage_results],
    requirements: [],
  };
}

export async function publishLocalRun(
  input: LocalPublishInput,
  options: LocalPublishOptions = {},
): Promise<Result<LocalPublishResult, LocalPublishFailureCode>> {
  const { context } = input;

  const prepared = prepareFindings(
    input.handoff.findings,
    findingTemplateContext(context.submission, context.loadedPolicy.policy, context.defaultBranch),
  );
  if (!prepared.ok) {
    return prepared;
  }

  const decisionInput = localDecisionInput(
    input.handoff,
    input.runnerCauses,
    context.requiredStages,
    decisionFindings(prepared.value),
  );

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

  const logLines = [
    ...input.logLines,
    `decision row ${decision.row} outcome ${decision.outcome}`,
    ...decision.causes.map((cause) => `decision cause ${cause.cause} ${cause.code}`),
  ];

  const published = await publishRunEvidence(
    {
      evidenceDir: input.evidenceDir,
      assembly: {
        runId: context.runId,
        runAttempt: context.runAttempt,
        startedAt: context.startedAt,
        gateCompletedAt: context.gateCompletedAt,
        finishedAt: input.finishedAt,
        phases: input.phases,
        stewardVersion: context.stewardVersion,
        loadedPolicy: context.loadedPolicy,
        policyLoadedAt: context.policyLoadedAt,
        submission: context.submission,
        baseCommit: context.baseCommit,
        mode: context.mode,
        findings: prepared.value,
        decision,
        githubRequests: context.githubRequests,
        retries: context.retries,
      },
      classification: context.classification,
      defaultBranch: context.defaultBranch,
      logLines,
      credentials: input.credentials,
      localRun: true,
      createdAt: input.finishedAt,
    },
    options.evidence ?? {},
  );
  if (!published.ok) {
    return published;
  }

  return ok({ published: published.value, decision });
}
