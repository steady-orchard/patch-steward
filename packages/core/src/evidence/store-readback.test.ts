import { describe, expect, it } from 'vitest';

import { createGitHubBudget } from '../github/budget.js';
import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch, GitHubFetchInit } from '../github/client.js';
import { createGitHubWriter } from '../github/writer.js';
import type { GitHubWriteFetch, GitHubWriteFetchInit } from '../github/writer.js';
import { gitBlobId } from './blob-id.js';
import type { EvidenceCommitInput, EvidenceStoreGroup, EvidenceStoreLocation } from './git-store.js';
import { readBackEvidence, writeEvidenceCommit } from './store-readback.js';

const STORE: EvidenceStoreLocation = { repository: { owner: 'octo', name: 'demo' }, branch: 'steward-evidence' };
const TOKEN = 'test-token-' + 's'.repeat(12);
const COMMIT = '1'.repeat(40);
const OTHER_HEAD = '5'.repeat(40);
const TIP_TREE = '2'.repeat(40);

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

interface TreeEntry {
  readonly path: string;
  readonly mode: string;
  readonly type: string;
  readonly sha: string;
}

function defaultRunEntries(): TreeEntry[] {
  return [
    { path: 'logs', mode: '040000', type: 'tree', sha: 'd'.repeat(40) },
    { path: 'run.json', mode: '100644', type: 'blob', sha: gitBlobId(encode('{"run":true}')) },
    { path: 'logs/steward.txt', mode: '100644', type: 'blob', sha: gitBlobId(encode('log')) },
    { path: 'manifest.json', mode: '100644', type: 'blob', sha: gitBlobId(encode('{"manifest":true}')) },
  ];
}

function defaultMetricsEntries(): TreeEntry[] {
  return [{ path: '36081628326-1.json', mode: '100644', type: 'blob', sha: gitBlobId(encode('{}')) }];
}

interface RecordedCall {
  readonly method: string;
  readonly path: string;
}

interface FakeReadBackOptions {
  readonly headSha?: string;
  readonly compareAnswer?: { readonly status: string; readonly ahead_by: number; readonly behind_by: number; readonly files: [] };
  readonly runEntries?: TreeEntry[];
  readonly metricsEntries?: TreeEntry[];
  readonly runTruncated?: boolean;
}

function fakeReadBack(options: FakeReadBackOptions = {}): {
  readonly fetch: GitHubFetch;
  readonly calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const headSha = options.headSha ?? COMMIT;
  const runEntries = options.runEntries ?? defaultRunEntries();
  const metricsEntries = options.metricsEntries ?? defaultMetricsEntries();
  const runTruncated = options.runTruncated ?? false;

  const fetch = async (url: string, init: GitHubFetchInit): Promise<Response> => {
    const parsed = new URL(url);
    calls.push({ method: init.method, path: parsed.pathname + parsed.search });
    const pathname = parsed.pathname;

    if (init.method === 'GET' && pathname === '/repos/octo/demo/git/ref/heads/steward-evidence') {
      return new Response(JSON.stringify({ ref: 'refs/heads/steward-evidence', object: { sha: headSha, type: 'commit' } }), {
        status: 200,
      });
    }
    const compareMatch = /^\/repos\/octo\/demo\/compare\/([0-9a-f]{40})\.\.\.([0-9a-f]{40})$/.exec(pathname);
    if (init.method === 'GET' && compareMatch && options.compareAnswer) {
      return new Response(JSON.stringify(options.compareAnswer), { status: 200 });
    }
    const treeMatch = /^\/repos\/octo\/demo\/git\/trees\/(?:[0-9a-f]{40}|[0-9a-f]{64}):(.+)$/.exec(pathname);
    if (init.method === 'GET' && treeMatch) {
      const path = treeMatch[1] as string;
      if (path === 'octo/demo/runs/pr-12/36081628326-1') {
        return new Response(JSON.stringify({ sha: 'a'.repeat(40), url: '', truncated: runTruncated, tree: runEntries }), {
          status: 200,
        });
      }
      if (path === 'octo/demo/metrics/2026-09') {
        return new Response(JSON.stringify({ sha: 'b'.repeat(40), url: '', truncated: false, tree: metricsEntries }), {
          status: 200,
        });
      }
    }
    throw new Error(`unhandled request ${init.method} ${pathname}`);
  };

  return { fetch: fetch as unknown as GitHubFetch, calls };
}

function createReadBackClient(fake: { readonly fetch: GitHubFetch }): ReturnType<typeof createGitHubClient> {
  const budget = createGitHubBudget({ requests: 100, retriesPerRequest: 0 });
  return createGitHubClient({ token: TOKEN, budget, fetch: fake.fetch });
}

describe('evidence store read-back', () => {
  it('a committed run reads back with matching blob ids', async () => {
    const fake = fakeReadBack();
    const client = createReadBackClient(fake);
    const result = await readBackEvidence(
      client,
      { store: STORE, targetRepository: 'octo/demo', groups: standardGroups() },
      COMMIT,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ head: COMMIT, files: 4 });
    }
    expect(fake.calls.map((call) => call.path)).toEqual([
      '/repos/octo/demo/git/ref/heads/steward-evidence',
      `/repos/octo/demo/git/trees/${COMMIT}:octo/demo/runs/pr-12/36081628326-1?recursive=1`,
      `/repos/octo/demo/git/trees/${COMMIT}:octo/demo/metrics/2026-09`,
    ]);
  });

  it('a tip that moved ahead still reads back', async () => {
    const fake = fakeReadBack({
      headSha: OTHER_HEAD,
      compareAnswer: { status: 'ahead', ahead_by: 1, behind_by: 0, files: [] },
    });
    const client = createReadBackClient(fake);
    const result = await readBackEvidence(
      client,
      { store: STORE, targetRepository: 'octo/demo', groups: standardGroups() },
      COMMIT,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.head).toBe(OTHER_HEAD);
    }
  });

  it('a diverged tip fails the read-back', async () => {
    const fake = fakeReadBack({
      headSha: OTHER_HEAD,
      compareAnswer: { status: 'diverged', ahead_by: 1, behind_by: 1, files: [] },
    });
    const client = createReadBackClient(fake);
    const result = await readBackEvidence(
      client,
      { store: STORE, targetRepository: 'octo/demo', groups: standardGroups() },
      COMMIT,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.readback-mismatch');
      expect(result.failure.details[0]?.path).toBe('tip');
    }
  });

  it('a changed blob id fails the read-back', async () => {
    const runEntries = defaultRunEntries().map((entry) =>
      entry.path === 'manifest.json' ? { ...entry, sha: 'f'.repeat(40) } : entry,
    );
    const fake = fakeReadBack({ runEntries });
    const client = createReadBackClient(fake);
    const result = await readBackEvidence(
      client,
      { store: STORE, targetRepository: 'octo/demo', groups: standardGroups() },
      COMMIT,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.readback-mismatch');
      expect(result.failure.details[0]?.path).toBe('blob-id');
    }
  });

  it('a missing or extra run file fails the read-back', async () => {
    const missingEntries = defaultRunEntries().filter((entry) => entry.path !== 'run.json');
    const missingFake = fakeReadBack({ runEntries: missingEntries });
    const missingClient = createReadBackClient(missingFake);
    const missingResult = await readBackEvidence(
      missingClient,
      { store: STORE, targetRepository: 'octo/demo', groups: standardGroups() },
      COMMIT,
    );
    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.failure.details[0]?.path).toBe('missing');
    }

    const extraRunEntries = [...defaultRunEntries(), { path: 'extra.json', mode: '100644', type: 'blob', sha: 'c'.repeat(40) }];
    const extraFake = fakeReadBack({ runEntries: extraRunEntries });
    const extraClient = createReadBackClient(extraFake);
    const extraResult = await readBackEvidence(
      extraClient,
      { store: STORE, targetRepository: 'octo/demo', groups: standardGroups() },
      COMMIT,
    );
    expect(extraResult.ok).toBe(false);
    if (!extraResult.ok) {
      expect(extraResult.failure.details[0]?.path).toBe('extra');
    }

    const extraMetricsEntries = [
      ...defaultMetricsEntries(),
      { path: 'other.json', mode: '100644', type: 'blob', sha: 'e'.repeat(40) },
    ];
    const acceptedFake = fakeReadBack({ metricsEntries: extraMetricsEntries });
    const acceptedClient = createReadBackClient(acceptedFake);
    const acceptedResult = await readBackEvidence(
      acceptedClient,
      { store: STORE, targetRepository: 'octo/demo', groups: standardGroups() },
      COMMIT,
    );
    expect(acceptedResult.ok).toBe(true);
  });

  it('a truncated tree read fails the read-back', async () => {
    const fake = fakeReadBack({ runTruncated: true });
    const client = createReadBackClient(fake);
    const result = await readBackEvidence(
      client,
      { store: STORE, targetRepository: 'octo/demo', groups: standardGroups() },
      COMMIT,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.details[0]?.path).toBe('truncated');
    }
  });

  interface RefOutcome {
    readonly conflict: boolean;
  }

  interface FakeWriteStoreOptions {
    readonly refOutcomes?: readonly RefOutcome[];
    readonly compareOverride?: {
      readonly status: string;
      readonly ahead_by: number;
      readonly behind_by: number;
      readonly files: readonly { readonly filename: string; readonly status: string }[];
    };
  }

  type CombinedInit = GitHubFetchInit | GitHubWriteFetchInit;

  function fakeWriteStore(options: FakeWriteStoreOptions = {}): {
    readonly fetch: (url: string, init: CombinedInit) => Promise<Response>;
    readonly calls: RecordedCall[];
    readonly sleep: (ms: number) => Promise<void>;
  } {
    const calls: RecordedCall[] = [];
    const sleep = (): Promise<void> => Promise.resolve();
    let tip: string | null = '1'.repeat(40);
    const tipTree = TIP_TREE;
    const refQueue = [...(options.refOutcomes ?? [{ conflict: false }])];
    let counter = 3;
    let lastTreePaths: string[] = [];

    function nextId(): string {
      const id = counter.toString(16).padStart(40, '0');
      counter += 1;
      return id;
    }

    const fetch = async (url: string, init: CombinedInit): Promise<Response> => {
      const parsed = new URL(url);
      const body = 'body' in init && init.body !== undefined ? (JSON.parse(init.body) as Record<string, unknown>) : null;
      calls.push({ method: init.method, path: parsed.pathname + parsed.search });
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
        const sha = gitBlobId(Buffer.from(content, 'base64'));
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
          return new Response(JSON.stringify({ message: 'Update is not a fast forward' }), { status: 422 });
        }
        const sha = String(body?.['sha']);
        tip = sha;
        return new Response(JSON.stringify({ ref: 'refs/heads/steward-evidence', object: { sha, type: 'commit' } }), {
          status: init.method === 'PATCH' ? 200 : 201,
        });
      }
      const treeMatch = /^\/repos\/octo\/demo\/git\/trees\/(?:[0-9a-f]{40}|[0-9a-f]{64}):(.+)$/.exec(pathname);
      if (init.method === 'GET' && treeMatch) {
        const path = treeMatch[1] as string;
        if (path === 'octo/demo/runs/pr-12/36081628326-1') {
          return new Response(JSON.stringify({ sha: 'a'.repeat(40), url: '', truncated: false, tree: defaultRunEntries() }), {
            status: 200,
          });
        }
        if (path === 'octo/demo/metrics/2026-09') {
          return new Response(JSON.stringify({ sha: 'b'.repeat(40), url: '', truncated: false, tree: defaultMetricsEntries() }), {
            status: 200,
          });
        }
      }
      throw new Error(`unhandled request ${init.method} ${pathname}`);
    };

    return { fetch, calls, sleep };
  }

  function standardCommitInput(): EvidenceCommitInput {
    return {
      store: STORE,
      targetRepository: 'octo/demo',
      subject: { type: 'pull_request', number: 12 },
      runId: 36081628326,
      runAttempt: 1,
      groups: standardGroups(),
      maxBytes: 1048576,
      writeRetries: 3,
    };
  }

  function createWriteDeps(fake: ReturnType<typeof fakeWriteStore>): {
    readonly client: ReturnType<typeof createGitHubClient>;
    readonly writer: ReturnType<typeof createGitHubWriter>;
  } {
    const budget = createGitHubBudget({ requests: 100, retriesPerRequest: 0 });
    const client = createGitHubClient({ token: TOKEN, budget, fetch: fake.fetch as unknown as GitHubFetch, sleep: fake.sleep });
    const writer = createGitHubWriter({
      token: TOKEN,
      scope: { kind: 'installation', store: STORE },
      budget,
      fetch: fake.fetch as unknown as GitHubWriteFetch,
      sleep: fake.sleep,
    });
    return { client, writer };
  }

  it('written evidence is read back after the ref update', async () => {
    const fake = fakeWriteStore();
    const { client, writer } = createWriteDeps(fake);
    const result = await writeEvidenceCommit(standardCommitInput(), { client, writer, sleep: fake.sleep });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.head).toBe(result.value.commit);
      expect(result.value.rebuilds).toBe(0);
    }
    const patchIndex = fake.calls.findIndex((call) => call.method === 'PATCH');
    const firstTreeReadIndex = fake.calls.findIndex((call) => call.path.includes(':octo/demo/'));
    expect(patchIndex).toBeGreaterThanOrEqual(0);
    expect(firstTreeReadIndex).toBeGreaterThan(patchIndex);
    const refReadsAfterPatch = fake.calls
      .slice(patchIndex + 1)
      .filter((call) => call.method === 'GET' && call.path === '/repos/octo/demo/git/ref/heads/steward-evidence');
    expect(refReadsAfterPatch.length).toBeGreaterThanOrEqual(1);
  });

  it('a failed commit skips the read-back', async () => {
    const fake = fakeWriteStore({
      compareOverride: {
        status: 'ahead',
        ahead_by: 1,
        behind_by: 0,
        files: [{ filename: 'octo/demo/runs/pr-12/36081628326-1/run.json', status: 'modified' }],
      },
    });
    const { client, writer } = createWriteDeps(fake);
    const result = await writeEvidenceCommit(standardCommitInput(), { client, writer, sleep: fake.sleep });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.store-not-append-only');
    }
    expect(fake.calls.some((call) => call.path.includes(':octo/demo/'))).toBe(false);
  });
});
