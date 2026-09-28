import { z } from 'zod';

import {
  recordSchemaVersionSchema,
  recordPositiveIntSchema,
  recordRunIdSchema,
  recordIdentifierSchema,
  recordRepositorySchema,
  recordTimestampSchema,
  recordCountSchema,
  recordContentHashSchema,
} from './common.js';
import { submissionTypeSchema, maintainerActionKindSchema, resolutionKindSchema } from '../vocabulary.js';
import { DISMISSAL_CODE_PATTERN } from '../policy/catalog.js';
import { POLICY_ID_MAX_LENGTH } from '../policy/bounds.js';

export const METRICS_EVENT_KINDS = [
  'state-transition',
  'cost',
  'latency',
  'maintainer-resolution',
  'appeal',
  'audit-result',
] as const;
export const metricsEventKindSchema = z.enum(METRICS_EVENT_KINDS);
export type MetricsEventKind = z.infer<typeof metricsEventKindSchema>;

const base = z.strictObject({
  schema_version: recordSchemaVersionSchema,
  record_type: z.literal('metrics-event'),
  subject: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('run'),
      run_id: recordRunIdSchema,
      run_attempt: recordPositiveIntSchema,
    }),
    z.strictObject({
      kind: z.literal('submission'),
      repository: recordRepositorySchema,
      type: submissionTypeSchema,
      number: recordPositiveIntSchema,
    }),
  ]),
  recorded_at: recordTimestampSchema,
});

export const metricsEventRecordSchema = z.discriminatedUnion('kind', [
  base.extend({
    kind: z.literal('state-transition'),
    payload: z.strictObject({ from: recordIdentifierSchema.nullable(), to: recordIdentifierSchema }),
  }),
  base.extend({
    kind: z.literal('cost'),
    payload: z.strictObject({
      model_calls: recordCountSchema.nullable(),
      tokens: recordCountSchema.nullable(),
      ai_credits: z.number().min(0).nullable(),
      container_seconds: z.number().min(0).nullable(),
    }),
  }),
  base.extend({
    kind: z.literal('latency'),
    payload: z.strictObject({ stage: recordIdentifierSchema, seconds: z.number().min(0) }),
  }),
  base.extend({
    kind: z.literal('maintainer-resolution'),
    payload: z.strictObject({
      action_kind: maintainerActionKindSchema,
      dismissal_code: z.string().max(POLICY_ID_MAX_LENGTH).regex(DISMISSAL_CODE_PATTERN).nullable(),
      resolution: resolutionKindSchema.optional(),
      paired_run: z.strictObject({ run_id: recordPositiveIntSchema, run_attempt: recordPositiveIntSchema }).nullable().optional(),
      paired_snapshot_hash: recordContentHashSchema.nullable().optional(),
    }),
  }),
  base.extend({
    kind: z.literal('appeal'),
    payload: z.strictObject({ request_id: recordIdentifierSchema.nullable(), state: z.enum(['opened', 'resolved']) }),
  }),
  base.extend({
    kind: z.literal('audit-result'),
    payload: z.strictObject({ audited_run_id: recordPositiveIntSchema, agreed: z.boolean() }),
  }),
]);

export type MetricsEventRecord = z.output<typeof metricsEventRecordSchema>;
