import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { DEFAULT_CHECKLIST_POLICY } from './default-checklist.js';
import type {
  AttachmentAddress,
  AttachmentResolver,
  AttachmentTransport,
  AttachmentTransportResponse,
} from '../net/attachment-fetch.js';
import { submissionRecordSchema } from '../records/submission.js';
import { snapshotHash } from './snapshot.js';
import { contentHash } from '../hash.js';
import { checkContract } from './contract.js';
import type { CaptureContext } from './intake.js';
import { buildSubmissionRecord, captureIssue, capturePullRequest } from './intake.js';

const HEAD_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const TREE_SHA = 'c'.repeat(40);
const BLOB_SHA = 'e'.repeat(40);
const POLICY_REVISION = 'd'.repeat(40);
const REPO: GitHubRepositoryRef = { owner: 'octo', name: 'demo' };

function readFixture(name: string): string {
  return readFileSync(new URL(`../../../../fixtures/submissions/${name}`, import.meta.url), 'utf8');
}

function readTemplatePolicyBytes(): Buffer {
  return readFileSync(new URL('../../../../templates/policy/policy.yml', import.meta.url));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

type RouteMap = Record<string, (url: URL) => Response>;

function routedFetch(routes: RouteMap): GitHubFetch {
  return (url: string) => {
    const parsed = new URL(url);
    const handler = routes[parsed.pathname];
    if (!handler) {
      throw new Error(`unrouted path ${parsed.pathname}`);
    }
    return Promise.resolve(handler(parsed));
  };
}

function repoResponse(): unknown {
  return { full_name: 'octo/demo', default_branch: 'main', private: false };
}

function issueResponse(number: number, body: string | null, title = 'issue title'): unknown {
  return { number, title, body, state: 'open', user: null, author_association: 'NONE' };
}

function issueAsPullRequestResponse(number: number): unknown {
  return {
    number,
    title: 'pr title',
    body: 'x',
    state: 'open',
    user: null,
    author_association: 'NONE',
    pull_request: {},
  };
}

function pullRequestResponse(options: {
  readonly number: number;
  readonly body: string | null;
  readonly headSha?: string;
  readonly baseSha?: string;
  readonly baseRef?: string;
  readonly changedFiles?: number;
  readonly title?: string;
}): unknown {
  return {
    number: options.number,
    title: options.title ?? 'pr title',
    body: options.body,
    state: 'open',
    draft: false,
    head: { sha: options.headSha ?? HEAD_SHA, ref: 'feature' },
    base: { sha: options.baseSha ?? BASE_SHA, ref: options.baseRef ?? 'main' },
    user: null,
    author_association: 'NONE',
    changed_files: options.changedFiles ?? 1,
  };
}

function fileEntry(filename: string, status = 'modified'): unknown {
  return { filename, status };
}

function fakeResolver(): AttachmentResolver {
  return async (): Promise<readonly AttachmentAddress[]> => [{ address: '140.82.112.3', family: 4 }];
}

function bodyFrom(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      let sent = false;
      return {
        async next(): Promise<IteratorResult<Uint8Array>> {
          if (!sent) {
            sent = true;
            return { done: false, value: bytes };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
}

function fakeTransport(bytes: Uint8Array): AttachmentTransport {
  return async (): Promise<AttachmentTransportResponse> => ({
    kind: 'response',
    status: 200,
    location: null,
    body: bodyFrom(bytes),
    close: () => undefined,
  });
}

function makeContext(fetch: GitHubFetch, overrides: Partial<CaptureContext> = {}): CaptureContext {
  const client = createGitHubClient({
    token: null,
    budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }),
    fetch,
  });
  return {
    client,
    repository: REPO,
    policy: structuredClone(DEFAULT_CHECKLIST_POLICY),
    policyRevision: POLICY_REVISION,
    attachmentResolver: fakeResolver(),
    attachmentTransport: fakeTransport(new Uint8Array()),
    authorResponses: [],
    ...overrides,
  };
}

function defectBody(overrides: Partial<Record<string, string>> = {}): string {
  const f = {
    'Expected behavior': 'It should return 200.',
    'Authoritative basis': 'docs/api.md#status',
    'Actual behavior': 'It returns 500.',
    'Affected version': '2.0.0',
    'Reproduction command': 'npm run repro',
    'Expected result': 'HTTP 200',
    'Proposed scope': 'fix handler',
    References: '_No response_',
    ...overrides,
  };
  return [
    '### Expected behavior',
    '',
    f['Expected behavior'],
    '',
    '### Authoritative basis',
    '',
    f['Authoritative basis'],
    '',
    '### Actual behavior',
    '',
    f['Actual behavior'],
    '',
    '### Affected version',
    '',
    f['Affected version'],
    '',
    '### Reproduction command',
    '',
    f['Reproduction command'],
    '',
    '### Expected result',
    '',
    f['Expected result'],
    '',
    '### Proposed scope',
    '',
    f['Proposed scope'],
    '',
    '### References',
    '',
    f.References,
    '',
    '### Security claim',
    '',
    '- [ ] This report claims a security problem',
  ].join('\n');
}

function prBody(overrides: Partial<Record<string, string>> = {}): string {
  const f = {
    Category: 'bugfix',
    Problem: 'It fails.',
    Benefit: 'Users are unblocked.',
    'Intended behavior': 'It succeeds.',
    'Acceptance criteria': '- passes',
    'Linked issue': 'Fixes #29',
    'Regression test': 'test/x.test.ts',
    'Test scaffolding': '_No response_',
    'Reproduction command': 'npm test',
    'Expected result': 'green',
    References: 'docs/spec.md',
    ...overrides,
  };
  return [
    '<!-- patch-steward:pr-template v1 -->',
    '',
    '## Category',
    '',
    f.Category,
    '',
    '## Problem',
    '',
    f.Problem,
    '',
    '## Benefit',
    '',
    f.Benefit,
    '',
    '## Intended behavior',
    '',
    f['Intended behavior'],
    '',
    '## Acceptance criteria',
    '',
    f['Acceptance criteria'],
    '',
    '## Linked issue',
    '',
    f['Linked issue'],
    '',
    '## Regression test',
    '',
    f['Regression test'],
    '',
    '## Test scaffolding',
    '',
    f['Test scaffolding'],
    '',
    '## Reproduction command',
    '',
    f['Reproduction command'],
    '',
    '## Expected result',
    '',
    f['Expected result'],
    '',
    '## References',
    '',
    f.References,
  ].join('\n');
}

describe('submission intake', () => {
  it('capture reads a defect issue into a contract result, snapshot, and record', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/issues/5': () => jsonResponse(issueResponse(5, defectBody())),
    };
    const context = makeContext(routedFetch(routes));
    const result = await captureIssue(context, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issueKind).toBe('defect');
    expect(result.value.contract.disposition).toBe('met');
    expect(result.value.record).not.toBeNull();
    const record = result.value.record;
    if (record === null) return;
    expect(submissionRecordSchema.safeParse(record).success).toBe(true);
    expect(record.snapshot).toBeDefined();
    if (record.snapshot === undefined) return;
    const hashResult = snapshotHash(record.snapshot);
    expect(hashResult.ok && hashResult.value).toBe(record.snapshot_hash);
  });

  it('capture leaves the record empty when the issue matches no form', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/issues/6': () => jsonResponse(issueResponse(6, readFixture('unstructured.txt'))),
    };
    const context = makeContext(routedFetch(routes));
    const result = await captureIssue(context, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.issueKind).toBeNull();
    expect(result.value.record).toBeNull();
  });

  it('an unstructured issue builds a valid submission record', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/issues/6': () => jsonResponse(issueResponse(6, readFixture('unstructured.txt'))),
    };
    const context = makeContext(routedFetch(routes));
    const result = await captureIssue(context, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const recordResult = buildSubmissionRecord({
      snapshot: result.value.snapshot,
      issueKind: null,
      body: result.value.body,
      contract: result.value.contract,
      attachments: result.value.attachments,
      claimScopeHash: null,
    });
    expect(recordResult.ok).toBe(true);
    if (!recordResult.ok) return;
    const record = recordResult.value;
    expect(record.issue_kind).toBeNull();
    expect(record.template).toBeNull();
    expect(record.fields).toEqual({});
    expect(submissionRecordSchema.safeParse(record).success).toBe(true);
  });

  it('capture reads a pull request into a contract result, snapshot, and record', async () => {
    const linkedIssueBody = 'The parser crashes on empty input.';
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse({ number: 40, body: prBody() })),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([fileEntry('src/parse.ts')]),
      '/repos/octo/demo/issues/29': () => jsonResponse(issueResponse(29, linkedIssueBody)),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () => jsonResponse([]),
    };
    const context = makeContext(routedFetch(routes));
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contract.disposition).toBe('met');
    expect(result.value.snapshot.base_commit).toBe(BASE_SHA);
    expect(result.value.snapshot.linked_issues).toEqual([
      { repository: 'octo/demo', number: 29, content_hash: contentHash(new TextEncoder().encode(linkedIssueBody)) },
    ]);
    expect(submissionRecordSchema.safeParse(result.value.record).success).toBe(true);
  });

  it('capture excludes the pull request itself from shared heads', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse({ number: 40, body: prBody() })),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([fileEntry('src/parse.ts')]),
      '/repos/octo/demo/issues/29': () => jsonResponse(issueResponse(29, 'body')),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () =>
        jsonResponse([
          { number: 40, state: 'open', head: { sha: HEAD_SHA } },
          { number: 41, state: 'open', head: { sha: HEAD_SHA } },
        ]),
    };
    const context = makeContext(routedFetch(routes));
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.snapshot.shared_head_pull_requests).toEqual([41]);
  });

  it('capture reads the proposed policy at the head commit', async () => {
    const policyBytes = readTemplatePolicyBytes();
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse({ number: 40, body: prBody() })),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([fileEntry('.github/patch-steward/policy.yml')]),
      '/repos/octo/demo/issues/29': () => jsonResponse(issueResponse(29, 'body')),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () => jsonResponse([]),
      '/repos/octo/demo/contents/.github': () =>
        jsonResponse([{ name: 'patch-steward', path: '.github/patch-steward', sha: TREE_SHA, type: 'dir', size: 0 }]),
      [`/repos/octo/demo/git/trees/${TREE_SHA}`]: () =>
        jsonResponse({
          sha: TREE_SHA,
          truncated: false,
          tree: [{ path: 'policy.yml', mode: '100644', type: 'blob', sha: BLOB_SHA, size: policyBytes.length }],
        }),
      [`/repos/octo/demo/git/blobs/${BLOB_SHA}`]: () =>
        jsonResponse({ sha: BLOB_SHA, size: policyBytes.length, encoding: 'base64', content: policyBytes.toString('base64') }),
    };
    const context = makeContext(routedFetch(routes));
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.record.policy_change).toEqual({ changed: true, proposed: { status: 'valid', revision: TREE_SHA } });
    expect(result.value.contract.findings.some((f) => f.code === 'submission.policy-change')).toBe(true);
    expect(result.value.snapshot.policy_revision).toBe(POLICY_REVISION);
  });

  it('capture treats a linked pull request number as an invalid reference', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse({ number: 40, body: prBody() })),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([fileEntry('src/parse.ts')]),
      '/repos/octo/demo/issues/29': () => jsonResponse(issueAsPullRequestResponse(29)),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () => jsonResponse([]),
    };
    const context = makeContext(routedFetch(routes));
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const finding = result.value.contract.findings.find((f) => f.code === 'submission.linked-issue-invalid');
    expect(finding?.detail).toBe('not-an-issue');
  });

  it('capture maps failed linked-issue and shared-head reads to inconclusive', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse({ number: 40, body: prBody() })),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([fileEntry('src/parse.ts')]),
      '/repos/octo/demo/issues/29': () => jsonResponse({}, 500),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () => jsonResponse({}, 500),
    };
    const context = makeContext(routedFetch(routes));
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contract.disposition).toBe('inconclusive');
  });

  it('capture fetches attachments and binds their hashes into the snapshot', async () => {
    const attachmentUrl = 'https://github.com/user-attachments/files/1/log.txt';
    const bodyText = prBody({ References: attachmentUrl });
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse({ number: 40, body: bodyText })),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([fileEntry('src/parse.ts')]),
      '/repos/octo/demo/issues/29': () => jsonResponse(issueResponse(29, 'body')),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () => jsonResponse([]),
    };
    const bytes = new TextEncoder().encode('log contents');
    const context = makeContext(routedFetch(routes), { attachmentTransport: fakeTransport(bytes) });
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.snapshot.attachments).toEqual([{ url: attachmentUrl, content_hash: contentHash(bytes) }]);
    expect(result.value.record.attachments?.[0]?.content_hash).toBe(contentHash(bytes));
  });

  it('capture keeps non-https attachments out of the snapshot and record', async () => {
    const attachmentUrl = 'http://github.com/user-attachments/files/1/log.txt';
    const bodyText = prBody({ References: attachmentUrl });
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse({ number: 40, body: bodyText })),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([fileEntry('src/parse.ts')]),
      '/repos/octo/demo/issues/29': () => jsonResponse(issueResponse(29, 'body')),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () => jsonResponse([]),
    };
    const context = makeContext(routedFetch(routes));
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.snapshot.attachments).toEqual([]);
    expect(result.value.record.attachments).toEqual([]);
    expect(result.value.contract.findings.some((f) => f.code === 'submission.attachment-violation')).toBe(true);
  });

  it('capture computes the claim-scope hash when the claim scope is available', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse({ number: 40, body: prBody() })),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([fileEntry('src/parse.ts')]),
      '/repos/octo/demo/issues/29': () => jsonResponse(issueResponse(29, 'body')),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () => jsonResponse([]),
    };
    const context = makeContext(routedFetch(routes));
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.claimScope.status).toBe('available');
    if (result.value.claimScope.status === 'available') {
      expect(result.value.record.claim_scope_hash).toBe(result.value.claimScope.hash);
    }
  });

  it('capture never puts the title into the snapshot or record', async () => {
    const sentinel = 'sentinel-title-never-leaks';
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse({ number: 40, body: prBody(), title: sentinel })),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([fileEntry('src/parse.ts')]),
      '/repos/octo/demo/issues/29': () => jsonResponse(issueResponse(29, 'body')),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () => jsonResponse([]),
    };
    const context = makeContext(routedFetch(routes));
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.value.snapshot)).not.toContain(sentinel);
    expect(JSON.stringify(result.value.record)).not.toContain(sentinel);
  });

  it('injected failure: capture repository read', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse({}, 500),
    };
    const context = makeContext(routedFetch(routes));
    const result = await captureIssue(context, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.outcome).toBe('inconclusive');
  });

  it('injected failure: capture pull request read', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse({}, 500),
    };
    const context = makeContext(routedFetch(routes));
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.outcome).toBe('inconclusive');
  });

  it('injected failure: capture changed-file read', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse({ number: 40, body: prBody() })),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse({}, 500),
    };
    const context = makeContext(routedFetch(routes));
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.outcome).toBe('inconclusive');
  });

  it('injected failure: capture oversize body', async () => {
    const oversized = 'a'.repeat(65537);
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/issues/5': () => jsonResponse(issueResponse(5, oversized)),
    };
    const context = makeContext(routedFetch(routes));
    const result = await captureIssue(context, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('submission.body-too-large');
  });

  it('submission record builder rejects an invalid record', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/issues/5': () => jsonResponse(issueResponse(5, defectBody())),
    };
    const context = makeContext(routedFetch(routes));
    const captured = await captureIssue(context, 5);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const contract = checkContract({
      type: 'issue',
      repository: { fullName: 'octo/demo', defaultBranch: 'main' },
      policy: context.policy,
      body: captured.value.body,
      requestedKind: 'defect',
      attachments: captured.value.attachments,
    });
    // A defect-form template with a mismatched issueKind fails the template/issue_kind coupling check.
    const result = buildSubmissionRecord({
      snapshot: captured.value.snapshot,
      issueKind: 'proposal',
      body: captured.value.body,
      contract,
      attachments: captured.value.attachments,
      claimScopeHash: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('intake.record-invalid');
  });
});
