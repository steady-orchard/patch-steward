import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseStrictYaml } from '../strict-yaml.js';
import { POLICY_FILE_MAX_BYTES, POLICY_LIMITS, POLICY_YAML_MAX_DEPTH, POLICY_YAML_MAX_NODES } from './bounds.js';
import { POLICY_AREA_KEYS, policyEditorJsonSchema, policySchema, resolvedPolicySchema } from './schema.js';

function readTemplate(): unknown {
  const bytes = readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));
  const result = parseStrictYaml(bytes, {
    maxBytes: POLICY_FILE_MAX_BYTES,
    maxDepth: POLICY_YAML_MAX_DEPTH,
    maxNodes: POLICY_YAML_MAX_NODES,
  });
  if (!result.ok) {
    throw new Error(`template did not parse: ${result.failure.code}`);
  }
  return result.value;
}

function setAtPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index] as string;
    const next = cursor[segment];
    if (typeof next !== 'object' || next === null) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  const lastSegment = segments[segments.length - 1] as string;
  cursor[lastSegment] = value;
}

describe('policySchema', () => {
  it('template parses under the policy schema', () => {
    const raw = readTemplate();
    const result = policySchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it('template schema file deep-equals the live export', () => {
    const fromFile = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.schema.json', import.meta.url)), 'utf8'),
    );
    expect(fromFile).toEqual(policyEditorJsonSchema());
  });

  it('policy schema rejects unknown keys', () => {
    const raw = readTemplate() as Record<string, unknown>;
    const withTopLevelExtra = { ...raw, extra: 1 };
    const topResult = policySchema.safeParse(withTopLevelExtra);
    expect(topResult.success).toBe(false);
    const topCodes = topResult.success ? [] : topResult.error.issues.map((issue) => issue.code);
    expect(topCodes).toContain('unrecognized_keys');

    const clone = structuredClone(raw) as Record<string, unknown>;
    (clone.runner as Record<string, unknown>).resources = {
      ...((clone.runner as Record<string, unknown>).resources as Record<string, unknown>),
      extra: 1,
    };
    const nestedResult = policySchema.safeParse(clone);
    expect(nestedResult.success).toBe(false);
    const nestedCodes = nestedResult.success ? [] : nestedResult.error.issues.map((issue) => issue.code);
    expect(nestedCodes).toContain('unrecognized_keys');
  });

  it('policy schema applies documented defaults', () => {
    const raw = structuredClone(readTemplate()) as Record<string, unknown>;
    delete (raw.submission as Record<string, unknown>).free_form;
    delete (raw.submission as Record<string, unknown>).unrequested_change;
    delete (raw.runner as Record<string, unknown>).network;
    delete (raw.llm as Record<string, unknown>).admission;
    delete raw.policy_change;
    delete raw.labels;

    const result = policySchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.submission.free_form).toBe(false);
    expect(result.data.submission.unrequested_change).toBe('propose-first');
    expect(result.data.runner.network).toBe('none');
    expect(result.data.llm?.admission).toBe('all');
    expect(result.data.policy_change).toBe('enforced');
    expect(result.data.labels.status.queued).toBe('steward:queued');
    expect(result.data.labels.classification.uncertain).toBe('claim:uncertain');
  });

  it('policy schema keeps partial label overrides', () => {
    const raw = structuredClone(readTemplate()) as Record<string, unknown>;
    raw.labels = { status: { triage: 'needs-triage' } };

    const result = policySchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.labels.status.triage).toBe('needs-triage');
    expect(result.data.labels.status.queued).toBe('steward:queued');
    expect(result.data.labels.classification.duplicate).toBe('claim:duplicate');
  });

  it('policy schema enforces registered limit bounds', () => {
    const raw = structuredClone(readTemplate()) as Record<string, unknown>;
    const withValid = structuredClone(raw);
    (withValid.runner as Record<string, unknown>).resources = {
      ...((withValid.runner as Record<string, unknown>).resources as Record<string, unknown>),
      cpus: 4,
    };
    expect(policySchema.safeParse(withValid).success).toBe(true);

    const withTooHigh = structuredClone(raw);
    (withTooHigh.runner as Record<string, unknown>).resources = {
      ...((withTooHigh.runner as Record<string, unknown>).resources as Record<string, unknown>),
      cpus: 5,
    };
    expect(policySchema.safeParse(withTooHigh).success).toBe(false);

    const withTooLow = structuredClone(raw);
    (withTooLow.runner as Record<string, unknown>).resources = {
      ...((withTooLow.runner as Record<string, unknown>).resources as Record<string, unknown>),
      cpus: 0,
    };
    expect(policySchema.safeParse(withTooLow).success).toBe(false);

    const withFraction = structuredClone(raw);
    (withFraction.runner as Record<string, unknown>).resources = {
      ...((withFraction.runner as Record<string, unknown>).resources as Record<string, unknown>),
      cpus: 1.5,
    };
    expect(policySchema.safeParse(withFraction).success).toBe(false);
  });

  it('llm section is optional', () => {
    const raw = structuredClone(readTemplate()) as Record<string, unknown>;
    delete raw.llm;
    const result = policySchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.llm).toBeUndefined();
  });

  it('every registered limit path is used by the schema', () => {
    for (const row of POLICY_LIMITS) {
      const raw = structuredClone(readTemplate()) as Record<string, unknown>;
      setAtPath(raw, row.path, row.max + 1);
      const result = policySchema.safeParse(raw);
      expect(result.success).toBe(false);
      if (result.success) {
        continue;
      }
      const matched = result.error.issues.some((issue) => issue.path.join('.') === row.path);
      expect(matched).toBe(true);
    }
  });

  it('resolved policy schema accepts null llm and resolved dismissal codes', () => {
    const raw = readTemplate();
    const parsed = policySchema.parse(raw);
    const withNullLlm = { ...parsed, llm: null, dismissal_codes: [{ code: 'duplicate', definition: 'x', built_in: true }] };
    const result = resolvedPolicySchema.safeParse(withNullLlm);
    expect(result.success).toBe(true);

    const withoutLlm = { ...parsed, dismissal_codes: [{ code: 'duplicate', definition: 'x', built_in: true }] } as Record<
      string,
      unknown
    >;
    delete withoutLlm.llm;
    const missingResult = resolvedPolicySchema.safeParse(withoutLlm);
    expect(missingResult.success).toBe(false);
  });

  it('editor schema marks defaulted keys optional', () => {
    const schema = policyEditorJsonSchema() as {
      properties: {
        submission: { required?: string[] };
        runner: { properties: { resources: { properties: { cpus: { minimum: number; maximum: number } } } } };
      };
    };
    expect(schema.properties.submission.required ?? []).not.toContain('free_form');
    expect(schema.properties.runner.properties.resources.properties.cpus.minimum).toBe(1);
    expect(schema.properties.runner.properties.resources.properties.cpus.maximum).toBe(4);
  });

  it('policy area keys list the seventeen areas', () => {
    expect(POLICY_AREA_KEYS.length).toBe(17);
  });
});
