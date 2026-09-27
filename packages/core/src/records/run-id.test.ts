import { describe, expect, it } from 'vitest';

import { recordRunIdSchema } from './common.js';
import { decisionRecordSchema } from './decision.js';
import { executionRecordSchema } from './execution-record.js';
import { findingRecordSchema } from './finding.js';
import { maintainerActionRecordSchema } from './maintainer-action.js';
import { metricsEventRecordSchema } from './metrics-event.js';
import { reportRecordSchema } from './report.js';
import { runRecordSchema } from './run.js';

const validRun = {
  schema_version: 1,
  record_type: 'run',
  run_id: 100,
  run_attempt: 1,
  subject: {
    kind: 'submission',
    repository: 'octo/widgets',
    type: 'pull_request',
    number: 42,
    snapshot_hash: `sha256:${'b'.repeat(64)}`,
  },
  commits: {
    base: 'a'.repeat(40),
    head: 'a'.repeat(40),
    group: null,
  },
  owned_check_id: 7,
  policy_revision: 'a'.repeat(40),
  steward_version: '1.0.0',
  provider: 'copilot-sdk',
  requested_model: 'gpt-5',
  reported_model: 'gpt-5',
  adapter_version: '1.0.0',
  generation: { temperature: 0.2 },
  runner_identity: 'runner-1',
  mode: 'enforce',
  started_at: '2026-09-26T12:00:00Z',
  finished_at: null,
  budget: {
    model_calls: 1,
    tokens: 100,
    ai_credits: 0.5,
    container_seconds: 10,
    executions: 1,
    github_requests: 1,
    retries: 0,
  },
} as const;

const validFinding = {
  schema_version: 1,
  record_type: 'finding',
  run_id: 100,
  run_attempt: 1,
  finding_id: 'finding-1',
  stage: 'fix-verification',
  severity: 'blocking',
  scenario: 'test fails on main path',
  location: {
    path: 'src/index.ts',
    line: 10,
    field: 'reproduction-command',
  },
  evidence: ['execution-1'],
  basis: 'reproduction failed',
  dismissal_code: null,
} as const;

const validDecision = {
  schema_version: 1,
  record_type: 'decision',
  run_id: 100,
  run_attempt: 1,
  outcome: 'needs-changes',
  contributing_findings: ['finding-1'],
  unmet_requirements: ['regression test missing'],
  requests: [{ request_id: 'request-1', text: 'please add a regression test' }],
} as const;

const validReport = {
  schema_version: 1,
  record_type: 'report',
  run_id: 100,
  run_attempt: 1,
  rendered: '## Screening report',
  check_summary: 'needs changes',
  bound: {
    policy_revision: 'a'.repeat(40),
    snapshot_hash: `sha256:${'b'.repeat(64)}`,
    head_commit: 'a'.repeat(40),
    base_commit: 'a'.repeat(40),
  },
} as const;

const validExecutionRecord = {
  schema_version: 1,
  record_type: 'execution-record',
  run_id: 100,
  run_attempt: 1,
  plan_entry: 'entry-1',
  command: ['pnpm', 'test'],
  environment: {
    image_digest: `sha256:${'b'.repeat(64)}`,
    tool_versions: [{ name: 'node', version: '24.0.0' }],
  },
  exit: {
    code: 0,
    signal: null,
    timed_out: false,
  },
  output: {
    head: 'starting',
    tail: 'done',
    truncated: false,
    total_bytes: 100,
  },
  result_files: [{ path: 'coverage/lcov.info', content_hash: `sha256:${'b'.repeat(64)}`, bytes: 10 }],
  test_identity: 'unit',
  commits: {
    head: 'a'.repeat(40),
    base: 'a'.repeat(40),
    merge: null,
  },
  admissibility: 'evidence',
} as const;

const validMaintainerAction = {
  schema_version: 1,
  record_type: 'maintainer-action',
  run_id: 100,
  run_attempt: 1,
  actor: 'octocat',
  kind: 'override',
  reason: 'manual approval after manual review',
  recorded_at: '2026-09-26T12:00:00Z',
  resolution_code: null,
  scope: {
    scope_type: 'pull-request-head',
    repository: 'octo/widgets',
    number: 42,
    head_commit: 'a'.repeat(40),
    target_branch: 'main',
    requirements: ['tests-pass'],
  },
} as const;

const validMetricsEvent = {
  schema_version: 1,
  record_type: 'metrics-event',
  subject: { kind: 'run', run_id: 100, run_attempt: 1 },
  recorded_at: '2026-09-26T12:00:00Z',
  kind: 'state-transition',
  payload: { from: 'queued', to: 'screening' },
} as const;

const RECORDS: Record<
  string,
  {
    schema: { safeParse: (value: unknown) => { success: boolean } };
    valid: Record<string, unknown>;
    withRunId: (value: Record<string, unknown>, runId: unknown) => Record<string, unknown>;
  }
> = {
  run: {
    schema: runRecordSchema,
    valid: validRun,
    withRunId: (value, runId) => ({ ...value, run_id: runId }),
  },
  finding: {
    schema: findingRecordSchema,
    valid: validFinding,
    withRunId: (value, runId) => ({ ...value, run_id: runId }),
  },
  decision: {
    schema: decisionRecordSchema,
    valid: validDecision,
    withRunId: (value, runId) => ({ ...value, run_id: runId }),
  },
  report: {
    schema: reportRecordSchema,
    valid: validReport,
    withRunId: (value, runId) => ({ ...value, run_id: runId }),
  },
  'execution-record': {
    schema: executionRecordSchema,
    valid: validExecutionRecord,
    withRunId: (value, runId) => ({ ...value, run_id: runId }),
  },
  'maintainer-action': {
    schema: maintainerActionRecordSchema,
    valid: validMaintainerAction,
    withRunId: (value, runId) => ({ ...value, run_id: runId }),
  },
  'metrics-event': {
    schema: metricsEventRecordSchema,
    valid: validMetricsEvent,
    withRunId: (value, runId) => ({
      ...value,
      subject: { ...(value.subject as Record<string, unknown>), run_id: runId },
    }),
  },
};

const RECORD_NAMES = ['run', 'finding', 'decision', 'report', 'execution-record', 'maintainer-action', 'metrics-event'];

describe('record run id', () => {
  it.each(RECORD_NAMES)('record %s accepts a local run id', (name) => {
    const entry = RECORDS[name];
    if (entry === undefined) {
      throw new Error(`unknown record ${name}`);
    }
    const withLocalRunId = entry.withRunId(entry.valid, 'local-20260927T101500Z-3f9a1c2e');
    expect(entry.schema.safeParse(withLocalRunId).success).toBe(true);
  });

  it.each(RECORD_NAMES)('record %s rejects a malformed run id', (name) => {
    const entry = RECORDS[name];
    if (entry === undefined) {
      throw new Error(`unknown record ${name}`);
    }
    const malformedRunIds = [
      'local-20260927T101500Z-3F9A1C2E',
      'local-2026092T101500Z-3f9a1c2e',
      'local-20260927T101500Z-3f9a1c2',
      '12',
      0,
      -1,
      1.5,
    ];
    for (const runId of malformedRunIds) {
      const withBadRunId = entry.withRunId(entry.valid, runId);
      expect(entry.schema.safeParse(withBadRunId).success).toBe(false);
    }
  });

  it('record run id accepts positive integers and local run ids', () => {
    expect(recordRunIdSchema.safeParse(1).success).toBe(true);
    expect(recordRunIdSchema.safeParse(2147483648).success).toBe(true);
    expect(recordRunIdSchema.safeParse('local-20260927T101500Z-3f9a1c2e').success).toBe(true);
  });
});
