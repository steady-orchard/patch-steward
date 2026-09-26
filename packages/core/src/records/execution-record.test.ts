import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';

import { executionRecordSchema } from './execution-record.js';

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
});
