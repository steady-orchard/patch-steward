import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runGitCommand } from '../git/command.js';
import type { GitReadOptions } from '../git/reader.js';
import { isObjectId, listTree, readBlob } from '../git/reader.js';
import { checkOverlay, treeKindForMode, type CheckoutTreeKind, type OverlayEntry } from '../materialize/paths.js';
import { GIT_OUTPUT_MAX_BYTES, GIT_TIMEOUT_MS } from '../policy/bounds.js';
import type { ProcessRunner } from '../process/run-process.js';
import type { PathChange } from '../submission/paths.js';
import { err, ok, type Result } from '../result.js';

export interface PreviewGitOptions {
  readonly runner?: ProcessRunner;
  readonly gitBinary?: string;
}

export interface PreviewWorktreeInput extends PreviewGitOptions {
  readonly checkoutRoot: string;
  readonly mergeBase: string;
  readonly head: string;
  readonly changes: readonly PathChange[];
  readonly limits: { readonly overlayFiles: number; readonly overlayBytes: number };
}

export interface PreviewWorktree {
  readonly root: string;
  readonly overlayPaths: readonly string[];
  dispose(): Promise<void>;
}

export type PreviewWorktreeFailureCode = 'preflight.preview-unavailable' | 'materialize.overlay-rejected';

function gitOptions(repoDir: string, options: PreviewGitOptions | undefined): GitReadOptions {
  return {
    repoDir,
    timeoutMs: GIT_TIMEOUT_MS,
    maxOutputBytes: GIT_OUTPUT_MAX_BYTES,
    ...(options?.runner !== undefined ? { runner: options.runner } : {}),
    ...(options?.gitBinary !== undefined ? { gitBinary: options.gitBinary } : {}),
  };
}

export async function checkoutTopLevel(cwd: string, options?: PreviewGitOptions): Promise<string | null> {
  try {
    const result = await runGitCommand(gitOptions(cwd, options), ['rev-parse', '--show-toplevel'], GIT_OUTPUT_MAX_BYTES);
    if (!result.ok || result.value.exitCode !== 0) {
      return null;
    }
    const text = result.value.stdout.toString('utf8').replace(/\r?\n$/, '');
    if (text.length === 0) {
      return null;
    }
    // native: JS realpath leaves Windows 8.3 short names (RUNNER~1) unexpanded
    return fs.realpathSync.native(text);
  } catch {
    return null;
  }
}

export async function workingTreeDirty(root: string, options?: PreviewGitOptions): Promise<boolean | null> {
  const result = await runGitCommand(
    gitOptions(root, options),
    ['--no-optional-locks', 'status', '--porcelain'],
    GIT_OUTPUT_MAX_BYTES,
  );
  if (!result.ok || result.value.exitCode !== 0) {
    return null;
  }
  return result.value.stdout.length > 0;
}

function unavailable(reason: string): Result<never, 'preflight.preview-unavailable'> {
  return err('preflight.preview-unavailable', 'environment-unavailable', 'The preview worktree could not be created.', [
    { code: 'preflight.preview-unavailable', path: '', message: reason, line: null, column: null },
  ]);
}

function rejected(filePath: string, reason: string): Result<never, 'materialize.overlay-rejected'> {
  return err('materialize.overlay-rejected', 'environment-unavailable', 'The overlay was rejected.', [
    { code: 'materialize.overlay-rejected', path: filePath, message: reason, line: null, column: null },
  ]);
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

// Returns a reason when the target or any existing ancestor could lead outside the worktree.
function unsafeTarget(root: string, relativePath: string): string | null {
  const segments = relativePath.split('/');
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index] as string);
    const isTarget = index === segments.length - 1;
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch {
      return null;
    }
    if (stat.isSymbolicLink()) {
      return 'symlink-in-path';
    }
    if (isTarget) {
      return stat.isDirectory() ? 'target-not-file' : null;
    }
    if (!stat.isDirectory()) {
      return 'prefix-not-directory';
    }
    let real: string;
    try {
      real = fs.realpathSync(current);
    } catch {
      return 'realpath-failed';
    }
    if (!isInside(root, real)) {
      return 'outside-worktree';
    }
  }
  return null;
}

function applyOverlay(root: string, overlay: readonly OverlayEntry[]): Result<null, 'materialize.overlay-rejected'> {
  for (const entry of overlay) {
    const reason = unsafeTarget(root, entry.path);
    if (reason !== null) {
      return rejected(entry.path, reason);
    }
    const target = path.join(root, ...entry.path.split('/'));
    try {
      if ('delete' in entry) {
        fs.rmSync(target, { force: true });
        continue;
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.content);
      if (entry.mode === '100755' && process.platform !== 'win32') {
        fs.chmodSync(target, 0o755);
      }
    } catch {
      return rejected(entry.path, 'write-failed');
    }
  }
  return ok(null);
}

async function removeWorktree(options: GitReadOptions, worktreePath: string, tempDir: string): Promise<void> {
  try {
    await runGitCommand(options, ['worktree', 'remove', '--force', worktreePath], GIT_OUTPUT_MAX_BYTES);
  } catch {
    // best effort
  }
  try {
    await runGitCommand(options, ['worktree', 'prune'], GIT_OUTPUT_MAX_BYTES);
  } catch {
    // best effort
  }
  try {
    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // best effort
  }
}

export async function createPreviewWorktree(
  input: PreviewWorktreeInput,
): Promise<Result<PreviewWorktree, PreviewWorktreeFailureCode>> {
  if (!isObjectId(input.mergeBase) || !isObjectId(input.head)) {
    return unavailable('commit ids are not object ids');
  }

  const git = gitOptions(input.checkoutRoot, input);
  let tempDir: string;
  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-preview-'));
  } catch {
    return unavailable('temporary directory could not be created');
  }
  const hooksDir = path.join(tempDir, 'hooks');
  const worktreePath = path.join(tempDir, 'wt');
  try {
    fs.mkdirSync(hooksDir);
  } catch {
    fs.rmSync(tempDir, { recursive: true, force: true });
    return unavailable('hooks directory could not be created');
  }

  const added = await runGitCommand(
    git,
    ['-c', `core.hooksPath=${hooksDir.split(path.sep).join('/')}`, 'worktree', 'add', '--detach', worktreePath, input.mergeBase],
    GIT_OUTPUT_MAX_BYTES,
  );
  if (!added.ok || added.value.exitCode !== 0) {
    await removeWorktree(git, worktreePath, tempDir);
    return unavailable('git worktree add failed');
  }

  const fail = async <C extends PreviewWorktreeFailureCode>(result: Result<never, C>): Promise<Result<never, C>> => {
    await removeWorktree(git, worktreePath, tempDir);
    return result;
  };

  const headTree = await listTree(git, input.head);
  const baseTree = await listTree(git, input.mergeBase);
  if (!headTree.ok || !baseTree.ok) {
    return fail(unavailable('tree listing failed'));
  }
  const headEntries = new Map(headTree.value.map((entry) => [entry.path, entry]));

  const overlay: OverlayEntry[] = [];
  for (const change of input.changes) {
    if (change.kind === 'deleted') {
      overlay.push({ path: change.path, delete: true });
      continue;
    }
    const entry = headEntries.get(change.path);
    if (entry === undefined || (entry.mode !== '100644' && entry.mode !== '100755')) {
      return fail(rejected(change.path, 'head-entry-not-regular-file'));
    }
    const blob = await readBlob(git, entry, input.limits.overlayBytes);
    if (!blob.ok) {
      return fail(rejected(change.path, 'head-content-unreadable'));
    }
    overlay.push({ path: change.path, content: new Uint8Array(blob.value), mode: entry.mode });
    if (change.kind === 'renamed' && change.previousPath !== null) {
      overlay.push({ path: change.previousPath, delete: true });
    }
  }

  const treeKinds = new Map<string, CheckoutTreeKind>();
  for (const entry of baseTree.value) {
    const kind = treeKindForMode(entry.mode);
    if (kind !== null) {
      treeKinds.set(entry.path, kind);
    }
  }
  const checked = checkOverlay(treeKinds, overlay, { maxFiles: input.limits.overlayFiles, maxBytes: input.limits.overlayBytes });
  if (!checked.ok) {
    return fail(checked);
  }

  let root: string;
  try {
    root = fs.realpathSync.native(worktreePath);
  } catch {
    return fail(unavailable('worktree path could not be resolved'));
  }
  const applied = applyOverlay(root, checked.value.applied);
  if (!applied.ok) {
    return fail(applied);
  }

  let disposed = false;
  return ok({
    root,
    overlayPaths: checked.value.applied.map((entry) => entry.path),
    async dispose(): Promise<void> {
      if (disposed) {
        return;
      }
      disposed = true;
      await removeWorktree(git, worktreePath, tempDir);
    },
  });
}
