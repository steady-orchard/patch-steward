import os from 'node:os';

import { GIT_OUTPUT_MAX_BYTES, GIT_TIMEOUT_MS, ok } from '@patch-steward/core';
import type { ProcessRunner } from '@patch-steward/core';
import { describe, expect, it } from 'vitest';

import { cliGitOptions, resolveUpstream } from './upstream.js';

function fakeRunner(answers: Record<string, { readonly exitCode: number; readonly text: string }>): {
  readonly runner: ProcessRunner;
  readonly calls: string[][];
} {
  const calls: string[][] = [];
  const runner: ProcessRunner = async (_binary, args) => {
    calls.push([...args]);
    const key = args.join(' ');
    const answer = answers[key] ?? { exitCode: 0, text: '' };
    return ok({ exitCode: answer.exitCode, stdout: Buffer.from(answer.text), stderr: Buffer.alloc(0) });
  };
  return { runner, calls };
}

describe('cliGitOptions', () => {
  it('cli git options use the git bounds and the command directory', () => {
    expect(cliGitOptions({ cwd: '/x' })).toStrictEqual({
      repoDir: '/x',
      timeoutMs: GIT_TIMEOUT_MS,
      maxOutputBytes: GIT_OUTPUT_MAX_BYTES,
    });
    expect(cliGitOptions({ cwd: '/x', gitBinary: 'g' })).toMatchObject({ gitBinary: 'g' });
  });
});

describe('resolveUpstream', () => {
  it('an explicit repository skips the remote read', async () => {
    const { runner, calls } = fakeRunner({});
    const gitOptions = cliGitOptions({ cwd: os.tmpdir(), runner });
    const result = await resolveUpstream({ owner: 'octo', name: 'demo' }, gitOptions, { readRemote: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.repository).toStrictEqual({ owner: 'octo', name: 'demo' });
      expect(result.remote).toBeNull();
      expect(result.trackingRemote).toBeNull();
    }
    expect(calls.length).toBe(0);
  });

  it('the upstream remote wins over origin', async () => {
    const { runner } = fakeRunner({
      remote: { exitCode: 0, text: 'upstream\norigin\n' },
      'remote get-url --end-of-options upstream': { exitCode: 0, text: 'https://github.com/Up-Owner/up-repo.git\n' },
      'remote get-url --end-of-options origin': { exitCode: 0, text: 'git@github.com:octo/demo.git\n' },
    });
    const gitOptions = cliGitOptions({ cwd: os.tmpdir(), runner });
    const result = await resolveUpstream(null, gitOptions, { readRemote: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.repository).toStrictEqual({ owner: 'Up-Owner', name: 'up-repo' });
      expect(result.remote?.remote).toBe('upstream');
      expect(result.trackingRemote).toStrictEqual(result.remote);
    }
  });

  it('origin is used when there is no upstream remote', async () => {
    const { runner } = fakeRunner({
      remote: { exitCode: 0, text: 'origin\n' },
      'remote get-url --end-of-options origin': { exitCode: 0, text: 'https://github.com/octo/demo.git\n' },
    });
    const gitOptions = cliGitOptions({ cwd: os.tmpdir(), runner });
    const result = await resolveUpstream(null, gitOptions, { readRemote: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.repository).toStrictEqual({ owner: 'octo', name: 'demo' });
      expect(result.remote?.remote).toBe('origin');
    }
  });

  it('no GitHub remote yields no-upstream', async () => {
    const { runner: runner1 } = fakeRunner({
      remote: { exitCode: 0, text: 'origin\n' },
      'remote get-url --end-of-options origin': { exitCode: 0, text: 'https://gitlab.com/o/r.git\n' },
    });
    const gitOptions1 = cliGitOptions({ cwd: os.tmpdir(), runner: runner1 });
    const result1 = await resolveUpstream(null, gitOptions1, { readRemote: true });
    expect(result1).toStrictEqual({ ok: false, reason: 'no-upstream' });

    const { runner: runner2 } = fakeRunner({ remote: { exitCode: 0, text: '' } });
    const gitOptions2 = cliGitOptions({ cwd: os.tmpdir(), runner: runner2 });
    const result2 = await resolveUpstream(null, gitOptions2, { readRemote: true });
    expect(result2).toStrictEqual({ ok: false, reason: 'no-upstream' });
  });

  it('a git failure is reported with its code', async () => {
    const { runner } = fakeRunner({ remote: { exitCode: 128, text: '' } });
    const gitOptions = cliGitOptions({ cwd: os.tmpdir(), runner });
    const result = await resolveUpstream(null, gitOptions, { readRemote: true });
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'git-failure') {
      expect(result.code).toBe('git.failed');
      expect(result.message.length).toBeGreaterThan(0);
    } else {
      throw new Error('expected git-failure');
    }
  });

  it('a tracking remote matches the repository case-insensitively', async () => {
    const { runner } = fakeRunner({
      remote: { exitCode: 0, text: 'upstream\norigin\n' },
      'remote get-url --end-of-options upstream': { exitCode: 0, text: 'https://github.com/Up-Owner/up-repo.git\n' },
      'remote get-url --end-of-options origin': { exitCode: 0, text: 'git@github.com:octo/demo.git\n' },
    });
    const gitOptions = cliGitOptions({ cwd: os.tmpdir(), runner });

    const matching = await resolveUpstream({ owner: 'up-owner', name: 'UP-REPO' }, gitOptions, { readRemote: true });
    expect(matching.ok).toBe(true);
    if (matching.ok) {
      expect(matching.repository).toStrictEqual({ owner: 'up-owner', name: 'UP-REPO' });
      expect(matching.trackingRemote).toStrictEqual(matching.remote);
    }

    const nonMatching = await resolveUpstream({ owner: 'other', name: 'x' }, gitOptions, { readRemote: true });
    expect(nonMatching.ok).toBe(true);
    if (nonMatching.ok) {
      expect(nonMatching.trackingRemote).toBeNull();
      expect(nonMatching.repository).toStrictEqual({ owner: 'other', name: 'x' });
    }
  });
});
