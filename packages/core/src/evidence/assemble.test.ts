import { describe, expect, it } from 'vitest';

import { assembleRunRecords, decisionFindings, prepareFindings } from './assemble.js';
import type { RunAssemblyInput } from './assemble.js';
import type { HandoffFinding } from '../pipeline/handoff.js';
import type { FindingTemplateContext } from '../report/finding-templates.js';
import { CONTRACT_FINDING_MESSAGES } from '../submission/contract.js';
import { decideOutcome } from '../decision/table.js';
import type { DecisionResult } from '../decision/table.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { RECORD_LIST_MAX_ITEMS } from '../policy/bounds.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';

const trustedPolicy: LoadedPolicy = {
  revision: { kind: 'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' },
  policy: DEFAULT_CHECKLIST_POLICY,
  authoritative: true,
};

const prSubmission = submissionRecordSchema.parse({
  schema_version: 1,
  record_type: 'submission',
  repository: 'octo/demo',
  type: 'pull_request',
  number: 12,
  snapshot_hash: 'sha256:' + '5'.repeat(64),
  target_branch: 'main',
  head_commit: 'c'.repeat(40),
  issue_kind: null,
  category: 'bugfix',
  fields: { category: 'bugfix' },
  linked_evidence_hashes: [],
  author_responses: [],
  shared_head_pull_requests: [],
  contract_results: [],
  trusted_paths_changed: false,
  execution_sensitive_paths_changed: false,
  template: { form: 'pull_request', version: 1 },
  attachments: [],
  claim_scope_hash: null,
});

const ctx: FindingTemplateContext = {
  repository: 'octo/demo',
  defaultBranch: 'main',
  submissionType: 'pull_request',
  template: { form: 'pull_request', version: 1 },
  category: 'bugfix',
  headCommit: 'c'.repeat(40),
  policy: DEFAULT_CHECKLIST_POLICY,
  policyChange: null,
};

function findings(overrides: { readonly f3Subjects?: readonly string[] } = {}): readonly HandoffFinding[] {
  return [
    {
      stage: 'contract',
      severity: 'blocking',
      code: 'submission.field-missing',
      detail: null,
      field: 'regression-test',
      subjects: [],
      message: CONTRACT_FINDING_MESSAGES['submission.field-missing'],
    },
    {
      stage: 'contract',
      severity: 'advisory',
      code: 'submission.trusted-path-change',
      detail: null,
      field: null,
      subjects: ['.github/workflows/ci.yml'],
      message: CONTRACT_FINDING_MESSAGES['submission.trusted-path-change'],
    },
    {
      stage: 'contract',
      severity: 'uncertain',
      code: 'submission.execution-sensitive-change',
      detail: null,
      field: null,
      subjects: overrides.f3Subjects !== undefined ? [...overrides.f3Subjects] : ['package.json'],
      message: CONTRACT_FINDING_MESSAGES['submission.execution-sensitive-change'],
    },
  ];
}

function baseAssemblyInput(
  decision: Extract<DecisionResult, { readonly kind: 'outcome' }>,
  preparedFindings: RunAssemblyInput['findings'],
): RunAssemblyInput {
  return {
    runId: RUN_ID,
    runAttempt: 1,
    startedAt: '2026-09-27T10:15:00.000Z',
    gateCompletedAt: '2026-09-27T10:15:01.000Z',
    finishedAt: '2026-09-27T10:15:03.000Z',
    phases: [{ phase: 'gate', seconds: 1, recordedAt: '2026-09-27T10:15:01.000Z' }],
    stewardVersion: '0.0.0-test',
    loadedPolicy: trustedPolicy,
    policyLoadedAt: '2026-09-27T10:15:00.500Z',
    submission: prSubmission,
    baseCommit: 'd'.repeat(40),
    mode: 'observe',
    findings: preparedFindings,
    decision,
    githubRequests: 7,
    retries: 0,
  };
}

describe('prepareFindings', () => {
  it('findings are numbered in handoff order', () => {
    const result = prepareFindings(findings(), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((p) => p.findingId)).toEqual(['finding-0001', 'finding-0002', 'finding-0003']);
    expect(result.value.map((p) => p.sequence)).toEqual([1, 2, 3]);
  });

  it('prepared findings carry their rendered request text', () => {
    const result = prepareFindings(findings(), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const decisionInputs = decisionFindings(result.value);
    expect(decisionInputs[0]?.request).toBe('Fill in the "Regression test" section.');
    expect(decisionInputs[1]?.request).toBeNull();
    expect(decisionInputs[2]?.request).toBeNull();
  });

  it('an unknown finding code fails as a steward defect', () => {
    const bad: readonly HandoffFinding[] = [
      {
        stage: 'contract',
        severity: 'blocking',
        code: 'stage.unknown',
        detail: null,
        field: null,
        subjects: [],
        message: 'unused',
      },
    ];
    const result = prepareFindings(bad, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('report.template-missing');
    expect(result.failure.cause).toBe('steward-defect');
  });

  it('a severity that differs from the contract severity fails', () => {
    const mismatched: readonly HandoffFinding[] = [
      {
        stage: 'contract',
        severity: 'advisory',
        code: 'submission.field-missing',
        detail: null,
        field: 'regression-test',
        subjects: [],
        message: CONTRACT_FINDING_MESSAGES['submission.field-missing'],
      },
    ];
    const result = prepareFindings(mismatched, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('report.template-missing');
  });
});

describe('assembleRunRecords', () => {
  it('run records carry the local provenance', () => {
    const prepared = prepareFindings(findings(), ctx);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const decisionResult = decideOutcome({
      freshness: 'current',
      capacity: 'available',
      admission: 'not-required',
      findings: decisionFindings(prepared.value),
      causes: [],
      requiredStages: ['references', 'claim'],
      stageResults: [],
      requirements: [],
    });
    expect(decisionResult.kind).toBe('outcome');
    if (decisionResult.kind !== 'outcome') return;

    const result = assembleRunRecords(baseAssemblyInput(decisionResult, prepared.value));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.run.provider).toBe('copilot-sdk');
    expect(result.value.run.requested_model).toBe('replace-with-model-id');
    expect(result.value.run.commits).toEqual({ base: 'd'.repeat(40), head: 'c'.repeat(40), group: null });
    expect(result.value.run.budget.github_requests).toBe(7);
  });

  it('finding records link their requests', () => {
    const prepared = prepareFindings(findings(), ctx);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const decisionResult = decideOutcome({
      freshness: 'current',
      capacity: 'available',
      admission: 'not-required',
      findings: decisionFindings(prepared.value),
      causes: [],
      requiredStages: ['references', 'claim'],
      stageResults: [],
      requirements: [],
    });
    expect(decisionResult.kind).toBe('outcome');
    if (decisionResult.kind !== 'outcome') return;
    expect(decisionResult.outcome).toBe('needs-changes');
    expect(decisionResult.row).toBe(3);

    const result = assembleRunRecords(baseAssemblyInput(decisionResult, prepared.value));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.findings[0]?.request_id).toBe('R1');
    expect(result.value.findings[1]?.request_id).toBeNull();
    expect(result.value.findings[2]?.request_id).toBeNull();
    expect(result.value.decision.requests).toEqual([{ request_id: 'R1', text: 'Fill in the "Regression test" section.' }]);
    expect(result.value.decision.requests[0]).not.toHaveProperty('finding_id');
  });

  it('finding records keep at most the record list maximum of subjects', () => {
    const manySubjects = Array.from({ length: 1500 }, (_, i) => `src/f-${String(i + 1).padStart(4, '0')}.ts`);
    const prepared = prepareFindings(findings({ f3Subjects: manySubjects }), ctx);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const decisionResult = decideOutcome({
      freshness: 'current',
      capacity: 'available',
      admission: 'not-required',
      findings: decisionFindings(prepared.value),
      causes: [],
      requiredStages: ['references', 'claim'],
      stageResults: [],
      requirements: [],
    });
    expect(decisionResult.kind).toBe('outcome');
    if (decisionResult.kind !== 'outcome') return;

    const result = assembleRunRecords(baseAssemblyInput(decisionResult, prepared.value));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const executionFinding = result.value.findings[2];
    expect(executionFinding?.subjects).toHaveLength(RECORD_LIST_MAX_ITEMS);
    expect(executionFinding?.subjects).toEqual(manySubjects.slice(0, RECORD_LIST_MAX_ITEMS));
    expect(executionFinding?.basis.endsWith(' Subjects recorded: 1000 of 1500.')).toBe(true);
  });

  it('decision records store requests and causes', () => {
    const uncontestedFindings = findings().slice(1);
    const prepared = prepareFindings(uncontestedFindings, ctx);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const decisionResult = decideOutcome({
      freshness: 'current',
      capacity: 'available',
      admission: 'not-required',
      findings: decisionFindings(prepared.value),
      causes: [],
      requiredStages: ['references', 'claim'],
      stageResults: [],
      requirements: [],
    });
    expect(decisionResult.kind).toBe('outcome');
    if (decisionResult.kind !== 'outcome') return;
    expect(decisionResult.outcome).toBe('inconclusive');

    const result = assembleRunRecords(baseAssemblyInput(decisionResult, prepared.value));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.decision.causes).toEqual([
      {
        cause: 'stage-incomplete',
        code: 'pipeline.stage-incomplete',
        message: 'Required stages produced no result.',
        subjects: ['references', 'claim'],
      },
    ]);
    expect(result.value.decision.contributing_findings).toContain(prepared.value[1]?.findingId);
  });

  it('metrics events are assembled for the run', () => {
    const prepared = prepareFindings(findings(), ctx);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const decisionResult = decideOutcome({
      freshness: 'current',
      capacity: 'available',
      admission: 'not-required',
      findings: decisionFindings(prepared.value),
      causes: [],
      requiredStages: ['references', 'claim'],
      stageResults: [],
      requirements: [],
    });
    expect(decisionResult.kind).toBe('outcome');
    if (decisionResult.kind !== 'outcome') return;

    const result = assembleRunRecords(baseAssemblyInput(decisionResult, prepared.value));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.metricsEvents.map((event) => event.kind)).toEqual([
      'state-transition',
      'latency',
      'cost',
      'state-transition',
    ]);
    const last = result.value.metricsEvents[result.value.metricsEvents.length - 1];
    expect(last?.kind === 'state-transition' && last.payload.to).toBe(decisionResult.outcome);
  });

  it('every assembled record validates', () => {
    const prepared = prepareFindings(findings(), ctx);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const decisionResult = decideOutcome({
      freshness: 'current',
      capacity: 'available',
      admission: 'not-required',
      findings: decisionFindings(prepared.value),
      causes: [],
      requiredStages: ['references', 'claim'],
      stageResults: [],
      requirements: [],
    });
    expect(decisionResult.kind).toBe('outcome');
    if (decisionResult.kind !== 'outcome') return;

    const result = assembleRunRecords(baseAssemblyInput(decisionResult, prepared.value));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.policyRevision.authoritative).toBe(true);
  });
});
