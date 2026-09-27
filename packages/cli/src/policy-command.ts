import { parseArgs } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs';

import type { PolicyLoadFailureCode, PolicyWarning, ProcessRunner, StewardFailure } from '@patch-steward/core';
import {
  GIT_OUTPUT_MAX_BYTES,
  GIT_TIMEOUT_MS,
  POLICY_FILE_MAX_BYTES,
  loadPolicy,
  localFileRevisionId,
  policyWarnings,
  readPolicyTreeId,
  resolveCommit,
} from '@patch-steward/core';
import { errorLine, renderJsonLine, writeTextDiagnostics } from './conventions.js';

export const DEFAULT_POLICY_REF = 'origin/HEAD';

export const POLICY_USAGE = 'usage: steward policy [--ref <ref> | --file <path>] [--json]';

export const FILE_SOURCE_NOTICE = 'non-authoritative: a local file never governs a run';

export function gitSourceNotice(ref: string): string {
  return `authoritative only if ${ref} is current; no fetch was performed`;
}

export interface CommandIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface PolicyCommandContext {
  readonly cwd: string;
  readonly io: CommandIo;
  readonly gitBinary?: string;
  readonly runner?: ProcessRunner;
}

export type PolicyCommandExitCode = 0 | 1 | 2;

export type PolicyCommandSource =
  { readonly kind: 'git'; readonly ref: string; readonly commit: string | null } | { readonly kind: 'file'; readonly path: string };

export interface PolicyCommandError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly line: number | null;
  readonly column: number | null;
}

export interface PolicyCommandReport {
  readonly schema_version: 1;
  readonly valid: boolean;
  readonly authoritative: boolean;
  readonly source: PolicyCommandSource | null;
  readonly revision: string | null;
  readonly notice: string | null;
  readonly errors: readonly PolicyCommandError[];
  readonly warnings: readonly PolicyWarning[];
}

export const FAILURE_EXIT_CODES: { readonly [K in PolicyLoadFailureCode]: 1 | 2 } = {
  'git.unavailable': 2,
  'git.timeout': 2,
  'git.output-too-large': 2,
  'git.failed': 2,
  'git.malformed-output': 2,
  'git.not-a-repository': 2,
  'git.invalid-ref': 2,
  'git.ref-unresolvable': 2,
  'git.invalid-object-id': 2,
  'git.policy-directory-missing': 1,
  'git.not-a-directory': 1,
  'git.entry-missing': 1,
  'git.entry-not-regular': 1,
  'git.blob-too-large': 1,
  'git.object-missing': 2,
  'file.not-found': 2,
  'file.not-a-file': 2,
  'file.unreadable': 2,
  'file.too-large': 1,
  'yaml.too-large': 1,
  'yaml.invalid-utf8': 1,
  'yaml.syntax': 1,
  'yaml.empty': 1,
  'yaml.multi-document': 1,
  'yaml.duplicate-key': 1,
  'yaml.directive': 1,
  'yaml.alias': 1,
  'yaml.anchor': 1,
  'yaml.explicit-tag': 1,
  'yaml.non-string-key': 1,
  'yaml.forbidden-key': 1,
  'yaml.too-deep': 1,
  'yaml.too-many-nodes': 1,
  'policy.version-missing': 1,
  'policy.version-unsupported': 1,
  'policy.unknown-key': 1,
  'policy.missing-key': 1,
  'policy.invalid-value': 1,
  'policy.limit-out-of-bounds': 1,
  'policy.undeclared-reference': 1,
  'policy.duplicate-id': 1,
  'policy.invalid-path': 1,
  'policy.llm-pairing': 1,
  'policy.llm-base-url': 1,
  'policy.stage-conflict': 1,
  'policy.label-name': 1,
  'policy.dismissal-code': 1,
  'policy.redaction-pattern': 1,
  'policy.credential-value': 1,
  'policy.resolve-failed': 2,
};

function mapFailureToErrors(failure: StewardFailure<PolicyLoadFailureCode>): PolicyCommandError[] {
  if (failure.details.length > 0) {
    return failure.details.map((detail) => ({
      code: detail.code,
      path: detail.path,
      message: detail.message,
      line: detail.line,
      column: detail.column,
    }));
  }
  return [{ code: failure.code, path: '', message: failure.message, line: null, column: null }];
}

function writeReport(io: CommandIo, report: PolicyCommandReport, json: boolean, exit: PolicyCommandExitCode): void {
  if (json) {
    io.stdout(renderJsonLine(report));
    return;
  }

  if (exit === 0) {
    io.stdout('policy: valid\n');
  } else if (exit === 2) {
    io.stdout('policy: unavailable\n');
  } else {
    io.stdout('policy: invalid\n');
  }

  if (report.source === null) {
    // no source line
  } else if (report.source.kind === 'file') {
    io.stdout(`source: file ${report.source.path}\n`);
  } else if (report.source.commit !== null) {
    io.stdout(`source: ref ${report.source.ref} -> commit ${report.source.commit}\n`);
  } else {
    io.stdout(`source: ref ${report.source.ref}\n`);
  }

  io.stdout(`revision: ${report.revision ?? 'none'}\n`);

  if (report.notice !== null) {
    io.stdout(`notice: ${report.notice}\n`);
  }

  if (!report.valid) {
    io.stdout('outcome: inconclusive; no default was substituted\n');
  }

  writeTextDiagnostics(
    io,
    report.warnings.map((w) => ({ code: w.code, message: w.message })),
    report.errors.map((e) => ({
      code: e.code,
      path: e.path,
      message: e.line !== null && e.column !== null ? `${e.message} (line ${e.line}, column ${e.column})` : e.message,
    })),
  );
}

async function statLocalRevisionId(absolute: string): Promise<string | null> {
  try {
    const stat = await fs.promises.stat(absolute);
    if (stat.size > POLICY_FILE_MAX_BYTES) {
      return null;
    }
    const bytes = await fs.promises.readFile(absolute);
    return localFileRevisionId(bytes);
  } catch {
    return null;
  }
}

async function handleFileSource(
  shown: string,
  context: PolicyCommandContext,
): Promise<{ report: PolicyCommandReport; exit: PolicyCommandExitCode }> {
  const absolute = path.resolve(context.cwd, shown);
  const notice = FILE_SOURCE_NOTICE;
  const source: PolicyCommandSource = { kind: 'file', path: shown };
  const result = await loadPolicy({ kind: 'file', path: absolute });

  if (result.ok) {
    const report: PolicyCommandReport = {
      schema_version: 1,
      valid: true,
      authoritative: false,
      source,
      revision: result.value.revision.id,
      notice,
      errors: [],
      warnings: policyWarnings(result.value.policy),
    };
    return { report, exit: 0 };
  }

  const revision = result.failure.code.startsWith('file.') ? null : await statLocalRevisionId(absolute);
  const errors = mapFailureToErrors(result.failure);
  const report: PolicyCommandReport = {
    schema_version: 1,
    valid: false,
    authoritative: false,
    source,
    revision,
    notice,
    errors,
    warnings: [],
  };
  return { report, exit: FAILURE_EXIT_CODES[result.failure.code] };
}

async function handleGitSource(
  ref: string,
  context: PolicyCommandContext,
): Promise<{ report: PolicyCommandReport; exit: PolicyCommandExitCode }> {
  const notice = gitSourceNotice(ref);
  const gitOptions = {
    repoDir: context.cwd,
    timeoutMs: GIT_TIMEOUT_MS,
    maxOutputBytes: GIT_OUTPUT_MAX_BYTES,
    ...(context.gitBinary !== undefined ? { gitBinary: context.gitBinary } : {}),
    ...(context.runner !== undefined ? { runner: context.runner } : {}),
  };

  const commitResult = await resolveCommit(gitOptions, ref);
  if (!commitResult.ok) {
    const errors = mapFailureToErrors(commitResult.failure);
    const report: PolicyCommandReport = {
      schema_version: 1,
      valid: false,
      authoritative: false,
      source: { kind: 'git', ref, commit: null },
      revision: null,
      notice,
      errors,
      warnings: [],
    };
    return { report, exit: FAILURE_EXIT_CODES[commitResult.failure.code] };
  }
  const commit = commitResult.value;

  const treeIdResult = await readPolicyTreeId(gitOptions, commit);
  if (!treeIdResult.ok) {
    const errors = mapFailureToErrors(treeIdResult.failure);
    const report: PolicyCommandReport = {
      schema_version: 1,
      valid: false,
      authoritative: false,
      source: { kind: 'git', ref, commit },
      revision: null,
      notice,
      errors,
      warnings: [],
    };
    return { report, exit: FAILURE_EXIT_CODES[treeIdResult.failure.code] };
  }
  const treeId = treeIdResult.value;

  const loadOptions = {
    ...(context.gitBinary !== undefined ? { gitBinary: context.gitBinary } : {}),
    ...(context.runner !== undefined ? { runner: context.runner } : {}),
  };
  const result = await loadPolicy({ kind: 'git', repoDir: context.cwd, ref: commit }, loadOptions);

  if (result.ok) {
    const report: PolicyCommandReport = {
      schema_version: 1,
      valid: true,
      authoritative: result.value.authoritative,
      source: { kind: 'git', ref, commit },
      revision: result.value.revision.id,
      notice,
      errors: [],
      warnings: policyWarnings(result.value.policy),
    };
    return { report, exit: 0 };
  }

  const errors = mapFailureToErrors(result.failure);
  const report: PolicyCommandReport = {
    schema_version: 1,
    valid: false,
    authoritative: false,
    source: { kind: 'git', ref, commit },
    revision: treeId,
    notice,
    errors,
    warnings: [],
  };
  return { report, exit: FAILURE_EXIT_CODES[result.failure.code] };
}

export async function runPolicyCommand(argv: readonly string[], context: PolicyCommandContext): Promise<PolicyCommandExitCode> {
  const json = argv.includes('--json');

  let values: { ref?: string; file?: string; json?: boolean };
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: {
        ref: { type: 'string' },
        file: { type: 'string' },
        json: { type: 'boolean' },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const code = err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' ? 'usage.unknown-option' : 'usage.invalid-arguments';
    const message = err.message;
    if (json) {
      const report: PolicyCommandReport = {
        schema_version: 1,
        valid: false,
        authoritative: false,
        source: null,
        revision: null,
        notice: null,
        errors: [{ code, path: '', message, line: null, column: null }],
        warnings: [],
      };
      context.io.stdout(renderJsonLine(report));
    } else {
      context.io.stderr(errorLine({ code, path: '', message }));
      context.io.stderr(`${POLICY_USAGE}\n`);
    }
    return 2;
  }

  if (values.ref !== undefined && values.file !== undefined) {
    const message = '--ref and --file cannot be used together';
    if (json) {
      const report: PolicyCommandReport = {
        schema_version: 1,
        valid: false,
        authoritative: false,
        source: null,
        revision: null,
        notice: null,
        errors: [{ code: 'usage.conflicting-options', path: '', message, line: null, column: null }],
        warnings: [],
      };
      context.io.stdout(renderJsonLine(report));
    } else {
      context.io.stderr(errorLine({ code: 'usage.conflicting-options', path: '', message }));
      context.io.stderr(`${POLICY_USAGE}\n`);
    }
    return 2;
  }

  let known: { source: PolicyCommandSource | null; notice: string | null } = { source: null, notice: null };

  try {
    let outcome: { report: PolicyCommandReport; exit: PolicyCommandExitCode };
    if (values.file !== undefined) {
      known = { source: { kind: 'file', path: values.file }, notice: FILE_SOURCE_NOTICE };
      outcome = await handleFileSource(values.file, context);
    } else {
      const ref = values.ref ?? DEFAULT_POLICY_REF;
      known = { source: { kind: 'git', ref, commit: null }, notice: gitSourceNotice(ref) };
      outcome = await handleGitSource(ref, context);
    }
    writeReport(context.io, outcome.report, json, outcome.exit);
    return outcome.exit;
  } catch {
    const report: PolicyCommandReport = {
      schema_version: 1,
      valid: false,
      authoritative: false,
      source: known.source,
      revision: null,
      notice: known.notice,
      errors: [
        {
          code: 'steward.internal-error',
          path: '',
          message: 'The steward failed unexpectedly; no policy was validated.',
          line: null,
          column: null,
        },
      ],
      warnings: [],
    };
    writeReport(context.io, report, json, 2);
    return 2;
  }
}
