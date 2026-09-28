import { crc32, inflateRawSync } from 'node:zlib';
import { inspectZipArchive } from './archive.js';
import type { ArchiveViolationReason } from './archive.js';

export const ZIP_ENTRY_VIOLATION_REASONS = ['archive-bytes', 'archive', 'entry-count', 'entry-name', 'crc-mismatch'] as const;

export type ZipEntryViolationReason = (typeof ZIP_ENTRY_VIOLATION_REASONS)[number];

export interface ZipEntryLimits {
  readonly entryName: string;
  readonly maxArchiveBytes: number;
  readonly maxEntryBytes: number;
}

export type ZipEntryRead =
  | { readonly kind: 'ok'; readonly bytes: Uint8Array }
  | {
      readonly kind: 'violation';
      readonly reason: ZipEntryViolationReason;
      readonly archiveReason: ArchiveViolationReason | null;
      readonly message: string;
    };

const MESSAGES: Record<ZipEntryViolationReason, string> = {
  'archive-bytes': 'The archive exceeds the allowed size.',
  archive: 'The archive failed inspection.',
  'entry-count': 'The archive must contain exactly one entry.',
  'entry-name': 'The archive entry has an unexpected name.',
  'crc-mismatch': 'The archive entry failed its checksum.',
};

function violation(reason: ZipEntryViolationReason, archiveReason: ArchiveViolationReason | null = null): ZipEntryRead {
  return { kind: 'violation', reason, archiveReason, message: MESSAGES[reason] };
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

function toBuffer(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function readSingleZipEntry(bytes: Uint8Array, limits: ZipEntryLimits): ZipEntryRead {
  if (bytes.length > limits.maxArchiveBytes) return violation('archive-bytes');

  const inspection = inspectZipArchive(bytes, limits.maxEntryBytes);
  if (inspection.kind === 'violation') return violation('archive', inspection.reason);
  if (inspection.entries.length !== 1) return violation('entry-count');
  if (inspection.entries[0]?.name !== limits.entryName) return violation('entry-name');

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
    if (eocdOffset === -1) return violation('archive', 'malformed');

    const cdOffset = buf.readUInt32LE(eocdOffset + 16);
    const p = cdOffset;
    if (buf.readUInt32LE(p) !== CENTRAL_SIGNATURE) return violation('archive', 'malformed');

    const method = buf.readUInt16LE(p + 10);
    const centralCrc = buf.readUInt32LE(p + 16);
    const compressedSize = buf.readUInt32LE(p + 20);
    const localOffset = buf.readUInt32LE(p + 42);

    if (buf.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) return violation('archive', 'malformed');
    const localNameLength = buf.readUInt16LE(localOffset + 26);
    const localExtraLength = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    const data = buf.subarray(dataStart, dataEnd);

    let output: Buffer;
    if (method === 0) {
      output = Buffer.from(data);
    } else {
      try {
        output = inflateRawSync(data, { maxOutputLength: Math.max(1, limits.maxEntryBytes) });
      } catch (err) {
        if (err instanceof RangeError && (err as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
          return violation('archive', 'decompressed-bytes');
        }
        return violation('archive', 'malformed');
      }
      if (output.length > limits.maxEntryBytes) return violation('archive', 'decompressed-bytes');
    }

    if (crc32(output) !== centralCrc) return violation('crc-mismatch');

    return { kind: 'ok', bytes: new Uint8Array(output) };
  } catch {
    return violation('archive', 'malformed');
  }
}
