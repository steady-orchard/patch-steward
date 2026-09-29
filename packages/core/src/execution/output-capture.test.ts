import { describe, expect, it } from 'vitest';
import { OutputCaptureBuffer, decodeCapturedBytes, outputOmittedMarker } from './output-capture.js';

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('OutputCaptureBuffer', () => {
  it('keeps a short capture whole', () => {
    const buffer = new OutputCaptureBuffer({ headBytes: 8, tailBytes: 8, streamBytes: 1000 });
    buffer.push(bytesOf('hello'));
    buffer.push(bytesOf(' world'));
    const result = buffer.result();
    expect(result.head).toEqual(bytesOf('hello world'));
    expect(result.tail.length).toBe(0);
    expect(result.totalBytes).toBe(11);
    expect(result.omittedBytes).toBe(0);
    expect(result.limited).toBe(false);
  });

  it('keeps head and tail and counts omitted bytes', () => {
    const buffer = new OutputCaptureBuffer({ headBytes: 4, tailBytes: 4, streamBytes: 1000 });
    const all = bytesOf('abcdefghijklmnop');
    for (let i = 0; i < all.length; i += 3) {
      buffer.push(all.subarray(i, i + 3));
    }
    const result = buffer.result();
    expect(result.head).toEqual(bytesOf('abcd'));
    expect(result.tail).toEqual(bytesOf('mnop'));
    expect(result.totalBytes).toBe(16);
    expect(result.omittedBytes).toBe(8);
  });

  it('stops at the stream limit', () => {
    const buffer = new OutputCaptureBuffer({ headBytes: 4, tailBytes: 4, streamBytes: 10 });
    expect(buffer.push(new Uint8Array(4))).toBe(false);
    expect(buffer.push(new Uint8Array(4))).toBe(false);
    expect(buffer.push(new Uint8Array(4))).toBe(true);
    expect(buffer.limited).toBe(true);
    expect(buffer.totalBytes).toBe(10);
    const before = buffer.result();
    expect(buffer.push(new Uint8Array(4))).toBe(true);
    const after = buffer.result();
    expect(after).toEqual(before);
  });

  it('drops bytes past the stream limit in one chunk', () => {
    const buffer = new OutputCaptureBuffer({ headBytes: 4, tailBytes: 4, streamBytes: 5 });
    expect(buffer.push(new Uint8Array(12))).toBe(true);
    expect(buffer.totalBytes).toBe(5);
  });

  it('cuts the head and tail on character boundaries', () => {
    const buffer = new OutputCaptureBuffer({ headBytes: 4, tailBytes: 4, streamBytes: 1000 });
    const euro = new Uint8Array([0xe2, 0x82, 0xac]);
    const bytes = Buffer.concat([
      Buffer.from('ab'),
      Buffer.from(euro),
      Buffer.from('cdefgh'),
      Buffer.from(euro),
      Buffer.from('ij'),
    ]);
    buffer.push(new Uint8Array(bytes));
    const result = buffer.result();
    expect(result.head).toEqual(bytesOf('ab'));
    expect(result.tail).toEqual(bytesOf('ij'));
    expect(result.omittedBytes).toBe(result.totalBytes - result.head.length - result.tail.length);
  });

  it('keeps invalid bytes for replacement decoding', () => {
    const buffer = new OutputCaptureBuffer({ headBytes: 2, tailBytes: 2, streamBytes: 100 });
    buffer.push(new Uint8Array(10).fill(0xff));
    const result = buffer.result();
    expect(result.head).toEqual(new Uint8Array([0xff, 0xff]));
    expect(result.tail).toEqual(new Uint8Array([0xff, 0xff]));
    expect(result.omittedBytes).toBe(6);
  });

  it('decodes with replacement and keeps a byte order mark', () => {
    const decoded = decodeCapturedBytes(new Uint8Array(Buffer.from([0xef, 0xbb, 0xbf, 0x61, 0xff])));
    expect(decoded).toBe(String.fromCharCode(0xfeff) + 'a' + String.fromCharCode(0xfffd));
  });

  it('formats the omitted marker', () => {
    expect(outputOmittedMarker(4294967296)).toBe('[... 4294967296 bytes omitted ...]');
  });

  it('captures nothing for empty output', () => {
    const buffer = new OutputCaptureBuffer({ headBytes: 4, tailBytes: 4, streamBytes: 1000 });
    const result = buffer.result();
    expect(result.head.length).toBe(0);
    expect(result.tail.length).toBe(0);
    expect(result.totalBytes).toBe(0);
    expect(result.omittedBytes).toBe(0);
    expect(result.limited).toBe(false);
  });

  it('rejects invalid limits', () => {
    expect(() => new OutputCaptureBuffer({ headBytes: -1, tailBytes: 4, streamBytes: 1000 })).toThrow(RangeError);
    expect(() => new OutputCaptureBuffer({ headBytes: 4.5, tailBytes: 4, streamBytes: 1000 })).toThrow(RangeError);
    expect(() => new OutputCaptureBuffer({ headBytes: 4, tailBytes: 4, streamBytes: 0 })).toThrow(RangeError);
  });

  it('keeps memory bounded for a long stream', () => {
    const buffer = new OutputCaptureBuffer({ headBytes: 1024, tailBytes: 2048, streamBytes: 50000000 });
    const chunk = new Uint8Array(65536).fill(0x61);
    while (buffer.totalBytes < 10485760) {
      buffer.push(chunk);
    }
    const result = buffer.result();
    expect(result.head.length).toBe(1024);
    expect(result.tail.length).toBe(2048);
    expect(result.totalBytes).toBe(10485760);
    expect(result.omittedBytes).toBe(10482688);
    expect(result.limited).toBe(false);
  });
});
