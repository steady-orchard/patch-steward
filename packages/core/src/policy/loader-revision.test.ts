import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { loadPolicy, loadPolicyRevision } from './loader.js';

const policyBytes = fs.readFileSync(
  fileURLToPath(new URL('../../../../fixtures/policies/valid/minimal-no-llm.yml', import.meta.url)),
);

const REPOSITORY: GitHubRepositoryRef = { owner: 'octo', name: 'demo' };
const TREE = 'b'.repeat(40);
const BLOB = 'c'.repeat(40);
const COMMIT = 'a'.repeat(40);

function b64(bytes: Buffer): string {
  return bytes.toString('base64');
}

interface RecordedCall {
  readonly pathname: string;
  readonly search: string;
}

function makeClient(routes: ReadonlyMap<string, unknown>, calls: RecordedCall[]): ReturnType<typeof createGitHubClient> {
  const fetchImpl: GitHubFetch = (url: string): Promise<Response> => {
    const parsed = new URL(url);
    calls.push({ pathname: parsed.pathname, search: parsed.search });
    const key = parsed.pathname + parsed.search;
    const body = routes.get(key);
    if (body === undefined) {
      return Promise.resolve(new Response('not mapped', { status: 404 }));
    }
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  return createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 20, retriesPerRequest: 0 }), fetch: fetchImpl });
}

function treePath(treeId: string): string {
  return `/repos/${REPOSITORY.owner}/${REPOSITORY.name}/git/trees/${treeId}`;
}

function blobPath(blobId: string): string {
  return `/repos/${REPOSITORY.owner}/${REPOSITORY.name}/git/blobs/${blobId}`;
}

function treeBody(overrides?: {
  readonly sha?: string;
  readonly truncated?: boolean;
  readonly entries?: readonly Record<string, unknown>[];
}): unknown {
  return {
    sha: overrides?.sha ?? TREE,
    truncated: overrides?.truncated ?? false,
    tree: overrides?.entries ?? [{ path: 'policy.yml', mode: '100644', type: 'blob', sha: BLOB, size: policyBytes.length }],
  };
}

function blobBody(bytes: Buffer, sha = BLOB): unknown {
  return { sha, size: bytes.length, encoding: 'base64', content: b64(bytes) };
}

describe('policy load by revision', () => {
  test('a policy loads from its recorded tree id', async () => {
    const calls: RecordedCall[] = [];
    const routes = new Map<string, unknown>([
      [`${treePath(TREE)}?recursive=1`, treeBody()],
      [blobPath(BLOB), blobBody(policyBytes)],
    ]);
    const client = makeClient(routes, calls);
    const result = await loadPolicyRevision({ client, repository: REPOSITORY, treeId: TREE, commit: COMMIT, ref: 'main' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revision).toEqual({ kind: 'git-tree', id: TREE, commit: COMMIT, ref: 'main' });
      expect(result.value.authoritative).toBe(true);
    }
    expect(calls).toEqual([
      { pathname: treePath(TREE), search: '?recursive=1' },
      { pathname: blobPath(BLOB), search: '' },
    ]);
  });

  test('a tree answer with another id is malformed', async () => {
    const calls: RecordedCall[] = [];
    const routes = new Map<string, unknown>([[`${treePath(TREE)}?recursive=1`, treeBody({ sha: 'd'.repeat(40) })]]);
    const client = makeClient(routes, calls);
    const result = await loadPolicyRevision({ client, repository: REPOSITORY, treeId: TREE, commit: COMMIT, ref: 'main' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.malformed-response');
    }
  });

  test('a truncated policy tree is refused', async () => {
    const calls: RecordedCall[] = [];
    const routes = new Map<string, unknown>([[`${treePath(TREE)}?recursive=1`, treeBody({ truncated: true })]]);
    const client = makeClient(routes, calls);
    const result = await loadPolicyRevision({ client, repository: REPOSITORY, treeId: TREE, commit: COMMIT, ref: 'main' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('policy-source.tree-truncated');
    }
  });

  test('an invalid tree id, commit, or ref sends nothing', async () => {
    const calls: RecordedCall[] = [];
    const client = makeClient(new Map(), calls);
    const cases: readonly { readonly treeId: string; readonly commit: string; readonly ref: string }[] = [
      { treeId: 'x', commit: COMMIT, ref: 'main' },
      { treeId: TREE, commit: 'y', ref: 'main' },
      { treeId: TREE, commit: COMMIT, ref: '' },
      { treeId: TREE, commit: COMMIT, ref: 'a b' },
    ];
    for (const c of cases) {
      const result = await loadPolicyRevision({ client, repository: REPOSITORY, ...c });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('github.invalid-request');
      }
    }
    expect(calls).toEqual([]);
  });

  test('an invalid policy at the recorded tree is policy-invalid', async () => {
    const calls: RecordedCall[] = [];
    const invalidBytes = Buffer.from('version: 1\n', 'utf8');
    const routes = new Map<string, unknown>([
      [
        `${treePath(TREE)}?recursive=1`,
        treeBody({ entries: [{ path: 'policy.yml', mode: '100644', type: 'blob', sha: BLOB, size: invalidBytes.length }] }),
      ],
      [blobPath(BLOB), blobBody(invalidBytes)],
    ]);
    const client = makeClient(routes, calls);
    const result = await loadPolicyRevision({ client, repository: REPOSITORY, treeId: TREE, commit: COMMIT, ref: 'main' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.cause).toBe('policy-invalid');
    }
  });

  test('the published policy source still loads by branch', async () => {
    const calls: RecordedCall[] = [];
    const routes = new Map<string, unknown>([
      [
        `/repos/${REPOSITORY.owner}/${REPOSITORY.name}/git/ref/heads/main`,
        { ref: 'refs/heads/main', object: { sha: COMMIT, type: 'commit' } },
      ],
      [
        `/repos/${REPOSITORY.owner}/${REPOSITORY.name}/contents/.github?ref=${COMMIT}`,
        [{ name: 'patch-steward', path: '.github/patch-steward', sha: TREE, type: 'dir', size: 0 }],
      ],
      [`${treePath(TREE)}?recursive=1`, treeBody()],
      [blobPath(BLOB), blobBody(policyBytes)],
    ]);
    const client = makeClient(routes, calls);
    const result = await loadPolicy({ kind: 'github', client, repository: REPOSITORY, branch: 'main' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revision).toEqual({ kind: 'git-tree', id: TREE, commit: COMMIT, ref: 'main' });
    }
  });
});
