import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { stringify } from 'yaml';

import { parseStrictYaml } from '../strict-yaml.js';
import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type { GitReadOptions } from '../git/reader.js';
import type { ProcessRunner, ProcessOutput, ProcessFailureCode } from '../process/run-process.js';
import type { Result } from '../result.js';
import { ok } from '../result.js';
import { proposedPolicyFromBytes, readProposedPolicyFromGit, readProposedPolicyFromGitHub } from './proposed-policy.js';

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

describe('proposed policy: bytes', () => {
  test('proposed policy bytes that validate are valid', () => {
    const result = proposedPolicyFromBytes('rev1', templateBytes, () => true);
    expect(result).toEqual({ status: 'valid', revision: 'rev1' });
  });

  test('proposed policy validation errors are data', () => {
    const bytes = Buffer.concat([templateBytes, Buffer.from('unknown_setting: true\n', 'utf8')]);
    const result = proposedPolicyFromBytes('rev2', bytes, () => true);
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.revision).toBe('rev2');
    expect(result.errors[0]?.code).toBe('policy.unknown-key');
  });

  test('proposed policy errors are bounded', () => {
    const lines: string[] = [];
    for (let i = 0; i < 150; i += 1) {
      lines.push(`unknown_key_${String(i)}: true`);
    }
    const bytes = Buffer.concat([templateBytes, Buffer.from(lines.join('\n') + '\n', 'utf8')]);
    const result = proposedPolicyFromBytes('rev3', bytes, () => true);
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.errors.length).toBe(100);

    const emptyResult = proposedPolicyFromBytes('rev4', Buffer.alloc(0), () => true);
    expect(emptyResult.status).toBe('invalid');
    if (emptyResult.status !== 'invalid') return;
    expect(emptyResult.errors.length).toBe(1);
    expect(emptyResult.errors[0]?.code).toBe('yaml.empty');
  });

  test('proposed policy with a missing runner Dockerfile is invalid', () => {
    const bytes = dockerfilePolicyBytes();
    const invalidResult = proposedPolicyFromBytes('rev5', bytes, (rel) => {
      expect(rel).toBe('runner/Dockerfile');
      return false;
    });
    expect(invalidResult.status).toBe('invalid');
    if (invalidResult.status !== 'invalid') return;
    expect(invalidResult.errors[0]?.code).toBe('policy.undeclared-reference');

    const validResult = proposedPolicyFromBytes('rev5', bytes, (rel) => rel === 'runner/Dockerfile');
    expect(validResult).toEqual({ status: 'valid', revision: 'rev5' });
  });
});

const COMMIT_SHA = 'a'.repeat(40);
const TREE_SHA = 'b'.repeat(40);
const BLOB_SHA = 'c'.repeat(40);
const OTHER_TREE_SHA = 'd'.repeat(40);

const REPOSITORY: GitHubRepositoryRef = { owner: 'octo', name: 'demo' };

function b64(bytes: Buffer): string {
  return bytes.toString('base64');
}

interface Route {
  readonly status: number;
  readonly body?: unknown;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function makeFetch(routes: ReadonlyMap<string, Route>): GitHubFetch {
  return (url: string): Promise<Response> => {
    const route = routes.get(url);
    if (route === undefined) {
      return Promise.resolve(new Response('not mapped', { status: 404 }));
    }
    return Promise.resolve(jsonResponse(route.status, route.body ?? {}));
  };
}

function contentsUrl(): string {
  return `https://api.github.com/repos/${REPOSITORY.owner}/${REPOSITORY.name}/contents/.github?ref=${COMMIT_SHA}`;
}

function treeUrl(treeSha: string): string {
  return `https://api.github.com/repos/${REPOSITORY.owner}/${REPOSITORY.name}/git/trees/${treeSha}?recursive=1`;
}

function blobUrl(blobSha: string): string {
  return `https://api.github.com/repos/${REPOSITORY.owner}/${REPOSITORY.name}/git/blobs/${blobSha}`;
}

function contentsBody(includePolicyDir: boolean): unknown {
  const entries = [];
  if (includePolicyDir) {
    entries.push({ name: 'patch-steward', path: '.github/patch-steward', sha: TREE_SHA, type: 'dir', size: 0 });
  }
  entries.push({ name: 'workflows', path: '.github/workflows', sha: OTHER_TREE_SHA, type: 'dir', size: 0 });
  return entries;
}

function treeBody(overrides?: {
  readonly sha?: string;
  readonly truncated?: boolean;
  readonly entries?: readonly Record<string, unknown>[];
}): unknown {
  return {
    sha: overrides?.sha ?? TREE_SHA,
    truncated: overrides?.truncated ?? false,
    tree: overrides?.entries ?? [{ path: 'policy.yml', mode: '100644', type: 'blob', sha: BLOB_SHA, size: templateBytes.length }],
  };
}

function blobBody(bytes: Buffer, sha = BLOB_SHA): unknown {
  return { sha, size: bytes.length, encoding: 'base64', content: b64(bytes) };
}

function baseRoutes(policyBytes: Buffer): Map<string, Route> {
  const routes = new Map<string, Route>();
  routes.set(contentsUrl(), { status: 200, body: contentsBody(true) });
  routes.set(treeUrl(TREE_SHA), { status: 200, body: treeBody() });
  routes.set(blobUrl(BLOB_SHA), { status: 200, body: blobBody(policyBytes) });
  return routes;
}

function clientFor(routes: ReadonlyMap<string, Route>, retries = 0): ReturnType<typeof createGitHubClient> {
  return createGitHubClient({
    token: null,
    budget: createGitHubBudget({ requests: 50, retriesPerRequest: retries }),
    fetch: makeFetch(routes),
  });
}

describe('proposed policy: github', () => {
  test('proposed policy is read from GitHub at the commit', async () => {
    const routes = baseRoutes(templateBytes);
    const result = await readProposedPolicyFromGitHub(clientFor(routes), REPOSITORY, COMMIT_SHA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ status: 'valid', revision: TREE_SHA });
  });

  test('proposed policy removed from GitHub', async () => {
    const routesNotFound = new Map<string, Route>();
    routesNotFound.set(contentsUrl(), { status: 404 });
    const resultA = await readProposedPolicyFromGitHub(clientFor(routesNotFound), REPOSITORY, COMMIT_SHA);
    expect(resultA.ok).toBe(true);
    expect(resultA.ok && resultA.value).toEqual({ status: 'removed' });

    const routesNoEntry = new Map<string, Route>();
    routesNoEntry.set(contentsUrl(), { status: 200, body: contentsBody(false) });
    const resultB = await readProposedPolicyFromGitHub(clientFor(routesNoEntry), REPOSITORY, COMMIT_SHA);
    expect(resultB.ok).toBe(true);
    expect(resultB.ok && resultB.value).toEqual({ status: 'removed' });

    const routesNoPolicyFile = baseRoutes(templateBytes);
    routesNoPolicyFile.set(treeUrl(TREE_SHA), { status: 200, body: treeBody({ entries: [] }) });
    const resultC = await readProposedPolicyFromGitHub(clientFor(routesNoPolicyFile), REPOSITORY, COMMIT_SHA);
    expect(resultC.ok).toBe(true);
    expect(resultC.ok && resultC.value).toEqual({ status: 'removed' });
  });

  test('proposed policy GitHub tree problems are invalid data', async () => {
    const routesTruncated = baseRoutes(templateBytes);
    routesTruncated.set(treeUrl(TREE_SHA), { status: 200, body: treeBody({ truncated: true }) });
    const resultTruncated = await readProposedPolicyFromGitHub(clientFor(routesTruncated), REPOSITORY, COMMIT_SHA);
    expect(resultTruncated.ok).toBe(true);
    if (!resultTruncated.ok) return;
    expect(resultTruncated.value.status).toBe('invalid');
    if (resultTruncated.value.status !== 'invalid') return;
    expect(resultTruncated.value.errors[0]?.code).toBe('policy-source.tree-truncated');

    const routesNotRegular = baseRoutes(templateBytes);
    routesNotRegular.set(treeUrl(TREE_SHA), {
      status: 200,
      body: treeBody({ entries: [{ path: 'policy.yml', mode: '120000', type: 'tree', sha: BLOB_SHA, size: 10 }] }),
    });
    const resultNotRegular = await readProposedPolicyFromGitHub(clientFor(routesNotRegular), REPOSITORY, COMMIT_SHA);
    expect(resultNotRegular.ok).toBe(true);
    if (!resultNotRegular.ok) return;
    expect(resultNotRegular.value.status).toBe('invalid');
    if (resultNotRegular.value.status !== 'invalid') return;
    expect(resultNotRegular.value.errors[0]?.code).toBe('policy-source.entry-not-regular');

    const routesTooLarge = baseRoutes(templateBytes);
    routesTooLarge.set(treeUrl(TREE_SHA), {
      status: 200,
      body: treeBody({ entries: [{ path: 'policy.yml', mode: '100644', type: 'blob', sha: BLOB_SHA, size: 262145 }] }),
    });
    const resultTooLarge = await readProposedPolicyFromGitHub(clientFor(routesTooLarge), REPOSITORY, COMMIT_SHA);
    expect(resultTooLarge.ok).toBe(true);
    if (!resultTooLarge.ok) return;
    expect(resultTooLarge.value.status).toBe('invalid');
    if (resultTooLarge.value.status !== 'invalid') return;
    expect(resultTooLarge.value.errors[0]?.code).toBe('policy-source.blob-too-large');
  });

  test('injected failure: proposed policy GitHub read', async () => {
    const routes = new Map<string, Route>();
    routes.set(contentsUrl(), { status: 500 });
    const result = await readProposedPolicyFromGitHub(clientFor(routes, 0), REPOSITORY, COMMIT_SHA);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('github.server-error');
    expect(result.failure.outcome).toBe('inconclusive');
  });
});

function fakeRunner(queue: readonly Result<ProcessOutput, ProcessFailureCode>[]): ProcessRunner {
  let index = 0;
  return async (): Promise<Result<ProcessOutput, ProcessFailureCode>> => {
    const result = queue[index];
    index += 1;
    if (result === undefined) {
      throw new Error('fake runner queue exhausted');
    }
    return result;
  };
}

function output(exitCode: number, stdout: Buffer, stderr: Buffer = Buffer.alloc(0)): Result<ProcessOutput, ProcessFailureCode> {
  return ok({ exitCode, stdout, stderr });
}

describe('proposed policy: git', () => {
  let repoDir: string;
  let configDir: string;
  let globalConfigPath: string;
  let opts: GitReadOptions;
  let commitWithPolicy: string;
  let commitWithoutGithub: string;
  let commitWithoutPolicyFile: string;

  function fixtureEnv(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      if (key.toUpperCase().startsWith('GIT_')) continue;
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

  function hashObject(bytes: Buffer): string {
    return git(['hash-object', '-w', '--no-filters', '--stdin'], bytes);
  }

  function mktree(lines: readonly string[]): string {
    return git(['mktree'], Buffer.from(lines.join(''), 'utf8'));
  }

  function commitTree(tree: string): string {
    return git(['commit-tree', tree, '-m', 'fixture']);
  }

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-proposed-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-proposed-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');
    git(['-c', 'init.defaultBranch=main', 'init', '-q']);
    opts = { repoDir, timeoutMs: 30000, maxOutputBytes: 1048576 };

    const policyBlob = hashObject(templateBytes);
    const policyDirTree = mktree([`100644 blob ${policyBlob}\tpolicy.yml\n`]);
    const githubSubTree = mktree([`040000 tree ${policyDirTree}\tpatch-steward\n`]);
    const rootTree = mktree([`040000 tree ${githubSubTree}\t.github\n`]);
    commitWithPolicy = commitTree(rootTree);

    const emptyTree = mktree([]);
    commitWithoutGithub = commitTree(emptyTree);

    const emptyPolicyDirTree = mktree([]);
    const githubSubTree2 = mktree([`040000 tree ${emptyPolicyDirTree}\tpatch-steward\n`]);
    const rootTree2 = mktree([`040000 tree ${githubSubTree2}\t.github\n`]);
    commitWithoutPolicyFile = commitTree(rootTree2);
  }, 60000);

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  test('proposed policy is read from git at the commit', async () => {
    const expectedRevision = git(['rev-parse', `${commitWithPolicy}:.github/patch-steward`]);
    const result = await readProposedPolicyFromGit(opts, commitWithPolicy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ status: 'valid', revision: expectedRevision });
  });

  test('proposed policy removed in git', async () => {
    const resultA = await readProposedPolicyFromGit(opts, commitWithoutGithub);
    expect(resultA.ok).toBe(true);
    expect(resultA.ok && resultA.value).toEqual({ status: 'removed' });

    const resultB = await readProposedPolicyFromGit(opts, commitWithoutPolicyFile);
    expect(resultB.ok).toBe(true);
    expect(resultB.ok && resultB.value).toEqual({ status: 'removed' });
  });

  test('injected failure: proposed policy git read', async () => {
    const fakeOptions: GitReadOptions = {
      repoDir,
      timeoutMs: 30000,
      maxOutputBytes: 1048576,
      runner: fakeRunner([output(128, Buffer.alloc(0))]),
    };
    const result = await readProposedPolicyFromGit(fakeOptions, commitWithPolicy);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('git.failed');
  });
});
