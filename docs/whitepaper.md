# Patch Steward: Issue and Pull Request Screening for Maintainers

## Abstract

This is a **WORK IN PROGRESS**.

Low-quality issues, security reports, pull requests, and replies can arrive faster
than open-source maintainers can assess them. Unsupported claims, missing
reproductions, unsuitable fixes, and absent contributor follow-through transfer
investigation and completion work to reviewers. Excessive reporting and automated
discussion add triage and moderation work. The resulting burden delays development
and credible security work and damages maintainer motivation and retention.

Patch Steward's goal is to alleviate these problems, as defined in the
[problem statement](problem-statement.md). Its proposed local and GitHub-hosted
tools combine LLM investigation, reproducible execution evidence, and concise
contributor feedback to establish whether claims are valid, changes serve the
project, and submissions are ready for substantive human review. Contributors
remain responsible for understanding and completing their work.

The project will interface directly with LLM APIs, GitHub APIs, Git, and existing
build and test tools. Success requires measured workload reduction while
preserving access for valid contributions. Screening evaluates evidence and
project fit regardless of authorship; a pass records satisfaction of defined
requirements, with acceptance and merge authority retained by maintainers.

## 1. Origin and scope

This whitepaper develops the methodology, components, and implementation
decisions from the originating conversation on September 14-15, 2026, around the
goal of alleviating the review burden documented in the
[problem statement](problem-statement.md). That document defines the problems
and their supporting evidence. Product behavior described here is proposed unless
explicitly identified as implemented.

The problem scope includes issues, security reports, pull requests, and review
exchanges: disproportionate review effort, unsupported evidence, unjustified
defect claims, missing reproduction and applicability, unsuitable patches,
missing contributor support, excessive reporting, unproductive automation,
misaligned incentives, displaced maintenance, and maintainer exhaustion
(P01-P11). The proposed response centers on contributor preparation, claim
validation, patch verification, concise feedback, and evidence-based routing.
The detailed execution workflow below focuses on GitHub issues and pull requests;
security reports also inform the requirements and evaluation cases.

The project aims to reduce the investigation work transferred to maintainers and
the resulting delays and emotional burden. It cannot by itself change bounty
incentives, guarantee contributor participation, or resolve harassment and
burnout. AI assistance, inexpensive generation, legitimate remediation work,
policy differences, and lost learning opportunities are distinguished from the
core review-quality problem (N01-N05).

Admission fairness, shared handling guidance, and evidence that screening works
are design and evaluation concerns (O01-O03). The response must preserve paths
for legitimate contributors, provide clear evidence requirements and dismissal
reasons, and measure its own workload and errors.

The architecture and processes selected on September 15, 2026 are recorded in
[architecture.md](architecture.md) and [processes.md](processes.md). Sections
9–14 summarize the design; §§2–8 explain its methodology. Process identifiers
(SP01–SP20) and architecture references point to the detailed design. Version 1 screens GitHub issues and pull
requests in public or private repositories (architecture §1.1).

## 2. Goals and limits

### Goals

The primary goal is to reduce avoidable maintainer work caused by low-quality
contributions, preserving capacity and motivation for useful maintenance,
security work, and community growth. The following goals map to the problem
statement's issue identifiers:

- **Justify review effort (P01, P03, P05):** establish that the claimed problem
  exists, the expected behavior has an authoritative basis, and the proposed
  benefit and design fit the project before substantial patch review.
- **Verify claims and applicability (P02, P04):** check that cited APIs, code,
  and references exist and support the claim; require reproducible evidence in
  a supported environment and distinguish project defects from misuse or
  failures in another application.
- **Verify fixes in context (P05):** require before-and-after evidence for bug
  fixes, assess design and completeness, and check for regressions beyond the
  edited code. Passing tests alone cannot establish that a change is wanted.
- **Support contributor responsibility (P06, P09):** give actionable preflight
  feedback and request missing evidence, explanations, and revisions from the
  contributor, reducing the unfinished investigation handed to maintainers.
- **Keep triage and automation useful (P07, P08):** produce concise evidence and
  specific findings, consolidate automated updates, and leave unsupported
  severity claims and ambiguous intent for maintainer assessment.
- **Protect maintainer capacity (P01, P10, P11):** automate bounded collection,
  execution, reporting, and routing to reduce repeated investigation, queue
  pressure, and avoidable exchanges that displace development and security work.
- **Preserve fair, auditable handling (O01, O02):** state evidence requirements
  and decision reasons, distinguish uncertainty from poor quality, and support
  appeals and maintainer overrides without treating AI use alone as a defect.
- **Demonstrate net benefit (O03):** measure maintainer time saved, invalid
  submissions admitted, valid contributions blocked, contributor retries and
  abandonment, and screening cost and latency before enforcing admission rules.

### Limits

Tests cannot prove the absence of regressions. LLMs can misunderstand intent,
miss defects, invent problems, or repeat the author's assumptions. Neither an AI
approval score nor a passing test written against a mistaken expectation is
sufficient evidence of correctness.

The system admits work to human review; maintainers retain acceptance and merge
authority. It must distinguish a bad contribution from an unavailable environment
or an ambiguous specification.

## 3. Quality contract

A versioned policy maintained on the trusted target branch, at
`.github/patch-steward/policy.yml` and owned by maintainers through
CODEOWNERS, defines:

- Supported behavior, environments, platforms, compatibility guarantees, the
  project's own components, and the documents and decision records that
  stages may cite.
- Change categories and the evidence required for each.
- Submission requirements: fields, references, and whether a PR
  must link a validated issue.
- Required build, test, lint, and static-analysis commands and the platform
  matrix.
- Mandatory checks that impact analysis cannot omit.
- Trusted control paths and execution-sensitive paths (package scripts,
  build/test configuration, reporters, shared helpers, and harness code) whose
  changes restrict CI reliance or require maintainer triage.
- Runner image (optionally defined under `.github/patch-steward/runner/`),
  network setting, and resource limits for sandboxed execution.
- Escalation rules for unclear requirements and sensitive changes.
- Runtime, token, retry, and other resource limits.
- Inference: the shipped adapter, model, authentication method, and admission
  rule, as credential references only; no default provider is substituted.
  The section is optional: without it deterministic stages still run, and a
  run that reaches a model stage ends inconclusive.
- Operating mode per category: observe, advise, or enforce, with neutral gate
  checks for unenforced categories when a repository-wide check is required.
- The follow-up limit, passive hygiene heuristics, evidence retention and
  publication settings, and the dismissal-code catalog.

A PR may propose policy changes, but cannot make those changes govern its own
screening run. Each report records the policy revision used: the git tree id
of the policy directory at the trusted commit, read from git objects, with
that commit recorded alongside it; unrelated default-branch commits do not
change the revision, and any change inside the directory does. An invalid or
missing policy on the trusted branch makes every run inconclusive; the
steward never falls back to defaults beyond the few the design documents
(SP01).

## 4. Submission contract and bug validation

The contributor supplies expected behavior and an authoritative basis, actual
behavior, affected version, a minimal reproduction with an execution command,
and the proposed scope of the fix. References may include documentation,
specifications, or an accepted maintainer decision. Issue forms with stable,
unique rendered labels and a PR template with headed sections and a hidden
version marker carry these fields; a
browser assistant and a local preflight command help contributors complete them
before submitting (SP05, SP06). A submission that does not follow the template
is returned with a request to use it unless the policy allows free-form
submissions.

Parsing uses versioned label/heading mappings, recognizing an issue form's
version by its set of labels and the PR template's by its marker; GitHub's form
ids are used for prefilled URLs and are not present in submitted issue bodies.
The contract check is deterministic and makes no model call; `steward preflight`
runs the same check on a local draft. Linked issues
skip claim validation only when a successful final validation, all required
reproductions, policy, content/evidence hashes, target applicability, and claim
scope still match. A classification alone is insufficient (SP06).

Model use is organized as isolated sessions, each with a bounded context and a
response schema: session A validates claims (this section), session B
challenges patches (§6), and session C assesses author replies (§8). They never
share conversation history. These names describe isolation roles, not a
three-call limit: SP07 extraction, SP09 output interpretation, SP10 design,
SP12 impact analysis, SP16 hygiene, repairs, and preflight can add calls.
Every call is stage-tagged and debits the same run/stage budget; no auxiliary
session introduces author prose or A/C history into B.

Cited files, symbols, quotations, issues, URLs, document sections, and versions
are verified at the claimed revision before any claim is assessed. Each
reference is recorded as verified, unverified, or fabricated; a fabricated
authoritative basis is a blocking finding (SP07).

The LLM examines relevant source, tests, documentation, prior issues, and
decisions. For defect claims it returns one of: supported defect, intended
behavior, feature request, duplicate, or uncertain. For proposal issues it returns
accepted proposal, proposal pending, duplicate, or uncertain; feature/design
PRs are accepted proposals or unrequested changes. Each classification must
include evidence pointers that the core confirms exist; a classification
without them degrades to uncertain. A claim that repeats a previously dismissed
claim without new evidence is a duplicate citing the prior dismissal (SP08).
Well-formed proposal issues enter the proposal backlog, awaiting an intent
decision; feature requests missing proposal fields return to the author.
Only unresolved screening questions enter triage. Accepted proposal issues
do not need a defect reproduction. SP08 defines routing and
SP13 defines the single final-outcome table.

A failing regression test is not enough: the asserted expectation may be wrong.
For example, a test that expects an intentionally unsupported input to succeed
does not establish a defect. Ambiguous intent enters a small maintainer triage
queue before substantial implementation review. Proposal issues are the
channel for requesting a decision: a well-formed one is `proposal-pending` and
waits in the proposal backlog, without author requests, until a
maintainer accepts or declines it through a recorded command (labels are
outputs of that record, never inputs). A PR that implements a feature without an
accepted proposal is returned to its author with the code `proposal-required`
by default (`unrequested_change: propose-first`), satisfied when a linked
proposal is accepted or a maintainer accepts the claim on the PR; a project
may instead set `triage` to decide such PRs in the triage queue (SP08).

Missing evidence produces a specific request for changes. The system does not
invent requirements to complete the submission. Security-claimed issues follow
the policy's escalation rule and never receive a severity statement from the
steward.

## 5. Reproduce the defect and verify the fix

Every execution that produces evidence runs inside a disposable container that
a trusted job starts with no credentials, no host environment, and network
disabled except for a policy-declared dependency step (SP17). Reproduction runs
on the claimed version and its policy-mapped supported target/maintenance branch;
the default branch may also be compared (SP09).
When the contributor declares observable markers such as exit status or output
text, matching is rule-based; otherwise a model assessment states whether the
output shows the claimed behavior and marks ambiguity as uncertain. A
reproduction on a supported release remains applicable even when the default
branch is fixed; record affected releases and backport needs. Only a claim
limited to unsupported versions with no affected supported target receives
`not-applicable-version`. Unknown support mapping requires triage. Failure to
reproduce in the claimed supported environment requests correction.

For a bug fix, the PR declares the regression test that demonstrates the
defect, and the runner executes it against controlled revisions (SP10):

| Revision                                                          | Required evidence                        |
| ----------------------------------------------------------------- | ---------------------------------------- |
| Base commit plus only the PR's test-path changes, without the fix | Fails for the claimed behavioral reason. |
| Head commit with the identical regression test                    | Passes.                                  |
| Merge commit at screening time                                    | Passes.                                  |

Before merge, the merge-queue group separately runs the mandatory suite and
baseline comparison (SP12); it does not repeat each member's before-and-after
claim verification.

The failure on the base commit must be an assertion or behavior failure. A
compile or missing-symbol failure does not satisfy the requirement; when the
fix introduces an interface the test needs, the policy may accept a
contributor-supplied reproduction script as the before evidence. A build
failure unrelated to the claim is an environment result, not the required
negative result.

Anti-gaming analysis is deterministic over test paths and configuration:
removed, skipped, or exclusively focused tests; reduced assertion counts in
touched tests; broadened exception handling; changed timeouts, retries,
exclusions, or CI commands; and test-identity, count, skip, and duration
comparisons against the base in the same environment. Execution-sensitive path
changes and unexplained discrepancies require triage even if containers pass.
Submitted code can manipulate result files and exits in CI and containers alike;
isolation protects hosts and credentials, not the truth of test results.
A design and completeness assessment adds findings only when they are backed by
evidence, and they block only when an explicit requirement is violated, such
as a policy rule against duplicating a named helper; otherwise they are
advisory.

Results record the command, environment identity (image digest and tool
versions), exit status, bounded output, test identity, and commit ids.
Environment failures end the run as inconclusive; they never become a rejection
or a pass.

## 6. Independently challenge the patch

A separate session receives the policy's supported-behavior section, the
validated claim with its evidence, the diff, touched files with their callers
and shared components found by deterministic search, tests, and the execution
evidence collected so far. It does not receive the PR description, commit
messages, author comments, or preflight summaries (SP11).

It traces affected callers and shared components, checks boundary and error
cases, looks for compatibility changes, and proposes concrete counterexamples as
executable tests in the project's declared framework. Separate execution jobs
on fresh runners with no model credential execute them in containers
against the head and base commits within policy bounds on count and rounds.
First validate each expected behavior against a trusted requirement or accepted
decision and the intended change scope; retaining intentionally replaced
behavior is not a valid regression expectation. With that basis, head failure
and base success establishes a regression, including head-only compilation
failure caused by a broken supported API. Invalid generated tests that fail to
compile on both revisions are discarded; environment failures are inconclusive.
Failures on both are pre-existing unless they demonstrate an unmet part of the
validated fix scope. Non-executable suggestions are advisory and never gate
admission; unresolved required intent decisions are uncertain and need triage.

Complex or high-impact changes may justify property-based testing, fuzzing, or
mutation testing where the policy marks the paths. These are selective tools,
not universal requirements.

Every blocking finding identifies a concrete scenario, code location, and
supporting evidence. Independent sessions can still share model blind spots;
agreement is not proof. Model failure in this stage ends the run as
inconclusive rather than as a pass without a challenge.

## 7. Regression analysis

Baseline results for the unmodified target are reusable only for matching base,
policy, platform, command/harness, and environment identities. Required missing
platform baselines are inconclusive; a Linux run cannot substitute for Windows
coverage (SP12).

Head results come from steward-controlled container executions and optional
project CI signals. Signals retain their provenance and may supplement coverage
only under policy, after workflow/run/attempt, actual tested revision, and
environment verification. Changed control paths prevent reliance on
PR-controlled CI. Required missing coverage is inconclusive; baselines must
match platform, command/harness, and environment, not just commit.

Neither source guarantees result integrity. Triage execution-sensitive changes,
compare test identities/counts/skips/durations with baselines, and use challenge
tests as additional evidence. These mitigations reduce risk without proving
that submitted code or its reporter executed honestly (architecture §4).

Failures are compared with the baseline to separate introduced regressions from
existing problems; a failing test may be rerun once within budget to mark
instability. Changes to shared state, public interfaces, dependencies, and
build configuration require the full suite without impact-based reduction and
are flagged in the report. LLM impact analysis can add targeted checks but
cannot remove mandatory ones.

Tests against the integrated result matter because a patch that works in
isolation may fail when combined with recent upstream changes. The merge commit
is tested at screening time. In the merge queue, a credential-free relay on
the queue ref completes and thereby starts the ordinary screening run on the
default branch against the group commit; that run completes an App check on
the group commit, separately from each PR's check, and member PRs are not
re-admitted because queue entry already required the check (SP12). The group
path skips forms and claim/challenge screening and verifies the mandatory
suite against a matching baseline. Any enforced member makes the group
enforced; otherwise the strictest member mode applies. Unknown membership
or category cannot downgrade enforcement (SP06).

## 8. Admission and contributor feedback

The intended process is:

```text
Contributor preflight: CLI or browser assistant (output is a claim)
        |
        v
PR or issue --> one default-branch run: gate (dedupe, contract, caps/admission,
                check, ownership) -> intake -> execute -> assess
                -> bounded execute-N/assess-N pairs -> publish
                                |
        +-----------------------+-----------------------+----------------------+
        v                       v                       v                      v
  needs-changes             uncertain              inconclusive              pass
        |                       |                       |                      |
        v                       v                       v                      v
  awaiting author        maintainer triage       rerun within limits    ready for review,
  one report             commands, appeals       or triage              reviewers requested
```

Preflight can run locally or in the browser before a submission exists. Its
output is useful feedback but never evidence; the trusted stage repeats every
check (SP05). LLM-assisted self-review is optional, runs in the CLI with any
shipped adapter and the contributor's own credential, and discloses what
leaves the machine; the browser assistant performs no inference and needs no
inference account.

Outcomes are `pass`, `needs-changes`, `uncertain`, `inconclusive`,
`overridden`, and `superseded`. SP13 is the canonical decision table: stale
snapshots cannot publish; unavailable required steward work is inconclusive;
unresolved required maintainer decisions are uncertain; contributor omissions
and validated actionable blockers need changes; all satisfied requirements
yield pass. Advisory/speculative findings do not block. Overrides are scoped
and recorded; they cannot waive authentication, freshness, ownership, durable
evidence, or the shared-head rule. Shared heads are actionable needs-changes
blockers, resolved by distinct commits or closing the other PRs, not triage
questions. Queued and awaiting-approval are waiting states, not outcomes.

A screening report has a fixed order and length caps: outcome and bound
identifiers, classification, blockers with scenario, location, evidence link,
dismissal code, and the specific request, uncertainties for maintainers,
executed commands and results, the references, flagged automated
activity, what would change the outcome, and the policy revision, steward
version, and model identity. It contains no statement about the severity of
the reported problem, no authorship statement, and no praise. The steward
maintains one report comment per submission, edited in place, and, for PRs, a
check run created by the App with inline annotations (P07, P08). Issues have
no commit and therefore no check run; they receive the comment and labels, and
a passed defect issue enters the ordinary backlog. A well-formed proposal
passes its submission contract into the proposal backlog as proposal-pending;
that pass does not constitute acceptance of the proposed change.

The operating mode determines visibility and enforcement:

| Mode      | Check run conclusion                                                                                                                                  | Visible output                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `observe` | None before a repository gate exists; otherwise `neutral`, explicitly "not enforced"                                                                  | Evidence and metrics only; no comments, labels, or reviewer requests |
| `advise`  | `neutral` by default; blocking exceptions below take precedence                                                                                       | Report, labels, review requests                                      |
| `enforce` | `success` for pass or an override to pass; `failure` for needs-changes or override to needs-changes; `action_required` for uncertain and inconclusive | Report, labels, review requests                                      |

A required screening check is bound to the steward App as its expected source.
When any category is enforced, every PR receives that gate; unenforced categories
complete it neutral after ownership commitment and category validation,
without waiting for shadow screening, except shared-head and waiting runs.
Queued/awaiting-approval checks stay pending; superseded runs may cancel only
their own pending check and never replace reports/labels. Shared heads never
receive success or neutral: required checks (or any enforced category) use
action-required, otherwise an optional check fails. These exceptions precede
mode mapping. Category ambiguity
cannot downgrade an enforced change. The check does not prevent PR creation.
Only passed submissions in feedback-enabled modes receive automatic reviewer
requests, and a draft PR opened per the template is marked ready for review on
pass. Observe mode never promotes drafts or requests reviewers; the template
explains ordinary manual readiness/review for that mode. Reports bind to
body/linked evidence, persistent author responses, target/head, sharing PR set,
and the policy revision; the base commit is recorded with the snapshot but does
not enter snapshot comparison, so base-branch movement never supersedes a run.
Steward/provider/model/adapter/runner
identities are recorded separately as run provenance. A changed input starts a new run through its own event, through
propagation from a linked issue or a recorded maintainer action, or through
the policy-change sweep. An unpublished run superseded by a policy change
is always replaced; `policy_change` governs only rescreening prior published
outcomes. Linked-issue responses and validation changes propagate, and
synchronize/closure refresh peers sharing the old or new head. Live PR-link
reconciliation supplements the index so newly opened PRs are included. When the
repository gate is active, `gate` creates a fresh check run on every run,
after deduplication, including intentional same-commit reruns, then commits
the immutable ownership artifact with that check id. Duplicate held attempts
cannot replace an active owner of unchanged inputs. The earlier success
stops counting as soon as
the new check exists; a head commit shared by several open PRs is never
certified as success or neutral, because GitHub attaches checks to commits. `publish` stores evidence first, then recomputes the
snapshot, confirms through the per-submission ownership artifacts that it is
the newest run, and completes only its own check. Enforced branches also require a merge queue or
strict up-to-date checks; the steward does not revoke checks when the base
moves. API outages and event delays can delay supersession; if `gate` cannot
create the fresh check, the run stops and reports that the earlier
certification still stands (architecture §10).

Follow-through (SP14): a needs-changes report lists stable, submission-wide
request numbers, anchored to their durable creation records, and
says where each answer goes. A new commit or body edit starts a new run, and
fields and evidence enter only that way. A reply that cites a request number
becomes part of the snapshot and is assessed for whether it addresses the
request. Consumed explanations remain snapshot dependencies across report
edits/reruns until their scope is explicitly retired; edits/deletions remain
input changes. Deterministic checks precede a model judgment of whether an
explanation addresses the specific choice with reference to the code. An
awaiting-author submission keeps that state until its author acts or it is
closed; reopening restarts screening.

Maintainer control (SP15): users with write permission issue `/steward`
commands in conversation comments to rerun, override a specific submission
snapshot, record authoritative guidance about intent, waive a requirement,
accept a proposal issue or a PR's claim, record a dismissal code at or after
closure, confirm or dispute audited runs, or record time spent by activity.
Authors may rerun and appeal their own submissions; one
appeal is open at a time, it routes the item to triage, and it stays open until
a maintainer acts. PR intent acceptance binds to target and canonical
claim-scope text hash, so implementation pushes retain unchanged intent
acceptance while technical screening reruns. Scope changes need new
acceptance. Override and PR-accept commands start fresh owned publication
runs; commands never complete an old check directly. Guidance authenticates
maintainer intent, but its prose remains session data and cannot authorize
tools or change policy. Every override, guidance, waiver, acceptance, and
resolution is stored
with actor, reason, and scope, shown in the report, and counted for
calibration. The steward never argues in threads.

Automated participation (SP16): the steward posts no approvals, reviews,
severity statements, or praise, never replies to other bots, and ignores its
own verified report, usage, follow-up, ready-for-review, label,
reaction, and maintenance-issue echoes while still processing commands and
screened-input changes. It flags bot or app comments outside the policy allowlist,
near-duplicate comments, and reviews that reference nothing in the diff, in a
capped report section for maintainer attention. Flags never affect the outcome.
It does not hide comments, lock threads, or set interaction limits.

## 9. Components

Patch Steward is a pnpm monorepo (architecture §6):

| Package or directory | Responsibility                                                                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`               | Policy, submission parsing, context retrieval, reference verification, stages, execution planning, decision rules, report composition, evidence records, budgets, ownership/freshness, adapter interfaces and built-in adapters. |
| `cli`                | `steward init`, `preflight`, `screen`, `replay`, `policy`, and `report` commands, published to npm.                                                                                                                              |
| `action`             | Entry point that runs the core inside workflow jobs, from a runtime the credential-free `build` job compiles at the pinned commit.                                                                                               |
| `web`                | Static browser app: contributor submission assistant and maintainer dashboard.                                                                                                                                                   |
| `.github/workflows`  | Reusable steward workflows called by thin wrappers in target repositories at a pinned version; `steward-screening.yml` runs the `build`, `gate`, and `publish` jobs so far.                                                      |
| `templates`          | Policy skeleton, issue forms, PR template, wrapper workflows, labels, and CODEOWNERS entries installed by `init`.                                                                                                                |
| `scenarios`          | Test-bed scenario suite for GitHub-hosted screening: tools, helper workflows, fixtures, and recorded results; not a workspace package; never runs in CI.                                                                         |

Adapters isolate external systems behind interfaces: LLM (a Copilot SDK
adapter and an OpenAI-compatible HTTP adapter behind one interface), GitHub
(REST and GraphQL), Git, runner (Actions container runner, local
container runner, and an unsandboxed runner usable only for a contributor's own
code), evidence store (orphan branch or separate repository), and clock and
identifiers.

The target repository contributes GitHub features rather than code: Actions
events and reusable workflows, job permissions and environments, artifacts and
concurrency groups, the Checks API, rulesets, CODEOWNERS, merge queue, labels,
issue forms and the PR template, draft PRs and review requests, the GitHub App
identity, Copilot inference with the workflow token, GitHub Pages, an evidence
branch, and the search API
(architecture §7).

Components are logical boundaries; they need not become separate services.

## 10. Language and architecture

Python was initially suggested because the workload centers on orchestration,
API calls, and structured data. The discussion did not establish a measurable
Python advantage. The user preferred TypeScript, which is the selected language.

TypeScript offers explicit types for policies, evidence, and workflow states,
asynchronous orchestration, and code reuse across the CLI, the GitHub action,
and the browser app. External data still requires runtime validation; static
types do not validate API responses or LLM output.

One screening core runs in four topologies (architecture §5):

| Topology                   | Trigger                                 | Sandbox                                                            | Authority                                                                       |
| -------------------------- | --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| GitHub-hosted screening    | Actions events in the target repository | Containers on GitHub-hosted Linux runners, plus project CI signals | Authoritative for admission                                                     |
| Contributor preflight      | `steward preflight`                     | None; the contributor's own code                                   | Output is a claim                                                               |
| Maintainer local screening | `steward screen`                        | Local Docker or Podman container                                   | Attributed report; never the required check                                     |
| Evaluation replay          | `steward replay`                        | Local container                                                    | Frozen historical inputs; remote inference permitted; no live submission writes |

Each event produces one workflow run on the default branch. A credential-free `build` job first compiles the steward at the pinned commit; later jobs run only that runtime after verifying its SHA-256. `gate` authenticates, lists ownership artifacts, drops verified echoes, captures inputs, deduplicates by snapshot, decides contract/caps/admission, creates a check when needed, then commits an immutable ownership artifact.
`intake` validates claims and plans executions; `execute` runs containers;
`assess` interprets results and plans challenges. Fixed, bounded
`execute-N`/`assess-N` pairs handle challenge rounds on separate fresh
runners. Only execution jobs run submitted code; they hold a contents-read
token and no model credential. `publish` runs after successful commitment
even if downstream jobs fail, are skipped, or are cancelled, persists
evidence, checks freshness/ownership, and applies the outcome/waiting-state
mapping. Failed `gate`/`publish` jobs, or a cancellation that reaches them,
may leave pending checks for reconciliation.

Only `gate`/`publish` hold App credentials, through the default-branch-only Environment `steward-publication`, which they declare with `deployment: false` so that screening leaves no Deployment on pull requests; the core mints short-lived installation tokens scoped per job and repository.
An `env` provider key reaches only model jobs through a separate
Environment; Copilot uses those jobs' `GITHUB_TOKEN` with inference
permission, without an Environment secret. Private cross-repository evidence
is read in `gate` and handed off only as authorized bounded data. There is no
dispatch to another workflow or mutable steward orchestration store:
ownership artifacts/checks identify owners, run lists serve caps, and
append-only waiting/action records support resumption (architecture §6.4).

The browser app is a static bundle with no server, no secrets, and no
inference. The maintenance workflow publishes it to the target repository's GitHub Pages site
together with JSON generated from the evidence store: the public policy subset,
a run index, run details, queues, and metrics. The contributor face guides
intake and hands off through prefilled issue-form URLs or PR body text; the
maintainer face shows triage, awaiting-author, awaiting-approval, capacity,
appeal, audit, and proposal-backlog views with ages and changed-input markers,
per-run cost/usage, evidence, action history, and calibration metrics. Private
repositories disable public export unless a public subset is approved;
private evidence and Actions summaries retain visibility without Pages. Every action is a deep link to github.com or
copyable command text (architecture §6.6).

The core can screen repositories written in C++, Rust, Python, TypeScript, or
other languages by invoking their established tools inside the policy's runner
image; how that image is provided or generated is an open decision (§14).
Builds, tests, and remote model latency are expected to dominate runtime. No
performance benchmark was conducted during the design discussion.

## 11. LLM and GitHub connectivity

Inference goes through one provider-independent adapter interface. The core
submits prepared context, a response schema, and limits; adapters handle
authentication, request formats, response parsing, usage reporting, and
provider errors and return one typed result. Version 1 ships two adapters: a
Copilot SDK adapter, which performs bounded request-response inference with a
GitHub token and denies every tool, and an OpenAI-compatible HTTP adapter with
a project-supplied key. The trusted policy selects provider, model, and
authentication method (`github-token` or `env`); it holds credential
references, never secrets, and the steward never substitutes a provider or
model. A policy without an inference section is valid; a run that then reaches
a model stage ends inconclusive. In Actions the model credential reaches only the model-using jobs
through job `GITHUB_TOKEN` permissions for Copilot or a separate
default-branch-only Environment for `env` keys; the CLI
uses the user's own Copilot login or provider key; containers receive nothing.
Provider limits may apply per credential, account, organization, or model;
bounded retries followed by inconclusive apply in every case. Copilot code
review, the Copilot coding agent, and tool-enabled Copilot sessions are not
integrated (architecture §6.3, §12).

LLM requests produce validated structured findings, including claim
classification, evidence pointers, counterexamples, blockers, and
uncertainties. The core validates every external input at runtime against a
schema before use: model output, GitHub API responses, artifacts, and the
policy itself. Application rules decide admission. Schema conformance makes
responses easier to process but does not make them true. Model sessions
receive prepared context from the core and hold no tools in version 1; the
Copilot adapter runs its runtime in an empty working directory with every
tool denied, so no repository file or instruction file reaches the model
except through the core.

`pull_request_target` runs screen PR opens, commits, edits, reopens,
ready-for-review transitions, and closures on the default branch,
independently of project CI. Inert host fetch/checkout is allowed with hooks,
filters, and credential persistence disabled; submitted code executes only
in containers (SP17). Issue and comment events handle issue intake, replies, and
commands; `/steward rerun` calls the screening reusable workflow as a job
inside the comment run. A credential-free relay for `merge_group` completes
on the queue ref and thereby starts the screening run on the default branch
through `workflow_run`; it publishes nothing and holds no secrets. Base-branch
movement is left to strict up-to-date checks or the merge queue. Maintenance
runs on `schedule` and on `workflow_dispatch` restricted to the default branch,
because `workflow_dispatch` otherwise uses the selected ref; it reconciles
stale checks and missed events and handles queued starts, audits, and
publication (architecture §6.4).

A GitHub App provides the bot identity and fine-grained permissions. The core mints its installation tokens only in `gate` and `publish`, scoped per job and repository and revoked when the job ends; no webhook
receiver exists, so maintainer control uses comment commands. Events created
with the App token trigger workflows, so the steward ignores its verified
report, follow-up, usage, ready-for-review, label/reaction, and maintenance-issue
echoes while processing commands and input-change events; edited command
comments are not reprocessed, while edits to snapshot response comments are
input changes.
The adapter reads issues, PRs, diffs, files, check suites, workflow runs,
artifacts, and search results, and writes check runs, one report comment,
labels, review requests, ready-for-review state, and evidence commits.

No hosted backend is required. Continuous screening runs in GitHub Actions; the
local CLI screens on demand with the user's token and cannot receive events.
Publishing or modifying GitHub state is explicit in the operating mode and, for
local runs, in a publish flag.

## 12. Security and resource boundaries

The architecture defines trust zones (architecture §4). Trusted orchestration
holds least-privilege tokens and runs only the steward core. The sandbox holds
nothing: no environment secrets, no tokens, no container socket, and no host
mounts beyond a copied checkout and scratch space; containers run unprivileged
as a non-root user with CPU, memory, process, and time limits and network
disabled unless a policy-declared dependency step runs first. Worktrees,
virtual environments, and plain subprocesses are not sandboxes. Contributor
preflight runs the contributor's own code without a sandbox, and its results
are claims.

Untrusted content includes issue and PR text, diffs, files at the head commit,
comments, logs, execution output, and LLM output. It enters the core as typed
data after parsing and schema validation and never reaches a shell, a workflow
expression, or a tool authorization decision. Prompt instructions alone do not
enforce this boundary; rules in the core do.

External CI results remain signals. Verify their workflow/run/attempt, actual
tested revision, environment, and schema; changed control paths prevent reliance
on PR-controlled CI. Containers and CI share the risk that submitted code
manipulates tests, reporters, exits, and result files. Sensitive execution-path
triage, baseline comparisons, and independent challenge reduce that risk but
do not eliminate it. Pin steward workflows/actions by immutable commit SHA, and build the steward inside the run in a credential-free job, so the jobs holding the App key never install dependencies.
Artifact identity checks establish provenance, not truth. Where the plan and
visibility of the evidence store's repository offer rulesets, evidence writes
are restricted to the App and maintainers; where GitHub refuses rulesets, as
on a Free-plan organization's private repository, that restriction is
unavailable, like enforcement. Local uploads stay non-authoritative.

Run inexpensive checks first: contract checks before any model call,
deterministic reference checks before claim validation, execution before
challenge, and challenge last and only for categories that require it. Hard
call, retry, timeout, resource, and byte limits are enforced as steward
constants that a policy can lower but never raise (architecture §12); Copilot
credit limits are soft, checked after each model call, and may overshoot. Usage
across all sessions/rounds debits one run/stage allowance; exhausted limits
are never automatically extended. Daily and per-author caps are approximate counts
taken from GitHub's run list, tagged by the wrapper run name, and are documented as cost controls. Inference
spending is independent of the operating mode, because observe mode runs the
full pipeline: the contract gate precedes any model call, per-run budgets map
onto adapter session or request limits, the repository-wide daily cap bounds
volume across accounts. The optional prior-contribution admission rule may
delay newcomers until a maintainer admits the submission; approval queue ages
and abandoned holds expose this O01 tradeoff even in observe mode. Ownership
and freshness checks, not cancellation, prevent superseded runs from
publishing. Baselines are cached by
base commit, policy, platform, command/harness, and environment;
execution output is captured with bounds and redacted before storage.
Built-in credential detectors always run before storage; every credential the
steward resolved is also redacted as an exact value; project redaction
patterns are limited to a safe regular-expression subset under size and time
bounds, and a timeout fails closed. Redaction covers every stored record,
report, and log before a record is written. Daily run
caps and per-author concurrency caps limit steward cost without judging identity
(O01). Existing project CI is independent and outside those cost guarantees.

Infrastructure failure, model unavailability or retirement, a missing or
unusable model credential, a capability mismatch, model refusal, malformed
structured output after bounded repair, budget exhaustion, environment
unavailability, and a required stage that produced no result all end as inconclusive when required work cannot complete.
Trusted-path changes disqualify PR-controlled CI; missing replacement coverage
is inconclusive, while execution-sensitive changes require maintainer triage. Missing contributor evidence ends as needs-changes. None produce a
pass. The threat table in architecture §13 lists mitigations for workflow and
policy tampering, prompt injection, test weakening, credential exposure, model
credential exposure, the Copilot runtime's instruction files and tools,
container escape, forged evidence, cost exhaustion, model failure, provider
retirement, shared blind spots, log leakage, compromised releases, event loops,
and attachment fetches aimed at internal hosts.

## 13. Calibration and enforcement

Every category starts in observe mode: the pipeline runs on incoming
submissions and an optional bounded backlog, records decisions and evidence,
and shows no feedback on the submission (SP03), apart from a neutral "not
enforced" check when another category has enabled the repository gate.
Maintainer resolutions become
calibration labels when submissions are merged or closed, including dismissal
codes recorded with `/steward resolve`. Measure:

- Invalid submissions admitted and valid contributions blocked, per category
  and per decisive stage.
- Total maintainer minutes per incoming submission and per period, including
  rejected/abandoned work, triage, appeals, overrides, audits, policy upkeep,
  and operations. Record setup separately and amortize it over the evaluation
  period. Categorized `/steward time` entries and repository-level entries
  provide measurements; missing entries are unknown, not zero. Time-to-merge
  and review-comment counts remain proxies.
- Contributor retries and abandonment.
- Screening cost and latency, and the inconclusive rate by cause.
- Override, guidance, waiver, and appeal frequency and reasons.

Before assisted rollout, specify a randomized usual-review control or a matched
contemporaneous cohort, sampling/labeling coverage, and workload/error
thresholds. Compare total effort at matched volume and category mix and report
uncertainty and confounders; before/after observation alone cannot establish
causal savings. Pair quality labels with the exact screened snapshot: acceptance
of a revised submission does not establish that its earlier rejection was wrong.

The maintenance workflow samples passed and blocked runs for maintainer audit
and records the results. Mode changes are per category and recorded with the
measurements that justified them. Enable enforcement first for categories whose
evidence is deterministic and well supported, such as bug fixes with
before-and-after evidence; a rising error rate returns a category to advise.
Preserve maintainer overrides throughout. The success criterion is reduced
maintainer workload without systematically excluding valid contributions.

`steward replay` uses a frozen, content-addressed context manifest and evaluation
cutoff for every item: source, submissions, related discussions, cited pages,
decisions, and prior dismissals. It never retrieves current search/page results;
missing historical material remains unavailable. Labels and post-cutoff
resolutions stay outside the retrieval index. With these controls it reports confusion counts,
per-stage attribution, cost, latency, and differences from the previous steward
version (SP04). Evidence-store exports with resolutions become replay datasets
over time. Audit manifests for leakage; model training may already contain
public historical answers, so complement them with authorized held-out cases
and report that limitation (SP04).

### Historical evaluation cases

- [AI slop security reports submitted to curl — Daniel Stenberg](https://gist.github.com/bagder/07f7581f6e3d78ef37dfbfc81fd1d1cd):
  a curated list of security reports submitted to curl's HackerOne bug-bounty
  program, identified by its maintainer as AI slop. These cases can test whether
  Patch Steward detects unsupported claims and reduces investigation effort.
  The collection contains security reports, not a list of GitHub pull requests;
  because they carry no patches, only claim validation and reference
  verification apply to them.

Use accessible reports with the relevant historical source revisions and retain
maintainer resolutions as evaluation labels, withheld from screening inputs.
Supplement these cases with independently reviewed issues and pull requests,
including genuine defects and valid fixes, to measure both incorrect admissions
and incorrect rejections. Report unavailable evidence as inconclusive. This
collection alone cannot establish fix-verification or regression-detection
effectiveness.

## 14. Scaffold and open implementation decisions

The repository starts with pnpm, strict TypeScript, ESLint, Prettier, Vitest,
a separate type-check pass over sources and tests, coverage support, an MIT
license, and GitHub CI/CD templates. Authored documentation is tracked in
docs. The monorepo layout in §9 is implemented.

Implemented so far: the policy module in `core` (loading from an explicit git revision, the GitHub API, or a named local file, strict YAML and schema validation, hard bounds, the policy revision as the git tree id of the policy directory, documented defaults, and the public subset), shared vocabularies, version-1 record schemas, a redaction module, the submission module (versioned field mapping and parsing, category and path classification with built-in trusted and execution-sensitive lists, attachment rules with a bounded fetcher and archive inspector, the policy-change flag, snapshot and claim-scope hashing, the deterministic contract check, and issue and PR capture), a GitHub REST adapter whose only writes are App token requests and evidence commits, git diff, merge-base, and remote reads, the decision module (SP13's table in precedence order, the required-stage plan, and the architecture §10 check and label mappings as rules), the report module (a fixed-order report and check-run summary within report caps, escaping of derived text, and a wording denylist), the evidence module with a local store and the orphan-branch and repository stores (one directory per run, one JSON file per record, a manifest, redaction at persistence with 23 built-in detectors and exact-value redaction of resolved credentials, and append-only Git Data API commits read back by blob id), the job phases running in one process with validated handoff records, and the GitHub-hosted skeleton: the reusable screening workflow's `build`, `gate`, and `publish` jobs, called by the pull request and issues wrapper templates, in observe mode at contract level, with event authentication, App tokens the core mints, the ownership record and artifact, snapshot-based deduplication, caps from the tagged run list, waiting, supersession, and closure records, and job summaries, verified only on dedicated test-bed repositories by the scenario suite in `scenarios/`; conformance tests for invariants 1, 2, 4, 5, 6, 7, and 8; the `steward policy` command, the deterministic part of `steward preflight`, the `steward screen` command at contract level, and `steward report` under uniform CLI conventions with exit status 3 for `inconclusive` in every command, in `cli`; the policy template and its editor schema, the issue forms, the PR template, and the wrapper workflows in `templates`; and policy, submission, recorded GitHub response, and webhook event fixture corpora, with golden reports and screening scenarios. The `action` package runs the core's `gate` and `publish` inside workflow jobs; the `web` package holds toolchain smoke code only. No screening stage, container, model call, provider integration, check run, report comment, label, review request, publication of local results, maintenance workflow, restart of queued runs, installation in a target repository, or browser app is claimed.

Decisions recorded on September 15, 2026 and revised on September 16, 2026
(ADR-0001–ADR-0016 in `docs/adr`) settle the browser code's role, the absence of browser
secrets and browser inference, the version-1 submission types, the handling of
security reports, the deployment and trigger model, the sandbox model, the
local CLI scope, the LLM provider and its authentication, preflight inference,
inference admission, the evidence store, passive handling of automated
participation, distribution, repository layout, and single-run orchestration
with ownership commitment and job-level privilege separation.

Decisions recorded on September 26, 2026 (ADR-0034–ADR-0049 in `docs/adr`)
settle the version-1 policy schema, in which each platform lists the commands
it runs; integer schema versions with an additive evolution rule and
canonical JSON for record hashes; Zod as the single schema source; a strict
YAML subset for the policy file; the policy revision as the git tree id of
the policy directory; the optional inference section and provider pairing;
required keys with a few documented defaults, including `policy_change:
enforced`, free-form submissions off, and the default label names; the
built-in dismissal-code catalog; the public policy subset; hard bounds as
steward constants; redaction patterns; the `steward policy` command; and the
separate type-check pass for tests.

Further decisions recorded on September 26, 2026 (ADR-0050–ADR-0061 in
`docs/adr`) settle the versioned field mapping by rendered labels and a PR
template marker; one glob syntax for repository paths; built-in path classes
for category consistency; built-in trusted and execution-sensitive path lists;
attachment destinations, formats, and fetching; the snapshot composition and
hash, which record the base commit without comparing it; the canonical
claim-scope text; the deterministic contract result; a GitHub read adapter
without an SDK dependency; CLI GitHub authentication; the `steward preflight`
command; and the live-probe test runner.

Decisions recorded on September 27, 2026 (ADR-0062–ADR-0070 in `docs/adr`)
settle report caps as hard-only constants; report wording, escaping, and the
denylist; the evidence run directory, record files, and the local store;
redaction at persistence of resolved credentials and prefixed token formats;
uniform CLI conventions and exit statuses, which supersede the exit-status
rule of the `steward preflight` record; the `steward screen` and `steward
report` commands; local run identity; that required stages never pass
incomplete; and phase handoff records.

Further decisions recorded on September 27, 2026 (ADR-0071–ADR-0078 in `docs/adr`) settle the ownership record and artifact protocol, which orders owners by artifact creation time and re-lists after a settle delay; snapshot-based deduplication, in which explicit reruns and reopens replace the owner; approximate caps counted from a run list tagged by the wrapper run name; evidence store commits through the Git Data API, append-only and read back; waiting, supersession, and closure records; the reusable screening workflow, the publication Environment `steward-publication`, declared with `deployment: false` since September 28, 2026, and App tokens that the core mints; the steward built at runtime inside jobs, which supersedes the distribution record ADR-0011; and the test-bed scenario suite.

Decisions still to be made are implementation details (architecture §15): the
container image strategy and the network policy for dependency installation;
the default model per shipped adapter and prompt and repair design; the
context selection strategy and its token budget; test result parsing; the
duplicate search method; platform coverage beyond Linux containers;
enforcement thresholds derived from observation; reusing the user's Copilot login
for local inference; installation-time capability probing (what an
administrator token can read about the model provider's state without an
inference request; the job token reads none of it); whether read-only Copilot
tools consult the permission handler; and evidence retention mechanics.
Additional open details are daily inference aggregation; efficient live
PR-link reconciliation; Copilot prompt-mode evaluation; fixed round-job expansion and
budget handoff; and installation confirmation of latest-check and
neutral-check semantics. Architecture §15 is the authoritative open list.

## 15. References

### Blog Posts & Articles

- [Stay away from my trash! — Steve Ruiz](https://tldraw.dev/blog/stay-away-from-my-trash)
  (January 17, 2026): AI-generated PRs can pass tests while misunderstanding
  project needs, ignoring existing patterns, and lacking author follow-through.
- [Death by a thousand slops — Daniel Stenberg](https://daniel.haxx.se/blog/2025/07/14/death-by-a-thousand-slops/)
  (July 14, 2025): quantifies curl's false-report burden and maintainer exhaustion,
  with links to actual submissions.
- [New era of slop security reports for open source — Seth Larson](https://sethmlarson.dev/slop-security-reports)
  (December 3, 2024): plausible AI-generated security reports consume volunteer
  investigation time and contribute to stress, isolation, and burnout.
- [The I in LLM stands for intelligence — Daniel Stenberg](https://daniel.haxx.se/blog/2024/01/02/the-i-in-llm-stands-for-intelligence/)
  (January 2, 2024): concrete examples of hallucinated vulnerabilities and the
  lengthy clarification exchanges needed to dismiss them.
- [OpenSSF AI-slop working-group discussion](https://github.com/ossf/wg-vulnerability-disclosures/issues/178):
  collects maintainer accounts, project policies, and proposed mitigations for
  low-quality AI-generated reports and contributions.
- [The end of the curl bug bounty — Daniel Stenberg](https://daniel.haxx.se/blog/2026/01/26/the-end-of-the-curl-bug-bounty/):
  explains ending monetary rewards and moving reports to GitHub to reduce
  low-quality submissions and maintainer exhaustion.
- [Security Issues and Volunteers — Benjamin Peterson](https://www.locrian.net/writing/open-source-security/):
  describes how bogus reports, disclosure work, and bounty expectations burden
  volunteer CPython maintainers, predating generative AI.
- [Respecting maintainer time should be in security policies — Seth Larson](https://sethmlarson.dev/respecting-maintainer-time-should-be-in-security-policies):
  proposes short initial reports, optional proof-of-concept scripts, and
  maintainer-led severity assessment to reduce triage effort.
- [Maintaining open source in the age of generative AI — Adrin Jalali and Cailean Osborne](https://blog.probabl.ai/maintaining-open-source-age-of-gen-ai):
  recommends explicit AI policies, agent guidance, and contributor understanding,
  testing, and accountability to protect maintainer time.
- [The Generative AI Policy Landscape in Open Source — Kate Holterhoff](https://redmonk.com/kholterhoff/2026/02/26/generative-ai-policy-landscape-in-open-source/):
  maps project AI policies by permissiveness, disclosure requirements, adoption
  date, and concerns about quality, copyright, and ethics.

### Project Policies & Changes

- [LLVM AI Tool Use Policy](https://llvm.org/docs/AIToolPolicy.html):
  requires human review, contributor accountability, and disclosure of substantial
  AI assistance; contributions should justify their review cost.
- [Selenium AI-assisted contribution policy PR](https://github.com/SeleniumHQ/selenium/pull/17043):
  adds human accountability and AI disclosure requirements, prohibits autonomous
  PRs and commits, and updates the contribution template.
- [Django AI disclosure requirement](https://github.com/django/django/commit/0f60102444d8a2cfb662a7b11b3911b52567ee54):
  requires security reporters to disclose AI tools and their uses, verify
  reproducibility, and exclude fabricated content.
- [Node.js HackerOne Signal Requirement](https://nodejs.org/en/blog/announcements/hackerone-signal-requirement):
  requires a Signal score of at least 1.0 to reduce low-quality reports; an update
  directs researchers without Signal to security stewards through Slack.
- [Addressing AI-slop in security reports — Apache Log4j](https://github.com/apache/logging-log4j2/discussions/4052):
  describes report overload slowing development and prioritizing credible reports
  while deferring questionable ones within limited volunteer time.

### Examples & Data

- [AI slop security reports submitted to curl (gist)](https://gist.github.com/bagder/07f7581f6e3d78ef37dfbfc81fd1d1cd):
  catalogs HackerOne security reports identified by curl's maintainer as AI slop,
  with links to individual submissions.

### Talks & Events

- [FOSDEM 2026: OSS in Spite of AI](https://fosdem.org/2026/schedule/event/B7YKQ7-oss-in-spite-of-ai/):
  Daniel Stenberg's talk covers both maintainer overload from false AI reports
  and useful vulnerability discoveries by newer AI tools.
- [GVIP Summit AI-Slop Session](https://www.gvip-project.org/summit01/agenda/#aislop):
  Jarek Potiuk's session explores triage burnout and coordinated standards for
  identifying and dismissing low-quality automated vulnerability reports.
