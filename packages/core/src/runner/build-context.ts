import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { runGitCommand, decodeGitOutput } from '../git/command.js';
import { listTree, readBlob } from '../git/reader.js';
import type { GitReadOptions } from '../git/reader.js';
import { readGitTree, readGitBlob } from '../github/reader.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type { GitHubClient } from '../github/client.js';
import { buildTarArchive } from '../archive/tar.js';
import type { TarArchiveEntry } from '../archive/tar.js';
import { GIT_TIMEOUT_MS, GIT_OUTPUT_MAX_BYTES } from '../policy/bounds.js';
import type { ProcessRunner } from '../process/run-process.js';

export type RunnerContextSource =
  | {
      readonly kind: 'git';
      readonly repoDir: string;
      readonly policyTreeId: string;
      readonly runner?: ProcessRunner;
      readonly gitBinary?: string;
    }
  | {
      readonly kind: 'github';
      readonly client: GitHubClient;
      readonly repository: GitHubRepositoryRef;
      readonly policyTreeId: string;
    }
  | { readonly kind: 'local-file' };

export interface RunnerBuildContextInput {
  readonly dockerfilePath: string;
  readonly maxBytes: number;
}

export interface RunnerBuildContext {
  readonly runnerTreeId: string;
  readonly dockerfilePath: string;
  readonly archive: Uint8Array;
}

export type BuildContextFailureCode = 'runner.build-context-invalid' | 'runner.image-source-unavailable';

interface ContextFile {
  readonly path: string;
  readonly executable: boolean;
  readonly content: Uint8Array;
}

interface ContextRead {
  readonly runnerTreeId: string;
  readonly files: ContextFile[];
}

const RUNNER_PREFIX = '.github/patch-steward/runner/';
const TREE_LINE = /^040000 tree ([0-9a-f]{40}|[0-9a-f]{64})\trunner\0$/;

function fail(code: BuildContextFailureCode, subject: string, reason: string) {
  const message =
    code === 'runner.build-context-invalid'
      ? 'The runner image build context is not valid.'
      : 'The runner image build context is unavailable.';
  return err(code, 'environment-unavailable', message, [
    { code: reason, path: subject, message: reason, line: null, column: null },
  ]);
}

async function readGitFiles(
  source: Extract<RunnerContextSource, { kind: 'git' }>,
  maxBytes: number,
): Promise<Result<ContextRead, BuildContextFailureCode>> {
  const options: GitReadOptions = {
    repoDir: source.repoDir,
    timeoutMs: GIT_TIMEOUT_MS,
    maxOutputBytes: GIT_OUTPUT_MAX_BYTES,
    ...(source.runner === undefined ? {} : { runner: source.runner }),
    ...(source.gitBinary === undefined ? {} : { gitBinary: source.gitBinary }),
  };
  const head = await runGitCommand(
    options,
    ['ls-tree', '-z', '--full-tree', source.policyTreeId, '--', 'runner'],
    GIT_OUTPUT_MAX_BYTES,
  );
  if (!head.ok || head.value.exitCode !== 0) return fail('runner.image-source-unavailable', '', 'git-unavailable');
  const decoded = decodeGitOutput(head.value.stdout);
  if (!decoded.ok) return fail('runner.image-source-unavailable', '', 'git-unavailable');
  const runnerTreeId = TREE_LINE.exec(decoded.value)?.[1];
  if (runnerTreeId === undefined) return fail('runner.image-source-unavailable', '', 'no-runner-directory');

  const entries = await listTree(options, runnerTreeId);
  if (!entries.ok) return fail('runner.image-source-unavailable', '', 'git-unavailable');
  for (const entry of entries.value) {
    if (entry.mode === '120000' || entry.mode === '160000') return fail('runner.build-context-invalid', entry.path, 'not-regular');
  }
  const files: ContextFile[] = [];
  for (const entry of entries.value) {
    const blob = await readBlob(options, entry, maxBytes);
    if (!blob.ok) {
      const code = blob.failure.code === 'git.blob-too-large' ? 'runner.build-context-invalid' : 'runner.image-source-unavailable';
      return fail(code, entry.path, blob.failure.code);
    }
    files.push({ path: entry.path, executable: entry.mode === '100755', content: blob.value });
  }
  return ok({ runnerTreeId, files });
}

async function readGitHubFiles(
  source: Extract<RunnerContextSource, { kind: 'github' }>,
  maxBytes: number,
): Promise<Result<ContextRead, BuildContextFailureCode>> {
  const { client, repository } = source;
  const top = await readGitTree(client, repository, source.policyTreeId, false);
  if (!top.ok) return fail('runner.image-source-unavailable', '', top.failure.code);
  const runnerEntry = top.value.entries.find((entry) => entry.path === 'runner' && entry.type === 'tree');
  if (runnerEntry === undefined) return fail('runner.image-source-unavailable', '', 'no-runner-directory');
  const runnerTreeId = runnerEntry.sha;

  const tree = await readGitTree(client, repository, runnerTreeId, true);
  if (!tree.ok) return fail('runner.image-source-unavailable', '', tree.failure.code);
  if (tree.value.truncated) return fail('runner.image-source-unavailable', '', 'tree-truncated');

  const files: ContextFile[] = [];
  for (const entry of tree.value.entries) {
    if (entry.type === 'tree') continue;
    if (entry.type === 'commit' || (entry.mode !== '100644' && entry.mode !== '100755')) {
      return fail('runner.build-context-invalid', entry.path, 'not-regular');
    }
    const blob = await readGitBlob(client, repository, entry.sha, maxBytes);
    if (!blob.ok) {
      const code =
        blob.failure.code === 'github.blob-too-large' ? 'runner.build-context-invalid' : 'runner.image-source-unavailable';
      return fail(code, entry.path, blob.failure.code);
    }
    files.push({ path: entry.path, executable: entry.mode === '100755', content: blob.value });
  }
  return ok({ runnerTreeId, files });
}

export async function readRunnerBuildContext(
  source: RunnerContextSource,
  input: RunnerBuildContextInput,
): Promise<Result<RunnerBuildContext, BuildContextFailureCode>> {
  if (source.kind === 'local-file') return fail('runner.image-source-unavailable', '', 'local-policy-file');
  if (!input.dockerfilePath.startsWith(RUNNER_PREFIX) || input.dockerfilePath.length === RUNNER_PREFIX.length) {
    return fail('runner.build-context-invalid', input.dockerfilePath, 'dockerfile-outside-runner');
  }
  const rel = input.dockerfilePath.slice(RUNNER_PREFIX.length);

  const read = source.kind === 'git' ? await readGitFiles(source, input.maxBytes) : await readGitHubFiles(source, input.maxBytes);
  if (!read.ok) return read;
  const { runnerTreeId, files } = read.value;

  if (!files.some((file) => file.path === rel)) return fail('runner.build-context-invalid', rel, 'dockerfile-missing');

  const entries: TarArchiveEntry[] = [];
  const emitted = new Set<string>();
  for (const file of files) {
    const parts = file.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      if (emitted.has(dir)) continue;
      emitted.add(dir);
      entries.push({ path: dir, type: 'directory', mode: 0o755, mtime: 0 });
    }
    entries.push({ path: file.path, type: 'file', mode: file.executable ? 0o755 : 0o644, mtime: 0, content: file.content });
  }
  const archive = buildTarArchive(entries);
  if (archive.length > input.maxBytes) return fail('runner.build-context-invalid', '', 'too-large');
  return ok({ runnerTreeId, dockerfilePath: rel, archive });
}
