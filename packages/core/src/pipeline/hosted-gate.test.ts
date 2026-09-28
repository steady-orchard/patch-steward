import { describe, expect, it } from 'vitest';

import { fixedClock } from '../clock.js';
import { createStoreWorld } from '../evidence/store-world.test.js';
import { decodeClosureContext, decodeGateContext } from './gate-context.js';
import { decodeOwnershipRecord } from '../ownership/record.js';
import { readGateEnvironment } from './hosted-environment.js';
import {
  createHostedWorld,
  gateEnvironment,
  issuesEventPayload,
  worldPolicyText,
  WORLD_AUTHOR_ID,
  WORLD_BOT_ID,
  WORLD_NOW,
  WORLD_REPOSITORY,
  WORLD_REPOSITORY_ID,
  WORLD_RUN_ID,
} from './hosted-world.test.js';
import type { HostedGateDeps } from './hosted-gate.js';
import { runHostedGate } from './hosted-gate.js';

function trackers(): { masks: string[]; summaries: string[] } {
  const masks: string[] = [];
  const summaries: string[] = [];
  return { masks, summaries };
}

function buildDeps(
  world: ReturnType<typeof createHostedWorld>,
  tracking: { masks: string[]; summaries: string[] },
  overrides?: Partial<HostedGateDeps>,
): HostedGateDeps {
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
    ...overrides,
  };
}

function environmentFor(world: ReturnType<typeof createHostedWorld>, overrides?: Readonly<Record<string, string>>) {
  const env = readGateEnvironment(gateEnvironment(world, overrides));
  if (!env.ok) {
    throw new Error('test environment failed to build');
  }
  return env.value;
}

describe('hosted gate', () => {
  it('the gate lists ownership before capture', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const payload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const result = await runHostedGate({ environment, payload }, buildDeps(world, tracking));
    expect(result.ok).toBe(true);

    const installationIndex = world.requests.findIndex((r) => r.path.endsWith('/installation'));
    const refIndex = world.requests.findIndex((r) => r.path.endsWith('/git/ref/heads/master'));
    const artifactsIndex = world.requests.findIndex((r) => r.path.includes('/actions/artifacts'));
    const issueIndex = world.requests.findIndex((r) => r.path.endsWith('/issues/29'));

    expect(installationIndex).toBe(0);
    expect(refIndex).toBeGreaterThanOrEqual(0);
    expect(artifactsIndex).toBeGreaterThan(refIndex);
    expect(issueIndex).toBeGreaterThan(artifactsIndex);
  });

  it('a runnable issue commits handoff, context, and ownership files', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const payload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const result = await runHostedGate({ environment, payload }, buildDeps(world, tracking));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.disposition).toBe('runnable');
    expect(result.files.map((f) => f.name)).toEqual(['handoff', 'gate-context', 'ownership']);
    expect(result.outputs['commit']).toBe('true');
    expect(result.outputs['ownership_artifact']).toBe('steward-ownership-issue-29');
    expect(result.outputs['concurrency_group']).toBe(`steward-${String(WORLD_REPOSITORY_ID)}-issue-29`);

    const ownershipFile = result.files.find((f) => f.name === 'ownership');
    expect(ownershipFile).toBeDefined();
    if (ownershipFile !== undefined) {
      const decoded = decodeOwnershipRecord(ownershipFile.bytes, {
        repository: WORLD_REPOSITORY,
        type: 'issue',
        number: 29,
        artifactName: 'steward-ownership-issue-29',
        workflowRunId: WORLD_RUN_ID,
      });
      expect(decoded.ok).toBe(true);
      if (decoded.ok) {
        expect(decoded.value.run_id).toBe(WORLD_RUN_ID);
        expect(decoded.value.cap?.state).toBe('within');
      }
    }

    const contextFile = result.files.find((f) => f.name === 'gate-context');
    expect(contextFile).toBeDefined();
    if (contextFile !== undefined) {
      const decoded = decodeGateContext(contextFile.bytes, {
        runId: WORLD_RUN_ID,
        maxAttempt: 1,
        repository: WORLD_REPOSITORY,
        repositoryId: WORLD_REPOSITORY_ID,
      });
      expect(decoded.ok).toBe(true);
      if (decoded.ok) {
        expect(decoded.value.snapshot_hash).toBe(result.outputs['snapshot_hash']);
      }
    }
  });

  it('an unstructured issue exits early without caps', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const payload = issuesEventPayload(world, 'opened', { number: 30 });
    const tracking = trackers();
    const result = await runHostedGate({ environment, payload }, buildDeps(world, tracking));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.disposition).toBe('early-exit');
    expect(world.requests.some((r) => r.path.includes('/actions/runs'))).toBe(false);

    const ownershipFile = result.files.find((f) => f.name === 'ownership');
    expect(ownershipFile).toBeDefined();
    if (ownershipFile !== undefined) {
      const decoded = decodeOwnershipRecord(ownershipFile.bytes, {
        repository: WORLD_REPOSITORY,
        type: 'issue',
        number: 30,
        artifactName: 'steward-ownership-issue-30',
        workflowRunId: WORLD_RUN_ID,
      });
      expect(decoded.ok).toBe(true);
      if (decoded.ok) {
        expect(decoded.value.cap).toBeNull();
      }
    }
  });

  it('an over-cap run is queued', async () => {
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
    const environment = environmentFor(world);
    const payload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const result = await runHostedGate({ environment, payload }, buildDeps(world, tracking));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.disposition).toBe('queued');

    const ownershipFile = result.files.find((f) => f.name === 'ownership');
    expect(ownershipFile).toBeDefined();
    if (ownershipFile !== undefined) {
      const decoded = decodeOwnershipRecord(ownershipFile.bytes, {
        repository: WORLD_REPOSITORY,
        type: 'issue',
        number: 29,
        artifactName: 'steward-ownership-issue-29',
        workflowRunId: WORLD_RUN_ID,
      });
      expect(decoded.ok).toBe(true);
      if (decoded.ok) {
        expect(decoded.value.cap?.state).toBe('daily-runs');
      }
    }
  });

  it('an unchanged snapshot keeps the current owner', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const firstPayload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const first = await runHostedGate({ environment, payload: firstPayload }, buildDeps(world, tracking));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const ownershipFile = first.files.find((f) => f.name === 'ownership');
    expect(ownershipFile).toBeDefined();
    if (ownershipFile === undefined) return;
    world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: WORLD_NOW,
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile.bytes,
    });

    const secondPayload = issuesEventPayload(world, 'edited');
    const secondTracking = trackers();
    const second = await runHostedGate({ environment, payload: secondPayload }, buildDeps(world, secondTracking));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.disposition).toBe('duplicate');
    expect(second.files).toEqual([]);
    expect(second.outputs['commit']).toBe('false');
    expect(secondTracking.summaries.some((s) => s.includes('kept'))).toBe(true);
  });

  it('a changed body commits a new owner', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const firstPayload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const first = await runHostedGate({ environment, payload: firstPayload }, buildDeps(world, tracking));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const ownershipFile = first.files.find((f) => f.name === 'ownership');
    if (ownershipFile === undefined) return;
    world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: WORLD_NOW,
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile.bytes,
    });

    const issue = world.issues.get(29);
    if (issue !== undefined) {
      issue.body = (issue.body ?? '') + '\nedited content';
    }

    const secondPayload = issuesEventPayload(world, 'edited');
    const secondTracking = trackers();
    const second = await runHostedGate({ environment, payload: secondPayload }, buildDeps(world, secondTracking));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.disposition).toBe('runnable');
  });

  it('an explicit rerun commits whatever the snapshot', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const firstPayload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const first = await runHostedGate({ environment, payload: firstPayload }, buildDeps(world, tracking));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const ownershipFile = first.files.find((f) => f.name === 'ownership');
    if (ownershipFile === undefined) return;
    world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: WORLD_NOW,
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile.bytes,
    });

    const rerunEnvironment = environmentFor(world, { GITHUB_RUN_ATTEMPT: '2' });
    const rerunPayload = issuesEventPayload(world, 'opened');
    const rerunTracking = trackers();
    const result = await runHostedGate({ environment: rerunEnvironment, payload: rerunPayload }, buildDeps(world, rerunTracking));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.disposition).toBe('runnable');
  });

  it('a verified echo stops before capture', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const firstPayload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const first = await runHostedGate({ environment, payload: firstPayload }, buildDeps(world, tracking));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const ownershipFile = first.files.find((f) => f.name === 'ownership');
    if (ownershipFile === undefined) return;
    world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: WORLD_NOW,
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile.bytes,
    });

    const echoPayload = issuesEventPayload(world, 'edited', { senderId: WORLD_BOT_ID, senderType: 'Bot' });
    const echoTracking = trackers();
    const requestsBefore = world.requests.length;
    const echoDeps = buildDeps(world, echoTracking, { receipts: () => [5578290556] });
    const result = await runHostedGate({ environment, payload: echoPayload }, echoDeps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.disposition).toBe('duplicate');
    expect(result.files).toEqual([]);
    const requestsAfter = world.requests.slice(requestsBefore);
    expect(requestsAfter.some((r) => r.path.endsWith('/issues/29'))).toBe(false);
    expect(requestsAfter.some((r) => r.path.endsWith(`/repos/${WORLD_REPOSITORY}`))).toBe(false);
  });

  it('a bot event without receipts is captured', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const firstPayload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const first = await runHostedGate({ environment, payload: firstPayload }, buildDeps(world, tracking));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const ownershipFile = first.files.find((f) => f.name === 'ownership');
    if (ownershipFile === undefined) return;
    world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: WORLD_NOW,
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile.bytes,
    });

    const payload = issuesEventPayload(world, 'edited', { senderId: WORLD_BOT_ID, senderType: 'Bot' });
    const secondTracking = trackers();
    const requestsBefore = world.requests.length;
    const result = await runHostedGate({ environment, payload }, buildDeps(world, secondTracking));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.disposition).toBe('duplicate');
    const requestsAfter = world.requests.slice(requestsBefore);
    expect(requestsAfter.some((r) => r.path.endsWith('/issues/29'))).toBe(true);
  });

  it('a closure records a paired resolution', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const firstPayload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const first = await runHostedGate({ environment, payload: firstPayload }, buildDeps(world, tracking));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const ownershipFile = first.files.find((f) => f.name === 'ownership');
    if (ownershipFile === undefined) return;
    world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: WORLD_NOW,
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile.bytes,
    });

    const closedPayload = issuesEventPayload(world, 'closed', { senderId: WORLD_AUTHOR_ID });
    const closedTracking = trackers();
    const result = await runHostedGate({ environment, payload: closedPayload }, buildDeps(world, closedTracking));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.disposition).toBe('closure');
    expect(result.outputs['record_only']).toBe('true');
    expect(result.outputs['commit']).toBe('false');
    expect(result.files.map((f) => f.name)).toEqual(['closure']);

    const closureFile = result.files[0];
    if (closureFile === undefined) return;
    const decoded = decodeClosureContext(closureFile.bytes, {
      runId: WORLD_RUN_ID,
      maxAttempt: 1,
      repository: WORLD_REPOSITORY,
      repositoryId: WORLD_REPOSITORY_ID,
    });
    expect(decoded.ok).toBe(true);
    if (decoded.ok && decoded.value.event.kind === 'maintainer-resolution') {
      expect(decoded.value.event.payload.resolution).toBe('closed-by-author');
      expect(decoded.value.event.payload.paired_run).toEqual({ run_id: WORLD_RUN_ID, run_attempt: 1 });
    }
  });

  it('an invalid event mints no token', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const tracking = trackers();
    const result = await runHostedGate({ environment, payload: new TextEncoder().encode('not json') }, buildDeps(world, tracking));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('gate.event-invalid');
    expect(world.requests).toEqual([]);
    expect(tracking.masks).toEqual([]);
    expect(tracking.summaries.length).toBe(1);
    expect(tracking.summaries[0]).toContain('gate.event-invalid');
  });

  it('a missing trusted policy fails before the listing', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    world.setPolicy(null);
    const environment = environmentFor(world);
    const payload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const result = await runHostedGate({ environment, payload }, buildDeps(world, tracking));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('gate.policy-missing');
    expect(world.requests.some((r) => r.path.includes('/actions/artifacts'))).toBe(false);
  });

  it('an active repository gate is refused', async () => {
    const store = createStoreWorld();
    const policyText = worldPolicyText([['modes:\n  default: observe', 'modes:\n  default: advise']]);
    const world = createHostedWorld({ handlers: [store.handler], policyText });
    const environment = environmentFor(world);
    const payload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const result = await runHostedGate({ environment, payload }, buildDeps(world, tracking));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('gate.repository-gate-unsupported');
    expect(world.requests.some((r) => r.path.includes('/actions/artifacts'))).toBe(false);
  });

  it('an unavailable listing fails before capture', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    world.override((request) => {
      if (request.url.pathname.endsWith('/actions/artifacts')) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });
    const environment = environmentFor(world);
    const payload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const requestsBefore = world.requests.length;
    const result = await runHostedGate({ environment, payload }, buildDeps(world, tracking));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('ownership.listing-unavailable');
    const requestsAfter = world.requests.slice(requestsBefore);
    expect(requestsAfter.some((r) => r.path.endsWith('/issues/29'))).toBe(false);
  });

  it('a rerun or reopen commits despite an unavailable listing', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    world.override((request) => {
      if (request.url.pathname.endsWith('/actions/artifacts')) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });

    const rerunEnvironment = environmentFor(world, { GITHUB_RUN_ATTEMPT: '2' });
    const rerunPayload = issuesEventPayload(world, 'opened');
    const rerunTracking = trackers();
    const requestsBefore = world.requests.length;
    const rerunResult = await runHostedGate(
      { environment: rerunEnvironment, payload: rerunPayload },
      buildDeps(world, rerunTracking),
    );
    expect(rerunResult.ok).toBe(true);
    if (rerunResult.ok) {
      expect(rerunResult.disposition).toBe('runnable');
    }
    const requestsAfter = world.requests.slice(requestsBefore);
    expect(requestsAfter.some((r) => r.path.endsWith('/issues/29'))).toBe(true);

    const reopenEnvironment = environmentFor(world);
    const reopenPayload = issuesEventPayload(world, 'reopened');
    const reopenTracking = trackers();
    const reopenResult = await runHostedGate(
      { environment: reopenEnvironment, payload: reopenPayload },
      buildDeps(world, reopenTracking),
    );
    expect(reopenResult.ok).toBe(true);
    if (reopenResult.ok) {
      expect(reopenResult.disposition).toBe('runnable');
    }
  });

  it('minted tokens are masked and revoked', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const payload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const result = await runHostedGate({ environment, payload }, buildDeps(world, tracking));
    expect(result.ok).toBe(true);
    expect(tracking.masks).toEqual(world.tokens);
    const deletes = world.requests.filter((r) => r.method === 'DELETE' && r.path === '/installation/token');
    expect(deletes.length).toBe(world.tokens.length);
    const serialized = JSON.stringify(result);
    for (const token of world.tokens) {
      expect(serialized.includes(token)).toBe(false);
    }
  });

  it('the gate summary is written once', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const environment = environmentFor(world);
    const payload = issuesEventPayload(world, 'opened');
    const tracking = trackers();
    const result = await runHostedGate({ environment, payload }, buildDeps(world, tracking));
    expect(result.ok).toBe(true);
    expect(tracking.summaries.length).toBe(1);
    expect(tracking.summaries[0]?.startsWith('## Patch Steward gate')).toBe(true);
  });
});
