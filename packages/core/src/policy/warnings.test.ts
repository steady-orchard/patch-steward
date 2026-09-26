import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseStrictYaml } from '../strict-yaml.js';
import { POLICY_FILE_MAX_BYTES, POLICY_YAML_MAX_DEPTH, POLICY_YAML_MAX_NODES } from './bounds.js';
import { LLM_MODEL_PLACEHOLDER } from './catalog.js';
import { policySchema } from './schema.js';
import { resolvePolicy } from './resolve.js';
import { policyWarnings } from './warnings.js';

function readTemplateRaw(): unknown {
  const bytes = readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));
  const parsed = parseStrictYaml(bytes, {
    maxBytes: POLICY_FILE_MAX_BYTES,
    maxDepth: POLICY_YAML_MAX_DEPTH,
    maxNodes: POLICY_YAML_MAX_NODES,
  });
  if (!parsed.ok) {
    throw new Error(`failed to parse template policy: ${parsed.failure.message}`);
  }
  return parsed.value;
}

describe('policyWarnings', () => {
  it('placeholder model yields exactly one placeholder warning', () => {
    const raw = readTemplateRaw();
    const policy = policySchema.parse(raw);
    const result = resolvePolicy(policy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const warnings = policyWarnings(result.value);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.code).toBe('policy.llm-model-placeholder');
      expect(warnings[0]?.path).toBe('llm.model');
      expect(warnings[0]?.message).toContain('inconclusive');
    }
  });

  it('other model id yields no warning', () => {
    const raw = structuredClone(readTemplateRaw()) as Record<string, unknown>;
    const llm = raw.llm as Record<string, unknown>;
    llm.model = 'example-copilot-model';
    const policy = policySchema.parse(raw);
    const result = resolvePolicy(policy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(policyWarnings(result.value)).toEqual([]);
    }
  });

  it('absent llm yields no warning', () => {
    const raw = structuredClone(readTemplateRaw()) as Record<string, unknown>;
    delete raw.llm;
    const policy = policySchema.parse(raw);
    const result = resolvePolicy(policy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(policyWarnings(result.value)).toEqual([]);
    }
  });

  it('template llm.model equals the exported placeholder constant', () => {
    const raw = readTemplateRaw() as Record<string, unknown>;
    const llm = raw.llm as Record<string, unknown>;
    expect(llm.model).toBe(LLM_MODEL_PLACEHOLDER);
  });

  it('model ids that merely contain the placeholder yield no warning', () => {
    const raw = structuredClone(readTemplateRaw()) as Record<string, unknown>;
    const llm = raw.llm as Record<string, unknown>;
    llm.model = 'replace-with-model-id-2';
    const policy = policySchema.parse(raw);
    const result = resolvePolicy(policy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(policyWarnings(result.value)).toEqual([]);
    }
  });
});
