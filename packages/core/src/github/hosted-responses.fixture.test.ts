import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createGitHubClient } from './client.js';
import { createGitHubBudget } from './budget.js';
import { listOwnershipArtifacts } from './artifacts.js';
import { newestOwnershipArtifact } from '../ownership/artifacts.js';
import { readRunList } from './runs.js';
import { githubBotUserSchema } from './app-auth.js';
import { readBranchHead } from './reader.js';
import { githubTreeResponseSchema, githubContentsEntrySchema } from './schemas.js';
import { githubGitCommitResponseSchema } from '../evidence/git-store.js';
import { evidenceCompareSchema, verifyAppendOnlyCompare, verifyReadBackTree } from '../evidence/store-checks.js';
import { githubContentsFileSchema } from '../evidence/fallback-read.js';
import { findCredentialDetector } from '../redaction/detectors.js';

const hostedFixturesDir = fileURLToPath(new URL('../../../../fixtures/github/hosted/', import.meta.url));

function fixturePath(name: string): string {
  return fileURLToPath(new URL('../../../../fixtures/github/hosted/' + name, import.meta.url));
}

function readFixtureText(name: string): string {
  return readFileSync(fixturePath(name), 'utf8');
}

function readFixtureJson<T>(name: string): T {
  return JSON.parse(readFixtureText(name)) as T;
}

const repository = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };

function clientFor(name: string) {
  const text = readFixtureText(name);
  return createGitHubClient({
    token: null,
    budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }),
    fetch: () => Promise.resolve(new Response(text, { status: 200 })),
  });
}

describe('recorded hosted GitHub responses', () => {
  it('recorded artifact listing maps to ownership artifacts', async () => {
    const page = readFixtureJson<{
      readonly artifacts: readonly {
        readonly id: number;
        readonly name: string;
        readonly expired: boolean;
        readonly created_at: string | null;
        readonly expires_at: string | null;
        readonly workflow_run: { readonly id: number | null } | null;
      }[];
    }>('artifacts-page.json');

    const result = await listOwnershipArtifacts(clientFor('artifacts-page.json'), repository, 'steward-ownership-pr-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.complete).toBe(true);
    expect(result.value.items).toHaveLength(page.artifacts.length);
    page.artifacts.forEach((artifact, index) => {
      const item = result.value.items[index];
      expect(item?.id).toBe(artifact.id);
      expect(item?.name).toBe(artifact.name);
      expect(item?.expired).toBe(artifact.expired);
      expect(item?.createdAt).toBe(artifact.created_at);
      expect(item?.expiresAt).toBe(artifact.expires_at);
      expect(item?.workflowRunId).toBe(artifact.workflow_run?.id ?? null);
    });

    const firstName = page.artifacts[0]?.name as string;
    const newest = newestOwnershipArtifact(result.value, firstName);
    expect(['unique', 'ambiguous']).toContain(newest.kind);
  });

  it('recorded run lists map to cap query results', async () => {
    const page = readFixtureJson<{
      readonly total_count: number;
      readonly workflow_runs: readonly {
        readonly id: number;
        readonly path: string;
        readonly event: string;
        readonly status: string | null;
        readonly created_at: string;
        readonly display_title: string;
      }[];
    }>('runs-page.json');

    const result = await readRunList(clientFor('runs-page.json'), repository, { kind: 'created-since', date: '2026-09-27' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.complete).toBe(true);
    expect(result.value.totalCount).toBe(page.total_count);
    expect(result.value.items).toHaveLength(page.workflow_runs.length);
    page.workflow_runs.forEach((run, index) => {
      const item = result.value.items[index];
      expect(item?.id).toBe(run.id);
      expect(item?.path).toBe(run.path);
      expect(item?.event).toBe(run.event);
      expect(item?.createdAt).toBe(run.created_at);
      expect(item?.displayTitle).toBe(run.display_title);
      expect(item?.status).toBe(run.status ?? '');
      expect(item?.path).toMatch(/^\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml$/);
    });

    const inProgressPage = readFixtureJson<{ readonly total_count: number }>('runs-in-progress.json');
    const inProgressResult = await readRunList(clientFor('runs-in-progress.json'), repository, {
      kind: 'status',
      status: 'in_progress',
    });
    expect(inProgressResult.ok).toBe(true);
    if (!inProgressResult.ok) return;
    expect(inProgressResult.value.totalCount).toBe(inProgressPage.total_count);
  });

  it('recorded git commit and compare responses validate', async () => {
    const headResult = await readBranchHead(clientFor('ref-heads-master.json'), repository, 'master');
    expect(headResult.ok).toBe(true);
    if (headResult.ok) {
      expect(headResult.value).toMatch(/^[0-9a-f]{40}$/);
    }

    const commit = readFixtureJson<unknown>('git-commit-master.json');
    expect(githubGitCommitResponseSchema.safeParse(commit).success).toBe(true);

    const compare = readFixtureJson<{ readonly status: string; readonly ahead_by: number; readonly behind_by: number }>(
      'compare-parent-master.json',
    );
    const compareParsed = evidenceCompareSchema.safeParse(compare);
    expect(compareParsed.success).toBe(true);
    if (!compareParsed.success) return;
    const files = compareParsed.data.files ?? [];
    const appendOnlyResult = verifyAppendOnlyCompare(
      compareParsed.data,
      files.map((file) => file.filename),
    );
    const expectedOk =
      compare.status === 'ahead' &&
      compare.ahead_by === 1 &&
      compare.behind_by === 0 &&
      files.every((file) => file.status === 'added');
    expect(appendOnlyResult.ok).toBe(expectedOk);
  });

  it('a recorded subtree read supports the read-back check', () => {
    const tree = readFixtureJson<{
      readonly truncated: boolean;
      readonly tree: readonly { readonly path: string; readonly mode: string; readonly type: string; readonly sha: string }[];
    }>('tree-master-github.json');
    const parsed = githubTreeResponseSchema.safeParse(tree);
    expect(parsed.success).toBe(true);
    expect(tree.truncated).toBe(false);

    const blob = tree.tree.find((entry) => entry.type === 'blob' && entry.mode === '100644');
    expect(blob).toBeDefined();
    if (blob === undefined) return;

    const entries = tree.tree.map((entry) => ({ path: entry.path, type: entry.type, sha: entry.sha, mode: entry.mode }));
    const matchResult = verifyReadBackTree(entries, [{ path: blob.path, blobId: blob.sha }], 'contains');
    expect(matchResult.ok).toBe(true);

    const mismatchResult = verifyReadBackTree(entries, [{ path: blob.path, blobId: '0'.repeat(40) }], 'contains');
    expect(mismatchResult.ok).toBe(false);
  });

  it('recorded file contents decode for the fallback read', () => {
    const readme = readFixtureJson<{ readonly content: string; readonly size: number }>('contents-readme.json');
    expect(githubContentsFileSchema.safeParse(readme).success).toBe(true);
    const stripped = readme.content.replace(/[\n\r]/g, '');
    expect(Buffer.from(stripped, 'base64').length).toBe(readme.size);

    const entries = readFixtureJson<readonly unknown[]>('contents-github-directory.json');
    for (const entry of entries) {
      expect(githubContentsEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it('the recorded app bot user validates', () => {
    const user = readFixtureJson<unknown>('user-app-bot.json');
    const parsed = githubBotUserSchema.safeParse(user);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.id).toBe(331019482);
    expect(parsed.data.login).toBe('patch-steward-testbed[bot]');
  });

  it('recorded hosted responses contain no credential', () => {
    const files = readdirSync(hostedFixturesDir).filter((name) => name.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const name of files) {
      const text = readFixtureText(name);
      expect(findCredentialDetector(text)).toBeNull();
    }
  });
});
