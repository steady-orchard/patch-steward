import fs from 'node:fs/promises';
import { rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { EvidenceFs, RunDirectoryWrite } from './local-store.js';
import { nodeEvidenceFs, writeRunDirectory } from './local-store.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function sampleWrite(storeRoot: string): RunDirectoryWrite {
  return {
    storeRoot,
    storePath: `runs/pr-12/${RUN_ID}`,
    stagingPath: `runs/.staging/${RUN_ID}`,
    files: [
      { path: 'run.json', bytes: encode('{}\n') },
      { path: 'report.md', bytes: encode('# r\n') },
      { path: 'findings/finding-0001.json', bytes: encode('{}\n') },
      { path: 'logs/steward.txt', bytes: encode('gate\n') },
    ],
    metrics: { path: `metrics/2026-09/${RUN_ID}.json`, bytes: encode('[]\n') },
    manifest: encode('{}\n'),
  };
}

function failing(fs: EvidenceFs, method: keyof EvidenceFs, predicate: (...args: unknown[]) => boolean): EvidenceFs {
  return {
    ...fs,
    [method]: async (...args: unknown[]): Promise<unknown> => {
      if (predicate(...args)) {
        throw Object.assign(new Error('injected'), { code: 'EIO' });
      }
      return (fs[method] as (...innerArgs: unknown[]) => unknown)(...args);
    },
  } as EvidenceFs;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.lstat(target);
    return true;
  } catch {
    return false;
  }
}

describe('writeRunDirectory', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'm5-store-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('writes files, metrics, and manifest, then commits by rename', async () => {
    const storeRoot = path.join(tmp, 'octo', 'demo');
    const write = sampleWrite(storeRoot);
    const result = await writeRunDirectory(write);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const final = path.join(storeRoot, 'runs', 'pr-12', RUN_ID);
    expect(result.value.directory).toBe(path.resolve(final));
    expect(await fs.readFile(path.join(final, 'run.json'), 'utf8')).toBe('{}\n');
    expect(await fs.readFile(path.join(final, 'report.md'), 'utf8')).toBe('# r\n');
    expect(await fs.readFile(path.join(final, 'findings', 'finding-0001.json'), 'utf8')).toBe('{}\n');
    expect(await fs.readFile(path.join(final, 'logs', 'steward.txt'), 'utf8')).toBe('gate\n');
    expect(await fs.readFile(path.join(final, 'manifest.json'), 'utf8')).toBe('{}\n');
    expect(await pathExists(path.join(storeRoot, 'metrics', '2026-09', `${RUN_ID}.json`))).toBe(true);
    expect(await pathExists(path.join(storeRoot, 'runs', '.staging', RUN_ID))).toBe(false);
  });

  it('writes the manifest last', async () => {
    const storeRoot = path.join(tmp, 'octo', 'demo');
    const write = sampleWrite(storeRoot);
    const calls: { readonly kind: string; readonly target: string }[] = [];
    const spy: EvidenceFs = {
      ...nodeEvidenceFs,
      writeFileExclusive: async (target: string, data: Uint8Array): Promise<void> => {
        calls.push({ kind: 'writeFileExclusive', target });
        await nodeEvidenceFs.writeFileExclusive(target, data);
      },
      rename: async (from: string, to: string): Promise<void> => {
        calls.push({ kind: 'rename', target: to });
        await nodeEvidenceFs.rename(from, to);
      },
    };
    const result = await writeRunDirectory(write, spy);
    expect(result.ok).toBe(true);
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.kind).toBe('rename');
    const manifestIndex = calls.findIndex((call) => call.target.endsWith('manifest.json'));
    const metricsIndex = calls.findIndex((call) => call.target.endsWith(`${RUN_ID}.json`) && call.kind === 'writeFileExclusive');
    expect(manifestIndex).toBeGreaterThan(-1);
    expect(metricsIndex).toBeGreaterThan(-1);
    expect(metricsIndex).toBeLessThan(manifestIndex);
    expect(calls[calls.length - 1]?.kind).toBe('rename');
  });

  it('never overwrites an existing file', async () => {
    const storeRoot = path.join(tmp, 'octo', 'demo');
    const write = sampleWrite(storeRoot);
    const metricsFile = path.join(storeRoot, 'metrics', '2026-09', `${RUN_ID}.json`);
    await fs.mkdir(path.dirname(metricsFile), { recursive: true });
    await fs.writeFile(metricsFile, 'old');
    const result = await writeRunDirectory(write);
    expect(!result.ok && result.failure.code).toBe('evidence.write-failed');
    expect(await fs.readFile(metricsFile, 'utf8')).toBe('old');
    expect(await pathExists(path.join(storeRoot, 'runs', 'pr-12', RUN_ID))).toBe(false);
    expect(await pathExists(path.join(storeRoot, 'runs', '.staging', RUN_ID))).toBe(false);
  });

  it('an existing run directory is never replaced', async () => {
    const storeRoot = path.join(tmp, 'octo', 'demo');
    const write = sampleWrite(storeRoot);
    const final = path.join(storeRoot, 'runs', 'pr-12', RUN_ID);
    await fs.mkdir(final, { recursive: true });
    await fs.writeFile(path.join(final, 'keep.txt'), 'keep');
    const result = await writeRunDirectory(write);
    expect(!result.ok && result.failure.code).toBe('evidence.run-exists');
    expect(await fs.readFile(path.join(final, 'keep.txt'), 'utf8')).toBe('keep');
    expect(await pathExists(path.join(storeRoot, 'runs', '.staging', RUN_ID))).toBe(false);
    expect(await pathExists(path.join(storeRoot, 'metrics', '2026-09', `${RUN_ID}.json`))).toBe(false);
  });

  it('a failed file write leaves no final run directory', async () => {
    const storeRoot = path.join(tmp, 'octo', 'demo');
    const write = sampleWrite(storeRoot);
    const fsWithFailure = failing(nodeEvidenceFs, 'writeFileExclusive', (...args) => {
      const target = args[0] as string;
      return target.endsWith('report.md');
    });
    const result = await writeRunDirectory(write, fsWithFailure);
    expect(!result.ok && result.failure.code).toBe('evidence.write-failed');
    expect(await pathExists(path.join(storeRoot, 'runs', 'pr-12', RUN_ID))).toBe(false);
    expect(await pathExists(path.join(storeRoot, 'runs', '.staging', RUN_ID))).toBe(false);
    expect(await pathExists(path.join(storeRoot, 'metrics', '2026-09', `${RUN_ID}.json`))).toBe(false);
  });

  it('a failed manifest write leaves no final run directory', async () => {
    const storeRoot = path.join(tmp, 'octo', 'demo');
    const write = sampleWrite(storeRoot);
    const fsWithFailure = failing(nodeEvidenceFs, 'writeFileExclusive', (...args) => {
      const target = args[0] as string;
      return target.endsWith('manifest.json');
    });
    const result = await writeRunDirectory(write, fsWithFailure);
    expect(!result.ok && result.failure.code).toBe('evidence.write-failed');
    expect(await pathExists(path.join(storeRoot, 'runs', 'pr-12', RUN_ID))).toBe(false);
    expect(await pathExists(path.join(storeRoot, 'runs', '.staging', RUN_ID))).toBe(false);
    expect(await pathExists(path.join(storeRoot, 'metrics', '2026-09', `${RUN_ID}.json`))).toBe(false);
  });

  it('a rename failure leaves no final run directory', async () => {
    const storeRoot = path.join(tmp, 'octo', 'demo');
    const write = sampleWrite(storeRoot);
    const fsWithFailure = failing(nodeEvidenceFs, 'rename', () => true);
    const result = await writeRunDirectory(write, fsWithFailure);
    expect(!result.ok && result.failure.code).toBe('evidence.write-failed');
    expect(await pathExists(path.join(storeRoot, 'runs', 'pr-12', RUN_ID))).toBe(false);
    expect(await pathExists(path.join(storeRoot, 'runs', '.staging', RUN_ID))).toBe(false);
    expect(await pathExists(path.join(storeRoot, 'metrics', '2026-09', `${RUN_ID}.json`))).toBe(false);
  });

  it('too many files fail before any write', async () => {
    const storeRoot = path.join(tmp, 'octo', 'demo');
    const files = Array.from({ length: 4096 }, (_, index) => ({
      path: `findings/finding-${String(index + 1).padStart(4, '0')}.json`,
      bytes: encode('{}\n'),
    }));
    const write: RunDirectoryWrite = {
      storeRoot,
      storePath: `runs/pr-12/${RUN_ID}`,
      stagingPath: `runs/.staging/${RUN_ID}`,
      files,
      metrics: { path: `metrics/2026-09/${RUN_ID}.json`, bytes: encode('[]\n') },
      manifest: encode('{}\n'),
    };
    const result = await writeRunDirectory(write);
    expect(!result.ok && result.failure.code).toBe('evidence.too-many-files');
    expect(await fs.readdir(tmp)).toHaveLength(0);
  });
});
