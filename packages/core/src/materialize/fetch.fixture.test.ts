import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchCommit } from './fetch.js';

describe('fetchCommit against a real repository', { timeout: 60000 }, () => {
  let tmp = '';
  let srcDir = '';
  let commit = '';

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-fetchsrc-'));
    srcDir = path.join(tmp, 'src');
    fs.mkdirSync(srcDir);
    const globalConfig = path.join(tmp, 'gitconfig');
    fs.writeFileSync(globalConfig, '');
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined && !k.toUpperCase().startsWith('GIT_')) env[k] = v;
    }
    Object.assign(env, {
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: globalConfig,
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.com',
      GIT_AUTHOR_DATE: '1700000000 +0000',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.com',
      GIT_COMMITTER_DATE: '1700000000 +0000',
    });
    const git = (args: string[], input?: string): string =>
      execFileSync('git', args, { cwd: srcDir, env, ...(input === undefined ? {} : { input }) })
        .toString('utf8')
        .trim();
    git(['init', '-q']);
    const blob = git(['hash-object', '-w', '--no-filters', '--stdin'], 'hello\n');
    const tree = git(['mktree'], '100644 blob ' + blob + '\ta.txt\n');
    commit = git(['commit-tree', tree, '-m', 'fixture']);
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('fetches an unreferenced commit by id', async () => {
    const result = await fetchCommit({
      source: { kind: 'local-path', path: srcDir },
      commit,
      token: null,
      hostEnv: process.env,
      timeoutMs: 60000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { repoDir, env } = result.value;
    expect(execFileSync('git', ['cat-file', '-t', commit], { cwd: repoDir, env }).toString('utf8').trim()).toBe('commit');
    await result.value.dispose();
    expect(fs.existsSync(path.dirname(repoDir))).toBe(false);
  });

  it('fails to fetch a commit the source lacks', async () => {
    const result = await fetchCommit({
      source: { kind: 'local-path', path: srcDir },
      commit: 'b'.repeat(40),
      token: null,
      hostEnv: process.env,
      timeoutMs: 60000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('materialize.fetch-failed');
  });
});
