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
  recordTreeIdSchema,
  recordContentHashSchema,
  recordTimestampSchema,
  recordCountSchema,
  recordList,
} from './common.js';

export const RESULT_FILE_STATUSES = ['parsed', 'missing', 'not-regular', 'too-large', 'malformed'] as const;
const resultFileStatusSchema = z.enum(RESULT_FILE_STATUSES);
export type ResultFileStatus = z.infer<typeof resultFileStatusSchema>;

export const STORED_OMITTED_REASONS = ['evidence-budget', 'redaction-input'] as const;
const storedOmittedReasonSchema = z.enum(STORED_OMITTED_REASONS);
export type StoredOmittedReason = z.infer<typeof storedOmittedReasonSchema>;

export const TEST_CASE_STATUSES = ['pass', 'fail', 'skip', 'error'] as const;
const testCaseStatusSchema = z.enum(TEST_CASE_STATUSES);
export type TestCaseStatus = z.infer<typeof testCaseStatusSchema>;

const resultFilePathSchema = z
  .string()
  .min(1)
  .max(RECORD_TEXT_MAX_LENGTH)
  .refine((s) => s.isWellFormed(), 'text must be well-formed Unicode');

const shaDigestSchema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/)
  .nullable();

export const junitSummarySchema = z
  .strictObject({
    tests: recordCountSchema,
    passed: recordCountSchema,
    failed: recordCountSchema,
    errored: recordCountSchema,
    skipped: recordCountSchema,
    duration_ms: recordCountSchema.nullable(),
    cases: z
      .array(
        z.strictObject({
          identity: recordTextSchema,
          status: testCaseStatusSchema,
          duration_ms: recordCountSchema.nullable(),
          identity_truncated: z.boolean(),
        }),
      )
      .max(RECORD_LIST_MAX_ITEMS),
    cases_truncated: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.passed + value.failed + value.errored + value.skipped !== value.tests) {
      ctx.addIssue({ code: 'custom', message: 'passed + failed + errored + skipped must equal tests', path: ['tests'] });
    }
    if (value.cases.length > value.tests) {
      ctx.addIssue({ code: 'custom', message: 'cases cannot exceed tests', path: ['cases'] });
    }
    if (value.cases_truncated !== value.cases.length < value.tests) {
      ctx.addIssue({
        code: 'custom',
        message: 'cases_truncated must match whether cases is fewer than tests',
        path: ['cases_truncated'],
      });
    }
  });

export type JunitSummaryRecord = z.output<typeof junitSummarySchema>;

export const executionResultFileSchema = z
  .strictObject({
    path: resultFilePathSchema,
    content_hash: recordContentHashSchema.nullable(),
    bytes: recordCountSchema,
    format: z.literal('junit-xml').optional(),
    status: resultFileStatusSchema.optional(),
    error_code: recordIdentifierSchema.nullable().optional(),
    stored_path: z
      .string()
      .regex(/^executions\/execution-[0-9]{4}\/result-(?:[1-9]|1[0-9]|20)\.xml$/)
      .nullable()
      .optional(),
    stored_omitted: z.boolean().optional(),
    stored_omitted_reason: storedOmittedReasonSchema.optional(),
    junit: junitSummarySchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const unread = value.status === 'missing' || value.status === 'not-regular' || value.status === 'too-large';
    const read = value.status === 'parsed' || value.status === 'malformed';

    // R1
    if (value.status !== undefined) {
      if (unread !== (value.content_hash === null)) {
        ctx.addIssue({ code: 'custom', message: 'unread status requires a null content_hash', path: ['content_hash'] });
      }
    } else if (value.content_hash === null) {
      ctx.addIssue({ code: 'custom', message: 'a missing status requires a content_hash', path: ['content_hash'] });
    }

    // R2
    if ((value.status === 'missing' || value.status === 'not-regular') && value.bytes !== 0) {
      ctx.addIssue({ code: 'custom', message: 'missing or not-regular status must record zero bytes', path: ['bytes'] });
    }

    // R3
    if (value.status !== undefined) {
      if (value.junit === undefined) {
        ctx.addIssue({ code: 'custom', message: 'status present requires the junit key', path: ['junit'] });
      } else if ((value.junit !== null) !== (value.status === 'parsed')) {
        ctx.addIssue({ code: 'custom', message: 'junit is non-null only when status is parsed', path: ['junit'] });
      }
    }

    // R4
    if (value.status !== undefined) {
      if (value.error_code === undefined) {
        ctx.addIssue({ code: 'custom', message: 'status present requires the error_code key', path: ['error_code'] });
      } else if ((value.error_code !== null) !== (value.status === 'malformed')) {
        ctx.addIssue({ code: 'custom', message: 'error_code is non-null only when status is malformed', path: ['error_code'] });
      }
    }

    // R5
    if (value.stored_omitted !== undefined && value.status === undefined) {
      ctx.addIssue({ code: 'custom', message: 'stored_omitted requires status', path: ['stored_omitted'] });
    }

    // R6
    if (value.stored_omitted === true && !read) {
      ctx.addIssue({ code: 'custom', message: 'stored_omitted true requires a read status', path: ['stored_omitted'] });
    }

    // R7
    if (value.stored_omitted !== undefined) {
      if ((value.stored_omitted_reason !== undefined) !== (value.stored_omitted === true)) {
        ctx.addIssue({
          code: 'custom',
          message: 'stored_omitted_reason must accompany stored_omitted true',
          path: ['stored_omitted_reason'],
        });
      }
    } else {
      // R8
      if (value.stored_omitted_reason !== undefined) {
        ctx.addIssue({ code: 'custom', message: 'stored_omitted_reason requires stored_omitted', path: ['stored_omitted_reason'] });
      }
      if (value.stored_path !== undefined && value.stored_path !== null) {
        ctx.addIssue({ code: 'custom', message: 'stored_path requires stored_omitted', path: ['stored_path'] });
      }
    }

    // R9
    if (value.stored_omitted !== undefined) {
      const hasStoredPath = (value.stored_path ?? null) !== null;
      const shouldHaveStoredPath = read && value.stored_omitted === false;
      if (hasStoredPath !== shouldHaveStoredPath) {
        ctx.addIssue({
          code: 'custom',
          message: 'stored_path presence must follow status and stored_omitted',
          path: ['stored_path'],
        });
      }
    }
  });

export type ExecutionResultFile = z.output<typeof executionResultFileSchema>;

export const executionRecordSchema = z
  .strictObject({
    schema_version: recordSchemaVersionSchema,
    record_type: z.literal('execution-record'),
    run_id: recordRunIdSchema,
    run_attempt: recordPositiveIntSchema,
    plan_entry: recordIdentifierSchema,
    command: z.array(recordTextSchema).min(1).max(RECORD_LIST_MAX_ITEMS),
    kind: z.enum(['command', 'dependency-step']).optional(),
    runner: z.enum(['container', 'unsandboxed']).optional(),
    working_directory: recordTextSchema.optional(),
    expected: z.enum(['exit-zero', 'exit-nonzero', 'any']).optional(),
    limits: z
      .strictObject({
        execution_seconds: recordCountSchema,
        output_head_bytes: recordCountSchema,
        output_tail_bytes: recordCountSchema,
        output_stream_bytes: recordCountSchema,
        cpus: recordCountSchema.nullable(),
        memory_mb: recordCountSchema.nullable(),
        pids: recordCountSchema.nullable(),
        scratch_mb: recordCountSchema.nullable(),
      })
      .optional(),
    timing: z
      .strictObject({
        started_at: recordTimestampSchema,
        finished_at: recordTimestampSchema,
        duration_ms: recordCountSchema,
      })
      .optional(),
    checkout: z
      .strictObject({
        commit: recordCommitIdSchema,
        tree: recordTreeIdSchema,
        archive_sha256: recordContentHashSchema.nullable(),
        files: recordCountSchema,
        bytes: recordCountSchema,
        overlays: recordList(
          z.strictObject({
            path: recordTextSchema,
            blob: recordTreeIdSchema.nullable(),
          }),
        ),
        skipped_submodules: recordList(recordTextSchema),
      })
      .optional(),
    environment: z.strictObject({
      image_digest: shaDigestSchema,
      tool_versions: recordList(
        z.strictObject({
          name: recordIdentifierSchema,
          version: recordIdentifierSchema,
        }),
      ),
      runtime: z
        .strictObject({
          name: z.enum(['docker', 'podman', 'host']),
          client_version: recordIdentifierSchema.nullable(),
          server_version: recordIdentifierSchema.nullable(),
          os: recordIdentifierSchema,
          arch: recordIdentifierSchema,
        })
        .optional(),
      image: z
        .strictObject({
          source: z.enum(['registry', 'dockerfile']),
          reference: recordTextSchema,
          digest: shaDigestSchema,
          id: shaDigestSchema,
          runner_tree_id: recordTreeIdSchema.nullable(),
          cached: z.boolean(),
        })
        .nullable()
        .optional(),
      platform: recordIdentifierSchema.optional(),
      network: z.enum(['none', 'egress']).optional(),
    }),
    exit: z.strictObject({
      code: z.int().nullable(),
      signal: recordIdentifierSchema.nullable(),
      timed_out: z.boolean(),
      oom_killed: z.boolean().optional(),
      output_limited: z.boolean().optional(),
    }),
    output: z.strictObject({
      head: recordTextSchema,
      tail: recordTextSchema,
      truncated: z.boolean(),
      total_bytes: recordCountSchema,
      stored_path: z
        .string()
        .regex(/^executions\/execution-[0-9]{4}\/output\.txt$/)
        .nullable()
        .optional(),
    }),
    result_files: recordList(executionResultFileSchema),
    test_identity: recordIdentifierSchema.nullable(),
    commits: z.strictObject({
      head: recordCommitIdSchema,
      base: recordCommitIdSchema.nullable(),
      merge: recordCommitIdSchema.nullable(),
    }),
    admissibility: admissibilitySchema,
  })
  .superRefine((value, ctx) => {
    if (value.runner === 'container' && value.admissibility !== 'evidence') {
      ctx.addIssue({ code: 'custom', message: 'a container runner requires evidence admissibility', path: ['admissibility'] });
    }
    if (value.runner === 'unsandboxed' && value.admissibility !== 'claim') {
      ctx.addIssue({ code: 'custom', message: 'an unsandboxed runner requires claim admissibility', path: ['admissibility'] });
    }
  });

export type ExecutionRecord = z.output<typeof executionRecordSchema>;
