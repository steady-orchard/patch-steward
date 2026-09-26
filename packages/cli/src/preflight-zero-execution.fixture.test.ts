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
}

const spy = vi.hoisted(() => ({ calls: [] as RecordedCall[] }));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();

  function wrap<T extends (...args: never[]) => unknown>(fn: string, original: T): T {
    return ((...args: unknown[]) => {
      spy.calls.push({
        fn,
        file: String(args[0]),
        args: Array.isArray(args[1]) ? args[1].map(String) : [],
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

  it('zero model calls and zero executions', async () => {
    spy.calls.length = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const fetch = recordedFetch();

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
      const exitCode = await runPreflightCommand(argv, runContext);
      expect([0, 1, 2]).toContain(exitCode);
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
    const positiveExit = await runPreflightCommand(
      ['--pr', '--draft', path.join(submissionsDir, 'pr-bugfix-complete.txt'), '--json'],
      positiveContext,
    );
    expect(positiveExit).toBe(0);
    const positiveReport = JSON.parse(positiveCapture.text()) as PreflightReport;
    expect(positiveReport.contract?.disposition).toBe('met');
    expect(positiveReport.paths?.policy_change?.proposed?.status).toBe('valid');

    expect(spy.calls.length).toBeGreaterThan(0);
    let sawGhAuthToken = false;
    let sawDiffTree = false;
    let sawMergeBase = false;
    let sawCatFile = false;
    for (const call of spy.calls) {
      const base = path.basename(call.file).replace(/\.[^.]*$/, '');
      if (base === 'git') {
        expect(['rev-parse', 'merge-base', 'diff-tree', 'ls-tree', 'cat-file', 'remote']).toContain(call.args[0]);
        if (call.args[0] === 'diff-tree') sawDiffTree = true;
        if (call.args[0] === 'merge-base') sawMergeBase = true;
        if (call.args[0] === 'cat-file') sawCatFile = true;
      } else if (base === 'gh') {
        expect(call.args[0]).toBe('auth');
        expect(call.args[1]).toBe('token');
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
