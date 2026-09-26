import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GitReadOptions } from './reader.js';
import type { ProcessRunner, ProcessOutput, ProcessFailureCode } from '../process/run-process.js';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { listRemoteNames, readRemoteUrl, gitHubRepositoryFromRemoteUrl, findUpstreamRemote } from './remotes.js';

function fakeRunner(queue: readonly Result<ProcessOutput, ProcessFailureCode>[]): {
  readonly runner: ProcessRunner;
  readonly calls: { binary: string; args: readonly string[]; env: Readonly<Record<string, string>> }[];
} {
  const calls: { binary: string; args: readonly string[]; env: Readonly<Record<string, string>> }[] = [];
  let index = 0;
  const runner: ProcessRunner = async (binary, args, options) => {
    calls.push({ binary, args, env: options.env });
    const result = queue[index];
    index += 1;
    if (result === undefined) {
      throw new Error('fake runner queue exhausted');
    }
    return result;
  };
  return { runner, calls };
}

function output(exitCode: number, stdout: Buffer, stderr: Buffer = Buffer.alloc(0)): Result<ProcessOutput, ProcessFailureCode> {
  return ok({ exitCode, stdout, stderr });
}

const fakeRepoDir = os.tmpdir();

function fakeOptions(runner: ProcessRunner): GitReadOptions {
  return { repoDir: fakeRepoDir, timeoutMs: 30000, maxOutputBytes: 1048576, runner };
}

describe('git remote discovery', { timeout: 60000 }, () => {
  it('GitHub remote URLs identify repositories', () => {
    const accepted: [string, { owner: string; name: string }][] = [
      [
        'https://github.com/steady-orchard/patch-steward-testbed-public.git',
        { owner: 'steady-orchard', name: 'patch-steward-testbed-public' },
      ],
      ['https://github.com/steady-orchard/patch-steward', { owner: 'steady-orchard', name: 'patch-steward' }],
      ['git@github.com:octo/demo.git', { owner: 'octo', name: 'demo' }],
      ['ssh://git@github.com/octo/demo.git', { owner: 'octo', name: 'demo' }],
      ['https://GitHub.com/Octo/Demo', { owner: 'Octo', name: 'Demo' }],
      ['https://github.com/octo/demo.js', { owner: 'octo', name: 'demo.js' }],
      ['https://github.com/octo/demo.git.git', { owner: 'octo', name: 'demo.git' }],
    ];
    for (const [url, expected] of accepted) {
      expect(gitHubRepositoryFromRemoteUrl(url)).toEqual(expected);
    }

    const rejected = [
      'http://github.com/octo/demo',
      'https://gitlab.com/octo/demo',
      'https://github.com/octo',
      'https://github.com/octo/demo/tree/main',
      'https://user:secret@github.com/octo/demo.git',
      'https://github.com/octo/demo/',
      'git@github.com:octo/demo/extra.git',
      'https://github.com/-octo/demo',
      'https://github.com/octo/..',
      'https://github.com/octo/.git',
      'file:///c/repos/demo',
      '',
      'https://www.github.com/octo/demo',
      'git@github.com:octo/demo.git\n',
      ' https://github.com/octo/demo',
    ];
    for (const url of rejected) {
      expect(gitHubRepositoryFromRemoteUrl(url)).toBeNull();
    }
  });

  it('upstream remote is preferred over origin', async () => {
    const { runner } = fakeRunner([
      output(0, Buffer.from('origin\nupstream\n', 'utf8')),
      output(0, Buffer.from('git@github.com:org/proj.git\n', 'utf8')),
    ]);
    const result = await findUpstreamRemote(fakeOptions(runner));
    expect(result).toEqual(ok({ remote: 'upstream', owner: 'org', name: 'proj' }));
  });

  it('origin is used when upstream is absent or not on GitHub', async () => {
    const { runner: runner1 } = fakeRunner([
      output(0, Buffer.from('origin\n', 'utf8')),
      output(0, Buffer.from('https://github.com/me/proj.git\n', 'utf8')),
    ]);
    const result1 = await findUpstreamRemote(fakeOptions(runner1));
    expect(result1).toEqual(ok({ remote: 'origin', owner: 'me', name: 'proj' }));

    const { runner: runner2 } = fakeRunner([
      output(0, Buffer.from('upstream\norigin\n', 'utf8')),
      output(0, Buffer.from('https://gitlab.com/org/proj.git\n', 'utf8')),
      output(0, Buffer.from('https://github.com/me/proj.git\n', 'utf8')),
    ]);
    const result2 = await findUpstreamRemote(fakeOptions(runner2));
    expect(result2).toEqual(ok({ remote: 'origin', owner: 'me', name: 'proj' }));
  });

  it('no GitHub remote yields null', async () => {
    const { runner: runner1 } = fakeRunner([output(0, Buffer.from('', 'utf8'))]);
    expect(await findUpstreamRemote(fakeOptions(runner1))).toEqual(ok(null));

    const { runner: runner2 } = fakeRunner([output(0, Buffer.from('mirror\n', 'utf8'))]);
    expect(await findUpstreamRemote(fakeOptions(runner2))).toEqual(ok(null));

    const { runner: runner3 } = fakeRunner([
      output(0, Buffer.from('origin\n', 'utf8')),
      output(0, Buffer.from('https://gitlab.com/org/proj.git\n', 'utf8')),
    ]);
    expect(await findUpstreamRemote(fakeOptions(runner3))).toEqual(ok(null));
  });

  it('remote commands are read-only with inert arguments', async () => {
    const { runner, calls } = fakeRunner([
      output(0, Buffer.from('origin\n', 'utf8')),
      output(0, Buffer.from('https://github.com/me/proj.git\n', 'utf8')),
    ]);
    await findUpstreamRemote(fakeOptions(runner));
    expect(calls[0]?.binary).toBe('git');
    expect(calls[0]?.args).toEqual(['remote']);
    expect(calls[1]?.binary).toBe('git');
    expect(calls[1]?.args).toEqual(['remote', 'get-url', '--end-of-options', 'origin']);
    for (const call of calls) {
      for (const key of Object.keys(call.env)) {
        if (key.startsWith('GIT_')) {
          expect(['GIT_TERMINAL_PROMPT', 'GIT_OPTIONAL_LOCKS', 'GIT_NO_REPLACE_OBJECTS']).toContain(key);
        }
      }
    }
  });

  it('injected failure: git remote listing fails', async () => {
    const { runner: unavailable } = fakeRunner([err('process.unavailable', 'infrastructure', 'nope')]);
    const r1 = await listRemoteNames(fakeOptions(unavailable));
    expect(r1.ok).toBe(false);
    expect(!r1.ok && r1.failure.code).toBe('git.unavailable');
    expect(!r1.ok && r1.failure.outcome).toBe('inconclusive');
    expect((r1 as { value?: unknown }).value).toBeUndefined();

    const { runner: failed } = fakeRunner([output(128, Buffer.alloc(0))]);
    const r2 = await listRemoteNames(fakeOptions(failed));
    expect(r2.ok).toBe(false);
    expect(!r2.ok && r2.failure.code).toBe('git.failed');
    expect(!r2.ok && r2.failure.outcome).toBe('inconclusive');

    const { runner: timeout } = fakeRunner([err('process.timeout', 'infrastructure', 'timed out')]);
    const r3 = await listRemoteNames(fakeOptions(timeout));
    expect(r3.ok).toBe(false);
    expect(!r3.ok && r3.failure.code).toBe('git.timeout');
    expect(!r3.ok && r3.failure.outcome).toBe('inconclusive');

    const { runner: malformed } = fakeRunner([output(0, Buffer.from([0xff]))]);
    const r4 = await listRemoteNames(fakeOptions(malformed));
    expect(r4.ok).toBe(false);
    expect(!r4.ok && r4.failure.code).toBe('git.malformed-output');
    expect(!r4.ok && r4.failure.outcome).toBe('inconclusive');

    const { runner: secretRunner } = fakeRunner([
      output(0, Buffer.from('origin\n', 'utf8')),
      output(0, Buffer.from('https://user:secret@github.com/o/r.git\n', 'utf8')),
    ]);
    const secretResult = await findUpstreamRemote(fakeOptions(secretRunner));
    expect(secretResult).toEqual(ok(null));
    expect(JSON.stringify(secretResult)).not.toContain('secret');
  });

  it('remote names are validated', async () => {
    for (const badName of ['-x', '', 'a\nb']) {
      const { runner, calls } = fakeRunner([]);
      const result = await readRemoteUrl(fakeOptions(runner), badName);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.failure.code).toBe('git.invalid-ref');
      expect(calls.length).toBe(0);
    }
  });
});

describe('git remotes over a real repository', { timeout: 60000 }, () => {
  let repoDir: string;
  let noRemoteDir: string;
  let configDir: string;
  let globalConfigPath: string;

  function fixtureEnv(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) {
        continue;
      }
      if (key.toUpperCase().startsWith('GIT_')) {
        continue;
      }
      result[key] = value;
    }
    result['GIT_CONFIG_NOSYSTEM'] = '1';
    result['GIT_CONFIG_GLOBAL'] = globalConfigPath;
    return result;
  }

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-remotes-'));
    noRemoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-remotes-none-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-remotes-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');

    execFileSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q'], { cwd: repoDir, env: fixtureEnv() });
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/steady-orchard/patch-steward-testbed-public.git'], {
      cwd: repoDir,
      env: fixtureEnv(),
    });
    execFileSync('git', ['remote', 'add', 'upstream', 'git@gitlab.com:x/y.git'], { cwd: repoDir, env: fixtureEnv() });

    execFileSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q'], { cwd: noRemoteDir, env: fixtureEnv() });
  });

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(noRemoteDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('git remotes over a real repository', async () => {
    const opts: GitReadOptions = { repoDir, timeoutMs: 30000, maxOutputBytes: 1048576 };
    const namesResult = await listRemoteNames(opts);
    expect(namesResult.ok).toBe(true);
    expect(namesResult.ok && namesResult.value).toEqual(expect.arrayContaining(['origin', 'upstream']));

    const upstreamResult = await findUpstreamRemote(opts);
    expect(upstreamResult).toEqual(ok({ remote: 'origin', owner: 'steady-orchard', name: 'patch-steward-testbed-public' }));

    const noRemoteOpts: GitReadOptions = { repoDir: noRemoteDir, timeoutMs: 30000, maxOutputBytes: 1048576 };
    expect(await findUpstreamRemote(noRemoteOpts)).toEqual(ok(null));
  });
});
