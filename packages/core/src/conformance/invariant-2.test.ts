import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { ProcessOutput, ProcessRunner, ProcessFailureCode } from '../index.js';
import {
  loadPolicy,
  localFileRevisionId,
  parseStrictYaml,
  runProcess,
  POLICY_YAML_MAX_DEPTH,
  POLICY_YAML_MAX_NODES,
} from '../index.js';
import type { LoadedPolicy, Result } from '../index.js';

const templateBytes = fs.readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));

let repoDir: string;
let configDir: string;
let globalConfigPath: string;
let firstCommit: string;
let baseline: LoadedPolicy;

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

function git(args: readonly string[]): string {
  const out = execFileSync('git', args, { cwd: repoDir, env: fixtureEnv(), encoding: 'buffer' });
  return out.toString('utf8').trim();
}

describe('invariant 2: trusted-branch policy', { timeout: 60000 }, () => {
  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-invariant-2-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-invariant-2-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');

    git(['-c', 'init.defaultBranch=main', 'init', '-q']);

    fs.writeFileSync(path.join(repoDir, 'README.md'), 'readme\n');
    fs.mkdirSync(path.join(repoDir, '.github', 'patch-steward'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.github', 'patch-steward', 'policy.yml'), templateBytes);
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'one']);
    firstCommit = git(['rev-parse', 'HEAD']);

    git(['checkout', '-q', '-b', 'other']);
    const parsed = parseStrictYaml(templateBytes, {
      maxBytes: templateBytes.length,
      maxDepth: POLICY_YAML_MAX_DEPTH,
      maxNodes: POLICY_YAML_MAX_NODES,
    });
    if (!parsed.ok) {
      throw new Error('failed to parse template policy for the other-branch variant');
    }
    const variant = structuredClone(parsed.value) as { supported_behavior: { description: string } };
    variant.supported_behavior.description = 'Other branch policy.';
    const otherBytes = Buffer.from(JSON.stringify(variant), 'utf8');
    fs.writeFileSync(path.join(repoDir, '.github', 'patch-steward', 'policy.yml'), otherBytes);
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'other']);
    git(['checkout', '-q', 'main']);

    fs.writeFileSync(path.join(repoDir, 'README.md'), 'readme two\n');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'two']);
  }, 60000);

  beforeAll(async () => {
    const result = await loadPolicy({ kind: 'git', repoDir, ref: 'main' });
    if (!result.ok) {
      throw new Error(`baseline policy load failed: ${result.failure.code}`);
    }
    baseline = result.value;
  });

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  test('invariant 2: the revision id is the git tree id of the policy directory at the resolved commit', async () => {
    expect(baseline.revision.kind).toBe('git-tree');
    if (baseline.revision.kind !== 'git-tree') {
      return;
    }
    expect(baseline.revision.id).toBe(git(['rev-parse', 'main:.github/patch-steward']));
    expect(baseline.revision.commit).toBe(git(['rev-parse', 'main']));
    expect(baseline.revision.ref).toBe('main');
    expect(baseline.authoritative).toBe(true);
  });

  test('invariant 2: working-tree and index edits do not change the loaded policy or id', async () => {
    fs.writeFileSync(path.join(repoDir, '.github', 'patch-steward', 'policy.yml'), 'version: 99\n');
    fs.writeFileSync(path.join(repoDir, '.github', 'patch-steward', 'extra.yml'), 'x: 1\n');
    git(['add', '-A']);

    const result = await loadPolicy({ kind: 'git', repoDir, ref: 'main' });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual(baseline);

    git(['reset', '-q', '--hard']);
  });

  test('invariant 2: other branches do not change the policy loaded from an explicit ref', async () => {
    const mainResult = await loadPolicy({ kind: 'git', repoDir, ref: 'main' });
    expect(mainResult.ok).toBe(true);
    expect(mainResult.ok && mainResult.value).toEqual(baseline);

    const otherResult = await loadPolicy({ kind: 'git', repoDir, ref: 'other' });
    expect(otherResult.ok).toBe(true);
    if (!otherResult.ok || baseline.revision.kind !== 'git-tree' || otherResult.value.revision.kind !== 'git-tree') {
      return;
    }
    expect(otherResult.value.revision.id).not.toBe(baseline.revision.id);
    expect(otherResult.value.policy.supported_behavior.description).toBe('Other branch policy.');

    git(['checkout', '-q', 'other']);
    const mainAgainResult = await loadPolicy({ kind: 'git', repoDir, ref: 'main' });
    expect(mainAgainResult.ok).toBe(true);
    expect(mainAgainResult.ok && mainAgainResult.value).toEqual(baseline);
    git(['checkout', '-q', 'main']);
  });

  test('invariant 2: a commit outside the policy directory leaves the revision id unchanged', async () => {
    const result = await loadPolicy({ kind: 'git', repoDir, ref: firstCommit });
    expect(result.ok).toBe(true);
    if (!result.ok || baseline.revision.kind !== 'git-tree' || result.value.revision.kind !== 'git-tree') {
      return;
    }
    expect(result.value.revision.id).toBe(baseline.revision.id);
    expect(result.value.revision.commit).toBe(firstCommit);
    expect(firstCommit).not.toBe(baseline.revision.commit);
  });

  test('invariant 2: a file source is never authoritative', async () => {
    const policyPath = path.join(repoDir, '.github', 'patch-steward', 'policy.yml');
    const result = await loadPolicy({ kind: 'file', path: policyPath });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.authoritative).toBe(false);
    expect(result.value.revision.kind).toBe('local-file');
    expect(result.value.revision.id).toBe(localFileRevisionId(fs.readFileSync(policyPath)));
  });

  test('invariant 2: the git source runs only read plumbing with --end-of-options before the ref', async () => {
    const calls: { readonly args: readonly string[]; readonly env: Readonly<Record<string, string>> }[] = [];
    const runner: ProcessRunner = async (
      binary: string,
      args: readonly string[],
      options: { cwd: string; env: Readonly<Record<string, string>>; timeoutMs: number; maxOutputBytes: number },
    ): Promise<Result<ProcessOutput, ProcessFailureCode>> => {
      calls.push({ args: [...args], env: options.env });
      return runProcess(binary, args, options);
    };

    const result = await loadPolicy({ kind: 'git', repoDir, ref: 'main' }, { runner });
    expect(result.ok).toBe(true);

    for (const call of calls) {
      expect(['rev-parse', 'ls-tree', 'cat-file']).toContain(call.args[0]);
    }

    const verifyCall = calls.find((call) => call.args[1] === '--verify');
    expect(verifyCall?.args).toEqual(['rev-parse', '--verify', '--quiet', '--end-of-options', 'main^{commit}']);

    for (const call of calls) {
      const gitKeys = Object.keys(call.env)
        .filter((key) => key.toUpperCase().startsWith('GIT_'))
        .sort();
      expect(gitKeys).toEqual(['GIT_NO_REPLACE_OBJECTS', 'GIT_OPTIONAL_LOCKS', 'GIT_TERMINAL_PROMPT']);
      expect(call.env['GIT_NO_REPLACE_OBJECTS']).toBe('1');
      expect(call.env['GIT_OPTIONAL_LOCKS']).toBe('0');
      expect(call.env['GIT_TERMINAL_PROMPT']).toBe('0');
    }
  });

  test('invariant 2: a ref beginning with a dash is rejected before git runs', async () => {
    const calls: unknown[] = [];
    const runner: ProcessRunner = async (
      binary: string,
      args: readonly string[],
      options: { cwd: string; env: Readonly<Record<string, string>>; timeoutMs: number; maxOutputBytes: number },
    ): Promise<Result<ProcessOutput, ProcessFailureCode>> => {
      calls.push({ binary, args, options });
      return runProcess(binary, args, options);
    };

    const result = await loadPolicy({ kind: 'git', repoDir, ref: '--output=x' }, { runner });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.failure.code).toBe('git.invalid-ref');
    expect(result.failure.outcome).toBe('inconclusive');
    expect(Object.keys(result)).not.toContain('value');
    expect(calls).toHaveLength(0);
  });
});
