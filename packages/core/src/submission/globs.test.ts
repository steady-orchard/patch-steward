import { describe, expect, it } from 'vitest';
import { matchesAnyGlob, matchesGlob } from './globs.js';

type Row = [pattern: string, path: string, expected: boolean];

function runRows(rows: readonly Row[]): void {
  for (const [pattern, path, expected] of rows) {
    expect(matchesGlob(pattern, path)).toBe(expected);
  }
}

describe('matchesGlob', () => {
  it('glob rule: a pattern without a slash matches the last segment at any depth', () => {
    runRows([
      ['README', 'README', true],
      ['README', 'docs/README', true],
      ['README', 'README.md', false],
      ['*.md', 'a/b/c.md', true],
      ['*.md', 'a.md/b', false],
      ['tsconfig*.json', 'packages/core/tsconfig.test.json', true],
    ]);
  });

  it('glob rule: a pattern with a slash is anchored at the repository root', () => {
    runRows([
      ['docs/**', 'docs/a.md', true],
      ['docs/**', 'docs/a/b.md', true],
      ['docs/**', 'sub/docs/a.md', false],
      ['.config/nextest.toml', '.config/nextest.toml', true],
      ['.config/nextest.toml', 'a/.config/nextest.toml', false],
    ]);
  });

  it('glob rule: a double star segment matches zero or more segments', () => {
    runRows([
      ['**/test/**', 'test/a.ts', true],
      ['**/test/**', 'src/test/a.ts', true],
      ['**/test/**', 'src/tests/a.ts', false],
      ['docs/**', 'docs', true],
      ['a/**/b', 'a/b', true],
      ['a/**/b', 'a/x/y/b', true],
      ['a/**/b', 'a/x/y/c', false],
      ['**/.*/**', 'src/.cache/x', true],
      ['**/.*/**', 'src/a.ts', false],
    ]);
  });

  it('glob rule: a star matches a leading dot and never a slash', () => {
    runRows([
      ['*', '.env', true],
      ['.*', '.env', true],
      ['*.yml', '.gitlab-ci.yml', true],
      ['src/*', 'src/a/b', false],
      ['src/*.ts', 'src/a.ts', true],
      ['a**b', 'axyb', true],
      ['src/a**b', 'src/a/b', false],
    ]);
  });

  it('glob rule: a question mark matches one character except a slash', () => {
    runRows([
      ['?.md', 'a.md', true],
      ['?.md', 'ab.md', false],
      ['src/a?b', 'src/a/b', false],
      ['src/a?b', 'src/axb', true],
    ]);
  });

  it('glob rule: brackets, braces, and exclamation marks are literal', () => {
    runRows([
      ['[ab].md', '[ab].md', true],
      ['[ab].md', 'a.md', false],
      ['{a,b}.md', '{a,b}.md', true],
      ['{a,b}.md', 'a.md', false],
      ['!a.md', '!a.md', true],
      ['!a.md', 'b.md', false],
    ]);
  });

  it('glob rule: matching is case-sensitive', () => {
    runRows([
      ['README', 'readme', false],
      ['Makefile', 'makefile', false],
      ['Docs/**', 'docs/a.md', false],
    ]);
  });

  it('glob matcher stays linear on adversarial input', () => {
    const start1 = performance.now();
    expect(matchesGlob('*a'.repeat(64) + '*b', 'a'.repeat(4096))).toBe(false);
    expect(performance.now() - start1).toBeLessThan(1000);

    const start2 = performance.now();
    expect(matchesGlob('**/a/'.repeat(30) + 'b', 'a/'.repeat(2000) + 'c')).toBe(false);
    expect(performance.now() - start2).toBeLessThan(1000);
  });
});

describe('matchesAnyGlob', () => {
  it('matchesAnyGlob matches when any pattern matches', () => {
    expect(matchesAnyGlob(['*.md', 'docs/**'], 'docs/x.txt')).toBe(true);
    expect(matchesAnyGlob(['*.md', 'docs/**'], 'x.txt')).toBe(false);
    expect(matchesAnyGlob([], 'x.txt')).toBe(false);
  });
});
