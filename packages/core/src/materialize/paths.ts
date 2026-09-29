import { CHECKOUT_PATH_MAX_BYTES } from '../policy/bounds.js';
import { ok, err, type Result } from '../result.js';

export const CHECKOUT_PATH_VIOLATIONS = [
  'encoding',
  'length',
  'control',
  'absolute',
  'backslash',
  'segment',
  'git-directory',
] as const;

export type CheckoutPathViolation = (typeof CHECKOUT_PATH_VIOLATIONS)[number];

const STRIP_CODE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x200c, 0x200f],
  [0x202a, 0x202e],
  [0x206a, 0x206f],
  [0xfeff, 0xfeff],
];

function foldGitAlias(segment: string): string {
  let stripped = '';
  for (const ch of segment) {
    const code = ch.codePointAt(0) ?? 0;
    if (!STRIP_CODE_RANGES.some(([lo, hi]) => code >= lo && code <= hi)) {
      stripped += ch;
    }
  }
  let end = stripped.length;
  while (end > 0 && (stripped[end - 1] === '.' || stripped[end - 1] === ' ')) {
    end -= 1;
  }
  return stripped.slice(0, end).toUpperCase().toLowerCase();
}

export function checkCheckoutPath(path: string | Uint8Array): CheckoutPathViolation | null {
  let text: string;
  let byteLength: number;

  if (typeof path === 'string') {
    if (!path.isWellFormed()) {
      return 'encoding';
    }
    text = path;
    byteLength = Buffer.byteLength(path, 'utf8');
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(path);
    } catch {
      return 'encoding';
    }
    byteLength = path.length;
  }

  if (byteLength < 1 || byteLength > CHECKOUT_PATH_MAX_BYTES) {
    return 'length';
  }

  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      return 'control';
    }
  }

  if (text.startsWith('/')) {
    return 'absolute';
  }

  if (text.includes('\\')) {
    return 'backslash';
  }

  const segments = text.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      return 'segment';
    }
  }

  for (const segment of segments) {
    const folded = foldGitAlias(segment);
    if (folded === '.git' || folded === 'git~1') {
      return 'git-directory';
    }
  }

  return null;
}

export function checkSymlinkTarget(target: string | Uint8Array): 'length' | 'nul' | null {
  let byteLength: number;
  let hasNul: boolean;

  if (typeof target === 'string') {
    byteLength = Buffer.byteLength(target, 'utf8');
    hasNul = target.includes(String.fromCharCode(0));
  } else {
    byteLength = target.length;
    hasNul = target.includes(0);
  }

  if (byteLength < 1 || byteLength > CHECKOUT_PATH_MAX_BYTES) {
    return 'length';
  }
  if (hasNul) {
    return 'nul';
  }
  return null;
}

export type CheckoutTreeKind = 'blob' | 'symlink' | 'gitlink';

export function treeKindForMode(mode: string): CheckoutTreeKind | null {
  switch (mode) {
    case '100644':
    case '100755':
      return 'blob';
    case '120000':
      return 'symlink';
    case '160000':
      return 'gitlink';
    default:
      return null;
  }
}

export type OverlayEntry =
  | { readonly path: string; readonly content: Uint8Array; readonly mode: '100644' | '100755' }
  | { readonly path: string; readonly delete: true };

export interface OverlayLimits {
  readonly maxFiles: number;
  readonly maxBytes: number;
}

export const OVERLAY_REJECTION_REASONS = [
  'too-many-entries',
  'too-many-bytes',
  'path-invalid',
  'duplicate-path',
  'prefix-not-directory',
  'target-not-file',
] as const;

export type OverlayRejectionReason = (typeof OVERLAY_REJECTION_REASONS)[number];

export interface OverlayApplication {
  readonly tree: ReadonlyMap<string, CheckoutTreeKind>;
  readonly applied: readonly OverlayEntry[];
}

function rejectOverlay(path: string, reason: OverlayRejectionReason): Result<OverlayApplication, 'materialize.overlay-rejected'> {
  return err('materialize.overlay-rejected', 'environment-unavailable', 'The overlay was rejected.', [
    { code: 'materialize.overlay-rejected', path, message: reason, line: null, column: null },
  ]);
}

function isDirectoryIn(map: ReadonlyMap<string, CheckoutTreeKind>, path: string): boolean {
  const prefix = path + '/';
  for (const key of map.keys()) {
    if (key.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function properPrefixes(path: string): string[] {
  const segments = path.split('/');
  const prefixes: string[] = [];
  for (let i = 1; i < segments.length; i += 1) {
    prefixes.push(segments.slice(0, i).join('/'));
  }
  return prefixes;
}

export function checkOverlay(
  tree: ReadonlyMap<string, CheckoutTreeKind>,
  overlay: readonly OverlayEntry[],
  limits: OverlayLimits,
): Result<OverlayApplication, 'materialize.overlay-rejected'> {
  if (overlay.length > limits.maxFiles) {
    return rejectOverlay('', 'too-many-entries');
  }

  let totalBytes = 0;
  for (const entry of overlay) {
    if ('content' in entry) {
      totalBytes += entry.content.length;
    }
  }
  if (totalBytes > limits.maxBytes) {
    return rejectOverlay('', 'too-many-bytes');
  }

  const current = new Map(tree);
  const seen = new Set<string>();

  for (const entry of overlay) {
    const path = entry.path;

    if (checkCheckoutPath(path) !== null) {
      return rejectOverlay(path, 'path-invalid');
    }
    if (seen.has(path)) {
      return rejectOverlay(path, 'duplicate-path');
    }
    seen.add(path);

    for (const prefix of properPrefixes(path)) {
      if (current.get(prefix) !== undefined) {
        return rejectOverlay(path, 'prefix-not-directory');
      }
    }

    const treeKind = tree.get(path);
    const currentKind = current.get(path);
    if (
      treeKind === 'symlink' ||
      treeKind === 'gitlink' ||
      currentKind === 'symlink' ||
      currentKind === 'gitlink' ||
      isDirectoryIn(tree, path) ||
      isDirectoryIn(current, path)
    ) {
      return rejectOverlay(path, 'target-not-file');
    }

    if ('delete' in entry) {
      current.delete(path);
    } else {
      current.set(path, 'blob');
    }
  }

  return ok({ tree: current, applied: [...overlay] });
}
