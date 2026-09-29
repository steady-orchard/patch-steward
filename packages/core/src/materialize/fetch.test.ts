import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { err } from '../result.js';
import type { ProcessRunner } from '../process/run-process.js';
import { fetchCommit, type FetchSource } from './fetch.js';

const commit = 'a'.repeat(40);
const github: FetchSource = { kind: 'github', owner: 'steady-orchard', name: 'example' };

interface Call {
  binary: string;
  args: readonly string[];
  options: { cwd: string; env: Readonly<Record<string, string>> };
}

type Override = (args: readonly string[]) => ReturnType<ProcessRunner> | undefined;

function fake(override?: Override) {
  const calls: Call[] = [];
  const runner: ProcessRunner = (binary, args, options) => {
    calls.push({ binary, args, options: options as unknown as Call['options'] });
    const custom = override?.(args);
    if (custom) return custom;
    const stdout = args.includes('rev-parse') ? Buffer.from(commit + '\n') : Buffer.alloc(0);
    return Promise.resolve({ ok: true, value: { exitCode: 0, stdout, stderr: Buffer.alloc(0) } });
  };
  const root = (): string => path.dirname(calls[0]!.args[calls[0]!.args.length - 1]!);
  return { calls, runner, root };
}

const exit = (exitCode: number, stdout = '', stderr = '') =>
  Promise.resolve({ ok: true as const, value: { exitCode, stdout: Buffer.from(stdout), stderr: Buffer.from(stderr) } });

describe('fetchCommit', () => {
  it('builds the inert fetch commands exactly', async () => {
    const f = fake();
    const result = await fetchCommit({ source: github, commit, token: null, hostEnv: {}, timeoutMs: 1000, runner: f.runner });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const root = f.root();
    const configArgs = [
      '-c',
      'core.hooksPath=' + path.join(root, 'hooks'),
      '-c',
      'core.fsmonitor=false',
      '-c',
      'fetch.fsckObjects=true',
      '-c',
      'transfer.fsckObjects=true',
      '-c',
      'protocol.allow=never',
      '-c',
      'protocol.https.allow=always',
      '-c',
      'credential.helper=',
      '-c',
      'submodule.recurse=false',
      '-c',
      'fetch.recurseSubmodules=false',
      '-c',
      'core.askPass=',
    ];
    expect(f.calls).toHaveLength(3);
    expect(f.calls.every((c) => c.binary === 'git')).toBe(true);
    expect(f.calls[0]!.args).toEqual(['init', '--bare', '-q', path.join(root, 'repo.git')]);
    expect(f.calls[0]!.options.cwd).toBe(root);
    expect(f.calls[1]!.args).toEqual([
      ...configArgs,
      'fetch',
      '--no-tags',
      '--no-recurse-submodules',
      '--no-write-fetch-head',
      '--depth=1',
      '--end-of-options',
      'https://github.com/steady-orchard/example.git',
      commit,
    ]);
    expect(f.calls[2]!.args).toEqual([...configArgs, 'rev-parse', '--verify', '--end-of-options', commit + '^{commit}']);
    expect(result.value.configArgs).toEqual(configArgs);
    await result.value.dispose();
    expect(fs.existsSync(root)).toBe(false);
  });

  it('uses the file protocol only for a local path', async () => {
    const f = fake();
    const result = await fetchCommit({
      source: { kind: 'local-path', path: path.resolve('some-src') },
      commit,
      token: null,
      hostEnv: {},
      timeoutMs: 1000,
      runner: f.runner,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.configArgs).toContain('protocol.file.allow=always');
    expect(result.value.configArgs).not.toContain('protocol.https.allow=always');
    expect(f.calls[1]!.args).toContain(path.resolve('some-src'));
    await result.value.dispose();
  });

  it('gives git a minimal inert environment', async () => {
    const f = fake();
    const result = await fetchCommit({
      source: github,
      commit,
      token: null,
      hostEnv: {
        PATH: 'p',
        HOME: 'h',
        GIT_DIR: 'x',
        GIT_CONFIG_PARAMETERS: 'y',
        GIT_ASKPASS: 'z',
        SSH_ASKPASS: 'w',
        git_trace: '1',
        UNDEFINED: undefined,
      },
      timeoutMs: 1000,
      runner: f.runner,
    });
    expect(result.ok).toBe(true);
    const root = f.root();
    for (const call of f.calls) {
      expect(call.options.env).toEqual({
        PATH: 'p',
        HOME: 'h',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'),
        GIT_TERMINAL_PROMPT: '0',
      });
    }
    if (result.ok) await result.value.dispose();
  });

  it('passes a token only through the environment', async () => {
    const token = 'ghs' + '_' + 'x'.repeat(36);
    const b64 = Buffer.from('x-access-token:' + token, 'utf8').toString('base64');
    const f = fake();
    const result = await fetchCommit({ source: github, commit, token, hostEnv: {}, timeoutMs: 1000, runner: f.runner });
    expect(result.ok).toBe(true);
    for (const call of f.calls) {
      expect(call.options.env['GIT_CONFIG_COUNT']).toBe('1');
      expect(call.options.env['GIT_CONFIG_KEY_0']).toBe('http.https://github.com/.extraheader');
      expect(call.options.env['GIT_CONFIG_VALUE_0']).toBe('AUTHORIZATION: basic ' + b64);
      for (const arg of call.args) {
        expect(arg.includes(token)).toBe(false);
        expect(arg.includes(b64)).toBe(false);
      }
    }
    if (result.ok) await result.value.dispose();

    const g = fake();
    const local = await fetchCommit({
      source: { kind: 'local-path', path: path.resolve('some-src') },
      commit,
      token,
      hostEnv: {},
      timeoutMs: 1000,
      runner: g.runner,
    });
    expect(g.calls[0]!.options.env['GIT_CONFIG_COUNT']).toBeUndefined();
    if (local.ok) await local.value.dispose();
  });

  it('maps a failed fetch and removes the repository', async () => {
    const f = fake((args) => (args.includes('fetch') ? exit(128, '', 'fatal: secret stderr text') : undefined));
    const result = await fetchCommit({ source: github, commit, token: null, hostEnv: {}, timeoutMs: 1000, runner: f.runner });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('materialize.fetch-failed');
    expect(result.failure.cause).toBe('environment-unavailable');
    expect(result.failure.message).not.toContain('github.com');
    expect(result.failure.message).not.toContain('secret stderr text');
    expect(fs.existsSync(f.root())).toBe(false);
  });

  it('reports a commit mismatch', async () => {
    const f = fake((args) => (args.includes('rev-parse') ? exit(0, 'b'.repeat(40) + '\n') : undefined));
    const result = await fetchCommit({ source: github, commit, token: null, hostEnv: {}, timeoutMs: 1000, runner: f.runner });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('materialize.commit-mismatch');
    expect(fs.existsSync(f.root())).toBe(false);
  });

  it('rejects an invalid commit without running git', async () => {
    const f = fake();
    const result = await fetchCommit({
      source: github,
      commit: 'HEAD',
      token: null,
      hostEnv: {},
      timeoutMs: 1000,
      runner: f.runner,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('materialize.fetch-failed');
    expect(f.calls).toHaveLength(0);
  });

  it('maps a timeout to a fetch failure', async () => {
    const f = fake((args) => (args.includes('fetch') ? Promise.resolve(err('process.timeout', 'infrastructure', 't')) : undefined));
    const result = await fetchCommit({ source: github, commit, token: null, hostEnv: {}, timeoutMs: 1000, runner: f.runner });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('materialize.fetch-failed');
    expect(fs.existsSync(f.root())).toBe(false);
  });
});
