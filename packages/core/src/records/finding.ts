import { z } from 'zod';

import { POLICY_ID_MAX_LENGTH } from '../policy/bounds.js';
import { DISMISSAL_CODE_PATTERN } from '../policy/catalog.js';
import { submissionFieldIdSchema } from '../submission-fields.js';
import { findingSeveritySchema } from '../vocabulary.js';

import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordRunIdSchema,
  recordIdentifierSchema,
  recordTextSchema,
  recordList,
} from './common.js';

export const findingRecordSchema = z.strictObject({
  schema_version: recordSchemaVersionSchema,
  record_type: z.literal('finding'),
  run_id: recordRunIdSchema,
  run_attempt: recordPositiveIntSchema,
  finding_id: recordIdentifierSchema,
  stage: recordIdentifierSchema,
  severity: findingSeveritySchema,
  scenario: recordTextSchema,
  location: z.strictObject({
    path: recordTextSchema.nullable(),
    line: recordPositiveIntSchema.nullable(),
    field: submissionFieldIdSchema.nullable(),
  }),
  evidence: recordList(recordIdentifierSchema),
  basis: recordTextSchema,
  dismissal_code: z.string().max(POLICY_ID_MAX_LENGTH).regex(DISMISSAL_CODE_PATTERN).nullable(),
  code: recordIdentifierSchema.optional(),
  detail: recordIdentifierSchema.nullable().optional(),
  subjects: recordList(recordTextSchema).optional(),
  request_id: recordIdentifierSchema.nullable().optional(),
});

export type FindingRecord = z.output<typeof findingRecordSchema>;
