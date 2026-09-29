import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTarArchive } from '../archive/tar.js';
import { steppingClock } from '../clock.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import {
  POLICY_FILE_MAX_BYTES,
  POLICY_LIMITS,
  POLICY_YAML_MAX_DEPTH,
  POLICY_YAML_MAX_NODES,
  RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
  RUNTIME_CONTROL_TIMEOUT_MS,
  RUNTIME_KILL_GRACE_MS,
  findPolicyLimit,
} from '../policy/bounds.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import { validatePolicy } from '../policy/validate.js';
import type { ProcessOutput, ProcessRunner, RunProcessOptions } from '../process/run-process.js';
import type { StreamProcessOptions, StreamProcessRunner, StreamStopReason } from '../process/stream-process.js';
import type { RecordRunId } from '../records/common.js';
import { ok } from '../result.js';
import { parseStrictYaml } from '../strict-yaml.js';
import { runContainerExecution, containerLimitsFromPolicy, type ContainerExecutionLimits } from '../runner/container.js';
import { imageLimitsFromPolicy, prepareRunnerImage } from '../runner/image.js';
import { selectContainerRuntime } from '../runner/runtime.js';
import { RUNTIME_LABEL_RUNNER_TREE, type ResolvedImage, type SelectedRuntime } from '../runner/types.js';
import { createUnsandboxedRunner, unsandboxedLimitsFromPolicy } from '../runner/unsandboxed.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';

const VARIANT_EXECUTION = {
  execution_seconds: 777,
  output_head_bytes: 1000,
  output_tail_bytes: 2000,
  output_stream_bytes: 3000000,
  result_files: 3,
  result_file_bytes: 123456,
  result_test_cases: 77,
  prepared_checkout_bytes: 9999999,
  container_start_seconds: 33,
  dependency_step_seconds: 444,
  image_pull_seconds: 55,
  image_build_seconds: 66,
  image_bytes: 123456789,
};
const VARIANT_RESOURCES = { cpus: 3, memory_mb: 2048, pids: 100, scratch_mb: 256 };

function variantPolicy(): ResolvedPolicy {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
  Object.assign(policy.limits.execution, VARIANT_EXECUTION);
  Object.assign(policy.runner.resources, VARIANT_RESOURCES);
  return policy;
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
const containerId = 'f'.repeat(64);
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

type Call =
  | { kind: 'control'; args: readonly string[]; options: RunProcessOptions }
  | { kind: 'stream'; args: readonly string[]; options: StreamProcessOptions };

function emptyCapture(limits: { headBytes: number; tailBytes: number; streamBytes: number }) {
  const buffer = new OutputCaptureBuffer(limits);
  buffer.push(Buffer.from('hello'));
  return buffer.result();
}

function fakes(calls: Call[], options: { startStop?: StreamStopReason } = {}) {
  const control: ProcessRunner = async (_binary, args, o) => {
    calls.push({ kind: 'control', args, options: o });
    const key = args[0] === 'volume' ? `volume ${args[1]}` : args[0] === 'container' ? 'container inspect' : (args[0] ?? '');
    const defaults: Record<string, string> = {
      'volume create': 'vol123\n',
      create: containerId + '\n',
      'container inspect': JSON.stringify([
        { State: { Status: 'exited', Running: false, ExitCode: 0, OOMKilled: false, Error: '' } },
      ]),
    };
    const out: ProcessOutput = { exitCode: 0, stdout: Buffer.from(defaults[key] ?? ''), stderr: Buffer.from('') };
    return ok(out);
  };
  const stream: StreamProcessRunner = async (_binary, args, o) => {
    calls.push({ kind: 'stream', args, options: o });
    const start = args[0] === 'start';
    let captured = null;
    let stopReason: StreamStopReason | null = null;
    if (start) {
      captured = emptyCapture({ headBytes: 1024, tailBytes: 1024, streamBytes: 4096 });
      stopReason = options.startStop ?? null;
    } else if (o.output.kind === 'sink' && args[1] !== '-a') {
      const archive = args[1]?.endsWith(':/work/checkout')
        ? buildTarArchive([{ path: 'checkout', type: 'directory', mode: 0o755, mtime: 0 }])
        : buildTarArchive([{ path: 'junit.xml', type: 'file', mode: 0o644, mtime: 0, content: Buffer.from(JUNIT) }]);
      o.output.onStdout(archive);
    }
    return ok({ exitCode: 0, signal: null, stopReason, captured, stderr: new Uint8Array(0), durationMs: 42 });
  };
  return { control, stream };
}

const temps: string[] = [];
afterAll(() => {
  for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
function tempDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-inv7-'));
  temps.push(d);
  return d;
}

async function runContainer(
  calls: Call[],
  entry: ExecutionPlanEntry,
  limits: ContainerExecutionLimits,
  options: { startStop?: StreamStopReason; prepared?: boolean } = {},
) {
  const f = fakes(calls, options.startStop === undefined ? {} : { startStop: options.startStop });
  const dir = tempDir();
  const archivePath = path.join(dir, 'checkout.tar');
  fs.writeFileSync(archivePath, 'x');
  return runContainerExecution(
    {
      runtime,
      image,
      runId,
      runAttempt: 1,
      testNonce: null,
      clock: steppingClock('2026-10-03T10:15:00.000Z', 1000),
      control: f.control,
      stream: f.stream,
    },
    { entry, archivePath, checkout, limits, preparedCopyPath: options.prepared ? path.join(dir, 'prepared.tar') : null },
  );
}

const flagValue = (args: readonly string[], flag: string): string | undefined => args[args.indexOf(flag) + 1];

function captureOf(call: Call) {
  if (call.kind !== 'stream' || call.options.output.kind !== 'capture') throw new Error('expected a capture stream call');
  return call.options.output.limits;
}

describe('invariant 7: execution adapters are bounded', () => {
  it('invariant 7: container limits come from the policy', async () => {
    const policy = variantPolicy();
    const limits = containerLimitsFromPolicy(policy);
    expect(limits).toEqual({
      executionSeconds: 777,
      dependencyStepSeconds: 444,
      outputHeadBytes: 1000,
      outputTailBytes: 2000,
      outputStreamBytes: 3000000,
      resultFiles: 3,
      resultFileBytes: 123456,
      resultTestCases: 77,
      preparedCheckoutBytes: 9999999,
      containerStartSeconds: 33,
      cpus: 3,
      memoryMb: 2048,
      pids: 100,
      scratchMb: 256,
    });
    for (const key of Object.keys(VARIANT_EXECUTION)) expect(findPolicyLimit(`limits.execution.${key}`)).toBeDefined();
    for (const key of Object.keys(VARIANT_RESOURCES)) expect(findPolicyLimit(`runner.resources.${key}`)).toBeDefined();

    const calls: Call[] = [];
    const result = await runContainer(calls, commandEntry, limits);
    expect(result.kind).toBe('completed');
    const create = calls.find((c) => c.kind === 'control' && c.args[0] === 'create');
    expect(create).toBeDefined();
    const args = create?.args ?? [];
    expect(flagValue(args, '--pids-limit')).toBe('100');
    expect(flagValue(args, '--memory')).toBe('2048m');
    expect(flagValue(args, '--memory-swap')).toBe('2048m');
    expect(flagValue(args, '--cpus')).toBe('3');
    expect(args.some((a) => a.includes('size=256m'))).toBe(true);

    const attach = calls.find((c) => c.kind === 'stream' && c.args[0] === 'start');
    expect(attach).toBeDefined();
    if (attach === undefined || attach.kind !== 'stream') return;
    expect(attach.options.timeoutMs).toBe(777 * 1000);
    expect(captureOf(attach)).toEqual({ headBytes: 1000, tailBytes: 2000, streamBytes: 3000000 });
  });

  it('invariant 7: every runtime control call is bounded', async () => {
    const policy = variantPolicy();
    const limits = containerLimitsFromPolicy(policy);
    const pullMs = imageLimitsFromPolicy(policy).pullSeconds * 1000;
    const startMs = Math.min(RUNTIME_CONTROL_TIMEOUT_MS, limits.containerStartSeconds * 1000);

    const selectionCalls: Call[] = [];
    const selectionControl: ProcessRunner = async (_binary, args, o) => {
      selectionCalls.push({ kind: 'control', args, options: o });
      const body =
        args[0] === 'version'
          ? { Client: { Version: '29.8.0' }, Server: { Version: '29.8.0', Os: 'linux', Arch: 'amd64' } }
          : { OSType: 'linux', MemoryLimit: true, PidsLimit: true, CpuCfsQuota: true, Warnings: [] };
      return ok({ exitCode: 0, stdout: Buffer.from(JSON.stringify(body)), stderr: Buffer.alloc(0) });
    };
    const selected = await selectContainerRuntime({
      choice: 'docker',
      hostEnv: { PATH: 'p' },
      control: selectionControl,
      platform: 'linux',
    });
    expect(selected.ok).toBe(true);

    const imageCalls: Call[] = [];
    const imageControl: ProcessRunner = async (_binary, args, o) => {
      imageCalls.push({ kind: 'control', args, options: o });
      const stdout =
        args[0] === 'image'
          ? JSON.stringify([{ Id: 'sha256:' + 'e'.repeat(64), RepoDigests: ['busybox@sha256:' + 'a'.repeat(64)], Size: 10 }])
          : '';
      return ok({ exitCode: 0, stdout: Buffer.from(stdout), stderr: Buffer.alloc(0) });
    };
    const prepared = await prepareRunnerImage(
      { runtime, testNonce: null, control: imageControl },
      { source: 'registry', reference: image.reference },
      imageLimitsFromPolicy(policy),
    );
    expect(prepared.result.ok).toBe(true);

    const lifecycle: Call[] = [];
    expect((await runContainer(lifecycle, commandEntry, limits)).kind).toBe('completed');
    const timedOut: Call[] = [];
    expect((await runContainer(timedOut, commandEntry, limits, { startStop: 'timeout' })).kind).toBe('completed');
    const dependency: Call[] = [];
    expect((await runContainer(dependency, dependencyEntry, limits, { prepared: true })).kind).toBe('completed');

    const everyControl = [...selectionCalls, ...imageCalls, ...lifecycle, ...timedOut, ...dependency].filter(
      (c) => c.kind === 'control',
    );
    expect(everyControl.length).toBeGreaterThanOrEqual(15);
    for (const call of everyControl) {
      const key = call.args.slice(0, 2).join(' ');
      let bound = RUNTIME_CONTROL_TIMEOUT_MS;
      if (call.args[0] === 'pull') bound = Math.max(RUNTIME_CONTROL_TIMEOUT_MS, pullMs);
      else if (call.args[0] === 'kill' || call.args[0] === 'wait') bound = RUNTIME_KILL_GRACE_MS;
      else if (key === 'volume create' || call.args[0] === 'create') bound = startMs;
      expect(call.options.timeoutMs, key).toBeGreaterThan(0);
      expect(call.options.timeoutMs, key).toBeLessThanOrEqual(bound);
      expect(call.options.maxOutputBytes, key).toBeLessThanOrEqual(RUNTIME_CONTROL_OUTPUT_MAX_BYTES);
    }
    const seen = new Set(everyControl.map((c) => c.args[0]));
    for (const verb of ['version', 'info', 'pull', 'image', 'volume', 'create', 'container', 'rm', 'kill', 'wait']) {
      expect(seen.has(verb), verb).toBe(true);
    }

    const streamCalls = [...lifecycle, ...timedOut].filter((c) => c.kind === 'stream');
    const dependencyStreams = dependency.filter((c) => c.kind === 'stream');
    for (const call of [...streamCalls, ...dependencyStreams]) {
      if (call.kind !== 'stream') continue;
      const dependencyRun = dependencyStreams.includes(call);
      const key = call.args.slice(0, 2).join(' ');
      expect(Number.isFinite(call.options.timeoutMs)).toBe(true);
      if (call.args[0] === 'start') {
        expect(call.options.timeoutMs).toBe((dependencyRun ? limits.dependencyStepSeconds : limits.executionSeconds) * 1000);
        expect(captureOf(call)).toEqual({
          headBytes: limits.outputHeadBytes,
          tailBytes: limits.outputTailBytes,
          streamBytes: limits.outputStreamBytes,
        });
        continue;
      }
      expect(call.options.output.kind, key).toBe('sink');
      if (call.options.output.kind === 'sink') {
        expect(call.options.output.stderrMaxBytes, key).toBeLessThanOrEqual(RUNTIME_CONTROL_OUTPUT_MAX_BYTES);
      }
      if (call.args[1] === '-a') expect(call.options.timeoutMs).toBeLessThanOrEqual(startMs);
      else if (call.args[1]?.endsWith(':/work/checkout')) expect(call.options.timeoutMs).toBe(limits.dependencyStepSeconds * 1000);
      else expect(call.options.timeoutMs).toBe(RUNTIME_CONTROL_TIMEOUT_MS);
    }
    expect(dependencyStreams.some((c) => c.args[1]?.endsWith(':/work/checkout'))).toBe(true);
    expect(streamCalls.some((c) => c.args[1]?.endsWith('reports/junit.xml'))).toBe(true);
  });

  it('invariant 7: image limits come from the policy', async () => {
    const policy = variantPolicy();
    const limits = imageLimitsFromPolicy(policy);
    expect(limits).toEqual({ pullSeconds: 55, buildSeconds: 66, imageBytes: 123456789, buildOutputStreamBytes: 3000000 });

    const pulls: Call[] = [];
    const pullControl: ProcessRunner = async (_binary, args, o) => {
      pulls.push({ kind: 'control', args, options: o });
      const stdout =
        args[0] === 'image'
          ? JSON.stringify([{ Id: 'sha256:' + 'e'.repeat(64), RepoDigests: ['busybox@sha256:' + 'a'.repeat(64)], Size: 10 }])
          : '';
      return ok({ exitCode: 0, stdout: Buffer.from(stdout), stderr: Buffer.alloc(0) });
    };
    const pulled = await prepareRunnerImage(
      { runtime, testNonce: null, control: pullControl },
      { source: 'registry', reference: image.reference },
      limits,
    );
    expect(pulled.result.ok).toBe(true);
    expect(pulls.find((c) => c.args[0] === 'pull')?.options.timeoutMs).toBe(55 * 1000);

    const tree = 'b'.repeat(40);
    const builds: Call[] = [];
    let inspects = 0;
    const buildControl: ProcessRunner = async (_binary, args, o) => {
      builds.push({ kind: 'control', args, options: o });
      inspects += 1;
      if (inspects === 1) return ok({ exitCode: 1, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) });
      const stdout = JSON.stringify([
        { Id: 'sha256:' + 'e'.repeat(64), Size: 10, Config: { Labels: { [RUNTIME_LABEL_RUNNER_TREE]: tree } } },
      ]);
      return ok({ exitCode: 0, stdout: Buffer.from(stdout), stderr: Buffer.alloc(0) });
    };
    const buildStream: StreamProcessRunner = async (_binary, args, o) => {
      builds.push({ kind: 'stream', args, options: o });
      const captured = emptyCapture({ headBytes: 1024, tailBytes: 1024, streamBytes: 4096 });
      return ok({ exitCode: 0, signal: null, stopReason: null, captured, stderr: new Uint8Array(0), durationMs: 5 });
    };
    const built = await prepareRunnerImage(
      { runtime, testNonce: null, control: buildControl, stream: buildStream },
      { source: 'dockerfile', context: { runnerTreeId: tree, dockerfilePath: 'Dockerfile', archive: new Uint8Array(0) } },
      limits,
    );
    expect(built.result.ok).toBe(true);
    const build = builds.find((c) => c.kind === 'stream');
    expect(build).toBeDefined();
    if (build === undefined || build.kind !== 'stream') return;
    expect(build.options.timeoutMs).toBe(66 * 1000);
    expect(captureOf(build).streamBytes).toBe(3000000);
  });

  describe('unsandboxed runner', () => {
    let base = '';
    let repo = '';
    beforeAll(() => {
      base = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-inv7-repo-'));
      temps.push(base);
      repo = path.join(base, 'repo');
      fs.mkdirSync(repo);
      const config = path.join(base, 'gitconfig');
      fs.writeFileSync(config, '');
      const env: NodeJS.ProcessEnv = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined && !key.toUpperCase().startsWith('GIT_')) env[key] = value;
      }
      Object.assign(env, {
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: config,
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.com',
        GIT_COMMITTER_EMAIL: 'fixture@example.com',
      });
      const git = (...args: string[]): void => {
        execFileSync('git', ['-c', 'core.hooksPath=' + path.join(base, 'hooks'), ...args], { cwd: repo, env, stdio: 'pipe' });
      };
      git('init', '-q');
      fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
      git('add', 'README.md');
      git('commit', '-q', '-m', 'init');
    }, 120000);

    it('invariant 7: unsandboxed runs use the execution limits', async () => {
      const policy = variantPolicy();
      const limits = unsandboxedLimitsFromPolicy(policy);
      expect(limits).toEqual({
        executionSeconds: 777,
        outputHeadBytes: 1000,
        outputTailBytes: 2000,
        outputStreamBytes: 3000000,
        resultFiles: 3,
        resultFileBytes: 123456,
        resultTestCases: 77,
      });

      const hostEnv: Record<string, string | undefined> = { ...process.env };
      for (const key of Object.keys(hostEnv)) if (key.toUpperCase() === 'GITHUB_ACTIONS') delete hostEnv[key];
      const calls: Call[] = [];
      const stream: StreamProcessRunner = async (_binary, args, o) => {
        calls.push({ kind: 'stream', args, options: o });
        const captured = emptyCapture({ headBytes: 1024, tailBytes: 1024, streamBytes: 4096 });
        return ok({ exitCode: 0, signal: null, stopReason: null, captured, stderr: new Uint8Array(0), durationMs: 5 });
      };
      const created = await createUnsandboxedRunner({
        checkoutRoot: repo,
        processCwd: repo,
        previewWorktrees: [],
        hostEnv,
        credentials: [],
        runId,
        runAttempt: 1,
        clock: steppingClock('2026-10-03T10:15:00.000Z', 1000),
        stream,
      });
      if (!created.ok) throw new Error('runner refused');
      const entry = { ...commandEntry, run: [process.execPath, '-e', '0'], result_files: [] } as ExecutionPlanEntry;
      const result = await created.value.run(entry, limits);
      expect(result.kind).toBe('completed');
      expect(calls).toHaveLength(1);
      const call = calls[0];
      if (call === undefined || call.kind !== 'stream') throw new Error('expected a stream call');
      expect(call.options.timeoutMs).toBe(777 * 1000);
      expect(captureOf(call)).toEqual({ headBytes: 1000, tailBytes: 2000, streamBytes: 3000000 });
      expect(call.options.killTree).toBe(true);
    });
  });

  it('invariant 7: every policy limit stays within its hard bound', () => {
    const bytes = fs.readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));
    const parsed = parseStrictYaml(bytes, {
      maxBytes: POLICY_FILE_MAX_BYTES,
      maxDepth: POLICY_YAML_MAX_DEPTH,
      maxNodes: POLICY_YAML_MAX_NODES,
    });
    if (!parsed.ok) throw new Error('template failed to parse');
    const template = parsed.value as Record<string, unknown>;
    const rows = POLICY_LIMITS.filter((r) => r.path.startsWith('limits.execution.') || r.path.startsWith('runner.resources.'));
    expect(rows.length).toBeGreaterThanOrEqual(20);
    for (const row of rows) {
      expect(row.templateValue, row.path).toBeGreaterThanOrEqual(row.min);
      expect(row.templateValue, row.path).toBeLessThanOrEqual(row.max);

      const raw = structuredClone(template);
      const segments = row.path.split('.');
      let node = raw;
      for (const segment of segments.slice(0, -1)) node = node[segment] as Record<string, unknown>;
      node[segments[segments.length - 1] ?? ''] = row.max + 1;
      const result = validatePolicy(raw);
      expect(result.ok, row.path).toBe(false);
      if (!result.ok) {
        expect(result.failure.details).toContainEqual(
          expect.objectContaining({ code: 'policy.limit-out-of-bounds', path: row.path }),
        );
      }
    }
  });
});
