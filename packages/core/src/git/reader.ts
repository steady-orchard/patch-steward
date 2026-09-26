import * as fs from 'node:fs';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import type { ProcessRunner } from '../process/run-process.js';
import { runProcess } from '../process/run-process.js';

export const POLICY_DIRECTORY = '.github/patch-steward';

export type GitFailureCode =
  | 'git.unavailable'
  | 'git.timeout'
  | 'git.output-too-large'
  | 'git.failed'
  | 'git.malformed-output'
  | 'git.not-a-repository'
  | 'git.invalid-ref'
  | 'git.ref-unresolvable'
  | 'git.invalid-object-id'
  | 'git.policy-directory-missing'
  | 'git.not-a-directory'
  | 'git.entry-missing'
  | 'git.entry-not-regular'
  | 'git.blob-too-large'
  | 'git.object-missing';

export interface GitReadOptions {
  readonly repoDir: string;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly gitBinary?: string;
  readonly runner?: ProcessRunner;
}

export type TreeEntryMode = '100644' | '100755' | '120000' | '160000';

export interface TreeEntry {
  readonly path: string;
  readonly mode: TreeEntryMode;
  readonly type: 'blob' | 'commit';
  readonly id: string;
  readonly size: number | null;
}

const OBJECT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export function isObjectId(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

export function inertGitEnv(base: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) {
      continue;
    }
    if (key.toUpperCase().startsWith('GIT_')) {
      continue;
    }
    result[key] = value;
  }
  result['GIT_TERMINAL_PROMPT'] = '0';
  result['GIT_OPTIONAL_LOCKS'] = '0';
  result['GIT_NO_REPLACE_OBJECTS'] = '1';
  return result;
}

interface RunGitOutput {
  readonly exitCode: number;
  readonly stdout: Buffer;
  readonly stderr: Buffer;
}

function isControlChar(codePoint: number): boolean {
  return codePoint < 0x20 || codePoint === 0x7f;
}

function isInvalidRef(ref: string): boolean {
  if (ref.length === 0) {
    return true;
  }
  if (ref.charAt(0) === '-') {
    return true;
  }
  for (let index = 0; index < ref.length; index += 1) {
    if (isControlChar(ref.charCodeAt(index))) {
      return true;
    }
  }
  return false;
}

async function runGit(
  options: GitReadOptions,
  args: readonly string[],
  maxOutputBytes: number,
): Promise<Result<RunGitOutput, GitFailureCode>> {
  try {
    const stat = await fs.promises.stat(options.repoDir);
    if (!stat.isDirectory()) {
      return err('git.not-a-repository', 'infrastructure', 'The configured repository directory does not exist.');
    }
  } catch {
    return err('git.not-a-repository', 'infrastructure', 'The configured repository directory does not exist.');
  }

  const runner = options.runner ?? runProcess;
  const binary = options.gitBinary ?? 'git';
  const result = await runner(binary, args, {
    cwd: options.repoDir,
    env: inertGitEnv(process.env),
    timeoutMs: options.timeoutMs,
    maxOutputBytes,
  });

  if (!result.ok) {
    switch (result.failure.code) {
      case 'process.unavailable':
        return err('git.unavailable', 'infrastructure', 'The git binary could not be executed.');
      case 'process.timeout':
        return err('git.timeout', 'infrastructure', 'The git process timed out.');
      case 'process.output-too-large':
        return err('git.output-too-large', 'infrastructure', 'The git process produced output exceeding the configured cap.');
      case 'process.failed':
      case 'process.invalid-options':
        return err('git.failed', 'infrastructure', 'The git process terminated abnormally.');
      default:
        return err('git.failed', 'infrastructure', 'The git process terminated abnormally.');
    }
  }

  return ok(result.value);
}

function decodeStrict(buffer: Buffer): Result<string, GitFailureCode> {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return ok(decoder.decode(buffer));
  } catch {
    return err('git.malformed-output', 'infrastructure', 'Git produced output that was not valid UTF-8.');
  }
}

export async function resolveCommit(options: GitReadOptions, ref: string): Promise<Result<string, GitFailureCode>> {
  if (isInvalidRef(ref)) {
    return err('git.invalid-ref', 'policy-unavailable', 'The requested ref is not a valid git ref.');
  }

  const gitDirResult = await runGit(options, ['rev-parse', '--git-dir'], options.maxOutputBytes);
  if (!gitDirResult.ok) {
    return gitDirResult;
  }
  if (gitDirResult.value.exitCode !== 0) {
    return err('git.not-a-repository', 'infrastructure', 'The configured repository directory is not a git repository.');
  }

  const verifyResult = await runGit(
    options,
    ['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`],
    options.maxOutputBytes,
  );
  if (!verifyResult.ok) {
    return verifyResult;
  }

  const { exitCode, stdout } = verifyResult.value;
  if (exitCode === 1) {
    return err('git.ref-unresolvable', 'policy-unavailable', 'The requested ref could not be resolved to a commit.');
  }
  if (exitCode !== 0) {
    return err('git.failed', 'infrastructure', 'The git process terminated abnormally.');
  }

  const decoded = decodeStrict(stdout);
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
    return err('git.malformed-output', 'infrastructure', 'Git produced a commit id that was not a valid object id.');
  }
  return ok(text);
}

const POLICY_TREE_RECORD_PATTERN = /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64})\t(.+)$/s;

export async function readPolicyTreeId(options: GitReadOptions, commit: string): Promise<Result<string, GitFailureCode>> {
  if (!isObjectId(commit)) {
    return err('git.invalid-object-id', 'steward-defect', 'The commit id supplied was not a valid object id.');
  }

  const result = await runGit(options, ['ls-tree', '-z', '--full-tree', commit, '--', POLICY_DIRECTORY], options.maxOutputBytes);
  if (!result.ok) {
    return result;
  }
  if (result.value.exitCode !== 0) {
    return err('git.failed', 'infrastructure', 'The git process terminated abnormally.');
  }

  const decoded = decodeStrict(result.value.stdout);
  if (!decoded.ok) {
    return decoded;
  }

  if (decoded.value.length === 0) {
    return err('git.policy-directory-missing', 'policy-unavailable', 'The policy directory was not found at the requested commit.');
  }

  const parts = decoded.value.split('\0');
  const trailing = parts[parts.length - 1];
  if (trailing !== '') {
    return err('git.malformed-output', 'infrastructure', 'Git produced ls-tree output that was not NUL-terminated.');
  }
  const records = parts.slice(0, -1);
  if (records.length !== 1) {
    return err('git.malformed-output', 'infrastructure', 'Git produced more ls-tree records than expected.');
  }

  const record = records[0] as string;
  const match = POLICY_TREE_RECORD_PATTERN.exec(record);
  if (!match) {
    return err('git.malformed-output', 'infrastructure', 'Git produced an ls-tree record that could not be parsed.');
  }
  const mode = match[1] as string;
  const type = match[2] as string;
  const id = match[3] as string;
  const path = match[4] as string;

  if (path !== POLICY_DIRECTORY) {
    return err('git.malformed-output', 'infrastructure', 'Git produced an ls-tree record for an unexpected path.');
  }

  if (mode === '040000' && type === 'tree') {
    return ok(id);
  }
  if ((mode === '100644' || mode === '100755' || mode === '120000') && type === 'blob') {
    return err('git.not-a-directory', 'policy-unavailable', 'The policy directory path is not a directory.');
  }
  if (mode === '160000' && type === 'commit') {
    return err('git.not-a-directory', 'policy-unavailable', 'The policy directory path is not a directory.');
  }
  return err('git.malformed-output', 'infrastructure', 'Git produced an ls-tree record with an unexpected mode and type.');
}

const LIST_TREE_RECORD_PATTERN = /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64}) +(\d+|-)\t(.+)$/s;

function isTreeEntryMode(mode: string): mode is TreeEntryMode {
  return mode === '100644' || mode === '100755' || mode === '120000' || mode === '160000';
}

export async function listTree(options: GitReadOptions, treeId: string): Promise<Result<readonly TreeEntry[], GitFailureCode>> {
  if (!isObjectId(treeId)) {
    return err('git.invalid-object-id', 'steward-defect', 'The tree id supplied was not a valid object id.');
  }

  const result = await runGit(options, ['ls-tree', '-z', '-r', '-l', '--full-tree', treeId], options.maxOutputBytes);
  if (!result.ok) {
    return result;
  }
  if (result.value.exitCode !== 0) {
    return err('git.failed', 'infrastructure', 'The git process terminated abnormally.');
  }

  const decoded = decodeStrict(result.value.stdout);
  if (!decoded.ok) {
    return decoded;
  }

  const parts = decoded.value.split('\0');
  const trailing = parts[parts.length - 1];
  const records = trailing === '' ? parts.slice(0, -1) : parts;
  if (trailing !== '') {
    return err('git.malformed-output', 'infrastructure', 'Git produced ls-tree output that was not NUL-terminated.');
  }

  const entries: TreeEntry[] = [];
  for (const record of records) {
    if (record.length === 0) {
      continue;
    }
    const match = LIST_TREE_RECORD_PATTERN.exec(record);
    if (!match) {
      return err('git.malformed-output', 'infrastructure', 'Git produced an ls-tree record that could not be parsed.');
    }
    const mode = match[1] as string;
    const type = match[2] as string;
    const id = match[3] as string;
    const sizeText = match[4] as string;
    const path = match[5] as string;

    if (!isTreeEntryMode(mode)) {
      return err('git.malformed-output', 'infrastructure', 'Git produced an ls-tree record with an unexpected mode.');
    }

    if (mode === '160000') {
      if (type !== 'commit' || sizeText !== '-') {
        return err('git.malformed-output', 'infrastructure', 'Git produced an ls-tree record with an unexpected mode and type.');
      }
      entries.push({ path, mode, type: 'commit', id, size: null });
      continue;
    }

    if (type !== 'blob' || sizeText === '-') {
      return err('git.malformed-output', 'infrastructure', 'Git produced an ls-tree record with an unexpected mode and type.');
    }
    const size = Number(sizeText);
    if (!Number.isSafeInteger(size)) {
      return err('git.malformed-output', 'infrastructure', 'Git produced an ls-tree record with an invalid size.');
    }
    entries.push({ path, mode, type: 'blob', id, size });
  }

  return ok(entries);
}

export function findTreeEntry(entries: readonly TreeEntry[], path: string): Result<TreeEntry, GitFailureCode> {
  const found = entries.find((entry) => entry.path === path);
  if (found === undefined) {
    return err('git.entry-missing', 'policy-unavailable', 'The requested entry was not found in the tree.');
  }
  return ok(found);
}

export async function readBlob(
  options: GitReadOptions,
  entry: TreeEntry,
  maxBytes: number,
): Promise<Result<Buffer, GitFailureCode>> {
  if (entry.mode === '120000' || entry.mode === '160000') {
    return err('git.entry-not-regular', 'policy-unavailable', 'The requested entry is not a regular file.');
  }
  if (entry.size === null) {
    return err('git.malformed-output', 'infrastructure', 'The tree entry did not carry a size.');
  }
  if (entry.size > maxBytes) {
    return err('git.blob-too-large', 'policy-invalid', 'The requested blob exceeds the configured size cap.');
  }
  if (!isObjectId(entry.id)) {
    return err('git.invalid-object-id', 'steward-defect', 'The blob id supplied was not a valid object id.');
  }

  const result = await runGit(options, ['cat-file', 'blob', entry.id], maxBytes);
  if (!result.ok) {
    if (result.failure.code === 'git.output-too-large') {
      return err('git.blob-too-large', 'policy-invalid', 'The requested blob exceeds the configured size cap.');
    }
    return result;
  }
  if (result.value.exitCode !== 0) {
    return err('git.object-missing', 'policy-unavailable', 'The requested blob object could not be found.');
  }
  if (result.value.stdout.length !== entry.size) {
    return err('git.malformed-output', 'infrastructure', 'The blob contents did not match the recorded size.');
  }
  return ok(result.value.stdout);
}
