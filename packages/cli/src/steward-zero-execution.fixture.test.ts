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

import { fixedClock, fixedRandom, runProcess } from '@patch-steward/core';
import type { GitHubFetch, GitHubFetchInit } from '@patch-steward/core';
import { runScreenCommand } from './screen-command.js';
import type { ScreenCommandContext } from './screen-command.js';
import { runReportCommand } from './report-command.js';

const githubFixturesDir = fileURLToPath(new URL('../../../fixtures/github/testbed/', import.meta.url));
const TEMPLATE = fileURLToPath(new URL('../../../templates/policy/policy.yml', import.meta.url));
const T = '/repos/steady-orchard/patch-steward-testbed-public';
const HEAD_SHA = 'b46eef5018c202bcb2470bf62e3defd7496ec65b';
const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';

function readGitHubFixture(relative: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(githubFixturesDir, relative), 'utf8')) as Record<string, unknown>;
}

function withBody(relative: string, body: string): Record<string, unknown> {
  return { ...readGitHubFixture(relative), body };
}

function crlfToLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function readSubmissionText(relative: string): string {
  const submissionsDir = fileURLToPath(new URL('../../../fixtures/submissions/', import.meta.url));
  return crlfToLf(fs.readFileSync(path.join(submissionsDir, relative), 'utf8'));
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function notFoundResponse(): Response {
  return new Response('{}', { status: 404 });
}

type RouteMap = Record<string, () => Response>;

function routedFetch(routes: RouteMap): GitHubFetch {
  return (url: string) => {
    const parsed = new URL(url);
    const handler = routes[parsed.pathname];
    return Promise.resolve(handler ? handler() : notFoundResponse());
  };
}

async function fakeAttachmentResolver(): Promise<readonly { address: string; family: 4 }[]> {
  return [{ address: '140.82.112.3', family: 4 }];
}

async function fakeAttachmentTransport(): Promise<{
  kind: 'response';
  status: 200;
  location: null;
  body: AsyncIterable<Uint8Array>;
  close: () => void;
}> {
  return {
    kind: 'response',
    status: 200,
    location: null,
    body: (async function* (): AsyncGenerator<Uint8Array> {
      yield new Uint8Array();
    })(),
    close: () => undefined,
  };
}

async function noopSleep(): Promise<void> {
  return undefined;
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
  it('screen command process spy intercepts spawned processes', async () => {
    spy.calls.length = 0;
    const result = await runProcess(process.execPath, ['-e', ''], {
      cwd: os.tmpdir(),
      env: {},
      timeoutMs: 5000,
      maxOutputBytes: 1024,
    });
    expect(result.ok).toBe(true);
    expect(spy.calls.length).toBe(1);
  }, 120000);
});

describe('zero-execution: screen and report commands', () => {
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

  function git(args: readonly string[]): string {
    return execFileSync('git', args, { cwd: repoDir, env: fixtureEnv(), encoding: 'utf8' }).trim();
  }

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm5-czx-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm5-czx-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');
    git(['-c', 'init.defaultBranch=main', 'init', '-q']);
    git(['remote', 'add', 'origin', 'https://github.com/steady-orchard/patch-steward-testbed-public.git']);
  }, 60000);

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('zero model calls and zero executions in the screen and report commands', async () => {
    const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm5-czx-'));
    const missingGhDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'm5-czx-')), 'missing-gh', 'gh');
    try {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const screenRoutes: RouteMap = {
        [T]: () => jsonResponse(readGitHubFixture('repository.json')),
        [`${T}/issues/29`]: () => jsonResponse(readGitHubFixture('issue-29.json')),
      };

      spy.calls.length = 0;
      const screenCapture = stdoutCapture();
      const screenContext: ScreenCommandContext = {
        cwd: repoDir,
        io: screenCapture.io,
        env: {},
        ghBinary: missingGhDir,
        fetch: routedFetch(screenRoutes),
        attachmentResolver: fakeAttachmentResolver,
        attachmentTransport: fakeAttachmentTransport,
        clock: fixedClock('2026-09-27T10:15:00.000Z'),
        random: fixedRandom('3f9a1c2e'),
        sleep: noopSleep,
      };
      const screenExit = await runScreenCommand(
        ['--issue', '29', '--policy-file', TEMPLATE, '--evidence-dir', evidenceDir, '--json'],
        screenContext,
      );
      expect(screenExit).toBe(1);
      const screenReport = JSON.parse(screenCapture.text()) as { repository: string };
      expect(screenReport.repository).toBe('steady-orchard/patch-steward-testbed-public');

      expect(spy.calls.length).toBeGreaterThan(0);
      let sawGitRemoteCall = false;
      let sawGhAuthTokenCall = false;
      for (const call of spy.calls) {
        const base = path.basename(call.file).replace(/\.[^.]*$/, '');
        if (base === 'git') {
          const isPlainRemote = call.args.length === 1 && call.args[0] === 'remote';
          const isGetUrl =
            call.args.length === 4 &&
            call.args[0] === 'remote' &&
            call.args[1] === 'get-url' &&
            call.args[2] === '--end-of-options' &&
            (call.args[3] === 'upstream' || call.args[3] === 'origin');
          expect(isPlainRemote || isGetUrl).toBe(true);
          sawGitRemoteCall = true;
        } else if (call.file === missingGhDir) {
          expect(call.args).toEqual(['auth', 'token', '--hostname', 'github.com']);
          sawGhAuthTokenCall = true;
        } else {
          throw new Error(`unexpected process call ${call.file} ${JSON.stringify(call.args)}`);
        }
      }
      expect(sawGitRemoteCall).toBe(true);
      expect(sawGhAuthTokenCall).toBe(true);
      const ghCalls = spy.calls.filter((c) => c.file === missingGhDir);
      expect(ghCalls.length).toBe(1);

      const runDir = path.join(evidenceDir, 'steady-orchard', 'patch-steward-testbed-public', 'runs', 'issue-29', RUN_ID);

      spy.calls.length = 0;
      const reportTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'm5-czx-'));
      try {
        const reportCapture = stdoutCapture();
        const reportExit = await runReportCommand([runDir, '--json'], { cwd: reportTmp, io: reportCapture.io });
        expect(reportExit).toBe(1);
        expect(spy.calls.length).toBe(0);
      } finally {
        fs.rmSync(reportTmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    } finally {
      fs.rmSync(evidenceDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      fs.rmSync(path.dirname(path.dirname(missingGhDir)), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 120000);

  it('screen command makes only GET requests', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'm5-czx-'));
    const ev = path.join(tmp, 'evidence');
    try {
      const recorded: { url: string; method: string }[] = [];
      const prBody = readSubmissionText('pr-bugfix-complete.txt');
      const routes: RouteMap = {
        [T]: () => jsonResponse(readGitHubFixture('repository.json')),
        [`${T}/pulls/26`]: () => jsonResponse(withBody('pull-26.json', prBody)),
        [`${T}/pulls/26/files`]: () => jsonResponse(readGitHubFixture('pull-26-files.json')),
        [`${T}/commits/${HEAD_SHA}/pulls`]: () => jsonResponse(readGitHubFixture('commit-pulls-b46eef5.json')),
        [`${T}/issues/29`]: () => jsonResponse(readGitHubFixture('issue-29.json')),
      };
      const inner = routedFetch(routes);
      const recordingFetch: GitHubFetch = (url: string, init: GitHubFetchInit) => {
        recorded.push({ url, method: init.method });
        return inner(url, init);
      };

      const capture = stdoutCapture();
      const context: ScreenCommandContext = {
        cwd: tmp,
        io: capture.io,
        env: { GH_TOKEN: 'token-a' },
        fetch: recordingFetch,
        attachmentResolver: fakeAttachmentResolver,
        attachmentTransport: fakeAttachmentTransport,
        clock: fixedClock('2026-09-27T10:15:00.000Z'),
        random: fixedRandom('3f9a1c2e'),
        sleep: noopSleep,
      };
      const exit = await runScreenCommand(
        [
          '--pr',
          '26',
          '--repo',
          'steady-orchard/patch-steward-testbed-public',
          '--policy-file',
          TEMPLATE,
          '--evidence-dir',
          ev,
          '--json',
        ],
        context,
      );
      expect(exit).toBe(3);

      expect(recorded.length).toBeGreaterThanOrEqual(5);
      for (const call of recorded) {
        expect(call.method).toBe('GET');
        expect(call.url.startsWith('https://api.github.com/')).toBe(true);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 120000);
});
