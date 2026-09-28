import { describe, expect, it } from 'vitest';

import { fixedClock } from '../clock.js';
import { ok } from '../result.js';
import { gitBlobId } from '../evidence/blob-id.js';
import { createStoreWorld } from '../evidence/store-world.test.js';
import { readGateEnvironment, readPublishEnvironment } from '../pipeline/hosted-environment.js';
import {
  createHostedWorld,
  gateEnvironment,
  publishEnvironment,
  pullRequestEventPayload,
  worldPolicyText,
  WORLD_REPOSITORY,
  WORLD_REPOSITORY_ID,
  WORLD_RUN_ID,
} from '../pipeline/hosted-world.test.js';
import type { HostedGateDeps, HostedGateResult } from '../pipeline/hosted-gate.js';
import { runHostedGate } from '../pipeline/hosted-gate.js';
import type { HostedPublishDeps } from '../pipeline/hosted-publish.js';
import { runHostedPublish } from '../pipeline/hosted-publish.js';
import { decodeGateContext, decodeHandoffBytes } from '../pipeline/gate-context.js';
import type { HostedRunExpectation } from '../pipeline/gate-context.js';
import { handoffRecordSchema } from '../pipeline/handoff.js';

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

function fileBytes(gate: Extract<HostedGateResult, { readonly ok: true }>, name: string): Uint8Array | null {
  return gate.files.find((f) => f.name === name)?.bytes ?? null;
}

describe('invariant 2: hosted trusted-branch policy', () => {
  it('pull request policy changes never govern the hosted run', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });

    const pull = world.pulls.get(26);
    if (pull === undefined) {
      throw new Error('expected pull 26 in the hosted world');
    }
    pull.files = [...pull.files, { filename: '.github/patch-steward/policy.yml', status: 'modified' }];

    const FROM = 'modes:\n  default: observe';
    const TO = 'modes:\n  default: enforce';
    const headPolicyText = worldPolicyText([[FROM, TO]]);
    world.setHeadPolicy(pull.headSha, headPolicyText);
    const headBlobId = gitBlobId(Buffer.from(headPolicyText, 'utf8'));
    const headTreeId = gitBlobId(Buffer.from(`tree\npolicy.yml ${headBlobId}`));

    const environment = gateEnvFor(world, { GITHUB_EVENT_NAME: 'pull_request_target' });
    const payload = pullRequestEventPayload(world, 'edited');
    const gate = await runHostedGate({ environment, payload }, gateDeps(world, trackers()));

    if (!gate.ok) {
      expect(gate.failure.code).not.toBe('gate.repository-gate-unsupported');
    }
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;

    expect(gate.outputs['policy_revision']).toBe(world.policyTreeId());

    const expectation: HostedRunExpectation = {
      runId: WORLD_RUN_ID,
      maxAttempt: 1,
      repository: WORLD_REPOSITORY,
      repositoryId: WORLD_REPOSITORY_ID,
    };

    const contextBytes = fileBytes(gate, 'gate-context');
    expect(contextBytes).not.toBeNull();
    if (contextBytes === null) return;
    const decodedContext = decodeGateContext(contextBytes, expectation);
    expect(decodedContext.ok).toBe(true);
    if (decodedContext.ok) {
      expect(decodedContext.value.policy.revision).toBe(world.policyTreeId());
    }

    const handoffBytes = fileBytes(gate, 'handoff');
    expect(handoffBytes).not.toBeNull();
    if (handoffBytes === null) return;
    const decodedHandoff = decodeHandoffBytes(handoffBytes);
    expect(decodedHandoff.ok).toBe(true);
    if (!decodedHandoff.ok) return;
    const parsedHandoff = handoffRecordSchema.parse(decodedHandoff.value);
    expect(parsedHandoff.findings.some((f) => f.code === 'submission.policy-change')).toBe(true);

    const ownershipFile = fileBytes(gate, 'ownership');
    expect(ownershipFile).not.toBeNull();
    if (ownershipFile === null) return;
    world.addArtifact({
      name: gate.outputs['ownership_artifact'] ?? '',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: ownershipFile,
    });

    // A second, later run supersedes the first: this exercises the 'newer-owner' publish path,
    // which never needs to recapture the live submission (and so never re-reads the head tree).
    pull.body = `${pull.body ?? ''}\nedited by a newer run`;
    const nextRunId = WORLD_RUN_ID + 1;
    const rerunEnvironment = gateEnvFor(world, { GITHUB_EVENT_NAME: 'pull_request_target', GITHUB_RUN_ID: String(nextRunId) });
    const rerunPayload = pullRequestEventPayload(world, 'edited');
    const rerunGate = await runHostedGate({ environment: rerunEnvironment, payload: rerunPayload }, gateDeps(world, trackers()));
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

    const requestsBefore = world.requests.length;
    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs, { GITHUB_EVENT_NAME: 'pull_request_target' }),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, trackers()),
    );
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;
    expect(publish.status).toBe('superseded');

    const publishRequests = world.requests.slice(requestsBefore);
    const trustedTreeSuffix = `/git/trees/${world.policyTreeId() ?? ''}?recursive=1`;
    const headTreeSuffix = `/git/trees/${headTreeId}?recursive=1`;
    expect(publishRequests.some((r) => r.path.endsWith(trustedTreeSuffix))).toBe(true);
    expect(publishRequests.some((r) => r.path.endsWith(headTreeSuffix))).toBe(false);

    const files = store.files(WORLD_REPOSITORY);
    const runJsonBytes = files.get(`${WORLD_REPOSITORY}/runs/pr-26/${String(WORLD_RUN_ID)}-1/run.json`);
    expect(runJsonBytes).toBeDefined();
    if (runJsonBytes === undefined) return;
    const runRecord = JSON.parse(Buffer.from(runJsonBytes).toString('utf8')) as { readonly policy_revision: string };
    expect(runRecord.policy_revision).toBe(world.policyTreeId());
  });
});
