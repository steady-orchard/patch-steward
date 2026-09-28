import { z } from 'zod';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export const evidenceCompareSchema = z.object({
  status: z.string().max(64),
  ahead_by: z.int().min(0),
  behind_by: z.int().min(0),
  files: z
    .array(
      z.object({
        filename: z.string().min(1).max(4096),
        status: z.string().max(64),
      }),
    )
    .max(3000)
    .optional(),
});

export type EvidenceCompare = z.output<typeof evidenceCompareSchema>;

export type AppendOnlyFailureCode = 'evidence.store-not-append-only';

function appendOnlyFailure(path: string): Result<readonly string[], AppendOnlyFailureCode> {
  return err('evidence.store-not-append-only', 'infrastructure', 'The evidence store change is not append-only.', [
    {
      code: 'evidence.store-not-append-only',
      path,
      message: 'The evidence store change is not append-only.',
      line: null,
      column: null,
    },
  ]);
}

export function verifyAppendOnlyCompare(
  compare: EvidenceCompare,
  expectedPaths: readonly string[],
): Result<readonly string[], AppendOnlyFailureCode> {
  if (compare.status !== 'ahead') {
    return appendOnlyFailure('status');
  }
  if (compare.ahead_by !== 1) {
    return appendOnlyFailure('ahead_by');
  }
  if (compare.behind_by !== 0) {
    return appendOnlyFailure('behind_by');
  }
  if (compare.files === undefined) {
    return appendOnlyFailure('files');
  }
  for (const file of compare.files) {
    if (file.status !== 'added') {
      return appendOnlyFailure('file-status');
    }
  }

  const expectedSet = new Set(expectedPaths);
  if (expectedSet.size !== expectedPaths.length) {
    return appendOnlyFailure('paths');
  }
  const filenames = compare.files.map((file) => file.filename);
  const filenameSet = new Set(filenames);
  if (filenameSet.size !== filenames.length) {
    return appendOnlyFailure('paths');
  }
  if (filenameSet.size !== expectedSet.size) {
    return appendOnlyFailure('paths');
  }
  for (const path of expectedSet) {
    if (!filenameSet.has(path)) {
      return appendOnlyFailure('paths');
    }
  }

  return ok([...expectedPaths].sort());
}

export function readBackTipAccepted(compare: EvidenceCompare): boolean {
  return (compare.status === 'ahead' || compare.status === 'identical') && compare.behind_by === 0;
}

export type ReadBackFailureCode = 'evidence.readback-mismatch';
export type ReadBackMode = 'exact' | 'contains';

export interface ReadBackTreeEntry {
  readonly path: string;
  readonly type: string;
  readonly sha: string;
  readonly mode: string;
}

export interface ExpectedBlob {
  readonly path: string;
  readonly blobId: string;
}

function readBackFailure(path: string): Result<readonly ExpectedBlob[], ReadBackFailureCode> {
  return err('evidence.readback-mismatch', 'infrastructure', 'The evidence read-back does not match the committed files.', [
    {
      code: 'evidence.readback-mismatch',
      path,
      message: 'The evidence read-back does not match the committed files.',
      line: null,
      column: null,
    },
  ]);
}

export function verifyReadBackTree(
  entries: readonly ReadBackTreeEntry[],
  expected: readonly ExpectedBlob[],
  mode: ReadBackMode,
): Result<readonly ExpectedBlob[], ReadBackFailureCode> {
  const expectedPaths = expected.map((blob) => blob.path);
  const expectedPathSet = new Set(expectedPaths);
  if (expectedPathSet.size !== expectedPaths.length) {
    return readBackFailure('expected');
  }

  if (mode === 'exact') {
    for (const entry of entries) {
      if (entry.type !== 'blob' && entry.type !== 'tree') {
        return readBackFailure('entry-type');
      }
    }
  }

  const blobEntries = entries.filter((entry) => entry.type === 'blob');
  const blobPaths = blobEntries.map((entry) => entry.path);
  const blobPathSet = new Set(blobPaths);
  if (blobPathSet.size !== blobPaths.length) {
    return readBackFailure('paths');
  }

  for (const blob of expected) {
    const entry = blobEntries.find((candidate) => candidate.path === blob.path);
    if (entry === undefined) {
      return readBackFailure('missing');
    }
    if (entry.sha !== blob.blobId) {
      return readBackFailure('blob-id');
    }
    if (entry.mode !== '100644') {
      return readBackFailure('mode');
    }
  }

  if (mode === 'exact') {
    for (const entry of blobEntries) {
      if (!expectedPathSet.has(entry.path)) {
        return readBackFailure('extra');
      }
    }
  }

  return ok([...expected].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)));
}
