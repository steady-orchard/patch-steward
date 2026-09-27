import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import type { GitHubFetch } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type {
  AttachmentAddress,
  AttachmentResolver,
  AttachmentTransport,
  AttachmentTransportResponse,
} from '../net/attachment-fetch.js';
import { fixedClock } from '../clock.js';
import { validateHandoff } from './handoff.js';
import type { GateInput } from './gate.js';
import { runGate } from './gate.js';

const TESTBED_REPO: GitHubRepositoryRef = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
const EXAMPLE_REPO: GitHubRepositoryRef = { owner: 'example-owner', name: 'example-repo' };
const T_BASE = '/repos/steady-orchard/patch-steward-testbed-public';
const Y_BASE = '/repos/example-owner/example-repo';
const HEAD_SHA = 'b46eef5018c202bcb2470bf62e3defd7496ec65b';
const RUN = { run_id: 'local-20260927T101500Z-3f9a1c2e', run_attempt: 1 };
const CLOCK = fixedClock('2026-09-27T10:15:00.000Z');

function readTextFixture(relPath: string): string {
  return readFileSync(new URL(`../../../../fixtures/${relPath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

function readJsonFixture(relPath: string): unknown {
  return JSON.parse(readTextFixture(relPath));
}

function fixturePath(relPath: string): string {
  return fileURLToPath(new URL(`../../../../fixtures/${relPath}`, import.meta.url));
}

function templatePolicyPath(): string {
  return fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url));
}

function withBody(fixture: unknown, body: string | null): unknown {
  return { ...(fixture as Record<string, unknown>), body };
}

type RouteValue = unknown | number;
type RouteMap = Record<string, RouteValue>;

function makeFetch(routes: RouteMap): GitHubFetch {
  return (url: string) => {
    const pathname = new URL(url).pathname;
    if (!(pathname in routes)) {
      return Promise.resolve(new Response('{}', { status: 404 }));
    }
    const value = routes[pathname];
    if (typeof value === 'number') {
      return Promise.resolve(new Response('{}', { status: value }));
    }
    return Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
  };
}

function countingFetch(routes: RouteMap): { readonly fetch: GitHubFetch; readonly count: () => number } {
  const base = makeFetch(routes);
  let calls = 0;
  return {
    fetch: (url, init) => {
      calls += 1;
      return base(url, init);
    },
    count: () => calls,
  };
}

function fakeResolver(): AttachmentResolver {
  return async (): Promise<readonly AttachmentAddress[]> => [{ address: '140.82.112.3', family: 4 }];
}

function bodyFrom(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      let sent = false;
      return {
        async next(): Promise<IteratorResult<Uint8Array>> {
          if (!sent) {
            sent = true;
            return { done: false, value: bytes };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
}

function fakeTransport(): AttachmentTransport {
  return async (): Promise<AttachmentTransportResponse> => ({
    kind: 'response',
    status: 200,
    location: null,
    body: bodyFrom(new Uint8Array()),
    close: () => undefined,
  });
}

async function noopSleep(): Promise<void> {
  return undefined;
}

function baseInput(overrides: Partial<GateInput>): GateInput {
  return {
    repository: TESTBED_REPO,
    submission: { type: 'issue', number: 29 },
    policySource: { kind: 'local-file', path: templatePolicyPath() },
    token: null,
    sleep: noopSleep,
    attachmentResolver: fakeResolver(),
    attachmentTransport: fakeTransport(),
    run: RUN,
    clock: CLOCK,
    ...overrides,
  };
}

function testbedRepository(): unknown {
  return readJsonFixture('github/testbed/repository.json');
}

function testbedIssue29(body: string | null): unknown {
  return withBody(readJsonFixture('github/testbed/issue-29.json'), body);
}

function testbedPull26(body: string | null): unknown {
  return withBody(readJsonFixture('github/testbed/pull-26.json'), body);
}

describe('runGate', () => {
  it('gate captures an issue under a local policy file', async () => {
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/issues/29`]: testbedIssue29(readTextFixture('submissions/defect-complete.txt')),
    };
    const input = baseInput({ fetch: makeFetch(routes) });
    const result = await runGate(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { value } = result;

    const validated = validateHandoff(value.handoff, { previous: null, gate: null, maxRounds: 2 });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    expect(validated.value.policy_revision.startsWith('local:')).toBe(true);
    expect(validated.value.policy_revision).toBe(value.loadedPolicy.revision.id);
    expect(value.submission.snapshot?.policy_revision).toBe(value.loadedPolicy.revision.id);
    expect(validated.value.early_exit).toBeNull();
    expect(validated.value.findings).toEqual([]);
    expect(value.requiredStages).toEqual(['references', 'claim', 'reproduction']);
    expect(value.classification).toEqual({ type: 'issue', issueKind: 'defect' });
    expect(value.baseCommit).toBeNull();
    expect(value.mode).toBe('observe');
    expect(value.repository).toBe('steady-orchard/patch-steward-testbed-public');
    expect(value.defaultBranch).toBe('master');
    expect(value.loadedPolicy.authoritative).toBe(false);
  });

  it('gate records an unstructured issue', async () => {
    const recordedIssue = readJsonFixture('github/testbed/issue-29.json') as { readonly body: string };
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/issues/29`]: testbedIssue29(recordedIssue.body),
    };
    const input = baseInput({ fetch: makeFetch(routes) });
    const result = await runGate(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { value } = result;

    expect(value.submission.issue_kind).toBeNull();
    expect(value.submission.template).toBeNull();
    const handoff = value.handoff as {
      readonly early_exit: string | null;
      readonly findings: readonly { readonly code: string; readonly stage: string }[];
    };
    expect(handoff.early_exit).toBe('contract-needs-changes');
    expect(handoff.findings.map((f) => f.code)).toEqual(['submission.unstructured']);
    for (const finding of handoff.findings) {
      expect(finding.stage).toBe('contract');
    }
  });

  it('gate loads the published policy from the default branch', async () => {
    const routes: RouteMap = {
      [Y_BASE]: { full_name: 'example-owner/example-repo', default_branch: 'main', private: false },
      [`${Y_BASE}/git/ref/heads/main`]: readJsonFixture('github/policy-directory/ref-heads-main.json'),
      [`${Y_BASE}/contents/.github`]: readJsonFixture('github/policy-directory/contents-github.json'),
      [`${Y_BASE}/git/trees/a8c2485882b52f63db71b1ec63b12f5039220e03`]: readJsonFixture('github/policy-directory/tree.json'),
      [`${Y_BASE}/git/blobs/716098133e97314ccf047f5034cc8f76161d8f0d`]: readJsonFixture('github/policy-directory/blob-policy.json'),
      [`${Y_BASE}/issues/29`]: testbedIssue29(readTextFixture('submissions/defect-complete.txt')),
    };
    const input = baseInput({
      repository: EXAMPLE_REPO,
      policySource: { kind: 'trusted-branch' },
      fetch: makeFetch(routes),
    });
    const result = await runGate(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { value } = result;

    expect(value.loadedPolicy.revision).toEqual({
      kind: 'git-tree',
      id: 'a8c2485882b52f63db71b1ec63b12f5039220e03',
      commit: '0123456789abcdef0123456789abcdef01234567',
      ref: 'main',
    });
    expect(value.loadedPolicy.authoritative).toBe(true);
    const handoff = value.handoff as { readonly policy_revision: string };
    expect(handoff.policy_revision).toBe('a8c2485882b52f63db71b1ec63b12f5039220e03');
  });

  it('gate maps a missing published policy to screen.policy-missing', async () => {
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/git/ref/heads/master`]: readJsonFixture('github/testbed/ref-heads-master.json'),
      [`${T_BASE}/contents/.github`]: readJsonFixture('github/testbed/contents-github.json'),
    };
    const input = baseInput({ policySource: { kind: 'trusted-branch' }, fetch: makeFetch(routes) });
    const result = await runGate(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe('policy');
    expect(result.failure.code).toBe('screen.policy-missing');
    expect(result.failure.cause).toBe('policy-unavailable');
    expect(result.repository).toBe('steady-orchard/patch-steward-testbed-public');
    expect(result.loadedPolicy).toBeNull();
  });

  it('gate maps an invalid policy file to screen.policy-file-invalid', async () => {
    const routes: RouteMap = { [T_BASE]: testbedRepository() };
    const input = baseInput({
      policySource: { kind: 'local-file', path: fixturePath('policies/invalid/unknown-key.txt') },
      fetch: makeFetch(routes),
    });
    const result = await runGate(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe('policy');
    expect(result.failure.code).toBe('screen.policy-file-invalid');
    expect(result.failure.cause).toBe('policy-invalid');
    expect(result.failure.details.some((d) => d.code === 'policy.unknown-key')).toBe(true);
  });

  it('gate passes through an unreadable policy file', async () => {
    const routes: RouteMap = { [T_BASE]: testbedRepository() };
    const missingPath = join(tmpdir(), 'm5-gate-missing', 'policy.yml');
    const input = baseInput({ policySource: { kind: 'local-file', path: missingPath }, fetch: makeFetch(routes) });
    const result = await runGate(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe('policy');
    expect(result.failure.code).toBe('file.not-found');
  });

  it('gate reports a repository read failure at the repository stage', async () => {
    const routes: RouteMap = {};
    const input = baseInput({ repository: { owner: 'octo', name: 'missing' }, fetch: makeFetch(routes) });
    const result = await runGate(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe('repository');
    expect(result.failure.code).toBe('github.not-found');
    expect(result.repository).toBeNull();
  });

  it('gate reports a capture failure at the capture stage', async () => {
    const routes: RouteMap = { [T_BASE]: testbedRepository() };
    const input = baseInput({ submission: { type: 'issue', number: 31 }, fetch: makeFetch(routes) });
    const result = await runGate(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe('capture');
    expect(result.failure.code).toBe('github.not-found');
    expect(result.loadedPolicy).not.toBeNull();
  });

  it('gate records contract causes and the early exit', async () => {
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/pulls/26`]: testbedPull26(readTextFixture('submissions/pr-bugfix-complete.txt')),
      [`${T_BASE}/pulls/26/files`]: readJsonFixture('github/testbed/pull-26-files.json'),
      [`${T_BASE}/commits/${HEAD_SHA}/pulls`]: readJsonFixture('github/testbed/commit-pulls-b46eef5.json'),
      [`${T_BASE}/issues/29`]: 500,
    };
    const input = baseInput({ submission: { type: 'pull_request', number: 26 }, fetch: makeFetch(routes) });
    const result = await runGate(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { value } = result;
    const handoff = value.handoff as {
      readonly causes: readonly { readonly cause: string; readonly code: string }[];
      readonly early_exit: string | null;
    };
    expect(handoff.causes).toEqual([
      { cause: 'github-unavailable', code: 'github.server-error', message: expect.any(String), subjects: expect.any(Array) },
    ]);
    expect(handoff.early_exit).toBe('contract-inconclusive');
  });

  it('gate plans required stages and classifies a pull request', async () => {
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/pulls/26`]: testbedPull26(readTextFixture('submissions/pr-bugfix-complete.txt')),
      [`${T_BASE}/pulls/26/files`]: readJsonFixture('github/testbed/pull-26-files.json'),
      [`${T_BASE}/commits/${HEAD_SHA}/pulls`]: readJsonFixture('github/testbed/commit-pulls-b46eef5.json'),
      [`${T_BASE}/issues/29`]: testbedIssue29(readTextFixture('submissions/defect-complete.txt')),
    };
    const input = baseInput({ submission: { type: 'pull_request', number: 26 }, fetch: makeFetch(routes) });
    const result = await runGate(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { value } = result;

    expect(value.requiredStages).toEqual(['references', 'claim', 'fix-verification', 'regression', 'challenge']);
    expect(value.classification).toEqual({
      type: 'pull_request',
      category: 'bugfix',
      consistent: true,
      plausible: ['bugfix', 'feature', 'refactor', 'security'],
    });
    expect(value.baseCommit).toBe('1c5c399b48a0ccca6a9989eacb6ebc2279e6a9c9');
    expect(value.mode).toBe('observe');
    const handoff = value.handoff as { readonly early_exit: string | null };
    expect(handoff.early_exit).toBeNull();
  });

  it('gate counts bootstrap and capture requests', async () => {
    const routes: RouteMap = {
      [Y_BASE]: { full_name: 'example-owner/example-repo', default_branch: 'main', private: false },
      [`${Y_BASE}/git/ref/heads/main`]: readJsonFixture('github/policy-directory/ref-heads-main.json'),
      [`${Y_BASE}/contents/.github`]: readJsonFixture('github/policy-directory/contents-github.json'),
      [`${Y_BASE}/git/trees/a8c2485882b52f63db71b1ec63b12f5039220e03`]: readJsonFixture('github/policy-directory/tree.json'),
      [`${Y_BASE}/git/blobs/716098133e97314ccf047f5034cc8f76161d8f0d`]: readJsonFixture('github/policy-directory/blob-policy.json'),
      [`${Y_BASE}/issues/29`]: testbedIssue29(readTextFixture('submissions/defect-complete.txt')),
    };
    const counting = countingFetch(routes);
    const input = baseInput({ repository: EXAMPLE_REPO, policySource: { kind: 'trusted-branch' }, fetch: counting.fetch });
    const result = await runGate(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { value } = result;

    expect(value.githubRequests).toBe(counting.count());
    expect(counting.count()).toBe(7);
    const handoff = value.handoff as { readonly budget_remaining: { readonly github_requests: number } };
    expect(handoff.budget_remaining.github_requests).toBe(300 - 2);
  });

  it('gate log lines name the policy, the disposition, and contract causes', async () => {
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/pulls/26`]: testbedPull26(readTextFixture('submissions/pr-bugfix-complete.txt')),
      [`${T_BASE}/pulls/26/files`]: readJsonFixture('github/testbed/pull-26-files.json'),
      [`${T_BASE}/commits/${HEAD_SHA}/pulls`]: readJsonFixture('github/testbed/commit-pulls-b46eef5.json'),
      [`${T_BASE}/issues/29`]: 500,
    };
    const input = baseInput({ submission: { type: 'pull_request', number: 26 }, fetch: makeFetch(routes) });
    const result = await runGate(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { value } = result;

    expect(value.logLines).toContain('contract disposition inconclusive');
    expect(value.logLines).toContain('cause github-unavailable github.server-error at gate');
    expect(value.logLines[0]?.startsWith('policy local-file revision local:')).toBe(true);
  });
});
