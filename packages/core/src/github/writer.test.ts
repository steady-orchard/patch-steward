import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createGitHubBudget } from './budget.js';
import {
  createGitHubWriter,
  githubBranchRefPath,
  githubRepositoryPath,
  isAllowedGitHubWrite,
  type GitHubWriteFetch,
  type GitHubWriteFetchInit,
  type GitHubWriteRequest,
  type GitHubWriteScope,
} from './writer.js';

const SHA = 'a'.repeat(40);
const STORE = { repository: { owner: 'octo', name: 'evidence' }, branch: 'steward-evidence' };
const APP: GitHubWriteScope = { kind: 'app' };
const WITH_STORE: GitHubWriteScope = { kind: 'installation', store: STORE };
const NO_STORE: GitHubWriteScope = { kind: 'installation', store: null };
const TOKEN = 'test-token-' + 'w'.repeat(20);

interface RecordedCall {
  readonly url: string;
  readonly init: GitHubWriteFetchInit;
}

function createFakeFetch(responses: readonly Response[]): { fetch: GitHubWriteFetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  let index = 0;
  const fetch: GitHubWriteFetch = async (url, init) => {
    calls.push({ url, init });
    const response = responses[index];
    index += 1;
    if (response === undefined) {
      throw new Error('no more responses queued');
    }
    return response;
  };
  return { fetch, calls };
}

function createRecordingSleep(): { sleep: (ms: number) => Promise<void>; waits: number[] } {
  const waits: number[] = [];
  const sleep = (ms: number): Promise<void> => {
    waits.push(ms);
    return Promise.resolve();
  };
  return { sleep, waits };
}

describe('github writer', () => {
  it('the writer allows exactly the store and token endpoints', () => {
    const repoPath = githubRepositoryPath(STORE.repository);
    expect(
      isAllowedGitHubWrite(
        {
          method: 'POST',
          path: '/app/installations/162868612/access_tokens',
          body: { repositories: ['demo'], permissions: { contents: 'read' } },
        },
        APP,
      ),
    ).toBe(true);
    expect(isAllowedGitHubWrite({ method: 'DELETE', path: '/installation/token', body: null }, NO_STORE)).toBe(true);
    expect(isAllowedGitHubWrite({ method: 'DELETE', path: '/installation/token', body: null }, WITH_STORE)).toBe(true);
    expect(
      isAllowedGitHubWrite(
        { method: 'POST', path: repoPath + '/git/blobs', body: { content: 'aGk=', encoding: 'base64' } },
        WITH_STORE,
      ),
    ).toBe(true);
    const treeEntry = { path: 'octo/demo/runs/pr-1/5-1/run.json', mode: '100644', type: 'blob', sha: SHA };
    expect(isAllowedGitHubWrite({ method: 'POST', path: repoPath + '/git/trees', body: { tree: [treeEntry] } }, WITH_STORE)).toBe(
      true,
    );
    expect(
      isAllowedGitHubWrite(
        { method: 'POST', path: repoPath + '/git/trees', body: { base_tree: SHA, tree: [treeEntry] } },
        WITH_STORE,
      ),
    ).toBe(true);
    expect(
      isAllowedGitHubWrite(
        {
          method: 'POST',
          path: repoPath + '/git/commits',
          body: { message: 'evidence: octo/demo pr-1 run 5-1', tree: SHA, parents: [SHA] },
        },
        WITH_STORE,
      ),
    ).toBe(true);
    expect(
      isAllowedGitHubWrite(
        {
          method: 'POST',
          path: repoPath + '/git/commits',
          body: { message: 'evidence: octo/demo pr-1 run 5-1', tree: SHA, parents: [] },
        },
        WITH_STORE,
      ),
    ).toBe(true);
    expect(
      isAllowedGitHubWrite(
        { method: 'POST', path: repoPath + '/git/refs', body: { ref: 'refs/heads/steward-evidence', sha: SHA } },
        WITH_STORE,
      ),
    ).toBe(true);
    expect(
      isAllowedGitHubWrite(
        { method: 'PATCH', path: githubBranchRefPath(STORE.repository, STORE.branch), body: { sha: SHA, force: false } },
        WITH_STORE,
      ),
    ).toBe(true);
  });

  it('the writer rejects every non-allowlisted method and path', () => {
    const scopes: Record<string, GitHubWriteScope> = { app: APP, store: WITH_STORE, nostore: NO_STORE };
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
    const paths = [
      '/app/installations/162868612/access_tokens',
      '/installation/token',
      '/repos/octo/evidence/git/blobs',
      '/repos/octo/evidence/git/trees',
      '/repos/octo/evidence/git/commits',
      '/repos/octo/evidence/git/refs',
      '/repos/octo/evidence/git/refs/heads/steward-evidence',
      '/repos/octo/evidence/git/refs/heads/main',
      '/repos/octo/evidence/git/refs/tags/v1',
      '/repos/octo/other/git/blobs',
      '/repos/octo/evidence/contents/run.json',
      '/repos/octo/evidence/issues/1/comments',
      '/repos/octo/evidence/issues/1/labels',
      '/repos/octo/evidence/issues/1',
      '/repos/octo/evidence/pulls/1',
      '/repos/octo/evidence/pulls/1/reviews',
      '/repos/octo/evidence/pulls/1/requested_reviewers',
      '/repos/octo/evidence/check-runs',
      '/repos/octo/evidence/statuses/' + SHA,
      '/repos/octo/evidence/issues/comments/1/reactions',
      '/repos/octo/evidence/dispatches',
      '/app/installations/162868612',
      '/user/installations',
    ];
    const validBodies: Record<string, unknown> = {
      '/app/installations/162868612/access_tokens': { repositories: ['demo'], permissions: { contents: 'read' } },
      '/installation/token': null,
      '/repos/octo/evidence/git/blobs': { content: 'aGk=', encoding: 'base64' },
      '/repos/octo/evidence/git/trees': {
        tree: [{ path: 'octo/demo/runs/pr-1/5-1/run.json', mode: '100644', type: 'blob', sha: SHA }],
      },
      '/repos/octo/evidence/git/commits': { message: 'evidence: octo/demo pr-1 run 5-1', tree: SHA, parents: [SHA] },
      '/repos/octo/evidence/git/refs': { ref: 'refs/heads/steward-evidence', sha: SHA },
      '/repos/octo/evidence/git/refs/heads/steward-evidence': { sha: SHA, force: false },
    };
    const expectedTrue = new Set([
      'app POST /app/installations/162868612/access_tokens',
      'store DELETE /installation/token',
      'nostore DELETE /installation/token',
      'store POST /repos/octo/evidence/git/blobs',
      'store POST /repos/octo/evidence/git/trees',
      'store POST /repos/octo/evidence/git/commits',
      'store POST /repos/octo/evidence/git/refs',
      'store PATCH /repos/octo/evidence/git/refs/heads/steward-evidence',
    ]);
    let trueCount = 0;
    for (const [scopeName, scope] of Object.entries(scopes)) {
      for (const method of methods) {
        for (const path of paths) {
          const body = Object.prototype.hasOwnProperty.call(validBodies, path) ? (validBodies[path] ?? null) : {};
          const request = { method, path, body } as GitHubWriteRequest;
          const key = `${scopeName} ${method} ${path}`;
          const result = isAllowedGitHubWrite(request, scope);
          if (expectedTrue.has(key)) {
            expect(result).toBe(true);
            trueCount += 1;
          } else {
            expect(result).toBe(false);
          }
        }
      }
    }
    expect(trueCount).toBe(8);
  });

  it('rejected writes send nothing and spend no budget', async () => {
    const { fetch, calls } = createFakeFetch([]);
    const budget = createGitHubBudget({ requests: 10, retriesPerRequest: 1 });
    const writer = createGitHubWriter({ token: TOKEN, scope: WITH_STORE, budget, fetch });

    const results = await Promise.all([
      writer.send({ method: 'POST', path: '/repos/octo/evidence/issues/1/comments', body: { body: 'x' } }, z.unknown()),
      writer.send(
        { method: 'PATCH', path: '/repos/octo/evidence/git/refs/heads/main', body: { sha: SHA, force: false } },
        z.unknown(),
      ),
      writer.send({ method: 'POST', path: '/repos/octo/evidence/check-runs', body: {} }, z.unknown()),
      writer.send(
        { method: 'PUT', path: '/repos/octo/evidence/contents/run.json', body: {} } as unknown as GitHubWriteRequest,
        z.unknown(),
      ),
      writer.sendNoContent({ method: 'DELETE', path: '/repos/octo/evidence/git/refs/heads/steward-evidence', body: null }),
    ]);

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('github.write-not-allowed');
        expect(result.failure.cause).toBe('steward-defect');
        expect(result.failure.outcome).toBe('inconclusive');
      }
    }
    expect(calls.length).toBe(0);
    expect(budget.requestsUsed()).toBe(0);
  });

  it('write bodies are checked against the allowlist', () => {
    const repoPath = githubRepositoryPath(STORE.repository);
    const refPath = githubBranchRefPath(STORE.repository, STORE.branch);
    expect(isAllowedGitHubWrite({ method: 'PATCH', path: refPath, body: { sha: SHA, force: true } }, WITH_STORE)).toBe(false);
    expect(isAllowedGitHubWrite({ method: 'PATCH', path: refPath, body: { sha: SHA, force: false, extra: 1 } }, WITH_STORE)).toBe(
      false,
    );
    expect(
      isAllowedGitHubWrite(
        { method: 'POST', path: repoPath + '/git/refs', body: { ref: 'refs/heads/main', sha: SHA } },
        WITH_STORE,
      ),
    ).toBe(false);
    expect(
      isAllowedGitHubWrite(
        { method: 'POST', path: repoPath + '/git/trees', body: { tree: [{ path: 'a', mode: '100755', type: 'blob', sha: SHA }] } },
        WITH_STORE,
      ),
    ).toBe(false);
    expect(
      isAllowedGitHubWrite(
        {
          method: 'POST',
          path: repoPath + '/git/trees',
          body: { tree: [{ path: 'a', mode: '100644', type: 'commit', sha: SHA }] },
        },
        WITH_STORE,
      ),
    ).toBe(false);
    expect(isAllowedGitHubWrite({ method: 'POST', path: repoPath + '/git/trees', body: { tree: [] } }, WITH_STORE)).toBe(false);
    expect(
      isAllowedGitHubWrite(
        { method: 'POST', path: repoPath + '/git/commits', body: { message: 'm', tree: SHA, parents: [SHA, SHA] } },
        WITH_STORE,
      ),
    ).toBe(false);
    expect(
      isAllowedGitHubWrite(
        { method: 'POST', path: repoPath + '/git/blobs', body: { content: 'aGk=', encoding: 'utf-8' } },
        WITH_STORE,
      ),
    ).toBe(false);
    expect(
      isAllowedGitHubWrite(
        {
          method: 'POST',
          path: '/app/installations/162868612/access_tokens',
          body: { repositories: ['a', 'b'], permissions: { contents: 'read' } },
        },
        APP,
      ),
    ).toBe(false);
    expect(
      isAllowedGitHubWrite(
        {
          method: 'POST',
          path: '/app/installations/162868612/access_tokens',
          body: { repositories: ['a'], permissions: { contents: 'admin' } },
        },
        APP,
      ),
    ).toBe(false);
    expect(isAllowedGitHubWrite({ method: 'DELETE', path: '/installation/token', body: {} }, NO_STORE)).toBe(false);
  });

  it('writes send json bodies with the pinned headers', async () => {
    const response = new Response(JSON.stringify({ sha: SHA, url: 'https://api.github.com/x' }), { status: 201 });
    const { fetch, calls } = createFakeFetch([response]);
    const budget = createGitHubBudget({ requests: 5, retriesPerRequest: 0 });
    const writer = createGitHubWriter({ token: TOKEN, scope: WITH_STORE, budget, fetch });
    const requestBody = { content: 'aGk=', encoding: 'base64' };
    const result = await writer.send(
      { method: 'POST', path: '/repos/octo/evidence/git/blobs', body: requestBody },
      z.object({ sha: z.string() }),
    );
    expect(result).toEqual({ ok: true, value: { sha: SHA } });
    expect(calls.length).toBe(1);
    const call = calls[0] as RecordedCall;
    expect(call.url).toBe('https://api.github.com/repos/octo/evidence/git/blobs');
    expect(call.init.method).toBe('POST');
    expect(call.init.redirect).toBe('manual');
    expect(call.init.headers).toEqual({
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'patch-steward',
      authorization: 'Bearer ' + TOKEN,
      'content-type': 'application/json',
    });
    expect(JSON.parse(call.init.body as string)).toEqual(requestBody);
  });

  it('a non-fast-forward update is a write conflict', async () => {
    const response = new Response(JSON.stringify({ message: 'Update is not a fast forward' }), { status: 422 });
    const { fetch, calls } = createFakeFetch([response]);
    const budget = createGitHubBudget({ requests: 5, retriesPerRequest: 1 });
    const writer = createGitHubWriter({ token: TOKEN, scope: WITH_STORE, budget, fetch });
    const result = await writer.send(
      { method: 'PATCH', path: githubBranchRefPath(STORE.repository, STORE.branch), body: { sha: SHA, force: false } },
      z.unknown(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.write-conflict');
      expect(result.failure.cause).toBe('github-unavailable');
    }
    expect(calls.length).toBe(1);
  });

  it('writes retry server errors within the budget', async () => {
    {
      const { fetch, calls } = createFakeFetch([
        new Response(null, { status: 502 }),
        new Response(JSON.stringify({ sha: SHA }), { status: 201 }),
      ]);
      const { sleep, waits } = createRecordingSleep();
      const budget = createGitHubBudget({ requests: 5, retriesPerRequest: 1 });
      const writer = createGitHubWriter({ token: TOKEN, scope: WITH_STORE, budget, fetch, sleep });
      const result = await writer.send(
        { method: 'POST', path: '/repos/octo/evidence/git/blobs', body: { content: 'aGk=', encoding: 'base64' } },
        z.object({ sha: z.string() }),
      );
      expect(result.ok).toBe(true);
      expect(waits).toEqual([1000]);
      expect(budget.requestsUsed()).toBe(2);
      expect(calls.length).toBe(2);
    }
    {
      const { fetch } = createFakeFetch([new Response(null, { status: 502 }), new Response(null, { status: 502 })]);
      const { sleep } = createRecordingSleep();
      const budget = createGitHubBudget({ requests: 5, retriesPerRequest: 1 });
      const writer = createGitHubWriter({ token: TOKEN, scope: WITH_STORE, budget, fetch, sleep });
      const result = await writer.send(
        { method: 'POST', path: '/repos/octo/evidence/git/blobs', body: { content: 'aGk=', encoding: 'base64' } },
        z.object({ sha: z.string() }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.server-error');
    }
    {
      const { fetch, calls } = createFakeFetch([new Response(null, { status: 502 }), new Response(null, { status: 502 })]);
      const { sleep } = createRecordingSleep();
      const budget = createGitHubBudget({ requests: 1, retriesPerRequest: 3 });
      const writer = createGitHubWriter({ token: TOKEN, scope: WITH_STORE, budget, fetch, sleep });
      const result = await writer.send(
        { method: 'POST', path: '/repos/octo/evidence/git/blobs', body: { content: 'aGk=', encoding: 'base64' } },
        z.object({ sha: z.string() }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.budget-exhausted');
      expect(calls.length).toBe(1);
    }
  });

  it('token revocation expects no content', async () => {
    {
      const { fetch, calls } = createFakeFetch([new Response(null, { status: 204 })]);
      const budget = createGitHubBudget({ requests: 5, retriesPerRequest: 0 });
      const writer = createGitHubWriter({ token: TOKEN, scope: NO_STORE, budget, fetch });
      const result = await writer.sendNoContent({ method: 'DELETE', path: '/installation/token', body: null });
      expect(result).toEqual({ ok: true, value: null });
      const call = calls[0] as RecordedCall;
      expect(Object.prototype.hasOwnProperty.call(call.init.headers, 'content-type')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(call.init, 'body')).toBe(false);
    }
    {
      const { fetch } = createFakeFetch([new Response('{}', { status: 200 })]);
      const budget = createGitHubBudget({ requests: 5, retriesPerRequest: 0 });
      const writer = createGitHubWriter({ token: TOKEN, scope: NO_STORE, budget, fetch });
      const result = await writer.sendNoContent({ method: 'DELETE', path: '/installation/token', body: null });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.unexpected-status');
    }
  });

  it('write failures never echo the response body', async () => {
    const sentinel = 'SENTINEL-' + 'x'.repeat(10);
    {
      const { fetch } = createFakeFetch([new Response(JSON.stringify({ message: sentinel }), { status: 422 })]);
      const budget = createGitHubBudget({ requests: 5, retriesPerRequest: 0 });
      const writer = createGitHubWriter({ token: TOKEN, scope: WITH_STORE, budget, fetch });
      const result = await writer.send(
        { method: 'PATCH', path: githubBranchRefPath(STORE.repository, STORE.branch), body: { sha: SHA, force: false } },
        z.unknown(),
      );
      const text = JSON.stringify(result);
      expect(text.includes(sentinel)).toBe(false);
      expect(text.includes(TOKEN)).toBe(false);
    }
    {
      const { fetch } = createFakeFetch([new Response(sentinel, { status: 500 })]);
      const budget = createGitHubBudget({ requests: 5, retriesPerRequest: 0 });
      const writer = createGitHubWriter({ token: TOKEN, scope: WITH_STORE, budget, fetch });
      const result = await writer.send(
        { method: 'POST', path: '/repos/octo/evidence/git/blobs', body: { content: 'aGk=', encoding: 'base64' } },
        z.unknown(),
      );
      const text = JSON.stringify(result);
      expect(text.includes(sentinel)).toBe(false);
      expect(text.includes(TOKEN)).toBe(false);
    }
    {
      const { fetch } = createFakeFetch([new Response(sentinel + '{', { status: 201 })]);
      const budget = createGitHubBudget({ requests: 5, retriesPerRequest: 0 });
      const writer = createGitHubWriter({ token: TOKEN, scope: WITH_STORE, budget, fetch });
      const result = await writer.send(
        { method: 'POST', path: '/repos/octo/evidence/git/blobs', body: { content: 'aGk=', encoding: 'base64' } },
        z.unknown(),
      );
      const text = JSON.stringify(result);
      expect(text.includes(sentinel)).toBe(false);
      expect(text.includes(TOKEN)).toBe(false);
    }
  });
});
