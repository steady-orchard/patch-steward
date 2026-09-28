import { OWNERSHIP_RETENTION_DAYS } from '../policy/bounds.js';

export interface OwnershipArtifactItem {
  readonly id: number;
  readonly name: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly expired: boolean;
  readonly workflowRunId: number | null;
}

export interface OwnershipListing {
  readonly items: readonly OwnershipArtifactItem[];
  readonly complete: boolean;
}

export type NewestOwnershipArtifact =
  | { readonly kind: 'none' }
  | { readonly kind: 'unique'; readonly artifact: OwnershipArtifactItem }
  | { readonly kind: 'ambiguous'; readonly artifacts: readonly OwnershipArtifactItem[] }
  | { readonly kind: 'incomplete' };

export function newestOwnershipArtifact(listing: OwnershipListing, name: string): NewestOwnershipArtifact {
  if (!listing.complete) {
    return { kind: 'incomplete' };
  }
  const considered = listing.items.filter((item) => item.name === name && !item.expired);
  const timestamps: number[] = [];
  for (const item of considered) {
    const parsed = Date.parse(item.createdAt);
    if (Number.isNaN(parsed)) {
      return { kind: 'incomplete' };
    }
    timestamps.push(parsed);
  }
  if (considered.length === 0) {
    return { kind: 'none' };
  }
  const greatest = Math.max(...timestamps);
  const winners = considered.filter((_, index) => timestamps[index] === greatest);
  if (winners.length === 1) {
    return { kind: 'unique', artifact: winners[0] as OwnershipArtifactItem };
  }
  return { kind: 'ambiguous', artifacts: [...winners].sort((a, b) => a.id - b.id) };
}

export function artifactRetentionDays(createdAt: string, expiresAt: string): number | null {
  const created = Date.parse(createdAt);
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(created) || Number.isNaN(expires) || expires - created < 0) {
    return null;
  }
  return Math.round((expires - created) / 86400000);
}

export function ownershipRetentionShort(days: number | null): boolean {
  return days === null || days < OWNERSHIP_RETENTION_DAYS;
}
