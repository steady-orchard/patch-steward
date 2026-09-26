import type { FailureDetail, Result } from '../result.js';
import { ok } from '../result.js';
import { VALIDATION_ERRORS_MAX, POLICY_FILE_MAX_BYTES } from '../policy/bounds.js';
import { validatePolicyBytes } from '../policy/validate.js';
import { resolvePolicy } from '../policy/resolve.js';
import type { GitFailureCode, GitReadOptions } from '../git/reader.js';
import { POLICY_DIRECTORY, findTreeEntry, listTree, readBlob, readPolicyTreeId } from '../git/reader.js';
import type { GitHubClient, GitHubFailureCode } from '../github/client.js';
import { githubFailure } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { readDirectoryEntries, readGitBlob, readGitTree } from '../github/reader.js';

export const PROPOSED_POLICY_STATUSES = ['valid', 'invalid', 'removed'] as const;
export type ProposedPolicyStatus = (typeof PROPOSED_POLICY_STATUSES)[number];

export type ProposedPolicy =
  | { readonly status: 'valid'; readonly revision: string }
  | { readonly status: 'invalid'; readonly revision: string; readonly errors: readonly FailureDetail[] }
  | { readonly status: 'removed' };

export interface PolicyChange {
  readonly changed: boolean;
  readonly proposed: ProposedPolicy | null;
}

const RUNNER_TREE_PREFIX = `${POLICY_DIRECTORY}/`;

const TRUNCATED_DETAIL: FailureDetail = {
  code: 'policy-source.tree-truncated',
  path: '',
  message: 'The policy directory tree listing was truncated.',
  line: null,
  column: null,
};

const NOT_REGULAR_DETAIL: FailureDetail = {
  code: 'policy-source.entry-not-regular',
  path: '',
  message: 'The policy file is not a regular file.',
  line: null,
  column: null,
};

const TOO_LARGE_DETAIL: FailureDetail = {
  code: 'policy-source.blob-too-large',
  path: '',
  message: 'The policy file exceeds the configured size cap.',
  line: null,
  column: null,
};

const RUNNER_DETAIL: FailureDetail = {
  code: 'policy.undeclared-reference',
  path: 'runner.image.path',
  message: 'runner.image.path names a file that is not a regular file in the policy directory at the loaded commit.',
  line: null,
  column: null,
};

function invalid(revision: string, errors: readonly FailureDetail[]): ProposedPolicy {
  return { status: 'invalid', revision, errors: errors.slice(0, VALIDATION_ERRORS_MAX) };
}

export function proposedPolicyFromBytes(
  revision: string,
  bytes: Uint8Array,
  isRunnerPathRegular: (relativePath: string) => boolean,
): ProposedPolicy {
  const validatedResult = validatePolicyBytes(bytes);
  if (!validatedResult.ok) {
    const details =
      validatedResult.failure.details.length > 0
        ? validatedResult.failure.details
        : [
            {
              code: validatedResult.failure.code,
              path: '',
              message: validatedResult.failure.message,
              line: null,
              column: null,
            },
          ];
    return invalid(revision, details);
  }

  const resolvedResult = resolvePolicy(validatedResult.value);
  if (!resolvedResult.ok) {
    return invalid(revision, [
      {
        code: resolvedResult.failure.code,
        path: '',
        message: resolvedResult.failure.message,
        line: null,
        column: null,
      },
    ]);
  }
  const resolved = resolvedResult.value;

  if (resolved.runner.image.source === 'dockerfile') {
    const rel = resolved.runner.image.path.slice(RUNNER_TREE_PREFIX.length);
    if (!isRunnerPathRegular(rel)) {
      return invalid(revision, [RUNNER_DETAIL]);
    }
  }

  return { status: 'valid', revision };
}

export async function readProposedPolicyFromGitHub(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  commit: string,
): Promise<Result<ProposedPolicy, GitHubFailureCode>> {
  const githubDirResult = await readDirectoryEntries(client, repository, '.github', commit);
  if (!githubDirResult.ok) {
    if (githubDirResult.failure.code === 'github.not-found' || githubDirResult.failure.code === 'github.not-a-directory') {
      return ok({ status: 'removed' });
    }
    return githubDirResult;
  }
  const policyDirEntry = githubDirResult.value.find((entry) => entry.name === 'patch-steward');
  if (policyDirEntry === undefined || policyDirEntry.type !== 'dir') {
    return ok({ status: 'removed' });
  }
  const revision = policyDirEntry.sha;

  const treeResult = await readGitTree(client, repository, revision, true);
  if (!treeResult.ok) {
    return treeResult;
  }
  const tree = treeResult.value;
  if (tree.sha !== revision) {
    return githubFailure('github.malformed-response', 'The returned tree id did not match the requested tree id.');
  }
  if (tree.truncated) {
    return ok(invalid(revision, [TRUNCATED_DETAIL]));
  }

  const policyEntry = tree.entries.find((entry) => entry.path === 'policy.yml');
  if (policyEntry === undefined) {
    return ok({ status: 'removed' });
  }
  if (policyEntry.type !== 'blob' || (policyEntry.mode !== '100644' && policyEntry.mode !== '100755')) {
    return ok(invalid(revision, [NOT_REGULAR_DETAIL]));
  }
  if (policyEntry.size === null || policyEntry.size > POLICY_FILE_MAX_BYTES) {
    return ok(invalid(revision, [TOO_LARGE_DETAIL]));
  }

  const bytesResult = await readGitBlob(client, repository, policyEntry.sha, POLICY_FILE_MAX_BYTES);
  if (!bytesResult.ok) {
    if (bytesResult.failure.code === 'github.blob-too-large') {
      return ok(invalid(revision, [TOO_LARGE_DETAIL]));
    }
    return bytesResult;
  }

  return ok(
    proposedPolicyFromBytes(revision, bytesResult.value, (rel) =>
      tree.entries.some((e) => e.path === rel && e.type === 'blob' && (e.mode === '100644' || e.mode === '100755')),
    ),
  );
}

export async function readProposedPolicyFromGit(
  options: GitReadOptions,
  commit: string,
): Promise<Result<ProposedPolicy, GitFailureCode>> {
  const treeIdResult = await readPolicyTreeId(options, commit);
  if (!treeIdResult.ok) {
    if (treeIdResult.failure.code === 'git.policy-directory-missing' || treeIdResult.failure.code === 'git.not-a-directory') {
      return ok({ status: 'removed' });
    }
    return treeIdResult;
  }
  const revision = treeIdResult.value;

  const entriesResult = await listTree(options, revision);
  if (!entriesResult.ok) {
    return entriesResult;
  }
  const entries = entriesResult.value;

  const entryResult = findTreeEntry(entries, 'policy.yml');
  if (!entryResult.ok) {
    return ok({ status: 'removed' });
  }
  const entry = entryResult.value;

  if (entry.mode === '120000' || entry.mode === '160000') {
    return ok(invalid(revision, [NOT_REGULAR_DETAIL]));
  }
  if (entry.size !== null && entry.size > POLICY_FILE_MAX_BYTES) {
    return ok(invalid(revision, [TOO_LARGE_DETAIL]));
  }

  const bytesResult = await readBlob(options, entry, POLICY_FILE_MAX_BYTES);
  if (!bytesResult.ok) {
    if (bytesResult.failure.code === 'git.blob-too-large') {
      return ok(invalid(revision, [TOO_LARGE_DETAIL]));
    }
    if (bytesResult.failure.code === 'git.entry-not-regular') {
      return ok(invalid(revision, [NOT_REGULAR_DETAIL]));
    }
    return bytesResult;
  }

  return ok(
    proposedPolicyFromBytes(revision, bytesResult.value, (rel) =>
      entries.some((e) => e.path === rel && (e.mode === '100644' || e.mode === '100755')),
    ),
  );
}
