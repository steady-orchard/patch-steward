import { describe, expect, it } from 'vitest';

import { fixedClock } from '../clock.js';
import { ok } from '../result.js';
import { createStoreWorld } from '../evidence/store-world.test.js';
import { readGateEnvironment, readPublishEnvironment } from '../pipeline/hosted-environment.js';
import {
  createHostedWorld,
  gateEnvironment,
  issuesEventPayload,
  publishEnvironment,
  worldPolicyText,
  WORLD_REPOSITORY,
  WORLD_RUN_ID,
} from '../pipeline/hosted-world.test.js';
import type { HostedGateDeps, HostedGateResult } from '../pipeline/hosted-gate.js';
import { runHostedGate } from '../pipeline/hosted-gate.js';
import type { HostedPublishDeps } from '../pipeline/hosted-publish.js';
import { runHostedPublish } from '../pipeline/hosted-publish.js';

type World = ReturnType<typeof createHostedWorld>;

const PUBLISH_NOW = '2026-09-28T10:00:30.000Z';

function trackers(): { masks: string[]; summaries: string[] } {
  return { masks: [], summaries: [] };
}

function gateDeps(world: World, tracking: { masks: string[]; summaries: string[] }): HostedGateDeps {
  return {
    fetch: world.fetch,
    sleep: async () => undefined,
    clock: fixedClock('2026-09-28T10:00:00.000Z'),
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    mask: (s: string) => tracking.masks.push(s),
    writeSummary: async (t: string) => {
      tracking.summaries.push(t);
    },
  };
}

function publishDeps(world: World, tracking: { masks: string[]; summaries: string[] }): HostedPublishDeps {
  return {
    fetch: world.fetch,
    sleep: async () => undefined,
    clock: fixedClock(PUBLISH_NOW),
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    mask: (s: string) => tracking.masks.push(s),
    writeSummary: async (t: string) => {
      tracking.summaries.push(t);
    },
    version: () => ok('0.0.2'),
  };
}

function gateEnvFor(world: World, overrides?: Readonly<Record<string, string>>) {
  const result = readGateEnvironment(gateEnvironment(world, overrides));
  if (!result.ok) {
    throw new Error('test gate environment failed to build');
  }
  return result.value;
}

function publishEnvFor(world: World, gateOutputs: Readonly<Record<string, string>>, overrides?: Readonly<Record<string, string>>) {
  const result = readPublishEnvironment(publishEnvironment(world, gateOutputs, overrides));
  if (!result.ok) {
    throw new Error('test publish environment failed to build');
  }
  return result.value;
}

async function runGate(
  world: World,
  action: string,
  options?: { readonly number?: number; readonly runAttemptEnv?: Readonly<Record<string, string>> },
): Promise<HostedGateResult> {
  const environment = gateEnvFor(world, options?.runAttemptEnv);
  const payload = issuesEventPayload(world, action, options?.number !== undefined ? { number: options.number } : undefined);
  return runHostedGate({ environment, payload }, gateDeps(world, trackers()));
}

function fileBytes(gate: Extract<HostedGateResult, { readonly ok: true }>, name: string): Uint8Array | null {
  return gate.files.find((f) => f.name === name)?.bytes ?? null;
}

async function publishGate(world: World, gate: Extract<HostedGateResult, { readonly ok: true }>) {
  return runHostedPublish(
    {
      environment: publishEnvFor(world, gate.outputs),
      files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
    },
    publishDeps(world, trackers()),
  );
}

function readJson(bytes: Uint8Array): unknown {
  return JSON.parse(Buffer.from(bytes).toString('utf8'));
}

describe('invariant 8: hosted ownership and freshness', () => {
  it('ownership ties block publication', async () => {
    // (a) another run's artifact shares A's own createdAt.
    const storeA = createStoreWorld();
    const worldA = createHostedWorld({ handlers: [storeA.handler] });
    const gateA = await runGate(worldA, 'opened');
    expect(gateA.ok).toBe(true);
    if (!gateA.ok) return;
    const ownershipA = fileBytes(gateA, 'ownership');
    expect(ownershipA).not.toBeNull();
    if (ownershipA === null) return;
    worldA.addArtifact({
      name: gateA.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipA,
    });
    worldA.addArtifact({
      name: gateA.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID + 5,
      recordBytes: ownershipA,
    });

    const publishA = await publishGate(worldA, gateA);
    expect(publishA.ok).toBe(false);
    if (publishA.ok) return;
    expect(publishA.failure.code).toBe('publish.freshness-unknown');
    expect([...storeA.files(WORLD_REPOSITORY).keys()].some((p) => p.includes('/supersessions/'))).toBe(false);

    // (b) two other runs' artifacts share a createdAt later than A's.
    const storeB = createStoreWorld();
    const worldB = createHostedWorld({ handlers: [storeB.handler] });
    const gateB = await runGate(worldB, 'opened');
    expect(gateB.ok).toBe(true);
    if (!gateB.ok) return;
    const ownershipB = fileBytes(gateB, 'ownership');
    expect(ownershipB).not.toBeNull();
    if (ownershipB === null) return;
    worldB.addArtifact({
      name: gateB.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipB,
    });
    worldB.addArtifact({
      name: gateB.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:09Z',
      workflowRunId: WORLD_RUN_ID + 6,
      recordBytes: ownershipB,
    });
    worldB.addArtifact({
      name: gateB.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:09Z',
      workflowRunId: WORLD_RUN_ID + 7,
      recordBytes: ownershipB,
    });

    const publishB = await publishGate(worldB, gateB);
    expect(publishB.ok).toBe(false);
    if (publishB.ok) return;
    expect(publishB.failure.code).toBe('publish.freshness-unknown');
    expect([...storeB.files(WORLD_REPOSITORY).keys()].some((p) => p.includes('/supersessions/'))).toBe(false);
  });

  it('newer owner supersedes', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    expect(ownershipFile).not.toBeNull();
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const issue = world.issues.get(29);
    if (issue !== undefined) {
      issue.body = `${issue.body ?? ''}\nedited by a newer run`;
    }
    const nextRunId = WORLD_RUN_ID + 1;
    const rerunGate = await runGate(world, 'edited', { runAttemptEnv: { GITHUB_RUN_ID: String(nextRunId) } });
    expect(rerunGate.ok).toBe(true);
    if (!rerunGate.ok) return;
    const rerunOwnershipFile = fileBytes(rerunGate, 'ownership');
    expect(rerunOwnershipFile).not.toBeNull();
    if (rerunOwnershipFile === null) return;
    world.addArtifact({
      name: rerunGate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:09Z',
      workflowRunId: nextRunId,
      recordBytes: rerunOwnershipFile,
    });

    const publish = await publishGate(world, gate);
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;
    expect(publish.status).toBe('superseded');

    const files = store.files(WORLD_REPOSITORY);
    const supersessionBytes = files.get(`${WORLD_REPOSITORY}/runs/issue-29/supersessions/${String(WORLD_RUN_ID)}-1.json`);
    expect(supersessionBytes).toBeDefined();
    if (supersessionBytes === undefined) return;
    const record = readJson(supersessionBytes) as { readonly reason: string; readonly successor: { readonly run_id: number } };
    expect(record.reason).toBe('newer-owner');
    expect(record.successor.run_id).toBe(nextRunId);
  });

  it('unknown freshness fails publication', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    expect(ownershipFile).not.toBeNull();
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    let artifactsCalls = 0;
    world.override((request) => {
      if (request.method === 'GET' && request.url.pathname.endsWith('/actions/artifacts')) {
        artifactsCalls += 1;
        if (artifactsCalls >= 2) {
          return new Response(null, { status: 500 });
        }
      }
      return undefined;
    });

    const publishTracking = trackers();
    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, publishTracking),
    );
    expect(publish.ok).toBe(false);
    if (publish.ok) return;
    expect(publish.failure.code).toBe('publish.freshness-unknown');
    expect(publish.evidenceCommit).not.toBeNull();

    const files = store.files(WORLD_REPOSITORY);
    expect([...files.keys()].some((p) => p.includes('/supersessions/'))).toBe(false);
    expect(publishTracking.summaries.some((s) => s.includes('unknown'))).toBe(true);
  });

  it('an unchanged snapshot keeps the hosted owner', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    expect(ownershipFile).not.toBeNull();
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const dupGate = await runGate(world, 'edited', { runAttemptEnv: { GITHUB_RUN_ID: String(WORLD_RUN_ID + 1) } });
    expect(dupGate.ok).toBe(true);
    if (!dupGate.ok) return;
    expect(dupGate.disposition).toBe('duplicate');
    expect(dupGate.outputs['ownership_artifact']).toBe('');
    expect(dupGate.files.length).toBe(0);
    expect(world.artifacts().length).toBe(1);
  });

  it('an explicit rerun replaces the hosted owner', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    expect(ownershipFile).not.toBeNull();
    if (ownershipFile === null) return;
    const firstArtifact = world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const rerunGate = await runGate(world, 'opened', { runAttemptEnv: { GITHUB_RUN_ATTEMPT: '2' } });
    expect(rerunGate.ok).toBe(true);
    if (!rerunGate.ok) return;
    expect(rerunGate.disposition).toBe('runnable');
    const rerunOwnershipFile = fileBytes(rerunGate, 'ownership');
    expect(rerunOwnershipFile).not.toBeNull();
    if (rerunOwnershipFile === null) return;

    world.removeArtifact(firstArtifact.id);
    world.addArtifact({
      name: rerunGate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:07Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: rerunOwnershipFile,
    });

    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, rerunGate.outputs, { GITHUB_RUN_ATTEMPT: '2' }),
        files: { handoff: fileBytes(rerunGate, 'handoff'), gateContext: fileBytes(rerunGate, 'gate-context'), closure: null },
      },
      publishDeps(world, trackers()),
    );
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;

    const files = store.files(WORLD_REPOSITORY);
    expect(files.has(`${WORLD_REPOSITORY}/runs/issue-29/${String(WORLD_RUN_ID)}-2/manifest.json`)).toBe(true);
  });

  it('the newest owner is chosen by creation time, never id', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    expect(ownershipFile).not.toBeNull();
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const issue = world.issues.get(29);
    if (issue !== undefined) {
      issue.body = `${issue.body ?? ''}\nedited by a newer run`;
    }
    const nextRunId = WORLD_RUN_ID + 1;
    const rerunGate = await runGate(world, 'edited', { runAttemptEnv: { GITHUB_RUN_ID: String(nextRunId) } });
    expect(rerunGate.ok).toBe(true);
    if (!rerunGate.ok) return;
    const rerunOwnershipFile = fileBytes(rerunGate, 'ownership');
    expect(rerunOwnershipFile).not.toBeNull();
    if (rerunOwnershipFile === null) return;
    world.addArtifact({
      name: rerunGate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:09Z',
      workflowRunId: nextRunId,
      id: 5,
      recordBytes: rerunOwnershipFile,
    });

    const publish = await publishGate(world, gate);
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;
    expect(publish.status).toBe('superseded');

    const files = store.files(WORLD_REPOSITORY);
    const supersessionBytes = files.get(`${WORLD_REPOSITORY}/runs/issue-29/supersessions/${String(WORLD_RUN_ID)}-1.json`);
    expect(supersessionBytes).toBeDefined();
    if (supersessionBytes === undefined) return;
    const record = readJson(supersessionBytes) as { readonly reason: string; readonly successor: { readonly run_id: number } };
    expect(record.reason).toBe('newer-owner');
    expect(record.successor.run_id).toBe(nextRunId);

    // conversely, an artifact of another run created earlier than A's never supersedes, regardless of id.
    const store2 = createStoreWorld();
    const world2 = createHostedWorld({ handlers: [store2.handler] });
    const gate2 = await runGate(world2, 'opened');
    expect(gate2.ok).toBe(true);
    if (!gate2.ok) return;
    const ownershipFile2 = fileBytes(gate2, 'ownership');
    expect(ownershipFile2).not.toBeNull();
    if (ownershipFile2 === null) return;
    world2.addArtifact({
      name: gate2.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile2,
    });
    world2.addArtifact({
      name: gate2.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:01Z',
      workflowRunId: WORLD_RUN_ID + 2,
      id: 999999,
      zip: new TextEncoder().encode('not a real zip'),
    });

    const publish2 = await publishGate(world2, gate2);
    expect(publish2.ok).toBe(true);
    if (!publish2.ok) return;
    expect(publish2.status).toBe('inconclusive');
    expect(publish2.outputs['freshness']).toBe('current');
  });

  it('an incomplete listing blocks publication', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    expect(ownershipFile).not.toBeNull();
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: 'not-a-date',
      expiresAt: '2027-01-01T00:00:00Z',
      workflowRunId: WORLD_RUN_ID + 3,
      recordBytes: ownershipFile,
    });

    const publish = await publishGate(world, gate);
    expect(publish.ok).toBe(false);
    if (publish.ok) return;
    expect(publish.failure.code).toBe('publish.freshness-unknown');
  });

  it('a changed policy revision supersedes', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    expect(ownershipFile).not.toBeNull();
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    world.setPolicy(worldPolicyText([['daily_runs: 50', 'daily_runs: 49']]));

    const publish = await publishGate(world, gate);
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;
    expect(publish.status).toBe('superseded');

    const files = store.files(WORLD_REPOSITORY);
    const supersessionBytes = files.get(`${WORLD_REPOSITORY}/runs/issue-29/supersessions/${String(WORLD_RUN_ID)}-1.json`);
    expect(supersessionBytes).toBeDefined();
    if (supersessionBytes === undefined) return;
    const record = readJson(supersessionBytes) as { readonly reason: string };
    expect(record.reason).toBe('snapshot-changed');
  });
});
