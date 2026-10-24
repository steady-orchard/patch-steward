import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

interface RecordedCall {
  readonly fn: string;
  readonly file: string;
  readonly args: string[];
  readonly cwd: string | null;
}

const spy = vi.hoisted(() => ({ calls: [] as RecordedCall[] }));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();

  function optionsCwd(args: unknown[]): string | null {
    for (const candidate of args.slice(1)) {
      if (typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)) {
        const cwd = (candidate as { cwd?: unknown }).cwd;
        return typeof cwd === 'string' ? cwd : null;
      }
    }
    return null;
  }

  function wrap<T extends (...args: never[]) => unknown>(fn: string, original: T): T {
    return ((...args: unknown[]) => {
      spy.calls.push({
        fn,
        file: String(args[0]),
        args: Array.isArray(args[1]) ? args[1].map(String) : [],
        cwd: optionsCwd(args),
      });
      return Reflect.apply(original, undefined, args);
    }) as unknown as T;
  }

  return {
    ...actual,
    execFile: wrap('execFile', actual.execFile),
    execFileSync: wrap('execFileSync', actual.execFileSync),
    spawn: wrap('spawn', actual.spawn),
    spawnSync: wrap('spawnSync', actual.spawnSync),
    exec: wrap('exec', actual.exec),
    execSync: wrap('execSync', actual.execSync),
    fork: wrap('fork', actual.fork),
  };
});

import { runProcess } from '@patch-steward/core';
import type { GitHubFetch } from '@patch-steward/core';
import { runPreflightCommand } from './preflight-command.js';
import type { PreflightCommandContext } from './preflight-command.js';
import type { PreflightReport } from './preflight-output.js';

const submissionsDir = fileURLToPath(new URL('../../../fixtures/submissions/', import.meta.url));
const githubFixturesDir = fileURLToPath(new URL('../../../fixtures/github/testbed/', import.meta.url));
const REPOSITORY_FULL_NAME = 'steady-orchard/patch-steward-testbed-public';

function spawnedName(call: RecordedCall): string {
  return path
    .basename(call.file)
    .replace(/\.[^.]*$/, '')
    .toLowerCase();
}

function crlfToLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function readSubmissionText(relative: string): string {
  return crlfToLf(fs.readFileSync(path.join(submissionsDir, relative), 'utf8'));
}

function readSubmissionBytes(relative: string): Buffer {
  return Buffer.from(readSubmissionText(relative), 'utf8');
}

function listBodyFiles(): readonly string[] {
  return fs.readdirSync(submissionsDir).filter((entry) => entry.endsWith('.txt') && !entry.startsWith('proposed-policy'));
}

function readGitHubFixture(relative: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(githubFixturesDir, relative), 'utf8')) as Record<string, unknown>;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function notFoundResponse(): Response {
  return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
}

function recordedFetch(): GitHubFetch {
  const routes: Record<string, () => Response> = {
    '/repos/steady-orchard/patch-steward-testbed-public': () => jsonResponse(readGitHubFixture('repository.json')),
    '/repos/steady-orchard/patch-steward-testbed-public/git/ref/heads/master': () =>
      jsonResponse(readGitHubFixture('ref-heads-master.json')),
    '/repos/steady-orchard/patch-steward-testbed-public/contents/.github': () =>
      jsonResponse(readGitHubFixture('contents-github.json')),
    '/repos/steady-orchard/patch-steward-testbed-public/issues/29': () => jsonResponse(readGitHubFixture('issue-29.json')),
  };
  return (url: string) => {
    const parsed = new URL(url);
    const handler = routes[parsed.pathname];
    return Promise.resolve(handler ? handler() : notFoundResponse());
  };
}

function stdoutCapture(): { io: { stdout: (t: string) => void; stderr: (t: string) => void }; text: () => string } {
  let out = '';
  return {
    io: {
      stdout: (t: string) => {
        out += t;
      },
      stderr: () => undefined,
    },
    text: () => out,
  };
}

describe('zero-execution spy positive control', () => {
  it('preflight process spy intercepts spawned processes', async () => {
    spy.calls.length = 0;
    const result = await runProcess(process.execPath, ['-e', ''], {
      cwd: os.tmpdir(),
      env: {},
      timeoutMs: 5000,
      maxOutputBytes: 1024,
    });
    expect(result.ok).toBe(true);
    expect(spy.calls.length).toBe(1);
  }, 60000);
});

describe('zero model calls and zero executions', () => {
  let repoDir: string;
  let configDir: string;
  let globalConfigPath: string;

  function fixtureEnv(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined || key.toUpperCase().startsWith('GIT_')) {
        continue;
      }
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

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-cli-zero-exec-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-cli-zero-exec-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');
    git(['-c', 'init.defaultBranch=main', 'init', '-q']);
    git(['remote', 'add', 'origin', 'https://github.com/steady-orchard/patch-steward-testbed-public.git']);

    const baseParseBlob = blob(Buffer.from('export function parse() {}\n', 'utf8'));
    const baseSrcTree = mktree([`100644 blob ${baseParseBlob}\tparse.ts\n`]);
    const baseTree = mktree([`040000 tree ${baseSrcTree}\tsrc\n`]);
    const baseCommit = commitTree(baseTree);

    const headParseBlob = blob(Buffer.from('export function parse() { return []; }\n', 'utf8'));
    const headSrcTree = mktree([`100644 blob ${headParseBlob}\tparse.ts\n`]);
    const policyBlob = blob(readSubmissionBytes('proposed-policy-valid.yml'));
    const patchStewardTree = mktree([`100644 blob ${policyBlob}\tpolicy.yml\n`]);
    const githubTree = mktree([`040000 tree ${patchStewardTree}\tpatch-steward\n`]);
    const headTree = mktree([`040000 tree ${headSrcTree}\tsrc\n`, `040000 tree ${githubTree}\t.github\n`]);
    const headCommit = commitTree(headTree, [baseCommit]);

    git(['update-ref', 'refs/heads/main', headCommit]);
    git(['update-ref', 'refs/remotes/origin/master', baseCommit]);

    spy.calls.length = 0;
  }, 60000);

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('without run only read-only git and gh auth token are spawned', async () => {
    spy.calls.length = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const fetch = recordedFetch();

    const seen: RecordedCall[] = [];
    for (const bodyFile of listBodyFiles()) {
      const isPullRequest = bodyFile.startsWith('pr-');
      const draftPath = path.join(submissionsDir, bodyFile);
      const argv = isPullRequest
        ? ['--pr', '--draft', draftPath, '--json']
        : [
            '--issue',
            bodyFile.startsWith('proposal-') ? 'proposal' : 'defect',
            '--draft',
            draftPath,
            '--repo',
            REPOSITORY_FULL_NAME,
            '--json',
          ];
      const context: PreflightCommandContext = {
        cwd: repoDir,
        io: stdoutCapture().io,
        env: { GH_TOKEN: 'token-z' },
        fetch,
      };
      const capture = stdoutCapture();
      const runContext: PreflightCommandContext = { ...context, io: capture.io };
      spy.calls.length = 0;
      const exitCode = await runPreflightCommand(argv, runContext);
      expect([0, 1, 2]).toContain(exitCode);
      expect(spy.calls.filter((call) => spawnedName(call) === 'gh')).toHaveLength(0);
      seen.push(...spy.calls);
      const report = JSON.parse(capture.text()) as PreflightReport;
      expect(report.unverified).toBe(true);
      if (report.contract !== null) {
        expect(['met', 'needs-changes', 'uncertain', 'inconclusive']).toContain(report.contract.disposition);
      }
    }

    const missingGhDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ps-cli-missing-')), 'missing-bin', 'gh');
    const positiveCapture = stdoutCapture();
    const positiveContext: PreflightCommandContext = {
      cwd: repoDir,
      io: positiveCapture.io,
      env: {},
      fetch,
      ghBinary: missingGhDir,
    };
    spy.calls.length = 0;
    const positiveExit = await runPreflightCommand(
      ['--pr', '--draft', path.join(submissionsDir, 'pr-bugfix-complete.txt'), '--json'],
      positiveContext,
    );
    expect(positiveExit).toBe(0);
    const positiveReport = JSON.parse(positiveCapture.text()) as PreflightReport;
    expect(positiveReport.contract?.disposition).toBe('met');
    expect(positiveReport.paths?.policy_change?.proposed?.status).toBe('valid');

    expect(spy.calls.filter((call) => spawnedName(call) === 'gh').length).toBeLessThanOrEqual(1);
    seen.push(...spy.calls);
    expect(seen.length).toBeGreaterThan(0);
    let sawGhAuthToken = false;
    let sawDiffTree = false;
    let sawMergeBase = false;
    let sawCatFile = false;
    for (const call of seen) {
      const base = spawnedName(call);
      if (base === 'git') {
        expect(['rev-parse', 'merge-base', 'diff-tree', 'ls-tree', 'cat-file', 'remote']).toContain(call.args[0]);
        if (call.args[0] === 'diff-tree') sawDiffTree = true;
        if (call.args[0] === 'merge-base') sawMergeBase = true;
        if (call.args[0] === 'cat-file') sawCatFile = true;
      } else if (base === 'gh') {
        expect(call.args).toEqual(['auth', 'token', '--hostname', 'github.com']);
        sawGhAuthToken = true;
      } else {
        throw new Error(`unexpected process file ${call.file}`);
      }
    }
    expect(sawGhAuthToken).toBe(true);
    expect(sawDiffTree).toBe(true);
    expect(sawMergeBase).toBe(true);
    expect(sawCatFile).toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  }, 240000);
});

const RUN_REPO_NAME = 'example-owner/example-repo';
const RUN_REPO_PATH = '/repos/example-owner/example-repo';
const RUN_TREE_SHA = 'a8c2485882b52f63db71b1ec63b12f5039220e03';
const RUN_BLOB_SHA = '716098133e97314ccf047f5034cc8f76161d8f0d';
const rootDir = fileURLToPath(new URL('../../../', import.meta.url));
const publishedFixturesDir = path.join(rootDir, 'fixtures', 'github');

const POLICY_ARGV: readonly (readonly string[])[] = [
  ['-e', 'process.exit(0)'],
  ['-e', 'process.exit(0); // second'],
  ['-e', 'process.exit(0); // dependency'],
];

function publishedJson(relative: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(publishedFixturesDir, relative), 'utf8')) as Record<string, unknown>;
}

function flowCommand(argv: readonly string[]): string {
  return `[node, ${argv.map((part) => JSON.stringify(part)).join(', ')}]`;
}

function commandBlock(id: string, argv: readonly string[]): string {
  return `    - id: ${id}\n      kind: test\n      run: ${flowCommand(argv)}\n      working_directory: .\n      mandatory: true\n      result_files: []\n`;
}

function publishedPolicyText(): string {
  const template = crlfToLf(fs.readFileSync(path.join(rootDir, 'templates', 'policy', 'policy.yml'), 'utf8'));
  const original = commandBlock('test', []).replace('[node, ]', '[make, test]');
  expect(template).toContain(original);
  let text = template.replace(
    original,
    commandBlock('test', POLICY_ARGV[0] as readonly string[]) + commandBlock('test-two', POLICY_ARGV[1] as readonly string[]),
  );
  expect(text).toContain('      commands: [test]');
  text = text.replace('      commands: [test]', '      commands: [test, test-two]');
  expect(text).toContain('  dependency_step: null');
  text = text.replace(
    '  dependency_step: null',
    `  dependency_step:\n    run: ${flowCommand(POLICY_ARGV[2] as readonly string[])}\n    working_directory: .`,
  );
  return text;
}

function publishedFetch(): GitHubFetch {
  const bytes = Buffer.from(publishedPolicyText(), 'utf8');
  const blob = publishedJson('policy-directory/blob-policy.json');
  blob['content'] = bytes.toString('base64');
  blob['size'] = bytes.length;
  const repository = { ...publishedJson('testbed/repository.json') };
  repository['full_name'] = RUN_REPO_NAME;
  repository['default_branch'] = 'main';
  const table: Record<string, unknown> = {
    [RUN_REPO_PATH]: repository,
    [`${RUN_REPO_PATH}/issues/29`]: publishedJson('testbed/issue-29.json'),
    [`${RUN_REPO_PATH}/git/ref/heads/main`]: publishedJson('policy-directory/ref-heads-main.json'),
    [`${RUN_REPO_PATH}/contents/.github`]: publishedJson('policy-directory/contents-github.json'),
    [`${RUN_REPO_PATH}/git/trees/${RUN_TREE_SHA}`]: publishedJson('policy-directory/tree.json'),
    [`${RUN_REPO_PATH}/git/blobs/${RUN_BLOB_SHA}`]: blob,
  };
  return (url: string) => {
    const pathname = new URL(url).pathname;
    return Promise.resolve(pathname in table ? jsonResponse(table[pathname]) : notFoundResponse());
  };
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

// Windows runners expose the temp dir as an 8.3 short name (RUNNER~1) in one place and the long name in another; the
// candidate may no longer exist, so rewrite its temp prefix instead of calling realpath on it.
function canonTemp(candidate: string): string {
  const tmp = path.resolve(os.tmpdir());
  const relative = path.relative(tmp, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return candidate;
  return path.join(fs.realpathSync.native(tmp), relative);
}

function isNodeExecutable(file: string): boolean {
  if (path.resolve(file) === path.resolve(process.execPath)) return true;
  const name = path.basename(file).toLowerCase();
  if (name !== 'node' && name !== 'node.exe') return false;
  if (path.basename(file) === file) return true;
  const dirs = (process.env['PATH'] ?? process.env['Path'] ?? '').split(path.delimiter);
  return dirs.some((dir) => dir !== '' && path.resolve(dir) === path.resolve(path.dirname(file)));
}

describe('preflight with run spawns', () => {
  let checkoutDir: string;
  let configDir: string;
  let globalConfigPath: string;
  let baseCommit: string;

  function runEnv(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined || key.toUpperCase().startsWith('GIT_')) continue;
      if (['GITHUB_ACTIONS', 'GITHUB_TOKEN', 'GH_TOKEN'].includes(key.toUpperCase())) continue;
      result[key] = value;
    }
    return result;
  }

  function git(args: readonly string[]): string {
    const env = runEnv();
    env['GIT_CONFIG_NOSYSTEM'] = '1';
    env['GIT_CONFIG_GLOBAL'] = globalConfigPath;
    env['GIT_AUTHOR_NAME'] = 'Fixture';
    env['GIT_AUTHOR_EMAIL'] = 'fixture@example.com';
    env['GIT_COMMITTER_NAME'] = 'Fixture';
    env['GIT_COMMITTER_EMAIL'] = 'fixture@example.com';
    return execFileSync('git', args, { cwd: checkoutDir, env, encoding: 'utf8' }).trim();
  }

  function write(relative: string, text: string): void {
    const target = path.join(checkoutDir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }

  beforeAll(() => {
    checkoutDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-zero-run-')));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-zero-run-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');
    git(['-c', 'init.defaultBranch=main', 'init', '-q']);
    git(['remote', 'add', 'origin', 'https://github.com/example-owner/example-repo.git']);
    write('package.json', '{ "name": "fixture", "version": "1.0.0" }\n');
    write('src/app.js', 'export const answer = 1;\n');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'base']);
    baseCommit = git(['rev-parse', 'HEAD']);
    git(['update-ref', 'refs/remotes/origin/main', baseCommit]);
    write('src/app.js', 'export const answer = 2;\n');
    write('src/parse.test.ts', 'export const parsed = true;\n');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'head']);
  }, 60000);

  afterAll(() => {
    fs.rmSync(checkoutDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('with run only the policy commands and preview git commands are spawned', async () => {
    spy.calls.length = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const capture = stdoutCapture();
    const ghParent = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-zero-gh-'));
    const context: PreflightCommandContext = {
      cwd: checkoutDir,
      io: capture.io,
      env: runEnv(),
      fetch: publishedFetch(),
      ghBinary: path.join(ghParent, 'missing-bin', 'gh'),
    };
    const argv = [
      '--pr',
      '--draft',
      path.join(submissionsDir, 'pr-bugfix-complete.txt'),
      '--repo',
      RUN_REPO_NAME,
      '--run',
      '--json',
    ];
    try {
      const exitCode = await runPreflightCommand(argv, context);
      expect([0, 1]).toContain(exitCode);
      const report = JSON.parse(capture.text()) as { run?: { preview: unknown } };
      expect(report.run?.preview).not.toBeNull();

      const temps = [os.tmpdir(), fs.realpathSync(os.tmpdir()), fs.realpathSync.native(os.tmpdir())];
      const inTemp = (candidate: string): boolean => temps.some((root) => isInside(root, path.resolve(candidate)));
      const worktrees = new Set<string>();
      for (const call of spy.calls) {
        if (call.args[0] === '-c' && call.args[3] === 'add') worktrees.add(canonTemp(path.resolve(call.args[5] ?? '')));
      }
      let adds = 0;
      let removes = 0;
      let prunes = 0;
      let ghCalls = 0;
      const policySeen = POLICY_ARGV.map(() => 0);

      for (const call of spy.calls) {
        const name = spawnedName(call);
        const a = call.args;
        const file = canonTemp(path.resolve(call.file));
        expect(isInside(checkoutDir, file)).toBe(false);
        for (const root of worktrees) {
          expect(isInside(root, file)).toBe(false);
        }
        if (name === 'git') {
          if (a[0] === '-c') {
            expect(a).toHaveLength(7);
            expect(a[1]?.startsWith('core.hooksPath=')).toBe(true);
            expect(inTemp((a[1] as string).slice('core.hooksPath='.length))).toBe(true);
            expect(a.slice(2, 5)).toEqual(['worktree', 'add', '--detach']);
            expect(inTemp(a[5] as string)).toBe(true);
            expect(a[6]).toBe(baseCommit);
            adds += 1;
          } else if (a[0] === 'worktree' && a[1] === 'remove') {
            expect(a).toHaveLength(4);
            expect(a[2]).toBe('--force');
            expect(inTemp(a[3] as string)).toBe(true);
            removes += 1;
          } else if (a[0] === 'worktree') {
            expect(a).toEqual(['worktree', 'prune']);
            prunes += 1;
          } else if (a[0] === '--no-optional-locks') {
            expect(a[1]).toBe('status');
          } else {
            expect(['rev-parse', 'merge-base', 'diff-tree', 'ls-tree', 'cat-file', 'remote', 'status']).toContain(a[0]);
          }
        } else if (name === 'gh') {
          expect(a).toEqual(['auth', 'token', '--hostname', 'github.com']);
          ghCalls += 1;
        } else if (isNodeExecutable(call.file)) {
          const index = POLICY_ARGV.findIndex((expected) => JSON.stringify(expected) === JSON.stringify(a));
          expect(index, `unexpected node argv ${JSON.stringify(a)}`).toBeGreaterThanOrEqual(0);
          policySeen[index] = (policySeen[index] ?? 0) + 1;
          expect(call.cwd, 'policy command cwd').not.toBeNull();
          const cwd = canonTemp(path.resolve(call.cwd as string));
          expect(isInside(checkoutDir, cwd) || [...worktrees].some((root) => isInside(root, cwd))).toBe(true);
        } else if (process.platform === 'win32' && name === 'cmd') {
          expect(a.slice(0, 3)).toEqual(['/d', '/s', '/c']);
        } else if (process.platform === 'win32' && name === 'taskkill') {
          expect(a[0]).toBe('/PID');
          expect(a).toContain('/T');
          expect(a).toContain('/F');
        } else {
          throw new Error(`unexpected process ${JSON.stringify(call)}`);
        }
      }

      expect(adds).toBeGreaterThanOrEqual(1);
      expect(removes).toBeGreaterThanOrEqual(1);
      expect(prunes).toBeGreaterThanOrEqual(1);
      expect(ghCalls).toBeLessThanOrEqual(1);
      for (const count of policySeen) {
        expect(count).toBeGreaterThanOrEqual(1);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      fs.rmSync(ghParent, { recursive: true, force: true, maxRetries: 3 });
    }
  }, 240000);
});
