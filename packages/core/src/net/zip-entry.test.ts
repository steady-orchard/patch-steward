import { describe, expect, it } from 'vitest';
import { crc32, deflateRawSync } from 'node:zlib';
import { readSingleZipEntry } from './zip-entry.js';
import type { ZipEntryLimits } from './zip-entry.js';

interface EntrySpec {
  name: string;
  data: Buffer;
  method?: 0 | 8;
  dataDescriptor?: boolean;
  flags?: number;
  crcOverride?: number;
}

function buildZip(specs: EntrySpec[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const spec of specs) {
    const method = spec.method ?? 0;
    const nameBuf = Buffer.from(spec.name, 'utf8');
    const payload = method === 8 ? deflateRawSync(spec.data) : spec.data;
    const realCrc = crc32(spec.data);
    const crc = spec.crcOverride ?? realCrc;
    const useDescriptor = spec.dataDescriptor === true;
    const flags = (spec.flags ?? 0) | (useDescriptor ? 0x0008 : 0);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(useDescriptor ? 0 : crc, 14);
    local.writeUInt32LE(useDescriptor ? 0 : payload.length, 18);
    local.writeUInt32LE(useDescriptor ? 0 : spec.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const parts = [local, nameBuf, payload];
    if (useDescriptor) {
      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50, 0);
      descriptor.writeUInt32LE(crc, 4);
      descriptor.writeUInt32LE(payload.length, 8);
      descriptor.writeUInt32LE(spec.data.length, 12);
      parts.push(descriptor);
    }
    const localEntry = Buffer.concat(parts);
    localParts.push(localEntry);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(spec.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(Buffer.concat([central, nameBuf]));
    offset += localEntry.length;
  }

  const localSection = Buffer.concat(localParts);
  const centralSection = Buffer.concat(centralParts);
  const cdOffset = localSection.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(specs.length, 8);
  eocd.writeUInt16LE(specs.length, 10);
  eocd.writeUInt32LE(centralSection.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localSection, centralSection, eocd]);
}

const limits: ZipEntryLimits = { entryName: 'ownership.json', maxArchiveBytes: 65536, maxEntryBytes: 16384 };

describe('readSingleZipEntry', () => {
  it('reads a stored single entry', () => {
    const data = Buffer.from('{"ok":true}');
    const zip = buildZip([{ name: 'ownership.json', data }]);
    const result = readSingleZipEntry(zip, limits);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(Buffer.from(result.bytes).equals(data)).toBe(true);
  });

  it('reads a deflated single entry', () => {
    const data = Buffer.from('x'.repeat(500));
    const zip = buildZip([{ name: 'ownership.json', data, method: 8 }]);
    const result = readSingleZipEntry(zip, limits);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(Buffer.from(result.bytes).equals(data)).toBe(true);
  });

  it('reads an entry written with a data descriptor', () => {
    const data = Buffer.from('descriptor payload');
    const zip = buildZip([{ name: 'ownership.json', data, method: 8, dataDescriptor: true }]);
    const result = readSingleZipEntry(zip, limits);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(Buffer.from(result.bytes).equals(data)).toBe(true);
  });

  it('rejects an archive over the byte bound', () => {
    const data = Buffer.from('hello');
    const zip = buildZip([{ name: 'ownership.json', data }]);
    const result = readSingleZipEntry(zip, { ...limits, maxArchiveBytes: zip.length - 1 });
    expect(result).toEqual({ kind: 'violation', reason: 'archive-bytes', archiveReason: null, message: expect.any(String) });
  });

  it('rejects an archive with two entries', () => {
    const zip = buildZip([
      { name: 'ownership.json', data: Buffer.from('a') },
      { name: 'other.json', data: Buffer.from('b') },
    ]);
    const result = readSingleZipEntry(zip, limits);
    expect(result.kind).toBe('violation');
    if (result.kind === 'violation') expect(result.reason).toBe('entry-count');
  });

  it('rejects an empty archive', () => {
    const zip = buildZip([]);
    const result = readSingleZipEntry(zip, limits);
    expect(result.kind).toBe('violation');
    if (result.kind === 'violation') expect(result.reason).toBe('entry-count');
  });

  it('rejects an entry with another name', () => {
    for (const name of ['other.json', 'dir/ownership.json']) {
      const zip = buildZip([{ name, data: Buffer.from('a') }]);
      const result = readSingleZipEntry(zip, limits);
      expect(result.kind).toBe('violation');
      if (result.kind === 'violation') expect(result.reason).toBe('entry-name');
    }
  });

  it('rejects an entry over the decompressed bound', () => {
    const data = Buffer.alloc(20000, 'a');
    const zip = buildZip([{ name: 'ownership.json', data, method: 8 }]);
    const result = readSingleZipEntry(zip, limits);
    expect(result.kind).toBe('violation');
    if (result.kind === 'violation') {
      expect(result.reason).toBe('archive');
      expect(result.archiveReason).toBe('decompressed-bytes');
    }
  });

  it('rejects a CRC mismatch', () => {
    const data = Buffer.from('hello world');
    const zip = buildZip([{ name: 'ownership.json', data, crcOverride: (crc32(data) ^ 0xffffffff) >>> 0 }]);
    const result = readSingleZipEntry(zip, limits);
    expect(result.kind).toBe('violation');
    if (result.kind === 'violation') expect(result.reason).toBe('crc-mismatch');
  });

  it('rejects bytes that are not a zip archive', () => {
    const result = readSingleZipEntry(Buffer.from('not a zip'), limits);
    expect(result.kind).toBe('violation');
    if (result.kind === 'violation') {
      expect(result.reason).toBe('archive');
      expect(result.archiveReason).toBe('malformed');
    }
  });

  it('rejects an encrypted entry', () => {
    const zip = buildZip([{ name: 'ownership.json', data: Buffer.from('a'), flags: 0x0001 }]);
    const result = readSingleZipEntry(zip, limits);
    expect(result.kind).toBe('violation');
    if (result.kind === 'violation') {
      expect(result.reason).toBe('archive');
      expect(result.archiveReason).toBe('encrypted');
    }
  });
});
