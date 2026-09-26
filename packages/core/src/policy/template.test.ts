import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findPolicyLimit, POLICY_LIMITS } from './bounds.js';
import { BUILT_IN_DISMISSAL_DEFINITIONS, LLM_MODEL_PLACEHOLDER } from './catalog.js';
import { POLICY_AREA_KEYS } from './schema.js';
import { resolvePolicy } from './resolve.js';
import { validatePolicyBytes } from './validate.js';
import { findCredentialDetector } from '../redaction/detectors.js';
import { BUILT_IN_DISMISSAL_CODES } from '../vocabulary.js';
import { parseStrictYaml } from '../strict-yaml.js';
import { POLICY_FILE_MAX_BYTES, POLICY_YAML_MAX_DEPTH, POLICY_YAML_MAX_NODES } from './bounds.js';

const templateBytes = readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));
const templateText = new TextDecoder('utf-8').decode(templateBytes);

function loadRawTemplate(): Record<string, unknown> {
  const result = parseStrictYaml(templateBytes, {
    maxBytes: POLICY_FILE_MAX_BYTES,
    maxDepth: POLICY_YAML_MAX_DEPTH,
    maxNodes: POLICY_YAML_MAX_NODES,
  });
  if (!result.ok) {
    throw new Error('template failed to parse');
  }
  return result.value as Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

interface PathCheck {
  readonly path: string;
  readonly present: boolean;
}

function checkPaths(resolved: unknown, raw: unknown, segments: readonly string[], results: PathCheck[]): void {
  if (isPlainObject(resolved)) {
    for (const key of Object.keys(resolved)) {
      const value = resolved[key];
      if (value === undefined) {
        continue;
      }
      const newSegments = [...segments, key];
      const path = newSegments.join('.');
      const present = isPlainObject(raw) && Object.hasOwn(raw, key);
      results.push({ path, present });
      if (path === 'dismissal_codes') {
        continue;
      }
      checkPaths(value, present ? raw[key] : undefined, newSegments, results);
    }
    return;
  }
  if (Array.isArray(resolved)) {
    resolved.forEach((item, index) => {
      const newSegments = [...segments, String(index)];
      const path = newSegments.join('.');
      const present = Array.isArray(raw) && index < raw.length;
      results.push({ path, present });
      checkPaths(item, present ? (raw as unknown[])[index] : undefined, newSegments, results);
    });
  }
}

describe('policy template', () => {
  it('template validates', () => {
    const validated = validatePolicyBytes(templateBytes);
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      return;
    }
    const resolved = resolvePolicy(validated.value);
    expect(resolved.ok).toBe(true);
  });

  it('template represents every policy area', () => {
    const raw = loadRawTemplate();
    for (const key of [...POLICY_AREA_KEYS, 'version', 'labels']) {
      expect(Object.hasOwn(raw, key)).toBe(true);
    }
  });

  it('template writes every key explicitly', () => {
    const raw = loadRawTemplate();
    const validated = validatePolicyBytes(templateBytes);
    if (!validated.ok) {
      throw new Error('template failed to validate');
    }
    const resolved = resolvePolicy(validated.value);
    if (!resolved.ok) {
      throw new Error('template failed to resolve');
    }
    const results: PathCheck[] = [];
    checkPaths(resolved.value as unknown, raw, [], results);
    const missing = results.filter((result) => !result.present);
    expect(missing).toEqual([]);
  });

  it('template holds no credential-like string', () => {
    const raw = loadRawTemplate();

    function walk(node: unknown): void {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (isPlainObject(node)) {
        for (const key of Object.keys(node)) {
          expect(findCredentialDetector(key)).toBeNull();
          walk(node[key]);
        }
        return;
      }
      if (typeof node === 'string') {
        expect(findCredentialDetector(node)).toBeNull();
      }
    }

    walk(raw);

    const lines = templateText.split('\n').map((line) => line.replace(/\r$/, ''));
    for (const line of lines) {
      expect(findCredentialDetector(line)).toBeNull();
    }
  });

  it('template llm.auth holds only type', () => {
    const raw = loadRawTemplate();
    const llm = raw.llm as Record<string, unknown>;
    const auth = llm.auth as Record<string, unknown>;
    expect(Object.keys(auth)).toEqual(['type']);
    expect(auth.type).toBe('github-token');
  });

  it('template comments list every built-in dismissal definition', () => {
    const text = templateText.replace(/\r/g, '');
    for (const code of BUILT_IN_DISMISSAL_CODES) {
      const expectedLine = `# - ${code}: ${BUILT_IN_DISMISSAL_DEFINITIONS[code]}`;
      expect(text).toContain(expectedLine);
    }
  });

  it('template limit values equal the approved template values', () => {
    const raw = loadRawTemplate();
    for (const row of POLICY_LIMITS) {
      if (row.provider !== null && row.provider !== 'copilot-sdk') {
        continue;
      }
      const registered = findPolicyLimit(row.path);
      expect(registered).toBeDefined();
      let node: unknown = raw;
      for (const segment of row.path.split('.')) {
        expect(isPlainObject(node)).toBe(true);
        node = (node as Record<string, unknown>)[segment];
      }
      expect(node).toBe(row.templateValue);
    }
  });

  it('template llm.model is the placeholder', () => {
    const raw = loadRawTemplate();
    const llm = raw.llm as Record<string, unknown>;
    expect(llm.model).toBe(LLM_MODEL_PLACEHOLDER);
  });
});
