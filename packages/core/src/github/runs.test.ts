import { describe, expect, it } from 'vitest';
import { createGitHubBudget } from './budget.js';
import { createGitHubClient, type GitHubFetch, type GitHubFetchInit } from './client.js';
import { readCapRunLists, readRunList } from './runs.js';
import { evaluateCaps } from '../ownership/caps.js';

interface RecordedCall {
  readonly url: string;
  readonly init: GitHubFetchInit;
}

function makeFetch(responses: Array<Response | (() => Response)>): { fetch: GitHubFetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  let index = 0;
  const fetchImpl: GitHubFetch = async (url, init) => {
    calls.push({ url, init });
    const entry = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return typeof entry === 'function' ? entry() : (entry as Response);
  };
  return { fetch: fetchImpl, calls };
}

const token = 'test-token-' + 'r'.repeat(12);
const repository = { owner: 'octo', name: 'demo' };

const runItem = {
  id: 5,
  name: 'x',
  display_title: 'steward pr 12 author 2095171 event pull_request_target edited sender 2095171 User',
  path: '.github/workflows/steward-pr.yml',
  event: 'pull_request_target',
  status: 'in_progress',
  conclusion: null,
  created_at: '2026-09-27T09:00:00Z',
  run_attempt: 1,
};

function makeClient(fetch: GitHubFetch) {
  return createGitHubClient({ token, budget: createGitHubBudget({ requests: 20, retriesPerRequest: 0 }), fetch });
}

describe('run list adapter', () => {
  it('run list items map the fields caps use', async () => {
    const { fetch } = makeFetch([new Response(JSON.stringify({ total_count: 1, workflow_runs: [runItem] }), { status: 200 })]);
    const client = makeClient(fetch);
    const result = await readRunList(client, repository, { kind: 'status', status: 'in_progress' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toEqual([
      {
        id: 5,
        path: '.github/workflows/steward-pr.yml',
        event: 'pull_request_target',
        status: 'in_progress',
        createdAt: '2026-09-27T09:00:00Z',
        displayTitle: 'steward pr 12 author 2095171 event pull_request_target edited sender 2095171 User',
      },
    ]);
    expect(result.value.totalCount).toBe(1);
    expect(result.value.complete).toBe(true);

    const nullStatusFetch = makeFetch([
      new Response(JSON.stringify({ total_count: 1, workflow_runs: [{ ...runItem, status: null }] }), { status: 200 }),
    ]).fetch;
    const nullStatusClient = makeClient(nullStatusFetch);
    const nullStatusResult = await readRunList(nullStatusClient, repository, { kind: 'status', status: 'queued' });
    expect(nullStatusResult.ok).toBe(true);
    if (!nullStatusResult.ok) return;
    expect(nullStatusResult.value.items[0]?.status).toBe('');
  });

  it('the created filter starts at the UTC day', async () => {
    const { fetch, calls } = makeFetch([
      new Response(JSON.stringify({ total_count: 0, workflow_runs: [] }), { status: 200 }),
      new Response(JSON.stringify({ total_count: 0, workflow_runs: [] }), { status: 200 }),
      new Response(JSON.stringify({ total_count: 0, workflow_runs: [] }), { status: 200 }),
    ]);
    const client = makeClient(fetch);
    await readCapRunLists(client, repository, new Date('2026-09-27T23:59:59Z'));
    expect(calls[0]?.url).toBe('https://api.github.com/repos/octo/demo/actions/runs?created=%3E%3D2026-09-27&per_page=100');
  });

  it('a run list beyond the page limit keeps its total', async () => {
    const nextLink =
      '<https://api.github.com/repos/octo/demo/actions/runs?created=%3E%3D2026-09-27&per_page=100&page=2>; rel="next"';
    const { fetch, calls } = makeFetch([
      () =>
        new Response(JSON.stringify({ total_count: 1500, workflow_runs: [runItem] }), { status: 200, headers: { link: nextLink } }),
    ]);
    const client = makeClient(fetch);
    const result = await readRunList(client, repository, { kind: 'created-since', date: '2026-09-27' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.complete).toBe(false);
    expect(result.value.totalCount).toBe(1500);
    expect(calls.length).toBe(10);
  });

  it('cap run lists read three listings in order', async () => {
    const { fetch, calls } = makeFetch([
      new Response(JSON.stringify({ total_count: 0, workflow_runs: [] }), { status: 200 }),
      new Response(JSON.stringify({ total_count: 0, workflow_runs: [] }), { status: 200 }),
      new Response(JSON.stringify({ total_count: 0, workflow_runs: [] }), { status: 200 }),
    ]);
    const client = makeClient(fetch);
    const result = await readCapRunLists(client, repository, new Date('2026-09-27T23:59:59Z'));
    expect(calls.length).toBe(3);
    expect(calls[0]?.url.endsWith('runs?created=%3E%3D2026-09-27&per_page=100')).toBe(true);
    expect(calls[1]?.url.endsWith('runs?status=in_progress&per_page=100')).toBe(true);
    expect(calls[2]?.url.endsWith('runs?status=queued&per_page=100')).toBe(true);
    expect(result.failure).toBeNull();
    expect(result.createdToday.complete).toBe(true);
    expect(result.inProgress.complete).toBe(true);
    expect(result.queued.complete).toBe(true);
  });

  it('a failed run list read leaves later lists incomplete', async () => {
    const { fetch, calls } = makeFetch([
      new Response(JSON.stringify({ total_count: 0, workflow_runs: [] }), { status: 200 }),
      new Response('server error', { status: 500 }),
    ]);
    const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 20, retriesPerRequest: 0 }), fetch });
    const result = await readCapRunLists(client, repository, new Date('2026-09-27T23:59:59Z'));
    expect(calls.length).toBe(2);
    expect(result.createdToday.complete).toBe(true);
    expect(result.inProgress).toEqual({ items: [], totalCount: 0, complete: false });
    expect(result.queued).toEqual({ items: [], totalCount: 0, complete: false });
    expect(result.failure?.code).toBe('github.server-error');

    const capsResult = evaluateCaps({
      createdToday: result.createdToday,
      inProgress: result.inProgress,
      queued: result.queued,
      now: new Date('2026-09-27T23:59:59Z'),
      botUserId: 1,
      authorId: 2,
      currentRunId: 3,
      dailyLimit: 50,
      authorLimit: 2,
    });
    expect(capsResult.ok).toBe(false);
    if (!capsResult.ok) {
      expect(capsResult.failure.code).toBe('caps.run-list-unavailable');
    }
  });

  it('an invalid run list filter is an invalid request', async () => {
    const { fetch, calls } = makeFetch([new Response(JSON.stringify({ total_count: 0, workflow_runs: [] }), { status: 200 })]);
    const client = makeClient(fetch);
    const result = await readRunList(client, repository, { kind: 'created-since', date: '2026-9-27' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.invalid-request');
    }
    const statusResult = await readRunList(client, repository, { kind: 'status', status: 'completed' as 'queued' });
    expect(statusResult.ok).toBe(false);
    if (!statusResult.ok) {
      expect(statusResult.failure.code).toBe('github.invalid-request');
    }
    expect(calls.length).toBe(0);
  });
});
