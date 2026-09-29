import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GitHubFetch } from '@patch-steward/core';
import { validatePolicyBytes } from '@patch-steward/core';
import { runPreflightCommand } from './preflight-command.js';
import type { PreflightCommandContext } from './preflight-command.js';

const rootDir = fileURLToPath(new URL('../../../', import.meta.url));
const githubFixturesDir = path.join(rootDir, 'fixtures', 'github');
const draft = path.join(rootDir, 'fixtures', 'submissions', 'pr-bugfix-complete.txt');

function readJsonFixture(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(githubFixturesDir, relative), 'utf8')) as Record<string, unknown>;
}

const REPO_NAME = 'example-owner/example-repo';
const REPO_PATH = '/repos/example-owner/example-repo';
const TREE_SHA = 'a8c2485882b52f63db71b1ec63b12f5039220e03';
const BLOB_SHA = '716098133e97314ccf047f5034cc8f76161d8f0d';

const TEST_COMMAND = '[node, --test, --test-reporter=junit, --test-reporter-destination=junit.xml, test/sum.test.mjs]';
const CLAIMS_NOTICE = 'Commands ran on this machine without a sandbox; their results are claims, not evidence.';

function policyText(): string {
  const template = readFileSync(path.join(rootDir, 'templates', 'policy', 'policy.yml'), 'utf8').replace(/\r\n/g, '\n');
  const replaced = template
    .replace('run: [make, test]', `run: ${TEST_COMMAND}`)
    .replace('result_files: []', 'result_files:\n        - { path: junit.xml, format: junit-xml }');
  expect(replaced).not.toBe(template);
  expect(validatePolicyBytes(Buffer.from(replaced, 'utf8')).ok).toBe(true);
  return replaced;
}

function routes(): Record<string, unknown> {
  const repository = { ...readJsonFixture('testbed/repository.json') };
  repository['full_name'] = REPO_NAME;
  repository['default_branch'] = 'main';
  const bytes = Buffer.from(policyText(), 'utf8');
  const blob = readJsonFixture('policy-directory/blob-policy.json');
  blob['content'] = bytes.toString('base64');
  blob['size'] = bytes.length;
  return {
    [REPO_PATH]: repository,
    [`${REPO_PATH}/issues/29`]: readJsonFixture('testbed/issue-29.json'),
    [`${REPO_PATH}/git/ref/heads/main`]: readJsonFixture('policy-directory/ref-heads-main.json'),
    [`${REPO_PATH}/contents/.github`]: readJsonFixture('policy-directory/contents-github.json'),
    [`${REPO_PATH}/git/trees/${TREE_SHA}`]: readJsonFixture('policy-directory/tree.json'),
    [`${REPO_PATH}/git/blobs/${BLOB_SHA}`]: blob,
  };
}

function fetchFor(table: Record<string, unknown>): GitHubFetch {
  return (url: string): Promise<Response> => {
    const pathname = new URL(url).pathname;
    if (!(pathname in table)) {
      return Promise.resolve(new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }));
    }
    return Promise.resolve(new Response(JSON.stringify(table[pathname]), { status: 200 }));
  };
}

interface RunResult {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface JsonExecution {
  readonly id: string;
  readonly status: string;
  readonly exit_code: number | null;
  readonly junit: {
    readonly tests: number;
    readonly passed: number;
    readonly failed: number;
    readonly errored: number;
    readonly skipped: number;
  } | null;
  readonly admissibility: string;
}

interface JsonReport {
  readonly run: {
    readonly executions: readonly JsonExecution[];
    readonly preview: {
      readonly base: string;
      readonly overlay_paths: readonly string[];
      readonly before: readonly JsonExecution[];
      readonly after: readonly JsonExecution[];
    } | null;
  };
}

describe('preflight run end to end', () => {
  let repoDir: string;
  let configDir: string;
  let globalConfigPath: string;
  let baseCommit: string;

  function gitEnv(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined || key.toUpperCase().startsWith('GIT_')) continue;
      result[key] = value;
    }
    result['GIT_CONFIG_NOSYSTEM'] = '1';
    result['GIT_CONFIG_GLOBAL'] = globalConfigPath;
    return result;
  }

  function git(args: readonly string[]): string {
    return execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', ...args], {
      cwd: repoDir,
      env: gitEnv(),
      encoding: 'utf8',
    }).trim();
  }

  function write(relative: string, text: string): void {
    const target = path.join(repoDir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }

  function commandEnv(): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.toUpperCase().startsWith('GIT_') || key === 'GITHUB_ACTIONS' || key === 'GH_TOKEN' || key === 'GITHUB_TOKEN')
        continue;
      result[key] = value;
    }
    result['GH_TOKEN'] = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789';
    return result;
  }

  async function run(argv: readonly string[]): Promise<RunResult> {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const context: PreflightCommandContext = {
      cwd: repoDir,
      io: {
        stdout: (text) => {
          stdout.push(text);
        },
        stderr: (text) => {
          stderr.push(text);
        },
      },
      env: commandEnv(),
      fetch: fetchFor(routes()),
    };
    const exit = await runPreflightCommand(argv, context);
    return { exit, stdout: stdout.join(''), stderr: stderr.join('') };
  }

  const args = ['--pr', '--draft', draft, '--repo', REPO_NAME, '--run'];

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-run-e2e-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-run-e2e-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');
    git(['-c', 'init.defaultBranch=main', 'init', '-q']);
    git(['remote', 'add', 'origin', 'https://github.com/example-owner/example-repo.git']);
    write('src/sum.mjs', 'export function sum(a, b) {\n  return a - b;\n}\n');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'base']);
    baseCommit = git(['rev-parse', 'HEAD']);
    git(['update-ref', 'refs/remotes/origin/main', baseCommit]);
    write('src/sum.mjs', 'export function sum(a, b) {\n  return a + b;\n}\n');
    write(
      'test/sum.test.mjs',
      [
        "import { test } from 'node:test';",
        "import assert from 'node:assert/strict';",
        "import { sum } from '../src/sum.mjs';",
        '',
        "test('sums two numbers', () => {",
        '  assert.equal(sum(2, 3), 5);',
        '});',
        '',
      ].join('\n'),
    );
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'head']);
  }, 60000);

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('preflight run executes the test suite as a claim', async () => {
    const result = await run([...args, '--json']);
    expect(result.stdout.split('\n').filter((line) => line !== '')).toHaveLength(1);
    expect(result.stderr).toBe('');
    const report = JSON.parse(result.stdout) as JsonReport;
    const execution = report.run.executions[0];
    expect(execution?.id).toBe('head-test');
    expect(execution?.status).toBe('completed');
    expect(execution?.exit_code).toBe(0);
    expect(execution?.junit).toEqual({ tests: 1, passed: 1, failed: 0, errored: 0, skipped: 0 });
    expect(execution?.admissibility).toBe('claim');
    expect(result.exit).toBe(0);
    const status = git(['status', '--porcelain'])
      .split('\n')
      .filter((line) => line !== '');
    expect(status).toEqual(['?? junit.xml']);
  }, 300000);

  it('preflight run previews the regression test at the merge base', async () => {
    const result = await run([...args, '--json']);
    const report = JSON.parse(result.stdout) as JsonReport;
    const preview = report.run.preview;
    expect(preview).not.toBeNull();
    expect(preview?.base).toBe(baseCommit);
    expect(preview?.overlay_paths).toContain('test/sum.test.mjs');
    const before = preview?.before[0];
    expect(before?.id).toBe('base-test');
    expect(before?.status).toBe('completed');
    expect(before?.exit_code).not.toBe(0);
    expect(before?.junit?.failed).toBe(1);
    const after = preview?.after[0];
    expect(after?.id).toBe('head-test');
    expect(after?.exit_code).toBe(0);
    expect(result.exit).toBe(0);
    const worktrees = git(['worktree', 'list', '--porcelain'])
      .split('\n')
      .filter((line) => line.startsWith('worktree '));
    expect(worktrees).toHaveLength(1);
  }, 300000);

  it('preflight run text mode prints run lines before results', async () => {
    const result = await run(args);
    const lines = result.stdout.split('\n');
    const headIndex = lines.findIndex((line) => line.startsWith('run head-test: ["node","--test"'));
    const baseIndex = lines.findIndex((line) => line.startsWith('run base-test: ') && line.endsWith(' in preview'));
    const noticeIndex = lines.indexOf(CLAIMS_NOTICE);
    expect(headIndex).toBeGreaterThanOrEqual(0);
    expect(baseIndex).toBeGreaterThanOrEqual(0);
    expect(noticeIndex).toBeGreaterThanOrEqual(0);
    expect(headIndex).toBeLessThan(noticeIndex);
    expect(baseIndex).toBeLessThan(noticeIndex);
  }, 300000);
});
