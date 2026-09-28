import { describe, expect, it } from 'vitest';

import { fixedClock } from '../clock.js';
import { ok } from '../result.js';
import { createStoreWorld } from '../evidence/store-world.test.js';
import { createAppJwt } from '../github/app-auth.js';
import { decodeOwnershipRecord } from '../ownership/record.js';
import { buildRunName, parseRunName } from '../ownership/caps.js';
import { exactValueForms } from '../redaction/redact.js';
import {
  APP_JWT_BACKDATE_SECONDS,
  APP_JWT_LIFETIME_SECONDS,
  EVENT_PAYLOAD_MAX_BYTES,
  EVIDENCE_CONFLICT_WAIT_MAX_MS,
  EVIDENCE_CONFLICT_WAIT_STEP_MS,
  EVIDENCE_FALLBACK_ENTRIES_MAX,
  EVIDENCE_FALLBACK_FILE_MAX_BYTES,
  HANDOFF_MAX_BYTES,
  JOB_SUMMARY_MAX_LENGTH,
  OWNERSHIP_ARTIFACT_ENTRIES,
  OWNERSHIP_ARTIFACT_MAX_BYTES,
  OWNERSHIP_LISTING_PAGES_MAX,
  OWNERSHIP_RECORD_MAX_BYTES,
  OWNERSHIP_RETENTION_DAYS,
  OWNERSHIP_SETTLE_DELAY_MS,
  RUN_DISPLAY_TITLE_MAX_LENGTH,
  RUN_LIST_PAGES_MAX,
  RUNTIME_ARCHIVE_MAX_BYTES,
  SAME_RUN_ARTIFACT_RETENTION_DAYS,
} from '../policy/bounds.js';
import { decodeHandoffBytes } from '../pipeline/gate-context.js';
import { readGateEnvironment, readPublishEnvironment } from '../pipeline/hosted-environment.js';
import {
  createHostedWorld,
  gateEnvironment,
  issuesEventPayload,
  publishEnvironment,
  WORLD_NOW,
  WORLD_REPOSITORY,
  WORLD_RUN_ID,
} from '../pipeline/hosted-world.test.js';
import type { HostedGateDeps, HostedGateResult } from '../pipeline/hosted-gate.js';
import { runHostedGate } from '../pipeline/hosted-gate.js';
import type { HostedPublishDeps, HostedPublishResult } from '../pipeline/hosted-publish.js';
import { runHostedPublish } from '../pipeline/hosted-publish.js';

type World = ReturnType<typeof createHostedWorld>;
type Tracking = { readonly masks: string[]; readonly summaries: string[] };

function trackers(): Tracking {
  return { masks: [], summaries: [] };
}

function gateDeps(world: World, tracking: Tracking, overrides?: Partial<HostedGateDeps>): HostedGateDeps {
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

function publishDeps(world: World, tracking: Tracking, overrides?: Partial<HostedPublishDeps>): HostedPublishDeps {
  return {
    fetch: world.fetch,
    sleep: async () => undefined,
    clock: fixedClock('2026-09-28T10:00:30.000Z'),
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    mask: (s: string) => tracking.masks.push(s),
    writeSummary: async (t: string) => {
      tracking.summaries.push(t);
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

async function runGate(world: World, tracking: Tracking, action: string, number?: number): Promise<HostedGateResult> {
  const environment = gateEnvFor(world);
  const payload = issuesEventPayload(world, action, number !== undefined ? { number } : undefined);
  return runHostedGate({ environment, payload }, gateDeps(world, tracking));
}

function fileBytes(gate: Extract<HostedGateResult, { readonly ok: true }>, name: string): Uint8Array | null {
  return gate.files.find((f) => f.name === name)?.bytes ?? null;
}

async function runPublishAfterGate(
  world: World,
  tracking: Tracking,
  gate: Extract<HostedGateResult, { readonly ok: true }>,
  overrides?: Partial<HostedPublishDeps>,
): Promise<HostedPublishResult> {
  return runHostedPublish(
    {
      environment: publishEnvFor(world, gate.outputs),
      files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
    },
    publishDeps(world, tracking, overrides),
  );
}

function decodeUtf8(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8');
}

function collectHaystacks(
  store: ReturnType<typeof createStoreWorld>,
  gate: Extract<HostedGateResult, { readonly ok: true }>,
  gateTracking: Tracking,
  publish: Extract<HostedPublishResult, { readonly ok: true }>,
  publishTracking: Tracking,
): readonly string[] {
  const haystacks: string[] = [];
  haystacks.push(...Object.values(gate.outputs));
  haystacks.push(...gate.logLines);
  haystacks.push(...gateTracking.summaries);
  haystacks.push(...gate.files.map((f) => decodeUtf8(f.bytes)));
  haystacks.push(...Object.values(publish.outputs));
  haystacks.push(...publish.logLines);
  haystacks.push(...publishTracking.summaries);
  for (const bytes of store.files(WORLD_REPOSITORY).values()) {
    haystacks.push(decodeUtf8(bytes));
  }
  return haystacks;
}

describe('invariant 7: hosted credentials and bounds', () => {
  it('invariant 7: the app key and tokens never reach hosted outputs or evidence', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const sentinel = 'ghp' + '_' + 'Z'.repeat(36);
    const issue = world.issues.get(29);
    if (issue === undefined) throw new Error('expected issue 29');
    issue.body = `${issue.body ?? ''}\n${world.credentials.privateKey}\n${sentinel}`;

    const gateTracking = trackers();
    const gate = await runGate(world, gateTracking, 'opened');
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
    const publish = await runPublishAfterGate(world, publishTracking, gate);
    expect(publish.ok).toBe(true);
    if (!publish.ok) return;

    const haystacks = collectHaystacks(store, gate, gateTracking, publish, publishTracking);
    const secrets = [world.credentials.privateKey, ...world.tokens, sentinel];
    for (const secret of secrets) {
      for (const form of exactValueForms(secret)) {
        for (const haystack of haystacks) {
          expect(haystack.includes(form)).toBe(false);
        }
      }
    }
    const keyLines = world.credentials.privateKey.split('\n').filter((line) => line.length > 20);
    expect(keyLines.length).toBeGreaterThan(0);
    for (const line of keyLines) {
      for (const haystack of haystacks) {
        expect(haystack.includes(line)).toBe(false);
      }
    }
  });

  it('invariant 7: every minted token is masked before it is used', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const masks: string[] = [];
    const summaries: string[] = [];
    const mask = (s: string): void => {
      masks.push(s);
      world.requests.push({ method: 'MASK', host: '', path: '' });
    };
    const tracking: Tracking = { masks, summaries };

    const environment = gateEnvFor(world);
    const payload = issuesEventPayload(world, 'opened');
    const gate = await runHostedGate({ environment, payload }, gateDeps(world, tracking, { mask }));
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

    const publish = await runHostedPublish(
      {
        environment: publishEnvFor(world, gate.outputs),
        files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
      },
      publishDeps(world, tracking, { mask }),
    );
    expect(publish.ok).toBe(true);

    expect(masks).toEqual(world.tokens);

    const mintPath = /^\/app\/installations\/\d+\/access_tokens$/;
    let markerCount = 0;
    world.requests.forEach((request, index) => {
      if (request.method === 'MASK') {
        markerCount += 1;
        const previous = world.requests[index - 1];
        expect(previous?.method).toBe('POST');
        expect(previous !== undefined && mintPath.test(previous.path)).toBe(true);
      }
    });
    const mintRequestCount = world.requests.filter((r) => r.method === 'POST' && mintPath.test(r.path)).length;
    expect(markerCount).toBe(mintRequestCount);
  });

  it('invariant 7: hosted constants keep their hard values', () => {
    expect(OWNERSHIP_SETTLE_DELAY_MS).toBe(10000);
    expect(OWNERSHIP_RECORD_MAX_BYTES).toBe(16384);
    expect(OWNERSHIP_ARTIFACT_MAX_BYTES).toBe(65536);
    expect(OWNERSHIP_ARTIFACT_ENTRIES).toBe(1);
    expect(OWNERSHIP_LISTING_PAGES_MAX).toBe(10);
    expect(RUN_LIST_PAGES_MAX).toBe(10);
    expect(EVENT_PAYLOAD_MAX_BYTES).toBe(26214400);
    expect(RUN_DISPLAY_TITLE_MAX_LENGTH).toBe(1024);
    expect(EVIDENCE_CONFLICT_WAIT_STEP_MS).toBe(1000);
    expect(EVIDENCE_CONFLICT_WAIT_MAX_MS).toBe(10000);
    expect(EVIDENCE_FALLBACK_ENTRIES_MAX).toBe(1000);
    expect(EVIDENCE_FALLBACK_FILE_MAX_BYTES).toBe(1048576);
    expect(JOB_SUMMARY_MAX_LENGTH).toBe(65536);
    expect(OWNERSHIP_RETENTION_DAYS).toBe(90);
    expect(APP_JWT_LIFETIME_SECONDS).toBe(540);
    expect(APP_JWT_BACKDATE_SECONDS).toBe(60);
    expect(RUNTIME_ARCHIVE_MAX_BYTES).toBe(52428800);
    expect(SAME_RUN_ARTIFACT_RETENTION_DAYS).toBe(1);
    expect(HANDOFF_MAX_BYTES).toBe(8388608);
  });

  it('invariant 7: publish waits exactly the settle delay', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gateTracking = trackers();
    const gate = await runGate(world, gateTracking, 'opened');
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

    const sleeps: number[] = [];
    const publishTracking = trackers();
    const publish = await runPublishAfterGate(world, publishTracking, gate, {
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
    });
    expect(publish.ok).toBe(true);
    expect(sleeps).toEqual([10000]);
  });

  it('invariant 7: hosted inputs are size bounded', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const tracking = trackers();

    const oversizedEvent = new TextEncoder().encode(' '.repeat(EVENT_PAYLOAD_MAX_BYTES + 1 - 2) + '{}');
    const eventResult = await runHostedGate({ environment: gateEnvFor(world), payload: oversizedEvent }, gateDeps(world, tracking));
    expect(eventResult.ok).toBe(false);
    if (!eventResult.ok) {
      expect(eventResult.failure.code).toBe('gate.event-invalid');
    }

    const oversizedRecord = new Uint8Array(OWNERSHIP_RECORD_MAX_BYTES + 1);
    const recordResult = decodeOwnershipRecord(oversizedRecord, {
      repository: WORLD_REPOSITORY,
      type: 'issue',
      number: 29,
      artifactName: 'steward-ownership-issue-29',
      workflowRunId: null,
    });
    expect(recordResult.ok).toBe(false);
    if (!recordResult.ok) {
      expect(recordResult.failure.code).toBe('ownership.record-invalid');
    }

    const oversizedHandoff = new Uint8Array(HANDOFF_MAX_BYTES + 1);
    const handoffResult = decodeHandoffBytes(oversizedHandoff);
    expect(handoffResult.ok).toBe(false);
    if (!handoffResult.ok) {
      expect(handoffResult.failure.code).toBe('pipeline.handoff-invalid');
    }

    const validName = buildRunName({
      kind: 'issue',
      number: 29,
      authorId: 2095171,
      eventName: 'issues',
      action: 'opened',
      senderId: 2095171,
      senderType: 'User',
    });
    const paddedName = validName + ' '.repeat(RUN_DISPLAY_TITLE_MAX_LENGTH + 1 - validName.length);
    expect(paddedName.length).toBeGreaterThan(RUN_DISPLAY_TITLE_MAX_LENGTH);
    expect(parseRunName(paddedName)).toBeNull();

    const oversizedZip = new Uint8Array(OWNERSHIP_ARTIFACT_MAX_BYTES + 1);
    world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      zip: oversizedZip,
    });
    const zipGate = await runGate(world, trackers(), 'opened');
    expect(zipGate.ok).toBe(false);
    if (!zipGate.ok) {
      expect(zipGate.failure.code).toBe('ownership.record-invalid');
    }
  });

  it('invariant 7: hosted job summaries stay within the bound', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const gateTracking = trackers();
    const gate = await runGate(world, gateTracking, 'opened');
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
    const publish = await runPublishAfterGate(world, publishTracking, gate);
    expect(publish.ok).toBe(true);

    expect(gateTracking.summaries.length).toBeGreaterThan(0);
    expect(publishTracking.summaries.length).toBeGreaterThan(0);
    for (const summary of [...gateTracking.summaries, ...publishTracking.summaries]) {
      expect(summary.length).toBeLessThanOrEqual(JOB_SUMMARY_MAX_LENGTH);
    }
  });

  it('invariant 7: store conflict waits are bounded', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    world.override((request) => {
      if (request.method === 'PATCH' && request.url.pathname.endsWith('/git/refs/heads/steward-evidence')) {
        return new Response(JSON.stringify({ message: 'Update is not a fast forward' }), { status: 422 });
      }
      return undefined;
    });
    store.advance(WORLD_REPOSITORY, { [`${WORLD_REPOSITORY}/runs/pre-existing.json`]: new TextEncoder().encode('{}') });

    const gateTracking = trackers();
    const gate = await runGate(world, gateTracking, 'opened');
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

    const sleeps: number[] = [];
    const publishTracking = trackers();
    const publish = await runPublishAfterGate(world, publishTracking, gate, {
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
    });
    expect(publish.ok).toBe(false);
    if (!publish.ok) {
      expect(publish.failure.code).toBe('evidence.store-conflict');
    }
    expect(sleeps).toEqual([1000, 2000, 3000, 4000, 5000]);
    for (const ms of sleeps) {
      expect(ms).toBeLessThanOrEqual(EVIDENCE_CONFLICT_WAIT_MAX_MS);
    }
  });

  it('invariant 7: app jwts expire within the hard lifetime', () => {
    const world = createHostedWorld();
    const nowMs = Date.parse(WORLD_NOW);
    const jwt = createAppJwt(world.credentials, nowMs);
    expect(jwt.ok).toBe(true);
    if (!jwt.ok) return;
    const parts = jwt.value.split('.');
    expect(parts.length).toBe(3);
    const payloadPart = parts[1] as string;
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(APP_JWT_LIFETIME_SECONDS);
    expect(payload.iat).toBe(Math.floor(nowMs / 1000) - APP_JWT_BACKDATE_SECONDS);
  });
});
