import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';

import { maintainerActionRecordSchema } from './maintainer-action.js';

const validAction = {
  schema_version: 1,
  record_type: 'maintainer-action',
  run_id: 100,
  run_attempt: 1,
  actor: 'octocat',
  kind: 'override',
  reason: 'manual approval after manual review',
  recorded_at: '2026-09-26T12:00:00Z',
  resolution_code: null,
  scope: {
    scope_type: 'pull-request-head',
    repository: 'octo/widgets',
    number: 42,
    head_commit: 'a'.repeat(40),
    target_branch: 'main',
    requirements: ['tests-pass'],
  },
} as const;

describe('record maintainer-action', () => {
  it('record maintainer-action accepts a fixture instance', () => {
    const parsed = maintainerActionRecordSchema.parse(validAction);
    expect(parsed.kind).toBe('override');
    expect(canonicalJsonHash(parsed).ok).toBe(true);
  });

  it('record maintainer-action rejects an unknown key', () => {
    const withExtra = { ...validAction, extra: 'nope' };
    expect(maintainerActionRecordSchema.safeParse(withExtra).success).toBe(false);
  });

  it('record maintainer-action rejects a wrong schema_version', () => {
    const wrongVersion = { ...validAction, schema_version: 2 };
    expect(maintainerActionRecordSchema.safeParse(wrongVersion).success).toBe(false);
  });

  it('record maintainer-action binds PR acceptance to the claim scope hash', () => {
    const withClaim = {
      ...validAction,
      kind: 'acceptance',
      scope: {
        scope_type: 'pull-request-claim',
        repository: 'octo/widgets',
        number: 42,
        target_branch: 'main',
        claim_scope_hash: `sha256:${'b'.repeat(64)}`,
      },
    };
    expect(maintainerActionRecordSchema.safeParse(withClaim).success).toBe(true);

    const withHead = { ...validAction, kind: 'acceptance' };
    expect(maintainerActionRecordSchema.safeParse(withHead).success).toBe(false);
  });

  it('record maintainer-action binds issue acceptance to the proposal content hash', () => {
    const withProposal = {
      ...validAction,
      kind: 'acceptance',
      scope: {
        scope_type: 'issue-proposal',
        repository: 'octo/widgets',
        number: 42,
        proposal_content_hash: `sha256:${'c'.repeat(64)}`,
      },
    };
    expect(maintainerActionRecordSchema.safeParse(withProposal).success).toBe(true);

    const withSnapshot = {
      ...validAction,
      kind: 'acceptance',
      scope: {
        scope_type: 'issue-snapshot',
        repository: 'octo/widgets',
        number: 42,
        snapshot_hash: `sha256:${'d'.repeat(64)}`,
      },
    };
    expect(maintainerActionRecordSchema.safeParse(withSnapshot).success).toBe(false);
  });

  it('record maintainer-action requires a resolution code exactly for resolutions', () => {
    const resolutionWithCode = {
      ...validAction,
      kind: 'resolution',
      resolution_code: 'duplicate',
      scope: {
        scope_type: 'issue-snapshot',
        repository: 'octo/widgets',
        number: 42,
        snapshot_hash: `sha256:${'e'.repeat(64)}`,
      },
    };
    expect(maintainerActionRecordSchema.safeParse(resolutionWithCode).success).toBe(true);

    const resolutionWithoutCode = { ...resolutionWithCode, resolution_code: null };
    expect(maintainerActionRecordSchema.safeParse(resolutionWithoutCode).success).toBe(false);

    const overrideWithCode = { ...validAction, resolution_code: 'duplicate' };
    expect(maintainerActionRecordSchema.safeParse(overrideWithCode).success).toBe(false);
  });

  it('record maintainer-action rejects an unknown scope field', () => {
    const withExtraScopeField = {
      ...validAction,
      scope: { ...validAction.scope, extra_field: 'nope' },
    };
    expect(maintainerActionRecordSchema.safeParse(withExtraScopeField).success).toBe(false);
  });
});
