import { z } from 'zod';

import { RECORD_LIST_MAX_ITEMS } from '../policy/bounds.js';
import { metricsEventRecordSchema } from '../records/metrics-event.js';
import type { MetricsEventRecord } from '../records/metrics-event.js';
import type { Outcome, WaitingState, SubmissionType, ResolutionKind } from '../vocabulary.js';
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

export interface WaitingMetricsInput {
  readonly runId: number;
  readonly runAttempt: number;
  readonly queuedAt: string;
  readonly phases: readonly RunPhaseLatency[];
  readonly finishedAt: string;
}

export function buildWaitingMetricsEvents(
  input: WaitingMetricsInput,
): Result<readonly MetricsEventRecord[], RunMetricsFailureCode> {
  const subject = { kind: 'run' as const, run_id: input.runId, run_attempt: input.runAttempt };

  const candidates: unknown[] = [
    {
      schema_version: 1,
      record_type: 'metrics-event',
      subject,
      recorded_at: input.queuedAt,
      kind: 'state-transition',
      payload: { from: null, to: 'queued' },
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

export interface SupersessionMetricsInput {
  readonly runId: number;
  readonly runAttempt: number;
  readonly from: Outcome | WaitingState;
  readonly recordedAt: string;
}

export function buildSupersessionMetricsEvents(
  input: SupersessionMetricsInput,
): Result<readonly MetricsEventRecord[], RunMetricsFailureCode> {
  const candidate = {
    schema_version: 1,
    record_type: 'metrics-event',
    subject: { kind: 'run' as const, run_id: input.runId, run_attempt: input.runAttempt },
    recorded_at: input.recordedAt,
    kind: 'state-transition',
    payload: { from: input.from, to: 'superseded' },
  };

  const parsed = metricsEventRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    return err('evidence.record-invalid', 'steward-defect', 'A metrics event failed its schema.');
  }
  return ok([parsed.data]);
}

export interface ClosureMetricsInput {
  readonly repository: string;
  readonly type: SubmissionType;
  readonly number: number;
  readonly resolution: ResolutionKind;
  readonly pairedRun: { readonly runId: number; readonly runAttempt: number } | null;
  readonly pairedSnapshotHash: string | null;
  readonly recordedAt: string;
}

export function buildClosureMetricsEvent(input: ClosureMetricsInput): Result<MetricsEventRecord, RunMetricsFailureCode> {
  const candidate = {
    schema_version: 1,
    record_type: 'metrics-event',
    subject: { kind: 'submission' as const, repository: input.repository, type: input.type, number: input.number },
    recorded_at: input.recordedAt,
    kind: 'maintainer-resolution',
    payload: {
      action_kind: 'resolution' as const,
      dismissal_code: null,
      resolution: input.resolution,
      paired_run: input.pairedRun === null ? null : { run_id: input.pairedRun.runId, run_attempt: input.pairedRun.runAttempt },
      paired_snapshot_hash: input.pairedSnapshotHash,
    },
  };

  const parsed = metricsEventRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    return err('evidence.record-invalid', 'steward-defect', 'A metrics event failed its schema.');
  }
  return ok(parsed.data);
}
