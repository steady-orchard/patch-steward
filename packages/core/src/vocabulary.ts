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

export const GATE_DISPOSITIONS = ['runnable', 'early-exit', 'queued', 'duplicate', 'closure'] as const;
export const gateDispositionSchema = z.enum(GATE_DISPOSITIONS);
export type GateDisposition = z.infer<typeof gateDispositionSchema>;

export const OWNERSHIP_DISPOSITIONS = ['runnable', 'early-exit', 'queued'] as const;
export const ownershipDispositionSchema = z.enum(OWNERSHIP_DISPOSITIONS);
export type OwnershipDisposition = z.infer<typeof ownershipDispositionSchema>;

export const CAP_STATES = ['within', 'daily-runs', 'per-author-concurrent-runs'] as const;
export const capStateSchema = z.enum(CAP_STATES);
export type CapState = z.infer<typeof capStateSchema>;

export const WAITING_REASONS = ['daily-runs', 'per-author-concurrent-runs'] as const;
export const waitingReasonSchema = z.enum(WAITING_REASONS);
export type WaitingReason = z.infer<typeof waitingReasonSchema>;

export const SUPERSESSION_REASONS = ['newer-owner', 'snapshot-changed'] as const;
export const supersessionReasonSchema = z.enum(SUPERSESSION_REASONS);
export type SupersessionReason = z.infer<typeof supersessionReasonSchema>;

export const RESOLUTION_KINDS = ['merged', 'closed-by-author', 'closed-by-maintainer', 'deleted'] as const;
export const resolutionKindSchema = z.enum(RESOLUTION_KINDS);
export type ResolutionKind = z.infer<typeof resolutionKindSchema>;

export const RUN_KINDS = ['outcome', 'waiting'] as const;
export const runKindSchema = z.enum(RUN_KINDS);
export type RunKind = z.infer<typeof runKindSchema>;

export const WRAPPER_EVENT_NAMES = ['pull_request_target', 'issues'] as const;
export const wrapperEventNameSchema = z.enum(WRAPPER_EVENT_NAMES);
export type WrapperEventName = z.infer<typeof wrapperEventNameSchema>;

export const PULL_REQUEST_EVENT_ACTIONS = ['opened', 'synchronize', 'edited', 'reopened', 'ready_for_review', 'closed'] as const;
export const pullRequestEventActionSchema = z.enum(PULL_REQUEST_EVENT_ACTIONS);
export type PullRequestEventAction = z.infer<typeof pullRequestEventActionSchema>;

export const ISSUE_EVENT_ACTIONS = ['opened', 'edited', 'reopened', 'closed', 'deleted'] as const;
export const issueEventActionSchema = z.enum(ISSUE_EVENT_ACTIONS);
export type IssueEventAction = z.infer<typeof issueEventActionSchema>;

export const SENDER_TYPES = ['User', 'Bot', 'Organization', 'Mannequin'] as const;
export const senderTypeSchema = z.enum(SENDER_TYPES);
export type SenderType = z.infer<typeof senderTypeSchema>;
