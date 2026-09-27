import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import type { ProcessRunner } from '@patch-steward/core';
import { OUTCOMES, fixedClock, fixedRandom, ok } from '@patch-steward/core';

import type { GitHubAuthFailureCode } from './github-auth.js';
import { GITHUB_AUTH_FAILURE_CODES } from './github-auth.js';
import type { ScreenCommandContext, ScreenCommandFailureCode } from './screen-command.js';
import { SCREEN_COMMAND_FAILURE_CODES, runScreenCommand } from './screen-command.js';
import type { ScreenUsageCode } from './screen-args.js';
import { SCREEN_USAGE_CODES } from './screen-args.js';
import type { ReportCommandContext, ReportCommandFailureCode } from './report-command.js';
import { REPORT_COMMAND_FAILURE_CODES, REPORT_USAGE_CODES, runReportCommand } from './report-command.js';
import type { ReportUsageCode } from './report-command.js';
import { REPORT_EXIT_BY_OUTCOME } from './report-output.js';

const TEMPLATE = fileURLToPath(new URL('../../../templates/policy/policy.yml', import.meta.url));
const CLOCK = fixedClock('2026-09-27T10:15:00.000Z');
const RANDOM = fixedRandom('3f9a1c2e');

const T = '/repos/steady-orchard/patch-steward-testbed-public';

function fixturePath(rel: string): string {
  return fileURLToPath(new URL(`../../../fixtures/${rel}`, import.meta.url));
}

function readFixtureText(rel: string): string {
  return fs.readFileSync(fixturePath(rel), 'utf8').replace(/\r\n/g, '\n');
}

function readJsonFixture(rel: string): unknown {
  return JSON.parse(readFixtureText(rel));
}

function withBody(fixture: unknown, body: string): unknown {
  return { ...(fixture as Record<string, unknown>), body };
}

type RouteValue = unknown | number;
type RouteMap = Record<string, RouteValue>;

function makeFetch(routes: RouteMap): (url: string) => Promise<Response> {
  return (url: string) => {
    const pathname = new URL(url).pathname;
    if (!(pathname in routes)) {
      return Promise.resolve(new Response('{}', { status: 404 }));
    }
    const value = routes[pathname];
    if (typeof value === 'number') {
      return Promise.resolve(new Response('{}', { status: value }));
    }
    return Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
  };
}

const DEFECT_BODY = readFixtureText('submissions/defect-complete.txt');

function testbedRoutes(): RouteMap {
  return {
    [T]: readJsonFixture('github/testbed/repository.json'),
    [`${T}/issues/29`]: withBody(readJsonFixture('github/testbed/issue-29.json'), DEFECT_BODY),
  };
}

async function fakeAttachmentResolver(): Promise<readonly { readonly address: string; readonly family: 4 }[]> {
  return [{ address: '140.82.112.3', family: 4 }];
}

function bodyFrom(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      let sent = false;
      return {
        async next(): Promise<IteratorResult<Uint8Array>> {
          if (!sent) {
            sent = true;
            return { done: false, value: bytes };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
}

async function fakeAttachmentTransport(): Promise<{
  readonly kind: 'response';
  readonly status: number;
  readonly location: null;
  readonly body: AsyncIterable<Uint8Array>;
  readonly close: () => void;
}> {
  return { kind: 'response', status: 200, location: null, body: bodyFrom(new Uint8Array()), close: () => undefined };
}

async function noopSleep(): Promise<void> {
  return undefined;
}

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm5-cnp-'));
  tmpDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

interface RunOutput {
  readonly exit: number;
  readonly stdout: string;
}

function baseScreenContext(overrides: Partial<ScreenCommandContext> & { readonly cwd: string }): ScreenCommandContext {
  const out: string[] = [];
  return {
    io: { stdout: (t: string) => out.push(t), stderr: () => undefined },
    env: { GH_TOKEN: 'token-a' },
    fetch: makeFetch(testbedRoutes()) as never,
    attachmentResolver: fakeAttachmentResolver as never,
    attachmentTransport: fakeAttachmentTransport as never,
    clock: CLOCK,
    random: RANDOM,
    sleep: noopSleep,
    ...overrides,
    cwd: overrides.cwd,
  };
}

async function runScreen(
  argv: readonly string[],
  overrides: Partial<ScreenCommandContext> & { readonly cwd: string },
): Promise<RunOutput> {
  const out: string[] = [];
  const context = baseScreenContext({ ...overrides, io: { stdout: (t: string) => out.push(t), stderr: () => undefined } });
  const exit = await runScreenCommand(argv, context);
  return { exit, stdout: out.join('') };
}

async function runReport(
  argv: readonly string[],
  overrides: Partial<ReportCommandContext> & { readonly cwd: string },
): Promise<RunOutput> {
  const out: string[] = [];
  const context: ReportCommandContext = {
    io: { stdout: (t: string) => out.push(t), stderr: () => undefined },
    ...overrides,
  };
  const exit = await runReportCommand(argv, context);
  return { exit, stdout: out.join('') };
}

function validScreenArgs(evidenceDir: string | null): readonly string[] {
  const base = ['--issue', '29', '--repo', 'steady-orchard/patch-steward-testbed-public', '--policy-file', TEMPLATE, '--json'];
  return evidenceDir === null ? base : [...base, '--evidence-dir', evidenceDir];
}

const okRunner: ProcessRunner = async () => ok({ exitCode: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) });

type ScreenCliCode = ScreenUsageCode | GitHubAuthFailureCode | ScreenCommandFailureCode;

const SCREEN_TRIGGERS: { readonly [K in ScreenCliCode]: () => Promise<{ exit: number; stdout: string }> } = {
  'usage.unknown-option': () => runScreen(['--bogus', '--json'], { cwd: makeTmpDir() }),
  'usage.invalid-arguments': () => runScreen(['--json'], { cwd: makeTmpDir() }),
  'usage.conflicting-options': () => runScreen(['--issue', '1', '--pr', '2', '--json'], { cwd: makeTmpDir() }),
  'auth.token-invalid': () => runScreen(validScreenArgs(makeTmpDir()), { cwd: makeTmpDir(), env: { GH_TOKEN: 'bad token' } }),
  'screen.no-upstream': () => runScreen(['--issue', '29', '--json'], { cwd: makeTmpDir(), runner: okRunner }),
  'screen.repository-unavailable': () =>
    runScreen(validScreenArgs(makeTmpDir()), { cwd: makeTmpDir(), fetch: makeFetch({ [T]: 404 }) as never }),
  'screen.token-rejected': () =>
    runScreen(validScreenArgs(makeTmpDir()), { cwd: makeTmpDir(), fetch: makeFetch({ [T]: 401 }) as never }),
  'screen.evidence-dir-unavailable': () =>
    runScreen(validScreenArgs(null), { cwd: makeTmpDir(), platform: 'linux', env: { GH_TOKEN: 'token-a' }, homedir: () => '' }),
  'steward.internal-error': () =>
    runScreen(validScreenArgs(makeTmpDir()), {
      cwd: makeTmpDir(),
      screen: async () => {
        throw new Error('injected');
      },
    }),
};

type ReportCliCode = ReportUsageCode | ReportCommandFailureCode;

const REPORT_TRIGGERS: { readonly [K in ReportCliCode]: () => Promise<{ exit: number; stdout: string }> } = {
  'usage.unknown-option': () => runReport(['--bogus', 'x', '--json'], { cwd: makeTmpDir() }),
  'usage.invalid-arguments': () => runReport(['--json'], { cwd: makeTmpDir() }),
  'report.run-unreadable': () => runReport([path.join(makeTmpDir(), 'missing'), '--json'], { cwd: makeTmpDir() }),
  'report.evidence-invalid': () => runReport([makeTmpDir(), '--json'], { cwd: makeTmpDir() }),
  'steward.internal-error': () =>
    runReport(['x', '--json'], {
      cwd: makeTmpDir(),
      verify: async () => {
        throw new Error('injected');
      },
    }),
};

describe('steward never passes on a CLI-only failure', () => {
  it('screen command failure codes never yield pass', async () => {
    for (const code of Object.keys(SCREEN_TRIGGERS) as ScreenCliCode[]) {
      const trigger = SCREEN_TRIGGERS[code];
      const result = await trigger();
      expect(result.exit === 1 || result.exit === 2).toBe(true);
      const lines = result.stdout.split('\n').filter((l) => l !== '');
      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0] as string) as { outcome: unknown; errors: { code: string }[] };
      expect(parsed.errors[0]?.code).toBe(code);
      expect(parsed.outcome).toBeNull();
      expect(result.stdout).not.toContain('"outcome":"pass"');
    }
  });

  it('report command failure codes never yield pass', async () => {
    for (const code of Object.keys(REPORT_TRIGGERS) as ReportCliCode[]) {
      const trigger = REPORT_TRIGGERS[code];
      const result = await trigger();
      const expectedExit = code === 'report.evidence-invalid' ? 1 : 2;
      expect(result.exit).toBe(expectedExit);
      const lines = result.stdout.split('\n').filter((l) => l !== '');
      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0] as string) as { outcome: unknown; report: unknown; errors: { code: string }[] };
      expect(parsed.errors[0]?.code).toBe(code);
      expect(parsed.outcome).toBeNull();
      expect(parsed.report).toBeNull();
      expect(result.stdout).not.toContain('"outcome":"pass"');
    }
  });

  it('cli failure tables cover every command code', () => {
    const screenExpected = [
      ...new Set([...SCREEN_USAGE_CODES, ...GITHUB_AUTH_FAILURE_CODES, ...SCREEN_COMMAND_FAILURE_CODES]),
    ].sort();
    const screenActual = Object.keys(SCREEN_TRIGGERS).sort();
    expect(screenActual).toEqual(screenExpected);

    const reportExpected = [...new Set([...REPORT_USAGE_CODES, ...REPORT_COMMAND_FAILURE_CODES])].sort();
    const reportActual = Object.keys(REPORT_TRIGGERS).sort();
    expect(reportActual).toEqual(reportExpected);
  });

  it('only a pass outcome exits 0 from steward report', () => {
    for (const o of OUTCOMES) {
      expect(REPORT_EXIT_BY_OUTCOME[o] === 0).toBe(o === 'pass');
    }
    expect(REPORT_EXIT_BY_OUTCOME.inconclusive).toBe(3);
  });

  it('steward screen prints no report after a failed evidence write', async () => {
    const tmp = makeTmpDir();
    const notADir = path.join(tmp, 'not-a-dir-json');
    fs.writeFileSync(notADir, '');
    const jsonResult = await runScreen(validScreenArgs(notADir), { cwd: tmp });
    expect(jsonResult.exit).toBe(2);
    const parsed = JSON.parse(jsonResult.stdout) as {
      run: { directory: string | null } | null;
      outcome: unknown;
      errors: { code: string }[];
    };
    expect(parsed.run?.directory ?? null).toBeNull();
    expect(parsed.outcome).toBeNull();
    expect(parsed.errors[0]?.code).toBe('screen.evidence-write-failed');

    const notADirText = path.join(tmp, 'not-a-dir-text');
    fs.writeFileSync(notADirText, '');
    const textArgs = [
      '--issue',
      '29',
      '--repo',
      'steady-orchard/patch-steward-testbed-public',
      '--policy-file',
      TEMPLATE,
      '--evidence-dir',
      notADirText,
    ];
    const textResult = await runScreen(textArgs, { cwd: tmp });
    expect(textResult.exit).toBe(2);
    expect(textResult.stdout).toBe('');
  });
});
