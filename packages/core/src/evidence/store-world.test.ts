import { describe, expect, it } from 'vitest';

import { createGitHubBudget } from '../github/budget.js';
import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch } from '../github/client.js';
import { createGitHubWriter } from '../github/writer.js';
import type { GitHubWriteFetch } from '../github/writer.js';
import { runRecordSchema } from '../records/run.js';
import type { SubmissionType } from '../vocabulary.js';
import { gitBlobId } from './blob-id.js';
import { commitEvidence } from './git-store.js';
import type { EvidenceCommitInput, EvidenceStoreGroup, EvidenceStoreLocation } from './git-store.js';
import { writeEvidenceCommit } from './store-readback.js';
import { readPublishedSnapshot } from './fallback-read.js';

// A shared in-memory fake of GitHub's Git Data API, so tests can drive the real evidence-store
// adapters (commitEvidence, readBackEvidence, readPublishedSnapshot) without a network.

export const STORE_WORLD_BRANCH = 'steward-evidence';

export interface StoreWorldRequest {
  readonly method: string;
  readonly url: URL;
  readonly body: unknown;
}

export type StoreWorldHandler = (request: StoreWorldRequest) => Response | undefined;

export interface StoreWorld {
  readonly handler: StoreWorldHandler;
  head(repository: string): string | null;
  files(repository: string): ReadonlyMap<string, Uint8Array>;
  commitCount(repository: string): number;
  advance(repository: string, files: Readonly<Record<string, Uint8Array>>): string;
}

interface StoredCommit {
  readonly tree: string;
  readonly parents: readonly string[];
  readonly message: string;
}

interface RepoState {
  head: string | null;
  readonly blobs: Map<string, Uint8Array>;
  readonly trees: Map<string, Map<string, string>>;
  readonly commits: Map<string, StoredCommit>;
}

function newRepoState(): RepoState {
  return { head: null, blobs: new Map(), trees: new Map(), commits: new Map() };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function computeTreeId(entries: ReadonlyMap<string, string>): string {
  const lines = [...entries.entries()].map(([path, sha]) => `${path} ${sha}`).sort();
  return gitBlobId(Buffer.from(`tree\n${lines.join('\n')}`));
}

function computeCommitId(tree: string, parents: readonly string[], message: string): string {
  return gitBlobId(Buffer.from(`commit\n${tree}\n${parents.join(',')}\n${message}`));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const REPO_PATH = /^\/repos\/([^/]+)\/([^/]+)\/(.+)$/;
const DUMMY_TREE_SHA = 'a'.repeat(40);

function reachableCount(commits: ReadonlyMap<string, StoredCommit>, head: string | null): number {
  if (head === null) return 0;
  const seen = new Set<string>();
  const stack = [head];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const commit = commits.get(id);
    if (commit) {
      for (const parent of commit.parents) stack.push(parent);
    }
  }
  return seen.size;
}

function firstParentDistance(commits: ReadonlyMap<string, StoredCommit>, from: string, to: string): number | null {
  let current: string | null = from;
  let distance = 0;
  while (current !== null) {
    if (current === to) return distance;
    const commit = commits.get(current);
    current = commit && commit.parents.length > 0 ? (commit.parents[0] as string) : null;
    distance += 1;
    if (distance > 100000) return null;
  }
  return null;
}

function treeDiff(
  baseMap: ReadonlyMap<string, string>,
  headMap: ReadonlyMap<string, string>,
): { filename: string; status: string }[] {
  const files: { filename: string; status: string }[] = [];
  for (const [path, sha] of headMap.entries()) {
    const baseSha = baseMap.get(path);
    if (baseSha === undefined) {
      files.push({ filename: path, status: 'added' });
    } else if (baseSha !== sha) {
      files.push({ filename: path, status: 'modified' });
    }
  }
  for (const path of baseMap.keys()) {
    if (!headMap.has(path)) {
      files.push({ filename: path, status: 'removed' });
    }
  }
  return files;
}

function directoryListing(
  treeMap: ReadonlyMap<string, string>,
  prefix: string,
  recursive: boolean,
): { path: string; mode: string; type: string; sha: string; size?: number }[] | null {
  const entries: { path: string; mode: string; type: string; sha: string; size?: number }[] = [];
  const dirs = new Set<string>();
  let found = false;
  for (const [fullPath, sha] of treeMap.entries()) {
    if (!fullPath.startsWith(prefix)) continue;
    found = true;
    const relative = fullPath.slice(prefix.length);
    const slashIndex = relative.indexOf('/');
    if (slashIndex === -1) {
      entries.push({ path: relative, mode: '100644', type: 'blob', sha, size: 0 });
    } else if (recursive) {
      entries.push({ path: relative, mode: '100644', type: 'blob', sha, size: 0 });
      const segments = relative.slice(0, slashIndex).split('/');
      let accumulated = '';
      for (const segment of segments) {
        accumulated = accumulated === '' ? segment : `${accumulated}/${segment}`;
        dirs.add(accumulated);
      }
    } else {
      dirs.add(relative.slice(0, slashIndex));
    }
  }
  if (!found) return null;
  for (const dirName of dirs) {
    if (!recursive && dirName.includes('/')) continue;
    entries.push({ path: dirName, mode: '040000', type: 'tree', sha: DUMMY_TREE_SHA });
  }
  return entries;
}

export function createStoreWorld(options?: { readonly branch?: string }): StoreWorld {
  const branch = options?.branch ?? STORE_WORLD_BRANCH;
  const repos = new Map<string, RepoState>();

  function getRepo(key: string, create: boolean): RepoState | null {
    let state = repos.get(key);
    if (state === undefined) {
      if (!create) return null;
      state = newRepoState();
      repos.set(key, state);
    }
    return state;
  }

  function repoFullTree(state: RepoState): Map<string, string> {
    if (state.head === null) return new Map();
    const commit = state.commits.get(state.head);
    if (!commit) return new Map();
    return state.trees.get(commit.tree) ?? new Map();
  }

  function advance(repository: string, files: Readonly<Record<string, Uint8Array>>): string {
    const state = getRepo(repository, true) as RepoState;
    const baseMap = repoFullTree(state);
    const newMap = new Map(baseMap);
    for (const [path, bytes] of Object.entries(files)) {
      const sha = gitBlobId(bytes);
      state.blobs.set(sha, bytes);
      newMap.set(path, sha);
    }
    const treeId = computeTreeId(newMap);
    state.trees.set(treeId, newMap);
    const parents = state.head !== null ? [state.head] : [];
    const commitId = computeCommitId(treeId, parents, 'advance');
    state.commits.set(commitId, { tree: treeId, parents, message: 'advance' });
    state.head = commitId;
    return commitId;
  }

  function handler(request: StoreWorldRequest): Response | undefined {
    const { method, url, body } = request;
    const match = REPO_PATH.exec(url.pathname);
    if (match === null) return undefined;
    const owner = decodeURIComponent(match[1] as string);
    const name = decodeURIComponent(match[2] as string);
    const repository = `${owner}/${name}`;
    const rest = match[3] as string;

    if (method === 'POST' && rest === 'git/blobs') {
      const state = getRepo(repository, true) as RepoState;
      const record = body as { content: string; encoding: string };
      const bytes = new Uint8Array(Buffer.from(record.content, 'base64'));
      const sha = gitBlobId(bytes);
      state.blobs.set(sha, bytes);
      return jsonResponse(201, { sha });
    }

    if (method === 'POST' && rest === 'git/trees') {
      const state = getRepo(repository, true) as RepoState;
      const record = body as { base_tree?: string; tree: { path: string; sha: string }[] };
      let baseMap = new Map<string, string>();
      if (record.base_tree !== undefined) {
        const found = state.trees.get(record.base_tree);
        if (found === undefined) {
          return jsonResponse(422, { message: 'Not found' });
        }
        baseMap = new Map(found);
      }
      for (const entry of record.tree) {
        baseMap.set(entry.path, entry.sha);
      }
      const treeId = computeTreeId(baseMap);
      state.trees.set(treeId, baseMap);
      return jsonResponse(201, { sha: treeId, truncated: false, tree: [] });
    }

    if (method === 'POST' && rest === 'git/commits') {
      const state = getRepo(repository, true) as RepoState;
      const record = body as { message: string; tree: string; parents: string[] };
      const commitId = computeCommitId(record.tree, record.parents, record.message);
      state.commits.set(commitId, { tree: record.tree, parents: record.parents, message: record.message });
      return jsonResponse(201, {
        sha: commitId,
        tree: { sha: record.tree },
        parents: record.parents.map((sha) => ({ sha })),
        message: record.message,
      });
    }

    const commitGetMatch = /^git\/commits\/([0-9a-f]{40}|[0-9a-f]{64})$/.exec(rest);
    if (method === 'GET' && commitGetMatch) {
      const state = getRepo(repository, false);
      const sha = commitGetMatch[1] as string;
      const commit = state?.commits.get(sha);
      if (!commit) return jsonResponse(404, { message: 'Not Found' });
      return jsonResponse(200, { sha, tree: { sha: commit.tree }, parents: commit.parents.map((p) => ({ sha: p })) });
    }

    if (method === 'POST' && rest === 'git/refs') {
      const state = getRepo(repository, true) as RepoState;
      const record = body as { ref: string; sha: string };
      if (record.ref !== `refs/heads/${branch}`) {
        return jsonResponse(422, { message: 'Invalid reference' });
      }
      if (state.head !== null) {
        return jsonResponse(422, { message: 'Reference already exists' });
      }
      state.head = record.sha;
      return jsonResponse(201, { ref: record.ref, object: { sha: record.sha, type: 'commit' } });
    }

    const patchMatch = new RegExp(`^git/refs/heads/${escapeRegExp(branch)}$`).exec(rest);
    if (method === 'PATCH' && patchMatch) {
      const state = getRepo(repository, true) as RepoState;
      const record = body as { sha: string; force: boolean };
      const commit = state.commits.get(record.sha);
      const currentFirstParent = commit && commit.parents.length > 0 ? commit.parents[0] : null;
      if (state.head === null || currentFirstParent !== state.head) {
        return jsonResponse(422, { message: 'Update is not a fast forward' });
      }
      state.head = record.sha;
      return jsonResponse(200, { ref: `refs/heads/${branch}`, object: { sha: record.sha, type: 'commit' } });
    }

    const refGetMatch = new RegExp(`^git/ref/heads/${escapeRegExp(branch)}$`).exec(rest);
    if (method === 'GET' && refGetMatch) {
      const state = getRepo(repository, false);
      if (state === null || state.head === null) {
        return jsonResponse(404, { message: 'Not Found' });
      }
      return jsonResponse(200, { ref: `refs/heads/${branch}`, object: { sha: state.head, type: 'commit' } });
    }

    const compareMatch = /^compare\/([0-9a-f]{40}|[0-9a-f]{64})\.\.\.([0-9a-f]{40}|[0-9a-f]{64})$/.exec(rest);
    if (method === 'GET' && compareMatch) {
      const state = getRepo(repository, false);
      const base = compareMatch[1] as string;
      const head = compareMatch[2] as string;
      if (state === null || !OBJECT_ID.test(base) || !OBJECT_ID.test(head)) return jsonResponse(404, { message: 'Not Found' });
      if (!state.commits.has(base) || !state.commits.has(head)) return jsonResponse(404, { message: 'Not Found' });
      if (base === head) {
        return jsonResponse(200, { status: 'identical', ahead_by: 0, behind_by: 0, files: [] });
      }
      const forward = firstParentDistance(state.commits, head, base);
      if (forward !== null) {
        const baseTree = state.trees.get((state.commits.get(base) as StoredCommit).tree) ?? new Map();
        const headTree = state.trees.get((state.commits.get(head) as StoredCommit).tree) ?? new Map();
        return jsonResponse(200, { status: 'ahead', ahead_by: forward, behind_by: 0, files: treeDiff(baseTree, headTree) });
      }
      const backward = firstParentDistance(state.commits, base, head);
      if (backward !== null) {
        return jsonResponse(200, { status: 'behind', ahead_by: 0, behind_by: backward, files: [] });
      }
      return jsonResponse(200, { status: 'diverged', ahead_by: 1, behind_by: 1, files: [] });
    }

    const treeGetMatch = /^git\/trees\/([0-9a-f]{40}|[0-9a-f]{64}):(.+)$/.exec(rest);
    if (method === 'GET' && treeGetMatch) {
      const state = getRepo(repository, false);
      const commitSha = treeGetMatch[1] as string;
      const encodedPath = treeGetMatch[2] as string;
      const pathValue = encodedPath
        .split('/')
        .map((segment) => decodeURIComponent(segment))
        .join('/');
      const commit = state?.commits.get(commitSha);
      if (!commit) return jsonResponse(404, { message: 'Not Found' });
      const treeMap = state?.trees.get(commit.tree) ?? new Map();
      const recursive = url.searchParams.get('recursive') === '1';
      const listing = directoryListing(treeMap, `${pathValue}/`, recursive);
      if (listing === null) return jsonResponse(404, { message: 'Not Found' });
      return jsonResponse(200, { sha: DUMMY_TREE_SHA, truncated: false, tree: listing });
    }

    const contentsMatch = /^contents\/(.+)$/.exec(rest);
    if (method === 'GET' && contentsMatch && url.searchParams.get('ref') === branch) {
      const state = getRepo(repository, false);
      if (state === null || state.head === null) return jsonResponse(404, { message: 'Not Found' });
      const encodedPath = contentsMatch[1] as string;
      const pathValue = encodedPath
        .split('/')
        .map((segment) => decodeURIComponent(segment))
        .join('/');
      const treeMap = repoFullTree(state);
      const fileSha = treeMap.get(pathValue);
      if (fileSha !== undefined) {
        const bytes = state.blobs.get(fileSha) ?? new Uint8Array(0);
        const base64 = Buffer.from(bytes).toString('base64');
        const lines: string[] = [];
        for (let i = 0; i < base64.length; i += 60) {
          lines.push(base64.slice(i, i + 60));
        }
        const name = pathValue.split('/').pop() as string;
        return jsonResponse(200, {
          type: 'file',
          encoding: 'base64',
          size: bytes.length,
          name,
          path: pathValue,
          sha: fileSha,
          content: lines.join('\n'),
        });
      }
      const listing = directoryListing(treeMap, `${pathValue}/`, false);
      if (listing === null) return jsonResponse(404, { message: 'Not Found' });
      const children = listing.map((entry) => ({
        name: entry.path,
        path: `${pathValue}/${entry.path}`,
        sha: entry.type === 'tree' ? DUMMY_TREE_SHA : entry.sha,
        size: entry.type === 'tree' ? 0 : (entry.size ?? 0),
        type: entry.type === 'tree' ? 'dir' : 'file',
      }));
      return jsonResponse(200, children);
    }

    return undefined;
  }

  return {
    handler,
    head(repository: string): string | null {
      return getRepo(repository, false)?.head ?? null;
    },
    files(repository: string): ReadonlyMap<string, Uint8Array> {
      const state = getRepo(repository, false);
      if (state === null) return new Map();
      const treeMap = repoFullTree(state);
      const result = new Map<string, Uint8Array>();
      for (const [path, sha] of treeMap.entries()) {
        const bytes = state.blobs.get(sha);
        if (bytes !== undefined) result.set(path, bytes);
      }
      return result;
    },
    commitCount(repository: string): number {
      const state = getRepo(repository, false);
      if (state === null) return 0;
      return reachableCount(state.commits, state.head);
    },
    advance,
  };
}

export function storeWorldFetch(
  world: StoreWorld,
): (url: string, init: { readonly method: string; readonly body?: string }) => Promise<Response> {
  return async (url: string, init: { readonly method: string; readonly body?: string }): Promise<Response> => {
    const parsedUrl = new URL(url);
    const body = init.body !== undefined ? (JSON.parse(init.body) as unknown) : undefined;
    const response = world.handler({ method: init.method, url: parsedUrl, body });
    if (response !== undefined) return response;
    return jsonResponse(404, { message: 'Not Found' });
  };
}

const STORE: EvidenceStoreLocation = { repository: { owner: 'octo', name: 'demo' }, branch: 'steward-evidence' };
const TOKEN = `test-token-${'s'.repeat(12)}`;

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function makeRunRecord(runId: number, runAttempt: number, subjectType: SubmissionType, subjectNumber: number): Uint8Array {
  const record = runRecordSchema.parse({
    schema_version: 1,
    record_type: 'run',
    run_id: runId,
    run_attempt: runAttempt,
    subject: {
      kind: 'submission',
      repository: 'octo/demo',
      type: subjectType,
      number: subjectNumber,
      snapshot_hash: `sha256:${'5'.repeat(64)}`,
    },
    commits: { base: null, head: null, group: null },
    owned_check_id: null,
    policy_revision: 'b'.repeat(40),
    steward_version: '1.0.0',
    provider: null,
    requested_model: null,
    reported_model: null,
    adapter_version: null,
    generation: null,
    runner_identity: null,
    mode: 'observe',
    started_at: '2026-09-27T10:15:00.000Z',
    finished_at: null,
    budget: {
      model_calls: null,
      tokens: null,
      ai_credits: null,
      container_seconds: null,
      executions: null,
      github_requests: null,
      retries: null,
    },
  });
  return encode(JSON.stringify(record));
}

function runGroups(subjectType: SubmissionType, subjectNumber: number, runId: number, runAttempt: number): EvidenceStoreGroup[] {
  const kind = subjectType === 'pull_request' ? 'pr' : 'issue';
  return [
    {
      directory: `runs/${kind}-${subjectNumber}/${runId}-${runAttempt}`,
      mode: 'exact',
      files: [{ path: 'run.json', bytes: makeRunRecord(runId, runAttempt, subjectType, subjectNumber) }],
    },
  ];
}

function commitInput(subjectType: SubmissionType, subjectNumber: number, runId: number, runAttempt: number): EvidenceCommitInput {
  return {
    store: STORE,
    targetRepository: 'octo/demo',
    subject: { type: subjectType, number: subjectNumber },
    runId,
    runAttempt,
    groups: runGroups(subjectType, subjectNumber, runId, runAttempt),
    maxBytes: 10485760,
    writeRetries: 3,
  };
}

function createClientAndWriter(
  fetchFn: (url: string, init: { readonly method: string; readonly body?: string }) => Promise<Response>,
): {
  readonly client: ReturnType<typeof createGitHubClient>;
  readonly writer: ReturnType<typeof createGitHubWriter>;
} {
  const budget = createGitHubBudget({ requests: 200, retriesPerRequest: 0 });
  const client = createGitHubClient({ token: TOKEN, budget, fetch: fetchFn as unknown as GitHubFetch });
  const writer = createGitHubWriter({
    token: TOKEN,
    scope: { kind: 'installation', store: STORE },
    budget,
    fetch: fetchFn as unknown as GitHubWriteFetch,
  });
  return { client, writer };
}

describe('store world', () => {
  it('the store world commits evidence and reads it back', async () => {
    const world = createStoreWorld();
    const fetchFn = storeWorldFetch(world);
    const { client, writer } = createClientAndWriter(fetchFn);
    const input = commitInput('pull_request', 12, 36081628326, 1);
    const result = await writeEvidenceCommit(input, { client, writer, sleep: async () => undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(world.head('octo/demo')).toBe(result.value.commit);
    const files = world.files('octo/demo');
    expect(files.get('octo/demo/runs/pr-12/36081628326-1/run.json')).toEqual(makeRunRecord(36081628326, 1, 'pull_request', 12));
    expect(world.commitCount('octo/demo')).toBe(1);
  });

  it('a second run appends to the store world', async () => {
    const world = createStoreWorld();
    const fetchFn = storeWorldFetch(world);
    const { client, writer } = createClientAndWriter(fetchFn);
    const first = await writeEvidenceCommit(commitInput('pull_request', 12, 36081628326, 1), {
      client,
      writer,
      sleep: async () => undefined,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = await writeEvidenceCommit(commitInput('pull_request', 12, 36081628327, 1), {
      client,
      writer,
      sleep: async () => undefined,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.parent).toBe(first.value.commit);
    expect(world.commitCount('octo/demo')).toBe(2);
    const files = world.files('octo/demo');
    expect(files.has('octo/demo/runs/pr-12/36081628326-1/run.json')).toBe(true);
    expect(files.has('octo/demo/runs/pr-12/36081628327-1/run.json')).toBe(true);
  });

  it('rewriting a committed path is not append-only', async () => {
    const world = createStoreWorld();
    const fetchFn = storeWorldFetch(world);
    const { client, writer } = createClientAndWriter(fetchFn);
    const first = await writeEvidenceCommit(commitInput('pull_request', 12, 36081628326, 1), {
      client,
      writer,
      sleep: async () => undefined,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const changedInput: EvidenceCommitInput = {
      ...commitInput('pull_request', 12, 36081628326, 1),
      groups: [
        {
          directory: 'runs/pr-12/36081628326-1',
          mode: 'exact',
          files: [{ path: 'run.json', bytes: encode('{"changed":true}') }],
        },
      ],
    };
    const rewrite = await commitEvidence(changedInput, { client, writer, sleep: async () => undefined });
    expect(rewrite.ok).toBe(false);
    if (!rewrite.ok) {
      expect(rewrite.failure.code).toBe('evidence.store-not-append-only');
    }
    expect(world.head('octo/demo')).toBe(first.value.commit);
  });

  it('a concurrent commit forces a rebuild', async () => {
    const world = createStoreWorld();
    const setupFetch = storeWorldFetch(world);
    const setupDeps = createClientAndWriter(setupFetch);
    const first = await writeEvidenceCommit(commitInput('pull_request', 12, 36081628326, 1), {
      client: setupDeps.client,
      writer: setupDeps.writer,
      sleep: async () => undefined,
    });
    expect(first.ok).toBe(true);

    let patched = false;
    const baseFetch = storeWorldFetch(world);
    const hookedFetch = async (url: string, init: { readonly method: string; readonly body?: string }): Promise<Response> => {
      if (init.method === 'PATCH' && !patched) {
        patched = true;
        world.advance('octo/demo', { 'octo/demo/metrics/2026-09/1-1.json': encode('{}') });
      }
      return baseFetch(url, init);
    };
    const { client, writer } = createClientAndWriter(hookedFetch);
    const result = await writeEvidenceCommit(commitInput('pull_request', 12, 36081628327, 1), {
      client,
      writer,
      sleep: async () => undefined,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rebuilds).toBe(1);
    const files = world.files('octo/demo');
    expect(files.has('octo/demo/metrics/2026-09/1-1.json')).toBe(true);
  });

  it('the fallback read finds the latest published run', async () => {
    const world = createStoreWorld();
    const fetchFn = storeWorldFetch(world);
    const { client, writer } = createClientAndWriter(fetchFn);
    const first = await writeEvidenceCommit(commitInput('issue', 29, 36081628326, 1), {
      client,
      writer,
      sleep: async () => undefined,
    });
    expect(first.ok).toBe(true);
    const second = await writeEvidenceCommit(commitInput('issue', 29, 36081628327, 1), {
      client,
      writer,
      sleep: async () => undefined,
    });
    expect(second.ok).toBe(true);

    const snapshot = await readPublishedSnapshot(client, {
      store: STORE,
      targetRepository: 'octo/demo',
      subject: { type: 'issue', number: 29 },
    });
    expect(snapshot.kind).toBe('published');
    if (snapshot.kind === 'published') {
      expect(snapshot.runId).toBe(36081628327);
    }
  });

  it('an absent store branch has no published run', async () => {
    const world = createStoreWorld();
    const fetchFn = storeWorldFetch(world);
    const { client } = createClientAndWriter(fetchFn);
    const snapshot = await readPublishedSnapshot(client, {
      store: STORE,
      targetRepository: 'octo/demo',
      subject: { type: 'issue', number: 29 },
    });
    expect(snapshot.kind).toBe('none');
  });

  it('store world state is kept per repository', async () => {
    const world = createStoreWorld();
    const fetchFn = storeWorldFetch(world);
    const otherStore: EvidenceStoreLocation = { repository: { owner: 'octo', name: 'evidence' }, branch: 'steward-evidence' };
    const budget = createGitHubBudget({ requests: 200, retriesPerRequest: 0 });
    const client = createGitHubClient({ token: TOKEN, budget, fetch: fetchFn as unknown as GitHubFetch });
    const writer = createGitHubWriter({
      token: TOKEN,
      scope: { kind: 'installation', store: otherStore },
      budget,
      fetch: fetchFn as unknown as GitHubWriteFetch,
    });
    const result = await writeEvidenceCommit(
      { ...commitInput('pull_request', 12, 36081628326, 1), store: otherStore },
      { client, writer, sleep: async () => undefined },
    );
    expect(result.ok).toBe(true);
    expect(world.head('octo/demo')).toBeNull();
  });
});
