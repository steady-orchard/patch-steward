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

const PASS_COMMAND = '[node, -e, "process.exit(0)"]';
const FAILING_COMMAND = '[node, -e, "process.exit(3)"]';
const MISSING_COMMAND = '[patch-steward-no-such-executable]';
const SLEEP_COMMAND = '[node, -e, "setTimeout(() => {}, 60000)"]';
const NOISY_COMMAND = '[node, -e, "process.stdout.write(\'x\'.repeat(200000))"]';

function replaceOnce(text: string, pattern: RegExp | string, replacement: string): string {
  const replaced = text.replace(pattern, replacement);
  expect(replaced).not.toBe(text);
  return replaced;
}

function policyText(command: string, edit: (text: string) => string = (text) => text): string {
  const template = readFileSync(path.join(rootDir, 'templates', 'policy', 'policy.yml'), 'utf8').replace(/\r\n/g, '\n');
  const edited = edit(replaceOnce(template, 'run: [make, test]', `run: ${command}`));
  expect(validatePolicyBytes(Buffer.from(edited, 'utf8')).ok).toBe(true);
  return edited;
}

function worldFor(policy: string): Record<string, unknown> {
  const repository = { ...readJsonFixture('testbed/repository.json') };
  repository['full_name'] = REPO_NAME;
  repository['default_branch'] = 'main';
  const bytes = Buffer.from(policy, 'utf8');
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

function fetchFor(table: Record<string, unknown>, failing: readonly string[] = []): GitHubFetch {
  return (url: string): Promise<Response> => {
    const pathname = new URL(url).pathname;
    if (failing.includes(pathname)) {
      return Promise.resolve(new Response(JSON.stringify({ message: 'Unprocessable' }), { status: 422 }));
    }
    if (!(pathname in table)) {
      return Promise.resolve(new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }));
    }
    return Promise.resolve(new Response(JSON.stringify(table[pathname]), { status: 200 }));
  };
}

interface RunResult {
  readonly exit: number;
  readonly stdout: string;
}

interface JsonReport {
  readonly contract: { readonly disposition: string };
  readonly run?: { readonly executions: readonly { readonly exit_code: number | null; readonly status: string }[] };
  readonly warnings: readonly { readonly code: string }[];
  readonly errors: readonly { readonly code: string }[];
}

interface RunOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
  readonly failing?: readonly string[];
}

const issueArgs = (draft: string): string[] => [
  '--issue',
  'defect',
  '--draft',
  draftPath(draft),
  '--repo',
  REPO_NAME,
  '--run',
  '--json',
];
const prArgs = ['--pr', '--draft', draftPath('pr-bugfix-complete.txt'), '--repo', REPO_NAME, '--run', '--json'];

describe('preflight run exit statuses', () => {
  let repoDir: string;
  let linkRepoDir: string;
  let configDir: string;
  let globalConfigPath: string;

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

  function git(dir: string, args: readonly string[], input?: string): string {
    return execFileSync('git', args, {
      cwd: dir,
      env: gitEnv(),
      encoding: 'utf8',
      ...(input === undefined ? {} : { input }),
    }).trim();
  }

  function write(dir: string, relative: string, text: string): void {
    const target = path.join(dir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }

  function initRepo(prefix: string, symlinkTest: boolean): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    git(dir, ['-c', 'init.defaultBranch=main', 'init', '-q']);
    git(dir, ['remote', 'add', 'origin', 'https://github.com/example-owner/example-repo.git']);
    write(dir, 'package.json', '{ "name": "fixture", "version": "1.0.0" }\n');
    write(dir, 'src/app.js', 'export const answer = 1;\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'base']);
    git(dir, ['update-ref', 'refs/remotes/origin/main', git(dir, ['rev-parse', 'HEAD'])]);
    write(dir, 'src/app.js', 'export const answer = 2;\n');
    git(dir, ['add', '-A']);
    if (symlinkTest) {
      const blob = git(dir, ['hash-object', '-w', '--stdin'], 'app.js');
      git(dir, ['update-index', '--add', '--cacheinfo', `120000,${blob},src/parse.test.ts`]);
    } else {
      write(dir, 'src/parse.test.ts', 'export const parsed = true;\n');
      git(dir, ['add', '-A']);
    }
    git(dir, ['commit', '-q', '-m', 'head']);
    return dir;
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

  async function run(argv: readonly string[], policy: string, options: RunOptions = {}): Promise<RunResult> {
    const stdout: string[] = [];
    const context: PreflightCommandContext = {
      cwd: options.cwd ?? repoDir,
      io: {
        stdout: (text) => {
          stdout.push(text);
        },
        stderr: () => {},
      },
      env: options.env ?? commandEnv(),
      fetch: fetchFor(worldFor(policy), options.failing ?? []),
    };
    const exit = await runPreflightCommand(argv, context);
    return { exit, stdout: stdout.join('') };
  }

  beforeAll(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-exit-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');
    repoDir = initRepo('patch-steward-exit-', false);
    linkRepoDir = initRepo('patch-steward-exit-link-', true);
  }, 60000);

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(linkRepoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('preflight run exit statuses follow the precedence matrix', async () => {
    const precedence = [0, 1, 3, 2];
    const contracts = [
      { name: 'met', exit: 0, args: issueArgs('defect-complete.txt'), failing: [] as string[] },
      { name: 'needs-changes', exit: 1, args: issueArgs('defect-no-response.txt'), failing: [] as string[] },
      { name: 'inconclusive', exit: 3, args: prArgs, failing: [`${REPO_PATH}/issues/29`] },
    ];
    const outcomes = [
      { name: 'pass', exit: 0, command: PASS_COMMAND },
      { name: 'failing', exit: 1, command: FAILING_COMMAND },
      { name: 'unstartable', exit: 2, command: MISSING_COMMAND },
    ];
    for (const contract of contracts) {
      for (const outcome of outcomes) {
        const expected = precedence.indexOf(contract.exit) > precedence.indexOf(outcome.exit) ? contract.exit : outcome.exit;
        const result = await run(contract.args, policyText(outcome.command), { failing: contract.failing });
        const report = JSON.parse(result.stdout) as JsonReport;
        expect(report.contract.disposition, contract.name).toBe(contract.name);
        expect(result.exit, `${contract.name} with ${outcome.name}`).toBe(expected);
      }
    }
  }, 120000);

  it('a timed-out command never exits 0', async () => {
    const policy = policyText(SLEEP_COMMAND, (text) =>
      replaceOnce(text, /^( +)execution_seconds: 1800$/m, '$1execution_seconds: 10'),
    );
    const result = await run(issueArgs('defect-complete.txt'), policy);
    expect(result.exit).toBe(1);
    const report = JSON.parse(result.stdout) as JsonReport;
    expect(report.run?.executions[0]?.status).toBe('completed');
  }, 120000);

  it('an output-limited command never exits 0', async () => {
    const policy = policyText(NOISY_COMMAND, (text) => {
      let edited = replaceOnce(text, /^( +)output_stream_bytes: \d+$/m, '$1output_stream_bytes: 65536');
      edited = replaceOnce(edited, /^( +)output_bytes: \d+$/m, '$1output_bytes: 65536');
      edited = replaceOnce(edited, /^( +)output_head_bytes: \d+$/m, '$1output_head_bytes: 1024');
      return replaceOnce(edited, /^( +)output_tail_bytes: \d+$/m, '$1output_tail_bytes: 1024');
    });
    const result = await run(issueArgs('defect-complete.txt'), policy);
    expect(result.exit).toBe(1);
  }, 120000);

  it('a refused checkout never exits 0', async () => {
    const result = await run(issueArgs('defect-complete.txt'), policyText(PASS_COMMAND), {
      env: commandEnv({ GITHUB_ACTIONS: 'true' }),
    });
    expect(result.exit).toBe(2);
  }, 60000);

  it('an over-budget run never exits 0', async () => {
    const policy = policyText(PASS_COMMAND, (text) => {
      const two = replaceOnce(
        text,
        '      result_files: []\n',
        '      result_files: []\n    - id: second\n      kind: test\n      run: [node, -e, "process.exit(0)"]\n      working_directory: .\n      mandatory: true\n      result_files: []\n',
      );
      return replaceOnce(two, /^( +)executions_per_run: \d+$/m, '$1executions_per_run: 1');
    });
    const result = await run(issueArgs('defect-complete.txt'), policy);
    expect(result.exit).toBe(3);
    const report = JSON.parse(result.stdout) as JsonReport;
    expect(report.contract.disposition).toBe('met');
    expect(report.errors.map((e) => e.code)).toContain('preflight.run-over-budget');
  }, 60000);

  it('an unavailable preview never changes the exit', async () => {
    for (const command of [PASS_COMMAND, FAILING_COMMAND]) {
      const reference = await run(prArgs, policyText(command));
      const linked = await run(prArgs, policyText(command), { cwd: linkRepoDir });
      const report = JSON.parse(linked.stdout) as JsonReport;
      expect(report.warnings.map((w) => w.code)).toContain('preflight.preview-unavailable');
      expect(linked.exit).toBe(reference.exit);
    }
  }, 60000);
});
