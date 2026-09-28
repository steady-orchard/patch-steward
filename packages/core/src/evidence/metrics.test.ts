import { describe, expect, it } from 'vitest';

import { metricsEventRecordSchema } from '../records/metrics-event.js';

import {
  buildRunMetricsEvents,
  buildWaitingMetricsEvents,
  buildSupersessionMetricsEvents,
  buildClosureMetricsEvent,
  metricsFileSchema,
} from './metrics.js';

const baseInput = {
  runId: 'local-20260927T101500Z-3f9a1c2e',
  runAttempt: 1,
  gateCompletedAt: '2026-09-27T10:15:00Z',
  phases: [
    { phase: 'gate', seconds: 1, recordedAt: '2026-09-27T10:15:01Z' },
    { phase: 'intake', seconds: 2, recordedAt: '2026-09-27T10:15:02Z' },
    { phase: 'execute', seconds: 3, recordedAt: '2026-09-27T10:15:03Z' },
    { phase: 'assess', seconds: 4, recordedAt: '2026-09-27T10:15:04Z' },
  ],
  finishedAt: '2026-09-27T10:16:00Z',
  outcome: 'needs-changes',
} as const;

describe('run metrics events', () => {
  it('run metrics events follow the approved sequence', () => {
    const result = buildRunMetricsEvents(baseInput);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.map((event) => event.kind)).toEqual([
      'state-transition',
      'latency',
      'latency',
      'latency',
      'latency',
      'cost',
      'state-transition',
    ]);
    expect(result.value[0]?.payload).toEqual({ from: null, to: 'screening' });
    expect(result.value[1]?.payload).toEqual({ stage: 'gate', seconds: 1 });
    expect(result.value[2]?.payload).toEqual({ stage: 'intake', seconds: 2 });
    expect(result.value[3]?.payload).toEqual({ stage: 'execute', seconds: 3 });
    expect(result.value[4]?.payload).toEqual({ stage: 'assess', seconds: 4 });
    expect(result.value[5]?.payload).toEqual({ model_calls: 0, tokens: null, ai_credits: null, container_seconds: 0 });
    expect(result.value[6]?.payload).toEqual({ from: 'screening', to: 'needs-changes' });
  });

  it('every run metrics event validates', () => {
    const result = buildRunMetricsEvents(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const event of result.value) {
        expect(metricsEventRecordSchema.safeParse(event).success).toBe(true);
      }
    }

    const invalid = buildRunMetricsEvents({
      ...baseInput,
      phases: [{ phase: '', seconds: 1, recordedAt: '2026-09-27T10:15:01Z' }],
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.failure.code).toBe('evidence.record-invalid');
    }
  });

  it('metrics files hold an array of metrics events', () => {
    const result = buildRunMetricsEvents(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(metricsFileSchema.safeParse(result.value).success).toBe(true);
    }
    expect(metricsFileSchema.safeParse([{}]).success).toBe(false);
  });
});

describe('waiting metrics events', () => {
  it('waiting metrics record the queued transition, latency, and cost', () => {
    const result = buildWaitingMetricsEvents({
      runId: 100,
      runAttempt: 1,
      queuedAt: '2026-09-27T10:00:00Z',
      phases: [
        { phase: 'gate', seconds: 1, recordedAt: '2026-09-27T10:00:01Z' },
        { phase: 'publish', seconds: 2, recordedAt: '2026-09-27T10:00:02Z' },
      ],
      finishedAt: '2026-09-27T10:00:03Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.map((event) => event.kind)).toEqual(['state-transition', 'latency', 'latency', 'cost']);
    expect(result.value[0]?.payload).toEqual({ from: null, to: 'queued' });
    expect(result.value[1]?.payload).toEqual({ stage: 'gate', seconds: 1 });
    expect(result.value[2]?.payload).toEqual({ stage: 'publish', seconds: 2 });
    expect(result.value[3]?.payload).toEqual({ model_calls: 0, tokens: null, ai_credits: null, container_seconds: 0 });
    expect(metricsFileSchema.safeParse(result.value).success).toBe(true);
  });
});

describe('supersession metrics events', () => {
  it('supersession metrics record one transition to superseded', () => {
    const fromOutcome = buildSupersessionMetricsEvents({
      runId: 100,
      runAttempt: 1,
      from: 'inconclusive',
      recordedAt: '2026-09-27T10:00:00Z',
    });
    expect(fromOutcome.ok).toBe(true);
    if (fromOutcome.ok) {
      expect(fromOutcome.value.map((event) => event.kind)).toEqual(['state-transition']);
      expect(fromOutcome.value[0]?.payload).toEqual({ from: 'inconclusive', to: 'superseded' });
    }

    const fromWaiting = buildSupersessionMetricsEvents({
      runId: 100,
      runAttempt: 1,
      from: 'queued',
      recordedAt: '2026-09-27T10:00:00Z',
    });
    expect(fromWaiting.ok).toBe(true);
    if (fromWaiting.ok) {
      expect(fromWaiting.value[0]?.payload).toEqual({ from: 'queued', to: 'superseded' });
    }
  });
});

describe('closure metrics events', () => {
  it('closure metrics carry the resolution and paired run', () => {
    const result = buildClosureMetricsEvent({
      repository: 'steady-orchard/patch-steward-testbed-public',
      type: 'pull_request',
      number: 5,
      resolution: 'merged',
      pairedRun: { runId: 100, runAttempt: 1 },
      pairedSnapshotHash: `sha256:${'a'.repeat(64)}`,
      recordedAt: '2026-09-27T10:00:00Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.kind).toBe('maintainer-resolution');
    expect(result.value.subject).toEqual({
      kind: 'submission',
      repository: 'steady-orchard/patch-steward-testbed-public',
      type: 'pull_request',
      number: 5,
    });
    expect(result.value.payload).toEqual({
      action_kind: 'resolution',
      dismissal_code: null,
      resolution: 'merged',
      paired_run: { run_id: 100, run_attempt: 1 },
      paired_snapshot_hash: `sha256:${'a'.repeat(64)}`,
    });
  });

  it('closure metrics without a paired owner carry null', () => {
    const result = buildClosureMetricsEvent({
      repository: 'steady-orchard/patch-steward-testbed-public',
      type: 'issue',
      number: 9,
      resolution: 'deleted',
      pairedRun: null,
      pairedSnapshotHash: null,
      recordedAt: '2026-09-27T10:00:00Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.payload).toEqual({
      action_kind: 'resolution',
      dismissal_code: null,
      resolution: 'deleted',
      paired_run: null,
      paired_snapshot_hash: null,
    });
  });
});

describe('hosted metrics builders reject invalid input', () => {
  it('hosted metrics builders reject invalid input', () => {
    const waiting = buildWaitingMetricsEvents({
      runId: 100,
      runAttempt: 1,
      queuedAt: 'not-a-time',
      phases: [],
      finishedAt: '2026-09-27T10:00:03Z',
    });
    expect(waiting.ok).toBe(false);
    if (!waiting.ok) {
      expect(waiting.failure.code).toBe('evidence.record-invalid');
    }

    const supersession = buildSupersessionMetricsEvents({
      runId: 100,
      runAttempt: 1,
      from: 'inconclusive',
      recordedAt: 'not-a-time',
    });
    expect(supersession.ok).toBe(false);
    if (!supersession.ok) {
      expect(supersession.failure.code).toBe('evidence.record-invalid');
    }

    const closure = buildClosureMetricsEvent({
      repository: 'bad',
      type: 'issue',
      number: 1,
      resolution: 'merged',
      pairedRun: null,
      pairedSnapshotHash: null,
      recordedAt: '2026-09-27T10:00:00Z',
    });
    expect(closure.ok).toBe(false);
    if (!closure.ok) {
      expect(closure.failure.code).toBe('evidence.record-invalid');
    }
  });
});
