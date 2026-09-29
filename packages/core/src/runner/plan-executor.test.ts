import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { steppingClock } from '../clock.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import { planScreenExecutions, type ExecutionPlanEntry } from '../execution/plan.js';
import { executionPlanTransportSchema, executionResultsTransportSchema } from '../execution/transport.js';
import type { PlanExecutionContext } from '../execution/executor.js';
import type { LoadedPolicy } from '../policy/loader.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import { err, ok } from '../result.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import type { ContainerExecutionResult } from './container.js';
import { hostPlanExecutor, type HostExecutorSteps } from './plan-executor.js';
import type { ResolvedImage, SelectedRuntime } from './types.js';
import { buildCompletedExecution } from './record.js';
import type { ExecutionRecordFacts } from './record.js';

const COMMIT = 'c'.repeat(40);
const runtime: SelectedRuntime = {
  name: 'docker',
  binary: 'docker',
  env: { PATH: 'p' },
  clientVersion: '29.8.0',
  serverVersion: '29.8.1',
  os: 'linux',
  arch: 'amd64',
};
const image: ResolvedImage = {
  source: 'registry',
  reference: 'docker.io/library/busybox:1.37.0',
  digest: 'sha256:' + 'a'.repeat(64),
  id: 'sha256:' + 'b'.repeat(64),
  runnerTreeId: null,
  cached: false,
  runReference: 'docker.io/library/busybox@sha256:' + 'a'.repeat(64),
};
const checkout = {
  commit: COMMIT,
  tree: 'd'.repeat(40),
  archive_sha256: 'sha256:' + '1'.repeat(64),
  files: 1,
  bytes: 10,
  overlays: [],
  skipped_submodules: [],
};
const hostEnv = { PATH: 'p' };

function policyWith(changes: { dependency?: boolean; dockerfile?: boolean; runSeconds?: number }): ResolvedPolicy {
  const base = DEFAULT_CHECKLIST_POLICY;
  return {
    ...base,
    runner: {
      ...base.runner,
      ...(changes.dockerfile ? { image: { source: 'dockerfile' as const, path: 'runner/Dockerfile' } } : {}),
      dependency_step: changes.dependency ? { run: ['sh', 'install.sh'], working_directory: '.' } : null,
    },
    limits: {
      ...base.limits,
      execution: {
        ...base.limits.execution,
        ...(changes.runSeconds !== undefined ? { run_execution_seconds: changes.runSeconds } : {}),
      },
    },
  };
}

function loaded(policy: ResolvedPolicy, kind: 'git-tree' | 'local-file' = 'git-tree'): LoadedPolicy {
  const revision =
    kind === 'git-tree'
      ? { kind: 'git-tree' as const, id: 'e'.repeat(40), commit: COMMIT, ref: 'refs/heads/main' }
      : ({ kind: 'local-file' as const, id: 'local-file', path: '/tmp/policy.yml' } as unknown as LoadedPolicy['revision']);
  return { revision, policy, authoritative: kind === 'git-tree' };
}

function contextFor(
  policy: ResolvedPolicy,
  options: { kind?: 'git-tree' | 'local-file'; empty?: boolean; signal?: AbortSignal } = {},
): PlanExecutionContext {
  const screened = planScreenExecutions({
    policy,
    submissionType: options.empty ? 'issue' : 'pull_request',
    headCommit: COMMIT,
  });
  const plan = executionPlanTransportSchema.parse({
    transport: 'execution-plan',
    transport_version: 1,
    run: { run_id: 42, run_attempt: 2 },
    snapshot_hash: 'sha256:' + '5'.repeat(64),
    policy_revision: 'b'.repeat(40),
    entries: screened.entries,
    over_budget: false,
  });
  return {
    plan,
    loadedPolicy: loaded(policy, options.kind),
    repository: { owner: 'octo', name: 'repo' },
    token: null,
    clock: steppingClock('2026-10-03T10:15:00.000Z', 10),
    signal: options.signal ?? new AbortController().signal,
  };
}

function completed(entry: ExecutionPlanEntry) {
  const buffer = new OutputCaptureBuffer({ headBytes: 262144, tailBytes: 786432, streamBytes: 268435456 });
  const facts: ExecutionRecordFacts = {
    runId: 42,
    runAttempt: 2,
    entry,
    runner: 'container',
    environment: {
      image_digest: 'sha256:' + 'a'.repeat(64),
      tool_versions: [{ name: 'docker-server', version: '29.8.1' }],
      runtime: { name: 'docker', client_version: '29.8.0', server_version: '29.8.1', os: 'linux', arch: 'amd64' },
      image: {
        source: 'registry',
        reference: image.reference,
        digest: image.digest,
        id: image.id,
        runner_tree_id: null,
        cached: false,
      },
      platform: 'linux/amd64',
      network: entry.network,
    } as ExecutionRecordFacts['environment'],
    limits: {
      execution_seconds: 1800,
      output_head_bytes: 262144,
      output_tail_bytes: 786432,
      output_stream_bytes: 268435456,
      cpus: 2,
      memory_mb: 4096,
      pids: 512,
      scratch_mb: 1024,
    } as ExecutionRecordFacts['limits'],
    timing: {
      started_at: '2026-10-03T10:15:00.000Z',
      finished_at: '2026-10-03T10:15:02.500Z',
      duration_ms: 2500,
    } as ExecutionRecordFacts['timing'],
    exit: { code: 0, signal: null, timedOut: false, oomKilled: false, outputLimited: false },
    capture: buffer.result(),
    resultFiles: entry.result_files.map(() => ({ kind: 'missing' as const })),
    resultTestCases: 1000,
    checkout: checkout as unknown as NonNullable<ExecutionRecordFacts['checkout']>,
  };
  return buildCompletedExecution(facts);
}

interface Harness {
  readonly steps: HostExecutorSteps;
  readonly calls: string[];
  readonly runs: { entryId: string; archivePath: string; preparedCopyPath: string | null }[];
  readonly prepareContexts: { runId: string | undefined; testNonce: string | null }[];
  readonly runContexts: { testNonce: string | null; runAttempt: number }[];
  readonly sources: unknown[];
  readonly disposed: { count: number };
}

interface Plan {
  runtimeFailure?: boolean;
  imageFailure?: boolean;
  materializeFailure?: boolean;
  throwOnRun?: boolean;
  durationMs?: number;
  outcomes?: Record<string, (entry: ExecutionPlanEntry) => ContainerExecutionResult>;
}

function harness(plan: Plan = {}): Harness {
  const calls: string[] = [];
  const runs: Harness['runs'] = [];
  const prepareContexts: Harness['prepareContexts'] = [];
  const runContexts: Harness['runContexts'] = [];
  const sources: unknown[] = [];
  const disposed = { count: 0 };
  const steps: HostExecutorSteps = {
    selectRuntime: async () => {
      calls.push('select');
      return plan.runtimeFailure ? err('runner.runtime-unavailable', 'environment-unavailable', 'none') : ok(runtime);
    },
    readBuildContext: async (source) => {
      calls.push('context');
      sources.push(source);
      if (source.kind === 'local-file') return err('runner.image-source-unavailable', 'environment-unavailable', 'local');
      return ok({ runnerTreeId: 'f'.repeat(40), dockerfilePath: 'Dockerfile', archive: new Uint8Array() });
    },
    prepareImage: async (ctx) => {
      calls.push('prepare');
      prepareContexts.push({ runId: ctx.runId, testNonce: ctx.testNonce });
      if (plan.imageFailure) {
        const buffer = new OutputCaptureBuffer({ headBytes: 10, tailBytes: 10, streamBytes: 100 });
        buffer.push(new TextEncoder().encode('build output'));
        return { result: err('runner.image-build-failed', 'environment-unavailable', 'bad'), buildLog: buffer.result() };
      }
      return { result: ok(image), buildLog: null };
    },
    materialize: async (input) => {
      calls.push('materialize');
      sources.push(input.source);
      if (plan.materializeFailure) {
        return err('materialize.fetch-failed', 'environment-unavailable', 'x', [
          { code: 'c', path: 'refs/pull/1', message: 'm', line: null, column: null },
        ]);
      }
      return ok({
        archivePath: '/archive/head.tar',
        checkout,
        dispose: async () => {
          disposed.count += 1;
        },
      });
    },
    runEntry: async (ctx, input) => {
      calls.push('run');
      runContexts.push({ testNonce: ctx.testNonce, runAttempt: ctx.runAttempt });
      runs.push({ entryId: input.entry.id, archivePath: input.archivePath, preparedCopyPath: input.preparedCopyPath });
      if (plan.throwOnRun) throw new Error('boom');
      const custom = plan.outcomes?.[input.entry.id];
      if (custom) return custom(input.entry);
      return {
        kind: 'completed',
        execution: completed(input.entry),
        durationMs: plan.durationMs ?? 1500,
        preparedCopy: null,
        dependencyFailure: null,
      };
    },
  };
  return { steps, calls, runs, prepareContexts, runContexts, sources, disposed };
}

function parsed(value: unknown) {
  const result = executionResultsTransportSchema.safeParse(value);
  expect(result.success).toBe(true);
  return executionResultsTransportSchema.parse(value);
}

describe('host plan executor', () => {
  it('spawns nothing for an empty plan', async () => {
    const h = harness();
    const outcome = await hostPlanExecutor({ runtime: 'auto', hostEnv, steps: h.steps })(
      contextFor(policyWith({}), { empty: true }),
    );
    expect(h.calls).toEqual([]);
    expect(parsed(outcome.results).results).toEqual([]);
    expect(outcome.runner).toBeNull();
  });

  it('runs every entry in order and binds the results', async () => {
    const h = harness();
    const context = contextFor(policyWith({ dependency: true }));
    const outcome = await hostPlanExecutor({ runtime: 'auto', hostEnv, steps: h.steps })(context);
    const transport = parsed(outcome.results);
    expect(h.calls).toEqual(['select', 'prepare', 'materialize', 'run', 'run']);
    expect(h.runs.map((r) => r.entryId)).toEqual(context.plan.entries.map((e) => e.id));
    expect(transport.results.map((r) => r.entry_id)).toEqual(context.plan.entries.map((e) => e.id));
    expect(transport.run).toEqual({ run_id: 42, run_attempt: 2 });
    expect(transport.snapshot_hash).toBe(context.plan.snapshot_hash);
    expect(transport.policy_revision).toBe(context.plan.policy_revision);
    expect(transport.causes).toEqual([]);
    expect(h.runContexts[0]?.runAttempt).toBe(2);
  });

  it('passes the run id to image preparation', async () => {
    const h = harness();
    await hostPlanExecutor({ runtime: 'podman', hostEnv, steps: h.steps })(contextFor(policyWith({})));
    expect(h.prepareContexts).toEqual([{ runId: '42', testNonce: null }]);
  });

  it('chains the dependency-step prepared copy into later entries', async () => {
    const h = harness({
      outcomes: {
        'head-dependency-step': (entry) => ({
          kind: 'completed',
          execution: completed(entry),
          durationMs: 100,
          preparedCopy: { path: '/prepared/copy.tar', bytes: 5, sha256: 'sha256:' + '2'.repeat(64) },
          dependencyFailure: null,
        }),
      },
    });
    await hostPlanExecutor({ runtime: 'auto', hostEnv, steps: h.steps })(contextFor(policyWith({ dependency: true })));
    expect(h.runs[0]?.archivePath).toBe('/archive/head.tar');
    expect(h.runs[0]?.preparedCopyPath).toContain('patch-steward-prepared-');
    expect(h.runs[1]?.archivePath).toBe('/prepared/copy.tar');
    expect(h.runs[1]?.preparedCopyPath).toBeNull();
  });

  it('stops at the first environment failure', async () => {
    const h = harness({
      outcomes: {
        'head-dependency-step': () => ({ kind: 'environment-failure', code: 'runner.create-failed', subject: 'create' }),
      },
    });
    const outcome = await hostPlanExecutor({ runtime: 'auto', hostEnv, steps: h.steps })(
      contextFor(policyWith({ dependency: true })),
    );
    const transport = parsed(outcome.results);
    expect(h.runs).toHaveLength(1);
    expect(transport.results).toEqual([
      { kind: 'environment-failure', entry_id: 'head-dependency-step', code: 'runner.create-failed', subject: 'create' },
    ]);
    expect(transport.causes.map((c) => c.code)).toEqual(['runner.create-failed']);
  });

  it('records a runtime failure without preparing an image', async () => {
    const h = harness({ runtimeFailure: true });
    const context = contextFor(policyWith({}));
    const outcome = await hostPlanExecutor({ runtime: 'docker', hostEnv, steps: h.steps })(context);
    const transport = parsed(outcome.results);
    expect(h.calls).toEqual(['select']);
    expect(transport.results).toEqual([
      { kind: 'environment-failure', entry_id: context.plan.entries[0]?.id, code: 'runner.runtime-unavailable', subject: null },
    ]);
    expect(outcome.runner).toBeNull();
    expect(outcome.buildLog).toBeNull();
    expect(outcome.containerSeconds).toBe(0);
  });

  it('reads a dockerfile build context through the GitHub source', async () => {
    const h = harness();
    const outcome = await hostPlanExecutor({ runtime: 'auto', hostEnv, steps: h.steps })(
      contextFor(policyWith({ dockerfile: true })),
    );
    parsed(outcome.results);
    const source = h.sources[0] as { kind: string; policyTreeId?: string; repository?: unknown };
    expect(source.kind).toBe('github');
    expect(source.policyTreeId).toBe('e'.repeat(40));
    expect(source.repository).toEqual({ owner: 'octo', name: 'repo' });
    expect(h.calls).toEqual(['select', 'context', 'prepare', 'materialize', 'run']);
  });

  it('reports image source unavailable for a local policy file dockerfile', async () => {
    const h = harness();
    const outcome = await hostPlanExecutor({ runtime: 'auto', hostEnv, steps: h.steps })(
      contextFor(policyWith({ dockerfile: true }), { kind: 'local-file' }),
    );
    const transport = parsed(outcome.results);
    expect(h.calls).toEqual(['select', 'context']);
    expect(transport.results[0]).toMatchObject({ kind: 'environment-failure', code: 'runner.image-source-unavailable' });
  });

  it('stops a failed dependency step with its cause', async () => {
    const h = harness({
      outcomes: {
        'head-dependency-step': (entry) => ({
          kind: 'completed',
          execution: completed(entry),
          durationMs: 100,
          preparedCopy: null,
          dependencyFailure: 'runner.dependency-step-failed',
        }),
      },
    });
    const outcome = await hostPlanExecutor({ runtime: 'auto', hostEnv, steps: h.steps })(
      contextFor(policyWith({ dependency: true })),
    );
    const transport = parsed(outcome.results);
    expect(h.runs).toHaveLength(1);
    expect(transport.results).toHaveLength(1);
    expect(transport.causes).toEqual([
      expect.objectContaining({ code: 'runner.dependency-step-failed', subjects: ['dependency-step'] }),
    ]);
  });

  it('stops when the run execution seconds are spent', async () => {
    const h = harness({ durationMs: 1000 });
    const outcome = await hostPlanExecutor({ runtime: 'auto', hostEnv, steps: h.steps })(
      contextFor(policyWith({ dependency: true, runSeconds: 1 })),
    );
    const transport = parsed(outcome.results);
    expect(h.runs).toHaveLength(1);
    expect(transport.results).toHaveLength(1);
    expect(transport.causes.map((c) => c.code)).toEqual(['execution.time-exhausted']);
  });

  it('reports the runner identity and container seconds', async () => {
    const h = harness({ durationMs: 1250 });
    const outcome = await hostPlanExecutor({ runtime: 'auto', hostEnv, steps: h.steps })(
      contextFor(policyWith({ dependency: true })),
    );
    expect(outcome.runner).toEqual({
      runtime: 'docker',
      serverVersion: '29.8.1',
      reference: image.reference,
      imageDigest: image.digest,
    });
    expect(outcome.containerSeconds).toBe(2.5);
    expect(outcome.buildLog).toBeNull();
  });

  it('disposes the checkout and prepared copies on every path', async () => {
    const ok1 = harness();
    await hostPlanExecutor({ runtime: 'auto', hostEnv, steps: ok1.steps })(contextFor(policyWith({ dependency: true })));
    expect(ok1.disposed.count).toBe(1);
    const copyPath = ok1.runs[0]?.preparedCopyPath ?? '';
    expect(copyPath).not.toBe('');
    expect(fs.existsSync(copyPath.replace(/[\\/][^\\/]+$/, ''))).toBe(false);

    const failing = harness({ throwOnRun: true });
    await expect(
      hostPlanExecutor({ runtime: 'auto', hostEnv, steps: failing.steps })(contextFor(policyWith({ dependency: true }))),
    ).rejects.toThrow('boom');
    expect(failing.disposed.count).toBe(1);
    const thrownPath = failing.runs[0]?.preparedCopyPath ?? '';
    expect(fs.existsSync(thrownPath.replace(/[\\/][^\\/]+$/, ''))).toBe(false);

    const failedFetch = harness({ materializeFailure: true });
    const outcome = await hostPlanExecutor({ runtime: 'auto', hostEnv, steps: failedFetch.steps })(contextFor(policyWith({})));
    expect(parsed(outcome.results).results[0]).toMatchObject({ code: 'materialize.fetch-failed', subject: 'refs/pull/1' });
    expect(outcome.runner).not.toBeNull();
  });

  it('uses the test fetch source and nonce when given', async () => {
    const h = harness();
    await hostPlanExecutor({
      runtime: 'auto',
      hostEnv,
      testNonce: 'nonce-1',
      fetchSource: { kind: 'local-path', path: '/fixture/repo' },
      binaries: { docker: '/bin/docker' },
      steps: h.steps,
    })(contextFor(policyWith({})));
    expect(h.sources[0]).toEqual({ kind: 'local-path', path: '/fixture/repo' });
    expect(h.prepareContexts[0]?.testNonce).toBe('nonce-1');
    expect(h.runContexts[0]?.testNonce).toBe('nonce-1');
  });
});
