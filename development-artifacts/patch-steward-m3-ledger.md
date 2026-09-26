# patch-steward-m3 — Ledger

Single source of truth for execution state. Sections are owned by different agents —
the planner seeds Plan + Phases; the decomposer fills Steps per phase; the supervisor
updates Steps and appends Revisions.

## Plan

- plan-name: patch-steward-m3
- current-phase: complete (phases 1-4 done)
- working-branch: milestone/3-policy-and-data-contracts
- starting-commit: 55d97c51c07c2ea0bfef3fd463f54fe1708a844d
- default-branch: develop
- artifacts-dir: development-artifacts
- owner-gate: APPROVED 2026-09-26 (brief "Owner gate": B-table, DC-list, I1–I8 as proposed; I9 plus placeholder-model warning). Scope added: test type-checking (`pnpm typecheck`) in Phase 1.

## Phases

| Phase | Status  | Notes |
| ----: | ------- | ----- |
| 1     | done    | FIRST step: `pnpm typecheck` + CI Typecheck step + doc corrections (brief "Test type-checking"); other steps depend on it. Then value-independent core foundations; bounds are required parameters; no bound constants. |
| 2     | done    | Policy schema, approved bounds, loader, subset, records, redaction, warnings, template, fixtures. Needs Phase 1. |
| 3     | done    | `steward policy` CLI (incl. placeholder-model warning) and invariant 2, 5, 7 conformance checks. Needs Phase 2. |
| 4     | done    | ADR-0034 to ADR-0049, governing documents, full milestone DoD (items 1–15) in the main tree. Needs Phase 3. |

## Pipeline rules (from earlier milestones; binding for every agent in this plan)

- Every `decomposer`, `worker`, and `planner` invocation runs in the FOREGROUND (`run_in_background: false`). A parallel wave is
  several foreground Agent calls in ONE message. A supervisor that backgrounds workers is force-handed back and loses results.
- Never put a pipe character inside a ledger table cell (it breaks the columns); write "or" instead.
- Phase gates and the project DoD run in the MAIN tree (repo root); long git-worktree paths break `pnpm test`.
- Before a wide wave, run `pnpm install --frozen-lockfile` in each new worktree sequentially (pnpm store contention on Windows).
- `core.autocrlf=true`: compare committed bytes with `git show HEAD:<path>`; never assert hashes of working-tree fixture bytes.
- Every Prettier-checked file a step writes (templates, fixtures `.yml`/`.json`, docs, README, CLAUDE.md) is Prettier-clean at
  commit; malformed or byte-exact fixtures use `.txt`. Never run a formatter on anything under `development-artifacts/`.
- Acceptance checks that grep for substrings the mandated text itself contains, or count diff hunks, are mis-specified.
- The Vitest alias maps `@patch-steward/core` to `packages/core/src/index.ts` exactly: cli code and tests import only the root.

## Steps

<!-- decomposer fills per phase: id | phase | status | files | commit,
     plus a "Phase <N> notes" block: dependency graph, couplings, emergent contracts -->

| id | phase | status | files | commit |
| --- | --- | --- | --- | --- |
| 1.1 | 1 | done | package.json, packages/core/tsconfig.test.json, packages/cli/tsconfig.test.json, packages/action/tsconfig.test.json, packages/web/tsconfig.test.json, .github/workflows/ci.yml, CLAUDE.md, README.md, docs/user-manual/commands.md, docs/user-manual/configuration.md, docs/user-manual/usage.md, docs/user-manual/troubleshooting.md, docs/user-manual/installation.md, development-artifacts/patch-steward-m3-1.1-report.md | d8ec4b6 |
| 1.2 | 1 | done | packages/core/package.json, pnpm-lock.yaml, packages/core/src/vocabulary.ts, packages/core/src/vocabulary.test.ts, packages/core/src/result.ts, packages/core/src/result.test.ts, development-artifacts/patch-steward-m3-1.2-report.md | c8461ab |
| 1.3 | 1 | done | packages/core/src/labels.ts, packages/core/src/labels.test.ts, development-artifacts/patch-steward-m3-1.3-report.md | 22fffdf |
| 1.4 | 1 | done | packages/core/src/canonical-json.ts, packages/core/src/canonical-json.test.ts, packages/core/src/hash.ts, packages/core/src/hash.test.ts, development-artifacts/patch-steward-m3-1.4-report.md | 13fb4cf |
| 1.5 | 1 | done | packages/core/src/strict-yaml.ts, packages/core/src/strict-yaml.test.ts, development-artifacts/patch-steward-m3-1.5-report.md | 2415254 |
| 1.6 | 1 | done | packages/core/src/process/run-process.ts, packages/core/src/process/run-process.test.ts, development-artifacts/patch-steward-m3-1.6-report.md | dd13d5f |
| 1.7 | 1 | done | packages/core/src/git/reader.ts, packages/core/src/git/reader.test.ts, development-artifacts/patch-steward-m3-1.7-report.md | 0180541 |
| 1.8 | 1 | done | packages/core/src/git/tree-identity.test.ts, development-artifacts/patch-steward-m3-1.8-report.md | af4471b |
| 1.9 | 1 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, development-artifacts/patch-steward-m3-1.9-report.md | 8b95d67 |
| 1.10 | 1 | done | development-artifacts/patch-steward-m3-1.10-report.md | 43e047b |
| 2.1 | 2 | done | packages/core/src/policy/bounds.ts, packages/core/src/policy/bounds.test.ts, development-artifacts/patch-steward-m3-2.1-report.md | 1f5e730 |
| 2.2 | 2 | done | packages/core/src/policy/catalog.ts, packages/core/src/policy/catalog.test.ts, packages/core/src/submission-fields.ts, packages/core/src/submission-fields.test.ts, development-artifacts/patch-steward-m3-2.2-report.md | 28e040d |
| 2.3 | 2 | done | packages/core/src/strict-yaml.ts, packages/core/src/strict-yaml.test.ts, development-artifacts/patch-steward-m3-2.3-report.md | 6b8ccff |
| 2.4 | 2 | done | packages/core/src/redaction/detectors.ts, packages/core/src/redaction/detectors.test.ts, development-artifacts/patch-steward-m3-2.4-report.md | 0d4fc21 |
| 2.5 | 2 | done | packages/core/src/redaction/safe-pattern.ts, packages/core/src/redaction/safe-pattern.test.ts, development-artifacts/patch-steward-m3-2.5-report.md | 9c3803e |
| 2.6 | 2 | done | packages/core/src/policy/schema.ts, packages/core/src/policy/schema.test.ts, templates/policy/policy.yml, templates/policy/policy.schema.json, templates/README.md, development-artifacts/patch-steward-m3-2.6-report.md | 278c6bc |
| 2.7 | 2 | done | packages/core/src/policy/messages.ts, packages/core/src/policy/messages.test.ts, development-artifacts/patch-steward-m3-2.7-report.md | f6fe1a2 |
| 2.8 | 2 | done | packages/core/src/records/common.ts, packages/core/src/records/common.test.ts, packages/core/src/records/submission.ts, packages/core/src/records/submission.test.ts, packages/core/src/records/run.ts, packages/core/src/records/run.test.ts, development-artifacts/patch-steward-m3-2.8-report.md | 4baa9ef |
| 2.9 | 2 | done | packages/core/src/redaction/redact.ts, packages/core/src/redaction/redact.test.ts, development-artifacts/patch-steward-m3-2.9-report.md | 14933ca then 6dbde34 (retry) |
| 2.10 | 2 | done | packages/core/src/policy/rules.ts, packages/core/src/policy/rules.test.ts, development-artifacts/patch-steward-m3-2.10-report.md | c2987e8 |
| 2.11 | 2 | done | packages/core/src/policy/resolve.ts, packages/core/src/policy/resolve.test.ts, packages/core/src/policy/warnings.ts, packages/core/src/policy/warnings.test.ts, development-artifacts/patch-steward-m3-2.11-report.md | 5bbc354 |
| 2.12 | 2 | done | packages/core/src/records/execution-record.ts, packages/core/src/records/execution-record.test.ts, packages/core/src/records/finding.ts, packages/core/src/records/finding.test.ts, packages/core/src/records/decision.ts, packages/core/src/records/decision.test.ts, packages/core/src/records/report.ts, packages/core/src/records/report.test.ts, development-artifacts/patch-steward-m3-2.12-report.md | dd54daa |
| 2.13 | 2 | done | packages/core/src/records/maintainer-action.ts, packages/core/src/records/maintainer-action.test.ts, packages/core/src/records/metrics-event.ts, packages/core/src/records/metrics-event.test.ts, development-artifacts/patch-steward-m3-2.13-report.md | 348ede1 |
| 2.14 | 2 | done | packages/core/src/policy/validate.ts, packages/core/src/policy/validate.test.ts, development-artifacts/patch-steward-m3-2.14-report.md | 6e0b308 |
| 2.15 | 2 | done | packages/core/src/policy/public-subset.ts, packages/core/src/policy/public-subset.test.ts, development-artifacts/patch-steward-m3-2.15-report.md | c722336 |
| 2.16 | 2 | done | packages/core/src/policy/loader.ts, packages/core/src/policy/loader.test.ts, packages/core/src/policy/revision-record.ts, packages/core/src/policy/revision-record.test.ts, development-artifacts/patch-steward-m3-2.16-report.md | 8c38d1c |
| 2.17 | 2 | done | packages/core/src/policy/template.test.ts, packages/core/src/policy/limits.test.ts, development-artifacts/patch-steward-m3-2.17-report.md | 16c4451 |
| 2.18 | 2 | done | fixtures/policies/valid/minimal-no-llm.yml, fixtures/policies/valid/copilot.yml, fixtures/policies/valid/openai-compatible.yml, fixtures/policies/valid/injection-text.yml, fixtures/policies/invalid/unknown-key.txt, fixtures/policies/invalid/limit-above-bound.txt, fixtures/policies/invalid/undeclared-command.txt, fixtures/policies/invalid/undeclared-path.txt, fixtures/policies/invalid/missing-key.txt, fixtures/policies/invalid/unknown-version.txt, fixtures/policies/invalid/llm-pairing.txt, fixtures/policies/invalid/llm-base-url-http.txt, fixtures/policies/invalid/builtin-code-redefined.txt, fixtures/policies/invalid/credential-value.txt, fixtures/policies/invalid/duplicate-id.txt, fixtures/policies/hostile/alias-bomb.txt, fixtures/policies/hostile/anchor.txt, fixtures/policies/hostile/duplicate-key.txt, fixtures/policies/hostile/custom-tag.txt, fixtures/policies/hostile/multi-document.txt, fixtures/policies/hostile/deep-nesting.txt, fixtures/policies/hostile/proto-key.txt, fixtures/policies/hostile/redos-pattern.txt, fixtures/policies/hostile/non-string-key.txt, fixtures/policies/expectations.json, fixtures/README.md, packages/core/src/policy/policies.fixture.test.ts, development-artifacts/patch-steward-m3-2.18-report.md | 818f34e |
| 2.19 | 2 | done | packages/core/src/index.ts, packages/core/src/exports.test.ts, development-artifacts/patch-steward-m3-2.19-report.md | 92224e1 |
| 2.20 | 2 | done | development-artifacts/patch-steward-m3-2.20-report.md | 8cb93a7 (FAIL) then 6bf9094 (PASS) |
| 3.1 | 3 | done | packages/cli/src/policy-command.ts, packages/cli/src/policy-command.test.ts, development-artifacts/patch-steward-m3-3.1-report.md | 1c254a2 |
| 3.2 | 3 | done | packages/cli/src/cli.ts, packages/cli/src/main.ts, packages/cli/src/index.ts, packages/cli/src/index.test.ts, packages/cli/src/policy-command.fixture.test.ts, packages/cli/package.json, development-artifacts/patch-steward-m3-3.2-report.md | 0f14896 |
| 3.3 | 3 | done | packages/core/src/conformance/invariant-2.test.ts, development-artifacts/patch-steward-m3-3.3-report.md | 05daef2 |
| 3.4 | 3 | done | packages/core/src/conformance/invariant-5.test.ts, packages/core/src/conformance/invariant-5.fixture.test.ts, development-artifacts/patch-steward-m3-3.4-report.md | b7804a9 |
| 3.5 | 3 | done | packages/core/src/conformance/invariant-7.test.ts, development-artifacts/patch-steward-m3-3.5-report.md | 3807e6b |
| 3.6 | 3 | done | packages/core/src/conformance/never-pass.test.ts, development-artifacts/patch-steward-m3-3.6-report.md | 0a6d8f0 |
| 3.7 | 3 | done | packages/core/src/conformance/never-pass-content.test.ts, development-artifacts/patch-steward-m3-3.7-report.md | 8e012a9 |
| 3.8 | 3 | done | development-artifacts/patch-steward-m3-3.8-report.md | bed4031 |
| 4.1 | 4 | done | docs/architecture.md, development-artifacts/patch-steward-m3-4.1-report.md | ca85ab2 (step 8a0b3bf) |
| 4.2 | 4 | done | docs/processes.md, development-artifacts/patch-steward-m3-4.2-report.md | 6c6bc15 (step d9858a9) |
| 4.3 | 4 | done | docs/user-manual/configuration.md, development-artifacts/patch-steward-m3-4.3-report.md | f425826 (step 71d6af1; A7 corrected in flight) |
| 4.4 | 4 | done | docs/user-manual/commands.md, docs/user-manual/overview.md, docs/user-manual/troubleshooting.md, docs/user-manual/installation.md, docs/user-manual/usage.md, development-artifacts/patch-steward-m3-4.4-report.md | 610d1ab (step 2696d17) |
| 4.5 | 4 | done | docs/architecture.md, development-artifacts/patch-steward-m3-4.5-report.md | 66711a6 (step a7fd306; A8 corrected before launch) |
| 4.6 | 4 | done | docs/user-manual/configuration.md, docs/user-manual/README.md, development-artifacts/patch-steward-m3-4.6-report.md | 4cfe64a (step 4635182) |
| 4.7 | 4 | done | docs/adr/0034-policy-schema-covers-every-area.md, docs/adr/0035-integer-schema-versions.md, docs/adr/0036-zod-single-schema-source.md, docs/adr/0037-strict-yaml-policy-subset.md, development-artifacts/patch-steward-m3-4.7-report.md | 21eb360 (step 0360a8d) |
| 4.8 | 4 | done | docs/adr/0038-policy-revision-git-tree-id.md, docs/adr/0039-optional-inference-section.md, docs/adr/0040-required-keys-and-documented-defaults.md, docs/adr/0041-policy-change-default-enforced.md, development-artifacts/patch-steward-m3-4.8-report.md | 0af7554 (step 4f87c88) |
| 4.9 | 4 | done | docs/adr/0042-free-form-submissions-off-by-default.md, docs/adr/0043-default-label-names.md, docs/adr/0044-built-in-dismissal-code-catalog.md, docs/adr/0045-public-policy-subset.md, development-artifacts/patch-steward-m3-4.9-report.md | 45aa4d5 (step 7eae6fb) |
| 4.10 | 4 | done | docs/adr/0046-hard-bounds-are-steward-constants.md, docs/adr/0047-redaction-patterns.md, docs/adr/0048-steward-policy-command.md, docs/adr/0049-separate-type-check-pass-for-tests.md, development-artifacts/patch-steward-m3-4.10-report.md | 831e52a (step 1e47f77) |
| 4.11 | 4 | done | docs/whitepaper.md, development-artifacts/patch-steward-m3-4.11-report.md | cd6df89 (step 361f8f1) |
| 4.12 | 4 | done | README.md, CLAUDE.md, development-artifacts/patch-steward-m3-4.12-report.md | 1ea5e8e (step a7740bd) |
| 4.13 | 4 | done | docs/adr/README.md, development-artifacts/patch-steward-m3-4.13-report.md | 955ccf9 |
| 4.14 | 4 | done | development-artifacts/patch-steward-m3-4.14-report.md | a51151a |

### Phase 1 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m3): phase 1 steps`), on top of amendment
  c571960 (brief T7 + roadmap Phase 1 gained `docs/user-manual/installation.md`).
- Dependency graph and waves (scopes pairwise disjoint; merge order within a wave is free):
  - W1: 1.1 (typecheck script, check configs, CI step, doc corrections). Every other step depends on it transitively.
  - W2: 1.2 (zod + yaml deps, lockfile, vocabulary, result primitives). Needs network for `pnpm add`.
  - W3 (parallel): 1.3 labels, 1.4 canonical JSON + hashing + local identity, 1.5 strict YAML parser, 1.6 bounded process
    runner. All depend on 1.2 only.
  - W4: 1.7 git reader (depends on 1.6).
  - W5 (parallel): 1.8 tree-identity tests (depends on 1.7) and 1.9 core index re-exports (depends on 1.2–1.7).
  - W6: 1.10 gate (depends on all; verification only).
- Environment / bootstrap:
  - Worker worktrees MUST use a short path such as `C:/Users/John/Projects/steady-orchard/m3-w<id>`; under the long session
    scratchpad path Vitest fails at startup (ERR_PACKAGE_IMPORT_NOT_DEFINED "#module-evaluator", MAX_PATH), and every step
    1.1–1.9 runs Vitest in its acceptance.
  - Run `pnpm install --frozen-lockfile` in each new worktree, sequentially, before launching its worker. Worktrees for
    W3–W5 must base on a HEAD that contains 1.2 (lockfile with zod and yaml), so install after 1.2 is merged.
  - 1.10 runs IN the main tree (hand the worker the repo root as its working directory), after 1.1–1.9 are merged and the
    tree is clean; it temporarily edits two test files for the negative proof and restores them.
  - Workers must never run a formatter on development-artifacts/. 1.1 runs `pnpm prettier --write` on its own edited product
    files only (working-tree files are CRLF under autocrlf; Prettier normalizes mixed endings).
- Couplings:
  - 1.9 uses `export *` for eight modules; a duplicate export name would fail tsc (TS2308). All exported names are pinned in
    the step files of 1.2–1.7 and are currently unique.
  - 1.8 relies on the reader behavior pinned in 1.7 (argv, paths relative to the listed tree, failure codes).
  - 1.10 checks 31 test titles pinned in 1.4 (3), 1.5 (14), 1.7 (9), 1.8 (5) via the Vitest JSON reporter.
- Decisions taken at decomposition (within the brief's latitude; no gate or DoD changed):
  - Typecheck mechanism (T1, T4): per-package `packages/<pkg>/tsconfig.test.json` extending `./tsconfig.json` with
    `noEmit: true` and `exclude: []`; root script chains `tsc --noEmit -p <config>` for core, cli, action, web; the cli
    config maps `@patch-steward/core` to `../core/src/index.ts` via `paths` and overrides `rootDir` to `..` (verified: without
    the override tsc reports TS6059; with it all four configs exit 0 with core `dist/` hidden, and emit nothing).
  - Strict YAML: one leading UTF-8 BOM is stripped and accepted (the brief's "decide and test"; ADR-0037 should say so);
    `%YAML`/`%TAG` directives are rejected as `yaml.directive` (verified: `%YAML 1.1` switches the yaml library to YAML 1.1);
    keys `__proto__`, `constructor`, `prototype` are rejected at the YAML layer as `yaml.forbidden-key`; library warnings fail
    closed as `yaml.syntax`; failure messages are fixed text and never quote input. All YAML failures carry cause
    `policy-invalid` (the policy loader is the only consumer).
  - Canonical JSON rejects non-finite numbers, lone surrogates (values and keys), non-plain values, and cycles; cause
    `steward-defect`.
  - Git reader strips every inherited `GIT_*` environment variable before adding `GIT_TERMINAL_PROMPT=0`,
    `GIT_OPTIONAL_LOCKS=0`, `GIT_NO_REPLACE_OBJECTS=1` (so `GIT_DIR` or `GIT_CONFIG_PARAMETERS` cannot redirect or reconfigure
    reads), and checks that `repoDir` is a directory before spawning (a missing cwd otherwise surfaces as ENOENT, like a
    missing binary). `rev-parse --git-dir` distinguishes "not a repository" without parsing stderr.
  - Base fixture tree id `e6c67378215c2580909acbf6dacf0ca3eca28891` (policy.yml = `version: 1\n`, runner/Dockerfile =
    `FROM scratch\n`) was computed with git 2.55 and with the pure algorithm; both agree.
- Emergent contracts for Phases 2 and 3 (from the step files; exported from the `@patch-steward/core` root by 1.9):
  - Result: `{ ok: true, value } or { ok: false, failure }`; failure `{ code, cause, outcome: 'inconclusive', message,
    details }`; `FailureDetail { code, path, message, line, column }` with `path` = segments joined by `.`, sequence indices
    as decimal digits, `''` for document level; `line`/`column` 1-based or null. Helpers `ok(value)`,
    `err(code, cause, message, details?)`.
  - Modules: `vocabulary.ts` (17 tuples + `*Schema` Zod enums + types, incl. `FAILURE_CAUSES`, `BUILT_IN_DISMISSAL_CODES`
    ids only, `LABEL_FAMILIES`); `labels.ts` (`STATUS_LABEL_DEFAULTS`, `CLASSIFICATION_LABEL_DEFAULTS`,
    `LABEL_NAME_PREFIXES`, `allLabelDefaults`); `canonical-json.ts` (`canonicalJson`); `hash.ts` (`sha256Hex`,
    `contentHash` -> `sha256:<hex>`, `canonicalJsonHash`, `localFileRevisionId` -> `local:<hex>`); `strict-yaml.ts`
    (`parseStrictYaml(bytes, { maxBytes, maxDepth, maxNodes })`, 14 `yaml.*` codes); `process/run-process.ts`
    (`runProcess`, `ProcessRunner`); `git/reader.ts` (`POLICY_DIRECTORY`, `resolveCommit`, `readPolicyTreeId`, `listTree`
    recursive with paths relative to the policy tree, `findTreeEntry`, `readBlob(options, entry, maxBytes)`,
    `inertGitEnv`, `isObjectId`; 15 `git.*` codes).
  - Phase 2 loader composition: `resolveCommit` -> `readPolicyTreeId` (revision id) -> `listTree` -> `findTreeEntry('policy.yml')`
    -> `readBlob(maxBytes = K1)` -> `parseStrictYaml({ maxBytes: K1, maxDepth: K2, maxNodes: K3 })`; git calls take
    `timeoutMs`/`maxOutputBytes` = K9; the I3 Dockerfile existence check uses `findTreeEntry` on the same listing with the
    path relative to the policy directory (e.g. `runner/Dockerfile`) and requires mode 100644 or 100755. File source:
    `localFileRevisionId(bytes)`, non-authoritative.
  - Phase 2 records: `canonicalJsonHash` fails on lone surrogates; record text fields should reject non-well-formed strings
    so hashing a validated record cannot fail.
  - Phase 3 exit-code mapping (I7), recommended: exit 2 for `git.unavailable`, `git.not-a-repository`, `git.invalid-ref`,
    `git.ref-unresolvable`, `git.timeout`, `git.output-too-large`, `git.failed`, `git.malformed-output`,
    `git.object-missing`, `git.invalid-object-id`; exit 1 for `git.policy-directory-missing`, `git.not-a-directory`,
    `git.entry-missing` (policy.yml absent), `git.entry-not-regular`, `git.blob-too-large`, every `yaml.*` code, and every
    policy validation code.
  - `greet` stays exported from core (the cli smoke code uses it until Phase 3 replaces `main.ts`).
- Execution (supervisor, 2026-09-26): all ten steps passed first try; no retries, revisions, or amendments. 1.1, 1.2, 1.7, 1.10
  ran in the main tree (lone steps, commits directly on the branch); 1.3–1.6 and 1.8–1.9 ran in worktrees
  C:/Users/John/Projects/steady-orchard/m3-w<id> and merged with `merge(patch-steward-m3): step <id>`. Phase DoD re-verified
  by the supervisor in the main tree at 43e047b (toolchain gate exit 0, 228 tests; item 15; 31 named titles; no bound
  literal; diff allowlist; Prettier). Worktree cleanup: `git worktree remove` leaves ignored node_modules behind on
  Windows; delete the directory afterwards.
- Accepted deviations (not defects against acceptance; candidates for later tightening):
  - 1.6: Vitest 5 rejects `describe(name, fn, { timeout })`; suites use `describe(name, { timeout }, fn)`.
  - 1.7: `listTree` skips empty NUL-separated records (e.g. `a\0\0b\0`) instead of failing `git.malformed-output`; git
    never emits them. Phase 2 may tighten it if the loader adds reader tests.
  - 1.8: tests c and d read variants via `readPolicyTreeId(commitId)` without `update-ref` + `resolveCommit`; the fixture
    runs `git reset --hard` after the first commit. Identity assertions (git id = pure hash = constant) are intact.

### Phase 2 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m3): phase 2 steps`), on top of amendment
  30c9a2b (`execution.platforms[].commands` added to the key inventory; `policy.duplicate-id`; pinned reference-fixture
  codes; `undeclared dockerfile` loader test). No new dependency; no network needed.
- Dependency graph and waves (scopes pairwise disjoint within a wave; merge order within a wave is free):
  - W1 (parallel, no Phase 2 deps): 2.1 bounds, 2.2 catalog + submission field ids, 2.3 strict-YAML positions, 2.4 credential
    detectors.
  - W2 (parallel): 2.5 safe-pattern (2.1); 2.6 schema + template + editor schema + templates/README.md (2.1, 2.2);
    2.7 validation messages (2.1, 2.2, 2.4); 2.8 records common + submission + run (2.1, 2.2).
  - W3 (parallel): 2.9 redaction engine (2.1, 2.4, 2.5); 2.10 cross-field rules (2.2, 2.5, 2.6); 2.11 resolve + warnings
    (2.2, 2.6); 2.12 records execution-record/finding/decision/report (2.2, 2.8); 2.13 records maintainer-action/metrics-event
    (2.2, 2.8).
  - W4 (parallel): 2.14 validate pipeline (2.3, 2.4, 2.6, 2.7, 2.10); 2.15 public subset (2.2, 2.6, 2.8, 2.11).
  - W5 (parallel): 2.16 loader + policy-revision record (2.8, 2.11, 2.14); 2.17 template tests + bounds table-driven test
    (2.1, 2.4, 2.6, 2.11, 2.14); 2.18 fixture corpus + fixture-tier test + fixtures/README.md (2.6, 2.11, 2.14).
  - W6: 2.19 package-root re-exports (all of 2.1–2.18). W7: 2.20 gate (verification only; MAIN tree).
  - Critical path: 2.1 -> 2.6 -> 2.10 -> 2.14 -> 2.16 -> 2.19 -> 2.20.
- Environment / bootstrap:
  - Short worker worktree paths (for example C:/Users/John/Projects/steady-orchard/m3-w<id>); every step runs Vitest.
    `pnpm install --frozen-lockfile` per new worktree, sequentially. Worktrees base on a HEAD containing every dependency.
  - 2.6 builds core (`pnpm --filter @patch-steward/core build`) in its worktree to generate templates/policy/policy.schema.json
    and runs `pnpm prettier --write` on its three template files; 2.18 runs it on its .yml/.json/.md files. Never on
    development-artifacts/.
  - 2.20 runs IN the main tree after 2.1–2.19 are merged and the tree is clean.
  - 2.9 spawns worker threads and 2.16 builds git fixture repositories; both are slower than other suites.
- Couplings:
  - templates/policy/policy.yml (2.6; content verified here: Prettier-clean, strict-YAML-parseable, no detector match,
    satisfies every rule) is the valid test base for 2.10, 2.11, 2.14, 2.15, 2.16, 2.17 and the base text for 2.18's
    fixtures. A template change after 2.6 needs a revision of 2.6 and re-runs of those steps.
  - templates/policy/policy.schema.json must be regenerated whenever schema.ts changes (drift test in 2.6).
  - 2.17 asserts template limit values against POLICY_LIMITS (2.1) and the dismissal comment lines against
    BUILT_IN_DISMISSAL_DEFINITIONS (2.2); both are upstream of it.
  - 2.19 uses `export *` for 24 modules; every step pins its exported names and they are unique across core (TS2308 would
    be a decomposition bug).
  - 2.20 checks titles pinned in 2.5, 2.6, 2.8, 2.9, 2.11, 2.12, 2.13, 2.15, 2.16, 2.17, 2.18 via the Vitest JSON reporter.
  - Digests pinned in 2.1 (B-table, sha256 2f83b11b...300cd over JSON of [path, unit, templateValue, min, max, provider]
    rows) and 2.2 (DC-list, sha256 3237f832...96331 over JSON of [code, definition] pairs) were computed from the brief
    tables programmatically.
- Decisions taken at decomposition (within the brief's latitude; no gate or DoD changed):
  - Policy validation codes (closed, 16): policy.version-missing, policy.version-unsupported, policy.unknown-key,
    policy.missing-key, policy.invalid-value, policy.limit-out-of-bounds, policy.undeclared-reference, policy.duplicate-id,
    policy.invalid-path, policy.llm-pairing, policy.llm-base-url, policy.stage-conflict, policy.label-name,
    policy.dismissal-code, policy.redaction-pattern, policy.credential-value. Codes the brief did not name:
    policy.invalid-value (wrong type, enum, or format; non-mapping document; container platform on a non-Linux os or with a
    ci_workflow; ci-signal platform without ci_workflow), policy.stage-conflict, policy.label-name, policy.dismissal-code.
    Warning code: policy.llm-model-placeholder.
  - Result shapes: the loader returns the Phase 1 Result, `{ ok: true, value: { revision, policy, authoritative } }`; the
    brief's failure "errors" are `failure.details`; a validation failure's top-level code is its first detail's code
    (cause policy-invalid); git and yaml failures pass through unchanged. File source codes: file.not-found,
    file.not-a-file, file.unreadable (cause policy-unavailable), file.too-large (policy-invalid). policy.resolve-failed is a
    steward defect.
  - Pipeline order: size/UTF-8/YAML (bounds K1-K3) -> version (stops on failure) -> credential scan of raw keys and string
    values -> Zod strict schema, which also enforces the limit bounds (z.int().min().max() from the registry, so the editor
    schema carries minimum/maximum) -> cross-field rules only when the structure is valid. A structurally broken policy
    therefore reports structural and credential errors only.
  - Messages: value excerpts are detector-redacted, truncated to 80 code points, control characters as \uXXXX, Markdown-active
    characters (backslash, backtick, * _ [ ] < > the pipe character ~ # & @) backslash-escaped; paths are redacted and
    control-escaped only. Line/column come from the new parseStrictYamlDocument positions map (a missing key takes its
    nearest present ancestor's position; loader-level Dockerfile failures have none).
  - Redaction: 8 built-in detectors (private-key, github-token, aws-access-key-id, provider-api-key, jwt,
    authorization-header, bearer-token, url-credentials); safe subset rejects backreferences, lookaround, named groups and
    other `(?` constructs except `(?:`, nested quantifiers, EVERY repeated group containing an alternation (a conservative
    superset of overlapping branches), patterns over 256 characters, and patterns matching the empty string; patterns run
    with flags gu in an inline `eval: true` worker thread; zero-length matches are left unchanged. Failure causes:
    input-too-large, timeout, failed -> infrastructure; invalid-pattern -> policy-invalid.
  - Public subset section contents: categories (linked_issue, references, reproduction, regression_test per category);
    evidence_requirements (PR required_fields per category, issue defect/proposal field lists, free_form); unrequested_change;
    modes (default, per category effective mode plus promotes_passed_draft = mode is not observe); attachment_caps (count,
    file_bytes, total_bytes, decompressed_bytes); dismissal_codes (built-in plus project, with definitions); supported_versions
    (version, supported, support_ends; no branch); inference_admission (all, maintainer-approved, or null). Reference-host
    allowlists and attachment destinations/formats are not published.
  - Records: field names chosen here from the brief's content lists (see step files 2.8, 2.12, 2.13, 2.16); submission
    fields are a strict object over the 18 canonical field ids (z.partialRecord was verified to drop a __proto__ key
    silently); maintainer-action scope is a union over five scope types coupled to kind; metrics-event is discriminated on
    kind with a strict payload.
  - Template choices: registry runner docker.io/library/debian:stable-slim; one command `test` = [make, test] in `.`; one
    Linux container platform; llm copilot-sdk + github-token, placeholder model, temperature null, structured_output any;
    stages consistent with regression_test (fix-verification exactly for bugfix and security; challenge for bugfix,
    feature, security; challenge_rounds 2); modes observe with per_category {}; evidence orphan-branch
    patch-steward-evidence, pages false, private_repository false; attachments destinations [github.com], formats
    [png, jpg, txt]; empty lists elsewhere with entry-shape comments; no yaml-language-server $schema line (the schema file is
    not installed next to the policy).
- Execution (supervisor, 2026-09-26): 2.1-2.18 ran in worktrees C:/Users/John/Projects/steady-orchard/m3-w<id> in waves
  W1-W5 exactly as planned and merged with `merge(patch-steward-m3): step <id>`; 2.19 and 2.20 ran in the main tree. Every
  step passed its acceptance first try under supervisor re-verification, but gate 2.20 (8cb93a7) found G2 FAIL: step 2.9's
  it.each over objects rendered titles as objects. Corrected in flight (step file 2.9 gained A5 on rendered titles, 1150b29),
  2.9 retried in the main tree (6dbde34), 2.20 re-run OVERALL: PASS (6bf9094). Phase DoD re-verified by the supervisor in the
  main tree after 6bf9094: toolchain gate exit 0 (42 files, 697 tests); 56 named DoD titles passed; bounds table 41 rows for
  each of four cases; pinned reference fixture codes and detail paths (execution.platforms.0.commands.1, runner.image.path,
  execution.commands.1.id); prettier templates fixtures clean; no .yml under invalid/hostile; no planning ids in templates or
  fixtures; diff since e03b626 limited to packages/core/src, templates, fixtures, development-artifacts. No brief amendment.
- Lesson for later decompositions: acceptance for it.each-titled tests must check rendered titles (Vitest JSON reporter),
  never the source literal; `%s` with object rows renders the object.
- Emergent contracts for Phases 3 and 4:
  - Package root (after 2.19) exports loadPolicy(source, options?) -> Promise<Result<LoadedPolicy, PolicyLoadFailureCode>>
    with PolicySource { kind: 'git', repoDir, ref } or { kind: 'file', path }; LoadedPolicy { revision, policy
    (ResolvedPolicy), authoritative }; revision { kind: 'git-tree', id, commit, ref } or { kind: 'local-file', id, path };
    policyWarnings(resolved); LLM_MODEL_PLACEHOLDER; derivePublicSubset; policyRevisionRecord; validatePolicyBytes;
    resolvedPolicySchema; policyEditorJsonSchema; POLICY_LIMITS; every record schema; redactText.
  - Recommended `steward policy` exit mapping (I7): exit 1 for every policy.* validation code, every yaml.* code,
    git.policy-directory-missing, git.not-a-directory, git.entry-missing, git.entry-not-regular, git.blob-too-large,
    file.too-large; exit 2 for git.unavailable, git.not-a-repository, git.invalid-ref, git.ref-unresolvable, git.timeout,
    git.output-too-large, git.failed, git.malformed-output, git.object-missing, git.invalid-object-id, file.not-found,
    file.not-a-file, file.unreadable, policy.resolve-failed.
  - Invariant-7 conformance: the integer keys of the policy schema are the `type: 'integer'` nodes of
    policyEditorJsonSchema() (version exports as a number const, not an integer); each integer key path must equal a
    POLICY_LIMITS path. Invariant-5: resolvedPolicySchema re-validates every resolved policy.
  - Phase 4 documentation quotes the codes, detector ids, safe-subset rules, public subset contents, and template choices
    above, plus the Phase 1 YAML rules (leading BOM stripped, directives rejected).

### Phase 3 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m3): phase 3 steps`), base 4b6047b. No
  brief amendment. No new dependency; no network. packages/core/src/index.ts unchanged: every name the CLI and the
  conformance tests need is already exported from the package root.
- Dependency graph and waves (scopes pairwise disjoint within a wave; merge order within a wave is free):
  - W1 (parallel, 6): 3.1 CLI policy command + unit tests; 3.3 invariant-2; 3.4 invariant-5 (unit + fixture tier); 3.5
    invariant-7; 3.6 never-pass (7 injected git failures, 35 non-content failure codes, 19 failure causes); 3.7
    never-pass-content (14 yaml.* + 16 policy.* codes). No dependencies among them.
  - W2: 3.2 (depends on 3.1): cli.ts runCli dispatcher, main.ts (shebang, top-level await), index.ts re-exports, index.test.ts
    rewritten, policy-command.fixture.test.ts, package.json bin.
  - W3: 3.8 gate (verification only; MAIN tree). Critical path 3.1 -> 3.2 -> 3.8.
- Environment / bootstrap:
  - Short worker worktree paths (C:/Users/John/Projects/steady-orchard/m3-w<id>); `pnpm install --frozen-lockfile` per new
    worktree, sequentially. Every step's A2 runs `pnpm build`; 3.1 (A6, A7) and 3.2 (A5) execute the built cli dist.
  - 3.1, 3.2 (index test only via usage paths), and 3.3 build temp git repositories under os.tmpdir() with an isolated git
    config; 3.5 and 3.6 spawn node subprocesses and redaction worker threads (slower suites).
  - 3.2 adds `"bin": { "steward": "./dist/main.js" }`: verified pnpm-lock.yaml unchanged and `pnpm install --frozen-lockfile`
    passes (checked in the main tree, then reverted).
  - 3.8 runs IN the main tree after 3.1-3.7 are merged and the tree is clean.
- Couplings:
  - 3.2 imports runPolicyCommand, PolicyCommandContext, PolicyCommandExitCode, POLICY_USAGE, FILE_SOURCE_NOTICE from 3.1's
    module (names pinned in 3.1).
  - 3.6 and 3.7 share the title pattern 'failure code %s never yields pass' (35 + 30 = 65 distinct titles; the gate counts
    65). Each table is compile-time exhaustive over its unions (mapped type checked by `pnpm typecheck`); together they cover
    every exported failure-code union of core (git, file, yaml, policy validation, policy resolve, process, canonical-json,
    redaction, public-subset, record). A new failure-code union added to core later must be added to one of these tables by
    hand (not auto-detected).
  - 3.4 pins the package-root functions matching /^(load or validate or resolve)/ (loadPolicy, resolveCommit, resolvePolicy,
    validatePolicy, validatePolicyBytes); a new such export fails the test until its rejection case is added.
  - 3.5's editor-schema walker fails on $ref, $defs, definitions, patternProperties, prefixItems, if, or not (the live export
    uses none; verified 41 integer paths equal POLICY_LIMITS with matching min and max; number paths are exactly version and
    llm.generation.temperature).
  - 3.8 checks titles pinned in 3.1-3.7 via the Vitest JSON reporter (rendered titles; Phase 2 lesson).
- Decisions taken at decomposition (within the brief's latitude; no gate or DoD changed; verified with a scratch prototype
  against the Phase 2 core dist, including the project DoD item 2-5 commands and all 24 fixtures):
  - Git flow: resolveCommit(ref) -> readPolicyTreeId(commit) -> loadPolicy({ ref: commit }), so every read uses one commit
    and an invalid policy still reports its tree id as `revision`; loader.ts is unchanged (its failure carries no revision).
    File source: after a content failure (yaml.* or policy.*) the CLI re-reads the file (at most K1 bytes) to report
    local:<sha256>; file.* failures report revision null.
  - JSON report exactly { schema_version: 1, valid, authoritative, source, revision, notice, errors, warnings }, compact, one
    line. source = { kind: 'git', ref, commit (null when unresolved) } or { kind: 'file', path as given } or null (usage
    errors). errors[] = { code, path, message, line, column } from failure details, or one entry built from the top-level
    failure when details are empty. authoritative is true only for a valid policy read from git. Notices: git
    `authoritative only if <ref> is current; no fetch was performed`; file `non-authoritative: a local file never governs a
    run`.
  - Human output on stdout: `policy: valid` or `policy: invalid` or `policy: unavailable` (exit 0, 1, 2); `source: file
    <path>` or `source: ref <ref> -> commit <sha>` or `source: ref <ref>`; `revision: <id>` or `revision: none`;
    `notice: <notice>`; per error `error <code> <path, or - when empty> <message>` plus ` (line L, column C)`; on failure a
    final `outcome: inconclusive; no default was substituted`. Warnings on stderr `warning <code> <path> <message>`.
  - Usage errors (exit 2; stderr `error <code> <message>` then the usage line; with --json also a JSON report on stdout with
    source, revision, notice null): usage.unknown-option, usage.invalid-arguments, usage.conflicting-options; dispatcher
    usage.missing-command, usage.unknown-command; `steward help`, `--help`, `-h` print usage and exit 0. An unexpected
    exception yields steward.internal-error, exit 2.
  - Exit mapping FAILURE_EXIT_CODES exactly as the Phase 2 notes recommended (I7).
  - The cli smoke `stewardGreeting` is removed (cli index.ts re-exports the CLI API; index.test.ts keeps existing for the
    type-check probe). core `greet` stays exported and tested (still smoke code).
  - Conformance tests import project code only from '../index.js' (public surface); the fixture half of invariant 5 is a
    `.fixture.test.ts` file (fixture tier).
- Emergent contracts for Phase 4 (documentation quotes these): syntax, exit codes, JSON fields, notice texts, human line
  formats, and usage codes above; run from source with `pnpm build` then `node packages/cli/dist/main.js policy ...`; the
  package `bin` maps `steward` to ./dist/main.js; conformance directory contents (invariant-2, invariant-5, invariant-7,
  never-pass, never-pass-content). Documentation truth: the cli package no longer holds smoke code; core `greet` remains.
- Execution (supervisor, 2026-09-26): all eight steps passed first try; no retries, revisions, or amendments. W1 (3.1,
  3.3-3.7) ran in parallel in worktrees C:/Users/John/Projects/steady-orchard/m3-w<id> at base a008593 and merged with
  `merge(patch-steward-m3): step <id>` (1c254a2, 05daef2, b7804a9, 3807e6b, 0a6d8f0, 8e012a9); 3.2 (0f14896) and gate 3.8
  (bed4031, OVERALL: PASS) ran in the main tree. Supervisor re-ran every acceptance per step and the phase DoD in the main
  tree after bed4031: toolchain gate exit 0 (50 files, 1020 tests); project DoD items 2, 3, 4, 5, 7 as written (outputs as
  pinned; 'undeclared dockerfile' 2 passed); conformance JSON 274 passed, title counts 9, 24, 41, 41, 41, 8, 65, 19; cli JSON
  50 passed; diff since 4b6047b limited to packages/cli, packages/core/src/conformance, development-artifacts; import
  discipline 0 and 0. packages/core/src/index.ts unchanged. No brief amendment.
- Accepted deviations (cosmetic, not defects against acceptance): never-pass.test.ts writes NUL as `\0` inside template
  literals where the next character is not a digit (legal; the context asked for the six-character escape backslash-u-0000). policy-command.ts has an empty
  `if (report.source === null)` branch with a comment instead of a negated condition.

### Phase 4 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m3): phase 4 steps`), base 1e55b11. No
  brief amendment. Documentation only: no code, dependency, or network. Every fact the steps state was read from the Phase
  1-3 code at 1e55b11 (bounds.ts, catalog.ts, schema.ts, rules.ts, strict-yaml.ts, loader.ts, cli policy-command.ts, and
  live `steward policy` runs).
- Owner note (2026-09-26, relayed by the lead): the `execution.platforms[].commands` design (each platform lists command
  ids) is confirmed. Recorded as decided in ADR-0034, whose four considered options are: full schema with platforms
  listing their commands (chosen), full schema with commands listing their platforms, full schema with no mapping, and a
  minimal schema; More Information notes the owner's confirmation. Stated as decided in architecture §8 (Execution row,
  cross-field rules), processes SP12 (Inputs, step 2), and the configuration reference (Execution keys). No separate
  ADR-0050: project DoD item 9 pins sixteen records and 49 index rows.
- Dependency graph and waves (scopes pairwise disjoint within a wave; merge order within a wave is free):
  - W1 (parallel, 4): 4.1 architecture §8-§9; 4.2 processes.md; 4.3 configuration.md "Policy keys (Available)" section;
    4.4 commands, overview, troubleshooting, installation, usage.
  - W2 (parallel, 2): 4.5 architecture remaining sites plus §12.1 hard-bounds tables (depends on 4.1, same file);
    4.6 configuration.md remaining sections plus docs/user-manual/README.md (depends on 4.3, same file, and 4.4, whose
    new `steward policy` heading its table of contents links).
  - W3 (parallel, 6; each depends on 4.2, 4.5, 4.6): 4.7 ADR-0034-0037; 4.8 ADR-0038-0041; 4.9 ADR-0042-0045;
    4.10 ADR-0046-0049; 4.11 whitepaper; 4.12 README.md and CLAUDE.md.
  - W4: 4.13 ADR index rows (depends on 4.7-4.10; verifies titles and all cross-links after they merge).
  - W5: 4.14 gate (verification only; MAIN tree; project DoD items 1-15 plus Prettier, link integrity, phase scope).
  - Critical path 4.1 -> 4.5 -> (4.7..4.12) -> 4.13 -> 4.14. "Governing document first": architecture, processes, and
    the user manual land in W1-W2; records and summaries (whitepaper, README, CLAUDE.md) in W3.
- Environment / bootstrap:
  - Short worker worktree paths (C:/Users/John/Projects/steady-orchard/m3-w<id>); `pnpm install --frozen-lockfile` per new
    worktree, sequentially. Steps 4.2, 4.3, 4.5, 4.6 run `pnpm --filter @patch-steward/core build` in their worktree
    (their acceptance imports packages/core/dist). No doc step runs Vitest; only 4.14 does, in the main tree.
  - 4.14 runs IN the main tree after 4.1-4.13 are merged and the tree is clean; it temporarily edits two test files for
    the typecheck negative proof and restores them.
- Acceptance conventions (for supervisor re-runs):
  - Region and heading checks compare the working file with REF = HEAD when the file is uncommitted, else HEAD~1 (the
    first parent after the step's commit or merge). Re-run them right after the step's commit or merge, before a later
    step touches the same file.
  - Heredoc scripts in acceptance are shown indented; run them with the bodies and the closing EOF at column 0.
  - Commands avoid double backslashes (the Bash tool collapses them); patterns use `[.]`, `[(]`, and `printf '\140'`
    for a backtick.
- Couplings:
  - architecture.md: 4.1 owns §8-§9 (4.5 A2 keeps them byte-identical); 4.5 owns every other site and adds the only new
    heading, `### 12.1 Hard bounds` (anchor `#121-hard-bounds`). The §12.1 tables are checked row by row against
    POLICY_LIMITS (41 rows) and 24 hard-only constants from bounds.ts. configuration.md links to architecture §12 for
    bounds rather than duplicating the tables.
  - configuration.md: 4.3 owns `## Policy keys (Available)` (16 `###` subsections, all 128 key paths of the editor
    schema, the nine dismissal definitions verbatim, 13 label defaults, 8 detector ids, 8 subset section ids, field ids);
    4.6 owns every other section and must leave both that section and `### TypeScript` (ADR-0049 Source) byte-identical.
    Anchors pinned: `#policy-file-and-revision-available`, `#policy-validation-available`, `#policy-keys-available`,
    `#defaults`, `#evidence`; `#credentials-and-deployment-proposed` is kept (installation.md links it).
  - commands.md: 4.4 adds the heading "## `steward policy` (Available)" (anchor `#steward-policy-available`), linked by 4.6's table
    of contents, troubleshooting, installation, usage, and configuration.
  - ADR slugs and titles are pinned identically in 4.7-4.10 and 4.13; cross-links between new records use file names
    only (no anchors); each ADR step's link check tolerates only not-yet-merged sibling file names.
  - Line counts the DoD pins: CLAUDE.md 2 planning-pattern lines and 3 DF/deferred lines; README.md 0 and 1;
    configuration.md 1 planning-pattern line; whitepaper keeps its one `B7` reference label.
- Decisions taken at decomposition (within the brief's latitude; no gate or DoD changed):
  - ADR-0008 stays unchanged although its consequence "an omitted or unknown provider ... ends the run inconclusive" is
    refined by the optional `llm` section; ADR-0039 records the refinement and links ADR-0008 (its decision stands, so no
    superseded status). The lead may choose to mark it otherwise.
  - README's deferred bullet is corrected from DF01-DF09 to DF01-DF10 on the same line (DoD 11 count unchanged).
  - Unverified GitHub platform numbers (attachment size, label length, private-runner memory) are not stated; §12.1 cites
    the 6-hour job limit, runner sizes in general, and PA02.7, PA09.3, PA08.3-PA08.5, PA05.4.
  - Whitepaper §14 gains a sentence listing the decisions of ADR-0034-ADR-0049 and an open-decision list synced with
    architecture §15. CLAUDE.md's "same change" rule for ADRs, whitepaper §9-§14, and invariants is met at phase level:
    4.7-4.12 share a wave and all merge before the gate.
  - Known dangling pointer outside Phase 4 scope: probes/findings.md "Measured limits" rows cite architecture §15
    "Numerical limits", a bullet this phase removes (the values move to §12.1). probes/ is not in the phase scope; left
    for the lead.
- Execution (supervisor, 2026-09-26): W1 (4.1-4.4) at base b3c12b5, W2 (4.5, 4.6) at d97756a, W3 (4.7-4.12) at 0e89a0e,
  each in worktrees C:/Users/John/Projects/steady-orchard/m3-w<id>, merged with `merge(patch-steward-m3): step <id>`;
  4.13 (955ccf9) and gate 4.14 (a51151a, OVERALL: PASS, 18 of 18 rows PASS) ran in the main tree. Every step's acceptance
  re-run by the supervisor in its worktree before merge; region/heading checks re-run against each merge's first parent.
  Two in-flight acceptance corrections, no decomposer revision, no brief amendment (see Revisions): 4.3 A7 and 4.5 A8
  expected broken=0 while docs/user-manual/README.md (4.6's scope) still linked the three configuration.md anchors 4.3
  removed. 4.3's report carries status fail for the original A7; its recorded A7 output equals the corrected expectation.
  Phase DoD re-verified by the supervisor in the main tree after a51151a: base checks; G1 toolchain exit 0 (50 files,
  1020 tests); G2-G18 outputs exactly as the 4.14 step file expects (DoD items 1-15, Prettier on docs README.md CLAUDE.md,
  link integrity broken=0 over all persistent docs, phase scope limited to docs/adr, architecture, processes, whitepaper,
  user-manual, README.md, CLAUDE.md, development-artifacts; no existing ADR or plan document changed). ADR-0008 unchanged
  (status accepted); ADR-0039 records the refinement and links it. probes/ untouched (the stale §15 "Numerical limits"
  pointer in probes/findings.md is left for the lead). Worktrees and wt/* branches removed; node_modules dirs deleted.
- Accepted deviations (wording only, meaning unchanged, all checks pass): 4.1 §9 table cell starts lowercase "git tree
  id"; 4.4 overview says "the git tree id"; 4.4, 4.5, 4.11, 4.12 reflowed sentences so literal acceptance substrings stay
  on one source line (4.12 README Status reads "are, however, not implemented yet" and leaves a short ragged line
  "probe suite"). Lesson: literal grep -F acceptance on prose must tolerate line wraps or pin the wrap.

## Revisions

<!-- supervisor appends: phase | failed step | revision note | outcome -->

| Phase | Trigger | Revision | Outcome |
| --- | --- | --- | --- |
| 1–4 | owner gate (owner, 2026-09-26, relayed by lead) | owner gate approved: B-table L1–L41 and K1–K12, DC-list, I1–I8 exactly as proposed; I9 accepted plus `steward policy` warning `policy.llm-model-placeholder` (not an error, exit code unchanged) when `llm.model` is `replace-with-model-id`. Scope added: test type-checking gap (tests never type-checked) closed by root `pnpm typecheck` (tsc --noEmit over sources and tests of every package) as Phase 1 first step, in every phase gate and project DoD item 1 and new item 15, CI Typecheck step on ubuntu and windows, persistent-doc corrections, ADR-0049. Phases 2–4 unblocked. Plan document not edited (owner edits it later). | brief amended |
| 1 | decomposer, Phase 1 decomposition (test type-checking step, brief T7) | T7 site list (read at 55d97c5) omitted `docs/user-manual/installation.md`, which lists CI steps (line 13) and verification commands ("Verify the installation" quality-checks block); T7's "any other persistent statement" clause required editing it while roadmap Phase 1 Scope and DoD diff-stat allowlist forbade it. Amended: brief T7 gains the installation.md site (CI sentence gains type-checks; `pnpm typecheck` first in the quality-checks block) and names unchanged sites (ADRs incl. 0020, README CD sentence); project DoD item 15 grep list gains installation.md (six files) plus a CI-sentence grep (strengthening); roadmap Phase 1 Objective, Scope, DoD diff-stat (four → five `docs/user-manual/` files) and Phase 4 risk note updated. Classified consistency correction within owner-approved T7 scope; no gate relaxed beyond admitting the file T7 requires. | brief amended |
| 2 | decomposer, Phase 2 decomposition (policy schema, cross-field rules, fixture corpus; no step run) | Key inventory declared `execution.commands[].id` "referenced by id (I3)" but no key referenced it (nor any component, document, decision id), so the command half of exit criterion 2, I3's command clause, and `undeclared-command.txt` were vacuous and DoD item 3 could pass dishonestly. Amended: key inventory `execution.platforms[]` gains required non-empty unique `commands: [<command id>]` (A §8 Execution "platform matrix"; P SP12 Inputs, step 1); I3 names it as the v1 command reference, states no v1 key references component/document/decision/design-rule ids, adds unique declared ids (`policy.duplicate-id`) and pins codes/paths for Dockerfile location (`policy.invalid-path`) vs git absence (`policy.undeclared-reference`); Validation rules cross-reference bullet expanded; Template writes platform `commands:`; Fixture corpus adds `duplicate-id.txt`, pins expected codes of `undeclared-command.txt`, `undeclared-path.txt`, `duplicate-id.txt`, requires each invalid fixture to carry only its named defect, and adds loader test `undeclared dockerfile`; project DoD item 3 and roadmap Phase 2 DoD check the pinned codes and that test. Classified strengthening (adds a required key and rejection rules that make the owner-approved exit criterion enforceable; relaxes no gate, drops nothing; completes D1 tracing of the §8 platform matrix). | brief amended |
| 2 | supervisor, gate 2.20 G2 FAIL (step 2.9 at 14933ca) | Step 2.9 test used it.each over {id, sample} objects with title %s, so the run-time titles render the object (for example "redacts built-in detector sample { id: 'github-token', ...(1) }") and the eight T-red titles pinned in 2.20 were absent; 2.9 acceptance A4 grepped only the source literal, so it passed on work that missed the contract (it.each over the id strings). Corrected in flight by the supervisor (no decomposer round-trip): 2.9 actions now require it.each over id strings, and new acceptance A5 checks the eight rendered titles via the Vitest JSON reporter. Retry of 2.9 (test file only) in the main tree, then 2.20 re-run. Coupling note for the decomposer: acceptance for it.each-titled tests must check rendered titles, not source text. | step 2.9 corrected in flight; retry passed at 6dbde34 (verified A1-A5 by supervisor); 2.20 re-run |
| 4 | supervisor, step 4.3 A7 (worker commit 71d6af1, report status fail) | Step 4.3 A7 ran the link check over docs/user-manual/*.md expecting broken=0, but 4.3's mandated heading rewrite removes the anchors #named-settings-and-defaults-proposed, #example-policy-fragment-proposed, #documented-policy-areas-proposed that docs/user-manual/README.md links (README is 4.6's scope; 4.6 rewrites its table of contents and its own link check requires broken=0). Honest output cannot satisfy A7. Corrected in flight (no decomposer round-trip): A7 now expects exactly those three README BROKEN lines and broken=3. The worker's commit already holds the correct work and its report records exactly that A7 output; no re-run needed. Coupling note: a step that removes or renames a heading must not require link integrity of files owned by a later step. | step 4.3 A7 corrected in flight; supervisor re-ran A1-A7 against 71d6af1: all match (A7 as corrected) |
| 4 | supervisor, step 4.5 A8 (before launch) | Same coupling as the 4.3 A7 correction: 4.5 A8 link-checks docs/user-manual/*.md expecting broken=0, but at the W2 base docs/user-manual/README.md still links the three configuration.md anchors 4.3 removed, and README is rewritten by 4.6 in the same wave. Corrected in flight before launch: A8 now expects exactly those three README BROKEN lines and broken=3. Link integrity of README is enforced by 4.6 A7 and by gate 4.14. | step 4.5 A8 corrected before launch |
