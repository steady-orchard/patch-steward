import { describe, expect, it } from 'vitest';

import { EXECUTION_FAILURE_CODES } from './results.js';
import { validateExecutionPlan, validateExecutionResults } from './transport.js';
import type { ExecutionPlanTransport, ExecutionTransportBinding } from './transport.js';

const binding: ExecutionTransportBinding = {
  run_id: 'local-20260928T101500Z-3f9a1c2e',
  run_attempt: 1,
  snapshot_hash: 'sha256:' + '5'.repeat(64),
  policy_revision: 'b'.repeat(40),
};

const HEAD = 'a'.repeat(40);

const planEntries = [
  {
    id: 'head-dependency-step',
    kind: 'dependency-step',
    command_id: null,
    run: ['pnpm', 'install'],
    working_directory: '.',
    commit_role: 'head',
    commit: HEAD,
    overlay: 'none',
    expected: 'exit-zero',
    network: 'egress',
    result_files: [],
  },
  {
    id: 'head-test',
    kind: 'command',
    command_id: 'test',
    run: ['pnpm', 'test'],
    working_directory: '.',
    commit_role: 'head',
    commit: HEAD,
    overlay: 'none',
    expected: 'exit-zero',
    network: 'none',
    result_files: [
      { path: 'a.xml', format: 'junit-xml' },
      { path: 'b.xml', format: 'junit-xml' },
      { path: 'c.xml', format: 'junit-xml' },
    ],
  },
];

function planRecord(): Record<string, unknown> {
  return {
    transport: 'execution-plan',
    transport_version: 1,
    run: { run_id: binding.run_id, run_attempt: binding.run_attempt },
    snapshot_hash: binding.snapshot_hash,
    policy_revision: binding.policy_revision,
    entries: structuredClone(planEntries),
    over_budget: false,
  };
}

const plan = validateExecutionPlan(planRecord(), binding);
if (!plan.ok) {
  throw new Error('plan fixture invalid');
}
const boundPlan: ExecutionPlanTransport = plan.value;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function completed(): Record<string, any> {
  return {
    kind: 'completed',
    entry_id: 'head-test',
    record: {
      schema_version: 1,
      record_type: 'execution-record',
      run_id: binding.run_id,
      run_attempt: 1,
      plan_entry: 'head-test',
      command: ['pnpm', 'test'],
      runner: 'container',
      environment: { image_digest: null, tool_versions: [] },
      exit: { code: 0, signal: null, timed_out: false },
      output: { head: 'h', tail: 't', truncated: false, total_bytes: 2, stored_path: null },
      result_files: [
        {
          path: 'a.xml',
          content_hash: 'sha256:' + '1'.repeat(64),
          bytes: 13,
          status: 'parsed',
          error_code: null,
          junit: { tests: 0, passed: 0, failed: 0, errored: 0, skipped: 0, duration_ms: null, cases: [], cases_truncated: false },
        },
        {
          path: 'b.xml',
          content_hash: 'sha256:' + '2'.repeat(64),
          bytes: 8388609,
          status: 'malformed',
          error_code: 'xml-invalid',
          junit: null,
          stored_path: null,
          stored_omitted: true,
          stored_omitted_reason: 'redaction-input',
        },
        {
          path: 'c.xml',
          content_hash: null,
          bytes: 0,
          status: 'missing',
          error_code: null,
          junit: null,
          stored_path: null,
          stored_omitted: false,
        },
      ],
      test_identity: null,
      commits: { head: HEAD, base: null, merge: null },
      admissibility: 'evidence',
    },
    output: { parts: ['ht'], omitted_bytes: 0, trimmed_bytes: 0 },
    result_texts: [
      { position: 1, decoded_bytes: 13, text: '<testsuites/>' },
      { position: 2, decoded_bytes: 8388609, text: null },
    ],
  };
}

function failure(): Record<string, unknown> {
  return { kind: 'environment-failure', entry_id: 'head-dependency-step', code: 'runner.start-failed', subject: null };
}

function resultsRecord(results: unknown[]): Record<string, unknown> {
  return {
    transport: 'execution-results',
    transport_version: 1,
    run: { run_id: binding.run_id, run_attempt: binding.run_attempt },
    snapshot_hash: binding.snapshot_hash,
    policy_revision: binding.policy_revision,
    results,
    causes: [],
  };
}

function expectRejected(
  result: { readonly ok: boolean; readonly failure?: { code: string; cause: string; outcome: string } },
  code: 'pipeline.transport-invalid' | 'pipeline.transport-binding' = 'pipeline.transport-invalid',
): void {
  expect(result.ok).toBe(false);
  expect(result.failure?.code).toBe(code);
  expect(result.failure?.cause).toBe('steward-defect');
  expect(result.failure?.outcome).toBe('inconclusive');
}

const check = (results: unknown[]) => validateExecutionResults(resultsRecord(results), { binding, plan: boundPlan });

describe('execution plan transport', () => {
  it('accepts a bound execution plan', () => {
    expect(validateExecutionPlan(planRecord(), binding).ok).toBe(true);
  });

  it('rejects a plan bound to another run', () => {
    const changes: Record<string, unknown>[] = [
      { run: { run_id: 'local-20260928T101500Z-00000000', run_attempt: 1 } },
      { run: { run_id: binding.run_id, run_attempt: 2 } },
      { snapshot_hash: 'sha256:' + '6'.repeat(64) },
      { policy_revision: 'c'.repeat(40) },
    ];
    for (const change of changes) {
      expectRejected(validateExecutionPlan({ ...planRecord(), ...change }, binding), 'pipeline.transport-binding');
    }
  });

  it('rejects duplicate plan entry ids', () => {
    const record = planRecord();
    record.entries = [planEntries[0], planEntries[0]];
    expectRejected(validateExecutionPlan(record, binding));
  });

  it('rejects a malformed plan', () => {
    expectRejected(validateExecutionPlan(null, binding));
    expectRejected(validateExecutionPlan({ ...planRecord(), extra: 1 }, binding));
  });
});

describe('execution results transport', () => {
  it('accepts bound execution results', () => {
    expect(check([failure(), completed()]).ok).toBe(true);
  });

  it('rejects results bound to another run', () => {
    const record = { ...resultsRecord([failure()]), run: { run_id: binding.run_id, run_attempt: 2 } };
    expectRejected(validateExecutionResults(record, { binding, plan: boundPlan }), 'pipeline.transport-binding');
  });

  it('rejects results for an unknown entry', () => {
    expectRejected(check([{ ...failure(), entry_id: 'head-other' }]));
  });

  it('rejects results out of plan order', () => {
    expectRejected(check([completed(), failure()]));
    expectRejected(check([failure(), failure()]));
  });

  it('rejects a record that names another entry', () => {
    const entry = completed();
    entry.record.plan_entry = 'head-dependency-step';
    expectRejected(check([entry]));
  });

  it('rejects a record from another run', () => {
    const entry = completed();
    entry.record.run_attempt = 2;
    expectRejected(check([entry]));
  });

  it('rejects a record that differs from its plan entry', () => {
    const head = completed();
    head.record.commits.head = 'd'.repeat(40);
    expectRejected(check([head]));
    const command = completed();
    command.record.command = ['pnpm', 'lint'];
    expectRejected(check([command]));
  });

  it('rejects a transport record with a stored output path', () => {
    const stored = completed();
    stored.record.output.stored_path = 'executions/execution-0001/output.txt';
    expectRejected(check([stored]));
    const absent = completed();
    delete absent.record.output.stored_path;
    expectRejected(check([absent]));
  });

  it('rejects an output part over the cap', () => {
    const entry = completed();
    entry.output.parts = ['a'.repeat(8388609)];
    expectRejected(check([entry]));
  });

  it('rejects inconsistent output part counts', () => {
    const one = completed();
    one.output.omitted_bytes = 5;
    expectRejected(check([one]));
    const two = completed();
    two.output.parts = ['a', 'b'];
    expectRejected(check([two]));
  });

  it('ties result text to decoded bytes', () => {
    const nullText = completed();
    nullText.result_texts[1].decoded_bytes = 8388608;
    expectRejected(check([nullText]));
    const mismatch = completed();
    mismatch.result_texts[0] = { position: 1, decoded_bytes: 4, text: 'abc' };
    expectRejected(check([mismatch]));
  });

  it('requires the omission flag for omitted text', () => {
    const entry = completed();
    delete entry.record.result_files[1].stored_omitted;
    delete entry.record.result_files[1].stored_omitted_reason;
    expectRejected(check([entry]));
  });

  it('requires text for every parsed or malformed file', () => {
    const missing = completed();
    missing.result_texts = [missing.result_texts[1]];
    expectRejected(check([missing]));
    const extra = completed();
    extra.result_texts.push({ position: 3, decoded_bytes: 0, text: '' });
    expectRejected(check([extra]));
  });

  it('accepts an environment failure entry', () => {
    for (const code of EXECUTION_FAILURE_CODES) {
      expect(check([{ ...failure(), code }]).ok).toBe(true);
    }
    expectRejected(check([{ ...failure(), code: 'runner.unknown' }]));
  });
});
