import type { StewardFailure } from '@patch-steward/core';
import { escapeTerminalText } from './preflight-output.js';
import type { CommandIo } from './policy-command.js';

export type StewardExitCode = 0 | 1 | 2 | 3;

export const STEWARD_EXIT_CODES: readonly StewardExitCode[] = Object.freeze([0, 1, 2, 3]);

export interface CliWarning {
  readonly code: string;
  readonly message: string;
}

export interface CliError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export const CLI_LOCAL_RUN_NOTICE = "local run: not the repository's official screening result";

export function cliNonAuthoritativeNotice(revision: string): string {
  return `non-authoritative: screened under a local policy file (${revision})`;
}

export function cliRunNotices(policy: { readonly authoritative: boolean; readonly revision: string } | null): readonly string[] {
  const notices: string[] = [CLI_LOCAL_RUN_NOTICE];
  if (policy !== null && !policy.authoritative) {
    notices.push(cliNonAuthoritativeNotice(policy.revision));
  }
  return notices;
}

const JSON_LINE_ESCAPE_PATTERN = /[\u007f-\u009f\u2028\u2029\p{Cf}]/gu;

export function renderJsonLine(value: unknown): string {
  const json = JSON.stringify(value);
  const escaped = json.replace(JSON_LINE_ESCAPE_PATTERN, (match) => {
    let out = '';
    for (let i = 0; i < match.length; i += 1) {
      out += `\\u${match.charCodeAt(i).toString(16).padStart(4, '0')}`;
    }
    return out;
  });
  return `${escaped}\n`;
}

export function warningLine(warning: CliWarning): string {
  return `warning ${escapeTerminalText(warning.code)}: ${escapeTerminalText(warning.message)}\n`;
}

export function errorLine(error: CliError): string {
  const path = error.path === '' ? '-' : escapeTerminalText(error.path);
  return `error ${escapeTerminalText(error.code)} ${path}: ${escapeTerminalText(error.message)}\n`;
}

export function writeTextDiagnostics(io: CommandIo, warnings: readonly CliWarning[], errors: readonly CliError[]): void {
  for (const warning of warnings) {
    io.stderr(warningLine(warning));
  }
  for (const error of errors) {
    io.stderr(errorLine(error));
  }
}

export function failureErrors(failure: StewardFailure): readonly CliError[] {
  return [
    { code: failure.code, path: '', message: failure.message },
    ...failure.details.map((d) => ({ code: d.code, path: d.path, message: d.message })),
  ];
}
