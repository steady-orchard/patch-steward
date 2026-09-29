import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_CHECKLIST_POLICY, steppingClock, type PathChange, type ResolvedPolicy } from '@patch-steward/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPreflightExecutions, type PreflightRunInput, type PreflightRunPullRequest } from './preflight-run.js';

type Command = ResolvedPolicy['execution']['commands'][number];

const node = (script: string, ...extra: string[]): string[] => [process.execPath, '-e', script, ...extra];

const command = (id: string, run: string[], overrides: Partial<Command> = {}): Command => ({
  id,
  kind: 'test',
  run,
  working_directory: '.',
  mandatory: true,
  result_files: [],
  ...overrides,
});

const policyWith = (commands: Command[], executionsPerRun?: number): ResolvedPolicy => ({
  ...DEFAULT_CHECKLIST_POLICY,
  execution: {
    commands,
    platforms: [
      { id: 'linux', os: 'linux', required: true, source: 'container', ci_workflow: null, commands: commands.map((c) => c.id) },
    ],
  },
  limits: {
    ...DEFAULT_CHECKLIST_POLICY.limits,
    execution: {
      ...DEFAULT_CHECKLIST_POLICY.limits.execution,
      ...(executionsPerRun === undefined ? {} : { executions_per_run: executionsPerRun }),
    },
  },
});

describe('preflight run', { timeout: 120000 }, () => {
  let base = '';
  let counter = 0;
  let gitEnv: NodeJS.ProcessEnv = {};

  const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', args, { cwd, env: gitEnv, stdio: 'pipe', input: '' }).toString('utf8').trim();
  const write = (root: string, file: string, content: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  const commitAll = (root: string, message: string): string => {
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', message);
    return git(root, 'rev-parse', 'HEAD');
  };
  const newRepo = (): string => {
    counter += 1;
    const dir = path.join(base, `repo-${counter}`);
    fs.mkdirSync(dir);
    git(dir, 'init', '-q');
    write(dir, 'README.md', 'fixture\n');
    commitAll(dir, 'init');
    return fs.realpathSync(dir);
  };
  const ciFreeEnv = (): NodeJS.ProcessEnv => {
    const copy = { ...process.env };
    delete copy['GITHUB_ACTIONS'];
    return copy;
  };
  const inputFor = (cwd: string, policy: ResolvedPolicy, extra: Partial<PreflightRunInput> = {}): PreflightRunInput => ({
    policy,
    published: true,
    cwd,
    env: ciFreeEnv(),
    credentials: [],
    pullRequest: null,
    clock: steppingClock('2026-10-03T10:15:00.000Z', 1000),
    ...extra,
  });
  const change = (kind: PathChange['kind'], file: string): PathChange => ({ kind, path: file, previousPath: null });
  const worktreeCount = (root: string): number =>
    git(root, 'worktree', 'list', '--porcelain')
      .split('\n')
      .filter((line) => line.startsWith('worktree ')).length;

  const previewRepo = (): { root: string; pullRequest: PreflightRunPullRequest } => {
    const root = newRepo();
    write(root, 'src.js', 'module.exports = () => 1;\n');
    const mergeBase = commitAll(root, 'base');
    write(root, 'src.js', 'module.exports = () => 2;\n');
    write(root, 'test/check.js', "if (require('../src.js')() !== 2) process.exit(1);\n");
    const head = commitAll(root, 'head');
    return {
      root,
      pullRequest: {
        head,
        mergeBase,
        changes: [change('modified', 'src.js'), change('added', 'test/check.js')],
        regressionTest: true,
      },
    };
  };
  const checkCommand = command('check', [process.execPath, 'test/check.js']);

  beforeAll(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-run-'));
    const config = path.join(base, 'gitconfig');
    fs.writeFileSync(config, '');
    gitEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !key.toUpperCase().startsWith('GIT_')) gitEnv[key] = value;
    }
    Object.assign(gitEnv, {
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

  it('runs every mandatory command in the checkout as a claim', async () => {
    const root = newRepo();
    const policy = policyWith([
      command('one', node('process.exit(0)')),
      command('two', node('process.exit(0)'), { kind: 'lint' }),
      command('optional', node('process.exit(1)'), { mandatory: false }),
    ]);
    const outcome = await runPreflightExecutions(inputFor(root, policy));
    expect(outcome.exitStatus).toBe(0);
    expect(outcome.errors).toEqual([]);
    expect(outcome.report.requested).toBe(true);
    expect(outcome.report.executions.map((e) => e.id)).toEqual(['head-one', 'head-two']);
    for (const execution of outcome.report.executions) {
      expect(execution.status).toBe('completed');
      expect(execution.exit_code).toBe(0);
      expect(execution.admissibility).toBe('claim');
      expect(execution.output_tail).toBeNull();
    }
    expect(outcome.report.preview).toBeNull();
  });

  it('prints a run line before each execution', async () => {
    const root = newRepo();
    const lines: string[] = [];
    const policy = policyWith([command('one', node('process.exit(0)'))]);
    await runPreflightExecutions(inputFor(root, policy, { onRun: (line) => lines.push(line) }));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.startsWith('run head-one: ')).toBe(true);
    expect(lines[0]?.endsWith(' in .')).toBe(true);
  });

  it('runs nothing without a published policy', async () => {
    const root = newRepo();
    const lines: string[] = [];
    const outcome = await runPreflightExecutions(
      inputFor(root, policyWith([command('one', node('process.exit(0)'))]), {
        published: false,
        onRun: (line) => lines.push(line),
      }),
    );
    expect(outcome.exitStatus).toBe(0);
    expect(outcome.report.executions).toEqual([]);
    expect(outcome.report.preview).toBeNull();
    expect(outcome.warnings.map((w) => w.code)).toEqual(['preflight.run-without-policy']);
    expect(lines).toEqual([]);
  });

  it('warns about a dirty working tree', async () => {
    const root = newRepo();
    write(root, 'untracked.txt', 'dirty\n');
    const outcome = await runPreflightExecutions(inputFor(root, policyWith([command('one', node('process.exit(0)'))])));
    expect(outcome.warnings.map((w) => w.code)).toEqual(['preflight.working-tree-dirty']);
    expect(outcome.report.executions).toHaveLength(1);
    expect(outcome.exitStatus).toBe(0);
  });

  it('refuses to run under GitHub Actions', async () => {
    const root = newRepo();
    const lines: string[] = [];
    const outcome = await runPreflightExecutions(
      inputFor(root, policyWith([command('one', node('process.exit(0)'))]), {
        env: { ...process.env, GITHUB_ACTIONS: 'true' },
        onRun: (line) => lines.push(line),
      }),
    );
    expect(outcome.exitStatus).toBe(2);
    expect(outcome.errors.map((e) => e.code)).toEqual(['runner.not-own-checkout']);
    expect(outcome.report.executions).toEqual([]);
    expect(lines).toEqual([]);
  });

  it('runs from a subdirectory at the checkout root', async () => {
    const root = newRepo();
    const sub = path.join(root, 'sub');
    fs.mkdirSync(sub);
    const policy = policyWith([command('mark', node("require('fs').writeFileSync('marker', 'x')"))]);
    const outcome = await runPreflightExecutions(inputFor(sub, policy));
    expect(outcome.exitStatus).toBe(0);
    expect(fs.existsSync(path.join(root, 'marker'))).toBe(true);
    expect(fs.existsSync(path.join(sub, 'marker'))).toBe(false);
  });

  it('reports a failing mandatory command with its output tail', async () => {
    const root = newRepo();
    const policy = policyWith([command('bad', node("console.log('visible failure line');process.exit(1)"))]);
    const outcome = await runPreflightExecutions(inputFor(root, policy));
    expect(outcome.exitStatus).toBe(1);
    const execution = outcome.report.executions[0];
    expect(execution?.exit_code).toBe(1);
    expect(execution?.output_tail).toContain('visible failure line');
  });

  it('reports a command that cannot start', async () => {
    const root = newRepo();
    const missing = path.join(base, 'no-such-executable');
    const outcome = await runPreflightExecutions(inputFor(root, policyWith([command('ghost', [missing])])));
    expect(outcome.exitStatus).toBe(2);
    expect(outcome.report.executions[0]?.status).toBe('environment-failure');
    expect(outcome.report.executions[0]?.code).toBe('runner.start-failed');
  });

  it('redacts the resolved token from the output tail', async () => {
    const root = newRepo();
    const token = 'ghp_' + 'a1B2c3D4e5'.repeat(4);
    const policy = policyWith([command('leak', node('console.log("token " + process.argv[1]);process.exit(1)', token))]);
    const outcome = await runPreflightExecutions(inputFor(root, policy, { credentials: [token] }));
    const tail = outcome.report.executions[0]?.output_tail;
    expect(tail).toContain('token');
    expect(tail).not.toContain(token);
  });

  it('runs the preview at the merge base before the change', async () => {
    const { root, pullRequest } = previewRepo();
    const lines: string[] = [];
    const outcome = await runPreflightExecutions(
      inputFor(root, policyWith([checkCommand]), { pullRequest, onRun: (line) => lines.push(line) }),
    );
    expect(outcome.exitStatus).toBe(0);
    const preview = outcome.report.preview;
    expect(preview?.base).toBe(pullRequest.mergeBase);
    expect(preview?.overlay_paths).toContain('test/check.js');
    expect(preview?.before.map((e) => e.id)).toEqual(['base-check']);
    expect(preview?.before[0]?.exit_code).not.toBe(0);
    expect(preview?.after.map((e) => e.id)).toEqual(['head-check']);
    expect(preview?.after[0]?.exit_code).toBe(0);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith(' in preview')).toBe(true);
  });

  it('skips the preview without a regression test', async () => {
    const { root, pullRequest } = previewRepo();
    const outcome = await runPreflightExecutions(
      inputFor(root, policyWith([checkCommand]), { pullRequest: { ...pullRequest, regressionTest: false } }),
    );
    expect(outcome.report.preview).toBeNull();
    expect(outcome.warnings.map((w) => w.code)).toEqual(['preflight.preview-skipped']);
    expect(outcome.report.executions).toHaveLength(1);
  });

  it('skips the preview when no test path changed', async () => {
    const { root, pullRequest } = previewRepo();
    const outcome = await runPreflightExecutions(
      inputFor(root, policyWith([checkCommand]), { pullRequest: { ...pullRequest, changes: [change('modified', 'src.js')] } }),
    );
    expect(outcome.report.preview).toBeNull();
    expect(outcome.warnings.map((w) => w.code)).toEqual(['preflight.preview-skipped']);
    expect(outcome.warnings[0]?.message).toBe('No test path changed; the preview did not run.');
  });

  it('removes the preview worktree after running', async () => {
    const { root, pullRequest } = previewRepo();
    const outcome = await runPreflightExecutions(inputFor(root, policyWith([checkCommand]), { pullRequest }));
    expect(outcome.report.preview).not.toBeNull();
    expect(worktreeCount(root)).toBe(1);
  });

  it('refuses everything over the execution budget', async () => {
    const root = newRepo();
    const lines: string[] = [];
    const policy = policyWith([command('one', node('process.exit(0)')), command('two', node('process.exit(0)'))], 1);
    const outcome = await runPreflightExecutions(inputFor(root, policy, { onRun: (line) => lines.push(line) }));
    expect(outcome.exitStatus).toBe(3);
    expect(outcome.errors.map((e) => e.code)).toEqual(['preflight.run-over-budget']);
    expect(outcome.report.executions).toEqual([]);
    expect(lines).toEqual([]);
  });
});
