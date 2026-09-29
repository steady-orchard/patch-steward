import { describe, expect, it } from 'vitest';
import { CatFileBatchParser, commitObjectFields, LsTreeRecordReader } from './object-stream.js';
import type { CatFileBatchEvent, LsTreeRecord } from './object-stream.js';

const NUL = String.fromCharCode(0);
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const bytes = (text: string): Uint8Array => Buffer.from(text, 'utf8');
const ID_A = 'ef0493b275aa2080237f676d2ef6559246f56636';
const ID_B = '0123456789abcdef0123456789abcdef01234567';

function feedBytewise(reader: LsTreeRecordReader, data: Uint8Array): LsTreeRecord[] {
  const out: LsTreeRecord[] = [];
  for (const b of data) {
    const r = reader.push(Uint8Array.from([b]));
    if (!r.ok) throw new Error(r.reason);
    out.push(...r.records);
  }
  return out;
}

const record = (mode: string, type: string, id: string, path: string): string => `${mode} ${type} ${id}${TAB}${path}${NUL}`;

describe('ls-tree records', () => {
  it('reads ls-tree records across chunk boundaries', () => {
    const reader = new LsTreeRecordReader(4096);
    const got = feedBytewise(reader, bytes(record('100644', 'blob', ID_A, 'a.txt') + record('040000', 'tree', ID_B, 'dir')));
    expect(got.map((r) => ({ ...r, path: Buffer.from(r.path).toString('utf8') }))).toEqual([
      { mode: '100644', type: 'blob', id: ID_A, path: 'a.txt' },
      { mode: '040000', type: 'tree', id: ID_B, path: 'dir' },
    ]);
    expect(reader.finish()).toEqual({ ok: true, records: [] });
  });

  it('keeps raw path bytes', () => {
    const head = bytes(`100644 blob ${ID_A}${TAB}`);
    const data = Uint8Array.from([...head, 0x61, 0xff, 0x62, 0]);
    const r = new LsTreeRecordReader(4096).push(data);
    expect(r.ok && Array.from(r.records[0]!.path)).toEqual([0x61, 0xff, 0x62]);
  });

  it('rejects malformed ls-tree records', () => {
    const bad = [
      record('10064', 'blob', ID_A, 'a'),
      record('100644', 'blobx', ID_A, 'a'),
      record('100644', 'blob', ID_A.slice(1), 'a'),
      `100644 blob ${ID_A} a${NUL}`,
      record('100644', 'blob', ID_A, ''),
    ];
    for (const text of bad) {
      expect(new LsTreeRecordReader(4096).push(bytes(text))).toEqual({ ok: false, reason: 'malformed' });
    }
  });

  it('rejects an ls-tree record that is too long', () => {
    const reader = new LsTreeRecordReader(64);
    const first = reader.push(bytes(record('100644', 'blob', ID_A, 'x'.repeat(100))));
    expect(first).toEqual({ ok: false, reason: 'too-long' });
    expect(reader.push(bytes('more'))).toEqual(first);
  });

  it('requires ls-tree output to end with a record', () => {
    const reader = new LsTreeRecordReader(4096);
    reader.push(bytes(`100644 blob ${ID_A}${TAB}a.txt`));
    expect(reader.finish()).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('cat-file batch output', () => {
  it('parses cat-file batch objects across chunks', () => {
    const parser = new CatFileBatchParser();
    const events: CatFileBatchEvent[] = [];
    for (const b of bytes(`${ID_A} blob 5${LF}hello${LF}${ID_B} blob 0${LF}${LF}`)) {
      const r = parser.push(Uint8Array.from([b]));
      if (!r.ok) throw new Error('failed');
      events.push(...r.events);
    }
    const kinds = events.map((e) => e.kind);
    expect(kinds[0]).toBe('object');
    expect(kinds.slice(-3)).toEqual(['end-object', 'object', 'end-object']);
    expect(events.find((e) => e.kind === 'object' && e.id === ID_B)).toEqual({ kind: 'object', id: ID_B, type: 'blob', size: 0 });
    const data = events.flatMap((e) => (e.kind === 'data' ? [Buffer.from(e.bytes).toString('utf8')] : []));
    expect(data.join('')).toBe('hello');
    expect(parser.finish()).toBe(true);
  });

  it('reports missing batch objects', () => {
    const r = new CatFileBatchParser().push(bytes(`${ID_A} missing${LF}`));
    expect(r).toEqual({ ok: true, events: [{ kind: 'missing', id: ID_A }] });
  });

  it('rejects malformed batch output', () => {
    for (const text of [`${ID_A} blob x${LF}`, `${ID_A} blob 1${LF}aX`, 'a'.repeat(300)]) {
      const parser = new CatFileBatchParser();
      expect(parser.push(bytes(text))).toEqual({ ok: false });
      expect(parser.finish()).toBe(false);
    }
  });

  it('requires batch output to end between objects', () => {
    const parser = new CatFileBatchParser();
    parser.push(bytes(`${ID_A} blob 4${LF}he`));
    expect(parser.finish()).toBe(false);
  });
});

describe('commit object fields', () => {
  it('reads the tree and committer time of a commit', () => {
    const text =
      `tree ${ID_A}${LF}parent ${ID_B}${LF}author A <a@example.com> 1600000000 +0200${LF}` +
      `committer C <c@example.com> 1700000000 -0500${LF}${LF}message${LF}`;
    expect(commitObjectFields(bytes(text))).toEqual({ tree: ID_A, committerTime: 1700000000 });
  });

  it('rejects commits without a tree or committer time', () => {
    expect(commitObjectFields(bytes(`committer C <c@example.com> 1700000000 -0500${LF}${LF}m`))).toBeNull();
    expect(commitObjectFields(bytes(`tree ${ID_A}${LF}committer C <c@example.com>${LF}${LF}m`))).toBeNull();
  });
});
