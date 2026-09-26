import { readFileSync } from 'node:fs';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  applyRedactionRules,
  BUILT_IN_DETECTORS,
  GIT_OUTPUT_MAX_BYTES,
  GIT_TIMEOUT_MS,
  loadPolicy,
  parseStrictYaml,
  POLICY_FILE_MAX_BYTES,
  POLICY_LIMITS,
  policyEditorJsonSchema,
  redactionMarker,
  redactText,
  REDACTION_INPUT_MAX_BYTES,
  validatePolicy,
} from '../index.js';
import type { PolicyLimit } from '../index.js';
import type { ProcessOutput, ProcessRunner } from '../index.js';

const templateBytes = readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));

function loadTemplateRaw(): Record<string, unknown> {
  const result = parseStrictYaml(templateBytes, {
    maxBytes: POLICY_FILE_MAX_BYTES,
    maxDepth: 32,
    maxNodes: 20000,
  });
  if (!result.ok) {
    throw new Error('template failed to parse');
  }
  return result.value as Record<string, unknown>;
}

function openaiBase(): Record<string, unknown> {
  const base = structuredClone(loadTemplateRaw());
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
  return provider === 'openai-compatible' ? openaiBase() : structuredClone(loadTemplateRaw());
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

const FORBIDDEN_SCHEMA_KEYS = new Set(['$ref', '$defs', 'definitions', 'patternProperties', 'prefixItems', 'if', 'not']);

function collectForbiddenKeys(node: unknown, violations: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectForbiddenKeys(item, violations);
    }
    return;
  }
  if (node !== null && typeof node === 'object') {
    for (const key of Object.keys(node as Record<string, unknown>)) {
      if (FORBIDDEN_SCHEMA_KEYS.has(key)) {
        violations.push(key);
      }
      collectForbiddenKeys((node as Record<string, unknown>)[key], violations);
    }
  }
}

function isSchemaNode(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

interface NumericBounds {
  readonly min: unknown;
  readonly max: unknown;
}

function walkSchema(
  node: unknown,
  path: string,
  integers: Map<string, NumericBounds>,
  numbers: Set<string>,
  mismatches: string[],
): void {
  if (!isSchemaNode(node)) {
    return;
  }

  if (node.type === 'integer') {
    const bounds: NumericBounds = { min: node.minimum, max: node.maximum };
    const existing = integers.get(path);
    if (existing !== undefined && (existing.min !== bounds.min || existing.max !== bounds.max)) {
      mismatches.push(path);
    } else {
      integers.set(path, bounds);
    }
  }

  if (node.type === 'number') {
    numbers.add(path);
  }

  const properties = node.properties;
  if (isSchemaNode(properties)) {
    for (const [key, value] of Object.entries(properties)) {
      walkSchema(value, path === '' ? key : `${path}.${key}`, integers, numbers, mismatches);
    }
  }

  if (node.items !== undefined) {
    walkSchema(node.items, path === '' ? '*' : `${path}.*`, integers, numbers, mismatches);
  }

  for (const comboKey of ['anyOf', 'oneOf'] as const) {
    const combo = node[comboKey];
    if (Array.isArray(combo)) {
      for (const variant of combo) {
        walkSchema(variant, path, integers, numbers, mismatches);
      }
    }
  }

  const additionalProperties = node.additionalProperties;
  if (isSchemaNode(additionalProperties)) {
    walkSchema(additionalProperties, path === '' ? '*' : `${path}.*`, integers, numbers, mismatches);
  }
}

const DETECTOR_SAMPLES: Readonly<Record<string, string>> = {
  'github-token': 'ghp_' + 'A1b2C3d4'.repeat(4) + 'E5f6',
  'private-key': '-----BEGIN ' + 'RSA PRIVATE KEY-----\nMIIEow' + 'IBAAKCAQEA\n-----END ' + 'RSA PRIVATE KEY-----',
  'aws-access-key-id': 'AKIA' + 'ABCDEFGHIJKLMNOP',
  'provider-api-key': 'sk-' + 'proj-' + 'a'.repeat(24),
  jwt: 'eyJ' + 'hbGciOiJIUzI1NiJ9' + '.' + 'eyJzdWIiOiIxMjM0In0' + '.' + 'abcdefghijKLMNOP',
  'authorization-header': 'Authorization: ' + 'Basic ' + 'dXNlcjpwYXNzd29yZA==',
  'bearer-token': 'Bearer ' + 'abcdefghijklmnopqrstuvwxyz012345',
  'url-credentials': 'https://' + 'deploy:' + 's3cr3tvalue' + '@example.com/repo.git',
};

describe('invariant 7: bounds', () => {
  it('invariant 7: every integer key of the policy schema has a registered bound', () => {
    const schema = policyEditorJsonSchema();
    const forbidden: string[] = [];
    collectForbiddenKeys(schema, forbidden);
    expect(forbidden).toEqual([]);

    const integers = new Map<string, NumericBounds>();
    const numbers = new Set<string>();
    const mismatches: string[] = [];
    walkSchema(schema, '', integers, numbers, mismatches);
    expect(mismatches).toEqual([]);

    const schemaPaths = [...integers.keys()].sort();
    const limitPaths = POLICY_LIMITS.map((row) => row.path).sort();
    expect(schemaPaths).toEqual(limitPaths);

    for (const row of POLICY_LIMITS) {
      const bounds = integers.get(row.path);
      expect(bounds).toEqual({ min: row.min, max: row.max });
    }
  });

  it('invariant 7: the only non-integer numbers in the policy schema are version and llm.generation.temperature', () => {
    const schema = policyEditorJsonSchema();
    const integers = new Map<string, NumericBounds>();
    const numbers = new Set<string>();
    const mismatches: string[] = [];
    walkSchema(schema, '', integers, numbers, mismatches);

    const numberPaths = [...numbers].sort();
    expect(numberPaths).toEqual(['llm.generation.temperature', 'version']);
  });

  it.each(POLICY_LIMITS.map((row) => row.path))('invariant 7: limit %s accepts the hard maximum', (path) => {
    const row = POLICY_LIMITS.find((candidate) => candidate.path === path) as PolicyLimit;
    const raw = baseFor(row.provider);
    setPath(raw, path, row.max);
    const result = validatePolicy(raw);
    expect(result.ok).toBe(true);
  });

  it.each(POLICY_LIMITS.map((row) => row.path))('invariant 7: limit %s rejects the hard maximum plus one', (path) => {
    const row = POLICY_LIMITS.find((candidate) => candidate.path === path) as PolicyLimit;
    const raw = baseFor(row.provider);
    setPath(raw, path, row.max + 1);
    const result = validatePolicy(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.details).toContainEqual(expect.objectContaining({ code: 'policy.limit-out-of-bounds', path }));
    }
  });

  it.each(POLICY_LIMITS.map((row) => row.path))('invariant 7: limit %s rejects the minimum minus one', (path) => {
    const row = POLICY_LIMITS.find((candidate) => candidate.path === path) as PolicyLimit;
    const raw = baseFor(row.provider);
    setPath(raw, path, row.min - 1);
    const result = validatePolicy(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.details).toContainEqual(expect.objectContaining({ code: 'policy.limit-out-of-bounds', path }));
    }
  });
});

describe('invariant 7: redaction', { timeout: 30000 }, () => {
  it('invariant 7: every built-in detector has a redaction sample', () => {
    const detectorIds = BUILT_IN_DETECTORS.map((detector) => detector.id).sort();
    const sampleIds = Object.keys(DETECTOR_SAMPLES).sort();
    expect(detectorIds).toEqual(sampleIds);
  });

  it.each(BUILT_IN_DETECTORS.map((detector) => detector.id))('invariant 7: built-in detector %s redacts its sample', async (id) => {
    const sample = DETECTOR_SAMPLES[id] as string;
    const result = await redactText(`before ${sample} after`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toContain(redactionMarker(id));
      expect(result.value.text).not.toContain(sample);
      expect(result.value.counts).toContainEqual({ id, count: 1 });
    }
  });

  it('invariant 7: redaction fails closed on the size bound', async () => {
    const result = await redactText('x'.repeat(11), { maxInputBytes: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('redaction.input-too-large');
      expect(result.failure.outcome).toBe('inconclusive');
    }
    expect('value' in result).toBe(false);
  });

  it('invariant 7: redaction fails closed on the time bound', async () => {
    const result = await applyRedactionRules(
      'a'.repeat(40) + '!',
      [{ id: 'catastrophic', kind: 'regex', value: '(a+)+$', flags: 'g' }],
      { maxInputBytes: 1024, timeoutMs: 200 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('redaction.timeout');
      expect(result.failure.outcome).toBe('inconclusive');
    }
    expect('value' in result).toBe(false);
  });

  it('invariant 7: caller bounds cannot raise the redaction bounds', async () => {
    const result = await redactText('x'.repeat(REDACTION_INPUT_MAX_BYTES + 1), { maxInputBytes: 10 ** 12 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('redaction.input-too-large');
    }
  });
});

describe('invariant 7: git bounds', { timeout: 30000 }, () => {
  it('invariant 7: git calls run under the steward timeout and output bounds', async () => {
    const commit = 'a'.repeat(40);
    const treeId = 'b'.repeat(40);
    const blobId = 'c'.repeat(40);
    const repoDir = os.tmpdir();

    const calls: { args: readonly string[]; timeoutMs: number | undefined; maxOutputBytes: number | undefined }[] = [];

    const runner: ProcessRunner = async (_binary, args, options) => {
      calls.push({ args, timeoutMs: options.timeoutMs, maxOutputBytes: options.maxOutputBytes });

      const output = (exitCode: number, stdout: Buffer): ProcessOutput => ({ exitCode, stdout, stderr: Buffer.alloc(0) });

      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return { ok: true, value: output(0, Buffer.from('.git\n')) };
      }
      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        return { ok: true, value: output(0, Buffer.from(`${commit}\n`)) };
      }
      if (args[0] === 'ls-tree' && args.includes('.github/patch-steward')) {
        return { ok: true, value: output(0, Buffer.from(`040000 tree ${treeId}\t.github/patch-steward\u0000`)) };
      }
      if (args[0] === 'ls-tree' && args.includes('-r')) {
        return {
          ok: true,
          value: output(0, Buffer.from(`100644 blob ${blobId} ${templateBytes.length}\tpolicy.yml\u0000`)),
        };
      }
      if (args[0] === 'cat-file') {
        return { ok: true, value: output(0, Buffer.from(templateBytes)) };
      }
      throw new Error(`unexpected git call: ${args.join(' ')}`);
    };

    const result = await loadPolicy({ kind: 'git', repoDir, ref: 'main' }, { runner });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(5);
    for (const call of calls) {
      expect(call.timeoutMs).toBe(GIT_TIMEOUT_MS);
      expect(call.maxOutputBytes).toBeLessThanOrEqual(GIT_OUTPUT_MAX_BYTES);
    }
    const catFileCall = calls.find((call) => call.args[0] === 'cat-file');
    expect(catFileCall?.maxOutputBytes).toBe(POLICY_FILE_MAX_BYTES);
  });
});
