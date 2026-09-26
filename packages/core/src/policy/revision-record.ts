import { z } from 'zod';

import type { Result } from '../result.js';
import { err, ok } from '../result.js';
import type { RecordFailureCode } from '../records/common.js';
import {
  recordCommitIdSchema,
  recordIdentifierSchema,
  recordSchemaVersionSchema,
  recordTimestampSchema,
} from '../records/common.js';
import { RECORD_TEXT_MAX_LENGTH } from './bounds.js';
import { resolvedPolicySchema } from './schema.js';
import type { LoadedPolicy } from './loader.js';

const localFilePathSchema = z
  .string()
  .min(1)
  .max(RECORD_TEXT_MAX_LENGTH)
  .refine((s) => s.isWellFormed());

export const policyRevisionRecordSchema = z
  .strictObject({
    schema_version: recordSchemaVersionSchema,
    record_type: z.literal('policy-revision'),
    revision: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('git-tree'),
        id: recordCommitIdSchema,
        commit: recordCommitIdSchema,
        ref: recordIdentifierSchema,
      }),
      z.strictObject({
        kind: z.literal('local-file'),
        id: z.string().regex(/^local:[0-9a-f]{64}$/),
        path: localFilePathSchema,
      }),
    ]),
    authoritative: z.boolean(),
    steward_version: recordIdentifierSchema,
    policy: resolvedPolicySchema,
    loaded_at: recordTimestampSchema,
  })
  .superRefine((value, ctx) => {
    if (value.revision.kind === 'local-file' && value.authoritative) {
      ctx.addIssue({
        code: 'custom',
        path: ['authoritative'],
        message: 'A local-file revision can never be authoritative.',
      });
    }
  });

export type PolicyRevisionRecord = z.output<typeof policyRevisionRecordSchema>;

export interface PolicyRevisionRecordInput {
  readonly stewardVersion: string;
  readonly loadedAt: string;
}

export function policyRevisionRecord(
  loaded: LoadedPolicy,
  input: PolicyRevisionRecordInput,
): Result<PolicyRevisionRecord, RecordFailureCode> {
  const candidate = {
    schema_version: 1,
    record_type: 'policy-revision',
    revision: { ...loaded.revision },
    authoritative: loaded.authoritative,
    steward_version: input.stewardVersion,
    policy: loaded.policy,
    loaded_at: input.loadedAt,
  };

  const parsed = policyRevisionRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    return err('record.invalid', 'steward-defect', 'The policy revision record failed its schema.');
  }
  return ok(parsed.data);
}
