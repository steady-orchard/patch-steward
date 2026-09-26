import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';

import { reportRecordSchema } from './report.js';

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

describe('record report', () => {
  it('record report accepts a fixture instance', () => {
    const parsed = reportRecordSchema.parse(validReport);
    expect(parsed.run_id).toBe(100);
    expect(canonicalJsonHash(parsed).ok).toBe(true);
  });

  it('record report rejects an unknown key', () => {
    const withExtra = { ...validReport, extra: 'nope' };
    expect(reportRecordSchema.safeParse(withExtra).success).toBe(false);
  });

  it('record report rejects a wrong schema_version', () => {
    const wrongVersion = { ...validReport, schema_version: 2 };
    expect(reportRecordSchema.safeParse(wrongVersion).success).toBe(false);
  });

  it('record report rejects a malformed policy revision', () => {
    const malformed = { ...validReport, bound: { ...validReport.bound, policy_revision: 'HEAD' } };
    expect(reportRecordSchema.safeParse(malformed).success).toBe(false);
  });
});
