import { z } from 'zod';

import {
  recordRepositorySchema,
  recordPositiveIntSchema,
  recordContentHashSchema,
  recordCommitIdSchema,
  recordIdentifierSchema,
  recordList,
  policyRevisionIdSchema,
} from '../records/common.js';
import { ATTACHMENT_URL_MAX_LENGTH, SHARED_HEAD_PULL_REQUESTS_MAX, LINKED_ISSUES_PER_PULL_REQUEST } from '../policy/bounds.js';
import { contentHash, canonicalJsonHash } from '../hash.js';
import type { ContentHash } from '../hash.js';
import type { CanonicalJsonFailureCode } from '../canonical-json.js';
import { ok, err } from '../result.js';
import type { Result } from '../result.js';

export const SNAPSHOT_VERSION = 1;

export const attachmentUrlSchema = z
  .string()
  .max(ATTACHMENT_URL_MAX_LENGTH)
  .regex(/^https:\/\/[\x21-\x7e]+$/);

const attachmentSchema = z.strictObject({
  url: attachmentUrlSchema,
  content_hash: recordContentHashSchema.nullable(),
});

const authorResponseSchema = z.strictObject({
  request_id: recordIdentifierSchema,
  comment_id: recordPositiveIntSchema,
  content_hash: recordContentHashSchema.nullable(),
});

const linkedIssueSchema = z.strictObject({
  repository: recordRepositorySchema,
  number: recordPositiveIntSchema,
  content_hash: recordContentHashSchema,
});

function checkAscendingBy<T>(
  ctx: z.RefinementCtx,
  path: string,
  items: readonly T[],
  compare: (previous: T, current: T) => number,
) {
  for (let i = 1; i < items.length; i += 1) {
    const previousItem = items[i - 1];
    const currentItem = items[i];
    if (previousItem === undefined || currentItem === undefined) {
      continue;
    }
    if (compare(previousItem, currentItem) >= 0) {
      ctx.addIssue({ code: 'custom', message: `${path} must be strictly ascending and unique`, path: [path, i] });
    }
  }
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function checkOrder(
  value: {
    attachments: readonly { url: string }[];
    author_responses: readonly { request_id: string; comment_id: number }[];
  },
  ctx: z.RefinementCtx,
) {
  checkAscendingBy(ctx, 'attachments', value.attachments, (a, b) => compareStrings(a.url, b.url));
  checkAscendingBy(ctx, 'author_responses', value.author_responses, (a, b) =>
    a.request_id !== b.request_id ? compareStrings(a.request_id, b.request_id) : a.comment_id - b.comment_id,
  );
}

const issueSnapshotShape = z.strictObject({
  snapshot_version: z.literal(SNAPSHOT_VERSION),
  repository: recordRepositorySchema,
  type: z.literal('issue'),
  number: recordPositiveIntSchema,
  content_hash: recordContentHashSchema,
  attachments: recordList(attachmentSchema),
  author_responses: recordList(authorResponseSchema),
  policy_revision: policyRevisionIdSchema,
});

export const issueSnapshotSchema = issueSnapshotShape.superRefine(checkOrder);

const pullRequestSnapshotShape = z.strictObject({
  snapshot_version: z.literal(SNAPSHOT_VERSION),
  repository: recordRepositorySchema,
  type: z.literal('pull_request'),
  number: recordPositiveIntSchema,
  target_branch: recordIdentifierSchema,
  head_commit: recordCommitIdSchema,
  base_commit: recordCommitIdSchema,
  body_hash: recordContentHashSchema,
  linked_issues: z.array(linkedIssueSchema).max(LINKED_ISSUES_PER_PULL_REQUEST),
  attachments: recordList(attachmentSchema),
  author_responses: recordList(authorResponseSchema),
  shared_head_pull_requests: z.array(recordPositiveIntSchema).max(SHARED_HEAD_PULL_REQUESTS_MAX),
  policy_revision: policyRevisionIdSchema,
});

export const pullRequestSnapshotSchema = pullRequestSnapshotShape.superRefine((value, ctx) => {
  checkOrder(value, ctx);
  checkAscendingBy(ctx, 'linked_issues', value.linked_issues, (a, b) =>
    a.repository !== b.repository ? compareStrings(a.repository, b.repository) : a.number - b.number,
  );
  checkAscendingBy(ctx, 'shared_head_pull_requests', value.shared_head_pull_requests, (a, b) => a - b);
});

export const snapshotSchema = z.discriminatedUnion('type', [issueSnapshotSchema, pullRequestSnapshotSchema]);

export type IssueSnapshot = z.output<typeof issueSnapshotSchema>;
export type PullRequestSnapshot = z.output<typeof pullRequestSnapshotSchema>;
export type Snapshot = IssueSnapshot | PullRequestSnapshot;

export type SnapshotFailureCode = 'snapshot.invalid' | CanonicalJsonFailureCode;

export interface SnapshotAttachmentInput {
  readonly url: string;
  readonly contentHash: ContentHash | null;
}

export interface SnapshotAuthorResponseInput {
  readonly requestId: string;
  readonly commentId: number;
  readonly contentHash: ContentHash | null;
}

export interface SnapshotLinkedIssueInput {
  readonly repository: string;
  readonly number: number;
  readonly contentHash: ContentHash;
}

export interface IssueSnapshotInput {
  readonly repository: string;
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly attachments: readonly SnapshotAttachmentInput[];
  readonly authorResponses: readonly SnapshotAuthorResponseInput[];
  readonly policyRevision: string;
}

export interface PullRequestSnapshotInput {
  readonly repository: string;
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly targetBranch: string;
  readonly headCommit: string;
  readonly baseCommit: string;
  readonly linkedIssues: readonly SnapshotLinkedIssueInput[];
  readonly attachments: readonly SnapshotAttachmentInput[];
  readonly authorResponses: readonly SnapshotAuthorResponseInput[];
  readonly sharedHeadPullRequests: readonly number[];
  readonly policyRevision: string;
}

const INVALID_MESSAGE = 'Snapshot is invalid.';

function invalid(): Result<never, SnapshotFailureCode> {
  return err('snapshot.invalid', 'steward-defect', INVALID_MESSAGE);
}

function bodyHash(body: string | null): Result<ContentHash, SnapshotFailureCode> {
  if (body !== null && !body.isWellFormed()) {
    return invalid();
  }
  return ok(contentHash(new TextEncoder().encode(body ?? '')));
}

function dedupeAttachments(
  attachments: readonly SnapshotAttachmentInput[],
): Result<{ url: string; content_hash: ContentHash | null }[], SnapshotFailureCode> {
  const byUrl = new Map<string, ContentHash | null>();
  for (const attachment of attachments) {
    if (byUrl.has(attachment.url)) {
      if (byUrl.get(attachment.url) !== attachment.contentHash) {
        return invalid();
      }
      continue;
    }
    byUrl.set(attachment.url, attachment.contentHash);
  }
  const rows = [...byUrl.entries()].map(([url, contentHashValue]) => ({ url, content_hash: contentHashValue }));
  rows.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  return ok(rows);
}

function dedupeLinkedIssues(
  linkedIssues: readonly SnapshotLinkedIssueInput[],
): Result<{ repository: string; number: number; content_hash: ContentHash }[], SnapshotFailureCode> {
  const byKey = new Map<string, ContentHash>();
  for (const linkedIssue of linkedIssues) {
    const key = `${linkedIssue.repository}\u0000${linkedIssue.number}`;
    if (byKey.has(key)) {
      if (byKey.get(key) !== linkedIssue.contentHash) {
        return invalid();
      }
      continue;
    }
    byKey.set(key, linkedIssue.contentHash);
  }
  const rows = [...byKey.entries()].map(([key, contentHashValue]) => {
    const [repository, numberText] = key.split('\u0000');
    return { repository: repository ?? '', number: Number(numberText), content_hash: contentHashValue };
  });
  rows.sort((a, b) => (a.repository !== b.repository ? (a.repository < b.repository ? -1 : 1) : a.number - b.number));
  return ok(rows);
}

function sortAuthorResponses(
  authorResponses: readonly SnapshotAuthorResponseInput[],
): Result<{ request_id: string; comment_id: number; content_hash: ContentHash | null }[], SnapshotFailureCode> {
  const seen = new Set<string>();
  for (const response of authorResponses) {
    const key = `${response.requestId}\u0000${response.commentId}`;
    if (seen.has(key)) {
      return invalid();
    }
    seen.add(key);
  }
  const rows = authorResponses.map((response) => ({
    request_id: response.requestId,
    comment_id: response.commentId,
    content_hash: response.contentHash,
  }));
  rows.sort((a, b) => (a.request_id !== b.request_id ? (a.request_id < b.request_id ? -1 : 1) : a.comment_id - b.comment_id));
  return ok(rows);
}

function dedupeSharedHeads(sharedHeadPullRequests: readonly number[], ownNumber: number): number[] {
  const unique = new Set(sharedHeadPullRequests.filter((n) => n !== ownNumber));
  return [...unique].sort((a, b) => a - b);
}

export function buildIssueSnapshot(input: IssueSnapshotInput): Result<IssueSnapshot, SnapshotFailureCode> {
  const hashResult = bodyHash(input.body);
  if (!hashResult.ok) {
    return hashResult;
  }
  const attachmentsResult = dedupeAttachments(input.attachments);
  if (!attachmentsResult.ok) {
    return attachmentsResult;
  }
  const authorResponsesResult = sortAuthorResponses(input.authorResponses);
  if (!authorResponsesResult.ok) {
    return authorResponsesResult;
  }
  const candidate = {
    snapshot_version: SNAPSHOT_VERSION,
    repository: input.repository,
    type: 'issue' as const,
    number: input.number,
    content_hash: hashResult.value,
    attachments: attachmentsResult.value,
    author_responses: authorResponsesResult.value,
    policy_revision: input.policyRevision,
  };
  const parsed = issueSnapshotSchema.safeParse(candidate);
  if (!parsed.success) {
    return invalid();
  }
  return ok(parsed.data);
}

export function buildPullRequestSnapshot(input: PullRequestSnapshotInput): Result<PullRequestSnapshot, SnapshotFailureCode> {
  const hashResult = bodyHash(input.body);
  if (!hashResult.ok) {
    return hashResult;
  }
  const attachmentsResult = dedupeAttachments(input.attachments);
  if (!attachmentsResult.ok) {
    return attachmentsResult;
  }
  const linkedIssuesResult = dedupeLinkedIssues(input.linkedIssues);
  if (!linkedIssuesResult.ok) {
    return linkedIssuesResult;
  }
  const authorResponsesResult = sortAuthorResponses(input.authorResponses);
  if (!authorResponsesResult.ok) {
    return authorResponsesResult;
  }
  const candidate = {
    snapshot_version: SNAPSHOT_VERSION,
    repository: input.repository,
    type: 'pull_request' as const,
    number: input.number,
    target_branch: input.targetBranch,
    head_commit: input.headCommit,
    base_commit: input.baseCommit,
    body_hash: hashResult.value,
    linked_issues: linkedIssuesResult.value,
    attachments: attachmentsResult.value,
    author_responses: authorResponsesResult.value,
    shared_head_pull_requests: dedupeSharedHeads(input.sharedHeadPullRequests, input.number),
    policy_revision: input.policyRevision,
  };
  const parsed = pullRequestSnapshotSchema.safeParse(candidate);
  if (!parsed.success) {
    return invalid();
  }
  return ok(parsed.data);
}

export function snapshotHash(snapshot: Snapshot): Result<ContentHash, SnapshotFailureCode> {
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    return invalid();
  }
  if (parsed.data.type === 'pull_request') {
    const rest: Record<string, unknown> = { ...parsed.data };
    delete rest['base_commit'];
    return canonicalJsonHash(rest);
  }
  return canonicalJsonHash(parsed.data);
}
