import { describe, expect, it } from 'vitest';

import { fixedClock } from '../clock.js';
import { ok } from '../result.js';
import { FAILURE_CAUSES } from '../vocabulary.js';
import { createStoreWorld } from '../evidence/store-world.test.js';
import { ownershipArtifactName } from '../ownership/record.js';
import { readGateEnvironment, readPublishEnvironment } from '../pipeline/hosted-environment.js';
import {
  createHostedWorld,
  gateEnvironment,
  issuesEventPayload,
  publishEnvironment,
  WORLD_INSTALLATION_ID,
  WORLD_NOW,
  WORLD_REPOSITORY,
  WORLD_RUN_ID,
} from '../pipeline/hosted-world.test.js';
import type { HostedGateDeps, HostedGateResult } from '../pipeline/hosted-gate.js';
import { runHostedGate } from '../pipeline/hosted-gate.js';
import type { HostedPublishDeps, HostedPublishResult } from '../pipeline/hosted-publish.js';
import { runHostedPublish } from '../pipeline/hosted-publish.js';

type World = ReturnType<typeof createHostedWorld>;
type ReadyGate = Extract<HostedGateResult, { readonly ok: true }>;

interface Tracking {
  readonly masks: string[];
  readonly summaries: string[];
}

const PUBLISH_NOW = '2026-09-28T10:00:30.000Z';
const OWN_ARTIFACT_CREATED_AT = '2026-09-28T10:00:05Z';
const NOT_A_ZIP = new TextEncoder().encode('not a zip');

function trackers(): Tracking {
  return { masks: [], summaries: [] };
}

function newWorld(): { readonly store: ReturnType<typeof createStoreWorld>; readonly world: World } {
  const store = createStoreWorld();
  const world = createHostedWorld({ handlers: [store.handler] });
  return { store, world };
}

function gateDeps(world: World, tracking: Tracking): HostedGateDeps {
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

function publishDeps(world: World, tracking: Tracking): HostedPublishDeps {
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
  tracking: Tracking,
  action: string,
  options?: { readonly runAttemptEnv?: Readonly<Record<string, string>> },
): Promise<HostedGateResult> {
  const environment = gateEnvFor(world, options?.runAttemptEnv);
  const payload = issuesEventPayload(world, action);
  return runHostedGate({ environment, payload }, gateDeps(world, tracking));
}

function fileBytes(gate: ReadyGate, name: string): Uint8Array | null {
  return gate.files.find((f) => f.name === name)?.bytes ?? null;
}

async function setupPublishBase(): Promise<{
  readonly store: ReturnType<typeof createStoreWorld>;
  readonly world: World;
  readonly gate: ReadyGate;
}> {
  const store = createStoreWorld();
  const world = createHostedWorld({ handlers: [store.handler] });
  const gate = await runGate(world, trackers(), 'opened');
  if (!gate.ok) {
    throw new Error('setup gate run failed');
  }
  const ownershipFile = fileBytes(gate, 'ownership');
  if (ownershipFile === null) {
    throw new Error('setup gate run produced no ownership file');
  }
  world.addArtifact({
    name: gate.outputs['ownership_artifact'] ?? '',
    createdAt: OWN_ARTIFACT_CREATED_AT,
    workflowRunId: WORLD_RUN_ID,
    recordBytes: ownershipFile,
  });
  return { store, world, gate };
}

function expectNeverPass(result: HostedGateResult | HostedPublishResult, summaries: readonly string[]): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.failure.outcome).toBe('inconclusive');
  expect((FAILURE_CAUSES as readonly string[]).includes(result.failure.cause)).toBe(true);
  for (const summary of summaries) {
    expect(summary.includes('`pass`')).toBe(false);
  }
}

describe('invariant 4: hosted never pass', () => {
  it('invariant 4: hosted event failure never yields pass', async () => {
    const { world } = newWorld();
    const tracking = trackers();
    const environment = gateEnvFor(world);
    const result = await runHostedGate({ environment, payload: new TextEncoder().encode('not json') }, gateDeps(world, tracking));
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('gate.event-invalid');
    }
  });

  it('invariant 4: hosted token mint failure never yields pass', async () => {
    const { world } = newWorld();
    world.override((request) => {
      if (
        request.method === 'POST' &&
        request.url.pathname === `/app/installations/${String(WORLD_INSTALLATION_ID)}/access_tokens`
      ) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runGate(world, tracking, 'opened');
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.server-error');
    }
  });

  it('invariant 4: hosted policy failure never yields pass', async () => {
    const { world } = newWorld();
    world.setPolicy('version: 1\n');
    const tracking = trackers();
    const result = await runGate(world, tracking, 'opened');
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('gate.policy-invalid');
    }
  });

  it('invariant 4: hosted capture failure never yields pass', async () => {
    const { world } = newWorld();
    world.override((request) => {
      if (request.method === 'GET' && request.url.pathname === `/repos/${WORLD_REPOSITORY}/issues/29`) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runGate(world, tracking, 'opened');
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.server-error');
    }
  });

  it('invariant 4: hosted listing failure never yields pass', async () => {
    const { world } = newWorld();
    world.override((request) => {
      if (request.method === 'GET' && request.url.pathname === `/repos/${WORLD_REPOSITORY}/actions/artifacts`) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runGate(world, tracking, 'opened');
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('ownership.listing-unavailable');
    }
  });

  it('invariant 4: hosted download failure never yields pass', async () => {
    const { world } = newWorld();
    world.addArtifact({
      name: ownershipArtifactName('issue', 29),
      createdAt: WORLD_NOW,
      workflowRunId: 1,
      zip: NOT_A_ZIP,
    });
    const tracking = trackers();
    const result = await runGate(world, tracking, 'opened');
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('ownership.record-invalid');
    }
  });

  it('invariant 4: hosted run list failure never yields pass', async () => {
    const { world } = newWorld();
    world.override((request) => {
      if (request.method === 'GET' && request.url.pathname === `/repos/${WORLD_REPOSITORY}/actions/runs`) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runGate(world, tracking, 'opened');
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('caps.run-list-unavailable');
    }
  });

  it('invariant 4: hosted handoff failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: new TextEncoder().encode('x'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('pipeline.handoff-invalid');
    }
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
  });

  it('invariant 4: hosted binding failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs, { STEWARD_GATE_POLICY_REVISION: 'c'.repeat(40) }),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('pipeline.handoff-binding');
    }
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
  });

  it('invariant 4: hosted closure record failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs, {
          STEWARD_GATE_RECORD_ONLY: 'true',
          STEWARD_GATE_DISPOSITION: 'closure',
        }),
        files: { handoff: null, gateContext: null, closure: new TextEncoder().encode('{}') },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('pipeline.handoff-invalid');
    }
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
  });

  it('invariant 4: hosted publish policy failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    const policyRevision = gate.outputs['policy_revision'] ?? '';
    world.override((request) => {
      if (request.method === 'GET' && request.url.pathname === `/repos/${WORLD_REPOSITORY}/git/trees/${policyRevision}`) {
        return new Response(null, { status: 404 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
  });

  it('invariant 4: hosted own artifact failure never yields pass', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gate = await runGate(world, trackers(), 'opened');
    if (!gate.ok) {
      throw new Error('setup gate run failed');
    }
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('ownership.listing-unavailable');
    }
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
  });

  it('invariant 4: hosted store tip failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    world.override((request) => {
      if (request.method === 'GET' && request.url.pathname.endsWith('/git/ref/heads/steward-evidence')) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('github.server-error');
    }
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
  });

  it('invariant 4: hosted blob failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    world.override((request) => {
      if (request.method === 'POST' && request.url.pathname.endsWith('/git/blobs')) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
  });

  it('invariant 4: hosted tree failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    world.override((request) => {
      if (request.method === 'POST' && request.url.pathname.endsWith('/git/trees')) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
  });

  it('invariant 4: hosted commit failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    world.override((request) => {
      if (request.method === 'POST' && request.url.pathname.endsWith('/git/commits')) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    expect(store.head(WORLD_REPOSITORY)).toBeNull();
  });

  it('invariant 4: hosted compare failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    const tipBefore = store.advance(WORLD_REPOSITORY, {
      [`${WORLD_REPOSITORY}/metrics/2026-09/1-1.json`]: new TextEncoder().encode('{}'),
    });
    world.override((request) => {
      if (request.method === 'GET' && request.url.pathname.includes('/compare/')) {
        return new Response(
          JSON.stringify({ status: 'ahead', ahead_by: 1, behind_by: 0, files: [{ filename: 'x', status: 'modified' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.store-not-append-only');
    }
    expect(store.head(WORLD_REPOSITORY)).toBe(tipBefore);
  });

  it('invariant 4: hosted ref update failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    const tipBefore = store.advance(WORLD_REPOSITORY, {
      [`${WORLD_REPOSITORY}/metrics/2026-09/1-1.json`]: new TextEncoder().encode('{}'),
    });
    world.override((request) => {
      if (request.method === 'PATCH' && request.url.pathname.endsWith('/git/refs/heads/steward-evidence')) {
        return new Response(null, { status: 422 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.store-conflict');
    }
    expect(store.head(WORLD_REPOSITORY)).toBe(tipBefore);
  });

  it('invariant 4: hosted read-back failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    world.override((request) => {
      if (request.method === 'GET' && request.url.pathname.includes(':')) {
        return new Response(
          JSON.stringify({
            sha: 'f'.repeat(40),
            truncated: false,
            tree: [{ path: 'x', mode: '100644', type: 'blob', sha: 'f'.repeat(40) }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.readback-mismatch');
    }
    expect([...store.files(WORLD_REPOSITORY).keys()].some((p) => p.includes('/supersessions/'))).toBe(false);
  });

  it('invariant 4: hosted settle re-list failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    let commitSeen = false;
    world.override((request) => {
      const path = request.url.pathname;
      if (path.endsWith('/git/refs') || path.endsWith('/git/refs/heads/steward-evidence')) {
        commitSeen = true;
        return undefined;
      }
      if (commitSeen && request.method === 'GET' && path.endsWith('/actions/artifacts')) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('publish.freshness-unknown');
    }
    expect([...store.files(WORLD_REPOSITORY).keys()].some((p) => p.includes('/supersessions/'))).toBe(false);
  });

  it('invariant 4: hosted successor record failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:07Z',
      workflowRunId: WORLD_RUN_ID + 1,
      zip: NOT_A_ZIP,
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('publish.freshness-unknown');
    }
    expect([...store.files(WORLD_REPOSITORY).keys()].some((p) => p.includes('/supersessions/'))).toBe(false);
  });

  it('invariant 4: hosted recapture failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    world.override((request) => {
      if (request.method === 'GET' && request.url.pathname === `/repos/${WORLD_REPOSITORY}/issues/29`) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('publish.freshness-unknown');
    }
    expect([...store.files(WORLD_REPOSITORY).keys()].some((p) => p.includes('/supersessions/'))).toBe(false);
  });

  it('invariant 4: hosted freshness failure never yields pass', async () => {
    const { store, world, gate } = await setupPublishBase();
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: OWN_ARTIFACT_CREATED_AT,
      workflowRunId: WORLD_RUN_ID + 2,
      recordBytes: fileBytes(gate, 'ownership') as Uint8Array,
    });
    const tracking = trackers();
    const result = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking),
    );
    expectNeverPass(result, tracking.summaries);
    if (!result.ok) {
      expect(result.failure.code).toBe('publish.freshness-unknown');
    }
    expect([...store.files(WORLD_REPOSITORY).keys()].some((p) => p.includes('/supersessions/'))).toBe(false);
  });
});
