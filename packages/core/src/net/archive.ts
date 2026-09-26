import { gunzipSync, inflateRawSync } from 'node:zlib';
import { ARCHIVE_ENTRIES_MAX, ARCHIVE_ENTRY_NAME_MAX_BYTES } from '../policy/bounds.js';

export const ARCHIVE_VIOLATION_REASONS = [
  'malformed',
  'zip64',
  'multi-disk',
  'encrypted',
  'unsupported-method',
  'symlink',
  'entry-name',
  'too-many-entries',
  'size-mismatch',
  'decompressed-bytes',
] as const;

export type ArchiveViolationReason = (typeof ARCHIVE_VIOLATION_REASONS)[number];

export interface ArchiveEntry {
  readonly name: string;
  readonly bytes: number;
}

export type ArchiveInspection =
  | { readonly kind: 'ok'; readonly entries: readonly ArchiveEntry[]; readonly decompressedBytes: number }
  | {
      readonly kind: 'violation';
      readonly rule: 'archive' | 'decompressed-bytes';
      readonly reason: ArchiveViolationReason;
      readonly message: string;
    };

const MESSAGES: Record<ArchiveViolationReason, string> = {
  malformed: 'The archive is malformed.',
  zip64: 'ZIP64 archives are not supported.',
  'multi-disk': 'Multi-disk archives are not supported.',
  encrypted: 'Encrypted entries are not supported.',
  'unsupported-method': 'An unsupported compression method was used.',
  symlink: 'Symlink entries are not supported.',
  'entry-name': 'An entry name is unsafe or invalid.',
  'too-many-entries': 'The archive has too many entries.',
  'size-mismatch': 'An entry size does not match its declared size.',
  'decompressed-bytes': 'The decompressed size exceeds the allowed bound.',
};

function violation(reason: ArchiveViolationReason): ArchiveInspection {
  return {
    kind: 'violation',
    rule: reason === 'decompressed-bytes' ? 'decompressed-bytes' : 'archive',
    reason,
    message: MESSAGES[reason],
  };
}

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

function toBuffer(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function isValidEntryName(nameBytes: Buffer): string | null {
  if (nameBytes.length === 0 || nameBytes.length > ARCHIVE_ENTRY_NAME_MAX_BYTES) return null;
  let name: string;
  try {
    name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
  } catch {
    return null;
  }
  if (name.includes('\\')) return null;
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null;
  }
  if (name.startsWith('/')) return null;
  if (/^[A-Za-z]:/.test(name)) return null;
  const segments = name.split('/');
  if (segments.some((s) => s === '..')) return null;
  return name;
}

export function inspectZipArchive(bytes: Uint8Array, maxDecompressedBytes: number): ArchiveInspection {
  try {
    const buf = toBuffer(bytes);
    const minOffset = Math.max(0, buf.length - 22 - 65535);
    let eocdOffset = -1;
    for (let offset = buf.length - 22; offset >= minOffset; offset--) {
      if (offset < 0) break;
      if (buf.readUInt32LE(offset) === EOCD_SIGNATURE) {
        const commentLength = buf.readUInt16LE(offset + 20);
        if (offset + 22 + commentLength === buf.length) {
          eocdOffset = offset;
          break;
        }
      }
    }
    if (eocdOffset === -1) return violation('malformed');

    if (eocdOffset >= 20 && buf.readUInt32LE(eocdOffset - 20) === ZIP64_LOCATOR_SIGNATURE) {
      return violation('zip64');
    }

    const disk = buf.readUInt16LE(eocdOffset + 4);
    const cdDisk = buf.readUInt16LE(eocdOffset + 6);
    const entriesOnDisk = buf.readUInt16LE(eocdOffset + 8);
    const entriesTotal = buf.readUInt16LE(eocdOffset + 10);
    const cdSize = buf.readUInt32LE(eocdOffset + 12);
    const cdOffset = buf.readUInt32LE(eocdOffset + 16);

    if (entriesTotal === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) return violation('zip64');
    if (disk !== 0 || cdDisk !== 0 || entriesOnDisk !== entriesTotal) return violation('multi-disk');
    if (entriesTotal > ARCHIVE_ENTRIES_MAX) return violation('too-many-entries');
    if (cdOffset + cdSize > eocdOffset) return violation('malformed');

    interface CentralEntry {
      name: string;
      method: number;
      compressedSize: number;
      uncompressedSize: number;
      localOffset: number;
    }

    const centralEntries: CentralEntry[] = [];
    let p = cdOffset;
    let declaredSum = 0;

    for (let i = 0; i < entriesTotal; i++) {
      if (p + 46 > cdOffset + cdSize) return violation('malformed');
      if (buf.readUInt32LE(p) !== CENTRAL_SIGNATURE) return violation('malformed');

      const versionMadeBy = buf.readUInt16LE(p + 4);
      const flags = buf.readUInt16LE(p + 8);
      const method = buf.readUInt16LE(p + 10);
      const compressedSize = buf.readUInt32LE(p + 20);
      const uncompressedSize = buf.readUInt32LE(p + 24);
      const nameLength = buf.readUInt16LE(p + 28);
      const extraLength = buf.readUInt16LE(p + 30);
      const commentLength = buf.readUInt16LE(p + 32);
      const diskStart = buf.readUInt16LE(p + 34);
      const externalAttributes = buf.readUInt32LE(p + 38);
      const localOffset = buf.readUInt32LE(p + 42);

      const nextP = p + 46 + nameLength + extraLength + commentLength;
      if (nextP > cdOffset + cdSize) return violation('malformed');

      if (flags & 0x0001 || flags & 0x0040) return violation('encrypted');

      if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
        return violation('zip64');
      }

      const extraStart = p + 46 + nameLength;
      const extraEnd = extraStart + extraLength;
      let ep = extraStart;
      while (ep + 4 <= extraEnd) {
        const headerId = buf.readUInt16LE(ep);
        const size = buf.readUInt16LE(ep + 2);
        if (headerId === 0x0001) return violation('zip64');
        ep += 4 + size;
      }

      if (diskStart !== 0) return violation('multi-disk');
      if (method !== 0 && method !== 8) return violation('unsupported-method');
      if (versionMadeBy >> 8 === 3 && ((externalAttributes >>> 16) & 0xf000) === 0xa000) {
        return violation('symlink');
      }

      const nameBytes = buf.subarray(p + 46, p + 46 + nameLength);
      const name = isValidEntryName(nameBytes);
      if (name === null) return violation('entry-name');

      declaredSum += uncompressedSize;
      if (declaredSum > maxDecompressedBytes) return violation('decompressed-bytes');

      centralEntries.push({ name, method, compressedSize, uncompressedSize, localOffset });
      p = nextP;
    }

    const entries: ArchiveEntry[] = [];
    let actualSum = 0;

    for (const centralEntry of centralEntries) {
      const { localOffset, compressedSize, uncompressedSize, method, name } = centralEntry;
      if (localOffset + 30 > cdOffset) return violation('malformed');
      if (buf.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) return violation('malformed');

      const localNameLength = buf.readUInt16LE(localOffset + 26);
      const localExtraLength = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > cdOffset) return violation('malformed');

      const data = buf.subarray(dataStart, dataEnd);

      if (method === 0) {
        const actual = compressedSize;
        if (actual !== uncompressedSize) return violation('size-mismatch');
        actualSum += actual;
        entries.push({ name, bytes: actual });
      } else {
        const remaining = maxDecompressedBytes - actualSum;
        let out: Buffer;
        try {
          out = inflateRawSync(data, { maxOutputLength: Math.max(1, remaining) });
        } catch (err) {
          if (err instanceof RangeError && (err as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
            return violation('decompressed-bytes');
          }
          return violation('malformed');
        }
        if (out.length > remaining) return violation('decompressed-bytes');
        if (out.length !== uncompressedSize) return violation('size-mismatch');
        actualSum += out.length;
        entries.push({ name, bytes: out.length });
      }
    }

    return { kind: 'ok', entries, decompressedBytes: actualSum };
  } catch {
    return violation('malformed');
  }
}

export function inspectGzipArchive(bytes: Uint8Array, maxDecompressedBytes: number, entryName: string): ArchiveInspection {
  try {
    const buf = toBuffer(bytes);
    if (buf.length < 18 || buf[0] !== 0x1f || buf[1] !== 0x8b) return violation('malformed');

    let out: Buffer;
    try {
      out = gunzipSync(buf, { maxOutputLength: Math.max(1, maxDecompressedBytes) });
    } catch (err) {
      if (err instanceof RangeError && (err as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
        return violation('decompressed-bytes');
      }
      return violation('malformed');
    }
    if (out.length > maxDecompressedBytes) return violation('decompressed-bytes');

    return { kind: 'ok', entries: [{ name: entryName, bytes: out.length }], decompressedBytes: out.length };
  } catch {
    return violation('malformed');
  }
}
