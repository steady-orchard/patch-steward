import { err, ok } from './result.js';
import type { Result } from './result.js';

export type CanonicalJsonFailureCode =
  | 'canonical-json.non-finite-number'
  | 'canonical-json.lone-surrogate'
  | 'canonical-json.unsupported-value'
  | 'canonical-json.cycle';

const MESSAGES: Record<CanonicalJsonFailureCode, string> = {
  'canonical-json.non-finite-number': 'Number is not finite and has no canonical JSON representation.',
  'canonical-json.lone-surrogate': 'String contains a lone surrogate and is not well-formed Unicode.',
  'canonical-json.unsupported-value': 'Value has no canonical JSON representation.',
  'canonical-json.cycle': 'Value contains a circular reference.',
};

function failure(code: CanonicalJsonFailureCode, path: string): Result<string, CanonicalJsonFailureCode> {
  return err(code, 'steward-defect', MESSAGES[code], [{ code, path, message: MESSAGES[code], line: null, column: null }]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function serialize(value: unknown, path: string, ancestors: ReadonlySet<object>): Result<string, CanonicalJsonFailureCode> {
  if (value === null) {
    return ok('null');
  }
  if (typeof value === 'boolean') {
    return ok(value ? 'true' : 'false');
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return failure('canonical-json.non-finite-number', path);
    }
    return ok(JSON.stringify(value));
  }
  if (typeof value === 'string') {
    if (!value.isWellFormed()) {
      return failure('canonical-json.lone-surrogate', path);
    }
    return ok(JSON.stringify(value));
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return failure('canonical-json.cycle', path);
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(value);
    const parts: string[] = [];
    for (let i = 0; i < value.length; i += 1) {
      if (!(i in value) || value[i] === undefined) {
        return failure('canonical-json.unsupported-value', `${path}${path === '' ? '' : '.'}${i}`);
      }
      const elementResult = serialize(value[i], `${path}${path === '' ? '' : '.'}${i}`, nextAncestors);
      if (!elementResult.ok) {
        return elementResult;
      }
      parts.push(elementResult.value);
    }
    return ok(`[${parts.join(',')}]`);
  }
  if (isPlainObject(value)) {
    if (ancestors.has(value)) {
      return failure('canonical-json.cycle', path);
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      return failure('canonical-json.unsupported-value', path);
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(value);
    const keys = Object.keys(value).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const keyPath = `${path}${path === '' ? '' : '.'}${key}`;
      if (!key.isWellFormed()) {
        return failure('canonical-json.lone-surrogate', keyPath);
      }
      const propertyValue = value[key];
      if (propertyValue === undefined) {
        return failure('canonical-json.unsupported-value', keyPath);
      }
      const valueResult = serialize(propertyValue, keyPath, nextAncestors);
      if (!valueResult.ok) {
        return valueResult;
      }
      parts.push(`${JSON.stringify(key)}:${valueResult.value}`);
    }
    return ok(`{${parts.join(',')}}`);
  }
  return failure('canonical-json.unsupported-value', path);
}

export function canonicalJson(value: unknown): Result<string, CanonicalJsonFailureCode> {
  return serialize(value, '', new Set());
}
