# Patch Steward Implementation Plan

**Status:** plan. Nothing described here is implemented, and this document
governs no behavior. [architecture.md](architecture.md) governs components and
boundaries, [processes.md](processes.md) governs steps and behavior, and the
[whitepaper](whitepaper.md) defers to both. Where this plan disagrees with
them, they govern; correct the plan. The plan cites their stable identifiers
(P01–P11, O01–O03, ADR-0001–ADR-0016, invariants 1–8, § references, SP01–SP20)
instead of restating behavior. Unqualified § references point to the
architecture.

The plan divides version 1 (§1.1) into milestones M01–M21. Each milestone
states a goal, the design scope it delivers, its inputs, the decisions to
settle before work starts, its outputs, and its exit criteria. Implementation
detail (libraries, module structure, schema fields, prompt text, numerical
values) belongs to each milestone's own planning, not to this document. The
project owner's decisions about the plan itself are recorded in section 9 as
PD01–PD08; architecture decisions are cited by ADR id (ADR-0001–ADR-0016 in `docs/adr`).

## 0. Conventions

### 0.1 Planning principles

1. **Version 1 only.** The scope is §1.1. No setting, state, label,
   permission, or interface is reserved for anything outside it.
2. **One core, four topologies** (§5). Each capability is built once in
   `core`, verified locally (T3, T4) against fixtures, and then wired into T1.
3. **Cheap and deterministic first**, mirroring the ordering in §12: contract,
   references, claim, execution, challenge. Every deterministic capability
   works without an inference account.
4. **Skeletons before stages** (PD01). M05 produces an end-to-end local run
   and M06 an end-to-end GitHub-hosted run. Later milestones add stages inside
   those skeletons without changing their contracts.
5. **Phase boundaries equal T1 job boundaries** (§6.4) from the first
   skeleton, in every topology: phases that use the model never execute code,
   phases that execute code never hold a model credential, and handoffs are
   typed, validated records.
6. **Invariants are executable.** Each invariant in §2 gains a conformance
   check in the milestone that first touches it (section 7.3 of this plan),
   and the check stays in the suite.
7. **Platform assumptions are verified before reliance** (M02). Where the
   platform differs, the architecture changes first, then the processes, then
   the summaries.
8. **Open decisions are asked, not assumed.** Items in §15 and the user
   manual's `[NEEDS INPUT]` callouts are settled with the project owner at the
   start of the milestone that first needs them and recorded in the governing
   document in the same change.
9. **Adoption follows evidence.** Where the steward may run is gated
   separately from what has been built (section 0.5 of this plan), following
   SP02 and SP03.
10. **Delivery is not success.** The README's success criterion is a measured
    reduction in maintainer workload without systematically excluding valid
    contributions. Completing the implementation does not establish it; M21
    measures it and accepts version 1 on a record that reports delivered
    capability and measured effectiveness separately.

### 0.2 Milestone format

| Field                     | Content                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Goal                      | The capability that exists when the milestone ends                                                  |
| Design scope              | Processes, architecture sections, decisions, and invariants delivered, wholly or in the stated part |
| Addresses                 | Problem-statement issues served, taken from the "Addresses" fields of the processes in scope        |
| Depends on                | Milestones whose outputs are required                                                               |
| Inputs                    | Prior outputs, design references, and external resources needed before work starts                  |
| Decisions to settle first | Open items the project owner decides before dependent work starts                                   |
| Outputs                   | Deliverables: capabilities, commands, workflows, templates, records, documents                      |
| Exit criteria             | Verifiable conditions for completion                                                                |

### 0.3 Definition of done for every milestone

- Build, type-check, tests, lint, and format checks pass on Ubuntu and
  Windows. Tests are type-checked by `pnpm typecheck`, because the build
  excludes them and the test runner does not type-check.
- Every new input that crosses into the core (policy, GitHub responses,
  artifacts, model output, result files) is validated at runtime (invariant 5)
  and handled as data: it reaches no shell, workflow expression, or
  authorization decision (invariant 1).
- Every new stage, adapter, and handoff has injected-failure tests showing
  that no failure class produces `pass` (invariant 4; SP19 step 8).
- Every new call, loop, capture, and stored record has a policy limit under a
  hard bound, and redaction runs before persistence (invariant 7).
- No decision input derives from authorship, AI assistance, account age, or
  presentation quality (processes §0.2; N01, N02).
- Every process step delivered records evidence and emits metrics events
  (processes §0.2).
- The shared fixture corpus grows with the milestone: sample submissions,
  sample target repositories in TypeScript and one compiled ecosystem first
  (PD04), hostile repository content, and injection text. Replay datasets
  (M11) reuse it.
- Settled decisions are recorded governing document first: architecture,
  processes, whitepaper §9–§14, README, `CLAUDE.md`, user manual. §15 shrinks
  accordingly; §14 traceability and the processes' "Addresses" fields stay
  consistent.
- Documentation describes as working only what was delivered. README status,
  the `CLAUDE.md` project state, and the user manual's "Proposed" markers and
  `[NEEDS INPUT]` callouts are updated for the delivered scope.
- The milestone merges into `develop`. Releases follow section 0.5 of this
  plan (PD06) and remain an owner action through the version bump on
  `master`.

### 0.4 Milestone map

| ID  | Milestone                                                  | Packages                          | Processes                    | Depends on           | Usable result                                                                        |
| --- | ---------------------------------------------------------- | --------------------------------- | ---------------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| M01 | Monorepo foundation                                        | All                               | —                            | —                    | Monorepo layout under the existing toolchain                                         |
| M02 | Platform assumption probes                                 | None (test-bed)                   | SP02                         | —                    | Verified or corrected platform assumptions                                           |
| M03 | Policy and data contracts                                  | `core`, `cli`, templates          | SP01                         | M01                  | `steward policy`                                                                     |
| M04 | Submission intake and contract check                       | `core`, `cli`, templates          | SP06, SP05                   | M03                  | Deterministic `steward preflight` contract check                                     |
| M05 | Decision, report, evidence records, local skeleton         | `core`, `cli`                     | SP13, SP18, SP19, SP20       | M04                  | `steward screen` at contract level; `steward report`                                 |
| M06 | GitHub-hosted skeleton: gate, ownership, evidence, publish | `core`, `action`, workflows       | SP06, SP13, SP18, SP19, SP03 | M02, M05             | Observe-mode contract evidence for every event on the test-bed                       |
| M07 | Sandboxed execution                                        | `core`, `cli`                     | SP17, SP05                   | M05                  | Container executions; preflight runs mandatory commands                              |
| M08 | Deterministic verification stages                          | `core`                            | SP09, SP10, SP12             | M07                  | Reproduction, before-and-after, and regression comparison by rules                   |
| M09 | Inference layer                                            | `core`, `cli`                     | SP19, SP05                   | M05                  | Bounded inference; preflight self-review (T2 complete)                               |
| M10 | Reference verification and claim validation                | `core`                            | SP07, SP08                   | M09                  | Issue screening end to end, locally                                                  |
| M11 | Evaluation replay                                          | `core`, `cli`                     | SP04                         | M08, M10             | `steward replay` (T4 complete)                                                       |
| M12 | Model-assisted verification and independent challenge      | `core`                            | SP09–SP12, SP16              | M08, M10, M11        | Full PR pipeline, locally (T3 screening complete)                                    |
| M13 | GitHub-hosted full pipeline in observe mode                | `core`, `action`, workflows       | SP06, SP17, SP19, SP02       | M06, M12             | Observe-mode screening of real repositories                                          |
| M14 | Repository gate and visible feedback                       | `core`, `action`, `cli`           | SP13, SP06, SP16, SP20       | M13                  | Check run, report comment, labels, review requests                                   |
| M15 | Maintainer commands, recorded actions, inference admission | `core`, `action`, workflows       | SP15, SP19, SP08, SP03       | M14                  | `/steward` commands, overrides, appeals, admission holds                             |
| M16 | Contributor follow-through and dependency propagation      | `core`, `action`, workflows       | SP14, SP19, SP18             | M15                  | Request and response loop; linked-issue and shared-head rescreens                    |
| M17 | Maintenance, calibration, and publication data             | `core`, `action`, workflows       | SP01, SP03, SP18, SP19       | M16                  | Scheduled upkeep, metrics, audits, Pages data                                        |
| M18 | Browser application                                        | `web`                             | SP05, SP15, SP03             | M17 (assistant: M04) | Submission assistant and maintainer dashboard                                        |
| M19 | Merge queue                                                | `core`, workflows                 | SP06, SP12                   | M14                  | Group-commit verification (T1 complete)                                              |
| M20 | Adoption, distribution, and release candidate              | `cli`, templates, all             | SP02                         | M01–M19              | `steward init`, installation self-test, published release candidate                  |
| M21 | Measured rollout and version 1 acceptance                  | None (participating repositories) | SP03, SP04, SP02             | M20                  | Per-category mode decisions from measurements; version 1.0 and its acceptance record |

### 0.5 Order, parallel work, and adoption gates

```text
M01      -> M03 -> M04 -> M05
M02, M05 -> M06
M05      -> M07 -> M08
M05      -> M09 -> M10
M08, M10 -> M11 -> M12
M06, M12 -> M13 -> M14 -> M15 -> M16 -> M17 -> M18
M14      -> M19
M01–M19  -> M20 -> M21
```

The recommended order is numerical. Work that may run in parallel: M02
beside M01–M05; M07–M08 beside M09–M10; the M18 submission assistant any time
after M04, against fixture data; M19 any time after M14. M21's observation
data accrues from the M13 gate onward, and its protocol can be drafted while
M17–M20 are built. M21's participants are the project owner's repositories
until others are recruited (PD08); recruitment proceeds in parallel from M13
and blocks no milestone.

Building a capability does not authorize running it everywhere:

| Gate                                       | Earliest | Conditions                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test-bed repositories only                 | M06      | Dedicated disposable repositories and a test App (PD02)                                                                                                                                                                                                                                      |
| Observe on real repositories               | M13      | Credential separation verified; evidence store protected (SP02 step 4). This repository first (PD05), then the owner's other repositories, which are M21's first participants (PD08)                                                                                                         |
| Advise on this repository                  | M16      | Functional dogfooding only; overrides and appeals (M15), follow-through (M16), and stale-check reconciliation (M14) exist; its data enters M21 only if the protocol admits it with its confounders stated. The owner's other repositories stay in `observe` until M21's protocol is recorded |
| Advise pilot on participating repositories | M21      | The evaluation protocol is recorded before any outcome is analyzed (SP03 step 5); the M20 release candidate is installed                                                                                                                                                                     |
| Enforce, per category                      | M21      | The category meets the thresholds recorded beforehand (SP03 step 7); SP02 step 8 prerequisites; M19 where a merge queue is on                                                                                                                                                                |

Topology completion: T2 at M09; T4 at M11; T3 at M12, with publication at M14;
T1 at M19; the browser app (Z6) at M18. Version 1 is accepted at M21, not at
the last delivered capability.

Releases (PD06): one 0.x release when each plan section completes, after M03,
M06, M08, M12, and M17. Section 6 produces the M20 release candidate and
M21's 1.0.0. Every release uses the existing CD path.

## 1. Foundations

### M01. Monorepo foundation

Goal: replace the single-package scaffold with the pnpm monorepo of §6.1 while
keeping the CI and CD contracts intact, so later milestones add product code
rather than infrastructure.

| Field        | Value                       |
| ------------ | --------------------------- |
| Design scope | §6.1; ADR-0011 and ADR-0012 |
| Addresses    | Prerequisite for all        |
| Depends on   | —                           |

Inputs:

- The scaffold: toolchain configuration, smoke test, `ci.yml`, `cd.yml`.
- The toolchain constraints and branch and CI rules in `CLAUDE.md`.

Decisions to settle first:

- One shared version or per-package versions, and which manifest the CD
  trigger reads.
- Supported Node.js versions for the CLI and for the action runtime.
- Test tiers (unit, fixture, container, live probe) and which tiers CI runs.
  CI makes no live GitHub or model calls.

Outputs:

- Workspace packages `core`, `cli`, `action`, `web`, and `templates/`, under
  one shared toolchain; the smoke test relocated; nothing else implemented.
- CI for every package on Ubuntu and Windows, aggregated coverage, unchanged
  CD semantics.
- Recorded test-tier conventions and the home of the shared fixture corpus.
- Updated README development section, `CLAUDE.md` commands and toolchain
  notes, and the user manual's scaffold pages.

Exit criteria:

- Install, build, test, lint, format check, and coverage pass from the root on
  both operating systems.
- A cross-package import (`cli` to `core`) type-checks and runs under the ESM
  settings.
- A version bump on `master` still tags exactly one release.
- Documentation claims no product behavior.

### M02. Platform assumption probes

Goal: confirm on disposable repositories the GitHub and Copilot behaviors that
the architecture depends on, before building on them, and correct the
governing documents where the platform differs.

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Design scope | §6.3, §6.4, §10, §12, §15; SP02 steps 7–8 |
| Addresses    | Prerequisite for M06, M09, M13, and M19   |
| Depends on   | — (parallel with M01–M05)                 |

Inputs:

- Administrator access to dedicated, disposable test-bed repositories (PD02):
  an organization-owned pair, public and private, and a personally owned
  public repository. The private repository is on the organization's Free
  plan, so behaviors that plan does not offer on private repositories are
  recorded undetermined. The organization has no Copilot seats, so M02
  verifies the personal billing path of §6.3 on the personally owned test-bed
  and assumes that inference on the organization-owned test-beds does not
  require Copilot billing to the organization (PD03). That assumption is a
  recorded risk (section 8). The organization billing path stays undetermined
  until the probes run in an organization with Copilot.
- A test GitHub App registration with the permissions in §6.4.
- A Copilot seat; optionally a key for an OpenAI-compatible endpoint.

Assumptions to verify:

1. Required checks (§10, §15): the latest check run per name from the
   expected App is the one evaluated; `neutral` satisfies the requirement; a
   fresh `in_progress` check on the same commit withdraws an earlier success;
   the effect of `action_required` and `cancelled`.
2. Ownership artifacts (§6.4, §15): per-submission naming, immutability,
   creation-time ordering across runs and re-run attempts, cross-run listing,
   the consistency window under concurrent runs, retention bounds.
3. Trusted triggers (§6.4): `pull_request_target`, `issues`, `issue_comment`,
   `workflow_run`, and `schedule` use default-branch definitions; Environment
   deployment-branch rules under each; the `workflow_dispatch` ref guard.
4. Job privilege separation (§6.4, §7): Environment secrets reach only the
   jobs that reference the Environment; the reusable-workflow permission
   ceiling, including `copilot-requests: write`; the `publish` condition after
   failed, skipped, and cancelled jobs.
5. Round expansion and concurrency (§15): fixed `execute-N`/`assess-N` pairs
   with unused rounds skipped; per-submission concurrency that never cancels
   unrelated jobs in a shared issues or maintenance run.
6. Merge-queue relay (§6.4): a credential-free `merge_group` run whose
   completion starts a default-branch `workflow_run` with a resolvable group
   commit; an App check on that commit gates the queue; removal and rebuild.
7. App-token writes (§6.4): which events they trigger and which identity
   fields let a run verify its own installation's echoes.
8. Copilot inference in Actions (§6.3): `GITHUB_TOKEN` authentication on the
   personal billing path (personally owned test-bed) and on the
   organization-owned test-beds without organization billing (PD03), the
   failure shape without a usable Copilot entitlement, usage and credit
   reporting, soft credit-cap behavior. The organization policy and its
   failure shape stay undetermined under PD03.
9. Run-list caps (§12): whether today's runs and in-progress runs can be
   attributed to the submission author, not the workflow actor, within
   bounded queries.

Outputs:

- Test-bed repositories, a test App, and probe workflows, kept as a
  regression suite against platform drift.
- A findings record: each assumption confirmed, refuted, or undetermined,
  with evidence.
- Governing-document changes for every deviation, architecture first, and
  closed or reworded §15 items.
- Measured platform limits that feed the numerical limits (§15).

Exit criteria:

- Every assumption has a recorded result.
- Each refuted or undetermined assumption has an owner-approved design change
  or an accepted, documented limitation before the dependent milestone
  starts: items 1–7 and 9 before M06; item 8 before M09.
- The organization billing path is an accepted limitation under PD03: it is
  documented as unverified wherever it is described, until the probes run in
  an organization with Copilot.
- PD03's assumption that the organization-owned test-beds need no
  organization billing has a recorded result under item 8; if refuted, it is
  handled as a refuted assumption above.

### M03. Policy and data contracts

Goal: make the quality contract real: a policy loaded from a trusted
revision, validated, and hashed, plus the runtime-validated data model that
every later milestone shares.

| Field        | Value                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Design scope | SP01 steps 1, 3 (revision identity), 4, 5; §8, §9, §10 vocabularies, §12 bounds; §6.5 `steward policy`; invariants 2, 5, 7 |
| Addresses    | P01, P09, O02                                                                                                              |
| Depends on   | M01                                                                                                                        |

Inputs:

- §8 content areas and the illustrative `llm` section; §9 entities; processes
  §0.1 vocabulary; SP01's example dismissal codes.
- The `[NEEDS INPUT]` list in the user manual's configuration page.

Decisions to settle first:

- The policy schema for every §8 area, including the `llm` section and
  provider options (§15).
- First versions of the submission, run, execution-record, finding, decision,
  report, maintainer-action, and metrics-event schemas, and the rule for
  evolving them (§15).
- Hard upper bounds and provisional default limits (§15), revisited with
  measurements in M11 and M17.
- Default label names, the default dismissal-code catalog with definitions,
  the `policy_change` default, and the free-form submission setting.

Outputs:

- Policy module: load from an explicit trusted revision, or from an explicitly
  named local file marked non-authoritative; validate; expose typed settings;
  compute the revision identifier; derive the public subset (§6.6).
- Shared schemas and vocabularies: outcomes, waiting states, classifications,
  finding severities, label families, dismissal codes, failure causes.
- `steward policy`: validate a policy and show the revision that would govern.
- The policy skeleton in `templates/`. The built-in dismissal-code catalog
  is a set of core constants that the skeleton shows as comments; a policy
  lists only project additions.
- Configuration documentation that describes the real schema.

Exit criteria:

- An invalid or missing policy yields a typed failure with a maintainer-facing
  message; no default is substituted (SP01 failure handling).
- Unknown keys, limits above hard bounds, and undeclared referenced paths or
  commands are rejected.
- The revision identifier is identical for identical policy-directory content
  on Windows and Linux, unchanged by commits outside the directory, and
  changed by any content change inside it.
- The skeleton validates, represents every §8 area, and holds credential
  references only.
- The public subset holds the `data/policy.json` content of §6.6 and nothing
  the policy marks non-public.

## 2. Skeletons

### M04. Submission intake and contract check

Goal: convert an issue or PR into a typed, hashed submission and decide the
deterministic contract result with no model call and no execution.

| Field        | Value                                                                                                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | SP06 steps 2–7, without the merge-group branch and stored-validation reuse; SP01 step 2; SP05 CLI steps 1–2 and failure handling; §6.2 Submission; §6.3 GitHub reads and Git; §6.7 issue forms and PR template; invariants 1 and 8 (snapshot definition) |
| Addresses    | P01, P03, P05, P07; through preflight P02, P04, P06, P09                                                                                                                                                                                                 |
| Depends on   | M03                                                                                                                                                                                                                                                      |

Inputs:

- M03 policy module and schemas.
- A GitHub user token for reads; a corpus of sample issue and PR bodies.

Decisions to settle first:

- The versioned mapping from rendered form labels and PR headings to the
  canonical submission field ids (SP06 step 3). M03 fixed the field ids,
  because policy required-field lists are validated against them; M04 adds
  ids only additively.
- Category-versus-diff consistency rules (SP06 step 4).
- Default trusted and execution-sensitive path lists (§8).
- Attachment destinations, limits, and formats (SP06 step 5).
- The canonical claim-scope text of a PR (§9), defined with the parser because
  M15 hashes it.
- CLI authentication conventions for GitHub (§6.5).

Outputs:

- Defect and proposal issue forms and the PR template in `templates/`, with
  their versioned mapping.
- Submission module: parsing, category determination, contract check,
  attachment rules, trusted and execution-sensitive path detection, the
  policy-change flag with the proposed file's validation results as data,
  snapshot capture and hashing, the set of open PRs sharing a head commit.
- GitHub read adapter and Git adapter with runtime-validated responses.
- `steward preflight`, deterministic part: the SP06 contract check on a local
  draft and branch, the default checklist when no policy is published, output
  marked unverified.

Exit criteria:

- The fixture corpus yields the documented results: ambiguous or duplicate
  fields request a correction; unstructured bodies are `needs-changes` with
  the template link unless free-form is allowed; a category mismatch is
  `uncertain`; ambiguity involving an enforced category requires triage; a
  policy-changing PR is flagged and not applied; an execution-sensitive change
  adds a required triage finding.
- The snapshot hash is stable under title-only edits and changes with each
  snapshot input of processes §0.1.
- Severity assertions are ignored, and no contract rule reads authorship or
  account history.
- Attachment handling enforces the SP06 step 5 rules; a required fetch failure
  is an `inconclusive` cause, a violation is `needs-changes`.
- The path makes zero model calls and zero executions.

### M05. Decision, report, evidence records, and the local skeleton

Goal: the first end-to-end run: submission, findings, one decision table, a
fixed-format report, and durable local evidence, arranged in the phases that
T1 will run as jobs.

| Field        | Value                                                                                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | SP13 steps 1–3 for local runs; SP19 step 8; SP18 step 1 (records, redaction, caps); SP20 steps 1–3 without publication; §6.2 Decision, Report, Evidence; §9; §10 mappings; §6.5 `steward screen`, `steward report`; invariants 4, 6, 7, 8 |
| Addresses    | P01, P02, P07, P08, P09, P10, P11, O01, O02                                                                                                                                                                                               |
| Depends on   | M04                                                                                                                                                                                                                                       |

Inputs:

- M04 typed submissions and contract findings.
- SP13's decision table and report order; §10's mode, check, and label
  mappings; §11's layout concept.

Decisions to settle first:

- Report section caps and wording rules (SP13 step 2).
- Evidence run-directory layout and record formats (§11, §15).
- Built-in redaction detectors beyond the set M03 delivered with the
  redaction module, and the record fields redaction covers at persistence.
- CLI conventions for every command: arguments, exit codes, output formats.

Outputs:

- Decision module: SP13's table in precedence order, waiting states as
  non-outcomes, the never-pass rule.
- Report module: fixed order, caps, neutral wording, the check-run summary
  text, truncation that links to evidence.
- Evidence module: typed records, redaction before persistence, size caps, run
  provenance, metrics events, a local store.
- §10 mappings as rules: mode to check conclusion, outcome to lifecycle label,
  blocking exceptions first. The API writes arrive in M14.
- The phase sequence `gate`, `intake`, `execute`, `assess`, rounds, `publish`
  runnable in one process, with typed handoff records that carry run, attempt,
  snapshot, round, and remaining budget.
- `steward screen` at contract level, under the trusted-branch policy or an
  explicitly named local policy; `steward report`.
- A never-pass conformance harness that injects failures at every phase
  boundary; every later milestone extends it.

Exit criteria:

- Table-driven tests cover every SP13 row and the precedence order; `advisory`
  and `speculative` findings never gate; missing optional checks never become
  missing required evidence.
- Injected failures never yield `pass`, and a failed evidence write yields no
  report.
- The §10 mapping tests cover every mode, the neutral "not enforced" case,
  pending waiting states, `cancelled` for superseded cleanup only, and the
  shared-head rule that no override lifts.
- Reports stay within caps, carry the bound identifiers and provenance of SP13
  step 2, and contain no severity, authorship, or praise statement.
- A run under a named local policy is labeled non-authoritative wherever it is
  rendered.

### M06. GitHub-hosted skeleton: gate, ownership, evidence store, publish

Goal: prove single-run orchestration on GitHub with the cheapest pipeline:
events to `gate` to `publish` in observe mode, with ownership, freshness,
caps, and durable evidence, before any stage depends on it.

| Field        | Value                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | §6.4 `gate`, `publish`, ownership and freshness rules without checks; the submission events of `steward-pr.yml` and `steward-issues.yml`; §6.3 Evidence store, evidence commits, Clock and ids; §11; §12 caps and concurrency; SP06 steps 1 and 8; SP13 steps 3–4; SP18 steps 1 and 6; SP19 steps 1 and 3 (own-input rescreens); SP03 step 2 closures; ADR-0005, ADR-0009, ADR-0013; invariants 2 and 8 |
| Addresses    | P01, P10, P11, O01, O02, O03                                                                                                                                                                                                                                                                                                                                                                            |
| Depends on   | M02, M05                                                                                                                                                                                                                                                                                                                                                                                                |

Inputs:

- M02 findings on artifacts, triggers, Environments, and the run list.
- A test-bed repository with the test App installed and a publication
  Environment restricted to the default branch.

Decisions to settle first:

- Ownership artifact schema, naming, and retention (§15), from M02's
  measurements.
- Evidence layout on the orphan branch and in a separate repository (§11).
- Computation of the approximate caps from the run list (§12, §15).
- The event identity used for deduplication (§6.4).
- How the action and reusable workflows are built, pinned, and consumed by
  wrappers during development (ADR-0011).

Outputs:

- The `action` package running core phases inside jobs; the reusable screening
  workflow with `gate` and `publish`; two wrappers pinned by commit SHA.
- Ownership module: authenticate, snapshot, deduplicate, decide the contract
  and cap disposition, commit the ownership artifact, determine the newest
  owner, record `superseded`.
- Evidence store adapter for the orphan branch and a separate repository:
  append-only, bounded non-fast-forward retries, scoped App tokens, bounded
  snapshot reads in `gate`.
- Queued waiting states committed and persisted for restart; job summaries;
  metrics events, including closure resolutions.

Exit criteria, as test-bed scenarios:

- A title-only edit or unchanged echo keeps the current owner; a body edit
  commits a new owner, and the older run ends `superseded` without
  publishing.
- Under concurrent events on one submission only the newest committed owner
  publishes; an ambiguous or unavailable ownership or snapshot read fails
  publication.
- A failure before commitment supersedes nothing; a failed `gate` or `publish`
  publishes no outcome.
- Evidence is written before any other publication step, and the store stays
  append-only under concurrent runs.
- Only `gate` and `publish` reference the publication Environment; the
  wrappers and the action are pinned by immutable SHA.
- Observe mode writes no comment, label, check, or review request.
- A PR that edits wrappers or the policy is screened under the default-branch
  definitions and the trusted policy.

## 3. Deterministic evidence

### M07. Sandboxed execution

Goal: run plan entries against explicit commits inside disposable,
credential-free containers, produce bounded and redacted execution records,
and provide the claim-only runner for T2.

| Field        | Value                                                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | SP17 steps 1–5; §4 Z1-to-Z2 rule; §6.2 Execution planner; §6.3 Runner (local container, unsandboxed); §12 execution bounds; §13 credential, escape, and log rows; SP05 CLI step 3; invariants 3 and 7 |
| Addresses    | P04, P05                                                                                                                                                                                              |
| Depends on   | M05                                                                                                                                                                                                   |

Inputs:

- M05 handoff records and evidence module; M03 Execution and Runner policy
  areas.
- A container runtime on development machines and on the Linux CI runner.

Decisions to settle first:

- Container image strategy and build caching (§15).
- Network policy for the dependency step (§15).
- Test-result parsing: declared formats versus exit-code-only evidence (§15),
  and the first formats supported, for the PD04 ecosystems.
- Whether a policy may declare allowed services for reproductions (SP09
  controls).
- Execution limits (§15); supported container runtimes and host platforms for
  T3.

Outputs:

- Execution planner: policy and submission to a bounded plan with expected
  results.
- Inert materialization of a commit and validated overlays (SP17 step 1).
- Local container runner and the unsandboxed claim-only runner.
- Execution records with environment identity, bounded output, declared
  result files, and admissibility (`evidence`, `signal`, or claim).
- Support for a runner image defined under `.github/patch-steward/runner/` on
  the trusted branch only.
- `steward preflight` runs the mandatory commands and the before-and-after
  preview on the contributor's machine, marked as claims.

Exit criteria, against a hostile fixture repository:

- Hooks, filters, and submodule commands do not run during materialization;
  traversal and symlink-escaping overlay paths are rejected.
- The container has no host environment, tokens, container socket, or mounts
  beyond the copied checkout and scratch space; it runs non-root with network
  disabled; every resource limit is enforced.
- Canary secrets in the host environment never appear in the container, the
  output, or the records.
- An image or runtime failure is an environment failure that leads to
  `inconclusive`, never "not reproduced".
- The unsandboxed runner refuses anything but the contributor's own checkout.

### M08. Deterministic verification stages

Goal: reproduce defects, verify fixes before and after, and compare
regressions against a baseline by rules alone, so that these stages work
without an inference account.

| Field        | Value                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | SP09 steps 1, 2, 3 (declared markers), 4, 5; SP10 steps 1–4; SP12 steps 1–4 and the merge-commit run of step 6; SP17 step 6 and the project-CI rule of §4; §11 baseline keys |
| Addresses    | P03, P04, P05                                                                                                                                                                |
| Depends on   | M07                                                                                                                                                                          |

Inputs:

- M07 planner, runners, and result parsing.
- Fixture target repositories with seeded defects, valid fixes, and gaming
  attempts.

Decisions to settle first:

- Platform coverage beyond Linux containers and the rule for trusted-path
  changes on those platforms (§15).
- Which compiled ecosystem, Rust or C++, joins TypeScript as the first pair
  for anti-gaming analysis and test-identity comparison (PD04), and the
  behavior for an unrecognized ecosystem.
- Classification of the base-commit failure where result files are absent
  (SP10 step 3).

Outputs:

- Reproduction stage with version and support-window resolution, scratch-only
  reproduction files, rule-based marker matching, and applicability findings.
- Fix-verification stage: declared regression test, the three controlled
  executions of whitepaper §5, failure classification, anti-gaming analysis.
- Regression stage: baseline production and reuse under the full key, failure
  and test-identity comparison, one instability rerun, full-suite triggers,
  platform coverage status.
- Ingestion of project CI results as signals after provenance verification.
- All three stages wired into `steward screen`.

Exit criteria:

- Fixtures in TypeScript and one compiled ecosystem (PD04) show: a valid fix
  passes before and after; a base failure for compile or missing-symbol
  reasons does not
  satisfy the requirement; removed, skipped, or focused tests and reduced
  assertions are found; an unexplained test-count or identity change requires
  triage.
- A baseline is never reused across base, policy, platform, command, or
  environment identities; a Linux baseline never explains another platform;
  required missing coverage is `inconclusive`.
- A failed reproduction in the claimed supported environment requests a
  correction; an unrelated setup failure is `inconclusive`;
  `not-applicable-version` appears only under the SP09 step 4 condition.
- A CI result with unverifiable provenance, or from a PR that changes trusted
  paths, is not relied on.

## 4. Inference and judgment

### M09. Inference layer

Goal: bounded, provider-independent, schema-validated request-and-response
inference under one cumulative budget, where every failure becomes a typed
failure that the decision rules turn into `inconclusive`.

| Field        | Value                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | §6.3 LLM adapter contract and both adapters; §6.2 Budget; §12 budgets, caching, rate limits; SP19 steps 2, 4, 5, 7; SP05 CLI step 4; ADR-0008, ADR-0014, ADR-0015; invariants 4, 5, 7 |
| Addresses    | P01, P06, P10, O01                                                                                                                                                                    |
| Depends on   | M05; M02 item 8                                                                                                                                                                       |

Inputs:

- M03 inference and limits policy areas; the M05 never-pass harness.
- A Copilot login and an OpenAI-compatible endpoint for live probes; recorded
  responses for CI.

Decisions to settle first:

- Default model per adapter, or none; generation settings; the
  required-capability vocabulary (§15).
- Repair strategy for malformed structured output (§15).
- Local credential conventions: reuse of the user's Copilot login for
  `github-token` (§15). M03 fixed the `env` variable name,
  `STEWARD_LLM_API_KEY`.
- Whether read-only Copilot built-in tools consult the permission handler
  (§15); until confirmed, the empty working directory stays the primary
  control.
- Confirmation that the Copilot system-prompt mode stays `customize` (§15),
  to be revisited with M11 measurements.

Outputs:

- The LLM adapter interface, capability descriptor, and one contract test
  suite that both adapters pass.
- The `copilot-sdk` adapter with every bound of the §6.3 adapter table; the
  `openai-compatible` adapter.
- Session framework: stage identity, response schemas, bounded repair, and
  structural isolation of the A, B, and C roles.
- Budget module: one cumulative run and stage ledger, soft-cap overshoot
  recording, classified and bounded retries.
- A result cache keyed by the full input hash of SP19 step 7; credential
  redaction.
- `steward preflight` self-review with disclosure and confirmation before
  anything leaves the machine.

Exit criteria:

- Each bound of the §6.3 Copilot row has a test: instruction files in a
  checkout never reach the model, and every tool request is denied and
  recorded.
- Each failure class of the §6.3 failure mapping yields a typed failure; the
  never-pass harness maps each to `inconclusive`.
- An exhausted allowance stops further calls, is never extended, and records
  overshoot; schema-invalid output is never consumed.
- No provider or model is ever substituted; an omitted or unknown provider, a
  missing credential, or a capability mismatch ends `inconclusive`.
- The credential never appears in model context, logs, or records.
- A cache hit requires the identical full input hash.
- Preflight self-review works with either adapter and the contributor's own
  credential, and its output is marked unverified.

### M10. Reference verification and claim validation

Goal: establish whether cited material exists at the claimed revision and
what the claim is, with evidence pointers that the core confirms.

| Field        | Value                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| Design scope | SP07; SP08; §6.2 Context retrieval and References; §7 Search API; ADR-0004 |
| Addresses    | P01, P02, P03, P04, P10, P11                                               |
| Depends on   | M09                                                                        |

Inputs:

- M04 submissions, M05 decision and evidence, M09 sessions and budgets.
- Fixtures with fabricated files, symbols, quotations, issues, and versions,
  and with injection text in submissions, files, and comments.

Decisions to settle first:

- Context selection strategy and its token budget (§15).
- Duplicate and prior-dismissal search method (§15).
- Session A's prompt and response schema, and the scope of the optional
  reference-extraction session (§15).
- Defaults for policy-listed security terms and the reference-host allowlist.

Outputs:

- References module: deterministic extraction and verification, the three
  statuses, applicability findings.
- Context retrieval: bounded, core-driven assembly of source, callers, tests,
  policy-listed documents, related items, and prior dismissals.
- Claim-validation stage: session A, pointer resolution rules, security-claim
  routing, prior-dismissal matching, the SP08 routing table, and both
  `unrequested_change` settings.
- Issue screening end to end in `steward screen`.

Exit criteria:

- Fabricated references are classified `fabricated`, and a fabricated
  authoritative basis blocks with `fabricated-reference`; a network failure
  yields `unverified`, never `fabricated`.
- External fetches stay within the SP07 controls.
- A classification whose pointers do not resolve degrades to `uncertain`;
  `duplicate` requires a resolving link; `intended-behavior` requires a
  document, test, or decision pointer.
- A repeated dismissed claim without new evidence is `duplicate`, citing the
  prior dismissal.
- A security-claimed issue follows the escalation rule, and no report states
  a severity.
- Every row of the SP08 routing table has a test.
- Injection fixtures change no rule outcome; the session has no tools,
  network, or write capability.
- Session context never contains the maintainer resolution of the item being
  screened (SP03 controls).

### M11. Evaluation replay

Goal: measure the pipeline on frozen, labeled history with the labels
withheld, so that prompt, threshold, and limit decisions from here on rest on
measurements.

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Design scope | SP04; T4 (§5); §6.5 `steward replay`; whitepaper §13 historical cases |
| Addresses    | O03                                                                   |
| Depends on   | M08, M10                                                              |

Inputs:

- The local pipeline through M10.
- Candidate datasets: accessible entries of the curl report collection,
  project-provided labeled issues and PRs that include genuine defects and
  valid fixes, and the fixture corpus.
- Owner authorization for any held-out or private cases.

Decisions to settle first:

- The dataset item and context-manifest format, and the label vocabulary.
- The seed datasets and their sources.
- Scoring definitions for "invalid admitted" and "valid blocked".

Outputs:

- `steward replay` over frozen, content-addressed manifests with evaluation
  cutoffs; labels and later resolutions kept outside retrieval and model
  context.
- A scoring report: confusion counts, per-stage attribution, cost, latency,
  inconclusive rate, and the difference from a previous steward version.
- A manifest leakage audit that runs before scoring.
- A seed dataset and a first baseline measurement of M10.
- Optional attributed upload of the report to the evidence store.

Exit criteria:

- A replay is reproducible: the same manifest, policy revision, steward
  version, and cached model results give the same scores.
- A leak test shows that labels, later resolutions, and post-cutoff context
  are absent from the retrieval index and model context.
- No live GitHub search or current page is read during replay.
- Unavailable items are reported, not skipped, and count as `inconclusive`.
- The run records the provenance listed in SP04 step 3.
- T4 writes nothing to live submissions.

### M12. Model-assisted verification and independent challenge

Goal: complete the PR pipeline's judgment stages: output interpretation,
design and completeness, impact analysis, the session B challenge with
executed counterexamples in bounded rounds, and passive hygiene flags.

| Field        | Value                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | SP09 step 3 (model assessment); SP10 step 5; SP11; SP12 step 5; SP16 steps 2–4; the plan, execute, and interpret separation of §6.4; §13 shared-blind-spot row |
| Addresses    | P01, P02, P03, P04, P05, P07, P08                                                                                                                              |
| Depends on   | M08, M10, M11                                                                                                                                                  |

Inputs:

- M08 stages and baselines, M09 sessions, M10 validated claims, M11 replay.
- Fixture PRs with seeded regressions and with valid behavior changes.

Decisions to settle first:

- Session B's prompt and the counterexample, plan, and interpretation schemas
  (§15).
- Policy limits on rounds and counterexamples; the workflow's fixed maximum
  is set in M13.
- Which high-impact additions of SP11 step 6, if any, version 1 supports.
- Default hygiene heuristics and allowlist (SP16).

Outputs:

- Challenge stage: context built without author prose, basis validation
  before any blocker, schema-validated plans, bounded rounds under the shared
  ledger, and the SP11 step 4 classification.
- Model assessment of reproduction output; design and completeness findings
  that block only on a violated explicit requirement; impact analysis that
  may add checks.
- Hygiene flags in a capped report section.
- The complete pipeline in `steward screen`.

Exit criteria:

- A context audit shows that session B receives no PR description, commit
  message, author comment, preflight summary, or session A or C history.
- A counterexample without a validated basis never blocks, and behavior that
  the accepted change replaces is not a regression oracle.
- Every case of SP11 step 4 has a test; seeded regressions are caught by
  executed counterexamples; invalid generated tests are discarded.
- Model phases start no container; plans reach execution only as validated
  records; execution phases hold no model credential.
- Impact analysis never removes a mandatory check.
- Flags never change an outcome.
- A model failure in a required stage is `inconclusive`, never a pass without
  a challenge.
- A replay compares this milestone with the M10 baseline in confusion counts,
  cost, and latency.

## 5. GitHub-hosted screening

### M13. GitHub-hosted full pipeline in observe mode

Goal: run the complete pipeline in Actions with job-level privilege
separation, in observe mode, on real traffic.

| Field        | Value                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | §6.4 job table (`intake`, `execute`, `assess`, round pairs) and handoffs; §4 boundary rules; §6.3 Actions container runner; SP06 steps 7 (validation reuse) and 9; SP12 step 1 in T1; SP17 in T1; SP19 steps 2 and 4–7; SP02 step 3, failure handling, and the first part of step 7; the `steward-maintenance.yml` skeleton: queued starts and guarded dispatch |
| Addresses    | P01, P03, P04, P05, P07, P10, O01, O03                                                                                                                                                                                                                                                                                                                          |
| Depends on   | M06, M12                                                                                                                                                                                                                                                                                                                                                        |

Inputs:

- M06 skeleton, M07–M12 stages, M02 findings on privilege separation, round
  expansion, and Copilot in Actions.
- A model Environment for the `env` adapter; Copilot enabled for the
  `github-token` path; a private test-bed repository.

Decisions to settle first:

- The fixed maximum of round pairs, the cumulative budget handoff, and
  job-level serialization (§15).
- Computation of the approximate daily inference aggregate (§15).
- Environment and secret names.
- The mechanism for the single automatic rerun after a transient
  `inconclusive` (SP19 step 4).

Outputs:

- The complete reusable workflow with per-job credentials and permissions as
  in the §6.4 job table; the Actions container runner.
- Artifact handoffs verified against source run, attempt, snapshot, round, and
  schema; the cumulative budget carried across jobs.
- Baselines cached in and read from the evidence store under the full key;
  reuse of a stored successful validation under SP06 step 7.
- `intake` credential and capability verification before any plan.
- The maintenance wrapper skeleton: queued starts in arrival order, the
  default-branch guard, and the first installation self-test (synthetic
  submission, synthetic inference request, capability descriptor, visible
  `inconclusive` without a usable credential).
- Observe-mode evidence and metrics from real submissions: this repository
  screens itself (PD05), and the owner's other repositories follow as M21's
  first participants (PD08).

Exit criteria:

- Credential audit: execution jobs hold a contents-read token only; model jobs
  hold no App key; no job holds both; canary secrets never reach containers,
  artifacts, logs, or evidence.
- A forged or mismatched artifact is rejected.
- A wrapper that drops `copilot-requests: write` produces a visible
  `inconclusive`; a failed downstream job is recorded as `inconclusive` by the
  surviving `publish`.
- In a private repository, confidential context without authorization is
  withheld, and required missing context routes to triage.
- A dispatch from a non-default ref is rejected before any credential is
  used.
- Over-cap runs restart through maintenance, oldest first, after refreshing
  their inputs.
- Observe mode still writes nothing visible on submissions.

### M14. Repository gate and visible feedback

Goal: publish outcomes where contributors and maintainers see them: the App
check run, one report comment, labels, and review requests, under the mode,
ownership, and freshness rules.

| Field        | Value                                                                                                                                                                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | §10; §6.4 check, echo, and stale-check rules; §7 Checks, Labels, Review requests, ready-for-review; SP13 steps 4–7; SP06 step 1 check creation and step 4 early neutral; SP16 step 1; SP19 check-creation failure; SP20 step 3; §13 stale-success, late-write, shared-head, and event-loop rows |
| Addresses    | P01, P02, P07, P08, P09, P10, P11, O01, O02                                                                                                                                                                                                                                                     |
| Depends on   | M13                                                                                                                                                                                                                                                                                             |

Inputs:

- M05 mapping rules, M06 ownership, M13 pipeline, M02 findings on required
  checks and App-write echoes.
- A test-bed ruleset that requires the steward check from the test App.

Decisions to settle first:

- The stable check name, default label names, and the stale-check timeout
  (§15).
- The bound on report edits (SP13 controls).
- The name of the publish flag of `steward screen`.

Outputs:

- Check lifecycle: a fresh `in_progress` check per run while the repository
  gate is active, the check id in the ownership artifact, completion of the
  run's own check only, early neutral "not enforced" completion.
- GitHub write adapter: report comment, labels, reactions, ready-for-review,
  review requests; publication receipts with idempotent retry.
- Echo filtering by installation identity and recorded resource ids.
- Stale-check reconciliation in the maintenance workflow.
- `steward screen` publication: an attributed comment and optional evidence
  upload behind an explicit flag; never the required check.
- The self-test extended with the check semantics of SP02 step 7.

Exit criteria, as a test-bed scenario matrix of mode, outcome, and exception:

- Every row of the §10 mode table and every blocking exception behaves as
  documented, including mixed-mode repositories.
- A same-commit rerun withdraws the earlier success; `publish` completes only
  its own check, after evidence, freshness, and ownership verification.
- A shared head is never `success` or `neutral`, and no override changes that.
- If a required check cannot be created, the run stops before commitment and
  reports that the previous certification stands.
- One report comment exists per submission, edited only by the newest run;
  labels are outputs only.
- The App's own writes start no screening; real dependency changes still do.
- Draft promotion and review requests occur only on `pass` in feedback-enabled
  modes; an author-selected ready state is never reverted.
- A local run under a non-trusted policy cannot be published as the official
  report.

### M15. Maintainer commands, recorded actions, and inference admission

Goal: give maintainers and authors the recorded, scoped controls of SP15, and
the optional inference-admission hold.

| Field        | Value                                                                                                                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | SP15; SP19 step 10 and the partial-rerun rule of step 3; SP13 step 1 waivers and `overridden`; SP08 step 6 acceptance paths; SP06 step 7 action-scope transfer; SP03 steps 2 (`resolve`), 4, and 6; §9 Maintainer action and claim-scope hashing; ADR-0016 |
| Addresses    | P01, P10, P11, O01, O02                                                                                                                                                                                                                                    |
| Depends on   | M14                                                                                                                                                                                                                                                        |

Inputs:

- M14 publication path; the M04 claim-scope definition; the `issue_comment`
  events of `steward-issues.yml`.

Decisions to settle first:

- Accepted values for `stage`, `REQUIREMENT`, `RUN`, and `KIND`.
- The procedure for revoking an inference admission.
- The definition of "prior merged work" (ADR-0016).
- Command rate limits (SP15 controls).

Outputs:

- Command recognition, permission verification, acknowledgment by reaction,
  and the single usage reply.
- Every SP15 command; action records with actor, reason, immutable scope, and
  time, persisted idempotently before screening and replayed if startup
  fails.
- Reruns and action-driven runs executed inside the issues run through the
  reusable workflow, each with a fresh owner.
- Appeals: one open per submission, routed to triage.
- The admission hold: the awaiting-approval state committed after the contract
  gate, maintainer admission through `rerun`, persistence per submission, and
  wait and abandonment metrics.

Exit criteria:

- A permission matrix of maintainer, author, other user, and bot behaves as
  SP15 states; edited command comments are not reprocessed; commands
  deduplicate by comment id.
- No override or waiver bypasses authentication, freshness, ownership, durable
  evidence, or the shared-head rule.
- A label applied by hand records nothing.
- PR acceptance survives an implementation push with unchanged claim scope and
  lapses on a scope or target edit; an edited accepted proposal returns to
  `proposal-pending`.
- Under `maintainer-approved`, no model call precedes a recorded admission,
  and a label never authorizes inference.
- Guidance text reaches sessions only as untrusted data.
- A partial rerun reuses only records whose dependency hashes match and omits
  no required stage.

### M16. Contributor follow-through and dependency propagation

Goal: close the loop with authors through stable numbered requests and
assessed responses, and rescreen every submission whose inputs change through
another item.

| Field        | Value                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Design scope | SP14; session C; SP19 step 3; §6.4 dependency-change and shared-head refresh rules; SP18 step 3 live linkage beside the index; §13 stale-success-after-linked-change row |
| Addresses    | P01, P06, P09                                                                                                                                                            |
| Depends on   | M15                                                                                                                                                                      |

Inputs:

- M14 reports, M15 acceptance paths and action records, M09 sessions.

Decisions to settle first:

- Bounded live PR-link reconciliation with continuation and retry (§15).
- Ledger and response limits; the default follow-up limit.
- Session C's prompt and response schema.

Outputs:

- The request ledger: submission-wide stable ids, durable anchors, response
  comment ids and hashes as snapshot inputs.
- Deterministic response parsing, the single follow-up per cycle, session C,
  and reruns of affected stages with responses as untrusted input.
- The `awaiting-author` state with ages and abandonment events.
- Propagation: linked-issue input and validation changes to dependent open
  PRs after the issue publishes; peer refresh on old and new shared heads;
  waiting states and caps honored.

Exit criteria:

- Request ids are stable across reruns and report edits; consumed responses
  stay snapshot dependencies; editing or deleting one starts a new run.
- A field or evidence supplied in a comment receives the one follow-up and no
  rerun; an explanation request is assessed by session C.
- A session C failure leaves the request open and routes the item to triage.
- A linked-issue edit, closure, reopening, acceptance, or resolution rescreens
  the dependent open PRs, including a PR absent from the index.
- Closing or pushing a PR that shared a head rescreens the peers of both
  heads.
- Ledger or response limits produce an explicit request, never truncation or
  id reuse.

### M17. Maintenance, calibration, and publication data

Goal: keep an installation healthy and measurable on a schedule: recover
missed work, sweep policy changes, sample audits, compute rollups, prune
evidence, probe the model, and publish the data contract.

| Field        | Value                                                                                                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | The remaining duties of `steward-maintenance.yml` (§6.4); SP01 steps 3 and 5; the machinery of SP03 (M21 executes steps 5–7 on participating repositories); SP18 steps 3–5 and 7; SP19 steps 9 and 11; §6.6 data contract; §11 publication; §12 probe |
| Addresses    | P01, P09, P10, P11, O01, O02, O03                                                                                                                                                                                                                     |
| Depends on   | M16                                                                                                                                                                                                                                                   |

Inputs:

- Evidence, ownership records, publication receipts, action records, and
  metrics events from M06–M16.
- Observe-mode data from the repositories admitted at the M13 gate.

Decisions to settle first:

- Retention mechanics and whether pruning rewrites history (§15).
- Audit sample sizes, rollup definitions, and schedule intervals (§15).
- The format of the evaluation-protocol record and of recorded mode changes
  with their justifying measurements (SP03 steps 5 and 7). M21 fixes a
  protocol's content and derives the thresholds (§15).
- The approval procedure for a public subset of a private repository.
- The persistence threshold of the availability probe.

Outputs:

- Sweeps: resolution reconciliation, link reconciliation, policy-change
  replacement and rescreening under `policy_change`, runs queued when a mode
  change first activates the repository gate.
- Index rebuild; rollups with coverage; audit sampling; categorized and
  repository-level time entries; retention pruning.
- Evaluation-protocol and mode-change records that M21 fills: cohort
  assignment, period, categories, thresholds, and the measurements that
  justify each change.
- The availability probe with separate probe and notification jobs and one
  deduplicated maintenance issue excluded from screening.
- Generation of `data/policy.json`, `index.json`, `runs/`, `queues.json`, and
  `metrics.json`, and Pages deployment with the pinned web bundle.

Exit criteria:

- An unpublished run superseded by a policy change is always replaced;
  published outcomes follow `policy_change`.
- Rollups pair each resolution with the decision for the exact screened
  snapshot, report coverage, and treat missing time as unknown.
- The probe job holds only the model credential and the notifier only the App
  token; the maintenance issue opens once, closes on recovery, and is never
  screened.
- Generated data validates against the data contract; a private repository
  publishes nothing without an approved subset.
- Pruning never removes records referenced by actions, appeals, audits, or
  datasets, and keeps metrics events.
- Evidence-store exports with resolutions load as M11 datasets.

## 6. Surfaces, release, and acceptance

### M18. Browser application

Goal: one static application with two faces: the contributor submission
assistant and the maintainer dashboard, with no secrets, inference, or
writes.

| Field        | Value                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Design scope | §6.6; zone Z6; ADR-0001 and ADR-0002; SP05 browser steps; SP15 step 1 views; SP03 step 4 audit queue |
| Addresses    | P02, P04, P06, P07, P09, P10, P11, O01                                                               |
| Depends on   | M17; the assistant needs only M03 and M04                                                            |

Inputs:

- The data contract and generated data of M17; fixture data before that.
- M04 form field identifiers and label mapping; the M03 public policy subset.

Decisions to settle first:

- Whether a central instance is offered beside per-repository Pages (§6.6).
- The supported browser baseline.

Outputs:

- Submission assistant: policy-driven guided intake, client-side checks, the
  severity-language note, mode-aware draft guidance, a prefilled issue-form
  URL or PR body text with a compare URL.
- Maintainer dashboard: triage, awaiting-author, awaiting-approval, queued,
  appeal, audit, and proposal-backlog views with ages and changed-input
  markers; per-run usage and cost; evidence; action history; metrics.
- A pinned, versioned bundle for the maintenance workflow to deploy.

Exit criteria:

- The bundle holds no token, performs no inference, sends no telemetry, and
  writes nothing to GitHub; every action is a deep link or copyable command
  text.
- Assistant output round-trips: the prefilled issue and the PR body parse
  under M04 and pass the contract check for their category.
- Unknown cost renders as unknown; a repository without a published policy
  gets the default checklist.
- The dashboard renders fixture data and M17's generated data alike.

### M19. Merge queue

Goal: verify the integrated group commit through a credential-free relay and
the group-only path.

| Field        | Value                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | `steward-relay.yml`; the `workflow_run` entry of `steward-pr.yml`; SP06 merge-group branch; SP12 step 6; the merge-queue paragraph of §6.4; §13 merge-queue row |
| Addresses    | P05                                                                                                                                                             |
| Depends on   | M14; M02 item 6                                                                                                                                                 |

Inputs:

- M14 check lifecycle, M08 regression stage, a test-bed repository with a
  merge queue and the required App check.

Decisions to settle first:

- The source of recorded member categories and admission records for a group.

Outputs:

- The relay wrapper with no credentials, checkout, or Environment.
- The group path: relay identity and membership validation, group snapshot,
  strictest-member mode, ownership keyed by group commit, mandatory suite and
  matching baseline, publication that verifies the group still exists.
- The self-test extended with the relay check of SP02 step 7.

Exit criteria:

- Missing or ambiguous membership or category data requires triage and never
  lowers enforcement.
- A rebuilt group gets a new run; a check on a removed group commit is inert.
- A relay failure or removal never creates a success.
- A group failure never overwrites a member PR's outcome, and member PRs are
  not re-admitted.

### M20. Adoption, distribution, and release candidate

Goal: a project can adopt Patch Steward from a published release candidate by
following the documentation, without help from its developers.

| Field        | Value                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | SP02; §6.5 `steward init`; §6.7; ADR-0011; §13 compromised-release row; every remaining §15 item except the enforcement thresholds, which M21 closes |
| Addresses    | O01, O03                                                                                                                                             |
| Depends on   | M01–M19                                                                                                                                              |

Inputs:

- Every template, wrapper, and workflow from earlier milestones; the
  self-test parts from M13, M14, and M19.
- Registry and publishing accounts; observe-mode experience from the M13 gate
  and advise-mode dogfooding from the M16 gate.

Decisions to settle first:

- The npm package name and scope; the release and pinning procedure for the
  action, the reusable workflows, and the web bundle.
- Capability probing at installation beyond a bounded synthetic request
  (§15).
- Which §15 items, if any, ship as documented limitations.

Outputs:

- `steward init`: templates, labels, CODEOWNERS entries, adapter selection,
  evidence-branch creation, a diff and confirmation before any overwrite, and
  the printed manual steps of SP02.
- The complete installation self-test.
- A published release candidate of the CLI, action, reusable workflows, and
  web bundle, pinned by immutable references, with the Copilot runtime pinned.
- A security review against every §13 threat, and the invariant conformance
  suite as a release gate.
- Documentation of delivered behavior: nothing delivered marked proposed,
  nothing undelivered described as working, no `[NEEDS INPUT]` callout left,
  and no effectiveness claim ahead of M21. The organization billing path and
  its `steward init` manual step are marked unverified while PD03's
  limitation holds.

Exit criteria:

- On a fresh repository, `steward init`, the printed manual steps, and the
  self-test lead to a first observe-mode run without reading the source;
  installation starts in `observe` (SP02 step 5).
- Every §13 threat has a test or a documented control; the conformance suite
  passes.
- §15 lists only accepted limitations and the enforcement-threshold item that
  M21 closes, and whitepaper §14, README, and `CLAUDE.md` agree with it.
- A release-candidate version is cut through the existing CD path.

### M21. Measured rollout and version 1 acceptance

Goal: establish with measurements whether the delivered system reduces net
maintainer work without systematically excluding valid contributions, decide
which categories, if any, justify `advise` or `enforce`, and accept version 1
on a record that separates delivered capability from measured effectiveness.

| Field        | Value                                                                                                                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design scope | SP03 steps 1–7 executed on participating repositories, on M17's machinery; SP04 step 4 release comparison; SP02 step 8 before any enforcement; whitepaper §2 "Demonstrate net benefit" and §13; the README success criterion; the §15 enforcement-threshold item |
| Addresses    | P01, P10, O01, O03                                                                                                                                                                                                                                               |
| Depends on   | M20                                                                                                                                                                                                                                                              |

Inputs:

- The M20 release candidate installed on the participating repositories:
  the project owner's repositories only, until others are recruited, because
  participants may be difficult to acquire (PD08). An external repository
  joins when its maintainers agree to record resolutions, audits, and time.
- Observe-mode evidence accumulated since the M13 gate; M17 rollups, audit
  samples, and time entries.
- The M11 replay datasets and baseline, extended by M17's evidence-store
  exports.
- A usual-review comparison: random assignment, or a matched contemporaneous
  control cohort where randomization is impractical (SP03 step 5).

Decisions to settle first:

- The evaluation protocol, fixed before any outcome is analyzed: period,
  participating repositories, categories, comparison cohort, sample size,
  labeling coverage, and the acceptable error and workload thresholds (SP03
  step 5).
- The bounds of the advise pilot: which repositories and categories receive
  visible feedback, and for how long.
- The reversal criteria that return a category to `advise` or `observe` (SP03
  step 7).
- Which of the owner's repositories participate, and how a repository
  recruited later is admitted: by a protocol amendment recorded before any of
  its outcomes is analyzed (PD08).

Outputs:

- The recorded protocol, committed before outcome analysis.
- Observation and bounded advise-pilot results per category and decisive
  stage: invalid submissions admitted, valid contributions blocked, retries
  and abandonment, approval-hold waits, appeals and overrides with reasons,
  the inconclusive rate by cause, cost, and latency (SP03 step 3).
- A net maintainer-time comparison of assisted and usual review at matched
  volume and category mix. It includes rejected and abandoned work, triage,
  appeals, overrides, audits, policy upkeep, operations, and amortized setup,
  and it states coverage, uncertainty, and confounders (SP03 step 6).
- Per-category decisions to remain in `observe`, use `advise`, or enable
  `enforce`, each recorded with the measurements that justify it, its reversal
  criteria, and the reason for any withheld rollout (SP03 step 7). The
  enforcement thresholds enter the governing documents and close the §15
  item.
- A replay comparison of the release against the M11 baseline and the release
  candidate (SP04 step 4).
- Final release verification: M20's security review, conformance suite, and
  self-test repeated on the release being accepted.
- A version 1 acceptance record that reports delivered capabilities and
  measured effectiveness separately, the final documentation, and version
  1.0.0. Version 1.0 requires verified delivered capabilities and that
  record, whatever the measurements show (PD07).
- A statement of the limits of owner-only participation while PD08 holds:
  sample size, a maintainer who is also the developer, and no basis for
  generalizing to other projects.

Exit criteria:

- Every earlier milestone meets its exit criteria on the release being
  accepted.
- The protocol's commit precedes the first analyzed outcome, and deviations
  from it are reported.
- Quality labels pair with the exact screened snapshot; a later accepted
  revision is not counted as proof that an earlier rejection was wrong;
  closures without a quality reason stay unlabeled; missing time is unknown,
  not zero; every rollup reports its coverage (SP03 steps 3 and 6).
- The comparison uses a randomized or matched contemporaneous control. Where
  only a before-and-after comparison exists, the record states its confounders
  and claims no causal reduction (SP03 step 5).
- Enforcement is enabled only for categories that meet the thresholds recorded
  beforehand, only with the SP02 step 8 prerequisites in place, and first for
  categories whose evidence is deterministic (SP03 step 7).
- If the evidence is insufficient or screening adds work, the acceptance
  record says so, and enforcement stays withheld or is reversed. Neither case
  blocks version 1.0 (PD07).
- With owner-only participation the record states that limit and claims
  nothing beyond the owner's repositories (PD08). Recruitment continues after
  1.0; later participants enter by protocol amendment, and their results
  update the mode decisions under SP03 step 7.
- README, whitepaper, and user manual state effectiveness only as measured.
- Version 1.0.0 is cut through the existing CD path.

## 7. Traceability

### 7.1 Processes to milestones

| Process | Milestones                                                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SP01    | M03 policy, revision, catalog, subset; M04 policy-change flag; M17 policy-change sweep and publication                                                                                         |
| SP02    | M02 assumptions; M13, M14, M19 self-test parts; M20 init and installation; M21 step 8 on participating repositories                                                                            |
| SP03    | M06 closure resolutions; M15 `resolve`, `audit`, `time`; M17 rollups, sampling, protocol and mode-change records; M21 protocol, measurement, and mode decisions                                |
| SP04    | M11; M21 release comparison                                                                                                                                                                    |
| SP05    | M04, M07, M09 CLI; M18 browser assistant                                                                                                                                                       |
| SP06    | M04 parsing and contract; M06 gate; M13 validation reuse and intake; M14 check creation; M19 group branch                                                                                      |
| SP07    | M10                                                                                                                                                                                            |
| SP08    | M10; M15 acceptance records                                                                                                                                                                    |
| SP09    | M08 rule-based; M12 model assessment                                                                                                                                                           |
| SP10    | M08 before-and-after and anti-gaming; M12 design and completeness                                                                                                                              |
| SP11    | M12; M13 round jobs                                                                                                                                                                            |
| SP12    | M08; M12 impact additions; M13 baselines and signals in T1; M19 group verification                                                                                                             |
| SP13    | M05 decision and report; M06 persistence, freshness, ownership; M14 checks, comment, labels, admission                                                                                         |
| SP14    | M16                                                                                                                                                                                            |
| SP15    | M15; M18 queue views                                                                                                                                                                           |
| SP16    | M12 flags; M14 own conduct and echoes                                                                                                                                                          |
| SP17    | M07; M08 signal ingestion; M13 Actions container runner                                                                                                                                        |
| SP18    | M05 records and redaction; M06 store; M13 baselines; M16 live linkage; M17 index, publication, retention                                                                                       |
| SP19    | M05 never-pass; M06 caps and waiting states; M09 budgets, retries, repair, cache; M13 cross-job budget and queued restarts; M15 admission; M16 propagation; M17 probe and policy-change reruns |
| SP20    | M05 skeleton; M12 complete pipeline; M14 publication                                                                                                                                           |

### 7.2 Open decisions (§15) to milestones

| §15 item                                                                  | Milestone                                    |
| ------------------------------------------------------------------------- | -------------------------------------------- |
| Policy, submission, execution-record, finding, report, metrics schemas    | M03; M05 records; M17 rollups and data files |
| Container image strategy; image build caching                             | M07                                          |
| Network policy for dependency installation                                | M07                                          |
| Default model per adapter; prompt and response schemas; repair strategy   | M09; M10, M12, M16 per session               |
| The `llm` policy schema; the approximate daily inference aggregate        | M03; M13                                     |
| Context selection strategy and token budget                               | M10                                          |
| Test result parsing                                                       | M07                                          |
| Duplicate and prior-dismissal search method                               | M10                                          |
| Live PR-link reconciliation, continuation, retry                          | M16                                          |
| Ownership artifact naming, retention, listing consistency window          | M02 measures; M06 decides                    |
| Fixed round expansion, budget handoff, job-level serialization            | M02 probes; M13 decides                      |
| Platform coverage beyond Linux containers                                 | M08                                          |
| Numerical limits                                                          | M03 provisional; M07, M09, M14, M17 by area  |
| Enforcement thresholds from observation                                   | M17 record format; M21 values                |
| Local credential conventions: Copilot login reuse                         | M09 (M03 fixed `STEWARD_LLM_API_KEY`)        |
| Capability probing at installation                                        | M02 probes; M20 decides                      |
| Read-only Copilot tools and the permission handler                        | M09                                          |
| Copilot system-prompt mode                                                | M09; revisited after M11 and M12             |
| Evidence-branch retention mechanics                                       | M17                                          |
| Latest-check, neutral-check, and rerun semantics; ownership record schema | M02; M06 schema; M14 self-test               |

### 7.3 Invariants to first conformance check

| Invariant                           | First check | Extended in                  |
| ----------------------------------- | ----------- | ---------------------------- |
| 1. Untrusted data                   | M04         | M07, M10, M12, M15, M16      |
| 2. Trusted-branch policy            | M03         | M06, M13                     |
| 3. Credential-free sandbox          | M07         | M13                          |
| 4. Never pass on failure            | M05         | Every later milestone        |
| 5. Runtime validation; rules decide | M03         | M04, M09, M13                |
| 6. Substance, not authorship        | M04         | M05 report wording; M10, M12 |
| 7. Bounds and redaction             | M03         | M05, M07, M09, M13           |
| 8. Snapshot binding and ownership   | M04         | M06, M14, M16, M19           |

## 8. Risks

| Risk                                                                                                                                                                                                                        | Response                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform behavior differs from the design (checks, artifacts, triggers, Copilot)                                                                                                                                            | M02 before reliance; governing-document change before dependent work; probe workflows kept for drift                                                                                                                                   |
| Provider or runtime churn; the first provider choice was retired before any code                                                                                                                                            | One adapter contract suite, a second adapter always passing it, pinned runtime, the M17 availability probe                                                                                                                             |
| T1 behavior cannot be verified in ordinary CI                                                                                                                                                                               | Test-bed scenario suites per milestone; the self-test grows from M13; M06 precedes the stages                                                                                                                                          |
| Phase boundaries that do not fit job boundaries                                                                                                                                                                             | Principle 5; the M05 and M06 skeletons precede every stage                                                                                                                                                                             |
| Breadth of language-independent result parsing and anti-gaming analysis                                                                                                                                                     | TypeScript and one compiled ecosystem first (PD04); unrecognized ecosystems degrade to triage, never to `pass`                                                                                                                         |
| Cost and nondeterminism of live-model tests                                                                                                                                                                                 | Recorded responses in CI; the result cache; live calls only in probes, replay, and test-bed runs                                                                                                                                       |
| Scarce evaluation data, especially labeled valid contributions                                                                                                                                                              | M11 seeds early from fixtures and accessible cases; M17 exports add resolved history                                                                                                                                                   |
| Too little traffic, labeling, or recorded time to reach M21's sample size, likely while only the owner's repositories participate (PD08)                                                                                    | Observation accrues from M13; recruitment continues through and after M21 and blocks nothing; the acceptance record reports insufficiency instead of stretching a claim; enforcement stays withheld; version 1.0 still proceeds (PD07) |
| The organization billing path for Copilot is unverified at release (PD03)                                                                                                                                                   | Documented as unverified; the design in §6.3 is unchanged; the M02 probes are repeated when an organization with Copilot is available                                                                                                  |
| Copilot inference on an organization-owned repository requires billing to the organization, contrary to PD03's assumption; the test-bed organization has no Copilot seats, and this repository (PD05) is organization-owned | M02 item 8 records the failure shape; inference probes and test-bed runs fall back to the personally owned test-bed; before M09 the owner enables organization Copilot, selects `openai-compatible`, or accepts the limitation         |
| Delivery mistaken for success                                                                                                                                                                                               | Principle 10; M20 ships a release candidate with no effectiveness claim; M21 alone accepts version 1                                                                                                                                   |
| Plan drift as decisions close                                                                                                                                                                                               | Definition of done records decisions governing document first; this plan is corrected in the same change                                                                                                                               |

## 9. Plan decisions

The project owner decided these plan-shaping questions on September 17, 2026.
The plan cites them as PD01–PD08. Reopening one means correcting every place
that cites it.

| ID   | Question                                                     | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PD01 | Timing of the GitHub-hosted skeleton                         | M06, before the stages: ownership, freshness, and job boundaries are validated while changing them is cheap. Not chosen: after M12, as one larger T1 integration.                                                                                                                                                                                                                                                                                  |
| PD02 | Test-bed                                                     | Dedicated disposable repositories and a test App. Not chosen: this repository.                                                                                                                                                                                                                                                                                                                                                                     |
| PD03 | Organization billing path for Copilot                        | Revised September 18, 2026, when this repository and its test-bed moved to an organization without Copilot seats. M02 verifies the personal path on a personally owned test-bed and assumes that the organization-owned test-beds need no Copilot billing to the organization; that assumption is a recorded risk (section 8). The organization billing path is documented as unverified until the probes can run in an organization with Copilot. |
| PD04 | First ecosystems for result parsing and anti-gaming fixtures | TypeScript and one compiled ecosystem, Rust or C++, chosen in M08: SP10 step 3 distinguishes compile failures from assertion failures, which a compiled ecosystem exercises. Not chosen: TypeScript and Python.                                                                                                                                                                                                                                    |
| PD05 | Self-screening of this repository                            | Yes, in observe mode from M13, as continuous real traffic for calibration.                                                                                                                                                                                                                                                                                                                                                                         |
| PD06 | Releases before 1.0                                          | One 0.x release per plan section (section 0.5 of this plan). Not chosen: one per milestone; none before 1.0.                                                                                                                                                                                                                                                                                                                                       |
| PD07 | What version 1.0 requires at M21                             | Verified delivered capabilities plus an acceptance record that reports measured effectiveness as found, even when it is insufficient or negative; enforcement stays withheld without evidence. Not chosen: waiting for a category to meet its thresholds; version 1.0 at M20.                                                                                                                                                                      |
| PD08 | Participants in the M21 measurement                          | Participants may be difficult to acquire, so the plan assumes the project owner's repositories only until others are recruited. The acceptance record states that limit; later participants enter by protocol amendment.                                                                                                                                                                                                                           |
