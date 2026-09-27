import { describe, expect, it } from 'vitest';

import { buildIssueSnapshot, buildPullRequestSnapshot, snapshotHash, snapshotSchema } from './snapshot.js';
import type { IssueSnapshotInput, PullRequestSnapshotInput, Snapshot } from './snapshot.js';
import type { ContentHash } from '../hash.js';

const H = (c: string): ContentHash => `sha256:${c.repeat(64)}`;

const PR_INPUT: PullRequestSnapshotInput = {
  repository: 'octo/widgets',
  number: 42,
  title: 'Fix the parser',
  body: '<!-- patch-steward:pr-template v1 -->\n\n## Category\n\nbugfix\n',
  targetBranch: 'main',
  headCommit: 'a'.repeat(40),
  baseCommit: 'b'.repeat(40),
  linkedIssues: [{ repository: 'octo/widgets', number: 7, contentHash: H('c') }],
  attachments: [
    { url: 'https://github.com/user-attachments/files/2/z.txt', contentHash: H('d') },
    { url: 'https://github.com/user-attachments/files/1/a.txt', contentHash: null },
  ],
  authorResponses: [
    { requestId: 'R2', commentId: 11, contentHash: H('e') },
    { requestId: 'R1', commentId: 10, contentHash: null },
  ],
  sharedHeadPullRequests: [45, 42, 43, 45],
  policyRevision: 'f'.repeat(40),
};

const ISSUE_INPUT: IssueSnapshotInput = {
  repository: 'octo/widgets',
  number: 7,
  title: 'Crash',
  body: '### Expected behavior\n\nNo crash\n',
  attachments: [],
  authorResponses: [],
  policyRevision: 'f'.repeat(40),
};

describe('snapshot', () => {
  it('snapshot golden hash for a pull request', () => {
    const result = buildPullRequestSnapshot(PR_INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      snapshot_version: 1,
      repository: 'octo/widgets',
      type: 'pull_request',
      number: 42,
      target_branch: 'main',
      head_commit: 'a'.repeat(40),
      base_commit: 'b'.repeat(40),
      body_hash: 'sha256:e1738bee7e4d4617fd0a76dae147c53b89187e9c59b486d7df56e2d4dd702f3b',
      linked_issues: [{ repository: 'octo/widgets', number: 7, content_hash: H('c') }],
      attachments: [
        { url: 'https://github.com/user-attachments/files/1/a.txt', content_hash: null },
        { url: 'https://github.com/user-attachments/files/2/z.txt', content_hash: H('d') },
      ],
      author_responses: [
        { request_id: 'R1', comment_id: 10, content_hash: null },
        { request_id: 'R2', comment_id: 11, content_hash: H('e') },
      ],
      shared_head_pull_requests: [43, 45],
      policy_revision: 'f'.repeat(40),
    });
    const hashResult = snapshotHash(result.value);
    expect(hashResult.ok).toBe(true);
    if (!hashResult.ok) return;
    expect(hashResult.value).toBe('sha256:c51c7fb289f3d86237aa171fbd7db4424ec96393edebaa923429774e2685021b');
  });

  it('snapshot golden hash for an issue', () => {
    const result = buildIssueSnapshot(ISSUE_INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content_hash).toBe('sha256:2973eaae8735202a251b5dd8051e88a0b17b004efcda76c47a337362fc743d6d');
    expect('base_commit' in result.value).toBe(false);
    const hashResult = snapshotHash(result.value);
    expect(hashResult.ok).toBe(true);
    if (!hashResult.ok) return;
    expect(hashResult.value).toBe('sha256:a81a207e9389a8e237a74b246469000eac3af52c8fc1d323e66258121f441683');
  });

  it('snapshot hash is stable under title-only edits', () => {
    const a = buildPullRequestSnapshot(PR_INPUT);
    const b = buildPullRequestSnapshot({ ...PR_INPUT, title: 'Another title' });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(snapshotHash(a.value)).toEqual(snapshotHash(b.value));
  });

  it('issue snapshot hash is stable under title-only edits', () => {
    const a = buildIssueSnapshot(ISSUE_INPUT);
    const b = buildIssueSnapshot({ ...ISSUE_INPUT, title: 'Another title' });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(snapshotHash(a.value)).toEqual(snapshotHash(b.value));
  });

  function prHash(overrides: Partial<PullRequestSnapshotInput>): string | null {
    const result = buildPullRequestSnapshot({ ...PR_INPUT, ...overrides });
    if (!result.ok) return null;
    const hashResult = snapshotHash(result.value);
    return hashResult.ok ? hashResult.value : null;
  }

  const baseHash = prHash({});

  it('snapshot hash changes with repository', () => {
    expect(prHash({ repository: 'octo/gadgets' })).not.toBe(baseHash);
  });

  it('snapshot hash changes with number', () => {
    expect(prHash({ number: 44 })).not.toBe(baseHash);
  });

  it('snapshot hash changes with target branch', () => {
    expect(prHash({ targetBranch: 'release/1.x' })).not.toBe(baseHash);
  });

  it('snapshot hash changes with head commit', () => {
    expect(prHash({ headCommit: '1'.repeat(40) })).not.toBe(baseHash);
  });

  it('snapshot hash changes with body', () => {
    expect(prHash({ body: `${PR_INPUT.body} edited` })).not.toBe(baseHash);
  });

  it('snapshot hash changes with linked issue content', () => {
    expect(prHash({ linkedIssues: [{ repository: 'octo/widgets', number: 7, contentHash: H('9') }] })).not.toBe(baseHash);
  });

  it('snapshot hash changes with attachment bytes', () => {
    expect(
      prHash({
        attachments: [
          { url: 'https://github.com/user-attachments/files/2/z.txt', contentHash: H('d') },
          { url: 'https://github.com/user-attachments/files/1/a.txt', contentHash: H('8') },
        ],
      }),
    ).not.toBe(baseHash);
  });

  it('snapshot hash changes with author response', () => {
    expect(
      prHash({
        authorResponses: [
          { requestId: 'R2', commentId: 11, contentHash: H('e') },
          { requestId: 'R1', commentId: 10, contentHash: H('7') },
        ],
      }),
    ).not.toBe(baseHash);
  });

  it('snapshot hash changes with shared-head set', () => {
    expect(prHash({ sharedHeadPullRequests: [45, 43, 46] })).not.toBe(baseHash);
  });

  it('snapshot hash changes with policy revision', () => {
    expect(prHash({ policyRevision: '0'.repeat(40) })).not.toBe(baseHash);
  });

  const ISSUE_WITH_DATA: IssueSnapshotInput = {
    ...ISSUE_INPUT,
    attachments: [{ url: 'https://github.com/user-attachments/assets/744fcbda-c531-4896-ad0d-2ad02b103546', contentHash: H('d') }],
    authorResponses: [{ requestId: 'R1', commentId: 10, contentHash: H('e') }],
  };

  function issueHash(overrides: Partial<IssueSnapshotInput>): string | null {
    const result = buildIssueSnapshot({ ...ISSUE_WITH_DATA, ...overrides });
    if (!result.ok) return null;
    const hashResult = snapshotHash(result.value);
    return hashResult.ok ? hashResult.value : null;
  }

  const issueBaseHash = issueHash({});

  it('issue snapshot hash changes with content', () => {
    expect(issueHash({ body: `${ISSUE_WITH_DATA.body} changed` })).not.toBe(issueBaseHash);
  });

  it('issue snapshot hash changes with attachment bytes', () => {
    expect(
      issueHash({
        attachments: [
          {
            url: 'https://github.com/user-attachments/assets/744fcbda-c531-4896-ad0d-2ad02b103546',
            contentHash: H('8'),
          },
        ],
      }),
    ).not.toBe(issueBaseHash);
  });

  it('issue snapshot hash changes with author response', () => {
    expect(issueHash({ authorResponses: [{ requestId: 'R1', commentId: 10, contentHash: H('7') }] })).not.toBe(issueBaseHash);
  });

  it('issue snapshot hash changes with policy revision', () => {
    expect(issueHash({ policyRevision: '0'.repeat(40) })).not.toBe(issueBaseHash);
  });

  it('snapshot hash is unchanged by the base commit', () => {
    const a = buildPullRequestSnapshot(PR_INPUT);
    const b = buildPullRequestSnapshot({ ...PR_INPUT, baseCommit: '2'.repeat(40) });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(snapshotHash(a.value)).toEqual(snapshotHash(b.value));
    expect(b.value.base_commit).toBe('2'.repeat(40));
  });

  it('snapshot lists are sorted and deduplicated', () => {
    const result = buildPullRequestSnapshot({
      ...PR_INPUT,
      attachments: [...PR_INPUT.attachments, { url: 'https://github.com/user-attachments/files/2/z.txt', contentHash: H('d') }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attachments).toEqual([
      { url: 'https://github.com/user-attachments/files/1/a.txt', content_hash: null },
      { url: 'https://github.com/user-attachments/files/2/z.txt', content_hash: H('d') },
    ]);
    expect(result.value.shared_head_pull_requests).toEqual([43, 45]);
  });

  it('snapshot rejects invalid input', () => {
    const cases: (() => ReturnType<typeof buildPullRequestSnapshot>)[] = [
      () => buildPullRequestSnapshot({ ...PR_INPUT, headCommit: 'xyz' }),
      () =>
        buildPullRequestSnapshot({
          ...PR_INPUT,
          attachments: [{ url: 'http://example.com/a.txt', contentHash: null }],
        }),
      () => buildPullRequestSnapshot({ ...PR_INPUT, policyRevision: 'local:abc' }),
      () =>
        buildPullRequestSnapshot({
          ...PR_INPUT,
          attachments: [
            { url: 'https://github.com/user-attachments/files/1/a.txt', contentHash: H('1') },
            { url: 'https://github.com/user-attachments/files/1/a.txt', contentHash: H('2') },
          ],
        }),
      () =>
        buildPullRequestSnapshot({
          ...PR_INPUT,
          authorResponses: [
            { requestId: 'R1', commentId: 10, contentHash: null },
            { requestId: 'R1', commentId: 10, contentHash: H('e') },
          ],
        }),
      () =>
        buildPullRequestSnapshot({
          ...PR_INPUT,
          linkedIssues: [
            { repository: 'octo/widgets', number: 7, contentHash: H('c') },
            { repository: 'octo/widgets', number: 8, contentHash: H('9') },
          ],
        }),
      () => buildPullRequestSnapshot({ ...PR_INPUT, body: '\ud800' }),
    ];
    for (const runCase of cases) {
      const result = runCase();
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.failure.code).toBe('snapshot.invalid');
      expect(result.failure.cause).toBe('steward-defect');
      expect(result.failure.outcome).toBe('inconclusive');
    }

    const extraKeySnapshot = { ...(buildPullRequestSnapshot(PR_INPUT) as { ok: true; value: Snapshot }).value, extra: true };
    const hashResult = snapshotHash(extraKeySnapshot as unknown as Snapshot);
    expect(hashResult.ok).toBe(false);
    if (hashResult.ok) return;
    expect(hashResult.failure.code).toBe('snapshot.invalid');
  });

  it('snapshot accepts a local policy revision', () => {
    const LOCAL = 'local:' + 'a'.repeat(64);

    const issueResult = buildIssueSnapshot({ ...ISSUE_INPUT, policyRevision: LOCAL });
    const prResult = buildPullRequestSnapshot({ ...PR_INPUT, policyRevision: LOCAL });
    expect(issueResult.ok).toBe(true);
    expect(prResult.ok).toBe(true);
    if (!issueResult.ok || !prResult.ok) return;
    expect(issueResult.value.policy_revision).toBe(LOCAL);
    expect(issueResult.value.snapshot_version).toBe(1);
    expect(prResult.value.policy_revision).toBe(LOCAL);
    expect(prResult.value.snapshot_version).toBe(1);

    const gitIssueResult = buildIssueSnapshot(ISSUE_INPUT);
    const gitPrResult = buildPullRequestSnapshot(PR_INPUT);
    expect(gitIssueResult.ok).toBe(true);
    expect(gitPrResult.ok).toBe(true);
    if (!gitIssueResult.ok || !gitPrResult.ok) return;
    expect(snapshotHash(issueResult.value)).not.toEqual(snapshotHash(gitIssueResult.value));
    expect(snapshotHash(prResult.value)).not.toEqual(snapshotHash(gitPrResult.value));

    for (const invalidRevision of ['local:abc', 'HEAD']) {
      const badIssue = buildIssueSnapshot({ ...ISSUE_INPUT, policyRevision: invalidRevision });
      const badPr = buildPullRequestSnapshot({ ...PR_INPUT, policyRevision: invalidRevision });
      expect(badIssue.ok).toBe(false);
      expect(badPr.ok).toBe(false);
      if (!badIssue.ok) {
        expect(badIssue.failure.code).toBe('snapshot.invalid');
      }
      if (!badPr.ok) {
        expect(badPr.failure.code).toBe('snapshot.invalid');
      }
    }

    const golden = snapshotHash(gitPrResult.value);
    expect(golden.ok).toBe(true);
    if (!golden.ok) return;
    expect(golden.value).toBe('sha256:c51c7fb289f3d86237aa171fbd7db4424ec96393edebaa923429774e2685021b');

    const schemaResult = snapshotSchema.safeParse(prResult.value);
    expect(schemaResult.success).toBe(true);
  });
});
