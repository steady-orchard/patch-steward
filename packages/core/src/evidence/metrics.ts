import { z } from 'zod';

import { RECORD_LIST_MAX_ITEMS } from '../policy/bounds.js';
import { metricsEventRecordSchema } from '../records/metrics-event.js';
import type { MetricsEventRecord } from '../records/metrics-event.js';
import type { Outcome } from '../vocabulary.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export interface RunPhaseLatency {
  readonly phase: string;
  readonly seconds: number;
  readonly recordedAt: string;
}

export interface RunMetricsInput {
  readonly runId: string | number;
  readonly runAttempt: number;
  readonly gateCompletedAt: string;
  readonly phases: readonly RunPhaseLatency[];
  readonly finishedAt: string;
  readonly outcome: Outcome;
}

export type RunMetricsFailureCode = 'evidence.record-invalid';

export function buildRunMetricsEvents(input: RunMetricsInput): Result<readonly MetricsEventRecord[], RunMetricsFailureCode> {
  const subject = { kind: 'run' as const, run_id: input.runId, run_attempt: input.runAttempt };

  const candidates: unknown[] = [
    {
      schema_version: 1,
      record_type: 'metrics-event',
      subject,
      recorded_at: input.gateCompletedAt,
      kind: 'state-transition',
      payload: { from: null, to: 'screening' },
    },
    ...input.phases.map((phase) => ({
      schema_version: 1,
      record_type: 'metrics-event',
      subject,
      recorded_at: phase.recordedAt,
      kind: 'latency',
      payload: { stage: phase.phase, seconds: phase.seconds },
    })),
    {
      schema_version: 1,
      record_type: 'metrics-event',
      subject,
      recorded_at: input.finishedAt,
      kind: 'cost',
      payload: { model_calls: 0, tokens: null, ai_credits: null, container_seconds: 0 },
    },
    {
      schema_version: 1,
      record_type: 'metrics-event',
      subject,
      recorded_at: input.finishedAt,
      kind: 'state-transition',
      payload: { from: 'screening', to: input.outcome },
    },
  ];

  const events: MetricsEventRecord[] = [];
  for (const candidate of candidates) {
    const parsed = metricsEventRecordSchema.safeParse(candidate);
    if (!parsed.success) {
      return err('evidence.record-invalid', 'steward-defect', 'A metrics event failed its schema.');
    }
    events.push(parsed.data);
  }
  return ok(events);
}

export const metricsFileSchema = z.array(metricsEventRecordSchema).max(RECORD_LIST_MAX_ITEMS);
