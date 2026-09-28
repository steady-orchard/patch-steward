import { z } from 'zod';

import { waitingReasonSchema, submissionTypeSchema } from '../vocabulary.js';

import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordRepositorySchema,
  recordCountSchema,
  recordContentHashSchema,
  recordTreeIdSchema,
  recordTimestampSchema,
} from './common.js';

export const waitingRecordSchema = z
  .strictObject({
    schema_version: recordSchemaVersionSchema,
    record_type: z.literal('waiting'),
    run_id: recordPositiveIntSchema,
    run_attempt: recordPositiveIntSchema,
    subject: z.strictObject({
      repository: recordRepositorySchema,
      type: submissionTypeSchema,
      number: recordPositiveIntSchema,
    }),
    state: z.literal('queued'),
    reason: waitingReasonSchema,
    counts: z.strictObject({
      daily_count: recordCountSchema,
      daily_limit: recordPositiveIntSchema,
      author_count: recordCountSchema,
      author_limit: recordPositiveIntSchema,
    }),
    snapshot_hash: recordContentHashSchema,
    policy_revision: recordTreeIdSchema,
    arrival_at: recordTimestampSchema,
    recorded_at: recordTimestampSchema,
  })
  .superRefine((value, ctx) => {
    // the daily cap is reported first: a run over both caps is a daily-runs wait
    if (value.reason === 'daily-runs' && !(value.counts.daily_count > value.counts.daily_limit)) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'daily-runs requires daily_count > daily_limit' });
    }
    if (
      value.reason === 'per-author-concurrent-runs' &&
      !(value.counts.daily_count <= value.counts.daily_limit && value.counts.author_count > value.counts.author_limit)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'per-author-concurrent-runs requires daily_count <= daily_limit and author_count > author_limit',
      });
    }
  });

export type WaitingRecord = z.output<typeof waitingRecordSchema>;
