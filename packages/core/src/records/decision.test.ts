import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';

import { decisionRecordSchema } from './decision.js';

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

describe('record decision', () => {
  it('record decision accepts a fixture instance', () => {
    const parsed = decisionRecordSchema.parse(validDecision);
    expect(parsed.run_id).toBe(100);
    expect(canonicalJsonHash(parsed).ok).toBe(true);
  });

  it('record decision rejects an unknown key', () => {
    const withExtra = { ...validDecision, extra: 'nope' };
    expect(decisionRecordSchema.safeParse(withExtra).success).toBe(false);
  });

  it('record decision rejects a wrong schema_version', () => {
    const wrongVersion = { ...validDecision, schema_version: 2 };
    expect(decisionRecordSchema.safeParse(wrongVersion).success).toBe(false);
  });

  it('record decision rejects an unknown outcome', () => {
    const unknownOutcome = { ...validDecision, outcome: 'approved' };
    expect(decisionRecordSchema.safeParse(unknownOutcome).success).toBe(false);
  });

  it('record decision accepts optional causes', () => {
    const withCauses = {
      ...validDecision,
      causes: [
        {
          cause: 'attachment-fetch-failed',
          code: 'attachment.fetch-failed',
          message: 'A required attachment could not be fetched.',
          subjects: ['https://github.com/user-attachments/files/1/a.zip'],
        },
      ],
    };
    expect(decisionRecordSchema.safeParse(withCauses).success).toBe(true);

    const withEmptyCauses = { ...validDecision, causes: [] };
    expect(decisionRecordSchema.safeParse(withEmptyCauses).success).toBe(true);
  });

  it('record decision rejects an unknown cause or cause key', () => {
    const withUnknownCause = {
      ...validDecision,
      causes: [
        {
          cause: 'not-a-cause',
          code: 'attachment.fetch-failed',
          message: 'A required attachment could not be fetched.',
          subjects: [],
        },
      ],
    };
    expect(decisionRecordSchema.safeParse(withUnknownCause).success).toBe(false);

    const withExtraCauseKey = {
      ...validDecision,
      causes: [
        {
          cause: 'attachment-fetch-failed',
          code: 'attachment.fetch-failed',
          message: 'A required attachment could not be fetched.',
          subjects: [],
          extra: 'nope',
        },
      ],
    };
    expect(decisionRecordSchema.safeParse(withExtraCauseKey).success).toBe(false);
  });
});
