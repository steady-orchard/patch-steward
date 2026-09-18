# Patch Steward Processes

**Status:** design document. Nothing described here is implemented. Each
process below runs on the components defined in
[architecture.md](architecture.md) and addresses numbered issues from the
[problem statement](problem-statement.md). Methodology comes from the
[whitepaper](whitepaper.md); where this document and the whitepaper differ,
this document reflects the decisions recorded in the architecture (ADR-0001–ADR-0016 in `docs/adr`).
Where this document and the architecture disagree, the architecture governs
components and boundaries and this document governs steps and behavior.

## 0. Conventions

### 0.1 Vocabulary

| Term                     | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence                 | A record of a steward-controlled execution or reference check with verified provenance. It records observations, not proof that submitted code or its test output is honest.                                                                                                                                                                                                                                                                                              |
| Signal                   | An external result, such as project CI. Policy may allow it to supplement platform coverage after source, commit, environment, and integrity checks; its provenance remains a signal (architecture §4).                                                                                                                                                                                                                                                                   |
| Claim                    | Anything a contributor states or produces, including preflight output. Never admissible; it tells the steward what to verify.                                                                                                                                                                                                                                                                                                                                             |
| Finding                  | A typed statement with severity `blocking`, `uncertain`, `advisory`, or `speculative`. Blocking findings carry a scenario, a location, evidence, and a validated requirement. Only required unresolved decisions are `uncertain`.                                                                                                                                                                                                                                         |
| Outcome                  | One of `pass`, `needs-changes`, `uncertain`, `inconclusive`, `overridden`, `superseded`.                                                                                                                                                                                                                                                                                                                                                                                  |
| Trusted path             | A workflow, policy, runner, or CI control path whose change prevents reliance on PR-controlled CI. Unchanged paths establish neither test completeness nor result-file integrity.                                                                                                                                                                                                                                                                                         |
| Execution-sensitive path | Package scripts, build/test configuration, reporters, shared helpers, harness code, or a policy-listed execution dependency. Changes require triage even when a trusted container run passes.                                                                                                                                                                                                                                                                             |
| Session                  | A bounded model interaction with a response schema and stage identity. A (claim), B (challenge), and C (responsiveness) are context-isolation roles, not the complete call count. Extraction, output interpretation, design/impact analysis, hygiene, repairs, and preflight use separately budgeted sessions; no auxiliary session carries author prose or A/C history into B.                                                                                           |
| Required evidence        | The items the policy requires from the contributor for the category: fields, references, a reproduction with its command, a declared regression test. Their absence is `needs-changes`; steward-side failures are `inconclusive`.                                                                                                                                                                                                                                         |
| Flag                     | A report annotation from hygiene heuristics (SP16). Flags are not findings, carry no severity, and never affect the outcome.                                                                                                                                                                                                                                                                                                                                              |
| Trusted branch           | The repository's default branch, which holds the policy and the workflow definitions that trusted triggers use.                                                                                                                                                                                                                                                                                                                                                           |
| Snapshot                 | Repository, head/base commits or issue content hash, target, body and linked-issue/attachment hashes, persistent author-response ids and hashes keyed to stable request ids (SP14), open PRs sharing the head, and policy content hash. `gate` records it; `publish` recomputes it. Provider/model/adapter/steward/runner identities are separate run provenance.                                                                                                         |
| Ownership record         | Immutable artifact uploaded after authentication, deduplication, admission decisions, and successful check creation (if active). Upload commits ownership: check id or null, run/attempt, snapshot/policy hashes, waiting/runnable disposition, creation time. Only committed artifacts order owners. An unchanged-input duplicate never replaces an active owner; explicit reruns can. Publication requires current inputs, its own check, and no later committed owner. |
| Repository gate          | Active when any category is in `advise` or `enforce` or a ruleset requires the steward check. Only then does `gate` create check runs; an all-observe repository without a required check has no checks, and ownership rests on the ownership record.                                                                                                                                                                                                                     |
| Deterministic            | Computed by rules, parsing, or search without model judgment.                                                                                                                                                                                                                                                                                                                                                                                                             |

### 0.2 Rules that apply to every process

- No process produces `pass` when required evidence is missing or required work
  fails through model failure, malformed output, budget exhaustion, or environment failure.
- Decisions come from rules in the core; model output is input to those rules.
- Every process records what it did as evidence and emits metrics events.
- Official screening reads policy from the trusted branch only. Replay pins an
  explicit policy revision; local policy experiments are marked non-authoritative.
- Authorship, AI assistance, account age, and presentation quality are not
  inputs to any decision (N01, N02).

Official GitHub checks and the ownership record apply to T1. T3 and T4 use
local snapshots, run ids, budgets, and durable local evidence; they create no
official checks. T3 may publish an explicitly attributed comment or upload
under SP20. T4 runs against SP04's frozen historical inputs, with no live
refresh or submission writes. The process map lists direct entry points;
replay invokes the same screening stages under these local constraints.

### 0.3 Process map

| ID   | Process                                 | Trigger                                                  | Topologies                       |
| ---- | --------------------------------------- | -------------------------------------------------------- | -------------------------------- |
| SP01 | Policy management                       | Maintainer edits; every run                              | All                              |
| SP02 | Adoption and installation               | `steward init`; manual setup                             | Setup                            |
| SP03 | Calibration and enforcement rollout     | Installation; schedule; mode changes                     | T1                               |
| SP04 | Evaluation replay                       | `steward replay`; steward releases                       | T4                               |
| SP05 | Contributor preflight                   | Contributor, before submitting                           | T2, Z6                           |
| SP06 | Intake and submission-contract check    | Issue and PR events; reruns                              | T1, T3                           |
| SP07 | Reference verification                  | After SP06                                               | T1, T3                           |
| SP08 | Claim validation                        | After SP07                                               | T1, T3                           |
| SP09 | Reproduction                            | Issues with reproductions; some PRs                      | T1, T3                           |
| SP10 | Fix verification                        | Bug-fix PRs                                              | T1, T3                           |
| SP11 | Independent challenge                   | PR categories per policy                                 | T1, T3                           |
| SP12 | Regression analysis                     | PRs with code changes; merge queue                       | T1, T3                           |
| SP13 | Decision, report, and admission         | End of any pipeline                                      | T1, T3                           |
| SP14 | Contributor follow-through              | `needs-changes`; author replies                          | T1                               |
| SP15 | Maintainer triage, override, and appeal | `uncertain`, `inconclusive`, awaiting-approval; commands | T1                               |
| SP16 | Automated participation hygiene         | Every run; comment events                                | T1                               |
| SP17 | Sandboxed execution                     | Any execution plan entry                                 | T1, T3, T4; T2 claim-only runner |
| SP18 | Evidence retention and publication      | Every run; schedule                                      | T1                               |
| SP19 | Resource control and failure handling   | Every run                                                | All                              |
| SP20 | Maintainer-initiated local screening    | `steward screen`                                         | T3                               |

### 0.4 Pipeline order

```text
Gate: authenticate -> snapshot/dedupe -> contract/caps/admission disposition
      -> fresh pending check (PR/group, if active) -> ownership commitment
      -> bounded evidence snapshots (when needed)
Issue:  SP06 intake -> SP07 references -> SP08 claim -> SP09 reproduction (defects) -> SP13
PR:     SP06 intake -> SP07 references -> SP08 claim (skipped only for a reusable
        successful validation; SP06) -> SP10 fix verification (categories
        that require before-and-after evidence) -> SP12 regression -> SP11 challenge
        (categories the policy lists) -> SP13 decision
Group: SP06 relay/group validation -> SP12 mandatory suite/baseline -> SP13
Jobs: gate -> intake -> execute -> assess -> bounded execute-N/assess-N pairs -> publish
Around every pipeline: SP17 execution, SP18 evidence, SP19 budgets, SP16 hygiene
After decision:        SP14 follow-through, SP15 triage
```

All of this happens inside one workflow run. Cheap stages run first: `gate`
performs the deterministic SP06 contract gate and the cap check before any
model call or steward-triggered execution, and intake verifies the captured
inputs. Existing project CI is independent, not a prerequisite or part of
steward's cost caps. Policy decides whether later stages still run after the
first blocking finding. Model jobs never execute submitted code; assessment
plans and execution results cross validated artifacts between fresh runners
(architecture §6.4). SP07 runs for every issue/PR submission because PR bodies carry
references of their own even when the claim was validated on an issue.

## 1. Governance and setup

### SP01. Policy management

| Field      | Value                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- |
| Addresses  | P01, P09, O02; invariants 2 and 7                                                                   |
| Actors     | Maintainers; steward policy module                                                                  |
| Trigger    | Initial authoring; policy change PRs; every run loads the policy                                    |
| Topologies | All                                                                                                 |
| Inputs     | Policy template from `steward init`; project knowledge (supported behavior, commands, platforms)    |
| Outputs    | Validated policy on the trusted branch; policy revision identifier per run; published public subset |

Steps:

1. Maintainers author `.github/patch-steward/policy.yml` from the installed
   template and validate it locally with `steward policy`.
2. Policy changes arrive as PRs. Where the repository's plan and visibility
   offer rulesets, CODEOWNERS plus required code-owner review in the branch
   ruleset requires maintainer review. Where GitHub refuses rulesets, as on a
   Free-plan organization's private repository, required code-owner review is
   unavailable, an accepted limitation that SP02 step 8 reports. The PR
   is screened under the current trusted-branch policy; the report flags the
   proposed change and reports validation results for the proposed file as
   data, without applying it.
3. On merge, the new revision governs subsequent runs. The revision is the
   content hash of the policy directory; the trusted-branch commit at load is
   recorded but does not enter snapshot comparison, so unrelated commits do
   not disturb runs. A run in progress completes its work under the revision
   it loaded but cannot publish under a superseded one: `publish` compares the
   live content hash with the snapshot and records `superseded`, and the
   maintenance sweep always queues a replacement for an unpublished snapshot,
   regardless of `policy_change`. The `all`, `enforced`, or `manual` setting
   applies only to rescreening already published outcomes. Prior reports stay
   bound to their revisions. Use ownership records and publication receipts to
   recover interrupted work, oldest first within caps; expose changed-input
   status until the replacement publishes.
4. The dismissal-code catalog is part of the policy. The template ships a
   default catalog with stable identifiers and short definitions (for example
   `no-reproduction`, `intended-behavior`, `not-applicable-version`,
   `unsupported-claim`, `fabricated-reference`, `duplicate`, `out-of-scope`,
   `insufficient-benefit`, `proposal-required`). Projects extend it. Codes
   appear in reports, overrides, and resolutions and can be shared across
   projects (O02).
5. Evidence requirements per category, the code catalog, and the
   `unrequested_change` setting are published to the Pages data so
   contributors see expectations before submitting (P09).

Controls: schema validation with unknown keys rejected; hard upper bounds on
limits that a policy cannot exceed.

Failure handling: an invalid policy on the trusted branch makes every run
`inconclusive` with a maintainer-facing message. The steward never falls back
to defaults silently.

Measures: policy revision per run; policy-change PRs; reruns after policy
changes.

### SP02. Adoption and installation

| Field      | Value                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------ |
| Addresses  | Prerequisite for all; O01, O03 through the initial `observe` mode                          |
| Actors     | Repository administrator; `steward init`                                                   |
| Trigger    | A project adopts Patch Steward                                                             |
| Topologies | Setup                                                                                      |
| Inputs     | Target repository; administrator's GitHub token                                            |
| Outputs    | Installed files (architecture §6.7), labels, evidence store, App configuration, Pages site |

Steps:

1. Run `steward init` in a clone. From the `templates` directory of the pinned
   steward version it writes the policy skeleton, issue forms, PR template,
   the four wrapper workflows pinned to that version, and CODEOWNERS entries,
   and it creates labels through the API. It asks for the LLM adapter, model,
   and authentication method, writes them into the policy skeleton, and prints
   the credential setup that step 3 describes. In the wrappers it writes,
   every call into a pinned reusable workflow whose jobs use the App or
   provider secrets passes each of them by name in an explicit `secrets:`
   mapping, never `secrets: inherit` (architecture §6.4); the credential-free
   `steward-relay.yml` passes no secrets. Existing files are never
   overwritten without confirmation; a diff is shown.
2. Register or install the GitHub App for the organization with the
   permissions the architecture lists (checks, issues, pull requests, contents,
   metadata, actions read). Store the App id and private key as secrets of a
   GitHub Environment whose deployment-branch rule allows only the default
   branch. The wrappers pass both secrets by name, and only `gate` and
   `publish` declare that publication Environment. Every privileged job runs
   on a default-branch ref
   (`pull_request_target`, `workflow_run`, `issues`, `issue_comment`,
   `schedule`, and guarded `workflow_dispatch`), so no other pattern is needed.
3. Configure inference. For `github-token` with the Copilot adapter, an
   organization owner enables the Copilot policy "Allow use of Copilot CLI
   billed to the organization" and, where wanted, a cost center or session
   limits; with `GITHUB_TOKEN`, a personal repository bills the repository
   owner's Copilot seat instead (architecture §6.3). This organization billing
   path is unverified: no probe has run in an organization with Copilot
   (`probes/findings.md`, PA08.7). For
   `env`, store the provider key as the secret of a second GitHub Environment,
   distinct from the publication Environment, with the same default-branch
   rule; the wrappers pass it by name in the same explicit `secrets:` mapping,
   only `intake` and `assess` declare that model Environment, and a spending
   limit is set on the provider's side. The policy holds no secret values;
   the trusted wrapper workflow decides which secrets enter which job.
   For private
   repositories, record administrator authorization to send the selected
   context to that provider; confidential context lacking authorization is
   withheld and required missing context routes to triage.
4. Create the evidence store: the orphan branch (init can create it) or a
   separate repository with the App installed there. Where the plan and
   visibility of the repository that holds the store (the target repository
   for the orphan branch, the separate repository otherwise) offer rulesets,
   add a ruleset that restricts pushes to the App identity and repository
   maintainers. Where GitHub refuses rulesets there, as on a Free-plan
   organization's private repository, the push restriction is unavailable,
   an accepted limitation like enforcement (step 8): `steward init` and this
   precondition detect the refusal and report that the control is
   unavailable.
5. Set the mode to `observe` (SP03).
6. For public repositories, enable GitHub Pages with Actions as deployment
   source. Private repositories leave public publication disabled unless an
   explicit public subset is approved. Private evidence and Actions summaries
   provide maintainer visibility when Pages is disabled.
7. Run the installation self-test through `workflow_dispatch`: the pipeline
   screens a synthetic submission end to end and reports which steps
   succeeded. The self-test also confirms that a fresh check run supersedes an
   earlier success on the same commit, that a `neutral` conclusion satisfies
   the required check, and that the merge-queue relay starts a default-branch
   run that completes a check on the group commit. It also sends a bounded
   synthetic inference request through the configured adapter and model,
   records the adapter's capability descriptor (structured output,
   system-prompt control, tool denial), and confirms that a run without a
   usable model credential ends `inconclusive` visibly. `steward init` writes
   each wrapper's permissions equal to the job permissions of the pinned
   reusable workflow it calls, and the self-test compares each installed
   wrapper's grant with those job permissions and fails visibly when a grant
   is short, because such a wrapper fails every run at startup, before any
   job, check, or report exists (architecture §6.4). Wrapper edits stay on the
   CODEOWNERS-reviewed path where the repository's plan and visibility offer
   rulesets; where GitHub refuses them, as on a Free-plan organization's
   private repository, required code-owner review of wrapper paths is
   unavailable (step 8).
8. Before enabling any category's `enforce` mode, require the stable steward
   check with the steward App's integration id as the expected source, never
   "any source". Enable strict up-to-date branch checks or a merge queue; the
   steward does not revoke checks when the base branch moves. Require
   code-owner review for policy and wrapper-workflow paths. All PRs then
   receive the gate check: unenforced categories complete it `neutral` as "not
   enforced", including categories still in `observe`, except shared-head or
   waiting runs, which retain their blocking dispositions. Validate this
   mixed-mode behavior and same-commit rerun supersession in the self-test
   before enabling the ruleset. GitHub offers rulesets and merge queue only
   for some plans and visibility settings; where it refuses them (a Free-plan
   organization's private repository), this precondition detects the refusal
   and keeps `enforce` off, and the repository runs `observe` and `advise`
   without a required check (architecture §7, §10). The same refusal leaves
   required code-owner review of policy and wrapper-workflow paths
   unavailable, an accepted limitation like enforcement; this precondition
   reports that control as unavailable as well (SP01 step 2).

Controls: pinned versions for reusable workflows and the action; init prints
every manual step it cannot perform, including the Copilot organization
policy, Environment secrets, and provider-side spending limits; the policy
holds credential references, never values. This organization billing path is
unverified: no probe has run in an organization with Copilot
(`probes/findings.md`, PA08.7).

Failure handling: missing App secrets make `gate` and `publish` fail visibly
and runs cannot publish a new success. A missing or unusable model credential,
a disabled Copilot policy, or an unsupported capability is detected in
`intake` before any plan; `execute` is skipped, and `publish` completes the
run with outcome `inconclusive` and the mode-appropriate check conclusion, so the
failure stays visible while publication remains available. A disabled Copilot
policy is detected only through the failure of `intake`'s bounded synthetic
request: the CLI reports "Access denied by policy settings", while through the
SDK it is an HTTP 403 `authorization` error that reads like an expired
credential, so without the CLI's text it is recorded with an unusable
credential as one `inconclusive` cause (architecture §6.3;
`probes/findings.md`, PA08.2). This organization billing path is unverified:
no probe has run in an organization with Copilot (`probes/findings.md`,
PA08.7). A wrapper whose permission grant is short of the pinned reusable
workflow's job permissions, for example one without
`copilot-requests: write`, is not detected in `intake`: the whole run fails
at startup with no job, check, report, or evidence, and only the Actions run
list and the self-test (step 7) show it. A missing or
unwritable evidence store
prevents admission; a missing Pages site only degrades the dashboard. Reports
link the durable evidence revision independently of Pages availability.

Measures: self-test result; time from init to first observed run.

### SP03. Calibration and enforcement rollout

| Field      | Value                                                                                  |
| ---------- | -------------------------------------------------------------------------------------- |
| Addresses  | O03, O01, P01, P10                                                                     |
| Actors     | Maintainers; maintenance workflow; dashboard                                           |
| Trigger    | After installation; schedule; before any mode change                                   |
| Topologies | T1                                                                                     |
| Inputs     | Steward decisions, maintainer resolutions, overrides, appeals, cost and latency events |
| Outputs    | Metrics rollups, audit samples, per-category mode decisions with recorded thresholds   |

Steps:

1. In `observe`, the pipeline runs on incoming submissions and, optionally, on
   a bounded backlog of recent items started through `workflow_dispatch`.
   Decisions and evidence are recorded; there is no report, label, or
   reviewer request. If a repository gate is already required for other
   categories, only the neutral "not enforced" check is visible. Observe mode
   runs the full pipeline and spends inference like any other mode; spending
   controls belong to SP19, not to the mode. Queued and awaiting-approval
   states still appear in evidence, Actions summaries, and authorized queue
   views, even when submission comments/labels are suppressed. Observe-mode
   contributors follow the repository's ordinary manual readiness/review
   process; the steward will not promote a draft.
2. Maintainer resolutions become labels for calibration. The `issues` and
   `pull_request_target` `closed` handlers record resolutions; the maintenance
   sweep reconciles missed events. The resolution (merged, closed with a
   dismissal code from `/steward resolve`, closed by the author, or closed by
   a maintainer without a code) is a metrics event paired with the steward
   decision for that snapshot. Reopening restarts screening (SP06).
3. Rollups computed on schedule: invalid submissions admitted and valid
   contributions blocked by any enforced non-pass outcome, per category and
   stage, using maintainer labels or audits for the exact screened snapshot.
   A later accepted revision does not prove an earlier rejection was wrong;
   closures without a quality reason remain unlabeled. Track submissions reaching human
   review per period and the share later dismissed; cost and latency; retries
   and abandonment; override and appeal counts and reasons; inconclusive rate
   by cause.
4. Audit sampling: the maintenance workflow selects a bounded random sample of
   passed and blocked runs and lists them in the dashboard audit queue. A
   maintainer confirms or disputes each with `/steward audit <run> confirm`
   or `dispute <reason>`; results are recorded.
5. Before rollout, record an evaluation protocol: random assignment to usual
   review versus steward-assisted review, or a matched contemporaneous control
   cohort when randomization is impractical. Define the period, categories,
   sample size, labeling coverage, and acceptable error/workload thresholds
   before observing outcomes. A before/after comparison alone reports its
   confounders and cannot establish a causal reduction.
6. Measure total maintainer minutes per incoming submission and per period,
   including rejected and abandoned work, triage, appeals, overrides, audits,
   policy upkeep, and operations. Record setup separately and amortize it over
   the stated period. `/steward time MINUTES [KIND]` records categorized time;
   repository-level setup/maintenance time is entered through the maintenance
   workflow and included in the same rollup. Missing time is unknown, not zero.
   Compare assisted and control totals at matched volume/category mix, with
   coverage and uncertainty; time-to-merge and comment counts remain proxies.
7. Mode changes are per category and recorded with the measurements that
   justified them. Enforcement starts with categories whose evidence is
   deterministic and well supported (bug fixes with before-and-after
   evidence), per whitepaper §13. A rising error rate is grounds to return a
   category to `advise`. A mode change that first activates the repository
   gate queues runs for open PRs so each receives its check; until then a
   all-observe repository without a required check has no checks. A category
   can enter `enforce` only where GitHub offers rulesets for the repository's
   plan and visibility (SP02 step 8); on a Free-plan organization's private
   repository categories stay in `observe` or `advise`, and the repository
   runs without a required check.

Controls: sample sizes bounded; the pipeline never reads the maintainer
resolution of the item it is screening; prior dismissals of other items remain
available to SP08.

Failure handling: missing resolutions leave items unlabeled; rollups report
coverage so that thresholds are not set on thin data.

Measures: the rollups above; coverage of labeled items.

### SP04. Evaluation replay

| Field      | Value                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Addresses  | O03                                                                                                          |
| Actors     | Steward developers; project maintainers; CLI                                                                 |
| Trigger    | Manual; steward release process                                                                              |
| Topologies | T4                                                                                                           |
| Inputs     | Labeled dataset with labels withheld from pipeline inputs; policy revision to use                            |
| Outputs    | Confusion counts, per-stage attribution, cost, latency, inconclusive rate, comparison with previous versions |

Steps:

1. Each dataset item has an evaluation cutoff and a content-addressed context
   manifest: submission/body and attachment snapshots, historical source and
   policy revisions, related issues/PRs/comments and their then-current states,
   cited external documents, decisions, and prior-dismissal records available
   at that cutoff. Labels, later resolutions, and scoring notes are separate
   and never enter the retrieval index or model context.
2. Sources: entries of the curl report collection whose report text and
   historical revision remain accessible, labeled from the maintainer's
   published resolution (security reports without patches, so only claim
   validation and reference verification apply); project-provided labeled
   issues and PRs including genuine defects and valid fixes; exports from the
   evidence store after resolutions exist (SP03).
3. `steward replay` retrieves only from that frozen manifest, never from live
   GitHub search or current pages. Immutable source objects may be downloaded
   by recorded hash before execution. Missing historical context is marked
   unavailable and the affected decision inconclusive; it is not substituted
   with hindsight. Run the local container pipeline and record the cutoff,
   manifest hash, policy revision, steward version, provider, requested/reported
   model ids, adapter/runtime versions, generation settings, and runner identity.
4. Scoring: invalid admitted, valid blocked, inconclusive, per category and per
   decisive stage; cost and latency per item; differences from the previous
   steward version on the same dataset.
5. The report is written locally and may be uploaded to the evidence store.

Controls: labels and post-cutoff context are withheld; duplicate/prior-dismissal
search uses the frozen index and excludes the evaluated item's resolution.
Audit manifests for answer leakage before scoring. Unavailable items are
reported, not skipped. Model training may already contain public historical
outcomes, so use held-out recent/private cases where authorized and report this
remaining limitation separately from retrieval leakage.

Failure handling: unavailable historical revisions or environments produce
`inconclusive` items; the collection alone cannot establish fix-verification
or regression-detection effectiveness (whitepaper §13).

Measures: the scoring outputs.

## 2. Contributor side

### SP05. Contributor preflight

| Field      | Value                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Addresses  | P02, P04, P06, P07, P09; reduces P01 load                                                                     |
| Actors     | Contributor; CLI (T2); browser assistant (Z6)                                                                 |
| Trigger    | Contributor prepares an issue or PR                                                                           |
| Topologies | T2; browser app (zone Z6)                                                                                     |
| Inputs     | Published policy subset; contributor's draft; contributor's branch (CLI); optional inference credential (CLI) |
| Outputs    | Prefilled issue-form URL or PR body text; preflight report marked unverified                                  |

Browser assistant steps:

1. Load `data/policy.json` from the project's Pages site.
2. Choose the submission type and category. The form shows the evidence
   required for that category, the dismissal-code catalog with definitions,
   and whether the project expects a proposal to be accepted before a feature
   PR, so expectations are visible before writing (P09).
3. Fill the fields: expected behavior and its authoritative basis, actual
   behavior, affected version, minimal reproduction with an exact command and
   the expected observable result (exit status or output text), proposed
   scope; for proposals, the problem, the benefit, and any existing acceptance
   or decision. A well-formed new proposal waits for that decision in the proposal backlog.
4. Client-side checks: required fields, reference format,
   presence of a reproduction command, version within the supported list. The
   form has no severity field; severity language in free text triggers a note
   that maintainers assess severity.
5. No inference in the browser: the page holds no tokens and sends nothing to
   a provider. LLM-assisted self-review runs in the CLI (below).
6. Hand-off: a prefilled issue-form URL using the form's field identifiers, or
   PR body text with a compare URL. Draft guidance is mode-aware: feedback-enabled
   screening can promote a passed draft; observe-mode contributors use the
   ordinary manual readiness/reviewer process. Mixed/unknown categories
   explain both paths without promising automatic promotion.

CLI steps:

1. Detect the upstream repository and fetch the policy from its trusted
   branch.
2. Parse the local draft and run the contract check exactly as SP06 does.
3. Run the mandatory commands on the contributor's machine without a sandbox.
   For a declared regression test, run it against a temporary checkout of the
   base commit and against the branch to preview the before-and-after result.
4. Optional self-review, when the contributor selects a shipped adapter and
   model and supplies their own credential; any adapter may be used because
   the output is unverified advice. Before sending, the CLI lists exactly what
   leaves the machine (draft text, diffs, code, tests, and policy context) and
   waits for confirmation. The session produces gaps and the questions a
   reviewer would ask, so the contributor can answer them in the submission
   (P06). Steps 1 to 3 need no inference account.
5. Print the preflight report marked as produced on the contributor's machine
   and unverified. The contributor may paste its summary into the submission;
   the steward treats it as a claim.

Controls: no writes to GitHub; the inference credential is used only for the
selected adapter and only after the disclosure; no telemetry leaves the
contributor's machine or browser.

Failure handling: a project without a published policy gets the default
checklist from the steward template.

Measures: none collected client-side; the contract pass rate at first
submission (SP06) indicates preflight effectiveness.

## 3. Screening pipeline

### SP06. Intake and submission-contract check

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Addresses  | P01, P03, P05, P07                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Actors     | `gate` job; `intake` job; submission, budget, and ownership modules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Trigger    | PRs: `pull_request_target` opened, synchronize, edited, reopened, ready_for_review. Issues: `issues` opened, edited, reopened. Both: `/steward rerun` through the issues run, queued starts from the maintenance run, propagated starts from linked-issue changes and recorded maintainer actions, reruns after a snapshot response comment is edited or deleted, policy-change rescreens, and rescreens after a PR sharing the old or new head closes or changes head. Merge queue: `workflow_run` completion of the relay, screening the group commit (architecture §6.4). |
| Topologies | T1, T3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Inputs     | Policy revision; issue or PR metadata, body, head and base commits, diff paths, linked items                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Outputs    | Typed submission; ownership record; execution plan; or an early `needs-changes` decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Steps:

1. In `gate`, authenticate the event/command, load the trusted policy, and
   capture the snapshot (§0.1), including the persistent response ledger
   (SP14) and current sharing PRs. Deduplicate before creating a check,
   committing ownership, or cancelling work: title-only edits and unchanged
   echoes preserve the current owner. Run the deterministic category/contract
   checks below, evaluate caps and admission (SP19), and select runnable,
   early-result, queued, or awaiting-approval disposition. An unchanged-input
   queued/held duplicate cannot replace an active owner; explicit reruns can.
   Create a fresh `in_progress` App check for a PR/group when the repository
   gate is active, then upload the ownership artifact containing that id.
   Upload commits ownership. If check creation fails, do not upload; if upload
   fails after check creation, leave that check blocking for reconciliation.
   A changed snapshot may commit a waiting state; it is recorded for restart.
   A shared head is `needs-changes` with an author-action blocker and cannot
   receive success or neutral, regardless of mode (architecture §10). Fetch
   bounded, visibility-authorized evidence snapshots for runnable work and
   hand them to later jobs as verified artifacts.
2. Fetch body, commits, diff paths, linked issues, labels as data, and the
   author-response ledger keyed by stable request ids (SP14). Identity is
   used for command authorization, follow-through, and the explicitly
   configured inference-admission rule, never to judge quality.

   **Merge-group branch:** verify relay repository/workflow/attempt and
   successful completion, resolve `workflow_run.head_sha` to a current queue
   group, and snapshot base, member PR/head set, policy hash, and recorded
   member categories. Skip steps 3–7 and SP07–SP11: a group has no issue/PR
   form or new claim to admit. Require reliable current membership and
   member admission records; missing/ambiguous data requires triage, never an
   unenforced fallback. If any member is enforced, the group is enforced;
   else advise if any member is advise, else observe. Apply caps, commit
   ownership/check as above, and plan SP12's mandatory suite and matching
   baseline. Required platform coverage still applies. No model call is
   required for deterministic group verification; any necessary result
   interpretation stays in a model-only job under the same budget.

3. Parse using a versioned mapping from unique rendered issue-form labels or
   PR headings to canonical fields. GitHub omits form `id` attributes from the
   submitted Markdown; those ids serve URL prefilling only. Retain mappings
   for supported template versions and reject ambiguous/duplicate fields with
   a correction request. An unrecognized structure is treated as unstructured;
   unless the policy allows free-form submissions, the outcome is
   `needs-changes` with a link to the assistant and template.
4. Determine the category from the declared field and check it against the
   diff; a mismatch (for example `docs` with code changes) is `uncertain`.
   When any plausible category is enforced, ambiguity requires triage under
   the enforced gate; a contributor cannot select an unenforced category to
   bypass it. Once `gate` establishes that a PR is outside enforcement,
   complete its committed repository-wide gate check as neutral "not enforced"
   before shadow screening only if it is neither queued/awaiting-approval nor
   shared-head blocked (architecture §10). Later shadow/evidence failures cannot block that
   category. Issues without a diff use the declared type and claim contract.
5. Contract check per category: required fields present and non-trivial;
   severity assertions are ignored;
   reference requirements are noted for SP07. Reproduction files arrive as
   fenced code blocks in the submission or as files attached to it. Enforce
   policy/hard limits on count, per-file and total bytes, redirects, fetch
   time, and decompressed size. Allow only approved public HTTPS destinations
   with no private/link-local redirects or forwarded credentials; hash bytes
   before handoff. Size/format violations request changes; required fetch
   failure is inconclusive.
6. Compare trusted and execution-sensitive paths between base and head.
   Control-path changes prevent reliance on PR-controlled CI. Changes to
   package scripts, build/test configuration, reporters, shared test helpers,
   and other execution-sensitive paths add a required maintainer-triage finding
   even if container runs pass. Flag proposed policy changes without applying
   them. These checks mitigate manipulation; unchanged paths do not prove
   result integrity.
7. Linkage (PRs): reuse only a stored successful validation, not an intermediate
   classification. It must match current issue body/attachment/evidence hashes,
   policy revision, applicable supported version/target branch, and validated
   claim scope; every required reproduction must have succeeded, with evidence
   still available. A changed input, failed/inconclusive reproduction, or a
   bare classification requires fresh SP07/SP08 and any needed SP09 work.
   Overrides, waivers, and proposal acceptances transfer only when their
   explicit scope covers this PR's snapshot, the issue's current content hash,
   or (for PR intent acceptance only) the canonical claim-scope hash and target; otherwise request fresh maintainer action. If a validated issue
   is required but absent, request one. Prior negative classifications are
   context, not automatic rejection of an edited claim.
8. Early exit: contract failures, over-cap runs, and runs awaiting inference
   admission end before any model call or steward execution. The run skips
   straight to `publish`, which records evidence and publishes `needs-changes`,
   the queued state, or the awaiting-approval state through SP13.
9. `intake` verifies the ownership record and snapshot it received, confirms
   that the policy's adapter is shipped, that its credential is present and
   usable, and that its capabilities meet the policy's requirements (failure
   ends the run `inconclusive` before any plan, SP19), and emits the
   execution plan: reproduction, before-and-after test, mandatory suite,
   platform expectations, the source for each (container evidence or CI
   signal), and whether a stored baseline exists for the base commit (SP12).

Controls: deterministic parsing; no model call in this process; if `gate`
cannot create the check run, the run stops before ownership commitment and reports that
the previous certification still stands (SP19).

Failure handling: GitHub API unavailable ends the run `inconclusive`; a
malformed template ends it `needs-changes` with the template link.

Measures: contract pass rate at first submission; time to first report;
distribution of contract failures.

### SP07. Reference verification

| Field      | Value                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Addresses  | P02, P04                                                                                                    |
| Actors     | Intake job; references module; optional extraction session                                                  |
| Trigger    | After SP06 for every issue and PR; PR bodies carry references even when the claim was validated on an issue |
| Topologies | T1, T3                                                                                                      |
| Inputs     | Submission fields; claimed version; base commit; policy-listed documents                                    |
| Outputs    | Reference table with a status per reference; applicability findings                                         |

Steps:

1. Extract references deterministically: URLs, issue and PR references, file
   paths with line ranges, symbols, quoted code or text, document section
   names, version identifiers. An optional model pass extracts references
   embedded in prose; every extracted reference is then verified
   deterministically.
2. Verify each at the claimed revision, or at the base commit when no version
   is stated: the file exists; the symbol is found by search; the quoted text
   matches; the issue or PR exists with the stated title and state; the URL
   resolves within bounds; the document section exists in policy-listed
   documents; the version exists among tags or releases.
3. Classify each reference as `verified`, `unverified` (could not be checked),
   or `fabricated` (definitively absent at the revision).
4. Applicability (P04): compare the claimed version with supported versions;
   detect references to vendored or third-party paths and reproductions that
   depend on another application, using the policy's component list; record
   an applicability finding when the claim may not belong to the project.
5. A fabricated authoritative basis is a blocking finding with the code
   `fabricated-reference`. Unverified references become `uncertain` items. A
   verified reference says nothing about correctness by itself.

Controls: bounded number of references; bounded external fetches with
timeouts; only public http and https hosts, with an optional policy allowlist;
no binary downloads.

Failure handling: network failures yield `unverified`, never `fabricated`.

Measures: fabricated-reference rate; share of submissions with an
unverifiable basis.

### SP08. Claim validation

| Field      | Value                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Addresses  | P01, P02, P03, P10, P11                                                                                                  |
| Actors     | Intake job; session A; context retrieval; search                                                                         |
| Trigger    | After SP07 for issues; for PRs whose claim is not already validated                                                      |
| Topologies | T1, T3                                                                                                                   |
| Inputs     | Submission claim fields; reference table; policy's supported-behavior section; repository context; prior classifications |
| Outputs    | Classification finding with evidence pointers; duplicate links; input for SP09                                           |

Steps:

1. Duplicate and prior-dismissal search within the repository: GitHub search
   over titles, bodies, error strings, and file names, plus the repository's
   evidence index of prior classifications and dismissal codes. Candidates
   are collected with links. Cross-repository matching is out of scope.
2. Context retrieval: source named in the claim, symbols and their callers,
   tests covering the area, policy-listed documents on supported behavior and
   recorded decisions, related issues and PRs, prior dismissals for the
   candidates.
3. Session A receives the policy's supported-behavior section, the claim
   fields, the reference table, and the context. It returns a structured
   classification: `supported-defect`, `intended-behavior`, `feature-request`,
   `duplicate`, or `uncertain` for defect claims; `accepted-proposal`,
   `proposal-pending`, `duplicate`, or `uncertain` for proposal issues;
   `accepted-proposal` or `unrequested-change` for a PR whose claim is a
   feature or design change. Each classification
   carries evidence pointers (file and line, document section, prior
   decision), a statement of what would change it, and an assessment of what
   the described reproduction would demonstrate.
4. The core validates the schema and applies rules: pointers must resolve or
   the classification degrades to `uncertain`; `duplicate` requires a
   resolving link; `intended-behavior` requires a document, test, or decision
   pointer. Security reports are not a submission type (architecture §1.1).
   A security-claimed issue is one whose declared category is
   `security`, whose form marks the security checkbox, or whose text matches
   policy-listed terms; detection errs toward treating a claim as security.
   Such an issue follows the policy's escalation rule (typically routed to
   triage with a pointer to the private reporting channel) and never receives
   a severity statement (P07, P10).
5. Prior-dismissal match (P11): a claim matching a previously dismissed claim
   without new evidence is classified `duplicate` citing the prior dismissal.
   New evidence means a reproduction or reference absent from the prior
   submission, determined by comparing fields; anything else is `uncertain`.
6. Route by the table below; SP13 decides the final outcome. Proposal issues
   are the approved channel for requesting a decision: a well-formed proposal
   without a recorded acceptance is `proposal-pending` and enters the proposal
   backlog, where it waits for a maintainer decision with no author
   requests. Acceptance is recorded only by a maintainer's
   `/steward accept` on the issue (SP15), which binds to the issue's content
   hash; the `claim:accepted-proposal` label is an output of that record, and
   a label applied by hand records nothing. An edited proposal whose hash no
   longer matches its acceptance returns to `proposal-pending`, and the report
   says so. Decline is `/steward resolve CODE` on close. The policy's
   `unrequested_change` setting applies only to PRs that implement a feature
   or design change without an accepted proposal: `propose-first` (default)
   returns the PR to its author until a proposal is accepted or a maintainer
   accepts the claim on the PR; `triage` treats the missing intent decision as
   a maintainer question on the PR itself.

| Classification                   | Next step                                                                                                                                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supported-defect`               | SP09 for issue reproduction when required; SP10/PR plan for a fix                                                                                                                                                                                                            |
| `accepted-proposal`              | Proposal issue goes to SP13 without defect reproduction; PR follows its category plan                                                                                                                                                                                        |
| `proposal-pending`               | Proposal issue: SP13 yields `pass` into the proposal backlog with label `claim:proposal-pending`; no author requests, not a triage item                                                                                                                                      |
| `feature-request`                | Defect claim that is a feature: relabel; if the proposal fields are present, treat as `proposal-pending`; otherwise `needs-changes` requesting the proposal fields (author action)                                                                                           |
| `unrequested-change`             | PR without an accepted proposal. Under `propose-first` (default): `needs-changes` with code `proposal-required`, satisfied by a linked proposal reaching `accepted-proposal`, by `/steward accept` on the PR, or by a waiver. Under `triage`: `uncertain`, maintainer triage |
| `intended-behavior`, `duplicate` | Evidence-backed contract/claim blocker; SP13 yields `needs-changes`                                                                                                                                                                                                          |
| `uncertain`                      | Maintainer triage; a safe supplied reproduction may still run in SP09 to gather evidence, without treating reproduction as proof of project intent                                                                                                                           |

Controls: one session with bounded tokens; retrieval is core-driven; the
model has no network access and no write capability.

Failure handling: model unavailable, refusal, or malformed output after the
repair budget ends the run `inconclusive`; missing claim fields end it
`needs-changes` with a specific request.

Measures: classification distribution; agreement with maintainer resolutions;
duplicates caught; repeat claims dismissed without investigation.

### SP09. Reproduction

| Field      | Value                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Addresses  | P04, P03                                                                                                         |
| Actors     | Execute job; sandbox (SP17); assess job for output interpretation                                                |
| Trigger    | Issues classified `supported-defect` or `uncertain` with a reproduction; PRs with a separate reproduction script |
| Topologies | T1, T3                                                                                                           |
| Inputs     | Reproduction command and files; claimed version; base commit; expected observable markers                        |
| Outputs    | Execution records on the claimed version and the current base; reproduction finding                              |

Steps:

1. Resolve the claimed version and its support window/maintenance branch from
   policy. Plan executions on that version and the relevant target/base;
   default-branch comparison is additional context when these differ. Reproduction files from the
   submission (fenced code blocks or attached files) are written to a scratch
   directory inside the sandbox, never into the repository tree. A PR's
   regression test is part of its diff and is handled by SP10, not here.
2. Execute in the sandbox with the policy's runner image, network disabled,
   and bounded resources.
3. Compare observed and claimed behavior. When the contributor declared
   observable markers (exit status, output text), matching is rule-based. When
   not, a model assessment states whether the output shows the claimed
   behavior and marks `uncertain` when ambiguous.
4. Reproduction on a supported version establishes applicability to that
   version even if default-branch code is fixed. Record affected releases,
   already-fixed targets, and any needed backport; unknown support mapping is
   `uncertain`. Use `not-applicable-version` only when the claim affects an
   unsupported version and no supported target reproduces it. Failure to
   reproduce in the claimed supported environment requests correction;
   unrelated build/setup failures are `inconclusive`, not negative evidence.
   A reproduction that
   exercises code outside the policy's component list carries the
   applicability finding from SP07 and cannot by itself establish a project
   defect (P04).
5. Record execution records with environment identity.

Controls: reproductions must be self-contained; a reproduction needing
network or services ends `inconclusive` with a request to reduce it, unless
the policy declares allowed services (open item).

Failure handling: environment unavailable ends `inconclusive`; it is never
recorded as "not reproduced".

Measures: reproduction success rate; environment failure rate.

### SP10. Fix verification

| Field      | Value                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| Addresses  | P05, P03                                                                                                        |
| Actors     | Execute job; assess job; sandbox                                                                                |
| Trigger    | PRs in categories that require before-and-after evidence, after SP06 through SP08                               |
| Topologies | T1, T3                                                                                                          |
| Inputs     | Declared regression test identity; diff split into test paths and non-test paths; base, head, and merge commits |
| Outputs    | Before-and-after execution records; anti-gaming findings; design and completeness findings                      |

Steps:

1. Identify the regression test the PR declares (file and test identity).
   Absence is `needs-changes`.
2. Execute per the whitepaper §5 table: the base commit with only the PR's
   test-path changes applied must fail for the claimed behavioral reason; the
   head commit must pass; the merge commit must pass. If the test needs
   non-test scaffolding, the PR declares those files, and the report flags
   them for review.
3. Classify the failure on base from result files and output: an assertion or
   behavior failure satisfies the requirement; a compile or missing-symbol
   failure does not. When a fix adds an interface the test needs, the policy
   may accept a contributor-supplied reproduction script (SP09) as the before
   evidence. Unclassifiable failures are `uncertain`.
4. Anti-gaming analysis, deterministic over test paths and configuration:
   removed, skipped, or exclusively focused tests; reduced assertion counts in
   touched tests; broadened exception handling; changed timeouts, retries, or
   exclusions; changed CI commands; test-count comparison with the base
   results, plus duration and test-identity comparisons in the same environment.
   Execution-sensitive path changes and unexplained discrepancies require
   triage; a demonstrated violation of a required test contract is blocking.
   Neither these comparisons nor the sandbox proves the results are honest.
5. Design and completeness assessment in the assess job: whether the change
   addresses the validated claim's scope, overlooks an existing helper,
   changes a public interface, or misses policy-required documentation. A
   finding blocks only when it demonstrates, with evidence, a violated
   explicit requirement: the validated claim's scope, a policy-listed design
   rule, or an accepted decision, for example a policy rule against
   duplicating a named helper. A duplicated helper without such a rule is
   `advisory` (SP11, SP13).

Controls: test-only application is a mechanical, path-filtered patch;
executions are bounded.

Failure handling: environment failure ends `inconclusive`; a missing declared
test ends `needs-changes`.

Measures: before-and-after evidence rate; anti-gaming hits; design findings
confirmed by maintainers.

### SP11. Independent challenge

| Field      | Value                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Addresses  | P05, P02, P01                                                                                                    |
| Actors     | Assess jobs plan/interpret session B; execution jobs run sandbox plans                                           |
| Trigger    | PR categories the policy lists (bug fixes, features, refactors, security); skipped for documentation and chores  |
| Topologies | T1, T3                                                                                                           |
| Inputs     | Trusted requirements, validated claim, diff, relevant code, tests, execution evidence; excludes author reasoning |
| Outputs    | Executed counterexamples with results; findings by severity                                                      |

Steps:

1. Build the session B context: the policy's supported-behavior section, the validated
   claim with its evidence, the diff, touched files with callers and shared
   components found deterministically, tests, and execution evidence so far.
   The PR description, commit messages, author comments, and preflight
   summaries are excluded.
2. Ask for traced callers and shared components, boundary and error cases,
   compatibility changes (public interfaces, serialization, configuration),
   and concrete counterexamples expressed as executable tests in the project's
   declared framework and location conventions. Each counterexample names the
   scenario, location, and expected behavior with a trusted requirement,
   compatibility promise, or accepted-decision citation. Validate that basis
   and the accepted change scope before using the test as a blocker. A test
   preserving behavior intentionally replaced by the accepted change is not
   a regression oracle; an unresolved expectation becomes a required intent
   question only if it prevents deciding correctness, otherwise advisory.
3. The assess job uploads a schema-validated plan of counterexamples. A
   separate `execute-N` job runs them in containers against head and base,
   with only a contents-read token on its fresh runner; `assess-N` interprets
   bounded results on another runner. Every handoff binds run/attempt,
   snapshot, round, and remaining total budget. Policy lowers the pinned
   workflow's fixed maximum round count; unused pairs are skipped. The model
   credential is never present in any execution job.
4. Classify only after validating the expectation. Passes on base and fails
   on head is an introduced regression, including a head-only compilation
   failure caused by breaking a supported API. Generated syntax/type errors
   on both revisions are invalid tests and are discarded; setup failures are
   inconclusive. A behavioral failure on both is pre-existing and nonblocking
   unless it demonstrates that the validated fix scope remains unmet, in
   which case record an incomplete-fix blocker. Passing tests add no finding.
5. Non-executable design suggestions are `advisory` and never block alone.
   Unresolved required intent/compatibility decisions are `uncertain` and
   explicitly route to triage. SP13 applies the same distinction everywhere.
6. Where the policy marks high-impact paths, property-based, fuzz, or mutation
   executions may be added as further bounded executions.

Controls: session B has no access to session A or to author prose; the model
holds no tools; total executions are bounded.

Failure handling: model failure in this stage ends the run `inconclusive`;
maintainers may rerun or override. Agreement between sessions is not treated
as proof.

Measures: counterexamples generated, executed, confirmed; regressions caught;
maintainer-confirmed false alarms.

### SP12. Regression analysis

| Field      | Value                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Addresses  | P05                                                                                                                              |
| Actors     | Execute job; assess job; optional existing project CI; the merge-queue relay and the default-branch run it starts                |
| Trigger    | PRs with code changes; `workflow_run` completion of the merge-queue relay                                                        |
| Topologies | T1, T3                                                                                                                           |
| Inputs     | Mandatory commands and platform matrix from the policy; baseline results for the base commit; head and merge commits; CI signals |
| Outputs    | Introduced-versus-pre-existing failure comparison; platform coverage status; integrated verification result                      |

Steps:

1. Baseline: use the bounded evidence snapshot fetched by `gate`, keyed by
   base commit, policy, platform, command/harness identity, and environment.
   If absent, run a baseline under the same supported environment. Missing
   non-Linux baseline/coverage is inconclusive, not inferred from Linux results.
2. Run policy-listed commands in containers as execution evidence. Optional
   project CI supplies signals for policy-permitted platform coverage after
   verifying source workflow/run/attempt, actual tested revision (head or
   merge), and environment. Signals retain their provenance. Changed control
   paths prevent reliance on PR-controlled signals. Required missing coverage
   is inconclusive; optional missing coverage is reported without blocking.
3. Compare failures, test identities/counts, skips, and durations against that
   baseline. Unexplained changes and execution-sensitive path edits require
   maintainer triage; use independent challenge tests for additional evidence.
   This applies equally to container evidence and CI signals: submitted code
   can manipulate reporters and exits in either. A failing test may be rerun
   once within budget to mark instability, not to erase unexplained failures.
4. Changes to shared state, public interfaces, dependencies and lockfiles, and
   build configuration require the full suite without impact-based reduction
   and are flagged in the report.
5. Model impact analysis in `intake` may add targeted checks before the
   initial execution. Later assessment additions use the same separate
   `execute-N`/`assess-N` pairs as SP11, within the shared round budget. It
   can never remove mandatory checks.
6. Integrated verification runs the mandatory suite on the merge commit at
   screening time. In the merge queue, the credential-free relay runs on the
   queue ref and its completion starts `steward-pr.yml` on the default branch,
   which takes SP06's group-only branch for `workflow_run.head_sha`. It
   resolves group membership from the queue ref and the group commit, because
   `workflow_run.pull_requests` is empty for relay runs, and never treats a
   relay completion as an echo: its sender is the enqueuer, which is the App
   bot when the App enqueued the entry (architecture §6.4;
   `probes/findings.md`, PA06.2). `gate` creates a
   check on the group commit and keys concurrency by it, `execute` runs the
   suite in containers, and `publish` completes the check after SP13's
   evidence and ownership gates. `publish` also verifies the group still
   exists with the same base/member heads and policy; a removed or rebuilt
   group supersedes the run. The group inherits enforcement by the strictest
   member mode (SP06); missing/ambiguous membership never relaxes it.
   Member PRs are not re-admitted; queue entry
   already required the App-bound check. A rebuilt group has a new commit and
   a new run. A group failure never overwrites individual PR outcomes.

Controls: Linux execution uses containers; other platform coverage may use
policy-permitted CI signals. Baselines match base, policy, platform,
command/harness, and environment; required missing coverage is inconclusive.

Failure handling: a baseline that cannot be produced ends `inconclusive`. A
missing or failed relay leaves the queue entry without its required check
until the queue times out; nothing can turn that into success.

Measures: introduced regressions caught; instability rate; admissibility rate
of CI signals.

### SP13. Decision, report, and admission

| Field      | Value                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| Addresses  | P01, P02, P07, P08, P09, P11, O01, O02                                                    |
| Actors     | `publish` job; decision, report, and ownership modules; GitHub App                        |
| Trigger    | End of any pipeline, including early exits                                                |
| Topologies | T1, T3 (T3 produces an attributed comment only)                                           |
| Inputs     | All findings and execution records for the run; ownership record; mode; prior report id   |
| Outputs    | Outcome; one report comment; check run; labels; review requests; evidence; metrics events |

Steps:

1. Decide using this single table, in precedence order after applying valid
   scoped waivers. Stages emit findings; they do not assign conflicting final
   outcomes. An authorized override is recorded as `overridden` with the
   selected effective outcome and explicit waived/remaining requirements. A
   scoped maintainer action may waive named requirements or override a
   substantive judgment, but cannot bypass authentication, snapshot freshness,
   ownership, durable evidence storage, or the shared-commit rule.

   | Condition                                                                                                                                                                             | Outcome                                                                                                                      |
   | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
   | Snapshot changed since `gate`, or a newer committed owner exists for the submission or group commit                                                                                   | `superseded`; archive, optionally cancel only its own pending check; never replace the current report/labels                 |
   | Shared PR head commit                                                                                                                                                                 | `needs-changes`; author must push a distinct commit or close sharing PRs; special blocking check mapping in architecture §10 |
   | Deterministic submission contract fails before spending                                                                                                                               | `needs-changes`; specific author corrections                                                                                 |
   | Capacity cap reached                                                                                                                                                                  | `queued` lifecycle state, no terminal outcome; keep any check `in_progress`, persist restart record                          |
   | Inference admission required                                                                                                                                                          | `awaiting-approval` lifecycle state, no terminal outcome; keep any check `in_progress`, persist approval item                |
   | Required steward work unavailable through infrastructure/model failure, malformed output, or exhausted budget                                                                         | `inconclusive`; retain any independently established findings                                                                |
   | Required maintainer decision unresolved: a PR's missing intent decision under `unrequested_change: triage`, execution-sensitive changes, ambiguous category                           | `uncertain`; triage                                                                                                          |
   | Required contributor evidence missing, or a validated actionable blocker such as duplicate/intended behavior, `proposal-required` under `propose-first`, or a demonstrated regression | `needs-changes`; specific author requests                                                                                    |
   | All required checks satisfied; only `advisory`/`speculative` findings remain, including a well-formed `proposal-pending` issue                                                        | `pass`                                                                                                                       |

   Missing optional checks do not become missing required evidence. Design
   suggestions without a violated requirement are advisory, not gate failures.
   A proposal issue awaiting a maintainer decision is not an unresolved
   screening question: it passes into the proposal backlog (SP08). A shared
   head commit is never certified: when a check is required or any category
   is enforced it is `action_required` (otherwise an optional check fails), an override cannot change that, and
   the remedy is a distinct commit or closing the other PRs (architecture
   §10).

2. Compose the report in a fixed order with length caps: outcome and bound
   identifiers; classification; blockers, each with scenario, location,
   evidence link, dismissal code, and the specific request; uncertainties for
   maintainers; executed commands and results with environment identity and
   exit status; the reference table; flagged automated activity (SP16); what
   would change the outcome; policy revision, steward version, provider,
   requested/reported model ids, adapter/runtime versions, and runner identity. The report contains no statement about the severity of the
   reported problem, no authorship statement, and no praise, and uses neutral
   wording. Finding severities are internal decision inputs and appear only
   as the report's blocker and uncertainty sections.
3. Persist the decision, records, report, and metrics through SP18. Obtain and
   verify the durable evidence commit before posting a report or completing
   any check.
4. Verify ownership and freshness after persistence: recompute the live
   snapshot and compare it with the ownership record; list the ownership
   artifacts for this submission or group commit and confirm none was created
   after this run's; confirm the check id in the ownership record is this
   run's own.
   A confirmed mismatch yields `superseded`: append a supersession event,
   retain the evidence, and leave the current report/labels unchanged. It may
   cancel only its own pending check. An unavailable/ambiguous ownership or
   snapshot read fails publication; do not mistake unknown freshness for a
   confirmed mismatch or publish neutral/success. Closed
   submissions are recorded but not admitted.
5. Apply the check exceptions first: superseded cleanup is cancelled, and
   queued/awaiting-approval stays pending. Shared heads use architecture
   §10's blocking mapping. Never complete these as neutral or skipped.
   Persist waiting items in evidence, Actions summaries, and authorized queue
   views in every mode; they are not quality outcomes. Then apply the mode
   before submission feedback. `observe` publishes no report,
   state labels, or reviewer requests. SP06 already completes any
   repository-wide gate for unenforced categories as neutral "not enforced";
   that conclusion does not depend on shadow completion or evidence storage
   and does not claim a pass. `advise` uses a neutral check only outside those exceptions.
   `enforce` maps the effective outcome to the conclusions in architecture §10.
6. For visible feedback, update the single report with durable evidence links,
   set labels, and write the job summary. Complete the run's own App check by
   its recorded id only after the evidence and ownership gates succeed; the
   check summary names the submission it certifies and, for a shared commit,
   the sharing PRs. An already neutral non-enforcement check may gain an evidence-backed
   summary only after freshness/ownership verification. Issues have no check, and a repository operating
   entirely in `observe` without a required check has none to complete. Record publication receipts and retry partial writes
   idempotently; the report comment is edited only by the newest run.
7. After successful publication, a passed PR may be marked ready and reviewers
   requested per policy; do not revert an author-selected ready state. Observe mode never promotes drafts or requests reviewers; its template
   points to the ordinary manual review process. A passed
   defect issue enters the ordinary backlog; a passed `proposal-pending` issue
   enters the proposal backlog and waits for `/steward accept` or a decline on
   close. `needs-changes` starts SP14 only in
   feedback-enabled modes; `uncertain`/`inconclusive` route to SP15. Notification
   failures are recorded and retried without changing the evidence-backed
   decision. Supersession links are retained in the run history/current report.

Controls: one report comment per submission; bounded edits; only the specific
command/follow-up replies permitted by SP14/SP15 are additional comments.
Truncated outputs link to evidence. CODEOWNERS review requests fire
when a non-draft PR opens, outside steward control, so the template recommends
drafts for feedback-enabled screening and explains manual promotion in observe mode.

Failure handling: a failed evidence write, a changed snapshot, or a newer run
cannot complete a check successfully. A downstream job failure is published as `inconclusive` when
`publish` survives (architecture §6.4), and `publish` also survives a workflow
cancellation: cancelled required work is published as `inconclusive`, while a
run cancelled by a committed replacement finds the newer ownership artifact,
records `superseded`, and cancels only its own pending check (architecture
§10). Only a failed `gate`/`publish`, or a cancellation that reaches `gate` or
`publish` itself, leaves a pending check. In that case the maintenance workflow marks checks older than the
stale timeout `action_required`, and a newer run's fresh check supersedes them
regardless. No success is emitted on missing evidence. GitHub's separate API
operations and asynchronous events do not provide instantaneous supersession
(architecture §10).

Measures: outcome distribution; time to first report; report length; reviewer
requests issued.

## 4. Human loop

### SP14. Contributor follow-through

| Field      | Value                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Addresses  | P06, P09, P01                                                                                                              |
| Actors     | Contributor; issues workflow on comments; session C                                                                        |
| Trigger    | Feedback-enabled `needs-changes`; author body edits, commits, or response-comment edits or deletions while awaiting-author |
| Topologies | T1                                                                                                                         |
| Inputs     | Numbered requests from the report; author responses; policy follow-up limit                                                |
| Outputs    | Reruns; state transitions; follow-up comments; abandonment events                                                          |

Steps:

1. A `needs-changes` report assigns submission-wide, monotonically increasing
   request numbers to evidence, explanation, or revision requests. The first
   durable request record is the anchor, never the mutable report's edit
   timestamp. Keep a bounded ledger of request id, requirement/scope hash,
   creation run/time, status, and associated response comment ids/hashes.
   Unchanged requests retain ids across reruns; new requests get new ids.
   Accepted explanations remain dependencies of the claim until explicit
   scope retirement, recorded in evidence; editing the report never drops
   consumed responses. Fetch current versions of those comments on rerun;
   edits/deletions change the snapshot even after the request was satisfied.
   Ledger/response limits cause an explicit correction/triage request, never
   silent truncation or id reuse. Each request states where its answer goes: fields, references,
   reproductions, and declared tests enter the submission body (an edit) or a
   commit; explanations enter as a conversation comment that cites the
   request number. The submission is labeled `awaiting-author`.
2. A new commit or body edit starts a new run (SP06). A comment without a
   commit is parsed deterministically for responses that cite request
   numbers; those responses join the snapshot as author responses (§0.1), so
   a rerun sees them, and editing or deleting a comment in that set is an
   input change that starts a new run. A request for a field, reference, reproduction, or
   declared test is satisfied only by a body edit or a commit; a comment that
   supplies one instead receives the cycle's single follow-up naming the body
   section to edit, and no rerun starts. A request for an explanation is
   assessed by session C, which judges whether the response addresses the
   specific choice with reference to the code, not whether it is correct. An
   addressed explanation triggers a rerun of the affected stages with the
   response as untrusted input; unaddressed ones keep the state with one
   concise follow-up per cycle, bounded by policy. Under `propose-first`, a `proposal-required` request is
   addressed by any acceptance path: the linked proposal issue reaches
   `accepted-proposal`, a maintainer runs `/steward accept` on the PR, or a
   maintainer waives the requirement.
3. An `awaiting-author` submission keeps that state until its author acts or
   the submission is closed; the dashboard's awaiting-author view shows its
   age (architecture §6.6). Closure by a maintainer or by the author records
   the resolution (SP03). A closed submission is not screened; reopening restarts
   screening. Abandonment is recorded as a metrics event. Maintainers may mark
   abandoned work as adoptable; the steward only reports it. Closing a PR that
   shared its head commit with other open PRs, or pushing away from that head,
   rescreens those PRs
   (architecture §6.4).

Controls: at most one steward reply per author action; only the author or
collaborators move the state.

Failure handling: model failure in the responsiveness assessment leaves the
request open and routes the item to triage.

Measures: retries; time in `awaiting-author`; abandonment; closures and
reopens.

### SP15. Maintainer triage, override, and appeal

| Field      | Value                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------- |
| Addresses  | O01, O02, P11, P10                                                                           |
| Actors     | Maintainers with write permission; contributors (own reruns and appeals); dashboard          |
| Trigger    | `uncertain`, `inconclusive`, or awaiting-approval; `/steward` commands; appeals              |
| Topologies | T1                                                                                           |
| Inputs     | Reports with uncertainties and the "what would change the outcome" section; commands         |
| Outputs    | Overrides, guidance records, waivers, resolutions, appeal outcomes; updated check and report |

Steps:

1. The triage queue is the `steward:triage` label plus the dashboard queue,
   which shows each item's uncertainties and what would change its outcome. A
   separate approval queue shows holds, age, and the maintainer admission
   command in every mode (private evidence/Actions summaries when Pages is
   disabled). Proposal backlog and audit queues remain separate views. A
   policy may name a project board as a view; the steward does not manage it.
2. Commands are recognized at the start of a newly created conversation
   comment on an issue or PR, not in review comments; edited command comments
   are not reprocessed, while edits to snapshot response comments are input
   changes (SP14). Maintainer commands require write, maintain, or admin
   permission, verified through the API. The submission's author may run
   `rerun` and `appeal` on their own submission. Acknowledgment is a reaction
   on the command comment; results appear in the edited report. `rerun` is
   executed inside the issues run itself: the issues workflow calls the
   screening reusable workflow as a job with the submission number and fresh
   inputs. `gate` re-snapshots and creates a fresh check when needed before
   committing the new ownership artifact. `override`, `waive`, `guidance`,
   and PR `accept` also start a new screening/publication run in this same
   issues workflow, reusing only evidence with matching dependencies. Issue
   `accept` reruns the issue; issue `resolve` records closure. Every changed
   issue input or published validation (including SP14 responses) starts
   dependent PR jobs after the issue publication, within caps. Commands
   themselves never directly complete an old check. Persist authenticated
   action records idempotently before screening; queue replay if startup
   fails, so a command is not lost. Commands:

   - `/steward rerun [stage]`; run by a maintainer, it also records inference admission for a held submission (SP19)
   - `/steward override pass REASON` and `/steward override needs-changes CODE REASON`, scoped to the current submission snapshot and named requirements; never able to publish `success` on a head commit shared with another open PR
   - `/steward guidance TEXT`, which records authenticated maintainer intent with actor and scope; its text remains untrusted session data, never system instructions, policy, or tool authorization, and may be proposed as a decision record
   - `/steward waive REQUIREMENT REASON` for one submission
   - `/steward accept REASON`: on a proposal issue, records acceptance bound to the issue's current content hash and sets the `claim:accepted-proposal` label as an output; on a PR, records acceptance bound to repository/PR, target, and canonical claim-scope text hash, satisfying `proposal-required` across implementation pushes with unchanged scope. A label applied by hand records nothing
   - `/steward resolve CODE`, recorded at or after closure for calibration; on a proposal issue it records the decline
   - `/steward audit RUN confirm` and `/steward audit RUN dispute REASON` for sampled runs (SP03)
   - `/steward time MINUTES [KIND]`, such as review, triage, appeal, audit, or override
   - `/steward appeal REASON`, author only

3. Appeals: the author comments `/steward appeal REASON`. The submission
   moves to triage with the appeal text; one open appeal at a time per
   submission. Maintainers respond with override, guidance, or rerun; the
   outcome is recorded. An appeal stays open until a maintainer acts; the
   dashboard shows its age, and nothing resolves it automatically.
4. Every override, guidance, waiver, acceptance, and resolution is stored with
   actor, reason, immutable scope, and time. Overrides/waivers bind to PR
   head/target plus requirements or issue snapshot. Issue acceptance binds to
   proposal content hash; PR intent acceptance binds to canonical claim-scope
   hash and target (architecture §9), not implementation head. Scope/target
   edits invalidate acceptance; ordinary code pushes require technical
   rescreening but retain unchanged intent acceptance. Each action appears in the
   report and in the dashboard history and feeds SP03.
5. The steward never argues in threads. It replies only to commands and to
   author responses in the follow-through flow. Maintainers can point to the
   report's evidence and codes instead of restating a judgment (P11).

Controls: permission checks; ignore verified App echoes, including follow-up,
usage, ready-for-review, and maintenance-issue events (architecture §6.4),
and unauthorized commands; deduplicate by comment id; rate limits on command
handling. Authors may appeal their own submissions.

Failure handling: an unparseable command from an authorized user receives a
single usage reply.

Measures: override frequency and reasons; triage queue age; appeal counts and
outcomes.

### SP16. Automated participation hygiene

| Field      | Value                                                               |
| ---------- | ------------------------------------------------------------------- |
| Addresses  | P08, P07                                                            |
| Actors     | Steward; maintainers                                                |
| Trigger    | Every run; comment and review events                                |
| Topologies | T1                                                                  |
| Inputs     | Thread comments and reviews; policy heuristics and allowlist        |
| Outputs    | A bounded "activity for maintainer attention" section in the report |

Steps:

1. The steward's own conduct: one report comment edited in place, a check run,
   reactions for acknowledgments, no approvals or reviews, no severity or
   praise, no replies to other bots, and no reaction to its own report echoes.
2. Flagging, passive: comments and reviews by bot-type accounts or GitHub Apps
   not on the policy allowlist; near-duplicate comments; reviews or approvals
   that reference nothing in the diff; exchanges between automated accounts.
   Heuristics are policy-configurable; a model assessment is optional and
   never changes the outcome. Flags are report annotations, not findings, and
   carry no severity.
3. The steward does not minimize or hide comments, lock threads, or set
   interaction limits.
4. The steward runs only the configured model on live submissions;
   experimental evaluation runs in T4 so that project participants are not
   reviewers of experimental output (P08).

Controls: flags never affect the outcome; the flagged list is capped.

Failure handling: none needed; flagging is best effort.

Measures: flagged activity counts; maintainer confirmation during audits.

## 5. Supporting processes

### SP17. Sandboxed execution

| Field      | Value                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Addresses  | Invariant 3 (whitepaper §12); reliable evidence for P04 and P05                                                                |
| Actors     | Execute jobs only in T1; local container runner in T3/T4; claim-only T2 runner                                                 |
| Trigger    | Any execution plan entry                                                                                                       |
| Topologies | T1, T3, T4; T2 uses the separate unsandboxed claim-only runner                                                                 |
| Inputs     | Plan entry (commit, command, working directory, expected result, declared result files, limits, network setting); runner image |
| Outputs    | Execution record marked `evidence` or `signal`                                                                                 |

Steps:

1. Fetch the commit by id into an inert host checkout in the execution job.
   Disable hooks, external filters, automatic submodule commands, and
   credential persistence; do not run repository commands during preparation.
   Validate overlay paths against traversal/symlink escapes before applying
   declared test-only patches or generated files to a copy. Any preparation
   needing repository-controlled code runs inside the container. Host
   materialization is permitted; host execution of submitted code is not.
   Compute the environment identity: image digest and tool versions.
2. Start the container with no host environment, no tokens, no container
   socket, a writable scratch area, a non-root user, CPU, memory, process, and
   time limits, and network disabled. A policy-declared dependency step may
   run first with egress; dependencies are preferably baked into the image
   built from the trusted branch.
3. Capture exit status, bounded output (head and tail with a truncation
   marker), declared result files with size caps, and timing. Redact with the
   policy's redaction patterns. Treat everything as data.
4. Destroy the container and the checkout copy.
5. Mark admissibility: `evidence` for container runs started by a trusted job;
   `signal` for results ingested from external CI.
6. Ingest external CI artifacts only after verifying their originating
   repository, workflow, attempt, actual tested commit, environment, and schema;
   never accept contributor-supplied identity fields as proof. Apply SP12's
   policy coverage and sensitive-path rules. Container observations remain
   subject to the same result-manipulation limitation: size/schema checks and
   isolation do not authenticate the test runner's assertions.

Controls: commands are constructed from the policy, except the contributor's
declared reproduction command, which runs only inside the container and is
recorded verbatim; per-execution and per-run caps.

Failure handling: image build or pull failure and runner unavailability are
environment failures ending `inconclusive`, distinct from a failing result.
The unsandboxed runner (T2) refuses anything other than the contributor's own
checkout and marks results as claims.

Measures: container minutes; environment failure rate.

### SP18. Evidence retention and publication

| Field      | Value                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Addresses  | O02, O03, P11 (auditability); invariants 7 and 8                                                      |
| Actors     | Publish job; maintenance workflow                                                                     |
| Trigger    | Every run; schedule                                                                                   |
| Topologies | T1 (T3 and T4 may upload)                                                                             |
| Inputs     | Run records, execution records, findings, report, overrides, metrics events; policy evidence settings |
| Outputs    | Evidence store commits; index; Pages data and site                                                    |

Steps:

1. Before SP13 publication, write the run directory with redaction and size caps and commit it to the
   evidence branch or repository through the App token, retrying bounded
   times on non-fast-forward pushes.
2. Store baselines under their full base/policy/platform/command/environment
   key (SP12), with origin and writer provenance. Local uploads remain
   attributed records; they cannot silently populate official baseline caches.
3. Rebuild the index on schedule rather than per run to avoid contention. The
   index maps issues to known linking PRs as a candidate cache. Propagation
   unions it with live timeline references and paginated current open-PR
   linkage reads, then verifies current bodies; it never assumes the index
   is complete. Maintenance retries failed lookups and unfinished pages and
   reconciles new PRs/missed events (SP19).
4. Publish: generate the public data files (architecture §6.6) from the store,
   combine them with the pinned web bundle, and deploy to GitHub Pages.
5. Retain: prune runs older than the policy retention period except those
   referenced by maintainer actions, appeals, audits, or evaluation datasets;
   keep metrics events. Whether pruning rewrites branch history is an open
   item.
6. Invalidate: append a supersession event pointing to the successor; preserve
   the original evidence record. The store holds no reservations, leases, or
   other mutable orchestration state; ownership lives in the ownership
   artifact and, when the repository gate is active, the check run. `gate` snapshots only the
   evidence needed by a run; private-store reads use a scoped App token, and
   only the policy-authorized target-visible subset may enter job artifacts or
   logs. Redaction is not permission to disclose non-public records; if
   required confidential context cannot be shared, route to maintainer triage.
7. Access: a public repository's evidence branch is public; the policy's
   non-public markers keep items such as full logs out of the Pages subset. A
   separate evidence repository, private or public, follows the same
   retention, redaction, and publication rules: the maintenance workflow
   reads it with the App token and publishes the same public subset to the
   target repository's Pages site only when authorized; private repositories
   default to no public export. Approval/queued states remain visible in
   private evidence and Actions summaries.

Controls: per-run size caps; where the plan and visibility of the store's
repository offer rulesets, a ruleset allowing pushes only by the App and
repository maintainers (SP02 step 4 reports it unavailable where GitHub
refuses rulesets); redaction patterns reviewed with the policy.

Failure handling: a failed evidence write fails the publish job visibly; the
report is not posted without its evidence.

Measures: store size; publication latency.

### SP19. Resource control and failure handling

| Field      | Value                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| Addresses  | P01, P10, O01 (identity-neutral caps); invariants 4 and 7                      |
| Actors     | `gate` job; budget and ownership modules; workflows                            |
| Trigger    | Every run                                                                      |
| Topologies | All                                                                            |
| Inputs     | Policy limits; consumption events                                              |
| Outputs    | Cap decisions, cancellations, queued runs, `inconclusive` outcomes with causes |

Steps:

1. `gate` evaluates aggregate caps from GitHub's run list: today's completed
   and in-progress steward runs for the repository, and in-progress runs
   attributed to the submission author (not the workflow actor). The counts
   are approximate: concurrent admissions can overshoot, and the policy
   describes the caps as cost controls. After deduplication and ownership
   commitment (SP06), an over-cap run stops with its fresh
   check pending and labeled `steward:queued` (feedback-enabled modes) and is
   restarted by the maintenance workflow in arrival order while caps allow,
   refreshing obsolete inputs first. The repository-wide daily caps are the
   only controls that bound floods from many accounts; the per-author cap
   bounds simultaneous work, not aggregate spend. The Actions run list serves only the caps.
2. The budget module enforces hard call/retry, timeout, resource, and byte
   limits, plus provider-specific inference bounds. Each stage checks
   consumption before starting; stage and outer timeouts bound execution.
   Existing project CI is outside these budgets; no steward execution precedes
   the contract gate and cap check. Inference budgets map onto the adapter's
   limits: HTTP token limits where supported and Copilot
   `sessionLimits.maxAiCredits`, a soft cap checked after calls return. All
   sessions, repairs, auxiliary assessments, and rounds debit one cumulative
   run/stage ledger; each new session gets only the remaining allowance.
   Record any credit overshoot, decline budget extensions, and stop further
   calls when exhausted. No exact Copilot token/credit or monetary ceiling is
   claimed; provider-side spending controls remain necessary (architecture §12).
3. Rescreening: own head/body/base/reopen and response-set changes start
   runs. Every changed linked-issue snapshot or published validation also
   propagates, including response-driven reruns, acceptance, resolution,
   waivers, overrides, and guidance. Dependent PR jobs wait for issue
   publication and use live linkage discovery plus the index cache (SP18).
   Policy changes always replace unpublished superseded work; only already
   published outcomes obey `policy_change: all|enforced|manual`. Sharing-set
   changes on synchronize/closure/reopen refresh peers on the old and new
   heads. Runs obey caps and persist waiting states. Only a committed new
   owner cancels older screening; unchanged echoes do not cancel useful work.
   Deduplication and ownership commitment stay outside the per-submission
   concurrency group; jobs join it only after `gate` has committed a
   replacement, because GitHub keeps one pending member per group and a newer
   member replaces it even with `cancel-in-progress: false`. A job-level
   cancellation marks the whole run `cancelled` (architecture §6.4;
   `probes/findings.md`, PA05.3).
   A manual rerun creates the fresh check before committing the artifact.
   Partial-stage reruns reuse only records whose complete dependency hashes
   match; they cannot omit other required stages.
4. Retries are bounded per call and classified: transient failures retry with
   backoff, permanent failures end `inconclusive`. Provider rate limits may
   apply per credential, account, organization, model, or a combination;
   per-submission concurrency groups do not coordinate shared provider
   capacity across repositories, and the design assumes no particular limit
   shape. A run that ends `inconclusive` for a transient cause is rerun once
   automatically within the daily cap before it goes to triage.
5. Structured-output repair is bounded; exhaustion ends `inconclusive`.
6. Output capture is bounded and redacted.
7. Baselines are cached in the evidence store; model results are reused only
   on an identical input hash, which includes the provider, requested model
   identifier, adapter version, generation settings, and policy revision.
8. The decision module enforces the never-pass rule for any missing required
   evidence.
9. Cost per run is recorded in evidence and shown on the dashboard, not in
   the report body.
10. Inference admission: under `llm.admission: maintainer-approved`, authors
    without prior merged work require a recorded maintainer admission for
    that submission. After the contract gate, commit an awaiting-approval
    state with any fresh check pending. Record it in evidence, Actions
    summaries, and the authorized approval queue with age in every mode.
    Feedback-enabled modes also publish the label/report; observe mode does
    not. `/steward rerun` by a maintainer records admission and resumes
    screening; labels never authorize inference. The admission persists for
    this submission until revoked or closed, not for other submissions by
    the author. Default `all` admits every contract-compliant submission.
    Inference admission never changes an outcome.
    Track wait time, abandoned holds, and acceptance after admission to
    measure the O01 tradeoff.
11. Model availability probe: on schedule, the maintenance workflow sends a
    bounded synthetic request with no submission content through the
    configured adapter and model, in a job that holds only the model
    credential. Persistent failure creates or updates one deduplicated
    maintenance issue from a separate job that holds only the App token;
    recovery closes it. The stored issue id and App marker exclude its
    open/edit/close echoes from submission screening. The probe supplements normal error handling and cannot
    guarantee that the next screening request succeeds.

Controls: daily and per-author concurrency caps apply uniformly. The optional
prior-contribution admission rule is identity/history-based and can delay or
deter newcomers (O01), even though it never judges quality. Its explicit
approval queue, maintainer path, and wait/abandonment metrics expose that
tradeoff. Observe mode still spends inference and follows the same controls.

Failure handling: every steward-side failure class (infrastructure, model
unavailable or retired, missing or unusable model credential, disabled Copilot
policy, capability mismatch, model refusal, malformed output after repair,
budget exhausted, environment unavailable) maps to `inconclusive` with a
cause recorded; credential and capability failures are detected in `intake`
before any execution. A disabled Copilot policy is detected only through the
failure of `intake`'s bounded synthetic request; through the SDK it reads like
an expired credential, so without the CLI's "Access denied by policy settings"
text it is recorded with an unusable credential as one `inconclusive` cause
(architecture §6.3). This organization billing path is unverified: no probe
has run in an organization with Copilot (`probes/findings.md`, PA08.7). A
wrapper whose permission grant is short of the pinned reusable workflow's job
permissions is not a failure class of a run: the whole run fails at startup,
before any job, so no outcome, check, report, or evidence exists; the
installation self-test (SP02 step 7) catches it. Missing
required evidence from the contributor (§0.1) is `needs-changes`. A defect in
the steward itself fails the affected job; a surviving `publish` records
`inconclusive`. `publish` also runs after a workflow cancellation: cancelled
required work is recorded `inconclusive`, and a run cancelled by a committed
replacement records `superseded` and cancels only its own pending check. A
failed `gate`/`publish`, or a cancellation that reaches `gate` or `publish`
itself, leaves a pending check until stale reconciliation marks it
`action_required`. If
`gate` cannot create a check that the active repository gate requires, the run
stops before ownership commitment and reports that the previous certification still stands;
nothing else runs until a later run succeeds in creating one. Owner ordering uses artifacts rather than check timestamps: the ownership artifact decides which run is newest, by
creation time, including for Actions re-runs that keep their run id. Creation
time is the artifact's `created_at`, never its id, which is not monotonic
across a re-run attempt; `created_at` has 1-second resolution, so equal values
make the listing ambiguous and cannot authorize publication; and a re-run
attempt's upload of the same name replaces the earlier attempt's artifact in
the listing (architecture §6.4; `probes/findings.md`, PA02.3).

Measures: budget utilization and soft-cap overshoot; cancellations; queued
and awaiting-approval ages, admission rates, and abandoned holds; `inconclusive`
counts by cause.

### SP20. Maintainer-initiated local screening

| Field      | Value                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Addresses  | P10, P11, O01                                                                                                                     |
| Actors     | Maintainer; CLI; local container                                                                                                  |
| Trigger    | `steward screen` against a PR or issue                                                                                            |
| Topologies | T3                                                                                                                                |
| Inputs     | Maintainer's GitHub token and inference credential; submission reference; trusted policy or an explicitly named local policy file |
| Outputs    | Local report and evidence; optional attributed report comment                                                                     |

Steps:

1. Authenticate with the maintainer's token; fetch the submission and commits.
2. Run SP06 through SP13 with the local container runner and the maintainer's
   own inference credential for the policy's adapter: the Copilot login for
   `github-token`, or the adapter's environment variable for `env`. The policy comes from the trusted branch unless a
   local file is named explicitly, which is useful for testing a proposed
   policy against existing submissions before merging it.
3. Write the report and evidence locally; `steward report` renders them. With
   an explicit publish flag, post a report comment attributed to the
   maintainer and the policy revision used, and optionally upload evidence. A
   local run never creates the required check run; a maintainer may follow
   with `/steward override` citing it.

Controls: same sandbox rules as T1; publication requires an explicit flag; a
run under a non-trusted policy is labeled as such and cannot be published as
the official report.

Failure handling: as in the pipeline processes.

Measures: local runs published.
