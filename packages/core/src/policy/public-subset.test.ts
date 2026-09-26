import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseStrictYaml } from '../strict-yaml.js';
import { POLICY_FILE_MAX_BYTES, POLICY_YAML_MAX_DEPTH, POLICY_YAML_MAX_NODES } from './bounds.js';
import { policySchema } from './schema.js';
import type { ResolvedPolicy } from './schema.js';
import { resolvePolicy } from './resolve.js';
import { PUBLIC_SUBSET_SECTION_IDS } from './catalog.js';
import { derivePublicSubset, publicSubsetSchema } from './public-subset.js';

const REVISION = 'a'.repeat(40);

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

function resolvedWithPagesEnabled(): ResolvedPolicy {
  const raw = structuredClone(readTemplateRaw()) as Record<string, unknown>;
  const evidence = raw.evidence as Record<string, unknown>;
  const publication = evidence.publication as Record<string, unknown>;
  publication.pages = true;
  const policy = policySchema.parse(raw);
  const result = resolvePolicy(policy);
  if (!result.ok) {
    throw new Error('failed to resolve template policy');
  }
  return result.value;
}

describe('public subset', () => {
  it('public subset top-level keys are section ids or envelope fields', () => {
    const resolved = resolvedWithPagesEnabled();
    const result = derivePublicSubset(resolved, REVISION, 'public');
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.enabled) {
      throw new Error('expected enabled subset');
    }
    const subset = result.value.subset;
    for (const key of Object.keys(subset)) {
      expect(key === 'schema_version' || key === 'revision' || (PUBLIC_SUBSET_SECTION_IDS as readonly string[]).includes(key)).toBe(
        true,
      );
    }
    for (const sectionId of PUBLIC_SUBSET_SECTION_IDS) {
      expect(Object.prototype.hasOwnProperty.call(subset, sectionId)).toBe(true);
    }
  });

  it('public subset omits excluded sections', () => {
    const resolved = resolvedWithPagesEnabled();
    const withExclusions: ResolvedPolicy = {
      ...resolved,
      evidence: {
        ...resolved.evidence,
        publication: {
          ...resolved.evidence.publication,
          exclude: ['modes', 'dismissal_codes'],
        },
      },
    };
    const result = derivePublicSubset(withExclusions, REVISION, 'public');
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.enabled) {
      throw new Error('expected enabled subset');
    }
    const subset = result.value.subset;
    expect(Object.prototype.hasOwnProperty.call(subset, 'modes')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(subset, 'dismissal_codes')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(subset, 'categories')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(subset, 'evidence_requirements')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(subset, 'unrequested_change')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(subset, 'attachment_caps')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(subset, 'supported_versions')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(subset, 'inference_admission')).toBe(true);
  });

  it('public subset is disabled for a private repository unless both publication keys are true', () => {
    const resolved = resolvedWithPagesEnabled();
    const withoutPrivate: ResolvedPolicy = {
      ...resolved,
      evidence: {
        ...resolved.evidence,
        publication: { ...resolved.evidence.publication, private_repository: false },
      },
    };
    const disabledResult = derivePublicSubset(withoutPrivate, REVISION, 'private');
    expect(disabledResult.ok).toBe(true);
    if (disabledResult.ok) {
      expect(disabledResult.value).toEqual({ enabled: false, reason: 'private-repository' });
    }

    const withPrivate: ResolvedPolicy = {
      ...resolved,
      evidence: {
        ...resolved.evidence,
        publication: { ...resolved.evidence.publication, private_repository: true },
      },
    };
    const enabledResult = derivePublicSubset(withPrivate, REVISION, 'private');
    expect(enabledResult.ok).toBe(true);
    if (enabledResult.ok) {
      expect(enabledResult.value.enabled).toBe(true);
    }
  });

  it('public subset is disabled when pages is false', () => {
    const raw = structuredClone(readTemplateRaw()) as Record<string, unknown>;
    const policy = policySchema.parse(raw);
    const resolvedResult = resolvePolicy(policy);
    if (!resolvedResult.ok) {
      throw new Error('failed to resolve template policy');
    }
    const result = derivePublicSubset(resolvedResult.value, REVISION, 'public');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ enabled: false, reason: 'pages-disabled' });
    }
  });

  it('public subset omits canary non-public values', () => {
    const resolved = resolvedWithPagesEnabled();
    const canary: ResolvedPolicy = {
      ...resolved,
      runner: {
        ...resolved.runner,
        image: { source: 'registry', reference: 'canary.example.com/runner-canary:1' },
      },
      llm: resolved.llm === null ? null : { ...resolved.llm, model: 'canary-model-id' },
      hygiene: { ...resolved.hygiene, allowlist: ['canary-login'] },
      evidence: {
        ...resolved.evidence,
        redaction_patterns: [{ id: 'canary', pattern: 'canary-redaction-[0-9]+' }],
      },
      escalation: { ...resolved.escalation, security_terms: ['canary-escalation-term'] },
      supported_behavior: {
        ...resolved.supported_behavior,
        design_rules: [{ id: 'canary-rule', rule: 'canary design rule text' }],
        versions: [{ version: '2.x', supported: true, branch: 'canary-branch', support_ends: null }],
      },
    };
    const result = derivePublicSubset(canary, REVISION, 'public');
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.enabled) {
      throw new Error('expected enabled subset');
    }
    const serialized = JSON.stringify(result.value.subset);
    expect(serialized).not.toContain('runner-canary');
    expect(serialized).not.toContain('canary-model-id');
    expect(serialized).not.toContain('canary-login');
    expect(serialized).not.toContain('canary-redaction');
    expect(serialized).not.toContain('canary-escalation-term');
    expect(serialized).not.toContain('canary design rule text');
    expect(serialized).not.toContain('canary-branch');
    expect(serialized).toContain('2.x');
  });

  it('public subset derives draft guidance from effective modes', () => {
    const resolved = resolvedWithPagesEnabled();
    const withModes: ResolvedPolicy = {
      ...resolved,
      modes: {
        default: 'observe',
        per_category: { ...resolved.modes.per_category, bugfix: 'enforce' },
      },
    };
    const result = derivePublicSubset(withModes, REVISION, 'public');
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.enabled) {
      throw new Error('expected enabled subset');
    }
    expect(result.value.subset.modes?.per_category.bugfix).toEqual({ mode: 'enforce', promotes_passed_draft: true });
    expect(result.value.subset.modes?.per_category.docs).toEqual({ mode: 'observe', promotes_passed_draft: false });
  });

  it('public subset reports null inference admission without llm', () => {
    const resolved = resolvedWithPagesEnabled();
    const withoutLlm: ResolvedPolicy = { ...resolved, llm: null };
    const result = derivePublicSubset(withoutLlm, REVISION, 'public');
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.enabled) {
      throw new Error('expected enabled subset');
    }
    expect(result.value.subset.inference_admission).toBeNull();
  });

  it('public subset lists built-in and project dismissal codes with definitions', () => {
    const resolved = resolvedWithPagesEnabled();
    const result = derivePublicSubset(resolved, REVISION, 'public');
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.enabled) {
      throw new Error('expected enabled subset');
    }
    const codes = result.value.subset.dismissal_codes;
    expect(codes).toBeDefined();
    expect(codes?.length).toBe(resolved.dismissal_codes.length);
    expect(codes?.some((entry) => entry.built_in)).toBe(true);
    for (const entry of codes ?? []) {
      expect(typeof entry.definition).toBe('string');
      expect(entry.definition.length).toBeGreaterThan(0);
    }
  });

  it('public subset validates against its own schema', () => {
    const resolved = resolvedWithPagesEnabled();
    const result = derivePublicSubset(resolved, REVISION, 'public');
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.enabled) {
      throw new Error('expected enabled subset');
    }
    expect(publicSubsetSchema.safeParse(result.value.subset).success).toBe(true);
    const withExtra = { ...result.value.subset, extra_key: 'not-allowed' };
    expect(publicSubsetSchema.safeParse(withExtra).success).toBe(false);
  });
});
