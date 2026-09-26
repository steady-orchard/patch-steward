import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { stringify } from 'yaml';

import { parseStrictYaml } from '../strict-yaml.js';
import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { resolvedPolicySchema } from './schema.js';
import type { GitHubPolicyLoadFailureCode, GitHubPolicySource, PolicySource } from './loader.js';
import { loadPolicy } from './loader.js';
import type { Result } from '../result.js';
import type { LoadedPolicy, PolicyLoadFailureCode } from './loader.js';

const templateBytes = fs.readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));

const COMMIT_SHA = 'a'.repeat(40);
const TREE_SHA = 'b'.repeat(40);
const BLOB_SHA = 'c'.repeat(40);
const OTHER_TREE_SHA = 'd'.repeat(40);
const DOCKERFILE_BLOB_SHA = 'e'.repeat(40);

const REPOSITORY: GitHubRepositoryRef = { owner: 'octo', name: 'demo' };
const BRANCH = 'main';

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

function refUrl(): string {
  return `https://api.github.com/repos/${REPOSITORY.owner}/${REPOSITORY.name}/git/ref/heads/${BRANCH}`;
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

function refBody(): unknown {
  return { ref: `refs/heads/${BRANCH}`, object: { sha: COMMIT_SHA, type: 'commit' } };
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
  routes.set(refUrl(), { status: 200, body: refBody() });
  routes.set(contentsUrl(), { status: 200, body: contentsBody(true) });
  routes.set(treeUrl(TREE_SHA), { status: 200, body: treeBody() });
  routes.set(blobUrl(BLOB_SHA), { status: 200, body: blobBody(policyBytes) });
  return routes;
}

function sourceFor(routes: ReadonlyMap<string, Route>): GitHubPolicySource {
  const client = createGitHubClient({
    token: null,
    budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }),
    fetch: makeFetch(routes),
  });
  return { kind: 'github', client, repository: REPOSITORY, branch: BRANCH };
}

describe('policy loader: github source', () => {
  test('github policy source loads a published policy with the tree id as revision', async () => {
    const routes = baseRoutes(templateBytes);
    const result = await loadPolicy(sourceFor(routes));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.revision).toEqual({ kind: 'git-tree', id: TREE_SHA, commit: COMMIT_SHA, ref: BRANCH });
    expect(result.value.authoritative).toBe(true);
    expect(resolvedPolicySchema.safeParse(result.value.policy).success).toBe(true);
  });

  test('github policy source reports no published policy', async () => {
    const routesNotFound = new Map<string, Route>();
    routesNotFound.set(refUrl(), { status: 200, body: refBody() });
    routesNotFound.set(contentsUrl(), { status: 404 });
    const resultA = await loadPolicy(sourceFor(routesNotFound));
    expect(resultA.ok).toBe(false);
    if (!resultA.ok) {
      expect(resultA.failure.code).toBe('policy-source.not-published');
      expect(resultA.failure.cause).toBe('policy-unavailable');
      expect(resultA.failure.outcome).toBe('inconclusive');
      expect('value' in resultA).toBe(false);
    }

    const routesNoEntry = new Map<string, Route>();
    routesNoEntry.set(refUrl(), { status: 200, body: refBody() });
    routesNoEntry.set(contentsUrl(), { status: 200, body: contentsBody(false) });
    const resultB = await loadPolicy(sourceFor(routesNoEntry));
    expect(resultB.ok).toBe(false);
    if (!resultB.ok) {
      expect(resultB.failure.code).toBe('policy-source.not-published');
    }

    const routesNotArray = new Map<string, Route>();
    routesNotArray.set(refUrl(), { status: 200, body: refBody() });
    routesNotArray.set(contentsUrl(), { status: 200, body: {} });
    const resultC = await loadPolicy(sourceFor(routesNotArray));
    expect(resultC.ok).toBe(false);
    if (!resultC.ok) {
      expect(resultC.failure.code).toBe('policy-source.not-published');
    }

    const routesNoPolicyFile = baseRoutes(templateBytes);
    routesNoPolicyFile.set(treeUrl(TREE_SHA), { status: 200, body: treeBody({ entries: [] }) });
    const resultD = await loadPolicy(sourceFor(routesNoPolicyFile));
    expect(resultD.ok).toBe(false);
    if (!resultD.ok) {
      expect(resultD.failure.code).toBe('policy-source.not-published');
    }
  });

  test('github policy source rejects a policy path that is not a directory', async () => {
    const routes = new Map<string, Route>();
    routes.set(refUrl(), { status: 200, body: refBody() });
    routes.set(contentsUrl(), {
      status: 200,
      body: [{ name: 'patch-steward', path: '.github/patch-steward', sha: TREE_SHA, type: 'file', size: 10 }],
    });
    const result = await loadPolicy(sourceFor(routes));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('policy-source.not-a-directory');
    }
  });

  test('github policy source rejects a truncated tree', async () => {
    const routes = baseRoutes(templateBytes);
    routes.set(treeUrl(TREE_SHA), { status: 200, body: treeBody({ truncated: true }) });
    const result = await loadPolicy(sourceFor(routes));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('policy-source.tree-truncated');
    }
  });

  test('github policy source requires a regular policy file', async () => {
    const routes = baseRoutes(templateBytes);
    routes.set(treeUrl(TREE_SHA), {
      status: 200,
      body: treeBody({ entries: [{ path: 'policy.yml', mode: '120000', type: 'tree', sha: BLOB_SHA, size: 10 }] }),
    });
    const result = await loadPolicy(sourceFor(routes));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('policy-source.entry-not-regular');
    }
  });

  test('github policy source bounds the policy file size', async () => {
    let blobRequested = false;
    const routes = baseRoutes(templateBytes);
    routes.set(treeUrl(TREE_SHA), {
      status: 200,
      body: treeBody({ entries: [{ path: 'policy.yml', mode: '100644', type: 'blob', sha: BLOB_SHA, size: 262145 }] }),
    });
    const client = createGitHubClient({
      token: null,
      budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }),
      fetch: (url, init) => {
        if (url === blobUrl(BLOB_SHA)) blobRequested = true;
        return makeFetch(routes)(url, init);
      },
    });
    const source: GitHubPolicySource = { kind: 'github', client, repository: REPOSITORY, branch: BRANCH };
    const result = await loadPolicy(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('policy-source.blob-too-large');
      expect(result.failure.cause).toBe('policy-invalid');
    }
    expect(blobRequested).toBe(false);
  });

  test('github policy source validates the policy with the standard pipeline', async () => {
    const routes = baseRoutes(INVALID_POLICY_BYTES);
    routes.set(blobUrl(BLOB_SHA), { status: 200, body: blobBody(INVALID_POLICY_BYTES) });
    const result = await loadPolicy(sourceFor(routes));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('policy.version-unsupported');
      expect(result.failure.cause).toBe('policy-invalid');
    }
  });

  test('github policy source checks the Dockerfile runner path', async () => {
    const routesMissing = baseRoutes(DOCKERFILE_POLICY_BYTES);
    routesMissing.set(blobUrl(BLOB_SHA), { status: 200, body: blobBody(DOCKERFILE_POLICY_BYTES) });
    const resultMissing = await loadPolicy(sourceFor(routesMissing));
    expect(resultMissing.ok).toBe(false);
    if (!resultMissing.ok) {
      expect(resultMissing.failure.code).toBe('policy.undeclared-reference');
    }

    const routesPresent = baseRoutes(DOCKERFILE_POLICY_BYTES);
    routesPresent.set(blobUrl(BLOB_SHA), { status: 200, body: blobBody(DOCKERFILE_POLICY_BYTES) });
    routesPresent.set(treeUrl(TREE_SHA), {
      status: 200,
      body: treeBody({
        entries: [
          { path: 'policy.yml', mode: '100644', type: 'blob', sha: BLOB_SHA, size: DOCKERFILE_POLICY_BYTES.length },
          { path: 'runner/Dockerfile', mode: '100644', type: 'blob', sha: DOCKERFILE_BLOB_SHA, size: 20 },
        ],
      }),
    });
    const resultPresent = await loadPolicy(sourceFor(routesPresent));
    expect(resultPresent.ok).toBe(true);
  });

  test('github policy source passes GitHub failures through', async () => {
    const routes500 = new Map<string, Route>();
    routes500.set(refUrl(), { status: 500 });
    const result500 = await loadPolicy(sourceFor(routes500));
    expect(result500.ok).toBe(false);
    if (!result500.ok) {
      expect(result500.failure.code).toBe('github.server-error');
    }

    const routes401 = new Map<string, Route>();
    routes401.set(refUrl(), { status: 401 });
    const result401 = await loadPolicy(sourceFor(routes401));
    expect(result401.ok).toBe(false);
    if (!result401.ok) {
      expect(result401.failure.code).toBe('github.unauthorized');
    }

    const routes404 = new Map<string, Route>();
    routes404.set(refUrl(), { status: 404 });
    const result404 = await loadPolicy(sourceFor(routes404));
    expect(result404.ok).toBe(false);
    if (!result404.ok) {
      expect(result404.failure.code).toBe('github.not-found');
    }
  });

  test('github policy source keeps the file and git failure types', async () => {
    const fileResult: Result<LoadedPolicy, PolicyLoadFailureCode> = await loadPolicy({ kind: 'file', path: 'x' });
    expect(fileResult.ok).toBe(false);
    if (!fileResult.ok) {
      expect(fileResult.failure.code).toBe('file.not-found');
    }

    const githubSource: PolicySource = sourceFor(baseRoutes(templateBytes));
    const githubResult: Result<LoadedPolicy, GitHubPolicyLoadFailureCode> = await loadPolicy(githubSource);
    expect(githubResult.ok).toBe(true);
  });
});
