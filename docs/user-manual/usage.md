# Usage

[Manual contents](README.md) · [Installation](installation.md) · [Command reference](commands.md)

## Work on the scaffold

The existing commands compile, type-check, test, lint, and format this repository:

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
```

For a focused toolchain check, run the supplied test file or named test:

```sh
pnpm vitest run packages/core/src/index.test.ts
pnpm vitest run -t 'greets by name'
```

To validate a policy with the built CLI (after `pnpm build`):

```sh
node packages/cli/dist/main.js policy --file templates/policy/policy.yml
node packages/cli/dist/main.js policy --ref origin/HEAD --json
```

To check a draft against a repository's submission contract with the built CLI
(reads GitHub; see [`steward preflight`](commands.md#steward-preflight-available)):

```sh
node packages/cli/dist/main.js preflight --issue defect --draft fixtures/submissions/defect-complete.txt --repo steady-orchard/patch-steward-testbed-public
```

To apply formatting to the repository:

```sh
pnpm format
```

The tests exercise the policy module, record schemas, redaction, the submission
module and its GitHub, git, and attachment adapters, `steward policy`,
`steward preflight`, and the sample `greet` function; `pnpm test:live` adds
read-only tests against a public test-bed repository. None of these commands
screens a submission.

Sources: [package scripts](../../package.json), [repository commands](../../CLAUDE.md#commands),
[`steward policy`](commands.md#steward-policy-available), [`steward preflight`](commands.md#steward-preflight-available).

## Prepare a submission (Available)

1. Read the target project's published quality contract. Check the category's
   evidence requirements, supported versions, and proposal policy.
2. Write the draft as the rendered form or template would: a Markdown file with
   the issue form's `### <label>` headings, or the pull request template's marker
   line and `## <heading>` sections (see the
   [submission settings](configuration.md#submission)). For a defect, give the
   expected behavior and its authoritative basis, actual behavior, affected
   version, reproduction command and expected result, scope, and references; for
   a proposal, the problem, benefit, and any existing decision. Put reproduction
   files in the `Reproduction command` field as fenced code blocks or
   attachments.
3. Check the draft with `steward preflight` from your own checkout. For an
   issue:

   ```sh
   node packages/cli/dist/main.js preflight --issue defect --draft draft.md --repo owner/name
   ```

   For a pull request, commit your change first, then run it from the branch:

   ```sh
   node packages/cli/dist/main.js preflight --pr --draft pr.md
   ```

   It reads the upstream policy, or the default checklist when none is
   published, checks the draft and, for a pull request, the committed changes
   against the submission contract, and prints each finding with a numbered
   request. Exit status `0` means the contract is met, `1` that the draft needs
   changes or a maintainer decision, `2` that the check could not run, and
   `3` that the result is `inconclusive` because a required read failed. It
   needs no inference account and writes nothing to GitHub.

4. Address the requests. You may include the preflight summary in your
   submission; official screening treats it as a claim to verify and repeats
   every check.

Proposed and not yet implemented: running the mandatory commands locally without
a sandbox and previewing a declared regression test on the base and branch;
optional self-review with a shipped adapter and your own credential, after the
CLI discloses exactly what leaves the machine; and the browser assistant, which
offers the same intake fields and deterministic checks and produces a prefilled
issue-form URL or PR-body text with a compare URL, without running code or
inference.

Sources: [preflight process SP05](../processes.md#sp05-contributor-preflight),
[`steward preflight`](commands.md#steward-preflight-available).

## Report a defect or propose a change (Proposed)

For a defect:

1. Use the target's "Defect report" form (installed from
   `templates/issue-forms/steward-defect.yml`). It asks for `Expected behavior`,
   `Authoritative basis`, `Actual behavior`, `Affected version`,
   `Reproduction command`, and `Expected result` (required), and
   `Proposed scope`, `References`, and the `Security claim` checkbox (optional).
   Keep the rendered labels: screening finds each field by its label.
2. Include a self-contained reproduction as fenced code or attached files, with
   an exact command and expected output or exit status.
3. Screening checks the submission contract and references, validates the claim
   against supported behavior, and runs required reproductions in containers.
4. A passed defect issue enters the ordinary backlog. An unsupported claim or
   missing evidence produces specific correction requests; an unresolved project
   intent question goes to maintainer triage.

A defect on a supported release can remain applicable even if the default branch
already contains a fix. Screening records affected releases and any backport need.

For a feature or design proposal:

1. Use the "Change proposal" form (installed from
   `templates/issue-forms/steward-proposal.yml`): `Problem`, `Benefit`, and
   `Proposed scope` are required, `Existing decision` and `References`
   optional.
2. A well-formed proposal without recorded acceptance passes as `proposal-pending`
   into the proposal backlog. It has no author requests.
3. A maintainer records acceptance using `/steward accept REASON` on the issue.
   Acceptance binds to its content hash; editing the proposal requires renewed
   acceptance. A decline is recorded with `/steward resolve CODE` at or after closure.

An ordinary issue claiming a security problem follows the configured escalation
rule, typically triage with a pointer to the project's private reporting channel.
The steward does not take in private vulnerability reports.

Screening parses the forms as the [submission settings](configuration.md#submission)
describe; a body that matches no form is returned with a link to the form
chooser unless the policy allows free-form submissions.

Sources: [SP06](../processes.md#sp06-intake-and-submission-contract-check),
[SP08](../processes.md#sp08-claim-validation), [SP09](../processes.md#sp09-reproduction).

## Submit a pull request (Proposed)

1. Complete the installed PR template (from
   `templates/pull-request/pull_request_template.md`). Keep its first line, the
   marker `<!-- patch-steward:pr-template v1 -->`, and its `##` headings:
   `Category`, `Problem`, `Benefit`, `Intended behavior`, `Acceptance criteria`,
   `Linked issue`, `Regression test`, `Test scaffolding`, `Reproduction command`,
   `Expected result`, and `References`. Name exactly one category, and in
   `Linked issue` one issue in the same repository, such as `Fixes #123`. A
   category that does not fit the changed paths, such as `docs` with code
   changes, needs a maintainer decision. Link a successfully validated issue
   when policy requires one. Linked validation must still match the current
   issue, policy, supported target, and claim scope.
2. For a feature or design change, follow `unrequested_change`. Its documented
   default, `propose-first`, requires an accepted proposal, maintainer acceptance
   on the PR, or a waiver. Otherwise the result is `needs-changes` with
   `proposal-required`. With `triage`, the missing intent decision becomes
   `uncertain` for a maintainer to resolve.
3. For a category requiring before-and-after evidence, declare the regression
   test file and test identity. Screening verifies:

   | Revision                                  | Required observation                       |
   | ----------------------------------------- | ------------------------------------------ |
   | Base plus only the PR's test-path changes | Failure for the claimed behavioral reason. |
   | Head with the identical regression test   | Pass.                                      |
   | Merge commit at screening time            | Pass.                                      |

   A compile or missing-symbol failure on the base does not demonstrate the
   claimed defect. The policy may allow a separate reproduction when the test
   requires an interface introduced by the fix.

4. In feedback-enabled modes, submit a draft if you want screening before review
   requests. A passed PR may be marked ready and reviewers requested per policy.
   Observe mode uses the repository's ordinary manual readiness/review process.
5. Read the screening result. Mandatory checks cannot be removed by impact
   analysis. Policy-selected categories also receive an independent challenge
   after regression analysis.

Issue/PR edits and relevant commits start fresh screening. Accepted PR intent
survives implementation pushes when the canonical claim scope and target remain
unchanged; technical checks still rerun. Scope or target edits need new acceptance.

The merge queue verifies the group commit with the mandatory suite and matching
baseline. It does not repeat each member's claim admission, and a group failure
does not overwrite the individual PR outcomes.

Sources: [SP06](../processes.md#sp06-intake-and-submission-contract-check),
[SP10](../processes.md#sp10-fix-verification), [SP11](../processes.md#sp11-independent-challenge),
[SP12](../processes.md#sp12-regression-analysis), [SP13](../processes.md#sp13-decision-report-and-admission).

## Read a report and respond (Proposed)

In `advise` or `enforce`, the steward updates one report comment in place. Start
with the outcome and classification, then read:

- Blockers: scenario, location, evidence, dismissal code, and requested correction.
- Uncertainties requiring a maintainer decision.
- Executed commands, results, environment identity, and exit status.
- Reference verification and what would change the outcome.
- Bound snapshot, policy, steward, model, adapter, and runner identities.

Per-run cost is in evidence and the dashboard, not the report body. Logs may be
bounded and redacted; the report links to durable evidence.

For `needs-changes`, follow each numbered request's destination:

1. Put required fields, references, reproductions, and test declarations into the
   submission body or a commit. Supplying them only in a comment does not satisfy
   the request or start a rerun.
2. Put requested explanations into a new conversation comment citing the request
   number. An addressed explanation triggers affected stages to rerun; it is
   still treated as untrusted input.
3. Corrected bodies and commits start new runs. Editing or deleting an explanation
   already used by screening also changes the snapshot.

In feedback-enabled modes, `needs-changes` maps to `awaiting-author`. The
submission keeps that state until its author acts or the submission is closed;
the steward posts at most one follow-up per author action.

To rerun your own open or reopened submission, create a conversation comment:

```text
/steward rerun
```

To appeal your own outcome, create a new comment with a reason. Example text:

```text
/steward appeal The reproduction affects a supported release even though the default branch is fixed.
```

One appeal may remain open per submission. It goes to maintainer triage and stays
open until a maintainer acts. A closed submission can be reopened to restart
screening; update the requested inputs as needed.

Sources: [SP13](../processes.md#sp13-decision-report-and-admission),
[SP14](../processes.md#sp14-contributor-follow-through),
[SP15](../processes.md#sp15-maintainer-triage-override-and-appeal).

## Maintainer triage (Proposed)

1. Review the triage queue's uncertainty and evidence. Approval holds, pending
   proposals, appeals, and audits have separate views.
2. Identify whether the item needs missing project intent, corrected contributor
   evidence, infrastructure recovery, or a scoped maintainer decision.
3. Post the applicable [conversation command](commands.md#github-conversation-commands-proposed).
   For an inference hold, a maintainer's `/steward rerun` records admission for
   that submission. An author's rerun does not grant admission.
4. Review the fresh report and check. Maintainer commands record actions and
   start screening/publication; they do not directly complete an old check.

Example of accepting a proposal's intent:

```text
/steward accept The proposed behavior and scope are accepted.
```

Acceptance is distinct from a technical pass. Applying `claim:accepted-proposal`
by hand does not record acceptance. Labels never authorize outcomes or inference.

Overrides and waivers carry a reason and scope. They cannot bypass authentication,
snapshot freshness, run ownership, durable evidence, or the shared-head rule.

Source: [SP15](../processes.md#sp15-maintainer-triage-override-and-appeal).

## Local screening (Available)

1. Build the CLI: `pnpm build`.
2. Run `steward screen` with `--pr <number>` or `--issue <number>`, and
   optionally `--repo owner/name` and `--policy-file <path>` to test a proposed
   policy against an existing submission before merging it.
3. Read the printed local-run and non-authoritative lines, the outcome, any
   numbered requests, and the run directory.
4. Run `steward report <run directory>` to verify and print the stored report.
5. Act on the requests, or on the causes when the outcome is `inconclusive`.

```sh
pnpm build
node packages/cli/dist/main.js screen --issue 29 --repo steady-orchard/patch-steward-testbed-public --policy-file templates/policy/policy.yml
node packages/cli/dist/main.js report <run directory printed by screen>
```

Against a public test-bed repository without a published policy, the first
command prints the local-run and non-authoritative lines, `outcome:
needs-changes`, request `R1`, and the run directory, then exits 1; the second
prints the stored report and exits 1.

`steward screen` reads the submission through the GitHub API (read-only) and
loads the trusted-branch policy, or a local policy file with `--policy-file`;
a repository without a published policy needs `--policy-file`, otherwise the
command exits 2 with `screen.policy-missing`. It checks the submission
contract, decides the outcome, and writes a report and evidence to a local run
directory. No stage, container, or model runs yet, so the outcome is
`needs-changes` when the contract fails and otherwise `inconclusive` with
cause `stage-incomplete`; the report's "What would change the outcome" names
the missing stages. Every run is a local run, not the repository's official
screening result; it creates no check, comment, or label. `steward report`
verifies a stored run directory's manifest, sizes, hashes, and record schemas;
tampered or incomplete evidence exits 1 with `report.evidence-invalid`. See
[`steward screen`](commands.md#steward-screen-available) and
[`steward report`](commands.md#steward-report-available) for exit statuses and
options.

Proposed and not yet implemented for local screening: the local container and
stages, use of the maintainer's own inference credential, and optional
attributed publication.

> **[NEEDS INPUT]** The explicit publication flag of SP20, which would post an attributed report comment, is not named.

Sources: [SP20](../processes.md#sp20-maintainer-initiated-local-screening),
[`steward screen`](commands.md#steward-screen-available),
[`steward report`](commands.md#steward-report-available).

## Historical replay (Proposed)

For historical evaluation, the proposed entry point is:

```text
steward replay
```

Replay requires a dataset with a cutoff and frozen context manifest for each
item. Outcome labels and later resolutions are withheld from screening inputs.
It reports invalid admissions, valid contributions blocked, inconclusive items,
stage attribution, cost, and latency. Unavailable historical context remains
unavailable rather than being replaced with current information.

> **[NEEDS INPUT]** The sources omit the dataset schema and the replay arguments, so `steward replay` cannot yet form a runnable example.

Sources: [SP04](../processes.md#sp04-evaluation-replay).

## Calibrate enforcement (Proposed)

1. Begin in `observe` and record decisions and maintainer resolutions.
2. Define the evaluation period, categories, labeling coverage, workload/error
   thresholds, and usual-review control or matched comparison cohort before rollout.
3. Record maintainer time, including triage, appeals, audits, policy upkeep, and
   operations. For example, on a submission:

   ```text
   /steward time 15 triage
   ```

4. Audit sampled runs and compare errors, total maintainer effort, contributor
   abandonment, cost, latency, and inconclusive causes. Missing measurements are
   unknown, not zero; a later accepted revision does not prove the earlier
   rejection was wrong.
5. Change modes per category with recorded supporting measurements. Start
   enforcement with well-supported deterministic evidence, such as bug fixes with
   before-and-after tests. Rising error rates are grounds to return to `advise`.

> **[NEEDS INPUT]** Numerical rollout thresholds, audit sample sizes, and exact
> maintenance-workflow inputs for repository-level time entries are not specified.

Sources: [SP03](../processes.md#sp03-calibration-and-enforcement-rollout),
[whitepaper §13](../whitepaper.md#13-calibration-and-enforcement).
