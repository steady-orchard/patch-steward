import { describe, expect, it } from 'vitest';

import { canonicalJsonHash, contentHash, localFileRevisionId, sha256Hex } from './hash.js';

describe('sha256Hex', () => {
  it('hashes the empty input', () => {
    expect(sha256Hex(new Uint8Array())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('hashes the UTF-8 bytes of abc', () => {
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('contentHash and localFileRevisionId', () => {
  it('prefixes the sha256 hex digest', () => {
    const bytes = new TextEncoder().encode('abc');
    expect(contentHash(bytes)).toBe(`sha256:${sha256Hex(bytes)}`);
    expect(localFileRevisionId(bytes)).toBe(`local:${sha256Hex(bytes)}`);
  });
});

describe('canonicalJsonHash', () => {
  it('hashes the canonical form regardless of key order', () => {
    const a = canonicalJsonHash({ b: 1, a: 2 });
    const b = canonicalJsonHash({ a: 2, b: 1 });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value).toBe(b.value);
      expect(a.value).toBe(contentHash(new TextEncoder().encode('{"a":2,"b":1}')));
    }
  });

  it('passes through canonicalJson failures', () => {
    const result = canonicalJsonHash({ a: NaN });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('canonical-json.non-finite-number');
    }
  });
});

describe('localFileRevisionId', () => {
  it('differs by raw byte content', () => {
    const lf = localFileRevisionId(new TextEncoder().encode('x\n'));
    const crlf = localFileRevisionId(new TextEncoder().encode('x\r\n'));
    expect(lf).not.toBe(crlf);
  });
});
