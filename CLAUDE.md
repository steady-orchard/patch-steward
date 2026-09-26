# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm build          # pnpm -r build -> packages/*/dist/
pnpm typecheck      # tsc --noEmit over each package's sources and tests
pnpm test           # vitest run
pnpm test:live      # vitest.live.config.ts: *.live.test.ts, read-only against a public test-bed; never in CI
pnpm coverage       # vitest run --coverage (lcov)
pnpm lint           # eslint .
pnpm format         # prettier --write .
pnpm format:check
```

Single test file or case:

```sh
pnpm vitest run packages/core/src/index.test.ts
pnpm vitest run -t 'greets by name'
```

Validate a policy with the built CLI (after `pnpm build`):

```sh
node packages/cli/dist/main.js policy --file templates/policy/policy.yml
node packages/cli/dist/main.js policy --ref origin/HEAD --json
```

Check a draft against a repository's submission contract with the built CLI (reads GitHub; exit 0 met, 1 needs changes or uncertain, 2 usage or environment error):

```sh
node packages/cli/dist/main.js preflight --issue defect --draft fixtures/submissions/defect-complete.txt --repo steady-orchard/patch-steward-testbed-public
node packages/cli/dist/main.js preflight --pr --draft pr.md --json
```

pnpm only; version pinned via `packageManager` in package.json.

## Toolchain constraints

- ESM (`"type": "module"`) + `module: nodenext` + `verbatimModuleSyntax`. Relative imports need the `.js` extension even from `.ts` sources (`import { greet } from './index.js'`).
- Shared compiler options live in root `tsconfig.base.json`; each package's `tsconfig.json` extends it (`rootDir: src`, `outDir: dist`) and `exclude`s `**/*.test.ts`, so `pnpm build` does not typecheck tests. Vitest strips types without checking them; `pnpm typecheck` runs `tsc --noEmit` over each package's sources and tests through `packages/*/tsconfig.test.json`, which extends the package `tsconfig.json`, clears the test exclusion, and in `cli` maps `@patch-steward/core` to core's sources.
- Strict mode plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`.
- Prettier: single quotes, semicolons, trailing commas, printWidth 132.
- ESLint flat config ignores `**/dist/`, `docs/`, `coverage/`.
- Node 24 only: CI pins `node-version: 24`; `packages/cli` declares `engines.node >=24`.
- Test tiers by filename suffix: `*.test.ts` unit, `*.fixture.test.ts` fixture, `*.container.test.ts` container, `*.live.test.ts` live probe. `pnpm test` runs unit + fixture across all packages; container/live suffixes are excluded by the root `vitest.config.ts`; `pnpm test:live` runs the live tier through the root `vitest.live.config.ts` (read-only against a public test-bed repository, with `GH_TOKEN` when set) and never runs in CI. The shared fixture corpus lives in root `fixtures/`.
- `pnpm test` needs no prior build: Vitest aliases `@patch-steward/core` to `packages/core/src`; at Node runtime the bare specifier resolves via core's `exports` map to `dist/`.
- All packages version in lockstep with root `package.json`, which stays the manifest the CD workflow reads.
- `packages/core` depends on `zod` (v4, the single schema source: runtime validation, inferred types, exported JSON Schema) and `yaml` (v2, used only through the strict policy YAML parser); `packages/cli` declares the `steward` executable (`bin`) as `./dist/main.js`.

## Branches and CI

- `master` is the release branch; `develop` is the working branch; `release/**` also builds.
- CI: build + typecheck + test on ubuntu and windows for PRs targeting any branch and pushes to those branches; lint/format only on PRs; coverage uploads only from `develop` (needs `CODECOV_TOKEN`).
- CD triggers on push to `master` **only when package.json changes**: builds and tags `v<version>` if absent; only creation of a new tag triggers the merge of `master` into `develop`. Bumping the version in package.json is what cuts a release.

## Project state

The policy layer and submission intake are implemented; screening is not. `packages/core` holds the policy module (`src/policy/`: load from an explicit git revision, the GitHub API, or a named local file, which is never authoritative; strict YAML and schema validation with hard bounds; the revision, which is the git tree id of `.github/patch-steward/`; documented defaults; the public subset), shared vocabularies, version-1 record schemas (`src/records/`), the redaction module (`src/redaction/`), the submission module (`src/submission/`: versioned field mapping and body parsing, path classes and the built-in trusted and execution-sensitive lists, attachment rules, the policy-change flag, snapshot and claim-scope hashing, the deterministic contract check, issue and PR capture), a read-only GitHub REST adapter (`src/github/`), git diff, merge-base, and remote reads (`src/git/`), a bounded attachment fetcher and archive inspector (`src/net/`), and invariant 1, 2, 5, 6, 7, and 8 conformance tests (`src/conformance/`); `packages/cli` implements `steward policy` and the deterministic part of `steward preflight` (no mandatory commands, no self-review); `templates/` holds the policy template and its editor JSON Schema, the defect and proposal issue forms, and the PR template; `fixtures/` holds the policy, submission, and recorded GitHub response corpora. No workflow runs the contract check; no screening pipeline, other CLI command, LLM adapter, GitHub write, evidence store, sandbox runner, workflow, or browser app exists; `packages/action`, `packages/web`, and core's `greet` are toolchain smoke code. `probes/` holds the platform-assumption probe suite (PA01–PA09) and its findings for disposable test-bed repositories; it is not product code and never runs in CI. Do not describe unimplemented behavior as working.

## Design source of truth

- `docs/problem-statement.md` — numbered failure mechanisms (P01–P11), explicit non-issues (N01–N05), and open issues (O01–O03), each tied to cited sources. New behavior should map to a numbered issue.
- `docs/whitepaper.md` — methodology and goals (§2–§8), plus a summary of the design (§9–§14) that defers to the two documents below.
- `docs/architecture.md` — invariants (§2), trust zones (§4), topologies T1–T4 (§5), components and job roles (§6), GitHub features (§7), policy areas (§8), data model (§9), states and modes (§10), evidence store (§11), controls (§12), threats (§13), traceability (§14), open implementation decisions (§15).
- `docs/processes.md` — processes SP01–SP20 (governance, contributor preflight, screening pipeline, human loop, supporting), each with trigger, steps, controls, failure handling, and measures.
- `docs/adr/` — architecture decision records ADR-NNNN in MADR format (context, considered options, decision outcome, consequences), one per design decision, recording why it was made. They are record only: `docs/architecture.md`, `docs/processes.md`, and the user manual govern.
- `docs/deferred.md` — designs of features excluded from version 1 (DF01–DF10), each with what was removed and what restoring it would touch. It governs nothing in version 1.

Intended architecture: one TypeScript screening core in a pnpm monorepo (`core`, `cli`, `action`, `web`, reusable workflows, templates) shared by a local CLI, GitHub Actions reusable workflows in the target repository, and a static browser app on GitHub Pages with no secrets and no inference. Adapters: LLM behind one provider-independent interface (v1 ships `copilot-sdk`, using the job's `GITHUB_TOKEN` with `copilot-requests: write`, and `openai-compatible`, using a project-supplied key; the trusted policy selects provider, model, and `auth.type`), GitHub REST/GraphQL, Git, container runner, evidence store (orphan branch or separate repo). Single-run orchestration: each event (`pull_request_target`, `issues`/`issue_comment`, merge-queue relay completion via `workflow_run`, `schedule`) is one default-branch workflow run with jobs `gate` → `intake` → `execute` → `assess` → bounded `execute-N`/`assess-N` pairs → `publish`; only `gate` and `publish` hold App tokens, only `intake` and `assess` jobs hold the model credential and never execute submitted code (`env` keys use a separate default-branch-only Environment; Copilot uses job `GITHUB_TOKEN` permissions; no job holds both App and model credentials); no dispatch to a second workflow and no steward-maintained orchestration state (per-submission ownership artifacts and, when the repository gate is active, check runs carry ownership; the run list serves caps). GitHub App identity minted inside Actions; no webhook server, no hosted backend. Version 1 screens issues and PRs in public or private repositories. Private provider disclosure requires installation authorization; public Pages export defaults off for private targets. The core screens repositories in any language by invoking their own build/test tools inside the policy's runner image.

## Documentation conventions

- Precedence when the documents disagree: `docs/architecture.md` governs components and boundaries, `docs/processes.md` governs steps and behavior, and `docs/whitepaper.md` defers to both. Fix the governing document first, then the summaries (whitepaper §9–§14, README, this file).
- Architecture decision records in `docs/adr` (ADR-NNNN) are record only: they record why a design decision was made, while `docs/architecture.md`, `docs/processes.md`, and the user manual govern. When a record and a governing document disagree, the governing document wins and the record's status becomes `superseded by <governing location or ADR-NNNN>`.
- The design docs use stable identifiers: P01–P11, N01–N05, O01–O03 (problem statement); invariants 1–8 and § references (architecture); ADR-NNNN (`docs/adr`); SP01–SP20 (processes); DF01–DF10 (deferred); PA01–PA09 with sub-claims `PA0N.M` (platform assumptions, owned by `probes/findings.md`). Cite them instead of restating behavior, and keep architecture §14 traceability and each process's "Addresses" field consistent when adding one.
- Deferred features live only in `docs/deferred.md`. The version-1 documents (architecture, processes, whitepaper, README, user manual) assume they will not be implemented: no mentions, reserved settings, states, labels, permissions, or interfaces, and no links to `docs/deferred.md` outside the file lists here and in the README, except that an ADR in `docs/adr` may name a rejected alternative in one line by its DF id, with a link to its entry, never restating its design. To defer a feature, move its design there, remove it everywhere else, and simplify; to restore one, follow deferred §0.2.
- `pnpm format:check` covers `docs/*.md`, `docs/adr/*.md`, `README.md`, and this file (`.prettierignore` excludes only `pnpm-lock.yaml`, `dist/`, `coverage/`, `node_modules/`, and `development-artifacts/`, so the pipeline artifacts under `development-artifacts/` are not format-checked). Tables are Prettier-aligned; run `pnpm format` after editing them. ESLint ignores `docs/`.
- After adding or superseding an ADR, or changing architecture §15 open items, the §6.4 job table, or an SP step, update whitepaper §9–§14 and the invariants below in the same change; the whitepaper lagged behind twice during the September 2026 reviews.
- Persistence: planning and implementation documents are eventually removed (milestone briefs and ledgers are kept only until the project post-mortem), so persistent documents never cite them or their identifiers (milestone, plan-decision, owner-decision, and decision-packet ids; step and phase numbers). Persistent documents are everything under `docs/` except `docs/project-development-plan.md` and `docs/astra-plan.md`, plus `README.md`, this file, and `fixtures/`; planning and implementation documents are those two files and everything under `development-artifacts/`. A planning document may cite a persistent one, never the reverse. Exception: `probes/` may hold planning references while implementation uses it, persistent documents may cite its files, and it becomes a persistent regression suite later.

## Invariants any implementation must preserve

These come from the design docs and are easy to violate accidentally:

- PR content, repository files, comments, logs, and LLM output are **untrusted data**. They cannot alter the active policy or authorize tools. A PR may propose policy changes but must not have them govern its own screening run; every report records the policy revision used.
- The policy revision is the git tree id of `.github/patch-steward/` at the trusted commit (`git rev-parse <commit>:.github/patch-steward`), read from git objects, never from a working tree, and not a commit id. The trusted-branch commit at load is recorded for traceability only and never enters snapshot comparison, so unrelated default-branch commits cannot supersede a run. A named local policy file is `local:<sha256>` and never authoritative.
- Submitted code runs in a disposable sandbox with no LLM keys, GitHub write tokens, or host credentials. Git worktrees and plain Node subprocesses are not isolation.
- Fetching a submitted commit onto the runner or a maintainer host is allowed only as inert materialization (SP17): hooks, external filters, automatic submodule commands, and credential persistence disabled; overlay paths validated against traversal and symlink escapes; no repository command run during preparation. Submitted code executes only inside containers. `steward preflight` (T2) uses the separate claim-only unsandboxed runner on the contributor's own checkout.
- Service failure, model refusal, malformed output, or missing evidence must **never** produce a pass.
- Structured LLM responses require runtime validation; TypeScript types do not validate API or model output.
- Screening assesses substance, not authorship — AI assistance alone is not evidence of low quality (N02). Passing checks does not establish project value or authorize merging.
- Bound tokens, runtime, retries, and captured output; every numeric policy limit sits within a hard bound that is a steward constant, which no policy can raise; redact credentials before anything is stored.
- GitHub Models was retired on July 30, 2026. Never reintroduce it or `models: read`. Provider, model, and auth type come from the trusted policy; no default provider is substituted, and a missing or unusable credential, a capability mismatch, or a retired model id ends the run `inconclusive`. A policy without an `llm` section is valid; a run that reaches a model stage without it ends `inconclusive`.
- The Copilot SDK adapter drives an agent runtime: run it in an empty working directory outside any checkout with a fresh `COPILOT_HOME`, no custom-instruction directories, no MCP servers, every built-in tool excluded, and a deny-all permission handler; pass context only in the message. Copilot auto-loads `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` from its working directory, so a checkout there is a prompt-injection channel.
- Sessions A (claim), B (challenge), and C (responsiveness) are context-isolation roles, not the full model-call count. Reference extraction, output interpretation, design and impact analysis, hygiene, repair, and preflight sessions are budgeted separately; nothing carries author prose or A/C history into B.
- Writes made with the App token trigger workflows. Ignore this installation's own echoes (report, usage, and follow-up comment edits; ready-for-review; labels and reactions; the maintenance issue) by verifying installation identity and recorded resource ids, and still process real dependency changes: linked-issue edits, closures, reopenings, recorded maintainer actions, and edits or deletions of response-set comments.
- Observe mode spends inference like enforce mode. Spending controls (contract gate first, hard operational limits, cumulative inference accounting with Copilot soft-credit caps, approximate daily caps, optional `llm.admission: maintainer-approved`) are independent of the operating mode. The optional prior-contribution hold is an explicit newcomer-access tradeoff, with an approval queue and age/abandonment metrics even in observe mode.
- Results from `pull_request` runs are signals, not evidence: the PR controls that workflow definition. They count only when the PR leaves trusted paths (workflows, wrappers, policy, runner, CI scripts) unchanged. Evidence comes from containers started by trusted jobs, but neither isolation nor unchanged paths proves test output is honest: changes to execution-sensitive paths (package scripts, build/test config, reporters, test helpers) require maintainer triage, and baseline comparisons plus independent challenge tests add evidence without guaranteeing integrity.
- A run certifies a snapshot (head, base ref, body hash, linked evidence, author responses, open PRs sharing the head commit, policy revision); the base commit is recorded but never enters snapshot comparison. `gate` deduplicates before cancelling or claiming work, creates a fresh check when the repository gate is active, then uploads the immutable ownership artifact as commitment; unchanged-input queued/held attempts cannot replace active work; `publish` writes evidence first, then completes only its own check, only if the snapshot is unchanged and no later ownership artifact exists. A shared head is `needs-changes` and never gets success/neutral; a required check or any enforcement maps it to `action_required`, otherwise an optional check fails. Queued/held checks remain pending; superseded runs may cancel only their own pending check. Labels are outputs, never inputs; acceptance exists only as a recorded `/steward accept` (issue content hash; PR target plus claim-scope text hash, independent of implementation commits). Request ids and consumed author responses persist across in-place report edits. Policy changes always replace unpublished superseded work; `policy_change` controls already published outcomes only. Enforcement requires strict up-to-date branches or a merge queue; the steward never revokes checks on base movement.
- Outcomes are exactly `pass`, `needs-changes`, `uncertain`, `inconclusive`, `overridden`, `superseded`; rules in the core decide, the model never does.
