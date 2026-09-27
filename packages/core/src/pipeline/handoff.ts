import { z } from 'zod';

import { canonicalJson } from '../canonical-json.js';
import { CHANGED_PATHS_MAX, HANDOFF_MAX_BYTES, RECORD_LIST_MAX_ITEMS } from '../policy/bounds.js';
import { recordCauseSchema } from '../records/decision.js';
import {
  recordContentHashSchema,
  recordIdentifierSchema,
  recordList,
  recordPositiveIntSchema,
  recordRunIdSchema,
  recordTextSchema,
  policyRevisionIdSchema,
} from '../records/common.js';
import { stageResultSchema } from '../decision/stages.js';
import { findingSeveritySchema } from '../vocabulary.js';
import { submissionFieldIdSchema } from '../submission-fields.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import { budgetRemainingSchema, budgetNotIncreased } from './budget.js';

export const HANDOFF_VERSION = 1;

export const PIPELINE_PHASES = ['gate', 'intake', 'execute', 'assess', 'publish'] as const;
export type PipelinePhase = (typeof PIPELINE_PHASES)[number];

export const HANDOFF_PHASES = ['gate', 'intake', 'execute', 'assess'] as const;
export type HandoffPhase = (typeof HANDOFF_PHASES)[number];

export const HANDOFF_EARLY_EXITS = ['contract-needs-changes', 'contract-inconclusive'] as const;

export const handoffFindingSchema = z.strictObject({
  stage: recordIdentifierSchema,
  severity: findingSeveritySchema,
  code: recordIdentifierSchema,
  detail: recordIdentifierSchema.nullable(),
  field: submissionFieldIdSchema.nullable(),
  subjects: z.array(recordTextSchema).max(CHANGED_PATHS_MAX),
  message: recordTextSchema,
});

export type HandoffFinding = z.output<typeof handoffFindingSchema>;

export const handoffRecordSchema = z.strictObject({
  handoff_version: z.literal(HANDOFF_VERSION),
  phase: z.enum(HANDOFF_PHASES),
  run: z.strictObject({ run_id: recordRunIdSchema, run_attempt: recordPositiveIntSchema }),
  snapshot_hash: recordContentHashSchema,
  policy_revision: policyRevisionIdSchema,
  round: z.int().min(0).max(3),
  budget_remaining: budgetRemainingSchema,
  early_exit: z.enum(HANDOFF_EARLY_EXITS).nullable(),
  findings: z.array(handoffFindingSchema).max(RECORD_LIST_MAX_ITEMS),
  causes: recordList(recordCauseSchema),
  stage_results: recordList(stageResultSchema),
  next_round_plan: z.strictObject({ reason: recordTextSchema }).nullable(),
});

export type HandoffRecord = z.output<typeof handoffRecordSchema>;

export type HandoffFailureCode = 'pipeline.handoff-invalid' | 'pipeline.handoff-binding';

export interface HandoffValidationContext {
  readonly previous: HandoffRecord | null;
  readonly gate: HandoffRecord | null;
  readonly maxRounds: number;
  readonly maxBytes?: number;
}

export function expectedNextHandoff(
  previous: HandoffRecord | null,
  maxRounds: number,
): { readonly phase: HandoffPhase; readonly round: number } | null {
  if (previous === null) {
    return { phase: 'gate', round: 0 };
  }
  if (previous.early_exit !== null) {
    return null;
  }
  const effectiveMax = Math.min(maxRounds, 3);
  switch (previous.phase) {
    case 'gate':
      return { phase: 'intake', round: 0 };
    case 'intake':
      return { phase: 'execute', round: 0 };
    case 'execute':
      return { phase: 'assess', round: previous.round };
    case 'assess': {
      if (previous.next_round_plan === null) {
        return null;
      }
      const nextRound = previous.round + 1;
      if (nextRound > effectiveMax) {
        return null;
      }
      return { phase: 'execute', round: nextRound };
    }
    default:
      return null;
  }
}

function recordListAppendOnly<T>(previous: readonly T[], candidate: readonly T[]): boolean {
  if (candidate.length < previous.length) {
    return false;
  }
  for (let i = 0; i < previous.length; i += 1) {
    const previousItem = canonicalJson(previous[i]);
    const candidateItem = canonicalJson(candidate[i]);
    if (!previousItem.ok || !candidateItem.ok || previousItem.value !== candidateItem.value) {
      return false;
    }
  }
  return true;
}

export function validateHandoff(candidate: unknown, context: HandoffValidationContext): Result<HandoffRecord, HandoffFailureCode> {
  const canonical = canonicalJson(candidate);
  const maxBytes = Math.min(context.maxBytes ?? HANDOFF_MAX_BYTES, HANDOFF_MAX_BYTES);
  if (!canonical.ok || Buffer.byteLength(canonical.value, 'utf8') > maxBytes) {
    return err('pipeline.handoff-invalid', 'steward-defect', 'The handoff record failed validation.');
  }

  const parsed = handoffRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    return err('pipeline.handoff-invalid', 'steward-defect', 'The handoff record failed validation.');
  }
  const record = parsed.data;

  if (record.early_exit !== null && record.phase !== 'gate') {
    return err('pipeline.handoff-invalid', 'steward-defect', 'The handoff record failed validation.');
  }
  if (record.next_round_plan !== null && record.phase !== 'assess') {
    return err('pipeline.handoff-invalid', 'steward-defect', 'The handoff record failed validation.');
  }

  if (context.gate !== null) {
    const { gate } = context;
    if (
      record.run.run_id !== gate.run.run_id ||
      record.run.run_attempt !== gate.run.run_attempt ||
      record.snapshot_hash !== gate.snapshot_hash ||
      record.policy_revision !== gate.policy_revision
    ) {
      return err('pipeline.handoff-binding', 'steward-defect', 'The handoff record is not bound to this run.');
    }
  }

  const expected = expectedNextHandoff(context.previous, context.maxRounds);
  if (expected === null) {
    return err('pipeline.handoff-binding', 'steward-defect', 'The handoff record is not bound to this run.');
  }
  if (expected.phase !== record.phase) {
    return err('pipeline.handoff-invalid', 'steward-defect', 'The handoff record failed validation.');
  }
  if (expected.round !== record.round) {
    return err('pipeline.handoff-binding', 'steward-defect', 'The handoff record is not bound to this run.');
  }

  if (context.previous !== null) {
    if (!budgetNotIncreased(context.previous.budget_remaining, record.budget_remaining)) {
      return err('pipeline.handoff-invalid', 'steward-defect', 'The handoff record failed validation.');
    }
    if (
      !recordListAppendOnly(context.previous.findings, record.findings) ||
      !recordListAppendOnly(context.previous.causes, record.causes) ||
      !recordListAppendOnly(context.previous.stage_results, record.stage_results)
    ) {
      return err('pipeline.handoff-invalid', 'steward-defect', 'The handoff record failed validation.');
    }
  }

  return ok(record);
}
