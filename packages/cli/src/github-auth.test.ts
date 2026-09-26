import { describe, expect, it, vi } from 'vitest';
import type { ProcessOutput, ProcessRunner, RunProcessOptions } from '@patch-steward/core';
import { err, ok, GH_AUTH_TOKEN_OUTPUT_MAX_BYTES, GH_AUTH_TOKEN_TIMEOUT_MS } from '@patch-steward/core';
import { resolveGitHubAuth } from './github-auth.js';

interface RecordedCall {
  readonly binary: string;
  readonly args: readonly string[];
  readonly options: RunProcessOptions;
}

function fakeRunner(result: Awaited<ReturnType<ProcessRunner>>): { runner: ProcessRunner; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const runner: ProcessRunner = async (binary, args, options) => {
    calls.push({ binary, args, options });
    return result;
  };
  return { runner, calls };
}

function output(exitCode: number, stdout: Buffer | string, stderr: Buffer = Buffer.alloc(0)): ProcessOutput {
  return { exitCode, stdout: typeof stdout === 'string' ? Buffer.from(stdout) : stdout, stderr };
}

describe('resolveGitHubAuth', () => {
  it('auth prefers GH_TOKEN over GITHUB_TOKEN and gh', async () => {
    const { runner, calls } = fakeRunner(ok(output(0, 'unused')));
    const result = await resolveGitHubAuth({ env: { GH_TOKEN: 'token-a', GITHUB_TOKEN: 'token-b' }, cwd: '/repo', runner });
    expect(result).toEqual({ ok: true, auth: { token: 'token-a', source: 'GH_TOKEN' } });
    expect(calls).toHaveLength(0);
  });

  it('auth uses GITHUB_TOKEN when GH_TOKEN is unset or empty', async () => {
    const { runner: runnerA, calls: callsA } = fakeRunner(ok(output(0, 'unused')));
    const resultA = await resolveGitHubAuth({ env: { GITHUB_TOKEN: 'token-b' }, cwd: '/repo', runner: runnerA });
    expect(resultA).toEqual({ ok: true, auth: { token: 'token-b', source: 'GITHUB_TOKEN' } });
    expect(callsA).toHaveLength(0);

    const { runner: runnerB, calls: callsB } = fakeRunner(ok(output(0, 'unused')));
    const resultB = await resolveGitHubAuth({
      env: { GH_TOKEN: '', GITHUB_TOKEN: 'token-b' },
      cwd: '/repo',
      runner: runnerB,
    });
    expect(resultB).toEqual({ ok: true, auth: { token: 'token-b', source: 'GITHUB_TOKEN' } });
    expect(callsB).toHaveLength(0);
  });

  it('auth runs gh auth token through the process runner', async () => {
    const { runner, calls } = fakeRunner(ok(output(0, 'token-c\r\n')));
    const result = await resolveGitHubAuth({ env: { PATH: 'p' }, cwd: '/repo', runner });
    expect(result).toEqual({ ok: true, auth: { token: 'token-c', source: 'gh' } });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      binary: 'gh',
      args: ['auth', 'token', '--hostname', 'github.com'],
      options: {
        cwd: '/repo',
        env: { PATH: 'p' },
        timeoutMs: GH_AUTH_TOKEN_TIMEOUT_MS,
        maxOutputBytes: GH_AUTH_TOKEN_OUTPUT_MAX_BYTES,
      },
    });

    const { runner: runnerBin, calls: callsBin } = fakeRunner(ok(output(0, 'token-c\r\n')));
    await resolveGitHubAuth({ env: { PATH: 'p' }, cwd: '/repo', runner: runnerBin, ghBinary: '/opt/gh' });
    expect(callsBin[0]?.binary).toBe('/opt/gh');
  });

  it('auth skips an absent gh binary', async () => {
    const { runner } = fakeRunner(err('process.unavailable', 'infrastructure', 'no gh'));
    const result = await resolveGitHubAuth({ env: { PATH: 'p' }, cwd: '/repo', runner });
    expect(result).toEqual({ ok: true, auth: { token: null, source: 'none' } });
  });

  it('auth treats a failing gh as no token', async () => {
    const cases: Array<Awaited<ReturnType<ProcessRunner>>> = [
      ok(output(1, 'token-c\n')),
      err('process.timeout', 'infrastructure', 'timed out'),
      err('process.output-too-large', 'infrastructure', 'too large'),
      ok(output(0, Buffer.from([0xff]))),
      ok(output(0, 'two words\n')),
      ok(output(0, '')),
    ];
    for (const result of cases) {
      const { runner } = fakeRunner(result);
      const auth = await resolveGitHubAuth({ env: { PATH: 'p' }, cwd: '/repo', runner });
      expect(auth).toEqual({ ok: true, auth: { token: null, source: 'none' } });
    }
  });

  it('auth rejects an unusable token variable without echoing it', async () => {
    const runner = vi.fn();
    const resultA = await resolveGitHubAuth({ env: { GH_TOKEN: 'has space secret-value' }, cwd: '/repo', runner });
    expect(resultA.ok).toBe(false);
    if (!resultA.ok) {
      expect(resultA.code).toBe('auth.token-invalid');
      expect(resultA.message).toContain('GH_TOKEN');
      expect(resultA.message).not.toContain('secret-value');
    }
    expect(runner).not.toHaveBeenCalled();

    const resultB = await resolveGitHubAuth({
      env: { GITHUB_TOKEN: `bad${String.fromCharCode(1)}token` },
      cwd: '/repo',
      runner,
    });
    expect(resultB.ok).toBe(false);
    if (!resultB.ok) {
      expect(resultB.code).toBe('auth.token-invalid');
      expect(resultB.message).toContain('GITHUB_TOKEN');
      expect(resultB.message).not.toContain('bad');
    }
    expect(runner).not.toHaveBeenCalled();
  });

  it('auth passes no token variables to gh', async () => {
    const { runner, calls } = fakeRunner(ok(output(0, '')));
    await resolveGitHubAuth({
      env: {
        GH_TOKEN: '',
        GITHUB_TOKEN: '',
        gh_enterprise_token: 'e',
        GITHUB_ENTERPRISE_TOKEN: 'f',
        GH_HOST: 'h',
        PATH: 'p',
        HOME: 'home',
        EMPTY: undefined,
      },
      cwd: '/repo',
      runner,
    });
    expect(calls[0]?.options.env).toEqual({ PATH: 'p', HOME: 'home' });
  });
});
