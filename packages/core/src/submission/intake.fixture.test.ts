import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { captureIssue, capturePullRequest } from './intake.js';
import type { CaptureContext } from './intake.js';
import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import { DEFAULT_CHECKLIST_POLICY } from './default-checklist.js';
import { submissionRecordSchema } from '../records/submission.js';
import { snapshotHash } from './snapshot.js';
import type { Snapshot } from './snapshot.js';
import type { ResolvedPolicy } from '../policy/schema.js';

function requireSnapshot(snapshot: Snapshot | undefined): Snapshot {
  expect(snapshot).toBeDefined();
  if (snapshot === undefined) {
    throw new Error('snapshot must be defined');
  }
  return snapshot;
}

const githubFixturesDir = fileURLToPath(new URL('../../../../fixtures/github/', import.meta.url));
const submissionsDir = fileURLToPath(new URL('../../../../fixtures/submissions/', import.meta.url));

function crlfToLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function readJsonFixture(relative: string): unknown {
  const text = readFileSync(githubFixturesDir + relative, 'utf8');
  return JSON.parse(text);
}

function readSubmissionBody(name: string): string {
  return crlfToLf(readFileSync(submissionsDir + name, 'utf8'));
}

const REPOSITORY = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
const ACTIVE_REVISION = 'd'.repeat(40);

const NOT_FOUND_BODY = JSON.stringify({ message: 'Not Found' });

interface RouteMap {
  readonly [pathname: string]: unknown;
}

function fetchFor(routes: RouteMap): GitHubFetch {
  return (url) => {
    const pathname = new URL(url).pathname;
    const value = routes[pathname];
    if (value === undefined) {
      return Promise.resolve(new Response(NOT_FOUND_BODY, { status: 404 }));
    }
    return Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
  };
}

function failingResolver(): never {
  throw new Error('attachment resolver should not be called');
}

function failingTransport(): never {
  throw new Error('attachment transport should not be called');
}

function contextFor(routes: RouteMap, policy?: ResolvedPolicy): CaptureContext {
  return {
    client: createGitHubClient({
      token: null,
      budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }),
      fetch: fetchFor(routes),
    }),
    repository: REPOSITORY,
    policy: policy ?? structuredClone(DEFAULT_CHECKLIST_POLICY),
    policyRevision: ACTIVE_REVISION,
    attachmentResolver: failingResolver,
    attachmentTransport: failingTransport,
    authorResponses: [],
  };
}

const REPO_PATH = '/repos/steady-orchard/patch-steward-testbed-public';

function withBody(fixture: unknown, body: string): unknown {
  return { ...(fixture as Record<string, unknown>), body };
}

describe('submission intake fixture capture', () => {
  it('capture: defect issue from recorded responses', async () => {
    const routes: RouteMap = {
      [REPO_PATH]: readJsonFixture('testbed/repository.json'),
      [`${REPO_PATH}/issues/29`]: withBody(readJsonFixture('testbed/issue-29.json'), readSubmissionBody('defect-complete.txt')),
    };
    const context = contextFor(routes);
    const result = await captureIssue(context, 29);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.contract.disposition).toBe('met');
    expect(result.value.issueKind).toBe('defect');
    expect(result.value.contract.template).toEqual({ form: 'defect', version: 1 });

    const record = result.value.record;
    expect(submissionRecordSchema.safeParse(record).success).toBe(true);
    expect(record).not.toBeNull();
    if (record === null) return;
    const snapshot = requireSnapshot(record.snapshot);
    const hashResult = snapshotHash(snapshot);
    expect(hashResult.ok).toBe(true);
    if (hashResult.ok) {
      expect(record.snapshot_hash).toBe(hashResult.value);
    }
    expect(snapshot.policy_revision).toBe(ACTIVE_REVISION);
  });

  it('capture: proposal issue from recorded responses', async () => {
    const routes: RouteMap = {
      [REPO_PATH]: readJsonFixture('testbed/repository.json'),
      [`${REPO_PATH}/issues/30`]: withBody(readJsonFixture('testbed/issue-30.json'), readSubmissionBody('proposal-complete.txt')),
    };
    const context = contextFor(routes);
    const result = await captureIssue(context, 30);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.contract.disposition).toBe('met');
    expect(result.value.issueKind).toBe('proposal');

    const record = result.value.record;
    expect(submissionRecordSchema.safeParse(record).success).toBe(true);
    expect(record).not.toBeNull();
    if (record === null) return;
    const snapshot = requireSnapshot(record.snapshot);
    const hashResult = snapshotHash(snapshot);
    expect(hashResult.ok).toBe(true);
    if (hashResult.ok) {
      expect(record.snapshot_hash).toBe(hashResult.value);
    }
    expect(snapshot.policy_revision).toBe(ACTIVE_REVISION);
  });

  it('capture: bugfix pull request is met from recorded responses', async () => {
    const routes: RouteMap = {
      [REPO_PATH]: readJsonFixture('testbed/repository.json'),
      [`${REPO_PATH}/pulls/26`]: withBody(readJsonFixture('testbed/pull-26.json'), readSubmissionBody('pr-bugfix-complete.txt')),
      [`${REPO_PATH}/pulls/26/files`]: readJsonFixture('testbed/pull-26-files.json'),
      [`${REPO_PATH}/issues/29`]: readJsonFixture('testbed/issue-29.json'),
      [`${REPO_PATH}/commits/b46eef5018c202bcb2470bf62e3defd7496ec65b/pulls`]: readJsonFixture('testbed/commit-pulls-b46eef5.json'),
    };
    const context = contextFor(routes);
    const result = await capturePullRequest(context, 26);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.contract.disposition).toBe('met');
    expect(result.value.contract.findings).toEqual([]);
    expect(result.value.record.category).toBe('bugfix');
    expect(result.value.snapshot.linked_issues[0]?.number).toBe(29);
    expect(result.value.snapshot.shared_head_pull_requests).toEqual([]);
    expect(result.value.snapshot.base_commit).toBe('1c5c399b48a0ccca6a9989eacb6ebc2279e6a9c9');
    expect(result.value.record.claim_scope_hash).not.toBeNull();

    const record = result.value.record;
    expect(submissionRecordSchema.safeParse(record).success).toBe(true);
    const snapshot = requireSnapshot(record.snapshot);
    const hashResult = snapshotHash(snapshot);
    expect(hashResult.ok).toBe(true);
    if (hashResult.ok) {
      expect(record.snapshot_hash).toBe(hashResult.value);
    }
    expect(snapshot.policy_revision).toBe(ACTIVE_REVISION);
  });

  it('capture: shared head pull request needs changes from recorded responses', async () => {
    const commitPulls = readJsonFixture('testbed/commit-pulls-b46eef5.json') as readonly Record<string, unknown>[];
    const original = commitPulls[0] as Record<string, unknown>;
    const openOriginal = { ...original, state: 'open' };
    const openSibling = { ...original, number: 31, state: 'open' };

    const routes: RouteMap = {
      [REPO_PATH]: readJsonFixture('testbed/repository.json'),
      [`${REPO_PATH}/pulls/26`]: withBody(readJsonFixture('testbed/pull-26.json'), readSubmissionBody('pr-bugfix-complete.txt')),
      [`${REPO_PATH}/pulls/26/files`]: readJsonFixture('testbed/pull-26-files.json'),
      [`${REPO_PATH}/issues/29`]: readJsonFixture('testbed/issue-29.json'),
      [`${REPO_PATH}/commits/b46eef5018c202bcb2470bf62e3defd7496ec65b/pulls`]: [openOriginal, openSibling],
    };
    const context = contextFor(routes);
    const result = await capturePullRequest(context, 26);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.contract.disposition).toBe('needs-changes');
    expect(result.value.contract.findings.some((f) => f.code === 'submission.shared-head')).toBe(true);
    expect(result.value.snapshot.shared_head_pull_requests).toEqual([31]);

    const record = result.value.record;
    expect(submissionRecordSchema.safeParse(record).success).toBe(true);
    const snapshot = requireSnapshot(record.snapshot);
    const hashResult = snapshotHash(snapshot);
    expect(hashResult.ok).toBe(true);
    if (hashResult.ok) {
      expect(record.snapshot_hash).toBe(hashResult.value);
    }
    expect(snapshot.policy_revision).toBe(ACTIVE_REVISION);
  });

  it('capture: policy change is flagged and not applied from recorded responses', async () => {
    const routes: RouteMap = {
      [REPO_PATH]: readJsonFixture('testbed/repository.json'),
      [`${REPO_PATH}/pulls/26`]: withBody(readJsonFixture('testbed/pull-26.json'), readSubmissionBody('pr-chore.txt')),
      [`${REPO_PATH}/pulls/26/files`]: [{ filename: '.github/patch-steward/policy.yml', status: 'modified' }],
      [`${REPO_PATH}/commits/b46eef5018c202bcb2470bf62e3defd7496ec65b/pulls`]: readJsonFixture('testbed/commit-pulls-b46eef5.json'),
      [`${REPO_PATH}/contents/.github`]: readJsonFixture('policy-directory/contents-github.json'),
      [`${REPO_PATH}/git/trees/a8c2485882b52f63db71b1ec63b12f5039220e03`]: readJsonFixture('policy-directory/tree.json'),
      [`${REPO_PATH}/git/blobs/716098133e97314ccf047f5034cc8f76161d8f0d`]: readJsonFixture('policy-directory/blob-policy.json'),
    };
    const context = contextFor(routes);
    const result = await capturePullRequest(context, 26);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.contract.disposition).toBe('met');
    const codes = result.value.contract.findings.map((f) => f.code);
    expect(codes).toContain('submission.policy-change');
    expect(codes).toContain('submission.trusted-path-change');

    const record = result.value.record;
    expect(record.policy_change).toEqual({
      changed: true,
      proposed: { status: 'valid', revision: 'a8c2485882b52f63db71b1ec63b12f5039220e03' },
    });
    expect(record.trusted_paths_changed).toBe(true);
    const snapshot = requireSnapshot(record.snapshot);
    expect(snapshot.policy_revision).toBe(ACTIVE_REVISION);

    expect(submissionRecordSchema.safeParse(record).success).toBe(true);
    const hashResult = snapshotHash(snapshot);
    expect(hashResult.ok).toBe(true);
    if (hashResult.ok) {
      expect(record.snapshot_hash).toBe(hashResult.value);
    }
  });
});
