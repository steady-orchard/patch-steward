import * as fs from 'node:fs';

import type { Result } from '../result.js';
import { err, ok } from '../result.js';
import type { ProcessRunner } from '../process/run-process.js';
import type { GitFailureCode, GitReadOptions } from '../git/reader.js';
import { POLICY_DIRECTORY, findTreeEntry, listTree, readBlob, readPolicyTreeId, resolveCommit } from '../git/reader.js';
import type { LocalRevisionId } from '../hash.js';
import { localFileRevisionId } from '../hash.js';
import { GIT_OUTPUT_MAX_BYTES, GIT_TIMEOUT_MS, POLICY_FILE_MAX_BYTES } from './bounds.js';
import type { StrictYamlFailureCode } from '../strict-yaml.js';
import type { PolicyValidationCode } from './catalog.js';
import { validatePolicyBytes } from './validate.js';
import type { PolicyResolveFailureCode } from './resolve.js';
import { resolvePolicy } from './resolve.js';
import type { ResolvedPolicy } from './schema.js';

export const POLICY_FILE_NAME = 'policy.yml';

const RUNNER_TREE_PREFIX = `${POLICY_DIRECTORY}/`;

export type PolicySource =
  { readonly kind: 'git'; readonly repoDir: string; readonly ref: string } | { readonly kind: 'file'; readonly path: string };

export type PolicyRevision =
  | { readonly kind: 'git-tree'; readonly id: string; readonly commit: string; readonly ref: string }
  | { readonly kind: 'local-file'; readonly id: LocalRevisionId; readonly path: string };

export interface LoadedPolicy {
  readonly revision: PolicyRevision;
  readonly policy: ResolvedPolicy;
  readonly authoritative: boolean;
}

export type FileSourceFailureCode = 'file.not-found' | 'file.not-a-file' | 'file.unreadable' | 'file.too-large';

export type PolicyLoadFailureCode =
  GitFailureCode | FileSourceFailureCode | StrictYamlFailureCode | PolicyValidationCode | PolicyResolveFailureCode;

export interface LoadPolicyOptions {
  readonly runner?: ProcessRunner;
  readonly gitBinary?: string;
}

function buildGitOptions(source: Extract<PolicySource, { kind: 'git' }>, options: LoadPolicyOptions | undefined): GitReadOptions {
  return {
    repoDir: source.repoDir,
    timeoutMs: GIT_TIMEOUT_MS,
    maxOutputBytes: GIT_OUTPUT_MAX_BYTES,
    ...(options?.gitBinary !== undefined ? { gitBinary: options.gitBinary } : {}),
    ...(options?.runner !== undefined ? { runner: options.runner } : {}),
  };
}

async function loadFromGit(
  source: Extract<PolicySource, { kind: 'git' }>,
  options: LoadPolicyOptions | undefined,
): Promise<Result<LoadedPolicy, PolicyLoadFailureCode>> {
  const gitOptions = buildGitOptions(source, options);

  const commitResult = await resolveCommit(gitOptions, source.ref);
  if (!commitResult.ok) {
    return commitResult;
  }
  const commit = commitResult.value;

  const treeIdResult = await readPolicyTreeId(gitOptions, commit);
  if (!treeIdResult.ok) {
    return treeIdResult;
  }
  const treeId = treeIdResult.value;

  const entriesResult = await listTree(gitOptions, treeId);
  if (!entriesResult.ok) {
    return entriesResult;
  }
  const entries = entriesResult.value;

  const entryResult = findTreeEntry(entries, POLICY_FILE_NAME);
  if (!entryResult.ok) {
    return entryResult;
  }

  const bytesResult = await readBlob(gitOptions, entryResult.value, POLICY_FILE_MAX_BYTES);
  if (!bytesResult.ok) {
    return bytesResult;
  }

  const validatedResult = validatePolicyBytes(bytesResult.value);
  if (!validatedResult.ok) {
    return validatedResult;
  }

  const resolvedResult = resolvePolicy(validatedResult.value);
  if (!resolvedResult.ok) {
    return resolvedResult;
  }
  const resolved = resolvedResult.value;

  if (resolved.runner.image.source === 'dockerfile') {
    const rel = resolved.runner.image.path.slice(RUNNER_TREE_PREFIX.length);
    const dockerfileEntryResult = findTreeEntry(entries, rel);
    const isRegular =
      dockerfileEntryResult.ok && (dockerfileEntryResult.value.mode === '100644' || dockerfileEntryResult.value.mode === '100755');
    if (!isRegular) {
      return err(
        'policy.undeclared-reference',
        'policy-invalid',
        'runner.image.path names a file that is not present as a regular file in the policy directory at the loaded commit; no default is substituted and the run would end inconclusive.',
        [
          {
            code: 'policy.undeclared-reference',
            path: 'runner.image.path',
            message: 'runner.image.path names a file that is not a regular file in the policy directory at the loaded commit.',
            line: null,
            column: null,
          },
        ],
      );
    }
  }

  return ok({
    revision: { kind: 'git-tree', id: treeId, commit, ref: source.ref },
    policy: resolved,
    authoritative: true,
  });
}

async function loadFromFile(source: Extract<PolicySource, { kind: 'file' }>): Promise<Result<LoadedPolicy, PolicyLoadFailureCode>> {
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(source.path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return err('file.not-found', 'policy-unavailable', 'The requested policy file does not exist.');
    }
    return err('file.unreadable', 'policy-unavailable', 'The requested policy file could not be read.');
  }

  if (!stat.isFile()) {
    return err('file.not-a-file', 'policy-unavailable', 'The requested policy path is not a regular file.');
  }

  if (stat.size > POLICY_FILE_MAX_BYTES) {
    return err('file.too-large', 'policy-invalid', 'The requested policy file exceeds the configured size cap.');
  }

  let bytes: Buffer;
  try {
    bytes = await fs.promises.readFile(source.path);
  } catch {
    return err('file.unreadable', 'policy-unavailable', 'The requested policy file could not be read.');
  }

  if (bytes.length > POLICY_FILE_MAX_BYTES) {
    return err('file.too-large', 'policy-invalid', 'The requested policy file exceeds the configured size cap.');
  }

  const validatedResult = validatePolicyBytes(bytes);
  if (!validatedResult.ok) {
    return validatedResult;
  }

  const resolvedResult = resolvePolicy(validatedResult.value);
  if (!resolvedResult.ok) {
    return resolvedResult;
  }

  return ok({
    revision: { kind: 'local-file', id: localFileRevisionId(bytes), path: source.path },
    policy: resolvedResult.value,
    authoritative: false,
  });
}

export async function loadPolicy(
  source: PolicySource,
  options?: LoadPolicyOptions,
): Promise<Result<LoadedPolicy, PolicyLoadFailureCode>> {
  if (source.kind === 'git') {
    return loadFromGit(source, options);
  }
  return loadFromFile(source);
}
