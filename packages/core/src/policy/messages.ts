import { redactBuiltInCredentials } from '../redaction/detectors.js';
import { findPolicyLimit, POLICY_ID_MAX_LENGTH, VALIDATION_ERRORS_MAX, VALIDATION_EXCERPT_MAX_LENGTH } from './bounds.js';
import type { PolicyValidationCode } from './catalog.js';
import type { FailureDetail } from '../result.js';

export interface ZodIssueLike {
  readonly code: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
  readonly keys?: readonly string[];
}

export const MARKDOWN_ACTIVE_CHARACTERS = '\\`*_[]<>|~#&@';

function isLoneSurrogateCodePoint(codePoint: number, unitLength: number): boolean {
  return unitLength === 1 && codePoint >= 0xd800 && codePoint <= 0xdfff;
}

function escapeCodePoints(text: string, escapeMarkdown: boolean): string {
  let out = '';
  for (const ch of text) {
    const codePoint = ch.codePointAt(0) as number;
    const isControl = codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f);
    const isLineSeparator = codePoint === 0x2028 || codePoint === 0x2029;
    const loneSurrogate = isLoneSurrogateCodePoint(codePoint, ch.length);
    if (isControl || isLineSeparator || loneSurrogate) {
      out += `\\u${codePoint.toString(16).padStart(4, '0')}`;
    } else if (escapeMarkdown && MARKDOWN_ACTIVE_CHARACTERS.includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return out;
}

function truncateCodePoints(text: string, maxLength: number): string {
  const codePoints = Array.from(text);
  if (codePoints.length <= maxLength) {
    return text;
  }
  return codePoints.slice(0, maxLength - 1).join('') + '…';
}

export function formatExcerpt(value: unknown): string {
  let text: string;
  if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value);
  } else if (value === null) {
    text = 'null';
  } else if (value === undefined) {
    text = 'undefined';
  } else if (Array.isArray(value)) {
    text = 'a list';
  } else if (typeof value === 'object') {
    text = 'a mapping';
  } else {
    text = typeof value;
  }

  text = redactBuiltInCredentials(text);
  text = truncateCodePoints(text, VALIDATION_EXCERPT_MAX_LENGTH);
  return escapeCodePoints(text, true);
}

export function sanitizePathSegment(segment: string): string {
  let text = redactBuiltInCredentials(segment);
  text = escapeCodePoints(text, false);
  text = truncateCodePoints(text, POLICY_ID_MAX_LENGTH);
  return text;
}

export function formatPolicyPath(segments: readonly PropertyKey[]): string {
  return segments
    .map((segment) => {
      if (typeof segment === 'number') {
        return String(segment);
      }
      if (typeof segment === 'symbol') {
        return sanitizePathSegment(String(segment));
      }
      return sanitizePathSegment(segment);
    })
    .join('.');
}

export function policyDetail(code: PolicyValidationCode, path: string, message: string): FailureDetail {
  return { code, path, message, line: null, column: null };
}

interface PathLookup {
  readonly found: boolean;
  readonly value?: unknown;
}

function lookupValueAtPath(raw: unknown, path: readonly PropertyKey[]): PathLookup {
  let current: unknown = raw;
  for (const segment of path) {
    if (Array.isArray(current)) {
      const index = typeof segment === 'number' ? segment : Number.NaN;
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { found: false };
      }
      current = current[index];
    } else if (current !== null && typeof current === 'object') {
      const key = String(segment);
      if (!Object.hasOwn(current, key)) {
        return { found: false };
      }
      current = (current as Record<string, unknown>)[key];
    } else {
      return { found: false };
    }
  }
  return { found: true, value: current };
}

function rawPathJoin(path: readonly PropertyKey[]): string {
  return path.map((segment) => String(segment)).join('.');
}

export function mapZodIssues(issues: readonly ZodIssueLike[], raw: unknown): FailureDetail[] {
  const details: FailureDetail[] = [];

  for (const issue of issues) {
    const formattedPath = formatPolicyPath(issue.path);
    const shown = formattedPath === '' ? '(document)' : formattedPath;

    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys ?? []) {
        const keyPath = formatPolicyPath([...issue.path, key]);
        details.push(policyDetail('policy.unknown-key', keyPath, `Unknown key ${keyPath}; remove it or correct its name.`));
      }
      continue;
    }

    const lookup = lookupValueAtPath(raw, issue.path);
    if (!lookup.found || lookup.value === undefined) {
      details.push(
        policyDetail('policy.missing-key', formattedPath, `Required key ${shown} is missing; no default is substituted.`),
      );
      continue;
    }

    const limit = findPolicyLimit(rawPathJoin(issue.path));
    if (limit !== undefined && typeof lookup.value === 'number') {
      details.push(
        policyDetail(
          'policy.limit-out-of-bounds',
          formattedPath,
          `${shown} is ${formatExcerpt(lookup.value)}; it must be an integer from ${limit.min} to ${limit.max}.`,
        ),
      );
      continue;
    }

    details.push(
      policyDetail(
        'policy.invalid-value',
        formattedPath,
        `${shown} has an invalid value (${formatExcerpt(lookup.value)}): ${issue.message}`,
      ),
    );
  }

  return details;
}

export function capPolicyDetails(details: readonly FailureDetail[]): FailureDetail[] {
  return details.slice(0, VALIDATION_ERRORS_MAX);
}

export function policyFailureMessage(total: number, first: FailureDetail): string {
  let message = `Policy validation failed with ${total} error(s); first: ${first.message} No default was substituted; a run governed by this policy ends inconclusive.`;
  if (total > VALIDATION_ERRORS_MAX) {
    message += ` Only the first ${VALIDATION_ERRORS_MAX} errors are listed.`;
  }
  return message;
}
