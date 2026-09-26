import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createGitHubClient } from './client.js';
import { createGitHubBudget } from './budget.js';
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
import { findCredentialDetector } from '../redaction/detectors.js';

const githubFixturesDir = fileURLToPath(new URL('../../../../fixtures/github/', import.meta.url));

function fixturePath(relative: string): string {
  return fileURLToPath(new URL('../../../../fixtures/github/' + relative, import.meta.url));
}

function readFixtureText(relative: string): string {
  return readFileSync(fixturePath(relative), 'utf8');
}

const repo = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };

function clientFor(relative: string) {
  const text = readFixtureText(relative);
  return createGitHubClient({
    token: null,
    budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }),
    fetch: () => Promise.resolve(new Response(text, { status: 200 })),
  });
}

function walkJsonFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...walkJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

describe('recorded GitHub responses', () => {
  it('recorded repository validates', async () => {
    const client = clientFor('testbed/repository.json');
    const result = await readRepository(client, repo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fullName).toBe('steady-orchard/patch-steward-testbed-public');
    expect(result.value.defaultBranch).toBe('master');
    expect(result.value.private).toBe(false);
  });

  it('recorded issues validate', async () => {
    const issue29 = await readIssue(clientFor('testbed/issue-29.json'), repo, 29);
    expect(issue29.ok).toBe(true);
    if (issue29.ok) {
      expect(issue29.value.number).toBe(29);
      expect(issue29.value.state).toBe('closed');
      expect(typeof issue29.value.author.login === 'string' && issue29.value.author.login.length > 0).toBe(true);
    }

    const issue30 = await readIssue(clientFor('testbed/issue-30.json'), repo, 30);
    expect(issue30.ok).toBe(true);
    if (issue30.ok) {
      expect(issue30.value.number).toBe(30);
      expect(issue30.value.state).toBe('closed');
      expect(typeof issue30.value.author.login === 'string' && issue30.value.author.login.length > 0).toBe(true);
    }
  });

  it('recorded pull request read through the issues endpoint is not an issue', async () => {
    const client = clientFor('testbed/issue-26-pull-request.json');
    const result = await readIssue(client, repo, 26);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.not-an-issue');
    }
  });

  it('recorded pull requests validate', async () => {
    const pull26 = await readPullRequest(clientFor('testbed/pull-26.json'), repo, 26);
    expect(pull26.ok).toBe(true);
    if (pull26.ok) {
      expect(pull26.value.headSha).toBe('b46eef5018c202bcb2470bf62e3defd7496ec65b');
      expect(pull26.value.baseRef).toBe('probe-pa06-base');
      expect(pull26.value.changedFiles).toBe(1);
      expect(pull26.value.state).toBe('closed');
    }

    const pull27 = await readPullRequest(clientFor('testbed/pull-27.json'), repo, 27);
    expect(pull27.ok).toBe(true);
    if (pull27.ok) {
      expect(pull27.value.headSha).toBe('b741c7a7b5acf542eefdac1a4f16d3ad1b179dfa');
      expect(pull27.value.changedFiles).toBe(20);
    }

    const pull28 = await readPullRequest(clientFor('testbed/pull-28.json'), repo, 28);
    expect(pull28.ok).toBe(true);
    if (pull28.ok) {
      expect(pull28.value.headSha).toBe('3ae66e948f9fc695bb636765af6526072aee53cc');
      expect(pull28.value.changedFiles).toBe(20);
    }
  });

  it('recorded pull request files validate', async () => {
    const files26 = await readPullRequestFiles(clientFor('testbed/pull-26-files.json'), repo, 26, 1);
    expect(files26).toEqual({
      ok: true,
      value: { kind: 'complete', changes: [{ kind: 'added', path: 'probe-pa06/entry-2-5.txt', previousPath: null }] },
    });

    const files27 = await readPullRequestFiles(clientFor('testbed/pull-27-files.json'), repo, 27, 20);
    expect(files27.ok).toBe(true);
    if (files27.ok && files27.value.kind === 'complete') {
      expect(files27.value.changes).toHaveLength(20);
    }

    const files28 = await readPullRequestFiles(clientFor('testbed/pull-28-files.json'), repo, 28, 20);
    expect(files28.ok).toBe(true);
    if (files28.ok && files28.value.kind === 'complete') {
      expect(files28.value.changes).toHaveLength(20);
    }
  });

  it('recorded pull requests for a closed head are not shared heads', async () => {
    const client = clientFor('testbed/commit-pulls-b46eef5.json');
    const result = await readOpenPullRequestsForCommit(client, repo, 'b46eef5018c202bcb2470bf62e3defd7496ec65b');
    expect(result).toEqual({ ok: true, value: [] });
  });

  it('recorded branch ref and directory listing validate', async () => {
    const refResult = await readBranchHead(clientFor('testbed/ref-heads-master.json'), repo, 'master');
    expect(refResult.ok).toBe(true);
    if (!refResult.ok) return;
    expect(refResult.value).toMatch(/^[0-9a-f]{40}$/);

    const entriesResult = await readDirectoryEntries(clientFor('testbed/contents-github.json'), repo, '.github', refResult.value);
    expect(entriesResult.ok).toBe(true);
    if (!entriesResult.ok) return;
    const workflows = entriesResult.value.find((entry) => entry.name === 'workflows');
    expect(workflows?.type).toBe('dir');
    expect(entriesResult.value.find((entry) => entry.name === 'patch-steward')).toBeUndefined();
  });

  it('recorded issue comment validates', async () => {
    const client = clientFor('testbed/issue-comment-5825050006.json');
    const result = await readIssueComment(client, repo, 5825050006);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(5825050006);
    expect(result.value.body.length).toBeGreaterThan(0);
  });

  it('hostile recorded variants are schema mismatches', async () => {
    const repoResult = await readRepository(clientFor('hostile/repository-missing-default-branch.json'), repo);
    expect(repoResult.ok).toBe(false);
    if (!repoResult.ok) {
      expect(repoResult.failure.code).toBe('github.schema-mismatch');
      expect(repoResult.failure.outcome).toBe('inconclusive');
      expect((repoResult as { value?: unknown }).value).toBeUndefined();
    }

    const pullResult = await readPullRequest(clientFor('hostile/pull-request-wrong-types.json'), repo, 26);
    expect(pullResult.ok).toBe(false);
    if (!pullResult.ok) {
      expect(pullResult.failure.code).toBe('github.schema-mismatch');
      expect(pullResult.failure.outcome).toBe('inconclusive');
      expect((pullResult as { value?: unknown }).value).toBeUndefined();
    }

    const filesResult = await readPullRequestFiles(clientFor('hostile/pull-request-files-unknown-status.json'), repo, 26, 1);
    expect(filesResult.ok).toBe(false);
    if (!filesResult.ok) {
      expect(filesResult.failure.code).toBe('github.schema-mismatch');
      expect(filesResult.failure.outcome).toBe('inconclusive');
      expect((filesResult as { value?: unknown }).value).toBeUndefined();
    }
  });

  it('recorded GitHub responses contain no credential', () => {
    const files = walkJsonFiles(githubFixturesDir.replace(/\/$/, ''));
    expect(files.length).toBeGreaterThanOrEqual(17);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(findCredentialDetector(text)).toBeNull();
    }
  });
});
