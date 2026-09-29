import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixedClock, fixedRandom, validatePolicyBytes } from '@patch-steward/core';
import type { GitHubFetch } from '@patch-steward/core';
import {
  createFixtureRepository,
  loadFixtureManifest,
  type FixtureRepository,
} from '../../core/src/materialize/fixture-repository.fixture.test.js';
import { NODE_TEST_IMAGE, SHELL_TEST_IMAGE } from '../../core/src/runner/test-images.test.js';
import { runReportCommand } from './report-command.js';
import { runScreenCommand } from './screen-command.js';
import type { ScreenCommandContext } from './screen-command.js';

const runtimeEnv = process.env['STEWARD_CONTAINER_RUNTIME'] ?? 'docker';
if (runtimeEnv !== 'docker' && runtimeEnv !== 'podman') {
  throw new Error(`STEWARD_CONTAINER_RUNTIME must be docker or podman, got ${runtimeEnv}`);
}
const RUNTIME: 'docker' | 'podman' = runtimeEnv;

const githubFixturesDir = fileURLToPath(new URL('../../../fixtures/github/testbed/', import.meta.url));
const submissionsDir = fileURLToPath(new URL('../../../fixtures/submissions/', import.meta.url));
const TEMPLATE = fileURLToPath(new URL('../../../templates/policy/policy.yml', import.meta.url));
const T = '/repos/steady-orchard/patch-steward-testbed-public';
const TEST_LABEL = 'org.patch-steward.test';
const OLD_HEAD = 'b46eef5018c202bcb2470bf62e3defd7496ec65b';

function readGitHubFixture(relative: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(githubFixturesDir, relative), 'utf8'));
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function routedFetch(routes: Record<string, () => Response>): GitHubFetch {
  return (url: string) => {
    const handler = routes[new URL(url).pathname];
    return Promise.resolve(handler ? handler() : new Response('{}', { status: 404 }));
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

function capture(): { io: { stdout: (t: string) => void; stderr: (t: string) => void }; out: () => string; err: () => string } {
  let out = '';
  let err = '';
  return {
    io: {
      stdout: (t: string) => {
        out += t;
      },
      stderr: (t: string) => {
        err += t;
      },
    },
    out: () => out,
    err: () => err,
  };
}

function runtimeList(args: readonly string[]): string {
  return execFileSync(RUNTIME, args, { encoding: 'utf8' }).trim();
}

function allFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...allFiles(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

interface ExecutionRecordShape {
  readonly plan_entry: string;
  readonly runner: string;
  readonly admissibility: string;
  readonly exit: { readonly code: number | null };
  readonly environment: { readonly runtime?: { readonly name: string } };
  readonly result_files: readonly {
    readonly status: string;
    readonly junit?: { readonly tests: number; readonly passed: number };
  }[];
  readonly output: { readonly stored_path: string };
}

interface ScreenRun {
  readonly exit: number;
  readonly stdout: string;
  readonly runDir: string;
  readonly evidenceDir: string;
  readonly ghToken: string;
}

describe('screen execution end to end', () => {
  let tmp: string;
  let cwd: string;
  let nonce: string;
  const fixtures: FixtureRepository[] = [];

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-screen-exec-'));
    cwd = path.join(tmp, 'work');
    fs.mkdirSync(cwd);
    execFileSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q'], { cwd });
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/steady-orchard/patch-steward-testbed-public.git'], { cwd });
    nonce = randomBytes(8).toString('hex');
  }, 60000);

  afterAll(() => {
    for (const fixture of fixtures) fixture.dispose();
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function assertNoLeftovers(): void {
    expect(runtimeList(['ps', '-a', '--filter', `label=${TEST_LABEL}=${nonce}`, '-q'])).toBe('');
    expect(runtimeList(['volume', 'ls', '-q', '--filter', `label=${TEST_LABEL}=${nonce}`])).toBe('');
  }

  function writePolicy(name: string, image: string, run: readonly string[], resultFiles: boolean): string {
    let text = fs.readFileSync(TEMPLATE, 'utf8').replace(/\r\n/g, '\n');
    text = text.replace('reference: docker.io/library/debian:stable-slim', `reference: ${image}`);
    const resultYaml = resultFiles ? '[{ path: junit.xml, format: junit-xml }]' : '[]';
    text = text.replace(
      '      run: [make, test]\n      working_directory: .\n      mandatory: true\n      result_files: []',
      `      run: ${JSON.stringify(run)}\n      working_directory: .\n      mandatory: true\n      result_files: ${resultYaml}`,
    );
    expect(text).toContain(`reference: ${image}`);
    expect(text).toContain(`run: ${JSON.stringify(run)}`);
    const validated = validatePolicyBytes(Buffer.from(text, 'utf8'));
    expect(validated.ok, JSON.stringify(validated)).toBe(true);
    const file = path.join(tmp, `${name}-policy.yml`);
    fs.writeFileSync(file, text);
    return file;
  }

  async function screen(
    name: string,
    manifestName: string,
    image: string,
    run: readonly string[],
    resultFiles: boolean,
    extraEnv: Record<string, string>,
  ): Promise<ScreenRun> {
    const fixture = createFixtureRepository(loadFixtureManifest(manifestName));
    fixtures.push(fixture);
    const policyFile = writePolicy(name, image, run, resultFiles);
    const evidenceDir = path.join(tmp, `${name}-evidence`);
    const prBody = fs.readFileSync(path.join(submissionsDir, 'pr-bugfix-complete.txt'), 'utf8').replace(/\r\n/g, '\n');
    const pull = { ...(readGitHubFixture('pull-26.json') as Record<string, unknown>), body: prBody } as Record<string, unknown>;
    pull['head'] = { ...(pull['head'] as Record<string, unknown>), sha: fixture.commit };
    const commitPulls = JSON.parse(
      JSON.stringify(readGitHubFixture('commit-pulls-b46eef5.json')).split(OLD_HEAD).join(fixture.commit),
    ) as unknown;
    const routes: Record<string, () => Response> = {
      [T]: () => jsonResponse(readGitHubFixture('repository.json')),
      [`${T}/pulls/26`]: () => jsonResponse(pull),
      [`${T}/pulls/26/files`]: () => jsonResponse(readGitHubFixture('pull-26-files.json')),
      [`${T}/commits/${fixture.commit}/pulls`]: () => jsonResponse(commitPulls),
      [`${T}/issues/29`]: () => jsonResponse(readGitHubFixture('issue-29.json')),
    };
    const ghToken = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0' + randomBytes(8).toString('hex');
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
    env['GH_TOKEN'] = ghToken;
    Object.assign(env, extraEnv);
    const cap = capture();
    const context: ScreenCommandContext = {
      cwd,
      io: cap.io,
      env,
      fetch: routedFetch(routes),
      attachmentResolver: fakeAttachmentResolver,
      attachmentTransport: fakeAttachmentTransport,
      clock: fixedClock('2026-09-27T10:15:00.000Z'),
      random: fixedRandom('3f9a1c2e'),
      sleep: noopSleep,
      execution: { fetchSource: { kind: 'local-path', path: fixture.dir }, testNonce: nonce },
    };
    const exit = await runScreenCommand(
      [
        '--pr',
        '26',
        '--repo',
        'steady-orchard/patch-steward-testbed-public',
        '--policy-file',
        policyFile,
        '--evidence-dir',
        evidenceDir,
        '--container-runtime',
        RUNTIME,
        '--json',
      ],
      context,
    );
    const runsDir = path.join(evidenceDir, 'steady-orchard', 'patch-steward-testbed-public', 'runs', 'pr-26');
    const runs = fs.existsSync(runsDir) ? fs.readdirSync(runsDir) : [];
    expect(runs.length, `${cap.out()}\n${cap.err()}`).toBe(1);
    return { exit, stdout: cap.out(), runDir: path.join(runsDir, runs[0] as string), evidenceDir, ghToken };
  }

  function readRecord(runDir: string): ExecutionRecordShape {
    return JSON.parse(fs.readFileSync(path.join(runDir, 'executions', 'execution-0001.json'), 'utf8')) as ExecutionRecordShape;
  }

  it('screen executes the head commit and stores a verified run', async () => {
    try {
      const run = await screen(
        'sample',
        'typescript-sample.json',
        NODE_TEST_IMAGE,
        ['node', '--test', '--test-reporter=junit', '--test-reporter-destination=junit.xml', 'test/math.test.ts'],
        true,
        {},
      );
      expect(run.exit, run.stdout).toBe(3);
      expect((JSON.parse(run.stdout) as { outcome: string }).outcome).toBe('inconclusive');

      const record = readRecord(run.runDir);
      expect(record.plan_entry).toBe('head-test');
      expect(record.runner).toBe('container');
      expect(record.admissibility).toBe('evidence');
      expect(record.exit.code).toBe(1);
      expect(record.environment.runtime?.name).toBe(RUNTIME);
      expect(record.result_files[0]?.status).toBe('parsed');
      expect(record.result_files[0]?.junit?.tests).toBe(2);
      expect(record.result_files[0]?.junit?.passed).toBe(1);
      expect(record.output.stored_path).toBe('executions/execution-0001/output.txt');
      expect(fs.existsSync(path.join(run.runDir, 'executions', 'execution-0001', 'output.txt'))).toBe(true);
      expect(fs.existsSync(path.join(run.runDir, 'executions', 'execution-0001', 'result-1.xml'))).toBe(true);

      const runJson = JSON.parse(fs.readFileSync(path.join(run.runDir, 'run.json'), 'utf8')) as {
        budget: { executions: number };
        runner_identity: string;
      };
      expect(runJson.budget.executions).toBe(1);
      expect(runJson.runner_identity.startsWith(RUNTIME + ' ')).toBe(true);

      const reportMd = fs.readFileSync(path.join(run.runDir, 'report.md'), 'utf8');
      expect(reportMd).toContain('`head-test`');
      expect(reportMd).toContain('- Runner: `' + RUNTIME);

      const reportCap = capture();
      const reportExit = await runReportCommand([run.runDir], { cwd, io: reportCap.io });
      expect(reportExit, reportCap.out() + reportCap.err()).toBe(3);
      expect(reportCap.out()).toContain('`head-test`');
    } finally {
      assertNoLeftovers();
    }
  });

  it('screen stores no host canary in the run evidence', async () => {
    const canaryName = 'PATCH_STEWARD_CANARY_' + randomBytes(4).toString('hex').toUpperCase();
    const canaryValue = 'canary-' + randomBytes(16).toString('hex');
    const hostDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-canary-'));
    const hostFile = path.join(hostDir, 'canary.txt');
    fs.writeFileSync(hostFile, canaryValue);
    try {
      const run = await screen('canary', 'hostile-probes.json', SHELL_TEST_IMAGE, ['sh', 'canary.sh'], false, {
        [canaryName]: canaryValue,
      });
      const record = readRecord(run.runDir);
      expect(record.runner).toBe('container');
      expect(record.exit.code).toBe(0);
      const output = fs.readFileSync(path.join(run.runDir, 'executions', 'execution-0001', 'output.txt'), 'utf8');
      expect(output).toContain('canary-scan-done');

      const needles = [canaryValue, canaryName, run.ghToken, hostFile].map((n) => Buffer.from(n));
      const files = allFiles(run.evidenceDir);
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const bytes = fs.readFileSync(file);
        for (const needle of needles) expect(bytes.indexOf(needle), file).toBe(-1);
      }

      const reportCap = capture();
      const reportExit = await runReportCommand([run.runDir], { cwd, io: reportCap.io });
      expect(reportExit, reportCap.out() + reportCap.err()).toBe(3);
    } finally {
      fs.rmSync(hostDir, { recursive: true, force: true });
      assertNoLeftovers();
    }
  });
});
