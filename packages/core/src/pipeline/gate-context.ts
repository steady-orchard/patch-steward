import { z } from 'zod';

import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordRepositorySchema,
  recordContentHashSchema,
  recordTreeIdSchema,
  recordCommitIdSchema,
  recordIdentifierSchema,
  recordTimestampSchema,
  recordCountSchema,
  recordTextSchema,
} from '../records/common.js';
import { submissionRecordSchema } from '../records/submission.js';
import { metricsEventRecordSchema } from '../records/metrics-event.js';
import { ownershipCapSchema } from '../ownership/record.js';
import {
  submissionTypeSchema,
  ownershipDispositionSchema,
  modeSchema,
  pipelineStageSchema,
  issueKindSchema,
  categorySchema,
  CATEGORIES,
  PIPELINE_STAGES,
} from '../vocabulary.js';
import { canonicalJson } from '../canonical-json.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import type { ClassificationInput } from '../report/templates.js';
import { HANDOFF_MAX_BYTES } from '../policy/bounds.js';

export const HANDOFF_ARTIFACT = 'steward-handoff';
export const CLOSURE_ARTIFACT = 'steward-closure';
export const HANDOFF_FILE = 'handoff.json';
export const GATE_CONTEXT_FILE = 'gate-context.json';
export const CLOSURE_CONTEXT_FILE = 'closure.json';
export const GATE_CONTEXT_LOG_LINES_MAX = 200;

export const evidenceStoreRefSchema = z.strictObject({
  type: z.enum(['orphan-branch', 'repository']),
  repository: recordRepositorySchema,
  branch: z.string().min(1).max(255),
});

export type EvidenceStoreRef = z.output<typeof evidenceStoreRefSchema>;

export const classificationRecordSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('issue'), issue_kind: issueKindSchema.nullable() }),
  z.strictObject({
    type: z.literal('pull_request'),
    category: categorySchema.nullable(),
    consistent: z.boolean(),
    plausible: z.array(categorySchema).max(CATEGORIES.length),
  }),
]);

export type ClassificationRecord = z.output<typeof classificationRecordSchema>;

const run = z.strictObject({ run_id: recordPositiveIntSchema, run_attempt: recordPositiveIntSchema });

const repository = z.strictObject({
  full_name: recordRepositorySchema,
  id: recordPositiveIntSchema,
  default_branch: z.string().min(1).max(255),
});

const subject = z.strictObject({ type: submissionTypeSchema, number: recordPositiveIntSchema });

const policy = z.strictObject({
  revision: recordTreeIdSchema,
  commit: recordCommitIdSchema,
  ref: recordIdentifierSchema,
  loaded_at: recordTimestampSchema,
});

export const gateContextRecordSchema = z
  .strictObject({
    schema_version: recordSchemaVersionSchema,
    record_type: z.literal('gate-context'),
    run,
    repository,
    subject,
    disposition: ownershipDispositionSchema,
    snapshot_hash: recordContentHashSchema,
    policy,
    store: evidenceStoreRefSchema,
    submission: submissionRecordSchema,
    base_commit: recordCommitIdSchema.nullable(),
    mode: modeSchema,
    classification: classificationRecordSchema,
    required_stages: z.array(pipelineStageSchema).max(PIPELINE_STAGES.length),
    cap: ownershipCapSchema.nullable(),
    github_requests: recordCountSchema,
    started_at: recordTimestampSchema,
    completed_at: recordTimestampSchema,
    log_lines: z.array(recordTextSchema).max(GATE_CONTEXT_LOG_LINES_MAX),
  })
  .superRefine((value, ctx) => {
    if (value.snapshot_hash !== value.submission.snapshot_hash) {
      ctx.addIssue({ code: 'custom', path: ['snapshot_hash'], message: 'snapshot_hash must match the submission record' });
    }
    if (value.submission.repository !== value.repository.full_name) {
      ctx.addIssue({
        code: 'custom',
        path: ['submission', 'repository'],
        message: 'submission repository must match repository.full_name',
      });
    }
    if (value.submission.type !== value.subject.type || value.submission.number !== value.subject.number) {
      ctx.addIssue({ code: 'custom', path: ['submission'], message: 'submission subject must match subject' });
    }
    if ((value.disposition === 'early-exit') !== (value.cap === null)) {
      ctx.addIssue({ code: 'custom', path: ['cap'], message: 'cap is required unless disposition is early-exit' });
    }
    if (value.cap !== null) {
      if (value.disposition === 'runnable' && value.cap.state !== 'within') {
        ctx.addIssue({ code: 'custom', path: ['disposition'], message: 'runnable disposition requires cap.state within' });
      }
      if (value.disposition === 'queued' && value.cap.state === 'within') {
        ctx.addIssue({ code: 'custom', path: ['disposition'], message: 'queued disposition requires cap.state other than within' });
      }
    }
    if (value.store.type === 'orphan-branch' && value.store.repository !== value.repository.full_name) {
      ctx.addIssue({
        code: 'custom',
        path: ['store', 'repository'],
        message: 'an orphan-branch store must be the target repository',
      });
    }
    if (value.subject.type === 'issue' && value.base_commit !== null) {
      ctx.addIssue({ code: 'custom', path: ['base_commit'], message: 'issue subjects must not carry base_commit' });
    }
  });

export type GateContextRecord = z.output<typeof gateContextRecordSchema>;

export const closureContextRecordSchema = z
  .strictObject({
    schema_version: recordSchemaVersionSchema,
    record_type: z.literal('closure'),
    run,
    repository,
    subject,
    policy,
    store: evidenceStoreRefSchema,
    github_requests_remaining: recordCountSchema,
    event: metricsEventRecordSchema,
  })
  .superRefine((value, ctx) => {
    if (value.event.kind !== 'maintainer-resolution') {
      ctx.addIssue({ code: 'custom', path: ['event', 'kind'], message: 'closure events must be maintainer-resolution' });
    }
    if (value.event.subject.kind !== 'submission') {
      ctx.addIssue({ code: 'custom', path: ['event', 'subject', 'kind'], message: 'closure events must be for a submission' });
    } else {
      if (
        value.event.subject.repository !== value.repository.full_name ||
        value.event.subject.type !== value.subject.type ||
        value.event.subject.number !== value.subject.number
      ) {
        ctx.addIssue({ code: 'custom', path: ['event', 'subject'], message: 'closure event subject must match subject' });
      }
    }
    if (value.store.type === 'orphan-branch' && value.store.repository !== value.repository.full_name) {
      ctx.addIssue({
        code: 'custom',
        path: ['store', 'repository'],
        message: 'an orphan-branch store must be the target repository',
      });
    }
  });

export type ClosureContextRecord = z.output<typeof closureContextRecordSchema>;

export interface HostedRunExpectation {
  readonly runId: number;
  readonly maxAttempt: number;
  readonly repository: string;
  readonly repositoryId: number;
}

export type GateContextFailureCode = 'pipeline.handoff-invalid' | 'pipeline.handoff-binding';

const INVALID_MESSAGE = 'The same-run record failed validation.';
const BINDING_MESSAGE = 'The same-run record is not bound to this run.';

function invalidFailure(token?: string): Result<never, 'pipeline.handoff-invalid'> {
  if (token === undefined) {
    return err('pipeline.handoff-invalid', 'steward-defect', INVALID_MESSAGE);
  }
  return err('pipeline.handoff-invalid', 'steward-defect', INVALID_MESSAGE, [
    { code: 'pipeline.handoff-invalid', path: token, message: INVALID_MESSAGE, line: null, column: null },
  ]);
}

function bindingFailure(token: string): Result<never, GateContextFailureCode> {
  return err('pipeline.handoff-binding', 'steward-defect', BINDING_MESSAGE, [
    { code: 'pipeline.handoff-binding', path: token, message: BINDING_MESSAGE, line: null, column: null },
  ]);
}

function encodeRecord<T>(schema: z.ZodType<T>, record: T): Result<Uint8Array, 'pipeline.handoff-invalid'> {
  const parsed = schema.safeParse(record);
  if (!parsed.success) {
    return invalidFailure();
  }
  const canonical = canonicalJson(parsed.data);
  if (!canonical.ok) {
    return invalidFailure();
  }
  const bytes = new TextEncoder().encode(canonical.value);
  if (bytes.length > HANDOFF_MAX_BYTES) {
    return invalidFailure();
  }
  return ok(bytes);
}

function decodeRecord<T>(
  schema: z.ZodType<T>,
  bytes: Uint8Array,
  expected: HostedRunExpectation,
  binding: (value: T) => { readonly run_id: number; readonly run_attempt: number; readonly full_name: string; readonly id: number },
): Result<T, GateContextFailureCode> {
  try {
    if (bytes.length > HANDOFF_MAX_BYTES) {
      return invalidFailure('size');
    }

    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return invalidFailure('encoding');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      return invalidFailure('json');
    }

    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      return invalidFailure('schema');
    }

    const bound = binding(parsed.data);
    if (bound.run_id !== expected.runId) {
      return bindingFailure('run');
    }
    if (bound.run_attempt > expected.maxAttempt) {
      return bindingFailure('attempt');
    }
    if (bound.full_name !== expected.repository || bound.id !== expected.repositoryId) {
      return bindingFailure('repository');
    }

    return ok(parsed.data);
  } catch {
    return invalidFailure('json');
  }
}

export function encodeGateContext(record: GateContextRecord): Result<Uint8Array, 'pipeline.handoff-invalid'> {
  return encodeRecord(gateContextRecordSchema, record);
}

export function encodeClosureContext(record: ClosureContextRecord): Result<Uint8Array, 'pipeline.handoff-invalid'> {
  return encodeRecord(closureContextRecordSchema, record);
}

export function decodeGateContext(
  bytes: Uint8Array,
  expected: HostedRunExpectation,
): Result<GateContextRecord, GateContextFailureCode> {
  return decodeRecord(gateContextRecordSchema, bytes, expected, (value) => ({
    run_id: value.run.run_id,
    run_attempt: value.run.run_attempt,
    full_name: value.repository.full_name,
    id: value.repository.id,
  }));
}

export function decodeClosureContext(
  bytes: Uint8Array,
  expected: HostedRunExpectation,
): Result<ClosureContextRecord, GateContextFailureCode> {
  return decodeRecord(closureContextRecordSchema, bytes, expected, (value) => ({
    run_id: value.run.run_id,
    run_attempt: value.run.run_attempt,
    full_name: value.repository.full_name,
    id: value.repository.id,
  }));
}

export function decodeHandoffBytes(bytes: Uint8Array): Result<unknown, 'pipeline.handoff-invalid'> {
  try {
    if (bytes.length > HANDOFF_MAX_BYTES) {
      return invalidFailure('size');
    }

    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return invalidFailure('encoding');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      return invalidFailure('json');
    }

    return ok(parsedJson);
  } catch {
    return invalidFailure('json');
  }
}

export function classificationRecord(input: ClassificationInput): ClassificationRecord {
  if (input.type === 'issue') {
    return { type: 'issue', issue_kind: input.issueKind };
  }
  return { type: 'pull_request', category: input.category, consistent: input.consistent, plausible: [...input.plausible] };
}

export function gateContextClassification(record: GateContextRecord): ClassificationInput {
  const { classification } = record;
  if (classification.type === 'issue') {
    return { type: 'issue', issueKind: classification.issue_kind };
  }
  return {
    type: 'pull_request',
    category: classification.category,
    consistent: classification.consistent,
    plausible: classification.plausible,
  };
}
