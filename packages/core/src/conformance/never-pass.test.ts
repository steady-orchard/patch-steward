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
  GitHubFailureCode,
  MergeBaseFailureCode,
  GitHubPolicySourceFailureCode,
  BodyParseFailureCode,
  SnapshotFailureCode,
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
  createGitHubClient,
  createGitHubBudget,
  readRepository,
  readIssue,
  readOpenPullRequestsForCommit,
  readDirectoryEntries,
  readGitBlob,
  findMergeBase,
  parseIssueBody,
  buildIssueSnapshot,
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
  | RecordFailureCode
  | GitHubFailureCode
  | MergeBaseFailureCode
  | GitHubPolicySourceFailureCode
  | BodyParseFailureCode
  | SnapshotFailureCode;

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

const GITHUB_REPO = { owner: 'octo', name: 'demo' };

function ghClient(
  fetchImpl: (url: string, init: { readonly signal: AbortSignal }) => Promise<Response>,
): ReturnType<typeof createGitHubClient> {
  return createGitHubClient({
    token: null,
    budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }),
    fetch: fetchImpl as NonNullable<Parameters<typeof createGitHubClient>[0]['fetch']>,
    sleep: () => Promise.resolve(),
  });
}

function ghJson(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

const POLICY_OWNER = 'example-owner';
const POLICY_REPO = 'example-repo';
const POLICY_BRANCH = 'main';

function policyRefUrl(): string {
  return `https://api.github.com/repos/${POLICY_OWNER}/${POLICY_REPO}/git/ref/heads/${POLICY_BRANCH}`;
}

function policyContentsUrl(): string {
  return `https://api.github.com/repos/${POLICY_OWNER}/${POLICY_REPO}/contents/.github?ref=${commit}`;
}

function policyTreeUrl(): string {
  return `https://api.github.com/repos/${POLICY_OWNER}/${POLICY_REPO}/git/trees/${treeId}?recursive=1`;
}

function policyRefBody(): unknown {
  return { ref: `refs/heads/${POLICY_BRANCH}`, object: { sha: commit, type: 'commit' } };
}

function policySource(
  routes: ReadonlyMap<string, { readonly status: number; readonly body?: unknown }>,
): Parameters<typeof loadPolicy>[0] {
  const client = ghClient((url) => {
    const route = routes.get(url);
    if (route === undefined) {
      return Promise.resolve(new Response('not mapped', { status: 404 }));
    }
    return Promise.resolve(ghJson(route.status, route.body ?? {}));
  });
  return { kind: 'github', client, repository: { owner: POLICY_OWNER, name: POLICY_REPO }, branch: POLICY_BRANCH };
}

function policyContentsListing(includePolicyDir: boolean, policyEntryType: 'dir' | 'file' = 'dir'): unknown {
  const entries: unknown[] = [];
  if (includePolicyDir) {
    entries.push({ name: 'patch-steward', path: '.github/patch-steward', sha: treeId, type: policyEntryType, size: 1 });
  }
  return entries;
}

function policyTreeBody(entries: readonly Record<string, unknown>[], truncated = false): unknown {
  return { sha: treeId, truncated, tree: entries };
}

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
  'github.network': () =>
    readRepository(
      ghClient(() => {
        throw new Error('injected network failure');
      }),
      GITHUB_REPO,
    ),
  'github.timeout': () =>
    readRepository(
      createGitHubClient({
        token: null,
        budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }),
        fetch: (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
        timeoutMs: 20,
        sleep: () => Promise.resolve(),
      }),
      GITHUB_REPO,
    ),
  'github.server-error': () =>
    readRepository(
      ghClient(() => Promise.resolve(ghJson(500, {}))),
      GITHUB_REPO,
    ),
  'github.rate-limited': () =>
    readRepository(
      ghClient(() => Promise.resolve(ghJson(429, {}, { 'retry-after': '3600' }))),
      GITHUB_REPO,
    ),
  'github.unauthorized': () =>
    readRepository(
      ghClient(() => Promise.resolve(ghJson(401, {}))),
      GITHUB_REPO,
    ),
  'github.not-found': () =>
    readRepository(
      ghClient(() => Promise.resolve(ghJson(404, {}))),
      GITHUB_REPO,
    ),
  'github.unexpected-status': () =>
    readRepository(
      ghClient(() => Promise.resolve(ghJson(302, {}))),
      GITHUB_REPO,
    ),
  'github.response-too-large': () =>
    readRepository(
      ghClient(() => Promise.resolve(new Response(new Uint8Array(5242881), { status: 200 }))),
      GITHUB_REPO,
    ),
  'github.malformed-response': () =>
    readRepository(
      ghClient(() => Promise.resolve(new Response('{', { status: 200 }))),
      GITHUB_REPO,
    ),
  'github.schema-mismatch': () =>
    readRepository(
      ghClient(() => Promise.resolve(ghJson(200, {}))),
      GITHUB_REPO,
    ),
  'github.budget-exhausted': () =>
    readRepository(
      createGitHubClient({
        token: null,
        budget: createGitHubBudget({ requests: 0, retriesPerRequest: 0 }),
        fetch: () => Promise.resolve(ghJson(200, {})),
        sleep: () => Promise.resolve(),
      }),
      GITHUB_REPO,
    ),
  'github.invalid-request': () =>
    readRepository(
      ghClient(() => Promise.resolve(ghJson(200, {}))),
      { owner: '-bad', name: 'r' },
    ),
  'github.not-an-issue': () =>
    readIssue(
      ghClient(() =>
        Promise.resolve(
          ghJson(200, {
            number: 1,
            title: 't',
            body: null,
            state: 'open',
            user: null,
            author_association: 'NONE',
            pull_request: {},
          }),
        ),
      ),
      GITHUB_REPO,
      1,
    ),
  'github.not-a-directory': () =>
    readDirectoryEntries(
      ghClient(() => Promise.resolve(ghJson(200, {}))),
      GITHUB_REPO,
      'docs',
      'b'.repeat(40),
    ),
  'github.blob-too-large': () =>
    readGitBlob(
      ghClient(() => Promise.resolve(ghJson(200, { sha: 'b'.repeat(40), size: 5, encoding: 'base64', content: 'aGVsbG8=' }))),
      GITHUB_REPO,
      'b'.repeat(40),
      1,
    ),
  'github.pagination-exceeded': () =>
    readOpenPullRequestsForCommit(
      ghClient(() => Promise.resolve(ghJson(200, [], { link: '<https://api.github.com/x?page=2>; rel="next"' }))),
      GITHUB_REPO,
      'a'.repeat(40),
    ),
  'github.pagination-invalid': () =>
    readOpenPullRequestsForCommit(
      ghClient(() => Promise.resolve(ghJson(200, [], { link: '<https://evil.example/x>; rel="next"' }))),
      GITHUB_REPO,
      'a'.repeat(40),
    ),
  'git.no-merge-base': () =>
    findMergeBase(
      {
        repoDir: os.tmpdir(),
        timeoutMs: 1000,
        maxOutputBytes: 1000,
        runner: () => Promise.resolve(ok({ exitCode: 1, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) })),
      },
      'a'.repeat(40),
      'b'.repeat(40),
    ),
  'policy-source.not-published': () =>
    loadPolicy(
      policySource(
        new Map([
          [policyRefUrl(), { status: 200, body: policyRefBody() }],
          [policyContentsUrl(), { status: 200, body: policyContentsListing(false) }],
        ]),
      ),
    ) as Promise<Result<unknown, string>>,
  'policy-source.not-a-directory': () =>
    loadPolicy(
      policySource(
        new Map([
          [policyRefUrl(), { status: 200, body: policyRefBody() }],
          [policyContentsUrl(), { status: 200, body: policyContentsListing(true, 'file') }],
        ]),
      ),
    ) as Promise<Result<unknown, string>>,
  'policy-source.tree-truncated': () =>
    loadPolicy(
      policySource(
        new Map([
          [policyRefUrl(), { status: 200, body: policyRefBody() }],
          [policyContentsUrl(), { status: 200, body: policyContentsListing(true) }],
          [policyTreeUrl(), { status: 200, body: policyTreeBody([], true) }],
        ]),
      ),
    ) as Promise<Result<unknown, string>>,
  'policy-source.entry-not-regular': () =>
    loadPolicy(
      policySource(
        new Map([
          [policyRefUrl(), { status: 200, body: policyRefBody() }],
          [policyContentsUrl(), { status: 200, body: policyContentsListing(true) }],
          [
            policyTreeUrl(),
            { status: 200, body: policyTreeBody([{ path: 'policy.yml', mode: '120000', type: 'blob', sha: blobId, size: 10 }]) },
          ],
        ]),
      ),
    ) as Promise<Result<unknown, string>>,
  'policy-source.blob-too-large': () =>
    loadPolicy(
      policySource(
        new Map([
          [policyRefUrl(), { status: 200, body: policyRefBody() }],
          [policyContentsUrl(), { status: 200, body: policyContentsListing(true) }],
          [
            policyTreeUrl(),
            {
              status: 200,
              body: policyTreeBody([{ path: 'policy.yml', mode: '100644', type: 'blob', sha: blobId, size: 262145 }]),
            },
          ],
        ]),
      ),
    ) as Promise<Result<unknown, string>>,
  'submission.body-too-large': () => parseIssueBody('x'.repeat(65537)),
  'submission.body-malformed': () => parseIssueBody('\uD800'),
  'snapshot.invalid': () =>
    buildIssueSnapshot({
      repository: 'octo/widgets',
      number: 7,
      title: 'Crash',
      body: 'No crash',
      attachments: [],
      authorResponses: [],
      policyRevision: 'HEAD',
    }),
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
