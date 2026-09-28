import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';

import { waitingRecordSchema } from './waiting.js';

const validWaiting = {
  schema_version: 1,
  record_type: 'waiting',
  run_id: 36081628326,
  run_attempt: 1,
  subject: {
    repository: 'steady-orchard/patch-steward-testbed-public',
    type: 'pull_request',
    number: 12,
  },
  state: 'queued',
  reason: 'daily-runs',
  counts: {
    daily_count: 11,
    daily_limit: 10,
    author_count: 1,
    author_limit: 3,
  },
  snapshot_hash: `sha256:${'a'.repeat(64)}`,
  policy_revision: 'b'.repeat(40),
  arrival_at: '2026-09-28T10:00:05Z',
  recorded_at: '2026-09-28T10:00:05Z',
};

describe('record waiting', () => {
  it('waiting record accepts a queued run over the daily cap', () => {
    const result = waitingRecordSchema.safeParse(validWaiting);
    expect(result.success).toBe(true);
    if (result.success) {
      const hashResult = canonicalJsonHash(result.data);
      expect(hashResult.ok).toBe(true);
    }
  });

  it('waiting record accepts a queued run over the per-author cap', () => {
    const result = waitingRecordSchema.safeParse({
      ...validWaiting,
      reason: 'per-author-concurrent-runs',
      counts: { daily_count: 5, daily_limit: 10, author_count: 4, author_limit: 3 },
    });
    expect(result.success).toBe(true);
  });

  it('waiting record rejects a reason its counts do not show', () => {
    const result = waitingRecordSchema.safeParse({
      ...validWaiting,
      reason: 'per-author-concurrent-runs',
      counts: { daily_count: 5, daily_limit: 10, author_count: 1, author_limit: 3 },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'reason')).toBe(true);
    }
  });

  it('waiting record rejects unknown keys and other states', () => {
    const withExtraKey = waitingRecordSchema.safeParse({ ...validWaiting, extra: 'nope' });
    expect(withExtraKey.success).toBe(false);

    const withOtherState = waitingRecordSchema.safeParse({ ...validWaiting, state: 'awaiting-approval' });
    expect(withOtherState.success).toBe(false);
  });

  it('waiting record rejects a local policy revision', () => {
    const result = waitingRecordSchema.safeParse({ ...validWaiting, policy_revision: `local:${'a'.repeat(64)}` });
    expect(result.success).toBe(false);
  });
});
