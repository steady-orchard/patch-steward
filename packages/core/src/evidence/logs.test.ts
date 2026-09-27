import { describe, expect, it } from 'vitest';
import { renderLogText, truncateLogText } from './logs.js';

describe('logs', () => {
  it('log text joins escaped lines with LF and ends with one LF', () => {
    expect(renderLogText(['a', 'b\nc', 'd\u0007'])).toBe('a\nb\\nc\nd\\u{0007}\n');
    expect(renderLogText([])).toBe('');
  });

  it('log truncation keeps head and tail around a marker line', () => {
    const lines = Array.from({ length: 1000 }, (_, i) => 'line-' + String(i + 1).padStart(5, '0'));
    const text = lines.join('\n');
    const result = truncateLogText(text, 1000);
    expect(Buffer.byteLength(result)).toBeLessThanOrEqual(1000);
    expect(result.startsWith('line-00001\n')).toBe(true);
    expect(result.endsWith('line-01000')).toBe(true);
    const matches = [...result.matchAll(/\n\[truncated (\d+) bytes\]\n/g)];
    expect(matches.length).toBe(1);
    const n = Number(matches[0]?.[1]);
    const marker = '\n[truncated ' + n + ' bytes]\n';
    expect(n).toBe(Buffer.byteLength(text) - (Buffer.byteLength(result) - Buffer.byteLength(marker)));
    expect(n).toBe(10024);
    expect(Buffer.byteLength(result)).toBe(1000);
  });

  it('log truncation never splits a UTF-8 character', () => {
    const text = '€'.repeat(1000) + '😀'.repeat(500);
    for (const limit of [777, 1001]) {
      const result = truncateLogText(text, limit);
      expect(Buffer.from(result, 'utf8').toString('utf8')).toBe(result);
      expect(result.includes('�')).toBe(false);
    }
  });

  it('logs within the limit are unchanged', () => {
    expect(truncateLogText('abc\n', 4)).toBe('abc\n');
  });

  it('a limit smaller than the marker yields an empty log', () => {
    expect(truncateLogText('x'.repeat(100), 10)).toBe('');
  });
});
