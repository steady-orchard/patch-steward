import { z } from 'zod';

import { RECORD_LIST_MAX_ITEMS, RECORD_TEXT_MAX_LENGTH } from '../policy/bounds.js';
import { admissibilitySchema } from '../vocabulary.js';

import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordRunIdSchema,
  recordIdentifierSchema,
  recordTextSchema,
  recordCommitIdSchema,
  recordContentHashSchema,
  recordCountSchema,
  recordList,
} from './common.js';

export const executionRecordSchema = z.strictObject({
  schema_version: recordSchemaVersionSchema,
  record_type: z.literal('execution-record'),
  run_id: recordRunIdSchema,
  run_attempt: recordPositiveIntSchema,
  plan_entry: recordIdentifierSchema,
  command: z.array(recordTextSchema).min(1).max(RECORD_LIST_MAX_ITEMS),
  environment: z.strictObject({
    image_digest: z
      .string()
      .regex(/^sha256:[0-9a-f]{64}$/)
      .nullable(),
    tool_versions: recordList(
      z.strictObject({
        name: recordIdentifierSchema,
        version: recordIdentifierSchema,
      }),
    ),
  }),
  exit: z.strictObject({
    code: z.int().nullable(),
    signal: recordIdentifierSchema.nullable(),
    timed_out: z.boolean(),
  }),
  output: z.strictObject({
    head: recordTextSchema,
    tail: recordTextSchema,
    truncated: z.boolean(),
    total_bytes: recordCountSchema,
  }),
  result_files: recordList(
    z.strictObject({
      path: z
        .string()
        .min(1)
        .max(RECORD_TEXT_MAX_LENGTH)
        .refine((s) => s.isWellFormed(), 'text must be well-formed Unicode'),
      content_hash: recordContentHashSchema,
      bytes: recordCountSchema,
    }),
  ),
  test_identity: recordIdentifierSchema.nullable(),
  commits: z.strictObject({
    head: recordCommitIdSchema,
    base: recordCommitIdSchema.nullable(),
    merge: recordCommitIdSchema.nullable(),
  }),
  admissibility: admissibilitySchema,
});

export type ExecutionRecord = z.output<typeof executionRecordSchema>;
