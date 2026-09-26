import { z } from 'zod';

import { categorySchema, issueKindSchema, submissionTypeSchema } from '../vocabulary.js';
import { submissionTemplateFormSchema } from '../submission/field-mapping.js';
import { attachmentUrlSchema, snapshotSchema, snapshotHash } from '../submission/snapshot.js';
import {
  ARCHIVE_ENTRIES_MAX,
  ARCHIVE_ENTRY_NAME_MAX_BYTES,
  VALIDATION_ERRORS_MAX,
  POLICY_ID_MAX_LENGTH,
} from '../policy/bounds.js';

import {
  recordSchemaVersionSchema,
  recordRepositorySchema,
  recordPositiveIntSchema,
  recordCountSchema,
  recordContentHashSchema,
  recordCommitIdSchema,
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
    if (value.policy_change !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'issue submissions must not carry policy_change', path: ['policy_change'] });
    }
    if (value.claim_scope_hash !== undefined && value.claim_scope_hash !== null) {
      ctx.addIssue({ code: 'custom', message: 'issue submissions must not carry claim_scope_hash', path: ['claim_scope_hash'] });
    }
  }

  if (value.snapshot !== undefined) {
    if (
      value.snapshot.type !== value.type ||
      value.snapshot.repository !== value.repository ||
      value.snapshot.number !== value.number
    ) {
      ctx.addIssue({ code: 'custom', message: 'snapshot must describe the same submission', path: ['snapshot'] });
    } else if (value.snapshot.type === 'pull_request' && value.type === 'pull_request') {
      if (value.snapshot.target_branch !== value.target_branch) {
        ctx.addIssue({ code: 'custom', message: 'snapshot target_branch must match the record', path: ['snapshot'] });
      }
      if (value.snapshot.head_commit !== value.head_commit) {
        ctx.addIssue({ code: 'custom', message: 'snapshot head_commit must match the record', path: ['snapshot'] });
      }
    }
    const hashResult = snapshotHash(value.snapshot);
    if (!hashResult.ok || hashResult.value !== value.snapshot_hash) {
      ctx.addIssue({ code: 'custom', message: 'snapshot_hash must match the snapshot', path: ['snapshot_hash'] });
    }
  }

  if (value.template !== undefined && value.template !== null) {
    if (value.type === 'pull_request') {
      if (value.template.form !== 'pull_request') {
        ctx.addIssue({
          code: 'custom',
          message: 'pull request submissions require a pull_request template form',
          path: ['template'],
        });
      }
    } else if (value.template.form !== value.issue_kind) {
      ctx.addIssue({ code: 'custom', message: 'issue template form must match issue_kind', path: ['template'] });
    }
  }

  if (value.policy_change !== undefined) {
    if (value.policy_change.changed && value.policy_change.proposed === null) {
      ctx.addIssue({ code: 'custom', message: 'a changed policy requires a proposed result', path: ['policy_change'] });
    }
    if (!value.policy_change.changed && value.policy_change.proposed !== null) {
      ctx.addIssue({ code: 'custom', message: 'an unchanged policy must not carry a proposed result', path: ['policy_change'] });
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
  template: z.strictObject({ form: submissionTemplateFormSchema, version: recordPositiveIntSchema }).nullable().optional(),
  snapshot: snapshotSchema.optional(),
  policy_change: z
    .strictObject({
      changed: z.boolean(),
      proposed: z
        .discriminatedUnion('status', [
          z.strictObject({ status: z.literal('valid'), revision: recordCommitIdSchema }),
          z.strictObject({
            status: z.literal('invalid'),
            revision: recordCommitIdSchema,
            errors: z
              .array(
                z.strictObject({
                  code: recordIdentifierSchema,
                  path: recordTextSchema,
                  message: recordTextSchema,
                  line: recordPositiveIntSchema.nullable(),
                  column: recordPositiveIntSchema.nullable(),
                }),
              )
              .min(1)
              .max(VALIDATION_ERRORS_MAX),
          }),
          z.strictObject({ status: z.literal('removed') }),
        ])
        .nullable(),
    })
    .optional(),
  attachments: recordList(
    z.strictObject({
      url: attachmentUrlSchema,
      format: z
        .string()
        .min(1)
        .max(POLICY_ID_MAX_LENGTH)
        .regex(/^[a-z0-9]+(?:\.[a-z0-9]+)*$/)
        .nullable(),
      bytes: recordCountSchema.nullable(),
      content_hash: recordContentHashSchema.nullable(),
      required: z.boolean(),
      entries: z
        .array(
          z.strictObject({
            name: recordTextSchema.refine(
              (name) => {
                const byteLength = Buffer.byteLength(name, 'utf8');
                return byteLength >= 1 && byteLength <= ARCHIVE_ENTRY_NAME_MAX_BYTES;
              },
              { message: `entry name must be 1-${ARCHIVE_ENTRY_NAME_MAX_BYTES} UTF-8 bytes` },
            ),
            bytes: recordCountSchema,
          }),
        )
        .max(ARCHIVE_ENTRIES_MAX)
        .nullable(),
    }),
  ).optional(),
  claim_scope_hash: recordContentHashSchema.nullable().optional(),
});

function recordCommitOrNullSchema() {
  return z
    .string()
    .regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/)
    .nullable();
}

export const submissionRecordSchema = submissionRecordShape.superRefine(coupling);

export type SubmissionRecord = z.output<typeof submissionRecordSchema>;
