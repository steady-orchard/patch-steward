import { parseArgs } from 'node:util';
import path from 'node:path';

import type { Result, RunVerificationFailureCode, VerifiedRun } from '@patch-steward/core';
import { verifyRunDirectory } from '@patch-steward/core';

import type { CliError, StewardExitCode } from './conventions.js';
import { failureErrors, renderJsonLine, writeTextDiagnostics } from './conventions.js';
import type { PolicyCommandContext } from './policy-command.js';
import { buildReportFailureJson, buildReportJson, reportTextProblem, REPORT_EXIT_BY_OUTCOME } from './report-output.js';

export const REPORT_USAGE = 'usage: steward report <run-dir> [--json]';

export const REPORT_USAGE_CODES = ['usage.unknown-option', 'usage.invalid-arguments'] as const;
export type ReportUsageCode = (typeof REPORT_USAGE_CODES)[number];

export const REPORT_COMMAND_FAILURE_CODES = ['report.run-unreadable', 'report.evidence-invalid', 'steward.internal-error'] as const;
export type ReportCommandFailureCode = (typeof REPORT_COMMAND_FAILURE_CODES)[number];

export const REPORT_FAILURE_EXIT: { readonly [K in RunVerificationFailureCode]: 1 | 2 } = Object.freeze({
  'report.run-unreadable': 2,
  'report.evidence-invalid': 1,
});

export const REPORT_INTERNAL_ERROR_MESSAGE = 'The steward failed unexpectedly; no report was verified.';

export interface ReportCommandContext extends PolicyCommandContext {
  readonly verify?: (directory: string) => Promise<Result<VerifiedRun, RunVerificationFailureCode>>;
}

export type ReportArgsResult =
  | { readonly ok: true; readonly runDir: string; readonly json: boolean }
  | { readonly ok: false; readonly code: ReportUsageCode; readonly message: string; readonly json: boolean };

export function parseReportArgs(argv: readonly string[]): ReportArgsResult {
  const json = argv.includes('--json');

  let positionals: string[];
  try {
    ({ positionals } = parseArgs({
      args: [...argv],
      options: { json: { type: 'boolean' } },
      strict: true,
      allowPositionals: true,
    }));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const code = err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' ? 'usage.unknown-option' : 'usage.invalid-arguments';
    return { ok: false, code, message: err.message, json };
  }

  if (positionals.length === 0) {
    return { ok: false, code: 'usage.invalid-arguments', message: 'a run directory is required', json };
  }
  if (positionals.length > 1) {
    return { ok: false, code: 'usage.invalid-arguments', message: 'exactly one run directory is allowed', json };
  }
  const runDir = positionals[0] as string;
  if (runDir === '') {
    return { ok: false, code: 'usage.invalid-arguments', message: 'the run directory must not be empty', json };
  }

  return { ok: true, runDir, json };
}

export async function runReportCommand(argv: readonly string[], context: ReportCommandContext): Promise<StewardExitCode> {
  const io = context.io;

  function emitFailure(errors: readonly CliError[], json: boolean): void {
    if (json) {
      io.stdout(renderJsonLine(buildReportFailureJson(errors)));
      return;
    }
    writeTextDiagnostics(io, [], errors);
  }

  const parsed = parseReportArgs(argv);
  if (!parsed.ok) {
    emitFailure([{ code: parsed.code, path: '', message: parsed.message }], parsed.json);
    if (!parsed.json) {
      io.stderr(`${REPORT_USAGE}\n`);
    }
    return 2;
  }

  const json = parsed.json;

  try {
    const directory = path.resolve(context.cwd, parsed.runDir);
    const r = await (context.verify ?? verifyRunDirectory)(directory);
    if (!r.ok) {
      emitFailure(failureErrors(r.failure), json);
      return REPORT_FAILURE_EXIT[r.failure.code as RunVerificationFailureCode];
    }

    const v = r.value;
    const problem = reportTextProblem(v.reportMarkdown, v.report.check_summary);
    if (problem !== null) {
      emitFailure([problem], json);
      return 1;
    }

    if (json) {
      io.stdout(renderJsonLine(buildReportJson(v)));
    } else {
      io.stdout(v.reportMarkdown);
      writeTextDiagnostics(
        io,
        v.warnings.map((w) => ({ code: w.code, message: w.message })),
        [],
      );
    }
    return REPORT_EXIT_BY_OUTCOME[v.decision.outcome];
  } catch {
    emitFailure([{ code: 'steward.internal-error', path: '', message: REPORT_INTERNAL_ERROR_MESSAGE }], json);
    return 2;
  }
}
