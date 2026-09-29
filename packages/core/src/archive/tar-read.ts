import { CHECKOUT_PATH_MAX_BYTES } from '../policy/bounds.js';
import { err, ok, type Result } from '../result.js';
import { TAR_BLOCK_BYTES, decodeTarOctal, tarHeaderChecksum } from './tar.js';

export type TarEntryKind = 'file' | 'directory' | 'symlink' | 'other';

export interface TarEntryInfo {
  readonly path: string;
  readonly kind: TarEntryKind;
  readonly typeflag: string;
  readonly size: number;
  readonly mode: number;
  readonly linkTarget: string | null;
}

export type TarStreamEvent =
  | { readonly kind: 'entry'; readonly entry: TarEntryInfo }
  | { readonly kind: 'data'; readonly bytes: Uint8Array }
  | { readonly kind: 'end' };

export type TarStreamFailureCode = 'archive.tar-invalid';

const PAX_MAX_BYTES = 16 * CHECKOUT_PATH_MAX_BYTES;

interface PaxOverrides {
  path?: string;
  linkpath?: string;
  size?: number;
}

type State = 'header' | 'pax' | 'data' | 'skip' | 'ended';

function fail(): Result<never, TarStreamFailureCode> {
  return err('archive.tar-invalid', 'environment-unavailable', 'The tar stream is invalid.');
}

function isZero(bytes: Uint8Array): boolean {
  for (const b of bytes) if (b !== 0) return false;
  return true;
}

function cString(block: Uint8Array, offset: number, length: number): Uint8Array {
  const field = block.subarray(offset, offset + length);
  const nul = field.indexOf(0);
  return nul < 0 ? field : field.subarray(0, nul);
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function matches(block: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((b, i) => block[offset + i] === b);
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

const USTAR_MAGIC = [0x75, 0x73, 0x74, 0x61, 0x72, 0x00, 0x30, 0x30];
const GNU_MAGIC = [0x75, 0x73, 0x74, 0x61, 0x72, 0x20, 0x20, 0x00];

function parsePax(data: Uint8Array): PaxOverrides | null {
  const out: PaxOverrides = {};
  let pos = 0;
  while (pos < data.length) {
    let i = pos;
    let len = 0;
    while (i < data.length && (data[i] as number) >= 0x30 && (data[i] as number) <= 0x39) {
      len = len * 10 + ((data[i] as number) - 0x30);
      if (len > PAX_MAX_BYTES) return null;
      i++;
    }
    if (i === pos || data[i] !== 0x20) return null;
    const end = pos + len;
    if (len < i - pos + 4 || end > data.length || data[end - 1] !== 0x0a) return null;
    const body = data.subarray(i + 1, end - 1);
    const eq = body.indexOf(0x3d);
    if (eq <= 0) return null;
    try {
      const key = decode(body.subarray(0, eq));
      const rawValue = body.subarray(eq + 1);
      if (key === 'path') out.path = decode(rawValue);
      else if (key === 'linkpath') out.linkpath = decode(rawValue);
      else if (key === 'size') {
        const text = decode(rawValue);
        if (!/^\d+$/.test(text)) return null;
        const n = Number(text);
        if (!Number.isSafeInteger(n)) return null;
        out.size = n;
      }
    } catch {
      return null;
    }
    pos = end;
  }
  return out;
}

export class TarStreamParser {
  private failed = false;
  private state: State = 'header';
  private readonly header = new Uint8Array(TAR_BLOCK_BYTES);
  private headerFill = 0;
  private sawZeroBlock = false;
  private remaining = 0;
  private padding = 0;
  private emitData = false;
  private paxChunks: Uint8Array[] = [];
  private paxIsLocal = false;
  private pending: PaxOverrides | null = null;

  push(chunk: Uint8Array): Result<readonly TarStreamEvent[], TarStreamFailureCode> {
    if (this.failed) return fail();
    const events: TarStreamEvent[] = [];
    if (!this.consume(chunk, events)) {
      this.failed = true;
      return fail();
    }
    return ok(events);
  }

  finish(): Result<void, TarStreamFailureCode> {
    if (this.failed) return fail();
    if (this.state !== 'ended') {
      this.failed = true;
      return fail();
    }
    return ok(undefined);
  }

  private consume(chunk: Uint8Array, events: TarStreamEvent[]): boolean {
    let pos = 0;
    while (pos < chunk.length) {
      if (this.state === 'ended') return isZero(chunk.subarray(pos));
      if (this.state === 'header') {
        const take = Math.min(TAR_BLOCK_BYTES - this.headerFill, chunk.length - pos);
        this.header.set(chunk.subarray(pos, pos + take), this.headerFill);
        this.headerFill += take;
        pos += take;
        if (this.headerFill < TAR_BLOCK_BYTES) continue;
        this.headerFill = 0;
        if (!this.onHeader(events)) return false;
      } else if (this.state === 'pax') {
        const take = Math.min(this.remaining, chunk.length - pos);
        this.paxChunks.push(chunk.slice(pos, pos + take));
        this.remaining -= take;
        pos += take;
        if (this.remaining === 0 && !this.finishPax()) return false;
      } else if (this.state === 'data') {
        const take = Math.min(this.remaining, chunk.length - pos);
        if (this.emitData) events.push({ kind: 'data', bytes: chunk.slice(pos, pos + take) });
        this.remaining -= take;
        pos += take;
        if (this.remaining === 0) this.afterBody();
      } else {
        const take = Math.min(this.remaining, chunk.length - pos);
        this.remaining -= take;
        pos += take;
        if (this.remaining === 0) this.state = 'header';
      }
    }
    return true;
  }

  private afterBody(): void {
    if (this.padding > 0) {
      this.state = 'skip';
      this.remaining = this.padding;
    } else {
      this.state = 'header';
    }
  }

  private finishPax(): boolean {
    const data = concat(this.paxChunks);
    this.paxChunks = [];
    if (this.paxIsLocal) {
      const parsed = parsePax(data);
      if (parsed === null) return false;
      this.pending = { ...(this.pending ?? {}), ...parsed };
    }
    this.afterBody();
    return true;
  }

  private onHeader(events: TarStreamEvent[]): boolean {
    const block = this.header;
    if (isZero(block)) {
      if (this.pending !== null) return false;
      if (!this.sawZeroBlock) {
        this.sawZeroBlock = true;
        return true;
      }
      this.state = 'ended';
      events.push({ kind: 'end' });
      return true;
    }
    if (this.sawZeroBlock) return false;

    const stored = decodeTarOctal(block.subarray(148, 156));
    if (stored === null || stored !== tarHeaderChecksum(block)) return false;
    if (!matches(block, 257, USTAR_MAGIC) && !matches(block, 257, GNU_MAGIC)) return false;
    const headerSize = decodeTarOctal(block.subarray(124, 136));
    const mode = decodeTarOctal(block.subarray(100, 108));
    if (headerSize === null || mode === null || !Number.isSafeInteger(headerSize)) return false;

    const flagByte = block[156] as number;
    const typeflag = flagByte === 0 ? '0' : String.fromCharCode(flagByte);

    if (typeflag === 'x' || typeflag === 'g') {
      if (headerSize > PAX_MAX_BYTES) return false;
      this.paxIsLocal = typeflag === 'x';
      this.remaining = headerSize;
      this.padding = (TAR_BLOCK_BYTES - (headerSize % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES;
      this.paxChunks = [];
      if (headerSize === 0) return this.finishPax();
      this.state = 'pax';
      return true;
    }

    const overrides = this.pending ?? {};
    this.pending = null;
    const size = overrides.size ?? headerSize;
    const kind: TarEntryKind = typeflag === '0' ? 'file' : typeflag === '5' ? 'directory' : typeflag === '2' ? 'symlink' : 'other';

    let path: string;
    let linkTarget: string | null = null;
    try {
      if (overrides.path !== undefined) {
        path = overrides.path;
      } else {
        const prefix = cString(block, 345, 155);
        const name = decode(cString(block, 0, 100));
        path = prefix.length > 0 ? `${decode(prefix)}/${name}` : name;
      }
      if (kind === 'symlink' || kind === 'other') {
        const linkname = cString(block, 157, 100);
        if (overrides.linkpath !== undefined) linkTarget = overrides.linkpath;
        else if (linkname.length > 0) linkTarget = decode(linkname);
      }
    } catch {
      return false;
    }
    path = path.replace(/\/+$/, '');

    events.push({ kind: 'entry', entry: { path, kind, typeflag, size, mode: mode & 0o7777, linkTarget } });
    this.emitData = kind === 'file';
    this.remaining = size;
    this.padding = (TAR_BLOCK_BYTES - (size % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES;
    this.state = size === 0 ? 'header' : 'data';
    return true;
  }
}

export type SingleTarFileRead =
  | { readonly kind: 'file'; readonly bytes: Uint8Array }
  | { readonly kind: 'not-regular'; readonly entryKind: TarEntryKind }
  | { readonly kind: 'too-large'; readonly declaredBytes: number }
  | { readonly kind: 'invalid' };

export class TarSingleFileReader {
  private readonly parser = new TarStreamParser();
  private outcome: SingleTarFileRead | null = null;
  private sawEntry = false;
  private chunks: Uint8Array[] = [];

  constructor(private readonly maxBytes: number) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError('maxBytes must be a safe integer >= 0');
  }

  push(chunk: Uint8Array): 'continue' | 'done' {
    if (this.outcome !== null) return 'done';
    const result = this.parser.push(chunk);
    if (!result.ok) return this.settle({ kind: 'invalid' });
    for (const event of result.value) {
      if (event.kind === 'entry') {
        if (this.sawEntry) return this.settle({ kind: 'invalid' });
        this.sawEntry = true;
        if (event.entry.kind !== 'file') return this.settle({ kind: 'not-regular', entryKind: event.entry.kind });
        if (event.entry.size > this.maxBytes) return this.settle({ kind: 'too-large', declaredBytes: event.entry.size });
      } else if (event.kind === 'data') {
        this.chunks.push(event.bytes);
      } else {
        if (!this.sawEntry) return this.settle({ kind: 'invalid' });
        return this.settle({ kind: 'file', bytes: concat(this.chunks) });
      }
    }
    return 'continue';
  }

  finish(): SingleTarFileRead {
    if (this.outcome !== null) return this.outcome;
    this.parser.finish();
    this.settle({ kind: 'invalid' });
    return { kind: 'invalid' };
  }

  private settle(outcome: SingleTarFileRead): 'done' {
    this.outcome = outcome;
    this.chunks = [];
    return 'done';
  }
}
