# patch-steward-m1 — Brief

## Goal

Execute milestone M01 of `docs/project-development-plan.md`: replace the single-package scaffold with the pnpm monorepo of
`docs/architecture.md` §6.1 (decisions 11 and 12) while keeping the CI and CD contracts intact, record the four settled owner
decisions governing-document-first, and update all scaffold documentation — implementing no product behavior.

## Context

### Repository facts (read at commit 8fbfdcd90eff58e30c94397fba3b9fc5b5aeece5 — line numbers below shift as files are edited; re-verify against live files before editing)

- Repo root: `C:\Users\John\Projects\steady-orchard\patch-steward`. Remote: `origin = git@github.com:steady-orchard/patch-steward.git`. Remote default
  branch: `develop`. Release branch: `master`. Working branch for this plan: `milestone/1-monorepo-foundation` (local, checked out).
- Environment: Windows 11. PowerShell is the user's primary shell; Git Bash is available. Verification commands below are written
  for bash. Ubuntu cannot be exercised from this environment: the Ubuntu leg of every exit criterion is verified by CI
  configuration inspection only — no CI run can be triggered from this session.
- `pnpm@10.20.0` pinned via `packageManager`. Dependencies are installed (`node_modules/` present at repo root).
- Current single-package scaffold, tracked files: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`,
  `.prettierignore`, `.gitignore`, `pnpm-lock.yaml`, `src/index.ts`, `src/index.test.ts`, `.github/workflows/ci.yml`,
  `.github/workflows/cd.yml`, `README.md`, `CLAUDE.md`, `LICENSE`, `docs/**`, `development-artifacts/patch-steward-project-ledger.md`.
- There is NO vitest config file anywhere; Vitest 5 runs on defaults from the root.

### Current root `package.json` (verbatim fields that matter)

```json
{
  "name": "patch-steward",
  "version": "0.0.2",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "coverage": "vitest run --coverage --coverage.reporter=lcov",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "packageManager": "pnpm@10.20.0",
  "type": "module",
  "private": true,
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^22.20.2",
    "@vitest/coverage-v8": "^5.0.1",
    "eslint": "^10.10.0",
    "prettier": "^3.9.6",
    "typescript": "^6.0.3",
    "typescript-eslint": "^8.70.0",
    "vitest": "^5.0.1"
  }
}
```

### Current `tsconfig.json` compiler options (must survive verbatim in the shared base config)

`module: nodenext`, `target: esnext`, `types: ["node"]`, `sourceMap: true`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `strict`, `jsx: react-jsx`, `verbatimModuleSyntax`,
`isolatedModules`, `noUncheckedSideEffectImports`, `moduleDetection: force`, `skipLibCheck`. Current file also has
`rootDir: src`, `outDir: dist`, `include: ["src"]`, `exclude: ["**/*.test.ts"]` — the rootDir/outDir/include parts move to
per-package tsconfigs; the `**/*.test.ts` build exclusion must hold in every package.

### Current smoke test (moves verbatim to `packages/core`)

`src/index.ts`:

```typescript
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

`src/index.test.ts` imports `./index.js` (ESM extension rule) and asserts `greet('world') === 'Hello, world!'`.

### Other current configs

- `eslint.config.mjs`: flat config; `@eslint/js` recommended + `typescript-eslint` recommended; `ignores: ['dist/', 'docs/', 'coverage/']`.
  Flat-config ignore patterns are anchored to the config file directory: `'dist/'` does NOT match `packages/*/dist` — the ignore
  list must gain a depth-independent pattern (for example `'**/dist/'`).
- `.prettierrc.json`: `semi`, `singleQuote`, `trailingComma: all`, `printWidth: 132`, `endOfLine: auto`. Unchanged by this plan.
- `.prettierignore`: `pnpm-lock.yaml`, `dist/`, `coverage/`, `node_modules/` (gitignore semantics — these already match at any
  depth; no change needed). Consequence: Prettier checks ALL other files, including `.github/workflows/*.yml`, every `docs/*.md`,
  and every file in `development-artifacts/` — every step must leave its files Prettier-clean (`pnpm format` before committing).
- `.gitignore`: already ignores `dist/` and `coverage` at any depth; no change needed.

### Current `.github/workflows/ci.yml` behavior (contract to preserve)

- Triggers: push to `master`, `develop`, `release/**`; all PRs. `permissions: contents: read`. Concurrency group with
  cancel-in-progress for PRs.
- Job `build-and-test`: matrix `[ubuntu-latest, windows-latest]`, `pnpm/action-setup@v6`, `actions/setup-node@v7` with
  `node-version: lts/*` and `cache: pnpm`, then `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test`.
- Job `lint-and-format` (PRs only, ubuntu): `pnpm lint`, `pnpm format:check`.
- Job `coverage` (only `refs/heads/develop`, needs build-and-test, ubuntu): `pnpm coverage`, then `codecov/codecov-action@v7`
  with `files: coverage/lcov.info`, `fail_ci_if_error: false`, `CODECOV_TOKEN` secret.

### Current `.github/workflows/cd.yml` behavior (semantics frozen)

- Trigger: push to `master` with path filter `package.json` (root manifest only — `packages/*/package.json` does NOT match, which
  is exactly what owner decision 1 requires; do not widen the filter).
- Job `build` (ubuntu, `node-version: lts/*`): install, `pnpm build`, `pnpm test`.
- Job `release`: reads the version with `node -p "require('./package.json').version"` (root manifest), creates tag `v<version>`
  only if absent, and merges `master` into `develop` only when that new tag was created.
- The ONLY permitted change to `cd.yml` in this plan: `node-version: lts/*` → `node-version: 24` in the `build` job. Everything
  else stays byte-identical.

### Target layout (architecture §6.1 plus owner decision 4)

```text
patch-steward/
├── .github/workflows/     ci.yml, cd.yml (reusable steward workflows arrive in later milestones)
├── packages/
│   ├── core/              screening core home; in M01: relocated smoke source + test only
│   ├── cli/               CLI home; in M01: cross-package smoke import of core only
│   ├── action/            GitHub JS action home; in M01: placeholder module + test only
│   └── web/               browser app home; in M01: placeholder module + test only
├── templates/             root directory (NOT a workspace package); in M01: README.md only
├── fixtures/              root directory (NOT a workspace package); shared fixture corpus home
└── docs/
```

### Documentation that this milestone makes stale (quotes read at 8fbfdcd; locate by quoted text, not line number)

| File                                  | Location at 8fbfdcd                                        | Stale or affected text                                                                                                                                                                                                                                                                                                                           | Required direction                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture.md`                | §6.1 lines 190–207                                         | Layout tree lacks `fixtures/`; toolchain paragraph ("Packages share one TypeScript configuration and toolchain") records neither Node version, test tiers, nor versioning policy                                                                                                                                                                 | Governing record: add `fixtures/` to the tree; record Node 24, the four test tiers and where CI runs them, lockstep versioning with root `package.json` as the CD-read manifest, and `fixtures/` as the corpus home                                                                                                                                                                                                                                                   |
| `docs/architecture.md`                | §15 lines 855–895                                          | Lists NONE of the four settled decisions                                                                                                                                                                                                                                                                                                         | Make NO §15 edit; any step that touches §15 is wrong                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `docs/whitepaper.md`                  | §14 lines 752–760                                          | "The monorepo layout in §9 is planned; the current scaffold is a single package."                                                                                                                                                                                                                                                                | Update to: layout implemented, packages contain only toolchain smoke code; keep "No working screening command… is claimed." true                                                                                                                                                                                                                                                                                                                                      |
| `docs/whitepaper.md`                  | §9 table lines 474–483                                     | Already lists `core`/`cli`/`action`/`web`/`.github/workflows`/`templates`                                                                                                                                                                                                                                                                        | No change                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `README.md`                           | Development section lines 70–92                            | "Install Node.js and pnpm."; bullet "src/: sample source and test for toolchain verification."                                                                                                                                                                                                                                                   | Node 24 named; structure list reflects `packages/`, `fixtures/`, `templates/`; `src/` bullet replaced                                                                                                                                                                                                                                                                                                                                                                 |
| `README.md`                           | Automation section lines 94–108                            | CI/CD description                                                                                                                                                                                                                                                                                                                                | Still accurate post-change except Node version; keep claims scaffold-only                                                                                                                                                                                                                                                                                                                                                                                             |
| `CLAUDE.md`                           | Commands                                                   | `pnpm vitest run src/index.test.ts`                                                                                                                                                                                                                                                                                                              | New path `packages/core/src/index.test.ts`; commands otherwise unchanged                                                                                                                                                                                                                                                                                                                                                                                              |
| `CLAUDE.md`                           | Toolchain constraints                                      | "tsconfig `exclude`s `**/*.test.ts`" phrasing assumes single package                                                                                                                                                                                                                                                                             | Reword for monorepo; add Node 24, test-tier conventions, fixture-corpus home, lockstep versioning                                                                                                                                                                                                                                                                                                                                                                     |
| `CLAUDE.md`                           | Project state                                              | "`src/index.ts` and its test are a toolchain smoke test"                                                                                                                                                                                                                                                                                         | New locations; still scaffold-only wording                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `docs/user-manual/installation.md`    | Lines 10, 34, 49, 59, 73; callout lines 16–19              | "Node.js. The CI workflows select `lts/*`."; `[NEEDS INPUT]` says no minimum Node version specified; step text "Compile the sample TypeScript source into `dist/`" (line 34); Sources links `[TypeScript configuration](../../tsconfig.json)` (line 49) and `[sample test](../../src/index.test.ts)` (line 73) — both targets deleted in phase 1 | Node 24 (CI pins 24; CLI engines `>=24`); shrink the callout by exactly the now-settled clause, keep the unresolved clauses (install commands, clone URL, published CLI name, compatibility matrix); update `src/index.test.ts` mention (line 59) to `packages/core/src/index.test.ts`; reword the step-2 text for per-package build output (`packages/*/dist/`); repoint the Sources links to `../../tsconfig.base.json` and `../../packages/core/src/index.test.ts` |
| `docs/user-manual/commands.md`        | Lines 7–29                                                 | Sample test paths `src/index.test.ts`                                                                                                                                                                                                                                                                                                            | New package paths; root commands unchanged                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `docs/user-manual/usage.md`           | Lines 8–26                                                 | Same sample paths                                                                                                                                                                                                                                                                                                                                | Same fix                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `docs/user-manual/configuration.md`   | "Scaffold configuration (Available)" section lines 231–304 | Describes single package; embeds full `tsconfig.json`; ci.yml row says "Node `lts/*`"; eslint row lists old ignores; Sources line links `../../tsconfig.json` (line 303, deleted file)                                                                                                                                                           | Rewrite the section to the new layout: workspace packages, shared base tsconfig + per-package tsconfigs, Node 24, updated eslint ignores; keep the "not screening-policy defaults" framing; repoint the Sources link to `../../tsconfig.base.json`                                                                                                                                                                                                                    |
| `docs/user-manual/troubleshooting.md` | Table lines 15–22                                          | Rows referencing `tsconfig.json` excludes and relative-import example                                                                                                                                                                                                                                                                            | Keep truthful under monorepo wording; minimal edits                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `docs/user-manual/README.md`          | "Sources and documentation gaps" lines 61–64               | Links `[sample source](../../src/index.ts)`, `[sample test](../../src/index.test.ts)`, and `[TypeScript configuration](../../tsconfig.json)` — all three targets deleted in phase 1 (smoke code moved to `packages/core/src/`; root tsconfig replaced by `tsconfig.base.json`)                                                                   | Edit: repoint the three links to `../../packages/core/src/index.ts`, `../../packages/core/src/index.test.ts`, and `../../tsconfig.base.json`; no other change                                                                                                                                                                                                                                                                                                         |
| `docs/user-manual/overview.md`        | —                                                          | No scaffold-layout claims found (re-verified at 7d4c671: no `src/index`, `tsconfig`, or `lts/*` matches)                                                                                                                                                                                                                                         | Verify, expect no change                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Files that must NOT change

`docs/project-development-plan.md`, `development-artifacts/patch-steward-project-ledger.md`, `docs/astra-plan.md` (do not read it
either), `docs/processes.md`, `docs/problem-statement.md`, `docs/deferred.md`, `LICENSE`, `.prettierrc.json`, `.prettierignore`,
`.gitignore`, architecture §15.

## Owner decisions (settled 2026-09-17 — immutable; do not reopen, do not invent alternatives)

1. Versioning: one shared version for all packages. The root `package.json` remains the version source and the manifest the CD
   trigger reads; `cd.yml` path filter and tag logic keep their semantics. Package versions stay in lockstep with root.
2. Node.js: Node 24 only. CLI `engines` is `>=24`; the action runtime targets `node24`.
3. Test tiers: unit, fixture, container, live probe. CI runs unit and fixture tiers on Ubuntu and Windows; the container tier on
   Ubuntu only; the live-probe tier never runs in CI. CI makes no live GitHub or model calls.
4. Shared fixture corpus home: a root `fixtures/` directory, not a workspace package.

## Fixed conventions (planner-set; steps embed these verbatim — defects go back to the planner as amendment notes)

### Packages and versioning

- Package names: `@patch-steward/core`, `@patch-steward/cli`, `@patch-steward/action`, `@patch-steward/web`. All four
  `"private": true`, `"type": "module"`, `"version": "0.0.2"` (lockstep with root). npm-visible naming is finalized at M20;
  these names are internal until then.
- Root `package.json` keeps `name: patch-steward`, `version: 0.0.2`, `private: true`, `packageManager: pnpm@10.20.0`, and the six
  script names with their current meanings (`build`, `test`, `coverage`, `lint`, `format`, `format:check`). Script bodies may
  change; names and observable behavior may not.
- `pnpm-workspace.yaml` with `packages: ['packages/*']`. `templates/` and `fixtures/` are plain root directories with no
  `package.json` — not workspace members.
- All dev tooling stays in root `devDependencies`; bump `@types/node` to `^24` (Node 24 decision). Per-package manifests carry
  only real dependencies: in M01 that is exactly `"@patch-steward/core": "workspace:*"` in `cli`. No other dependencies.
- `engines: { "node": ">=24" }` in `packages/cli/package.json` only (decision 2). No engines field anywhere else.
- No `bin` field anywhere (a `steward` executable would claim product behavior). No `action.yml` (arrives M06). No web
  framework or bundler (arrives M18). No `publishConfig`.

### TypeScript build

- Shared compiler options move verbatim to a root base config (for example `tsconfig.base.json`); each package has
  `tsconfig.json` extending it with `rootDir: src`, `outDir: dist`, `include: ["src"]`, `exclude: ["**/*.test.ts"]`, plus
  whatever `composite`/`references` settings the chosen build mechanism needs.
- Root `pnpm build` compiles all four packages in dependency order (`tsc -b` with project references, or `pnpm -r build` —
  decomposer picks one; it must work identically on Windows and Ubuntu).
- Cross-package resolution: `cli` imports the bare specifier `@patch-steward/core`. `packages/core/package.json` declares
  `exports` (and types) resolving to `dist/` for Node runtime. Type declarations must be emitted (`declaration: true` wherever
  the mechanism requires).
- Root `pnpm test` must pass on a fresh checkout WITHOUT a prior `pnpm build`: Vitest must resolve `@patch-steward/core` to
  source (alias or an equivalent source-resolving mechanism), while plain `node` against `dist/` uses the exports map.

### Tests and tiers

- Tier convention (recorded in this milestone, enforced by Vitest config): filename suffix selects the tier —
  `*.test.ts` = unit, `*.fixture.test.ts` = fixture, `*.container.test.ts` = container, `*.live.test.ts` = live probe. Every
  suffix ends in `.test.ts`, so the build exclusion `**/*.test.ts` covers all tiers.
- Root Vitest config (Vitest 5: use `test.projects` in a root `vitest.config.ts`; `vitest.workspace` files are removed in
  Vitest ≥ 4) makes `pnpm test` and `pnpm coverage` run the unit + fixture tiers across all packages and EXCLUDE
  container/live patterns. No container or live tests exist in M01; the container-tier CI job is added when the first container
  test exists (M07), and the live tier never runs in CI.
- Coverage: root `pnpm coverage` produces ONE merged `coverage/lcov.info` at the repo root (the exact path `ci.yml` uploads).
- Smoke content (exact):
  - `packages/core/src/index.ts` — current `greet` verbatim; `packages/core/src/index.test.ts` — current test verbatim.
  - `packages/cli/src/index.ts` — `import { greet } from '@patch-steward/core';` exporting
    `stewardGreeting(): string` that returns `greet('steward')`.
  - `packages/cli/src/main.ts` — imports `stewardGreeting` from `./index.js` and `console.log`s it. Expected runtime output of
    `node packages/cli/dist/main.js` after `pnpm build`: `Hello, steward!`
  - `packages/cli/src/index.test.ts` — asserts `stewardGreeting() === 'Hello, steward!'`.
  - `packages/action/src/index.ts` and `packages/web/src/index.ts` — a pure `packageName(): string` returning
    `'@patch-steward/action'` / `'@patch-steward/web'`, each with a unit test. Nothing suggesting behavior.
  - Fixture-tier proof: `fixtures/smoke/greeting.txt` containing exactly `world` (single line), and
    `packages/core/src/index.fixture.test.ts` reading it relative to the test file via `import.meta.url`
    (`../../../../fixtures/smoke/greeting.txt` from `packages/core/src/`) and asserting `greet(content.trim()) === 'Hello, world!'`.
    This is the recorded convention for locating the corpus from tests.
- `fixtures/README.md`: states the directory is the shared fixture corpus home (owner decision 4), the tier suffix convention,
  and that corpus entries grow per milestone (plan §0.3). `templates/README.md`: states the directory holds files installed into
  target repositories by `steward init`; content arrives with later milestones (M03 onward); nothing is installed today.

### Workflows

- `ci.yml`: replace `node-version: lts/*` with `node-version: 24` in all three jobs. Triggers, permissions, concurrency, job
  structure, matrix, step order, coverage upload path, and secret usage stay semantically identical. Root commands already
  exercise every package via the workspace, satisfying "CI for every package on Ubuntu and Windows".
- `cd.yml`: the single permitted edit named in Context. Semantics frozen.

### Ordering and hygiene rules for steps

- Exactly ONE step runs `pnpm install` (regenerating `pnpm-lock.yaml`) after all manifests exist, and commits the lockfile. No
  other step touches `pnpm-lock.yaml`.
- `src/index.ts`, `src/index.test.ts`, and the old root-level `rootDir`/`include` tsconfig arrangement are removed in the same
  phase that creates the packages; the old `src/` directory must not survive phase 1.
- Every step runs `pnpm format` on its changed files (or writes Prettier-clean output) before its single commit; Prettier covers
  markdown and workflow YAML.
- Documentation edits follow the recording order of plan §0.3: architecture (governing) first, then whitepaper §9–§14, README,
  `CLAUDE.md`, user manual. Cite stable identifiers (decisions 11/12, §6.1, M01) instead of restating design.
- No document may describe unimplemented behavior as working; keep "Proposed" markers and unresolved `[NEEDS INPUT]` callouts.

## Constraints

- pnpm only; ESM everywhere; `module: nodenext` + `verbatimModuleSyntax`; relative imports carry `.js`; strict TS options listed
  in Context all preserved; tests excluded from `tsc` build and type-checked only under Vitest.
- Branch/CI/CD contract of `CLAUDE.md` "Branches and CI" holds throughout: `master` release branch, `develop` working branch,
  CI on both OSes, lint/format on PRs, coverage upload only from `develop`, CD tags exactly one release per version bump on
  `master` via the root manifest path filter.
- Scaffold only: no screening engine, CLI behavior, adapters, sandbox, workflows beyond ci/cd, or product claims in docs.
- Deferred features (`docs/deferred.md`, DF01–DF10) are never mentioned in version-1 documents.
- Work stays local to branch `milestone/1-monorepo-foundation`; nothing is pushed; no PR is opened.

## Assumptions

- Node 24 and pnpm 10.20.0 are available locally and as GitHub-hosted runner toolchains (`actions/setup-node` `node-version: 24`).
- Network access is available for the single `pnpm install` lockfile step.
- `pnpm format:check` passes at the starting commit; any check failure a step sees on its own files is its own to fix.

## Out of scope

- Any product behavior or its documentation as working; `action.yml`; a `bin`/`steward` executable; web framework selection;
  template or policy content; fixture corpus entries beyond the smoke entry; per-package publishing metadata; GitHub Pages;
  changes to `docs/processes.md`, `docs/problem-statement.md`, `docs/deferred.md`, architecture §15, or any file in the
  must-not-change list; container- or live-tier test implementations; CI jobs for tiers with no tests; correcting unrelated
  documentation defects (for example DF-range wording in README) — send an amendment note instead if one blocks a step.

## Definition of Done (project)

All commands from the repo root on Windows (bash unless noted); `<start>` = `8fbfdcd90eff58e30c94397fba3b9fc5b5aeece5`.

1. `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm lint && pnpm format:check && pnpm coverage` — every
   command exits 0.
2. Layout: `packages/core`, `packages/cli`, `packages/action`, `packages/web`, `fixtures/`, `templates/` exist;
   `test ! -d src` (old root `src/` gone); `pnpm ls -r --depth -1` lists the four `@patch-steward/*` packages at `0.0.2`.
3. Cross-package import: the cli unit test passes under `pnpm test`, and after `pnpm build`,
   `node packages/cli/dist/main.js` prints exactly `Hello, steward!`.
4. Aggregated coverage: `grep "^SF:" coverage/lcov.info` lists files from at least `packages/core` and `packages/cli`.
5. CD intact: `git diff <start> -- .github/workflows/cd.yml` shows only the `lts/*` → `24` node-version change; root
   `package.json` still carries `name`, `version`, `packageManager`; the CD path filter is still exactly `package.json`.
6. CI intact: `grep -c "node-version: 24" .github/workflows/ci.yml` = 3; triggers, matrix, coverage upload path unchanged
   against `<start>` except the node-version lines.
7. Decisions recorded: architecture §6.1 names `fixtures/`, Node 24, the four tiers with their CI placement, and lockstep
   versioning; `git diff <start> -- docs/architecture.md` leaves §15 untouched; whitepaper §14 no longer contains
   "single package"; README, `CLAUDE.md`, and the user manual carry no `lts/*` claim and no stale `src/` path
   (`grep -rn "src/index" README.md CLAUDE.md docs/user-manual/ | grep -v "packages/core/src/index"` → prints nothing; the
   exclusion is required because the mandated new `packages/core/src/index.*` paths contain the same substring).
8. Untouched files: `git diff --stat <start> -- docs/processes.md docs/problem-statement.md docs/deferred.md docs/astra-plan.md docs/project-development-plan.md development-artifacts/patch-steward-project-ledger.md LICENSE .prettierrc.json .prettierignore .gitignore` — empty output.
9. Documentation claims no product behavior: README status, `CLAUDE.md` project state, whitepaper §14, and the user manual still
   describe a scaffold; unresolved `[NEEDS INPUT]` callouts remain.
