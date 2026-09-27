import type { Category, FailureCause, IssueKind, Outcome, SubmissionType } from '../vocabulary.js';
import type { RecordCause } from '../records/decision.js';

import { fillReportTemplate, reportCodeSpan, reportSubjectList } from './escape.js';

export const REPORT_TITLE = '## Patch Steward screening report';

export const REPORT_SECTIONS = [
  'classification',
  'blockers',
  'uncertainties',
  'executed-commands',
  'references',
  'flagged',
  'what-would-change',
  'provenance',
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];

export const REPORT_SECTION_HEADINGS: Readonly<Record<ReportSection, string>> = Object.freeze({
  classification: '### Classification',
  blockers: '### Blockers',
  uncertainties: '### Uncertainties for maintainers',
  'executed-commands': '### Executed commands and results',
  references: '### References',
  flagged: '### Flagged automated activity',
  'what-would-change': '### What would change the outcome',
  provenance: '### Provenance',
});

export const REPORT_EMPTY_SECTION_LINE = '- None.';

export const REPORT_OVERFLOW_NOUNS: Readonly<Record<Exclude<ReportSection, 'provenance'>, string>> = Object.freeze({
  classification: 'notes',
  blockers: 'blockers',
  uncertainties: 'uncertainties',
  'executed-commands': 'executed commands',
  references: 'references',
  flagged: 'flagged items',
  'what-would-change': 'items',
});

export const REPORT_OVERFLOW_TEMPLATE = '- {count} more {noun} are recorded in the evidence: {location}.';

export const REPORT_LOCAL_RUN_NOTICE =
  "Local run: produced on a maintainer's machine; not the repository's official screening result.";

export const REPORT_NON_AUTHORITATIVE_NOTICE_TEMPLATE =
  "Non-authoritative: screened under the local policy file revision {revision}, not the trusted branch's policy.";

export const REPORT_HEADER_TEMPLATES = Object.freeze({
  outcome: '- Outcome: {outcome}',
  causes: '- Inconclusive causes: {causes}',
  issue: '- Submission: {repository} issue {number}',
  pullRequest: '- Submission: {repository} pull request {number}',
  snapshot: '- Snapshot: {snapshot}',
  targetBranch: '- Target branch: {ref}',
  headCommit: '- Head commit: {commit}',
  baseCommit: '- Base commit tested: {commit}',
  policyRevision: '- Policy revision: {revision}',
  run: '- Run: {runId} attempt {attempt}',
});

export const CLASSIFICATION_TEMPLATES = Object.freeze({
  defect: 'Form: "defect". {claim}',
  proposal: 'Form: "proposal". {claim}',
  unstructured: 'Form: none (unstructured). {claim}',
  category: 'Category: {category}. {claim}',
  undetermined: 'Category: not determined; plausible: {categories}. {claim}',
  claim: 'Claim classification: not determined; claim validation did not run.',
});

export const OUTCOME_CHANGE_LINES: Readonly<Record<Outcome, string>> = Object.freeze({
  pass: 'A change to the submission or the policy starts a new screening.',
  'needs-changes': 'Completing each numbered request changes this outcome.',
  uncertain: 'A maintainer decision on each item under "Uncertainties for maintainers" changes this outcome.',
  inconclusive: 'Required work did not complete; the causes below explain what changes this outcome.',
  overridden: 'The recorded maintainer action determines this outcome.',
  superseded: "The replacement run's report applies.",
});

export const CAUSE_TEMPLATES: Readonly<Record<FailureCause, { readonly text: string; readonly remedy: string }>> = Object.freeze({
  infrastructure: Object.freeze({
    text: 'An infrastructure failure stopped required work.',
    remedy: 'Rerun after the failure is resolved.',
  }),
  'github-unavailable': Object.freeze({ text: 'GitHub could not be read.', remedy: 'Rerun when GitHub is reachable.' }),
  'model-unavailable': Object.freeze({
    text: 'The configured model could not be reached.',
    remedy: 'Rerun when the model is available.',
  }),
  'model-retired': Object.freeze({ text: 'The configured model id is retired.', remedy: 'Select a current model in the policy.' }),
  'credential-unusable': Object.freeze({
    text: 'The model credential is missing or unusable.',
    remedy: 'Provide a usable credential for the configured adapter.',
  }),
  'capability-mismatch': Object.freeze({
    text: 'The configured model lacks a required capability.',
    remedy: 'Select a model with the required capabilities.',
  }),
  'model-refusal': Object.freeze({
    text: 'The model declined a required request.',
    remedy: 'Rerun; a maintainer triages a repeat.',
  }),
  'malformed-output': Object.freeze({
    text: 'Model output failed validation after the allowed repairs.',
    remedy: 'Rerun; a maintainer triages a repeat.',
  }),
  'rate-limited': Object.freeze({
    text: 'A rate limit was reached after the allowed retries.',
    remedy: 'Rerun after the limit resets.',
  }),
  'budget-exhausted': Object.freeze({
    text: 'A run budget was exhausted before required work finished.',
    remedy: 'Rerun; a maintainer may raise the policy limit within its bound.',
  }),
  'environment-unavailable': Object.freeze({
    text: 'The execution environment was unavailable.',
    remedy: 'Rerun when the environment is available.',
  }),
  'baseline-unavailable': Object.freeze({
    text: 'A required baseline result was unavailable.',
    remedy: 'Rerun after the baseline is available.',
  }),
  'coverage-missing': Object.freeze({
    text: 'Required platform coverage is missing.',
    remedy: 'Provide the required platform coverage.',
  }),
  'attachment-fetch-failed': Object.freeze({
    text: 'A required attachment could not be fetched: {urls}.',
    remedy: 'Link the file as a GitHub attachment that can be fetched, then rerun.',
  }),
  'policy-unavailable': Object.freeze({
    text: 'The trusted policy could not be read.',
    remedy: 'Rerun when the policy can be read.',
  }),
  'policy-invalid': Object.freeze({ text: 'The trusted policy is invalid.', remedy: 'Fix the policy on the trusted branch.' }),
  'llm-not-configured': Object.freeze({
    text: 'A model stage was required, and the policy has no "llm" section.',
    remedy: 'Configure the "llm" section of the policy.',
  }),
  cancelled: Object.freeze({ text: 'The run was cancelled before required work finished.', remedy: 'Rerun.' }),
  'steward-defect': Object.freeze({
    text: 'A steward defect stopped required work.',
    remedy: 'Rerun; report the defect if it repeats.',
  }),
  'stage-incomplete': Object.freeze({
    text: 'Required stages produced no result: {stages}.',
    remedy: 'A steward version that runs these stages is required; this version checks the submission contract only.',
  }),
});

export const REPORT_ITEM_TEMPLATES = Object.freeze({
  item: '{number}. {scenario}',
  location: '   - Location: {location}',
  evidence: '   - Evidence: {evidence}',
  dismissalCode: '   - Dismissal code: {code}',
  request: '   - Request {requestId}: {request}',
  decision: '   - Decision needed: {decision}',
  note: '- Note: {note}',
});

export const PROVENANCE_TEMPLATES = Object.freeze({
  trustedPolicy: '- Policy revision: {revision} (trusted branch {ref} at commit {commit})',
  localPolicy: '- Policy revision: {revision} (local policy file; non-authoritative)',
  stewardVersion: '- Steward version: {version}',
  model: '- Model: no model call in this run',
  adapter: '- Adapter and runtime: none',
  runner: '- Runner: no execution in this run',
});

export const CHECK_SUMMARY_TEMPLATES = Object.freeze({
  outcome: '**Outcome:** {outcome}',
  certifiesPullRequest:
    'Certifies {repository} pull request {number} at head commit {commit} (snapshot {snapshot}) under policy revision {revision}.',
  certifiesIssue: 'Certifies {repository} issue {number} (snapshot {snapshot}) under policy revision {revision}.',
  counts: 'Blockers: {blockers}. Uncertainties for maintainers: {uncertainties}.',
  sharedHead: 'Shared head commit with pull requests {prs}.',
  evidence: 'Report and evidence: {location}',
});

export function nonAuthoritativeNotice(revision: string): string {
  return fillReportTemplate(REPORT_NON_AUTHORITATIVE_NOTICE_TEMPLATE, { revision: reportCodeSpan(revision) });
}

export interface ReportHeaderInput {
  readonly outcome: Outcome;
  readonly causes: readonly FailureCause[];
  readonly repository: string;
  readonly submissionType: SubmissionType;
  readonly number: number;
  readonly snapshotHash: string;
  readonly targetBranch: string | null;
  readonly headCommit: string | null;
  readonly baseCommit: string | null;
  readonly policyRevision: string;
  readonly runId: string | number;
  readonly runAttempt: number;
}

export function reportHeaderLines(input: ReportHeaderInput): readonly string[] {
  const lines: string[] = [];
  lines.push(fillReportTemplate(REPORT_HEADER_TEMPLATES.outcome, { outcome: reportCodeSpan(input.outcome) }));

  if (input.outcome === 'inconclusive' && input.causes.length > 0) {
    const uniqueCauses: FailureCause[] = [];
    for (const cause of input.causes) {
      if (!uniqueCauses.includes(cause)) {
        uniqueCauses.push(cause);
      }
    }
    if (uniqueCauses.length > 0) {
      lines.push(fillReportTemplate(REPORT_HEADER_TEMPLATES.causes, { causes: reportSubjectList(uniqueCauses) }));
    }
  }

  const submissionTemplate = input.submissionType === 'issue' ? REPORT_HEADER_TEMPLATES.issue : REPORT_HEADER_TEMPLATES.pullRequest;
  lines.push(
    fillReportTemplate(submissionTemplate, {
      repository: reportCodeSpan(input.repository),
      number: reportCodeSpan(String(input.number)),
    }),
  );

  lines.push(fillReportTemplate(REPORT_HEADER_TEMPLATES.snapshot, { snapshot: reportCodeSpan(input.snapshotHash) }));

  if (input.submissionType === 'pull_request') {
    if (input.targetBranch !== null) {
      lines.push(fillReportTemplate(REPORT_HEADER_TEMPLATES.targetBranch, { ref: reportCodeSpan(input.targetBranch) }));
    }
    if (input.headCommit !== null) {
      lines.push(fillReportTemplate(REPORT_HEADER_TEMPLATES.headCommit, { commit: reportCodeSpan(input.headCommit) }));
    }
    if (input.baseCommit !== null) {
      lines.push(fillReportTemplate(REPORT_HEADER_TEMPLATES.baseCommit, { commit: reportCodeSpan(input.baseCommit) }));
    }
  }

  lines.push(fillReportTemplate(REPORT_HEADER_TEMPLATES.policyRevision, { revision: reportCodeSpan(input.policyRevision) }));
  lines.push(
    fillReportTemplate(REPORT_HEADER_TEMPLATES.run, {
      runId: reportCodeSpan(String(input.runId)),
      attempt: reportCodeSpan(String(input.runAttempt)),
    }),
  );

  return lines;
}

export type ClassificationInput =
  | { readonly type: 'issue'; readonly issueKind: IssueKind | null }
  | {
      readonly type: 'pull_request';
      readonly category: Category | null;
      readonly consistent: boolean;
      readonly plausible: readonly Category[];
    };

export function classificationLine(input: ClassificationInput): string {
  if (input.type === 'issue') {
    if (input.issueKind === 'defect') {
      return fillReportTemplate(CLASSIFICATION_TEMPLATES.defect, { claim: CLASSIFICATION_TEMPLATES.claim });
    }
    if (input.issueKind === 'proposal') {
      return fillReportTemplate(CLASSIFICATION_TEMPLATES.proposal, { claim: CLASSIFICATION_TEMPLATES.claim });
    }
    return fillReportTemplate(CLASSIFICATION_TEMPLATES.unstructured, { claim: CLASSIFICATION_TEMPLATES.claim });
  }
  if (input.category !== null && input.consistent) {
    return fillReportTemplate(CLASSIFICATION_TEMPLATES.category, {
      category: reportCodeSpan(input.category),
      claim: CLASSIFICATION_TEMPLATES.claim,
    });
  }
  return fillReportTemplate(CLASSIFICATION_TEMPLATES.undetermined, {
    categories: reportSubjectList(input.plausible),
    claim: CLASSIFICATION_TEMPLATES.claim,
  });
}

export function causeLine(cause: RecordCause): string {
  const template = CAUSE_TEMPLATES[cause.cause];
  const subjects = reportSubjectList(cause.subjects);
  const text = fillReportTemplate(template.text, { urls: subjects, stages: subjects });
  return text + ' ' + template.remedy;
}

export function overflowLine(count: number, section: Exclude<ReportSection, 'provenance'>, evidenceLocation: string): string {
  return fillReportTemplate(REPORT_OVERFLOW_TEMPLATE, {
    count: String(count),
    noun: REPORT_OVERFLOW_NOUNS[section],
    location: reportCodeSpan(evidenceLocation),
  });
}

export type ProvenanceInput =
  | {
      readonly source: 'trusted-branch';
      readonly policyRevision: string;
      readonly ref: string;
      readonly commit: string;
      readonly stewardVersion: string;
    }
  | { readonly source: 'local-file'; readonly policyRevision: string; readonly stewardVersion: string };

export function provenanceLines(input: ProvenanceInput): readonly string[] {
  const policyLine =
    input.source === 'trusted-branch'
      ? fillReportTemplate(PROVENANCE_TEMPLATES.trustedPolicy, {
          revision: reportCodeSpan(input.policyRevision),
          ref: reportCodeSpan(input.ref),
          commit: reportCodeSpan(input.commit),
        })
      : fillReportTemplate(PROVENANCE_TEMPLATES.localPolicy, { revision: reportCodeSpan(input.policyRevision) });

  return [
    policyLine,
    fillReportTemplate(PROVENANCE_TEMPLATES.stewardVersion, { version: reportCodeSpan(input.stewardVersion) }),
    PROVENANCE_TEMPLATES.model,
    PROVENANCE_TEMPLATES.adapter,
    PROVENANCE_TEMPLATES.runner,
  ];
}
