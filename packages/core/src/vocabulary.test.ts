import { describe, expect, it } from 'vitest';
import {
  ADMISSIBILITY_VALUES,
  admissibilitySchema,
  BUILT_IN_DISMISSAL_CODES,
  builtInDismissalCodeSchema,
  CATEGORIES,
  categorySchema,
  FAILURE_CAUSES,
  failureCauseSchema,
  FINDING_SEVERITIES,
  findingSeveritySchema,
  ISSUE_CLASSIFICATIONS,
  issueClassificationSchema,
  ISSUE_KINDS,
  issueKindSchema,
  LABEL_FAMILIES,
  labelFamilySchema,
  LIFECYCLE_LABEL_STATES,
  lifecycleLabelStateSchema,
  MAINTAINER_ACTION_KINDS,
  maintainerActionKindSchema,
  MODES,
  modeSchema,
  OUTCOMES,
  outcomeSchema,
  PIPELINE_STAGES,
  pipelineStageSchema,
  PR_CLAIM_CLASSIFICATIONS,
  prClaimClassificationSchema,
  REFERENCE_STATUSES,
  referenceStatusSchema,
  STAGE_IDS,
  stageIdSchema,
  SUBMISSION_TYPES,
  submissionTypeSchema,
  WAITING_STATES,
  waitingStateSchema,
} from './vocabulary.js';

const vocabularies: ReadonlyArray<{
  readonly name: string;
  readonly tuple: readonly string[];
  readonly schema: { safeParse: (value: unknown) => { success: boolean } };
  readonly expected: readonly string[];
}> = [
  {
    name: 'OUTCOMES',
    tuple: OUTCOMES,
    schema: outcomeSchema,
    expected: ['pass', 'needs-changes', 'uncertain', 'inconclusive', 'overridden', 'superseded'],
  },
  { name: 'WAITING_STATES', tuple: WAITING_STATES, schema: waitingStateSchema, expected: ['queued', 'awaiting-approval'] },
  {
    name: 'LIFECYCLE_LABEL_STATES',
    tuple: LIFECYCLE_LABEL_STATES,
    schema: lifecycleLabelStateSchema,
    expected: ['queued', 'awaiting-approval', 'screening', 'pass', 'awaiting-author', 'triage'],
  },
  {
    name: 'ISSUE_CLASSIFICATIONS',
    tuple: ISSUE_CLASSIFICATIONS,
    schema: issueClassificationSchema,
    expected: [
      'supported-defect',
      'intended-behavior',
      'feature-request',
      'accepted-proposal',
      'proposal-pending',
      'duplicate',
      'uncertain',
    ],
  },
  {
    name: 'PR_CLAIM_CLASSIFICATIONS',
    tuple: PR_CLAIM_CLASSIFICATIONS,
    schema: prClaimClassificationSchema,
    expected: ['accepted-proposal', 'unrequested-change'],
  },
  {
    name: 'FINDING_SEVERITIES',
    tuple: FINDING_SEVERITIES,
    schema: findingSeveritySchema,
    expected: ['blocking', 'uncertain', 'advisory', 'speculative'],
  },
  {
    name: 'CATEGORIES',
    tuple: CATEGORIES,
    schema: categorySchema,
    expected: ['bugfix', 'feature', 'refactor', 'docs', 'chore', 'security'],
  },
  { name: 'MODES', tuple: MODES, schema: modeSchema, expected: ['observe', 'advise', 'enforce'] },
  { name: 'STAGE_IDS', tuple: STAGE_IDS, schema: stageIdSchema, expected: ['fix-verification', 'regression', 'challenge'] },
  {
    name: 'PIPELINE_STAGES',
    tuple: PIPELINE_STAGES,
    schema: pipelineStageSchema,
    expected: ['references', 'claim', 'reproduction', 'fix-verification', 'regression', 'challenge'],
  },
  { name: 'SUBMISSION_TYPES', tuple: SUBMISSION_TYPES, schema: submissionTypeSchema, expected: ['issue', 'pull_request'] },
  { name: 'ISSUE_KINDS', tuple: ISSUE_KINDS, schema: issueKindSchema, expected: ['defect', 'proposal'] },
  {
    name: 'MAINTAINER_ACTION_KINDS',
    tuple: MAINTAINER_ACTION_KINDS,
    schema: maintainerActionKindSchema,
    expected: ['override', 'guidance', 'waiver', 'acceptance', 'resolution', 'inference-admission'],
  },
  { name: 'ADMISSIBILITY_VALUES', tuple: ADMISSIBILITY_VALUES, schema: admissibilitySchema, expected: ['evidence', 'signal'] },
  {
    name: 'REFERENCE_STATUSES',
    tuple: REFERENCE_STATUSES,
    schema: referenceStatusSchema,
    expected: ['verified', 'unverified', 'fabricated'],
  },
  {
    name: 'FAILURE_CAUSES',
    tuple: FAILURE_CAUSES,
    schema: failureCauseSchema,
    expected: [
      'infrastructure',
      'github-unavailable',
      'model-unavailable',
      'model-retired',
      'credential-unusable',
      'capability-mismatch',
      'model-refusal',
      'malformed-output',
      'rate-limited',
      'budget-exhausted',
      'environment-unavailable',
      'baseline-unavailable',
      'coverage-missing',
      'attachment-fetch-failed',
      'policy-unavailable',
      'policy-invalid',
      'llm-not-configured',
      'cancelled',
      'steward-defect',
      'stage-incomplete',
    ],
  },
  {
    name: 'BUILT_IN_DISMISSAL_CODES',
    tuple: BUILT_IN_DISMISSAL_CODES,
    schema: builtInDismissalCodeSchema,
    expected: [
      'no-reproduction',
      'intended-behavior',
      'not-applicable-version',
      'unsupported-claim',
      'fabricated-reference',
      'duplicate',
      'out-of-scope',
      'insufficient-benefit',
      'proposal-required',
    ],
  },
  { name: 'LABEL_FAMILIES', tuple: LABEL_FAMILIES, schema: labelFamilySchema, expected: ['status', 'classification'] },
];

describe('vocabularies', () => {
  for (const { name, tuple, schema, expected } of vocabularies) {
    it(`${name} matches expected values in order`, () => {
      expect(tuple).toEqual(expected);
    });

    it(`${name} schema accepts every member and rejects invalid values`, () => {
      for (const value of tuple) {
        expect(schema.safeParse(value).success).toBe(true);
      }
      expect(schema.safeParse('PASS').success).toBe(false);
      expect(schema.safeParse('').success).toBe(false);
      expect(schema.safeParse(42).success).toBe(false);
    });

    it(`${name} has no duplicate values`, () => {
      expect(new Set(tuple).size).toBe(tuple.length);
    });
  }

  it('WAITING_STATES shares no value with OUTCOMES', () => {
    const outcomeSet = new Set<string>(OUTCOMES);
    for (const value of WAITING_STATES) {
      expect(outcomeSet.has(value)).toBe(false);
    }
  });

  it('FAILURE_CAUSES has 20 entries ending with stage-incomplete', () => {
    expect(FAILURE_CAUSES.length).toBe(20);
    expect(FAILURE_CAUSES[19]).toBe('stage-incomplete');
  });

  it('every stage id is a pipeline stage', () => {
    const pipelineStageSet = new Set<string>(PIPELINE_STAGES);
    for (const value of STAGE_IDS) {
      expect(pipelineStageSet.has(value)).toBe(true);
    }
  });

  it('BUILT_IN_DISMISSAL_CODES has 9 entries', () => {
    expect(BUILT_IN_DISMISSAL_CODES.length).toBe(9);
  });
});
