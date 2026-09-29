import { randomBytes } from 'node:crypto';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { systemClock } from '../clock.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import {
  createFixtureRepository,
  loadFixtureManifest,
  type FixtureManifest,
  type FixtureRepository,
} from '../materialize/fixture-repository.fixture.test.js';
import { materializeCommit, materializeLimitsFromPolicy } from '../materialize/materialize.js';
import { runProcess, type ProcessRunner } from '../process/run-process.js';
import { streamProcess, type StreamProcessRunner } from '../process/stream-process.js';
import type { ExecutionRecord } from '../records/execution-record.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import {
  containerLimitsFromPolicy,
  runContainerExecution,
  type ContainerExecutionLimits,
  type ContainerExecutionResult,
} from './container.js';
import {
  imageLimitsFromPolicy,
  prepareRunnerImage,
  type ImageLimits,
  type PreparedRunnerImage,
  type RunnerImageSpec,
} from './image.js';
import { selectContainerRuntime } from './runtime.js';
import type { ContainerRuntimeName, ResolvedImage, SelectedRuntime } from './types.js';

const runtimeEnv = process.env['STEWARD_CONTAINER_RUNTIME'] ?? 'docker';
if (runtimeEnv !== 'docker' && runtimeEnv !== 'podman') {
  throw new Error(`STEWARD_CONTAINER_RUNTIME must be docker or podman, got ${runtimeEnv}`);
}

export const RUNTIME_NAME: ContainerRuntimeName = runtimeEnv;

export const HARNESS_LIMITS: ContainerExecutionLimits = {
  ...containerLimitsFromPolicy(DEFAULT_CHECKLIST_POLICY),
  executionSeconds: 120,
  cpus: 1,
  memoryMb: 512,
  pids: 128,
  scratchMb: 64,
};

export interface HarnessCall {
  readonly binary: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

export interface HarnessCheckout {
  readonly commit: string;
  readonly archivePath: string;
  readonly checkout: NonNullable<ExecutionRecord['checkout']>;
}

export interface HarnessRunInput {
  readonly image: ResolvedImage;
  readonly checkout: HarnessCheckout;
  readonly run: readonly string[];
  readonly resultFiles?: ExecutionPlanEntry['result_files'];
  readonly workingDirectory?: string;
  readonly limits?: Partial<ContainerExecutionLimits>;
}

export interface ContainerHarness {
  readonly runtime: SelectedRuntime;
  readonly nonce: string;
  readonly calls: HarnessCall[];
  readonly inspected: unknown[];
  prepareImage(spec: RunnerImageSpec | string, limits?: Partial<ImageLimits>): Promise<PreparedRunnerImage>;
  materialize(manifest: FixtureManifest | string): Promise<HarnessCheckout>;
  run(input: HarnessRunInput): Promise<ContainerExecutionResult>;
  close(): Promise<void>;
}

export function outputText(result: ContainerExecutionResult): string {
  return result.kind === 'completed' ? result.execution.output.parts.join('') : '';
}

export async function openContainerHarness(options?: {
  readonly hostEnv?: Readonly<Record<string, string | undefined>>;
}): Promise<ContainerHarness> {
  const hostEnv = options?.hostEnv ?? process.env;
  const nonce = randomBytes(6).toString('hex');
  const calls: HarnessCall[] = [];
  const inspected: unknown[] = [];
  const repos: FixtureRepository[] = [];
  const disposers: (() => void)[] = [];

  const control: ProcessRunner = (binary, args, opts) => {
    calls.push({ binary, args: [...args], env: { ...opts.env } });
    return runProcess(binary, args, opts);
  };
  const selection = await selectContainerRuntime({ choice: RUNTIME_NAME, hostEnv, control });
  if (!selection.ok) throw new Error(JSON.stringify(selection));
  const runtime = selection.value;

  const runId = 'local-20261003T101500Z-' + nonce.slice(0, 8);

  const stream: StreamProcessRunner = async (binary, args, opts) => {
    calls.push({ binary, args: [...args], env: { ...opts.env } });
    if (args[0] === 'start') {
      const res = await runProcess(runtime.binary, ['container', 'inspect', args[args.length - 1] ?? ''], {
        cwd: os.tmpdir(),
        env: runtime.env,
        timeoutMs: 120000,
        maxOutputBytes: 1048576,
      });
      if (res.ok) inspected.push(JSON.parse(res.value.stdout.toString('utf8')) as unknown);
    }
    return streamProcess(binary, args, opts);
  };

  return {
    runtime,
    nonce,
    calls,
    inspected,
    async prepareImage(spec, limits) {
      const resolved: RunnerImageSpec = typeof spec === 'string' ? { source: 'registry', reference: spec } : spec;
      return prepareRunnerImage({ runtime, testNonce: nonce, control, stream, runId }, resolved, {
        ...imageLimitsFromPolicy(DEFAULT_CHECKLIST_POLICY),
        ...limits,
      });
    },
    async materialize(manifest) {
      const repo = createFixtureRepository(typeof manifest === 'string' ? loadFixtureManifest(manifest) : manifest);
      repos.push(repo);
      const materialized = await materializeCommit({
        source: { kind: 'local-path', path: repo.dir },
        commit: repo.commit,
        token: null,
        overlay: [],
        limits: materializeLimitsFromPolicy(DEFAULT_CHECKLIST_POLICY),
        hostEnv,
      });
      if (!materialized.ok) throw new Error(JSON.stringify(materialized));
      disposers.push(() => materialized.value.dispose());
      const { checkout } = materialized.value;
      return {
        commit: repo.commit,
        archivePath: materialized.value.archivePath,
        checkout: {
          ...checkout,
          overlays: checkout.overlays.map((o) => ({ ...o })),
          skipped_submodules: [...checkout.skipped_submodules],
        },
      };
    },
    async run(input) {
      const entry: ExecutionPlanEntry = {
        id: 'head-test',
        kind: 'command',
        command_id: 'test',
        run: [...input.run],
        working_directory: input.workingDirectory ?? '.',
        commit_role: 'head',
        commit: input.checkout.commit,
        overlay: 'none',
        expected: 'exit-zero',
        network: 'none',
        result_files: input.resultFiles ?? [],
      };
      return runContainerExecution(
        {
          runtime,
          image: input.image,
          runId,
          runAttempt: 1,
          testNonce: nonce,
          clock: systemClock,
          control,
          stream,
        },
        {
          entry,
          archivePath: input.checkout.archivePath,
          checkout: input.checkout.checkout,
          limits: { ...HARNESS_LIMITS, ...input.limits },
          preparedCopyPath: null,
        },
      );
    },
    async close() {
      for (const dispose of disposers) dispose();
      for (const repo of repos) repo.dispose();
      const label = 'label=org.patch-steward.test=' + nonce;
      for (const args of [
        ['ps', '-a', '-q', '--filter', label],
        ['volume', 'ls', '-q', '--filter', label],
        ['image', 'ls', '-q', '--filter', label],
      ]) {
        const res = await runProcess(runtime.binary, args, {
          cwd: os.tmpdir(),
          env: runtime.env,
          timeoutMs: 120000,
          maxOutputBytes: 1048576,
        });
        expect(res.ok, JSON.stringify(res)).toBe(true);
        if (res.ok) {
          expect(res.value.exitCode).toBe(0);
          expect(res.value.stdout.toString('utf8').trim()).toBe('');
        }
      }
    },
  };
}

describe('container harness', () => {
  it('reads the runtime name', () => {
    expect(['docker', 'podman']).toContain(RUNTIME_NAME);
  });
});
