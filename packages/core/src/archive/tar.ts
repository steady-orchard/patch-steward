import { SANDBOX_GID, SANDBOX_UID } from '../policy/bounds.js';

export const TAR_BLOCK_BYTES = 512;

export type TarEntryType = 'file' | 'directory' | 'symlink';

export interface TarHeaderInput {
  readonly path: string;
  readonly type: TarEntryType;
  readonly mode: number;
  readonly size: number;
  readonly mtime: number;
  readonly linkTarget?: string;
}

export interface TarArchiveEntry {
  readonly path: string;
  readonly type: TarEntryType;
  readonly mode: number;
  readonly mtime: number;
  readonly content?: Uint8Array;
  readonly linkTarget?: string;
}

const MAX_TIME_OR_SIZE = 8589934591;

function validatePath(path: string): void {
  if (path.length === 0) throw new TypeError('path must be non-empty');
  if (path.startsWith('/')) throw new TypeError('path must not have a leading slash');
  if (path.endsWith('/')) throw new TypeError('path must not have a trailing slash');
  if (path.includes('\u0000')) throw new TypeError('path must not contain a NUL character');
}

function validateTarHeaderInput(input: TarHeaderInput): void {
  validatePath(input.path);
  if (!Number.isInteger(input.mode) || input.mode < 0 || input.mode > 0o7777) {
    throw new RangeError('mode must be an integer between 0 and 0o7777');
  }
  if (!Number.isInteger(input.mtime) || input.mtime < 0 || input.mtime > MAX_TIME_OR_SIZE) {
    throw new RangeError('mtime must be an integer between 0 and 8589934591');
  }
  if (!Number.isInteger(input.size) || input.size < 0 || input.size > MAX_TIME_OR_SIZE) {
    throw new RangeError('size must be an integer between 0 and 8589934591');
  }
  if ((input.type === 'directory' || input.type === 'symlink') && input.size !== 0) {
    throw new RangeError('size must be 0 for a directory or symlink');
  }
  if (input.type === 'symlink') {
    if (input.linkTarget === undefined || input.linkTarget.length === 0) {
      throw new TypeError('symlink requires a non-empty linkTarget');
    }
    if (input.linkTarget.includes('\u0000')) throw new TypeError('linkTarget must not contain a NUL character');
  } else if (input.linkTarget !== undefined) {
    throw new TypeError('linkTarget is only valid for a symlink');
  }
}

function asciiBytes(value: string): Uint8Array | null {
  const bytes = new TextEncoder().encode(value);
  for (const b of bytes) if (b >= 0x80) return null;
  return bytes;
}

interface UstarNameSplit {
  readonly name: string;
  readonly prefix: string;
}

function splitUstarName(path: string): UstarNameSplit | null {
  const bytes = asciiBytes(path);
  if (bytes === null) return null;
  const len = bytes.length;
  if (len <= 100) return { name: path, prefix: '' };
  const start = Math.max(1, len - 101);
  for (let j = start; j <= len - 2; j++) {
    if (bytes[j] !== 0x2f) continue;
    const prefixLen = j;
    const nameLen = len - j - 1;
    if (prefixLen <= 155 && nameLen >= 1 && nameLen <= 100) {
      return { prefix: path.slice(0, j), name: path.slice(j + 1) };
    }
  }
  return null;
}

function linkTargetFits(target: string): boolean {
  const bytes = asciiBytes(target);
  return bytes !== null && bytes.length <= 100;
}

function paxRecordLength(key: string, value: string): number {
  const body = ` ${key}=${value}`;
  const base = new TextEncoder().encode(body).length + 1;
  let n = base + 1;
  while (base + String(n).length !== n) {
    n = base + String(n).length;
  }
  return n;
}

function paxRecord(key: string, value: string): string {
  const n = paxRecordLength(key, value);
  return `${n} ${key}=${value}\n`;
}

function concatUint8Arrays(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function writeAsciiField(block: Uint8Array, offset: number, maxLen: number, value: string): void {
  const bytes = new TextEncoder().encode(value);
  const count = Math.min(bytes.length, maxLen);
  for (let i = 0; i < count; i++) block[offset + i] = bytes[i] as number;
}

function writeOctalField(block: Uint8Array, offset: number, width: number, value: number): void {
  const digits = width - 1;
  const octal = value.toString(8).padStart(digits, '0');
  for (let i = 0; i < digits; i++) block[offset + i] = octal.charCodeAt(i);
  block[offset + digits] = 0;
}

function writeChecksumField(block: Uint8Array, offset: number, value: number): void {
  const octal = value.toString(8).padStart(6, '0');
  for (let i = 0; i < 6; i++) block[offset + i] = octal.charCodeAt(i);
  block[offset + 6] = 0;
  block[offset + 7] = 0x20;
}

export function tarHeaderChecksum(block: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < TAR_BLOCK_BYTES; i++) {
    sum += i >= 148 && i < 156 ? 0x20 : (block[i] ?? 0);
  }
  return sum;
}

export function decodeTarOctal(field: Uint8Array): number | null {
  if (field.length > 0 && ((field[0] as number) & 0x80) !== 0) return null;
  let i = 0;
  while (i < field.length && field[i] === 0x20) i++;
  let value = 0;
  for (; i < field.length; i++) {
    const b = field[i] as number;
    if (b === 0x00 || b === 0x20) break;
    if (b < 0x30 || b > 0x37) return null;
    value = value * 8 + (b - 0x30);
  }
  return value;
}

interface UstarBlockFields {
  readonly name: string;
  readonly prefix: string;
  readonly mode: number;
  readonly uid: number;
  readonly gid: number;
  readonly size: number;
  readonly mtime: number;
  readonly typeflag: string;
  readonly linkname: string;
}

function buildUstarBlock(fields: UstarBlockFields): Uint8Array {
  const block = new Uint8Array(TAR_BLOCK_BYTES);
  writeAsciiField(block, 0, 100, fields.name);
  writeOctalField(block, 100, 8, fields.mode);
  writeOctalField(block, 108, 8, fields.uid);
  writeOctalField(block, 116, 8, fields.gid);
  writeOctalField(block, 124, 12, fields.size);
  writeOctalField(block, 136, 12, fields.mtime);
  block[156] = fields.typeflag.charCodeAt(0);
  writeAsciiField(block, 157, 100, fields.linkname);
  writeAsciiField(block, 257, 6, 'ustar\u0000');
  writeAsciiField(block, 263, 2, '00');
  writeAsciiField(block, 329, 8, '0000000\u0000');
  writeAsciiField(block, 337, 8, '0000000\u0000');
  writeAsciiField(block, 345, 155, fields.prefix);
  const checksum = tarHeaderChecksum(block);
  writeChecksumField(block, 148, checksum);
  return block;
}

export function tarPadding(size: number): Uint8Array {
  const remainder = ((TAR_BLOCK_BYTES - (size % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES) as number;
  return new Uint8Array(remainder);
}

export function tarEndOfArchive(): Uint8Array {
  return new Uint8Array(TAR_BLOCK_BYTES * 2);
}

export function tarEntryHeader(input: TarHeaderInput): Uint8Array {
  validateTarHeaderInput(input);
  const isDirectory = input.type === 'directory';
  const effectiveName = isDirectory ? `${input.path}/` : input.path;
  const typeflag = input.type === 'file' ? '0' : input.type === 'directory' ? '5' : '2';
  const nameFit = splitUstarName(effectiveName);
  const linkTarget = input.linkTarget;
  const linkFits = linkTarget !== undefined && linkTargetFits(linkTarget);

  const paxRecords: string[] = [];
  if (nameFit === null) paxRecords.push(paxRecord('path', effectiveName));
  if (linkTarget !== undefined && !linkFits) paxRecords.push(paxRecord('linkpath', linkTarget));

  const parts: Uint8Array[] = [];
  if (paxRecords.length > 0) {
    const data = new TextEncoder().encode(paxRecords.join(''));
    const paxHeader = buildUstarBlock({
      name: 'PaxHeader',
      prefix: '',
      mode: 0o644,
      uid: SANDBOX_UID,
      gid: SANDBOX_GID,
      size: data.length,
      mtime: input.mtime,
      typeflag: 'x',
      linkname: '',
    });
    parts.push(paxHeader, data, tarPadding(data.length));
  }

  const finalName = nameFit !== null ? nameFit.name : isDirectory ? 'pax-path/' : 'pax-path';
  const finalPrefix = nameFit !== null ? nameFit.prefix : '';
  const finalLinkname = linkTarget === undefined ? '' : linkFits ? linkTarget : 'pax-linkpath';

  const realHeader = buildUstarBlock({
    name: finalName,
    prefix: finalPrefix,
    mode: input.mode,
    uid: SANDBOX_UID,
    gid: SANDBOX_GID,
    size: input.size,
    mtime: input.mtime,
    typeflag,
    linkname: finalLinkname,
  });
  parts.push(realHeader);
  return concatUint8Arrays(parts);
}

export function buildTarArchive(entries: readonly TarArchiveEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const entry of entries) {
    if ((entry.type === 'directory' || entry.type === 'symlink') && entry.content !== undefined) {
      throw new TypeError('content is not allowed on a directory or symlink entry');
    }
    const size = entry.content?.length ?? 0;
    const header = tarEntryHeader({
      path: entry.path,
      type: entry.type,
      mode: entry.mode,
      size,
      mtime: entry.mtime,
      ...(entry.linkTarget !== undefined ? { linkTarget: entry.linkTarget } : {}),
    });
    parts.push(header);
    if (entry.content !== undefined) {
      parts.push(entry.content);
      parts.push(tarPadding(entry.content.length));
    }
  }
  parts.push(tarEndOfArchive());
  return concatUint8Arrays(parts);
}
