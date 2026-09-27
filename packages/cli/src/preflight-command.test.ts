import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runPreflightCommand } from './preflight-command.js';

const OWNER_REPO = '/repos/octo/demo';
const REPO_SHA = '1'.repeat(40);
const POLICY_TREE_SHA = '2'.repeat(40);
const POLICY_BLOB_SHA = '3'.repeat(40);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function notFound(): Response {
  return new Response('{"message":"Not Found"}', { status: 404 });
}

interface Seen {
  readonly path: string;
  readonly auth: string | null;
}

function routed(routes: Record<string, () => Response>, seen: Seen[]) {
  return async (url: string, init: { headers: Readonly<Record<string, string>> }): Promise<Response> => {
    const u = new URL(url);
    seen.push({ path: u.pathname, auth: init.headers['authorization'] ?? null });
    const handler = routes[u.pathname];
    return handler ? handler() : notFound();
  };
}

function repositoryRoute(): Response {
  return json({ full_name: 'octo/demo', default_branch: 'main', private: false });
}

function refRoute(): Response {
  return json({ ref: 'refs/heads/main', object: { sha: REPO_SHA, type: 'commit' } });
}

function issue29Route(): Response {
  return json({
    number: 29,
    title: 'Empty files fail',
    body: 'Report',
    state: 'open',
    user: { login: 'someone', id: 1, type: 'User' },
    author_association: 'NONE',
  });
}

function testbedRoutes(): Record<string, () => Response> {
  return {
    [OWNER_REPO]: repositoryRoute,
    [`${OWNER_REPO}/git/ref/heads/main`]: refRoute,
    [`${OWNER_REPO}/contents/.github`]: notFound,
    [`${OWNER_REPO}/issues/29`]: issue29Route,
  };
}

function publishedPolicyBytes(): Buffer {
  const raw = fs.readFileSync(path.join(process.cwd(), 'templates/policy/policy.yml'), 'utf8');
  const normalized = raw.replace(/\r\n/g, '\n').replace('  default: observe', '  default: enforce');
  return Buffer.from(normalized, 'utf8');
}

function publishedRoutes(blob: Buffer): Record<string, () => Response> {
  return {
    [OWNER_REPO]: repositoryRoute,
    [`${OWNER_REPO}/git/ref/heads/main`]: refRoute,
    [`${OWNER_REPO}/contents/.github`]: () =>
      json([{ name: 'patch-steward', path: '.github/patch-steward', sha: POLICY_TREE_SHA, type: 'dir', size: 0 }]),
    [`${OWNER_REPO}/git/trees/${POLICY_TREE_SHA}`]: () =>
      json({
        sha: POLICY_TREE_SHA,
        truncated: false,
        tree: [{ path: 'policy.yml', mode: '100644', type: 'blob', sha: POLICY_BLOB_SHA, size: blob.length }],
      }),
    [`${OWNER_REPO}/git/blobs/${POLICY_BLOB_SHA}`]: () =>
      json({ sha: POLICY_BLOB_SHA, size: blob.length, encoding: 'base64', content: blob.toString('base64') }),
    [`${OWNER_REPO}/issues/29`]: issue29Route,
  };
}

const DEFECT_LINES = [
  '### Expected behavior',
  '',
  '`widget parse` accepts an empty file and prints an empty document.',
  '',
  '### Authoritative basis',
  '',
  'docs/format.md, section "Empty input": an empty file is a valid document.',
  '',
  '### Actual behavior',
  '',
  '`widget parse empty.txt` exits with status 1 and prints `TypeError: cannot read properties of undefined`.',
  '',
  '### Affected version',
  '',
  '1.4.2',
  '',
  '### Reproduction command',
  '',
  '```shell',
  'touch empty.txt',
  'widget parse empty.txt',
  '```',
  '',
  '### Expected result',
  '',
  'Exit status 0 and the output `[]`.',
  '',
  '### Proposed scope',
  '',
  'Handle empty input in the parser entry point only.',
  '',
  '### References',
  '',
  '_No response_',
  '',
  '### Security claim',
  '',
  '- [ ] This report claims a security problem',
];

const PR_LINES = [
  '<!-- patch-steward:pr-template v1 -->',
  '',
  '## Category',
  '',
  'bugfix',
  '',
  '## Problem',
  '',
  '`widget parse` exits with status 1 on an empty file.',
  '',
  '## Benefit',
  '',
  'Empty files parse like any other valid document.',
  '',
  '## Intended behavior',
  '',
  'An empty file parses to an empty document and exits with status 0.',
  '',
  '## Acceptance criteria',
  '',
  '- `widget parse empty.txt` prints `[]`.',
  '- Exit status is 0.',
  '',
  '## Linked issue',
  '',
  'Fixes #29',
  '',
  '## Regression test',
  '',
  '`src/parse.test.ts`, test `parses an empty file`',
  '',
  '## Test scaffolding',
  '',
  '<!-- Non-test files the regression test needs. -->',
  '',
  '## Reproduction command',
  '',
  '```shell',
  'touch empty.txt',
  'widget parse empty.txt',
  '```',
  '',
  '## Expected result',
  '',
  'Exit status 0 and the output `[]`.',
  '',
  '## References',
  '',
  'docs/format.md',
];

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-preflight-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 });
});

function writeDraft(name: string, lines: readonly string[]): string {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}

interface RunOutput {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function run(
  argv: readonly string[],
  context: Partial<Parameters<typeof runPreflightCommand>[1]> & { readonly cwd?: string },
): Promise<RunOutput> {
  const out: string[] = [];
  const err: string[] = [];
  const exit = await runPreflightCommand(argv, {
    cwd: context.cwd ?? tmpDir,
    io: { stdout: (t: string) => out.push(t), stderr: (t: string) => err.push(t) },
    ...context,
  });
  return { exit, stdout: out.join(''), stderr: err.join('') };
}

function gitFixtureEnv(globalConfigPath: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || key.toUpperCase().startsWith('GIT_')) continue;
    result[key] = value;
  }
  result['GIT_CONFIG_NOSYSTEM'] = '1';
  result['GIT_CONFIG_GLOBAL'] = globalConfigPath;
  result['GIT_AUTHOR_NAME'] = 'Fixture';
  result['GIT_AUTHOR_EMAIL'] = 'fixture@example.com';
  result['GIT_AUTHOR_DATE'] = '2026-01-01T00:00:00Z';
  result['GIT_COMMITTER_NAME'] = 'Fixture';
  result['GIT_COMMITTER_EMAIL'] = 'fixture@example.com';
  result['GIT_COMMITTER_DATE'] = '2026-01-01T00:00:00Z';
  return result;
}

function makeGitRepo(): { readonly dir: string; readonly git: (args: readonly string[], input?: Buffer) => string } {
  const dir = fs.mkdtempSync(path.join(tmpDir, 'repo-'));
  const globalConfigPath = path.join(dir, '..', `gitconfig-${path.basename(dir)}`);
  fs.writeFileSync(globalConfigPath, '');
  const env = gitFixtureEnv(globalConfigPath);
  const git = (args: readonly string[], input?: Buffer): string =>
    execFileSync('git', args, { cwd: dir, env, input, encoding: 'buffer' }).toString('utf8').trim();
  git(['-c', 'init.defaultBranch=main', 'init', '-q']);
  return { dir, git };
}

describe('runPreflightCommand', () => {
  it('preflight exits 2 on usage errors before reading anything', async () => {
    const seen: Seen[] = [];
    const r = await run(['--issue', 'defect', '--pr', '--draft', 'x.txt'], { env: {}, fetch: routed({}, seen) });
    expect(r.exit).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe(
      'error usage.conflicting-options -: --issue and --pr cannot be used together\n' +
        'usage: steward preflight (--issue defect|proposal | --pr) --draft <file.md> [--repo owner/name] [--base <ref>] [--json]\n',
    );

    const seen2: Seen[] = [];
    const r2 = await run(['--issue', 'defect', '--pr', '--draft', 'x.txt', '--json'], { env: {}, fetch: routed({}, seen2) });
    expect(r2.exit).toBe(2);
    const parsed = JSON.parse(r2.stdout) as { errors: { code: string }[]; contract: null };
    expect(parsed.errors[0]?.code).toBe('usage.conflicting-options');
    expect(parsed.contract).toBeNull();
    expect(seen.length).toBe(0);
    expect(seen2.length).toBe(0);
  });

  it('preflight exits 2 on a missing draft before any GitHub read', async () => {
    const seen: Seen[] = [];
    const r = await run(['--issue', 'defect', '--draft', 'does-not-exist.txt', '--repo', 'octo/demo', '--json'], {
      env: {},
      fetch: routed(testbedRoutes(), seen),
    });
    expect(r.exit).toBe(2);
    const parsed = JSON.parse(r.stdout) as { errors: { code: string }[] };
    expect(parsed.errors[0]?.code).toBe('preflight.draft-not-found');
    expect(seen.length).toBe(0);
  });

  it('preflight meets the contract for a complete issue draft with the default checklist', async () => {
    const draft = writeDraft('defect.txt', DEFECT_LINES);
    const seen: Seen[] = [];
    const r = await run(['--issue', 'defect', '--draft', draft, '--repo', 'octo/demo'], {
      env: { GH_TOKEN: 'token-a' },
      fetch: routed(testbedRoutes(), seen),
    });
    expect(r.exit).toBe(0);
    const lines = r.stdout.split('\n');
    expect(lines[0]).toBe("unverified: produced on the contributor's machine; official screening treats it as a claim");
    expect(lines[1]).toBe('policy: default checklist (octo/demo has no published policy on main)');
    expect(lines[lines.length - 2]).toBe('disposition: met');
    expect(seen.every((s) => s.auth === 'Bearer token-a')).toBe(true);
  });

  it('preflight exits 1 when an issue draft misses a required field', async () => {
    const lines = DEFECT_LINES.map((line) =>
      line === 'docs/format.md, section "Empty input": an empty file is a valid document.' ? '_No response_' : line,
    );
    const draft = writeDraft('defect-missing.txt', lines);
    const seen: Seen[] = [];
    const r = await run(['--issue', 'defect', '--draft', draft, '--repo', 'octo/demo', '--json'], {
      env: { GH_TOKEN: 'token-a' },
      fetch: routed(testbedRoutes(), seen),
    });
    expect(r.exit).toBe(1);
    const parsed = JSON.parse(r.stdout) as {
      contract: { disposition: string; findings: { code: string; field: string | null }[] };
    };
    expect(parsed.contract.disposition).toBe('needs-changes');
    expect(parsed.contract.findings.some((f) => f.code === 'submission.field-missing' && f.field === 'authoritative-basis')).toBe(
      true,
    );
  });

  it('preflight applies a published policy', async () => {
    const draft = writeDraft('defect-complete.txt', DEFECT_LINES);
    const blob = publishedPolicyBytes();
    const seen: Seen[] = [];
    const r = await run(['--issue', 'defect', '--draft', draft, '--repo', 'octo/demo', '--json'], {
      env: { GH_TOKEN: 'token-a' },
      fetch: routed(publishedRoutes(blob), seen),
    });
    expect(r.exit).toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      policy: { source: string; repository: string; ref: string; commit: string; revision: string };
      contract: { effective_mode: string };
    };
    expect(parsed.policy).toEqual({
      source: 'published',
      repository: 'octo/demo',
      ref: 'main',
      commit: REPO_SHA,
      revision: POLICY_TREE_SHA,
    });
    expect(parsed.contract.effective_mode).toBe('enforce');
  });

  it('preflight exits 2 on an invalid published policy without a default', async () => {
    const draft = writeDraft('defect-complete.txt', DEFECT_LINES);
    const blob = Buffer.from('version: 1\nbogus: true\n', 'utf8');
    const seen: Seen[] = [];
    const r = await run(['--issue', 'defect', '--draft', draft, '--repo', 'octo/demo', '--json'], {
      env: { GH_TOKEN: 'token-a' },
      fetch: routed(publishedRoutes(blob), seen),
    });
    expect(r.exit).toBe(2);
    const parsed = JSON.parse(r.stdout) as {
      errors: { code: string; path: string }[];
      policy: unknown;
      contract: unknown;
    };
    expect(parsed.errors[0]?.code).toBe('preflight.policy-invalid');
    expect(parsed.errors.some((e) => e.code === 'policy.unknown-key' && e.path === 'bogus')).toBe(true);
    expect(parsed.policy).toBeNull();
    expect(parsed.contract).toBeNull();
  });

  it('preflight exits 2 when the upstream repository is missing or private', async () => {
    const draft = writeDraft('defect-complete.txt', DEFECT_LINES);
    const missingGh = path.join(os.tmpdir(), 'ps-no-such-directory', 'gh');
    const seen: Seen[] = [];
    const r = await run(['--issue', 'defect', '--draft', draft, '--repo', 'octo/demo', '--json'], {
      env: {},
      ghBinary: missingGh,
      fetch: routed({}, seen),
    });
    expect(r.exit).toBe(2);
    const parsed = JSON.parse(r.stdout) as { errors: { code: string; message: string }[]; warnings: { code: string }[] };
    expect(parsed.errors[0]?.code).toBe('preflight.repository-unavailable');
    expect(parsed.errors[0]?.message).toBe(
      'The repository octo/demo does not exist or is private; set GH_TOKEN or GITHUB_TOKEN, or log in with gh.',
    );
    expect(parsed.warnings.map((w) => w.code)).toEqual(['github.unauthenticated']);
  });

  it('preflight exits 2 when GitHub rejects the token', async () => {
    const draft = writeDraft('defect-complete.txt', DEFECT_LINES);
    const seen: Seen[] = [];
    const r = await run(['--issue', 'defect', '--draft', draft, '--repo', 'octo/demo'], {
      env: { GH_TOKEN: 'token-a' },
      fetch: routed({ [OWNER_REPO]: () => new Response('{"message":"Bad credentials"}', { status: 401 }) }, seen),
    });
    expect(r.exit).toBe(2);
    expect(r.stderr).toBe(
      'error preflight.token-rejected -: GitHub rejected the token; no unauthenticated fallback was attempted.\n',
    );
    expect(seen.length).toBe(1);
  });

  it('preflight warns when no token is found', async () => {
    const draft = writeDraft('defect-complete.txt', DEFECT_LINES);
    const missingGh = path.join(os.tmpdir(), 'ps-no-such-directory', 'gh');
    const seen: Seen[] = [];
    const r = await run(['--issue', 'defect', '--draft', draft, '--repo', 'octo/demo'], {
      env: {},
      ghBinary: missingGh,
      fetch: routed(testbedRoutes(), seen),
    });
    expect(r.exit).toBe(0);
    expect(r.stderr).toBe(
      'warning github.unauthenticated: No GitHub token was found in GH_TOKEN, GITHUB_TOKEN, or gh auth token; reading unauthenticated with a lower rate limit.\n',
    );
    expect(seen.every((s) => s.auth === null)).toBe(true);
  });

  it('preflight checks a pull request draft against the local diff', async () => {
    const repo = makeGitRepo();
    const a1 = repo.git(['hash-object', '-w', '--stdin'], Buffer.from('export const answer = 1;\n', 'utf8'));
    const a2 = repo.git(['hash-object', '-w', '--stdin'], Buffer.from('export const answer = 2;\n', 'utf8'));
    const srcBase = repo.git(['mktree'], Buffer.from(`100644 blob ${a1}\tapp.js\n`, 'utf8'));
    const srcHead = repo.git(['mktree'], Buffer.from(`100644 blob ${a2}\tapp.js\n`, 'utf8'));
    const baseTree = repo.git(['mktree'], Buffer.from(`040000 tree ${srcBase}\tsrc\n`, 'utf8'));
    const headTree = repo.git(['mktree'], Buffer.from(`040000 tree ${srcHead}\tsrc\n`, 'utf8'));
    const base = repo.git(['commit-tree', baseTree, '-m', 'base']);
    const head = repo.git(['commit-tree', headTree, '-p', base, '-m', 'head']);
    repo.git(['remote', 'add', 'origin', 'https://github.com/octo/demo.git']);
    repo.git(['update-ref', 'refs/remotes/origin/main', base]);
    repo.git(['update-ref', 'refs/heads/main', head]);

    const draft = writeDraft('pr-bugfix.txt', PR_LINES);
    const seen: Seen[] = [];
    const r = await run(['--pr', '--draft', draft, '--json'], {
      cwd: repo.dir,
      env: { GH_TOKEN: 'token-a' },
      fetch: routed(testbedRoutes(), seen),
    });
    expect(r.exit).toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      contract: { disposition: string; category: string };
      paths: {
        base: string;
        head: string;
        merge_base: string;
        changed: number;
        trusted_changed: boolean;
        execution_sensitive_changed: boolean;
        policy_changed: boolean;
        policy_change: { changed: boolean; proposed: unknown };
      };
    };
    expect(parsed.contract.disposition).toBe('met');
    expect(parsed.contract.category).toBe('bugfix');
    expect(parsed.paths).toEqual({
      base,
      head,
      merge_base: base,
      changed: 1,
      trusted_changed: false,
      execution_sensitive_changed: false,
      policy_changed: false,
      trusted_paths: [],
      execution_sensitive_paths: [],
      policy_paths: [],
      policy_change: { changed: false, proposed: null },
    });
    expect(seen.some((s) => s.path === `${OWNER_REPO}/issues/29`)).toBe(true);
  });

  it('preflight exits 2 when the base cannot be resolved', async () => {
    const repo = makeGitRepo();
    const a1 = repo.git(['hash-object', '-w', '--stdin'], Buffer.from('export const answer = 1;\n', 'utf8'));
    const src = repo.git(['mktree'], Buffer.from(`100644 blob ${a1}\tapp.js\n`, 'utf8'));
    const tree = repo.git(['mktree'], Buffer.from(`040000 tree ${src}\tsrc\n`, 'utf8'));
    const commit = repo.git(['commit-tree', tree, '-m', 'base']);
    repo.git(['remote', 'add', 'origin', 'https://github.com/octo/demo.git']);
    repo.git(['update-ref', 'refs/heads/main', commit]);

    const draft = writeDraft('pr-bugfix.txt', PR_LINES);
    const seen: Seen[] = [];
    const r = await run(['--pr', '--draft', draft, '--base', 'refs/remotes/origin/nope'], {
      cwd: repo.dir,
      env: { GH_TOKEN: 'token-a' },
      fetch: routed(testbedRoutes(), seen),
    });
    expect(r.exit).toBe(2);
    expect(r.stderr).toBe(
      'error preflight.base-unresolvable -: refs/remotes/origin/nope does not name a commit; run git fetch or pass --base <ref>.\n',
    );

    const repo2 = makeGitRepo();
    const b1 = repo2.git(['hash-object', '-w', '--stdin'], Buffer.from('export const answer = 1;\n', 'utf8'));
    const src2 = repo2.git(['mktree'], Buffer.from(`100644 blob ${b1}\tapp.js\n`, 'utf8'));
    const tree2 = repo2.git(['mktree'], Buffer.from(`040000 tree ${src2}\tsrc\n`, 'utf8'));
    const commit2 = repo2.git(['commit-tree', tree2, '-m', 'base']);
    repo2.git(['update-ref', 'refs/heads/main', commit2]);

    const seen2: Seen[] = [];
    const r2 = await run(['--pr', '--draft', draft, '--repo', 'octo/demo'], {
      cwd: repo2.dir,
      env: { GH_TOKEN: 'token-a' },
      fetch: routed(testbedRoutes(), seen2),
    });
    expect(r2.exit).toBe(2);
    expect(r2.stderr).toBe(
      'error preflight.base-unresolvable -: No remote-tracking branch for octo/demo main was found; run git fetch or pass --base <ref>.\n',
    );
  });

  it('preflight ends inconclusive when the linked issue cannot be read', async () => {
    const repo = makeGitRepo();
    const a1 = repo.git(['hash-object', '-w', '--stdin'], Buffer.from('export const answer = 1;\n', 'utf8'));
    const a2 = repo.git(['hash-object', '-w', '--stdin'], Buffer.from('export const answer = 2;\n', 'utf8'));
    const srcBase = repo.git(['mktree'], Buffer.from(`100644 blob ${a1}\tapp.js\n`, 'utf8'));
    const srcHead = repo.git(['mktree'], Buffer.from(`100644 blob ${a2}\tapp.js\n`, 'utf8'));
    const baseTree = repo.git(['mktree'], Buffer.from(`040000 tree ${srcBase}\tsrc\n`, 'utf8'));
    const headTree = repo.git(['mktree'], Buffer.from(`040000 tree ${srcHead}\tsrc\n`, 'utf8'));
    const base = repo.git(['commit-tree', baseTree, '-m', 'base']);
    const head = repo.git(['commit-tree', headTree, '-p', base, '-m', 'head']);
    repo.git(['remote', 'add', 'origin', 'https://github.com/octo/demo.git']);
    repo.git(['update-ref', 'refs/remotes/origin/main', base]);
    repo.git(['update-ref', 'refs/heads/main', head]);

    const draft = writeDraft('pr-bugfix.txt', PR_LINES);
    const routes = testbedRoutes();
    routes[`${OWNER_REPO}/issues/29`] = () => new Response('{"message":"Unprocessable"}', { status: 422 });
    const seen: Seen[] = [];
    const r = await run(['--pr', '--draft', draft, '--json'], {
      cwd: repo.dir,
      env: { GH_TOKEN: 'token-a' },
      fetch: routed(routes, seen),
    });
    expect(r.exit).toBe(3);
    const parsed = JSON.parse(r.stdout) as { contract: { disposition: string; inconclusive: { code: string }[] } };
    expect(parsed.contract.disposition).toBe('inconclusive');
    expect(parsed.contract.inconclusive[0]?.code).toBe('github.unexpected-status');
  });

  it('preflight exits 2 when no GitHub remote is found', async () => {
    const draft = writeDraft('defect-complete.txt', DEFECT_LINES);
    const seen: Seen[] = [];
    const r = await run(['--issue', 'defect', '--draft', draft], {
      cwd: os.tmpdir(),
      env: {},
      runner: async () => ({ ok: true, value: { exitCode: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) } }),
      fetch: routed({}, seen),
    });
    expect(r.exit).toBe(2);
    expect(r.stderr).toBe(
      'error preflight.no-upstream -: No GitHub remote named upstream or origin was found; pass --repo owner/name.\n',
    );
  });

  it('preflight exits 2 on an unexpected failure', async () => {
    const draft = writeDraft('pr-bugfix.txt', PR_LINES);
    const seen: Seen[] = [];
    const r = await run(['--pr', '--draft', draft, '--repo', 'octo/demo', '--base', 'main', '--json'], {
      cwd: os.tmpdir(),
      env: {},
      runner: async () => {
        throw new Error('injected-detail');
      },
      fetch: routed(testbedRoutes(), seen),
    });
    expect(r.exit).toBe(2);
    const parsed = JSON.parse(r.stdout) as { errors: { code: string }[] };
    expect(parsed.errors[0]?.code).toBe('steward.internal-error');
    expect(r.stdout).not.toContain('injected-detail');
    expect(r.stderr).not.toContain('injected-detail');
  });
});
