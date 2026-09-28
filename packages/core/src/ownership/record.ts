import { z } from 'zod';

import type { Result } from '../result.js';
import { err, ok } from '../result.js';
import { canonicalJson } from '../canonical-json.js';
import { OWNERSHIP_RECORD_MAX_BYTES } from '../policy/bounds.js';
import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordCountSchema,
  recordRepositorySchema,
  recordContentHashSchema,
  recordTimestampSchema,
  recordTreeIdSchema,
} from '../records/common.js';
import type { SubmissionType } from '../vocabulary.js';
import {
  submissionTypeSchema,
  ownershipDispositionSchema,
  capStateSchema,
  wrapperEventNameSchema,
  senderTypeSchema,
} from '../vocabulary.js';

export const OWNERSHIP_ARTIFACT_FILE = 'ownership.json';
export const OWNERSHIP_ARTIFACT_PREFIX = 'steward-ownership-';

const PULL_REQUEST_EVENT_ACTIONS_LIST = ['opened', 'synchronize', 'edited', 'reopened', 'ready_for_review', 'closed'] as const;
const ISSUE_EVENT_ACTIONS_LIST = ['opened', 'edited', 'reopened', 'closed', 'deleted'] as const;

export function ownershipArtifactName(type: SubmissionType, number: number): string {
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new RangeError('number must be a positive safe integer');
  }
  return type === 'pull_request' ? `${OWNERSHIP_ARTIFACT_PREFIX}pr-${number}` : `${OWNERSHIP_ARTIFACT_PREFIX}issue-${number}`;
}

export const ownershipEventSchema = z.strictObject({
  name: wrapperEventNameSchema,
  action: z.enum(['opened', 'synchronize', 'edited', 'reopened', 'ready_for_review', 'closed', 'deleted']),
  object_id: recordPositiveIntSchema,
  object_updated_at: recordTimestampSchema,
  sender_id: recordPositiveIntSchema,
  sender_type: senderTypeSchema,
});

export type OwnershipEventIdentity = z.output<typeof ownershipEventSchema>;

export const ownershipCapSchema = z.strictObject({
  state: capStateSchema,
  daily_count: recordCountSchema,
  daily_limit: recordPositiveIntSchema,
  author_count: recordCountSchema,
  author_limit: recordPositiveIntSchema,
});

export const ownershipRecordSchema = z
  .strictObject({
    schema_version: recordSchemaVersionSchema,
    record_type: z.literal('ownership'),
    repository: recordRepositorySchema,
    subject: z.strictObject({ type: submissionTypeSchema, number: recordPositiveIntSchema }),
    run_id: recordPositiveIntSchema,
    run_attempt: recordPositiveIntSchema,
    check_id: z.null(),
    snapshot_hash: recordContentHashSchema,
    policy_revision: recordTreeIdSchema,
    disposition: ownershipDispositionSchema,
    admission: z.literal('not-required'),
    cap: ownershipCapSchema.nullable(),
    event: ownershipEventSchema,
    author_id: recordPositiveIntSchema,
    created_at: recordTimestampSchema,
  })
  .superRefine((value, ctx) => {
    if (value.disposition === 'early-exit' && value.cap !== null) {
      ctx.addIssue({ code: 'custom', path: ['cap'], message: 'early-exit disposition requires cap to be null' });
    }
    if (value.disposition !== 'early-exit' && value.cap === null) {
      ctx.addIssue({ code: 'custom', path: ['cap'], message: 'cap is required unless disposition is early-exit' });
    }
    if (value.cap !== null) {
      if (value.disposition === 'runnable' && value.cap.state !== 'within') {
        ctx.addIssue({ code: 'custom', path: ['disposition'], message: 'runnable disposition requires cap.state within' });
      }
      if (value.disposition === 'queued' && value.cap.state === 'within') {
        ctx.addIssue({ code: 'custom', path: ['disposition'], message: 'queued disposition requires cap.state other than within' });
      }
      const capOk = value.cap.daily_count <= value.cap.daily_limit;
      const authorOk = value.cap.author_count <= value.cap.author_limit;
      if (value.cap.state === 'within' && !(capOk && authorOk)) {
        ctx.addIssue({ code: 'custom', path: ['cap', 'state'], message: "cap.state 'within' requires both counts within limits" });
      }
      if (value.cap.state === 'daily-runs' && capOk) {
        ctx.addIssue({
          code: 'custom',
          path: ['cap', 'state'],
          message: "cap.state 'daily-runs' requires daily_count over daily_limit",
        });
      }
      if (value.cap.state === 'per-author-concurrent-runs' && !(capOk && !authorOk)) {
        ctx.addIssue({
          code: 'custom',
          path: ['cap', 'state'],
          message: "cap.state 'per-author-concurrent-runs' requires daily_count within limit and author_count over limit",
        });
      }
    }
    if (value.subject.type === 'pull_request' && value.event.name !== 'pull_request_target') {
      ctx.addIssue({
        code: 'custom',
        path: ['event', 'name'],
        message: "event.name must be 'pull_request_target' for pull_request",
      });
    }
    if (value.subject.type === 'issue' && value.event.name !== 'issues') {
      ctx.addIssue({ code: 'custom', path: ['event', 'name'], message: "event.name must be 'issues' for issue" });
    }
    if (
      value.event.name === 'pull_request_target' &&
      !(PULL_REQUEST_EVENT_ACTIONS_LIST as readonly string[]).includes(value.event.action)
    ) {
      ctx.addIssue({ code: 'custom', path: ['event', 'action'], message: 'event.action is not a valid pull request event action' });
    }
    if (value.event.name === 'issues' && !(ISSUE_EVENT_ACTIONS_LIST as readonly string[]).includes(value.event.action)) {
      ctx.addIssue({ code: 'custom', path: ['event', 'action'], message: 'event.action is not a valid issue event action' });
    }
    if (value.event.action === 'closed' || value.event.action === 'deleted') {
      ctx.addIssue({ code: 'custom', path: ['event', 'action'], message: 'closure actions never commit ownership' });
    }
  });

export type OwnershipRecord = z.output<typeof ownershipRecordSchema>;

export type OwnershipRecordFailureCode = 'ownership.record-invalid';

const INVALID_MESSAGE = 'The ownership record is invalid.';
const ENCODE_INVALID_MESSAGE = 'The ownership record could not be encoded.';

function encodeFailure(): Result<never, OwnershipRecordFailureCode> {
  return err('ownership.record-invalid', 'steward-defect', ENCODE_INVALID_MESSAGE);
}

function decodeFailure(token: string): Result<never, OwnershipRecordFailureCode> {
  return err('ownership.record-invalid', 'github-unavailable', INVALID_MESSAGE, [
    { code: 'ownership.record-invalid', path: token, message: INVALID_MESSAGE, line: null, column: null },
  ]);
}

export function encodeOwnershipRecord(record: OwnershipRecord): Result<Uint8Array, OwnershipRecordFailureCode> {
  const parsed = ownershipRecordSchema.safeParse(record);
  if (!parsed.success) {
    return encodeFailure();
  }
  const canonical = canonicalJson(parsed.data);
  if (!canonical.ok) {
    return encodeFailure();
  }
  const bytes = new TextEncoder().encode(canonical.value);
  if (bytes.length > OWNERSHIP_RECORD_MAX_BYTES) {
    return encodeFailure();
  }
  return ok(bytes);
}

export interface OwnershipArtifactExpectation {
  readonly repository: string;
  readonly type: SubmissionType;
  readonly number: number;
  readonly artifactName: string;
  readonly workflowRunId: number | null;
}

export function decodeOwnershipRecord(
  bytes: Uint8Array,
  expected: OwnershipArtifactExpectation,
): Result<OwnershipRecord, OwnershipRecordFailureCode> {
  try {
    if (bytes.length > OWNERSHIP_RECORD_MAX_BYTES) {
      return decodeFailure('size');
    }

    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return decodeFailure('encoding');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      return decodeFailure('json');
    }

    const parsed = ownershipRecordSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return decodeFailure('schema');
    }
    const record = parsed.data;

    const canonical = canonicalJson(record);
    if (!canonical.ok || new TextEncoder().encode(canonical.value).length > OWNERSHIP_RECORD_MAX_BYTES) {
      return decodeFailure('size');
    }

    let expectedArtifactName: string;
    try {
      expectedArtifactName = ownershipArtifactName(expected.type, expected.number);
    } catch {
      return decodeFailure('name');
    }
    if (expected.artifactName !== expectedArtifactName) {
      return decodeFailure('name');
    }

    let recordArtifactName: string;
    try {
      recordArtifactName = ownershipArtifactName(record.subject.type, record.subject.number);
    } catch {
      return decodeFailure('name');
    }
    if (recordArtifactName !== expected.artifactName) {
      return decodeFailure('name');
    }

    if (record.subject.type !== expected.type || record.subject.number !== expected.number) {
      return decodeFailure('subject');
    }

    if (record.repository !== expected.repository) {
      return decodeFailure('repository');
    }

    if (expected.workflowRunId !== null && record.run_id !== expected.workflowRunId) {
      return decodeFailure('run');
    }

    return ok(record);
  } catch {
    return decodeFailure('name');
  }
}
