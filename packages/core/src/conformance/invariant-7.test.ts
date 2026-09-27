import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import { join } from 'node:path';
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
import { fixedClock, fixedRandom } from '../clock.js';
import type { GitHubFetch } from '../github/client.js';
import { screenSubmission } from '../pipeline/screen.js';
import type { ScreenDeps } from '../pipeline/screen.js';
import type { RunEvidenceOptions } from '../evidence/publish.js';
import type { EvidenceRedactFn } from '../evidence/redact-records.js';
import { exactValueForms, redactTexts } from '../redaction/redact.js';
import { CHECK_SUMMARY_MAX_LENGTH, REPORT_MAX_LENGTH } from '../policy/bounds.js';
import { REPORT_TITLE } from '../report/templates.js';
import { reportStaticBudget } from '../report/caps.js';
import { err, ok } from '../result.js';

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
  'npm-token': 'npm_' + 'A1b2C3d4E5'.repeat(3) + 'F6g7H8',
  'pypi-token': 'pypi-' + 'AgE' + 'IcHlwaS5vcmc'.repeat(5),
  'gitlab-token': 'glpat' + '-' + 'A1b2C3d4E5f6G7h8I9j0',
  'slack-token': 'xox' + 'b-' + '1234567890-' + 'abcdefghij',
  'slack-webhook': 'https://hooks.' + 'slack.com/services/' + 'T0000AAAA/B0000BBBB/' + 'C1d2E3f4G5h6I7j8K9l0M1n2',
  'stripe-key': 'sk' + '_live_' + 'A1b2C3d4E5f6G7h8',
  'stripe-webhook-secret': 'whsec' + '_' + 'A1b2C3d4'.repeat(3),
  'google-api-key': 'AIza' + 'Sy' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6q',
  'google-oauth-client-secret': 'GOCSPX' + '-' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4',
  'google-oauth-access-token': 'ya29' + '.' + 'A1b2C3d4E5f6G7h8I9j0',
  'huggingface-token': 'hf' + '_' + 'AbCdEfGhIj'.repeat(3) + 'KlMn',
  'docker-hub-token': 'dckr' + '_pat_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n',
  'sendgrid-key': 'SG' + '.' + 'A1b2C3d4E5f6G7h8I9j0K1' + '.' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v',
  'shopify-token': 'shp' + 'at_' + 'a1b2c3d4'.repeat(4),
  'digitalocean-token': 'do' + 'p_v1_' + 'a1b2c3d4'.repeat(8),
};

const NEW_DETECTOR_IDS: readonly string[] = [
  'npm-token',
  'pypi-token',
  'gitlab-token',
  'slack-token',
  'slack-webhook',
  'stripe-key',
  'stripe-webhook-secret',
  'google-api-key',
  'google-oauth-client-secret',
  'google-oauth-access-token',
  'huggingface-token',
  'docker-hub-token',
  'sendgrid-key',
  'shopify-token',
  'digitalocean-token',
];

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

  it.each(NEW_DETECTOR_IDS)('invariant 7: policy validation rejects detector sample %s', (id) => {
    const sample = DETECTOR_SAMPLES[id] as string;
    const raw = structuredClone(loadTemplateRaw());
    (raw.supported_behavior as Record<string, unknown>).description = 'Mirror ' + sample;
    const result = validatePolicy(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.details).toContainEqual(
        expect.objectContaining({
          code: 'policy.credential-value',
          path: 'supported_behavior.description',
          message: expect.stringContaining(`(${id})`),
        }),
      );
      expect(JSON.stringify(result.failure)).not.toContain(sample);
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

const SENTINEL = 'sentinel-' + 'Q7wZ'.repeat(6);

const REPO = { owner: 'octo', name: 'demo' };
const HEAD_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);

function policyFixturePath(): string {
  return fileURLToPath(new URL('../../../../fixtures/policies/valid/minimal-no-llm.yml', import.meta.url));
}

function prBodyFixturePath(): string {
  return fileURLToPath(new URL('../../../../fixtures/submissions/pr-bugfix-complete.txt', import.meta.url));
}

function prBody(): string {
  return readFileSync(prBodyFixturePath(), 'utf8').replace(/\r\n/g, '\n');
}

function baseRoutes(body: string): Record<string, unknown> {
  return {
    '/repos/octo/demo': { full_name: 'octo/demo', default_branch: 'main', private: false },
    '/repos/octo/demo/pulls/40': {
      number: 40,
      title: 'pr title',
      body,
      state: 'open',
      draft: false,
      head: { sha: HEAD_SHA, ref: 'feature' },
      base: { sha: BASE_SHA, ref: 'main' },
      user: { login: 'someone', id: 1, type: 'User' },
      author_association: 'NONE',
      changed_files: 1,
    },
    '/repos/octo/demo/pulls/40/files': [{ filename: 'src/parse.ts', status: 'modified' }],
    '/repos/octo/demo/issues/29': {
      number: 29,
      title: 't',
      body: 'The parser crashes on empty input.',
      state: 'open',
      user: null,
      author_association: 'NONE',
    },
    [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: [],
  };
}

function makeInvariant7Fetch(routes: Record<string, unknown>): GitHubFetch {
  return (url: string) => {
    const pathname = new URL(url).pathname;
    if (!(pathname in routes)) {
      return Promise.resolve(new Response('{}', { status: 404 }));
    }
    return Promise.resolve(new Response(JSON.stringify(routes[pathname]), { status: 200 }));
  };
}

function makeInvariant7Deps(overrides: {
  readonly evidenceDir: string;
  readonly fetch: GitHubFetch;
  readonly token?: string | null;
  readonly policyPath?: string;
  readonly evidence?: RunEvidenceOptions;
}): ScreenDeps {
  return {
    repository: REPO,
    submission: { type: 'pull_request', number: 40 },
    policySource: { kind: 'local-file', path: overrides.policyPath ?? policyFixturePath() },
    token: overrides.token ?? null,
    evidenceDir: overrides.evidenceDir,
    fetch: overrides.fetch,
    sleep: async () => undefined,
    attachmentResolver: async () => [{ address: '140.82.112.3', family: 4 }],
    attachmentTransport: async () => ({ kind: 'error', reason: 'network' }),
    clock: fixedClock('2026-09-27T10:15:00.000Z'),
    random: fixedRandom('3f9a1c2e'),
    ...(overrides.evidence !== undefined ? { evidence: overrides.evidence } : {}),
  };
}

function makeInvariant7TmpDir(): string {
  return mkdtempSync(join(os.tmpdir(), 'm5-inv7-'));
}

function removeInvariant7TmpDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function collectFilesRecursively(dir: string): string[] {
  const out: string[] = [];
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }
  return out;
}

describe('invariant 7: stored evidence', { timeout: 60000 }, () => {
  it('invariant 7: exact-value forms of a resolved credential are redacted', async () => {
    const forms = exactValueForms(SENTINEL);
    expect(forms).toHaveLength(3);

    const inputs = forms.map((form) => `x ${form} y`);
    const result = await redactTexts(inputs, { credentials: [SENTINEL] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const text of result.value.texts) {
        expect(text).toBe('x [REDACTED:known-secret] y');
      }
      expect(result.value.exactValues).toBe(3);
    }

    const shortResult = await redactTexts(['x abcdefg y'], { credentials: ['abcdefg'] });
    expect(shortResult.ok).toBe(true);
    if (shortResult.ok) {
      expect(shortResult.value.texts[0]).toBe('x abcdefg y');
    }
  });

  it('invariant 7: a sentinel token appears in no stored file', async () => {
    const forms = exactValueForms(SENTINEL);
    const evidenceDir = makeInvariant7TmpDir();
    try {
      const body = prBody().replace('docs/format.md', 'docs/format.md ' + forms.join(' '));
      const deps = makeInvariant7Deps({ evidenceDir, fetch: makeInvariant7Fetch(baseRoutes(body)), token: SENTINEL });
      const result = await screenSubmission(deps);
      expect(result.kind).toBe('completed');

      const files = collectFilesRecursively(evidenceDir);
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        for (const form of forms) {
          expect(content).not.toContain(form);
        }
      }
      const submissionFile = files.find((file) => file.endsWith('submission.json'));
      expect(submissionFile).toBeDefined();
      expect(readFileSync(submissionFile as string, 'utf8')).toContain('[REDACTED:known-secret]');
    } finally {
      removeInvariant7TmpDir(evidenceDir);
    }
  });

  it('invariant 7: redaction failure and timeout fail the evidence write', async () => {
    const injections = [
      err('redaction.failed', 'steward-defect', 'Injected.'),
      err('redaction.timeout', 'infrastructure', 'Injected.'),
    ] as const;

    for (const injected of injections) {
      const evidenceDir = makeInvariant7TmpDir();
      try {
        const deps = makeInvariant7Deps({
          evidenceDir,
          fetch: makeInvariant7Fetch(baseRoutes(prBody())),
          evidence: { redact: async () => injected },
        });
        const result = await screenSubmission(deps);
        expect(result.kind).toBe('publish-failed');
        if (result.kind === 'publish-failed') {
          expect(result.exitStatus).toBe(2);
          expect(result.failure.details[0]?.code).toBe(injected.failure.code);
        }
        const files = collectFilesRecursively(evidenceDir);
        expect(files.some((file) => file.endsWith('manifest.json'))).toBe(false);
        expect(files.some((file) => file.split(/[/\\]/).includes('metrics'))).toBe(false);
      } finally {
        removeInvariant7TmpDir(evidenceDir);
      }
    }
  });

  it('invariant 7: report and check summary maxima are enforced', async () => {
    const modes = ['report', 'summary'] as const;

    for (const mode of modes) {
      const evidenceDir = makeInvariant7TmpDir();
      try {
        const wrapped: EvidenceRedactFn = async (inputs, options) => {
          const real = await redactTexts(inputs, options);
          if (!real.ok) return real;
          if (inputs.length === 2 && (inputs[0] as string).startsWith(REPORT_TITLE)) {
            const texts = [...real.value.texts];
            if (mode === 'report') {
              texts[0] = (texts[0] as string) + 'x'.repeat(REPORT_MAX_LENGTH + 1);
            } else {
              texts[1] = (texts[1] as string) + 'x'.repeat(CHECK_SUMMARY_MAX_LENGTH + 1);
            }
            return ok({ ...real.value, texts });
          }
          return real;
        };

        const deps = makeInvariant7Deps({
          evidenceDir,
          fetch: makeInvariant7Fetch(baseRoutes(prBody())),
          evidence: { redact: wrapped },
        });
        const result = await screenSubmission(deps);
        expect(result.kind).toBe('publish-failed');
        if (result.kind === 'publish-failed') {
          expect(result.failure.details[0]?.code).toBe(mode === 'report' ? 'report.too-large' : 'report.summary-too-large');
        }
        const files = collectFilesRecursively(evidenceDir);
        expect(files.some((file) => file.endsWith('manifest.json'))).toBe(false);
      } finally {
        removeInvariant7TmpDir(evidenceDir);
      }
    }
  });

  it('invariant 7: limits.evidence.run_bytes is enforced', async () => {
    const tmpDir = makeInvariant7TmpDir();
    try {
      const policyText = readFileSync(policyFixturePath(), 'utf8');
      expect(policyText).toContain('    run_bytes: 10485760');
      const patchedPolicy = policyText.replace('    run_bytes: 10485760', '    run_bytes: 65536');
      expect(patchedPolicy).not.toBe(policyText);
      expect(patchedPolicy).toContain('    run_bytes: 65536');
      const policyPath = join(tmpDir, 'policy.yml');
      writeFileSync(policyPath, patchedPolicy);

      const body = prBody().replace('`widget parse` exits with status 1 on an empty file.', 'x'.repeat(60000));
      const evidenceDir = join(tmpDir, 'evidence');
      const deps = makeInvariant7Deps({ evidenceDir, fetch: makeInvariant7Fetch(baseRoutes(body)), policyPath });
      const result = await screenSubmission(deps);
      expect(result.kind).toBe('publish-failed');
      if (result.kind === 'publish-failed') {
        expect(result.failure.details[0]?.code).toBe('evidence.too-large');
      }
      const files = existsSync(evidenceDir) ? collectFilesRecursively(evidenceDir) : [];
      expect(files.some((file) => file.endsWith('manifest.json'))).toBe(false);
    } finally {
      removeInvariant7TmpDir(tmpDir);
    }
  });

  it('invariant 7: the static report budget fits the report maximum', () => {
    expect(reportStaticBudget()).toBeLessThanOrEqual(REPORT_MAX_LENGTH);
  });
});
