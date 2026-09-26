# ADR-0060: `steward preflight` command

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §6.5; `docs/processes.md` SP05; `docs/user-manual/commands.md` "`steward preflight`"

## Context and Problem Statement

SP05's CLI steps detect the upstream repository, read its policy, parse a contributor's local draft, and run
the contract check exactly as SP06 does on the official run, so a contributor can see likely results before
opening anything. The result is always unverified, since it runs on the contributor's own machine. A project
without a published policy still needs a checklist to preflight against. The command's syntax, inputs, output,
and exit statuses were not settled.

## Considered Options

- Draft file and committed branch, policy through the GitHub API — read a local Markdown draft and committed
  git changes, read the policy from upstream over the API, perform no fetch and no write
- Read the draft from an existing issue or pull request — require the submission to already exist on GitHub
- Fetch the upstream policy with git — add a git fetch step instead of an API read
- Include uncommitted changes — diff the working tree instead of committed history

## Decision Outcome

Chosen option: "Draft file and committed branch, policy through the GitHub API", because a draft file works
before any issue or pull request exists, the API read needs no fetch and touches no remote-tracking ref, and
committed changes are what a pull request would actually contain. Requiring an existing issue or pull request
would defeat the point of a preflight check run before submission; fetching with git would move the user's
refs the same way [ADR-0048](0048-steward-policy-command.md) rejected for `steward policy`; and uncommitted
changes are not what screening would ever see.

Syntax: `steward preflight (--issue defect|proposal | --pr) --draft <file.md> [--repo owner/name] [--base <ref>] [--json]`.
The draft is Markdown in rendered or template layout, at most 262144 bytes of strict UTF-8. Upstream is
`--repo`, else the `upstream` remote, else `origin`. The policy comes from the upstream default branch through
the GitHub API; without a published policy the policy applied is the policy template's resolved policy,
embedded in the steward and checked against the template by a test, which serves as the default checklist. An
invalid published policy exits with status 2. For `--pr`, the changed paths run from the merge base of `--base`
(default the local remote-tracking default branch) to `HEAD`, committed changes only, with no fetch. The
linked issue's existence is read, and attachments are checked statically. There is no snapshot and no
shared-head check. Requests link the template: the issue-form chooser, or the pull request template on the
default branch.

Output opens with the notice line `unverified: produced on the contributor's machine; official screening
treats it as a claim` and names the policy source. `--json` prints one object. Exit status 0 means the
contract is met; 1 means `needs-changes` or `uncertain`; 2 means a usage, environment, GitHub, or git error, an
invalid published policy, or `inconclusive`. The command never writes to GitHub, never fetches, never reads the
working tree, never runs repository or policy commands beyond the reads above, and sends no telemetry;
mandatory commands and self-review are outside its scope.

### Consequences

- [Architecture §6.5](../architecture.md) and [SP05](../processes.md) describe the command and its steps.
- The command reference documents its options, output, and exit statuses.
- A test proves the command's path runs no model and executes nothing but read-only git and `gh auth token`.

## More Information

- The project owner decided this on September 26, 2026.
