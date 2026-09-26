import { beforeAll, describe, expect, test } from 'vitest';

import { createGitHubClient } from './client.js';
import { createGitHubBudget } from './budget.js';
import type { GitHubClient } from './client.js';
import type { GitHubRepositoryRef } from './reader.js';
import {
  readBranchHead,
  readDirectoryEntries,
  readIssue,
  readIssueComment,
  readOpenPullRequestsForCommit,
  readPullRequest,
  readPullRequestFiles,
  readRepository,
} from './reader.js';
import { loadPolicy } from '../policy/loader.js';

const repo: GitHubRepositoryRef = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
const testbedPullHeadSha = 'b46eef5018c202bcb2470bf62e3defd7496ec65b';

const token = typeof process.env.GH_TOKEN === 'string' && process.env.GH_TOKEN !== '' ? process.env.GH_TOKEN : null;

function createClient(): GitHubClient {
  return createGitHubClient({ token, budget: createGitHubBudget({ requests: 60, retriesPerRequest: 1 }) });
}

let offline = false;

beforeAll(async () => {
  const client = createClient();
  const result = await readRepository(client, repo);
  if (!result.ok && (result.failure.code === 'github.network' || result.failure.code === 'github.timeout')) {
    offline = true;
    console.warn('live tests skipped: GitHub is unreachable');
  }
});

describe('github live reads', () => {
  test('live: test-bed repository read validates', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const client = createClient();
    const result = await readRepository(client, repo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fullName).toBe('steady-orchard/patch-steward-testbed-public');
    expect(result.value.defaultBranch).toBe('master');
    expect(result.value.private).toBe(false);
  });

  test('live: test-bed issue reads validate', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const client = createClient();
    const issueResult = await readIssue(client, repo, 29);
    expect(issueResult.ok).toBe(true);
    if (issueResult.ok) {
      expect(issueResult.value.number).toBe(29);
      expect(issueResult.value.state).toBe('closed');
    }
    const notAnIssueResult = await readIssue(client, repo, 26);
    expect(notAnIssueResult.ok).toBe(false);
    if (!notAnIssueResult.ok) {
      expect(notAnIssueResult.failure.code).toBe('github.not-an-issue');
    }
  });

  test('live: test-bed pull request and files reads validate', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const client = createClient();
    const prResult = await readPullRequest(client, repo, 26);
    expect(prResult.ok).toBe(true);
    if (!prResult.ok) return;
    expect(prResult.value.headSha).toBe(testbedPullHeadSha);
    expect(prResult.value.baseRef).toBe('probe-pa06-base');
    expect(prResult.value.changedFiles).toBe(1);

    const filesResult = await readPullRequestFiles(client, repo, 26, 1);
    expect(filesResult.ok).toBe(true);
    if (!filesResult.ok) return;
    expect(filesResult.value).toEqual({
      kind: 'complete',
      changes: [{ kind: 'added', path: 'probe-pa06/entry-2-5.txt', previousPath: null }],
    });
  });

  test('live: open pull requests for a closed head are empty', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const client = createClient();
    const result = await readOpenPullRequestsForCommit(client, repo, testbedPullHeadSha);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  test('live: test-bed branch head and directory listing validate', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const client = createClient();
    const headResult = await readBranchHead(client, repo, 'master');
    expect(headResult.ok).toBe(true);
    if (!headResult.ok) return;
    expect(headResult.value).toMatch(/^[0-9a-f]{40}$/);

    const entriesResult = await readDirectoryEntries(client, repo, '.github', headResult.value);
    expect(entriesResult.ok).toBe(true);
    if (!entriesResult.ok) return;
    const workflows = entriesResult.value.find((entry) => entry.name === 'workflows');
    expect(workflows?.type).toBe('dir');
    expect(entriesResult.value.some((entry) => entry.name === 'patch-steward')).toBe(false);
  });

  test('live: test-bed issue comment read validates', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const client = createClient();
    const result = await readIssueComment(client, repo, 5825050006);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(5825050006);
    expect(result.value.body.length).toBeGreaterThan(0);
  });

  test('live: test-bed has no published policy', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const client = createClient();
    const result = await loadPolicy({ kind: 'github', client, repository: repo, branch: 'master' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('policy-source.not-published');
      expect(result.failure.outcome).toBe('inconclusive');
    }
  });
});
