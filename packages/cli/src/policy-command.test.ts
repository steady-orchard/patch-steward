import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, afterAll } from 'vitest';

import {
  POLICY_FILE_MAX_BYTES,
  POLICY_VALIDATION_CODES,
  POLICY_YAML_MAX_DEPTH,
  POLICY_YAML_MAX_NODES,
  STRICT_YAML_FAILURE_CODES,
  parseStrictYaml,
} from '@patch-steward/core';
import type { PolicyLoadFailureCode } from '@patch-steward/core';

import {
  DEFAULT_POLICY_REF,
  FAILURE_EXIT_CODES,
  FILE_SOURCE_NOTICE,
  POLICY_USAGE,
  gitSourceNotice,
  runPolicyCommand,
} from './policy-command.js';

const templateBytes = fs.readFileSync(fileURLToPath(new URL('../../../templates/policy/policy.yml', import.meta.url)));

function capture(): {
  stdout: () => string;
  stderr: () => string;
  io: { stdout: (t: string) => void; stderr: (t: string) => void };
} {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  return {
    stdout: () => outChunks.join(''),
    stderr: () => errChunks.join(''),
    io: {
      stdout: (t: string) => {
        outChunks.push(t);
      },
      stderr: (t: string) => {
        errChunks.push(t);
      },
    },
  };
}

function gitEnv(globalConfigPath: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith('GIT_')) {
      env[key] = value;
    }
  }
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = globalConfigPath;
  env.GIT_AUTHOR_NAME = 'Fixture';
  env.GIT_AUTHOR_EMAIL = 'fixture@example.com';
  env.GIT_AUTHOR_DATE = '2026-01-01T00:00:00Z';
  env.GIT_COMMITTER_NAME = 'Fixture';
  env.GIT_COMMITTER_EMAIL = 'fixture@example.com';
  env.GIT_COMMITTER_DATE = '2026-01-01T00:00:00Z';
  return env;
}

function runGit(cwd: string, env: NodeJS.ProcessEnv, args: readonly string[]): string {
  return execFileSync('git', [...args], { cwd, env, encoding: 'buffer' })
    .toString('utf8')
    .trim();
}

function makePolicyRepo(policyBytes: Uint8Array): { dir: string; commit: string; treeId: string; env: NodeJS.ProcessEnv } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-repo-'));
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-gitconfig-'));
  const globalConfigPath = path.join(configDir, 'gitconfig');
  fs.writeFileSync(globalConfigPath, '');
  const env = gitEnv(globalConfigPath);

  runGit(dir, env, ['-c', 'init.defaultBranch=main', 'init', '-q']);
  fs.writeFileSync(path.join(dir, 'README.md'), 'fixture repo\n');
  fs.mkdirSync(path.join(dir, '.github', 'patch-steward'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.github', 'patch-steward', 'policy.yml'), policyBytes);
  runGit(dir, env, ['add', '-A']);
  runGit(dir, env, ['commit', '-q', '-m', 'add policy']);

  const commit = runGit(dir, env, ['rev-parse', 'HEAD']);
  const treeId = runGit(dir, env, ['rev-parse', 'HEAD:.github/patch-steward']);
  return { dir, commit, treeId, env };
}

function makeRepoWithoutPolicy(): { dir: string; env: NodeJS.ProcessEnv } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-repo-nopolicy-'));
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-gitconfig-'));
  const globalConfigPath = path.join(configDir, 'gitconfig');
  fs.writeFileSync(globalConfigPath, '');
  const env = gitEnv(globalConfigPath);

  runGit(dir, env, ['-c', 'init.defaultBranch=main', 'init', '-q']);
  fs.writeFileSync(path.join(dir, 'README.md'), 'fixture repo without policy\n');
  runGit(dir, env, ['add', '-A']);
  runGit(dir, env, ['commit', '-q', '-m', 'no policy']);
  return { dir, env };
}

function mutatedVariant(mutate: (variant: Record<string, unknown>) => void): Uint8Array {
  const raw = parseStrictYaml(templateBytes, {
    maxBytes: POLICY_FILE_MAX_BYTES,
    maxDepth: POLICY_YAML_MAX_DEPTH,
    maxNodes: POLICY_YAML_MAX_NODES,
  });
  if (!raw.ok) {
    throw new Error('template did not parse');
  }
  const variant = structuredClone(raw.value) as Record<string, unknown>;
  mutate(variant);
  return Buffer.from(JSON.stringify(variant), 'utf8');
}

const tempDirs: string[] = [];

function writeTempFile(bytes: Uint8Array, name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-file-'));
  tempDirs.push(dir);
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  }
});

describe('policy command: argument handling', () => {
  it('policy command: --ref and --file together exit 2', async () => {
    const cap = capture();
    const code = await runPolicyCommand(['--ref', 'HEAD', '--file', 'x.yml'], { cwd: process.cwd(), io: cap.io });
    expect(code).toBe(2);
    expect(cap.stderr()).toContain('usage.conflicting-options');
    expect(cap.stderr()).toContain(POLICY_USAGE);
    expect(cap.stdout()).toBe('');
  });

  it('policy command: unknown option exits 2', async () => {
    const cap = capture();
    const code = await runPolicyCommand(['--bogus'], { cwd: process.cwd(), io: cap.io });
    expect(code).toBe(2);
    expect(cap.stderr()).toContain('usage.unknown-option');
  });
});

describe('policy command: git and file sources', { timeout: 60000 }, () => {
  it('policy command: unresolvable ref exits 2', async () => {
    const repo = makePolicyRepo(templateBytes);
    const cap = capture();
    const code = await runPolicyCommand(['--ref', 'refs/heads/does-not-exist'], { cwd: repo.dir, io: cap.io });
    expect(code).toBe(2);
    expect(cap.stdout()).toContain('policy: unavailable');
    expect(cap.stdout()).toContain('git.ref-unresolvable');
  });

  it('policy command: not a git repository exits 2', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-notrepo-'));
    tempDirs.push(dir);
    const cap = capture();
    const code = await runPolicyCommand(['--ref', 'HEAD'], { cwd: dir, io: cap.io });
    expect(code).toBe(2);
    expect(cap.stdout()).toContain('git.not-a-repository');
  });

  it('policy command: missing policy directory exits 1', async () => {
    const repo = makeRepoWithoutPolicy();
    const cap = capture();
    const code = await runPolicyCommand(['--ref', 'HEAD'], { cwd: repo.dir, io: cap.io });
    expect(code).toBe(1);
    expect(cap.stdout()).toContain('git.policy-directory-missing');
    expect(cap.stdout()).toContain('revision: none');
  });

  it('policy command: invalid policy exits 1 with codes', async () => {
    const bytes = mutatedVariant((variant) => {
      variant.extra = 1;
    });
    const p = writeTempFile(bytes, 'policy.yml');

    const capJson = capture();
    const codeJson = await runPolicyCommand(['--file', p, '--json'], { cwd: process.cwd(), io: capJson.io });
    expect(codeJson).toBe(1);
    const report = JSON.parse(capJson.stdout()) as { valid: boolean; errors: readonly { code: string }[] };
    expect(report.valid).toBe(false);
    expect(report.errors.map((e) => e.code)).toContain('policy.unknown-key');

    const capHuman = capture();
    const codeHuman = await runPolicyCommand(['--file', p], { cwd: process.cwd(), io: capHuman.io });
    expect(codeHuman).toBe(1);
    expect(capHuman.stdout()).toContain('error policy.unknown-key');
    expect(capHuman.stdout()).toContain('outcome: inconclusive; no default was substituted');
  });

  it('policy command: valid policy at a ref exits 0', async () => {
    const bytes = mutatedVariant((variant) => {
      (variant.llm as Record<string, unknown>).model = 'example-model';
    });
    const repo = makePolicyRepo(bytes);
    const cap = capture();
    const code = await runPolicyCommand(['--ref', 'HEAD'], { cwd: repo.dir, io: cap.io });
    expect(code).toBe(0);
    const stdout = cap.stdout();
    expect(stdout).toContain('policy: valid');
    expect(stdout).toContain(`source: ref HEAD -> commit ${repo.commit}`);
    expect(stdout).toContain(`revision: ${repo.treeId}`);
  });

  it('policy command: --json output shape includes warnings', async () => {
    const repo = makePolicyRepo(templateBytes);
    const cap = capture();
    const code = await runPolicyCommand(['--ref', 'HEAD', '--json'], { cwd: repo.dir, io: cap.io });
    expect(code).toBe(0);
    const stdout = cap.stdout();
    expect(stdout.endsWith('\n')).toBe(true);
    expect(stdout.split('\n').filter((l) => l.length > 0)).toHaveLength(1);
    const report = JSON.parse(stdout) as Record<string, unknown>;
    expect(Object.keys(report)).toEqual([
      'schema_version',
      'valid',
      'authoritative',
      'source',
      'revision',
      'notice',
      'errors',
      'warnings',
    ]);
    expect(report.schema_version).toBe(1);
    expect(report.valid).toBe(true);
    expect(report.authoritative).toBe(true);
    expect(report.source).toEqual({ kind: 'git', ref: 'HEAD', commit: repo.commit });
    expect(report.revision).toBe(repo.treeId);
    expect(report.notice).toBe(gitSourceNotice('HEAD'));
    expect(report.errors).toEqual([]);
    const warnings = report.warnings as readonly { code: string; path: string }[];
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('policy.llm-model-placeholder');
    expect(warnings[0]?.path).toBe('llm.model');
  });

  it('policy command: --file prints the non-authoritative notice', async () => {
    const p = writeTempFile(templateBytes, 'policy.yml');
    const cap = capture();
    const code = await runPolicyCommand(['--file', p], { cwd: process.cwd(), io: cap.io });
    expect(code).toBe(0);
    expect(cap.stdout()).toContain(`notice: ${FILE_SOURCE_NOTICE}`);
    expect(cap.stdout()).toContain('revision: local:');
  });

  it('policy command: --ref prints the authority notice', async () => {
    const repo = makePolicyRepo(templateBytes);
    const cap = capture();
    const code = await runPolicyCommand(['--ref', 'HEAD'], { cwd: repo.dir, io: cap.io });
    expect(code).toBe(0);
    expect(cap.stdout()).toContain(`notice: ${gitSourceNotice('HEAD')}`);
  });

  it('policy command: placeholder model prints a warning on stderr and exits 0', async () => {
    const p = writeTempFile(templateBytes, 'policy.yml');
    const cap = capture();
    const code = await runPolicyCommand(['--file', p], { cwd: process.cwd(), io: cap.io });
    expect(code).toBe(0);
    const stderrLines = cap
      .stderr()
      .split('\n')
      .filter((l) => l.length > 0);
    expect(stderrLines).toHaveLength(1);
    expect(stderrLines[0]?.startsWith('warning policy.llm-model-placeholder llm.model ')).toBe(true);
  });

  it('policy command: non-placeholder model prints no warning', async () => {
    const bytes = mutatedVariant((variant) => {
      (variant.llm as Record<string, unknown>).model = 'example-model';
    });
    const p = writeTempFile(bytes, 'policy.yml');
    const cap = capture();
    const code = await runPolicyCommand(['--file', p], { cwd: process.cwd(), io: cap.io });
    expect(code).toBe(0);
    expect(cap.stderr()).toBe('');
  });

  it('policy command: no llm section prints no warning', async () => {
    const bytes = mutatedVariant((variant) => {
      delete variant.llm;
    });
    const p = writeTempFile(bytes, 'policy.yml');
    const cap = capture();
    const code = await runPolicyCommand(['--file', p], { cwd: process.cwd(), io: cap.io });
    expect(code).toBe(0);
    expect(cap.stderr()).toBe('');
  });

  it('policy command: invalid policy prints no warning', async () => {
    const bytes = mutatedVariant((variant) => {
      variant.extra = 1;
    });
    const p = writeTempFile(bytes, 'policy.yml');
    const capHuman = capture();
    const codeHuman = await runPolicyCommand(['--file', p], { cwd: process.cwd(), io: capHuman.io });
    expect(codeHuman).toBe(1);
    expect(capHuman.stderr()).toBe('');

    const capJson = capture();
    const codeJson = await runPolicyCommand(['--file', p, '--json'], { cwd: process.cwd(), io: capJson.io });
    expect(codeJson).toBe(1);
    const report = JSON.parse(capJson.stdout()) as { warnings: readonly unknown[] };
    expect(report.warnings).toEqual([]);
  });

  it('policy command: default ref is origin/HEAD', async () => {
    const repo = makePolicyRepo(templateBytes);
    const capBefore = capture();
    const codeBefore = await runPolicyCommand([], { cwd: repo.dir, io: capBefore.io });
    expect(codeBefore).toBe(2);
    expect(capBefore.stdout()).toContain('git.ref-unresolvable');
    expect(capBefore.stdout()).toContain(`source: ref ${DEFAULT_POLICY_REF}`);

    runGit(repo.dir, repo.env, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    runGit(repo.dir, repo.env, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);

    const capAfter = capture();
    const codeAfter = await runPolicyCommand([], { cwd: repo.dir, io: capAfter.io });
    expect(codeAfter).toBe(0);
    expect(capAfter.stdout()).toContain(`source: ref ${DEFAULT_POLICY_REF} -> commit `);
  });

  it('policy command: missing --file path exits 2', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-missing-file-'));
    tempDirs.push(dir);
    const cap = capture();
    const code = await runPolicyCommand(['--file', path.join(dir, 'does-not-exist.yml')], { cwd: process.cwd(), io: cap.io });
    expect(code).toBe(2);
    expect(cap.stdout()).toContain('file.not-found');
    expect(cap.stdout()).toContain('revision: none');
  });

  it('policy command: invalid policy at a ref reports the tree id as revision', async () => {
    const repo = makePolicyRepo(Buffer.from('version: 2\n', 'utf8'));
    const cap = capture();
    const code = await runPolicyCommand(['--ref', 'HEAD', '--json'], { cwd: repo.dir, io: cap.io });
    expect(code).toBe(1);
    const report = JSON.parse(cap.stdout()) as { revision: string; errors: readonly { code: string }[] };
    expect(report.revision).toBe(repo.treeId);
    expect(report.errors[0]?.code).toBe('policy.version-unsupported');
  });

  it('policy command: --json mode writes nothing to stderr', async () => {
    const p = writeTempFile(templateBytes, 'policy.yml');
    const cap = capture();
    const code = await runPolicyCommand(['--file', p, '--json'], { cwd: process.cwd(), io: cap.io });
    expect(code).toBe(0);
    expect(cap.stderr()).toBe('');
  });

  it('policy command: an unexpected exception exits 2', async () => {
    const repo = makePolicyRepo(templateBytes);
    const cap = capture();
    const code = await runPolicyCommand(['--ref', 'HEAD'], {
      cwd: repo.dir,
      io: cap.io,
      runner: () => {
        throw new Error('boom');
      },
    });
    expect(code).toBe(2);
    expect(cap.stdout()).toContain('steward.internal-error');
  });
});

describe('policy command: failure code mapping', () => {
  it('policy command: every load failure code maps to exit 1 or 2', () => {
    const keys = Object.keys(FAILURE_EXIT_CODES);
    expect(keys).toHaveLength(50);
    for (const value of Object.values(FAILURE_EXIT_CODES)) {
      expect([1, 2]).toContain(value);
    }
    for (const code of POLICY_VALIDATION_CODES) {
      expect(FAILURE_EXIT_CODES[code as PolicyLoadFailureCode]).toBe(1);
    }
    for (const code of STRICT_YAML_FAILURE_CODES) {
      expect(FAILURE_EXIT_CODES[code as PolicyLoadFailureCode]).toBe(1);
    }
    const exitOneGitAndFileCodes: PolicyLoadFailureCode[] = [
      'git.policy-directory-missing',
      'git.not-a-directory',
      'git.entry-missing',
      'git.entry-not-regular',
      'git.blob-too-large',
      'file.too-large',
    ];
    for (const code of exitOneGitAndFileCodes) {
      expect(FAILURE_EXIT_CODES[code]).toBe(1);
    }
    const exitTwoCodes: PolicyLoadFailureCode[] = [
      'git.unavailable',
      'git.timeout',
      'git.output-too-large',
      'git.failed',
      'git.malformed-output',
      'git.not-a-repository',
      'git.invalid-ref',
      'git.ref-unresolvable',
      'git.invalid-object-id',
      'git.object-missing',
      'file.not-found',
      'file.not-a-file',
      'file.unreadable',
      'policy.resolve-failed',
    ];
    for (const code of exitTwoCodes) {
      expect(FAILURE_EXIT_CODES[code]).toBe(2);
    }
  });
});
