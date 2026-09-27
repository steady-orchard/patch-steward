import { parseArgs } from 'node:util';

import type { GitHubRepositoryRef } from '@patch-steward/core';
import { repositoryRefFromFullName } from '@patch-steward/core';

export const SCREEN_USAGE =
  'usage: steward screen (--issue <number> | --pr <number>) [--repo owner/name] [--policy-file <path>] [--evidence-dir <dir>] [--json]';

export const SCREEN_USAGE_CODES = ['usage.unknown-option', 'usage.invalid-arguments', 'usage.conflicting-options'] as const;

export type ScreenUsageCode = (typeof SCREEN_USAGE_CODES)[number];

export const SCREEN_NUMBER_MAX = 2147483647;

export interface ScreenArgs {
  readonly submission: { readonly type: 'issue' | 'pull_request'; readonly number: number };
  readonly repository: GitHubRepositoryRef | null;
  readonly policyFile: string | null;
  readonly evidenceDir: string | null;
  readonly json: boolean;
}

export type ScreenArgsResult =
  | { readonly ok: true; readonly args: ScreenArgs }
  | { readonly ok: false; readonly code: ScreenUsageCode; readonly message: string; readonly json: boolean };

const NUMBER_PATTERN = /^[1-9][0-9]*$/;

export function parseScreenArgs(argv: readonly string[]): ScreenArgsResult {
  const json = argv.includes('--json');

  let values: { issue?: string; pr?: string; repo?: string; 'policy-file'?: string; 'evidence-dir'?: string; json?: boolean };
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: {
        issue: { type: 'string' },
        pr: { type: 'string' },
        repo: { type: 'string' },
        'policy-file': { type: 'string' },
        'evidence-dir': { type: 'string' },
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

  if (values.issue !== undefined && values.pr !== undefined) {
    return { ok: false, code: 'usage.conflicting-options', message: '--issue and --pr cannot be used together', json };
  }

  if (values.issue === undefined && values.pr === undefined) {
    return { ok: false, code: 'usage.invalid-arguments', message: 'one of --issue <number> or --pr <number> is required', json };
  }

  const type: 'issue' | 'pull_request' = values.issue !== undefined ? 'issue' : 'pull_request';
  const flag = values.issue !== undefined ? '--issue' : '--pr';
  const value = values.issue !== undefined ? values.issue : (values.pr as string);

  if (!NUMBER_PATTERN.test(value) || Number(value) > SCREEN_NUMBER_MAX) {
    return { ok: false, code: 'usage.invalid-arguments', message: `${flag} must be a positive decimal integer`, json };
  }

  let repository: GitHubRepositoryRef | null = null;
  if (values.repo !== undefined) {
    const ref = repositoryRefFromFullName(values.repo);
    if (ref === null) {
      return { ok: false, code: 'usage.invalid-arguments', message: '--repo must be owner/name', json };
    }
    repository = ref;
  }

  if (values['policy-file'] === '') {
    return { ok: false, code: 'usage.invalid-arguments', message: '--policy-file must not be empty', json };
  }

  if (values['evidence-dir'] === '') {
    return { ok: false, code: 'usage.invalid-arguments', message: '--evidence-dir must not be empty', json };
  }

  return {
    ok: true,
    args: {
      submission: { type, number: Number(value) },
      repository,
      policyFile: values['policy-file'] ?? null,
      evidenceDir: values['evidence-dir'] ?? null,
      json: values.json === true,
    },
  };
}
