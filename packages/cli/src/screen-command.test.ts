import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AttachmentAddress, AttachmentTransportResponse, DecisionResult } from '@patch-steward/core';
import { fixedClock, fixedRandom, screenSubmission } from '@patch-steward/core';

import { PREFLIGHT_UNAUTHENTICATED_WARNING } from './preflight-command.js';
import { escapeTerminalText } from './preflight-output.js';
import { CLI_LOCAL_RUN_NOTICE } from './conventions.js';
import { EVIDENCE_INSIDE_CHECKOUT_MESSAGE } from './evidence-dir.js';
import { defaultEvidenceDir } from './evidence-dir.js';
import { SCREEN_USAGE } from './screen-args.js';
import type { ScreenCommandContext } from './screen-command.js';
import { SCREEN_INTERNAL_ERROR_MESSAGE, runScreenCommand } from './screen-command.js';

const TEMPLATE = fileURLToPath(new URL('../../../templates/policy/policy.yml', import.meta.url));
const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';
const CLOCK = fixedClock('2026-09-27T10:15:00.000Z');
const RANDOM = fixedRandom('3f9a1c2e');

const T = '/repos/steady-orchard/patch-steward-testbed-public';
const Y = '/repos/example-owner/example-repo';

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

function makeFetch(routes: RouteMap, seen: string[] = []): (url: string, init?: unknown) => Promise<Response> {
  return (url: string) => {
    seen.push(url);
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

function testbedRoutes(body: string): RouteMap {
  return {
    [T]: readJsonFixture('github/testbed/repository.json'),
    [`${T}/git/ref/heads/master`]: readJsonFixture('github/testbed/ref-heads-master.json'),
    [`${T}/contents/.github`]: readJsonFixture('github/testbed/contents-github.json'),
    [`${T}/issues/29`]: withBody(readJsonFixture('github/testbed/issue-29.json'), body),
  };
}

function syntheticRoutes(body: string): RouteMap {
  return {
    [Y]: { full_name: 'example-owner/example-repo', default_branch: 'main', private: false },
    [`${Y}/git/ref/heads/main`]: readJsonFixture('github/policy-directory/ref-heads-main.json'),
    [`${Y}/contents/.github`]: readJsonFixture('github/policy-directory/contents-github.json'),
    [`${Y}/git/trees/a8c2485882b52f63db71b1ec63b12f5039220e03`]: readJsonFixture('github/policy-directory/tree.json'),
    [`${Y}/git/blobs/716098133e97314ccf047f5034cc8f76161d8f0d`]: readJsonFixture('github/policy-directory/blob-policy.json'),
    [`${Y}/issues/29`]: withBody(readJsonFixture('github/testbed/issue-29.json'), body),
  };
}

const UNSTRUCTURED_BODY = (readJsonFixture('github/testbed/issue-29.json') as { body: string }).body;
const DEFECT_BODY = readFixtureText('submissions/defect-complete.txt');

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

async function fakeAttachmentResolver(): Promise<readonly AttachmentAddress[]> {
  return [{ address: '140.82.112.3', family: 4 }];
}

async function fakeAttachmentTransport(): Promise<AttachmentTransportResponse> {
  return { kind: 'response', status: 200, location: null, body: bodyFrom(new Uint8Array()), close: () => undefined };
}

async function noopSleep(): Promise<void> {
  return undefined;
}

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm5-scr-'));
  tmpDirs.push(dir);
  return dir;
}

beforeEach(() => {
  tmpDirs = [];
});

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  tmpDirs = [];
});

function baseContext(overrides: Partial<ScreenCommandContext> & { readonly cwd: string }): ScreenCommandContext {
  return {
    io: overrides.io ?? { stdout: () => undefined, stderr: () => undefined },
    env: overrides.env ?? { GH_TOKEN: 'token-a' },
    fetch: overrides.fetch ?? (makeFetch({}) as never),
    attachmentResolver: overrides.attachmentResolver ?? fakeAttachmentResolver,
    attachmentTransport: overrides.attachmentTransport ?? fakeAttachmentTransport,
    clock: overrides.clock ?? CLOCK,
    random: overrides.random ?? RANDOM,
    sleep: overrides.sleep ?? noopSleep,
    ...overrides,
    cwd: overrides.cwd,
  };
}

interface RunOutput {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function run(
  argv: readonly string[],
  overrides: Partial<ScreenCommandContext> & { readonly cwd: string },
): Promise<RunOutput> {
  const out: string[] = [];
  const err: string[] = [];
  const context = baseContext({
    ...overrides,
    io: { stdout: (t: string) => out.push(t), stderr: (t: string) => err.push(t) },
  });
  const exit = await runScreenCommand(argv, context);
  return { exit, stdout: out.join(''), stderr: err.join('') };
}

function testbedRunDirectory(evidenceDir: string): string {
  return path.join(evidenceDir, 'steady-orchard', 'patch-steward-testbed-public', 'runs', 'issue-29', RUN_ID);
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

function makeGitRepo(parentDir: string): { readonly dir: string; readonly git: (args: readonly string[]) => string } {
  const dir = fs.mkdtempSync(path.join(parentDir, 'repo-'));
  const globalConfigPath = path.join(parentDir, `gitconfig-${path.basename(dir)}`);
  fs.writeFileSync(globalConfigPath, '');
  const env = gitFixtureEnv(globalConfigPath);
  const git = (args: readonly string[]): string => execFileSync('git', args, { cwd: dir, env, encoding: 'utf8' }).trim();
  git(['-c', 'init.defaultBranch=main', 'init', '-q']);
  return { dir, git };
}

describe('runScreenCommand', { timeout: 60000 }, () => {
  it('screen usage errors exit 2 in text and json mode', async () => {
    const tmp = makeTmpDir();
    const seen: string[] = [];
    const fetch = makeFetch({}, seen);
    const r = await run(['--issue', '1', '--pr', '2'], { cwd: tmp, fetch: fetch as never });
    expect(r.exit).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe('error usage.conflicting-options -: --issue and --pr cannot be used together\n' + SCREEN_USAGE + '\n');

    const seen2: string[] = [];
    const fetch2 = makeFetch({}, seen2);
    const r2 = await run(['--issue', '1', '--pr', '2', '--json'], { cwd: tmp, fetch: fetch2 as never });
    expect(r2.exit).toBe(2);
    expect(r2.stderr).toBe('');
    const lines = r2.stdout.split('\n').filter((l) => l !== '');
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0] as string) as {
      command: string;
      schema_version: number;
      submission: unknown;
      outcome: unknown;
      errors: { code: string }[];
    };
    expect(parsed.command).toBe('screen');
    expect(parsed.schema_version).toBe(1);
    expect(parsed.submission).toBeNull();
    expect(parsed.outcome).toBeNull();
    expect(parsed.errors[0]?.code).toBe('usage.conflicting-options');
    expect(seen.length).toBe(0);
    expect(seen2.length).toBe(0);
  });

  it('non-authoritative run is labeled in screen text', async () => {
    const tmp = makeTmpDir();
    const ev = path.join(tmp, 'evidence');
    const r = await run(
      ['--issue', '29', '--repo', 'steady-orchard/patch-steward-testbed-public', '--policy-file', TEMPLATE, '--evidence-dir', ev],
      { cwd: tmp, fetch: makeFetch(testbedRoutes(UNSTRUCTURED_BODY)) as never },
    );
    expect(r.exit).toBe(1);
    const runDir = testbedRunDirectory(ev);
    const lines = r.stdout.split('\n');
    lines.pop();
    expect(lines[0]).toBe(CLI_LOCAL_RUN_NOTICE);
    expect(lines[1]).toMatch(/^non-authoritative: screened under a local policy file \(local:[0-9a-f]{64}\)$/);
    expect(lines.some((l) => l.startsWith('policy: local file ' + escapeTerminalText(TEMPLATE) + ' revision local:'))).toBe(true);
    expect(lines).toContain(`submission: issue 29 (steady-orchard/patch-steward-testbed-public)`);
    expect(lines).toContain('outcome: needs-changes');
    expect(lines.some((l) => l.startsWith('request R1: '))).toBe(true);
    expect(lines[lines.length - 1]).toBe('run directory: ' + escapeTerminalText(runDir));
    expect(fs.existsSync(path.join(runDir, 'manifest.json'))).toBe(true);
    expect(r.stderr.includes('error ')).toBe(false);
  });

  it('non-authoritative run is labeled in screen json', async () => {
    const tmp = makeTmpDir();
    const ev = path.join(tmp, 'evidence');
    const r = await run(
      [
        '--issue',
        '29',
        '--repo',
        'steady-orchard/patch-steward-testbed-public',
        '--policy-file',
        TEMPLATE,
        '--evidence-dir',
        ev,
        '--json',
      ],
      { cwd: tmp, fetch: makeFetch(testbedRoutes(UNSTRUCTURED_BODY)) as never },
    );
    expect(r.exit).toBe(1);
    expect(r.stdout.endsWith('\n')).toBe(true);
    expect(r.stdout.split('\n').filter((l) => l !== '').length).toBe(1);
    const runDir = testbedRunDirectory(ev);
    const parsed = JSON.parse(r.stdout) as {
      authoritative: boolean;
      notices: string[];
      policy: { source: string; revision: string; ref: string | null; commit: string | null; path: string | null };
      outcome: string;
      run: { directory: string };
      errors: unknown[];
    };
    expect(parsed.authoritative).toBe(false);
    expect(parsed.notices).toEqual([
      CLI_LOCAL_RUN_NOTICE,
      `non-authoritative: screened under a local policy file (${parsed.policy.revision})`,
    ]);
    expect(parsed.policy).toEqual({
      source: 'local-file',
      revision: parsed.policy.revision,
      ref: null,
      commit: null,
      path: TEMPLATE,
    });
    expect(parsed.policy.revision).toMatch(/^local:[0-9a-f]{64}$/);
    expect(parsed.outcome).toBe('needs-changes');
    expect(parsed.run.directory).toBe(runDir);
    expect(parsed.errors).toEqual([]);
    expect(r.stderr).toBe('');
  });

  it('trusted-branch run is authoritative in screen json', async () => {
    const tmp = makeTmpDir();
    const ev = path.join(tmp, 'evidence');
    const r = await run(['--issue', '29', '--repo', 'example-owner/example-repo', '--evidence-dir', ev, '--json'], {
      cwd: tmp,
      fetch: makeFetch(syntheticRoutes(DEFECT_BODY)) as never,
    });
    expect(r.exit).toBe(3);
    const parsed = JSON.parse(r.stdout) as {
      authoritative: boolean;
      notices: string[];
      policy: unknown;
      outcome: string;
      causes: { cause: string }[];
    };
    expect(parsed.authoritative).toBe(true);
    expect(parsed.notices).toEqual([CLI_LOCAL_RUN_NOTICE]);
    expect(parsed.policy).toEqual({
      source: 'trusted-branch',
      revision: 'a8c2485882b52f63db71b1ec63b12f5039220e03',
      ref: 'main',
      commit: '0123456789abcdef0123456789abcdef01234567',
      path: null,
    });
    expect(parsed.outcome).toBe('inconclusive');
    expect(parsed.causes[0]?.cause).toBe('stage-incomplete');
  });

  it('screen exits 3 for an inconclusive run', async () => {
    const tmp = makeTmpDir();
    const ev = path.join(tmp, 'evidence');
    const r = await run(
      ['--issue', '29', '--repo', 'steady-orchard/patch-steward-testbed-public', '--policy-file', TEMPLATE, '--evidence-dir', ev],
      { cwd: tmp, fetch: makeFetch(testbedRoutes(DEFECT_BODY)) as never },
    );
    expect(r.exit).toBe(3);
    const lines = r.stdout.split('\n');
    expect(lines).toContain('outcome: inconclusive');
    expect(lines).toContain('cause: stage-incomplete');
  });

  it('screen exits 0 for a pass decision', async () => {
    const tmp = makeTmpDir();
    const ev = path.join(tmp, 'evidence');
    const decide = (): DecisionResult => ({
      kind: 'outcome',
      outcome: 'pass',
      row: 9,
      contributing_findings: [],
      unmet_requirements: [],
      requests: [],
      causes: [],
    });
    const r = await run(
      [
        '--issue',
        '29',
        '--repo',
        'steady-orchard/patch-steward-testbed-public',
        '--policy-file',
        TEMPLATE,
        '--evidence-dir',
        ev,
        '--json',
      ],
      {
        cwd: tmp,
        fetch: makeFetch(testbedRoutes(DEFECT_BODY)) as never,
        screen: (deps) => screenSubmission({ ...deps, decide }),
      },
    );
    expect(r.exit).toBe(0);
    const parsed = JSON.parse(r.stdout) as { outcome: string };
    expect(parsed.outcome).toBe('pass');
  });

  it('screen exits 2 without a published policy and names --policy-file', async () => {
    const tmp = makeTmpDir();
    const ev = path.join(tmp, 'evidence');
    const routes: RouteMap = {
      [T]: readJsonFixture('github/testbed/repository.json'),
      [`${T}/git/ref/heads/master`]: readJsonFixture('github/testbed/ref-heads-master.json'),
      [`${T}/contents/.github`]: readJsonFixture('github/testbed/contents-github.json'),
    };
    const r = await run(['--issue', '29', '--repo', 'steady-orchard/patch-steward-testbed-public', '--evidence-dir', ev], {
      cwd: tmp,
      fetch: makeFetch(routes) as never,
    });
    expect(r.exit).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('error screen.policy-missing -: ');
    expect(r.stderr).toContain('--policy-file');
    expect(fs.existsSync(ev) ? fs.readdirSync(ev) : []).toEqual([]);
  });

  it('screen exits 1 for an invalid policy file', async () => {
    const tmp = makeTmpDir();
    const ev = path.join(tmp, 'evidence');
    const invalid = path.resolve('fixtures/policies/invalid/unknown-key.txt');
    const r = await run(
      [
        '--issue',
        '29',
        '--repo',
        'steady-orchard/patch-steward-testbed-public',
        '--policy-file',
        invalid,
        '--evidence-dir',
        ev,
        '--json',
      ],
      { cwd: tmp, fetch: makeFetch(testbedRoutes(UNSTRUCTURED_BODY)) as never },
    );
    expect(r.exit).toBe(1);
    const parsed = JSON.parse(r.stdout) as { errors: { code: string }[]; outcome: unknown; run: unknown };
    expect(parsed.errors[0]?.code).toBe('screen.policy-file-invalid');
    expect(parsed.errors.some((e) => e.code === 'policy.unknown-key')).toBe(true);
    expect(parsed.outcome).toBeNull();
    expect(parsed.run).toBeNull();
    expect(fs.existsSync(ev) ? fs.readdirSync(ev) : []).toEqual([]);
  });

  it('screen exits 2 and prints no report when the evidence write fails', async () => {
    const tmp = makeTmpDir();
    const ev = path.join(tmp, 'not-a-directory');
    fs.writeFileSync(ev, '');
    const r = await run(
      ['--issue', '29', '--repo', 'steady-orchard/patch-steward-testbed-public', '--policy-file', TEMPLATE, '--evidence-dir', ev],
      { cwd: tmp, fetch: makeFetch(testbedRoutes(DEFECT_BODY)) as never },
    );
    expect(r.exit).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('error screen.evidence-write-failed -: ');
    expect(r.stderr).toContain('evidence.write-failed');

    const rJson = await run(
      [
        '--issue',
        '29',
        '--repo',
        'steady-orchard/patch-steward-testbed-public',
        '--policy-file',
        TEMPLATE,
        '--evidence-dir',
        ev,
        '--json',
      ],
      { cwd: tmp, fetch: makeFetch(testbedRoutes(DEFECT_BODY)) as never },
    );
    expect(rJson.exit).toBe(2);
    const parsed = JSON.parse(rJson.stdout) as {
      run: { run_id: string; run_attempt: number; directory: string | null; snapshot_hash: string };
      outcome: unknown;
      errors: { code: string }[];
    };
    expect(parsed.run).toEqual({ run_id: RUN_ID, run_attempt: 1, directory: null, snapshot_hash: parsed.run.snapshot_hash });
    expect(parsed.run.directory).toBeNull();
    expect(parsed.run.run_id).toBe(RUN_ID);
    expect(parsed.outcome).toBeNull();
    expect(parsed.errors[0]?.code).toBe('screen.evidence-write-failed');
  });

  it('screen resolves the repository from the origin remote', async () => {
    const tmp = makeTmpDir();
    const repo = makeGitRepo(tmp);
    repo.git(['remote', 'add', 'origin', 'https://github.com/steady-orchard/patch-steward-testbed-public.git']);
    const ev = path.join(tmp, 'evidence');
    const r = await run(['--issue', '29', '--policy-file', TEMPLATE, '--evidence-dir', ev, '--json'], {
      cwd: repo.dir,
      fetch: makeFetch(testbedRoutes(UNSTRUCTURED_BODY)) as never,
    });
    expect(r.exit).toBe(1);
    const parsed = JSON.parse(r.stdout) as { repository: string };
    expect(parsed.repository).toBe('steady-orchard/patch-steward-testbed-public');
  });

  it('screen exits 2 without a GitHub remote or --repo', async () => {
    const tmp = makeTmpDir();
    const repo = makeGitRepo(tmp);
    const seen: string[] = [];
    const r = await run(['--issue', '29', '--json'], { cwd: repo.dir, fetch: makeFetch({}, seen) as never });
    expect(r.exit).toBe(2);
    const parsed = JSON.parse(r.stdout) as { errors: { code: string; message: string }[] };
    expect(parsed.errors[0]?.code).toBe('screen.no-upstream');
    expect(parsed.errors[0]?.message).toBe('No GitHub remote named upstream or origin was found; pass --repo owner/name.');
    expect(seen.length).toBe(0);
  });

  it('screen warns when the evidence directory is inside the checkout', async () => {
    const tmp = makeTmpDir();
    const work = path.join(tmp, 'work');
    fs.mkdirSync(path.join(work, '.git'), { recursive: true });
    const r = await run(
      [
        '--issue',
        '29',
        '--repo',
        'steady-orchard/patch-steward-testbed-public',
        '--policy-file',
        TEMPLATE,
        '--evidence-dir',
        'evidence',
        '--json',
      ],
      { cwd: work, fetch: makeFetch(testbedRoutes(UNSTRUCTURED_BODY)) as never },
    );
    expect(r.exit).toBe(1);
    const parsed = JSON.parse(r.stdout) as { warnings: { code: string; message: string }[]; run: { directory: string } };
    expect(parsed.warnings).toContainEqual({ code: 'screen.evidence-inside-checkout', message: EVIDENCE_INSIDE_CHECKOUT_MESSAGE });
    expect(parsed.run.directory.startsWith(path.join(tmp, 'work', 'evidence'))).toBe(true);

    const rText = await run(
      [
        '--issue',
        '29',
        '--repo',
        'steady-orchard/patch-steward-testbed-public',
        '--policy-file',
        TEMPLATE,
        '--evidence-dir',
        'evidence2',
      ],
      { cwd: work, fetch: makeFetch(testbedRoutes(UNSTRUCTURED_BODY)) as never },
    );
    expect(rText.stderr).toContain('warning screen.evidence-inside-checkout: ' + EVIDENCE_INSIDE_CHECKOUT_MESSAGE + '\n');
  });

  it('screen warns when no GitHub token is found', async () => {
    const tmp = makeTmpDir();
    const ev = path.join(tmp, 'evidence');
    const ghBinary = path.join(tmp, 'missing-gh', 'gh');
    const r = await run(
      [
        '--issue',
        '29',
        '--repo',
        'steady-orchard/patch-steward-testbed-public',
        '--policy-file',
        TEMPLATE,
        '--evidence-dir',
        ev,
        '--json',
      ],
      { cwd: tmp, env: {}, ghBinary, fetch: makeFetch(testbedRoutes(UNSTRUCTURED_BODY)) as never },
    );
    expect(r.exit).toBe(1);
    const parsed = JSON.parse(r.stdout) as { warnings: { code: string; message: string }[] };
    expect(parsed.warnings).toContainEqual({ code: 'github.unauthenticated', message: PREFLIGHT_UNAUTHENTICATED_WARNING });
    expect(r.stderr).toBe('');
  });

  it('screen maps GitHub repository failures to screen codes', async () => {
    const tmp = makeTmpDir();
    const ev = path.join(tmp, 'evidence');
    const r = await run(
      [
        '--issue',
        '29',
        '--repo',
        'steady-orchard/patch-steward-testbed-public',
        '--policy-file',
        TEMPLATE,
        '--evidence-dir',
        ev,
        '--json',
      ],
      { cwd: tmp, fetch: makeFetch({ [T]: 401 }) as never },
    );
    expect(r.exit).toBe(2);
    const parsed = JSON.parse(r.stdout) as { errors: { code: string }[] };
    expect(parsed.errors[0]?.code).toBe('screen.token-rejected');

    const r2 = await run(
      [
        '--issue',
        '29',
        '--repo',
        'steady-orchard/patch-steward-testbed-public',
        '--policy-file',
        TEMPLATE,
        '--evidence-dir',
        ev,
        '--json',
      ],
      { cwd: tmp, fetch: makeFetch({}) as never },
    );
    expect(r2.exit).toBe(2);
    const parsed2 = JSON.parse(r2.stdout) as { errors: { code: string }[] };
    expect(parsed2.errors[0]?.code).toBe('screen.repository-unavailable');
  });

  it('screen uses the default evidence directory when none is given', async () => {
    const tmp = makeTmpDir();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'm5-scr-home-'));
    tmpDirs.push(home);
    const r = await run(
      ['--issue', '29', '--repo', 'steady-orchard/patch-steward-testbed-public', '--policy-file', TEMPLATE, '--json'],
      { cwd: tmp, homedir: () => home, env: { GH_TOKEN: 'token-a' }, fetch: makeFetch(testbedRoutes(UNSTRUCTURED_BODY)) as never },
    );
    expect(r.exit).toBe(1);
    const expected = defaultEvidenceDir({ platform: process.platform, env: {}, homedir: () => home });
    expect(expected.ok).toBe(true);
    if (!expected.ok) return;
    const parsed = JSON.parse(r.stdout) as { run: { directory: string } };
    expect(parsed.run.directory.startsWith(expected.path)).toBe(true);
    expect(parsed.run.directory.startsWith(home)).toBe(true);
  });

  it('screen maps an unexpected exception to steward.internal-error', async () => {
    const tmp = makeTmpDir();
    const ev = path.join(tmp, 'evidence');
    const r = await run(
      [
        '--issue',
        '29',
        '--repo',
        'steady-orchard/patch-steward-testbed-public',
        '--policy-file',
        TEMPLATE,
        '--evidence-dir',
        ev,
        '--json',
      ],
      {
        cwd: tmp,
        fetch: makeFetch(testbedRoutes(UNSTRUCTURED_BODY)) as never,
        screen: async () => {
          throw new Error('injected');
        },
      },
    );
    expect(r.exit).toBe(2);
    const parsed = JSON.parse(r.stdout) as { errors: { code: string; path: string; message: string }[]; outcome: unknown };
    expect(parsed.errors[0]).toEqual({ code: 'steward.internal-error', path: '', message: SCREEN_INTERNAL_ERROR_MESSAGE });
    expect(parsed.outcome).toBeNull();
  });
});
