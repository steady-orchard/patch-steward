# ADR-0066: Uniform CLI conventions and exit statuses

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §6.5; `docs/user-manual/commands.md` "CLI conventions"

## Context and Problem Statement

The CLI now has four commands (`steward policy`, `steward preflight`, `steward screen`, `steward report`) whose
flags, output channels, and exit statuses had diverged as each was added on its own. [ADR-0060](0060-steward-preflight-command.md)
mapped a preflight `inconclusive` disposition to exit status 2, the same status used for "could not run" failures,
so a calling script could not tell a usage or environment failure from a run that completed without a conclusion.
`-h` was accepted as a short alias only for help, while every other option used a long flag only. Token
resolution for GitHub access ([ADR-0059](0059-cli-github-authentication.md)) is unaffected and stays as decided
there. The four commands needed one shared convention set before more are added.

## Considered Options

- One convention set for every command, with exit status 3 reserved for `inconclusive`
- Per-command conventions, keeping ADR-0060's mapping of `inconclusive` to exit status 2
- Mapping `inconclusive` to exit status 1 alongside `needs-changes`
- Keeping `-h` as a courtesy alias for `--help`

## Decision Outcome

Chosen option: "One convention set for every command, with exit status 3 reserved for `inconclusive`", because a
calling script needs to tell a usage or environment failure from a run that completed without a conclusion, and
a single exit-status table across commands is the only way a wrapper script can branch without inspecting each
command's documentation separately. Keeping ADR-0060's mapping was rejected because `inconclusive` and "could not
run" would remain indistinguishable at exit status 2. Mapping `inconclusive` to 1 alongside `needs-changes` was
rejected because it conflates an author-facing action with a steward-side failure to reach a conclusion. Keeping
`-h` as a courtesy alias was rejected in favor of long flags only, so each option has exactly one spelling.

Every command accepts long flags only; `steward help` and `steward --help` print the usage, and `-h` is an
unknown command that produces a usage error. Text lines print to standard output; with `--json`, exactly one
line of compact JSON with `schema_version` 1 prints to standard output, on success and on failure alike, and in
JSON mode nothing goes to standard error: warnings go into the `warnings` array and errors into the `errors`
array. In text mode, warnings print as `warning <code>: <message>` and errors as `error <code> <path or ->:
<message>`, both on standard error. GitHub token resolution is unchanged: `GH_TOKEN`, then `GITHUB_TOKEN`, then
`gh auth token`; the token is never stored or printed and is redacted from stored evidence.

Exit status 0 means success, `pass`, or a met contract. Exit status 1 means `needs-changes`, `uncertain`, or
invalid input, including an invalid policy or policy file, or stored evidence that fails verification. Exit
status 2 means a usage, environment, GitHub, or git failure, including an evidence write failure, an unreadable
run directory, and a missing or invalid published policy for `steward screen`. Exit status 3 means
`inconclusive`, in every command that can reach that disposition. Applying these conventions changes two existing
commands: `steward preflight` now exits 3 for an `inconclusive` disposition, where it previously exited 2; and
`steward policy` moves its text-mode errors from standard output to standard error and adopts the warning and
error formats above, while its exit statuses are unchanged.

### Consequences

- This record supersedes the exit-status rule of [ADR-0060](0060-steward-preflight-command.md), whose status
  becomes `superseded by ADR-0066`.
- [Architecture §6.5](../architecture.md), SP05, and the command reference state the shared conventions.
- Commands added after this record follow these conventions from their first version.

## More Information

- The project owner decided this on September 27, 2026.
