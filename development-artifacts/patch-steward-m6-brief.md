# patch-steward-m6 — Brief

## Goal

Execute milestone M06 ("GitHub-hosted skeleton: gate, ownership, evidence store, publish") of
`docs/project-development-plan.md`: prove single-run orchestration on GitHub with the cheapest pipeline (events to `gate` to
`publish` in observe mode, at contract level) with ownership, freshness, caps, and durable evidence in an orphan branch or a
separate repository, before any stage depends on it. Deliver the `action` package running core phases inside jobs, the
reusable screening workflow, two wrapper templates pinned by commit SHA, the ownership module, the Git Data API evidence
store, waiting-state and supersession persistence, closure resolutions, job summaries, metrics events, invariant 2 and 8
conformance at GitHub level, a test-bed scenario suite that demonstrates every exit criterion, and the governing-document,
ADR, and manual changes.

OWNER GATE: APPROVED 2026-09-27 (answers recorded in "Owner gate answers"). Every gate item G1–G11, interpretation I1–I21,
constant K38–K51, owner action OA1–OA4, scenario S01–S17, and the ADR inventory is BINDING exactly as written below. Rejected
alternatives are never implemented. Owner actions OA1–OA4 are NOT yet confirmed done: the pipeline runs each OA's verify command
before the earliest phase or step that needs it (see "Owner actions") and returns `RESULT: needs-human` naming the missing action if
a check fails.

## Context

### Repository and environment facts (read at commit 6418129c7b104fd93d9162efcda6fe08373287ee; line numbers shift as files are edited — locate text by quotation and re-verify against live files)

- Repo root: `C:\Users\John\Projects\steady-orchard\patch-steward` (Git Bash `/c/Users/John/Projects/steady-orchard/patch-steward`).
  Remote `origin = git@github.com:steady-orchard/patch-steward.git` (PUBLIC). `git symbolic-ref refs/remotes/origin/HEAD` =
  `refs/remotes/origin/develop`. Working branch `milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish` (local,
  created from develop at ab6b99a plus the lead's commit 6418129). Owner decision D6: the pipeline MAY push `milestone/6-*`
  commits to origin (needed so test-bed wrappers can pin a reachable SHA). CI (`.github/workflows/ci.yml`) triggers on pushes
  to `master`, `develop`, `release/**` and on pull requests only, so a milestone-branch push runs no CI.
- Environment: Windows 11; Git Bash for all commands. Node `v24.11.0`, pnpm `10.20.0` (`packageManager: pnpm@10.20.0`), git
  `2.55.0.windows.3`, `gh 2.93.0` (logged in as `jambolo`; `gh auth token` works; core rate limit 5000/h), `actionlint 1.7.12`,
  `act 0.2.88` (Docker; Ubuntu CI reproduction on an LF clone, skip the coverage job). `jq` is NOT installed (use node or
  `gh --jq`).
- `core.autocrlf=true`: compare committed bytes with `git show HEAD:<path>`; compare deployed files by git blob id
  (`git rev-parse HEAD:<path>` against `gh api repos/<r>/contents/<path>?ref=<branch> --jq .sha`), never working-tree bytes.
  No `.gitattributes`.
- Long git-worktree paths break `pnpm test`: phase gates and the project DoD run in the MAIN tree; worker worktrees use short
  paths such as `C:/w/m6-<id>`.
- `.gitignore` swallows `logs`, `*.log`, `out`, `dist`, `coverage`, `.cache`, `*.tgz`, `.env*`, `pids`, `node_modules/`,
  `.claude`: never name a committed file or directory that way.
- `.prettierignore`: `pnpm-lock.yaml`, `dist/`, `coverage/`, `node_modules/`, `development-artifacts/`. Prettier checks every other
  `.json`, `.md`, `.yml`, `.yaml`, `.ts` file, INCLUDING `.github/workflows/*.yml`, `templates/**`, `probes/**`, `fixtures/**`, and any
  new `scenarios/**`. `development-artifacts/` is already excluded; this plan adds no ignore entry.
- Root scripts: `build` = `pnpm -r build`; `typecheck` = `tsc --noEmit -p packages/<pkg>/tsconfig.test.json` for core, cli, action,
  web; `test` = `vitest run`; `test:live` = `vitest run --config vitest.live.config.ts`; `lint` = `eslint .`; `format:check` =
  `prettier --check .`. Versions: root, core, cli, action `0.0.2` (lockstep).
- `packages/action` today: `package.json` (`@patch-steward/action`, `private`, `type: module`, script `build: tsc`, NO dependencies),
  `src/index.ts` (smoke `packageName()`), `src/index.test.ts`, `tsconfig.json` (rootDir src, outDir dist, excludes tests),
  `tsconfig.test.json` (extends, noEmit, exclude []; NO `paths` mapping for `@patch-steward/core` — cli's has
  `"paths": { "@patch-steward/core": ["../core/src/index.ts"] }` with `rootDir: ".."`).
- `packages/core` dependencies: `yaml`, `zod` only. `packages/core/src/index.ts` has 87 `export *` lines; every new export name must be
  unique across core (TS2308). `src/conformance/invariant-5.test.ts` pins the exact sorted lists of root functions named
  `load*`/`validate*`/`resolve*` and `parse*`/`capture*`/`check*`: any new root export with those prefixes must extend it in the
  same step.
- Vitest: projects `unit` (`packages/*/src/**/*.test.ts` minus `.fixture.`, `.container.`, `.live.`) and `fixture`
  (`*.fixture.test.ts`), both aliasing `@patch-steward/core` to `packages/core/src/index.ts`. Action tests fall under the same
  globs. `vitest.live.config.ts` runs `*.live.test.ts` only (never CI).
- `docs/adr/`: 70 records ADR-0001–ADR-0070; `grep -c '^| \[ADR-' docs/adr/README.md` = `70`; ADR-0060 is `superseded by ADR-0066`;
  every other record `accepted`. MADR format per `docs/adr/README.md` "Format".
- `.github/workflows/`: `ci.yml`, `cd.yml` only. CI uses `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`
  (tags, not SHAs).
- Last M05 test totals (ledger): 141 test files, 2673 tests.

### Milestone text (verbatim, `docs/project-development-plan.md` "### M06. GitHub-hosted skeleton: gate, ownership, evidence store, publish")

```text
Goal: prove single-run orchestration on GitHub with the cheapest pipeline:
events to `gate` to `publish` in observe mode, with ownership, freshness,
caps, and durable evidence, before any stage depends on it.

Design scope: §6.4 `gate`, `publish`, ownership and freshness rules without checks; the submission events of `steward-pr.yml` and `steward-issues.yml`; §6.3 Evidence store, evidence commits, Clock and ids; §11; §12 caps and concurrency; SP06 steps 1 and 8; SP13 steps 3–4; SP18 steps 1 and 6; SP19 steps 1 and 3 (own-input rescreens); SP03 step 2 closures; ADR-0005, ADR-0009, ADR-0013; invariants 2 and 8
Addresses: P01, P10, P11, O01, O02, O03
Depends on: M02, M05

Inputs:
- M02 findings on artifacts, triggers, Environments, and the run list.
- A test-bed repository with the test App installed and a publication
  Environment restricted to the default branch.

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
```

Plan §7.3: invariant 2 (trusted-branch policy) and invariant 8 (snapshot binding and ownership) are EXTENDED here at GitHub level;
invariant 4 is extended by every milestone. Plan §7.2: §15 "Ownership artifact naming, retention, listing consistency window"
(M06 decides) and "the artifact schema for the ownership record" (M06 schema) are settled here. Adoption gate (plan §0.5):
test-bed repositories only, with the test App; never this repository, never real repositories.

### Owner decisions (settled 2026-09-27; binding; restated from the lead's prompt)

- D1 Ownership artifact: name `steward-ownership-<pr|issue>-<n>` (architecture §6.4); one `ownership.json` record (record type
  `ownership`, version 1: run id and attempt, check id or null, snapshot hash, policy revision, admission and cap disposition, event
  identity, author id, created_at), zod-validated after download; retention requested 90 days (platform cap measured in PA02.6), the
  repository's effective value recorded; newest by `created_at` (never id, PA02.3); a tie or incomplete listing blocks publication;
  publish re-lists after a settle delay above the measured 2 s maximum visibility delay (PA02.5); an expired artifact means no owner,
  and deduplication then falls back to the latest published evidence snapshot.
- D2 Evidence store: Git Data API, one commit per run. Orphan branch `steward-evidence`; the same `<owner>/<repo>/` subtree (architecture
  §11 layout) at the root of both the branch and a separate repository; each run adds its run directory and metrics file through blobs,
  tree, commit, and a non-force ref update — that commit is the commit point, replacing the local store's staging-and-rename; a
  non-fast-forward update rebuilds on the new tip within `limits.evidence.write_retries`; a pre-update check that the change only adds
  new paths (append-only); read-back verification before any other publication step.
- D3 Caps (`limits.caps.daily_runs`, `limits.caps.per_author_concurrent_runs`): Actions run list, tagged. The wrapper `run-name` carries
  submission, author id, event kind, and sender type (PA09 mechanism m1, confirmed); daily count = today's UTC wrapper runs minus runs
  sent by this installation's App bot (echoes); per-author count = queued or in-progress runs with that author id; 1–3 requests; human
  comment runs still count (cost-safe overcount), documented as approximate. (The daily inference aggregate is M13.)
- D4 Deduplication: snapshot-based. Event identity = (event, action, submission, triggering object id and its updated_at, run id,
  attempt), recorded in the ownership record for audit. A new attempt of a run is an explicit rerun and replaces. Otherwise a snapshot
  hash plus policy revision equal to the newest committed owner's keeps that owner: no commit, no cancel, no cap debit. Verified App
  echoes (sender is the installation bot and the resource id is recorded) are dropped before capture.
- D5 Build and pinning (ADR-0011): BUILD AT RUNTIME (owner's choice over the lead's recommended committed bundle). Jobs check out this
  repository at the pinned SHA and run `pnpm install --frozen-lockfile` and the build; no committed bundles; wrappers pin the reusable
  workflow (in this repository's `.github/workflows/`, `workflow_call` only) by full commit SHA; during development the pins point at
  pushed milestone-branch commits. Consequences stated and mitigations proposed in gate G8 — do NOT silently switch approach.
- D6 Test-beds and outward actions: all exit scenarios on org-public (`steady-orchard/patch-steward-testbed-public`, including a fork PR
  from `jambolo/patch-steward-testbed-public`); one smoke screening each on personal (`jambolo/patch-steward-testbed-personal`;
  cross-owner explicit `secrets:` mapping, never `secrets: inherit`, PA04.1) and org-private
  (`steady-orchard/patch-steward-testbed-private`) with a separate private evidence repository the owner creates and installs the App
  on. The pipeline MAY push `milestone/6-*` commits to origin and write test-bed workflows, branches, Environments, and secrets through
  the probe tooling. The OWNER makes App permission changes and creates repositories (see "Owner actions"). Never print tokens or
  secrets.
- Carry-forward: explicit per-name `secrets:` mapping across two different organizations is untested (only one organization exists); a
  known gap, not a blocker.

### Design sources (governing; read at 6418129)

- `docs/architecture.md`: invariants 2, 8 (§2); §4 boundary rules ("Z1 to GitHub writes: only `gate` and `publish` hold scoped App
  tokens"); §6.1 layout ("action/ GitHub JavaScript action that runs the core inside workflow jobs"; "the action targets the `node24`
  runtime"); §6.2 Ownership row ("Deduplicate before claiming work; create the check when required, then upload the immutable ownership
  artifact as commitment; ... verify freshness and newest committed owner before publication"); §6.3 GitHub row ("GraphQL and every
  write are not implemented"), Evidence store row ("the orphan-branch and repository stores are not implemented"), Clock and ids row;
  §6.4 in full (secret wiring paragraph; job table; token scoping paragraph "`gate` uses `checks: write` ... `publish` needs checks,
  issues, pull requests, and evidence contents write permissions. Tokens are scoped to the selected target and evidence repositories
  and are never passed between jobs"; publish condition `if: ${{ always() && needs.gate.result == 'success' &&
  needs.gate.outputs.committed == 'true' }}`; wrapper table; "Ownership and freshness without steward state" bullets; per-submission
  concurrency bullet; echo paragraph "Deduplicate by event identity and snapshot"); §7 rows Artifacts, Actions runs API, Actions
  artifacts API, Job summaries, Environments, Reusable workflows, JavaScript action; §9 (record types list, snapshot paragraph, "There
  is no persisted orchestration entity"); §10 ("In an all-observe repository without a required check, no check is created and
  ownership rests on the artifact"); §11 (layout, write protocol, "`limits.evidence.write_retries` applies only to the branch or
  repository store"); §12 Aggregate caps and Concurrency bullets, failure classes; §12.1 hard bounds (`limits.caps.daily_runs` 1–1000,
  template 50; `limits.caps.per_author_concurrent_runs` 1–20, template 2; `limits.evidence.write_retries` 1–10, template 5;
  `limits.evidence.run_bytes` 65536–52428800; `limits.github.requests_per_run` 10–1500; hard-only constants table ending "Record schema
  version 1"); §13 rows "PR modifies workflow definitions or wrapper workflows", "Forged artifact or evidence identity", "Late write from
  a superseded or cancelled run", "Compromised steward release", "Event loops from the App's own writes"; §15 items "Ownership
  artifact naming, retention, and the consistency window of artifact listing under concurrent `gate` jobs." and the last item's clause
  "the artifact schema for the ownership record".
- `docs/processes.md`: §0.1 Ownership record, Repository gate, Snapshot; §0.4 Gate line; SP03 step 2 (closure handlers record
  resolutions: merged, closed with a dismissal code, closed by the author, closed by a maintainer without a code; "Reopening restarts
  screening"); SP06 Trigger row and steps 1 and 8; SP13 steps 3–4 and failure handling; SP18 steps 1 and 6; SP19 steps 1 and 3,
  failure handling (owner ordering by `created_at`), closed cause vocabulary (20 causes incl. `stage-incomplete`).
- `docs/adr/`: ADR-0005, ADR-0009, ADR-0011 (Distribution: "Reusable workflows and a JavaScript action published from this repository,
  an npm CLI, and a `steward init` command"), ADR-0013, ADR-0026 (created_at ordering), ADR-0027 (wrapper permission ceiling), ADR-0028
  (publish after cancellation), ADR-0030 (per-submission concurrency after commitment), ADR-0033 (explicit secrets mapping), ADR-0064
  (run directory and local store), ADR-0070 (handoff records).
- `docs/user-manual/configuration.md` "## Credentials and deployment (Proposed)" with the callout "`[NEEDS INPUT]` ... App-secret names,
  Environment names ..."; "## Evidence and visibility (Proposed)"; `installation.md` "## Target-repository installation (Proposed)";
  `overview.md` "## Execution options (Proposed)", "## Outcomes and waiting states (Proposed)"; `troubleshooting.md` "## Waiting states
  and checks (Proposed)".
- `templates/policy/policy.yml` `evidence.store` = `type: orphan-branch`, `branch: patch-steward-evidence` (also embedded in
  `packages/core/src/submission/default-checklist.ts`; the fixture policies under `fixtures/policies/` use the same value).
- `docs/whitepaper.md` §9–§14 (decisions paragraph "Decisions recorded on September 27, 2026 (ADR-0062–ADR-0070 in `docs/adr`)").

### Platform facts from the probe suite (`probes/findings.md`; test-bed measurements, not product values)

- PA02.3 (refuted as stated): artifact `created_at` order matches upload order; artifact id order does not across re-run attempts; a
  re-run attempt's same-name upload REPLACES the earlier attempt's artifact in the listing. Design already orders by `created_at`.
- PA02.5: listing visibility delay after upload-step completion min 0 s, median 1 s, max 2 s (5 samples); `created_at` resolution 1 s;
  0 ties observed.
- PA02.6: requested retention 0 → 90 days, 1 → 1, 90 → 90, 400 → 90 (capped); repository cap and default 90 days on org-public and
  org-private (organization cap 400).
- PA02.7: artifact listing paginates (Link header), one REST request per page, works with job token, App token, and user token;
  download works with job and App tokens.
- PA03: `pull_request_target`, `issues`, `issue_comment`, `workflow_run`, `schedule` run default-branch workflow definitions
  (confirmed on all three test-beds, including fork PRs that modify the workflow).
- PA04.1: a called reusable workflow's job that declares an Environment resolves the CALLER repository's Environment secret only when
  the caller passes the secret by name (`secrets: NAME: ${{ secrets.NAME }}`; the caller-side expression may be empty); `secrets:
  inherit` delivered empty across owners. Caller personal → callee on org-public and caller org → callee on personal both delivered
  (W1). Organization-to-different-organization is untested.
- PA04.2: a wrapper granting less than the called jobs request ends the run `startup_failure` with no job scheduled.
- PA04.4: `publish` with the design's `always()` condition ran after a mid-run cancellation.
- PA05.3: GitHub keeps one pending member per concurrency group; a newer member replaces the pending one even with
  `cancel-in-progress: false`.
- PA07: App-token writes trigger workflows (no recursion guard); write-to-run latency 1–4 s.
- PA09: run-name attribution (m1) confirmed: `display_title` of every listener run carried `author=<submission author id>` regardless of
  actor, including bot-sent events and a re-run attempt; `pull_requests` in the run list is empty for fork PRs (m3 unusable); a cap
  evaluation took 3 requests per listed workflow (created-today listing + in_progress + queued); rate limit 5000/h for job, App, and
  user tokens; run-list freshness 22 s after an App comment; the runs endpoint returns at most 1000 results per filtered search.
- Probe workflow run-name precedent (`probes/pa09-run-list-caps/workflows/probe-pa09-listen.yml`): `probe-pa09 ${{ github.event_name }}
  sub=${{ github.event.pull_request.number || github.event.issue.number }} author=${{ github.event.pull_request.user.id ||
  github.event.issue.user.id }}`.

### Test-beds, App, and settings (read 2026-09-27 with the local user token; read-only)

| Key | Repository | Visibility | Default branch | App installation id | Notes |
| --- | --- | --- | --- | --- | --- |
| org-public | steady-orchard/patch-steward-testbed-public | public | master | 162868612 | Actions enabled, allowed_actions all; Environments `probe-pa03-default-branch`, `probe-pa04-env`; repository secrets `STEWARD_APP_ID`, `STEWARD_APP_PRIVATE_KEY`; no `.github/patch-steward/`; branches master and `probe-pa0N-base*` |
| org-private | steady-orchard/patch-steward-testbed-private | private | master | 162868612 | Free-plan organization: rulesets refused (HTTP 403); Actions minutes limited (2000/month) |
| personal | jambolo/patch-steward-testbed-personal | public | master | 162875728 | installation permissions not readable from this machine |
| fork | jambolo/patch-steward-testbed-public | public | master | not installed | PR-head-only fixture; no workflow enabled there |

- Test App: `patch-steward-testbed`, App id 4993303, client id `Iv23lifZAsPAdNqwf2Pu`, bot user `patch-steward-testbed[bot]` id
  `331019482` (type Bot). Organization installation 162868612 (`repository_selection: selected`) permissions: `actions: write`,
  `checks: write`, `contents: write`, `issues: write`, `metadata: read`, `pull_requests: write`, `statuses: write`; no `workflows`
  permission (the App cannot write workflow files). These cover every M06 need (gate G7); NO App permission change is required.
- Test-bed probe secrets: repository secrets `STEWARD_APP_ID`, `STEWARD_APP_PRIVATE_KEY` on all three and variable
  `STEWARD_APP_CLIENT_ID` belong to the probe suite ONLY; they stay untouched and the product (workflows, templates, `packages/**`,
  `scenarios/**`) never reads or references them. The product's names are distinct (Q9 C, WF13): Environment `steward-publication`
  with Environment secrets `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY`. The pipeline never holds the private key and
  cannot copy it into an Environment (owner action OA1).
- Probe tooling reused: `probes/smoke/tools/deploy.sh` (SSH clone, one commit, push with 5 fetch-rebase retries, blob-id verification),
  `dispatch.sh` (nonce in run-name), `wait-run.sh`, `environment.sh` (DUMMY secrets only), `steady-state.sh` (disables `probe-*`
  workflows only). Probe safety rules (`probes/README.md` "Workflow safety rules") apply to every test-bed workflow this plan deploys.
- `steady-orchard/patch-steward` is public, Actions enabled, `allowed_actions: all`; public reusable workflows are callable from any
  repository.
- Existing live tests assume org-public has NO published policy: `packages/core/src/github/github.live.test.ts` test `live: test-bed has
  no published policy` (expects `policy-source.not-published`) and `packages/cli/src/steward-commands.live.test.ts` (expects
  `screen.policy-missing` for `--issue 29` without `--policy-file`). M06 publishes a policy on org-public master, so both change (I19).

### Delivered code M06 builds on (read at 6418129)

- `packages/core/src/pipeline/`: `gate.ts` (`runGate(GateInput)`: repository read and trusted-branch policy on the bootstrap budget,
  capture on the policy budget, contract, required-stage plan; `GateResult`), `handoff.ts` (`HANDOFF_VERSION = 1`, `PIPELINE_PHASES`,
  `validateHandoff`, `expectedNextHandoff`, early exits `contract-needs-changes`, `contract-inconclusive`), `sequence.ts`
  (`acceptGateHandoff`, `runPhaseSequence`, `PIPELINE_FAILURE_CODES`), `publish-phase.ts` (`localDecisionInput`, `publishLocalRun`),
  `screen.ts` (`screenSubmission`), `phases.ts`, `budget.ts` (`initialBudget`).
- `packages/core/src/evidence/`: `layout.ts` (`RUN_FILES` seven files, `runStorePath(type, number, runId, runAttempt)`,
  `runDirectoryName(runId, runAttempt)` = `<run_id>-<run_attempt>` for Actions ids, `metricsStorePath`, `recordTypeForPath`),
  `assemble.ts`, `redact-records.ts` (three redaction passes), `manifest.ts` (`manifest_version: 1`, schema enforces the seven required
  run files), `local-store.ts` (WR-rules, `EvidenceFs`), `publish.ts` (`publishRunEvidence` → `PublishedRun`), `verify.ts`
  (`verifyRunDirectory`, VR-rules), `metrics.ts`, `logs.ts`, `pretty-json.ts`, `report-input.ts`.
- `packages/core/src/github/`: `client.ts` (`createGitHubClient`; `GitHubFetchInit.method` is the literal `'GET'`;
  `https://api.github.com` only; `redirect: 'manual'`; bounded pages, retries, response bytes; `GITHUB_FAILURE_CODES` 17 codes mapped
  to causes), `reader.ts` (repository, issue, PR, PR files, open PRs for a commit, issue comment, directory entries, git tree, git blob,
  branch head), `budget.ts` (`githubBudgetForPolicy`, `githubBudgetForPreflight` = K19 20 requests/2 retries), `schemas.ts`.
- `packages/core/src/submission/`: `intake.ts` (`captureIssue`, `capturePullRequest`, live reads by number), `snapshot.ts`
  (`snapshotHash`; the title never enters the snapshot), `contract.ts` (`checkContract`), `default-checklist.ts`.
- `packages/core/src/records/`: `common.ts` (`recordRunIdSchema` = positive safe integer OR local id; `recordPositiveIntSchema` =
  `z.int().min(1)` (safe-integer range, so Actions run ids such as 36081628326 fit)), `run.ts` (`owned_check_id` nullable), `metrics-event.ts`
  (kinds incl. `maintainer-resolution` with payload `{ action_kind, dismissal_code }`, subject `run` or `submission`), `decision.ts`,
  `report.ts`, `submission.ts`.
- `packages/core/src/decision/`: `table.ts` (`decideOutcome`; row 1 `superseded` from freshness `snapshot-changed` or `newer-owner`;
  row 4 waiting `queued` from capacity `cap-reached`), `mapping.ts` (§10 rules, not used for writes), `stages.ts`.
- `packages/core/src/net/archive.ts` (`inspectZipArchive(bytes, maxDecompressedBytes)`: bounded zip inspection, no extraction),
  `net/address-policy.ts`, `net/https-transport.ts`.
- `packages/core/src/redaction/` (23 built-in detectors; `known-secret` exact values in three forms; K35 minimum 8), `vocabulary.ts`
  (`WAITING_STATES`, `FAILURE_CAUSES` 20, `MAINTAINER_ACTION_KINDS` incl. `resolution`), `clock.ts`, `version.ts` (`stewardVersion()`),
  `strict-yaml.ts`, `policy/bounds.ts` (K1–K37).
- `packages/core/src/conformance/`: `invariant-1`, `invariant-2`, `invariant-4` (215 titled cases), `invariant-5` (+fixture),
  `invariant-6`, `invariant-7`, `invariant-8`, `never-pass*`, `zero-execution.fixture` (import scan forbids specifiers containing
  `child_process`, `vm`, `worker_threads` (outside redaction), `llm`, `model`, `copilot`, `openai`, `anthropic`, `sandbox`,
  `container`, `docker`, `runner`).
- `packages/cli/`: unchanged by this milestone except the live test (I19).

### Plan-wide DoD items that apply (plan §0.3)

| §0.3 item | How it applies here |
| --- | --- |
| Build, type-check, tests, lint, format (Ubuntu and Windows) | Local Windows in the main tree; Ubuntu via `act` on an LF clone and by the `build` job running `pnpm build` on `ubuntu-latest` in every test-bed run. |
| Runtime validation; handled as data | New inputs: event payload file, runner environment variables, run-list items and `display_title`, artifact listings and downloaded `ownership.json`, same-run artifacts (handoff, closure), Git Data API responses, evidence snapshot reads, App token responses. None reaches a shell, a workflow expression, or an authorization decision; workflows pass no event text through `${{ }}` into `run:` (conformance WF-scan). |
| Injected failures never `pass` | invariant-4 gains gate and publish injections (event, token, policy, capture, listing, download, caps, upload, handoff, store commit, read-back, settle re-list, recapture); new failure-code unions join the never-pass tables. |
| Limits under hard bounds; redaction before persistence | K38–K51 (gate G9); `limits.github.*`, `limits.evidence.*`, `limits.caps.*` from policy; App private key and every minted installation token are exact-value redacted and masked (`::add-mask::`). |
| No decision input from authorship | Author id is used ONLY for the per-author concurrency cap count (a cost control, D3) and closure attribution (closed by author vs maintainer); never for an outcome, finding, or report text. Test proves outcome/report bytes invariant under author id changes. |
| Evidence and metrics per delivered step | Committed runs write a run directory (outcome or waiting) + metrics; supersession appends a record + metrics; closures append a metrics file; duplicates write nothing (no commitment) and appear only in the job summary (I8). |
| Fixture corpus grows | Event payloads (both wrappers, every action, fork PR, bot sender), recorded artifact listings (incl. ties, pagination), zip downloads, run lists, Git Data API responses (non-fast-forward 422, compare results), hostile display titles and payload text. |
| Decisions recorded governing document first | ADR-0071 onward (gate G11); architecture, processes, whitepaper §9–§14, README, CLAUDE.md, user manual; §15 loses the ownership item and clause. |
| Documentation describes only what was delivered | GitHub-hosted screening exists as an observe-mode, contract-level skeleton verified on test-beds only; installation stays Proposed (no `steward init`, adoption gate). |
| Invariant conformance | invariant-2 and invariant-8 extended at GitHub level; invariant-1 gains the workflow expression scan; invariant-4, -5, -7 extended. |

### Gate G1 — ownership record and artifact protocol (APPROVED; OW-rules)

- OW1 Artifact name: `steward-ownership-pr-<n>` or `steward-ownership-issue-<n>` (`<n>` decimal, no leading zero). One file
  `ownership.json` inside. Uploaded by the `gate` job with `actions/upload-artifact` (pinned by full SHA), `retention-days: 90`,
  `if-no-files-found: error`. Upload success is the commitment point; the gate job's output `committed` becomes `true` only in a step
  after a successful upload.
- OW2 Record (strict zod, `schema_version: 1`, `record_type: "ownership"`, canonical JSON ≤ K39), keys in this order of meaning:

```json
{
  "schema_version": 1,
  "record_type": "ownership",
  "repository": "steady-orchard/patch-steward-testbed-public",
  "subject": { "type": "pull_request", "number": 12 },
  "run_id": 36081628326,
  "run_attempt": 1,
  "check_id": null,
  "snapshot_hash": "sha256:<64 hex>",
  "policy_revision": "<40 or 64 hex git tree id>",
  "disposition": "runnable",
  "admission": "not-required",
  "cap": { "state": "within", "daily_count": 3, "daily_limit": 50, "author_count": 1, "author_limit": 2 },
  "event": { "name": "pull_request_target", "action": "edited", "object_id": 2345678901, "object_updated_at": "2026-09-28T10:00:00Z", "sender_id": 2095171, "sender_type": "User" },
  "author_id": 2095171,
  "created_at": "2026-09-28T10:00:05.123Z"
}
```

  - `subject.type`: `pull_request` or `issue`. `check_id`: always `null` in M06 (no checks; the repository gate is never active, I5).
  - `disposition`: `runnable` (contract met or uncertain and within caps), `early-exit` (contract `needs-changes` or `inconclusive`),
    `queued` (over a cap). `awaiting-approval` is NOT in the M06 enum (admission is M15); adding it later is an additive change.
  - `admission`: `not-required` only in M06.
  - `cap`: `null` for `early-exit` (caps are evaluated only for otherwise runnable work, I6); else `state` `within`, `daily-runs`, or
    `per-author-concurrent-runs` (first exceeded cap in that order) with the four counts.
  - `event`: the D4 event identity; `object_id`/`object_updated_at` are the PR's or issue's `id` and `updated_at` from the payload; the
    run id and attempt are the record's own `run_id`/`run_attempt`.
  - `created_at`: the gate's clock at record creation; INFORMATIONAL. Ordering always uses the API artifact `created_at` (OW4).
  - The record is validated after every download (invariant 5); an invalid record, a zip with other or extra entries, or a record whose
    repository, subject, or name does not match the artifact name is `ownership.record-invalid` (treated like an unavailable read).
- OW3 Listing: `GET /repos/{o}/{r}/actions/artifacts?name=<exact name>&per_page=100`, paginated up to K41 pages, App token
  (`actions: read`). Expired artifacts (`expired: true`) are ignored. Listing longer than K41 pages is INCOMPLETE.
- OW4 Newest owner: the unexpired artifact with the greatest API `created_at` (1-second resolution). Two or more artifacts sharing the
  greatest `created_at` = AMBIGUOUS. Artifact ids never order.
- OW5 Download: `GET /repos/{o}/{r}/actions/artifacts/{id}/zip` answers a redirect; follow exactly one redirect to an HTTPS URL whose
  host resolves to public addresses (reuse `net/address-policy.ts`), sending NO Authorization header; zip ≤ K40 bytes; exactly one entry
  named `ownership.json`, method stored or deflate, decompressed ≤ K39 (new bounded single-entry reader built on `node:zlib`).
- OW6 Effective retention: after upload, `gate` lists its own artifact and logs `retention_days = round((expires_at - created_at) / 1
  day)` in the job summary and the run log; publish copies it into `logs/steward.txt`. A value below 90 is a warning
  (`ownership.retention-short`), never a failure.
- OW7 Publish verification (SP13 step 4): after the evidence commit and read-back, wait K38, then re-list (OW3) and recapture the live
  snapshot: a newer artifact (greater `created_at` than this run's own artifact, or the same `created_at` from a different run or
  attempt) → `superseded` (reason `newer-owner`); live snapshot hash or policy revision differs from the ownership record →
  `superseded` (reason `snapshot-changed`); this run's own artifact missing, the listing incomplete, ambiguous at the top, or any read
  unavailable → publication FAILS (job fails, no supersession record, summary says freshness unknown). Never mistake unknown for a
  confirmed mismatch.
- OW8 Expired owner: when no unexpired artifact exists, deduplication falls back to the latest published evidence snapshot (ES10).

### Gate G2 — events, event identity, deduplication, echoes (APPROVED; EV- and DD-rules)

- EV1 Accepted events (wrapper `on:` filters; everything else never starts a run):
  - `steward-pr.yml`: `pull_request_target` types `opened`, `synchronize`, `edited`, `reopened`, `ready_for_review`, `closed`. (The
    `workflow_run` relay trigger is M19.)
  - `steward-issues.yml`: `issues` types `opened`, `edited`, `reopened`, `closed`, `deleted`. (`issue_comment` is M15/M16.)
- EV2 Authentication before any token is minted: the payload file (`GITHUB_EVENT_PATH`, ≤ K43 bytes) parses and validates against a
  strict-enough zod subset (unknown keys allowed, required keys typed); `GITHUB_EVENT_NAME` matches the wrapper; payload
  `repository.full_name` and `id` equal `GITHUB_REPOSITORY` and `GITHUB_REPOSITORY_ID`; `GITHUB_REF` equals
  `refs/heads/<repository.default_branch>`; `GITHUB_SERVER_URL` is `https://github.com` and `GITHUB_API_URL` `https://api.github.com`;
  `issues` events whose issue carries `pull_request` are rejected. Failure: gate fails `gate.event-invalid`, no token minted, nothing
  committed.
- EV3 Dispositions (gate output `disposition`): `runnable`, `early-exit`, `queued` (committed); `duplicate` (not committed; publish
  skipped); `closure` (not committed; record-only publish, gate G5/G6).
- DD1 `GITHUB_RUN_ATTEMPT > 1` → explicit rerun → capture live and commit a new owner (replaces), whatever the snapshot.
- DD2 Action `reopened` → rescreen: commit a new owner whatever the snapshot (SP03 step 2 "Reopening restarts screening"; SP19 step 3).
- DD3 Otherwise: newest committed owner (OW4) exists and is unambiguous, listing complete, its record valid, and its `snapshot_hash` and
  `policy_revision` equal the freshly captured ones → `duplicate`: no upload, no cancel, no cap evaluation, no evidence; job summary
  names the kept owner (run id, attempt).
- DD4 No unexpired owner artifact → fallback ES10: the latest published run's snapshot hash and policy revision equal → `duplicate`;
  otherwise continue.
- DD5 Newest owner ambiguous (tie) or listing incomplete in `gate` → continue to commit (the new artifact becomes the unique newest; a
  tie cannot authorize publication but must not block a replacement). Recorded in the run log.
- DD6 Listing, download, or record read UNAVAILABLE (API failure, invalid record) in `gate` → gate fails before commitment
  (`ownership.listing-unavailable` or `ownership.record-invalid`); nothing is superseded.
- DD7 Echo rule: an event whose `sender.id` equals this installation's bot user id AND whose triggering resource id is in the newest
  owner's recorded publication receipts is dropped before capture (`duplicate`, reason `echo`). M06 records no publication receipts
  (observe mode writes nothing on submissions), so the recorded set is always empty and bot-sent events fall through to DD3; the rule is
  implemented and unit-tested with synthetic receipts. The bot user id is looked up once per job (`GET /app` with the App JWT, then
  `GET /users/<slug>[bot]`), bounded by the bootstrap budget.
- DD8 Order in `gate`: EV2 → mint tokens (G7) → load trusted policy (GitHub API, default branch) → repository-gate check (I5) → closure
  branch (EV4) → capture live (M04 `captureIssue`/`capturePullRequest`) → snapshot hash → echo (DD7) → ownership listing/dedup
  (DD1–DD6) → contract check → caps (G3, only for otherwise runnable) → write `ownership.json` and the gate handoff → outputs.
- EV4 Closure (`closed`; issue `deleted`): no capture of a new snapshot and no ownership commitment. Gate assembles one
  `maintainer-resolution` metrics event (gate G5 RS-rules) paired with the newest committed owner (run id, attempt, snapshot hash) or
  `null` when none, uploads it as same-run artifact `steward-closure`, outputs `disposition=closure`, `record_only=true`. A closure
  never supersedes an owner and never cancels work.

### Gate G3 — caps from the tagged run list (APPROVED; RN- and CP-rules)

- RN1 Wrapper `run-name` (only numeric ids and platform enums; no titles, bodies, logins, or refs):
  - `steward-pr.yml`: `steward pr ${{ github.event.pull_request.number }} author ${{ github.event.pull_request.user.id }} event ${{
    github.event_name }} ${{ github.event.action }} sender ${{ github.event.sender.id }} ${{ github.event.sender.type }}`
  - `steward-issues.yml`: the same with `issue`, `github.event.issue.number`, `github.event.issue.user.id`.
  - Grammar (parser, ≤ K44 chars): `^steward (pr|issue) ([1-9][0-9]{0,9}) author ([1-9][0-9]{0,19}) event ([a-z_]{1,64})
    ([a-z_]{1,64}) sender ([1-9][0-9]{0,19}) (User|Bot|Organization|Mannequin)$`.
  - Approved addition beyond D3 (Q4 A): `sender <id>` is included next to sender type, because "runs sent by this installation's App bot"
    needs the bot's id (type `Bot` alone also matches other bots such as dependabot).
- CP1 Source: `GET /repos/{o}/{r}/actions/runs?created=>=<today UTC date>&per_page=100` (paginated ≤ K42 pages), plus
  `?status=in_progress` and `?status=queued` (each ≤ K42 pages): 3 requests when each listing fits one page. App token (`actions: read`).
- CP2 A run counts only when its `path` is `.github/workflows/steward-pr.yml` or `.github/workflows/steward-issues.yml` AND its `event` is
  one the wrappers accept (`pull_request_target`, `issues`); a PR cannot create such runs from its own definitions (PA03), so forged
  run-names from `pull_request` runs are excluded.
- CP3 Daily count: counted runs created on the current UTC date whose `display_title` does NOT parse with sender id = this
  installation's bot id (unparseable titles COUNT: cost-safe), this run included. Queued when count > `limits.caps.daily_runs`.
- CP4 Per-author count: counted runs with status `queued` or `in_progress` whose `display_title` parses with author id = this
  submission's author id, this run included. Queued when count > `limits.caps.per_author_concurrent_runs`.
- CP5 Duplicates, closures, and early exits appear in the run list and are counted by other gates (approximate overcount, documented).
  "No cap debit" for a duplicate (D4) is implemented as: no cap evaluation, no queueing, and no work for the duplicate itself (Q4 A).
- CP6 Any run-list read failure or a listing over K42 pages → gate fails before commitment (`caps.run-list-unavailable`); never an
  under-count.
- CP7 A total over the API's 1000-result ceiling is treated as over the daily cap (hard maximum of `daily_runs` is 1000).

### Gate G4 — evidence store commit protocol (APPROVED; ES-rules)

- ES1 Store: `evidence.store` of the trusted policy. `orphan-branch` → repository = target, ref `refs/heads/<branch>`;
  `repository` → repository = `evidence.store.repository`, ref `refs/heads/<branch>`. Every store path is prefixed `<owner>/<repo>/` of
  the TARGET (API `full_name`), so both stores hold the same subtree (architecture §11). Template value of `evidence.store.branch`
  changes from `patch-steward-evidence` to `steward-evidence` (D2; also in `default-checklist.ts`; fixture policies keep their value,
  both are valid).
- ES2 Tip read: `GET /repos/{s}/git/ref/heads/<branch>`. 404 → branch absent → the first commit is a root commit (no parents) created with
  `POST /repos/{s}/git/refs` (`ref: refs/heads/<branch>`); a 422 "Reference already exists" is a non-fast-forward (ES5). A store
  repository must already contain at least one commit (the Git database API refuses an empty repository; OA2).
- ES3 Build: the M05 file set (run directory files + metrics file, bytes exactly as the local store would write them, same manifest)
  → `POST /git/blobs` per file (base64) → `POST /git/trees` with `base_tree` = tip tree and one entry per new path (mode `100644`, type
  `blob`) → `POST /git/commits` (message `evidence: <owner>/<repo> <pr|issue>-<n> run <run-dir>`; no submission text; parents [tip] or
  [] for the root commit).
- ES4 Append-only pre-update check: `GET /repos/{s}/compare/<tip>...<new commit>` must report `status: ahead`, `ahead_by: 1`, and every
  file `status: added` with exactly the expected path set; else fail `evidence.store-not-append-only` (no ref update).
- ES5 Update: `PATCH /repos/{s}/git/refs/heads/<branch>` with `force: false`. HTTP 422 non-fast-forward → re-read the tip and rebuild the
  tree and commit on it (blobs reused), then ES4 again; at most `limits.evidence.write_retries` rebuilds, waiting K45 between attempts;
  exhausted → `evidence.store-conflict` (write failed).
- ES6 Read-back before any other publication step: the branch tip equals the new commit or `compare/<new>...<tip>` reports `ahead` or
  `identical`; the committed tree at the run path lists exactly the expected entries whose blob ids equal the locally computed git blob
  ids (`sha1("blob " + byteLength + "\0" + bytes)`, `node:crypto`), so no blob is downloaded. Mismatch → `evidence.readback-mismatch`.
- ES7 Size and count: total bytes ≤ `limits.evidence.run_bytes`; files ≤ K36 + 2; every request counted against the run's
  `limits.github.requests_per_run` budget (remaining from the handoff) with `limits.github.retries_per_request` for transient failures.
- ES8 Tokens: the store token is minted for the store repository only with `contents: write` (G7); for `orphan-branch` that is the target
  repository (inherent: the App's `contents: write` there cannot write workflow files because the App has no `workflows` permission).
- ES9 A failed evidence write fails the publish job: no job summary outcome, no supersession record, nothing else (SP18 failure handling).
- ES10 Gate fallback read (OW8, DD4): `GET /repos/{s}/contents/<owner>/<repo>/runs/<pr|issue>-<n>?ref=<branch>` (directory listing ≤
  K46 entries; 404 = no published run); latest = greatest `(run_id, run_attempt)` numerically among names `<digits>-<digits>`; then read
  that run's `run.json` (≤ K46 bytes, validated with `runRecordSchema` from `packages/core/src/records/run.ts`; `subject.kind` must be
  `submission` with `repository`, `type`, `number` equal to the event's) and use its `subject.snapshot_hash` and `policy_revision`.
  (`submission.json` carries `snapshot_hash` but no policy revision, so it is never the fallback source.) Any other failure, including a
  schema or subject mismatch → treated as unavailable (DD6).

### Gate G5 — evidence layout additions and records (APPROVED; EL-, WS-, SS-, RS-rules)

- EL1 Outcome runs (`runnable`, `early-exit`): unchanged M05 run directory at `runs/<pr|issue>-<n>/<run_id>-<run_attempt>/`, metrics at
  `metrics/<YYYY-MM>/<run_id>-<run_attempt>.json`. Report evidence locations become code spans of
  `https://github.com/<store owner>/<store repo>/tree/<branch>/<owner>/<repo>/<store path>`; no local-run notice (T1 runs are not local
  runs); M05 golden reports (local runs) stay unchanged.
- EL2 Waiting runs (`queued`): run directory with `run.json`, `submission.json`, `policy-revision.json`, `waiting.json`, `logs/steward.txt`,
  `manifest.json`; NO decision, report, or findings. Manifest gains an OPTIONAL key `run_kind` (`outcome` or `waiting`; absent means
  `outcome`, so every existing manifest stays valid; `manifest_version` stays 1); required files follow `run_kind`. Metrics:
  state-transition `null` → `queued`, latency events, cost event.
- WS1 `waiting.json` record (`record_type: "waiting"`, `schema_version: 1`): `run_id`, `run_attempt`, `subject` {repository, type,
  number}, `state` (`queued`), `reason` (`daily-runs` or `per-author-concurrent-runs`), `counts` {daily_count, daily_limit,
  author_count, author_limit}, `snapshot_hash`, `policy_revision`, `arrival_at` (this run's ownership artifact API `created_at`),
  `recorded_at`. It is the restart record: maintenance (M13) restarts in `arrival_at` order.
- SS1 Supersession (SP18 step 6): a SECOND commit after a confirmed mismatch (OW7) adds `runs/<pr|issue>-<n>/supersessions/<run-dir>.json`
  (`record_type: "supersession"`, `schema_version: 1`: `run_id`, `run_attempt`, `subject`, `reason` (`newer-owner` or
  `snapshot-changed`), `successor` {run_id, run_attempt, artifact_created_at} or null, `recorded_snapshot_hash`, `live_snapshot_hash`
  or null, `recorded_at`) and `metrics/<YYYY-MM>/<run-dir>-supersession.json` (one state-transition `<outcome or waiting state>` →
  `superseded`). The original run directory is never modified.
- RS1 Closure: record-only publish commits ONE file `metrics/<YYYY-MM>/<run_id>-<run_attempt>.json` holding one `maintainer-resolution`
  event (subject kind `submission`) and no run directory, no manifest; ES6 read-back verifies its blob id.
- RS2 `maintainer-resolution` payload gains OPTIONAL keys (additive, version 1): `resolution` (`merged`, `closed-by-author`,
  `closed-by-maintainer`, `deleted`), `paired_run` {run_id, run_attempt} or null, `paired_snapshot_hash` or null. `action_kind`
  `resolution`, `dismissal_code` null (coded resolutions are `/steward resolve`, M15). Attribution: PR `merged: true` → `merged`; else
  sender id = author id → `closed-by-author`; else `closed-by-maintainer`; issues `deleted` → `deleted` (approved extension of SP03 step 2, Q6 A,
  which lists no deletion).
- EL3 Architecture §9 record types gain `ownership`, `waiting`, `supersession` (version 1).

### Gate G6 — workflow structure (APPROVED; WF-rules)

- WF1 Reusable workflow: `.github/workflows/steward-screening.yml` in this repository, `on: workflow_call` only, inputs `steward_ref`
  (string, required: the same 40-hex SHA the caller pins; WF8), secrets `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY` (both
  `required: false`, delivered from the caller's Environment, PA04.1). No other trigger, so it never runs in this repository.
- WF2 Jobs (M06): `build` → `gate` → `publish`. NO `intake`, `execute`, `assess` jobs yet (they arrive with M13's job table); `publish`
  applies the M05 decision to the gate handoff, so a runnable run ends `inconclusive` with `stage-incomplete` exactly as the local
  runner's pass-throughs do (Q7 A).
- WF3 Permissions: workflow-level `permissions: {}`; every job `permissions: {}` (job tokens need nothing: the steward repository is
  public, same-run artifacts use the runtime token, every GitHub API call uses a scoped App token). Wrappers grant `permissions: {}` too
  (equal to the jobs' requests, ADR-0027).
- WF4 Environment: only `gate` and `publish` declare `environment: steward-publication`; only their steps reference
  `secrets.PATCH_STEWARD_APP_ID`/`secrets.PATCH_STEWARD_APP_PRIVATE_KEY`, and only as `env:` of the one step that runs the core, under
  the identical environment variable names `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY` (the names the action reads);
  `build` declares none and references no secret. No product file references `STEWARD_APP_ID`, `STEWARD_APP_PRIVATE_KEY`, or
  `STEWARD_APP_CLIENT_ID` (the probe names).
- WF5 Publish condition: `if: ${{ always() && needs.gate.result == 'success' && (needs.gate.outputs.committed == 'true' ||
  needs.gate.outputs.record_only == 'true') }}` (the architecture §6.4 condition extended for closures; Q8 A).
- WF6 Concurrency: only `publish` has job-level `concurrency: { group: ${{ needs.gate.outputs.concurrency_group }}, cancel-in-progress:
  false }`; the group string is built by the core as `steward-<repository id>-<pr|issue>-<n>` (digits and fixed words only). No
  workflow-level concurrency. A pending publish replaced by a newer committed run's publish (PA05.3) leaves that run without evidence;
  the newer owner supersedes it anyway (I11).
- WF7 Handoffs: `gate` uploads same-run artifacts `steward-handoff` (M05 handoff record, ≤ K37) and, for closures, `steward-closure`,
  each `retention-days: 1`, BEFORE the ownership upload; `publish` downloads them by name from this run and verifies schema, run id,
  attempt (I12), snapshot hash, and policy revision against its own ownership record and the gate outputs.
- WF8 Steward code: every job checks out `steady-orchard/patch-steward` at `inputs.steward_ref` (full 40-hex SHA; the core rejects any
  other form) into `steward/`, with `persist-credentials: false`. The wrapper's `uses:` pin and its `steward_ref` input are equal (static
  test on templates; deploy check on test-beds). (Q11 A approved; the runner-context alternative is rejected.)
- WF9 Pins: every `uses:` in the reusable workflow and wrappers is `owner/repo[/path]@<40 hex>` with a trailing comment naming the
  tag; only `actions/*` actions (`checkout`, `setup-node`, `upload-artifact`, `download-artifact`). No `pnpm/action-setup` (pnpm through
  corepack, M4). No `actions/cache`.
- WF10 Outputs of `gate` (all core-validated, single-line, no event text): `committed`, `record_only`, `disposition`, `concurrency_group`,
  `snapshot_hash`, `policy_revision`, `runtime_sha256` passthrough is from `build` only.
- WF11 Job summaries: `gate` and `publish` append bounded Markdown (≤ K47) to `GITHUB_STEP_SUMMARY`: submission, disposition or outcome,
  snapshot hash, policy revision, owner kept or committed, cap counts, evidence commit and store location, failure code on failure; all
  derived values as code spans via the M05 escaper; no title, body, login, or report text. The publish summary is written only AFTER
  the evidence commit and read-back (exit criterion "evidence first").
- WF12 Wrapper templates: `templates/workflows/steward-pr.yml` and `templates/workflows/steward-issues.yml` (Prettier-clean YAML):
  `name`, `run-name` (RN1), `on` (EV1), `permissions: {}`, one job `screen` with `uses:
  steady-orchard/patch-steward/.github/workflows/steward-screening.yml@<40 hex>`, `with: { steward_ref: <same 40 hex> }`, `secrets:`
  mapping exactly `PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}` and
  `PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}`
  (never `inherit`), `permissions: {}`. The template pin is the placeholder `0000000000000000000000000000000000000000` (a later `steward
  init` substitutes the release SHA). Test-bed copies substitute the pushed milestone commit and ADD a test-bed-only guard on the `screen`
  job: `if: ${{ github.event.sender.id == 2095171 || github.event.sender.id == <bot id> }}` (probe safety rule: public test-beds accept
  events from anyone); the guard is not part of the template.
- WF13 Names (Q9 C, distinct names): publication Environment `steward-publication` (deployment branch policy: the default branch
  only); Environment secrets `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY`, set ONLY as Environment secrets, never as
  repository or organization secrets. The probe suite's repository secrets `STEWARD_APP_ID`, `STEWARD_APP_PRIVATE_KEY` and variable
  `STEWARD_APP_CLIENT_ID` stay on the test-beds untouched; the product never reads them. Because no repository secret named
  `PATCH_STEWARD_APP_*` exists, the wrapper's caller-side expressions evaluate empty and only the Environment-declaring jobs resolve
  the values (PA04.1 mechanism). Proof: statically by the WF4 tests, live by scenario S17 (a job that does not declare the
  Environment receives both secrets empty; I21).
- WF14 Job timeouts (hard, in YAML): `build` 15 min, `gate` 10 min, `publish` 20 min; `runs-on: ubuntu-latest`.

### Gate G7 — App tokens (APPROVED; AT-rules)

- AT1 The core mints tokens itself: RS256 JWT with `node:crypto` (`iat` = now − 60 s, `exp` = `iat` + K49), `GET
  /repos/{o}/{r}/installation` for the installation id, `POST /app/installations/{id}/access_tokens` with explicit `repositories` and
  `permissions`, `DELETE /installation/token` in a `finally` path. (Q10 A approved; `actions/create-github-app-token` is rejected.)
  The private key and App id are read from environment variables `PATCH_STEWARD_APP_PRIVATE_KEY` and `PATCH_STEWARD_APP_ID` (WF4).
- AT2 Scopes (each token names exactly its repositories):
  - `gate` target token: target repository; `actions: read`, `contents: read`, `issues: read`, `pull_requests: read` (metadata read is
    implicit). Gate never writes through the API (its only write is the artifact upload, which uses the runner's runtime token).
  - `gate` store-read token (only when the store is a separate repository and DD4 needs it): store repository; `contents: read`.
  - `publish` target token: target repository; `actions: read`, `contents: read`, `issues: read`, `pull_requests: read`.
  - `publish` store token: store repository; `contents: write` (for `orphan-branch` the store is the target, and the two scopes merge
    into one token with `contents: write` plus the reads).
  - A store repository under another account uses that account's installation (looked up per repository).
- AT3 The private key and every minted token are registered as exact-value secrets for redaction (M05 EX-rules) and masked with
  `::add-mask::<value>` before any other output; tokens are never written to files, outputs, artifacts, or logs, and never passed
  between jobs.
- AT4 Tokens and the JWT count against the bootstrap budget (K19) before the policy is loaded.

### Gate G8 — runtime build: consequences and mitigations (APPROVED; D5 stays: build at runtime)

Consequences of D5 (stated as required): (C1) every run installs dependencies from the npm registry and compiles TypeScript on the
runner before the steward runs, adding about 1–2 minutes of billed Actions time per job that builds and a registry-availability
dependency; (C2) if the jobs that hold the App private key also run `pnpm install`, any install-time code of any dependency or dev
dependency (typescript, vitest, eslint, prettier, and their transitive packages) executes in a job whose environment will later hold the
key and in the same filesystem the core then runs from; (C3) the executed code equals the pinned commit plus the lockfile's resolved
packages, so the pin still fixes the steward version, but package tarballs are fetched at run time.

Mitigations (all approved, Q12 A; binding):

- M1 Credential-free `build` job: only `build` checks out, installs, and compiles; it produces a runtime directory (`packages/core/dist`,
  `packages/action/dist`, their `package.json` files, and production dependencies only: `zod`, `yaml`, the core workspace link),
  archived (tar, ≤ K50) and uploaded as same-run artifact `steward-runtime`; its SHA-256 is a `build` job output. `gate` and `publish`
  download it by name, verify the SHA-256 against `needs.build.outputs.runtime_sha256` BEFORE extraction, extract, and run `node
  <runtime>/packages/action/dist/main.js <gate|publish>`; they run no install and no build.
- M2 `pnpm install --frozen-lockfile --ignore-scripts` in `build` (pnpm 10 already skips dependency lifecycle scripts not allowlisted;
  this also skips workspace scripts; the build is invoked explicitly).
- M3 Lockfile integrity: `--frozen-lockfile` fails on any drift; the lockfile's `integrity` hashes are verified by pnpm; no
  `pnpm-lock.yaml` edit in any job.
- M4 Node 24 via `actions/setup-node` pinned by SHA with `node-version: 24`; pnpm via `corepack enable` and the root `packageManager`
  pin (no third-party setup action); no dependency cache.
- M5 Every action pinned by full SHA (WF9); `persist-credentials: false` on checkout; job `permissions: {}`.
- M6 The App key appears only in the `env:` of the single core step of `gate` and `publish`; `build` holds no secret and no token.
- M7 `timeout-minutes` on every job (WF14).
- M8 A static test asserts M1–M7 on the reusable workflow text.

### Gate G9 — hard-only constants (APPROVED; continue K1–K37; listed in architecture §12.1 when delivered)

| Row | Constant | Value | Basis |
| --- | --- | --- | --- |
| K38 | Ownership settle delay before publish re-lists | 10000 ms | PA02.5 max visibility 2 s; 5x margin |
| K39 | Ownership record maximum (canonical JSON) | 16384 bytes | record is about 700 bytes |
| K40 | Ownership artifact download maximum (zip) | 65536 bytes; exactly 1 entry | one small JSON file |
| K41 | Ownership artifact listing pages per submission | 10 pages of 100 | 1000 unexpired artifacts per name in 90 days; more is incomplete |
| K42 | Run-list pages per cap query | 10 pages of 100 | API returns at most 1000 results per filtered search (PA09 E4) |
| K43 | Event payload file maximum | 26214400 bytes | GitHub webhook payload cap 25 MB |
| K44 | Run display title parsed | 1024 characters | run-name grammar is under 200 |
| K45 | Evidence non-fast-forward wait | 1000 ms x attempt number, at most 10000 ms | bounded backoff; attempts come from `limits.evidence.write_retries` (1–10) |
| K46 | Gate evidence fallback read | directory listing 1000 entries; 1 file of at most 1048576 bytes | contents API directory limit |
| K47 | Job summary per job | 65536 characters | GitHub step summary limit 1 MiB |
| K48 | Ownership artifact retention requested | 90 days | PA02.6 platform cap |
| K49 | App JWT lifetime | 540 s (issued 60 s in the past) | GitHub maximum 600 s |
| K50 | Runtime archive maximum | 52428800 bytes | dist plus production dependencies are a few MB |
| K51 | Same-run artifact retention (handoff, closure, runtime) | 1 day | needed only within the run |

No new policy key. `limits.caps.*`, `limits.evidence.*`, `limits.github.*` keep their M03 bounds.

### Gate G10 — test-bed scenario suite (APPROVED; SC-rules and scenarios)

- SC1 Location: new top-level directory `scenarios/` (persistent: no planning ids; not a workspace package; never runs in CI; Prettier-
  checked): `scenarios/README.md` (procedure per scenario, safety rules, budgets), `scenarios/tools/*.sh` (bash + `gh`; reuse
  `probes/smoke/tools/deploy.sh`, `dispatch.sh`, `wait-run.sh` by path), `scenarios/workflows/scenario-*.yml` (test-bed helper
  workflows, e.g. an App-token title edit for the echo case, `workflow_dispatch` only, allowlisted sender, nonce in run-name; plus the
  S17 pair `scenario-secret-scope.yml` and `scenario-secret-scope-called.yml`, SC5),
  `scenarios/fixtures/` (test-bed policies, submission bodies), `scenarios/results/<testbed-key>.md` (verbatim evidence in `text`
  fences, like probe results). Scenario fixtures on test-beds: issue/PR titles start `[scenario S<nn>]`, branches `scenario-s<nn>-*`.
  (Q14 A approved; placement under `probes/` is rejected.)
- SC2 Test-bed setup: deploy the two wrappers (WF12 test-bed copies) and a valid all-observe policy (no `llm` section;
  `evidence.store` orphan-branch `steward-evidence` on org-public and personal, repository store on org-private) to each test-bed's
  `master` with `deploy.sh`; runnable-path scenarios use contract-met bodies (derived from `fixtures/submissions/`) under a scenario
  policy whose category requirements they satisfy.
- SC3 Steady state after the scenario phase: `steward-pr.yml`, `steward-issues.yml`, and `scenario-*.yml` disabled on every test-bed
  (`gh workflow disable`; `scenario-secret-scope-called.yml` has no trigger of its own and may read `active` if the API does not
  disable it); no open `[scenario` issue or PR; evidence branches, the evidence repository, the policy, and the Environment
  stay (listed in `scenarios/README.md`).
- SC4 Budgets: poll no more often than every 20 s; bounded waits (15 min per run); stop if core rate limit remaining < 500; org-private at
  most 30 billed Actions minutes for M06; never delete repositories or issues; never print secrets.
- SC5 Secret-scope helper pair (S17; I21). Both files are Prettier-clean, pinned and guarded like every scenario workflow, and deployed
  with `deploy.sh` to each test-bed's `master`:
  - `scenarios/workflows/scenario-secret-scope-called.yml`: `on: workflow_call` only, declaring secrets `PATCH_STEWARD_APP_ID` and
    `PATCH_STEWARD_APP_PRIVATE_KEY` exactly as `steward-screening.yml` does (both `required: false`); workflow and jobs
    `permissions: {}`; no checkout, no install, no action. Job `outside` declares NO `environment:`; job `inside` declares
    `environment: steward-publication`. Each job has one `run:` step whose step-level `env:` maps both secrets, and whose script
    prints only `PATCH_STEWARD_APP_ID length-zero=<true or false>` and `PATCH_STEWARD_APP_PRIVATE_KEY length-zero=<true or false>`
    (from `${#VAR}`; never the value, never the length number, never a prefix or hash) and exits 0.
  - `scenarios/workflows/scenario-secret-scope.yml`: `on: workflow_dispatch` only; run-name carries the `dispatch.sh` nonce;
    `permissions: {}`; one job `call` guarded `if: ${{ github.event.sender.id == 2095171 }}` with
    `uses: ./.github/workflows/scenario-secret-scope-called.yml` and a `secrets:` block byte-identical to the WF12 wrapper mapping
    (`PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}`, `PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}`;
    never `inherit`). The scenario tool checks that byte identity against `templates/workflows/steward-pr.yml` before dispatching.

| Scenario | Test-bed | Procedure (summary) | Pass condition | Exit criterion |
| --- | --- | --- | --- | --- |
| S01 | org-public | open an unstructured PR; wait | one ownership artifact; one run directory with outcome `needs-changes`; publish summary after evidence | baseline |
| S02 | org-public | edit S01 PR title only | run disposition `duplicate`; artifact count unchanged; no new run directory | title-only keeps owner |
| S03 | org-public | App-token title edit via helper workflow (sender = bot) | disposition `duplicate`; nothing committed | unchanged echo keeps owner |
| S04 | org-public | edit the PR body twice within about 5 s | newer run commits and publishes an outcome; older run has a supersession record (`newer-owner` or `snapshot-changed`); retried up to 3 times until the overlap occurs | body edit commits new owner; older ends superseded |
| S05 | org-public | three body edits in quick succession | exactly one non-superseded outcome for the newest owner; every other committed run superseded or its publish cancelled pending; every evidence-branch commit since S01 is additions only (`compare` per commit) | concurrent events; append-only |
| S06 | org-public | deploy an invalid policy to master, edit a body, restore the policy | gate fails before commitment; artifact listing unchanged; previous newest owner still newest; no evidence for that run | failure before commitment supersedes nothing; failed gate publishes nothing |
| S07 | org-public | point `evidence.store` at a repository the App cannot write, edit a body, restore | gate commits; publish fails at the evidence write; no run directory; no summary outcome | failed publish publishes nothing |
| S08 | org-public | inspect S01/S04 publish logs | timestamp of the evidence commit read-back precedes the job summary write | evidence first |
| S09 | org-public | same-repo PR and fork PR (from `jambolo/patch-steward-testbed-public`) that modify `.github/workflows/steward-pr.yml` and `.github/patch-steward/policy.yml` | runs used master's workflow file; run record `policy_revision` equals master's tree id; findings include `submission.policy-change` and `submission.trusted-path-change` | PR editing wrappers/policy screened under default-branch definitions and trusted policy |
| S10 | org-public | open, title-edit, body-edit, close, reopen an issue; open and close a PR by the author; merge a scenario PR into a `scenario-*` base branch | issue body edit commits; reopen commits (DD2); closures produce metrics-only commits with `merged`, `closed-by-author`, `closed-by-maintainer` as applicable | closures; own-input rescreens |
| S11 | org-public | scenario policy with `daily_runs: 1` then `per_author_concurrent_runs: 1`; open contract-met submissions | over-cap run disposition `queued`; waiting run directory with `waiting.json`; restore policy | caps and waiting states |
| S12 | org-public | re-run a completed run (`gh run rerun`) | new attempt commits a new owner (newest `created_at`) | explicit rerun replaces |
| S13 | all | audit every scenario submission | App-authored comments 0, labels 0, App check runs on head SHAs 0, requested reviewers 0, no deployment status on the PR | observe writes nothing |
| S14 | all | static: fetch deployed wrappers and the pinned reusable workflow | only `gate`/`publish` declare `steward-publication` and only they reference `secrets.PATCH_STEWARD_APP_ID`/`secrets.PATCH_STEWARD_APP_PRIVATE_KEY`; no deployed product file (wrappers, pinned reusable workflow) contains `STEWARD_APP_ID`, `STEWARD_APP_PRIVATE_KEY`, or `STEWARD_APP_CLIENT_ID` other than as part of `PATCH_STEWARD_APP_*`; every `uses:` pinned by 40-hex SHA reachable on origin; `steward_ref` equals the pin | Only gate and publish reference the publication Environment; wrappers and action pinned by immutable SHA |
| S15 | personal | one contract-met issue | outcome run directory on `steward-evidence` of the personal test-bed; secrets arrived through the explicit mapping (gate minted a token) | cross-owner smoke |
| S16 | org-private | one contract-met issue | run directory committed to the private evidence repository (OA2), none in the target | separate repository store smoke |
| S17 | all | verify OA1 on the test-bed; deploy the SC5 pair; `dispatch.sh` `scenario-secret-scope.yml`; wait; read both job logs | job `outside` (no Environment) logs `PATCH_STEWARD_APP_ID length-zero=true` and `PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true`; job `inside` (`steward-publication`) logs both `length-zero=false`; no secret value, length number, or `-----BEGIN` in either log; result file records the two log lines verbatim | Only gate and publish reference the publication Environment (live proof of Environment-only delivery) |

"An ambiguous or unavailable ownership or snapshot read fails publication" cannot be forced live without platform manipulation: it is
proved at fixture tier with recorded responses (ties, pagination beyond K41, 5xx, invalid zip, recapture failure), I16.

### Gate G11 — ADR inventory and documentation stance (APPROVED)

ADRs (MADR; `Status: accepted`; `Date` = `2026-09-27` (gate approval date); `Deciders: project owner`; `Source` = governing location; no planning ids;
More Information "The project owner decided this on <date>."):

| ADR | Title | Records |
| --- | --- | --- |
| ADR-0071 | Ownership record and artifact protocol | D1, G1, K38–K41, K48 |
| ADR-0072 | Snapshot-based deduplication and event identity | D4, G2 (DD, EV, echo rule, reopen) |
| ADR-0073 | Approximate caps from a tagged run list | D3, G3, K42, K44 |
| ADR-0074 | Evidence store commits through the Git Data API | D2, G4, K45, K46, template branch name |
| ADR-0075 | Waiting, supersession, and closure records | G5 |
| ADR-0076 | Reusable screening workflow, publication Environment, and App tokens | G6, G7, K47, K49, K51; names `steward-publication`, `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY` as Environment-only secrets (distinct from any other workflow's secret names) |
| ADR-0077 | Steward built at runtime inside jobs | D5, G8, K50; ADR-0011's status becomes `superseded by ADR-0077` (ADR-0077 restates its unchanged parts: npm CLI, `steward init`, reusable workflows from this repository) |
| ADR-0078 | Test-bed scenario suite | G10 SC-rules incl. SC5 and the live Environment-only delivery check |

`docs/adr/README.md` Records table 70 → 78 rows; ADR-0011 row status updated; no other existing record changes.

Documentation stance: GitHub-hosted screening is described as a delivered observe-mode, contract-level skeleton (jobs `build`, `gate`,
`publish`; ownership, caps, evidence store, waiting and supersession records, closures) verified on dedicated test-beds only; nothing
is described as installable (no `steward init`, no release); `installation.md` target-repository installation stays Proposed; the
configuration manual's callout drops App-secret and Environment names (settled) and keeps the rest.

Documentation change inventory (governing document first; persistence and deferred rules apply):

- `docs/architecture.md`: Status; §6.1 layout (action package: runs the core inside jobs from a runtime built by the credential-free
  `build` job; `scenarios/`); §6.2 Ownership row (implemented, observe, no checks), Evidence row; §6.3 GitHub row (writes: Git Data API
  evidence commits only; artifacts listing/download; run list; App token minting), Evidence store row (branch and repository stores
  implemented), Clock and ids row (Actions run ids); §6.4 (reusable workflow name and jobs, publication Environment
  `steward-publication` and its Environment-only secrets `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY`,
  publish condition with record-only runs, concurrency group key, ownership record, dedup and event identity, settle delay, runtime
  build, test-bed guard not part of templates); §6.7 (wrapper template paths); §7 rows (Artifacts, Actions runs API run-name tagging,
  Actions artifacts API, Job summaries, Environments, JavaScript action → action package); §9 (record types `ownership`, `waiting`,
  `supersession`; resolution payload keys; manifest `run_kind`); §11 (store commit protocol, layout additions, template branch name);
  §12 Aggregate caps (computation), Concurrency; §12.1 K38–K51; §13 (forged artifact: ownership record validation; compromised release:
  runtime build mitigations); §15 remove the ownership item and the clause "the artifact schema for the ownership record".
- `docs/processes.md`: Status; SP03 step 2 (resolution attribution, `deleted`, record-only publish); SP06 step 1 (event
  authentication, dedup order, reopen, closure) and step 8 (queued persists a waiting record); SP13 steps 3–4 (store commit, read-back,
  settle delay, supersession record, unknown freshness fails); SP18 steps 1 and 6 (Git Data API protocol, supersession path, gate
  fallback read); SP19 steps 1 and 3 (caps computation, duplicates overcount, own-input rescreens).
- `docs/whitepaper.md` §9–§14 (implemented-so-far, decisions paragraph for ADR-0071–ADR-0078, open-decision list synced with §15).
- `README.md` Status; `CLAUDE.md` Project state (action package no longer smoke code; hosted skeleton; `scenarios/`), Commands (scenario
  suite entry point), invariants reviewed.
- User manual: `configuration.md` ("Credentials and deployment": Environment `steward-publication` restricted to the default branch,
  Environment secrets `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY`, never repository or organization secrets; "Evidence and visibility": store layout
  and commit protocol, template branch name), `overview.md` (execution options, waiting state `queued` recorded in evidence),
  `troubleshooting.md` ("Waiting states and checks": queued, duplicates, gate failures before commitment), `installation.md` (still
  Proposed; wrapper templates named), `README.md` TOC if headings change.
- `templates/policy/policy.yml` (`steward-evidence`), `templates/workflows/steward-pr.yml`, `templates/workflows/steward-issues.yml`,
  `fixtures/README.md` (new corpora), `scenarios/README.md`.

### I-list — interpretations (APPROVED)

- I1 Run existence (mirrors M05 I1): a T1 run exists once its ownership artifact uploads. Before that, every failure (event, token, policy
  missing or invalid, repository gate active, capture, listing, caps, handoff upload, ownership upload) fails the `gate` job visibly
  (job summary with the failure code) and publishes nothing; a missing or invalid trusted policy therefore has no stored evidence in T1
  (the store location comes from the policy).
- I2 After commitment, publish-side failures before the evidence commit fail the publish job: no evidence, no summary outcome.
- I3 Required stages: publish runs the M05 decision over the gate handoff; `early-exit` publishes the contract outcome
  (`needs-changes` or `inconclusive`); `runnable` ends `inconclusive` with `stage-incomplete` (no stage jobs exist).
- I4 Freshness input to the decision is `current`; supersession is decided only by OW7 after the evidence commit (SP13 steps 3–4 order).
- I5 Repository gate: if any category's mode is `advise` or `enforce`, `gate` fails before commitment with
  `gate.repository-gate-unsupported` (check creation is M14). Rulesets requiring the check are not detected in M06.
- I6 Caps are evaluated only for otherwise runnable work (contract met or uncertain): row 3 (contract failure) precedes row 4.
- I7 Author identity is read only for the per-author cap (CP4) and closure attribution (RS2); it is not a decision, finding, or report
  input.
- I8 Duplicates write no evidence (no commitment; architecture: "duplicates without a commitment do not publish"); the gate job summary
  is their only record.
- I9 Closed submissions: non-closure events on a closed submission are screened like open ones (M05 I13); a closure never supersedes.
- I10 Waiting runs: publish persists the waiting run directory and summary; no decision record; restart is M13.
- I11 A committed run whose pending publish is replaced (WF6) has no evidence; the replacing newer owner makes it moot. Documented, not
  compensated.
- I12 Re-run of failed jobs: when only `publish` re-runs, its attempt number exceeds the gate's; publish binds to the gate attempt from
  the handoff and ownership record (same run id, handoff attempt ≤ current attempt, the ownership record is this run's), and evidence is
  keyed by the gate's `<run_id>-<attempt>`.
- I13 Budget: `gate` uses the bootstrap budget (K19) for tokens, bot id, and policy, then `limits.github.*` from the policy; publish uses
  `budget_remaining.github_requests` from the handoff; exhaustion fails the job (never `pass`).
- I14 The local CLI (`steward screen`, `steward report`, `steward preflight`, `steward policy`) is unchanged and stays GET-only; the new
  write endpoints are reachable only through a separate writer interface used by the hosted phases.
- I15 Write allowlist: the only non-GET GitHub requests the core can make are `POST /app/installations/{id}/access_tokens`, `DELETE
  /installation/token`, `POST /repos/{o}/{r}/git/blobs`, `POST .../git/trees`, `POST .../git/commits`, `POST .../git/refs` (store branch
  only), `PATCH .../git/refs/heads/<store branch>`; a conformance test asserts that nothing else is possible (issues, comments, labels,
  checks, reviews, statuses, contents API writes all impossible).
- I16 Ambiguous/unavailable reads (exit criterion 2, second half) are demonstrated at fixture tier (G10 note).
- I17 The run record for T1: `run_id` Actions run id (integer), `run_attempt`, `owned_check_id: null`, `runner_identity: null`,
  `mode` = contract effective mode (always `observe` on test-beds), provider fields per M05 I25.
- I18 Metrics per committed run: M05 set plus latency events per job (`gate`, `publish`) measured by the core inside each job.
- I19 Live tests: the "no published policy" assertions move to the fork `jambolo/patch-steward-testbed-public` (never synced, so it has
  no policy); org-public gains a live assertion that its published policy loads and validates.
- I20 Wrapper templates are persistent files under `templates/workflows/`; the steward's own repository runs no wrapper (adoption gate).
- I21 Environment-only delivery check (owner addition with Q9 C): the approved `build` job stays secret-free (M1, M6, M8, WF4) and the
  approved job set stays `build`, `gate`, `publish` (Q7 A), so the live check does not add a secret reference or a job to
  `steward-screening.yml`. It runs in the SC5 helper pair, which reproduces the product's secret path exactly: the same caller-side
  `secrets:` mapping as the WF12 wrapper, the same callee `secrets:` declarations as WF1, and the same Environment name; its
  no-Environment job `outside` stands in for every product job that does not declare `steward-publication`. What it proves is a
  property of each test-bed's configuration: no repository or organization secret named `PATCH_STEWARD_APP_*` exists, so the values
  reach only Environment-declaring jobs. Placing the check inside `steward-screening.yml` itself would contradict M6/M8 and needs a new
  owner decision.

### Module layout (recommended; the decomposer may refine names, not responsibilities)

- `packages/core/src/ownership/`: `record.ts` (OW2 schema), `artifacts.ts` (naming, newest selection, listing completeness), `dedup.ts`
  (DD rules, pure), `events.ts` (EV payload schemas, event identity, dispositions), `caps.ts` (RN grammar builder/parser, CP counting,
  pure), `echo.ts` (DD7).
- `packages/core/src/records/`: `waiting.ts`, `supersession.ts`; `metrics-event.ts` additive keys; `records` type list.
- `packages/core/src/github/`: `writer.ts` (allowlisted non-GET requests, I15), `app-auth.ts` (AT-rules), `artifacts.ts` (list, download
  with one redirect), `runs.ts` (run list).
- `packages/core/src/net/zip-entry.ts` (single-entry bounded reader).
- `packages/core/src/evidence/`: `git-store.ts` (ES-rules), `blob-id.ts`, `fallback-read.ts` (ES10), layout and manifest additions
  (`run_kind`), waiting and supersession assembly, closure file.
- `packages/core/src/pipeline/`: `hosted-gate.ts`, `hosted-publish.ts`, `job-summary.ts`.
- `packages/action/src/`: `main.ts` (entry: `gate`, `publish`), `environment.ts` (runner variables and `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY`, zod), `outputs.ts`
  (`GITHUB_OUTPUT`, `GITHUB_STEP_SUMMARY`, masks), `files.ts` (artifact staging paths under `RUNNER_TEMP`). Module names avoid the
  zero-execution forbidden words (`runner`, `container`, ...). `packages/action/package.json` gains dependency `@patch-steward/core:
  workspace:*` (lockfile change limited to that workspace link); `tsconfig.test.json` gains the cli-style `paths` mapping.
- `.github/workflows/steward-screening.yml`; `templates/workflows/steward-pr.yml`, `steward-issues.yml`; `scenarios/**`.

### Conformance checks (`packages/core/src/conformance/`, plus action tests)

- `invariant-1`: extended with the workflow scan (fixture tier): in `.github/workflows/steward-screening.yml` and both templates, no
  `${{` expression inside any `run:` value; `github.event.*` appears only in `run-name` (RN1 fields), `on`, and the test-bed guard;
  titles `no event text reaches a run step` and `run-name uses only numeric and enumerated values`.
- `invariant-2`: a `pull_request_target` gate over recorded responses where the PR changes `.github/patch-steward/policy.yml` loads the
  default-branch policy (revision = default-branch tree id), records `submission.policy-change`, and never loads the head's policy;
  title `pull request policy changes never govern the hosted run`.
- `invariant-4`: new injections (event invalid, token mint failure, policy failure, capture failure, listing unavailable, download
  invalid, run list unavailable, upload failure, handoff invalid/binding, store commit failure at each ES step, non-fast-forward
  exhaustion, read-back mismatch, settle re-list unavailable, recapture failure): never `pass`; gate failures commit nothing; publish
  failures leave no evidence or no summary outcome; titles `invariant 4: hosted <step> failure never yields pass`.
- `invariant-7`: App private key and minted tokens absent from every stored file, output, summary, and artifact (sentinel values built by
  concatenation); bounds K38–K51 enforced.
- `invariant-8`: newest owner by `created_at` never id; tie and incomplete listing block publication; newer artifact → `superseded`;
  changed snapshot or policy revision → `superseded`; unknown freshness never supersedes and never publishes; duplicate keeps owner;
  rerun replaces; titles `ownership ties block publication`, `newer owner supersedes`, `unknown freshness fails publication`.
- `never-pass*`: every new failure-code union in compile-time exhaustive tables.
- Write allowlist test (I15) and static workflow tests (WF3, WF4, WF9, WF12, M8), titles `only gate and publish declare the publication
  environment`, `every action and reusable workflow is pinned by full commit sha`, `wrappers pass secrets by explicit mapping`, `every
  job declares empty permissions`, `the credential-free build job holds no secret`, `workflows use only the steward secret names` (no
  probe secret name except inside `PATCH_STEWARD_APP_*` in `steward-screening.yml` and both templates; the test builds the probe
  names by concatenation, see Constraints "Secret names").

### Owner actions (APPROVED; owner performs them and reports completion to the lead; NOT yet confirmed; the pipeline performs none of these)

Rule (binding): before the earliest phase or step listed in "Needed first by", the pipeline runs the OA's verify command (and re-runs
it at the start of every later step that depends on it). If a check fails, it stops and returns `RESULT: needs-human` naming the
missing action (e.g. "OA1 not done on steady-orchard/patch-steward-testbed-private: Environment secrets are ..."); it never works
around a missing action. Verify output is compared literally; never print a secret value.

| Id | Action | Verify | Needed first by |
| --- | --- | --- | --- |
| OA1 | On each of the three test-beds create Environment `steward-publication` with deployment branches restricted to `master` only, and Environment secrets `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY` holding the test App's real id and private key. Do NOT create repository or organization secrets with these names. Leave the probe secrets `STEWARD_APP_ID`, `STEWARD_APP_PRIVATE_KEY` and variable `STEWARD_APP_CLIENT_ID` untouched. | block OA1 below, per test-bed | org-public part: Phase 4, before the org-public smoke step (the first run that uses the Environment). personal and org-private parts: Phase 5, before the first scenario on that test-bed (S15 personal; S16 and S17 org-private); S17 needs all three. |
| OA2 | Create PRIVATE repository `steady-orchard/patch-steward-testbed-evidence` initialized with one commit (a README) | block OA2 below | Phase 5, before S16. Phase 4 may deploy the org-private policy naming this repository without it (no org-private run occurs in phase 4). |
| OA3 | Add `steady-orchard/patch-steward-testbed-evidence` to the selected repositories of the organization installation 162868612 of `patch-steward-testbed` | OA2 verify passes first; then the S16 run itself: publish mints a store token for the evidence repository (log line `token repositories=...evidence`) and commits there. A token-mint or installation-lookup failure for that repository in S16 means OA3 is missing. No local read is possible without the App key. | Phase 5, S16 |
| OA4 | Confirm the personal installation 162875728 has accepted the App's current permissions (actions, checks, contents, issues, pull requests, statuses write; metadata read) | The S15 run itself publishes to the personal test-bed's `steward-evidence` branch. A token-mint failure or an HTTP 403 permission refusal in S15 means OA4 is missing. | Phase 5, S15 |

OA1 verify, run once per test-bed `<r>` in {`steady-orchard/patch-steward-testbed-public`, `jambolo/patch-steward-testbed-personal`,
`steady-orchard/patch-steward-testbed-private`}; each line prints the expected value on the right of `# ->`:

```bash
gh api repos/<r>/environments/steward-publication/secrets --jq '[.secrets[].name] | sort'        # -> ["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"]
gh api repos/<r>/environments/steward-publication/deployment-branch-policies --jq '[.branch_policies[].name]'   # -> ["master"]
gh api repos/<r>/actions/secrets --jq '[.secrets[].name | select(startswith("PATCH_STEWARD_"))]'   # -> []
# steady-orchard/* test-beds only:
gh api repos/<r>/actions/organization-secrets --jq '[.secrets[].name | select(startswith("PATCH_STEWARD_"))]'   # -> []
```

OA2 verify:

```bash
gh api repos/steady-orchard/patch-steward-testbed-evidence --jq '[.private, .size >= 0]'   # -> [true,true]
gh api repos/steady-orchard/patch-steward-testbed-evidence/commits --jq length              # -> a number >= 1
```

No App permission change is needed (G7 scopes are within the organization installation's current permissions). Rulesets restricting
evidence-branch pushes are NOT configured in M06 (a later installation concern; unavailable on org-private anyway).

### Owner gate answers (APPROVED 2026-09-27; applied in place throughout this brief)

| Q | Topic | Answer | Applied as |
| --- | --- | --- | --- |
| 1 | Ownership record and protocol (G1) | A | OW1–OW8 as written |
| 2 | Reopen (DD2) | A | `reopened` always commits a new owner |
| 3 | Tie or incomplete listing in `gate` (DD5) | A | gate commits; only publish is blocked |
| 4 | Caps (G3) | A | RN1 with `sender <id>`, CP1–CP7; "no cap debit" = the duplicate itself is never cap-checked or queued |
| 5 | Evidence store (G4) | A | ES1–ES10; template branch renamed `patch-steward-evidence` → `steward-evidence` |
| 6 | Layout additions (G5) | A | waiting run directories with `run_kind`, supersession records, metrics-only closures, resolution `deleted` |
| 7 | Jobs in M06 (WF2) | A | `build`, `gate`, `publish` only |
| 8 | Closures (WF5) | A | publish condition extended to record-only runs |
| 9 | Names (WF13) | C | distinct names: Environment `steward-publication` (default branch only); Environment secrets `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY`; probe secrets `STEWARD_APP_ID`, `STEWARD_APP_PRIVATE_KEY`, variable `STEWARD_APP_CLIENT_ID` untouched and never read by the product; live Environment-only delivery check S17 (SC5, I21) wired to the exit criterion "Only gate and publish reference the publication Environment" |
| 10 | App tokens (G7) | A | core mints per-job scoped tokens |
| 11 | Steward SHA (WF8) | A | `steward_ref` input equal to the pin, checked statically |
| 12 | Runtime-build mitigations (G8) | A | M1–M8 all binding |
| 13 | Constants (G9) | A | K38–K51 as listed |
| 14 | Scenario suite (G10) | A | persistent `scenarios/`, S01–S16 plus S17 from Q9, test-bed-only sender guard, ambiguous and unavailable reads at fixture tier |
| 15 | ADRs and docs (G11) | A | ADR-0071–ADR-0078; ADR-0011 `superseded by ADR-0077`; stance and inventory as written |
| 16 | Interpretations | A | I1–I20 accepted; I21 added by this amendment to implement Q9's live check |
| 17 | Owner actions | owner will perform OA1–OA4 (OA1 with the Q9 names) and report to the lead | NOT yet confirmed; verified per the Owner actions rule |

## Constraints

- Branch: all commits on `milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish`; worktrees base on its current local HEAD.
  The pipeline MAY push this branch (and only `milestone/6-*` branches) to origin, never force-push, never push `develop` or `master`.
- OWNER GATE APPROVED 2026-09-27 (ledger `owner-gate`): every gate item is binding exactly as written; rejected alternatives are never
  implemented; changes need a planner amendment with owner approval. Owner actions are verified per "Owner actions" before the step
  that first needs each; a failed verify returns `RESULT: needs-human` naming the missing OA.
- Secret names: the product (`.github/workflows/steward-screening.yml`, `templates/**`, `packages/**`, `scenarios/**`) uses only
  `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY` from Environment `steward-publication`; it never references or reads the
  probe suite's `STEWARD_APP_ID`, `STEWARD_APP_PRIVATE_KEY`, or `STEWARD_APP_CLIENT_ID`, and the pipeline never modifies those probe
  secrets or the probe workflows that use them. Tests and scenario tools that check for the probe names never write them as contiguous
  literals (build them by concatenation, e.g. `'STEWARD_' + 'APP_ID'`, or match with the alternation pattern
  `(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)`), so project DoD item 18's grep stays empty; `scenarios/README.md` refers to
  them only as "the probe suite's App secrets".
- Adoption gate: steward workflows run only on the three test-beds listed above; never in this repository (no wrapper here) and never
  on any other repository.
- Test-bed writes only through `probes/smoke/tools/*.sh`, `scenarios/tools/*.sh`, and `gh` commands on the three test-beds and the fork
  (issues, PRs, branches, edits, closes, reopens, merges into `scenario-*` bases, workflow deploys, dispatches, reruns, workflow
  enable/disable, Environment reads). Never write test-bed `master` except workflow and policy deploys through `deploy.sh`. Never delete
  repositories or issues. Never change App registration, permissions, installations, organization settings, billing, or Copilot
  policies. Never print or store tokens, keys, or secrets; verify by length or SHA-256 only.
- Probe safety rules apply to every deployed workflow: no PR head checkout or execution; no event text through `${{ }}` into `run:`;
  secret-using jobs run only for allowlisted senders (WF12 guard); only `actions/*` actions, pinned by full SHA.
- No new external dependency (runtime or dev) in any `package.json`; `pnpm-lock.yaml` changes only by the `@patch-steward/action` →
  `@patch-steward/core` workspace link. Built-ins only (`node:crypto`, `node:zlib`, `node:fs`, `node:path`, `node:os`, `fetch`).
- No model call, no container, no execution of repository or policy commands, no stage; `intake`/`execute`/`assess` do not exist as jobs.
- Observe mode only: no comment, label, check run, review request, reaction, ready-for-review, status, or contents-API write on any
  submission; the only GitHub writes are artifact uploads (gate) and the I15 allowlist.
- Decision module stays the only producer of an outcome; `pass` only through row 9; every failure typed with a cause; no failure path
  yields `pass`; evidence before any other publication step.
- Untrusted data (payloads, titles, bodies, display titles, artifact contents, API responses, stored evidence read back) reaches no
  shell, `eval`, dynamic `RegExp`, workflow expression, or authorization decision; summaries and reports escape per M05 E-rules.
- CI workflows (`ci.yml`, `cd.yml`), Vitest configs, ESLint and Prettier configs, `.gitignore`, `.prettierignore` unchanged; no
  `.gitattributes`.
- Do NOT edit `docs/project-development-plan.md` or `docs/astra-plan.md`. Persistent documents (everything under `docs/` except those two,
  `README.md`, `CLAUDE.md`, `fixtures/`, `templates/`, `scenarios/`) never cite planning artifacts or their ids (M-, PD-, D-, G-, I-, K-,
  OA-, OW-, DD-, EV-, RN-, CP-, ES-, EL-, WS-, SS-, RS-, WF-, AT-, SC- ids of this brief, step or phase numbers, `development-artifacts/`);
  `probes/` files may be cited. Deferred features stay only in `docs/deferred.md`.
- Pipeline lessons (binding): tests clean their temp dirs (leak check in acceptance); no raw bidi, zero-width, or control characters in
  any file or ledger (build them with `String.fromCharCode`; write escapes in artifacts); no pipe characters inside ledger table cells;
  Vitest `it.each` truncates titles over 40 characters (check rendered titles with the JSON reporter); invariant-5 name lists (see
  Context); gates run in the main tree; blob comparisons via `git show HEAD:<path>`; Node 24.11 locally; Ubuntu via `act` on an LF clone.
- Every Prettier-checked file is Prettier-clean at commit (YAML included); never run a formatter on `development-artifacts/`.
- Governing documents first; ADRs record only.

## Assumptions

- The owner answered the gate on 2026-09-27 (all recommendations except Q9 C). The owner completes OA1–OA4 before the phase or step
  each is "Needed first by" (OA1 org-public: phase 4 smoke; the rest: phase 5); the pipeline escalates with `needs-human` naming the
  action if a verify command fails.
- GitHub keeps the probed semantics (PA02–PA09) during the milestone; a deviation observed in a scenario is recorded verbatim and
  escalated, never worked around.
- `actions/upload-artifact`, `actions/download-artifact`, `actions/checkout`, `actions/setup-node` current major versions (v7, v8, v7, v7
  as used by probes) support the inputs used; exact SHAs are read from the upstream tags at implementation time and recorded.
- The artifact zip download redirects once to an HTTPS host on public addresses (verified in the first live run; if not, escalate).
- Corepack is available in Node 24 on `ubuntu-latest` and honors `packageManager`.
- The fork `jambolo/patch-steward-testbed-public` stays unsynced (no policy) for I19.
- Pushed milestone-branch SHAs stay reachable for the milestone's duration (the branch is squashed and deleted at merge; test-bed pins
  then dangle, acceptable for test-beds).

## Out of scope

- Check runs, the repository gate, report comments, labels, reactions, review requests, ready-for-review, publication receipts (M14);
  maintainer commands, admission, `awaiting-approval` (M15); `issue_comment` events, author responses, linked-issue and shared-head
  propagation (M16); `intake`/`execute`/`assess` jobs, round pairs, containers, model calls, maintenance wrapper, queued restarts,
  stale-check reconciliation, the self-test (M13); merge-queue relay and group ownership (M19); evidence index, rollups, retention
  pruning, Pages (M17); `steward init`, releases, the 0.x release (M20 and owner).
- Rulesets protecting the evidence branch; organization-to-organization secret mapping (known gap).
- New policy keys; changes to the local CLI's behavior (except the live-test repository switch, I19).

## Definition of Done (project)

Pinned by the approval amendment of 2026-09-27 (owner gate APPROVED). Run in the main tree
(`cd /c/Users/John/Projects/steady-orchard/patch-steward`), Git Bash, after the last phase. `S` =
`6418129c7b104fd93d9162efcda6fe08373287ee`.

1. Toolchain: `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check` exits 0;
   `git diff --quiet S HEAD -- .github/workflows/ci.yml .github/workflows/cd.yml vitest.config.ts vitest.live.config.ts eslint.config.mjs .prettierrc.json .prettierignore .gitignore`
   exits 0; `ls .gitattributes` fails; `git diff S HEAD -- packages/*/package.json package.json` adds no dependency other than
   `"@patch-steward/core": "workspace:*"` in `packages/action/package.json`.
2. Workflows: `actionlint .github/workflows/steward-screening.yml templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml`
   exits 0; the static workflow tests (Conformance checks, last bullet) pass with their exact titles.
3. Ownership and dedup: `pnpm vitest run packages/core/src/ownership` passes, covering OW3–OW8, DD1–DD7, EV2, RN1 parser (valid and
   hostile titles), CP2–CP7.
4. Evidence store: `pnpm vitest run packages/core/src/evidence` passes, covering ES2–ES10 with recorded responses (branch absent, 422
   non-fast-forward then success, retries exhausted, compare with a modified file → not append-only, read-back mismatch), EL2 manifest
   `run_kind`, WS1, SS1, RS1.
5. Conformance: `pnpm vitest run packages/core/src/conformance` passes with the invariant-1, -2, -4, -7, -8 titles listed in
   "Conformance checks"; the write-allowlist test passes.
6. Action package: `pnpm vitest run packages/action` passes (environment validation, outputs single-line and escaped, masks emitted
   before other output, summary bounded, entry dispatch).
7. Live tier (read-only): `GH_TOKEN=$(gh auth token) pnpm test:live` exits 0 with the I19 changes.
8. Scenarios: `scenarios/results/org-public.md`, `personal.md`, `org-private.md` record S01–S17 (as applicable per test-bed; S13, S14,
   S17 in all three) each with result `pass` and verbatim
   evidence (run URLs, artifact listings, evidence commit SHAs); every exit criterion row of G10 maps to at least one passing scenario.
9. Observe audit (S13) re-run by the final gate: for every `[scenario` issue and PR on the three test-beds, App-authored comments,
   labels, App check runs on their head SHAs, and requested reviewers all count `0`.
10. Steady state (SC3): `gh workflow list -R <r> --all --json path,state` shows `steward-pr.yml`, `steward-issues.yml`, `scenario-*`
    all `disabled_manually` on the three test-beds (`scenario-secret-scope-called.yml` may instead read `active`, SC3); no open
    `[scenario` issue or PR.
11. Pins: the reusable workflow SHA pinned by the deployed test-bed wrappers is an ancestor of the pushed
    `origin/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish` (`git merge-base --is-ancestor <sha> <remote ref>` exits 0).
12. ADRs: exactly ADR-0071 through ADR-0078 are new (`ls docs/adr/007[1-8]-*.md` lists 8 files; no `docs/adr/0079-*`);
    `grep -c '^| \[ADR-' docs/adr/README.md` prints `78`; `docs/adr/0011-distribution.md` contains the line
    `- Status: superseded by ADR-0077` and its README row status cell reads `superseded by ADR-0077`; no other pre-existing record
    changes (`git diff --name-only S HEAD -- docs/adr` lists only `docs/adr/README.md`, `docs/adr/0011-distribution.md`, and the 8 new
    files).
13. §15: `grep -c 'Ownership artifact naming, retention' docs/architecture.md` prints `0`; `grep -c 'the artifact schema for the
    ownership record' docs/architecture.md` prints `0`.
14. Persistence: `git grep -n -P 'development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' HEAD -- docs README.md CLAUDE.md fixtures templates scenarios ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
    prints only the M05 baseline lines measured at `S` (the gate step records the baseline before any doc change).
15. Deferred: `git grep -c -E 'DF[0-9]{2}|deferred\.md' HEAD -- docs README.md CLAUDE.md templates fixtures scenarios ':!docs/deferred.md' ':!docs/adr' ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
    prints exactly the baseline at `S` (`HEAD:CLAUDE.md:3`, `HEAD:README.md:1`) plus nothing from `scenarios`.
16. Documentation truth: README Status, CLAUDE.md Project state, architecture and processes Status paragraphs describe the hosted
    skeleton as observe-mode, contract-level, test-bed-only; none describes a check, comment, label, stage, container, model call, or
    installation as working; `docs/user-manual/installation.md` target-repository installation stays Proposed; the configuration callout
    no longer lists App-secret names or Environment names, and `docs/user-manual/configuration.md` names Environment
    `steward-publication` and Environment secrets `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY`.
17. Prettier and characters: `pnpm prettier --check docs README.md CLAUDE.md fixtures templates scenarios .github` exits 0; no control,
    bidi, or zero-width character in any file changed since `S`.
18. Secret names: `git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' HEAD -- .github/workflows/steward-screening.yml templates packages scenarios docs README.md CLAUDE.md ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
    prints nothing (exit 1); `git grep -c 'PATCH_STEWARD_APP_PRIVATE_KEY' HEAD -- .github/workflows/steward-screening.yml` prints a
    count ≥ 1; `scenarios/results/*.md` record S17 `pass` on all three test-beds.
