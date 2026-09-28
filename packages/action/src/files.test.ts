import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendTextFile, readBoundedFile, stagingPath, writeStagingFile } from './files.js';

describe('action files', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'm6-act-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('staging paths live under the temp root', () => {
    expect(stagingPath(dir, 'gate-context')).toBe(join(dir, 'steward', 'handoff', 'gate-context.json'));
    expect(() => stagingPath('relative/root', 'ownership')).toThrow(RangeError);
  });

  it('staging files are written once', async () => {
    const first = new Uint8Array([1, 2, 3]);
    const second = new Uint8Array([4, 5, 6]);
    await writeStagingFile(dir, 'ownership', first);
    await expect(writeStagingFile(dir, 'ownership', second)).rejects.toThrow();
    const bytes = await readFile(stagingPath(dir, 'ownership'));
    expect(new Uint8Array(bytes)).toEqual(first);
  });

  it('bounded reads report missing, oversize, and unreadable files', async () => {
    const missingPath = join(dir, 'missing.txt');
    expect(await readBoundedFile(missingPath, 100)).toEqual({ kind: 'missing' });

    const smallPath = join(dir, 'small.txt');
    writeFileSync(smallPath, '0123456789');
    expect(await readBoundedFile(smallPath, 9)).toEqual({ kind: 'too-large' });
    const result = await readBoundedFile(smallPath, 10);
    expect(result.kind).toBe('ok');
    expect(Buffer.from((result as { kind: 'ok'; bytes: Uint8Array }).bytes).toString()).toBe('0123456789');

    const dirPath = join(dir, 'subdir');
    mkdirSync(dirPath);
    expect(await readBoundedFile(dirPath, 100)).toEqual({ kind: 'unreadable' });
  });

  it('text is appended to runner files', async () => {
    const filePath = join(dir, 'log.txt');
    await appendTextFile(filePath, 'first\n');
    await appendTextFile(filePath, 'second\n');
    const content = await readFile(filePath, 'utf8');
    expect(content).toBe('first\nsecond\n');
  });
});
