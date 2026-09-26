# patch-steward-m3 — Brief

## Goal

Execute milestone M03 ("Policy and data contracts") of `docs/project-development-plan.md`: a policy loaded from an explicit
trusted git revision (or an explicitly named local file marked non-authoritative), validated at runtime, identified by the
git tree id of `.github/patch-steward/`, resolved to effective values, and projected to a public subset; the runtime-validated
shared vocabularies and first versions of every record schema that later milestones share; the `steward policy` command; the
policy skeleton and editor JSON Schema in `templates/`; and governing documentation that describes the real schema. Every
decision is recorded as an ADR and in the governing documents. Owner-added scope: a root `pnpm typecheck` script that
type-checks sources AND tests of every package, run in every phase gate, the project DoD, and CI (see "Test type-checking").

OWNER GATE (see "Owner gate" below): APPROVED 2026-09-26. The bounds table (B-table), the dismissal-code definitions
(DC-list), and the interpretations (I-list, with the I9 addition) in this brief are binding. Phases 2–4 are unblocked.

## Context

### Repository and environment facts (read at commit 55d97c51c07c2ea0bfef3fd463f54fe1708a844d; every line number below was read there and shifts as files are edited — locate text by quotation and re-verify against live files)

- Repo root: `C:\Users\John\Projects\steady-orchard\patch-steward` (Git Bash path `/c/Users/John/Projects/steady-orchard/patch-steward`).
  Remote `origin = git@github.com:steady-orchard/patch-steward.git` (PUBLIC). `git symbolic-ref refs/remotes/origin/HEAD` =
  `refs/remotes/origin/develop`. Working branch `milestone/3-policy-and-data-contracts` (local, not pushed). Nothing in this plan
  pushes, opens a PR, or changes GitHub settings.
- Environment: Windows 11; Git Bash for all commands in this brief. Node `v24.11.0` (verified 2026-09-26; the caller's note
  "Node 22" is stale). pnpm `10.20.0`. git `2.55.0.windows.3`. `core.autocrlf=true` globally: text files committed with LF are
  checked out with CRLF on Windows. Compare committed bytes with `git show HEAD:<path>` or `git rev-parse HEAD:<path>`, never
  working-tree bytes. No `.gitattributes` exists. `jq` is NOT installed.
- Long git-worktree paths break `pnpm test`: phase gates and the project DoD run in the MAIN tree (repo root), never in a
  worker worktree.
- `.gitignore` ignores (among others) `dist`, `out`, `logs`, `*.log`, `pids`, `coverage`, `.cache`, `.temp`, `build/Release`,
  `node_modules/`, `.pnpm-store`, `.claude`. No new file or directory may use those names or the `.log` extension (it would be
  silently untracked).
- Toolchain (root `package.json` scripts): `build` = `pnpm -r build` (tsc per package, topological order, core before cli);
  `test` = `vitest run`; `lint` = `eslint .`; `format` = `prettier --write .`; `format:check` = `prettier --check .`.
  No `typecheck` script exists at 55d97c5; this plan adds it in Phase 1 (see "Test type-checking"). devDependencies: typescript ^6.0.3, vitest ^5.0.1, eslint ^10.10.0, typescript-eslint ^8.70.0, prettier ^3.9.6, @types/node ^24.
- TypeScript (`tsconfig.base.json`): `module: nodenext`, `verbatimModuleSyntax`, `isolatedModules`, `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`,
  `noUncheckedSideEffectImports`. Relative imports need `.js` extensions (`import { x } from './y.js'`). Type-only imports use
  `import type`. Each package `tsconfig.json`: `rootDir: src`, `outDir: dist`, `include: ["src"]`, `exclude: ["**/*.test.ts"]`.
- Vitest (`vitest.config.ts`): two projects. `unit` includes `packages/*/src/**/*.test.ts` excluding `*.fixture.test.ts`,
  `*.container.test.ts`, `*.live.test.ts`; `fixture` includes `packages/*/src/**/*.fixture.test.ts`. Both alias
  `@patch-steward/core` to `packages/core/src/index.ts` EXACTLY — consumers (cli tests) must import only the package root
  `@patch-steward/core`, never a subpath. Tests outside `packages/*/src/` never run. `vitest.config.ts` sets no `typecheck`;
  Vitest strips types without checking them; ESLint is not type-aware; package builds exclude `**/*.test.ts`. So at 55d97c5
  NO command type-checks test files (confirmed by the lead). `vitest.config.ts` stays unchanged; the fix is the separate
  `pnpm typecheck` pass (see "Test type-checking").
- ESLint (`eslint.config.mjs`): `@eslint/js` recommended + `typescript-eslint` recommended; ignores `**/dist/`, `docs/`,
  `coverage/`. No Node globals are declared: bare `process`/`console` in `.mjs`/`.js` files fail `no-undef` — import them
  (`import process from 'node:process'`) or write scripts in TypeScript under `src/`.
- Prettier (`.prettierrc.json`: `semi`, `singleQuote`, `trailingComma: all`, `printWidth: 132`, `endOfLine: auto`) checks every
  file with a known extension not in `.prettierignore`. `.prettierignore` = `pnpm-lock.yaml`, `dist/`, `coverage/`,
  `node_modules/`, `development-artifacts/` (so pipeline artifacts are never format-checked; no exclusion entry is needed).
  Consequences for this plan: (a) `templates/**/*.yml`, `templates/**/*.json`, `fixtures/**/*.yml`, `fixtures/**/*.json`, all
  `docs/**/*.md`, `README.md`, `CLAUDE.md` must be Prettier-clean when committed (`pnpm prettier --check <file>`); Prettier
  rewrites YAML double quotes to single quotes; (b) Prettier cannot parse malformed YAML and `format:check` FAILS on an
  unparsable `.yml` file — malformed or byte-exact fixtures must use the `.txt` extension, which Prettier skips;
  (c) Markdown tables in `docs/` are Prettier-aligned: run `pnpm prettier --write <edited .md files>` after editing (product
  docs only; never on `development-artifacts/`).
- Packages today (smoke code only): `packages/core/src/index.ts` exports `greet`; tests `index.test.ts`,
  `index.fixture.test.ts` (reads `fixtures/smoke/greeting.txt`). `packages/cli/src/index.ts` exports `stewardGreeting`;
  `packages/cli/src/main.ts` prints it; `packages/cli/package.json` has `engines.node >=24`, dependency
  `"@patch-steward/core": "workspace:*"`, NO `bin` entry. `packages/core/package.json` has `exports` `"."` →
  `./dist/index.js` (types `./dist/index.d.ts`) and NO dependencies. `packages/action`, `packages/web`: smoke only, untouched.
- Dependencies: neither `zod` nor `yaml` is a dependency of any package. `yaml@2.9.1` exists in the store only as a transitive
  dependency of vite. Adding them: `pnpm --filter @patch-steward/core add zod@^4 yaml@^2` (updates `pnpm-lock.yaml`; CI uses
  `--frozen-lockfile`, so the lockfile change is committed in the same step). Needs network.
- `yaml` v2 `ParseOptions`/`DocumentOptions` (verified in `yaml@2.9.1` `dist/options.d.ts`): `version` (`'1.1'`, `'1.2'`,
  `'next'`), `schema` (`'core'`, ...), `uniqueKeys`, `customTags`, `merge`, `strict`, `stringKeys`, `prettyErrors`;
  `ToJSOptions.maxAliasCount`. Use `parseAllDocuments` to detect multi-document input; walk the AST (`visit`) to reject
  `Alias` nodes, anchors, and any explicit tag. Verify every API use against the installed version.
- Zod 4: `z.strictObject(...)` rejects unknown keys; `z.toJSONSchema(schema, ...)` exports JSON Schema (refinements such as
  cross-reference checks are not representable — the exported schema is an editor aid; Zod at runtime governs). Verify API
  names and options (for example `io: 'input'` so keys with defaults are optional in the editor schema) against the installed
  version (context7 docs or `node_modules/zod`).
- `templates/README.md` says "Content arrives with later milestones (M03 onward); nothing is installed today." — a planning id
  in a file installed into target repositories; this plan rewrites it (no planning ids).
- `fixtures/README.md` lists current entries (`smoke/greeting.txt`); this plan extends the list.
- `.github/workflows/ci.yml`: build+test on ubuntu-latest and windows-latest (Node 24) for PRs and pushes to
  master/develop/release/**; lint+format only on PRs. CI does NOT run on this unpushed branch. Job `build-and-test` (matrix
  `os: [ubuntu-latest, windows-latest]`) steps: checkout, pnpm setup, node setup, `pnpm install --frozen-lockfile`,
  `- name: Compile` / `run: pnpm build`, `- name: Test` / `run: pnpm test`. This plan adds a `Typecheck` step there (Phase 1).
  `.github/workflows/cd.yml` is not changed.

### Milestone text (verbatim, `docs/project-development-plan.md` "### M03. Policy and data contracts")

```text
Goal: make the quality contract real: a policy loaded from a trusted
revision, validated, and hashed, plus the runtime-validated data model that
every later milestone shares.

Design scope: SP01 steps 1, 3 (revision identity), 4, 5; §8, §9, §10 vocabularies, §12 bounds; §6.5 `steward policy`; invariants 2, 5, 7
Addresses: P01, P09, O02
Depends on: M01

Outputs:
- Policy module: load from an explicit trusted revision, or from an explicitly
  named local file marked non-authoritative; validate; expose typed settings;
  compute the revision identifier; derive the public subset (§6.6).
- Shared schemas and vocabularies: outcomes, waiting states, classifications,
  finding severities, label families, dismissal codes, failure causes.
- `steward policy`: validate a policy and show the revision that would govern.
- The policy skeleton in `templates/`, with the default dismissal-code
  catalog.
- Configuration documentation that describes the real schema.

Exit criteria:
- An invalid or missing policy yields a typed failure with a maintainer-facing
  message; no default is substituted (SP01 failure handling).
- Unknown keys, limits above hard bounds, and undeclared referenced paths or
  commands are rejected.
- The revision identifier is identical for identical policy-directory content
  on Windows and Linux, unchanged by commits outside the directory, and
  changed by any content change inside it.
- The skeleton validates, represents every §8 area, and holds credential
  references only.
- The public subset holds the `data/policy.json` content of §6.6 and nothing
  the policy marks non-public.
```

### Plan-wide DoD items that apply (plan §0.3)

| §0.3 item | How it applies here |
| --- | --- |
| Build, tests, lint, format pass (Ubuntu and Windows); tests type-checked | Tests were NOT type-checked before this plan (see "Test type-checking"); `pnpm typecheck` is added in Phase 1 and runs in every gate and in CI on both OSes. Run locally on Windows in the main tree. Ubuntu is not runnable locally and CI does not run on this branch: OS-independence of the revision id is demonstrated by tests asserting fixed constants built from bytes constructed in code (see "Revision identity"). CI on the lead's PR to `develop` covers Ubuntu later. |
| Runtime validation; handled as data | Policy YAML, git plumbing output, and every record crossing into core are validated at runtime (invariant 5). Policy content reaches no shell (commands are argv arrays, never interpreted on the host), no workflow expression, no authorization decision (invariant 1). Validation messages quote bounded, escaped excerpts only, because proposed policies from PRs are validated as untrusted data later (SP01 step 2). |
| Injected-failure tests, never `pass` | The git policy source, the file source, YAML parsing, and validation each have injected-failure tests; every failure is a typed failure with outcome `inconclusive`; nothing yields `pass`. |
| Limits under hard bounds; redaction before persistence | Every numeric policy limit has a core hard bound (B-table); every subprocess call, parse, list, string, and record field is bounded by a constant (B-table constants). Redaction module delivered with built-in detectors; nothing is persisted by this milestone. |
| No decision input from authorship | No decision logic is added; schemas carry no authorship, AI-assistance, account-age, or presentation field used for decisions (the author login appears only as identity for caps/admission per §9 and SP19). |
| Fixture corpus grows | `fixtures/policies/` valid, invalid, hostile policies and injection text (see "Fixture corpus"). |
| Decisions recorded governing document first | ADR-0034–ADR-0048 plus governing documents (see "ADR inventory", "Documentation change inventory"). §15 shrinks; §14 and SP01 "Addresses" stay consistent. |
| Documentation describes only what was delivered | README status, `CLAUDE.md` project state, user-manual markers and `[NEEDS INPUT]` callouts updated for delivered scope only. |
| Invariant conformance checks (plan §7.3) | First checks for invariants 2, 5, 7 in `packages/core/src/conformance/`; they stay in the suite. |
| Every process step records evidence and metrics | Not applicable: no process step is delivered at runtime. |
| Merge into `develop`; 0.x release | Lead and owner actions outside this plan. |

### Owner decisions (settled 2026-09-26, binding; restated from the lead's prompt)

- D1 Schema depth: full v1 keys for every §8 area now, each key traced to a design-doc statement; later milestones add keys only
  additively.
- D2 Versioning: integer `version: 1` in the policy, `schema_version: 1` in every record. Optional additions keep the version;
  removal, rename, or semantic change bumps it. An unknown version is a typed failure, never pass. Before 1.0, bumps need no
  migration of test-bed evidence. This is "the rule for evolving schemas" (§15) and is written into the governing docs.
- D3 Zod 4 is the single source: runtime validation and inferred TypeScript types; strict objects reject unknown keys; JSON
  Schema exported from it (editor schema for policy.yml ships in `templates/`; later milestones reuse the export for LLM
  response schemas).
- D4 YAML strictness: YAML 1.2 core schema; duplicate keys, custom tags, anchors/aliases, and multi-document files rejected;
  byte-size bound.
- D5 Revision identifier: the git tree object id of `.github/patch-steward/` at the trusted commit, read from git objects (not
  the working tree): OS-independent by construction, one GitHub API call in Actions, checkable with
  `git rev-parse <commit>:.github/patch-steward`. An explicitly named local file gets `local:<sha256 of bytes>` and is marked
  non-authoritative. Docs that say "content hash" are updated to say exactly this.
- D6 `llm` section optional. Absent: policy valid, deterministic stages run, any run that reaches a model stage ends
  `inconclusive` (docs that say an omitted provider ends "the run" inconclusive are updated accordingly). Present: `provider`,
  `model`, `auth.type` required; pairing enforced (`copilot-sdk` with `github-token`; `openai-compatible` with `env`);
  `options.base_url` required for `openai-compatible`, https only except loopback; the `env` credential is the fixed variable
  `STEWARD_LLM_API_KEY` (closes that half of the §15 "local credential conventions" item; reuse of the user's Copilot login
  stays open). No default provider or model is ever substituted.
- D7 Omitted keys: every key required except those whose default the design states — `llm.admission` (`all`),
  `unrequested_change` (`propose-first`), runner execution network (`none`), `policy_change` (D8), free-form submissions (D9),
  label names (D10). The resolved policy records effective values. The template writes every key explicitly.
- D8 `policy_change` default: `enforced`.
- D9 Free-form submissions default: `false` (an unstructured submission is `needs-changes` with a link to the template and
  assistant, per SP06 step 3).
- D10 Labels: the §10 families verbatim as defaults — `steward:queued`, `steward:awaiting-approval`, `steward:screening`,
  `steward:pass`, `steward:awaiting-author`, `steward:triage`; `claim:supported-defect`, `claim:intended-behavior`,
  `claim:feature-request`, `claim:accepted-proposal`, `claim:proposal-pending`, `claim:duplicate`, `claim:uncertain`. Each name
  overridable per state in the policy. Planner chose colors and descriptions (see "Label defaults").
- D11 Dismissal catalog: the nine SP01 codes (`no-reproduction`, `intended-behavior`, `not-applicable-version`,
  `unsupported-claim`, `fabricated-reference`, `duplicate`, `out-of-scope`, `insufficient-benefit`, `proposal-required`) are
  built-in, stable, kebab-case. Definitions drafted by the planner (DC-list), OWNER REVIEWS THEM. Projects may add codes with
  definitions but cannot remove or redefine built-ins (O02).
- D12 Public subset: at most the §6.6 `data/policy.json` allowlist; the policy may exclude whole subset sections only; for
  private target repositories the subset is off unless the policy explicitly enables it.
- D13 Hard bounds: constants in `core`, versioned with the steward, never settable by policy. Planner proposes the full numeric
  table (B-table), OWNER APPROVES before implementation. All values provisional (revisited with replay and observation
  measurements).
- D14 Redaction patterns (Evidence area): built-in credential detectors always on; the policy may add regular expressions
  restricted to a safe subset (no backreferences, no lookaround, length-bounded), applied under size and time bounds.
- D15 CLI: `steward policy [--ref <ref> | --file <path>] [--json]`. Default ref is local `origin/HEAD`, read from git objects
  with no fetch; output shows ref, commit, tree id, and states that authority requires the ref to be current. `--file` output
  is marked non-authoritative. Exit codes: 0 valid, 1 invalid policy, 2 usage or environment error.
- Owner-accepted assumptions: policy module in `packages/core`; `steward policy` in `packages/cli`; skeleton and exported JSON
  Schema in `templates/`. First versions of all record schemas — submission, run, execution record, finding, decision, report,
  maintainer action, metrics event — plus the policy-revision record, each carrying every field §9 lists; later milestones
  extend additively. Canonical JSON for hashing is RFC 8785 (JCS). Each decision becomes its own ADR (next id ADR-0034; Deciders:
  project owner; Date 2026-09-26; README index updated), then governing documents are updated. The 0.x release after M03 is the
  owner's version bump on `master`, outside this milestone.

### Owner gate

- Status: APPROVED 2026-09-26 (project owner, relayed by the lead developer).
  - B-table (L1–L41, K1–K12): approved exactly as proposed. Values are provisional, revisited in later measurement milestones.
  - DC-list (nine built-in definitions): approved exactly as proposed.
  - I1–I8: accepted as recommended.
  - I9: accepted, with one addition (applied in place in I9, "`steward policy`", and the DoD): `steward policy` emits a
    WARNING (not an error; exit code unchanged) when `llm.model` equals the template placeholder `replace-with-model-id`.
  - Scope addition: test type-checking (`pnpm typecheck`), see "Test type-checking".
- Phases 2–4 are unblocked. Phase 1 still defines no numeric bound constant, dismissal definition, canonical field-id list, or
  I-list behavior: that is now a phase boundary (Phase 2 encodes all approved values), not a gate. Phase 1 code takes every
  bound as a required parameter.

### B-table — hard bounds and provisional template values (APPROVED 2026-09-26; provisional values, revisited in later measurement milestones)

Semantics: "Template value" is what `templates/policy/policy.yml` writes; it is NOT a runtime default (D7: these keys are
required; nothing is substituted). "Min" and "Hard max" are core constants; a policy value outside [Min, Hard max] is rejected
with `policy.limit-out-of-bounds`. All values are integers and provisional. Basis cites documented platform limits and M02
measurements in `probes/findings.md` (Measured limits). MiB = 1048576 bytes.

Policy-settable limits:

| Row | Key | Unit | Template value | Min | Hard max | Basis |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | `runner.resources.cpus` | vCPU | 2 | 1 | 4 | GitHub-hosted standard Linux runner: 4 vCPU (public repos), 2 vCPU (private repos); a container cannot exceed its runner |
| L2 | `runner.resources.memory_mb` | MiB | 4096 | 512 | 14336 | Standard Linux runner 16 GB (public), less on private repos (verify the runner reference); headroom for the runner and container engine |
| L3 | `runner.resources.pids` | processes | 512 | 32 | 4096 | Fork-bomb bound; parallel compilers need hundreds |
| L4 | `limits.execution.execution_seconds` | s | 1800 | 10 | 7200 | Per-execution wall clock (SP17); GitHub-hosted job limit 6 h (docs.github.com/en/actions/reference/limits) |
| L5 | `limits.execution.run_execution_seconds` | s | 7200 | 60 | 21600 | Sum of a run's executions; 6 h job limit |
| L6 | `limits.execution.executions_per_run` | count | 40 | 1 | 200 | SP11 "total executions are bounded", SP17 per-run caps; 3 round pairs exercised (PA05.4) |
| L7 | `limits.execution.output_bytes` | bytes | 1048576 | 4096 | 8388608 | Captured head and tail per execution (SP17 step 3) |
| L8 | `limits.execution.result_file_bytes` | bytes | 5242880 | 1024 | 33554432 | Per declared result file (SP17 step 3) |
| L9 | `limits.execution.dependency_step_seconds` | s | 600 | 10 | 1800 | Policy-declared dependency step with egress (SP17 step 2) |
| L10 | `stages.challenge_rounds` | round pairs | 2 | 0 | 3 | Policy lowers the pinned workflow's fixed maximum (§6.4, SP11 step 3); 3 pairs exercised (PA05.4); hard max must equal the pinned reusable workflow's expansion when that is fixed |
| L11 | `limits.caps.daily_runs` | runs per UTC day | 50 | 1 | 1000 | Approximate repository-wide cap (§12, SP19 step 1); cap evaluation costs 3 requests (PA09.3); run-list freshness 22 s (PA09.3) |
| L12 | `limits.caps.per_author_concurrent_runs` | runs | 2 | 1 | 20 | Per-author concurrency cap (§12, SP19 step 1) |
| L13 | `limits.github.requests_per_run` | requests | 300 | 10 | 1500 | Token rate limit 5000 requests per hour measured for job, App, and user tokens (PA02.7, PA09.3); hard max is 30 percent of one hour |
| L14 | `limits.github.retries_per_request` | count | 3 | 0 | 5 | Bounded retries (SP19 step 4) |
| L15 | `limits.attachments.count` | files | 5 | 0 | 20 | SP06 step 5 |
| L16 | `limits.attachments.file_bytes` | bytes | 1048576 | 1 | 10485760 | SP06 step 5; GitHub attachment size limits (images 10 MB, other files 25 MB; verify) |
| L17 | `limits.attachments.total_bytes` | bytes | 5242880 | 1 | 26214400 | SP06 step 5 |
| L18 | `limits.attachments.decompressed_bytes` | bytes | 10485760 | 1 | 52428800 | SP06 step 5 decompression bound |
| L19 | `limits.attachments.redirects` | count | 3 | 0 | 5 | SP06 step 5 |
| L20 | `limits.attachments.fetch_seconds` | s | 20 | 1 | 60 | SP06 step 5 fetch time |
| L21 | `limits.references.count` | references | 50 | 1 | 200 | SP07 controls: bounded number of references |
| L22 | `limits.references.fetches_per_run` | fetches | 20 | 0 | 100 | SP07 controls: bounded external fetches |
| L23 | `limits.references.fetch_seconds` | s | 10 | 1 | 30 | SP07 controls: timeouts |
| L24 | `limits.references.fetch_bytes` | bytes | 1048576 | 1024 | 5242880 | SP07 controls; no binary downloads |
| L25 | `limits.references.redirects` | count | 3 | 0 | 5 | SP07 "resolves within bounds" |
| L26 | `evidence.retention_days` | days | 365 | 30 | 1825 | SP18 step 5 retention; Actions artifact retention caps 90 days per repository, 400 per organization (PA02.6) apply to artifacts, not to the evidence store; referenced records are kept regardless |
| L27 | `limits.evidence.run_bytes` | bytes | 10485760 | 65536 | 52428800 | SP18 per-run size caps; GitHub warns on files over 50 MiB and rejects files over 100 MiB |
| L28 | `limits.evidence.write_retries` | count | 5 | 1 | 10 | SP18 step 1 bounded non-fast-forward retries |
| L29 | `limits.stale_check_minutes` | min | 1440 | 360 | 10080 | §6.4 stale timeout; Min = the 6 h hosted-job limit so a live `gate` or `publish` is not reconciled; must exceed the pinned workflow's maximum run duration once job timeouts are fixed |
| L30 | `limits.stage_seconds` | s | 3600 | 60 | 21600 | SP19 step 2 stage timeouts; 6 h job limit |
| L31 | `limits.audit_samples_per_week` | runs | 5 | 0 | 50 | SP03 step 4 bounded random sample; §15 "audit sample sizes" |
| L32 | `follow_through.max_follow_ups_per_cycle` | comments | 1 | 0 | 3 | SP14 step 2 "one concise follow-up per cycle, bounded by policy"; SP14 controls |
| L33 | `hygiene.max_flagged` | items | 10 | 0 | 50 | SP16 controls: "the flagged list is capped" |
| L34 | `llm.limits.model_calls_per_run` | calls | 40 | 1 | 150 | §12 hard bounds on calls; sessions A, B, C plus auxiliary sessions and repairs across 3 round pairs |
| L35 | `llm.limits.retries_per_call` | count | 2 | 0 | 5 | §6.3 rate limiting after bounded retries; the Copilot SDK itself made 3 attempts on a 401 (PA08.3 personal) |
| L36 | `llm.limits.repair_attempts_per_session` | count | 1 | 0 | 3 | SP19 step 5 bounded structured-output repair |
| L37 | `llm.limits.call_seconds` | s | 120 | 5 | 600 | §6.3 wall-clock limit per call |
| L38 | `llm.limits.daily_inference_runs` | runs per UTC day | 30 | 1 | 1000 | §8 Limits "approximate daily run/inference caps"; counted as runs that reach a model stage (I2) |
| L39 | `llm.limits.ai_credits_per_run` (copilot-sdk only) | AI credits | 90 | 30 | 1000 | Soft cap through `sessionLimits.maxAiCredits` (§12); platform minimum session limit 30 credits (PA08.5); overshoot up to 1.709 credits per session (PA08.5); one short send 0.034 credits (PA08.4); cap run mean about 0.82 credits per send (180.982 credits over 220 sends, PA08.3). Because a session needs at least 30 credits of remaining allowance, about 30 credits of each run's allowance are not spendable |
| L40 | `llm.limits.tokens_per_run` (openai-compatible only) | tokens | 400000 | 1000 | 2000000 | §6.3 per-run budget as maximum tokens per run |
| L41 | `llm.limits.output_tokens_per_call` (openai-compatible only) | tokens | 4096 | 256 | 32768 | §6.3 maximum tokens per call |

Hard-only constants (not policy-settable):

| Row | Constant | Value | Basis |
| --- | --- | --- | --- |
| K1 | Policy file maximum size | 262144 bytes (256 KiB) | D4 byte-size bound |
| K2 | Policy YAML maximum nesting depth | 32 | Hostile-input bound; the schema's own depth is under 8 |
| K3 | Policy YAML maximum node count | 20000 | Hostile-input bound |
| K4 | Policy string maximum length | 16384 characters (free-text fields); 512 (paths, globs, URLs); 64 (ids, codes, category and stage names) | Bounded input |
| K5 | Policy list maximum items | 1000 | Bounded input |
| K6 | Project dismissal codes maximum; definition maximum length | 100 codes; 300 characters | D11 |
| K7 | Label name maximum; label description maximum | 50 characters; 100 characters | GitHub label limits (verify) |
| K8 | Redaction: policy patterns maximum; pattern maximum length; input per call maximum; time per call maximum | 50; 256 characters; 8388608 bytes; 2000 ms | D14; input maximum equals L7 hard max |
| K9 | Git subprocess timeout; git text output maximum | 30000 ms; 1048576 bytes (blob reads use K1) | Bounded calls (invariant 7) |
| K10 | Validation errors reported maximum; excerpt of offending value maximum | 100 errors; 80 characters | Bounded messages; proposed policies are untrusted |
| K11 | Record text field maximum; record list maximum; record identifier maximum | 65536 characters (GitHub comment body limit); 1000 items; 256 characters | Bounded stored records (invariant 7) |
| K12 | Supported policy `version`; record `schema_version` | 1; 1 | D2 |

### DC-list — built-in dismissal-code definitions (APPROVED 2026-09-26; encode each definition byte-for-byte as written)

| Code | Definition (one sentence) | Grounding |
| --- | --- | --- |
| `no-reproduction` | The claimed behavior did not reproduce with the supplied reproduction in the claimed supported environment. | SP09 step 4 (setup failures are `inconclusive`, not this code) |
| `intended-behavior` | The reported behavior is what the project intends, as shown by a cited document, test, or recorded decision. | SP08 step 4 |
| `not-applicable-version` | The claim affects only versions the project does not support, and no supported version or target reproduces it. | SP09 step 4; whitepaper §5 |
| `unsupported-claim` | The claim is not backed by the evidence it cites or that the policy requires, so it cannot be validated. | Processes §0.1 "Claim", "Required evidence"; SP08 |
| `fabricated-reference` | The submission cites a file, symbol, quotation, issue, pull request, document section, or version that is definitively absent at the stated revision. | SP07 steps 3 and 5 |
| `duplicate` | The submission repeats an existing issue or pull request, or a previously dismissed claim, without new evidence. | SP08 steps 1 and 5 |
| `out-of-scope` | The submission concerns behavior outside the project's components or supported behavior, such as vendored or third-party code or another application. | SP07 step 4; SP09 step 4 (P04) |
| `insufficient-benefit` | Maintainers decided that the stated benefit does not justify adopting and maintaining the change. | SP05 step 3 (problem and benefit); SP08 step 6 decline by `/steward resolve CODE` |
| `proposal-required` | The pull request implements a feature or design change without an accepted proposal, a maintainer's acceptance of its claim, or a waiver. | §8 Submission; SP08 step 6; SP14 step 2 |

### I-list — interpretations (ACCEPTED 2026-09-26: I1–I8 as recommended; I9 with the placeholder-model warning addition)

Where an item states a recommendation and an alternative, the recommendation is the accepted choice; the alternative is
rejected.

- I1 Canonical submission field ids. The policy must name required fields, but the plan assigns "canonical submission fields and
  the versioned mapping" to M04. Recommendation: M03 fixes the canonical field-id vocabulary now (list below, from whitepaper
  §4, SP05 step 3, SP08 step 4, SP10 steps 1–2, §9 claim scope) and validates `required_fields` against it; M04 keeps the
  rendered-label/heading mapping and adds ids only additively. Ids: defect issue `expected-behavior`, `authoritative-basis`,
  `actual-behavior`, `affected-version`, `reproduction-command`, `expected-result`, `proposed-scope`, `references`,
  `security-claim`; proposal issue `problem`, `benefit`, `existing-decision`, `proposed-scope`, `references`; pull request
  `category`, `problem`, `benefit`, `intended-behavior`, `acceptance-criteria`, `linked-issue`, `regression-test`,
  `test-scaffolding`, `reproduction-command`, `expected-result`, `references`. Alternative: syntax-only ids now, closed list in
  M04 (a validation change that would bump `version`).
- I2 Inference shape. All inference limits live under `llm.limits` (required when `llm` is present), so a policy without `llm`
  carries none; the daily inference cap counts runs that reach a model stage. `llm.generation.temperature` is a number 0–2 or
  `null` (null = the adapter sends no temperature); `llm.required_capabilities.structured_output` is `any` or `native`.
  `copilot-sdk` takes no `options`; `openai-compatible` requires `options.base_url`. `base_url` rejects credentials in the URL
  and the retired GitHub Models hosts `models.github.ai` and `models.inference.ai.azure.com` (strengthening of the CLAUDE.md
  rule never to reintroduce GitHub Models).
- I3 "Undeclared referenced paths or commands" = reference integrity inside the policy: every command reference resolves to a
  declared `execution.commands[].id` — in version 1 the command references are the entries of `execution.platforms[].commands`
  (amended 2026-09-26: the platform matrix of A §8 Execution; P SP12 Inputs and step 1); an entry naming no declared command id
  is rejected `policy.undeclared-reference` at path `execution.platforms.<i>.commands.<j>`. No version-1 key references a
  component, document, decision, or design-rule id; the rule "every component, document, and decision reference resolves to a
  declared id" constrains keys later milestones add. Declared ids are unique within each declaring list
  (`supported_behavior.components`, `supported_behavior.documents`, `supported_behavior.decisions`,
  `supported_behavior.design_rules`, `execution.commands`, `execution.platforms`, `evidence.redaction_patterns`); a repeated id
  is rejected `policy.duplicate-id` at the path of the later entry's `id` (for example `execution.commands.<i>.id`), and a
  repeated entry within one `execution.platforms[].commands` list is rejected `policy.duplicate-id` at
  `execution.platforms.<i>.commands.<j>` (the later entry). Every path or glob is repository-relative POSIX (no leading `/`, no
  `..` segment, no backslash, no NUL or control character, length within K4) — violations `policy.invalid-path`; the runner
  Dockerfile path lies under `.github/patch-steward/runner/` (violation `policy.invalid-path`, checkable for every source) and,
  when the policy is loaded from git, exists as a regular blob in the loaded tree (absent, or not mode 100644 or 100755 →
  `policy.undeclared-reference` at `runner.image.path`; the file source cannot check existence). Existence of document paths
  elsewhere in the repository is checked by the stages that read them, not by the policy validator.
- I4 Redaction safe subset also forbids nested quantifiers (a quantified group that contains a quantifier) and quantified
  alternations whose branches can match the same text, because banning backreferences and lookaround alone does not prevent
  catastrophic backtracking in JavaScript regular expressions; patterns run in a worker thread terminated at the K8 time bound,
  and a timeout fails closed (the caller must not persist the unredacted text).
- I5 Built-in dismissal codes are core constants. The policy key `dismissal_codes` lists project additions only; the template
  shows the built-in catalog with definitions as YAML comments; a project code equal to a built-in code is rejected; the
  resolved policy and the public subset contain built-ins plus additions.
- I6 Public subset for a private target requires `evidence.publication.private_repository: true` in addition to
  `evidence.publication.pages: true`; the template writes `private_repository: false`.
- I7 `steward policy` exit codes: the ref resolves but the policy directory or `policy.yml` is missing, or the content is
  invalid → 1; not a git repository, git unavailable, unresolvable ref, unreadable `--file` path, bad arguments → 2.
- I8 The redaction module (engine, built-in detectors, safe-subset validator) is delivered now, although the plan lists
  "default redaction patterns" under M05; M05 applies it at persistence and may add built-in detectors.
- I9 Keys whose default values the plan assigns to later milestones exist now with conservative template values, and later
  milestones set built-ins or defaults additively: trusted and execution-sensitive built-in path lists and attachment
  destinations and formats (M04); result-file formats, dependency-step network detail, runner image strategy (M07); default
  model (M09; the template writes the placeholder model id `replace-with-model-id`, which validates, and a run with it ends
  `inconclusive` at the model call); security terms and reference-host allowlist defaults (M10). OWNER ADDITION: when `llm`
  is present and `llm.model` equals `replace-with-model-id` exactly, `steward policy` emits the warning
  `policy.llm-model-placeholder` (path `llm.model`); the policy stays valid and the exit code is unchanged (0 when otherwise
  valid). See "`steward policy`".

### Test type-checking (`pnpm typecheck`; owner scope addition 2026-09-26)

Defect (confirmed by the lead): `CLAUDE.md` Toolchain constraints says "Type errors in tests surface only under Vitest.", but
Vitest strips types without checking them, `vitest.config.ts` enables no typecheck, ESLint is not type-aware, and package
builds exclude `**/*.test.ts`. Test files are therefore never type-checked.

Requirements (all delivered in Phase 1, as its first step; every other Phase 1 step depends on it so each worker's acceptance
can include `pnpm typecheck`):

- T1 Root `package.json` gains script `typecheck` running `tsc --noEmit` over the sources AND tests of every package
  (`packages/core`, `packages/cli`, `packages/action`, `packages/web`): every `packages/*/src/**/*.ts` file including
  `*.test.ts`, `*.fixture.test.ts`, and any future `*.container.test.ts` / `*.live.test.ts`. Mechanism is the decomposer's
  choice, for example a per-package `tsconfig.test.json` (or similarly named) that extends the package `tsconfig.json`, sets
  `noEmit: true`, and resets `exclude`, invoked per package from the root script. The compiler options checked MUST be the
  package build's options (extend, do not copy).
- T2 Unchanged: each package `tsconfig.json`, `pnpm build` behavior and output (tests stay out of `dist/`), `vitest.config.ts`,
  `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`. No new dependency (`typescript` is already a root devDependency).
- T3 `pnpm typecheck` exits 0 on the current tree and leaves the working tree unchanged (`git status --porcelain` identical
  before and after: no emitted `.js`, `.d.ts`, or `.tsbuildinfo` files).
- T4 Resolution of `@patch-steward/core` from cli sources and tests: the gate order runs `pnpm build` before `pnpm typecheck`,
  so resolving through core's `exports` map to `dist/index.d.ts` works. Preferred: make typecheck independent of `dist/` by
  mapping `@patch-steward/core` to `packages/core/src/index.ts` with `paths` in the cli check config (mirrors the Vitest
  alias; avoids checking cli against stale core types). If the mapping triggers rootDir errors (TS6059) the config may
  override `rootDir`; if neither works cleanly, rely on build-first ordering and record it as a deviation.
- T5 Negative proof (acceptance, never committed): appending `export const typecheckProbe: number = 'x';` to
  `packages/core/src/index.test.ts` and, separately, to `packages/cli/src/index.test.ts` makes `pnpm typecheck` exit non-zero
  naming that file; after reverting, `git diff --quiet` exits 0 and `pnpm typecheck` exits 0.
- T6 CI: `.github/workflows/ci.yml` job `build-and-test` gains, after the `Compile` step and before the `Test` step:

  ```yaml
        - name: Typecheck
          run: pnpm typecheck
  ```

  It runs on both matrix OSes (ubuntu-latest, windows-latest). No other workflow change; `cd.yml` unchanged. The file stays
  Prettier-clean.
- T7 Persistent documentation corrected in the same Phase 1 step (no planning ids, no step/phase numbers, no reference to
  this plan). New text must not contain the phrases `type errors in tests`, `surface only under Vitest`, or
  `type-checked by the test runner`. Sites (read at 55d97c5; locate by quotation):
  - `CLAUDE.md` Commands block: add a line `pnpm typecheck      # tsc --noEmit over each package's sources and tests` (align
    the comment with its neighbors).
  - `CLAUDE.md` Toolchain constraints bullet beginning "Shared compiler options live in root `tsconfig.base.json`": replace
    the sentence "Type errors in tests surface only under Vitest." with a true statement: Vitest strips types without
    checking them; `pnpm typecheck` runs `tsc --noEmit` over each package's sources and tests (plus the check-config
    mechanism in a few words).
  - `CLAUDE.md` Branches and CI: "CI: build + test on ubuntu and windows" → "CI: build + typecheck + test on ubuntu and
    windows".
  - `README.md` Development command block: add `pnpm typecheck` after `pnpm build`; Automation "CI builds and tests on Node
    24" → "CI builds, type-checks, and tests on Node 24".
  - `docs/user-manual/commands.md` "Development commands (Available)": add a table row for `pnpm typecheck` (purpose:
    type-check each package's sources and tests with `tsc --noEmit`; no output files) and add `pnpm typecheck` after
    `pnpm build` in the "Documented verification sequence" block.
  - `docs/user-manual/configuration.md`: `.github/workflows/ci.yml` table row ("build/test on Ubuntu and Windows" → include
    typecheck); TypeScript section: after the package `tsconfig.json` block, describe the check config (show it as a `json`
    block if a file is added) and replace "Tests are excluded from every package build, so build success alone does not
    verify them" with text saying the build excludes tests and `pnpm typecheck` type-checks them; Vitest does not.
  - `docs/user-manual/usage.md` "Work on the scaffold" command block: add `pnpm typecheck` after `pnpm build`.
  - `docs/user-manual/troubleshooting.md` row "Build passes without verifying tests": Action → run `pnpm typecheck` (types)
    and `pnpm test` (behavior).
  - `docs/user-manual/installation.md` (line 13 at 223b7dd): "The scaffold's CI runs builds and tests on Windows and Linux."
    → "The scaffold's CI runs builds, type-checks, and tests on Windows and Linux." (keep this sentence on one source line;
    DoD item 15 greps it); section "Verify the installation": in
    the `sh` block after "Then run the documented quality checks:" (at 223b7dd: `pnpm lint`, `pnpm format:check`,
    `pnpm coverage`) add `pnpm typecheck` as the FIRST line, before `pnpm lint`.
  - Unchanged (decision records stay as written): `docs/adr/0020-node-24-only.md` ("CI builds and tests every package") and
    every other file under `docs/adr/`. `README.md` sentence describing the CD workflow ("The scaffold CD workflow builds and
    tests package changes on master") stays: `cd.yml` does not change.
  - Sweep: `git grep -n -i -E 'type errors in tests|surface only under vitest|type-checked by the test runner' HEAD -- docs README.md CLAUDE.md ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
    prints nothing. Any other persistent statement found listing the verification commands or CI steps is updated too.
  - Edited Markdown is Prettier-clean (`pnpm prettier --write` on the edited product docs only; never on
    `development-artifacts/`).
- T8 Decision record: ADR-0049 (Phase 4, with the other ADRs; see "ADR inventory"). Plan document `docs/project-development-plan.md`
  §0.3 also says tests are "type-checked by the test runner"; the owner edits the plan later — do NOT edit it.
- Feasibility (planner, 2026-09-26, at dd39489 with `dist/` built): a temporary config per package extending its
  `tsconfig.json` with `noEmit: true` and `exclude: []` passed `pnpm exec tsc -p` with exit 0 for all four packages.

### Policy v1 key inventory (APPROVED; binding)

Conventions: keys are snake_case; enum values and vocabulary ids are kebab-case; every key is REQUIRED unless marked
`optional (default X)` (D7). Maps keyed by vocabulary ids (categories, label states) use closed key sets. Source refs: A =
`docs/architecture.md`, P = `docs/processes.md`, W = `docs/whitepaper.md`.

```yaml
version: 1                                  # D2; integer; only 1 accepted
supported_behavior:                         # A §8 "Supported behavior"; W §3
  description: <string K4 16384>            # supported-behavior text sessions A and B receive (P SP08 step 3, SP11 step 1)
  environments: [<string>]                  # W §3 "environments"
  platforms: [<string>]                     # A §8 "platforms"
  compatibility: [<string>]                 # A §8 "compatibility guarantees"
  versions:                                 # A §8 "release/support windows and maintenance-branch mappings"; P SP09 step 1; A §6.6 supported versions
    - version: <string>                     # release line identifier as the project names it
      supported: <boolean>
      branch: <string>                      # maintenance or target branch
      support_ends: <YYYY-MM-DD or null>
  components: [{ id: <id>, paths: [<glob>] }]   # A §8 "components"; P SP07 step 4, SP09 step 4
  documents: [{ id: <id>, path: <path> }]       # A §8 "authoritative documents"; P SP07 step 2, SP08 step 2
  decisions: [{ id: <id>, path: <path> }]       # A §8 "decisions"; P SP08 step 2
  design_rules: [{ id: <id>, rule: <string> }]  # P SP10 step 5 "policy-listed design rule"
trusted_paths:
  additional: [<glob>]                      # A §8 "Projects add more"; built-in list is core-owned (I9)
execution_sensitive_paths:
  additional: [<glob>]                      # A §8 "project additions"
categories:                                 # A §8 Categories; closed key set: bugfix feature refactor docs chore security
  <category>:
    required_fields: [<field-id>]           # A §8 Submission "required fields"; P §0.1 Required evidence (I1 vocabulary)
    linked_issue: required | optional       # A §8 Submission "whether a PR must link a validated issue"
    references: required | optional         # A §8 Submission "reference requirements"
    reproduction: required | optional | not-applicable    # P §0.1 Required evidence; P SP09
    regression_test: required | not-applicable            # P SP10 step 1; W §5
submission:
  free_form: <boolean>                      # optional (default false) D9; P SP06 step 3
  unrequested_change: propose-first | triage   # optional (default propose-first) D7; A §8 Submission
  issue_fields:
    defect: [<field-id>]                    # A §8 "Required fields for issues"
    proposal: [<field-id>]
  reference_hosts:                          # P SP07 controls "optional policy allowlist"
    mode: any-public | allowlist
    allowlist: [<hostname>]
  attachments:                              # P SP06 step 5 "approved public HTTPS destinations"; values settled later (I9)
    destinations: [<hostname>]
    formats: [<file extension>]
execution:                                  # A §8 Execution; W §3
  commands:
    - id: <id>                              # unique among commands; referenced by execution.platforms[].commands (I3)
      kind: build | test | lint | static-analysis
      run: [<string>]                       # argv; non-empty; never interpreted by a host shell (P SP17 controls)
      working_directory: <path>
      mandatory: <boolean>                  # mandatory = never removed; non-mandatory = impact analysis may add (A §8; P SP12 step 5)
      result_files: [{ path: <path>, format: junit-xml }]   # A §8 "result file formats"; format enum grows additively (I9)
  platforms:                                # A §8 "platform matrix"; P SP12 steps 1-2
    - id: <id>                              # unique among platforms
      os: linux | windows | macos
      required: <boolean>
      source: container | ci-signal         # container only for linux; ci-signal = policy-permitted CI coverage (A §4)
      ci_workflow: <path under .github/workflows/ or null>   # required for ci-signal, null for container
      commands: [<command id>]              # required; non-empty; entries unique; each a declared execution.commands[].id (I3). Container: the commands run on this platform in the runner container; ci-signal: the commands whose coverage the ci_workflow stands for. A §8 Execution "platform matrix"; P SP12 Inputs, step 1 (amended 2026-09-26)
runner:                                     # A §8 Runner; W §3
  image:                                    # discriminated on source
    source: dockerfile | registry
    path: <path under .github/patch-steward/runner/>   # source dockerfile only (I3)
    reference: <image reference>                       # source registry only
  network: none                             # optional (default none) D7; the only execution value (A §8)
  dependency_step: null | { run: [<string>], working_directory: <path> }   # A §8 "egress only for a policy-declared dependency step"
  resources: { cpus: L1, memory_mb: L2, pids: L3 }    # A §8 Runner "resource limits"
llm:                                        # optional section (D6); A §8 Inference; discriminated on provider
  provider: copilot-sdk | openai-compatible
  model: <model id string>
  auth: { type: github-token | env }        # pairing: copilot-sdk with github-token; openai-compatible with env (D6)
  options: { base_url: <https URL; http only for loopback> }   # openai-compatible only; absent for copilot-sdk (I2)
  generation: { temperature: <0..2 or null> }                # A §8 "generation settings" (I2)
  required_capabilities: { structured_output: any | native } # A §8 "required capabilities"; A §6.3 descriptor
  admission: all | maintainer-approved      # optional (default all) D7
  limits:                                   # I2; L34-L41
    model_calls_per_run: L34
    retries_per_call: L35
    repair_attempts_per_session: L36
    call_seconds: L37
    daily_inference_runs: L38
    ai_credits_per_run: L39                 # copilot-sdk only
    tokens_per_run: L40                     # openai-compatible only
    output_tokens_per_call: L41             # openai-compatible only
stages:                                     # A §8 Stages
  continue_after_blocking: <boolean>        # A §8 "whether to continue after the first blocking finding"; P §0.4
  per_category:                             # A §8 "which stages run per category"; closed category keys
    <category>: [fix-verification | regression | challenge]   # SP07 and SP08 always run and are not listed
  challenge_rounds: L10                     # A §8 "challenge rounds"; A §6.4
  high_impact_paths: [<glob>]               # P SP11 step 6
  reproduction_as_before_evidence: <boolean>   # P SP10 step 3
escalation:                                 # A §8 Escalation
  sensitive_paths: [<glob>]
  security_terms: [<string>]                # P SP08 step 4 "policy-listed terms" (defaults later, I9)
  security_reporting_url: <https URL or null>  # P SP08 step 4 "pointer to the private reporting channel"
limits:                                     # A §8 Limits; L4-L9, L11-L31
  caps: { daily_runs: L11, per_author_concurrent_runs: L12 }
  github: { requests_per_run: L13, retries_per_request: L14 }
  execution: { execution_seconds: L4, run_execution_seconds: L5, executions_per_run: L6, output_bytes: L7, result_file_bytes: L8, dependency_step_seconds: L9 }
  attachments: { count: L15, file_bytes: L16, total_bytes: L17, decompressed_bytes: L18, redirects: L19, fetch_seconds: L20 }
  references: { count: L21, fetches_per_run: L22, fetch_seconds: L23, fetch_bytes: L24, redirects: L25 }
  evidence: { run_bytes: L27, write_retries: L28 }
  stale_check_minutes: L29
  stage_seconds: L30
  audit_samples_per_week: L31
policy_change: all | enforced | manual      # optional (default enforced) D8; A §8 Policy change
modes:                                      # A §8 Modes; A §10
  default: observe | advise | enforce
  per_category: { <category>: observe | advise | enforce }   # partial map: omitted categories use default
follow_through:
  max_follow_ups_per_cycle: L32             # A §8 Follow-through
hygiene:                                    # A §8 Hygiene; P SP16 step 2
  report_flagged: <boolean>
  allowlist: [<login>]
  heuristics: { automated_accounts: <boolean>, near_duplicates: <boolean>, unreferenced_reviews: <boolean>, automated_exchanges: <boolean> }
  max_flagged: L33
evidence:                                   # A §8 Evidence; A §11; P SP18
  store:                                    # discriminated on type
    type: orphan-branch | repository
    branch: <branch name>                   # both types
    repository: <owner/name>                # repository only
  retention_days: L26
  redaction_patterns: [{ id: <id>, pattern: <regex, safe subset D14 + I4> }]
  publication:                              # A §11; D12
    pages: <boolean>
    private_repository: <boolean>           # I6
    exclude: [<public subset section id>]   # D12: whole sections only
dismissal_codes: [{ code: <kebab id>, definition: <string K6> }]   # project additions only (I5)
labels:                                     # optional per state (D10); A §10
  status: { queued, awaiting-approval, screening, pass, awaiting-author, triage: <label name> }   # each optional
  classification: { supported-defect, intended-behavior, feature-request, accepted-proposal, proposal-pending, duplicate, uncertain: <label name> }   # each optional
```

Forbidden content (deferred features, `docs/deferred.md`; version-1 documents and the schema carry no reserved key for them):
no timers or reminder/closure settings (DF01), no security-report submission type (DF02), no hide/minimize/lock/interaction-limit
settings (DF03), no non-GitHub channels (DF04), no webhook settings (DF05), no per-stage model or extra provider ids (DF06),
no browser inference (DF07), no non-container sandbox (DF08), no browser-extension or dashboard-action settings (DF09), no
author-facing submission length caps (DF10).

### Validation rules (policy)

- Order: size check (K1) → UTF-8 decode (fatal; BOM rejected or stripped — decide and test) → YAML parse (D4: YAML 1.2 core,
  one document, no alias, no anchor, no explicit tag, unique keys, string keys only, depth K2, nodes K3) → `version` check
  (missing: `policy.version-missing`; not 1: `policy.version-unsupported`) → Zod strict schema → cross-field rules → bounds.
- Unknown key anywhere → `policy.unknown-key` with the key path. Missing required key → `policy.missing-key`.
- Numbers: integers only for limits; non-finite, non-integer, or outside [Min, Hard max] → `policy.limit-out-of-bounds`
  (message names the key, the value, and the bound).
- Cross-reference (I3) → `policy.undeclared-reference`: an `execution.platforms[].commands` entry naming no declared
  `execution.commands[].id` (path `execution.platforms.<i>.commands.<j>`); when loaded from git, a `runner.image.path` absent
  from the loaded tree or not a regular blob (path `runner.image.path`). Repeated declared id within a declaring list, or
  repeated entry within one `execution.platforms[].commands` → `policy.duplicate-id` (I3 lists the declaring lists and paths).
  Bad path syntax, or a path outside its required location (`runner.image.path` outside `.github/patch-steward/runner/`,
  `ci_workflow` outside `.github/workflows/`) → `policy.invalid-path`.
- `llm` pairing violation → `policy.llm-pairing`; `base_url` violations → `policy.llm-base-url`.
- `challenge` listed in any `stages.per_category` entry requires `stages.challenge_rounds >= 1`; `fix-verification` listed for a
  category requires `categories.<c>.regression_test: required` and the reverse.
- Label names: unique across all 13 labels after defaults, 1–K7 characters, no leading or trailing whitespace.
- Dismissal additions: code syntax `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, length ≤ K4 id max, unique, not a built-in (I5), definition
  1–K6 characters.
- Redaction patterns: safe subset (D14, I4), count and length K8; invalid → `policy.redaction-pattern`.
- Credential values: any string value in the policy matching a built-in credential detector → `policy.credential-value`; the
  message names the key path and never echoes the value (§8 "References only, never secret values").
- Error list capped at K10; each error `{ code, path, message }`; excerpts of offending values truncated to K10 excerpt length
  and escaped (no raw control characters, no Markdown-active characters unescaped).
- Maintainer-facing message: states what is wrong, where (key path; line and column when the YAML layer knows them), and that
  no default was substituted and the run would end `inconclusive`.

### Revision identity

- Git source: resolve `<ref>` to a commit with plumbing; the policy revision id is `git rev-parse <commit>:.github/patch-steward`
  (the tree object id, 40 hex for SHA-1 repositories; accept 64 hex for SHA-256 repositories). The trusted commit id is
  recorded alongside for traceability; it never enters snapshot comparison.
- Local file source: id `local:<sha256 hex of the file bytes>`; `authoritative: false` always. There is no API that marks a file
  source authoritative.
- Inert git access (SP17, invariant 2): only read plumbing (`rev-parse`, `ls-tree`, `cat-file`); `execFile` with an argv array
  (never a shell); `cwd` = the repository; env adds `GIT_TERMINAL_PROMPT=0`, `GIT_OPTIONAL_LOCKS=0`, `GIT_NO_REPLACE_OBJECTS=1`;
  no fetch, no checkout, no hooks, no textconv or filters; `--end-of-options` before any user-supplied ref, and refs beginning
  with `-` rejected; timeout and output caps K9; blob size checked with `ls-tree -l` or `cat-file -s` before reading (K1);
  `policy.yml` must be a regular blob (mode 100644 or 100755), not a symlink (120000) or gitlink (160000).
- In Actions (later milestones) the same tree id comes from one GitHub API call, for example GraphQL
  `object(expression: "<commit>:.github/patch-steward") { oid }` or the contents API entry `sha` for `patch-steward` in
  `.github` at the commit. Recorded in the ADR for D5; not implemented here.
- OS-independence proof (tests): build fixture repositories in a temp directory with plumbing only — `git hash-object -w
  --no-filters --stdin` for blobs, `git mktree`, `git commit-tree` with fixed `GIT_AUTHOR_*`/`GIT_COMMITTER_*` names, emails,
  and dates, and `GIT_CONFIG_NOSYSTEM=1` plus an empty `GIT_CONFIG_GLOBAL` so the user's `core.autocrlf` cannot apply — with
  blob bytes constructed in test code (never read from fixture files, whose working-tree bytes differ by OS under autocrlf).
  Assert: (a) the tree id equals a hard-coded 40-hex constant; (b) the constant equals an in-test pure-TypeScript computation
  of git's tree object hash (`sha1("tree " + len + "\0" + entries)`, entries sorted by git's rules, mode + space + name + NUL +
  20-byte id); (c) a commit changing only a file outside `.github/patch-steward/` leaves the id unchanged; (d) any byte change,
  added file, removed file, or mode change inside the directory (including `runner/`) changes it; (e) an uncommitted
  working-tree edit of `policy.yml` does not change what the loader reads or the id.

### Loader, resolved policy, revision record

- Sources: `GitPolicySource { repoDir, ref }` and `FilePolicySource { path }`; later milestones add a GitHub API source behind the
  same interface.
- Result is a discriminated union: success `{ ok: true, revision, policy (resolved), authoritative }` or failure `{ ok: false,
  failure }`; failure carries `code`, `cause` (`policy-unavailable` for missing or unreadable, `policy-invalid` for validation),
  `outcome: 'inconclusive'`, bounded `errors`, and the maintainer-facing message. No failure path returns a policy.
- Resolved policy = validated policy with the D7 defaults applied (`llm.admission`, `submission.unrequested_change`,
  `runner.network`, `policy_change`, `submission.free_form`, every label name), built-in dismissal codes merged with project
  additions, and `llm` explicitly `null` when absent. It records effective values only; it is the "parsed policy" of the §9
  policy-revision record.
- Policy-revision record (`schema_version: 1`): `revision` (`{ kind: 'git-tree', id, commit, ref }` or `{ kind: 'local-file',
  id: 'local:<sha256>', path }`), `authoritative`, `steward_version`, `policy` (resolved), `loaded_at`.

### Public subset (`data/policy.json`, A §6.6)

- Section ids (closed; D12 exclusions pick from these): `categories`, `evidence_requirements`, `unrequested_change`, `modes`
  (mode per category plus draft guidance: whether feedback-enabled screening can promote a passed draft), `attachment_caps`
  (count, file_bytes, total_bytes, decompressed_bytes), `dismissal_codes` (built-in plus project, with definitions),
  `supported_versions`, `inference_admission` (`all`, `maintainer-approved`, or `null` when `llm` is absent).
- Envelope fields allowed besides sections: `schema_version: 1`, `revision` (the policy revision id).
- Derivation input includes the target repository visibility. Private target: subset disabled unless
  `evidence.publication.pages` and `evidence.publication.private_repository` are both true (I6). Public target: disabled when
  `pages` is false. Disabled is a typed result, not an empty object.
- Never in the subset: runner, execution commands, paths, escalation, hygiene allowlist, redaction patterns, evidence store,
  llm provider/model/options/limits, labels, limits other than attachment caps, supported-behavior description, documents,
  decisions, design rules.
- The subset has its own Zod schema (strict), validated before return.

### Redaction module (D14; I4; I8)

- Built-in detectors (always on): GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` prefixes and `github_pat_`), PEM private
  key blocks, AWS access key ids (`AKIA`/`ASIA` + 16 uppercase alphanumerics), `sk-` style provider keys, JWT-shaped tokens,
  `Authorization:` and `Bearer` header values, URL userinfo credentials (`scheme://user:secret@`). Plus exact-value redaction
  of caller-supplied known secret values (for example the injected `STEWARD_LLM_API_KEY` value; A §13 "injected credential
  values and recognizable token patterns are redacted").
- Policy patterns validated by the safe-subset validator and applied after built-ins.
- Bounds K8; exceeding input size or time fails closed with a typed failure (caller must not persist).
- Replacement marker is a fixed string naming the detector id (for example `[REDACTED:github-token]`).

### Vocabularies (closed enums, exported as Zod enums and TypeScript types)

- Outcomes: `pass`, `needs-changes`, `uncertain`, `inconclusive`, `overridden`, `superseded` (A §10; P §0.1).
- Waiting states (non-outcomes): `queued`, `awaiting-approval` (P SP13 step 1 table).
- Lifecycle label states: `queued`, `awaiting-approval`, `screening`, `pass`, `awaiting-author`, `triage` (A §10).
- Issue classifications: `supported-defect`, `intended-behavior`, `feature-request`, `accepted-proposal`, `proposal-pending`,
  `duplicate`, `uncertain`; PR feature-claim classifications: `accepted-proposal`, `unrequested-change` (A §10; P SP08 step 3).
- Finding severities: `blocking`, `uncertain`, `advisory`, `speculative` (A §9).
- Categories: `bugfix`, `feature`, `refactor`, `docs`, `chore`, `security` (A §8). Modes: `observe`, `advise`, `enforce`.
  Stage ids (configurable): `fix-verification`, `regression`, `challenge`. Submission types: `issue`, `pull_request`; issue
  kinds: `defect`, `proposal`.
- Maintainer action kinds: `override`, `guidance`, `waiver`, `acceptance`, `resolution`, `inference-admission` (A §9).
- Admissibility: `evidence`, `signal` (A §9; P SP17 step 5). Reference status: `verified`, `unverified`, `fabricated` (P SP07).
- Failure causes (each maps to `inconclusive`; P SP19 failure handling, A §6.3, A §12, P SP01, SP06, SP12, D6):
  `infrastructure`, `github-unavailable`, `model-unavailable`, `model-retired`, `credential-unusable` (missing or unusable
  credential, including a disabled Copilot policy, one cause per SP19), `capability-mismatch`, `model-refusal`,
  `malformed-output`, `rate-limited`, `budget-exhausted`, `environment-unavailable`, `baseline-unavailable`,
  `coverage-missing`, `attachment-fetch-failed`, `policy-unavailable`, `policy-invalid`, `llm-not-configured`, `cancelled`,
  `steward-defect`.
- Dismissal code ids: the nine D11 codes (ids are not gated; definitions are, DC-list).

### Label defaults (D10; colors and descriptions chosen by the planner; not gated)

| Label | Color | Description |
| --- | --- | --- |
| `steward:queued` | `c5def5` | Waiting for screening capacity; screening restarts automatically. |
| `steward:awaiting-approval` | `fbca04` | Waiting for a maintainer to admit model-based screening. |
| `steward:screening` | `1d76db` | Screening is in progress. |
| `steward:pass` | `0e8a16` | Screening requirements are met; maintainers decide acceptance. |
| `steward:awaiting-author` | `d93f0b` | Waiting for the author to address the numbered requests in the report. |
| `steward:triage` | `5319e7` | Needs a maintainer decision; see the report's open questions. |
| `claim:supported-defect` | `b60205` | Claim validated as a defect in supported behavior. |
| `claim:intended-behavior` | `bfdadc` | Reported behavior matches documented intended behavior. |
| `claim:feature-request` | `a2eeef` | Describes new behavior rather than a defect. |
| `claim:accepted-proposal` | `0052cc` | Proposal accepted by a recorded maintainer decision. |
| `claim:proposal-pending` | `d4c5f9` | Well-formed proposal waiting for a maintainer decision. |
| `claim:duplicate` | `cfd3d7` | Duplicates an existing issue or a previously dismissed claim. |
| `claim:uncertain` | `fef2c0` | Classification needs a maintainer decision. |

Colors and descriptions are core constants (used by `steward init` later); only names are policy-overridable.

### Record schemas v1 (A §9; each strict, `schema_version: 1`, `record_type` literal; every field §9 lists)

- Common formats: commit id `^[0-9a-f]{40}$` or `^[0-9a-f]{64}$`; content hash `sha256:<64 hex>` over RFC 8785 (JCS) canonical
  JSON bytes (records) or raw bytes (files); timestamps ISO 8601 UTC with `Z`; strings and lists bounded by K11.
- `submission`: repository (`owner/name`), type, number, snapshot hash, target branch and head (PRs); parsed fields (map of
  field id to text), category, linked-evidence hashes, author responses (request id to comment id and hash), open PRs sharing
  the head commit, contract results, trusted-path and execution-sensitive-path flags.
- `run`: Actions run id and attempt; submission reference or merge-group snapshot; base/head or group commit; owned check id
  (nullable); policy revision; steward version; provider; requested and reported model ids; adapter version; generation
  settings; runner identity; mode; timestamps; budget consumption (model calls, tokens, AI credits, container seconds,
  executions, GitHub requests, retries; unknown values `null`).
- `execution-record`: run and plan entry; command (argv); environment identity (image digest, tool versions); exit status;
  bounded output (head, tail, truncated flag, total bytes); declared result files (path, hash, bytes); test identity; commit ids;
  admissibility.
- `finding`: run and stage; severity; scenario; location; evidence references; requirement/expectation basis; dismissal code
  (nullable; kebab syntax).
- `decision`: run; outcome; contributing findings; unmet requirements; requests to the contributor (numbered request ids).
- `report`: run; rendered report; check summary; bound identifiers.
- `maintainer-action`: run and actor; kind; reason; actor; time; immutable scope (override and waiver: PR head and target plus
  requirements, or issue snapshot; issue acceptance: proposal content hash; PR acceptance: repository, PR, target, canonical
  claim-scope text hash; resolution; inference admission; guidance).
- `metrics-event`: run or submission; timestamp; kind (`state-transition`, `cost`, `latency`, `maintainer-resolution`,
  `appeal`, `audit-result`) with a kind-specific payload.
- `policy-revision`: see "Loader, resolved policy, revision record".
- Canonical JSON: RFC 8785 JCS implemented in core (keys sorted by UTF-16 code units, ECMAScript number serialization, no
  whitespace; reject non-finite numbers and lone surrogates); tested against the RFC 8785 examples.

### `steward policy` (D15, I7)

- Syntax: `steward policy [--ref <ref> | --file <path>] [--json]`. Both `--ref` and `--file` → exit 2. Unknown option → 2.
  Default `--ref origin/HEAD` (no fetch). Argument parsing with `node:util` `parseArgs` (no new CLI dependency).
- Human output lines: validity; source (`ref <ref> -> commit <sha>` or `file <path>`); revision (tree id or `local:<sha256>`);
  authority notice — git: authoritative only if `<ref>` is current, no fetch was performed; file: non-authoritative; errors
  (`code path message`).
- Warnings (owner addition to I9): computed only for a VALID policy, from the resolved policy, by a pure core function (for
  example `policyWarnings(resolved)`) returning `{ code, path, message }[]`; core also exports the placeholder constant
  (for example `LLM_MODEL_PLACEHOLDER = 'replace-with-model-id'`), which the template test uses. v1 has one warning: code
  `policy.llm-model-placeholder`, path `llm.model`, raised when `llm` is non-null and `llm.model === 'replace-with-model-id'`
  (exact match); message states that `llm.model` is the template placeholder, must be replaced with a real model id, and that
  a run reaching a model stage with it ends `inconclusive`. Warnings never change validity or the exit code (valid → 0) and
  never enter the loader result's failure path. Human output: one line per warning on STDERR, format
  `warning <code> <path> <message>`. Invalid policies report no warnings.
- `--json`: one object `{ schema_version: 1, valid, authoritative, source, revision, notice, errors, warnings }` on stdout
  (`warnings` always present; `[]` when none; nothing on stderr in `--json` mode except usage errors), where `revision` is
  `null` only when no revision could be determined (missing directory, usage or environment error).
- `packages/cli/package.json` gains `"bin": { "steward": "./dist/main.js" }`; `main.ts` gains `#!/usr/bin/env node` and
  dispatches subcommands; the command logic is an in-process function taking argv, cwd, and output sinks so unit tests run it
  without a build. Run from source: `pnpm build` then `node packages/cli/dist/main.js policy ...`.

### Template and editor schema

- `templates/policy/policy.yml`: every key written explicitly, including defaulted ones (D7), all 13 label names, the built-in
  dismissal catalog with definitions as comments (I5), `dismissal_codes: []`, an active `llm` section
  (`provider: copilot-sdk`, `auth.type: github-token`, `model: replace-with-model-id` per I9, so `steward policy` warns on the
  template), `runner.image.source: registry` with a
  conservative reference, every `execution.platforms[]` entry with a `commands:` list naming the template's declared
  `execution.commands[].id` values (it validates under I3), credential references only. Installed later by `steward init` as `.github/patch-steward/policy.yml`.
  Prettier-clean. First line may carry `# yaml-language-server: $schema=...` pointing at the schema file.
- `templates/policy/policy.schema.json`: generated from the Zod schema; Prettier-clean; a drift test deep-equals the parsed file
  against the live export (compare parsed JSON, not bytes). Not installed into `.github/patch-steward/`, because anything there
  changes the policy revision.
- `templates/README.md`: describes delivered content; no planning ids.

### Fixture corpus (root `fixtures/`, ADR-0022)

- `fixtures/policies/valid/*.yml` (Prettier-clean): at least `minimal-no-llm.yml`, `copilot.yml`, `openai-compatible.yml`,
  `injection-text.yml` (valid policy whose free-text fields carry prompt-injection and shell-metacharacter text; it validates
  and the text stays data). `copilot.yml` and `openai-compatible.yml` use a non-placeholder `llm.model` value (any id other
  than `replace-with-model-id`), so they produce no warning.
- `fixtures/policies/invalid/*.txt`: at least `unknown-key.txt`, `limit-above-bound.txt`, `undeclared-command.txt`,
  `undeclared-path.txt`, `missing-key.txt`, `unknown-version.txt`, `llm-pairing.txt`, `llm-base-url-http.txt`,
  `builtin-code-redefined.txt`, `credential-value.txt`, `duplicate-id.txt`. Each invalid fixture differs from a valid policy
  only in the defect its name states, so its expected codes are exactly those that defect yields. Pinned expectations for the
  reference fixtures (amended 2026-09-26): `undeclared-command.txt` → `{ "valid": false, "codes": ["policy.undeclared-reference"] }`
  (an `execution.platforms[].commands` entry names a command id that no `execution.commands[]` entry declares);
  `undeclared-path.txt` → `{ "valid": false, "codes": ["policy.invalid-path"] }` (`runner.image.source: dockerfile` with
  `runner.image.path` outside `.github/patch-steward/runner/`, for example containing a `..` segment: the location rule is the
  undeclared-path check a `--file` source can make); `duplicate-id.txt` → `{ "valid": false, "codes": ["policy.duplicate-id"] }`
  (two `execution.commands[]` entries share an `id`). The git-only half of the path rule (a `runner.image.path` absent from the
  loaded tree → `policy.undeclared-reference` at `runner.image.path`) is covered by a loader test in `packages/core/src/policy`
  whose name contains `undeclared dockerfile`, building its repository with plumbing as in "Revision identity".
- `fixtures/policies/hostile/*.txt`: at least `alias-bomb.txt`, `anchor.txt`, `duplicate-key.txt`, `custom-tag.txt`,
  `multi-document.txt`, `deep-nesting.txt`, `proto-key.txt` (`__proto__` and `constructor` keys), `redos-pattern.txt`,
  `non-string-key.txt`. Oversize and invalid UTF-8 inputs are generated in test code, not committed.
- `fixtures/policies/expectations.json` (Prettier-clean): maps every fixture path (relative to `fixtures/policies/`) to
  `{ "valid": boolean, "codes": [ ... ] }`; the fixture test fails if a fixture file lacks an entry or an entry lacks a file.
- `fixtures/README.md` lists the new entries.

### Conformance checks (plan §7.3; `packages/core/src/conformance/`)

- `invariant-2` (trusted-branch policy): loader reads only git objects at the explicit commit; working-tree edits and other
  branches do not change the loaded policy or id; file source is never authoritative; the revision id is the tree id.
- `invariant-5` (runtime validation; rules decide): every fixture yields a typed failure or a policy that re-validates;
  malformed git plumbing output is rejected; no exported loader path returns data that skipped validation.
- `invariant-7` (bounds and redaction): every integer key in the policy schema is registered in the bounds table (a new limit
  key without a bound fails the test); for every row, value = Hard max accepted, Hard max + 1 rejected, Min − 1 rejected;
  built-in detectors redact samples; redaction fails closed on size and time bounds.
- Injected-failure test (invariant 4 for new adapters): git missing, non-zero exit, timeout, oversize output, malformed
  `ls-tree` output, missing blob, oversize blob → typed failure with `outcome: 'inconclusive'`; a table-driven test asserts no
  failure code maps to `pass`.

### ADR inventory (MADR per `docs/adr/README.md`; Status accepted; Date 2026-09-26; Deciders: project owner; `Source` names the governing location; no planning ids)

| ADR | Title | Decision |
| --- | --- | --- |
| ADR-0034 | Policy schema covers every policy area in version 1 | D1 |
| ADR-0035 | Integer schema versions and the rule for evolving schemas | D2 (with RFC 8785 canonical JSON for record hashing) |
| ADR-0036 | Zod as the single schema source | D3 |
| ADR-0037 | Strict YAML subset for the policy file | D4 |
| ADR-0038 | Policy revision is the git tree id of the policy directory | D5 |
| ADR-0039 | Optional inference section and provider pairing | D6 (with I2) |
| ADR-0040 | Required policy keys and documented defaults | D7 |
| ADR-0041 | `policy_change` defaults to `enforced` | D8 |
| ADR-0042 | Free-form submissions are off by default | D9 |
| ADR-0043 | Default label names | D10 |
| ADR-0044 | Built-in dismissal-code catalog | D11 (with I5) |
| ADR-0045 | Public policy subset | D12 (with I6) |
| ADR-0046 | Hard bounds are steward constants | D13 (values live in the governing docs, not the ADR) |
| ADR-0047 | Redaction patterns | D14 (with I4, I8) |
| ADR-0048 | `steward policy` command | D15 (with I7, and the placeholder-model warning: a warning, not an error, exit code unchanged) |
| ADR-0049 | Tests are type-checked by a separate compiler pass | Owner scope addition "Test type-checking": considered options — Vitest typecheck mode, type-aware ESLint, including tests in the package build (would emit tests into `dist/`), a separate `tsc --noEmit` pass over sources and tests per package run locally and in CI on both OSes (chosen). `Source`: `docs/user-manual/configuration.md` TypeScript section. |

Titles and I-list attachments follow the owner's gate answers. Each ADR's `More Information` says "The project owner decided
this on September 26, 2026." `docs/adr/README.md` Records table gains the 16 rows ADR-0034–ADR-0049 (Prettier-aligned).

### Documentation change inventory (governing document first: architecture, processes, whitepaper §9–§14, README, CLAUDE.md, user manual)

- Policy-revision wording ("content hash" → the git tree id of `.github/patch-steward/` at the trusted commit, read from git
  objects; local file `local:<sha256>` non-authoritative). Sites at 55d97c5: `docs/architecture.md` lines 81 ("policy content
  hash", invariant 8), about 387–390 (§6.4 publish recompute list "policy content hash"), 596 (§8), 650 (§9 Policy revision
  identity); `docs/processes.md` 29 (§0.1 Snapshot "policy content hash"), 130 and 134 (SP01 step 3 "content hash",
  "live content hash"); `docs/whitepaper.md` 140, 411; `docs/user-manual/configuration.md` 18; `docs/user-manual/overview.md`
  42, 47 ("policy hash"); `CLAUDE.md` 74, 87. Also review "snapshot/policy hashes" (architecture 371, processes 30) and "policy
  hash" (processes 527). Issue and proposal "content hash" wording is unrelated and stays.
- Omitted-provider wording (D6): architecture §6.3 "Selection" bullet and §8 Inference row; configuration.md `llm.provider`
  row; `CLAUDE.md` invariant on provider/model/auth if affected.
- Architecture: §6.2 Policy module row (local file non-authoritative; public subset); §6.5 `steward policy` row (syntax, exit
  codes); §6.6 `data/policy.json` row (maximum allowlist; whole-section exclusions; private targets); §8 (location, precedence,
  validation incl. YAML strictness and version, the real key layout per area, defaults, `llm` optionality, illustrative block
  replaced by real keys); §9 (schemas defined; `schema_version` and the evolution rule D2; canonical JSON); §10 (label default
  names configurable per state); §11 (private-target publication key); §12 (hard bounds as constants plus the provisional
  B-table values, stated as provisional and revisited with replay and observation measurements); §15 shrinks: remove "Policy,
  submission, execution-record, finding, report, and metrics schemas" (reword to the remaining evidence run-directory layout and
  stored-record file format item), reduce "The `llm` policy schema..." to the daily inference aggregate, remove "Numerical
  limits...", reduce "Local credential conventions..." to Copilot login reuse; §14 rows unchanged unless a mechanism changes.
- Processes: §0.1 Snapshot wording; SP01 steps 1 (`steward policy`), 3 (revision id), 4 (built-in catalog, project additions),
  5 (public subset rules), controls and failure handling (typed failure; missing policy; no defaults); SP06 step 3 (free-form
  default false); SP19 failure causes if the vocabulary adds `llm-not-configured` or `policy-unavailable`.
- Whitepaper: §3 revision wording; §8 (line 411) wording; §9–§14 restated facts (for example §14 "the packages contain only
  toolchain smoke code" and its open-decision list).
- User manual: `configuration.md` (resolve `[NEEDS INPUT]` callouts for schema, template, bounds, dismissal catalog with
  definitions, env var name; keep callouts that stay open: field/template mappings, platform rules beyond Linux, result formats,
  dependency network and services, retention-pruning mechanics, Copilot login reuse, App secret and Environment names; mark
  delivered sections Available; the `llm.model` entry says the template ships the placeholder `replace-with-model-id` and
  `steward policy` warns while it is unchanged), `commands.md` (`steward policy` Available with syntax, exit codes, the
  placeholder-model warning on stderr and the `warnings` JSON field, run-from-source command; other commands stay Proposed), `overview.md` (Policy revision and Snapshot rows), `troubleshooting.md` (policy-invalid rows if
  useful). Do not describe screening behavior as working.
- README Status; `CLAUDE.md` "Project state" (policy module, vocabularies, record schemas, redaction, `steward policy` delivered;
  no screening engine, adapters, workflows, or web app) and the two invariant bullets on policy revision and snapshot;
  `CLAUDE.md` Commands may gain the `steward policy` source-run line.
- `templates/README.md`, `fixtures/README.md` as above.
- Test type-checking corrections (T7) land in Phase 1, before this inventory runs; Phase 4 edits to `CLAUDE.md`, `README.md`,
  and the user manual preserve them (`pnpm typecheck` stays in every command list and CI description).
- Persistence rule: none of these files may cite M-ids, PD-ids, owner-decision numbers, D/I/B/K/L/DC row ids of this brief,
  phase or step numbers, `development-artifacts/`, or the plan. Deferred rule: no mention of deferred features outside
  `docs/deferred.md` (ADRs may name a rejected alternative by DF id with a link, one line).

## Constraints

- Branch: all commits on `milestone/3-policy-and-data-contracts`; worktrees base on its current local HEAD; no push.
- Do NOT edit `docs/project-development-plan.md` or `docs/astra-plan.md`.
- OWNER GATE APPROVED 2026-09-26: B-table, DC-list, and I-list values are binding exactly as written in this brief. They are
  encoded in Phase 2, not Phase 1 (phase boundary). Phase 1 code takes bounds as required parameters.
- `pnpm typecheck` (T1–T7) passes at every phase gate and at every worker acceptance after it lands; tests are written to
  type-check under the package build's strict options.
- No new dependencies other than `zod@^4` and `yaml@^2` in `@patch-steward/core`. No native modules. Lockfile committed with the
  manifest change.
- Policy content and git output are data: no shell, no `eval`, no dynamic `RegExp` from policy text except through the
  safe-subset validator, no prototype-polluting object construction (reject `__proto__`, `constructor`, `prototype` keys or
  build maps with null prototypes).
- No default substituted for any required key; the only defaults are D7's.
- Byte-exact and malformed fixtures use `.txt`; tests needing exact bytes construct them in code.
- Every file Prettier checks is Prettier-clean at commit; `pnpm lint` clean; `pnpm build` clean (tests excluded from build);
  `pnpm typecheck` clean (tests included).
- Governing documents first; persistence and deferred rules as above; Prettier-aligned tables.
- Pipeline artifacts are never formatted.

## Assumptions

- Network access is available for `pnpm add`.
- The git on CI runners supports `--end-of-options` (git 2.24+).
- GitHub numeric limits marked "verify" are confirmed by the step that cites them in documentation; if a documented value
  differs, the step reports it and the planner amends (the B-table value stays as approved unless the owner changes it).
- The owner answered the gate on 2026-09-26 (recorded in "Owner gate"); the approved values are the ones written in place.

## Out of scope

- Snapshot hashing, submission parsing, form/heading mapping, contract checks, path-change detection (M04); decision table,
  report rendering, evidence store, persistence (M05); any GitHub API client, workflow, or action code; container runner; LLM
  adapters; `steward init`, `screen`, `preflight`, `replay`, `report`; the web app; publishing `data/policy.json` to Pages.
- Built-in trusted and execution-sensitive path lists, attachment destination/format defaults, result-format parsing, dependency
  network policy, default models, security-term defaults (I9 later milestones).
- Changing Vitest, ESLint, or Prettier configuration (Vitest typecheck mode stays off; type-checking is the separate
  `pnpm typecheck` pass). CI changes other than the `Typecheck` step in `.github/workflows/ci.yml` (T6); any change to
  `.github/workflows/cd.yml`.
- Edits to the plan documents; the 0.x release.

## Definition of Done (project)

Run in the main tree (`cd /c/Users/John/Projects/steady-orchard/patch-steward`), Git Bash, after the last phase. `S` =
`55d97c51c07c2ea0bfef3fd463f54fe1708a844d`.

1. Toolchain: `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check`
   exits 0.
2. Invalid or missing policy → typed failure, maintainer message, no default (exit criterion 1):
   `node packages/cli/dist/main.js policy --file fixtures/policies/invalid/missing-key.txt; echo "exit=$?"` prints
   `policy.missing-key` and `exit=1`; in a temp git repository with one commit and no `.github/patch-steward/`,
   `node <repo>/packages/cli/dist/main.js policy --ref HEAD; echo "exit=$?"` prints a missing-policy code and `exit=1`;
   `node packages/cli/dist/main.js policy --ref refs/heads/does-not-exist; echo "exit=$?"` prints `exit=2`;
   `pnpm vitest run packages/core/src/policy` passes, including the injected-failure tests.
3. Unknown keys, limits above bounds, undeclared references rejected (exit criterion 2): for each of
   `unknown-key.txt`, `limit-above-bound.txt`, `undeclared-command.txt`, `undeclared-path.txt` under
   `fixtures/policies/invalid/`, `node packages/cli/dist/main.js policy --file <fixture> --json; echo "exit=$?"` prints
   `"valid":false`, the code recorded in `fixtures/policies/expectations.json`, and `exit=1`; the recorded codes are exactly
   the pinned ones for the reference fixtures (`undeclared-command.txt` → `policy.undeclared-reference`, `undeclared-path.txt`
   → `policy.invalid-path`; brief "Fixture corpus"); the fixture-tier test over `expectations.json` passes;
   `pnpm vitest run packages/core/src/policy -t 'undeclared dockerfile'` passes and runs at least one test (not all skipped),
   asserting a git-loaded `runner.image.path` absent from the tree → `policy.undeclared-reference` at `runner.image.path`.
4. Revision id (exit criterion 3): the core tests asserting constant tree ids pass (`pnpm vitest run packages/core/src/git`), and
   this script prints `SAME` then `DIFF` and every `grep -c` prints at least 1:

   ```bash
   R=/c/Users/John/Projects/steady-orchard/patch-steward; T=$(mktemp -d); O=$(mktemp -d)
   git -C "$T" init -q; mkdir -p "$T/.github/patch-steward"
   cp "$R/templates/policy/policy.yml" "$T/.github/patch-steward/policy.yml"
   git -C "$T" add -A; git -C "$T" -c user.name=t -c user.email=t@example.com commit -qm one
   A=$(git -C "$T" rev-parse HEAD:.github/patch-steward)
   (cd "$T" && node "$R/packages/cli/dist/main.js" policy --ref HEAD --json) > "$O/1.json"; echo "exit=$?"; grep -c "$A" "$O/1.json"
   echo x > "$T/README.md"; git -C "$T" add -A; git -C "$T" -c user.name=t -c user.email=t@example.com commit -qm two
   B=$(git -C "$T" rev-parse HEAD:.github/patch-steward); [ "$A" = "$B" ] && echo SAME
   echo '# changed' >> "$T/.github/patch-steward/policy.yml"; git -C "$T" add -A; git -C "$T" -c user.name=t -c user.email=t@example.com commit -qm three
   C=$(git -C "$T" rev-parse HEAD:.github/patch-steward); [ "$A" != "$C" ] && echo DIFF
   (cd "$T" && node "$R/packages/cli/dist/main.js" policy --ref HEAD --json) > "$O/3.json"; grep -c "$C" "$O/3.json"
   ```

   Expected: `exit=0`, `1` (or more), `SAME`, `DIFF`, `1` (or more). Windows and Linux equivalence rests on the constant-value
   tests (no OS-dependent input); Ubuntu CI runs them on the lead's PR.
5. Skeleton (exit criterion 4): `node packages/cli/dist/main.js policy --file templates/policy/policy.yml 2>&1; echo "exit=$?"`
   prints a non-authoritative notice, a `warning policy.llm-model-placeholder llm.model ...` line, and `exit=0`;
   `node packages/cli/dist/main.js policy --file templates/policy/policy.yml --json; echo "exit=$?"` prints JSON whose
   `warnings` array contains `"code":"policy.llm-model-placeholder"`, and `exit=0`;
   `node packages/cli/dist/main.js policy --file fixtures/policies/valid/copilot.yml --json` prints `"warnings":[]`;
   `pnpm vitest run packages/cli` covers placeholder → warning with exit 0, non-placeholder model → no warning, no `llm`
   section → no warning, invalid policy → no warnings; the template test passes, asserting every §8 area key is present
   (`supported_behavior`, `trusted_paths`, `execution_sensitive_paths`, `categories`, `submission`, `execution`, `runner`,
   `llm`, `stages`, `escalation`, `limits`, `policy_change`, `modes`, `follow_through`, `hygiene`, `evidence`,
   `dismissal_codes`), every key including defaulted ones is written explicitly, no string matches a built-in credential
   detector, `llm.auth` holds only `type`, and the committed `templates/policy/policy.schema.json` deep-equals the live export.
6. Public subset (exit criterion 5): `pnpm vitest run -t 'public subset'` passes, asserting top-level keys ⊆ the eight section
   ids plus the envelope, excluded sections absent, private target disabled unless both publication keys are true, and canary
   non-public values (runner reference, model id, hygiene allowlist login, redaction pattern, escalation term, design rule
   text) absent from the serialized subset.
7. Conformance: `pnpm vitest run packages/core/src/conformance` passes with files for invariants 2, 5, 7.
8. Records and vocabularies: tests pass asserting each of the nine record schemas rejects unknown keys and a wrong
   `schema_version`, accepts a fixture instance, and that RFC 8785 test vectors canonicalize exactly.
9. ADRs: `ls docs/adr/00{34..49}-*.md | wc -l` prints `16`; each file starts with `# ADR-00NN: <title>` and has the metadata
   lines `Status`, `Date`, `Deciders`, `Source` and the sections in the order `docs/adr/README.md` prescribes;
   `grep -c '^| \[ADR-' docs/adr/README.md` prints `49`.
10. Persistence: `git grep -c -P '(?<![A-Za-z0-9])M[0-2][0-9](?![0-9])|(?<![A-Za-z0-9])PD0[1-8](?![0-9])|development-artifacts|project-development-plan|astra-plan|patch-steward-m[0-9]' HEAD -- docs README.md CLAUDE.md fixtures templates ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
    prints exactly `HEAD:CLAUDE.md:2` and at most `HEAD:docs/user-manual/configuration.md:1` (baseline at `S`: those two plus
    `HEAD:templates/README.md:1`, which must be gone); and
    `git grep -n -P 'owner decision|(?<![A-Za-z])(D|I|B|K|L|DC)[0-9]{1,2}(?![0-9])' HEAD -- docs/adr/00{34..49}-*.md` prints
    nothing (review any hit by hand; ADR ids such as `ADR-0034` do not match).
11. Deferred: `git grep -c -E 'DF[0-9]{2}|deferred\.md' HEAD -- docs README.md CLAUDE.md templates fixtures ':!docs/deferred.md' ':!docs/adr' ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
    prints exactly `HEAD:CLAUDE.md:3` and `HEAD:README.md:1` (baseline unchanged).
12. Revision wording: `git grep -n -i -E 'policy content hash|content hash of the policy|content hash of .\.github/patch-steward|policy hash' HEAD -- docs README.md CLAUDE.md ':!docs/project-development-plan.md' ':!docs/astra-plan.md' ':!docs/adr'`
    prints nothing, and `git grep -n 'git tree' HEAD -- docs/architecture.md docs/processes.md CLAUDE.md` shows the §8, §9,
    SP01, and CLAUDE.md statements.
13. §15 shrink: `git show HEAD:docs/architecture.md` §15 no longer lists the schema bullet, the `llm` schema clause, the
    "Numerical limits" bullet, or the fixed environment variable names clause; it still lists the daily inference aggregate and
    Copilot login reuse.
14. Documentation truth: README Status and `CLAUDE.md` "Project state" name the delivered scope and nothing more;
    `docs/user-manual/commands.md` marks only `steward policy` Available among CLI commands.
15. Test type-checking (owner scope addition; T1–T7):
    - `grep -c '"typecheck"' package.json` prints `1`; `pnpm typecheck; echo "exit=$?"` prints `exit=0`; `git status
      --porcelain` output is identical before and after running it.
    - Negative proof T5 (temporary edit, reverted): the probe line in `packages/core/src/index.test.ts` and, separately, in
      `packages/cli/src/index.test.ts` each make `pnpm typecheck` exit non-zero naming that file; afterwards `git diff --quiet`
      exits 0.
    - `git show HEAD:.github/workflows/ci.yml | grep -n -E 'run: pnpm (build|typecheck|test)$'` prints the three lines in the
      order build, typecheck, test, all inside job `build-and-test` (matrix ubuntu-latest and windows-latest).
    - `git grep -n -i -E 'type errors in tests|surface only under vitest|type-checked by the test runner' HEAD -- docs README.md CLAUDE.md ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
      prints nothing; `git grep -c 'pnpm typecheck' HEAD -- CLAUDE.md README.md docs/user-manual/commands.md docs/user-manual/usage.md docs/user-manual/troubleshooting.md docs/user-manual/installation.md`
      prints a count of at least 1 for each of the six files.
    - `git grep -c 'CI runs builds, type-checks, and tests on Windows and Linux' HEAD -- docs/user-manual/installation.md`
      prints `HEAD:docs/user-manual/installation.md:1`.
