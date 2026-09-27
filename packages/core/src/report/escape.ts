import { REPORT_DERIVED_VALUE_MAX_LENGTH, REPORT_SUBJECTS_PER_ITEM } from '../policy/bounds.js';
import { maskCodeSpans } from './denylist.js';

export const REPORT_TRUNCATION_SUFFIX = ' (truncated)';

function isFormatOrControl(code: number): boolean {
  if (code <= 0x1f) return true;
  if (code >= 0x7f && code <= 0x9f) return true;
  if (code === 0x2028 || code === 0x2029) return true;
  if (code >= 0x200b && code <= 0x200f) return true;
  if (code >= 0x202a && code <= 0x202e) return true;
  if (code >= 0x2060 && code <= 0x2064) return true;
  if (code >= 0x2066 && code <= 0x2069) return true;
  if (code === 0xfeff) return true;
  return false;
}

function isLoneSurrogate(value: string, index: number): boolean {
  const code = value.charCodeAt(index);
  if (code >= 0xd800 && code <= 0xdbff) {
    // high surrogate: lone unless followed by a low surrogate
    const next = value.charCodeAt(index + 1);
    return !(next >= 0xdc00 && next <= 0xdfff);
  }
  if (code >= 0xdc00 && code <= 0xdfff) {
    // low surrogate: lone unless preceded by a high surrogate
    const prev = index > 0 ? value.charCodeAt(index - 1) : NaN;
    return !(prev >= 0xd800 && prev <= 0xdbff);
  }
  return false;
}

function toEscapeSequence(code: number): string {
  return '\\u{' + code.toString(16).toUpperCase().padStart(4, '0') + '}';
}

export function escapeReportValue(value: string): string {
  let result = '';
  let i = 0;
  const len = value.length;
  while (i < len) {
    const ch = value[i] as string;
    const code = value.charCodeAt(i);
    if (ch === '\n') {
      result += '\\n';
      i++;
      continue;
    }
    if (ch === '\r') {
      result += '\\r';
      i++;
      continue;
    }
    if (isLoneSurrogate(value, i)) {
      result += toEscapeSequence(code);
      i++;
      continue;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      // valid surrogate pair: keep as-is (e.g. emoji), advance by two units
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += ch + (value[i + 1] as string);
        i += 2;
        continue;
      }
    }
    if (isFormatOrControl(code)) {
      result += toEscapeSequence(code);
      i++;
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}

function truncateCodeUnits(value: string): { text: string; truncated: boolean } {
  if (value.length <= REPORT_DERIVED_VALUE_MAX_LENGTH) {
    return { text: value, truncated: false };
  }
  let cut = REPORT_DERIVED_VALUE_MAX_LENGTH;
  const code = value.charCodeAt(cut - 1);
  if (code >= 0xd800 && code <= 0xdbff) {
    cut = REPORT_DERIVED_VALUE_MAX_LENGTH - 1;
  }
  return { text: value.slice(0, cut), truncated: true };
}

function longestBacktickRun(value: string): number {
  let longest = 0;
  let current = 0;
  for (const ch of value) {
    if (ch === '`') {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

export function reportCodeSpan(value: string): string {
  const escaped = escapeReportValue(value);
  const { text, truncated } = truncateCodeUnits(escaped);
  if (text.length === 0) {
    return '` `' + (truncated ? REPORT_TRUNCATION_SUFFIX : '');
  }
  const fenceLength = longestBacktickRun(text) + 1;
  const fence = '`'.repeat(fenceLength);
  const needsPadding = text.startsWith('`') || text.endsWith('`') || text.startsWith(' ') || text.endsWith(' ');
  const body = needsPadding ? ' ' + text + ' ' : text;
  return fence + body + fence + (truncated ? REPORT_TRUNCATION_SUFFIX : '');
}

export function reportSubjectList(values: readonly string[]): string {
  if (values.length === 0) {
    return 'none';
  }
  const shown = values.slice(0, REPORT_SUBJECTS_PER_ITEM);
  const remaining = values.length - shown.length;
  const spans = shown.map((value) => reportCodeSpan(value)).join(', ');
  return remaining > 0 ? spans + ' and ' + remaining + ' more' : spans;
}

export function repositoryWebUrl(repository: string, segments: readonly string[]): string {
  const repoPath = repository.split('/').map(encodeURIComponent).join('/');
  const tail = segments.length ? '/' + segments.map(encodeURIComponent).join('/') : '';
  return 'https://github.com/' + repoPath + tail;
}

export function fillReportTemplate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) {
      throw new Error('missing report template value: ' + name);
    }
    return values[name] as string;
  });
}

export function reportFixedTextViolations(text: string): readonly string[] {
  const violations: string[] = [];
  const masked = maskCodeSpans(text);
  if (text.includes('@')) {
    violations.push('mention');
  }
  if (/#[0-9]/.test(masked)) {
    violations.push('issue-reference');
  }
  if (/<[A-Za-z/!?]/.test(masked)) {
    violations.push('html');
  }
  if (text.includes('!')) {
    violations.push('exclamation');
  }
  if (/\p{Extended_Pictographic}/u.test(text)) {
    violations.push('emoji');
  }
  return violations;
}

export function reportCharacterViolations(text: string): readonly string[] {
  const violations: string[] = [];
  let i = 0;
  const len = text.length;
  while (i < len) {
    const code = text.charCodeAt(i);
    const ch = text[i] as string;
    if (ch === '\n') {
      i++;
      continue;
    }
    if (isLoneSurrogate(text, i)) {
      violations.push('U+' + code.toString(16).toUpperCase().padStart(4, '0'));
      i++;
      continue;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i += 2;
        continue;
      }
    }
    if (isFormatOrControl(code)) {
      violations.push('U+' + code.toString(16).toUpperCase().padStart(4, '0'));
    }
    i++;
  }
  return violations;
}
