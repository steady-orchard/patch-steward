import { describe, expect, it } from 'vitest';

import { createGitHubBudget } from '../github/budget.js';
import { createGitHubClient } from '../github/client.js';
import { createGitHubWriter } from '../github/writer.js';
import { metricsEventRecordSchema } from '../records/metrics-event.js';
import { prepareClosureEvidence, prepareSupersessionEvidence, runEvidenceGroups } from './prepare-records.js';
import { writeEvidenceCommit } from './store-readback.js';

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe('evidence store groups', () => {
  it('run groups hold the run directory with its manifest and the metrics file', () => {
    const result = runEvidenceGroups({
      storePath: 'runs/issue-29/36081628326-1',
      files: [
        { path: 'run.json', bytes: encode('{}') },
        { path: 'logs/steward.txt', bytes: encode('log') },
      ],
      manifestBytes: encode('{"manifest":true}'),
      metrics: { path: 'metrics/2026-09/36081628326-1.json', bytes: encode('[]') },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    const [runGroup, metricsGroup] = result.value;
    expect(runGroup?.directory).toBe('runs/issue-29/36081628326-1');
    expect(runGroup?.mode).toBe('exact');
    expect(runGroup?.files.at(-1)?.path).toBe('manifest.json');
    expect(metricsGroup?.directory).toBe('metrics/2026-09');
    expect(metricsGroup?.mode).toBe('contains');
    expect(metricsGroup?.files[0]?.path).toBe('36081628326-1.json');
  });

  it('invalid run group paths are layout errors', () => {
    const result = runEvidenceGroups({
      storePath: 'runs/issue-29/local-x',
      files: [],
      manifestBytes: encode('{}'),
      metrics: { path: 'metrics/2026-13/a.json', bytes: encode('[]') },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.layout-invalid');
    }
  });

  it('a newer-owner supersession records its successor', async () => {
    const result = await prepareSupersessionEvidence({
      runId: 36081628326,
      runAttempt: 1,
      subject: { repository: 'octo/demo', type: 'issue', number: 29 },
      reason: 'newer-owner',
      successor: { run_id: 36081629000, run_attempt: 2, artifact_created_at: '2026-09-28T10:01:00Z' },
      recordedSnapshotHash: 'sha256:' + 'a'.repeat(64),
      liveSnapshotHash: null,
      from: 'needs-changes',
      recordedAt: '2026-09-28T10:02:00.000Z',
      credentials: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const directories = result.value.groups.map((group) => group.directory);
    expect(directories).toEqual(['runs/issue-29/supersessions', 'metrics/2026-09']);
    const filePaths = result.value.groups.map((group) => group.files[0]?.path);
    expect(filePaths).toEqual(['36081628326-1.json', '36081628326-1-supersession.json']);
    expect(result.value.storePaths).toEqual([
      'runs/issue-29/supersessions/36081628326-1.json',
      'metrics/2026-09/36081628326-1-supersession.json',
    ]);
    const metricsFile = result.value.groups[1]?.files[0];
    const parsedMetrics = JSON.parse(decode(metricsFile?.bytes as Uint8Array)) as unknown[];
    expect(parsedMetrics).toHaveLength(1);
    const event = metricsEventRecordSchema.parse(parsedMetrics[0]);
    expect(event.kind).toBe('state-transition');
    if (event.kind === 'state-transition') {
      expect(event.payload).toEqual({ from: 'needs-changes', to: 'superseded' });
    }
  });

  it('a snapshot-changed supersession needs the live snapshot', async () => {
    const base = {
      runId: 36081628326,
      runAttempt: 1,
      subject: { repository: 'octo/demo', type: 'issue' as const, number: 29 },
      reason: 'snapshot-changed' as const,
      successor: null,
      recordedSnapshotHash: 'sha256:' + 'a'.repeat(64),
      from: 'needs-changes' as const,
      recordedAt: '2026-09-28T10:02:00.000Z',
      credentials: [],
    };
    const missing = await prepareSupersessionEvidence({ ...base, liveSnapshotHash: null });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.failure.code).toBe('evidence.record-invalid');
    }
    const hash = 'sha256:' + 'b'.repeat(64);
    const withHash = await prepareSupersessionEvidence({ ...base, liveSnapshotHash: hash });
    expect(withHash.ok).toBe(true);
    if (withHash.ok) {
      expect(withHash.value.record.live_snapshot_hash).toBe(hash);
    }
  });

  it('a closure commits one metrics file', async () => {
    const event = metricsEventRecordSchema.parse({
      schema_version: 1,
      record_type: 'metrics-event',
      subject: { kind: 'submission', repository: 'octo/demo', type: 'issue', number: 29 },
      recorded_at: '2026-09-28T10:00:03.000Z',
      kind: 'maintainer-resolution',
      payload: {
        action_kind: 'resolution',
        dismissal_code: null,
        resolution: 'closed-by-author',
        paired_run: null,
        paired_snapshot_hash: null,
      },
    });
    const result = await prepareClosureEvidence({ runId: 36081628326, runAttempt: 1, event, credentials: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.groups).toHaveLength(1);
    const group = result.value.groups[0];
    expect(group?.directory).toBe('metrics/2026-09');
    expect(group?.files).toHaveLength(1);
    expect(group?.files[0]?.path).toBe('36081628326-1.json');
    const parsed = JSON.parse(decode(group?.files[0]?.bytes as Uint8Array)) as unknown[];
    expect(parsed).toEqual([event]);
  });

  it('a closure needs a submission resolution event', async () => {
    const event = metricsEventRecordSchema.parse({
      schema_version: 1,
      record_type: 'metrics-event',
      subject: { kind: 'run', run_id: 5, run_attempt: 1 },
      recorded_at: '2026-09-28T10:00:03.000Z',
      kind: 'latency',
      payload: { stage: 'assess', seconds: 1 },
    });
    const result = await prepareClosureEvidence({ runId: 5, runAttempt: 1, event, credentials: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.record-invalid');
    }
  });

  it('store groups pass the commit layout check', async () => {
    const fetch = async (): Promise<Response> => new Response('{"message":"boom"}', { status: 500 });
    const token = 'test-token-' + 'g'.repeat(12);
    const store = { repository: { owner: 'octo', name: 'demo' }, branch: 'steward-evidence' };
    const budget = createGitHubBudget({ requests: 5, retriesPerRequest: 0 });
    const client = createGitHubClient({ token, budget, fetch });
    const writer = createGitHubWriter({ token, scope: { kind: 'installation', store }, budget, fetch });
    const deps = { client, writer, sleep: async (): Promise<void> => undefined };

    const runGroups = runEvidenceGroups({
      storePath: 'runs/issue-29/36081628326-1',
      files: [{ path: 'run.json', bytes: encode('{}') }],
      manifestBytes: encode('{}'),
      metrics: { path: 'metrics/2026-09/36081628326-1.json', bytes: encode('[]') },
    });
    expect(runGroups.ok).toBe(true);

    const supersession = await prepareSupersessionEvidence({
      runId: 36081628326,
      runAttempt: 1,
      subject: { repository: 'octo/demo', type: 'issue', number: 29 },
      reason: 'newer-owner',
      successor: { run_id: 36081629000, run_attempt: 2, artifact_created_at: '2026-09-28T10:01:00Z' },
      recordedSnapshotHash: 'sha256:' + 'a'.repeat(64),
      liveSnapshotHash: null,
      from: 'needs-changes',
      recordedAt: '2026-09-28T10:02:00.000Z',
      credentials: [],
    });
    expect(supersession.ok).toBe(true);

    const closureEvent = metricsEventRecordSchema.parse({
      schema_version: 1,
      record_type: 'metrics-event',
      subject: { kind: 'submission', repository: 'octo/demo', type: 'issue', number: 29 },
      recorded_at: '2026-09-28T10:00:03.000Z',
      kind: 'maintainer-resolution',
      payload: {
        action_kind: 'resolution',
        dismissal_code: null,
        resolution: 'closed-by-author',
        paired_run: null,
        paired_snapshot_hash: null,
      },
    });
    const closure = await prepareClosureEvidence({ runId: 36081628326, runAttempt: 1, event: closureEvent, credentials: [] });
    expect(closure.ok).toBe(true);

    for (const groups of [
      runGroups.ok ? runGroups.value : [],
      supersession.ok ? supersession.value.groups : [],
      closure.ok ? closure.value.groups : [],
    ]) {
      const result = await writeEvidenceCommit(
        {
          store,
          targetRepository: 'octo/demo',
          subject: { type: 'issue', number: 29 },
          runId: 36081628326,
          runAttempt: 1,
          groups,
          maxBytes: 10485760,
          writeRetries: 1,
        },
        deps,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('github.server-error');
      }
    }
  });
});
