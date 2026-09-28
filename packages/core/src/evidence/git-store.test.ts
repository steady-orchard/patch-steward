import { describe, expect, it } from 'vitest';

import { createGitHubBudget } from '../github/budget.js';
import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch, GitHubFetchInit } from '../github/client.js';
import { createGitHubWriter } from '../github/writer.js';
import type { GitHubWriteFetch, GitHubWriteFetchInit } from '../github/writer.js';
import { gitBlobId } from './blob-id.js';
import {
  commitEvidence,
  evidenceCommitMessage,
  evidenceStoreLocation,
  hostedEvidenceLocation,
  type EvidenceCommitInput,
  type EvidenceStoreGroup,
  type EvidenceStoreLocation,
} from './git-store.js';

const STORE: EvidenceStoreLocation = { repository: { owner: 'octo', name: 'demo' }, branch: 'steward-evidence' };
const TOKEN = 'test-token-' + 's'.repeat(12);
const TIP = '1'.repeat(40);
const TIP_TREE = '2'.repeat(40);

interface RecordedCall {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

interface RefOutcome {
  readonly conflict: boolean;
  readonly moveTip?: { readonly sha: string; readonly tree: string };
}

interface FakeStoreOptions {
  readonly initialTip?: string | null;
  readonly initialTree?: string;
  readonly refOutcomes?: readonly RefOutcome[];
  readonly compareOverride?: {
    readonly status: string;
    readonly ahead_by: number;
    readonly behind_by: number;
    readonly files: readonly { readonly filename: string; readonly status: string }[];
  };
  readonly forceFirstBlobWrongSha?: boolean;
}

type CombinedInit = GitHubFetchInit | GitHubWriteFetchInit;

function fakeStore(options: FakeStoreOptions = {}): {
  readonly fetch: (url: string, init: CombinedInit) => Promise<Response>;
  readonly calls: RecordedCall[];
  readonly sleeps: number[];
  readonly sleep: (ms: number) => Promise<void>;
} {
  const calls: RecordedCall[] = [];
  const sleeps: number[] = [];
  const sleep = (ms: number): Promise<void> => {
    sleeps.push(ms);
    return Promise.resolve();
  };

  let tip = options.initialTip === undefined ? TIP : options.initialTip;
  let tipTree = options.initialTree ?? TIP_TREE;
  const refQueue = [...(options.refOutcomes ?? [{ conflict: false }])];
  let counter = 3;
  let blobCallCount = 0;
  let lastTreePaths: string[] = [];

  function nextId(): string {
    const id = counter.toString(16).padStart(40, '0');
    counter += 1;
    return id;
  }

  const fetch = async (url: string, init: CombinedInit): Promise<Response> => {
    const parsed = new URL(url);
    const body = 'body' in init && init.body !== undefined ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    calls.push({ method: init.method, path: parsed.pathname + parsed.search, body });
    const pathname = parsed.pathname;

    if (init.method === 'GET' && pathname === '/repos/octo/demo/git/ref/heads/steward-evidence') {
      if (tip === null) {
        return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
      }
      return new Response(JSON.stringify({ ref: 'refs/heads/steward-evidence', object: { sha: tip, type: 'commit' } }), {
        status: 200,
      });
    }
    const commitMatch = /^\/repos\/octo\/demo\/git\/commits\/([0-9a-f]{40})$/.exec(pathname);
    if (init.method === 'GET' && commitMatch) {
      const sha = commitMatch[1];
      return new Response(JSON.stringify({ sha, tree: { sha: tipTree }, parents: [] }), { status: 200 });
    }
    if (init.method === 'POST' && pathname === '/repos/octo/demo/git/blobs') {
      const content = String(body?.['content']);
      blobCallCount += 1;
      const sha =
        options.forceFirstBlobWrongSha === true && blobCallCount === 1 ? 'a'.repeat(40) : gitBlobId(Buffer.from(content, 'base64'));
      return new Response(JSON.stringify({ sha }), { status: 201 });
    }
    if (init.method === 'POST' && pathname === '/repos/octo/demo/git/trees') {
      const tree = body?.['tree'] as { readonly path: string }[];
      lastTreePaths = tree.map((entry) => entry.path);
      return new Response(JSON.stringify({ sha: nextId() }), { status: 201 });
    }
    if (init.method === 'POST' && pathname === '/repos/octo/demo/git/commits') {
      const parents = body?.['parents'] as string[];
      return new Response(
        JSON.stringify({ sha: nextId(), tree: { sha: body?.['tree'] }, parents: parents.map((sha) => ({ sha })) }),
        { status: 201 },
      );
    }
    const compareMatch = /^\/repos\/octo\/demo\/compare\/([0-9a-f]{40})\.\.\.([0-9a-f]{40})$/.exec(pathname);
    if (init.method === 'GET' && compareMatch) {
      if (options.compareOverride) {
        return new Response(JSON.stringify(options.compareOverride), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          status: 'ahead',
          ahead_by: 1,
          behind_by: 0,
          files: lastTreePaths.map((filename) => ({ filename, status: 'added' })),
        }),
        { status: 200 },
      );
    }
    if (
      (init.method === 'PATCH' && pathname === '/repos/octo/demo/git/refs/heads/steward-evidence') ||
      (init.method === 'POST' && pathname === '/repos/octo/demo/git/refs')
    ) {
      const outcome = refQueue.shift() ?? { conflict: false };
      if (outcome.conflict) {
        if (outcome.moveTip) {
          tip = outcome.moveTip.sha;
          tipTree = outcome.moveTip.tree;
        }
        return new Response(JSON.stringify({ message: 'Update is not a fast forward' }), { status: 422 });
      }
      const sha = String(body?.['sha']);
      tip = sha;
      return new Response(JSON.stringify({ ref: 'refs/heads/steward-evidence', object: { sha, type: 'commit' } }), {
        status: init.method === 'PATCH' ? 200 : 201,
      });
    }
    throw new Error(`unhandled request ${init.method} ${pathname}`);
  };

  return { fetch, calls, sleeps, sleep };
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function standardGroups(): EvidenceStoreGroup[] {
  return [
    {
      directory: 'runs/pr-12/36081628326-1',
      mode: 'exact',
      files: [
        { path: 'run.json', bytes: encode('{"run":true}') },
        { path: 'logs/steward.txt', bytes: encode('log') },
        { path: 'manifest.json', bytes: encode('{"manifest":true}') },
      ],
    },
    { directory: 'metrics/2026-09', mode: 'contains', files: [{ path: '36081628326-1.json', bytes: encode('{}') }] },
  ];
}

function standardInput(overrides: Partial<EvidenceCommitInput> = {}): EvidenceCommitInput {
  return {
    store: STORE,
    targetRepository: 'octo/demo',
    subject: { type: 'pull_request', number: 12 },
    runId: 36081628326,
    runAttempt: 1,
    groups: standardGroups(),
    maxBytes: 1048576,
    writeRetries: 3,
    ...overrides,
  };
}

function createDeps(
  fake: ReturnType<typeof fakeStore>,
  budgetLimits: { readonly requests: number; readonly retriesPerRequest: number } = { requests: 100, retriesPerRequest: 0 },
): { readonly client: ReturnType<typeof createGitHubClient>; readonly writer: ReturnType<typeof createGitHubWriter> } {
  const budget = createGitHubBudget(budgetLimits);
  const client = createGitHubClient({
    token: TOKEN,
    budget,
    fetch: fake.fetch as unknown as GitHubFetch,
    sleep: fake.sleep,
  });
  const writer = createGitHubWriter({
    token: TOKEN,
    scope: { kind: 'installation', store: STORE },
    budget,
    fetch: fake.fetch as unknown as GitHubWriteFetch,
    sleep: fake.sleep,
  });
  return { client, writer };
}

const RUN_PATHS = [
  'octo/demo/runs/pr-12/36081628326-1/run.json',
  'octo/demo/runs/pr-12/36081628326-1/logs/steward.txt',
  'octo/demo/runs/pr-12/36081628326-1/manifest.json',
  'octo/demo/metrics/2026-09/36081628326-1.json',
].sort();

describe('evidence git store commit', () => {
  it('evidence commits add blobs, a tree, a commit, and a ref update', async () => {
    const fake = fakeStore();
    const { client, writer } = createDeps(fake);
    const result = await commitEvidence(standardInput(), { client, writer, sleep: fake.sleep });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fake.calls.map((call) => call.method)).toEqual([
      'GET',
      'GET',
      'POST',
      'POST',
      'POST',
      'POST',
      'POST',
      'POST',
      'GET',
      'PATCH',
    ]);
    const treeCall = fake.calls[6];
    expect(treeCall?.path).toBe('/repos/octo/demo/git/trees');
    const treeBody = treeCall?.body as { base_tree: string; tree: { path: string; mode: string; type: string; sha: string }[] };
    expect(treeBody.base_tree).toBe(TIP_TREE);
    expect(treeBody.tree).toHaveLength(4);
    for (const entry of treeBody.tree) {
      expect(entry.mode).toBe('100644');
      expect(entry.type).toBe('blob');
    }
    expect(treeBody.tree.map((entry) => entry.path).sort()).toEqual(RUN_PATHS);
    const commitCall = fake.calls[7];
    const commitBody = commitCall?.body as { message: string; parents: string[] };
    expect(commitBody.message).toBe('evidence: octo/demo pr-12 run 36081628326-1');
    expect(commitBody.parents).toEqual([TIP]);
    const patchCall = fake.calls[9];
    expect(patchCall?.path).toBe('/repos/octo/demo/git/refs/heads/steward-evidence');
    expect(patchCall?.body).toEqual({ sha: result.value.commit, force: false });
    expect(result.value.parent).toBe(TIP);
    expect(result.value.rebuilds).toBe(0);
    expect([...result.value.paths]).toEqual(RUN_PATHS);
  });

  it('an absent branch gets a root commit', async () => {
    const fake = fakeStore({ initialTip: null });
    const { client, writer } = createDeps(fake);
    const result = await commitEvidence(standardInput(), { client, writer, sleep: fake.sleep });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fake.calls.map((call) => call.method + ' ' + call.path)).not.toContain('GET /repos/octo/demo/git/commits/' + TIP);
    expect(fake.calls.some((call) => call.path.startsWith('/repos/octo/demo/compare/'))).toBe(false);
    const treeCall = fake.calls.find((call) => call.path === '/repos/octo/demo/git/trees');
    expect(treeCall?.body).not.toHaveProperty('base_tree');
    const commitCall = fake.calls.find((call) => call.path === '/repos/octo/demo/git/commits');
    expect((commitCall?.body as { parents: unknown[] }).parents).toEqual([]);
    const refCall = fake.calls.find((call) => call.method === 'POST' && call.path === '/repos/octo/demo/git/refs');
    expect(refCall?.body).toEqual({ ref: 'refs/heads/steward-evidence', sha: result.value.commit });
    expect(result.value.parent).toBeNull();
  });

  it('a non-fast-forward update rebuilds on the new tip', async () => {
    const newTip = '5'.repeat(40);
    const newTipTree = '6'.repeat(40);
    const fake = fakeStore({ refOutcomes: [{ conflict: true, moveTip: { sha: newTip, tree: newTipTree } }, { conflict: false }] });
    const { client, writer } = createDeps(fake);
    const result = await commitEvidence(standardInput(), { client, writer, sleep: fake.sleep });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const blobCalls = fake.calls.filter((call) => call.path === '/repos/octo/demo/git/blobs');
    expect(blobCalls).toHaveLength(4);
    const treeCalls = fake.calls.filter((call) => call.path === '/repos/octo/demo/git/trees');
    expect(treeCalls).toHaveLength(2);
    expect((treeCalls[1]?.body as { base_tree: string }).base_tree).toBe(newTipTree);
    const commitCalls = fake.calls.filter((call) => call.path === '/repos/octo/demo/git/commits');
    expect((commitCalls[1]?.body as { parents: string[] }).parents).toEqual([newTip]);
    expect(fake.sleeps).toEqual([1000]);
    expect(result.value.rebuilds).toBe(1);
  });

  it('exhausted rebuilds end in a store conflict', async () => {
    const fake = fakeStore({ refOutcomes: [{ conflict: true }, { conflict: true }, { conflict: true }] });
    const { client, writer } = createDeps(fake);
    const result = await commitEvidence(standardInput({ writeRetries: 2 }), { client, writer, sleep: fake.sleep });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('evidence.store-conflict');
    expect(result.failure.outcome).toBe('inconclusive');
    const patchCalls = fake.calls.filter((call) => call.method === 'PATCH');
    expect(patchCalls).toHaveLength(3);
    expect(fake.sleeps).toEqual([1000, 2000]);
  });

  it('a compare that is not append-only stops before the update', async () => {
    const fake = fakeStore({
      compareOverride: {
        status: 'ahead',
        ahead_by: 1,
        behind_by: 0,
        files: [{ filename: RUN_PATHS[0] as string, status: 'modified' }],
      },
    });
    const { client, writer } = createDeps(fake);
    const result = await commitEvidence(standardInput(), { client, writer, sleep: fake.sleep });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('evidence.store-not-append-only');
    expect(fake.calls.some((call) => call.method === 'PATCH' || (call.method === 'POST' && call.path.endsWith('/git/refs')))).toBe(
      false,
    );
  });

  it('a created blob with another id is a mismatch', async () => {
    const fake = fakeStore({ forceFirstBlobWrongSha: true });
    const { client, writer } = createDeps(fake);
    const result = await commitEvidence(standardInput(), { client, writer, sleep: fake.sleep });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('evidence.readback-mismatch');
    expect(result.failure.details[0]?.path).toBe('blob-create');
    expect(fake.calls.some((call) => call.path === '/repos/octo/demo/git/trees')).toBe(false);
  });

  it('the commit layout is validated before any request', async () => {
    const cases: Partial<EvidenceCommitInput>[] = [
      { groups: [{ directory: 'runs/pr-12/../x', mode: 'contains', files: [{ path: 'a.json', bytes: encode('{}') }] }] },
      {
        groups: [{ directory: 'runs/pr-13/36081628326-1', mode: 'exact', files: [{ path: 'run.json', bytes: encode('{}') }] }],
      },
      {
        groups: [{ directory: 'runs/pr-12/36081628326-2', mode: 'exact', files: [{ path: 'run.json', bytes: encode('{}') }] }],
      },
      {
        groups: [{ directory: 'runs/pr-12/36081628326-1', mode: 'exact', files: [{ path: '../run.json', bytes: encode('{}') }] }],
      },
      {
        groups: [{ directory: 'runs/pr-12/36081628326-1', mode: 'exact', files: [{ path: 'a/b/c.json', bytes: encode('{}') }] }],
      },
      {
        groups: [
          {
            directory: 'runs/pr-12/36081628326-1',
            mode: 'exact',
            files: [
              { path: 'run.json', bytes: encode('{}') },
              { path: 'run.json', bytes: encode('{}') },
            ],
          },
        ],
      },
      {
        groups: [{ directory: 'runs/pr-12/36081628326-1', mode: 'contains', files: [{ path: 'run.json', bytes: encode('{}') }] }],
      },
      { groups: [{ directory: 'metrics/2026-09', mode: 'exact', files: [{ path: 'a.json', bytes: encode('{}') }] }] },
      { groups: [{ directory: 'metrics/2026-13', mode: 'contains', files: [{ path: 'a.json', bytes: encode('{}') }] }] },
      { groups: [] },
      { store: { ...STORE, branch: 'bad..branch' } },
      { targetRepository: 'not-a-repository' },
    ];
    for (const overrides of cases) {
      const fake = fakeStore();
      const { client, writer } = createDeps(fake);
      const result = await commitEvidence(standardInput(overrides), { client, writer, sleep: fake.sleep });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.failure.code).toBe('evidence.layout-invalid');
      expect(fake.calls).toHaveLength(0);
    }
  });

  it('evidence over the byte or file limit is rejected', async () => {
    const fakeBytes = fakeStore();
    const depsBytes = createDeps(fakeBytes);
    const tooLarge = await commitEvidence(standardInput({ maxBytes: 10 }), {
      client: depsBytes.client,
      writer: depsBytes.writer,
      sleep: fakeBytes.sleep,
    });
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) {
      expect(tooLarge.failure.code).toBe('evidence.too-large');
      expect(tooLarge.failure.cause).toBe('budget-exhausted');
    }
    expect(fakeBytes.calls).toHaveLength(0);

    const manyFiles = Array.from({ length: 4099 }, (_, index) => ({ path: `${index}.json`, bytes: encode('{}') }));
    const fakeFiles = fakeStore();
    const depsFiles = createDeps(fakeFiles);
    const tooMany = await commitEvidence(
      standardInput({ groups: [{ directory: 'metrics/2026-09', mode: 'contains', files: manyFiles }] }),
      { client: depsFiles.client, writer: depsFiles.writer, sleep: fakeFiles.sleep },
    );
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) {
      expect(tooMany.failure.code).toBe('evidence.too-many-files');
    }
    expect(fakeFiles.calls).toHaveLength(0);
  });

  it('the commit message carries no submission text', () => {
    expect(evidenceCommitMessage('octo/demo', { type: 'issue', number: 7 }, 5, 2)).toBe('evidence: octo/demo issue-7 run 5-2');
  });

  it('the store location follows the trusted policy', () => {
    const orphan = evidenceStoreLocation({ type: 'orphan-branch', branch: 'steward-evidence' }, 'octo/demo');
    expect(orphan.ok).toBe(true);
    if (orphan.ok) {
      expect(orphan.value).toEqual({ repository: { owner: 'octo', name: 'demo' }, branch: 'steward-evidence' });
    }
    const repository = evidenceStoreLocation({ type: 'repository', branch: 'main', repository: 'octo/evidence' }, 'octo/demo');
    expect(repository.ok).toBe(true);
    if (repository.ok) {
      expect(repository.value).toEqual({ repository: { owner: 'octo', name: 'evidence' }, branch: 'main' });
    }
    const invalid = evidenceStoreLocation({ type: 'orphan-branch', branch: 'steward-evidence' }, 'x');
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.failure.code).toBe('evidence.layout-invalid');
    }
  });

  it('hosted evidence locations point at the store tree', () => {
    expect(
      hostedEvidenceLocation(
        { repository: { owner: 'octo', name: 'evidence' }, branch: 'steward-evidence' },
        'octo/demo',
        'runs/pr-12/36081628326-1',
      ),
    ).toBe('https://github.com/octo/evidence/tree/steward-evidence/octo/demo/runs/pr-12/36081628326-1');
  });

  it('store requests count against the run budget', async () => {
    const fake = fakeStore();
    const { client, writer } = createDeps(fake, { requests: 5, retriesPerRequest: 0 });
    const result = await commitEvidence(standardInput(), { client, writer, sleep: fake.sleep });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.budget-exhausted');
    }
    expect(fake.calls).toHaveLength(5);
  });
});
