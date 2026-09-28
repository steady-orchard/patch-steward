import { describe, expect, it } from 'vitest';

import { prepareHostedRunEvidence } from './hosted-evidence.js';
import { gateContextRecordSchema } from './gate-context.js';
import type { GateContextRecord } from './gate-context.js';
import { handoffRecordSchema } from './handoff.js';
import type { HandoffRecord } from './handoff.js';
import { initialBudget } from './budget.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { REPORT_LOCAL_RUN_NOTICE } from '../report/templates.js';
import type { CapState } from '../vocabulary.js';

const loadedPolicy: LoadedPolicy = {
  revision: { kind: 'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' },
  policy: DEFAULT_CHECKLIST_POLICY,
  authoritative: true,
};

const submission: SubmissionRecord = submissionRecordSchema.parse({
  schema_version: 1,
  record_type: 'submission',
  repository: 'octo/demo',
  type: 'issue',
  number: 29,
  snapshot_hash: 'sha256:' + '5'.repeat(64),
  target_branch: null,
  head_commit: null,
  issue_kind: 'defect',
  category: null,
  fields: { 'expected-behavior': 'x' },
  linked_evidence_hashes: [],
  author_responses: [],
  shared_head_pull_requests: [],
  contract_results: [],
  trusted_paths_changed: null,
  execution_sensitive_paths_changed: null,
  template: { form: 'defect', version: 1 },
  attachments: [],
});

function makeContext(disposition: 'runnable' | 'early-exit' | 'queued', cap: GateContextRecord['cap'] = null): GateContextRecord {
  return gateContextRecordSchema.parse({
    schema_version: 1,
    record_type: 'gate-context',
    run: { run_id: 36081628326, run_attempt: 1 },
    repository: { full_name: 'octo/demo', id: 700001, default_branch: 'main' },
    subject: { type: 'issue', number: 29 },
    disposition,
    snapshot_hash: submission.snapshot_hash,
    policy: { revision: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main', loaded_at: '2026-09-28T10:00:01.000Z' },
    store: { type: 'orphan-branch', repository: 'octo/demo', branch: 'steward-evidence' },
    submission,
    base_commit: null,
    mode: 'observe',
    classification: { type: 'issue', issue_kind: 'defect' },
    required_stages: ['references', 'claim', 'reproduction'],
    cap,
    github_requests: 12,
    started_at: '2026-09-28T10:00:00.000Z',
    completed_at: '2026-09-28T10:00:04.000Z',
    log_lines: [`disposition ${disposition}`],
  });
}

function makeHandoff(earlyExit: 'contract-needs-changes' | null, findings: HandoffRecord['findings'] = []): HandoffRecord {
  return handoffRecordSchema.parse({
    handoff_version: 1,
    phase: 'gate',
    run: { run_id: 36081628326, run_attempt: 1 },
    snapshot_hash: submission.snapshot_hash,
    policy_revision: 'b'.repeat(40),
    round: 0,
    budget_remaining: initialBudget(DEFAULT_CHECKLIST_POLICY, { githubRequests: 12 }),
    early_exit: earlyExit,
    findings,
    causes: [],
    stage_results: [],
    next_round_plan: null,
  });
}

const store = { repository: { owner: 'octo', name: 'demo' }, branch: 'steward-evidence' };
const arrivalAt = '2026-09-28T10:00:05Z';
const publishStartedAt = '2026-09-28T10:00:10.000Z';
const finishedAt = '2026-09-28T10:00:20.000Z';

function baseInput(context: GateContextRecord, handoff: HandoffRecord) {
  return {
    context,
    handoff,
    loadedPolicy,
    stewardVersion: '0.0.0-test',
    store,
    arrivalAt,
    publishStartedAt,
    finishedAt,
    publishRequests: 8,
    retries: 0,
    logLines: ['publish line'],
    credentials: [],
  };
}

describe('hosted run evidence', () => {
  it('a runnable run ends inconclusive with incomplete stages', async () => {
    const context = makeContext('runnable', {
      state: 'within',
      daily_count: 1,
      daily_limit: 50,
      author_count: 1,
      author_limit: 2,
    });
    const handoff = makeHandoff(null, []);
    const result = await prepareHostedRunEvidence(baseInput(context, handoff));
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'outcome') {
      throw new Error('expected an outcome result');
    }
    expect(result.value.outcome).toBe('inconclusive');

    const runGroup = result.value.groups[0]!;
    expect(runGroup.directory).toBe('runs/issue-29/36081628326-1');
    expect(runGroup.mode).toBe('exact');
    const filePaths = runGroup.files.map((f) => f.path);
    expect(filePaths).toEqual(
      expect.arrayContaining([
        'decision.json',
        'report.json',
        'report.md',
        'run.json',
        'submission.json',
        'policy-revision.json',
        'logs/steward.txt',
      ]),
    );
    expect(filePaths).toContain('manifest.json');

    const metricsGroup = result.value.groups[1]!;
    expect(metricsGroup.directory).toBe('metrics/2026-09');
    expect(metricsGroup.files.map((f) => f.path)).toEqual(['36081628326-1.json']);

    const decisionFile = runGroup.files.find((f) => f.path === 'decision.json')!;
    const decisionText = Buffer.from(decisionFile.bytes).toString('utf8');
    expect(decisionText).toContain('stage-incomplete');
  });

  it('an early exit publishes the contract outcome', async () => {
    const context = makeContext('early-exit', null);
    const findings: HandoffRecord['findings'] = [
      {
        stage: 'contract',
        severity: 'blocking',
        code: 'submission.field-missing',
        detail: null,
        field: 'regression-test',
        subjects: [],
        message: 'placeholder',
      },
    ];
    const handoff = makeHandoff('contract-needs-changes', findings);
    const result = await prepareHostedRunEvidence(baseInput(context, handoff));
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'outcome') {
      throw new Error('expected an outcome result');
    }
    expect(result.value.outcome).toBe('needs-changes');
  });

  it('a queued run prepares a waiting run directory', async () => {
    const cap: { state: CapState; daily_count: number; daily_limit: number; author_count: number; author_limit: number } = {
      state: 'daily-runs',
      daily_count: 51,
      daily_limit: 50,
      author_count: 1,
      author_limit: 2,
    };
    const context = makeContext('queued', cap);
    const handoff = makeHandoff(null, []);
    const result = await prepareHostedRunEvidence(baseInput(context, handoff));
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'waiting') {
      throw new Error('expected a waiting result');
    }
    const runGroup = result.value.groups[0]!;
    const waitingFile = runGroup.files.find((f) => f.path === 'waiting.json');
    expect(waitingFile).toBeDefined();
    const waitingText = Buffer.from(waitingFile!.bytes).toString('utf8');
    expect(waitingText).toContain('"arrival_at": "2026-09-28T10:00:05Z"');
    expect(runGroup.files.map((f) => f.path)).not.toContain('decision.json');
  });

  it('the report points at the hosted evidence location', async () => {
    const context = makeContext('early-exit', null);
    const findings: HandoffRecord['findings'] = [
      {
        stage: 'contract',
        severity: 'blocking',
        code: 'submission.field-missing',
        detail: null,
        field: 'regression-test',
        subjects: [],
        message: 'placeholder',
      },
    ];
    const handoff = makeHandoff('contract-needs-changes', findings);
    const result = await prepareHostedRunEvidence(baseInput(context, handoff));
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'outcome') {
      throw new Error('expected an outcome result');
    }
    const expectedUrl = 'https://github.com/octo/demo/tree/steward-evidence/octo/demo/runs/issue-29/36081628326-1';
    expect(result.value.location).toBe(expectedUrl);
    const reportFile = result.value.groups[0]!.files.find((f) => f.path === 'report.md')!;
    const reportText = Buffer.from(reportFile.bytes).toString('utf8');
    expect(reportText).toContain(expectedUrl);
    expect(reportText).not.toContain(REPORT_LOCAL_RUN_NOTICE);
  });

  it('gate and publish latencies are recorded', async () => {
    const context = makeContext('runnable', {
      state: 'within',
      daily_count: 1,
      daily_limit: 50,
      author_count: 1,
      author_limit: 2,
    });
    const handoff = makeHandoff(null, []);
    const result = await prepareHostedRunEvidence(baseInput(context, handoff));
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'outcome') {
      throw new Error('expected an outcome result');
    }
    const metricsFile = result.value.groups[1]!.files[0]!;
    const events: readonly { readonly kind: string; readonly payload: unknown }[] = JSON.parse(
      Buffer.from(metricsFile.bytes).toString('utf8'),
    );
    const latencies = events
      .filter((event) => event.kind === 'latency')
      .map((event) => ({ kind: event.kind, payload: event.payload }));
    expect(latencies).toEqual(
      expect.arrayContaining([
        { kind: 'latency', payload: { stage: 'gate', seconds: 4 } },
        { kind: 'latency', payload: { stage: 'publish', seconds: 10 } },
      ]),
    );
  });

  it('gate log lines precede publish log lines', async () => {
    const context = makeContext('runnable', {
      state: 'within',
      daily_count: 1,
      daily_limit: 50,
      author_count: 1,
      author_limit: 2,
    });
    const handoff = makeHandoff(null, []);
    const result = await prepareHostedRunEvidence(baseInput(context, handoff));
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'outcome') {
      throw new Error('expected an outcome result');
    }
    const logFile = result.value.groups[0]!.files.find((f) => f.path === 'logs/steward.txt')!;
    const logText = Buffer.from(logFile.bytes).toString('utf8');
    expect(logText.indexOf('disposition runnable')).toBeLessThan(logText.indexOf('publish line'));
  });

  it('run records carry the gate attempt and request count', async () => {
    const context = makeContext('runnable', {
      state: 'within',
      daily_count: 1,
      daily_limit: 50,
      author_count: 1,
      author_limit: 2,
    });
    const handoff = makeHandoff(null, []);
    const result = await prepareHostedRunEvidence(baseInput(context, handoff));
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'outcome') {
      throw new Error('expected an outcome result');
    }
    const runFile = result.value.groups[0]!.files.find((f) => f.path === 'run.json')!;
    const run: { run_attempt: number; budget: { github_requests: number } } = JSON.parse(
      Buffer.from(runFile.bytes).toString('utf8'),
    );
    expect(run.run_attempt).toBe(1);
    expect(run.budget.github_requests).toBe(20);
  });
});
