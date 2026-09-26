import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { stringify } from 'yaml';

import type { ProcessOutput, ProcessFailureCode, ProcessRunner } from '../process/run-process.js';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { parseStrictYaml } from '../strict-yaml.js';
import { POLICY_FILE_MAX_BYTES } from './bounds.js';
import { localFileRevisionId } from '../hash.js';
import type { PolicySource } from './loader.js';
import { loadPolicy } from './loader.js';

const templateBytes = fs.readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));

function dockerfilePolicyBytes(): Buffer {
  const parsed = parseStrictYaml(templateBytes, { maxBytes: 262144, maxDepth: 32, maxNodes: 20000 });
  if (!parsed.ok) {
    throw new Error('template failed to parse');
  }
  const raw = structuredClone(parsed.value) as Record<string, unknown>;
  (raw.runner as Record<string, unknown>).image = {
    source: 'dockerfile',
    path: '.github/patch-steward/runner/Dockerfile',
  };
  return Buffer.from(stringify(raw), 'utf8');
}

const DOCKERFILE_POLICY_BYTES = dockerfilePolicyBytes();
const INVALID_POLICY_BYTES = Buffer.from('version: 2\n', 'utf8');
const README_BYTES = Buffer.from('readme\n', 'utf8');
const DOCKERFILE_BYTES = Buffer.from('FROM scratch\n', 'utf8');

describe('policy loader: git source', { timeout: 60000 }, () => {
  let repoDir: string;
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

  function commitTree(treeId: string): string {
    return git(['commit-tree', treeId, '-m', 'fixture']);
  }

  interface Entry {
    readonly name: string;
    readonly mode: '100644' | '100755' | '120000' | '040000';
    readonly type: 'blob' | 'tree';
    readonly id: string;
  }

  function tree(entries: readonly Entry[]): string {
    const lines = entries.map((entry) => `${entry.mode} ${entry.type} ${entry.id}\t${entry.name}\n`);
    return mktree(lines);
  }

  function buildCommit(policyDirEntries: readonly Entry[] | null): string {
    const readmeBlob = blob(README_BYTES);
    const rootEntries: Entry[] = [{ name: 'README.md', mode: '100644', type: 'blob', id: readmeBlob }];
    if (policyDirEntries !== null) {
      const policyTree = tree(policyDirEntries);
      const githubTree = tree([{ name: 'patch-steward', mode: '040000', type: 'tree', id: policyTree }]);
      rootEntries.push({ name: '.github', mode: '040000', type: 'tree', id: githubTree });
    }
    const rootTree = tree(rootEntries);
    return commitTree(rootTree);
  }

  let mainCommit: string;
  let dockerfileMissingCommit: string;
  let dockerfileSymlinkCommit: string;
  let dockerfilePresentCommit: string;
  let missingPolicyDirCommit: string;
  let missingPolicyFileCommit: string;
  let invalidContentCommit: string;

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-loader-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-loader-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');

    git(['-c', 'init.defaultBranch=main', 'init', '-q']);

    const policyBlob = blob(templateBytes);
    const dockerfilePolicyBlob = blob(DOCKERFILE_POLICY_BYTES);
    const invalidBlob = blob(INVALID_POLICY_BYTES);
    const dockerfileBlob = blob(DOCKERFILE_BYTES);
    const symlinkTargetBlob = blob(Buffer.from('elsewhere', 'utf8'));

    mainCommit = buildCommit([{ name: 'policy.yml', mode: '100644', type: 'blob', id: policyBlob }]);
    git(['update-ref', 'refs/heads/main', mainCommit]);
    git(['checkout', 'main']);
    git(['reset', '--hard']);

    dockerfileMissingCommit = buildCommit([{ name: 'policy.yml', mode: '100644', type: 'blob', id: dockerfilePolicyBlob }]);

    const symlinkRunnerTree = tree([{ name: 'Dockerfile', mode: '120000', type: 'blob', id: symlinkTargetBlob }]);
    dockerfileSymlinkCommit = buildCommit([
      { name: 'policy.yml', mode: '100644', type: 'blob', id: dockerfilePolicyBlob },
      { name: 'runner', mode: '040000', type: 'tree', id: symlinkRunnerTree },
    ]);

    const presentRunnerTree = tree([{ name: 'Dockerfile', mode: '100644', type: 'blob', id: dockerfileBlob }]);
    dockerfilePresentCommit = buildCommit([
      { name: 'policy.yml', mode: '100644', type: 'blob', id: dockerfilePolicyBlob },
      { name: 'runner', mode: '040000', type: 'tree', id: presentRunnerTree },
    ]);

    missingPolicyDirCommit = buildCommit(null);

    missingPolicyFileCommit = buildCommit([{ name: 'README.md', mode: '100644', type: 'blob', id: blob(README_BYTES) }]);

    invalidContentCommit = buildCommit([{ name: 'policy.yml', mode: '100644', type: 'blob', id: invalidBlob }]);
  }, 60000);

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  test('loads a git source from git objects as authoritative', async () => {
    const source: PolicySource = { kind: 'git', repoDir, ref: 'main' };
    const result = await loadPolicy(source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.revision.kind).toBe('git-tree');
    const expectedTreeId = git(['rev-parse', `${mainCommit}:.github/patch-steward`]);
    expect(result.value.revision.id).toBe(expectedTreeId);
    if (result.value.revision.kind !== 'git-tree') {
      throw new Error('expected a git-tree revision');
    }
    expect(result.value.revision.commit).toBe(mainCommit);
    expect(result.value.authoritative).toBe(true);
    expect(result.value.policy.llm?.model).toBe('replace-with-model-id');
  });

  test('working-tree edits do not change the loaded policy or revision', async () => {
    const policyPath = path.join(repoDir, '.github', 'patch-steward', 'policy.yml');
    fs.mkdirSync(path.dirname(policyPath), { recursive: true });
    fs.writeFileSync(policyPath, 'version: 99\n');

    const source: PolicySource = { kind: 'git', repoDir, ref: 'main' };
    const result = await loadPolicy(source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    if (result.value.revision.kind !== 'git-tree') {
      throw new Error('expected a git-tree revision');
    }
    expect(result.value.revision.commit).toBe(mainCommit);
    expect(result.value.policy.llm?.model).toBe('replace-with-model-id');

    git(['checkout', '--', '.github/patch-steward/policy.yml']);
  });

  test('undeclared dockerfile: git-loaded runner.image.path absent from the tree is policy.undeclared-reference', async () => {
    const source: PolicySource = { kind: 'git', repoDir, ref: dockerfileMissingCommit };
    const result = await loadPolicy(source);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.failure.code).toBe('policy.undeclared-reference');
    expect(result.failure.cause).toBe('policy-invalid');
    expect(result.failure.details).toHaveLength(1);
    expect(result.failure.details[0]?.path).toBe('runner.image.path');
  });

  test('undeclared dockerfile: a symlinked Dockerfile is rejected', async () => {
    const source: PolicySource = { kind: 'git', repoDir, ref: dockerfileSymlinkCommit };
    const result = await loadPolicy(source);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.failure.code).toBe('policy.undeclared-reference');
  });

  test('dockerfile present in the tree loads', async () => {
    const source: PolicySource = { kind: 'git', repoDir, ref: dockerfilePresentCommit };
    const result = await loadPolicy(source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.authoritative).toBe(true);
  });

  test('missing policy directory is a typed failure', async () => {
    const source: PolicySource = { kind: 'git', repoDir, ref: missingPolicyDirCommit };
    const result = await loadPolicy(source);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('git.policy-directory-missing');
  });

  test('missing policy file is a typed failure', async () => {
    const source: PolicySource = { kind: 'git', repoDir, ref: missingPolicyFileCommit };
    const result = await loadPolicy(source);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('git.entry-missing');
  });

  test('invalid policy content is a typed failure without a policy', async () => {
    const source: PolicySource = { kind: 'git', repoDir, ref: invalidContentCommit };
    const result = await loadPolicy(source);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('policy.version-unsupported');
    expect('value' in result).toBe(false);
  });

  test('unresolvable ref is a typed failure', async () => {
    const source: PolicySource = { kind: 'git', repoDir, ref: 'refs/heads/does-not-exist' };
    const result = await loadPolicy(source);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('git.ref-unresolvable');
  });
});

describe('policy loader: git source injected failures', () => {
  const repoDir = os.tmpdir();
  const commit = 'a'.repeat(40);
  const treeId = 'b'.repeat(40);
  const blobId = 'c'.repeat(40);

  function baseScript(overrides: {
    lsTreeRoot?: (args: readonly string[]) => Promise<Result<ProcessOutput, ProcessFailureCode>>;
    lsTreeRecursive?: (args: readonly string[]) => Promise<Result<ProcessOutput, ProcessFailureCode>>;
    catFile?: (args: readonly string[]) => Promise<Result<ProcessOutput, ProcessFailureCode>>;
  }): ProcessRunner {
    return async (_binary, args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return ok({ exitCode: 0, stdout: Buffer.from('.git\n'), stderr: Buffer.alloc(0) });
      }
      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        return ok({ exitCode: 0, stdout: Buffer.from(`${commit}\n`), stderr: Buffer.alloc(0) });
      }
      if (args[0] === 'ls-tree' && args.includes('.github/patch-steward')) {
        if (overrides.lsTreeRoot) {
          return overrides.lsTreeRoot(args);
        }
        return ok({
          exitCode: 0,
          stdout: Buffer.from(`040000 tree ${treeId}\t.github/patch-steward\0`),
          stderr: Buffer.alloc(0),
        });
      }
      if (args[0] === 'ls-tree' && args.includes('-r')) {
        if (overrides.lsTreeRecursive) {
          return overrides.lsTreeRecursive(args);
        }
        return ok({
          exitCode: 0,
          stdout: Buffer.from(`100644 blob ${blobId} 11\tpolicy.yml\0`),
          stderr: Buffer.alloc(0),
        });
      }
      if (args[0] === 'cat-file') {
        if (overrides.catFile) {
          return overrides.catFile(args);
        }
        return ok({ exitCode: 0, stdout: templateBytes, stderr: Buffer.alloc(0) });
      }
      throw new Error(`unexpected git invocation: ${args.join(' ')}`);
    };
  }

  test('loader injected failure: missing binary', async () => {
    const source: PolicySource = { kind: 'git', repoDir, ref: 'main' };
    const result = await loadPolicy(source, { gitBinary: path.join(os.tmpdir(), 'no-such-git-binary-for-loader-test') });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('git.unavailable');
  });

  test('loader injected failure: timeout', async () => {
    const runner: ProcessRunner = async (_binary, args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return ok({ exitCode: 0, stdout: Buffer.from('.git\n'), stderr: Buffer.alloc(0) });
      }
      return err('process.timeout', 'infrastructure', 'x');
    };
    const source: PolicySource = { kind: 'git', repoDir, ref: 'main' };
    const result = await loadPolicy(source, { runner });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('git.timeout');
  });

  test('loader injected failure: oversize output', async () => {
    const runner = baseScript({
      lsTreeRecursive: async () => err('process.output-too-large', 'infrastructure', 'too large'),
    });
    const source: PolicySource = { kind: 'git', repoDir, ref: 'main' };
    const result = await loadPolicy(source, { runner });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('git.output-too-large');
  });

  test('loader injected failure: malformed ls-tree output', async () => {
    const runner = baseScript({
      lsTreeRecursive: async () => ok({ exitCode: 0, stdout: Buffer.from('garbage\0'), stderr: Buffer.alloc(0) }),
    });
    const source: PolicySource = { kind: 'git', repoDir, ref: 'main' };
    const result = await loadPolicy(source, { runner });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('git.malformed-output');
  });

  test('loader injected failure: missing blob', async () => {
    const runner = baseScript({
      catFile: async () => ok({ exitCode: 128, stdout: Buffer.alloc(0), stderr: Buffer.from('fatal') }),
    });
    const source: PolicySource = { kind: 'git', repoDir, ref: 'main' };
    const result = await loadPolicy(source, { runner });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('git.object-missing');
  });

  test('loader injected failure: oversize blob', async () => {
    let catFileCalled = false;
    const runner = baseScript({
      lsTreeRecursive: async () =>
        ok({ exitCode: 0, stdout: Buffer.from(`100644 blob ${blobId} 262145\tpolicy.yml\0`), stderr: Buffer.alloc(0) }),
      catFile: async () => {
        catFileCalled = true;
        return ok({ exitCode: 0, stdout: templateBytes, stderr: Buffer.alloc(0) });
      },
    });
    const source: PolicySource = { kind: 'git', repoDir, ref: 'main' };
    const result = await loadPolicy(source, { runner });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('git.blob-too-large');
    expect(catFileCalled).toBe(false);
  });
});

describe('policy loader: file source', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-loader-file-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 });
  });

  test('file source loads as non-authoritative with a local revision id', async () => {
    const filePath = path.join(tmpDir, 'policy.yml');
    fs.writeFileSync(filePath, templateBytes);

    const source: PolicySource = { kind: 'file', path: filePath };
    const result = await loadPolicy(source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.revision).toEqual({ kind: 'local-file', id: localFileRevisionId(templateBytes), path: filePath });
    expect(result.value.authoritative).toBe(false);
  });

  test('file source failures are typed', async () => {
    const missingResult = await loadPolicy({ kind: 'file', path: path.join(tmpDir, 'does-not-exist.yml') });
    expect(missingResult.ok).toBe(false);
    expect(!missingResult.ok && missingResult.failure.code).toBe('file.not-found');
    expect('value' in missingResult).toBe(false);
    expect(!missingResult.ok && missingResult.failure.outcome).toBe('inconclusive');

    const directoryResult = await loadPolicy({ kind: 'file', path: tmpDir });
    expect(directoryResult.ok).toBe(false);
    expect(!directoryResult.ok && directoryResult.failure.code).toBe('file.not-a-file');
    expect('value' in directoryResult).toBe(false);
    expect(!directoryResult.ok && directoryResult.failure.outcome).toBe('inconclusive');

    const bigPath = path.join(tmpDir, 'big.yml');
    fs.writeFileSync(bigPath, Buffer.alloc(POLICY_FILE_MAX_BYTES + 1, 'a'));
    const bigResult = await loadPolicy({ kind: 'file', path: bigPath });
    expect(bigResult.ok).toBe(false);
    expect(!bigResult.ok && bigResult.failure.code).toBe('file.too-large');
    expect('value' in bigResult).toBe(false);
    expect(!bigResult.ok && bigResult.failure.outcome).toBe('inconclusive');
  });
});

describe('policy loader: outcomes', () => {
  test('every loader failure has outcome inconclusive and no policy', async () => {
    const results: Awaited<ReturnType<typeof loadPolicy>>[] = [
      await loadPolicy({ kind: 'file', path: '/does/not/exist.yml' }),
      await loadPolicy({ kind: 'git', repoDir: os.tmpdir(), ref: 'refs/heads/does-not-exist' }),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (result.ok) {
        continue;
      }
      expect(result.failure.outcome).toBe('inconclusive');
      expect('value' in result).toBe(false);
    }
  });
});
