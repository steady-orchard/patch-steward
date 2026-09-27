import { describe, expect, it } from 'vitest';

import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';

import { missingRequiredStages, requiredStages, stageIncompleteCause, stageResultSchema } from './stages.js';
import type { StageResult } from './stages.js';

const perCategory = DEFAULT_CHECKLIST_POLICY.stages.per_category;

describe('requiredStages', () => {
  it('every submission requires references and claim', () => {
    expect(requiredStages({ type: 'issue', issueKind: 'proposal' }, perCategory)).toEqual(['references', 'claim']);
    expect(requiredStages({ type: 'issue', issueKind: null }, perCategory)).toEqual(['references', 'claim']);
    expect(requiredStages({ type: 'pull_request', plausibleCategories: ['docs'] }, { ...perCategory, docs: [] })).toEqual([
      'references',
      'claim',
    ]);
  });

  it('a defect issue also requires reproduction', () => {
    expect(requiredStages({ type: 'issue', issueKind: 'defect' }, perCategory)).toEqual(['references', 'claim', 'reproduction']);
  });

  it('a pull request requires the stages of every plausible category', () => {
    expect(requiredStages({ type: 'pull_request', plausibleCategories: ['refactor', 'feature'] }, perCategory)).toEqual([
      'references',
      'claim',
      'regression',
      'challenge',
    ]);
    expect(requiredStages({ type: 'pull_request', plausibleCategories: ['bugfix'] }, perCategory)).toEqual([
      'references',
      'claim',
      'fix-verification',
      'regression',
      'challenge',
    ]);
  });

  it('an empty plausible set requires the stages of all six categories', () => {
    expect(requiredStages({ type: 'pull_request', plausibleCategories: [] }, perCategory)).toEqual([
      'references',
      'claim',
      'fix-verification',
      'regression',
      'challenge',
    ]);
  });
});

describe('missingRequiredStages and stageIncompleteCause', () => {
  it('missing required stages are listed in pipeline order', () => {
    const required = ['references', 'claim', 'regression'] as const;
    const results: StageResult[] = [{ stage: 'claim', status: 'complete' }];

    expect(missingRequiredStages(required, results)).toEqual(['references', 'regression']);
    expect(stageIncompleteCause(required, results)).toEqual({
      cause: 'stage-incomplete',
      code: 'pipeline.stage-incomplete',
      message: 'Required stages produced no result.',
      subjects: ['references', 'regression'],
    });
  });

  it('a complete or unavailable result satisfies presence', () => {
    const required = ['references', 'claim'] as const;
    const results: StageResult[] = [
      { stage: 'references', status: 'complete' },
      {
        stage: 'claim',
        status: 'unavailable',
        cause: { cause: 'infrastructure', code: 'x.y', message: 'unavailable', subjects: [] },
      },
    ];

    expect(missingRequiredStages(required, results)).toEqual([]);
    expect(stageIncompleteCause(required, results)).toBeNull();
  });

  it('results for stages that are not required are ignored', () => {
    const required = ['references'] as const;
    const results: StageResult[] = [
      { stage: 'claim', status: 'complete' },
      { stage: 'regression', status: 'complete' },
    ];

    expect(missingRequiredStages(required, results)).toEqual(['references']);
  });
});

describe('stageResultSchema', () => {
  it('stage results validate strictly', () => {
    expect(stageResultSchema.safeParse({ stage: 'not-a-stage', status: 'complete' }).success).toBe(false);
    expect(stageResultSchema.safeParse({ stage: 'claim', status: 'unavailable' }).success).toBe(false);
    expect(
      stageResultSchema.safeParse({
        stage: 'claim',
        status: 'complete',
        extra: 'nope',
      }).success,
    ).toBe(false);
  });
});
