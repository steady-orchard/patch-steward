import { describe, expect, it } from 'vitest';
import { STRICT_YAML_FAILURE_CODES, parseStrictYaml, parseStrictYamlDocument } from './strict-yaml.js';
import type { StrictYamlFailureCode } from './strict-yaml.js';

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const bounds = { maxBytes: 65536, maxDepth: 32, maxNodes: 1000 };

function expectFailure(bytes: Uint8Array, code: StrictYamlFailureCode, boundsOverride = bounds): void {
  const result = parseStrictYaml(bytes, boundsOverride);
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.failure.code).toBe(code);
  expect(result.failure.cause).toBe('policy-invalid');
  expect(result.failure.outcome).toBe('inconclusive');
  expect(result.failure.details).toHaveLength(1);
  expect(result.failure.details[0]?.code).toBe(code);
}

describe('parseStrictYaml failure codes', () => {
  it('rejects with yaml.too-large', () => {
    expectFailure(utf8('a: 1\n'), 'yaml.too-large', { ...bounds, maxBytes: 4 });
    expect(parseStrictYaml(utf8('a: 1\n'), { ...bounds, maxBytes: 5 }).ok).toBe(true);
  });

  it('rejects with yaml.invalid-utf8', () => {
    expectFailure(new Uint8Array([0x61, 0x3a, 0x20, 0xff]), 'yaml.invalid-utf8');
  });

  it('rejects with yaml.syntax', () => {
    expectFailure(utf8('a: [1, 2\n'), 'yaml.syntax');
    expectFailure(utf8('a:\n\t- 1\n'), 'yaml.syntax');
  });

  it('rejects with yaml.empty', () => {
    expectFailure(utf8(''), 'yaml.empty');
    expectFailure(utf8('# only a comment\n'), 'yaml.empty');
  });

  it('rejects with yaml.multi-document', () => {
    expectFailure(utf8('a: 1\n---\nb: 2\n'), 'yaml.multi-document');
  });

  it('rejects with yaml.duplicate-key', () => {
    const result = parseStrictYaml(utf8('x: 1\na: 1\na: 2\n'), bounds);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.failure.code).toBe('yaml.duplicate-key');
    expect(result.failure.details[0]?.line).toBe(3);
  });

  it('rejects with yaml.directive', () => {
    expectFailure(utf8('%YAML 1.1\n---\na: 1\n'), 'yaml.directive');
    expectFailure(utf8('%TAG !e! tag:example.com,2000:\n---\na: 1\n'), 'yaml.directive');
  });

  it('rejects with yaml.alias', () => {
    expectFailure(utf8('a: &x 1\nb: *x\n'), 'yaml.alias');
  });

  it('rejects with yaml.anchor', () => {
    expectFailure(utf8('a: &x 1\n'), 'yaml.anchor');
  });

  it('rejects with yaml.explicit-tag', () => {
    expectFailure(utf8('a: !!str 1\n'), 'yaml.explicit-tag');
    expectFailure(utf8('a: !custom 1\n'), 'yaml.explicit-tag');
    expectFailure(utf8('a: !!map {b: 1}\n'), 'yaml.explicit-tag');
    expectFailure(utf8('a: ! 1\n'), 'yaml.explicit-tag');
  });

  it('rejects with yaml.non-string-key', () => {
    expectFailure(utf8('1: a\n'), 'yaml.non-string-key');
    expectFailure(utf8('true: a\n'), 'yaml.non-string-key');
    expectFailure(utf8('~: a\n'), 'yaml.non-string-key');
    expectFailure(utf8('? [a]\n: b\n'), 'yaml.non-string-key');
  });

  it('rejects with yaml.forbidden-key', () => {
    expectFailure(utf8('__proto__: {}\n'), 'yaml.forbidden-key');
    expectFailure(utf8('constructor: 1\n'), 'yaml.forbidden-key');
    expectFailure(utf8('prototype: 1\n'), 'yaml.forbidden-key');
    const result = parseStrictYaml(utf8('a:\n  __proto__: 1\n'), bounds);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.failure.code).toBe('yaml.forbidden-key');
    expect(result.failure.details[0]?.path).toBe('a.__proto__');
  });

  it('rejects with yaml.too-deep', () => {
    expectFailure(utf8('a: {b: {c: 1}}\n'), 'yaml.too-deep', { ...bounds, maxDepth: 2 });
    expect(parseStrictYaml(utf8('a: {b: {c: 1}}\n'), { ...bounds, maxDepth: 3 }).ok).toBe(true);
    const deeplyNested = '['.repeat(20000) + ']'.repeat(20000);
    expectFailure(utf8(deeplyNested), 'yaml.too-deep', { ...bounds, maxBytes: 100000 });
  });

  it('rejects with yaml.too-many-nodes', () => {
    expectFailure(utf8('a: 1\n'), 'yaml.too-many-nodes', { ...bounds, maxNodes: 2 });
    expect(parseStrictYaml(utf8('a: 1\n'), { ...bounds, maxNodes: 3 }).ok).toBe(true);
  });
});

describe('STRICT_YAML_FAILURE_CODES', () => {
  it('has 14 unique entries and every code is produced', () => {
    expect(STRICT_YAML_FAILURE_CODES).toHaveLength(14);
    expect(new Set(STRICT_YAML_FAILURE_CODES).size).toBe(14);

    const inputs: Array<[Uint8Array, StrictYamlFailureCode, typeof bounds]> = [
      [utf8('a: 1\n'), 'yaml.too-large', { ...bounds, maxBytes: 4 }],
      [new Uint8Array([0x61, 0x3a, 0x20, 0xff]), 'yaml.invalid-utf8', bounds],
      [utf8('a: [1, 2\n'), 'yaml.syntax', bounds],
      [utf8(''), 'yaml.empty', bounds],
      [utf8('a: 1\n---\nb: 2\n'), 'yaml.multi-document', bounds],
      [utf8('x: 1\na: 1\na: 2\n'), 'yaml.duplicate-key', bounds],
      [utf8('%YAML 1.1\n---\na: 1\n'), 'yaml.directive', bounds],
      [utf8('a: &x 1\nb: *x\n'), 'yaml.alias', bounds],
      [utf8('a: &x 1\n'), 'yaml.anchor', bounds],
      [utf8('a: !!str 1\n'), 'yaml.explicit-tag', bounds],
      [utf8('1: a\n'), 'yaml.non-string-key', bounds],
      [utf8('__proto__: {}\n'), 'yaml.forbidden-key', bounds],
      [utf8('a: {b: {c: 1}}\n'), 'yaml.too-deep', { ...bounds, maxDepth: 2 }],
      [utf8('a: 1\n'), 'yaml.too-many-nodes', { ...bounds, maxNodes: 2 }],
    ];

    const produced = new Set<string>();
    for (const [bytes, code, b] of inputs) {
      const result = parseStrictYaml(bytes, b);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe(code);
        produced.add(result.failure.code);
      }
    }
    expect(produced.size).toBe(14);
  });
});

describe('parseStrictYaml acceptance', () => {
  it('converts nested maps and sequences to the equal plain value', () => {
    const result = parseStrictYaml(utf8('a:\n  b: [1, 2, 3]\n  c: hello\n'), bounds);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ a: { b: [1, 2, 3], c: 'hello' } });
    }
  });

  it('uses the YAML 1.2 core schema', () => {
    const result = parseStrictYaml(utf8('on: yes\noff: no\ndate: 2026-01-01\nn: 0o17\nz: null\n'), bounds);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ on: 'yes', off: 'no', date: '2026-01-01', n: 15, z: null });
    }
  });

  it('accepts a leading UTF-8 BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('a: 1\n')]);
    const result = parseStrictYaml(bytes, bounds);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ a: 1 });
    }
  });

  it('accepts a top-level scalar', () => {
    const result = parseStrictYaml(utf8('hello'), bounds);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('hello');
    }
  });

  it('accepts input at exactly maxBytes', () => {
    const bytes = utf8('a: [1, 2]\n');
    const result = parseStrictYaml(bytes, { ...bounds, maxBytes: bytes.byteLength });
    expect(result.ok).toBe(true);
  });
});

describe('parseStrictYaml messages never echo input', () => {
  it('does not include anchor or tag names in messages', () => {
    const aliasResult = parseStrictYaml(utf8('a: &secretanchor 1\nb: *secretanchor\n'), bounds);
    expect(aliasResult.ok).toBe(false);
    if (!aliasResult.ok) {
      expect(aliasResult.failure.message).not.toContain('secret');
      for (const detail of aliasResult.failure.details) {
        expect(detail.message).not.toContain('secret');
      }
    }

    const tagResult = parseStrictYaml(utf8('k: !secrettag 1\n'), bounds);
    expect(tagResult.ok).toBe(false);
    if (!tagResult.ok) {
      expect(tagResult.failure.message).not.toContain('secret');
      for (const detail of tagResult.failure.details) {
        expect(detail.message).not.toContain('secret');
      }
    }
  });
});

describe('parseStrictYamlDocument positions', () => {
  it('positions map records mapping keys', () => {
    const result = parseStrictYamlDocument(utf8('version: 1\nrunner:\n  resources:\n    cpus: 2\n'), bounds);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.positions.get('')).toEqual({ line: 1, column: 1 });
    expect(result.value.positions.get('version')).toEqual({ line: 1, column: 1 });
    expect(result.value.positions.get('runner')).toEqual({ line: 2, column: 1 });
    expect(result.value.positions.get('runner.resources')).toEqual({ line: 3, column: 3 });
    expect(result.value.positions.get('runner.resources.cpus')).toEqual({ line: 4, column: 5 });
  });

  it('positions map records sequence items', () => {
    const result = parseStrictYamlDocument(utf8('list:\n  - a\n  - b\n'), bounds);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.positions.get('list')).toEqual({ line: 1, column: 1 });
    expect(result.value.positions.get('list.0')).toEqual({ line: 2, column: 5 });
    expect(result.value.positions.get('list.1')).toEqual({ line: 3, column: 5 });
  });

  it('positions are unchanged by CRLF line endings', () => {
    const result = parseStrictYamlDocument(utf8('version: 1\r\nrunner:\r\n  cpus: 2\r\n'), bounds);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.positions.get('runner')).toEqual({ line: 2, column: 1 });
    expect(result.value.positions.get('runner.cpus')).toEqual({ line: 3, column: 3 });
  });

  it('positions map records flow collections', () => {
    const result = parseStrictYamlDocument(utf8('a: [x, {b: 1}]\n'), bounds);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.positions.get('a.0')).toEqual({ line: 1, column: 5 });
    expect(result.value.positions.get('a.1')).toEqual({ line: 1, column: 8 });
    expect(result.value.positions.get('a.1.b')).toEqual({ line: 1, column: 9 });
  });

  it('parseStrictYaml still returns only the value', () => {
    const bytes = utf8('version: 1\nrunner:\n  resources:\n    cpus: 2\n');
    const plain = parseStrictYaml(bytes, bounds);
    const withPositions = parseStrictYamlDocument(bytes, bounds);
    expect(plain.ok).toBe(true);
    expect(withPositions.ok).toBe(true);
    if (!plain.ok || !withPositions.ok) {
      return;
    }
    expect(plain.value).toStrictEqual(withPositions.value.value);
  });

  it('parseStrictYamlDocument fails exactly like parseStrictYaml', () => {
    const aliasBytes = utf8('a: &x 1\nb: *x\n');
    expect(parseStrictYamlDocument(aliasBytes, bounds)).toEqual(parseStrictYaml(aliasBytes, bounds));

    const duplicateBytes = utf8('a: 1\na: 2\n');
    expect(parseStrictYamlDocument(duplicateBytes, bounds)).toEqual(parseStrictYaml(duplicateBytes, bounds));
  });
});
