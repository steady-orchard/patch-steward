import { describe, expect, it } from 'vitest';

import { createGitHubBudget } from '../github/budget.js';
import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch } from '../github/client.js';
import { runRecordSchema } from '../records/run.js';

import { readPublishedSnapshot } from './fallback-read.js';
import type { PublishedSnapshotQuery } from './fallback-read.js';

const query: PublishedSnapshotQuery = {
  store: { repository: { owner: 'octo', name: 'evidence' }, branch: 'steward-evidence' },
  targetRepository: 'octo/demo',
  subject: { type: 'issue', number: 7 },
};

function buildRecord(overrides: { runId?: number; runAttempt?: number; number?: number; repository?: string } = {}): unknown {
  const record = {
    schema_version: 1,
    record_type: 'run',
    run_id: overrides.runId ?? 12,
    run_attempt: overrides.runAttempt ?? 2,
    subject: {
      kind: 'submission',
      repository: overrides.repository ?? 'octo/demo',
      type: 'issue',
      number: overrides.number ?? 7,
      snapshot_hash: `sha256:${'5'.repeat(64)}`,
    },
    commits: {
      base: 'a'.repeat(40),
      head: 'a'.repeat(40),
      group: null,
    },
    owned_check_id: 7,
    policy_revision: 'b'.repeat(40),
    steward_version: '1.0.0',
    provider: 'copilot-sdk',
    requested_model: 'gpt-5',
    reported_model: 'gpt-5',
    adapter_version: '1.0.0',
    generation: { temperature: 0.2 },
    runner_identity: 'runner-1',
    mode: 'enforce',
    started_at: '2026-09-26T12:00:00Z',
    finished_at: null,
    budget: {
      model_calls: 1,
      tokens: 100,
      ai_credits: 0.5,
      container_seconds: 10,
      executions: 1,
      github_requests: 1,
      retries: 0,
    },
  };
  return runRecordSchema.parse(record);
}

function encodeContent(content: string): string {
  const base64 = Buffer.from(content, 'utf8').toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 60) {
    lines.push(base64.slice(i, i + 60));
  }
  return lines.join('\n');
}

function fileResponse(path: string, content: string): unknown {
  const bytes = Buffer.from(content, 'utf8');
  return {
    name: 'run.json',
    path,
    sha: 'c'.repeat(40),
    size: bytes.length,
    type: 'file',
    encoding: 'base64',
    content: encodeContent(content),
  };
}

function dirEntry(name: string): unknown {
  return { name, path: `octo/demo/runs/issue-7/${name}`, sha: 'd'.repeat(40), type: 'dir', size: 0 };
}

interface RecordedRequest {
  readonly url: string;
  readonly method: string;
}

function makeClient(
  answers: Map<string, { status: number; body: unknown }>,
  recorded: RecordedRequest[],
): ReturnType<typeof createGitHubClient> {
  const fetchFn: GitHubFetch = async (url, init) => {
    recorded.push({ url, method: init.method });
    const answer = answers.get(url);
    if (!answer) {
      return new Response('not mapped', { status: 500 });
    }
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  };
  return createGitHubClient({
    token: null,
    budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }),
    fetch: fetchFn,
  });
}

const LISTING_URL = 'https://api.github.com/repos/octo/evidence/contents/octo/demo/runs/issue-7?ref=steward-evidence';
const FILE_URL_12_2 =
  'https://api.github.com/repos/octo/evidence/contents/octo/demo/runs/issue-7/12-2/run.json?ref=steward-evidence';

describe('published snapshot fallback read', () => {
  it('no published run directory means no fallback', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient(new Map([[LISTING_URL, { status: 404, body: {} }]]), recorded);
    const result = await readPublishedSnapshot(client, query);
    expect(result).toEqual({ kind: 'none' });
  });

  it('the latest run directory by run id and attempt is read', async () => {
    const recorded: RecordedRequest[] = [];
    const dirs = ['5-1', '12-1', '12-2', 'supersessions', '9-3'].map(dirEntry);
    const answers = new Map([
      [LISTING_URL, { status: 200, body: dirs }],
      [FILE_URL_12_2, { status: 200, body: fileResponse('octo/demo/runs/issue-7/12-2/run.json', JSON.stringify(buildRecord())) }],
    ]);
    const client = makeClient(answers, recorded);
    await readPublishedSnapshot(client, query);
    expect(recorded[1]?.url).toBe(FILE_URL_12_2);
  });

  it('the published snapshot and policy revision are returned', async () => {
    const recorded: RecordedRequest[] = [];
    const dirs = ['5-1', '12-1', '12-2', 'supersessions', '9-3'].map(dirEntry);
    const answers = new Map([
      [LISTING_URL, { status: 200, body: dirs }],
      [FILE_URL_12_2, { status: 200, body: fileResponse('octo/demo/runs/issue-7/12-2/run.json', JSON.stringify(buildRecord())) }],
    ]);
    const client = makeClient(answers, recorded);
    const result = await readPublishedSnapshot(client, query);
    expect(result).toEqual({
      kind: 'published',
      runId: 12,
      runAttempt: 2,
      snapshotHash: `sha256:${'5'.repeat(64)}`,
      policyRevision: 'b'.repeat(40),
    });
  });

  it('a listing without run directories means no fallback', async () => {
    const recorded: RecordedRequest[] = [];
    const dirs = [
      dirEntry('supersessions'),
      { name: 'run.json', path: 'octo/demo/runs/issue-7/run.json', sha: 'e'.repeat(40), type: 'file', size: 1 },
    ];
    const client = makeClient(new Map([[LISTING_URL, { status: 200, body: dirs }]]), recorded);
    const result = await readPublishedSnapshot(client, query);
    expect(result).toEqual({ kind: 'none' });
  });

  it('a listing at the entry bound is unavailable', async () => {
    const recorded: RecordedRequest[] = [];
    const dirs = Array.from({ length: 1000 }, (_, i) => dirEntry(`${i + 1}-1`));
    const client = makeClient(new Map([[LISTING_URL, { status: 200, body: dirs }]]), recorded);
    const result = await readPublishedSnapshot(client, query);
    expect(result).toEqual({ kind: 'unavailable' });
    expect(recorded.length).toBe(1);
  });

  it('an oversize run record is unavailable', async () => {
    const recorded: RecordedRequest[] = [];
    const dirs = ['12-2'].map(dirEntry);
    const file = fileResponse('octo/demo/runs/issue-7/12-2/run.json', JSON.stringify(buildRecord())) as { size: number };
    file.size = 1048577;
    const answers = new Map([
      [LISTING_URL, { status: 200, body: dirs }],
      [FILE_URL_12_2, { status: 200, body: file }],
    ]);
    const client = makeClient(answers, recorded);
    const result = await readPublishedSnapshot(client, query);
    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('a run record for another submission is unavailable', async () => {
    const dirs = ['12-2'].map(dirEntry);
    const wrongNumber = new Map([
      [LISTING_URL, { status: 200, body: dirs }],
      [FILE_URL_12_2, { status: 200, body: fileResponse('p', JSON.stringify(buildRecord({ number: 8 }))) }],
    ]);
    const client1 = makeClient(wrongNumber, []);
    const result1 = await readPublishedSnapshot(client1, query);
    expect(result1).toEqual({ kind: 'unavailable' });

    const wrongRepo = new Map([
      [LISTING_URL, { status: 200, body: dirs }],
      [FILE_URL_12_2, { status: 200, body: fileResponse('p', JSON.stringify(buildRecord({ repository: 'octo/other' }))) }],
    ]);
    const client2 = makeClient(wrongRepo, []);
    const result2 = await readPublishedSnapshot(client2, query);
    expect(result2).toEqual({ kind: 'unavailable' });
  });

  it('a run record that fails its schema is unavailable', async () => {
    const dirs = ['12-2'].map(dirEntry);
    const record = buildRecord() as Record<string, unknown>;
    const withExtra = { ...record, extra: 'nope' };
    const answers1 = new Map([
      [LISTING_URL, { status: 200, body: dirs }],
      [FILE_URL_12_2, { status: 200, body: fileResponse('p', JSON.stringify(withExtra)) }],
    ]);
    const client1 = makeClient(answers1, []);
    const result1 = await readPublishedSnapshot(client1, query);
    expect(result1).toEqual({ kind: 'unavailable' });

    const answers2 = new Map([
      [LISTING_URL, { status: 200, body: dirs }],
      [FILE_URL_12_2, { status: 200, body: fileResponse('p', 'not json') }],
    ]);
    const client2 = makeClient(answers2, []);
    const result2 = await readPublishedSnapshot(client2, query);
    expect(result2).toEqual({ kind: 'unavailable' });
  });

  it('a run record whose run differs from its directory is unavailable', async () => {
    const dirs = ['12-2'].map(dirEntry);
    const answers = new Map([
      [LISTING_URL, { status: 200, body: dirs }],
      [FILE_URL_12_2, { status: 200, body: fileResponse('p', JSON.stringify(buildRecord({ runId: 13 }))) }],
    ]);
    const client = makeClient(answers, []);
    const result = await readPublishedSnapshot(client, query);
    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('a failed read is unavailable', async () => {
    const client1 = makeClient(new Map([[LISTING_URL, { status: 500, body: {} }]]), []);
    const result1 = await readPublishedSnapshot(client1, query);
    expect(result1).toEqual({ kind: 'unavailable' });

    const dirs = ['12-2'].map(dirEntry);
    const answers2 = new Map([
      [LISTING_URL, { status: 200, body: dirs }],
      [FILE_URL_12_2, { status: 404, body: {} }],
    ]);
    const client2 = makeClient(answers2, []);
    const result2 = await readPublishedSnapshot(client2, query);
    expect(result2).toEqual({ kind: 'unavailable' });
  });

  it('the fallback read uses the store branch and target prefix', async () => {
    const recorded: RecordedRequest[] = [];
    const dirs = ['12-2'].map(dirEntry);
    const answers = new Map([
      [LISTING_URL, { status: 200, body: dirs }],
      [FILE_URL_12_2, { status: 200, body: fileResponse('p', JSON.stringify(buildRecord())) }],
    ]);
    const client = makeClient(answers, recorded);
    await readPublishedSnapshot(client, query);
    expect(recorded.map((r) => r.url)).toEqual([LISTING_URL, FILE_URL_12_2]);
    expect(recorded.every((r) => r.method === 'GET')).toBe(true);
  });
});
