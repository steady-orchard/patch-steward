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

| Exit status | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`         | Disposition `met`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `1`         | Disposition `needs-changes` or `uncertain`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `2`         | A usage error (`usage.unknown-option`, `usage.invalid-arguments`, `usage.conflicting-options`); an unreadable draft (`preflight.draft-not-found`, `preflight.draft-unreadable`, `preflight.draft-too-large`, `preflight.draft-invalid-utf8`); an environment or GitHub failure (`auth.token-invalid`, `preflight.no-upstream`, `preflight.head-unresolvable`, `preflight.base-unresolvable`, `preflight.repository-unavailable`, `preflight.token-rejected`, `git.*`, `github.*`); an invalid published policy (`preflight.policy-invalid`); an unexpected internal error (`steward.internal-error`); or disposition `inconclusive`. |

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

## CLI commands (Proposed)

These names appear in the design; the repository does not implement them.

| Command          | Intended purpose                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `steward init`   | Install target-repository templates and labels, select inference settings, and print manual setup steps. |
| `steward screen` | Screen an issue or PR using a local container, with optional attributed publication.                     |
| `steward replay` | Evaluate a labeled historical dataset with labels withheld from screening.                               |
| `steward report` | Render a stored run or evidence record locally.                                                          |

> **[NEEDS INPUT]** Full positional arguments, flags, exit codes, output formats,
> file-selection rules, and authentication commands of these commands are not defined. In particular,
> SP20 requires an explicit publication flag but does not name it. Options for
> the proposed mandatory-command and self-review steps of `steward preflight` are
> not defined either.

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
