import { describe, expect, it } from 'vitest';

import { metricsEventRecordSchema } from '../records/metrics-event.js';

import { buildRunMetricsEvents, metricsFileSchema } from './metrics.js';

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
