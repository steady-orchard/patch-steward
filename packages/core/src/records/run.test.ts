import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';

import { runRecordSchema } from './run.js';

const validRun = {
  schema_version: 1,
  record_type: 'run',
  run_id: 100,
  run_attempt: 1,
  subject: {
    kind: 'submission',
    repository: 'octo/widgets',
    type: 'pull_request',
    number: 42,
    snapshot_hash: `sha256:${'b'.repeat(64)}`,
  },
  commits: {
    base: 'a'.repeat(40),
    head: 'a'.repeat(40),
    group: null,
  },
  owned_check_id: 7,
  policy_revision: 'a'.repeat(40),
  steward_version: '1.0.0',
  provider: 'copilot-sdk',
  requested_model: 'gpt-5',
  reported_model: 'gpt-5',
  adapter_version: '1.0.0',
  generation: { temperature: 0.2 },
  runner_identity: 'runner-1',
  mode: 'enforce',
  started_at: '2026-09-26T12:00:00Z',
  finished_at: null,
  budget: {
    model_calls: 1,
    tokens: 100,
    ai_credits: 0.5,
    container_seconds: 10,
    executions: 1,
    github_requests: 1,
    retries: 0,
  },
} as const;

describe('record run', () => {
  it('record run accepts a fixture instance', () => {
    const parsed = runRecordSchema.parse(validRun);
    expect(parsed.run_id).toBe(100);
    expect(canonicalJsonHash(parsed).ok).toBe(true);
  });

  it('record run rejects an unknown key', () => {
    const withExtra = { ...validRun, extra: 'nope' };
    expect(runRecordSchema.safeParse(withExtra).success).toBe(false);
  });

  it('record run rejects a wrong schema_version', () => {
    const wrongVersion = { ...validRun, schema_version: 2 };
    expect(runRecordSchema.safeParse(wrongVersion).success).toBe(false);
  });

  it('record run accepts a merge-group subject with unknown budget values', () => {
    const mergeGroup = {
      ...validRun,
      subject: {
        kind: 'merge-group',
        repository: 'octo/widgets',
        group_ref: 'gh-readonly-queue/main/pr-42',
        snapshot_hash: `sha256:${'c'.repeat(64)}`,
      },
      budget: {
        model_calls: null,
        tokens: null,
        ai_credits: null,
        container_seconds: null,
        executions: null,
        github_requests: null,
        retries: null,
      },
    };
    expect(runRecordSchema.safeParse(mergeGroup).success).toBe(true);
  });
});
