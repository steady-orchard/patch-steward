import { describe, expect, it } from 'vitest';
import { TAR_BLOCK_BYTES, buildTarArchive, tarHeaderChecksum } from './tar.js';
import { TarSingleFileReader, TarStreamParser, type SingleTarFileRead, type TarStreamEvent } from './tar-read.js';

const enc = new TextEncoder();
const CHUNK_SIZES = [1, 7, 511, 513];

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function fileArchive(content: Uint8Array | string, path = 'f.txt'): Uint8Array {
  const bytes = typeof content === 'string' ? enc.encode(content) : content;
  return buildTarArchive([{ path, type: 'file', mode: 0o644, mtime: 0, content: bytes }]);
}

function fixChecksum(block: Uint8Array): Uint8Array {
  const octal = tarHeaderChecksum(block).toString(8).padStart(6, '0');
  for (let i = 0; i < 6; i++) block[148 + i] = octal.charCodeAt(i);
  block[154] = 0;
  block[155] = 0x20;
  return block;
}

function setSize(block: Uint8Array, size: number): void {
  const octal = size.toString(8).padStart(11, '0');
  for (let i = 0; i < 11; i++) block[124 + i] = octal.charCodeAt(i);
  block[135] = 0;
}

function specialBlock(flag: string, size: number, name = 'PaxHeader'): Uint8Array {
  const block = fileArchive('').slice(0, TAR_BLOCK_BYTES);
  block.fill(0, 0, 100);
  block.set(enc.encode(name), 0);
  block[156] = flag.charCodeAt(0);
  setSize(block, size);
  return fixChecksum(block);
}

function padTo(data: Uint8Array): Uint8Array {
  return new Uint8Array((TAR_BLOCK_BYTES - (data.length % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES);
}

function ext(flag: string, data: Uint8Array): Uint8Array {
  return concat(specialBlock(flag, data.length), data, padTo(data));
}

const END = new Uint8Array(1024);

function read(bytes: Uint8Array, chunk: number, max = 1024): SingleTarFileRead {
  const reader = new TarSingleFileReader(max);
  for (let i = 0; i < bytes.length; i += chunk) {
    if (reader.push(bytes.subarray(i, i + chunk)) === 'done') break;
  }
  return reader.finish();
}

function parse(bytes: Uint8Array, chunk = bytes.length) {
  const parser = new TarStreamParser();
  const events: TarStreamEvent[] = [];
  for (let i = 0; i < bytes.length; i += chunk) {
    const r = parser.push(bytes.subarray(i, i + chunk));
    if (!r.ok) return { ok: false as const, events, parser };
    events.push(...r.value);
  }
  return { ok: true as const, events, parser };
}

describe('tar read', () => {
  it('reads a single regular file', () => {
    const result = read(fileArchive('hello'), 4096);
    expect(result.kind).toBe('file');
    if (result.kind === 'file') expect(new TextDecoder().decode(result.bytes)).toBe('hello');
  });

  it('reads a file split across small chunks', () => {
    const content = new Uint8Array(1000).map((_, i) => i % 251);
    const archive = fileArchive(content);
    for (const size of CHUNK_SIZES) {
      const result = read(archive, size);
      expect(result.kind).toBe('file');
      if (result.kind === 'file') expect(Array.from(result.bytes)).toEqual(Array.from(content));
    }
  });

  it('reads a PAX long path', () => {
    const path = 'checkout/' + 'g'.repeat(150) + '.txt';
    const archive = fileArchive('x', path);
    for (const size of [archive.length, ...CHUNK_SIZES]) {
      const parsed = parse(archive, size);
      expect(parsed.ok).toBe(true);
      const first = parsed.events[0];
      expect(first?.kind === 'entry' && first.entry.path).toBe(path);
    }
  });

  it('reports a symlink as not regular', () => {
    const archive = buildTarArchive([{ path: 'l', type: 'symlink', mode: 0o777, mtime: 0, linkTarget: '../../etc/passwd' }]);
    expect(read(archive, 512)).toEqual({ kind: 'not-regular', entryKind: 'symlink' });
    const first = parse(archive).events[0];
    expect(first?.kind === 'entry' && first.entry.linkTarget).toBe('../../etc/passwd');
  });

  it('reports a directory as not regular', () => {
    const archive = buildTarArchive([{ path: 'd', type: 'directory', mode: 0o755, mtime: 0 }]);
    expect(read(archive, 512)).toEqual({ kind: 'not-regular', entryKind: 'directory' });
  });

  it('reports an oversize file by its declared size', () => {
    const archive = fileArchive(new Uint8Array(2048).fill(7));
    expect(read(archive, 512)).toEqual({ kind: 'too-large', declaredBytes: 2048 });
    const reader = new TarSingleFileReader(1024);
    let done = false;
    let pushed = 0;
    for (let i = 0; i < archive.length && !done; i += 512) {
      done = reader.push(archive.subarray(i, i + 512)) === 'done';
      pushed = i + 512;
    }
    expect(done).toBe(true);
    expect(pushed).toBeLessThan(archive.length);
  });

  it('rejects a second entry after the file', () => {
    const archive = buildTarArchive([
      { path: 'a', type: 'file', mode: 0o644, mtime: 0, content: enc.encode('1') },
      { path: 'b', type: 'file', mode: 0o644, mtime: 0, content: enc.encode('2') },
    ]);
    expect(read(archive, 512)).toEqual({ kind: 'invalid' });
  });

  it('rejects a bad checksum', () => {
    const archive = fileArchive('hello');
    archive[0] = (archive[0] as number) ^ 1;
    expect(read(archive, 512)).toEqual({ kind: 'invalid' });
  });

  it('rejects a truncated stream', () => {
    const archive = fileArchive('hello').slice(0, TAR_BLOCK_BYTES + 3);
    expect(read(archive, 512)).toEqual({ kind: 'invalid' });
    const parsed = parse(archive);
    expect(parsed.ok).toBe(true);
    expect(parsed.parser.finish().ok).toBe(false);
  });

  it('rejects data after the end of the archive', () => {
    const archive = concat(fileArchive('hello'), new Uint8Array([1]));
    expect(parse(archive).ok).toBe(false);
  });

  it('rejects a base-256 size', () => {
    const archive = fileArchive('hello');
    archive[124] = 0x80;
    fixChecksum(archive.subarray(0, TAR_BLOCK_BYTES));
    expect(parse(archive).ok).toBe(false);
  });

  it('accepts the GNU magic', () => {
    const archive = fileArchive('hello');
    archive.set([0x75, 0x73, 0x74, 0x61, 0x72, 0x20, 0x20, 0x00], 257);
    fixChecksum(archive.subarray(0, TAR_BLOCK_BYTES));
    expect(read(archive, 512).kind).toBe('file');
  });

  it('ignores a global PAX header', () => {
    const archive = concat(ext('g', enc.encode('20 comment=ignored\n')), fileArchive('hello'));
    const parsed = parse(archive, 7);
    expect(parsed.ok).toBe(true);
    expect(parsed.events.filter((e) => e.kind === 'entry')).toHaveLength(1);
    expect(read(archive, 512).kind).toBe('file');
  });

  it('reports a hard link as other', () => {
    const block = fileArchive('').slice(0, TAR_BLOCK_BYTES);
    block[156] = 0x31;
    fixChecksum(block);
    expect(read(concat(block, END), 512)).toEqual({ kind: 'not-regular', entryKind: 'other' });
  });

  it('honors a PAX size record', () => {
    const header = fileArchive('').slice(0, TAR_BLOCK_BYTES);
    const data = enc.encode('abc');
    const archive = concat(ext('x', enc.encode('10 size=3\n')), header, data, padTo(data), END);
    const result = read(archive, 512);
    expect(result.kind).toBe('file');
    if (result.kind === 'file') expect(new TextDecoder().decode(result.bytes)).toBe('abc');
  });

  it('walks every entry of an archive', () => {
    const archive = buildTarArchive([
      { path: 'd', type: 'directory', mode: 0o755, mtime: 0 },
      { path: 'd/a', type: 'file', mode: 0o644, mtime: 0, content: enc.encode('aaa') },
      { path: 'd/b', type: 'file', mode: 0o644, mtime: 0, content: new Uint8Array(700) },
      { path: 'd/l', type: 'symlink', mode: 0o777, mtime: 0, linkTarget: 'a' },
    ]);
    for (const size of [archive.length, ...CHUNK_SIZES]) {
      const parsed = parse(archive, size);
      expect(parsed.ok).toBe(true);
      const entries = parsed.events.flatMap((e) => (e.kind === 'entry' ? [e.entry] : []));
      expect(entries.map((e) => [e.path, e.kind])).toEqual([
        ['d', 'directory'],
        ['d/a', 'file'],
        ['d/b', 'file'],
        ['d/l', 'symlink'],
      ]);
      const dataBytes = parsed.events.reduce((n, e) => n + (e.kind === 'data' ? e.bytes.length : 0), 0);
      expect(dataBytes).toBe(703);
      expect(parsed.events.at(-1)?.kind).toBe('end');
      expect(parsed.parser.finish().ok).toBe(true);
    }
  });

  it('rejects an oversize extended header', () => {
    const archive = concat(specialBlock('x', 65537), new Uint8Array(65537));
    expect(parse(archive).ok).toBe(false);
  });

  it('rejects an empty stream', () => {
    expect(new TarSingleFileReader(10).finish()).toEqual({ kind: 'invalid' });
    expect(read(END, 512)).toEqual({ kind: 'invalid' });
  });
});

describe('tar read limits', () => {
  it('rejects an invalid maximum', () => {
    expect(() => new TarSingleFileReader(-1)).toThrow(RangeError);
  });
});
