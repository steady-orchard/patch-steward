# patch-steward-m6 — Roadmap

Strategy: build every M06 rule first as pure, fixture-tested core code (records, event model, dedup, caps, ownership ordering, store
planning), then the GitHub adapters (allowlisted writes, App tokens, artifacts, run list, Git Data API store), then the hosted `gate`
and `publish` phases and the `action` package entry with conformance extensions, then the reusable workflow, wrapper templates, and
test-bed deployment, then the live scenario suite that demonstrates every exit criterion on the test-beds, and finally the ADRs and
governing-document changes. Phases 1–3 need no network; phase 4 pushes the milestone branch and deploys to test-beds; phase 5 is the
only phase that creates GitHub events. Owner gate APPROVED 2026-09-27 (brief "Owner gate answers"). All gate references
(G1–G11, I1–I21, K38–K51, OA1–OA4, S01–S17, SC1–SC5) are in `development-artifacts/patch-steward-m6-brief.md`. Owner actions: the
owner reported OA1–OA4 complete on 2026-09-27; OA1 (all three test-beds) and OA2 are verified; OA3 and OA4 are proved only by the S16
and S15 runs (brief "Owner actions", "Status"). Before the earliest phase or step that needs each OA (brief "Owner actions", column
"Needed first by"), the pipeline still re-runs the OA's verify command and returns `RESULT: needs-human` naming the missing action if
it fails. Earliest needs: OA1 on org-public —
Phase 4, org-public smoke step; OA1 on personal and org-private — Phase 5 (S15, S16, S17); OA2 — Phase 5, S16; OA3 — Phase 5, S16
(verified by the S16 run); OA4 — Phase 5, S15 (verified by the S15 run). Product secret names: Environment `steward-publication`,
Environment secrets `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY`; the probe suite's `STEWARD_APP_*` secrets are never read.

## Phase 1 — Core contracts (pure)

- **Objective:** every M06 rule exists as a pure, validated, unit-tested core function or schema, with no I/O.
- **Scope:** `packages/core/src/policy/bounds.ts` (K38–K51), `vocabulary.ts` additions, `records/` (ownership record G1 OW2, waiting WS1,
  supersession SS1, metrics resolution keys RS2, record type list), new `ownership/` module (event payload schemas and authentication
  checks EV2, event identity, dispositions EV3, dedup DD1–DD7, newest-owner selection OW4 with tie and completeness, run-name builder
  and parser RN1, cap counting CP2–CP7), `evidence/` pure additions (store path planning for waiting, supersession, closure; manifest
  `run_kind` EL2; git blob id; append-only check over a compare result ES4), `net/` single-entry zip reader (OW5 bounds), job summary
  renderer (WF11, escaped, bounded), core root exports, `conformance/invariant-5.test.ts` name lists when needed.
- **Depends on:** nothing (owner gate APPROVED).
- **Definition of Done (phase):** in the main tree `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm
  lint && pnpm format:check` exits 0; `pnpm vitest run packages/core/src/ownership packages/core/src/records` passes with tests for
  every DD, CP, OW4 rule and RN1 hostile titles; no file under `packages/cli/`, `packages/action/`, `.github/`, `templates/`, `docs/`
  changed since the phase base; no `fetch`, `node:fs`, or network import in `packages/core/src/ownership/` (grep); temp-dir leak check
  clean; no raw control, bidi, or zero-width character in changed files.
- **Risks:** export-name collisions (TS2308) and invariant-5 name lists; zod subset of event payloads too strict for real payloads
  (mitigate with recorded payloads in phase 2/3); `created_at` tie semantics mis-implemented as id order.

## Phase 2 — GitHub and evidence-store adapters

- **Objective:** the core can mint scoped App tokens, list and download ownership artifacts, read the run list, and commit evidence
  append-only to an orphan branch or a separate repository with bounded retries and read-back — all behind validated, bounded,
  allowlisted requests, tested only with recorded or synthetic responses.
- **Scope:** `packages/core/src/github/` (writer with the I15 allowlist, `app-auth` AT1–AT4, artifacts list and one-redirect download
  OW3/OW5, runs list CP1, installation bot id DD7), `packages/core/src/evidence/` (Git Data API store ES1–ES9, fallback read ES10;
  reuse of the M05 file set and manifest so bytes equal the local store's), `fixtures/github/` recorded responses (artifact listings incl.
  ties and pagination, zip downloads, run lists, git data responses incl. 422 non-fast-forward, compare results, token responses with
  synthetic values), never-pass tables for new failure-code unions.
- **Depends on:** Phase 1.
- **Definition of Done (phase):** toolchain command as in phase 1 exits 0; `pnpm vitest run packages/core/src/github
  packages/core/src/evidence` passes covering ES2–ES10 (branch absent, non-fast-forward then success, retries exhausted, non-append-only
  compare, read-back mismatch), OW5 (redirect to non-HTTPS or private address rejected, oversize zip, extra entry), AT3 (key and tokens
  redacted and never in outputs); a test proves the writer rejects every non-allowlisted method/path pair; `steward screen` path still
  GET-only (existing test passes unchanged); no live network in any unit or fixture test; `packages/cli/` unchanged.
- **Risks:** GitHub's artifact redirect host or Git Data API behavior differs from the recorded shapes (confirmed only in phase 4 smoke;
  escalate on mismatch); base64 blob size and request budget with `limits.github.requests_per_run` minimum 10; JWT clock skew.

## Phase 3 — Hosted gate and publish, action package, conformance

- **Objective:** `node packages/action/dist/main.js gate` and `... publish` run the complete M06 gate and publish logic from runner
  environment variables and files, producing validated outputs, artifacts files, summaries, and evidence commits, and every invariant
  extension passes.
- **Scope:** `packages/core/src/pipeline/` (hosted gate DD8 order incl. closure EV4 and repository-gate refusal I5; WF7 same-run
  records: `handoff.json` unchanged plus the gate context record `gate-context.json` and the closure record `closure.json`, with
  publish-side validation and binding; hosted publish I2–I4, I10, I12, I13 budgets (fresh bootstrap per AT4, then the handoff's
  remainder), OW9 own-artifact read with OW6 retention, OW7 settle and ordered freshness evaluation (a)–(d) with
  `publish.freshness-unknown`, SS1 supersession commit, RS1 closure commit, EL2 waiting run directory), `packages/core/src/policy/loader.ts`
  (publish policy load by recorded tree id, I22), `packages/action/`
  (package dependency on core, `tsconfig.test.json` paths mapping, entry, environment validation incl. the App credentials read from
  `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY`, outputs, masks, summaries, staging
  files under `RUNNER_TEMP`), `packages/core/src/conformance/` (invariant-2, -4, -7, -8 extensions, write-allowlist test, zero-execution
  scan extended to `packages/action/src`), fixture-tier hosted scenarios over recorded responses (including ambiguous and unavailable
  ownership and snapshot reads, I16), `fixtures/` payloads and `fixtures/README.md`.
- **Depends on:** Phase 2.
- **Definition of Done (phase):** toolchain command exits 0; `pnpm vitest run packages/core/src/conformance packages/action
  packages/core/src/pipeline` passes with the invariant titles listed in the brief "Conformance checks" (except the workflow scan and
  static workflow tests, which belong to phase 4); the fixture-tier hosted scenarios assert: the gate's recorded request order follows
  brief DD8 (ownership listing before capture), a verified echo built with synthetic receipts ends `duplicate` reason `echo` with no
  capture request recorded and nothing uploaded, duplicate keeps owner, body change commits,
  newer owner and changed snapshot supersede, tie or incomplete listing or unavailable read fails publication without supersession,
  a tie at the greatest `created_at` that includes this run's own artifact fails publication with `publish.freshness-unknown` and no
  supersession record, a `newer-owner` supersession record carries the successor's run attempt read from its validated record,
  failure before commitment commits nothing, publish failure leaves no evidence, evidence commit precedes the summary write (recorded
  call order), publish loads the policy by the gate context's tree id and issues no live default-branch policy read before the evidence
  commit (recorded requests), a gate context, handoff, or own ownership record mismatch fails publish with `pipeline.handoff-binding`
  before any evidence request, waiting run directory for over-cap, closure metrics-only commit; lockfile diff since the phase base is
  only the action → core workspace link.
- **Risks:** re-use of M05 `publishRunEvidence` across a new store without changing M05 bytes (golden reports must stay unchanged);
  handoff binding for re-run attempts (I12); gate context record size near K37 for large PR submission records; summary escaping;
  action tests needing the core alias.

## Phase 4 — Workflows, templates, and test-bed deployment

- **Objective:** the reusable screening workflow and the two wrapper templates exist, are statically proven safe, are pushed to origin,
  and are deployed with a trusted policy on the three test-beds, and one smoke run on org-public commits evidence end to end.
- **Scope:** `.github/workflows/steward-screening.yml` (WF1–WF11, WF14, G8 M1–M7), `templates/workflows/steward-pr.yml` and
  `steward-issues.yml` (WF12, RN1), static workflow tests and the invariant-1 workflow scan (fixture tier), `templates/policy/policy.yml`
  and `default-checklist.ts` branch rename (ES1), live-test switch to the fork (I19), `scenarios/` skeleton (README, tools,
  helper workflows including the SC5 secret-scope pair, test-bed policies, fixtures; SC1–SC5), push of `milestone/6-*` to origin, deployment of
  wrappers (pinned to the pushed commit, with the test-bed guard, secrets mapped as `PATCH_STEWARD_APP_ID`/`PATCH_STEWARD_APP_PRIVATE_KEY`)
  and policies to the three test-beds, OA1 verify on org-public, org-public smoke.
- **Depends on:** Phase 3. Owner action OA1 on org-public (Environment `steward-publication` with secrets `PATCH_STEWARD_APP_ID`,
  `PATCH_STEWARD_APP_PRIVATE_KEY`, no same-named repository or organization secret; reported done and verified 2026-09-27) re-verified with the brief's OA1 commands immediately
  before the org-public smoke step (the first step in the plan that uses the Environment); a failing verify returns `RESULT: needs-human`
  naming OA1. Steps before the smoke (code, static tests, push, deploys) need no owner action. OA2–OA4 and OA1 on personal and
  org-private are NOT needed in this phase.
- **Definition of Done (phase):** toolchain command exits 0; `actionlint .github/workflows/steward-screening.yml
  templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml` exits 0; static workflow test titles pass (including
  `workflows use only the steward secret names`); brief project DoD item 18's `git grep` prints nothing; `GH_TOKEN=$(gh
  auth token) pnpm test:live` exits 0; the deployed wrapper blobs on each test-bed equal the canonical test-bed copies (blob ids) and pin a
  SHA that is an ancestor of `origin/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish`; one org-public smoke (an
  unstructured `[scenario S00]` issue) produced: a successful `build`, `gate`, `publish`; one `steward-ownership-issue-<n>` artifact; one
  evidence commit on `steward-evidence` whose run directory verifies (manifest, blob ids); and a publish summary written after the
  commit; no App-authored comment, label, or check on the issue; the OA1 verify output for org-public recorded verbatim in the smoke
  step's report.
- **Risks:** platform differences in artifact download redirect, corepack, checkout of a public repository with an empty-permission job
  token, Environment deployment records appearing on submissions; pins dangling after re-push (re-deploy with the new SHA); public
  test-bed exposure (sender guard); org-private minutes.

## Phase 5 — Test-bed scenarios

- **Objective:** every M06 exit criterion is demonstrated live on the test-beds and recorded with verbatim evidence.
- **Scope:** run S01–S17 (brief G10; S17 is the live Environment-only delivery check, SC5 and I21) with `scenarios/tools/`, record `scenarios/results/org-public.md`, `personal.md`, `org-private.md`;
  defects found go back through the supervisor revision loop (re-push, re-deploy); steady state SC3 at the end.
- **Depends on:** Phase 4. Owner actions (all reported done 2026-09-27; OA1 and OA2 verified; OA3 and OA4 unproved until S16 and S15),
  each re-verified with the brief's command before the first scenario that needs it (a failing verify returns `RESULT: needs-human`
  naming the action): OA1 on personal before S15 and S17 there; OA1 on org-private before S16 and S17 there; OA2 before S16; OA3 by the
  S16 run (store token minted for the evidence repository; a token-mint or installation-lookup failure there returns `needs-human`
  naming OA3); OA4 by the S15 run (publish to the personal `steward-evidence`; a token-mint failure or HTTP 403 there returns
  `needs-human` naming OA4). Scenarios on org-public (S01–S14, S17) need only OA1 on org-public, re-verified at the start of the phase.
- **Definition of Done (phase):** each result file lists S01–S17 as applicable with result `pass` and evidence (run URLs, artifact
  listings with `created_at`, evidence commit SHAs, compare outputs); the observe audit (S13) counts are all `0`; S17 on each of the three test-beds shows job `outside` logging both `length-zero=true`
  and job `inside` logging both `length-zero=false`; SC3 steady state
  verified by `gh workflow list` and open-issue/PR queries on the three test-beds; `pnpm prettier --check scenarios` exits 0; no token or
  key in any result file (grep for `ghs_`, `ghp_`, `-----BEGIN`); brief project DoD item 18's `git grep` prints nothing.
- **Risks:** timing-dependent overlap for S04/S05 (bounded retries of the scenario, recorded); run-list freshness (22 s) making cap
  scenarios flaky (space runs, record counts); Actions minutes on org-private; a platform deviation requiring an owner decision
  (escalate, never work around).

## Phase 6 — ADRs, governing documents, manual, project DoD

- **Objective:** every settled decision is recorded governing document first, the documentation describes exactly the delivered
  skeleton, and the brief's project DoD passes.
- **Scope:** ADR-0071 onward and ADR-0011's status (G11), `docs/adr/README.md`, `docs/architecture.md`, `docs/processes.md`,
  `docs/whitepaper.md` §9–§14, `README.md`, `CLAUDE.md`, `docs/user-manual/` pages in the G11 inventory, `fixtures/README.md` if not
  already current, `scenarios/README.md` wording review.
- **Depends on:** Phase 5 (documents state measured and delivered behavior).
- **Definition of Done (phase):** brief project DoD items 1–18 all pass as pinned by the approval amendment of 2026-09-27; `pnpm prettier --check docs
  README.md CLAUDE.md` exits 0; link check over persistent docs passes; Status paragraphs of architecture, processes, README, CLAUDE.md,
  and the manual describe the hosted skeleton as observe-mode, contract-level, test-bed-only; `docs/deferred.md` and the plan documents
  unchanged since `S`.
- **Risks:** persistence rule violations (planning ids leaking into docs); whitepaper lag; §14 traceability and "Addresses" fields left
  inconsistent; Prettier-aligned tables.
