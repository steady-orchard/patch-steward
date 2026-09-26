import { describe, expect, it } from 'vitest';
import { createGitHubClient } from './client.js';
import type { GitHubFetch } from './client.js';
import { createGitHubBudget } from './budget.js';
import {
  readBranchHead,
  readDirectoryEntries,
  readGitBlob,
  readGitTree,
  readIssue,
  readIssueComment,
  readOpenPullRequestsForCommit,
  readPullRequest,
  readPullRequestFiles,
  readRepository,
  repositoryRefFromFullName,
} from './reader.js';
import type { GitHubRepositoryRef } from './reader.js';

const SHA_A = '1111111111111111111111111111111111111111';
const SHA_B = '2222222222222222222222222222222222222222';

interface RecordedCall {
  readonly url: string;
}

function makeFetch(responder: (url: string, count: number) => Response): { fetch: GitHubFetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl: GitHubFetch = (url: string) => {
    calls.push({ url });
    return Promise.resolve(responder(url, calls.length));
  };
  return { fetch: fetchImpl, calls };
}

function jsonResponse(body: unknown, init?: { readonly headers?: Record<string, string> }): Response {
  return new Response(JSON.stringify(body), init?.headers === undefined ? { status: 200 } : { status: 200, headers: init.headers });
}

function makeClient(fetch: GitHubFetch, requests = 100) {
  return createGitHubClient({ token: null, budget: createGitHubBudget({ requests, retriesPerRequest: 0 }), fetch });
}

const REPO: GitHubRepositoryRef = { owner: 'octo', name: 'demo' };

describe('github reads', () => {
  it('repository names parse from full names', () => {
    expect(repositoryRefFromFullName('steady-orchard/patch-steward')).toEqual({
      owner: 'steady-orchard',
      name: 'patch-steward',
    });
    expect(repositoryRefFromFullName('a-b/c_d-e.f')).toEqual({ owner: 'a-b', name: 'c_d-e.f' });
    for (const bad of ['a.b/c', 'a', 'a/b/c', '-a/b', 'a/..', 'a/.', 'a/b c', '', '/b', 'a/']) {
      expect(repositoryRefFromFullName(bad)).toBeNull();
    }
  });

  it('github reads build the pinned endpoints', async () => {
    const { fetch, calls } = makeFetch((url) => {
      if (url.includes('/repos/octo/demo/issues/7'))
        return jsonResponse({ number: 7, title: 't', body: null, state: 'open', user: null, author_association: 'NONE' });
      if (url.includes('/pulls/8/files')) return jsonResponse([]);
      if (url.includes('/pulls/8'))
        return jsonResponse({
          number: 8,
          title: 't',
          body: null,
          state: 'open',
          draft: false,
          head: { sha: SHA_A, ref: 'r' },
          base: { sha: SHA_B, ref: 'b' },
          user: null,
          author_association: 'NONE',
          changed_files: 0,
        });
      if (url.includes('/commits/') && url.includes('/pulls')) return jsonResponse([]);
      if (url.includes('/issues/comments/99'))
        return jsonResponse({ id: 99, body: 'x', user: null, author_association: 'NONE', updated_at: '2020-01-01' });
      if (url.includes('/contents/.github')) return jsonResponse([]);
      if (url.includes('/git/trees/')) return jsonResponse({ sha: SHA_A, truncated: false, tree: [] });
      if (url.includes('/git/blobs/')) return jsonResponse({ sha: SHA_A, size: 0, encoding: 'base64', content: '' });
      if (url.includes('/git/ref/heads/'))
        return jsonResponse({ ref: 'refs/heads/release/1.0', object: { sha: SHA_A, type: 'commit' } });
      return jsonResponse({ full_name: 'octo/demo', default_branch: 'main', private: false });
    });
    const client = makeClient(fetch);
    await readRepository(client, REPO);
    await readIssue(client, REPO, 7);
    await readPullRequest(client, REPO, 8);
    await readPullRequestFiles(client, REPO, 8, 0);
    await readOpenPullRequestsForCommit(client, REPO, SHA_A);
    await readIssueComment(client, REPO, 99);
    await readDirectoryEntries(client, REPO, '.github', SHA_A);
    await readGitTree(client, REPO, SHA_A, true);
    await readGitBlob(client, REPO, SHA_A, 1000);
    await readBranchHead(client, REPO, 'release/1.0');

    expect(calls.map((c) => c.url)).toEqual([
      'https://api.github.com/repos/octo/demo',
      'https://api.github.com/repos/octo/demo/issues/7',
      'https://api.github.com/repos/octo/demo/pulls/8',
      'https://api.github.com/repos/octo/demo/pulls/8/files?per_page=100',
      `https://api.github.com/repos/octo/demo/commits/${SHA_A}/pulls?per_page=100`,
      'https://api.github.com/repos/octo/demo/issues/comments/99',
      `https://api.github.com/repos/octo/demo/contents/.github?ref=${SHA_A}`,
      `https://api.github.com/repos/octo/demo/git/trees/${SHA_A}?recursive=1`,
      `https://api.github.com/repos/octo/demo/git/blobs/${SHA_A}`,
      'https://api.github.com/repos/octo/demo/git/ref/heads/release/1.0',
    ]);
  });

  it('github reads a repository', async () => {
    const { fetch } = makeFetch(() => jsonResponse({ full_name: 'octo/demo', default_branch: 'main', private: true }));
    const result = await readRepository(makeClient(fetch), REPO);
    expect(result).toEqual({ ok: true, value: { fullName: 'octo/demo', defaultBranch: 'main', private: true } });
  });

  it('github reads an issue with its author as data', async () => {
    const { fetch } = makeFetch(() =>
      jsonResponse({
        number: 1,
        title: 't',
        body: null,
        state: 'open',
        user: { login: 'octocat', id: 1, type: 'User' },
        author_association: 'NONE',
      }),
    );
    const result = await readIssue(makeClient(fetch), REPO, 1);
    expect(result).toEqual({
      ok: true,
      value: {
        number: 1,
        title: 't',
        body: null,
        state: 'open',
        author: { login: 'octocat', id: 1, type: 'User', association: 'NONE' },
      },
    });

    const { fetch: fetchNullUser } = makeFetch(() =>
      jsonResponse({ number: 1, title: 't', body: null, state: 'open', user: null, author_association: 'NONE' }),
    );
    const nullResult = await readIssue(makeClient(fetchNullUser), REPO, 1);
    expect(nullResult.ok).toBe(true);
    if (nullResult.ok) {
      expect(nullResult.value.author).toEqual({ login: null, id: null, type: null, association: 'NONE' });
    }
  });

  it('github issue reads reject pull requests', async () => {
    const { fetch } = makeFetch(() =>
      jsonResponse({ number: 1, title: 't', body: null, state: 'open', user: null, author_association: 'NONE', pull_request: {} }),
    );
    const result = await readIssue(makeClient(fetch), REPO, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.not-an-issue');
  });

  it('github reads a pull request', async () => {
    const { fetch } = makeFetch(() =>
      jsonResponse({
        number: 8,
        title: 't',
        body: 'b',
        state: 'open',
        draft: true,
        head: { sha: SHA_A, ref: 'feature' },
        base: { sha: SHA_B, ref: 'main' },
        user: null,
        author_association: 'NONE',
        changed_files: 3,
      }),
    );
    const result = await readPullRequest(makeClient(fetch), REPO, 8);
    expect(result).toEqual({
      ok: true,
      value: {
        number: 8,
        title: 't',
        body: 'b',
        state: 'open',
        draft: true,
        headSha: SHA_A,
        headRef: 'feature',
        baseSha: SHA_B,
        baseRef: 'main',
        changedFiles: 3,
        author: { login: null, id: null, type: null, association: 'NONE' },
      },
    });
  });

  it('github pull request files map statuses to path changes', async () => {
    const { fetch } = makeFetch(() =>
      jsonResponse([
        { filename: 'a.txt', status: 'added' },
        { filename: 'b.txt', status: 'removed' },
        { filename: 'c.txt', status: 'modified' },
        { filename: 'd.txt', status: 'renamed', previous_filename: 'd-old.txt' },
        { filename: 'e.txt', status: 'copied', previous_filename: 'e-old.txt' },
        { filename: 'f.txt', status: 'changed' },
        { filename: 'g.txt', status: 'unchanged' },
      ]),
    );
    const result = await readPullRequestFiles(makeClient(fetch), REPO, 8, 7);
    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'complete',
        changes: [
          { kind: 'added', path: 'a.txt', previousPath: null },
          { kind: 'deleted', path: 'b.txt', previousPath: null },
          { kind: 'modified', path: 'c.txt', previousPath: null },
          { kind: 'renamed', path: 'd.txt', previousPath: 'd-old.txt' },
          { kind: 'copied', path: 'e.txt', previousPath: 'e-old.txt' },
          { kind: 'type-changed', path: 'f.txt', previousPath: null },
        ],
      },
    });
  });

  it('github pull request files over the limits are too large', async () => {
    const { fetch, calls } = makeFetch(() => jsonResponse([]));
    const overLimit = await readPullRequestFiles(makeClient(fetch), REPO, 8, 3001);
    expect(overLimit).toEqual({ ok: true, value: { kind: 'too-large' } });
    expect(calls.length).toBe(0);

    const { fetch: fetchShort } = makeFetch(() =>
      jsonResponse([
        { filename: 'a.txt', status: 'added' },
        { filename: 'b.txt', status: 'added' },
      ]),
    );
    const shortResult = await readPullRequestFiles(makeClient(fetchShort), REPO, 8, 3);
    expect(shortResult).toEqual({ ok: true, value: { kind: 'too-large' } });

    const longName = 'a'.repeat(4097);
    const { fetch: fetchLongName } = makeFetch(() => jsonResponse([{ filename: longName, status: 'added' }]));
    const longNameResult = await readPullRequestFiles(makeClient(fetchLongName), REPO, 8, 1);
    expect(longNameResult).toEqual({ ok: true, value: { kind: 'too-large' } });

    const { fetch: fetchPaged } = makeFetch(() =>
      jsonResponse([{ filename: 'a.txt', status: 'added' }], { headers: { link: '<https://api.github.com/next>; rel="next"' } }),
    );
    const pagedResult = await readPullRequestFiles(makeClient(fetchPaged), REPO, 8, 3000);
    expect(pagedResult).toEqual({ ok: true, value: { kind: 'too-large' } });
  });

  it('github open pull requests for a commit keep open heads only', async () => {
    const { fetch } = makeFetch(() =>
      jsonResponse([
        { number: 9, state: 'open', head: { sha: SHA_A } },
        { number: 3, state: 'closed', head: { sha: SHA_A } },
        { number: 4, state: 'open', head: { sha: SHA_B } },
        { number: 2, state: 'open', head: { sha: SHA_A } },
      ]),
    );
    const result = await readOpenPullRequestsForCommit(makeClient(fetch), REPO, SHA_A);
    expect(result).toEqual({ ok: true, value: [2, 9] });
  });

  it('injected failure: github shared-head listing over one page', async () => {
    const { fetch } = makeFetch(() =>
      jsonResponse([{ number: 1, state: 'open', head: { sha: SHA_A } }], {
        headers: { link: '<https://api.github.com/next>; rel="next"' },
      }),
    );
    const result = await readOpenPullRequestsForCommit(makeClient(fetch), REPO, SHA_A);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.pagination-exceeded');
  });

  it('github reads an issue comment', async () => {
    const { fetch } = makeFetch(() =>
      jsonResponse({
        id: 99,
        body: 'hello',
        user: { login: 'octocat', id: 1, type: 'User' },
        author_association: 'NONE',
        updated_at: '2020-01-01T00:00:00Z',
      }),
    );
    const result = await readIssueComment(makeClient(fetch), REPO, 99);
    expect(result).toEqual({
      ok: true,
      value: {
        id: 99,
        body: 'hello',
        updatedAt: '2020-01-01T00:00:00Z',
        author: { login: 'octocat', id: 1, type: 'User', association: 'NONE' },
      },
    });
  });

  it('github directory entries reject a file response', async () => {
    const { fetch } = makeFetch(() => jsonResponse({ name: 'a', path: 'a', sha: SHA_A, type: 'file', size: 1 }));
    const result = await readDirectoryEntries(makeClient(fetch), REPO, '.github', SHA_A);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.not-a-directory');

    const { fetch: fetchArray } = makeFetch(() =>
      jsonResponse([{ name: 'a', path: '.github/a', sha: SHA_A, type: 'file', size: 1 }]),
    );
    const arrayResult = await readDirectoryEntries(makeClient(fetchArray), REPO, '.github', SHA_A);
    expect(arrayResult).toEqual({
      ok: true,
      value: [{ name: 'a', path: '.github/a', sha: SHA_A, type: 'file', size: 1 }],
    });
  });

  it('github tree reads keep modes and the truncated flag', async () => {
    const { fetch } = makeFetch(() =>
      jsonResponse({
        sha: SHA_A,
        truncated: true,
        tree: [
          { path: 'a', mode: '100644', type: 'blob', sha: SHA_A, size: 10 },
          { path: 'b', mode: '120000', type: 'blob', sha: SHA_A, size: 5 },
          { path: 'c', mode: '040000', type: 'tree', sha: SHA_A },
        ],
      }),
    );
    const result = await readGitTree(makeClient(fetch), REPO, SHA_A, false);
    expect(result).toEqual({
      ok: true,
      value: {
        sha: SHA_A,
        truncated: true,
        entries: [
          { path: 'a', mode: '100644', type: 'blob', sha: SHA_A, size: 10 },
          { path: 'b', mode: '120000', type: 'blob', sha: SHA_A, size: 5 },
          { path: 'c', mode: '040000', type: 'tree', sha: SHA_A, size: null },
        ],
      },
    });
  });

  it('github blob reads decode base64 within the size limit', async () => {
    const { fetch } = makeFetch(() => jsonResponse({ sha: SHA_A, size: 5, encoding: 'base64', content: 'aGVs\nbG8=\n' }));
    const result = await readGitBlob(makeClient(fetch), REPO, SHA_A, 1000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.toString('utf8')).toBe('hello');

    const { fetch: fetchTooLarge } = makeFetch(() =>
      jsonResponse({ sha: SHA_A, size: 5, encoding: 'base64', content: 'aGVsbG8=' }),
    );
    const tooLarge = await readGitBlob(makeClient(fetchTooLarge), REPO, SHA_A, 4);
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) expect(tooLarge.failure.code).toBe('github.blob-too-large');

    const { fetch: fetchSizeMismatch } = makeFetch(() =>
      jsonResponse({ sha: SHA_A, size: 6, encoding: 'base64', content: 'aGVsbG8=' }),
    );
    const sizeMismatch = await readGitBlob(makeClient(fetchSizeMismatch), REPO, SHA_A, 1000);
    expect(sizeMismatch.ok).toBe(false);
    if (!sizeMismatch.ok) expect(sizeMismatch.failure.code).toBe('github.malformed-response');

    const { fetch: fetchBadChars } = makeFetch(() => jsonResponse({ sha: SHA_A, size: 3, encoding: 'base64', content: 'a$b=' }));
    const badChars = await readGitBlob(makeClient(fetchBadChars), REPO, SHA_A, 1000);
    expect(badChars.ok).toBe(false);
    if (!badChars.ok) expect(badChars.failure.code).toBe('github.malformed-response');

    const { fetch: fetchBadEncoding } = makeFetch(() =>
      jsonResponse({ sha: SHA_A, size: 5, encoding: 'utf-8', content: 'aGVsbG8=' }),
    );
    const badEncoding = await readGitBlob(makeClient(fetchBadEncoding), REPO, SHA_A, 1000);
    expect(badEncoding.ok).toBe(false);
    if (!badEncoding.ok) expect(badEncoding.failure.code).toBe('github.schema-mismatch');
  });

  it('github branch head reads a commit id', async () => {
    const { fetch } = makeFetch(() => jsonResponse({ ref: 'refs/heads/main', object: { sha: SHA_A, type: 'commit' } }));
    const result = await readBranchHead(makeClient(fetch), REPO, 'main');
    expect(result).toEqual({ ok: true, value: SHA_A });

    const { fetch: fetchTag } = makeFetch(() => jsonResponse({ ref: 'refs/heads/main', object: { sha: SHA_A, type: 'tag' } }));
    const tagResult = await readBranchHead(makeClient(fetchTag), REPO, 'main');
    expect(tagResult.ok).toBe(false);
    if (!tagResult.ok) expect(tagResult.failure.code).toBe('github.schema-mismatch');
  });

  it('github reads reject invalid arguments without a request', async () => {
    const { fetch, calls } = makeFetch(() => jsonResponse({}));
    const client = makeClient(fetch);
    const results = await Promise.all([
      readRepository(client, { owner: 'a/b', name: 'x' }),
      readRepository(client, { owner: 'a', name: '..' }),
      readIssue(client, REPO, 0),
      readIssue(client, REPO, 1.5),
      readOpenPullRequestsForCommit(client, REPO, 'xyz'),
      readBranchHead(client, REPO, '..'),
      readBranchHead(client, REPO, '-x'),
      readBranchHead(client, REPO, 'a b'),
      readDirectoryEntries(client, REPO, '../x', SHA_A),
      readDirectoryEntries(client, REPO, '', SHA_A),
    ]);
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('github.invalid-request');
    }
    expect(calls.length).toBe(0);
  });

  it('injected failure: github read not found', async () => {
    const { fetch } = makeFetch(() => new Response('not found', { status: 404 }));
    const result = await readIssue(makeClient(fetch), REPO, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.not-found');
      expect(result.failure.outcome).toBe('inconclusive');
    }
  });

  it('injected failure: github read schema mismatch', async () => {
    const { fetch: fetchRepo } = makeFetch(() => jsonResponse({ full_name: 'octo/demo', private: false }));
    const repoResult = await readRepository(makeClient(fetchRepo), REPO);
    expect(repoResult.ok).toBe(false);
    if (!repoResult.ok) expect(repoResult.failure.code).toBe('github.schema-mismatch');

    const { fetch: fetchPr } = makeFetch(() =>
      jsonResponse({
        number: '8',
        title: 't',
        body: null,
        state: 'open',
        draft: false,
        head: { sha: SHA_A, ref: 'r' },
        base: { sha: SHA_B, ref: 'b' },
        user: null,
        author_association: 'NONE',
        changed_files: 0,
      }),
    );
    const prResult = await readPullRequest(makeClient(fetchPr), REPO, 8);
    expect(prResult.ok).toBe(false);
    if (!prResult.ok) expect(prResult.failure.code).toBe('github.schema-mismatch');

    const { fetch: fetchFile } = makeFetch(() => jsonResponse([{ filename: 'a.txt', status: 'exploded' }]));
    const fileResult = await readPullRequestFiles(makeClient(fetchFile), REPO, 8, 1);
    expect(fileResult.ok).toBe(false);
    if (!fileResult.ok) expect(fileResult.failure.code).toBe('github.schema-mismatch');

    const longTitle = 'a'.repeat(1025);
    const { fetch: fetchIssue } = makeFetch(() =>
      jsonResponse({ number: 1, title: longTitle, body: null, state: 'open', user: null, author_association: 'NONE' }),
    );
    const issueResult = await readIssue(makeClient(fetchIssue), REPO, 1);
    expect(issueResult.ok).toBe(false);
    if (!issueResult.ok) expect(issueResult.failure.code).toBe('github.schema-mismatch');
  });
});
