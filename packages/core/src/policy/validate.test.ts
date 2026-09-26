import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { parseStrictYaml, parseStrictYamlDocument } from '../strict-yaml.js';
import { POLICY_FILE_MAX_BYTES, POLICY_YAML_MAX_DEPTH, POLICY_YAML_MAX_NODES, VALIDATION_ERRORS_MAX } from './bounds.js';
import { scanPolicyCredentials, validatePolicy, validatePolicyBytes } from './validate.js';

const templateBytes = readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));

function loadTemplate(): unknown {
  const result = parseStrictYaml(templateBytes, {
    maxBytes: POLICY_FILE_MAX_BYTES,
    maxDepth: POLICY_YAML_MAX_DEPTH,
    maxNodes: POLICY_YAML_MAX_NODES,
  });
  if (!result.ok) {
    throw new Error('template failed to parse');
  }
  return result.value;
}

function detailCodes(failure: { details: readonly { code: string }[] }): string[] {
  return failure.details.map((detail) => detail.code);
}

describe('validatePolicyBytes', () => {
  it('template bytes validate', () => {
    const result = validatePolicyBytes(templateBytes);
    expect(result.ok).toBe(true);
  });

  it('rejects a non-mapping document', () => {
    for (const raw of [[], 'text']) {
      const result = validatePolicy(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('policy.invalid-value');
        expect(result.failure.details[0]?.path).toBe('');
      }
    }
  });

  it('rejects a missing version', () => {
    const raw = structuredClone(loadTemplate()) as Record<string, unknown>;
    delete raw.version;
    const result = validatePolicy(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(detailCodes(result.failure)).toEqual(['policy.version-missing']);
    }
  });

  it('rejects an unsupported version', () => {
    for (const version of [2, '1', 1.5]) {
      const raw = structuredClone(loadTemplate()) as Record<string, unknown>;
      raw.version = version;
      const result = validatePolicy(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(detailCodes(result.failure)).toEqual(['policy.version-unsupported']);
      }
    }
  });

  it('maps unknown keys to policy.unknown-key with the key path', () => {
    const raw1 = structuredClone(loadTemplate()) as Record<string, unknown>;
    raw1.unknown_area = true;
    const result1 = validatePolicy(raw1);
    expect(result1.ok).toBe(false);
    if (!result1.ok) {
      const detail = result1.failure.details.find((d) => d.code === 'policy.unknown-key');
      expect(detail?.path).toBe('unknown_area');
    }

    const raw2 = structuredClone(loadTemplate()) as Record<string, Record<string, Record<string, unknown>>>;
    raw2.runner!.resources!.gpu = 1;
    const result2 = validatePolicy(raw2);
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      const detail = result2.failure.details.find((d) => d.code === 'policy.unknown-key');
      expect(detail?.path).toBe('runner.resources.gpu');
    }
  });

  it('maps missing keys to policy.missing-key', () => {
    const cases: [string[], string][] = [
      [['hygiene'], 'hygiene'],
      [['runner', 'resources', 'cpus'], 'runner.resources.cpus'],
      [['evidence', 'store', 'type'], 'evidence.store.type'],
    ];
    for (const [segments, expectedPath] of cases) {
      const raw = structuredClone(loadTemplate()) as Record<string, unknown>;
      let container: Record<string, unknown> = raw;
      for (let i = 0; i < segments.length - 1; i += 1) {
        container = container[segments[i] as string] as Record<string, unknown>;
      }
      delete container[segments[segments.length - 1] as string];
      const result = validatePolicy(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const detail = result.failure.details.find((d) => d.code === 'policy.missing-key');
        expect(detail?.path).toBe(expectedPath);
      }
    }
  });

  it('maps out-of-bounds limits to policy.limit-out-of-bounds', () => {
    for (const value of [5, 1.5, Infinity]) {
      const raw = structuredClone(loadTemplate()) as Record<string, Record<string, Record<string, unknown>>>;
      raw.runner!.resources!.cpus = value;
      const result = validatePolicy(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const detail = result.failure.details.find((d) => d.code === 'policy.limit-out-of-bounds');
        expect(detail?.path).toBe('runner.resources.cpus');
        expect(detail?.message).toContain('from 1 to 4');
      }
    }
  });

  it('maps wrong types and enum values to policy.invalid-value', () => {
    const raw1 = structuredClone(loadTemplate()) as Record<string, Record<string, unknown>>;
    raw1.modes!.default = 'loud';
    const result1 = validatePolicy(raw1);
    expect(result1.ok).toBe(false);
    if (!result1.ok) {
      expect(result1.failure.details.some((d) => d.code === 'policy.invalid-value' && d.path === 'modes.default')).toBe(true);
    }

    const raw2 = structuredClone(loadTemplate()) as Record<string, Record<string, unknown>>;
    raw2.hygiene!.report_flagged = 'yes';
    const result2 = validatePolicy(raw2);
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.failure.details.some((d) => d.code === 'policy.invalid-value' && d.path === 'hygiene.report_flagged')).toBe(
        true,
      );
    }
  });

  it('runs cross-field rules only on a structurally valid policy', () => {
    const raw1 = structuredClone(loadTemplate()) as Record<string, Record<string, unknown[]>>;
    (raw1.execution!.platforms![0] as Record<string, unknown>).commands = ['test', 'lint'];
    const result1 = validatePolicy(raw1);
    expect(result1.ok).toBe(false);
    if (!result1.ok) {
      expect(detailCodes(result1.failure)).toEqual(['policy.undeclared-reference']);
    }

    const raw2 = structuredClone(raw1) as Record<string, unknown>;
    raw2.unknown_area = true;
    const result2 = validatePolicy(raw2);
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(detailCodes(result2.failure)).toEqual(['policy.unknown-key']);
    }
  });

  it('rejects credential-like values without echoing them', () => {
    const secret = 's3cr3tvalue';
    const raw = structuredClone(loadTemplate()) as Record<string, Record<string, unknown>>;
    raw.supported_behavior!.description = 'Mirror: ' + 'https://' + 'deploy:' + secret + '@example.com/x';
    const result = validatePolicy(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(detailCodes(result.failure)).toEqual(['policy.credential-value']);
      expect(result.failure.details[0]?.path).toBe('supported_behavior.description');
      expect(JSON.stringify(result.failure)).not.toContain(secret);
    }
  });

  it('attaches line and column from the YAML layer', () => {
    const raw = structuredClone(loadTemplate()) as Record<string, Record<string, Record<string, unknown>>>;
    raw.runner!.resources!.gpu = 1;
    const text = stringify(raw);
    const bytes = new TextEncoder().encode(text);
    const result = validatePolicyBytes(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const detail = result.failure.details.find((d) => d.code === 'policy.unknown-key');
      expect(detail).toBeDefined();
      const lines = text.split('\n');
      const expectedLine = lines.findIndex((line) => line.trim().startsWith('gpu:')) + 1;
      expect(detail?.line).toBe(expectedLine);
      expect(typeof detail?.column).toBe('number');

      delete raw.runner!.resources!.gpu;
      delete (raw.hygiene! as unknown as Record<string, unknown>).report_flagged;
      const text2 = stringify(raw);
      const bytes2 = new TextEncoder().encode(text2);
      const result2 = validatePolicyBytes(bytes2);
      expect(result2.ok).toBe(false);
      if (!result2.ok) {
        const missing = result2.failure.details.find((d) => d.code === 'policy.missing-key' && d.path === 'hygiene.report_flagged');
        expect(missing?.line).not.toBeNull();
      }
    }
  });

  it('caps the error list at the validation maximum', () => {
    const raw = structuredClone(loadTemplate()) as Record<string, unknown>;
    for (let i = 0; i < 150; i += 1) {
      raw[`extra_key_${i}`] = true;
    }
    const result = validatePolicy(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.details.length).toBe(VALIDATION_ERRORS_MAX);
      expect(result.failure.message).toContain('150 error(s)');
    }
  });

  it('failure message states that no default was substituted', () => {
    const raw = structuredClone(loadTemplate()) as Record<string, unknown>;
    delete raw.version;
    const result = validatePolicy(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.message).toContain('No default was substituted');
      expect(result.failure.message).toContain('inconclusive');
    }
  });

  it('every failure has outcome inconclusive and cause policy-invalid and carries no policy', () => {
    const failures: unknown[] = [];

    const raw1 = structuredClone(loadTemplate()) as Record<string, unknown>;
    delete raw1.version;
    failures.push(validatePolicy(raw1));

    const raw2 = structuredClone(loadTemplate()) as Record<string, unknown>;
    raw2.version = 2;
    failures.push(validatePolicy(raw2));

    const raw3 = structuredClone(loadTemplate()) as Record<string, unknown>;
    raw3.unknown_area = true;
    failures.push(validatePolicy(raw3));

    for (const result of failures) {
      const r = result as { ok: boolean; failure: { outcome: string; cause: string } };
      expect(r.ok).toBe(false);
      expect(r.failure.outcome).toBe('inconclusive');
      expect(r.failure.cause).toBe('policy-invalid');
      expect(Object.hasOwn(r, 'value')).toBe(false);
    }
  });

  it('yaml failures pass through from validatePolicyBytes', () => {
    const bytes = new TextEncoder().encode('a: &x 1\nb: *x\n');
    const result = validatePolicyBytes(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('yaml.alias');
    }
  });
});

describe('scanPolicyCredentials', () => {
  it('is exported and callable', () => {
    expect(scanPolicyCredentials({})).toEqual([]);
  });
});

describe('parseStrictYamlDocument availability', () => {
  it('is importable for other tests', () => {
    expect(typeof parseStrictYamlDocument).toBe('function');
  });
});
