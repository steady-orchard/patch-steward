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
import { PREFLIGHT_NOTICE, PREFLIGHT_RUN_NOTICE } from './preflight-output.js';

const rootDir = fileURLToPath(new URL('../../../', import.meta.url));
const githubFixturesDir = path.join(rootDir, 'fixtures', 'github');
const submissionsDir = path.join(rootDir, 'fixtures', 'submissions');

function readJsonFixture(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(githubFixturesDir, relative), 'utf8')) as Record<string, unknown>;
}

function draftPath(name: string): string {
  return path.join(submissionsDir, name);
}

const REPO_NAME = 'example-owner/example-repo';
const REPO_PATH = '/repos/example-owner/example-repo';
const TREE_SHA = 'a8c2485882b52f63db71b1ec63b12f5039220e03';
const BLOB_SHA = '716098133e97314ccf047f5034cc8f76161d8f0d';

const OK_COMMAND = '[node, -e, "process.exit(0)"]';
const FAILING_COMMAND = '[node, -e, "process.exit(3)"]';
const MISSING_COMMAND = '[patch-steward-no-such-executable]';

function policyText(command: string): string {
  const template = readFileSync(path.join(rootDir, 'templates', 'policy', 'policy.yml'), 'utf8').replace(/\r\n/g, '\n');
  const replaced = template.replace('run: [make, test]', `run: ${command}`);
  expect(replaced).not.toBe(template);
  const bytes = Buffer.from(replaced, 'utf8');
  expect(validatePolicyBytes(bytes).ok).toBe(true);
  return replaced;
}

function routes(command: string | null): Record<string, unknown> {
  const repository = { ...readJsonFixture('testbed/repository.json') };
  repository['full_name'] = REPO_NAME;
  repository['default_branch'] = 'main';
  const table: Record<string, unknown> = {
    [REPO_PATH]: repository,
    [`${REPO_PATH}/issues/29`]: readJsonFixture('testbed/issue-29.json'),
  };
  if (command === null) {
    repository['default_branch'] = 'master';
    return {
      ...table,
      [`${REPO_PATH}/git/ref/heads/master`]: readJsonFixture('testbed/ref-heads-master.json'),
      [`${REPO_PATH}/contents/.github`]: readJsonFixture('testbed/contents-github.json'),
    };
  }
  const bytes = Buffer.from(policyText(command), 'utf8');
  const blob = readJsonFixture('policy-directory/blob-policy.json');
  blob['content'] = bytes.toString('base64');
  blob['size'] = bytes.length;
  return {
    ...table,
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

interface JsonRun {
  readonly requested: boolean;
  readonly notice: string;
  readonly executions: readonly {
    readonly id: string;
    readonly argv: readonly string[];
    readonly exit_code: number | null;
    readonly status: string;
  }[];
  readonly preview: {
    readonly base: string;
    readonly before: readonly unknown[];
    readonly after: readonly unknown[];
  } | null;
}

interface JsonReport {
  readonly run?: JsonRun;
  readonly warnings: readonly { readonly code: string }[];
  readonly errors: readonly { readonly code: string }[];
}

describe('preflight command with run', () => {
  let repoDir: string;
  let configDir: string;
  let globalConfigPath: string;
  let baseCommit: string;
  let headCommit: string;

  function gitEnv(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined || key.toUpperCase().startsWith('GIT_')) continue;
      result[key] = value;
    }
    result['GIT_CONFIG_NOSYSTEM'] = '1';
    result['GIT_CONFIG_GLOBAL'] = globalConfigPath;
    result['GIT_AUTHOR_NAME'] = 'Fixture';
    result['GIT_AUTHOR_EMAIL'] = 'fixture@example.com';
    result['GIT_COMMITTER_NAME'] = 'Fixture';
    result['GIT_COMMITTER_EMAIL'] = 'fixture@example.com';
    return result;
  }

  function git(args: readonly string[]): string {
    return execFileSync('git', args, { cwd: repoDir, env: gitEnv(), encoding: 'utf8' }).trim();
  }

  function write(relative: string, text: string): void {
    const target = path.join(repoDir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }

  function commandEnv(extra: Readonly<Record<string, string>> = {}): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.toUpperCase().startsWith('GIT_') || key === 'GITHUB_ACTIONS' || key === 'GITHUB_TOKEN') continue;
      result[key] = value;
    }
    result['GH_TOKEN'] = 'token-a';
    return { ...result, ...extra };
  }

  async function run(
    argv: readonly string[],
    command: string | null,
    env: Readonly<Record<string, string | undefined>> = commandEnv(),
  ): Promise<RunResult> {
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
      env,
      fetch: fetchFor(routes(command)),
    };
    const exit = await runPreflightCommand(argv, context);
    return { exit, stdout: stdout.join(''), stderr: stderr.join('') };
  }

  const issueArgs = ['--issue', 'defect', '--draft', draftPath('defect-complete.txt'), '--repo', REPO_NAME];

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-run-cmd-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-run-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');
    git(['-c', 'init.defaultBranch=main', 'init', '-q']);
    git(['remote', 'add', 'origin', 'https://github.com/example-owner/example-repo.git']);
    write('package.json', '{ "name": "fixture", "version": "1.0.0" }\n');
    write('src/app.js', 'export const answer = 1;\n');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'base']);
    baseCommit = git(['rev-parse', 'HEAD']);
    git(['update-ref', 'refs/remotes/origin/main', baseCommit]);
    write('src/app.js', 'export const answer = 2;\n');
    write('src/parse.test.ts', 'export const parsed = true;\n');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'head']);
    headCommit = git(['rev-parse', 'HEAD']);
  }, 60000);

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('run lines precede results in text mode', async () => {
    const result = await run([...issueArgs, '--run'], OK_COMMAND);
    expect(result.exit).toBe(0);
    const lines = result.stdout.split('\n');
    const runIndex = lines.indexOf('run head-test: ["node","-e","process.exit(0)"] in .');
    const noticeIndex = lines.indexOf(PREFLIGHT_NOTICE);
    const resultIndex = lines.findIndex((line) => line.startsWith('result head-test: exit 0'));
    expect(runIndex).toBe(0);
    expect(noticeIndex).toBeGreaterThan(runIndex);
    expect(resultIndex).toBeGreaterThan(noticeIndex);
    expect(lines).toContain(PREFLIGHT_RUN_NOTICE);
    expect(result.stderr).toBe('');
  }, 60000);

  it('run object follows paths in JSON mode', async () => {
    const result = await run([...issueArgs, '--run', '--json'], OK_COMMAND);
    expect(result.exit).toBe(0);
    expect(result.stdout.split('\n').filter((line) => line !== '')).toHaveLength(1);
    expect(Object.keys(JSON.parse(result.stdout) as object)).toEqual([
      'schema_version',
      'unverified',
      'notice',
      'submission',
      'repository',
      'policy',
      'contract',
      'paths',
      'run',
      'warnings',
      'errors',
    ]);
    const report = JSON.parse(result.stdout) as JsonReport;
    expect(report.run?.requested).toBe(true);
    expect(report.run?.executions[0]?.argv).toEqual(['node', '-e', 'process.exit(0)']);
    expect(result.stderr).toBe('');
  }, 60000);

  it('commands run even when the contract needs changes', async () => {
    const args = ['--issue', 'defect', '--draft', draftPath('defect-no-response.txt'), '--repo', REPO_NAME, '--run', '--json'];
    const result = await run(args, OK_COMMAND);
    expect(result.exit).toBe(1);
    const report = JSON.parse(result.stdout) as JsonReport & { readonly contract: { readonly disposition: string } };
    expect(report.contract.disposition).toBe('needs-changes');
    expect(report.run?.executions).toHaveLength(1);
    expect(report.run?.executions[0]?.exit_code).toBe(0);
  }, 60000);

  it('a failing mandatory command makes the exit 1', async () => {
    const result = await run([...issueArgs, '--run', '--json'], FAILING_COMMAND);
    expect(result.exit).toBe(1);
    const report = JSON.parse(result.stdout) as JsonReport;
    expect(report.run?.executions[0]?.exit_code).toBe(3);
    expect(report.errors).toEqual([]);
  }, 60000);

  it('a command that cannot start makes the exit 2', async () => {
    const result = await run([...issueArgs, '--run', '--json'], MISSING_COMMAND);
    expect(result.exit).toBe(2);
    const report = JSON.parse(result.stdout) as JsonReport;
    expect(report.run?.executions[0]?.status).not.toBe('completed');
  }, 60000);

  it('the default checklist runs nothing with run', async () => {
    const result = await run([...issueArgs, '--run', '--json'], null);
    expect(result.exit).toBe(0);
    const report = JSON.parse(result.stdout) as JsonReport;
    expect(report.warnings.map((w) => w.code)).toContain('preflight.run-without-policy');
    expect(report.run?.executions).toEqual([]);
    const text = await run([...issueArgs, '--run'], null);
    expect(text.exit).toBe(0);
    expect(text.stdout.split('\n').some((line) => line.startsWith('run '))).toBe(false);
  }, 60000);

  it('refuses under GitHub Actions with exit 2', async () => {
    const result = await run([...issueArgs, '--run', '--json'], OK_COMMAND, commandEnv({ GITHUB_ACTIONS: 'true' }));
    expect(result.exit).toBe(2);
    const report = JSON.parse(result.stdout) as JsonReport;
    expect(report.errors.map((e) => e.code)).toContain('runner.not-own-checkout');
    expect(report.run?.executions).toEqual([]);
  }, 60000);

  it('the preview runs for a declared regression test', async () => {
    const args = ['--pr', '--draft', draftPath('pr-bugfix-complete.txt'), '--repo', REPO_NAME, '--run'];
    const json = await run([...args, '--json'], OK_COMMAND);
    const report = JSON.parse(json.stdout) as JsonReport;
    expect(report.run?.preview).not.toBeNull();
    expect(report.run?.preview?.base).toBe(baseCommit);
    expect(report.run?.preview?.before.length).toBeGreaterThan(0);
    expect(report.run?.preview?.after.length).toBeGreaterThan(0);
    expect(headCommit).toMatch(/^[0-9a-f]{40}$/);

    const text = await run(args, OK_COMMAND);
    expect(text.stdout.split('\n')).toContain('run base-test: ["node","-e","process.exit(0)"] in preview');
  }, 60000);

  it('without run nothing new is printed', async () => {
    const text = await run(issueArgs, OK_COMMAND);
    expect(text.exit).toBe(0);
    expect(text.stdout.split('\n').some((line) => line.startsWith('run ') || line.startsWith('result '))).toBe(false);
    expect(text.stdout).not.toContain(PREFLIGHT_RUN_NOTICE);
    const json = await run([...issueArgs, '--json'], OK_COMMAND);
    expect(Object.keys(JSON.parse(json.stdout) as object)).not.toContain('run');
  }, 60000);
});
