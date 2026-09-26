import { describe, expect, it } from 'vitest';

import { canonicalJsonHash } from '../hash.js';

import { metricsEventRecordSchema, METRICS_EVENT_KINDS } from './metrics-event.js';

const runSubject = { kind: 'run', run_id: 100, run_attempt: 1 } as const;

const validEvent = {
  schema_version: 1,
  record_type: 'metrics-event',
  subject: runSubject,
  recorded_at: '2026-09-26T12:00:00Z',
  kind: 'state-transition',
  payload: { from: 'queued', to: 'screening' },
} as const;

describe('record metrics-event', () => {
  it('record metrics-event accepts a fixture instance', () => {
    const parsed = metricsEventRecordSchema.parse(validEvent);
    expect(parsed.kind).toBe('state-transition');
    expect(canonicalJsonHash(parsed).ok).toBe(true);
  });

  it('record metrics-event rejects an unknown key', () => {
    const withExtra = { ...validEvent, extra: 'nope' };
    expect(metricsEventRecordSchema.safeParse(withExtra).success).toBe(false);
  });

  it('record metrics-event rejects a wrong schema_version', () => {
    const wrongVersion = { ...validEvent, schema_version: 2 };
    expect(metricsEventRecordSchema.safeParse(wrongVersion).success).toBe(false);
  });

  it('record metrics-event accepts every event kind', () => {
    const instances: Record<(typeof METRICS_EVENT_KINDS)[number], unknown> = {
      'state-transition': validEvent,
      cost: {
        ...validEvent,
        kind: 'cost',
        payload: { model_calls: 1, tokens: 100, ai_credits: 0.5, container_seconds: 10 },
      },
      latency: {
        ...validEvent,
        kind: 'latency',
        payload: { stage: 'execute', seconds: 12.5 },
      },
      'maintainer-resolution': {
        ...validEvent,
        kind: 'maintainer-resolution',
        payload: { action_kind: 'resolution', dismissal_code: 'duplicate' },
      },
      appeal: {
        ...validEvent,
        kind: 'appeal',
        payload: { request_id: 'req-1', state: 'opened' },
      },
      'audit-result': {
        ...validEvent,
        kind: 'audit-result',
        payload: { audited_run_id: 101, agreed: true },
      },
    };

    for (const kind of METRICS_EVENT_KINDS) {
      expect(metricsEventRecordSchema.safeParse(instances[kind]).success).toBe(true);
    }
  });

  it('record metrics-event rejects a payload of another kind', () => {
    const mismatched = {
      ...validEvent,
      kind: 'latency',
      payload: { model_calls: 1, tokens: 100, ai_credits: 0.5, container_seconds: 10 },
    };
    expect(metricsEventRecordSchema.safeParse(mismatched).success).toBe(false);
  });

  it('record metrics-event rejects an unknown event kind', () => {
    const unknownKind = { ...validEvent, kind: 'not-a-kind' };
    expect(metricsEventRecordSchema.safeParse(unknownKind).success).toBe(false);
  });
});
