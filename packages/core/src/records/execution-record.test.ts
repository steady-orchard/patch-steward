import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';

import { executionRecordSchema, executionResultFileSchema, junitSummarySchema } from './execution-record.js';

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

const parsedResultFile = {
  path: 'test-results/junit.xml',
  content_hash: `sha256:${'c'.repeat(64)}`,
  bytes: 200,
  format: 'junit-xml' as const,
  status: 'parsed' as const,
  error_code: null,
  stored_path: 'executions/execution-0001/result-1.xml',
  stored_omitted: false,
  junit: {
    tests: 2,
    passed: 1,
    failed: 1,
    errored: 0,
    skipped: 0,
    duration_ms: 10,
    cases: [
      { identity: 'case-a', status: 'pass' as const, duration_ms: 5, identity_truncated: false },
      { identity: 'case-b', status: 'fail' as const, duration_ms: 5, identity_truncated: false },
    ],
    cases_truncated: false,
  },
};

const missingResultFile = {
  path: 'missing-file.xml',
  content_hash: null,
  bytes: 0,
  status: 'missing' as const,
  error_code: null,
  stored_omitted: false,
  stored_path: null,
  junit: null,
};

const malformedOmittedResultFile = {
  path: 'bad-file.xml',
  content_hash: `sha256:${'d'.repeat(64)}`,
  bytes: 40,
  status: 'malformed' as const,
  error_code: 'junit.syntax',
  stored_omitted: true,
  stored_omitted_reason: 'redaction-input' as const,
  stored_path: null,
  junit: null,
};

const fullRecord = {
  ...validExecutionRecord,
  kind: 'command' as const,
  runner: 'container' as const,
  working_directory: '/work/checkout',
  expected: 'exit-zero' as const,
  admissibility: 'evidence' as const,
  limits: {
    execution_seconds: 1800,
    output_head_bytes: 65536,
    output_tail_bytes: 65536,
    output_stream_bytes: 1048576,
    cpus: 2,
    memory_mb: 4096,
    pids: 512,
    scratch_mb: 1024,
  },
  timing: {
    started_at: '2026-09-26T12:00:00Z',
    finished_at: '2026-09-26T12:05:00Z',
    duration_ms: 300000,
  },
  checkout: {
    commit: 'a'.repeat(40),
    tree: 'b'.repeat(40),
    archive_sha256: `sha256:${'e'.repeat(64)}`,
    files: 10,
    bytes: 1000,
    overlays: [{ path: '.github/patch-steward', blob: 'c'.repeat(40) }],
    skipped_submodules: ['vendor/thirdparty'],
  },
  environment: {
    image_digest: `sha256:${'b'.repeat(64)}`,
    tool_versions: [{ name: 'node', version: '24.0.0' }],
    runtime: {
      name: 'docker' as const,
      client_version: '29.8.0',
      server_version: '29.8.0',
      os: 'linux',
      arch: 'amd64',
    },
    image: {
      source: 'registry' as const,
      reference: 'docker.io/library/node:24',
      digest: `sha256:${'f'.repeat(64)}`,
      id: `sha256:${'a'.repeat(64)}`,
      runner_tree_id: 'd'.repeat(40),
      cached: true,
    },
    platform: 'linux/amd64',
    network: 'none' as const,
  },
  exit: {
    code: 0,
    signal: null,
    timed_out: false,
    oom_killed: false,
    output_limited: false,
  },
  output: {
    head: 'starting',
    tail: 'done',
    truncated: false,
    total_bytes: 100,
    stored_path: 'executions/execution-0001/output.txt',
  },
  result_files: [parsedResultFile, missingResultFile, malformedOmittedResultFile],
};

describe('record execution-record', () => {
  it('record execution-record accepts a fixture instance', () => {
    const parsed = executionRecordSchema.parse(validExecutionRecord);
    expect(parsed.run_id).toBe(100);
    expect(canonicalJsonHash(parsed).ok).toBe(true);
  });

  it('record execution-record rejects an unknown key', () => {
    const withExtra = { ...validExecutionRecord, extra: 'nope' };
    expect(executionRecordSchema.safeParse(withExtra).success).toBe(false);
  });

  it('record execution-record rejects a wrong schema_version', () => {
    const wrongVersion = { ...validExecutionRecord, schema_version: 2 };
    expect(executionRecordSchema.safeParse(wrongVersion).success).toBe(false);
  });

  it('record execution-record rejects an empty command', () => {
    const emptyCommand = { ...validExecutionRecord, command: [] };
    expect(executionRecordSchema.safeParse(emptyCommand).success).toBe(false);
  });

  it('a legacy execution record still validates', () => {
    expect(executionRecordSchema.safeParse(validExecutionRecord).success).toBe(true);
  });

  it('a record with every new key validates', () => {
    expect(executionRecordSchema.safeParse(fullRecord).success).toBe(true);
  });

  it('claim admissibility is accepted', () => {
    const withClaim = { ...validExecutionRecord, admissibility: 'claim' };
    expect(executionRecordSchema.safeParse(withClaim).success).toBe(true);
  });

  it('the runner kind fixes the admissibility', () => {
    expect(executionRecordSchema.safeParse({ ...validExecutionRecord, runner: 'container', admissibility: 'claim' }).success).toBe(
      false,
    );
    expect(
      executionRecordSchema.safeParse({ ...validExecutionRecord, runner: 'unsandboxed', admissibility: 'evidence' }).success,
    ).toBe(false);
    expect(
      executionRecordSchema.safeParse({
        ...validExecutionRecord,
        runner: 'unsandboxed',
        admissibility: 'claim',
        environment: { ...validExecutionRecord.environment, image: null },
      }).success,
    ).toBe(true);
  });

  const minimalByStatus: Record<string, Record<string, unknown>> = {
    parsed: {
      path: 'a.xml',
      content_hash: `sha256:${'1'.repeat(64)}`,
      bytes: 10,
      status: 'parsed',
      error_code: null,
      junit: {
        tests: 0,
        passed: 0,
        failed: 0,
        errored: 0,
        skipped: 0,
        duration_ms: null,
        cases: [],
        cases_truncated: false,
      },
    },
    missing: { path: 'a.xml', content_hash: null, bytes: 0, status: 'missing', error_code: null, junit: null },
    'not-regular': { path: 'a.xml', content_hash: null, bytes: 0, status: 'not-regular', error_code: null, junit: null },
    'too-large': { path: 'a.xml', content_hash: null, bytes: 9999999, status: 'too-large', error_code: null, junit: null },
    malformed: {
      path: 'a.xml',
      content_hash: `sha256:${'1'.repeat(64)}`,
      bytes: 10,
      status: 'malformed',
      error_code: 'junit.syntax',
      junit: null,
    },
  };

  it('each status rejects the wrong content_hash nullness', () => {
    for (const [status, entry] of Object.entries(minimalByStatus)) {
      expect(executionResultFileSchema.safeParse(entry).success, `status ${status} should validate`).toBe(true);
      const currentlyNull = entry['content_hash'] === null;
      const flipped = { ...entry, content_hash: currentlyNull ? `sha256:${'2'.repeat(64)}` : null };
      expect(executionResultFileSchema.safeParse(flipped).success, `status ${status} flipped should fail`).toBe(false);
    }
  });

  it('a legacy entry without status needs a content hash', () => {
    expect(executionResultFileSchema.safeParse({ path: 'a.xml', content_hash: null, bytes: 0 }).success).toBe(false);
  });

  it('a legacy entry with a hash validates', () => {
    expect(
      executionResultFileSchema.safeParse({ path: 'a.xml', content_hash: `sha256:${'3'.repeat(64)}`, bytes: 10 }).success,
    ).toBe(true);
  });

  it('unread statuses record zero bytes when absent', () => {
    expect(executionResultFileSchema.safeParse({ ...minimalByStatus['missing'], bytes: 5 }).success).toBe(false);
    expect(executionResultFileSchema.safeParse({ ...minimalByStatus['not-regular'], bytes: 5 }).success).toBe(false);
    expect(executionResultFileSchema.safeParse(minimalByStatus['too-large']).success).toBe(true);
  });

  it('stored_omitted true without a reason fails', () => {
    expect(
      executionResultFileSchema.safeParse({ ...minimalByStatus['missing'], stored_omitted: true, stored_path: null }).success,
    ).toBe(false);
  });

  it('stored_omitted false with a reason fails', () => {
    expect(
      executionResultFileSchema.safeParse({
        ...minimalByStatus['missing'],
        stored_omitted: false,
        stored_omitted_reason: 'evidence-budget',
        stored_path: null,
      }).success,
    ).toBe(false);
  });

  it('a reason without stored_omitted fails', () => {
    expect(
      executionResultFileSchema.safeParse({ ...minimalByStatus['missing'], stored_omitted_reason: 'evidence-budget' }).success,
    ).toBe(false);
  });

  it('an unknown omission reason fails', () => {
    expect(
      executionResultFileSchema.safeParse({
        ...minimalByStatus['missing'],
        stored_omitted: true,
        stored_omitted_reason: 'not-a-real-reason',
        stored_path: null,
      }).success,
    ).toBe(false);
  });

  it('valid omission combinations validate', () => {
    expect(
      executionResultFileSchema.safeParse({
        ...minimalByStatus['malformed'],
        stored_omitted: true,
        stored_omitted_reason: 'evidence-budget',
        stored_path: null,
      }).success,
    ).toBe(true);
    expect(
      executionResultFileSchema.safeParse({
        ...minimalByStatus['malformed'],
        stored_omitted: true,
        stored_omitted_reason: 'redaction-input',
        stored_path: null,
      }).success,
    ).toBe(true);
    expect(
      executionResultFileSchema.safeParse({
        ...minimalByStatus['parsed'],
        stored_omitted: false,
        stored_path: 'executions/execution-0001/result-1.xml',
      }).success,
    ).toBe(true);
    expect(
      executionResultFileSchema.safeParse({ path: 'a.xml', content_hash: `sha256:${'4'.repeat(64)}`, bytes: 10 }).success,
    ).toBe(true);
  });

  it('stored_path follows status and omission', () => {
    expect(
      executionResultFileSchema.safeParse({ ...minimalByStatus['parsed'], stored_omitted: false, stored_path: null }).success,
    ).toBe(false);
    expect(
      executionResultFileSchema.safeParse({
        ...minimalByStatus['missing'],
        stored_omitted: false,
        stored_path: 'executions/execution-0001/result-1.xml',
      }).success,
    ).toBe(false);
    expect(
      executionResultFileSchema.safeParse({
        ...minimalByStatus['missing'],
        stored_omitted: true,
        stored_omitted_reason: 'evidence-budget',
      }).success,
    ).toBe(false);
    expect(
      executionResultFileSchema.safeParse({
        ...minimalByStatus['malformed'],
        stored_omitted: true,
        stored_omitted_reason: 'evidence-budget',
        stored_path: 'executions/execution-0001/result-1.xml',
      }).success,
    ).toBe(false);
    expect(
      executionResultFileSchema.safeParse({
        ...minimalByStatus['parsed'],
        stored_path: 'executions/execution-0001/result-1.xml',
      }).success,
    ).toBe(false);
  });

  it('junit summaries must be consistent', () => {
    expect(
      junitSummarySchema.safeParse({
        tests: 3,
        passed: 1,
        failed: 1,
        errored: 0,
        skipped: 0,
        duration_ms: null,
        cases: [],
        cases_truncated: true,
      }).success,
    ).toBe(false);
    expect(
      junitSummarySchema.safeParse({
        tests: 2,
        passed: 1,
        failed: 1,
        errored: 0,
        skipped: 0,
        duration_ms: null,
        cases: [{ identity: 'x', status: 'pass', duration_ms: null, identity_truncated: false }],
        cases_truncated: false,
      }).success,
    ).toBe(false);
    expect(executionResultFileSchema.safeParse({ ...minimalByStatus['parsed'], junit: null }).success).toBe(false);
    expect(
      executionResultFileSchema.safeParse({
        ...minimalByStatus['malformed'],
        junit: {
          tests: 0,
          passed: 0,
          failed: 0,
          errored: 0,
          skipped: 0,
          duration_ms: null,
          cases: [],
          cases_truncated: false,
        },
      }).success,
    ).toBe(false);
    expect(executionResultFileSchema.safeParse({ ...minimalByStatus['malformed'], error_code: null }).success).toBe(false);
  });

  it('case identities allow redaction growth', () => {
    const identity = 'x'.repeat(10000);
    expect(
      junitSummarySchema.safeParse({
        tests: 1,
        passed: 1,
        failed: 0,
        errored: 0,
        skipped: 0,
        duration_ms: null,
        cases: [{ identity, status: 'pass', duration_ms: null, identity_truncated: false }],
        cases_truncated: false,
      }).success,
    ).toBe(true);
  });

  it('stored paths must name evidence files', () => {
    expect(
      executionRecordSchema.safeParse({
        ...validExecutionRecord,
        output: { ...validExecutionRecord.output, stored_path: 'executions/execution-1/output.txt' },
      }).success,
    ).toBe(false);
    expect(
      executionResultFileSchema.safeParse({
        ...minimalByStatus['parsed'],
        stored_omitted: false,
        stored_path: 'executions/execution-0001/result-21.xml',
      }).success,
    ).toBe(false);
    expect(
      executionRecordSchema.safeParse({
        ...validExecutionRecord,
        output: { ...validExecutionRecord.output, stored_path: null },
      }).success,
    ).toBe(true);
  });
});
