import { z } from 'zod';

import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordTextSchema,
  recordContentHashSchema,
  recordCommitIdSchema,
  policyRevisionIdSchema,
} from './common.js';

export const reportRecordSchema = z.strictObject({
  schema_version: recordSchemaVersionSchema,
  record_type: z.literal('report'),
  run_id: recordPositiveIntSchema,
  run_attempt: recordPositiveIntSchema,
  rendered: recordTextSchema,
  check_summary: recordTextSchema,
  bound: z.strictObject({
    policy_revision: policyRevisionIdSchema,
    snapshot_hash: recordContentHashSchema,
    head_commit: recordCommitIdSchema.nullable(),
    base_commit: recordCommitIdSchema.nullable(),
  }),
});

export type ReportRecord = z.output<typeof reportRecordSchema>;
