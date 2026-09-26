import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GitReadOptions } from './reader.js';
import type { ProcessRunner, ProcessOutput, ProcessFailureCode } from '../process/run-process.js';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { findMergeBase, listChangedPaths, countCommitParents } from './diff.js';

const IDA = 'a'.repeat(40);
const IDB = 'b'.repeat(40);

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

let fakeRepoDir: string;

function fakeOptions(runner: ProcessRunner): GitReadOptions {
  return { repoDir: fakeRepoDir, timeoutMs: 30000, maxOutputBytes: 1048576, runner };
}

describe('git diff and commit adapter', { timeout: 60000 }, () => {
  fakeRepoDir = os.tmpdir();

  it('git diff lists every change kind', async () => {
    const stdout = Buffer.from('A\0a.txt\0M\0b.txt\0D\0c.txt\0T\0link\0R087\0old.txt\0new.txt\0C100\0src.txt\0dst.txt\0', 'utf8');
    const { runner } = fakeRunner([output(0, stdout)]);
    const result = await listChangedPaths(fakeOptions(runner), IDA, IDB);
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'complete') {
      return;
    }
    expect(result.value.changes).toEqual([
      { kind: 'added', path: 'a.txt', previousPath: null },
      { kind: 'modified', path: 'b.txt', previousPath: null },
      { kind: 'deleted', path: 'c.txt', previousPath: null },
      { kind: 'type-changed', path: 'link', previousPath: null },
      { kind: 'renamed', path: 'new.txt', previousPath: 'old.txt' },
      { kind: 'copied', path: 'dst.txt', previousPath: 'src.txt' },
    ]);
  });

  it('git diff over the path limits is too large', async () => {
    const overRecords: string[] = [];
    for (let i = 0; i < 3001; i += 1) {
      overRecords.push('M', `f${i}.txt`);
    }
    const overStdout = Buffer.from(overRecords.join('\0') + '\0', 'utf8');
    const { runner: overRunner } = fakeRunner([output(0, overStdout)]);
    const overResult = await listChangedPaths(fakeOptions(overRunner), IDA, IDB);
    expect(overResult.ok).toBe(true);
    expect(overResult.ok && overResult.value).toEqual({ kind: 'too-large' });

    const exactRecords: string[] = [];
    for (let i = 0; i < 3000; i += 1) {
      exactRecords.push('M', `f${i}.txt`);
    }
    const exactStdout = Buffer.from(exactRecords.join('\0') + '\0', 'utf8');
    const { runner: exactRunner } = fakeRunner([output(0, exactStdout)]);
    const exactResult = await listChangedPaths(fakeOptions(exactRunner), IDA, IDB);
    expect(exactResult.ok).toBe(true);
    expect(exactResult.ok && exactResult.value.kind).toBe('complete');
    expect(exactResult.ok && exactResult.value.kind === 'complete' && exactResult.value.changes.length).toBe(3000);

    const longPath = 'x'.repeat(4097);
    const longStdout = Buffer.from(`M\0${longPath}\0`, 'utf8');
    const { runner: longRunner } = fakeRunner([output(0, longStdout)]);
    const longResult = await listChangedPaths(fakeOptions(longRunner), IDA, IDB);
    expect(longResult.ok).toBe(true);
    expect(longResult.ok && longResult.value).toEqual({ kind: 'too-large' });

    const { runner: failRunner } = fakeRunner([err('process.output-too-large', 'infrastructure', 'too big')]);
    const failResult = await listChangedPaths(fakeOptions(failRunner), IDA, IDB);
    expect(failResult.ok).toBe(true);
    expect(failResult.ok && failResult.value).toEqual({ kind: 'too-large' });
  });

  it('injected failure: git diff malformed output', async () => {
    const cases = [
      Buffer.from('X\0a.txt\0', 'utf8'),
      Buffer.from('M\0', 'utf8'),
      Buffer.from('M\0a', 'utf8'),
      Buffer.from('M\0\0', 'utf8'),
      Buffer.from([0x4d, 0x00, 0xff, 0xfe, 0x00]),
    ];
    for (const stdout of cases) {
      const { runner } = fakeRunner([output(0, stdout)]);
      const result = await listChangedPaths(fakeOptions(runner), IDA, IDB);
      expect(result.ok).toBe(false);
      if (result.ok) {
        continue;
      }
      expect(result.failure.code).toBe('git.malformed-output');
      expect(result.failure.outcome).toBe('inconclusive');
      expect((result as { value?: unknown }).value).toBeUndefined();
    }
  });

  it('git adapter commands are read-only with inert arguments', async () => {
    const { runner, calls } = fakeRunner([
      output(0, Buffer.from('', 'utf8')),
      output(0, Buffer.from(`${IDA}\n`, 'utf8')),
      output(0, Buffer.from('tree ' + 'a'.repeat(40) + '\n', 'utf8')),
    ]);
    const options = fakeOptions(runner);
    await listChangedPaths(options, IDA, IDB);
    await findMergeBase(options, IDA, IDB);
    await countCommitParents(options, IDA);

    expect(calls[0]?.args).toEqual([
      'diff-tree',
      '-r',
      '-z',
      '--name-status',
      '-M',
      '--no-ext-diff',
      '--no-textconv',
      '--end-of-options',
      IDA,
      IDB,
    ]);
    expect(calls[1]?.args).toEqual(['merge-base', '--end-of-options', IDA, IDB]);
    expect(calls[2]?.args).toEqual(['cat-file', 'commit', IDA]);

    for (const call of calls) {
      expect(call.binary).toBe('git');
      for (const key of Object.keys(call.env)) {
        if (key.startsWith('GIT_')) {
          expect(['GIT_TERMINAL_PROMPT', 'GIT_OPTIONAL_LOCKS', 'GIT_NO_REPLACE_OBJECTS']).toContain(key);
        }
      }
    }
  });

  it('injected failure: git diff missing binary', async () => {
    for (const fn of [
      () => listChangedPaths(fakeOptions(fakeRunner([err('process.unavailable', 'infrastructure', 'x')]).runner), IDA, IDB),
      () => findMergeBase(fakeOptions(fakeRunner([err('process.unavailable', 'infrastructure', 'x')]).runner), IDA, IDB),
      () => countCommitParents(fakeOptions(fakeRunner([err('process.unavailable', 'infrastructure', 'x')]).runner), IDA),
    ]) {
      const result = await fn();
      expect(result.ok).toBe(false);
      expect(!result.ok && result.failure.code).toBe('git.unavailable');
    }
  });

  it('injected failure: git diff non-zero exit', async () => {
    const { runner: r1 } = fakeRunner([output(128, Buffer.alloc(0))]);
    const diffResult = await listChangedPaths(fakeOptions(r1), IDA, IDB);
    expect(!diffResult.ok && diffResult.failure.code).toBe('git.failed');

    const { runner: r2 } = fakeRunner([output(128, Buffer.alloc(0))]);
    const mergeResult = await findMergeBase(fakeOptions(r2), IDA, IDB);
    expect(!mergeResult.ok && mergeResult.failure.code).toBe('git.failed');
  });

  it('injected failure: git diff timeout', async () => {
    const { runner } = fakeRunner([err('process.timeout', 'infrastructure', 'timed out')]);
    const result = await findMergeBase(fakeOptions(runner), IDA, IDB);
    expect(!result.ok && result.failure.code).toBe('git.timeout');
  });

  it('injected failure: git diff oversize output', async () => {
    const { runner: r1 } = fakeRunner([err('process.output-too-large', 'infrastructure', 'too big')]);
    const result1 = await findMergeBase(fakeOptions(r1), IDA, IDB);
    expect(!result1.ok && result1.failure.code).toBe('git.output-too-large');

    const { runner: r2 } = fakeRunner([output(0, Buffer.from('not-an-id\n', 'utf8'))]);
    const result2 = await findMergeBase(fakeOptions(r2), IDA, IDB);
    expect(!result2.ok && result2.failure.code).toBe('git.malformed-output');
  });

  it('git adapter extensions reject invalid object ids', async () => {
    const invalidIds = ['HEAD', 'abc', '-x', 'A'.repeat(40)];
    for (const invalid of invalidIds) {
      const { runner, calls } = fakeRunner([]);
      const options = fakeOptions(runner);

      const r1 = await findMergeBase(options, invalid, IDA);
      expect(!r1.ok && r1.failure.code).toBe('git.invalid-object-id');
      const r2 = await listChangedPaths(options, invalid, IDA);
      expect(!r2.ok && r2.failure.code).toBe('git.invalid-object-id');
      const r3 = await countCommitParents(options, invalid);
      expect(!r3.ok && r3.failure.code).toBe('git.invalid-object-id');

      expect(calls.length).toBe(0);
    }
  });

  it('injected failure: git commit parent count', async () => {
    const { runner: r1 } = fakeRunner([output(0, Buffer.from('garbage\n', 'utf8'))]);
    const result1 = await countCommitParents(fakeOptions(r1), IDA);
    expect(!result1.ok && result1.failure.code).toBe('git.malformed-output');

    const { runner: r2 } = fakeRunner([output(128, Buffer.alloc(0))]);
    const result2 = await countCommitParents(fakeOptions(r2), IDA);
    expect(!result2.ok && result2.failure.code).toBe('git.object-missing');
  });
});

describe('git diff over a real repository', { timeout: 60000 }, () => {
  let repoDir: string;
  let configDir: string;
  let globalConfigPath: string;
  let opts: GitReadOptions;

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
    result['GIT_AUTHOR_NAME'] = 'Fixture';
    result['GIT_AUTHOR_EMAIL'] = 'fixture@example.com';
    result['GIT_AUTHOR_DATE'] = '2026-01-01T00:00:00Z';
    result['GIT_COMMITTER_NAME'] = 'Fixture';
    result['GIT_COMMITTER_EMAIL'] = 'fixture@example.com';
    result['GIT_COMMITTER_DATE'] = '2026-01-01T00:00:00Z';
    return result;
  }

  function git(args: readonly string[], input?: Buffer): string {
    const out = execFileSync('git', args, { cwd: repoDir, env: fixtureEnv(), input, encoding: 'buffer' });
    return out.toString('utf8').trim();
  }

  function blob(bytes: Buffer): string {
    return git(['hash-object', '-w', '--no-filters', '--stdin'], bytes);
  }

  function mktree(lines: readonly string[]): string {
    return git(['mktree'], Buffer.from(lines.join(''), 'utf8'));
  }

  function commitTree(tree: string, parents: readonly string[] = []): string {
    const args = ['commit-tree', tree];
    for (const parent of parents) {
      args.push('-p', parent);
    }
    args.push('-m', 'fixture');
    return git(args);
  }

  let r0: string;
  let c1: string;
  let c2: string;

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-diff-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-diff-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');
    git(['-c', 'init.defaultBranch=main', 'init', '-q']);
    opts = { repoDir, timeoutMs: 30000, maxOutputBytes: 1048576 };

    const blobA = blob(Buffer.from('root\n', 'utf8'));
    const rootTree = mktree([`100644 blob ${blobA}\troot.txt\n`]);
    r0 = commitTree(rootTree);
    const treeB = mktree([`100644 blob ${blobA}\troot.txt\n`, `100644 blob ${blob(Buffer.from('c1\n', 'utf8'))}\tc1.txt\n`]);
    c1 = commitTree(treeB, [r0]);
    const treeC = mktree([`100644 blob ${blobA}\troot.txt\n`, `100644 blob ${blob(Buffer.from('c2\n', 'utf8'))}\tc2.txt\n`]);
    c2 = commitTree(treeC, [r0]);
  }, 60000);

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('git merge base finds the common ancestor', async () => {
    const result = await findMergeBase(opts, c1, c2);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe(r0);
  });

  it('git merge base without a common ancestor is a typed failure', async () => {
    const orphanTree = mktree([`100644 blob ${blob(Buffer.from('orphan\n', 'utf8'))}\torphan.txt\n`]);
    const orphan = commitTree(orphanTree);

    const result = await findMergeBase(opts, c1, orphan);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.failure.code).toBe('git.no-merge-base');
    expect(result.failure.cause).toBe('infrastructure');
    expect(result.failure.outcome).toBe('inconclusive');
  });

  it('git commit parent count identifies merge commits', async () => {
    const mergeTree = mktree([`100644 blob ${blob(Buffer.from('root\n', 'utf8'))}\troot.txt\n`]);
    const merge = commitTree(mergeTree, [c1, c2]);

    const r0Result = await countCommitParents(opts, r0);
    expect(r0Result.ok && r0Result.value).toBe(0);
    const c1Result = await countCommitParents(opts, c1);
    expect(c1Result.ok && c1Result.value).toBe(1);
    const mergeResult = await countCommitParents(opts, merge);
    expect(mergeResult.ok && mergeResult.value).toBe(2);
  });

  it('git diff over a real repository', async () => {
    const a = Buffer.from('one\ntwo\nthree\nfour\nfive\n', 'utf8');
    const keep1 = Buffer.from('keep\n', 'utf8');
    const blobA = blob(a);
    const blobKeep1 = blob(keep1);
    const rootTree = mktree([`100644 blob ${blobA}\ta.txt\n`, `100644 blob ${blobKeep1}\tkeep.txt\n`]);
    const r0 = commitTree(rootTree);

    const keep2 = Buffer.from('keep changed\n', 'utf8');
    const newFile = Buffer.from('new\n', 'utf8');
    const blobKeep2 = blob(keep2);
    const blobNew = blob(newFile);
    const tree1 = mktree([
      `100644 blob ${blobA}\tb.txt\n`,
      `100644 blob ${blobKeep2}\tkeep.txt\n`,
      `100644 blob ${blobNew}\tnew.txt\n`,
    ]);
    const c1 = commitTree(tree1, [r0]);

    const result = await listChangedPaths(opts, r0, c1);
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'complete') {
      return;
    }
    const sorted = [...result.value.changes].sort((x, y) => x.path.localeCompare(y.path));
    expect(sorted).toEqual([
      { kind: 'renamed', path: 'b.txt', previousPath: 'a.txt' },
      { kind: 'modified', path: 'keep.txt', previousPath: null },
      { kind: 'added', path: 'new.txt', previousPath: null },
    ]);
  });
});
