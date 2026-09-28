import { describe, expect, it } from 'vitest';
import { appliesListingDeduplication, decideDeduplication, isVerifiedEcho } from './dedup.js';
import type { DedupInput, DedupListingRead, DedupSnapshot } from './dedup.js';

const HASH = 'sha256:' + 'a'.repeat(64);
const OTHER_HASH = 'sha256:' + 'c'.repeat(64);
const REVISION = 'b'.repeat(40);
const OTHER_REVISION = 'd'.repeat(40);

const captured: DedupSnapshot = { snapshotHash: HASH, policyRevision: REVISION };

function baseInput(overrides: Partial<DedupInput> = {}): DedupInput {
  return {
    runAttempt: 1,
    action: 'edited',
    echo: false,
    listing: null,
    fallback: null,
    captured,
    ...overrides,
  };
}

describe('ownership deduplication', () => {
  it('an explicit rerun commits a new owner whatever the snapshot', () => {
    const listing: DedupListingRead = {
      kind: 'unique',
      record: { kind: 'valid', runId: 1, runAttempt: 1, snapshotHash: HASH, policyRevision: REVISION },
    };
    const result = decideDeduplication(baseInput({ runAttempt: 2, listing }));
    expect(result).toEqual({ ok: true, value: { kind: 'commit', reason: 'rerun' } });
  });

  it('a reopened event commits a new owner whatever the snapshot', () => {
    const result = decideDeduplication(baseInput({ action: 'reopened' }));
    expect(result).toEqual({ ok: true, value: { kind: 'commit', reason: 'reopened' } });
  });

  it('an unchanged snapshot and policy revision keep the newest owner', () => {
    const listing: DedupListingRead = {
      kind: 'unique',
      record: { kind: 'valid', runId: 7, runAttempt: 1, snapshotHash: HASH, policyRevision: REVISION },
    };
    const result = decideDeduplication(baseInput({ listing }));
    expect(result).toEqual({
      ok: true,
      value: { kind: 'duplicate', reason: 'owner-unchanged', keptOwner: { runId: 7, runAttempt: 1 } },
    });
  });

  it('a changed snapshot hash commits a new owner', () => {
    const listing: DedupListingRead = {
      kind: 'unique',
      record: { kind: 'valid', runId: 7, runAttempt: 1, snapshotHash: OTHER_HASH, policyRevision: REVISION },
    };
    const result = decideDeduplication(baseInput({ listing }));
    expect(result).toEqual({ ok: true, value: { kind: 'commit', reason: 'snapshot-changed' } });
  });

  it('a changed policy revision commits a new owner', () => {
    const listing: DedupListingRead = {
      kind: 'unique',
      record: { kind: 'valid', runId: 7, runAttempt: 1, snapshotHash: HASH, policyRevision: OTHER_REVISION },
    };
    const result = decideDeduplication(baseInput({ listing }));
    expect(result).toEqual({ ok: true, value: { kind: 'commit', reason: 'snapshot-changed' } });
  });

  it('an unchanged published snapshot without an owner is a duplicate', () => {
    const result = decideDeduplication(
      baseInput({
        listing: { kind: 'none' },
        fallback: { kind: 'published', runId: 3, runAttempt: 1, snapshotHash: HASH, policyRevision: REVISION },
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: { kind: 'duplicate', reason: 'published-unchanged', keptOwner: { runId: 3, runAttempt: 1 } },
    });
  });

  it('a changed published snapshot without an owner commits', () => {
    const result = decideDeduplication(
      baseInput({
        listing: { kind: 'none' },
        fallback: { kind: 'published', runId: 3, runAttempt: 1, snapshotHash: OTHER_HASH, policyRevision: REVISION },
      }),
    );
    expect(result).toEqual({ ok: true, value: { kind: 'commit', reason: 'snapshot-changed' } });
  });

  it('no owner and no published run commits a new owner', () => {
    const result = decideDeduplication(baseInput({ listing: { kind: 'none' }, fallback: { kind: 'none' } }));
    expect(result).toEqual({ ok: true, value: { kind: 'commit', reason: 'no-owner' } });
  });

  it('an ambiguous newest owner commits a new owner', () => {
    const result = decideDeduplication(baseInput({ listing: { kind: 'ambiguous' } }));
    expect(result).toEqual({ ok: true, value: { kind: 'commit', reason: 'owner-ambiguous' } });
  });

  it('an incomplete listing commits a new owner', () => {
    const result = decideDeduplication(baseInput({ listing: { kind: 'incomplete' } }));
    expect(result).toEqual({ ok: true, value: { kind: 'commit', reason: 'listing-incomplete' } });
  });

  it('an unavailable listing fails before commitment', () => {
    const result = decideDeduplication(baseInput({ listing: { kind: 'unavailable' } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('ownership.listing-unavailable');
      expect(result.failure.outcome).toBe('inconclusive');
    }
  });

  it('an unavailable owner record fails before commitment', () => {
    const listing: DedupListingRead = { kind: 'unique', record: { kind: 'unavailable' } };
    const result = decideDeduplication(baseInput({ listing }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('ownership.listing-unavailable');
      expect(result.failure.outcome).toBe('inconclusive');
    }
  });

  it('an invalid owner record fails before commitment', () => {
    const listing: DedupListingRead = { kind: 'unique', record: { kind: 'invalid' } };
    const result = decideDeduplication(baseInput({ listing }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('ownership.record-invalid');
      expect(result.failure.outcome).toBe('inconclusive');
    }
  });

  it('an unavailable fallback read fails before commitment', () => {
    const withUnavailable = decideDeduplication(baseInput({ listing: { kind: 'none' }, fallback: { kind: 'unavailable' } }));
    expect(withUnavailable.ok).toBe(false);
    if (!withUnavailable.ok) {
      expect(withUnavailable.failure.code).toBe('ownership.listing-unavailable');
      expect(withUnavailable.failure.outcome).toBe('inconclusive');
    }

    const withNull = decideDeduplication(baseInput({ listing: { kind: 'none' }, fallback: null }));
    expect(withNull.ok).toBe(false);
    if (!withNull.ok) {
      expect(withNull.failure.code).toBe('ownership.listing-unavailable');
      expect(withNull.failure.outcome).toBe('inconclusive');
    }
  });

  it('a missing listing read fails closed', () => {
    const result = decideDeduplication(baseInput({ listing: null, action: 'edited', runAttempt: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('ownership.listing-unavailable');
      expect(result.failure.outcome).toBe('inconclusive');
    }
  });

  it('a verified echo is a duplicate', () => {
    const listing: DedupListingRead = {
      kind: 'unique',
      record: { kind: 'valid', runId: 7, runAttempt: 1, snapshotHash: OTHER_HASH, policyRevision: OTHER_REVISION },
    };
    const result = decideDeduplication(baseInput({ echo: true, listing }));
    expect(result).toEqual({ ok: true, value: { kind: 'duplicate', reason: 'echo', keptOwner: null } });
  });

  it('a bot sender without a recorded receipt is not an echo', () => {
    expect(isVerifiedEcho({ senderId: 1, botUserId: 1, triggeringResourceId: 42, receipts: [] })).toBe(false);
  });

  it('a recorded receipt from another sender is not an echo', () => {
    expect(isVerifiedEcho({ senderId: 2, botUserId: 1, triggeringResourceId: 42, receipts: [42] })).toBe(false);
    expect(isVerifiedEcho({ senderId: 2, botUserId: null, triggeringResourceId: 42, receipts: [42] })).toBe(false);
  });

  it('listing-based deduplication applies only to first attempts of non-reopen events', () => {
    expect(appliesListingDeduplication(1, 'edited')).toBe(true);
    expect(appliesListingDeduplication(1, 'opened')).toBe(true);
    expect(appliesListingDeduplication(2, 'edited')).toBe(false);
    expect(appliesListingDeduplication(1, 'reopened')).toBe(false);
    expect(appliesListingDeduplication(3, 'reopened')).toBe(false);
  });
});
