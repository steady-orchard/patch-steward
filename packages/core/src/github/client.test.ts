import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validatePolicyBytes } from '../policy/validate.js';
import { resolvePolicy } from '../policy/resolve.js';
import { GITHUB_RESPONSE_MAX_BYTES } from '../policy/bounds.js';
import { createGitHubBudget, githubBudgetForPolicy, githubBudgetForPreflight } from './budget.js';
import {
  GITHUB_FAILURE_CAUSES,
  GITHUB_FAILURE_CODES,
  createGitHubClient,
  githubFailure,
  type GitHubFetch,
  type GitHubFetchInit,
} from './client.js';

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

const idSchema = z.object({ id: z.number() });

describe('github client', () => {
  it('github client sends the pinned headers to the api origin', async () => {
    const { fetch, calls } = makeFetch([new Response('{"id":1}', { status: 200 })]);
    const { sleep } = makeSleep();
    const client = createGitHubClient({
      token: 'test-token-1',
      budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }),
      fetch,
      sleep,
    });
    const result = await client.getJson('/repos/octo/demo', idSchema, { ref: 'main' });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.github.com/repos/octo/demo?ref=main');
    expect(calls[0]?.init.method).toBe('GET');
    expect(calls[0]?.init.redirect).toBe('manual');
    expect(calls[0]?.init.headers).toEqual({
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'patch-steward',
      authorization: 'Bearer test-token-1',
    });
  });

  it('github client omits authorization without a token', async () => {
    const { fetch, calls } = makeFetch([new Response('{"id":1}', { status: 200 })]);
    const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
    const result = await client.getJson('/repos/octo/demo', idSchema);
    expect(result.ok).toBe(true);
    expect(calls[0]?.init.headers).toEqual({
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'patch-steward',
    });
  });

  it('github client validates responses with the schema', async () => {
    const { fetch } = makeFetch([new Response('{"id":1,"extra":"x"}', { status: 200 })]);
    const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
    const result = await client.getJson('/repos/octo/demo', idSchema);
    expect(result).toEqual({ ok: true, value: { id: 1 } });
  });

  it('github client rejects paths outside the api origin', async () => {
    const badPaths = ['//evil.example/x', 'repos/x', '/repos/../x', '/a?b=1', '/a#b', '/a\\b', '/a b'];
    for (const path of badPaths) {
      const { fetch, calls } = makeFetch([new Response('{"id":1}', { status: 200 })]);
      const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
      const result = await client.getJson(path, idSchema);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.invalid-request');
      expect(calls).toHaveLength(0);
    }
  });

  it('github client rejects a token that is not a header value', async () => {
    for (const token of ['a b', 'x\ny', '']) {
      const { fetch, calls } = makeFetch([new Response('{"id":1}', { status: 200 })]);
      const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }), fetch });
      const result = await client.getJson('/repos/octo/demo', idSchema);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.invalid-request');
      expect(calls).toHaveLength(0);
    }
  });

  it('injected failure: github network error is retried then fails', async () => {
    const { fetch, calls } = makeFetch([new TypeError('network'), new TypeError('network'), new TypeError('network')]);
    const { sleep, sleeps } = makeSleep();
    const client = createGitHubClient({
      token: null,
      budget: createGitHubBudget({ requests: 10, retriesPerRequest: 2 }),
      fetch,
      sleep,
    });
    const result = await client.getJson('/x', idSchema);
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([1000, 2000]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.network');
  });

  it('injected failure: github server error is retried then fails', async () => {
    const responses = Array.from({ length: 4 }, () => new Response('', { status: 502 }));
    const { fetch, calls } = makeFetch(responses);
    const { sleep } = makeSleep();
    const client = createGitHubClient({
      token: null,
      budget: createGitHubBudget({ requests: 10, retriesPerRequest: 3 }),
      fetch,
      sleep,
    });
    const result = await client.getJson('/x', idSchema);
    expect(calls).toHaveLength(4);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.server-error');
  });

  it('github server error recovers on retry', async () => {
    const { fetch } = makeFetch([new Response('', { status: 500 }), new Response('{"id":1}', { status: 200 })]);
    const { sleep, sleeps } = makeSleep();
    const client = createGitHubClient({
      token: null,
      budget: createGitHubBudget({ requests: 10, retriesPerRequest: 3 }),
      fetch,
      sleep,
    });
    const result = await client.getJson('/x', idSchema);
    expect(result.ok).toBe(true);
    expect(sleeps).toEqual([1000]);
  });

  it('injected failure: github unauthorized', async () => {
    const { fetch, calls } = makeFetch([new Response('', { status: 401 })]);
    const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 3 }), fetch });
    const result = await client.getJson('/x', idSchema);
    expect(calls).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.unauthorized');
  });

  it('injected failure: github forbidden without rate-limit headers', async () => {
    const { fetch, calls } = makeFetch([new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '42' } })]);
    const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 3 }), fetch });
    const result = await client.getJson('/x', idSchema);
    expect(calls).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.unauthorized');
  });

  it('injected failure: github rate limit with retry-after', async () => {
    {
      const { fetch } = makeFetch([
        new Response('', { status: 403, headers: { 'retry-after': '5' } }),
        new Response('{"id":1}', { status: 200 }),
      ]);
      const { sleep, sleeps } = makeSleep();
      const client = createGitHubClient({
        token: null,
        budget: createGitHubBudget({ requests: 10, retriesPerRequest: 3 }),
        fetch,
        sleep,
      });
      const result = await client.getJson('/x', idSchema);
      expect(result.ok).toBe(true);
      expect(sleeps).toEqual([5000]);
    }
    {
      const { fetch } = makeFetch([new Response('', { status: 403, headers: { 'retry-after': '61' } })]);
      const { sleep, sleeps } = makeSleep();
      const client = createGitHubClient({
        token: null,
        budget: createGitHubBudget({ requests: 10, retriesPerRequest: 3 }),
        fetch,
        sleep,
      });
      const result = await client.getJson('/x', idSchema);
      expect(sleeps).toEqual([]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.rate-limited');
    }
    {
      const { fetch } = makeFetch([new Response('', { status: 403, headers: { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' } })]);
      const { sleep, sleeps } = makeSleep();
      const client = createGitHubClient({
        token: null,
        budget: createGitHubBudget({ requests: 10, retriesPerRequest: 3 }),
        fetch,
        sleep,
      });
      const result = await client.getJson('/x', idSchema);
      expect(sleeps).toEqual([]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.rate-limited');
    }
  });

  it('injected failure: github rate limit without retry-after', async () => {
    const now = (): number => 1800000000000;
    {
      const { fetch } = makeFetch([
        new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000010' } }),
        new Response('{"id":1}', { status: 200 }),
      ]);
      const { sleep, sleeps } = makeSleep();
      const client = createGitHubClient({
        token: null,
        budget: createGitHubBudget({ requests: 10, retriesPerRequest: 3 }),
        fetch,
        sleep,
        now,
      });
      const result = await client.getJson('/x', idSchema);
      expect(result.ok).toBe(true);
      expect(sleeps).toEqual([10000]);
    }
    {
      const { fetch } = makeFetch([
        new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000120' } }),
      ]);
      const { sleep, sleeps } = makeSleep();
      const client = createGitHubClient({
        token: null,
        budget: createGitHubBudget({ requests: 10, retriesPerRequest: 3 }),
        fetch,
        sleep,
        now,
      });
      const result = await client.getJson('/x', idSchema);
      expect(sleeps).toEqual([]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.rate-limited');
    }
  });

  it('injected failure: github secondary rate limit without headers', async () => {
    {
      const { fetch } = makeFetch([new Response('', { status: 429 }), new Response('{"id":1}', { status: 200 })]);
      const { sleep, sleeps } = makeSleep();
      const client = createGitHubClient({
        token: null,
        budget: createGitHubBudget({ requests: 10, retriesPerRequest: 3 }),
        fetch,
        sleep,
      });
      const result = await client.getJson('/x', idSchema);
      expect(sleeps).toEqual([60000]);
      expect(result.ok).toBe(true);
    }
    {
      const { fetch } = makeFetch([new Response('', { status: 429 })]);
      const { sleep } = makeSleep();
      const client = createGitHubClient({
        token: null,
        budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }),
        fetch,
        sleep,
      });
      const result = await client.getJson('/x', idSchema);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.rate-limited');
    }
  });

  it('injected failure: github not found', async () => {
    const { fetch, calls } = makeFetch([new Response('', { status: 404 })]);
    const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 3 }), fetch });
    const result = await client.getJson('/x', idSchema);
    expect(calls).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.not-found');
  });

  it('injected failure: github request timeout', async () => {
    const fetchImpl: GitHubFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    const client = createGitHubClient({
      token: null,
      budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }),
      fetch: fetchImpl,
      timeoutMs: 20,
    });
    const result = await client.getJson('/x', idSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.timeout');
  });

  it('injected failure: github slow body', async () => {
    const fetchImpl: GitHubFetch = () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('['));
        },
      });
      return Promise.resolve(new Response(stream, { status: 200 }));
    };
    const client = createGitHubClient({
      token: null,
      budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }),
      fetch: fetchImpl,
      timeoutMs: 20,
    });
    const result = await client.getJson('/x', idSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.timeout');
  });

  it('injected failure: github malformed JSON', async () => {
    {
      const { fetch } = makeFetch([new Response('{"id":', { status: 200 })]);
      const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
      const result = await client.getJson('/x', idSchema);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.malformed-response');
    }
    {
      const { fetch } = makeFetch([new Response('', { status: 200 })]);
      const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
      const result = await client.getJson('/x', idSchema);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.malformed-response');
    }
  });

  it('injected failure: github invalid UTF-8', async () => {
    const { fetch } = makeFetch([new Response(new Uint8Array([0x7b, 0xff, 0x7d]), { status: 200 })]);
    const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
    const result = await client.getJson('/x', idSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.malformed-response');
  });

  it('injected failure: github schema mismatch', async () => {
    const { fetch } = makeFetch([new Response('{"id":"1"}', { status: 200 })]);
    const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
    const result = await client.getJson('/x', idSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.schema-mismatch');
      expect(result.failure.details[0]?.path).toBe('id');
    }
  });

  it('injected failure: github oversize body', async () => {
    {
      const body = new Uint8Array(GITHUB_RESPONSE_MAX_BYTES + 1);
      const { fetch } = makeFetch([new Response(body, { status: 200 })]);
      const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
      const result = await client.getJson('/x', idSchema);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.response-too-large');
    }
    {
      const { fetch } = makeFetch([new Response('{"id":1}', { status: 200, headers: { 'content-length': '999999999' } })]);
      const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
      const result = await client.getJson('/x', idSchema);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.response-too-large');
    }
  });

  it('injected failure: github unexpected status', async () => {
    {
      const { fetch } = makeFetch([new Response('', { status: 302, headers: { location: 'https://example.com' } })]);
      const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
      const result = await client.getJson('/x', idSchema);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.unexpected-status');
    }
    {
      const { fetch } = makeFetch([new Response('', { status: 422 })]);
      const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
      const result = await client.getJson('/x', idSchema);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.unexpected-status');
    }
  });

  it('github pagination follows next links', async () => {
    const { fetch, calls } = makeFetch([
      new Response('[1,2]', {
        status: 200,
        headers: {
          link: '<https://api.github.com/repositories/1/items?page=2>; rel="next", <https://api.github.com/repositories/1/items?page=3>; rel="last"',
        },
      }),
      new Response('[3]', {
        status: 200,
        headers: { link: '<https://api.github.com/repositories/1/items?page=3>; rel="next"' },
      }),
      new Response('[4]', { status: 200 }),
    ]);
    const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
    const result = await client.getPaginated('/repositories/1/items', z.number());
    expect(result).toEqual({ ok: true, value: [1, 2, 3, 4] });
    expect(calls[0]?.url.endsWith('?per_page=100')).toBe(true);
    expect(calls[1]?.url).toBe('https://api.github.com/repositories/1/items?page=2');
  });

  it('injected failure: github pagination over the page limit', async () => {
    const { fetch, calls } = makeFetch([
      new Response('[1]', { status: 200, headers: { link: '<https://api.github.com/x?page=2>; rel="next"' } }),
      new Response('[2]', { status: 200, headers: { link: '<https://api.github.com/x?page=3>; rel="next"' } }),
      new Response('[3]', { status: 200, headers: { link: '<https://api.github.com/x?page=4>; rel="next"' } }),
    ]);
    const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
    const result = await client.getPaginated('/x', z.number(), undefined, 2);
    expect(calls).toHaveLength(2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.pagination-exceeded');
  });

  it('injected failure: github truncated or off-origin pagination link', async () => {
    {
      const { fetch } = makeFetch([new Response('[1]', { status: 200, headers: { link: 'garbage' } })]);
      const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
      const result = await client.getPaginated('/x', z.number());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.pagination-invalid');
    }
    {
      const { fetch } = makeFetch([
        new Response('[1]', { status: 200, headers: { link: '<https://evil.example/x>; rel="next"' } }),
      ]);
      const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
      const result = await client.getPaginated('/x', z.number());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.pagination-invalid');
    }
    {
      const { fetch } = makeFetch([
        new Response('[1]', {
          status: 200,
          headers: { link: '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=3>; rel="next"' },
        }),
      ]);
      const client = createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch });
      const result = await client.getPaginated('/x', z.number());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.pagination-invalid');
    }
  });

  it('github budget charges every attempt and stops at the limit', async () => {
    {
      const responses = Array.from({ length: 5 }, () => new Response('', { status: 500 }));
      const { fetch, calls } = makeFetch(responses);
      const budget = createGitHubBudget({ requests: 2, retriesPerRequest: 5 });
      const client = createGitHubClient({ token: null, budget, fetch, sleep: async () => {} });
      const result = await client.getJson('/x', idSchema);
      expect(calls).toHaveLength(2);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.budget-exhausted');
      expect(budget.requestsUsed()).toBe(2);
    }
    {
      const { fetch, calls } = makeFetch([new Response('{"id":1}', { status: 200 })]);
      const budget = createGitHubBudget({ requests: 0, retriesPerRequest: 5 });
      const client = createGitHubClient({ token: null, budget, fetch });
      const result = await client.getJson('/x', idSchema);
      expect(calls).toHaveLength(0);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.budget-exhausted');
    }
  });

  it('github budgets for policy and preflight use the approved limits', () => {
    expect(githubBudgetForPreflight().limits).toEqual({ requests: 20, retriesPerRequest: 2 });

    const policyPath = fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url));
    const bytes = readFileSync(policyPath);
    const validated = validatePolicyBytes(bytes);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const resolved = resolvePolicy(validated.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(githubBudgetForPolicy(resolved.value).limits).toEqual({ requests: 300, retriesPerRequest: 3 });

    expect(createGitHubBudget({ requests: -1, retriesPerRequest: 1.5 }).limits).toEqual({ requests: 0, retriesPerRequest: 0 });
  });

  it('github client never exposes the token', async () => {
    const token = 'sentinel-token-7f3a9c';
    const cases: Array<{ readonly responses: Array<Response | Error>; readonly retriesPerRequest: number }> = [
      { responses: [new TypeError('network'), new TypeError('network')], retriesPerRequest: 1 },
      { responses: [new Response('', { status: 401 })], retriesPerRequest: 0 },
      { responses: [new Response('', { status: 404 })], retriesPerRequest: 0 },
      { responses: [new Response('', { status: 500 }), new Response('', { status: 500 })], retriesPerRequest: 1 },
      { responses: [new Response('{"id":', { status: 200 })], retriesPerRequest: 0 },
      { responses: [new Response('{"id":"1"}', { status: 200 })], retriesPerRequest: 0 },
      { responses: [new Response('{"id":1}', { status: 200 })], retriesPerRequest: 0 },
    ];
    for (const { responses, retriesPerRequest } of cases) {
      const { fetch } = makeFetch(responses);
      const client = createGitHubClient({
        token,
        budget: createGitHubBudget({ requests: 10, retriesPerRequest }),
        fetch,
        sleep: async () => {},
      });
      const result = await client.getJson('/x', idSchema);
      expect(JSON.stringify(result)).not.toContain(token);
    }
    {
      const fetchImpl: GitHubFetch = (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      const client = createGitHubClient({
        token,
        budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }),
        fetch: fetchImpl,
        timeoutMs: 5,
      });
      const result = await client.getJson('/x', idSchema);
      expect(JSON.stringify(result)).not.toContain(token);
    }
  });

  it('github failure codes map to their causes', () => {
    expect(new Set(GITHUB_FAILURE_CODES).size).toBe(17);
    expect(GITHUB_FAILURE_CODES).toHaveLength(17);
    for (const code of GITHUB_FAILURE_CODES) {
      const failure = githubFailure(code, 'm');
      expect(failure.failure.cause).toBe(GITHUB_FAILURE_CAUSES[code]);
      expect(failure.failure.outcome).toBe('inconclusive');
      if (code === 'github.rate-limited') expect(failure.failure.cause).toBe('rate-limited');
      else if (code === 'github.budget-exhausted') expect(failure.failure.cause).toBe('budget-exhausted');
      else if (code === 'github.invalid-request') expect(failure.failure.cause).toBe('steward-defect');
      else expect(failure.failure.cause).toBe('github-unavailable');
    }
  });
});
