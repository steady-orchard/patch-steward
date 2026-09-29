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
import { SHELL_TEST_IMAGE } from '../../core/src/runner/test-images.test.js';
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

interface StoredResultEntry {
  readonly status: string;
  readonly bytes: number;
  readonly content_hash: string;
  readonly stored_path: string | null;
  readonly stored_omitted: boolean;
  readonly stored_omitted_reason?: string;
  readonly junit?: { readonly tests: number };
}

interface ExecutionRecordShape {
  readonly result_files: readonly StoredResultEntry[];
}

interface ManifestShape {
  readonly files: readonly { readonly path: string; readonly bytes: number }[];
  readonly metrics: { readonly path: string; readonly bytes: number };
}

interface ScreenRun {
  readonly exit: number;
  readonly stdout: string;
  readonly runDir: string;
}

interface ScreenOptions {
  readonly name: string;
  readonly manifestName: string;
  readonly run: readonly string[];
  readonly resultPaths: readonly string[];
  readonly runBytes: number;
}

const BIG_SCRIPT = [
  'mkdir -p r',
  `printf '%s' '<testsuites><testsuite name="small"><testcase classname="small" name="only"/></testsuite></testsuites>' > r/small.xml`,
  `{ printf '%s\\n' '<testsuites><testsuite name="big">'; i=0; while [ $i -lt 3000 ]; do printf '<testcase classname="big" name="case-%04d-aaaaaaaaaabbbbbbbbbbccccccccccdddddddddd"/>\\n' $i; i=$((i+1)); done; printf '%s\\n' '</testsuite></testsuites>'; } > r/big.xml`,
  'exit 0',
].join('\n');

describe('screen evidence budget end to end', () => {
  let tmp: string;
  let cwd: string;
  let nonce: string;
  const fixtures: FixtureRepository[] = [];

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-screen-budget-'));
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

  function writePolicy(options: ScreenOptions): string {
    let text = fs.readFileSync(TEMPLATE, 'utf8').replace(/\r\n/g, '\n');
    text = text.replace('reference: docker.io/library/debian:stable-slim', () => `reference: ${SHELL_TEST_IMAGE}`);
    const resultYaml = `[${options.resultPaths.map((p) => `{ path: ${p}, format: junit-xml }`).join(', ')}]`;
    text = text.replace(
      '      run: [make, test]\n      working_directory: .\n      mandatory: true\n      result_files: []',
      () =>
        `      run: ${JSON.stringify(options.run)}\n      working_directory: .\n      mandatory: true\n      result_files: ${resultYaml}`,
    );
    text = text.replace('    run_bytes: 10485760', () => `    run_bytes: ${options.runBytes}`);
    expect(text).toContain(`reference: ${SHELL_TEST_IMAGE}`);
    expect(text).toContain(`result_files: ${resultYaml}`);
    expect(text).toContain(`run_bytes: ${options.runBytes}`);
    const validated = validatePolicyBytes(Buffer.from(text, 'utf8'));
    expect(validated.ok, JSON.stringify(validated)).toBe(true);
    const file = path.join(tmp, `${options.name}-policy.yml`);
    fs.writeFileSync(file, text);
    return file;
  }

  async function screen(options: ScreenOptions): Promise<ScreenRun> {
    const fixture = createFixtureRepository(loadFixtureManifest(options.manifestName));
    fixtures.push(fixture);
    const policyFile = writePolicy(options);
    const evidenceDir = path.join(tmp, `${options.name}-evidence`);
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
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
    env['GH_TOKEN'] = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0' + randomBytes(8).toString('hex');
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
    return { exit, stdout: cap.out(), runDir: path.join(runsDir, runs[0] as string) };
  }

  function readRecord(runDir: string): ExecutionRecordShape {
    return JSON.parse(fs.readFileSync(path.join(runDir, 'executions', 'execution-0001.json'), 'utf8')) as ExecutionRecordShape;
  }

  function readManifest(runDir: string): ManifestShape {
    return JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8')) as ManifestShape;
  }

  function metricsFile(runDir: string, manifest: ManifestShape): string {
    return path.join(runDir, '..', '..', '..', manifest.metrics.path);
  }

  async function expectReportExit(runDir: string): Promise<void> {
    const reportCap = capture();
    const reportExit = await runReportCommand([runDir], { cwd, io: reportCap.io });
    expect(reportExit, reportCap.out() + reportCap.err()).toBe(3);
  }

  it('screen drops result files over the evidence budget and still verifies', async () => {
    try {
      const base = {
        manifestName: 'shell-sample.json',
        run: ['sh', '-c', BIG_SCRIPT],
        resultPaths: ['r/small.xml', 'r/big.xml'],
      };
      const first = await screen({ ...base, name: 'budget-full', runBytes: 52428800 });
      expect(first.exit, first.stdout).toBe(3);
      const firstManifest = readManifest(first.runDir);
      const metricsSize = fs.statSync(metricsFile(first.runDir, firstManifest)).size;
      const manifestSize = fs.statSync(path.join(first.runDir, 'manifest.json')).size;
      const total = firstManifest.files.reduce((sum, file) => sum + file.bytes, 0) + manifestSize + metricsSize;
      const bigSize = fs.statSync(path.join(first.runDir, 'executions', 'execution-0001', 'result-2.xml')).size;
      expect(bigSize).toBeGreaterThanOrEqual(200000);

      const limit = total - Math.floor(bigSize / 2);
      expect(limit).toBeGreaterThanOrEqual(65536);
      const second = await screen({ ...base, name: 'budget-tight', runBytes: limit });
      expect(second.exit, second.stdout).toBe(3);
      const executionDir = path.join(second.runDir, 'executions', 'execution-0001');
      expect(fs.existsSync(path.join(executionDir, 'result-2.xml'))).toBe(false);
      expect(fs.existsSync(path.join(executionDir, 'result-1.xml'))).toBe(true);

      const record = readRecord(second.runDir);
      expect(record.result_files[0]?.stored_omitted).toBe(false);
      expect(record.result_files[0]?.stored_path).toBe('executions/execution-0001/result-1.xml');
      expect(record.result_files[1]?.stored_omitted).toBe(true);
      expect(record.result_files[1]?.stored_omitted_reason).toBe('evidence-budget');
      expect(record.result_files[1]?.stored_path).toBeNull();
      expect(record.result_files[1]?.junit?.tests).toBe(3000);

      const secondManifest = readManifest(second.runDir);
      const secondMetrics = fs.statSync(metricsFile(second.runDir, secondManifest)).size;
      const secondManifestSize = fs.statSync(path.join(second.runDir, 'manifest.json')).size;
      const secondTotal = secondManifest.files.reduce((sum, file) => sum + file.bytes, 0) + secondManifestSize + secondMetrics;
      expect(secondTotal).toBeLessThanOrEqual(limit);

      await expectReportExit(second.runDir);
    } finally {
      assertNoLeftovers();
    }
  }, 600000);

  it('screen omits an oversize decoded result file and still verifies', async () => {
    try {
      const run = await screen({
        name: 'oversize',
        manifestName: 'hostile-results.json',
        run: ['sh', 'results.sh'],
        resultPaths: ['reports/injection.xml', 'reports/binary.xml', 'reports/ff.xml'],
        runBytes: 10485760,
      });
      expect(run.exit, run.stdout).toBe(3);
      expect(fs.existsSync(run.runDir)).toBe(true);

      const record = readRecord(run.runDir);
      const executionDir = path.join(run.runDir, 'executions', 'execution-0001');
      const ff = record.result_files[2];
      expect(ff?.status).toBe('malformed');
      expect(ff?.bytes).toBe(2796203);
      expect(ff?.stored_omitted).toBe(true);
      expect(ff?.stored_omitted_reason).toBe('redaction-input');
      expect(ff?.stored_path).toBeNull();
      expect(record.result_files[0]?.stored_path).toBe('executions/execution-0001/result-1.xml');
      expect(record.result_files[1]?.stored_path).toBe('executions/execution-0001/result-2.xml');
      expect(fs.existsSync(path.join(executionDir, 'result-1.xml'))).toBe(true);
      expect(fs.existsSync(path.join(executionDir, 'result-2.xml'))).toBe(true);
      expect(fs.existsSync(path.join(executionDir, 'result-3.xml'))).toBe(false);

      await expectReportExit(run.runDir);
    } finally {
      assertNoLeftovers();
    }
  }, 600000);
});
