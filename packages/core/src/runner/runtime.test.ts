import { describe, expect, it } from 'vitest';
import { err, ok } from '../result.js';
import type { ProcessRunner, RunProcessOptions } from '../process/run-process.js';
import { selectContainerRuntime } from './runtime.js';

const dockerUp = {
  Client: { Version: '29.8.0', Os: 'windows', Arch: 'amd64' },
  Server: { Version: '29.8.0', Os: 'linux', Arch: 'amd64' },
};
const dockerDown = { Client: { Version: '29.8.0' }, Server: null };
const dockerInfoOk = {
  OSType: 'linux',
  MemoryLimit: true,
  SwapLimit: true,
  PidsLimit: true,
  CpuCfsQuota: true,
  Warnings: [] as string[],
};
const podmanRemote = {
  Client: { Version: '5.6.1', OsArch: 'windows/amd64', Os: 'windows' },
  Server: { Version: '5.6.1', OsArch: 'linux/amd64', Os: 'linux' },
};
const podmanLocal = { Client: { Version: '5.6.1', OsArch: 'linux/amd64', Os: 'linux' } };
const podmanInfoOk = { host: { cgroupVersion: 'v2', cgroupControllers: ['cpuset', 'cpu', 'io', 'memory', 'pids'] } };

type Reply = { exitCode: number; body: unknown } | 'unavailable';
interface Call {
  binary: string;
  args: readonly string[];
  options: RunProcessOptions;
}

function fake(replies: Record<string, Reply>) {
  const calls: Call[] = [];
  const control: ProcessRunner = async (binary, args, options) => {
    calls.push({ binary, args, options });
    const reply = replies[`${binary}:${args[0]}`] ?? 'unavailable';
    if (reply === 'unavailable') return err('process.unavailable', 'infrastructure', 'x');
    return ok({ exitCode: reply.exitCode, stdout: Buffer.from(JSON.stringify(reply.body)), stderr: Buffer.alloc(0) });
  };
  return { control, calls };
}

const good = (body: unknown): Reply => ({ exitCode: 0, body });
const run = (f: ReturnType<typeof fake>, choice: 'auto' | 'docker' | 'podman' = 'auto') =>
  selectContainerRuntime({ choice, hostEnv: { PATH: 'p' }, control: f.control, platform: 'linux' });
const code = (r: Awaited<ReturnType<typeof run>>) => (r.ok ? null : r.failure.code);

describe('selectContainerRuntime', () => {
  it('selects docker when its server answers', async () => {
    const f = fake({ 'docker:version': good(dockerUp), 'docker:info': good(dockerInfoOk) });
    const r = await run(f);
    expect(r.ok && r.value).toMatchObject({
      name: 'docker',
      binary: 'docker',
      clientVersion: '29.8.0',
      serverVersion: '29.8.0',
      os: 'linux',
      arch: 'amd64',
    });
    expect(f.calls.map((c) => [c.binary, ...c.args])).toEqual([
      ['docker', 'version', '--format', 'json'],
      ['docker', 'info', '--format', 'json'],
    ]);
  });

  it('falls back to podman in auto mode', async () => {
    const f = fake({
      'docker:version': { exitCode: 1, body: dockerDown },
      'podman:version': good(podmanRemote),
      'podman:info': good(podmanInfoOk),
    });
    const r = await run(f);
    expect(r.ok && r.value).toMatchObject({ name: 'podman', serverVersion: '5.6.1', os: 'linux' });
  });

  it('accepts a local podman engine on linux', async () => {
    const f = fake({ 'podman:version': good(podmanLocal), 'podman:info': good(podmanInfoOk) });
    const r = await run(f, 'podman');
    expect(r.ok && r.value).toMatchObject({ serverVersion: '5.6.1', arch: 'amd64' });
  });

  it('rejects a podman client without a server', async () => {
    const f = fake({
      'podman:version': good({ Client: { Version: '5.6.1', OsArch: 'windows/amd64' } }),
      'podman:info': good(podmanInfoOk),
    });
    expect(code(await run(f, 'podman'))).toBe('runner.runtime-unavailable');
  });

  it('uses only an explicitly chosen runtime', async () => {
    const f = fake({ 'podman:version': good(podmanRemote), 'podman:info': good(podmanInfoOk) });
    expect(code(await run(f, 'docker'))).toBe('runner.runtime-unavailable');
    expect(f.calls.some((c) => c.binary === 'podman')).toBe(false);
  });

  it('rejects a runtime that is not linux', async () => {
    const f = fake({
      'docker:version': good({ ...dockerUp, Server: { ...dockerUp.Server, Os: 'windows' } }),
      'podman:version': good(podmanRemote),
      'podman:info': good(podmanInfoOk),
    });
    expect(code(await run(f))).toBe('runner.runtime-not-linux');
    expect(f.calls.some((c) => c.binary === 'podman')).toBe(false);
  });

  it('rejects docker limit warnings', async () => {
    const f = fake({
      'docker:version': good(dockerUp),
      'docker:info': good({ ...dockerInfoOk, Warnings: ['WARNING: No swap limit support'] }),
    });
    expect(code(await run(f))).toBe('runner.limits-unenforceable');
  });

  it('rejects docker without limit support', async () => {
    const f = fake({ 'docker:version': good(dockerUp), 'docker:info': good({ ...dockerInfoOk, PidsLimit: false }) });
    expect(code(await run(f))).toBe('runner.limits-unenforceable');
  });

  it('rejects podman without cgroup v2', async () => {
    const f = fake({
      'podman:version': good(podmanLocal),
      'podman:info': good({ host: { cgroupVersion: 'v1', cgroupControllers: ['cpu', 'memory', 'pids'] } }),
    });
    expect(code(await run(f, 'podman'))).toBe('runner.limits-unenforceable');
  });

  it('rejects podman without the pids controller', async () => {
    const f = fake({
      'podman:version': good(podmanLocal),
      'podman:info': good({ host: { cgroupVersion: 'v2', cgroupControllers: ['cpu', 'memory'] } }),
    });
    expect(code(await run(f, 'podman'))).toBe('runner.limits-unenforceable');
  });

  it('rejects version strings with spaces', async () => {
    const f = fake({
      'docker:version': good({ ...dockerUp, Server: { ...dockerUp.Server, Version: '29.8.0 beta' } }),
      'docker:info': good(dockerInfoOk),
    });
    expect(code(await run(f))).toBe('runner.runtime-unavailable');
  });

  it('gives the runtime client the allowed environment', async () => {
    const f = fake({ 'docker-test:version': good(dockerUp), 'docker-test:info': good(dockerInfoOk) });
    const r = await selectContainerRuntime({
      choice: 'auto',
      hostEnv: { PATH: 'p', GH_TOKEN: 't', PATCH_STEWARD_CANARY_1F: 'c', DOCKER_HOST: 'd' },
      control: f.control,
      binaries: { docker: 'docker-test' },
      platform: 'linux',
    });
    expect(f.calls.length).toBe(2);
    for (const c of f.calls) {
      expect(c.binary).toBe('docker-test');
      expect(c.options.env).toEqual({ PATH: 'p', DOCKER_HOST: 'd' });
    }
    expect(r.ok && r.value.env).toEqual({ PATH: 'p', DOCKER_HOST: 'd' });
  });
});
