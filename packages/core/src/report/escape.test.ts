import { describe, expect, it } from 'vitest';
import {
  escapeReportValue,
  fillReportTemplate,
  reportCharacterViolations,
  reportCodeSpan,
  reportFixedTextViolations,
  reportSubjectList,
  repositoryWebUrl,
} from './escape.js';

// Format and control characters are built via String.fromCharCode to keep this source file free of raw
// control/format bytes; the runtime string still contains the intended code point.
const NUL = String.fromCharCode(0x0000);
const NEL = String.fromCharCode(0x0085);
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const RIGHT_TO_LEFT_OVERRIDE = String.fromCharCode(0x202e);
const WORD_JOINER = String.fromCharCode(0x2060);
const LEFT_TO_RIGHT_ISOLATE = String.fromCharCode(0x2066);
const BOM = String.fromCharCode(0xfeff);
const HIGH_SURROGATE = String.fromCharCode(0xd800);
const C1_APC = String.fromCharCode(0x009f);

describe('escape', () => {
  it('escaper renders derived values as code spans', () => {
    expect(reportCodeSpan('src/a.ts')).toBe('`src/a.ts`');
    expect(reportCodeSpan('@octocat #1 <img src=x onerror=alert(1)>')).toBe('`@octocat #1 <img src=x onerror=alert(1)>`');
  });

  it('escaper replaces line breaks, controls, and format characters', () => {
    const input =
      'a\nb\rc\td' +
      NUL +
      'e' +
      NEL +
      'f' +
      LINE_SEPARATOR +
      'g' +
      ZERO_WIDTH_SPACE +
      'h' +
      RIGHT_TO_LEFT_OVERRIDE +
      'i' +
      BOM +
      'j' +
      HIGH_SURROGATE +
      'k';
    const expected = 'a\\nb\\rc\\u{0009}d\\u{0000}e\\u{0085}f\\u{2028}g\\u{200B}h\\u{202E}i\\u{FEFF}j\\u{D800}k';
    expect(escapeReportValue(input)).toBe(expected);
    expect(escapeReportValue('\u{1F600}')).toBe('\u{1F600}');
  });

  it('escaper truncates derived values without splitting a surrogate pair', () => {
    expect(reportCodeSpan('x'.repeat(250))).toBe('`' + 'x'.repeat(200) + '`' + ' (truncated)');
    expect(reportCodeSpan('x'.repeat(199) + '\u{1F600}' + 'y')).toBe('`' + 'x'.repeat(199) + '`' + ' (truncated)');
    expect(reportCodeSpan('x'.repeat(200))).toBe('`' + 'x'.repeat(200) + '`');
  });

  it('escaper fences code spans longer than any backtick run', () => {
    expect(reportCodeSpan('a`b')).toBe('``a`b``');
    expect(reportCodeSpan('x``y`')).toBe('``` x``y` ```');
    expect(reportCodeSpan(' a')).toBe('`  a `');
    expect(reportCodeSpan('')).toBe('` `');
  });

  it('subject lists show at most ten values', () => {
    const values = Array.from({ length: 12 }, (_, i) => 'v' + i);
    const expected =
      values
        .slice(0, 10)
        .map((v) => '`' + v + '`')
        .join(', ') + ' and 2 more';
    expect(reportSubjectList(values)).toBe(expected);
    expect(reportSubjectList([])).toBe('none');
    expect(reportSubjectList(['#12', '#13'])).toBe('`#12`, `#13`');
  });

  it('repository URLs percent-encode path segments', () => {
    expect(repositoryWebUrl('octo/demo', ['blob', 'release', '1.x', '.github', 'pull_request_template.md'])).toBe(
      'https://github.com/octo/demo/blob/release/1.x/.github/pull_request_template.md',
    );
    expect(repositoryWebUrl('octo/demo', ['blob', 'a b#c'])).toBe('https://github.com/octo/demo/blob/a%20b%23c');
    expect(repositoryWebUrl('octo/demo', ['issues', 'new', 'choose'])).toBe('https://github.com/octo/demo/issues/new/choose');
  });

  it('template fill substitutes placeholders in one pass', () => {
    expect(fillReportTemplate('A {x} B {y}', { x: '{y}', y: 'z' })).toBe('A {y} B z');
    expect(() => fillReportTemplate('A {x}', {})).toThrow('missing report template value: x');
  });

  it('fixed text rejects mentions, issue references, markup, exclamation marks, and emoji', () => {
    expect(reportFixedTextViolations('ask @octocat')).toEqual(['mention']);
    expect(reportFixedTextViolations('see #12')).toEqual(['issue-reference']);
    expect(reportFixedTextViolations('see `#12`')).toEqual([]);
    expect(reportFixedTextViolations('a <b>')).toEqual(['html']);
    expect(reportFixedTextViolations('a < b')).toEqual([]);
    expect(reportFixedTextViolations('done!')).toEqual(['exclamation']);
    expect(reportFixedTextViolations('ok \u{1F600}')).toEqual(['emoji']);
  });

  it('escaped output contains no control or format character', () => {
    const s =
      'a\nb\rc\td' +
      NUL +
      'e' +
      NEL +
      'f' +
      LINE_SEPARATOR +
      'g' +
      ZERO_WIDTH_SPACE +
      'h' +
      RIGHT_TO_LEFT_OVERRIDE +
      'i' +
      BOM +
      'j' +
      HIGH_SURROGATE +
      'k' +
      PARAGRAPH_SEPARATOR +
      WORD_JOINER +
      LEFT_TO_RIGHT_ISOLATE +
      C1_APC;
    expect(reportCharacterViolations(reportCodeSpan(s))).toEqual([]);
    expect(reportCharacterViolations('a\tb\nc')).toEqual(['U+0009']);
  });
});
