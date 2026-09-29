# patch-steward-m7 — Brief

## Goal

Execute milestone M07 ("Sandboxed execution") of `docs/project-development-plan.md`: run plan entries against explicit
commits inside disposable, credential-free local containers (Docker or Podman, driven through their CLIs by argument
vector), produce bounded and redacted execution records with environment identity, declared JUnit result files, and
admissibility (`evidence`, `signal`, or `claim`), materialize commits and overlays inertly, support a runner image from the
registry or from `.github/patch-steward/runner/` on the trusted branch only, provide the unsandboxed claim-only runner for
`steward preflight --run` (mandatory commands and the before-and-after preview on the contributor's own checkout), prove
the exit criteria against a hostile fixture repository, add the CI container tier, and record every settled decision in
ADRs and the governing documents.

OWNER GATE: APPROVED (2026-09-28). The owner answered Q1–Q16 with option A (the recommended option) for every question, with no
value changes: gates G1–G10, constants K52–K63, every rule (HP, MT, PV, OV, RT, IM, ER, JU, EP, SI, UR, PF, CI, XR),
interpretations I1–I28, and the ADR inventory ADR-0079–ADR-0089 are BINDING as written below. Answers are recorded in "Owner
gate decisions". Phases may be decomposed in roadmap order. Any change to an APPROVED item is a scope change: it goes through
a planner amendment and needs the owner's approval.

OWNER ANSWERS (2026-09-28, phase 1 decomposition ripple): Q17 B (the owner's choice over the recommended A), Q18 A, Q19 A; BINDING
as applied in G6 ER7, ER8, ER9, ER10, G7 EP4 and SI2, and "Owner gate decisions". OWNER ANSWER (2026-09-28): Q20 A (a result
file the redactor cannot take whole is not stored; the run is kept); BINDING as applied in G6 ER9, ER10, G7 EP4, and "Owner gate
decisions". OWNER ANSWER (2026-10-23, phase 3 Podman tier): Q21 A (Podman-only mount exception and mask-based capability check);
BINDING as applied in G3 HP8 (Podman variant), I28, G10 ADR-0085, and "Owner gate decisions". OWNER ANSWERS (2026-10-23, phase 3
Podman tier, second round): Q22 A ("Require empty /work in images": under Podman only, the `/work` volume mount carries no no-copy
option and an image whose `/work` is non-empty is refused before use); BINDING as applied in G3 HP1, HP2 (Podman), HP8 (`/work`
copy-up proof), G5 IM5, G10 ADR-0085, Assumptions, Conformance checks, and "Owner gate decisions". Q23 (`/run/secrets` under Podman
stays required empty; the owner empties the Podman machine's default mounts outside the repository) changes no rule; recorded in
G3 HP8 (Podman variant) and "Owner gate decisions". No owner question is pending.

## Context

### Repository and environment facts (read at commit ee878e5c8778f54187b3466c14bdfad09d30f09f; line numbers shift as files are edited — locate text by quotation and re-verify against live files)

- Repo root: `C:\Users\John\Projects\steady-orchard\patch-steward` (Git Bash `/c/Users/John/Projects/steady-orchard/patch-steward`).
  Remote `origin = git@github.com:steady-orchard/patch-steward.git`; `git symbolic-ref refs/remotes/origin/HEAD` =
  `refs/remotes/origin/develop`. Working branch `milestone/7-sandboxed-execution` (local, from develop `ee878e5`).
  Owner decision D8: NO push, NO test-bed write, NO outward action of any kind in this milestone.
- Host: Windows 11; Git Bash for all commands; `git 2.55.0.windows.3`; Node `v24.11.0`; pnpm `10.20.0`
  (`packageManager: pnpm@10.20.0`); `act 0.2.88`; Docker Desktop client and server `29.8.0`, server `linux/amd64`, context
  `desktop-linux`, cgroup v2 (`cgroupfs` driver), security options `seccomp` (builtin profile) and `cgroupns`, default runtime
  `runc`, storage driver `overlayfs` (containerd image store). Podman was NOT installed at planning time; the owner installs
  Podman Desktop with a Podman machine on this host before phase 3 (Q14 A; see G9 CI7 PREREQ-PODMAN). Local images present:
  `catthehacker/ubuntu:act-latest`, `catthehacker/ubuntu:full-latest`, `ghcr.io/catthehacker/ubuntu:full-latest`.
- `core.autocrlf=true`: compare committed bytes with `git show HEAD:<path>`. No `.gitattributes` in this repository.
- Long git-worktree paths break `pnpm test`: phase gates and the project DoD run in the MAIN tree; worker worktrees use short
  paths such as `C:/w/m7-<id>`.
- `.gitignore` swallows `logs`, `*.log`, `out`, `dist`, `coverage`, `.cache`, `*.tgz`, `.env*`, `pids`, `node_modules/`,
  `.claude`: never name a committed file or directory that way.
- `.prettierignore`: `pnpm-lock.yaml`, `dist/`, `coverage/`, `node_modules/`, `development-artifacts/`. Prettier checks every
  other `.json`, `.md`, `.yml`, `.yaml`, `.ts` file, including `fixtures/**`, `templates/**`, `.github/workflows/*.yml`. It does
  not format `.xml`, `.sh`, or `.txt`. This plan adds no ignore entry.
- Root scripts (`package.json`): `build` = `pnpm -r build`; `typecheck` = `tsc --noEmit -p packages/<pkg>/tsconfig.test.json`
  for core, cli, action, web; `test` = `vitest run`; `test:live` = `vitest run --config vitest.live.config.ts`; `coverage`;
  `lint` = `eslint .`; `format` / `format:check` = Prettier. No `test:container` script and no container CI job exist yet.
- `vitest.config.ts`: projects `unit` (`packages/*/src/**/*.test.ts` minus `.fixture.`, `.container.`, `.live.`) and `fixture`
  (`*.fixture.test.ts`), both aliasing `@patch-steward/core` to `packages/core/src/index.ts`. `vitest.live.config.ts` runs
  `*.live.test.ts` only (`fileParallelism: false`, 60 s timeouts). No `*.container.test.ts` file exists yet.
- `.github/workflows/ci.yml` jobs: `build-and-test` (matrix ubuntu-latest, windows-latest: install, `pnpm build`,
  `pnpm typecheck`, `pnpm test`), `lint-and-format` (PRs only), `coverage` (develop only; Codecov upload — never run locally).
  Actions pinned by tag (`actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`).
- `packages/core` dependencies: `yaml`, `zod` only. `packages/core/src/index.ts` has 114 `export *` lines; every new export
  name must be unique across core (TS2308). `src/conformance/invariant-5.test.ts` pins the exact sorted lists of root functions
  named `load*`/`validate*`/`resolve*` and `parse*`/`capture*`/`check*`: a new root export with those prefixes extends it in the
  same step.
- Last M06 totals (project ledger): 189 test files, 3474 tests; live tier 15 tests.
- `docs/adr/`: ADR-0001–ADR-0078; `grep -c '^| \[ADR-' docs/adr/README.md` = `78`. Statuses: ADR-0011 `superseded by ADR-0077`,
  ADR-0060 `superseded by ADR-0066`, all others `accepted`. MADR format per `docs/adr/README.md` "Format". Next free number
  ADR-0079.
- Hard-only constants in architecture §12.1 continue from the M06 brief numbering K1–K51; M07 proposes K52–K63.

### Milestone text (verbatim, `docs/project-development-plan.md` "### M07. Sandboxed execution")

```text
Goal: run plan entries against explicit commits inside disposable,
credential-free containers, produce bounded and redacted execution records,
and provide the claim-only runner for T2.

Design scope: SP17 steps 1–5; §4 Z1-to-Z2 rule; §6.2 Execution planner; §6.3 Runner (local container, unsandboxed); §12 execution bounds; §13 credential, escape, and log rows; SP05 CLI step 3; invariants 3 and 7
Addresses: P04, P05
Depends on: M05

Inputs:
- M05 handoff records and evidence module; M03 Execution and Runner policy
  areas.
- A container runtime on development machines and on the Linux CI runner.

Decisions to settle first:
- Container image strategy and build caching (§15).
- Network policy for the dependency step (§15).
- Test-result parsing: declared formats versus exit-code-only evidence (§15),
  and the first formats supported, for the PD04 ecosystems.
- Whether a policy may declare allowed services for reproductions (SP09
  controls).
- Execution limits (§15); supported container runtimes and host platforms for
  T3.

Outputs:
- Execution planner: policy and submission to a bounded plan with expected
  results.
- Inert materialization of a commit and validated overlays (SP17 step 1).
- Local container runner and the unsandboxed claim-only runner.
- Execution records with environment identity, bounded output, declared
  result files, and admissibility (`evidence`, `signal`, or claim).
- Support for a runner image defined under `.github/patch-steward/runner/` on
  the trusted branch only.
- `steward preflight` runs the mandatory commands and the before-and-after
  preview on the contributor's machine, marked as claims.

Exit criteria, against a hostile fixture repository:
- Hooks, filters, and submodule commands do not run during materialization;
  traversal and symlink-escaping overlay paths are rejected.
- The container has no host environment, tokens, container socket, or mounts
  beyond the copied checkout and scratch space; it runs non-root with network
  disabled; every resource limit is enforced.
- Canary secrets in the host environment never appear in the container, the
  output, or the records.
- An image or runtime failure is an environment failure that leads to
  `inconclusive`, never "not reproduced".
- The unsandboxed runner refuses anything but the contributor's own checkout.
```

Exit criteria are referred to below as E1–E5 in that order. Plan §7.1: SP05 CLI step 3 and SP17 are M07 (SP17 signal ingestion
is M08, the Actions container runner M13). Plan §7.2: §15 "Container image strategy; image build caching", "Network policy for
dependency installation", "Test result parsing" close here; "Numerical limits" (M07 by area) is realized as §12.1 rows (§15 no
longer lists it). Plan §7.3: invariant 3 gets its FIRST conformance check here; invariants 1 and 7 are extended; invariant 4 is
extended by every milestone.

### Owner decisions (settled 2026-09-28; binding; restated from the lead's prompt)

- D1 Runner image: only the two existing sources; no generated images from toolchain lists. `registry`: public images, no
  registry credentials; a tag is allowed but resolved to its digest at pull, and the digest is recorded as environment identity.
  `dockerfile`: built with `.github/patch-steward/runner/` (read from git objects at the policy revision, never a working tree)
  as the only build context; cached locally under a tag keyed on that directory's tree id. T1 image caching is left to a later
  milestone: do not design it.
- D2 Dependency-step network: the declared `runner.dependency_step` runs in its own container on the materialized copy with
  unrestricted egress, no credentials, the same non-root user and resource limits, bounded by
  `limits.execution.dependency_step_seconds`; the prepared copy then moves into network-none execution containers; the step is
  recorded as an execution record; its failure is an environment failure (`inconclusive`). The docs state the risk: submitted
  install scripts reach the internet but hold nothing to exfiltrate.
- D3 Result parsing: exit status is always recorded as primary evidence; declared `junit-xml` result files are parsed by a
  bounded, entity-free XML parser (no DTD, no external entities, no entity expansion) into test identities, statuses (pass, fail,
  skip, error), counts, and durations. JUnit XML is the only version-1 format (Vitest and Jest reporters, cargo-nextest, CTest
  `--output-junit`, GoogleTest). A missing or malformed declared file is recorded as such; its classification belongs to later
  stages.
- D4 Reproduction services: none in version 1. Single-container sandbox; a reproduction needing network or services ends
  `inconclusive` with a request to reduce it; the SP09 "allowed services (open item)" closes as not supported, with no reserved
  key.
- D5 Execution limits: POLICY KEYS FOR ALL (the owner's choice over the recommended hard-only constants). Every new execution
  limit becomes a policy key under a hard bound, with schema, template (`templates/policy/policy.yml` writes every key), editor
  JSON Schema, bounds table, and documentation additions, versioned additively (policy `version: 1` stays). The planner decides
  the set (G1), judges required versus defaulted keys against ADR-0034/ADR-0040 (Q2), and states consequences and mitigations
  (G1). Resolved by the owner gate: G1 set approved (Q1 A); keys optional with defaults equal to template values (Q2 A).
- D6 Container runtimes and hosts: Docker and Podman, each driven through its CLI by argument vector (no socket API, no SDK
  dependency), auto-detected or chosen by a flag; Linux containers only (`linux/amd64`); hosts Linux, Windows (Docker Desktop,
  WSL2), macOS (Docker Desktop or Podman machine). A new CI job on Ubuntu runs the `*.container.test.ts` tier under both Docker
  and Podman (both preinstalled on GitHub ubuntu runners); Windows is verified locally with Docker Desktop; macOS is documented
  as supported but untested. The runner copies the checkout into containers (for example `create` plus `cp`, or a tar stream)
  rather than bind-mounting host paths. Owner gate Q14 A adds: Podman is also verified locally on this Windows host through a
  Podman Desktop Podman machine (G9 CI7); the CI Podman leg stays unrun until the owner pushes. Phase 5 documents exactly this:
  Windows verified with Docker Desktop and Podman; Ubuntu verified with Docker through `act`; macOS supported but untested.
- D7 Preflight execution: opt-in flag (`--run`). The contract check stays the default; with the flag, the mandatory commands
  and, for a declared regression test, the base-commit before-and-after preview in a temporary checkout run unsandboxed on the
  contributor's machine, with the exact argument vectors printed before running; results are claims; no interactive prompt. Exit
  mapping consistent with CLI conventions (0 pass or met, 1 needs-changes or uncertain, 2 usage or environment, 3 inconclusive).
- D8 Ubuntu verification: `act` locally on an LF clone with the host Docker socket, as in M06 (`-W .github/workflows/ci.yml`;
  skip the coverage job). NO push to origin, NO test-bed writes, NO outward actions.

### Design sources (governing; read at ee878e5)

- `docs/architecture.md`: invariants 1, 3, 4, 7 (§2); §4 Z2 row ("Nothing: no environment secrets, no tokens, no host mounts
  beyond a copied checkout and scratch space"), boundary rule "Z1 to Z2: the trusted job copies the checkout at an explicit
  commit into the container, passes a plan, and receives exit codes, bounded output, and declared result files. Nothing else
  crosses, and what comes back is bounded, redacted, and handled as Z3 data.", "Execution integrity" rule; §5 T2 and T3 rows;
  §6.1 test tiers ("CI runs the unit and fixture tiers on Ubuntu and Windows and the container tier on Ubuntu only"); §6.2
  Execution planner row ("Translate policy and submission into a bounded list of sandbox executions with expected results (for
  example, "must fail on base for the claimed reason")."); §6.3 Git row ("Fetch by commit id and isolated checkouts are not
  implemented."), Runner row ("Actions container runner; local container runner; unsandboxed local runner" / "The unsandboxed
  runner is selectable only in T2 and marks every result as a claim."); §6.5 CLI table and prose (preflight "runs no repository or
  policy command"; screen "no stage, model call, or execution"); §6.7 `.github/patch-steward/runner/` row; §8 policy revision
  paragraph (the revision includes `runner/`), Cross-field rules (Dockerfile under `runner/` exists as a regular file), Defaults
  paragraph, Execution row, Runner row, Limits row; §9 Execution record row ("Command, environment identity, exit status, bounded
  output, declared result files, test identity, commit ids, admissibility (evidence or signal)"), Run row (runner identity); §11
  layout; §12 "Execution bounds" bullet, failure classes (`environment unavailable`); §12.1 bounds table (41 rows) and hard-only
  constants; §13 rows "Credential exposure to submitted code", "Container escape on the runner", "Manipulated test results",
  "Credential leakage in logs"; §14 P04, P05 rows; §15 items "Container image strategy", "Network policy for dependency
  installation inside the sandbox", "Test result parsing".
- `docs/processes.md`: §0.1 Evidence, Signal, Claim; §0.2; SP05 CLI steps 1–5, Controls, Failure handling; SP09 step 2 and
  Controls ("unless the policy declares allowed services (open item)"); SP10 steps 2–3 (whitepaper §5 table: base with the PR's
  test-path changes must fail, head must pass, merge must pass); SP17 in full (steps 1–6, Controls, Failure handling, Measures);
  SP19 failure classes; SP20 steps 1–3 (step 1 "fetch the submission and commits through the GitHub API"; step 2 "The current
  implementation runs at contract level only ... with no stage, container, or model call").
- `docs/adr/`: ADR-0006 (sandbox model), ADR-0007 (local CLI scope), ADR-0017 (first ecosystems; consequence "Test result parsing
  ... remains an open implementation decision"), ADR-0021 (test tiers and CI placement), ADR-0034, ADR-0035 (integer versions:
  "An optional addition to a schema keeps its version unchanged"), ADR-0040 (required keys and documented defaults), ADR-0046
  (hard bounds are steward constants), ADR-0053 (built-in trusted and execution-sensitive paths), ADR-0064 (run directory and
  local store), ADR-0065 (redaction at persistence), ADR-0066 (uniform CLI conventions: `--json` prints exactly one line and
  nothing on standard error), ADR-0067 (screen and report commands; consequence "A test proves the `screen` path sends only GET
  requests and runs no model and no execution"), ADR-0069, ADR-0070 (phase handoff records).
- `docs/user-manual/configuration.md`: "### Execution" (callout `[NEEDS INPUT] Result-file parsing ... and the rules for platform
  coverage beyond Linux containers are not specified.`), "### Runner" (callout `[NEEDS INPUT] How the runner image is provided or
  generated, and the network and service policy for the dependency step, are not specified.`), "### Limits", "### Defaults";
  `commands.md` "`steward preflight` (Available)", "`steward screen` (Available)", "Development commands (Available)";
  `installation.md` "### Required resources" ("Docker or Podman for maintainer local screening or replay."); `overview.md`
  "## Execution options (Proposed)"; `usage.md` "## Prepare a submission (Available)", "## Local screening (Available)";
  `troubleshooting.md` "## Infrastructure and inference (Proposed)".
- `docs/whitepaper.md` §9–§14 (decisions paragraphs "Decisions recorded on September 27, 2026 (ADR-0062–ADR-0070 in
  `docs/adr`)" and the M06 one); README "## Status"; CLAUDE.md "Project state", "Commands", "Toolchain constraints".

### Delivered code M07 builds on (read at ee878e5)

- `packages/core/src/policy/schema.ts`: `executionCommandSchema` (`id`, `kind` build or test or lint or static-analysis, `run`
  argument vector, `working_directory`, `mandatory`, `result_files[]` with `path` and `format: junit-xml`),
  `executionPlatformSchema` (`id`, `os`, `required`, `source` container or ci-signal, `ci_workflow`, `commands` ids),
  `runnerImageSchema` (discriminated `dockerfile` with `path`, `registry` with `reference` matching `IMAGE_REFERENCE_PATTERN`,
  optional `@sha256:<64 hex>`), `runnerSchema` (`network: z.literal('none').default('none')`, `dependency_step` null or
  `{run, working_directory}`, `resources {cpus, memory_mb, pids}`), `limitsSchema.execution` (6 keys), `limit(path)` requires a
  registered `POLICY_LIMITS` row, `policyEditorJsonSchema()`.
- `packages/core/src/policy/bounds.ts`: `POLICY_LIMITS` (41 rows: path, unit, templateValue, min, max, provider),
  `findPolicyLimit`, hard constants K1–K51 (for example `GIT_TIMEOUT_MS` 30000, `GIT_OUTPUT_MAX_BYTES` 1048576,
  `CHANGED_PATH_MAX_BYTES` 4096, `RECORD_LIST_MAX_ITEMS` 1000, `RECORD_TEXT_MAX_LENGTH` 65536, `RECORD_IDENTIFIER_MAX_LENGTH` 256,
  `EVIDENCE_LOG_FILE_MAX_BYTES` 1048576, `EVIDENCE_LOG_FILES_MAX` 16, `HANDOFF_MAX_BYTES` 8388608).
- `packages/core/src/policy/loader.ts`: git and GitHub policy sources; a `dockerfile` image must exist as a regular file (mode
  100644 or 100755) at `runner.image.path` in the loaded tree. `policy/rules.ts`: cross-field rules; `policy/messages.ts` codes
  incl. `policy.missing-key`, `policy.limit-out-of-bounds`, `policy.invalid-value`. `policy/template.test.ts` checks the template
  validates, writes every key, and that template limit values equal `POLICY_LIMITS.templateValue`; `policy/schema.test.ts` checks
  `templates/policy/policy.schema.json` against `policyEditorJsonSchema()`.
- `packages/core/src/submission/default-checklist.ts`: `DEFAULT_CHECKLIST_POLICY` embeds the template's resolved policy (execution
  command `test` = `[make, test]`, platform `linux` container, image `docker.io/library/debian:stable-slim`); a drift test keeps
  it equal to the template.
- `packages/core/src/records/execution-record.ts`: `executionRecordSchema` strict: `schema_version`, `record_type
  'execution-record'`, `run_id`, `run_attempt`, `plan_entry`, `command[]`, `environment {image_digest (sha256 or null),
  tool_versions[] {name, version}}`, `exit {code, signal, timed_out}`, `output {head, tail, truncated, total_bytes}`,
  `result_files[] {path, content_hash, bytes}`, `test_identity`, `commits {head, base, merge}`, `admissibility`.
  `vocabulary.ts`: `ADMISSIBILITY_VALUES = ['evidence', 'signal']`, `FAILURE_CAUSES` (20, incl. `environment-unavailable`,
  `budget-exhausted`, `stage-incomplete`, `steward-defect`).
- `packages/core/src/process/run-process.ts`: `runProcess(binary, args, {cwd, env, timeoutMs, maxOutputBytes})` via `execFile`,
  `shell: false`, `maxBuffer` KILLS the child on overflow (unsuitable for output floods; streaming capture is new work).
- `packages/core/src/git/`: `reader.ts` (`inertGitEnv(base)` strips `GIT_*` but passes the REST of the host environment, sets
  `GIT_TERMINAL_PROMPT=0`, `GIT_OPTIONAL_LOCKS=0`, `GIT_NO_REPLACE_OBJECTS=1`; `resolveCommit`, `readPolicyTreeId`, `listTree`,
  `readBlob`, `TreeEntryMode` 100644/100755/120000/160000), `command.ts` (`runGitCommand`), `diff.ts` (`findMergeBase`,
  `listChangedPaths` with `--no-ext-diff --no-textconv`, `countCommitParents`), `remotes.ts`.
- `packages/core/src/submission/paths.ts`: `PATH_CLASSES = ['test', 'docs', 'infra', 'code']`, `classifyPath`,
  `changedPathSet`; `path-lists.ts` `PATH_CLASS_TEST_GLOBS`.
- `packages/core/src/pipeline/`: `phases.ts` (`LOCAL_PHASES` intake, execute, assess are pass-throughs; `runWithPhaseTimeout`),
  `handoff.ts` (`HANDOFF_VERSION = 1`; strict `handoffRecordSchema` with `budget_remaining {github_requests, model_calls, tokens,
  ai_credits, executions, execution_seconds, rounds}`, append-only findings, causes, stage_results; `HANDOFF_MAX_BYTES`),
  `budget.ts` (`initialBudget`: executions = `limits.execution.executions_per_run`, execution_seconds =
  `limits.execution.run_execution_seconds`), `sequence.ts`, `screen.ts` (`screenSubmission(ScreenDeps)`; deps inject fetch,
  clock, phases, evidence, decide), `publish-phase.ts`.
- `packages/core/src/evidence/`: `layout.ts` (`executionFilePath(n)` = `executions/execution-NNNN.json`, recognized by
  `recordTypeForPath` as `execution-record`), `assemble.ts` (run budget `executions: 0`, `container_seconds`), `verify.ts`
  (validates `execution-record` files), `redact-records.ts`, `logs.ts`, `metrics.ts` (cost event has `container_seconds`).
  `layout.ts` `recordTypeForPath` returns `null` (listed, not a record) for `logs/<name>.txt` via `LOG_FILE_PATTERN`
  `^logs\/[a-z0-9][a-z0-9-]{0,63}\.txt$`, and `undefined` (not part of the layout, manifest invalid) for any unrecognized path.
  `manifest.ts`: entries `{path (1-256), bytes, sha256, record_type, content_hash}`, `content_hash` non-null exactly when
  `record_type` is non-null; `logs/` entries capped at `EVIDENCE_LOG_FILE_MAX_BYTES` (1048576) and `EVIDENCE_LOG_FILES_MAX` (16);
  `files` at most `EVIDENCE_RUN_FILES_MAX - 1` (4095). `publish.ts` budget: `limits.evidence.run_bytes` (template 10485760, bounds
  65536 to 52428800) = records + report files + metrics + manifest + `logs/steward.txt`; the steward log is truncated to the
  remaining budget (`truncateLogText`, at most 1048576); a negative remainder or a final total over the limit returns
  `evidence.too-large` (cause `budget-exhausted`). `local-store.ts` returns `evidence.too-many-files` (`budget-exhausted`) when
  the file count plus one exceeds `EVIDENCE_RUN_FILES_MAX` (4096).
- `packages/core/src/redaction/redact.ts`: `applyRedactionRulesBatch` packs string inputs into batches of at most
  `REDACTION_INPUT_MAX_BYTES` (8388608) UTF-8 bytes; ANY single input above that returns `redaction.input-too-large` (cause
  `infrastructure`); each batch runs in a worker bounded by `REDACTION_TIMEOUT_MS` (2000) (`redaction.timeout`). Replacement
  marker `[REDACTED:<rule id>]` (can be longer than the matched text, so redacted text can grow). Redaction works on strings only.
- `packages/core/src/report/`: `render.ts` input `executedCommands: string[]`; `templates.ts` section `executed-commands`
  ("### Executed commands and results"), runner provenance line `- Runner: no execution in this run`; caps 10 items of 600
  characters.
- `packages/core/src/conformance/zero-execution.fixture.test.ts`: spies `node:child_process`, and a static import scan over
  `submission/`, `github/`, `net/`, `git/`, `cli/src/`, `pipeline/`, `evidence/`, `report/`, `decision/`, `ownership/`,
  `action/src/` forbidding specifiers matching `/(llm|model|copilot|openai|anthropic|sandbox|container|docker|runner)/i` and
  `child_process`, `vm`, `worker_threads`. `cli/src/preflight-zero-execution.fixture.test.ts` ("zero model calls and zero
  executions") and `steward-zero-execution.fixture.test.ts` (screen) assert no execution. Both commands resolve credentials
  through `cli/src/github-auth.ts` `resolveGitHubAuth` (called from `screen-command.ts` and `preflight-command.ts`): when
  `GH_TOKEN` and `GITHUB_TOKEN` are unset or empty it spawns `gh` with `GH_AUTH_TOKEN_ARGS` = `['auth', 'token', '--hostname',
  'github.com']` through core `runProcess`; the screen spy test asserts exactly one such call besides read-only `git remote`
  calls. M07 rewrites these as invariant-3 checks (see "Conformance checks").
- `packages/cli/src/`: `preflight-args.ts` (`PREFLIGHT_USAGE`, strict `parseArgs`), `preflight-command.ts`
  (`PREFLIGHT_EXIT_BY_DISPOSITION` met 0, needs-changes 1, uncertain 1, inconclusive 3; usage and environment 2),
  `preflight-output.ts` (`PREFLIGHT_NOTICE`, JSON line escaping), `screen-args.ts`, `screen-command.ts`, `upstream.ts`,
  `github-auth.ts`, `conventions.ts`, `steward-commands.live.test.ts` (screens test-bed issue 29 and PR 26).
- `templates/policy/policy.yml`: runner `registry` `docker.io/library/debian:stable-slim`, `dependency_step: null`, resources 2,
  4096, 512; `execution.commands` one `test` `[make, test]`; `limits.execution` six keys.

### Planner measurements (Docker Desktop 29.8.0 on this host, 2026-09-28; throwaway resources, all removed)

- `docker create --read-only --mount type=volume,dst=/work ... --user 65532:65532` then `docker cp -a - <id>:/work < tar` WORKS on
  a read-only root filesystem (copy lands in the volume). Files keep the tar header uid/gid 65532, but the mount point `/work`
  stays `root 0755`: the non-root user cannot create files directly in `/work`. A tar whose top entry is a directory `checkout/`
  owned by 65532 gives a writable `/work/checkout` (verified: `touch` and `mkdir` succeed).
- `--tmpfs /tmp:rw,exec,nosuid,nodev,size=16m,mode=1777` with `--memory 64m`: a 32 MiB write stopped at 16 MiB (size enforced).
- With `--read-only`, writing to `/` fails (`Read-only file system`); `--cap-drop ALL` plus non-root: `ping` fails ("permission
  denied"); `--network none`; `/var/run` absent in busybox; mountinfo showed only `/` overlay, `/proc`, `/dev`, `/dev/pts`, `/sys`,
  `/sys/fs/cgroup`, `/dev/mqueue`, `/dev/shm`, `/tmp` tmpfs, `/work` volume, and the runtime-generated `/etc/hostname`, `/etc/hosts`,
  `/etc/resolv.conf`; environment inside: `HOSTNAME`, `SHLVL`, `HOME` (set by `--env`), `PATH` (image), `PWD` only.
- `--log-driver none` with `docker start -a`: output streamed to the attached client normally.
- `docker cp <id>:<path> -` after exit returns a tar stream; for a symlink path the entry is the symlink itself (`evil.xml ->
  /etc/shadow`), not its target.
- `docker build -q --platform linux/amd64 --label ... -t <tag> -f Dockerfile - < context.tar` builds from a tar context on stdin.
- Containerd image store: for a pulled image, `image inspect .Id` EQUALS the repo digest (index digest), e.g. busybox 1.37 `Id` =
  `RepoDigests[0]` digest; a locally built image has `RepoDigests` `[<tag repo>@<Id>]`. Identity code must not assume the classic
  store's distinct config-digest id.
- Named volumes created with `--label` are removable by label; anonymous volumes carry no container label (leftover dangling
  volumes from earlier `act` runs exist on this host, so leak checks must use labels, never "dangling" counts).

### Plan-wide DoD items that apply (plan §0.3)

| §0.3 item | How it applies here |
| --- | --- |
| Build, type-check, tests, lint, format (Ubuntu and Windows) | Windows in the main tree; Ubuntu via `act` on an LF clone (D8); the container tier on Windows under Docker Desktop and under the local Podman machine (Q14 A), and in the new CI job (Docker leg verified through `act`, D8; the Podman leg first runs on GitHub after the owner pushes). |
| Runtime validation; handled as data | New inputs: runtime CLI JSON (`version`, `info`, `inspect`), container output, copied-out result files (tar streams), JUnit XML, git `ls-tree`/`cat-file` output, fetched objects, preflight command output. All zod-validated or parsed by bounded parsers; none reaches a shell (argv only; the one exception is Windows `.cmd`/`.bat` shims through `cmd.exe /d /s /c` with strict escaping, Q11 A), a workflow expression, or an authorization decision. |
| Injected failures never `pass` | invariant-4 gains runner, image, materialization, fetch, planner, transport, and preflight-run injections (G7 EP7). |
| Limits under hard bounds; redaction before persistence | G1 keys (policy) and K52–K63 (constants); every execution record, output, build log, and stored result file redacted (built-in detectors, policy patterns, exact values of resolved credentials) before persistence. |
| No decision input from authorship | Unchanged; no execution input names an author. |
| Evidence and metrics per delivered step | Q7 A: `steward screen --pr` stores execution records, output files (ER8, Q17 B), result files (ER9, ER10, Q20 A), run budget (`executions`, `container_seconds`), and the cost metrics event. Preflight stores nothing (claims). |
| Fixture corpus grows | TypeScript sample target repository; hostile repository manifests (hooks, filters, submodules, symlinks, traversal overlays, canary readers, fork bomb, memory hog, output flood, network probe, scratch filler); JUnit samples and hostile XML; injection text in test names and output. |
| Decisions recorded governing document first | ADR-0079 onward (G10); architecture, processes, whitepaper §9–§14, README, CLAUDE.md, user manual; §15 loses three items. |
| Documentation describes only what was delivered | Container executions in `steward screen` are unclassified (no stage); T1 still runs no container. |
| Invariant conformance | invariant-3 FIRST check; invariant-1, -4, -5, -7 extended. |

### Gate G1 — execution-limit policy keys (APPROVED, Q1 A and Q2 A; D5)

New `POLICY_LIMITS` rows (17; total 58). Every value an integer; out of bounds is `policy.limit-out-of-bounds`, never clamped.

| Key | Unit | Template value | Minimum | Hard maximum | Enforced by |
| --- | --- | --- | --- | --- | --- |
| `runner.resources.scratch_mb` | MiB | 1024 | 64 | 8192 | tmpfs `size=` of `/tmp` in every container (pages count against `runner.resources.memory_mb`) |
| `limits.execution.output_head_bytes` | bytes | 262144 | 1024 | 4194304 | runner keeps the first N output bytes |
| `limits.execution.output_tail_bytes` | bytes | 786432 | 1024 | 4194304 | runner keeps the last N output bytes |
| `limits.execution.output_stream_bytes` | bytes | 268435456 | 65536 | 4294967296 | runner stops (kills) an execution after reading N output bytes; recorded `exit.output_limited` |
| `limits.execution.result_files` | files per execution | 5 | 0 | 20 | validation XR4; runner copies out at most N declared files |
| `limits.execution.result_test_cases` | test cases per result file in the record | 1000 | 1 | 1000 | parser counts all cases, the record lists the first N (`cases_truncated`) |
| `limits.execution.checkout_bytes` | bytes | 536870912 | 1048576 | 4294967296 | materializer stops building the checkout archive past N bytes (environment failure) |
| `limits.execution.checkout_files` | files | 100000 | 100 | 1000000 | materializer entry count |
| `limits.execution.prepared_checkout_bytes` | bytes | 2147483648 | 1048576 | 8589934592 | bound on the dependency step's exported copy |
| `limits.execution.overlay_files` | files | 200 | 1 | 3000 | overlay count (OV1) |
| `limits.execution.overlay_bytes` | bytes | 10485760 | 1024 | 104857600 | overlay total content bytes (OV1) |
| `limits.execution.materialize_seconds` | s | 300 | 10 | 1800 | fetch plus object reads plus archive build, per commit |
| `limits.execution.image_pull_seconds` | s | 600 | 30 | 3600 | registry pull |
| `limits.execution.image_build_seconds` | s | 1800 | 60 | 3600 | Dockerfile build |
| `limits.execution.image_bytes` | bytes | 4294967296 | 104857600 | 21474836480 | image size from `image inspect` after pull or build |
| `limits.execution.build_context_bytes` | bytes | 10485760 | 1024 | 104857600 | `runner/` build context archive |
| `limits.execution.container_start_seconds` | s | 120 | 5 | 600 | volume create, container create, copy-in, and start until attached |

New cross-field rules (code `policy.invalid-value`, key path of the second key):

- XR1 `limits.execution.output_head_bytes + limits.execution.output_tail_bytes <= limits.execution.output_bytes`.
- XR2 `limits.execution.output_stream_bytes >= limits.execution.output_bytes`.
- XR3 `limits.execution.prepared_checkout_bytes >= limits.execution.checkout_bytes`.
- XR4 every `execution.commands[].result_files` has at most `limits.execution.result_files` entries.

Existing keys keep their meaning and bounds: `limits.execution.output_bytes` = stored output per execution (head plus tail);
`execution_seconds` = wall clock of one execution from start to exit; `run_execution_seconds` = sum of execution wall clock in
a run (dependency steps included; pulls and builds excluded); `executions_per_run` counts dependency steps and commands;
`result_file_bytes` = one result file; `dependency_step_seconds` = one dependency step.

Consequences of D5 (the owner's non-recommended choice), stated for the owner:

- C1 The policy surface grows by 17 keys; the template, editor schema, and configuration reference grow; maintainers get more
  knobs to misconfigure.
- C2 Each future adjustment touches the bounds registry, schema, template, editor schema, docs, and tests.
- C3 Keys interact (XR1–XR4) and add validation failures a hard-only design would not have.
- C4 Per-repository values make execution evidence less comparable across repositories (a later baseline key must include the
  effective limits).
- C5 Made REQUIRED, the keys would invalidate every existing policy: the 4 valid fixture policies, the 11 invalid and 9 hostile
  fixture policies, `fixtures/submissions/proposed-policy-valid.yml`, the 6 `scenarios/fixtures/policies/*.yml`,
  `DEFAULT_CHECKLIST_POLICY`, and the policies already published on the three test-beds (the live test `live: test-bed published
  policy loads and validates` in `packages/core/src/github/github.live.test.ts` would fail, and D8 forbids updating the test-beds
  in this milestone). Avoided: Q2 A makes the keys optional (M1).
- C6 A too-low value fails closed: an environment failure (`inconclusive`), never a wrong result.

Mitigations (approved):

- M1 Q2 A: the new keys are optional with documented defaults equal to their template values; the resolved policy records every
  effective value; the template writes every key explicitly; `version: 1` stays (ADR-0035 "optional addition"); every existing
  policy (fixtures, `DEFAULT_CHECKLIST_POLICY`, scenarios, the published test-bed policies) stays valid unchanged.
- M2 `POLICY_LIMITS` stays the single registry; the existing test that every integer schema key is registered covers the new keys.
- M3 XR1–XR4 are typed and name both keys.
- M4 Every execution record records the limits applied (ER4), so stored evidence stays interpretable after a policy change.
- M5 Hard maxima follow GitHub-hosted Linux runner capacity (4 vCPU, 16 GiB memory, about 14 GB free disk) so T1 can reuse them.

### Gate G2 — hard-only constants (APPROVED, Q3 A; continue K1–K51; listed in architecture §12.1 when delivered)

These bound parser and protocol safety or runtime plumbing, not the work an execution may do, following the K1–K51 practice. Q3 A:
they stay hard-only constants, never policy keys.

| Row | Constant | Value | Basis |
| --- | --- | --- | --- |
| K52 | JUnit XML nesting depth | 64 | real reports nest 2–4 levels |
| K53 | JUnit XML elements per file | 200000 | bounded by `limits.execution.result_file_bytes` too |
| K54 | JUnit XML attributes per element; attribute value length | 64; 65536 characters | reporter output uses under 10 attributes |
| K55 | Test case identity length | 4096 characters (UTF-16 code units) | longer identities are cut to at most 4096 code units on a code point boundary and flagged `junit.cases[].identity_truncated: true` (ER7) |
| K56 | Container runtime control command timeout (`version`, `info`, `inspect`, `volume create`, `volume rm`, `kill`, `rm`, `image inspect`) | 120000 ms | Docker Desktop cold calls take seconds |
| K57 | Container runtime control command output | 1048576 bytes | `inspect` JSON is a few KiB |
| K58 | Kill-and-remove grace after a stop decision | 30000 ms | then environment failure `runner.cleanup-failed` |
| K59 | Sandbox user and group | `65532:65532` (fixed) | common non-root id (distroless `nonroot`) |
| K60 | Sandbox platform | `linux/amd64` (fixed) | D6 |
| K61 | Sandbox paths | checkout `/work/checkout`, scratch `/tmp` (fixed) | planner measurements |
| K62 | Checkout path and symlink target length | 4096 bytes | equals changed-path bound |
| K63 | Fetch depth | 1 (fixed) | one commit's tree is all materialization needs |

### Gate G3 — container hardening profile (APPROVED, Q4 A and Q5 A; HP8 Podman variant Q21 A; Podman `/work` precondition Q22 A; HP-rules)

- HP1 Lifecycle per execution (both runtimes): `volume create` (labeled) → `create` (flags HP2) → `cp` the checkout archive from
  standard input into `/work` → `start -a` (no `-i`: standard input closed) with streamed, bounded capture (HP5) → `inspect`
  (exit code, `OOMKilled`) → `cp` each declared result file out to standard output (tar) → `rm -f` → `volume rm`, always in
  `finally`. Dependency step: same, but after exit `cp <id>:/work/checkout -` exports the prepared copy as a tar stream bounded
  by `prepared_checkout_bytes`, kept as a host temp file, NEVER extracted on the host. Podman only (Q22 A): the first `volume
  create` for an image in a run happens only after that image passed the IM5 `/work` precondition; Docker has no such step.
- HP2 `create` argument vector (docker; order fixed; values in angle brackets):

```text
<bin> create
  --label org.patch-steward.managed=true --label org.patch-steward.run=<run id> [--label org.patch-steward.test=<nonce>]
  --platform linux/amd64 --pull never
  --user 65532:65532 --read-only
  --network none                       (dependency step: flag omitted, runtime default network)
  --cap-drop ALL --security-opt no-new-privileges
  --pids-limit <pids> --memory <memory_mb>m --memory-swap <memory_mb>m --cpus <cpus>
  --ulimit core=0:0 --ipc private --cgroupns private --hostname patch-steward
  --log-driver none
  --tmpfs /tmp:rw,exec,nosuid,nodev,size=<scratch_mb>m,mode=1777
  --mount type=volume,src=<volume>,dst=/work,volume-nocopy
  --workdir /work/checkout[/<working_directory>]
  --env HOME=/tmp --env TMPDIR=/tmp --env CI=true
  --entrypoint <run[0]>
  <image by digest or id>
  <run[1..]>
```

  Podman: the same plus `--read-only-tmpfs=false` (otherwise Podman mounts unbounded tmpfs on `/run`, `/var/tmp`, and others), and
  the volume mount WITHOUT a no-copy option (owner decision Q22 A, 2026-10-23): exactly `--mount type=volume,src=<volume>,dst=/work`
  in the same position. Measured on Podman 6.1.3 (client 6.1.2): `volume-nocopy`, `volume-nocopy=true`, `nocopy`, `nocopy=true`,
  `copy=false`, and `no-copy` are rejected as "invalid mount option"; `volume-opt=nocopy` and `volume-opt=copy=false` are accepted at
  create but are volume-driver options, not a copy-up control, and are never emitted. Podman copies image content at `/work` into
  the empty volume (copy-up), so under Podman the guarantee "the volume holds only the steward's checkout" rests on the IM5
  precondition (the image's `/work` is absent or empty, checked before the image is used), not on a mount option. Docker keeps
  `volume-nocopy` unchanged. The forbidden-argument check accepts exactly these two `--mount` forms (the Docker form with
  `,volume-nocopy`, the Podman form without it) and nothing else: no `volume-opt`, no other mount option.
- HP3 Never in any argument vector: `-v`, `--volume`, `--mount type=bind`, any host path, `--privileged`, `--cap-add`, `--device`,
  `--security-opt seccomp=unconfined`, `apparmor=unconfined`, `label=disable`, `--env-file`, `--env NAME` without `=`, `--network
  host`, `--network container:`, `--pid host`, `--ipc host`, `--userns host`, `--uts host`, `-i`, `-t`, `--init` (injects a host
  binary), `--add-host`, `--group-add`, `--sysctl`, `--gpus`, a socket path. Data enters and leaves only through `cp` streams.
- HP4 The runtime CLI process itself gets a minimal environment: `PATH`, `SystemRoot`, `windir`, `ComSpec`, `PATHEXT`, `TEMP`,
  `TMP`, `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `ProgramData`, `ProgramFiles`, `XDG_RUNTIME_DIR`, `XDG_CONFIG_HOME`,
  `XDG_DATA_HOME`, `DOCKER_HOST`, `DOCKER_CONTEXT`, `DOCKER_CONFIG`, `DOCKER_CERT_PATH`, `DOCKER_TLS_VERIFY`, `CONTAINER_HOST`,
  `CONTAINER_CONNECTION`, `CONTAINERS_CONF`, `CONTAINERS_STORAGE_CONF`, `REGISTRY_AUTH_FILE` when set; nothing else.
- HP5 Capture: standard output and error read as one stream in host arrival order; the first `output_head_bytes` and the last
  `output_tail_bytes` kept; reading continues (draining) until exit or `output_stream_bytes`, which stops the execution
  (`kill`); decoded as UTF-8 with U+FFFD replacement, cut on character boundaries; omitted bytes marked `[... <n> bytes omitted
  ...]`; `total_bytes` counts all bytes read. HP5 governs capture only; how the capture is redacted, bounded against
  `REDACTION_INPUT_MAX_BYTES`, stored as a file, and excerpted into the record is ER8 (Q17 B).
- HP6 Time: a steward timer per execution (`execution_seconds`, or `dependency_step_seconds`) issues `kill` and records
  `exit.timed_out`; `container_start_seconds` bounds HP1 up to the attach; the phase timeout (`limits.stage_seconds`) still
  bounds the execute phase (I5).
- HP7 Result: exit code and `OOMKilled` from validated `inspect` JSON; `timed_out`, `oom_killed`, `output_limited` recorded;
  none of them is an environment failure; an execution whose entrypoint cannot start (runtime start error, for example
  executable not found) IS an environment failure (`runner.start-failed`).
- HP8 Enforcement proof: container-tier tests assert the inspected configuration equals HP2 (User, ReadonlyRootfs, NetworkMode,
  CapDrop, SecurityOpt, PidsLimit, Memory, MemorySwap, NanoCpus, Tmpfs size, Mounts) AND behaviorally: fork bomb bounded by
  `pids` and the run terminates; memory hog ends `oom_killed`; sleep past `execution_seconds` ends `timed_out`; output flood ends
  `output_limited` with head and tail kept; scratch filler hits ENOSPC at `scratch_mb`; `id -u` is 65532; `/proc/self/status`
  `CapEff` is 0 and `NoNewPrivs` 1; no network interface but `lo`; no socket file (`/var/run/docker.sock`, `/run/docker.sock`,
  `/run/podman/podman.sock`); mountinfo lists nothing beyond the K61 paths, pseudo-filesystems, and the three runtime-generated
  `/etc` files (I-list I28).
  HP8 Podman variant (owner decision Q21 A, 2026-10-23; applies ONLY when the runtime is `podman`; Docker checks above unchanged):
  - Capabilities: the authoritative check is the five masks in `/proc/self/status` inside the container: `CapInh`, `CapPrm`,
    `CapEff`, `CapBnd`, `CapAmb` each all zeros (regex `^Cap(Inh|Prm|Eff|Bnd|Amb):\s+0+$`, all five lines present). Zero masks
    mean no capability regardless of the inspected `HostConfig.CapDrop` shape, so under Podman the inspected `CapDrop` is
    accepted when it equals `['ALL']` OR is any other list (measured Podman 6.1.3: the 11-capability default list). Under Docker
    the inspected `CapDrop` must still equal `['ALL']` and `CapEff` must be 0.
  - Mounts: mountinfo may additionally list exactly these four Podman-generated mount points (exact match of the mountinfo
    mount-point field; nothing below them): `/etc/passwd`, `/etc/group`, `/run/.containerenv`, `/run/secrets`; and
    `/run/secrets` must list no entries inside the container (`ls -A /run/secrets` prints nothing; an entry would be host data
    copied from the host's `mounts.conf` and fails E2). Every other mount point stays forbidden exactly as for Docker.
    Host condition (owner decision Q23, 2026-10-23; no rule change): on this host the Podman machine VM's default mounts
    (`mounts.conf`) inject `rhsm` (Red Hat subscription data) into `/run/secrets`; the owner empties those default mounts outside
    the repository. A non-empty `/run/secrets` is a host environment condition the owner fixes: the emptiness check above stays
    exactly as written, is never relaxed, and its failure is `needs-human` for the owner, never a code or test change.
  - Unchanged for Podman: HP2 still passes `--cap-drop ALL` (argv tests unchanged); `NoNewPrivs` 1; `id -u` 65532; the inspected
    `Mounts` list must still be exactly the one `/work` volume with no bind; every other HP8 item.
  HP8 `/work` copy-up proof (owner decision Q22 A, 2026-10-23), in `packages/core/src/conformance/invariant-3.container.test.ts`
  inside the 'invariant 3: container sandbox' describe. Each test is registered only under its runtime (a plain `if` on
  `RUNTIME_NAME` around the `it` call, so the other runtime reports no entry, neither passed nor skipped); none of these titles
  starts with `exit E`; each test removes every image it builds (labeled `org.patch-steward.test`) so the CI6 leak checks stay empty.
  Test images are dockerfile images built `FROM` the pinned shell test image (prepare that image first so the base is local).
  - Docker only, title exactly 'image content at /work is not copied into the volume': image built with `RUN mkdir -p
    /work/image-copied && echo image > /work/image-copied/marker`; run `['ls', '-A', '/work']` on a materialized checkout; expect
    kind `completed`, exit code 0, non-empty output lines exactly `['checkout']` (the existing Docker behavior).
  - Podman only, title exactly 'an image with content at /work is refused under podman': the same image; the run ends as an
    environment failure with code `runner.create-failed` and a detail whose `path` is `/work` and whose `message` is
    `image-work-not-empty` (IM5); no execution container and no volume was created for it (no `volume create` and no `create`
    carrying `--mount` in the harness calls after the IM5 probe).
  - Podman only, title exactly 'an image with an empty /work yields only the checkout under podman': image built with `RUN mkdir
    -p /work`; run `['ls', '-A', '/work']`; expect kind `completed`, exit code 0, non-empty output lines exactly `['checkout']`.
- HP9 Stated limitation (Q5 A): the labeled `/work` volume has no portable disk quota; writes under `/work/checkout` during an
  execution are bounded only by time (`execution_seconds`, or `dependency_step_seconds` for the dependency step), and the
  dependency step's exported copy by `prepared_checkout_bytes`. Phase 5 documents this as a limitation (architecture §12
  execution bounds and §13 "Container escape on the runner" or a resource-exhaustion note, user manual Runner or Limits); no
  test asserts a disk quota on `/work`.

### Gate G4 — inert materialization and overlays (APPROVED, Q6 A; MT-, PV-, OV-rules)

- MT1 Fetch (screen): a temporary bare repository under the OS temp dir (`git init --bare -q`), then `git fetch --no-tags
  --no-recurse-submodules --no-write-fetch-head --depth=1 --end-of-options <url> <commit>` with inert configuration: `-c
  core.hooksPath=<empty temp dir>`, `-c core.fsmonitor=false`, `-c fetch.fsckObjects=true`, `-c transfer.fsckObjects=true`, `-c
  protocol.allow=never`, `-c protocol.https.allow=always`, `-c credential.helper=`, `-c submodule.recurse=false`, `-c
  fetch.recurseSubmodules=false`, `-c core.askPass=`; environment: no host `GIT_*`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=<empty
  temp file>`, `GIT_TERMINAL_PROMPT=0`, no `GIT_ASKPASS` or `SSH_ASKPASS`. `<url>` is exactly `https://github.com/<owner>/<repo>.git`;
  tests may inject an absolute local directory path instead, and only then `-c protocol.file.allow=always` replaces the https
  allowance. A resolved GitHub token, if any, is passed only as `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=http.https://github.com/.extraheader`,
  `GIT_CONFIG_VALUE_0=AUTHORIZATION: basic <base64 of x-access-token:token>` in the environment, never in argv, never persisted.
  After fetch, `rev-parse --verify <commit>^{commit}` must equal the requested id. Bounded by `materialize_seconds`.
- MT2 Read: `ls-tree -r -z --full-tree <commit>` (at most `checkout_files` entries) and blobs through `cat-file --batch`
  (running total at most `checkout_bytes`); only modes 100644, 100755, 120000, 160000; every path passes PV.
- MT3 Archive: a steward-built POSIX tar (ustar plus PAX for long names), top entry `checkout/`, all entries under it, uid and
  gid 65532, directories 0755, files 0644 or 0755 by git mode, symlinks as symlink entries with their committed target (no
  resolution), gitlinks (submodules) omitted and listed in the record; mtime = the commit's committer time; the archive SHA-256 is
  recorded. The archive is written to a host temp file and streamed into `cp`.
- MT4 Inert by construction: no working tree, no checkout, no filter (clean, smudge, process, LFS), no hook, no attribute
  processing (`.gitattributes` eol, filter, export-ignore, export-subst never apply; bytes exactly as committed), no submodule
  command, no repository-controlled program on the host. The temp repository, temp config, and archive are deleted in `finally`.
- PV1 Paths: valid UTF-8, 1 to 4096 bytes, no NUL or control character (below 0x20, 0x7f), no leading `/`, no `\`, no empty,
  `.`, or `..` segment.
- PV2 No segment that, after removing trailing dots and spaces and the HFS-ignorable code points (U+200C–U+200F, U+202A–U+202E,
  U+206A–U+206F, U+FEFF), case-folds to `.git` or `git~1`.
- OV1 An overlay is a list of `{path, content, mode 100644 or 100755}` or `{path, delete}` entries (never a symlink), at most
  `overlay_files` entries and `overlay_bytes` content bytes.
- OV2 Each overlay path passes PV; no proper prefix of it is a blob, symlink, or gitlink in the base tree (as modified by earlier
  overlay entries); the path itself is not a symlink, gitlink, or directory in the base tree.
- OV3 Any violation fails the whole materialization with `materialize.overlay-rejected` (subject = the escaped path); no partial
  overlay. Overlays are applied while building the archive, never written through a host filesystem.
- MT5 M07 uses overlays only in the preflight preview (G8, applied to a temporary worktree under the same OV rules plus host
  realpath checks) and in the E1 tests; container before-and-after executions are M08.

### Gate G5 — runtimes and images (APPROVED; IM5 Q22 A; RT-, IM-rules)

- RT1 Selection: `auto` (default) tries `docker version --format json`, then `podman version --format json` (K56, K57); the first
  whose validated JSON has a server (engine) is selected; none gives environment failure `runner.runtime-unavailable`. An
  explicit selection uses only that runtime.
- RT2 Server OS must be `linux` (Docker Desktop in Windows-containers mode gives `runner.runtime-not-linux`); any server
  architecture is accepted because every container runs `--platform linux/amd64` (emulated on arm64 hosts).
- RT3 Limits must be enforceable: Podman `info` must report cgroup v2 and the `cpu`, `memory`, and `pids` controllers; Docker `info`
  must carry no warning about missing memory, cpu, or pids limit support; any runtime warning on `create` about an ignored limit
  is `runner.limits-unenforceable`. Never run with a limit silently dropped.
- RT4 Identity recorded: runtime name, client version, server version, server OS and architecture. The RT1 `version` JSON schema
  admits client and server versions only as 1 to 64 printable ASCII characters without space (`^[\x21-\x7e]{1,64}$`), so they fit
  ER3 and I23.
- IM1 Registry: `pull --platform linux/amd64 <reference>` (bounded by `image_pull_seconds`); validated `image inspect`; the digest
  is the repo digest for the reference's repository (for a reference already pinned by `@sha256:`, it must equal the pin);
  containers run as `<repository>@<digest>`, never by tag after resolution. `image_bytes` checked after pull
  (`runner.image-too-large`).
- IM2 The steward never passes, stores, or configures registry credentials; the host runtime's ambient configuration (context,
  login) is left unchanged (I9).
- IM3 Dockerfile: the build context is the regular files of the `runner/` subtree of the loaded policy revision, read from git
  objects (git policy source) or GitHub tree and blob reads by tree id (GitHub policy source); a symlink or gitlink in it is
  `runner.build-context-invalid`; context archive at most `build_context_bytes`; `build --platform linux/amd64 --label
  org.patch-steward.managed=true --label org.patch-steward.runner-tree=<runner tree id> -t patch-steward-runner:<runner tree id>
  -f <Dockerfile path relative to runner/> -` with the archive on standard input (verified on Docker; if `podman build` cannot read
  a context from standard input, the context is written from git objects to a host temp directory as regular files only and
  removed after); no build args, secrets, or SSH; runtime default build network; bounded by `image_build_seconds`; bounded,
  redacted build output kept as a run log.
- IM4 Cache: `image inspect patch-steward-runner:<runner tree id>` with a matching `org.patch-steward.runner-tree` label is a
  hit (recorded `cached: true`); the steward never prunes images (I11).
- IM5 Podman `/work` precondition (owner decision Q22 A, 2026-10-23; Podman ONLY, Docker never runs it): because Podman has no
  no-copy volume option (HP2), every image the runner uses under Podman (the policy runner image from IM1, IM3, or an IM4 cache
  hit, and every container-tier test image) must have `/work` absent or an empty directory. Mechanism (reuses the existing `create`,
  `cp` out, `TarStreamParser` in `packages/core/src/archive/tar-read.ts`, and `rm -f`; nothing in the image is executed): once per
  resolved image per run, after resolution (pull, build, or cache hit) and before any `volume create` or execution `create` for that
  image, the runner
  1. creates a probe container that is NEVER started, with exactly this argument vector (order fixed):

     ```text
     podman create
       --label org.patch-steward.managed=true --label org.patch-steward.run=<run id> [--label org.patch-steward.test=<nonce>]
       --platform linux/amd64 --pull never
       --user 65532:65532 --read-only --read-only-tmpfs=false
       --network none
       --cap-drop ALL --security-opt no-new-privileges
       --log-driver none
       --entrypoint /bin/true
       <image by digest or id, the same reference the executions use>
     ```

     (no `--mount`, no `--tmpfs`, no `--env`, no `--workdir`; the entrypoint is never run, and its absence in the image does not
     matter; the HP3 forbidden-argument scan covers this vector too);
  2. streams `podman cp <probe id>:/work -` (bounded by K56, standard error bounded like every runtime control command) through
     `TarStreamParser`, stopping the stream at the second entry event;
  3. decides: `cp` exits non-zero with no stdout byte and standard error matching the existing not-found pattern of `copy-out.ts`
     (`/no such file or directory|could not find the file/i`) → `/work` absent, pass; exactly one entry event (PAX headers are
     applied by the parser and are not entries), of kind `directory`, path `work` or `work/`, followed by a valid end of archive →
     empty, pass; anything else (a second entry, a first entry that is not a directory or has another path, a symlink or regular file
     at `/work`) → refused;
  4. removes the probe with `rm -f <probe id>` in `finally` (K58 grace; failure `runner.cleanup-failed`).
  Failure codes (all existing I4 codes, cause `environment-unavailable`, so the run is `inconclusive`, never a pass): refused →
  `runner.create-failed` with detail `{ code: 'runner.create-failed', path: '/work', message: 'image-work-not-empty' }`; the probe
  `create` fails → `runner.create-failed`; the probe `cp` fails otherwise, times out, or yields an invalid tar stream →
  `runner.copy-failed`. The probe is not an execution: it does not count against `executions_per_run`, `run_execution_seconds`, or
  `container_seconds` and produces no execution record. Consequence (stated in the docs, phase 5): under Podman a non-empty image
  `/work` is refused rather than neutralized; under Docker the same image runs and its `/work` content never reaches the volume.
  Unit tests (fake process runner, `packages/core/src/runner/image.test.ts` or the module that hosts the probe): exact probe argv;
  absent, empty-directory (with and without a PAX header), second-entry, non-directory, wrong-path, invalid-tar, cp-error, and
  create-error cases with their codes; `rm -f` issued on every path after a successful probe `create`; no probe call at all under
  Docker.

### Gate G6 — execution records, admissibility, JUnit (APPROVED, Q8 A, Q9 A, Q17 B, Q18 A, Q19 A, Q20 A; ER-, JU-rules)

All additions are OPTIONAL keys of the version-1 execution record (`schema_version` stays 1, ADR-0035: an optional addition keeps
the version), except two permitted widenings of existing definitions that keep every existing record valid: the enumeration in
ER1, and `result_files[].content_hash` becoming nullable (ER7, Q18 A). New optional keys: those listed in ER2–ER7, plus
`output.stored_path` (ER8), `result_files[].stored_omitted` (ER10), and `result_files[].stored_omitted_reason` (ER9, ER10; Q20 A). `output.head` and `output.tail` keep their existing schema
(`recordTextSchema`, at most 65536 UTF-16 code units, well-formed) unchanged (Q17 B). Outside the execution record, the run
record's `runner_identity` gets a permitted pattern widening stated in I23 (run record `schema_version` stays 1).

- ER1 `ADMISSIBILITY_VALUES` becomes `['evidence', 'signal', 'claim']`. A stored run directory holding a `claim` record fails
  verification; no decision rule reads `claim` records; container runs started by the steward are `evidence`; unsandboxed runs are
  `claim`; `signal` stays reserved for M08 ingestion.
- ER2 `kind`: `command` or `dependency-step`; `runner`: `container` or `unsandboxed`; `working_directory`; `expected`: `exit-zero`,
  `exit-nonzero`, or `any`.
- ER3 `environment` additions: `runtime {name: docker or podman or host, client_version, server_version, os, arch}`, `image
  {source: registry or dockerfile, reference, digest or null, id or null, runner_tree_id or null, cached}` (null for unsandboxed),
  `platform`, `network: none or egress`. `image_digest` keeps the digest (or the local id for a built image);
  `tool_versions` lists the runtime client and server.
- ER4 `limits` applied: `execution_seconds`, `output_head_bytes`, `output_tail_bytes`, `output_stream_bytes`, `cpus`, `memory_mb`,
  `pids`, `scratch_mb` (the last four null for unsandboxed).
- ER5 `timing {started_at, finished_at, duration_ms}`; `exit` gains `oom_killed`, `output_limited`.
- ER6 `checkout {commit, tree, archive_sha256 or null, files, bytes, overlays [{path, blob or null}], skipped_submodules [paths]}`.
- ER7 `result_files[]` gains `format`, `status` (`parsed`, `missing`, `not-regular`, `too-large`, `malformed`), `error_code` or
  null, `stored_path` or null (Q9 A; rules in ER9 and ER10), `stored_omitted` (ER10), `stored_omitted_reason` (ER9, ER10; Q20 A),
  `junit` or null: `{tests, passed, failed,
  errored, skipped, duration_ms, cases [{identity, status, duration_ms, identity_truncated}], cases_truncated}`;
  `identity_truncated` is a boolean, `true` exactly when the JU3 identity was longer than K55 (4096 UTF-16 code units) and was cut
  to at most 4096 code units on a code point boundary (never splitting a surrogate pair); otherwise `false`.
  `content_hash` and `bytes` (Q18 A; existing keys):
  - `content_hash` becomes nullable (`recordContentHashSchema.nullable()`). When `status` is present, the schema (superRefine)
    enforces `content_hash: null` exactly when `status` is `missing`, `not-regular`, or `too-large`, and non-null (the content hash
    of the raw copied bytes, before any decoding or redaction) exactly when `status` is `parsed` or `malformed`. When `status` is
    absent (a record written before this key existed), `content_hash` must be non-null, as before.
  - `bytes` = the number of copied bytes for `parsed` and `malformed`; the tar header's declared size for `too-large` (reading
    stopped at `result_file_bytes`, so no hash exists); `0` for `missing` and `not-regular`.
  - Unit tests: each status with the wrong `content_hash` nullness fails the schema; a legacy entry (no `status`) with `content_hash:
    null` fails; a legacy entry with a hash validates.
- ER8 Output storage (Q17 B). The execution record keeps a bounded excerpt; the full bounded capture goes to a separate redacted
  file. Steps, in order (`H` = `output_head_bytes`, `T` = `output_tail_bytes`, `CAP` = `REDACTION_INPUT_MAX_BYTES` = 8388608;
  all byte counts are UTF-8 bytes; every cut is on a code point boundary, never splitting a surrogate pair):
  1. Parts. From HP5: when nothing was omitted (`total_bytes <= H + T`), ONE part = the whole capture; otherwise TWO parts, head
     part = the HP5 head buffer and tail part = the HP5 tail buffer, and `n = total_bytes - head buffer bytes - tail buffer bytes`
     (raw stream bytes omitted). Each part is decoded per HP5 (UTF-8, U+FFFD replacement). Invalid UTF-8 can make a decoded part
     up to three times its raw size (each invalid byte becomes U+FFFD, 3 bytes), so a decoded part can exceed `CAP` although raw
     `H + T <= output_bytes <= 8388608`.
  2. Pre-redaction bound (applied ONLY when a decoded part exceeds `CAP`): a single part above `CAP` becomes two parts, head part =
     its leading 4194304 bytes and tail part = its trailing 4194304 bytes; a head part above `CAP` keeps its leading `CAP` bytes; a
     tail part above `CAP` keeps its trailing `CAP` bytes. Removed bytes are added to `m` (decoded bytes trimmed; starts at 0).
  3. Redaction: each part is ONE separate redaction input (built-in detectors, policy patterns, exact values of every resolved
     credential), so every input is at most `CAP` and `redaction.input-too-large` cannot occur for output. The only cuts made
     before redaction are the HP5 capture cut and the step-2 cut; steps 4 and 6 cut redacted text only.
  4. Post-redaction bound (redaction markers can grow text): a single part longer than `H + T` becomes two parts, head part = its
     leading `H` bytes and tail part = its trailing `T` bytes; otherwise a head part keeps its leading `H` bytes and a tail part its
     trailing `T` bytes. Removed bytes are added to `m`.
  5. File text. One part: the part itself (no marker). Two parts: `<head part>` + `\n` + marker lines joined by `\n` + `\n` +
     `<tail part>`, where the marker lines are, in this order and each only when its count is above 0, `[... <n> bytes omitted
     ...]` (the HP5 marker, raw stream bytes) and `[... <m> decoded bytes trimmed ...]` (`<n>`, `<m>` in decimal). Bound: the file
     is at most `H + T + 128` bytes (markers take at most 99 bytes) and at most 8388736 bytes absolute.
  6. Record excerpt, cut from the REDACTED parts of step 4 (never from unredacted text): with one part `P`, let `k` = the largest
     code point boundary at or below 65536 UTF-16 code units; if `P` has at most `k + 65536` code units, `output.head` = `P[0, k)`
     and `output.tail` = the rest; otherwise `output.head` = `P[0, k)` and `output.tail` = the trailing at most 65536 code units of
     `P`. With two parts, `output.head` = the leading at most 65536 code units of the head part and `output.tail` = the trailing at
     most 65536 code units of the tail part. `output.truncated` = `true` exactly when `n > 0`, `m > 0`, or the excerpt leaves out
     text of the file; `output.total_bytes` = HP5 bytes read (unchanged). The persisted record then passes the normal record
     redaction at persistence (ADR-0065) like every record string.
  7. File: `executions/execution-NNNN/output.txt`, where `NNNN` is the record's own sequence (`executions/execution-NNNN.json`);
     written for EVERY stored execution record (0 bytes when there was no output); UTF-8 text as produced by step 5; listed in the
     manifest with `bytes` and `sha256`, `record_type: null`, `content_hash: null`; NOT a log file (`EVIDENCE_LOG_FILE_MAX_BYTES`
     and `EVIDENCE_LOG_FILES_MAX` do not apply); NEVER dropped over `limits.evidence.run_bytes` (ER10).
  8. Record key `output.stored_path` (optional, string or null): the step-7 path when the file is stored; `null` in preflight
     (nothing is stored, PF7) and in the `execution-results` transport before `publish` writes the files (EP4).
  9. Verification (`verifyRunDirectory`, hence `steward report`): for every execution record whose `output.stored_path` is a
     string: it equals `executions/execution-NNNN/output.txt` for the record's own `NNNN`; the file is listed in the manifest
     (existing `bytes` and `sha256` checks apply); it decodes as UTF-8 with `fatal: true`; its size is at most the record's
     `limits.output_head_bytes + limits.output_tail_bytes + 128`. Every manifest entry matching the output-file pattern is
     referenced by exactly the record with that `NNNN`. In a stored run directory an execution record with `output.stored_path:
     null` fails verification; a record without the key (written before it existed) is accepted. Verification does NOT require the
     excerpt to be a byte-exact prefix or suffix of the file (the record redaction pass may match differently at an excerpt edge);
     tests assert prefix and suffix equality for the fixture corpus instead.
  10. Preflight: applies steps 1–4 and 6 to print its bounded, redacted text (PF5) and writes no file.
- ER9 Stored result file content (Q9 A). A result file with status `parsed` or `malformed` is stored as
  `executions/execution-NNNN/result-<k>.xml`, `NNNN` = the record's own sequence, `<k>` = the entry's 1-based position in that
  record's `result_files` (decimal, no padding, 1–20; never renumbered after drops). Stored bytes = the raw copied bytes decoded as
  UTF-8 with U+FFFD replacement (one leading BOM removed), redacted as ONE redaction input, encoded as UTF-8. The manifest lists it
  with `record_type: null`, `content_hash: null`; `sha256` covers the stored (redacted) bytes; the record's `content_hash` (ER7)
  covers the raw copied bytes. Redaction-input omission (Q20 A):
  1. Test: `D` = the UTF-8 byte length of the decoded text (after U+FFFD replacement and BOM removal). When `D` exceeds
     `REDACTION_INPUT_MAX_BYTES` (8388608; reachable with `parsed` files when a policy sets `result_file_bytes` above 8388608, bound
     33554432, or with invalid UTF-8 expanding under U+FFFD up to three times the raw size, e.g. more than 2796202 raw bytes of
     `0xFF` at the template `result_file_bytes` 5242880), the file is NOT stored and the run is kept (its evidence is stored as
     usual; no failure cause is added for this).
  2. The entry keeps `status`, `content_hash` (raw copied bytes), `bytes`, `error_code`, and any `junit` summary unchanged, and
     gets `stored_path: null`, `stored_omitted: true`, and `stored_omitted_reason: 'redaction-input'`. `schema_version` stays 1.
  3. The text is never passed to the redaction module, so `redaction.input-too-large` cannot occur for result files. Never chunk,
     trim, or partially redact a result file; never store it unredacted.
  4. The test is made in `execute` when building the `execution-results` transport (EP4), and is re-checked in `publish` from
     the transport's `decoded_bytes`; an omitted file is not an ER10 candidate and adds no run file, so its `<k>` has no file (the
     other entries keep their `<k>`, never renumbered).
  5. Unit tests: a `parsed` file with `D` = 8388608 is stored; `D` = 8388609 is omitted with the reason; an all-`0xFF` file of
     2796203 raw bytes (`malformed`, `D` = 8388609) is omitted; no redaction input above 8388608 bytes is ever built.
- ER10 Evidence budget and file count (Q19 A), applied in `publish` before the manifest is final:
  1. Fixed files: every record file, the report files, every ER8 output file, the logs (steward log at its existing cap,
     `logs/image-build.txt`), metrics, and the manifest, computed as today's `publish.ts` arithmetic. Candidates: the stored result
     files (ER9); a file omitted by ER9 (`stored_omitted_reason: 'redaction-input'`) is never a candidate.
  2. While the total exceeds `limits.evidence.run_bytes` and a candidate remains, drop ONE candidate: the one in the execution
     latest in plan order (highest `NNNN`), and within it the highest `<k>`. The dropped entry keeps `status`, `content_hash`,
     `bytes`, `error_code`, and its parsed `junit` summary, and gets `stored_path: null`, `stored_omitted: true`, and
     `stored_omitted_reason: 'evidence-budget'` (Q20 A); the record is re-serialized and the total recomputed after each drop.
  3. When no candidate remains and the total still exceeds the limit, today's rules apply unchanged: the steward log shrinks to the
     remaining budget, then `evidence.too-large` (`budget-exhausted`). Output files and records are never dropped.
  4. `stored_omitted` (optional boolean, present on every result-file entry the steward writes): `true` exactly when ER9 omitted
     the file or step 2 dropped it; else `false`. `stored_omitted_reason` (optional, enum `evidence-budget` | `redaction-input`;
     Q20 A): `redaction-input` for an ER9 omission, `evidence-budget` for a step-2 drop. `stored_path` is non-null exactly when
     `status` is `parsed` or `malformed` and `stored_omitted` is `false`. The schema enforces (superRefine): the `stored_path`
     rule; `stored_omitted: true` only with status `parsed` or `malformed`; when `stored_omitted` is present (entries written by
     this version), `stored_omitted_reason` is present exactly when `stored_omitted` is `true`; when `stored_omitted` is absent
     (entries written before it existed), `stored_omitted_reason` is absent. Unit tests: `stored_omitted: true` without a reason
     fails; `stored_omitted: false` with a reason fails; a reason without `stored_omitted` fails; an unknown reason value fails;
     each valid combination validates.
  5. File count: before building the manifest, `publish` counts the run files; when the count plus one exceeds
     `EVIDENCE_RUN_FILES_MAX` (4096) it returns the existing `evidence.too-many-files` (`budget-exhausted`), never reaching the
     manifest schema's `steward-defect` path. Result files are NOT dropped to meet the file count (Q19 A covers bytes only).
     Reachable only by plans near `executions_per_run` 200 with up to 20 result files each.
  6. Verification: a string `stored_path` equals `executions/execution-NNNN/result-<k>.xml` for the record's own `NNNN` and the
     entry's own `<k>` and is listed in the manifest; every manifest entry matching the result-file pattern is referenced by
     exactly one entry. An entry with `stored_omitted: true` (either reason) has no file and is accepted; the record schema
     (step 4) already rejects inconsistent `stored_omitted` and `stored_omitted_reason` pairs.
  7. Layout: `recordTypeForPath` returns `null` for `^executions\/execution-[0-9]{4}\/output\.txt$` and
     `^executions\/execution-[0-9]{4}\/result-(?:[1-9]|1[0-9]|20)\.xml$`; every other path under `executions/` keeps returning
     `undefined` except `executions/execution-NNNN.json` (`execution-record`).
- JU1 A declared result file path is relative to the repository root (I6), copied out as a tar stream that must hold exactly one
  regular file of at most `result_file_bytes`; a symlink, directory, or other type is `not-regular` (never followed); absence is
  `missing`; overflow is `too-large` (reading stops at the bound).
- JU2 Parser: UTF-8 (one BOM stripped; other encodings `malformed`); XML 1.0 subset; XML declaration, comments, CDATA, and
  processing instructions allowed and skipped; ANY `<!DOCTYPE` or `<!ENTITY` is `malformed` (`junit.doctype-forbidden`); only the
  five predefined entities and valid numeric character references are decoded; any other `&name;` is `malformed`; never resolves
  anything; K52–K55 bounds.
- JU3 Model: root `testsuites` or `testsuite`, nested `testsuite` allowed; each `testcase` status from its children: `error` >
  `failure` > `skipped` > none (`pass`); `time` decimal seconds to integer milliseconds, invalid or negative to null; identity
  `<classname>::<name>` (classname empty gives `::<name>`), document order, duplicates kept; counts computed from cases, suite
  attributes never trusted.
- JU4 No classification: M07 records statuses and counts only (D3).

Consequences of Q17 B (the owner's choice over the recommended A, which would have widened `output.head` and `output.tail` to hold
the whole bounded capture inside the record), stated for the owner, each with its mitigation:

- CB1 Two stored forms of one output: the record excerpt (at most 2 x 65536 UTF-16 code units) and the file (at most `H + T + 128`
  bytes). A consumer that reads only records (report rendering, transport and handoff readers, later stages that load records)
  sees the excerpt; the complete bounded capture exists only in the file. Mitigation: `output.stored_path`, `output.truncated`,
  `output.total_bytes`, and ER4 `limits` make the relation explicit; ADR-0087 and architecture §9 and §11 state that the file is
  the complete bounded capture and the excerpt is derived from it; stages that need full output (later milestones) read the file.
- CB2 One more run file per execution (up to 200 more toward `EVIDENCE_RUN_FILES_MAX` 4096). Mitigation: ER10 step 5 fails closed
  with `evidence.too-many-files` before the manifest is built; M07 plans (EP2) are the dependency step plus mandatory commands.
- CB3 Verification grows: path, reference in both directions, UTF-8 validity, and size bound per output file. Mitigation: ER8 step
  9 rules, with phase 1 tests on tampered synthetic run directories (missing, unreferenced, renumbered, oversize, non-UTF-8 file).
- CB4 Output files are never dropped over `limits.evidence.run_bytes` (only raw result files are, ER10), so a run whose fixed
  evidence exceeds the limit still ends `evidence.too-large` after every result file is dropped, exactly as under option A where
  the output lived in the record. Mitigation: documentation states the sizing arithmetic (per execution: record, at most
  `H + T + 128` bytes of output file); template values (`output_bytes` 1048576, `run_bytes` 10485760) hold about seven executions
  with full output plus the fixed run files; M07 plans are small. Benefit over A: the file stores text without JSON escaping, so
  control characters do not expand the stored size up to sixfold as `\u00XX` escapes would inside a record.
- CB5 The excerpt and the file are redacted separately (the file in ER8 step 3, the record again at persistence), so verification
  cannot require the excerpt to be an exact prefix or suffix of the file. Mitigation: the excerpt is cut from the already redacted
  parts (ER8 step 6), so no secret straddles an excerpt edge unredacted; fixture tests assert prefix and suffix equality.
- CB6 The ER8 step-2 cut happens before redaction, so a credential straddling that cut keeps an unredacted fragment, the same
  class of exposure as the HP5 capture cut. Mitigation: step 2 applies only when invalid UTF-8 makes a decoded part exceed 8388608
  bytes; for split captures it lies next to the HP5 gap; detectors and exact values still run on both parts.

### Gate G7 — execution planner, transport, local screen integration (APPROVED, Q7 A; EP-, SI-rules)

- EP1 Plan entry: `{id, kind, command_id or null, run argv, working_directory, commit role (head or base), commit, overlay (none
  or test-paths), expected, network, result_files}`; ids `<role>-<command id>` and `<role>-dependency-step`.
- EP2 Screen plan (PR, contract not an early exit): for the snapshot head commit, the dependency step if declared, then each
  command whose id appears in any `execution.platforms[]` with `source: container` and whose `mandatory` is true, deduplicated, in
  `execution.commands` order, expected `exit-zero`. Issues: empty plan. Non-mandatory commands, `ci-signal` platforms, reproduction,
  base, and merge entries are later milestones.
- EP3 A plan larger than `executions_per_run` executes nothing and adds cause `budget-exhausted` (never truncate mandatory
  commands); exhausting `run_execution_seconds` mid-plan stops the rest with the same cause.
- EP4 Transport: two new transport records, validated at each boundary and bound to run id and attempt, snapshot hash, and policy
  revision (like handoffs): `execution-plan` (version 1, from `intake` to `execute`) and `execution-results` (version 1, from
  `execute` to `publish`: the execution records plus environment-failure causes; per record also its ER8 step-2 parts as decoded,
  unredacted text, each at most 8388608 UTF-8 bytes, with `n` and `m`, and per `parsed` or `malformed` result file (ER9)
  `decoded_bytes` (integer, the ER9 `D`) and `text` (the decoded text, or `null`); the transport schema enforces `text: null`
  exactly when `decoded_bytes` exceeds 8388608 (ER9 omission, Q20 A) and, for a string, UTF-8 length equal to `decoded_bytes`.
  Unredacted text travels because `publish` redacts and writes the files; records in transport carry `output.stored_path: null`,
  and `publish`
  replaces `output.head` and `output.tail` with the ER8 step-6 excerpt before persistence). The handoff record and `HANDOFF_VERSION` are
  UNCHANGED (ADR-0070); `execute` debits `budget_remaining.executions` and `execution_seconds` and appends causes as today.
- EP5 Environment failure (RT, IM, MT, HP7 start, cleanup, dependency step non-zero or timeout) adds cause
  `environment-unavailable` with a typed code (`runner.*`, `materialize.*`) and escaped subject; no command result is ever
  produced from it; the result type distinguishes `completed` from `environment-failure` so no consumer can read an environment
  failure as a negative result (E4).
- EP6 Outcome rules unchanged: contract failure stays `needs-changes` before any execution; otherwise the run ends `inconclusive`
  (`stage-incomplete`, plus `environment-unavailable` or `budget-exhausted` when they occur). A command's non-zero exit is
  recorded, never a finding in M07 (I3).
- EP7 invariant-4 injections: runtime unavailable, not linux, limits unenforceable, pull fail, digest mismatch, image too large,
  build fail, build context invalid, create fail, copy-in fail, start fail, attach broken, inspect malformed, kill fail, cleanup
  fail, fetch fail, commit mismatch, checkout too large, overlay rejected, dependency step fail, result copy-out fail, plan
  over budget, transport invalid or unbound, phase throws: none yields `pass`.
- SI1 Syntax: `steward screen (--issue <number> | --pr <number>) [--repo owner/name] [--policy-file <path>] [--evidence-dir
  <dir>] [--container-runtime auto|docker|podman] [--json]`; default `auto`; invalid value is a usage error (exit 2).
- SI2 Evidence: `executions/execution-NNNN.json` per execution record in plan order; per record its redacted output file
  `executions/execution-NNNN/output.txt` (ER8, Q17 B; never dropped); with Q9 A each parsed or malformed result file stored
  redacted as `executions/execution-NNNN/result-<k>.xml` (ER9; not stored when its decoded text exceeds 8388608 bytes, Q20 A;
  dropped over `limits.evidence.run_bytes` by ER10, Q19 A); every
  such file listed in the manifest and verified by `steward report` (ER8 step 9, ER10 step 6); a
  Dockerfile build log as `logs/image-build.txt` (within K-log bounds); run record `runner_identity` (I23), budget `executions` and
  `container_seconds`; cost metrics event `container_seconds`.
- SI3 Report: executed-commands items from a core-owned template, derived values as escaped code spans, for example `` `test` at
  `<sha12>`: exit `1`; `12.4` s; JUnit `40`/`42` passed ``; the runner provenance line `- Runner: <runtime> <server version>,
  image <reference> (<digest first 12 hex>)` replaces "no execution in this run" when executions ran; new golden reports.
- SI4 ADR-0067's consequence line ("runs no model and no execution") is superseded (G10).

### Gate G8 — unsandboxed runner and `steward preflight --run` (APPROVED, Q10 A to Q13 A; UR-, PF-rules)

- UR1 Own checkout: the run directory's realpath equals the realpath of `git rev-parse --show-toplevel` run from the process
  working directory, or equals a preview worktree this invocation created under the OS temp dir whose `git rev-parse
  --git-common-dir` realpath equals the checkout's. Anything else is refused (`runner.not-own-checkout`).
- UR2 Refused also: a bare repository, a working directory outside any work tree, and (Q13 A) `GITHUB_ACTIONS=true`.
- UR3 Each command's working directory is the checkout root joined with the policy `working_directory`; its realpath must stay
  inside the checkout root, else that command is refused.
- UR4 Environment: the process environment minus `GH_TOKEN`, `GITHUB_TOKEN`, `STEWARD_LLM_API_KEY`, and any variable whose value
  equals a credential the process resolved (I27). No shell (argv), with one exception (Q11 A): on Windows a command whose resolved executable is a
  `.cmd` or `.bat` shim (for example `pnpm.cmd`, `npm.cmd`) runs as `cmd.exe /d /s /c <escaped command line>` with strict
  metacharacter escaping of every argument, and the output (text and JSON) states that the command ran through `cmd.exe`. Same capture and limits as HP5
  and HP6 (`execution_seconds`, output keys, `executions_per_run`, `run_execution_seconds`); resource keys do not apply.
- UR5 Constructible only from the CLI preflight module: the invariant-3 import scan fails if any other module imports it.
- PF1 Syntax: `steward preflight (--issue defect|proposal | --pr) --draft <file.md> [--repo owner/name] [--base <ref>] [--run]
  [--json]`. Without `--run` nothing changes: no repository or policy command runs (only read-only `git` and `gh auth token`
  are spawned, as before).
- PF2 With `--run` and a published valid policy: every `mandatory: true` command in `execution.commands` order runs in the
  contributor's checkout (working tree as is; a dirty tree adds warning `preflight.working-tree-dirty`). Without a published policy
  (default checklist): nothing runs, warning `preflight.run-without-policy`.
- PF3 Preview (`--pr` only): when the draft's `regression-test` field is non-empty and at least one path changed between the merge
  base and `HEAD` has path class `test`: `git -c core.hooksPath=<empty temp dir> worktree add --detach <temp> <merge base>`
  outside the checkout (Q13 A: the worktree uses the contributor's own filters and line-ending settings, since Z4 trusts its owner;
  only hooks are disabled); the `HEAD` versions of the test-class paths applied (OV rules against the base tree plus host realpath
  checks; deletions applied); the declared `runner.dependency_step` run there if declared; every mandatory `kind: test` command run
  there ("before"); "after" = the PF2 results of the same commands (no second run); worktree removed with `worktree remove --force`
  and `worktree prune` in `finally`. Otherwise the preview is skipped with note code `preflight.preview-skipped` and its reason.
  Declared test scaffolding is not applied (I20). The preview never changes the exit status; its environment failures are warnings
  `preflight.preview-unavailable`.
- PF4 Before each execution, text mode prints `run <entry id>: <argv as a JSON array> in <path relative to the checkout or
  "preview">` on standard output; JSON mode (Q10 A) keeps the ADR-0066 convention (exactly one line on standard output, nothing on
  standard error) and lists every argument vector inside its one object (PF5 `run.executions[]` and `run.preview` entries carry
  `id`, `argv`, `directory`).
- PF5 Results are claims: admissibility `claim`; notice line `Commands ran on this machine without a sandbox; their results are
  claims, not evidence.`; per result `result <entry id>: exit <code>[, timed out][, output limited]; <seconds> s[; JUnit
  <passed>/<tests> passed, <failed> failed, <errored> errors, <skipped> skipped]`; for a failed command the bounded, redacted tail (ER8 step 10).
  JSON adds `run: {requested, notice, executions[], preview: {base, overlay_paths[], before[], after[]} or null}`.
- PF6 Exit (Q12 A): contract exit as today; a mandatory command with non-zero exit, `timed_out`, or `output_limited` gives 1; a
  runner refusal or environment failure (checkout guard, a command that cannot start) gives 2; precedence 2 > 3 > 1 > 0. Commands
  run whatever the contract disposition, once a published policy loaded and the guard passed.
- PF7 Nothing is written to GitHub or stored; no telemetry; output redacted (built-in detectors, policy patterns, exact values of
  the resolved GitHub token).

### Gate G9 — container tier, CI job, verification (APPROVED, Q14 A; CI-rules)

- CI1 Root script `test:container` = `vitest run --config vitest.container.config.ts`; config includes
  `packages/*/src/**/*.container.test.ts`, aliases `@patch-steward/core` to core sources, `fileParallelism: false`, test and hook
  timeouts 300000 ms. `pnpm test` is unchanged and never needs a runtime.
- CI2 Container tests read `STEWARD_CONTAINER_RUNTIME` (`docker` or `podman`; default `docker`) and FAIL (never skip) when that
  runtime is unavailable.
- CI3 Test images: public images pinned by digest (`--platform linux/amd64`), at most two repositories (a Node 24 slim image for
  the TypeScript sample; a minimal shell image for hostile probes), digests in one test constants module, pulled anonymously.
- CI4 `.github/workflows/ci.yml` job `container-tests` (name `Container tests / ${{ matrix.runtime }}`, `runs-on: ubuntu-latest`,
  matrix `runtime: [docker, podman]`, `fail-fast: false`, same triggers as `build-and-test`, `permissions: contents: read`, no
  secrets): checkout, pnpm, Node 24, `pnpm install --frozen-lockfile`, `pnpm test:container` with `STEWARD_CONTAINER_RUNTIME: ${{
  matrix.runtime }}`. If rootless Podman cannot enforce limits on the runner (RT3), the Podman leg may run rootful Podman through a
  test-only runtime-command override; product code never escalates privileges. The CI Podman leg first runs on GitHub after the
  owner pushes (D8); M07 verifies Podman locally (CI7).
- CI5 Local verification: Windows `pnpm test:container` under Docker Desktop and under Podman (CI7); Ubuntu via `act pull_request
  -W .github/workflows/ci.yml` on an LF clone with the host Docker socket for `build-and-test`, `lint-and-format`, and
  `container-tests` with `--matrix runtime:docker` (sibling containers work because nothing is bind-mounted).
- CI6 Leak checks after every container-tier run: `docker ps -a --filter label=org.patch-steward.test -q`, `docker volume ls -q
  --filter label=org.patch-steward.test`, `docker image ls -q --filter label=org.patch-steward.test` all empty (same with
  `podman`); OS temp dir prefixes `patch-steward-` unchanged.
- CI7 Podman prerequisite (Q14 A): the owner installs Podman Desktop with a Podman machine on this host before phase 3. The
  container tier then runs locally under both runtimes: `STEWARD_CONTAINER_RUNTIME=podman pnpm test:container` exits 0 and the
  `podman` leak checks (CI6) print nothing. PREREQ-PODMAN check, run by the supervisor BEFORE the first Podman-dependent step of
  any phase (phase 3 onward) and before any phase gate that runs the Podman tier: `podman version` exits 0 AND its output contains
  a `Server:` section (the Podman machine is running). If the check fails (Podman absent, machine not initialized or not
  running), the supervisor returns `RESULT: needs-human` naming the failed check; it NEVER skips, stubs, fakes, or defers Podman
  verification, never substitutes Docker results, and never starts or initializes a Podman machine itself. A Podman-machine
  configuration that fails RT3 (cgroup controllers) locally is likewise `needs-human`, never a relaxed RT3.

### Gate G10 — ADR inventory and documentation stance (APPROVED, Q15 A)

| ADR | Title | Records |
| --- | --- | --- |
| ADR-0079 | Runner image sources, digest identity, and the local build cache | D1, IM1–IM4, I9–I12 |
| ADR-0080 | Dependency step in its own container with egress | D2, I8, I16 |
| ADR-0081 | Test result evidence: exit status and JUnit XML | D3, JU1–JU4 (links ADR-0017, which stays `accepted`) |
| ADR-0082 | No services for reproductions in version 1 | D4 |
| ADR-0083 | Execution limits as policy keys with documented defaults | D5, G1, Q1–Q3, K52–K63 (links ADR-0040, ADR-0046) |
| ADR-0084 | Container runtimes, host platforms, and the container test tier | D6, RT1–RT4, G9 (links ADR-0021) |
| ADR-0085 | Container hardening profile and checkout delivery | G3, Q4, Q5, Q21 (Podman-generated `/etc/passwd`, `/etc/group`, `/run/.containerenv`, empty `/run/secrets` permitted under Podman only; capability check by the five zero masks under Podman; consequences CQ1–CQ4 stated in the Q21 row), Q22 (Podman `/work` mount without a no-copy option; an image whose `/work` is non-empty is refused under Podman, not neutralized; Docker keeps `volume-nocopy`; consequences CW1–CW4 stated in the Q22 row) |
| ADR-0086 | Inert materialization from git objects and overlay validation | G4, Q6 |
| ADR-0087 | Execution records: environment identity, result files, and claim admissibility | G6 incl. ER8–ER10, Q8, Q9, Q17 (option B; names the rejected in-record alternative), Q18, Q19, Q20 (redaction-input omission) |
| ADR-0088 | Local screening executes the plan in containers | G7, Q7; ADR-0067 becomes `superseded by ADR-0088` |
| ADR-0089 | `steward preflight --run`: the unsandboxed claim runner | D7, G8, Q10–Q13 |

Documentation stance: governing documents first (architecture, processes), then whitepaper §9–§14 (decisions paragraph
"Decisions recorded on September 28, 2026 (ADR-0079–ADR-0089 in `docs/adr`)"), README, CLAUDE.md, user manual. No persistent
document cites planning documents or their ids. Where architecture §6.5, ADR-0088, ADR-0089, or the user manual state what
`steward screen` or `steward preflight` starts on the host, they state the process set of "Conformance checks" bullet 2 (screen:
`git`, the container runtime, and `gh auth token` for credential resolution; preflight without `--run`: read-only `git` and `gh
auth token`, no repository or policy command; with `--run`: the policy's commands, through `cmd.exe` for Windows batch shims,
the preview worktree's `git worktree` commands with hooks disabled, and `taskkill.exe` on Windows to stop a timed-out process
tree), never as starting no process at all.

### I-list — interpretations (APPROVED, Q16 A)

- I1 No new runtime dependency: own tar codec, own XML parser, runtimes through their CLIs; core keeps `yaml` and `zod` only.
- I2 M07 plans only EP2 (screen) and PF2–PF3 (preflight). Reproduction, container before-and-after, merge commits, non-mandatory
  commands, and `ci-signal` platforms are M08 and M12.
- I3 A command's exit status is recorded, never classified or turned into a finding in M07.
- I4 Environment failure codes: `runner.runtime-unavailable`, `runner.runtime-not-linux`, `runner.limits-unenforceable`,
  `runner.image-pull-failed`, `runner.image-digest-mismatch`, `runner.image-too-large`, `runner.image-build-failed`,
  `runner.build-context-invalid`, `runner.image-source-unavailable`, `runner.create-failed`, `runner.copy-failed`,
  `runner.start-failed`, `runner.inspect-invalid`, `runner.cleanup-failed`, `runner.dependency-step-failed`,
  `runner.prepared-copy-too-large`, `materialize.fetch-failed`, `materialize.commit-mismatch`, `materialize.checkout-too-large`,
  `materialize.path-invalid`, `materialize.overlay-rejected`; all map to cause `environment-unavailable`.
- I5 The execute phase stays bounded by `limits.stage_seconds` (template 3600) although `run_execution_seconds` has template 7200;
  no existing template value changes; the docs state that the smaller bound applies.
- I6 `execution.commands[].result_files[].path` is relative to the repository root, not the command's working directory.
- I7 The copied checkout has no `.git`; LFS pointers stay pointers; attributes are not applied; submodules are absent (listed).
  Commands needing git metadata, LFS content, or submodules are unsupported in version 1 (documented limitation).
- I8 Dependency-step egress includes whatever the host network reaches (LAN, link-local metadata endpoints,
  `host.docker.internal` on Docker Desktop); stated as part of the D2 risk; not blocked in version 1.
- I9 Pulls use the host runtime's ambient configuration unchanged; only public images are supported; a private image that pulls
  through an ambient login is unsupported and a GitHub-hosted run would fail it.
- I10 A `dockerfile` image under `--policy-file` (revision `local:<sha256>`, no tree) ends `runner.image-source-unavailable`;
  registry images work.
- I11 Built runner images stay cached under `patch-steward-runner:<runner tree id>`; the steward never prunes; the docs show manual
  removal.
- I12 Image size is checked after pull or build; an oversize image stays in the local cache.
- I13 Git fetches do not count against `limits.github.requests_per_run` (git protocol, not REST); `materialize_seconds` bounds them.
- I14 SP20 step 1 wording becomes: the submission is read through the GitHub API and its head commit is fetched by id over HTTPS
  git.
- I15 HP5 capture details (one stream, UTF-8 with replacement, marker text) are data; control characters stay in records and are
  escaped wherever rendered.
- I16 The dependency step counts against `executions_per_run` and `run_execution_seconds`.
- I17 Auto-detection order: docker, then podman.
- I18 Container-tier tests fail rather than skip when the runtime is missing; `pnpm test` never needs one.
- I19 Everything the steward creates is labeled `org.patch-steward.managed=true`; the steward removes only its own labeled
  containers and volumes; images are kept (I11).
- I20 Preview applies test-class paths only; the declared `test-scaffolding` field is not parsed into paths in M07.
- I21 `packages/cli/src/steward-commands.live.test.ts`: screening PR 26 now fetches over HTTPS git and pulls the test-bed policy's
  public image when a runtime is available (reads only); expectations updated; no test-bed write.
- I22 Preflight's unsandboxed runs use the same output and time keys as containers; K56–K61 do not apply to them.
- I23 `runner_identity` in the run record: `<runtime> <server version> <reference>@<digest first 12 hex>` (at most 256 characters),
  null when nothing ran. Parts (none contains a space): `<runtime>` = `docker` or `podman`; `<server version>` = the RT4 server
  version, which the RT1 `version` JSON schema admits only as 1 to 64 printable ASCII characters without space (`^[\x21-\x7e]{1,64}$`;
  anything else fails RT1 validation for that runtime); `<reference>` = the policy `runner.image.reference` as written (`registry`)
  or `patch-steward-runner:<runner tree id>` (`dockerfile`); `<digest first 12 hex>` = the first 12 hex characters after `sha256:`
  of ER3 `image_digest`. Length rule: when the value would exceed 256 characters, `<reference>` is cut to its leading characters
  followed by `...` so the whole value is exactly 256 characters. Schema (permitted widening of an EXISTING run-record key, because
  the current `recordIdentifierSchema` excludes the space 0x20): `runRecordSchema.runner_identity` becomes a dedicated schema,
  still nullable: string of 1 to 256 characters matching `^[\x21-\x7e]+(?: [\x21-\x7e]+)*$` (printable ASCII, single interior
  spaces, no leading or trailing space). `recordIdentifierSchema` itself is unchanged; run record `schema_version` stays 1; every
  existing run record (all `runner_identity: null`) stays valid. A unit test proves an I23 value with two spaces validates and one
  with a leading, trailing, or double space, a control character, or 257 characters does not.
- I24 No new metrics kind: the cost event's `container_seconds` sums container execution wall clock; the run budget counts
  executions.
- I25 Scratch tmpfs pages count against `runner.resources.memory_mb` (runtime behavior); documented.
- I26 New core root exports named `parse*`, `check*`, `load*`, `validate*`, `resolve*`, `capture*` extend the invariant-5 pins.
- I27 Unsandboxed environment filtering per UR4.
- I28 Runtime-generated `/etc/hostname`, `/etc/hosts`, `/etc/resolv.conf` and the pseudo-filesystems (`/proc`, `/sys`, `/dev`,
  `/dev/shm`, `/dev/mqueue`, cgroup) are inherent to a container and do not count as host mounts for E2; no host directory or file
  with host data is mounted. Podman only (owner decision Q21 A, 2026-10-23): the Podman-generated `/etc/passwd`, `/etc/group`,
  `/run/.containerenv`, and `/run/secrets` (which must be empty) are likewise runtime-generated container files, not host mounts,
  under the exact rules of the HP8 Podman variant; the Docker allow-list stays the three `/etc` files above. Phase 5 states this in
  architecture (§12 execution bounds or §13 "Container escape on the runner"), the user manual Runner section, and ADR-0085
  (with the Q21 consequences), naming the four Podman paths and the mask-based capability check, without planning ids. The same
  three places also state the Podman-only `/work` difference (Q22 A, IM5): Podman has no no-copy volume option, so under Podman the
  runner refuses an image whose `/work` is non-empty (the run ends inconclusive) instead of neutralizing it, while Docker mounts the
  volume without copying image content; runner images meant for Podman must leave `/work` absent or empty.

### Module layout (recommended; the decomposer may refine names, not responsibilities)

- `packages/core/src/policy/`: bounds rows, schema keys with defaults, rules XR1–XR4, template, editor schema.
- `packages/core/src/execution/`: `plan.ts` (EP1–EP3, pure), `transport.ts` (EP4 records), `results.ts` (result kinds, EP5).
- `packages/core/src/junit/`: `parse.ts` (JU2–JU3, pure).
- `packages/core/src/archive/`: `tar.ts` (ustar and PAX writer, bounded single-entry reader for copied-out result files and the
  prepared copy header walk).
- `packages/core/src/materialize/`: `paths.ts` (PV, OV, pure), `fetch.ts` (MT1), `checkout.ts` (MT2–MT4).
- `packages/core/src/process/`: `stream-process.ts` (spawned child, streamed bounded head and tail, drain cap, timer, kill).
- `packages/core/src/runner/`: `runtime.ts` (RT, argv builders HP2 per runtime), `image.ts` (IM, incl. the IM5 Podman `/work`
  probe; its argv builder sits with the other builders), `container.ts` (HP1, HP5–HP7),
  `unsandboxed.ts` (UR).
- `packages/core/src/records/execution-record.ts` (ER), `vocabulary.ts` (ER1), `evidence/` (SI2 layout incl. ER10 step 7
  patterns, verify incl. ER8 step 9 and ER10 step 6, redaction, ER8 output-file builder, ER10 budget in publish),
  `report/` (SI3), `pipeline/` (intake plans, execute runs, publish stores).
- `packages/cli/src/`: `screen-args.ts` (SI1), `preflight-args.ts` (PF1), `preflight-run.ts` (PF2–PF7), outputs.

### Conformance checks

- `conformance/invariant-3.test.ts` (NEW, FIRST check) plus `invariant-3.container.test.ts`: HP2 argv exactness per runtime; HP3
  forbidden-token scan over every argv the runner builds (property-style over policy values); HP4 CLI environment allowlist; E2 and
  E3 behavioral checks (HP8; under `podman` the HP8 Podman variant: five zero capability masks, the four Podman mount points,
  empty `/run/secrets`); the HP8 `/work` copy-up proof (three runtime-registered tests: the Docker title 'image content at /work is
  not copied into the volume'; the Podman titles 'an image with content at /work is refused under podman' and 'an image with an
  empty /work yields only the checkout under podman'); the HP3 scan includes the IM5 probe vector; canary: random `PATCH_STEWARD_CANARY_<hex>` values set in the parent environment and in a host temp
  file are absent from container `env`, `/proc/*/environ`, a filesystem grep, captured output, every stored record, and the run
  directory bytes; UR5 import scan; only `process/`, `git/`, `materialize/`, and `runner/` import `node:child_process`.
- `zero-execution.fixture.test.ts`, `preflight-zero-execution.fixture.test.ts`, `steward-zero-execution.fixture.test.ts` become:
  no module outside those four spawns processes; `steward screen` spawns only `git`, the selected runtime binary, and `gh auth
  token --hostname github.com` (argv exactly `['auth', 'token', '--hostname', 'github.com']`, made only for credential resolution
  by `cli/src/github-auth.ts` `resolveGitHubAuth`, before any execution, at most once, and only when `GH_TOKEN` and `GITHUB_TOKEN`
  are unset or empty), never a repository command on the host; `steward preflight` without `--run` spawns only read-only `git` and
  that same `gh auth token` call, and runs no repository or policy command; with `--run` it additionally spawns only: (a) the
  policy's commands, directly or (Windows `.cmd`/`.bat` shims, UR4) through `cmd.exe /d /s /c`, inside the own checkout or a
  preview worktree; (b) the PF3 `git -c core.hooksPath=<empty temp dir> worktree add --detach`, `git worktree remove --force`, and
  `git worktree prune`; (c) on Windows only, `%SystemRoot%\System32\taskkill.exe /PID <pid> /T /F` to stop a timed-out or
  output-limited process tree (`core/src/process/stream-process.ts` `killChild` with `killTree: true`, set by
  `core/src/runner/unsandboxed.ts`); any other spawn fails the check; no model module is imported anywhere.
- invariant-1: container output, test names, and result files carrying injection text (shell metacharacters, Markdown, mention
  and reference text, `${{ }}`) stay data in records and reports.
- invariant-4: EP7 matrix.
- invariant-5: runtime JSON, inspect JSON, JUnit, transport records validated; pins extended (I26).
- invariant-7: 17 new keys registered; XR1–XR4; HP5 bounds; ER8 bounds (no redaction input above 8388608 bytes even for
  all-invalid UTF-8 output, output file at most `H + T + 128` bytes, excerpt at most 65536 code units per key); ER9 (no result-file
  redaction input above 8388608 bytes; an oversize decoded result file is omitted with `stored_omitted_reason: redaction-input`);
  ER10 drop order;
  redaction of execution records, output files, result files, and build logs including exact-value redaction of the resolved
  token; K52–K63 exported and asserted.

### Fixture corpus additions (root `fixtures/`, persistent: no planning ids)

- `fixtures/repositories/*.json`: target repositories as JSON manifests (entries `{path, mode, content}` with UTF-8 or base64
  content, `{path, symlink}`, `{path, gitlink}`), plus host-side hostile configuration the test installs (hooks, filter drivers,
  `core.fsmonitor`, `url.*.insteadOf`, submodule `update = !command`). NEVER store live `.gitattributes`, `.gitmodules`, or `.git*`
  files in this repository (they would govern this repository's own git behavior); JSON content is immune to `core.autocrlf`.
- `typescript-sample.json`: zero-dependency TypeScript project run by `node --test --test-reporter=junit
  --test-reporter-destination=<result path>` on Node 24 (type stripping), one passing and one failing test.
- Hostile: hooks and filters and submodules and fsmonitor (E1), escaping symlinks and traversal overlay cases (E1), canary reader
  (E3), fork bomb, memory hog, output flood, sleeper, scratch filler, network probe (E2), unreadable or symlinked result file,
  injection text in test names and output, an output flood of invalid UTF-8 bytes (ER8 step 2), a small binary declared result
  file (`malformed`, stored redacted per ER9), and a declared result file the fixture's test command generates at run time as
  2796203 bytes of `0xFF` (never committed; `malformed`, decoded text 8388609 bytes: ER9 omission, `stored_omitted_reason:
  redaction-input`, run kept).
- `fixtures/junit/`: Vitest, Jest (`jest-junit`), cargo-nextest, CTest `--output-junit`, GoogleTest, Node test-runner samples
  (hand-written in each reporter's documented shape) and hostile XML (DOCTYPE, internal and external entities, billion-laughs,
  deep nesting, attribute floods, invalid UTF-8 built in test code, unknown entity).
- `fixtures/README.md` lists every new entry.

### Owner gate decisions (APPROVED 2026-09-28; Q1–Q16, Q18, Q19, Q20 option A, the recommended option; Q17 option B, the owner's choice over the recommended A; no value changes; Q21 option A approved 2026-10-23; Q22 option A and Q23 approved 2026-10-23)

Rejected alternatives are not restated; the Q1–Q16 question text as posed is in git history (commit c4fcffe). Q17–Q19 were
posed in the planner's `needs-human` return after commit 96448d3 (not committed); Q17's rejected option A is summarized in the G6
consequences block. Q20 was posed in the planner's `needs-human` return after commit 9ee5048 (not committed); the interim rule it
replaced (the run's evidence not stored, `redaction.input-too-large`) is in git history at 9ee5048.

| Q | Topic | Decision (binding) | Applied in |
| --- | --- | --- | --- |
| Q1 | Execution-limit key set and values | A: the 17 keys, template values, hard-bound ranges, and XR1–XR4 approved as proposed | G1 |
| Q2 | Compatibility of the new keys | A: optional; defaults equal template values; policy `version: 1` kept; existing policies (fixtures, test-beds) stay valid; resolved policy records effective values; template writes every key | G1 M1, Constraints, DoD 7 |
| Q3 | Hard-only constants | A: K52–K63 stay hard-only constants | G2 |
| Q4 | Container hardening flag set | A: G3 (HP1–HP8) approved for Docker and Podman | G3 |
| Q5 | Checkout delivery and scratch | A: labeled volume at `/work` filled by `cp` of the steward-built archive; read-only root; tmpfs `/tmp` sized by `scratch_mb`; `/work` growth bounded only by time, documented as a limitation | G3 HP1, HP2, HP9 |
| Q6 | Materialization | A: depth-1 fetch into a temporary bare repository; archive built from git objects | G4 MT1–MT4 |
| Q7 | Local screen integration | A: `steward screen --pr` executes now, with `--container-runtime auto or docker or podman`; outcome rules unchanged; ADR-0067 superseded by ADR-0088 | G7 EP2, EP6, SI1–SI4; G10 |
| Q8 | Record additions and admissibility | A: ER1–ER7 approved; `claim` added to admissibility values; a stored run containing a `claim` record fails verification | G6 ER1–ER7 |
| Q9 | Result files in evidence | A: store the redacted raw result file plus the parsed summary and the first N test cases in the record | G6 ER7, G7 SI2 |
| Q10 | `--run` with `--json` | A: text mode prints `run <id>: <json argv> in <dir>` before each run; JSON mode lists the argument vectors inside its one object | G8 PF4, PF5 |
| Q11 | Windows batch shims | A: `.cmd` and `.bat` shims run through `cmd.exe /d /s /c` with strict escaping, stated in the output | G8 UR4 |
| Q12 | Preflight run timing and exit | A: `--run` commands run whatever the contract result once a published policy loaded; failing mandatory command exit 1; refusal or environment failure 2; preview never changes the exit code; precedence 2 > 3 > 1 > 0 | G8 PF3, PF6 |
| Q13 | Own-checkout rules | A: UR1–UR5 and PF3 as proposed, including refusal under `GITHUB_ACTIONS=true` and a preview worktree using the contributor's filters and line-ending settings with hooks disabled | G8 UR1–UR5, PF3 |
| Q14 | Podman verification | A: the owner installs Podman Desktop with a Podman machine on this host before phase 3; the container tier runs locally under Docker and Podman; PREREQ-PODMAN gates every Podman-dependent step and gate (`needs-human` if absent, never skipped or faked) | G9 CI4, CI5, CI7; DoD 4; roadmap phases 3, 4, and 5 |
| Q15 | ADR inventory | A: ADR-0079 to ADR-0089 as listed | G10 |
| Q16 | Interpretations | A: I1–I28 accepted | I-list |
| Q17 | Full bounded output storage | B: `output.head` and `output.tail` stay within 65536 characters (schema unchanged); the full bounded head and tail go to a separate redacted file `executions/execution-NNNN/output.txt`, listed in the manifest with bytes and sha256, verified by `steward report`, referenced by the optional record key `output.stored_path`; never dropped over budget; consequences CB1–CB6 | G6 ER8, CB1–CB6; G7 EP4, SI2; ER10 |
| Q18 | Hash of unread result files | A: `result_files[].content_hash` nullable; null exactly for `missing`, `not-regular`, `too-large` (schema-enforced); `bytes` = copied bytes for `parsed` and `malformed`, tar-declared size for `too-large`, else 0; `schema_version` stays 1 | G6 ER7 |
| Q19 | Run evidence budget with stored result files | A: over `limits.evidence.run_bytes`, stored raw result files are dropped first, last execution in plan order first; a dropped file keeps its parsed `junit` summary and gets `stored_path: null`, `stored_omitted: true`; still over budget gives the existing `evidence.too-large` | G6 ER10; G7 SI2 |
| Q20 | Result file the redactor cannot take whole | A: a result file whose decoded text exceeds `REDACTION_INPUT_MAX_BYTES` (8388608) is not stored; the run is kept; the entry gets `stored_path: null`, `stored_omitted: true`, and the new optional key `stored_omitted_reason` (`evidence-budget` or `redaction-input`); raw `content_hash`, `bytes`, `status`, and any `junit` summary kept; `schema_version` stays 1; ER10 drops set `stored_omitted_reason: evidence-budget`; the schema ties `stored_omitted_reason` to `stored_omitted` (present exactly when it is true, for entries written by this version) | G6 ER7, ER9, ER10; G7 EP4, SI2 |
| Q21 | Podman-generated mounts and capability check (raised by the phase 3 Podman tier: Podman 6.1.3 client 6.1.2, rootful machine `podman-machine-default`, shows `/etc/passwd`, `/etc/group`, `/run/.containerenv`, `/run/secrets` in mountinfo while `podman inspect` lists only `/work`; `podman create --passwd=false` is an unknown flag; inspected `HostConfig.CapDrop` is the 11-capability default list while all five capability masks are zero) | A ("Podman-only mount exception", 2026-10-23; chosen over searching for a Podman-side configuration and over leaving Podman unmet): under Podman only, those four mount points are permitted (exact match, nothing below them; `/run/secrets` must be empty), and the capability check is the five zero masks `CapInh`, `CapPrm`, `CapEff`, `CapBnd`, `CapAmb`, accepting any inspected `CapDrop` shape; Docker's allow-list and checks unchanged; no other relaxation. Consequences: CQ1 the E2 mount check differs per runtime, so Podman evidence is checked against a wider allow-list than Docker's; CQ2 the Podman `/etc/passwd` and `/etc/group` are generated by the runtime (an entry for 65532 may be added) and `/run/.containerenv` exposes container metadata (engine, name, id, image) to submitted code, none of it host secrets; CQ3 a Podman `mounts.conf` default mount would land under `/run/secrets` with host data, which the emptiness check turns into an E2 failure rather than a permitted mount; CQ4 under Podman the inspected `CapDrop` is no longer evidence of dropped capabilities, so the masks read inside the container are the only capability proof | G3 HP8 (Podman variant); I28; G10 ADR-0085; roadmap phase 3 risks and phase 5 DoD |
| Q22 | Podman `/work` copy-up (raised by the second phase 3 Podman attempt: Podman 6.1.3 rejects `volume-nocopy`, `volume-nocopy=true`, `nocopy`, `nocopy=true`, `copy=false`, `no-copy` as "invalid mount option"; `volume-opt=nocopy` and `volume-opt=copy=false` are accepted but are volume-driver options; a test image with content at `/work` gave `['checkout', 'image-copied']` in the volume under Podman, `['checkout']` under Docker) | A ("Require empty /work in images", 2026-10-23): under Podman only, the `/work` mount is `--mount type=volume,src=<volume>,dst=/work` with no no-copy option, and the safety against copy-up becomes a precondition: every image the runner uses under Podman must have `/work` absent or empty, verified before use by the IM5 never-started probe container and `cp` of `/work` (fail closed: `runner.create-failed`, message `image-work-not-empty`); Docker keeps `volume-nocopy` and runs no probe; no other relaxation. Consequences: CW1 under Podman an image with non-empty `/work` is refused (run `inconclusive`) rather than neutralized, while the same image runs under Docker, so runtime choice can change whether a policy's runner image is usable; CW2 runner images for Podman must not create or populate `/work` (for example a Dockerfile `WORKDIR /work/...` or `COPY` into `/work`), which the docs state; CW3 the probe adds one never-started `create`, one `cp`, and one `rm -f` per image per run under Podman, counted in no execution budget; CW4 the copy-up guarantee under Podman rests on the image being immutable between probe and execution (the same digest or id reference), not on a mount option | G3 HP1, HP2 (Podman), HP8 `/work` copy-up proof; G5 IM5; Conformance checks; Assumptions; G10 ADR-0085; roadmap phase 3 DoD and risks, phase 5 DoD |
| Q23 | `/run/secrets` under Podman (raised by the second phase 3 Podman attempt: `/run/secrets` lists `rhsm` from the Podman machine VM's default mounts) | Approved 2026-10-23: `/run/secrets` must stay empty (HP8 Podman variant unchanged); the owner empties the Podman machine VM's default mounts (`mounts.conf`) outside the repository. No rule, test, or code change: a non-empty `/run/secrets` is a host environment condition the owner fixes | G3 HP8 (Podman variant, host condition note); roadmap phase 3 risks |

## Constraints

- Toolchain per CLAUDE.md: ESM, `module: nodenext`, `verbatimModuleSyntax`, `.js` import extensions; strict TypeScript with
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`; Prettier single quotes,
  semicolons, trailing commas, printWidth 132; Node 24 only; pnpm only; tests type-checked by `pnpm typecheck`.
- No new runtime dependency in any package (I1). No Docker or Podman SDK or socket API; runtimes only through their CLI binaries
  with `shell: false`.
- Every spawned process: argument vector, `shell: false`, explicit minimal environment, timeout, bounded capture.
- Never bind-mount a host path; never pass the host environment into a container; never mount a runtime socket.
- Every stored string redacted before persistence (ADR-0065); every stored output file and result file redacted before it is
  written (ER8, ER9); every new record key optional; the only widenings of existing definitions are ER1, ER7 `content_hash`
  (Q18 A), and I23; `schema_version` and `HANDOFF_VERSION` stay 1; policy `version` stays 1 (Q2 A).
- Persistent files (`docs/` except the two plan documents, README.md, CLAUDE.md, `fixtures/`, `templates/`, `scenarios/`) never
  cite planning documents or their ids (no Mxx, PDxx, owner-decision, gate, question, step, or phase ids).
- `docs/deferred.md` untouched; no deferred feature mentioned.
- No push, no test-bed write, no GitHub write of any kind, no App or secret change (D8). Allowed reads: public image pulls,
  read-only GitHub reads and HTTPS git fetches of the public test-bed only inside `*.live.test.ts` under `pnpm test:live`.
- Unit and fixture tiers never need a container runtime or network; container-tier tests clean up (CI6).
- Test code builds control, bidi, and zero-width characters with `String.fromCharCode`; credential-shaped samples by string
  concatenation; never commit a real token.
- `scenarios/` and `probes/` untouched except where a doc sentence must change (none expected).

## Assumptions

- GitHub `ubuntu-latest` runners provide Docker and Podman; rootless Podman limit enforcement there is unverified until the first
  CI run after the owner pushes (RT3; CI4 rootful fallback).
- Docker Desktop on Windows behaves as measured (see "Planner measurements"); Podman's `cp -` from standard input, `--read-only-tmpfs`,
  and `--log-driver none` with attach behave like Docker's; verified locally under the owner-installed Podman machine in phase 3
  (CI7). Measured NOT to hold (phase 3): Podman has no no-copy volume mount option and copies image `/work` content into the volume;
  handled by HP2 (Podman) and IM5 (Q22 A). Any Podman behavior that differs is handled in the Podman argument builder (HP2 Podman
  variant), never by weakening an HP rule; a difference that cannot meet an HP rule is `needs-human`. The owner-approved exceptions
  are exactly two: the HP8 Podman variant (Q21 A: Podman-generated mounts and mask-based capability check) and the Podman `/work`
  mount without a no-copy option guarded by the IM5 precondition (Q22 A); they cover nothing else.
- GitHub serves any reachable commit (including pull request heads) to a depth-1 fetch by id over HTTPS.
- Node 24's built-in test runner emits JUnit XML (`--test-reporter=junit`) and runs `.ts` files by type stripping.
- The public registry images chosen for tests stay pullable anonymously within Docker Hub's rate limits in CI.

## Out of scope

- The Actions container runner and the T1 `execute` job; T1 image caching (M13).
- Reproduction, fix-verification, and regression stages and their classification; container before-and-after executions; merge
  commits; baselines; CI signal ingestion (`signal` records) (M08).
- The compiled-ecosystem choice (PD04, M08); M07 fixtures are TypeScript plus hand-written JUnit samples.
- Any model call (M09+); preflight self-review (M09).
- Publication of local results (M14); `steward init`, `steward replay`.
- Services for reproductions (D4: none in version 1).

## Definition of Done (project)

Run from the repository root in the MAIN tree on Windows (Git Bash):
`bash $HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh --file development-artifacts/patch-steward-m7-brief.md --heading "Definition of Done (project)" --cwd <repo root>`.
Record names carry the original item number (items 1-15). Item 3 runs `act` on an LF clone (CI5; the coverage job is never run).
Item 4 (Q14 A): the PREREQ-PODMAN record (G9 CI7) runs before the Podman tier; a failing PREREQ-PODMAN is `RESULT: needs-human`,
never a skipped item. A `manual:` record quotes the original item text that no runnable check can test.

```dod
# item 1: host is Windows
cmd: node -p process.platform
expect: win32
# item 1: main-tree toolchain gate exits 0 and test file and test counts exceed 189 and 3474
cmd: { pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check; } > /tmp/m7-dod-base.log 2>&1; e=$?; node -e "const t=require('fs').readFileSync(process.argv[1],'utf8').replace(/\x1b\[[0-9;]*m/g,'');const last=(re)=>{let v=-1;for(const m of t.matchAll(re))v=Number(m[1]);return v};const f=last(/Test Files .*\((\d+)\)/g),n=last(/^\s*Tests .*\((\d+)\)/gm);console.log('base gate exit '+process.argv[2]+'; '+(f>189&&n>3474?'counts exceed 189 files and 3474 tests':'files '+f+' tests '+n))" /tmp/m7-dod-base.log "$e"
expect: base gate exit 0; counts exceed 189 files and 3474 tests
# item 2: Docker Desktop server is running (prerequisite of items 2, 3, 5, 6)
cmd: v=$(docker version --format '{{.Server.Version}}' 2>/dev/null) && echo "$v" | grep -qE '^[0-9]+[.][0-9]+' && echo "docker server running" || echo "docker server not running"
expect: docker server running
# item 2: docker container tier exits 0 with OS temp patch-steward- entries unchanged
cmd: t(){ node -e "const fs=require('fs'),os=require('os');console.log(fs.readdirSync(os.tmpdir()).filter(n=>n.startsWith('patch-steward-')).length)"; }; b=$(t); STEWARD_CONTAINER_RUNTIME=docker pnpm test:container > /tmp/m7-dod-docker.log 2>&1; e=$?; a=$(t); [ "$b" = "$a" ] && s=unchanged || s="changed from $b to $a"; echo "docker container tier exit $e; temp entries $s"
expect: docker container tier exit 0; temp entries unchanged
# item 2: CI6 docker leak checks print nothing
cmd: c=$(docker ps -a --filter label=org.patch-steward.test -q) && v=$(docker volume ls -q --filter label=org.patch-steward.test) && i=$(docker image ls -q --filter label=org.patch-steward.test) && echo "containers [$c] volumes [$v] images [$i]"
expect: containers [] volumes [] images []
# item 3: act on an LF clone passes build-and-test
cmd: r=$(pwd); d=$(mktemp -d); git clone -q -c core.autocrlf=false "$r" "$d/repo" && (cd "$d/repo" && act pull_request -W .github/workflows/ci.yml -j build-and-test --matrix os:ubuntu-latest -P ubuntu-latest=catthehacker/ubuntu:act-latest) > /tmp/m7-dod-act-build-and-test.log 2>&1; e=$?; rm -rf "$d"; s=$(grep -c 'Job succeeded' /tmp/m7-dod-act-build-and-test.log); f=$(grep -c 'Job failed' /tmp/m7-dod-act-build-and-test.log); [ "$e" = 0 ] && [ "$s" -ge 1 ] && [ "$f" = 0 ] && echo "act build-and-test passed" || echo "act build-and-test failed: exit $e, succeeded $s, failed $f"
expect: act build-and-test passed
# item 3: act on an LF clone passes lint-and-format
cmd: r=$(pwd); d=$(mktemp -d); git clone -q -c core.autocrlf=false "$r" "$d/repo" && (cd "$d/repo" && act pull_request -W .github/workflows/ci.yml -j lint-and-format -P ubuntu-latest=catthehacker/ubuntu:act-latest) > /tmp/m7-dod-act-lint-and-format.log 2>&1; e=$?; rm -rf "$d"; s=$(grep -c 'Job succeeded' /tmp/m7-dod-act-lint-and-format.log); f=$(grep -c 'Job failed' /tmp/m7-dod-act-lint-and-format.log); [ "$e" = 0 ] && [ "$s" -ge 1 ] && [ "$f" = 0 ] && echo "act lint-and-format passed" || echo "act lint-and-format failed: exit $e, succeeded $s, failed $f"
expect: act lint-and-format passed
# item 3: act on an LF clone passes container-tests with matrix runtime docker (coverage job not run)
cmd: r=$(pwd); d=$(mktemp -d); git clone -q -c core.autocrlf=false "$r" "$d/repo" && (cd "$d/repo" && act pull_request -W .github/workflows/ci.yml -j container-tests --matrix runtime:docker -P ubuntu-latest=catthehacker/ubuntu:act-latest) > /tmp/m7-dod-act-container-tests.log 2>&1; e=$?; rm -rf "$d"; s=$(grep -c 'Job succeeded' /tmp/m7-dod-act-container-tests.log); f=$(grep -c 'Job failed' /tmp/m7-dod-act-container-tests.log); [ "$e" = 0 ] && [ "$s" -ge 1 ] && [ "$f" = 0 ] && echo "act container-tests passed" || echo "act container-tests failed: exit $e, succeeded $s, failed $f"
expect: act container-tests passed
# item 4: PREREQ-PODMAN podman version exits 0 and shows a Server section (failure is needs-human, never a skip)
cmd: o=$(podman version 2>&1) && printf '%s\n' "$o" | grep -q '^Server:' && echo "podman server running" || echo "podman server not running"
expect: podman server running
# item 4: podman container tier exits 0 with OS temp patch-steward- entries unchanged
cmd: t(){ node -e "const fs=require('fs'),os=require('os');console.log(fs.readdirSync(os.tmpdir()).filter(n=>n.startsWith('patch-steward-')).length)"; }; b=$(t); STEWARD_CONTAINER_RUNTIME=podman pnpm test:container > /tmp/m7-dod-podman.log 2>&1; e=$?; a=$(t); [ "$b" = "$a" ] && s=unchanged || s="changed from $b to $a"; echo "podman container tier exit $e; temp entries $s"
expect: podman container tier exit 0; temp entries unchanged
# item 4: CI6 podman leak checks print nothing
cmd: c=$(podman ps -a --filter label=org.patch-steward.test -q) && v=$(podman volume ls -q --filter label=org.patch-steward.test) && i=$(podman image ls -q --filter label=org.patch-steward.test) && echo "containers [$c] volumes [$v] images [$i]"
expect: containers [] volumes [] images []
# item 5: exit E1, E4, E5 tests pass in the unit and fixture tiers
cmd: rm -f node_modules/.m7-dod-exit.json; pnpm vitest run -t 'exit E' --reporter=json --outputFile=node_modules/.m7-dod-exit.json > /dev/null 2>&1; e=$?; node -e "let r;try{r=require('./node_modules/.m7-dod-exit.json')}catch{r={testResults:[]}}const ok=new Set(),bad=[];for(const f of r.testResults){const tier=/[.]fixture[.]test[.]ts/.test(f.name)?'fixture':'unit';for(const a of f.assertionResults){const m=/^exit (E[1-5]):/.exec(a.title);if(!m)continue;if(a.status==='passed')ok.add(m[1]+' '+tier);else bad.push(a.title)}}const miss=['E1 fixture','E4 unit','E4 fixture','E5 fixture'].filter(k=>!ok.has(k));console.log('vitest exit '+process.argv[1]+'; '+(miss.length||bad.length?'missing '+JSON.stringify(miss)+' failing '+bad.length:'exit E1 E4 E5 tests pass in their tiers'))" "$e"
expect: vitest exit 0; exit E1 E4 E5 tests pass in their tiers
# item 5: exit E2, E3, E4 tests pass in the container tier
cmd: rm -f node_modules/.m7-dod-exit-container.json; STEWARD_CONTAINER_RUNTIME=docker pnpm test:container -t 'exit E' --reporter=json --outputFile=node_modules/.m7-dod-exit-container.json > /dev/null 2>&1; e=$?; node -e "let r;try{r=require('./node_modules/.m7-dod-exit-container.json')}catch{r={testResults:[]}}const ok={},bad=[];for(const f of r.testResults)for(const a of f.assertionResults){const m=/^exit (E[1-5]):/.exec(a.title);if(!m)continue;if(a.status==='passed')ok[m[1]]=1;else bad.push(a.title)}const miss=['E2','E3','E4'].filter(k=>!ok[k]);console.log('container tier exit '+process.argv[1]+'; '+(miss.length||bad.length?'missing '+miss.join(' ')+' failing '+bad.length:'exit E2 E3 E4 tests pass'))" "$e"
expect: container tier exit 0; exit E2 E3 E4 tests pass
# item 5: every exit E<n> test title is listed in the ledger notes of the container-tier phase
cmd: node -e "const fs=require('fs');const L=fs.readFileSync('development-artifacts/patch-steward-m7-ledger.md','utf8');const i=L.indexOf('### Phase 3 notes');let s=i<0?'':L.slice(i+3);const j=s.search(/\n#/);s=(j<0?s:s.slice(0,j)).replace(/\s+/g,' ');const T=new Set();for(const p of fs.readdirSync('packages')){const d='packages/'+p+'/src';if(!fs.existsSync(d))continue;for(const f of fs.readdirSync(d,{recursive:true})){if(!String(f).endsWith('.ts'))continue;for(const m of fs.readFileSync(d+'/'+f,'utf8').matchAll(/[\x27\x22\x60](exit E[1-5]: [^\x27\x22\x60]+)[\x27\x22\x60]/g))T.add(m[1])}}const miss=[...T].filter(x=>!s.includes(x));console.log(i>=0&&T.size&&!miss.length?'notes list every exit title':'missing '+JSON.stringify(i<0?['notes section']:miss))"
expect: notes list every exit title
# item 6: invariant-3.test.ts and invariant-3.container.test.ts exist and pass
cmd: test -f packages/core/src/conformance/invariant-3.test.ts && test -f packages/core/src/conformance/invariant-3.container.test.ts && pnpm vitest run packages/core/src/conformance/invariant-3.test.ts > /dev/null 2>&1 && STEWARD_CONTAINER_RUNTIME=docker pnpm test:container packages/core/src/conformance/invariant-3.container.test.ts > /dev/null 2>&1 && echo "invariant-3 tests pass"
expect: invariant-3 tests pass
# item 6: invariant-1, -4, -5, -7 tests extended as listed in the brief's Conformance checks
manual: confirm each listed addition exists and passes (original: "invariant-1, -4, -5, -7 tests extended as listed in "Conformance checks".")
# item 7: POLICY_LIMITS has 58 rows
cmd: pnpm --filter @patch-steward/core build > /dev/null 2>&1 && node -e "import('./packages/core/dist/index.js').then(m=>console.log(m.POLICY_LIMITS.length))"
expect: 58
# item 7: the template writes every key and validates; policy.schema.json matches policyEditorJsonSchema()
cmd: rm -f node_modules/.m7-dod-template.json; pnpm vitest run packages/core/src/policy/template.test.ts packages/core/src/policy/schema.test.ts --reporter=json --outputFile=node_modules/.m7-dod-template.json > /dev/null 2>&1 && node -e "const r=require('./node_modules/.m7-dod-template.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['template validates','template writes every key explicitly','template schema file deep-equals the live export'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
expect: titles ok
# item 7: every fixture policy valid at ee878e5 is still valid (Q2 A)
cmd: pnpm --filter @patch-steward/core build > /dev/null 2>&1 && node -e "const cp=require('child_process');import('./packages/core/dist/index.js').then(m=>{const files=['fixtures/policies/valid/copilot.yml','fixtures/policies/valid/injection-text.yml','fixtures/policies/valid/minimal-no-llm.yml','fixtures/policies/valid/openai-compatible.yml','fixtures/submissions/proposed-policy-valid.yml','scenarios/fixtures/policies/caps-author.yml','scenarios/fixtures/policies/caps-daily.yml','scenarios/fixtures/policies/orphan-branch.yml','scenarios/fixtures/policies/repository-store.yml','scenarios/fixtures/policies/unwritable-store.yml'];const bad=files.filter(f=>!m.validatePolicyBytes(cp.execFileSync('git',['show','ee878e5c8778f54187b3466c14bdfad09d30f09f:'+f])).ok);console.log(bad.length?'INVALID '+JSON.stringify(bad):'10 policies valid')})"
expect: 10 policies valid
# item 7: XR1-XR4 have failing fixtures in fixtures/policies/invalid/
cmd: pnpm --filter @patch-steward/core build > /dev/null 2>&1 && node -e "const fs=require('fs');const e=require('./fixtures/policies/expectations.json');import('./packages/core/dist/index.js').then(m=>{const k=['invalid/output-parts-above-output-bytes.txt','invalid/output-stream-below-output-bytes.txt','invalid/prepared-checkout-below-checkout.txt','invalid/result-files-above-limit.txt'];const bad=k.filter(x=>{const f='fixtures/policies/'+x;if(!fs.existsSync(f))return true;const r=m.validatePolicyBytes(fs.readFileSync(f));return r.ok||!JSON.stringify(r).includes('policy.invalid-value')||!e[x]||e[x].valid!==false||JSON.stringify(e[x].codes)!==JSON.stringify(['policy.invalid-value'])});console.log(bad.length?'BAD '+JSON.stringify(bad):'cross-field fixtures ok')})"
expect: cross-field fixtures ok
# item 8: steward screen --pr stores and verifies executed runs; golden reports exist
manual: confirm passing tests prove it (original: "`steward screen --pr` against the fixture world (recorded GitHub responses, a local fixture remote, a real runtime) stores execution records, output files (ER8), and result files (ER9) that `steward report` verifies; a run over `limits.evidence.run_bytes` drops result files in ER10 order (`stored_omitted_reason: evidence-budget`) and still verifies; a run with a result file whose decoded text exceeds 8388608 bytes stores its evidence without that file (`stored_omitted_reason: redaction-input`, Q20 A) and still verifies; golden reports for executed runs exist (Q7 A).")
# item 9: steward preflight --run fixture tests cover PF1-PF7 and E5; no --run runs no repository or policy command
manual: confirm passing tests prove it (original: "`steward preflight --run` fixture tests cover PF1–PF7 and E5; `--run` absent runs no repository or policy command (spy test: only read-only `git` and `gh auth token` are spawned).")
# item 10: architecture section 15 no longer lists the three closed decisions
cmd: node -e "const t=require('fs').readFileSync('docs/architecture.md','utf8');const i=t.indexOf('\n## 15. ');const r=i<0?'':t.slice(i+1);const j=r.indexOf('\n## ');const s=(j<0?r:r.slice(0,j)).replace(/\s+/g,' ');const hit=['Container image strategy','Network policy for dependency installation','Test result parsing'].filter(x=>s.includes(x));console.log(i<0?'section 15 not found':hit.length?'still listed: '+hit.join(', '):'closed items absent')"
expect: closed items absent
# item 10: architecture section 12.1 lists the 17 new keys
cmd: node -e "const t=require('fs').readFileSync('docs/architecture.md','utf8');const i=t.indexOf('\n### 12.1 ');const r=i<0?'':t.slice(i+1);const j=r.indexOf('\n## ');const s=j<0?r:r.slice(0,j);const k=['runner.resources.scratch_mb'].concat(['output_head_bytes','output_tail_bytes','output_stream_bytes','result_files','result_test_cases','checkout_bytes','checkout_files','prepared_checkout_bytes','overlay_files','overlay_bytes','materialize_seconds','image_pull_seconds','image_build_seconds','image_bytes','build_context_bytes','container_start_seconds'].map(x=>'limits.execution.'+x));const miss=k.filter(x=>!s.includes(x));console.log(i<0?'section 12.1 not found':miss.length?'missing '+miss.join(' '):k.length+' new keys listed')"
expect: 17 new keys listed
# item 10: architecture sections 9 and 11 name the output file and result file paths
cmd: node -e "const t=require('fs').readFileSync('docs/architecture.md','utf8');const sec=(h)=>{const i=t.indexOf('\n'+h);if(i<0)return '';const r=t.slice(i+1);const j=r.indexOf('\n## ');return (j<0?r:r.slice(0,j)).replace(/\s+/g,' ')};const p=['executions/execution-NNNN/output.txt','executions/execution-NNNN/result-<k>.xml'];const miss=[];for(const h of ['## 9. ','## 11. '])for(const x of p)if(!sec(h).includes(x))miss.push(h.trim()+' '+x);console.log(miss.length?'missing '+miss.join('; '):'paths named in sections 9 and 11')"
expect: paths named in sections 9 and 11
# item 10: architecture section 11 or 12 names stored_omitted_reason
cmd: node -e "const t=require('fs').readFileSync('docs/architecture.md','utf8');const sec=(h)=>{const i=t.indexOf('\n'+h);if(i<0)return '';const r=t.slice(i+1);const j=r.indexOf('\n## ');return j<0?r:r.slice(0,j)};console.log(sec('## 11. ').includes('stored_omitted_reason')||sec('## 12. ').includes('stored_omitted_reason')?'stored_omitted_reason named':'stored_omitted_reason not named')"
expect: stored_omitted_reason named
# item 10: SP09 no longer contains (open item)
cmd: node -e "const t=require('fs').readFileSync('docs/processes.md','utf8');const i=t.indexOf('\n### SP09.');const r=i<0?'':t.slice(i+1);const j=r.slice(1).search(/\n#{1,3} /);const s=j<0?r:r.slice(0,j+1);console.log(i<0?'SP09 not found':s.includes('(open item)')?'SP09 still has an open item':'SP09 has no open item')"
expect: SP09 has no open item
# item 10: architecture and process updates the records above cannot check
manual: confirm §12.1 lists K52–K63; §6.2, §6.3, §6.5, §8, §9, §11, §12, §13 updated; §11 or §12 states the ER10 drop rule and the ER9 redaction-input omission; SP05, SP17, SP20 updated; §14 and "Addresses" consistent (original: "Architecture: §15 no longer contains "Container image strategy", "Network policy for dependency installation", or "Test result parsing"; §12.1 lists the 17 new keys and K52–K63; §6.2, §6.3, §6.5, §8, §9, §11, §12, §13 updated (§9 and §11 name the output file `executions/execution-NNNN/output.txt` and result files `executions/execution-NNNN/result-<k>.xml`; §11 or §12 states the ER10 drop rule and the ER9 redaction-input omission, naming `stored_omitted_reason`); SP05, SP09 (no "(open item)"), SP17, SP20 updated; §14 and "Addresses" consistent.")
# item 11: docs/adr holds ADR-0079 to ADR-0089
cmd: ls docs/adr | grep -cE '^00(79|8[0-9])-.*[.]md' || true
expect: 11
# item 11: the ADR index has 89 rows
cmd: grep -c '^| \[ADR-' docs/adr/README.md || true
expect: 89
# item 11: ADR-0067 is superseded by ADR-0088 (Q7 A)
cmd: a=$(grep -c '^- Status: superseded by ADR-0088' docs/adr/0067-*.md || true); b=$(grep -cE '^[|] \[ADR-0067\].*[|] superseded by ADR-0088 ' docs/adr/README.md || true); echo "status line $a; index row $b"
expect: status line 1; index row 1
# item 12: CLAUDE.md names pnpm test:container
cmd: grep -q 'pnpm test:container' CLAUDE.md && echo present || echo absent
expect: present
# item 12: the user manual Execution and Runner sections have no [NEEDS INPUT] callout
cmd: node -e "const t=require('fs').readFileSync('docs/user-manual/configuration.md','utf8');const sec=(h)=>{const i=t.indexOf('\n'+h);if(i<0)return null;const r=t.slice(i+1);const j=r.slice(1).search(/\n#{1,3} /);return j<0?r:r.slice(0,j+1)};const out=['### Execution','### Runner'].map(h=>{const s=sec(h);return s===null?h+' not found':s.includes('[NEEDS INPUT]')?h+' has a callout':''}).filter(Boolean);console.log(out.length?out.join('; '):'no callout at Execution or Runner')"
expect: no callout at Execution or Runner
# item 12: whitepaper, README, CLAUDE.md, and user manual describe exactly the delivered scope
manual: confirm by reading (original: "Whitepaper §9–§14, README Status, CLAUDE.md (project state, commands incl. `pnpm test:container`, tiers), user manual (configuration Execution, Runner, Limits, Defaults; both `[NEEDS INPUT]` callouts at Execution and Runner removed; commands, installation Docker and Podman prerequisites, overview, usage, troubleshooting) describe exactly the delivered scope.")
# item 13: persistence scan prints no planning id introduced by this milestone
cmd: p='\bM[0-9]{2}\b|\bPD0[0-9]\b|\bQ[0-9]{1,2}\b|\bG[0-9]{1,2}\b|\bK[0-9]{2}\b'; set -- 'docs/*.md' ':(exclude)docs/project-development-plan.md' ':(exclude)docs/astra-plan.md' README.md CLAUDE.md fixtures templates; { git grep -I -oP "$p" ee878e5c8778f54187b3466c14bdfad09d30f09f -- "$@"; [ $? -le 1 ]; } > /tmp/m7-dod-ids-base.txt && { git grep -I --untracked -oP "$p" -- "$@"; [ $? -le 1 ]; } > /tmp/m7-dod-ids-head.txt && sed 's/^[0-9a-f]*://' /tmp/m7-dod-ids-base.txt | sort | uniq -c > /tmp/m7-dod-ids-base.cnt && sort /tmp/m7-dod-ids-head.txt | uniq -c > /tmp/m7-dod-ids-head.cnt && n=$(awk 'FILENAME==ARGV[1]{b[$2]=$1;next}$1>b[$2]+0{print $2}' /tmp/m7-dod-ids-base.cnt /tmp/m7-dod-ids-head.cnt | tr '\n' ' ') && echo "new planning ids: ${n:-none}"
expect: new planning ids: none
# item 14: fixtures/README.md lists every new fixture
manual: confirm against git diff --name-only --diff-filter=A ee878e5c8778f54187b3466c14bdfad09d30f09f HEAD -- fixtures (original: "`fixtures/README.md` lists every new fixture")
# item 14: no live .gitattributes or .gitmodules file is tracked
cmd: git ls-files | grep -cE '(^|/)\.git(attributes|modules)$' || true
expect: 0
# item 15: no milestone commit is on a remote-tracking ref
cmd: a=$(git rev-list --count origin/develop..HEAD) && b=$(git rev-list --count HEAD --not --remotes) && { [ "$a" = "$b" ] && echo "milestone commits are local only" || echo "$((a-b)) milestone commits are on a remote ref"; }
expect: milestone commits are local only
# item 15: git status -sb shows no upstream for the milestone branch
cmd: git status -sb | head -n 1
expect: ## milestone/7-sandboxed-execution
```
