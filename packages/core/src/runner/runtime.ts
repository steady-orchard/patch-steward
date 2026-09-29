import os from 'node:os';
import { z } from 'zod';
import { RUNTIME_CONTROL_OUTPUT_MAX_BYTES, RUNTIME_CONTROL_TIMEOUT_MS } from '../policy/bounds.js';
import { runProcess } from '../process/run-process.js';
import type { ProcessRunner } from '../process/run-process.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import { runtimeCliEnvironment, runtimeInfoArgs, runtimeVersionArgs } from './argv.js';
import type { ContainerRuntimeChoice, ContainerRuntimeName, SelectedRuntime } from './types.js';

const versionText = z.string().regex(/^[!-~]{1,64}$/);
const osArchText = z.string().regex(/^[a-z0-9_]+[/][a-z0-9_]+$/);

export const dockerVersionSchema = z.object({
  Client: z.object({ Version: versionText }),
  Server: z
    .object({ Version: versionText, Os: z.string().min(1).max(64), Arch: z.string().min(1).max(64) })
    .nullable()
    .optional(),
});

export const podmanVersionSchema = z.object({
  Client: z.object({ Version: versionText, OsArch: osArchText, Os: z.string().min(1).max(64).optional() }),
  Server: z
    .object({ Version: versionText, OsArch: osArchText, Os: z.string().min(1).max(64).optional() })
    .nullable()
    .optional(),
});

export const dockerInfoSchema = z.object({
  OSType: z.string(),
  MemoryLimit: z.boolean(),
  PidsLimit: z.boolean(),
  CpuCfsQuota: z.boolean(),
  Warnings: z.array(z.string()).nullable().optional(),
});

export const podmanInfoSchema = z.object({
  host: z.object({ cgroupVersion: z.string(), cgroupControllers: z.array(z.string()).nullable().optional() }),
});

export type RuntimeFailureCode = 'runner.runtime-unavailable' | 'runner.runtime-not-linux' | 'runner.limits-unenforceable';

export interface SelectRuntimeInput {
  readonly choice: ContainerRuntimeChoice;
  readonly hostEnv: Readonly<Record<string, string | undefined>>;
  readonly control?: ProcessRunner;
  readonly binaries?: Partial<Record<ContainerRuntimeName, string>>;
  readonly platform?: NodeJS.Platform;
}

interface Engine {
  readonly clientVersion: string;
  readonly version: string;
  readonly os: string;
  readonly arch: string;
}

function fail(code: RuntimeFailureCode, name: string, message: string) {
  return err(code, 'environment-unavailable', message, [{ code, path: name, message, line: null, column: null }]);
}

function parseJson(stdout: Buffer): unknown {
  try {
    return JSON.parse(stdout.toString('utf8'));
  } catch {
    return undefined;
  }
}

function splitOsArch(value: string): [string, string] {
  const [o = '', a = ''] = value.split('/');
  return [o, a];
}

function engineFrom(name: ContainerRuntimeName, json: unknown): Engine | null {
  if (name === 'docker') {
    const parsed = dockerVersionSchema.safeParse(json);
    if (!parsed.success || !parsed.data.Server) return null;
    const s = parsed.data.Server;
    return { clientVersion: parsed.data.Client.Version, version: s.Version, os: s.Os, arch: s.Arch };
  }
  const parsed = podmanVersionSchema.safeParse(json);
  if (!parsed.success) return null;
  const { Client, Server } = parsed.data;
  if (Server) {
    const [o, a] = splitOsArch(Server.OsArch);
    return { clientVersion: Client.Version, version: Server.Version, os: Server.Os ?? o, arch: a };
  }
  const [o, a] = splitOsArch(Client.OsArch);
  if ((Client.Os ?? o) !== 'linux') return null;
  return { clientVersion: Client.Version, version: Client.Version, os: 'linux', arch: a };
}

export async function selectContainerRuntime(input: SelectRuntimeInput): Promise<Result<SelectedRuntime, RuntimeFailureCode>> {
  const control = input.control ?? runProcess;
  const env = runtimeCliEnvironment(input.hostEnv, input.platform ?? process.platform);
  const candidates: ContainerRuntimeName[] = input.choice === 'auto' ? ['docker', 'podman'] : [input.choice];
  const call = (binary: string, args: readonly string[]) =>
    control(binary, args, {
      cwd: os.tmpdir(),
      env,
      timeoutMs: RUNTIME_CONTROL_TIMEOUT_MS,
      maxOutputBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
    });

  let selected: { name: ContainerRuntimeName; binary: string; engine: Engine } | null = null;
  for (const name of candidates) {
    const binary = input.binaries?.[name] ?? name;
    const res = await call(binary, runtimeVersionArgs());
    if (!res.ok) continue;
    const engine = engineFrom(name, parseJson(res.value.stdout));
    if (engine) {
      selected = { name, binary, engine };
      break;
    }
  }
  if (!selected) return fail('runner.runtime-unavailable', '', 'no container engine answered (no-engine)');
  const { name, binary, engine } = selected;
  if (engine.os !== 'linux') return fail('runner.runtime-not-linux', name, `engine os is ${engine.os}, linux is required`);

  const info = await call(binary, runtimeInfoArgs());
  if (!info.ok || info.value.exitCode !== 0) return fail('runner.runtime-unavailable', name, 'runtime info failed (info)');
  const infoJson = parseJson(info.value.stdout);
  if (name === 'docker') {
    const parsed = dockerInfoSchema.safeParse(infoJson);
    if (!parsed.success) return fail('runner.runtime-unavailable', name, 'runtime info invalid (info)');
    const d = parsed.data;
    if (d.OSType !== 'linux') return fail('runner.runtime-not-linux', name, `engine OSType is ${d.OSType}`);
    if (!d.MemoryLimit || !d.PidsLimit || !d.CpuCfsQuota) {
      return fail('runner.limits-unenforceable', name, 'engine does not enforce memory, pids, or cpu limits');
    }
    if ((d.Warnings ?? []).some((w) => /memory|swap|cpu|pids/i.test(w))) {
      return fail('runner.limits-unenforceable', name, 'engine reports limit warnings');
    }
  } else {
    const parsed = podmanInfoSchema.safeParse(infoJson);
    if (!parsed.success) return fail('runner.runtime-unavailable', name, 'runtime info invalid (info)');
    const { cgroupVersion, cgroupControllers } = parsed.data.host;
    const controllers = cgroupControllers ?? [];
    if (cgroupVersion !== 'v2' || !['cpu', 'memory', 'pids'].every((c) => controllers.includes(c))) {
      return fail('runner.limits-unenforceable', name, 'cgroup v2 with cpu, memory, and pids controllers is required');
    }
  }
  return ok({
    name,
    binary,
    env,
    clientVersion: engine.clientVersion,
    serverVersion: engine.version,
    os: engine.os,
    arch: engine.arch,
  });
}
