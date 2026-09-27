import { describe, expect, it } from 'vitest';
import { REPORT_DENYLIST, maskCodeSpans, reportDenylistMatches } from './denylist.js';

describe('denylist', () => {
  it('denylist groups hold the approved phrases', () => {
    expect(REPORT_DENYLIST.severity.length).toBe(37);
    expect(REPORT_DENYLIST.authorship.length).toBe(31);
    expect(REPORT_DENYLIST.praise.length).toBe(32);
    expect(REPORT_DENYLIST.praise).toContain('please');
    expect(Object.isFrozen(REPORT_DENYLIST)).toBe(true);
    expect(Object.isFrozen(REPORT_DENYLIST.severity)).toBe(true);
    expect(Object.isFrozen(REPORT_DENYLIST.authorship)).toBe(true);
    expect(Object.isFrozen(REPORT_DENYLIST.praise)).toBe(true);
  });

  it('denylist matches please as a whole word', () => {
    expect(reportDenylistMatches('Please add a test.')).toEqual(['please']);
    expect(reportDenylistMatches('pleased with it')).toEqual([]);
  });

  it('denylist matches every listed phrase', () => {
    const allPhrases = [...REPORT_DENYLIST.severity, ...REPORT_DENYLIST.authorship, ...REPORT_DENYLIST.praise];
    for (const phrase of allPhrases) {
      expect(reportDenylistMatches(`x ${phrase} y`)).toContain(phrase);
      expect(reportDenylistMatches(`x ${phrase.toUpperCase()} y`)).toContain(phrase);
    }
  });

  it('denylist matches phrases across whitespace', () => {
    expect(reportDenylistMatches('high\npriority')).toContain('high priority');
    expect(reportDenylistMatches('thank  you')).toContain('thank you');
  });

  it('denylist ignores words that only contain a listed word', () => {
    const nonMatches = ['greatly', 'glove', 'niceties', 'spammer', 'the authority', 'lovely', 'P10', 'severed'];
    for (const word of nonMatches) {
      expect(reportDenylistMatches(word)).toEqual([]);
    }
  });

  it('code spans are masked before scanning', () => {
    expect(maskCodeSpans('a `please` b')).toBe('a   b');
    expect(maskCodeSpans('``a`b``')).toBe(' ');
    expect(maskCodeSpans('x `y')).toBe('x `y');
    expect(reportDenylistMatches(maskCodeSpans('see `great` value'))).toEqual([]);
  });
});
