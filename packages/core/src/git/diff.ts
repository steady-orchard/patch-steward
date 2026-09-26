import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import type { GitReadOptions, GitFailureCode } from './reader.js';
import { isObjectId } from './reader.js';
import { runGitCommand, decodeGitOutput } from './command.js';
import type { PathChange, PathChangeKind } from '../submission/paths.js';
import { CHANGED_PATHS_MAX, CHANGED_PATH_MAX_BYTES } from '../policy/bounds.js';

export type MergeBaseFailureCode = GitFailureCode | 'git.no-merge-base';

export type GitChangedPaths =
  { readonly kind: 'complete'; readonly changes: readonly PathChange[] } | { readonly kind: 'too-large' };

export async function findMergeBase(
  options: GitReadOptions,
  first: string,
  second: string,
): Promise<Result<string, MergeBaseFailureCode>> {
  if (!isObjectId(first) || !isObjectId(second)) {
    return err('git.invalid-object-id', 'steward-defect', 'The commit id supplied was not a valid object id.');
  }

  const result = await runGitCommand(options, ['merge-base', '--end-of-options', first, second], options.maxOutputBytes);
  if (!result.ok) {
    return result;
  }

  const { exitCode, stdout } = result.value;
  if (exitCode === 1 && stdout.length === 0) {
    return err('git.no-merge-base', 'infrastructure', 'The commits have no common ancestor.');
  }
  if (exitCode !== 0) {
    return err('git.failed', 'infrastructure', 'The git process terminated abnormally.');
  }

  const decoded = decodeGitOutput(stdout);
  if (!decoded.ok) {
    return decoded;
  }
  let text = decoded.value;
  if (text.endsWith('\n')) {
    text = text.slice(0, -1);
  }
  if (text.endsWith('\r')) {
    text = text.slice(0, -1);
  }
  if (!isObjectId(text)) {
    return err('git.malformed-output', 'infrastructure', 'Git produced a merge base id that was not a valid object id.');
  }
  return ok(text);
}

const SINGLE_PATH_STATUS = /^[AMDT]$/;
const TWO_PATH_STATUS = /^[RC][0-9]{1,3}$/;

function kindForStatus(status: string): PathChangeKind | null {
  switch (status) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'D':
      return 'deleted';
    case 'T':
      return 'type-changed';
    default:
      if (status.startsWith('R')) {
        return 'renamed';
      }
      if (status.startsWith('C')) {
        return 'copied';
      }
      return null;
  }
}

export async function listChangedPaths(
  options: GitReadOptions,
  from: string,
  to: string,
): Promise<Result<GitChangedPaths, GitFailureCode>> {
  if (!isObjectId(from) || !isObjectId(to)) {
    return err('git.invalid-object-id', 'steward-defect', 'The commit id supplied was not a valid object id.');
  }

  const result = await runGitCommand(
    options,
    ['diff-tree', '-r', '-z', '--name-status', '-M', '--no-ext-diff', '--no-textconv', '--end-of-options', from, to],
    options.maxOutputBytes,
  );
  if (!result.ok) {
    if (result.failure.code === 'git.output-too-large') {
      return ok({ kind: 'too-large' });
    }
    return result;
  }

  const { exitCode, stdout } = result.value;
  if (exitCode !== 0) {
    return err('git.failed', 'infrastructure', 'The git process terminated abnormally.');
  }

  const decoded = decodeGitOutput(stdout);
  if (!decoded.ok) {
    return decoded;
  }
  const text = decoded.value;
  if (text.length === 0) {
    return ok({ kind: 'complete', changes: [] });
  }
  if (!text.endsWith('\0')) {
    return err('git.malformed-output', 'infrastructure', 'Git produced diff-tree output that was not NUL-terminated.');
  }

  const tokens = text.split('\0');
  tokens.pop();

  const changes: PathChange[] = [];
  let index = 0;
  let tooLarge = false;
  while (index < tokens.length) {
    const status = tokens[index];
    if (status === undefined || status.length === 0) {
      return err('git.malformed-output', 'infrastructure', 'Git produced diff-tree output with an unexpected status token.');
    }
    index += 1;

    if (SINGLE_PATH_STATUS.test(status)) {
      const p = tokens[index];
      index += 1;
      if (p === undefined || p.length === 0) {
        return err('git.malformed-output', 'infrastructure', 'Git produced diff-tree output with a missing path token.');
      }
      const kind = kindForStatus(status);
      if (kind === null) {
        return err('git.malformed-output', 'infrastructure', 'Git produced diff-tree output with an unexpected status token.');
      }
      if (Buffer.byteLength(p, 'utf8') > CHANGED_PATH_MAX_BYTES) {
        tooLarge = true;
      }
      changes.push({ kind, path: p, previousPath: null });
      continue;
    }

    if (TWO_PATH_STATUS.test(status)) {
      const oldPath = tokens[index];
      const newPath = tokens[index + 1];
      index += 2;
      if (oldPath === undefined || oldPath.length === 0 || newPath === undefined || newPath.length === 0) {
        return err('git.malformed-output', 'infrastructure', 'Git produced diff-tree output with a missing path token.');
      }
      const kind = status.startsWith('R') ? 'renamed' : 'copied';
      if (
        Buffer.byteLength(oldPath, 'utf8') > CHANGED_PATH_MAX_BYTES ||
        Buffer.byteLength(newPath, 'utf8') > CHANGED_PATH_MAX_BYTES
      ) {
        tooLarge = true;
      }
      changes.push({ kind, path: newPath, previousPath: oldPath });
      continue;
    }

    return err('git.malformed-output', 'infrastructure', 'Git produced diff-tree output with an unexpected status token.');
  }

  if (tooLarge || changes.length > CHANGED_PATHS_MAX) {
    return ok({ kind: 'too-large' });
  }

  return ok({ kind: 'complete', changes });
}

const COMMIT_TREE_LINE = /^tree (?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const COMMIT_PARENT_LINE = /^parent (?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export async function countCommitParents(options: GitReadOptions, commit: string): Promise<Result<number, GitFailureCode>> {
  if (!isObjectId(commit)) {
    return err('git.invalid-object-id', 'steward-defect', 'The commit id supplied was not a valid object id.');
  }

  const result = await runGitCommand(options, ['cat-file', 'commit', commit], options.maxOutputBytes);
  if (!result.ok) {
    return result;
  }

  const { exitCode, stdout } = result.value;
  if (exitCode !== 0) {
    return err('git.object-missing', 'infrastructure', 'The requested commit object could not be found.');
  }

  const decoded = decodeGitOutput(stdout);
  if (!decoded.ok) {
    return decoded;
  }
  const text = decoded.value;
  const separatorIndex = text.indexOf('\n\n');
  const header = separatorIndex === -1 ? text : text.slice(0, separatorIndex);
  const lines = header.split('\n');

  const treeLine = lines[0];
  if (treeLine === undefined || !COMMIT_TREE_LINE.test(treeLine)) {
    return err('git.malformed-output', 'infrastructure', 'Git produced a commit object without a valid tree line.');
  }

  let count = 0;
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined || !COMMIT_PARENT_LINE.test(line)) {
      break;
    }
    count += 1;
  }
  return ok(count);
}
