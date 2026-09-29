import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { fixedClock, fixedRandom } from '../clock.js';
import { decideOutcome } from '../decision/table.js';
import type { DecisionInput, DecisionResult } from '../decision/table.js';
import { emptyPlanExecution, executionBudgetCause, executionEnvironmentCause } from '../execution/executor.js';
import type { PlanExecutionContext, PlanExecutionOutcome, PlanExecutor } from '../execution/executor.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import { EXECUTION_FAILURE_CODES } from '../execution/results.js';
import type { GitHubFetch } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type { AttachmentAddress, AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import { validatePolicyBytes } from '../policy/validate.js';
import { buildCompletedExecution } from '../runner/record.js';
import type { ExecutionRecordFacts } from '../runner/record.js';
import { screenSubmission } from '../pipeline/screen.js';
import type { ScreenDeps, ScreenResult } from '../pipeline/screen.js';

const REPO: GitHubRepositoryRef = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
const T_BASE = '/repos/steady-orchard/patch-steward-testbed-public';
const HEAD_SHA = 'b46eef5018c202bcb2470bf62e3defd7496ec65b';
const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'patch-steward-inv4-pipeline-'));
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

const resolver: AttachmentResolver = async (): Promise<readonly AttachmentAddress[]> => [{ address: '140.82.112.3', family: 4 }];
const transport: AttachmentTransport = async () => ({ kind: 'error', reason: 'network' });

function baseDeps(policyPath: string): ScreenDeps {
  return {
    repository: REPO,
    submission: { type: 'pull_request', number: 26 },
    policySource: { kind: 'local-file', path: policyPath },
    token: null,
    evidenceDir: makeTmpDir(),
    fetch: makeFetch(prRoutes(readTextFixture('submissions/pr-bugfix-complete.txt'))),
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

function completedResults(context: PlanExecutionContext, runId: string): PlanExecutionOutcome['results'] {
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
    transport: 'execution-results',
    transport_version: 1,
    run: { run_id: runId, run_attempt: plan.run.run_attempt },
    snapshot_hash: plan.snapshot_hash,
    policy_revision: plan.policy_revision,
    results,
    causes: [],
  };
}

function outcomeOf(
  results: PlanExecutionOutcome['results'],
  runner: PlanExecutionOutcome['runner'] = RUNNER,
): PlanExecutionOutcome {
  return { results, runner, buildLog: null, containerSeconds: 0 };
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

function recordingDecide(): { readonly decide: (input: DecisionInput) => DecisionResult; readonly inputs: DecisionInput[] } {
  const inputs: DecisionInput[] = [];
  return {
    inputs,
    decide: (input) => {
      inputs.push(input);
      return decideOutcome(input);
    },
  };
}

function expectNeverPass(
  result: ScreenResult,
  inputs: readonly DecisionInput[],
  expected: { readonly cause: string; readonly code: string },
): void {
  expect(result.kind).toBe('completed');
  if (result.kind !== 'completed') throw new Error('expected a completed run');
  const causes = inputs.flatMap((input) => input.causes);
  expect(causes.some((item) => item.cause === expected.cause && item.code === expected.code)).toBe(true);
  expect(result.decision.outcome).not.toBe('pass');
  expect(result.exitStatus).not.toBe(0);
}

function overBudgetPolicyPath(): string {
  const text = readFileSync(templatePolicyPath(), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace('executions_per_run: 40', 'executions_per_run: 1')
    .replace('  dependency_step: null\n', '  dependency_step:\n    run: [npm ci]\n    working_directory: .\n');
  const bytes = new TextEncoder().encode(text);
  const validated = validatePolicyBytes(bytes);
  expect(validated.ok).toBe(true);
  const path = join(makeTmpDir(), 'policy.yml');
  writeFileSync(path, bytes);
  return path;
}

async function screen(
  executor: PlanExecutor,
  extra: Partial<ScreenDeps> = {},
  policyPath: string = templatePolicyPath(),
): Promise<{ readonly result: ScreenResult; readonly inputs: DecisionInput[] }> {
  const recorder = recordingDecide();
  const result = await screenSubmission({ ...baseDeps(policyPath), decide: recorder.decide, execution: { executor }, ...extra });
  return { result, inputs: recorder.inputs };
}

describe('invariant 4: pipeline execution failures never pass', () => {
  it('invariant 4: an over-budget plan executes nothing and never passes', async () => {
    const { executor, calls } = recordingExecutor(({ plan }) => emptyPlanExecution(plan));
    const { result, inputs } = await screen(executor, {}, overBudgetPolicyPath());
    expect(calls).toHaveLength(0);
    expectNeverPass(result, inputs, { cause: 'budget-exhausted', code: 'execution.over-budget' });
  });

  it('invariant 4: results bound to another run never pass', async () => {
    const { executor } = recordingExecutor((context) => outcomeOf(completedResults(context, 'local-20260101T000000Z-deadbeef')));
    const { result, inputs } = await screen(executor);
    expectNeverPass(result, inputs, { cause: 'steward-defect', code: 'pipeline.transport-binding' });
  });

  it('invariant 4: malformed results never pass', async () => {
    const { executor } = recordingExecutor(() => outcomeOf({ bogus: true } as unknown as PlanExecutionOutcome['results']));
    const { result, inputs } = await screen(executor);
    expectNeverPass(result, inputs, { cause: 'steward-defect', code: 'pipeline.transport-invalid' });
  });

  it('invariant 4: a throwing executor never passes', async () => {
    const executor: PlanExecutor = async () => {
      throw new Error('executor exploded');
    };
    const { result, inputs } = await screen(executor);
    expectNeverPass(result, inputs, { cause: 'steward-defect', code: 'pipeline.phase-failed' });
  });

  it('invariant 4: a throwing intake phase never passes', async () => {
    const { executor, calls } = recordingExecutor(({ plan }) => emptyPlanExecution(plan));
    const { result, inputs } = await screen(executor, {
      phases: {
        intake: async () => {
          throw new Error('intake exploded');
        },
      },
    });
    expect(calls).toHaveLength(0);
    expectNeverPass(result, inputs, { cause: 'steward-defect', code: 'pipeline.phase-failed' });
  });

  it('invariant 4: a hanging executor times out and never passes', { timeout: 30000 }, async () => {
    const executor: PlanExecutor = () => new Promise<PlanExecutionOutcome>(() => undefined);
    const { result, inputs } = await screen(executor, { phaseTimeoutMs: 3000 });
    expectNeverPass(result, inputs, { cause: 'budget-exhausted', code: 'pipeline.phase-timeout' });
  });

  it('invariant 4: every environment failure code never passes', async () => {
    for (const code of EXECUTION_FAILURE_CODES) {
      const { executor } = recordingExecutor(({ plan }) =>
        outcomeOf(
          {
            transport: 'execution-results',
            transport_version: 1,
            run: plan.run,
            snapshot_hash: plan.snapshot_hash,
            policy_revision: plan.policy_revision,
            results: [{ kind: 'environment-failure', entry_id: plan.entries[0]?.id ?? 'head-test', code, subject: null }],
            causes: [executionEnvironmentCause(code, null)],
          },
          null,
        ),
      );
      const { result, inputs } = await screen(executor);
      expectNeverPass(result, inputs, { cause: 'environment-unavailable', code });
    }
  });

  it('invariant 4: exhausted run execution seconds never pass', async () => {
    const { executor } = recordingExecutor((context) => {
      const results = completedResults(context, RUN_ID);
      return outcomeOf({ ...(results as object), causes: [executionBudgetCause('execution.time-exhausted')] });
    });
    const { result, inputs } = await screen(executor);
    expectNeverPass(result, inputs, { cause: 'budget-exhausted', code: 'execution.time-exhausted' });
  });
});
