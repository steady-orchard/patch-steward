import { z } from 'zod';

import {
  recordSchemaVersionSchema,
  recordTextSchema,
  recordPositiveIntSchema,
  recordRunIdSchema,
  recordLoginSchema,
  recordTimestampSchema,
  recordCommitIdSchema,
  recordIdentifierSchema,
  recordContentHashSchema,
  recordRepositorySchema,
  recordList,
} from './common.js';
import { maintainerActionKindSchema } from '../vocabulary.js';
import { DISMISSAL_CODE_PATTERN } from '../policy/catalog.js';
import { POLICY_ID_MAX_LENGTH } from '../policy/bounds.js';

export const MAINTAINER_ACTION_SCOPE_TYPES = [
  'pull-request-head',
  'issue-snapshot',
  'issue-proposal',
  'pull-request-claim',
  'pull-request-snapshot',
] as const;

const scopeSchema = z.discriminatedUnion('scope_type', [
  z.strictObject({
    scope_type: z.literal('pull-request-head'),
    repository: recordRepositorySchema,
    number: recordPositiveIntSchema,
    head_commit: recordCommitIdSchema,
    target_branch: recordIdentifierSchema,
    requirements: recordList(recordIdentifierSchema),
  }),
  z.strictObject({
    scope_type: z.literal('issue-snapshot'),
    repository: recordRepositorySchema,
    number: recordPositiveIntSchema,
    snapshot_hash: recordContentHashSchema,
  }),
  z.strictObject({
    scope_type: z.literal('issue-proposal'),
    repository: recordRepositorySchema,
    number: recordPositiveIntSchema,
    proposal_content_hash: recordContentHashSchema,
  }),
  z.strictObject({
    scope_type: z.literal('pull-request-claim'),
    repository: recordRepositorySchema,
    number: recordPositiveIntSchema,
    target_branch: recordIdentifierSchema,
    claim_scope_hash: recordContentHashSchema,
  }),
  z.strictObject({
    scope_type: z.literal('pull-request-snapshot'),
    repository: recordRepositorySchema,
    number: recordPositiveIntSchema,
    snapshot_hash: recordContentHashSchema,
  }),
]);

const SCOPE_TYPES_BY_KIND: Record<string, readonly string[]> = {
  override: ['pull-request-head', 'issue-snapshot'],
  waiver: ['pull-request-head', 'issue-snapshot'],
  acceptance: ['issue-proposal', 'pull-request-claim'],
  resolution: ['issue-snapshot', 'pull-request-snapshot'],
  'inference-admission': ['issue-snapshot', 'pull-request-snapshot'],
  guidance: ['issue-snapshot', 'pull-request-snapshot'],
};

export const maintainerActionRecordSchema = z
  .strictObject({
    schema_version: recordSchemaVersionSchema,
    record_type: z.literal('maintainer-action'),
    run_id: recordRunIdSchema,
    run_attempt: recordPositiveIntSchema,
    actor: recordLoginSchema,
    kind: maintainerActionKindSchema,
    reason: recordTextSchema,
    recorded_at: recordTimestampSchema,
    resolution_code: z.string().max(POLICY_ID_MAX_LENGTH).regex(DISMISSAL_CODE_PATTERN).nullable(),
    scope: scopeSchema,
  })
  .superRefine((value, ctx) => {
    const allowed = SCOPE_TYPES_BY_KIND[value.kind];
    if (allowed && !allowed.includes(value.scope.scope_type)) {
      ctx.addIssue({
        code: 'custom',
        path: ['scope', 'scope_type'],
        message: `scope_type '${value.scope.scope_type}' is not allowed for kind '${value.kind}'`,
      });
    }
    if (value.kind === 'resolution' && value.resolution_code === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['resolution_code'],
        message: 'resolution_code is required for kind resolution',
      });
    }
    if (value.kind !== 'resolution' && value.resolution_code !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['resolution_code'],
        message: 'resolution_code must be null unless kind is resolution',
      });
    }
  });

export type MaintainerActionRecord = z.output<typeof maintainerActionRecordSchema>;
