# patch-steward-m5 — Brief

## Goal

Execute milestone M05 ("Decision, report, evidence records, and the local skeleton") of `docs/project-development-plan.md`:
the first end-to-end run (submission, findings, one decision table, a fixed-format report, durable local evidence) arranged in
the phases T1 will run as jobs (`gate`, `intake`, `execute`, `assess`, bounded rounds, `publish`), runnable in one process.
Deliver the decision module, the report module, the evidence module with a local store, the architecture §10 mappings as pure
rules, the phase runner with typed handoffs, `steward screen` at contract level, `steward report`, the uniform CLI conventions
(including exit status 3 for `inconclusive` in every command, which changes `steward preflight`), a never-pass conformance
harness (invariant 4, first check), and extensions of the invariant 6, 7, and 8 conformance checks. Record every decision as an
ADR and in the governing documents.

OWNER GATE: APPROVED 2026-09-27. Every item marked "(gate G<n>)", "I<n>", "K<n>", and the ADR inventory below is BINDING exactly as
written in this brief (answers in "Owner gate (APPROVED 2026-09-27)"). Any change needs a planner amendment with owner approval.

## Context

### Repository and environment facts (read at commit 6d2ea64942ab57fd74a68cdeed8ab7eedfad014d; line numbers shift as files are edited — locate text by quotation and re-verify against live files)

- Repo root: `C:\Users\John\Projects\steady-orchard\patch-steward` (Git Bash path `/c/Users/John/Projects/steady-orchard/patch-steward`).
  Remote `origin = git@github.com:steady-orchard/patch-steward.git` (public). `git symbolic-ref refs/remotes/origin/HEAD` =
  `refs/remotes/origin/develop`. Working branch `milestone/5-decision-report-evidence-records-local-skeleton` (local, created from
  `develop` at 6d2ea64; do not push). Nothing in this plan pushes, opens a PR, or writes to GitHub.
- Environment: Windows 11; Git Bash for all commands in this brief. Node `v24.11.0`, pnpm `10.20.0`, git `2.55.0.windows.3`,
  `gh 2.93.0` (logged in; `gh auth token` works). Network access to api.github.com is available for live commands only.
- `core.autocrlf=true`: text files committed with LF check out with CRLF. Compare committed bytes with `git show HEAD:<path>`, never
  working-tree bytes. No `.gitattributes` exists. `jq` is NOT installed.
- Long git-worktree paths break `pnpm test`: phase gates and the project DoD run in the MAIN tree; worker worktrees use short paths
  such as `C:/Users/John/Projects/steady-orchard/m5-w<id>`.
- `.gitignore` ignores (among others) `logs`, `*.log`, `out`, `dist`, `coverage`, `.cache`, `*.tgz`, `*.pid`, `*.seed`, `.env`,
  `.env.*`, `pids`, `report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json`, `node_modules/`, `.claude`. No committed file or directory may use those
  names (a committed directory named `logs` is silently untracked). See I19.
- `.prettierignore`: `pnpm-lock.yaml`, `dist/`, `coverage/`, `node_modules/`, `development-artifacts/`. Prettier (`singleQuote`,
  `semi`, `trailingComma: all`, `printWidth: 132`, `endOfLine: auto`) checks every other `.json`, `.md`, `.yml`, `.ts` file, including
  everything under `fixtures/` and `docs/`. Prettier rewrites JSON array layout and Markdown; byte-exact fixtures use `.txt`.
  `development-artifacts/` is already excluded; this plan adds no ignore entry for artifacts.
- Toolchain (root `package.json` scripts): `build` = `pnpm -r build`; `typecheck` = `tsc --noEmit -p packages/<pkg>/tsconfig.test.json`
  chained for core, cli, action, web; `test` = `vitest run`; `test:live` = `vitest run --config vitest.live.config.ts`; `lint` =
  `eslint .`; `format` = `prettier --write .`; `format:check` = `prettier --check .`. Root, core, and cli `version` = `0.0.2`
  (lockstep). `packages/core` dependencies: `yaml`, `zod` only. `packages/cli`: `bin.steward = ./dist/main.js`, dependency
  `@patch-steward/core: workspace:*`.
- TypeScript: `module: nodenext`, `verbatimModuleSyntax`, `isolatedModules`, `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`. Relative imports use `.js`. Type-only imports use
  `import type`. `packages/core/src/index.ts` re-exports modules with `export *`: every new export name must be unique across core
  (collisions fail tsc TS2308).
- Vitest (`vitest.config.ts`): projects `unit` (`packages/*/src/**/*.test.ts` minus fixture, container, live suffixes) and `fixture`
  (`*.fixture.test.ts`); both alias `@patch-steward/core` to `packages/core/src/index.ts` exactly (cli code and tests import only
  the package root). `vitest.live.config.ts` runs `*.live.test.ts` only through `pnpm test:live`, never in CI.
- ESLint flat config ignores `**/dist/`, `docs/`, `coverage/`; no Node globals (import `process` from `node:process`).
- `docs/adr/`: 61 records (ADR-0001–ADR-0061), all `Status: accepted`; `grep -c '^| \[ADR-' docs/adr/README.md` = `61`. MADR format
  per `docs/adr/README.md` "Format". No record has ever been superseded; this milestone supersedes ADR-0060 (gate G5).

### Milestone text (verbatim, `docs/project-development-plan.md` "### M05. Decision, report, evidence records, and the local skeleton")

```text
Goal: the first end-to-end run: submission, findings, one decision table, a
fixed-format report, and durable local evidence, arranged in the phases that
T1 will run as jobs.

Design scope: SP13 steps 1–3 for local runs; SP19 step 8; SP18 step 1 (records, redaction, caps); SP20 steps 1–3 without publication; §6.2 Decision, Report, Evidence; §9; §10 mappings; §6.5 `steward screen`, `steward report`; invariants 4, 6, 7, 8
Addresses: P01, P02, P07, P08, P09, P10, P11, O01, O02
Depends on: M04

Outputs:
- Decision module: SP13's table in precedence order, waiting states as
  non-outcomes, the never-pass rule.
- Report module: fixed order, caps, neutral wording, the check-run summary
  text, truncation that links to evidence.
- Evidence module: typed records, redaction before persistence, size caps, run
  provenance, metrics events, a local store.
- §10 mappings as rules: mode to check conclusion, outcome to lifecycle label,
  blocking exceptions first. The API writes arrive in M14.
- The phase sequence `gate`, `intake`, `execute`, `assess`, rounds, `publish`
  runnable in one process, with typed handoff records that carry run, attempt,
  snapshot, round, and remaining budget.
- `steward screen` at contract level, under the trusted-branch policy or an
  explicitly named local policy; `steward report`.
- A never-pass conformance harness that injects failures at every phase
  boundary; every later milestone extends it.

Exit criteria:
- Table-driven tests cover every SP13 row and the precedence order; `advisory`
  and `speculative` findings never gate; missing optional checks never become
  missing required evidence.
- Injected failures never yield `pass`, and a failed evidence write yields no
  report.
- The §10 mapping tests cover every mode, the neutral "not enforced" case,
  pending waiting states, `cancelled` for superseded cleanup only, and the
  shared-head rule that no override lifts.
- Reports stay within caps, carry the bound identifiers and provenance of SP13
  step 2, and contain no severity, authorship, or praise statement.
- A run under a named local policy is labeled non-authoritative wherever it is
  rendered.
```

Plan §7.3: M05 is the FIRST conformance check for invariant 4 (never pass on failure) and extends invariants 6 (report wording), 7
(redaction, caps), and 8 (snapshot binding). Plan §7.2: "Policy, submission, execution-record, finding, report, metrics schemas" →
"M05 records". §15 item "The evidence store's run-directory layout and stored-record file format." is settled here (gate G4).

### Design sources (governing; read at 6d2ea64)

- `docs/processes.md`: §0.1 vocabulary (Finding, Outcome, Required evidence, Snapshot); §0.2 rules (no pass on missing required
  evidence; every process records evidence and emits metrics events; "T3 and T4 use local snapshots, run ids, budgets, and durable
  local evidence; they create no official checks"); §0.4 pipeline order (jobs `gate -> intake -> execute -> assess -> bounded
  execute-N/assess-N pairs -> publish`); SP13 (lines 1065–1180: step 1 decision table, 9 rows, quoted in "Decision table" below; step
  2 report order; step 3 persist before posting; steps 4–7 are T1 publication, out of scope; "Truncated outputs link to evidence";
  failure handling "a failed evidence write ... cannot complete a check successfully"); SP18 step 1 (line 1422: "write the run
  directory with redaction and size caps"; failure handling "the report is not posted without its evidence"); SP19 step 8 (line
  1519: "The decision module enforces the never-pass rule for any missing required evidence"), steps 2 and 6, failure handling, and
  the closed cause vocabulary (line ~1602: 19 causes, each `inconclusive`); SP20 (lines 1613–1644: steps 1–3; "a run under a
  non-trusted policy is labeled as such and cannot be published as the official report").
- `docs/architecture.md`: invariants 4, 6, 7, 8 (lines 70–93); §6.2 module table (Decision, Report, Evidence rows, lines 229–231);
  §6.3 Evidence store and Clock-and-ids rows; §6.4 (job table, "Every handoff carries run, attempt, snapshot, round, and remaining
  cumulative budget; all rounds stay in one run"; publish runs after failures and records incomplete required work as
  `inconclusive`); §6.5 (commands table; `steward policy` and `steward preflight` syntax and exit-status paragraphs, lines 495–556;
  preflight currently maps `inconclusive` to 2); §8 Stages row ("reference verification and claim validation always run"), Evidence
  row, Limits row (`limits.evidence.run_bytes`, `limits.evidence.write_retries`, `limits.stage_seconds`), Hygiene row
  (`hygiene.max_flagged`); §9 data model (lines 784–848: schema rule "an optional addition keeps the version; a removal, rename, or
  change of meaning increments it"; entity table; findings "`advisory` and `speculative` never gate admission"); §10 (lines
  850–940: mode table, "not enforced" neutral, check exceptions, shared-head mapping, lifecycle labels); §11 (lines 942–977: layout
  concept, append-only, redaction before write, fail-closed timeout); §12 failure classes; §12.1 hard bounds (lines 1064–1117;
  "Hard-only constants" table ends with "Record schema version 1"); §13 "Credential leakage in logs", "Model credential exposure"
  rows; §15 first bullet "The evidence store's run-directory layout and stored-record file format.".
- `docs/whitepaper.md` §8 (report format, line ~381 "A screening report has a fixed order and length caps"), §9–§14 (§14
  "Implemented so far" line 776; decisions paragraph line 815 "Further decisions recorded on September 26, 2026 (ADR-0050–ADR-0061").
- `docs/deferred.md` DF10 "Retained in version 1": "Steward report length caps and report-length measurements." (report caps are NOT
  deferred; author-facing submission length caps ARE deferred and must not appear).
- `docs/user-manual/`: `commands.md` ("## `steward preflight` (Available)" exit table with `inconclusive` under `2`; "## CLI commands
  (Proposed)" table lists `steward screen`, `steward report` and a `[NEEDS INPUT]` callout at line 303); `usage.md` "## Local screening
  and replay (Proposed)" with a `[NEEDS INPUT]` callout at line 297 and "## Prepare a submission (Available)" line 82 ("`2` that the
  check could not run"); `configuration.md` "### Evidence" (built-in detector list) and "## Evidence and visibility (Proposed)";
  `troubleshooting.md`; `overview.md` "## Outcomes and waiting states (Proposed)".

### Delivered code M05 builds on (read at 6d2ea64)

- `packages/core/src/vocabulary.ts`: `OUTCOMES` (6), `WAITING_STATES` (`queued`, `awaiting-approval`), `LIFECYCLE_LABEL_STATES` (6),
  `FINDING_SEVERITIES` (`blocking`, `uncertain`, `advisory`, `speculative`), `MODES`, `STAGE_IDS` (`fix-verification`, `regression`,
  `challenge`), `FAILURE_CAUSES` (19, in SP19 order), `ISSUE_CLASSIFICATIONS`, `MAINTAINER_ACTION_KINDS`.
- `packages/core/src/result.ts`: `Result`, `ok`, `err(code, cause, message, details?)`; every failure carries `outcome: 'inconclusive'`.
- `packages/core/src/hash.ts` (`sha256Hex`, `contentHash` → `sha256:<hex>`, `canonicalJsonHash`, `localFileRevisionId`),
  `canonical-json.ts` (RFC 8785).
- `packages/core/src/labels.ts`: `STATUS_LABEL_DEFAULTS` (names `steward:<state>`), `CLASSIFICATION_LABEL_DEFAULTS`.
- `packages/core/src/records/*` (strict Zod, `schema_version: 1`): `common.ts` (`recordPositiveIntSchema`, `recordIdentifierSchema`
  printable ASCII ≤256, `recordTextSchema` ≤65536, `recordList` ≤1000, `recordTimestampSchema`, `policyRevisionIdSchema`); `run.ts`
  (`run_id`/`run_attempt` positive ints; `subject` submission or merge-group with `snapshot_hash`; `commits`; `owned_check_id`;
  `policy_revision`; `steward_version`; `provider`, `requested_model`, `reported_model`, `adapter_version`, `generation`,
  `runner_identity` nullable; `mode`; `started_at`, `finished_at`; `budget` of nullable counters); `finding.ts` (`run_id`,
  `run_attempt`, `finding_id`, `stage`, `severity`, `scenario`, `location {path, line, field}`, `evidence` identifiers, `basis`,
  `dismissal_code`; NO finding-code key); `decision.ts` (`outcome`, `contributing_findings`, `unmet_requirements`, `requests
  {request_id, text}`; NO causes key); `report.ts` (`rendered`, `check_summary`, `bound {policy_revision, snapshot_hash, head_commit,
  base_commit}`); `execution-record.ts`; `maintainer-action.ts`; `metrics-event.ts` (kinds `state-transition`, `cost`, `latency`,
  `maintainer-resolution`, `appeal`, `audit-result`; subject `run {run_id, run_attempt}` or `submission`); `submission.ts` (issue
  records REQUIRE non-null `issue_kind`, so `captureIssue` returns `record: null` for an unstructured issue — see G6).
  `packages/core/src/policy/revision-record.ts`: `policyRevisionRecord(loaded, {stewardVersion, loadedAt})`, `authoritative` false for
  `local-file` revisions.
- `packages/core/src/redaction/`: `detectors.ts` (`BUILT_IN_DETECTORS`, 8: `private-key`, `github-token`, `aws-access-key-id`,
  `provider-api-key`, `jwt`, `authorization-header`, `bearer-token`, `url-credentials`; marker `[REDACTED:<id>]`);
  `redact.ts` (`redactText(input, {policyPatterns, knownSecrets, ...})` — `knownSecrets` already does exact-value replacement with id
  `known-secret`; one `node:worker_threads` Worker per call; bounds `REDACTION_INPUT_MAX_BYTES` 8388608, `REDACTION_TIMEOUT_MS` 2000;
  failure codes `redaction.input-too-large`, `redaction.invalid-pattern`, `redaction.timeout`, `redaction.failed`);
  `safe-pattern.ts`. The policy validator rejects any policy string matching a built-in detector (`policy.credential-value`), so new
  detectors also tighten policy validation.
- `packages/core/src/submission/`: `contract.ts` (`checkContract`, `ContractResult {disposition met|needs-changes|uncertain|
  inconclusive, findings, requests, inconclusive, warnings, enforced, effective_mode, category, plausible_categories, template,
  flags}`, `CONTRACT_FINDING_CODES` (16), `CONTRACT_FINDING_SEVERITIES`, `CONTRACT_FINDING_MESSAGES`, request texts built in
  `requestText()`); `intake.ts` (`captureIssue(context, n)`, `capturePullRequest(context, n)`, `CaptureContext {client, repository,
  policy, policyRevision, attachmentResolver, attachmentTransport, authorResponses}`, `buildSubmissionRecord`); `snapshot.ts`
  (`snapshotHash`; issue and PR snapshot schemas type `policy_revision` as `recordCommitIdSchema` at 6d2ea64, so a `local:<sha256>`
  revision is rejected and every `--policy-file` capture fails — widened by G6f); `default-checklist.ts`.
- `packages/core/src/github/` (`createGitHubClient`, `githubBudgetForPolicy`, `githubBudgetForPreflight` (K19: 20 requests, 2
  retries), readers incl. `readIssue` which fails `github.not-an-issue` for a PR); `policy/loader.ts` (`loadPolicy` with sources `git`,
  `file`, `github`); `policy/bounds.ts` (all hard constants; M03 K1–K12, M04 K13–K26).
- `packages/core/src/conformance/`: `invariant-1`, `invariant-2`, `invariant-5` (unit, fixture), `invariant-6`, `invariant-7`,
  `invariant-8`, `never-pass`, `never-pass-content`, `never-pass-submission`, `zero-execution.fixture`. NO `invariant-4` file exists.
  Credential samples in tests are built by concatenation (`'ghp_' + 'A1b2C3d4'.repeat(4) + 'E5f6'`), never committed as literals.
- `packages/cli/src/`: `cli.ts` (`runCli`, `STEWARD_USAGE`; accepts `help`, `--help`, `-h`); `policy-command.ts` (exit 0/1/2,
  `CommandIo`, `PolicyCommandContext {cwd, io}`); `preflight-command.ts` (`PREFLIGHT_EXIT_BY_DISPOSITION` maps `inconclusive: 2`;
  `PreflightExitCode = 0 | 1 | 2`); `preflight-args.ts`, `preflight-draft.ts`, `preflight-output.ts` (`escapeTerminalText`,
  `PREFLIGHT_NOTICE`), `github-auth.ts` (`resolveGitHubAuth`: `GH_TOKEN`, `GITHUB_TOKEN`, `gh auth token`). No steward-version
  constant exists anywhere (I14).
- `fixtures/`: `policies/`, `submissions/` (bodies `.txt`, `expectations.json`, `diffs/`), `github/testbed/` (recorded, read-only,
  from `steady-orchard/patch-steward-testbed-public`: issues 29 and 30 and PRs 26–28 all have UNSTRUCTURED bodies, all closed; no
  `.github/patch-steward/`), `github/hostile/`, `github/policy-directory/` (synthetic repository with a published policy).

### Plan-wide DoD items that apply (plan §0.3)

| §0.3 item | How it applies here |
| --- | --- |
| Build, type-check, tests, lint, format pass (Ubuntu and Windows) | Run locally on Windows in the main tree; Ubuntu via CI on the lead's PR. Tests are OS-independent: paths in records and manifests are POSIX; fs tests use `os.tmpdir()`; no working-tree byte assertions on committed fixtures. |
| Runtime validation; handled as data | New inputs crossing into core: handoff records (validated at every boundary), stored evidence read by `steward report` (manifest and every record re-validated), CLI arguments, the evidence directory path. Submission-derived text reaches reports only escaped (G2) and never a shell or authorization decision. |
| Injected-failure tests, never `pass` | The invariant-4 harness injects failures at every phase boundary and inside `publish`; never-pass tables gain every new failure-code union (compile-time exhaustive). |
| Limits under hard bounds; redaction before persistence | Report caps K27–K32, evidence logs K33–K34, exact-value minimum K35, evidence files K36, handoff size K37 (gate G1); `limits.evidence.run_bytes`, `limits.stage_seconds`, `stages.challenge_rounds`, `limits.github.*` from policy; redaction of every stored string before write (G3). |
| No decision input from authorship | Decision, mapping, and report inputs carry no author login, association, account age, or AI-disclosure field; invariant-6 extension proves report bytes invariant under author-identity changes. |
| Evidence and metrics per delivered step | Every local run writes a run directory and a metrics file (G4, "Metrics events"). |
| Fixture corpus grows | Golden reports, hostile report text, screen scenarios, synthetic GitHub responses (see "Fixture corpus"). |
| Decisions recorded governing document first | ADR-0062 onward (see "ADR inventory"), then architecture, processes, whitepaper §9–§14, README, CLAUDE.md, user manual (see "Documentation change inventory"). §15 loses its first bullet. |
| Documentation describes only what was delivered | `steward screen` Available at contract level (no container, no model, no publication); `steward report` Available; `steward init`, `steward replay` stay Proposed; publication flag stays unnamed. |
| Invariant conformance (plan §7.3) | New `invariant-4`; extended `invariant-6`, `invariant-7`, `invariant-8`; all stay in the suite. |

### Owner decisions (settled 2026-09-27; binding; restated from the lead's prompt)

- D1 Report caps: hard-only core constants, no new policy keys (precedent M04 K13–K26): whole report and check summary under GitHub's
  65536 (comment body) and 65535 (check-run summary) character limits with headroom; per-section item counts and per-item length
  caps; overflow states the remaining count with an evidence link. Planner drafts numbers (gate G1).
- D2 Report wording: core-owned templates keyed by finding and request kind for all fixed text; submission-derived text appears only
  escaped (no raw HTML, @mentions and #issue references neutralized, links only to repository and evidence URLs); a conformance test
  scans rendered reports against a denylist of severity, authorship/AI, and praise terms. Planner drafts templates and denylist (gate G2).
- D3 Evidence layout and record format: one directory per run; one JSON file per record (run, submission, policy revision, each
  finding, each execution record, decision, report, maintainer action), rendered `report.md`, redacted bounded `logs/`, and
  `manifest.json` listing every file's bytes and sha256 (the RFC 8785 content hash for records). Metrics events as a per-run file
  under a monthly partition, so no write ever modifies an existing file. JSON pretty-printed in RFC 8785 key order. A later milestone
  places this directory in the orphan branch or separate repository; this milestone delivers the local store only (gate G4).
- D4 Redaction: beyond the eight M03 detectors, exact-value redaction of every credential the process resolved (the GitHub token
  now; App and model credentials later) and well-known prefixed token formats (npm, PyPI, GitLab, Slack, Stripe, Google API keys;
  planner drafts list and patterns). No keyword or entropy heuristics. Coverage at persistence: every string value of every record,
  `report.md`, and logs, then schema re-validation; a redaction failure or timeout fails the evidence write, so no report (gate G3).
- D5 CLI conventions (uniform): long flags only; `--json` prints one JSON object with `schema_version`; warnings to standard error;
  GitHub token resolution unchanged; exit 0 success or `pass`; 1 `needs-changes`, `uncertain`, or invalid input; 2 usage,
  environment, GitHub or git failure; 3 `inconclusive` in every command (changes `steward preflight`: code, tests, architecture §6.5,
  user manual, and supersede or amend the M04 ADR). `steward screen (--issue | --pr) <number> [--repo owner/name] [--policy-file
  <path>] [--evidence-dir <dir>] [--json]`: trusted policy from the upstream default branch via the GitHub API; `--policy-file`
  non-authoritative (`local:<sha256>`); evidence defaults to the user data directory (never inside the checkout); prints the run
  directory. `steward report <run-dir> [--json]`. No publication flag in this milestone. Planner finalizes syntax (gate G5).

### Owner gate (APPROVED 2026-09-27)

The owner approved every item as recommended (relayed by the lead, 2026-09-27). The values below are folded into the binding text of
each gate section; rejected alternatives are marked REJECTED and must not be implemented.

| Item | Answer (2026-09-27) |
| --- | --- |
| G1 report caps | APPROVED: K27–K32 as written. |
| G2 layout, templates, E-rules, denylist | APPROVED as written; `please` STAYS on the denylist. |
| G3 redaction | APPROVED: all 15 detectors (ten required plus five optional extras, all built in), EX-rules with the three exact-value forms, CV-rules, including the `policy.credential-value` side effect. |
| G4 evidence layout and local store | APPROVED: layout, names, manifest shape, metrics partition, PJ-rules, WR-rules, VR-rules as written. |
| G5 CLI | APPROVED: CV-list, `screen` syntax and behavior, J-SCREEN, J-REPORT, default evidence directories, R-A for `steward report` exit status (R-B REJECTED); ADR-0060 becomes `superseded by ADR-0066`. |
| G6 record schemas | APPROVED: G6a–G6f with `schema_version` staying 1 (the version-2 alternative REJECTED); G6f (snapshot `policy_revision` widening) approved by amendment 2026-09-27. |
| G7 contract-level outcome | APPROVED: Option A, the closed cause `stage-incomplete` (Options B and C REJECTED). |
| I1–I29 | APPROVED: all accepted; every "Rejected alternative" stays unimplemented. |
| K33–K37 | APPROVED as written. |
| ADR inventory | APPROVED: nine new records ADR-0062–ADR-0070 as listed. |

Lead correction applied with the approval (not a gate change): the J-SCREEN and J-REPORT examples and the `authoritative` rule were
made consistent (G5 "Authoritative flag rule").

### Gate G1 — report caps (APPROVED 2026-09-27; K-table; continues M03 K1–K12 and M04 K13–K26; all hard-only core constants, listed in architecture §12.1 when delivered)

Unit: UTF-16 code units of the JavaScript string (GitHub counts characters; code units ≥ code points, so the bound is conservative).

| Row | Constant | Value | Basis |
| --- | --- | --- | --- |
| K27 | Report maximum | 60000 | GitHub comment body 65536; 5536 headroom for publication additions (hidden marker, attribution line) |
| K28 | Check-run summary maximum | 8000 | GitHub check-run summary 65535; the summary is a pointer to the report; shared-head list bounded by K20 (100 numbers) |
| K29 | Items per report section | Blockers 20; Uncertainties for maintainers 10; Executed commands and results 10; References 20; Flagged automated activity 10 and at most `hygiene.max_flagged`; What would change the outcome 10; Classification notes 10 | Static sum below stays under K27 |
| K30 | Maximum per rendered item, including its list marker, nested lines, and newline | Header block (title, outcome, bound identifiers, notices) 3000; Classification line 300; each Classification note 300; Blocker 1000; Uncertainty 800; Executed command 600; Reference 250; Flagged item 300; What-would-change item 500; Provenance block 1500; Overflow line 300 | Worst case per section |
| K31 | Submission-derived value per rendered occurrence | 200 | Paths (up to 4096 bytes), URLs (up to 2048) truncated in the report; full value stays in the evidence record |
| K32 | Subjects listed per item | 10, then `and <n> more` | Paths, PR numbers, URLs per finding |

Static budget check (a unit test asserts it from the module's own constant table): header 3000 + classification (300 + 10 x 300)
3300 + blockers 20 x 1000 + uncertainties 10 x 800 + commands 10 x 600 + references 20 x 250 + flagged 10 x 300 + what-would-change
10 x 500 + provenance 1500 + 7 overflow lines x 300 + 9 section headings x 60 + blank separator lines ≤ 60000. Computed: 57460 plus
separators. A runtime guard: a rendered report over K27 or summary over K28 is a `steward-defect` failure of `publish` (no report),
never silent truncation of structure. Overflow line (exact template, G2 T-OVF) states the remaining count and links the evidence
location. A truncated derived value renders as its first 200 code units (never splitting a surrogate pair) in the code span followed
by ` (truncated)`.

APPROVED 2026-09-27: K27–K32 as written (binding).

### Gate G2 — report layout, wording, escaping, and denylist (APPROVED 2026-09-27)

Layout (fixed order = SP13 step 2; Markdown; no tables anywhere in reports or summaries, lists only; every section heading always
present; an empty section renders exactly `- None.`). `<...>` is a placeholder; `` `v` `` is a code span produced by the escaper
(E-rules); text in double quotes is a core-owned label.

```text
## Patch Steward screening report

- Outcome: `<outcome>`
- Inconclusive causes: `<cause>`, `<cause>`                       (only when outcome is inconclusive)
- Submission: `<owner>/<repo>` <issue|pull request> `<number>`
- Snapshot: `<sha256:...>`
- Target branch: `<ref>`                                           (pull requests only)
- Head commit: `<sha>`                                             (pull requests only)
- Base commit tested: `<sha>`                                      (pull requests only)
- Policy revision: `<revision>`
- Run: `<run id>` attempt `<n>`

> Local run: produced on a maintainer's machine; not the repository's official screening result.
> Non-authoritative: screened under the local policy file revision `<local:...>`, not the trusted branch's policy.   (local policy only)

### Classification

- <classification line, T-CLS>
- Note: <advisory or speculative finding text, T-FIND note column>

### Blockers

1. <scenario>
   - Location: <location>
   - Evidence: `<evidence link>`
   - Dismissal code: `<code>`                                    (line omitted when null)
   - Request `R<n>`: <request>

### Uncertainties for maintainers

1. <scenario>
   - Location: <location>
   - Evidence: `<evidence link>`
   - Decision needed: <decision text>

### Executed commands and results

### References

### Flagged automated activity

### What would change the outcome

- <T-OUT line, then one T-CAUSE remedy line per cause>

### Provenance

- Policy revision: `<revision>` (trusted branch `<ref>` at commit `<sha>`)   or   (local policy file; non-authoritative)
- Steward version: `<version>`
- Model: no model call in this run
- Adapter and runtime: none
- Runner: no execution in this run
```

T-NOTICE (exact fixed text): `Local run: produced on a maintainer's machine; not the repository's official screening result.` and
`Non-authoritative: screened under the local policy file revision <code span>, not the trusted branch's policy.` The non-authoritative
notice appears in `report.md`, the check summary, `steward screen` text and JSON (`authoritative: false`, `notices`), and `steward
report` text and JSON.

T-CLS (classification line): issue `Form: "defect"` or `Form: "proposal"` or `Form: none (unstructured)`, followed by `Claim
classification: not determined; claim validation did not run.`; pull request `Category: <code span>` (declared and consistent) or
`Category: not determined; plausible: <code spans>` followed by `Claim classification: not determined; claim validation did not
run.` Classification line and notes are one list.

T-FIND (keyed by finding code and detail; `<label>` is the mapping label in double quotes; `<where>` is `issue body` or `pull request
description`; `<paths>`, `<urls>`, `<prs>` are code-span subject lists per K32; blocking rows use Scenario and Request, uncertain rows
Scenario and Decision needed, advisory rows render only as Classification notes):

| Code (detail) | Scenario | Request or decision or note |
| --- | --- | --- |
| `submission.unstructured` (issue-form) | The issue body does not match a supported issue form. | Rewrite the issue with one of the repository's issue forms: `<https://github.com/<owner>/<repo>/issues/new/choose>` |
| `submission.unstructured` (pull request) | The pull request description does not match a supported template version. | Rewrite the pull request description with the pull request template: `<https://github.com/<owner>/<repo>/blob/<default branch>/.github/pull_request_template.md>` |
| `submission.field-duplicate` | The <label> section appears more than once. | Keep exactly one <label> section. |
| `submission.field-missing` | The required <label> section is absent or has no content. | Fill in the <label> section. |
| `submission.category-missing` | The "Category" section is absent or has no content. | Fill in the "Category" section with exactly one of `bugfix`, `feature`, `refactor`, `docs`, `chore`, `security`. |
| `submission.category-invalid` | The "Category" section does not name exactly one category. | Replace the content of the "Category" section with exactly one of `bugfix`, `feature`, `refactor`, `docs`, `chore`, `security`. |
| `submission.linked-issue-missing` | The category <code span> requires a linked issue, and none is named. | Name one issue of this repository in the "Linked issue" section, for example `#123`. (free-form variant: Use the pull request template and name one issue of this repository in its "Linked issue" section: <template link>) |
| `submission.linked-issue-invalid` | The "Linked issue" section does not name exactly one existing issue of this repository. | Replace the content of the "Linked issue" section with exactly one existing issue of this repository, for example `#123`. |
| `submission.attachment-violation` (count) | More than <limit> attachments are linked. | Link at most <limit> attachments. |
| (destination) | The attachment <url> is not on an approved attachment host. | Upload the file as a GitHub attachment instead of linking <url>. |
| (scheme) | The attachment <url> does not use HTTPS. | Upload the file as a GitHub attachment instead of linking <url>. |
| (userinfo) | The attachment <url> contains credentials in its address. | Remove <url> and upload the file as a GitHub attachment. |
| (format) | The attachment <url> has a format outside the allowed formats: <formats>. | Replace <url> with a file in an allowed format. |
| (file-bytes) | The attachment <url> exceeds the per-file size limit of <n> bytes. | Replace <url> with a smaller file. |
| (total-bytes) | The attachments exceed the total size limit of <n> bytes. | Reduce the total size of the attachments. |
| (redirects) | The attachment <url> redirects more than <n> times. | Replace <url> with a direct GitHub attachment link. |
| (archive) | The archive <url> breaks an archive rule. | Replace <url> with plain files or an archive without encrypted, linked, or unsafe entries. |
| (decompressed-bytes) | The archive <url> expands beyond <n> bytes. | Replace <url> with a smaller archive. |
| `submission.shared-head` | Open pull requests <prs> share this head commit, so no check on it can certify this pull request. | Push a distinct commit to this branch (an empty commit is enough), or close the other pull requests. |
| `submission.category-mismatch` | The declared category <code span> is not consistent with the changed paths. | Decision needed: decide the category; categories consistent with the changed paths: <code spans>. |
| `submission.category-enforced-ambiguity` | The category is ambiguous, and a plausible category (<code spans>) is under enforcement. | Decision needed: decide the category before its enforced requirements apply. |
| `submission.execution-sensitive-change` | Execution-sensitive paths changed: <paths>. | Decision needed: review these changes; test results from this pull request cannot be relied on until a maintainer does. |
| `submission.diff-too-large` | The diff exceeds 3000 changed paths and cannot be classified. | Decision needed: classify the change and review its trusted and execution-sensitive paths by hand. |
| `submission.attachment-unavailable` | (note) | The optional attachment <url> could not be fetched. |
| `submission.trusted-path-change` | (note) | Trusted paths changed (<paths>); results from pull-request-controlled CI cannot be relied on. |
| `submission.policy-change` | (note) | The pull request proposes a policy change (proposed revision <code span>: `valid`, `invalid`, or `removed`); the active policy still applies. |

Location (T-LOC): a field → `the <label> section of the <where>`; no field → `the <where>`; paths → `<paths>`; shared head → `head
commit <code span>`.

T-OUT (What would change the outcome, first line, keyed by outcome): `pass` → `A change to the submission or the policy starts a new
screening.`; `needs-changes` → `Completing each numbered request changes this outcome.`; `uncertain` → `A maintainer decision on each
item under "Uncertainties for maintainers" changes this outcome.`; `inconclusive` → `Required work did not complete; the causes below
explain what changes this outcome.`; `superseded` → `The replacement run's report applies.`; `overridden` → `The recorded maintainer
action determines this outcome.`

T-CAUSE (one line per cause, `<cause text> <remedy>`; closed vocabulary incl. the approved `stage-incomplete`, G7):

| Cause | Cause text | Remedy |
| --- | --- | --- |
| `infrastructure` | An infrastructure failure stopped required work. | Rerun after the failure is resolved. |
| `github-unavailable` | GitHub could not be read. | Rerun when GitHub is reachable. |
| `model-unavailable` | The configured model could not be reached. | Rerun when the model is available. |
| `model-retired` | The configured model id is retired. | Select a current model in the policy. |
| `credential-unusable` | The model credential is missing or unusable. | Provide a usable credential for the configured adapter. |
| `capability-mismatch` | The configured model lacks a required capability. | Select a model with the required capabilities. |
| `model-refusal` | The model declined a required request. | Rerun; a maintainer triages a repeat. |
| `malformed-output` | Model output failed validation after the allowed repairs. | Rerun; a maintainer triages a repeat. |
| `rate-limited` | A rate limit was reached after the allowed retries. | Rerun after the limit resets. |
| `budget-exhausted` | A run budget was exhausted before required work finished. | Rerun; a maintainer may raise the policy limit within its bound. |
| `environment-unavailable` | The execution environment was unavailable. | Rerun when the environment is available. |
| `baseline-unavailable` | A required baseline result was unavailable. | Rerun after the baseline is available. |
| `coverage-missing` | Required platform coverage is missing. | Provide the required platform coverage. |
| `attachment-fetch-failed` | A required attachment could not be fetched: <urls>. | Link the file as a GitHub attachment that can be fetched, then rerun. |
| `policy-unavailable` | The trusted policy could not be read. | Rerun when the policy can be read. |
| `policy-invalid` | The trusted policy is invalid. | Fix the policy on the trusted branch. |
| `llm-not-configured` | A model stage was required, and the policy has no "llm" section. | Configure the "llm" section of the policy. |
| `cancelled` | The run was cancelled before required work finished. | Rerun. |
| `steward-defect` | A steward defect stopped required work. | Rerun; report the defect if it repeats. |
| `stage-incomplete` | Required stages produced no result: <code spans of stage ids>. | A steward version that runs these stages is required; this version checks the submission contract only. |

T-OVF (overflow line, exact): `- <n> more <section noun> are recorded in the evidence: <code span of evidence location>.` with section
nouns `blockers`, `uncertainties`, `executed commands`, `references`, `flagged items`, `items`, `notes`.

T-SUM (check-run summary, Markdown, no tables):

```text
**Outcome:** `<outcome>`

Certifies `<owner>/<repo>` <pull request|issue> `<number>` at head commit `<sha>` (snapshot `<hash>`) under policy revision `<revision>`.
Blockers: <n>. Uncertainties for maintainers: <n>.
Shared head commit with pull requests <prs>.                      (shared head only)
<T-NOTICE lines as plain paragraphs>
Report and evidence: `<evidence location>`
```

(For an issue the head-commit clause is omitted.) Evidence location for local runs: the run directory's path relative to the store
root, as a code span (I9).

E-rules (escaper; the ONLY way submission-derived or API-derived text enters a report or summary):

- E1 Every submission-derived or API-derived value (paths, URLs, field values, PR and issue numbers, category values, refs, commit
  ids, repository names, revision ids, policy-derived model ids) renders as a Markdown code span. GitHub renders no HTML, mention, issue
  reference, or link inside a code span, and a code span creates no cross-reference timeline event.
- E2 Before wrapping: LF and CR are replaced by the two-character sequences `\n` and `\r`; every other C0 and C1 control
  (U+0000–U+001F, U+007F–U+009F), line and paragraph separators (U+2028, U+2029), zero-width and bidi format characters
  (U+200B–U+200F, U+202A–U+202E, U+2060–U+2064, U+2066–U+2069, U+FEFF), and lone surrogates are replaced by `\u{XXXX}` (uppercase
  hex). Then the K31 bound applies.
- E3 The code span fence is one backtick longer than the longest backtick run in the value; one space pads each side when the value
  starts or ends with a backtick or a space (CommonMark strips exactly one).
- E4 Links: fixed text contains only repository URLs built from the validated repository full name and default branch (percent-encoded
  path segments) and evidence locations; a submission-provided URL is never a link (it is a code span). Fixed text contains no `@`, no
  `#` followed by a digit outside a code span, no raw HTML, no `!`, and no emoji.
- E5 `report.md` contains no C0 or C1 control character except LF, and no character listed in E2 (conformance test).

DL (denylist; case-insensitive; whole words and phrases; hyphen and space variants both listed; scanned over (a) every fixed template
string for every key and variant, including M04's `CONTRACT_FINDING_MESSAGES` and contract request texts, and (b) every rendered report
and summary in the fixture corpus with code spans masked, because code spans hold derived data):

- Severity: `critical`, `criticality`, `severe`, `severity`, `serious`, `urgent`, `urgency`, `emergency`, `catastrophic`, `dangerous`,
  `exploitable`, `showstopper`, `show-stopper`, `high priority`, `high-priority`, `low priority`, `low-priority`, `major issue`, `minor
  issue`, `major bug`, `minor bug`, `P0`, `P1`, `P2`, `P3`, `P4`, `sev0`, `sev1`, `sev2`, `sev3`, `sev4`, `sev-0`, `sev-1`, `sev-2`,
  `sev-3`, `sev-4`, `CVSS`.
- Authorship and AI: `AI-generated`, `AI generated`, `AI-assisted`, `AI assisted`, `AI-written`, `generated by AI`, `written by AI`,
  `LLM-generated`, `machine-generated`, `bot-generated`, `ChatGPT`, `human-written`, `written by`, `authored by`, `the author`,
  `author's`, `first-time contributor`, `first-time`, `new contributor`, `newcomer`, `account age`, `drive-by`, `low-effort`, `low
  effort`, `low-quality`, `low quality`, `spam`, `slop`, `lazy`, `careless`, `sloppy`.
- Praise and chatter: `great`, `excellent`, `awesome`, `amazing`, `impressive`, `perfect`, `wonderful`, `fantastic`, `brilliant`,
  `outstanding`, `superb`, `nice`, `good job`, `good work`, `well done`, `kudos`, `congratulations`, `congrats`, `thank you`, `thanks`,
  `appreciate`, `appreciated`, `love`, `beautiful`, `elegant`, `unfortunately`, `sorry`, `apologies`, `happy to`, `glad`, `excited`,
  `please`.
- Character rules: no `!` and no Extended_Pictographic character in fixed text.

APPROVED 2026-09-27: the layout, T-tables, E-rules, and DL as written (binding). `please` STAYS on the denylist; every template above is
written without it, and no template may add it.

### Gate G3 — redaction additions (APPROVED 2026-09-27)

RD-list (15 new built-in detectors, ALL approved, including the five marked "optional extra", which are built in like the others;
appended after the M03 eight in the order below, so `BUILT_IN_DETECTORS` has 23 entries; same `CredentialDetector` shape, flags `g`, JavaScript regex source;
all linear: literal prefix plus one bounded-class quantifier; samples in tests built by concatenation, never committed as literals, so
secret scanning and push protection see no token):

```text
npm-token                    \bnpm_[A-Za-z0-9]{36}\b
pypi-token                   \bpypi-AgE[A-Za-z0-9_-]{50,}
gitlab-token                 \b(?:glpat|gldt|glrt|glptt|glcbt|glimt|glagent|gloas|glsoat|glffct|glft)-[A-Za-z0-9_.-]{20,}
slack-token                  \b(?:xox[abeoprs]|xapp)-[A-Za-z0-9-]{10,}
slack-webhook                \bhttps://hooks\.slack\.com/(?:services|workflows|triggers)/[A-Za-z0-9/_-]{20,}
stripe-key                   \b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}
stripe-webhook-secret        \bwhsec_[A-Za-z0-9]{24,}
google-api-key               \bAIza[0-9A-Za-z_-]{35}
google-oauth-client-secret   \bGOCSPX-[A-Za-z0-9_-]{28}
google-oauth-access-token    \bya29\.[0-9A-Za-z_-]{20,}
huggingface-token            \bhf_[A-Za-z]{34}\b                  (optional extra)
docker-hub-token             \bdckr_pat_[A-Za-z0-9_-]{27,}        (optional extra)
sendgrid-key                 \bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b   (optional extra)
shopify-token                \bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b         (optional extra)
digitalocean-token           \bdo[por]_v1_[a-f0-9]{64}\b          (optional extra)
```

Exact values (EX-rules): every credential value the process resolved (now: the GitHub token from `GH_TOKEN`, `GITHUB_TOKEN`, or `gh
auth token`) is redacted as id `known-secret` in three forms: the raw value, its standard base64, and the standard base64 of
`x-access-token:<value>` (the HTTPS basic-auth form). Values shorter than K35 (8 characters) are not used for literal replacement (they
would corrupt ordinary text; GitHub rejects such tokens before any run starts). No keyword or entropy heuristics.

Coverage at persistence (CV-rules): (1) every string value at every depth of every record (object keys are fixed schema keys and are
not rewritten), including each metrics-event record; (2) `report.md` text and the report record's `rendered` and `check_summary`; (3)
every log file; (4) `manifest.json` string values. Order: assemble records → redact (batched, one worker call per ≤ 8388608 bytes of
input, each under the 2000 ms bound) → re-validate every record with its schema (a record invalidated by a marker fails the write,
code `evidence.redaction-invalidated`) → render report and summary from the redacted records → redact the rendered text → re-check K27
and K28 → write. A redaction failure, oversize input, or timeout fails the evidence write: no committed run directory, no report.
Redaction counts per detector id are recorded in `manifest.json` (G4).

CV-rules consequence REVIEWED AND ACCEPTED by the owner on 2026-09-27 (binding; do not "fix"): when a detector hits a
contributor-controlled string that the snapshot contains (e.g. an attachment URL), redaction changes the stored snapshot, the
submission record's snapshot-hash coupling check fails re-validation, and the evidence write fails with
`evidence.redaction-invalidated`: no committed run directory, no report, exit 2 (I1 publish failure). No stage may bypass, special-case,
or weaken this (no pre-redaction hash, no coupling exemption, no skipping re-validation).

New detectors also extend `policy.credential-value` (a policy string matching any detector is rejected); every committed fixture
policy and the template must stay valid (verified by the existing fixture tests).

APPROVED 2026-09-27 (binding): the ten required detectors and the five optional extras (15 total), EX-rules with the three forms, and
CV-rules, including the `policy.credential-value` side effect.

### Gate G4 — evidence layout and local store (APPROVED 2026-09-27)

Store root: `<evidence-dir>` (default per G5 "Default evidence directory"). Per repository, the subtree `<evidence-dir>/<owner>/<repo>/`
mirrors the layout a later milestone places at the root of the orphan branch or separate repository (names as returned by the
GitHub API `full_name`):

```text
<evidence-dir>/<owner>/<repo>/
  runs/<pr|issue>-<number>/<run-id>/
    manifest.json                 written last; its presence marks a complete run directory
    run.json                      run record
    submission.json               submission record
    policy-revision.json          policy-revision record
    decision.json                 decision record
    report.json                   report record (rendered report and check summary)
    report.md                     rendered report (identical text to report.json "rendered")
    findings/finding-0001.json    one finding record per file, sequence in decision order; directory absent when empty
    executions/execution-0001.json   one execution record per file (none at contract level; directory absent when empty)
    maintainer-actions/action-0001.json   (none in local runs; directory absent when empty)
    logs/steward.txt              redacted, bounded run log (phase transitions, warnings, cause codes)
  metrics/<YYYY-MM>/<run-id>.json JSON array of the run's metrics-event records; month = UTC month of run started_at
```

Run id (G6): Actions runs (later) `<run_id>-<run_attempt>`; local runs `local-<YYYYMMDDTHHMMSSZ>-<8 lowercase hex>` (UTC start time
plus 32 random bits), which is both the run record's `run_id` and the directory name. `finding_id` = `finding-<4-digit sequence>`.

JSON file format (PJ-rules): UTF-8 without BOM; keys at every level in RFC 8785 order (UTF-16 code unit order); 2-space indentation;
every non-empty array and object expanded one member per line; empty `[]` and `{}` inline; numbers and strings serialized per RFC 8785
(ECMAScript `JSON.stringify` rules for well-formed strings); LF line endings; one final LF. Parsing a file and computing
`canonicalJsonHash` yields the record's content hash.

Manifest (`manifest.json`, strict Zod, `manifest_version: 1`, pretty-printed per PJ-rules):

```json
{
  "manifest_version": 1,
  "run_id": "local-20260927T101500Z-3f9a1c2e",
  "run_attempt": 1,
  "store_path": "runs/pr-12/local-20260927T101500Z-3f9a1c2e",
  "created_at": "2026-09-27T10:15:03.120Z",
  "files": [
    { "path": "decision.json", "bytes": 512, "sha256": "sha256:<hex of file bytes>", "record_type": "decision", "content_hash": "sha256:<RFC 8785 hash>" },
    { "path": "logs/steward.txt", "bytes": 300, "sha256": "sha256:<hex>", "record_type": null, "content_hash": null }
  ],
  "metrics": { "path": "metrics/2026-09/local-20260927T101500Z-3f9a1c2e.json", "bytes": 900, "sha256": "sha256:<hex>" },
  "redaction": { "detectors": ["<built-in ids in order>"], "policy_patterns": ["<policy pattern ids>"], "exact_values": 3, "replacements": [{ "id": "github-token", "count": 1 }] }
}
```

`files` lists every file of the run directory except `manifest.json`, sorted by path (code unit order), POSIX separators. Record files
carry both the raw-file `sha256` and the RFC 8785 `content_hash`; other files carry `null` for `record_type` and `content_hash`.

Write protocol (WR-rules): (1) create a staging directory `<evidence-dir>/<owner>/<repo>/runs/.staging/<run-id>/`; (2) write every file
with exclusive create (`flag: 'wx'`), never overwriting; (3) write the metrics file with exclusive create at its final path; (4) write
`manifest.json` last; (5) rename the staging directory to its final path (the commit point; the rename fails if the target exists);
(6) on any failure before (5), remove the staging directory and the metrics file best-effort and report the evidence write as failed.
A final run directory therefore never exists without its manifest. The sum of all bytes (run directory plus metrics file) is at most
`limits.evidence.run_bytes`; logs are truncated first (head and tail kept, marker line `[truncated <n> bytes]`, each file ≤ K33, at most
K34 files); if records and report alone exceed the limit the write fails with `evidence.too-large`. `limits.evidence.write_retries`
applies to the later branch store only; local writes do not retry.

`steward report` verification (VR-rules): the directory contains `manifest.json` that validates; every listed file exists with matching
`bytes` and `sha256`; no unlisted file exists (staging leftovers are not inside the run directory); every record file validates against
its schema and matches its `content_hash`; `report.json` `rendered` equals `report.md`; the metrics file, resolved from the store root
three levels above the run directory, matches when present (absent → warning `report.metrics-missing`; mismatched → invalid).

APPROVED 2026-09-27 (binding): the layout, run-directory and file names, `manifest.json` shape, metrics partition
`metrics/<YYYY-MM>/<run-id>.json`, PJ-rules, WR-rules, and VR-rules as written.

### Gate G5 — CLI conventions and commands (APPROVED 2026-09-27)

Uniform conventions (CV-list; apply to `policy`, `preflight`, `screen`, `report`, and every later command):

| Rule | Value |
| --- | --- |
| Flags | Long flags only. `help` and `--help` print usage; `-h` is REMOVED (I18). |
| Output | Text lines on stdout; with `--json`, exactly one JSON object on stdout with `schema_version: 1`, also on failure, printed as one line of compact JSON (`JSON.stringify(value)` without indentation, as `policy` and `preflight` do at 6d2ea64) followed by LF. The multi-line J-SCREEN and J-REPORT blocks below are laid out for reading only. |
| Warnings | Text mode: `warning <code>: <message>` on stderr. JSON mode: the `warnings` array only (stderr stays empty). |
| Errors | Text mode: `error <code> -: <message>` on stderr (M04 format). JSON mode: the `errors` array. |
| Token | Unchanged: `GH_TOKEN`, then `GITHUB_TOKEN`, then `gh auth token`; never stored or printed; redacted from evidence (G3). |
| Exit 0 | Success, or outcome/disposition `pass`/`met`. |
| Exit 1 | `needs-changes`, `uncertain`, or invalid input (an invalid policy or policy file; stored evidence that fails verification). |
| Exit 2 | Usage, environment, GitHub, or git failure (including evidence write failure, an unreadable run directory, a missing or invalid published policy for `screen`). |
| Exit 3 | `inconclusive`, in every command. `steward preflight`: disposition `inconclusive` moves from 2 to 3 (`PREFLIGHT_EXIT_BY_DISPOSITION`, `PreflightExitCode`, tests, docs). |

`steward screen` syntax (approved):

```text
steward screen (--issue <number> | --pr <number>) [--repo owner/name] [--policy-file <path>] [--evidence-dir <dir>] [--json]
```

- Exactly one of `--issue`, `--pr`; `<number>` a positive decimal integer without sign or leading zero (≤ 2147483647); `--repo`
  validated like preflight; upstream = `--repo`, else the `upstream` remote, else `origin` (M04 discovery); no GitHub remote and no
  `--repo` → exit 2.
- Policy: without `--policy-file`, the policy on the upstream default branch through the GitHub API source (authoritative revision =
  tree id; ref and commit recorded); no published policy → exit 2 `screen.policy-missing` (message names `--policy-file`); invalid
  published policy → exit 2 `screen.policy-invalid` with validation errors (as preflight); the default checklist is NEVER used by
  `screen`. With `--policy-file`, the local file (revision `local:<sha256>`, non-authoritative); invalid → exit 1
  `screen.policy-file-invalid` with validation errors; unreadable → exit 2.
- Pre-run failures (I1) create no run directory and print no report. After `gate` succeeds the run exists; its outcome maps to exit
  0/1/3; a `publish` failure (decision, rendering, redaction, evidence write) exits 2 `screen.evidence-write-failed` (or
  `steward.internal-error`) and prints no report.
- Text output (stdout, in order): `local run: not the repository's official screening result`; `non-authoritative: screened under a
  local policy file (<revision>)` (local policy only); `policy: <owner>/<repo> <ref> commit <sha> revision <tree id>` or `policy: local
  file <path> revision <local:...>`; `submission: <issue|pull request> <number> (<owner>/<repo>)`; `outcome: <outcome>`; one line per
  inconclusive cause `cause: <cause>`; one line per request `request R<n>: <text>`; `run directory: <absolute path>`. All derived text
  passes `escapeTerminalText`.
- Authoritative flag rule (applies to J-SCREEN and J-REPORT; binding). The top-level `authoritative` states whether the POLICY
  REVISION the run used is authoritative, nothing else: it equals `policy.source == "trusted-branch"` (J-SCREEN) and the stored
  policy-revision record's `authoritative` (J-REPORT; M03 `policyRevisionRecord` sets it false exactly for `local-file` revisions).
  `local_run` is always `true` in this milestone and carries the separate "not the official result" meaning. `notices` holds, in order:
  always the local-run notice text line; then the non-authoritative notice text line exactly when `authoritative` is `false`. The notice
  strings are the unescaped text-mode lines: `local run: not the repository's official screening result` and `non-authoritative:
  screened under a local policy file (<revision>)`. A trusted-branch run therefore has `"authoritative": true`, exactly one notice, and
  no non-authoritative line in any surface; a local-file run has `"authoritative": false` and both notices.
- `--json` object (J-SCREEN; example: a complete bugfix PR screened under `--policy-file`; laid out for reading, printed compact):

```json
{
  "schema_version": 1,
  "command": "screen",
  "local_run": true,
  "authoritative": false,
  "notices": [
    "local run: not the repository's official screening result",
    "non-authoritative: screened under a local policy file (local:<sha256 hex>)"
  ],
  "repository": "owner/name",
  "submission": { "type": "pull_request", "number": 12 },
  "policy": { "source": "local-file", "revision": "local:<sha256 hex>", "ref": null, "commit": null, "path": "<path as given>" },
  "run": { "run_id": "local-20260927T101500Z-3f9a1c2e", "run_attempt": 1, "directory": "<absolute path>", "snapshot_hash": "sha256:<hex>" },
  "outcome": "inconclusive",
  "causes": [{ "cause": "stage-incomplete", "code": "pipeline.stage-incomplete", "subjects": ["references", "claim"] }],
  "findings": [{ "finding_id": "finding-0001", "code": "submission.trusted-path-change", "severity": "advisory", "field": null, "subjects": [".github/workflows/ci.yml"] }],
  "requests": [],
  "warnings": [],
  "errors": []
}
```

  Trusted-branch variant of the same run (only these members differ): `"authoritative": true`, `"notices": ["local run: not the
  repository's official screening result"]`, `"policy": { "source": "trusted-branch", "revision": "<40-hex tree id>", "ref": "<default
  branch>", "commit": "<40-hex sha>", "path": null }`. Array item shapes: `warnings` items `{ "code", "message" }`; `errors` items
  `{ "code", "path", "message" }` (M04 shape); `requests` items `{ "request_id", "text" }`. (`policy.source` is `trusted-branch` or
  `local-file`; `ref`/`commit` null for a local file, `path` null for the trusted branch; any unknown part is `null`. The `subjects` of
  `stage-incomplete` follow I4 for the policy in use; the example shows two.)

`steward report` syntax: `steward report <run-dir> [--json]` (one positional argument: a run directory path). It verifies per VR-rules
and prints `report.md` byte-for-byte on stdout (text mode), or (J-REPORT; example: a stored local-file run; laid out for reading,
printed compact; top-level `authoritative`, `policy.authoritative`, and `notices` follow the "Authoritative flag rule" above, so both
flags are equal and a trusted-branch run shows `true` in both with the single local-run notice):

```json
{
  "schema_version": 1,
  "command": "report",
  "local_run": true,
  "authoritative": false,
  "notices": [
    "local run: not the repository's official screening result",
    "non-authoritative: screened under a local policy file (local:<sha256 hex>)"
  ],
  "run": { "run_id": "...", "run_attempt": 1, "directory": "<absolute path>", "started_at": "...", "finished_at": "..." },
  "submission": { "repository": "o/r", "type": "pull_request", "number": 12, "snapshot_hash": "...", "target_branch": "...", "head_commit": "...", "base_commit": "..." },
  "policy": { "revision": "local:<sha256 hex>", "authoritative": false, "source": "local-file" },
  "outcome": "needs-changes",
  "causes": [],
  "report": "<report.md text>",
  "check_summary": "<summary text>",
  "integrity": { "manifest": "verified", "files": 9, "metrics": "verified" },
  "warnings": [],
  "errors": []
}
```

`steward report` exit (R-A APPROVED 2026-09-27; binding):

- R-A (APPROVED; literal reading of "3 inconclusive in every command"): the stored run's outcome maps like `screen` (0 `pass`, 1
  `needs-changes` or `uncertain`, 3 `inconclusive`; `overridden` by its effective outcome; `superseded` 1); evidence that fails
  verification → 1 `report.evidence-invalid`; missing or unreadable directory, usage → 2.
- R-B (REJECTED; do not implement): 0 whenever the report renders, whatever the outcome; 1 invalid evidence; 2 usage or unreadable.

Default evidence directory (store root) when `--evidence-dir` is absent:

| OS (`process.platform`) | Path |
| --- | --- |
| `win32` | `%LOCALAPPDATA%\patch-steward\evidence`; if `LOCALAPPDATA` is unset or relative: `<home>\AppData\Local\patch-steward\evidence` |
| `darwin` | `<home>/Library/Application Support/patch-steward/evidence` |
| other | `$XDG_DATA_HOME/patch-steward/evidence` when `XDG_DATA_HOME` is absolute, else `<home>/.local/share/patch-steward/evidence` |

`<home>` = `os.homedir()`; unresolvable → exit 2 `screen.evidence-dir-unavailable`. `--evidence-dir` may be any directory; when it
resolves inside the git work tree of the current directory, warning `screen.evidence-inside-checkout` (I26). The directory is
created if absent.

APPROVED 2026-09-27 (binding): CV-list, the `screen` syntax and behavior, J-SCREEN, J-REPORT (with the "Authoritative flag rule"), R-A,
and the default directories. ADR-0060's status becomes `superseded by ADR-0066`.

### Gate G6 — local-run identity and record-schema changes (APPROVED 2026-09-27)

- G6a `run_id` in every record that carries it (run, finding, decision, report, execution-record, maintainer-action, metrics-event run
  subject) is widened from a positive integer to a positive integer (Actions run id) OR a string matching
  `^local-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$` (local run). One shared `recordRunIdSchema` in `records/common.ts`. Local runs have
  `run_attempt: 1`. APPROVED: `schema_version` stays 1 in every record (a widening: every existing record stays valid with unchanged
  meaning; architecture §9 "an optional addition keeps the version"); the §12.1 "Record schema version" constant stays 1. REJECTED: an
  increment to `schema_version: 2`.
- G6b Finding record gains OPTIONAL keys (additive, version 1): `code` (identifier, e.g. `submission.field-missing`), `detail`
  (identifier or null, e.g. the attachment rule), `subjects` (record list of text), `request_id` (identifier or null).
- G6c Decision record gains OPTIONAL key `causes`: record list of `{ cause: FailureCause, code: identifier, message: text, subjects:
  list of text }`.
- G6d Submission record: an issue record may carry `issue_kind: null` exactly when `template` is null (an unstructured issue); today
  it is rejected, so an unstructured issue has no record and could not be persisted. APPROVED: this widening keeps version 1.
- G6e `FAILURE_CAUSES` gains `stage-incomplete` (G7); `FailureCause` consumers stay exhaustive.
- G6f Snapshot `policy_revision` (both the issue and the pull request snapshot schemas in `packages/core/src/submission/snapshot.ts`)
  is widened from `recordCommitIdSchema` to `policyRevisionIdSchema` (`records/common.ts`: 40 or 64 lowercase hex, or
  `local:<64 lowercase hex>`). Reason: `steward screen --policy-file` passes the `local:<sha256>` revision as
  `CaptureContext.policyRevision`; the M04 schema rejects it, so every local-policy run fails capture before `gate` (I1 pre-run exit
  2), contradicting DoD 11. `snapshot_version` stays 1 and every `schema_version` stays 1 (a widening: every existing snapshot stays
  valid, and the `snapshotHash` of a git-revision snapshot is unchanged because its canonical JSON is unchanged). The submission
  record's embedded `snapshot` follows the widened schema. The submission record's `policy_change.proposed.revision` stays
  `recordCommitIdSchema` (a proposed policy is always a git tree). `snapshot.test.ts`'s rejection case for `local:<64 hex>` becomes an
  acceptance test titled `snapshot accepts a local policy revision` (issue and PR); `local:abc` and `HEAD` stay rejected.
- No other record or snapshot change: the run record's provider fields record the policy's configured provider and model (I25); the
  report record's `bound` is unchanged.

APPROVED 2026-09-27 (binding): G6a–G6f with `schema_version` staying 1 (G6f approved by amendment 2026-09-27).

### Gate G7 — contract-level outcome (design question Q1; APPROVED 2026-09-27: Option A)

Conflict: architecture §8 Stages row says "reference verification and claim validation always run"; SP13 row 9 allows `pass` only
when "All required checks [are] satisfied"; SP19 step 8 enforces never-pass for missing required work. At contract level no stage
exists, so a met contract with required stages unrun must not pass. None of the 19 closed causes names "a required stage produced no
result" (`coverage-missing` means platform coverage).

- Option A (APPROVED 2026-09-27; binding): add the closed cause `stage-incomplete` ("a required stage produced no result": not run, skipped, or not
  available in this steward version). The decision module computes the required-stage plan (I4) and any required stage without a
  result is a row-6 cause (`inconclusive`), retaining independently established findings. Consequence: at contract level `steward
  screen` ends `needs-changes` (row 2 or 3) or `inconclusive` (row 6); `uncertain` and `pass` are reachable only in decision-table
  tests until stages exist. The cause stays useful later (a skipped job in T1). Requires SP19's cause list, architecture §12, the user
  manual, and an ADR.
- Option B (REJECTED): reuse `steward-defect` for missing stages (misleading: nothing is defective).
- Option C (REJECTED): let a met contract `pass` with a report note listing unrun stages (violates invariant 4 and §8).

### I-list — interpretations (APPROVED 2026-09-27, all of I1–I29; binding; every "Rejected alternative" stays unimplemented)

- I1 Run existence boundary (mirrors T1 commitment). A local run exists once `gate` succeeds: policy loaded and valid, submission
  captured (M04 `captureIssue`/`capturePullRequest`), snapshot hashed, contract checked. Failures before that (usage, upstream, token,
  repository or submission unreadable, policy missing or invalid, capture failure) create nothing and exit 2 (1 for an invalid
  `--policy-file`). Failures in `intake`, `execute`, `assess`, or at their handoffs are recorded causes and end `inconclusive` (exit 3).
  A failure inside `publish` (decision, rendering, redaction, evidence write, commit) yields no committed run directory, no report, and
  exit 2 (T1 analog: a failed `publish` publishes nothing). Rejected alternative: record pre-gate failures as `inconclusive` runs.
  Note (G6f): a valid `--policy-file` is NOT a pre-run failure; capture receives its `local:<sha256>` revision and the snapshot accepts
  it, so a local-policy run reaches `gate` and exists like a trusted-branch run.
- I2 `screen` never falls back to the default checklist; a missing or invalid published policy is a pre-run exit 2 (G5).
- I3 Early exits: `gate` hands off directly to `publish` when the contract disposition is `needs-changes` or `inconclusive` (contract
  gate first, no spending); `met` and `uncertain` continue to `intake`.
- I4 Required-stage plan (conservative; later milestones refine without loosening): every issue and PR requires `references` and
  `claim`; a defect issue adds `reproduction`; a PR adds `stages.per_category.<c>` for every category in the contract's plausible set
  (all six when the set is empty). New vocabulary `PIPELINE_STAGES = ['references', 'claim', 'reproduction', 'fix-verification',
  'regression', 'challenge']`. A stage result is `complete` or `unavailable` (with a cause); a required stage with neither → cause
  `stage-incomplete` (G7), subjects = the stage ids in `PIPELINE_STAGES` order.
- I5 Local decision inputs: freshness `current`, capacity `available`, admission `not-required` (SP13 step 4, caps, and admission are T1;
  local runs never reach a waiting state). The decision record is written only for terminal outcomes; waiting states are persisted by
  the later GitHub-hosted skeleton.
- I6 Advisory and speculative findings render only as "Note:" lines in the Classification section (T-FIND note column), never as
  blockers or uncertainties, and never with a severity word. SP13 step 2's section order is unchanged. Rejected alternative: a new
  "Notes" section (changes SP13's fixed order).
- I7 Requests: request ids `R1`, `R2`, … per run in the order of blocking findings (contract findings first, then stage findings);
  the request text is the report template's plain rendering (T-FIND); the decision record stores `{request_id, text}`; the finding
  record's `request_id` links them. M04's contract request texts stay unchanged for `steward preflight`. Stable cross-run request ids
  belong to the author-response ledger milestone.
- I8 Escaping per E-rules; issue and PR numbers in reports are always code spans (no autolink, no cross-reference events: P08).
- I9 Evidence links: for local runs a code span of the path relative to the store root (a run directory, or a file inside it such as
  `findings/finding-0001.json` relative to the run directory). URLs arrive with the branch store. The report module takes an
  `evidenceLocation(relativePath)` function so the later store supplies URLs without changing templates.
- I10 Unstructured issues get a submission record (G6d); every run has exactly one submission record.
- I11 Handoff records are validated in process and not persisted in the run directory; artifact persistence belongs to the
  GitHub-hosted skeleton.
- I12 No maintainer attribution lookup (no `GET /user`); the T-NOTICE local-run line is the attribution in this milestone.
  Attribution by login arrives with publication.
- I13 Closed issues and PRs are screened like open ones (the snapshot has no state); admission of closed submissions is a publication
  concern.
- I14 Steward version: `packages/core/src/version.ts` reads core's own `package.json` (`new URL('../package.json', import.meta.url)`,
  same relative path from `src/` and `dist/`) once, validates `version` against a semver pattern, and exposes `stewardVersion()`;
  failure → `steward-defect` (pre-run exit 2). A test asserts root, core, and cli versions are equal. Rejected alternative: a hand-kept
  constant (breaks at every release bump).
- I15 Clock and ids: an injectable `Clock` (`now(): Date`) and `RandomSource` (`hex(bytes)`), defaulting to the system clock and
  `node:crypto.randomBytes`; tests inject both, so run ids, timestamps, and golden outputs are deterministic.
- I16 Every phase runs under a timeout of `limits.stage_seconds` (tests inject shorter); a timeout is cause `budget-exhausted`, code
  `pipeline.phase-timeout`.
- I17 JSON-mode warnings only in the `warnings` array; text-mode warnings on stderr (existing M03/M04 behavior, now uniform).
- I18 `-h` is removed from `runCli` (long flags only); `help` and `--help` stay. Rejected alternative: keep `-h` as a courtesy alias.
- I19 Fixture approach: no run directory is committed (the `.gitignore` entry `logs`, Prettier's JSON and Markdown rewriting, and
  `core.autocrlf` would each corrupt byte-exact evidence and manifests). Runs are generated in `os.tmpdir()` from committed inputs;
  golden reports are committed as `.txt` and compared after CRLF→LF normalization; tokens and control characters are built in test code.
  Rejected alternative: commit sample run directories plus `.gitattributes -text`, a `.gitignore` negation, and a `.prettierignore` entry.
- I20 `steward report` exit mapping: R-A (G5).
- I21 Evidence write atomicity per WR-rules (staging directory plus rename commit point; metrics file exclusive create; best-effort
  cleanup on failure).
- I22 GitHub budget: the policy read uses the bootstrap budget (K19: 20 requests, 2 retries); capture and all later reads use a fresh
  `limits.github.*` budget from the loaded policy; remaining requests travel in every handoff.
- I23 The §10 mapping functions are pure and not used for writes in this milestone; `publish` still renders and stores the check-run
  summary text in the report record (no check exists locally).
- I24 Metrics events per run (subject `run`): `state-transition` `null` → `screening` at `gate` completion; one `latency` event per
  executed phase (`stage` = phase name, `seconds`); one `cost` event (`model_calls: 0`, `tokens: null`, `ai_credits: null`,
  `container_seconds: 0`); `state-transition` `screening` → `<outcome>` at `publish`.
- I25 Run record provenance for local contract-level runs: `owned_check_id: null`; `commits` `{base: PR base sha or null, head: PR head
  sha or null, group: null}`; `provider` and `requested_model` = the policy's `llm.provider` and `llm.model`, or null without an `llm`
  section; `reported_model`, `adapter_version`, `generation`, `runner_identity` null; `mode` = contract `effective_mode`; `budget`
  `{model_calls: 0, tokens: null, ai_credits: null, container_seconds: 0, executions: 0, github_requests: <used>, retries: <used>}`.
- I26 `--evidence-dir` inside the current git work tree is allowed with warning `screen.evidence-inside-checkout`; the default never is.
- I27 No GitHub writes: a test over the whole `screen` path asserts every request through the injected fetch is `GET` to
  `https://api.github.com` (plus attachment fetches through the M04 transport).
- I28 Author responses: always the empty list (the ledger is later work).
- I29 Rounds: the runner supports `execute-N`/`assess-N` pairs up to `stages.challenge_rounds` (hard max 3); `assess` requests a round by
  returning a non-null plan; at contract level no round runs. A request beyond the maximum is cause `budget-exhausted`, code
  `pipeline.rounds-exhausted`.

### Decision table (implementation contract; SP13 step 1 verbatim rows, numbered for tests)

| Row | Condition (SP13) | Result |
| --- | --- | --- |
| 1 | Snapshot changed since `gate`, or a newer committed owner exists | `superseded` |
| 2 | Shared PR head commit (`submission.shared-head`) | `needs-changes` |
| 3 | Deterministic submission contract fails before spending (any other blocking finding with stage `contract`) | `needs-changes` |
| 4 | Capacity cap reached | waiting state `queued` (non-outcome) |
| 5 | Inference admission required | waiting state `awaiting-approval` (non-outcome) |
| 6 | Required steward work unavailable (any cause: contract inconclusive causes, phase failures, handoff failures, `stage-incomplete`, unavailable required requirements) | `inconclusive`; findings retained |
| 7 | Required maintainer decision unresolved (any `uncertain` finding) | `uncertain` |
| 8 | Required contributor evidence missing (required requirement `missing`) or a blocking finding from a later stage | `needs-changes` |
| 9 | Otherwise: every required stage complete, every required requirement satisfied, only `advisory`/`speculative` findings remain | `pass` |

Decision input (pure, no I/O): `freshness` (`current`, `snapshot-changed`, `newer-owner`), `capacity` (`available`, `cap-reached`),
`admission` (`not-required`, `admitted`, `required`), `findings` (each with `stage`, `severity`, `code`), `causes`, `requiredStages`
with results, `requirements` (`{id, required, status: satisfied, missing, unavailable}`). Result: `{kind: 'outcome', outcome, row,
contributing_findings, unmet_requirements, requests, causes}` or `{kind: 'waiting', state, row}`; the outcome type excludes
`overridden` (maintainer actions are later work). Rules: advisory and speculative findings never change the result; an optional
requirement in any status never changes the result; the function returns `pass` only through row 9 (type-level: `pass` is constructed
in exactly one place, asserted by a test that greps the module).

### §10 mapping rules (pure functions; exceptions first)

Check conclusion `mapCheck(input)` → `none`, `pending`, or `complete` with conclusion `success`, `failure`, `neutral`,
`action_required`, `cancelled`, plus summary kind (`outcome`, `not-enforced`). Input: submission type, category mode (`observe`,
`advise`, `enforce`), repository gate active, check required, any category enforced, state (outcome or waiting state), shared head,
override effective outcome (for `overridden`). Order:

1. Issue, or repository gate inactive and no required check → `none`.
2. `superseded` → `complete cancelled` (own pending check only; never `neutral` or `skipped`).
3. Waiting state → `pending` (stays `in_progress`).
4. Shared head → `action_required` when the check is required or any category is enforced, else `failure`; any override is ignored;
   never `success` or `neutral`.
5. Category mode `observe` → `neutral`, summary `not-enforced`.
6. `advise` → `neutral`, summary `outcome`.
7. `enforce` → `pass` and override-to-pass `success`; `needs-changes` and override-to-needs-changes `failure`; `uncertain` and
   `inconclusive` `action_required`.

Lifecycle label `mapLabel(input)`: `observe` → no label; waiting → `queued` or `awaiting-approval`; in progress → `screening`;
`needs-changes` (incl. override to it) → `awaiting-author`; `uncertain`, `inconclusive` → `triage`; `pass` (incl. override to pass) →
`pass`; `superseded` → no change. Label names come from `STATUS_LABEL_DEFAULTS` and the policy's `labels.status` overrides.

### Phase sequence and handoffs (implementation contract)

- Phases: `gate` → `intake` → `execute` → `assess` → (`execute-N` → `assess-N`) × up to `stages.challenge_rounds` → `publish`, in one
  process. Local implementations: `gate` = policy load + capture + contract + required-stage plan; `intake`, `execute`, `assess` =
  pass-throughs that produce no stage result and no model call or execution; `publish` = decision (SP13 step 1), report and summary
  (step 2), evidence write (step 3, SP18 step 1 local).
- Handoff record (strict Zod, `handoff_version: 1`, serialized canonical size ≤ K37): `phase` (producer), `run {run_id, run_attempt}`,
  `snapshot_hash`, `policy_revision`, `round` (0 for `execute`/`assess`; N for pair N), `budget_remaining {github_requests, model_calls,
  tokens (nullable), ai_credits (nullable), executions, execution_seconds, rounds}`, `early_exit` (null or `contract-needs-changes`,
  `contract-inconclusive`), `findings` (finding data so far), `causes`, `stage_results`, `next_round_plan` (null at contract level).
- Boundary validation (every handoff): schema; `run`, `snapshot_hash`, `policy_revision` equal to `gate`'s; `round` follows the sequence
  and never exceeds the maximum; every budget field ≥ 0 and ≤ its previous value; `findings`, `causes`, and `stage_results` are
  append-only (earlier items unchanged). A violation adds cause `steward-defect`, code `pipeline.handoff-invalid` (or
  `pipeline.handoff-binding` for run, snapshot, revision, or round mismatch) and jumps to `publish` with the last valid state.
- Initial budget from the policy: `github_requests` = `limits.github.requests_per_run` minus capture use; `model_calls` =
  `llm.limits.model_calls_per_run` or 0 without `llm`; `tokens` = `llm.limits.tokens_per_run` for `openai-compatible` else null;
  `ai_credits` = `llm.limits.ai_credits_per_run` for `copilot-sdk` else null; `executions` = `limits.execution.executions_per_run`;
  `execution_seconds` = `limits.execution.run_execution_seconds`; `rounds` = `stages.challenge_rounds`.

### Additional hard-only constants (gate G1 continued; APPROVED 2026-09-27 as written)

| Row | Constant | Value |
| --- | --- | --- |
| K33 | Evidence log file maximum | 1048576 bytes |
| K34 | Evidence log files per run | 16 |
| K35 | Exact-value credential minimum length | 8 characters |
| K36 | Files per run directory | 4096 |
| K37 | Handoff record maximum (canonical JSON) | 8388608 bytes |

### Module layout (recommended; the decomposer may refine names, not responsibilities)

- `packages/core/src/decision/`: `table.ts` (decision table), `stages.ts` (required-stage plan), `mapping.ts` (§10 check and label rules).
- `packages/core/src/report/`: `escape.ts` (E-rules), `templates.ts` (T-tables), `denylist.ts` (DL), `render.ts` (report), `summary.ts`
  (check summary), `caps.ts` (K27–K32 table and static budget).
- `packages/core/src/evidence/`: `pretty-json.ts` (PJ-rules), `assemble.ts` (records from the pipeline result), `redact-records.ts`
  (CV-rules), `manifest.ts`, `layout.ts` (paths, run ids), `local-store.ts` (WR-rules), `verify.ts` (VR-rules, loader), `metrics.ts`,
  `logs.ts`.
- `packages/core/src/pipeline/`: `handoff.ts`, `budget.ts`, `phases.ts`, `runner.ts`, `screen.ts` (`screenSubmission(deps)`: the whole
  local run, injectable GitHub fetch, attachment transport, clock, random, store root).
- `packages/core/src/version.ts`, `packages/core/src/clock.ts`; `redaction/detectors.ts` (RD-list), `redaction/redact.ts` (batched API,
  EX-rules); bound constants in `policy/bounds.ts`; vocabulary additions in `vocabulary.ts`; record changes in `records/*`.
- `packages/cli/src/`: `conventions.ts` (exit codes, output helpers), `upstream.ts` (shared upstream discovery extracted from preflight
  without behavior change), `evidence-dir.ts`, `screen-args.ts`, `screen-command.ts`, `screen-output.ts`, `report-command.ts`,
  `report-output.ts`; `cli.ts` dispatch and usage gain `screen` and `report`; `preflight-command.ts` exit change.

### Fixture corpus (root `fixtures/`; Prettier-clean `.json`, byte-exact `.txt`)

- `fixtures/reports/` golden `report.md` renderings as `.txt` (deterministic clock and random): issue unstructured (needs-changes);
  issue complete defect (inconclusive, `stage-incomplete`); PR field-missing plus attachment violation (needs-changes); PR
  execution-sensitive change (inconclusive with the uncertainty retained); PR shared head (needs-changes); local-policy run
  (non-authoritative notice); overflow (more blockers than K29, overflow line); hostile derived text (escaped). Golden check summaries
  likewise.
- `fixtures/submissions/` additions: report-hostile bodies (`@mention`, `#1`, raw HTML such as `<img src=x onerror=alert(1)>`,
  `[x](javascript:alert(1))`, backtick runs, Markdown headings and lists inside values, `${{ secrets.GITHUB_TOKEN }}`); control, bidi,
  and zero-width characters built in test code.
- `fixtures/screen/expectations.json` scenarios (inputs: recorded or synthetic GitHub responses, policy variant, token; expected
  outcome, finding codes, causes, exit status, run directory present or not): complete defect issue → inconclusive `stage-incomplete`,
  exit 3; unstructured issue → needs-changes, exit 1; complete bugfix PR → inconclusive, exit 3; PR field missing → needs-changes, exit
  1; PR execution-sensitive → inconclusive with retained uncertainty, exit 3; shared head → needs-changes, exit 1; required attachment
  fetch failure → inconclusive `attachment-fetch-failed`, exit 3; linked-issue read unavailable → inconclusive `github-unavailable`,
  exit 3; published policy (synthetic repository, authoritative) versus `--policy-file` (non-authoritative); no published policy →
  exit 2, no run directory; invalid `--policy-file` → exit 1, no run directory; unwritable evidence directory → exit 2, no report;
  sentinel token → absent from every stored file.
- Synthetic GitHub responses for complete bodies are built in test code from committed `.txt` bodies or committed under
  `fixtures/github/synthetic/` with a provenance line in `fixtures/README.md`; `fixtures/README.md` lists every new entry (no planning ids).

### Conformance checks (`packages/core/src/conformance/`)

- `invariant-4.test.ts` (NEW, first check; every later milestone extends it): for each boundary (`gate→intake`, `intake→execute`,
  `execute→assess`, `assess→execute-1`, `execute-N→assess-N`, `assess(-N)→publish`) and each injection (phase throws; phase returns a
  typed failure for every `FailureCause`; handoff fails its schema; run, attempt, snapshot, or policy-revision mismatch; round out of
  sequence or over the maximum; budget increased or negative; findings or causes dropped; phase timeout; required stage result
  missing), the outcome is never `pass`; titles `invariant 4: <boundary> <injection> never yields pass`. Inside `publish` (decision,
  render, cap guard, redaction failure, redaction timeout, schema re-validation, file write, metrics write, manifest write, commit
  rename): no committed run directory, no report text returned, and the command path exits 2; titles `invariant 4: publish <step>
  failure yields no report`, including exactly `invariant 4: failed evidence write yields no report`. A combinatorial test over
  decision inputs asserts `pass` only when row 9 holds.
- `invariant-6.test.ts` (extended): DL scan of every template key and variant and of every golden report and summary with code spans
  masked; report bytes identical when author login, association, account age, and AI-disclosure text vary in the recorded responses;
  titles `report wording has no severity, authorship, or praise term` and `report ignores authorship`.
- `invariant-7.test.ts` (extended): every RD-list detector has a sample and redacts it; exact-value forms redact; a sentinel token
  passed as the resolved credential appears in no file of the run directory or metrics file; redaction timeout and failure fail the
  write; K27/K28 and `limits.evidence.run_bytes` enforced; static report budget ≤ K27.
- `invariant-8.test.ts` (extended): handoffs bound to run, attempt, snapshot, revision, and round (mismatch never passes); the report's
  bound identifiers equal the `gate` snapshot and the stored submission record; a local-policy run's snapshot, submission record, run
  record, and report `bound` all carry the same `local:<sha256>` revision (G6f).
- `never-pass*.test.ts`: every new failure-code union (pipeline, evidence, report, screen, report-command codes) in compile-time
  exhaustive tables mapping to non-pass. `zero-execution.fixture.test.ts`: the `screen` and `report` paths spawn only allowlisted git
  read commands and `gh auth token`, make no model call, and import no runner or LLM module.

### ADR inventory (MADR; `Status: accepted`; `Date` = gate approval date `2026-09-27`; `Deciders: project owner`; `Source` = governing location; no planning ids; More Information "The project owner decided this on September 27, 2026.")

APPROVED 2026-09-27 (binding): exactly 9 new records, ADR-0062–ADR-0070; `docs/adr/README.md` Records table 61 → 70 rows; ADR-0060's
status becomes `superseded by ADR-0066` (its README row too); no other existing record changes.

| ADR | Title | Records |
| --- | --- | --- |
| ADR-0062 | Report caps as hard-only constants | D1, G1 K27–K32 |
| ADR-0063 | Report wording, escaping, and the denylist | D2, G2, I6, I8 |
| ADR-0064 | Evidence run directory, record files, and the local store | D3, G4, I9, I19 (fixture policy only as a consequence), I21, K33–K36 |
| ADR-0065 | Redaction at persistence: resolved credentials and prefixed token formats | D4, G3 |
| ADR-0066 | Uniform CLI conventions and exit statuses | D5 conventions, I17, I18; supersedes ADR-0060's exit-status rule |
| ADR-0067 | `steward screen` and `steward report` commands | D5 commands, G5, I1, I2, I20, I26 |
| ADR-0068 | Local run identity | G6a, G6f, I14, I15 |
| ADR-0069 | Required stages never pass incomplete | G7 option A, I4, decision-table contract |
| ADR-0070 | Phase handoff records | Phase sequence and handoffs, I3, I11, I16, I29, K37 |

### Documentation change inventory (governing document first; persistence and deferred rules apply)

- `docs/architecture.md`: "Status" paragraph (delivered scope); §6.2 Decision, Report, Evidence rows ("Implemented; local runs only"
  wording like the Submission row); §6.3 Evidence store row (local store delivered; branch and repository stores not yet) and Clock and
  ids row (local run ids); §6.5 table rows and new syntax and exit-status paragraphs for `steward screen` and `steward report`, one
  paragraph stating the uniform CLI conventions, and the preflight paragraph's exit statuses (`inconclusive` → `3`); §9 (run id forms,
  finding and decision optional keys, unstructured issue records, evidence file format and manifest); §10 (state that the mappings are
  implemented as rules; no behavior change); §11 (run-directory layout, file names, manifest, metrics partition, write protocol,
  redaction coverage incl. resolved credentials and prefixed formats); §12 failure classes gain "a required stage that produced no
  result"; §12.1 hard-only constants gain K27–K37 by name; §13 "Credential leakage in logs" mitigation names exact-value redaction; §15
  first bullet removed.
- `docs/processes.md`: "Status" paragraph; SP05 step 5 and failure handling (`inconclusive` exits `3`); SP13 steps 1–3 (required stages
  and `stage-incomplete`, advisory notes in Classification, report caps and escaping stated without "length cap" wording changes beyond
  what exists); SP18 step 1 (layout, write protocol, redaction coverage); SP19 step 8 and the closed cause vocabulary (+`stage-incomplete`);
  SP20 steps 1–3 (syntax, policy sources, evidence directory, non-authoritative labeling, contract level only). "Addresses" unchanged.
- `docs/whitepaper.md` §8 only if its report wording contradicts the delivered format; §9–§14 (§14 "Implemented so far"; decisions
  paragraph for ADR-0062–ADR-0070; open-decision list synced with §15).
- `README.md` Status; `CLAUDE.md` Project state, Commands (source-run lines for `screen` and `report`; preflight exit statuses incl.
  `3`), invariants reviewed (change only if one is restated wrongly).
- User manual: `commands.md` (new "`steward screen` (Available)" and "`steward report` (Available)" sections with syntax, options,
  output, JSON fields, exit statuses, examples; a "Conventions" subsection; preflight exit table `inconclusive` under `3`; the Proposed
  table keeps `steward init` and `steward replay`; the callout keeps only still-undefined items: publication flag, `init`, `replay`,
  preflight mandatory commands and self-review); `usage.md` ("Local screening and replay": `steward screen` available at contract
  level; callout keeps publication flag, dataset schema, replay arguments; "Prepare a submission" exit statuses incl. `3`);
  `configuration.md` ("### Evidence": full built-in detector list, exact-value redaction, coverage; "## Evidence and visibility":
  local store layout and default directories, report caps); `troubleshooting.md` (`screen` and `report` exit statuses and error codes,
  `stage-incomplete`, evidence write failure, verification failure); `overview.md` (outcomes table: `inconclusive` includes a required
  stage without a result; execution options: local screening at contract level).
- `docs/adr/0060-steward-preflight-command.md` status line → `- Status: superseded by ADR-0066`; `docs/adr/README.md` row for
  ADR-0060 status and nine new rows (Prettier-aligned).
- `fixtures/README.md`. `pnpm format` after table edits (never on `development-artifacts/`).
- Persistence rule: none of these files may cite M-ids, PD-ids, owner-decision numbers, D/G/I/K/Q/R/E/T/DL/RD/EX/CV/PJ/WR/VR row ids of
  this brief, phase or step numbers, `development-artifacts/`, or the plan. Deferred rule: no mention of deferred features outside
  `docs/deferred.md`; no author-facing length-cap wording; new text about report bounds says "report caps" or "size caps", never
  "length cap".

## Constraints

- Branch: all commits on `milestone/5-decision-report-evidence-records-local-skeleton`; worktrees base on its current local HEAD; no
  push; no GitHub writes of any kind (live access is read-only GET).
- OWNER GATE APPROVED 2026-09-27: G1–G7, the I-list, the K-rows, and the ADR inventory are binding exactly as written in this brief;
  REJECTED alternatives (R-B, `schema_version: 2`, G7 Options B and C, every I-list "Rejected alternative") are never implemented; any
  change needs a planner amendment with owner approval.
- Do NOT edit `docs/project-development-plan.md` or `docs/astra-plan.md`.
- No new dependencies (runtime or dev); `pnpm-lock.yaml` unchanged. Built-ins only (`node:fs`, `node:path`, `node:os`, `node:crypto`,
  `node:worker_threads`, `fetch`).
- No model call, no LLM or runner module, no container, and no execution of repository or policy commands anywhere in this milestone;
  `execute` and `assess` are pass-throughs; their handoff contracts must not change when later milestones fill them.
- The decision module is the only producer of an outcome; `pass` is constructed only through row 9; every steward-side failure is typed
  with a cause; no failure path yields `pass`.
- Evidence first: the CLI prints a report only after the run directory is committed; a failed evidence write prints no report.
- Untrusted text (bodies, API data, paths, URLs, stored evidence read back) reaches no shell, no `eval`, no dynamic `RegExp` built from
  untrusted or policy text beyond M03's safe-subset patterns, and no authorization decision; reports escape per E-rules; terminal output
  per `escapeTerminalText`.
- No decision, mapping, or report input reads authorship, account history, AI assistance, or presentation quality; severity language is
  never rendered.
- Every stored file is written with exclusive create; no write modifies an existing file; nothing is deleted except this run's own
  staging directory and metrics file on a failed write.
- Every Prettier-checked file is Prettier-clean at commit; `pnpm lint`, `pnpm build`, `pnpm typecheck` clean; byte-exact fixtures use
  `.txt`; tests needing exact bytes build them in code; never run a formatter on `development-artifacts/`.
- CI unchanged (`.github/workflows/`), Vitest configs unchanged, ESLint and Prettier configs unchanged, `.gitignore` unchanged, no
  `.gitattributes` (I19).
- Governing documents first; persistence and deferred rules as above; Prettier-aligned tables in docs.

## Assumptions

- The owner answered the gate on 2026-09-27 (every item as recommended); the answers are applied in this brief by amendment.
- M04's capture, contract, GitHub reader, attachment fetcher, and policy sources behave as documented at 6d2ea64; M05 consumes them
  without changing their contracts (only additive exports, the preflight exit mapping change, and the G6f widening of the snapshot
  `policy_revision` to accept `local:<sha256>`).
- The public test-bed `steady-orchard/patch-steward-testbed-public` keeps issues 29 and 30 and PRs 26–28 (unstructured bodies) and has
  no `.github/patch-steward/`; live commands read it only.
- `fs.rename` of a directory within one volume is atomic enough to serve as the local commit point on Windows and Linux; tests use one
  temporary volume.
- GitHub keeps its 65536-character comment and 65535-character check-summary limits.

## Out of scope

- SP13 steps 4–7 (freshness and ownership verification, check completion, labels, report comment, review requests), ownership
  artifacts, caps, admission, waiting-state persistence, the orphan-branch and repository evidence stores, Actions wiring (the
  GitHub-hosted skeleton).
- Any stage (references, claim, reproduction, fix verification, regression, challenge), context retrieval, execution planning,
  containers, inert materialization, model adapters, inference budgets beyond carrying the numbers.
- The SP20 publication flag, attributed comments, evidence upload; `steward init`, `steward replay`; maintainer actions and overrides
  (only the mapping rules accept an override input); the author-response ledger; metrics rollups, index, Pages.
- New policy keys or policy validation changes other than the automatic extension of `policy.credential-value` by new detectors.
- Edits to plan documents; the 0.x release.

## Definition of Done (project)

PINNED 2026-09-27 against the approved gate (G1–G7, I1–I29, K27–K37, ADR-0062–ADR-0070). Run in the main tree
(`cd /c/Users/John/Projects/steady-orchard/patch-steward`), Git Bash, after the last phase. `S` =
`6d2ea64942ab57fd74a68cdeed8ab7eedfad014d`.

1. Toolchain: `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check` exits 0;
   `git diff --quiet S HEAD -- pnpm-lock.yaml .github/workflows vitest.config.ts vitest.live.config.ts eslint.config.mjs .prettierrc.json .prettierignore .gitignore`
   exits 0; no `packages/*/package.json` gains a dependency; `ls .gitattributes` fails.
2. Decision table (exit criterion 1): `pnpm vitest run packages/core/src/decision` passes, none skipped, with one test per row titled
   `decision row <n>: <outcome or waiting state>` for rows 1–9, one per adjacent precedence pair titled `decision precedence: row <a>
   before row <b>` (8 pairs), and tests titled `advisory and speculative findings never gate`, `missing optional checks never become
   missing required evidence`, `a required stage without a result never passes`, and `pass is constructed only by row 9`.
3. Never pass (exit criterion 2): `pnpm vitest run packages/core/src/conformance/invariant-4.test.ts` passes, none skipped, with at least
   one test per boundary and injection listed in "Conformance checks" and the exact title `invariant 4: failed evidence write yields no
   report`; `pnpm vitest run packages/core/src/conformance` passes.
4. Mapping (exit criterion 3): `pnpm vitest run packages/core/src/decision/mapping.test.ts` passes with tests covering every mode ×
   outcome, titled at least `not enforced is neutral`, `waiting states stay pending`, `cancelled only for superseded cleanup`, `shared
   head is never success or neutral under any override`, and `issues never get a check`.
5. Report (exit criterion 4): `pnpm vitest run packages/core/src/report` passes, including `report stays within caps` (worst-case input
   in every section), `static report budget fits the report maximum`, `check summary stays within its maximum`, `overflow states the
   remaining count and links the evidence`, `report carries the bound identifiers and provenance`, one escaping test per E-rule, and
   `report wording has no severity, authorship, or praise term` (also in invariant-6).
6. Non-authoritative labeling (exit criterion 5): tests titled `non-authoritative run is labeled in <surface>` pass for `report.md`,
   `check summary`, `screen text`, `screen json`, `report text`, `report json`; tests titled `trusted-branch run is authoritative in
   <surface>` pass for `screen json` and `report json` (top-level `authoritative` true, `notices` exactly the one local-run notice; in
   `report json` also `policy.authoritative` true), per the G5 "Authoritative flag rule".
7. Evidence: `pnpm vitest run packages/core/src/evidence` passes, covering layout and names, PJ-rules (key order, expansion, final LF),
   manifest completeness and hashes, VR-rules (each tamper case → invalid), WR-rules (no final directory without manifest; exclusive
   create; rename failure), CV-rules (every string, `report.md`, logs, re-validation), `limits.evidence.run_bytes`, and metrics partition.
8. Redaction: `pnpm vitest run packages/core/src/redaction packages/core/src/conformance/invariant-7.test.ts` passes;
   `BUILT_IN_DETECTORS` has exactly 23 entries: the M03 eight unchanged and in order, then all 15 RD-list ids (optional extras
   included) in RD-list order; each of the 15 has a concatenation-built sample that it redacts and that the policy validator rejects as
   `policy.credential-value`; the EX-rules test redacts all three exact-value forms and skips values shorter than K35; the
   sentinel-token test passes; every fixture policy and the template still validate.
9. CLI: `pnpm vitest run packages/cli` passes, covering `screen` and `report` usage errors, every exit status, JSON shapes (J-SCREEN,
   J-REPORT), default evidence directory per platform (injected `process.platform`, env, home), preflight `inconclusive` → exit 3, `help`
   and `--help` work, `-h` is a usage error, all with recorded or synthetic responses (no network).
10. Records: record schema tests accept the widened `run_id`, the new optional finding and decision keys, and an unstructured issue
    record; still reject unknown keys and a wrong `schema_version`; every record schema keeps `schema_version: 1` (a record with
    `schema_version: 2` is rejected); `FAILURE_CAUSES` has exactly 20 entries, the M04 19 in SP19 order followed by `stage-incomplete`.
    Snapshots (G6f): `pnpm vitest run packages/core/src/submission/snapshot.test.ts` passes with a test titled `snapshot accepts a local
    policy revision`: the issue and pull request snapshot schemas accept `local:<64 hex>`, still reject `local:abc` and `HEAD`; a
    git-revision snapshot's `snapshotHash` is unchanged (equals the value computed at S for the same input); `snapshot_version` stays 1.
11. Live (read-only; network; `T=$(mktemp -d)`):

    ```bash
    node packages/cli/dist/main.js screen --issue 29 --repo steady-orchard/patch-steward-testbed-public --policy-file templates/policy/policy.yml --evidence-dir "$T"; echo "exit=$?"
    node packages/cli/dist/main.js screen --pr 26 --repo steady-orchard/patch-steward-testbed-public --policy-file templates/policy/policy.yml --evidence-dir "$T" --json; echo "exit=$?"
    node packages/cli/dist/main.js screen --issue 29 --repo steady-orchard/patch-steward-testbed-public --evidence-dir "$T"; echo "exit=$?"
    node packages/cli/dist/main.js report "<run directory printed by the first command>"; echo "exit=$?"
    ```

    Expected: first prints the local-run and non-authoritative lines, `outcome: needs-changes`, a `run directory:` line under `$T`, and
    `exit=1`; second prints exactly one line of compact JSON containing `"authoritative":false`, `"source":"local-file"`, and
    `"outcome":"needs-changes"`, and `exit=1`; third prints
    `screen.policy-missing` and `exit=2` and creates no new run directory; fourth prints the report with the `Non-authoritative:` notice
    and `exit=1` (R-A). The resolved token (`gh auth token`) appears in no file under `$T` (`grep -r -F "$(gh auth token)" "$T"` finds
    nothing).
12. No writes, no execution: tests titled `screen makes only GET requests` and `zero model calls and zero executions` (extended to
    `screen` and `report`) pass.
13. ADRs: exactly the approved inventory exists (`ls docs/adr/006[2-9]-*.md docs/adr/0070-*.md | wc -l` prints `9`;
    `ls docs/adr/0071-*.md` fails); `grep -c '^| \[ADR-' docs/adr/README.md` prints `70`; each new record's status line is
    `- Status: accepted` and its date is `2026-09-27`; `git show
    HEAD:docs/adr/0060-steward-preflight-command.md | grep -c '^- Status: superseded by ADR-0066$'` prints `1`; `git diff --stat S HEAD --
    $(ls docs/adr/00[0-5][0-9]-*.md docs/adr/0061-*.md)` is empty and the ADR-0060 diff is only its status line.
14. Persistence: the M04 persistence grep (brief DoD 15 command, same pathspecs) prints exactly `HEAD:CLAUDE.md:2` and
    `HEAD:docs/user-manual/configuration.md:1` (baseline at S, measured 2026-09-27; configuration.md's line may disappear, nothing may be
    added); `git grep -n -P 'owner decision|(?<![A-Za-z])(D|G|I|K|Q|E)[0-9]{1,2}(?![0-9])|\b(DL|RD|EX|CV|PJ|WR|VR|R-A|R-B)\b|[Oo]ption [ABC](?![a-z])' HEAD -- docs/adr/006[2-9]-*.md docs/adr/0070-*.md`
    prints nothing (review hits by hand; topology ids T1–T4 are persistent and allowed).
15. Deferred and wording: `git grep -c -E 'DF[0-9]{2}|deferred\.md' HEAD -- docs README.md CLAUDE.md templates fixtures ':!docs/deferred.md' ':!docs/adr' ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
    prints exactly `HEAD:CLAUDE.md:3` and `HEAD:README.md:1`; `git grep -c -i -E 'length cap|concise version' HEAD -- docs templates README.md CLAUDE.md ':!docs/deferred.md' ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
    prints exactly `HEAD:docs/architecture.md:1`, `HEAD:docs/processes.md:1`, `HEAD:docs/whitepaper.md:1` (baseline at S).
16. Documentation truth: `docs/user-manual/commands.md` marks `steward policy`, `steward preflight`, `steward screen`, and `steward report`
    Available and `steward init` and `steward replay` Proposed; no `[NEEDS INPUT]` callout in `commands.md` or `usage.md` still claims the
    arguments, exit codes, output formats, local-policy selection syntax, or report/evidence paths of `screen` or `report` are undefined;
    README Status and CLAUDE.md Project state describe `screen` as contract level only (no stage, container, model, publication, or
    branch store described as working); `grep -c 'run-directory layout and stored-record file format' docs/architecture.md` prints `0`;
    every preflight exit-status statement in architecture §6.5, SP05, `commands.md`, `usage.md`, and CLAUDE.md maps `inconclusive` to `3`.
17. Fixtures: the fixture-tier tests over `fixtures/screen/expectations.json` and `fixtures/reports/` pass and fail when a case lacks an
    entry or an entry lacks a file; `git ls-files fixtures | grep -c -E '(^|/)logs(/|$)|manifest\.json$'` prints `0`.
18. Prettier and docs: `pnpm prettier --check docs README.md CLAUDE.md fixtures` exits 0; no control characters in any new or changed file
    (`git diff S HEAD --name-only --diff-filter=d | xargs grep -l -P '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]'` prints nothing).
