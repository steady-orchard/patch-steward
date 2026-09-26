# ADR-0048: `steward policy` command

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §6.5; `docs/user-manual/commands.md` "`steward policy`"

## Context and Problem Statement

Maintainers need to validate a policy before merging it and to see which revision would govern a run before
that run happens. Official screening loads the policy from the trusted branch at an explicit commit, computed
as the content hash of the policy directory. Architecture §6.5 named a `steward policy` command in its command
table without settling its syntax, exit codes, or output. What does the command read, and how does it report
whether its answer is authoritative?

## Considered Options

- Local git objects, no fetch, three exit codes — read the ref from local git objects, never fetch, state the
  authority limit explicitly, and separate an invalid policy from an environment error
- Fetch before reading — update the remote-tracking ref first
- Working-tree file by default — validate the checked-out file unless a ref is given
- One failure exit code — exit 1 for every failure

## Decision Outcome

Chosen option: "Local git objects, no fetch, three exit codes", because reading git objects directly matches
how screening itself loads the policy: the same revision identifier, computed the same inert way, with no
network access and no credentials required. Fetching would need both, and would move the user's
remote-tracking ref without their asking; instead the command states that its result is authoritative only if
the named ref is already current locally. The working tree is not the trusted revision, so it is not the
default source. A single failure exit code cannot tell a calling script whether the policy itself is invalid or
the environment failed to answer the question at all.

The command's syntax, with `--ref origin/HEAD` as the default:

```text
steward policy [--ref <ref> | --file <path>] [--json]
```

With `--ref`, the command resolves the ref to a commit using local git objects only, reads the policy from
that commit, and prints a notice that the result is authoritative only if the ref is current, because no fetch
was performed. With `--file`, the command validates a local file instead and prints a notice that the result
is non-authoritative, because a local file never governs a run. `--json` prints one object with the fields
`schema_version`, `valid`, `authoritative`, `source`, `revision`, `notice`, `errors`, and `warnings`. Exit
status `0` means the policy is valid; `1` means an invalid policy, or that no policy directory or `policy.yml`
exists at a resolvable ref; `2` means a usage or environment error, such as bad arguments, a target that is not
a git repository, git being unavailable, an unresolvable ref, or an unreadable file. Warnings are distinct from
errors and never change the exit status: `policy.llm-model-placeholder` fires when `llm.model` is still the
policy template's `replace-with-model-id` value, is printed on standard error and in the `warnings` array, and
does not fail validation, because the placeholder is a valid value whose run-time effect, an `inconclusive`
model stage, the maintainer should be able to see before merging rather than after a run fails.

### Consequences

- [Architecture §6.5](../architecture.md) states the command's row in the command table and its syntax
  paragraph, including that `steward policy` is implemented while the other listed commands are not.
- The command reference's `steward policy` section documents the flags, exit statuses, and JSON fields.
- Maintainer preflight in [SP01](../processes.md) step 1 uses this command to see which revision would govern a
  run before merging a policy change.
- The CLI package declares the `steward` executable that this command is a subcommand of.

## More Information

- The project owner decided this on September 26, 2026.
