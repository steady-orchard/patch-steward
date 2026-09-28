import { describe, expect, it } from 'vitest';

import { createGitHubClient } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import { loadPolicy } from '../policy/loader.js';
import { captureIssue } from '../submission/intake.js';
import type { CaptureContext } from '../submission/intake.js';
import { encodeOwnershipRecord, ownershipRecordSchema } from '../ownership/record.js';
import type { OwnershipRecord } from '../ownership/record.js';
import { publishFreshnessFailure, verifyPublishFreshness } from './hosted-freshness.js';
import type { PublishFreshnessDeps } from './hosted-freshness.js';
import {
  WORLD_AUTHOR_ID,
  WORLD_REPOSITORY,
  WORLD_REPOSITORY_REF,
  WORLD_RUN_ID,
  createHostedWorld,
  worldPolicyText,
} from './hosted-world.test.js';
import type { HostedWorld, WorldRequest } from './hosted-world.test.js';

const ISSUE_UPDATED_AT = '2026-09-28T09:59:00Z';

function testClient(world: HostedWorld) {
  return createGitHubClient({
    token: 'test-token-' + 'f'.repeat(12),
    budget: createGitHubBudget({ requests: 100, retriesPerRequest: 0 }),
    fetch: world.fetch,
  });
}

function testDeps(world: HostedWorld): PublishFreshnessDeps {
  return {
    resolver: world.resolver,
    transport: world.transport,
    sleep: async (ms: number) => {
      world.requests.push({ method: 'SLEEP', host: '', path: String(ms) });
    },
  };
}

async function buildOwnRecord(world: HostedWorld): Promise<OwnershipRecord> {
  const client = testClient(world);
  const loaded = await loadPolicy({ kind: 'github', client, repository: WORLD_REPOSITORY_REF, branch: 'master' });
  if (!loaded.ok) throw new Error('buildOwnRecord: policy load failed');
  const context: CaptureContext = {
    client,
    repository: WORLD_REPOSITORY_REF,
    policy: loaded.value.policy,
    policyRevision: loaded.value.revision.id,
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    authorResponses: [],
  };
  const captured = await captureIssue(context, 29);
  if (!captured.ok) throw new Error('buildOwnRecord: capture failed');
  const record = ownershipRecordSchema.parse({
    schema_version: 1,
    record_type: 'ownership',
    repository: WORLD_REPOSITORY,
    subject: { type: 'issue', number: 29 },
    run_id: WORLD_RUN_ID,
    run_attempt: 1,
    check_id: null,
    snapshot_hash: captured.value.snapshotHash,
    policy_revision: world.policyTreeId(),
    disposition: 'runnable',
    admission: 'not-required',
    cap: { state: 'within', daily_count: 1, daily_limit: 50, author_count: 1, author_limit: 2 },
    event: {
      name: 'issues',
      action: 'opened',
      object_id: 5578290556,
      object_updated_at: ISSUE_UPDATED_AT,
      sender_id: WORLD_AUTHOR_ID,
      sender_type: 'User',
    },
    author_id: WORLD_AUTHOR_ID,
    created_at: '2026-09-28T10:00:04.000Z',
  });
  return record;
}

function addOwnArtifact(world: HostedWorld, record: OwnershipRecord): { id: number; createdAt: string; workflowRunId: number } {
  const encoded = encodeOwnershipRecord(record);
  if (!encoded.ok) throw new Error('addOwnArtifact: encoding failed');
  const artifact = world.addArtifact({
    name: 'steward-ownership-issue-29',
    createdAt: '2026-09-28T10:00:05Z',
    workflowRunId: WORLD_RUN_ID,
    recordBytes: encoded.value,
  });
  return { id: artifact.id, createdAt: artifact.createdAt, workflowRunId: artifact.workflowRunId };
}

describe('publish freshness verification', () => {
  it('publish verification waits the settle delay before listing', async () => {
    const world = createHostedWorld();
    const record = await buildOwnRecord(world);
    const own = addOwnArtifact(world, record);
    const client = testClient(world);
    const requestsBefore = world.requests.length;

    await verifyPublishFreshness(
      { client, repository: WORLD_REPOSITORY_REF, defaultBranch: 'master', subject: { type: 'issue', number: 29 }, own, record },
      testDeps(world),
    );

    const callRequests = world.requests.slice(requestsBefore);
    const first = callRequests[0] as WorldRequest;
    expect(first).toEqual({ method: 'SLEEP', host: '', path: '10000' });
    const listingIndex = callRequests.findIndex((r) => r.path.includes('/actions/artifacts'));
    expect(listingIndex).toBeGreaterThan(0);
  });

  it('an unchanged submission is current', async () => {
    const world = createHostedWorld();
    const record = await buildOwnRecord(world);
    const own = addOwnArtifact(world, record);
    const client = testClient(world);

    const result = await verifyPublishFreshness(
      { client, repository: WORLD_REPOSITORY_REF, defaultBranch: 'master', subject: { type: 'issue', number: 29 }, own, record },
      testDeps(world),
    );

    expect(result.freshness).toEqual({ kind: 'current' });
  });

  it('a newer owner supersedes with its recorded attempt', async () => {
    const world = createHostedWorld();
    const record = await buildOwnRecord(world);
    const own = addOwnArtifact(world, record);

    const successorRecord = ownershipRecordSchema.parse({ ...record, run_id: WORLD_RUN_ID + 1, run_attempt: 2 });
    const encodedSuccessor = encodeOwnershipRecord(successorRecord);
    if (!encodedSuccessor.ok) throw new Error('encoding failed');
    world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: '2026-09-28T10:00:09Z',
      workflowRunId: WORLD_RUN_ID + 1,
      recordBytes: encodedSuccessor.value,
    });

    const client = testClient(world);
    const result = await verifyPublishFreshness(
      { client, repository: WORLD_REPOSITORY_REF, defaultBranch: 'master', subject: { type: 'issue', number: 29 }, own, record },
      testDeps(world),
    );

    expect(result.freshness).toEqual({
      kind: 'superseded',
      reason: 'newer-owner',
      successor: { run_id: WORLD_RUN_ID + 1, run_attempt: 2, artifact_created_at: '2026-09-28T10:00:09Z' },
    });
  });

  it('a newer owner with an invalid record is unknown', async () => {
    const world = createHostedWorld();
    const record = await buildOwnRecord(world);
    const own = addOwnArtifact(world, record);

    world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: '2026-09-28T10:00:09Z',
      workflowRunId: WORLD_RUN_ID + 1,
      zip: new TextEncoder().encode('not a zip'),
    });

    const client = testClient(world);
    const result = await verifyPublishFreshness(
      { client, repository: WORLD_REPOSITORY_REF, defaultBranch: 'master', subject: { type: 'issue', number: 29 }, own, record },
      testDeps(world),
    );

    expect(result.freshness).toEqual({ kind: 'unknown', reason: 'successor-unavailable' });
  });

  it('a tie with the own artifact is unknown', async () => {
    const world = createHostedWorld();
    const record = await buildOwnRecord(world);
    const own = addOwnArtifact(world, record);

    const tiedRecord = ownershipRecordSchema.parse({ ...record, run_id: WORLD_RUN_ID + 2, run_attempt: 1 });
    const encodedTied = encodeOwnershipRecord(tiedRecord);
    if (!encodedTied.ok) throw new Error('encoding failed');
    world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID + 2,
      recordBytes: encodedTied.value,
    });

    const client = testClient(world);
    const result = await verifyPublishFreshness(
      { client, repository: WORLD_REPOSITORY_REF, defaultBranch: 'master', subject: { type: 'issue', number: 29 }, own, record },
      testDeps(world),
    );

    expect(result.freshness).toEqual({ kind: 'unknown', reason: 'tie' });
  });

  it('a changed body supersedes with the live snapshot', async () => {
    const world = createHostedWorld();
    const record = await buildOwnRecord(world);
    const own = addOwnArtifact(world, record);

    const issue = world.issues.get(29);
    if (issue === undefined) throw new Error('issue 29 missing');
    issue.body = `${issue.body ?? ''}\n\nedited`;

    const client = testClient(world);
    const result = await verifyPublishFreshness(
      { client, repository: WORLD_REPOSITORY_REF, defaultBranch: 'master', subject: { type: 'issue', number: 29 }, own, record },
      testDeps(world),
    );

    expect(result.freshness.kind).toBe('superseded');
    if (result.freshness.kind === 'superseded' && result.freshness.reason === 'snapshot-changed') {
      expect(result.freshness.liveSnapshotHash).not.toBe(record.snapshot_hash);
    } else {
      throw new Error('expected snapshot-changed');
    }
  });

  it('a changed live policy supersedes', async () => {
    const world = createHostedWorld();
    const record = await buildOwnRecord(world);
    const own = addOwnArtifact(world, record);

    world.setPolicy(worldPolicyText([['daily_runs: 50', 'daily_runs: 49']]));

    const client = testClient(world);
    const result = await verifyPublishFreshness(
      { client, repository: WORLD_REPOSITORY_REF, defaultBranch: 'master', subject: { type: 'issue', number: 29 }, own, record },
      testDeps(world),
    );

    expect(result.freshness.kind).toBe('superseded');
    if (result.freshness.kind === 'superseded') {
      expect(result.freshness.reason).toBe('snapshot-changed');
    }
  });

  it('a failed listing is unknown', async () => {
    const world = createHostedWorld();
    const record = await buildOwnRecord(world);
    const own = addOwnArtifact(world, record);
    world.override((request) => {
      if (request.url.pathname.endsWith('/actions/artifacts')) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });

    const client = testClient(world);
    const result = await verifyPublishFreshness(
      { client, repository: WORLD_REPOSITORY_REF, defaultBranch: 'master', subject: { type: 'issue', number: 29 }, own, record },
      testDeps(world),
    );

    expect(result.freshness).toEqual({ kind: 'unknown', reason: 'listing-unavailable' });
  });

  it('a failed recapture is unknown', async () => {
    const world = createHostedWorld();
    const record = await buildOwnRecord(world);
    const own = addOwnArtifact(world, record);
    world.override((request) => {
      if (request.url.pathname.endsWith('/issues/29')) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });

    const client = testClient(world);
    const result = await verifyPublishFreshness(
      { client, repository: WORLD_REPOSITORY_REF, defaultBranch: 'master', subject: { type: 'issue', number: 29 }, own, record },
      testDeps(world),
    );

    expect(result.freshness).toEqual({ kind: 'unknown', reason: 'recapture-unavailable' });
  });

  it('a newer owner needs no recapture', async () => {
    const world = createHostedWorld();
    const record = await buildOwnRecord(world);
    const own = addOwnArtifact(world, record);

    const successorRecord = ownershipRecordSchema.parse({ ...record, run_id: WORLD_RUN_ID + 1, run_attempt: 2 });
    const encodedSuccessor = encodeOwnershipRecord(successorRecord);
    if (!encodedSuccessor.ok) throw new Error('encoding failed');
    world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: '2026-09-28T10:00:09Z',
      workflowRunId: WORLD_RUN_ID + 1,
      recordBytes: encodedSuccessor.value,
    });

    const client = testClient(world);
    const requestsBefore = world.requests.length;
    await verifyPublishFreshness(
      { client, repository: WORLD_REPOSITORY_REF, defaultBranch: 'master', subject: { type: 'issue', number: 29 }, own, record },
      testDeps(world),
    );

    const afterCallRequests = world.requests.slice(requestsBefore);
    expect(afterCallRequests.some((r) => r.path.endsWith('/git/ref/heads/master'))).toBe(false);
    expect(afterCallRequests.some((r) => r.path.endsWith('/issues/29'))).toBe(false);
  });

  it('unknown freshness is a typed failure', () => {
    const failure = publishFreshnessFailure('tie');
    expect(failure.ok).toBe(false);
    expect(failure.failure.code).toBe('publish.freshness-unknown');
    expect(failure.failure.cause).toBe('github-unavailable');
    expect(failure.failure.outcome).toBe('inconclusive');
    expect(failure.failure.details[0]?.path).toBe('tie');
  });
});
