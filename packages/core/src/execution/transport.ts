import { z } from 'zod';

import { RECORD_LIST_MAX_ITEMS, REDACTION_INPUT_MAX_BYTES } from '../policy/bounds.js';
import {
  policyRevisionIdSchema,
  recordContentHashSchema,
  recordCountSchema,
  recordIdentifierSchema,
  recordList,
  recordPositiveIntSchema,
  recordRunIdSchema,
  recordTextSchema,
} from '../records/common.js';
import { recordCauseSchema } from '../records/decision.js';
import { executionRecordSchema } from '../records/execution-record.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import { executionFailureCodeSchema } from './results.js';
import { executionPlanEntrySchema } from './plan.js';

export const EXECUTION_TRANSPORT_VERSION = 1;

export interface ExecutionTransportBinding {
  readonly run_id: string | number;
  readonly run_attempt: number;
  readonly snapshot_hash: string;
  readonly policy_revision: string;
}

const runSchema = z.strictObject({ run_id: recordRunIdSchema, run_attempt: recordPositiveIntSchema });

export const executionPlanTransportSchema = z
  .strictObject({
    transport: z.literal('execution-plan'),
    transport_version: z.literal(1),
    run: runSchema,
    snapshot_hash: recordContentHashSchema,
    policy_revision: policyRevisionIdSchema,
    entries: z.array(executionPlanEntrySchema).max(RECORD_LIST_MAX_ITEMS),
    over_budget: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    for (const entry of value.entries) {
      if (ids.has(entry.id)) {
        ctx.addIssue({ code: 'custom', message: 'plan entry ids must be unique', path: ['entries'] });
        return;
      }
      ids.add(entry.id);
    }
  });

export type ExecutionPlanTransport = z.output<typeof executionPlanTransportSchema>;

const utf8Bytes = (text: string): number => Buffer.byteLength(text, 'utf8');

const completedEntrySchema = z
  .strictObject({
    kind: z.literal('completed'),
    entry_id: recordIdentifierSchema,
    record: executionRecordSchema,
    output: z.strictObject({
      parts: z.array(z.string()).min(1).max(2),
      omitted_bytes: recordCountSchema,
      trimmed_bytes: recordCountSchema,
    }),
    result_texts: z
      .array(
        z.strictObject({
          position: z.int().min(1).max(20),
          decoded_bytes: recordCountSchema,
          text: z.string().nullable(),
        }),
      )
      .max(20),
  })
  .superRefine((value, ctx) => {
    const fail = (message: string, path: (string | number)[]): void => {
      ctx.addIssue({ code: 'custom', message, path });
    };
    const { record, output } = value;
    if (record.plan_entry !== value.entry_id) {
      fail('record must name the entry', ['record', 'plan_entry']);
    }
    if (record.output.stored_path !== null) {
      fail('transport output must have a null stored_path', ['record', 'output', 'stored_path']);
    }
    for (const part of output.parts) {
      if (utf8Bytes(part) > REDACTION_INPUT_MAX_BYTES) {
        fail('output part exceeds the cap', ['output', 'parts']);
      }
    }
    if (output.parts.length === 1) {
      if (output.omitted_bytes !== 0 || output.trimmed_bytes !== 0) {
        fail('a single part has no omitted or trimmed bytes', ['output']);
      }
    } else if (output.omitted_bytes + output.trimmed_bytes <= 0) {
      fail('two parts require omitted or trimmed bytes', ['output']);
    }

    const expected = new Set<number>();
    record.result_files.forEach((file, i) => {
      if (file.status === 'parsed' || file.status === 'malformed') {
        expected.add(i + 1);
      }
    });
    const seen = new Set<number>();
    for (const item of value.result_texts) {
      if (seen.has(item.position)) {
        fail('result text positions must be unique', ['result_texts']);
        return;
      }
      seen.add(item.position);
    }
    if (seen.size !== expected.size || [...expected].some((p) => !seen.has(p))) {
      fail('result texts must cover exactly the parsed and malformed files', ['result_texts']);
      return;
    }
    for (const item of value.result_texts) {
      const file = record.result_files[item.position - 1];
      if ((item.text === null) !== item.decoded_bytes > REDACTION_INPUT_MAX_BYTES) {
        fail('text is null exactly when decoded bytes exceed the cap', ['result_texts']);
      } else if (item.text !== null && utf8Bytes(item.text) !== item.decoded_bytes) {
        fail('text length must match decoded bytes', ['result_texts']);
      }
      if (item.text === null) {
        if (file?.stored_omitted !== true || file.stored_omitted_reason !== 'redaction-input') {
          fail('omitted text requires the redaction-input omission flag', ['result_texts']);
        }
      } else if (file !== undefined && (file.stored_omitted !== undefined || (file.stored_path ?? null) !== null)) {
        fail('present text requires an unflagged entry without a stored path', ['result_texts']);
      }
    }
  });

export const executionResultEntrySchema = z.discriminatedUnion('kind', [
  completedEntrySchema,
  z.strictObject({
    kind: z.literal('environment-failure'),
    entry_id: recordIdentifierSchema,
    code: executionFailureCodeSchema,
    subject: recordTextSchema.nullable(),
  }),
]);

export type ExecutionResultEntry = z.output<typeof executionResultEntrySchema>;

export const executionResultsTransportSchema = z.strictObject({
  transport: z.literal('execution-results'),
  transport_version: z.literal(1),
  run: runSchema,
  snapshot_hash: recordContentHashSchema,
  policy_revision: policyRevisionIdSchema,
  results: z.array(executionResultEntrySchema).max(RECORD_LIST_MAX_ITEMS),
  causes: recordList(recordCauseSchema),
});

export type ExecutionResultsTransport = z.output<typeof executionResultsTransportSchema>;

export type ExecutionTransportFailureCode = 'pipeline.transport-invalid' | 'pipeline.transport-binding';

const INVALID_MESSAGE = 'The execution transport record failed validation.';
const BINDING_MESSAGE = 'The execution transport record is not bound to this run.';

function bound(
  value: { run: { run_id: string | number; run_attempt: number }; snapshot_hash: string; policy_revision: string },
  binding: ExecutionTransportBinding,
): boolean {
  return (
    value.run.run_id === binding.run_id &&
    value.run.run_attempt === binding.run_attempt &&
    value.snapshot_hash === binding.snapshot_hash &&
    value.policy_revision === binding.policy_revision
  );
}

export function validateExecutionPlan(
  candidate: unknown,
  binding: ExecutionTransportBinding,
): Result<ExecutionPlanTransport, ExecutionTransportFailureCode> {
  const parsed = executionPlanTransportSchema.safeParse(candidate);
  if (!parsed.success) {
    return err('pipeline.transport-invalid', 'steward-defect', INVALID_MESSAGE);
  }
  if (!bound(parsed.data, binding)) {
    return err('pipeline.transport-binding', 'steward-defect', BINDING_MESSAGE);
  }
  return ok(parsed.data);
}

export function validateExecutionResults(
  candidate: unknown,
  context: { readonly binding: ExecutionTransportBinding; readonly plan: ExecutionPlanTransport },
): Result<ExecutionResultsTransport, ExecutionTransportFailureCode> {
  const invalid = err('pipeline.transport-invalid', 'steward-defect', INVALID_MESSAGE);
  const parsed = executionResultsTransportSchema.safeParse(candidate);
  if (!parsed.success) {
    return invalid;
  }
  const { binding, plan } = context;
  if (!bound(parsed.data, binding)) {
    return err('pipeline.transport-binding', 'steward-defect', BINDING_MESSAGE);
  }
  let last = -1;
  for (const result of parsed.data.results) {
    const index = plan.entries.findIndex((entry) => entry.id === result.entry_id);
    if (index <= last) {
      return invalid;
    }
    last = index;
    if (result.kind !== 'completed') {
      continue;
    }
    const planEntry = plan.entries[index];
    const { record } = result;
    if (
      planEntry === undefined ||
      record.run_id !== binding.run_id ||
      record.run_attempt !== binding.run_attempt ||
      record.commits.head !== planEntry.commit ||
      record.command.length !== planEntry.run.length ||
      record.command.some((part, i) => part !== planEntry.run[i]) ||
      (record.kind !== undefined && record.kind !== planEntry.kind)
    ) {
      return invalid;
    }
  }
  return ok(parsed.data);
}
