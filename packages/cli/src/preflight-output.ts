import type { ContractResult, IssueKind, PolicyChange } from '@patch-steward/core';
import { redactBuiltInCredentials } from '@patch-steward/core';

export const PREFLIGHT_NOTICE = "unverified: produced on the contributor's machine; official screening treats it as a claim";
export const PREFLIGHT_SUBJECTS_SHOWN_MAX = 20;
export const PREFLIGHT_TEXT_MAX_CODE_POINTS = 4096;

export interface PreflightPolicySource {
  readonly source: 'published' | 'default-checklist';
  readonly repository: string;
  readonly ref: string;
  readonly commit: string | null;
  readonly revision: string | null;
}

export type PreflightContractReport = Pick<
  ContractResult,
  | 'disposition'
  | 'findings'
  | 'requests'
  | 'inconclusive'
  | 'category'
  | 'plausible_categories'
  | 'effective_mode'
  | 'enforced'
  | 'template'
>;

export interface PreflightPathsReport {
  readonly base: string;
  readonly head: string;
  readonly merge_base: string;
  readonly changed: number | null;
  readonly trusted_changed: boolean;
  readonly execution_sensitive_changed: boolean;
  readonly policy_changed: boolean;
  readonly trusted_paths: readonly string[];
  readonly execution_sensitive_paths: readonly string[];
  readonly policy_paths: readonly string[];
  readonly policy_change: PolicyChange | null;
}

export interface PreflightWarning {
  readonly code: string;
  readonly message: string;
  readonly subjects: readonly string[];
}

export interface PreflightError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface PreflightReport {
  readonly schema_version: 1;
  readonly unverified: true;
  readonly notice: string;
  readonly submission: { readonly type: 'issue' | 'pull_request'; readonly issue_kind: IssueKind | null } | null;
  readonly repository: string | null;
  readonly policy: PreflightPolicySource | null;
  readonly contract: PreflightContractReport | null;
  readonly paths: PreflightPathsReport | null;
  readonly warnings: readonly PreflightWarning[];
  readonly errors: readonly PreflightError[];
}

export interface PreflightTextOutput {
  readonly stdout: string;
  readonly stderr: string;
}

const FORMAT_CHARACTER_PATTERN = /\p{Cf}/u;

export function escapeTerminalText(text: string): string {
  const redacted = redactBuiltInCredentials(text);
  let out = '';
  let count = 0;
  for (const ch of redacted) {
    if (count === PREFLIGHT_TEXT_MAX_CODE_POINTS) {
      out += String.fromCharCode(0x2026);
      return out;
    }
    const cp = ch.codePointAt(0) as number;
    if (ch === '\\') {
      out += '\\\\';
    } else if (
      cp < 0x20 ||
      (cp >= 0x7f && cp <= 0x9f) ||
      cp === 0x2028 ||
      cp === 0x2029 ||
      (ch.length === 1 && cp >= 0xd800 && cp <= 0xdfff) ||
      FORMAT_CHARACTER_PATTERN.test(ch)
    ) {
      out += cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, '0')}`;
    } else {
      out += ch;
    }
    count += 1;
  }
  return out;
}

function subjectLines(subjects: readonly string[]): string[] {
  const lines: string[] = [];
  const shown = subjects.slice(0, PREFLIGHT_SUBJECTS_SHOWN_MAX);
  for (const subject of shown) {
    lines.push(`  subject ${escapeTerminalText(subject)}`);
  }
  if (subjects.length > PREFLIGHT_SUBJECTS_SHOWN_MAX) {
    lines.push(`  subjects not shown: ${subjects.length - PREFLIGHT_SUBJECTS_SHOWN_MAX}`);
  }
  return lines;
}

function renderStderr(report: PreflightReport): string {
  const lines: string[] = [];
  for (const warning of report.warnings) {
    lines.push(`warning ${escapeTerminalText(warning.code)}: ${escapeTerminalText(warning.message)}`);
    lines.push(...subjectLines(warning.subjects));
  }
  for (const error of report.errors) {
    const path = error.path === '' ? '-' : escapeTerminalText(error.path);
    lines.push(`error ${escapeTerminalText(error.code)} ${path}: ${escapeTerminalText(error.message)}`);
  }
  return lines.map((line) => `${line}\n`).join('');
}

function renderPolicyLine(policy: PreflightPolicySource | null): string {
  if (policy === null) {
    return 'policy: unknown';
  }
  if (policy.source === 'published') {
    const commit = policy.commit ?? '-';
    const revision = policy.revision ?? '-';
    return `policy: published ${escapeTerminalText(policy.repository)} ${escapeTerminalText(policy.ref)} commit ${commit} revision ${revision}`;
  }
  return `policy: default checklist (${escapeTerminalText(policy.repository)} has no published policy on ${escapeTerminalText(policy.ref)})`;
}

function renderSubmissionLine(submission: PreflightReport['submission']): string {
  if (submission === null) {
    return 'submission: unknown';
  }
  if (submission.type === 'pull_request') {
    return 'submission: pull request';
  }
  return `submission: issue ${submission.issue_kind ?? '-'}`;
}

function renderProposedPolicyLines(policyChange: PolicyChange): string[] {
  const lines: string[] = [];
  const proposed = policyChange.proposed;
  if (proposed === null) {
    lines.push('proposed-policy: unavailable');
  } else if (proposed.status === 'removed') {
    lines.push('proposed-policy: removed');
  } else if (proposed.status === 'valid') {
    lines.push(`proposed-policy: valid revision ${proposed.revision}`);
  } else {
    lines.push(`proposed-policy: invalid revision ${proposed.revision}`);
    for (const err of proposed.errors) {
      const path = err.path === '' ? '-' : escapeTerminalText(err.path);
      lines.push(`  proposed-policy-error ${escapeTerminalText(err.code)} ${path}: ${escapeTerminalText(err.message)}`);
    }
  }
  return lines;
}

function renderPullRequestLines(contract: PreflightContractReport, paths: PreflightPathsReport | null): string[] {
  const lines: string[] = [];
  const plausible = contract.plausible_categories.length > 0 ? contract.plausible_categories.join(',') : 'none';
  lines.push(`category: ${contract.category ?? 'none'} plausible ${plausible}`);
  if (paths !== null) {
    const changed = paths.changed === null ? 'too-many' : String(paths.changed);
    lines.push(`paths: base ${paths.base} merge-base ${paths.merge_base} head ${paths.head} changed ${changed}`);
    lines.push(
      `flags: trusted-paths-changed ${String(paths.trusted_changed)} execution-sensitive-paths-changed ${String(paths.execution_sensitive_changed)} policy-changed ${String(paths.policy_changed)}`,
    );
    if (paths.policy_change !== null && paths.policy_change.changed) {
      lines.push(...renderProposedPolicyLines(paths.policy_change));
    }
  }
  return lines;
}

function renderStdout(report: PreflightReport): string {
  if (report.contract === null) {
    return '';
  }
  const contract = report.contract;
  const lines: string[] = [];
  lines.push(PREFLIGHT_NOTICE);
  lines.push(renderPolicyLine(report.policy));
  lines.push(renderSubmissionLine(report.submission));
  lines.push(contract.template !== null ? `template: ${contract.template.form} v${contract.template.version}` : 'template: none');
  lines.push(`mode: ${contract.effective_mode} enforced ${String(contract.enforced)}`);
  if (report.submission !== null && report.submission.type === 'pull_request') {
    lines.push(...renderPullRequestLines(contract, report.paths));
  }
  lines.push(`disposition: ${contract.disposition}`);
  for (const finding of contract.findings) {
    const field = finding.field !== null ? ` field ${finding.field}` : '';
    const detail = finding.detail !== null ? ` detail ${escapeTerminalText(finding.detail)}` : '';
    lines.push(`finding ${finding.code} ${finding.severity}${field}${detail}: ${escapeTerminalText(finding.message)}`);
    lines.push(...subjectLines(finding.subjects));
  }
  for (const request of contract.requests) {
    lines.push(`request ${request.number}: ${escapeTerminalText(request.text)}`);
  }
  for (const inconclusive of contract.inconclusive) {
    lines.push(
      `inconclusive ${inconclusive.cause} ${escapeTerminalText(inconclusive.code)}: ${escapeTerminalText(inconclusive.message)}`,
    );
    lines.push(...subjectLines(inconclusive.subjects));
  }
  return lines.map((line) => `${line}\n`).join('');
}

export function renderPreflightText(report: PreflightReport): PreflightTextOutput {
  return { stdout: renderStdout(report), stderr: renderStderr(report) };
}

const JSON_ESCAPE_PATTERN = /[\u007f-\u009f\u2028\u2029\p{Cf}]/gu;

export function renderPreflightJson(report: PreflightReport): string {
  const json = JSON.stringify(report);
  const escaped = json.replace(JSON_ESCAPE_PATTERN, (match) => {
    let out = '';
    for (let i = 0; i < match.length; i += 1) {
      out += `\\u${match.charCodeAt(i).toString(16).padStart(4, '0')}`;
    }
    return out;
  });
  return `${escaped}\n`;
}
