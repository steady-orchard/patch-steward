import { describe, expect, it } from 'vitest';

import { supersessionRecordSchema } from './supersession.js';

const validSupersession = {
  schema_version: 1,
  record_type: 'supersession',
  run_id: 36081628326,
  run_attempt: 1,
  subject: {
    repository: 'steady-orchard/patch-steward-testbed-public',
    type: 'pull_request',
    number: 12,
  },
  reason: 'newer-owner',
  successor: {
    run_id: 36081628400,
    run_attempt: 1,
    artifact_created_at: '2026-09-28T10:05:00Z',
  },
  recorded_snapshot_hash: `sha256:${'a'.repeat(64)}`,
  live_snapshot_hash: null,
  recorded_at: '2026-09-28T10:00:05Z',
};

describe('record supersession', () => {
  it('supersession record accepts a newer-owner record with a successor', () => {
    const result = supersessionRecordSchema.safeParse(validSupersession);
    expect(result.success).toBe(true);
  });

  it('supersession record accepts a missing successor', () => {
    const result = supersessionRecordSchema.safeParse({ ...validSupersession, successor: null });
    expect(result.success).toBe(true);
  });

  it('supersession record requires the live hash for a changed snapshot', () => {
    const result = supersessionRecordSchema.safeParse({
      ...validSupersession,
      reason: 'snapshot-changed',
      live_snapshot_hash: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'live_snapshot_hash')).toBe(true);
    }
  });

  it('supersession record rejects itself as successor', () => {
    const result = supersessionRecordSchema.safeParse({
      ...validSupersession,
      successor: {
        run_id: validSupersession.run_id,
        run_attempt: validSupersession.run_attempt,
        artifact_created_at: '2026-09-28T10:05:00Z',
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'successor')).toBe(true);
    }
  });

  it('supersession record rejects unknown keys', () => {
    const result = supersessionRecordSchema.safeParse({ ...validSupersession, extra: 'nope' });
    expect(result.success).toBe(false);
  });
});
