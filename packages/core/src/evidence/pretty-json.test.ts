import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';
import { prettyJson } from './pretty-json.js';

describe('prettyJson', () => {
  it('pretty json sorts keys by UTF-16 code units', () => {
    const input = { b: 1, a: 2, '｡': 3, '\u{1F600}': 4, '10': 5, '9': 6 };
    const result = prettyJson(input);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const keyOrder = [...result.value.matchAll(/"((?:[^"\\]|\\.)*)":/g)].map((m) => JSON.parse(`"${m[1]}"`));
    expect(keyOrder).toEqual(['10', '9', 'a', 'b', '\u{1F600}', '｡']);
  });

  it('pretty json expands non-empty containers and inlines empty ones', () => {
    const result = prettyJson({ a: [], b: {}, c: [1, { d: null }] });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value).toBe('{\n  "a": [],\n  "b": {},\n  "c": [\n    1,\n    {\n      "d": null\n    }\n  ]\n}\n');
  });

  it('pretty json ends with exactly one LF', () => {
    const result = prettyJson({ a: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.endsWith('\n')).toBe(true);
    expect(result.value.endsWith('\n\n')).toBe(false);
    expect(result.value.includes('\r')).toBe(false);
  });

  it('pretty json round-trips to the canonical hash', () => {
    const samples: readonly unknown[] = [
      {
        text: 'quote:" backslash:\\ line-sep:  emoji:\u{1F600}',
        nested: { list: [1, 2, 3], flag: true },
      },
      { zero: 0, negZero: -0, big: 1e21, frac: 0.1, tiny: 5e-7 },
      [1, 'two', { three: 3 }, [4, 5]],
    ];
    for (const sample of samples) {
      const prettyResult = prettyJson(sample);
      expect(prettyResult.ok).toBe(true);
      if (!prettyResult.ok) {
        continue;
      }
      const parsed: unknown = JSON.parse(prettyResult.value);
      const parsedHash = canonicalJsonHash(parsed);
      const sampleHash = canonicalJsonHash(sample);
      expect(parsedHash).toEqual(sampleHash);
    }
  });

  it('pretty json rejects values canonical json rejects', () => {
    function cyclic(): Record<string, unknown> {
      const obj: Record<string, unknown> = {};
      obj['self'] = obj;
      return obj;
    }

    const cases: readonly [unknown, string][] = [
      [Number.NaN, 'canonical-json.non-finite-number'],
      [Number.POSITIVE_INFINITY, 'canonical-json.non-finite-number'],
      ['\uD800', 'canonical-json.lone-surrogate'],
      [undefined, 'canonical-json.unsupported-value'],
      [cyclic(), 'canonical-json.cycle'],
    ];
    for (const [input, expectedCode] of cases) {
      const result = prettyJson(input);
      expect(result.ok).toBe(false);
      if (result.ok) {
        continue;
      }
      expect(result.failure.code).toBe(expectedCode);
    }
  });
});
