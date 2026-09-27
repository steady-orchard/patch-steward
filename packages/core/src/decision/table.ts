import type { RecordCause } from '../records/decision.js';
import type { FindingSeverity, Outcome, PipelineStage, WaitingState } from '../vocabulary.js';
import { PIPELINE_STAGES } from '../vocabulary.js';

import type { StageResult } from './stages.js';
import { stageIncompleteCause } from './stages.js';

export const DECISION_CONTRACT_STAGE = 'contract';

export type DecidedOutcome = Exclude<Outcome, 'overridden'>;

export type DecisionRow = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface DecisionFinding {
  readonly finding_id: string;
  readonly stage: string;
  readonly severity: FindingSeverity;
  readonly code: string;
  readonly request: string | null;
}

export type DecisionRequirement =
  | { readonly id: string; readonly required: boolean; readonly status: 'satisfied' | 'missing' }
  | { readonly id: string; readonly required: boolean; readonly status: 'unavailable'; readonly cause: RecordCause };

export interface DecisionInput {
  readonly freshness: 'current' | 'snapshot-changed' | 'newer-owner';
  readonly capacity: 'available' | 'cap-reached';
  readonly admission: 'not-required' | 'admitted' | 'required';
  readonly findings: readonly DecisionFinding[];
  readonly causes: readonly RecordCause[];
  readonly requiredStages: readonly PipelineStage[];
  readonly stageResults: readonly StageResult[];
  readonly requirements: readonly DecisionRequirement[];
}

export interface DecisionRequest {
  readonly request_id: string;
  readonly finding_id: string;
  readonly text: string;
}

export type DecisionResult =
  | {
      readonly kind: 'outcome';
      readonly outcome: DecidedOutcome;
      readonly row: Exclude<DecisionRow, 4 | 5>;
      readonly contributing_findings: readonly string[];
      readonly unmet_requirements: readonly string[];
      readonly requests: readonly DecisionRequest[];
      readonly causes: readonly RecordCause[];
    }
  | { readonly kind: 'waiting'; readonly state: WaitingState; readonly row: 4 | 5 };

function contributingFindings(findings: readonly DecisionFinding[]): readonly string[] {
  return findings
    .filter((finding) => finding.severity === 'blocking' || finding.severity === 'uncertain')
    .map((finding) => finding.finding_id);
}

function unmetRequirements(requirements: readonly DecisionRequirement[]): readonly string[] {
  return requirements
    .filter((requirement) => requirement.required && requirement.status !== 'satisfied')
    .map((requirement) => requirement.id);
}

function buildRequests(findings: readonly DecisionFinding[]): readonly DecisionRequest[] {
  const requests: DecisionRequest[] = [];
  let sequence = 0;
  for (const finding of findings) {
    if (finding.severity !== 'blocking' || finding.request === null) {
      continue;
    }
    sequence += 1;
    requests.push({ request_id: `R${sequence}`, finding_id: finding.finding_id, text: finding.request });
  }
  return requests;
}

function outcomeResult(
  outcome: DecidedOutcome,
  row: Exclude<DecisionRow, 4 | 5>,
  input: DecisionInput,
  causes: readonly RecordCause[],
): DecisionResult {
  if (row === 1 || row === 9) {
    return { kind: 'outcome', outcome, row, contributing_findings: [], unmet_requirements: [], requests: [], causes: [] };
  }
  return {
    kind: 'outcome',
    outcome,
    row,
    contributing_findings: contributingFindings(input.findings),
    unmet_requirements: unmetRequirements(input.requirements),
    requests: buildRequests(input.findings),
    causes,
  };
}

export function decideOutcome(input: DecisionInput): DecisionResult {
  if (input.freshness === 'snapshot-changed' || input.freshness === 'newer-owner') {
    return outcomeResult('superseded', 1, input, []);
  }

  const blockingFindings = input.findings.filter((finding) => finding.severity === 'blocking');

  const sharedHead = blockingFindings.find((finding) => finding.code === 'submission.shared-head');
  if (sharedHead !== undefined) {
    return outcomeResult('needs-changes', 2, input, []);
  }

  const otherContractBlocking = blockingFindings.find((finding) => finding.stage === DECISION_CONTRACT_STAGE);
  if (otherContractBlocking !== undefined) {
    return outcomeResult('needs-changes', 3, input, []);
  }

  if (input.capacity === 'cap-reached') {
    return { kind: 'waiting', state: 'queued', row: 4 };
  }

  if (input.admission === 'required') {
    return { kind: 'waiting', state: 'awaiting-approval', row: 5 };
  }

  const requiredSet = new Set(input.requiredStages);
  const stageResultByStage = new Map(input.stageResults.map((result) => [result.stage, result] as const));
  const unavailableStageCauses = PIPELINE_STAGES.filter((stage) => requiredSet.has(stage))
    .map((stage) => stageResultByStage.get(stage))
    .filter((result): result is StageResult & { status: 'unavailable' } => result !== undefined && result.status === 'unavailable')
    .map((result) => result.cause);
  const unavailableRequirementCauses = input.requirements
    .filter(
      (requirement): requirement is DecisionRequirement & { status: 'unavailable' } =>
        requirement.required && requirement.status === 'unavailable',
    )
    .map((requirement) => requirement.cause);
  const incompleteCause = stageIncompleteCause(input.requiredStages, input.stageResults);

  const requiredWorkUnavailable =
    input.causes.length > 0 ||
    unavailableStageCauses.length > 0 ||
    unavailableRequirementCauses.length > 0 ||
    incompleteCause !== null;

  if (requiredWorkUnavailable) {
    const causes: RecordCause[] = [...input.causes, ...unavailableStageCauses, ...unavailableRequirementCauses];
    if (incompleteCause !== null) {
      causes.push(incompleteCause);
    }
    return outcomeResult('inconclusive', 6, input, causes);
  }

  const uncertainFinding = input.findings.find((finding) => finding.severity === 'uncertain');
  if (uncertainFinding !== undefined) {
    return outcomeResult('uncertain', 7, input, []);
  }

  const missingRequirement = input.requirements.find((requirement) => requirement.required && requirement.status === 'missing');
  if (missingRequirement !== undefined || blockingFindings.length > 0) {
    return outcomeResult('needs-changes', 8, input, []);
  }

  return outcomeResult('pass', 9, input, []);
}
