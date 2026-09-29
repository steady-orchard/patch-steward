import { describe, expect, it } from 'vitest';
import {
  TAR_BLOCK_BYTES,
  buildTarArchive,
  decodeTarOctal,
  tarEndOfArchive,
  tarEntryHeader,
  tarHeaderChecksum,
  tarPadding,
} from './tar.js';

function asciiField(block: Uint8Array, offset: number, length: number): string {
  const slice = block.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  const bytes = end === -1 ? slice : slice.subarray(0, end);
  return new TextDecoder().decode(bytes);
}

function isAllZero(bytes: Uint8Array): boolean {
  return bytes.every((b) => b === 0);
}

describe('tar', () => {
  it('writes a ustar header with fixed ownership', () => {
    const header = tarEntryHeader({ path: 'checkout/a.txt', type: 'file', mode: 0o644, size: 2, mtime: 1700000000 });
    expect(header.length).toBe(TAR_BLOCK_BYTES);
    expect(asciiField(header, 0, 100)).toBe('checkout/a.txt');
    expect(decodeTarOctal(header.subarray(100, 108))).toBe(0o644);
    expect(decodeTarOctal(header.subarray(108, 116))).toBe(65532);
    expect(decodeTarOctal(header.subarray(116, 124))).toBe(65532);
    expect(decodeTarOctal(header.subarray(124, 136))).toBe(2);
    expect(decodeTarOctal(header.subarray(136, 148))).toBe(1700000000);
    expect(header[156]).toBe('0'.charCodeAt(0));
    expect(asciiField(header, 257, 6)).toBe('ustar');
    expect(header[257 + 5]).toBe(0);
    expect(asciiField(header, 263, 2)).toBe('00');
  });

  it('writes directory, file, and symlink entries', () => {
    const dir = tarEntryHeader({ path: 'checkout/sub', type: 'directory', mode: 0o755, size: 0, mtime: 1700000000 });
    expect(asciiField(dir, 0, 100)).toBe('checkout/sub/');
    expect(dir[156]).toBe('5'.charCodeAt(0));
    expect(decodeTarOctal(dir.subarray(124, 136))).toBe(0);

    const file = tarEntryHeader({ path: 'checkout/run.sh', type: 'file', mode: 0o755, size: 0, mtime: 1700000000 });
    expect(decodeTarOctal(file.subarray(100, 108))).toBe(0o755);

    const link = tarEntryHeader({
      path: 'checkout/link',
      type: 'symlink',
      mode: 0o777,
      size: 0,
      mtime: 1700000000,
      linkTarget: '../../etc/passwd',
    });
    expect(link[156]).toBe('2'.charCodeAt(0));
    expect(asciiField(link, 157, 100)).toBe('../../etc/passwd');
  });

  it('splits long paths into prefix and name', () => {
    const prefixPart = 'd'.repeat(75);
    const namePart = 'f'.repeat(74);
    const path = `${prefixPart}/${namePart}`;
    expect(path.length).toBe(150);
    const header = tarEntryHeader({ path, type: 'file', mode: 0o644, size: 0, mtime: 1700000000 });
    expect(header.length).toBe(TAR_BLOCK_BYTES);
    const name = asciiField(header, 0, 100);
    const prefix = asciiField(header, 345, 155);
    expect(`${prefix}/${name}`).toBe(path);
  });

  it('uses a PAX header for paths that do not fit', () => {
    const dirPart = 'd'.repeat(149);
    const namePart = 'g'.repeat(150);
    const path = `${dirPart}/${namePart}`;
    const header = tarEntryHeader({ path, type: 'file', mode: 0o644, size: 3, mtime: 1700000000 });
    expect(header[156]).toBe('x'.charCodeAt(0));
    const paxSize = decodeTarOctal(header.subarray(124, 136));
    expect(paxSize).not.toBeNull();
    const data = new TextDecoder().decode(header.subarray(512, 512 + (paxSize as number)));
    expect(data).toContain(`path=${path}`);
    const dataPadded = 512 + Math.ceil((paxSize as number) / 512) * 512;
    const nextHeader = header.subarray(dataPadded, dataPadded + 512);
    expect(asciiField(nextHeader, 0, 100)).toBe('pax-path');
  });

  it('uses a PAX header for non-ASCII paths', () => {
    const path = 'checkout/' + String.fromCharCode(0xe9) + '.txt';
    const header = tarEntryHeader({ path, type: 'file', mode: 0o644, size: 0, mtime: 1700000000 });
    expect(header[156]).toBe('x'.charCodeAt(0));
    const paxSize = decodeTarOctal(header.subarray(124, 136)) as number;
    const data = new TextDecoder().decode(header.subarray(512, 512 + paxSize));
    expect(data).toContain(`path=${path}`);
  });

  it('uses a PAX header for long link targets', () => {
    const target = 'x'.repeat(150);
    const header = tarEntryHeader({
      path: 'checkout/far',
      type: 'symlink',
      mode: 0o777,
      size: 0,
      mtime: 1700000000,
      linkTarget: target,
    });
    expect(header[156]).toBe('x'.charCodeAt(0));
    const paxSize = decodeTarOctal(header.subarray(124, 136)) as number;
    const data = new TextDecoder().decode(header.subarray(512, 512 + paxSize));
    expect(data).toContain(`linkpath=${target}`);
    const dataPadded = 512 + Math.ceil(paxSize / 512) * 512;
    const nextHeader = header.subarray(dataPadded, dataPadded + 512);
    expect(asciiField(nextHeader, 157, 100)).toBe('pax-linkpath');
  });

  it('writes self-consistent PAX record lengths', () => {
    const path = 'd'.repeat(149) + '/' + 'g'.repeat(150);
    const target = 'x'.repeat(150);
    const header = tarEntryHeader({
      path,
      type: 'symlink',
      mode: 0o777,
      size: 0,
      mtime: 1700000000,
      linkTarget: target,
    });
    const paxSize = decodeTarOctal(header.subarray(124, 136)) as number;
    const data = new TextDecoder().decode(header.subarray(512, 512 + paxSize));
    const records = data.split('\n').filter((r) => r.length > 0);
    for (const record of records) {
      const spaceIndex = record.indexOf(' ');
      const declared = Number(record.slice(0, spaceIndex));
      const byteLength = new TextEncoder().encode(record + '\n').length;
      expect(declared).toBe(byteLength);
    }
  });

  it('pads content to the block size', () => {
    expect(tarPadding(0).length).toBe(0);
    expect(tarPadding(1).length).toBe(511);
    expect(tarPadding(512).length).toBe(0);
    expect(tarPadding(513).length).toBe(511);
  });

  it('ends an archive with two zero blocks', () => {
    const empty = buildTarArchive([]);
    expect(empty.length).toBe(1024);
    expect(isAllZero(empty)).toBe(true);
    expect(isAllZero(tarEndOfArchive())).toBe(true);

    const archive = buildTarArchive([
      { path: 'checkout/a.txt', type: 'file', mode: 0o644, mtime: 1700000000, content: new TextEncoder().encode('hi') },
    ]);
    expect(isAllZero(archive.subarray(archive.length - 1024))).toBe(true);
  });

  it('computes the header checksum', () => {
    const headers = [
      tarEntryHeader({ path: 'checkout/a.txt', type: 'file', mode: 0o644, size: 2, mtime: 1700000000 }),
      tarEntryHeader({ path: 'checkout/sub', type: 'directory', mode: 0o755, size: 0, mtime: 1700000000 }),
      tarEntryHeader({
        path: 'checkout/link',
        type: 'symlink',
        mode: 0o777,
        size: 0,
        mtime: 1700000000,
        linkTarget: '../../etc/passwd',
      }),
    ];
    for (const header of headers) {
      // last 512-byte block of a (possibly PAX-prefixed) header is the real ustar block
      const block = header.subarray(header.length - 512);
      const chksum = decodeTarOctal(block.subarray(148, 156));
      expect(chksum).toBe(tarHeaderChecksum(block));
    }
  });

  it('reads octal fields strictly', () => {
    expect(decodeTarOctal(new TextEncoder().encode('0000644\u0000'))).toBe(420);
    expect(decodeTarOctal(new TextEncoder().encode(' 17\u0000'))).toBe(15);
    expect(decodeTarOctal(new Uint8Array(8))).toBe(0);
    expect(decodeTarOctal(new TextEncoder().encode('8'))).toBeNull();
    const highBit = new Uint8Array([0x80, 0x31, 0x00]);
    expect(decodeTarOctal(highBit)).toBeNull();
  });

  it('rejects invalid header input', () => {
    const base = { mode: 0o644, size: 0, mtime: 1700000000 } as const;
    expect(() => tarEntryHeader({ ...base, path: '/leading', type: 'file' })).toThrow();
    expect(() => tarEntryHeader({ ...base, path: '', type: 'file' })).toThrow();
    expect(() => tarEntryHeader({ ...base, path: 'trailing/', type: 'file' })).toThrow();
    expect(() => tarEntryHeader({ ...base, path: 'has\u0000nul', type: 'file' })).toThrow();
    expect(() => tarEntryHeader({ ...base, path: 'checkout/link', type: 'symlink' })).toThrow();
    expect(() => tarEntryHeader({ ...base, path: 'checkout/a.txt', type: 'file', linkTarget: 'x' })).toThrow();
    expect(() => tarEntryHeader({ ...base, path: 'checkout/sub', type: 'directory', size: 3 })).toThrow();
    expect(() => tarEntryHeader({ ...base, path: 'checkout/a.txt', type: 'file', mtime: -1 })).toThrow();
    expect(() => tarEntryHeader({ ...base, path: 'checkout/a.txt', type: 'file', mode: 0o10000 })).toThrow();
  });
});
