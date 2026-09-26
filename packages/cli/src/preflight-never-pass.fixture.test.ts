import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GitHubFetch, ProcessRunner } from '@patch-steward/core';
import { CONTRACT_DISPOSITIONS, err, ok } from '@patch-steward/core';

import type { PreflightCommandContext, PreflightFailureCode } from './preflight-command.js';
import { PREFLIGHT_EXIT_BY_DISPOSITION, PREFLIGHT_FAILURE_CODES, runPreflightCommand } from './preflight-command.js';

const FIXTURES = fileURLToPath(new URL('../../../fixtures/', import.meta.url));
const TESTBED_DIR = path.join(FIXTURES, 'github/testbed');
const POLICY_DIR = path.join(FIXTURES, 'github/policy-directory');
const SUBMISSIONS_DIR = path.join(FIXTURES, 'submissions');

const R = 'steady-orchard/patch-steward-testbed-public';
const EXAMPLE_REPO = 'example-owner/example-repo';
const POLICY_TREE_SHA = 'a8c2485882b52f63db71b1ec63b12f5039220e03';
const POLICY_BLOB_SHA = '716098133e97314ccf047f5034cc8f76161d8f0d';

const DEFECT_COMPLETE = path.join(SUBMISSIONS_DIR, 'defect-complete.txt');
const PR_BUGFIX_COMPLETE = path.join(SUBMISSIONS_DIR, 'pr-bugfix-complete.txt');
const UNSTRUCTURED = path.join(SUBMISSIONS_DIR, 'unstructured.txt');

const ESC = String.fromCharCode(0x1b);
const RLO = String.fromCharCode(0x202e);

function readFixtureJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, ...(headers !== undefined ? { headers } : {}) });
}

function notFound(): Response {
  return new Response('{"message":"Not Found"}', { status: 404 });
}

function routed(routes: Record<string, () => Response>): GitHubFetch {
  return async (url: string): Promise<Response> => {
    const handler = routes[new URL(url).pathname];
    return handler ? handler() : notFound();
  };
}

function testbedRepositoryBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...(readFixtureJson(path.join(TESTBED_DIR, 'repository.json')) as Record<string, unknown>), ...overrides };
}

function testbedRoutes(overrides: Record<string, unknown> = {}): Record<string, () => Response> {
  return {
    [`/repos/${R}`]: () => jsonResponse(testbedRepositoryBody(overrides)),
    [`/repos/${R}/git/ref/heads/master`]: () => jsonResponse(readFixtureJson(path.join(TESTBED_DIR, 'ref-heads-master.json'))),
    [`/repos/${R}/contents/.github`]: notFound,
    [`/repos/${R}/issues/29`]: () => jsonResponse(readFixtureJson(path.join(TESTBED_DIR, 'issue-29.json'))),
  };
}

function examplePolicyRoutes(): Record<string, () => Response> {
  const repoBody = testbedRepositoryBody({ full_name: EXAMPLE_REPO, default_branch: 'main' });
  const invalidYaml = 'version: 1\nbogus: true\n';
  const content = Buffer.from(invalidYaml, 'utf8');
  return {
    [`/repos/${EXAMPLE_REPO}`]: () => jsonResponse(repoBody),
    [`/repos/${EXAMPLE_REPO}/git/ref/heads/main`]: () =>
      jsonResponse(readFixtureJson(path.join(POLICY_DIR, 'ref-heads-main.json'))),
    [`/repos/${EXAMPLE_REPO}/contents/.github`]: () => jsonResponse(readFixtureJson(path.join(POLICY_DIR, 'contents-github.json'))),
    [`/repos/${EXAMPLE_REPO}/git/trees/${POLICY_TREE_SHA}`]: () =>
      jsonResponse(readFixtureJson(path.join(POLICY_DIR, 'tree.json'))),
    [`/repos/${EXAMPLE_REPO}/git/blobs/${POLICY_BLOB_SHA}`]: () =>
      jsonResponse({ sha: POLICY_BLOB_SHA, size: content.length, encoding: 'base64', content: content.toString('base64') }),
  };
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

function initGitRepo(parent: string): { readonly dir: string; readonly git: (args: readonly string[], input?: Buffer) => string } {
  const dir = fs.mkdtempSync(path.join(parent, 'repo-'));
  const globalConfigPath = path.join(parent, `gitconfig-${path.basename(dir)}`);
  fs.writeFileSync(globalConfigPath, '');
  const env = gitFixtureEnv(globalConfigPath);
  const git = (args: readonly string[], input?: Buffer): string =>
    execFileSync('git', args, { cwd: dir, env, input, encoding: 'buffer' }).toString('utf8').trim();
  git(['-c', 'init.defaultBranch=main', 'init', '-q']);
  return { dir, git };
}

function emptyGitRepo(parent: string): string {
  return initGitRepo(parent).dir;
}

function oneCommitGitRepo(parent: string): string {
  const repo = initGitRepo(parent);
  const blob = repo.git(['hash-object', '-w', '--stdin'], Buffer.from('content\n', 'utf8'));
  const tree = repo.git(['mktree'], Buffer.from(`100644 blob ${blob}\tfile.txt\n`, 'utf8'));
  const commit = repo.git(['commit-tree', tree, '-m', 'initial']);
  repo.git(['update-ref', 'refs/heads/main', commit]);
  return repo.dir;
}

interface RunOutput {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function run(
  argv: readonly string[],
  context: Partial<PreflightCommandContext> & { readonly cwd: string; readonly env: Readonly<Record<string, string>> },
): Promise<RunOutput> {
  const out: string[] = [];
  const errLines: string[] = [];
  const exit = await runPreflightCommand(argv, {
    io: { stdout: (t: string) => out.push(t), stderr: (t: string) => errLines.push(t) },
    ...context,
  });
  return { exit, stdout: out.join(''), stderr: errLines.join('') };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-preflight-never-pass-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 });
});

const MISSING_GH_BINARY = path.join(os.tmpdir(), 'ps-w49-no-such-directory', 'gh');

const TRIGGERS: { readonly [K in PreflightFailureCode]: () => Promise<RunOutput> } = {
  'usage.unknown-option': () => run(['--bogus', '--json'], { cwd: tmpDir, env: {}, fetch: routed({}) }),
  'usage.invalid-arguments': () => run(['--pr', '--json'], { cwd: tmpDir, env: {}, fetch: routed({}) }),
  'usage.conflicting-options': () =>
    run(['--issue', 'defect', '--pr', '--draft', 'x.txt', '--json'], { cwd: tmpDir, env: {}, fetch: routed({}) }),
  'preflight.draft-not-found': () =>
    run(['--issue', 'defect', '--draft', path.join(tmpDir, 'missing.txt'), '--repo', R, '--json'], {
      cwd: tmpDir,
      env: {},
      fetch: routed({}),
    }),
  'preflight.draft-unreadable': () =>
    run(['--issue', 'defect', '--draft', tmpDir, '--repo', R, '--json'], { cwd: tmpDir, env: {}, fetch: routed({}) }),
  'preflight.draft-too-large': () => {
    const file = path.join(tmpDir, 'too-large.txt');
    fs.writeFileSync(file, 'a'.repeat(262145));
    return run(['--issue', 'defect', '--draft', file, '--repo', R, '--json'], { cwd: tmpDir, env: {}, fetch: routed({}) });
  },
  'preflight.draft-invalid-utf8': () => {
    const file = path.join(tmpDir, 'invalid-utf8.txt');
    fs.writeFileSync(file, Buffer.from([0xc3, 0x28]));
    return run(['--issue', 'defect', '--draft', file, '--repo', R, '--json'], { cwd: tmpDir, env: {}, fetch: routed({}) });
  },
  'auth.token-invalid': () =>
    run(['--issue', 'defect', '--draft', DEFECT_COMPLETE, '--repo', R, '--json'], {
      cwd: tmpDir,
      env: { GH_TOKEN: 'not a token' },
      fetch: routed({}),
    }),
  'preflight.no-upstream': () =>
    run(['--issue', 'defect', '--draft', DEFECT_COMPLETE, '--json'], {
      cwd: emptyGitRepo(tmpDir),
      env: { GH_TOKEN: 'a' },
      fetch: routed({}),
    }),
  'preflight.head-unresolvable': () =>
    run(['--pr', '--draft', PR_BUGFIX_COMPLETE, '--repo', R, '--base', 'main', '--json'], {
      cwd: emptyGitRepo(tmpDir),
      env: {},
      fetch: routed({}),
    }),
  'preflight.base-unresolvable': () =>
    run(['--pr', '--draft', PR_BUGFIX_COMPLETE, '--repo', R, '--json'], {
      cwd: oneCommitGitRepo(tmpDir),
      env: { GH_TOKEN: 'a' },
      fetch: routed(testbedRoutes()),
    }),
  'preflight.repository-unavailable': () =>
    run(['--issue', 'defect', '--draft', DEFECT_COMPLETE, '--repo', R, '--json'], {
      cwd: tmpDir,
      env: {},
      ghBinary: MISSING_GH_BINARY,
      fetch: routed({}),
    }),
  'preflight.token-rejected': () =>
    run(['--issue', 'defect', '--draft', DEFECT_COMPLETE, '--repo', R, '--json'], {
      cwd: tmpDir,
      env: { GH_TOKEN: 'a' },
      fetch: routed({ [`/repos/${R}`]: () => new Response('{"message":"Bad credentials"}', { status: 401 }) }),
    }),
  'preflight.policy-invalid': () =>
    run(['--issue', 'defect', '--draft', DEFECT_COMPLETE, '--repo', EXAMPLE_REPO, '--json'], {
      cwd: tmpDir,
      env: { GH_TOKEN: 'a' },
      fetch: routed(examplePolicyRoutes()),
    }),
  'steward.internal-error': () =>
    run(['--pr', '--draft', PR_BUGFIX_COMPLETE, '--repo', R, '--base', 'main', '--json'], {
      cwd: os.tmpdir(),
      env: {},
      runner: async () => {
        throw new Error('injected');
      },
      fetch: routed({}),
    }),
};

describe('preflight never-pass conformance', () => {
  it.each(Object.keys(TRIGGERS))('preflight failure code %s never yields pass', async (code) => {
    const r = await TRIGGERS[code as PreflightFailureCode]();
    expect(r.exit).toBe(2);
    const parsed = JSON.parse(r.stdout) as { errors: { code: string }[]; contract: unknown; paths: unknown };
    expect(parsed.errors[0]?.code).toBe(code);
    expect(parsed.contract).toBeNull();
    expect(parsed.paths).toBeNull();
    expect(r.stdout).not.toContain('"pass"');
  });

  it.each([...CONTRACT_DISPOSITIONS])('contract disposition %s maps to its preflight exit status', (disposition) => {
    const expected = { met: 0, 'needs-changes': 1, uncertain: 1, inconclusive: 2 } as const;
    expect(PREFLIGHT_EXIT_BY_DISPOSITION[disposition]).toBe(expected[disposition]);
    expect(CONTRACT_DISPOSITIONS).not.toContain('pass');
    expect([...Object.keys(TRIGGERS)].sort()).toEqual([...PREFLIGHT_FAILURE_CODES].sort());
  });

  it('preflight GitHub read failures never yield a contract result', async () => {
    const cases: readonly { readonly response: () => Response; readonly code: string }[] = [
      { response: () => new Response('not json', { status: 200 }), code: 'github.malformed-response' },
      { response: () => jsonResponse({}), code: 'github.schema-mismatch' },
      { response: () => new Response('{}', { status: 418 }), code: 'github.unexpected-status' },
      {
        response: () => jsonResponse(testbedRepositoryBody(), 200, { 'content-length': '6000000' }),
        code: 'github.response-too-large',
      },
      {
        response: () => new Response('{}', { status: 403, headers: { 'retry-after': '3600' } }),
        code: 'github.rate-limited',
      },
    ];
    for (const c of cases) {
      const r = await run(['--issue', 'defect', '--draft', DEFECT_COMPLETE, '--repo', R, '--json'], {
        cwd: tmpDir,
        env: { GH_TOKEN: 'a' },
        fetch: routed({ [`/repos/${R}`]: c.response }),
      });
      expect(r.exit).toBe(2);
      const parsed = JSON.parse(r.stdout) as { errors: { code: string }[]; contract: unknown };
      expect(parsed.errors[0]?.code).toBe(c.code);
      expect(parsed.contract).toBeNull();
    }
  });

  it('preflight git failures never yield a contract result', async () => {
    const cases: readonly { readonly runner: ProcessRunner; readonly code: string }[] = [
      { runner: async () => err('process.unavailable', 'infrastructure', 'x'), code: 'git.unavailable' },
      { runner: async () => err('process.timeout', 'infrastructure', 'x'), code: 'git.timeout' },
      {
        runner: async () => ok({ exitCode: 128, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }),
        code: 'git.not-a-repository',
      },
    ];
    for (const c of cases) {
      let fetchCalled = false;
      const r = await run(['--pr', '--draft', PR_BUGFIX_COMPLETE, '--repo', R, '--base', 'main', '--json'], {
        cwd: os.tmpdir(),
        env: { GH_TOKEN: 'a' },
        runner: c.runner,
        fetch: async (url, init) => {
          fetchCalled = true;
          return routed(testbedRoutes())(url, init);
        },
      });
      expect(r.exit).toBe(2);
      const parsed = JSON.parse(r.stdout) as { errors: { code: string }[]; contract: unknown };
      expect(parsed.errors[0]?.code).toBe(c.code);
      expect(parsed.contract).toBeNull();
      expect(fetchCalled).toBe(false);
    }
  });

  it('preflight human output escapes control characters in untrusted text', async () => {
    const hostileFullName = `${R}${ESC}[2J${RLO}`;
    const r = await run(['--issue', 'defect', '--draft', UNSTRUCTURED, '--repo', R], {
      cwd: tmpDir,
      env: { GH_TOKEN: 'a' },
      fetch: routed(testbedRoutes({ full_name: hostileFullName })),
    });
    expect(r.exit).toBe(1);
    expect(r.stdout).not.toContain(ESC);
    expect(r.stdout).not.toContain(RLO);
    const expectedEscaped = `${R}\\u001b[2J\\u202e`;
    const lines = r.stdout.split('\n');
    const policyLine = lines.find((line) => line.startsWith('policy:'));
    expect(policyLine).toContain(expectedEscaped);
    const requestLine = lines.find((line) => line.startsWith('request ') && line.includes('issue forms'));
    expect(requestLine).toContain(expectedEscaped);
  });

  it('preflight JSON output carries no raw control or format characters', async () => {
    const hostileFullName = `${R}${ESC}[2J${RLO}`;
    const r = await run(['--issue', 'defect', '--draft', UNSTRUCTURED, '--repo', R, '--json'], {
      cwd: tmpDir,
      env: { GH_TOKEN: 'a' },
      fetch: routed(testbedRoutes({ full_name: hostileFullName })),
    });
    expect(r.exit).toBe(1);
    expect(r.stdout).not.toContain(ESC);
    expect(r.stdout).not.toContain(RLO);
    for (let i = 0; i < r.stdout.length; i += 1) {
      const cp = r.stdout.charCodeAt(i);
      if (cp < 0x20) {
        expect(cp === 0x0a && i === r.stdout.length - 1).toBe(true);
      }
    }
    const parsed = JSON.parse(r.stdout) as { repository: string };
    expect(parsed.repository).toBe(hostileFullName);
  });
});
