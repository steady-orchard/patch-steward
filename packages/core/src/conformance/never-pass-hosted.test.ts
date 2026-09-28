import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FAILURE_CAUSES,
  authenticateEvent,
  decodeOwnershipRecord,
  decideDeduplication,
  evaluateCaps,
  verifyAppendOnlyCompare,
  verifyReadBackTree,
} from '../index.js';
import type {
  Result,
  EventAuthenticationFailureCode,
  OwnershipRecordFailureCode,
  DedupFailureCode,
  CapsFailureCode,
  AppendOnlyFailureCode,
  ReadBackFailureCode,
} from '../index.js';

type HostedFailureCode =
  | EventAuthenticationFailureCode
  | OwnershipRecordFailureCode
  | DedupFailureCode
  | CapsFailureCode
  | AppendOnlyFailureCode
  | ReadBackFailureCode;

const validEnvironment = {
  eventName: 'issues',
  repository: 'o/r',
  repositoryId: '1',
  ref: 'refs/heads/main',
  serverUrl: 'https://github.com',
  apiUrl: 'https://api.github.com',
  runId: '1',
  runAttempt: '1',
};

const TRIGGERS: { readonly [K in HostedFailureCode]: () => Result<unknown, string> } = {
  'gate.event-invalid': () => authenticateEvent(validEnvironment, Buffer.from('not json')),
  'ownership.record-invalid': () =>
    decodeOwnershipRecord(Buffer.from('{}'), {
      repository: 'o/r',
      type: 'issue',
      number: 1,
      artifactName: 'steward-ownership-issue-1',
      workflowRunId: null,
    }),
  'ownership.listing-unavailable': () =>
    decideDeduplication({
      runAttempt: 1,
      action: 'edited',
      echo: false,
      listing: { kind: 'unavailable' },
      fallback: null,
      captured: { snapshotHash: 'sha256:' + 'a'.repeat(64), policyRevision: 'b'.repeat(40) },
    }),
  'caps.run-list-unavailable': () =>
    evaluateCaps({
      createdToday: { items: [], totalCount: 0, complete: true },
      inProgress: { items: [], totalCount: 0, complete: false },
      queued: { items: [], totalCount: 0, complete: true },
      now: new Date('2026-09-27T00:00:00Z'),
      botUserId: 1,
      authorId: 2,
      currentRunId: 3,
      dailyLimit: 10,
      authorLimit: 5,
    }),
  'evidence.store-not-append-only': () =>
    verifyAppendOnlyCompare({ status: 'diverged', ahead_by: 1, behind_by: 1, files: [] }, ['run.json']),
  'evidence.readback-mismatch': () => verifyReadBackTree([], [{ path: 'run.json', blobId: 'a'.repeat(40) }], 'exact'),
};

describe('never-pass conformance: hosted contracts', () => {
  for (const code of Object.keys(TRIGGERS) as HostedFailureCode[]) {
    it(`hosted failure code ${code} never yields pass`, () => {
      const result = TRIGGERS[code]();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe(code);
        expect(result.failure.outcome).toBe('inconclusive');
        expect(FAILURE_CAUSES).toContain(result.failure.cause);
      }
      expect('value' in result).toBe(false);
    });
  }

  it('ownership modules import no file system or network module', () => {
    const dirUrl = new URL('../ownership/', import.meta.url);
    const dir = fileURLToPath(dirUrl);
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const file of files) {
      const text = readFileSync(fileURLToPath(new URL(file, dirUrl)), 'utf8');
      expect(text).not.toMatch(/from\s+['"](node:)?(fs|fs\/promises|http|https|net|dns|tls|child_process)['"]/);
      expect(text).not.toMatch(/import\(\s*['"](node:)?(fs|http|https|net|dns|tls|child_process)/);
      expect(text.includes('fetch(')).toBe(false);
    }
  });
});
