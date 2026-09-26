import type { PolicyCommandContext, PolicyCommandExitCode } from './policy-command.js';
import { runPolicyCommand } from './policy-command.js';

export const STEWARD_USAGE =
  'usage: steward <command>\ncommands:\n  policy [--ref <ref> | --file <path>] [--json]  validate a policy and show the revision that would govern';

export async function runCli(argv: readonly string[], context: PolicyCommandContext): Promise<PolicyCommandExitCode> {
  const command = argv[0];

  if (command === 'policy') {
    return runPolicyCommand(argv.slice(1), context);
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    context.io.stdout(`${STEWARD_USAGE}\n`);
    return 0;
  }

  if (command === undefined) {
    context.io.stderr('error usage.missing-command a command is required\n');
    context.io.stderr(`${STEWARD_USAGE}\n`);
    return 2;
  }

  context.io.stderr(`error usage.unknown-command unknown command ${command}\n`);
  context.io.stderr(`${STEWARD_USAGE}\n`);
  return 2;
}
