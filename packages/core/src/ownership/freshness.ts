import type { OwnershipArtifactItem, OwnershipListing } from './artifacts.js';
import { newestOwnershipArtifact } from './artifacts.js';

export const FRESHNESS_UNKNOWN_REASONS = [
  'listing-unavailable',
  'listing-incomplete',
  'own-missing',
  'own-changed',
  'tie',
  'successor-unavailable',
  'recapture-unavailable',
] as const;

export type FreshnessUnknownReason = (typeof FRESHNESS_UNKNOWN_REASONS)[number];

export type OwnArtifactLookup =
  | { readonly kind: 'found'; readonly artifact: OwnershipArtifactItem }
  | { readonly kind: 'missing' }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'incomplete' };

export function findOwnOwnershipArtifact(listing: OwnershipListing, name: string, runId: number): OwnArtifactLookup {
  if (!listing.complete) {
    return { kind: 'incomplete' };
  }
  const matches = listing.items.filter((item) => item.name === name && !item.expired && item.workflowRunId === runId);
  if (matches.length === 0) {
    return { kind: 'missing' };
  }
  if (matches.length > 1) {
    return { kind: 'duplicate' };
  }
  return { kind: 'found', artifact: matches[0] as OwnershipArtifactItem };
}

export interface OwnArtifactReference {
  readonly id: number;
  readonly createdAt: string;
  readonly workflowRunId: number;
}

export type FreshnessTop =
  | { readonly kind: 'unknown'; readonly reason: FreshnessUnknownReason }
  | { readonly kind: 'own-newest' }
  | { readonly kind: 'newer'; readonly artifact: OwnershipArtifactItem };

export function freshnessTop(listing: OwnershipListing | null, name: string, own: OwnArtifactReference): FreshnessTop {
  if (listing === null) {
    return { kind: 'unknown', reason: 'listing-unavailable' };
  }
  if (!listing.complete) {
    return { kind: 'unknown', reason: 'listing-incomplete' };
  }
  const ownLookup = findOwnOwnershipArtifact(listing, name, own.workflowRunId);
  if (ownLookup.kind === 'missing' || ownLookup.kind === 'duplicate') {
    return { kind: 'unknown', reason: 'own-missing' };
  }
  if (ownLookup.kind === 'incomplete') {
    return { kind: 'unknown', reason: 'listing-incomplete' };
  }
  if (ownLookup.artifact.id !== own.id || ownLookup.artifact.createdAt !== own.createdAt) {
    return { kind: 'unknown', reason: 'own-changed' };
  }
  const newest = newestOwnershipArtifact(listing, name);
  if (newest.kind === 'incomplete') {
    return { kind: 'unknown', reason: 'listing-incomplete' };
  }
  if (newest.kind === 'none') {
    return { kind: 'unknown', reason: 'own-missing' };
  }
  if (newest.kind === 'ambiguous') {
    return { kind: 'unknown', reason: 'tie' };
  }
  if (newest.artifact.id === own.id) {
    return { kind: 'own-newest' };
  }
  return { kind: 'newer', artifact: newest.artifact };
}

export type SuccessorRead =
  { readonly kind: 'valid'; readonly runId: number; readonly runAttempt: number } | { readonly kind: 'unavailable' };

export type LiveSnapshotRead =
  { readonly kind: 'captured'; readonly snapshotHash: string; readonly policyRevision: string } | { readonly kind: 'unavailable' };

export interface FreshnessDecisionInput {
  readonly top: FreshnessTop;
  readonly successor: SuccessorRead | null;
  readonly live: LiveSnapshotRead | null;
  readonly recorded: { readonly snapshotHash: string; readonly policyRevision: string };
}

export type PublishFreshness =
  | { readonly kind: 'current' }
  | {
      readonly kind: 'superseded';
      readonly reason: 'newer-owner';
      readonly successor: { readonly run_id: number; readonly run_attempt: number; readonly artifact_created_at: string };
    }
  | { readonly kind: 'superseded'; readonly reason: 'snapshot-changed'; readonly liveSnapshotHash: string }
  | { readonly kind: 'unknown'; readonly reason: FreshnessUnknownReason };

export function decidePublishFreshness(input: FreshnessDecisionInput): PublishFreshness {
  const { top } = input;
  if (top.kind === 'unknown') {
    return { kind: 'unknown', reason: top.reason };
  }
  if (top.kind === 'newer') {
    const successor = input.successor;
    if (successor === null || successor.kind === 'unavailable' || successor.runId !== top.artifact.workflowRunId) {
      return { kind: 'unknown', reason: 'successor-unavailable' };
    }
    return {
      kind: 'superseded',
      reason: 'newer-owner',
      successor: { run_id: successor.runId, run_attempt: successor.runAttempt, artifact_created_at: top.artifact.createdAt },
    };
  }
  const live = input.live;
  if (live === null || live.kind === 'unavailable') {
    return { kind: 'unknown', reason: 'recapture-unavailable' };
  }
  if (live.snapshotHash !== input.recorded.snapshotHash || live.policyRevision !== input.recorded.policyRevision) {
    return { kind: 'superseded', reason: 'snapshot-changed', liveSnapshotHash: live.snapshotHash };
  }
  return { kind: 'current' };
}
