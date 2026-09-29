import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { steppingClock } from '../clock.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import type { RecordRunId } from '../records/common.js';
import { createUnsandboxedRunner, type UnsandboxedLimits } from './unsandboxed.js';

const LIMITS: UnsandboxedLimits = {
  executionSeconds: 60,
  outputHeadBytes: 262144,
  outputTailBytes: 786432,
  outputStreamBytes: 268435456,
  resultFiles: 5,
  resultFileBytes: 5242880,
  resultTestCases: 1000,
};

function entryFor(run: string[], resultFiles: ExecutionPlanEntry['result_files'] = [], workingDirectory = '.'): ExecutionPlanEntry {
  return {
    id: 'head-test',
    kind: 'command',
    command_id: 'test',
    run,
    working_directory: workingDirectory,
    commit_role: 'head',
    commit: 'c'.repeat(40),
    overlay: 'none',
    expected: 'exit-zero',
    network: 'none',
    result_files: resultFiles,
  } as ExecutionPlanEntry;
}

describe('unsandboxed runner against real git and processes', { timeout: 120000 }, () => {
  let base = '';
  let env: NodeJS.ProcessEnv = {};
  let hooks = '';

  const git = (cwd: string, ...args: string[]): void => {
    execFileSync('git', ['-c', 'core.hooksPath=' + hooks, ...args], { cwd, env, stdio: 'pipe' });
  };
  const sub = (name: string): string => {
    const dir = path.join(base, name);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
  const repo = (name: string): string => {
    const dir = sub(name);
    git(dir, 'init', '-q');
    fs.writeFileSync(path.join(dir, 'README.md'), 'fixture\n');
    git(dir, 'add', 'README.md');
    git(dir, 'commit', '-q', '-m', 'init');
    return dir;
  };
  const ciFreeEnv = (): NodeJS.ProcessEnv => {
    const copy = { ...process.env };
    delete copy['GITHUB_ACTIONS'];
    return copy;
  };
  const make = (checkoutRoot: string, processCwd: string, previewWorktrees: string[] = [], hostEnv = ciFreeEnv()) =>
    createUnsandboxedRunner({
      checkoutRoot,
      processCwd,
      previewWorktrees,
      hostEnv,
      credentials: [],
      runId: 'local-20261003T101500Z-3f9a1c2e' as RecordRunId,
      runAttempt: 1,
      clock: steppingClock('2026-10-03T10:15:00.000Z', 1000),
    });
  const outputText = (parts: readonly string[]): string => parts.join('');

  beforeAll(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-unsandboxed-'));
    hooks = sub('hooks');
    const config = path.join(base, 'gitconfig');
    fs.writeFileSync(config, '');
    env = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !key.toUpperCase().startsWith('GIT_')) env[key] = value;
    }
    Object.assign(env, {
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

  const expectRefused = (result: Awaited<ReturnType<typeof make>>): void => {
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('runner.not-own-checkout');
  };

  it('exit E5: refuses a subdirectory of the checkout', async () => {
    const r = repo('subdir');
    const s = path.join(r, 'sub');
    fs.mkdirSync(s);
    expectRefused(await make(s, r));
  });

  it('exit E5: refuses another repository', async () => {
    expectRefused(await make(repo('repo-b'), repo('repo-a')));
  });

  it('exit E5: refuses a directory outside any repository', async () => {
    const d = sub('plain');
    expectRefused(await make(d, d));
  });

  it('exit E5: refuses a bare repository', async () => {
    const d = sub('bare');
    git(d, 'init', '--bare', '-q');
    expectRefused(await make(d, d));
  });

  it('exit E5: refuses to run under GitHub Actions', async () => {
    const r = repo('actions');
    expectRefused(await make(r, r, [], { ...process.env, GITHUB_ACTIONS: 'true' }));
  });

  it('exit E5: refuses a working directory leaving the checkout', async () => {
    const r = repo('leaving');
    const outside = sub('outside');
    fs.symlinkSync(outside, path.join(r, 'out'), process.platform === 'win32' ? 'junction' : 'dir');
    const created = await make(r, r);
    if (!created.ok) throw new Error('runner refused');
    const result = await created.value.run(
      entryFor([process.execPath, '-e', "require('fs').writeFileSync('marker', 'x')"], [], 'out'),
      LIMITS,
    );
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.subject).toBe('out');
    expect(fs.existsSync(path.join(outside, 'marker'))).toBe(false);
  });

  it('exit E5: refuses a preview worktree it did not create', async () => {
    const r = repo('preview-refused');
    const wt = path.join(sub('wt-refused'), 'preview');
    git(r, 'worktree', 'add', '--detach', wt, 'HEAD');
    try {
      expectRefused(await make(wt, r, []));
    } finally {
      git(r, 'worktree', 'remove', '--force', wt);
    }
  });

  it('runs a command in the own checkout', async () => {
    const r = repo('own');
    const created = await make(r, r);
    if (!created.ok) throw new Error('runner refused');
    const script =
      "const fs=require('fs');fs.mkdirSync('reports',{recursive:true});" +
      'fs.writeFileSync(\'reports/junit.xml\',\'<testsuites><testsuite name="s"><testcase classname="c" name="t"/></testsuite></testsuites>\');' +
      "process.stdout.write('ran')";
    const result = await created.value.run(
      entryFor(
        [process.execPath, '-e', script],
        [
          { path: 'reports/junit.xml', format: 'junit-xml' },
          { path: 'missing.xml', format: 'junit-xml' },
        ],
      ),
      LIMITS,
    );
    if (result.kind !== 'completed') throw new Error('not completed');
    expect(outputText(result.execution.output.parts)).toContain('ran');
    expect(result.execution.record.exit.code).toBe(0);
    expect(result.execution.record.result_files.map((f) => f.status)).toEqual(['parsed', 'missing']);
    expect(result.execution.record.result_files[0]?.junit?.tests).toBe(1);
    expect(result.execution.record.admissibility).toBe('claim');
    expect(result.viaCmd).toBe(false);
  });

  it('runs a command in a preview worktree', async () => {
    const r = repo('preview-ok');
    const wt = path.join(sub('wt-ok'), 'preview');
    git(r, 'worktree', 'add', '--detach', wt, 'HEAD');
    try {
      const created = await make(wt, r, [wt]);
      if (!created.ok) throw new Error('runner refused');
      expect(created.value.kind).toBe('preview');
      const result = await created.value.run(entryFor([process.execPath, '-e', 'process.stdout.write(process.cwd())']), LIMITS);
      if (result.kind !== 'completed') throw new Error('not completed');
      expect(fs.realpathSync.native(outputText(result.execution.output.parts))).toBe(fs.realpathSync.native(wt));
    } finally {
      git(r, 'worktree', 'remove', '--force', wt);
    }
  });

  it.runIf(process.platform === 'win32')('runs a batch shim through cmd.exe', async () => {
    const r = repo('shim');
    const binDir = sub('bin');
    fs.writeFileSync(path.join(binDir, 'tool.cmd'), '@"' + process.execPath + '" "%~dp0echo.cjs" %*\r\n');
    fs.writeFileSync(path.join(binDir, 'echo.cjs'), 'process.stdout.write(JSON.stringify(process.argv.slice(2)));');
    const hostEnv: Record<string, string | undefined> = ciFreeEnv();
    for (const key of Object.keys(hostEnv)) if (key.toUpperCase() === 'PATH') delete hostEnv[key];
    hostEnv['PATH'] = binDir + ';' + (process.env['PATH'] ?? '');
    const created = await make(r, r, [], hostEnv);
    if (!created.ok) throw new Error('runner refused');
    const result = await created.value.run(entryFor(['tool', 'a&b', '%PATH%']), LIMITS);
    if (result.kind !== 'completed') throw new Error('not completed');
    expect(result.viaCmd).toBe(true);
    expect(outputText(result.execution.output.parts)).toBe('["a&b","%PATH%"]');
  });
});
