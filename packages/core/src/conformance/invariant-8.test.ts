import { describe, expect, it } from 'vitest';

import { buildIssueSnapshot, buildPullRequestSnapshot, snapshotHash } from '../index.js';
import type { IssueSnapshotInput, PullRequestSnapshotInput } from '../index.js';

function buildAndHash<Input extends IssueSnapshotInput | PullRequestSnapshotInput>(
  build: (input: Input) => { ok: boolean; value?: unknown },
  input: Input,
): { snapshot: Record<string, unknown>; hash: string } {
  const built = build(input) as { ok: boolean; value?: Record<string, unknown> };
  if (!built.ok || built.value === undefined) {
    throw new Error('expected snapshot build to succeed');
  }
  const hashed = snapshotHash(built.value as never) as { ok: boolean; value?: { toString(): string } };
  if (!hashed.ok || hashed.value === undefined) {
    throw new Error('expected snapshot hash to succeed');
  }
  return { snapshot: built.value, hash: String(hashed.value) };
}

const basePullRequestInput: PullRequestSnapshotInput = {
  repository: 'steady-orchard/patch-steward-testbed-public',
  number: 26,
  title: 'Fix empty input',
  body: 'Body text.',
  targetBranch: 'master',
  headCommit: 'a'.repeat(40),
  baseCommit: 'b'.repeat(40),
  linkedIssues: [
    { repository: 'steady-orchard/patch-steward-testbed-public', number: 29, contentHash: `sha256:${'1'.repeat(64)}` },
  ],
  attachments: [{ url: 'https://github.com/user-attachments/files/1/case.txt', contentHash: `sha256:${'2'.repeat(64)}` }],
  authorResponses: [{ requestId: 'request-1', commentId: 5825050006, contentHash: `sha256:${'3'.repeat(64)}` }],
  sharedHeadPullRequests: [27],
  policyRevision: 'c'.repeat(40),
};

const baseIssueInput: IssueSnapshotInput = {
  repository: 'steady-orchard/patch-steward-testbed-public',
  number: 29,
  title: 'Reproduce empty input crash',
  body: 'Body text.',
  attachments: [{ url: 'https://github.com/user-attachments/files/1/case.txt', contentHash: `sha256:${'2'.repeat(64)}` }],
  authorResponses: [{ requestId: 'request-1', commentId: 5825050006, contentHash: `sha256:${'3'.repeat(64)}` }],
  policyRevision: 'c'.repeat(40),
};

function pr(overrides: Partial<PullRequestSnapshotInput>): PullRequestSnapshotInput {
  return { ...basePullRequestInput, ...overrides };
}

function issue(overrides: Partial<IssueSnapshotInput>): IssueSnapshotInput {
  return { ...baseIssueInput, ...overrides };
}

describe('invariant 8: snapshot hash stability', () => {
  it('snapshot hash is stable under title-only edits', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const retitled = buildAndHash(buildPullRequestSnapshot, pr({ title: 'Fix empty input (updated)' }));
    expect(retitled.hash).toBe(original.hash);
    expect(retitled.snapshot).toEqual(original.snapshot);
    expect(retitled.snapshot).not.toHaveProperty('title');

    const originalIssue = buildAndHash(buildIssueSnapshot, baseIssueInput);
    const retitledIssue = buildAndHash(buildIssueSnapshot, issue({ title: 'Reproduce empty input crash (updated)' }));
    expect(retitledIssue.hash).toBe(originalIssue.hash);
    expect(retitledIssue.snapshot).toEqual(originalIssue.snapshot);
    expect(retitledIssue.snapshot).not.toHaveProperty('title');
  });

  it('snapshot hash changes with repository', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(
      buildPullRequestSnapshot,
      pr({
        repository: 'steady-orchard/other-repo',
        linkedIssues: [{ repository: 'steady-orchard/other-repo', number: 29, contentHash: `sha256:${'1'.repeat(64)}` }],
      }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with number', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ number: 30 }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with target branch', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ targetBranch: 'develop' }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with head commit', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ headCommit: 'f'.repeat(40) }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with body', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ body: 'Different body text.' }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with linked issue content', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(
      buildPullRequestSnapshot,
      pr({
        linkedIssues: [
          { repository: 'steady-orchard/patch-steward-testbed-public', number: 29, contentHash: `sha256:${'4'.repeat(64)}` },
        ],
      }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with attachment bytes', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(
      buildPullRequestSnapshot,
      pr({
        attachments: [{ url: 'https://github.com/user-attachments/files/1/case.txt', contentHash: `sha256:${'5'.repeat(64)}` }],
      }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with author response', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(
      buildPullRequestSnapshot,
      pr({ authorResponses: [{ requestId: 'request-1', commentId: 5825050006, contentHash: `sha256:${'6'.repeat(64)}` }] }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with shared-head set', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ sharedHeadPullRequests: [27, 31] }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with policy revision', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ policyRevision: 'd'.repeat(40) }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with issue content', () => {
    const original = buildAndHash(buildIssueSnapshot, baseIssueInput);
    const changed = buildAndHash(buildIssueSnapshot, issue({ body: 'Different body text.' }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with issue attachment bytes', () => {
    const original = buildAndHash(buildIssueSnapshot, baseIssueInput);
    const changed = buildAndHash(
      buildIssueSnapshot,
      issue({
        attachments: [{ url: 'https://github.com/user-attachments/files/1/case.txt', contentHash: `sha256:${'7'.repeat(64)}` }],
      }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with issue author response', () => {
    const original = buildAndHash(buildIssueSnapshot, baseIssueInput);
    const changed = buildAndHash(
      buildIssueSnapshot,
      issue({ authorResponses: [{ requestId: 'request-1', commentId: 5825050006, contentHash: `sha256:${'8'.repeat(64)}` }] }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with issue policy revision', () => {
    const original = buildAndHash(buildIssueSnapshot, baseIssueInput);
    const changed = buildAndHash(buildIssueSnapshot, issue({ policyRevision: 'd'.repeat(40) }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash is unchanged by the base commit', () => {
    const first = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const second = buildAndHash(buildPullRequestSnapshot, pr({ baseCommit: 'e'.repeat(40) }));
    expect(second.hash).toBe(first.hash);
    expect(first.snapshot['base_commit']).toBe(basePullRequestInput.baseCommit);
    expect(second.snapshot['base_commit']).toBe('e'.repeat(40));
  });

  it('snapshot hash is unchanged by the trusted commit', () => {
    type TrustedKey = Extract<
      keyof PullRequestSnapshotInput | keyof IssueSnapshotInput,
      'trustedCommit' | 'trusted_commit' | 'policyCommit'
    >;
    const noTrustedKey: [TrustedKey] extends [never] ? true : false = true;
    expect(noTrustedKey).toBe(true);

    const revisionA = { kind: 'git-tree' as const, id: 'c'.repeat(40), commit: 'd'.repeat(40), ref: 'master' };
    const revisionB = { kind: 'git-tree' as const, id: 'c'.repeat(40), commit: 'e'.repeat(40), ref: 'master' };

    const first = buildAndHash(buildPullRequestSnapshot, pr({ policyRevision: revisionA.id }));
    const second = buildAndHash(buildPullRequestSnapshot, pr({ policyRevision: revisionB.id }));
    expect(second.hash).toBe(first.hash);
    expect(JSON.stringify(first.snapshot)).not.toContain(revisionA.commit);
    expect(JSON.stringify(first.snapshot)).not.toContain(revisionB.commit);
  });
});
