import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTarArchive } from '../archive/tar.js';
import { runProcess } from '../process/run-process.js';
import {
  openContainerHarness,
  outputText,
  RUNTIME_NAME,
  type ContainerHarness,
  type HarnessCheckout,
} from '../runner/container-harness.container.test.js';
import type { ContainerExecutionResult } from '../runner/container.js';
import { SHELL_TEST_IMAGE } from '../runner/test-images.test.js';
import type { ResolvedImage } from '../runner/types.js';

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json {
  expect(typeof value === 'object' && value !== null && !Array.isArray(value)).toBe(true);
  return value as Json;
}

function field(value: unknown, key: string): unknown {
  return asRecord(value)[key];
}

async function prepare(harness: ContainerHarness): Promise<{ image: ResolvedImage; checkout: HarnessCheckout }> {
  const prepared = await harness.prepareImage(SHELL_TEST_IMAGE);
  if (!prepared.result.ok) throw new Error(JSON.stringify(prepared.result));
  const checkout = await harness.materialize('hostile-probes.json');
  return { image: prepared.result.value, checkout };
}

async function runScript(
  harness: ContainerHarness,
  script: string,
  limits?: { pids: number; memoryMb: number; cpus: number; scratchMb: number },
): Promise<string> {
  const { image, checkout } = await prepare(harness);
  const result = await harness.run({ image, checkout, run: ['sh', script], ...(limits ? { limits } : {}) });
  expect(result.kind).toBe('completed');
  return outputText(result);
}

function allBytes(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...allBytes(full));
    else out.push(fs.readFileSync(full).toString('latin1'));
  }
  return out;
}

// Format variants only: the same option with or without an explicit value.
function hasNoNewPrivileges(options: unknown): boolean {
  return Array.isArray(options) && options.some((o) => o === 'no-new-privileges' || o === 'no-new-privileges:true');
}

describe('invariant 3: container sandbox', () => {
  let harness: ContainerHarness;

  beforeAll(async () => {
    harness = await openContainerHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('exit E2: the container config matches the profile', async () => {
    await runScript(harness, 'identity.sh', { pids: 100, memoryMb: 256, cpus: 1, scratchMb: 32 });
    const inspected = asRecord((harness.inspected[0] as unknown[])[0]);
    const config = asRecord(inspected['Config']);
    const host = asRecord(inspected['HostConfig']);
    expect(config['User']).toBe('65532:65532');
    expect(host['ReadonlyRootfs']).toBe(true);
    expect(host['NetworkMode']).toBe('none');
    if (RUNTIME_NAME === 'podman') expect(Array.isArray(host['CapDrop'])).toBe(true);
    else expect(host['CapDrop']).toEqual(['ALL']);
    expect(hasNoNewPrivileges(host['SecurityOpt'])).toBe(true);
    expect(host['PidsLimit']).toBe(100);
    expect(host['Memory']).toBe(256 * 1048576);
    expect(host['MemorySwap']).toBe(256 * 1048576);
    expect(host['NanoCpus']).toBe(1000000000);
    expect(String(asRecord(host['Tmpfs'])['/tmp'])).toContain('size=32m');
    const mounts = inspected['Mounts'] as unknown[];
    expect(mounts).toHaveLength(1);
    expect(field(mounts[0], 'Type')).toBe('volume');
    expect(field(mounts[0], 'Destination')).toBe('/work');
    expect(mounts.some((m) => field(m, 'Type') === 'bind')).toBe(false);
  });

  it('exit E2: the sandbox runs as 65532 without privileges', async () => {
    const text = await runScript(harness, 'identity.sh');
    const lines = text.split('\n').map((l) => l.trim());
    expect(lines.filter((l) => l === '65532')).toHaveLength(2);
    expect(lines.some((l) => /^CapEff:\s+0+$/.test(l))).toBe(true);
    expect(lines.some((l) => /^NoNewPrivs:\s+1$/.test(l))).toBe(true);
    if (RUNTIME_NAME === 'podman') {
      const { image, checkout } = await prepare(harness);
      const caps = await harness.run({ image, checkout, run: ['grep', '-E', '^Cap(Inh|Prm|Eff|Bnd|Amb):', '/proc/self/status'] });
      expect(caps.kind).toBe('completed');
      const capLines = outputText(caps)
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '');
      expect(capLines).toHaveLength(5);
      expect(new Set(capLines.map((l) => l.split(':')[0])).size).toBe(5);
      for (const l of capLines) expect(l).toMatch(/^Cap(Inh|Prm|Eff|Bnd|Amb):\s+0+$/);
    }
  });

  it('exit E2: the sandbox has no network but loopback', async () => {
    const text = await runScript(harness, 'network.sh');
    const lines = text.split('\n').map((l) => l.trim());
    expect(lines).toContain('wget-failed');
    expect(lines.filter((l) => l !== '' && l !== 'wget-failed')).toEqual(['lo']);
  });

  it('exit E2: no runtime socket is reachable', async () => {
    const text = await runScript(harness, 'sockets.sh');
    const lines = text.split('\n').filter((l) => l.trim() !== '');
    expect(lines).toEqual(['/var/run/docker.sock absent', '/run/docker.sock absent', '/run/podman/podman.sock absent']);
  });

  it('exit E2: only the checkout and scratch are mounted', async () => {
    const text = await runScript(harness, 'mounts.sh');
    const exact = new Set(['/', '/work', '/tmp', '/etc/hostname', '/etc/hosts', '/etc/resolv.conf']);
    const podmanOnly = new Set(['/etc/passwd', '/etc/group', '/run/.containerenv', '/run/secrets']);
    const pseudo = ['/proc', '/sys', '/dev'];
    const points = text
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => l.split(' ')[4] ?? '');
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      const allowed =
        exact.has(point) ||
        (RUNTIME_NAME === 'podman' && podmanOnly.has(point)) ||
        pseudo.some((p) => point === p || point.startsWith(p + '/'));
      expect(allowed, point).toBe(true);
    }
    if (RUNTIME_NAME === 'podman') {
      const { image, checkout } = await prepare(harness);
      // The harness merges stdout and stderr, so the script reports each stream separately.
      const script =
        'out=$(ls -A /run/secrets 2>/tmp/err); rc=$?; printf "rc=%s\nout=[%s]\nerr=[%s]\n" "$rc" "$out" "$(cat /tmp/err)"';
      const listed = await harness.run({ image, checkout, run: ['sh', '-c', script] });
      if (listed.kind !== 'completed') throw new Error('listing /run/secrets did not complete');
      const report = /^rc=(\d+)\nout=\[([^\]]*)\]\nerr=\[([^\]]*)\]\n?$/.exec(outputText(listed));
      expect(report, outputText(listed)).not.toBeNull();
      expect(report?.[2]).toBe('');
      if (report?.[1] !== '0') expect(report?.[3]).toMatch(/No such file or directory/);
    }
  });

  async function buildWorkImage(tree: string, runLine: string) {
    const base = await harness.prepareImage(SHELL_TEST_IMAGE);
    if (!base.result.ok) throw new Error(JSON.stringify(base.result));
    const archive = buildTarArchive([
      {
        path: 'Dockerfile',
        type: 'file',
        mode: 0o644,
        mtime: 0,
        content: new TextEncoder().encode(`FROM ${SHELL_TEST_IMAGE}
${runLine}
`),
      },
    ]);
    return harness.prepareImage({
      source: 'dockerfile',
      context: { runnerTreeId: tree, dockerfilePath: 'Dockerfile', archive },
    });
  }

  async function removeWorkImage(tree: string): Promise<void> {
    const removed = await runProcess(harness.runtime.binary, ['rmi', `patch-steward-runner:${tree}`], {
      cwd: os.tmpdir(),
      env: harness.runtime.env,
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
    });
    expect(removed.ok, JSON.stringify(removed)).toBe(true);
    if (removed.ok) expect(removed.value.exitCode).toBe(0);
  }

  function listedNames(result: Parameters<typeof outputText>[0]): string[] {
    return outputText(result)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '');
  }

  if (RUNTIME_NAME === 'docker') {
    it('image content at /work is not copied into the volume', async () => {
      const tree = 'c'.repeat(40);
      const built = await buildWorkImage(tree, 'RUN mkdir -p /work/image-copied && echo image > /work/image-copied/marker');
      try {
        if (!built.result.ok) throw new Error(JSON.stringify(built.result));
        const checkout = await harness.materialize('hostile-probes.json');
        const result = await harness.run({ image: built.result.value, checkout, run: ['ls', '-A', '/work'] });
        if (result.kind !== 'completed') throw new Error('listing /work did not complete');
        expect(result.execution.record.exit.code).toBe(0);
        expect(listedNames(result)).toEqual(['checkout']);
      } finally {
        if (built.result.ok) await removeWorkImage(tree);
      }
    });
  }

  if (RUNTIME_NAME === 'podman') {
    it('an image with content at /work is refused under podman', async () => {
      const tree = 'd'.repeat(40);
      const before = harness.calls.length;
      const built = await buildWorkImage(tree, 'RUN mkdir -p /work/image-copied && echo image > /work/image-copied/marker');
      try {
        expect(built.result.ok).toBe(false);
        if (built.result.ok) return;
        expect(built.result.failure.code).toBe('runner.create-failed');
        expect(built.result.failure.cause).toBe('environment-unavailable');
        expect(built.result.failure.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ code: 'runner.create-failed', path: '/work', message: 'image-work-not-empty' }),
          ]),
        );
        const calls = harness.calls.slice(before);
        const probe = calls.findIndex((c) => c.args[0] === 'create' && c.args.includes('/bin/true') && !c.args.includes('--mount'));
        expect(probe).toBeGreaterThanOrEqual(0);
        const after = calls.slice(probe + 1);
        expect(after.some((c) => c.args[0] === 'volume' && c.args[1] === 'create')).toBe(false);
        expect(after.some((c) => c.args[0] === 'create' && c.args.includes('--mount'))).toBe(false);
      } finally {
        await removeWorkImage(tree);
      }
    });

    it('an image with an empty /work yields only the checkout under podman', async () => {
      const tree = 'e'.repeat(40);
      const built = await buildWorkImage(tree, 'RUN mkdir -p /work');
      try {
        expect(built.result.ok, JSON.stringify(built.result)).toBe(true);
        if (!built.result.ok) return;
        const checkout = await harness.materialize('hostile-probes.json');
        const result = await harness.run({ image: built.result.value, checkout, run: ['ls', '-A', '/work'] });
        if (result.kind !== 'completed') throw new Error('listing /work did not complete');
        expect(result.execution.record.exit.code).toBe(0);
        expect(listedNames(result)).toEqual(['checkout']);
      } finally {
        await removeWorkImage(tree);
      }
    });
  }

  describe('canaries', () => {
    const name = 'PATCH_STEWARD_CANARY_' + randomBytes(4).toString('hex').toUpperCase();
    const value = 'canary-' + randomBytes(16).toString('hex');
    let canaryHarness: ContainerHarness | null = null;
    let result: ContainerExecutionResult | null = null;
    let hostDir = '';
    let outDir = '';

    beforeAll(async () => {
      process.env[name] = value;
      hostDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-canary-'));
      fs.writeFileSync(path.join(hostDir, 'canary.txt'), value);
      outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-canary-out-'));
      canaryHarness = await openContainerHarness();
      const { image, checkout } = await prepare(canaryHarness);
      result = await canaryHarness.run({ image, checkout, run: ['sh', 'canary.sh'] });
    });

    afterAll(async () => {
      try {
        if (canaryHarness) await canaryHarness.close();
      } finally {
        Reflect.deleteProperty(process.env, name);
        if (hostDir) fs.rmSync(hostDir, { recursive: true, force: true });
        if (outDir) fs.rmSync(outDir, { recursive: true, force: true });
      }
    });

    it('exit E3: host canaries are absent inside the container', () => {
      if (result?.kind !== 'completed') throw new Error('canary run did not complete');
      expect(result.execution.record.exit.code).toBe(0);
      const text = outputText(result);
      expect(text).toContain('canary-scan-done');
      expect(text).not.toContain(value);
      expect(text).not.toContain(name);
    });

    it('exit E3: host canaries are absent from records and files', () => {
      if (result?.kind !== 'completed' || !canaryHarness) throw new Error('canary run did not complete');
      expect(fs.readFileSync(path.join(hostDir, 'canary.txt'), 'utf8')).toBe(value);
      expect(JSON.stringify(result)).not.toContain(value);
      for (const call of canaryHarness.calls) {
        expect(call.args.join('\n')).not.toContain(value);
        expect(Object.values(call.env).join('\n')).not.toContain(value);
      }
      fs.writeFileSync(path.join(outDir, 'execution-0001.json'), JSON.stringify(result.execution.record));
      fs.writeFileSync(path.join(outDir, 'output.txt'), outputText(result));
      const stored = allBytes(outDir);
      expect(stored).toHaveLength(2);
      for (const bytes of stored) expect(bytes).not.toContain(value);
    });
  });
});
