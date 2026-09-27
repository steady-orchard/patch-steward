import { errorLine } from './conventions.js';
import type { StewardExitCode } from './conventions.js';
import { runPreflightCommand } from './preflight-command.js';
import { runPolicyCommand } from './policy-command.js';
import { runScreenCommand } from './screen-command.js';
import type { ScreenCommandContext } from './screen-command.js';
import { runReportCommand } from './report-command.js';
import type { ReportCommandContext } from './report-command.js';

export const STEWARD_USAGE = [
  'usage: steward <command>',
  'commands:',
  '  policy [--ref <ref> | --file <path>] [--json]  validate a policy and show the revision that would govern',
  '  preflight (--issue defect|proposal | --pr) --draft <file.md> [--repo owner/name] [--base <ref>] [--json]  check a draft against the submission contract; the result is unverified',
  '  screen (--issue <number> | --pr <number>) [--repo owner/name] [--policy-file <path>] [--evidence-dir <dir>] [--json]  screen an issue or pull request locally at contract level; not the official result',
  '  report <run-dir> [--json]  verify a stored run and print its report',
].join('\n');

export type StewardCliContext = ScreenCommandContext & ReportCommandContext;

export async function runCli(argv: readonly string[], context: StewardCliContext): Promise<StewardExitCode> {
  const command = argv[0];

  if (command === 'policy') {
    return runPolicyCommand(argv.slice(1), context);
  }

  if (command === 'preflight') {
    return runPreflightCommand(argv.slice(1), context);
  }

  if (command === 'screen') {
    return runScreenCommand(argv.slice(1), context);
  }

  if (command === 'report') {
    return runReportCommand(argv.slice(1), context);
  }

  if (command === 'help' || command === '--help') {
    context.io.stdout(`${STEWARD_USAGE}\n`);
    return 0;
  }

  if (command === undefined) {
    context.io.stderr(errorLine({ code: 'usage.missing-command', path: '', message: 'a command is required' }));
    context.io.stderr(`${STEWARD_USAGE}\n`);
    return 2;
  }

  context.io.stderr(errorLine({ code: 'usage.unknown-command', path: '', message: `unknown command ${command}` }));
  context.io.stderr(`${STEWARD_USAGE}\n`);
  return 2;
}
