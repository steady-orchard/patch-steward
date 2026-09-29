import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { buildTarArchive } from '../archive/tar.js';
import { steppingClock } from '../clock.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import { findPolicyLimit } from '../policy/bounds.js';
import type { ProcessOutput, ProcessRunner } from '../process/run-process.js';
import type { StreamProcessRunner } from '../process/stream-process.js';
import type { RecordRunId } from '../records/common.js';
import { err, ok } from '../result.js';
import {
  RUNTIME_CLI_ENVIRONMENT_NAMES,
  forbiddenRuntimeArguments,
  runtimeCliEnvironment,
  runtimeCreateArgs,
  type ContainerResources,
} from '../runner/argv.js';
import { runContainerExecution, type ContainerExecutionLimits } from '../runner/container.js';
import { copyOutResultFile, exportPreparedCopy } from '../runner/copy-out.js';
import { prepareRunnerImage } from '../runner/image.js';
import { selectContainerRuntime } from '../runner/runtime.js';
import type { ContainerRuntimeName, ResolvedImage, SelectedRuntime } from '../runner/types.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

const runId = 'local-20261003T101500Z-3f9a1c2e' as RecordRunId;
const containerId = 'f'.repeat(64);
const JUNIT = '<testsuites><testsuite name="s"><testcase classname="c" name="t"/></testsuite></testsuites>';
const image: ResolvedImage = {
  source: 'registry',
  reference: 'docker.io/library/busybox:1.37.0',
  digest: 'sha256:' + 'a'.repeat(64),
  id: 'sha256:' + 'b'.repeat(64),
  runnerTreeId: null,
  cached: false,
  runReference: 'docker.io/library/busybox@sha256:' + 'a'.repeat(64),
};

function expectedCreate(
  runtime: ContainerRuntimeName,
  o: { network: 'none' | 'egress'; workdir: string; nonce: string | null },
): string[] {
  return [
    'create',
    '--label',
    'org.patch-steward.managed=true',
    '--label',
    'org.patch-steward.run=' + runId,
    ...(o.nonce === null ? [] : ['--label', 'org.patch-steward.test=' + o.nonce]),
    '--platform',
    'linux/amd64',
    '--pull',
    'never',
    '--user',
    '65532:65532',
    '--read-only',
    ...(runtime === 'podman' ? ['--read-only-tmpfs=false'] : []),
    ...(o.network === 'none' ? ['--network', 'none'] : []),
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    '512',
    '--memory',
    '4096m',
    '--memory-swap',
    '4096m',
    '--cpus',
    '2',
    '--ulimit',
    'core=0:0',
    '--ipc',
    'private',
    '--cgroupns',
    'private',
    '--hostname',
    'patch-steward',
    '--log-driver',
    'none',
    '--tmpfs',
    '/tmp:rw,exec,nosuid,nodev,size=1024m,mode=1777',
    '--mount',
    `type=volume,src=vol123,dst=/work${runtime === 'podman' ? '' : ',volume-nocopy'}`,
    '--workdir',
    o.workdir,
    '--env',
    'HOME=/tmp',
    '--env',
    'TMPDIR=/tmp',
    '--env',
    'CI=true',
    '--entrypoint',
    'sh',
    image.runReference,
    'run.sh',
  ];
}

function limitValues(p: string): number[] {
  const row = findPolicyLimit(p);
  if (row === undefined) throw new Error(`missing policy limit ${p}`);
  return [row.min, Math.floor((row.min + row.max) / 2), row.max];
}

function tarOf(name: string, content: string): Uint8Array {
  return buildTarArchive([{ path: name, type: 'file', mode: 0o644, mtime: 0, content: Buffer.from(content) }]);
}

interface Recorder {
  readonly argv: string[][];
  readonly control: ProcessRunner;
  readonly stream: StreamProcessRunner;
}

function recorder(): Recorder {
  const argv: string[][] = [];
  const control: ProcessRunner = async (_binary, args) => {
    argv.push([...args]);
    const defaults: Record<string, string> = {
      volume: 'vol123\n',
      create: containerId + '\n',
      image: JSON.stringify([
        {
          Id: 'sha256:' + 'b'.repeat(64),
          RepoDigests: ['docker.io/library/busybox@sha256:' + 'a'.repeat(64)],
          Size: 10,
          Config: { Labels: {} },
        },
      ]),
      container: JSON.stringify([{ State: { Status: 'exited', Running: false, ExitCode: 0, OOMKilled: false, Error: '' } }]),
    };
    const out: ProcessOutput = { exitCode: 0, stdout: Buffer.from(defaults[args[0] ?? ''] ?? ''), stderr: Buffer.alloc(0) };
    return ok(out);
  };
  const stream: StreamProcessRunner = async (_binary, args, options) => {
    argv.push([...args]);
    const isStart = args[0] === 'start';
    let captured = null;
    if (isStart) {
      const buffer = new OutputCaptureBuffer({ headBytes: 1024, tailBytes: 1024, streamBytes: 4096 });
      buffer.push(Buffer.from('hello'));
      captured = buffer.result();
    } else if (options.output.kind === 'sink' && args[1] !== '-a') {
      const archive = (args[1] ?? '').endsWith(':/work/checkout')
        ? buildTarArchive([{ path: 'checkout', type: 'directory', mode: 0o755, mtime: 0 }])
        : tarOf('junit.xml', JUNIT);
      options.output.onStdout(archive);
    }
    return ok({ exitCode: 0, signal: null, stopReason: null, captured, stderr: new Uint8Array(0), durationMs: 5 });
  };
  return { argv, control, stream };
}

const temps: string[] = [];
afterAll(() => {
  for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});
function tempDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-inv3-'));
  temps.push(d);
  return d;
}

function isHostPath(token: string): boolean {
  if (/^[A-Za-z]:[\\/]/.test(token) || token.startsWith('\\\\')) return true;
  return token.startsWith('/') && !token.startsWith('/tmp:') && !token.startsWith('/work/checkout');
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) out.push(full);
    }
  };
  const packages = path.join(repoRoot, 'packages');
  for (const p of fs.readdirSync(packages, { withFileTypes: true })) {
    const src = path.join(packages, p.name, 'src');
    if (p.isDirectory() && fs.existsSync(src)) walk(src);
  }
  return out;
}
const rel = (file: string): string => path.relative(repoRoot, file).split(path.sep).join('/');

describe('invariant 3: sandboxed execution', () => {
  it('invariant 3: create arguments match the profile', () => {
    for (const runtime of ['docker', 'podman'] as const) {
      for (const network of ['none', 'egress'] as const) {
        for (const wd of ['.', 'packages/app']) {
          for (const nonce of [null, 'n0nce']) {
            const actual = runtimeCreateArgs(runtime, {
              labels: { runId: String(runId), testNonce: nonce },
              network,
              resources: { cpus: 2, memoryMb: 4096, pids: 512, scratchMb: 1024 },
              volume: 'vol123',
              workingDirectory: wd,
              imageReference: image.runReference,
              run: ['sh', 'run.sh'],
            });
            const workdir = wd === '.' ? '/work/checkout' : '/work/checkout/' + wd;
            expect(actual).toEqual(expectedCreate(runtime, { network, workdir, nonce }));
          }
        }
      }
    }
  });

  it('invariant 3: no argument vector carries a forbidden token', async () => {
    const cpus = limitValues('runner.resources.cpus');
    const memory = limitValues('runner.resources.memory_mb');
    const pids = limitValues('runner.resources.pids');
    const scratch = limitValues('runner.resources.scratch_mb');
    const combos: ContainerResources[] = [];
    for (const c of cpus)
      for (const m of memory)
        for (const p of pids) for (const s of scratch) combos.push({ cpus: c, memoryMb: m, pids: p, scratchMb: s });
    expect(combos.length).toBeGreaterThanOrEqual(50);

    const workdirs = ['.', 'a', 'packages/app'];
    const entrypoints = ['sh', 'make', 'node', '/usr/bin/env'];
    const hostile = ['--privileged', '-v', '/var/run/docker.sock', 'C:\\Windows', '$(id)', '--network=host'];
    const baseLimits = {
      executionSeconds: 1800,
      dependencyStepSeconds: 600,
      outputHeadBytes: 1024,
      outputTailBytes: 1024,
      outputStreamBytes: 4096,
      resultFiles: 5,
      resultFileBytes: 5242880,
      resultTestCases: 1000,
      preparedCheckoutBytes: 2147483648,
      containerStartSeconds: 120,
    };
    const imageLimits = { pullSeconds: 600, buildSeconds: 1800, imageBytes: 4294967296, buildOutputStreamBytes: 4096 };
    const checkout = {
      commit: 'c'.repeat(40),
      tree: 'd'.repeat(40),
      archive_sha256: 'sha256:' + '1'.repeat(64),
      files: 1,
      bytes: 10,
      overlays: [],
      skipped_submodules: [],
    };
    let creates = 0;
    let probes = 0;
    let index = 0;
    for (const runtimeName of ['docker', 'podman'] as const) {
      const runtime: SelectedRuntime = {
        name: runtimeName,
        binary: runtimeName,
        env: { PATH: 'p' },
        clientVersion: '29.8.0',
        serverVersion: '29.8.0',
        os: 'linux',
        arch: 'amd64',
      };
      for (const resources of combos) {
        index += 1;
        const rec = recorder();
        const limits: ContainerExecutionLimits = { ...baseLimits, ...resources };
        const run = [entrypoints[index % entrypoints.length] as string, ...hostile.slice(index % hostile.length), ...hostile];
        const entry = {
          id: 'head-test',
          kind: 'command',
          command_id: 'test',
          run,
          working_directory: workdirs[index % workdirs.length] as string,
          commit_role: 'head',
          commit: 'c'.repeat(40),
          overlay: 'none',
          expected: 'exit-zero',
          network: index % 2 === 0 ? 'none' : 'egress',
          result_files: [{ path: 'reports/junit.xml', format: 'junit-xml' }],
        } as ExecutionPlanEntry;
        const dependency = {
          ...entry,
          id: 'head-dependency-step',
          kind: 'dependency-step',
          command_id: null,
          network: 'egress',
          result_files: [],
        } as ExecutionPlanEntry;
        const archivePath = path.join(tempDir(), 'checkout.tar');
        fs.writeFileSync(archivePath, 'x');
        const ctx = {
          runtime,
          image,
          runId,
          runAttempt: 1,
          testNonce: 'n0nce',
          clock: steppingClock('2026-10-03T10:15:00.000Z', 1000),
          control: rec.control,
          stream: rec.stream,
        };
        await runContainerExecution(ctx, { entry, archivePath, checkout, limits, preparedCopyPath: null });
        await runContainerExecution(ctx, {
          entry: dependency,
          archivePath,
          checkout,
          limits,
          preparedCopyPath: path.join(tempDir(), 'prepared.tar'),
        });

        const copyCtx = { runtime, timeoutMs: 1000, stream: rec.stream };
        await copyOutResultFile(copyCtx, containerId, 'reports/junit.xml', 1024);
        await copyOutResultFile(copyCtx, containerId, '.', 1024);
        await exportPreparedCopy(copyCtx, containerId, path.join(tempDir(), 'copy.tar'), 1 << 20);

        const prep = { runtime, testNonce: 'n0nce', runId: String(runId), control: rec.control, stream: rec.stream };
        await prepareRunnerImage(prep, { source: 'registry', reference: image.reference }, imageLimits);
        await prepareRunnerImage(
          prep,
          {
            source: 'dockerfile',
            context: { runnerTreeId: 'b'.repeat(40), dockerfilePath: 'Dockerfile', archive: Uint8Array.from([1, 2, 3]) },
          },
          imageLimits,
        );
        await selectContainerRuntime({ choice: 'docker', hostEnv: { PATH: 'p' }, control: rec.control, platform: 'linux' });

        expect(rec.argv.length).toBeGreaterThan(10);
        for (const args of rec.argv) {
          expect(forbiddenRuntimeArguments(args)).toEqual([]);
          if (args[0] !== 'create') continue;
          creates += 1;
          if (!args.includes('--mount') && args.includes('/bin/true')) probes += 1;
          const imageAt = args.indexOf('--entrypoint') + 2;
          expect(imageAt).toBeGreaterThan(2);
          expect(args[imageAt]).toBe(image.runReference);
          const before = args.slice(0, imageAt).filter((_, i) => i !== imageAt - 1);
          expect(before.filter(isHostPath)).toEqual([]);
        }
      }
    }
    expect(creates).toBeGreaterThanOrEqual(100);
    expect(probes).toBeGreaterThan(0);

    const positive = runtimeCreateArgs('docker', {
      labels: { runId: String(runId), testNonce: null },
      network: 'none',
      resources: { cpus: 2, memoryMb: 4096, pids: 512, scratchMb: 1024 },
      volume: 'vol123',
      workingDirectory: '.',
      imageReference: image.runReference,
      run: ['sh', 'run.sh'],
    });
    positive.splice(1, 0, '--privileged');
    expect(forbiddenRuntimeArguments(positive)).not.toEqual([]);
  });

  it('invariant 3: the runtime client gets an allowlisted environment', async () => {
    const canaryName = 'PATCH_STEWARD_CANARY_' + randomBytes(6).toString('hex');
    const canaryValue = 'canary-' + randomBytes(12).toString('hex');
    const allowed: Record<string, string> = {};
    for (const name of RUNTIME_CLI_ENVIRONMENT_NAMES) allowed[name] = 'value-of-' + name;
    const env: Record<string, string> = {
      ...allowed,
      GH_TOKEN: 'gh-secret',
      GITHUB_TOKEN: 'github-secret',
      STEWARD_LLM_API_KEY: 'llm-secret',
      AWS_SECRET_ACCESS_KEY: 'aws-secret',
      [canaryName]: canaryValue,
    };
    const names = [...RUNTIME_CLI_ENVIRONMENT_NAMES].sort();
    expect(Object.keys(runtimeCliEnvironment(env, 'linux')).sort()).toEqual(names);
    expect(runtimeCliEnvironment(env, 'linux')).toEqual(allowed);

    const lower: Record<string, string> = { ...env };
    for (const name of RUNTIME_CLI_ENVIRONMENT_NAMES) {
      delete lower[name];
      lower[name.toLowerCase()] = allowed[name] as string;
    }
    expect(Object.keys(runtimeCliEnvironment(lower, 'win32')).sort()).toEqual(names);
    expect(runtimeCliEnvironment(lower, 'win32')).toEqual(allowed);

    const seen: { args: readonly string[]; env: Readonly<Record<string, string>> }[] = [];
    const control: ProcessRunner = async (binary, args, options) => {
      seen.push({ args: [binary, ...args], env: options.env });
      if (args[0] === 'version') {
        const body = {
          Client: { Version: '29.8.0', Os: 'linux', Arch: 'amd64' },
          Server: { Version: '29.8.0', Os: 'linux', Arch: 'amd64' },
        };
        return ok({ exitCode: 0, stdout: Buffer.from(JSON.stringify(body)), stderr: Buffer.alloc(0) });
      }
      if (args[0] === 'info') {
        const body = { OSType: 'linux', MemoryLimit: true, PidsLimit: true, CpuCfsQuota: true, Warnings: [] };
        return ok({ exitCode: 0, stdout: Buffer.from(JSON.stringify(body)), stderr: Buffer.alloc(0) });
      }
      return err('process.unavailable', 'infrastructure', 'x');
    };
    const selected = await selectContainerRuntime({ choice: 'docker', hostEnv: env, control, platform: 'linux' });
    expect(selected.ok).toBe(true);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    for (const call of seen) expect(call.env).toEqual(allowed);
    expect(JSON.stringify(seen)).not.toContain(canaryValue);
    expect(JSON.stringify(seen)).not.toContain(canaryName);
    expect(selected.ok && selected.value.env).toEqual(allowed);
  });

  it('invariant 3: only the preflight module constructs the unsandboxed runner', () => {
    const allowedFiles = new Set([
      'packages/core/src/runner/unsandboxed.ts',
      'packages/core/src/index.ts',
      'packages/cli/src/preflight-run.ts',
    ]);
    const files = sourceFiles();
    expect(files.map(rel)).toContain('packages/core/src/index.ts');
    const offenders: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (/runner\/unsandboxed\.js['"]/.test(text) || /createUnsandboxedRunner/.test(text)) {
        if (!allowedFiles.has(rel(file))) offenders.push(rel(file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('invariant 3: only process, git, materialize, and runner spawn processes', () => {
    const allowedDirs = [
      'packages/core/src/process/',
      'packages/core/src/git/',
      'packages/core/src/materialize/',
      'packages/core/src/runner/',
    ];
    const importPattern =
      /(?:from|import)\s*\(?\s*['"](?:node:)?child_process['"]|require\(\s*['"](?:node:)?child_process['"]\s*\)/;
    const files = sourceFiles();
    const importing = files.filter((f) => importPattern.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(importing).toContain('packages/core/src/process/stream-process.ts');
    expect(importing.filter((f) => !allowedDirs.some((d) => f.startsWith(d)))).toEqual([]);
  });
});
