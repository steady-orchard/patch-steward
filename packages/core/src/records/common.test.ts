import { describe, expect, it } from 'vitest';

import {
  RECORD_TYPES,
  recordTextSchema,
  recordTimestampSchema,
  policyRevisionIdSchema,
  recordList,
  recordIdentifierSchema,
} from './common.js';

describe('record common', () => {
  it('record text rejects lone surrogates', () => {
    expect(recordTextSchema.safeParse('a\uD800').success).toBe(false);
  });

  it('record timestamps require UTC Z', () => {
    expect(recordTimestampSchema.safeParse('2026-09-26T12:00:00+00:00').success).toBe(false);
    expect(recordTimestampSchema.safeParse('2026-09-26T12:00:00.5Z').success).toBe(true);
  });

  it('policy revision ids accept tree ids and local ids', () => {
    expect(policyRevisionIdSchema.safeParse('a'.repeat(40)).success).toBe(true);
    expect(policyRevisionIdSchema.safeParse('a'.repeat(64)).success).toBe(true);
    expect(policyRevisionIdSchema.safeParse(`local:${'a'.repeat(64)}`).success).toBe(true);
    expect(policyRevisionIdSchema.safeParse('local:abc').success).toBe(false);
    expect(policyRevisionIdSchema.safeParse('HEAD').success).toBe(false);
  });

  it('record lists are bounded', () => {
    const schema = recordList(recordIdentifierSchema);
    const items = Array.from({ length: 1001 }, (_, i) => `item-${i}`);
    expect(schema.safeParse(items).success).toBe(false);
  });

  it('record identifiers reject whitespace and control characters', () => {
    expect(recordIdentifierSchema.safeParse('has space').success).toBe(false);
    expect(recordIdentifierSchema.safeParse('has\ttab').success).toBe(false);
    expect(recordIdentifierSchema.safeParse('has\ncontrol').success).toBe(false);
    expect(recordIdentifierSchema.safeParse('valid-id').success).toBe(true);
  });

  it('record types list the nine records', () => {
    expect(RECORD_TYPES).toEqual([
      'submission',
      'run',
      'execution-record',
      'finding',
      'decision',
      'report',
      'maintainer-action',
      'metrics-event',
      'policy-revision',
    ]);
  });
});
