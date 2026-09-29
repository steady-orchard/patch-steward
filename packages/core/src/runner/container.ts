import fs from 'node:fs';
import os from 'node:os';
import { z } from 'zod';
import type { Clock } from '../clock.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import type { ExecutionFailureCode } from '../execution/results.js';
import {
  RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
  RUNTIME_CONTROL_TIMEOUT_MS,
  RUNTIME_KILL_GRACE_MS,
  SANDBOX_PLATFORM,
} from '../policy/bounds.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import { runProcess, type ProcessRunner } from '../process/run-process.js';
import { streamProcess, type StreamProcessRunner } from '../process/stream-process.js';
import type { RecordRunId } from '../records/common.js';
import type { ExecutionRecord } from '../records/execution-record.js';
import {
  runtimeCopyInArgs,
  runtimeCreateArgs,
  runtimeInspectArgs,
  runtimeKillArgs,
  runtimeRemoveArgs,
  runtimeStartArgs,
  runtimeVolumeCreateArgs,
  runtimeVolumeRemoveArgs,
  runtimeWaitArgs,
} from './argv.js';
import { copyOutResultFile, exportPreparedCopy } from './copy-out.js';
import { buildCompletedExecution, type CompletedExecution, type ResultFileRead } from './record.js';
import type { ResolvedImage, RuntimeLabels, SelectedRuntime } from './types.js';

export interface ContainerExecutionLimits {
  readonly executionSeconds: number;
  readonly dependencyStepSeconds: number;
  readonly outputHeadBytes: number;
  readonly outputTailBytes: number;
  readonly outputStreamBytes: number;
  readonly resultFiles: number;
  readonly resultFileBytes: number;
  readonly resultTestCases: number;
  readonly preparedCheckoutBytes: number;
  readonly containerStartSeconds: number;
  readonly cpus: number;
  readonly memoryMb: number;
  readonly pids: number;
  readonly scratchMb: number;
}

export function containerLimitsFromPolicy(policy: ResolvedPolicy): ContainerExecutionLimits {
  const e = policy.limits.execution;
  const r = policy.runner.resources;
  return {
    executionSeconds: e.execution_seconds,
    dependencyStepSeconds: e.dependency_step_seconds,
    outputHeadBytes: e.output_head_bytes,
    outputTailBytes: e.output_tail_bytes,
    outputStreamBytes: e.output_stream_bytes,
    resultFiles: e.result_files,
    resultFileBytes: e.result_file_bytes,
    resultTestCases: e.result_test_cases,
    preparedCheckoutBytes: e.prepared_checkout_bytes,
    containerStartSeconds: e.container_start_seconds,
    cpus: r.cpus,
    memoryMb: r.memory_mb,
    pids: r.pids,
    scratchMb: r.scratch_mb,
  };
}

export function containerEnvironment(
  runtime: SelectedRuntime,
  image: ResolvedImage,
  network: 'none' | 'egress',
): ExecutionRecord['environment'] {
  return {
    image_digest: image.digest ?? image.id,
    tool_versions: [
      ...(runtime.clientVersion === null ? [] : [{ name: `${runtime.name}-client`, version: runtime.clientVersion }]),
      { name: `${runtime.name}-server`, version: runtime.serverVersion },
    ],
    runtime: {
      name: runtime.name,
      client_version: runtime.clientVersion,
      server_version: runtime.serverVersion,
      os: runtime.os,
      arch: runtime.arch,
    },
    image: {
      source: image.source,
      reference: image.reference,
      digest: image.digest,
      id: image.id,
      runner_tree_id: image.runnerTreeId,
      cached: image.cached,
    },
    platform: SANDBOX_PLATFORM,
    network,
  };
}

export const containerInspectSchema = z
  .array(
    z.object({
      State: z.object({
        Status: z.string(),
        Running: z.boolean(),
        ExitCode: z.number().int(),
        OOMKilled: z.boolean(),
        Error: z.string().optional(),
      }),
    }),
  )
  .length(1);

export interface ContainerExecutionContext {
  readonly runtime: SelectedRuntime;
  readonly image: ResolvedImage;
  readonly runId: RecordRunId;
  readonly runAttempt: number;
  readonly testNonce: string | null;
  readonly clock: Clock;
  readonly control?: ProcessRunner;
  readonly stream?: StreamProcessRunner;
}

export interface ContainerExecutionInput {
  readonly entry: ExecutionPlanEntry;
  readonly archivePath: string;
  readonly checkout: NonNullable<ExecutionRecord['checkout']>;
  readonly limits: ContainerExecutionLimits;
  readonly preparedCopyPath: string | null;
}

export type ContainerExecutionResult =
  | {
      readonly kind: 'completed';
      readonly execution: CompletedExecution;
      readonly durationMs: number;
      readonly preparedCopy: { readonly path: string; readonly bytes: number; readonly sha256: string } | null;
      readonly dependencyFailure: 'runner.dependency-step-failed' | 'runner.prepared-copy-too-large' | null;
    }
  | { readonly kind: 'environment-failure'; readonly code: ExecutionFailureCode; readonly subject: string | null };

type Completed = Extract<ContainerExecutionResult, { kind: 'completed' }>;
type InspectState = z.output<typeof containerInspectSchema>[number]['State'];

const VOLUME_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/;
const CONTAINER_ID = /^[0-9a-f]{64}$/;

export async function runContainerExecution(
  ctx: ContainerExecutionContext,
  input: ContainerExecutionInput,
): Promise<ContainerExecutionResult> {
  const { runtime, image, clock } = ctx;
  const { entry, limits } = input;
  const control = ctx.control ?? runProcess;
  const stream = ctx.stream ?? streamProcess;
  const labels: RuntimeLabels = { runId: String(ctx.runId), testNonce: ctx.testNonce };
  const cwd = os.tmpdir();

  const st: {
    failure: { code: ExecutionFailureCode; subject: string | null } | null;
    completed: Completed | null;
    prepared: string | null;
  } = { failure: null, completed: null, prepared: null };
  const fail = (code: ExecutionFailureCode, subject: string | null): void => {
    st.failure ??= { code, subject };
  };
  const ctl = (args: readonly string[], timeoutMs: number) =>
    control(runtime.binary, args, { cwd, env: runtime.env, timeoutMs, maxOutputBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES });

  const stopAndWait = async (containerId: string): Promise<void> => {
    await ctl(runtimeKillArgs(containerId), RUNTIME_KILL_GRACE_MS);
    const waited = await ctl(runtimeWaitArgs(containerId), RUNTIME_KILL_GRACE_MS);
    if (!waited.ok || waited.value.exitCode !== 0) fail('runner.cleanup-failed', null);
  };

  const lifecycle = async (containerId: string, startTimeout: () => number): Promise<void> => {
    const copyIn = await stream(runtime.binary, runtimeCopyInArgs(containerId), {
      cwd,
      env: runtime.env,
      timeoutMs: startTimeout(),
      stdin: { kind: 'file', path: input.archivePath },
      output: { kind: 'sink', onStdout: () => 'continue', stderrMaxBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES },
    });
    if (!copyIn.ok || copyIn.value.stopReason !== null || copyIn.value.exitCode !== 0) {
      fail('runner.copy-failed', 'checkout');
      return;
    }

    const dependency = entry.kind === 'dependency-step';
    const seconds = dependency ? limits.dependencyStepSeconds : limits.executionSeconds;
    const startedAt = clock.now();
    const started = await stream(runtime.binary, runtimeStartArgs(containerId), {
      cwd,
      env: runtime.env,
      timeoutMs: seconds * 1000,
      stdin: { kind: 'closed' },
      output: {
        kind: 'capture',
        limits: { headBytes: limits.outputHeadBytes, tailBytes: limits.outputTailBytes, streamBytes: limits.outputStreamBytes },
      },
    });
    const finishedAt = clock.now();
    if (!started.ok || started.value.captured === null) {
      fail('runner.start-failed', null);
      return;
    }
    const outcome = started.value;
    const stopReason = outcome.stopReason;
    if (stopReason === 'timeout' || stopReason === 'output-limit') {
      await stopAndWait(containerId);
      if (st.failure !== null) return;
    }

    const inspected = await ctl(runtimeInspectArgs(containerId), RUNTIME_CONTROL_TIMEOUT_MS);
    let state: InspectState | null = null;
    if (inspected.ok && inspected.value.exitCode === 0) {
      try {
        const parsed = containerInspectSchema.safeParse(JSON.parse(inspected.value.stdout.toString('utf8')));
        if (parsed.success) state = parsed.data[0]?.State ?? null;
      } catch {
        state = null;
      }
    }
    if (state === null) {
      fail('runner.inspect-invalid', null);
      return;
    }
    if (state.Running) {
      await stopAndWait(containerId);
      fail('runner.start-failed', 'attach');
      return;
    }
    if (state.Status === 'created' || (state.Error !== undefined && state.Error !== '')) {
      fail('runner.start-failed', null);
      return;
    }

    const exit = {
      code: state.ExitCode,
      signal: null,
      timedOut: stopReason === 'timeout',
      oomKilled: state.OOMKilled,
      outputLimited: stopReason === 'output-limit',
    };

    const resultFiles: ResultFileRead[] = [];
    for (const declared of entry.result_files) {
      const read = await copyOutResultFile(
        { runtime, timeoutMs: RUNTIME_CONTROL_TIMEOUT_MS, stream, ...(volume === null ? {} : { volume }) },
        containerId,
        declared.path,
        limits.resultFileBytes,
      );
      if (!read.ok) {
        fail('runner.copy-failed', declared.path);
        return;
      }
      resultFiles.push(read.value);
    }

    let dependencyFailure: Completed['dependencyFailure'] = null;
    let preparedCopy: Completed['preparedCopy'] = null;
    if (dependency) {
      const bad = exit.code !== 0 || exit.timedOut || exit.oomKilled || exit.outputLimited;
      dependencyFailure = bad ? 'runner.dependency-step-failed' : null;
      if (!bad && input.preparedCopyPath !== null) {
        const exported = await exportPreparedCopy(
          { runtime, timeoutMs: limits.dependencyStepSeconds * 1000, stream, ...(volume === null ? {} : { volume }) },
          containerId,
          input.preparedCopyPath,
          limits.preparedCheckoutBytes,
        );
        if (exported.ok) {
          preparedCopy = exported.value;
          st.prepared = exported.value.path;
        } else if (exported.failure.code === 'runner.prepared-copy-too-large') {
          dependencyFailure = 'runner.prepared-copy-too-large';
        } else {
          fail('runner.copy-failed', 'prepared-copy');
          return;
        }
      }
    }

    const execution = buildCompletedExecution({
      runId: ctx.runId,
      runAttempt: ctx.runAttempt,
      entry,
      runner: 'container',
      environment: containerEnvironment(runtime, image, entry.network),
      limits: {
        execution_seconds: seconds,
        output_head_bytes: limits.outputHeadBytes,
        output_tail_bytes: limits.outputTailBytes,
        output_stream_bytes: limits.outputStreamBytes,
        cpus: limits.cpus,
        memory_mb: limits.memoryMb,
        pids: limits.pids,
        scratch_mb: limits.scratchMb,
      },
      timing: { started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(), duration_ms: outcome.durationMs },
      exit,
      capture: outcome.captured as NonNullable<typeof outcome.captured>,
      resultFiles,
      resultTestCases: limits.resultTestCases,
      checkout: input.checkout,
    });
    st.completed = { kind: 'completed', execution, durationMs: outcome.durationMs, preparedCopy, dependencyFailure };
  };

  let volume: string | null = null;
  let id: string | null = null;
  try {
    if (entry.result_files.length > limits.resultFiles) {
      fail('runner.copy-failed', 'result_files');
    } else {
      const startDeadline = Date.now() + limits.containerStartSeconds * 1000;
      const startTimeout = (): number => Math.max(1, Math.min(RUNTIME_CONTROL_TIMEOUT_MS, startDeadline - Date.now()));

      const volumeRun = await ctl(runtimeVolumeCreateArgs(labels), startTimeout());
      const volumeName = volumeRun.ok && volumeRun.value.exitCode === 0 ? volumeRun.value.stdout.toString('utf8').trim() : '';
      if (!VOLUME_NAME.test(volumeName)) {
        fail('runner.create-failed', 'volume');
      } else {
        volume = volumeName;
        const createRun = await ctl(
          runtimeCreateArgs(runtime.name, {
            labels,
            network: entry.network,
            resources: { cpus: limits.cpus, memoryMb: limits.memoryMb, pids: limits.pids, scratchMb: limits.scratchMb },
            volume,
            workingDirectory: entry.working_directory,
            imageReference: image.runReference,
            run: entry.run,
          }),
          startTimeout(),
        );
        let lastLine = '';
        if (createRun.ok && createRun.value.exitCode === 0) {
          const lines = createRun.value.stdout
            .toString('utf8')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l !== '');
          lastLine = lines[lines.length - 1] ?? '';
        }
        if (!CONTAINER_ID.test(lastLine)) {
          fail('runner.create-failed', 'container');
        } else {
          id = lastLine;
          const warned = createRun.ok
            ? new TextDecoder('utf-8')
                .decode(createRun.value.stderr)
                .split('\n')
                .some((l) => /warn/i.test(l) && /memory|swap|cpu|pids|limit|cgroup/i.test(l))
            : false;
          if (warned) fail('runner.limits-unenforceable', null);
          else await lifecycle(id, startTimeout);
        }
      }
    }
  } catch {
    fail('runner.start-failed', null);
  } finally {
    for (const args of [id === null ? null : runtimeRemoveArgs(id), volume === null ? null : runtimeVolumeRemoveArgs(volume)]) {
      if (args === null) continue;
      const removed = await ctl(args, RUNTIME_CONTROL_TIMEOUT_MS).catch(() => null);
      if (removed === null || !removed.ok || removed.value.exitCode !== 0) fail('runner.cleanup-failed', null);
    }
  }

  if (st.failure !== null || st.completed === null) {
    if (st.prepared !== null) fs.rmSync(st.prepared, { force: true });
    return { kind: 'environment-failure', code: st.failure?.code ?? 'runner.start-failed', subject: st.failure?.subject ?? null };
  }
  return st.completed;
}
