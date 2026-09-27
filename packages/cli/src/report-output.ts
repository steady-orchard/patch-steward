import type { CliError, CliWarning, StewardExitCode } from './conventions.js';
import { cliRunNotices } from './conventions.js';

import type { FailureCause, Outcome, VerifiedRun } from '@patch-steward/core';
import { reportCharacterViolations } from '@patch-steward/core';

export interface ReportJsonReport {
  readonly schema_version: 1;
  readonly command: 'report';
  readonly local_run: true;
  readonly authoritative: boolean;
  readonly notices: readonly string[];
  readonly run: {
    readonly run_id: string | number;
    readonly run_attempt: number;
    readonly directory: string;
    readonly started_at: string;
    readonly finished_at: string | null;
  } | null;
  readonly submission: {
    readonly repository: string;
    readonly type: 'issue' | 'pull_request';
    readonly number: number;
    readonly snapshot_hash: string;
    readonly target_branch: string | null;
    readonly head_commit: string | null;
    readonly base_commit: string | null;
  } | null;
  readonly policy: {
    readonly revision: string;
    readonly authoritative: boolean;
    readonly source: 'trusted-branch' | 'local-file';
  } | null;
  readonly outcome: Outcome | null;
  readonly causes: readonly { readonly cause: FailureCause; readonly code: string; readonly subjects: readonly string[] }[];
  readonly report: string | null;
  readonly check_summary: string | null;
  readonly integrity: { readonly manifest: 'verified'; readonly files: number; readonly metrics: 'verified' | 'missing' } | null;
  readonly warnings: readonly CliWarning[];
  readonly errors: readonly CliError[];
}

export const REPORT_EXIT_BY_OUTCOME: { readonly [K in Outcome]: StewardExitCode } = Object.freeze({
  pass: 0,
  'needs-changes': 1,
  uncertain: 1,
  inconclusive: 3,
  overridden: 1,
  superseded: 1,
});

export function buildReportJson(verified: VerifiedRun): ReportJsonReport {
  const authoritative = verified.policyRevision.authoritative;
  const revision = verified.policyRevision.revision.id;
  const source: 'trusted-branch' | 'local-file' =
    verified.policyRevision.revision.kind === 'git-tree' ? 'trusted-branch' : 'local-file';
  const notices = cliRunNotices({ authoritative, revision });

  return {
    schema_version: 1,
    command: 'report',
    local_run: true,
    authoritative,
    notices,
    run: {
      run_id: verified.run.run_id,
      run_attempt: verified.run.run_attempt,
      directory: verified.directory,
      started_at: verified.run.started_at,
      finished_at: verified.run.finished_at,
    },
    submission: {
      repository: verified.submission.repository,
      type: verified.submission.type,
      number: verified.submission.number,
      snapshot_hash: verified.submission.snapshot_hash,
      target_branch: verified.submission.target_branch,
      head_commit: verified.submission.head_commit,
      base_commit: verified.report.bound.base_commit,
    },
    policy: { revision, authoritative, source },
    outcome: verified.decision.outcome,
    causes: (verified.decision.causes ?? []).map((c) => ({ cause: c.cause, code: c.code, subjects: c.subjects })),
    report: verified.reportMarkdown,
    check_summary: verified.report.check_summary,
    integrity: { manifest: 'verified', files: verified.files, metrics: verified.metrics },
    warnings: verified.warnings.map((w) => ({ code: w.code, message: w.message })),
    errors: [],
  };
}

export function buildReportFailureJson(errors: readonly CliError[]): ReportJsonReport {
  return {
    schema_version: 1,
    command: 'report',
    local_run: true,
    authoritative: false,
    notices: cliRunNotices(null),
    run: null,
    submission: null,
    policy: null,
    outcome: null,
    causes: [],
    report: null,
    check_summary: null,
    integrity: null,
    warnings: [],
    errors,
  };
}

export function reportTextProblem(reportMarkdown: string, checkSummary: string): CliError | null {
  if (reportCharacterViolations(reportMarkdown).length > 0) {
    return { code: 'report.evidence-invalid', path: 'report.md', message: 'report.md contains a control or format character.' };
  }
  if (reportCharacterViolations(checkSummary).length > 0) {
    return {
      code: 'report.evidence-invalid',
      path: 'report.json',
      message: 'The check summary contains a control or format character.',
    };
  }
  return null;
}
