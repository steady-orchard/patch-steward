import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { fixedClock, fixedRandom } from '../clock.js';
import { verifyRunDirectory } from '../evidence/verify.js';
import { emptyPlanExecution, executionEnvironmentCause } from '../execution/executor.js';
import type { PlanExecutionContext, PlanExecutionOutcome, PlanExecutor } from '../execution/executor.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { GitHubFetch } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type { AttachmentAddress, AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import { buildCompletedExecution } from '../runner/record.js';
import type { ExecutionRecordFacts } from '../runner/record.js';
import { screenSubmission } from './screen.js';
import type { ScreenDeps, ScreenResult } from './screen.js';

const REPO: GitHubRepositoryRef = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
const T_BASE = '/repos/steady-orchard/patch-steward-testbed-public';
const HEAD_SHA = 'b46eef5018c202bcb2470bf62e3defd7496ec65b';
const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'm7-screen-exec-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function readTextFixture(relPath: string): string {
  return readFileSync(new URL(`../../../../fixtures/${relPath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

function readJsonFixture(relPath: string): Record<string, unknown> {
  return JSON.parse(readTextFixture(relPath)) as Record<string, unknown>;
}

function templatePolicyPath(): string {
  return fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url));
}

function makeFetch(routes: Record<string, unknown>): GitHubFetch {
  return (url: string) => {
    const pathname = new URL(url).pathname;
    if (!(pathname in routes)) return Promise.resolve(new Response('{}', { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify(routes[pathname]), { status: 200 }));
  };
}

function prRoutes(body: string): Record<string, unknown> {
  return {
    [T_BASE]: readJsonFixture('github/testbed/repository.json'),
    [`${T_BASE}/pulls/26`]: { ...readJsonFixture('github/testbed/pull-26.json'), body },
    [`${T_BASE}/pulls/26/files`]: readJsonFixture('github/testbed/pull-26-files.json'),
    [`${T_BASE}/commits/${HEAD_SHA}/pulls`]: readJsonFixture('github/testbed/commit-pulls-b46eef5.json'),
    [`${T_BASE}/issues/29`]: readJsonFixture('github/testbed/issue-29.json'),
  };
}

function issueRoutes(): Record<string, unknown> {
  return {
    [T_BASE]: readJsonFixture('github/testbed/repository.json'),
    [`${T_BASE}/issues/29`]: {
      ...readJsonFixture('github/testbed/issue-29.json'),
      body: readTextFixture('submissions/defect-complete.txt'),
    },
  };
}

const resolver: AttachmentResolver = async (): Promise<readonly AttachmentAddress[]> => [{ address: '140.82.112.3', family: 4 }];
const transport: AttachmentTransport = async () => ({ kind: 'error', reason: 'network' });

function deps(evidenceDir: string, routes: Record<string, unknown>, number: number, type: 'issue' | 'pull_request'): ScreenDeps {
  return {
    repository: REPO,
    submission: { type, number },
    policySource: { kind: 'local-file', path: templatePolicyPath() },
    token: null,
    evidenceDir,
    fetch: makeFetch(routes),
    sleep: async () => undefined,
    attachmentResolver: resolver,
    attachmentTransport: transport,
    clock: fixedClock('2026-09-27T10:15:00.000Z'),
    random: fixedRandom('3f9a1c2e'),
  };
}

const environment = {
  image_digest: 'sha256:' + 'd'.repeat(64),
  tool_versions: [{ name: 'docker-client', version: '29.8.0' }],
  runtime: { name: 'docker', client_version: '29.8.0', server_version: '29.8.0', os: 'linux', arch: 'amd64' },
  image: {
    source: 'registry',
    reference: 'docker.io/library/busybox:1.37.0',
    digest: 'sha256:' + 'd'.repeat(64),
    id: 'sha256:' + 'e'.repeat(64),
    runner_tree_id: null,
    cached: false,
  },
  platform: 'linux/amd64',
  network: 'none',
} as ExecutionRecordFacts['environment'];

const limits = {
  execution_seconds: 1800,
  output_head_bytes: 262144,
  output_tail_bytes: 786432,
  output_stream_bytes: 268435456,
  cpus: 2,
  memory_mb: 4096,
  pids: 512,
  scratch_mb: 1024,
} as ExecutionRecordFacts['limits'];

const timing = {
  started_at: '2026-09-27T10:15:00.000Z',
  finished_at: '2026-09-27T10:15:02.500Z',
  duration_ms: 2500,
} as ExecutionRecordFacts['timing'];

const checkout = {
  commit: HEAD_SHA,
  tree: 'f'.repeat(40),
  archive_sha256: 'sha256:' + '1'.repeat(64),
  files: 3,
  bytes: 120,
  overlays: [],
  skipped_submodules: [],
} as unknown as NonNullable<ExecutionRecordFacts['checkout']>;

const RUNNER = {
  runtime: 'docker',
  serverVersion: '29.8.0',
  reference: 'docker.io/library/busybox:1.37.0',
  imageDigest: 'sha256:' + 'd'.repeat(64),
} as const;

function completedOutcome(context: PlanExecutionContext, runId: string): PlanExecutionOutcome {
  const { plan } = context;
  const buffer = new OutputCaptureBuffer({ headBytes: 262144, tailBytes: 786432, streamBytes: 268435456 });
  buffer.push(new TextEncoder().encode('ok\n'));
  const results = plan.entries.map((entry) =>
    buildCompletedExecution({
      runId: runId as ExecutionRecordFacts['runId'],
      runAttempt: plan.run.run_attempt,
      entry,
      runner: 'container',
      environment,
      limits,
      timing,
      exit: { code: 0, signal: null, timedOut: false, oomKilled: false, outputLimited: false },
      capture: buffer.result(),
      resultFiles: entry.result_files.map(() => ({ kind: 'missing' as const })),
      resultTestCases: 1000,
      checkout,
    }),
  );
  return {
    results: {
      transport: 'execution-results',
      transport_version: 1,
      run: { run_id: runId, run_attempt: plan.run.run_attempt },
      snapshot_hash: plan.snapshot_hash,
      policy_revision: plan.policy_revision,
      results,
      causes: [],
    },
    runner: RUNNER,
    buildLog: null,
    containerSeconds: 3,
  };
}

function recordingExecutor(build: (context: PlanExecutionContext) => PlanExecutionOutcome): {
  readonly executor: PlanExecutor;
  readonly calls: PlanExecutionContext[];
} {
  const calls: PlanExecutionContext[] = [];
  return {
    calls,
    executor: async (context) => {
      calls.push(context);
      return build(context);
    },
  };
}

function runDirectory(evidenceDir: string, kind: string, number: number): string {
  return join(evidenceDir, 'steady-orchard', 'patch-steward-testbed-public', 'runs', `${kind}-${number}`, RUN_ID);
}

function completed(result: ScreenResult): Extract<ScreenResult, { readonly kind: 'completed' }> {
  expect(result.kind).toBe('completed');
  if (result.kind !== 'completed') throw new Error('expected a completed run');
  return result;
}

describe('screen execution wiring', () => {
  it('executes the head plan of a pull request through the injected executor', async () => {
    const evidenceDir = makeTmpDir();
    const { executor, calls } = recordingExecutor((context) => completedOutcome(context, RUN_ID));
    const result = completed(
      await screenSubmission({
        ...deps(evidenceDir, prRoutes(readTextFixture('submissions/pr-bugfix-complete.txt')), 26, 'pull_request'),
        execution: { executor },
      }),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.plan.entries.map((entry) => entry.id)).toEqual(['head-test']);
    expect(calls[0]?.plan.run).toEqual({ run_id: RUN_ID, run_attempt: 1 });

    const dir = runDirectory(evidenceDir, 'pr', 26);
    const files = readdirSync(join(dir, 'executions'));
    expect(files).toContain('execution-0001.json');
    expect(files.length).toBeGreaterThan(1);
    expect((await verifyRunDirectory(dir)).ok).toBe(true);
    expect(result.published.run.budget.executions).toBe(1);
    expect(result.published.report).toContain('`head-test`');
    expect(result.published.report).toContain('- Runner: `docker` `29.8.0`');
  });

  it('never calls the executor for an issue', async () => {
    const evidenceDir = makeTmpDir();
    const { executor, calls } = recordingExecutor((context) => emptyPlanExecution(context.plan));
    completed(await screenSubmission({ ...deps(evidenceDir, issueRoutes(), 29, 'issue'), execution: { executor } }));
    expect(calls).toHaveLength(0);
  });

  it('never calls the executor for an early contract exit', async () => {
    const evidenceDir = makeTmpDir();
    const { executor, calls } = recordingExecutor((context) => emptyPlanExecution(context.plan));
    const result = await screenSubmission({
      ...deps(evidenceDir, prRoutes('This body does not follow the template.'), 26, 'pull_request'),
      execution: { executor },
    });
    expect(result.kind).toBe('completed');
    expect(calls).toHaveLength(0);
  });

  it('stores no executions for results bound to another run', async () => {
    const evidenceDir = makeTmpDir();
    const { executor } = recordingExecutor((context) => completedOutcome(context, 'local-20260101T000000Z-deadbeef'));
    const result = completed(
      await screenSubmission({
        ...deps(evidenceDir, prRoutes(readTextFixture('submissions/pr-bugfix-complete.txt')), 26, 'pull_request'),
        execution: { executor },
      }),
    );
    expect(result.decision.causes.map((cause) => cause.code)).toContain('pipeline.transport-binding');
    expect(result.decision.outcome).not.toBe('pass');
    const manifest = readFileSync(join(runDirectory(evidenceDir, 'pr', 26), 'manifest.json'), 'utf8');
    expect(manifest).not.toContain('executions/');
  });

  it('records an environment failure from the executor', async () => {
    const evidenceDir = makeTmpDir();
    const { executor } = recordingExecutor(({ plan }) => ({
      results: {
        transport: 'execution-results',
        transport_version: 1,
        run: plan.run,
        snapshot_hash: plan.snapshot_hash,
        policy_revision: plan.policy_revision,
        results: [{ kind: 'environment-failure', entry_id: 'head-test', code: 'runner.runtime-unavailable', subject: null }],
        causes: [executionEnvironmentCause('runner.runtime-unavailable', null)],
      },
      runner: null,
      buildLog: null,
      containerSeconds: 0,
    }));
    const result = completed(
      await screenSubmission({
        ...deps(evidenceDir, prRoutes(readTextFixture('submissions/pr-bugfix-complete.txt')), 26, 'pull_request'),
        execution: { executor },
      }),
    );
    expect(result.decision.causes.map((cause) => cause.cause)).toContain('environment-unavailable');
    expect(result.decision.outcome).toBe('inconclusive');
    expect(result.exitStatus).toBe(3);
  });

  it('uses the host executor with the selected runtime by default', async () => {
    const evidenceDir = makeTmpDir();
    const missing = join(makeTmpDir(), 'no-such-docker');
    const result = completed(
      await screenSubmission({
        ...deps(evidenceDir, prRoutes(readTextFixture('submissions/pr-bugfix-complete.txt')), 26, 'pull_request'),
        execution: { runtime: 'docker', hostEnv: {}, binaries: { docker: missing } },
      }),
    );
    const cause = result.decision.causes.find((item) => item.cause === 'environment-unavailable');
    expect(cause?.code).toBe('runner.runtime-unavailable');
    expect(result.exitStatus).toBe(3);
  });
});
