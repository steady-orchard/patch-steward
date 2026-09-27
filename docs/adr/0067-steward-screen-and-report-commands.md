# ADR-0067: `steward screen` and `steward report` commands

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §6.5; `docs/processes.md` SP20; `docs/user-manual/commands.md` "`steward
screen`" and "`steward report`"

## Context and Problem Statement

SP20 describes maintainer-initiated local screening (T3) under the trusted-branch policy or an explicitly named
local policy file, writing a local report and evidence that `steward report` renders. No screening stage, local
container runner, model adapter, or publication exists yet. SP13 steps 1-3 (decide, report, persist) and SP18
step 1 run locally regardless of publication. The syntax, policy sources, evidence location, behavior on
pre-run failures, and exit statuses were not settled.

## Considered Options

- A contract-level `steward screen` under the trusted-branch policy or a named local policy file, writing
  evidence to the user data directory, plus a verifying `steward report`
- Falling back to the default checklist when no policy is published, as `steward preflight` does
- Recording failures that occur before `gate` completes as `inconclusive` runs
- Writing evidence inside the checkout by default
- Having `steward report` exit 0 whenever it renders a stored report

## Decision Outcome

Chosen option: "A contract-level `steward screen` under the trusted-branch policy or a named local policy file,
writing evidence to the user data directory, plus a verifying `steward report`", because a screening result must
be bound to a policy the repository published or the maintainer explicitly named. Falling back to the default
checklist, as `steward preflight` does, was rejected because the default checklist would then pose as the
project's own contract rather than as an unverified approximation of one. Recording pre-`gate` failures as
`inconclusive` runs was rejected because, as in T1, nothing exists before `gate` succeeds and there is no
snapshot to bind a run to. Writing evidence inside the checkout by default was rejected because run directories
could then be committed by accident, and the repository's own ignore rules would drop the log directory from
version control silently. Having `steward report` always exit 0 on a successful render was rejected because the
uniform conventions map the stored outcome in every command, and a verifying command should report an
unfavorable outcome through its own exit status.

The syntax is:

```text
steward screen (--issue <number> | --pr <number>) [--repo owner/name] [--policy-file <path>] [--evidence-dir <dir>] [--json]
```

The number is a positive decimal without a sign or a leading zero, at most 2147483647. The upstream repository
is `--repo`, else the GitHub repository of the `upstream` remote, else of `origin`.

Without `--policy-file`, the policy is read from the upstream default branch through the GitHub API; its
revision is the git tree id of `.github/patch-steward/`, and the branch and commit are recorded. A repository
without a published policy exits 2 with `screen.policy-missing`, whose message names `--policy-file`; an invalid
published policy exits 2 with `screen.policy-invalid`. The default checklist is never used by this command. With
`--policy-file`, the named file is read with revision `local:<sha256>`, which is never authoritative; an invalid
file exits 1 with `screen.policy-file-invalid`.

A run exists once `gate` succeeds: policy loaded and valid, submission captured, snapshot hashed, and the
contract checked. Earlier failures write nothing and exit 2, or 1 for an invalid policy file. Failures in
`intake`, `execute`, or `assess` are recorded causes that end the run `inconclusive` (exit 3). A failure inside
`publish` (decision, rendering, redaction, or the evidence write) leaves no run directory, prints no report, and
exits 2 with `screen.evidence-write-failed`. At contract level the command ends `needs-changes` or
`inconclusive`, with cause `stage-incomplete` (see [ADR-0069](0069-required-stages-never-pass-incomplete.md)).

Evidence goes to `--evidence-dir`, or by default to the user data directory: `%LOCALAPPDATA%\patch-steward\evidence`
on Windows, `~/Library/Application Support/patch-steward/evidence` on macOS, and `$XDG_DATA_HOME/patch-steward/evidence`
or `~/.local/share/patch-steward/evidence` elsewhere. An `--evidence-dir` inside the current git work tree draws
the warning `screen.evidence-inside-checkout`.

Every output marks the run as local and not the repository's official result: `local_run` is always true. The
JSON `authoritative` flag is true exactly when the policy came from the trusted branch, and a run under a local
policy file adds a non-authoritative notice to the report, the check summary, and both commands' text and JSON
output. The command sends GET requests to GitHub only, writes nothing to GitHub, and creates no check; closed
issues and pull requests are screened like open ones, and no publication flag exists yet.

`steward report <run-dir> [--json]` verifies the stored run directory: the manifest, file sizes and hashes, that
no unlisted file is present, record schemas and content hashes, the report text, and the metrics file. It then
prints `report.md` byte for byte, or one JSON object. Its exit status follows the stored outcome: 0 for `pass`;
1 for `needs-changes`, `uncertain`, or `superseded`; 3 for `inconclusive`. A stored `overridden` outcome exits 1
because the version-1 decision record carries no effective outcome. Evidence that fails verification exits 1
with `report.evidence-invalid`; a missing or unreadable run directory exits 2 with `report.run-unreadable`.

### Consequences

- [Architecture §6.5](../architecture.md) and SP20 describe both commands.
- The command reference documents their options, output, JSON members, and exit statuses.
- A test proves the `screen` path sends only GET requests and runs no model and no execution.

## More Information

- The project owner decided this on September 27, 2026.
