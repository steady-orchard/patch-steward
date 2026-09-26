import { describe, expect, it } from 'vitest';
import { err, ok, type FailureDetail } from './result.js';
import { FAILURE_CAUSES } from './vocabulary.js';

describe('ok', () => {
  it('wraps a value', () => {
    expect(ok(5)).toEqual({ ok: true, value: 5 });
  });
});

describe('err', () => {
  it('builds a failure with default empty details', () => {
    const result = err('x.y', 'infrastructure', 'm');
    expect(result.ok).toBe(false);
    expect(result.failure.code).toBe('x.y');
    expect(result.failure.cause).toBe('infrastructure');
    expect(result.failure.outcome).toBe('inconclusive');
    expect(result.failure.message).toBe('m');
    expect(result.failure.details).toEqual([]);
  });

  it('passes details through unchanged', () => {
    const details: readonly FailureDetail[] = [{ code: 'd', path: 'a.b', message: 'bad', line: 1, column: 2 }];
    const result = err('x.y', 'infrastructure', 'm', details);
    expect(result.failure.details).toBe(details);
  });

  it('always produces outcome inconclusive for every failure cause', () => {
    for (const cause of FAILURE_CAUSES) {
      expect(err('x.y', cause, 'm').failure.outcome).toBe('inconclusive');
    }
  });
});
