import { z } from 'zod';

import { modeSchema, submissionTypeSchema } from '../vocabulary.js';

import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordRepositorySchema,
  recordContentHashSchema,
  recordIdentifierSchema,
  recordCommitIdSchema,
  policyRevisionIdSchema,
  recordTimestampSchema,
  recordCountSchema,
} from './common.js';

export const runRecordSchema = z.strictObject({
  schema_version: recordSchemaVersionSchema,
  record_type: z.literal('run'),
  run_id: recordPositiveIntSchema,
  run_attempt: recordPositiveIntSchema,
  subject: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('submission'),
      repository: recordRepositorySchema,
      type: submissionTypeSchema,
      number: recordPositiveIntSchema,
      snapshot_hash: recordContentHashSchema,
    }),
    z.strictObject({
      kind: z.literal('merge-group'),
      repository: recordRepositorySchema,
      group_ref: recordIdentifierSchema,
      snapshot_hash: recordContentHashSchema,
    }),
  ]),
  commits: z.strictObject({
    base: recordCommitIdSchema.nullable(),
    head: recordCommitIdSchema.nullable(),
    group: recordCommitIdSchema.nullable(),
  }),
  owned_check_id: recordPositiveIntSchema.nullable(),
  policy_revision: policyRevisionIdSchema,
  steward_version: recordIdentifierSchema,
  provider: z.enum(['copilot-sdk', 'openai-compatible']).nullable(),
  requested_model: recordIdentifierSchema.nullable(),
  reported_model: recordIdentifierSchema.nullable(),
  adapter_version: recordIdentifierSchema.nullable(),
  generation: z
    .strictObject({
      temperature: z.number().min(0).max(2).nullable(),
    })
    .nullable(),
  runner_identity: recordIdentifierSchema.nullable(),
  mode: modeSchema,
  started_at: recordTimestampSchema,
  finished_at: recordTimestampSchema.nullable(),
  budget: z.strictObject({
    model_calls: recordCountSchema.nullable(),
    tokens: recordCountSchema.nullable(),
    ai_credits: z.number().min(0).nullable(),
    container_seconds: z.number().min(0).nullable(),
    executions: recordCountSchema.nullable(),
    github_requests: recordCountSchema.nullable(),
    retries: recordCountSchema.nullable(),
  }),
});

export type RunRecord = z.output<typeof runRecordSchema>;
