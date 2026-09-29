import { describe, expect, it } from 'vitest';
import {
  checkCheckoutPath,
  checkOverlay,
  checkSymlinkTarget,
  treeKindForMode,
  type CheckoutTreeKind,
  type OverlayEntry,
} from './paths.js';

describe('checkCheckoutPath', () => {
  it('accepts ordinary repository paths', () => {
    const accented = 'a' + String.fromCharCode(0xe9) + '.ts';
    expect(checkCheckoutPath('src/a.ts')).toBeNull();
    expect(checkCheckoutPath('.gitignore')).toBeNull();
    expect(checkCheckoutPath('a/.github/x')).toBeNull();
    expect(checkCheckoutPath(accented)).toBeNull();
    expect(checkCheckoutPath(Buffer.from(accented, 'utf8'))).toBeNull();
  });

  it('rejects invalid UTF-8 paths', () => {
    expect(checkCheckoutPath(Buffer.from([0x61, 0xff]))).toBe('encoding');
    expect(checkCheckoutPath(String.fromCharCode(0xd800))).toBe('encoding');
  });

  it('rejects empty and overlong paths', () => {
    expect(checkCheckoutPath('')).toBe('length');
    expect(checkCheckoutPath('a'.repeat(4097))).toBe('length');
    expect(checkCheckoutPath('a'.repeat(4096))).toBeNull();
  });

  it('rejects control characters', () => {
    expect(checkCheckoutPath('a/' + String.fromCharCode(1) + '/b')).toBe('control');
    expect(checkCheckoutPath('a/' + String.fromCharCode(10) + '/b')).toBe('control');
    expect(checkCheckoutPath('a/' + String.fromCharCode(127) + '/b')).toBe('control');
  });

  it('rejects absolute paths and backslashes', () => {
    expect(checkCheckoutPath('/etc/passwd')).toBe('absolute');
    expect(checkCheckoutPath('a' + String.fromCharCode(92) + 'b')).toBe('backslash');
  });

  it('rejects empty, dot, and dot-dot segments', () => {
    expect(checkCheckoutPath('a//b')).toBe('segment');
    expect(checkCheckoutPath('./a')).toBe('segment');
    expect(checkCheckoutPath('a/.')).toBe('segment');
    expect(checkCheckoutPath('../x')).toBe('segment');
    expect(checkCheckoutPath('a/../b')).toBe('segment');
    expect(checkCheckoutPath('a/')).toBe('segment');
  });

  it('rejects git directory aliases', () => {
    expect(checkCheckoutPath('.git')).toBe('git-directory');
    expect(checkCheckoutPath('.GIT')).toBe('git-directory');
    expect(checkCheckoutPath('a/.git/hooks/pre-commit')).toBe('git-directory');
    expect(checkCheckoutPath('.git.')).toBe('git-directory');
    expect(checkCheckoutPath('.git  ')).toBe('git-directory');
    expect(checkCheckoutPath('.git. .')).toBe('git-directory');
    expect(checkCheckoutPath('git~1')).toBe('git-directory');
    expect(checkCheckoutPath('GIT~1/x')).toBe('git-directory');
    expect(checkCheckoutPath('.g' + String.fromCharCode(0x200c) + 'it')).toBe('git-directory');
    expect(checkCheckoutPath('.git' + String.fromCharCode(0xfeff))).toBe('git-directory');
    expect(checkCheckoutPath('x/.g' + String.fromCharCode(0x131) + 't')).toBe('git-directory');
  });

  it('accepts names that only resemble the git directory', () => {
    expect(checkCheckoutPath('.gitignore')).toBeNull();
    expect(checkCheckoutPath('.git2')).toBeNull();
    expect(checkCheckoutPath('x.git')).toBeNull();
    expect(checkCheckoutPath('git~2')).toBeNull();
    expect(checkCheckoutPath('.github')).toBeNull();
  });
});

describe('checkSymlinkTarget', () => {
  it('checks symlink target length and NUL', () => {
    expect(checkSymlinkTarget('')).toBe('length');
    expect(checkSymlinkTarget('x'.repeat(4097))).toBe('length');
    expect(checkSymlinkTarget('a' + String.fromCharCode(0))).toBe('nul');
    expect(checkSymlinkTarget('../../etc/passwd')).toBeNull();
  });
});

describe('treeKindForMode', () => {
  it('maps tree modes to kinds', () => {
    expect(treeKindForMode('100644')).toBe('blob');
    expect(treeKindForMode('100755')).toBe('blob');
    expect(treeKindForMode('120000')).toBe('symlink');
    expect(treeKindForMode('160000')).toBe('gitlink');
    expect(treeKindForMode('040000')).toBeNull();
  });
});

describe('checkOverlay', () => {
  const limits = { maxFiles: 100, maxBytes: 1_000_000 };

  it('applies writes and deletes to the tree', () => {
    const tree = new Map<string, CheckoutTreeKind>([
      ['a.txt', 'blob'],
      ['d/x', 'blob'],
    ]);
    const overlay: OverlayEntry[] = [
      { path: 'd/y', content: Buffer.from('y'), mode: '100644' },
      { path: 'a.txt', delete: true },
    ];
    const result = checkOverlay(tree, overlay, limits);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tree.has('d/x')).toBe(true);
      expect(result.value.tree.has('d/y')).toBe(true);
      expect(result.value.tree.has('a.txt')).toBe(false);
    }
    expect(tree.has('a.txt')).toBe(true);
    expect(tree.size).toBe(2);
  });

  it('rejects overlays that exceed the limits', () => {
    const tree = new Map<string, CheckoutTreeKind>();
    const threeEntries: OverlayEntry[] = [
      { path: 'a', content: Buffer.from(''), mode: '100644' },
      { path: 'b', content: Buffer.from(''), mode: '100644' },
      { path: 'c', content: Buffer.from(''), mode: '100644' },
    ];
    const tooMany = checkOverlay(tree, threeEntries, { maxFiles: 2, maxBytes: 1_000_000 });
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) {
      expect(tooMany.failure.details[0]?.message).toBe('too-many-entries');
    }

    const tooManyBytes = checkOverlay(tree, [{ path: 'a', content: Buffer.alloc(11), mode: '100644' }], {
      maxFiles: 10,
      maxBytes: 10,
    });
    expect(tooManyBytes.ok).toBe(false);
    if (!tooManyBytes.ok) {
      expect(tooManyBytes.failure.details[0]?.message).toBe('too-many-bytes');
    }

    const atLimits = checkOverlay(tree, [{ path: 'a', content: Buffer.alloc(10), mode: '100644' }], {
      maxFiles: 1,
      maxBytes: 10,
    });
    expect(atLimits.ok).toBe(true);
  });

  it('rejects traversal and invalid overlay paths', () => {
    const tree = new Map<string, CheckoutTreeKind>();
    for (const path of ['../escape', '/abs', 'a/../../b', '.git/config']) {
      const result = checkOverlay(tree, [{ path, content: Buffer.from(''), mode: '100644' }], limits);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.details[0]?.path).toBe(path);
        expect(result.failure.outcome).toBe('inconclusive');
      }
    }
  });

  it('rejects a path below a symlink', () => {
    const tree = new Map<string, CheckoutTreeKind>([['lnk', 'symlink']]);
    const result = checkOverlay(tree, [{ path: 'lnk/evil', content: Buffer.from(''), mode: '100644' }], limits);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.details[0]?.message).toBe('prefix-not-directory');
    }
  });

  it('rejects a path below a file or gitlink', () => {
    const tree = new Map<string, CheckoutTreeKind>([
      ['f', 'blob'],
      ['sub', 'gitlink'],
    ]);
    for (const path of ['f/x', 'sub/x']) {
      const result = checkOverlay(tree, [{ path, content: Buffer.from(''), mode: '100644' }], limits);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.details[0]?.message).toBe('prefix-not-directory');
      }
    }
  });

  it('rejects a symlink, gitlink, or directory target', () => {
    const tree = new Map<string, CheckoutTreeKind>([
      ['lnk', 'symlink'],
      ['sub', 'gitlink'],
      ['d/x', 'blob'],
    ]);
    const writeLnk = checkOverlay(tree, [{ path: 'lnk', content: Buffer.from(''), mode: '100644' }], limits);
    const deleteLnk = checkOverlay(tree, [{ path: 'lnk', delete: true }], limits);
    const writeSub = checkOverlay(tree, [{ path: 'sub', content: Buffer.from(''), mode: '100644' }], limits);
    const writeD = checkOverlay(tree, [{ path: 'd', content: Buffer.from(''), mode: '100644' }], limits);
    for (const result of [writeLnk, deleteLnk, writeSub, writeD]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.details[0]?.message).toBe('target-not-file');
      }
    }
  });

  it('checks prefixes against earlier overlay entries', () => {
    const tree = new Map<string, CheckoutTreeKind>([['f', 'blob']]);
    const writeThenNested = checkOverlay(
      tree,
      [
        { path: 'n', content: Buffer.from(''), mode: '100644' },
        { path: 'n/x', content: Buffer.from(''), mode: '100644' },
      ],
      limits,
    );
    expect(writeThenNested.ok).toBe(false);
    if (!writeThenNested.ok) {
      expect(writeThenNested.failure.details[0]?.message).toBe('prefix-not-directory');
    }

    const deleteThenWrite = checkOverlay(
      tree,
      [
        { path: 'f', delete: true },
        { path: 'f/x', content: Buffer.from(''), mode: '100644' },
      ],
      limits,
    );
    expect(deleteThenWrite.ok).toBe(true);
  });

  it('rejects duplicate overlay paths', () => {
    const tree = new Map<string, CheckoutTreeKind>();
    const result = checkOverlay(
      tree,
      [
        { path: 'a', content: Buffer.from(''), mode: '100644' },
        { path: 'a', content: Buffer.from(''), mode: '100644' },
      ],
      limits,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.details[0]?.message).toBe('duplicate-path');
    }
  });

  it('allows deleting an absent path', () => {
    const tree = new Map<string, CheckoutTreeKind>();
    const result = checkOverlay(tree, [{ path: 'nope', delete: true }], limits);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tree.has('nope')).toBe(false);
    }
  });

  it('rejects the whole overlay on one violation', () => {
    const tree = new Map<string, CheckoutTreeKind>();
    const result = checkOverlay(
      tree,
      [
        { path: 'ok', content: Buffer.from(''), mode: '100644' },
        { path: '../x', content: Buffer.from(''), mode: '100644' },
      ],
      limits,
    );
    expect(result.ok).toBe(false);
  });
});
