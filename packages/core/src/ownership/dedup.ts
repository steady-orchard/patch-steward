import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export const DEDUP_COMMIT_REASONS = [
  'rerun',
  'reopened',
  'no-owner',
  'snapshot-changed',
  'owner-ambiguous',
  'listing-incomplete',
] as const;
export type DedupCommitReason = (typeof DEDUP_COMMIT_REASONS)[number];

export const DEDUP_DUPLICATE_REASONS = ['echo', 'owner-unchanged', 'published-unchanged'] as const;
export type DedupDuplicateReason = (typeof DEDUP_DUPLICATE_REASONS)[number];

export type DedupFailureCode = 'ownership.listing-unavailable' | 'ownership.record-invalid';

export interface DedupRunRef {
  readonly runId: number;
  readonly runAttempt: number;
}

export interface DedupSnapshot {
  readonly snapshotHash: string;
  readonly policyRevision: string;
}

export type DedupOwnerRecordRead =
  ({ readonly kind: 'valid' } & DedupRunRef & DedupSnapshot) | { readonly kind: 'invalid' } | { readonly kind: 'unavailable' };

export type DedupListingRead =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'ambiguous' }
  | { readonly kind: 'none' }
  | { readonly kind: 'unique'; readonly record: DedupOwnerRecordRead };

export type DedupFallbackRead =
  ({ readonly kind: 'published' } & DedupRunRef & DedupSnapshot) | { readonly kind: 'none' } | { readonly kind: 'unavailable' };

export interface DedupInput {
  readonly runAttempt: number;
  readonly action: string;
  readonly echo: boolean;
  readonly listing: DedupListingRead | null;
  readonly fallback: DedupFallbackRead | null;
  readonly captured: DedupSnapshot;
}

export type DedupDecision =
  | { readonly kind: 'duplicate'; readonly reason: DedupDuplicateReason; readonly keptOwner: DedupRunRef | null }
  | { readonly kind: 'commit'; readonly reason: DedupCommitReason };

function sameSnapshot(a: DedupSnapshot, b: DedupSnapshot): boolean {
  return a.snapshotHash === b.snapshotHash && a.policyRevision === b.policyRevision;
}

const LISTING_UNAVAILABLE_MESSAGE = 'The ownership listing could not be read.';
const RECORD_INVALID_MESSAGE = 'The newest ownership record is invalid.';

export function decideDeduplication(input: DedupInput): Result<DedupDecision, DedupFailureCode> {
  if (input.echo) {
    return ok({ kind: 'duplicate', reason: 'echo', keptOwner: null });
  }
  if (input.runAttempt > 1) {
    return ok({ kind: 'commit', reason: 'rerun' });
  }
  if (input.action === 'reopened') {
    return ok({ kind: 'commit', reason: 'reopened' });
  }
  const listing = input.listing;
  if (listing === null || listing.kind === 'unavailable') {
    return err('ownership.listing-unavailable', 'github-unavailable', LISTING_UNAVAILABLE_MESSAGE);
  }
  if (listing.kind === 'incomplete') {
    return ok({ kind: 'commit', reason: 'listing-incomplete' });
  }
  if (listing.kind === 'ambiguous') {
    return ok({ kind: 'commit', reason: 'owner-ambiguous' });
  }
  if (listing.kind === 'unique') {
    const record = listing.record;
    if (record.kind === 'unavailable') {
      return err('ownership.listing-unavailable', 'github-unavailable', LISTING_UNAVAILABLE_MESSAGE);
    }
    if (record.kind === 'invalid') {
      return err('ownership.record-invalid', 'github-unavailable', RECORD_INVALID_MESSAGE);
    }
    if (sameSnapshot(record, input.captured)) {
      return ok({
        kind: 'duplicate',
        reason: 'owner-unchanged',
        keptOwner: { runId: record.runId, runAttempt: record.runAttempt },
      });
    }
    return ok({ kind: 'commit', reason: 'snapshot-changed' });
  }
  const fallback = input.fallback;
  if (fallback === null || fallback.kind === 'unavailable') {
    return err('ownership.listing-unavailable', 'github-unavailable', LISTING_UNAVAILABLE_MESSAGE);
  }
  if (fallback.kind === 'none') {
    return ok({ kind: 'commit', reason: 'no-owner' });
  }
  if (sameSnapshot(fallback, input.captured)) {
    return ok({
      kind: 'duplicate',
      reason: 'published-unchanged',
      keptOwner: { runId: fallback.runId, runAttempt: fallback.runAttempt },
    });
  }
  return ok({ kind: 'commit', reason: 'snapshot-changed' });
}

export function appliesListingDeduplication(runAttempt: number, action: string): boolean {
  return runAttempt === 1 && action !== 'reopened';
}

export interface EchoInput {
  readonly senderId: number;
  readonly botUserId: number | null;
  readonly triggeringResourceId: number;
  readonly receipts: readonly number[];
}

export function isVerifiedEcho(input: EchoInput): boolean {
  return input.botUserId !== null && input.senderId === input.botUserId && input.receipts.includes(input.triggeringResourceId);
}
