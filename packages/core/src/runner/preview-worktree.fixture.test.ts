import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PathChange } from '../submission/paths.js';
import { checkoutTopLevel, createPreviewWorktree, workingTreeDirty } from './preview-worktree.js';

const LIMITS = { overlayFiles: 100, overlayBytes: 1048576 };

describe('preview worktree', { timeout: 120000 }, () => {
  let base = '';
  let env: NodeJS.ProcessEnv = {};
  let counter = 0;

  const git = (cwd: string, ...args: string[]): string =>
    execFileSync(
      'git',
      ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', '-c', 'commit.gpgsign=false', ...args],
      {
        cwd,
        env,
        stdio: 'pipe',
        input: '',
      },
    )
      .toString('utf8')
      .trim();
  const write = (root: string, file: string, content: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  const newRepo = (): string => {
    counter += 1;
    const dir = path.join(base, `repo-${counter}`);
    fs.mkdirSync(dir);
    git(dir, 'init', '-q');
    return dir;
  };
  const commitAll = (root: string, message: string): string => {
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', message);
    return git(root, 'rev-parse', 'HEAD');
  };
  const change = (kind: PathChange['kind'], file: string, previousPath: string | null = null): PathChange => ({
    kind,
    path: file,
    previousPath,
  });
  const read = (root: string, file: string): string => fs.readFileSync(path.join(root, file), 'utf8');
  const worktreeCount = (root: string): number =>
    git(root, 'worktree', 'list', '--porcelain')
      .split('\n')
      .filter((line) => line.startsWith('worktree ')).length;

  beforeAll(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-preview-fixture-'));
    const config = path.join(base, 'gitconfig');
    fs.writeFileSync(config, '');
    env = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !key.toUpperCase().startsWith('GIT_')) env[key] = value;
    }
    Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: config });
  });

  afterAll(() => {
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('finds the checkout top level from a subdirectory', async () => {
    const repo = newRepo();
    write(repo, 'sub/deep/file.txt', 'x');
    commitAll(repo, 'init');
    expect(await checkoutTopLevel(path.join(repo, 'sub', 'deep'))).toBe(fs.realpathSync.native(repo));
    expect(await checkoutTopLevel(path.join(base, 'missing'))).toBeNull();
  });

  it('reports a dirty working tree', async () => {
    const repo = newRepo();
    write(repo, 'a.txt', 'a');
    commitAll(repo, 'init');
    expect(await workingTreeDirty(repo)).toBe(false);
    write(repo, 'a.txt', 'changed');
    expect(await workingTreeDirty(repo)).toBe(true);
    expect(await workingTreeDirty(path.join(base, 'missing'))).toBeNull();
  });

  it('creates a worktree at the merge base with test paths from head', async () => {
    const repo = newRepo();
    write(repo, 'src/code.ts', 'base-code');
    write(repo, 'tests/old.test.ts', 'base-test');
    const mergeBase = commitAll(repo, 'base');
    write(repo, 'src/code.ts', 'head-code');
    write(repo, 'tests/old.test.ts', 'head-test');
    write(repo, 'tests/new.test.ts', 'new-test');
    const head = commitAll(repo, 'head');

    const result = await createPreviewWorktree({
      checkoutRoot: repo,
      mergeBase,
      head,
      changes: [change('modified', 'tests/old.test.ts'), change('added', 'tests/new.test.ts')],
      limits: LIMITS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    try {
      expect(read(result.value.root, 'tests/old.test.ts')).toBe('head-test');
      expect(read(result.value.root, 'tests/new.test.ts')).toBe('new-test');
      expect(read(result.value.root, 'src/code.ts')).toBe('base-code');
      expect(result.value.overlayPaths).toEqual(['tests/old.test.ts', 'tests/new.test.ts']);
    } finally {
      await result.value.dispose();
    }
  });

  it('applies deletions and renames', async () => {
    const repo = newRepo();
    write(repo, 'tests/gone.test.ts', 'gone');
    write(repo, 'tests/before.test.ts', 'moved');
    const mergeBase = commitAll(repo, 'base');
    fs.rmSync(path.join(repo, 'tests/gone.test.ts'));
    fs.rmSync(path.join(repo, 'tests/before.test.ts'));
    write(repo, 'tests/after.test.ts', 'moved-and-edited');
    const head = commitAll(repo, 'head');

    const result = await createPreviewWorktree({
      checkoutRoot: repo,
      mergeBase,
      head,
      changes: [change('deleted', 'tests/gone.test.ts'), change('renamed', 'tests/after.test.ts', 'tests/before.test.ts')],
      limits: LIMITS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    try {
      expect(fs.existsSync(path.join(result.value.root, 'tests/gone.test.ts'))).toBe(false);
      expect(fs.existsSync(path.join(result.value.root, 'tests/before.test.ts'))).toBe(false);
      expect(read(result.value.root, 'tests/after.test.ts')).toBe('moved-and-edited');
    } finally {
      await result.value.dispose();
    }
  });

  it('never runs repository hooks', async () => {
    const repo = newRepo();
    write(repo, 'tests/a.test.ts', 'a');
    const mergeBase = commitAll(repo, 'base');
    const marker = path.join(base, `marker-${counter}`);
    const hook = path.join(repo, '.git', 'hooks', 'post-checkout');
    fs.mkdirSync(path.dirname(hook), { recursive: true });
    fs.writeFileSync(hook, `#!/bin/sh\necho ran > "${marker.split(path.sep).join('/')}"\n`);
    fs.chmodSync(hook, 0o755);

    const result = await createPreviewWorktree({ checkoutRoot: repo, mergeBase, head: mergeBase, changes: [], limits: LIMITS });
    expect(result.ok).toBe(true);
    expect(fs.existsSync(hook)).toBe(true);
    expect(fs.existsSync(marker)).toBe(false);
    if (result.ok) await result.value.dispose();

    if (process.platform !== 'win32') {
      const probe = path.join(base, `probe-${counter}`);
      git(repo, 'worktree', 'add', '--detach', probe, mergeBase);
      expect(fs.existsSync(marker)).toBe(true);
      git(repo, 'worktree', 'remove', '--force', probe);
    }
  });

  it('rejects a symlink in head', async () => {
    const repo = newRepo();
    write(repo, 'README.md', 'readme');
    const mergeBase = commitAll(repo, 'base');
    const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, env, input: 'target.txt' })
      .toString('utf8')
      .trim();
    git(repo, 'update-index', '--add', '--cacheinfo', `120000,${blob},tests/link.test.ts`);
    git(repo, 'commit', '-q', '-m', 'head');
    const head = git(repo, 'rev-parse', 'HEAD');

    const result = await createPreviewWorktree({
      checkoutRoot: repo,
      mergeBase,
      head,
      changes: [change('added', 'tests/link.test.ts')],
      limits: LIMITS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('materialize.overlay-rejected');
    expect(result.failure.details[0]?.path).toBe('tests/link.test.ts');
  });

  it('rejects a path below a symlinked directory', async () => {
    const repo = newRepo();
    write(repo, 'README.md', 'readme');
    const first = commitAll(repo, 'first');
    const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, env, input: '../outside' })
      .toString('utf8')
      .trim();
    git(repo, 'update-index', '--add', '--cacheinfo', `120000,${blob},tests`);
    const tree = git(repo, 'write-tree');
    const mergeBase = git(repo, 'commit-tree', tree, '-p', first, '-m', 'symlinked tests');
    git(repo, 'read-tree', first);
    write(repo, 'tests/a.test.ts', 'a');
    const head = commitAll(repo, 'head');

    const before = new Set(fs.readdirSync(base));
    const result = await createPreviewWorktree({
      checkoutRoot: repo,
      mergeBase,
      head,
      changes: [change('added', 'tests/a.test.ts')],
      limits: LIMITS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('materialize.overlay-rejected');
    expect(fs.existsSync(path.join(base, 'outside'))).toBe(false);
    expect(fs.existsSync(path.join(repo, '..', 'outside'))).toBe(false);
    expect(fs.readdirSync(base).filter((name) => !before.has(name))).toEqual([]);
  });

  it('removes the worktree on dispose', async () => {
    const repo = newRepo();
    write(repo, 'tests/a.test.ts', 'a');
    const mergeBase = commitAll(repo, 'base');
    const result = await createPreviewWorktree({ checkoutRoot: repo, mergeBase, head: mergeBase, changes: [], limits: LIMITS });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tempDir = path.dirname(result.value.root);
    expect(worktreeCount(repo)).toBe(2);
    await result.value.dispose();
    await result.value.dispose();
    expect(worktreeCount(repo)).toBe(1);
    expect(fs.existsSync(tempDir)).toBe(false);
  });

  it('removes the worktree when the overlay is rejected', async () => {
    const repo = newRepo();
    write(repo, 'README.md', 'readme');
    const mergeBase = commitAll(repo, 'base');
    const result = await createPreviewWorktree({
      checkoutRoot: repo,
      mergeBase,
      head: mergeBase,
      changes: [change('added', 'tests/missing.test.ts')],
      limits: LIMITS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('materialize.overlay-rejected');
    expect(worktreeCount(repo)).toBe(1);
  });

  it('refuses commit ids that are not object ids', async () => {
    const result = await createPreviewWorktree({
      checkoutRoot: base,
      mergeBase: 'main',
      head: 'main',
      changes: [],
      limits: LIMITS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('preflight.preview-unavailable');
  });
});
