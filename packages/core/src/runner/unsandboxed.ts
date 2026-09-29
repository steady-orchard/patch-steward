import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Clock } from '../clock.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import type { ProcessRunner } from '../process/run-process.js';
import { streamProcess, type StreamProcessRunner } from '../process/stream-process.js';
import type { RecordRunId } from '../records/common.js';
import { ok, type Result } from '../result.js';
import { commandDirectory, guardOwnCheckout } from './checkout-guard.js';
import { buildCompletedExecution, type CompletedExecution, type ResultFileRead } from './record.js';
import { commandForPlatform } from './windows-shim.js';

export interface UnsandboxedLimits {
  readonly executionSeconds: number;
  readonly outputHeadBytes: number;
  readonly outputTailBytes: number;
  readonly outputStreamBytes: number;
  readonly resultFiles: number;
  readonly resultFileBytes: number;
  readonly resultTestCases: number;
}

export function unsandboxedLimitsFromPolicy(policy: ResolvedPolicy): UnsandboxedLimits {
  const l = policy.limits.execution;
  return {
    executionSeconds: l.execution_seconds,
    outputHeadBytes: l.output_head_bytes,
    outputTailBytes: l.output_tail_bytes,
    outputStreamBytes: l.output_stream_bytes,
    resultFiles: l.result_files,
    resultFileBytes: l.result_file_bytes,
    resultTestCases: l.result_test_cases,
  };
}

const WITHHELD_NAMES = new Set(['GH_TOKEN', 'GITHUB_TOKEN', 'STEWARD_LLM_API_KEY']);

export function unsandboxedEnvironment(
  hostEnv: Readonly<Record<string, string | undefined>>,
  credentials: readonly string[],
): Record<string, string> {
  const secrets = new Set(credentials.filter((c) => c !== ''));
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(hostEnv)) {
    if (value === undefined || WITHHELD_NAMES.has(key.toUpperCase()) || secrets.has(value)) continue;
    env[key] = value;
  }
  return env;
}

export interface UnsandboxedRunnerInput {
  readonly checkoutRoot: string;
  readonly processCwd: string;
  readonly previewWorktrees: readonly string[];
  readonly hostEnv: Readonly<Record<string, string | undefined>>;
  readonly credentials: readonly string[];
  readonly runId: RecordRunId;
  readonly runAttempt: number;
  readonly clock: Clock;
  readonly platform?: NodeJS.Platform;
  readonly git?: ProcessRunner;
  readonly stream?: StreamProcessRunner;
  readonly fileExists?: (path: string) => boolean;
}

export type UnsandboxedExecutionResult =
  | {
      readonly kind: 'completed';
      readonly execution: CompletedExecution;
      readonly viaCmd: boolean;
      readonly argv: readonly string[];
      readonly directory: string;
    }
  | { readonly kind: 'refused'; readonly code: 'runner.not-own-checkout'; readonly subject: string }
  | { readonly kind: 'environment-failure'; readonly code: 'runner.start-failed'; readonly subject: string };

export interface UnsandboxedRunner {
  readonly root: string;
  readonly kind: 'checkout' | 'preview';
  run(entry: ExecutionPlanEntry, limits: UnsandboxedLimits): Promise<UnsandboxedExecutionResult>;
}

async function readResultFile(root: string, rel: string, maxBytes: number): Promise<ResultFileRead> {
  const full = rel === '.' ? root : path.join(root, rel);
  try {
    const stat = await fs.promises.lstat(full);
    if (!stat.isFile()) return { kind: 'not-regular' };
    const real = await fs.promises.realpath(full);
    if (real !== root && !real.startsWith(root + path.sep)) return { kind: 'not-regular' };
    const size = (await fs.promises.stat(real)).size;
    if (size > maxBytes) return { kind: 'too-large', declaredBytes: size };
    const bytes = await fs.promises.readFile(real);
    if (bytes.length > maxBytes) return { kind: 'too-large', declaredBytes: bytes.length };
    return { kind: 'file', bytes };
  } catch {
    return { kind: 'missing' };
  }
}

export async function createUnsandboxedRunner(
  input: UnsandboxedRunnerInput,
): Promise<Result<UnsandboxedRunner, 'runner.not-own-checkout'>> {
  const guarded = await guardOwnCheckout({
    checkoutRoot: input.checkoutRoot,
    processCwd: input.processCwd,
    previewWorktrees: input.previewWorktrees,
    env: input.hostEnv,
    ...(input.git ? { runner: input.git } : {}),
  });
  if (!guarded.ok) return guarded;
  const { root, kind } = guarded.value;
  const platform = input.platform ?? process.platform;
  const stream = input.stream ?? streamProcess;

  const run = async (entry: ExecutionPlanEntry, limits: UnsandboxedLimits): Promise<UnsandboxedExecutionResult> => {
    if (entry.result_files.length > limits.resultFiles) {
      return { kind: 'environment-failure', code: 'runner.start-failed', subject: 'result_files' };
    }
    const dir = await commandDirectory(root, entry.working_directory);
    if (!dir.ok) return { kind: 'refused', code: 'runner.not-own-checkout', subject: entry.working_directory };

    const env = unsandboxedEnvironment(input.hostEnv, input.credentials);
    const cmd = commandForPlatform(entry.run, { platform, env, ...(input.fileExists ? { fileExists: input.fileExists } : {}) });
    const captureLimits = {
      headBytes: limits.outputHeadBytes,
      tailBytes: limits.outputTailBytes,
      streamBytes: limits.outputStreamBytes,
    };

    const startedAt = input.clock.now();
    const outcome = await stream(cmd.binary, cmd.args, {
      cwd: dir.value,
      env,
      timeoutMs: limits.executionSeconds * 1000,
      stdin: { kind: 'closed' },
      output: { kind: 'capture', limits: captureLimits },
      killTree: true,
      windowsVerbatimArguments: cmd.windowsVerbatimArguments,
    });
    const finishedAt = input.clock.now();
    if (!outcome.ok) {
      return { kind: 'environment-failure', code: 'runner.start-failed', subject: entry.run[0] ?? '' };
    }
    const { value } = outcome;

    const resultFiles: ResultFileRead[] = [];
    for (const declared of entry.result_files) {
      resultFiles.push(await readResultFile(root, declared.path, limits.resultFileBytes));
    }

    const execution = buildCompletedExecution({
      runId: input.runId,
      runAttempt: input.runAttempt,
      entry,
      runner: 'unsandboxed',
      environment: {
        image_digest: null,
        tool_versions: [],
        runtime: { name: 'host', client_version: null, server_version: null, os: platform, arch: process.arch },
        image: null,
        platform: platform + '/' + process.arch,
        network: 'egress',
      },
      limits: {
        execution_seconds: limits.executionSeconds,
        output_head_bytes: limits.outputHeadBytes,
        output_tail_bytes: limits.outputTailBytes,
        output_stream_bytes: limits.outputStreamBytes,
        cpus: null,
        memory_mb: null,
        pids: null,
        scratch_mb: null,
      },
      timing: { started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(), duration_ms: value.durationMs },
      exit: {
        code: value.exitCode,
        signal: value.signal,
        timedOut: value.stopReason === 'timeout',
        oomKilled: false,
        outputLimited: value.stopReason === 'output-limit',
      },
      capture: value.captured ?? new OutputCaptureBuffer(captureLimits).result(),
      resultFiles,
      resultTestCases: limits.resultTestCases,
      checkout: null,
    });
    return { kind: 'completed', execution, viaCmd: cmd.viaCmd, argv: [cmd.binary, ...cmd.args], directory: dir.value };
  };

  return ok({ root, kind, run });
}
