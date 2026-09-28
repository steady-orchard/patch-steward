import { describe, expect, it } from 'vitest';

import { fixedClock } from '../clock.js';
import { ok } from '../result.js';
import { createStoreWorld } from '../evidence/store-world.test.js';
import { readGateEnvironment, readPublishEnvironment } from './hosted-environment.js';
import {
  createHostedWorld,
  gateEnvironment,
  issuesEventPayload,
  publishEnvironment,
  worldPolicyText,
  WORLD_NOW,
  WORLD_REPOSITORY,
  WORLD_RUN_ID,
} from './hosted-world.test.js';
import type { HostedGateDeps, HostedGateResult } from './hosted-gate.js';
import { runHostedGate } from './hosted-gate.js';
import type { HostedPublishDeps, HostedPublishResult } from './hosted-publish.js';
import { runHostedPublish } from './hosted-publish.js';

type World = ReturnType<typeof createHostedWorld>;

const PUBLISH_NOW = '2026-09-28T10:00:30.000Z';

function trackers(): { masks: string[]; summaries: string[] } {
  return { masks: [], summaries: [] };
}

function gateDeps(world: World, tracking: { masks: string[]; summaries: string[] }): HostedGateDeps {
  return {
    fetch: world.fetch,
    sleep: async () => undefined,
    clock: fixedClock(WORLD_NOW),
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    mask: (s: string) => tracking.masks.push(s),
    writeSummary: async (t: string) => {
      tracking.summaries.push(t);
    },
  };
}

function publishDeps(
  world: World,
  tracking: { masks: string[]; summaries: string[] },
  overrides?: Partial<HostedPublishDeps>,
): HostedPublishDeps {
  return {
    fetch: world.fetch,
    sleep: async () => undefined,
    clock: fixedClock(PUBLISH_NOW),
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    mask: (s: string) => tracking.masks.push(s),
    writeSummary: async (t: string) => {
      tracking.summaries.push(t);
      world.requests.push({ method: 'SUMMARY', host: '', path: '' });
    },
    version: () => ok('0.0.2'),
    ...overrides,
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

describe('hosted publish', () => {
  it('a runnable issue publishes an inconclusive outcome with evidence first', async () => {
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

    const publishTracking = trackers();
    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, publishTracking),
    );
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;
    expect(publish.status).toBe('inconclusive');
    expect(publish.outputs['freshness']).toBe('current');

    const files = store.files(WORLD_REPOSITORY);
    expect(files.has(`${WORLD_REPOSITORY}/runs/issue-29/${String(WORLD_RUN_ID)}-1/manifest.json`)).toBe(true);
    expect(files.has(`${WORLD_REPOSITORY}/metrics/2026-09/${String(WORLD_RUN_ID)}-1.json`)).toBe(true);

    let lastRefsIndex = -1;
    let summaryIndex = -1;
    world.requests.forEach((r, i) => {
      if (r.path.endsWith('/git/refs')) lastRefsIndex = i;
      if (r.method === 'SUMMARY' && summaryIndex === -1) summaryIndex = i;
    });
    expect(lastRefsIndex).toBeGreaterThanOrEqual(0);
    expect(summaryIndex).toBeGreaterThan(lastRefsIndex);
  });

  it('an early exit publishes the contract outcome', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened', { number: 30 });
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.disposition).toBe('early-exit');
    const ownershipFile = fileBytes(gate, 'ownership');
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, trackers()),
    );
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;
    expect(publish.status).toBe('needs-changes');
  });

  it('a queued run publishes a waiting run directory', async () => {
    const store = createStoreWorld();
    const policyText = worldPolicyText([['daily_runs: 50', 'daily_runs: 1']]);
    const world = createHostedWorld({ handlers: [store.handler], policyText });
    world.runs.createdToday.push({
      id: 999111,
      path: '.github/workflows/steward-issues.yml',
      event: 'issues',
      status: 'completed',
      createdAt: '2026-09-28T09:00:00Z',
      displayTitle: 'steward issue 30 author 2095171 event issues opened sender 2095171 User',
    });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.disposition).toBe('queued');
    const ownershipFile = fileBytes(gate, 'ownership');
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, trackers()),
    );
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;
    expect(publish.status).toBe('queued');

    const runDirectory = `${WORLD_REPOSITORY}/runs/issue-29/${String(WORLD_RUN_ID)}-1`;
    const files = store.files(WORLD_REPOSITORY);
    expect(files.has(`${runDirectory}/waiting.json`)).toBe(true);
    expect(files.has(`${runDirectory}/decision.json`)).toBe(false);
  });

  it('a closure publishes one metrics file', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const openGate = await runGate(world, 'opened');
    expect(openGate.ok).toBe(true);
    if (!openGate.ok) return;
    const ownershipFile = fileBytes(openGate, 'ownership');
    if (ownershipFile === null) return;
    world.addArtifact({
      name: openGate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const closeGate = await runGate(world, 'closed');
    expect(closeGate.ok).toBe(true);
    if (!closeGate.ok) return;
    expect(closeGate.disposition).toBe('closure');

    const requestsBefore = world.requests.length;
    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, closeGate.outputs),
        files: { handoff: null, gateContext: null, closure: fileBytes(closeGate, 'closure') },
      },
      publishDeps(world, trackers()),
    );
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;
    expect(publish.status).toBe('closure');

    const requestsAfter = world.requests.slice(requestsBefore);
    expect(requestsAfter.some((r) => r.path.includes('/actions/artifacts'))).toBe(false);

    const files = store.files(WORLD_REPOSITORY);
    const metricsPaths = [...files.keys()].filter((p) => p.includes('/metrics/2026-09/'));
    expect(metricsPaths.length).toBe(1);
  });

  it('publish loads the gate policy by tree id before any evidence request', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const requestsBefore = world.requests.length;
    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, trackers()),
    );
    expect(publish.ok).toBe(true);
    const publishRequests = world.requests.slice(requestsBefore);

    const treeSuffix = `/git/trees/${gate.outputs['policy_revision'] ?? ''}?recursive=1`;
    expect(publishRequests.some((r) => r.path.endsWith(treeSuffix))).toBe(true);

    const refIndex = publishRequests.findIndex((r) => r.path.endsWith('/git/ref/heads/master'));
    const blobIndex = publishRequests.findIndex((r) => r.path.includes('/git/blobs'));
    if (refIndex >= 0 && blobIndex >= 0) {
      expect(refIndex).toBeGreaterThan(blobIndex);
    } else {
      expect(refIndex).toBe(-1);
    }
  });

  it('a newer owner records a supersession', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
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
    if (rerunOwnershipFile === null) return;
    world.addArtifact({
      name: rerunGate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:09Z',
      workflowRunId: nextRunId,
      recordBytes: rerunOwnershipFile,
    });

    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, trackers()),
    );
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;
    expect(publish.status).toBe('superseded');
    expect(publish.outputs['supersession_commit']).not.toBe('');

    const files = store.files(WORLD_REPOSITORY);
    expect(files.has(`${WORLD_REPOSITORY}/runs/issue-29/supersessions/${String(WORLD_RUN_ID)}-1.json`)).toBe(true);
    expect(files.has(`${WORLD_REPOSITORY}/runs/issue-29/${String(WORLD_RUN_ID)}-1/manifest.json`)).toBe(true);
  });

  it('unknown freshness fails after the evidence commit', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID + 2,
      recordBytes: ownershipFile,
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

  it('a snapshot mismatch fails before any evidence request', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const requestsBefore = world.requests.length;
    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs, { STEWARD_GATE_SNAPSHOT_HASH: `sha256:${'0'.repeat(64)}` }),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, trackers()),
    );
    expect(publish.ok).toBe(false);
    if (publish.ok) return;
    expect(publish.failure.code).toBe('pipeline.handoff-binding');
    expect(world.requests.length).toBe(requestsBefore + 1);
    expect(world.requests[requestsBefore]?.method).toBe('SUMMARY');
  });

  it('a missing own artifact fails before any evidence request', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;

    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, trackers()),
    );
    expect(publish.ok).toBe(false);
    if (publish.ok) return;
    expect(publish.failure.code).toBe('ownership.listing-unavailable');
    expect(world.requests.some((r) => r.method === 'POST' && r.path.endsWith('/git/blobs'))).toBe(false);
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
  });

  it('a separate evidence repository receives the commit', async () => {
    const store = createStoreWorld();
    const policyText = worldPolicyText([
      ['type: orphan-branch', 'type: repository\n    repository: steady-orchard/patch-steward-testbed-evidence'],
    ]);
    const world = createHostedWorld({ handlers: [store.handler], policyText });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, trackers()),
    );
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;
    expect(publish.status).toBe('inconclusive');

    const evidenceRepository = 'steady-orchard/patch-steward-testbed-evidence';
    const files = store.files(evidenceRepository);
    expect(files.has(`${WORLD_REPOSITORY}/runs/issue-29/${String(WORLD_RUN_ID)}-1/manifest.json`)).toBe(true);
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
  });

  it('publish tokens are masked and revoked', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const tokensBefore = world.tokens.length;
    const requestsBefore = world.requests.length;
    const publishTracking = trackers();
    const publish: HostedPublishResult = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, publishTracking),
    );
    expect(publish.ok).toBe(true);

    const publishTokens = world.tokens.slice(tokensBefore);
    expect(publishTokens.length).toBeGreaterThan(0);
    expect(publishTracking.masks).toEqual(publishTokens);

    const requestsAfter = world.requests.slice(requestsBefore);
    const deletes = requestsAfter.filter((r) => r.method === 'DELETE' && r.path === '/installation/token');
    expect(deletes.length).toBe(publishTokens.length);

    const serialized = JSON.stringify(publish);
    for (const token of publishTokens) {
      expect(serialized.includes(token)).toBe(false);
    }
    const storeFiles = [...store.files(WORLD_REPOSITORY).values()];
    const storeText = storeFiles.map((bytes) => Buffer.from(bytes).toString('utf8')).join('\n');
    for (const token of publishTokens) {
      expect(storeText.includes(token)).toBe(false);
    }
    for (const summary of publishTracking.summaries) {
      for (const token of publishTokens) {
        expect(summary.includes(token)).toBe(false);
      }
    }
  });

  it('effective retention is logged', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const ownershipFile = fileBytes(gate, 'ownership');
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    const publishTracking = trackers();
    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, publishTracking),
    );
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;
    expect(publish.logLines).toContain('ownership retention 90 days');
    expect(publishTracking.summaries.some((s) => s.includes('90'))).toBe(true);
  });
});
