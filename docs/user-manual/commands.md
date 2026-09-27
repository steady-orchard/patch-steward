# Command reference

[Manual contents](README.md) · [Usage](usage.md) · [Configuration](configuration.md)

## Development commands (Available)

Run from this repository's root with pnpm 10.20.0.

| Command                                           | Purpose                                                                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                  | Install dependencies using the lockfile.                                                                                                                         |
| `pnpm build`                                      | Run `tsc` in each package; output goes to `packages/*/dist/`.                                                                                                    |
| `pnpm typecheck`                                  | Type-check each package's sources and tests with `tsc --noEmit`; writes no files.                                                                                |
| `pnpm test`                                       | Run the Vitest suite once.                                                                                                                                       |
| `pnpm test:live`                                  | Run the live-probe tier (`*.live.test.ts`) read-only against a public test-bed repository; needs network access, uses `GH_TOKEN` when set, and never runs in CI. |
| `pnpm coverage`                                   | Run Vitest with coverage and the LCOV reporter.                                                                                                                  |
| `pnpm lint`                                       | Run ESLint.                                                                                                                                                      |
| `pnpm format`                                     | Apply Prettier formatting.                                                                                                                                       |
| `pnpm format:check`                               | Check Prettier formatting.                                                                                                                                       |
| `pnpm vitest run packages/core/src/index.test.ts` | Run the sample test file.                                                                                                                                        |
| `pnpm vitest run -t 'greets by name'`             | Run the named sample test.                                                                                                                                       |

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

## CLI conventions (Available)

These conventions apply to `steward policy`, `steward preflight`, `steward screen`, and `steward report`.

- Only long flags are accepted. `steward help` and `steward --help` print the usage and exit `0`. `-h` is not a flag: it is treated as an unknown command (`usage.unknown-command`, exit `2`). Running with no command produces `usage.missing-command` (exit `2`); both print the error line and the usage on stderr.
- Text mode writes output lines to stdout, warnings to stderr as `warning <code>: <message>`, and errors to stderr as `error <code> <path or ->: <message>` (`-` for an empty path); a usage error adds the command's usage line on stderr.
- With `--json`, the command emits exactly one line of compact JSON (no indentation) on stdout, including on failure, with `schema_version` `1`; warnings appear in a `warnings` array and errors in an `errors` array, and nothing is written to stderr, usage errors included. Control characters, line and paragraph separators, and Unicode format characters inside the JSON are written as JSON Unicode escapes.
- Text quoted from GitHub, a draft, a policy path, or a run directory is printed with credential-like text redacted, each backslash doubled, control and invisible formatting characters replaced by visible escapes, and values longer than 4096 characters shortened with an ellipsis.
- Commands that read GitHub use `GH_TOKEN`, else `GITHUB_TOKEN`, else the output of `gh auth token` for `github.com` when the GitHub CLI is installed; the token is never stored or printed, and is redacted from stored evidence.

| Exit status | Meaning                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`         | Success: a valid policy, a met contract, or outcome `pass`.                                                                                                                     |
| `1`         | `needs-changes` or `uncertain`, or invalid input (an invalid policy or policy file, stored evidence that fails verification).                                                   |
| `2`         | A usage, environment, GitHub, or git failure, including an evidence write failure, an unreadable run directory, and a missing or invalid published policy for `steward screen`. |
| `3`         | `inconclusive`, in every command.                                                                                                                                               |

Sources: [architecture §6.5](../architecture.md#65-command-line-interface-packagescli), [CLI source](../../packages/cli/src/conventions.ts).

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
none` when there is no revision. Each error is printed on stderr as
`error <code> <path or ->: <message>`, with ` (line L, column C)` appended when
known. On failure, the last stdout line is
`outcome: inconclusive; no default was substituted`. Warnings are printed on stderr as
`warning <code>: <message>`.

With `--json`, the command emits one line on stdout: an object with
`schema_version` (`1`), `valid`, `authoritative` (true only for a valid policy
read from a git ref), `source` (`{ "kind": "git", "ref", "commit" }`, `{
"kind": "file", "path" }`, or `null` for usage errors), `revision`, `notice`,
`errors` (items with `code`, `path`, `message`, `line`, `column`), and
`warnings` (items with `code`, `path`, `message`; `[]` when none). Nothing is
printed on stderr in this mode, usage errors included.

| Exit status | Meaning                                                                                                                                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`         | Valid policy. Warnings never change it.                                                                                                                                                                                                                                                                                                     |
| `1`         | Invalid policy: every `policy.*` and `yaml.*` code, no `.github/patch-steward/` directory or no `policy.yml` at a resolvable ref (`git.policy-directory-missing`, `git.entry-missing`), or a policy entry that is not a regular file or too large (`git.not-a-directory`, `git.entry-not-regular`, `git.blob-too-large`, `file.too-large`). |
| `2`         | Usage or environment error: bad or conflicting options, not a git repository, git unavailable, unresolvable ref (`git.ref-unresolvable`), invalid ref, git timeout or failure, missing or unreadable `--file` path (`file.not-found`, `file.not-a-file`, `file.unreadable`), or an unexpected internal error (`steward.internal-error`).    |

Usage errors print `error <code> -: <message>` and the usage line on stderr,
with codes `usage.unknown-option`, `usage.invalid-arguments`, and
`usage.conflicting-options`; for help, missing commands, and unknown commands,
see [CLI conventions](#cli-conventions-available).

Example:

```text
$ node packages/cli/dist/main.js policy --file templates/policy/policy.yml 2>&1
policy: valid
source: file templates/policy/policy.yml
revision: local:<sha256>
notice: non-authoritative: a local file never governs a run
warning policy.llm-model-placeholder: llm.model is the template placeholder replace-with-model-id; replace it with a real model id. A run that reaches a model stage with it ends inconclusive.
```

The error and warning codes are explained in the [configuration reference](configuration.md).

Sources: [architecture §6.5](../architecture.md#65-command-line-interface-packagescli), [SP01](../processes.md#sp01-policy-management), [CLI source](../../packages/cli/src/policy-command.ts).

## `steward preflight` (Available)

Checks a draft issue or pull request against the target repository's submission
contract before you submit it. This is the deterministic part of contributor
preflight: running the policy's mandatory commands on your machine and the
optional self-review session are proposed and not implemented. The result is a
claim; official screening repeats every check.

After `pnpm build`, run the built entry point, as for
[`steward policy`](#steward-policy-available):

```sh
node packages/cli/dist/main.js preflight --issue defect --draft fixtures/submissions/defect-complete.txt --repo steady-orchard/patch-steward-testbed-public
```

Syntax:

```text
steward preflight (--issue defect|proposal | --pr) --draft <file.md> [--repo owner/name] [--base <ref>] [--json]
```

| Option                                 | Effect                                                                                                                                                                                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--issue defect` or `--issue proposal` | Checks the draft as a defect or proposal issue; the draft must match that issue form.                                                                                                                                                                                                    |
| `--pr`                                 | Checks the draft as a pull request description against the committed changes of the current branch. Cannot be combined with `--issue`.                                                                                                                                                   |
| `--draft <file.md>`                    | Required. The draft, relative to the current directory: Markdown in the rendered issue-form or pull request template layout (see the [submission settings](configuration.md#submission)), at most 262144 bytes of UTF-8; one leading byte-order mark and CRLF line endings are accepted. |
| `--repo owner/name`                    | The upstream repository. Default: the GitHub repository of the `upstream` remote, else of `origin`.                                                                                                                                                                                      |
| `--base <ref>`                         | Pull requests only: the base to compare with. Default: the local remote-tracking ref of the upstream default branch, such as `refs/remotes/origin/main`.                                                                                                                                 |
| `--json`                               | Emits one JSON object on stdout instead of text lines.                                                                                                                                                                                                                                   |

The command reads the upstream repository and its policy through the GitHub API
and reads the local repository with read-only git plumbing. It never writes to
GitHub, fetches git objects, reads the working tree, runs a repository or policy
command, or sends telemetry.

- Policy: the published policy on the upstream default branch
  (`.github/patch-steward/policy.yml`), identified by its revision, the git tree
  id of `.github/patch-steward/`. When the branch has no published policy, the
  policy template's resolved policy serves as the default checklist. A published
  but invalid policy is never replaced: the command prints its validation errors
  and exits `2`.
- Issues: the draft is parsed with the issue form named by `--issue`; a draft
  that matches the other form, or none, is unstructured.
- Pull requests: `HEAD` must name a commit. The changed paths are the committed
  changes from the merge base of the base and `HEAD` to `HEAD`; uncommitted
  changes are ignored. The declared category is checked against those paths;
  trusted, execution-sensitive, and policy paths are flagged; and a changed
  `.github/patch-steward/policy.yml` is validated and reported as data. The
  linked issue's existence is read through the GitHub API.
- Attachments are checked from their URLs only (count, destination, scheme,
  user information, format) and never fetched; a URL that does not show its
  format gets the warning `attachment.format-unverified`.
- There is no snapshot and no check for other pull requests sharing the head
  commit, because no pull request exists yet.

GitHub authentication: the command uses `GH_TOKEN`, else `GITHUB_TOKEN`, else the
output of `gh auth token` for `github.com` when the GitHub CLI is installed. The
token is never stored or printed. A variable that is set but is not a usable
token fails with `auth.token-invalid`. Without any token, reads of a public
repository proceed unauthenticated, with a lower rate limit, and the warning
`github.unauthenticated`; a private or missing repository then fails with
`preflight.repository-unavailable`. A token that GitHub rejects fails with
`preflight.token-rejected`, without an unauthenticated retry. The command makes
at most 20 GitHub requests, with at most 2 retries each.

Text output (stdout), in this order:

```text
unverified: produced on the contributor's machine; official screening treats it as a claim
policy: published <owner/name> <branch> commit <commit id> revision <tree id>
submission: issue <defect or proposal>
template: <form> v<version>
mode: <observe, advise, or enforce> enforced <true or false>
disposition: <met, needs-changes, uncertain, or inconclusive>
```

Other line forms: `policy: default checklist (<owner/name> has no published policy on <branch>)`;
`submission: pull request`; `template: none` for an unstructured draft. Pull
requests add, before `disposition`, the lines
`category: <category or none> plausible <categories or none>`,
`paths: base <id> merge-base <id> head <id> changed <count or too-many>`,
`flags: trusted-paths-changed <bool> execution-sensitive-paths-changed <bool> policy-changed <bool>`,
and, for a policy change, one of `proposed-policy: valid revision <id>`,
`proposed-policy: invalid revision <id>` followed by an indented
`proposed-policy-error <code> <path>: <message>` line per error,
`proposed-policy: removed`, or `proposed-policy: unavailable`. After
`disposition`, each finding is printed as
`finding <code> <severity>[ field <field id>][ detail <detail>]: <message>`
with up to 20 indented `subject <text>` lines and `subjects not shown: <n>`
beyond them, each request as `request <n>: <text>`, and each inconclusive cause
as `inconclusive <cause> <code>: <message>`. Warnings
(`warning <code>: <message>`) and errors (`error <code> <path or ->: <message>`)
go to stderr; after an error, stdout is empty. Text quoted from the draft, the
repository, or GitHub is printed with control and invisible formatting
characters escaped and credential-like text redacted.

With `--json`, the command prints one line: an object with `schema_version`
(`1`), `unverified` (`true`), `notice`, `submission` (`type`, `issue_kind`),
`repository`, `policy` (`source`: `published` or `default-checklist`,
`repository`, `ref`, `commit`, `revision`), `contract` (`disposition`,
`findings`, `requests`, `inconclusive`, `category`, `plausible_categories`,
`effective_mode`, `enforced`, `template`), `paths` (`base`, `head`,
`merge_base`, `changed`, `trusted_changed`, `execution_sensitive_changed`,
`policy_changed`, `trusted_paths`, `execution_sensitive_paths`, `policy_paths`,
`policy_change`) or `null` for issues, `warnings` (`code`, `message`,
`subjects`), and `errors` (`code`, `path`, `message`). On failure `contract` is
`null` and `errors` names the failure; nothing is printed on stderr in this
mode.

Findings and their effect on the disposition:

| Code                                     | Severity  | Effect        | Raised when                                                                                                       |
| ---------------------------------------- | --------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `submission.unstructured`                | blocking  | needs-changes | The body matches no supported template version and free-form submissions are off; the request links the template. |
| `submission.field-duplicate`             | blocking  | needs-changes | A mapped heading appears more than once.                                                                          |
| `submission.field-missing`               | blocking  | needs-changes | A field the policy requires is absent or trivial.                                                                 |
| `submission.category-missing`            | blocking  | needs-changes | The `Category` field is absent or trivial.                                                                        |
| `submission.category-invalid`            | blocking  | needs-changes | The `Category` value is not exactly one category id.                                                              |
| `submission.linked-issue-missing`        | blocking  | needs-changes | The category requires a linked issue and none is named.                                                           |
| `submission.linked-issue-invalid`        | blocking  | needs-changes | The linked issue is not exactly one existing issue in this repository.                                            |
| `submission.attachment-violation`        | blocking  | needs-changes | An attachment breaks a rule; the detail names the rule.                                                           |
| `submission.shared-head`                 | blocking  | needs-changes | Another open pull request shares the head commit (screening only).                                                |
| `submission.category-mismatch`           | uncertain | uncertain     | The declared category is not consistent with the changed paths.                                                   |
| `submission.category-enforced-ambiguity` | uncertain | uncertain     | The category is ambiguous and a plausible category is enforced.                                                   |
| `submission.execution-sensitive-change`  | uncertain | uncertain     | An execution-sensitive path changed; maintainer triage is required.                                               |
| `submission.diff-too-large`              | uncertain | uncertain     | More than 3000 paths changed.                                                                                     |
| `submission.attachment-unavailable`      | advisory  | none          | An optional attachment could not be fetched (screening only).                                                     |
| `submission.trusted-path-change`         | advisory  | none          | A trusted path changed.                                                                                           |
| `submission.policy-change`               | advisory  | none          | The policy directory changed; the proposed policy is reported, never applied.                                     |

The disposition is `needs-changes` when a blocking finding exists, else
`inconclusive` when a required read failed, else `uncertain` when an uncertain
finding exists, else `met`. Severity wording in the draft and the author's
identity never affect it. Each blocking finding comes with a numbered request
that names the section to edit.

| Exit status | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`         | Disposition `met`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `1`         | Disposition `needs-changes` or `uncertain`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `2`         | A usage error (`usage.unknown-option`, `usage.invalid-arguments`, `usage.conflicting-options`); an unreadable draft (`preflight.draft-not-found`, `preflight.draft-unreadable`, `preflight.draft-too-large`, `preflight.draft-invalid-utf8`); an environment or GitHub failure (`auth.token-invalid`, `preflight.no-upstream`, `preflight.head-unresolvable`, `preflight.base-unresolvable`, `preflight.repository-unavailable`, `preflight.token-rejected`, `git.*`, `github.*`); an invalid published policy (`preflight.policy-invalid`); or an unexpected internal error (`steward.internal-error`). |
| `3`         | Disposition `inconclusive`: a required read failed, such as the linked issue.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Usage errors print `error <code> -: <message>` and the preflight usage line on
stderr. A draft over 262144 bytes, or with more than 65536 characters, GitHub's
limit for an issue or pull request body, fails with `preflight.draft-too-large`.

Example, a complete defect draft checked against a repository without a
published policy:

```text
$ node packages/cli/dist/main.js preflight --issue defect --draft fixtures/submissions/defect-complete.txt --repo steady-orchard/patch-steward-testbed-public
unverified: produced on the contributor's machine; official screening treats it as a claim
policy: default checklist (steady-orchard/patch-steward-testbed-public has no published policy on master)
submission: issue defect
template: defect v1
mode: observe enforced false
disposition: met
```

Sources: [architecture §6.5](../architecture.md#65-command-line-interface-packagescli),
[SP05](../processes.md#sp05-contributor-preflight),
[SP06](../processes.md#sp06-intake-and-submission-contract-check),
[CLI source](../../packages/cli/src/preflight-command.ts).

## `steward screen` (Available)

Screens an existing issue or pull request locally at contract level and records local evidence and a report. The result is a local run, never the repository's official screening result.

After `pnpm build`, run the built entry point, as for [`steward policy`](#steward-policy-available):

```sh
node packages/cli/dist/main.js screen --issue 29 --repo steady-orchard/patch-steward-testbed-public --policy-file templates/policy/policy.yml
```

Syntax:

```text
steward screen (--issue <number> | --pr <number>) [--repo owner/name] [--policy-file <path>] [--evidence-dir <dir>] [--json]
```

| Option                 | Effect                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--issue <number>`     | Screens the named issue. A positive decimal number, no sign or leading zero, at most 2147483647. Cannot be combined with `--pr`.                   |
| `--pr <number>`        | Screens the named pull request, with the same number format. Cannot be combined with `--issue`; both give `usage.conflicting-options`.             |
| `--repo owner/name`    | The upstream repository. Default: the GitHub repository of the `upstream` remote, else of `origin`; git remotes are read only without this option. |
| `--policy-file <path>` | Reads the policy from a local file, relative to the current directory. The run is non-authoritative.                                               |
| `--evidence-dir <dir>` | The evidence store root, relative to the current directory. See below for the default.                                                             |
| `--json`               | Emits one JSON object on stdout instead of text lines.                                                                                             |

Policy: without `--policy-file`, the command reads `.github/patch-steward/policy.yml` from the upstream default branch through the GitHub API; the revision is the git tree id of `.github/patch-steward/`, and the branch and commit are recorded. This policy is authoritative. When the default branch has no published policy, the command fails with `screen.policy-missing` (exit `2`) and the message "The repository has no published policy on its default branch. Pass --policy-file <path> to screen under a local policy file." An invalid published policy fails with `screen.policy-invalid` (exit `2`) and the validation errors. Unlike [`steward preflight`](#steward-preflight-available), the default checklist is never used. With `--policy-file`, the revision is `local:<sha256 of the file bytes>`; an invalid file fails with `screen.policy-file-invalid` (exit `1`) and the validation errors; a missing or unreadable file fails with a `file.*` code (exit `2`).

What runs: `gate` loads the policy, reads the issue or pull request through the GitHub API as in [SP06](../processes.md#sp06-intake-and-submission-contract-check) (its linked issue, attachments per policy, open pull requests sharing the head commit), hashes the snapshot, checks the contract, and plans the required stages. A run exists only once `gate` succeeds; a failure before that writes nothing and exits `2` (`1` for an invalid policy file). No stage, model call, or execution runs. `publish` decides the outcome, renders the report and check-run summary, and writes the run directory. Author responses to earlier requests are not read yet. Closed issues and pull requests are screened like open ones.

Outcomes at contract level: `needs-changes` when the contract fails, including a head commit shared with other open pull requests; otherwise `inconclusive` with cause `stage-incomplete`, because every run requires reference verification and claim validation (plus reproduction for a defect issue, plus the stages the policy's `stages.per_category` lists for a pull request's plausible categories) and no stage exists yet. A contract cause such as `github-unavailable` or `attachment-fetch-failed` also ends `inconclusive`. Findings, including `uncertain` ones, stay in the report and evidence.

GitHub access is read-only: GET requests to `api.github.com` only, nothing written, no check created. The repository and policy reads use at most 20 requests with at most 2 retries each; the submission reads use the policy's `limits.github.requests_per_run` and `limits.github.retries_per_request`. Authentication is as in [CLI conventions](#cli-conventions-available); without a token, the command warns `github.unauthenticated`; a missing or private repository fails with `screen.repository-unavailable` (exit `2`); a rejected token fails with `screen.token-rejected` (exit `2`); a set but unusable token variable fails with `auth.token-invalid` (exit `2`).

Evidence directory (store root): `--evidence-dir <dir>`, relative to the current directory and created when the run is written; otherwise the user data directory:

| Platform | Default store root                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Windows  | `%LOCALAPPDATA%\patch-steward\evidence`, or `<home>\AppData\Local\patch-steward\evidence` when LOCALAPPDATA is unset or relative |
| macOS    | `<home>/Library/Application Support/patch-steward/evidence`                                                                      |
| other    | `$XDG_DATA_HOME/patch-steward/evidence` when XDG_DATA_HOME is absolute, else `<home>/.local/share/patch-steward/evidence`        |

No home directory fails with `screen.evidence-dir-unavailable` (exit `2`). An `--evidence-dir` inside the git work tree of the current directory warns `screen.evidence-inside-checkout` (never commit run directories). The run directory is `<store root>/<owner>/<repo>/runs/<issue or pr>-<number>/<run id>/`, with run id `local-<YYYYMMDDTHHMMSSZ>-<8 lowercase hex>`; its files are described in [Evidence](configuration.md#evidence) (which covers redaction) and architecture [§11](../architecture.md#11-evidence-store-and-publication).

A publish failure (decision, rendering, redaction, re-validation, file write, rename) leaves no run directory and no report, exits `2`, and prints `screen.evidence-write-failed` followed by a second error naming the underlying code, for example `evidence.redaction-invalidated`, `evidence.too-large`, `evidence.write-failed`, or `redaction.timeout`. An unexpected failure gives `steward.internal-error` (exit `2`). Other pre-run codes keep their own names: `github.*`, `snapshot.*`, `git.*`, `intake.record-invalid`, `steward.version-unavailable`, `pipeline.phase-timeout`.

Text output (stdout), in this order:

```text
local run: not the repository's official screening result
non-authoritative: screened under a local policy file (<revision>)
policy: <owner/name> <branch> commit <commit id> revision <tree id>
submission: <issue or pull request> <number> (<owner/name>)
outcome: <outcome>
cause: <cause>
request R<n>: <text>
run directory: <absolute path>
```

The non-authoritative line appears only with `--policy-file`; policy prints `policy: local file <path> revision local:<sha256>` in that case. There is one `cause` line per inconclusive cause and one `request` line per request. Warnings and errors go to stderr; after an error, stdout is empty. Values are escaped as in [CLI conventions](#cli-conventions-available); on Windows the run directory prints with doubled backslashes.

With `--json`, the command prints one line: an object with `schema_version` (`1`), `command` (`"screen"`), `local_run` (always `true`), `authoritative` (true exactly when the policy came from the trusted branch; false for a local policy file or when no policy was loaded), `notices` (always the first text line above, plus the non-authoritative line exactly when a policy was loaded and `authoritative` is false), `repository`, `submission` (`type` `issue` or `pull_request`, `number`; `null` for a usage error), `policy` (`source` `trusted-branch` or `local-file`, `revision`, `ref`, `commit`, `path`; `ref` and `commit` are `null` for a local file, `path` is as given and `null` for the trusted branch; the whole member is `null` when no policy was loaded), `run` (`run_id`, `run_attempt`, `directory` absolute or `null` when the evidence write failed, `snapshot_hash`; `null` before a run exists), `outcome` (`null` on failure), `causes` (`cause`, `code`, `subjects`; present only for `inconclusive`), `findings` (`finding_id`, `code`, `severity`, `field`, `subjects`), `requests` (`request_id`, `text`), `warnings` (`code`, `message`), and `errors` (`code`, `path`, `message`).

Real example (live test-bed; revision, run id, directory, and hash vary):

```json
{
  "schema_version": 1,
  "command": "screen",
  "local_run": true,
  "authoritative": false,
  "notices": [
    "local run: not the repository's official screening result",
    "non-authoritative: screened under a local policy file (local:<sha256>)"
  ],
  "repository": "steady-orchard/patch-steward-testbed-public",
  "submission": { "type": "pull_request", "number": 26 },
  "policy": {
    "source": "local-file",
    "revision": "local:<sha256>",
    "ref": null,
    "commit": null,
    "path": "templates/policy/policy.yml"
  },
  "run": {
    "run_id": "local-<UTC start>-<8 hex>",
    "run_attempt": 1,
    "directory": "<absolute path>",
    "snapshot_hash": "sha256:<hex>"
  },
  "outcome": "needs-changes",
  "causes": [],
  "findings": [
    { "finding_id": "finding-0001", "code": "submission.unstructured", "severity": "blocking", "field": null, "subjects": [] }
  ],
  "requests": [
    {
      "request_id": "R1",
      "text": "Rewrite the pull request description with the pull request template: `https://github.com/steady-orchard/patch-steward-testbed-public/blob/master/.github/pull_request_template.md`"
    }
  ],
  "warnings": [],
  "errors": []
}
```

A trusted-branch run differs in `"authoritative": true`, one notice, and `policy` with `source` `trusted-branch`, the tree id, `ref` the default branch, `commit`, and `path` `null`.

| Exit status | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`         | Outcome `pass`.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `1`         | Outcome `needs-changes` or `uncertain`, or `screen.policy-file-invalid`.                                                                                                                                                                                                                                                                                                                                                                 |
| `2`         | Usage errors (`usage.unknown-option`, `usage.invalid-arguments`, `usage.conflicting-options`), `auth.token-invalid`, `screen.no-upstream`, `screen.repository-unavailable`, `screen.token-rejected`, `screen.policy-missing`, `screen.policy-invalid`, `screen.evidence-dir-unavailable`, `screen.evidence-write-failed`, `file.*`, `git.*`, `github.*`, `snapshot.*`, `steward.internal-error`, and other failures before a run exists. |
| `3`         | Outcome `inconclusive`.                                                                                                                                                                                                                                                                                                                                                                                                                  |

Example (live test-bed; exit status `1`):

```text
$ node packages/cli/dist/main.js screen --issue 29 --repo steady-orchard/patch-steward-testbed-public --policy-file templates/policy/policy.yml
local run: not the repository's official screening result
non-authoritative: screened under a local policy file (local:<sha256>)
policy: local file templates/policy/policy.yml revision local:<sha256>
submission: issue 29 (steady-orchard/patch-steward-testbed-public)
outcome: needs-changes
request R1: Rewrite the issue with one of the repository's issue forms: `https://github.com/steady-orchard/patch-steward-testbed-public/issues/new/choose`
run directory: <evidence directory>/steady-orchard/patch-steward-testbed-public/runs/issue-29/local-<UTC start>-<8 hex>
```

Without `--policy-file` the same command ends `error screen.policy-missing -: The repository has no published policy on its default branch. Pass --policy-file <path> to screen under a local policy file.` and exit status `2`.

Sources: [architecture §6.5](../architecture.md#65-command-line-interface-packagescli), [SP20](../processes.md#sp20-maintainer-initiated-local-screening), [CLI source](../../packages/cli/src/screen-command.ts).

## `steward report` (Available)

Verifies a stored run directory written by [`steward screen`](#steward-screen-available) and prints its report.

Syntax:

```text
steward report <run-dir> [--json]
```

One positional argument, a run directory relative to the current directory, and `--json`. Usage errors use `usage.unknown-option` and `usage.invalid-arguments` (a missing, extra, or empty run directory).

Before anything is printed, the command verifies the stored run: `manifest.json` validates; every listed file exists with its recorded byte count and SHA-256; no unlisted file exists; every record file validates against its schema and matches its content hash; `report.md` equals the report record's rendered text; and the run's metrics file, found under the store root three levels above the run directory, matches when present. A missing metrics file gives the warning `report.metrics-missing` ("The metrics file of this run is missing."). A stored report or check summary containing a control or format character is refused. Any verification failure fails with `report.evidence-invalid` (exit `1`) and a detail error naming the file.

Text output (stdout): `report.md` printed byte for byte; warnings go to stderr.

With `--json`, the command prints one line: an object with `schema_version`, `command` (`"report"`), `local_run` (`true`), `authoritative` (the stored policy-revision record's flag: false exactly for a local policy file), `notices` (as for `steward screen`), `run` (`run_id`, `run_attempt`, `directory`, `started_at`, `finished_at`), `submission` (`repository`, `type`, `number`, `snapshot_hash`, `target_branch`, `head_commit`, `base_commit`), `policy` (`revision`, `authoritative`, `source`), `outcome`, `causes`, `report` (the `report.md` text), `check_summary`, `integrity` (`manifest` `"verified"`, `files` the number of listed files, `metrics` `"verified"` or `"missing"`), `warnings`, and `errors`. On failure, the run-related members are `null`.

| Exit status | Meaning                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`         | Stored outcome `pass`.                                                                                                                                                                                       |
| `1`         | Stored outcome `needs-changes`, `uncertain`, `superseded`, or `overridden` (the version-1 decision record carries no effective outcome, so a stored override never exits `0`), or `report.evidence-invalid`. |
| `2`         | Usage errors, `report.run-unreadable` (a missing or unreadable directory), `steward.internal-error`.                                                                                                         |
| `3`         | Stored outcome `inconclusive`.                                                                                                                                                                               |

Example: `node packages/cli/dist/main.js report <run directory>`, printing the report of the issue 29 run above (exit status `1`), whose first lines are:

```text
## Patch Steward screening report

- Outcome: `needs-changes`
- Submission: `steady-orchard/patch-steward-testbed-public` issue `29`
```

Report layout and caps: see [SP13](../processes.md#sp13-decision-report-and-admission).

Sources: [architecture §6.5](../architecture.md#65-command-line-interface-packagescli), [SP20](../processes.md#sp20-maintainer-initiated-local-screening), [SP13](../processes.md#sp13-decision-report-and-admission), [CLI source](../../packages/cli/src/report-command.ts).

## CLI commands (Proposed)

These names appear in the design; the repository does not implement them.

| Command          | Intended purpose                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `steward init`   | Install target-repository templates and labels, select inference settings, and print manual setup steps. |
| `steward replay` | Evaluate a labeled historical dataset with labels withheld from screening.                               |

> **[NEEDS INPUT]** Positional arguments, flags, exit codes, output formats, and file-selection rules of `steward init`
> and `steward replay` are not defined.
> SP20 requires an explicit publication flag for `steward screen` but does not name it.
> Options for the proposed mandatory-command and self-review steps of `steward preflight` are not defined either.

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
