import { describe, expect, it } from 'vitest';
import {
  TAR_BLOCK_BYTES,
  buildTarArchive,
  tarEndOfArchive,
  tarEntryHeader,
  tarHeaderChecksum,
  tarPadding,
} from '../archive/tar.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { RunProcessOptions, ProcessRunner } from '../process/run-process.js';
import type { StreamProcessOptions, StreamProcessRunner } from '../process/stream-process.js';
import { err, ok } from '../result.js';
import { imageRepository, normalizeImageRepository, prepareRunnerImage, type RunnerImageSpec } from './image.js';
import { runtimeWorkProbeCreateArgs } from './argv.js';
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
const d = 'a'.repeat(64);
const id = 'sha256:' + 'e'.repeat(64);
const tree = 'b'.repeat(40);
const treeLabel = 'org.patch-steward.runner-tree';
const limits = { pullSeconds: 600, buildSeconds: 1800, imageBytes: 4294967296, buildOutputStreamBytes: 268435456 };

interface Call {
  binary: string;
  args: readonly string[];
  options: RunProcessOptions;
}
type Reply = { exit: number; stdout?: string } | { error: string };

function control(replies: Reply[]): { runner: ProcessRunner; calls: Call[] } {
  const calls: Call[] = [];
  const runner: ProcessRunner = async (binary, args, options) => {
    calls.push({ binary, args, options });
    const reply = replies.shift() ?? { exit: 1 };
    if ('error' in reply) return err(reply.error as 'process.timeout', 'environment-unavailable', 'failed');
    return ok({ exitCode: reply.exit, stdout: Buffer.from(reply.stdout ?? ''), stderr: Buffer.alloc(0) });
  };
  return { runner, calls };
}

function inspectReply(fields: {
  Id?: string;
  RepoDigests?: string[] | null;
  Size?: number;
  labels?: Record<string, string>;
}): Reply {
  return {
    exit: 0,
    stdout: JSON.stringify([
      {
        Id: fields.Id ?? id,
        RepoDigests: fields.RepoDigests ?? null,
        Size: fields.Size ?? 10,
        Config: { Labels: fields.labels ?? {} },
      },
    ]),
  };
}

function streamer(exitCode: number): {
  runner: StreamProcessRunner;
  calls: { args: readonly string[]; options: StreamProcessOptions }[];
} {
  const calls: { args: readonly string[]; options: StreamProcessOptions }[] = [];
  const runner: StreamProcessRunner = async (_binary, args, options) => {
    calls.push({ args, options });
    const buffer = new OutputCaptureBuffer({ headBytes: 1024, tailBytes: 1024, streamBytes: 4096 });
    buffer.push(new TextEncoder().encode('step 1/1'));
    return ok({ exitCode, signal: null, stopReason: null, captured: buffer.result(), stderr: new Uint8Array(0), durationMs: 5 });
  };
  return { runner, calls };
}

async function registry(reference: string, replies: Reply[]) {
  const c = control(replies);
  const prepared = await prepareRunnerImage(
    { runtime, testNonce: null, control: c.runner },
    { source: 'registry', reference },
    limits,
  );
  return { prepared, calls: c.calls };
}

function failureCode(prepared: Awaited<ReturnType<typeof prepareRunnerImage>>): string | null {
  return prepared.result.ok ? null : prepared.result.failure.code;
}

const pull: Reply = { exit: 0 };
const ref = 'docker.io/library/busybox:1.37.0';

describe('runner image preparation', () => {
  it('pulls a registry image and pins its digest', async () => {
    const { prepared, calls } = await registry(ref, [pull, inspectReply({ RepoDigests: ['busybox@sha256:' + d] })]);
    expect(prepared.result).toEqual(
      ok({
        source: 'registry',
        reference: ref,
        digest: 'sha256:' + d,
        id,
        runnerTreeId: null,
        cached: false,
        runReference: 'docker.io/library/busybox@sha256:' + d,
      }),
    );
    expect(calls.map((c) => c.args)).toEqual([
      ['pull', '--platform', 'linux/amd64', ref],
      ['image', 'inspect', ref],
    ]);
    expect(calls.every((c) => c.binary === 'docker' && c.options.env['PATH'] === 'p')).toBe(true);
    expect(calls[0]?.options.timeoutMs).toBe(600000);
    expect(prepared.buildLog).toBeNull();
  });

  it('accepts a reference pinned by digest', async () => {
    const pinned = 'docker.io/library/busybox@sha256:' + d;
    const { prepared } = await registry(pinned, [pull, inspectReply({ RepoDigests: [pinned] })]);
    expect(prepared.result.ok && prepared.result.value.runReference).toBe(pinned);
  });

  it('accepts a pinned reference when the image lists another repository digest first', async () => {
    const pinned = 'docker.io/library/busybox@sha256:' + d;
    const other = 'docker.io/library/busybox@sha256:' + 'b'.repeat(64);
    const { prepared } = await registry(pinned, [pull, inspectReply({ RepoDigests: [other, pinned] })]);
    expect(prepared.result.ok && prepared.result.value.runReference).toBe(pinned);
  });

  it('rejects a digest that differs from the pin', async () => {
    const pinned = 'docker.io/library/busybox@sha256:' + d;
    const other = 'docker.io/library/busybox@sha256:' + 'b'.repeat(64);
    const { prepared } = await registry(pinned, [pull, inspectReply({ RepoDigests: [other] })]);
    expect(failureCode(prepared)).toBe('runner.image-digest-mismatch');
  });

  it('rejects an image without a repository digest', async () => {
    const a = await registry(ref, [pull, inspectReply({ RepoDigests: ['ghcr.io/other/image@sha256:' + d] })]);
    expect(failureCode(a.prepared)).toBe('runner.image-digest-mismatch');
    const b = await registry(ref, [pull, inspectReply({ RepoDigests: null })]);
    expect(failureCode(b.prepared)).toBe('runner.image-digest-mismatch');
  });

  it('rejects an image above the size limit', async () => {
    const { prepared } = await registry(ref, [pull, inspectReply({ RepoDigests: ['busybox@sha256:' + d], Size: 4294967297 })]);
    expect(failureCode(prepared)).toBe('runner.image-too-large');
  });

  it('normalizes a bare image id', async () => {
    const { prepared } = await registry(ref, [pull, inspectReply({ Id: 'e'.repeat(64), RepoDigests: ['busybox@sha256:' + d] })]);
    expect(prepared.result.ok && prepared.result.value.id).toBe('sha256:' + 'e'.repeat(64));
  });

  it('reports pull failures', async () => {
    const a = await registry(ref, [{ exit: 1 }]);
    expect(failureCode(a.prepared)).toBe('runner.image-pull-failed');
    const b = await registry(ref, [{ error: 'process.timeout' }]);
    expect(failureCode(b.prepared)).toBe('runner.image-pull-failed');
  });

  it('reports invalid inspect output', async () => {
    const a = await registry(ref, [pull, { exit: 0, stdout: 'not json' }]);
    expect(failureCode(a.prepared)).toBe('runner.inspect-invalid');
    const b = await registry(ref, [pull, inspectReply({ Id: 'xyz' })]);
    expect(failureCode(b.prepared)).toBe('runner.inspect-invalid');
  });
});

describe('runner image build', () => {
  const archive = Uint8Array.from([1, 2, 3]);
  const spec: RunnerImageSpec = { source: 'dockerfile', context: { runnerTreeId: tree, dockerfilePath: 'Dockerfile', archive } };
  const tag = 'patch-steward-runner:' + tree;

  it('uses a cached runner image', async () => {
    const c = control([inspectReply({ labels: { [treeLabel]: tree } })]);
    const s = streamer(0);
    const prepared = await prepareRunnerImage({ runtime, testNonce: null, control: c.runner, stream: s.runner }, spec, limits);
    expect(prepared.result).toEqual(
      ok({ source: 'dockerfile', reference: tag, digest: null, id, runnerTreeId: tree, cached: true, runReference: id }),
    );
    expect(s.calls).toHaveLength(0);
    expect(prepared.buildLog).toBeNull();
  });

  it('builds a runner image on a cache miss', async () => {
    const c = control([{ exit: 1 }, inspectReply({ labels: { [treeLabel]: tree } })]);
    const s = streamer(0);
    const prepared = await prepareRunnerImage({ runtime, testNonce: 'n0nce', control: c.runner, stream: s.runner }, spec, limits);
    expect(prepared.result.ok && prepared.result.value.cached).toBe(false);
    expect(s.calls[0]?.args).toEqual([
      'build',
      '--platform',
      'linux/amd64',
      '--label',
      'org.patch-steward.managed=true',
      '--label',
      'org.patch-steward.runner-tree=' + tree,
      '--label',
      'org.patch-steward.test=n0nce',
      '-t',
      tag,
      '-f',
      'Dockerfile',
      '-',
    ]);
    expect(s.calls[0]?.options.stdin).toEqual({ kind: 'bytes', bytes: archive });
    expect(s.calls[0]?.options.timeoutMs).toBe(1800000);
    expect(prepared.buildLog).not.toBeNull();
  });

  it('rebuilds when the cached label differs', async () => {
    const c = control([inspectReply({ labels: { [treeLabel]: 'c'.repeat(40) } }), inspectReply({ labels: { [treeLabel]: tree } })]);
    const s = streamer(0);
    await prepareRunnerImage({ runtime, testNonce: null, control: c.runner, stream: s.runner }, spec, limits);
    expect(s.calls).toHaveLength(1);
  });

  it('reports a failed build with its log', async () => {
    const c = control([{ exit: 1 }]);
    const s = streamer(1);
    const prepared = await prepareRunnerImage({ runtime, testNonce: null, control: c.runner, stream: s.runner }, spec, limits);
    expect(failureCode(prepared)).toBe('runner.image-build-failed');
    expect(prepared.buildLog).not.toBeNull();
  });
});

describe('image references', () => {
  it('normalizes image repositories', () => {
    expect(imageRepository('docker.io/library/busybox:1.37.0')).toBe('docker.io/library/busybox');
    expect(imageRepository('localhost:5000/a/b:tag@sha256:' + d)).toBe('localhost:5000/a/b');
    expect(normalizeImageRepository('busybox')).toBe('docker.io/library/busybox');
    expect(normalizeImageRepository('library/busybox')).toBe('docker.io/library/busybox');
    expect(normalizeImageRepository('docker.io/busybox')).toBe('docker.io/library/busybox');
    expect(normalizeImageRepository('index.docker.io/library/busybox')).toBe('docker.io/library/busybox');
    expect(normalizeImageRepository('ghcr.io/o/i')).toBe('ghcr.io/o/i');
    expect(normalizeImageRepository('localhost:5000/x')).toBe('localhost:5000/x');
  });
});

const podman: SelectedRuntime = { ...runtime, name: 'podman', binary: 'podman' };
const probeId = 'f'.repeat(64);
const runReference = 'docker.io/library/busybox@sha256:' + d;
const workDir = [{ path: 'work', type: 'directory' as const, mode: 0o755, mtime: 0 }];

interface SinkReply {
  bytes?: Uint8Array;
  exitCode?: number;
  stderr?: string;
  stopReason?: 'timeout' | 'output-limit' | null;
  /** The reply to a second stream call (the Podman export fallback); defaults to this reply. */
  then?: SinkReply;
}

function probeHarness(
  createReply: Reply,
  rmReply: Reply,
  sink: SinkReply,
  resolution: Reply[] = [pull, inspectReply({ RepoDigests: ['busybox@sha256:' + d] })],
) {
  const order: string[] = [];
  const calls: { args: readonly string[]; options: RunProcessOptions }[] = [];
  const streamCalls: { args: readonly string[]; options: StreamProcessOptions }[] = [];
  const replies: Reply[] = [...resolution, createReply, rmReply];
  const runner: ProcessRunner = async (_binary, args, options) => {
    order.push(args[0] as string);
    calls.push({ args, options });
    const reply = replies.shift() ?? { exit: 1 };
    if ('error' in reply) return err(reply.error as 'process.timeout', 'environment-unavailable', 'failed');
    return ok({ exitCode: reply.exit, stdout: Buffer.from(reply.stdout ?? ''), stderr: Buffer.alloc(0) });
  };
  const stream: StreamProcessRunner = async (_binary, args, options) => {
    order.push(args[0] as string);
    streamCalls.push({ args, options });
    const spec = streamCalls.length > 1 && sink.then !== undefined ? sink.then : sink;
    let stopReason: 'timeout' | 'output-limit' | 'sink-stop' | null = spec.stopReason ?? null;
    if (options.output.kind === 'sink' && spec.bytes !== undefined) {
      if (options.output.onStdout(spec.bytes) === 'stop') stopReason = 'sink-stop';
    }
    return ok({
      exitCode: spec.exitCode ?? 0,
      signal: null,
      stopReason,
      captured: null,
      stderr: new TextEncoder().encode(spec.stderr ?? ''),
      durationMs: 1,
    });
  };
  return { runner, stream, order, calls, streamCalls };
}

const created: Reply = { exit: 0, stdout: probeId + '\n' };
const removed: Reply = { exit: 0 };

async function probed(h: ReturnType<typeof probeHarness>, runId: string | null = 'r1', rt: SelectedRuntime = podman) {
  return prepareRunnerImage(
    { runtime: rt, testNonce: 'n0nce', ...(runId === null ? {} : { runId }), control: h.runner, stream: h.stream },
    { source: 'registry', reference: ref },
    limits,
  );
}

function expectProbeCalls(h: ReturnType<typeof probeHarness>): void {
  expect(h.calls[2]?.args).toEqual(runtimeWorkProbeCreateArgs({ runId: 'r1', testNonce: 'n0nce' }, runReference));
  expect(h.streamCalls.map((c) => c.args)).toEqual([['cp', probeId + ':/work', '-']]);
}

function expectRemovedAfterCopy(h: ReturnType<typeof probeHarness>): void {
  expect(h.order.slice(-2)).toEqual(['cp', 'rm']);
  expect(h.calls.filter((c) => c.args[0] === 'rm').map((c) => c.args)).toEqual([['rm', '-f', probeId]]);
}

function paxWorkArchive(): Uint8Array {
  const record = ' path=work/\n';
  const length = String(record.length + String(record.length).length);
  const data = new TextEncoder().encode(length + record);
  const header = new Uint8Array(TAR_BLOCK_BYTES);
  header.set(new TextEncoder().encode('PaxHeader'), 0);
  header.set(new TextEncoder().encode('0000644\0'), 100);
  header.set(new TextEncoder().encode(data.length.toString(8).padStart(11, '0') + '\0'), 124);
  header[156] = 'x'.charCodeAt(0);
  header.set(new TextEncoder().encode('ustar\0' + '00'), 257);
  header.fill(0x20, 148, 156);
  const octal = tarHeaderChecksum(header).toString(8).padStart(6, '0');
  header.set(new TextEncoder().encode(octal + '\0 '), 148);
  const real = tarEntryHeader({ path: 'pax-path', type: 'directory', mode: 0o755, size: 0, mtime: 0 });
  const parts = [header, data, tarPadding(data.length), real, tarEndOfArchive()];
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const notEmpty = [{ code: 'runner.create-failed', path: '/work', message: 'image-work-not-empty', line: null, column: null }];

describe('podman /work probe', () => {
  it('podman /work probe: an absent /work passes', async () => {
    const h = probeHarness(created, removed, {
      exitCode: 1,
      stderr: 'Error: "/work" could not be found on container x: no such file or directory',
    });
    const prepared = await probed(h);
    expect(prepared.result.ok).toBe(true);
    expectProbeCalls(h);
    expectRemovedAfterCopy(h);
  });

  it('podman /work probe: an empty /work directory passes', async () => {
    const h = probeHarness(created, removed, { bytes: buildTarArchive(workDir) });
    const prepared = await probed(h);
    expect(prepared.result.ok).toBe(true);
    expectProbeCalls(h);
    expectRemovedAfterCopy(h);
  });

  it('podman /work probe: an empty /work directory behind a PAX header passes', async () => {
    const h = probeHarness(created, removed, { bytes: paxWorkArchive() });
    const prepared = await probed(h);
    expect(prepared.result.ok).toBe(true);
    expectProbeCalls(h);
    expectRemovedAfterCopy(h);
  });

  it('podman /work probe: a second entry is refused', async () => {
    const h = probeHarness(created, removed, {
      bytes: buildTarArchive([
        ...workDir,
        { path: 'work/marker', type: 'file', mode: 0o644, mtime: 0, content: new Uint8Array(0) },
      ]),
    });
    const prepared = await probed(h);
    expect(failureCode(prepared)).toBe('runner.create-failed');
    expect(!prepared.result.ok && prepared.result.failure.details).toEqual(notEmpty);
    expectRemovedAfterCopy(h);
  });

  it('podman /work probe: a non-directory /work is refused', async () => {
    const h = probeHarness(created, removed, {
      bytes: buildTarArchive([{ path: 'work', type: 'file', mode: 0o644, mtime: 0, content: new Uint8Array(0) }]),
    });
    const prepared = await probed(h);
    expect(failureCode(prepared)).toBe('runner.create-failed');
    expect(!prepared.result.ok && prepared.result.failure.details).toEqual(notEmpty);
    expectRemovedAfterCopy(h);
  });

  it('podman /work probe: a wrong first path is refused', async () => {
    const h = probeHarness(created, removed, {
      bytes: buildTarArchive([{ path: 'other', type: 'directory', mode: 0o755, mtime: 0 }]),
    });
    const prepared = await probed(h);
    expect(failureCode(prepared)).toBe('runner.create-failed');
    expect(!prepared.result.ok && prepared.result.failure.details).toEqual(notEmpty);
    expectRemovedAfterCopy(h);
  });

  it('podman /work probe: an invalid tar stream is a copy failure', async () => {
    const h = probeHarness(created, removed, { bytes: new Uint8Array(512).fill(7), exitCode: 0 });
    const prepared = await probed(h);
    expect(failureCode(prepared)).toBe('runner.copy-failed');
    expectRemovedAfterCopy(h);
  });

  it('podman /work probe: a failing cp is a copy failure', async () => {
    const h = probeHarness(created, removed, { exitCode: 1, stderr: 'permission denied' });
    const prepared = await probed(h);
    expect(failureCode(prepared)).toBe('runner.copy-failed');
    expectRemovedAfterCopy(h);
  });

  it('podman /work probe: a timed-out cp is a copy failure', async () => {
    const h = probeHarness(created, removed, { exitCode: 1, stopReason: 'timeout' });
    const prepared = await probed(h);
    expect(failureCode(prepared)).toBe('runner.copy-failed');
    expectRemovedAfterCopy(h);
  });

  it('podman /work probe: a failing probe create is a create failure', async () => {
    const h = probeHarness({ exit: 125 }, removed, {});
    const prepared = await probed(h);
    expect(failureCode(prepared)).toBe('runner.create-failed');
    expect(!prepared.result.ok && prepared.result.failure.details).toEqual([]);
    expect(h.streamCalls).toEqual([]);
    expect(h.order).toEqual(['pull', 'image', 'create']);
  });

  it('podman /work probe: a failing rm is a cleanup failure', async () => {
    const h = probeHarness(created, { exit: 1 }, { bytes: buildTarArchive(workDir) });
    const prepared = await probed(h);
    expect(failureCode(prepared)).toBe('runner.cleanup-failed');
    expectRemovedAfterCopy(h);
  });

  it('podman /work probe: a missing run id is a create failure', async () => {
    const h = probeHarness(created, removed, {});
    const prepared = await probed(h, null);
    expect(failureCode(prepared)).toBe('runner.create-failed');
    expect(h.order).toEqual(['pull', 'image']);
  });

  it('podman /work probe: probes the image id of a cached dockerfile image', async () => {
    const h = probeHarness(created, removed, { bytes: buildTarArchive(workDir) }, [
      inspectReply({ labels: { [treeLabel]: tree } }),
    ]);
    const prepared = await prepareRunnerImage(
      { runtime: podman, testNonce: 'n0nce', runId: 'r1', control: h.runner, stream: h.stream },
      { source: 'dockerfile', context: { runnerTreeId: tree, dockerfilePath: 'Dockerfile', archive: new Uint8Array([1]) } },
      limits,
    );
    expect(prepared.result.ok).toBe(true);
    expect(h.calls[1]?.args).toEqual(runtimeWorkProbeCreateArgs({ runId: 'r1', testNonce: 'n0nce' }, id));
    expectRemovedAfterCopy(h);
  });

  const stdoutUnsupported = {
    exitCode: 125,
    stderr: 'Error: "/dev/stdout" could not be found on the host: no such file or directory',
  };
  const rootEntries = [
    { path: 'bin', type: 'directory' as const, mode: 0o755, mtime: 0 },
    { path: 'etc', type: 'directory' as const, mode: 0o755, mtime: 0 },
  ];

  function expectExportFallback(h: ReturnType<typeof probeHarness>): void {
    expect(h.streamCalls.map((c) => c.args)).toEqual([
      ['cp', probeId + ':/work', '-'],
      ['export', probeId],
    ]);
    expect(h.order.slice(-3)).toEqual(['cp', 'export', 'rm']);
    expect(h.calls.filter((c) => c.args[0] === 'rm').map((c) => c.args)).toEqual([['rm', '-f', probeId]]);
  }

  it('podman /work probe: a client that cannot copy to standard output falls back to a container export', async () => {
    for (const entries of [rootEntries, [...rootEntries, ...workDir]]) {
      const h = probeHarness(created, removed, { ...stdoutUnsupported, then: { bytes: buildTarArchive(entries) } });
      const prepared = await probed(h);
      expect(prepared.result.ok).toBe(true);
      expectExportFallback(h);
    }
  });

  it('podman /work probe: the container export refuses content at or below /work', async () => {
    const bad = [
      [
        ...rootEntries,
        ...workDir,
        { path: 'work/marker', type: 'file' as const, mode: 0o644, mtime: 0, content: new Uint8Array(1) },
      ],
      [...rootEntries, { path: 'work', type: 'file' as const, mode: 0o644, mtime: 0, content: new Uint8Array(0) }],
      [...rootEntries, { path: 'work/sub', type: 'directory' as const, mode: 0o755, mtime: 0 }],
    ];
    for (const entries of bad) {
      const h = probeHarness(created, removed, { ...stdoutUnsupported, then: { bytes: buildTarArchive(entries) } });
      const prepared = await probed(h);
      expect(failureCode(prepared)).toBe('runner.create-failed');
      expect(!prepared.result.ok && prepared.result.failure.details).toEqual(notEmpty);
      expectExportFallback(h);
    }
  });

  it('podman /work probe: a failing or invalid container export is a copy failure', async () => {
    const replies = [
      { exitCode: 1, stderr: 'Error: boom' },
      { bytes: new Uint8Array(512).fill(7) },
      { bytes: buildTarArchive(rootEntries), stopReason: 'timeout' as const },
      { bytes: buildTarArchive(rootEntries).subarray(0, 700) },
    ];
    for (const then of replies) {
      const h = probeHarness(created, removed, { ...stdoutUnsupported, then });
      const prepared = await probed(h);
      expect(failureCode(prepared)).toBe('runner.copy-failed');
      expectExportFallback(h);
    }
  });

  it('podman /work probe: docker runs no probe', async () => {
    const h = probeHarness(created, removed, {});
    const prepared = await probed(h, 'r1', runtime);
    expect(prepared.result.ok).toBe(true);
    const g = probeHarness(created, removed, {}, [inspectReply({ labels: { [treeLabel]: tree } })]);
    const cached = await prepareRunnerImage(
      { runtime, testNonce: 'n0nce', runId: 'r1', control: g.runner, stream: g.stream },
      { source: 'dockerfile', context: { runnerTreeId: tree, dockerfilePath: 'Dockerfile', archive: new Uint8Array([1]) } },
      limits,
    );
    expect(cached.result.ok).toBe(true);
    for (const o of [h.order, g.order]) {
      expect(o).not.toContain('create');
      expect(o).not.toContain('cp');
      expect(o).not.toContain('rm');
    }
  });
});
