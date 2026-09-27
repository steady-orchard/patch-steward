import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';
import { buildIssueSnapshot, buildPullRequestSnapshot, snapshotHash } from '../submission/snapshot.js';

import { submissionRecordSchema } from './submission.js';

const validSubmission = {
  schema_version: 1,
  record_type: 'submission',
  repository: 'octo/widgets',
  type: 'pull_request',
  number: 42,
  snapshot_hash: `sha256:${'b'.repeat(64)}`,
  target_branch: 'main',
  head_commit: 'a'.repeat(40),
  issue_kind: null,
  category: 'bugfix',
  fields: {
    category: 'bugfix',
    problem: 'a bug',
  },
  linked_evidence_hashes: [],
  author_responses: [],
  shared_head_pull_requests: [],
  contract_results: [],
  trusted_paths_changed: false,
  execution_sensitive_paths_changed: false,
} as const;

describe('record submission', () => {
  it('record submission accepts a fixture instance', () => {
    const parsed = submissionRecordSchema.parse(validSubmission);
    expect(parsed.repository).toBe('octo/widgets');
    expect(canonicalJsonHash(parsed).ok).toBe(true);
  });

  it('record submission rejects an unknown key', () => {
    const withExtra = { ...validSubmission, extra: 'nope' };
    expect(submissionRecordSchema.safeParse(withExtra).success).toBe(false);
  });

  it('record submission rejects a wrong schema_version', () => {
    const wrongVersion = { ...validSubmission, schema_version: 2 };
    expect(submissionRecordSchema.safeParse(wrongVersion).success).toBe(false);
  });

  it('record submission rejects a pull request without head and target', () => {
    const missing = { ...validSubmission, head_commit: null, target_branch: null };
    expect(submissionRecordSchema.safeParse(missing).success).toBe(false);
  });

  it('record submission rejects an issue carrying pull request fields', () => {
    const issue = {
      ...validSubmission,
      type: 'issue',
      issue_kind: 'defect',
      category: null,
      head_commit: null,
      target_branch: 'main',
      trusted_paths_changed: null,
      execution_sensitive_paths_changed: null,
    };
    expect(submissionRecordSchema.safeParse(issue).success).toBe(false);
  });

  it('record submission accepts an unstructured issue record', () => {
    const issue = {
      ...validSubmission,
      type: 'issue',
      issue_kind: null,
      template: null,
      category: null,
      fields: {},
      target_branch: null,
      head_commit: null,
      trusted_paths_changed: null,
      execution_sensitive_paths_changed: null,
      shared_head_pull_requests: [],
    };
    expect(submissionRecordSchema.safeParse(issue).success).toBe(true);
  });

  it('record submission rejects a null issue_kind unless template is null', () => {
    const base = {
      ...validSubmission,
      type: 'issue',
      issue_kind: null,
      category: null,
      fields: {},
      target_branch: null,
      head_commit: null,
      trusted_paths_changed: null,
      execution_sensitive_paths_changed: null,
      shared_head_pull_requests: [],
    } as Record<string, unknown>;
    const withoutTemplate = { ...base };
    delete withoutTemplate.template;
    expect(submissionRecordSchema.safeParse(withoutTemplate).success).toBe(false);

    const withTemplate = { ...base, template: { form: 'defect', version: 1 } };
    expect(submissionRecordSchema.safeParse(withTemplate).success).toBe(false);
  });

  it('record submission rejects an unknown field id', () => {
    const bad = { ...validSubmission, fields: { 'not-a-field': 'x' } };
    expect(submissionRecordSchema.safeParse(bad).success).toBe(false);
  });

  it('record submission rejects a __proto__ field key', () => {
    const fields = JSON.parse('{"__proto__":"x"}') as Record<string, unknown>;
    const bad = { ...validSubmission, fields };
    expect(submissionRecordSchema.safeParse(bad).success).toBe(false);
  });

  it('record submission accepts a record without the new keys', () => {
    expect(submissionRecordSchema.safeParse(validSubmission).success).toBe(true);
  });

  it('record submission accepts every new optional key', () => {
    const prSnapshotResult = buildPullRequestSnapshot({
      repository: 'octo/widgets',
      number: 42,
      title: 't',
      body: 'x',
      targetBranch: 'main',
      headCommit: 'a'.repeat(40),
      baseCommit: 'b'.repeat(40),
      linkedIssues: [],
      attachments: [],
      authorResponses: [],
      sharedHeadPullRequests: [],
      policyRevision: 'f'.repeat(40),
    });
    expect(prSnapshotResult.ok).toBe(true);
    if (!prSnapshotResult.ok) {
      return;
    }
    const prSnapshot = prSnapshotResult.value;
    const prSnapshotHashResult = snapshotHash(prSnapshot);
    expect(prSnapshotHashResult.ok).toBe(true);
    if (!prSnapshotHashResult.ok) {
      return;
    }

    const prRecord = {
      ...validSubmission,
      snapshot_hash: prSnapshotHashResult.value,
      snapshot: prSnapshot,
      template: { form: 'pull_request', version: 1 },
      policy_change: {
        changed: true,
        proposed: {
          status: 'invalid',
          revision: 'e'.repeat(40),
          errors: [{ code: 'policy.invalid-value', path: 'limits.caps.daily_runs', message: 'x', line: 3, column: 5 }],
        },
      },
      attachments: [
        {
          url: 'https://github.com/user-attachments/files/1/a.zip',
          format: 'zip',
          bytes: 10,
          content_hash: `sha256:${'d'.repeat(64)}`,
          required: true,
          entries: [{ name: 'a.txt', bytes: 3 }],
        },
      ],
      claim_scope_hash: `sha256:${'c'.repeat(64)}`,
    };
    expect(submissionRecordSchema.safeParse(prRecord).success).toBe(true);
    expect(submissionRecordSchema.safeParse({ ...prRecord, policy_change: { changed: false, proposed: null } }).success).toBe(true);

    const issueSnapshotResult = buildIssueSnapshot({
      repository: 'octo/widgets',
      number: 7,
      title: 't',
      body: 'x',
      attachments: [],
      authorResponses: [],
      policyRevision: 'f'.repeat(40),
    });
    expect(issueSnapshotResult.ok).toBe(true);
    if (!issueSnapshotResult.ok) {
      return;
    }
    const issueSnapshot = issueSnapshotResult.value;
    const issueSnapshotHashResult = snapshotHash(issueSnapshot);
    expect(issueSnapshotHashResult.ok).toBe(true);
    if (!issueSnapshotHashResult.ok) {
      return;
    }

    const issueRecord = {
      ...validSubmission,
      type: 'issue',
      number: 7,
      issue_kind: 'defect',
      category: null,
      target_branch: null,
      head_commit: null,
      trusted_paths_changed: null,
      execution_sensitive_paths_changed: null,
      snapshot_hash: issueSnapshotHashResult.value,
      snapshot: issueSnapshot,
      template: { form: 'defect', version: 1 },
      attachments: [],
      claim_scope_hash: null,
    };
    expect(submissionRecordSchema.safeParse(issueRecord).success).toBe(true);
  });

  it('record submission rejects a snapshot that disagrees with the record', () => {
    const prSnapshotResult = buildPullRequestSnapshot({
      repository: 'octo/widgets',
      number: 43,
      title: 't',
      body: 'x',
      targetBranch: 'main',
      headCommit: 'a'.repeat(40),
      baseCommit: 'b'.repeat(40),
      linkedIssues: [],
      attachments: [],
      authorResponses: [],
      sharedHeadPullRequests: [],
      policyRevision: 'f'.repeat(40),
    });
    expect(prSnapshotResult.ok).toBe(true);
    if (!prSnapshotResult.ok) {
      return;
    }
    const wrongNumberSnapshot = prSnapshotResult.value;
    const wrongNumberHashResult = snapshotHash(wrongNumberSnapshot);
    expect(wrongNumberHashResult.ok).toBe(true);
    if (!wrongNumberHashResult.ok) {
      return;
    }
    const wrongNumberRecord = {
      ...validSubmission,
      snapshot: wrongNumberSnapshot,
      snapshot_hash: wrongNumberHashResult.value,
    };
    expect(submissionRecordSchema.safeParse(wrongNumberRecord).success).toBe(false);

    const matchingSnapshotResult = buildPullRequestSnapshot({
      repository: 'octo/widgets',
      number: 42,
      title: 't',
      body: 'x',
      targetBranch: 'main',
      headCommit: 'c'.repeat(40),
      baseCommit: 'b'.repeat(40),
      linkedIssues: [],
      attachments: [],
      authorResponses: [],
      sharedHeadPullRequests: [],
      policyRevision: 'f'.repeat(40),
    });
    expect(matchingSnapshotResult.ok).toBe(true);
    if (!matchingSnapshotResult.ok) {
      return;
    }
    const wrongHeadCommitSnapshot = matchingSnapshotResult.value;
    const wrongHeadCommitHashResult = snapshotHash(wrongHeadCommitSnapshot);
    expect(wrongHeadCommitHashResult.ok).toBe(true);
    if (!wrongHeadCommitHashResult.ok) {
      return;
    }
    const wrongHeadCommitRecord = {
      ...validSubmission,
      snapshot: wrongHeadCommitSnapshot,
      snapshot_hash: wrongHeadCommitHashResult.value,
    };
    expect(submissionRecordSchema.safeParse(wrongHeadCommitRecord).success).toBe(false);

    const issueSnapshotResult = buildIssueSnapshot({
      repository: 'octo/widgets',
      number: 42,
      title: 't',
      body: 'x',
      attachments: [],
      authorResponses: [],
      policyRevision: 'f'.repeat(40),
    });
    expect(issueSnapshotResult.ok).toBe(true);
    if (!issueSnapshotResult.ok) {
      return;
    }
    const issueSnapshotOnPrRecord = {
      ...validSubmission,
      snapshot: issueSnapshotResult.value,
      snapshot_hash: validSubmission.snapshot_hash,
    };
    expect(submissionRecordSchema.safeParse(issueSnapshotOnPrRecord).success).toBe(false);
  });

  it('record submission rejects a wrong snapshot hash', () => {
    const prSnapshotResult = buildPullRequestSnapshot({
      repository: 'octo/widgets',
      number: 42,
      title: 't',
      body: 'x',
      targetBranch: 'main',
      headCommit: 'a'.repeat(40),
      baseCommit: 'b'.repeat(40),
      linkedIssues: [],
      attachments: [],
      authorResponses: [],
      sharedHeadPullRequests: [],
      policyRevision: 'f'.repeat(40),
    });
    expect(prSnapshotResult.ok).toBe(true);
    if (!prSnapshotResult.ok) {
      return;
    }
    const record = {
      ...validSubmission,
      snapshot: prSnapshotResult.value,
      snapshot_hash: `sha256:${'0'.repeat(64)}`,
    };
    expect(submissionRecordSchema.safeParse(record).success).toBe(false);
  });

  it('record submission couples policy change and proposed result', () => {
    expect(submissionRecordSchema.safeParse({ ...validSubmission, policy_change: { changed: true, proposed: null } }).success).toBe(
      false,
    );
    expect(
      submissionRecordSchema.safeParse({ ...validSubmission, policy_change: { changed: false, proposed: { status: 'removed' } } })
        .success,
    ).toBe(false);
    expect(
      submissionRecordSchema.safeParse({ ...validSubmission, policy_change: { changed: true, proposed: { status: 'removed' } } })
        .success,
    ).toBe(true);
  });

  it('record submission rejects pull request keys on issues', () => {
    const issueBase = {
      ...validSubmission,
      type: 'issue',
      issue_kind: 'defect',
      category: null,
      head_commit: null,
      target_branch: 'main',
      trusted_paths_changed: null,
      execution_sensitive_paths_changed: null,
    };
    expect(submissionRecordSchema.safeParse({ ...issueBase, policy_change: { changed: false, proposed: null } }).success).toBe(
      false,
    );
    expect(submissionRecordSchema.safeParse({ ...issueBase, claim_scope_hash: `sha256:${'c'.repeat(64)}` }).success).toBe(false);
    expect(submissionRecordSchema.safeParse({ ...issueBase, template: { form: 'proposal', version: 1 } }).success).toBe(false);
  });

  it('record submission bounds attachment fields', () => {
    const baseAttachment = {
      url: 'https://github.com/user-attachments/files/1/a.zip',
      format: 'zip',
      bytes: 10,
      content_hash: `sha256:${'d'.repeat(64)}`,
      required: true,
      entries: null,
    };
    expect(
      submissionRecordSchema.safeParse({ ...validSubmission, attachments: [{ ...baseAttachment, format: 'EXE' }] }).success,
    ).toBe(false);
    expect(
      submissionRecordSchema.safeParse({
        ...validSubmission,
        attachments: [{ ...baseAttachment, entries: [{ name: 'a'.repeat(513), bytes: 1 }] }],
      }).success,
    ).toBe(false);
    expect(
      submissionRecordSchema.safeParse({
        ...validSubmission,
        attachments: [{ ...baseAttachment, url: 'http://x/a' }],
      }).success,
    ).toBe(false);
    expect(
      submissionRecordSchema.safeParse({
        ...validSubmission,
        attachments: [{ ...baseAttachment, unknown: 'x' }],
      }).success,
    ).toBe(false);
  });
});
