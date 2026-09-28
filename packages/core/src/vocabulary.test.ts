import { describe, expect, it } from 'vitest';
import {
  ADMISSIBILITY_VALUES,
  admissibilitySchema,
  BUILT_IN_DISMISSAL_CODES,
  builtInDismissalCodeSchema,
  CAP_STATES,
  capStateSchema,
  CATEGORIES,
  categorySchema,
  FAILURE_CAUSES,
  failureCauseSchema,
  FINDING_SEVERITIES,
  findingSeveritySchema,
  GATE_DISPOSITIONS,
  gateDispositionSchema,
  ISSUE_CLASSIFICATIONS,
  issueClassificationSchema,
  ISSUE_EVENT_ACTIONS,
  issueEventActionSchema,
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
  OWNERSHIP_DISPOSITIONS,
  ownershipDispositionSchema,
  PIPELINE_STAGES,
  pipelineStageSchema,
  PR_CLAIM_CLASSIFICATIONS,
  prClaimClassificationSchema,
  PULL_REQUEST_EVENT_ACTIONS,
  pullRequestEventActionSchema,
  REFERENCE_STATUSES,
  referenceStatusSchema,
  RESOLUTION_KINDS,
  resolutionKindSchema,
  RUN_KINDS,
  runKindSchema,
  SENDER_TYPES,
  senderTypeSchema,
  STAGE_IDS,
  stageIdSchema,
  SUBMISSION_TYPES,
  submissionTypeSchema,
  SUPERSESSION_REASONS,
  supersessionReasonSchema,
  WAITING_REASONS,
  waitingReasonSchema,
  WAITING_STATES,
  waitingStateSchema,
  WRAPPER_EVENT_NAMES,
  wrapperEventNameSchema,
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
  {
    name: 'GATE_DISPOSITIONS',
    tuple: GATE_DISPOSITIONS,
    schema: gateDispositionSchema,
    expected: ['runnable', 'early-exit', 'queued', 'duplicate', 'closure'],
  },
  {
    name: 'OWNERSHIP_DISPOSITIONS',
    tuple: OWNERSHIP_DISPOSITIONS,
    schema: ownershipDispositionSchema,
    expected: ['runnable', 'early-exit', 'queued'],
  },
  {
    name: 'CAP_STATES',
    tuple: CAP_STATES,
    schema: capStateSchema,
    expected: ['within', 'daily-runs', 'per-author-concurrent-runs'],
  },
  {
    name: 'WAITING_REASONS',
    tuple: WAITING_REASONS,
    schema: waitingReasonSchema,
    expected: ['daily-runs', 'per-author-concurrent-runs'],
  },
  {
    name: 'SUPERSESSION_REASONS',
    tuple: SUPERSESSION_REASONS,
    schema: supersessionReasonSchema,
    expected: ['newer-owner', 'snapshot-changed'],
  },
  {
    name: 'RESOLUTION_KINDS',
    tuple: RESOLUTION_KINDS,
    schema: resolutionKindSchema,
    expected: ['merged', 'closed-by-author', 'closed-by-maintainer', 'deleted'],
  },
  { name: 'RUN_KINDS', tuple: RUN_KINDS, schema: runKindSchema, expected: ['outcome', 'waiting'] },
  {
    name: 'WRAPPER_EVENT_NAMES',
    tuple: WRAPPER_EVENT_NAMES,
    schema: wrapperEventNameSchema,
    expected: ['pull_request_target', 'issues'],
  },
  {
    name: 'PULL_REQUEST_EVENT_ACTIONS',
    tuple: PULL_REQUEST_EVENT_ACTIONS,
    schema: pullRequestEventActionSchema,
    expected: ['opened', 'synchronize', 'edited', 'reopened', 'ready_for_review', 'closed'],
  },
  {
    name: 'ISSUE_EVENT_ACTIONS',
    tuple: ISSUE_EVENT_ACTIONS,
    schema: issueEventActionSchema,
    expected: ['opened', 'edited', 'reopened', 'closed', 'deleted'],
  },
  {
    name: 'SENDER_TYPES',
    tuple: SENDER_TYPES,
    schema: senderTypeSchema,
    expected: ['User', 'Bot', 'Organization', 'Mannequin'],
  },
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

  it('committed dispositions are gate dispositions', () => {
    const gateSet = new Set<string>(GATE_DISPOSITIONS);
    for (const value of OWNERSHIP_DISPOSITIONS) {
      expect(gateSet.has(value)).toBe(true);
    }
  });

  it('waiting reasons are the exceeded cap states', () => {
    expect(WAITING_REASONS).toEqual(CAP_STATES.filter((state) => state !== 'within'));
    expect(WAITING_STATES).toContain('queued');
  });
});
