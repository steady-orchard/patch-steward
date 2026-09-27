import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';

import { findingRecordSchema } from './finding.js';

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

describe('record finding', () => {
  it('record finding accepts a fixture instance', () => {
    const parsed = findingRecordSchema.parse(validFinding);
    expect(parsed.run_id).toBe(100);
    expect(canonicalJsonHash(parsed).ok).toBe(true);
  });

  it('record finding rejects an unknown key', () => {
    const withExtra = { ...validFinding, extra: 'nope' };
    expect(findingRecordSchema.safeParse(withExtra).success).toBe(false);
  });

  it('record finding rejects a wrong schema_version', () => {
    const wrongVersion = { ...validFinding, schema_version: 2 };
    expect(findingRecordSchema.safeParse(wrongVersion).success).toBe(false);
  });

  it('record finding rejects an invalid dismissal code', () => {
    const invalidCode = { ...validFinding, dismissal_code: 'Not Kebab' };
    expect(findingRecordSchema.safeParse(invalidCode).success).toBe(false);
  });

  it('record finding accepts a null dismissal code', () => {
    const nullCode = { ...validFinding, dismissal_code: null };
    expect(findingRecordSchema.safeParse(nullCode).success).toBe(true);
  });

  it('record finding accepts the optional code, detail, subjects, and request_id keys', () => {
    const withOptionalKeys = {
      ...validFinding,
      code: 'submission.field-missing',
      detail: null,
      subjects: ['src/a.ts'],
      request_id: 'R1',
    };
    expect(findingRecordSchema.safeParse(withOptionalKeys).success).toBe(true);

    const withDetail = { ...withOptionalKeys, detail: 'format' };
    expect(findingRecordSchema.safeParse(withDetail).success).toBe(true);
  });

  it('record finding rejects malformed optional keys', () => {
    const withBadRequestId = { ...validFinding, request_id: 'R 1' };
    expect(findingRecordSchema.safeParse(withBadRequestId).success).toBe(false);

    const withBadSubjects = { ...validFinding, subjects: 'x' };
    expect(findingRecordSchema.safeParse(withBadSubjects).success).toBe(false);

    const withBadCode = { ...validFinding, code: '' };
    expect(findingRecordSchema.safeParse(withBadCode).success).toBe(false);
  });
});
