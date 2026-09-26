import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { findCredentialDetector } from '../redaction/detectors.js';
import type { GitHubPolicySource } from './loader.js';
import { loadPolicy } from './loader.js';

const FIXTURE_DIR = fileURLToPath(new URL('../../../../fixtures/github/policy-directory/', import.meta.url));

const FIXTURE_FILES = [
  'ref-heads-main.json',
  'contents-github.json',
  'contents-github-without-policy.json',
  'tree.json',
  'blob-policy.json',
] as const;

function readFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));
}

const REPOSITORY: GitHubRepositoryRef = { owner: 'example-owner', name: 'example-repo' };
const BRANCH = 'main';
const COMMIT_SHA = '0123456789abcdef0123456789abcdef01234567';
const TREE_SHA = 'a8c2485882b52f63db71b1ec63b12f5039220e03';
const BLOB_SHA = '716098133e97314ccf047f5034cc8f76161d8f0d';

function refUrl(): string {
  return `https://api.github.com/repos/${REPOSITORY.owner}/${REPOSITORY.name}/git/ref/heads/${BRANCH}`;
}

function contentsUrl(): string {
  return `https://api.github.com/repos/${REPOSITORY.owner}/${REPOSITORY.name}/contents/.github?ref=${COMMIT_SHA}`;
}

function treeUrl(): string {
  return `https://api.github.com/repos/${REPOSITORY.owner}/${REPOSITORY.name}/git/trees/${TREE_SHA}?recursive=1`;
}

function blobUrl(): string {
  return `https://api.github.com/repos/${REPOSITORY.owner}/${REPOSITORY.name}/git/blobs/${BLOB_SHA}`;
}

function makeFetch(contentsFile: string): GitHubFetch {
  const routes = new Map<string, unknown>([
    [refUrl(), readFixture('ref-heads-main.json')],
    [contentsUrl(), readFixture(contentsFile)],
    [treeUrl(), readFixture('tree.json')],
    [blobUrl(), readFixture('blob-policy.json')],
  ]);
  return (url: string): Promise<Response> => {
    const body = routes.get(url);
    if (body === undefined) {
      return Promise.resolve(new Response('not mapped', { status: 404 }));
    }
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  };
}

function sourceFor(contentsFile: string): GitHubPolicySource {
  const client = createGitHubClient({
    token: null,
    budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }),
    fetch: makeFetch(contentsFile),
  });
  return { kind: 'github', client, repository: REPOSITORY, branch: BRANCH };
}

describe('policy loader: github source, recorded fixtures', { timeout: 60000 }, () => {
  let repoDir: string;
  let configDir: string;
  let globalConfigPath: string;

  function fixtureEnv(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      if (key.toUpperCase().startsWith('GIT_')) continue;
      result[key] = value;
    }
    result['GIT_CONFIG_NOSYSTEM'] = '1';
    result['GIT_CONFIG_GLOBAL'] = globalConfigPath;
    result['GIT_AUTHOR_NAME'] = 'Fixture';
    result['GIT_AUTHOR_EMAIL'] = 'fixture@example.com';
    result['GIT_AUTHOR_DATE'] = '2026-01-01T00:00:00Z';
    result['GIT_COMMITTER_NAME'] = 'Fixture';
    result['GIT_COMMITTER_EMAIL'] = 'fixture@example.com';
    result['GIT_COMMITTER_DATE'] = '2026-01-01T00:00:00Z';
    return result;
  }

  function git(args: readonly string[], input?: Buffer): string {
    const out = execFileSync('git', args, { cwd: repoDir, env: fixtureEnv(), input, encoding: 'buffer' });
    return out.toString('utf8').trim();
  }

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-loader-github-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-loader-github-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');
    git(['-c', 'init.defaultBranch=main', 'init', '-q']);
  }, 60000);

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  test('github policy source revision equals the git tree id for a recorded tree', async () => {
    const result = await loadPolicy(sourceFor('contents-github.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.revision.id).toBe(TREE_SHA);
    expect(result.value.revision.kind === 'git-tree' && result.value.revision.commit).toBe(COMMIT_SHA);

    const blobFixture = readFixture('blob-policy.json') as { readonly content: string };
    const bytes = Buffer.from(blobFixture.content.replace(/\n/g, ''), 'base64');

    const blobId = git(['hash-object', '-w', '--no-filters', '--stdin'], bytes);
    expect(blobId).toBe(BLOB_SHA);
    const policyTreeId = git(['mktree'], Buffer.from(`100644 blob ${blobId}\tpolicy.yml\n`, 'utf8'));
    const githubTreeId = git(['mktree'], Buffer.from(`040000 tree ${policyTreeId}\tpatch-steward\n`, 'utf8'));
    const rootTreeId = git(['mktree'], Buffer.from(`040000 tree ${githubTreeId}\t.github\n`, 'utf8'));
    const commitId = git(['commit-tree', rootTreeId, '-m', 'fixture']);

    const revealed = git(['rev-parse', `${commitId}:.github/patch-steward`]);
    expect(revealed).toBe(result.value.revision.id);
    expect(policyTreeId).toBe(TREE_SHA);
  });

  test('github policy source reports no published policy for a recorded listing without the policy directory', async () => {
    const result = await loadPolicy(sourceFor('contents-github-without-policy.json'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('policy-source.not-published');
    }
  });

  test('recorded policy directory responses contain no credential', () => {
    for (const name of FIXTURE_FILES) {
      const text = fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
      expect(findCredentialDetector(text)).toBeNull();
    }
  });
});
