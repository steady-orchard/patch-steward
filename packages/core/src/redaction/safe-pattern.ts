import { REDACTION_PATTERN_MAX_LENGTH } from '../policy/bounds.js';

export type SafePatternViolation =
  | 'empty'
  | 'too-long'
  | 'syntax'
  | 'backreference'
  | 'lookaround'
  | 'group-construct'
  | 'nested-quantifier'
  | 'quantified-alternation'
  | 'matches-empty';

export const REDACTION_PATTERN_FLAGS = 'gu';

interface GroupFrame {
  hasQuantifier: boolean;
  hasAlternation: boolean;
}

export function checkRedactionPattern(source: string): SafePatternViolation | null {
  if (source.length === 0) return 'empty';
  if (source.length > REDACTION_PATTERN_MAX_LENGTH) return 'too-long';

  try {
    new RegExp(source, 'u');
  } catch {
    return 'syntax';
  }

  const stack: GroupFrame[] = [{ hasQuantifier: false, hasAlternation: false }];
  let lastAtom: 'other' | GroupFrame | null = null;
  let prevWasQuantifier = false;
  let i = 0;

  while (i < source.length) {
    const c = source[i];
    let consumedQuantifier = false;

    if (c === '\\') {
      const next = source[i + 1];
      if (next !== undefined && '123456789'.includes(next)) return 'backreference';
      if (next === 'k') return 'backreference';
      if ((next === 'u' || next === 'p' || next === 'P') && source[i + 2] === '{') {
        const close = source.indexOf('}', i + 3);
        i = close + 1;
      } else {
        i += 2;
      }
      lastAtom = 'other';
    } else if (c === '[') {
      let j = i + 1;
      while (j < source.length && source[j] !== ']') {
        if (source[j] === '\\') {
          j += 2;
        } else {
          j += 1;
        }
      }
      i = j + 1;
      lastAtom = 'other';
    } else if (c === '(') {
      if (source[i + 1] === '?') {
        const two = source.slice(i, i + 3);
        const four = source.slice(i, i + 4);
        if (two === '(?:') {
          stack.push({ hasQuantifier: false, hasAlternation: false });
          i += 3;
          lastAtom = null;
        } else if (two === '(?=' || two === '(?!' || four === '(?<=' || four === '(?<!') {
          return 'lookaround';
        } else {
          return 'group-construct';
        }
      } else {
        stack.push({ hasQuantifier: false, hasAlternation: false });
        i += 1;
        lastAtom = null;
      }
    } else if (c === ')') {
      const f = stack.pop();
      if (f) {
        const top = stack[stack.length - 1];
        if (top) {
          top.hasQuantifier = top.hasQuantifier || f.hasQuantifier;
          top.hasAlternation = top.hasAlternation || f.hasAlternation;
        }
        lastAtom = f;
      }
      i += 1;
    } else if (c === '|') {
      const top = stack[stack.length - 1];
      if (top) top.hasAlternation = true;
      lastAtom = null;
      i += 1;
    } else if (c === '*' || c === '+' || c === '?' || c === '{') {
      const quantifierChar = c;
      let advance = 1;

      if (c === '{') {
        const close = source.indexOf('}', i + 1);
        advance = close - i + 1;
      }

      if (quantifierChar === '?' && prevWasQuantifier) {
        i += advance;
        prevWasQuantifier = false;
        continue;
      }

      const repeating = quantifierChar === '*' || quantifierChar === '+' || quantifierChar === '{';
      if (repeating && lastAtom !== null && lastAtom !== 'other') {
        if (lastAtom.hasQuantifier) return 'nested-quantifier';
        if (lastAtom.hasAlternation) return 'quantified-alternation';
      }

      const top = stack[stack.length - 1];
      if (top) top.hasQuantifier = true;
      prevWasQuantifier = true;
      consumedQuantifier = true;
      lastAtom = null;
      i += advance;
    } else {
      lastAtom = 'other';
      i += 1;
    }

    if (!consumedQuantifier) prevWasQuantifier = false;
  }

  if (new RegExp(source, 'u').test('')) return 'matches-empty';

  return null;
}
