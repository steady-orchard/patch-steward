import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { commandDirectory, guardOwnCheckout } from './checkout-guard.js';

describe('checkout guard against real git', { timeout: 60000 }, () => {
  let base = '';
  let env: NodeJS.ProcessEnv = {};
  let hooks = '';

  const git = (cwd: string, ...args: string[]): void => {
    execFileSync('git', ['-c', 'core.hooksPath=' + hooks, ...args], { cwd, env, stdio: 'pipe' });
  };
  const sub = (name: string): string => {
    const dir = path.join(base, name);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
  const repo = (name: string): string => {
    const dir = sub(name);
    git(dir, 'init', '-q');
    fs.writeFileSync(path.join(dir, 'README.md'), 'fixture\n');
    git(dir, 'add', 'README.md');
    git(dir, 'commit', '-q', '-m', 'init');
    return dir;
  };

  beforeAll(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-guard-'));
    hooks = sub('hooks');
    const config = path.join(base, 'gitconfig');
    fs.writeFileSync(config, '');
    env = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !key.toUpperCase().startsWith('GIT_')) env[key] = value;
    }
    Object.assign(env, {
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: config,
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.com',
      GIT_COMMITTER_EMAIL: 'fixture@example.com',
    });
  });

  afterAll(() => {
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const input = (checkoutRoot: string, processCwd: string, previewWorktrees: string[] = []) => ({
    checkoutRoot,
    processCwd,
    previewWorktrees,
    env: {},
  });

  it('accepts the own checkout', async () => {
    const r = repo('own');
    const result = await guardOwnCheckout(input(r, r));
    expect(result).toEqual({ ok: true, value: { root: fs.realpathSync.native(r), kind: 'checkout' } });
  });

  it('refuses a subdirectory of the checkout', async () => {
    const r = repo('subdir');
    const s = path.join(r, 'sub');
    fs.mkdirSync(s);
    const result = await guardOwnCheckout(input(s, r));
    expect(result.ok).toBe(false);
  });

  it('refuses another repository', async () => {
    const a = repo('a');
    const b = repo('b');
    const result = await guardOwnCheckout(input(b, a));
    expect(result.ok).toBe(false);
  });

  it('refuses a bare repository', async () => {
    const bare = sub('bare');
    git(bare, 'init', '-q', '--bare');
    const result = await guardOwnCheckout(input(bare, bare));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.details[0]?.message).toBe('not-a-work-tree');
  });

  it('accepts a preview worktree it created', async () => {
    const r = repo('wt-ok');
    const preview = path.join(base, 'preview-ok');
    git(r, 'worktree', 'add', '--detach', preview, 'HEAD');
    try {
      const result = await guardOwnCheckout(input(preview, r, [preview]));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.kind).toBe('preview');
    } finally {
      git(r, 'worktree', 'remove', '--force', preview);
    }
  });

  it('refuses a preview worktree it did not create', async () => {
    const r = repo('wt-no');
    const preview = path.join(base, 'preview-no');
    git(r, 'worktree', 'add', '--detach', preview, 'HEAD');
    try {
      const result = await guardOwnCheckout(input(preview, r, []));
      expect(result.ok).toBe(false);
    } finally {
      git(r, 'worktree', 'remove', '--force', preview);
    }
  });

  it('resolves a working directory inside the checkout', async () => {
    const r = repo('cmd');
    fs.mkdirSync(path.join(r, 'pkg'));
    const root = fs.realpathSync.native(r);
    expect(await commandDirectory(root, 'pkg')).toEqual({ ok: true, value: fs.realpathSync.native(path.join(r, 'pkg')) });
    expect(await commandDirectory(root, '.')).toEqual({ ok: true, value: root });
  });

  it('refuses a working directory that leaves the checkout', async () => {
    const r = repo('leave');
    const outside = sub('outside');
    fs.symlinkSync(outside, path.join(r, 'out'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = await commandDirectory(fs.realpathSync.native(r), 'out');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.details[0]?.message).toBe('outside-checkout');
  });
});
