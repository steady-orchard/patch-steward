import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { POLICY_FILE_MAX_BYTES, POLICY_LIMITS, POLICY_YAML_MAX_DEPTH, POLICY_YAML_MAX_NODES } from './bounds.js';
import { validatePolicy } from './validate.js';
import { parseStrictYaml } from '../strict-yaml.js';

const templateBytes = readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));

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

function openaiBase(): Record<string, unknown> {
  const base = structuredClone(loadRawTemplate());
  base.llm = {
    provider: 'openai-compatible',
    model: 'example-openai-model',
    auth: { type: 'env' },
    options: { base_url: 'https://llm.example.com/v1' },
    generation: { temperature: null },
    required_capabilities: { structured_output: 'any' },
    admission: 'all',
    limits: {
      model_calls_per_run: 40,
      retries_per_call: 2,
      repair_attempts_per_session: 1,
      call_seconds: 120,
      daily_inference_runs: 30,
      tokens_per_run: 400000,
      output_tokens_per_call: 4096,
    },
  };
  return base;
}

function baseFor(provider: 'copilot-sdk' | 'openai-compatible' | null): Record<string, unknown> {
  return provider === 'openai-compatible' ? openaiBase() : structuredClone(loadRawTemplate());
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let node: Record<string, unknown> = obj;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (segment === undefined) {
      throw new Error(`bad path ${path}`);
    }
    node = node[segment] as Record<string, unknown>;
  }
  const last = segments[segments.length - 1];
  if (last === undefined) {
    throw new Error(`bad path ${path}`);
  }
  node[last] = value;
}

const rows = [...POLICY_LIMITS];

describe('policy limit bounds', () => {
  it.each(rows)('limit $path accepts the hard maximum', (row) => {
    const raw = baseFor(row.provider);
    setPath(raw, row.path, row.max);
    const result = validatePolicy(raw);
    expect(result.ok).toBe(true);
  });

  it.each(rows)('limit $path rejects the hard maximum plus one', (row) => {
    const raw = baseFor(row.provider);
    setPath(raw, row.path, row.max + 1);
    const result = validatePolicy(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.details).toContainEqual(
        expect.objectContaining({ code: 'policy.limit-out-of-bounds', path: row.path }),
      );
    }
  });

  it.each(rows)('limit $path rejects the minimum minus one', (row) => {
    const raw = baseFor(row.provider);
    setPath(raw, row.path, row.min - 1);
    const result = validatePolicy(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.details).toContainEqual(
        expect.objectContaining({ code: 'policy.limit-out-of-bounds', path: row.path }),
      );
    }
  });

  it.each(rows)('limit $path rejects a non-integer', (row) => {
    const raw = baseFor(row.provider);
    setPath(raw, row.path, row.min + 0.5);
    const result = validatePolicy(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.details).toContainEqual(
        expect.objectContaining({ code: 'policy.limit-out-of-bounds', path: row.path }),
      );
    }
  });

  it('openai base passes validation', () => {
    const raw = openaiBase();
    const result = validatePolicy(raw);
    expect(result.ok).toBe(true);
  });
});
