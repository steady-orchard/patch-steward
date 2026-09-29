export interface LsTreeRecord {
  readonly mode: string;
  readonly type: 'blob' | 'tree' | 'commit';
  readonly id: string;
  readonly path: Uint8Array;
}

export type LsTreeReadResult =
  | { readonly ok: true; readonly records: readonly LsTreeRecord[] }
  | { readonly ok: false; readonly reason: 'malformed' | 'too-long' };

const NUL = 0;
const TAB = 9;
const LF = 10;
const LS_TREE_HEADER = /^([0-7]{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64})$/;

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b.slice();
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function latin1(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

export class LsTreeRecordReader {
  readonly #max: number;
  #pending: Uint8Array = new Uint8Array(0);
  #failure: LsTreeReadResult | null = null;

  constructor(maxRecordBytes: number) {
    if (!Number.isSafeInteger(maxRecordBytes) || maxRecordBytes < 64) {
      throw new RangeError('maxRecordBytes must be a safe integer >= 64');
    }
    this.#max = maxRecordBytes;
  }

  push(chunk: Uint8Array): LsTreeReadResult {
    if (this.#failure) return this.#failure;
    const records: LsTreeRecord[] = [];
    let start = 0;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] !== NUL) continue;
      const body = concat(this.#pending, chunk.subarray(start, i));
      this.#pending = new Uint8Array(0);
      start = i + 1;
      if (body.length > this.#max) return this.#fail('too-long');
      const record = parseLsTreeRecord(body);
      if (!record) return this.#fail('malformed');
      records.push(record);
    }
    this.#pending = concat(this.#pending, chunk.subarray(start));
    if (this.#pending.length > this.#max) return this.#fail('too-long');
    return { ok: true, records };
  }

  finish(): LsTreeReadResult {
    if (this.#failure) return this.#failure;
    if (this.#pending.length > 0) return this.#fail('malformed');
    return { ok: true, records: [] };
  }

  #fail(reason: 'malformed' | 'too-long'): LsTreeReadResult {
    this.#failure = { ok: false, reason };
    return this.#failure;
  }
}

function parseLsTreeRecord(body: Uint8Array): LsTreeRecord | null {
  const tab = body.indexOf(TAB);
  if (tab < 0 || tab === body.length - 1) return null;
  const m = LS_TREE_HEADER.exec(latin1(body.subarray(0, tab)));
  if (!m) return null;
  return { mode: m[1]!, type: m[2] as LsTreeRecord['type'], id: m[3]!, path: body.slice(tab + 1) };
}

export type CatFileBatchEvent =
  | { readonly kind: 'object'; readonly id: string; readonly type: string; readonly size: number }
  | { readonly kind: 'data'; readonly bytes: Uint8Array }
  | { readonly kind: 'end-object' }
  | { readonly kind: 'missing'; readonly id: string };

export type CatFileBatchPush = { readonly ok: true; readonly events: readonly CatFileBatchEvent[] } | { readonly ok: false };

const MAX_HEADER = 256;
const OBJECT_HEADER = /^([0-9a-f]{40}|[0-9a-f]{64}) ([a-z]+) ([0-9]+)$/;
const MISSING_HEADER = /^([0-9a-f]{40}|[0-9a-f]{64}) missing$/;

export class CatFileBatchParser {
  #state: 'header' | 'content' | 'trailer' = 'header';
  #header: Uint8Array = new Uint8Array(0);
  #remaining = 0;
  #failed = false;

  push(chunk: Uint8Array): CatFileBatchPush {
    if (this.#failed) return { ok: false };
    const events: CatFileBatchEvent[] = [];
    let i = 0;
    while (i < chunk.length) {
      if (this.#state === 'header') {
        const lf = chunk.indexOf(LF, i);
        const end = lf < 0 ? chunk.length : lf;
        this.#header = concat(this.#header, chunk.subarray(i, end));
        if (this.#header.length > MAX_HEADER) return this.#fail();
        if (lf < 0) break;
        i = lf + 1;
        const line = latin1(this.#header);
        this.#header = new Uint8Array(0);
        const miss = MISSING_HEADER.exec(line);
        if (miss) {
          events.push({ kind: 'missing', id: miss[1]! });
          continue;
        }
        const m = OBJECT_HEADER.exec(line);
        const size = m ? Number(m[3]) : NaN;
        if (!m || !Number.isSafeInteger(size)) return this.#fail();
        events.push({ kind: 'object', id: m[1]!, type: m[2]!, size });
        this.#remaining = size;
        this.#state = size === 0 ? 'trailer' : 'content';
      } else if (this.#state === 'content') {
        const take = Math.min(this.#remaining, chunk.length - i);
        events.push({ kind: 'data', bytes: chunk.slice(i, i + take) });
        i += take;
        this.#remaining -= take;
        if (this.#remaining === 0) this.#state = 'trailer';
      } else {
        if (chunk[i] !== LF) return this.#fail();
        i++;
        events.push({ kind: 'end-object' });
        this.#state = 'header';
      }
    }
    return { ok: true, events };
  }

  finish(): boolean {
    return !this.#failed && this.#state === 'header' && this.#header.length === 0;
  }

  #fail(): CatFileBatchPush {
    this.#failed = true;
    return { ok: false };
  }
}

export interface CommitObjectFields {
  readonly tree: string;
  readonly committerTime: number;
}

export function commitObjectFields(bytes: Uint8Array): CommitObjectFields | null {
  const text = new TextDecoder('utf-8').decode(bytes);
  const blank = text.indexOf('\n\n');
  const lines = (blank < 0 ? text : text.slice(0, blank)).split('\n');
  const tree = /^tree ([0-9a-f]{40}|[0-9a-f]{64})$/.exec(lines[0] ?? '');
  if (!tree) return null;
  const committer = lines.find((l) => l.startsWith('committer '));
  const m = committer === undefined ? null : / ([0-9]+) [+-][0-9]{4}$/.exec(committer);
  if (!m) return null;
  const committerTime = Number(m[1]);
  if (!Number.isSafeInteger(committerTime) || committerTime > 8589934591) return null;
  return { tree: tree[1]!, committerTime };
}
