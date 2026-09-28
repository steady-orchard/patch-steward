import { z } from 'zod';

import type { GitHubClient } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { readBranchHead, repositoryRefFromFullName } from '../github/reader.js';
import { githubRefResponseSchema } from '../github/schemas.js';
import type { GitHubWriteFailureCode, GitHubWriter } from '../github/writer.js';
import { githubBranchRefPath, githubRepositoryPath } from '../github/writer.js';
import { EVIDENCE_CONFLICT_WAIT_MAX_MS, EVIDENCE_CONFLICT_WAIT_STEP_MS, EVIDENCE_RUN_FILES_MAX } from '../policy/bounds.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import { repositoryWebUrl } from '../report/escape.js';
import { err, ok } from '../result.js';
import type { Err, Result } from '../result.js';
import type { SubmissionType } from '../vocabulary.js';
import { gitBlobId } from './blob-id.js';
import { repositoryStorePath, runDirectoryName } from './layout.js';
import type { EvidenceLayoutFailureCode } from './layout.js';
import { evidenceCompareSchema, verifyAppendOnlyCompare } from './store-checks.js';
import type { AppendOnlyFailureCode, ReadBackFailureCode, ReadBackMode } from './store-checks.js';

const OBJECT_ID = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);

export const githubGitObjectResponseSchema = z.object({ sha: OBJECT_ID });

export const githubGitCommitResponseSchema = z.object({
  sha: OBJECT_ID,
  tree: z.object({ sha: OBJECT_ID }),
  parents: z.array(z.object({ sha: OBJECT_ID })),
});

export interface EvidenceStoreLocation {
  readonly repository: GitHubRepositoryRef;
  readonly branch: string;
}

export interface EvidenceStoreFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface EvidenceStoreGroup {
  readonly directory: string;
  readonly mode: ReadBackMode;
  readonly files: readonly EvidenceStoreFile[];
}

export interface EvidenceCommitInput {
  readonly store: EvidenceStoreLocation;
  readonly targetRepository: string;
  readonly subject: { readonly type: SubmissionType; readonly number: number };
  readonly runId: number;
  readonly runAttempt: number;
  readonly groups: readonly EvidenceStoreGroup[];
  readonly maxBytes: number;
  readonly writeRetries: number;
}

export interface EvidenceCommitDeps {
  readonly client: GitHubClient;
  readonly writer: GitHubWriter;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface EvidenceCommitReceipt {
  readonly commit: string;
  readonly tree: string;
  readonly parent: string | null;
  readonly rebuilds: number;
  readonly paths: readonly string[];
}

export type EvidenceStoreConflictFailureCode = 'evidence.store-conflict';

export type EvidenceStoreFailureCode =
  | GitHubWriteFailureCode
  | AppendOnlyFailureCode
  | ReadBackFailureCode
  | EvidenceLayoutFailureCode
  | EvidenceStoreConflictFailureCode
  | 'evidence.too-large'
  | 'evidence.too-many-files';

const LAYOUT_MESSAGE = 'The evidence commit layout is invalid.';
const READBACK_MESSAGE = 'The evidence read-back does not match the committed files.';

function layoutInvalid(token: string): Err<'evidence.layout-invalid'> {
  return err('evidence.layout-invalid', 'steward-defect', LAYOUT_MESSAGE, [
    { code: 'evidence.layout-invalid', path: token, message: LAYOUT_MESSAGE, line: null, column: null },
  ]);
}

function readbackMismatch(path: string): Err<'evidence.readback-mismatch'> {
  return err('evidence.readback-mismatch', 'infrastructure', READBACK_MESSAGE, [
    { code: 'evidence.readback-mismatch', path, message: READBACK_MESSAGE, line: null, column: null },
  ]);
}

const STORE_BRANCH_FORBIDDEN_PATTERN = /[~^:?*[\\]/;
// eslint-disable-next-line no-control-regex -- control characters and DEL are deliberately rejected
const STORE_BRANCH_CONTROL_PATTERN = /[\x00-\x20\x7f]/;

function isValidStoreBranch(branch: string): boolean {
  if (branch.length < 1 || branch.length > 255) return false;
  if (STORE_BRANCH_CONTROL_PATTERN.test(branch)) return false;
  if (STORE_BRANCH_FORBIDDEN_PATTERN.test(branch)) return false;
  if (branch.includes('..')) return false;
  if (branch.includes('//')) return false;
  if (branch.startsWith('-') || branch.startsWith('/')) return false;
  if (branch.endsWith('/') || branch.endsWith('.')) return false;
  return true;
}

const DIRECTORY_PATTERN =
  /^(?:runs\/(pr|issue)-([1-9][0-9]{0,9})\/([1-9][0-9]{0,19}-[1-9][0-9]{0,9}|supersessions)|metrics\/[0-9]{4}-(?:0[1-9]|1[0-2]))$/;
const RUN_DIRECTORY_PATTERN = /^[1-9][0-9]{0,19}-[1-9][0-9]{0,9}$/;
const FILE_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(\/[A-Za-z0-9][A-Za-z0-9._-]{0,127})?$/;

function subjectKind(type: SubmissionType): string {
  return type === 'pull_request' ? 'pr' : 'issue';
}

interface PreparedEntry {
  readonly fullPath: string;
  readonly blobId: string;
  readonly bytes: Uint8Array;
}

interface PreparedCommit {
  readonly entries: readonly PreparedEntry[];
  readonly paths: readonly string[];
}

function validateAndPrepare(input: EvidenceCommitInput): Result<PreparedCommit, EvidenceStoreFailureCode> {
  const { store, targetRepository, subject, runId, runAttempt, groups, maxBytes, writeRetries } = input;

  if (!isValidStoreBranch(store.branch)) {
    return layoutInvalid('branch');
  }
  if (repositoryRefFromFullName(`${store.repository.owner}/${store.repository.name}`) === null) {
    return layoutInvalid('store');
  }
  const rootPath = repositoryStorePath(targetRepository, 'runs');
  if (!rootPath.ok) {
    return layoutInvalid('repository');
  }
  if (!Number.isSafeInteger(runId) || runId <= 0 || !Number.isSafeInteger(runAttempt) || runAttempt <= 0) {
    return layoutInvalid('run');
  }
  if (!Number.isSafeInteger(subject.number) || subject.number <= 0) {
    return layoutInvalid('subject');
  }
  if (!Number.isInteger(writeRetries) || writeRetries < 0 || writeRetries > 10) {
    return layoutInvalid('retries');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    return layoutInvalid('max-bytes');
  }
  if (groups.length < 1) {
    return layoutInvalid('groups');
  }
  const directorySet = new Set(groups.map((group) => group.directory));
  if (directorySet.size !== groups.length) {
    return layoutInvalid('groups');
  }

  const expectedRunDirectory = runDirectoryName(runId, runAttempt);
  const expectedKind = subjectKind(subject.type);

  for (const group of groups) {
    const match = DIRECTORY_PATTERN.exec(group.directory);
    if (match === null) {
      return layoutInvalid('directory');
    }
    const kind = match[1];
    const number = match[2];
    const subPart = match[3];
    let requiredMode: ReadBackMode = 'contains';
    if (kind !== undefined) {
      if (kind !== expectedKind || number !== String(subject.number)) {
        return layoutInvalid('subject');
      }
      if (subPart !== undefined && RUN_DIRECTORY_PATTERN.test(subPart)) {
        if (subPart !== expectedRunDirectory) {
          return layoutInvalid('run');
        }
        requiredMode = 'exact';
      }
    }
    if (group.mode !== requiredMode) {
      return layoutInvalid('mode');
    }
    if (group.files.length < 1) {
      return layoutInvalid('files');
    }
    const fileSet = new Set(group.files.map((file) => file.path));
    if (fileSet.size !== group.files.length) {
      return layoutInvalid('file');
    }
    for (const file of group.files) {
      if (!FILE_PATH_PATTERN.test(file.path)) {
        return layoutInvalid('file');
      }
    }
  }

  let totalFiles = 0;
  let totalBytes = 0;
  for (const group of groups) {
    totalFiles += group.files.length;
    for (const file of group.files) {
      totalBytes += file.bytes.length;
    }
  }
  if (totalFiles > EVIDENCE_RUN_FILES_MAX + 2) {
    return err('evidence.too-many-files', 'budget-exhausted', 'The evidence has too many files.');
  }
  if (totalBytes > maxBytes) {
    return err('evidence.too-large', 'budget-exhausted', 'The evidence exceeds limits.evidence.run_bytes.');
  }

  const entries: PreparedEntry[] = [];
  for (const group of groups) {
    for (const file of group.files) {
      const fullPathResult = repositoryStorePath(targetRepository, `${group.directory}/${file.path}`);
      if (!fullPathResult.ok) {
        return layoutInvalid('directory');
      }
      entries.push({ fullPath: fullPathResult.value, blobId: gitBlobId(file.bytes), bytes: file.bytes });
    }
  }
  const paths = entries.map((entry) => entry.fullPath).sort();

  return ok({ entries, paths });
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function evidenceStoreLocation(
  store: ResolvedPolicy['evidence']['store'],
  targetRepository: string,
): Result<EvidenceStoreLocation, EvidenceLayoutFailureCode> {
  const repository =
    store.type === 'orphan-branch' ? repositoryRefFromFullName(targetRepository) : repositoryRefFromFullName(store.repository);
  if (repository === null) {
    return err('evidence.layout-invalid', 'steward-defect', 'The evidence store location is invalid.');
  }
  return ok({ repository, branch: store.branch });
}

export function evidenceCommitMessage(
  targetRepository: string,
  subject: { readonly type: SubmissionType; readonly number: number },
  runId: number,
  runAttempt: number,
): string {
  return `evidence: ${targetRepository} ${subjectKind(subject.type)}-${subject.number} run ${runId}-${runAttempt}`;
}

export function hostedEvidenceLocation(store: EvidenceStoreLocation, targetRepository: string, storePath: string): string {
  const repositoryFullName = `${store.repository.owner}/${store.repository.name}`;
  const segments = ['tree', ...store.branch.split('/'), ...targetRepository.split('/'), ...storePath.split('/')];
  return repositoryWebUrl(repositoryFullName, segments);
}

export async function commitEvidence(
  input: EvidenceCommitInput,
  deps: EvidenceCommitDeps,
): Promise<Result<EvidenceCommitReceipt, EvidenceStoreFailureCode>> {
  try {
    const prepared = validateAndPrepare(input);
    if (!prepared.ok) {
      return prepared;
    }
    const { entries, paths } = prepared.value;
    const { store, writeRetries } = input;
    const { client, writer } = deps;
    const sleep = deps.sleep ?? defaultSleep;
    const repo = githubRepositoryPath(store.repository);
    const message = evidenceCommitMessage(input.targetRepository, input.subject, input.runId, input.runAttempt);
    const treeEntries = entries.map((entry) => ({
      path: entry.fullPath,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: entry.blobId,
    }));

    let rebuilds = 0;
    let blobsCreated = false;

    for (;;) {
      const tipResult = await readBranchHead(client, store.repository, store.branch);
      let tip: string | null;
      if (tipResult.ok) {
        tip = tipResult.value;
      } else if (tipResult.failure.code === 'github.not-found') {
        tip = null;
      } else {
        return tipResult;
      }

      let tipTree: string | null = null;
      if (tip !== null) {
        const commitResult = await client.getJson(`${repo}/git/commits/${tip}`, githubGitCommitResponseSchema);
        if (!commitResult.ok) {
          return commitResult;
        }
        tipTree = commitResult.value.tree.sha;
      }

      if (!blobsCreated) {
        for (const entry of entries) {
          const blobResult = await writer.send(
            {
              method: 'POST',
              path: `${repo}/git/blobs`,
              body: { content: Buffer.from(entry.bytes).toString('base64'), encoding: 'base64' },
            },
            githubGitObjectResponseSchema,
          );
          if (!blobResult.ok) {
            return blobResult;
          }
          if (blobResult.value.sha !== entry.blobId) {
            return readbackMismatch('blob-create');
          }
        }
        blobsCreated = true;
      }

      const treeResult = await writer.send(
        {
          method: 'POST',
          path: `${repo}/git/trees`,
          body: tip !== null && tipTree !== null ? { base_tree: tipTree, tree: treeEntries } : { tree: treeEntries },
        },
        githubGitObjectResponseSchema,
      );
      if (!treeResult.ok) {
        return treeResult;
      }
      const treeSha = treeResult.value.sha;

      const parents = tip !== null ? [tip] : [];
      const commitResult = await writer.send(
        { method: 'POST', path: `${repo}/git/commits`, body: { message, tree: treeSha, parents } },
        githubGitCommitResponseSchema,
      );
      if (!commitResult.ok) {
        return commitResult;
      }
      const commitSha = commitResult.value.sha;
      if (commitResult.value.tree.sha !== treeSha) {
        return readbackMismatch('commit-create');
      }
      const returnedParents = commitResult.value.parents.map((parent) => parent.sha);
      if (returnedParents.length !== parents.length || returnedParents.some((sha, index) => sha !== parents[index])) {
        return readbackMismatch('commit-create');
      }

      if (tip !== null) {
        const compareResult = await client.getJson(`${repo}/compare/${tip}...${commitSha}`, evidenceCompareSchema);
        if (!compareResult.ok) {
          return compareResult;
        }
        const appendOnlyResult = verifyAppendOnlyCompare(compareResult.value, paths);
        if (!appendOnlyResult.ok) {
          return appendOnlyResult;
        }
      }

      const updateResult =
        tip !== null
          ? await writer.send(
              {
                method: 'PATCH',
                path: githubBranchRefPath(store.repository, store.branch),
                body: { sha: commitSha, force: false },
              },
              githubRefResponseSchema,
            )
          : await writer.send(
              { method: 'POST', path: `${repo}/git/refs`, body: { ref: `refs/heads/${store.branch}`, sha: commitSha } },
              githubRefResponseSchema,
            );

      if (updateResult.ok) {
        if (updateResult.value.object.sha !== commitSha) {
          return readbackMismatch('ref-update');
        }
        return ok({ commit: commitSha, tree: treeSha, parent: tip, rebuilds, paths });
      }

      if (updateResult.failure.code === 'github.write-conflict') {
        if (rebuilds < writeRetries) {
          rebuilds += 1;
          await sleep(Math.min(EVIDENCE_CONFLICT_WAIT_STEP_MS * rebuilds, EVIDENCE_CONFLICT_WAIT_MAX_MS));
          continue;
        }
        return err('evidence.store-conflict', 'infrastructure', 'The evidence store stayed in conflict after the allowed retries.');
      }
      return updateResult;
    }
  } catch {
    return layoutInvalid('exception');
  }
}
