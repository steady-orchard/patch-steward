import { describe, expect, it } from 'vitest';

import { runRecordSchema } from '../records/run.js';
import { submissionRecordSchema } from '../records/submission.js';
import { findingRecordSchema } from '../records/finding.js';
import { decisionRecordSchema } from '../records/decision.js';
import { policyRevisionRecord } from '../policy/revision-record.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { executionRecordSchema } from '../records/execution-record.js';
import { findingTexts } from '../report/finding-templates.js';
import { executedCommandItem, provenanceLines } from '../report/templates.js';
import { buildCheckSummaryInput, buildReportInput, findingTemplateContext, paddedSubjects } from './report-input.js';
import type { ReportRecordSources } from './report-input.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';

function makeRun() {
  return runRecordSchema.parse({
    schema_version: 1,
    record_type: 'run',
    run_id: RUN_ID,
    run_attempt: 1,
    subject: {
      kind: 'submission',
      repository: 'octo/demo',
      type: 'pull_request',
      number: 12,
      snapshot_hash: 'sha256:' + '5'.repeat(64),
    },
    commits: { base: 'd'.repeat(40), head: 'c'.repeat(40), group: null },
    owned_check_id: null,
    policy_revision: 'b'.repeat(40),
    steward_version: '0.0.0-test',
    provider: 'copilot-sdk',
    requested_model: 'replace-with-model-id',
    reported_model: null,
    adapter_version: null,
    generation: null,
    runner_identity: null,
    mode: 'observe',
    started_at: '2026-09-27T10:15:00.000Z',
    finished_at: '2026-09-27T10:15:03.000Z',
    budget: {
      model_calls: 0,
      tokens: null,
      ai_credits: null,
      container_seconds: 0,
      executions: 0,
      github_requests: 7,
      retries: 0,
    },
  });
}

function makeSubmission() {
  return submissionRecordSchema.parse({
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
}

function makePolicyRevision(kind: 'git-tree' | 'local-file' = 'git-tree') {
  const revision =
    kind === 'git-tree'
      ? ({ kind: 'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' } as const)
      : ({ kind: 'local-file', id: `local:${'e'.repeat(64)}` as const, path: 'policy.yml' } as const);
  const result = policyRevisionRecord(
    { revision, policy: DEFAULT_CHECKLIST_POLICY, authoritative: kind === 'git-tree' },
    { stewardVersion: '0.0.0-test', loadedAt: '2026-09-27T10:15:00.500Z' },
  );
  if (!result.ok) {
    throw new Error('failed to build policy revision record for test');
  }
  return result.value;
}

function makeDecision() {
  return decisionRecordSchema.parse({
    schema_version: 1,
    record_type: 'decision',
    run_id: RUN_ID,
    run_attempt: 1,
    outcome: 'needs-changes',
    contributing_findings: ['finding-0001', 'finding-0002'],
    unmet_requirements: [],
    requests: [{ request_id: 'R1', text: 'Fill in the "Regression test" section.' }],
    causes: [],
  });
}

function makeFindingBlocking() {
  return findingRecordSchema.parse({
    schema_version: 1,
    record_type: 'finding',
    run_id: RUN_ID,
    run_attempt: 1,
    finding_id: 'finding-0001',
    stage: 'contract',
    severity: 'blocking',
    scenario: 's',
    location: { path: null, line: null, field: 'regression-test' },
    evidence: [],
    basis: 'b',
    dismissal_code: null,
    code: 'submission.field-missing',
    detail: null,
    subjects: [],
    request_id: 'R1',
  });
}

function makeFindingUncertain() {
  return findingRecordSchema.parse({
    schema_version: 1,
    record_type: 'finding',
    run_id: RUN_ID,
    run_attempt: 1,
    finding_id: 'finding-0002',
    stage: 'contract',
    severity: 'uncertain',
    scenario: 's',
    location: { path: null, line: null, field: null },
    evidence: [],
    basis: 'b',
    dismissal_code: null,
    code: 'submission.execution-sensitive-change',
    detail: null,
    subjects: ['package.json'],
    request_id: null,
  });
}

function baseSources(overrides: Partial<ReportRecordSources> = {}): ReportRecordSources {
  return {
    run: makeRun(),
    submission: makeSubmission(),
    policyRevision: makePolicyRevision(),
    findings: [makeFindingBlocking(), makeFindingUncertain()],
    decision: makeDecision(),
    classification: { type: 'pull_request', category: 'bugfix', consistent: true, plausible: ['bugfix'] },
    defaultBranch: 'main',
    subjectTotals: [0, 1],
    localRun: true,
    storePath: 'runs/pr-12/' + RUN_ID,
    ...overrides,
  };
}

function makeExecutionRecord(overrides: Record<string, unknown> = {}) {
  return executionRecordSchema.parse({
    schema_version: 1,
    record_type: 'execution-record',
    run_id: RUN_ID,
    run_attempt: 1,
    plan_entry: 'entry-1',
    command: ['pnpm', 'test'],
    environment: { image_digest: `sha256:${'b'.repeat(64)}`, tool_versions: [{ name: 'node', version: '24.0.0' }] },
    exit: { code: 0, signal: null, timed_out: false },
    output: { head: 'starting', tail: 'done', truncated: false, total_bytes: 100 },
    result_files: [],
    test_identity: 'unit',
    commits: { head: 'c'.repeat(40), base: 'd'.repeat(40), merge: null },
    admissibility: 'evidence',
    ...overrides,
  });
}

function junitResultFile(path: string, tests: number, passed: number) {
  return {
    path,
    content_hash: `sha256:${'c'.repeat(64)}`,
    bytes: 200,
    format: 'junit-xml' as const,
    status: 'parsed' as const,
    error_code: null,
    stored_path: 'executions/execution-0001/result-1.xml',
    stored_omitted: false,
    junit: { tests, passed, failed: tests - passed, errored: 0, skipped: 0, duration_ms: 10, cases: [], cases_truncated: true },
  };
}

const RUNNER = {
  runtime: 'docker',
  serverVersion: '29.8.2',
  reference: 'docker.io/library/busybox@0123456789ab',
  imageDigest: `sha256:${'0123456789ab'.repeat(5)}0123`,
};

describe('report-input', () => {
  it('finding template context comes from the submission record', () => {
    const submission = makeSubmission();
    const ctx = findingTemplateContext(submission, DEFAULT_CHECKLIST_POLICY, 'main');
    expect(ctx).toEqual({
      repository: submission.repository,
      defaultBranch: 'main',
      submissionType: submission.type,
      template: submission.template ?? null,
      category: submission.category,
      headCommit: submission.head_commit,
      policy: DEFAULT_CHECKLIST_POLICY,
      policyChange: submission.policy_change ?? null,
    });
  });

  it('report input carries the bound identifiers from the records', () => {
    const sources = baseSources();
    const result = buildReportInput(sources);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.header).toEqual({
      outcome: sources.decision.outcome,
      causes: (sources.decision.causes ?? []).map((c) => c.cause),
      repository: sources.submission.repository,
      submissionType: sources.submission.type,
      number: sources.submission.number,
      snapshotHash: sources.submission.snapshot_hash,
      targetBranch: sources.submission.target_branch,
      headCommit: sources.run.commits.head,
      baseCommit: sources.run.commits.base,
      policyRevision: sources.run.policy_revision,
      runId: sources.run.run_id,
      runAttempt: sources.run.run_attempt,
    });
  });

  it('report input renders finding texts from the records', () => {
    const sources = baseSources();
    const result = buildReportInput(sources);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const ctx = findingTemplateContext(sources.submission, sources.policyRevision.policy, sources.defaultBranch);

    const item1 = result.value.findings[0];
    expect(item1).toBeDefined();
    const expectedTexts1 = findingTexts(
      { code: 'submission.field-missing', detail: null, field: 'regression-test', subjects: [] },
      ctx,
    );
    expect(expectedTexts1.ok).toBe(true);
    if (expectedTexts1.ok) {
      expect(item1?.texts).toEqual(expectedTexts1.value);
      expect(item1?.texts.kind).toBe('blocker');
      if (item1?.texts.kind === 'blocker') {
        expect(item1.texts.request).toBe('Fill in the "Regression test" section.');
      }
    }
    expect(item1?.evidencePath).toBe('findings/finding-0001.json');
    expect(item1?.requestId).toBe('R1');

    const item2 = result.value.findings[1];
    expect(item2?.texts.kind).toBe('uncertainty');

    const failing = buildReportInput(baseSources({ findings: [{ ...makeFindingBlocking(), code: 'stage.unknown' }] }));
    expect(failing.ok).toBe(false);
    if (!failing.ok) {
      expect(failing.failure.code).toBe('report.template-missing');
    }
  });

  it('subject counts in the report use the full subject total', () => {
    const stored = new Array<string>(1000).fill('subject');
    const finding = { ...makeFindingUncertain(), code: 'submission.execution-sensitive-change' as const, subjects: stored };
    const sources = baseSources({ findings: [finding], subjectTotals: [1500] });
    const result = buildReportInput(sources);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const item = result.value.findings[0];
    expect(item?.texts.kind).toBe('uncertainty');
    if (item?.texts.kind === 'uncertainty') {
      expect(item.texts.location).toContain('and 1490 more');
    }
    expect(paddedSubjects(['a'], 3)).toEqual(['a', '', '']);
    expect(paddedSubjects(['a', 'b'], 1)).toEqual(['a', 'b']);
  });

  it('provenance follows the policy revision kind', () => {
    const gitTreeSources = baseSources();
    const gitTreeResult = buildReportInput(gitTreeSources);
    expect(gitTreeResult.ok).toBe(true);
    if (gitTreeResult.ok) {
      expect(gitTreeResult.value.provenance).toEqual({
        source: 'trusted-branch',
        policyRevision: 'b'.repeat(40),
        ref: 'main',
        commit: 'a'.repeat(40),
        stewardVersion: gitTreeSources.run.steward_version,
      });
    }
    const gitTreeSummary = buildCheckSummaryInput(gitTreeSources);
    expect(gitTreeSummary.policySource).toBe('trusted-branch');

    const localSources = baseSources({ policyRevision: makePolicyRevision('local-file') });
    const localResult = buildReportInput(localSources);
    expect(localResult.ok).toBe(true);
    if (localResult.ok) {
      expect(localResult.value.provenance).toEqual({
        source: 'local-file',
        policyRevision: localSources.policyRevision.revision.id,
        stewardVersion: localSources.run.steward_version,
      });
    }
    const localSummary = buildCheckSummaryInput(localSources);
    expect(localSummary.policySource).toBe('local-file');
  });

  it('check summary input counts blockers and uncertainties', () => {
    const sources = baseSources();
    const summary = buildCheckSummaryInput(sources);
    expect(summary.blockers).toBe(1);
    expect(summary.uncertainties).toBe(1);
    expect(summary.evidenceLocation).toBe(sources.storePath);
  });

  it('shared head pull requests come from the shared-head finding', () => {
    const sharedHeadFinding = findingRecordSchema.parse({
      schema_version: 1,
      record_type: 'finding',
      run_id: RUN_ID,
      run_attempt: 1,
      finding_id: 'finding-0003',
      stage: 'contract',
      severity: 'blocking',
      scenario: 's',
      location: { path: null, line: null, field: null },
      evidence: [],
      basis: 'b',
      dismissal_code: null,
      code: 'submission.shared-head',
      detail: null,
      subjects: ['13', '14'],
      request_id: null,
    });
    const withShared = baseSources({ findings: [makeFindingBlocking(), sharedHeadFinding], subjectTotals: [0, 2] });
    const summaryWith = buildCheckSummaryInput(withShared);
    expect(summaryWith.sharedHeadPullRequests).toEqual(['13', '14']);

    const withoutShared = baseSources();
    const summaryWithout = buildCheckSummaryInput(withoutShared);
    expect(summaryWithout.sharedHeadPullRequests).toEqual([]);
  });

  it('lists executed commands from execution records', () => {
    const withJunit = makeExecutionRecord({
      plan_entry: 'entry-1',
      exit: { code: 1, signal: null, timed_out: true, oom_killed: true, output_limited: true },
      timing: { started_at: '2026-09-27T10:15:00.000Z', finished_at: '2026-09-27T10:15:02.500Z', duration_ms: 2500 },
      result_files: [junitResultFile('a.xml', 5, 4), junitResultFile('b.xml', 3, 3)],
    });
    const without = makeExecutionRecord({ plan_entry: 'entry-2', exit: { code: null, signal: 'SIGKILL', timed_out: false } });
    const result = buildReportInput(baseSources({ executions: { records: [withJunit, without], runner: null } }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.executedCommands).toEqual([
      executedCommandItem({
        entryId: 'entry-1',
        commit: 'c'.repeat(40),
        exitCode: 1,
        signal: null,
        timedOut: true,
        oomKilled: true,
        outputLimited: true,
        durationMs: 2500,
        junit: { passed: 7, tests: 8 },
      }),
      executedCommandItem({
        entryId: 'entry-2',
        commit: 'c'.repeat(40),
        exitCode: null,
        signal: 'SIGKILL',
        timedOut: false,
        oomKilled: false,
        outputLimited: false,
        durationMs: 0,
        junit: null,
      }),
    ]);
  });

  it('renders the runner provenance line', () => {
    const result = buildReportInput(baseSources({ executions: { records: [makeExecutionRecord()], runner: RUNNER } }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.provenance).toMatchObject({ runner: RUNNER });
    const lines = provenanceLines(result.value.provenance);
    expect(lines.some((line) => line.startsWith('- Runner: ') && line.includes('docker') && line.includes('29.8.2'))).toBe(true);
    expect(lines).not.toContain('- Runner: no execution in this run');
  });

  it('keeps the report input unchanged without executions', () => {
    const result = buildReportInput(baseSources());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.executedCommands).toEqual([]);
    expect(result.value.provenance).not.toHaveProperty('runner');
    expect(provenanceLines(result.value.provenance)).toContain('- Runner: no execution in this run');
  });
});
