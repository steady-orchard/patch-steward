import { describe, expect, it } from 'vitest';
import {
  readBackTipAccepted,
  verifyAppendOnlyCompare,
  verifyReadBackTree,
  type EvidenceCompare,
  type ExpectedBlob,
  type ReadBackTreeEntry,
} from './store-checks.js';

describe('evidence store checks', () => {
  it('an added-only compare with the expected paths is append-only', () => {
    const compare: EvidenceCompare = {
      status: 'ahead',
      ahead_by: 1,
      behind_by: 0,
      files: [
        { filename: 'b.json', status: 'added' },
        { filename: 'a.json', status: 'added' },
      ],
    };
    const result = verifyAppendOnlyCompare(compare, ['b.json', 'a.json']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(['a.json', 'b.json']);
    }
  });

  it('a compare with a modified file is not append-only', () => {
    const compare: EvidenceCompare = {
      status: 'ahead',
      ahead_by: 1,
      behind_by: 0,
      files: [
        { filename: 'a.json', status: 'added' },
        { filename: 'b.json', status: 'modified' },
      ],
    };
    const result = verifyAppendOnlyCompare(compare, ['a.json', 'b.json']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.store-not-append-only');
      expect(result.failure.outcome).toBe('inconclusive');
      expect(result.failure.details[0]?.path).toBe('file-status');
    }
  });

  it('a compare with a missing or extra path is not append-only', () => {
    const compare: EvidenceCompare = {
      status: 'ahead',
      ahead_by: 1,
      behind_by: 0,
      files: [
        { filename: 'a.json', status: 'added' },
        { filename: 'extra.json', status: 'added' },
      ],
    };
    const result = verifyAppendOnlyCompare(compare, ['a.json', 'b.json']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.store-not-append-only');
      expect(result.failure.outcome).toBe('inconclusive');
      expect(result.failure.details[0]?.path).toBe('paths');
    }
  });

  it('a compare that is not one commit ahead is not append-only', () => {
    const diverged: EvidenceCompare = { status: 'diverged', ahead_by: 1, behind_by: 0, files: [] };
    const result1 = verifyAppendOnlyCompare(diverged, []);
    expect(result1.ok).toBe(false);
    if (!result1.ok) {
      expect(result1.failure.code).toBe('evidence.store-not-append-only');
      expect(result1.failure.outcome).toBe('inconclusive');
      expect(result1.failure.details[0]?.path).toBe('status');
    }

    const aheadBy2: EvidenceCompare = { status: 'ahead', ahead_by: 2, behind_by: 0, files: [] };
    const result2 = verifyAppendOnlyCompare(aheadBy2, []);
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.failure.code).toBe('evidence.store-not-append-only');
      expect(result2.failure.outcome).toBe('inconclusive');
      expect(result2.failure.details[0]?.path).toBe('ahead_by');
    }

    const behindBy1: EvidenceCompare = { status: 'ahead', ahead_by: 1, behind_by: 1, files: [] };
    const result3 = verifyAppendOnlyCompare(behindBy1, []);
    expect(result3.ok).toBe(false);
    if (!result3.ok) {
      expect(result3.failure.code).toBe('evidence.store-not-append-only');
      expect(result3.failure.outcome).toBe('inconclusive');
      expect(result3.failure.details[0]?.path).toBe('behind_by');
    }
  });

  it('a compare without a file list is not append-only', () => {
    const compare: EvidenceCompare = { status: 'ahead', ahead_by: 1, behind_by: 0 };
    const result = verifyAppendOnlyCompare(compare, ['a.json']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.store-not-append-only');
      expect(result.failure.outcome).toBe('inconclusive');
      expect(result.failure.details[0]?.path).toBe('files');
    }
  });

  it('a read-back tip that is ahead or identical is accepted', () => {
    expect(readBackTipAccepted({ status: 'ahead', ahead_by: 1, behind_by: 0 })).toBe(true);
    expect(readBackTipAccepted({ status: 'identical', ahead_by: 0, behind_by: 0 })).toBe(true);
  });

  it('a diverged or behind read-back tip is rejected', () => {
    expect(readBackTipAccepted({ status: 'diverged', ahead_by: 1, behind_by: 1 })).toBe(false);
    expect(readBackTipAccepted({ status: 'ahead', ahead_by: 1, behind_by: 1 })).toBe(false);
  });

  it('an exact read-back tree with matching blob ids verifies', () => {
    const entries: ReadBackTreeEntry[] = [
      { path: 'logs', type: 'tree', sha: 'treesha', mode: '040000' },
      { path: 'logs/steward.txt', type: 'blob', sha: 'blob1', mode: '100644' },
    ];
    const expected: ExpectedBlob[] = [{ path: 'logs/steward.txt', blobId: 'blob1' }];
    const result = verifyReadBackTree(entries, expected, 'exact');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(expected);
    }
  });

  it('a read-back blob id mismatch fails', () => {
    const entries: ReadBackTreeEntry[] = [{ path: 'a.json', type: 'blob', sha: 'wrong', mode: '100644' }];
    const expected: ExpectedBlob[] = [{ path: 'a.json', blobId: 'right' }];
    const result = verifyReadBackTree(entries, expected, 'exact');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.readback-mismatch');
      expect(result.failure.outcome).toBe('inconclusive');
      expect(result.failure.details[0]?.path).toBe('blob-id');
    }
  });

  it('an exact read-back with an extra or missing blob fails', () => {
    const extraEntries: ReadBackTreeEntry[] = [
      { path: 'a.json', type: 'blob', sha: 'a', mode: '100644' },
      { path: 'extra.json', type: 'blob', sha: 'b', mode: '100644' },
    ];
    const extraExpected: ExpectedBlob[] = [{ path: 'a.json', blobId: 'a' }];
    const extraResult = verifyReadBackTree(extraEntries, extraExpected, 'exact');
    expect(extraResult.ok).toBe(false);
    if (!extraResult.ok) {
      expect(extraResult.failure.code).toBe('evidence.readback-mismatch');
      expect(extraResult.failure.outcome).toBe('inconclusive');
      expect(extraResult.failure.details[0]?.path).toBe('extra');
    }

    const missingEntries: ReadBackTreeEntry[] = [{ path: 'a.json', type: 'blob', sha: 'a', mode: '100644' }];
    const missingExpected: ExpectedBlob[] = [{ path: 'missing.json', blobId: 'm' }];
    const missingResult = verifyReadBackTree(missingEntries, missingExpected, 'exact');
    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.failure.code).toBe('evidence.readback-mismatch');
      expect(missingResult.failure.outcome).toBe('inconclusive');
      expect(missingResult.failure.details[0]?.path).toBe('missing');
    }
  });

  it('a contains read-back ignores other entries', () => {
    const entries: ReadBackTreeEntry[] = [
      { path: 'a.json', type: 'blob', sha: 'a', mode: '100644' },
      { path: 'extra.json', type: 'blob', sha: 'b', mode: '100644' },
      { path: 'logs', type: 'tree', sha: 'treesha', mode: '040000' },
    ];
    const expected: ExpectedBlob[] = [{ path: 'a.json', blobId: 'a' }];
    const result = verifyReadBackTree(entries, expected, 'contains');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(expected);
    }
  });

  it('a read-back blob with another mode fails', () => {
    const entries: ReadBackTreeEntry[] = [{ path: 'a.json', type: 'blob', sha: 'a', mode: '100755' }];
    const expected: ExpectedBlob[] = [{ path: 'a.json', blobId: 'a' }];
    const result = verifyReadBackTree(entries, expected, 'exact');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.readback-mismatch');
      expect(result.failure.outcome).toBe('inconclusive');
      expect(result.failure.details[0]?.path).toBe('mode');
    }
  });
});
