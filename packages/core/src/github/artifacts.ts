import { z } from 'zod';

import type { GitHubClient, GitHubFailureCode } from './client.js';
import { githubFailure } from './client.js';
import type { GitHubRepositoryRef } from './reader.js';
import { repositoryRefFromFullName } from './reader.js';
import type { AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import { fetchAttachment } from '../net/attachment-fetch.js';
import { readSingleZipEntry } from '../net/zip-entry.js';
import type { OwnershipArtifactExpectation, OwnershipRecord } from '../ownership/record.js';
import { OWNERSHIP_ARTIFACT_FILE, decodeOwnershipRecord, ownershipArtifactName } from '../ownership/record.js';
import type { OwnershipArtifactItem, OwnershipListing } from '../ownership/artifacts.js';
import { newestOwnershipArtifact } from '../ownership/artifacts.js';
import type { DedupListingRead } from '../ownership/dedup.js';
import {
  GITHUB_REQUEST_TIMEOUT_MS,
  OWNERSHIP_ARTIFACT_MAX_BYTES,
  OWNERSHIP_LISTING_PAGES_MAX,
  OWNERSHIP_RECORD_MAX_BYTES,
} from '../policy/bounds.js';
import type { Result, StewardFailure } from '../result.js';
import { ok } from '../result.js';
import type { SubmissionType } from '../vocabulary.js';

const OWNERSHIP_ARTIFACT_NAME_PATTERN = /^steward-ownership-(pr|issue)-[1-9][0-9]{0,9}$/;

export const githubArtifactSchema = z.object({
  id: z.int().positive(),
  name: z.string().min(1).max(256),
  expired: z.boolean(),
  created_at: z.string().max(64).nullable(),
  expires_at: z.string().max(64).nullable(),
  workflow_run: z.object({ id: z.int().positive().nullable().optional() }).nullable().optional(),
});

function repoPath(repository: GitHubRepositoryRef): string {
  return `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`;
}

export async function listOwnershipArtifacts(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  name: string,
): Promise<Result<OwnershipListing, GitHubFailureCode>> {
  if (repositoryRefFromFullName(`${repository.owner}/${repository.name}`) === null) {
    return githubFailure('github.invalid-request', 'The repository owner or name is not valid.');
  }
  if (!OWNERSHIP_ARTIFACT_NAME_PATTERN.test(name)) {
    return githubFailure('github.invalid-request', 'The ownership artifact name is not valid.');
  }
  const result = await client.getPaginatedList(
    `${repoPath(repository)}/actions/artifacts`,
    'artifacts',
    githubArtifactSchema,
    { name },
    OWNERSHIP_LISTING_PAGES_MAX,
  );
  if (!result.ok) return result;
  const items: OwnershipArtifactItem[] = result.value.items.map((item) => ({
    id: item.id,
    name: item.name,
    createdAt: item.created_at ?? '',
    expiresAt: item.expires_at,
    expired: item.expired,
    workflowRunId: item.workflow_run?.id ?? null,
  }));
  return ok({ items, complete: result.value.complete });
}

export interface OwnershipDownloadDeps {
  readonly resolver: AttachmentResolver;
  readonly transport: AttachmentTransport;
  readonly timeoutMs?: number;
}

export type OwnershipDownloadFailureCode = 'ownership.listing-unavailable' | 'ownership.record-invalid';

const DOWNLOAD_UNAVAILABLE_MESSAGE = 'The ownership artifact could not be downloaded.';
const DOWNLOAD_INVALID_MESSAGE = 'The ownership artifact is invalid.';

export async function downloadOwnershipRecord(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  artifact: OwnershipArtifactItem,
  expected: OwnershipArtifactExpectation,
  deps: OwnershipDownloadDeps,
): Promise<Result<OwnershipRecord, OwnershipDownloadFailureCode>> {
  const redirect = await client.getRedirectLocation(`${repoPath(repository)}/actions/artifacts/${String(artifact.id)}/zip`);
  if (!redirect.ok) {
    return {
      ok: false,
      failure: {
        code: 'ownership.listing-unavailable',
        cause: redirect.failure.cause,
        outcome: 'inconclusive',
        message: DOWNLOAD_UNAVAILABLE_MESSAGE,
        details: [
          {
            code: 'ownership.listing-unavailable',
            path: redirect.failure.code,
            message: DOWNLOAD_UNAVAILABLE_MESSAGE,
            line: null,
            column: null,
          },
        ],
      },
    };
  }
  const location = redirect.value;
  const hostname = new URL(location).hostname;
  const fetched = await fetchAttachment(location, {
    destinations: [hostname],
    maxRedirects: 0,
    timeoutMs: deps.timeoutMs ?? GITHUB_REQUEST_TIMEOUT_MS,
    maxFileBytes: OWNERSHIP_ARTIFACT_MAX_BYTES,
    remainingTotalBytes: OWNERSHIP_ARTIFACT_MAX_BYTES,
    resolver: deps.resolver,
    transport: deps.transport,
  });
  if (fetched.kind === 'unavailable') {
    return {
      ok: false,
      failure: {
        code: 'ownership.listing-unavailable',
        cause: 'github-unavailable',
        outcome: 'inconclusive',
        message: DOWNLOAD_UNAVAILABLE_MESSAGE,
        details: [
          {
            code: 'ownership.listing-unavailable',
            path: `download-${fetched.reason}`,
            message: DOWNLOAD_UNAVAILABLE_MESSAGE,
            line: null,
            column: null,
          },
        ],
      },
    };
  }
  if (fetched.kind === 'violation') {
    return {
      ok: false,
      failure: {
        code: 'ownership.record-invalid',
        cause: 'github-unavailable',
        outcome: 'inconclusive',
        message: DOWNLOAD_INVALID_MESSAGE,
        details: [
          {
            code: 'ownership.record-invalid',
            path: `download-${fetched.rule}`,
            message: DOWNLOAD_INVALID_MESSAGE,
            line: null,
            column: null,
          },
        ],
      },
    };
  }
  const entry = readSingleZipEntry(fetched.bytes, {
    entryName: OWNERSHIP_ARTIFACT_FILE,
    maxArchiveBytes: OWNERSHIP_ARTIFACT_MAX_BYTES,
    maxEntryBytes: OWNERSHIP_RECORD_MAX_BYTES,
  });
  if (entry.kind === 'violation') {
    return {
      ok: false,
      failure: {
        code: 'ownership.record-invalid',
        cause: 'github-unavailable',
        outcome: 'inconclusive',
        message: DOWNLOAD_INVALID_MESSAGE,
        details: [
          {
            code: 'ownership.record-invalid',
            path: `zip-${entry.reason}`,
            message: DOWNLOAD_INVALID_MESSAGE,
            line: null,
            column: null,
          },
        ],
      },
    };
  }
  return decodeOwnershipRecord(entry.bytes, expected);
}

export type OwnershipRecordRead =
  { readonly kind: 'valid'; readonly record: OwnershipRecord } | { readonly kind: 'invalid' } | { readonly kind: 'unavailable' };

export type OwnershipListingRead =
  | { readonly kind: 'unavailable'; readonly failure: StewardFailure }
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'none' }
  | { readonly kind: 'ambiguous'; readonly artifacts: readonly OwnershipArtifactItem[] }
  | { readonly kind: 'unique'; readonly artifact: OwnershipArtifactItem; readonly record: OwnershipRecordRead };

export async function readOwnershipListing(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  subject: { readonly type: SubmissionType; readonly number: number },
  deps: OwnershipDownloadDeps,
): Promise<OwnershipListingRead> {
  let name: string;
  try {
    name = ownershipArtifactName(subject.type, subject.number);
  } catch {
    return { kind: 'unavailable', failure: githubFailure('github.invalid-request', 'The submission is not valid.').failure };
  }
  const listing = await listOwnershipArtifacts(client, repository, name);
  if (!listing.ok) {
    return { kind: 'unavailable', failure: listing.failure };
  }
  const newest = newestOwnershipArtifact(listing.value, name);
  if (newest.kind === 'incomplete') return { kind: 'incomplete' };
  if (newest.kind === 'none') return { kind: 'none' };
  if (newest.kind === 'ambiguous') return { kind: 'ambiguous', artifacts: newest.artifacts };

  const downloaded = await downloadOwnershipRecord(
    client,
    repository,
    newest.artifact,
    {
      repository: `${repository.owner}/${repository.name}`,
      type: subject.type,
      number: subject.number,
      artifactName: newest.artifact.name,
      workflowRunId: newest.artifact.workflowRunId,
    },
    deps,
  );
  if (downloaded.ok) {
    return { kind: 'unique', artifact: newest.artifact, record: { kind: 'valid', record: downloaded.value } };
  }
  if (downloaded.failure.code === 'ownership.record-invalid') {
    return { kind: 'unique', artifact: newest.artifact, record: { kind: 'invalid' } };
  }
  return { kind: 'unique', artifact: newest.artifact, record: { kind: 'unavailable' } };
}

export function dedupListingRead(read: OwnershipListingRead): DedupListingRead {
  if (read.kind === 'unavailable') return { kind: 'unavailable' };
  if (read.kind === 'incomplete') return { kind: 'incomplete' };
  if (read.kind === 'none') return { kind: 'none' };
  if (read.kind === 'ambiguous') return { kind: 'ambiguous' };
  const record = read.record;
  if (record.kind === 'valid') {
    return {
      kind: 'unique',
      record: {
        kind: 'valid',
        runId: record.record.run_id,
        runAttempt: record.record.run_attempt,
        snapshotHash: record.record.snapshot_hash,
        policyRevision: record.record.policy_revision,
      },
    };
  }
  if (record.kind === 'invalid') return { kind: 'unique', record: { kind: 'invalid' } };
  return { kind: 'unique', record: { kind: 'unavailable' } };
}
