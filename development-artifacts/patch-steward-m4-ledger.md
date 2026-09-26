# patch-steward-m4 — Ledger

Single source of truth for execution state. Sections are owned by different agents —
the planner seeds Plan + Phases; the decomposer fills Steps per phase; the supervisor
updates Steps and appends Revisions.

## Plan

- plan-name: patch-steward-m4
- current-phase: done (phases 1-5 complete)
- working-branch: milestone/4-submission-intake-and-contract-check
- starting-commit: 8ae8c6f9b6906205a3a4c74110c30462237f5860
- default-branch: develop
- artifacts-dir: development-artifacts
- owner-gate: APPROVED 2026-09-26 (brief "Owner gate": items A, B, C, D, E exactly as proposed; I1–I26 all recommendations accepted, ADR-0061 applies; Q1 option B, base commit recorded but not hashed). Scope added: Q1 documentation changes (processes §0.1, architecture invariant 8, CLAUDE.md, whitepaper §8, user-manual overview) and ADR-0055; ADRs final ADR-0050 through ADR-0061.

## Phases

| Phase | Status  | Notes |
| ----: | ------- | ----- |
| 1     | done    | Core foundations (pure): bounds, globs, path lists and classes, Markdown scan, mapping v1 and parser, normalization and claim scope, snapshot, record keys, templates, body fixtures. Owner gate approved 2026-09-26. Completed 2026-09-26: steps 1.1-1.16 merged in 5 waves, no retries, no revisions; phase DoD re-run by the supervisor in the main tree (toolchain gate exit 0, 62 files and 1219 tests passed; lockfile and manifests unchanged since 8ae8c6f; 161 pinned titles ok; policy template valid; G5-G10 as expected). |
| 2     | done    | Adapters: GitHub reader, Git extensions, attachment fetcher and archives, GitHub policy source and default checklist, live runner (I19). Needs Phase 1. Completed 2026-09-26: steps 2.1-2.15 merged in 5 waves, no retries, no decomposer revisions; one in-flight acceptance correction (2.13 A1 duplicate-export grep counted same-file loadPolicy overloads; see Revisions). Phase DoD re-run by the supervisor in the main tree: toolchain gate exit 0 (74 files, 1419 tests); lockfile and manifests unchanged since 8ae8c6f, package.json adds only test:live; 152 pinned titles ok; live tier 9 titles ok with gh auth token; no live file in the default suite; CI, vitest.config.ts, packages/cli, conformance unchanged; G8-G11 as expected (22 fixtures/github files). |
| 3     | done    | Contract check, intake capture, fixture expectations, conformance (invariants 1, 5, 6, 8; never-pass). Needs Phase 2. Completed 2026-09-26: steps 3.1-3.16 merged in 5 waves, no retries, no decomposer revisions; one supervisor integration commit (60ef067, invariant-1 record-title assertion) and one in-flight check correction (3.16 G7 ATTACHMENT CHECK merged two -t runs so skipped overwrote passed; see Revisions). Phase DoD re-run by the supervisor in the main tree: toolchain gate exit 0 (86 files, 1677 tests); lockfile and manifests unchanged since 8ae8c6f, package.json adds only test:live; 195 pinned titles ok; 43 expectation cases ok; invariant-8, invariant-6, zero-execution ok; attachment rules ok with the corrected merge; G9-G14 as expected. |
| 4     | done    | `steward preflight` (deterministic part), auth, upstream detection, output, exit codes. Needs Phase 3. Completed 2026-09-26: steps 4.1-4.10 merged in 4 waves (W1 4.1-4.4, W2 4.5, W3 4.6-4.9, W4 gate 4.10 in the main tree), no retries, no revisions, no integration commits. Phase DoD re-run by the supervisor in the main tree: toolchain gate exit 0 (94 files, 1767 tests); lockfile and manifests unchanged since 8ae8c6f, package.json adds only test:live; phase scope only packages/cli/src and development-artifacts; steward policy files unchanged and policy-command tests pass; help lists policy and preflight, exit 0; 94 pinned cli titles ok with no non-passing cli test (incl. the sentinel-token test); zero-execution ok 2 (core and cli); no execution imports, control characters, or planning ids in cli sources; live G7 (4 commands, token from gh, no unauthenticated warning) and G8 temporary-repository script output exactly as pinned. |
| 5     | done    | ADR-0050 through ADR-0061, governing documents incl. Q1 snapshot wording, README, CLAUDE.md, user manual, full project DoD (items 1–19). Needs Phase 4. Completed 2026-09-26: steps 5.1-5.18 merged in 5 waves (W1 5.1-5.4, W2 5.5-5.9, W3 5.10-5.15, W4 5.16 in the main tree, W5 gates 5.17 in the main tree and 5.18 in a worktree), no retries, no revisions, no integration commits. Worker deviations accepted: 5.4 applied EDIT M2 and M3 as one edit (M2 replacement already omits the removed row); 5.10 collapsed a wrapped ADR-0053 Source metadata line to one line (check requires single-line metadata); 5.18 placed the check script in node_modules with the Write tool because its cp was blocked. Supervisor reviewed every new ADR and the README, CLAUDE.md, and whitepaper diffs (facts spot-checked against vitest.live.config.ts, the live tests, and templates). Phase DoD and project DoD re-run by the supervisor in the main tree: toolchain exit 0 (94 files, 1767 tests); lockfile and manifests unchanged since 8ae8c6f, package.json adds only test:live; 43 expectation cases ok; invariant-8, invariant-6, attachment rules, zero-execution ok 2, never-pass unions, templates (3, drift test, policy exit 0, 5 destinations, formats line, prettier 0); live preflight G10 exact (token from gh, no unauthenticated warning) and temporary-repository script G11 exact; 94 pinned cli titles ok; live tier 9 passed 0 other, no live file in pnpm test, workflows unchanged; 9 conformance files pass; records ok, schema_version 1; recorded-response credential check passed; docs: prettier 0, 12 ADRs and no 0062, index 61 rows, ADR-0001-0049 unchanged since 8ae8c6f, persistence baseline CLAUDE.md 2 and configuration.md 1, no planning ids in new ADRs, deferred baseline CLAUDE.md 3 and README.md 1 (new DF line only in ADR-0057), length wording baseline 3, commands.md headings and 4 proposed rows, NEEDS INPUT configuration.md 5 and usage.md 2, snapshot wording 0 old and 1 new at all five sites plus ADR-0055 chosen option, `all ok`, links checked=613 broken=0, phase scope docs-only, no control characters. |

## Pipeline rules (from earlier milestones; binding for every agent in this plan)

- Every `decomposer`, `worker`, and `planner` invocation runs in the FOREGROUND (`run_in_background: false`). A parallel wave is
  several foreground Agent calls in ONE message. A supervisor that backgrounds workers is force-handed back and loses results.
- Never put a pipe character inside a ledger table cell (it breaks the columns); write "or" instead. Never write raw control
  characters (NUL, ESC, and so on) into any artifact; write escapes such as backslash-u-0000.
- Phase gates and the project DoD run in the MAIN tree (repo root); long git-worktree paths break `pnpm test`. Worker worktrees
  use short paths such as `C:/Users/John/Projects/steady-orchard/m4-w<id>`; delete leftover `node_modules` after
  `git worktree remove` on Windows.
- Before a wide wave, run `pnpm install --frozen-lockfile` in each new worktree sequentially (pnpm store contention on Windows).
- `core.autocrlf=true`: compare committed bytes with `git show HEAD:<path>`; never assert hashes of working-tree fixture bytes.
- Every Prettier-checked file a step writes (templates, fixtures `.yml`/`.json`/`.md`, docs, README, CLAUDE.md) is Prettier-clean
  at commit; byte-exact fixtures use `.txt`. Never run a formatter on anything under `development-artifacts/`.
- `.gitignore` swallows `*.log`, `*.tgz`, `.env*`, `out`, `logs`, `dist`: never name a committed file that way.
- Acceptance checks that grep for substrings the mandated text itself contains, or count diff hunks, are mis-specified; literal
  grep on prose must tolerate or pin Prettier line wraps; it.each titles are checked as rendered titles (Vitest JSON reporter).
- A step that removes or renames a heading must not require link integrity of files owned by a later step.
- The Vitest alias maps `@patch-steward/core` to `packages/core/src/index.ts` exactly: cli code and tests import only the root.
- GitHub access is read-only everywhere; unit and fixture tests use recorded responses; live reads only in `*.live.test.ts`
  under the live runner (I19) or in DoD live commands.
- Persistent files (`docs/` except the two plan documents, README.md, CLAUDE.md, `fixtures/`, `templates/`) never cite planning
  artifacts or their ids.

## Steps

<!-- decomposer fills per phase: id | phase | status | files | commit,
     plus a "Phase <N> notes" block: dependency graph, couplings, emergent contracts -->

| id | phase | status | files | commit |
| --- | --- | --- | --- | --- |
| 1.1 | 1 | done | packages/core/src/policy/bounds.ts, packages/core/src/policy/bounds.test.ts, development-artifacts/patch-steward-m4-1.1-report.md | 1206194 |
| 1.2 | 1 | done | packages/core/src/submission/globs.ts, packages/core/src/submission/globs.test.ts, development-artifacts/patch-steward-m4-1.2-report.md | b581119 |
| 1.3 | 1 | done | packages/core/src/submission/path-lists.ts, packages/core/src/submission/path-lists.test.ts, development-artifacts/patch-steward-m4-1.3-report.md | 9a761d2 |
| 1.4 | 1 | done | packages/core/src/submission/field-mapping.ts, packages/core/src/submission/field-mapping.test.ts, development-artifacts/patch-steward-m4-1.4-report.md | a068dc4 |
| 1.5 | 1 | done | packages/core/src/submission/normalize.ts, packages/core/src/submission/normalize.test.ts, development-artifacts/patch-steward-m4-1.5-report.md | 43d474d |
| 1.6 | 1 | done | packages/core/src/submission/markdown-scan.ts, packages/core/src/submission/markdown-scan.test.ts, development-artifacts/patch-steward-m4-1.6-report.md | e53e343 |
| 1.7 | 1 | done | packages/core/src/submission/parse.ts, packages/core/src/submission/parse.test.ts, development-artifacts/patch-steward-m4-1.7-report.md | 558da80 |
| 1.8 | 1 | done | packages/core/src/submission/field-values.ts, packages/core/src/submission/field-values.test.ts, development-artifacts/patch-steward-m4-1.8-report.md | 1c602b4 |
| 1.9 | 1 | done | packages/core/src/submission/paths.ts, packages/core/src/submission/paths.test.ts, development-artifacts/patch-steward-m4-1.9-report.md | d53c21a |
| 1.10 | 1 | done | packages/core/src/submission/snapshot.ts, packages/core/src/submission/snapshot.test.ts, development-artifacts/patch-steward-m4-1.10-report.md | 2826132 |
| 1.11 | 1 | done | packages/core/src/records/submission.ts, packages/core/src/records/submission.test.ts, development-artifacts/patch-steward-m4-1.11-report.md | e7f734b |
| 1.12 | 1 | done | templates/issue-forms/steward-defect.yml, templates/issue-forms/steward-proposal.yml, templates/pull-request/pull_request_template.md, templates/policy/policy.yml, templates/README.md, packages/core/src/submission/template-drift.test.ts, development-artifacts/patch-steward-m4-1.12-report.md | ee790fd |
| 1.13 | 1 | done | fixtures/submissions/defect-complete.txt, fixtures/submissions/defect-no-response.txt, fixtures/submissions/defect-duplicate-label.txt, fixtures/submissions/defect-label-in-fence.txt, fixtures/submissions/defect-headings-in-comment.txt, fixtures/submissions/defect-deleted-label.txt, fixtures/submissions/defect-severity.txt, fixtures/submissions/defect-injection.txt, fixtures/submissions/defect-security-checked.txt, fixtures/submissions/defect-security-unchecked.txt, fixtures/submissions/proposal-complete.txt, fixtures/submissions/proposal-missing-benefit.txt, fixtures/submissions/unstructured.txt, fixtures/README.md, packages/core/src/submission/issue-bodies.fixture.test.ts, development-artifacts/patch-steward-m4-1.13-report.md | f94ab5b |
| 1.14 | 1 | done | fixtures/submissions/pr-bugfix-complete.txt, fixtures/submissions/pr-missing-marker.txt, fixtures/submissions/pr-duplicate-heading.txt, fixtures/submissions/pr-unknown-section.txt, fixtures/submissions/pr-category-missing.txt, fixtures/submissions/pr-category-invalid.txt, fixtures/submissions/pr-category-several.txt, fixtures/submissions/pr-docs.txt, fixtures/submissions/pr-chore.txt, fixtures/submissions/pr-linked-issue-missing.txt, fixtures/submissions/pr-linked-issue-cross-repository.txt, fixtures/submissions/pr-linked-issue-several.txt, fixtures/submissions/pr-attachment-count.txt, fixtures/submissions/pr-attachment-format.txt, fixtures/submissions/pr-attachment-destination.txt, fixtures/submissions/pr-attachment-scheme.txt, packages/core/src/submission/pull-request-bodies.fixture.test.ts, development-artifacts/patch-steward-m4-1.14-report.md | 482517d |
| 1.15 | 1 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, development-artifacts/patch-steward-m4-1.15-report.md | f7d07f0 |
| 1.16 | 1 | done | development-artifacts/patch-steward-m4-1.16-report.md | bdca711 |
| 2.1 | 2 | done | packages/core/src/github/budget.ts, packages/core/src/github/client.ts, packages/core/src/github/client.test.ts, development-artifacts/patch-steward-m4-2.1-report.md | 5bc4661 |
| 2.2 | 2 | done | packages/core/src/git/command.ts, packages/core/src/git/diff.ts, packages/core/src/git/diff.test.ts, development-artifacts/patch-steward-m4-2.2-report.md | c978878 |
| 2.3 | 2 | done | packages/core/src/net/address-policy.ts, packages/core/src/net/address-policy.test.ts, development-artifacts/patch-steward-m4-2.3-report.md | eb7b940 |
| 2.4 | 2 | done | packages/core/src/net/archive.ts, packages/core/src/net/archive.test.ts, development-artifacts/patch-steward-m4-2.4-report.md | df89b3f |
| 2.5 | 2 | done | packages/core/src/submission/default-checklist.ts, packages/core/src/submission/default-checklist.test.ts, development-artifacts/patch-steward-m4-2.5-report.md | 840ac54 |
| 2.6 | 2 | done | vitest.live.config.ts, package.json, development-artifacts/patch-steward-m4-2.6-report.md | 9fbe13b |
| 2.7 | 2 | done | packages/core/src/github/schemas.ts, packages/core/src/github/reader.ts, packages/core/src/github/reader.test.ts, development-artifacts/patch-steward-m4-2.7-report.md | a74d892 |
| 2.8 | 2 | done | packages/core/src/git/remotes.ts, packages/core/src/git/remotes.test.ts, development-artifacts/patch-steward-m4-2.8-report.md | 925f91f |
| 2.9 | 2 | done | packages/core/src/net/attachment-fetch.ts, packages/core/src/net/attachment-fetch.test.ts, development-artifacts/patch-steward-m4-2.9-report.md | ac3eb05 |
| 2.10 | 2 | done | packages/core/src/policy/loader.ts, packages/core/src/policy/loader-github.test.ts, packages/core/src/policy/loader-github.fixture.test.ts, fixtures/github/policy-directory/ref-heads-main.json, fixtures/github/policy-directory/contents-github.json, fixtures/github/policy-directory/contents-github-without-policy.json, fixtures/github/policy-directory/tree.json, fixtures/github/policy-directory/blob-policy.json, development-artifacts/patch-steward-m4-2.10-report.md | 21de909 |
| 2.11 | 2 | done | fixtures/github/testbed/repository.json, fixtures/github/testbed/issue-29.json, fixtures/github/testbed/issue-30.json, fixtures/github/testbed/issue-26-pull-request.json, fixtures/github/testbed/pull-26.json, fixtures/github/testbed/pull-27.json, fixtures/github/testbed/pull-28.json, fixtures/github/testbed/pull-26-files.json, fixtures/github/testbed/pull-27-files.json, fixtures/github/testbed/pull-28-files.json, fixtures/github/testbed/commit-pulls-b46eef5.json, fixtures/github/testbed/ref-heads-master.json, fixtures/github/testbed/contents-github.json, fixtures/github/testbed/issue-comment-5825050006.json, fixtures/github/hostile/repository-missing-default-branch.json, fixtures/github/hostile/pull-request-wrong-types.json, fixtures/github/hostile/pull-request-files-unknown-status.json, fixtures/README.md, packages/core/src/github/recorded-responses.fixture.test.ts, development-artifacts/patch-steward-m4-2.11-report.md | 37f023a |
| 2.12 | 2 | done | packages/core/src/net/https-transport.ts, packages/core/src/net/https-transport.test.ts, development-artifacts/patch-steward-m4-2.12-report.md | cf5fff0 |
| 2.13 | 2 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, development-artifacts/patch-steward-m4-2.13-report.md | db26fed |
| 2.14 | 2 | done | packages/core/src/github/github.live.test.ts, packages/core/src/net/attachment-fetch.live.test.ts, development-artifacts/patch-steward-m4-2.14-report.md | 931f085 |
| 2.15 | 2 | done | development-artifacts/patch-steward-m4-2.15-report.md | 7dab9fb |
| 3.1 | 3 | done | packages/core/src/submission/attachments.ts, packages/core/src/submission/attachments.test.ts, development-artifacts/patch-steward-m4-3.1-report.md | 0be0039 |
| 3.2 | 3 | done | packages/core/src/submission/proposed-policy.ts, packages/core/src/submission/proposed-policy.test.ts, development-artifacts/patch-steward-m4-3.2-report.md | cdf94d5 |
| 3.3 | 3 | done | fixtures/submissions/diffs/code.json, fixtures/submissions/diffs/docs-only.json, fixtures/submissions/diffs/docs-with-code.json, fixtures/submissions/diffs/rename-code-to-docs.json, fixtures/submissions/diffs/package-json.json, fixtures/submissions/diffs/workflow.json, fixtures/submissions/diffs/policy-file.json, fixtures/submissions/diffs/policy-file-deleted.json, fixtures/submissions/proposed-policy-valid.yml, fixtures/submissions/proposed-policy-invalid.txt, fixtures/README.md, development-artifacts/patch-steward-m4-3.3-report.md | 425cea9 |
| 3.4 | 3 | done | packages/core/src/conformance/invariant-8.test.ts, development-artifacts/patch-steward-m4-3.4-report.md | 30f3ecd |
| 3.5 | 3 | done | packages/core/src/conformance/never-pass.test.ts, development-artifacts/patch-steward-m4-3.5-report.md | bc15a84 |
| 3.6 | 3 | done | packages/core/src/submission/attachment-fetching.ts, packages/core/src/submission/attachment-fetching.test.ts, development-artifacts/patch-steward-m4-3.6-report.md | 8de7864 |
| 3.7 | 3 | done | packages/core/src/submission/contract.ts, packages/core/src/submission/contract.test.ts, development-artifacts/patch-steward-m4-3.7-report.md | 9c41ef5 |
| 3.8 | 3 | done | packages/core/src/submission/intake.ts, packages/core/src/submission/intake.test.ts, development-artifacts/patch-steward-m4-3.8-report.md | 31320fa |
| 3.9 | 3 | done | fixtures/submissions/expectations.json, packages/core/src/submission/contract-expectations.fixture.test.ts, development-artifacts/patch-steward-m4-3.9-report.md | 8e0224d |
| 3.10 | 3 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, packages/core/src/conformance/invariant-5.test.ts, development-artifacts/patch-steward-m4-3.10-report.md | ac826fc |
| 3.11 | 3 | done | packages/core/src/submission/intake.fixture.test.ts, development-artifacts/patch-steward-m4-3.11-report.md | 650d0a6 |
| 3.12 | 3 | done | packages/core/src/conformance/invariant-6.test.ts, development-artifacts/patch-steward-m4-3.12-report.md | 446bcfc |
| 3.13 | 3 | done | packages/core/src/conformance/invariant-1.test.ts, development-artifacts/patch-steward-m4-3.13-report.md | a0f38dd |
| 3.14 | 3 | done | packages/core/src/conformance/never-pass-submission.test.ts, development-artifacts/patch-steward-m4-3.14-report.md | 7720ae1 |
| 3.15 | 3 | done | packages/core/src/conformance/zero-execution.fixture.test.ts, development-artifacts/patch-steward-m4-3.15-report.md | 54aa4b7 |
| 3.16 | 3 | done | development-artifacts/patch-steward-m4-3.16-report.md | dbcd29c |
| 4.1 | 4 | done | packages/cli/src/github-auth.ts, packages/cli/src/github-auth.test.ts, development-artifacts/patch-steward-m4-4.1-report.md | ee01396 |
| 4.2 | 4 | done | packages/cli/src/preflight-args.ts, packages/cli/src/preflight-args.test.ts, development-artifacts/patch-steward-m4-4.2-report.md | 10454ee |
| 4.3 | 4 | done | packages/cli/src/preflight-output.ts, packages/cli/src/preflight-output.test.ts, development-artifacts/patch-steward-m4-4.3-report.md | d478de5 |
| 4.4 | 4 | done | packages/cli/src/preflight-draft.ts, packages/cli/src/preflight-draft.test.ts, development-artifacts/patch-steward-m4-4.4-report.md | 5cbb3e1 |
| 4.5 | 4 | done | packages/cli/src/preflight-command.ts, packages/cli/src/preflight-command.test.ts, development-artifacts/patch-steward-m4-4.5-report.md | c30ce4c |
| 4.6 | 4 | done | packages/cli/src/cli.ts, packages/cli/src/index.ts, packages/cli/src/index.test.ts, development-artifacts/patch-steward-m4-4.6-report.md | 29bc695 |
| 4.7 | 4 | done | packages/cli/src/preflight-command.fixture.test.ts, development-artifacts/patch-steward-m4-4.7-report.md | 9704353 |
| 4.8 | 4 | done | packages/cli/src/preflight-zero-execution.fixture.test.ts, development-artifacts/patch-steward-m4-4.8-report.md | dca89c5 |
| 4.9 | 4 | done | packages/cli/src/preflight-never-pass.fixture.test.ts, development-artifacts/patch-steward-m4-4.9-report.md | fcd6469 |
| 4.10 | 4 | done | development-artifacts/patch-steward-m4-4.10-report.md | d128f2e |
| 5.1 | 5 | done | docs/architecture.md, development-artifacts/patch-steward-m4-5.1-report.md | 685c073 |
| 5.2 | 5 | done | docs/processes.md, development-artifacts/patch-steward-m4-5.2-report.md | 3404491 |
| 5.3 | 5 | done | docs/user-manual/configuration.md, development-artifacts/patch-steward-m4-5.3-report.md | dce192c |
| 5.4 | 5 | done | docs/user-manual/commands.md, development-artifacts/patch-steward-m4-5.4-report.md | e45e3c6 |
| 5.5 | 5 | done | docs/architecture.md, development-artifacts/patch-steward-m4-5.5-report.md | 099f756 |
| 5.6 | 5 | done | docs/processes.md, development-artifacts/patch-steward-m4-5.6-report.md | 31e3db9 |
| 5.7 | 5 | done | docs/user-manual/configuration.md, development-artifacts/patch-steward-m4-5.7-report.md | cc72f44 |
| 5.8 | 5 | done | docs/user-manual/usage.md, development-artifacts/patch-steward-m4-5.8-report.md | 7d68d9a |
| 5.9 | 5 | done | docs/user-manual/troubleshooting.md, docs/user-manual/overview.md, docs/user-manual/installation.md, development-artifacts/patch-steward-m4-5.9-report.md | d38711e |
| 5.10 | 5 | done | docs/adr/0050-versioned-field-mapping.md, docs/adr/0051-one-glob-syntax.md, docs/adr/0052-built-in-path-classes.md, docs/adr/0053-built-in-trusted-and-execution-sensitive-paths.md, development-artifacts/patch-steward-m4-5.10-report.md | 2d85a4e |
| 5.11 | 5 | done | docs/adr/0054-attachment-destinations-formats-and-fetching.md, docs/adr/0055-snapshot-composition-and-hashing.md, docs/adr/0056-canonical-claim-scope-text.md, docs/adr/0057-deterministic-contract-result.md, development-artifacts/patch-steward-m4-5.11-report.md | 96b1eea |
| 5.12 | 5 | done | docs/adr/0058-github-read-adapter-without-sdk.md, docs/adr/0059-cli-github-authentication.md, docs/adr/0060-steward-preflight-command.md, docs/adr/0061-live-probe-test-runner.md, development-artifacts/patch-steward-m4-5.12-report.md | 79b442a |
| 5.13 | 5 | done | docs/whitepaper.md, development-artifacts/patch-steward-m4-5.13-report.md | d630918 |
| 5.14 | 5 | done | README.md, CLAUDE.md, development-artifacts/patch-steward-m4-5.14-report.md | d80ab7b |
| 5.15 | 5 | done | docs/user-manual/README.md, development-artifacts/patch-steward-m4-5.15-report.md | e3b3537 |
| 5.16 | 5 | done | docs/adr/README.md, development-artifacts/patch-steward-m4-5.16-report.md | 178d39c |
| 5.17 | 5 | done | development-artifacts/patch-steward-m4-5.17-report.md | bd8abf5 |
| 5.18 | 5 | done | development-artifacts/patch-steward-m4-5.18-report.md | 482c719 |

### Phase 1 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m4): phase 1 steps`), base 05dddcc. No
  brief amendment. No new dependency; no network; no GitHub access.
- Dependency graph (scopes pairwise disjoint among steps that can run together; merge order within a wave is free):
  - W1 (parallel, no deps): 1.1 bounds; 1.2 glob matcher; 1.3 path lists; 1.4 field mapping; 1.5 normalization and claim
    scope; 1.6 Markdown scanner.
  - W2 (parallel): 1.7 parser (1.1, 1.4, 1.5, 1.6); 1.8 category and linked-issue values (1.5); 1.9 path classes and flags
    (1.2, 1.3); 1.10 snapshot (1.1). 1.8 may start once 1.5 is merged, 1.9 once 1.2 and 1.3, 1.10 once 1.1.
  - W3 (parallel): 1.11 record keys (1.1, 1.4, 1.10); 1.12 templates and drift test (1.4, 1.7); 1.13 issue bodies and
    fixtures/README.md (1.7); 1.14 PR bodies (1.7, 1.8).
  - W4: 1.15 package-root re-exports (all of 1.1-1.14). W5: 1.16 gate (verification only; MAIN tree).
  - Critical paths: 1.4/1.5/1.6 -> 1.7 -> 1.12/1.13/1.14 -> 1.15 -> 1.16 and 1.1 -> 1.10 -> 1.11 -> 1.15 -> 1.16.
- Environment / bootstrap:
  - Short worker worktree paths (C:/Users/John/Projects/steady-orchard/m4-w<id>); every step runs Vitest. Run
    `pnpm install --frozen-lockfile` per new worktree, sequentially. Worktrees base on a HEAD containing every dependency.
  - Every acceptance writes Vitest JSON to node_modules/.m4-p1-<id>.json (ignored; not a tree change) and checks rendered
    titles with node (jq is not installed).
  - 1.12 runs `pnpm build` (the CLI check executes packages/cli/dist) and full `pnpm test`; 1.15 runs build, typecheck, and
    full test. 1.16 runs IN the main tree after 1.1-1.15 are merged and the tree is clean.
  - Workers run Prettier only on their own product files, never on development-artifacts/. Byte-exact bodies are .txt.
- Couplings:
  - 1.12 pins committed template bytes by sha256 of CR-stripped text (defect d106c4ec..., proposal 795501be..., PR template
    915dda2f..., policy.yml 0a4f9cef...); 1.13 pins defect-complete (bce73638...) and proposal-complete (1e17ef55...); 1.14
    pins pr-bugfix-complete (34c1ec80...). All were Prettier-checked (templates) and parsed by a reference implementation
    of the pinned rules at decomposition.
  - 1.13 owns fixtures/README.md and describes the whole submissions/ directory generically (no names or counts), so 1.14
    and later phases can add files without editing it; Phase 3 adds diffs and expectations and may extend the README.
  - 1.15 adds nine `export *` lines; every exported name is pinned in the step files and verified unique against the
    existing core exports (TS2308 would be a decomposition bug).
  - 1.16 checks 161 rendered titles pinned in 1.1-1.15 (Vitest JSON reporter) plus the phase DoD commands.
  - The default checklist of Phase 2 embeds the resolved policy template; 1.12 changes its attachment destinations and
    formats, so the Phase 2 drift test must read the template after 1.12.
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed):
  - Tie-break when an issue body matches both forms: defect is tried before proposal (the brief orders versions within a
    form, not forms).
  - Field normalization order: CRLF then lone CR to LF; HTML comments removed textually everywhere, including inside code
    fences (search for the closing marker starts 4 characters after the opening); NFC; trailing U+0020 and U+0009 trimmed
    per line; leading and trailing empty lines removed. Comments are removed before NFC because NFC can compose '>' with a
    following combining mark. Triviality compares the normalized text exactly (case-insensitive), so a leading space keeps
    a value non-trivial.
  - Scanner: lines split on CRLF, LF, lone CR with terminators kept (raw values are byte-verbatim); fences allow 0-3 spaces
    of indentation, a backtick info string must not contain a backtick, the opening line is fence context, a closing fence
    uses the same character with at least the same length and only trailing spaces or tabs; a line that starts inside an
    open comment is comment context; headings need exactly N '#' plus U+0020 at column 0, text trimmed at the end.
  - Blank line (for value trimming) = empty or only spaces and tabs. securityClaim is null when the Security claim field is
    absent or duplicated.
  - Body input failures: `submission.body-too-large` (over 65536 UTF-16 code units) and `submission.body-malformed` (not
    well-formed Unicode), both cause `github-unavailable`, outcome inconclusive.
  - Linked-issue value: fixed regexes; cross-repository is checked before several; the one-reference form must match the
    whole value after one optional closing keyword (optional colon), so trailing text such as a period or "see" makes it
    unreadable; numbers are 1-10 digits without a leading zero; repository comparison is case-insensitive.
  - Category value: normalized and trimmed; one optional backtick pair; any internal whitespace makes it invalid.
  - Path change kinds: added, modified, deleted, renamed, copied, type-changed; renamed and copied contribute previousPath.
    Project additions never change path classes.
  - Snapshot: policy_revision must be a git tree id (40 or 64 hex; a local file revision is rejected); attachment url is an
    ASCII `https://` string of at most 2048 characters (callers store the WHATWG URL href); lists are schema-enforced in
    canonical order (attachments by url, responses by request id then comment id, linked issues by repository then
    number, shared heads ascending without the PR's own number); linked_issues at most 1; failures `snapshot.invalid`,
    cause `steward-defect`. Golden hashes: PR sha256:c51c7fb2..., issue sha256:a81a207e... (computed with an independent
    RFC 8785 serializer).
  - Record keys: template is nullable, snapshot optional only, policy_change optional (proposed null exactly when changed is
    false), attachments optional, claim_scope_hash nullable; couplings: snapshot type, repository, number, target branch
    and head commit agree with the record, and snapshot_hash equals the snapshot's hash; template form agrees with type or
    issue kind; issues carry no policy_change and no non-null claim_scope_hash.
  - Issue forms are named `Defect report` and `Change proposal`; the drift test checks forms against the mapping and the
    policy template's issue field lists.
- Emergent contracts for Phases 2-5 (exported from the core root by 1.15):
  - Bounds: SUBMISSION_TEXT_MAX_LENGTH, PREFLIGHT_DRAFT_MAX_BYTES, SUBMISSION_TITLE_MAX_LENGTH, CHANGED_PATHS_MAX,
    CHANGED_PATH_MAX_BYTES, GITHUB_RESPONSE_MAX_BYTES, GITHUB_REQUEST_TIMEOUT_MS, GITHUB_PAGE_SIZE, GITHUB_PAGES_MAX,
    GITHUB_RETRY_WAIT_MAX_SECONDS, PREFLIGHT_GITHUB_REQUESTS_MAX, PREFLIGHT_GITHUB_RETRIES_MAX, SHARED_HEAD_PULL_REQUESTS_MAX,
    ATTACHMENT_URL_MAX_LENGTH, ARCHIVE_ENTRIES_MAX, ARCHIVE_ENTRY_NAME_MAX_BYTES, GH_AUTH_TOKEN_TIMEOUT_MS,
    GH_AUTH_TOKEN_OUTPUT_MAX_BYTES, LINKED_ISSUES_PER_PULL_REQUEST, AUTHOR_RESPONSES_MAX (docs name these in architecture
    §12.1 in Phase 5).
  - Paths: `PathChange { kind, path, previousPath }`; Phase 2 maps GitHub PR-file statuses (added, removed -> deleted,
    modified, renamed, copied, changed -> type-changed or modified as the adapter decides and documents, unchanged ->
    omitted) and git name-status letters (A, M, D, R, C, T) onto PATH_CHANGE_KINDS; then changedPathSet, classifyPath,
    consistentCategories, detectPathFlags(paths, { trusted, executionSensitive }) with the policy's
    `trusted_paths.additional` and `execution_sensitive_paths.additional`; matchesGlob is the one glob matcher for later
    policy globs.
  - Parsing: parseIssueBody / parsePullRequestBody (body null -> ''), results { structured, template { form, version },
    fields { id: { raw, normalized, trivial } }, duplicates, securityClaim } or { structured: false, reason };
    parseCategoryValue, parseLinkedIssueValue(raw, 'owner/name'); computeClaimScope(ClaimScopeInput); preflight (Phase 4)
    checks `--issue <kind>` against template.form.
  - Snapshot: buildIssueSnapshot / buildPullRequestSnapshot (camelCase inputs incl. title, which is ignored), snapshotHash;
    Phase 3 invariant-8 titles come from the brief; the record's snapshot_hash must equal snapshotHash(snapshot).
  - New failure-code unions for the Phase 3 never-pass tables: BodyParseFailureCode (`submission.body-too-large`,
    `submission.body-malformed`) and SnapshotFailureCode (`snapshot.invalid` plus canonical-JSON codes).
  - Templates: templates/issue-forms/steward-defect.yml, templates/issue-forms/steward-proposal.yml,
    templates/pull-request/pull_request_template.md; INSTALLED_TEMPLATE_PATHS gives the installed paths used for the
    template links in requests.
  - Fixture names for Phase 3 expectations and Phase 4 live commands: complete defect draft
    fixtures/submissions/defect-complete.txt; draft missing a field fixtures/submissions/defect-no-response.txt; complete
    bugfix PR draft linking #29 fixtures/submissions/pr-bugfix-complete.txt; docs draft fixtures/submissions/pr-docs.txt;
    chore body fixtures/submissions/pr-chore.txt (for package.json, workflow, and policy-directory diffs);
    pr-attachment-destination.txt uses a legacy image host that the default destinations allow, so its destination
    violation needs a policy variant without that host.

### Phase 2 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m4): phase 2 steps`), phase base
  11d147d. No brief amendment. No new dependency; packages/cli untouched; GitHub access read-only.
- Dependency graph (scopes pairwise disjoint among steps that can run together; merge order within a wave is free):
  - W1 (parallel, no deps): 2.1 GitHub client and budget; 2.2 git command helper and diff reads; 2.3 address policy;
    2.4 archive inspector; 2.5 default checklist; 2.6 live runner config and test:live script.
  - W2 (parallel): 2.7 schemas and reads (2.1); 2.8 remotes (2.2); 2.9 attachment fetcher (2.3).
  - W3 (parallel): 2.10 GitHub policy source plus policy-directory fixtures (2.1, 2.7); 2.11 test-bed recordings, hostile
    variants, fixtures/README.md (2.1, 2.7); 2.12 https transport and system resolver (2.9).
  - W4 (parallel): 2.13 package-root re-exports (2.1-2.5, 2.7-2.10, 2.12); 2.14 live tests (2.1, 2.6, 2.7, 2.9, 2.10,
    2.12; they import relative modules, not the root). W5: 2.15 gate (verification only; MAIN tree; needs network).
  - Critical path: 2.1 -> 2.7 -> 2.10 -> 2.13/2.14 -> 2.15 (also 2.3 -> 2.9 -> 2.12 -> 2.13/2.14).
- Environment / bootstrap:
  - Short worker worktree paths (C:/Users/John/Projects/steady-orchard/m4-w<id>); `pnpm install --frozen-lockfile` per new
    worktree, sequentially. Acceptance writes Vitest JSON to node_modules/.m4-p2-<id>.json and checks rendered titles.
  - Network is needed only by 2.11 (records with `gh api`, GET only), 2.14 (`GH_TOKEN=$(gh auth token) pnpm test:live`),
    and gate G4. Every unit and fixture test is offline (fake fetch, fake resolver and transport, local 127.0.0.1 sockets,
    temp git repos with GIT_CONFIG_NOSYSTEM=1 and an empty GIT_CONFIG_GLOBAL).
  - 2.5 builds core and runs a generator under node_modules/ (ignored) to emit the resolved template literal; 2.10 and
    2.11 run throwaway scripts under node_modules/ too. Workers never run a formatter on development-artifacts/.
  - 2.10, 2.11, 2.13 run the full `pnpm test`; 2.10 and 2.13 run `pnpm build`.
- Couplings:
  - 2.10 keeps `PolicyLoadFailureCode` unchanged by adding loadPolicy overloads (git or file source -> old union; any
    source -> GitHubPolicyLoadFailureCode), so cli FAILURE_EXIT_CODES still compiles (gate G7: packages/cli unchanged).
  - `GitFailureCode` is unchanged (the new 'git.no-merge-base' lives in MergeBaseFailureCode), so the never-pass TRIGGERS
    table still compiles. No Phase 2 root export starts with load, validate, or resolve, so the invariant-5 pinned list is
    unchanged (gate G12: conformance files unchanged).
  - 2.11's README text names github/policy-directory/ (created by 2.10) as a copy of policies/valid/minimal-no-llm.yml;
    2.11's credential test walks all of fixtures/github/, including 2.10's files after merge (both verified clean).
  - Recorded test-bed responses: every `description` string containing 'M02' (the test-bed repository description) is
    replaced with neutral text to satisfy the persistence rule; the scrubbed recording was dry-run at decomposition (14
    files, no persistence or control-character match, no credential-detector match).
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed):
  - GitHub failure codes (17, GITHUB_FAILURE_CODES): network, timeout, server-error, rate-limited, unauthorized,
    not-found, unexpected-status, response-too-large, malformed-response, schema-mismatch, pagination-exceeded,
    pagination-invalid, budget-exhausted, invalid-request, not-an-issue, not-a-directory, blob-too-large. Causes:
    rate-limited -> rate-limited; budget-exhausted -> budget-exhausted; invalid-request -> steward-defect; all others ->
    github-unavailable.
  - Client: headers accept, x-github-api-version 2022-11-28, user-agent patch-steward, authorization Bearer only with a
    token; redirects not followed (3xx -> unexpected-status); timeouts not retried; 5xx and network errors retried with
    1000 ms times the retry number; rate-limit waits honored up to 60 s (retry-after seconds, else x-ratelimit-reset when
    remaining is 0, else 60 s for a bare 429); a 403 without rate-limit indication is unauthorized; every attempt and page
    is charged to the budget; per_page 100; Link next URLs must stay on https://api.github.com.
  - Reads: GitHub file status changed -> type-changed, unchanged omitted. A PR file listing is too-large when
    changed_files > 3000, the listing length differs from changed_files, pages exceed 30, or a path exceeds 4096 bytes. A
    git diff is too-large over 3000 changes, a path over 4096 bytes, or output over the caller's cap (GIT_OUTPUT_MAX_BYTES).
    Open PRs for a commit: one page of 100; a next link is an unavailable read.
  - Policy source: `{ kind: 'github', client, repository, branch }` (a branch, resolved with git/ref/heads/<branch>);
    revision kind git-tree { id: tree sha, commit, ref: branch }, authoritative true; codes
    GITHUB_POLICY_SOURCE_FAILURE_CODES (not-published for an absent .github, patch-steward entry, or policy.yml;
    not-a-directory; tree-truncated; entry-not-regular; blob-too-large with cause policy-invalid).
  - Upstream remote: the first of `upstream`, `origin` whose URL is a GitHub URL; remote URLs never enter messages.
  - Attachment fetch: explicit port or an unparseable or over-long first URL -> violation destination; a bad redirect
    Location -> unavailable redirect-invalid; per-body limit min(file_bytes, remaining total); a transport throw ->
    network; a resolver throw -> dns. The real transport honors a URL port only so tests can reach local sockets.
  - Archive: rule decompressed-bytes for reason decompressed-bytes, else archive; gzip entry name supplied by the caller.
- Emergent contracts for Phases 3-5 (exported from the core root by 2.13):
  - GitHub: createGitHubClient({ token, budget, fetch?, timeoutMs?, sleep?, now? }); githubBudgetForPolicy(policy) for
    screening, githubBudgetForPreflight() before a policy is known; reads readRepository, readIssue, readPullRequest,
    readPullRequestFiles(client, repo, n, changedFiles), readOpenPullRequestsForCommit (includes the PR itself; the caller
    excludes its own number), readIssueComment, readDirectoryEntries, readGitTree, readGitBlob, readBranchHead;
    repositoryRefFromFullName for `--repo`. Author identity is in results as `author` and must not enter contract inputs.
  - Too-large diffs from either adapter (GitHubChangedPaths or GitChangedPaths kind 'too-large') map to
    submission.diff-too-large with trusted and execution-sensitive flags set to true.
  - Git: findMergeBase(options, a, b) (ids only; 'git.no-merge-base'), listChangedPaths(options, from, to),
    countCommitParents; findUpstreamRemote -> { remote, owner, name } or null; preflight's base default is
    refs/remotes/<remote>/<default branch> resolved with resolveCommit.
  - Policy: loadPolicy with a GitHub source; 'policy-source.not-published' -> DEFAULT_CHECKLIST_POLICY in preflight; every
    other failure (including an invalid published policy) -> exit 2. Phase 4 maps these codes itself (cli
    FAILURE_EXIT_CODES covers only PolicyLoadFailureCode).
  - Attachments: fetchAttachment(url, { destinations, maxRedirects, timeoutMs = fetch_seconds * 1000, maxFileBytes,
    remainingTotalBytes, resolver: systemAttachmentResolver, transport: httpsAttachmentTransport }) -> fetched, violation
    (rule in ATTACHMENT_VIOLATION_RULES), or unavailable (reason in ATTACHMENT_UNAVAILABLE_REASONS); Phase 3 maps
    unavailable to cause attachment-fetch-failed for a required attachment and advisory submission.attachment-unavailable
    otherwise, and adds count and format rules (format from the final URL for extensionless URLs). inspectZipArchive and
    inspectGzipArchive take limits.attachments.decompressed_bytes; gz entry name = attachment file name without `.gz`.
  - Never-pass unions for Phase 3: GITHUB_FAILURE_CODES, MergeBaseFailureCode ('git.no-merge-base'),
    GITHUB_POLICY_SOURCE_FAILURE_CODES; attachment outcomes are data, not failures.
  - 'attachment rule:' titles delivered (for the project DoD attachment check): destination, scheme, userinfo, private
    address (IPv4, IPv6, resolved), redirect count, redirect to unapproved host, fetch time, file bytes, total bytes,
    decompressed bytes (zip, gzip), archive structure, no credentials (fetcher and transport), hash before handoff,
    validated connection address. Phase 3 adds count, format, and the required and optional fetch-failure mapping titles.

### Phase 3 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m4): phase 3 steps`), phase base
  252845f. No brief amendment. No new dependency; packages/cli, templates, docs, CI, and Vitest configs untouched; no
  GitHub access (every test offline).
- Dependency graph (scopes pairwise disjoint among steps that can run together; merge order within a wave is free):
  - W1 (parallel, no deps): 3.1 attachments (pure extraction, required-ness, static rules); 3.2 proposed policy (bytes,
    GitHub, git); 3.3 diff and proposed-policy fixtures plus fixtures/README.md; 3.4 invariant-8; 3.5 never-pass table
    gains GitHubFailureCode, MergeBaseFailureCode, GitHubPolicySourceFailureCode, BodyParseFailureCode, SnapshotFailureCode.
  - W2 (parallel): 3.6 attachment fetching (3.1); 3.7 contract (3.1, 3.2).
  - W3 (parallel): 3.8 intake capture and record builder (3.1, 3.2, 3.6, 3.7); 3.9 expectations.json and its fixture
    test (3.1, 3.2, 3.3, 3.7).
  - W4 (parallel): 3.10 root re-exports, exports test, invariant-5 extension (3.1, 3.2, 3.6, 3.7, 3.8); 3.11 capture on
    recorded responses (3.8); 3.12 invariant-6 (3.7, 3.8); 3.13 invariant-1 (3.1, 3.7, 3.8); 3.14 never-pass-submission
    (3.1, 3.7, 3.8); 3.15 zero-execution (3.1, 3.2, 3.3, 3.7, 3.8). W4 tests import the new modules by relative path
    because 3.10 adds the root exports in the same wave.
  - W5: 3.16 gate (verification only; MAIN tree; no network).
  - Critical path: 3.1 and 3.2 -> 3.7 -> 3.8 -> W4 -> 3.16.
- Environment / bootstrap:
  - Short worker worktree paths (C:/Users/John/Projects/steady-orchard/m4-w<id>); `pnpm install --frozen-lockfile` per
    new worktree, sequentially. Acceptance writes Vitest JSON to node_modules/.m4-p3-<id>.json and checks rendered titles.
  - 3.3 runs `pnpm build` (its checks import packages/core/dist). 3.10 runs build, typecheck, and the full `pnpm test`.
    Every other step runs its own test file, `tsc --noEmit -p packages/core/tsconfig.test.json`, eslint, and prettier.
  - Tests are offline: fake fetch routing on URL pathname, fake attachment resolver and transport, temporary git
    repositories built with plumbing (GIT_CONFIG_NOSYSTEM=1, empty GIT_CONFIG_GLOBAL). Unit tests may read templates/
    but never fixtures/; fixture-tier tests normalize CRLF.
  - 3.13 and 3.15 record child processes with a hoisted pass-through `vi.mock('node:child_process')` and prove
    interception with a positive control (runProcess of node). If the mock does not intercept, those tests fail
    honestly; the revision would switch the git path to an injected recording ProcessRunner and keep the static scans.
- Couplings:
  - 3.9 pins expectations.json by sha256 of JSON.stringify(JSON.parse(file)) = 4f293bdb37cd1f14... (43 cases). The
    expected values were dry-run at decomposition against a reference implementation of the rules pinned in 3.1 and 3.7
    (43 of 43 matched); the gate re-checks the exit-criterion coverage predicates on the JSON. Workers never edit an
    expectation to match code.
  - 3.9's test 'every submission fixture has an expectation' requires every file under fixtures/submissions/ (except
    expectations.json) to be named by a case. A later phase that adds files there (preflight drafts) must add cases in
    the same step; the existing drafts defect-complete.txt, defect-no-response.txt, pr-bugfix-complete.txt, pr-docs.txt
    already have cases.
  - 3.13's static scan: `new RegExp(` only in submission/field-values.ts (exactly 2), no `eval(` or `new Function` in
    non-test sources of core submission, github, net, git. Each new module step checks its own file (A3).
  - 3.15's static scan covers packages/cli/src: later CLI code must not import node:child_process, vm, or worker_threads
    (run `gh auth token` through the core process runner) nor any specifier matching
    llm, model, copilot, openai, anthropic, sandbox, container, docker, or runner.
  - 3.10 ADDS an invariant-5 test pinning the 16 root functions matching /^(load|validate|resolve|parse|capture|check)/
    (captureIssue, capturePullRequest, checkContract, checkPolicyRules, checkRedactionPattern, loadPolicy,
    parseCategoryValue, parseIssueBody, parseLinkedIssueValue, parsePullRequestBody, parseStrictYaml,
    parseStrictYamlDocument, resolveCommit, resolvePolicy, validatePolicy, validatePolicyBytes); the older
    load/validate/resolve test stays unchanged. A later core root export with those prefixes must join the list with a
    rejection case. The duplicate-export check A1 de-duplicates per file (Phase 2 Revisions lesson).
  - Module steps must export exactly their pinned names (A4 lists them); every name was checked unique against the 457
    existing core export names.
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed):
  - An issue whose body matches no form has no known kind; the record schema requires issue_kind, so captureIssue
    returns record null (contract, snapshot, and hash are still produced).
  - Free-form unstructured PR: linkage is required when any plausible category (all six when none) has
    `linked_issue: required`; the finding is linked-issue-missing with detail 'free-form' and a request carrying the
    PR template link.
  - Too-large diff: plausible = all six categories, no mismatch check, ambiguous only when the declared category is
    absent or invalid; trusted and execution-sensitive flags true, policy_changed false, only the diff-too-large finding,
    flags.policy_change null (the record omits policy_change).
  - A duplicated field yields only field-duplicate (no missing, category, or linkage finding for it); field-missing is
    never raised for category (category-missing or -invalid) or linked-issue (linked-issue-missing). Linkage is required
    when categories.<D>.linked_issue is required or required_fields names linked-issue.
  - Issue effective mode = modes.default; PR effective mode = strictest over the plausible set (all six when empty);
    enforced = effective mode is enforce.
  - Attachments come from D5-normalized field text (HTML comments removed, so hidden URLs are ignored); built-in shapes
    are recognized for http too (scheme violation); unstructured bodies without free form have no attachments; static
    rule order: length over 2048 -> destination, non-https -> scheme, userinfo, explicit port or unapproved host ->
    destination, known disallowed format -> format. A count violation fetches nothing; format after fetch comes from the
    final URL; a fetched attachment with a bad format keeps its hash; gz entry name = file name without .gz (fallback
    'attachment'). Non-https or over-long attachment URLs never enter the snapshot or record (both schemas require
    https at most 2048 characters); their findings still apply.
  - Findings sort by C-table order, then field order (SUBMISSION_FIELD_IDS, null first), then first subject. Requests
    exist only for blocking findings, numbered from 1; messages are fixed per code (CONTRACT_FINDING_MESSAGES); request
    texts are pinned in step 3.7 and contain no submission text.
  - Inconclusive causes are data in the contract result: 'attachment.fetch-failed' (cause attachment-fetch-failed),
    pass-through GitHub failure codes for linked-issue, shared-head, and proposed-policy reads, and steward-defect codes
    'contract.linked-issue-unchecked' and 'contract.policy-change-unchecked' for caller defects.
  - Proposed policy: revision = policy-directory tree id; truncated tree, non-regular or oversize policy.yml -> status
    invalid with policy-source.* detail codes; the Dockerfile runner-path check is included; removed = no .github, no
    patch-steward directory, or no policy.yml.
  - Record mapping: fields = raw values; linked_evidence_hashes = sorted unique linked-issue and attachment hashes;
    author_responses = snapshot responses with a non-null hash; contract_results = one per finding (requirement = code,
    satisfied = advisory, detail = message plus field); policy_change only when consistent; claim_scope_hash PR only.
    New failure code 'intake.record-invalid' (steward-defect).
  - Exit criterion 5 ("over every fixture and the preflight path"): the core test covers every fixture file, capture over
    recorded responses, and the core preflight path (remote discovery, ref resolution, merge base, diff, proposed policy
    from git, contract) plus a static import scan of core and packages/cli/src. The CLI preflight command does not exist
    yet; Phase 4 must add a CLI test with the same title `zero model calls and zero executions` whose process spy sees
    only allowlisted git reads and `gh auth token`.
- Emergent contracts for Phases 4-5 (root-exported by 3.10):
  - Contract: checkContract(input) -> ContractResult with snake_case keys disposition (met, needs-changes, uncertain,
    inconclusive), findings [{ code, severity, field, detail, subjects, message }], requests [{ number, code, field,
    text }], inconclusive [{ cause, code, message, subjects }], warnings [{ code: 'attachment.format-unverified',
    subjects }], enforced, effective_mode, category, plausible_categories, template, flags ({ trusted_paths_changed,
    execution_sensitive_paths_changed, policy_changed, trusted_paths, execution_sensitive_paths, policy_paths,
    policy_change } or null for issues). Helpers effectiveIssueBody, linkedIssueReference, contractRequiredFields.
  - Preflight composition: parse the draft; `--issue <kind>` -> requestedKind (contract treats a form mismatch as
    unstructured); attachments = assessAttachmentsStatically({ body (effectiveIssueBody for issues), bodyText,
    requiredFields: contractRequiredFields(...), policy }) with NO fetch (pending items with unknown format become
    warnings); PR: changedPaths = listChangedPaths(options, mergeBase, head); linkedIssue from linkedIssueReference plus
    readIssue (exists; not-found for github.not-found or github.not-an-issue; else unavailable); sharedHeads
    { status: 'not-applicable' }; proposedPolicy from readProposedPolicyFromGit(options, head) when
    detectPathFlags(changedPathSet(changes), additions).policy is non-empty, else not-read; repository = { fullName,
    defaultBranch } from readRepository. Suggested exit mapping per the brief: met 0; needs-changes or uncertain 1;
    inconclusive (a GitHub or git read failed) 2.
  - Capture (screening, later milestones): captureIssue / capturePullRequest(context, n) with CaptureContext { client,
    repository, policy, policyRevision (active tree id), attachmentResolver, attachmentTransport, authorResponses };
    CaptureFailureCode = GitHubFailureCode, BodyParseFailureCode, SnapshotFailureCode, 'intake.record-invalid';
    buildSubmissionRecord(input).
  - Attachments: SUBMISSION_ATTACHMENT_RULES (count, destination, scheme, userinfo, format, file-bytes, total-bytes,
    redirects, archive, decompressed-bytes), DEFAULT_ATTACHMENT_DESTINATIONS, fetchSubmissionAttachments(set,
    { policy, resolver, transport }).
  - Never-pass: Phase 4 adds its preflight failure codes to a never-pass table; invariant-1: Phase 4 adds a test that
    human CLI output escapes control characters (reuse the policy/messages.ts escaping).
  - Docs (Phase 5) quote the C-table codes, attachment rule names, request behaviour, the free-form linkage and
    too-large rules, and the record keys; no planning ids.

### Phase 4 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m4): phase 4 steps`), phase base
  d32c529. No brief amendment. No new dependency. Only packages/cli/src and development-artifacts change; packages/core,
  templates, fixtures, docs, CI, and the Vitest configs stay untouched (gate G3). No fixture file is added under
  fixtures/submissions, so the every-fixture-has-an-expectation rule is unaffected. Unit and fixture tests are offline;
  live reads happen only in gate G7 and G8.
- Dependency graph (scopes pairwise disjoint among steps that can run together; merge order within a wave is free):
  - W1 (parallel, no deps): 4.1 token resolution (github-auth.ts); 4.2 argument parser (preflight-args.ts); 4.3 report
    types and renderers (preflight-output.ts); 4.4 draft reader (preflight-draft.ts).
  - W2: 4.5 runPreflightCommand (preflight-command.ts; needs 4.1-4.4).
  - W3 (parallel, each needs 4.5): 4.6 cli.ts dispatch, STEWARD_USAGE, index.ts re-exports, index.test.ts; 4.7 recorded
    fixture tests incl. the token sentinel; 4.8 CLI `zero model calls and zero executions`; 4.9 never-pass table and the
    untrusted-output escaping tests. W3 tests import './preflight-command.js' directly, not the index.
  - W4: 4.10 gate (verification only; MAIN tree; network for G7 and G8).
  - Critical path: W1 -> 4.5 -> W3 -> 4.10.
- Environment / bootstrap:
  - Short worker worktree paths (C:/Users/John/Projects/steady-orchard/m4-w<id>); `pnpm install --frozen-lockfile` per new
    worktree, sequentially. Acceptance writes Vitest JSON to node_modules/.m4-p4-<id>.json and a check script
    node_modules/.m4-p4-<id>-check.mjs (rendered titles plus, for modules, the exact export-name list).
  - 4.3, 4.5, 4.6 run `pnpm build` and a probe (node_modules/.m4-p4-<id>-probe.mjs, pinned in the step file) against
    packages/cli/dist. W1 steps and 4.5 also run the core zero-execution fixture test, whose static import scan covers
    packages/cli/src.
  - Tests never run the real gh: env is always explicit; gh is either a fake runner or a ghBinary inside a missing
    directory (a process.unavailable skip). 4.5, 4.7, 4.8, 4.9 build temporary git repositories with plumbing
    (GIT_CONFIG_NOSYSTEM=1, empty GIT_CONFIG_GLOBAL); the CLI's own git reads use the user's global config (reads only).
  - Network retry waits: only the 4.7 sentinel case (h) takes about 3 s (a throwing fetch is retried twice).
- Couplings:
  - The probes of 4.3 and 4.5 and the gate's G7 commands and G8 temporary-repository script were dry-run at
    decomposition against a reference implementation of the pinned design (all expected outputs matched; G7 and G8
    live against the test-bed, 2026-09-26, token from gh).
  - 4.6 adds `export *` for all five new modules to packages/cli/src/index.ts; every export name is pinned per step and
    unique across the cli modules (no TS2308).
  - The core static scan forbids node:child_process, node:vm, node:worker_threads and any specifier matching
    llm, model, copilot, openai, anthropic, sandbox, container, docker, runner in packages/cli/src non-test files; gh
    runs through core runProcess.
  - Core invariant-5 root-export list is unaffected (all new functions live in the cli package).
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed):
  - Output escaping: the CLI `escapeTerminalText` reuses core redaction (redactBuiltInCredentials) and the escape rules of
    policy/messages.ts (C0, DEL, C1, U+2028, U+2029, lone surrogates as backslash-u escapes), adds Unicode format
    characters (Cf: bidi controls, zero-width) and backslash doubling, and bounds text at 4096 code points. It omits the
    Markdown escaping and 80-character excerpt truncation of formatExcerpt: terminal output is not Markdown, and request
    texts and diff paths exceed 80 characters. JSON output escapes U+007F-U+009F, U+2028, U+2029, and Cf characters as
    JSON escapes (JSON.stringify already escapes C0).
  - Failure codes (PREFLIGHT_FAILURE_CODES, 15, all exit 2 with contract null): usage.unknown-option,
    usage.invalid-arguments, usage.conflicting-options, preflight.draft-not-found, preflight.draft-unreadable,
    preflight.draft-too-large, preflight.draft-invalid-utf8, auth.token-invalid, preflight.no-upstream,
    preflight.head-unresolvable, preflight.base-unresolvable, preflight.repository-unavailable, preflight.token-rejected,
    preflight.policy-invalid, steward.internal-error. Pass-through codes git.*, git.no-merge-base, github.* also exit 2.
    The parser's submission.body-too-large and submission.body-malformed are reported as preflight.draft-too-large (citing
    GitHub's 65536-character body limit) and preflight.draft-invalid-utf8.
  - Token: `gh auth token --hostname github.com` with GH_TOKEN, GITHUB_TOKEN, GH_ENTERPRISE_TOKEN, GITHUB_ENTERPRISE_TOKEN,
    and GH_HOST removed from its environment; any gh failure (absent, non-zero, timeout, oversize, malformed output) means
    no token; an unusable GH_TOKEN or GITHUB_TOKEN value (not 1-4096 printable ASCII without spaces) is auth.token-invalid.
    github.unauthorized with a token (401, or a 403 without rate-limit headers) -> preflight.token-rejected; github.not-found
    on the repository read -> preflight.repository-unavailable (message asks for a token when none was used).
  - Order: args, draft, upstream (--repo or the upstream/origin remote), HEAD (pull requests), token, repository read,
    policy, then base, merge base, diff, linked issue, proposed policy, contract. One preflight budget (20 requests, 2
    retries) covers every read. The default base is refs/remotes/<remote>/<default branch> only when the discovered
    remote names the same repository as --repo.
  - A linked-issue read failure is an inconclusive cause (exit 2 unless a blocking finding makes it needs-changes, exit 1).
  - Text mode on failure prints nothing on stdout; errors go to stderr (`error <code> <path or ->: <message>`), plus the
    preflight usage line after usage errors. JSON mode prints the report (contract null) and nothing on stderr.
- Emergent contracts for Phase 5 (docs quote these exactly; no planning ids):
  - Syntax: `steward preflight (--issue defect|proposal | --pr) --draft <file.md> [--repo owner/name] [--base <ref>] [--json]`;
    STEWARD_USAGE preflight line ends `check a draft against the submission contract; the result is unverified`.
  - Human stdout lines in order: the notice `unverified: produced on the contributor's machine; official screening treats
    it as a claim`; `policy: published <repo> <branch> commit <commit> revision <tree id>` or `policy: default checklist
    (<repo> has no published policy on <branch>)`; `submission: issue <kind>` or `submission: pull request`;
    `template: <form> v<n>` or `template: none`; `mode: <mode> enforced <bool>`; pull requests: `category: <c or none>
    plausible <list or none>`, `paths: base <id> merge-base <id> head <id> changed <n or too-many>`, `flags:
    trusted-paths-changed <bool> execution-sensitive-paths-changed <bool> policy-changed <bool>`, optional
    `proposed-policy: valid revision <id>`, `invalid revision <id>` with `  proposed-policy-error ...` lines, `removed`, or
    `unavailable`; `disposition: <d>`; `finding <code> <severity>[ field <id>][ detail <text>]: <message>` with up to 20
    `  subject <text>` lines and `  subjects not shown: <n>`; `request <n>: <text>`; `inconclusive <cause> <code>:
    <message>`. Stderr: `warning github.unauthenticated: ...`, `warning attachment.format-unverified: ...`, `error ...`.
  - JSON keys: top level schema_version, unverified, notice, submission { type, issue_kind }, repository, policy { source
    (published or default-checklist), repository, ref, commit, revision }, contract { disposition, findings, requests,
    inconclusive, category, plausible_categories, effective_mode, enforced, template }, paths { base, head, merge_base,
    changed, trusted_changed, execution_sensitive_changed, policy_changed, trusted_paths, execution_sensitive_paths,
    policy_paths, policy_change } or null, warnings [{ code, message, subjects }], errors [{ code, path, message }].
  - Exit statuses: 0 met; 1 needs-changes or uncertain; 2 usage or environment errors, GitHub or git failures, invalid
    published policy, inconclusive.
  - Project DoD item 9: the temporary-repository script and its expected output are pinned in step 4.10 (TEMP REPOSITORY
    SCRIPT, G8); the Phase 5 gate reuses them verbatim.

### Phase 5 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m4): phase 5 steps`), phase base
  41f504f. No brief amendment. Documentation only: no code, test, fixture, template, CI, or configuration file
  changes; templates/README.md and fixtures/README.md already describe the delivered files and are in no step's scope.
- Shared check script development-artifacts/patch-steward-m4-p5-check.txt (committed with the step files; `.txt` so
  ESLint and Prettier ignore it). Every step copies it to node_modules/.m4-p5-check.mjs and runs
  `node node_modules/.m4-p5-check.mjs <id>` (prints `<id> ok`), `all` (every step's checks on the final tree with exact
  final heading lists), or `links` (link and anchor integrity over every persistent document). It reads marker lines
  from the step files: CHECK-DOC, EDIT/OLD:/NEW:/END-EDIT (NEW present and OLD absent, whitespace-normalized, runs of 3+
  hyphens collapsed), REQUIRE, FORBID, HEADING-INSERT, HEADING-RENAME, ADR (MADR structure, metadata, Chosen option,
  More Information date line), REQUIRE-LIST (every entry of a path-lists.ts constant appears as a code span),
  ADR-INDEX. Generic checks per CHECK-DOC file: persistence pattern (baseline CLAUDE.md 2, configuration.md 1),
  DF/deferred.md (CLAUDE.md 3, README.md 1, at most 1 per ADR), length-cap wording (architecture, processes,
  whitepaper 1 each), planning ids `(D or I or K or Q or AT or PC or TP or ES)` plus digits, "owner decision", option
  A/B (0 everywhere), planning vocabulary (CLAUDE.md 1), raw control characters, links, headings (base 41f504f plus
  every declared insert or rename of any Phase 5 step, so an earlier step's check stays valid after later steps).
- Dependency graph (scopes pairwise disjoint within a wave; merge order within a wave is free):
  - W1 (parallel, 4): 5.1 architecture status, invariant 8, 6.1, 6.2, 6.3, 6.5, 6.7; 5.2 processes status, 0.1,
    SP01, SP05; 5.3 configuration introduction, glob syntax, built-in lists, category consistency, live-tier row;
    5.4 commands.md preflight section.
  - W2 (parallel, 5): 5.5 architecture 8, 9, 12, 12.1, 13 (after 5.1); 5.6 processes SP06 (after 5.2); 5.7
    configuration Submission subsection (after 5.3); 5.8 usage.md (after 5.4); 5.9 troubleshooting, overview,
    installation (after 5.4).
  - W3 (parallel, 6; each after 5.5-5.9, governing documents first): 5.10 ADR-0050-0053; 5.11 ADR-0054-0057; 5.12
    ADR-0058-0061; 5.13 whitepaper; 5.14 README.md and CLAUDE.md; 5.15 docs/user-manual/README.md.
  - W4: 5.16 ADR index rows (after 5.10-5.12).
  - W5 (verification only): 5.17 code and test DoD items 1-13 and 18 (MAIN tree; network for G10, G11, G13; reuses
    the 3.16 and 4.10 checks verbatim with node_modules/.m4-p5-* file names) and 5.18 documentation DoD items 14-17 and
    19 plus Prettier, `all`, `links`, phase scope, control characters (any tree, no network). They run in parallel only
    if 5.18 runs in its own worktree; otherwise sequentially in the main tree.
  - Critical path: W1 -> W2 -> W3 -> 5.16 -> gates.
- Environment / bootstrap: short worker worktree paths (C:/Users/John/Projects/steady-orchard/m4-w<id>); run
  `pnpm install --frozen-lockfile` per new worktree, sequentially (Prettier comes from node_modules). Doc steps run
  only Prettier on their own files and the check script; no Vitest. Workers apply EDIT blocks with the Edit tool
  after removing the 4-space field indentation; OLD texts inside table rows are cell texts, so Prettier re-aligns.
- Couplings:
  - Same file, sequential: architecture 5.1 then 5.5; processes 5.2 then 5.6; configuration 5.3 then 5.7. Each
    later step's regions are disjoint from the earlier step's; A2 of 5.5, 5.6, 5.7 re-runs the earlier check.
  - Anchors: commands.md#steward-preflight-available (5.4) is linked by 5.8, 5.9, 5.15; the usage.md rename to
    #prepare-a-submission-available (5.8) leaves docs/user-manual/README.md with one broken TOC link until 5.15
    merges (only 5.15 and the gate check that file). Configuration's new `####` anchors are linked only inside
    configuration.md; other documents link its existing #submission anchor.
  - Snapshot wording (base commit recorded, not compared) is pinned at the five sites: architecture invariant 8 (5.1),
    processes 0.1 (5.2), overview Snapshot row (5.9), whitepaper 8 (5.13), CLAUDE.md invariant (5.14); architecture 9
    names `base commit (recorded, not hashed)` (5.5); ADR-0055 records it (5.11). Each site contains
    "base commit is recorded" exactly once.
  - ADR slugs and titles are pinned identically in 5.10-5.12 and 5.16; records link only ADR-0001-0049 or records of
    the same step; ADR-0057 carries the only DF line (DF10, rejected alternative).
- Dry-run at decomposition: in a scratch worktree at 41f504f, every EDIT block was applied programmatically in wave
  order (each OLD text found exactly once), Prettier was applied, stub records carrying the required phrases stood in
  for the worker-written ADRs, and every step check printed `<id> ok`, `all ok`, `links checked=600 broken=0`; the
  DoD 14-17 and 19 greps gave the expected counts on the simulated tree; negative controls (a planning id in a record,
  length-cap wording in usage.md) failed the check as intended. The live tier printed `9 passed, 0 other`
  (2026-09-26, token from gh).
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed):
  - usage.md "Prepare a submission" becomes "(Available)" and names its proposed parts in the section; the proposed
    CLI table drops `steward preflight` and its callout names preflight's mandatory-command and self-review options as
    undefined. NEEDS INPUT callouts after the phase: configuration.md 5, usage.md 2.
  - New configuration.md headings: `#### Glob syntax`, `#### Built-in trusted paths`,
    `#### Built-in execution-sensitive paths`, `#### Category consistency` (5.3); `#### Field mapping`, `#### Parsing`,
    `#### Attachments` (5.7). The full pattern lists live there; architecture 8 names them by group.
  - Architecture 12.1 hard-only table gains 20 rows (the constants of bounds.ts added for intake, GitHub, attachments,
    archives, gh auth token, linked issues, author responses) plus a paragraph that the GitHub body limits are
    input-safety bounds; architecture 13 gains an attachment-fetch threat row, and the whitepaper 12 summary names it.
  - Processes status line: the deterministic contract check of SP06 steps 3-7 with the capture it needs, without the
    merge-group branch, stored-validation reuse, or the author-response ledger; requests link the template now and the
    submission assistant once it exists.
  - ADR-0038 and ADR-0021 stay unchanged; ADR-0058 and ADR-0061 cite them.

## Revisions

<!-- supervisor appends: phase | failed step | revision note | outcome -->

| Phase | Trigger | Revision | Outcome |
| --- | --- | --- | --- |
| 1–5 | owner gate (owner, 2026-09-26, relayed by lead) | owner gate approved: A-table, PC-lists and PC-rules, TP-list and ES-list, AT-list, K13–K26 exactly as proposed; I1–I26 every recommendation accepted, alternatives rejected (I5 same-repository only; I14 fetch deferred; I16 no evidence or metrics; I19 live runner, ADR-0061 applies; I20 no new field id); C-table pinned; Q1 option B: base commit recorded in the snapshot but excluded from the snapshot hash, base ref hashed (I11 rewritten). Scope added: brief "Q1 documentation changes" (processes §0.1, architecture invariant 8, CLAUDE.md snapshot invariant, whitepaper §8, user-manual overview) recorded by ADR-0055; ADR list final at ADR-0050 through ADR-0061; project DoD items 3, 11, 14, 15 updated and item 19 added; roadmap Phases 1, 2, 5 updated. Phase 1 unblocked | brief amended |
| 2 | 2.13 (acceptance A1) | correct in flight (supervisor): A1 counted duplicate export names across all core sources without de-duplicating per file, so the three loadPolicy overload signatures that step 2.10 added to packages/core/src/policy/loader.ts read as a duplicate (printed 1, expected 0); tsc build passed, so no real TS2308 collision existed. A1 rewritten in the step file to de-duplicate names per file before counting cross-file duplicates; the merged work (db26fed) passes the corrected A1 (0) and A2-A10 unchanged; no worker rerun needed. Coupling for later phases: any duplicate-export grep must tolerate same-file overloads | step file corrected; step done |
| 3 | 3.13 (test content) | supervisor integration commit 60ef067: the step required the hostile-API test to assert that JSON.stringify of both the snapshot and the record never contains the title; the merged test (a0f38dd) asserted the snapshot only. Acceptance passed honestly (it checks titles, not assertions), and the intake test already covers the title with a sentinel, so the missing record assertion was added directly (one line) instead of a worker rerun; invariant-1 file re-run 8 of 8 passed, lint and prettier clean. Worker deviations accepted: path-flag expectations follow the built-in lists (workflows trusted only, package.json execution-sensitive only); U+202E and U+200B built with String.fromCharCode | integration commit; step done |
| 3 | 3.16 (gate G7) | correct in flight (supervisor): the G7 ATTACHMENT CHECK merged the JSON reports of two Vitest runs filtered with -t into one Map, so a title passed in the first run and skipped in the second was overwritten as skipped (failed count 0; 40 passed, 1637 skipped in the first run). The gate report (dbcd29c) honestly recorded G7 FAIL and OVERALL FAIL with this diagnosis. The step file check was corrected to keep a passed or failed status over skipped or pending; the corrected check prints attachment rules ok on the merged tree; all other gate checks re-run by the supervisor as expected; no worker rerun. Lesson: a check that merges -t filtered runs must not let skipped overwrite passed | step file corrected; step done |
