import { z } from 'zod';

import { supersessionReasonSchema, submissionTypeSchema } from '../vocabulary.js';

import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordRepositorySchema,
  recordContentHashSchema,
  recordTimestampSchema,
} from './common.js';

export const supersessionRecordSchema = z
  .strictObject({
    schema_version: recordSchemaVersionSchema,
    record_type: z.literal('supersession'),
    run_id: recordPositiveIntSchema,
    run_attempt: recordPositiveIntSchema,
    subject: z.strictObject({
      repository: recordRepositorySchema,
      type: submissionTypeSchema,
      number: recordPositiveIntSchema,
    }),
    reason: supersessionReasonSchema,
    successor: z
      .strictObject({
        run_id: recordPositiveIntSchema,
        run_attempt: recordPositiveIntSchema,
        artifact_created_at: recordTimestampSchema,
      })
      .nullable(),
    recorded_snapshot_hash: recordContentHashSchema,
    live_snapshot_hash: recordContentHashSchema.nullable(),
    recorded_at: recordTimestampSchema,
  })
  .superRefine((value, ctx) => {
    if (value.reason === 'snapshot-changed' && value.live_snapshot_hash === null) {
      ctx.addIssue({ code: 'custom', path: ['live_snapshot_hash'], message: 'snapshot-changed requires a live snapshot hash' });
    }
    if (value.successor !== null && value.successor.run_id === value.run_id && value.successor.run_attempt === value.run_attempt) {
      ctx.addIssue({ code: 'custom', path: ['successor'], message: 'successor must not be this run' });
    }
  });

export type SupersessionRecord = z.output<typeof supersessionRecordSchema>;
