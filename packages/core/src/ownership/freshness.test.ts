import { describe, expect, it } from 'vitest';
import type { OwnershipArtifactItem, OwnershipListing } from './artifacts.js';
import { decidePublishFreshness, findOwnOwnershipArtifact, freshnessTop, type OwnArtifactReference } from './freshness.js';

const NAME = 'steward-ownership-issue-29';
const RUN_ID = 36081628326;

function item(overrides: Partial<OwnershipArtifactItem>): OwnershipArtifactItem {
  return {
    id: 900,
    name: NAME,
    createdAt: '2026-09-28T10:00:05Z',
    expiresAt: '2026-12-27T10:00:05Z',
    expired: false,
    workflowRunId: RUN_ID,
    ...overrides,
  };
}

function listing(items: readonly OwnershipArtifactItem[], complete = true): OwnershipListing {
  return { items, complete };
}

const OWN_REF: OwnArtifactReference = { id: 900, createdAt: '2026-09-28T10:00:05Z', workflowRunId: RUN_ID };

describe('publish freshness', () => {
  it('the own artifact is found by workflow run id', () => {
    const own = item({});
    const result = findOwnOwnershipArtifact(listing([own]), NAME, RUN_ID);
    expect(result).toEqual({ kind: 'found', artifact: own });
  });

  it('a missing, duplicated, or incomplete own artifact is not found', () => {
    expect(findOwnOwnershipArtifact(listing([]), NAME, RUN_ID)).toEqual({ kind: 'missing' });
    expect(findOwnOwnershipArtifact(listing([item({ id: 1 }), item({ id: 2 })]), NAME, RUN_ID)).toEqual({ kind: 'duplicate' });
    expect(findOwnOwnershipArtifact(listing([item({})], false), NAME, RUN_ID)).toEqual({ kind: 'incomplete' });
    expect(findOwnOwnershipArtifact(listing([item({ expired: true })]), NAME, RUN_ID)).toEqual({ kind: 'missing' });
  });

  it('the unique newest own artifact is fresh at the top', () => {
    const own = item({});
    expect(freshnessTop(listing([own]), NAME, OWN_REF)).toEqual({ kind: 'own-newest' });
  });

  it('a newer artifact by creation time is found even with a smaller id', () => {
    const own = item({});
    const newer = item({ id: 5, createdAt: '2026-09-28T10:00:06Z', workflowRunId: 999 });
    expect(freshnessTop(listing([own, newer]), NAME, OWN_REF)).toEqual({ kind: 'newer', artifact: newer });

    const older = item({ id: 999999, createdAt: '2026-09-28T10:00:04Z', workflowRunId: 999 });
    expect(freshnessTop(listing([own, older]), NAME, OWN_REF)).toEqual({ kind: 'own-newest' });
  });

  it('a tie at the greatest creation time is unknown', () => {
    const own = item({});
    const a = item({ id: 5, createdAt: '2026-09-28T10:00:06Z', workflowRunId: 998 });
    const b = item({ id: 6, createdAt: '2026-09-28T10:00:06Z', workflowRunId: 999 });
    expect(freshnessTop(listing([own, a, b]), NAME, OWN_REF)).toEqual({ kind: 'unknown', reason: 'tie' });
  });

  it('a tie that includes the own artifact is unknown', () => {
    const own = item({});
    const tied = item({ id: 5, createdAt: own.createdAt, workflowRunId: 999 });
    expect(freshnessTop(listing([own, tied]), NAME, OWN_REF)).toEqual({ kind: 'unknown', reason: 'tie' });
  });

  it('an own artifact that changed since it was read is unknown', () => {
    const changedId = item({ id: 901 });
    expect(freshnessTop(listing([changedId]), NAME, OWN_REF)).toEqual({ kind: 'unknown', reason: 'own-changed' });

    const changedCreatedAt = item({ createdAt: '2026-09-28T10:00:09Z' });
    expect(freshnessTop(listing([changedCreatedAt]), NAME, OWN_REF)).toEqual({ kind: 'unknown', reason: 'own-changed' });
  });

  it('an unavailable or incomplete listing is unknown', () => {
    expect(freshnessTop(null, NAME, OWN_REF)).toEqual({ kind: 'unknown', reason: 'listing-unavailable' });
    expect(freshnessTop(listing([item({})], false), NAME, OWN_REF)).toEqual({ kind: 'unknown', reason: 'listing-incomplete' });

    const own = item({});
    const unparsable = item({ id: 5, createdAt: 'not-a-date', workflowRunId: 999 });
    expect(freshnessTop(listing([own, unparsable]), NAME, OWN_REF)).toEqual({
      kind: 'unknown',
      reason: 'listing-incomplete',
    });
  });

  it('a newer owner supersedes with the successor attempt', () => {
    const newer = item({ id: 5, createdAt: '2026-09-28T10:00:06Z', workflowRunId: 999 });
    const result = decidePublishFreshness({
      top: { kind: 'newer', artifact: newer },
      successor: { kind: 'valid', runId: 999, runAttempt: 2 },
      live: null,
      recorded: { snapshotHash: 'h', policyRevision: 'p' },
    });
    expect(result).toEqual({
      kind: 'superseded',
      reason: 'newer-owner',
      successor: { run_id: 999, run_attempt: 2, artifact_created_at: newer.createdAt },
    });
  });

  it('a newer owner without a valid record is unknown', () => {
    const newer = item({ id: 5, createdAt: '2026-09-28T10:00:06Z', workflowRunId: 999 });
    const base = { top: { kind: 'newer' as const, artifact: newer }, recorded: { snapshotHash: 'h', policyRevision: 'p' } };
    expect(decidePublishFreshness({ ...base, successor: null, live: null })).toEqual({
      kind: 'unknown',
      reason: 'successor-unavailable',
    });
    expect(decidePublishFreshness({ ...base, successor: { kind: 'unavailable' }, live: null })).toEqual({
      kind: 'unknown',
      reason: 'successor-unavailable',
    });
    expect(decidePublishFreshness({ ...base, successor: { kind: 'valid', runId: 1, runAttempt: 1 }, live: null })).toEqual({
      kind: 'unknown',
      reason: 'successor-unavailable',
    });
  });

  it('a changed live snapshot or policy revision supersedes', () => {
    const recorded = { snapshotHash: 'h', policyRevision: 'p' };
    const resultHash = decidePublishFreshness({
      top: { kind: 'own-newest' },
      successor: null,
      live: { kind: 'captured', snapshotHash: 'h2', policyRevision: 'p' },
      recorded,
    });
    expect(resultHash).toEqual({ kind: 'superseded', reason: 'snapshot-changed', liveSnapshotHash: 'h2' });

    const resultPolicy = decidePublishFreshness({
      top: { kind: 'own-newest' },
      successor: null,
      live: { kind: 'captured', snapshotHash: 'h', policyRevision: 'p2' },
      recorded,
    });
    expect(resultPolicy).toEqual({ kind: 'superseded', reason: 'snapshot-changed', liveSnapshotHash: 'h' });
  });

  it('an unchanged live snapshot is current', () => {
    const recorded = { snapshotHash: 'h', policyRevision: 'p' };
    const result = decidePublishFreshness({
      top: { kind: 'own-newest' },
      successor: null,
      live: { kind: 'captured', snapshotHash: 'h', policyRevision: 'p' },
      recorded,
    });
    expect(result).toEqual({ kind: 'current' });
  });

  it('a failed recapture is unknown', () => {
    const recorded = { snapshotHash: 'h', policyRevision: 'p' };
    expect(decidePublishFreshness({ top: { kind: 'own-newest' }, successor: null, live: null, recorded })).toEqual({
      kind: 'unknown',
      reason: 'recapture-unavailable',
    });
    expect(
      decidePublishFreshness({ top: { kind: 'own-newest' }, successor: null, live: { kind: 'unavailable' }, recorded }),
    ).toEqual({ kind: 'unknown', reason: 'recapture-unavailable' });
  });
});
