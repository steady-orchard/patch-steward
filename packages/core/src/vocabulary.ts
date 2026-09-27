import { z } from 'zod';

export const OUTCOMES = ['pass', 'needs-changes', 'uncertain', 'inconclusive', 'overridden', 'superseded'] as const;
export const outcomeSchema = z.enum(OUTCOMES);
export type Outcome = z.infer<typeof outcomeSchema>;

export const WAITING_STATES = ['queued', 'awaiting-approval'] as const;
export const waitingStateSchema = z.enum(WAITING_STATES);
export type WaitingState = z.infer<typeof waitingStateSchema>;

export const LIFECYCLE_LABEL_STATES = ['queued', 'awaiting-approval', 'screening', 'pass', 'awaiting-author', 'triage'] as const;
export const lifecycleLabelStateSchema = z.enum(LIFECYCLE_LABEL_STATES);
export type LifecycleLabelState = z.infer<typeof lifecycleLabelStateSchema>;

export const ISSUE_CLASSIFICATIONS = [
  'supported-defect',
  'intended-behavior',
  'feature-request',
  'accepted-proposal',
  'proposal-pending',
  'duplicate',
  'uncertain',
] as const;
export const issueClassificationSchema = z.enum(ISSUE_CLASSIFICATIONS);
export type IssueClassification = z.infer<typeof issueClassificationSchema>;

export const PR_CLAIM_CLASSIFICATIONS = ['accepted-proposal', 'unrequested-change'] as const;
export const prClaimClassificationSchema = z.enum(PR_CLAIM_CLASSIFICATIONS);
export type PrClaimClassification = z.infer<typeof prClaimClassificationSchema>;

export const FINDING_SEVERITIES = ['blocking', 'uncertain', 'advisory', 'speculative'] as const;
export const findingSeveritySchema = z.enum(FINDING_SEVERITIES);
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;

export const CATEGORIES = ['bugfix', 'feature', 'refactor', 'docs', 'chore', 'security'] as const;
export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

export const MODES = ['observe', 'advise', 'enforce'] as const;
export const modeSchema = z.enum(MODES);
export type Mode = z.infer<typeof modeSchema>;

export const STAGE_IDS = ['fix-verification', 'regression', 'challenge'] as const;
export const stageIdSchema = z.enum(STAGE_IDS);
export type StageId = z.infer<typeof stageIdSchema>;

export const PIPELINE_STAGES = ['references', 'claim', 'reproduction', 'fix-verification', 'regression', 'challenge'] as const;
export const pipelineStageSchema = z.enum(PIPELINE_STAGES);
export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const SUBMISSION_TYPES = ['issue', 'pull_request'] as const;
export const submissionTypeSchema = z.enum(SUBMISSION_TYPES);
export type SubmissionType = z.infer<typeof submissionTypeSchema>;

export const ISSUE_KINDS = ['defect', 'proposal'] as const;
export const issueKindSchema = z.enum(ISSUE_KINDS);
export type IssueKind = z.infer<typeof issueKindSchema>;

export const MAINTAINER_ACTION_KINDS = [
  'override',
  'guidance',
  'waiver',
  'acceptance',
  'resolution',
  'inference-admission',
] as const;
export const maintainerActionKindSchema = z.enum(MAINTAINER_ACTION_KINDS);
export type MaintainerActionKind = z.infer<typeof maintainerActionKindSchema>;

export const ADMISSIBILITY_VALUES = ['evidence', 'signal'] as const;
export const admissibilitySchema = z.enum(ADMISSIBILITY_VALUES);
export type Admissibility = z.infer<typeof admissibilitySchema>;

export const REFERENCE_STATUSES = ['verified', 'unverified', 'fabricated'] as const;
export const referenceStatusSchema = z.enum(REFERENCE_STATUSES);
export type ReferenceStatus = z.infer<typeof referenceStatusSchema>;

export const FAILURE_CAUSES = [
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
] as const;
export const failureCauseSchema = z.enum(FAILURE_CAUSES);
export type FailureCause = z.infer<typeof failureCauseSchema>;

export const BUILT_IN_DISMISSAL_CODES = [
  'no-reproduction',
  'intended-behavior',
  'not-applicable-version',
  'unsupported-claim',
  'fabricated-reference',
  'duplicate',
  'out-of-scope',
  'insufficient-benefit',
  'proposal-required',
] as const;
export const builtInDismissalCodeSchema = z.enum(BUILT_IN_DISMISSAL_CODES);
export type BuiltInDismissalCode = z.infer<typeof builtInDismissalCodeSchema>;

export const LABEL_FAMILIES = ['status', 'classification'] as const;
export const labelFamilySchema = z.enum(LABEL_FAMILIES);
export type LabelFamily = z.infer<typeof labelFamilySchema>;
