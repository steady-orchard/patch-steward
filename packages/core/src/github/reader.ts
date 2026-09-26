import type { Result } from '../result.js';
import { ok } from '../result.js';
import type { GitHubClient, GitHubFailureCode } from './client.js';
import { githubFailure } from './client.js';
import { CHANGED_PATHS_MAX, CHANGED_PATH_MAX_BYTES, GITHUB_PAGES_MAX } from '../policy/bounds.js';
import type { PathChange, PathChangeKind } from '../submission/paths.js';
import {
  githubBlobResponseSchema,
  githubCommitPullRequestSchema,
  githubContentsEntrySchema,
  githubIssueCommentResponseSchema,
  githubIssueResponseSchema,
  githubPullRequestFileSchema,
  githubPullRequestResponseSchema,
  githubRefResponseSchema,
  githubRepositoryResponseSchema,
  githubTreeResponseSchema,
} from './schemas.js';
import { z } from 'zod';
import { isObjectId } from '../git/reader.js';

export interface GitHubRepositoryRef {
  readonly owner: string;
  readonly name: string;
}

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
// eslint-disable-next-line no-control-regex -- control characters and specific symbols are deliberately rejected
const BRANCH_FORBIDDEN_PATTERN = /[\x00-\x20\x7f~^:?*[\\]/;

function isValidOwner(owner: string): boolean {
  return OWNER_PATTERN.test(owner);
}

function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name) && name !== '.' && name !== '..';
}

function isValidRepository(repository: GitHubRepositoryRef): boolean {
  return isValidOwner(repository.owner) && isValidName(repository.name);
}

export function repositoryRefFromFullName(fullName: string): GitHubRepositoryRef | null {
  const parts = fullName.split('/');
  if (parts.length !== 2) return null;
  const owner = parts[0] as string;
  const name = parts[1] as string;
  if (!isValidOwner(owner) || !isValidName(name)) return null;
  return { owner, name };
}

function isPositiveSafeInt(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInt(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidBranch(branch: string): boolean {
  if (branch.length < 1 || branch.length > 255) return false;
  if (BRANCH_FORBIDDEN_PATTERN.test(branch)) return false;
  if (branch.includes('..')) return false;
  if (branch.includes('//')) return false;
  if (branch.startsWith('-') || branch.startsWith('/')) return false;
  if (branch.endsWith('/') || branch.endsWith('.')) return false;
  return true;
}

function isValidPathSegment(segment: string): boolean {
  if (segment.length < 1 || segment.length > 255) return false;
  if (segment === '.' || segment === '..') return false;
  if (segment.includes('\\')) return false;
  for (let index = 0; index < segment.length; index += 1) {
    const code = segment.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

function isValidPath(path: string): boolean {
  if (path.length === 0) return false;
  const segments = path.split('/');
  return segments.every(isValidPathSegment);
}

function encodePathSegments(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function invalidRequest(message: string): Result<never, GitHubFailureCode> {
  return githubFailure('github.invalid-request', message);
}

export interface GitHubAuthor {
  readonly login: string | null;
  readonly id: number | null;
  readonly type: string | null;
  readonly association: string;
}

function authorFrom(
  user: { readonly login: string; readonly id: number; readonly type: string } | null,
  association: string,
): GitHubAuthor {
  if (user === null) {
    return { login: null, id: null, type: null, association };
  }
  return { login: user.login, id: user.id, type: user.type, association };
}

export interface GitHubRepositoryInfo {
  readonly fullName: string;
  readonly defaultBranch: string;
  readonly private: boolean;
}

export interface GitHubIssueInfo {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: 'open' | 'closed';
  readonly author: GitHubAuthor;
}

export interface GitHubPullRequestInfo {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: 'open' | 'closed';
  readonly draft: boolean;
  readonly headSha: string;
  readonly headRef: string;
  readonly baseSha: string;
  readonly baseRef: string;
  readonly changedFiles: number;
  readonly author: GitHubAuthor;
}

export type GitHubChangedPaths =
  { readonly kind: 'complete'; readonly changes: readonly PathChange[] } | { readonly kind: 'too-large' };

export interface GitHubIssueCommentInfo {
  readonly id: number;
  readonly body: string;
  readonly updatedAt: string;
  readonly author: GitHubAuthor;
}

export interface GitHubDirectoryEntry {
  readonly name: string;
  readonly path: string;
  readonly sha: string;
  readonly type: 'file' | 'dir' | 'symlink' | 'submodule';
  readonly size: number;
}

export interface GitHubTreeEntry {
  readonly path: string;
  readonly mode: '100644' | '100755' | '120000' | '160000' | '040000';
  readonly type: 'blob' | 'tree' | 'commit';
  readonly sha: string;
  readonly size: number | null;
}

export interface GitHubTree {
  readonly sha: string;
  readonly truncated: boolean;
  readonly entries: readonly GitHubTreeEntry[];
}

function repoPath(repository: GitHubRepositoryRef): string {
  return `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`;
}

export async function readRepository(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
): Promise<Result<GitHubRepositoryInfo, GitHubFailureCode>> {
  if (!isValidRepository(repository)) return invalidRequest('The repository owner or name is not valid.');
  const result = await client.getJson(repoPath(repository), githubRepositoryResponseSchema);
  if (!result.ok) return result;
  return ok({
    fullName: result.value.full_name,
    defaultBranch: result.value.default_branch,
    private: result.value.private,
  });
}

export async function readIssue(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  issueNumber: number,
): Promise<Result<GitHubIssueInfo, GitHubFailureCode>> {
  if (!isValidRepository(repository)) return invalidRequest('The repository owner or name is not valid.');
  if (!isPositiveSafeInt(issueNumber)) return invalidRequest('The issue number is not valid.');
  const result = await client.getJson(`${repoPath(repository)}/issues/${String(issueNumber)}`, githubIssueResponseSchema);
  if (!result.ok) return result;
  if (result.value.pull_request !== null && result.value.pull_request !== undefined) {
    return githubFailure('github.not-an-issue', 'The requested issue is a pull request.');
  }
  return ok({
    number: result.value.number,
    title: result.value.title,
    body: result.value.body,
    state: result.value.state,
    author: authorFrom(result.value.user, result.value.author_association),
  });
}

export async function readPullRequest(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  pullNumber: number,
): Promise<Result<GitHubPullRequestInfo, GitHubFailureCode>> {
  if (!isValidRepository(repository)) return invalidRequest('The repository owner or name is not valid.');
  if (!isPositiveSafeInt(pullNumber)) return invalidRequest('The pull request number is not valid.');
  const result = await client.getJson(`${repoPath(repository)}/pulls/${String(pullNumber)}`, githubPullRequestResponseSchema);
  if (!result.ok) return result;
  return ok({
    number: result.value.number,
    title: result.value.title,
    body: result.value.body,
    state: result.value.state,
    draft: result.value.draft,
    headSha: result.value.head.sha,
    headRef: result.value.head.ref,
    baseSha: result.value.base.sha,
    baseRef: result.value.base.ref,
    changedFiles: result.value.changed_files,
    author: authorFrom(result.value.user, result.value.author_association),
  });
}

function utf8Length(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function statusToKind(status: z.infer<typeof githubPullRequestFileSchema>['status']): PathChangeKind | null {
  switch (status) {
    case 'added':
      return 'added';
    case 'removed':
      return 'deleted';
    case 'modified':
      return 'modified';
    case 'renamed':
      return 'renamed';
    case 'copied':
      return 'copied';
    case 'changed':
      return 'type-changed';
    case 'unchanged':
      return null;
  }
}

export async function readPullRequestFiles(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  pullNumber: number,
  changedFiles: number,
): Promise<Result<GitHubChangedPaths, GitHubFailureCode>> {
  if (!isValidRepository(repository)) return invalidRequest('The repository owner or name is not valid.');
  if (!isPositiveSafeInt(pullNumber)) return invalidRequest('The pull request number is not valid.');
  if (!isNonNegativeSafeInt(changedFiles)) return invalidRequest('The changed file count is not valid.');
  if (changedFiles > CHANGED_PATHS_MAX) return ok({ kind: 'too-large' });

  const result = await client.getPaginated(
    `${repoPath(repository)}/pulls/${String(pullNumber)}/files`,
    githubPullRequestFileSchema,
    undefined,
    GITHUB_PAGES_MAX,
  );
  if (!result.ok) {
    if (result.failure.code === 'github.pagination-exceeded') return ok({ kind: 'too-large' });
    return result;
  }
  if (result.value.length !== changedFiles) return ok({ kind: 'too-large' });

  const changes: PathChange[] = [];
  for (const item of result.value) {
    if (utf8Length(item.filename) > CHANGED_PATH_MAX_BYTES) return ok({ kind: 'too-large' });
    if (item.previous_filename !== undefined && utf8Length(item.previous_filename) > CHANGED_PATH_MAX_BYTES) {
      return ok({ kind: 'too-large' });
    }
    if ((item.status === 'renamed' || item.status === 'copied') && item.previous_filename === undefined) {
      return githubFailure('github.schema-mismatch', 'A renamed or copied file entry is missing its previous filename.');
    }
    const kind = statusToKind(item.status);
    if (kind === null) continue;
    const previousPath = item.status === 'renamed' || item.status === 'copied' ? (item.previous_filename ?? null) : null;
    changes.push({ kind, path: item.filename, previousPath });
  }
  return ok({ kind: 'complete', changes });
}

export async function readOpenPullRequestsForCommit(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  commit: string,
): Promise<Result<readonly number[], GitHubFailureCode>> {
  if (!isValidRepository(repository)) return invalidRequest('The repository owner or name is not valid.');
  if (!isObjectId(commit)) return invalidRequest('The commit id is not valid.');
  const result = await client.getPaginated(
    `${repoPath(repository)}/commits/${commit}/pulls`,
    githubCommitPullRequestSchema,
    undefined,
    1,
  );
  if (!result.ok) return result;
  const numbers = new Set<number>();
  for (const item of result.value) {
    if (item.state === 'open' && item.head.sha === commit) {
      numbers.add(item.number);
    }
  }
  return ok(Array.from(numbers).sort((a, b) => a - b));
}

export async function readIssueComment(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  commentId: number,
): Promise<Result<GitHubIssueCommentInfo, GitHubFailureCode>> {
  if (!isValidRepository(repository)) return invalidRequest('The repository owner or name is not valid.');
  if (!isPositiveSafeInt(commentId)) return invalidRequest('The comment id is not valid.');
  const result = await client.getJson(
    `${repoPath(repository)}/issues/comments/${String(commentId)}`,
    githubIssueCommentResponseSchema,
  );
  if (!result.ok) return result;
  return ok({
    id: result.value.id,
    body: result.value.body,
    updatedAt: result.value.updated_at,
    author: authorFrom(result.value.user, result.value.author_association),
  });
}

const directoryResponseSchema = z.union([z.array(githubContentsEntrySchema), z.object({})]);

export async function readDirectoryEntries(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  path: string,
  commit: string,
): Promise<Result<readonly GitHubDirectoryEntry[], GitHubFailureCode>> {
  if (!isValidRepository(repository)) return invalidRequest('The repository owner or name is not valid.');
  if (!isValidPath(path)) return invalidRequest('The path is not valid.');
  if (!isObjectId(commit)) return invalidRequest('The commit id is not valid.');
  const result = await client.getJson(`${repoPath(repository)}/contents/${encodePathSegments(path)}`, directoryResponseSchema, {
    ref: commit,
  });
  if (!result.ok) return result;
  if (!Array.isArray(result.value)) {
    return githubFailure('github.not-a-directory', 'The requested path is not a directory.');
  }
  return ok(
    result.value.map((entry) => ({
      name: entry.name,
      path: entry.path,
      sha: entry.sha,
      type: entry.type,
      size: entry.size,
    })),
  );
}

export async function readGitTree(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  treeSha: string,
  recursive: boolean,
): Promise<Result<GitHubTree, GitHubFailureCode>> {
  if (!isValidRepository(repository)) return invalidRequest('The repository owner or name is not valid.');
  if (!isObjectId(treeSha)) return invalidRequest('The tree id is not valid.');
  const query = recursive ? { recursive: '1' } : undefined;
  const result = await client.getJson(`${repoPath(repository)}/git/trees/${treeSha}`, githubTreeResponseSchema, query);
  if (!result.ok) return result;
  return ok({
    sha: result.value.sha,
    truncated: result.value.truncated,
    entries: result.value.tree.map((entry) => ({
      path: entry.path,
      mode: entry.mode,
      type: entry.type,
      sha: entry.sha,
      size: entry.size ?? null,
    })),
  });
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export async function readGitBlob(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  blobSha: string,
  maxBytes: number,
): Promise<Result<Buffer, GitHubFailureCode>> {
  if (!isValidRepository(repository)) return invalidRequest('The repository owner or name is not valid.');
  if (!isObjectId(blobSha)) return invalidRequest('The blob id is not valid.');
  if (!isNonNegativeSafeInt(maxBytes)) return invalidRequest('The maximum byte count is not valid.');
  const result = await client.getJson(`${repoPath(repository)}/git/blobs/${blobSha}`, githubBlobResponseSchema);
  if (!result.ok) return result;
  if (result.value.size > maxBytes) {
    return githubFailure('github.blob-too-large', 'The requested blob exceeds the allowed size.');
  }
  const stripped = result.value.content.replace(/[\n\r]/g, '');
  if (!BASE64_PATTERN.test(stripped) || stripped.length % 4 !== 0) {
    return githubFailure('github.malformed-response', 'The blob content is not valid base64.');
  }
  const decoded = Buffer.from(stripped, 'base64');
  if (decoded.length !== result.value.size) {
    return githubFailure('github.malformed-response', 'The decoded blob content did not match the recorded size.');
  }
  return ok(decoded);
}

export async function readBranchHead(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  branch: string,
): Promise<Result<string, GitHubFailureCode>> {
  if (!isValidRepository(repository)) return invalidRequest('The repository owner or name is not valid.');
  if (!isValidBranch(branch)) return invalidRequest('The branch name is not valid.');
  const result = await client.getJson(
    `${repoPath(repository)}/git/ref/heads/${encodePathSegments(branch)}`,
    githubRefResponseSchema,
  );
  if (!result.ok) return result;
  if (result.value.object.type !== 'commit') {
    return githubFailure('github.schema-mismatch', 'The branch head does not reference a commit object.');
  }
  return ok(result.value.object.sha);
}
