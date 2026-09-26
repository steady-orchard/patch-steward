import { z } from 'zod';

import { categorySchema, issueKindSchema, submissionTypeSchema } from '../vocabulary.js';

import {
  recordSchemaVersionSchema,
  recordRepositorySchema,
  recordPositiveIntSchema,
  recordContentHashSchema,
  recordIdentifierSchema,
  recordTextSchema,
  recordList,
} from './common.js';

function coupling(value: z.infer<typeof submissionRecordShape>, ctx: z.RefinementCtx) {
  if (value.type === 'pull_request') {
    if (value.target_branch === null) {
      ctx.addIssue({ code: 'custom', message: 'pull request submissions require target_branch', path: ['target_branch'] });
    }
    if (value.head_commit === null) {
      ctx.addIssue({ code: 'custom', message: 'pull request submissions require head_commit', path: ['head_commit'] });
    }
    if (value.issue_kind !== null) {
      ctx.addIssue({ code: 'custom', message: 'pull request submissions must not carry issue_kind', path: ['issue_kind'] });
    }
    if (value.trusted_paths_changed === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'pull request submissions require trusted_paths_changed',
        path: ['trusted_paths_changed'],
      });
    }
    if (value.execution_sensitive_paths_changed === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'pull request submissions require execution_sensitive_paths_changed',
        path: ['execution_sensitive_paths_changed'],
      });
    }
  } else {
    if (value.issue_kind === null) {
      ctx.addIssue({ code: 'custom', message: 'issue submissions require issue_kind', path: ['issue_kind'] });
    }
    if (value.target_branch !== null) {
      ctx.addIssue({ code: 'custom', message: 'issue submissions must not carry target_branch', path: ['target_branch'] });
    }
    if (value.head_commit !== null) {
      ctx.addIssue({ code: 'custom', message: 'issue submissions must not carry head_commit', path: ['head_commit'] });
    }
    if (value.trusted_paths_changed !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'issue submissions must not carry trusted_paths_changed',
        path: ['trusted_paths_changed'],
      });
    }
    if (value.execution_sensitive_paths_changed !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'issue submissions must not carry execution_sensitive_paths_changed',
        path: ['execution_sensitive_paths_changed'],
      });
    }
    if (value.shared_head_pull_requests.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'issue submissions must not carry shared_head_pull_requests',
        path: ['shared_head_pull_requests'],
      });
    }
  }
}

const submissionRecordShape = z.strictObject({
  schema_version: recordSchemaVersionSchema,
  record_type: z.literal('submission'),
  repository: recordRepositorySchema,
  type: submissionTypeSchema,
  number: recordPositiveIntSchema,
  snapshot_hash: recordContentHashSchema,
  target_branch: recordIdentifierSchema.nullable(),
  head_commit: recordCommitOrNullSchema(),
  issue_kind: issueKindSchema.nullable(),
  category: categorySchema.nullable(),
  fields: z.strictObject({
    'expected-behavior': recordTextSchema.optional(),
    'authoritative-basis': recordTextSchema.optional(),
    'actual-behavior': recordTextSchema.optional(),
    'affected-version': recordTextSchema.optional(),
    'reproduction-command': recordTextSchema.optional(),
    'expected-result': recordTextSchema.optional(),
    'proposed-scope': recordTextSchema.optional(),
    references: recordTextSchema.optional(),
    'security-claim': recordTextSchema.optional(),
    problem: recordTextSchema.optional(),
    benefit: recordTextSchema.optional(),
    'existing-decision': recordTextSchema.optional(),
    category: recordTextSchema.optional(),
    'intended-behavior': recordTextSchema.optional(),
    'acceptance-criteria': recordTextSchema.optional(),
    'linked-issue': recordTextSchema.optional(),
    'regression-test': recordTextSchema.optional(),
    'test-scaffolding': recordTextSchema.optional(),
  }),
  linked_evidence_hashes: recordList(recordContentHashSchema),
  author_responses: recordList(
    z.strictObject({
      request_id: recordIdentifierSchema,
      comment_id: recordPositiveIntSchema,
      content_hash: recordContentHashSchema,
    }),
  ),
  shared_head_pull_requests: recordList(recordPositiveIntSchema),
  contract_results: recordList(
    z.strictObject({ requirement: recordIdentifierSchema, satisfied: z.boolean(), detail: recordTextSchema }),
  ),
  trusted_paths_changed: z.boolean().nullable(),
  execution_sensitive_paths_changed: z.boolean().nullable(),
});

function recordCommitOrNullSchema() {
  return z
    .string()
    .regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/)
    .nullable();
}

export const submissionRecordSchema = submissionRecordShape.superRefine(coupling);

export type SubmissionRecord = z.output<typeof submissionRecordSchema>;
