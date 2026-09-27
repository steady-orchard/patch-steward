import type { Outcome, SubmissionType } from '../vocabulary.js';
import type { Result } from '../result.js';

import { err, ok } from '../result.js';
import { CHECK_SUMMARY_MAX_LENGTH } from '../policy/bounds.js';
import { CHECK_SUMMARY_TEMPLATES, REPORT_LOCAL_RUN_NOTICE, nonAuthoritativeNotice } from './templates.js';
import { fillReportTemplate, reportCodeSpan, reportSubjectList } from './escape.js';

export interface CheckSummaryInput {
  readonly outcome: Outcome;
  readonly repository: string;
  readonly submissionType: SubmissionType;
  readonly number: number;
  readonly headCommit: string | null;
  readonly snapshotHash: string;
  readonly policyRevision: string;
  readonly policySource: 'trusted-branch' | 'local-file';
  readonly localRun: boolean;
  readonly blockers: number;
  readonly uncertainties: number;
  readonly sharedHeadPullRequests: readonly string[];
  readonly evidenceLocation: string;
}

export type CheckSummaryFailureCode = 'report.summary-too-large';

export function renderCheckSummary(input: CheckSummaryInput): Result<string, CheckSummaryFailureCode> {
  const paragraphs: (readonly string[])[] = [];

  paragraphs.push([fillReportTemplate(CHECK_SUMMARY_TEMPLATES.outcome, { outcome: reportCodeSpan(input.outcome) })]);

  const certifies =
    input.submissionType === 'pull_request'
      ? fillReportTemplate(CHECK_SUMMARY_TEMPLATES.certifiesPullRequest, {
          repository: reportCodeSpan(input.repository),
          number: reportCodeSpan(String(input.number)),
          commit: reportCodeSpan(input.headCommit ?? ''),
          snapshot: reportCodeSpan(input.snapshotHash),
          revision: reportCodeSpan(input.policyRevision),
        })
      : fillReportTemplate(CHECK_SUMMARY_TEMPLATES.certifiesIssue, {
          repository: reportCodeSpan(input.repository),
          number: reportCodeSpan(String(input.number)),
          snapshot: reportCodeSpan(input.snapshotHash),
          revision: reportCodeSpan(input.policyRevision),
        });

  const counts = fillReportTemplate(CHECK_SUMMARY_TEMPLATES.counts, {
    blockers: String(input.blockers),
    uncertainties: String(input.uncertainties),
  });

  const certifiesParagraph = [certifies, counts];
  if (input.sharedHeadPullRequests.length > 0) {
    certifiesParagraph.push(
      fillReportTemplate(CHECK_SUMMARY_TEMPLATES.sharedHead, { prs: reportSubjectList(input.sharedHeadPullRequests) }),
    );
  }
  paragraphs.push(certifiesParagraph);

  if (input.localRun) {
    paragraphs.push([REPORT_LOCAL_RUN_NOTICE]);
  }

  if (input.policySource === 'local-file') {
    paragraphs.push([nonAuthoritativeNotice(input.policyRevision)]);
  }

  paragraphs.push([fillReportTemplate(CHECK_SUMMARY_TEMPLATES.evidence, { location: reportCodeSpan(input.evidenceLocation) })]);

  const text = paragraphs.map((p) => p.join('\n')).join('\n\n') + '\n';

  if (text.length > CHECK_SUMMARY_MAX_LENGTH) {
    return err('report.summary-too-large', 'steward-defect', 'The check summary exceeds its maximum.');
  }

  return ok(text);
}
