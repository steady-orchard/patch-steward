# Patch Steward Deferred Features

**Status:** design record. Nothing described here is implemented, and nothing
here is part of version 1. This document holds the documentation and design of
features that were considered and then excluded from version 1, so that one can
be restored later without reconstructing it.

The version-1 documents ([architecture.md](architecture.md),
[processes.md](processes.md), [whitepaper.md](whitepaper.md)) assume that these
features will not be implemented. They reserve no settings, permissions,
states, labels, or interfaces for them, and they do not refer to this
document. This document refers to them. Where it disagrees with the
architecture or the processes, they govern; correct this document when a
feature is restored.

## 0. Conventions

### 0.1 Identifiers and entry format

Deferred features carry stable identifiers DF01–DF10. Each entry records:

| Field                 | Content                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Addresses             | Problem-statement issues the feature would serve, when the documents recorded them                                     |
| Deferred              | Date, the decision that excluded it, and the recorded reason                                                           |
| Design                | Behavior as specified before removal, or "scope line only" when the documents never specified more than the exclusion  |
| Version 1 without it  | What the version-1 design does instead                                                                                 |
| Retained in version 1 | Version-1 elements a restoration can build on. None of them exists for the sake of the deferred feature                |
| Restoring             | Document locations a restoration has to change. "Removed" quotes the wording taken out; "Now" is the version-1 wording |
| Open questions        | Decisions that were never made                                                                                         |

### 0.2 Deferring and restoring

To defer a feature, move its design here and remove every mention, setting,
state, label, permission, and interface that exists for it from the
architecture, the processes, the whitepaper, the README, `CLAUDE.md`, and the
user manual. Simplify the version-1 design as though the feature will never
exist, and record the removed wording under "Restoring".

To restore a feature, change the architecture first (components and
boundaries), then the processes (steps and behavior), then the summaries
(whitepaper §9–§14, README, `CLAUDE.md`, user manual). Keep architecture §14
traceability and each process's "Addresses" field consistent, then delete the
entry here.

### 0.3 Index

| ID   | Feature                                              | Area              | Addresses    | Recorded detail                       |
| ---- | ---------------------------------------------------- | ----------------- | ------------ | ------------------------------------- |
| DF01 | Follow-through timers                                | Human loop (SP14) | P06          | Full design                           |
| DF02 | Private vulnerability report intake                  | Submission types  | Not recorded | Deferral reason and reserved hooks    |
| DF03 | Active moderation of automated participation         | Review exchanges  | P08          | Deferral reason and reserved hooks    |
| DF04 | Non-GitHub report channels                           | Submission types  | Not recorded | Deferral reason and one reserved hook |
| DF05 | Webhook receiver or poller; check-run action buttons | Hosting           | Not recorded | Scope line and consequence            |
| DF06 | Additional LLM adapters; per-stage model selection   | LLM provider      | Not recorded | Scope line only                       |
| DF07 | Browser inference                                    | Browser app       | Not recorded | Scope line and reason                 |
| DF08 | Other sandbox isolation technologies                 | Sandbox           | Not recorded | Scope line only                       |
| DF09 | Browser extension; authenticated dashboard actions   | Browser app       | Not recorded | Scope line only                       |
| DF10 | Author-facing submission length caps                 | Submission intake | P07          | Full design                           |

DF01 was deferred on September 17, 2026. DF02–DF09 were excluded by the
decisions recorded on September 15, 2026 and revised on September 16, 2026
(ADR-0001–ADR-0016); their scope lines and reserved hooks were moved here on
September 17, 2026.

## DF01. Follow-through timers

Two policy timers act on a submission labeled `awaiting-author`. A reminder
timer posts one reminder. A closure timer, when enabled, closes the submission
with the `stale` label and a comment that states the reopen path.

| Field     | Value                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| Addresses | P06. Architecture §14 listed "timers; documented reopen path" among the P06 mechanisms. SP14 addresses P06, P09, P01   |
| Deferred  | September 17, 2026, to reduce the initial implementation                                                               |
| Actors    | Maintenance workflow on schedule                                                                                       |
| Trigger   | `schedule`, for submissions in `awaiting-author`                                                                       |
| Inputs    | Request ledger creation time (SP14); policy timers; linked-issue state; hold state                                     |
| Outputs   | One reminder comment; closure with `stale` label and closure comment; "stale closure by the steward" resolution (SP03) |

Reason it can be deferred: no decision depends on a timer. SP13's decision
table, the snapshot, the ownership record, and the check mapping never read
one. Timers act only in feedback-enabled modes, which follow observe-mode
adoption (SP02, SP03). Removing them removes a scheduled duty, a label, a
lifecycle branch, two pause rules, and the only case in which the steward
itself closes a submission.

### Design

Policy settings, in the "Follow-through" area: the reminder timer, the closure
timer, and whether closure is enabled. The area's other setting, the maximum
follow-ups per cycle, remains in version 1.

1. Start. A feedback-enabled `needs-changes` report labels the submission
   `awaiting-author` and the timers start. The anchor is the first durable
   request record in SP14's request ledger, never the mutable report's edit
   timestamp, so editing the report in place does not move it.
2. Evaluation. The maintenance workflow (`steward-maintenance.yml`) evaluates
   timers on its schedule. SP14's triggers included `schedule` and its actors
   included the maintenance workflow; architecture §7 listed SP14 against the
   `schedule` feature.
3. Reminder. At the reminder timer, one reminder is posted. Reminders are
   never repeated.
4. Closure. At the closure timer, if enabled, the submission is closed with
   label `stale` and a comment stating the reopen path: reopen the submission,
   which restarts screening, and push a commit or reply; the author may also
   run `/steward rerun` on their own reopened submission. Nothing is deleted.
5. Pauses and exemptions.
   - Waiting for a maintainer's proposal decision is not author inactivity:
     while a linked `proposal-pending` issue is open, the PR's reminder and
     closure timers pause.
   - No author-inactivity timers run during an inference-admission hold
     (`awaiting-approval`, SP19).
   - No timers apply to a `proposal-pending` issue in the proposal backlog, to
     an `uncertain` outcome (including a PR's missing intent decision under
     `unrequested_change: triage`), or to `inconclusive`.
   - Timers apply to a `feature-request` that needs proposal fields and to
     `proposal-required` under `propose-first`.
6. End. Closure by a maintainer or by the author ends the timers and records
   the resolution (SP03).
7. Responsiveness failure. A model failure in session C left the state
   unchanged and routed the item to triage at the next timer.
8. Calibration. "Stale closure by the steward" was one of the resolution kinds
   that SP03 pairs with the steward decision for the snapshot.
9. Echoes. Reminder and closure comments are App writes, so the echo filter
   named `reminder` among the ignored echoes. The closure itself is a real
   dependency change and had to propagate: it rescreens PRs that shared the
   closed PR's head and dependents of a closed linked issue. Architecture §6.4
   therefore said "Keep closure/input-change propagation when a steward action
   actually changes a dependency".
10. Controls. At most one steward reply per author action plus timers; no
    repeated reminders. SP13 allowed "command/reminder replies" as the only
    comments beyond the single report.
11. Modes. Observe mode publishes no reminders; timers exist only in
    feedback-enabled modes.
12. States. Status label `steward:stale`, and the PR lifecycle branch
    `awaiting-author -> stale -> closed; reopening restarts screening`.

### Version 1 without it

An `awaiting-author` submission keeps that state until its author acts or the
submission is closed. The dashboard's awaiting-author view shows its age.
Maintainers close abandoned submissions by hand and may record
`/steward resolve CODE`. The steward never closes a submission. A model
failure in session C leaves the request open and routes the item to triage
directly.

### Retained in version 1

- SP14's request ledger with creation run and time, which is the timer anchor.
- The `awaiting-author` label and the dashboard queue with ages.
- The maintenance workflow and its schedule.
- Resolution recording on closure (SP03); reopening restarts screening (SP14).
- The author's `/steward rerun` on their own submission (SP15).

### Restoring

| Location                             | Removed                                                                                                                                                                                                                                                                                                     | Now                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Processes §0.3, SP14 row             | Trigger "`needs-changes`; author replies; schedule"                                                                                                                                                                                                                                                         | "`needs-changes`; author replies"                                                                    |
| SP03 step 1                          | "there is no report, label, reminder, or reviewer request"                                                                                                                                                                                                                                                  | "reminder" removed                                                                                   |
| SP03 step 2                          | Resolution kind "stale closure by the steward"                                                                                                                                                                                                                                                              | Removed                                                                                              |
| SP08 step 6                          | "with no author requests and no closure timer"                                                                                                                                                                                                                                                              | "with no author requests"                                                                            |
| SP08 routing table                   | `proposal-pending`: "no timers"; `feature-request`: "timers apply"; `unrequested-change`: "timers apply" and, under `triage`, "no closure timer"                                                                                                                                                            | Removed                                                                                              |
| SP13 decision table, `uncertain` row | "triage, no awaiting-author closure timer"                                                                                                                                                                                                                                                                  | "triage"                                                                                             |
| SP13 step 5                          | "`observe` publishes no report, state labels, reminders, or reviewer requests"                                                                                                                                                                                                                              | "reminders" removed                                                                                  |
| SP13 Controls                        | "command/reminder replies"                                                                                                                                                                                                                                                                                  | "command/follow-up replies"                                                                          |
| SP14 field table                     | Actors "maintenance workflow on schedule"; trigger "schedule"; inputs "policy timers"; outputs "reminder and closure comments"                                                                                                                                                                              | Removed; inputs "policy follow-up limit"; outputs "follow-up comments"                               |
| SP14 step 1                          | "The submission is labeled `awaiting-author` and timers start."                                                                                                                                                                                                                                             | "The submission is labeled `awaiting-author`."                                                       |
| SP14 step 2                          | "Waiting for a maintainer's proposal decision is not author inactivity: while a linked `proposal-pending` issue is open, the PR's reminder and closure timers pause."                                                                                                                                       | Removed                                                                                              |
| SP14 step 3                          | The whole step, quoted in Design items 3 and 4                                                                                                                                                                                                                                                              | Removed; former step 4 is step 3                                                                     |
| SP14 former step 4                   | "Closure by a maintainer or by the author ends the timers and records the resolution (SP03)."                                                                                                                                                                                                               | "ends the timers and" removed; a sentence on how long `awaiting-author` lasts added                  |
| SP14 Controls                        | "at most one steward reply per author action plus timers; … no repeated reminders"                                                                                                                                                                                                                          | "at most one steward reply per author action; only the author or collaborators move the state"       |
| SP14 Failure handling                | "leaves the state unchanged and routes the item to triage at the next timer"                                                                                                                                                                                                                                | "leaves the request open and routes the item to triage"                                              |
| SP15 Controls                        | "reminder" in the list of ignored App echoes                                                                                                                                                                                                                                                                | Removed                                                                                              |
| SP19 step 10                         | "No author-inactivity timers run during a hold."                                                                                                                                                                                                                                                            | Removed                                                                                              |
| Architecture §6.4 wrapper table      | "timers" among the `steward-maintenance.yml` purposes                                                                                                                                                                                                                                                       | Removed                                                                                              |
| Architecture §6.4 echo paragraph     | "reminder" among ignored echoes; "Keep closure/input-change propagation"                                                                                                                                                                                                                                    | "reminder" removed; "Keep input-change propagation"                                                  |
| Architecture §7, `schedule` row      | "timers" in the use list; SP14 in the process list                                                                                                                                                                                                                                                          | Removed                                                                                              |
| Architecture §8, Follow-through area | "Reminder and closure timers, maximum follow-ups per cycle, whether closure is enabled."                                                                                                                                                                                                                    | "Maximum follow-ups per cycle."                                                                      |
| Architecture §10                     | "without author timers" for `proposal-pending`; "reminders" in the observe paragraph; `stale` in the `steward:<state>` label family; lifecycle line `awaiting-author -> stale -> closed; reopening restarts screening`                                                                                      | "without author requests"; the rest removed                                                          |
| Architecture §13, event-loop row     | "reminder" among ignored echoes                                                                                                                                                                                                                                                                             | Removed                                                                                              |
| Architecture §14, P06 row            | "timers; documented reopen path"                                                                                                                                                                                                                                                                            | Removed                                                                                              |
| Architecture §15                     | "timers" among the numerical limits                                                                                                                                                                                                                                                                         | Removed                                                                                              |
| Whitepaper §3                        | "Follow-through timers" among the policy contents                                                                                                                                                                                                                                                           | "The follow-up limit"                                                                                |
| Whitepaper §4                        | "without author requests or timers"                                                                                                                                                                                                                                                                         | "without author requests"                                                                            |
| Whitepaper §8                        | "timers, one report" in the flow diagram; "reminders" in the mode table; "Reminder and closure timers are policy settings; closure, when enabled, labels the submission stale and states the reopen path, and nothing is deleted."; "reminder" among ignored echoes                                         | "one report"; the timer sentence replaced by one on how long awaiting-author lasts; the rest removed |
| Whitepaper §11                       | "handles timers, queued starts, audits, and publication"; "reminder" among ignored echoes                                                                                                                                                                                                                   | "timers" and "reminder" removed                                                                      |
| Whitepaper §14                       | "timers" among the numerical limits                                                                                                                                                                                                                                                                         | Removed                                                                                              |
| `CLAUDE.md` invariants               | "reminder" among ignored echoes                                                                                                                                                                                                                                                                             | Removed                                                                                              |
| User manual                          | Reminder, stale-closure, and pause statements in `usage.md`; "no author-inactivity timer" notes in `overview.md`, `usage.md`, `configuration.md`, and `troubleshooting.md`; "reminder(s)" in the observe-mode rows of `overview.md` and `troubleshooting.md`; the timer settings of the Follow-through area | Removed; `usage.md` states how long `awaiting-author` lasts                                          |

### Open questions

- Values of both timers. Architecture §15 listed them among the undecided
  numerical limits.
- Whether timers are per request or per submission, and whether a second
  `needs-changes` after a rerun restarts the clock or keeps the first anchor.
  The anchor rule suggests that unchanged requests keep their original clock.
- What a "cycle" is relative to the timers.
- The maintenance sweep interval, which bounds timer resolution.
- Which maintenance job holds the App token for the reminder, label, and
  closure writes. Architecture §6.4 mints App tokens only in `gate` and
  `publish`.
- The route for a session C failure once timers exist again: version 1 routes
  to triage directly, which a restoration may keep.

## DF02. Private vulnerability report intake

Screening of private vulnerability reports (GitHub private vulnerability
reporting) as a third submission type beside issues and pull requests.

| Field     | Value                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Addresses | Not recorded. The problem statement's scope includes security reports, and they inform the requirements and evaluation cases (whitepaper §1, SP04) |
| Deferred  | ADR-0004, recorded September 15, 2026. Reasons: no Actions trigger for advisory events; confidentiality of report content in model calls           |
| Design    | Scope line and reserved hooks; no process was specified                                                                                            |

### Design

Reserved hooks, all removed from version 1:

- Policy area "Security": the setting `security.llm` with values `off`,
  `redacted`, and `full`, default `off`, reserved and inert in version 1, "for
  the future private-report process". It was meant to govern whether and how
  report content reaches the inference provider.
- A GitHub App permission for repository security advisories. Architecture §7
  listed "future advisory access" among the uses of the App.
- Scheduled polling from the maintenance workflow, because no Actions event
  fires for advisories.

### Version 1 without it

Version 1 screens issues and pull requests only. An ordinary issue that
claims a security problem is security-claimed (declared category `security`,
the form's security checkbox, or policy-listed terms). It follows the policy's
escalation rule, typically triage with a pointer to the project's private
reporting channel, and never receives a severity statement (SP08). The policy
has no "Security" area; because unknown keys are rejected (SP01), a policy
that carries `security.llm` fails validation.

### Retained in version 1

- The escalation rule for security-claimed issues (SP08, architecture §8).
- Installation authorization before repository content is sent to the selected
  provider, with unauthorized confidential context withheld (architecture §13).
- Evaluation replay over the curl report collection, which exercises claim
  validation and reference verification on security reports (SP04).

### Restoring

| Location                                  | Removed                                                                                                                                                   | Now                                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture §1.1, Submission types       | Deferred column: "Private vulnerability reports (GitHub PVR); non-GitHub channels (HackerOne, email)"                                                     | Column removed                                                                                                                         |
| ADR-0004, Decision Outcome                | "Deferred. The policy reserves a `security.llm` setting with values `off`, `redacted`, and `full`, default `off`, for the future private-report process." | "Not a submission type. A security-claimed issue follows the policy's escalation rule and never receives a severity statement (SP08)." |
| Architecture §7, GitHub App row           | "future advisory access"                                                                                                                                  | Removed                                                                                                                                |
| Architecture §8, content areas            | Row "Security: Reserved: `security.llm` with `off`, `redacted`, `full`; default `off`."                                                                   | Removed                                                                                                                                |
| Architecture §13, provider-disclosure row | "Private vulnerability report intake remains deferred with `security.llm: off`."                                                                          | Removed                                                                                                                                |
| SP01 Controls                             | "`security.llm` reserved and inert in version 1"                                                                                                          | Removed                                                                                                                                |
| Processes §6                              | Row "Private vulnerability report intake"; the whole section "Deferred processes" ("Reserved for later versions; the architecture keeps the slots.")      | Section removed                                                                                                                        |
| Whitepaper §1                             | "private vulnerability reports and active moderation of review exchanges are deferred (architecture §1.1)"                                                | Removed                                                                                                                                |
| Whitepaper §14                            | "the deferral of security reports"; the sentence on deferred processes keeping reserved hooks (processes §6)                                              | "the handling of security reports"; sentence removed                                                                                   |
| README; `CLAUDE.md`                       | "Private vulnerability report intake is deferred."; "private vulnerability reports … are deferred"; "deferred processes in §6"                            | Removed                                                                                                                                |
| User manual                               | Deferral statements in `overview.md` and `usage.md`; the `security.llm` rows in `configuration.md`                                                        | Plain statements of what the steward does; rows removed                                                                                |

### Open questions

Everything beyond the hooks: the intake trigger and polling cadence, the
meaning of `redacted`, evidence storage and visibility for private reports,
and the feedback channel to the reporter.

## DF03. Active moderation of automated participation

Minimizing or hiding comments, locking threads, and setting interaction limits
in response to low-value automated activity.

| Field     | Value                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Addresses | P08                                                                                                                                             |
| Deferred  | ADR-0010 (passive handling only), recorded September 15, 2026. Reason: moderation is a governance act with side effects; passive flagging first |
| Design    | Scope line and reserved hooks; no process was specified                                                                                         |

### Design

Reserved hooks: the policy's hygiene section as the configuration home, and
GitHub's moderation APIs (comment minimization, thread locking, interaction
limits).

### Version 1 without it

SP16 is passive. The steward follows its own conduct rules, flags automated
activity in a capped report section, and never lets a flag affect an outcome.
It does not minimize or hide comments, lock threads, or set interaction
limits; architecture §7 lists interaction limits and comment minimization as
unused GitHub features.

### Retained in version 1

- The "Hygiene" policy area: heuristics, the allowlist, and whether the report
  lists flagged activity (architecture §8).
- Maintainer confirmation of flags during audits (SP16 measures), which can
  calibrate the heuristics before any active step.

### Restoring

| Location                            | Removed                                                                                                                 | Now                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Architecture §1.1, Review exchanges | Deferred column: "Active moderation: minimizing comments, locking threads, interaction limits"                          | Column removed                                                                             |
| SP16 step 3                         | "Not performed in version 1: minimizing or hiding comments, locking threads, setting interaction limits."               | "The steward does not minimize or hide comments, lock threads, or set interaction limits." |
| Processes §6                        | Row "Active automated-participation moderation"                                                                         | Section removed                                                                            |
| Whitepaper §1, §8, §14              | "active moderation of review exchanges are deferred"; "Active moderation is deferred."; the deferred-processes sentence | Removed; §8 states the boundary instead                                                    |
| README                              | "active moderation of review exchanges are deferred"                                                                    | Removed                                                                                    |
| User manual                         | Deferral statement in `overview.md`                                                                                     | Plain statement of what the steward does not do                                            |

### Open questions

Which signals justify an active step, who authorizes it, how it is reversed,
and how it is recorded for audit.

## DF04. Non-GitHub report channels

Intake from channels other than GitHub, for example HackerOne or email.

| Field     | Value                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Addresses | Not recorded                                                                                         |
| Deferred  | Architecture §1.1, recorded September 15, 2026. Reason: different intake formats and identity models |
| Design    | Scope line and one reserved hook                                                                     |

### Design

Reserved hook: a "Submission adapter interface" (processes §6). The
architecture never defined it: §6.2 lists the adapter interfaces LLM, GitHub,
Git, Runner, Evidence store, and Clock and identifiers, and the Submission
module parses GitHub issue forms and PR templates directly.

### Version 1 without it

GitHub issues and pull requests are the only submissions. Command
authorization, follow-through, and inference admission use GitHub identity.

### Restoring

| Location                            | Removed                                                         | Now             |
| ----------------------------------- | --------------------------------------------------------------- | --------------- |
| Architecture §1.1, Submission types | Deferred column: "non-GitHub channels (HackerOne, email)"       | Column removed  |
| Processes §6                        | Row "Non-GitHub report channels"                                | Section removed |
| Whitepaper §14                      | "non-GitHub report channels" in the deferred-processes sentence | Removed         |
| User manual                         | "non-GitHub submission channels" in `overview.md`               | Removed         |

### Open questions

The submission abstraction, the identity model for authors and maintainers
outside GitHub, and where reports and evidence for such submissions are
published.

## DF05. Webhook receiver or poller; check-run action buttons

A self-hosted webhook receiver or poller as a hosting option, and check-run
requested-action buttons for maintainer control, which need such a receiver.

| Field     | Value                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Addresses | Not recorded                                                                                                                         |
| Deferred  | Architecture §1.1 (Hosting) and ADR-0005 (no webhook server), recorded September 15, 2026                                            |
| Design    | Scope line. Consequence recorded in whitepaper §11: no webhook receiver exists, "which is why check-run action buttons are deferred" |

### Version 1 without it

GitHub Actions events are the only triggers, and App installation tokens are
minted inside Actions. Maintainer control uses `/steward` comment commands
(SP15). Architecture §7 lists check-run requested actions as an unused GitHub
feature because they require a webhook receiver.

### Restoring

| Location                   | Removed                                                                                           | Now                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Architecture §1.1, Hosting | Deferred column: "Self-hosted webhook receiver or poller"                                         | Column removed                                |
| Whitepaper §11             | "which is why check-run action buttons are deferred and maintainer control uses comment commands" | "so maintainer control uses comment commands" |

## DF06. Additional LLM adapters; per-stage model selection

More adapters than the two shipped ones, and a different model per stage.

| Field     | Value                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| Addresses | Not recorded                                                                                                    |
| Deferred  | Architecture §1.1 (LLM provider), revised September 16, 2026; §15 listed "per-stage model selection (deferred)" |
| Design    | Scope line only                                                                                                 |

### Version 1 without it

Two shipped adapters sit behind one interface: `copilot-sdk` and
`openai-compatible`. The trusted policy selects one provider, one model, and
one authentication type for every session of a run (architecture §6.3, §8).

### Retained in version 1

The provider-independent adapter contract and capability descriptor
(architecture §6.3). Policy files name a shipped adapter id and cannot load
adapter code.

### Restoring

| Location                        | Removed                                                           | Now            |
| ------------------------------- | ----------------------------------------------------------------- | -------------- |
| Architecture §1.1, LLM provider | Deferred column: "Additional adapters; per-stage model selection" | Column removed |
| Architecture §15                | "per-stage model selection (deferred)"                            | Removed        |

## DF07. Browser inference

LLM-assisted self-review inside the browser submission assistant.

| Field     | Value                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Addresses | Not recorded                                                                                                                                                                 |
| Deferred  | ADR-0002, as revised September 16, 2026: "version 1 removes browser inference". Reasons: the page holds no secrets; provider-specific browser authentication and CORS (§6.6) |
| Design    | Scope line and reason                                                                                                                                                        |

### Version 1 without it

The assistant is a form and checklist with deterministic validation; the page
holds no tokens and sends nothing to a provider. LLM-assisted self-review runs
in the CLI with the contributor's own credential (SP05, ADR-0002 and ADR-0015).

### Restoring

| Location                        | Removed                                                                                                      | Now                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Architecture §1.1, LLM provider | Deferred column: "browser inference"                                                                         | Column removed                                                      |
| ADR-0002, Decision Outcome      | "It performs no inference: version 1 removes browser inference, and LLM-assisted preflight runs in the CLI." | "It performs no inference; LLM-assisted preflight runs in the CLI." |

## DF08. Other sandbox isolation technologies

Isolation other than containers.

| Field     | Value                                                    |
| --------- | -------------------------------------------------------- |
| Addresses | Not recorded                                             |
| Deferred  | Architecture §1.1 (Sandbox), recorded September 15, 2026 |
| Design    | Scope line only                                          |

### Version 1 without it

Containers started by trusted jobs on GitHub-hosted runners, and local Docker
or Podman containers on maintainer machines (SP17). Any alternative has to
meet invariant 3; worktrees and plain subprocesses are not isolation.

### Restoring

| Location                   | Removed                                         | Now            |
| -------------------------- | ----------------------------------------------- | -------------- |
| Architecture §1.1, Sandbox | Deferred column: "Other isolation technologies" | Column removed |

## DF09. Browser extension; authenticated dashboard actions

A browser extension, and dashboard actions performed with the viewer's GitHub
authentication.

| Field     | Value                                                         |
| --------- | ------------------------------------------------------------- |
| Addresses | Not recorded                                                  |
| Deferred  | Architecture §1.1 (Browser code), recorded September 15, 2026 |
| Design    | Scope line only                                               |

### Version 1 without it

One static application with no secrets. Zone Z6 performs no writes: every
action is a deep link to github.com or copyable command text (architecture §4,
§6.6).

### Restoring

| Location                        | Removed                                                               | Now            |
| ------------------------------- | --------------------------------------------------------------------- | -------------- |
| Architecture §1.1, Browser code | Deferred column: "Browser extension; authenticated dashboard actions" | Column removed |

## DF10. Author-facing submission length caps

Policy-defined length caps constrain contributor-authored issue and PR text.
The browser assistant checks them before submission; intake rejects submissions
that exceed them.

| Field     | Value                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Addresses | P07. Excessive length obstructs triage; the problem remains in the problem statement.                                              |
| Deferred  | September 17, 2026, by request to exclude author-facing length-cap enforcement from the active design. No further reason recorded. |
| Actors    | Maintainers defining policy; contributors using the submission assistant; steward intake                                           |
| Trigger   | Policy publication; contributor preflight; issue/PR intake                                                                         |
| Inputs    | Submission length caps in policy; contributor-authored submission text                                                             |
| Outputs   | Published limits; client-side validation; `needs-changes` requesting a concise version                                             |

### Design

1. Maintainers configure length caps in the Submission policy area.
2. SP01 publishes the caps in the public policy subset (`data/policy.json`)
   so contributors can see them before submitting.
3. SP05's browser assistant checks required fields, length caps, and reference
   format before producing an issue-form URL or PR-body text.
4. SP06's category contract check returns `needs-changes` for a submission
   over the caps and asks the author for a concise version. The steward does
   not summarize or complete the submission on the author's behalf.
5. Contributor documentation lists the limits among published expectations
   and directs authors of oversized submissions to supply a concise body.

### Version 1 without it

Submission policy, the public policy subset, browser validation, and intake
have no author-facing text-length caps or associated rejection behavior.
Required fields, references, and attachment size/format checks still apply.
P07 remains in the problem statement; the active design addresses it through
concise steward reports, severity handling, and controls on steward chatter.

### Retained in version 1

- Submission contracts, public policy data, and browser validation.
- SP06's `needs-changes` outcome for unmet submission requirements.
- Attachment count, byte, fetch, and decompression bounds.
- Steward report length caps and report-length measurements.
- P07 severity handling in preflight and intake; concise reporting and no chatter.

### Restoring

Restore policy and public-data fields in architecture §§6.6 and 8, browser
checks in §6.6 and SP05, and intake behavior in SP06. Update SP01 publication
and its Addresses field, architecture §14 traceability, the whitepaper's
submission requirements, and contributor configuration, usage, and
troubleshooting guidance. The removed wording and its replacement follow.

| Location                            | Removed                                                                                                                                                                                                             | Now                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| docs/architecture.md                | required fields, length caps (P07), and reference format                                                                                                                                                            | required fields and reference format                            |
| docs/architecture.md                | length/attachment caps                                                                                                                                                                                              | attachment caps                                                 |
| docs/architecture.md                | validated issue, length caps, reference requirements                                                                                                                                                                | validated issue, reference requirements                         |
| docs/architecture.md                | Length caps published and enforced at intake; fixed concise report format                                                                                                                                           | Fixed concise report format                                     |
| docs/architecture.md                | SP01, SP05, SP06, SP13, SP16                                                                                                                                                                                        | SP05, SP06, SP13, SP16                                          |
| docs/processes.md                   | P01, P07, P09, O02; invariants 2 and 7                                                                                                                                                                              | P01, P09, O02; invariants 2 and 7                               |
| docs/processes.md                   | Evidence requirements per category, length caps, the code catalog, and the                                                                                                                                          | Evidence requirements per category, the code catalog, and the   |
| docs/processes.md                   | required fields, length caps (P07), reference format,                                                                                                                                                               | required fields, reference format,                              |
| docs/processes.md                   | a submission over the length caps (P07) is `needs-changes` with a request for a concise version; the steward does not summarize or complete the submission on the author's behalf; severity assertions are ignored; | severity assertions are ignored;                                |
| docs/whitepaper.md                  | Submission requirements: fields, length caps, references, and whether a PR                                                                                                                                          | Submission requirements: fields, references, and whether a PR   |
| docs/user-manual/configuration.md   | validated-issue linkage, length caps, reference requirements                                                                                                                                                        | validated-issue linkage, reference requirements                 |
| docs/user-manual/usage.md           | evidence requirements, supported versions, length limits, and proposal policy.                                                                                                                                      | evidence requirements, supported versions, and proposal policy. |
| docs/user-manual/troubleshooting.md | Submission exceeds limits                                                                                                                                                                                           | Attachment exceeds limits                                       |
| docs/user-manual/troubleshooting.md | Body length or attachment size/format violates the contract.                                                                                                                                                        | Attachment size/format violates the contract.                   |
| docs/user-manual/troubleshooting.md | Supply a concise body or compliant files. The steward does not rewrite the submission for the author.                                                                                                               | Supply compliant files.                                         |

### Open questions

The design did not specify numeric caps, counting units, per-field versus
whole-body scope, or treatment of quoted text and fenced reproduction blocks.
