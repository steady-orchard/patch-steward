import { createHash } from 'node:crypto';

import { canonicalJson } from './canonical-json.js';
import type { CanonicalJsonFailureCode } from './canonical-json.js';
import type { Result } from './result.js';

export type ContentHash = `sha256:${string}`;
export type LocalRevisionId = `local:${string}`;

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function contentHash(bytes: Uint8Array): ContentHash {
  return `sha256:${sha256Hex(bytes)}`;
}

export function canonicalJsonHash(value: unknown): Result<ContentHash, CanonicalJsonFailureCode> {
  const canonicalResult = canonicalJson(value);
  if (!canonicalResult.ok) {
    return canonicalResult;
  }
  return { ok: true, value: contentHash(new TextEncoder().encode(canonicalResult.value)) };
}

export function localFileRevisionId(bytes: Uint8Array): LocalRevisionId {
  return `local:${sha256Hex(bytes)}`;
}
