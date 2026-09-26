import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FAILURE_CAUSES, loadPolicy, resolvedPolicySchema } from '../index.js';

const corpusDir = fileURLToPath(new URL('../../../../fixtures/policies/', import.meta.url));
const expectationsPath = fileURLToPath(new URL('../../../../fixtures/policies/expectations.json', import.meta.url));

interface Expectation {
  readonly valid: boolean;
  readonly codes: readonly string[];
}

const expectations: Record<string, Expectation> = JSON.parse(readFileSync(expectationsPath, 'utf8')) as Record<string, Expectation>;

describe('invariant 5 fixture conformance', () => {
  it.each(Object.keys(expectations))(
    'invariant 5: fixture %s yields a typed failure or a policy that re-validates',
    async (rel) => {
      const expectation = expectations[rel] as Expectation;
      const result = await loadPolicy({ kind: 'file', path: join(corpusDir, rel) });
      if (result.ok) {
        expect(expectation.valid).toBe(true);
        expect(result.value.authoritative).toBe(false);
        expect(resolvedPolicySchema.safeParse(result.value.policy).success).toBe(true);
      } else {
        expect(expectation.valid).toBe(false);
        expect(result.failure.outcome).toBe('inconclusive');
        expect(FAILURE_CAUSES).toContain(result.failure.cause);
        expect('value' in result).toBe(false);
        expect(expectation.codes).toContain(result.failure.code);
        for (const detail of result.failure.details) {
          expect(typeof detail.code).toBe('string');
          expect(typeof detail.path).toBe('string');
          expect(typeof detail.message).toBe('string');
          expect(typeof detail.line === 'number' || detail.line === null).toBe(true);
          expect(typeof detail.column === 'number' || detail.column === null).toBe(true);
        }
      }
    },
  );

  it('invariant 5: the fixture corpus holds valid, invalid, and hostile policies', () => {
    const keys = Object.keys(expectations);
    expect(keys.some((key) => key.startsWith('valid/'))).toBe(true);
    expect(keys.some((key) => key.startsWith('invalid/'))).toBe(true);
    expect(keys.some((key) => key.startsWith('hostile/'))).toBe(true);
  });
});
