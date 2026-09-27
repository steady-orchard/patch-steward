import { canonicalJson } from '../canonical-json.js';
import type { CanonicalJsonFailureCode } from '../canonical-json.js';
import { ok } from '../result.js';
import type { Result } from '../result.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function serialize(value: unknown, indent: string): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const childIndent = `${indent}  `;
    const items = value.map((item) => `${childIndent}${serialize(item, childIndent)}`);
    return `[\n${items.join(',\n')}\n${indent}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    if (keys.length === 0) {
      return '{}';
    }
    const childIndent = `${indent}  `;
    const members = keys.map((key) => `${childIndent}${JSON.stringify(key)}: ${serialize(value[key], childIndent)}`);
    return `{\n${members.join(',\n')}\n${indent}}`;
  }
  // Unreachable when canonicalJson(value) has already succeeded.
  return JSON.stringify(value);
}

export function prettyJson(value: unknown): Result<string, CanonicalJsonFailureCode> {
  const canonicalResult = canonicalJson(value);
  if (!canonicalResult.ok) {
    return canonicalResult;
  }
  return ok(`${serialize(value, '')}\n`);
}
