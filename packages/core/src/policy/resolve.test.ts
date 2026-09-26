import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseStrictYaml } from '../strict-yaml.js';
import { POLICY_FILE_MAX_BYTES, POLICY_YAML_MAX_DEPTH, POLICY_YAML_MAX_NODES } from './bounds.js';
import { builtInDismissalCatalog } from './catalog.js';
import { policySchema, resolvedPolicySchema } from './schema.js';
import { resolvePolicy } from './resolve.js';

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

describe('resolvePolicy', () => {
  it('resolves llm to null when absent', () => {
    const raw = structuredClone(readTemplateRaw()) as Record<string, unknown>;
    delete raw.llm;
    const policy = policySchema.parse(raw);
    const result = resolvePolicy(policy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.llm).toBeNull();
    }
  });

  it('keeps the llm section when present', () => {
    const raw = readTemplateRaw();
    const policy = policySchema.parse(raw);
    const result = resolvePolicy(policy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.llm?.provider).toBe('copilot-sdk');
    }
  });

  it('merges built-in dismissal codes before project additions', () => {
    const raw = structuredClone(readTemplateRaw()) as Record<string, unknown>;
    raw.dismissal_codes = [{ code: 'not-reproducible-upstream', definition: 'The defect is in an upstream dependency.' }];
    const policy = policySchema.parse(raw);
    const result = resolvePolicy(policy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const resolved = result.value.dismissal_codes;
      expect(resolved).toHaveLength(10);
      const builtIn = builtInDismissalCatalog();
      expect(resolved.slice(0, 9)).toEqual(builtIn);
      expect(resolved[9]).toEqual({
        code: 'not-reproducible-upstream',
        definition: 'The defect is in an upstream dependency.',
        built_in: false,
      });
    }
  });

  it('applies documented defaults for omitted keys', () => {
    const raw = structuredClone(readTemplateRaw()) as Record<string, unknown>;
    const submission = raw.submission as Record<string, unknown>;
    delete submission.free_form;
    delete submission.unrequested_change;
    const runner = raw.runner as Record<string, unknown>;
    delete runner.network;
    const llm = raw.llm as Record<string, unknown>;
    delete llm.admission;
    delete raw.policy_change;
    delete raw.labels;

    const policy = policySchema.parse(raw);
    const result = resolvePolicy(policy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const resolved = result.value;
      expect(resolved.submission.free_form).toBe(false);
      expect(resolved.submission.unrequested_change).toBe('propose-first');
      expect(resolved.runner.network).toBe('none');
      expect(resolved.llm?.admission).toBe('all');
      expect(resolved.policy_change).toBe('enforced');
      expect(resolved.labels.status.pass).toBe('steward:pass');
      expect(resolved.labels.classification.duplicate).toBe('claim:duplicate');
    }
  });

  it('keeps explicit values over defaults', () => {
    const raw = structuredClone(readTemplateRaw()) as Record<string, unknown>;
    raw.policy_change = 'manual';
    const submission = raw.submission as Record<string, unknown>;
    submission.free_form = true;

    const policy = policySchema.parse(raw);
    const result = resolvePolicy(policy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.policy_change).toBe('manual');
      expect(result.value.submission.free_form).toBe(true);
    }
  });

  it('resolved policy satisfies the resolved schema', () => {
    const raw = readTemplateRaw();
    const policy = policySchema.parse(raw);
    const result = resolvePolicy(policy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(resolvedPolicySchema.safeParse(result.value).success).toBe(true);
    }
  });

  it('resolve failure is a typed steward defect', () => {
    const raw = structuredClone(readTemplateRaw()) as Record<string, unknown>;
    raw.dismissal_codes = [{ code: 'x-code', definition: '' }];
    const policy = policySchema.parse(raw);
    const result = resolvePolicy(policy);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('policy.resolve-failed');
      expect(result.failure.cause).toBe('steward-defect');
      expect(result.failure.outcome).toBe('inconclusive');
    }
  });
});
