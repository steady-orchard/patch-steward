import { deflateRawSync, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { inspectGzipArchive, inspectZipArchive } from './archive.js';

interface BuildZipEntry {
  name: string | Buffer;
  data: Buffer;
  method?: 0 | 8;
  flags?: number;
  versionMadeBy?: number;
  externalAttributes?: number;
  declaredSize?: number;
  extra?: Buffer;
  diskStart?: number;
}

interface BuildZipOptions {
  zip64Locator?: boolean;
  disk?: number;
  entriesOnDisk?: number;
  entriesTotal?: number;
}

function buildZip(entries: BuildZipEntry[], options: BuildZipOptions = {}): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.isBuffer(entry.name) ? entry.name : Buffer.from(entry.name, 'utf-8');
    const method = entry.method ?? 0;
    const flags = entry.flags ?? 0;
    const extra = entry.extra ?? Buffer.alloc(0);
    const storedData = method === 8 ? deflateRawSync(entry.data) : entry.data;
    const declaredSize = entry.declaredSize ?? entry.data.length;
    const localOffset = offset;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(storedData.length, 18);
    local.writeUInt32LE(declaredSize, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(extra.length, 28);

    const localFull = Buffer.concat([local, nameBuf, extra, storedData]);
    localParts.push(localFull);
    offset += localFull.length;

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(entry.versionMadeBy ?? 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(storedData.length, 20);
    central.writeUInt32LE(declaredSize, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(entry.diskStart ?? 0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(entry.externalAttributes ?? 0, 38);
    central.writeUInt32LE(localOffset, 42);

    centralParts.push(Buffer.concat([central, nameBuf, extra]));
  }

  const localSection = Buffer.concat(localParts);
  const centralSection = Buffer.concat(centralParts);
  const cdOffset = localSection.length;
  const cdSize = centralSection.length;

  const zip64Locator = options.zip64Locator
    ? Buffer.concat([Buffer.from([0x50, 0x4b, 0x06, 0x07]), Buffer.alloc(16)])
    : Buffer.alloc(0);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(options.disk ?? 0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(options.entriesOnDisk ?? entries.length, 8);
  eocd.writeUInt16LE(options.entriesTotal ?? entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localSection, centralSection, zip64Locator, eocd]);
}

describe('archive inspection', () => {
  it('archive: stored and deflate entries are listed', () => {
    const result = inspectZipArchive(
      buildZip([
        { name: 'a.txt', data: Buffer.from('hello'), method: 0 },
        { name: 'dir/b.txt', data: Buffer.alloc(1000, 'b'), method: 8 },
        { name: 'dir/', data: Buffer.alloc(0), method: 0 },
      ]),
      1005,
    );
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.entries).toEqual([
        { name: 'a.txt', bytes: 5 },
        { name: 'dir/b.txt', bytes: 1000 },
        { name: 'dir/', bytes: 0 },
      ]);
      expect(result.decompressedBytes).toBe(1005);
    }
  });

  it('attachment rule: decompressed bytes are bounded for zip', () => {
    const stored = inspectZipArchive(
      buildZip([
        { name: 'a.txt', data: Buffer.alloc(600), method: 0 },
        { name: 'b.txt', data: Buffer.alloc(600), method: 0 },
      ]),
      1000,
    );
    expect(stored.kind).toBe('violation');
    if (stored.kind === 'violation') expect(stored.rule).toBe('decompressed-bytes');

    const deflated = inspectZipArchive(
      buildZip([{ name: 'z.bin', data: Buffer.alloc(5000), method: 8, declaredSize: 5000 }]),
      4999,
    );
    expect(deflated.kind).toBe('violation');
    if (deflated.kind === 'violation') expect(deflated.rule).toBe('decompressed-bytes');
  });

  it('injected failure: archive bomb', () => {
    const result = inspectZipArchive(
      buildZip([{ name: 'bomb.bin', data: Buffer.alloc(200000), method: 8, declaredSize: 100 }]),
      1000,
    );
    expect(result.kind).toBe('violation');
    if (result.kind === 'violation') expect(result.rule).toBe('decompressed-bytes');
  });

  it('attachment rule: decompressed bytes are bounded for gzip', () => {
    const gz = gzipSync(Buffer.alloc(5000));
    const tooSmall = inspectGzipArchive(gz, 1000, 'log.txt');
    expect(tooSmall.kind).toBe('violation');
    if (tooSmall.kind === 'violation') expect(tooSmall.rule).toBe('decompressed-bytes');

    const ok = inspectGzipArchive(gz, 5000, 'log.txt');
    expect(ok.kind).toBe('ok');
    if (ok.kind === 'ok') {
      expect(ok.entries).toEqual([{ name: 'log.txt', bytes: 5000 }]);
    }
  });

  it('archive: multi-member gzip is decompressed', () => {
    const multi = Buffer.concat([gzipSync(Buffer.from('ab')), gzipSync(Buffer.from('cd'))]);
    const result = inspectGzipArchive(multi, 100, 'log.txt');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.decompressedBytes).toBe(4);
  });

  it('attachment rule: archive structure is checked', () => {
    expect(inspectZipArchive(Buffer.alloc(0), 1000)).toEqual({
      kind: 'violation',
      rule: 'archive',
      reason: 'malformed',
      message: 'The archive is malformed.',
    });

    const rand = Buffer.alloc(21);
    for (let i = 0; i < rand.length; i++) rand[i] = i;
    expect((inspectZipArchive(rand, 1000) as { reason: string }).reason).toBe('malformed');

    const validZip = buildZip([{ name: 'a.txt', data: Buffer.from('hi') }]);

    const badOffset = Buffer.from(validZip);
    const eocdOffset = badOffset.length - 22;
    badOffset.writeUInt32LE(badOffset.readUInt32LE(eocdOffset + 16) + 100000, eocdOffset + 16);
    expect((inspectZipArchive(badOffset, 1000) as { reason: string }).reason).toBe('malformed');

    const badCentralSig = Buffer.from(validZip);
    const cdOffset = badCentralSig.readUInt32LE(eocdOffset + 16);
    badCentralSig.writeUInt32LE(0xdeadbeef, cdOffset);
    expect((inspectZipArchive(badCentralSig, 1000) as { reason: string }).reason).toBe('malformed');

    const badLocalSig = Buffer.from(validZip);
    badLocalSig.writeUInt32LE(0xdeadbeef, 0);
    expect((inspectZipArchive(badLocalSig, 1000) as { reason: string }).reason).toBe('malformed');

    expect((inspectGzipArchive(validZip, 1000, 'x') as { reason: string }).reason).toBe('malformed');

    const truncatedGzip = gzipSync(Buffer.from('hello world')).subarray(0, 20);
    expect((inspectGzipArchive(truncatedGzip, 1000, 'x') as { reason: string }).reason).toBe('malformed');
  });

  it('injected failure: archive encrypted entries', () => {
    const flag1 = inspectZipArchive(buildZip([{ name: 'a.txt', data: Buffer.from('hi'), flags: 0x0001 }]), 1000);
    expect((flag1 as { reason: string }).reason).toBe('encrypted');

    const flag64 = inspectZipArchive(buildZip([{ name: 'a.txt', data: Buffer.from('hi'), flags: 0x0040 }]), 1000);
    expect((flag64 as { reason: string }).reason).toBe('encrypted');
  });

  it('injected failure: archive ZIP64', () => {
    const locator = inspectZipArchive(buildZip([{ name: 'a.txt', data: Buffer.from('hi') }], { zip64Locator: true }), 1000);
    expect((locator as { reason: string }).reason).toBe('zip64');

    const entriesTotal = inspectZipArchive(buildZip([{ name: 'a.txt', data: Buffer.from('hi') }], { entriesTotal: 0xffff }), 1000);
    expect((entriesTotal as { reason: string }).reason).toBe('zip64');

    const extraField = inspectZipArchive(
      buildZip([{ name: 'a.txt', data: Buffer.from('hi'), extra: Buffer.from([0x01, 0x00, 0x00, 0x00]) }]),
      1000,
    );
    expect((extraField as { reason: string }).reason).toBe('zip64');
  });

  it('archive: multi-disk archives are rejected', () => {
    const disk = inspectZipArchive(buildZip([{ name: 'a.txt', data: Buffer.from('hi') }], { disk: 1 }), 1000);
    expect((disk as { reason: string }).reason).toBe('multi-disk');

    const entriesOnDisk = inspectZipArchive(buildZip([{ name: 'a.txt', data: Buffer.from('hi') }], { entriesOnDisk: 0 }), 1000);
    expect((entriesOnDisk as { reason: string }).reason).toBe('multi-disk');

    const diskStart = inspectZipArchive(buildZip([{ name: 'a.txt', data: Buffer.from('hi'), diskStart: 1 }]), 1000);
    expect((diskStart as { reason: string }).reason).toBe('multi-disk');
  });

  it('injected failure: archive symlink entries', () => {
    const symlink = inspectZipArchive(
      buildZip([
        {
          name: 'link',
          data: Buffer.from('target'),
          versionMadeBy: 0x031e,
          externalAttributes: (0o120777 << 16) >>> 0,
        },
      ]),
      1000,
    );
    expect((symlink as { reason: string }).reason).toBe('symlink');

    const notUnix = inspectZipArchive(
      buildZip([
        {
          name: 'link',
          data: Buffer.from('target'),
          versionMadeBy: 0x0014,
          externalAttributes: (0o120777 << 16) >>> 0,
        },
      ]),
      1000,
    );
    expect(notUnix.kind).toBe('ok');
  });

  it('injected failure: archive traversal names', () => {
    const names = ['../x', 'a/../b', '/etc/passwd', 'C:/x.txt', 'c:x', 'a\\b'];
    for (const name of names) {
      const result = inspectZipArchive(buildZip([{ name, data: Buffer.from('hi') }]), 1000);
      expect((result as { reason: string }).reason, name).toBe('entry-name');
    }
  });

  it('archive: unsafe entry names are rejected', () => {
    const badNames: (string | Buffer)[] = [
      'a' + String.fromCharCode(0) + 'b',
      'a' + String.fromCharCode(27) + 'b',
      'x'.repeat(513),
      '',
      Buffer.from([0xff, 0xfe]),
    ];
    for (const name of badNames) {
      const result = inspectZipArchive(buildZip([{ name, data: Buffer.from('hi') }]), 1000);
      expect((result as { reason: string }).reason).toBe('entry-name');
    }

    const okNames = ['..hidden', 'a/b..c', 'x'.repeat(512)];
    for (const name of okNames) {
      const result = inspectZipArchive(buildZip([{ name, data: Buffer.from('hi') }]), 1000);
      expect(result.kind, name).toBe('ok');
    }
  });

  it('archive: too many entries are rejected', () => {
    const tooMany = Array.from({ length: 1001 }, (_, i) => ({ name: `f${i}`, data: Buffer.alloc(0) }));
    const resultTooMany = inspectZipArchive(buildZip(tooMany), 1000);
    expect((resultTooMany as { reason: string }).reason).toBe('too-many-entries');

    const exact = Array.from({ length: 1000 }, (_, i) => ({ name: `f${i}`, data: Buffer.alloc(0) }));
    const resultExact = inspectZipArchive(buildZip(exact), 1000);
    expect(resultExact.kind).toBe('ok');
  });

  it('archive: unsupported compression methods are rejected', () => {
    const zip = buildZip([{ name: 'a.txt', data: Buffer.from('hi'), method: 0 }]);
    const buf = Buffer.from(zip);
    // Locate central directory method field and overwrite with an unsupported method.
    const eocdOffset = buf.length - 22;
    const cdOffset = buf.readUInt32LE(eocdOffset + 16);
    buf.writeUInt16LE(12, cdOffset + 10);
    const result = inspectZipArchive(buf, 1000);
    expect((result as { reason: string }).reason).toBe('unsupported-method');
  });

  it('archive: nested archives are not expanded', () => {
    const inner = buildZip([{ name: 'inner-a.txt', data: Buffer.from('hi') }]);
    const outer = buildZip([{ name: 'inner.zip', data: inner, method: 0 }]);
    const result = inspectZipArchive(outer, 10000);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.entries).toEqual([{ name: 'inner.zip', bytes: inner.length }]);
    }
  });

  it('archive: size mismatches are rejected', () => {
    const result = inspectZipArchive(buildZip([{ name: 'a.txt', data: Buffer.from('abcde'), declaredSize: 4, method: 0 }]), 1000);
    expect((result as { reason: string }).reason).toBe('size-mismatch');
  });

  it('archive inspection never throws', () => {
    const zip = buildZip([{ name: 'a.txt', data: Buffer.from('hi') }]);
    const buf = Buffer.from(zip);
    const eocdOffset = buf.length - 22;
    const cdOffset = buf.readUInt32LE(eocdOffset + 16);
    buf.writeUInt16LE(60000, cdOffset + 28);
    expect(() => inspectZipArchive(buf, 1000)).not.toThrow();
    const result = inspectZipArchive(buf, 1000);
    expect((result as { reason: string }).reason).toBe('malformed');
  });
});
