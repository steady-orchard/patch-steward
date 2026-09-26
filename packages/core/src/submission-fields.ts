import { z } from 'zod';

export const DEFECT_ISSUE_FIELD_IDS = [
  'expected-behavior',
  'authoritative-basis',
  'actual-behavior',
  'affected-version',
  'reproduction-command',
  'expected-result',
  'proposed-scope',
  'references',
  'security-claim',
] as const;

export const PROPOSAL_ISSUE_FIELD_IDS = ['problem', 'benefit', 'existing-decision', 'proposed-scope', 'references'] as const;

export const PULL_REQUEST_FIELD_IDS = [
  'category',
  'problem',
  'benefit',
  'intended-behavior',
  'acceptance-criteria',
  'linked-issue',
  'regression-test',
  'test-scaffolding',
  'reproduction-command',
  'expected-result',
  'references',
] as const;

export const SUBMISSION_FIELD_IDS = [
  'expected-behavior',
  'authoritative-basis',
  'actual-behavior',
  'affected-version',
  'reproduction-command',
  'expected-result',
  'proposed-scope',
  'references',
  'security-claim',
  'problem',
  'benefit',
  'existing-decision',
  'category',
  'intended-behavior',
  'acceptance-criteria',
  'linked-issue',
  'regression-test',
  'test-scaffolding',
] as const;

export const defectIssueFieldIdSchema = z.enum(DEFECT_ISSUE_FIELD_IDS);
export type DefectIssueFieldId = z.infer<typeof defectIssueFieldIdSchema>;

export const proposalIssueFieldIdSchema = z.enum(PROPOSAL_ISSUE_FIELD_IDS);
export type ProposalIssueFieldId = z.infer<typeof proposalIssueFieldIdSchema>;

export const pullRequestFieldIdSchema = z.enum(PULL_REQUEST_FIELD_IDS);
export type PullRequestFieldId = z.infer<typeof pullRequestFieldIdSchema>;

export const submissionFieldIdSchema = z.enum(SUBMISSION_FIELD_IDS);
export type SubmissionFieldId = z.infer<typeof submissionFieldIdSchema>;
