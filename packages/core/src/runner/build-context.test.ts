import * as os from 'node:os';
import { describe, it, expect } from 'vitest';
import { ok } from '../result.js';
import type { ProcessRunner } from '../process/run-process.js';
import { createGitHubClient } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import { TarStreamParser } from '../archive/tar-read.js';
import { readRunnerBuildContext } from './build-context.js';
import type { RunnerContextSource } from './build-context.js';

const POLICY_TREE = 'a'.repeat(40);
const RUNNER_TREE = 'b'.repeat(40);
const DOCKERFILE_ID = 'c'.repeat(40);
const SETUP_ID = 'd'.repeat(40);
const DOCKERFILE = Buffer.from('FROM busybox\n');
const SETUP = Buffer.from('echo setup\n');
const DOCKERFILE_PATH = '.github/patch-steward/runner/Dockerfile';

const blobs = new Map<string, Buffer>([
  [DOCKERFILE_ID, DOCKERFILE],
  [SETUP_ID, SETUP],
]);

function out(text: string | Buffer) {
  return Promise.resolve(ok({ exitCode: 0, stdout: Buffer.from(text), stderr: Buffer.alloc(0) }));
}

function gitRunner(options: { runnerLine?: string; extraEntries?: string; calls?: string[][] } = {}): ProcessRunner {
  return (_binary, args) => {
    options.calls?.push([...args]);
    if (args[0] === 'ls-tree' && args.includes('--') && args.includes('runner')) {
      return out(options.runnerLine ?? `040000 tree ${RUNNER_TREE}\trunner\0`);
    }
    if (args[0] === 'ls-tree' && args.includes('-r')) {
      return out(
        `100644 blob ${DOCKERFILE_ID} ${DOCKERFILE.length}\tDockerfile\0` +
          `100755 blob ${SETUP_ID} ${SETUP.length}\tscripts/setup.sh\0` +
          (options.extraEntries ?? ''),
      );
    }
    if (args[0] === 'cat-file') {
      return out(blobs.get(args[args.length - 1] ?? '') ?? '');
    }
    if (args[0] === 'rev-parse') return out(`${POLICY_TREE}\n`);
    return out('');
  };
}

function gitSource(runner: ProcessRunner): RunnerContextSource {
  return { kind: 'git', repoDir: os.tmpdir(), policyTreeId: POLICY_TREE, runner };
}

function githubSource(truncated = false): RunnerContextSource {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const client = createGitHubClient({
    token: null,
    budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }),
    fetch: (url) => {
      const path = new URL(String(url)).pathname;
      if (path === `/repos/o/r/git/trees/${POLICY_TREE}`) {
        return Promise.resolve(
          json({
            sha: POLICY_TREE,
            truncated: false,
            tree: [
              { path: 'policy.yml', mode: '100644', type: 'blob', sha: 'e'.repeat(40), size: 10 },
              { path: 'runner', mode: '040000', type: 'tree', sha: RUNNER_TREE },
            ],
          }),
        );
      }
      if (path === `/repos/o/r/git/trees/${RUNNER_TREE}`) {
        return Promise.resolve(
          json({
            sha: RUNNER_TREE,
            truncated,
            tree: [
              { path: 'Dockerfile', mode: '100644', type: 'blob', sha: DOCKERFILE_ID, size: DOCKERFILE.length },
              { path: 'scripts', mode: '040000', type: 'tree', sha: 'f'.repeat(40) },
              { path: 'scripts/setup.sh', mode: '100755', type: 'blob', sha: SETUP_ID, size: SETUP.length },
            ],
          }),
        );
      }
      const id = path.split('/git/blobs/')[1];
      const content = id === undefined ? undefined : blobs.get(id);
      if (id !== undefined && content !== undefined) {
        return Promise.resolve(json({ sha: id, size: content.length, encoding: 'base64', content: content.toString('base64') }));
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    },
  });
  return { kind: 'github', client, repository: { owner: 'o', name: 'r' }, policyTreeId: POLICY_TREE };
}

interface ParsedEntry {
  path: string;
  kind: string;
  mode: number;
  content: string;
}

function parseArchive(archive: Uint8Array): ParsedEntry[] {
  const parser = new TarStreamParser();
  const result = parser.push(archive);
  if (!result.ok) throw new Error('archive did not parse');
  const entries: ParsedEntry[] = [];
  for (const event of result.value) {
    if (event.kind === 'entry') {
      entries.push({ path: event.entry.path, kind: event.entry.kind, mode: event.entry.mode & 0o777, content: '' });
    } else if (event.kind === 'data') {
      const last = entries[entries.length - 1];
      if (last !== undefined) last.content += Buffer.from(event.bytes).toString('utf8');
    }
  }
  return entries;
}

describe('readRunnerBuildContext', () => {
  it('builds a context archive from git objects', async () => {
    const result = await readRunnerBuildContext(gitSource(gitRunner()), { dockerfilePath: DOCKERFILE_PATH, maxBytes: 1048576 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.runnerTreeId).toBe(RUNNER_TREE);
    expect(result.value.dockerfilePath).toBe('Dockerfile');
    expect(parseArchive(result.value.archive)).toEqual([
      { path: 'Dockerfile', kind: 'file', mode: 0o644, content: 'FROM busybox\n' },
      { path: 'scripts', kind: 'directory', mode: 0o755, content: '' },
      { path: 'scripts/setup.sh', kind: 'file', mode: 0o755, content: 'echo setup\n' },
    ]);
  });

  it('rejects symlinks and submodules in the context', async () => {
    const link = await readRunnerBuildContext(gitSource(gitRunner({ extraEntries: `120000 blob ${'9'.repeat(40)} 6\tlink\0` })), {
      dockerfilePath: DOCKERFILE_PATH,
      maxBytes: 1048576,
    });
    expect(link.ok).toBe(false);
    if (!link.ok) {
      expect(link.failure.code).toBe('runner.build-context-invalid');
      expect(link.failure.details[0]?.path).toBe('link');
    }
    const sub = await readRunnerBuildContext(gitSource(gitRunner({ extraEntries: `160000 commit ${'8'.repeat(40)} -\tsub\0` })), {
      dockerfilePath: DOCKERFILE_PATH,
      maxBytes: 1048576,
    });
    expect(sub.ok).toBe(false);
    if (!sub.ok) expect(sub.failure.code).toBe('runner.build-context-invalid');
  });

  it('rejects a context above the byte limit', async () => {
    const result = await readRunnerBuildContext(gitSource(gitRunner()), { dockerfilePath: DOCKERFILE_PATH, maxBytes: 1024 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('runner.build-context-invalid');
  });

  it('rejects a Dockerfile outside the runner directory', async () => {
    const calls: string[][] = [];
    const result = await readRunnerBuildContext(gitSource(gitRunner({ calls })), {
      dockerfilePath: '.github/patch-steward/Dockerfile',
      maxBytes: 1048576,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('runner.build-context-invalid');
    expect(calls).toHaveLength(0);
  });

  it('requires the Dockerfile in the context', async () => {
    const result = await readRunnerBuildContext(gitSource(gitRunner()), {
      dockerfilePath: '.github/patch-steward/runner/Missing',
      maxBytes: 1048576,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('runner.build-context-invalid');
  });

  it('reports a missing runner directory', async () => {
    const result = await readRunnerBuildContext(gitSource(gitRunner({ runnerLine: '' })), {
      dockerfilePath: DOCKERFILE_PATH,
      maxBytes: 1048576,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('runner.image-source-unavailable');
  });

  it('reads the context through the GitHub API', async () => {
    const input = { dockerfilePath: DOCKERFILE_PATH, maxBytes: 1048576 };
    const fromGit = await readRunnerBuildContext(gitSource(gitRunner()), input);
    const fromGitHub = await readRunnerBuildContext(githubSource(), input);
    expect(fromGit.ok && fromGitHub.ok).toBe(true);
    if (fromGit.ok && fromGitHub.ok) {
      expect(fromGitHub.value.runnerTreeId).toBe(RUNNER_TREE);
      expect(Buffer.from(fromGitHub.value.archive).equals(Buffer.from(fromGit.value.archive))).toBe(true);
    }
  });

  it('reports a truncated GitHub tree', async () => {
    const result = await readRunnerBuildContext(githubSource(true), { dockerfilePath: DOCKERFILE_PATH, maxBytes: 1048576 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('runner.image-source-unavailable');
  });

  it('reports a local policy file as unavailable', async () => {
    const result = await readRunnerBuildContext({ kind: 'local-file' }, { dockerfilePath: DOCKERFILE_PATH, maxBytes: 1048576 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('runner.image-source-unavailable');
  });
});
