import type { DecidedOutcome, FailureCause, FindingSeverity, ScreenPolicyInfo, ScreenResult } from '@patch-steward/core';
import { escapeTerminalText } from './preflight-output.js';
import type { CliError, CliWarning } from './conventions.js';
import { cliNonAuthoritativeNotice, cliRunNotices, failureErrors, CLI_LOCAL_RUN_NOTICE } from './conventions.js';

export const SCREEN_POLICY_MISSING_MESSAGE =
  'The repository has no published policy on its default branch. Pass --policy-file <path> to screen under a local policy file.';
export const SCREEN_TOKEN_REJECTED_MESSAGE = 'GitHub rejected the token; no unauthenticated fallback was attempted.';

export function screenRepositoryUnavailableMessage(repository: string, tokenPresent: boolean): string {
  if (tokenPresent) {
    return `The repository ${repository} does not exist or the token cannot read it.`;
  }
  return `The repository ${repository} does not exist or is private; set GH_TOKEN or GITHUB_TOKEN, or log in with gh.`;
}

export interface ScreenJsonPolicy {
  readonly source: 'trusted-branch' | 'local-file';
  readonly revision: string;
  readonly ref: string | null;
  readonly commit: string | null;
  readonly path: string | null;
}

export interface ScreenJsonReport {
  readonly schema_version: 1;
  readonly command: 'screen';
  readonly local_run: true;
  readonly authoritative: boolean;
  readonly notices: readonly string[];
  readonly repository: string | null;
  readonly submission: { readonly type: 'issue' | 'pull_request'; readonly number: number } | null;
  readonly policy: ScreenJsonPolicy | null;
  readonly run: {
    readonly run_id: string | number;
    readonly run_attempt: number;
    readonly directory: string | null;
    readonly snapshot_hash: string;
  } | null;
  readonly outcome: DecidedOutcome | null;
  readonly causes: readonly { readonly cause: FailureCause; readonly code: string; readonly subjects: readonly string[] }[];
  readonly findings: readonly {
    readonly finding_id: string;
    readonly code: string | null;
    readonly severity: FindingSeverity;
    readonly field: string | null;
    readonly subjects: readonly string[];
  }[];
  readonly requests: readonly { readonly request_id: string; readonly text: string }[];
  readonly warnings: readonly CliWarning[];
  readonly errors: readonly CliError[];
}

export interface ScreenOutputContext {
  readonly submission: { readonly type: 'issue' | 'pull_request'; readonly number: number };
  readonly requestedRepository: string;
  readonly policyPathShown: string | null;
  readonly tokenPresent: boolean;
  readonly warnings: readonly CliWarning[];
}

export function screenJsonPolicy(policy: ScreenPolicyInfo, policyPathShown: string | null): ScreenJsonPolicy {
  return {
    source: policy.source,
    revision: policy.revision,
    ref: policy.ref,
    commit: policy.commit,
    path: policy.source === 'local-file' ? (policyPathShown ?? policy.path) : null,
  };
}

export function screenResultErrors(
  result: Exclude<ScreenResult, { readonly kind: 'completed' }>,
  context: Pick<ScreenOutputContext, 'requestedRepository' | 'tokenPresent'>,
): readonly CliError[] {
  if (result.kind === 'publish-failed') {
    return failureErrors(result.failure);
  }
  const code = result.failure.code;
  if (code === 'github.unauthorized' && context.tokenPresent) {
    return [{ code: 'screen.token-rejected', path: '', message: SCREEN_TOKEN_REJECTED_MESSAGE }];
  }
  if (result.stage === 'repository' && code === 'github.not-found') {
    return [
      {
        code: 'screen.repository-unavailable',
        path: '',
        message: screenRepositoryUnavailableMessage(context.requestedRepository, context.tokenPresent),
      },
    ];
  }
  if (code === 'screen.policy-missing') {
    return [{ code: 'screen.policy-missing', path: '', message: SCREEN_POLICY_MISSING_MESSAGE }];
  }
  return failureErrors(result.failure);
}

export function screenResultJson(result: ScreenResult, context: ScreenOutputContext): ScreenJsonReport {
  if (result.kind === 'completed') {
    const policy = screenJsonPolicy(result.policy, context.policyPathShown);
    const authoritative = policy.source === 'trusted-branch';
    const notices = cliRunNotices({ authoritative, revision: policy.revision });
    const published = result.published;
    const decision = result.decision;
    return {
      schema_version: 1,
      command: 'screen',
      local_run: true,
      authoritative,
      notices,
      repository: result.repository,
      submission: context.submission,
      policy,
      run: {
        run_id: published.run.run_id,
        run_attempt: published.run.run_attempt,
        directory: published.directory,
        snapshot_hash: published.submission.snapshot_hash,
      },
      outcome: decision.outcome,
      causes: decision.causes.map((c) => ({ cause: c.cause, code: c.code, subjects: c.subjects })),
      findings: published.findings.map((f) => ({
        finding_id: f.finding_id,
        code: f.code ?? null,
        severity: f.severity,
        field: f.location.field,
        subjects: f.subjects ?? [],
      })),
      requests: decision.requests.map((r) => ({ request_id: r.request_id, text: r.text })),
      warnings: context.warnings,
      errors: [],
    };
  }

  const policy = result.policy === null ? null : screenJsonPolicy(result.policy, context.policyPathShown);
  const authoritative = policy !== null && policy.source === 'trusted-branch';
  const notices = cliRunNotices(policy === null ? null : { authoritative, revision: policy.revision });

  if (result.kind === 'publish-failed') {
    return {
      schema_version: 1,
      command: 'screen',
      local_run: true,
      authoritative,
      notices,
      repository: result.repository,
      submission: context.submission,
      policy,
      run: {
        run_id: result.run.run_id,
        run_attempt: result.run.run_attempt,
        directory: null,
        snapshot_hash: result.run.snapshot_hash,
      },
      outcome: null,
      causes: [],
      findings: [],
      requests: [],
      warnings: context.warnings,
      errors: screenResultErrors(result, context),
    };
  }

  return {
    schema_version: 1,
    command: 'screen',
    local_run: true,
    authoritative,
    notices,
    repository: result.repository ?? context.requestedRepository,
    submission: context.submission,
    policy,
    run: null,
    outcome: null,
    causes: [],
    findings: [],
    requests: [],
    warnings: context.warnings,
    errors: screenResultErrors(result, context),
  };
}

export function screenFailureJson(input: {
  readonly submission: ScreenOutputContext['submission'] | null;
  readonly repository: string | null;
  readonly warnings: readonly CliWarning[];
  readonly errors: readonly CliError[];
}): ScreenJsonReport {
  return {
    schema_version: 1,
    command: 'screen',
    local_run: true,
    authoritative: false,
    notices: cliRunNotices(null),
    repository: input.repository,
    submission: input.submission,
    policy: null,
    run: null,
    outcome: null,
    causes: [],
    findings: [],
    requests: [],
    warnings: input.warnings,
    errors: input.errors,
  };
}

export function screenTextStdout(
  result: Extract<ScreenResult, { readonly kind: 'completed' }>,
  policyPathShown: string | null,
): string {
  const e = escapeTerminalText;
  const lines: string[] = [CLI_LOCAL_RUN_NOTICE];
  const policy = result.policy;
  const revision = policy.revision;
  if (policy.source === 'local-file') {
    lines.push(cliNonAuthoritativeNotice(e(revision)));
    lines.push(`policy: local file ${e(policyPathShown ?? policy.path ?? '-')} revision ${e(revision)}`);
  } else {
    lines.push(`policy: ${e(result.repository)} ${e(policy.ref ?? '-')} commit ${e(policy.commit ?? '-')} revision ${e(revision)}`);
  }
  const published = result.published;
  const submissionType = published.submission.type === 'pull_request' ? 'pull request' : 'issue';
  lines.push(`submission: ${submissionType} ${published.submission.number} (${e(result.repository)})`);
  lines.push(`outcome: ${result.decision.outcome}`);
  for (const cause of result.decision.causes) {
    lines.push(`cause: ${e(cause.cause)}`);
  }
  for (const request of result.decision.requests) {
    lines.push(`request ${e(request.request_id)}: ${e(request.text)}`);
  }
  lines.push(`run directory: ${e(published.directory)}`);
  return lines.map((line) => `${line}\n`).join('');
}
