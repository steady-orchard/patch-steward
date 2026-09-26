# Overview

[Manual contents](README.md) · [Installation](installation.md)

**Status:** Product behavior on this page is proposed. The development
scaffold, the policy module, the submission contract check, the `steward policy`
command, and the deterministic part of `steward preflight` exist; screening does
not.

## Purpose and scope

Patch Steward is designed to screen GitHub issues and pull requests before
substantive maintainer review. It checks whether a claim has support, whether a
failure can be reproduced, and whether a proposed fix satisfies project
requirements without introducing regressions. It also requests missing evidence
and tracks contributor revisions.

Version 1 is designed for issues and PRs in public or private GitHub
repositories. The TypeScript/Node.js core would invoke each target project's own
Git, build, and test tools, allowing screening of projects in other languages.
Continuous screening would run in the target repository's GitHub Actions.
There is no hosted backend.

Issues and PRs on GitHub are the only submissions. Security claims in ordinary
issues follow the project's escalation policy; the steward does not assign
their severity. It flags low-value automated activity in its report but does
not hide comments or lock threads.

Screening evaluates evidence and project fit. AI assistance, presentation quality,
and ease of generation do not establish submission quality. A pass means the
defined screening requirements were satisfied; it does not establish project
value or authorize merging.

Sources: [README](../../README.md), [architecture §1](../architecture.md#1-scope-and-decisions),
[problem statement §4](../problem-statement.md#4-non-issues).

## Key concepts

| Term                      | Meaning                                                                                                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality contract / policy | Maintainer-owned definition of supported behavior, required evidence and checks, limits, and operating modes.                                                                                                                                                              |
| Submission contract       | The fields, references, reproduction details, and other information required for an issue or PR's category.                                                                                                                                                                |
| Trusted branch            | The repository's default branch, which supplies the active policy and trusted workflow definitions.                                                                                                                                                                        |
| Policy revision           | The git tree id of `.github/patch-steward/` at the trusted commit. The default-branch commit is recorded separately for traceability; a named local policy file is `local:<sha256>` and never authoritative.                                                               |
| Claim                     | Anything a contributor states or produces, including local preflight output. It identifies what needs verification.                                                                                                                                                        |
| Evidence                  | A steward-controlled execution or reference-check record with verified provenance. It records observations, not proof that test output is honest.                                                                                                                          |
| Signal                    | An external result, such as project CI. It keeps its external provenance even when policy permits its use for platform coverage.                                                                                                                                           |
| Finding                   | A statement classified as `blocking`, `uncertain`, `advisory`, or `speculative`. An actionable blocker needs a scenario, location, evidence, and a validated requirement.                                                                                                  |
| Snapshot                  | The inputs certified by a run: head commit or issue content, target branch, body, linked evidence, relevant author responses, PRs sharing the head, and the policy revision. The base commit is recorded but not compared, so base-branch movement never supersedes a run. |
| Ownership record          | An immutable artifact identifying the run entitled to publish for a submission. Publication checks both ownership and input freshness.                                                                                                                                     |
| Repository gate           | Active when any category uses `advise` or `enforce`, or a ruleset requires the steward check. It controls creation of check runs.                                                                                                                                          |
| Trusted path              | Workflow, policy, runner, or CI control path. Changes prevent reliance on PR-controlled CI.                                                                                                                                                                                |
| Execution-sensitive path  | Package scripts, test/build configuration, reporters, helpers, or harness code. Changes require maintainer triage even when tests pass.                                                                                                                                    |
| Independent challenge     | Additional tests derived from trusted requirements and code without the author's explanation, intended to find concrete counterexamples.                                                                                                                                   |
| Dismissal code            | A stable reason, such as `proposal-required`, used in reports and maintainer actions: nine built-in codes plus the project's additions.                                                                                                                                    |

Rules in the core determine outcomes. Model responses supply findings and analysis;
the model does not make the final decision. Advisory and speculative findings
alone do not block admission.

Sources: [process vocabulary](../processes.md#01-vocabulary),
[decision process SP13](../processes.md#sp13-decision-report-and-admission).

## Execution options (Proposed)

| Option                          | Intended use                                                                                                                  | Authority and output                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| GitHub-hosted screening (T1)    | Continuous issue and PR screening through Actions. Submitted code runs in containers.                                         | Authoritative for admission; evidence plus mode-dependent checks and feedback.                   |
| Contributor preflight (T2)      | Local checks on the contributor's own checkout, without a sandbox; optional self-review using their own inference credential. | Unverified advice. No GitHub writes.                                                             |
| Maintainer local screening (T3) | On-demand screening with a local Docker or Podman container.                                                                  | Local evidence and an optional attributed comment; never the required check.                     |
| Evaluation replay (T4)          | Evaluate historical submissions using frozen inputs and withheld outcome labels.                                              | Local evaluation report and optional evidence upload; no live submission changes.                |
| Browser app                     | Static submission assistant and maintainer dashboard on GitHub Pages.                                                         | Reads published JSON and links to GitHub for writes. Holds no secrets and performs no inference. |

Submitted code and reproductions in T1, T3, and T4 must execute in disposable
containers without credentials. Worktrees and ordinary subprocesses provide no
security isolation. Containers protect hosts and credentials; they do not make
submitted tests or result files trustworthy. T2 is limited to the contributor's
own code and labels all results as claims.

Sources: [architecture §5](../architecture.md#5-runtime-topologies),
[sandbox process SP17](../processes.md#sp17-sandboxed-execution).

## Outcomes and waiting states (Proposed)

| Outcome         | Meaning                                                                                                  | Response                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pass`          | Required checks satisfied; only nonblocking findings remain.                                             | Continue to ordinary maintainer review or the relevant issue backlog.                       |
| `needs-changes` | Submission contract failure, missing contributor evidence, or an evidence-backed blocker.                | Address the report's specific requests.                                                     |
| `uncertain`     | A required maintainer decision remains unresolved.                                                       | Maintainer triage.                                                                          |
| `inconclusive`  | Required steward work could not finish because of infrastructure, model, environment, or budget failure. | Investigate the recorded cause; transient failures receive one automatic rerun within caps. |
| `overridden`    | A maintainer supplied a scoped override with an effective outcome.                                       | Read the reason and waived or remaining requirements.                                       |
| `superseded`    | Inputs changed or a newer committed run owns publication.                                                | Consult the replacement run.                                                                |

`queued` and `awaiting-approval` are waiting states, not outcomes. They represent
capacity limits and an inference-admission hold, respectively. Any check remains
pending while waiting.

Issue classifications describe the claim rather than the run outcome:
`supported-defect`, `intended-behavior`, `feature-request`, `accepted-proposal`,
`proposal-pending`, `duplicate`, or `uncertain`. A well-formed `proposal-pending`
issue can pass into the proposal backlog without intent acceptance or author
requests.

Sources: [architecture §10](../architecture.md#10-submission-states-and-their-github-representation),
[SP08](../processes.md#sp08-claim-validation), [SP13](../processes.md#sp13-decision-report-and-admission).

## Operating modes (Proposed)

Modes apply globally and per category. Adoption begins with `observe`.

| Mode      | Submission feedback                                                                          | Normal PR check behavior                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `observe` | Evidence and metrics only; no report comment, labels, reviewer requests, or draft promotion. | No check in an all-observe repository without a required check. A repository-wide required check uses `neutral` for an unenforced category. |
| `advise`  | Report and labels; review requests on pass.                                                  | `neutral`, with the outcome in the summary.                                                                                                 |
| `enforce` | Report and labels; review requests on pass.                                                  | `success` for pass, `failure` for needs-changes, `action_required` for uncertain or inconclusive. Overrides use their effective outcome.    |

Waiting states, superseded runs, and PRs sharing a head commit have special check
rules; see [troubleshooting](troubleshooting.md#waiting-states-and-checks-proposed).
A neutral check is not a screening pass. Issues have no commit check.

Observe mode runs the full pipeline and consumes inference like the other modes.
Spending limits and inference admission are separate controls.

Source: [architecture §10](../architecture.md#10-submission-states-and-their-github-representation).
