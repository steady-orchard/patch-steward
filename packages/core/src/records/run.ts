import { z } from 'zod';

import { RECORD_IDENTIFIER_MAX_LENGTH } from '../policy/bounds.js';
import { modeSchema, submissionTypeSchema } from '../vocabulary.js';

import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordRunIdSchema,
  recordRepositorySchema,
  recordContentHashSchema,
  recordIdentifierSchema,
  recordCommitIdSchema,
  policyRevisionIdSchema,
  recordTimestampSchema,
  recordCountSchema,
} from './common.js';

export const runnerIdentitySchema = z
  .string()
  .min(1)
  .max(RECORD_IDENTIFIER_MAX_LENGTH)
  .regex(/^[!-~]+(?: [!-~]+)*$/);

export interface RunnerIdentityInput {
  readonly runtime: 'docker' | 'podman';
  readonly serverVersion: string;
  readonly reference: string;
  readonly imageDigest: string;
}

export function formatRunnerIdentity(input: RunnerIdentityInput): string {
  const d = input.imageDigest.slice('sha256:'.length, 'sha256:'.length + 12);
  const prefix = `${input.runtime} ${input.serverVersion} `;
  const suffix = `@${d}`;
  const full = `${prefix}${input.reference}${suffix}`;
  if (full.length <= RECORD_IDENTIFIER_MAX_LENGTH) {
    return full;
  }
  const ellipsis = '...';
  const l = RECORD_IDENTIFIER_MAX_LENGTH - prefix.length - suffix.length - ellipsis.length;
  return `${prefix}${input.reference.slice(0, l)}${ellipsis}${suffix}`;
}

export const runRecordSchema = z.strictObject({
  schema_version: recordSchemaVersionSchema,
  record_type: z.literal('run'),
  run_id: recordRunIdSchema,
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
  runner_identity: runnerIdentitySchema.nullable(),
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
