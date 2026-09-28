import type { GitHubClient, GitHubFailureCode } from '../github/client.js';
import { readBranchHead } from '../github/reader.js';
import { githubTreeResponseSchema } from '../github/schemas.js';
import { githubRepositoryPath } from '../github/writer.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import { gitBlobId } from './blob-id.js';
import type { EvidenceCommitDeps, EvidenceCommitInput, EvidenceStoreGroup, EvidenceStoreLocation } from './git-store.js';
import { commitEvidence } from './git-store.js';
import type { EvidenceCommitReceipt, EvidenceStoreFailureCode } from './git-store.js';
import { repositoryStorePath } from './layout.js';
import type { EvidenceLayoutFailureCode } from './layout.js';
import { evidenceCompareSchema, readBackTipAccepted, verifyReadBackTree } from './store-checks.js';
import type { ReadBackFailureCode } from './store-checks.js';

export interface EvidenceReadBackInput {
  readonly store: EvidenceStoreLocation;
  readonly targetRepository: string;
  readonly groups: readonly EvidenceStoreGroup[];
}

export type EvidenceReadBackFailureCode = GitHubFailureCode | ReadBackFailureCode | EvidenceLayoutFailureCode;

export interface EvidenceReadBackResult {
  readonly head: string;
  readonly files: number;
}

const COMMIT_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const READBACK_MESSAGE = 'The evidence read-back does not match the committed files.';

function readbackMismatch(path: string): Result<never, 'evidence.readback-mismatch'> {
  return err('evidence.readback-mismatch', 'infrastructure', READBACK_MESSAGE, [
    { code: 'evidence.readback-mismatch', path, message: READBACK_MESSAGE, line: null, column: null },
  ]);
}

export async function readBackEvidence(
  client: GitHubClient,
  input: EvidenceReadBackInput,
  commit: string,
): Promise<Result<EvidenceReadBackResult, EvidenceReadBackFailureCode>> {
  try {
    if (!COMMIT_PATTERN.test(commit)) {
      return readbackMismatch('commit');
    }

    const { store, targetRepository, groups } = input;
    const repo = githubRepositoryPath(store.repository);

    const headResult = await readBranchHead(client, store.repository, store.branch);
    if (!headResult.ok) {
      return headResult;
    }
    const head = headResult.value;

    if (head !== commit) {
      const compareResult = await client.getJson(`${repo}/compare/${commit}...${head}`, evidenceCompareSchema);
      if (!compareResult.ok) {
        return compareResult;
      }
      if (!readBackTipAccepted(compareResult.value)) {
        return readbackMismatch('tip');
      }
    }

    let totalFiles = 0;
    for (const group of groups) {
      const prefixResult = repositoryStorePath(targetRepository, group.directory);
      if (!prefixResult.ok) {
        return prefixResult;
      }
      const encodedPrefix = prefixResult.value
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      const query = group.mode === 'exact' ? { recursive: '1' } : undefined;
      const treeResult = await client.getJson(`${repo}/git/trees/${commit}:${encodedPrefix}`, githubTreeResponseSchema, query);
      if (!treeResult.ok) {
        return treeResult;
      }
      if (treeResult.value.truncated) {
        return readbackMismatch('truncated');
      }
      const entries = treeResult.value.tree.map((entry) => ({
        path: entry.path,
        type: entry.type,
        sha: entry.sha,
        mode: entry.mode,
      }));
      const expected = group.files.map((file) => ({ path: file.path, blobId: gitBlobId(file.bytes) }));
      const verified = verifyReadBackTree(entries, expected, group.mode);
      if (!verified.ok) {
        return verified;
      }
      totalFiles += group.files.length;
    }

    return ok({ head, files: totalFiles });
  } catch {
    return readbackMismatch('exception');
  }
}

export interface EvidenceWriteReceipt extends EvidenceCommitReceipt {
  readonly head: string;
}

export async function writeEvidenceCommit(
  input: EvidenceCommitInput,
  deps: EvidenceCommitDeps,
): Promise<Result<EvidenceWriteReceipt, EvidenceStoreFailureCode>> {
  const commitResult = await commitEvidence(input, deps);
  if (!commitResult.ok) {
    return commitResult;
  }
  const receipt = commitResult.value;
  const readBackResult = await readBackEvidence(
    deps.client,
    { store: input.store, targetRepository: input.targetRepository, groups: input.groups },
    receipt.commit,
  );
  if (!readBackResult.ok) {
    return readBackResult;
  }
  return ok({ ...receipt, head: readBackResult.value.head });
}
