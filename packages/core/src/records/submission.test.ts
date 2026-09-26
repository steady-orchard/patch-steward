import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';

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

  it('record submission rejects an unknown field id', () => {
    const bad = { ...validSubmission, fields: { 'not-a-field': 'x' } };
    expect(submissionRecordSchema.safeParse(bad).success).toBe(false);
  });

  it('record submission rejects a __proto__ field key', () => {
    const fields = JSON.parse('{"__proto__":"x"}') as Record<string, unknown>;
    const bad = { ...validSubmission, fields };
    expect(submissionRecordSchema.safeParse(bad).success).toBe(false);
  });
});
