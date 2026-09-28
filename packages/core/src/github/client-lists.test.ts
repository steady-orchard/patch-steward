import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createGitHubBudget } from './budget.js';
import { createGitHubClient, type GitHubFetch, type GitHubFetchInit } from './client.js';

interface RecordedCall {
  readonly url: string;
  readonly init: GitHubFetchInit;
}

function makeFetch(responses: Array<Response | Error | (() => Promise<Response>)>): { fetch: GitHubFetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  let index = 0;
  const fetchImpl: GitHubFetch = async (url, init) => {
    calls.push({ url, init });
    const entry = responses[Math.min(index, responses.length - 1)];
    index += 1;
    if (entry instanceof Error) {
      throw entry;
    }
    if (typeof entry === 'function') {
      return entry();
    }
    return entry as Response;
  };
  return { fetch: fetchImpl, calls };
}

function makeSleep(): { sleep: (ms: number) => Promise<void>; sleeps: number[] } {
  const sleeps: number[] = [];
  const sleep = async (ms: number): Promise<void> => {
    sleeps.push(ms);
  };
  return { sleep, sleeps };
}

const token = 'test-token-' + 'l'.repeat(12);
const idSchema = z.object({ id: z.number() });

describe('github client lists and redirects', () => {
  it('list pages collect items and the first total count', async () => {
    const nextLink =
      '<https://api.github.com/repositories/9/things?per_page=100&page=2>; rel="next", <https://api.github.com/repositories/9/things?per_page=100&page=2>; rel="last"';
    const { fetch, calls } = makeFetch([
      new Response('{"total_count":3,"items":[{"id":1},{"id":2}]}', { status: 200, headers: { link: nextLink } }),
      new Response('{"total_count":3,"items":[{"id":3}]}', { status: 200 }),
    ]);
    const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
    const result = await client.getPaginatedList('/repos/octo/demo/things', 'items', idSchema, { name: 'x' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items.map((item) => item.id)).toEqual([1, 2, 3]);
      expect(result.value.totalCount).toBe(3);
      expect(result.value.complete).toBe(true);
    }
    expect(calls[0]?.url).toBe('https://api.github.com/repos/octo/demo/things?name=x&per_page=100');
    expect(calls[1]?.url).toBe('https://api.github.com/repositories/9/things?per_page=100&page=2');
  });

  it('a list beyond the page limit is incomplete', async () => {
    const nextLink = '<https://api.github.com/repositories/9/things?per_page=100&page=2>; rel="next"';
    const { fetch, calls } = makeFetch([
      new Response('{"total_count":3,"items":[{"id":1}]}', { status: 200, headers: { link: nextLink } }),
    ]);
    const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
    const result = await client.getPaginatedList('/repos/octo/demo/things', 'items', idSchema, undefined, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.complete).toBe(false);
      expect(result.value.items.map((item) => item.id)).toEqual([1]);
      expect(result.value.totalCount).toBe(3);
    }
    expect(calls).toHaveLength(1);
  });

  it('list pages validate every item', async () => {
    const { fetch } = makeFetch([new Response('{"total_count":1,"items":[{"id":"x"}]}', { status: 200 })]);
    const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
    const result = await client.getPaginatedList('/repos/octo/demo/things', 'items', idSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.schema-mismatch');
      expect(result.failure.outcome).toBe('inconclusive');
    }
  });

  it('a list page without the named array is a schema mismatch', async () => {
    for (const body of ['{"total_count":1}', '[]', '{"total_count":-1,"items":[]}']) {
      const { fetch } = makeFetch([new Response(body, { status: 200 })]);
      const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
      const result = await client.getPaginatedList('/repos/octo/demo/things', 'items', idSchema);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('github.schema-mismatch');
      }
    }
    const { fetch, calls } = makeFetch([new Response('{"total_count":1,"items":[]}', { status: 200 })]);
    const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
    const result = await client.getPaginatedList('/repos/octo/demo/things', 'Bad-Key', idSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.invalid-request');
    }
    expect(calls).toHaveLength(0);
  });

  it('the redirect location is returned without following it', async () => {
    const href = 'https://storage.example.net/a/b.zip?sig=' + 'q'.repeat(20);
    const { fetch, calls } = makeFetch([new Response(null, { status: 302, headers: { location: href } })]);
    const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
    const result = await client.getRedirectLocation('/repos/octo/demo/actions/artifacts/1/zip');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(href);
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.method).toBe('GET');
    expect(calls[0]?.init.redirect).toBe('manual');
    expect(calls[0]?.init.headers['authorization']).toBe('Bearer ' + token);
  });

  it('a response that does not redirect is an unexpected status', async () => {
    const { fetch } = makeFetch([new Response('{}', { status: 200 })]);
    const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
    const result = await client.getRedirectLocation('/repos/octo/demo/actions/artifacts/1/zip');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.unexpected-status');
    }
  });

  it('a redirect without a valid location is malformed', async () => {
    const cases = [
      new Response(null, { status: 302 }),
      new Response(null, { status: 302, headers: { location: 'relative/path' } }),
      new Response(null, { status: 302, headers: { location: 'https://x.example/' + 'a'.repeat(2100) } }),
      new Response(null, { status: 302, headers: { location: 'ftp://x.example/a' } }),
    ];
    for (const response of cases) {
      const { fetch } = makeFetch([response]);
      const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
      const result = await client.getRedirectLocation('/repos/octo/demo/actions/artifacts/1/zip');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('github.malformed-response');
      }
    }
  });

  it('redirect reads retry server errors within the budget', async () => {
    const href = 'https://storage.example.net/a/b.zip?sig=' + 'r'.repeat(20);
    const { fetch, calls } = makeFetch([
      new Response(null, { status: 500 }),
      new Response(null, { status: 302, headers: { location: href } }),
    ]);
    const { sleep, sleeps } = makeSleep();
    const budget = createGitHubBudget({ requests: 5, retriesPerRequest: 1 });
    const client = createGitHubClient({ token, budget, fetch, sleep });
    const result = await client.getRedirectLocation('/repos/octo/demo/actions/artifacts/1/zip');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(href);
    }
    expect(sleeps).toEqual([1000]);
    expect(budget.requestsUsed()).toBe(2);
    expect(calls).toHaveLength(2);

    const { fetch: fetchFail } = makeFetch([new Response(null, { status: 500 }), new Response(null, { status: 500 })]);
    const failClient = createGitHubClient({
      token,
      budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }),
      fetch: fetchFail,
      sleep: makeSleep().sleep,
    });
    const failResult = await failClient.getRedirectLocation('/repos/octo/demo/actions/artifacts/1/zip');
    expect(failResult.ok).toBe(false);
    if (!failResult.ok) {
      expect(failResult.failure.code).toBe('github.server-error');
    }
  });

  it('redirect failures never echo the location', async () => {
    const cases = [
      new Response(null, { status: 302, headers: { location: 'https://x.example/' + 'a'.repeat(2100) } }),
      new Response(null, { status: 200, headers: { location: 'https://storage.example.net/sig=zzz' } }),
    ];
    for (const response of cases) {
      const { fetch } = makeFetch([response]);
      const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
      const result = await client.getRedirectLocation('/repos/octo/demo/actions/artifacts/1/zip');
      expect(result.ok).toBe(false);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('sig=');
      expect(serialized).not.toContain('x.example');
      expect(serialized).not.toContain('storage.example.net');
    }
  });
});
