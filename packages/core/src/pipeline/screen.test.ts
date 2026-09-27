import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, afterEach } from 'vitest';

import type { GitHubFetch } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type {
  AttachmentAddress,
  AttachmentResolver,
  AttachmentTransport,
  AttachmentTransportResponse,
} from '../net/attachment-fetch.js';
import { fixedClock, fixedRandom } from '../clock.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { localFileRevisionId } from '../hash.js';
import { err } from '../result.js';
import type { GateInput, GateResult } from './gate.js';
import { runGate } from './gate.js';
import {
  SCREEN_EXIT_BY_OUTCOME,
  screenPolicyInfo,
  screenPreRunExitStatus,
  screenPublishFailure,
  screenSubmission,
} from './screen.js';

const TESTBED_REPO: GitHubRepositoryRef = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
const T_BASE = '/repos/steady-orchard/patch-steward-testbed-public';
const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';
const CLOCK = fixedClock('2026-09-27T10:15:00.000Z');
const RANDOM = fixedRandom('3f9a1c2e');

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'm5-screen-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }
});

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

interface CommonDepsOverrides {
  readonly repository?: GitHubRepositoryRef;
  readonly submission?: { readonly type: 'issue' | 'pull_request'; readonly number: number };
  readonly policySource?: { readonly kind: 'trusted-branch' } | { readonly kind: 'local-file'; readonly path: string };
  readonly evidenceDir: string;
  readonly fetch: GitHubFetch;
  readonly phaseTimeoutMs?: number;
  readonly gate?: (input: GateInput) => Promise<GateResult>;
  readonly phases?: Partial<Parameters<typeof screenSubmission>[0]>['phases'];
}

function commonDeps(overrides: CommonDepsOverrides): Parameters<typeof screenSubmission>[0] {
  return {
    repository: overrides.repository ?? TESTBED_REPO,
    submission: overrides.submission ?? { type: 'issue', number: 29 },
    policySource: overrides.policySource ?? { kind: 'local-file', path: templatePolicyPath() },
    token: null,
    evidenceDir: overrides.evidenceDir,
    clock: CLOCK,
    random: RANDOM,
    sleep: noopSleep,
    attachmentResolver: fakeResolver(),
    attachmentTransport: fakeTransport(),
    fetch: overrides.fetch,
    ...(overrides.phaseTimeoutMs !== undefined ? { phaseTimeoutMs: overrides.phaseTimeoutMs } : {}),
    ...(overrides.gate !== undefined ? { gate: overrides.gate } : {}),
    ...(overrides.phases !== undefined ? { phases: overrides.phases } : {}),
  };
}

function testbedRepository(): unknown {
  return readJsonFixture('github/testbed/repository.json');
}

describe('screenSubmission', () => {
  it('screen completes an unstructured issue with needs-changes and exit 1', async () => {
    const evidenceDir = makeTmpDir();
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/issues/29`]: readJsonFixture('github/testbed/issue-29.json'),
    };
    const result = await screenSubmission(commonDeps({ evidenceDir, fetch: makeFetch(routes) }));
    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') return;
    expect(result.exitStatus).toBe(1);
    expect(result.decision.outcome).toBe('needs-changes');
    expect(result.policy.source).toBe('local-file');
    expect(result.policy.authoritative).toBe(false);
    expect(result.published.report).toContain('Non-authoritative:');
    const runDir = join(evidenceDir, 'steady-orchard', 'patch-steward-testbed-public', 'runs', 'issue-29', RUN_ID);
    expect(() => readFileSync(join(runDir, 'manifest.json'))).not.toThrow();
  });

  it('screen completes a complete defect issue with inconclusive and exit 3', async () => {
    const evidenceDir = makeTmpDir();
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/issues/29`]: withBody(
        readJsonFixture('github/testbed/issue-29.json'),
        readTextFixture('submissions/defect-complete.txt'),
      ),
    };
    const result = await screenSubmission(commonDeps({ evidenceDir, fetch: makeFetch(routes) }));
    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') return;
    expect(result.exitStatus).toBe(3);
    expect(result.decision.outcome).toBe('inconclusive');
    expect(result.decision.causes.map((c) => c.cause)).toEqual(['stage-incomplete']);
    const runDir = join(evidenceDir, 'steady-orchard', 'patch-steward-testbed-public', 'runs', 'issue-29', RUN_ID);
    const logText = readFileSync(join(runDir, 'logs', 'steward.txt'), 'utf8');
    expect(logText).toContain('gate complete');
    expect(logText).toContain('phase assess complete');
  });

  it('screen derives the run id from the injected clock and random source', async () => {
    const evidenceDir = makeTmpDir();
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/issues/29`]: withBody(
        readJsonFixture('github/testbed/issue-29.json'),
        readTextFixture('submissions/defect-complete.txt'),
      ),
    };
    const result = await screenSubmission(commonDeps({ evidenceDir, fetch: makeFetch(routes) }));
    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') return;
    expect(result.published.run.run_id).toBe(RUN_ID);
    expect(result.published.run.run_attempt).toBe(1);
    expect(result.published.run.started_at).toBe('2026-09-27T10:15:00.000Z');
  });

  it('screen reports a missing published policy as not-started with exit 2', async () => {
    const evidenceDir = makeTmpDir();
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/git/ref/heads/master`]: readJsonFixture('github/testbed/ref-heads-master.json'),
      [`${T_BASE}/contents/.github`]: readJsonFixture('github/testbed/contents-github.json'),
    };
    const result = await screenSubmission(
      commonDeps({ evidenceDir, fetch: makeFetch(routes), policySource: { kind: 'trusted-branch' } }),
    );
    expect(result.kind).toBe('not-started');
    if (result.kind !== 'not-started') return;
    expect(result.stage).toBe('policy');
    expect(result.failure.code).toBe('screen.policy-missing');
    expect(result.exitStatus).toBe(2);
    expect(result.repository).toBe('steady-orchard/patch-steward-testbed-public');
    expect(result.policy).toBeNull();
    expect(() => readFileSync(join(evidenceDir, 'steady-orchard'))).toThrow();
  });

  it('screen reports an invalid policy file as not-started with exit 1', async () => {
    const evidenceDir = makeTmpDir();
    const routes: RouteMap = { [T_BASE]: testbedRepository() };
    const result = await screenSubmission(
      commonDeps({
        evidenceDir,
        fetch: makeFetch(routes),
        policySource: { kind: 'local-file', path: fixturePath('policies/invalid/unknown-key.txt') },
      }),
    );
    expect(result.kind).toBe('not-started');
    if (result.kind !== 'not-started') return;
    expect(result.exitStatus).toBe(1);
    expect(result.failure.code).toBe('screen.policy-file-invalid');
    expect(() => readFileSync(join(evidenceDir, 'steady-orchard'))).toThrow();
  });

  it('screen reports an unwritable evidence directory as publish-failed with exit 2', async () => {
    const tmp = makeTmpDir();
    const evidenceDir = join(tmp, 'not-a-directory');
    writeFileSync(evidenceDir, '');
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/issues/29`]: withBody(
        readJsonFixture('github/testbed/issue-29.json'),
        readTextFixture('submissions/defect-complete.txt'),
      ),
    };
    const result = await screenSubmission(commonDeps({ evidenceDir, fetch: makeFetch(routes) }));
    expect(result.kind).toBe('publish-failed');
    if (result.kind !== 'publish-failed') return;
    expect(result.exitStatus).toBe(2);
    expect(result.failure.code).toBe('screen.evidence-write-failed');
    expect(result.failure.details[0]?.code).toBe('evidence.write-failed');
    expect(result.run.run_id).toBe(RUN_ID);
    expect(() =>
      readFileSync(join(tmp, 'steady-orchard', 'patch-steward-testbed-public', 'runs', 'issue-29', RUN_ID, 'manifest.json')),
    ).toThrow();
  });

  it('screen maps a thrown gate to not-started', async () => {
    const evidenceDir = makeTmpDir();
    const routes: RouteMap = { [T_BASE]: testbedRepository() };
    const result = await screenSubmission(
      commonDeps({
        evidenceDir,
        fetch: makeFetch(routes),
        gate: async () => {
          throw new Error('injected gate failure');
        },
      }),
    );
    expect(result.kind).toBe('not-started');
    if (result.kind !== 'not-started') return;
    expect(result.stage).toBe('gate');
    expect(result.failure.code).toBe('pipeline.phase-failed');
    expect(result.exitStatus).toBe(2);
  });

  it('screen maps a gate timeout to not-started', async () => {
    const evidenceDir = makeTmpDir();
    const routes: RouteMap = { [T_BASE]: testbedRepository() };
    const result = await screenSubmission(
      commonDeps({
        evidenceDir,
        fetch: makeFetch(routes),
        phaseTimeoutMs: 20,
        gate: () => new Promise<GateResult>(() => undefined),
      }),
    );
    expect(result.kind).toBe('not-started');
    if (result.kind !== 'not-started') return;
    expect(result.stage).toBe('gate');
    expect(result.failure.code).toBe('pipeline.phase-timeout');
    expect(result.exitStatus).toBe(2);
  });

  it('screen rejects a gate handoff that is not bound to the run', async () => {
    const evidenceDir = makeTmpDir();
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/issues/29`]: withBody(
        readJsonFixture('github/testbed/issue-29.json'),
        readTextFixture('submissions/defect-complete.txt'),
      ),
    };
    const tamperedGate = async (input: GateInput): Promise<GateResult> => {
      const result = await runGate(input);
      if (!result.ok) {
        return result;
      }
      const handoff = result.value.handoff as { readonly snapshot_hash: string };
      return {
        ok: true,
        value: { ...result.value, handoff: { ...handoff, snapshot_hash: 'sha256:' + '6'.repeat(64) } },
      };
    };
    const result = await screenSubmission(commonDeps({ evidenceDir, fetch: makeFetch(routes), gate: tamperedGate }));
    expect(result.kind).toBe('not-started');
    if (result.kind !== 'not-started') return;
    expect(result.stage).toBe('gate');
    expect(result.failure.code).toBe('pipeline.handoff-binding');
    expect(() => readFileSync(join(evidenceDir, 'steady-orchard'))).toThrow();
  });

  it('screen records a failing phase as a cause and still publishes', async () => {
    const evidenceDir = makeTmpDir();
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/issues/29`]: withBody(
        readJsonFixture('github/testbed/issue-29.json'),
        readTextFixture('submissions/defect-complete.txt'),
      ),
    };
    const result = await screenSubmission(
      commonDeps({
        evidenceDir,
        fetch: makeFetch(routes),
        phases: {
          intake: async () => {
            throw new Error('injected phase failure');
          },
        },
      }),
    );
    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') return;
    expect(result.exitStatus).toBe(3);
    const codes = result.decision.causes.map((c) => c.code);
    expect(codes.indexOf('pipeline.phase-failed')).toBeGreaterThanOrEqual(0);
    expect(codes.indexOf('pipeline.stage-incomplete')).toBeGreaterThan(codes.indexOf('pipeline.phase-failed'));
  });

  it('screen counts GitHub requests and retries in the run record', async () => {
    const evidenceDir = makeTmpDir();
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [`${T_BASE}/pulls/26`]: withBody(
        readJsonFixture('github/testbed/pull-26.json'),
        readTextFixture('submissions/pr-bugfix-complete.txt'),
      ),
      [`${T_BASE}/pulls/26/files`]: readJsonFixture('github/testbed/pull-26-files.json'),
      [`${T_BASE}/commits/b46eef5018c202bcb2470bf62e3defd7496ec65b/pulls`]: readJsonFixture(
        'github/testbed/commit-pulls-b46eef5.json',
      ),
      [`${T_BASE}/issues/29`]: 500,
    };
    const result = await screenSubmission(
      commonDeps({ evidenceDir, fetch: makeFetch(routes), submission: { type: 'pull_request', number: 26 } }),
    );
    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') return;
    expect(result.exitStatus).toBe(3);
    expect(result.decision.causes.map((c) => c.cause)).toEqual(['github-unavailable', 'stage-incomplete']);
    expect(result.published.run.budget.github_requests).toBe(9);
    expect(result.published.run.budget.retries).toBe(3);
  });

  it('screen reports an unavailable steward version as not-started', async () => {
    const evidenceDir = makeTmpDir();
    let called = false;
    const countingFetch: GitHubFetch = (url, init) => {
      called = true;
      return makeFetch({ [T_BASE]: testbedRepository() })(url, init);
    };
    const deps = commonDeps({ evidenceDir, fetch: countingFetch });
    const result = await screenSubmission({
      ...deps,
      version: () => err('steward.version-unavailable', 'steward-defect', 'The steward version could not be read.'),
    });
    expect(result.kind).toBe('not-started');
    if (result.kind !== 'not-started') return;
    expect(result.stage).toBe('version');
    expect(result.exitStatus).toBe(2);
    expect(called).toBe(false);
  });

  it('screen policy info follows the policy source', () => {
    const gitTree: LoadedPolicy = {
      revision: { kind: 'git-tree', id: 'a'.repeat(40), commit: 'b'.repeat(40), ref: 'master' },
      policy: DEFAULT_CHECKLIST_POLICY,
      authoritative: true,
    };
    expect(screenPolicyInfo(gitTree)).toEqual({
      source: 'trusted-branch',
      revision: 'a'.repeat(40),
      ref: 'master',
      commit: 'b'.repeat(40),
      path: null,
      authoritative: true,
    });

    const localRevisionId = localFileRevisionId(Buffer.from('c'.repeat(64), 'utf8'));
    const localFile: LoadedPolicy = {
      revision: { kind: 'local-file', id: localRevisionId, path: '/tmp/policy.yml' },
      policy: DEFAULT_CHECKLIST_POLICY,
      authoritative: false,
    };
    expect(screenPolicyInfo(localFile)).toEqual({
      source: 'local-file',
      revision: localRevisionId,
      ref: null,
      commit: null,
      path: '/tmp/policy.yml',
      authoritative: false,
    });
  });

  it('screen exit statuses follow the outcome', () => {
    expect(SCREEN_EXIT_BY_OUTCOME).toEqual({ pass: 0, 'needs-changes': 1, uncertain: 1, inconclusive: 3, superseded: 1 });
    expect(screenPreRunExitStatus(err('screen.policy-file-invalid', 'policy-invalid', 'x').failure)).toBe(1);
    expect(screenPreRunExitStatus(err('screen.policy-missing', 'policy-unavailable', 'x').failure)).toBe(2);
    const mapped = screenPublishFailure(err('evidence.too-large', 'budget-exhausted', 'x').failure);
    expect(mapped.code).toBe('screen.evidence-write-failed');
    expect(mapped.cause).toBe('budget-exhausted');
    expect(mapped.outcome).toBe('inconclusive');
    expect(mapped.details[0]?.code).toBe('evidence.too-large');
  });
});
