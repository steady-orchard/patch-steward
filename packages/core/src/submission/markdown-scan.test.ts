import { describe, expect, it } from 'vitest';
import { findMarkdownHeadings, scanMarkdownLines } from './markdown-scan.js';

function ctx(s: string): string {
  return scanMarkdownLines(s)
    .map((l) => l.context[0])
    .join('');
}

describe('markdown-scan', () => {
  it('markdown scan: backtick and tilde fences hide their lines', () => {
    expect(ctx('a\n```\n### x\n```\nb')).toBe('tffft');
    expect(ctx('   ```\n### x\n```')).toBe('fff');
    expect(ctx('    ```\n### x')).toBe('tt');
    expect(ctx('```js `x`\n### h')).toBe('tt');
  });

  it('markdown scan: a fence closes only with the same character and at least the same length', () => {
    expect(ctx('a\n~~~~\n```\n~~~\n~~~~\nb')).toBe('tfffft');
    expect(ctx('```\n### x\n````\ny')).toBe('ffft');
    expect(ctx('````\n```\ny')).toBe('fff');
    expect(ctx('```\n``` x\ny')).toBe('fff');
  });

  it('markdown scan: an unclosed fence runs to the end', () => {
    expect(ctx('a\n```\nb')).toBe('tff');
  });

  it('markdown scan: HTML comments hide lines until they close', () => {
    expect(ctx('a\n<!-- x\n### y\n-->\nb')).toBe('ttcct');
    expect(ctx('a <!-- x --> b\n<!-- y --> <!-- z\nc -->\nd')).toBe('ttct');
  });

  it('markdown scan: headings need the exact hash count and a space', () => {
    expect(findMarkdownHeadings(scanMarkdownLines('### a\n#### b\n###c\n ### d\n##  e \n### \n###\tf'), 3)).toEqual([
      { lineIndex: 0, text: 'a' },
      { lineIndex: 5, text: '' },
    ]);
    expect(findMarkdownHeadings(scanMarkdownLines('## a\n### b\n# c\n##  d  '), 2)).toEqual([
      { lineIndex: 0, text: 'a' },
      { lineIndex: 3, text: 'd' },
    ]);
    expect(findMarkdownHeadings(scanMarkdownLines('x\n```\n### in fence\n```\n<!--\n### in comment\n-->\n### out'), 3)).toEqual([
      { lineIndex: 7, text: 'out' },
    ]);
  });

  it('markdown scan: line terminators are preserved', () => {
    expect(scanMarkdownLines('a\r\nb\nc\rd').map((l) => [l.text, l.terminator])).toEqual([
      ['a', '\r\n'],
      ['b', '\n'],
      ['c', '\r'],
      ['d', ''],
    ]);
    expect(scanMarkdownLines('').length).toBe(0);
    expect(scanMarkdownLines('a\n').length).toBe(1);
  });

  it('markdown scan: large input stays linear', () => {
    const lines: string[] = [];
    for (let i = 0; i < 60000; i += 1) {
      lines.push(i % 2 === 0 ? '<!--' : '```');
    }
    const source = lines.join('\n');
    const start = performance.now();
    scanMarkdownLines(source);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});
