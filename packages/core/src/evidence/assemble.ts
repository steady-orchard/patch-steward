import { findingId } from './layout.js';
import { buildRunMetricsEvents } from './metrics.js';
import type { RunPhaseLatency } from './metrics.js';
import type { HandoffFinding } from '../pipeline/handoff.js';
import { findingTexts } from '../report/finding-templates.js';
import type { FindingTemplateContext, FindingTexts } from '../report/finding-templates.js';
import { CONTRACT_FINDING_CODES, CONTRACT_FINDING_SEVERITIES } from '../submission/contract.js';
import type { ContractFindingCode } from '../submission/contract.js';
import type { DecisionFinding, DecisionResult } from '../decision/table.js';
import { runRecordSchema } from '../records/run.js';
import type { RunRecord } from '../records/run.js';
import { findingRecordSchema } from '../records/finding.js';
import type { FindingRecord } from '../records/finding.js';
import { decisionRecordSchema } from '../records/decision.js';
import type { DecisionRecord } from '../records/decision.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import { policyRevisionRecord } from '../policy/revision-record.js';
import type { PolicyRevisionRecord } from '../policy/revision-record.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { RECORD_LIST_MAX_ITEMS } from '../policy/bounds.js';
import type { Mode } from '../vocabulary.js';
import type { MetricsEventRecord } from '../records/metrics-event.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export interface PreparedFinding {
  readonly findingId: string;
  readonly sequence: number;
  readonly finding: HandoffFinding;
  readonly texts: FindingTexts;
}

export type RunAssemblyFailureCode = 'evidence.record-invalid' | 'report.template-missing';

export function prepareFindings(
  findings: readonly HandoffFinding[],
  ctx: FindingTemplateContext,
): Result<readonly PreparedFinding[], RunAssemblyFailureCode> {
  const prepared: PreparedFinding[] = [];
  for (let i = 0; i < findings.length; i += 1) {
    const finding = findings[i]!;
    const sequence = i + 1;
    const id = findingId(sequence);

    if (
      !CONTRACT_FINDING_CODES.includes(finding.code as ContractFindingCode) ||
      finding.severity !== CONTRACT_FINDING_SEVERITIES[finding.code as ContractFindingCode]
    ) {
      return err('report.template-missing', 'steward-defect', 'No report template matches the finding.');
    }

    const textsResult = findingTexts(
      { code: finding.code as ContractFindingCode, detail: finding.detail, field: finding.field, subjects: finding.subjects },
      ctx,
    );
    if (!textsResult.ok) {
      return textsResult;
    }

    prepared.push({ findingId: id, sequence, finding, texts: textsResult.value });
  }
  return ok(prepared);
}

export function decisionFindings(prepared: readonly PreparedFinding[]): readonly DecisionFinding[] {
  return prepared.map((p) => ({
    finding_id: p.findingId,
    stage: p.finding.stage,
    severity: p.finding.severity,
    code: p.finding.code,
    request: p.texts.kind === 'blocker' ? p.texts.request : null,
  }));
}

export interface RunAssemblyInput {
  readonly runId: string | number;
  readonly runAttempt: number;
  readonly startedAt: string;
  readonly gateCompletedAt: string;
  readonly finishedAt: string;
  readonly phases: readonly RunPhaseLatency[];
  readonly stewardVersion: string;
  readonly loadedPolicy: LoadedPolicy;
  readonly policyLoadedAt: string;
  readonly submission: SubmissionRecord;
  readonly baseCommit: string | null;
  readonly mode: Mode;
  readonly findings: readonly PreparedFinding[];
  readonly decision: Extract<DecisionResult, { readonly kind: 'outcome' }>;
  readonly githubRequests: number;
  readonly retries: number;
}

export interface AssembledRun {
  readonly run: RunRecord;
  readonly submission: SubmissionRecord;
  readonly policyRevision: PolicyRevisionRecord;
  readonly findings: readonly FindingRecord[];
  readonly decision: DecisionRecord;
  readonly metricsEvents: readonly MetricsEventRecord[];
}

export function assembleRunRecords(input: RunAssemblyInput): Result<AssembledRun, RunAssemblyFailureCode> {
  const { decision, submission, loadedPolicy } = input;

  const runCandidate = {
    schema_version: 1,
    record_type: 'run',
    run_id: input.runId,
    run_attempt: input.runAttempt,
    subject: {
      kind: 'submission',
      repository: submission.repository,
      type: submission.type,
      number: submission.number,
      snapshot_hash: submission.snapshot_hash,
    },
    commits: { base: input.baseCommit, head: submission.head_commit, group: null },
    owned_check_id: null,
    policy_revision: loadedPolicy.revision.id,
    steward_version: input.stewardVersion,
    provider: loadedPolicy.policy.llm?.provider ?? null,
    requested_model: loadedPolicy.policy.llm?.model ?? null,
    reported_model: null,
    adapter_version: null,
    generation: null,
    runner_identity: null,
    mode: input.mode,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    budget: {
      model_calls: 0,
      tokens: null,
      ai_credits: null,
      container_seconds: 0,
      executions: 0,
      github_requests: input.githubRequests,
      retries: input.retries,
    },
  };
  const runParsed = runRecordSchema.safeParse(runCandidate);
  if (!runParsed.success) {
    return err('evidence.record-invalid', 'steward-defect', 'An assembled record failed its schema.');
  }

  const submissionParsed = submissionRecordSchema.safeParse(submission);
  if (!submissionParsed.success) {
    return err('evidence.record-invalid', 'steward-defect', 'An assembled record failed its schema.');
  }

  const policyRevisionResult = policyRevisionRecord(loadedPolicy, {
    stewardVersion: input.stewardVersion,
    loadedAt: input.policyLoadedAt,
  });
  if (!policyRevisionResult.ok) {
    return err('evidence.record-invalid', 'steward-defect', 'An assembled record failed its schema.');
  }

  const findingRecords: FindingRecord[] = [];
  for (const prepared of input.findings) {
    const { finding, texts } = prepared;
    const subjects = finding.subjects.slice(0, RECORD_LIST_MAX_ITEMS);
    let basis = finding.message;
    if (finding.subjects.length > RECORD_LIST_MAX_ITEMS) {
      basis += ` Subjects recorded: ${RECORD_LIST_MAX_ITEMS} of ${finding.subjects.length}.`;
    }
    const requestId = decision.requests.find((r) => r.finding_id === prepared.findingId)?.request_id ?? null;
    const candidate = {
      schema_version: 1,
      record_type: 'finding',
      run_id: input.runId,
      run_attempt: input.runAttempt,
      finding_id: prepared.findingId,
      stage: finding.stage,
      severity: finding.severity,
      scenario: texts.kind === 'note' ? texts.note : texts.scenario,
      location: { path: null, line: null, field: finding.field },
      evidence: [],
      basis,
      dismissal_code: null,
      code: finding.code,
      detail: finding.detail,
      subjects,
      request_id: requestId,
    };
    const parsed = findingRecordSchema.safeParse(candidate);
    if (!parsed.success) {
      return err('evidence.record-invalid', 'steward-defect', 'An assembled record failed its schema.');
    }
    findingRecords.push(parsed.data);
  }

  const decisionCandidate = {
    schema_version: 1,
    record_type: 'decision',
    run_id: input.runId,
    run_attempt: input.runAttempt,
    outcome: decision.outcome,
    contributing_findings: decision.contributing_findings,
    unmet_requirements: decision.unmet_requirements,
    requests: decision.requests.map(({ request_id, text }) => ({ request_id, text })),
    causes: decision.causes,
  };
  const decisionParsed = decisionRecordSchema.safeParse(decisionCandidate);
  if (!decisionParsed.success) {
    return err('evidence.record-invalid', 'steward-defect', 'An assembled record failed its schema.');
  }

  const metricsResult = buildRunMetricsEvents({
    runId: input.runId,
    runAttempt: input.runAttempt,
    gateCompletedAt: input.gateCompletedAt,
    phases: input.phases,
    finishedAt: input.finishedAt,
    outcome: decision.outcome,
  });
  if (!metricsResult.ok) {
    return metricsResult;
  }

  return ok({
    run: runParsed.data,
    submission: submissionParsed.data,
    policyRevision: policyRevisionResult.value,
    findings: findingRecords,
    decision: decisionParsed.data,
    metricsEvents: metricsResult.value,
  });
}
