import { z } from 'zod';

import type { GitHubClient } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { githubContentsEntrySchema } from '../github/schemas.js';
import { repositoryStorePath, latestRunDirectoryName } from './layout.js';
import { runRecordSchema } from '../records/run.js';
import type { DedupFallbackRead } from '../ownership/dedup.js';
import type { SubmissionType } from '../vocabulary.js';
import { EVIDENCE_FALLBACK_ENTRIES_MAX, EVIDENCE_FALLBACK_FILE_MAX_BYTES } from '../policy/bounds.js';

export const githubContentsFileSchema = z.object({
  type: z.literal('file'),
  encoding: z.literal('base64'),
  size: z.int().min(0),
  content: z.string(),
});

export interface PublishedSnapshotQuery {
  readonly store: { readonly repository: GitHubRepositoryRef; readonly branch: string };
  readonly targetRepository: string;
  readonly subject: { readonly type: SubmissionType; readonly number: number };
}

const UNAVAILABLE: DedupFallbackRead = { kind: 'unavailable' };
const NONE: DedupFallbackRead = { kind: 'none' };

function isValidBranch(branch: string): boolean {
  if (branch.length < 1 || branch.length > 255) return false;
  for (let i = 0; i < branch.length; i += 1) {
    const code = branch.charCodeAt(i);
    if (code < 33 || code === 127) return false;
  }
  return true;
}

function encodeSegments(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

const contentsListingSchema = z.union([z.array(githubContentsEntrySchema), z.object({})]);

export async function readPublishedSnapshot(client: GitHubClient, query: PublishedSnapshotQuery): Promise<DedupFallbackRead> {
  try {
    const { store, targetRepository, subject } = query;
    if (!Number.isSafeInteger(subject.number) || subject.number <= 0) {
      return UNAVAILABLE;
    }
    if (!isValidBranch(store.branch)) {
      return UNAVAILABLE;
    }
    if (store.repository.owner === '' || store.repository.name === '') {
      return UNAVAILABLE;
    }
    const kind = subject.type === 'pull_request' ? 'pr' : 'issue';
    const prefixResult = repositoryStorePath(targetRepository, `runs/${kind}-${subject.number}`);
    if (!prefixResult.ok) {
      return UNAVAILABLE;
    }
    const prefix = prefixResult.value;
    const repoPath = '/repos/' + encodeURIComponent(store.repository.owner) + '/' + encodeURIComponent(store.repository.name);
    const requestQuery = { ref: store.branch };

    const listingResult = await client.getJson(
      repoPath + '/contents/' + encodeSegments(prefix),
      contentsListingSchema,
      requestQuery,
    );
    if (!listingResult.ok) {
      return listingResult.failure.code === 'github.not-found' ? NONE : UNAVAILABLE;
    }
    const listing = listingResult.value;
    if (!Array.isArray(listing)) {
      return UNAVAILABLE;
    }
    if (listing.length >= EVIDENCE_FALLBACK_ENTRIES_MAX) {
      return UNAVAILABLE;
    }
    const dirNames = listing.filter((entry) => entry.type === 'dir').map((entry) => entry.name);
    const latest = latestRunDirectoryName(dirNames);
    if (latest === null) {
      return NONE;
    }

    const fileResult = await client.getJson(
      repoPath + '/contents/' + encodeSegments(prefix + '/' + latest.name + '/run.json'),
      githubContentsFileSchema,
      requestQuery,
    );
    if (!fileResult.ok) {
      return UNAVAILABLE;
    }
    const file = fileResult.value;
    if (file.size > EVIDENCE_FALLBACK_FILE_MAX_BYTES) {
      return UNAVAILABLE;
    }
    const stripped = file.content.replaceAll('\n', '').replaceAll('\r', '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(stripped) || stripped.length % 4 !== 0) {
      return UNAVAILABLE;
    }
    const bytes = Buffer.from(stripped, 'base64');
    if (bytes.length !== file.size) {
      return UNAVAILABLE;
    }

    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return UNAVAILABLE;
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      return UNAVAILABLE;
    }
    const recordResult = runRecordSchema.safeParse(parsedJson);
    if (!recordResult.success) {
      return UNAVAILABLE;
    }
    const record = recordResult.data;
    if (
      record.subject.kind !== 'submission' ||
      record.subject.repository !== targetRepository ||
      record.subject.type !== subject.type ||
      record.subject.number !== subject.number
    ) {
      return UNAVAILABLE;
    }
    if (typeof record.run_id !== 'number' || record.run_id !== latest.runId || record.run_attempt !== latest.runAttempt) {
      return UNAVAILABLE;
    }
    return {
      kind: 'published',
      runId: record.run_id,
      runAttempt: record.run_attempt,
      snapshotHash: record.subject.snapshot_hash,
      policyRevision: record.policy_revision,
    };
  } catch {
    return UNAVAILABLE;
  }
}
