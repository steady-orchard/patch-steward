# patch-steward-m7 — Ledger

Single source of truth for execution state. Sections are owned by different agents —
the planner seeds Plan + Phases; the decomposer fills Steps per phase; the supervisor
updates Steps and appends Revisions.

## Plan

- plan-name: patch-steward-m7
- current-phase: done
- working-branch: milestone/7-sandboxed-execution
- starting-commit: ee878e5c8778f54187b3466c14bdfad09d30f09f
- default-branch: develop
- artifacts-dir: development-artifacts
- owner-gate: APPROVED (2026-09-28). Q1-Q16 all answered A (recommended), no value changes; recorded in the brief section "Owner gate decisions". Phases may be decomposed in order. Q14 A: the owner installs Podman Desktop with a Podman machine before phase 3; PREREQ-PODMAN (roadmap) gates every Podman-dependent step and gate in phases 3-5, and a failure is needs-human, never a skip. Owner answers 2026-09-28 (phase 1 decomposition ripple): Q17 B (owner's choice over recommended A), Q18 A, Q19 A, applied as brief ER7-ER10. Q20 A (2026-09-28): a result file whose decoded text exceeds REDACTION_INPUT_MAX_BYTES is not stored, the run is kept, stored_omitted_reason records why; applied as brief ER9, ER10, EP4. No owner question pending.

## Phases

| Phase | Status  | Notes |
| ----: | ------- | ----- |
| 1     | done    | Policy and pure contracts: 17 keys, K52-K63, record additions, JUnit parser, tar codec, path and overlay rules, capture buffer, planner, transport records, evidence and report rendering. Complete 2026-10-03: steps 1.1-1.19 done, no revisions; supervisor re-ran the 1.19 gate D1-D16 in the main tree, all PASS (202 test files, 3871 tests; typecheck, build, lint, format:check exit 0; 0 patch-steward-* temp entries before and after). Wave 2 (1.6-1.11) was verified and merged on resume after an interrupted supervisor run. |
| 2     | done    | Host adapters: streamed process capture, inert fetch, materialization, Docker and Podman argv builders and detection, images, container runner, unsandboxed runner; E1 and E5 fixture tests. Needs Phase 1. 2026-10-23: all steps done (2.19 removed); phase 2 dod 8/8 PASS. |
| 3     | done    | Hostile corpus, container tier E2-E4, invariant-3 first check, invariant 1, 4, 5, 7 extensions, CI container-tests job, act Ubuntu verification, local Podman tier (PREREQ-PODMAN first). Needs Phase 2. Complete 2026-10-23: steps 3.1-3.15 done; phase 3 dod 14/14 PASS plus 2 manual items confirmed by the owner (see Phase 3 notes). |
| 4     | done    | steward screen execution (Q7 A) and steward preflight --run; golden reports; live expectations; Docker and Podman tiers (PREREQ-PODMAN first). Needs Phase 3. Decomposed 2026-10-23: steps 4.1-4.21 (see Phase 4 notes). Complete 2026-10-23: steps 4.1-4.21 done; phase 4 dod 8/8 PASS plus 10 manual items confirmed by the owner (see Phase 4 notes). |
| 5     | done    | ADR-0079 to ADR-0089, governing documents, whitepaper, README, CLAUDE.md, user manual, project DoD (item 4 after PREREQ-PODMAN). Needs Phase 4. Decomposed 2026-10-23: steps 5.1-5.16 (see Phase 5 notes). Complete 2026-10-24: steps 5.1-5.20 done (5.17-5.20 added after the owner rejected manual item 5 on the first read); phase 5 dod 35/35 PASS plus 9 manual items confirmed by the owner. |

## Pipeline rules (from earlier milestones plus M07 constraints; binding for every agent in this plan)

- Every `decomposer`, `worker`, and `planner` invocation runs in the FOREGROUND (`run_in_background: false`). A parallel wave is
  several foreground Agent calls in ONE message.
- Never put a pipe character inside a ledger table cell; write "or" instead. Never write raw control, bidi, or zero-width
  characters (including NUL) into any artifact or source file; build them in test code with String.fromCharCode.
- Phase gates and the project DoD run in the MAIN tree (repo root); long git-worktree paths break `pnpm test`. Create waves with
  `wave-create.sh --worktrees C:/w` (worktrees `C:/w/patch-steward-m7-<id>`, branches `wt/patch-steward-m7-<id>`); delete leftover
  `node_modules` after a worktree is removed on Windows.
- Bootstrap command (every phase): run `pnpm install --frozen-lockfile` in each new worktree before launch, one worktree at a
  time (pnpm store contention on Windows). A lone ready step runs in the main tree and needs no bootstrap.
- Pipeline v4 migration (2026-10-23): brief and roadmap Definitions of Done are `dod` blocks run by `dod-run.sh`; step files use
  the v4 schema (`tier`, `acceptance_cmd`, `acceptance_expect`). Steps 1.1-2.16 and 2.18 ran under the earlier schema
  (`acceptance`, `rollback`) and stay untouched; worker reports before the migration use the earlier report format.
- `core.autocrlf=true`: compare committed bytes with `git show HEAD:<path>`. Fixture repositories are JSON manifests so line
  endings never depend on checkout settings; never commit a live `.gitattributes` or `.gitmodules` below the repository root.
- Every Prettier-checked file a step writes is Prettier-clean at commit; byte-exact fixtures use `.txt` or `.xml`. Never run a
  formatter on anything under `development-artifacts/`.
- `.gitignore` swallows `logs`, `*.log`, `*.tgz`, `.env*`, `out`, `dist`, `pids`: never name a committed file or directory that way.
- Credential samples are built by string concatenation in test code; never print, log, or store a real token.
- Literal greps on prose tolerate Prettier line wraps; it.each titles over 40 characters are truncated (check rendered titles).
- New core root exports named load*, validate*, resolve*, parse*, capture*, or check* extend conformance/invariant-5.test.ts in the
  same step; every new export name is unique across core (TS2308).
- Tests clean their temp dirs (prefix `patch-steward-`) and every container, volume, and image they create (label
  `org.patch-steward.test=<nonce>`); each step touching the container tier proves the label leak checks empty afterwards.
- Container-tier tests run only through `pnpm test:container` with `STEWARD_CONTAINER_RUNTIME` set; unit and fixture tests never
  need a runtime or network. Test images are public and pinned by digest.
- NO push to origin, NO test-bed write, NO GitHub write, NO App, secret, or settings change. Allowed network reads: public image
  pulls; read-only GitHub reads and HTTPS git fetches of the public test-bed only inside `*.live.test.ts` under `pnpm test:live`.
- Ubuntu verification uses `act 0.2.88` on an LF clone (`git clone -c core.autocrlf=false <repo> <dir>`) with
  `-W .github/workflows/ci.yml`; the coverage job is never run.
- Persistent files (`docs/` except the two plan documents, README.md, CLAUDE.md, `fixtures/`, `templates/`, `scenarios/`) never
  cite planning artifacts or their ids.

## Steps

<!-- decomposer appends one row per step (id | phase | pending | files | blank...) and a
     "Phase <N> notes" paragraph below the table: dependency graph, couplings, bootstrap
     facts, emergent contracts. step-merge.sh fills status, files, commit, and the cost
     columns tokens | tool_uses | wall_s | retries per step. Rows done before the
     2026-10-23 migration carry n/a cost columns (not recorded then). -->

| id | phase | status | files | commit | tokens | tool_uses | wall_s | retries |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | 1 | done | packages/core/src/policy/bounds.ts, packages/core/src/policy/bounds.test.ts, development-artifacts/patch-steward-m7-1.1-report.md | 87358ce8364a34d56a0c286994157805affcc33e | n/a | n/a | n/a | n/a |
| 1.2 | 1 | done | packages/core/src/execution/output-capture.ts, packages/core/src/execution/output-capture.test.ts, development-artifacts/patch-steward-m7-1.2-report.md | d022f21ada7e3c2e702deca1d0d69187e24d1f05 | n/a | n/a | n/a | n/a |
| 1.3 | 1 | done | packages/core/src/report/templates.ts, packages/core/src/report/templates.test.ts, packages/core/src/report/wording.test.ts, development-artifacts/patch-steward-m7-1.3-report.md | 5ebc6e3e242569a6862e88de4b49245c4e8d8ae7 | n/a | n/a | n/a | n/a |
| 1.4 | 1 | done | packages/core/src/execution/plan.ts, packages/core/src/execution/plan.test.ts, development-artifacts/patch-steward-m7-1.4-report.md | c221060febef691b43e280f6fa0ece9e53ffbf65 | n/a | n/a | n/a | n/a |
| 1.5 | 1 | done | packages/core/src/evidence/result-file.ts, packages/core/src/evidence/result-file.test.ts, development-artifacts/patch-steward-m7-1.5-report.md | 7d78b09c843abedba6301412bbb6b8cefbb55c94 | n/a | n/a | n/a | n/a |
| 1.6 | 1 | done | packages/core/src/vocabulary.ts, packages/core/src/vocabulary.test.ts, packages/core/src/records/execution-record.ts, packages/core/src/records/execution-record.test.ts, packages/core/src/records/run.ts, packages/core/src/records/run.test.ts, development-artifacts/patch-steward-m7-1.6-report.md | 5d5513976e6f840f62281ecd95c724fa548e088b | n/a | n/a | n/a | n/a |
| 1.7 | 1 | done | packages/core/src/policy/bounds.ts, packages/core/src/policy/bounds.test.ts, packages/core/src/policy/schema.ts, packages/core/src/policy/schema.test.ts, packages/core/src/policy/execution-limits.fixture.test.ts, packages/core/src/submission/default-checklist.ts, packages/core/src/exports.test.ts, templates/policy/policy.yml, templates/policy/policy.schema.json, development-artifacts/patch-steward-m7-1.7-report.md | 2d287d6eb9a5a3100f7118266fc64bb97fd94b5c | n/a | n/a | n/a | n/a |
| 1.8 | 1 | done | packages/core/src/junit/parse.ts, packages/core/src/junit/parse.test.ts, development-artifacts/patch-steward-m7-1.8-report.md | edd364c8b6038c41b61296e70bc3d3da2f0909c7 | n/a | n/a | n/a | n/a |
| 1.9 | 1 | done | packages/core/src/archive/tar.ts, packages/core/src/archive/tar.test.ts, development-artifacts/patch-steward-m7-1.9-report.md | 62343d304d015e9b563b35728639d96ab9922088 | n/a | n/a | n/a | n/a |
| 1.10 | 1 | done | packages/core/src/materialize/paths.ts, packages/core/src/materialize/paths.test.ts, development-artifacts/patch-steward-m7-1.10-report.md | bd640b938fb1504e97dddb18f6d4f43d8d87ba98 | n/a | n/a | n/a | n/a |
| 1.11 | 1 | done | packages/core/src/evidence/output-file.ts, packages/core/src/evidence/output-file.test.ts, development-artifacts/patch-steward-m7-1.11-report.md | dc2405a330d146c67e3e55326639d77f9b0d94c0 | n/a | n/a | n/a | n/a |
| 1.12 | 1 | done | packages/core/src/policy/rules.ts, packages/core/src/policy/rules.test.ts, packages/core/src/policy/limits.test.ts, packages/core/src/conformance/invariant-7.test.ts, fixtures/policies/invalid/output-parts-above-output-bytes.txt, fixtures/policies/invalid/output-stream-below-output-bytes.txt, fixtures/policies/invalid/prepared-checkout-below-checkout.txt, fixtures/policies/invalid/result-files-above-limit.txt, fixtures/policies/expectations.json, development-artifacts/patch-steward-m7-1.12-report.md | 77a3190e1ad5b238b1e499960913fee16bc10e57 | n/a | n/a | n/a | n/a |
| 1.13 | 1 | done | fixtures/junit/samples/vitest.xml, fixtures/junit/samples/jest-junit.xml, fixtures/junit/samples/cargo-nextest.xml, fixtures/junit/samples/ctest.xml, fixtures/junit/samples/googletest.xml, fixtures/junit/samples/node-test.xml, fixtures/junit/samples/generic.xml, fixtures/junit/hostile/doctype.xml, fixtures/junit/hostile/internal-entity.xml, fixtures/junit/hostile/external-entity.xml, fixtures/junit/hostile/billion-laughs.xml, fixtures/junit/hostile/unknown-entity.xml, fixtures/junit/hostile/deep-nesting.xml, fixtures/junit/hostile/attribute-flood.xml, fixtures/junit/expectations.json, packages/core/src/junit/samples.fixture.test.ts, fixtures/README.md, development-artifacts/patch-steward-m7-1.13-report.md | ce9a930291c7cbb23a8361f75652719607115dd0 | n/a | n/a | n/a | n/a |
| 1.14 | 1 | done | packages/core/src/archive/tar-read.ts, packages/core/src/archive/tar-read.test.ts, development-artifacts/patch-steward-m7-1.14-report.md | f08431ca815926bbdf2d1f3fbc0f02d516ab4e15 | n/a | n/a | n/a | n/a |
| 1.15 | 1 | done | packages/core/src/evidence/layout.ts, packages/core/src/evidence/layout.test.ts, packages/core/src/evidence/verify.ts, packages/core/src/evidence/verify-executions.test.ts, development-artifacts/patch-steward-m7-1.15-report.md | 5e7af49fbb103ec5ecf0ef9922dfaa8b8610f28a | n/a | n/a | n/a | n/a |
| 1.16 | 1 | done | packages/core/src/execution/results.ts, packages/core/src/execution/results.test.ts, packages/core/src/execution/transport.ts, packages/core/src/execution/transport.test.ts, development-artifacts/patch-steward-m7-1.16-report.md | a6b43f346fd7e2502f4a9139ce8c6b62da93d234 | n/a | n/a | n/a | n/a |
| 1.17 | 1 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, packages/core/src/conformance/invariant-5.test.ts, development-artifacts/patch-steward-m7-1.17-report.md | 1cdeb839720d6826ef4cfec672e5b5f3b7cd41cf | n/a | n/a | n/a | n/a |
| 1.18 | 1 | done | packages/core/src/conformance/invariant-7.test.ts, development-artifacts/patch-steward-m7-1.18-report.md | 8ee8872d14a36acfe160ac1db6a580420a76fdab | n/a | n/a | n/a | n/a |
| 1.19 | 1 | done | development-artifacts/patch-steward-m7-1.19-report.md | 14ec5d8fc0b09d80a6c4d6cc9defa2f7d81074c2 | n/a | n/a | n/a | n/a |
| 2.1 | 2 | done | packages/core/src/process/stream-process.ts, packages/core/src/process/stream-process.test.ts, development-artifacts/patch-steward-m7-2.1-report.md | 83b9a843223287f0177015d0cb32201e16d80fff | n/a | n/a | n/a | n/a |
| 2.2 | 2 | done | packages/core/src/git/object-stream.ts, packages/core/src/git/object-stream.test.ts, development-artifacts/patch-steward-m7-2.2-report.md | 76f3fe79d48626c432cf87c3ff5abb835528e1ca | n/a | n/a | n/a | n/a |
| 2.3 | 2 | done | packages/core/src/runner/types.ts, packages/core/src/runner/argv.ts, packages/core/src/runner/argv.test.ts, development-artifacts/patch-steward-m7-2.3-report.md | 00c9993b9054f3890ff7c7e149f605e1279ac3b6 | n/a | n/a | n/a | n/a |
| 2.4 | 2 | done | packages/core/src/runner/record.ts, packages/core/src/runner/record.test.ts, development-artifacts/patch-steward-m7-2.4-report.md | 445d1666e1f491f0fea571dc3f8a5d1041e48c81 | n/a | n/a | n/a | n/a |
| 2.5 | 2 | done | packages/core/src/runner/windows-shim.ts, packages/core/src/runner/windows-shim.test.ts, packages/core/src/runner/windows-shim.fixture.test.ts, development-artifacts/patch-steward-m7-2.5-report.md | 15d106677292c229faaaa623aa85f66ebc66194c | n/a | n/a | n/a | n/a |
| 2.6 | 2 | done | packages/core/src/runner/checkout-guard.ts, packages/core/src/runner/checkout-guard.test.ts, packages/core/src/runner/checkout-guard.fixture.test.ts, development-artifacts/patch-steward-m7-2.6-report.md | 0cc99f81a3528c2bab4bc902ce1dedd6699543d6 | n/a | n/a | n/a | n/a |
| 2.7 | 2 | done | packages/core/src/materialize/fetch.ts, packages/core/src/materialize/fetch.test.ts, packages/core/src/materialize/fetch.fixture.test.ts, development-artifacts/patch-steward-m7-2.7-report.md | 82012990a6b2f7fa569d69baf8b0d55be62c2af2 | n/a | n/a | n/a | n/a |
| 2.8 | 2 | done | packages/core/src/runner/build-context.ts, packages/core/src/runner/build-context.test.ts, development-artifacts/patch-steward-m7-2.8-report.md | 71afe644de9fa260293d9207d4557aedd4e96088 | n/a | n/a | n/a | n/a |
| 2.9 | 2 | done | fixtures/repositories/hostile-materialization.json, fixtures/README.md, packages/core/src/materialize/fixture-repository.fixture.test.ts, development-artifacts/patch-steward-m7-2.9-report.md | 4decd2a7ae73fbca4f333be5e1a4070005873232 | n/a | n/a | n/a | n/a |
| 2.10 | 2 | done | packages/core/src/materialize/checkout.ts, packages/core/src/materialize/checkout.test.ts, packages/core/src/materialize/checkout.fixture.test.ts, development-artifacts/patch-steward-m7-2.10-report.md | 2db82e768f87de9f9c7e532edd955a4c425b40c9 | n/a | n/a | n/a | n/a |
| 2.11 | 2 | done | packages/core/src/runner/image.ts, packages/core/src/runner/image.test.ts, development-artifacts/patch-steward-m7-2.11-report.md | 127531aa4d33f6ea474d58a5b39ad73af821581e | n/a | n/a | n/a | n/a |
| 2.12 | 2 | done | packages/core/src/runner/runtime.ts, packages/core/src/runner/runtime.test.ts, development-artifacts/patch-steward-m7-2.12-report.md | d261f87b87f535f78d090f4745eb34f3562bcb59 | n/a | n/a | n/a | n/a |
| 2.13 | 2 | done | packages/core/src/runner/copy-out.ts, packages/core/src/runner/copy-out.test.ts, development-artifacts/patch-steward-m7-2.13-report.md | 8d35473d747ba592bee394d08782244886c4b7cc | n/a | n/a | n/a | n/a |
| 2.14 | 2 | done | packages/core/src/runner/unsandboxed.ts, packages/core/src/runner/unsandboxed.test.ts, packages/core/src/runner/unsandboxed.fixture.test.ts, development-artifacts/patch-steward-m7-2.14-report.md | 71d3a3ee941d48847522e2233e49660ca9688bc1 | n/a | n/a | n/a | n/a |
| 2.15 | 2 | done | packages/core/src/runner/container.ts, packages/core/src/runner/container.test.ts, development-artifacts/patch-steward-m7-2.15-report.md | fcd1ca39224515bad31bad233ca1a96ff062e2c0 | n/a | n/a | n/a | n/a |
| 2.16 | 2 | done | packages/core/src/materialize/materialize.ts, packages/core/src/materialize/materialize.fixture.test.ts, development-artifacts/patch-steward-m7-2.16-report.md | c43b5f57894ed15aa4900a3b90cd406ea3eea2b0 | n/a | n/a | n/a | n/a |
| 2.17 | 2 | done | development-artifacts/patch-steward-m7-2.17-report.md, fixtures/README.md, fixtures/repositories/shell-sample.json, package.json, packages/core/src/runner/container.container.test.ts, packages/core/src/runner/test-images.test.ts, vitest.container.config.ts | 2a812762c27d | 34660 | 18 | 150 | 0 |
| 2.18 | 2 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, development-artifacts/patch-steward-m7-2.18-report.md | 1e9032f75092d0f781a4d1f94cd2fa35065ae342 | n/a | n/a | n/a | n/a |
| 2.19 | 2 | removed | development-artifacts/patch-steward-m7-2.19-report.md | |  |  |  |  |
| 3.1 | 3 | done | development-artifacts/patch-steward-m7-3.1-report.md, packages/core/src/materialize/materialize.fixture.test.ts, packages/core/src/process/stream-process.test.ts, packages/core/src/runner/unsandboxed.fixture.test.ts | a8af7929decc | 28080 | 18 | 139 | 0 |
| 3.2 | 3 | done | development-artifacts/patch-steward-m7-3.2-report.md, fixtures/repositories/typescript-sample.json, packages/core/src/runner/container-harness.container.test.ts, packages/core/src/runner/test-images.test.ts, packages/core/src/runner/typescript-sample.container.test.ts | 99e6dcfd1189 | 37629 | 16 | 131 | 0 |
| 3.3 | 3 | done | development-artifacts/patch-steward-m7-3.3-report.md, fixtures/repositories/hostile-limits.json, packages/core/src/runner/limits.container.test.ts | 56bdd4a60ad6 | 27066 | 13 | 132 | 0 |
| 3.4 | 3 | done | development-artifacts/patch-steward-m7-3.4-report.md, fixtures/repositories/hostile-probes.json, packages/core/src/conformance/invariant-3.container.test.ts | 39fa6cb2c02a | 40385 | 22 | 189 | 0 |
| 3.5 | 3 | done | development-artifacts/patch-steward-m7-3.5-report.md, fixtures/repositories/hostile-results.json, packages/core/src/runner/result-files.container.test.ts | 91d3fc1c16e1 | 28442 | 13 | 78 | 1 |
| 3.6 | 3 | done | development-artifacts/patch-steward-m7-3.6-report.md, packages/core/src/runner/failures.container.test.ts | d5a47b264dd6 | 26256 | 12 | 109 | 0 |
| 3.7 | 3 | done | development-artifacts/patch-steward-m7-3.7-report.md, packages/core/src/conformance/invariant-3.test.ts | df3725d61d28 | 63835 | 16 | 177 | 0 |
| 3.8 | 3 | done | development-artifacts/patch-steward-m7-3.8-report.md, packages/core/src/conformance/zero-execution.fixture.test.ts | 5d571f0542db | 35026 | 13 | 99 | 0 |
| 3.9 | 3 | done | development-artifacts/patch-steward-m7-3.9-report.md, packages/core/src/conformance/invariant-1-execution.test.ts, packages/core/src/conformance/invariant-5-execution.test.ts | 143cc3ff8c7e | 70738 | 22 | 284 | 0 |
| 3.10 | 3 | done | development-artifacts/patch-steward-m7-3.10-report.md, packages/core/src/conformance/invariant-4-execution.fixture.test.ts, packages/core/src/conformance/invariant-4-execution.test.ts | 83d6d5ca3dd4 | 80688 | 26 | 201 | 0 |
| 3.11 | 3 | done | development-artifacts/patch-steward-m7-3.11-report.md, packages/core/src/conformance/invariant-7-execution.test.ts | 98311b683121 | 84605 | 31 | 649 | 0 |
| 3.12 | 3 | done | .github/workflows/ci.yml, development-artifacts/patch-steward-m7-3.12-report.md | 6d3d709f2718 | 21372 | 12 | 85 | 0 |
| 3.13 | 3 | done | development-artifacts/patch-steward-m7-3.13-report.md, packages/core/src/conformance/invariant-3.test.ts, packages/core/src/runner/argv.test.ts, packages/core/src/runner/argv.ts, packages/core/src/runner/image.test.ts, packages/core/src/runner/image.ts | 6fc0a1b9b90a | 67321 | 25 | 253 | 0 |
| 3.14 | 3 | done | development-artifacts/patch-steward-m7-3.14-report.md, fixtures/README.md | 9a4fbd008118 | 18924 | 10 | 35 | 0 |
| 3.15 | 3 | done | development-artifacts/patch-steward-m7-3.15-report.md, packages/core/src/conformance/invariant-3.container.test.ts, packages/core/src/runner/argv.test.ts, packages/core/src/runner/argv.ts, packages/core/src/runner/container-harness.container.test.ts, packages/core/src/runner/container.container.test.ts, packages/core/src/runner/container.ts, packages/core/src/runner/copy-out.test.ts, packages/core/src/runner/copy-out.ts, packages/core/src/runner/image.test.ts, packages/core/src/runner/image.ts | 2167c778b316 | 130892 | 73 | 1108 | 0 |
| 4.1 | 4 | done | development-artifacts/patch-steward-m7-4.1-report.md, packages/core/src/execution/executor.test.ts, packages/core/src/execution/executor.ts | bb525fbc752b | 21196 | 11 | 55 | 0 |
| 4.2 | 4 | done | development-artifacts/patch-steward-m7-4.2-report.md, packages/core/src/evidence/execution-evidence.test.ts, packages/core/src/evidence/execution-evidence.ts | beab0513787b | 55148 | 26 | 465 | 0 |
| 4.3 | 4 | done | development-artifacts/patch-steward-m7-4.3-report.md, packages/core/src/evidence/assemble.test.ts, packages/core/src/evidence/assemble.ts, packages/core/src/evidence/metrics.test.ts, packages/core/src/evidence/metrics.ts, packages/core/src/evidence/report-input.test.ts, packages/core/src/evidence/report-input.ts | 6e21886c6cbe | 55798 | 27 | 156 | 0 |
| 4.4 | 4 | done | development-artifacts/patch-steward-m7-4.4-report.md, packages/cli/src/screen-args.test.ts, packages/cli/src/screen-args.ts | 177efa2b99ad | 19496 | 7 | 40 | 0 |
| 4.5 | 4 | done | development-artifacts/patch-steward-m7-4.5-report.md, packages/core/src/conformance/invariant-5.test.ts, packages/core/src/exports.test.ts, packages/core/src/index.ts, packages/core/src/runner/preview-worktree.fixture.test.ts, packages/core/src/runner/preview-worktree.ts | 2590025c37b9 | 57846 | 27 | 310 | 1 |
| 4.6 | 4 | done | development-artifacts/patch-steward-m7-4.6-report.md, packages/cli/src/preflight-args.test.ts, packages/cli/src/preflight-args.ts, packages/cli/src/preflight-command.test.ts, packages/cli/src/preflight-output.test.ts, packages/cli/src/preflight-output.ts | 18e7f26dc8d2 | 47194 | 33 | 225 | 0 |
| 4.7 | 4 | done | development-artifacts/patch-steward-m7-4.7-report.md, packages/core/src/pipeline/execution-phases.test.ts, packages/core/src/pipeline/execution-phases.ts | 15abfd67d8c3 | 58919 | 24 | 173 | 0 |
| 4.8 | 4 | done | development-artifacts/patch-steward-m7-4.8-report.md, packages/core/src/runner/plan-executor.test.ts, packages/core/src/runner/plan-executor.ts | 342e61d08bad | 68475 | 25 | 721 | 0 |
| 4.9 | 4 | done | development-artifacts/patch-steward-m7-4.9-report.md, packages/core/src/evidence/publish-executions.test.ts, packages/core/src/evidence/publish.ts | 023ea755e161 | 94899 | 52 | 349 | 0 |
| 4.10 | 4 | done | development-artifacts/patch-steward-m7-4.10-report.md, packages/cli/src/preflight-run.fixture.test.ts, packages/cli/src/preflight-run.ts | f1a6d1901dae | 74745 | 21 | 223 | 0 |
| 4.11 | 4 | done | development-artifacts/patch-steward-m7-4.11-report.md, packages/cli/src/steward-zero-execution.fixture.test.ts, packages/core/src/conformance/invariant-6.test.ts, packages/core/src/conformance/invariant-7.test.ts, packages/core/src/conformance/invariant-8.test.ts, packages/core/src/conformance/zero-execution.fixture.test.ts, packages/core/src/pipeline/publish-phase.ts, packages/core/src/pipeline/screen-execution.test.ts, packages/core/src/pipeline/screen-scenarios.fixture.test.ts, packages/core/src/pipeline/screen.test.ts, packages/core/src/pipeline/screen.ts | 36d688340f05 | 77619 | 31 | 240 | 0 |
| 4.12 | 4 | done | development-artifacts/patch-steward-m7-4.12-report.md, fixtures/README.md, fixtures/reports/cases.json, fixtures/reports/pr-executed.report.txt, fixtures/reports/pr-executed.summary.txt, fixtures/reports/pr-execution-environment-failure.report.txt, fixtures/reports/pr-execution-environment-failure.summary.txt, packages/core/src/evidence/golden-reports.fixture.test.ts | 8acfc6ea6ed7 | 53269 | 25 | 116 | 0 |
| 4.13 | 4 | done | development-artifacts/patch-steward-m7-4.13-report.md, packages/core/src/conformance/invariant-1-publish.test.ts, packages/core/src/conformance/invariant-7-publish.test.ts | d96dc81d60ac | 75458 | 30 | 389 | 0 |
| 4.14 | 4 | done | development-artifacts/patch-steward-m7-4.14-report.md, packages/cli/src/preflight-command.ts, packages/cli/src/preflight-run-command.fixture.test.ts | 7b0455d4d541 | 72638 | 27 | 177 | 0 |
| 4.15 | 4 | done | development-artifacts/patch-steward-m7-4.15-report.md, packages/cli/src/screen-command.test.ts, packages/cli/src/screen-command.ts, packages/cli/src/steward-zero-execution.fixture.test.ts | 4642e5725dbf | 44020 | 17 | 125 | 0 |
| 4.16 | 4 | done | development-artifacts/patch-steward-m7-4.16-report.md, packages/core/src/conformance/invariant-4-pipeline.test.ts | 7f7203d77864 | 49059 | 19 | 149 | 0 |
| 4.17 | 4 | done | development-artifacts/patch-steward-m7-4.17-report.md, packages/cli/src/preflight-run-exit.fixture.test.ts | 954e5930640c | 45234 | 14 | 152 | 0 |
| 4.18 | 4 | done | development-artifacts/patch-steward-m7-4.18-report.md, packages/cli/src/preflight-zero-execution.fixture.test.ts | 5945e5db252d | 64899 | 38 | 207 | 0 |
| 4.19 | 4 | done | development-artifacts/patch-steward-m7-4.19-report.md, packages/cli/src/preflight-run.container.test.ts | db8d8b8c143e | 37113 | 15 | 116 | 0 |
| 4.20 | 4 | done | development-artifacts/patch-steward-m7-4.20-report.md, packages/cli/src/screen-execution.container.test.ts | 712b82d4e469 | 51389 | 15 | 169 | 1 |
| 4.21 | 4 | done | development-artifacts/patch-steward-m7-4.21-report.md, packages/cli/src/screen-evidence-budget.container.test.ts | c9835704eed3 | 38367 | 16 | 254 | 1 |
| 5.1 | 5 | done | development-artifacts/patch-steward-m7-5.1-report.md, docs/architecture.md | 8c4729d1dbd8 | 48245 | 15 | 105 | 0 |
| 5.2 | 5 | done | development-artifacts/patch-steward-m7-5.2-report.md, docs/architecture.md | e0ff71c1ac6e | 66517 | 12 | 115 | 0 |
| 5.3 | 5 | done | development-artifacts/patch-steward-m7-5.3-report.md, docs/architecture.md | 8e1ee903beca | 49302 | 30 | 128 | 0 |
| 5.4 | 5 | done | development-artifacts/patch-steward-m7-5.4-report.md, docs/processes.md | 7b2bb108dd1b | 43903 | 16 | 83 | 0 |
| 5.5 | 5 | done | development-artifacts/patch-steward-m7-5.5-report.md, docs/adr/0079-runner-image-sources-and-local-build-cache.md, docs/adr/0080-dependency-step-container-with-egress.md, docs/adr/0082-no-services-for-reproductions.md | 545e62279b19 | 31817 | 11 | 89 | 0 |
| 5.6 | 5 | done | development-artifacts/patch-steward-m7-5.6-report.md, docs/adr/0081-test-result-evidence-exit-status-and-junit-xml.md, docs/adr/0083-execution-limits-as-policy-keys.md | 344097e93b9b | 31279 | 13 | 189 | 0 |
| 5.7 | 5 | done | development-artifacts/patch-steward-m7-5.7-report.md, docs/adr/0084-container-runtimes-host-platforms-and-container-tier.md, docs/adr/0085-container-hardening-profile-and-checkout-delivery.md | 8df8e9be5a3a | 39458 | 11 | 88 | 0 |
| 5.8 | 5 | done | development-artifacts/patch-steward-m7-5.8-report.md, docs/adr/0086-inert-materialization-and-overlay-validation.md, docs/adr/0087-execution-records-result-files-and-claim-admissibility.md | 86116aa1029d | 36976 | 12 | 208 | 0 |
| 5.9 | 5 | done | development-artifacts/patch-steward-m7-5.9-report.md, docs/adr/0067-steward-screen-and-report-commands.md, docs/adr/0088-local-screening-executes-in-containers.md, docs/adr/0089-preflight-run-unsandboxed-claim-runner.md, docs/adr/README.md | 136c4894b845 | 39012 | 15 | 95 | 0 |
| 5.10 | 5 | done | development-artifacts/patch-steward-m7-5.10-report.md, docs/whitepaper.md | 704c72619252 | 33914 | 12 | 51 | 0 |
| 5.11 | 5 | done | CLAUDE.md, development-artifacts/patch-steward-m7-5.11-report.md | 0582f1114cbb | 32247 | 8 | 44 | 0 |
| 5.12 | 5 | done | README.md, development-artifacts/patch-steward-m7-5.12-report.md | 9c4596dd0d16 | 27161 | 8 | 43 | 0 |
| 5.13 | 5 | done | development-artifacts/patch-steward-m7-5.13-report.md, docs/user-manual/configuration.md | 6407fb671d4a | 51257 | 16 | 125 | 0 |
| 5.14 | 5 | done | development-artifacts/patch-steward-m7-5.14-report.md, docs/user-manual/commands.md | 68e0d8ecdc5a | 55021 | 21 | 114 | 0 |
| 5.15 | 5 | done | development-artifacts/patch-steward-m7-5.15-report.md, docs/user-manual/installation.md, docs/user-manual/overview.md, docs/user-manual/troubleshooting.md, docs/user-manual/usage.md | bc40e8016455 | 71441 | 23 | 145 | 0 |
| 5.16 | 5 | done | development-artifacts/patch-steward-m7-5.16-report.md, fixtures/README.md | 7e6f7ec06b22 | 16530 | 11 | 39 | 0 |
| 5.17 | 5 | done | CLAUDE.md, development-artifacts/patch-steward-m7-5.17-report.md | 370541e492dc | 20052 | 9 | 45 | 0 |
| 5.18 | 5 | done | development-artifacts/patch-steward-m7-5.18-report.md, docs/processes.md | 8e0b440366ec | 20255 | 9 | 48 | 0 |
| 5.19 | 5 | done | development-artifacts/patch-steward-m7-5.19-report.md, docs/user-manual/configuration.md | 6d610d99dd4a | 15655 | 7 | 29 | 0 |
| 5.20 | 5 | done | development-artifacts/patch-steward-m7-5.20-report.md, docs/user-manual/README.md, docs/user-manual/commands.md | ffc042646c56 | 15656 | 7 | 26 | 0 |

### Phase 1 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m7): phase 1 steps`), base f57a5ec (all owner
  questions answered; no planner amendment triggered by this decomposition). Pure contracts only: no process spawn, container,
  network, or GitHub access in any step; no file under packages/cli/, packages/action/, .github/, docs/, scenarios/, probes/ is in
  any scope. All steps route mechanical. No step is Podman-dependent (PREREQ-PODMAN first applies in phase 3).
- Dependency graph (scopes pairwise disjoint within each wave; merge order within a wave is free):
  - W1 (no deps): 1.1 hard constants; 1.2 output capture buffer; 1.3 report templates; 1.4 execution planner; 1.5 result-file
    content.
  - W2: 1.6 records (1.1); 1.7 policy keys (1.1; edits bounds.ts after 1.1); 1.8 JUnit parser (1.1); 1.9 tar writer (1.1);
    1.10 path and overlay rules (1.1); 1.11 output file (1.2).
  - W3: 1.12 cross-field rules and companions (1.7); 1.13 JUnit fixtures (1.8); 1.14 tar reader (1.9); 1.15 layout and verify
    (1.6); 1.16 transport and results (1.4, 1.6).
  - W4: 1.17 root exports, exports test, invariant-5 (1.1 to 1.16); 1.18 invariant-7 execution bounds (1.1, 1.2, 1.5, 1.7, 1.11,
    1.12).
  - W5: 1.19 gate (verification only; MAIN tree; after 1.1 to 1.18 merged).
  - Critical path: 1.1 -> 1.6 -> 1.16 -> 1.17 -> 1.19 (1.7 -> 1.12 -> 1.18 runs beside it).
- Environment / bootstrap:
  - Worker worktrees on short paths (C:/w/m7-<id>); `pnpm install --frozen-lockfile` per new worktree, sequentially.
  - Measured at base: `pnpm vitest run` about 16 s (189 files, 3474 tests), `pnpm typecheck` about 8 s; 0 OS temp entries named
    patch-steward-* before and after a full test run.
  - Every acceptance runs its tests with the Vitest JSON reporter to node_modules/.m7-p1-<id>.json (ignored), checks rendered
    titles with node, then the full `pnpm vitest run`, `pnpm typecheck`, eslint and prettier on the step's files, and a numeric
    control/bidi/zero-width scan. Greps never use a `$` anchor on file contents (CRLF working tree).
  - 1.7, 1.9, 1.12, 1.17 run a build (`pnpm --filter @patch-steward/core build` or `pnpm build`) and import packages/core/dist.
    1.9 runs GNU tar 1.35 from Git Bash, which needs `--force-local` for Windows temp paths (dry-run with a spec implementation
    printed `tar interop ok`). 1.19 runs IN the main tree.
  - Redaction timing risk (roadmap phase 1): measured on this host with the built core, one redaction input of 8388608 bytes
    took 36 to 197 ms (ASCII, all U+FFFD, log lines, base64-like, and repeated prefixes of the jwt, github, aws, url-credential,
    private-key, and bearer detectors), far below REDACTION_TIMEOUT_MS 2000. Finding for phases 4 and 5: an input that is ONE
    detector match spanning more than about 4 MiB (8388608 bytes of repeated 'xoxb-1') makes the redaction worker throw, giving
    `redaction.failed` (infrastructure) in about 90 ms; 4194304 bytes of the same text pass. It fails closed (evidence failure,
    never pass) and needs no rule change; phase 4 tests must not assume every 8 MiB output part redacts, and the documentation
    may mention it with the output-size arithmetic.
- Couplings:
  - Only 1.17 edits packages/core/src/index.ts (114 -> 124 `export *` lines: execution/output-capture, execution/plan,
    execution/results, execution/transport, junit/parse, archive/tar, archive/tar-read, materialize/paths, evidence/output-file,
    evidence/result-file). Until then the new modules are reachable only by relative import. Names added to already-exported
    modules (bounds, vocabulary, records/execution-record, records/run, report/templates, evidence/layout) were checked unique
    across core and cli (TS2308) and none starts with load, validate, resolve, parse, capture, or check.
  - invariant-5 pins (1.17): new root functions checkCheckoutPath, checkOverlay, checkSymlinkTarget, parseJunitXml,
    validateExecutionPlan, validateExecutionResults, each with a rejection assertion.
  - bounds.ts and bounds.test.ts: 1.1 then 1.7. exports.test.ts: 1.7 (both POLICY_LIMITS length assertions 41 -> 58) then 1.17.
    invariant-7.test.ts: 1.12 (MAXIMUM_COMPANIONS in the accepts-the-hard-maximum test) then 1.18 (new describe block).
    limits.test.ts gets the same companions in 1.12.
  - POLICY_LIMITS digest after 1.7 (row order: scratch_mb after runner.resources.pids; the 16 limits.execution rows after
    dependency_step_seconds in brief G1 order; units verbatim from the G1 Unit column):
    f1acc73714cc31dab0f10489281faf9d38fc60afec082b205f1b6bf385aed025 (computed by the decomposer from the approved table).
  - 1.13 fixture expectations depend on 1.8 parser semantics; 1.15 and 1.16 tests build records valid under 1.6 rules.
- Emergent contracts for phases 2 to 5 (names exact):
  - Constants (1.1, bounds.ts): JUNIT_MAX_DEPTH, JUNIT_MAX_ELEMENTS, JUNIT_MAX_ATTRIBUTES, JUNIT_ATTRIBUTE_VALUE_MAX_LENGTH,
    TEST_CASE_IDENTITY_MAX_LENGTH, RUNTIME_CONTROL_TIMEOUT_MS, RUNTIME_CONTROL_OUTPUT_MAX_BYTES, RUNTIME_KILL_GRACE_MS,
    SANDBOX_UID, SANDBOX_GID, SANDBOX_PLATFORM, SANDBOX_WORK_PATH ('/work', the volume mount; added beside the fixed K61 paths),
    SANDBOX_CHECKOUT_PATH, SANDBOX_SCRATCH_PATH, CHECKOUT_PATH_MAX_BYTES, FETCH_DEPTH.
  - Policy (1.7, 1.12): the 17 keys are optional with template-value defaults (limitWithDefault in schema.ts); existing keys
    stay required. Cross-field detail path = the right-hand-side key of each relation (decomposer's reading of the brief's
    "key path of the second key"): output parts and output stream -> limits.execution.output_bytes; prepared checkout ->
    limits.execution.checkout_bytes; result files -> limits.execution.result_files (one detail per violating command).
  - Records (1.6): ADMISSIBILITY_VALUES adds 'claim'. Execution record optional keys kind, runner, working_directory, expected,
    limits, timing, checkout (optional, not nullable), environment.runtime (client_version and server_version nullable, for the
    'host' runtime), environment.image (nullable), environment.platform, environment.network, exit.oom_killed,
    exit.output_limited, output.stored_path; result entry keys format, status, error_code, stored_path, stored_omitted,
    stored_omitted_reason, junit. Entry rules R1-R9 as written in step 1.6 (additions beyond the brief, all fail-closed: junit
    and error_code keys required with status, junit non-null exactly for parsed, error_code non-null exactly for malformed, bytes
    0 for missing and not-regular). Case identities use recordTextSchema (65536), not 4096, so record redaction at persistence can
    lengthen them; the parser cuts at 4096. Record-level rule: runner container -> evidence, unsandboxed -> claim.
    runnerIdentitySchema and formatRunnerIdentity in records/run.ts.
  - Verification (1.15): reasons exactly as in step 1.15; additionally a stored entry with status but without stored_omitted
    fails ('a result file entry lacks its storage state'), mirroring the null output.stored_path rule. Phase 4 publish must write
    stored_omitted on every status-bearing entry and output.stored_path on every stored record.
  - Capture (1.2): OutputCaptureBuffer({ headBytes, tailBytes, streamBytes }), push(chunk) -> true at the stream limit (extra
    bytes dropped, not counted), result() -> { head, tail, totalBytes, omittedBytes, limited } with UTF-8 boundary trimming when
    omitted; decodeCapturedBytes keeps a BOM; outputOmittedMarker(n).
  - Output file (1.11): splitCapturedOutput (execute side; parts at most 8388608 bytes; these parts travel in the transport),
    redactCapturedOutput (publish side; one redaction call, one input per part) -> { parts, fileText, excerpt, counts,
    exactValues }; boundRedactedOutput, outputFileText, outputExcerpt, outputTrimmedMarker. Preflight uses split + redact and
    ignores fileText.
  - Result file (1.5): decodeResultFile(raw) -> { decodedBytes, text or null } (execute side, feeds transport decoded_bytes and
    text); redactResultFileText(text, options) (publish side, one input).
  - Planner (1.4): planScreenExecutions({ policy, submissionType, headCommit }) -> { entries, overBudget }; the dependency step is
    planned whenever declared (literal reading of the brief's plan rule), even with no command after it; callers execute nothing
    when overBudget.
  - Transport (1.16): executionPlanTransportSchema / executionResultsTransportSchema (transport_version 1), validateExecutionPlan,
    validateExecutionResults, codes 'pipeline.transport-invalid' and 'pipeline.transport-binding' (cause steward-defect; phase 4
    decides whether they join PIPELINE_FAILURE_CODES and its messages). EXECUTION_FAILURE_CODES holds exactly the 21 brief I4
    codes, all mapped to environment-unavailable by executionFailureCause; 'runner.not-own-checkout' (preflight refusal) is not
    in it. No total byte bound on the transport (in-process in this milestone).
  - Tar (1.9, 1.14): buildTarArchive / tarEntryHeader / tarPadding / tarEndOfArchive (uid and gid 65532, PAX for paths or link
    targets that do not fit ustar); TarStreamParser (push-based, PAX data bounded by 16 x CHECKOUT_PATH_MAX_BYTES = 65536,
    derived, no new constant) and TarSingleFileReader(maxBytes) -> file, not-regular (with entryKind), too-large (declaredBytes),
    invalid. Suggested phase 2 mapping: invalid -> runner.copy-failed.
  - Paths (1.10): checkCheckoutPath (violations encoding, length, control, absolute, backslash, segment, git-directory),
    checkSymlinkTarget, treeKindForMode, checkOverlay(tree kinds, overlay, { maxFiles, maxBytes }) -> ok { tree, applied } or
    materialize.overlay-rejected (cause environment-unavailable, subject in details[0].path, reason in details[0].message).
    Decomposer choices beyond the brief, all stricter or neutral: duplicate overlay paths rejected; the target rule checks both
    the base and the modified tree; deleting an absent path is a no-op.
  - JUnit (1.8): parseJunitXml(bytes, { maxCases }) -> parsed with a summary shaped exactly like the record's junit object, or
    malformed with one of 9 codes; every testcase element counts; raw control characters are junit.syntax (XML 1.0).
  - Report (1.3): EXECUTED_COMMAND_TEMPLATES and executedCommandItem label an item with the plan entry id (for example
    'head-test'), not the bare command id of the brief's example; ProvenanceInput gains optional runner (runtime, serverVersion,
    reference, imageDigest) rendering '- Runner: <runtime> <version>, image <reference> (<digest 12 hex>)' with code spans.

### Phase 2 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m7): phase 2 steps`), base 0a945f5. No
  planner amendment. All 19 steps route mechanical. No Podman-dependent step (PREREQ-PODMAN first applies in phase 3): Podman
  vectors and Podman JSON handling are proven by unit tests only. No file under packages/cli/, packages/action/, .github/,
  docs/, templates/, scenarios/, probes/ is in any scope.
- PREREQ-DOCKER (this phase, from the roadmap's GATE-CONTAINER on Windows Docker Desktop): 2.17 and the phase DoD need Docker
  Desktop running with Linux containers. At decomposition (2026-10-03) the daemon was NOT running (`docker version --format
  json` printed the client and `"Server":null`). Before launching 2.17 and before the phase DoD the supervisor runs `docker version
  --format '{{.Server.Version}}'`; no version means RESULT: needs-human (the owner starts Docker Desktop); never skip, stub,
  or substitute the container checks.
- Roadmap placement: the CI1 container config (vitest.container.config.ts) and the root `test:container` script land in 2.17
  because the phase 2 DoD runs GATE-CONTAINER; phase 3 still adds the CI job, the hostile corpus, and the conformance work.
- Dependency graph (scopes pairwise disjoint within each wave; merge order within a wave is free):
  - W1 (no deps): 2.1 stream process runner; 2.2 git ls-tree/cat-file stream readers; 2.3 runner types, argument vectors,
    client environment allowlist, forbidden-argument checker; 2.4 execution record builder; 2.5 Windows batch shims; 2.6
    own-checkout guard; 2.7 inert fetch; 2.8 runner build context; 2.9 repository-manifest test helper, hostile manifest,
    README bullet.
  - W2: 2.10 checkout archive (2.1, 2.2, 2.9); 2.11 runner image (2.1, 2.3, 2.8); 2.12 runtime selection (2.3); 2.13
    copy-out (2.1, 2.3, 2.4); 2.14 unsandboxed runner and the `exit E5:` tests (2.1, 2.4, 2.5, 2.6).
  - W3: 2.15 container runner (2.1, 2.3, 2.4, 2.13); 2.16 materializeCommit and the `exit E1:` tests (2.7, 2.9, 2.10).
  - W4: 2.17 container tier and smoke test (2.9, 2.11, 2.12, 2.15, 2.16; PREREQ-DOCKER; pulls busybox); 2.18 root exports
    (all module steps).
  - W5: (2.19 removed in the v4 revision; the supervisor runs the roadmap phase 2 dod block itself in the MAIN tree).
  - Critical path: 2.1 -> 2.13 -> 2.15 -> 2.17 -> phase DoD (2.2 or 2.9 -> 2.10 -> 2.16 -> 2.17 beside it).
- Couplings: fixtures/README.md 2.9 (repositories bullet after the junit bullet) then 2.17 (shell-sample bullet after it).
  index.ts 124 -> 140 export lines only in 2.18 (process/stream-process, git/object-stream, runner/types, runner/argv,
  runner/record, runner/windows-shim, runner/checkout-guard, materialize/fetch, runner/build-context, materialize/checkout,
  runner/image, runner/runtime, runner/copy-out, runner/unsandboxed, runner/container, materialize/materialize).
  invariant-5 stays unchanged: no new root function starts with load, validate, resolve, parse, capture, or check (hence
  materializeLimitsFromPolicy, not checkout...); 2.18 verifies the pinned lists still pass. All new names were checked
  unique across core and cli (TS2308).
- Environment and bootstrap facts (measured at decomposition on this host):
  - Each step's acceptance runs its own tests with TMP, TEMP, TMPDIR set to a private `<os tmp>/m7acc-<id>` directory and
    counts leftover `patch-steward-*` entries there, because parallel waves share the OS temp directory.
  - libuv on Windows adds HOMEDRIVE, HOMEPATH, LOGONSERVER, PATH, SYSTEMDRIVE, SYSTEMROOT, TEMP, USERDOMAIN, USERNAME,
    USERPROFILE, WINDIR from the parent to every child environment that lacks them (verified with a one-variable env).
    Phase 3's client-environment check must assert on the object runtimeCliEnvironment builds, or allow these names in an
    observed child environment on Windows.
  - git 2.55 with transfer.fsckObjects: tree names '..', '.', '.GIT', 'git~1', '.git.', '.' + U+200C + 'git', and a
    committed .gitmodules with `update = !cmd` or a url starting with '-' fail the FETCH; names with a backslash, a control
    byte, or invalid UTF-8 are fetched and must be rejected by the path rule. A depth-1 fetch by id of an unreferenced commit
    from a local path (backslash path) works. A dry run of the 2.16 hostile host configuration (global, system, HOME, XDG,
    GIT_CONFIG_COUNT/PARAMETERS, template dir, ask-pass, url rewrite, packObjectsHook, filters, fsmonitor, submodule update)
    through the 2.7 environment and options fetched and read the commit and wrote no marker.
  - Windows batch shims: CommandLineToArgvW quoting then caret escaping twice passed 29 hostile cases x 3 shim styles
    (one-line `%*`, parenthesized IF block, `@echo off` .bat), including injection attempts and a shim directory named
    '(x86) a&b'; single caret escaping is injectable through the shim. Process trees are killed with `taskkill /PID <pid> /T
    /F` on Windows and a process-group kill elsewhere.
- Emergent contracts for phases 3 to 5 (names exact; all modules under packages/core/src):
  - process/stream-process.ts (2.1): streamProcess(binary, args, { cwd, env, timeoutMs, stdin closed or bytes or file, output
    capture{limits} or sink{onStdout, stderrMaxBytes}, killTree?, windowsVerbatimArguments? }) -> { exitCode, signal, stopReason
    timeout or output-limit or sink-stop or null, captured, stderr, durationMs }; codes process.unavailable or failed or invalid-options.
    The only phase 2 module importing node:child_process besides the existing run-process.ts.
  - git/object-stream.ts (2.2): LsTreeRecordReader, CatFileBatchParser, commitObjectFields.
  - runner/types.ts and runner/argv.ts (2.3): SelectedRuntime, ResolvedImage, RuntimeLabels, label constants
    (org.patch-steward.managed, .run, .test, .runner-tree), RUNNER_IMAGE_REPOSITORY; runtimeCreateArgs(docker or podman, spec)
    = the hardened create vector (Podman adds '--read-only-tmpfs=false' after '--read-only'; mount 'volume-nocopy' identical),
    runtime*Args builders (volume create/rm, cp -a - <id>:/work, start -a, container inspect, cp <id>:<path> -, kill, wait,
    rm -f, version/info --format json, pull --platform linux/amd64, image inspect, build ... -t patch-steward-runner:<tree>
    -f <file> -), runtimeCliEnvironment (client allowlist), RUNTIME_FORBIDDEN_FLAGS, forbiddenRuntimeArguments(args) (create
    checked structurally up to the image; container arguments after the image are never checked; cp must stream through
    '-'; build context must be '-'). Phase 3's forbidden-token scan reuses forbiddenRuntimeArguments.
  - runner/record.ts (2.4): buildCompletedExecution(facts) -> the transport `completed` entry (unredacted parts and result
    texts; stored_path null; redaction-input omission flagged); ResultFileRead.
  - runner/windows-shim.ts (2.5): commandForPlatform, quoteWindowsArgument, escapeForCmd, cmdShimCommandLine,
    findWindowsExecutable (cmd.exe from SystemRoot, PATH x PATHEXT only).
  - runner/checkout-guard.ts (2.6): guardOwnCheckout, commandDirectory (code runner.not-own-checkout, reasons in
    details[0].message: github-actions, not-a-work-tree, path-unavailable, not-the-checkout-root, outside-checkout).
  - materialize/fetch.ts (2.7): fetchCommit, materializeGitEnvironment, githubFetchUrl; FetchedRepository { repoDir, env,
    configArgs, dispose }.
  - runner/build-context.ts (2.8): readRunnerBuildContext(git or github or local-file source, { dockerfilePath, maxBytes }) ->
    { runnerTreeId, dockerfilePath (relative to runner/), archive }.
  - materialize/fixture-repository.fixture.test.ts (2.9, test helper): loadFixtureManifest, createFixtureRepository,
    commitRawEntries, readArchiveEntries, fixtureGitEnv; manifest format in fixtures/README.md.
  - materialize/checkout.ts (2.10): buildCheckoutArchive -> { archivePath, facts = the record's checkout object }.
  - runner/image.ts (2.11): prepareRunnerImage(ctx, registry or dockerfile spec, imageLimitsFromPolicy(policy)) -> { result,
    buildLog } (buildLog is the raw capture for phase 4 to redact into logs/image-build.txt); imageRepository,
    normalizeImageRepository, imageInspectSchema.
  - runner/runtime.ts (2.12): selectContainerRuntime({ choice auto or docker or podman, hostEnv, control?, binaries? (test-only
    override, the CI4 rootful fallback hook) }); docker/podman version and info schemas.
  - runner/copy-out.ts (2.13): copyOutResultFile, exportPreparedCopy, containerResultPath.
  - runner/unsandboxed.ts (2.14): createUnsandboxedRunner (guards at construction) -> run(entry, unsandboxedLimitsFromPolicy
    (policy)) -> completed { execution, viaCmd, argv, directory } or refused or environment-failure runner.start-failed;
    unsandboxedEnvironment. Phase 3's import scan (only the CLI preflight module may use it) must also allow
    packages/core/src/index.ts, which re-exports it from 2.18 on.
  - runner/container.ts (2.15): runContainerExecution(ctx, { entry, archivePath, checkout, limits, preparedCopyPath }) ->
    completed { execution, durationMs, preparedCopy, dependencyFailure } or environment-failure { code, subject };
    containerLimitsFromPolicy, containerEnvironment, containerInspectSchema.
  - materialize/materialize.ts (2.16): materializeCommit -> { archivePath, checkout, dispose }; materializeLimitsFromPolicy.
  - runner/test-images.test.ts (2.17): SHELL_TEST_IMAGE (busybox 1.37.0 by digest; the digest is recorded in the 2.17 report
    and should be copied here); phase 3 adds the Node 24 slim image to the same module.
- Decomposer readings beyond the brief (all stricter or neutral; real-runtime behavior is confirmed in phase 3):
  1. RT1 "server (engine)": a Podman version JSON without Server (native Linux Podman, the CI leg) whose client OS is linux
     has the client as its engine; a remote Podman client without Server (machine stopped) is unavailable.
  2. container_start_seconds bounds volume create, create, and copy-in (each call also within K56); `start -a` runs under the
     execution timer. A stop decision kills the client, then issues `kill` (exit ignored) and `wait`, each within K58, else
     runner.cleanup-failed. Inspect showing Running after the client returned -> kill, wait, runner.start-failed (subject
     attach); State.Status 'created' or a non-empty State.Error -> runner.start-failed.
  3. RT3 on create: a stderr line matching /warn/i and /memory, swap, cpu, pids, limit, cgroup/ -> runner.limits-unenforceable.
     Docker info additionally requires MemoryLimit, PidsLimit, CpuCfsQuota true and no Warnings entry mentioning memory,
     swap, cpu, or pids (swap included because --memory-swap is a set limit).
  4. A result file is 'missing' only on a non-zero cp exit with no output bytes and a runtime message matching /no such file
     or directory or could not find the file/ (case-insensitive); anything else unexpected is runner.copy-failed. The
     Docker 29 and Podman wording was not observable at decomposition (daemon stopped): 2.17 exercises the Docker case.
  5. Dependency step: the completed result keeps its record and reports dependencyFailure runner.dependency-step-failed
     (non-zero, timed out, OOM, or output-limited) or runner.prepared-copy-too-large; phase 4 maps either to cause
     environment-unavailable and stops later entries. The prepared copy export is bounded by dependency_step_seconds and
     prepared_checkout_bytes, every tar entry must be 'checkout' or under 'checkout/', and it is never extracted.
  6. First environment failure wins; a cleanup failure is reported only without an earlier failure; both removals are always
     attempted; a written prepared copy is deleted on failure.
  7. Image build output capture: head 262144 + tail 786432 (= EVIDENCE_LOG_FILE_MAX_BYTES), stream bound
     limits.execution.output_stream_bytes.
  8. checkout.bytes = base blob bytes read plus overlay content bytes; checkout_bytes bounds the base running total. More than
     RECORD_LIST_MAX_ITEMS (1000) gitlinks or overlay entries -> materialize.checkout-too-large. Finding for M08 and phase 5:
     the overlay_files hard maximum (3000) exceeds the record's 1000-item list bound; unreachable in M07 (container overlays
     are M08).
  9. Declared result files beyond limits.execution.result_files (unreachable after XR4): container runner.copy-failed
     (subject result_files), unsandboxed runner.start-failed (subject result_files), both before any spawn.
  10. Unsandboxed records: environment.runtime { name host, versions null, os = process.platform, arch }, platform
     '<platform>/<arch>', network egress, no checkout key; result files read from the host checkout with lstat (symlinks and
     directories not-regular; realpath outside the root not-regular).
- Supervisor run state (2026-10-03):
  - Waves W1 (2.1-2.9), W2 (2.10-2.14), W3 (2.15, 2.16), and 2.18 verified by the supervisor (acceptance re-run sequentially in
    each worktree, scope diff against the wave base, one commit each) and merged; worktrees and wt/ branches removed. No
    revision, no retry. Worker-reported full-suite timeouts in W1 (packages/cli/src/preflight-command.test.ts,
    report-command.test.ts, packages/core/src/evidence/golden-reports.fixture.test.ts, EPERM on temp cleanup) came from nine
    concurrent full suites; every sequential re-run passed.
  - PREREQ-DOCKER failed at phase start, before 2.17 (after 2.18 merged), and again at return: `docker version --format
    '{{.Server.Version}}'` printed no version (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`).
    2.17 not launched; 2.19 not run. Resume line superseded by the v4 revision below.
  - Pipeline v4 migration (2026-10-23): the 2.17 and 2.19 step files predate the v4 step schema and go through a decomposer
    revision before the supervisor resumes; `docker version --format '{{.Server.Version}}'` printed 29.8.2 at migration.
  - v4 revision (commit `decompose(patch-steward-m7): revise phase 2`): 2.17 rewritten in place in the v4 schema (same id,
    objective, files_in_scope, and work; tier standard; the 12 prose checks became one acceptance_cmd with a 14-line exact
    acceptance_expect; rollback dropped). 2.19 removed (step file deleted, row kept): by the gate-step rule a verification-only
    step adds nothing here, because it would run the same main-tree checks the supervisor runs with dod-run.sh against the
    roadmap phase 2 dod block, and 2.17's own acceptance already runs the container tier, leak checks, full vitest run,
    typecheck, lint, and format on its files before the gate.
  - Resume: re-run `docker version --format '{{.Server.Version}}'`; launch 2.17 as a lone ready step in the MAIN tree (no
    worktree, no bootstrap); verify and merge it; then run `dod-run.sh` on the roadmap phase 2 dod block in the MAIN tree.
  - Non-gate pre-check in the MAIN tree at 6c9871f (not the 2.19 gate): `pnpm vitest run` 223 files, 4103 tests, exit 0, 0
    leftover patch-steward-* entries in a private temp dir; typecheck, build, lint, format:check exit 0; production modules
    importing node:child_process are only packages/core/src/process/run-process.ts and stream-process.ts (13 pre-existing
    test files elsewhere also import it; the gate step decides whether tests count); 5 `exit E1:` and 7 `exit E5:` titles.
- Exit-criteria test titles delivered in this phase (the phase 3 notes list every `exit E<n>:` title):
  - E1 (packages/core/src/materialize/materialize.fixture.test.ts): 'exit E1: host git configuration never runs', 'exit E1:
    attributes and submodules never apply', 'exit E1: hostile tree names never materialize', 'exit E1: traversal overlays are
    rejected', 'exit E1: symlink-escaping overlays are rejected'.
  - E5 (packages/core/src/runner/unsandboxed.fixture.test.ts): 'exit E5: refuses a subdirectory of the checkout', 'exit E5:
    refuses another repository', 'exit E5: refuses a directory outside any repository', 'exit E5: refuses a bare repository',
    'exit E5: refuses to run under GitHub Actions', 'exit E5: refuses a working directory leaving the checkout', 'exit E5:
    refuses a preview worktree it did not create'.

### Phase 3 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m7): phase 3 steps`), base b337f85. No
  planner amendment. All 14 steps route mechanical; 3.12 and 3.14 are tier lite (verbatim content plus a check). No step
  edits packages/core/src/index.ts (no new root export, invariant-5 pins unchanged), docs/, packages/cli/, packages/action/,
  scenarios/, probes/, templates/.
- PREREQ-PODMAN: only 3.13 is Podman-dependent (marked PODMAN-DEPENDENT in its objective and context). The supervisor runs
  PREREQ-PODMAN before launching 3.13 and before the phase gate. At decomposition (2026-10-23) `podman version` printed
  Client 6.1.2 (windows/amd64) and "Cannot connect to Podman ... connection refused": the machine podman-machine-default
  (rootful, cgroupfs) was NOT running; a still-failing check at 3.13 is RESULT: needs-human (the owner starts the machine).
- PREREQ-DOCKER: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.12, 3.13 run Docker Desktop (server 29.8.2 at decomposition); the supervisor
  checks `docker version --format '{{.Server.Version}}'` before launching them.
- Dependency graph (scopes pairwise disjoint within each wave):
  - W1 (no deps): 3.1 Linux CI test fixes; 3.2 container harness, Node test image, TypeScript sample; 3.7 invariant-3 unit;
    3.8 core zero-execution rewrite; 3.9 invariant-1 and invariant-5 execution tests; 3.10 invariant-4 execution tests (unit
    and fixture); 3.11 invariant-7 execution tests; 3.12 CI container-tests job (act).
  - W2 (after 3.2): 3.3 resource limits; 3.4 invariant-3 container (profile, identity, network, sockets, mounts, canary);
    3.5 result files and injection text; 3.6 environment failures.
  - W3: 3.13 Podman tier (after 3.1-3.12; runs ALONE, no parallel container work); 3.14 fixtures README (after 3.2-3.5;
    lite, may run beside 3.13).
  - Critical path: 3.2 -> W2 -> 3.13 -> phase gate.
- Known finding (phase 2 migration dry run, act build-and-test at c91ee78, 4 failing tests) reproduced by the decomposer in
  node:24 with GITHUB_ACTIONS=true and a non-reaping PID 1, plus a fifth flaky failure; root causes, all in test code (3.1):
  unsandboxed.fixture.test.ts passes process.env (GITHUB_ACTIONS=true under CI) so the own-checkout guard correctly refuses
  ('exit E5: refuses a working directory leaving the checkout', 'runs a command in the own checkout', 'runs a command in a
  preview worktree'); stream-process.test.ts 'kills the whole process tree' sees the killed grandchild as a zombie (state Z,
  kill 0 succeeds) because the container's PID 1 never reaps it; materialize.fixture.test.ts 'removes temporary files after
  materializing' races with fetch.fixture.test.ts over the shared OS temp directory. The same GITHUB_ACTIONS cause would
  fail the windows-latest leg on GitHub. 3.1 verifies in a node:24 container (digest
  sha256:6449e19d8184d84062525b6a7524def03146c2cb04a7f08b076680d0e8e4240a, used only by that acceptance) and on Windows
  with GITHUB_ACTIONS=true. Other new unit and fixture steps verify on Windows with GITHUB_ACTIONS=true; the phase gate's
  act build-and-test item is the Linux check for them.
- act dry run: the 3.12 job appended to an LF clone at b337f85 ran `act pull_request -W .github/workflows/ci.yml -j
  container-tests --matrix runtime:docker -P ubuntu-latest=catthehacker/ubuntu:act-latest` with the existing smoke test:
  'Job succeeded' (the act job container reaches the host daemon; no bind mount needed).
- Test images (pinned in packages/core/src/runner/test-images.test.ts; containerd store: image id = repo digest):
  SHELL_TEST_IMAGE docker.io/library/busybox@sha256:bdf57e528e45e4433820e045b29b4597825a1c9e38353532d90a01445013f82e
  (1.37.0); NODE_TEST_IMAGE docker.io/library/node@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
  (24-slim, Node 24.22.1), added by 3.2.
- Measured at decomposition (Docker Desktop, hardened flags, busybox): `tail /dev/zero` with --memory 128m exits 137;
  `sleep 30 &` loop with --pids-limit 64 prints "can't fork"; dd of 64 MiB into a 16m /tmp stops at 16 MiB; /sys/class/net
  lists only lo; CapEff 0, NoNewPrivs 1, uid 65532; no runtime socket. Node 24 slim runs `node --test --test-reporter=junit
  --test-reporter-destination=junit.xml test/math.test.ts` on a read-only root with HOME=/tmp (exit 1 for one failing test;
  testcases directly under testsuites; the reporter cannot create a missing directory).
- Bootstrap: `pnpm install --frozen-lockfile` in each new worktree, one at a time. Step acceptances run only their own test
  files (never the full suite) with a private TMP, TEMP, TMPDIR under `<os tmp>/m7acc-<id>`; container-step acceptances do
  not run the global label leak checks (parallel W2 containers would race them); every harness close() asserts that
  nothing labeled with its own nonce remains, and 3.13 plus the phase gate run the global leak checks.
- Couplings:
  - Harness contract (3.2, packages/core/src/runner/container-harness.container.test.ts): RUNTIME_NAME, HARNESS_LIMITS,
    HarnessCall, HarnessCheckout, HarnessRunInput, ContainerHarness { runtime, nonce, calls, inspected, prepareImage,
    materialize, run, close }, openContainerHarness({ hostEnv? }), outputText(result); consumed by 3.3-3.6 and 3.13.
    Importing a test helper also runs its tests: the harness's own test ('reads the runtime name') is container-free.
  - Manifest descriptions are fixed verbatim in 3.2-3.5 and copied, first letter lower-cased, into fixtures/README.md by
    3.14 (bullets after the shell-sample bullet).
  - Exit-test titles are fixed verbatim in 3.3, 3.4, 3.6, 3.10 and listed below; workers add no other 'exit E' string.
    Titles must stay plain string literals (the ledger title check reads quoted strings from packages/*/src).
  - 3.13 may change Podman builders and parsers in runner/ and the Podman vector in invariant-3.test.ts, and may adapt
    container tests only to read Podman-shaped fields of the same value; Docker vectors never change.
- Emergent contracts and leads for phases 4 and 5:
  - The canary test (3.4) scans the record JSON and output text bytes it writes itself; phase 4's screen end-to-end test
    should also scan an actual stored run directory for a host canary (the phase 3 manual DoD item names run-directory
    bytes; phase 3 has no executed-run store).
  - invariant-4 pipeline-level injections (plan over budget, transport invalid or unbound, phase throws, preflight-run
    failures) and the EP7 matrix through screen are phase 4; phase 3 covers the runner, image, container, dependency-step,
    and materialization injections (3.10) with 'exit E4:' titles in the unit and fixture tiers.
  - invariant-7 publish-side items (redaction of build logs and stored result files, ER10 drop order) are phase 4.
  - packages/cli/src/preflight-zero-execution.fixture.test.ts and steward-zero-execution.fixture.test.ts are unchanged in
    phase 3 (they already allow only read-only git and `gh auth token`); phase 4 rewrites them for `--run` and screen
    execution. Lead: the brief says `steward screen` spawns only git and the selected runtime binary, but the screen command
    already spawns `gh auth token` for credential resolution; the phase 4 decomposition should reconcile this (possibly an
    amendment note).
  - The unsandboxed-runner import rule (3.7) allows packages/cli/src/preflight-run.ts as the future preflight module name;
    phase 4 should use that path or change the rule in the same step.
  - CI Podman leg: first runs on GitHub after the owner pushes; the rootful fallback hook is selectContainerRuntime's
    `binaries` override (test-only).
- Podman versions for the gate record (the supervisor appends the line after PREREQ-PODMAN passes, from `podman version
  --format '{{.Client.Version}} {{.Server.Version}}'`): 6.1.2 6.1.3 (client server; PREREQ-PODMAN passed 2026-10-23 before 3.13: `podman version` exit 0 with a Server section, podman-machine-default running).
- Exit-criteria test titles (every `exit E<n>:` title in packages/*/src after this phase):
  - E1 (packages/core/src/materialize/materialize.fixture.test.ts): 'exit E1: host git configuration never runs', 'exit E1:
    attributes and submodules never apply', 'exit E1: hostile tree names never materialize', 'exit E1: traversal overlays
    are rejected', 'exit E1: symlink-escaping overlays are rejected'.
  - E2 (packages/core/src/runner/limits.container.test.ts): 'exit E2: a fork bomb stops at the pids limit', 'exit E2: a
    memory hog ends oom killed', 'exit E2: a sleeper ends timed out', 'exit E2: an output flood ends output limited', 'exit
    E2: an invalid UTF-8 flood stays bounded', 'exit E2: a scratch filler hits ENOSPC'.
  - E2 (packages/core/src/conformance/invariant-3.container.test.ts): 'exit E2: the container config matches the profile',
    'exit E2: the sandbox runs as 65532 without privileges', 'exit E2: the sandbox has no network but loopback', 'exit E2:
    no runtime socket is reachable', 'exit E2: only the checkout and scratch are mounted'.
  - E3 (packages/core/src/conformance/invariant-3.container.test.ts): 'exit E3: host canaries are absent inside the
    container', 'exit E3: host canaries are absent from records and files'.
  - E4 (packages/core/src/runner/failures.container.test.ts): 'exit E4: a missing image is an environment failure', 'exit
    E4: a failed image build is an environment failure', 'exit E4: an oversize image is an environment failure', 'exit E4:
    a missing entrypoint is an environment failure', 'exit E4: an absent runtime is an environment failure'.
  - E4 (packages/core/src/conformance/invariant-4-execution.test.ts): 'exit E4: runtime failures are environment
    failures', 'exit E4: image failures are environment failures', 'exit E4: container failures are environment failures',
    'exit E4: a failed dependency step is an environment failure', 'exit E4: environment failures never yield pass'.
  - E4 (packages/core/src/conformance/invariant-4-execution.fixture.test.ts): 'exit E4: a failed fetch is an environment
    failure', 'exit E4: a rejected overlay is an environment failure', 'exit E4: an oversize checkout is an environment
    failure'.
  - E5 (packages/core/src/runner/unsandboxed.fixture.test.ts): 'exit E5: refuses a subdirectory of the checkout', 'exit E5:
    refuses another repository', 'exit E5: refuses a directory outside any repository', 'exit E5: refuses a bare
    repository', 'exit E5: refuses to run under GitHub Actions', 'exit E5: refuses a working directory leaving the
    checkout', 'exit E5: refuses a preview worktree it did not create'.

- Supervisor run state (2026-10-23): 3.1-3.12 and 3.14 done and merged (3.1 acceptance threshold corrected in flight; 3.5 retried once after a step
  correction). 3.13 (Podman tier) FAILED on a STOP condition and is recorded failed; the phase gate was NOT run. The worker's partial work is
  preserved on local branch preserve/patch-steward-m7-3.13-podman (commit 048d930, base ac61e6a): image.ts picks the RepoDigest equal to the
  pin when Podman lists several; argv.ts omits volume-nocopy from the Podman --mount (Podman rejects it) and the forbidden-argument regex accepts
  both forms; unit tests and invariant-3.test.ts Podman vector updated. Evidence for the human decision: with the hardened create vector
  Podman 6.1.3 (rootful machine) shows in /proc/self/mountinfo the extra mounts /etc/passwd, /etc/group, /run/.containerenv, /run/secrets
  (beyond the 3.13 allowed set), although inspect Mounts lists only /work; CapEff/CapPrm/CapBnd are all zero, but inspect HostConfig.CapDrop
  is the 11-capability default list, not ALL; `podman create --passwd=false` is an unknown flag; four tests report a result file as missing
  under Podman (not investigated). The worker ran `podman rm -a -f` while probing (removed every Podman container on the machine; the list
  was empty afterwards). Leak checks (containers, volumes, images labeled org.patch-steward.test) are empty for Docker and Podman.
- Revision of 3.13 (after owner decision Q21 A, amendment ccbcabf): step file rewritten, row reset to pending (first attempt: 37561 tokens, 25 tool uses, 407 s, failed). Same files_in_scope (no fixture change: the Podman mask and /run/secrets probes run as direct argv through harness.run). New test title (not an exit-criteria title): 'image content at /work is not copied into the volume' in packages/core/src/conformance/invariant-3.container.test.ts, both runtimes. Acceptance now also requires zero non-passed tests in both tiers (vitest JSON), that title passed under both runtimes, the dockerExpected() function in argv.test.ts byte-identical to ccbcabf, and the Docker mount allow-list line unchanged. Possible needs-human outcomes the step reports as STOP: non-empty or unlistable /run/secrets (host data), Podman copies image content into /work with no accepted no-copy option (separate HP2 question), a needed fix outside scope. Safety: the step forbids podman/docker bulk removal (rm -a, prune, system reset, machine changes); cleanup only by org.patch-steward.test label.
- Supervisor run state (2026-10-23, second 3.13 attempt): 3.13 FAILED again on two STOP conditions and is recorded failed (46638 tokens, 24 tool uses, 217 s); the phase gate was NOT run. Partial work preserved on local branch preserve/patch-steward-m7-3.13-podman-2 (commit ee22fbc, base 4ce1574; report in that commit); the working branch was reset to 4ce1574 so it carries no failing tests. STOP 1: under Podman 6.1.3 /run/secrets is mounted and lists the entry rhsm (rhsm/ca, rhsm.conf, syspurpose: Red Hat subscription data injected from the Podman machine VM default mounts), so the HP8 Podman variant requirement that /run/secrets is empty fails 'exit E2: only the checkout and scratch are mounted'. STOP 2: Podman rejects volume-nocopy, volume-nocopy=true, nocopy, nocopy=true, copy=false, and no-copy as --mount type=volume options (invalid mount option) and copies image content at /work into the volume: the new test 'image content at /work is not copied into the volume' got checkout and image-copied under Podman, passes under Docker; volume-opt=nocopy and volume-opt=copy=false are accepted at create but are volume-driver options, not a copy-up control. Also: the new test's dockerfile-built image (labeled org.patch-steward.test) is not removed by the harness close(), so the leak check fails on both runtimes (test defect to fix in the next revision). Not reached: the four Podman result-file missing tests, the full Podman tier, static checks. Leak checks after cleanup by label only: containers, volumes, images labeled org.patch-steward.test empty on Docker and Podman.
- Revision of 3.13 after amendment 98bd205 (owner decisions Q22 A and Q23; second attempt: 46638 tokens, 24 tool uses, 217 s, failed; preserved on preserve/patch-steward-m7-3.13-podman-2, ee22fbc): split into two sequential steps. 3.13 (runtime-independent, unit tier only, no docker/podman): Podman --mount type=volume,src=<v>,dst=/work without a no-copy option (Docker unchanged), forbidden-argument check accepts exactly the two mount forms and cp <id>:/work -, new exported argv builder runtimeWorkProbeCreateArgs(labels, imageReference) (IM5 vector verbatim from the brief), the IM5 probe inside prepareRunnerImage under Podman only (unexported; TarStreamParser decision; codes runner.create-failed with detail path /work message image-work-not-empty, runner.copy-failed, runner.cleanup-failed; ImageFailureCode extended), RunnerImageContext gains optional runId (Podman without runId fails closed runner.create-failed, no call), RepoDigest-equal-to-pin selection reused from ee22fbc; 15 unit titles prefixed 'podman /work probe: ' plus 'accepts exactly the docker and podman /work mount forms' and the reused RepoDigest title, checked by exact title in vitest JSON; invariant-3.test.ts recorder gains an image inspect reply and prep a runId so the HP3 scan covers the probe create and cp vectors (asserted count > 0). 3.15 (PODMAN-DEPENDENT, runs ALONE after 3.13): harness and container.container.test.ts pass runId to prepareRunnerImage; HP8 Podman variant reused from ee22fbc; the three runtime-registered /work copy-up titles (Docker 'image content at /work is not copied into the volume'; Podman 'an image with content at /work is refused under podman' and 'an image with an empty /work yields only the checkout under podman'), each removing its image by tag patch-steward-runner:<tree> (trees c, d, e x40) so the leak checks stay empty; root cause and Podman-specific fix of the four result-file 'missing' tests; acceptance checks each runtime's own titles passed exactly once and the other runtime's titles absent, all tests passed, E2-E4 passed, leak checks empty on both runtimes, 3.13 probe tests still passing. Probe label for hand-made 3.15 objects: org.patch-steward.test=probe-3.15. Q23: the owner emptied the Podman machine's default mounts; 3.15 action 1 lists /run/secrets first and a non-empty listing is a STOP (needs-human). Emergent contract for phase 4: every prepareRunnerImage caller that can select Podman must pass runId (the run's id) in RunnerImageContext, else Podman preparation fails closed.
- Supervisor run state (2026-10-23, end of phase 3 steps): 3.13 done (6fc0a1b, merged; unit tier) and 3.15 done (2167c77 merge; one commit on base a9b2d77; step corrected in flight for an absent /run/secrets). 3.15 root cause of the Podman result-file 'missing' tests: the Podman 6.1.2 Windows client cannot stream `podman cp <id>:<path> -` (exit 125, no bytes, stderr `Error: "/dev/stdout" could not be found on the host: no such file or directory`), which copy-out.ts read as not-found; the IM5 probe passed vacuously for the same reason. Podman-only fix: fallback to `podman volume export <volume>` (result files, prepared copy) and `podman export <probe>` (IM5), both validated by forbiddenRuntimeArguments; a Podman cp not-found is confirmed through the volume export (symlink is not-regular, only an absent path is missing). Finding for phases 4 and 5: native Linux Podman (CI leg) uses `cp -` unchanged; the fallback triggers only on that exact stderr. Phase 3 dod run in the MAIN tree: DOD PASS 14/14, 2 manual (HP8 behavioral coverage, canary coverage); phase left pending for the owner to confirm those two items.
- Owner confirmations (2026-10-23, via the lead): (1) HP8 behavioral coverage: confirmed. (2) Canary coverage: accepted for phase 3 and deferred to phase 4, which must scan an actual stored run directory for a host canary. Phase 3 marked complete; current-phase set to 4.

### Phase 4 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m7): phase 4 steps`), base 395fbfa (brief
  and roadmap amended for exact host spawn sets). No planner amendment from this run. 21 steps, all route mechanical; 4.1
  is tier lite (verbatim executor contract, dry-run by the decomposer: prettier, eslint, tsc, 3 tests pass). No step adds an
  'exit E' title (the project DoD item 5 and phase 3 check read only the Phase 3 notes list). No step edits docs/,
  templates/, scenarios/, probes/, packages/action/, .github/.
- PREREQ-PODMAN: only 4.20 and 4.21 are PODMAN-DEPENDENT (marked in their objective and context); the supervisor runs
  PREREQ-PODMAN before each and before the phase gate. PREREQ-DOCKER (`docker version --format '{{.Server.Version}}'`):
  4.19, 4.20, 4.21 and the gate. 4.20 and 4.21 run ALONE (no parallel container work); 4.19 starts no container.
- Dependency graph (scopes pairwise disjoint within each wave; checked by script):
  - W1 (no deps): 4.1 executor contract; 4.2 execution evidence files; 4.3 run record, metrics, report-input execution
    facts; 4.4 screen --container-runtime; 4.5 core preview worktree (+ the only index.ts edit); 4.6 preflight --run args
    and run-report output.
  - W2: 4.7 execution phases session (4.1); 4.8 host plan executor (4.1); 4.9 publish integration (4.2, 4.3); 4.10 CLI
    preflight-run module (4.5, 4.6).
  - W3: 4.11 screen pipeline wiring + empty-executor injection in existing PR tests (4.7, 4.8, 4.9); 4.12 executed-run
    golden reports (4.9); 4.13 invariant-7 and invariant-1 publish conformance (4.9); 4.14 preflight command wiring (4.6,
    4.10).
  - W4: 4.15 CLI screen wiring + screen spawn-set spy rewrite (4.4, 4.11); 4.16 invariant-4 pipeline injections (4.11);
    4.17 preflight --run exit matrix and never-pass (4.14); 4.18 preflight spawn-set spy rewrite (4.14); 4.19 preflight
    end-to-end container-tier test (4.14).
  - W5: 4.20 screen end-to-end, report verify, run-directory canary scan, Docker and Podman (4.15).
  - W6: 4.21 screen end-to-end evidence-budget drop and redaction-input omission, Docker and Podman (4.20).
  - Critical path: 4.1 -> 4.7 -> 4.11 -> 4.15 -> 4.20 -> 4.21 -> phase gate.
- Bootstrap: `pnpm install --frozen-lockfile` in each new worktree, one at a time. Acceptances run their own files with a
  private TMP/TEMP/TMPDIR `<os tmp>/m7acc-<id>` and GITHUB_ACTIONS=true, plus the listed directory suites (core evidence,
  pipeline, conformance; cli) where a step changes shared code; measured at base: core evidence+pipeline+conformance+cli
  report-command 73 files, 1446 tests, about 7 s. Several acceptances compare against the fixed base commit 395fbfa.
- Couplings: packages/cli/src/steward-zero-execution.fixture.test.ts: 4.11 adds a temporary inline empty executor through
  context.screen (its PR test reaches execution once 4.11 lands, and the CLI cannot pass an executor before 4.15); 4.15
  removes it and rewrites the file to drive the real host executor with nonexistent runtime binaries. Worlds are copied,
  never imported: 4.16 from 4.11's screen-execution.test.ts; 4.17, 4.18, 4.19 from 4.14's preflight-run-command fixture;
  4.21 from 4.20. index.ts 140 -> 141 export lines only in 4.5 (runner/preview-worktree); no other new module is
  root-exported, so no invariant-5 pin changes (no new load/validate/resolve/parse/capture/check root function).
  fixtures/README.md only in 4.12.
- Carry-over leads: (a) 4.8 always passes runId = String(plan.run.run_id) to prepareRunnerImage (acceptance greps it); (b)
  the Podman Windows `cp -` fallback is used through runContainerExecution and copy-out.ts, nothing new; (c) 4.20 scans
  every byte under the stored evidence directory for the canary value, its variable name, the token, and the host temp
  file path; (d) settled by 395fbfa: 4.15 proves the screen spawn set (git, the runtime binary with `version` only when
  binaries are nonexistent, at most one `gh auth token --hostname github.com` before any runtime call), 4.18 proves the
  preflight sets without and with --run; (e) pipeline-level invariant-4 injections in 4.16 (over budget, transport invalid
  and unbound, throwing executor and intake, hanging executor, every I4 code, run seconds); preflight-run failures in 4.17.
- Manual phase DoD items -> proving tests: screen and preflight end-to-end in the docker tier: 4.20 'screen executes the
  head commit and stores a verified run', 'screen stores no host canary in the run evidence'; 4.21 both titles; 4.19 three
  'preflight run ...' titles. Podman screen end-to-end with --container-runtime podman: 4.20 and 4.21 under
  STEWARD_CONTAINER_RUNTIME=podman. steward report verifies an executed run: 4.20 (runReportCommand exit 0) and 4.9 'stores
  execution records, output files, and result files that verify'. ER10 drop order: 4.9 'drops result files in
  evidence-budget order and still verifies', 4.13 'invariant 7: result files drop last execution first over the evidence
  budget', 4.21 'screen drops result files over the evidence budget and still verifies'. Redaction-input omission: 4.9 'omits
  a redaction-input result file and still verifies', 4.21 'screen omits an oversize decoded result file and still
  verifies'. Too many files: 4.9 'ends evidence.too-many-files over the run file bound'. Preflight without --run spy: 4.18
  'without run only read-only git and gh auth token are spawned'. Exit matrix: 4.17 'preflight run exit statuses follow the
  precedence matrix'. Invariant-4 EP7 matrix: 3.10 (runner, image, container, dependency step, materialization) plus 4.16.
- Live tier (I21): no step edits packages/cli/src/steward-commands.live.test.ts. Its PR 26 test under the template policy
  expects needs-changes, a contract early exit, so screening plans and executes nothing and the expectations should hold
  unchanged; the supervisor runs `pnpm test:live` once at the gate and records the result here. A failure caused by
  execution behavior is a revision (expectation update), never a skip.
- Emergent contracts for phase 5 (names exact): execution/executor.ts PlanExecutor, PlanExecutionContext,
  PlanExecutionOutcome, EXECUTION_BUDGET_CAUSE_CODES ('execution.over-budget', 'execution.time-exhausted'),
  executionBudgetCause, executionEnvironmentCause (message 'An execution environment failure stopped the plan.'),
  emptyPlanExecution; pipeline/execution-phases.ts createScreenExecutionSession; runner/plan-executor.ts hostPlanExecutor
  (test-only fetchSource, testNonce, binaries); evidence/execution-evidence.ts prepareExecutionEvidence,
  dropLastStoredResultFile; evidence/publish.ts RunExecutionEvidence; pipeline/screen.ts ScreenExecutionOptions and
  ScreenDeps.execution; cli ScreenCommandContext.execution; runner/preview-worktree.ts createPreviewWorktree,
  checkoutTopLevel, workingTreeDirty; cli/preflight-run.ts runPreflightExecutions, PREFLIGHT_RUN_WARNING_CODES
  (preflight.run-without-policy, preflight.working-tree-dirty, preflight.preview-skipped, preflight.preview-unavailable);
  cli/preflight-output.ts PREFLIGHT_RUN_NOTICE, PreflightRunReport, preflightRunLine, preflightResultLine.
- Decomposer readings beyond the brief (stricter or neutral; phase 5 documents what lands): the executor stops at the first
  environment failure and on a failed dependency step (cause subject 'dependency-step'); an empty plan or an issue spawns
  no runtime command at all; a results transport may cover fewer entries than the plan only by stopping (no extra rule);
  run_execution_seconds is checked before each entry against summed completed durations; the run record's runner_identity
  and the report runner line appear only when at least one record exists; container_seconds is unrounded, the handoff
  execution_seconds debit is ceil(summed ms / 1000); the publish file-count check runs before redaction and before any
  drop and counts every stored file; logs/image-build.txt is the redacted head 262144 + tail 786432 capture truncated to
  1048576 bytes; publish re-validates the results transport and a failure adds a steward-defect cause (subjects
  ['publish']) and stores no executions; preflight --run: the JSON `run` key is omitted without --run and follows `paths`
  with it; over executions_per_run nothing runs with error 'preflight.run-over-budget' and exit 3; exhausted
  run_execution_seconds marks the rest 'skipped' (code 'execution.time-exhausted', exit 3); checkout runs precede the
  preview; preview ids 'base-dependency-step' and 'base-<id>'; a renamed test path also deletes its previous path in the
  preview; a guard refusal is an error (not an execution entry) with exit 2; text result-line formats as pinned in 4.6.
- Known limitation: on an execute-phase timeout the sequence moves on while the executor may still be stopping containers
  (cleanup always runs in finally; leak checks after each container step stay the guard).
- Phase 4 execution (supervisor, 2026-10-23): steps 4.1-4.21 all done. Retries: 4.5 (invariant-5 pin for checkoutTopLevel added to
  its scope), 4.20 and 4.21 (report exit for a verified inconclusive run is 3, not 0); see Revisions. Integration fix after 4.12:
  invariant-6 golden report file count 16 to 20. Gate run in the MAIN tree (dod-run.sh Phase 4): DOD PASS 8/8 with 10 manual
  items (base gate exit 0 with temp entries unchanged, docker tier, podman tier, both leak checks empty). Live tier (I21):
  `pnpm test:live` run once at the gate: 3 files passed, 14 tests passed, 1 skipped, no expectation change needed. Manual-item
  evidence (passing tests): docker e2e 4.19 'preflight run' titles, 4.20, 4.21; podman e2e 4.20 and 4.21 under
  STEWARD_CONTAINER_RUNTIME=podman; report verifies executed run 4.9 and 4.20; ER10 drop 4.9, 4.13, 4.21; redaction-input
  omission 4.9, 4.21; too-many-files 4.9; preflight spy 4.18; exit matrix 4.17; EP7 matrix 3.10 plus 4.16. Phase 4 stays
  pending until the lead confirms the manual items.
- Phase 4 manual confirmations (owner via the lead, 2026-10-23): the owner ran the named tests themselves and confirmed all 10 manual
  items pass: Docker tier, Podman tier, report verification of an executed run, ER10 drop order, redaction-input omission,
  too-many-files, preflight spawn spy, PF6 exit matrix, invariant-4 EP7 matrix, and the live tier record. Phase 4 complete;
  current-phase 5.

### Phase 5 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m7): phase 5 steps`), base 1921fc5. No
  planner amendment. 16 steps, all route mechanical; 5.16 is tier lite (verbatim line, dry-run by the decomposer: prettier ok,
  grep 1). Documentation only: no step edits packages/, templates/, scenarios/, probes/, .github/, or docs/deferred.md. Every
  step was assembled from shared fact blocks (rules, screen, preflight, materialization, images, runtimes, profile, Podman,
  dependency step, records, JUnit, keys, constants, tier, codes) so all documents state one set of facts; each acceptance was
  dry-run at base (runs, exit 0, prints the expected FAILED list) and the 5.2 row checks were positively dry-run against
  Prettier-aligned rows.
- Runtimes: no step starts a container. The supervisor runs PREREQ-PODMAN and the Docker server check only before the phase
  gate (DoD items 2-6 need Docker; item 4 needs PREREQ-PODMAN; a failing PREREQ-PODMAN is needs-human).
- Dependency graph (scopes pairwise disjoint within each wave):
  - W1 (no deps, 13 steps): 5.1 architecture status, §4, §6.1-§6.3, §6.5, §6.7; 5.4 processes SP05, SP09, SP17, SP19, SP20;
    5.5 ADR-0079, 0080, 0082; 5.6 ADR-0081, 0083; 5.7 ADR-0084, 0085; 5.8 ADR-0086, 0087; 5.9 ADR-0088, 0089, ADR-0067
    status, ADR index; 5.11 CLAUDE.md; 5.12 README.md; 5.13 user manual configuration; 5.14 user manual commands; 5.15
    user manual installation, overview, usage, troubleshooting; 5.16 fixtures README (lite).
  - W2: 5.2 architecture §8, §12, §12.1, §13, §15 (after 5.1, same file).
  - W3: 5.3 architecture §9, §11, §14 (after 5.2, same file).
  - W4: 5.10 whitepaper §9-§14 (after 5.3, 5.4, 5.5-5.9); its acceptance also checks that the ADR index has 89 rows and
    that every index link resolves to a file (the cross-step check for 5.5-5.9).
  - Critical path: 5.1 -> 5.2 -> 5.3 -> 5.10 -> phase gate.
- Bootstrap: `pnpm install --frozen-lockfile` in each new worktree, one at a time (acceptances run `pnpm exec prettier`).
  Every acceptance runs Prettier --check on its own files, a planning-id scan of its own files against ee878e5 (stricter
  than the DoD pattern: adds M1-M9, K1-K9, D1-D8, C, CB, CQ, CW, and I prefixes), and a node presence/absence check printing
  one `... checks ok` line.
- Couplings: ADR file names and index rows are fixed in the step files (5.9 writes all 11 index rows while 5.5-5.8 write the
  records in parallel; titles exactly as brief G10). Shared files only along the 5.1 -> 5.2 -> 5.3 chain (docs/architecture.md),
  each step owning disjoint sections. No step renames a heading (manual TOC and cross-file anchors). The whitepaper reads
  the finished governing text (depends on 5.3, 5.4, and all ADR steps). README.md, CLAUDE.md, and the manual pages are
  written in parallel from the same fact blocks, not from each other.
- Decomposer readings beyond the brief (phase 5 documents what landed in phases 1-4; leads from the Phase 3 and 4 notes
  and the 395fbfa and Q21-Q23 amendments are projected without planning ids):
  - All 11 ADRs dated 2026-09-28 (decision set date, whitepaper paragraph "Decisions recorded on September 28, 2026");
    ADR-0085 More Information adds that the Podman-only mount, capability, and /work rules were decided on October 23, 2026.
  - The Podman-only differences (four Podman-generated mounts with empty /run/secrets and the mounts.conf host condition,
    the five zero capability masks, the bare /work mount with the never-started probe and image-work-not-empty refusal,
    CW1-CW4 and CQ1-CQ4 as prose consequences) go to architecture §12 (or §13), the user manual Runner section, ADR-0085,
    and troubleshooting; the Podman Windows `cp -` fallback (`podman volume export`, `podman export`) to ADR-0084 and the
    runtimes text; the runId requirement of prepareRunnerImage is a code contract, not documented.
  - Host process sets of screen and preflight (395fbfa) stated in architecture §6.5, ADR-0088, ADR-0089, commands.md,
    CLAUDE.md/README summaries.
  - §12.1 hard-only constants: 13 rows (K54 split into attributes per element and attribute value length); K56 grouped as
    "Container runtime control command timeout/output", K58 as "Container kill-and-remove grace"; sandbox user, platform,
    paths, and fetch depth named as fixed values. §12.1's "not runtime defaults, because these keys are required" sentence
    is amended for the 17 defaulted keys; §8 Defaults names all 17.
  - §13 gains two rows ("Hostile repository content during materialization", "Dependency-step egress"); §15 keeps
    "Platform coverage beyond Linux containers" (the manual's Execution callout is replaced by a statement pointing at §15).
  - The manual's other [NEEDS INPUT] callouts (publication flag, init/replay, self-review options) stay; only the preflight
    mandatory-command clause of the CLI-commands callout is removed.
  - fixtures/README.md: every new fixture is covered by directory bullets (junit/, repositories/, reports/ list the cases);
    5.16 makes the policies/invalid/ bullet name the four cross-field fixtures (DoD item 14 manual record).
  - Verification-coverage sentence everywhere: Windows with Docker Desktop and with a Podman machine, Ubuntu with Docker
    through the locally run CI job; CI Podman leg not yet run on GitHub; macOS supported but untested.
- Emergent contracts: ADR-0067 status `superseded by ADR-0088`; ADR index 89 rows; whitepaper decisions paragraph opening
  `Decisions recorded on September 28, 2026 (ADR-0079–ADR-0089 in `docs/adr`)`.
- Execution (2026-10-23): wave 1 (13 steps) ran in worktrees on C:/w, 5.2, 5.3, 5.10 ran in the main tree; all 16 steps passed
  step-verify on the first attempt, no retries, no revisions. Phase gate (dod-run, Docker 29.8.2 server, PREREQ-PODMAN passed):
  DOD PASS 35/35 with 9 manual items (6, 8, 9, 10, 12, 14, HP9, Podman mounts and masks, Podman /work); the phase stays
  pending until the owner confirms them.
- Revision and completion (2026-10-24): the owner rejected manual item 5; steps 5.17-5.20 fixed the stale pass-through wording, the
  processes Status paragraph, the Limits "future" store, the SP20 step 3 evidence location, and the user-manual README and commands
  scope sentences. The gate re-run on the final tree (Docker 29.8.2, Podman 6.1.3 server, PREREQ checks passing) printed DOD PASS
  35/35 9 manual. The owner confirmed all nine manual items (items 1-4 and 6-9 earlier, item 5 after the re-read). Phase 5 complete.
- Revision (2026-10-24, base 752cfd8): owner rejected manual item "whitepaper, README, CLAUDE.md, and user manual describe exactly
  the delivered scope" (stale pre-milestone status text outside the 5.x sections). Steps 5.1-5.16 stay done. Added 4 corrective
  steps, all wave-parallel (no deps, scopes pairwise disjoint), route mechanical, each with verbatim replacement text dry-run
  at base (prints the FAILED list) and positively (edit applied, prettier ok, `... checks ok`): 5.17 CLAUDE.md Project state
  pass-through clause (tier lite); 5.18 docs/processes.md Status paragraph preflight and screen clauses plus SP20 step 3
  evidence location (`screen.evidence-inside-checkout`); 5.19 docs/user-manual/configuration.md opening screen sentence and
  Limits "future" store; 5.20 docs/user-manual/README.md status sentence and not-implemented list plus
  docs/user-manual/commands.md preflight sentence and "Outcomes at contract level:". Sweep findings with no step:
  docs/architecture.md (line 3 already lists the container and claim runners; §11 lines 612-613 already qualify the
  evidence location with the warning), docs/whitepaper.md §9-§14, README.md, overview.md, usage.md, installation.md,
  troubleshooting.md: no stale pass-through, contract-level-only, never-the-checkout, or future-store claims; every remaining
  "observe mode at contract level" names the GitHub-hosted skeleton and stays. Pipeline fact checked in code:
  packages/core/src/pipeline/screen.ts overrides intake and execute; assess stays the LOCAL_PHASES pass-through. Phase gate
  after these: re-run the Phase 5 dod block (no record greps the changed phrases; SP09, `pnpm test:container`, ADR index,
  planning-id, and Prettier records unaffected) and re-ask the owner for the rejected manual item.

## Revisions

<!-- supervisor appends: phase | failed step | revision note | outcome -->

| Phase | Trigger step | Revision note | Outcome |
| ----- | ------------ | ------------- | ------- |
| before 1 | owner gate | Owner answered Q1-Q16 (2026-09-28), all option A, no value changes. Brief: gate line set APPROVED; gate headings G1-G10 and the I-list marked APPROVED; question list replaced by the Owner gate decisions table; rule text made definitive (PF4 JSON mode, UR4 cmd.exe shim rule, PF3 contributor filters, G2 constants stay hard-only); HP9 added (Q5 limitation: /work growth bounded only by time, documented in phase 5); CI7 PREREQ-PODMAN added (Q14); D6, Assumptions, and project DoD 4 updated for local Podman verification. Roadmap: PREREQ-PODMAN and GATE-CONTAINER-PODMAN defined; prerequisites added to phases 3, 4, 5; phase 4 DoD gains the Podman tier; phase 1 no longer depends on the gate. | brief amended |
| 1 | phase 1 decomposition (decomposer amendment note, items 1 and 4 of 4) | Item 1: every I23 runner_identity value contains spaces but the run record types it with recordIdentifierSchema (no space), so executed runs failed their schema. I23 amended in place: parts defined (server version 1-64 printable ASCII without space, validated at RT1), 256-character length rule (reference cut with "..."), dedicated nullable run-record schema ^[\x21-\x7e]+(?: [\x21-\x7e]+)*$ as a permitted widening (schema_version 1, existing null records valid); RT4 and the G6 lead sentence point to it. Item 4: K55 said "with a flag" but ER7 cases had none; ER7 cases gain identity_truncated (boolean), K55 row names it. Both applied without owner approval: they make approved I23 and K55 text satisfiable and consistent, change no approved decision, and weaken no gate. Items 2 (output.head and output.tail above 65536) and 3 (nullable result_files content_hash) change approved G6 text and relax existing evidence-record validation: held for the owner (needs-human), together with a planner ripple finding on limits.evidence.run_bytes versus stored execution evidence. | brief amended (items 1, 4); items 2, 3 pending owner |
| 1 | phase 1 decomposition (owner answers to held items 2 and 3 plus the run_bytes ripple) | Q17 B: output.head and output.tail stay within 65536 characters; new ER8 defines the redacted output file executions/execution-NNNN/output.txt (parts from HP5, pre-redaction cut only when U+FFFD expansion makes a decoded part exceed REDACTION_INPUT_MAX_BYTES 8388608, one redaction input per part, post-redaction bound H + T, markers, file at most H + T + 128 bytes, excerpt cut from redacted parts, optional record key output.stored_path, verification, never dropped over budget); consequences and mitigations CB1-CB6 added. Q18 A: ER7 content_hash nullable with status-driven nullness and bytes rules. Q19 A: new ER10 (drop stored result files, highest NNNN then highest k first, stored_omitted true, junit kept; then existing log shrink and evidence.too-large; file-count overflow gives evidence.too-many-files, no drop). ER9 defines stored result-file content (U+FFFD-decoded, BOM removed, one redaction input, result-<k>.xml numbering). G6 lead sentence, EP4 transport contents, SI2, PF5, invariant-7, module layout, fixtures, Constraints, owner decisions table (Q17-Q19 rows, Q20 pending), DoD 8 and 10, ADR-0087 scope updated. Roadmap: phase 1 objective, DoD, risks (redaction timeout); phase 4 DoD (ER10 drops, too-many-files); phase 5 objective and DoD (ADR-0087, architecture 9, 11, 12). Ripple finding: a parsed or malformed result file whose decoded text exceeds 8388608 bytes cannot be redacted whole; strict interim rule (run evidence fails, redaction.input-too-large) applied, relaxation asked as Q20. | brief amended; Q20 pending owner |
| 1 | phase 1 decomposition (owner answer to Q20, asked after 9ee5048) | Q20 A: a parsed or malformed result file whose decoded text (after U+FFFD replacement and BOM removal) exceeds REDACTION_INPUT_MAX_BYTES 8388608 is not stored and the run is kept (replaces the interim fail-closed rule in ER9); the entry keeps status, raw content_hash, bytes, error_code, and junit, and gets stored_path null, stored_omitted true, and the new optional key stored_omitted_reason (evidence-budget or redaction-input); schema_version stays 1. ER9 rewritten (test D > 8388608, made in execute and re-checked in publish, text never passed to redaction, omitted file not an ER10 candidate, boundary unit tests). ER10: step 1 excludes omitted files from candidates, step 2 drops set stored_omitted_reason evidence-budget, step 4 schema rule (reason present exactly when stored_omitted is true for entries with stored_omitted; absent when stored_omitted is absent), step 6 accepts omitted entries. EP4 transport carries decoded_bytes and text or null per parsed/malformed result file (schema-tied). G6 heading and opening, ER7, SI2, invariant-7, fixtures (generated 2796203-byte 0xFF result file), owner decisions table (Q20 row; PENDING paragraph removed), DoD 8 and 10, ADR-0087 scope, evidence row updated. Roadmap: gate paragraph; phase 1 objective and DoD (ER9 boundary, ER10 step 4 pairing, synthetic run with both reasons); phase 4 DoD (evidence-budget reason, redaction-input run kept and verifies); phase 5 objective and DoD (ADR-0087, architecture 11 or 12). | brief amended |
| 2 | pipeline v4 migration before resuming phase 2 (2.17 and 2.19 pending; amendment note from the lead) | Every Definition of Done was prose, so dod-run.sh found no dod block (exit 2) or ran the next phase's block. Owner-approved (2026-10-23) faithful format conversion, no requirement dropped, relaxed, or added: the brief's project DoD items 1-15 became one dod block (39 records, 6 manual; record names keep the item number); roadmap phases 1-5 each got their own dod block (11, 8, 14, 18, 42 records; 0, 0, 2, 10, 7 manual; phase 5 inlines the 39 project records plus HP9, format coverage, and the planning-id scan). GATE-BASE, GATE-CONTAINER, GATE-TEMP, PREREQ-PODMAN, GATE-CONTAINER-PODMAN inlined per record: temp counts before and after inside one cmd; docker server and PREREQ-PODMAN as their own records before the items that need them; leak checks as one record per runtime. Preamble macro definitions kept as documentation. Clauses about tests not yet written or needing judgment (HP8, canary, phase 4 evidence and preflight behaviors, live tier, documentation scope, Conformance-checks coverage, fixtures README) became manual records quoting the original text. Mechanizations: project DoD 13 compares per-file id counts against ee878e5 (git grep -P); the phase 5 planning-id clause uses the wider step-gate pattern (adds E1-E5 and rule prefixes, includes scenarios) under the same introduced-since-ee878e5 comparison, because pre-existing E2-E5 hits in older ADRs are not planning ids; act build-and-test runs with --matrix os:ubuntu-latest (the windows-latest leg cannot run under act). Phase 1 block passes at c91ee78 plus this amendment (11 of 11). Dry-run finding for phase 3 (not a DoD defect): the act build-and-test record at c91ee78 ran the Ubuntu job and it failed 4 tests in 2 files (packages/core/src/process/stream-process.test.ts 'kills the whole process tree'; packages/core/src/runner/unsandboxed.fixture.test.ts 'exit E5: refuses a working directory leaving the checkout', 'runs a command in the own checkout', 'runs a command in a preview worktree'); the act lint-and-format record passed. | brief amended |
| 3 | 3.1 | acceptance mis-specified: the Linux line printed "too few tests" unless more than 40 assertions ran, but the four named test files hold 36 tests (worker ran them: Linux exit 0, 0 failed; Windows pass). Corrected in flight: threshold n>40 changed to n>35 in acceptance_cmd. The worker commit was verified against the corrected step file (no worker relaunch; the work and the scope were unaffected). | corrected in flight |
| 3 | 3.5 | worker result: container tier failed at decoded_bytes (expected 8388609, got 2796203). Root cause: the worker wrote the manifest script with a JSON u-escape NUL and a raw U+00FF character in tr, so tr translated nothing and ff.xml held NUL bytes; the step text and product are right. Corrected in flight: a JSON escaping paragraph added to the step context (doubled backslashes for the octal escapes, od check); retry 1. | corrected in flight, retry 1 |
| 3 | 3.13 | STOP condition: Podman mount probe shows mounts beyond the allowed set (/etc/passwd, /etc/group, /run/.containerenv, /run/secrets); the step forbids widening the set, which is a hardening-gate decision. Escalated, step recorded failed. | needs-human |
| 3 | 3.13 (owner decision Q21 A, 2026-10-23, "Podman-only mount exception") | Brief: G3 HP8 gains a Podman variant (Podman only): capability proof is the five masks CapInh, CapPrm, CapEff, CapBnd, CapAmb all zero in /proc/self/status, inspected HostConfig.CapDrop accepted as ['ALL'] or any other list; mountinfo may add exactly /etc/passwd, /etc/group, /run/.containerenv, /run/secrets (exact mount points, nothing below), and /run/secrets must be empty (planner strengthening: an entry would be host data from mounts.conf); HP2 --cap-drop ALL, NoNewPrivs, uid, inspected Mounts (one /work volume), and every Docker check unchanged. I28 extended (Podman-generated files are not host mounts; phase 5 documents them in architecture §12 or §13, the user manual Runner section, ADR-0085). G3 heading, opening owner-answer paragraph, Owner gate decisions heading and new Q21 row with consequences CQ1-CQ4, G10 ADR-0085 scope, Assumptions (the one approved HP exception), Conformance checks updated. Roadmap: gate paragraph, phase 3 HP8 manual record and risks, phase 5 DoD gains a manual documentation record. HP2's Podman volume no-copy text is NOT amended (see the planner's return). Step files untouched; 3.13 stays failed for the decomposer's revision. | brief amended |
| 3 | 3.13 (decomposer revision after ccbcabf) | Step 3.13 rewritten for the HP8 Podman variant: CapDrop accepted as any array under Podman only, five zero capability masks asserted under Podman, the four Podman mount points allowed under Podman only, /run/secrets must list empty with exit 0; preserved work on preserve/patch-steward-m7-3.13-podman (048d930) reused after verification; volume no-copy: the worker first searches for an accepted Podman no-copy mount option, and a new both-runtime test proves no image content at /work reaches the volume (else STOP, HP2 question); the four Podman result-file missing tests must be root-caused and fixed in Podman-specific code; safety rules forbid bulk removal. Acceptance extended (no non-passed tests in either tier, new title passed, Docker vector and allow-list unchanged). | revised, pending |
| 3 | 3.13 (second attempt, needs-human) | STOP 1: Podman /run/secrets non-empty (lists rhsm, Red Hat subscription data from the machine VM). STOP 2: no accepted Podman no-copy volume mount option; Podman copies image content at /work into the volume (HP2). Owner decisions needed; partial work on preserve/patch-steward-m7-3.13-podman-2. | escalated, step recorded failed |
| 3 | 3.13 (owner decisions Q22 A "Require empty /work in images" and Q23, 2026-10-23) | Brief: HP2 Podman text replaced (the false "no-copy variant is verified by the CI Podman leg"): the Podman /work mount is exactly --mount type=volume,src=<volume>,dst=/work with no no-copy option (measured rejected spellings and the volume-opt non-controls recorded); the forbidden-argument check accepts exactly the Docker form with ,volume-nocopy and the bare Podman form. New G5 IM5 (Podman only): once per resolved image per run, before any volume create or execution create, a never-started probe container (exact argv; no mount) and podman cp <probe>:/work - through TarStreamParser; /work absent (not-found) or one empty directory entry passes; anything else fails closed runner.create-failed with detail path /work, message image-work-not-empty; probe create error runner.create-failed, cp error or invalid tar runner.copy-failed, rm -f in finally; not an execution; unit cases listed; Docker runs no probe and keeps volume-nocopy. HP1 notes the Podman ordering; HP8 gains the /work copy-up proof with three runtime-registered titles: Docker 'image content at /work is not copied into the volume' (kept), Podman 'an image with content at /work is refused under podman' and 'an image with an empty /work yields only the checkout under podman'; tests remove the images they build (CI6). HP8 Podman variant gains the Q23 host-condition note (rhsm from the Podman machine mounts.conf; owner fixes outside the repo; emptiness check unchanged). Opening owner-answer paragraph, G3 and G5 headings, Assumptions (exactly two owner-approved Podman exceptions), I28 documentation sentence, module layout, Conformance checks, G10 ADR-0085 scope, Owner gate decisions heading and new Q22 row (consequences CW1-CW4) and Q23 row. Roadmap: gate paragraph; phase 3 DoD gains two records (docker title passed once in .m7-dod-docker.json; both podman titles passed in .m7-dod-podman.json; dry-run against synthetic JSON: pass and fail outputs as expected), HP8 manual record extended, risks (no-copy and copy-up resolved only by HP2/IM5; /run/secrets host condition; probe entrypoint assumption is needs-human if wrong); phase 5 DoD gains a manual documentation record (architecture §12 or §13, user manual Runner, ADR-0085). Classified as owner-approved (prompt carries the approval); fail-closed, no gate weakened beyond the stated decision. Step files untouched; pending 3.13 embeds the stale HP2 text and the both-runtime test title and needs the decomposer's revision. | brief amended |
| 3 | 3.13 (decomposer revision after 98bd205) | Split: 3.13 rewritten runtime-independent (Podman bare /work mount, two-form mount check, probe cp vector accepted, runtimeWorkProbeCreateArgs, IM5 probe in prepareRunnerImage under Podman with optional RunnerImageContext.runId failing closed when absent, 15 'podman /work probe: ' unit titles, HP3 scan covers the probe; preserved RepoDigest fix reused); new 3.15 (PODMAN-DEPENDENT, after 3.13): harness passes runId, HP8 Podman variant, three runtime-registered /work copy-up titles that remove their images, result-file 'missing' root cause; acceptance checks per-runtime titles and leak checks on both runtimes. | revised, pending |
| 3 | 3.15 | pre-launch check: with the owner-emptied mounts.conf, /run/secrets is absent in Podman containers (ls exits 1, stderr No such file or directory, empty stdout); the step said ls -A must exit 0 and print nothing, which honest output cannot satisfy. Brief HP8 wording is only that ls -A prints nothing. Corrected in flight (step context): empty stdout required; exit 0 (present, empty) or non-zero with stderr No such file or directory (absent) accepted; any stdout line still fails and a mount of /run/secrets must still be empty. No gate weakened. | corrected in flight |
| 4 | phase 4 decomposition (decomposer amendment note, carry-over lead (d) of the Phase 3 notes; lead instruction: option A) | The Conformance-checks spawn sets could not be met by honest code: steward screen already spawns gh auth token --hostname github.com through cli/src/github-auth.ts resolveGitHubAuth when GH_TOKEN and GITHUB_TOKEN are unset (the delivered screen spy test asserts exactly one such call), and preflight --run must spawn the PF3 git worktree add/remove/prune, cmd.exe /d /s /c for UR4 shims, and on Windows taskkill.exe /PID <pid> /T /F for a timed-out or output-limited tree (core/src/process/stream-process.ts killChild, killTree set by core/src/runner/unsandboxed.ts); "--run absent spawns no command" contradicted the brief's own "spawns only read-only git and gh auth token". Classified as a corrected fact, not gate-weakening: every added spawn is delivered and tested or mandated by PF3/UR4, the rule stays an exact allowlist (any other spawn fails), and gh auth token is pinned to its argv, credential resolution only, at most once, env unset. Brief: Conformance checks bullet 2 rewritten with the exact spawn sets; Delivered-code zero-execution bullet records the gh auth token call; PF1 "runs nothing" made "no repository or policy command runs"; G10 documentation stance tells phase 5 to state this process set in architecture §6.5, ADR-0088, ADR-0089, and the user manual; project DoD item 9 reworded. Roadmap: phase 4 manual record and phase 5 item 9 reworded to "--run absent runs no repository or policy command (spy test: only read-only git and gh auth token are spawned)". No step file touched; no completed step affected. | brief amended |
| 4 | 4.5 | acceptance unsatisfiable by honest work: the mandated export checkoutTopLevel (named by step 4.10) starts with check, so the invariant-5 pinned list of load, validate, resolve, parse, capture, and check functions grows from 26 to 27 names, and invariant-5.test.ts was outside files_in_scope (step text wrongly said no name starts with those prefixes). Worker output otherwise correct (9 mandated tests, exports, index 141 lines). Corrected in flight: invariant-5.test.ts added to files_in_scope with the exact pin edit (name appended last, one null-returning assertion); retry 1 from a fresh worktree. | corrected in flight, retry 1 |
| 4 | 4.20 | worker result: both mandated tests passed every assertion on Docker until runReportCommand, which exits 3 for a verified inconclusive run (REPORT_EXIT_BY_OUTCOME inconclusive 3; failure exits are only 1 and 2) while the step said 0. Root cause: step spec defect (the report exit mirrors the stored outcome); the product is right and the screen run is inconclusive by the step own assertion. Corrected in flight: both assertions changed to exit 3 (first also checks stdout contains head-test); worker commit discarded, retry 1 from a fresh worktree. | corrected in flight, retry 1 |
| 4 | 4.21 | worker result: all storage assertions passed on both runtimes; both tests failed only at runReportCommand exiting 3 where the step said 0. Same root cause as step 4.20 (copied spec text): the report exit mirrors the stored outcome, inconclusive is 3, failure exits are 1 and 2. Corrected in flight: both assertions changed to exit 3; worker commit discarded, retry 1. | corrected in flight, retry 1 |
| 4 | 4.12 (phase gate) | phase 4 GATE-BASE failed: invariant-6 report wording test pins the number of golden report text files in fixtures/reports at 16, and step 4.12 added 4 (now 20); invariant-6.test.ts was outside 4.12 scope and its acceptance did not run it. Coupling missed by the decomposition. Fixed in a supervisor integration commit (16 to 20, one line); invariant-6 passes. Gate re-run follows. | fixed in integration commit |
| 5 | phase 5 gate manual item 5 | owner rejected the delivered-scope item (2026-10-24): CLAUDE.md pass-through sentence, docs/processes.md Status paragraph, docs/user-manual/configuration.md Limits "future" store, SP20 step 3 "never the checkout" absolute (explicit --evidence-dir inside the work tree warns screen.evidence-inside-checkout), and user-manual README and commands.md scope sentences. Decomposer sweep found nothing stale in architecture, whitepaper, README, overview, usage, installation, troubleshooting. | new steps 5.17-5.20 added (0016a1b), pending |
