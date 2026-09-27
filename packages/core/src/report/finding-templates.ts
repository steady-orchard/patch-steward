import type { ContractFindingCode } from '../submission/contract.js';
import { CONTRACT_FINDING_SEVERITIES } from '../submission/contract.js';
import type { SubmissionFieldId } from '../submission-fields.js';
import type { Category, SubmissionType } from '../vocabulary.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import type { PolicyChange } from '../submission/proposed-policy.js';
import type { SubmissionTemplateForm } from '../submission/field-mapping.js';
import { FIELD_MAPPING_REGISTRY } from '../submission/field-mapping.js';
import { CHANGED_PATHS_MAX } from '../policy/bounds.js';
import type { Result } from '../result.js';
import { err, ok } from '../result.js';
import { fillReportTemplate, reportCodeSpan, reportSubjectList } from './escape.js';

export const FINDING_TEMPLATES = Object.freeze({
  'submission.unstructured:issue-form': Object.freeze({
    scenario: 'The issue body does not match a supported issue form.',
    request: "Rewrite the issue with one of the repository's issue forms: {issueFormsUrl}",
  }),
  'submission.unstructured:pull-request-template': Object.freeze({
    scenario: 'The pull request description does not match a supported template version.',
    request: 'Rewrite the pull request description with the pull request template: {templateUrl}',
  }),
  'submission.field-duplicate': Object.freeze({
    scenario: 'The {label} section appears more than once.',
    request: 'Keep exactly one {label} section.',
  }),
  'submission.field-missing': Object.freeze({
    scenario: 'The required {label} section is absent or has no content.',
    request: 'Fill in the {label} section.',
  }),
  'submission.category-missing': Object.freeze({
    scenario: 'The "Category" section is absent or has no content.',
    request: 'Fill in the "Category" section with exactly one of `bugfix`, `feature`, `refactor`, `docs`, `chore`, `security`.',
  }),
  'submission.category-invalid': Object.freeze({
    scenario: 'The "Category" section does not name exactly one category.',
    request:
      'Replace the content of the "Category" section with exactly one of `bugfix`, `feature`, `refactor`, `docs`, `chore`, `security`.',
  }),
  'submission.linked-issue-missing': Object.freeze({
    scenario: 'The category {category} requires a linked issue, and none is named.',
    request: 'Name one issue of this repository in the "Linked issue" section, for example `#123`.',
  }),
  'submission.linked-issue-missing:free-form': Object.freeze({
    scenario: 'A linked issue is required, and none is named.',
    request: 'Use the pull request template and name one issue of this repository in its "Linked issue" section: {templateUrl}',
  }),
  'submission.linked-issue-invalid': Object.freeze({
    scenario: 'The "Linked issue" section does not name exactly one existing issue of this repository.',
    request:
      'Replace the content of the "Linked issue" section with exactly one existing issue of this repository, for example `#123`.',
  }),
  'submission.attachment-violation:count': Object.freeze({
    scenario: 'More than {limit} attachments are linked.',
    request: 'Link at most {limit} attachments.',
  }),
  'submission.attachment-violation:destination': Object.freeze({
    scenario: 'The attachment {url} is not on an approved attachment host.',
    request: 'Upload the file as a GitHub attachment instead of linking {url}.',
  }),
  'submission.attachment-violation:scheme': Object.freeze({
    scenario: 'The attachment {url} does not use HTTPS.',
    request: 'Upload the file as a GitHub attachment instead of linking {url}.',
  }),
  'submission.attachment-violation:userinfo': Object.freeze({
    scenario: 'The attachment {url} contains credentials in its address.',
    request: 'Remove {url} and upload the file as a GitHub attachment.',
  }),
  'submission.attachment-violation:format': Object.freeze({
    scenario: 'The attachment {url} has a format outside the allowed formats: {formats}.',
    request: 'Replace {url} with a file in an allowed format.',
  }),
  'submission.attachment-violation:file-bytes': Object.freeze({
    scenario: 'The attachment {url} exceeds the per-file size limit of {limit} bytes.',
    request: 'Replace {url} with a smaller file.',
  }),
  'submission.attachment-violation:total-bytes': Object.freeze({
    scenario: 'The attachments exceed the total size limit of {limit} bytes.',
    request: 'Reduce the total size of the attachments.',
  }),
  'submission.attachment-violation:redirects': Object.freeze({
    scenario: 'The attachment {url} redirects more than {limit} times.',
    request: 'Replace {url} with a direct GitHub attachment link.',
  }),
  'submission.attachment-violation:archive': Object.freeze({
    scenario: 'The archive {url} breaks an archive rule.',
    request: 'Replace {url} with plain files or an archive without encrypted, linked, or unsafe entries.',
  }),
  'submission.attachment-violation:decompressed-bytes': Object.freeze({
    scenario: 'The archive {url} expands beyond {limit} bytes.',
    request: 'Replace {url} with a smaller archive.',
  }),
  'submission.shared-head': Object.freeze({
    scenario: 'Open pull requests {prs} share this head commit, so no check on it can certify this pull request.',
    request: 'Push a distinct commit to this branch (an empty commit is enough), or close the other pull requests.',
  }),
  'submission.category-mismatch': Object.freeze({
    scenario: 'The declared category {category} is not consistent with the changed paths.',
    decision: 'decide the category; categories consistent with the changed paths: {categories}.',
  }),
  'submission.category-enforced-ambiguity': Object.freeze({
    scenario: 'The category is ambiguous, and a plausible category ({categories}) is under enforcement.',
    decision: 'decide the category before its enforced requirements apply.',
  }),
  'submission.execution-sensitive-change': Object.freeze({
    scenario: 'Execution-sensitive paths changed: {paths}.',
    decision: 'review these changes; test results from this pull request cannot be relied on until a maintainer does.',
  }),
  'submission.diff-too-large': Object.freeze({
    scenario: 'The diff exceeds {maxPaths} changed paths and cannot be classified.',
    decision: 'classify the change and review its trusted and execution-sensitive paths by hand.',
  }),
  'submission.attachment-unavailable': Object.freeze({
    note: 'The optional attachment {url} could not be fetched.',
  }),
  'submission.trusted-path-change': Object.freeze({
    note: 'Trusted paths changed ({paths}); results from pull-request-controlled CI cannot be relied on.',
  }),
  'submission.policy-change:revision': Object.freeze({
    note: 'The pull request proposes a policy change (proposed revision {revision}: {status}); the active policy still applies.',
  }),
  'submission.policy-change:status': Object.freeze({
    note: 'The pull request proposes a policy change (proposed revision: {status}); the active policy still applies.',
  }),
});

export interface FindingTemplateInput {
  readonly code: ContractFindingCode;
  readonly detail: string | null;
  readonly field: SubmissionFieldId | null;
  readonly subjects: readonly string[];
}

export interface FindingTemplateContext {
  readonly repository: string;
  readonly defaultBranch: string;
  readonly submissionType: SubmissionType;
  readonly template: { readonly form: SubmissionTemplateForm; readonly version: number } | null;
  readonly category: Category | null;
  readonly headCommit: string | null;
  readonly policy: ResolvedPolicy;
  readonly policyChange: PolicyChange | null;
}

export type FindingTexts =
  | { readonly kind: 'blocker'; readonly scenario: string; readonly location: string; readonly request: string }
  | { readonly kind: 'uncertainty'; readonly scenario: string; readonly location: string; readonly decision: string }
  | { readonly kind: 'note'; readonly note: string };

export type FindingTemplateFailureCode = 'report.template-missing';

const ATTACHMENT_LIMIT_RULES: Readonly<Record<string, keyof ResolvedPolicy['limits']['attachments']>> = {
  count: 'count',
  'file-bytes': 'file_bytes',
  'total-bytes': 'total_bytes',
  redirects: 'redirects',
  'decompressed-bytes': 'decompressed_bytes',
};

export function reportFieldLabel(
  field: SubmissionFieldId,
  submissionType: SubmissionType,
  template: FindingTemplateContext['template'],
): string {
  if (template !== null) {
    if (template.form === 'pull_request') {
      const mapping = FIELD_MAPPING_REGISTRY.pullRequest.find((candidate) => candidate.version === template.version);
      const section = mapping?.sections.find((s) => (s.id as SubmissionFieldId) === field);
      if (section !== undefined) {
        return section.heading;
      }
    } else {
      const mappings = FIELD_MAPPING_REGISTRY[template.form];
      const mapping = mappings.find((candidate) => candidate.version === template.version);
      const found = mapping?.fields.find((f) => f.id === field);
      if (found !== undefined) {
        return found.label;
      }
    }
  }
  if (submissionType === 'pull_request') {
    const mappings = FIELD_MAPPING_REGISTRY.pullRequest;
    const latest = mappings[mappings.length - 1];
    const section = latest?.sections.find((s) => (s.id as SubmissionFieldId) === field);
    if (section !== undefined) {
      return section.heading;
    }
    return field;
  }
  const defectMappings = FIELD_MAPPING_REGISTRY.defect;
  const defectLatest = defectMappings[defectMappings.length - 1];
  const defectField = defectLatest?.fields.find((f) => f.id === field);
  if (defectField !== undefined) {
    return defectField.label;
  }
  const proposalMappings = FIELD_MAPPING_REGISTRY.proposal;
  const proposalLatest = proposalMappings[proposalMappings.length - 1];
  const proposalField = proposalLatest?.fields.find((f) => f.id === field);
  if (proposalField !== undefined) {
    return proposalField.label;
  }
  return field;
}

export function findingTemplateKey(finding: FindingTemplateInput, ctx: FindingTemplateContext): string {
  if (finding.code === 'submission.unstructured' || finding.code === 'submission.attachment-violation') {
    return `${finding.code}:${finding.detail}`;
  }
  if (finding.code === 'submission.linked-issue-missing') {
    return finding.detail === 'free-form' ? `${finding.code}:free-form` : finding.code;
  }
  if (finding.code === 'submission.policy-change') {
    if (
      (finding.detail === 'valid' || finding.detail === 'invalid') &&
      ctx.policyChange?.proposed !== null &&
      ctx.policyChange?.proposed !== undefined &&
      ctx.policyChange.proposed.status === finding.detail &&
      'revision' in ctx.policyChange.proposed
    ) {
      return `${finding.code}:revision`;
    }
    return `${finding.code}:status`;
  }
  return finding.code;
}

function where(submissionType: SubmissionType): string {
  return submissionType === 'pull_request' ? 'pull request description' : 'issue body';
}

function location(finding: FindingTemplateInput, ctx: FindingTemplateContext): string {
  if (finding.code === 'submission.shared-head') {
    return 'head commit ' + reportCodeSpan(ctx.headCommit ?? '');
  }
  if (finding.code === 'submission.execution-sensitive-change') {
    return reportSubjectList(finding.subjects);
  }
  if (finding.field !== null) {
    return (
      'the "' + reportFieldLabel(finding.field, ctx.submissionType, ctx.template) + '" section of the ' + where(ctx.submissionType)
    );
  }
  return 'the ' + where(ctx.submissionType);
}

export function findingTexts(
  finding: FindingTemplateInput,
  ctx: FindingTemplateContext,
): Result<FindingTexts, FindingTemplateFailureCode> {
  const key = findingTemplateKey(finding, ctx);
  const entry = (FINDING_TEMPLATES as Record<string, { scenario?: string; request?: string; decision?: string; note?: string }>)[
    key
  ];
  if (entry === undefined) {
    return err('report.template-missing', 'steward-defect', 'No report template matches the finding.');
  }

  const severity = CONTRACT_FINDING_SEVERITIES[finding.code];

  try {
    const values: Record<string, string> = {};

    values.label = finding.field !== null ? '"' + reportFieldLabel(finding.field, ctx.submissionType, ctx.template) + '"' : '';

    if (finding.code === 'submission.unstructured') {
      values.issueFormsUrl = reportCodeSpan('https://github.com/' + ctx.repository + '/issues/new/choose');
      values.templateUrl = reportCodeSpan(
        'https://github.com/' + ctx.repository + '/blob/' + ctx.defaultBranch + '/.github/pull_request_template.md',
      );
    }
    if (finding.code === 'submission.linked-issue-missing') {
      values.templateUrl = reportCodeSpan(
        'https://github.com/' + ctx.repository + '/blob/' + ctx.defaultBranch + '/.github/pull_request_template.md',
      );
      if (finding.detail !== 'free-form') {
        if (ctx.category === null) {
          return err('report.template-missing', 'steward-defect', 'No report template matches the finding.');
        }
        values.category = reportCodeSpan(ctx.category);
      }
    }
    if (finding.code === 'submission.category-mismatch') {
      if (finding.detail === null) {
        return err('report.template-missing', 'steward-defect', 'No report template matches the finding.');
      }
      values.category = reportCodeSpan(finding.detail);
      values.categories = reportSubjectList(finding.subjects);
    }
    if (finding.code === 'submission.category-enforced-ambiguity') {
      values.categories = reportSubjectList(finding.subjects);
    }
    if (finding.code === 'submission.shared-head') {
      values.prs = reportSubjectList(finding.subjects);
    }
    if (finding.code === 'submission.execution-sensitive-change' || finding.code === 'submission.trusted-path-change') {
      values.paths = reportSubjectList(finding.subjects);
    }
    if (finding.code === 'submission.diff-too-large') {
      values.maxPaths = String(CHANGED_PATHS_MAX);
    }
    if (finding.code === 'submission.attachment-violation') {
      values.url = reportCodeSpan(finding.subjects[0] ?? '');
      const ruleKey = finding.detail ?? '';
      if (ruleKey === 'count') {
        values.limit = String(ctx.policy.limits.attachments.count);
      } else if (ruleKey === 'format') {
        values.formats = reportSubjectList(ctx.policy.submission.attachments.formats);
      } else {
        const limitKey = ATTACHMENT_LIMIT_RULES[ruleKey];
        if (limitKey !== undefined) {
          values.limit = String(ctx.policy.limits.attachments[limitKey]);
        }
      }
    }
    if (finding.code === 'submission.attachment-unavailable') {
      values.url = reportCodeSpan(finding.subjects[0] ?? '');
    }
    if (finding.code === 'submission.policy-change') {
      if (key === `${finding.code}:revision`) {
        const proposed = ctx.policyChange?.proposed;
        if (proposed === null || proposed === undefined || !('revision' in proposed)) {
          return err('report.template-missing', 'steward-defect', 'No report template matches the finding.');
        }
        values.revision = reportCodeSpan(proposed.revision);
        values.status = reportCodeSpan(finding.detail ?? 'unchecked');
      } else {
        values.status = reportCodeSpan(finding.detail ?? 'unchecked');
      }
    }

    if (severity === 'blocking') {
      if (entry.scenario === undefined || entry.request === undefined) {
        return err('report.template-missing', 'steward-defect', 'No report template matches the finding.');
      }
      return ok({
        kind: 'blocker',
        scenario: fillReportTemplate(entry.scenario, values),
        location: location(finding, ctx),
        request: fillReportTemplate(entry.request, values),
      });
    }
    if (severity === 'uncertain') {
      if (entry.scenario === undefined || entry.decision === undefined) {
        return err('report.template-missing', 'steward-defect', 'No report template matches the finding.');
      }
      return ok({
        kind: 'uncertainty',
        scenario: fillReportTemplate(entry.scenario, values),
        location: location(finding, ctx),
        decision: fillReportTemplate(entry.decision, values),
      });
    }
    if (entry.note === undefined) {
      return err('report.template-missing', 'steward-defect', 'No report template matches the finding.');
    }
    return ok({ kind: 'note', note: fillReportTemplate(entry.note, values) });
  } catch {
    return err('report.template-missing', 'steward-defect', 'No report template matches the finding.');
  }
}
