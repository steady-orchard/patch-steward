import { z } from 'zod';

import { outcomeSchema } from '../vocabulary.js';

import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordIdentifierSchema,
  recordTextSchema,
  recordList,
} from './common.js';

export const decisionRecordSchema = z.strictObject({
  schema_version: recordSchemaVersionSchema,
  record_type: z.literal('decision'),
  run_id: recordPositiveIntSchema,
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
});

export type DecisionRecord = z.output<typeof decisionRecordSchema>;
