# Command reference

[Manual contents](README.md) · [Usage](usage.md) · [Configuration](configuration.md)

## Development commands (Available)

Run from this repository's root with pnpm 10.20.0.

| Command                                           | Purpose                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                  | Install dependencies using the lockfile.                                          |
| `pnpm build`                                      | Run `tsc` in each package; output goes to `packages/*/dist/`.                     |
| `pnpm typecheck`                                  | Type-check each package's sources and tests with `tsc --noEmit`; writes no files. |
| `pnpm test`                                       | Run the Vitest suite once.                                                        |
| `pnpm coverage`                                   | Run Vitest with coverage and the LCOV reporter.                                   |
| `pnpm lint`                                       | Run ESLint.                                                                       |
| `pnpm format`                                     | Apply Prettier formatting.                                                        |
| `pnpm format:check`                               | Check Prettier formatting.                                                        |
| `pnpm vitest run packages/core/src/index.test.ts` | Run the sample test file.                                                         |
| `pnpm vitest run -t 'greets by name'`             | Run the named sample test.                                                        |

Documented verification sequence:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm coverage
```

Sources: [README](../../README.md#development), [package scripts](../../package.json),
[repository guidance](../../CLAUDE.md#commands).

## `steward policy` (Available)

Validates a policy and shows the revision that would govern a run.

The CLI package is private and unpublished, so no global `steward` command is
installed. After `pnpm build`, run the built entry point:

```sh
pnpm build
node packages/cli/dist/main.js policy --file templates/policy/policy.yml
```

The package declares the `steward` executable as `./dist/main.js`, so
`steward policy` below means `node packages/cli/dist/main.js policy`.

Syntax:

```text
steward policy [--ref <ref> | --file <path>] [--json]
```

| Option          | Effect                                                               |
| --------------- | -------------------------------------------------------------------- |
| `--ref <ref>`   | Reads the policy from a git ref (default `origin/HEAD`).             |
| `--file <path>` | Reads the policy from a local file. Cannot be combined with `--ref`. |
| `--json`        | Emits a single JSON object on stdout instead of text lines.          |

With `--ref` (default `origin/HEAD`), the command resolves the ref to a commit
in the repository of the current directory and reads `.github/patch-steward/`
from local git objects with read-only plumbing; it never fetches, checks out,
or reads the working tree. The revision is the git tree id of the policy
directory at that commit, and the notice reads exactly
`authoritative only if <ref> is current; no fetch was performed`.
With `--file <path>`, the command validates a local file; the revision is
`local:<sha256 of the file bytes>`, and the notice reads exactly
`non-authoritative: a local file never governs a run`.

The text output (stdout) reports, for a valid ref run:

```text
policy: valid
source: ref origin/HEAD -> commit <commit id>
revision: <tree id>
notice: authoritative only if origin/HEAD is current; no fetch was performed
```

Other line forms: `policy: invalid` or `policy: unavailable`; `source: file
<path>` or `source: ref <ref>` when the ref could not be resolved; `revision:
none` when there is no revision. Each error is printed as `error <code> <path>
<message>` (`-` for an empty path), with ` (line L, column C)` appended when
known. On failure, the last stdout line is
`outcome: inconclusive; no default was substituted`. Warnings are printed on
stderr as `warning <code> <path> <message>`.

With `--json`, the command emits one line on stdout: an object with
`schema_version` (`1`), `valid`, `authoritative` (true only for a valid policy
read from a git ref), `source` (`{ "kind": "git", "ref", "commit" }`, `{
"kind": "file", "path" }`, or `null` for usage errors), `revision`, `notice`,
`errors` (items with `code`, `path`, `message`, `line`, `column`), and
`warnings` (items with `code`, `path`, `message`; `[]` when none). Nothing is
printed on stderr in this mode except usage errors.

| Exit status | Meaning                                                                                                                                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`         | Valid policy. Warnings never change it.                                                                                                                                                                                                                                                                                                     |
| `1`         | Invalid policy: every `policy.*` and `yaml.*` code, no `.github/patch-steward/` directory or no `policy.yml` at a resolvable ref (`git.policy-directory-missing`, `git.entry-missing`), or a policy entry that is not a regular file or too large (`git.not-a-directory`, `git.entry-not-regular`, `git.blob-too-large`, `file.too-large`). |
| `2`         | Usage or environment error: bad or conflicting options, not a git repository, git unavailable, unresolvable ref (`git.ref-unresolvable`), invalid ref, git timeout or failure, missing or unreadable `--file` path (`file.not-found`, `file.not-a-file`, `file.unreadable`), or an unexpected internal error (`steward.internal-error`).    |

Usage errors are printed on stderr as `error <code> <message>` followed by the
usage line, with codes `usage.unknown-option`, `usage.invalid-arguments`, and
`usage.conflicting-options`. Running `steward` with no command produces
`usage.missing-command`, and an unknown command produces
`usage.unknown-command` (both exit `2`). `steward help`, `--help`, and `-h`
print usage and exit `0`.

Example:

```text
$ node packages/cli/dist/main.js policy --file templates/policy/policy.yml 2>&1
policy: valid
source: file templates/policy/policy.yml
revision: local:<sha256>
notice: non-authoritative: a local file never governs a run
warning policy.llm-model-placeholder llm.model llm.model is the template placeholder replace-with-model-id; replace it with a real model id. A run that reaches a model stage with it ends inconclusive.
```

The error and warning codes are explained in the [configuration reference](configuration.md).

Sources: [architecture §6.5](../architecture.md#65-command-line-interface-packagescli), [SP01](../processes.md#sp01-policy-management), [CLI source](../../packages/cli/src/policy-command.ts).

## CLI commands (Proposed)

These names appear in the design; the repository does not implement them.

| Command             | Intended purpose                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `steward init`      | Install target-repository templates and labels, select inference settings, and print manual setup steps. |
| `steward preflight` | Check the contributor's local draft and branch, with optional self-review; print unverified results.     |
| `steward screen`    | Screen an issue or PR using a local container, with optional attributed publication.                     |
| `steward replay`    | Evaluate a labeled historical dataset with labels withheld from screening.                               |
| `steward report`    | Render a stored run or evidence record locally.                                                          |

> **[NEEDS INPUT]** Full positional arguments, flags, exit codes, output formats,
> file-selection rules, and authentication commands of these commands are not defined. In particular,
> SP20 requires an explicit publication flag but does not name it.

Source: [architecture §6.5](../architecture.md#65-command-line-interface-packagescli).

## GitHub conversation commands (Proposed)

Post a command at the start of a **new conversation comment** on an issue or PR.
Review comments are not command entry points; editing an existing command does
not reprocess it. A reaction acknowledges the command, and results appear in the
updated report.

Uppercase words below are placeholders to replace. Brackets mark optional inputs.
These are proposed GitHub comment syntax, not shell commands.

```text
/steward rerun [stage]
/steward override pass REASON
/steward override needs-changes CODE REASON
/steward guidance TEXT
/steward waive REQUIREMENT REASON
/steward accept REASON
/steward resolve CODE
/steward audit RUN confirm
/steward audit RUN dispute REASON
/steward time MINUTES [KIND]
/steward appeal REASON
```

| Command    | Who may use it                                | Effect                                                                                                                                  |
| ---------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `rerun`    | Maintainer, or author on their own submission | Start fresh screening; a maintainer's rerun also admits an inference-held submission. Partial reruns cannot omit other required stages. |
| `override` | Maintainer                                    | Record the selected effective outcome, reason, scope, and waived/remaining requirements.                                                |
| `guidance` | Maintainer                                    | Record scoped project intent. The text remains input data, not policy or tool authorization.                                            |
| `waive`    | Maintainer                                    | Waive a named requirement for one submission within the recorded scope.                                                                 |
| `accept`   | Maintainer                                    | Record proposal or PR intent acceptance; does not waive technical screening.                                                            |
| `resolve`  | Maintainer                                    | Record a dismissal code at or after closure for calibration; on a proposal issue, record its decline.                                   |
| `audit`    | Maintainer                                    | Confirm or dispute a sampled run.                                                                                                       |
| `time`     | Maintainer                                    | Record minutes; documented kinds include `review`, `triage`, `appeal`, `audit`, and `override`.                                         |
| `appeal`   | Author only, on their own submission          | Open a maintainer-triage appeal; only one may be open at a time.                                                                        |

Maintainers need write, maintain, or admin permission, verified through the API.
Unauthorized commands are ignored. An unparseable command from an authorized
user receives one usage reply.

Issue acceptance binds to the proposal content hash. PR acceptance binds to the
PR, target, and canonical claim-scope text hash, so implementation pushes with
unchanged scope retain intent acceptance. Overrides and waivers bind to the
issue snapshot or PR head/target and requirements.

> **[NEEDS INPUT]** Accepted values for `stage`, `REQUIREMENT`, and `RUN`, and the complete
> `KIND` vocabulary, are not specified. `CODE` takes a dismissal code from the policy's catalog:
> the nine built-in codes plus the project's additions, listed in the [configuration reference](configuration.md).

Sources: [SP15](../processes.md#sp15-maintainer-triage-override-and-appeal),
[SP19](../processes.md#sp19-resource-control-and-failure-handling).
