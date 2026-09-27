import process from 'node:process';
import * as os from 'node:os';
import * as path from 'node:path';

import type { AttachmentResolver, AttachmentTransport, Clock, RandomSource, ScreenDeps, ScreenResult } from '@patch-steward/core';
import { screenSubmission } from '@patch-steward/core';

import type { CliError, CliWarning, StewardExitCode } from './conventions.js';
import { renderJsonLine, writeTextDiagnostics } from './conventions.js';
import type { PreflightCommandContext } from './preflight-command.js';
import { PREFLIGHT_UNAUTHENTICATED_WARNING } from './preflight-command.js';
import { resolveGitHubAuth } from './github-auth.js';
import { cliGitOptions, resolveUpstream } from './upstream.js';
import { resolveEvidenceDir } from './evidence-dir.js';
import { SCREEN_USAGE, parseScreenArgs } from './screen-args.js';
import type { ScreenArgs } from './screen-args.js';
import { screenFailureJson, screenResultErrors, screenResultJson, screenTextStdout } from './screen-output.js';
import type { ScreenOutputContext } from './screen-output.js';

export const SCREEN_COMMAND_FAILURE_CODES = [
  'screen.no-upstream',
  'screen.repository-unavailable',
  'screen.token-rejected',
  'screen.evidence-dir-unavailable',
  'steward.internal-error',
] as const;

export type ScreenCommandFailureCode = (typeof SCREEN_COMMAND_FAILURE_CODES)[number];

export const SCREEN_NO_UPSTREAM_MESSAGE = 'No GitHub remote named upstream or origin was found; pass --repo owner/name.';
export const SCREEN_INTERNAL_ERROR_MESSAGE = 'The steward failed unexpectedly; no run was completed.';

export interface ScreenCommandContext extends PreflightCommandContext {
  readonly platform?: string;
  readonly homedir?: () => string;
  readonly attachmentResolver?: AttachmentResolver;
  readonly attachmentTransport?: AttachmentTransport;
  readonly clock?: Clock;
  readonly random?: RandomSource;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly screen?: (deps: ScreenDeps) => Promise<ScreenResult>;
}

export async function runScreenCommand(argv: readonly string[], context: ScreenCommandContext): Promise<StewardExitCode> {
  const io = context.io;
  const env = context.env ?? process.env;

  const parsed = parseScreenArgs(argv);
  if (!parsed.ok) {
    const errors: CliError[] = [{ code: parsed.code, path: '', message: parsed.message }];
    if (parsed.json) {
      io.stdout(renderJsonLine(screenFailureJson({ submission: null, repository: null, warnings: [], errors })));
    } else {
      writeTextDiagnostics(io, [], errors);
      io.stderr(`${SCREEN_USAGE}\n`);
    }
    return 2;
  }

  const args: ScreenArgs = parsed.args;
  const json = args.json;
  const warnings: CliWarning[] = [];
  let requested: string | null = null;

  function fail(errors: readonly CliError[]): StewardExitCode {
    if (json) {
      io.stdout(renderJsonLine(screenFailureJson({ submission: args.submission, repository: requested, warnings, errors })));
    } else {
      writeTextDiagnostics(io, warnings, errors);
    }
    return 2;
  }

  try {
    const upstream = await resolveUpstream(args.repository, cliGitOptions(context), { readRemote: false });
    if (!upstream.ok) {
      if (upstream.reason === 'git-failure') {
        return fail([{ code: upstream.code, path: '', message: upstream.message }]);
      }
      return fail([{ code: 'screen.no-upstream', path: '', message: SCREEN_NO_UPSTREAM_MESSAGE }]);
    }
    requested = `${upstream.repository.owner}/${upstream.repository.name}`;

    const authResult = await resolveGitHubAuth({
      env,
      cwd: context.cwd,
      ...(context.runner !== undefined ? { runner: context.runner } : {}),
      ...(context.ghBinary !== undefined ? { ghBinary: context.ghBinary } : {}),
    });
    if (!authResult.ok) {
      return fail([{ code: authResult.code, path: '', message: authResult.message }]);
    }
    const token = authResult.auth.token;
    if (authResult.auth.source === 'none') {
      warnings.push({ code: 'github.unauthenticated', message: PREFLIGHT_UNAUTHENTICATED_WARNING });
    }

    const evidence = await resolveEvidenceDir({
      given: args.evidenceDir,
      cwd: context.cwd,
      environment: {
        platform: context.platform ?? process.platform,
        env,
        homedir: context.homedir ?? os.homedir,
      },
    });
    if (!evidence.ok) {
      return fail([{ code: evidence.code, path: '', message: evidence.message }]);
    }
    for (const warning of evidence.warnings) {
      warnings.push({ code: warning.code, message: warning.message });
    }

    const policySource =
      args.policyFile === null
        ? ({ kind: 'trusted-branch' } as const)
        : ({ kind: 'local-file', path: path.resolve(context.cwd, args.policyFile) } as const);

    const deps: ScreenDeps = {
      repository: upstream.repository,
      submission: args.submission,
      policySource,
      token,
      evidenceDir: evidence.path,
      ...(context.fetch !== undefined ? { fetch: context.fetch } : {}),
      ...(context.sleep !== undefined ? { sleep: context.sleep } : {}),
      ...(context.attachmentResolver !== undefined ? { attachmentResolver: context.attachmentResolver } : {}),
      ...(context.attachmentTransport !== undefined ? { attachmentTransport: context.attachmentTransport } : {}),
      ...(context.clock !== undefined ? { clock: context.clock } : {}),
      ...(context.random !== undefined ? { random: context.random } : {}),
    };

    const result = await (context.screen ?? screenSubmission)(deps);

    const outputContext: ScreenOutputContext = {
      submission: args.submission,
      requestedRepository: requested,
      policyPathShown: args.policyFile,
      tokenPresent: token !== null,
      warnings,
    };

    if (json) {
      io.stdout(renderJsonLine(screenResultJson(result, outputContext)));
    } else if (result.kind === 'completed') {
      io.stdout(screenTextStdout(result, args.policyFile));
      writeTextDiagnostics(io, warnings, []);
    } else {
      writeTextDiagnostics(io, warnings, screenResultErrors(result, outputContext));
    }

    return result.exitStatus;
  } catch {
    return fail([{ code: 'steward.internal-error', path: '', message: SCREEN_INTERNAL_ERROR_MESSAGE }]);
  }
}
