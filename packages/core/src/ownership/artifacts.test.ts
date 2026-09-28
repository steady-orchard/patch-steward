import { describe, expect, it } from 'vitest';
import {
  artifactRetentionDays,
  newestOwnershipArtifact,
  ownershipRetentionShort,
  type OwnershipArtifactItem,
  type OwnershipListing,
} from './artifacts.js';

const NAME = 'steward-ownership-pr-12';

function item(overrides: Partial<OwnershipArtifactItem>): OwnershipArtifactItem {
  return {
    id: 1,
    name: NAME,
    createdAt: '2026-09-28T10:00:05Z',
    expiresAt: '2026-12-27T10:00:05Z',
    expired: false,
    workflowRunId: null,
    ...overrides,
  };
}

function listing(items: readonly OwnershipArtifactItem[], complete = true): OwnershipListing {
  return { items, complete };
}

describe('ownership artifacts', () => {
  it('the newest owner has the greatest created_at', () => {
    const older = item({ id: 1, createdAt: '2026-09-28T10:00:05Z' });
    const newer = item({ id: 2, createdAt: '2026-09-28T10:00:06Z' });
    const result = newestOwnershipArtifact(listing([older, newer]), NAME);
    expect(result).toEqual({ kind: 'unique', artifact: newer });
  });

  it('artifact ids never order owners', () => {
    const earlierButHigherId = item({ id: 99, createdAt: '2026-09-28T10:00:05Z' });
    const laterButLowerId = item({ id: 1, createdAt: '2026-09-28T10:00:06Z' });
    const forward = newestOwnershipArtifact(listing([earlierButHigherId, laterButLowerId]), NAME);
    const reversed = newestOwnershipArtifact(listing([laterButLowerId, earlierButHigherId]), NAME);
    expect(forward).toEqual({ kind: 'unique', artifact: laterButLowerId });
    expect(reversed).toEqual({ kind: 'unique', artifact: laterButLowerId });
  });

  it('a created_at tie at the top is ambiguous', () => {
    const a = item({ id: 5, createdAt: '2026-09-28T10:00:06Z' });
    const b = item({ id: 2, createdAt: '2026-09-28T10:00:06Z' });
    const result = newestOwnershipArtifact(listing([a, b]), NAME);
    expect(result).toEqual({ kind: 'ambiguous', artifacts: [b, a] });
  });

  it('a tie below the top does not block a unique owner', () => {
    const tie1 = item({ id: 1, createdAt: '2026-09-28T10:00:05Z' });
    const tie2 = item({ id: 2, createdAt: '2026-09-28T10:00:05Z' });
    const top = item({ id: 3, createdAt: '2026-09-28T10:00:06Z' });
    const result = newestOwnershipArtifact(listing([tie1, tie2, top]), NAME);
    expect(result).toEqual({ kind: 'unique', artifact: top });
  });

  it('an incomplete listing has no newest owner', () => {
    const result = newestOwnershipArtifact(listing([item({})], false), NAME);
    expect(result).toEqual({ kind: 'incomplete' });
  });

  it('expired artifacts are ignored', () => {
    const older = item({ id: 1, createdAt: '2026-09-28T10:00:05Z', expired: false });
    const expiredNewer = item({ id: 2, createdAt: '2026-09-28T10:00:06Z', expired: true });
    const result = newestOwnershipArtifact(listing([older, expiredNewer]), NAME);
    expect(result).toEqual({ kind: 'unique', artifact: older });

    const onlyExpired = newestOwnershipArtifact(listing([expiredNewer]), NAME);
    expect(onlyExpired).toEqual({ kind: 'none' });
  });

  it('artifacts with another name are ignored', () => {
    const other = item({ id: 1, name: 'steward-ownership-issue-3' });
    const result = newestOwnershipArtifact(listing([other]), NAME);
    expect(result).toEqual({ kind: 'none' });
  });

  it('an unparseable created_at makes the listing incomplete', () => {
    const bad = item({ id: 1, createdAt: 'not-a-date' });
    const result = newestOwnershipArtifact(listing([bad]), NAME);
    expect(result).toEqual({ kind: 'incomplete' });
  });

  it('effective retention rounds to whole days', () => {
    expect(artifactRetentionDays('2026-09-28T10:00:00Z', '2026-12-27T10:00:00Z')).toBe(90);
    expect(artifactRetentionDays('2026-09-28T10:00:00Z', '2026-09-29T10:00:00Z')).toBe(1);
    expect(artifactRetentionDays('2026-09-28T10:00:00Z', '2026-12-26T23:00:00Z')).toBe(90);
    expect(artifactRetentionDays('not-a-date', '2026-09-29T10:00:00Z')).toBeNull();
    expect(artifactRetentionDays('2026-09-29T10:00:00Z', '2026-09-28T10:00:00Z')).toBeNull();
  });

  it('retention below the requested days is short', () => {
    expect(ownershipRetentionShort(89)).toBe(true);
    expect(ownershipRetentionShort(90)).toBe(false);
    expect(ownershipRetentionShort(null)).toBe(true);
  });
});
