import { reportCodeSpan } from '../report/escape.js';
import { JOB_SUMMARY_MAX_LENGTH, OWNERSHIP_RETENTION_DAYS } from '../policy/bounds.js';
import type { GateDisposition, Outcome, SubmissionType, WaitingState } from '../vocabulary.js';

export type JobSummaryJob = 'gate' | 'publish';
export type JobSummaryStatus = GateDisposition | Outcome | WaitingState | 'failed';
export type JobSummaryFreshness = 'confirmed' | 'superseded' | 'unknown';

export interface JobSummaryInput {
  readonly job: JobSummaryJob;
  readonly repository: string;
  readonly subjectType: SubmissionType;
  readonly subjectNumber: number;
  readonly runId: number;
  readonly runAttempt: number;
  readonly status: JobSummaryStatus;
  readonly snapshotHash: string | null;
  readonly policyRevision: string | null;
  readonly owner: { readonly action: 'kept' | 'committed'; readonly runId: number; readonly runAttempt: number } | null;
  readonly caps: {
    readonly dailyCount: number;
    readonly dailyLimit: number;
    readonly authorCount: number;
    readonly authorLimit: number;
  } | null;
  readonly evidence: { readonly commit: string; readonly location: string } | null;
  readonly freshness: JobSummaryFreshness | null;
  readonly retentionDays: number | null;
  readonly failureCode: string | null;
}

export function renderJobSummary(input: JobSummaryInput): string {
  const S = reportCodeSpan;
  const lines: string[] = [];
  lines.push(input.job === 'gate' ? '## Patch Steward gate' : '## Patch Steward publish');
  lines.push('');
  const subjectKind = input.subjectType === 'pull_request' ? 'pull request' : 'issue';
  lines.push('- Submission: ' + S(input.repository) + ' ' + subjectKind + ' ' + S(String(input.subjectNumber)));
  lines.push('- Run: ' + S(input.runId + '-' + input.runAttempt));
  lines.push('- Status: ' + S(input.status));
  if (input.snapshotHash !== null) {
    lines.push('- Snapshot: ' + S(input.snapshotHash));
  }
  if (input.policyRevision !== null) {
    lines.push('- Policy revision: ' + S(input.policyRevision));
  }
  if (input.owner !== null) {
    lines.push('- Owner: ' + input.owner.action + ' ' + S(input.owner.runId + '-' + input.owner.runAttempt));
  }
  if (input.caps !== null) {
    lines.push(
      '- Caps: daily ' +
        S(String(input.caps.dailyCount)) +
        ' of ' +
        S(String(input.caps.dailyLimit)) +
        ', author ' +
        S(String(input.caps.authorCount)) +
        ' of ' +
        S(String(input.caps.authorLimit)),
    );
  }
  if (input.evidence !== null) {
    lines.push('- Evidence: commit ' + S(input.evidence.commit) + ' at ' + S(input.evidence.location));
  }
  if (input.freshness !== null) {
    lines.push('- Freshness: ' + S(input.freshness));
  }
  if (input.retentionDays !== null) {
    const flag = input.retentionDays < OWNERSHIP_RETENTION_DAYS ? ' (shorter than requested)' : '';
    lines.push('- Ownership artifact retention: ' + S(String(input.retentionDays)) + ' days' + flag);
  }
  if (input.failureCode !== null) {
    lines.push('- Failure: ' + S(input.failureCode));
  }
  return fitJobSummary(lines, JOB_SUMMARY_MAX_LENGTH);
}

export function fitJobSummary(lines: readonly string[], maxLength: number): string {
  const text = lines.join('\n') + '\n';
  if (text.length <= maxLength) {
    return text;
  }
  const kept = lines.slice();
  while (kept.length > 1) {
    kept.pop();
    const candidate = kept.join('\n') + '\n' + '- Summary truncated.\n';
    if (candidate.length <= maxLength) {
      return candidate;
    }
  }
  return kept.join('\n') + '\n' + '- Summary truncated.\n';
}
