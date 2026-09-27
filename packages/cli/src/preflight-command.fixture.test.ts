import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GitHubFetch, GitHubFetchInit, ProcessRunner } from '@patch-steward/core';
import { PREFLIGHT_UNAUTHENTICATED_WARNING, runPreflightCommand } from './preflight-command.js';
import type { PreflightCommandContext } from './preflight-command.js';
import { PREFLIGHT_NOTICE } from './preflight-output.js';
import { PREFLIGHT_USAGE } from './preflight-args.js';

const githubFixturesDir = fileURLToPath(new URL('../../../fixtures/github/', import.meta.url));
const submissionsDir = fileURLToPath(new URL('../../../fixtures/submissions/', import.meta.url));

function crlfToLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function readJsonFixture(relative: string): unknown {
  return JSON.parse(readFileSync(path.join(githubFixturesDir, relative), 'utf8'));
}

function draftPath(name: string): string {
  return path.join(submissionsDir, name);
}

interface RouteMap {
  readonly [pathname: string]: unknown;
}

function fetchFor(routes: RouteMap, overrides?: Readonly<Record<string, number>>): GitHubFetch {
  return (url: string): Promise<Response> => {
    const pathname = new URL(url).pathname;
    if (!(pathname in routes)) {
      return Promise.resolve(new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }));
    }
    const status = overrides?.[pathname] ?? 200;
    return Promise.resolve(new Response(JSON.stringify(routes[pathname]), { status }));
  };
}

function fetchCapturingAuth(
  routes: RouteMap,
  overrides: Readonly<Record<string, number>> | undefined,
  captured: string[],
): GitHubFetch {
  const inner = fetchFor(routes, overrides);
  return (url: string, init: GitHubFetchInit): Promise<Response> => {
    const auth = init.headers['authorization'];
    if (auth !== undefined) {
      captured.push(auth);
    }
    return inner(url, init);
  };
}

interface RunResult {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface RunOptions {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetch?: GitHubFetch;
  readonly runner?: ProcessRunner;
  readonly ghBinary?: string;
}

async function run(argv: readonly string[], options: RunOptions): Promise<RunResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const context: PreflightCommandContext = {
    cwd: options.cwd,
    io: {
      stdout: (text) => {
        stdout.push(text);
      },
      stderr: (text) => {
        stderr.push(text);
      },
    },
    ...(options.env !== undefined ? { env: options.env } : {}),
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    ...(options.runner !== undefined ? { runner: options.runner } : {}),
    ...(options.ghBinary !== undefined ? { ghBinary: options.ghBinary } : {}),
  };
  const exit = await runPreflightCommand(argv, context);
  return { exit, stdout: stdout.join(''), stderr: stderr.join('') };
}

function neverFetch(): GitHubFetch {
  return () => {
    throw new Error('no request should have been made');
  };
}

const TESTBED_FULL_NAME = 'steady-orchard/patch-steward-testbed-public';
const TESTBED_REPO_PATH = '/repos/steady-orchard/patch-steward-testbed-public';

function testbedRoutes(): Record<string, unknown> {
  return {
    [TESTBED_REPO_PATH]: readJsonFixture('testbed/repository.json'),
    [`${TESTBED_REPO_PATH}/git/ref/heads/master`]: readJsonFixture('testbed/ref-heads-master.json'),
    [`${TESTBED_REPO_PATH}/contents/.github`]: readJsonFixture('testbed/contents-github.json'),
    [`${TESTBED_REPO_PATH}/issues/29`]: readJsonFixture('testbed/issue-29.json'),
  };
}

const EXAMPLE_REPO_PATH = '/repos/example-owner/example-repo';
const EXAMPLE_TREE_SHA = 'a8c2485882b52f63db71b1ec63b12f5039220e03';
const EXAMPLE_BLOB_SHA = '716098133e97314ccf047f5034cc8f76161d8f0d';

function exampleRoutes(): Record<string, unknown> {
  const repository = { ...(readJsonFixture('testbed/repository.json') as Record<string, unknown>) };
  repository['full_name'] = 'example-owner/example-repo';
  repository['default_branch'] = 'main';
  return {
    [EXAMPLE_REPO_PATH]: repository,
    [`${EXAMPLE_REPO_PATH}/git/ref/heads/main`]: readJsonFixture('policy-directory/ref-heads-main.json'),
    [`${EXAMPLE_REPO_PATH}/contents/.github`]: readJsonFixture('policy-directory/contents-github.json'),
    [`${EXAMPLE_REPO_PATH}/git/trees/${EXAMPLE_TREE_SHA}`]: readJsonFixture('policy-directory/tree.json'),
    [`${EXAMPLE_REPO_PATH}/git/blobs/${EXAMPLE_BLOB_SHA}`]: readJsonFixture('policy-directory/blob-policy.json'),
  };
}

function invalidBlobRoutes(): Record<string, unknown> {
  const text = 'version: 1\nbogus: true\n';
  const bytes = Buffer.from(text, 'utf8');
  const invalidBlob = { ...(readJsonFixture('policy-directory/blob-policy.json') as Record<string, unknown>) };
  invalidBlob['content'] = bytes.toString('base64');
  invalidBlob['size'] = bytes.length;
  return {
    ...exampleRoutes(),
    [`${EXAMPLE_REPO_PATH}/git/blobs/${EXAMPLE_BLOB_SHA}`]: invalidBlob,
  };
}

interface JsonReport {
  readonly schema_version: number;
  readonly unverified: boolean;
  readonly notice: string;
  readonly submission: { readonly type: string; readonly issue_kind: string | null } | null;
  readonly repository: string | null;
  readonly policy: Record<string, unknown> | null;
  readonly contract: {
    readonly disposition: string;
    readonly findings: readonly { readonly code: string; readonly detail: string | null }[];
    readonly requests: readonly { readonly number: number; readonly text: string }[];
    readonly inconclusive: readonly { readonly code: string }[];
    readonly category: string | null;
    readonly plausible_categories: readonly string[];
    readonly effective_mode: string;
    readonly enforced: boolean;
    readonly template: unknown;
  } | null;
  readonly paths: {
    readonly base: string;
    readonly head: string;
    readonly merge_base: string;
    readonly changed: number | null;
    readonly trusted_changed: boolean;
    readonly execution_sensitive_changed: boolean;
    readonly policy_changed: boolean;
    readonly trusted_paths: readonly string[];
    readonly execution_sensitive_paths: readonly string[];
    readonly policy_paths: readonly string[];
    readonly policy_change: {
      readonly changed: boolean;
      readonly proposed: { readonly status: string; readonly revision: string } | null;
    } | null;
  } | null;
  readonly warnings: readonly { readonly code: string; readonly message: string }[];
  readonly errors: readonly { readonly code: string; readonly path: string; readonly message: string }[];
}

describe('preflight command fixture corpus', () => {
  it('recorded: complete defect draft exits 0 with the default checklist', async () => {
    const result = await run(['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME], {
      cwd: os.tmpdir(),
      env: { GH_TOKEN: 'token-a' },
      fetch: fetchFor(testbedRoutes()),
    });
    expect(result.exit).toBe(0);
    expect(result.stdout).toBe(
      [
        PREFLIGHT_NOTICE,
        'policy: default checklist (steady-orchard/patch-steward-testbed-public has no published policy on master)',
        'submission: issue defect',
        'template: defect v1',
        'mode: observe enforced false',
        'disposition: met',
      ]
        .map((line) => `${line}\n`)
        .join(''),
    );
    expect(result.stderr).toBe('');
  }, 60000);

  it('recorded: defect draft missing a field exits 1 with the JSON report', async () => {
    const result = await run(
      ['--issue', 'defect', '--draft', draftPath('defect-no-response.txt'), '--repo', TESTBED_FULL_NAME, '--json'],
      { cwd: os.tmpdir(), env: { GH_TOKEN: 'token-a' }, fetch: fetchFor(testbedRoutes()) },
    );
    expect(result.exit).toBe(1);
    const report = JSON.parse(result.stdout) as JsonReport;
    expect(report.unverified).toBe(true);
    expect(report.notice).toBe(PREFLIGHT_NOTICE);
    expect(report.submission).toEqual({ type: 'issue', issue_kind: 'defect' });
    expect(report.policy?.['source']).toBe('default-checklist');
    expect(report.contract?.disposition).toBe('needs-changes');
    expect(report.contract?.findings.map((f) => f.code)).toEqual(['submission.field-missing']);
    expect(report.contract?.requests[0]?.text).toBe('Fill in the "Authoritative basis" section of the issue body.');
    expect(report.paths).toBeNull();
    expect(report.errors).toEqual([]);
  }, 60000);

  it('recorded: published policy is named with its revision', async () => {
    const result = await run(
      ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', 'example-owner/example-repo'],
      { cwd: os.tmpdir(), env: { GH_TOKEN: 'token-a' }, fetch: fetchFor(exampleRoutes()) },
    );
    expect(result.exit).toBe(0);
    const lines = result.stdout.split('\n');
    expect(lines[1]).toBe(
      'policy: published example-owner/example-repo main commit 0123456789abcdef0123456789abcdef01234567 revision a8c2485882b52f63db71b1ec63b12f5039220e03',
    );
  }, 60000);

  it('recorded: invalid published policy exits 2 without a default', async () => {
    const result = await run(
      ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', 'example-owner/example-repo', '--json'],
      { cwd: os.tmpdir(), env: { GH_TOKEN: 'token-a' }, fetch: fetchFor(invalidBlobRoutes()) },
    );
    expect(result.exit).toBe(2);
    const report = JSON.parse(result.stdout) as JsonReport;
    expect(report.errors[0]?.code).toBe('preflight.policy-invalid');
    expect(report.errors.some((e) => e.code === 'policy.unknown-key' && e.path === 'bogus')).toBe(true);
    expect(report.contract).toBeNull();
    expect(report.policy).toBeNull();
  }, 60000);

  it('recorded: GH_TOKEN comes before GITHUB_TOKEN', async () => {
    const capturedA: string[] = [];
    const resultA = await run(['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME], {
      cwd: os.tmpdir(),
      env: { GH_TOKEN: 'token-a', GITHUB_TOKEN: 'token-b' },
      fetch: fetchCapturingAuth(testbedRoutes(), undefined, capturedA),
      runner: (): never => {
        throw new Error('gh should not have been invoked');
      },
    });
    expect(resultA.exit).toBe(0);
    expect(capturedA.length).toBeGreaterThan(0);
    expect(capturedA.every((h) => h === 'Bearer token-a')).toBe(true);

    const capturedB: string[] = [];
    const resultB = await run(['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME], {
      cwd: os.tmpdir(),
      env: { GITHUB_TOKEN: 'token-b' },
      fetch: fetchCapturingAuth(testbedRoutes(), undefined, capturedB),
      runner: (): never => {
        throw new Error('gh should not have been invoked');
      },
    });
    expect(resultB.exit).toBe(0);
    expect(capturedB.length).toBeGreaterThan(0);
    expect(capturedB.every((h) => h === 'Bearer token-b')).toBe(true);
  }, 60000);

  it('recorded: gh auth token is used when no variable is set', async () => {
    const calls: { binary: string; args: readonly string[] }[] = [];
    const runner: ProcessRunner = async (binary, args) => {
      calls.push({ binary, args });
      return { ok: true, value: { exitCode: 0, stdout: Buffer.from('token-c\n'), stderr: Buffer.alloc(0) } };
    };
    const captured: string[] = [];
    const result = await run(['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME], {
      cwd: os.tmpdir(),
      env: {},
      fetch: fetchCapturingAuth(testbedRoutes(), undefined, captured),
      runner,
    });
    expect(result.exit).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.binary).toBe('gh');
    expect(calls[0]?.args).toEqual(['auth', 'token', '--hostname', 'github.com']);
    expect(captured.length).toBeGreaterThan(0);
    expect(captured.every((h) => h === 'Bearer token-c')).toBe(true);
  }, 60000);

  it('recorded: no token reads unauthenticated with a warning', async () => {
    const missingGhBinary = path.join(os.tmpdir(), 'ps-preflight-missing-dir', 'gh');
    const captured: string[] = [];
    const result = await run(['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME], {
      cwd: os.tmpdir(),
      env: {},
      fetch: fetchCapturingAuth(testbedRoutes(), undefined, captured),
      ghBinary: missingGhBinary,
    });
    expect(result.exit).toBe(0);
    expect(result.stderr).toBe(`warning github.unauthenticated: ${PREFLIGHT_UNAUTHENTICATED_WARNING}\n`);
    expect(captured).toEqual([]);

    const jsonResult = await run(
      ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME, '--json'],
      { cwd: os.tmpdir(), env: {}, fetch: fetchFor(testbedRoutes()), ghBinary: missingGhBinary },
    );
    const report = JSON.parse(jsonResult.stdout) as JsonReport;
    expect(report.warnings[0]?.code).toBe('github.unauthenticated');
    expect(jsonResult.stderr).toBe('');
  }, 60000);

  it('recorded: a rejected token exits 2 without fallback', async () => {
    const captured: string[] = [];
    const routes = testbedRoutes();
    const result = await run(['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME], {
      cwd: os.tmpdir(),
      env: { GH_TOKEN: 'token-a' },
      fetch: fetchCapturingAuth(routes, { [TESTBED_REPO_PATH]: 401 }, captured),
    });
    expect(result.exit).toBe(2);
    expect(result.stderr).toBe(
      'error preflight.token-rejected -: GitHub rejected the token; no unauthenticated fallback was attempted.\n',
    );
    expect(captured).toEqual(['Bearer token-a']);
  }, 60000);

  it('recorded: a missing or private repository exits 2', async () => {
    const result = await run(
      ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME, '--json'],
      {
        cwd: os.tmpdir(),
        env: {},
        fetch: fetchFor({}),
        ghBinary: path.join(os.tmpdir(), 'ps-preflight-missing-dir', 'gh'),
      },
    );
    expect(result.exit).toBe(2);
    const report = JSON.parse(result.stdout) as JsonReport;
    expect(report.errors[0]).toEqual({
      code: 'preflight.repository-unavailable',
      path: '',
      message:
        'The repository steady-orchard/patch-steward-testbed-public does not exist or is private; set GH_TOKEN or GITHUB_TOKEN, or log in with gh.',
    });
  }, 60000);

  it('recorded: usage errors exit 2 with the usage line', async () => {
    const conflicting = await run(['--issue', 'defect', '--pr', '--draft', 'x.txt'], { cwd: os.tmpdir(), fetch: neverFetch() });
    expect(conflicting.exit).toBe(2);
    expect(conflicting.stdout).toBe('');
    expect(conflicting.stderr.endsWith(`${PREFLIGHT_USAGE}\n`)).toBe(true);
    expect(conflicting.stderr).toContain('usage.conflicting-options');

    const unknown = await run(['--bogus'], { cwd: os.tmpdir(), fetch: neverFetch() });
    expect(unknown.exit).toBe(2);
    expect(unknown.stderr.endsWith(`${PREFLIGHT_USAGE}\n`)).toBe(true);
    expect(unknown.stderr).toContain('usage.unknown-option');

    const invalid = await run(['--pr'], { cwd: os.tmpdir(), fetch: neverFetch() });
    expect(invalid.exit).toBe(2);
    expect(invalid.stderr.endsWith(`${PREFLIGHT_USAGE}\n`)).toBe(true);
    expect(invalid.stderr).toContain('usage.invalid-arguments');
  }, 60000);

  describe('recorded: pull request exit statuses over a local diff', () => {
    let repoDir: string;
    let configDir: string;
    let globalConfigPath: string;
    let baseCommit: string;
    let srcCommit: string;
    let pkgCommit: string;
    let policyCommit: string;

    function fixtureEnv(): Record<string, string> {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value === undefined) continue;
        if (key.toUpperCase().startsWith('GIT_')) continue;
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

    function git(args: readonly string[], input?: Buffer): string {
      const out = execFileSync('git', args, { cwd: repoDir, env: fixtureEnv(), input, encoding: 'buffer' });
      return out.toString('utf8').trim();
    }

    function blob(bytes: Buffer): string {
      return git(['hash-object', '-w', '--no-filters', '--stdin'], bytes);
    }

    function mktree(lines: readonly string[]): string {
      return git(['mktree'], Buffer.from(lines.join(''), 'utf8'));
    }

    function commitTree(tree: string, parents: readonly string[] = []): string {
      const args = ['commit-tree', tree];
      for (const parent of parents) {
        args.push('-p', parent);
      }
      args.push('-m', 'fixture');
      return git(args);
    }

    function checkout(head: string): void {
      git(['update-ref', 'refs/heads/main', head]);
    }

    beforeAll(() => {
      repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-preflight-'));
      configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-preflight-cfg-'));
      globalConfigPath = path.join(configDir, 'gitconfig');
      fs.writeFileSync(globalConfigPath, '');
      git(['-c', 'init.defaultBranch=main', 'init', '-q']);
      git(['remote', 'add', 'origin', 'https://github.com/steady-orchard/patch-steward-testbed-public.git']);

      const pkgBlobBase = blob(Buffer.from('{ "name": "fixture", "version": "1.0.0" }\n', 'utf8'));
      const srcBlobBase = blob(Buffer.from('export const answer = 1;\n', 'utf8'));
      const srcTreeBase = mktree([`100644 blob ${srcBlobBase}\tapp.js\n`]);
      const rootTreeBase = mktree([`100644 blob ${pkgBlobBase}\tpackage.json\n`, `040000 tree ${srcTreeBase}\tsrc\n`]);
      baseCommit = commitTree(rootTreeBase);
      git(['update-ref', 'refs/remotes/origin/master', baseCommit]);

      const srcBlobHead = blob(Buffer.from('export const answer = 2;\n', 'utf8'));
      const srcTreeHead = mktree([`100644 blob ${srcBlobHead}\tapp.js\n`]);

      const rootTreeSrc = mktree([`100644 blob ${pkgBlobBase}\tpackage.json\n`, `040000 tree ${srcTreeHead}\tsrc\n`]);
      srcCommit = commitTree(rootTreeSrc, [baseCommit]);

      const pkgBlobHead = blob(Buffer.from('{ "name": "fixture", "version": "1.0.1" }\n', 'utf8'));
      const rootTreePkg = mktree([`100644 blob ${pkgBlobHead}\tpackage.json\n`, `040000 tree ${srcTreeHead}\tsrc\n`]);
      pkgCommit = commitTree(rootTreePkg, [baseCommit]);

      const policyText = crlfToLf(readFileSync(path.join(submissionsDir, 'proposed-policy-valid.yml'), 'utf8'));
      const policyBlob = blob(Buffer.from(policyText, 'utf8'));
      const policyDirTree = mktree([`100644 blob ${policyBlob}\tpolicy.yml\n`]);
      const githubDirTree = mktree([`040000 tree ${policyDirTree}\tpatch-steward\n`]);
      const rootTreePolicy = mktree([
        `100644 blob ${pkgBlobBase}\tpackage.json\n`,
        `040000 tree ${srcTreeHead}\tsrc\n`,
        `040000 tree ${githubDirTree}\t.github\n`,
      ]);
      policyCommit = commitTree(rootTreePolicy, [baseCommit]);
    }, 60000);

    afterAll(() => {
      fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
      fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
    });

    it('recorded: pull request exit statuses follow the contract disposition', async () => {
      checkout(srcCommit);
      const bugfixSrc = await run(['--pr', '--draft', draftPath('pr-bugfix-complete.txt'), '--repo', TESTBED_FULL_NAME, '--json'], {
        cwd: repoDir,
        env: { GH_TOKEN: 'token-a' },
        fetch: fetchFor(testbedRoutes()),
      });
      expect(bugfixSrc.exit).toBe(0);
      const bugfixSrcReport = JSON.parse(bugfixSrc.stdout) as JsonReport;
      expect(bugfixSrcReport.contract?.disposition).toBe('met');

      checkout(pkgCommit);
      const bugfixPkg = await run(['--pr', '--draft', draftPath('pr-bugfix-complete.txt'), '--repo', TESTBED_FULL_NAME, '--json'], {
        cwd: repoDir,
        env: { GH_TOKEN: 'token-a' },
        fetch: fetchFor(testbedRoutes()),
      });
      expect(bugfixPkg.exit).toBe(1);
      const bugfixPkgReport = JSON.parse(bugfixPkg.stdout) as JsonReport;
      expect(bugfixPkgReport.contract?.disposition).toBe('uncertain');
      expect(bugfixPkgReport.contract?.findings.some((f) => f.code === 'submission.execution-sensitive-change')).toBe(true);

      checkout(srcCommit);
      const docsSrc = await run(['--pr', '--draft', draftPath('pr-docs.txt'), '--repo', TESTBED_FULL_NAME, '--json'], {
        cwd: repoDir,
        env: { GH_TOKEN: 'token-a' },
        fetch: fetchFor(testbedRoutes()),
      });
      expect(docsSrc.exit).toBe(1);
      const docsSrcReport = JSON.parse(docsSrc.stdout) as JsonReport;
      expect(docsSrcReport.contract?.disposition).toBe('uncertain');
      expect(docsSrcReport.contract?.findings.some((f) => f.code === 'submission.category-mismatch')).toBe(true);

      checkout(policyCommit);
      const bugfixPolicy = await run(
        ['--pr', '--draft', draftPath('pr-bugfix-complete.txt'), '--repo', TESTBED_FULL_NAME, '--json'],
        {
          cwd: repoDir,
          env: { GH_TOKEN: 'token-a' },
          fetch: fetchFor(testbedRoutes()),
        },
      );
      expect(bugfixPolicy.exit).toBe(0);
      const bugfixPolicyReport = JSON.parse(bugfixPolicy.stdout) as JsonReport;
      expect(bugfixPolicyReport.contract?.disposition).toBe('met');
      const policyFinding = bugfixPolicyReport.contract?.findings.find((f) => f.code === 'submission.policy-change');
      expect(policyFinding?.detail).toBe('valid');
      expect(bugfixPolicyReport.paths?.policy_change?.changed).toBe(true);
      expect(bugfixPolicyReport.paths?.policy_change?.proposed?.status).toBe('valid');
      expect(bugfixPolicyReport.paths?.policy_change?.proposed?.revision).toMatch(/^[0-9a-f]{40}$/);

      checkout(srcCommit);
      const categoryMissing = await run(
        ['--pr', '--draft', draftPath('pr-category-missing.txt'), '--repo', TESTBED_FULL_NAME, '--json'],
        { cwd: repoDir, env: { GH_TOKEN: 'token-a' }, fetch: fetchFor(testbedRoutes()) },
      );
      expect(categoryMissing.exit).toBe(1);
      const categoryMissingReport = JSON.parse(categoryMissing.stdout) as JsonReport;
      expect(categoryMissingReport.contract?.disposition).toBe('needs-changes');
      expect(categoryMissingReport.contract?.findings.some((f) => f.code === 'submission.category-missing')).toBe(true);

      checkout(srcCommit);
      const inconclusive = await run(
        ['--pr', '--draft', draftPath('pr-bugfix-complete.txt'), '--repo', TESTBED_FULL_NAME, '--json'],
        {
          cwd: repoDir,
          env: { GH_TOKEN: 'token-a' },
          fetch: fetchFor(testbedRoutes(), { [`${TESTBED_REPO_PATH}/issues/29`]: 422 }),
        },
      );
      expect(inconclusive.exit).toBe(3);
      const inconclusiveReport = JSON.parse(inconclusive.stdout) as JsonReport;
      expect(inconclusiveReport.contract?.disposition).toBe('inconclusive');
      expect(inconclusiveReport.contract?.inconclusive[0]?.code).toBe('github.unexpected-status');
    }, 60000);

    it('recorded: JSON reports have the documented shape', async () => {
      checkout(srcCommit);
      const issueResult = await run(
        ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME, '--json'],
        { cwd: os.tmpdir(), env: { GH_TOKEN: 'token-a' }, fetch: fetchFor(testbedRoutes()) },
      );
      expect(issueResult.exit).toBe(0);
      const issueReport = JSON.parse(issueResult.stdout) as JsonReport;

      const prResult = await run(['--pr', '--draft', draftPath('pr-bugfix-complete.txt'), '--repo', TESTBED_FULL_NAME, '--json'], {
        cwd: repoDir,
        env: { GH_TOKEN: 'token-a' },
        fetch: fetchFor(testbedRoutes()),
      });
      expect(prResult.exit).toBe(0);
      const prReport = JSON.parse(prResult.stdout) as JsonReport;

      const rejectedResult = await run(
        ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME, '--json'],
        { cwd: os.tmpdir(), env: { GH_TOKEN: 'token-a' }, fetch: fetchFor(testbedRoutes(), { [TESTBED_REPO_PATH]: 401 }) },
      );
      expect(rejectedResult.exit).toBe(2);
      const rejectedReport = JSON.parse(rejectedResult.stdout) as JsonReport;

      const topLevel = [
        'contract',
        'errors',
        'notice',
        'paths',
        'policy',
        'repository',
        'schema_version',
        'submission',
        'unverified',
      ];
      for (const report of [issueReport, prReport, rejectedReport]) {
        expect(Object.keys(report).sort()).toEqual([...topLevel, 'warnings'].sort());
        expect(report.schema_version).toBe(1);
        expect(report.unverified).toBe(true);
      }

      expect(Object.keys(issueReport.policy as object).sort()).toEqual(['commit', 'ref', 'repository', 'revision', 'source']);
      expect(Object.keys(prReport.policy as object).sort()).toEqual(['commit', 'ref', 'repository', 'revision', 'source']);
      expect(Object.keys(issueReport.contract as object).sort()).toEqual(
        [
          'category',
          'disposition',
          'effective_mode',
          'enforced',
          'findings',
          'inconclusive',
          'plausible_categories',
          'requests',
          'template',
        ].sort(),
      );
      expect(Object.keys(prReport.contract as object).sort()).toEqual(
        [
          'category',
          'disposition',
          'effective_mode',
          'enforced',
          'findings',
          'inconclusive',
          'plausible_categories',
          'requests',
          'template',
        ].sort(),
      );
      expect(Object.keys(prReport.paths as object).sort()).toEqual(
        [
          'base',
          'changed',
          'execution_sensitive_changed',
          'execution_sensitive_paths',
          'head',
          'merge_base',
          'policy_change',
          'policy_changed',
          'policy_paths',
          'trusted_changed',
          'trusted_paths',
        ].sort(),
      );
      expect(Object.keys(rejectedReport.errors[0] as object).sort()).toEqual(['code', 'message', 'path']);
      expect(rejectedReport.contract).toBeNull();
      expect(rejectedReport.paths).toBeNull();
      expect(rejectedReport.policy).toBeNull();
      expect(issueReport.paths).toBeNull();
    }, 60000);

    it('preflight never prints the token', async () => {
      const SENTINEL = 'sentinel-token-4d9e1b7a';
      const captured: string[] = [];

      async function assertNoLeak(exit: number, stdout: string, stderr: string): Promise<void> {
        expect(exit).toBeGreaterThanOrEqual(0);
        expect(stdout).not.toContain(SENTINEL);
        expect(stderr).not.toContain(SENTINEL);
      }

      for (const json of [false, true]) {
        const jsonFlag = json ? ['--json'] : [];

        checkout(srcCommit);
        const a = await run(
          ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME, ...jsonFlag],
          { cwd: os.tmpdir(), env: { GH_TOKEN: SENTINEL }, fetch: fetchCapturingAuth(testbedRoutes(), undefined, captured) },
        );
        expect(a.exit).toBe(0);
        await assertNoLeak(a.exit, a.stdout, a.stderr);

        const b = await run(
          ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME, ...jsonFlag],
          {
            cwd: os.tmpdir(),
            env: { GH_TOKEN: SENTINEL },
            fetch: fetchCapturingAuth(testbedRoutes(), { [TESTBED_REPO_PATH]: 401 }, captured),
          },
        );
        expect(b.exit).toBe(2);
        await assertNoLeak(b.exit, b.stdout, b.stderr);

        const c = await run(
          ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME, ...jsonFlag],
          { cwd: os.tmpdir(), env: { GH_TOKEN: SENTINEL }, fetch: fetchCapturingAuth({}, undefined, captured) },
        );
        expect(c.exit).toBe(2);
        await assertNoLeak(c.exit, c.stdout, c.stderr);

        const d = await run(
          ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', 'example-owner/example-repo', ...jsonFlag],
          { cwd: os.tmpdir(), env: { GH_TOKEN: SENTINEL }, fetch: fetchCapturingAuth(invalidBlobRoutes(), undefined, captured) },
        );
        expect(d.exit).toBe(2);
        await assertNoLeak(d.exit, d.stdout, d.stderr);

        const eRunner: ProcessRunner = async () => ({
          ok: true,
          value: { exitCode: 0, stdout: Buffer.from(`${SENTINEL}\n`), stderr: Buffer.alloc(0) },
        });
        const e = await run(
          ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME, ...jsonFlag],
          { cwd: os.tmpdir(), env: {}, fetch: fetchCapturingAuth(testbedRoutes(), undefined, captured), runner: eRunner },
        );
        expect(e.exit).toBe(0);
        await assertNoLeak(e.exit, e.stdout, e.stderr);

        const f = await run(
          ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME, ...jsonFlag],
          { cwd: os.tmpdir(), env: { GH_TOKEN: `${SENTINEL} x` }, fetch: neverFetch() },
        );
        expect(f.exit).toBe(2);
        expect(f.stderr + f.stdout).toContain('auth.token-invalid');
        await assertNoLeak(f.exit, f.stdout, f.stderr);

        checkout(srcCommit);
        const throwingRunner: ProcessRunner = () => {
          throw new Error(`boom ${SENTINEL}`);
        };
        const g = await run(
          ['--pr', '--repo', TESTBED_FULL_NAME, '--base', 'main', '--draft', draftPath('pr-bugfix-complete.txt'), ...jsonFlag],
          {
            cwd: os.tmpdir(),
            env: { GH_TOKEN: 'token-a' },
            fetch: neverFetch(),
            runner: throwingRunner,
          },
        );
        expect(g.exit).toBe(2);
        expect(g.stderr + g.stdout).toContain('steward.internal-error');
        await assertNoLeak(g.exit, g.stdout, g.stderr);

        if (json) {
          const throwingFetch: GitHubFetch = () => {
            throw new Error(`network down ${SENTINEL}`);
          };
          const h = await run(
            ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', TESTBED_FULL_NAME, '--json'],
            { cwd: os.tmpdir(), env: { GH_TOKEN: 'token-a' }, fetch: throwingFetch },
          );
          expect(h.exit).toBe(2);
          await assertNoLeak(h.exit, h.stdout, h.stderr);
        }
      }

      expect(captured).toContain(`Bearer ${SENTINEL}`);
    }, 60000);
  });
});
