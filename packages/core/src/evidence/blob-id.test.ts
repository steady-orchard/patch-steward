import { describe, expect, it } from 'vitest';
import { gitBlobId } from './blob-id.js';

describe('git blob id', () => {
  it('git blob ids match git hash-object', () => {
    const empty = new Uint8Array(0);
    const hello = new Uint8Array(Buffer.from('hello' + String.fromCharCode(10)));
    const testContent = new Uint8Array(Buffer.from('test content' + String.fromCharCode(10)));

    expect(gitBlobId(empty)).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
    expect(gitBlobId(hello)).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
    expect(gitBlobId(testContent)).toBe('d670460b4b4aece5915caf5c68d12f560a9fe3e4');
  });

  it('git blob ids hash exact bytes', () => {
    const lf = new Uint8Array(Buffer.from('a' + String.fromCharCode(10)));
    const crlf = new Uint8Array(Buffer.from('a' + String.fromCharCode(13) + String.fromCharCode(10)));

    expect(gitBlobId(lf)).not.toBe(gitBlobId(crlf));

    const source = Buffer.from([1, 2, 3, 4, 5]);
    const view = new Uint8Array(source.buffer, source.byteOffset + 1, 3);
    const copy = new Uint8Array(Buffer.from(view));

    expect(gitBlobId(view)).toBe(gitBlobId(copy));
  });
});
