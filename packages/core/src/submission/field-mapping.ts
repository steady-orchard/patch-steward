import { z } from 'zod';
import type { SubmissionFieldId, PullRequestFieldId } from '../submission-fields.js';

export const SUBMISSION_TEMPLATE_FORMS = ['defect', 'proposal', 'pull_request'] as const;
export const submissionTemplateFormSchema = z.enum(SUBMISSION_TEMPLATE_FORMS);
export type SubmissionTemplateForm = z.infer<typeof submissionTemplateFormSchema>;

export const ISSUE_FORM_ELEMENT_TYPES = ['textarea', 'input', 'checkboxes'] as const;
export type IssueFormElementType = (typeof ISSUE_FORM_ELEMENT_TYPES)[number];

export interface IssueFormFieldMapping {
  readonly id: SubmissionFieldId;
  readonly label: string;
  readonly element: IssueFormElementType;
  readonly required: boolean;
}

export interface IssueFormMapping {
  readonly form: 'defect' | 'proposal';
  readonly version: number;
  readonly fields: readonly IssueFormFieldMapping[];
}

export interface PullRequestSectionMapping {
  readonly id: PullRequestFieldId;
  readonly heading: string;
}

export interface PullRequestTemplateMapping {
  readonly version: number;
  readonly sections: readonly PullRequestSectionMapping[];
}

export interface FieldMappingRegistry {
  readonly defect: readonly IssueFormMapping[];
  readonly proposal: readonly IssueFormMapping[];
  readonly pullRequest: readonly PullRequestTemplateMapping[];
}

function freezeField(field: IssueFormFieldMapping): IssueFormFieldMapping {
  return Object.freeze(field);
}

function freezeSection(section: PullRequestSectionMapping): PullRequestSectionMapping {
  return Object.freeze(section);
}

function freezeIssueFormMapping(mapping: IssueFormMapping): IssueFormMapping {
  Object.freeze(mapping.fields);
  return Object.freeze(mapping);
}

function freezePullRequestTemplateMapping(mapping: PullRequestTemplateMapping): PullRequestTemplateMapping {
  Object.freeze(mapping.sections);
  return Object.freeze(mapping);
}

export const DEFECT_FORM_MAPPING_V1: IssueFormMapping = freezeIssueFormMapping({
  form: 'defect',
  version: 1,
  fields: [
    freezeField({ id: 'expected-behavior', label: 'Expected behavior', element: 'textarea', required: true }),
    freezeField({ id: 'authoritative-basis', label: 'Authoritative basis', element: 'textarea', required: true }),
    freezeField({ id: 'actual-behavior', label: 'Actual behavior', element: 'textarea', required: true }),
    freezeField({ id: 'affected-version', label: 'Affected version', element: 'input', required: true }),
    freezeField({ id: 'reproduction-command', label: 'Reproduction command', element: 'textarea', required: true }),
    freezeField({ id: 'expected-result', label: 'Expected result', element: 'textarea', required: true }),
    freezeField({ id: 'proposed-scope', label: 'Proposed scope', element: 'textarea', required: false }),
    freezeField({ id: 'references', label: 'References', element: 'textarea', required: false }),
    freezeField({ id: 'security-claim', label: 'Security claim', element: 'checkboxes', required: false }),
  ],
});

export const PROPOSAL_FORM_MAPPING_V1: IssueFormMapping = freezeIssueFormMapping({
  form: 'proposal',
  version: 1,
  fields: [
    freezeField({ id: 'problem', label: 'Problem', element: 'textarea', required: true }),
    freezeField({ id: 'benefit', label: 'Benefit', element: 'textarea', required: true }),
    freezeField({ id: 'existing-decision', label: 'Existing decision', element: 'textarea', required: false }),
    freezeField({ id: 'proposed-scope', label: 'Proposed scope', element: 'textarea', required: true }),
    freezeField({ id: 'references', label: 'References', element: 'textarea', required: false }),
  ],
});

export const PULL_REQUEST_TEMPLATE_MAPPING_V1: PullRequestTemplateMapping = freezePullRequestTemplateMapping({
  version: 1,
  sections: [
    freezeSection({ id: 'category', heading: 'Category' }),
    freezeSection({ id: 'problem', heading: 'Problem' }),
    freezeSection({ id: 'benefit', heading: 'Benefit' }),
    freezeSection({ id: 'intended-behavior', heading: 'Intended behavior' }),
    freezeSection({ id: 'acceptance-criteria', heading: 'Acceptance criteria' }),
    freezeSection({ id: 'linked-issue', heading: 'Linked issue' }),
    freezeSection({ id: 'regression-test', heading: 'Regression test' }),
    freezeSection({ id: 'test-scaffolding', heading: 'Test scaffolding' }),
    freezeSection({ id: 'reproduction-command', heading: 'Reproduction command' }),
    freezeSection({ id: 'expected-result', heading: 'Expected result' }),
    freezeSection({ id: 'references', heading: 'References' }),
  ],
});

export const FIELD_MAPPING_REGISTRY: FieldMappingRegistry = Object.freeze({
  defect: Object.freeze([DEFECT_FORM_MAPPING_V1]),
  proposal: Object.freeze([PROPOSAL_FORM_MAPPING_V1]),
  pullRequest: Object.freeze([PULL_REQUEST_TEMPLATE_MAPPING_V1]),
});

export const SECURITY_CLAIM_OPTION_LABEL = 'This report claims a security problem';

export const PULL_REQUEST_TEMPLATE_MARKER_PATTERN = /^<!-- patch-steward:pr-template v([1-9][0-9]*) -->$/;

export function pullRequestTemplateMarker(version: number): string {
  return `<!-- patch-steward:pr-template v${version} -->`;
}

export function normalizeTemplateLabel(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

export const INSTALLED_TEMPLATE_PATHS = {
  defect: '.github/ISSUE_TEMPLATE/steward-defect.yml',
  proposal: '.github/ISSUE_TEMPLATE/steward-proposal.yml',
  pull_request: '.github/pull_request_template.md',
} as const;
