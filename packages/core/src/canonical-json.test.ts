import { describe, expect, it } from 'vitest';

import { canonicalJson } from './canonical-json.js';
import type { CanonicalJsonFailureCode } from './canonical-json.js';

function toHex(canonical: string): string {
  return Buffer.from(canonical, 'utf8').toString('hex');
}

describe('canonicalJson', () => {
  it('canonicalizes the RFC 8785 sample object', () => {
    const numbers = JSON.parse('[333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001]') as unknown[];
    const s = String.fromCharCode(0x20ac, 0x24, 0x0f, 0x0a, 0x41, 0x27, 0x42, 0x22, 0x5c, 0x5c, 0x22, 0x2f);
    const result = canonicalJson({ numbers, string: s, literals: [null, true, false] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(toHex(result.value)).toBe(
        '7b226c69746572616c73223a5b6e756c6c2c747275652c66616c73655d2c226e756d62657273223a5b3333333333333333332e333333333333332c31652b33302c342e352c302e3030322c31652d32375d2c22737472696e67223a22e282ac245c75303030665c6e4127425c225c5c5c5c5c222f227d',
      );
    }
  });

  it('sorts keys as in the RFC 8785 sorting example', () => {
    const value: Record<string, string> = {};
    value[String.fromCharCode(0x20ac)] = 'Euro Sign';
    value[String.fromCharCode(0x0d)] = 'Carriage Return';
    value[String.fromCharCode(0xfb33)] = 'Hebrew Letter Dalet With Dagesh';
    value['1'] = 'One';
    value[String.fromCharCode(0xd83d, 0xde00)] = 'Emoji: Grinning Face';
    value[String.fromCharCode(0x80)] = 'Control';
    value[String.fromCharCode(0xf6)] = 'Latin Small Letter O With Diaeresis';
    const result = canonicalJson(value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(toHex(result.value)).toBe(
        '7b225c72223a2243617272696167652052657475726e222c2231223a224f6e65222c22c280223a22436f6e74726f6c222c22c3b6223a224c6174696e20536d616c6c204c6574746572204f205769746820446961657265736973222c22e282ac223a224575726f205369676e222c22f09f9880223a22456d6f6a693a204772696e6e696e672046616365222c22efacb3223a22486562726577204c65747465722044616c6574205769746820446167657368227d',
      );
    }
  });

  it('serializes the RFC 8785 number vectors', () => {
    const vectors: Array<[string, string | null]> = [
      ['0000000000000000', '0'],
      ['8000000000000000', '0'],
      ['0000000000000001', '5e-324'],
      ['8000000000000001', '-5e-324'],
      ['7fefffffffffffff', '1.7976931348623157e+308'],
      ['ffefffffffffffff', '-1.7976931348623157e+308'],
      ['4340000000000000', '9007199254740992'],
      ['c340000000000000', '-9007199254740992'],
      ['4430000000000000', '295147905179352830000'],
      ['44b52d02c7e14af5', '9.999999999999997e+22'],
      ['44b52d02c7e14af6', '1e+23'],
      ['44b52d02c7e14af7', '1.0000000000000001e+23'],
      ['444b1ae4d6e2ef4e', '999999999999999700000'],
      ['444b1ae4d6e2ef4f', '999999999999999900000'],
      ['444b1ae4d6e2ef50', '1e+21'],
      ['3eb0c6f7a0b5ed8c', '9.999999999999997e-7'],
      ['3eb0c6f7a0b5ed8d', '0.000001'],
      ['41b3de4355555553', '333333333.3333332'],
      ['41b3de4355555554', '333333333.33333325'],
      ['41b3de4355555555', '333333333.3333333'],
      ['41b3de4355555556', '333333333.3333334'],
      ['41b3de4355555557', '333333333.33333343'],
      ['becbf647612f3696', '-0.0000033333333333333333'],
      ['43143ff3c1cb0959', '1424953923781206.2'],
      ['7fffffffffffffff', null],
      ['7ff0000000000000', null],
      ['fff0000000000000', null],
    ];
    for (const [bitsHex, expected] of vectors) {
      const n = Buffer.from(bitsHex, 'hex').readDoubleBE(0);
      const result = canonicalJson(n);
      if (expected === null) {
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.failure.code).toBe('canonical-json.non-finite-number');
        }
      } else {
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe(expected);
        }
      }
    }
  });

  it('accepts nested arrays and objects', () => {
    const result = canonicalJson({ a: [1, { b: 2 }, [3, 4]] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('{"a":[1,{"b":2},[3,4]]}');
    }
  });

  it('accepts a null-prototype object', () => {
    const value = Object.create(null) as Record<string, unknown>;
    value['a'] = 1;
    const result = canonicalJson(value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('{"a":1}');
    }
  });

  it('accepts a shared non-cyclic reference', () => {
    const shared = { x: 1 };
    const result = canonicalJson({ a: shared, b: shared });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('{"a":{"x":1},"b":{"x":1}}');
    }
  });

  function expectFailure(value: unknown, code: CanonicalJsonFailureCode, path: string): void {
    const result = canonicalJson(value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe(code);
      expect(result.failure.cause).toBe('steward-defect');
      expect(result.failure.outcome).toBe('inconclusive');
      expect(result.failure.details).toHaveLength(1);
      expect(result.failure.details?.[0]?.code).toBe(code);
      expect(result.failure.details?.[0]?.path).toBe(path);
    }
  }

  it('rejects a lone surrogate value', () => {
    expectFailure(String.fromCharCode(0xd800), 'canonical-json.lone-surrogate', '');
  });

  it('rejects a lone surrogate key', () => {
    const key = String.fromCharCode(0xd800);
    expectFailure({ [key]: 1 }, 'canonical-json.lone-surrogate', key);
  });

  it('rejects undefined', () => {
    expectFailure(undefined, 'canonical-json.unsupported-value', '');
  });

  it('rejects an object with an undefined property', () => {
    expectFailure({ a: undefined }, 'canonical-json.unsupported-value', 'a');
  });

  it('rejects a sparse array', () => {
    const sparse: unknown[] = [1];
    sparse[2] = 3;
    expectFailure(sparse, 'canonical-json.unsupported-value', '1');
  });

  it('rejects a bigint', () => {
    expectFailure(1n, 'canonical-json.unsupported-value', '');
  });

  it('rejects a Date', () => {
    expectFailure(new Date(), 'canonical-json.unsupported-value', '');
  });

  it('rejects a Map', () => {
    expectFailure(new Map(), 'canonical-json.unsupported-value', '');
  });

  it('rejects a function', () => {
    expectFailure(() => undefined, 'canonical-json.unsupported-value', '');
  });

  it('rejects a symbol', () => {
    expectFailure(Symbol('s'), 'canonical-json.unsupported-value', '');
  });

  it('rejects an object with a symbol key', () => {
    const value: Record<string | symbol, unknown> = { [Symbol('s')]: 1 };
    expectFailure(value, 'canonical-json.unsupported-value', '');
  });

  it('rejects a self-referencing object', () => {
    const value: Record<string, unknown> = {};
    value['self'] = value;
    expectFailure(value, 'canonical-json.cycle', 'self');
  });

  it('reports the nested path of the offending value', () => {
    expectFailure({ a: [1, NaN] }, 'canonical-json.non-finite-number', 'a.1');
  });
});
