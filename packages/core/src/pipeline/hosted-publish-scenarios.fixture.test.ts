import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { fixedClock } from '../clock.js';
import { ok } from '../result.js';
import { createStoreWorld } from '../evidence/store-world.test.js';
import { buildRunName } from '../ownership/caps.js';
import { readGateEnvironment, readPublishEnvironment } from './hosted-environment.js';
import type { HostedGateEnvironment, HostedPublishEnvironment } from './hosted-environment.js';
import {
  createHostedWorld,
  gateEnvironment,
  ownershipArtifactZip,
  publishEnvironment,
  worldPolicyText,
  WORLD_AUTHOR_ID,
  WORLD_NOW,
  WORLD_REPOSITORY,
  WORLD_RUN_ID,
} from './hosted-world.test.js';
import type { HostedWorld } from './hosted-world.test.js';
import type { HostedGateDeps, HostedGateResult } from './hosted-gate.js';
import { runHostedGate } from './hosted-gate.js';
import type { HostedPublishDeps, HostedPublishFiles, HostedPublishResult } from './hosted-publish.js';
import { runHostedPublish } from './hosted-publish.js';

function payload(name: string): Uint8Array {
  const url = new URL('../../../../fixtures/events/' + name, import.meta.url);
  return new Uint8Array(readFileSync(fileURLToPath(url)));
}

function eventNameFor(name: string): string {
  return name.startsWith('pull-request-target') ? 'pull_request_target' : 'issues';
}

function environmentFor(world: HostedWorld, name: string, overrides?: Readonly<Record<string, string>>): HostedGateEnvironment {
  const env = readGateEnvironment(gateEnvironment(world, { GITHUB_EVENT_NAME: eventNameFor(name), ...overrides }));
  if (!env.ok) {
    throw new Error('test environment failed to build');
  }
  return env.value;
}

function buildGateDeps(world: HostedWorld): HostedGateDeps {
  return {
    fetch: world.fetch,
    sleep: async () => undefined,
    clock: fixedClock(WORLD_NOW),
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    mask: () => undefined,
    writeSummary: async () => undefined,
  };
}

async function gate(world: HostedWorld, name: string, overrides?: Readonly<Record<string, string>>): Promise<HostedGateResult> {
  const environment = environmentFor(world, name, overrides);
  return runHostedGate({ environment, payload: payload(name) }, buildGateDeps(world));
}

type SucceededGate = Extract<HostedGateResult, { ok: true }>;

function upload(world: HostedWorld, gateResult: SucceededGate, runId: number, createdAt: string) {
  const ownershipFile = gateResult.files.find((f) => f.name === 'ownership');
  if (ownershipFile === undefined) {
    throw new Error('expected an ownership file to upload');
  }
  return world.addArtifact({
    name: gateResult.outputs['ownership_artifact'] as string,
    createdAt,
    workflowRunId: runId,
    recordBytes: ownershipFile.bytes,
  });
}

function gateFilesOf(gateResult: SucceededGate): HostedPublishFiles {
  const find = (name: string): Uint8Array | null => gateResult.files.find((f) => f.name === name)?.bytes ?? null;
  return { handoff: find('handoff'), gateContext: find('gate-context'), closure: find('closure') };
}

async function publish(
  world: HostedWorld,
  gateResult: SucceededGate,
  overrides?: Readonly<Record<string, string>>,
  fileOverrides?: Partial<HostedPublishFiles>,
): Promise<{ readonly result: HostedPublishResult; readonly summaries: string[] }> {
  const environment = readPublishEnvironment(publishEnvironment(world, gateResult.outputs, overrides));
  if (!environment.ok) {
    throw new Error('test publish environment failed to build');
  }
  const summaries: string[] = [];
  const deps: HostedPublishDeps = {
    fetch: world.fetch,
    sleep: async (ms: number) => {
      world.requests.push({ method: 'SLEEP', host: '', path: String(ms) });
    },
    clock: fixedClock('2026-09-28T10:00:30.000Z'),
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    mask: () => undefined,
    writeSummary: async (t: string) => {
      summaries.push(t);
      world.requests.push({ method: 'SUMMARY', host: '', path: '' });
    },
    version: () => ok('0.0.2'),
  };
  const result = await runHostedPublish(
    { environment: environment.value as HostedPublishEnvironment, files: { ...gateFilesOf(gateResult), ...fileOverrides } },
    deps,
  );
  return { result, summaries };
}

function requireOk(result: HostedGateResult): SucceededGate {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('expected gate to succeed');
  }
  return result;
}

const RUN_DIR_PREFIX = `${WORLD_REPOSITORY}/runs/issue-29/${String(WORLD_RUN_ID)}-1/`;

describe('hosted publish scenarios', () => {
  it('evidence commit precedes the summary write', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');

    const start = world.requests.length;
    const { result } = await publish(world, first);
    expect(result.ok).toBe(true);

    const after = world.requests.slice(start);
    const refIndices = after
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.path.endsWith('/git/refs') || r.path.endsWith('/git/refs/heads/steward-evidence'))
      .map(({ i }) => i);
    const treeReadBackIndices = after
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => /\/git\/trees\/[0-9a-f]+:/.test(r.path))
      .map(({ i }) => i);
    const summaryIndices = after
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.method === 'SUMMARY')
      .map(({ i }) => i);
    const sleepIndices = after
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.method === 'SLEEP' && r.path === '10000')
      .map(({ i }) => i);

    expect(summaryIndices.length).toBe(1);
    const summaryIndex = summaryIndices[0] as number;
    expect(refIndices.length).toBeGreaterThan(0);
    const lastRefIndex = Math.max(...refIndices);
    expect(lastRefIndex).toBeLessThan(summaryIndex);
    expect(treeReadBackIndices.length).toBeGreaterThan(0);
    for (const treeIndex of treeReadBackIndices) {
      expect(treeIndex).toBeLessThan(summaryIndex);
    }
    expect(sleepIndices.length).toBe(1);
    expect(sleepIndices[0] as number).toBeGreaterThan(lastRefIndex);
  });

  it('a newer owner supersedes and records the successor attempt', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');

    const before = new Map(store.files(WORLD_REPOSITORY));

    const issue = world.issues.get(29);
    if (issue !== undefined) {
      issue.body = (issue.body ?? '') + '\nrun B edit';
    }
    const runBId = WORLD_RUN_ID + 5;
    const second = requireOk(await gate(world, 'issues-edited.json', { GITHUB_RUN_ID: String(runBId), GITHUB_RUN_ATTEMPT: '2' }));
    upload(world, second, runBId, '2026-09-28T10:00:09Z');

    const { result } = await publish(world, first);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('superseded');

    const supersessionPath = `${WORLD_REPOSITORY}/runs/issue-29/supersessions/${String(WORLD_RUN_ID)}-1.json`;
    const files = store.files(WORLD_REPOSITORY);
    const recordBytes = files.get(supersessionPath);
    expect(recordBytes).toBeDefined();
    if (recordBytes === undefined) return;
    const record = JSON.parse(new TextDecoder().decode(recordBytes)) as {
      readonly reason: string;
      readonly successor: { readonly run_id: number; readonly run_attempt: number; readonly artifact_created_at: string } | null;
    };
    expect(record.reason).toBe('newer-owner');
    expect(record.successor).toEqual({ run_id: runBId, run_attempt: 2, artifact_created_at: '2026-09-28T10:00:09Z' });

    for (const [path, bytes] of before.entries()) {
      if (!path.startsWith(RUN_DIR_PREFIX)) continue;
      expect(files.get(path)).toEqual(bytes);
    }
  });

  it('a changed snapshot supersedes', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');

    const issue = world.issues.get(29);
    if (issue !== undefined) {
      issue.body = (issue.body ?? '') + '\nchanged before recapture';
    }

    const { result } = await publish(world, first);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('superseded');

    const supersessionPath = `${WORLD_REPOSITORY}/runs/issue-29/supersessions/${String(WORLD_RUN_ID)}-1.json`;
    const files = store.files(WORLD_REPOSITORY);
    const recordBytes = files.get(supersessionPath);
    expect(recordBytes).toBeDefined();
    if (recordBytes === undefined) return;
    const record = JSON.parse(new TextDecoder().decode(recordBytes)) as {
      readonly reason: string;
      readonly successor: unknown;
      readonly live_snapshot_hash: string | null;
      readonly recorded_snapshot_hash: string;
    };
    expect(record.reason).toBe('snapshot-changed');
    expect(record.successor).toBeNull();
    expect(record.live_snapshot_hash).not.toBeNull();
    expect(record.live_snapshot_hash).not.toBe(record.recorded_snapshot_hash);
  });

  it('a tie that includes this run fails publication without supersession', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    const ownershipFile = first.files.find((f) => f.name === 'ownership');
    if (ownershipFile === undefined) throw new Error('expected an ownership file');
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');
    world.addArtifact({
      name: first.outputs['ownership_artifact'] as string,
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID + 1,
      zip: ownershipArtifactZip(ownershipFile.bytes),
    });

    const { result, summaries } = await publish(world, first);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('publish.freshness-unknown');
    expect(result.evidenceCommit).not.toBeNull();
    expect(world.requests.some((r) => r.path.includes('/supersessions/'))).toBe(false);
    expect(summaries.some((s) => s.includes('`unknown`') && s.includes('publish.freshness-unknown'))).toBe(true);
  });

  it('an incomplete listing fails publication without supersession', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    const ownershipFile = first.files.find((f) => f.name === 'ownership');
    if (ownershipFile === undefined) throw new Error('expected an ownership file');
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');
    world.addArtifact({
      name: first.outputs['ownership_artifact'] as string,
      createdAt: 'not-a-date',
      expiresAt: '2026-12-27T10:00:05Z',
      workflowRunId: WORLD_RUN_ID + 2,
      zip: ownershipArtifactZip(ownershipFile.bytes),
    });

    const { result } = await publish(world, first);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('publish.freshness-unknown');
    expect(result.failure.details[0]?.path).toBe('listing-incomplete');
    expect(world.requests.some((r) => r.path.includes('/supersessions/'))).toBe(false);
  });

  it('an unavailable successor read fails publication without supersession', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');
    world.addArtifact({
      name: first.outputs['ownership_artifact'] as string,
      createdAt: '2026-09-28T10:00:09Z',
      workflowRunId: WORLD_RUN_ID + 3,
      zip: new Uint8Array([0, 1, 2, 3]),
    });

    const { result } = await publish(world, first);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('publish.freshness-unknown');
    expect(result.failure.details[0]?.path).toBe('successor-unavailable');
    expect(world.requests.some((r) => r.path.includes('/supersessions/'))).toBe(false);
  });

  it('a publish failure before the commit leaves no evidence', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');
    world.override((request) => {
      if (request.method === 'POST' && request.url.pathname.endsWith('/git/blobs')) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });

    const { result, summaries } = await publish(world, first);
    expect(result.ok).toBe(false);
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
    expect(summaries.some((s) => s.includes('`failed`'))).toBe(true);
    for (const outcome of ['`inconclusive`', '`needs-changes`', '`pass`']) {
      expect(summaries.some((s) => s.includes(outcome))).toBe(false);
    }
  });

  it('publish reads the policy by tree id and not the live policy before the commit', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');

    const start = world.requests.length;
    const { result } = await publish(world, first);
    expect(result.ok).toBe(true);

    const after = world.requests.slice(start);
    const firstBlobIndex = after.findIndex((r) => r.method === 'POST' && r.path.endsWith('/git/blobs'));
    expect(firstBlobIndex).toBeGreaterThan(-1);
    const before = after.slice(0, firstBlobIndex);
    const policyRevision = first.outputs['policy_revision'] as string;
    expect(before.some((r) => r.path.endsWith(`/git/trees/${policyRevision}?recursive=1`))).toBe(true);
    expect(before.some((r) => r.path.endsWith('/git/ref/heads/master'))).toBe(false);
    expect(before.some((r) => r.path.startsWith(`/repos/${WORLD_REPOSITORY}/contents/.github`))).toBe(false);
  });

  it('a binding mismatch fails before any evidence request', async () => {
    // (a) a mismatched runner run id
    {
      const store = createStoreWorld();
      const world = createHostedWorld({ handlers: [store.handler] });
      const first = requireOk(await gate(world, 'issues-opened.json'));
      upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');

      const start = world.requests.filter((r) => r.method !== 'SLEEP' && r.method !== 'SUMMARY').length;
      const { result } = await publish(world, first, { GITHUB_RUN_ID: String(WORLD_RUN_ID + 1) });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('pipeline.handoff-binding');
      }
      const after = world.requests.filter((r) => r.method !== 'SLEEP' && r.method !== 'SUMMARY').length;
      expect(after).toBe(start);
    }

    // (b) an edited handoff run_attempt
    {
      const store = createStoreWorld();
      const world = createHostedWorld({ handlers: [store.handler] });
      const first = requireOk(await gate(world, 'issues-opened.json'));
      upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');

      const handoffFile = first.files.find((f) => f.name === 'handoff');
      if (handoffFile === undefined) throw new Error('expected a handoff file');
      const decoded = JSON.parse(new TextDecoder().decode(handoffFile.bytes)) as { run: { run_attempt: number } };
      decoded.run.run_attempt = 2;
      const editedHandoff = new TextEncoder().encode(JSON.stringify(decoded));

      const { result } = await publish(world, first, undefined, { handoff: editedHandoff });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(['pipeline.handoff-binding', 'pipeline.handoff-invalid']).toContain(result.failure.code);
      }
      expect(world.requests.some((r) => r.method === 'POST' && r.path.endsWith('/git/blobs'))).toBe(false);
    }

    // (c) an own artifact whose record comes from a different gate run of the same submission
    {
      const store = createStoreWorld();
      const world = createHostedWorld({ handlers: [store.handler] });
      const first = requireOk(await gate(world, 'issues-opened.json'));

      const issue = world.issues.get(29);
      if (issue !== undefined) {
        issue.body = (issue.body ?? '') + '\nanother run edit';
      }
      const otherRunId = WORLD_RUN_ID + 7;
      const other = requireOk(await gate(world, 'issues-edited.json', { GITHUB_RUN_ID: String(otherRunId) }));
      upload(world, other, WORLD_RUN_ID, '2026-09-28T10:00:05Z');

      const start = world.requests.length;
      const { result } = await publish(world, first);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(['ownership.record-invalid', 'pipeline.handoff-binding']).toContain(result.failure.code);
      }
      expect(world.requests.slice(start).some((r) => r.method === 'POST' && r.path.endsWith('/git/blobs'))).toBe(false);
    }
  });

  it('an over-cap run publishes a waiting run directory', async () => {
    const policyText = worldPolicyText([['daily_runs: 50', 'daily_runs: 1']]);
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler], policyText });
    world.runs.createdToday.push({
      id: WORLD_RUN_ID - 1000,
      path: '.github/workflows/steward-issues.yml',
      event: 'issues',
      status: 'completed',
      createdAt: WORLD_NOW,
      displayTitle: buildRunName({
        kind: 'issue',
        number: 29,
        authorId: WORLD_AUTHOR_ID,
        eventName: 'issues',
        action: 'opened',
        senderId: WORLD_AUTHOR_ID,
        senderType: 'User',
      }),
    });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    expect(first.disposition).toBe('queued');
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');

    const { result } = await publish(world, first);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('queued');

    const waitingPath = `${RUN_DIR_PREFIX}waiting.json`;
    const decisionPath = `${RUN_DIR_PREFIX}decision.json`;
    const files = store.files(WORLD_REPOSITORY);
    const waitingBytes = files.get(waitingPath);
    expect(waitingBytes).toBeDefined();
    if (waitingBytes === undefined) return;
    const waiting = JSON.parse(new TextDecoder().decode(waitingBytes)) as { readonly arrival_at: string };
    expect(waiting.arrival_at).toBe('2026-09-28T10:00:05Z');
    expect(files.has(decisionPath)).toBe(false);
  });

  it('a closure publishes a metrics-only commit', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');

    const closureRunId = WORLD_RUN_ID + 9;
    const closed = requireOk(await gate(world, 'issues-closed.json', { GITHUB_RUN_ID: String(closureRunId) }));
    expect(closed.disposition).toBe('closure');

    const start = world.requests.length;
    const { result } = await publish(world, closed, { GITHUB_RUN_ID: String(closureRunId) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('closure');

    const requestsSincePublishStore = world.requests.slice(start).filter((r) => r.path.startsWith(`/repos/${WORLD_REPOSITORY}`));
    const files = store.files(WORLD_REPOSITORY);
    const metricsPattern = new RegExp(`^${WORLD_REPOSITORY}/metrics/2026-09/${String(closureRunId)}-1\\.json$`);
    const matches = [...files.keys()].filter((k) => metricsPattern.test(k));
    expect(matches.length).toBe(1);
    expect(requestsSincePublishStore.length).toBeGreaterThan(0);

    const metricsBytes = files.get(matches[0] as string);
    expect(metricsBytes).toBeDefined();
    if (metricsBytes === undefined) return;
    const events = JSON.parse(new TextDecoder().decode(metricsBytes)) as readonly {
      readonly kind: string;
      readonly payload: { readonly resolution: string };
    }[];
    expect(events.length).toBe(1);
    expect(events[0]?.kind).toBe('maintainer-resolution');
    expect(events[0]?.payload.resolution).toBe('closed-by-author');
  });

  it('the evidence store stays append-only across runs', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });

    let commitsExpected = 0;

    const first = requireOk(await gate(world, 'issues-opened.json'));
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');
    const beforeA = new Map(store.files(WORLD_REPOSITORY));
    const publishA = await publish(world, first);
    expect(publishA.result.ok).toBe(true);
    commitsExpected += 1;
    const afterA = store.files(WORLD_REPOSITORY);
    for (const [path, bytes] of beforeA.entries()) {
      expect(afterA.get(path)).toEqual(bytes);
    }

    const issue = world.issues.get(29);
    if (issue !== undefined) {
      issue.body = (issue.body ?? '') + '\nrun B body';
    }
    const runBId = WORLD_RUN_ID + 1;
    const second = requireOk(await gate(world, 'issues-edited.json', { GITHUB_RUN_ID: String(runBId) }));
    upload(world, second, runBId, '2026-09-28T10:00:20Z');
    const beforeB = new Map(store.files(WORLD_REPOSITORY));
    const publishB = await publish(world, second, { GITHUB_RUN_ID: String(runBId) });
    expect(publishB.result.ok).toBe(true);
    commitsExpected += 1;
    const afterB = store.files(WORLD_REPOSITORY);
    for (const [path, bytes] of beforeB.entries()) {
      expect(afterB.get(path)).toEqual(bytes);
    }

    if (issue !== undefined) {
      issue.body = (issue.body ?? '') + '\nrun C body';
    }
    const runCId = WORLD_RUN_ID + 2;
    const third = requireOk(await gate(world, 'issues-edited.json', { GITHUB_RUN_ID: String(runCId) }));
    upload(world, third, runCId, '2026-09-28T10:00:40Z');
    const beforeC = new Map(store.files(WORLD_REPOSITORY));
    const publishC = await publish(world, third, { GITHUB_RUN_ID: String(runCId) });
    expect(publishC.result.ok).toBe(true);
    commitsExpected += 1;
    const afterC = store.files(WORLD_REPOSITORY);
    for (const [path, bytes] of beforeC.entries()) {
      expect(afterC.get(path)).toEqual(bytes);
    }

    expect(store.commitCount(WORLD_REPOSITORY)).toBe(commitsExpected);
  });
});
