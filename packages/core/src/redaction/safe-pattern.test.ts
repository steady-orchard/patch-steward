import { describe, expect, it } from 'vitest';
import { checkRedactionPattern, REDACTION_PATTERN_FLAGS } from './safe-pattern.js';
import { REDACTION_PATTERN_MAX_LENGTH } from '../policy/bounds.js';

describe('checkRedactionPattern', () => {
  it('rejects nested quantifier pattern', () => {
    for (const pattern of ['(a+)+$', '(?:\\d*)*', '(a{2,})+', '((ab)*c)+', '(a?){3}']) {
      expect(checkRedactionPattern(pattern)).toBe('nested-quantifier');
    }
  });

  it('rejects quantified alternation pattern', () => {
    for (const pattern of ['(a|a)*', '(?:x|xy)+', '(a|b){2,5}']) {
      expect(checkRedactionPattern(pattern)).toBe('quantified-alternation');
    }
  });

  it('rejects backreference pattern', () => {
    for (const pattern of ['(a)(b)\\2', '(a)\\1']) {
      expect(checkRedactionPattern(pattern)).toBe('backreference');
    }
  });

  it('rejects lookaround pattern', () => {
    for (const pattern of ['(?=a)b', 'a(?!b)', '(?<=a)b', '(?<!a)b']) {
      expect(checkRedactionPattern(pattern)).toBe('lookaround');
    }
  });

  it('rejects group constructs other than plain and non-capturing groups', () => {
    for (const pattern of ['(?<name>a)', '(?<n>a)\\k<n>']) {
      expect(['group-construct', 'backreference']).toContain(checkRedactionPattern(pattern));
    }
    expect(checkRedactionPattern('(?<name>a)')).toBe('group-construct');
  });

  it('rejects invalid syntax', () => {
    for (const pattern of ['(', '[a-', 'a{']) {
      expect(checkRedactionPattern(pattern)).toBe('syntax');
    }
  });

  it('rejects empty, overlong, and empty-matching patterns', () => {
    expect(checkRedactionPattern('')).toBe('empty');
    expect(checkRedactionPattern('a'.repeat(REDACTION_PATTERN_MAX_LENGTH + 1))).toBe('too-long');
    for (const pattern of ['a*', 'x|', '^']) {
      expect(checkRedactionPattern(pattern)).toBe('matches-empty');
    }
  });

  it('accepts safe patterns', () => {
    for (const pattern of [
      'internal-[0-9a-f]{32}',
      '(?:secret|token)=[A-Za-z0-9]{8,}',
      'ACME-\\d{4}-[A-Z]{6}',
      '\\p{Lu}{3}-\\d+',
      '(ab)+x',
      '(a+)?b',
      '[\\]]+z',
      'a'.repeat(REDACTION_PATTERN_MAX_LENGTH),
    ]) {
      expect(checkRedactionPattern(pattern)).toBeNull();
    }
  });

  it('redaction pattern flags are gu', () => {
    expect(REDACTION_PATTERN_FLAGS).toBe('gu');
  });
});
