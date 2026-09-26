import { parseArgs } from 'node:util';

import type { GitHubRepositoryRef, IssueKind } from '@patch-steward/core';
import { ISSUE_KINDS, repositoryRefFromFullName } from '@patch-steward/core';

export const PREFLIGHT_USAGE =
  'usage: steward preflight (--issue defect|proposal | --pr) --draft <file.md> [--repo owner/name] [--base <ref>] [--json]';

export const PREFLIGHT_USAGE_CODES = ['usage.unknown-option', 'usage.invalid-arguments', 'usage.conflicting-options'] as const;

export type PreflightUsageCode = (typeof PREFLIGHT_USAGE_CODES)[number];

export type PreflightSubmission = { readonly type: 'issue'; readonly issueKind: IssueKind } | { readonly type: 'pull_request' };

export interface PreflightArgs {
  readonly submission: PreflightSubmission;
  readonly draft: string;
  readonly repository: GitHubRepositoryRef | null;
  readonly base: string | null;
  readonly json: boolean;
}

export type PreflightArgsResult =
  | { readonly ok: true; readonly args: PreflightArgs }
  | { readonly ok: false; readonly code: PreflightUsageCode; readonly message: string; readonly json: boolean };

export function parsePreflightArgs(argv: readonly string[]): PreflightArgsResult {
  const json = argv.includes('--json');

  let values: { issue?: string; pr?: boolean; draft?: string; repo?: string; base?: string; json?: boolean };
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: {
        issue: { type: 'string' },
        pr: { type: 'boolean' },
        draft: { type: 'string' },
        repo: { type: 'string' },
        base: { type: 'string' },
        json: { type: 'boolean' },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const code = err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' ? 'usage.unknown-option' : 'usage.invalid-arguments';
    return { ok: false, code, message: err.message, json };
  }

  if (values.issue !== undefined && values.pr === true) {
    return { ok: false, code: 'usage.conflicting-options', message: '--issue and --pr cannot be used together', json };
  }

  if (values.issue === undefined && values.pr !== true) {
    return { ok: false, code: 'usage.invalid-arguments', message: 'one of --issue <kind> or --pr is required', json };
  }

  if (values.issue !== undefined && !(ISSUE_KINDS as readonly string[]).includes(values.issue)) {
    return { ok: false, code: 'usage.invalid-arguments', message: '--issue must be defect or proposal', json };
  }

  if (values.issue !== undefined && values.base !== undefined) {
    return { ok: false, code: 'usage.conflicting-options', message: '--base can be used only with --pr', json };
  }

  if (values.draft === undefined || values.draft === '') {
    return { ok: false, code: 'usage.invalid-arguments', message: '--draft <file> is required', json };
  }

  let repository: GitHubRepositoryRef | null = null;
  if (values.repo !== undefined) {
    const ref = repositoryRefFromFullName(values.repo);
    if (ref === null) {
      return { ok: false, code: 'usage.invalid-arguments', message: '--repo must be owner/name', json };
    }
    repository = ref;
  }

  if (values.base === '') {
    return { ok: false, code: 'usage.invalid-arguments', message: '--base must not be empty', json };
  }

  const submission: PreflightSubmission =
    values.issue !== undefined ? { type: 'issue', issueKind: values.issue as IssueKind } : { type: 'pull_request' };

  return {
    ok: true,
    args: {
      submission,
      draft: values.draft,
      repository,
      base: values.base ?? null,
      json: values.json === true,
    },
  };
}
