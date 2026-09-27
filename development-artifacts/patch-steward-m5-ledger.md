# patch-steward-m5 — Ledger

Single source of truth for execution state. Sections are owned by different agents —
the planner seeds Plan + Phases; the decomposer fills Steps per phase; the supervisor
updates Steps and appends Revisions.

## Plan

- plan-name: patch-steward-m5
- current-phase: complete (phases 1-5 done)
- working-branch: milestone/5-decision-report-evidence-records-local-skeleton
- starting-commit: 6d2ea64942ab57fd74a68cdeed8ab7eedfad014d
- default-branch: develop
- artifacts-dir: development-artifacts
- owner-gate: APPROVED 2026-09-27 (brief "Owner gate (APPROVED 2026-09-27)": G1 K27-K32 as written; G2 as written with please kept on the denylist; G3 all 15 detectors, EX-rules three forms, CV-rules incl. policy.credential-value side effect; G4 layout, manifest, metrics partition, PJ, WR, VR as written; G5 CV-list, screen, J-SCREEN, J-REPORT, default directories, R-A, ADR-0060 superseded by ADR-0066; G6 G6a-G6e with schema_version 1, plus G6f snapshot policy_revision widening approved by amendment 2026-09-27; G7 Option A stage-incomplete; I1-I29, K33-K37, ADR-0062 to ADR-0070 accepted). Phases may be decomposed in order.

## Phases

| Phase | Status  | Notes |
| ----: | ------- | ----- |
| 1     | complete | Completed 2026-09-27 (phase DoD verified by the supervisor in the main tree at 762ddae: toolchain gate, protected-path diffs, D3-D11 all pass; 109 test files, 2068 tests). Core rules and contracts (pure): bounds, vocabulary, record schemas, version, clock, pretty JSON, detectors, decision table, mappings, report templates and escaping, handoff schema. Owner gate approved 2026-09-27; ready for decomposition. |
| 2     | complete | Completed 2026-09-27 (phase DoD verified by the supervisor in the main tree after 2f0281a: D1 toolchain gate exit 0, D2 protected paths unchanged, D3-D5 title checks TITLES OK incl. redaction-timeout and file-write-failure no-final-directory tests and all 16 golden comparisons, D6 fixtures logs or manifest count 0, D7 packages/cli unchanged; 123 test files, 2192 tests). Report renderer and evidence module (assembly, redaction at persistence, manifest, local store, verification, golden reports). Needs Phase 1. |
| 3     | complete | Completed 2026-09-27 (phase DoD verified by the supervisor in the main tree at 6325e55: D1 toolchain gate exit 0 with 131 test files and 2581 tests, D2 protected paths unchanged, D3 conformance titles TITLES OK, D4 INV4 OK 215, D5 pipeline and screen scenario titles TITLES OK, D6 snapshot titles TITLES OK, D7 packages/cli unchanged, D8 no raw characters in files changed since 67455ee, D9 fixtures logs or manifest count 0, D10 tmp=clean; step 3.4 retried once). Phase runner, local screening, never-pass harness (invariant 4), invariant 6, 7, 8 extensions, screen scenarios. Needs Phase 2. |
| 4     | complete | Completed 2026-09-27 (phase DoD verified by the supervisor in the main tree at 7c7b3c3: D1 toolchain gate exit 0 with 141 test files and 2673 tests, D2 protected paths unchanged, D3 cli titles TITLES OK, D4 test:live exit 0 and live titles TITLES OK, D5 built-CLI live commands exit1=1 exit2=1 exit3=2 manifests=2 2 exit4=1 all counts 1 tokenhits=0, D6 preflight tests changed one line each, D7 -h exit=2, D8 packages/core unchanged since f30b4b6, D9 no raw characters, D10 tmp=clean; 4.5 and 4.7 corrected before merge). CLI conventions (exit 3 everywhere, preflight change), steward screen, steward report, live tests. Needs Phase 3. |
| 5     | complete | Completed 2026-09-27 (phase DoD verified by the supervisor in the main tree at dbd6ed5: brief project DoD D1-D18 plus D19 links, D20 raw characters, D21 phase scope, D22 milestone baseline all as expected; D1 toolchain gate exit 0 with 141 test files and 2673 tests; D11 live read-only screen and report runs exit1=1 exit2=1 exit3=2 manifests=2 2 exit4=1 tokenhits=0; 9 new ADRs, 70 index rows, ADR-0060 superseded by ADR-0066 only; status paragraphs of architecture, processes, README, CLAUDE.md, manual README and overview reviewed: none describes a stage, container, model call, publication, or branch store as working; deferred.md unchanged; one supervisor fix to CLAUDE.md, 2c2bcdd). ADR-0062 onward, governing documents, README, CLAUDE.md, user manual, full project DoD. Needs Phase 4. |

## Pipeline rules (from earlier milestones; binding for every agent in this plan)

- Every `decomposer`, `worker`, and `planner` invocation runs in the FOREGROUND (`run_in_background: false`). A parallel wave is
  several foreground Agent calls in ONE message. A supervisor that backgrounds workers is force-handed back and loses results.
- Never put a pipe character inside a ledger table cell (it breaks the columns); write "or" instead. Never write raw control
  characters (NUL, ESC, and so on) into any artifact; write escapes such as backslash-u-0000.
- Phase gates and the project DoD run in the MAIN tree (repo root); long git-worktree paths break `pnpm test`. Worker worktrees
  use short paths such as `C:/Users/John/Projects/steady-orchard/m5-w<id>`; delete leftover `node_modules` after
  `git worktree remove` on Windows.
- Before a wide wave, run `pnpm install --frozen-lockfile` in each new worktree sequentially (pnpm store contention on Windows).
- `core.autocrlf=true`: compare committed bytes with `git show HEAD:<path>`; never assert hashes of working-tree fixture bytes.
- Every Prettier-checked file a step writes (fixtures `.json`/`.md`, docs, README, CLAUDE.md) is Prettier-clean at commit; byte-exact
  fixtures use `.txt`. Never run a formatter on anything under `development-artifacts/`.
- `.gitignore` swallows `logs`, `*.log`, `*.tgz`, `.env*`, `out`, `dist`: never name a committed file or directory that way; no run
  directory is ever committed (brief I19).
- Credential samples are built by string concatenation in test code, never committed as literal tokens.
- Acceptance checks that grep for substrings the mandated text itself contains, or count diff hunks, are mis-specified; literal
  grep on prose must tolerate or pin Prettier line wraps; it.each titles are checked as rendered titles (Vitest JSON reporter).
- A step that removes or renames a heading must not require link integrity of files owned by a later step.
- The Vitest alias maps `@patch-steward/core` to `packages/core/src/index.ts` exactly: cli code and tests import only the root.
- GitHub access is read-only everywhere; unit and fixture tests use recorded or synthetic responses; live reads only in
  `*.live.test.ts` under `pnpm test:live` or in DoD live commands.
- Persistent files (`docs/` except the two plan documents, README.md, CLAUDE.md, `fixtures/`, `templates/`) never cite planning
  artifacts or their ids.

## Steps

<!-- decomposer fills per phase: id | phase | status | files | commit,
     plus a "Phase <N> notes" block: dependency graph, couplings, emergent contracts -->

| id | phase | status | files | commit |
| --- | --- | --- | --- | --- |
| 1.1 | 1 | done | packages/core/src/policy/bounds.ts, packages/core/src/policy/bounds.test.ts, development-artifacts/patch-steward-m5-1.1-report.md | 537e370 |
| 1.2 | 1 | done | packages/core/src/vocabulary.ts, packages/core/src/vocabulary.test.ts, development-artifacts/patch-steward-m5-1.2-report.md | 9155e47 |
| 1.3 | 1 | done | packages/core/src/records/common.ts, packages/core/src/records/run.ts, packages/core/src/records/finding.ts, packages/core/src/records/finding.test.ts, packages/core/src/records/decision.ts, packages/core/src/records/decision.test.ts, packages/core/src/records/report.ts, packages/core/src/records/execution-record.ts, packages/core/src/records/maintainer-action.ts, packages/core/src/records/metrics-event.ts, packages/core/src/records/run-id.test.ts, development-artifacts/patch-steward-m5-1.3-report.md | 87a2a72 |
| 1.4 | 1 | done | packages/core/src/records/submission.ts, packages/core/src/records/submission.test.ts, packages/core/src/submission/intake.test.ts, development-artifacts/patch-steward-m5-1.4-report.md | 3932bc5 |
| 1.5 | 1 | done | packages/core/src/version.ts, packages/core/src/version.test.ts, packages/core/src/clock.ts, packages/core/src/clock.test.ts, development-artifacts/patch-steward-m5-1.5-report.md | 2dfa61e |
| 1.6 | 1 | done | packages/core/src/evidence/pretty-json.ts, packages/core/src/evidence/pretty-json.test.ts, development-artifacts/patch-steward-m5-1.6-report.md | 0fd80a3 |
| 1.7 | 1 | done | packages/core/src/redaction/detectors.ts, packages/core/src/redaction/detectors.test.ts, packages/core/src/conformance/invariant-7.test.ts, development-artifacts/patch-steward-m5-1.7-report.md | 97bd869 |
| 1.8 | 1 | done | packages/core/src/report/denylist.ts, packages/core/src/report/denylist.test.ts, development-artifacts/patch-steward-m5-1.8-report.md | 6bbb7a2 |
| 1.9 | 1 | done | packages/core/src/decision/mapping.ts, packages/core/src/decision/mapping.test.ts, development-artifacts/patch-steward-m5-1.9-report.md | 2737ce7 |
| 1.10 | 1 | done | packages/core/src/redaction/redact.ts, packages/core/src/redaction/redact.test.ts, development-artifacts/patch-steward-m5-1.10-report.md | 0348dc0 |
| 1.11 | 1 | done | packages/core/src/decision/stages.ts, packages/core/src/decision/stages.test.ts, development-artifacts/patch-steward-m5-1.11-report.md | 2dfdbaa |
| 1.12 | 1 | done | packages/core/src/report/escape.ts, packages/core/src/report/escape.test.ts, development-artifacts/patch-steward-m5-1.12-report.md | 8a6d594 |
| 1.13 | 1 | done | packages/core/src/report/caps.ts, packages/core/src/report/caps.test.ts, development-artifacts/patch-steward-m5-1.13-report.md | fca2b6e |
| 1.14 | 1 | done | packages/core/src/decision/table.ts, packages/core/src/decision/table.test.ts, development-artifacts/patch-steward-m5-1.14-report.md | bcceb05 |
| 1.15 | 1 | done | packages/core/src/report/finding-templates.ts, packages/core/src/report/finding-templates.test.ts, development-artifacts/patch-steward-m5-1.15-report.md | 2331c60 |
| 1.16 | 1 | done | packages/core/src/report/templates.ts, packages/core/src/report/templates.test.ts, development-artifacts/patch-steward-m5-1.16-report.md | a2a0f16 |
| 1.17 | 1 | done | packages/core/src/pipeline/budget.ts, packages/core/src/pipeline/budget.test.ts, packages/core/src/pipeline/handoff.ts, packages/core/src/pipeline/handoff.test.ts, development-artifacts/patch-steward-m5-1.17-report.md | 33211be |
| 1.18 | 1 | done | packages/core/src/report/wording.test.ts, development-artifacts/patch-steward-m5-1.18-report.md | b2523a7 |
| 1.19 | 1 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, packages/core/src/conformance/invariant-5.test.ts, development-artifacts/patch-steward-m5-1.19-report.md | e9acdcb |
| 1.20 | 1 | done | development-artifacts/patch-steward-m5-1.20-report.md | 762ddae |
| 2.1 | 2 | done | packages/core/src/report/render.ts, packages/core/src/report/render.test.ts, development-artifacts/patch-steward-m5-2.1-report.md | 4e331d96d66ef15a687fafbdca75bf147332ca27 |
| 2.2 | 2 | done | packages/core/src/report/summary.ts, packages/core/src/report/summary.test.ts, development-artifacts/patch-steward-m5-2.2-report.md | 80debc68fdf3733535020723ccc995922f12f6e6 |
| 2.3 | 2 | done | packages/core/src/evidence/layout.ts, packages/core/src/evidence/layout.test.ts, packages/core/src/evidence/metrics.ts, packages/core/src/evidence/metrics.test.ts, development-artifacts/patch-steward-m5-2.3-report.md | a42063fa7d3e6b2f6860a8945e81223349f6a089 |
| 2.4 | 2 | done | packages/core/src/evidence/logs.ts, packages/core/src/evidence/logs.test.ts, development-artifacts/patch-steward-m5-2.4-report.md | af888790e8dabb875caab93ce57cd84598bfebbc |
| 2.5 | 2 | done | packages/core/src/evidence/redact-records.ts, packages/core/src/evidence/redact-records.test.ts, development-artifacts/patch-steward-m5-2.5-report.md | 8addeeeca1b3d256deaa9d2bffd8e396d865380d |
| 2.6 | 2 | done | packages/core/src/evidence/manifest.ts, packages/core/src/evidence/manifest.test.ts, development-artifacts/patch-steward-m5-2.6-report.md | 140c112d4ebe2885b4b63564a75975a54ea72ff0 |
| 2.7 | 2 | done | packages/core/src/evidence/local-store.ts, packages/core/src/evidence/local-store.test.ts, development-artifacts/patch-steward-m5-2.7-report.md | 789ea26282bad43b365cad8920f537af8ad7acd1 |
| 2.8 | 2 | done | packages/core/src/evidence/assemble.ts, packages/core/src/evidence/assemble.test.ts, development-artifacts/patch-steward-m5-2.8-report.md | ac267c8b226fdb6087b2fcabf719211b6ba4edd3 |
| 2.9 | 2 | done | packages/core/src/evidence/report-input.ts, packages/core/src/evidence/report-input.test.ts, development-artifacts/patch-steward-m5-2.9-report.md | 756c38b87e84774fcceac0e1e05e1b732abe86ec |
| 2.10 | 2 | done | packages/core/src/evidence/publish.ts, packages/core/src/evidence/publish.test.ts, development-artifacts/patch-steward-m5-2.10-report.md | 31813c40e5cafd0cdd6b42938bc30aa2b83ffc02 |
| 2.11 | 2 | done | packages/core/src/evidence/publish-failures.test.ts, development-artifacts/patch-steward-m5-2.11-report.md | a942ffd7fb4f393d450fdc2afc964b9e012ba3e7 |
| 2.12 | 2 | done | packages/core/src/evidence/verify.ts, packages/core/src/evidence/verify.test.ts, development-artifacts/patch-steward-m5-2.12-report.md | 693a48dc0538d2b375ce76a65c8be448031816e2 |
| 2.13 | 2 | done | packages/core/src/evidence/golden-reports.fixture.test.ts, fixtures/reports/cases.json, fixtures/reports/issue-unstructured.report.txt, fixtures/reports/issue-unstructured.summary.txt, fixtures/reports/issue-defect-complete.report.txt, fixtures/reports/issue-defect-complete.summary.txt, fixtures/reports/pr-field-missing-attachment.report.txt, fixtures/reports/pr-field-missing-attachment.summary.txt, fixtures/reports/pr-execution-sensitive.report.txt, fixtures/reports/pr-execution-sensitive.summary.txt, fixtures/reports/pr-shared-head.report.txt, fixtures/reports/pr-shared-head.summary.txt, fixtures/reports/pr-local-policy.report.txt, fixtures/reports/pr-local-policy.summary.txt, fixtures/reports/pr-overflow.report.txt, fixtures/reports/pr-overflow.summary.txt, fixtures/reports/pr-hostile.report.txt, fixtures/reports/pr-hostile.summary.txt, fixtures/README.md, development-artifacts/patch-steward-m5-2.13-report.md | 59c9e1b8b6a49b893227a15fa1402ebf8e7176f5 |
| 2.14 | 2 | done | development-artifacts/patch-steward-m5-2.14-report.md | 910357eb0e1a179a1c237a5364979b12cb129785 |
| 3.1 | 3 | done | packages/core/src/submission/snapshot.ts, packages/core/src/submission/snapshot.test.ts, packages/core/src/conformance/never-pass.test.ts, development-artifacts/patch-steward-m5-3.1-report.md | 07c03f51b70db027dffccbefe9b2a177e8368481 |
| 3.2 | 3 | done | packages/core/src/pipeline/phases.ts, packages/core/src/pipeline/phases.test.ts, development-artifacts/patch-steward-m5-3.2-report.md | d836b092342b935f9cbd8e44b8ab1ab19e5f8000 |
| 3.3 | 3 | done | packages/core/src/pipeline/publish-phase.ts, packages/core/src/pipeline/publish-phase.test.ts, development-artifacts/patch-steward-m5-3.3-report.md | dea63482a63939d86b5f8185adcbcd0c607c2c9f |
| 3.4 | 3 | done | packages/core/src/pipeline/sequence.ts, packages/core/src/pipeline/sequence.test.ts, development-artifacts/patch-steward-m5-3.4-report.md | 78bd460994760d2bffaeb686ecc0e999cda26427 |
| 3.5 | 3 | done | packages/core/src/pipeline/gate.ts, packages/core/src/pipeline/gate.test.ts, development-artifacts/patch-steward-m5-3.5-report.md | eaae73bd89bab26234017ab20f250d4fcaa4e6a7 |
| 3.6 | 3 | done | packages/core/src/pipeline/screen.ts, packages/core/src/pipeline/screen.test.ts, development-artifacts/patch-steward-m5-3.6-report.md | d831cf2e28ee9fa630545c5d290cb4aa66a0818b |
| 3.7 | 3 | done | packages/core/src/conformance/invariant-4.test.ts, development-artifacts/patch-steward-m5-3.7-report.md | bedba8ec11f5a089edd4c34164ca9c0ff28a62a8 |
| 3.8 | 3 | done | fixtures/screen/expectations.json, packages/core/src/pipeline/screen-scenarios.fixture.test.ts, fixtures/README.md, development-artifacts/patch-steward-m5-3.8-report.md | 4dbe5fa5482f53ae1efaa079b354824caab4561b |
| 3.9 | 3 | done | packages/core/src/conformance/invariant-6.test.ts, development-artifacts/patch-steward-m5-3.9-report.md | b3434bf6a187e925ca72ec2fe207d5929c874b6c |
| 3.10 | 3 | done | packages/core/src/conformance/invariant-7.test.ts, development-artifacts/patch-steward-m5-3.10-report.md | 54a55da8316e40f6087a2036588954ff9b3d8f0a |
| 3.11 | 3 | done | packages/core/src/conformance/invariant-8.test.ts, development-artifacts/patch-steward-m5-3.11-report.md | 5b27d5148855473f29d23d9b4681846f5b93bbc8 |
| 3.12 | 3 | done | packages/core/src/conformance/never-pass-pipeline.test.ts, development-artifacts/patch-steward-m5-3.12-report.md | 9b6c2c59245a953087e1bebb71930311fae493eb |
| 3.13 | 3 | done | packages/core/src/conformance/zero-execution.fixture.test.ts, development-artifacts/patch-steward-m5-3.13-report.md | cf129f3525f8e53d284d4b52f007722668485329 |
| 3.14 | 3 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, development-artifacts/patch-steward-m5-3.14-report.md | c320aafabee39df7eac80c951f23219171a315ad |
| 3.15 | 3 | done | packages/core/src/conformance/invariant-4.test.ts, development-artifacts/patch-steward-m5-3.15-report.md | 7647fa7ef19e6d97684076c578a0faed8efc96ec |
| 3.16 | 3 | done | development-artifacts/patch-steward-m5-3.16-report.md | 6325e556775ef1915f8d2f1e6eaf25a56ccb7e03 |
| 4.1 | 4 | done | packages/cli/src/conventions.ts, packages/cli/src/conventions.test.ts, development-artifacts/patch-steward-m5-4.1-report.md | ac36ec2 |
| 4.2 | 4 | done | packages/cli/src/upstream.ts, packages/cli/src/upstream.test.ts, packages/cli/src/preflight-command.ts, packages/cli/src/preflight-command.test.ts, packages/cli/src/preflight-command.fixture.test.ts, packages/cli/src/preflight-never-pass.fixture.test.ts, development-artifacts/patch-steward-m5-4.2-report.md | b360e84 |
| 4.3 | 4 | done | packages/cli/src/evidence-dir.ts, packages/cli/src/evidence-dir.test.ts, development-artifacts/patch-steward-m5-4.3-report.md | 01de77b |
| 4.4 | 4 | done | packages/cli/src/screen-args.ts, packages/cli/src/screen-args.test.ts, development-artifacts/patch-steward-m5-4.4-report.md | f06ad9c |
| 4.5 | 4 | done | packages/cli/src/screen-output.ts, packages/cli/src/screen-output.test.ts, development-artifacts/patch-steward-m5-4.5-report.md | c1759c4 |
| 4.6 | 4 | done | packages/cli/src/screen-command.ts, packages/cli/src/screen-command.test.ts, development-artifacts/patch-steward-m5-4.6-report.md | d3213c7 |
| 4.7 | 4 | done | packages/cli/src/report-output.ts, packages/cli/src/report-output.test.ts, packages/cli/src/report-command.ts, packages/cli/src/report-command.test.ts, development-artifacts/patch-steward-m5-4.7-report.md | 5a73404 |
| 4.8 | 4 | done | packages/cli/src/policy-command.ts, packages/cli/src/policy-command.test.ts, packages/cli/src/policy-command.fixture.test.ts, development-artifacts/patch-steward-m5-4.8-report.md | 3bb4de9 |
| 4.9 | 4 | done | packages/cli/src/cli.ts, packages/cli/src/index.ts, packages/cli/src/index.test.ts, development-artifacts/patch-steward-m5-4.9-report.md | e38f294 |
| 4.10 | 4 | done | packages/cli/src/steward-zero-execution.fixture.test.ts, development-artifacts/patch-steward-m5-4.10-report.md | 65685c6 |
| 4.11 | 4 | done | packages/cli/src/steward-never-pass.fixture.test.ts, development-artifacts/patch-steward-m5-4.11-report.md | 5ab88c5 |
| 4.12 | 4 | done | packages/cli/src/steward-commands.live.test.ts, development-artifacts/patch-steward-m5-4.12-report.md | 99f2ca2 |
| 4.13 | 4 | done | development-artifacts/patch-steward-m5-4.13-report.md | 7c7b3c3 |
| 5.1 | 5 | done | docs/adr/0062-report-caps.md, docs/adr/0063-report-wording-escaping-and-denylist.md, development-artifacts/patch-steward-m5-5.1-report.md | 908baf4 |
| 5.2 | 5 | done | docs/adr/0064-evidence-run-directory-and-local-store.md, docs/adr/0065-redaction-at-persistence.md, development-artifacts/patch-steward-m5-5.2-report.md | 12900e4 |
| 5.3 | 5 | done | docs/adr/0066-uniform-cli-conventions.md, docs/adr/0067-steward-screen-and-report-commands.md, docs/adr/0060-steward-preflight-command.md, docs/adr/README.md, development-artifacts/patch-steward-m5-5.3-report.md | 5fe99da |
| 5.4 | 5 | done | docs/adr/0068-local-run-identity.md, docs/adr/0069-required-stages-never-pass-incomplete.md, docs/adr/0070-phase-handoff-records.md, development-artifacts/patch-steward-m5-5.4-report.md | 3d79708 |
| 5.5 | 5 | done | docs/architecture.md, development-artifacts/patch-steward-m5-5.5-report.md | b271057 |
| 5.6 | 5 | done | docs/architecture.md, development-artifacts/patch-steward-m5-5.6-report.md | c74f2b5 |
| 5.7 | 5 | done | docs/processes.md, development-artifacts/patch-steward-m5-5.7-report.md | 834832f |
| 5.8 | 5 | done | docs/whitepaper.md, development-artifacts/patch-steward-m5-5.8-report.md | ba3f50f |
| 5.9 | 5 | done | README.md, CLAUDE.md, development-artifacts/patch-steward-m5-5.9-report.md | a713bcc |
| 5.10 | 5 | done | docs/user-manual/commands.md, development-artifacts/patch-steward-m5-5.10-report.md | 811dd07 |
| 5.11 | 5 | done | docs/user-manual/commands.md, development-artifacts/patch-steward-m5-5.11-report.md | 9b9febc |
| 5.12 | 5 | done | docs/user-manual/usage.md, development-artifacts/patch-steward-m5-5.12-report.md | 62fb194 |
| 5.13 | 5 | done | docs/user-manual/configuration.md, development-artifacts/patch-steward-m5-5.13-report.md | d65c205 |
| 5.14 | 5 | done | docs/user-manual/troubleshooting.md, development-artifacts/patch-steward-m5-5.14-report.md | 6d0d13f |
| 5.15 | 5 | done | docs/user-manual/overview.md, docs/user-manual/README.md, development-artifacts/patch-steward-m5-5.15-report.md | c78ccc0 |
| 5.16 | 5 | done | development-artifacts/patch-steward-m5-5.16-report.md | dbd6ed5 |

### Phase 1 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m5): phase 1 steps`), base df3d80c. No
  brief amendment. No new dependency; no network; no GitHub access; no file under packages/cli/ is in any scope.
- Dependency graph (scopes pairwise disjoint among steps that can run together; merge order within a wave is free):
  - W1 (parallel, no deps): 1.1 bounds; 1.2 vocabulary; 1.3 record run id and optional keys; 1.4 unstructured issue record;
    1.5 version and clock; 1.6 pretty JSON; 1.7 detectors; 1.8 denylist; 1.9 section 10 mapping.
  - W2: 1.10 redaction batch and exact values (1.1, 1.7); 1.11 required-stage plan (1.2, 1.3); 1.12 escaper (1.1, 1.8);
    1.13 caps (1.1). Each may start as soon as its own deps are merged.
  - W3: 1.14 decision table (1.2, 1.3, 1.11); 1.15 finding templates (1.8, 1.12); 1.16 report text templates (1.2, 1.3, 1.8,
    1.12, 1.13); 1.17 budget and handoff (1.1, 1.3, 1.11).
  - W4 (parallel): 1.18 wording scan (1.8, 1.12, 1.15, 1.16); 1.19 package-root exports (1.1-1.17).
  - W5: 1.20 gate (verification only; MAIN tree; after 1.1-1.19 merged).
  - Critical paths: 1.8 -> 1.12 -> 1.15/1.16 -> 1.18/1.19 -> 1.20 and 1.2/1.3 -> 1.11 -> 1.14/1.17 -> 1.19 -> 1.20.
- Environment / bootstrap:
  - Short worker worktree paths (C:/Users/John/Projects/steady-orchard/m5-w<id>); run `pnpm install --frozen-lockfile` per new
    worktree, sequentially. Worktrees base on the working branch HEAD containing every dependency.
  - Every acceptance runs typecheck, lint, prettier on the step's files, the full `pnpm vitest run` (about 11 s), and a Vitest
    JSON title check written to node_modules/.m5-p1-<id>.json (ignored; not a tree change); titles are checked as rendered.
    jq is not installed; checks use node.
  - 1.19 runs `pnpm build` and imports packages/core/dist. 1.20 runs IN the main tree after 1.1-1.19 are merged.
  - Workers run Prettier only on their own .ts files, never on development-artifacts/.
- Couplings:
  - 1.7 extends conformance/invariant-7.test.ts (DETECTOR_SAMPLES must cover every detector); Phase 3 extends the same file
    later. 1.10 depends on 1.7 so its tests run with all 23 detectors.
  - 1.4 edits submission/intake.test.ts only (intake.ts unchanged; captureIssue still returns `record: null` for an
    unstructured issue).
  - 1.19 adds 13 `export *` lines (index.ts goes from 57 to 70); every new exported name was checked unique against core and
    cli at decomposition (TS2308 would be a decomposition bug).
  - 1.18 is test-only; if it finds offending product wording it reports fail instead of editing another step's file.
- Emergent contracts for Phases 2-5 (pinned in the step files):
  - Decision: `decideOutcome(DecisionInput)` in decision/table.ts; contract findings use stage `DECISION_CONTRACT_STAGE`
    ('contract'); callers assign finding ids (`finding-0001`, ...) in handoff order (contract findings first) BEFORE deciding and
    pass each blocking finding's rendered request text; `requests` items carry `finding_id` so publish can set the finding
    record's `request_id`; the decision record stores `{request_id, text}` (strip finding_id).
  - Causes are recorded only when row 6 decides (see Decisions below): rows 1, 2, 3, 7, 8, 9 return `causes: []`, so the
    decision record `causes`, the JSON `causes` of screen and report, the text `cause:` lines, the report's "Inconclusive
    causes" line, and the T-CAUSE lines under "What would change the outcome" are all empty for a `needs-changes` run. Phase 3
    still logs every observed cause code in logs/steward.txt.
  - Required stages: `requiredStages(input, policy.stages.per_category)`; `stage-incomplete` cause code
    'pipeline.stage-incomplete', message 'Required stages produced no result.'.
  - Handoff: `validateHandoff(candidate, { previous, gate, maxRounds, maxBytes? })`, `expectedNextHandoff`; producer phases
    gate, intake, execute, assess (pair N = execute/assess with round N); `PIPELINE_PHASES` adds 'publish'; `initialBudget(policy,
    { githubRequests })`. Handoff finding `subjects` allow up to CHANGED_PATHS_MAX (3000) items, but the finding record's
    optional `subjects` is a record list (at most 1000): Phase 2 assembly must bound it (first 1000) or record the overflow.
  - Unstructured issue record: Phase 3 builds it with `buildSubmissionRecord({ ..., issueKind: null, claimScopeHash: null })`
    when `captureIssue` returns `record: null` (proved valid by the 1.4 test).
  - Report wording: `findingTexts(finding, ctx)` (finding-templates.ts) returns markdown scenario/location/request, decision, or
    note; `report/templates.ts` holds every other fixed line plus helpers (reportHeaderLines, classificationLine, causeLine,
    overflowLine, provenanceLines, nonAuthoritativeNotice); the renderer prefixes notices with '> ', notes with REPORT_ITEM_TEMPLATES.note,
    and cause lines with '- '. Caps: report/caps.ts (static budget 57480).
  - Redaction: `redactTexts(inputs, { credentials, knownSecrets, policyPatterns })` returns `{ texts, counts, exactValues }`
    (counts per id for manifest `redaction.replacements`, exactValues for `exact_values`); `planRedactionBatches` exposes the
    batching; K35 filter applies everywhere.
  - Stored JSON: `prettyJson(value)` (evidence/pretty-json.ts). Version and ids: `stewardVersion()`, `Clock`, `RandomSource`,
    `systemClock`, `systemRandom`, `fixedClock`, `steppingClock`, `fixedRandom` (local run id format built in Phase 2 layout).
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed):
  - Open point from the planner (causes on a row 2 or 3 `needs-changes`): settled from the design docs, no amendment needed.
    docs/processes.md SP19 "Recorded causes form a closed vocabulary, each mapping to `inconclusive`" and Outputs
    "`inconclusive` outcomes with causes"; architecture section 12 failure classes "end as `inconclusive` when required work
    cannot complete"; SP13 row 3 stops "before spending", so stages were never due; consistent with the brief's J-REPORT example
    (`needs-changes` with `causes: []`) and the G2 layout (causes shown only for `inconclusive`). Hence causes only on row 6.
  - Decision result details: contributing_findings = ids of all blocking and uncertain findings (rows 2, 3, 6, 7, 8);
    requests R1.. for every blocking finding with request text, in input order, rows 2, 3, 6, 7, 8; unmet_requirements =
    required requirements not satisfied; row 6 causes = input causes, then unavailable required stage causes (pipeline order),
    then unavailable required requirement causes, then stage-incomplete; an `unavailable` requirement input carries its cause
    (so no `inconclusive` is ever causeless).
  - Request text (brief I7 "plain rendering"): the single markdown rendering of the finding template's request text (code
    spans included), used for the decision record, the finding link, and the CLI `request R<n>:` lines (terminal-escaped).
  - Repository URLs in fixed text render as code spans (the brief's T-FIND notation shows them as code spans; I9 evidence
    locations are code spans too); no clickable links in this milestone.
  - T-FIND gaps filled: free-form linked-issue-missing scenario 'A linked issue is required, and none is named.'; a
    policy-change note without a known revision uses 'proposed revision: <status>' with status `removed`, `unavailable`, or
    `unchecked` (detail null). `<n>` placeholders are named {limit}; the diff-too-large count comes from CHANGED_PATHS_MAX.
  - T-CLS: the classification line and the claim sentence are ONE list item joined by '. ' (caps budget one classification
    line of 300 code units).
  - Escaper edge cases: empty value renders '` `'; empty subject list renders 'none'; overflow of a subject list appends
    ' and <n> more'; truncation suffix ' (truncated)' after the closing fence; 'Inconclusive causes' lists unique cause ids.
  - Caps: heading maximum 60 code units x 9 headings and a 40-line separator allowance, static budget 57480 <= 60000. The
    brief's prose "Computed: 57460 plus separators" does not match its own table (57440); nothing binds that number.
  - Handoff failure order: size, schema, early-exit/plan placement, binding (run, attempt, snapshot, revision), sequence
    (phase → invalid, round or no-handoff-expected → binding), budget, append-only.

### Phase 2 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m5): phase 2 steps`), base 06d9434. No
  brief amendment for phase 2. No new dependency; no network; no GitHub access. No file under packages/cli/, no existing product
  file, and NOT packages/core/src/index.ts is in any scope (root exports are phase 3 scope).
- Dependency graph (scopes pairwise disjoint among steps that can run together; merge order within a wave is free):
  - W1 (parallel, no deps): 2.1 report renderer; 2.2 check summary; 2.3 layout and metrics events; 2.4 logs; 2.5 record
    redaction (CV coverage and re-validation).
  - W2 (parallel): 2.6 manifest (2.3); 2.7 local store write protocol (2.3); 2.8 record assembly (2.3); 2.9 report input from
    records (2.1, 2.2, 2.3).
  - W3: 2.10 publishRunEvidence (2.1-2.9).
  - W4 (parallel): 2.11 publish failure tests (2.10); 2.12 verifyRunDirectory (2.10); 2.13 golden reports, cases.json,
    fixtures/README.md (2.10).
  - W5: 2.14 gate (verification only; MAIN tree; after 2.1-2.13 merged).
  - Critical path: 2.3 -> 2.6, 2.7, 2.8 (and 2.1, 2.2 -> 2.9) -> 2.10 -> 2.11, 2.12, 2.13 -> 2.14.
- Environment / bootstrap:
  - Same as phase 1: short worker worktrees (C:/Users/John/Projects/steady-orchard/m5-w<id>), sequential
    `pnpm install --frozen-lockfile` per new worktree, Vitest JSON title checks written to node_modules/.m5-p2-<id>.json
    (ignored), jq absent (node used). 2.14 runs IN the main tree.
  - Evidence tests write only under os.tmpdir() (mkdtemp prefixes m5-store-, m5-pub-, m5-fail-, m5-verify-, m5-golden-) and
    clean up with rmSync retries; no run directory is ever created in the repository. Publish-based tests use describe
    timeouts of 30000 ms (golden 60000 ms): each publish runs three redaction passes, each starting a worker thread.
  - Goldens are .txt (Prettier never touches them); the golden test normalizes CRLF to LF (core.autocrlf=true).
- Couplings:
  - 2.11, 2.12, 2.13 each duplicate the publish sample builder on purpose: a shared non-test helper would ship in dist, and a
    shared *.test.ts helper would register its tests twice.
  - 2.13's goldens lock the combined output of 2.1, 2.2, 2.9, 2.10 and the phase-1 templates. Any later change to report text,
    layout, escaping, or truncation must regenerate the affected goldens in the same step (fixtures/reports/ in its scope).
  - 2.11 is test-only: a defect it exposes in publish.ts or local-store.ts comes back as a revision, never a fix inside 2.11.
  - Every exported phase 2 name was checked unique across packages/core and packages/cli at decomposition (phase 3's
    `export *` lines would otherwise fail with TS2308).
- Emergent contracts for phases 3-5 (pinned in the step files):
  - Root exports (phase 3 adds 12 `export *` lines): report/render.ts, report/summary.ts, evidence/layout.ts,
    evidence/metrics.ts, evidence/logs.ts, evidence/redact-records.ts, evidence/manifest.ts, evidence/local-store.ts,
    evidence/assemble.ts, evidence/report-input.ts, evidence/publish.ts, evidence/verify.ts. No phase 2 function name starts
    with load, validate, resolve, parse, capture, or check, so the invariant-5 exhaustive name lists do not change for them.
  - Run identity and paths: `localRunId(startedAt: Date, random)`; take startedAt = clock.now() once and reuse its ISO string as
    the run record started_at (the metrics month comes from it). Store root = `repositoryStoreRoot(evidenceDir, repository)` =
    <evidence-dir>/<owner>/<repo>; run directory store path `runs/<pr or issue>-<n>/<run-dir>`; evidence locations are store
    paths (`localEvidenceLocation(storePath)`), so the J-SCREEN `run.directory` is PublishedRun.directory (absolute).
  - Publish sequence for phase 3: `prepareFindings(handoffFindings, findingTemplateContext(submissionRecord, policy,
    defaultBranch))` -> `decideOutcome({ freshness 'current', capacity 'available', admission 'not-required', findings:
    decisionFindings(prepared), causes, requiredStages, stageResults, requirements })` (local runs always get kind 'outcome')
    -> `publishRunEvidence({ evidenceDir, assembly, classification, defaultBranch, logLines, credentials, localRun: true,
    createdAt }, { fs?, redact? })` -> PublishedRun { directory, storePath, report, checkSummary, run, submission,
    policyRevision, findings, decision, reportRecord, manifest }. The CLI prints a report only from a successful result.
  - RunAssemblyInput: runId, runAttempt, startedAt, gateCompletedAt, finishedAt, phases (RunPhaseLatency {phase, seconds,
    recordedAt} per phase executed before publish), stewardVersion, loadedPolicy, policyLoadedAt, submission (for an
    unstructured issue the record built with buildSubmissionRecord and issueKind null), baseCommit (pull request base sha or
    null), mode (contract effective_mode), findings (PreparedFinding[]), decision, githubRequests, retries. ClassificationInput
    comes from the contract result (category, consistency, plausible categories are not in any record).
  - Invariant-4 publish injections available to phase 3: options.redact (failure, timeout, a marker in a strict field for
    schema re-validation, a lengthened rendered text for the cap guard) and options.fs (file, metrics, manifest, rename
    failures); each yields a failure with no report text and no run directory (2.11 proves it).
  - Failure-code unions for the never-pass tables: ReportRenderFailureCode, CheckSummaryFailureCode,
    EvidenceLayoutFailureCode, RunMetricsFailureCode, EvidenceManifestFailureCode, EvidenceRedactionFailureCode,
    LocalStoreFailureCode, RunAssemblyFailureCode, ReportInputFailureCode, RunEvidenceFailureCode (their union plus
    evidence.too-large), RunVerificationFailureCode (report.run-unreadable, report.evidence-invalid).
  - `steward report` (phase 4) uses `verifyRunDirectory(dir)` -> VerifiedRun { directory, manifest, run, submission,
    policyRevision, decision, report, findings, reportMarkdown, files (manifest file count; 9 for a two-finding pull request
    run), metrics 'verified' or 'missing', warnings [{ code 'report.metrics-missing' }] }; failures carry details [{ code, path,
    message }] for the J-REPORT errors array.
  - zero-execution scan: evidence/ and report/ modules import no node:child_process, node:vm, or node:worker_threads directly
    and no specifier containing llm, model, copilot, openai, anthropic, sandbox, container, docker, or runner, so phase 3 can
    add both directories to the scan roots.
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed):
  - Per-item caps: an item over its cap is fitted, not failed (a submission must not be able to suppress its own report):
    lines are water-filled shortest first, and an over-share line is cut at the last position outside every code span and
    gets the approved suffix ' (truncated)'. No code span is ever cut, so derived text never leaves a code span. The report
    and summary maxima remain steward-defect failures of publish.
  - Overflow lines of every section link the run directory's store path (evidenceLocation('')).
  - Executed commands, references, and flagged items are caller-rendered one-line items, always empty at contract level.
    report.md notices are adjacent '> ' lines as in the approved layout; the check summary puts each notice in its own paragraph.
  - Finding records keep the first 1000 subjects; basis = the contract message plus ' Subjects recorded: 1000 of <n>.' when
    cut; the report still states the full remaining count (paddedSubjects in report-input.ts).
  - Three redaction passes: (1) every record string plus the log text and the default branch, (2) the rendered report and
    summary, (3) manifest strings (any replacement there fails the write). Logs are redacted BEFORE truncation (truncating first
    could cut a credential so no detector matches). Replacement counts merge in the order known-secret, built-in detectors,
    policy patterns.
  - The manifest schema also enforces allowed paths and record types per layout, the seven required run files, at most 16 log
    files of at most 1048576 bytes each, and store_path and metrics file names bound to the run directory name.
  - nodeEvidenceFs.rename tolerates transient Windows sharing violations (EPERM, EACCES, EBUSY; 5 attempts 100 ms apart, never
    onto an existing target). This is system-call tolerance, not an evidence-write retry (limits.evidence.write_retries stays
    unused locally).
  - Report provenance and notices follow the policy-revision record kind (git-tree trusted branch; local-file
    non-authoritative), consistent with the G5 authoritative flag rule.
  - Known consequence of the approved CV-rules, not compensated: a redaction marker inside a strictly formatted record field
    invalidates the record and fails publish, e.g. an attachment URL with userinfo (url-credentials rewrites its scheme and
    host). Such a submission gets no report (exit 2 later) instead of needs-changes; 2.11 pins the behavior.
- Open brief finding for phase 3 (not compensated in any phase 2 step; raised to the planner as an amendment note after this
  commit): M04 snapshot schemas accept only a 40- or 64-hex `policy_revision`, so captureIssue and capturePullRequest fail
  `snapshot.invalid` for a `local:<sha256>` revision; every `steward screen --policy-file` run would fail before gate, against
  brief DoD 11 and the local-policy screen scenarios. Phase 2 is unaffected (its tests build submission records without an
  embedded snapshot).
- Supervisor execution notes (phase 2):
  - W1 (2.1-2.5) base 9979369, worktrees C:/w/m5-w<id>. Workers of 2.1 and 2.2 wrote raw U+202E and U+200B into
    render.test.ts, summary.test.ts, and their reports (the step files show those samples raw); the supervisor replaced each
    with its backslash-u escape in the worktree, amended the step's single commit, and re-ran acceptance (all OK) before
    merging. Test semantics unchanged (JS escapes denote the same characters).
  - W2 (2.6-2.9) base 2aeb9d2; all acceptance re-run OK; no supervisor edits.
  - W3 (2.10) base b3ec67f; acceptance re-run OK; publish.ts reviewed against actions 3a-3l; no supervisor edits.
  - W4 (2.11-2.13) base e56b210; all acceptance re-run OK (2.13 git check-ignore printed no path). 2.11 and 2.12 unedited.
    2.13: worker again wrote raw U+202E and U+200B in golden-reports.fixture.test.ts; supervisor escaped them and amended the
    single commit before merge (goldens unaffected: they hold the escaped renderings). 2.13 in-flight spec correction: see
    Revisions.
  - W5 (2.14) ran in the main tree at base 0b937a3; report overall PASS; the supervisor re-ran D1-D7 independently (all PASS).
  - Post-gate supervisor fix 2f0281a: verify.test.ts never removed its beforeAll publish store, leaving one m5-verify-
    directory under os.tmpdir() per run; added afterAll(rmTmpDir(sourceStore)); leaked count stays constant across a run.
    Test-only; D1 (test, format:check) re-run exit 0 after the fix. Twelve m5-verify- directories leaked by earlier runs
    remain under the user temp directory (not removed by the supervisor).

### Phase 3 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m5): phase 3 steps`), base 67455ee. No
  brief amendment during phase 3 decomposition (the G6f snapshot widening was amended before it, 9979369; step 3.1 implements
  it). No new dependency; no network; GitHub only through an injected fetch over recorded or synthetic responses. No file
  under packages/cli/ is in any scope.
- Dependency graph (scopes pairwise disjoint among steps that can run together; merge order within a wave is free):
  - W1 (parallel, no deps): 3.1 G6f snapshot widening (never-pass snapshot.invalid trigger moves to 'HEAD'); 3.2 phase
    contract, local pass-throughs, runWithPhaseTimeout; 3.3 publish phase (local decision input, decide, publishRunEvidence).
  - W2 (parallel): 3.4 sequence runner (3.2); 3.5 gate (3.1).
  - W3 (parallel): 3.6 screenSubmission (3.2, 3.3, 3.4, 3.5); 3.7 invariant-4 boundary matrix, control run, combinatorial
    decision test (3.2, 3.3, 3.4).
  - W4 (parallel): 3.8 screen scenarios and fixtures/README.md (3.6); 3.9 invariant-6 (3.6); 3.10 invariant-7 (3.6); 3.11
    invariant-8 (3.3, 3.4, 3.6); 3.12 never-pass-pipeline (3.3-3.6); 3.13 zero-execution and GET-only (3.6); 3.14 root
    exports (3.2-3.6); 3.15 invariant-4 gate-phase and publish injections (3.6, 3.7; appends to the 3.7 file).
  - W5: 3.16 gate (verification only; MAIN tree; after 3.1-3.15 merged).
  - Critical paths: 3.1 -> 3.5 -> 3.6 -> 3.15 -> 3.16 and 3.2 -> 3.4 -> 3.7 -> 3.15.
- Environment / bootstrap:
  - Same as phases 1-2: short worker worktrees, sequential `pnpm install --frozen-lockfile` per new worktree, Vitest JSON
    title checks written to node_modules/.m5-p3-<id>.json (ignored), node instead of jq. 3.16 runs IN the main tree.
  - Temp prefixes: m5-pp- (3.3), m5-screen- (3.6), m5-scn- (3.8), m5-inv6- (3.9), m5-inv7- (3.10), m5-inv8- (3.11), m5-npp-
    (3.12), m5-zx- (3.13), m5-inv4- (3.15); each step's acceptance proves its prefix count is unchanged after its test run.
    Every step's acceptance also runs a raw-character check (C0 except tab, LF, CR; DEL; zero-width; bidi; BOM) over its files
    and its report.
  - The invariant-4 title checks (3.7, 3.15, 3.16) build titles inside node with the arrow written as backslash-u2192 (never
    passed as a shell argument) and read FAILURE_CAUSES from vocabulary.ts; expected counts 182 after 3.7, 215 after 3.15.
  - At decomposition all 14 screen scenarios were run end to end (capture, contract, decision, publishRunEvidence) against
    the current code with G6f applied in a scratch build: every expectation in fixtures/screen/expectations.json matched.
- Couplings:
  - 3.7 and 3.15 share invariant-4.test.ts: 3.15 appends; 3.7 must not create the gate throw, typed-failure, or timeout
    titles or any publish title.
  - 3.14 keeps invariant-5.test.ts unchanged: no new root function starts with load, validate, resolve, parse, capture, or
    check (checked at decomposition, with every new root name unique across packages/core and packages/cli).
  - 3.13 adds pipeline/, evidence/, report/, and decision/ to the zero-execution import scan; pipeline module names avoid the
    forbidden specifier words (the brief's runner.ts is sequence.ts).
  - Local policy revisions hash on-disk bytes (CRLF in Windows checkouts); no test pins a local revision value.
- Emergent contracts for phase 4 (CLI):
  - `screenSubmission(deps)` (pipeline/screen.ts) performs the whole local run. The CLI supplies the repository ref (from
    --repo, else the upstream remote, else origin), submission { type, number }, policySource (trusted-branch, or local-file
    with the path resolved against cwd), token (resolveGitHubAuth; null when none), and evidenceDir (default per OS, created
    if absent); fetch, transport, resolver, clock, random, and sleep default to the real ones.
  - Result kinds: 'not-started' { stage version, repository, policy, capture, or gate; repository; policy; failure;
    exitStatus 1 or 2 }; 'publish-failed' { repository, policy, run { run_id, run_attempt, snapshot_hash }, failure code
    'screen.evidence-write-failed' with the underlying code in details[0], exitStatus 2 }; 'completed' { repository, policy,
    published (PublishedRun), decision (outcome, causes, requests, contributing_findings), exitStatus 0, 1, or 3 }. Exit
    statuses come from SCREEN_EXIT_BY_OUTCOME and screenPreRunExitStatus.
  - Core-assigned pre-run codes: 'screen.policy-missing' (message 'The repository has no published policy on its default
    branch.'; the CLI adds the --policy-file hint), 'screen.policy-invalid' and 'screen.policy-file-invalid' (validation
    errors in failure.details), 'steward.internal-error'. Other pre-run failures keep their codes (github.*, file.*,
    snapshot.*, intake.record-invalid, steward.version-unavailable, pipeline.phase-failed, pipeline.phase-timeout,
    pipeline.handoff-invalid, pipeline.handoff-binding); the CLI may map stage 'repository' failures github.unauthorized
    (with a token) and github.not-found to its own codes as preflight does.
  - ScreenPolicyInfo { source trusted-branch or local-file, revision, ref, commit, path, authoritative } feeds J-SCREEN
    `policy` and the top-level `authoritative`; its `path` is the path handed to loadPolicy (J-SCREEN prints the path as the
    user gave it).
  - J-SCREEN arrays: causes from decision.causes { cause, code, subjects }; findings from published.findings { finding_id,
    code, severity, location.field, subjects }; requests from decision.requests { request_id, text }; run.directory from
    published.directory.
  - `steward report` uses verifyRunDirectory. After 3.14 the core root has 87 `export *` lines and exports every phase 2
    and phase 3 module.
  - Never-pass tables for CLI-only codes (screen and report commands) belong to phase 4; core unions are covered by
    never-pass-pipeline.test.ts.
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed):
  - Module layout: pipeline/phases.ts (phase contract, pass-throughs, timeout helper), sequence.ts (the brief's runner.ts;
    'runner' is a forbidden specifier word in the zero-execution scan), gate.ts, publish-phase.ts, screen.ts.
  - Gate: repository read and trusted-branch policy read on the bootstrap budget; capture on a fresh budget from the loaded
    policy; the run record's github_requests counts bootstrap plus capture requests; retries count calls of the injected
    sleep (the GitHub client sleeps once per retry). runGate builds the gate handoff; screen validates it with
    acceptGateHandoff (schema plus binding to run id, attempt, snapshot, revision); a rejected gate handoff means no run
    exists (exit 2).
  - Phase timeouts: intake, execute, assess, and every round run under limits.stage_seconds (injectable phaseTimeoutMs); a
    timeout is a recorded budget-exhausted cause. The gate runs under the injected timeout or the hard maximum of
    limits.stage_seconds (the policy is unknown until the gate loads it); a gate timeout is a pre-run failure. Publish is not
    raced: an abandoned write could commit after the timeout, breaking the no-committed-directory rule; its steps are bounded
    (redaction time bound, bounded sizes). The brief's invariant-4 injection list has no publish timeout, consistent with this.
  - Runner causes: a typed phase failure keeps its cause, code, and message with subjects []; runner-generated causes
    (pipeline.phase-failed, phase-timeout, handoff-invalid, handoff-binding, rounds-exhausted) carry subjects [phase label]
    (intake, execute, assess, execute-N, assess-N). Contract inconclusive subjects are cut to the record list maximum (1000).
  - Local decision input: freshness current, capacity available, admission not-required, requirements [] at contract level;
    causes = handoff causes (contract causes from the gate), then runner causes; the decision module appends stage causes.
    A thrown decision or a waiting result fails publish with 'pipeline.decision-invalid' (a local run never waits).
  - LOCAL_PHASES execute decrements budget_remaining.rounds when it starts round N >= 1 (rounds counts round pairs not yet
    started).
  - Run log lines (logs/steward.txt): `policy <source> revision <id>`, `contract disposition <d>`, `warning <code>`, `cause
    <cause> <code> at gate`, `gate complete` or `gate complete; early exit <x>`, `phase <label> complete`, `cause <cause>
    <code> at <label>`, `decision row <n> outcome <o>`, `decision cause <cause> <code>`.
  - Latency metrics events: gate (start to gate acceptance) plus one per executed sequence phase, including a failed or
    timed-out one.
  - No fixtures/submissions or fixtures/github/synthetic additions: scenario bodies with an attachment, a sentinel token,
    or a missing field derive from committed bodies by literal replacement in test code (the golden pr-hostile case already
    covers hostile derived text); synthetic repository responses are built in test code from github/policy-directory and
    github/testbed.
  - Test-bed scenarios use templates/policy/policy.yml (as the live DoD commands do); synthetic and octo/demo runs use
    fixtures/policies/valid/minimal-no-llm.yml.

### Phase 4 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m5): phase 4 steps`), base f30b4b6. No
  brief amendment. No new dependency; no file under packages/core/ in any scope (every CLI need is met by existing core
  exports; invariant-5.test.ts is unaffected because no core export is added). GitHub only through injected fetches, except
  the live tier (4.12) and the gate's D4 and D5 (read-only GETs; network and a logged-in gh required).
- Dependency graph (scopes pairwise disjoint among steps that can run together; merge order within a wave is free):
  - W1 (parallel, no deps): 4.1 conventions; 4.2 upstream.ts plus preflight exit 3 (one-line edits in three M04 tests);
    4.3 evidence directory; 4.4 screen arguments.
  - W2 (parallel, after 4.1): 4.5 screen output (J-SCREEN, text, error mapping); 4.7 steward report (output and command);
    4.8 policy command conventions.
  - W3: 4.6 screen command (4.1-4.5).
  - W4 (parallel): 4.9 cli.ts dispatch, -h removal, index.ts exports (4.1-4.8); 4.10 command-level zero-execution and
    GET-only (4.6, 4.7); 4.11 CLI never-pass tables (4.6, 4.7); 4.12 live tier (4.6, 4.7).
  - W5: 4.13 gate (verification only; MAIN tree; after 4.1-4.12 merged).
  - Critical path: 4.1 -> 4.5 -> 4.6 -> 4.9, 4.10, 4.11, 4.12 -> 4.13.
- Environment / bootstrap:
  - Short worker worktrees as before; do NOT reuse the stale C:/w/m5-3.4 path or a branch name colliding with
    wt/patch-steward-m5-3.4 (left from the discarded 3.4 attempt). Sequential `pnpm install --frozen-lockfile` per new
    worktree. Vitest JSON title checks write node_modules/.m5-p4-<id>.json (ignored). jq absent (node used). 4.13 runs IN the
    main tree.
  - Temp prefixes (each step's acceptance proves its count unchanged): m5-evd- (4.3), m5-sout- (4.5), m5-scr- (4.6),
    m5-rep- (4.7), m5-czx- (4.10), m5-cnp- (4.11), m5-live- (4.12). Every acceptance runs the raw-character check over its
    files and its report.
  - 4.12 acceptance runs `GH_TOKEN=$(gh auth token) pnpm vitest run --config vitest.live.config.ts <file>`; an offline
    worker gets skipped tests and an honest title-check FAIL.
  - CLI tests never spawn the real gh (GH_TOKEN in env, or ghBinary pointing to a missing path) and never touch the real
    default evidence directory (homedir injected). os.tmpdir() here is D:\Users\John\AppData\Local\Temp (no .git above it).
- Couplings:
  - 4.2 changes exactly one line in each of preflight-command.test.ts, preflight-command.fixture.test.ts,
    preflight-never-pass.fixture.test.ts (2 -> 3); the gate's D6 re-checks the diff against f30b4b6. Preflight output already
    met the conventions, so its only behavior change is the exit mapping.
  - conventions.ts imports only the TYPE CommandIo from policy-command.ts; 4.8 keeps CommandIo there. 4.6 imports
    PreflightCommandContext and PREFLIGHT_UNAUTHENTICATED_WARNING from preflight-command.ts (unchanged by 4.2).
  - The core zero-execution test scans every non-test file under packages/cli/src for forbidden specifiers (child_process,
    vm, worker_threads, llm, model, copilot, openai, anthropic, sandbox, container, docker, runner): new module names avoid
    those words; the new test files are excluded by suffix.
  - 4.9 adds 8 `export *` lines (index.ts 7 -> 15); every new CLI export name was checked unique across packages/cli and
    against the core names the same files import.
  - 4.10, 4.11, 4.12 are test-only: a defect they expose in 4.5-4.7 comes back as a revision.
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed):
  - J-SCREEN for a failure where no policy revision was loaded: policy null, authoritative false, notices only the local-run
    notice (the Authoritative flag rule states whether the revision a run used is authoritative; none was used, and the
    non-authoritative notice needs a revision). A failure after the policy loaded carries the policy and both flags per rule.
    Pre-run failure JSON repository = the core-known full name, else the requested owner/name.
  - `steward report` exits 1 for a stored `overridden` outcome: the version-1 decision record has no effective-outcome field
    and local runs never produce `overridden`, so exit 0 is impossible without evidence (never-pass). Revisit when maintainer
    actions land.
  - `steward report` refuses stored text it would print raw: a report.md or check summary with a control, bidi, zero-width,
    or format character (core reportCharacterViolations) is `report.evidence-invalid`, exit 1, nothing printed. Clean
    report.md prints byte for byte.
  - CLI-only codes: screen.no-upstream, screen.repository-unavailable and screen.token-rejected (mirroring preflight's
    mapping), screen.evidence-dir-unavailable, steward.internal-error; report.run-unreadable (2), report.evidence-invalid
    (1), steward.internal-error (2). Usage codes: screen usage.unknown-option, usage.invalid-arguments,
    usage.conflicting-options; report usage.unknown-option, usage.invalid-arguments. `screen.policy-missing` CLI message:
    'The repository has no published policy on its default branch. Pass --policy-file <path> to screen under a local policy
    file.'
  - Screen text output escapes every interpolated value with escapeTerminalText, the run directory included (Windows
    backslashes print doubled; path normalization and bash double quotes accept it; the gate unescapes with sed).
  - The CLI never creates the evidence directory (core creates directories at write time, so a pre-run failure leaves
    nothing); the inside-checkout warning walks up from the working directory for a `.git` entry (no git process); the
    default directory is never checked.
  - Screen reads git remotes only without --repo; upstream discovery is the shared upstream.ts, also used by preflight.
  - `steward policy` conventions: text-mode errors move from stdout to stderr as `error <code> <path or ->: <message>` (with
    ` (line L, column C)` when known); warnings print `warning <code>: <message>` (the separate path is dropped; the only
    warning's message names it); JSON-mode usage errors no longer write stderr; exits unchanged (an invalid policy stays 1 per
    the approved convention table). `-h` is an unknown command (usage error, exit 2).
- Emergent contracts for phase 5 (documentation must describe exactly this):
  - Usage text: four command lines (policy, preflight, screen, report); `help` and `--help` only.
  - `steward screen`: syntax, text lines, J-SCREEN members and order, exit statuses, default evidence directories, the
    inside-checkout and unauthenticated warnings, and the CLI codes above. `steward report`: syntax, byte-for-byte text,
    J-REPORT members and order, exit statuses (overridden 1), report.metrics-missing warning, control-character refusal.
  - commands.md `steward policy` section is now stale on: error lines (stderr, colon format), warning line format (the
    example output line becomes `warning policy.llm-model-placeholder: llm.model is the template placeholder ...`), JSON-mode
    stderr for usage errors (now empty), `-h`. Preflight: `inconclusive` exits 3 everywhere it is documented.
  - Live tier file: packages/cli/src/steward-commands.live.test.ts.

### Phase 5 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m5): phase 5 steps`), base 977d926. No
  brief amendment. Documentation only: no file under packages/, templates/, fixtures/, or .github/ is in any scope; no new
  dependency; no build or test needed by any doc step (Prettier only). GitHub access only in the gate's D11 (read-only GETs).
- Dependency graph (scopes pairwise disjoint among steps that can run together; merge order within a wave is free):
  - W1 (parallel, no deps): 5.1 ADR-0062 and ADR-0063; 5.2 ADR-0064 and ADR-0065; 5.4 ADR-0068, ADR-0069, ADR-0070;
    5.5 architecture part 1 (Status, 6.2, 6.3, one 6.4 sentence, 6.5); 5.7 processes (Status, SP05, SP13, SP18, SP19, SP20);
    5.10 commands.md part 1 (CLI conventions section, policy and preflight fixes, Proposed table and callout).
  - W2 (parallel): 5.3 ADR-0066, ADR-0067, ADR-0060 status, ADR index rows (after 5.1, 5.2, 5.4); 5.6 architecture part 2
    (9, 10, 11, 12, 12.1, 13, 15) (after 5.5); 5.11 commands.md part 2 (screen and report sections) (after 5.5, 5.10).
  - W3 (parallel): 5.8 whitepaper (5.1-5.4, 5.6, 5.7); 5.9 README and CLAUDE.md (5.6, 5.7, 5.11); 5.12 usage (5.6, 5.7,
    5.11); 5.13 configuration (5.6, 5.11); 5.14 troubleshooting (5.6, 5.7, 5.11); 5.15 overview and manual README (5.6, 5.7,
    5.11).
  - W4: 5.16 gate (verification only; MAIN tree; brief project DoD 1-18 as D1-D18 plus D19-D22).
  - Critical paths: 5.5 -> 5.6 -> W3 -> 5.16 and 5.10 -> 5.11 -> W3 -> 5.16.
- Precedence: the governing documents (architecture, processes, command reference) land in W1-W2, before the summaries
  (whitepaper 9-14, README, CLAUDE.md) and the other manual pages in W3. ADRs (record only) run beside the governing
  documents; all content derives from the same approved brief facts and the delivered code.
- Environment / bootstrap:
  - Short worker worktrees as before; do NOT reuse C:/w/m5-3.4 or a branch name colliding with wt/patch-steward-m5-3.4.
    Sequential `pnpm install --frozen-lockfile` per new worktree (Prettier comes from node_modules).
  - Every doc step writes the git-ignored link checker node_modules/.m5-p5-links.mjs from its packet and requires LINKS OK
    over its files; W3 steps pass ALLOW for anchors created in parallel (usage.md#local-screening-available,
    usage.md#historical-replay-proposed, configuration.md#local-evidence-and-reports-available). The gate's D19 runs the same
    checker over every persistent doc without ALLOW (baseline LINKS OK at 977d926, measured at decomposition).
  - Tool-channel facts found at decomposition (apply to every agent): the Write and Bash tools decode a backslash-u escape
    into the raw character (a raw U+2028 inside a node -e regex literal is a syntax error), and the Bash tool halves a double
    backslash (4.13's sed needed eight typed backslashes); other backslash escapes pass unchanged. Phase 5 packets contain no
    backslash-u and no double backslash: RAWCHECK compares code points, INV4CHECK builds the arrow with
    String.fromCharCode(0x2192), and D11 finds the run directory with find instead of sed.
  - All gate title lists and D17's path-filtered fixture run were verified against HEAD 977d926 at decomposition (every
    title present and passing; INV4 OK 215).
- Couplings:
  - Pinned new headings (anchors): commands.md "## CLI conventions (Available)" (5.10), "## `steward screen` (Available)"
    and "## `steward report` (Available)" (5.11); usage.md "## Local screening (Available)" and "## Historical replay
    (Proposed)" replacing "## Local screening and replay (Proposed)" (5.12); configuration.md "## Local evidence and reports
    (Available)" before the unchanged "## Evidence and visibility (Proposed)" (5.13). The manual README TOC (5.15) links them.
  - ADR filenames and titles are pinned in 5.1, 5.2, 5.4 and repeated in 5.3's index rows; a rename in one breaks the other.
  - "length cap" baseline: architecture, processes, and whitepaper each keep exactly their one existing line (6.2 Report row;
    SP13 step 2 first line; whitepaper section 8); 5.5 and 5.6 share architecture's line.
  - Persistence baselines: CLAUDE.md 2 lines (development-artifacts mentions) and configuration.md 1 line (.prettierignore row);
    "milestone": CLAUDE.md 1 line, fixtures/README.md 1 line; DF or deferred.md: CLAUDE.md 3, README.md 1.
  - "the reference table" changes to "the references" only in SP13 step 2 and whitepaper section 8 (reports use lists only);
    SP07 and SP08 keep it (a data structure).
  - fixtures/README.md already lists fixtures/reports/ and fixtures/screen/ (phases 2-3): no phase 5 change; D21 confirms
    fixtures unchanged.
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed):
  - ADR files: 0062-report-caps.md, 0063-report-wording-escaping-and-denylist.md, 0064-evidence-run-directory-and-local-store.md,
    0065-redaction-at-persistence.md, 0066-uniform-cli-conventions.md, 0067-steward-screen-and-report-commands.md,
    0068-local-run-identity.md, 0069-required-stages-never-pass-incomplete.md, 0070-phase-handoff-records.md; titles exactly
    as in the brief's ADR inventory.
  - Documents state the delivered phase 2-4 refinements: `steward report` exits 1 for a stored `overridden` (the version-1
    decision record has no effective outcome); `steward policy` never exits 3 (its `outcome: inconclusive` line describes a run
    under that policy); report items over their cap are fitted, not failed; causes are recorded only for `inconclusive`.
  - Architecture 12.1 constant names: Report maximum; Check-run summary maximum; Report items per section; Report item length;
    Derived value per report occurrence; Subjects listed per report item; Evidence log file; Evidence log files per run;
    Exact-value credential minimum length; Files per run directory; Handoff record (canonical JSON). The sentence "Every
    constant is a maximum except the two versions" gains the exact-value minimum exception.
  - Architecture 6.4 gains one sentence on local runs (phases in one process, validated handoffs); its job table is unchanged,
    so no whitepaper job-table sync is needed.
  - Pinned NEEDS INPUT callouts: commands.md keeps one for init, replay, the unnamed SP20 publication flag, and preflight's
    mandatory commands and self-review; usage.md gets one for the publication flag and one for replay's dataset schema and
    arguments (usage.md count 2 -> 3).
  - Gate extras beyond the brief DoD: D19 link integrity, D20 raw characters in phase 5 files, D21 phase scope (no packages,
    templates, fixtures, .github, deferred, problem-statement, plan, or installation-page change since 977d926), D22 no
    "milestone" beyond the fixtures/README.md baseline.
- Review note for the supervisor (roadmap phase DoD, not mechanically checkable): after W3, read the Status paragraphs of
  architecture and processes, README Status, CLAUDE.md Project state, and the manual README and overview status lines; none
  may describe a stage, container, model call, publication, or branch store as working.

## Revisions

<!-- supervisor appends: phase | failed step | revision note | outcome -->

| Phase | Trigger step | Revision note | Outcome |
| ----- | ------------ | ------------- | ------- |
| before 1 | owner gate (lead relay, 2026-09-27) | Owner approved G1-G7 (G7 Option A), I1-I29, K27-K37, ADR-0062 to ADR-0070 as recommended, keeping please on the denylist and all 15 detectors; brief gate sections marked APPROVED with rejected alternatives marked; project DoD re-pinned (items 6, 8, 10, 11, 13); roadmap phase 1, 4, 5 DoDs pinned. Lead correction: J-SCREEN example showed source trusted-branch with authoritative false and the non-authoritative notice; brief G5 now states the Authoritative flag rule (authoritative equals policy source trusted-branch; non-authoritative notice exactly when false), the J-SCREEN example is a local-file run with a trusted-branch variant, J-REPORT states both flags equal; CV-list pins compact one-line JSON output. | brief amended |
| 1 | 1.19 | Corrected in flight (supervisor): actions step 1 base check grep -c "export function redactTexts" printed 0 because step 1.10 correctly declared export async function redactTexts (async per the 1.10 spec); worker stopped with missing-base. Root cause: prerequisite grep mis-specified. Fix: pattern changed to grep -c "export async function redactTexts"; no other field changed. | step file corrected and committed; 1.19 re-run from a fresh worktree |
| 1 | 1.19 | Corrected in flight (supervisor), second attempt: pnpm vitest run exited 1 because conformance/invariant-5.test.ts pins the exact sorted list of root functions named load/validate/resolve (and parse/capture/check); the new root exports validateHandoff and parseStewardVersion made both lists stale, and the file was outside the step scope. Root cause: decomposition missed the invariant 5 exhaustive-name coupling. Fix: invariant-5.test.ts added to files_in_scope, context states both signatures and failure codes, new action 4 extends both lists and adds rejection assertions (pipeline.handoff-invalid, steward.version-unavailable), prettier acceptance covers the file. Later phases adding load/validate/resolve/parse/capture/check root functions must extend invariant-5.test.ts in the same step. | step file corrected and committed; 1.19 re-run from a fresh worktree |
| 3 | phase 2 decomposition | Owner-approved (2026-09-27) amendment G6f: M04 snapshot.ts typed the issue and pull request snapshot policy_revision as recordCommitIdSchema (snapshot.test.ts asserted local: rejected), so every steward screen --policy-file run failed capture before gate, contradicting DoD 11. Brief: owner gate G6 row and approval line G6a-G6f; Gate G6 adds G6f (widen to policyRevisionIdSchema; snapshot_version and every schema_version stay 1; existing snapshots and git-revision hashes unchanged; policy_change.proposed.revision stays recordCommitIdSchema) and reads No other record or snapshot change; delivered-code snapshot.ts fact; I1 note; Assumptions; invariant-8 bullet (snapshot, submission record, run record, report bind the same local revision); DoD 10 snapshot test; ADR-0068 Records G6a, G6f, I14, I15 (ADR count stays 9). Also recorded in Gate G3 CV-rules that the owner reviewed and accepted the fail-closed consequence (detector hit on a contributor-controlled snapshot string fails evidence.redaction-invalidated, no evidence, no report, exit 2); no step change (2.11 pins it). Roadmap: phase 3 scope gains snapshot.ts and snapshot.test.ts (widening only), DoD gains the snapshot accepts a local policy revision test, risk note. | brief amended |
| 2 | 2.13 | Corrected in flight (supervisor, after the fact): the pr-hostile case listed H with 'dir/' + TOKEN as its 11th item, but reportSubjectList shows 10 subjects then 'and 1 more', so the mandated check that report.md contains [REDACTED:github-token] could not hold with the spec order. Worker moved 'dir/' + TOKEN to index 9 (the secrets-expression sample becomes the hidden 11th; render.test.ts still renders it). Root cause: decomposition missed the 10-item subject window. Fix: step file H order updated to what ran; its raw U+202E and U+200B samples replaced by backslash-u escapes. | step file corrected and committed; 2.13 merged as run |
| 3 | 3.4 | Retry (supervisor): first attempt (688602c, unmerged) passed acceptance but runPhaseSequence had no try/catch, violating actions item 4 (never throws; an unexpected exception becomes pipeline.phase-failed with the phase label and stops the loop); no acceptance check covered it. Retried from a fresh worktree at cf9a81f with the rule restated and one added test 'an unexpected runner exception records phase-failed' (Clock that throws on its 2nd call). Step file actions now list that test. The discarded first-attempt worktree C:/w/m5-3.4 and branch wt/patch-steward-m5-3.4 remain on disk (removal was blocked by the permission classifier; left for the human). | retried once; merged as 78bd460 |
| 4 | 4.5, 4.7 | Corrected before merge (supervisor, amended into each worker commit; no step file change): both reports quoted a raw U+202E in their deviations text (raw-character acceptance printed RAW for the report), now written as U+202E or an escape; 4.5 screen-output.test.ts used new RegExp (step context forbids it) in 'screen text escapes derived values', replaced by a code-point filter over the text expecting no character at or below 0x08, 0x0b-0x1f, 0x7f, or 0x202a-0x202e. Cause: the worker file-writing channel turns backslash-u escapes into raw characters; later steps should build such characters with String.fromCharCode. | corrected; merged as c1759c4 and 5a73404 |
| 4 | 4.13 | Gate action D5 as written (one sed argument holding both expressions, prefix strip then doubled-backslash collapse) failed in the worker's Git Bash with unterminated 's' command; the worker and the supervisor ran the same two expressions as separate sed -e arguments (the supervisor from a script file). Same semantics; all D5 expectations met. Later gates should use the -e form. No step file change. | noted; gate passed |
| 5 | 5.9 | Supervisor integration fix after merge (2c2bcdd): CLAUDE.md Project state described src/decision as the required-stage table in precedence order and the architecture check and label mappings; the step's delivered facts say SP13's table and the architecture section 10 check and label mappings. Changed to the SP13 decision table in precedence order and the architecture section 10 check-conclusion and label mappings. Acceptance did not pin this clause. No step file change. | corrected; prettier clean |
