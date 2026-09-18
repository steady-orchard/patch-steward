# Patch Steward Architecture

**Status:** design document. Nothing described here is implemented. It records
the architecture selected on September 15, 2026, with the LLM provider
decisions revised on September 16, 2026 after the retirement of GitHub Models
on July 30, 2026, for the goals in the
[problem statement](problem-statement.md) and the methodology in the
[whitepaper](whitepaper.md). The processes that run on this architecture are
defined in [processes.md](processes.md). Implementation details (schemas,
command syntax, container images, numerical limits) are open and listed in
§15. Where the documents disagree, this document governs components and
boundaries, processes.md governs steps and behavior, and the whitepaper defers
to both.

## 1. Scope and decisions

### 1.1 Version 1 scope

| Area                   | In version 1                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submission types       | GitHub issues and pull requests in public or private repositories; security reports are not a submission type (SP08)                                                            |
| Review exchanges (P08) | Passive: the steward's own report hygiene and flagging of low-value automated activity in its report                                                                            |
| Hosting                | GitHub Actions in the target repository, GitHub Pages, contributor machines, maintainer machines; no webhook server                                                             |
| LLM provider           | Two shipped adapters behind one interface: Copilot SDK (GitHub token) and OpenAI-compatible HTTP (project-supplied key); the policy selects provider, model, and authentication |
| Sandbox                | Containers launched by trusted jobs on GitHub-hosted runners and on maintainer machines; project CI as a signal                                                                 |
| Local CLI              | Contributor preflight, maintainer-initiated screening, historical replay, repository initialization                                                                             |
| Browser code           | One static application: contributor submission assistant and maintainer dashboard                                                                                               |

### 1.2 Decisions recorded

The decisions selected with this architecture, and the reasons for them, are
recorded as architecture decision records in [`docs/adr`](adr/README.md):
ADR-0001 to ADR-0016 are this architecture's decisions, and later records
follow in the order they were decided. The records are record only: this
document, [processes.md](processes.md), and the [user manual](user-manual/README.md)
govern, and where a record disagrees with them, the governing document wins
and the record is marked superseded.

### 1.3 Non-goals

The architecture deliberately omits mechanisms for the non-issues in the
problem statement:

- No detection of AI authorship and no scoring of AI disclosure fields (N02).
  Disclosure fields may exist in templates for governance reasons; they are
  not inputs to any decision.
- No penalty for ease or speed of generation (N01). Submission volume is
  bounded by cost caps, not by judgments about how a submission was produced.
- No treatment of legitimate remediation cost as a quality signal (N03).
- No adjudication of a project's AI, licensing, or attribution policy (N04).
- No handling of contributor-development concerns (N05).

Screening evaluates evidence and project fit. A pass records that defined
requirements were satisfied; maintainers retain acceptance and merge authority.

## 2. Invariants

Every component and process preserves these rules, which restate the
whitepaper's boundaries (§3, §12) as architectural constraints:

1. PR content, repository files, comments, logs, execution output, and LLM
   output are untrusted data. They cannot alter the active policy, authorize
   tools, or change the operating mode.
2. The active policy is read only from the trusted branch. A submission may
   propose policy changes; the changes never govern the run that screens them.
   Every report records the policy revision used.
3. Submitted code and contributor-supplied reproductions execute only inside a
   disposable sandbox that holds no LLM credentials, no GitHub write tokens,
   no host credentials, and no sensitive host mounts.
4. Service failure, model refusal, malformed output, budget exhaustion, and
   missing evidence produce `inconclusive` or `needs-changes`, never `pass`.
5. Structured LLM responses are validated at runtime against a schema before
   use, and application rules, not the model, decide outcomes.
6. Screening assesses substance, not authorship. Passing checks does not
   establish project value or authorize merging.
7. Tokens, runtime, retries, container resources, and captured output are
   bounded by policy, and credentials are redacted before anything is stored.
8. Reports bind to a submission snapshot: repository, target branch, base and
   head commits (or issue content hash), body and linked-evidence hashes,
   persistent author-response ids and hashes, the open PRs sharing the head
   commit, and policy content hash (processes §0.1). Run provenance separately
   records the steward version, provider and model identities, adapter version,
   generation settings, and runner environment identity.
   A check certifies that snapshot, not later edits. Each run owns the check
   run it created; publication completes only that check, only after durable
   evidence, and only while the snapshot is current and no newer committed owner exists
   (§6.4, §10).

## 3. System overview

```text
Contributor preflight -- claims --> GitHub issue / PR
Maintainer local screen ----------> optional attributed report

PR events (pull_request_target) ----+
Issue events, /steward commands ----+--> one trusted run on the default branch
Merge-queue relay completion -------+    (steward-pr / steward-issues / maintenance)
Maintenance schedule ---------------+          |
                                               v
   gate -> intake -> execute -> assess -> [execute-N -> assess-N] -> publish
   App     model     containers  model     bounded challenge rounds  App
   snapshot,         no secrets  no code   execution/model jobs      evidence,
   check, ownership                        on separate runners      then check

Existing project CI supplies optional signals to assessment.

Evidence store (append-only) ---> public subset + static bundle ---> GitHub Pages
                                  contributor assistant | dashboard | run details | metrics
```

One TypeScript screening core runs in every topology. Adapters differ by
topology; the pipeline, decision rules, report format, and evidence model do
not.

## 4. Trust zones

| Zone | Name                        | Holds                                                                                                                   | Executes                                                          | Trusts                                                         |
| ---- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| Z0   | GitHub platform             | Repository, events, tokens, Actions runners, Copilot inference, Pages                                                   | Workflow definitions from the default branch for trusted triggers | Repository administrators                                      |
| Z1   | Trusted orchestration       | Least-privilege `GITHUB_TOKEN`; App tokens in `gate` and `publish`; model credential in `intake` and `assess` jobs only | Steward core; no submitted code in App or model jobs              | Trusted-branch policy, pinned steward version                  |
| Z2   | Sandbox                     | Nothing: no environment secrets, no tokens, no host mounts beyond a copied checkout and scratch space                   | Submitted code, reproductions, generated tests                    | Nothing; all output is data                                    |
| Z3   | Untrusted content           | Issue and PR text, diffs, files at the head commit, comments, logs, execution output, LLM output                        | —                                                                 | —                                                              |
| Z4   | Contributor machine         | Contributor's own credentials                                                                                           | Contributor's own code without a sandbox                          | Its owner; its results are claims, never evidence              |
| Z5   | Maintainer machine          | Maintainer's own credentials                                                                                            | Foreign code only inside a local container                        | Its owner; published results are attributed, not authoritative |
| Z6   | Browser app                 | Public published data only; no tokens                                                                                   | Client-side validation and rendering                              | Published data only                                            |
| Z7   | External inference provider | Prepared context and provider-side usage records                                                                        | Selected model behind the HTTP adapter                            | Project-approved endpoint and disclosure policy                |

Boundary rules:

- Z3 to Z1: content enters the core as typed data after parsing and schema
  validation. It never reaches a shell, a workflow expression, or a tool
  authorization decision.
- Z1 to Z2: the trusted job copies the checkout at an explicit commit into the
  container, passes a plan, and receives exit codes, bounded output, and
  declared result files. Nothing else crosses, and what comes back is bounded,
  redacted, and handled as Z3 data.
- Project CI to Z1: verify the originating repository, workflow identity,
  attempt, actual tested commit (head or merge), environment, and artifact
  schema. Signals supplement required executions only where policy permits
  that source and coverage; they retain their signal provenance. Changed
  workflow, policy, or runner paths invalidate reliance on PR-controlled CI.
- Execution integrity: neither container isolation nor unchanged trusted paths
  establishes that tests ran honestly. Submitted code can control the test
  runner, exit status, and result files in either topology. Changes to execution
  paths (package scripts, build/test configuration, reporters, test helpers,
  and policy-listed harness code) require maintainer triage. Compare test
  identities, counts, skips, and durations against a baseline in the same
  environment; unexplained discrepancies require triage. Independent challenge
  tests add evidence but do not prove the absence of manipulation. Isolation
  protects credentials and hosts; result integrity remains a stated limitation.
- Z1 to GitHub writes: only `gate` and `publish` hold scoped App tokens.
  Execution jobs hold only a contents-read token. Model jobs hold no App
  private key or repository-write token; Copilot inference permission can spend credits.
- Z1 to the LLM provider: only prepared context and a response schema leave
  the core; the model credential never enters model context, artifacts, or
  logs. `intake` and `assess` hold the model credential and no App key; `gate`
  and `publish` hold App tokens and no model credential; no job holds both.
  The Copilot adapter starts its runtime in an empty working directory outside
  any checkout with every tool denied (§6.3), so no repository file or
  instruction file reaches the model except through the core.
- Z6: no writes. Every action is a deep link to github.com or copyable command
  text.

## 5. Runtime topologies

| ID  | Topology                          | Trigger                                         | Sandbox                                                       | LLM credential                                                                                  | Publishes                                                           |
| --- | --------------------------------- | ----------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| T1  | GitHub-hosted screening (primary) | Actions events in the target repository         | Containers on GitHub-hosted Linux runners; project CI signals | Job `GITHUB_TOKEN` with `copilot-requests: write`, or a provider key from the model Environment | Check run, report comment, labels, evidence, Pages data             |
| T2  | Contributor preflight             | `steward preflight` on the contributor's branch | None; the contributor's own code                              | Optional; the contributor's own Copilot login or provider key, for any shipped adapter          | Nothing; output is text the contributor may include in a submission |
| T3  | Maintainer local screening        | `steward screen` against a PR or issue          | Local Docker or Podman container                              | Maintainer's own credential for the policy's adapter                                            | Optional attributed report comment; never the required check        |
| T4  | Evaluation replay                 | `steward replay` over a labeled dataset         | Local container                                               | Maintainer's own credential for the policy's adapter                                            | Local evaluation report; optional evidence-store upload             |

T1 is authoritative for admission. T2 output is a claim. T3 output is
attributed to the maintainer who produced it and may inform an override but
does not satisfy the required check. T4 never touches live submissions.

## 6. Components

### 6.1 Repository layout

```text
patch-steward/
├── .github/workflows/     own CI and CD, plus reusable steward workflows (workflow_call);
│                          GitHub requires reusable workflows to live in this directory
├── packages/
│   ├── core/              screening core, adapter interfaces, built-in adapters
│   ├── cli/               `steward` command-line interface, published to npm
│   ├── action/            GitHub JavaScript action that runs the core inside workflow jobs
│   └── web/               static browser app: contributor assistant and maintainer dashboard
├── templates/             files installed into a target repository by `steward init`
├── fixtures/              shared fixture-tier test corpus; not a workspace package
├── probes/                platform-assumption probes PA01–PA09 (sub-claims PA0N.M) run
│                          against disposable test-bed repositories; results in
│                          probes/findings.md; not a workspace package; never runs in CI
└── docs/
```

Packages share one TypeScript configuration and toolchain (pnpm, strict
TypeScript, ESLint, Prettier, Vitest) on Node 24 only: CI pins Node 24, the
CLI declares `engines.node >=24`, and the action targets the `node24` runtime.
All packages version in lockstep with the root `package.json`, which stays the
manifest the CD workflow reads for release tagging. Tests are tiered by
filename suffix: `*.test.ts` (unit), `*.fixture.test.ts` (fixture),
`*.container.test.ts` (container), `*.live.test.ts` (live probe). CI runs the
unit and fixture tiers on Ubuntu and Windows and the container tier on Ubuntu
only; the live-probe tier never runs in CI, and CI makes no live GitHub or
model calls. The root `fixtures/` directory is the shared fixture corpus home.
Adapters start inside `core`; they can move to separate packages when a second
implementation of an interface exists.

### 6.2 Screening core (`packages/core`)

Logical modules. They are boundaries inside one package, not services.

| Module             | Responsibility                                                                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy             | Load the policy from a trusted revision, validate it, expose typed settings, compute the policy revision identifier.                                                                                                              |
| Submission         | Parse issue-form bodies and PR-template sections into a typed submission; classify the change category; detect trusted-path and execution-sensitive changes; check the contract; compute the snapshot hash.                       |
| Context retrieval  | Assemble bounded context: diff, touched files and their neighbors, callers found by deterministic search, policy-listed documents, tests, related issues and PRs, prior dismissals.                                               |
| References         | Resolve cited files, symbols, APIs, URLs, issues, PRs, and quoted text at the claimed revision; classify each as verified, unverified, or fabricated.                                                                             |
| Stages             | Claim validation, reproduction, fix verification, independent challenge, regression analysis. Each stage consumes typed inputs and emits typed findings and evidence references. The challenge stage never receives author prose. |
| Execution planner  | Translate policy and submission into a bounded list of sandbox executions with expected results (for example, "must fail on base for the claimed reason").                                                                        |
| Decision           | Deterministic rules that combine stage results, findings, and evidence into one outcome. The model never decides.                                                                                                                 |
| Report             | Compose the single concise report and the check-run summary from typed findings; apply length caps; link evidence.                                                                                                                |
| Evidence           | Typed records for runs, executions, findings, decisions, maintainer actions, and metrics events; redaction before persistence.                                                                                                    |
| Budget             | Enforce call, retry, timeout, resource, and byte limits; track inference usage across all sessions and stages, honoring provider-specific hard limits or soft caps (§12); evaluate approximate aggregate caps.                    |
| Ownership          | Deduplicate before claiming work; create the check when required, then upload the immutable ownership artifact as commitment; detect shared heads; verify freshness and newest committed owner before publication.                |
| Adapter interfaces | LLM, GitHub, Git, Runner, Evidence store, Clock and identifiers.                                                                                                                                                                  |

### 6.3 Adapters

| Interface      | Version 1 implementations                                                                 | Notes                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM            | Copilot SDK adapter (`copilot-sdk`); OpenAI-compatible HTTP adapter (`openai-compatible`) | Request and response only: the core supplies prepared context, a response schema, and limits; the adapter handles authentication, request format, response parsing, usage reporting, and provider errors and returns one typed result. The core validates responses whether or not the provider enforces schemas natively. The model holds no tools in version 1. Contract below. |
| GitHub         | REST and GraphQL client                                                                   | Reads: submissions, diffs, files, check runs, workflow runs and attempts, merge-queue metadata, artifacts, collaborator permissions, search. Writes in `gate` and `publish` only: check runs, evidence commits, the report comment, reactions, labels, review requests, ready-for-review.                                                                                         |
| Git            | Local git                                                                                 | Fetch by commit id, produce isolated checkouts, compute diffs, identify merge commits.                                                                                                                                                                                                                                                                                            |
| Runner         | Actions container runner; local container runner; unsandboxed local runner                | The unsandboxed runner is selectable only in T2 and marks every result as a claim.                                                                                                                                                                                                                                                                                                |
| Evidence store | Orphan branch or separate repository                                                      | Append-only. `gate` reads bounded snapshots; `publish` appends official evidence. No mutable orchestration state. Local uploads are attributed and never satisfy official admission or baseline requirements without explicit maintainer action.                                                                                                                                  |
| Clock and ids  | System clock; the Actions run id and attempt plus the snapshot hash identify a run        | Idempotent reruns and stable evidence paths.                                                                                                                                                                                                                                                                                                                                      |

LLM adapter contract:

- Interface: one completion call per session turn. The request carries
  messages built by the core, a JSON response schema, generation settings, and
  limits (tokens, wall clock, retries). The result carries the schema-validated
  object or a typed failure, the requested and reported model identifiers,
  usage, and the adapter version. Rules in the core consume the result.
- Capability descriptor: each adapter declares `structuredOutput` (`native` or
  `prompted`), `systemPrompt` (`replace`, `customize`, or `append`), and
  `toolsDeniable`. Under `prompted`, the core embeds the schema in the prompt
  and validates and repairs within budget. The installation self-test records
  the descriptor (SP02).
- Selection: the policy names a shipped adapter id; policy files cannot load
  adapter code. An omitted or unknown provider, a missing credential, or a
  failed capability check ends the run `inconclusive`; the core never
  substitutes a provider or model.
- Failure mapping: authentication failure, unsupported capability, refusal,
  malformed output after bounded repair, rate limiting after bounded retries,
  and a retired model identifier all end `inconclusive`.

| Adapter             | Authentication (`llm.auth.type`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Bounds and notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `copilot-sdk`       | `github-token`. In T1, the job's `GITHUB_TOKEN` with `copilot-requests: write`; in T2–T4, the user's Copilot login or a token with the Copilot Requests permission. Organization-owned repositories bill the organization and require the Copilot policy "Allow use of Copilot CLI billed to the organization" (unverified; `probes/findings.md` PA08.7); personally owned repositories bill the repository owner's Copilot seat. Local login/PAT usage bills the authenticated user's seat. Where an organization has not enabled the policy (observed in an organization without Copilot seats), inference fails before any reply: the CLI reports "Access denied by policy settings", and the SDK runtime reports itself authenticated while the model call fails HTTP 403 with an `authorization` error that reads like an expired credential (`probes/findings.md`, PA08.2). `intake` detects this only through the failure of its bounded synthetic request and, without the CLI's text, records it and an unusable credential as one `inconclusive` cause. | The SDK spawns an agent runtime, so the adapter bounds it: runtime and session working directory set to an empty directory outside any checkout; `COPILOT_HOME` set to a fresh empty directory; `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` unset, so no `AGENTS.md`, `copilot-instructions.md`, or other instruction file is discovered; no MCP servers; every built-in tool excluded and a permission handler that denies every tool request; `systemMessage` in `customize` mode, keeping the runtime's safety sections; the bundled, lockfile-pinned CLI runtime with `COPILOT_AUTO_UPDATE=false` and `COPILOT_CLI_PATH` refused in Actions; the remaining stage/run credit allowance applied through `sessionLimits.maxAiCredits` as a soft cap (§12); `structuredOutput: prompted`. |
| `openai-compatible` | `env`: the fixed variable `STEWARD_LLM_API_KEY`, supplied to `intake` and `assess` from the model Environment in T1 and from the user's shell in T2–T4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Chat-completions request format against a policy-declared `base_url`, covering hosted and self-hosted endpoints; `structuredOutput` per endpoint capability, recorded by the self-test; `systemPrompt: replace`; the per-run budget applied as maximum tokens per call and per run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

The Copilot controls follow the [SDK reference](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md),
[CLI environment-variable reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-programmatic-reference),
and [Actions authentication and billing documentation](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/copilot-cli-in-github-actions).
Pin and record the observed runtime version as well as the SDK version.

### 6.4 GitHub Action and reusable workflows

One trusted workflow run per event. Thin wrappers call reusable workflows
pinned by immutable commit SHA, and privilege separation happens between jobs
inside that run: environment secrets reach only the jobs that reference the
environment, the App key through the publication Environment in `gate` and
`publish`, and an `env` provider key through the separate model Environment
in `intake` and `assess` jobs; no job references both. An Environment secret
reaches a job of a called reusable workflow only when the caller passes the
secret and the called job declares the Environment. The pinned reusable
workflow therefore declares each secret its jobs use (the App id and private
key, and the `env` provider key) under `on.workflow_call.secrets`, and every
wrapper call into it whose jobs use them, including the calls inside the
issues and maintenance runs, passes each secret by name in an explicit
`secrets:` mapping. `gate` and `publish` declare the publication Environment
and `intake` and `assess` jobs the model Environment; each receives the
target repository's Environment value, and a job that declares no
Environment receives nothing. The design does not use `secrets: inherit`:
across owners, between an organization and a user account in either
direction, it delivered the secret empty, silently, with no error
(`probes/findings.md`, PA04.1). The Copilot path uses
those model jobs' own `GITHUB_TOKEN` permission, without an Environment secret. Every job carries its own
least-privilege `GITHUB_TOKEN`. There is no dispatch to a second workflow and no persisted
orchestration state; GitHub's check runs, per-submission ownership artifacts,
and the run list carry everything a later job or run needs to know.
The Actions run list serves only the caps (§12).

| Job                    | Responsibility                                                                                                                                                                                                                    | Credentials                                                                                                                            | Executes submitted code |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `gate`                 | Authenticate and deduplicate; capture inputs; decide contract/caps/admission; preserve an active owner for duplicate inputs; create a fresh pending check when needed, then commit the ownership artifact; fetch bounded evidence | Default-branch publication Environment App key; scoped tokens                                                                          | No                      |
| `intake`               | SP06 snapshot/capability verification, SP07 references, SP08 claims, initial execution planning; model-based impact additions before execution                                                                                    | Provider key from model Environment, or job `GITHUB_TOKEN` with `copilot-requests: write`; read-only repository scopes; no App secrets | No                      |
| `execute`, `execute-N` | All SP09–SP12 executions via SP17, including generated challenges and assessment-requested additional tests                                                                                                                       | `GITHUB_TOKEN`: `contents: read`; no App secrets or model credential                                                                   | Yes, inside containers  |
| `assess`, `assess-N`   | SP09 output interpretation, SP10 analysis, SP11 challenge planning/result interpretation, SP12 comparison, SP14 responsiveness                                                                                                    | Provider key from model Environment, or job `GITHUB_TOKEN` with `copilot-requests: write`; repository read scopes; no App secrets      | No                      |
| `publish`              | SP18 durable evidence; SP13 decision, freshness and ownership verification, check completion, report, labels, review requests                                                                                                     | Default-branch environment App key; scoped installation token                                                                          | No                      |

`gate` uses `checks: write` for the pending check and read scopes for
metadata, evidence snapshots, and the run list. `publish` needs checks,
issues, pull requests, and evidence contents write permissions. Tokens are
scoped to the selected target and evidence repositories and are never passed
between jobs. The App's registration grants these permissions plus metadata
read; individual tokens reduce them to the job's needs. `gate` reads a
separate private evidence repository with a scoped App token and supplies
bounded, redacted, revision-bound snapshots to later jobs through artifacts.
Only data authorized for the target repository's visibility may enter its
artifacts or logs; if required confidential context cannot be handed off
under that rule, the run routes to maintainer triage. The repository-local
`GITHUB_TOKEN` is not used for cross-repository access. Every artifact is
checked against its source run, attempt, snapshot, and schema before use.
Reusable workflows cannot exceed the caller's permissions, so the wrapper
templates grant `copilot-requests: write` to `intake` and `assess`. A wrapper
that grants less than the pinned reusable workflow's jobs request fails the
whole run at startup: GitHub schedules no job, so no check, report, or
evidence exists, and only the Actions run list shows the failure
(`probes/findings.md`, PA04.2). `steward init` therefore writes wrapper
permissions equal to the pinned reusable workflow's job permissions, the
installation self-test fails visibly when a wrapper's grant is short (SP02
step 7), and wrapper edits stay on the CODEOWNERS-reviewed path where the
repository's plan and visibility offer rulesets; where GitHub refuses them,
as on a Free-plan organization's private repository, required code-owner
review of wrapper paths is unavailable (§7 "Rulesets"; SP02 step 8). `publish`
depends on all pipeline jobs and uses `if: ${{ always() && needs.gate.result == 'success' && needs.gate.outputs.committed == 'true' }}`.
It runs after failed or skipped downstream jobs, records incomplete required
work as `inconclusive`, and applies §10's check mapping. Contract and waiting
exits retain their own disposition; duplicates without a commitment do not publish.
`publish` also runs after a workflow cancellation (`probes/findings.md`,
PA04.4): a run cancelled by a committed replacement finds the newer ownership
artifact and abandons as `superseded`, completing only its own still-pending
check `cancelled` (§10); a run cancelled without a replacement records the
cancelled required work as `inconclusive`. Only a cancellation that reaches
`gate` or `publish` itself leaves the check pending for reconciliation.

Assessment emits a bounded, schema-validated plan artifact; `execute-N` runs
it on a fresh runner with no model credential, then `assess-N` reads the
results on another runner. The pinned reusable workflow declares a fixed
maximum number of round pairs and skips unused rounds; policy can lower that
maximum. Additional SP12 checks use the same pairs. No model job launches a
container or executes submitted code. Every handoff carries run, attempt,
snapshot, round, and remaining cumulative budget; all rounds stay in one run.

| Wrapper                   | Events                                                                                                                               | Purpose                                                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `steward-pr.yml`          | `pull_request_target` (`opened`, `synchronize`, `edited`, `reopened`, `ready_for_review`, `closed`); relay `workflow_run` completion | PR screening and closure recording; group verification; refresh the other PRs sharing either the old or new head on membership changes, including synchronize                                                                                             |
| `steward-relay.yml`       | `merge_group` (`checks_requested`)                                                                                                   | Credential-free relay; no checkout, no environment, no submitted-code execution; its completion starts `steward-pr.yml` on the default branch                                                                                                             |
| `steward-issues.yml`      | `issues` (`opened`, `edited`, `reopened`, `closed`, `deleted`); `issue_comment` (`created`, `edited`, `deleted`)                     | Issue intake; issue and PR replies and commands; command reruns in this run; propagate every change to linked issue inputs or final validation, including response-driven reruns; response-set edits/deletions rescreen; unrelated edited comments do not |
| `steward-maintenance.yml` | `schedule`; `workflow_dispatch` on the default branch only                                                                           | Queued starts (calling the screening reusable workflow), stale-check reconciliation, resolution sweep, audits, metrics, retention, Pages, self-test, model availability probe, policy-change rescreens                                                    |

Ownership and freshness without steward state:

- `gate` authenticates and deduplicates before creating a check, uploading an
  ownership artifact, or cancelling earlier work. A title-only edit or other
  unchanged-input echo keeps the current owner. A redundant queued or
  awaiting-approval attempt cannot replace an active owner of the same
  snapshot; a changed snapshot may commit a waiting state because the older
  work can no longer certify it. Explicit reruns intentionally replace work.
- After those decisions, `gate` creates a fresh `in_progress` check for a PR
  or group commit when the repository gate is active (any category in
  `advise` or `enforce`, or a ruleset requires the check). Only after check
  creation succeeds does it upload an immutable ownership artifact named
  for the submission (`steward-ownership-pr-<number>`, `-issue-<number>`, or
  `-group-<commit>`). Upload is the commitment point. It records the check id
  or null, run id and attempt, snapshot/policy hashes, admission disposition,
  and creation time. Later jobs verify it. Failure before commitment cannot
  supersede an earlier owner; a check created before a failed upload stays
  blocking and is reconciled. A committed wait is persisted for restart, not
  silently dropped.
- Only committed artifacts count as ownership: ignored events, command-only
  runs, and the relay do not. The newest artifact by creation time wins,
  including a new attempt of an old run. Creation time is the artifact's
  `created_at`, never its id: ids are not monotonic across a re-run attempt,
  and a re-run attempt's upload of the same name replaces the earlier
  attempt's artifact in the listing (`probes/findings.md`, PA02.3).
  `created_at` has 1-second resolution, so equal values make the listing
  ambiguous. An ambiguous or incomplete listing cannot authorize publication. In all-observe repositories without a
  required check, ownership uses the artifact alone. A fresh same-commit
  check supersedes earlier check conclusions according to the installation-
  verified GitHub semantics (§15).
- `publish` writes evidence first, then recomputes the live snapshot (head,
  base ref, body hash, linked-issue and attachment hashes, author responses
  to numbered requests, the set of open PRs sharing the head commit, policy
  content hash), lists the ownership artifacts for this submission, and
  abandons publication as `superseded` if the snapshot changed or a later
  artifact exists. It completes only the check id it owns and edits the
  report only when it is the newest run.
- Shared head commits: checks attach to commits, so PRs that share a head
  commit share every check on it whatever their bodies, targets, or linked
  evidence. `gate` lists the open PRs associated with the head commit; when
  another open PR shares it, the run ends `needs-changes` with a shared-commit
  blocker, and when the check is required or any category is enforced the check on that commit is
  completed only as `action_required`, never `success` and never the
  gate-satisfying `neutral`. Overrides cannot lift this. The report names the
  sharing PRs and the remedy: push a distinct commit (an empty commit
  suffices) to the PR that should be certified, or close the others; closing
  or pushing a new head on a sharing PR rescreens the rest.
- Dependency changes: head, body, base, reopen, and author-response changes
  start new runs. Every change to a linked issue's input snapshot or final
  validation propagates to dependent PRs, including SP14 response-driven
  reruns and recorded maintainer actions. Same-run dependent jobs wait for
  the issue's publication and read its new validation. The evidence index is
  a candidate cache, never a complete lookup: union it with live timeline
  cross-references and live open-PR linkage reads (including PRs absent from
  the index), then verify current bodies. Paginate within bounds and queue
  continuation work; lookup failures remain pending for maintenance retry.
  Maintenance reconciles links against current open PRs to recover missed events.
  Synchronize/closure refresh PRs associated with both the previous recorded
  head and the current head, so no-longer-shared commits are rechecked.
- Policy changes: a run superseded before publishing its current snapshot is
  always queued for replacement under the new policy, even under `manual`
  or for an unenforced category. `policy_change: all|enforced|manual` controls
  only optional rescreening of already published outcomes. Maintenance uses
  committed ownership and publication receipts to distinguish them. Failed
  or missing receipts are reconciled, never assumed published. Reruns obey
  caps; until publication the dashboard marks changed inputs. Attachments
  are hash-bound and refetched within limits; changed bytes invalidate the
  snapshot even if a URL stays unchanged.
- Per-submission concurrency serializes the committed work and publication of
  a submission. Deduplication and ownership commitment happen in `gate`,
  outside the group: a job joins the per-submission group only after `gate`
  has decided that the event is a committed replacement, because GitHub keeps
  one pending member per group and a newer member replaces it even with
  `cancel-in-progress: false` (`probes/findings.md`, PA05.3). Only a newly
  committed replacement may cancel earlier submission work; ignored events and
  unchanged-input echoes never join that group or a workflow-level
  cancel-in-progress group that could kill useful work. A job-level
  cancellation marks the whole run `cancelled`. Cancellation controls cost;
  ownership and freshness control publication.
- Failed `gate`/`publish` jobs, or a cancellation that reaches `gate` or
  `publish` itself, leave pending checks `in_progress`; the maintenance
  workflow marks checks older than the policy's stale timeout
  `action_required`. A newer run's `gate` supersedes them anyway.
- Base-branch movement is not revoked by the steward. Enforcement requires
  strict up-to-date branches or a merge queue, so merge safety comes from
  GitHub; the report states the base commit it tested.

Merge queue: the relay runs on the queue ref with no credentials and no
checkout, and its completion triggers `steward-pr.yml` on the default branch.
That run validates the relay identity and current group membership, snapshots
the group SHA/base/member heads and policy, and follows the group-only SP06/SP12
path: mandatory suite and baseline comparison, with no issue/PR form parsing
or claim/challenge sessions. It resolves group membership from the queue ref
and the group commit, not from `workflow_run.pull_requests`, which is empty
for relay runs, and it never applies echo filtering to a relay completion:
the `workflow_run` sender is the enqueuer, which is the App bot when the App
enqueued the entry (`probes/findings.md`, PA06.2). It keys ownership by
group commit and completes
an App check on it. Any enforced member makes the group enforced; otherwise
it is advise if any member is advise, else observe. Missing or ambiguous
member/category data cannot downgrade enforcement and requires triage.
Member PRs are not re-admitted: entering the queue already required the
App-bound check. A rebuilt group has a new commit and a new run; an orphaned
check on a removed group commit is inert. Relay failure or removal cannot
create success: the queue times out without the required check.

`workflow_dispatch` uses the requested ref, so the maintenance wrapper rejects
any ref other than the default branch before using credentials or starting
work. GitHub.com's current
[`pull_request_target` semantics](https://github.blog/changelog/2025-11-07-actions-pull_request_target-and-environment-branch-protections-changes/)
use default-branch workflow code, `GITHUB_REF`, and environment evaluation
regardless of the PR's base branch, effective December 8, 2025; the
[event reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target)
confirms it, and `workflow_run`, `issues`, `issue_comment`, and `schedule`
also run on the default branch. Other platforms require equivalent verified
semantics before installation. Reusable workflows and actions remain pinned.

Ignore verified echoes of this installation's report, follow-up,
usage/acknowledgment comments, labels, reactions, and ready-for-review writes.
Maintenance issues carry an App-authored marker and stored issue id and are
excluded from submission screening on open/edit/close; matching user text
alone does not qualify. Keep input-change propagation when a steward
action actually changes a dependency. Deduplicate by event identity and
snapshot. Edited command comments are not reprocessed; corrected commands
are new comments. Snapshot response edits/deletions start new runs. Existing
project CI may run independently and provide signals; its spending is outside
steward budgets and is never a prerequisite for intake. Steward-triggered
executions start only after the contract gate and the cap check.

### 6.5 Command-line interface (`packages/cli`)

| Command             | Topology | Purpose                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `steward init`      | Setup    | Install the policy skeleton, issue forms, PR template, wrapper workflows, labels, and CODEOWNERS entries; select the LLM adapter, model, and authentication method; print the manual steps (App installation, Environments and secrets, Copilot organization policy (unverified; `probes/findings.md` PA08.7), provider spending limits, rulesets, Pages). |
| `steward preflight` | T2       | Check a local branch or draft submission against the target policy, run mandatory commands on the contributor's machine, optionally run the self-review session with the contributor's own adapter and credential after disclosing what leaves the machine, and print a preflight report marked unverified.                                                |
| `steward screen`    | T3       | Run the full pipeline against a PR or issue with a local container sandbox, under the trusted-branch policy or an explicitly named local policy file; optionally post an attributed report comment.                                                                                                                                                        |
| `steward replay`    | T4       | Run the pipeline over a labeled historical dataset with labels withheld; produce confusion counts, cost, and latency.                                                                                                                                                                                                                                      |
| `steward policy`    | Any      | Validate a policy file; show the revision that would govern a run.                                                                                                                                                                                                                                                                                         |
| `steward report`    | Any      | Render a stored run or evidence record locally.                                                                                                                                                                                                                                                                                                            |

The CLI authenticates to GitHub with the user's own token (`gh auth` or a
fine-grained personal access token). For inference it resolves the policy's
`llm.auth.type`: `github-token` uses the user's Copilot login or a token with
the Copilot Requests permission, billed to that user's seat; `env` reads the
adapter's fixed environment variable from the user's shell. `steward
preflight` may instead use any shipped adapter the contributor selects
(ADR-0015). The CLI never holds the App private key.

### 6.6 Browser application (`packages/web`)

A static bundle with no server, no secrets, and no inference. Two faces share
one data contract.

| Face                 | Audience     | Function                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submission assistant | Contributors | Guided intake driven by the published policy: expected behavior and its authoritative basis, actual behavior, affected version, minimal reproduction with its command and expected observable result, scope, references. Client-side checks for required fields and reference format. Produces a prefilled issue-form URL, or PR-body text together with a compare URL. |
| Maintainer dashboard | Maintainers  | Triage, awaiting-author, awaiting-approval, queued, appeal, audit, and proposal-backlog views; changed-input markers; per-run usage/cost (unknown where unavailable), evidence, action history, and calibration metrics. Actions deep-link to GitHub with copyable commands.                                                                                            |

Data contract published to Pages by the maintenance workflow:

| File                  | Content                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/policy.json`    | Public policy subset: categories, evidence requirements, `unrequested_change`, modes/draft guidance, attachment caps, dismissal codes, supported versions, inference-admission rule         |
| `data/index.json`     | Recent runs: submission, outcome or waiting state, revision identifiers, timestamps, changed-input marker                                                                                   |
| `data/runs/<id>.json` | Report, evidence references, provider-reported usage and per-run cost (unknown if unavailable)                                                                                              |
| `data/queues.json`    | Triage, awaiting-author, awaiting-approval, appeal, queued, audit, and proposal-backlog items with ages and changed-input markers, including observe-mode holds in the authorized dashboard |
| `data/metrics.json`   | Rollups defined in §12 and whitepaper §13                                                                                                                                                   |

Deployment: the target repository's maintenance workflow fetches the pinned
web bundle, generates `data/` from the evidence store, and deploys both to the
repository's GitHub Pages site. A central instance that reads a public evidence
branch directly is a possible alternative and requires no per-repository Pages
setup; it is not the default. Private evidence stores are not readable by the
browser app in version 1.

No inference: the assistant is a form and checklist with deterministic
validation, and the page holds no tokens. LLM-assisted self-review runs in the
CLI (SP05), which avoids provider-specific browser authentication and CORS
requirements.

### 6.7 Files installed in a target repository

| Path                                          | Purpose                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/patch-steward/policy.yml`            | The quality contract (§8).                                                                                                                             |
| `.github/patch-steward/runner/`               | Optional runner image definition built from the trusted branch only.                                                                                   |
| `.github/ISSUE_TEMPLATE/steward-defect.yml`   | Defect form with unique rendered labels mapped to canonical fields; stable ids for URL prefilling only.                                                |
| `.github/ISSUE_TEMPLATE/steward-proposal.yml` | Issue form for feature and change proposals.                                                                                                           |
| `.github/pull_request_template.md`            | Headed sections matching the submission contract; explains drafts for feedback-enabled screening and ordinary manual readiness/review in observe mode. |
| `.github/workflows/steward-*.yml`             | The four wrapper workflows (§6.4).                                                                                                                     |
| `CODEOWNERS` entries                          | Maintainer ownership of the policy directory and wrapper workflows.                                                                                    |
| Labels                                        | Status and classification labels (§10), created through the API during `init`.                                                                         |

## 7. GitHub features used

| Feature                                            | Use                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Processes                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Actions `pull_request_target`                      | Default-branch PR screening in one run, body-edit and reopen handling, closure recording; never executes submitted code outside a container; inert host fetch/checkout is allowed under SP17                                                                                                                                                                                                                                                                                   | SP06, SP13, SP19            |
| Actions `pull_request`                             | Optional existing project CI; signals and spending outside steward control                                                                                                                                                                                                                                                                                                                                                                                                     | SP12                        |
| Actions `workflow_run`                             | Start the default-branch screening run after the credential-free merge-queue relay completes                                                                                                                                                                                                                                                                                                                                                                                   | SP06, SP12                  |
| Actions `issues`, `issue_comment`                  | Issue validation, resolution recording, author replies, commands; propagation of linked-issue changes and recorded maintainer actions to dependent PRs; response-comment edits and deletions as input changes                                                                                                                                                                                                                                                                  | SP03, SP06–SP09, SP13–SP15  |
| Actions `merge_group`                              | Relay only; verification and publication run on the default branch against the group commit                                                                                                                                                                                                                                                                                                                                                                                    | SP12                        |
| Actions `schedule`, `workflow_dispatch`            | Queued starts, stale-check reconciliation, PR resolution sweep, audit sampling, rollups, retention, publication, self-test                                                                                                                                                                                                                                                                                                                                                     | SP02, SP03, SP18, SP19      |
| Reusable workflows (`workflow_call`)               | Distribute pipeline logic at a pinned version; called by wrappers and, for reruns and queued starts, as jobs inside the issues and maintenance runs; every call passes each secret its jobs use (App id and private key, `env` provider key) by name in an explicit `secrets:` mapping, and the reusable workflow declares each under `on.workflow_call.secrets`; never `secrets: inherit` (§6.4)                                                                              | SP02, SP15, SP19            |
| JavaScript action                                  | Run the core inside jobs                                                                                                                                                                                                                                                                                                                                                                                                                                                       | All                         |
| Job-level `permissions`, `copilot-requests: write` | Least privilege for every trusted job; Copilot inference for `intake` and `assess` when the policy selects the Copilot adapter                                                                                                                                                                                                                                                                                                                                                 | SP07–SP12, SP14, SP16, SP19 |
| Environments with deployment-branch rules          | App key only in `gate`/`publish`, which declare the publication Environment; `env` provider key only in model jobs, which declare a separate model Environment; each such job receives the target repository's Environment value only when the wrapper passes that secret in its `secrets:` mapping, and a job that declares no Environment receives nothing; no job declares both; Copilot uses job permissions, not an Environment secret                                    | SP02, SP13, SP19            |
| Artifacts                                          | Typed hand-off between jobs, the ownership record, and ingestion of external CI signals; bounded retention                                                                                                                                                                                                                                                                                                                                                                     | SP06–SP13, SP17, SP18       |
| Concurrency groups                                 | One active run per submission; cancel superseded runs as a cost control                                                                                                                                                                                                                                                                                                                                                                                                        | SP19                        |
| Actions runs API                                   | Approximate aggregate caps from today's and in-progress runs                                                                                                                                                                                                                                                                                                                                                                                                                   | SP13, SP19                  |
| Actions artifacts API                              | Per-submission ownership artifacts uploaded by `gate`; newest-run determination at publication by artifact creation time: `created_at` (1-second resolution; equal values are ambiguous), never the artifact id; a re-run attempt's same-name upload replaces the earlier one in the listing                                                                                                                                                                                   | SP06, SP13, SP19            |
| Job summaries                                      | Human-readable per-run summary in the Actions UI                                                                                                                                                                                                                                                                                                                                                                                                                               | SP13                        |
| Checks API                                         | A fresh check run per run created by the App; the latest check run with the name is the one GitHub evaluates                                                                                                                                                                                                                                                                                                                                                                   | SP06, SP13                  |
| Rulesets                                           | Require the steward check from the designated App, not any source; strict up-to-date branches or merge queue; evidence protection; required code-owner review of wrapper/policy paths; GitHub offers rulesets only for some plans and visibility settings and refuses them on a Free-plan organization's private repository, which leaves enforcement (§10), evidence protection (§11), and required code-owner review (SP02 step 8) unavailable there, an accepted limitation | SP02, SP03, SP18            |
| CODEOWNERS                                         | Ownership of policy and wrapper workflows                                                                                                                                                                                                                                                                                                                                                                                                                                      | SP01, SP02                  |
| Merge queue                                        | Runs the mandatory suite on the group commit after individual PR admission (SP12); GitHub offers merge queue, and with it the relay, only for some plans and visibility settings (§10; `probes/findings.md` PA06)                                                                                                                                                                                                                                                              | SP12                        |
| Labels                                             | Visible state machine and queues; outputs of the steward, never inputs to acceptance or decisions                                                                                                                                                                                                                                                                                                                                                                              | SP13–SP15, SP19             |
| Issue forms                                        | Versioned rendered-label parsing; ids used only for URL prefilling                                                                                                                                                                                                                                                                                                                                                                                                             | SP05, SP06                  |
| PR template, draft PRs, ready-for-review           | Structured PR submission; admission to review on pass                                                                                                                                                                                                                                                                                                                                                                                                                          | SP05, SP06, SP13            |
| Review requests                                    | Issued only on pass                                                                                                                                                                                                                                                                                                                                                                                                                                                            | SP13                        |
| GitHub App                                         | Bot identity, fine-grained permissions, tokens that can trigger workflows; installation tokens are minted inside Actions                                                                                                                                                                                                                                                                                                                                                       | SP02, SP13, SP18            |
| Copilot SDK inference                              | Bounded request-response inference with the job's `GITHUB_TOKEN`; organization-owned repositories bill the organization under the policy "Allow use of Copilot CLI billed to the organization" (unverified; `probes/findings.md` PA08.7), others the owner's seat; per-session AI-credit limits and cost centers                                                                                                                                                               | SP05, SP07–SP12, SP14       |
| GitHub Pages                                       | Host the static app and published data                                                                                                                                                                                                                                                                                                                                                                                                                                         | SP05, SP15, SP18            |
| Orphan branch or separate repository               | Evidence store                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | SP18                        |
| Search API                                         | Duplicate and prior-dismissal lookup                                                                                                                                                                                                                                                                                                                                                                                                                                           | SP08                        |
| URL-prefilled issue forms and compare URLs         | Assistant hand-off into GitHub                                                                                                                                                                                                                                                                                                                                                                                                                                                 | SP05                        |
| `gh` authentication                                | Local CLI GitHub credentials; the Copilot login also serves `github-token` inference                                                                                                                                                                                                                                                                                                                                                                                           | SP04, SP05, SP20            |

Not used in version 1: interaction limits and comment minimization (active
P08 handling), check-run requested actions (they require a webhook receiver),
`push` triggers, Discussions, Projects (a policy may name a project board as a
triage view, but the steward does not manage it), Copilot code review, the
Copilot coding agent, and tool-enabled Copilot sessions.

## 8. Policy: the quality contract

Location: `.github/patch-steward/policy.yml` on the trusted branch, owned by
maintainers through CODEOWNERS. The trusted branch is the repository's default
branch: the branch whose workflow definitions trusted triggers use. The policy
revision is the content hash of the policy directory (`.github/patch-steward/`)
on the trusted branch at run start; the trusted-branch commit id at that time
is recorded alongside it for traceability but does not enter snapshot
comparison, so unrelated default-branch commits never supersede a run.

Precedence: the policy on the trusted branch at run start governs every run. A
PR that changes the policy is screened under that policy, not under the one it
proposes, and the report flags the proposed change for maintainer review.

Validation: the policy module validates the file at every run against the
policy schema, rejects unknown keys, checks that limits stay within the
steward's hard upper bounds, and checks that referenced paths and commands are
declared. A policy that fails validation ends the run as `inconclusive` with a
maintainer-facing message; no defaults are substituted.

Content areas (values are implementation decisions):

| Area                      | Defines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supported behavior        | Supported behavior, release/support windows and maintenance-branch mappings, platforms, compatibility guarantees, components, authoritative documents and decisions.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Trusted paths             | Paths whose change prevents reliance on PR-controlled CI. Always included: workflow definitions, wrapper workflows, the policy directory, the runner directory, CI scripts. Projects add more.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Execution-sensitive paths | Package scripts, build/test configuration, reporters, shared test helpers, harness code, and project additions. Changes require maintainer triage even after successful container execution.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Categories                | Change categories (`bugfix`, `feature`, `refactor`, `docs`, `chore`, `security`) and the evidence each requires.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Submission                | Required fields for issues and PRs, whether a PR must link a validated issue, reference requirements, and `unrequested_change` for PRs that implement a feature or design change without an accepted proposal: `propose-first` (default) returns the PR to its author with the code `proposal-required` until a linked proposal is accepted, a maintainer accepts the claim on the PR, or the requirement is waived; `triage` routes the PR to maintainer triage instead. Proposal issues are unaffected: a well-formed one is `proposal-pending` and waits in the proposal backlog for a maintainer decision. |
| Execution                 | Mandatory build, test, lint, and static-analysis commands; platform matrix; result file formats; commands that impact analysis may add but never remove.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Runner                    | Image source, network setting for execution (`none` by default, egress only for a policy-declared dependency step), resource limits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Inference                 | `llm.provider` (a shipped adapter id: `copilot-sdk` or `openai-compatible`), `llm.model`, `llm.auth.type` (`github-token` or `env`), provider options such as `base_url`, generation settings, required capabilities, and `llm.admission` (`all` or `maintainer-approved`, default `all`). References only, never secret values; the trusted wrapper workflow decides which secrets enter which job. No default provider: an omitted or unknown provider, a missing credential, or a failed capability check ends the run `inconclusive`.                                                                      |
| Stages                    | Which stages run per category; challenge rounds; whether to continue after the first blocking finding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Escalation                | Rules that route sensitive paths, ambiguous requirements, and security-claimed issues to maintainer triage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Limits                    | Hard call, retry, timeout, resource, and captured-byte bounds; adapter-specific inference limits, with Copilot credits explicitly soft (§12). Approximate daily run/inference caps and per-author concurrency caps; attachment count/byte/decompression limits; stale-check timeout.                                                                                                                                                                                                                                                                                                                           |
| Policy change             | `all`, `enforced`, or `manual` controls rescreening of already published outcomes. Replacement of an unpublished run superseded by policy change is mandatory in every setting (§6.4).                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Modes                     | `observe`, `advise`, or `enforce`, globally and per category (§10).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Follow-through            | Maximum follow-ups per cycle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Hygiene                   | Passive P08 heuristics, the allowlist of automated accounts that are not flagged, and whether the report lists flagged activity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Evidence                  | Store type, retention period, redaction patterns, what is published to Pages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Dismissal codes           | The catalog of dismissal reasons used in reports and overrides (O02), including `proposal-required`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Illustrative inference section; the schema is an open decision (§15):

```yaml
llm:
  provider: copilot-sdk # or openai-compatible
  model: '<model-id>'
  auth:
    type: github-token # or env, which reads the adapter's fixed variable
  admission: all # or maintainer-approved
```

## 9. Data model

Conceptual entities. Schemas are an open decision (§15).

| Entity            | Identity                                                                 | Key content                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy revision   | Content hash of the policy directory; trusted commit id at load recorded | Parsed policy                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Submission        | Repository, type, number, snapshot hash, target branch and head (PRs)    | Parsed fields, category, linked-evidence hashes, author responses to numbered requests, open PRs sharing the head commit, contract results, trusted/execution-sensitive path flags                                                                                                                                                                                                                                                                 |
| Run               | Actions run id and attempt; submission or merge-group snapshot           | Base/head or group commit, owned check id, policy revision, steward version, provider, requested and reported model identifiers, adapter version, generation settings, runner identity, mode, timestamps, budget consumption                                                                                                                                                                                                                       |
| Execution record  | Run and plan entry                                                       | Command, environment identity, exit status, bounded output, declared result files, test identity, commit ids, admissibility (evidence or signal)                                                                                                                                                                                                                                                                                                   |
| Finding           | Run and stage                                                            | Severity (`blocking`, `uncertain`, `advisory`, `speculative`), scenario, location, evidence, requirement/expectation basis, dismissal code                                                                                                                                                                                                                                                                                                         |
| Decision          | Run                                                                      | Outcome, contributing findings, unmet requirements, requests to the contributor                                                                                                                                                                                                                                                                                                                                                                    |
| Report            | Run                                                                      | Rendered report and check summary, bound identifiers                                                                                                                                                                                                                                                                                                                                                                                               |
| Maintainer action | Run and actor                                                            | Kind (`override`, `guidance`, `waiver`, `acceptance`, `resolution`, `inference-admission`), reason, actor, time, and immutable scope. Overrides/waivers bind to PR head/target and requirements or issue snapshot. Issue acceptance binds to proposal content hash; PR acceptance binds to repository/PR, target, and canonical claim-scope text hash, excluding implementation commits. Only `/steward accept` records acceptance; labels do not. |
| Metrics event     | Run or submission and timestamp                                          | State transition, cost, latency, maintainer resolution, appeal, audit result                                                                                                                                                                                                                                                                                                                                                                       |

Findings name a concrete scenario, a code or submission-field location, and
evidence references. `uncertain` means a required decision remains unresolved;
`advisory` and `speculative` never gate admission. SP13 owns the decision table.
PR claim-scope hashing covers the declared problem, benefit, intended behavior,
acceptance criteria, and linked proposal identity/content hash. A push with
unchanged claim scope retains intent acceptance but requires fresh technical
screening; edited scope/target requires new acceptance. Parser ambiguity
requires maintainer clarification and never broadens acceptance.

There is no persisted orchestration entity: ownership lives in the run's
ownership artifact and, when the repository gate is active, its check run.

## 10. Submission states and their GitHub representation

Outcomes: `pass`, `needs-changes`, `uncertain`, `inconclusive`, `overridden`,
`superseded`. Issue classifications: `supported-defect`, `intended-behavior`,
`feature-request`, `accepted-proposal`, `proposal-pending`, `duplicate`,
`uncertain`; a PR's feature claim is `accepted-proposal` or
`unrequested-change`. A `proposal-pending` issue passes into the proposal
backlog and waits for a maintainer decision without author requests.

| Mode      | Check run conclusion                                                                                                                                                           | Comment and labels              | Review requests on pass |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ----------------------- |
| `observe` | None before any repository gate is enabled; `neutral` for this category when the repository-wide check is required                                                             | None; evidence and metrics only | No                      |
| `advise`  | `neutral` by default; blocking exceptions below take precedence; summary carries the outcome                                                                                   | Yes                             | Yes                     |
| `enforce` | `success` for `pass` and maintainer `overridden` to pass; `failure` for `needs-changes` or `overridden` to needs-changes; `action_required` for `uncertain` and `inconclusive` | Yes                             | Yes                     |

When any category enters `enforce`, require one stable check name with the
steward App as its expected source. Every PR then receives that check:
categories outside enforcement complete it `neutral` with an explicit "not
enforced" summary after ownership commitment and category validation, before shadow
screening, subject to the blocking exceptions below. This neutral check does not depend on shadow completion or evidence
storage. Their observe-mode evidence does not generate report comments,
labels, or reviewer requests. Category ambiguity cannot downgrade
an enforced change; it requires triage. Installation verifies the
[required-check behavior](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging).
Enforcement depends on a ruleset that requires the check, and the merge-queue
relay on merge queue; GitHub offers both only for some plans and visibility
settings and refuses them on a Free-plan organization's private repository.
There the steward runs `observe` and `advise` without a required check:
`steward init` and the SP02 step 8 precondition detect the refusal and keep
`enforce` off. The required-check and merge-queue semantics this design relies
on were confirmed on public repositories and are relied on as independent of
plan and visibility (`probes/findings.md`, PA01, PA06).

When the repository gate is active, `gate` creates a fresh App check run as
`in_progress` on every run, including same-commit reruns, and records its id
in the ownership artifact. Because GitHub evaluates the latest check run with
that name from the App, the earlier success stops counting the moment the new
check exists. In an all-observe repository without a required check, no check is
created and ownership rests on the artifact; when a mode change first
activates the gate, the maintenance workflow queues runs for open PRs so each
receives a check (SP03). `publish` completes only its own check id, after
durable evidence, after recomputing the snapshot, and after confirming through
the ownership artifacts that no newer run exists for the submission. If `gate`
cannot create a required check, the run stops before ownership commitment and reports
that the previous certification still stands. GitHub API writes are not
atomic with user edits: a check certifies the recorded snapshot, and event
delivery or API outages can delay supersession.

Check disposition takes precedence over ordinary mode mapping. Queued and
awaiting-approval runs keep any check `in_progress`; superseded runs may
complete only their own still-pending check as `cancelled`, never `neutral`
or `skipped`, and do not touch reports or labels. If cleanup cannot run,
reconciliation completes it `action_required` after the stale timeout.
A shared head produces `needs-changes`; when the check is required or any
category is enforced its conclusion is `action_required` regardless of mode
or override. With an optional advise-only check it is `failure`. It never
receives `success` or `neutral`. Author action is a distinct commit or closure
of the other PRs. Duplicates without a commitment create no check.
An early neutral check for an unenforced category still certifies only that
non-enforcement decision; publication rechecks freshness before any later
summary update, and new waiting/shared-head runs never take this shortcut.

Check runs attach to commits, so screening checks exist for PRs and merge groups. An issue receives the
report comment and labels in feedback-enabled modes. A defect issue passes
after claim validation and required reproduction, then enters the ordinary
backlog. A well-formed proposal passes the submission contract into the
proposal backlog as `proposal-pending`; this does not mean intent acceptance. No review
requests follow an issue.

Label families: `steward:<state>` for status (`queued`, `awaiting-approval`, `screening`, `pass`,
`awaiting-author`, `triage`) and `claim:<classification>` for issues. Names are policy-configurable.
Use one lifecycle status label: `needs-changes` (including override to that
outcome) maps to `awaiting-author`; `uncertain` and `inconclusive` map to
`triage`; pass (including override to pass) maps to `pass`. Outcomes and
overrides remain in reports/evidence, not competing status labels.
Labels are outputs of the steward; a label applied by hand is data and never
records an acceptance, an override, or an outcome.

PR lifecycle (outcomes route to the lifecycle labels listed above):

```text
opened -> screening, or queued/awaiting-approval -> screening when released
screening -> pass -> ready for review and reviewer requests (feedback-enabled modes)
screening -> needs-changes -> awaiting-author -> corrected inputs -> screening
screening -> uncertain -> triage -> maintainer action -> screening
screening -> inconclusive -> one transient rerun within caps, otherwise triage
changed inputs -> superseded -> replacement screening
closed/merged -> resolution recorded; reopened -> screening
```

## 11. Evidence store and publication

Default store: an orphan branch in the target repository written only by the
publish job or by a maintainer's attributed local run. Alternative: a separate
repository, which allows private evidence and keeps the main repository's
history clean; it requires the App to be installed there as well. A ruleset
restricts pushes to the App identity and repository maintainers where the
plan and visibility of the repository that holds the store (the target
repository for the orphan branch, the separate repository otherwise) offer
rulesets. Where GitHub refuses rulesets there, as it did on a Free-plan
organization's private repository (`probes/findings.md`, PA01, PA06), the
push restriction is unavailable: an accepted limitation, like enforcement
and the merge-queue relay (§10). `steward init` and the SP02 step 4
precondition detect the refusal and report that the control is unavailable.

Layout concept: one directory per run holding the run record, execution
records, findings, the rendered report, redacted bounded logs, and maintainer
actions; monthly metrics events; a generated index. The store is append-only:
supersession and maintainer-action events are appended, retention pruning is
the only deletion, and writes retry a bounded number of times on
non-fast-forward pushes. The store holds no reservations, leases, or other
mutable orchestration state.

Baseline results for the unmodified target are reused only under the same base
commit, policy, platform, command/harness identity, and environment (runner image
digest and tool versions). A Linux baseline cannot explain a Windows failure.

Publication: the maintenance workflow regenerates the index, metrics rollups,
queues, and the public policy subset, combines them with the pinned web bundle,
and deploys to GitHub Pages. Redaction runs before evidence is written; the
public subset excludes anything the policy marks non-public. Private target
repositories are supported, but Pages publication is disabled unless an
explicit public subset is approved. The private evidence records and Actions
summaries remain the maintainer view when no public dashboard is permitted.

## 12. Resource, cost, and failure controls

- Ordering: the contract gate, the cap check, and any inference-admission
  check before any LLM call or container;
  deterministic reference checks before claim validation; execution before
  challenge; challenge last and only for categories that require it.
- Budgets: hard bounds on calls, retries, execution time/resources, and captured
  bytes; token limits only where the adapter supports them. Copilot
  `sessionLimits.maxAiCredits` is a [soft cap checked after a model call](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/session-limits),
  so one response may exceed it. All sessions/rounds debit one cumulative
  stage/run ledger; new sessions receive only the remaining allowance. Never
  auto-extend an exhausted session. Record overshoot and stop further calls;
  incomplete required work becomes `inconclusive`. Provider-side spending
  controls supplement these limits; an exact monetary ceiling is not promised.
- Aggregate caps: `gate` counts today's runs and the in-progress runs
  attributed to the submission author from the Actions run list. The counts
  are approximate under concurrent admissions and are documented as such;
  they limit cost, not participation. Over-cap runs stop with a pending check
  labeled queued and are restarted by the maintenance workflow. Propagated
  and policy-change reruns count against the same caps.
- Concurrency: deduplicate and commit in `gate`, outside the per-submission
  concurrency group; only a committed replacement's jobs join the group, which
  serializes committed work and publication per submission. GitHub keeps one
  pending member per group and a newer member replaces it even with
  `cancel-in-progress: false`, and a job-level cancellation marks the whole run
  `cancelled` (§6.4). Only committed replacements may cancel stale submission
  work, never unrelated jobs in a shared issues/maintenance run. Ownership
  and freshness, not cancellation, decide who may publish (§6.4, §10).
- Caching: base-commit baselines reused from the evidence store; LLM results
  reused only when the full input hash matches, and that hash includes the
  provider, requested model identifier, adapter version, generation settings,
  and policy revision.
- Execution bounds: per-execution wall clock, CPU, memory, process count,
  output bytes; network `none` unless a policy-declared dependency step runs
  first.
- Rate limits: provider limits may apply per credential, account, organization,
  model, or a combination, and the Copilot path adds per-session credit limits;
  the design assumes none of these in particular. Per-submission concurrency
  groups do not coordinate shared provider capacity across repositories; this
  is a documented limitation. The adapter backs off within the bounded retry
  budget, and exhaustion ends the run `inconclusive`.
- Spending: inference is Copilot-credit or third-party spend, and the operating
  mode does not reduce it, because `observe` runs the full pipeline. Controls,
  in order: the contract gate rejects malformed submissions before any model
  call; per-run accounting maps onto adapter limits with soft-cap overshoot
  recorded; the approximate repository-wide daily caps bound volume, including
  floods from many accounts; `llm.admission: maintainer-approved` defers
  inference for authors without prior merged work until a maintainer admits
  the submission (SP19) and never changes an outcome; `steward init` prints
  provider-side spending limits
  and Copilot cost-center or session-limit setup. This organization billing
  path is unverified: no probe has run in an organization with Copilot
  (`probes/findings.md`, PA08.7). Per-author concurrency caps
  bound simultaneous work, not aggregate spend.
- Model availability probe: on schedule, the maintenance workflow sends a
  bounded synthetic request with no submission content through the configured
  adapter and model. Persistent failure creates or updates one deduplicated
  maintenance issue; recovery closes it. The probe job holds only the model
  credential and the notification job only the App token. The probe
  supplements normal error handling and cannot guarantee that the next
  screening request succeeds.
- Failure classes and outcomes: infrastructure failure, model unavailable or
  retired, missing or unusable model credential, capability mismatch, model
  refusal, malformed structured output after bounded repair attempts, budget
  exhausted, and environment unavailable end as `inconclusive` when
  required work cannot complete. Control-path changes prevent reliance on PR
  CI; execution-sensitive path changes require maintainer triage (`uncertain`
  until resolved). Missing contributor evidence (a required field, reference,
  reproduction, or declared test that the policy requires for the category)
  ends as `needs-changes`. A defect in the steward itself fails the job and
  is recorded as `inconclusive` by a surviving `publish` job. `publish` also
  survives a workflow cancellation: cancelled required work is recorded as
  `inconclusive`, unless a committed replacement caused the cancellation and
  the run abandons as `superseded` (§6.4). A failure in `gate` or `publish`,
  or a cancellation that reaches `gate` or `publish` itself, leaves any check
  pending until reconciliation. A wrapper that grants less than the pinned
  reusable workflow's jobs request fails the whole run at startup, so no job
  runs and no check, report, or evidence exists; `steward init` and the
  installation self-test guard against it (§6.4). No success is published
  without durable evidence, a current snapshot, and newest-run ownership. One
  automatic rerun is attempted for transient causes within the daily cap.
- Metrics recorded per run: tokens and reported credits, model calls, container
  minutes, wall clock, outcome, stage reached, retries.

## 13. Security considerations

| Threat                                                         | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR modifies workflow definitions or wrapper workflows          | Screening runs from the default-branch definition regardless; PR CI cannot satisfy required coverage; execution-sensitive changes require triage even when steward executions pass.                                                                                                                                                                                                                                                                                                     |
| PR modifies the policy or runner definition                    | Ignored for its own run; flagged in the report; CODEOWNERS review required for the change where the repository's plan and visibility offer rulesets (§7 "Rulesets"; SP02 step 8).                                                                                                                                                                                                                                                                                                       |
| Prompt injection through text, diffs, files, logs, or comments | All content is data; structured outputs are schema-validated; rules decide; no tool authorization derives from content; LLM sessions have no write capability.                                                                                                                                                                                                                                                                                                                          |
| Test weakening, disabled assertions, inverted expectations     | Deterministic diff analysis of test files (removed or skipped tests, changed assertions, swallowed errors), test-count comparison with base, independent challenge.                                                                                                                                                                                                                                                                                                                     |
| Credential exposure to submitted code                          | Containers receive no credentials or sensitive mounts. Only execution jobs launch them, on fresh runners holding a contents-read token; App and model jobs never execute submitted code.                                                                                                                                                                                                                                                                                                |
| Container escape on the runner                                 | Non-root, unprivileged containers with resource limits on ephemeral runners; the job holding the container has only a read-only token.                                                                                                                                                                                                                                                                                                                                                  |
| Manipulated test results, in CI or containers                  | Validate provenance separately from truth; triage execution-sensitive changes; compare baseline test identities/counts/durations; run independent challenges. Submitted code can still manipulate results; no isolation-based guarantee is claimed.                                                                                                                                                                                                                                     |
| Stale success on a re-screened commit                          | A fresh check run per run; GitHub evaluates the latest; `publish` completes only its own check after evidence, snapshot, and newest-run verification.                                                                                                                                                                                                                                                                                                                                   |
| Late write from a superseded or cancelled run                  | Only the current owner may publish reports, labels, or admission. Superseded cleanup may cancel only its own pending check; it cannot update the current report or another run's check.                                                                                                                                                                                                                                                                                                 |
| Merge-queue ref workflow code                                  | The relay on the queue ref has no credentials and no checkout; verification and publication run on the default branch.                                                                                                                                                                                                                                                                                                                                                                  |
| Cost exhaustion through volume                                 | Contract gate first, cumulative inference accounting with documented soft caps, daily/per-author caps, provider spending controls, cancellation, caches. Caps apply uniformly; optional prior-contribution admission explicitly trades newcomer access/latency for spending control (O01), with an aged approval queue and maintainer admission path.                                                                                                                                   |
| Forged artifact or evidence identity                           | Verify source repository, workflow, run, attempt, snapshot, round, and schema from platform metadata; restrict evidence writes where the plan and visibility of the evidence store's repository offer rulesets (§11). Provenance does not establish honest test results.                                                                                                                                                                                                                |
| Model failure or refusal                                       | `inconclusive`, bounded retries, reported plainly.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Shared model blind spots                                       | Independent challenge with a clean context; validate expectations against trusted requirements, then execute counterexamples. Non-executable quality concerns are advisory; agreement is not proof.                                                                                                                                                                                                                                                                                     |
| Credential leakage in logs                                     | Bounded capture and redaction before artifact upload and evidence write.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Compromised steward release                                    | Pin reusable workflows/actions by immutable commit SHA; review updates through protected policy/wrapper paths where the repository's plan and visibility offer rulesets (§7 "Rulesets"); the Copilot CLI runtime is the bundled, lockfile-pinned package with auto-update disabled and no path override in Actions.                                                                                                                                                                     |
| Model credential exposure                                      | The provider key or Copilot-scoped token exists only in `intake` and `assess`, which hold no App key; injected credential values and recognizable token patterns are redacted from artifacts, logs, and evidence; the credential never enters model context.                                                                                                                                                                                                                            |
| Copilot runtime reads instruction files or uses tools          | The adapter starts the runtime in an empty working directory outside any checkout with a fresh `COPILOT_HOME`, no custom-instruction directories, no MCP servers, every built-in tool excluded, and a deny-all permission handler; prepared context travels only in the message. Whether read-only built-in tools consult the handler is unconfirmed (§15), so the empty directory is the primary control.                                                                              |
| Provider retirement or model deprecation                       | Provider-independent adapter contract and policy-owned selection; runs end `inconclusive` rather than substituting a model; the maintenance probe surfaces persistent failure in one deduplicated issue.                                                                                                                                                                                                                                                                                |
| Submission content sent to an inference provider               | Public and private repositories are supported. Installation explicitly authorizes the selected provider for the repository visibility and context; unauthorized confidential context is withheld and required missing context routes to triage. Local CLI discloses transmitted content before sending.                                                                                                                                                                                 |
| Shared head commit across open PRs                             | `needs-changes`; never success/neutral. A required check or any enforced category uses `action_required`, otherwise an optional check fails. No override; distinct commits or closure resolve sharing; pushes and closures rescreen peers.                                                                                                                                                                                                                                              |
| Stale success after a linked issue or policy change            | Linked-issue edits, closures, reopenings, deletions, and recorded maintainer actions propagate screening jobs to the open PRs that link the issue; edits or deletions of snapshot response comments start runs; policy content changes are swept into queued reruns keyed on the newest ownership record, so a run superseded before publication is replaced; the dashboard marks submissions screened under changed inputs. Base-branch movement stays with GitHub's up-to-date rules. |
| Acceptance forged or carried through a label                   | Labels are outputs; acceptance exists only as a recorded `/steward accept` with actor, reason, and the proposal's content hash, and an edited proposal returns to `proposal-pending`.                                                                                                                                                                                                                                                                                                   |
| Event loops from the App's own writes                          | Verify installation identity and recorded resource ids to ignore report/usage/follow-up, ready-for-review, label/reaction, and maintenance-issue echoes; preserve actual dependency-change propagation; deduplicate inputs.                                                                                                                                                                                                                                                             |

## 14. Traceability

| Problem | Mechanism                                                                                                                                                                                                                      | Processes                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| P01     | Published expectations and preflight; contract gate before any model call or steward execution; claim validation; cached baselines; approximate caps; author follow-through; net workload measurement against a control cohort | SP01, SP03, SP05, SP06, SP08, SP11, SP13, SP14, SP19 |
| P02     | Reference verification; evidence-backed findings; challenge without author prose; presentation carries no weight in decisions                                                                                                  | SP05, SP07, SP08, SP11, SP13                         |
| P03     | Claim classification with evidence; PRs bound to validated issues; reproduction and before-and-after evidence tied to the validated claim; intended behavior distinguished from defects                                        | SP06, SP08, SP09, SP10                               |
| P04     | Reproduction requested at preflight; applicability findings from reference checks; reproduction on claimed supported versions and the applicable maintenance target, with default-branch comparison as context                 | SP05, SP07, SP09, SP17                               |
| P05     | Category-specific evidence requirements; before-and-after regression evidence; anti-gaming checks; independent challenge; regression analysis with base comparison; sandboxed execution                                        | SP06, SP10, SP11, SP12, SP17                         |
| P06     | Preflight questions a reviewer would ask; specific requests; responsiveness assessment                                                                                                                                         | SP05, SP14                                           |
| P07     | Fixed concise report format; severity statements excluded; no chatter                                                                                                                                                          | SP05, SP06, SP13, SP16                               |
| P08     | One updated report and check run; no approvals or replies to bots; flagged automated activity for maintainer attention                                                                                                         | SP13, SP16                                           |
| P09     | Evidence requirements and dismissal codes published before submission; no severity or credit statements; author responsibility for follow-through                                                                              | SP01, SP05, SP13, SP14                               |
| P10     | Cheap-first ordering; security-claimed issues routed by policy without severity assertion; caps and queues; local maintainer screening when capacity is short; observation mode measures queue effects                         | SP03, SP08, SP15, SP19, SP20                         |
| P11     | Duplicate and prior-dismissal reuse; neutral evidence-cited reports; structured appeals; audit trail; local screening for disputed cases                                                                                       | SP08, SP13, SP15, SP18, SP20                         |
| O01     | Observation before enforcement; evidence-based gates; uniformly applied caps; explicit newcomer-admission tradeoff with approval queue/age metrics; appeals and attributed local runs                                          | SP02, SP03, SP13, SP15, SP19, SP20                   |
| O02     | Shared dismissal-code catalog; standard report format; recorded maintainer actions; published evidence requirements                                                                                                            | SP01, SP13, SP15, SP18                               |
| O03     | Observe mode from installation; metrics events; audit sampling; replay harness; thresholds from measurement                                                                                                                    | SP02, SP03, SP04, SP18                               |

## 15. Open implementation decisions

- Policy, submission, execution-record, finding, report, and metrics schemas.
- Container image strategy: project-provided image, generated image from
  policy-declared toolchains, or both; image build caching.
- Network policy for dependency installation inside the sandbox.
- Default model per shipped adapter; prompt and response schema design;
  repair strategy for malformed output.
- The `llm` policy schema, including provider options such as `base_url`, and
  how the approximate daily inference aggregate is computed from the run list
  and evidence records.
- Context selection strategy and its token budget.
- Test result parsing: policy-declared result formats versus exit-code-only
  evidence.
- Duplicate and prior-dismissal search method.
- Efficient, bounded implementation of live PR-link reconciliation and
  continuation/retry (§6.4); a periodically rebuilt evidence index alone is
  insufficient.
- Ownership artifact naming, retention, and the consistency window of
  artifact listing under concurrent `gate` jobs.
- Fixed execution/assessment round expansion, cumulative budget handoff, and
  job-level serialization/cancellation for workflows screening multiple submissions.
- Platform coverage beyond Linux containers: reliance on project CI signals and
  the rule for PRs that change trusted paths on those platforms.
- Numerical limits: budgets, retention, audit sample sizes, the stale-check
  timeout.
- Enforcement thresholds derived from observation-mode measurements.
- Local credential conventions: reuse of the user's Copilot login for
  `github-token`, and the fixed environment variable names per adapter.
- Capability probing at installation: how installation detects the Copilot
  organization policy and billing state. An `admin:org` user token reads the
  organization's Copilot billing `cli` setting; the job `GITHUB_TOKEN` reads
  nothing about either, so inside Actions only a bounded synthetic request
  detects them (`probes/findings.md`, PA08.6). This organization billing path
  is unverified: no probe has run in an organization with Copilot
  (`probes/findings.md`, PA08.7).
- Whether read-only Copilot built-in tools consult the SDK permission handler;
  until confirmed, the empty working directory is the primary control.
- Copilot adapter system-prompt mode: `customize` for version 1, keeping the
  runtime's safety sections; `replace` is reconsidered after replay
  measurements.
- Evidence-branch retention mechanics and whether pruning rewrites history.
- Confirmation during installation that GitHub evaluates the most recent check
  run per name and App for required checks, that a `neutral` conclusion
  satisfies the requirement, and that a same-commit rerun therefore
  supersedes an earlier success; the artifact schema for the ownership record.
