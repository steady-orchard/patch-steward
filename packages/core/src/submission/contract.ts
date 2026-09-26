import type { SubmissionFieldId } from '../submission-fields.js';
import { SUBMISSION_FIELD_IDS } from '../submission-fields.js';
import type { Category, FailureCause, FindingSeverity, IssueKind, Mode } from '../vocabulary.js';
import { CATEGORIES } from '../vocabulary.js';
import type { StewardFailure } from '../result.js';
import type { ContentHash } from '../hash.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import type { ParsedSubmissionBody } from './parse.js';
import type { LinkedIssueValue } from './field-values.js';
import { parseCategoryValue, parseLinkedIssueValue } from './field-values.js';
import type { PathFlags } from './paths.js';
import { changedPathSet, consistentCategories, detectPathFlags } from './paths.js';
import type { SubmissionTemplateForm } from './field-mapping.js';
import { FIELD_MAPPING_REGISTRY, INSTALLED_TEMPLATE_PATHS } from './field-mapping.js';
import type { GitHubChangedPaths } from '../github/reader.js';
import type { GitChangedPaths } from '../git/diff.js';
import type { AttachmentAssessmentSet } from './attachments.js';
import type { PolicyChange, ProposedPolicy } from './proposed-policy.js';

export const CONTRACT_FINDING_CODES = [
  'submission.unstructured',
  'submission.field-duplicate',
  'submission.field-missing',
  'submission.category-missing',
  'submission.category-invalid',
  'submission.linked-issue-missing',
  'submission.linked-issue-invalid',
  'submission.attachment-violation',
  'submission.shared-head',
  'submission.category-mismatch',
  'submission.category-enforced-ambiguity',
  'submission.execution-sensitive-change',
  'submission.diff-too-large',
  'submission.attachment-unavailable',
  'submission.trusted-path-change',
  'submission.policy-change',
] as const;

export type ContractFindingCode = (typeof CONTRACT_FINDING_CODES)[number];

export type ContractFindingSeverity = Extract<FindingSeverity, 'blocking' | 'uncertain' | 'advisory'>;

export const CONTRACT_FINDING_SEVERITIES: { readonly [K in ContractFindingCode]: ContractFindingSeverity } = Object.freeze({
  'submission.unstructured': 'blocking',
  'submission.field-duplicate': 'blocking',
  'submission.field-missing': 'blocking',
  'submission.category-missing': 'blocking',
  'submission.category-invalid': 'blocking',
  'submission.linked-issue-missing': 'blocking',
  'submission.linked-issue-invalid': 'blocking',
  'submission.attachment-violation': 'blocking',
  'submission.shared-head': 'blocking',
  'submission.category-mismatch': 'uncertain',
  'submission.category-enforced-ambiguity': 'uncertain',
  'submission.execution-sensitive-change': 'uncertain',
  'submission.diff-too-large': 'uncertain',
  'submission.attachment-unavailable': 'advisory',
  'submission.trusted-path-change': 'advisory',
  'submission.policy-change': 'advisory',
});

export const CONTRACT_FINDING_MESSAGES: { readonly [K in ContractFindingCode]: string } = Object.freeze({
  'submission.unstructured': 'The body does not follow a supported template version.',
  'submission.field-duplicate': 'A template field appears more than once.',
  'submission.field-missing': 'A required field is missing or trivial.',
  'submission.category-missing': 'The category field is missing or trivial.',
  'submission.category-invalid': 'The category field does not name exactly one category.',
  'submission.linked-issue-missing': 'A linked issue is required but none is named.',
  'submission.linked-issue-invalid': 'The linked issue is not exactly one existing issue in this repository.',
  'submission.attachment-violation': 'An attachment breaks an attachment rule.',
  'submission.shared-head': 'Another open pull request shares this head commit.',
  'submission.category-mismatch': 'The declared category is not consistent with the changed paths.',
  'submission.category-enforced-ambiguity': 'The category is ambiguous and a plausible category is enforced.',
  'submission.execution-sensitive-change': 'Execution-sensitive paths changed; maintainer triage is required.',
  'submission.diff-too-large': 'The diff is too large to classify; maintainer triage is required.',
  'submission.attachment-unavailable': 'An optional attachment could not be fetched.',
  'submission.trusted-path-change': 'Trusted paths changed; results from pull-request-controlled CI cannot be relied on.',
  'submission.policy-change': 'The pull request proposes a policy change; the active policy still applies.',
});

export const CONTRACT_DISPOSITIONS = ['met', 'needs-changes', 'uncertain', 'inconclusive'] as const;
export type ContractDisposition = (typeof CONTRACT_DISPOSITIONS)[number];

export interface ContractFinding {
  readonly code: ContractFindingCode;
  readonly severity: ContractFindingSeverity;
  readonly field: SubmissionFieldId | null;
  readonly detail: string | null;
  readonly subjects: readonly string[];
  readonly message: string;
}

export interface ContractRequest {
  readonly number: number;
  readonly code: ContractFindingCode;
  readonly field: SubmissionFieldId | null;
  readonly text: string;
}

export interface ContractInconclusive {
  readonly cause: FailureCause;
  readonly code: string;
  readonly message: string;
  readonly subjects: readonly string[];
}

export interface ContractWarning {
  readonly code: 'attachment.format-unverified';
  readonly subjects: readonly string[];
}

export interface ContractFlags {
  readonly trusted_paths_changed: boolean;
  readonly execution_sensitive_paths_changed: boolean;
  readonly policy_changed: boolean;
  readonly trusted_paths: readonly string[];
  readonly execution_sensitive_paths: readonly string[];
  readonly policy_paths: readonly string[];
  readonly policy_change: PolicyChange | null;
}

export interface ContractResult {
  readonly disposition: ContractDisposition;
  readonly findings: readonly ContractFinding[];
  readonly requests: readonly ContractRequest[];
  readonly inconclusive: readonly ContractInconclusive[];
  readonly warnings: readonly ContractWarning[];
  readonly enforced: boolean;
  readonly effective_mode: Mode;
  readonly category: Category | null;
  readonly plausible_categories: readonly Category[];
  readonly template: { readonly form: SubmissionTemplateForm; readonly version: number } | null;
  readonly flags: ContractFlags | null;
}

export interface ContractRepository {
  readonly fullName: string;
  readonly defaultBranch: string;
}

export type ContractChangedPaths = GitHubChangedPaths | GitChangedPaths;

export type LinkedIssueCheck =
  | { readonly status: 'exists'; readonly number: number; readonly contentHash: ContentHash }
  | { readonly status: 'not-found'; readonly number: number }
  | { readonly status: 'unavailable'; readonly number: number; readonly failure: StewardFailure }
  | { readonly status: 'not-checked' };

export type SharedHeadCheck =
  | { readonly status: 'known'; readonly pullRequests: readonly number[] }
  | { readonly status: 'not-applicable' }
  | { readonly status: 'unavailable'; readonly failure: StewardFailure };

export type ProposedPolicyCheck =
  | { readonly status: 'not-read' }
  | { readonly status: 'read'; readonly proposed: ProposedPolicy }
  | { readonly status: 'unavailable'; readonly failure: StewardFailure };

export interface IssueContractInput {
  readonly type: 'issue';
  readonly repository: ContractRepository;
  readonly policy: ResolvedPolicy;
  readonly body: ParsedSubmissionBody;
  readonly requestedKind: IssueKind | null;
  readonly attachments: AttachmentAssessmentSet;
}

export interface PullRequestContractInput {
  readonly type: 'pull_request';
  readonly repository: ContractRepository;
  readonly policy: ResolvedPolicy;
  readonly body: ParsedSubmissionBody;
  readonly changedPaths: ContractChangedPaths;
  readonly linkedIssue: LinkedIssueCheck;
  readonly sharedHeads: SharedHeadCheck;
  readonly proposedPolicy: ProposedPolicyCheck;
  readonly attachments: AttachmentAssessmentSet;
}

export type ContractInput = IssueContractInput | PullRequestContractInput;

export type ContractSubmissionShape =
  | { readonly type: 'issue'; readonly body: ParsedSubmissionBody; readonly requestedKind: IssueKind | null }
  | { readonly type: 'pull_request'; readonly body: ParsedSubmissionBody };

export function effectiveIssueBody(body: ParsedSubmissionBody, requestedKind: IssueKind | null): ParsedSubmissionBody {
  if (requestedKind !== null && body.structured && body.template.form !== requestedKind) {
    return { structured: false, reason: 'no-template-match' };
  }
  return body;
}

export function linkedIssueReference(body: ParsedSubmissionBody, repositoryFullName: string): LinkedIssueValue {
  if (body.structured && !body.duplicates.includes('linked-issue')) {
    return parseLinkedIssueValue(body.fields['linked-issue']?.raw, repositoryFullName);
  }
  return { status: 'absent' };
}

function declaredCategoryOf(body: ParsedSubmissionBody): Category | null {
  if (!body.structured || body.duplicates.includes('category')) {
    return null;
  }
  const value = parseCategoryValue(body.fields.category?.raw);
  return value.status === 'valid' ? value.category : null;
}

export function contractRequiredFields(policy: ResolvedPolicy, submission: ContractSubmissionShape): readonly SubmissionFieldId[] {
  if (submission.type === 'issue') {
    const body = effectiveIssueBody(submission.body, submission.requestedKind);
    if (body.structured) {
      return policy.submission.issue_fields[body.template.form as 'defect' | 'proposal'];
    }
    return [];
  }
  const declared = declaredCategoryOf(submission.body);
  return declared !== null ? policy.categories[declared].required_fields : [];
}

type ContractTemplate = { readonly form: SubmissionTemplateForm; readonly version: number } | null;

function label(template: ContractTemplate, id: SubmissionFieldId | null): string {
  if (template === null || id === null) {
    return id ?? '';
  }
  if (template.form === 'pull_request') {
    const mapping = FIELD_MAPPING_REGISTRY.pullRequest.find((candidate) => candidate.version === template.version);
    const section = mapping?.sections.find((s) => (s.id as SubmissionFieldId) === id);
    return section?.heading ?? id;
  }
  const mappings = FIELD_MAPPING_REGISTRY[template.form];
  const mapping = mappings.find((candidate) => candidate.version === template.version);
  const field = mapping?.fields.find((f) => f.id === id);
  return field?.label ?? id;
}

function prLink(fullName: string, defaultBranch: string): string {
  const branchPath = defaultBranch
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://github.com/${fullName}/blob/${branchPath}/${INSTALLED_TEMPLATE_PATHS.pull_request}`;
}

const MODE_RANK: Record<Mode, number> = { observe: 0, advise: 1, enforce: 2 };

function modeOf(policy: ResolvedPolicy, category: Category): Mode {
  return policy.modes.per_category[category] ?? policy.modes.default;
}

function strictestMode(modes: readonly Mode[]): Mode {
  let best: Mode = 'observe';
  for (const mode of modes) {
    if (MODE_RANK[mode] > MODE_RANK[best]) {
      best = mode;
    }
  }
  return best;
}

function pushFinding(
  findings: ContractFinding[],
  code: ContractFindingCode,
  field: SubmissionFieldId | null,
  detail: string | null,
  subjects: readonly string[] = [],
): void {
  findings.push({
    code,
    severity: CONTRACT_FINDING_SEVERITIES[code],
    field,
    detail,
    subjects,
    message: CONTRACT_FINDING_MESSAGES[code],
  });
}

function processAttachments(
  set: AttachmentAssessmentSet,
  findings: ContractFinding[],
  inconclusive: ContractInconclusive[],
  warnings: ContractWarning[],
): void {
  if (set.countExceeded) {
    pushFinding(findings, 'submission.attachment-violation', null, 'count');
  }
  for (const item of set.items) {
    if (item.status === 'violation') {
      pushFinding(findings, 'submission.attachment-violation', item.fields[0] ?? null, item.rule, [item.url]);
    } else if (item.status === 'unavailable') {
      if (item.required) {
        inconclusive.push({
          cause: 'attachment-fetch-failed',
          code: 'attachment.fetch-failed',
          message: 'A required attachment could not be fetched.',
          subjects: [item.url],
        });
      } else {
        pushFinding(findings, 'submission.attachment-unavailable', item.fields[0] ?? null, item.reason, [item.url]);
      }
    } else if (item.status === 'pending' && item.format === null) {
      warnings.push({ code: 'attachment.format-unverified', subjects: [item.url] });
    }
  }
}

function sortFindings(findings: readonly ContractFinding[]): readonly ContractFinding[] {
  return [...findings].sort((a, b) => {
    const ai = CONTRACT_FINDING_CODES.indexOf(a.code);
    const bi = CONTRACT_FINDING_CODES.indexOf(b.code);
    if (ai !== bi) {
      return ai - bi;
    }
    const af = a.field === null ? -1 : SUBMISSION_FIELD_IDS.indexOf(a.field);
    const bf = b.field === null ? -1 : SUBMISSION_FIELD_IDS.indexOf(b.field);
    if (af !== bf) {
      return af - bf;
    }
    const as = a.subjects[0] ?? '';
    const bs = b.subjects[0] ?? '';
    return as < bs ? -1 : as > bs ? 1 : 0;
  });
}

function computeDisposition(
  findings: readonly ContractFinding[],
  inconclusive: readonly ContractInconclusive[],
): ContractDisposition {
  if (findings.some((f) => f.code === 'submission.shared-head')) {
    return 'needs-changes';
  }
  if (findings.some((f) => f.severity === 'blocking')) {
    return 'needs-changes';
  }
  if (inconclusive.length > 0) {
    return 'inconclusive';
  }
  if (findings.some((f) => f.severity === 'uncertain')) {
    return 'uncertain';
  }
  return 'met';
}

interface RequestContext {
  readonly fullName: string;
  readonly defaultBranch: string;
  readonly template: ContractTemplate;
  readonly where: string;
  readonly attachmentsLimit: number;
}

function requestText(finding: ContractFinding, ctx: RequestContext): string {
  switch (finding.code) {
    case 'submission.unstructured':
      return finding.detail === 'issue-form'
        ? `Rewrite the issue using one of the repository's issue forms: https://github.com/${ctx.fullName}/issues/new/choose`
        : `Rewrite the pull request description using the pull request template: ${prLink(ctx.fullName, ctx.defaultBranch)}`;
    case 'submission.field-duplicate':
      return `Keep exactly one "${label(ctx.template, finding.field)}" section in the ${ctx.where}.`;
    case 'submission.field-missing':
      return `Fill in the "${label(ctx.template, finding.field)}" section of the ${ctx.where}.`;
    case 'submission.category-missing':
      return 'Fill in the "Category" section of the pull request description with exactly one of: bugfix, feature, refactor, docs, chore, security.';
    case 'submission.category-invalid':
      return 'Replace the "Category" section of the pull request description with exactly one of: bugfix, feature, refactor, docs, chore, security.';
    case 'submission.linked-issue-missing':
      return finding.detail === 'free-form'
        ? `Use the pull request template and name one issue in this repository in its "Linked issue" section: ${prLink(ctx.fullName, ctx.defaultBranch)}`
        : 'Name one issue in this repository in the "Linked issue" section of the pull request description, for example #123.';
    case 'submission.linked-issue-invalid':
      return 'Replace the "Linked issue" section of the pull request description with exactly one existing issue in this repository, for example #123.';
    case 'submission.attachment-violation':
      if (finding.detail === 'count') {
        return `Link at most ${ctx.attachmentsLimit} attachments in the ${ctx.where}.`;
      }
      if (finding.field !== null) {
        return `Replace or remove the attachment that breaks the "${finding.detail}" attachment rule in the "${label(ctx.template, finding.field)}" section of the ${ctx.where}.`;
      }
      return `Replace or remove the attachment that breaks the "${finding.detail}" attachment rule in the ${ctx.where}.`;
    case 'submission.shared-head':
      return `Another open pull request uses the same head commit (${finding.subjects.join(', ')}); push a distinct commit to this branch or close the other pull requests.`;
    default:
      return finding.message;
  }
}

function buildRequests(findings: readonly ContractFinding[], ctx: RequestContext): readonly ContractRequest[] {
  const requests: ContractRequest[] = [];
  let n = 1;
  for (const finding of findings) {
    if (finding.severity !== 'blocking') {
      continue;
    }
    requests.push({ number: n, code: finding.code, field: finding.field, text: requestText(finding, ctx) });
    n += 1;
  }
  return requests;
}

function checkIssueContract(input: IssueContractInput): ContractResult {
  const findings: ContractFinding[] = [];
  const inconclusive: ContractInconclusive[] = [];
  const warnings: ContractWarning[] = [];

  const body = effectiveIssueBody(input.body, input.requestedKind);
  const template: ContractTemplate = body.structured ? body.template : null;
  const freeForm = input.policy.submission.free_form;

  if (!body.structured) {
    if (!freeForm) {
      pushFinding(findings, 'submission.unstructured', null, 'issue-form');
    }
  } else {
    for (const id of body.duplicates) {
      pushFinding(findings, 'submission.field-duplicate', id, null);
    }
    const ids = input.policy.submission.issue_fields[body.template.form as 'defect' | 'proposal'];
    for (const id of ids) {
      if (body.duplicates.includes(id)) {
        continue;
      }
      const field = body.fields[id];
      const missing = field === undefined || (id !== 'security-claim' && field.trivial);
      if (missing) {
        pushFinding(findings, 'submission.field-missing', id, null);
      }
    }
  }

  processAttachments(input.attachments, findings, inconclusive, warnings);

  const sorted = sortFindings(findings);
  const disposition = computeDisposition(sorted, inconclusive);
  const requests = buildRequests(sorted, {
    fullName: input.repository.fullName,
    defaultBranch: input.repository.defaultBranch,
    template,
    where: 'issue body',
    attachmentsLimit: input.attachments.limit,
  });

  return {
    disposition,
    findings: sorted,
    requests,
    inconclusive,
    warnings,
    enforced: false,
    effective_mode: input.policy.modes.default,
    category: null,
    plausible_categories: [],
    template,
    flags: null,
  };
}

function checkPullRequestContract(input: PullRequestContractInput): ContractResult {
  const findings: ContractFinding[] = [];
  const inconclusive: ContractInconclusive[] = [];
  const warnings: ContractWarning[] = [];
  const policy = input.policy;
  const body = input.body;
  const template: ContractTemplate = body.structured ? body.template : null;
  const freeForm = policy.submission.free_form;
  const fullName = input.repository.fullName;

  if (!body.structured) {
    if (!freeForm) {
      pushFinding(findings, 'submission.unstructured', null, 'pull-request-template');
    }
  } else {
    for (const id of body.duplicates) {
      pushFinding(findings, 'submission.field-duplicate', id, null);
    }
  }

  let declared: Category | null = null;
  if (body.structured && !body.duplicates.includes('category')) {
    const value = parseCategoryValue(body.fields.category?.raw);
    if (value.status === 'missing') {
      pushFinding(findings, 'submission.category-missing', 'category', null);
    } else if (value.status === 'invalid') {
      pushFinding(findings, 'submission.category-invalid', 'category', null);
    } else {
      declared = value.category;
    }
  }

  const tooLarge = input.changedPaths.kind === 'too-large';
  let consistent: readonly Category[] = [];
  let pathFlags: PathFlags = { trusted: [], executionSensitive: [], policy: [] };
  if (tooLarge) {
    pushFinding(findings, 'submission.diff-too-large', null, null);
  } else {
    const paths = changedPathSet(input.changedPaths.changes);
    consistent = consistentCategories(paths);
    pathFlags = detectPathFlags(paths, {
      trusted: policy.trusted_paths.additional,
      executionSensitive: policy.execution_sensitive_paths.additional,
    });
  }

  const mismatch = !tooLarge && declared !== null && !consistent.includes(declared);
  if (mismatch) {
    pushFinding(findings, 'submission.category-mismatch', 'category', declared, consistent);
  }

  const ambiguous = declared === null || mismatch;
  const plausible = tooLarge ? [...CATEGORIES] : CATEGORIES.filter((c) => consistent.includes(c) || c === declared);
  const pool = plausible.length > 0 ? plausible : [...CATEGORIES];

  const effectiveMode = strictestMode(pool.map((c) => modeOf(policy, c)));
  const enforced = effectiveMode === 'enforce';
  if (ambiguous && enforced) {
    const subjects = pool.filter((c) => modeOf(policy, c) === 'enforce');
    pushFinding(findings, 'submission.category-enforced-ambiguity', 'category', null, subjects);
  }

  if (body.structured && declared !== null) {
    for (const id of policy.categories[declared].required_fields) {
      if (id === 'category' || id === 'linked-issue') {
        continue;
      }
      if (body.duplicates.includes(id)) {
        continue;
      }
      const field = body.fields[id];
      const missing = field === undefined || field.trivial;
      if (missing) {
        pushFinding(findings, 'submission.field-missing', id, null);
      }
    }
  }

  let linkageRequired: boolean;
  if (declared !== null) {
    linkageRequired =
      policy.categories[declared].linked_issue === 'required' ||
      policy.categories[declared].required_fields.includes('linked-issue');
  } else {
    linkageRequired = !body.structured && freeForm && pool.some((c) => policy.categories[c].linked_issue === 'required');
  }

  const linkedIssueDuplicated = body.structured && body.duplicates.includes('linked-issue');
  if (!linkedIssueDuplicated) {
    const lv = linkedIssueReference(body, fullName);
    if (lv.status === 'absent') {
      if (linkageRequired) {
        const detail = !body.structured ? 'free-form' : null;
        pushFinding(findings, 'submission.linked-issue-missing', 'linked-issue', detail);
      }
    } else if (lv.status === 'invalid') {
      pushFinding(findings, 'submission.linked-issue-invalid', 'linked-issue', lv.reason);
    } else {
      const li = input.linkedIssue;
      if (li.status === 'exists' && li.number === lv.number) {
        // nothing: linked issue confirmed
      } else if (li.status === 'not-found' && li.number === lv.number) {
        pushFinding(findings, 'submission.linked-issue-invalid', 'linked-issue', 'not-an-issue');
      } else if (li.status === 'unavailable' && li.number === lv.number) {
        inconclusive.push({
          cause: li.failure.cause,
          code: li.failure.code,
          message: li.failure.message,
          subjects: [`#${lv.number}`],
        });
      } else {
        inconclusive.push({
          cause: 'steward-defect',
          code: 'contract.linked-issue-unchecked',
          message: 'The linked issue was not checked.',
          subjects: [],
        });
      }
    }
  }

  if (input.sharedHeads.status === 'known') {
    if (input.sharedHeads.pullRequests.length > 0) {
      const subjects = [...input.sharedHeads.pullRequests].sort((a, b) => a - b).map((n) => `#${n}`);
      pushFinding(findings, 'submission.shared-head', null, null, subjects);
    }
  } else if (input.sharedHeads.status === 'unavailable') {
    inconclusive.push({
      cause: input.sharedHeads.failure.cause,
      code: input.sharedHeads.failure.code,
      message: input.sharedHeads.failure.message,
      subjects: [],
    });
  }

  let flags: ContractFlags;
  if (tooLarge) {
    flags = {
      trusted_paths_changed: true,
      execution_sensitive_paths_changed: true,
      policy_changed: false,
      trusted_paths: [],
      execution_sensitive_paths: [],
      policy_paths: [],
      policy_change: null,
    };
  } else {
    if (pathFlags.executionSensitive.length > 0) {
      pushFinding(findings, 'submission.execution-sensitive-change', null, null, pathFlags.executionSensitive);
    }
    if (pathFlags.trusted.length > 0) {
      pushFinding(findings, 'submission.trusted-path-change', null, null, pathFlags.trusted);
    }
    let policyChange: PolicyChange;
    if (pathFlags.policy.length > 0) {
      if (input.proposedPolicy.status === 'read') {
        pushFinding(findings, 'submission.policy-change', null, input.proposedPolicy.proposed.status, pathFlags.policy);
        policyChange = { changed: true, proposed: input.proposedPolicy.proposed };
      } else if (input.proposedPolicy.status === 'unavailable') {
        pushFinding(findings, 'submission.policy-change', null, 'unavailable', pathFlags.policy);
        inconclusive.push({
          cause: input.proposedPolicy.failure.cause,
          code: input.proposedPolicy.failure.code,
          message: input.proposedPolicy.failure.message,
          subjects: pathFlags.policy,
        });
        policyChange = { changed: true, proposed: null };
      } else {
        pushFinding(findings, 'submission.policy-change', null, null, pathFlags.policy);
        inconclusive.push({
          cause: 'steward-defect',
          code: 'contract.policy-change-unchecked',
          message: 'The proposed policy was not read.',
          subjects: pathFlags.policy,
        });
        policyChange = { changed: true, proposed: null };
      }
    } else {
      policyChange = { changed: false, proposed: null };
    }
    flags = {
      trusted_paths_changed: pathFlags.trusted.length > 0,
      execution_sensitive_paths_changed: pathFlags.executionSensitive.length > 0,
      policy_changed: pathFlags.policy.length > 0,
      trusted_paths: pathFlags.trusted,
      execution_sensitive_paths: pathFlags.executionSensitive,
      policy_paths: pathFlags.policy,
      policy_change: policyChange,
    };
  }

  processAttachments(input.attachments, findings, inconclusive, warnings);

  const sorted = sortFindings(findings);
  const disposition = computeDisposition(sorted, inconclusive);
  const requests = buildRequests(sorted, {
    fullName,
    defaultBranch: input.repository.defaultBranch,
    template,
    where: 'pull request description',
    attachmentsLimit: input.attachments.limit,
  });

  return {
    disposition,
    findings: sorted,
    requests,
    inconclusive,
    warnings,
    enforced,
    effective_mode: effectiveMode,
    category: declared,
    plausible_categories: pool,
    template,
    flags,
  };
}

export function checkContract(input: ContractInput): ContractResult {
  return input.type === 'issue' ? checkIssueContract(input) : checkPullRequestContract(input);
}
