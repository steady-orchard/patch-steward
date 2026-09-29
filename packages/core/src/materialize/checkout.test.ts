import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitBlobId } from '../evidence/blob-id.js';
import type { ProcessRunner } from '../process/run-process.js';
import type { StreamProcessRunner } from '../process/stream-process.js';
import { buildCheckoutArchive, type CheckoutArchiveInput } from './checkout.js';
import { readArchiveEntries } from './fixture-repository.fixture.test.js';
import type { OverlayEntry } from './paths.js';

const LF = '\n';
const CR = '\r';
const CONFIG_ARGS = ['-c', 'core.hooksPath=x'];
const TREE = 'f'.repeat(40);
const COMMIT = 'c'.repeat(40);

interface Rec {
  mode: string;
  type: string;
  id: string;
  path: Uint8Array;
}

const temps: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-checkout-'));
  temps.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function blobs(): Map<string, Buffer> {
  return new Map([
    ['a'.repeat(40), Buffer.from('line one' + CR + LF + '$Format:%H$' + LF)],
    ['b'.repeat(40), Buffer.from('echo hi' + LF)],
    ['d'.repeat(40), Buffer.from('../x')],
  ]);
}

function baseRecords(): Rec[] {
  const enc = (s: string): Uint8Array => Buffer.from(s);
  return [
    { mode: '100644', type: 'blob', id: 'a'.repeat(40), path: enc('a.txt') },
    { mode: '100755', type: 'blob', id: 'b'.repeat(40), path: enc('bin/run.sh') },
    { mode: '120000', type: 'blob', id: 'd'.repeat(40), path: enc('link') },
    { mode: '160000', type: 'commit', id: 'e'.repeat(40), path: enc('vendor/lib') },
  ];
}

function lsBytes(records: Rec[]): Buffer {
  return Buffer.concat(
    records.flatMap((r) => [Buffer.from(`${r.mode} ${r.type} ${r.id}\t`), Buffer.from(r.path), Buffer.from([0])]),
  );
}

interface Harness {
  calls: (readonly string[])[];
  batchIds: string[];
  run(extra: Partial<CheckoutArchiveInput>, records?: Rec[], store?: Map<string, Buffer>): ReturnType<typeof buildCheckoutArchive>;
  outputDir: string;
}

function harness(commitExit = 0): Harness {
  const outputDir = tempDir();
  const calls: (readonly string[])[] = [];
  const batchIds: string[] = [];
  const commitText =
    'tree ' +
    TREE +
    LF +
    'author A <a@example.com> 1700000000 +0000' +
    LF +
    'committer C <c@example.com> 1700000000 +0000' +
    LF +
    LF +
    'm' +
    LF;
  const control: ProcessRunner = async (_binary, args) => {
    calls.push(args);
    return {
      ok: true,
      value: { exitCode: commitExit, stdout: Buffer.from(commitText), stderr: Buffer.alloc(0) },
    } as Awaited<ReturnType<ProcessRunner>>;
  };
  return {
    calls,
    batchIds,
    outputDir,
    run(extra, records = baseRecords(), store = blobs()) {
      const stream: StreamProcessRunner = async (_binary, args, options) => {
        calls.push(args);
        if (options.output.kind !== 'sink') throw new Error('sink expected');
        const sink = options.output.onStdout;
        let data: Buffer;
        if (args.includes('ls-tree')) {
          data = lsBytes(records);
        } else {
          const ids = Buffer.from((options.stdin as { bytes: Uint8Array }).bytes)
            .toString('utf8')
            .split(LF)
            .filter(Boolean);
          batchIds.push(...ids);
          data = Buffer.concat(
            ids.map((id) => {
              const content = store.get(id);
              return content === undefined
                ? Buffer.from(`${id} missing${LF}`)
                : Buffer.concat([Buffer.from(`${id} blob ${content.length}${LF}`), content, Buffer.from(LF)]);
            }),
          );
        }
        let stopped = false;
        for (let i = 0; i < data.length && !stopped; i += 7) {
          stopped = sink(data.subarray(i, i + 7)) === 'stop';
        }
        return {
          ok: true,
          value: {
            exitCode: stopped ? 1 : 0,
            signal: null,
            stopReason: stopped ? 'sink-stop' : null,
            captured: null,
            stderr: new Uint8Array(0),
            durationMs: 1,
          },
        } as Awaited<ReturnType<StreamProcessRunner>>;
      };
      return buildCheckoutArchive({
        repo: { repoDir: os.tmpdir(), env: {}, configArgs: CONFIG_ARGS },
        commit: COMMIT,
        overlay: [],
        limits: { checkoutFiles: 100, checkoutBytes: 10000, overlayFiles: 10, overlayBytes: 1000 },
        timeoutMs: 10000,
        outputDir,
        stream,
        control,
        ...extra,
      });
    },
  };
}

function archiveExists(h: Harness): boolean {
  return fs.existsSync(path.join(h.outputDir, 'checkout.tar'));
}

describe('buildCheckoutArchive', () => {
  it('writes the checkout archive from git objects', async () => {
    const h = harness();
    const result = await h.run({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const call of h.calls) expect(call.slice(0, 2)).toEqual(CONFIG_ARGS);
    const entries = readArchiveEntries(result.value.archivePath);
    expect(entries.map((e) => [e.path, e.kind, e.mode, e.linkTarget])).toEqual([
      ['checkout', 'directory', 0o755, null],
      ['checkout/a.txt', 'file', 0o644, null],
      ['checkout/bin', 'directory', 0o755, null],
      ['checkout/bin/run.sh', 'file', 0o755, null],
      ['checkout/link', 'symlink', 0o777, '../x'],
    ]);
    const facts = result.value.facts;
    expect(facts.skipped_submodules).toEqual(['vendor/lib']);
    expect(facts.files).toBe(3);
    expect(facts.tree).toBe(TREE);
    const sizes = [...blobs().values()].reduce((n, b) => n + b.length, 0);
    expect(facts.bytes).toBe(sizes);
    expect(facts.archive_sha256).toBe(
      'sha256:' + createHash('sha256').update(fs.readFileSync(result.value.archivePath)).digest('hex'),
    );
  });

  it('keeps committed bytes exactly', async () => {
    const h = harness();
    const result = await h.run({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = readArchiveEntries(result.value.archivePath).find((e) => e.path === 'checkout/a.txt');
    expect(entry?.content?.equals(Buffer.from('line one' + CR + LF + '$Format:%H$' + LF))).toBe(true);
  });

  it('stops past the file limit', async () => {
    const h = harness();
    const result = await h.run({ limits: { checkoutFiles: 2, checkoutBytes: 10000, overlayFiles: 10, overlayBytes: 1000 } });
    expect(!result.ok && result.failure.code).toBe('materialize.checkout-too-large');
    expect(archiveExists(h)).toBe(false);
  });

  it('stops past the byte limit', async () => {
    const h = harness();
    const result = await h.run({ limits: { checkoutFiles: 100, checkoutBytes: 5, overlayFiles: 10, overlayBytes: 1000 } });
    expect(!result.ok && result.failure.code).toBe('materialize.checkout-too-large');
    expect(archiveExists(h)).toBe(false);
  });

  it('rejects invalid checkout paths', async () => {
    const paths = [
      Uint8Array.from([0x61, 92, 0x62]),
      Uint8Array.from([0x61, 0x01, 0x62]),
      Uint8Array.from([0x61, 0xff]),
      Buffer.from('.git/config'),
    ];
    for (const bad of paths) {
      const h = harness();
      const result = await h.run({}, [{ mode: '100644', type: 'blob', id: 'a'.repeat(40), path: bad }]);
      expect(!result.ok && result.failure.code).toBe('materialize.path-invalid');
      expect(archiveExists(h)).toBe(false);
    }
  });

  it('rejects an unsafe symlink target', async () => {
    const h = harness();
    const store = new Map([['d'.repeat(40), Buffer.from('a'.repeat(4097))]]);
    const result = await h.run({}, [{ mode: '120000', type: 'blob', id: 'd'.repeat(40), path: Buffer.from('link') }], store);
    expect(!result.ok && result.failure.code).toBe('materialize.path-invalid');
    expect(archiveExists(h)).toBe(false);
  });

  it('applies overlays while building the archive', async () => {
    const h = harness();
    const overlay: OverlayEntry[] = [
      { path: 'a.txt', content: Buffer.from('new' + LF), mode: '100755' },
      { path: 'docs/new.txt', content: Buffer.from('doc' + LF), mode: '100644' },
      { path: 'bin/run.sh', delete: true },
    ];
    const result = await h.run({ overlay });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entries = readArchiveEntries(result.value.archivePath);
    const a = entries.find((e) => e.path === 'checkout/a.txt');
    expect(a?.content?.equals(Buffer.from('new' + LF))).toBe(true);
    expect(a?.mode).toBe(0o755);
    const paths = entries.map((e) => e.path);
    expect(paths).toContain('checkout/docs/new.txt');
    expect(paths.indexOf('checkout/docs/new.txt')).toBeGreaterThan(paths.indexOf('checkout/link'));
    expect(paths).not.toContain('checkout/bin/run.sh');
    expect(paths).not.toContain('checkout/bin');
    expect(result.value.facts.overlays).toEqual([
      { path: 'a.txt', blob: gitBlobId(Buffer.from('new' + LF)) },
      { path: 'docs/new.txt', blob: gitBlobId(Buffer.from('doc' + LF)) },
      { path: 'bin/run.sh', blob: null },
    ]);
    expect(h.batchIds).toEqual(['d'.repeat(40)]);
  });

  it('rejects an escaping overlay', async () => {
    const h = harness();
    const first = await h.run({ overlay: [{ path: 'link/x', content: Buffer.from('x'), mode: '100644' }] });
    expect(!first.ok && first.failure.code).toBe('materialize.overlay-rejected');
    expect(!first.ok && first.failure.details[0]?.path).toBe('link/x');
    const second = await harness().run({ overlay: [{ path: '../x', content: Buffer.from('x'), mode: '100644' }] });
    expect(!second.ok && second.failure.code).toBe('materialize.overlay-rejected');
  });

  it('reports git failures as fetch failures', async () => {
    const failed = await harness(128).run({});
    expect(!failed.ok && failed.failure.code).toBe('materialize.fetch-failed');
    const h = harness();
    const result = await h.run({}, baseRecords(), new Map());
    expect(!result.ok && result.failure.code).toBe('materialize.fetch-failed');
    expect(archiveExists(h)).toBe(false);
  });
});
