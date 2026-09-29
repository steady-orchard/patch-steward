import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTarArchive } from '../archive/tar.js';
import { steppingClock } from '../clock.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import { executionResultEntrySchema } from '../execution/transport.js';
import type { ProcessOutput, ProcessRunner } from '../process/run-process.js';
import type { StreamProcessOptions, StreamProcessRunner, StreamStopReason } from '../process/stream-process.js';
import type { RecordRunId } from '../records/common.js';
import { err, ok } from '../result.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { runtimeCreateArgs, forbiddenRuntimeArguments } from './argv.js';
import {
  containerLimitsFromPolicy,
  runContainerExecution,
  type ContainerExecutionInput,
  type ContainerExecutionLimits,
  type ContainerExecutionResult,
} from './container.js';
import type { ResolvedImage, SelectedRuntime } from './types.js';

const runtime: SelectedRuntime = {
  name: 'docker',
  binary: 'docker',
  env: { PATH: 'p' },
  clientVersion: '29.8.0',
  serverVersion: '29.8.0',
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
const runId = 'local-20261003T101500Z-3f9a1c2e' as RecordRunId;
const id = 'f'.repeat(64);
const limits: ContainerExecutionLimits = {
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
const JUNIT = '<testsuites><testsuite name="s"><testcase classname="c" name="t"/></testsuite></testsuites>';

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});
function tempDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-container-'));
  temps.push(d);
  return d;
}

interface Recorded {
  kind: 'control' | 'stream';
  binary: string;
  args: readonly string[];
  options: StreamProcessOptions | Parameters<ProcessRunner>[2];
}

interface Overrides {
  control?: Record<string, Partial<{ exitCode: number; stdout: string; stderr: string; fail: boolean }>>;
  stream?: Record<string, Partial<{ exitCode: number; stopReason: StreamStopReason | null; fail: boolean }>>;
  inspect?: Record<string, unknown>;
}

function setup(overrides: Overrides = {}) {
  const calls: Recorded[] = [];
  const control: ProcessRunner = async (binary, args, options) => {
    calls.push({ kind: 'control', binary, args, options });
    const key = args[0] === 'volume' ? `volume ${args[1]}` : args[0] === 'container' ? 'container inspect' : (args[0] ?? '');
    const o = overrides.control?.[key] ?? {};
    if (o.fail) return err('process.unavailable', 'infrastructure', 'x');
    const defaults: Record<string, string> = {
      'volume create': 'vol123\n',
      create: id + '\n',
      'container inspect': JSON.stringify([
        { State: { Status: 'exited', Running: false, ExitCode: 1, OOMKilled: false, Error: '', ...overrides.inspect } },
      ]),
    };
    const out: ProcessOutput = {
      exitCode: o.exitCode ?? 0,
      stdout: Buffer.from(o.stdout ?? defaults[key] ?? ''),
      stderr: Buffer.from(o.stderr ?? ''),
    };
    return ok(out);
  };
  const stream: StreamProcessRunner = async (binary, args, options) => {
    calls.push({ kind: 'stream', binary, args, options });
    const copyIn = args[1] === '-a';
    const key = args[0] === 'start' ? 'start' : copyIn ? 'copy-in' : args[1]?.endsWith(':/work/checkout') ? 'prepared' : 'copy-out';
    const o = overrides.stream?.[key] ?? {};
    if (o.fail) return err('process.unavailable', 'infrastructure', 'x');
    let captured = null;
    let stopReason: StreamStopReason | null = o.stopReason ?? null;
    if (key === 'start') {
      const buffer = new OutputCaptureBuffer({ headBytes: 262144, tailBytes: 786432, streamBytes: 268435456 });
      buffer.push(Buffer.from('hello'));
      captured = buffer.result();
    } else if (options.output.kind === 'sink' && !copyIn) {
      const archive =
        key === 'prepared'
          ? buildTarArchive([{ path: 'checkout', type: 'directory', mode: 0o755, mtime: 0 }])
          : buildTarArchive([{ path: 'junit.xml', type: 'file', mode: 0o644, mtime: 0, content: Buffer.from(JUNIT) }]);
      for (let i = 0; i < archive.length; i += 4096) {
        if (options.output.onStdout(archive.subarray(i, i + 4096)) === 'stop') {
          stopReason = 'sink-stop';
          break;
        }
      }
    }
    return ok({
      exitCode: o.exitCode ?? (key === 'start' ? 1 : 0),
      signal: null,
      stopReason,
      captured,
      stderr: new Uint8Array(0),
      durationMs: 42,
    });
  };
  return { calls, control, stream };
}

async function run(
  fakes: ReturnType<typeof setup>,
  entry: ExecutionPlanEntry,
  extra: Partial<ContainerExecutionInput> = {},
): Promise<ContainerExecutionResult> {
  const archivePath = path.join(tempDir(), 'checkout.tar');
  fs.writeFileSync(archivePath, 'x');
  return runContainerExecution(
    {
      runtime,
      image,
      runId,
      runAttempt: 1,
      testNonce: 'n0nce',
      clock: steppingClock('2026-10-03T10:15:00.000Z', 1000),
      control: fakes.control,
      stream: fakes.stream,
    },
    { entry, archivePath, checkout, limits, preparedCopyPath: null, ...extra },
  );
}

const sequence = (calls: Recorded[]) => calls.map((c) => [c.kind, ...c.args]);
const names = (calls: Recorded[]) => calls.map((c) => c.args.slice(0, 2).join(' '));

describe('runContainerExecution', () => {
  it('runs the full container lifecycle', async () => {
    const fakes = setup();
    const result = await run(fakes, commandEntry);
    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') return;
    const archivePath = (fakes.calls[2]?.options as StreamProcessOptions).stdin;
    expect(sequence(fakes.calls)).toEqual([
      [
        'control',
        'volume',
        'create',
        '--label',
        'org.patch-steward.managed=true',
        '--label',
        'org.patch-steward.run=local-20261003T101500Z-3f9a1c2e',
        '--label',
        'org.patch-steward.test=n0nce',
      ],
      [
        'control',
        ...runtimeCreateArgs('docker', {
          labels: { runId: String(runId), testNonce: 'n0nce' },
          network: 'none',
          resources: { cpus: 2, memoryMb: 4096, pids: 512, scratchMb: 1024 },
          volume: 'vol123',
          workingDirectory: '.',
          imageReference: image.runReference,
          run: ['sh', 'run.sh'],
        }),
      ],
      ['stream', 'cp', '-a', '-', id + ':/work'],
      ['stream', 'start', '-a', id],
      ['control', 'container', 'inspect', id],
      ['stream', 'cp', id + ':/work/checkout/reports/junit.xml', '-'],
      ['control', 'rm', '-f', id],
      ['control', 'volume', 'rm', 'vol123'],
    ]);
    expect(archivePath.kind).toBe('file');
    expect((fakes.calls[3]?.options as StreamProcessOptions).stdin).toEqual({ kind: 'closed' });
    expect((fakes.calls[3]?.options as StreamProcessOptions).timeoutMs).toBe(1800000);
    for (const c of fakes.calls) {
      expect(c.binary).toBe('docker');
      expect(c.options.env).toEqual({ PATH: 'p' });
    }
    expect(result.execution.record.exit?.code).toBe(1);
    expect(result.execution.record.admissibility).toBe('evidence');
    expect(result.execution.record.environment?.image_digest).toBe(image.digest);
    expect(result.execution.record.result_files[0]?.status).toBe('parsed');
    expect(executionResultEntrySchema.safeParse(result.execution).success).toBe(true);
    expect(result.durationMs).toBe(42);
  });

  it('issues only allowed runtime arguments', async () => {
    const fakes = setup();
    await run(fakes, commandEntry);
    for (const c of fakes.calls) expect(forbiddenRuntimeArguments(c.args)).toEqual([]);
  });

  it('stops a container at the timeout', async () => {
    const fakes = setup({ stream: { start: { stopReason: 'timeout' } } });
    const result = await run(fakes, commandEntry);
    const n = names(fakes.calls);
    expect(n.indexOf('kill ' + id)).toBeGreaterThan(-1);
    expect(n.indexOf('wait ' + id)).toBe(n.indexOf('kill ' + id) + 1);
    expect(n.indexOf('wait ' + id)).toBeLessThan(n.indexOf('container inspect'));
    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') expect(result.execution.record.exit?.timed_out).toBe(true);
  });

  it('stops a container at the output limit', async () => {
    const fakes = setup({ stream: { start: { stopReason: 'output-limit' } } });
    const result = await run(fakes, commandEntry);
    expect(names(fakes.calls)).toContain('kill ' + id);
    expect(names(fakes.calls)).toContain('wait ' + id);
    if (result.kind !== 'completed') throw new Error('expected completed');
    expect(result.execution.record.exit?.output_limited).toBe(true);
  });

  it('records an out-of-memory kill', async () => {
    const fakes = setup({ inspect: { OOMKilled: true, ExitCode: 137 } });
    const result = await run(fakes, commandEntry);
    if (result.kind !== 'completed') throw new Error('expected completed');
    expect(result.execution.record.exit?.oom_killed).toBe(true);
    expect(result.execution.record.exit?.code).toBe(137);
  });

  it('rejects ignored limits on create', async () => {
    const fakes = setup({ control: { create: { stderr: 'WARNING: Your kernel does not support swap limit capabilities\n' } } });
    const result = await run(fakes, commandEntry);
    expect(result).toEqual({ kind: 'environment-failure', code: 'runner.limits-unenforceable', subject: null });
    expect(names(fakes.calls)).toContain('rm -f');
    expect(names(fakes.calls)).toContain('volume rm');
  });

  it('reports a container that never started', async () => {
    const fakes = setup({ inspect: { Status: 'created', Error: 'exec: "sh": executable file not found' } });
    const result = await run(fakes, commandEntry);
    expect(result).toEqual({ kind: 'environment-failure', code: 'runner.start-failed', subject: null });
    expect(names(fakes.calls)).toContain('rm -f');
  });

  it('reports invalid inspect output', async () => {
    const fakes = setup({ control: { 'container inspect': { stdout: 'not json' } } });
    const result = await run(fakes, commandEntry);
    expect(result).toEqual({ kind: 'environment-failure', code: 'runner.inspect-invalid', subject: null });
  });

  it('reports a failed copy into the container', async () => {
    const fakes = setup({ stream: { 'copy-in': { exitCode: 1 } } });
    const result = await run(fakes, commandEntry);
    expect(result).toEqual({ kind: 'environment-failure', code: 'runner.copy-failed', subject: 'checkout' });
    expect(names(fakes.calls)).not.toContain('start -a');
    expect(names(fakes.calls)).toContain('rm -f');
    expect(names(fakes.calls)).toContain('volume rm');
  });

  it('reports a failed volume create without cleanup', async () => {
    const fakes = setup({ control: { 'volume create': { exitCode: 1 } } });
    const result = await run(fakes, commandEntry);
    expect(result).toEqual({ kind: 'environment-failure', code: 'runner.create-failed', subject: 'volume' });
    expect(fakes.calls).toHaveLength(1);
  });

  it('reports a failed cleanup', async () => {
    const fakes = setup({ control: { rm: { exitCode: 1 } } });
    const result = await run(fakes, commandEntry);
    expect(result).toEqual({ kind: 'environment-failure', code: 'runner.cleanup-failed', subject: null });
    expect(names(fakes.calls)).toContain('volume rm');
  });

  it('exports the dependency step copy', async () => {
    const fakes = setup({ inspect: { ExitCode: 0 } });
    const preparedCopyPath = path.join(tempDir(), 'prepared.tar');
    const result = await run(fakes, dependencyEntry, { preparedCopyPath });
    expect(fakes.calls[1]?.args).not.toContain('--network');
    const start = fakes.calls.find((c) => c.args[0] === 'start');
    expect((start?.options as StreamProcessOptions).timeoutMs).toBe(600000);
    expect(fakes.calls.some((c) => c.kind === 'stream' && c.args.join(' ') === `cp ${id}:/work/checkout -`)).toBe(true);
    if (result.kind !== 'completed') throw new Error('expected completed');
    expect(result.preparedCopy?.path).toBe(preparedCopyPath);
    expect(result.dependencyFailure).toBeNull();
  });

  it('reports a failed dependency step', async () => {
    const fakes = setup({ inspect: { ExitCode: 2 } });
    const result = await run(fakes, dependencyEntry, { preparedCopyPath: path.join(tempDir(), 'prepared.tar') });
    if (result.kind !== 'completed') throw new Error('expected completed');
    expect(result.dependencyFailure).toBe('runner.dependency-step-failed');
    expect(result.preparedCopy).toBeNull();
    expect(fakes.calls.some((c) => c.args[1] === id + ':/work/checkout')).toBe(false);
  });

  it('reports a prepared copy above the limit', async () => {
    const fakes = setup({ inspect: { ExitCode: 0 } });
    const result = await run(fakes, dependencyEntry, {
      preparedCopyPath: path.join(tempDir(), 'prepared.tar'),
      limits: { ...limits, preparedCheckoutBytes: 100 },
    });
    if (result.kind !== 'completed') throw new Error('expected completed');
    expect(result.dependencyFailure).toBe('runner.prepared-copy-too-large');
    expect(result.preparedCopy).toBeNull();
  });

  it('builds limits from the policy', () => {
    expect(containerLimitsFromPolicy(DEFAULT_CHECKLIST_POLICY)).toEqual(limits);
  });
});
