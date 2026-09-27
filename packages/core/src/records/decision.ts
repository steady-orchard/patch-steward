import { z } from 'zod';

import { outcomeSchema, failureCauseSchema } from '../vocabulary.js';

import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordRunIdSchema,
  recordIdentifierSchema,
  recordTextSchema,
  recordList,
} from './common.js';

export const recordCauseSchema = z.strictObject({
  cause: failureCauseSchema,
  code: recordIdentifierSchema,
  message: recordTextSchema,
  subjects: recordList(recordTextSchema),
});

export type RecordCause = z.output<typeof recordCauseSchema>;

export const decisionRecordSchema = z.strictObject({
  schema_version: recordSchemaVersionSchema,
  record_type: z.literal('decision'),
  run_id: recordRunIdSchema,
  run_attempt: recordPositiveIntSchema,
  outcome: outcomeSchema,
  contributing_findings: recordList(recordIdentifierSchema),
  unmet_requirements: recordList(recordTextSchema),
  requests: recordList(
    z.strictObject({
      request_id: recordIdentifierSchema,
      text: recordTextSchema,
    }),
  ),
  causes: recordList(recordCauseSchema).optional(),
});

export type DecisionRecord = z.output<typeof decisionRecordSchema>;
