import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { steppingClock } from '../clock.js';
import { decideOutcome } from '../decision/table.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import { EXECUTION_FAILURE_CODES, executionFailureCause, type ExecutionFailureCode } from '../execution/results.js';
import type { ProcessOutput, ProcessRunner } from '../process/run-process.js';
import type { StreamProcessRunner, StreamStopReason } from '../process/stream-process.js';
import type { RecordRunId } from '../records/common.js';
import { err, ok } from '../result.js';
import { readRunnerBuildContext } from '../runner/build-context.js';
import { runContainerExecution, type ContainerExecutionLimits, type ContainerExecutionResult } from '../runner/container.js';
import { prepareRunnerImage, type ImageLimits } from '../runner/image.js';
import { selectContainerRuntime } from '../runner/runtime.js';
import type { ResolvedImage, SelectedRuntime } from '../runner/types.js';

function expectEnvironmentFailure(code: ExecutionFailureCode): void {
  const cause = executionFailureCause(code);
  expect(cause).toBe('environment-unavailable');
  const decision = decideOutcome({
    freshness: 'current',
    capacity: 'available',
    admission: 'not-required',
    findings: [],
    causes: [{ cause, code, message: 'injected', subjects: [] }],
    requiredStages: [],
    stageResults: [],
    requirements: [],
  });
  expect(decision).toMatchObject({ kind: 'outcome', outcome: 'inconclusive' });
  expect(decision.kind === 'outcome' && decision.outcome === 'pass').toBe(false);
}

const dockerUp = {
  Client: { Version: '29.8.0' },
  Server: { Version: '29.8.0', Os: 'linux', Arch: 'amd64' },
};
const dockerInfoOk = { OSType: 'linux', MemoryLimit: true, PidsLimit: true, CpuCfsQuota: true, Warnings: [] as string[] };
const podmanLocal = { Client: { Version: '5.6.1', OsArch: 'linux/amd64', Os: 'linux' } };

function runtimeControl(replies: Record<string, unknown>): ProcessRunner {
  return async (binary, args) => {
    const body = replies[`${binary}:${args[0]}`];
    if (body === undefined) return err('process.unavailable', 'infrastructure', 'x');
    return ok({ exitCode: 0, stdout: Buffer.from(JSON.stringify(body)), stderr: Buffer.alloc(0) });
  };
}

async function selectFailure(choice: 'docker' | 'podman', replies: Record<string, unknown>): Promise<string> {
  const selected = await selectContainerRuntime({
    choice,
    hostEnv: { PATH: 'p' },
    control: runtimeControl(replies),
    platform: 'linux',
  });
  if (selected.ok) throw new Error('expected a runtime failure');
  return selected.failure.code;
}

const runtime: SelectedRuntime = {
  name: 'docker',
  binary: 'docker',
  env: { PATH: 'p' },
  clientVersion: '29.8.0',
  serverVersion: '29.8.0',
  os: 'linux',
  arch: 'amd64',
};
const digest = 'a'.repeat(64);
const imageLimits: ImageLimits = {
  pullSeconds: 600,
  buildSeconds: 1800,
  imageBytes: 4294967296,
  buildOutputStreamBytes: 268435456,
};
const reference = 'docker.io/library/busybox@sha256:' + digest;

type ImageReply = { exit: number; stdout?: string };

function imageControl(replies: ImageReply[]): ProcessRunner {
  return async () => {
    const reply = replies.shift() ?? { exit: 1 };
    return ok({ exitCode: reply.exit, stdout: Buffer.from(reply.stdout ?? ''), stderr: Buffer.alloc(0) });
  };
}

function inspectReply(repoDigest: string, size: number): ImageReply {
  return {
    exit: 0,
    stdout: JSON.stringify([{ Id: 'sha256:' + 'e'.repeat(64), RepoDigests: [repoDigest], Size: size, Config: { Labels: {} } }]),
  };
}

async function pullFailure(replies: ImageReply[]): Promise<string> {
  const prepared = await prepareRunnerImage(
    { runtime, testNonce: null, control: imageControl(replies) },
    { source: 'registry', reference },
    imageLimits,
  );
  if (prepared.result.ok) throw new Error('expected an image failure');
  return prepared.result.failure.code;
}

async function buildFailure(): Promise<string> {
  const stream: StreamProcessRunner = async () => {
    const buffer = new OutputCaptureBuffer({ headBytes: 1024, tailBytes: 1024, streamBytes: 4096 });
    return ok({ exitCode: 1, signal: null, stopReason: null, captured: buffer.result(), stderr: new Uint8Array(0), durationMs: 5 });
  };
  const prepared = await prepareRunnerImage(
    { runtime, testNonce: null, control: imageControl([{ exit: 1 }]), stream },
    {
      source: 'dockerfile',
      context: { runnerTreeId: 'b'.repeat(40), dockerfilePath: 'Dockerfile', archive: Uint8Array.from([1]) },
    },
    imageLimits,
  );
  if (prepared.result.ok) throw new Error('expected a build failure');
  return prepared.result.failure.code;
}

const image: ResolvedImage = {
  source: 'registry',
  reference: 'docker.io/library/busybox:1.37.0',
  digest: 'sha256:' + digest,
  id: 'sha256:' + 'b'.repeat(64),
  runnerTreeId: null,
  cached: false,
  runReference: reference,
};
const containerId = 'f'.repeat(64);
const containerLimits: ContainerExecutionLimits = {
  executionSeconds: 1800,
  dependencyStepSeconds: 600,
  outputHeadBytes: 262144,
  outputTailBytes: 786432,
  outputStreamBytes: 268435456,
  resultFiles: 5,
  resultFileBytes: 5242880,
  resultTestCases: 1000,
  preparedCheckoutBytes: 2147483648,
  containerStartSeconds: 120,
  cpus: 2,
  memoryMb: 4096,
  pids: 512,
  scratchMb: 1024,
};
const checkout = {
  commit: 'c'.repeat(40),
  tree: 'd'.repeat(40),
  archive_sha256: 'sha256:' + '1'.repeat(64),
  files: 1,
  bytes: 10,
  overlays: [],
  skipped_submodules: [],
};
const commandEntry = {
  id: 'head-test',
  kind: 'command',
  command_id: 'test',
  run: ['sh', 'run.sh'],
  working_directory: '.',
  commit_role: 'head',
  commit: 'c'.repeat(40),
  overlay: 'none',
  expected: 'exit-zero',
  network: 'none',
  result_files: [{ path: 'reports/junit.xml', format: 'junit-xml' }],
} as ExecutionPlanEntry;
const dependencyEntry = {
  ...commandEntry,
  id: 'head-dependency-step',
  kind: 'dependency-step',
  command_id: null,
  network: 'egress',
  result_files: [],
} as ExecutionPlanEntry;

interface Faults {
  control?: Record<string, { exitCode?: number; stdout?: string; fail?: boolean }>;
  stream?: Record<string, { exitCode?: number; stopReason?: StreamStopReason; fail?: boolean }>;
  inspect?: Record<string, unknown>;
}

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});

async function runWith(faults: Faults, entry: ExecutionPlanEntry = commandEntry): Promise<ContainerExecutionResult> {
  const control: ProcessRunner = async (_binary, args) => {
    const key = args[0] === 'volume' ? `volume ${args[1]}` : args[0] === 'container' ? 'container inspect' : (args[0] ?? '');
    const fault = faults.control?.[key] ?? {};
    if (fault.fail) return err('process.unavailable', 'infrastructure', 'x');
    const defaults: Record<string, string> = {
      'volume create': 'vol123\n',
      create: containerId + '\n',
      'container inspect': JSON.stringify([
        { State: { Status: 'exited', Running: false, ExitCode: 1, OOMKilled: false, Error: '', ...faults.inspect } },
      ]),
    };
    const out: ProcessOutput = {
      exitCode: fault.exitCode ?? 0,
      stdout: Buffer.from(fault.stdout ?? defaults[key] ?? ''),
      stderr: Buffer.alloc(0),
    };
    return ok(out);
  };
  const stream: StreamProcessRunner = async (_binary, args) => {
    const key = args[0] === 'start' ? 'start' : args[1] === '-a' ? 'copy-in' : 'copy-out';
    const fault = faults.stream?.[key] ?? {};
    if (fault.fail) return err('process.unavailable', 'infrastructure', 'x');
    let captured = null;
    if (key === 'start') {
      const buffer = new OutputCaptureBuffer({ headBytes: 1024, tailBytes: 1024, streamBytes: 4096 });
      buffer.push(Buffer.from('hello'));
      captured = buffer.result();
    }
    return ok({
      exitCode: fault.exitCode ?? (key === 'start' ? 1 : 0),
      signal: null,
      stopReason: fault.stopReason ?? null,
      captured,
      stderr: new Uint8Array(0),
      durationMs: 42,
    });
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-conformance-'));
  temps.push(dir);
  const archivePath = path.join(dir, 'checkout.tar');
  fs.writeFileSync(archivePath, 'x');
  return runContainerExecution(
    {
      runtime,
      image,
      runId: 'local-20261003T101500Z-3f9a1c2e' as RecordRunId,
      runAttempt: 1,
      testNonce: null,
      clock: steppingClock('2026-10-03T10:15:00.000Z', 1000),
      control,
      stream,
    },
    { entry, archivePath, checkout, limits: containerLimits, preparedCopyPath: null },
  );
}

describe('invariant 4: execution failures never pass', () => {
  it('exit E4: runtime failures are environment failures', async () => {
    const cases: [string, string][] = [
      [await selectFailure('docker', {}), 'runner.runtime-unavailable'],
      [
        await selectFailure('docker', { 'docker:version': { ...dockerUp, Server: { ...dockerUp.Server, Os: 'windows' } } }),
        'runner.runtime-not-linux',
      ],
      [
        await selectFailure('docker', {
          'docker:version': dockerUp,
          'docker:info': { ...dockerInfoOk, MemoryLimit: false },
        }),
        'runner.limits-unenforceable',
      ],
      [
        await selectFailure('podman', {
          'podman:version': podmanLocal,
          'podman:info': { host: { cgroupVersion: 'v2', cgroupControllers: ['cpu', 'memory'] } },
        }),
        'runner.limits-unenforceable',
      ],
    ];
    for (const [actual, expected] of cases) {
      expect(actual).toBe(expected);
      expectEnvironmentFailure(actual as ExecutionFailureCode);
    }
  });

  it('exit E4: image failures are environment failures', async () => {
    const other = 'docker.io/library/busybox@sha256:' + 'c'.repeat(64);
    const cases: [string, string][] = [
      [await pullFailure([{ exit: 1 }]), 'runner.image-pull-failed'],
      [await pullFailure([{ exit: 0 }, inspectReply(other, 10)]), 'runner.image-digest-mismatch'],
      [await pullFailure([{ exit: 0 }, inspectReply(reference, 4294967297)]), 'runner.image-too-large'],
      [await buildFailure(), 'runner.image-build-failed'],
    ];
    const outside = await readRunnerBuildContext(
      { kind: 'git', repoDir: os.tmpdir(), policyTreeId: 'a'.repeat(40) },
      { dockerfilePath: 'Dockerfile', maxBytes: 1024 },
    );
    const unavailable = await readRunnerBuildContext({ kind: 'local-file' }, { dockerfilePath: 'Dockerfile', maxBytes: 1024 });
    if (outside.ok || unavailable.ok) throw new Error('expected build context failures');
    cases.push(
      [outside.failure.code, 'runner.build-context-invalid'],
      [unavailable.failure.code, 'runner.image-source-unavailable'],
    );
    for (const [actual, expected] of cases) {
      expect(actual).toBe(expected);
      expectEnvironmentFailure(actual as ExecutionFailureCode);
    }
  });

  it('exit E4: container failures are environment failures', async () => {
    const cases: [Faults, string][] = [
      [{ control: { create: { exitCode: 1 } } }, 'runner.create-failed'],
      [{ stream: { 'copy-in': { exitCode: 1 } } }, 'runner.copy-failed'],
      [{ stream: { 'copy-out': { exitCode: 1 } } }, 'runner.copy-failed'],
      [{ inspect: { Error: 'exec failed' } }, 'runner.start-failed'],
      [{ inspect: { Status: 'created' } }, 'runner.start-failed'],
      [{ inspect: { Running: true } }, 'runner.start-failed'],
      [{ control: { 'container inspect': { stdout: 'not json' } } }, 'runner.inspect-invalid'],
      [{ stream: { start: { stopReason: 'timeout' } }, control: { wait: { exitCode: 1 } } }, 'runner.cleanup-failed'],
      [{ control: { rm: { exitCode: 1 } } }, 'runner.cleanup-failed'],
    ];
    for (const [faults, expected] of cases) {
      const entry = expected === 'runner.cleanup-failed' ? { ...commandEntry, result_files: [] } : commandEntry;
      const result = await runWith(faults, entry);
      expect(result.kind).toBe('environment-failure');
      if (result.kind !== 'environment-failure') continue;
      expect(result.code).toBe(expected);
      expectEnvironmentFailure(result.code);
    }
  });

  it('exit E4: a failed dependency step is an environment failure', async () => {
    const result = await runWith({ inspect: { ExitCode: 2 } }, dependencyEntry);
    if (result.kind !== 'completed') throw new Error('expected a completed dependency step');
    const failure = result.dependencyFailure;
    expect(failure).toBe('runner.dependency-step-failed');
    if (failure === null) throw new Error('expected a dependency failure');
    expectEnvironmentFailure(failure);
  });

  it('exit E4: environment failures never yield pass', () => {
    expect(EXECUTION_FAILURE_CODES).toHaveLength(21);
    for (const code of EXECUTION_FAILURE_CODES) expectEnvironmentFailure(code);
  });
});
