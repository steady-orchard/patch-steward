# patch-steward-m6 — Ledger

Single source of truth for execution state. Sections are owned by different agents —
the planner seeds Plan + Phases; the decomposer fills Steps per phase; the supervisor
updates Steps and appends Revisions.

## Plan

- plan-name: patch-steward-m6
- current-phase: 5
- working-branch: milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish
- starting-commit: 6418129c7b104fd93d9162efcda6fe08373287ee
- default-branch: develop
- artifacts-dir: development-artifacts
- owner-gate: APPROVED 2026-09-27. Answers: Q1-Q8 A; Q9 C (distinct names: Environment `steward-publication` restricted to the default branch; Environment secrets `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY`; test-bed probe secrets `STEWARD_APP_ID`, `STEWARD_APP_PRIVATE_KEY` and variable `STEWARD_APP_CLIENT_ID` untouched and never read by the product; added live check S17: a job of a called reusable workflow that does not declare the Environment receives both secrets empty, wired to the exit criterion "Only gate and publish reference the publication Environment"); Q10-Q16 A (incl. M1-M8, K38-K51, `scenarios/` suite, ADR-0071-ADR-0078 with ADR-0011 superseded by ADR-0077, I1-I20; I21 added); Q17 owner will perform OA1-OA4 and report to the lead. Brief "Owner gate answers" holds the full record.
- owner-actions: owner reported OA1-OA4 complete 2026-09-27. OA1 VERIFIED by the lead on all three test-beds (Environment `steward-publication` lists secrets `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY`; deployment branch policy `master`; no repository secret named `PATCH_STEWARD_*`); OA2 VERIFIED by the lead (`steady-orchard/patch-steward-testbed-evidence` private, 1 commit); the planner re-ran every brief OA1 and OA2 verify line at the amendment and each printed its expected value. OA3 and OA4 reported done, not locally verifiable; proved only by the S16 run (OA3) and the S15 run (OA4). Still re-verify each with the brief "Owner actions" command before the step that first needs it (OA1 org-public: phase 4 org-public smoke; OA1 personal and org-private, OA2: phase 5 per the roadmap); a failed verify, or a token-mint or permission failure in S16 (OA3) or S15 (OA4), returns `RESULT: needs-human` naming the action.

## Phases

| Phase | Status  | Notes |
| ----: | ------- | ----- |
| 1     | done    | Core contracts (pure): bounds K38-K51, records (ownership, waiting, supersession, resolution keys), event model, dedup, newest owner, run-name and caps, store path planning, blob id, zip entry reader, job summary renderer. Complete 2026-09-27; DoD D1-D8 re-verified by the supervisor in the main tree. |
| 2     | done    | GitHub and evidence-store adapters: allowlisted writer, App tokens, artifacts list and download, run list, Git Data API store with retries and read-back, gate fallback read, recorded responses. Needs Phase 1. Complete 2026-09-27; DoD D1-D10 re-verified by the supervisor in the main tree. |
| 3     | done    | Hosted gate and publish, action package entry, invariant 2, 4, 7, 8 extensions, write allowlist, fixture-tier hosted scenarios. Needs Phase 2. Complete 2026-09-28; DoD D1-D11 re-verified by the supervisor in the main tree. |
| 4     | done    | Reusable workflow, wrapper templates (secrets `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY`), static workflow tests, live-test switch, scenarios skeleton incl. SC5 secret-scope pair, push to origin, test-bed deployment, OA1 verified on org-public, org-public smoke. Needs Phase 3 and OA1 on org-public (before the smoke step only). Complete 2026-09-28; DoD D1-D13 re-verified by the supervisor in the main tree and on the test-beds. Pin 7161cd20df662314d14cc7f2f4130102baee1e98 pushed; wrappers and policies deployed on the three test-beds; smoke issue 31 on org-public OPEN, run 36397673122, evidence commit 6f1c3c890f7106aa762a591faff452a2cac35c1d on steward-evidence. |
| 5     | pending | Live test-bed scenarios S01-S17 (S17 = Environment-only secret delivery on all three test-beds) with recorded results, steady state. Needs Phase 4; OA1 on personal and org-private, OA2, OA3, OA4 verified before the scenarios that need them (S15, S16, S17). |
| 6     | pending | ADR-0071 onward, governing documents, whitepaper, README, CLAUDE.md, user manual, project DoD. Needs Phase 5. |

## Pipeline rules (from earlier milestones plus M06 outward actions; binding for every agent in this plan)

- Every `decomposer`, `worker`, and `planner` invocation runs in the FOREGROUND (`run_in_background: false`). A parallel wave is
  several foreground Agent calls in ONE message. A supervisor that backgrounds workers is force-handed back and loses results.
- Never put a pipe character inside a ledger table cell (it breaks the columns); write "or" instead. Never write raw control,
  bidi, or zero-width characters into any artifact or source file; write escapes, and build such characters in test code with
  String.fromCharCode (the file-writing channel turns backslash-u escapes into raw characters).
- Phase gates and the project DoD run in the MAIN tree (repo root); long git-worktree paths break `pnpm test`. Worker worktrees
  use short paths such as `C:/w/m6-<id>`; delete leftover `node_modules` after `git worktree remove` on Windows.
- Before a wide wave, run `pnpm install --frozen-lockfile` in each new worktree sequentially (pnpm store contention on Windows).
- `core.autocrlf=true`: compare committed bytes with `git show HEAD:<path>`; compare deployed test-bed files by git blob id.
- Every Prettier-checked file a step writes (fixtures, docs, README, CLAUDE.md, templates, `.github/workflows`, `scenarios/`) is
  Prettier-clean at commit; byte-exact fixtures use `.txt`. Never run a formatter on anything under `development-artifacts/`.
- `.gitignore` swallows `logs`, `*.log`, `*.tgz`, `.env*`, `out`, `dist`: never name a committed file or directory that way.
- Credential samples (tokens, private keys) are built by string concatenation in test code, never committed as literals. Never print,
  log, or store a real token, key, or secret; verify by length or SHA-256 only.
- Acceptance checks that grep for substrings the mandated text itself contains are mis-specified; literal grep on prose must
  tolerate Prettier line wraps; it.each titles are checked as rendered titles (Vitest JSON reporter; titles over 40 characters in
  it.each are truncated).
- New core root exports named load*, validate*, resolve*, parse*, capture*, or check* must extend conformance/invariant-5.test.ts in
  the same step; every new export name is unique across core (TS2308).
- Tests clean their temp dirs; each step's acceptance proves its mkdtemp prefix count is unchanged after its test run.
- GitHub access in unit and fixture tests: recorded or synthetic responses only. Live reads only in `*.live.test.ts` under
  `pnpm test:live`. Live WRITES only in phases 4 and 5, only to the three test-beds and the fork, only through
  `probes/smoke/tools/*.sh`, `scenarios/tools/*.sh`, or `gh` commands listed in the step, polling no faster than every 20 s, stopping
  when the core rate limit remaining is below 500.
- Pushes: only `milestone/6-*` branches to origin, never force, never `develop` or `master`; the push happens only in the step that
  owns it; test-bed wrappers pin only SHAs reachable on the pushed milestone branch.
- The pipeline never changes App registration, permissions, or installations, never creates repositories, never sets real secrets, and
  never deletes repositories or issues; a failing owner-action verify command returns `needs-human`.
- Persistent files (`docs/` except the two plan documents, README.md, CLAUDE.md, `fixtures/`, `templates/`, `scenarios/`) never cite
  planning artifacts or their ids.

## Steps

<!-- decomposer fills per phase: id | phase | status | files | commit,
     plus a "Phase <N> notes" block: dependency graph, couplings, emergent contracts -->

| id | phase | status | files | commit |
| --- | --- | --- | --- | --- |
| 1.1 | 1 | done | packages/core/src/policy/bounds.ts, packages/core/src/policy/bounds.test.ts, development-artifacts/patch-steward-m6-1.1-report.md | a199a8899587e206555aa9ef1316264088b43350 |
| 1.2 | 1 | done | packages/core/src/vocabulary.ts, packages/core/src/vocabulary.test.ts, packages/core/src/records/common.ts, packages/core/src/records/common.test.ts, packages/core/src/exports.test.ts, development-artifacts/patch-steward-m6-1.2-report.md | 787eeb56ef4b43df8fc118eb2dace82dfc2efe4f |
| 1.3 | 1 | done | packages/core/src/net/zip-entry.ts, packages/core/src/net/zip-entry.test.ts, development-artifacts/patch-steward-m6-1.3-report.md | 57d622c5acb5fdb1078417ddb9b9d736b52ae0ee |
| 1.4 | 1 | done | packages/core/src/evidence/blob-id.ts, packages/core/src/evidence/blob-id.test.ts, packages/core/src/evidence/store-checks.ts, packages/core/src/evidence/store-checks.test.ts, development-artifacts/patch-steward-m6-1.4-report.md | 16f56593256386f3d578c4cde5cf3bb6c5ce5e78 |
| 1.5 | 1 | done | packages/core/src/ownership/dedup.ts, packages/core/src/ownership/dedup.test.ts, development-artifacts/patch-steward-m6-1.5-report.md | 6bcf57d01a8c43b73eb19ecb5a32fc93a4c142ad |
| 1.6 | 1 | done | packages/core/src/records/waiting.ts, packages/core/src/records/waiting.test.ts, packages/core/src/records/supersession.ts, packages/core/src/records/supersession.test.ts, development-artifacts/patch-steward-m6-1.6-report.md | ec424a797502429bfeca2f4ea07beb565a81298b |
| 1.7 | 1 | done | packages/core/src/ownership/record.ts, packages/core/src/ownership/record.test.ts, development-artifacts/patch-steward-m6-1.7-report.md | 1f7236aecb0d77ce199e967dc3307ce6581fed2a |
| 1.8 | 1 | done | packages/core/src/ownership/artifacts.ts, packages/core/src/ownership/artifacts.test.ts, development-artifacts/patch-steward-m6-1.8-report.md | 1d83afdbc7a996d34b11ef99061024221441b0f7 |
| 1.9 | 1 | done | packages/core/src/ownership/events.ts, packages/core/src/ownership/events.test.ts, development-artifacts/patch-steward-m6-1.9-report.md | 6a50c517aa01e1209fadbdc74b8cc9ff63c6f287 |
| 1.10 | 1 | done | packages/core/src/ownership/caps.ts, packages/core/src/ownership/caps.test.ts, development-artifacts/patch-steward-m6-1.10-report.md | f59633a63ee8854de15310f4c18e95c4b05a2a22 |
| 1.11 | 1 | done | packages/core/src/evidence/layout.ts, packages/core/src/evidence/layout.test.ts, packages/core/src/evidence/manifest.ts, packages/core/src/evidence/manifest.test.ts, development-artifacts/patch-steward-m6-1.11-report.md | a8f0365106d11825d374013367f975ab780a94e1 |
| 1.12 | 1 | done | packages/core/src/records/metrics-event.ts, packages/core/src/records/metrics-event.test.ts, packages/core/src/evidence/metrics.ts, packages/core/src/evidence/metrics.test.ts, development-artifacts/patch-steward-m6-1.12-report.md | 68b43a1353caf718beca5cab6fe02fba9dd5c906 |
| 1.13 | 1 | done | packages/core/src/pipeline/job-summary.ts, packages/core/src/pipeline/job-summary.test.ts, development-artifacts/patch-steward-m6-1.13-report.md | e02c34475f3c42f56f387d257c0f3dc8d715647b |
| 1.14 | 1 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, packages/core/src/conformance/invariant-5.test.ts, packages/core/src/conformance/never-pass-hosted.test.ts, development-artifacts/patch-steward-m6-1.14-report.md | facfbf79e4d03b7a8cf341b8b2b1ed54c6c8a9b5 |
| 1.15 | 1 | done | development-artifacts/patch-steward-m6-1.15-report.md | 57ddd023d7535a34c5eaa0dbcb57b3106235da6a |
| 2.1 | 2 | done | packages/core/src/github/client.ts, packages/core/src/github/client-lists.test.ts, development-artifacts/patch-steward-m6-2.1-report.md | e7e3bda1ed0f8004c0e4d8e866c523b2f8e0e25d |
| 2.2 | 2 | done | packages/core/src/github/writer.ts, packages/core/src/github/writer.test.ts, development-artifacts/patch-steward-m6-2.2-report.md | 91d6514d3453ed430e53b2587593d87f3d2bc803 |
| 2.3 | 2 | done | packages/core/src/evidence/publish.ts, packages/core/src/evidence/prepare.test.ts, development-artifacts/patch-steward-m6-2.3-report.md | 81ccaa4f943374169a6c9a536d71b857f51e77ac |
| 2.4 | 2 | done | fixtures/github/hosted/artifacts-page.json, fixtures/github/hosted/runs-page.json, fixtures/github/hosted/runs-in-progress.json, fixtures/github/hosted/ref-heads-master.json, fixtures/github/hosted/git-commit-master.json, fixtures/github/hosted/compare-parent-master.json, fixtures/github/hosted/tree-master-github.json, fixtures/github/hosted/contents-readme.json, fixtures/github/hosted/contents-github-directory.json, fixtures/github/hosted/user-app-bot.json, fixtures/README.md, development-artifacts/patch-steward-m6-2.4-report.md | 504b60207205c0ce1de0f16a1288315a6da3f814 |
| 2.5 | 2 | done | packages/core/src/evidence/fallback-read.ts, packages/core/src/evidence/fallback-read.test.ts, development-artifacts/patch-steward-m6-2.5-report.md | 6ed6788a8b926aa942891c97c8492f1ae4a1324c |
| 2.6 | 2 | done | packages/core/src/github/app-auth.ts, packages/core/src/github/app-auth.test.ts, development-artifacts/patch-steward-m6-2.6-report.md | 8c37c682f2c2b246dd5512d4e4f7d16854c74be9 |
| 2.7 | 2 | done | packages/core/src/github/artifacts.ts, packages/core/src/github/artifacts.test.ts, development-artifacts/patch-steward-m6-2.7-report.md | cc0a5f88ce441de2ba00f4c8d4184fa7e432bba9 |
| 2.8 | 2 | done | packages/core/src/github/runs.ts, packages/core/src/github/runs.test.ts, development-artifacts/patch-steward-m6-2.8-report.md | 70dfc275f6f9c9517f8e5d4df3fbedf6284d4d4e |
| 2.9 | 2 | done | packages/core/src/evidence/git-store.ts, packages/core/src/evidence/git-store.test.ts, development-artifacts/patch-steward-m6-2.9-report.md | 7b5aa475b9c2118259349ef7792a1eeaa09baa10 |
| 2.10 | 2 | done | packages/core/src/evidence/store-readback.ts, packages/core/src/evidence/store-readback.test.ts, development-artifacts/patch-steward-m6-2.10-report.md | 5a6d3c9f86191b84e20729b95f3780badeeec0d3 |
| 2.11 | 2 | done | packages/core/src/github/hosted-responses.fixture.test.ts, development-artifacts/patch-steward-m6-2.11-report.md | c5bfad5ff9302766b80cdeb4e2dc8f2feafe57e0 |
| 2.12 | 2 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, packages/core/src/conformance/never-pass-hosted.test.ts, development-artifacts/patch-steward-m6-2.12-report.md | 194d1270f9f327292764350e720d0fd788c23472 |
| 2.13 | 2 | done | development-artifacts/patch-steward-m6-2.13-report.md | 74d9cf15c186f98dde5c54048466bd28ea63ef94 |
| 3.1 | 3 | done | packages/core/src/policy/loader.ts, packages/core/src/policy/loader-revision.test.ts, packages/core/src/conformance/invariant-5.test.ts, development-artifacts/patch-steward-m6-3.1-report.md | 9046df2170a9437b3bb973db56698f48cacf0041 |
| 3.2 | 3 | done | packages/core/src/pipeline/gate.ts, packages/core/src/pipeline/gate-capture.test.ts, development-artifacts/patch-steward-m6-3.2-report.md | 3bfc45bb914cd6e8d45f07a1e6b8b752a5f43f5a |
| 3.3 | 3 | done | packages/core/src/pipeline/gate-context.ts, packages/core/src/pipeline/gate-context.test.ts, development-artifacts/patch-steward-m6-3.3-report.md | 8d6d146a157dd7e940d8c6f8e70213563a6a8ae9 |
| 3.4 | 3 | done | packages/core/src/ownership/freshness.ts, packages/core/src/ownership/freshness.test.ts, development-artifacts/patch-steward-m6-3.4-report.md | 48f21351f0fb152d4152a75913223ea4370d9605 |
| 3.5 | 3 | done | packages/core/src/evidence/prepare-waiting.ts, packages/core/src/evidence/prepare-waiting.test.ts, development-artifacts/patch-steward-m6-3.5-report.md | 1246412f05743140d872be2a11fce6fe7e4b1e39 |
| 3.6 | 3 | done | packages/core/src/evidence/prepare-records.ts, packages/core/src/evidence/prepare-records.test.ts, development-artifacts/patch-steward-m6-3.6-report.md | 269ccfd9d723adbae112e446e48a1b020061cfe1 |
| 3.7 | 3 | done | packages/core/src/pipeline/hosted-environment.ts, packages/core/src/pipeline/hosted-environment.test.ts, development-artifacts/patch-steward-m6-3.7-report.md | bcaf02126f5f84a9a5769374c6c1fa0d1df2e199 |
| 3.8 | 3 | done | fixtures/events/issues-opened.json, fixtures/events/issues-edited.json, fixtures/events/issues-edited-by-bot.json, fixtures/events/issues-edited-hostile.json, fixtures/events/issues-reopened.json, fixtures/events/issues-closed.json, fixtures/events/issues-closed-by-maintainer.json, fixtures/events/issues-deleted.json, fixtures/events/issues-opened-pull-request.json, fixtures/events/pull-request-target-opened.json, fixtures/events/pull-request-target-edited.json, fixtures/events/pull-request-target-synchronize.json, fixtures/events/pull-request-target-closed-merged.json, fixtures/events/pull-request-target-opened-fork.json, fixtures/README.md, development-artifacts/patch-steward-m6-3.8-report.md | 92f71f1eb7e87b2c4194dc1c82eee827a3b0f662 |
| 3.9 | 3 | done | packages/action/package.json, packages/action/tsconfig.test.json, pnpm-lock.yaml, packages/action/src/outputs.ts, packages/action/src/outputs.test.ts, packages/action/src/files.ts, packages/action/src/files.test.ts, development-artifacts/patch-steward-m6-3.9-report.md | 6e23f25c2243385d5c1b536f48cfb4b17709e1c8 |
| 3.10 | 3 | done | packages/core/src/evidence/store-world.test.ts, development-artifacts/patch-steward-m6-3.10-report.md | d15bbae033fa3d12151f2eeac84798c5498c9dd6 |
| 3.11 | 3 | done | packages/core/src/pipeline/hosted-world.test.ts, development-artifacts/patch-steward-m6-3.11-report.md | 239c1774571e6f33c1aa13537bdd762a0df543f0 |
| 3.12 | 3 | done | packages/core/src/pipeline/job-summary.ts, packages/core/src/pipeline/job-summary.test.ts, development-artifacts/patch-steward-m6-3.12-report.md | 260df842d1f188c69f14c00f0d77784ecbc6999c |
| 3.13 | 3 | done | packages/core/src/pipeline/hosted-gate.ts, packages/core/src/pipeline/hosted-gate.test.ts, development-artifacts/patch-steward-m6-3.13-report.md | 9bb0a997b82a36cd1d29a6cff2876f08ddf4e3f0 |
| 3.14 | 3 | done | packages/core/src/pipeline/hosted-evidence.ts, packages/core/src/pipeline/hosted-evidence.test.ts, development-artifacts/patch-steward-m6-3.14-report.md | 9af2ecd4bd037b67e151cf27c0111388dfc41e36 |
| 3.15 | 3 | done | packages/core/src/pipeline/hosted-freshness.ts, packages/core/src/pipeline/hosted-freshness.test.ts, development-artifacts/patch-steward-m6-3.15-report.md | 48b5fdf93575c41d94d6fc0f497b0fdf41751f9b |
| 3.16 | 3 | done | packages/core/src/pipeline/hosted-publish.ts, packages/core/src/pipeline/hosted-publish.test.ts, development-artifacts/patch-steward-m6-3.16-report.md | 83a8c4608d9a4c438de393861fd21f5647561446 |
| 3.17 | 3 | done | packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts, development-artifacts/patch-steward-m6-3.17-report.md | 0f329dbcff3c1ccdacdd8f096ab1da5f39c4cc09 |
| 3.18 | 3 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, packages/core/src/conformance/never-pass-hosted.test.ts, development-artifacts/patch-steward-m6-3.18-report.md | 94fff9dbb6d22c210f0059a872f473fd93dd33d0 |
| 3.19 | 3 | done | packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts, development-artifacts/patch-steward-m6-3.19-report.md | b8fa62ab7b62818d1edfc40cb706779c3e586664 |
| 3.20 | 3 | done | packages/core/src/conformance/invariant-2-hosted.test.ts, packages/core/src/conformance/invariant-8-hosted.test.ts, development-artifacts/patch-steward-m6-3.20-report.md | 40f4338bae45ed8ad58fde4e0ed163ab8ea83c51 |
| 3.21 | 3 | done | packages/core/src/conformance/invariant-4-hosted.test.ts, development-artifacts/patch-steward-m6-3.21-report.md | 75b1644b87ed2e4ec626acd4cf17523b8b73b7c8 |
| 3.22 | 3 | done | packages/core/src/conformance/invariant-7-hosted.test.ts, development-artifacts/patch-steward-m6-3.22-report.md | 9603a9b28059e73f78392b48ac48782256f266f8 |
| 3.23 | 3 | done | packages/core/src/conformance/write-allowlist.test.ts, packages/core/src/conformance/zero-execution.fixture.test.ts, development-artifacts/patch-steward-m6-3.23-report.md | fffacdb9bf6424f360f8bfdb1db317acc64c203a |
| 3.24 | 3 | done | packages/action/src/dispatch.ts, packages/action/src/dispatch.test.ts, packages/action/src/main.ts, development-artifacts/patch-steward-m6-3.24-report.md | d7ee54ab5d19d2f0211bcef0ed6a5bee8271738a |
| 3.25 | 3 | done | development-artifacts/patch-steward-m6-3.25-report.md | 0d26033e0de83191f70bb6c536fcadf549d634af |
| 4.1 | 4 | done | templates/policy/policy.yml, packages/core/src/submission/default-checklist.ts, development-artifacts/patch-steward-m6-4.1-report.md | 9f26b5bdc4786e24b17984f7791c5d3ea79be406 |
| 4.2 | 4 | done | .github/workflows/steward-screening.yml, packages/action/pack-runtime.sh, development-artifacts/patch-steward-m6-4.2-report.md | 482507e8d641fea10816fc6cfc4e6a56a3c0c208 |
| 4.3 | 4 | done | templates/workflows/steward-pr.yml, templates/workflows/steward-issues.yml, templates/README.md, development-artifacts/patch-steward-m6-4.3-report.md | efed5837c39d66cc1477c1effebd16612d59fe23 |
| 4.4 | 4 | done | packages/core/src/pipeline/hosted-verify.fixture.test.ts, development-artifacts/patch-steward-m6-4.4-report.md | 668d7958f696b1b5584f889fdee85438eefcefc2 |
| 4.5 | 4 | done | scenarios/fixtures/policies/orphan-branch.yml, scenarios/fixtures/policies/repository-store.yml, scenarios/fixtures/submissions/unstructured.txt, development-artifacts/patch-steward-m6-4.5-report.md | 8ee861fc62fbd27090f87daeb55c983f71fe1d96 |
| 4.6 | 4 | done | scenarios/tools/deploy-steward.sh, scenarios/tools/environment-check.sh, scenarios/tools/steady-state.sh, development-artifacts/patch-steward-m6-4.6-report.md | df8fde31f2913f78846a7e89e05d92ed7eca73b2 |
| 4.7 | 4 | done | scenarios/tools/find-runs.sh, scenarios/tools/artifacts.sh, scenarios/tools/audit.sh, development-artifacts/patch-steward-m6-4.7-report.md | b6135e84f3a45046f8c3cc39ac96a1645b95b894 |
| 4.8 | 4 | done | scenarios/tools/evidence.sh, development-artifacts/patch-steward-m6-4.8-report.md | ac9df0d8a3ae37c6038788670fa6f9e03ccf7e95 |
| 4.9 | 4 | done | scenarios/workflows/scenario-secret-scope.yml, scenarios/workflows/scenario-secret-scope-called.yml, scenarios/tools/secret-scope.sh, development-artifacts/patch-steward-m6-4.9-report.md | fef718036b64332041a2af31cdb63ee47ceb3ff8 |
| 4.10 | 4 | done | packages/core/src/conformance/workflows.fixture.test.ts, development-artifacts/patch-steward-m6-4.10-report.md | 7b81cc01629381131a729ff5f24f8a6956ddde30 |
| 4.11 | 4 | done | packages/core/src/conformance/invariant-1-workflows.fixture.test.ts, development-artifacts/patch-steward-m6-4.11-report.md | fae847ef43661e6c95d32411db478829d12b912d |
| 4.12 | 4 | done | scenarios/README.md, development-artifacts/patch-steward-m6-4.12-report.md | 8c31b0f822210dad8bfd461f7f2365d7b0ecbbf7 |
| 4.13 | 4 | done | development-artifacts/patch-steward-m6-4.13-report.md | 62786b0c6890199b7ac3f150becc1e75201b7fbb |
| 4.14 | 4 | done | scenarios/workflows/steward-pr.yml, scenarios/workflows/steward-issues.yml, development-artifacts/patch-steward-m6-4.14-report.md | 57508fc1dafa4ae24637e7d34e741d5a0fc03385 |
| 4.15 | 4 | done | development-artifacts/patch-steward-m6-4.15-report.md | aebfeb3d5459d8d7990be2d258ff1d84393a0b60 |
| 4.16 | 4 | done | packages/core/src/github/github.live.test.ts, packages/cli/src/steward-commands.live.test.ts, development-artifacts/patch-steward-m6-4.16-report.md | ebf4e7ba2e96e7a93c80d80745d8bbbf2bec4ff6 |
| 4.17 | 4 | done | development-artifacts/patch-steward-m6-4.17-report.md | 2da1d63c0e876d6fb32fa5f64d49a63d650fd809 |
| 4.18 | 4 | done | development-artifacts/patch-steward-m6-4.18-report.md | 9ef8fb1bfe46764c3626c33d694796b5e04880b9 |
| 5.1 | 5 | done | scenarios/tools/run-log.sh, scenarios/tools/await-runs.sh, scenarios/tools/find-runs.sh, development-artifacts/patch-steward-m6-5.1-report.md | 8d6e7e0ca682969b65dd98662553c5273d6c7cb3 |
| 5.2 | 5 | done | scenarios/tools/run-records.sh, scenarios/tools/evidence.sh, development-artifacts/patch-steward-m6-5.2-report.md | d48f2a9e26cf49fc89d54bcddc830c50fdb61e64 |
| 5.3 | 5 | done | scenarios/workflows/scenario-app-edit.yml, scenarios/tools/app-edit.sh, development-artifacts/patch-steward-m6-5.3-report.md | d7e3407a5c1789e94a82fe13099d98af67c0fef7 |
| 5.4 | 5 | done | scenarios/tools/pins.sh, scenarios/tools/results-check.sh, development-artifacts/patch-steward-m6-5.4-report.md | 43b378b4ac0419d20b4b7bd4124ac494b312f2bd |
| 5.5 | 5 | done | scenarios/fixtures/policies/invalid-limit.yml, scenarios/fixtures/policies/unwritable-store.yml, scenarios/fixtures/policies/caps-daily.yml, scenarios/fixtures/policies/caps-author.yml, scenarios/fixtures/pull-requests/steward-pr-modified.yml, development-artifacts/patch-steward-m6-5.5-report.md | 4b42502ff55a68ae49ddc5c94e920225efc18c8a |
| 5.6 | 5 | done | scenarios/README.md, development-artifacts/patch-steward-m6-5.6-report.md | 8cf796fd39e2932711307356798ae49eefebe4e8 |
| 5.7 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.7-report.md | b4d0b11249ef2084b4ce5b52ec0340c978c728ac |
| 5.8 | 5 | done | scenarios/results/personal.md, development-artifacts/patch-steward-m6-5.8-report.md | b8d5395c03851d1eac02773032b737fda03fba5f |
| 5.9 | 5 | done | scenarios/results/org-private.md, development-artifacts/patch-steward-m6-5.9-report.md | 85631ebb3c6f1c0d730dcd000e2b1dc7207d0a80 |
| 5.10 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.10-report.md | 81474ae6a1877db59afed89868f3dc473a887c97 |
| 5.11 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.11-report.md | 378299895c44003702984460c437df3fea0de5f3 |
| 5.12 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.12-report.md | 3e0ca5f96223b869c943a72d53a5cfe55670cd2f |
| 5.13 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.13-report.md | 4b9dfaf98bdd26e893ca9e8b15a9e5ffd4da3a9b |
| 5.14 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.14-report.md | a52a6304c5d5b7f0c30088c256254d771d386e5d |
| 5.15 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.15-report.md | 8a0d05836001bdfbe2dd33360040bdd006217732 |
| 5.16 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.16-report.md | 15e2c8acc5ca64159fce988ef61b4b0a1bb60d49 |
| 5.17 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.17-report.md | 6f3ff17c650e22d81e064cc07e0e954633a06cbe |
| 5.18 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.18-report.md | 4fdfe3fef1ef87dfd5206e93ad8fd8f2f73fae97 |
| 5.19 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.19-report.md | afdd06ab94e2e50566edc82e53f9037609f62c63 |
| 5.20 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.20-report.md | 24e31def2f9e573939c171b6c21b462cff6ed175 |
| 5.21 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.21-report.md | 503993c55b2033d7c310aaf76e24eb4dcec1aa18 |
| 5.22 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.22-report.md | 504caf3f43cdf3ce9de4ca3cf26e9ef52b9db6ff |
| 5.23 | 5 | done | scenarios/results/org-public.md, development-artifacts/patch-steward-m6-5.23-report.md | 56b5c7129c3e47ebcb5fae65262bb13d689b0602 |
| 5.24 | 5 | pending | scenarios/results/org-public.md, scenarios/results/personal.md, scenarios/results/org-private.md, development-artifacts/patch-steward-m6-5.24-report.md | |
| 5.25 | 5 | pending | development-artifacts/patch-steward-m6-5.25-report.md | |

### Phase 1 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m6): phase 1 steps`), base 08035c4 (the planner
  amendment of ES10 that this decomposition triggered; no phase 1 step embeds ES10). No new dependency, no network, no GitHub
  access; no file under packages/cli/, packages/action/, .github/, templates/, docs/ is in any scope. All steps route mechanical.
- Dependency graph (scopes pairwise disjoint within each wave; merge order within a wave is free):
  - W1 (parallel, no deps): 1.1 bounds; 1.2 vocabularies, record types, recordTreeIdSchema; 1.3 zip entry reader; 1.4 git blob id
    and store checks (append-only compare, read-back); 1.5 deduplication decision and echo predicate.
  - W2 (parallel; each starts once its own deps are merged): 1.6 waiting and supersession records (1.2); 1.7 ownership record
    (1.1, 1.2); 1.8 ownership artifacts, newest owner (1.1); 1.9 event authentication (1.1, 1.2); 1.10 run-name tags and caps
    (1.1, 1.2); 1.11 layout and manifest run_kind (1.2); 1.12 resolution metrics and hosted metrics builders (1.2); 1.13 job
    summary (1.1, 1.2).
  - W3: 1.14 root exports, exports test, invariant-5, never-pass-hosted (1.1 to 1.13).
  - W4: 1.15 gate (verification only; MAIN tree; after 1.14 merged).
  - Critical path: 1.1 or 1.2 -> any W2 step -> 1.14 -> 1.15.
- Environment / bootstrap:
  - Worker worktrees on short paths (C:/w/m6-<id>); `pnpm install --frozen-lockfile` per new worktree, sequentially.
  - Every acceptance runs its tests with the Vitest JSON reporter to node_modules/.m6-p1-<id>.json (ignored, not a tree change) and
    checks rendered titles with node; then the full `pnpm vitest run` (about 12 s; 141 files and 2673 tests at base), `pnpm
    typecheck`, eslint and prettier on the step's files, a static temp-file check, and a numeric control/bidi/zero-width check.
    jq is not installed.
  - The working tree is CRLF (core.autocrlf=true): acceptance greps never use a `$` anchor on file contents.
  - 1.14 also runs `pnpm build` and imports packages/core/dist. 1.15 runs IN the main tree.
  - Workers run Prettier only on their own .ts files, never on development-artifacts/.
- Couplings:
  - Only 1.14 edits packages/core/src/index.ts (87 -> 98 `export *` lines). Until then the new modules (net/zip-entry,
    evidence/blob-id, evidence/store-checks, records/waiting, records/supersession, ownership/*, pipeline/job-summary) are reachable
    only by relative import. 1.1, 1.2, 1.11, 1.12 add names to modules that are already root-exported (bounds, vocabulary,
    records/common, evidence/layout, evidence/metrics); all names were checked unique across core and cli (TS2308) and none starts
    with load, validate, resolve, parse, capture, or check.
  - exports.test.ts is edited by 1.2 (RECORD_TYPES 9 -> 12, new vocabulary tuples and schemas) and then by 1.14 (new modules).
  - invariant-5: parseRunName (1.10) is the only new root function matching the pinned prefixes; 1.14 adds it to the sorted list
    with a rejection assertion and fixes the pre-existing invariant5- temp-directory leak of that file.
  - 1.5 takes structural inputs whose listing kinds mirror 1.8 newestOwnershipArtifact ('none', 'unique', 'ambiguous',
    'incomplete') plus 'unavailable'; phase 3 maps the 1.8 result and the 1.7 decode result into DedupListingRead.
  - RECORD_TYPES gains ownership, waiting, supersession (1.2); only waiting.json is part of a run directory (1.11).
- Emergent contracts for phases 2 and 3 (pinned in the step files; names exact):
  - Constants (1.1): K38 OWNERSHIP_SETTLE_DELAY_MS; K39 OWNERSHIP_RECORD_MAX_BYTES; K40 OWNERSHIP_ARTIFACT_MAX_BYTES and
    OWNERSHIP_ARTIFACT_ENTRIES; K41 OWNERSHIP_LISTING_PAGES_MAX; K42 RUN_LIST_PAGES_MAX; K43 EVENT_PAYLOAD_MAX_BYTES; K44
    RUN_DISPLAY_TITLE_MAX_LENGTH; K45 EVIDENCE_CONFLICT_WAIT_STEP_MS and EVIDENCE_CONFLICT_WAIT_MAX_MS; K46
    EVIDENCE_FALLBACK_ENTRIES_MAX and EVIDENCE_FALLBACK_FILE_MAX_BYTES; K47 JOB_SUMMARY_MAX_LENGTH; K48 OWNERSHIP_RETENTION_DAYS;
    K49 APP_JWT_LIFETIME_SECONDS and APP_JWT_BACKDATE_SECONDS; K50 RUNTIME_ARCHIVE_MAX_BYTES; K51 SAME_RUN_ARTIFACT_RETENTION_DAYS.
  - Vocabularies (1.2): GATE_DISPOSITIONS, OWNERSHIP_DISPOSITIONS, CAP_STATES, WAITING_REASONS, SUPERSESSION_REASONS,
    RESOLUTION_KINDS, RUN_KINDS, WRAPPER_EVENT_NAMES, PULL_REQUEST_EVENT_ACTIONS, ISSUE_EVENT_ACTIONS, SENDER_TYPES (each with
    xSchema and type); recordTreeIdSchema (40 or 64 hex, never local).
  - Zip (1.3): readSingleZipEntry(bytes, { entryName, maxArchiveBytes, maxEntryBytes }) -> ok bytes or violation (reasons
    archive-bytes, archive with archiveReason, entry-count, entry-name, crc-mismatch); CRC and sizes from the central directory.
    Phase 2 passes OWNERSHIP_ARTIFACT_FILE, OWNERSHIP_ARTIFACT_MAX_BYTES, OWNERSHIP_RECORD_MAX_BYTES.
  - Store checks (1.4): gitBlobId(bytes); evidenceCompareSchema; verifyAppendOnlyCompare(compare, expectedPaths) (ES4);
    readBackTipAccepted(compare of new...tip) and verifyReadBackTree(entries, expected, 'exact' for a run directory or 'contains'
    for a metrics directory) (ES6). Paths passed in are whatever the caller lists (full store paths for compare, tree-relative for
    trees).
  - Dedup (1.5): decideDeduplication({ runAttempt, action, echo, listing, fallback, captured }) -> ok duplicate (echo,
    owner-unchanged, published-unchanged; keptOwner) or ok commit (rerun, reopened, no-owner, snapshot-changed, owner-ambiguous,
    listing-incomplete) or err ownership.listing-unavailable or ownership.record-invalid; order echo, rerun, reopened, listing
    rules; appliesListingDeduplication(runAttempt, action) (true exactly when runAttempt is 1 and action is not 'reopened': the
    listing-based rules and the ES10 fallback read decide; it NEVER gates the listing, which the gate performs for every event kind
    per DD8 step 2; phase 3 must not use it to skip the listing); isVerifiedEcho({ senderId, botUserId, triggeringResourceId,
    receipts }).
  - Records (1.6): waitingRecordSchema (state queued; reason consistent with counts; policy_revision tree id);
    supersessionRecordSchema (successor nullable; snapshot-changed requires live_snapshot_hash).
  - Ownership record (1.7): OWNERSHIP_ARTIFACT_FILE, OWNERSHIP_ARTIFACT_PREFIX, ownershipArtifactName(type, number),
    ownershipRecordSchema (check_id null, admission not-required, cap null exactly for early-exit, closure actions rejected),
    encodeOwnershipRecord -> canonical JSON bytes within K39, decodeOwnershipRecord(bytes, { repository, type, number,
    artifactName, workflowRunId }) with detail tokens size, encoding, json, schema, name, subject, repository, run.
  - Artifacts (1.8): newestOwnershipArtifact({ items, complete }, name) -> none, unique, ambiguous (sorted by id), or incomplete;
    items { id, name, createdAt, expiresAt, expired, workflowRunId }; artifactRetentionDays; ownershipRetentionShort.
  - Events (1.9): authenticateEvent(environment strings, payload bytes) -> AuthenticatedEvent or err gate.event-invalid (detail
    tokens name the failed check); eventIdentity(event) has the ownership record event keys; stewardConcurrencyGroup(repositoryId,
    type, number) = steward-<id>-<pr or issue>-<n>; closureResolution(event).
  - Caps (1.10): STEWARD_WRAPPER_PATHS; buildRunName and parseRunName (the RN1 grammar); runListQueryDate(now);
    evaluateCaps({ createdToday, inProgress, queued, now, botUserId, authorId, currentRunId, dailyLimit, authorLimit }) where each
    query result is { items: { id, path, event, status, createdAt, displayTitle }[], totalCount, complete } (phase 2 adapter sets
    complete false when pages exceed RUN_LIST_PAGES_MAX or any read fails).
  - Layout and manifest (1.11): WAITING_RUN_FILES, SUPERSESSIONS_DIRECTORY, supersessionStorePath, supersessionMetricsStorePath,
    repositoryStorePath(repository, storePath) -> '<owner>/<name>/<storePath>', latestRunDirectoryName(names) for the ES10 pick;
    manifest input runKind (written only when given; waiting manifests require the waiting run files and reject outcome files).
  - Metrics (1.12): maintainer-resolution payload optional keys resolution, paired_run, paired_snapshot_hash;
    buildWaitingMetricsEvents, buildSupersessionMetricsEvents, buildClosureMetricsEvent (closure resolution comes from 1.9
    closureResolution).
  - Job summary (1.13): renderJobSummary(input) with the exact line format pinned in step 1.13 (heading `## Patch Steward gate` or
    `## Patch Steward publish`, bullets Submission, Run, Status, then optional Snapshot, Policy revision, Owner, Caps, Evidence,
    Freshness, Ownership artifact retention, Failure); fitJobSummary(lines, max).
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed by them):
  - Module names refine the brief's layout: the pure parts of ES4 and ES6 live in evidence/store-checks.ts (evidence/git-store.ts
    stays for the phase 2 adapter); ES10's latest-directory pick is layout.ts latestRunDirectoryName; the job summary is
    pipeline/job-summary.ts as laid out.
  - Failure codes and causes: gate.event-invalid (infrastructure); ownership.listing-unavailable and ownership.record-invalid
    (github-unavailable; encode failure steward-defect); caps.run-list-unavailable (github-unavailable);
    evidence.store-not-append-only and evidence.readback-mismatch (infrastructure).
  - CP7 precedence: a created-today total_count over 1000 is over the daily cap even when that listing is incomplete (the API
    returns at most 1000 results, so CP6 cannot apply to it); in-progress and queued listings stay fail-closed.
  - CP2 path match also accepts a wrapper path followed by '@' and a suffix (tolerates a ref-suffixed `path`; confirm the real
    shape with phase 2 recorded run-list responses).
  - Ownership record decode additionally rejects a record whose run_id differs from the artifact's workflow_run.id when that id
    is known (strengthening of the forged-identity check).
  - check_id is z.null() and admission z.literal('not-required') in the ownership record (widened additively later).
  - The manifest writes run_kind only when the builder input sets it, so outcome manifests stay byte-identical to M05.
- Open items for later phases (not resolved here; no phase 1 step depends on them):
  - Brief DD7 and D4 say a verified echo is dropped "before capture", while DD8 orders capture, snapshot hash, echo, then the
    ownership listing, and DD7 needs the newest owner's receipts, which come from that listing. With no receipts recorded in M06
    the echo never fires, so the order has no behavioral effect now; decideDeduplication takes a precomputed echo flag and applies
    it first. The phase 3 decomposer should settle the gate order (amendment if the DD8 text must change). RESOLVED by amendment
    6f1e50c (DD8 rewritten: list for every event kind, closure branch, echo check, capture, dedup decision); see Revisions.
  - evidence/verify.ts (steward report) still requires decision.json and report.json and has no schema for the waiting,
    ownership, or supersession record types, so a waiting run directory does not verify. Phases 2 and 3 decide whether hosted
    verification needs it; the CLI stays unchanged.
  - OW7 successor attempt: the artifact listing gives workflow_run.id and created_at but no attempt; the supersession record
    successor is nullable; phase 3 decides whether to read the successor's record.
  - Job summary values (for example a long evidence location URL) are code spans truncated at 200 code units by the M05 escaper.
  - Pre-existing temp-directory leaks in packages/cli tests (prefixes policy-gitconfig-, policy-repo-, ps-cli-missing-) remain;
    packages/cli is out of scope in M06 except the live-test switch. The 1.15 leak check tolerates exactly those prefixes.
- Execution (supervisor, 2026-09-27):
  - Waves run: W1 1.1-1.4 in worktrees C:/w/m6-<id> (parallel with the decomposer revision of 1.5, 1.14, 1.15, commit 2230d48);
    W2 1.5-1.13 in worktrees; 1.14 and 1.15 in the main tree. All steps passed first try; no retry, no in-flight correction.
  - Worker deviations accepted (behavior unchanged): 1.1 relation test multiplies by `findPolicyLimit(...)?.max ?? NaN` (strict
    typecheck rejects arithmetic on a possibly undefined operand); 1.14 never-pass trigger for caps.run-list-unavailable passes full
    RunListQueryResult shapes and `now` as a Date, per the real evaluateCaps signature.
  - Post-merge integration after each wave (main tree): full vitest, typecheck, lint exit 0; final 153 files, 2928 tests.
  - All C:/w/m6-* worktrees and wt/patch-steward-m6-* branches removed. C:/w/m5-3.4 is a pre-existing M05 leftover, untouched.

### Phase 2 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m6): phase 2 steps`), base 78a6c7d (phase 1
  complete). The gate 2.13 uses 78a6c7d0831c350da98aa89e783a7ef1e333cace as the phase base (this decomposition commit touches only
  development-artifacts/). No new dependency; no file under packages/cli/, packages/action/, .github/, templates/, docs/ is in any
  scope. All steps route mechanical. No planner amendment was needed.
- Dependency graph (scopes pairwise disjoint within each wave; merge order within a wave is free):
  - W1 (parallel, no deps): 2.1 client object-list pagination and redirect read; 2.2 allowlisted writer; 2.3 prepared run
    evidence (publish.ts split) and hosted evidence location input; 2.4 read-only recordings (gh api) plus fixtures/README.md;
    2.5 ES10 fallback read.
  - W2 (each starts once its own dep is merged): 2.6 App auth (2.2); 2.7 ownership artifact adapter (2.1); 2.8 run list adapter
    (2.1); 2.9 git store commit ES1-ES5, ES7 (2.2).
  - W3: 2.10 store read-back ES6 and writeEvidenceCommit (2.9); 2.11 fixture test over the recordings (2.4 to 2.9).
  - W4: 2.12 root exports, exports test, never-pass-hosted (2.1 to 2.3, 2.5 to 2.10).
  - W5: 2.13 gate (verification only; MAIN tree; after 2.11 and 2.12 merged).
  - Critical path: 2.2 -> 2.9 -> 2.10 -> 2.12 -> 2.13.
- Environment / bootstrap:
  - Worker worktrees on short paths (C:/w/m6-<id>); `pnpm install --frozen-lockfile` per new worktree, sequentially.
  - Acceptance runs Vitest with the JSON reporter to node_modules/.m6-p2-<id>.json and checks rendered titles with node (all
    titles are plain it(...), none over it.each). jq is not installed. Greps never use a `$` anchor on CRLF files.
  - 2.4 is the only step with GitHub access: read-only `gh api` GETs on org-public and the public users endpoint; it never calls a
    /zip endpoint (signed URLs) and never prints a token. Recorded values are whatever GitHub serves at run time; 2.11 derives its
    expectations from the files.
  - 2.13 D5 blocks global fetch in every test process with NODE_OPTIONS='--import=data:text/javascript,globalThis.fetch=async()=>{throw(0)}'
    (dry-run at the base: 153 files, 2928 tests pass; a probe test proved the preload reaches Vitest workers).
  - 2.13 D10 greps packages and fixtures/github/hosted only: fixtures/github/testbed/pull-27-files.json (M05 recording) contains
    probe workflow patch text naming the probe secrets.
- Couplings:
  - client.ts is edited only by 2.1 (GitHubFetchInit.method stays the literal 'GET'; GITHUB_FAILURE_CODES stays 17); 2.7 and 2.8
    base-check its new methods.
  - writer.ts (2.2) is used by 2.6 and 2.9; githubRepositoryPath and githubBranchRefPath are the shared path builders the allowlist
    compares against.
  - 2.10 copies the fakeStore test helper from 2.9's test file (content coupling covered by depends_on).
  - Only 2.12 edits index.ts (98 -> 105 `export *` lines), exports.test.ts, and never-pass-hosted.test.ts. client.ts and publish.ts
    are already root-exported, so the names 2.1 and 2.3 add surface at their merge; every new name was checked unique across core
    and cli, and none starts with load, validate, resolve, parse, capture, or check (invariant-5 unchanged).
  - fixtures/README.md is edited by 2.4 now and by phase 3 later (sequential).
- Emergent contracts for phase 3 (pinned in the step files; names exact):
  - Client (2.1): getPaginatedList(path, listKey, itemSchema, query?, maxPages?) -> { items, totalCount, complete } (pages beyond
    maxPages give complete false, not a failure); getRedirectLocation(path, query?) -> absolute href (never followed).
  - Writer (2.2): createGitHubWriter({ token, scope, budget, fetch?, sleep?, now? }) with send(request, schema) and
    sendNoContent(request); scopes { kind: 'app' } and { kind: 'installation', store: { repository, branch } or null };
    isAllowedGitHubWrite is the I15 allowlist including body shape (force false, blob-only 100644 tree entries, at most one parent,
    one repository per token, read or write permissions); GITHUB_WRITE_FAILURE_CODES 'github.write-not-allowed' (steward-defect)
    and 'github.write-conflict' (HTTP 422, github-unavailable, never retried by the writer); GitHubAnyFetch (global fetch fits).
  - App auth (2.6): createAppJwt, lookupInstallationId, mintInstallationToken(credentials, repository, role, { budget, fetch? })
    with roles gate-target, store-read, publish-target, publish-store, publish-target-and-store (orphan-branch publish uses the
    merged role); InstallationToken.secret() keeps the token out of JSON; revokeInstallationToken; lookupAppBotUserId; failure
    codes app-auth.credentials-invalid and app-auth.token-scope-mismatch (credential-unusable). Phase 3 registers the private key
    and every token.secret() for redaction and masks them (a PEM key needs one ::add-mask:: per line).
  - Artifacts (2.7): listOwnershipArtifacts (OW6 own-artifact retention, OW7 re-list), downloadOwnershipRecord,
    readOwnershipListing (DD8 step 2 for every event kind; kinds unavailable, incomplete, none, ambiguous, unique with record
    valid, invalid, or unavailable), dedupListingRead -> DedupListingRead. Deps { resolver, transport }: phase 3 passes
    systemAttachmentResolver and httpsAttachmentTransport.
  - Runs (2.8): readCapRunLists(client, repository, now) -> { createdToday, inProgress, queued, failure } feeding evaluateCaps.
  - Store (2.9, 2.10): evidenceStoreLocation(policy.evidence.store, targetRepository); writeEvidenceCommit(input, { client, writer,
    sleep? }) = commitEvidence then readBackEvidence, input { store, targetRepository, subject, runId, runAttempt (the gate
    attempt, I12), groups, maxBytes (limits.evidence.run_bytes), writeRetries (limits.evidence.write_retries) } -> { commit, tree,
    parent, rebuilds, paths, head }. Groups: the run directory runs/<pr or issue>-<n>/<run-dir> in exact mode (prepared files plus
    manifest.json), metrics/<YYYY-MM> and runs/<pr or issue>-<n>/supersessions in contains mode. The writer must use scope
    installation with the same store. evidenceCommitMessage; hostedEvidenceLocation(store, targetRepository, storePath) gives the
    report location URL. Failure codes include evidence.store-conflict (infrastructure), evidence.store-not-append-only,
    evidence.readback-mismatch (detail tokens blob-create, commit-create, ref-update, tip, truncated, blob-id, missing, extra),
    evidence.layout-invalid, evidence.too-large, evidence.too-many-files, and pass-through GitHub codes.
  - Prepare (2.3): prepareRunEvidence(input with optional evidenceLocation, localRun false for hosted runs) -> files
    (run-relative, manifest excluded, log last), metrics { path, bytes }, manifestBytes, and the PublishedRun records; bytes equal
    the local store's. Waiting, supersession, and closure file sets are phase 3 work.
  - Fallback (2.5): readPublishedSnapshot(client, { store, targetRepository, subject }) -> DedupFallbackRead (none only for a 404
    submission directory or no run directory; everything else unexpected is unavailable).
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed):
  - The GET-only client gained two GET methods instead of a new module because pagination and redirect reads need its private
    transport; no failure code was added. The writer duplicates the transport so the client never gains a write method.
  - OW5 second hop reuses fetchAttachment (destinations = the Location host, maxRedirects 0, K40 bytes): an http Location is
    ownership.record-invalid (detail download-scheme); a non-public address is ownership.listing-unavailable (detail
    download-private-address). Both fail closed.
  - ES6 reads each committed directory with GET git/trees/<commit>:<path> (verified live on org-public before decomposition),
    recursive only for the run directory; the root commit of an absent branch has no ES4 compare (nothing exists to preserve),
    and a 422 on POST refs (branch created concurrently) is handled like a non-fast-forward.
  - Blob, commit, and ref-update responses are checked against locally computed ids (evidence.readback-mismatch).
  - ES10 treats a directory listing of 1000 or more entries as unavailable (the contents API truncates at 1000) and requires
    run.json's run id and attempt to equal its directory name.
  - EL1 is supported now (prepareRunEvidence evidenceLocation plus hostedEvidenceLocation); the M05 golden reports stay unchanged.
  - The recorded run list confirmed `path` has no '@' suffix on org-public; the tolerant match in ownership/caps.ts stays.
- Open items for phase 3 (not resolved here; no phase 2 step depends on them):
  - A publish re-run of the same gate attempt after its evidence commit succeeded rewrites the same paths and fails
    evidence.store-not-append-only; phase 3 decides whether to detect an existing run directory first.
  - Compare responses carry patches: evidence near limits.evidence.run_bytes could exceed GITHUB_RESPONSE_MAX_BYTES (5 MiB), and
    the compare API lists at most 300 files; both fail closed. M06 contract-level runs are small.
  - One committed outcome run costs about 2 + (file count) + 4 requests plus 1 + (group count) for read-back; a policy at the
    limits.github.requests_per_run minimum (10) cannot publish a run directory (exhaustion fails the job, never pass).
  - evidence/verify.ts still cannot verify a waiting run directory (phase 1 open item); OW7 successor attempt still open.
- Execution (supervisor, 2026-09-27):
  - Waves run: W1 2.1-2.5 in worktrees C:/w/m6-<id> at af7afd8; W2 2.6-2.9 at ded94d9; W3 2.10, 2.11 at 2752d3b;
    2.12 and 2.13 in the main tree. All steps passed first try; no retry, no in-flight correction, no revision, no amendment.
  - Worker deviations accepted (behavior unchanged, no contract affected): 2.1 getPaginatedList returns github.schema-mismatch
    WITHOUT details for structural page violations (non-object body, bad total_count, missing list array); zod item violations
    carry getJson-style details as specified. No later step inspects details of a structural list failure. 2.7 test helpers
    (fakeResolver, fakeTransport, bodyFrom) are trimmed copies of the attachment-fetch.test.ts helpers. 2.5 fixed a
    result.code vs result.failure.code slip before commit.
  - 2.4 recordings dated 2026-09-28 (UTC at record time). Supervisor scan of fixtures/github/hosted: no match for ghs_, ghp_,
    github_pat_, gho_, ghu_, ghr_, sig=, authorization, bearer, token, PRIVATE, x-github, STEWARD_APP_, or an e-mail pattern.
    runs-in-progress.json holds zero runs (total_count 0).
  - Post-merge integration after each wave (main tree): full vitest, typecheck, lint, format:check exit 0; final 163 files, 3062
    tests. Phase DoD D1-D10 re-run by the supervisor in the main tree: all PASS (D2 91 titles, D3 7 titles, D5 fetch-blocked
    test run 3062 pass, D8 leak check clean).
  - All C:/w/m6-* worktrees and wt/patch-steward-m6-* branches removed. C:/w/m5-3.4 is a pre-existing M05 leftover, untouched.

### Phase 3 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m6): phase 3 steps`), base 13d99dc (the planner
  amendment this decomposition triggered: WF7 same-run records, I22 publish policy by tree id, AT4 and I13 per-job budgets, OW6 moved
  to publish, new OW9 own-artifact read, ordered OW7 with `publish.freshness-unknown`; see Revisions). The gate 3.25 and every step
  acceptance use 13d99dc04943dca10e10ba9976b02ecdc90693fa as the phase base (the decomposition commit touches only
  development-artifacts/). All steps route mechanical. No file under packages/cli/, .github/, templates/, docs/, scenarios/, probes/
  is in any scope; the only dependency change is the action -> core workspace link (3.9).
- Dependency graph (scopes pairwise disjoint within each wave; merge order within a wave is free):
  - W1 (parallel, no deps): 3.1 loadPolicyRevision plus invariant-5 lists; 3.2 gate.ts split (gateCaptureSubmission,
    buildGateHandoff, gateContractLogLines; runGate unchanged in behavior); 3.3 gate context and closure records
    (pipeline/gate-context.ts); 3.4 pure freshness rules (ownership/freshness.ts); 3.5 waiting evidence
    (evidence/prepare-waiting.ts); 3.6 store groups for runs, supersessions, closures (evidence/prepare-records.ts); 3.7 runner
    environment reading (pipeline/hosted-environment.ts); 3.8 fixtures/events payloads plus fixtures/README.md; 3.9 action wiring
    (package.json dependency, tsconfig.test.json paths, pnpm-lock.yaml link) plus action outputs.ts and files.ts; 3.10 shared fake
    Git Data API store (evidence/store-world.test.ts); 3.11 shared fake GitHub (pipeline/hosted-world.test.ts); 3.12 job summary
    freshness vocabulary.
  - W2: 3.13 hosted gate (3.2, 3.3, 3.7, 3.10, 3.11); 3.14 hosted evidence (3.3, 3.5, 3.6); 3.15 hosted freshness (3.4, 3.11).
  - W3: 3.16 hosted publish (3.1, 3.3, 3.6, 3.7, 3.10-3.15); 3.17 gate fixture scenarios (3.8, 3.10, 3.11, 3.13).
  - W4: 3.18 root exports plus never-pass-hosted (3.1-3.7, 3.12-3.16); 3.19 publish fixture scenarios; 3.20 invariant-2 and
    invariant-8 hosted; 3.21 invariant-4 hosted; 3.22 invariant-7 hosted; 3.23 write allowlist plus zero-execution scan roots
    (3.19-3.23 each need 3.10, 3.11, 3.13, 3.16; 3.19 also 3.8; 3.23 also 3.9).
  - W5: 3.24 action entry (dispatch.ts, main.ts; needs 3.9 and 3.18 root exports).
  - W6: 3.25 gate (verification only; MAIN tree; after 3.17 and 3.19-3.24 merged).
  - Critical path: 3.11 -> 3.13 -> 3.16 -> 3.18 -> 3.24 -> 3.25.
- Environment / bootstrap:
  - Worker worktrees on short paths (C:/w/m6-<id>); `pnpm install --frozen-lockfile` per new worktree, sequentially. 3.9 runs a
    non-frozen `pnpm install` once to record the action link; after 3.9 merges run `pnpm install --frozen-lockfile` in the main tree
    before creating later worktrees (they base on the new lockfile).
  - Acceptance runs Vitest with the JSON reporter to node_modules/.m6-p3-<id>.json and checks rendered titles with node (all plain
    it(...), none over it.each). jq is not installed. Greps never use a `$` anchor on CRLF files. `git grep --untracked` is used for
    new files so the same command works before and after the step commit.
  - Tests never reach the network: every hosted call gets the world's fetch, attachment resolver, and transport and a no-op sleep
    (the publish settle delay is 10 s otherwise). 3.17, 3.19, and the gate D5 run with global fetch replaced by a throwing function.
  - Temp directories only in the action tests (prefix m6-act-, removed in afterEach; leak check in 3.9, 3.24, and gate D7).
- Couplings:
  - Shared test worlds: 3.10 (evidence/store-world.test.ts, createStoreWorld) and 3.11 (pipeline/hosted-world.test.ts,
    createHostedWorld) are .test.ts files that also EXPORT the fakes; later test files import them (importing re-registers their
    self-check tests in the importer; expected). They are excluded from the build by the existing **/*.test.ts exclusion. The
    store world is chained into the hosted world through `createHostedWorld({ handlers: [store.handler] })`.
  - Root exports: gate.ts (3.2) and loader.ts (3.1) are already root modules, so their new names surface at their merge; every
    other new module is root-exported only by 3.18 (index.ts 105 -> 114 `export *` lines). All new names were checked unique across
    packages/core/src and packages/cli/src; the only new root name with a pinned invariant-5 prefix is loadPolicyRevision (3.1 edits
    invariant-5.test.ts; nothing else touches it).
  - Single editors: gate.ts 3.2; job-summary.ts 3.12; index.ts, exports.test.ts, never-pass-hosted.test.ts 3.18;
    zero-execution.fixture.test.ts 3.23; fixtures/README.md 3.8; pnpm-lock.yaml 3.9.
  - ownership/freshness.ts and its test live in a directory that never-pass-hosted scans (no fs or network import, no `fetch(`
    text, test files included).
  - The existing invariant-2, -4, -7, -8 test files stay unchanged; the hosted extensions are new files
    conformance/invariant-{2,4,7,8}-hosted.test.ts (titles pinned in the brief live there).
- Emergent contracts for phase 4 (workflow, templates; names exact):
  - Entry: `node <runtime>/packages/action/dist/main.js gate` or `... publish`; exit 0 on success (gate: any disposition incl.
    duplicate and closure; publish: current, superseded, closure), 1 on failure, 2 on usage. The first stdout lines are
    `::add-mask::` commands for every line of PATCH_STEWARD_APP_PRIVATE_KEY; minted tokens are masked the same way.
  - Environment of the core step: the standard runner variables (GITHUB_EVENT_NAME, GITHUB_EVENT_PATH, GITHUB_REPOSITORY,
    GITHUB_REPOSITORY_ID, GITHUB_REF, GITHUB_SERVER_URL, GITHUB_API_URL, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, RUNNER_TEMP,
    GITHUB_OUTPUT, GITHUB_STEP_SUMMARY) plus PATCH_STEWARD_APP_ID and PATCH_STEWARD_APP_PRIVATE_KEY from the Environment secrets;
    publish also STEWARD_GATE_DISPOSITION, STEWARD_GATE_RECORD_ONLY, STEWARD_GATE_SNAPSHOT_HASH, STEWARD_GATE_POLICY_REVISION mapped
    from `needs.gate.outputs.*` through `env:` (never inside `run:`).
  - Gate step outputs (always all seven, single-line): disposition, commit ('true' only for runnable, early-exit, queued),
    record_only ('true' only for closures), concurrency_group, snapshot_hash, policy_revision, ownership_artifact. The workflow sets
    the job output `committed=true` only in a step after a successful ownership upload; `record_only` may be mapped directly.
  - Staging layout under RUNNER_TEMP: steward/handoff/handoff.json and steward/handoff/gate-context.json (upload as
    `steward-handoff`, path `${{ runner.temp }}/steward/handoff/`), steward/ownership/ownership.json (upload as the step output
    ownership_artifact), steward/closure/closure.json (upload as `steward-closure`), each retention 1 day except ownership (90);
    handoff before ownership. Publish downloads `steward-handoff` into `${{ runner.temp }}/steward/handoff/` or `steward-closure`
    into `${{ runner.temp }}/steward/closure/`.
  - Publish step outputs: status, freshness, evidence_commit, supersession_commit.
  - Test-bed policies keep `limits.github.requests_per_run` at the template's 300 (a policy at the minimum 10 cannot afford a
    hosted run; it fails with `github.budget-exhausted`, never pass).
- Decisions taken at decomposition (within the brief's latitude after amendment 13d99dc; no gate, DoD, or brief text changed by
  them):
  - New failure codes: `gate.policy-missing` (policy-unavailable), `gate.policy-invalid` (policy-invalid),
    `gate.repository-gate-unsupported` (policy-invalid), `action.environment-invalid` (infrastructure); missing or empty App
    credential variables reuse `app-auth.credentials-invalid`; `publish.freshness-unknown` per the amendment. All join
    never-pass-hosted (3.18).
  - The action validates the environment through core (pipeline/hosted-environment.ts, zod) because the action package may depend
    only on core (no direct zod dependency); the action's own modules are dispatch.ts, outputs.ts, files.ts, main.ts.
  - The gate redacts the handoff and gate context (and closure record) with the App key and minted tokens as exact values plus
    the policy patterns before encoding, so same-run artifacts carry no credential even if a submission contains one.
  - DD7 triggering resource id = the event's issue or pull request id; the hosted gate takes an optional receipts provider
    (default: none, as M06 records no receipts) so the echo rule is testable with synthetic receipts.
  - Closure pairing: a unique valid newest record pairs; none, ambiguous, or incomplete listings pair null; unavailable or invalid
    reads fail the gate (DD6).
  - Job summary freshness vocabulary is { state: current | superseded (reason) | unknown } (3.12 replaces 'confirmed').
  - Publish run records count only publish-side retries (0 recorded; the gate's retry waits are not transported); the request
    count is gate plus publish.
  - Open items from phases 1 and 2, resolved: (1) a publish re-run of the same gate attempt after a successful evidence commit
    fails `evidence.store-not-append-only` before any ref update (fail closed; a full workflow re-run is the recovery, it commits a
    new attempt); (2) compare responses over the 5 MiB cap or beyond the 300-file compare listing fail closed (a contract-level run
    commits about ten files); (3) a policy at the `limits.github.requests_per_run` minimum cannot afford a hosted run and fails with
    `github.budget-exhausted`, never pass (test-bed policies keep 300; phase 6 documents it); (4) evidence/verify.ts still verifies
    outcome run directories only (the CLI is unchanged in M06; waiting directories are checked by manifest schema and read-back);
    (5) the OW7 successor attempt is read from the newer artifact's validated record (amendment item 5).
- Execution (supervisor, 2026-09-27 to 2026-09-28):
  - Waves run: W1 3.1-3.12 in worktrees C:/w/m6-<id> at 4f5d5ab; W2 3.13-3.15 at 1d27f69 (3.13 retried at 32fec2c); W3 3.16, 3.17
    at f45ee79; W4 3.18-3.23 at 15fae5a; W5 3.24 at 344e5d2; 3.25 in the main tree at 325b652. After the 3.9 merge,
    `pnpm install --frozen-lockfile` in the main tree linked packages/action/node_modules/@patch-steward/core; lockfile diff is the
    action -> core link only (D4).
  - One in-flight correction (option b), no decomposer revision, no amendment: 3.13 first attempt (fdf0b5d, discarded) failed
    explicit reruns and reopened events on an unavailable listing, contrary to brief DD7 and DD1, DD2; the step file gained the rule
    "Early listing failure (non-closure events)" (fail before capture only when appliesListingDeduplication is true) and the test
    'a rerun or reopen commits despite an unavailable listing'; retry 1 passed (see Revisions).
  - Worker deviations accepted (behavior per brief, no contract affected): 3.4, 3.23 test artifacts given distinct workflow run
    ids or later createdAt to avoid unintended duplicates or ties; 3.9 edited the existing packages/action/tsconfig.test.json in
    place (rootDir '..', core paths alias); 3.14 'the report points at the hosted evidence location' uses the early-exit scenario
    (report.md carries the location only inside a rendered finding); 3.15 slices recorded requests from a count taken before the
    call; 3.17 asserts `'files' in result` false on failure paths; 3.20 invariant-2 hosted drives publish down the newer-owner path
    (a same-owner publish recaptures, and M04 capturePullRequest reads the head's proposed policy tree as data for the
    policy-change finding, so "no head tree request during publish" holds only on non-recapture paths; the proposed policy never
    governs: publish loads the trusted tree id and run.json records it); 3.20 invariant-8 'unknown freshness' override fails every
    artifacts listing from the second call on (the client retries once on 500); 3.24 test helper readTextOrEmpty for lint.
  - Post-merge integration after each wave (main tree): full vitest, typecheck, lint, format:check exit 0; final 186 files, 3440
    tests. Phase DoD D1-D11 re-run by the supervisor in the main tree: all PASS (D2 64 titles, D3 31 titles, D5 fetch-blocked test
    run exit 0, D7 leak check clean with 17 tolerated cli entries, D10 usage then exit 2, D11 114 export lines).
  - All C:/w/m6-* worktrees and wt/patch-steward-m6-* branches removed. C:/w/m5-3.4 directory (M05 leftover) untouched.

### Phase 4 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m6): phase 4 steps`), base 414ad77 (the planner
  amendment this decomposition triggered: WF6 publish group `needs.gate.outputs.concurrency_group` with the per-run fallback
  `format('steward-{0}-run-{1}', github.repository_id, github.run_id)` because the gate outputs an empty group for closures;
  WF8 only `build` checks out, after a steward_ref shell check, since G8 M1 forbids checkout in gate and publish; see Revisions).
  Phase base PB = 414ad77be6c63d4ccd5ea33d710285cc3a8c1014 (the decomposition commit touches only development-artifacts/). All
  steps route mechanical.
- Dependency graph (scopes pairwise disjoint within each wave):
  - W1 (parallel, no deps): 4.1 template evidence branch rename (template plus default-checklist.ts); 4.2 reusable workflow
    .github/workflows/steward-screening.yml plus packages/action/pack-runtime.sh (verbatim FILE BLOCKS); 4.3 wrapper templates plus
    templates/README.md (verbatim); 4.4 hosted run-directory verification fixture test (pre-flight for the smoke); 4.5 test-bed
    policies plus the smoke body; 4.6 tools deploy-steward, environment-check, steady-state; 4.7 tools find-runs, artifacts, audit;
    4.8 tool evidence.
  - W2: 4.9 secret-scope pair (verbatim) plus secret-scope.sh (4.2, 4.3); 4.10 static workflow tests (4.2, 4.3); 4.11 invariant-1
    workflow scan (4.2, 4.3).
  - W3 (parallel): 4.12 scenarios/README.md (4.5-4.9); 4.13 push of the milestone branch (4.1-4.11; report only). The pushed commit
    is the tree HEAD 4.13 starts from; it need not contain 4.12.
  - W4: 4.14 test-bed wrapper copies pinned to the 4.13 SHA (4.13, 4.3).
  - W5: 4.15 deploy wrappers and policies to the three test-beds (4.14, 4.5, 4.6; report only).
  - W6 (parallel): 4.16 live-test switch to the fork (4.15); 4.17 OA1 re-verify on org-public plus the org-public smoke (4.15,
    4.6-4.8; report only).
  - W7: 4.18 gate (verification only; MAIN tree; after all).
  - Critical path: 4.2 -> 4.10 -> 4.13 -> 4.14 -> 4.15 -> 4.17 -> 4.18.
- Outward actions (owner-authorized; the only GitHub writes of the phase): 4.13 pushes `HEAD:refs/heads/milestone/6-github-hosted-
  skeleton-gate-ownership-evidence-publish` once, never force; 4.15 writes .github/workflows/steward-pr.yml,
  .github/workflows/steward-issues.yml, .github/patch-steward/policy.yml on master of org-public, personal, org-private through
  scenarios/tools/deploy-steward.sh (probes deploy.sh); 4.17 creates exactly one issue `[scenario S00] hosted screening smoke` on
  org-public (GitHub then runs build, gate, publish; publish creates branch `steward-evidence` there). Read-only live calls: the
  acceptance of 4.6-4.8 (org-public, the private evidence repository over SSH, one `steward screen` of org-public issue 29),
  4.16 `pnpm test:live`, 4.18. No secret, Environment, App, or repository setting is touched; nothing on personal or org-private
  runs in this phase.
- OA1 on org-public is re-verified by 4.17 action 3 with the brief's four commands immediately before the smoke issue is created;
  a mismatch makes 4.17 report status fail with a line `OA1 not done on steady-orchard/patch-steward-testbed-public: ...`, which the
  supervisor returns as `needs-human` naming OA1. OA2-OA4 and OA1 on personal and org-private are not needed in this phase.
- Environment / bootstrap:
  - Worker worktrees on short paths (C:/w/m6-<id>); `pnpm install --frozen-lockfile` per new worktree, sequentially. 4.13 may run
    in its own worktree (it pushes the worktree HEAD) or the main tree; 4.15-4.17 need `pnpm build` in their tree (they run it).
  - actionlint 1.7.12 is installed locally (chocolatey); shellcheck is not, so actionlint skips script linting. Scenario workflows
    that call a local `./.github/workflows/...` reusable workflow lint with `-ignore 'could not read reusable workflow file'`.
  - Git Bash runs CRLF shell scripts; committed blobs are LF. Deployed files are compared by git blob id only.
  - Verbatim files: 4.2, 4.3, 4.9 extract FILE BLOCKS from their own step files with a node one-liner (4-space indentation
    stripped) and acceptance 1 prints `verbatim ok`. The decomposer verified every block with actionlint 1.7.12 and Prettier, the
    pack script by packing, extracting, and running `node .../packages/action/dist/main.js` (usage, exit 2), and dry-ran the
    acceptance of 4.1-4.3, 4.5, 4.9, 4.14, and the shell quoting of 4.15, 4.17, 4.18 in a scratch worktree (removed).
- Couplings:
  - Byte identity: the `secrets:` declaration block of steward-screening.yml (4.2) equals that of scenario-secret-scope-called.yml
    (4.9); the wrapper `secrets:` mapping of templates/workflows/steward-pr.yml (4.3) equals that of scenario-secret-scope.yml
    (4.9); `bash scenarios/tools/secret-scope.sh check` proves both (4.9 acceptance; `run` re-checks before every live use).
  - 4.10 and 4.11 pin exact strings of 4.2 and 4.3 (publish if, publish concurrency group, gate outputs, upload order, run-names,
    `main.js" gate`); a revision of either workflow file must revise its FILE BLOCK and re-check these tests.
  - 4.14 derives the copies from the templates by three edits (pin, trailing comment ` # pushed steward commit`, guard line after
    `    name: screen`) and reads PIN from 4.13's report line `pushed: <sha>`; deploy-steward.sh (4.6) extracts the pin from the copies.
  - 4.17 records `smoke_issue:`, `smoke_run:`, `evidence_commit:`; 4.17 acceptance and 4.18 D7 read them.
  - 4.6-4.8 acceptance holds only in the pre-deploy, pre-smoke state (copies absent, no `[scenario` submission, no
    `steward-evidence` on org-public); the graph verifies them in W1, long before 4.15 and 4.17.
  - Tool output formats (SCENARIO-DEPLOY, ENVIRONMENT, SCENARIO-STEADY, RUN and RUNS, ARTIFACT and ARTIFACTS, AUDIT, EVIDENCE,
    SECRET-SCOPE) are contracts for 4.15, 4.17, 4.18 and phase 5.
- Emergent contracts for phase 5:
  - Run shape: jobs listed as `screen / build`, `screen / gate`, `screen / publish`; each core step prints its log lines, then
    `steward job summary:` and the job summary (between `::stop-commands::` markers), so `gh run view --log` shows the summary
    (there is no REST API for job summaries); the publish summary names the evidence commit, and the commit's committer date
    precedes the log timestamp of the summary (S08 evidence).
  - Publish concurrency groups: `steward-<repository id>-<pr or issue>-<n>` for committed runs; `steward-<repository id>-run-<run
    id>` for closures (record-only) and whenever the gate output is empty.
  - Same-run artifacts `steward-runtime`, `steward-handoff`, `steward-closure` (1 day) appear in the repository artifact listing;
    ownership artifacts `steward-ownership-<pr or issue>-<n>` (90 days).
  - Test-bed files on master of all three test-beds: the two wrappers (pin = 4.13 SHA, guard for 2095171 and 331019482) and
    `.github/patch-steward/policy.yml`. A defect fix needs a new fast-forward push, regenerated copies (the 4.14 node command with
    the new PIN), and `deploy-steward.sh <key>` per test-bed.
  - Not created in phase 4 (phase 5 adds them as needed): scenario policy variants for S06 (invalid), S07 (unwritable store), S11
    (caps), deployed with `deploy-steward.sh <key> <policy file>` and restored afterwards; the S03 App-token title-edit helper (it
    must take App credentials from the Environment secrets PATCH_STEWARD_APP_*, never the probe suite's secrets; choosing how it
    mints a token is phase 5 work, noting the brief rejects actions/create-github-app-token for the product); contract-met
    submission bodies; scenarios/results/*.md.
  - Phase 4 end state (4.18 records it): wrappers and policies deployed and active on the three test-beds; issue `[scenario S00]`
    left OPEN on org-public (closing it starts a closure run; phase 5 closes it within a scenario or at steady state);
    `steward-evidence` on org-public holds the smoke commit; no scenario helper deployed; nothing run on personal or org-private.
- Decisions taken at decomposition (within the brief after amendment 414ad77; no gate, DoD, or brief text changed by them):
  - Action pins read from the upstream tags on 2026-09-28: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 (v7.0.1),
    actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 (v7.0.0), actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
    (v7.0.1), actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c (v8.0.1).
  - Runtime packing in packages/action/pack-runtime.sh (run by build; testable locally): packages/{core,action}/{package.json,dist},
    node_modules/{zod,yaml} dereferenced, node_modules/@patch-steward/core symlink to ../../packages/core; about 1.9 MB; size and
    SHA-256 checked before `tar -x` in gate and publish.
  - setup-node `package-manager-cache: false`; `COREPACK_ENABLE_DOWNLOAD_PROMPT: '0'` for corepack.
  - Core steps run with `set +e`, then print the summary between stop-commands markers and exit with the steward's status.
  - Template `steward_ref` is a quoted string (YAML reads forty zeros as the integer 0). Templates carry no header comment and no
    guard.
  - Test-bed policies derived from fixtures/policies/valid/minimal-no-llm.yml (orphan-branch.yml for org-public and personal,
    repository-store.yml for org-private; limits.github.requests_per_run 300).
  - Tool names carry no planning ids (environment-check.sh runs the OA1 verify commands).
  - Live-test switch: the unsynced fork has no `.github` directory (contents 404) and issues disabled; screen loads the policy
    before any issue read, so `--issue 29` on the fork stops at screen.policy-missing.
- Open risks (surface in 4.17; handled through the supervisor revision loop, never worked around): checkout of the public steward
  repository with an empty-permission job token; corepack under setup-node Node 24; setup-node's version-manifest read with an
  empty-permission token; the artifact download redirect host (OW5); `gh run view --log` job-name column for called workflows
  (4.17 acceptance 5 matches job names ending in `publish`).
- Execution record (supervisor):
  - W1 (4.1-4.8) and W2 (4.9-4.11) verified in their worktrees (acceptance re-run, scope clean, one commit each), merged; full
    typecheck and vitest re-run in the main tree after each wave (189 files, 3474 tests after W2).
  - Pre-push checks P1-P9 of 4.13 re-run by the supervisor in the main tree at 7161cd2 before launching 4.13: all passed.
  - Pushed commit (PIN for test-bed wrappers): 7161cd20df662314d14cc7f2f4130102baee1e98 = origin
    refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish (first push; branch was absent on origin).
  - Minor wording defect noted, not blocking: scenarios/tools/find-runs.sh header and scenarios/README.md say it lists
    "completed" runs; the tool lists runs of any status (4.17 relies on that to find an in-progress run). Fix in a later
    wording pass (phase 6 scenarios/README.md review).

### Phase 5 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m6): phase 5 steps`), base d1af537
  (planner amendment: OA3 verify names the real gate and publish signals). Phase base PB = d1af5375321637fe8b1e9b325b6ababb62ee6b58 (the decomposition commit touches only
  development-artifacts/). All 25 steps route mechanical. Only scenarios/ and development-artifacts/ change; no product code,
  no dependency, no push of this repository; test-bed wrappers keep pin 7161cd20df662314d14cc7f2f4130102baee1e98.
- S10 merge closure (the previous decomposition attempt stopped on a planner needs-human; the item-1 row in Revisions): the
  lead resolved it without an amendment or owner decision. The planner's premise (pull_request_target runs with
  GITHUB_REF refs/heads/<base>, so a PR into a scenario-* base fails EV2 and the Environment rule) is refuted by
  probes/findings.md PA03.1 and PA03.5 and probes/pa03-trusted-triggers/results/org-public.md E5 (PR 16 into
  probe-pa03-base: ref=refs/heads/master, default-branch definition, Environment admitted). The brief S10 procedure stays
  (merge into `scenario-s10-base`). Step 5.20 classifies both runs of that PR (pass, refused-event-invalid,
  refused-environment, other-failure) and its acceptance 1 prints the live case next to the reported one; a refused case is
  a platform-change finding for the supervisor's revision loop (5.20 then stops without merging).
- Dependency graph (scopes pairwise disjoint within each wave):
  - W1 (parallel, no deps, no GitHub write): 5.1 tools run-log.sh and await-runs.sh, find-runs.sh header wording; 5.2
    run-records.sh and evidence.sh waiting-run verification; 5.3 App edit helper workflow (verbatim FILE BLOCK) and
    app-edit.sh; 5.4 pins.sh and results-check.sh; 5.5 fixtures (four policy variants, modified wrapper).
  - W2 (parallel; live steps on different test-beds): 5.6 scenarios/README.md (needs 5.1-5.5; no GitHub access); 5.7
    org-public OA1 re-verify plus S17, creates org-public.md (needs 5.1, 5.4); 5.8 personal OA1 re-verify, S17, S15 (OA4
    proof), creates personal.md (needs 5.1, 5.2, 5.4); 5.9 org-private OA1 and OA2 re-verify, S17, S16 (OA3 proof), creates
    org-private.md (needs 5.1, 5.2, 5.4).
  - org-public chain, strictly sequential (every step writes org-public.md; caps and timing need an otherwise idle
    test-bed): 5.10 S09 (first: runnable, caps-sensitive) -> 5.11 S01+S02 -> 5.12 S03 (+5.3) -> 5.13 S04 -> 5.14 S08
    (read-only) -> 5.15 S05 -> 5.16 S06 -> 5.17 S07 -> 5.18 S10 issue part one -> 5.19 S10 issue part two (+5.3) -> 5.20 S10
    pull requests -> 5.21 S11 daily -> 5.22 S11 per-author -> 5.23 S12.
  - 5.24 S13 and S14 on all three test-beds plus steady state (needs 5.23, 5.8, 5.9, 5.4); 5.25 gate (verification only,
    MAIN tree; needs 5.6, 5.24).
  - Critical path: 5.4 -> 5.7 -> 5.10 -> ... -> 5.23 -> 5.24 -> 5.25 (about 14 live steps of 5-15 minutes each).
- Owner actions (placement of the brief's re-verify rule): OA1 org-public in 5.7 (start of the phase); OA1 personal in 5.8
  before S17 and S15; OA1 org-private and OA2 in 5.9 before S17 and S16; OA4 proved by the S15 publish commit (5.8); OA3
  proved by the S16 gate `listing none` then `dedup commit no-owner` and the publish commit in the evidence repository
  (5.9). A failing verify or proof makes the step write a report line `OA<n> not done on <repository>: <evidence>` with
  status fail and no results file; the supervisor returns `RESULT: needs-human` naming the action. Results files never name
  owner actions ("the publication Environment check", "the evidence repository check").
- Outward actions (all authorized: test-bed issues, PRs incl. the fork PR, branches, workflow and policy deploys through
  deploy tools, dispatches, one rerun, workflow disable, merges into scenario-* bases): 5.7-5.9 deploy the secret-scope pair
  to each test-bed master and dispatch it; 5.8, 5.9 one issue each; 5.10 branches scenario-s09-same (org-public) and
  scenario-s09-fork (fork; its master untouched) and two PRs; 5.11 branch scenario-s01-head and PR P1 (edited by 5.11-5.17);
  5.12 and 5.19 deploy scenario-app-edit.yml to org-public master and dispatch it (title edit of P1; close of the S10
  issue); 5.16, 5.17, 5.21, 5.22 deploy a policy variant to org-public master and restore orphan-branch.yml after all runs of
  the scenario completed (tree id back to d997b1e362c75af03942da0e7a1e8902ca5dbe51; checked by the next step too); 5.18,
  5.19 one issue lifecycle; 5.20 branches scenario-s10-close, scenario-s10-base, scenario-s10-merge, two PRs, one merge into
  scenario-s10-base; 5.21, 5.22 two to four contract-met issues; 5.23 `gh run rerun 36397673122` (the S00 run, issue 31);
  5.24 steady-state.sh apply on the three test-beds (disables steward-pr.yml, steward-issues.yml, scenario-*; closes every
  open `[scenario S` issue and PR, including issue 31, P1, the S09, S11, S15, S16 submissions). Never touched: org-public
  issue 29, PRs 26 and 27 (closed or merged probe items), the fork's master. org-private: two runs only (S17, S16).
- Couplings:
  - Results files: org-public.md is written only by the chain 5.7 -> 5.10 ... 5.23 -> 5.24 (append-only sections);
    personal.md by 5.8 then 5.24; org-private.md by 5.9 then 5.24. A scenario may have several sections (`## S10 ...` three,
    `## S11 ...` two); results-check.sh requires every section of a listed id to contain `Result: pass`.
  - Report key lines read by later steps (column 0): 5.7 `s17_run`; 5.8 `s17_run`, `s15_issue`, `s15_run`, `s15_commit`; 5.9
    `s17_run`, `s16_issue`, `s16_run`, `s16_commit`; 5.10 `s09_master_tree`, `s09_same_pr`, `s09_same_run`, `s09_fork_pr`,
    `s09_fork_run`; 5.11 `s01_pr`, `s01_run`, `s01_commit`, `s02_run`; 5.12 `s03_helper_run`, `s03_run`; 5.13 `s04_try`,
    `s04_old_run`, `s04_new_run`, `s04_new_commit`; 5.15 `s05_try`, `s05_runs`; 5.16 `s06_run`, `s06_newest_artifact`; 5.17
    `s07_run`, `s07_failure`; 5.18 `s10_issue`, `s10_open_run`, `s10_title_run`, `s10_body_run`; 5.19 `s10_close_run`,
    `s10_reopen_run`, `s10_app_close_run`; 5.20 `s10_close_pr`, `s10_close_pr_run`, `s10_merge_pr`, `s10_merge_opened_run`,
    `s10_merge_closed_run`, `s10_merge_opened_case`, `s10_merge_closed_case`; 5.21 `s11_daily_issue`, `s11_daily_run`; 5.22
    `s11_author_issue`, `s11_author_run`; 5.23 `s12_newest_artifact_created_at`. 5.14 reads 5.11 and 5.13; 5.19 reads 5.18;
    5.25 D11 reads 5.8 and 5.9.
  - Time-bound acceptance: 5.11 acceptance 3 (one artifact, one run directory for P1) and 5.15 acceptance 2 (newest owner of
    P1) hold only until the next scenario touches P1: verify each step right after it, before launching the next.
  - Live acceptance re-derives facts read-only (run logs via run-log.sh, run-records.sh, artifacts.sh, evidence.sh); none
    writes to GitHub. The phase gate 5.25 re-runs audit, pins, steady-state plan, results-check.
- Environment facts (measured on the S00 run 36397673122): `gh run view --log` lines are job TAB step TAB `<timestamp>
  <text>`; the job column is `screen / <job>` (called workflow) or `<job>`; a byte order mark precedes the timestamp on each
  job's first line; the step's own script is echoed with text starting `^[` (two literal characters, no raw escape);
  masked values print `***`. run-log.sh normalizes this (echo lines dropped, credential-like lines withheld). Git Bash
  rewrites `gh api` endpoints starting with `/`. Bash tool calls stop at 600 s: waiting tools run with PROBE_WAIT_SECONDS=540
  and are repeated once on exit 3. Live steps run `pnpm install --frozen-lockfile && pnpm build` in their worktree
  (evidence.sh needs the built CLI; results-check.sh calls prettier).
- Decisions taken at decomposition (within the brief; no gate, DoD, or brief text changed):
  - New scenario tools (persistent, scenarios/tools/): run-log.sh, await-runs.sh, run-records.sh (SSH shallow clone of the
    store branch or a local root), app-edit.sh, pins.sh, results-check.sh. evidence.sh gains waiting-run verification
    against the manifest (it counted waiting runs as unverified, so any submission with a queued run ended result=failed).
    The find-runs.sh wording defect from the phase 4 notes is fixed in 5.1 and in the README (5.6).
  - S03 and the closed-by-maintainer closure use the helper workflow scenario-app-edit.yml: workflow_dispatch only, sender
    2095171 only, Environment steward-publication for PATCH_STEWARD_APP_ID and PATCH_STEWARD_APP_PRIVATE_KEY, mints a
    repository-scoped installation token with node:crypto (no third-party action; actions/create-github-app-token is not
    used, as for the product), one PATCH, token revoked, status codes only. Decomposer verified it with actionlint, Prettier,
    node --check, and a mocked-fetch run.
  - S04 timing: the second body edit is made right after the older run's gate job completes (20 s polls), because the gate
    captures the body live about 30 s after the event; two edits seconds apart are captured identically and the second run
    ends duplicate. Up to 3 tries. S05: three back-to-back edits; runs that captured an unchanged snapshot end duplicate and
    count as neither committed nor superseded; pass = the newest committed owner is the only current publish, others
    superseded or cancelled pending; up to 3 tries (a created_at tie makes publish fail freshness-unknown: retry).
  - S09 uses caps-daily.yml as the proposed policy (it would queue the run if it governed) and steward-pr-modified.yml as the
    proposed wrapper (a run defined by it would be named `modified steward pr <n>`); master's definition shows as run name
    `steward-pr` and the RN1 display title. S09 runs first in the chain (daily cap 50 counts every non-bot wrapper run of the
    UTC day; per-author cap 2 counts the run itself, so the two PRs run sequentially on an idle test-bed).
  - S07 targets P1 (already owned), so the gate never reads the separate store; the expected publish failure is at the store
    installation lookup (`github.not-found`), before any evidence request.
  - S11 daily opens two contract-met issues (the second is always over a daily cap of 1 within one UTC day; a third only
    across a date change); S11 per-author opens two back to back under per-author cap 1 (one retry pair if they do not
    overlap). Policy variants are restored only after every run completed (publish recaptures with the live default-branch
    policy; an early restore would supersede the run as snapshot-changed).
  - Results format: `## S<nn> <title>` sections with `$ <command>` plus verbatim output in `text` fences and a final
    `Result: pass` line; S17 sections keep the four exact `SECRET-SCOPE job=... line=PATCH_STEWARD_APP_... length-zero=...`
    lines and drop the echoed-script `line=^[...` lines. results-check.sh rejects planning ids, probe secret names, token or
    key text, `^[`, and control characters.
- Dry runs by the decomposer (scratch worktree C:/w/m6-p5dry, removed): reference implementations of the W1 tools passed
  every acceptance of 5.1-5.5; the fixtures generator reproduces the verified files; every acceptance command of 5.7-5.25
  passes `bash -n`; the verbatim action snippets of 5.13 and 5.15 pass `bash -n`; the S04, S05, S08, S15-style, and merge-case
  checks were run against the S00 run (or synthetic data for S05) to confirm their parsing.
- Open risks (handled through the revision loop, never worked around): fork PR capture with a target-scoped token (S09);
  deployments on PR head commits (S13 head_deployments); Environment refusal for a non-default base (S10, classified);
  GitHub timing (S04, S05 retries); the replaced-artifact behavior of a rerun (S12 accepts count 1 or 2 via the newest
  artifact); a product defect found live needs local checks, a non-forced push, regenerated wrapper copies with the new pin,
  and redeploys (phase 4 procedure; pins.sh derives the pin from scenarios/workflows/steward-pr.yml).

## Revisions

<!-- supervisor appends: phase | failed step | revision note | outcome -->

| Phase | Trigger step | Amendment | Outcome |
| --- | --- | --- | --- |
| all (before phase 1) | owner gate (2026-09-27) | Owner gate answered: Q1-Q8 and Q10-Q16 A, Q9 C, Q17 owner performs OA1-OA4. Brief: gate items, I-list, owner actions marked APPROVED and binding; product secret names changed to `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY` in WF1, WF4, WF12, WF13, AT1, OA1, G11 inventory, module layout, conformance titles, constraints; added SC5, S17, I21, project DoD item 18; re-pinned DoD items 8, 10, 12, 16; owner actions gained verify blocks and a needed-first-by column. Roadmap: gate APPROVED, S01-S17, earliest phase per OA, phase 4 needs OA1 on org-public only, phase 5 names the rest, phase 6 DoD items 1-18. | brief amended |
| 2 (found in phase 1 decomposition) | decomposer, phase 1 decomposition | Brief G4 ES10 named `submission.json` as the fallback source, but the submission record has no policy revision. ES10 now reads the run's `run.json` (same K46 bound, same single file read), validated with `runRecordSchema`, requires `subject.kind` `submission` matching the event's repository, type, number, and uses `subject.snapshot_hash` and `policy_revision`; schema or subject mismatch is treated as unavailable (DD6). Stale-fact correction plus stricter validation; no bound, scope, or DoD change. Ripple checked: DD4, OW8, K46, module layout `fallback-read.ts`, roadmap phase 2 scope and DoD cite ES10 generically and stay unchanged. No step file embeds ES10. | brief amended |
| 1 and 3 (open item recorded in Phase 1 notes) | owner decision 2026-09-27 (amendment note item 1; resolves the Phase 1 notes open item on the echo-check order) | Brief G2 DD8 rewritten as 8 numbered steps in the owner's order: authenticate (EV2, token mint and bot user id, trusted policy load, repository-gate check I5) -> ownership listing OW3, newest owner OW4, unique record download OW5 and validation OW2 (every event kind incl. reruns, reopens, closures; never skipped) -> closure branch EV4 (paired from that listing; never echo-dropped) -> verified-echo check DD7 (duplicate reason echo; stops before capture) -> capture and snapshot hash -> deduplication decision DD1-DD6 (ES10 fallback read only when listing kind none and neither rerun nor reopened) -> contract and caps -> commit. Policy load stays before the listing because the listing uses the policy budget (I13). DD7: receipts come from the unique newest owner's valid record, else the set is empty; an unverifiable echo is not an echo and the listing outcome reaches the decision unchanged. EV4: pairs from the DD8 step 2 listing; an unavailable listing fails before any upload (DD6). D4 and I1 aligned. Roadmap phase 3 DoD gains two fixture assertions (listing before capture; a verified echo captures and uploads nothing). Step impact: no step file edited; step 1.5 decideDeduplication contract stays valid unchanged (precomputed echo flag applied first; always false in the hosted gate after DD8 step 4). Contract-meaning change: needsOwnershipListing (defined in 1.5; re-exported and title-checked in 1.14 and 1.15) no longer decides whether the gate lists (the gate always lists); its truth table now states only when the ES10 fallback read and the listing-based dedup rules apply; its name and the 1.5 test title "the listing is needed only for first attempts of non-reopen events" are misleading but behaviorally correct; the decomposer may revise pending 1.5, 1.14, 1.15 (rename or retitle) or leave them; phase 3 must not use it to skip the listing. | brief amended |
| all (before phase 1 execution) | owner report 2026-09-27 (amendment note item 2) | Owner actions: owner reported OA1-OA4 complete 2026-09-27. OA1 verified by the lead on all three test-beds (Environment steward-publication secrets PATCH_STEWARD_APP_ID and PATCH_STEWARD_APP_PRIVATE_KEY, deployment branch policy master, no repository secret named PATCH_STEWARD_*); OA2 verified by the lead (steady-orchard/patch-steward-testbed-evidence private, 1 commit); the planner re-ran every brief OA1 and OA2 verify line (incl. organization secrets) and each printed its expected value. OA3 and OA4 remain proved only by S16 and S15. Updated: brief top paragraph, Owner actions heading and new Status table, Q17 row, Constraints, Assumptions; roadmap intro, phase 4 and phase 5 Depends on; ledger owner-actions. The re-verify-before-use rule is unchanged (no gate weakened). | brief amended |
| 1 | 1.5 (pre-run; pending dependents 1.14, 1.15) | Supervisor revision note before launch: after amendment 6f1e50c the gate always lists ownership artifacts, so the 1.5 helper name `needsOwnershipListing` and its test title "the listing is needed only for first attempts of non-reopen events" falsely implied the listing can be skipped. Decomposer revised in place (none of the three had run; superseded text reachable at 06e7f93): helper renamed `appliesListingDeduplication(runAttempt, action)` (unique across packages/core and packages/cli; no pinned invariant-5 prefix), truth table unchanged (true exactly when runAttempt is 1 and action is not 'reopened'); test retitled "listing-based deduplication applies only to first attempts of non-reopen events"; 1.5 context states the caller lists for every event kind and the helper never gates the listing. Updated 1.5 API block, rule text, title list, acceptance; 1.14 context, base check, functionExports, dist import check; 1.15 D2 title list (still 48 titles); Phase 1 notes Dedup (1.5) contract and the resolved echo-order open item. decideDeduplication, DedupInput, and every other contract unchanged. | steps 1.5, 1.14, 1.15 revised in place |
| 3 (found in phase 3 decomposition; no phase 3 step file existed) | decomposer, phase 3 decomposition (amendment note items 1-5) | Classified: items 1, 2, 4 gap-fills (strengthening: added transport, validation, and binding; no bound, constant, scope, job, permission, or DoD gate relaxed); item 3 replaces an unsatisfiable rule while keeping D1's "effective value recorded"; item 5 resolves a contradiction fail-closed in line with D1 "a tie blocks publication". Item 1: WF7 rewritten: `steward-handoff` = `handoff.json` (M05 schema unchanged) + `gate-context.json` (strict versioned gate context record, fields listed, canonical JSON at most K37); `steward-closure` = `closure.json` (strict versioned closure record incl. remaining request budget and the one maintainer-resolution event); publish validation before evidence (`pipeline.handoff-invalid`, `pipeline.handoff-binding`); DD8 step 8 and EV4 aligned. Item 2: new I22 (publish loads the gate's policy by recorded tree id via git/trees and the policy.yml blob, same checks as the GitHub policy source; commit and ref from the gate context; never the head's or live default-branch policy for evidence); AT4 per job (publish spends a fresh K19 bootstrap budget on JWT, installation lookups, mints, revocations, and the tree-id policy load); I13 rewritten (later publish requests use the handoff remainder or the closure record's remaining count with the loaded policy's retries_per_request); module layout gains the loader function (e.g. loadPolicyRevision; invariant-5 list). Item 3: OW6 moved to publish (retention from its own artifact via OW9; run log, logs/steward.txt, publish summary; gate summary reports none). Item 4: new OW9 (publish own-artifact read before the evidence commit: select by workflow_run.id, else `ownership.listing-unavailable`; download and validate, else `ownership.record-invalid`; binding to gate context and handoff, else `pipeline.handoff-binding`; created_at is the WS1 arrival_at and the OW7 reference; expires_at gives retention); WS1 and I12 aligned. Item 5: OW7 rewritten as ordered (a) listing unavailable or incomplete or own artifact absent or changed -> unknown, (b) any tie at the greatest created_at -> unknown, (c) unique newer owner -> download and validate its record: valid -> superseded newer-owner with successor run attempt from that record, else unknown, (d) own artifact newest -> recapture with the live default-branch policy: failure -> unknown, changed hash or revision -> superseded snapshot-changed, else confirmed; unknown fails with new code `publish.freshness-unknown` (github-unavailable). Resolves the Phase 1 and Phase 2 notes open item "OW7 successor attempt". Ripple: Context plan-wide DoD rows (runtime validation, injections), WF11 (publish summary retention and freshness), SS1 successor wording, module layout, conformance invariant-2, -4, -8 content (titles unchanged); roadmap phase 3 scope, DoD (five added fixture assertions, strengthening only), risks. Project DoD unchanged. No step file edited (none exists for phase 3). | brief amended |
| 3 | 3.13 (first attempt, commit fdf0b5d on the discarded wt branch) | Supervisor in-flight correction (option b). Defect: the 3.13 rule text routed listing failures of non-closure events through decideDeduplication (after capture), while the test 'an unavailable listing fails before capture' demanded no capture request; the worker resolved the conflict by failing on ANY listing failure right after the listing read, which also failed explicit reruns and reopened events, contradicting brief DD7 ("DD6 then fails closed for every event other than DD1 and DD2") and DD1, DD2. Fix: new rule "Early listing failure (non-closure events)": return the listing failure before echo and capture only when appliesListingDeduplication(runAttempt, action) is true; reruns and reopens continue with an empty receipt set and commit. New test title 'a rerun or reopen commits despite an unavailable listing' added to the 3.13 actions and acceptance title list (gate 3.25 D3 checks a subset; unaffected). Retry 1 of 3.13 ran on a fresh worktree at the post-W2 base, reusing the first attempt's files as a starting point. | step 3.13 corrected in flight |
| 4 (found in phase 4 decomposition; no phase 4 step file existed) | decomposer, phase 4 decomposition (amendment note items 1-2) | Classified: item 1 gap-fill (unspecified record-only case), item 2 contradiction resolved in favor of the approved stricter mitigation G8 M1; no bound, constant, job, permission, scope, or DoD gate relaxed. Item 1: WF6 publish group is now exactly `${{ needs.gate.outputs.concurrency_group or-fallback format('steward-{0}-run-{1}', github.repository_id, github.run_id) }}` (the YAML uses the expression operator double-bar) with cancel-in-progress false; committed runs keep the core-built per-submission group; closure publishes (gate outputs concurrency_group empty, hosted-gate.ts unchanged) get a per-run group, never serialized with or replaced by another publish; the expression is never empty; static workflow test asserts the exact expression. Item 2: WF8 rewritten: only build checks out steady-orchard/patch-steward at inputs.steward_ref into steward/ with persist-credentials false; a build step before checkout rejects any steward_ref not matching ^[0-9a-f]{40}$ (value via env, never interpolated into run); the core never receives steward_ref (removed the unsatisfiable "the core rejects any other form"); gate and publish never check out (M1). Ripple: D5 aligned (only build checks out and installs); phase 6 architecture 6.4 docs item now names the per-submission and per-run group keys; WF1, I9, I11, Q11 row, M1-M8, project DoD, and roadmap (phase 4 scope cites WF1-WF11 generically) unchanged. No step file edited. | brief amended |
| 4 | 4.17 (smoke done once: issue 31, run 36397673122, evidence commit 6f1c3c8; report status fail on acceptance 5 only) | Supervisor in-flight correction (option b). Defect: 4.17 acceptance 5 located log lines with `includes`, but `gh run view --log` echoes the publish step's own run script (ANSI-colored) before its output, and that script contains the literal `echo "steward job summary:"`, so the first match was the echoed source line (index 116) before the real `evidence commit` line (132); honest output cannot satisfy it. Fix: the check strips the leading timestamp from each publish log text and matches with `startsWith`, so echoed script lines (which start with an ANSI escape) never match; expected result unchanged (`summary after commit`). Supervisor re-ran acceptance 1-6 with the corrected 5 against the live run: all pass (real order: evidence commit 08:30:32.1645Z, summary header 08:30:32.1799Z, Evidence, Status needs-changes, Freshness current; no key or token in the log). The smoke was not repeated (one issue only); the committed 4.17 report keeps its status fail line, which refers to the original acceptance 5. 4.18 D7 runs the corrected command. Phase 5 log checks (S08) must match output lines the same way. | step 4.17 acceptance corrected in flight; step done |
| 5 (found in phase 5 decomposition; no phase 5 step file existed) | decomposer, phase 5 decomposition (amendment note item 2; item 1 S10 merge returned needs-human, unapplied) | Stale-fact correction (strengthening; no gate relaxed): OA3 Verify cited a log line `token repositories=...evidence` that the product never prints. OA3 Verify now names the real signals, checked against hosted-gate.ts and dedup.ts: gate on the first attempt of the S16 `opened` event logs `listing none`, mints a `store-read` token for steady-orchard/patch-steward-testbed-evidence for the fallback read, logs `dedup commit no-owner`, succeeds; publish logs `evidence commit <sha> rebuilds <n>` and the evidence repository's `steward-evidence` commits include `<sha>` (gh api command given). OA3 missing: gate fails with `Failure: ownership.listing-unavailable` after `listing none` (fallback unavailable fails closed in decideDeduplication), or publish fails at the store token mint or installation lookup. Updated: brief Owner actions Status OA3 row and OA3 Verify cell; roadmap phase 5 Depends on (OA3 parenthetical). Ripple checked: brief line "S15 or S16 token-mint or permission failure attributable to OA4 or OA3", G10 S16 row, project DoD unchanged. No step file edited. | brief amended |
| 5 | 5.10 (attempt 1, commit 69ba4f4 discarded by reset; PR 32 and run 36410834391 created and kept) | Supervisor in-flight correction (option b). Defect: the pass condition and acceptance 2 expected the REST run field `name` to be the workflow name `steward-pr`; verified live that for a workflow with `run-name` GitHub reports the evaluated run-name as `name` (equal to `display_title`; the S00 run 36397673122 shows the same), so honest output cannot satisfy it. The worker stopped after the same-repository run (all jobs success). Fix: `name` and `display_title` must both equal master's run-name `steward pr <n> author 2095171 event pull_request_target opened sender 2095171 User` (a run defined by the proposed wrapper would be named `modified steward pr <n>`), plus `gh run view --json workflowName` must print `steward-pr`; 4f records the workflowName command; action 4 gained a RESUME note (reuse N1 32 and RUN1 36410834391; no second branch push or pull request). Expected result text of acceptance 2 unchanged. Supervisor dry-ran corrected acceptance 2 for the same-repository run: `same definition ok`. No other step file checks the run `name` field. | step 5.10 corrected in flight; retry 1 |
| 5 | 5.13 (attempt 1, commit 84b94c2 discarded by reset; tries 1-3 made 6 body edits of PR 34, runs 36414063591, 36414211101, 36414463707, 36414579082, 36414810059, 36414986082) | Supervisor in-flight correction (option b). Defect: action 3a detected the older run's gate completion by polling find-runs.sh every 20 s; the run list showed a new run up to 100 s late (try 3: created 11:17:50Z, first listed at poll 5, 11:19:33Z), so the second edit always landed after the older run had already published `freshness current`; every try printed `S04 check ... gate_commits=11 old_superseded=0 new_current=2 supersession_records=0` (honest `S04 not met`; no product defect: sequential edits, both owners current in turn). Measured windows relative to the first edit: older gate capture +32 to +39 s, gate end +37 to +46 s, older publish recapture +54 to +95 s. Fix: no polling between edits (the brief's 20 s poll floor makes gate-completion detection too slow for the window); fixed delay D between the edits: tries T 4 (D 45 s, inside every measured window), 5 (D 5 s, the brief's "within about 5 s" overlap of the two gates), 6 (D 45 s); OLD and NEW from await-runs (first and last RUN line); acceptance 1 regex s04_try [4-6]; results section opens with one sentence recording tries 1-3. Pass condition and check command unchanged. Treated as the first execution of the brief's S04 procedure (tries 1-3 ran a step-invented polling procedure), so the brief's "retried up to 3 times" bound applies to tries 4-6. | step 5.13 corrected in flight; retry 1 |
