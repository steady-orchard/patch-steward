import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import type {
  GitFailureCode,
  FileSourceFailureCode,
  PolicyResolveFailureCode,
  ProcessFailureCode,
  CanonicalJsonFailureCode,
  RedactionFailureCode,
  PublicSubsetFailureCode,
  RecordFailureCode,
  Result,
  Policy,
  ProcessRunner,
  ProcessOutput,
  LoadedPolicy,
} from '../index.js';
import {
  loadPolicy,
  readPolicyTreeId,
  runProcess,
  canonicalJson,
  redactText,
  applyRedactionRules,
  validatePolicy,
  resolvePolicy,
  derivePublicSubset,
  policyRevisionRecord,
  parseStrictYaml,
  FAILURE_CAUSES,
  failureCauseSchema,
  outcomeSchema,
  ok,
  err,
  GIT_TIMEOUT_MS,
  GIT_OUTPUT_MAX_BYTES,
  POLICY_FILE_MAX_BYTES,
  POLICY_YAML_MAX_DEPTH,
  POLICY_YAML_MAX_NODES,
} from '../index.js';

type Trigger = () => Promise<Result<unknown, string>> | Result<unknown, string>;

type NonContentFailureCode =
  | GitFailureCode
  | FileSourceFailureCode
  | PolicyResolveFailureCode
  | ProcessFailureCode
  | CanonicalJsonFailureCode
  | RedactionFailureCode
  | PublicSubsetFailureCode
  | RecordFailureCode;

const templateBytes = fs.readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));

const commit = 'a'.repeat(40);
const treeId = 'b'.repeat(40);
const blobId = 'c'.repeat(40);

type OverrideKey = 'gitDir' | 'verify' | 'lsRoot' | 'lsRec' | 'cat';
type OverrideFn = (args: readonly string[]) => Promise<Result<ProcessOutput, ProcessFailureCode>>;
type Overrides = Partial<Record<OverrideKey, OverrideFn>>;

function fake(overrides: Overrides): ProcessRunner {
  return async (_binary, args) => {
    if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
      if (overrides.gitDir) {
        return overrides.gitDir(args);
      }
      return ok({ exitCode: 0, stdout: Buffer.from('.git\n'), stderr: Buffer.alloc(0) });
    }
    if (args[0] === 'rev-parse' && args[1] === '--verify') {
      if (overrides.verify) {
        return overrides.verify(args);
      }
      return ok({ exitCode: 0, stdout: Buffer.from(`${commit}\n`), stderr: Buffer.alloc(0) });
    }
    if (args[0] === 'ls-tree' && args.includes('.github/patch-steward')) {
      if (overrides.lsRoot) {
        return overrides.lsRoot(args);
      }
      return ok({
        exitCode: 0,
        stdout: Buffer.from(`040000 tree ${treeId}\t.github/patch-steward\0`),
        stderr: Buffer.alloc(0),
      });
    }
    if (args[0] === 'ls-tree' && args.includes('-r')) {
      if (overrides.lsRec) {
        return overrides.lsRec(args);
      }
      return ok({
        exitCode: 0,
        stdout: Buffer.from(`100644 blob ${blobId} ${templateBytes.length}\tpolicy.yml\0`),
        stderr: Buffer.alloc(0),
      });
    }
    if (args[0] === 'cat-file') {
      if (overrides.cat) {
        return overrides.cat(args);
      }
      return ok({ exitCode: 0, stdout: templateBytes, stderr: Buffer.alloc(0) });
    }
    throw new Error(`unexpected git invocation: ${args.join(' ')}`);
  };
}

function git(overrides: Overrides, ref = 'main'): Promise<Result<LoadedPolicy, string>> {
  return loadPolicy({ kind: 'git', repoDir: os.tmpdir(), ref }, { runner: fake(overrides) }) as Promise<
    Result<LoadedPolicy, string>
  >;
}

let tmpDir: string;
let oversizeFilePath: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-conformance-'));
  oversizeFilePath = path.join(tmpDir, 'oversize.yml');
  fs.writeFileSync(oversizeFilePath, Buffer.alloc(POLICY_FILE_MAX_BYTES + 1, 0x61));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 });
});

const baseEnv: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) {
    baseEnv[key] = value;
  }
}
const processOpts = { cwd: os.tmpdir(), env: baseEnv, timeoutMs: 5000, maxOutputBytes: 1024 };

function templateRaw(): Record<string, unknown> {
  const parsed = parseStrictYaml(templateBytes, {
    maxBytes: POLICY_FILE_MAX_BYTES,
    maxDepth: POLICY_YAML_MAX_DEPTH,
    maxNodes: POLICY_YAML_MAX_NODES,
  });
  if (!parsed.ok) {
    throw new Error('template failed to parse');
  }
  return structuredClone(parsed.value) as Record<string, unknown>;
}

const TRIGGERS: { readonly [K in NonContentFailureCode]: Trigger } = {
  'git.unavailable': () =>
    loadPolicy(
      { kind: 'git', repoDir: os.tmpdir(), ref: 'main' },
      { gitBinary: path.join(os.tmpdir(), 'no-such-git-binary-for-conformance') },
    ) as Promise<Result<unknown, string>>,
  'git.timeout': () => git({ verify: () => Promise.resolve(err('process.timeout', 'infrastructure', 'injected')) }),
  'git.output-too-large': () =>
    git({ lsRec: () => Promise.resolve(err('process.output-too-large', 'infrastructure', 'injected')) }),
  'git.failed': () =>
    git({ lsRoot: () => Promise.resolve(ok({ exitCode: 128, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) })) }),
  'git.malformed-output': () =>
    git({ lsRec: () => Promise.resolve(ok({ exitCode: 0, stdout: Buffer.from('garbage\0'), stderr: Buffer.alloc(0) })) }),
  'git.not-a-repository': () =>
    loadPolicy(
      { kind: 'git', repoDir: path.join(os.tmpdir(), 'no-such-directory-for-conformance'), ref: 'main' },
      { runner: fake({}) },
    ) as Promise<Result<unknown, string>>,
  'git.invalid-ref': () => git({}, '-bad'),
  'git.ref-unresolvable': () =>
    git({ verify: () => Promise.resolve(ok({ exitCode: 1, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) })) }),
  'git.invalid-object-id': () =>
    readPolicyTreeId(
      { repoDir: os.tmpdir(), timeoutMs: GIT_TIMEOUT_MS, maxOutputBytes: GIT_OUTPUT_MAX_BYTES, runner: fake({}) },
      'not-an-object-id',
    ),
  'git.policy-directory-missing': () =>
    git({ lsRoot: () => Promise.resolve(ok({ exitCode: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) })) }),
  'git.not-a-directory': () =>
    git({
      lsRoot: () =>
        Promise.resolve(
          ok({ exitCode: 0, stdout: Buffer.from(`100644 blob ${blobId}\t.github/patch-steward\0`), stderr: Buffer.alloc(0) }),
        ),
    }),
  'git.entry-missing': () =>
    git({
      lsRec: () =>
        Promise.resolve(ok({ exitCode: 0, stdout: Buffer.from(`100644 blob ${blobId} 7\tREADME.md\0`), stderr: Buffer.alloc(0) })),
    }),
  'git.entry-not-regular': () =>
    git({
      lsRec: () =>
        Promise.resolve(ok({ exitCode: 0, stdout: Buffer.from(`120000 blob ${blobId} 7\tpolicy.yml\0`), stderr: Buffer.alloc(0) })),
    }),
  'git.blob-too-large': () =>
    git({
      lsRec: () =>
        Promise.resolve(
          ok({ exitCode: 0, stdout: Buffer.from(`100644 blob ${blobId} 262145\tpolicy.yml\0`), stderr: Buffer.alloc(0) }),
        ),
    }),
  'git.object-missing': () =>
    git({ cat: () => Promise.resolve(ok({ exitCode: 128, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) })) }),
  'file.not-found': () => loadPolicy({ kind: 'file', path: path.join(tmpDir, 'missing.yml') }) as Promise<Result<unknown, string>>,
  'file.not-a-file': () => loadPolicy({ kind: 'file', path: tmpDir }) as Promise<Result<unknown, string>>,
  'file.unreadable': () =>
    loadPolicy({ kind: 'file', path: path.join(tmpDir, 'bad\u0000name.yml') }) as Promise<Result<unknown, string>>,
  'file.too-large': () => loadPolicy({ kind: 'file', path: oversizeFilePath }) as Promise<Result<unknown, string>>,
  'policy.resolve-failed': () => resolvePolicy({ dismissal_codes: [] } as unknown as Policy),
  'process.unavailable': () => runProcess(path.join(os.tmpdir(), 'no-such-binary-for-conformance'), [], processOpts),
  'process.timeout': () => runProcess(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], { ...processOpts, timeoutMs: 300 }),
  'process.output-too-large': () =>
    runProcess(process.execPath, ['-e', "process.stdout.write('x'.repeat(4096))"], { ...processOpts, maxOutputBytes: 16 }),
  'process.failed': () =>
    runProcess(process.execPath, ['-e', ''], { ...processOpts, env: { ...baseEnv, CONFORMANCE_NUL: 'a\u0000b' } }),
  'process.invalid-options': () => runProcess(process.execPath, ['-e', ''], { ...processOpts, timeoutMs: 0 }),
  'canonical-json.non-finite-number': () => canonicalJson(Number.NaN),
  'canonical-json.lone-surrogate': () => canonicalJson('\uD800'),
  'canonical-json.unsupported-value': () => canonicalJson(undefined),
  'canonical-json.cycle': () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    return canonicalJson(cyclic);
  },
  'redaction.input-too-large': () => redactText('x'.repeat(11), { maxInputBytes: 10 }),
  'redaction.invalid-pattern': () => redactText('x', { policyPatterns: [{ id: 'bad', pattern: '(a+)+$' }] }),
  'redaction.timeout': () =>
    applyRedactionRules('a'.repeat(40) + '!', [{ id: 'catastrophic', kind: 'regex', value: '(a+)+$', flags: 'g' }], {
      maxInputBytes: 1024,
      timeoutMs: 200,
    }),
  'redaction.failed': () =>
    applyRedactionRules('x', [{ id: 'broken', kind: 'regex', value: '(', flags: 'g' }], { maxInputBytes: 1024, timeoutMs: 2000 }),
  'public-subset.invalid': () => {
    const raw = templateRaw();
    (raw.evidence as Record<string, unknown>).publication = {
      ...((raw.evidence as Record<string, unknown>).publication as Record<string, unknown>),
      pages: true,
    };
    const validated = validatePolicy(raw);
    if (!validated.ok) {
      throw new Error('template failed to validate');
    }
    const resolved = resolvePolicy(validated.value);
    if (!resolved.ok) {
      throw new Error('template failed to resolve');
    }
    return derivePublicSubset(resolved.value, 'not-a-revision', 'public');
  },
  'record.invalid': () =>
    policyRevisionRecord(
      (() => {
        const raw = templateRaw();
        const validated = validatePolicy(raw);
        if (!validated.ok) {
          throw new Error('template failed to validate');
        }
        const resolved = resolvePolicy(validated.value);
        if (!resolved.ok) {
          throw new Error('template failed to resolve');
        }
        return {
          revision: { kind: 'git-tree', id: 'c'.repeat(40), commit: 'd'.repeat(40), ref: 'main' },
          policy: resolved.value,
          authoritative: true,
        } as LoadedPolicy;
      })(),
      { stewardVersion: '0.0.2', loadedAt: 'yesterday' },
    ),
};

function expectNeverPass(result: Result<unknown, string>, code: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  const failure = result.failure;
  expect(failure.code).toBe(code);
  expect(failure.outcome).toBe('inconclusive');
  expect(outcomeSchema.parse(failure.outcome)).not.toBe('pass');
  expect(failureCauseSchema.safeParse(failure.cause).success).toBe(true);
  expect('value' in result).toBe(false);
  expect(typeof failure.message).toBe('string');
  expect(failure.message.length).toBeGreaterThan(0);
  for (const detail of failure.details) {
    expect(typeof detail.code).toBe('string');
    expect(typeof detail.path).toBe('string');
    expect(typeof detail.message).toBe('string');
    expect(detail.line === null || typeof detail.line === 'number').toBe(true);
    expect(detail.column === null || typeof detail.column === 'number').toBe(true);
  }
}

describe('never-pass conformance', { timeout: 30000 }, () => {
  it('injected failure: git missing', async () => {
    expectNeverPass(await TRIGGERS['git.unavailable'](), 'git.unavailable');
  });

  it('injected failure: non-zero exit', async () => {
    expectNeverPass(await TRIGGERS['git.failed'](), 'git.failed');
  });

  it('injected failure: timeout', async () => {
    expectNeverPass(await TRIGGERS['git.timeout'](), 'git.timeout');
  });

  it('injected failure: oversize output', async () => {
    expectNeverPass(await TRIGGERS['git.output-too-large'](), 'git.output-too-large');
  });

  it('injected failure: malformed ls-tree output', async () => {
    expectNeverPass(await TRIGGERS['git.malformed-output'](), 'git.malformed-output');
  });

  it('injected failure: missing blob', async () => {
    expectNeverPass(await TRIGGERS['git.object-missing'](), 'git.object-missing');
  });

  it('injected failure: oversize blob', async () => {
    let catFileCalled = false;
    const result = await git({
      lsRec: () =>
        Promise.resolve(
          ok({ exitCode: 0, stdout: Buffer.from(`100644 blob ${blobId} 262145\tpolicy.yml\0`), stderr: Buffer.alloc(0) }),
        ),
      cat: () => {
        catFileCalled = true;
        return Promise.resolve(ok({ exitCode: 0, stdout: templateBytes, stderr: Buffer.alloc(0) }));
      },
    });
    expectNeverPass(result, 'git.blob-too-large');
    expect(catFileCalled).toBe(false);
  });

  it.each(Object.keys(TRIGGERS))('failure code %s never yields pass', async (code) => {
    const result = await TRIGGERS[code as NonContentFailureCode]();
    expectNeverPass(result, code);
  });

  it.each([...FAILURE_CAUSES])('failure cause %s maps to inconclusive', (cause) => {
    const failure = err('conformance.probe', cause, 'probe');
    expect(failure.failure.outcome).toBe('inconclusive');
  });
});
