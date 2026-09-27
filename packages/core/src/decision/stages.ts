import { z } from 'zod';

import type { RecordCause } from '../records/decision.js';
import { recordCauseSchema } from '../records/decision.js';
import type { Category, IssueKind, PipelineStage } from '../vocabulary.js';
import { PIPELINE_STAGES, pipelineStageSchema, CATEGORIES } from '../vocabulary.js';
import type { ResolvedPolicy } from '../policy/schema.js';

export const STAGE_INCOMPLETE_CODE = 'pipeline.stage-incomplete';

export type RequiredStagesInput =
  | { readonly type: 'issue'; readonly issueKind: IssueKind | null }
  | { readonly type: 'pull_request'; readonly plausibleCategories: readonly Category[] };

export function requiredStages(
  input: RequiredStagesInput,
  perCategory: ResolvedPolicy['stages']['per_category'],
): readonly PipelineStage[] {
  const required = new Set<PipelineStage>(['references', 'claim']);

  if (input.type === 'issue') {
    if (input.issueKind === 'defect') {
      required.add('reproduction');
    }
  } else {
    const categories = input.plausibleCategories.length > 0 ? input.plausibleCategories : CATEGORIES;
    for (const category of categories) {
      for (const stage of perCategory[category]) {
        required.add(stage);
      }
    }
  }

  return PIPELINE_STAGES.filter((stage) => required.has(stage));
}

export const stageResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ stage: pipelineStageSchema, status: z.literal('complete') }),
  z.strictObject({ stage: pipelineStageSchema, status: z.literal('unavailable'), cause: recordCauseSchema }),
]);
export type StageResult = z.output<typeof stageResultSchema>;

export function missingRequiredStages(
  required: readonly PipelineStage[],
  results: readonly StageResult[],
): readonly PipelineStage[] {
  const present = new Set(results.map((result) => result.stage));
  return required.filter((stage) => !present.has(stage));
}

export function stageIncompleteCause(required: readonly PipelineStage[], results: readonly StageResult[]): RecordCause | null {
  const missing = missingRequiredStages(required, results);
  if (missing.length === 0) {
    return null;
  }
  return {
    cause: 'stage-incomplete',
    code: STAGE_INCOMPLETE_CODE,
    message: 'Required stages produced no result.',
    subjects: [...missing],
  };
}
