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

To apply formatting to the repository:

```sh
pnpm format
```

The tests exercise the policy module, record schemas, redaction, `steward policy`,
and the sample `greet` function. None of these commands screens a submission.

Sources: [package scripts](../../package.json), [repository commands](../../CLAUDE.md#commands),
[`steward policy`](commands.md#steward-policy-available).

## Prepare a submission (Proposed)

1. Read the target project's published quality contract. Check the category's
   evidence requirements, supported versions, and proposal policy.
2. Prepare the expected behavior and its authoritative basis, actual behavior,
   affected version, reproduction command and observable result, scope, and
   references. For a proposal, describe the problem, benefit, and any existing
   acceptance or decision.
3. Use the proposed local preflight entry point on your own checkout:

   ```text
   steward preflight
   ```

   The design fetches the upstream trusted-branch policy, checks the draft, runs
   mandatory commands locally without a sandbox, and previews a declared
   regression test on the base and branch. These deterministic steps need no
   inference account.

4. Optionally select a shipped adapter for self-review with your own credential.
   Before sending draft text, diffs, code, tests, and policy context, the CLI is
   designed to disclose exactly what leaves the machine and wait for confirmation.
5. Address the gaps. You may include the resulting unverified preflight summary
   in your submission; official screening treats it as a claim to verify.

The proposed browser assistant offers the same intake fields and deterministic
checks, then produces a prefilled issue-form URL or PR-body text with a compare
URL. It does not run code or inference and holds no credentials. If no published
policy exists, preflight uses the default checklist from the steward template.

> **[NEEDS INPUT]** The draft format, input-path arguments, upstream selection,
> inference-selection options, and preflight output format are not specified.
> The default checklist and browser bundle are also absent. `steward preflight`
> above identifies the proposed entry point, not a complete runnable invocation.

Source: [preflight process SP05](../processes.md#sp05-contributor-preflight).

## Report a defect or propose a change (Proposed)

For a defect:

1. Use the target's defect form and supply the required fields and references.
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

1. Use the proposal form to describe the problem and benefit.
2. A well-formed proposal without recorded acceptance passes as `proposal-pending`
   into the proposal backlog. It has no author requests.
3. A maintainer records acceptance using `/steward accept REASON` on the issue.
   Acceptance binds to its content hash; editing the proposal requires renewed
   acceptance. A decline is recorded with `/steward resolve CODE` at or after closure.

An ordinary issue claiming a security problem follows the configured escalation
rule, typically triage with a pointer to the project's private reporting channel.
The steward does not take in private vulnerability reports.

> **[NEEDS INPUT]** The supplied repository has no generated issue forms or exact
> rendered field labels. A copyable submission template and a real project defect
> reproduction cannot be supplied from the current material.

Sources: [SP06](../processes.md#sp06-intake-and-submission-contract-check),
[SP08](../processes.md#sp08-claim-validation), [SP09](../processes.md#sp09-reproduction).

## Submit a pull request (Proposed)

1. Complete the installed PR template. Link a successfully validated issue when
   policy requires one. Linked validation must still match the current issue,
   policy, supported target, and claim scope.
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

## Local screening and replay (Proposed)

For maintainer local screening, the proposed entry points are:

```text
steward screen
steward report
```

The design uses the maintainer's GitHub and inference credentials, a local
container, and the trusted-branch policy unless an explicit local policy is named.
It writes a local report and evidence. Optional publication requires an explicit
flag and produces an attributed comment; it never creates the required App check.
A local-policy experiment is marked non-authoritative.

For historical evaluation, the proposed entry point is:

```text
steward replay
```

Replay requires a dataset with a cutoff and frozen context manifest for each
item. Outcome labels and later resolutions are withheld from screening inputs.
It reports invalid admissions, valid contributions blocked, inconclusive items,
stage attribution, cost, and latency. Unavailable historical context remains
unavailable rather than being replaced with current information.

> **[NEEDS INPUT]** The sources omit submission-reference arguments, local-policy
> selection syntax, the publication flag, report/evidence paths, dataset schema,
> and replay arguments. These command names cannot yet form runnable examples.

Sources: [SP20](../processes.md#sp20-maintainer-initiated-local-screening),
[SP04](../processes.md#sp04-evaluation-replay).

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
