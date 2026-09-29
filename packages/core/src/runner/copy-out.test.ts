import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTarArchive } from '../archive/tar.js';
import type { StreamProcessOptions, StreamProcessRunner, StreamStopReason } from '../process/stream-process.js';
import { err, ok } from '../result.js';
import { containerResultPath, copyOutResultFile, exportPreparedCopy } from './copy-out.js';
import type { SelectedRuntime } from './types.js';

const runtime: SelectedRuntime = {
  name: 'docker',
  binary: 'docker',
  env: { PATH: 'p' },
  clientVersion: '29.8.0',
  serverVersion: '29.8.0',
  os: 'linux',
  arch: 'amd64',
};
const id = 'f'.repeat(64);

interface Call {
  binary: string;
  args: readonly string[];
  options: StreamProcessOptions;
  stopped: boolean;
}

function fake(spec: {
  chunks?: Uint8Array;
  exitCode?: number;
  stderrText?: string;
  stopReason?: StreamStopReason | null;
  fail?: boolean;
}): { runner: StreamProcessRunner; calls: Call[] } {
  const calls: Call[] = [];
  const runner: StreamProcessRunner = async (binary, args, options) => {
    const call: Call = { binary, args, options, stopped: false };
    calls.push(call);
    if (spec.fail) return err('process.unavailable', 'infrastructure', 'x');
    const data = spec.chunks ?? new Uint8Array(0);
    if (options.output.kind === 'sink') {
      for (let i = 0; i < data.length; i += 100) {
        if (options.output.onStdout(data.subarray(i, i + 100)) === 'stop') {
          call.stopped = true;
          break;
        }
      }
    }
    return ok({
      exitCode: spec.exitCode ?? 0,
      signal: null,
      stopReason: call.stopped ? 'sink-stop' : (spec.stopReason ?? null),
      captured: null,
      stderr: Buffer.from(spec.stderrText ?? ''),
      durationMs: 1,
    });
  };
  return { runner, calls };
}

function file(p: string, content: Uint8Array) {
  return { path: p, type: 'file' as const, mode: 0o644, mtime: 0, content };
}

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});
function tempDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-copy-'));
  temps.push(d);
  return d;
}

describe('copy-out', () => {
  it('copies a declared result file out of the container', async () => {
    const content = new Uint8Array(300).fill(7);
    const { runner, calls } = fake({ chunks: buildTarArchive([file('junit.xml', content)]) });
    const result = await copyOutResultFile({ runtime, timeoutMs: 1000, stream: runner }, id, 'reports/junit.xml', 1000);
    expect(result).toEqual({ ok: true, value: { kind: 'file', bytes: content } });
    expect(calls[0]?.args).toEqual(['cp', id + ':/work/checkout/reports/junit.xml', '-']);
    expect(calls[0]?.binary).toBe('docker');
    expect(calls[0]?.options.env).toEqual({ PATH: 'p' });
    expect(calls[0]?.options.stdin).toEqual({ kind: 'closed' });
  });

  it('reports a symlink as not regular', async () => {
    const { runner } = fake({
      chunks: buildTarArchive([{ path: 'junit.xml', type: 'symlink', mode: 0o777, mtime: 0, linkTarget: '/etc/passwd' }]),
    });
    const result = await copyOutResultFile({ runtime, timeoutMs: 1000, stream: runner }, id, 'junit.xml', 1000);
    expect(result).toEqual({ ok: true, value: { kind: 'not-regular' } });
  });

  it('reports an oversize file as too large', async () => {
    const { runner, calls } = fake({ chunks: buildTarArchive([file('junit.xml', new Uint8Array(5000))]) });
    const result = await copyOutResultFile({ runtime, timeoutMs: 1000, stream: runner }, id, 'junit.xml', 1000);
    expect(result).toEqual({ ok: true, value: { kind: 'too-large', declaredBytes: 5000 } });
    expect(calls[0]?.stopped).toBe(true);
  });

  it('reports a missing file from the runtime message', async () => {
    for (const stderrText of [
      'Error response from daemon: Could not find the file /work/checkout/x in container abc',
      'Error: "/work/checkout/x" could not be found on container abc: no such file or directory',
    ]) {
      const { runner } = fake({ exitCode: 1, stderrText });
      const result = await copyOutResultFile({ runtime, timeoutMs: 1000, stream: runner }, id, 'x', 1000);
      expect(result).toEqual({ ok: true, value: { kind: 'missing' } });
    }
  });

  it('fails closed on other copy errors', async () => {
    const archive = buildTarArchive([file('junit.xml', new Uint8Array(300))]);
    const cases = [
      fake({ exitCode: 1, stderrText: 'connection refused' }),
      fake({ chunks: archive.subarray(0, 700) }),
      fake({ chunks: archive.subarray(0, 200), stopReason: 'timeout' }),
      fake({ fail: true }),
    ];
    for (const { runner } of cases) {
      const result = await copyOutResultFile({ runtime, timeoutMs: 1000, stream: runner }, id, 'junit.xml', 1000);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('runner.copy-failed');
    }
  });

  it('maps result paths into the checkout', () => {
    expect(containerResultPath('.')).toBe('/work/checkout');
    expect(containerResultPath('a/b')).toBe('/work/checkout/a/b');
  });

  it('exports the prepared copy to a host file', async () => {
    const dir = tempDir();
    const out = path.join(dir, 'prepared.tar');
    const archive = buildTarArchive([
      { path: 'checkout', type: 'directory', mode: 0o755, mtime: 0 },
      file('checkout/node_modules/x.js', Buffer.from('x')),
    ]);
    const { runner, calls } = fake({ chunks: archive });
    const result = await exportPreparedCopy({ runtime, timeoutMs: 1000, stream: runner }, id, out, 1048576);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toBe(out);
      expect(result.value.bytes).toBe(archive.length);
      expect(result.value.sha256).toBe('sha256:' + createHash('sha256').update(archive).digest('hex'));
    }
    expect(new Uint8Array(fs.readFileSync(out))).toEqual(archive);
    expect(calls[0]?.args).toEqual(['cp', id + ':/work/checkout', '-']);
  });

  it('rejects a prepared copy above the limit', async () => {
    const dir = tempDir();
    const out = path.join(dir, 'prepared.tar');
    const archive = buildTarArchive([file('checkout/big.bin', new Uint8Array(4000))]);
    const { runner } = fake({ chunks: archive });
    const result = await exportPreparedCopy({ runtime, timeoutMs: 1000, stream: runner }, id, out, 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('runner.prepared-copy-too-large');
    expect(fs.existsSync(out)).toBe(false);
  });

  it('rejects a prepared copy outside the checkout', async () => {
    const dir = tempDir();
    const out = path.join(dir, 'prepared.tar');
    const { runner } = fake({ chunks: buildTarArchive([file('other/x', Buffer.from('x'))]) });
    const result = await exportPreparedCopy({ runtime, timeoutMs: 1000, stream: runner }, id, out, 1048576);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('runner.copy-failed');
    expect(fs.existsSync(out)).toBe(false);
  });

  it('never leaves a partial prepared copy', async () => {
    const dir = tempDir();
    const out = path.join(dir, 'prepared.tar');
    const { runner } = fake({ chunks: buildTarArchive([file('checkout/x', Buffer.from('x'))]), exitCode: 1 });
    const result = await exportPreparedCopy({ runtime, timeoutMs: 1000, stream: runner }, id, out, 1048576);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('runner.copy-failed');
    expect(fs.existsSync(out)).toBe(false);
  });
});

describe('copy-out under a podman client that cannot copy to standard output', () => {
  const podman: SelectedRuntime = { ...runtime, name: 'podman', binary: 'podman' };
  const volume = 'a1b2c3d4e5f6';
  const unsupported = {
    exitCode: 125,
    stderrText: 'Error: "/dev/stdout" could not be found on the host: no such file or directory',
  };
  const notFound = {
    exitCode: 125,
    stderrText: `Error: "/work/checkout/reports/link.xml" could not be found on container ${id}: no such file or directory`,
  };
  const dirEntry = (p: string) => ({ path: p, type: 'directory' as const, mode: 0o755, mtime: 0 });

  function sequence(...specs: Parameters<typeof fake>[0][]): { runner: StreamProcessRunner; calls: (readonly string[])[] } {
    const fakes = specs.map((spec) => fake(spec));
    const calls: (readonly string[])[] = [];
    const runner: StreamProcessRunner = (binary, args, options) => {
      const next = fakes[Math.min(calls.length, fakes.length - 1)];
      calls.push([...args]);
      return (next as (typeof fakes)[number]).runner(binary, args, options);
    };
    return { runner, calls };
  }

  it('reads a result file from the volume export', async () => {
    const content = new Uint8Array(300).fill(7);
    const exported = buildTarArchive([
      dirEntry('checkout'),
      dirEntry('checkout/reports'),
      file('checkout/reports/other.xml', new Uint8Array(40).fill(1)),
      file('checkout/reports/junit.xml', content),
      file('checkout/reports/zzz.xml', new Uint8Array(40).fill(2)),
    ]);
    const { runner, calls } = sequence(unsupported, { chunks: exported });
    const result = await copyOutResultFile(
      { runtime: podman, timeoutMs: 1000, stream: runner, volume },
      id,
      'reports/junit.xml',
      1000,
    );
    expect(result).toEqual({ ok: true, value: { kind: 'file', bytes: content } });
    expect(calls).toEqual([
      ['cp', id + ':/work/checkout/reports/junit.xml', '-'],
      ['volume', 'export', volume],
    ]);
  });

  it('reads the last file of the volume export', async () => {
    const exported = buildTarArchive([dirEntry('checkout'), file('checkout/junit.xml', Buffer.from('xy'))]);
    const { runner } = sequence(unsupported, { chunks: exported });
    const result = await copyOutResultFile({ runtime: podman, timeoutMs: 1000, stream: runner, volume }, id, 'junit.xml', 1000);
    expect(result).toEqual({ ok: true, value: { kind: 'file', bytes: new Uint8Array(Buffer.from('xy')) } });
  });

  it('classifies a directory, a symlink, and an oversize file from the volume export', async () => {
    const exported = buildTarArchive([
      dirEntry('checkout'),
      dirEntry('checkout/dir.xml'),
      { path: 'checkout/link.xml', type: 'symlink', mode: 0o777, mtime: 0, linkTarget: '/etc/passwd' },
      file('checkout/big.xml', new Uint8Array(5000)),
    ]);
    const expected = [
      ['dir.xml', { kind: 'not-regular' }],
      ['link.xml', { kind: 'not-regular' }],
      ['big.xml', { kind: 'too-large', declaredBytes: 5000 }],
    ] as const;
    for (const [name, value] of expected) {
      const { runner } = sequence(unsupported, { chunks: exported });
      const result = await copyOutResultFile({ runtime: podman, timeoutMs: 1000, stream: runner, volume }, id, name, 1000);
      expect(result).toEqual({ ok: true, value });
    }
  });

  it('tells a symlink from an absent path when cp reports not found', async () => {
    const exported = buildTarArchive([
      dirEntry('checkout'),
      dirEntry('checkout/reports'),
      { path: 'checkout/reports/link.xml', type: 'symlink', mode: 0o777, mtime: 0, linkTarget: '/etc/passwd' },
    ]);
    const link = sequence(notFound, { chunks: exported });
    const linked = await copyOutResultFile(
      { runtime: podman, timeoutMs: 1000, stream: link.runner, volume },
      id,
      'reports/link.xml',
      1000,
    );
    expect(linked).toEqual({ ok: true, value: { kind: 'not-regular' } });
    expect(link.calls[1]).toEqual(['volume', 'export', volume]);
    const absent = sequence(notFound, { chunks: exported, exitCode: 0 });
    const missing = await copyOutResultFile(
      { runtime: podman, timeoutMs: 1000, stream: absent.runner, volume },
      id,
      'reports/never.xml',
      1000,
    );
    expect(missing).toEqual({ ok: true, value: { kind: 'missing' } });
  });

  it('keeps the not-found answer without a volume and for docker', async () => {
    const { runner, calls } = sequence(notFound);
    const result = await copyOutResultFile({ runtime: podman, timeoutMs: 1000, stream: runner }, id, 'reports/link.xml', 1000);
    expect(result).toEqual({ ok: true, value: { kind: 'missing' } });
    expect(calls).toHaveLength(1);
    const docker = sequence(notFound);
    const viaDocker = await copyOutResultFile(
      { runtime, timeoutMs: 1000, stream: docker.runner, volume },
      id,
      'reports/link.xml',
      1000,
    );
    expect(viaDocker).toEqual({ ok: true, value: { kind: 'missing' } });
    expect(docker.calls).toHaveLength(1);
  });

  it('fails closed when the volume export fails, is invalid, or has no volume', async () => {
    const archive = buildTarArchive([dirEntry('checkout'), file('checkout/junit.xml', new Uint8Array(300))]);
    const cases = [
      { ctx: { volume }, then: { exitCode: 1, stderrText: 'boom' } },
      { ctx: { volume }, then: { chunks: new Uint8Array(512).fill(7) } },
      { ctx: { volume }, then: { chunks: archive.subarray(0, 700) } },
      { ctx: { volume }, then: { chunks: archive.subarray(0, 200), stopReason: 'timeout' as const } },
      { ctx: { volume }, then: { fail: true } },
      { ctx: {}, then: {} },
    ];
    for (const { ctx, then } of cases) {
      const { runner } = sequence(unsupported, then);
      const result = await copyOutResultFile({ runtime: podman, timeoutMs: 1000, stream: runner, ...ctx }, id, 'junit.xml', 1000);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('runner.copy-failed');
    }
  });

  it('exports the prepared copy from the volume export', async () => {
    const dir = tempDir();
    const out = path.join(dir, 'prepared.tar');
    const archive = buildTarArchive([dirEntry('checkout'), file('checkout/node_modules/x.js', Buffer.from('x'))]);
    const { runner, calls } = sequence(unsupported, { chunks: archive });
    const result = await exportPreparedCopy({ runtime: podman, timeoutMs: 1000, stream: runner, volume }, id, out, 1048576);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.bytes).toBe(archive.length);
      expect(result.value.sha256).toBe('sha256:' + createHash('sha256').update(archive).digest('hex'));
    }
    expect(new Uint8Array(fs.readFileSync(out))).toEqual(archive);
    expect(calls).toEqual([
      ['cp', id + ':/work/checkout', '-'],
      ['volume', 'export', volume],
    ]);
  });

  it('never leaves a partial prepared copy when the volume export fails', async () => {
    const dir = tempDir();
    const out = path.join(dir, 'prepared.tar');
    const { runner } = sequence(unsupported, { chunks: buildTarArchive([file('other/x', Buffer.from('x'))]) });
    const result = await exportPreparedCopy({ runtime: podman, timeoutMs: 1000, stream: runner, volume }, id, out, 1048576);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('runner.copy-failed');
    expect(fs.existsSync(out)).toBe(false);
  });
});
