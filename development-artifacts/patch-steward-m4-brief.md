# patch-steward-m4 — Brief

## Goal

Execute milestone M04 ("Submission intake and contract check") of `docs/project-development-plan.md`: convert an issue or PR
into a typed, hashed submission and decide the deterministic contract result with no model call and no execution. Deliver
the issue forms and PR template with their versioned field mapping, the submission module (parsing, category determination,
contract check, attachment rules, trusted and execution-sensitive path detection, the policy-change flag with the proposed
file's validation results as data, snapshot capture and hashing, the open PRs sharing a head commit), a runtime-validated
GitHub read adapter and Git adapter extensions, and the deterministic part of `steward preflight`. Record every decision as
an ADR and in the governing documents. Owner-added scope (Q1): the base commit leaves the snapshot hash; processes §0.1,
architecture invariant 8, the CLAUDE.md snapshot invariant, and every summary restating them are amended, recorded by ADR-0055.

OWNER GATE (see "Owner gate" below): APPROVED 2026-09-26. Gate items A, B, C, D, E (exactly as written), the I-list (every
recommendation accepted; every alternative rejected), the C-table, and the Q1 decision (option B) are binding. All phases are
unblocked in phase order.

## Context

### Repository and environment facts (read at commit 8ae8c6f9b6906205a3a4c74110c30462237f5860; every line number below was read there and shifts as files are edited — locate text by quotation and re-verify against live files)

- Repo root: `C:\Users\John\Projects\steady-orchard\patch-steward` (Git Bash path `/c/Users/John/Projects/steady-orchard/patch-steward`).
  Remote `origin = git@github.com:steady-orchard/patch-steward.git` (PUBLIC; no `.github/patch-steward/` directory on
  `develop`, verified 2026-09-26). `git symbolic-ref refs/remotes/origin/HEAD` = `refs/remotes/origin/develop`. Working branch
  `milestone/4-submission-intake-and-contract-check` (local, not pushed, created from `develop` at 8ae8c6f). Nothing in this plan
  pushes, opens a PR, or writes to GitHub.
- Environment: Windows 11; Git Bash for all commands in this brief. Node `v24.11.0`, pnpm `10.20.0`, git `2.55.0.windows.3`,
  `gh 2.93.0` logged in as `jambolo` (keyring token, `gh auth token` works). Network access to api.github.com is available.
  `core.autocrlf=true` globally: text files committed with LF are checked out with CRLF. Compare committed bytes with
  `git show HEAD:<path>`, never working-tree bytes. No `.gitattributes`. `jq` is NOT installed.
- Long git-worktree paths break `pnpm test`: phase gates and the project DoD run in the MAIN tree; worker worktrees use short
  paths such as `C:/Users/John/Projects/steady-orchard/m4-w<id>`.
- `.gitignore` ignores (among others) `dist`, `out`, `logs`, `*.log`, `*.tgz`, `*.pid`, `*.seed`, `.env`, `.env.*`, `pids`,
  `coverage`, `.cache`, `.temp`, `build/Release`, `lib-cov`, `node_modules/`, `.claude`. No new file may use those names or
  extensions (a fixture named `x.log` or `x.tgz` would be silently untracked). Attachment-format tests that need a `.log` name
  build the name in test code.
- Toolchain (root `package.json` scripts): `build` = `pnpm -r build`; `typecheck` = `tsc --noEmit -p packages/<pkg>/tsconfig.test.json`
  chained for core, cli, action, web; `test` = `vitest run`; `coverage`; `lint` = `eslint .`; `format` = `prettier --write .`;
  `format:check` = `prettier --check .`. Root devDependencies: typescript ^6.0.3, vitest ^5.0.1, @vitest/coverage-v8 ^5.0.1,
  eslint ^10.10.0, typescript-eslint ^8.70.0, prettier ^3.9.6, @types/node ^24.0.0, @eslint/js ^10.0.1.
- `packages/core/package.json`: dependencies `yaml ^2.9.1`, `zod ^4.6.5`; `exports "."` → `./dist/index.js`. `packages/cli/package.json`:
  `bin: { steward: ./dist/main.js }`, `engines.node >=24`, dependency `@patch-steward/core: workspace:*`.
- TypeScript: `module: nodenext`, `verbatimModuleSyntax`, `isolatedModules`, `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedSideEffectImports`. Relative imports use
  `.js`. Type-only imports use `import type`. Package tsconfig excludes `**/*.test.ts`; `tsconfig.test.json` per package
  re-includes them; the cli check config maps `@patch-steward/core` to core sources.
- Vitest (`vitest.config.ts`): projects `unit` (`packages/*/src/**/*.test.ts` minus fixture, container, live suffixes) and
  `fixture` (`packages/*/src/**/*.fixture.test.ts`). Both alias `@patch-steward/core` to `packages/core/src/index.ts` EXACTLY: cli
  code and tests import only the package root. NO runner exists for `*.live.test.ts` (both projects exclude it; see I19).
- ESLint flat config: `@eslint/js` + `typescript-eslint` recommended; ignores `**/dist/`, `docs/`, `coverage/`; no Node globals
  (import `process` from `node:process`).
- Prettier (`singleQuote`, `semi`, `trailingComma: all`, `printWidth: 132`, `endOfLine: auto`) checks every known extension not in
  `.prettierignore` (`pnpm-lock.yaml`, `dist/`, `coverage/`, `node_modules/`, `development-artifacts/`). Consequences: templates
  (`.yml`, `.md`), fixture `.json`/`.yml`/`.md`, docs, README.md, CLAUDE.md must be Prettier-clean at commit; byte-exact fixtures
  (submission bodies, drafts, hostile inputs) use `.txt` (Prettier skips it); Prettier rewrites Markdown and YAML, so a template
  file's committed bytes are Prettier's output and the mapping drift test reads the committed file. `development-artifacts/` is
  already excluded; this plan adds no ignore entry.
- M03 delivered (core root exports, `packages/core/src/index.ts` uses `export *`): `vocabulary.ts` (OUTCOMES, CATEGORIES, MODES,
  FAILURE_CAUSES incl. `attachment-fetch-failed`, `github-unavailable`, `rate-limited`, `policy-unavailable`, `policy-invalid`,
  `steward-defect`; SUBMISSION_TYPES `issue`, `pull_request`; ISSUE_KINDS `defect`, `proposal`), `result.ts` (`Result`, `ok`,
  `err(code, cause, message, details?)`, failure `{ code, cause, outcome: 'inconclusive', message, details }`), `hash.ts`
  (`sha256Hex`, `contentHash` → `sha256:<hex>`, `canonicalJsonHash`), `canonical-json.ts` (RFC 8785), `strict-yaml.ts`,
  `process/run-process.ts` (`runProcess`, `ProcessRunner`; argv only, bounded), `git/reader.ts` (`resolveCommit`,
  `readPolicyTreeId`, `listTree`, `findTreeEntry`, `readBlob`, `inertGitEnv`, `isObjectId`, `POLICY_DIRECTORY`, 15 `git.*`
  codes), `submission-fields.ts` (field-id tuples; see below), `policy/*` (`loadPolicy(source)` with `PolicySource` git or file,
  `validatePolicyBytes`, `resolvePolicy`, `ResolvedPolicy`, `POLICY_LIMITS`, bound constants in `policy/bounds.ts`,
  `policy/messages.ts` bounded escaped excerpts), `redaction/*` (`redactText`, 8 built-in detectors), `records/*` (nine strict
  record schemas, `schema_version: 1`), conformance tests `invariant-2`, `invariant-5` (unit + fixture), `invariant-7`,
  `never-pass`, `never-pass-content` in `packages/core/src/conformance/`. `packages/cli/src/`: `cli.ts` (`runCli`,
  `STEWARD_USAGE`), `main.ts`, `policy-command.ts` (`runPolicyCommand`, `PolicyCommandContext { cwd, io }`, exit codes 0/1/2,
  usage codes `usage.*`, `steward.internal-error`).
- Canonical field ids (`packages/core/src/submission-fields.ts`, fixed by M03; M04 may only ADD ids): defect issue
  `expected-behavior`, `authoritative-basis`, `actual-behavior`, `affected-version`, `reproduction-command`, `expected-result`,
  `proposed-scope`, `references`, `security-claim`; proposal issue `problem`, `benefit`, `existing-decision`, `proposed-scope`,
  `references`; pull request `category`, `problem`, `benefit`, `intended-behavior`, `acceptance-criteria`, `linked-issue`,
  `regression-test`, `test-scaffolding`, `reproduction-command`, `expected-result`, `references`.
- Submission record (`packages/core/src/records/submission.ts`, v1, strict): `repository`, `type`, `number`, `snapshot_hash`,
  `target_branch` (PR only), `head_commit` (PR only), `issue_kind` (issue only), `category` (nullable), `fields` (strict object over
  the 18 ids, each optional text), `linked_evidence_hashes`, `author_responses` (`request_id`, `comment_id`, `content_hash`),
  `shared_head_pull_requests` (PR only), `contract_results` (`requirement`, `satisfied`, `detail`), `trusted_paths_changed`,
  `execution_sensitive_paths_changed` (PR only, else null). Finding record requires `run_id`/`run_attempt` (no run exists in M04).
- Policy keys M04 reads (validated by M03, `packages/core/src/policy/schema.ts`): `trusted_paths.additional`,
  `execution_sensitive_paths.additional` (globs, syntax checked only), `categories.<c>.{required_fields, linked_issue,
  references, reproduction, regression_test}`, `submission.{free_form (default false), unrequested_change, issue_fields.defect,
  issue_fields.proposal, reference_hosts, attachments.destinations (hostnames, HOSTNAME_PATTERN), attachments.formats
  (FILE_EXTENSION_PATTERN `^[a-z0-9]+(?:\.[a-z0-9]+)*$`)}`, `modes.default`, `modes.per_category`, `limits.github.{requests_per_run,
  retries_per_request}`, `limits.attachments.{count, file_bytes, total_bytes, decompressed_bytes, redirects, fetch_seconds}`.
- Policy template `templates/policy/policy.yml` today: `submission.attachments.destinations: [github.com]`, `formats: [png, jpg, txt]`;
  modes `default: observe`, `per_category: {}`; `categories.bugfix.required_fields: [category, problem, intended-behavior,
  linked-issue, reproduction-command, expected-result, regression-test]`, `linked_issue: required`; `feature` requires
  `[category, problem, benefit, intended-behavior, acceptance-criteria, linked-issue]`, `linked_issue: required`; `refactor`
  `[category, problem, benefit]`; `docs` and `chore` `[category, problem]`; `security` `[category, problem, intended-behavior,
  reproduction-command, expected-result, regression-test]`; `issue_fields.defect: [expected-behavior, authoritative-basis,
  actual-behavior, affected-version, reproduction-command, expected-result]`, `proposal: [problem, benefit, proposed-scope]`.
- GitHub facts verified 2026-09-26 (read-only, `gh api` and unauthenticated `curl`):
  - Issue-form bodies render each field as `### <label>`, a blank line, the value, a blank line; LF between structural lines;
    textarea values keep the user's CRLF; an empty optional field renders `_No response_`; checkboxes render `- [X] <label>` or
    `- [ ] <label>` with Markdown escaping in labels (`and\/or`, `\#`); a textarea with `render: shell` wraps the value in a
    ```` ```shell ```` fence. Bodies can contain raw control characters (an ESC byte was observed). GitHub omits form `id`s from bodies.
  - Attachments: `https://github.com/user-attachments/files/27275075/vscode_log.txt` → `302` to
    `https://objects.githubusercontent.com/github-production-repository-file-5c1aeb/41881900/27275075?X-Amz-...` (signed);
    `https://github.com/user-attachments/assets/744fcbda-c531-4896-ad0d-2ad02b103546` → `302` to
    `https://github-production-user-asset-6210df.s3.amazonaws.com/6461412/564338573-744fcbda-c531-4896-ad0d-2ad02b103546.png?X-Amz-...`.
  - Contents API: `GET /repos/{o}/{r}/contents/.github?ref=<commit>` lists subdirectories with `type: dir` and `sha` = the git
    tree id (the policy revision is that `sha` for the `patch-steward` entry). Neither `steady-orchard/patch-steward` nor
    `steady-orchard/patch-steward-testbed-public` has `.github/patch-steward/`.
  - Test-bed `steady-orchard/patch-steward-testbed-public`: public, default branch `master`; issue #29 and #30 are closed
    issues (not PRs); PRs #26, #27, #28 are closed. Usable for read-only live tests and recordings; this plan writes nothing there.
- `docs/adr/`: 49 records (ADR-0001–ADR-0049); `grep -c '^| \[ADR-' docs/adr/README.md` = `49`. MADR format per
  `docs/adr/README.md` ("Format": heading `# ADR-NNNN: <title>`, metadata `Status`, `Date`, `Deciders`, `Source`; sections
  Context and Problem Statement, Decision Drivers (optional), Considered Options, Decision Outcome with Consequences, Pros and Cons
  (optional), More Information).

### Milestone text (verbatim, `docs/project-development-plan.md` "### M04. Submission intake and contract check")

```text
Goal: convert an issue or PR into a typed, hashed submission and decide the
deterministic contract result with no model call and no execution.

Design scope: SP06 steps 2–7, without the merge-group branch and stored-validation reuse; SP01 step 2; SP05 CLI steps 1–2 and failure handling; §6.2 Submission; §6.3 GitHub reads and Git; §6.7 issue forms and PR template; invariants 1 and 8 (snapshot definition)
Addresses: P01, P03, P05, P07; through preflight P02, P04, P06, P09
Depends on: M03

Outputs:
- Defect and proposal issue forms and the PR template in `templates/`, with
  their versioned mapping.
- Submission module: parsing, category determination, contract check,
  attachment rules, trusted and execution-sensitive path detection, the
  policy-change flag with the proposed file's validation results as data,
  snapshot capture and hashing, the set of open PRs sharing a head commit.
- GitHub read adapter and Git adapter with runtime-validated responses.
- `steward preflight`, deterministic part: the SP06 contract check on a local
  draft and branch, the default checklist when no policy is published, output
  marked unverified.

Exit criteria:
- The fixture corpus yields the documented results: ambiguous or duplicate
  fields request a correction; unstructured bodies are `needs-changes` with
  the template link unless free-form is allowed; a category mismatch is
  `uncertain`; ambiguity involving an enforced category requires triage; a
  policy-changing PR is flagged and not applied; an execution-sensitive change
  adds a required triage finding.
- The snapshot hash is stable under title-only edits and changes with each
  snapshot input of processes §0.1.
- Severity assertions are ignored, and no contract rule reads authorship or
  account history.
- Attachment handling enforces the SP06 step 5 rules; a required fetch failure
  is an `inconclusive` cause, a violation is `needs-changes`.
- The path makes zero model calls and zero executions.
```

Plan §7.3 also names M04 as the FIRST conformance check for invariants 1 (untrusted data), 6 (substance, not authorship), and
8 (snapshot binding), and as an extension of invariant 5 (runtime validation).

### Design sources (governing; read at 8ae8c6f)

- `docs/processes.md` §0.1 "Snapshot" (line 30), §0.2 rules; SP01 step 2 (lines 126–133); SP05 (lines 442–504; CLI steps 1–2,
  failure handling "a project without a published policy gets the default checklist from the steward template"); SP06 (lines
  508–619; steps 2–7; controls "deterministic parsing; no model call"; failure handling "GitHub API unavailable ends the run
  `inconclusive`; a malformed template ends it `needs-changes` with the template link"); SP13 step 1 decision table (lines
  987–997; precedence: superseded, shared head `needs-changes`, contract fails `needs-changes`, queued, awaiting-approval,
  steward work unavailable `inconclusive`, required maintainer decision `uncertain`, missing contributor evidence
  `needs-changes`, `pass`); SP14 step 1 (author-response ledger; M16 builds it); SP08 step 4 (security checkbox on the form).
- `docs/architecture.md` invariants 1, 6, 8 (lines 61–88); §4 boundary rules (Z3 to Z1); §6.2 Submission row (line 219); §6.3
  GitHub and Git rows (lines 236–237); §6.4 "Ownership and freshness" (publish recompute list at lines 391–397: "head, base ref,
  body hash, linked-issue and attachment hashes, author responses to numbered requests, the set of open PRs sharing the head
  commit, the policy revision"; shared heads lines 398–407; "Base-branch movement is not revoked by the steward" lines 444–446;
  attachments "hash-bound and refetched within limits; changed bytes invalidate the snapshot even if a URL stays unchanged"
  lines 426–428); §6.5 preflight row and CLI auth paragraph (lines 495, 518–524); §6.7 installed files (lines 564–566:
  `.github/ISSUE_TEMPLATE/steward-defect.yml`, `.github/ISSUE_TEMPLATE/steward-proposal.yml`, `.github/pull_request_template.md`);
  §8 Trusted paths, Execution-sensitive paths, Submission rows (lines 695–698); §9 Submission row and claim-scope paragraph (lines
  758, 770–774); §10 check mapping (shared head); §12 failure classes; §12.1 hard bounds (lines 993–1082); §13 threats.
- `docs/deferred.md` DF10 "Author-facing submission length caps" (deferred; version 1 has NO author-facing text-length caps and no
  associated rejection; attachment count, byte, fetch, and decompression bounds are retained).
- `docs/whitepaper.md` §4 (submission contract), §9–§14 (summaries; §14 lines 770–778 "Implemented so far").

### Plan-wide DoD items that apply (plan §0.3)

| §0.3 item | How it applies here |
| --- | --- |
| Build, type-check, tests, lint, format pass (Ubuntu and Windows) | Run locally on Windows in the main tree. Ubuntu is covered by CI on the lead's PR; tests must be OS-independent (no working-tree byte assertions; paths POSIX in core). |
| Runtime validation; handled as data | New inputs: issue and PR bodies, preflight drafts, GitHub API responses, git diff/merge-base output, attachment bytes and HTTP metadata, `gh auth token` output. Each is validated at runtime (Zod or bounded parsers) and reaches no shell, no workflow expression, no authorization decision. Human CLI output escapes control characters in any quoted untrusted text. |
| Injected-failure tests, never `pass` | GitHub reader, Git adapter extensions, attachment fetcher, archive inspector, GitHub policy source, auth resolution, and preflight each have injected-failure tests; every failure is typed (`outcome: 'inconclusive'` for steward-side failures); the contract result type cannot express `pass`; the never-pass conformance tables gain every new failure-code union. |
| Limits under hard bounds; redaction before persistence | GitHub requests and retries: `limits.github.*`; attachments: `limits.attachments.*`; everything else: new hard-only constants (gate item E). M04 persists nothing at runtime; committed recorded GitHub responses are checked to contain no credential-detector match. |
| No decision input from authorship | Contract inputs carry no author login, association, account age, or AI-disclosure field; invariant-6 conformance test. |
| Evidence and metrics per delivered step | M04 creates no run, so no evidence or metrics event is written (I16); results are typed data M05 persists. |
| Fixture corpus grows | `fixtures/submissions/` (issue and PR bodies, drafts, diffs, hostile and injection text, expectations) and `fixtures/github/` (recorded, runtime-validated API responses). |
| Decisions recorded governing document first | ADR-0050 onward plus architecture, processes, whitepaper §9–§14, README, CLAUDE.md, user manual (see "Documentation change inventory"). §15 has no M04 item; §14 traceability and "Addresses" fields stay consistent. |
| Documentation describes only what was delivered | `steward preflight` Available (deterministic part only; mandatory commands and self-review stay Proposed); `[NEEDS INPUT]` callouts on field mapping, issue forms, and preflight resolved. |
| Invariant conformance checks (plan §7.3) | New `invariant-1`, `invariant-6`, `invariant-8` tests; `invariant-5` extended; they stay in the suite. |

### Owner decisions (settled 2026-09-26; binding; restated from the lead's prompt)

- D1 Field mapping versions: plain human labels; one mapping table per template version in core; issue-form version detected by
  matching the rendered `### <label>` heading set newest-first; the PR template carries a hidden
  `<!-- patch-steward:pr-template v1 -->` marker. Planner drafts exact labels and headings (gate item A). Field ids fixed by M03;
  M04 adds ids only additively.
- D2 Category-versus-diff rules: built-in path classes as core constants, no new policy keys: `docs` = only documentation paths;
  `chore` = no source code (config, CI, dependencies, tooling); `bugfix`, `feature`, `refactor`, `security` require a code change;
  test changes are allowed with any category; a mismatch is `uncertain`. Planner drafts globs (gate item B).
- D3 Built-in trusted and execution-sensitive path lists: broad and ecosystem-generic (workflow definitions, actions, policy
  directory, CODEOWNERS, CI scripts; package manifests, lockfiles, build/test configuration, reporters, shared test helpers,
  harness code) covering TypeScript, the compiled ecosystem chosen later for result parsing (Rust or C++, chosen in the M08
  milestone; both covered now), and other common ecosystems. Projects extend via `trusted_paths.additional` and
  `execution_sensitive_paths.additional` (gate item C).
- D4 Attachments: default destinations are GitHub user-attachment hosts only; formats text (txt, log, md, json, patch, diff) plus
  zip and gz under the decompression bound; images hashed, never parsed; no credentials ever forwarded, so auth-gated
  private-repository attachments are a fetch failure (`inconclusive` if required). The policy template's `submission.attachments`
  values are updated to match. Numeric limits exist (`limits.attachments.*`, architecture §12.1). Fetching follows SP06 step 5
  (approved public HTTPS only, no private/link-local redirects, bytes hashed before handoff) (gate item D).
- D5 Canonical claim-scope text of a PR: RFC 8785 JSON of `problem`, `benefit`, `intended-behavior`, `acceptance-criteria` plus
  the linked proposal (repository, number, content hash); per field: Unicode NFC, CRLF to LF, HTML comments removed, trailing
  whitespace per line and leading/trailing blank lines trimmed, Markdown otherwise verbatim; a missing or ambiguous field means
  no claim scope (maintainer clarification required, never broadens acceptance).
- D6 CLI GitHub auth: resolve `GH_TOKEN`, then `GITHUB_TOKEN`, then `gh auth token` (subprocess, only when gh is installed); the
  token is never stored or logged; public-repository reads fall back to unauthenticated with a rate-limit warning; a private
  repository without a token exits 2.
- D7 `steward preflight` surface: `steward preflight (--issue defect|proposal | --pr) --draft <file.md> [--repo owner/name]
  [--base <ref>] [--json]`; the draft is Markdown in the rendered form/template layout; upstream from `--repo`, else the
  `upstream` remote, else `origin`; policy fetched from the upstream default branch via the GitHub API; no published policy →
  the template policy serves as the default checklist; output marked produced on the contributor's machine and unverified; exit
  0 contract met, 1 not met, 2 usage or environment error. Only SP05 CLI steps 1–2: no mandatory-command execution (M07) and no
  self-review (M09).

### Owner gate

- Status: APPROVED 2026-09-26 by the project owner (relayed by the lead developer). Answers applied in place below.
- Decisions:
  - A — mapping v1 (A-table): APPROVED exactly as written.
  - B — category path classes (PC-lists) and class rules (PC-rules): APPROVED exactly as written.
  - C — built-in trusted (TP-list) and execution-sensitive (ES-list) path lists: APPROVED exactly as written.
  - D — attachment defaults (AT-list): APPROVED exactly as written.
  - E — hard-only constants K13–K26 (K-table): APPROVED exactly as written (values provisional like M03's).
  - I1–I26 (I-list): every recommendation ACCEPTED; every stated alternative REJECTED. Owner restated explicitly: I5
    same-repository linked issue only; I14 fetch by commit id deferred to the sandboxed-execution milestone; I16 M04 writes no
    evidence and emits no metrics; I19 root `vitest.live.config.ts` plus `pnpm test:live`, never in CI, so ADR-0061 applies; I20
    no `reproduction-files` field id.
  - Q1: Option B DECIDED. The base commit is recorded in the snapshot but excluded from the snapshot hash; the base ref
    (target branch) stays in the hash. Owner-added scope: amend processes §0.1 Snapshot, architecture invariant 8, the CLAUDE.md
    snapshot invariant, and every other summary restating the snapshot inputs (see "Q1 documentation changes"), recorded by an
    ADR (ADR-0055). Persistent documents must not cite planning ids.

### Gate item A — field mapping v1 (A-table; APPROVED 2026-09-26)

Glob and heading rules are in I1–I3. Labels are compared after Unicode NFC, trimming, and collapsing internal whitespace;
issue-form labels case-sensitively (GitHub renders them verbatim), PR headings case-insensitively (contributors edit them).

Defect issue form, `templates/issue-forms/steward-defect.yml` (installed later as `.github/ISSUE_TEMPLATE/steward-defect.yml`);
rendered heading `### <label>`; form element `id` = the canonical field id (used only for URL prefilling):

| Field id | Rendered label | Form element | Form `required` |
| --- | --- | --- | --- |
| `expected-behavior` | `Expected behavior` | textarea | yes |
| `authoritative-basis` | `Authoritative basis` | textarea | yes |
| `actual-behavior` | `Actual behavior` | textarea | yes |
| `affected-version` | `Affected version` | input | yes |
| `reproduction-command` | `Reproduction command` | textarea (no `render`) | yes |
| `expected-result` | `Expected result` | textarea | yes |
| `proposed-scope` | `Proposed scope` | textarea | no |
| `references` | `References` | textarea | no |
| `security-claim` | `Security claim` | checkboxes, one option `This report claims a security problem` | no |

Proposal issue form, `templates/issue-forms/steward-proposal.yml` (installed later as `.github/ISSUE_TEMPLATE/steward-proposal.yml`):

| Field id | Rendered label | Form element | Form `required` |
| --- | --- | --- | --- |
| `problem` | `Problem` | textarea | yes |
| `benefit` | `Benefit` | textarea | yes |
| `existing-decision` | `Existing decision` | textarea | no |
| `proposed-scope` | `Proposed scope` | textarea | yes |
| `references` | `References` | textarea | no |

Form content rules: each form has `name`, `description`, and `body`; NO `labels:` key (labels are steward outputs, never inputs)
and NO severity field; a leading `markdown` element (not rendered into the body) states that maintainers assess severity, that
security vulnerabilities go to the project's private reporting channel, and (defect form) that reproduction files go into the
`Reproduction command` field as fenced code blocks or attachments (I20). Form `required` flags equal the template policy's
`submission.issue_fields` lists; the policy, not the form, governs screening.

PR template, `templates/pull-request/pull_request_template.md` (installed later as `.github/pull_request_template.md`):

- First line: `<!-- patch-steward:pr-template v1 -->` (exact bytes; the marker regex is
  `^<!-- patch-steward:pr-template v([1-9][0-9]*) -->$` on one line outside fences).
- A top HTML comment explaining drafts: in feedback-enabled modes open a draft to get screening before review requests; in
  observe mode use the repository's ordinary manual readiness and review process (architecture §6.7).
- Sections, each `## <heading>` followed by an HTML-comment hint:

| Field id | Heading | Hint content (HTML comment) |
| --- | --- | --- |
| `category` | `Category` | exactly one of `bugfix`, `feature`, `refactor`, `docs`, `chore`, `security` |
| `problem` | `Problem` | the problem this change addresses |
| `benefit` | `Benefit` | why the change is worth adopting and maintaining |
| `intended-behavior` | `Intended behavior` | behavior after the change |
| `acceptance-criteria` | `Acceptance criteria` | checkable conditions |
| `linked-issue` | `Linked issue` | one issue in this repository: `#123`, optionally after a closing keyword |
| `regression-test` | `Regression test` | test file and test name that fails before and passes after |
| `test-scaffolding` | `Test scaffolding` | non-test files the regression test needs |
| `reproduction-command` | `Reproduction command` | exact command; files as fenced code blocks or attachments |
| `expected-result` | `Expected result` | exit status or output text |
| `references` | `References` | documents, specifications, decisions |

### Gate item B — category path classes (PC-lists and PC-rules; APPROVED 2026-09-26)

Every changed path gets exactly ONE class, first match wins in the order `test`, `docs`, `infra`, `code` (`code` = no earlier
match). Glob syntax per I7. Lists are core constants; there is no policy key (D2).

- PC-test: `**/test/**`, `**/tests/**`, `**/__tests__/**`, `**/spec/**`, `**/specs/**`, `**/testdata/**`, `**/test-data/**`,
  `**/fixtures/**`, `**/__fixtures__/**`, `**/__snapshots__/**`, `**/__mocks__/**`, `**/testing/**`, `*.test.*`, `*.spec.*`,
  `*_test.*`, `*_tests.*`, `*_unittest.*`, `test_*.py`, `*_spec.rb`, `*Test.java`, `*Tests.java`, `*Test.kt`, `*Tests.kt`,
  `*Test.cs`, `*Tests.cs`, `conftest.py`.
- PC-docs: `*.md`, `*.mdx`, `*.markdown`, `*.rst`, `*.adoc`, `*.asciidoc`, `*.rdoc`, `docs/**`, `doc/**`, `documentation/**`,
  `man/**`, `README`, `README.*`, `CHANGELOG`, `CHANGELOG.*`, `CHANGES`, `CHANGES.*`, `HISTORY`, `HISTORY.*`, `NEWS`, `NEWS.*`,
  `CONTRIBUTING`, `CONTRIBUTING.*`, `CODE_OF_CONDUCT`, `CODE_OF_CONDUCT.*`, `SECURITY.*`, `SUPPORT.*`, `AUTHORS`, `AUTHORS.*`,
  `CONTRIBUTORS`, `CONTRIBUTORS.*`, `LICENSE`, `LICENSE.*`, `LICENCE`, `LICENCE.*`, `COPYING`, `COPYING.*`, `NOTICE`, `NOTICE.*`.
- PC-infra (config, CI, dependencies, tooling): every TP-list and ES-list entry (gate item C), plus `.github/**`, `.*` (dotfiles
  at any depth), `**/.*/**` (anything inside a dot-directory), `*.yml`, `*.yaml`, `*.toml`, `*.ini`, `*.cfg`, `*.conf`,
  `*.properties`, `*.lock`, `scripts/**`, `script/**`, `tools/**`, `tooling/**`.
- PC-rules (a category is CONSISTENT with a diff when):
  - `docs`: every path is `docs` or `test`, and at least one is `docs`.
  - `chore`: no path is `code`, and at least one path is `docs` or `infra`.
  - `bugfix`, `feature`, `refactor`, `security`: at least one path is `code`.
  - An empty diff is consistent with no category.
- Known false-positive and false-negative risks for review: JSON is not infra (it falls to `code`), so a docs PR touching only
  `*.json` is a mismatch; `*.yml`/`*.yaml`/`*.toml` are infra even when a project treats them as product source; `tools/**` may be
  product code in some repositories; `.github/**` makes `.github/CONTRIBUTING.md` docs (docs precedes infra). Every mismatch
  yields `uncertain` (triage), never a rejection.

### Gate item C — built-in trusted and execution-sensitive lists (TP-list, ES-list; APPROVED 2026-09-26)

Glob syntax per I7 (a pattern without `/` matches the file name at any depth). A changed path matching TP sets
`trusted_paths_changed`; matching ES (or `execution_sensitive_paths.additional`) adds the required triage finding. A path may
match both.

- TP-list (paths whose change prevents reliance on PR-controlled CI): `.github/workflows/**`, `.github/actions/**`, `action.yml`,
  `action.yaml`, `.github/patch-steward/**`, `CODEOWNERS`, `.github/scripts/**`, `.gitlab-ci.yml`, `.gitlab/ci/**`, `.circleci/**`,
  `.travis.yml`, `azure-pipelines.yml`, `azure-pipelines.yaml`, `.azure-pipelines/**`, `.buildkite/**`, `Jenkinsfile`,
  `.drone.yml`, `.woodpecker.yml`, `.woodpecker/**`, `appveyor.yml`, `.appveyor.yml`, `bitbucket-pipelines.yml`,
  `cloudbuild.yaml`, `cloudbuild.yml`, `ci/**`, `.ci/**`.
- ES-list, grouped (all built in; groups are documentation only):
  - JavaScript/TypeScript manifests, lockfiles, package-manager config: `package.json`, `package-lock.json`,
    `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.pnpmfile.cjs`, `yarn.lock`, `.yarnrc`, `.yarnrc.yml`, `.npmrc`,
    `bun.lock`, `bun.lockb`, `deno.json`, `deno.jsonc`, `deno.lock`.
  - JavaScript/TypeScript build and test configuration: `tsconfig*.json`, `jsconfig*.json`, `vitest.config.*`,
    `vitest.workspace.*`, `vite.config.*`, `jest.config.*`, `babel.config.*`, `.babelrc`, `.babelrc.*`, `karma.conf.*`,
    `.mocharc*`, `playwright.config.*`, `cypress.config.*`, `webpack.config.*`, `rollup.config.*`, `esbuild.config.*`, `.swcrc`,
    `nx.json`, `turbo.json`, `lerna.json`, `.nycrc*`, `eslint.config.*`, `.eslintrc*`, `prettier.config.*`, `.prettierrc*`.
  - Rust: `Cargo.toml`, `Cargo.lock`, `build.rs`, `rust-toolchain`, `rust-toolchain.toml`, `**/.cargo/**`, `clippy.toml`,
    `.clippy.toml`, `deny.toml`, `rustfmt.toml`, `.rustfmt.toml`, `.config/nextest.toml`.
  - C and C++: `CMakeLists.txt`, `*.cmake`, `CMakePresets.json`, `CMakeUserPresets.json`, `vcpkg.json`, `vcpkg-configuration.json`,
    `conanfile.py`, `conanfile.txt`, `meson.build`, `meson_options.txt`, `meson.options`, `Makefile`, `makefile`, `GNUmakefile`,
    `*.mk`, `configure`, `configure.ac`, `Makefile.am`, `Makefile.in`, `.clang-tidy`, `.clang-format`, `*.vcxproj`, `*.vcxproj.filters`.
  - Go: `go.mod`, `go.sum`, `go.work`, `go.work.sum`, `.golangci.*`.
  - Python: `pyproject.toml`, `setup.py`, `setup.cfg`, `requirements*.txt`, `constraints*.txt`, `Pipfile`, `Pipfile.lock`,
    `poetry.lock`, `uv.lock`, `pdm.lock`, `tox.ini`, `noxfile.py`, `pytest.ini`, `conftest.py`, `mypy.ini`, `.mypy.ini`, `ruff.toml`,
    `.ruff.toml`, `.pylintrc`, `pylintrc`, `.flake8`.
  - Ruby: `Gemfile`, `Gemfile.lock`, `*.gemspec`, `Rakefile`, `.rspec`, `.rubocop.yml`, `spec_helper.rb`, `rails_helper.rb`,
    `test_helper.rb`.
  - JVM: `pom.xml`, `build.gradle`, `build.gradle.kts`, `settings.gradle`, `settings.gradle.kts`, `gradle.properties`, `gradlew`,
    `gradlew.bat`, `gradle/**`, `.mvn/**`.
  - .NET: `*.csproj`, `*.fsproj`, `*.vbproj`, `*.sln`, `*.props`, `*.targets`, `global.json`, `nuget.config`, `NuGet.Config`,
    `packages.lock.json`, `.config/dotnet-tools.json`.
  - PHP and Elixir: `composer.json`, `composer.lock`, `phpunit.xml`, `phpunit.xml.dist`, `mix.exs`, `mix.lock`.
  - Bazel: `BUILD`, `BUILD.bazel`, `WORKSPACE`, `WORKSPACE.bazel`, `MODULE.bazel`, `*.bzl`, `.bazelrc`, `.bazelversion`.
  - Containers: `Dockerfile`, `Dockerfile.*`, `*.dockerfile`, `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml`.
  - Repository mechanics: `.gitmodules`, `.gitattributes`.
  - Reporters: `**/reporters/**`, `**/reporter/**`, `*reporter.config.*`.
  - Shared test helpers and harness code: `**/test/helpers/**`, `**/tests/helpers/**`, `**/test/support/**`, `**/tests/support/**`,
    `**/spec/support/**`, `**/spec/helpers/**`, `**/test-utils/**`, `**/test_utils/**`, `**/testutils/**`, `**/test-helpers/**`,
    `**/test_helpers/**`, `**/tests/common/**`, `**/cypress/support/**`, `**/harness/**`, `**/test-harness/**`, `setupTests.*`,
    `test-setup.*`, `test_setup.*`, `vitest.setup.*`, `jest.setup.*`, `global-setup.*`, `globalSetup.*`, `global-teardown.*`,
    `globalTeardown.*`.
  - Scripts: `scripts/**`.
- Known false-positive risks for review: `scripts/**` and `**/harness/**` may hold product code; `.clang-format` and
  `.prettierrc*` affect formatting commands only. False positives yield triage, never rejection.

### Gate item D — attachment defaults (AT-list; APPROVED 2026-09-26)

- AT1 Template `submission.attachments.destinations`: `github.com`, `objects.githubusercontent.com`,
  `github-production-user-asset-6210df.s3.amazonaws.com`, `user-images.githubusercontent.com`,
  `private-user-images.githubusercontent.com`. The first three are verified (Context, "GitHub facts"); the last two are GitHub's
  legacy image host and private-repository image host (not verified by a live request).
- AT2 Template `submission.attachments.formats`: `txt`, `log`, `md`, `json`, `patch`, `diff`, `zip`, `gz`, `png`, `jpg`, `jpeg`,
  `gif`. Images (`png`, `jpg`, `jpeg`, `gif`) are fetched, bounded, and hashed only; never decoded or parsed. Text formats are
  hashed only in M04. `zip` and `gz` are decompressed only to enforce `limits.attachments.decompressed_bytes` and list entries
  (AT6); a `.tar.gz` is decompressed as gzip; the tar inside is not listed.
- AT3 Built-in attachment URL shapes (core constants; I10 defines "attachment"): `https://github.com/user-attachments/files/<digits>/<name>`,
  `https://github.com/user-attachments/assets/<uuid>`, legacy `https://github.com/<owner>/<repo>/files/<digits>/<name>`, and any
  `https` URL whose host is `user-images.githubusercontent.com` or `private-user-images.githubusercontent.com`. A `github.com` URL
  outside those paths is a reference (SP07), not an attachment.
- AT4 Format detection: the lowercase text after the last `.` of the last path segment of the attachment URL; if that segment has
  no `.` (the `assets` shape), the last path segment of the final redirect URL; none found → format violation after fetch. The
  format must be in `submission.attachments.formats`.
- AT5 Fetch rules (every hop): scheme `https`; host in `submission.attachments.destinations`; no userinfo in the URL; every resolved
  address public (reject IPv4 `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`,
  `192.0.0.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `224.0.0.0/4`, `240.0.0.0/4`, `255.255.255.255`; IPv6 `::`, `::1`, `fc00::/7`,
  `fe80::/10`, `ff00::/8`, and IPv4-mapped or IPv4-compatible forms of rejected IPv4 ranges) and the connection uses the validated
  address (no second resolution); redirects at most `limits.attachments.redirects`; wall time at most
  `limits.attachments.fetch_seconds` per attachment; body at most `limits.attachments.file_bytes` (stop reading beyond) and the
  submission's running total at most `limits.attachments.total_bytes`; request carries no `Authorization`, cookie, token, or
  proxy credential and ignores proxy environment variables; bytes are SHA-256 hashed as received, before any other use.
- AT6 Archives: `zip` supports stored and deflate entries only; encrypted entries, ZIP64, multi-disk, symlink entries, and
  entry names that are absolute, contain `..` segments, backslashes, NUL or control characters, or exceed K23 bytes are violations;
  at most K22 entries; the sum of declared AND actual uncompressed sizes at most `limits.attachments.decompressed_bytes`; nested
  archives are not expanded. `gz`: single- or multi-member gzip, decompressed size at most `limits.attachments.decompressed_bytes`.
  Decompression uses `node:zlib` with `maxOutputLength`; no new dependency.
- AT7 Outcome mapping: count over `limits.attachments.count`, a host outside destinations, non-`https`, userinfo, format not
  allowed or undetectable, per-file or total bytes over limit, redirect count over limit, archive violation → blocking finding
  `submission.attachment-violation` (needs-changes). DNS failure, a non-public resolved address for an approved host, TLS
  failure, timeout, non-2xx final status (including the 404 an auth-gated private-repository attachment returns) →
  fetch failure: for a REQUIRED attachment (I10) an `inconclusive` cause `attachment-fetch-failed`; for an optional one an
  `advisory` finding `submission.attachment-unavailable` and a snapshot entry with `content_hash: null`.

### Gate item E — new hard-only constants (K-table; APPROVED 2026-09-26; values provisional)

Continues the M03 K1–K12 numbering. All are steward constants in `packages/core` (policy cannot set them), listed in architecture
§12.1 "Hard-only constants" when delivered. None is an author-facing length cap (I18).

| Row | Constant | Value | Basis |
| --- | --- | --- | --- |
| K13 | Submission body and field text maximum | 65536 UTF-16 code units | GitHub body limit; equals the record text bound; input-safety bound only |
| K14 | Preflight draft file maximum | 262144 bytes | 4 bytes per code unit of K13 |
| K15 | Submission title maximum (read, never parsed) | 1024 characters | Input-safety bound above GitHub's title limit |
| K16 | Changed paths per diff maximum | 3000 | The GitHub PR files API lists at most 3000 files; the local git diff uses the same bound |
| K17 | Changed path length maximum | 4096 bytes | Input-safety bound |
| K18 | GitHub API: response body maximum; request timeout; page size; pages per listing; longest honored retry wait | 5242880 bytes; 30000 ms; 100 items; 30 pages; 60 s | Bounded calls; 30 x 100 = K16 |
| K19 | Preflight GitHub request budget; retries per request (before any policy is known) | 20 requests; 2 retries | Bootstrap reads: repository, contents, tree, blob, linked issue |
| K20 | Open PRs sharing a head commit listed maximum | 100 | One page; more is treated as an unavailable read |
| K21 | Attachment URL length maximum | 2048 characters | Input-safety bound |
| K22 | Archive entries maximum | 1000 | Hostile-archive bound |
| K23 | Archive entry name maximum | 512 bytes | Equals the policy path bound |
| K24 | `gh auth token` subprocess timeout; output maximum | 10000 ms; 4096 bytes | Bounded call |
| K25 | Linked issues per PR | exactly 1 | Rule (I5), not a size cap |
| K26 | Author responses per snapshot | 1000 | Equals the record list bound |

### I-list — interpretations (ACCEPTED 2026-09-26: every item as written; every "Rejected alternative" is NOT implemented)

- I1 Issue-form version detection. Scan the body line by line, ignoring lines inside fenced code blocks (CommonMark ``` and ~~~
  fences of length 3 or more, closed by a fence of the same character and at least the same length) and inside HTML comments
  (`<!--` to `-->`, possibly multi-line). A heading line is `### <text>` (exactly three `#`, one or more spaces). For each form and
  each mapping version newest-first, the body matches when EVERY label of that version appears as a heading. The first matching
  version wins; kind = that form (defect or proposal). A label heading appearing more than once → `submission.field-duplicate`.
  Headings that are not labels of the matched version are field content. No full match → unstructured. Rejected alternative: accept a
  partial label set as structured with missing fields.
- I2 PR template parsing. The version comes only from the marker (Gate item A); marker absent → unstructured; two markers naming
  different versions → unstructured. Heading lines are `## <text>` (exactly two `#`), outside fences and comments. A known heading
  starts that field; an unknown `##` heading ends the current field and its section is not a field; deeper headings are content;
  a heading absent from the body is an absent field; a known heading appearing twice → `submission.field-duplicate`.
  Rejected alternative: detect PR versions by heading set like issue forms.
- I3 Field values and triviality. Raw value = the lines between a field's heading and the next structural heading, with
  leading/trailing blank lines removed (stored verbatim in records). A value is TRIVIAL when, after the D5 normalization, it is
  empty or equals (case-insensitive) one of `_No response_`, `N/A`, `NA`, `none`, `-`, `TBD`, `TODO`, `...`. A required field that
  is absent or trivial → `submission.field-missing`. The `security-claim` checkbox is present when its heading exists; its value is
  `true` exactly when the option line is `- [X]` or `- [x]` followed by the option label.
- I4 Issue kind comes only from the matched form. In preflight, `--issue <kind>` must match the draft's matched form; a draft that
  matches the other form or no form is unstructured for that kind.
- I5 PR `category` value: after removing HTML comments and trimming, one token, optionally wrapped in backticks, case-insensitive,
  equal to exactly one category id; empty → `submission.category-missing`; anything else (unknown word, several ids) →
  `submission.category-invalid`. `linked-issue` value: exactly one issue reference in THIS repository (`#<n>`, `<owner>/<repo>#<n>`
  naming this repository, or `https://github.com/<owner>/<repo>/issues/<n>` naming this repository), optionally preceded by a
  GitHub closing keyword; none → `submission.linked-issue-missing` when the category requires one; several distinct references, a
  cross-repository reference, a number that is not an existing issue (a PR number included), or an unreadable value →
  `submission.linked-issue-invalid`. Issue state (open or closed) is not checked; validation status of the linked issue is later
  work (stored-validation reuse is out of scope). Rejected alternative: allow cross-repository links.
- I6 Free-form. With `submission.free_form: true`, an unstructured body raises no `submission.unstructured` and no field rule
  (fields cannot be located); category determination for PRs uses only the diff (declared category absent), so category
  ambiguity rules still apply; attachment, path, shared-head, and linkage rules still apply (linkage is unmet when required,
  because no `linked-issue` field exists).
- I7 One glob syntax for the built-in lists and every policy glob (`trusted_paths.additional`, `execution_sensitive_paths.additional`,
  and later `supported_behavior.components[].paths`, `stages.high_impact_paths`, `escalation.sensitive_paths`): paths are
  repository-relative POSIX and case-sensitive; a pattern without `/` matches the last path segment at any depth; a pattern with
  `/` is anchored at the repository root; `**` as a whole segment matches zero or more segments; `*` matches any run of characters
  except `/` (including a leading `.`); `?` matches one character except `/`; every other character is literal (no braces,
  brackets, or negation). Matching is iterative and linear-bounded (no RegExp built from pattern text). No policy validation rule
  changes (M03 already checks path syntax), so the policy `version` stays 1.
- I8 Changed paths. A rename or copy contributes both its old and new path; additions, deletions, modifications, type changes
  (file to symlink, gitlink) all count. Category determination for PRs: declared category D (valid or absent); consistent set C =
  categories whose PC-rule the diff satisfies; plausible set P = C plus D when D is valid. MISMATCH when D is valid and not in C →
  `submission.category-mismatch` (uncertain). AMBIGUOUS when D is absent or invalid, or MISMATCH holds. Effective mode = the
  strictest mode (enforce > advise > observe) over P, or over all six categories when P is empty; when AMBIGUOUS and any category in
  P (or, when P is empty, any category) has mode `enforce` → additionally `submission.category-enforced-ambiguity` (uncertain) and
  `enforced: true`. Issues have no diff: category null; they use the declared form and issue contract.
- I9 Contract result. A pure `checkContract(input)` returns `{ disposition, findings[], requests[], enforced, effective_mode,
  category, plausible_categories, template, flags }` where `disposition` is `met`, `needs-changes`, `uncertain`, or `inconclusive`
  and is NEVER `pass` (the type cannot express it; `met` is not an outcome). Precedence mirrors processes SP13 step 1 restricted
  to the contract: (1) shared head → `needs-changes`; (2) any blocking contract finding → `needs-changes`; (3) any inconclusive
  cause → `inconclusive`; (4) any uncertain finding → `uncertain`; (5) otherwise `met`. M05's decision table later consumes the
  findings. Finding codes are the C-table below. Each blocking finding carries a numbered request text naming the field or rule and
  where the answer goes (the body field to edit); `submission.unstructured` requests include the template link (I22).
- I10 Attachments. An attachment is a URL in any field (Markdown link, image, autolink, or bare URL) matching an AT3 shape, or an
  `https` URL whose host is a destination the project added beyond the AT1 defaults. An attachment is REQUIRED when it appears in a
  field the policy requires for this submission (`categories.<category>.required_fields` for PRs, `submission.issue_fields.<kind>`
  for issues). Unstructured free-form bodies: every attachment is required. Duplicate URLs are one attachment. Preflight performs
  static checks only (count, destination, URL shape, format by URL where knowable) and never fetches; an extensionless URL there
  yields the warning `attachment.format-unverified`. Snapshot entries sort by URL.
- I11 Snapshot composition (processes §0.1, invariant 8) and hash. The snapshot is a strict Zod object with `snapshot_version: 1`;
  its hash is `canonicalJsonHash` (RFC 8785, `sha256:<hex>`). Issue snapshot: `repository`, `type: 'issue'`, `number`,
  `content_hash` (the issue content hash), `attachments` (`url`, `content_hash` or null), `author_responses` (`request_id`,
  `comment_id`, `content_hash` or null for a deleted comment), `policy_revision`. PR snapshot: `repository`, `type: 'pull_request'`,
  `number`, `target_branch` (base ref name), `head_commit`, `base_commit` (RECORDED, NOT HASHED; Q1 option B), `body_hash`,
  `linked_issues` (`repository`, `number`, `content_hash`), `attachments`, `author_responses`, `shared_head_pull_requests` (sorted
  numbers, excluding this PR), `policy_revision`. The snapshot hash of a PR snapshot is `canonicalJsonHash` of the snapshot object
  with the `base_commit` key omitted (every other key, including `target_branch`, is hashed); an issue snapshot has no
  `base_commit`. Two PR snapshots differing only in `base_commit` have equal hashes; comparison for freshness uses the hash only.
  The issue content hash and PR body hash are `contentHash` of the UTF-8 bytes of the body exactly as the API returns it (null →
  empty string). The title never enters the snapshot. Author responses are an input list (empty until the request ledger exists);
  M04 does not build the ledger. The trusted commit id never enters the snapshot.
- I12 Claim scope. Canonical text = RFC 8785 JSON of `{ "claim_scope_version": 1, "problem", "benefit", "intended-behavior",
  "acceptance-criteria", "linked-proposal": { "repository", "number", "content_hash" } or null }`, each text field normalized per D5
  (a lone CR also becomes LF; an unterminated `<!--` removes the rest of the field); hash = `canonicalJsonHash`. Claim scope is
  AVAILABLE only when the body is structured, all four fields are present, non-trivial, and not duplicated, and the linked-issue
  field is absent (then `linked-proposal` is null) or resolves to exactly one existing issue whose content hash was read;
  otherwise the result is `unavailable` with a reason (maintainer clarification required; never broadens acceptance).
- I13 GitHub read adapter: in `packages/core/src/github/`, using the global `fetch` (injectable for tests), base URL
  `https://api.github.com` only (GitHub.com; `GITHUB_API_URL` is not read), REST v3 with `Accept: application/vnd.github+json`
  and `X-GitHub-Api-Version: 2022-11-28`; no Octokit or other dependency. Every response body is size-bounded (K18) and
  Zod-validated with strict-enough schemas (unknown keys ignored, required keys checked); pagination via `Link` headers within K18;
  request and retry counts charged to a budget object (`limits.github.*` when a policy is known, K19 before). Retries only for
  5xx, network errors, and secondary rate limits, honoring `retry-after` up to K18 then failing. Typed failures `github.*` with
  causes `github-unavailable` (network, 5xx, timeout, oversize, malformed) or `rate-limited`; 401 and 403 without rate-limit
  headers → `github.unauthorized`; 404 → `github.not-found` (data, not necessarily a failure, for callers that expect absence).
  Reads: repository (`default_branch`, `private`, `full_name`), issue (reject when `pull_request` is present), pull request
  (`body`, `head.sha`, `base.ref`, `base.sha`, `draft`, `state`), PR files (`filename`, `status`, `previous_filename`), open PRs for a
  commit (`GET /repos/{o}/{r}/commits/{sha}/pulls`, filtered to `state: open` and `head.sha === sha`), issue comment by id, and the
  policy-directory reads of I15. Author identity fields are read into the adapter result (later caps and admission need them) but
  never enter a contract input (invariant 6).
- I14 Git adapter scope (extends `packages/core/src/git/`): merge-base of two commits; changed paths between two commits via
  `git diff-tree -r -z --name-status -M --no-ext-diff --no-textconv <a> <b>` parsed and bounded (K16, K17, K9); commit parent count
  (merge-commit identification); upstream remote discovery (`git remote`, `git remote get-url <name>`, URL forms
  `https://github.com/<o>/<r>(.git)`, `git@github.com:<o>/<r>(.git)`, `ssh://git@github.com/<o>/<r>(.git)`); reading the proposed
  policy at a commit reuses the M03 loader. All read-only, inert env, argv arrays, `--end-of-options` before user-supplied refs.
  Fetch by commit id and isolated checkouts are deferred to the sandboxed-execution milestone (SP17 inert materialization).
  Rejected alternative: add an inert fetch-by-commit now.
- I15 Policy via the GitHub API: the loader's `PolicySource` gains `{ kind: 'github', ... }` (additive). Flow: resolve the ref to a
  commit, list `.github` at that commit (contents API) and take the `patch-steward` entry's `sha` as the revision (tree id), read
  the tree (`GET /git/trees/{sha}?recursive=1`, `truncated` must be false), require `policy.yml` to be a regular blob (mode 100644 or
  100755) within K1, read it (`GET /git/blobs/{sha}`, base64), validate with the M03 pipeline, and check a Dockerfile runner path
  exists as a regular blob in that tree. The revision equals `git rev-parse <commit>:.github/patch-steward` for the same commit.
  Absent directory or `policy.yml` → "no published policy". The default checklist is the policy template's resolved policy,
  embedded in core as a constant (so the published CLI needs no template file at runtime) with a drift test proving it equals the
  resolved result of `templates/policy/policy.yml`. A published but INVALID policy is never replaced by the default: preflight
  exits 2 and prints the validation errors.
- I16 Records and metrics. The submission record gains OPTIONAL keys (additive; `schema_version` stays 1): `template` (`form`,
  `version`, or null), `snapshot` (the I11 object), `policy_change` (`changed`, `proposed`: `{ status: valid, revision }`,
  `{ status: invalid, revision, errors }`, `{ status: removed }`, or null), `attachments` (`url`, `format`, `bytes`, `content_hash`,
  `required`, `entries` for archives), `claim_scope_hash` (or null). M04 creates no run, so it writes no evidence and emits no
  metrics event; contract findings are typed data (convertible to finding records when a run exists).
- I17 A diff over K16 paths (API: PR `changed_files` > 3000 or a truncated listing; git: more entries) cannot be classified: finding
  `submission.diff-too-large` (uncertain, maintainer triage), trusted and execution-sensitive flags set to true (fail safe).
- I18 No author-facing length caps (deferred DF10). K13/K14/K15 are GitHub platform limits used only as input-safety bounds: an
  over-limit API body is a malformed response (`inconclusive`), an over-limit preflight draft is exit 2 citing GitHub's body
  limit; neither produces `needs-changes` or a request for a shorter text.
- I19 Live-probe test runner: add root `vitest.live.config.ts` (one project including `packages/*/src/**/*.live.test.ts`, same core
  alias) and root script `"test:live": "vitest run --config vitest.live.config.ts"`. `pnpm test` and CI are unchanged; the live
  tier never runs in CI. Live tests read only public test-bed data, use `GH_TOKEN` when set, and skip with a visible message when
  offline. Rejected alternative: no live tests (recorded fixtures only).
- I20 Reproduction files: no new field id; files go into the `reproduction-command` field as fenced code blocks (info string may
  name the file) or as attachments, as the form hint says. Rejected alternative: add a `reproduction-files` id (additive to the field-id
  vocabulary, the policy enum, and the record).
- I21 Preflight details. Upstream: `--repo owner/name` (validated) else the `upstream` remote else `origin`, parsed per I14; no
  GitHub remote and no `--repo` → exit 2. Base for `--pr`: `--base <ref>` else the local remote-tracking ref
  `refs/remotes/<remote>/<default branch>` of the upstream remote; unresolvable → exit 2 (advise `git fetch` or `--base`); no
  fetch is ever performed. Head = `HEAD` commit; changed paths = merge-base(base, HEAD) to HEAD, committed changes only (the
  working tree is not read). `--base` with `--issue` → usage error. The linked issue's existence is read through the adapter.
  Token: D6 order; `gh` run through the bounded process runner (K24), absent binary → skip; a present token rejected with 401 →
  exit 2 (no silent fallback); no token → unauthenticated reads with warning `github.unauthenticated` on stderr (text) or in
  `warnings` (JSON); unauthenticated 404 for the repository → exit 2 stating the repository is missing or private and a token is
  needed. Exit mapping: disposition `met` → 0; `needs-changes` or `uncertain` → 1; usage errors, unreadable or oversize draft,
  GitHub or git failures, invalid published policy → 2. Notice line (exact): `unverified: produced on the contributor's machine;
  official screening treats it as a claim`. Output always names the policy source (published revision with repository and
  commit, or `default checklist`).
- I22 The template link in requests: issues `https://github.com/<owner>/<repo>/issues/new/choose`; PRs
  `https://github.com/<owner>/<repo>/blob/<default-branch>/.github/pull_request_template.md`. The submission assistant does not
  exist yet, so requests do not link it; the assistant link joins when the assistant is delivered.
- I23 Issue forms carry no `labels:`, no severity field, and `required` flags equal to the template policy's issue field lists;
  element `id`s are the canonical field ids.
- I24 Policy-change flag (SP01 step 2): a changed path under `.github/patch-steward/` sets `policy_change.changed`; the proposed
  policy at the head commit is loaded and validated with the M03 pipeline and reported as data (bounded, escaped messages); the
  active policy (base/trusted) is the only one applied; a removed directory or `policy.yml` → `proposed.status: removed`. The flag
  is an `advisory` finding `submission.policy-change` and never changes the disposition by itself (the policy directory is also a
  trusted path).
- I25 Trusted-path change: sets `trusted_paths_changed: true` and an `advisory` finding `submission.trusted-path-change` ("prevents
  reliance on PR-controlled CI"; consumed by regression analysis later); it does not change the disposition by itself.
- I26 The compiled ecosystem for result parsing is chosen later (Rust or C++); the ES-list covers both now.

### Q-list — design questions (DECIDED 2026-09-26)

- Q1 DECIDED: Option B. The base commit is recorded in the snapshot object and excluded from the snapshot hash; the base ref
  (target branch) stays in the hash. Implemented per I11; documented per "Q1 documentation changes"; recorded by ADR-0055.
  Original question, kept for the ADR's context: Does the base commit enter the snapshot hash? Conflict: processes §0.1 ("head/base commits"), architecture invariant 8
  ("base and head commits"), and CLAUDE.md ("head, base, ...") list the base commit; architecture §6.4 publish recomputes "head,
  base ref, ..." and states "Base-branch movement is not revoked by the steward ... the report states the base commit it
  tested". A base-branch push fires no PR event, so with the base commit in the hash an unpublished run would end `superseded`
  after any base push with nothing to rescreen it until maintenance.
  - Option A (REJECTED): include `base_commit` in the hash (literal §0.1 and invariant 8; M04 exit criterion tests it as an input).
  - Option B (CHOSEN): record `base_commit` in the snapshot object but exclude it from the hash, like the trusted commit;
    the target branch (base ref) stays in the hash. Requires wording changes in processes §0.1, architecture invariant 8, and the
    CLAUDE.md snapshot invariant ("base ref; base commit recorded"), and the exit criterion's input list follows the amended §0.1.

### C-table — contract finding codes (PINNED 2026-09-26 with I9)

| Code | Severity | Disposition effect | Trigger |
| --- | --- | --- | --- |
| `submission.unstructured` | blocking | needs-changes | No supported template version matched (I1, I2) and `free_form` is false; request links the template (I22) |
| `submission.field-duplicate` | blocking | needs-changes | A mapped heading appears more than once |
| `submission.field-missing` | blocking | needs-changes | A policy-required field is absent or trivial (I3) |
| `submission.category-missing` | blocking | needs-changes | PR category field absent or trivial |
| `submission.category-invalid` | blocking | needs-changes | Category value is not exactly one category id |
| `submission.linked-issue-missing` | blocking | needs-changes | `categories.<c>.linked_issue: required` and no reference |
| `submission.linked-issue-invalid` | blocking | needs-changes | Reference not exactly one existing issue in this repository (I5) |
| `submission.attachment-violation` | blocking | needs-changes | Any AT7 violation; `detail` names the rule (`count`, `destination`, `scheme`, `userinfo`, `format`, `file-bytes`, `total-bytes`, `redirects`, `archive`, `decompressed-bytes`) |
| `submission.shared-head` | blocking | needs-changes (precedence 1) | Another open PR shares the head commit; names the PRs and the remedy |
| `submission.category-mismatch` | uncertain | uncertain | I8 MISMATCH |
| `submission.category-enforced-ambiguity` | uncertain | uncertain | I8 AMBIGUOUS with an enforced plausible category |
| `submission.execution-sensitive-change` | uncertain | uncertain | A changed path matches ES-list or `execution_sensitive_paths.additional` (required maintainer triage even if container runs pass) |
| `submission.diff-too-large` | uncertain | uncertain | I17 |
| `submission.attachment-unavailable` | advisory | none | Optional attachment fetch failed (AT7) |
| `submission.trusted-path-change` | advisory | none | I25 |
| `submission.policy-change` | advisory | none | I24 |

Inconclusive causes (typed failures, not findings): `attachment-fetch-failed` (required attachment), `github-unavailable`,
`rate-limited` (GitHub reads during capture), `policy-unavailable`, `policy-invalid` (active policy). Severity assertions in any
field never produce, remove, or change a finding (P07); no code reads authorship.

### Module layout (recommended; the decomposer may refine names but not responsibilities)

- `packages/core/src/submission/`: `markdown-scan.ts` (fences, comments, headings; bounded), `field-mapping.ts` (A-table v1,
  version registry newest-first, PR marker), `parse.ts` (body → parsed submission), `normalize.ts` (D5 normalization, triviality,
  claim scope), `globs.ts` (I7 matcher), `path-lists.ts` (TP, ES, PC constants), `paths.ts` (classification, flags, category
  consistency), `attachments.ts` (extraction, static rules, AT7 mapping), `snapshot.ts` (I11 schema, hash), `contract.ts` (I9),
  `intake.ts` (capture for issue and PR through the adapters: fetch, parse, paths, attachments, shared heads, linked issue,
  proposed policy, snapshot, record), `default-checklist.ts` (I15).
- `packages/core/src/github/`: `reader.ts`, `schemas.ts`, `budget.ts`.
- `packages/core/src/net/`: `attachment-fetch.ts` (AT5, via `node:https` with a validating `lookup`), `address-policy.ts`,
  `archive.ts` (AT6).
- `packages/core/src/git/`: `diff.ts`, `remotes.ts` (extensions; `reader.ts` unchanged unless needed).
- `packages/core/src/policy/loader.ts`: GitHub source (I15).
- `packages/cli/src/`: `preflight-command.ts`, `github-auth.ts`, `cli.ts` dispatch and usage text gain `preflight`.
- New bound constants live in `packages/core/src/policy/bounds.ts` (with the M03 K constants) or a sibling bounds module
  re-exported from the root; every new export name is unique across core (`export *` collisions fail tsc TS2308).

### `steward preflight` (D7, I21)

- Syntax: `steward preflight (--issue defect|proposal | --pr) --draft <file.md> [--repo owner/name] [--base <ref>] [--json]`. Exactly
  one of `--issue <kind>` or `--pr`; `--draft` required; `--base` only with `--pr`. Parsing with `node:util` `parseArgs`. Usage
  errors reuse `usage.unknown-option`, `usage.invalid-arguments`, `usage.conflicting-options` (exit 2).
- Draft: read at most K14 bytes; strict UTF-8 (one leading BOM stripped); CRLF accepted; parsed exactly as the corresponding
  GitHub body (I1, I2).
- Policy: upstream default-branch policy via the GitHub API source (I15); absent → default checklist; invalid → exit 2.
- Contract: the same `checkContract` as screening; PR: category, required fields, linkage (existence read), attachments (static,
  I10), trusted and execution-sensitive detection and the policy-change flag over the local diff (I14, I21); no snapshot hash and no
  shared-head check (no PR exists yet).
- Output: human lines on stdout (notice line, policy source line, disposition line, one line per finding with code, field or path,
  and escaped bounded message, requests, flags) and warnings on stderr; `--json` prints one object on stdout with at least
  `schema_version: 1`, `unverified: true`, `notice`, `submission` (`type`, `issue_kind`), `policy` (`source`: `published` or
  `default-checklist`, `repository`, `ref`, `commit`, `revision`), `contract` (`disposition`, `findings`, `requests`, `category`,
  `plausible_categories`, `effective_mode`, `enforced`), `paths` (`trusted_changed`, `execution_sensitive_changed`, `policy_change`)
  or null for issues, `warnings`. The exact line formats and field names are pinned by the decomposer and quoted by the docs.
- Never: writes to GitHub, fetches git objects, reads the working tree, runs policy commands or any repository command, sends
  telemetry, stores or prints the token.

### Templates

- New: `templates/issue-forms/steward-defect.yml`, `templates/issue-forms/steward-proposal.yml`,
  `templates/pull-request/pull_request_template.md` per the A-table; Prettier-clean; valid GitHub issue-form syntax (top-level
  `name`, `description`, `body`; element `type`, `id`, `attributes.label`, `attributes.description`, `validations.required`);
  a drift test in core parses the committed forms (with the `yaml` library through the strict-YAML parser or plain `yaml.parse`)
  and asserts label and id sets equal the v1 mapping, and parses the PR template to assert marker and headings equal the mapping.
  Parsing each committed template as a body (the PR template as a PR body; each form rendered with all fields `_No response_`)
  yields a structured v1 match with every required field missing.
- Changed: `templates/policy/policy.yml` `submission.attachments.destinations` and `formats` = AT1 and AT2 (values only; editor
  schema unchanged; the file stays valid and Prettier-clean; `steward policy --file templates/policy/policy.yml` still exits 0
  with only the placeholder-model warning); `templates/README.md` lists the new files (no planning ids).

### Fixture corpus (root `fixtures/`)

- `fixtures/submissions/` with `.txt` bodies and drafts (byte-exact; LF in committed blobs unless a test needs CRLF, which it builds
  in code), `.json` diffs and expectations (Prettier-clean). Required cases (each named in `expectations.json` with its expected
  template match, finding codes, and disposition under a named policy variant):
  - defect: complete; one required field `_No response_`; a duplicated label heading; a label heading only inside a fence (still
    matches); headings inside an HTML comment; a deleted label heading (unstructured); severity language ("critical",
    "severity: high", "P0") in every text field (identical findings to the same body without it); prompt-injection and
    shell/workflow-expression text (`${{ secrets.GITHUB_TOKEN }}`, `$(rm -rf /)`, backticks) that stays data; the security
    checkbox checked and unchecked.
  - proposal: complete; missing benefit.
  - unstructured body with `free_form: false` (needs-changes, template link) and with `free_form: true` (no unstructured finding).
  - PR: complete bugfix with code diff (met); missing marker; duplicated heading; unknown `##` section; category missing,
    invalid, several ids; `docs` with a code path (mismatch → uncertain); ambiguous category with `bugfix` in `enforce`
    (enforced ambiguity → uncertain, `enforced: true`); `chore` touching only `package.json` (execution-sensitive → uncertain);
    workflow change (trusted flag); policy-directory change with a valid and an invalid proposed `policy.yml` (flag plus
    validation data, active policy unchanged); linked issue missing, cross-repository, several; shared head (needs-changes);
    attachment count, format, destination violations.
  - Control and format characters (NUL, ESC, bidi overrides, zero-width) are generated in test code, never committed raw.
- `fixtures/github/`: recorded REST responses (`.json`, Prettier-clean) captured read-only from
  `steady-orchard/patch-steward-testbed-public` (repository, issues 29 and 30, PRs 26–28, their files, commit pulls, contents
  `.github`) plus hand-built hostile variants (missing keys, wrong types, oversize, truncated pagination); a provenance section in
  `fixtures/README.md` names repository, endpoint, and capture date (no planning ids). A test asserts no recorded file matches a
  built-in credential detector.
- `fixtures/README.md` lists the new entries.

### Conformance checks (`packages/core/src/conformance/`)

- `invariant-1`: hostile body, draft, API, and diff content stays data: parsing and contract checks spawn no process (process-runner
  spy), make no network call except through injected adapters, evaluate nothing, and return the text unchanged in fields;
  workflow-expression text is never interpolated; human CLI output escapes control characters.
- `invariant-6`: contract inputs have no authorship field (compile-time check via a mapped-type assertion over `ContractInput`
  keys) and varying author login, association, account age, and AI-disclosure text in the adapter data leaves every contract
  result identical; severity assertions change nothing.
- `invariant-8`: snapshot hash stable under title-only edits; changes with each I11 input (named test per input, titles
  `snapshot hash changes with <input>`); tests titled `snapshot hash is unchanged by the base commit` (same PR snapshot, different
  `base_commit`, equal hashes, and the `base_commit` value is still present in the snapshot object) and `snapshot hash is
  unchanged by the trusted commit` pass.
- `invariant-5` (extended): every new adapter rejects malformed responses with a typed failure; every exported function matching
  `/^(load|validate|resolve|parse|capture|check)/` has a rejection case (the M03 pinned list grows accordingly).
- `never-pass` tables gain every new failure-code union (`github.*`, new `git.*`, attachment fetch and archive codes, preflight
  codes); each maps to a non-pass result. Invariant 4: no contract disposition value is `pass`.
- Zero model calls and zero executions: a test over the whole fixture corpus and the preflight path asserts the process-runner
  spy saw only allowlisted git read subcommands and `gh auth token`, and that no module in the submission, github, net, or cli
  preflight path imports an LLM or runner module (none exists; the test guards the future).

### ADR inventory (MADR; Status accepted; Date = gate approval date; Deciders: project owner; `Source` = governing location; no planning ids)

FINAL (gate approved 2026-09-26): exactly 12 new records, ADR-0050 through ADR-0061; the Records table in `docs/adr/README.md`
goes from 49 to 61 rows. No existing ADR is superseded (verified: no record in `docs/adr/` decides snapshot composition or the
base commit's role).

| ADR | Title | Records |
| --- | --- | --- |
| ADR-0050 | Versioned field mapping by rendered labels and a PR template marker | D1, I1–I4, I23 |
| ADR-0051 | One glob syntax for repository paths | I7 |
| ADR-0052 | Built-in path classes for category consistency | D2, I8 |
| ADR-0053 | Built-in trusted and execution-sensitive path lists | D3, I25, I26 |
| ADR-0054 | Attachment destinations, formats, and fetching | D4, I10 |
| ADR-0055 | Snapshot composition and hashing | I11, Q1 option B (base commit recorded, not hashed; base ref hashed) |
| ADR-0056 | Canonical claim-scope text | D5, I12 |
| ADR-0057 | Deterministic contract result | I9, I17, I18 |
| ADR-0058 | GitHub read adapter without an SDK dependency | I13, I15 |
| ADR-0059 | CLI GitHub authentication | D6 |
| ADR-0060 | `steward preflight` command | D7, I21, I22 |
| ADR-0061 | Live-probe test runner | I19 |

ADR-0055 content requirements (Q1): Context states the conflict in design-document terms only (the snapshot definition listed
the base commit while publication recomputed the base ref, and a base-branch push fires no pull-request event, so hashing the
base commit would make unpublished runs end `superseded` with nothing to rescreen them); Considered Options = hash the base commit
/ record the base commit without hashing it; Decision Outcome = the second, with the base ref (target branch) hashed, the base
commit recorded like the trusted-branch commit, the report stating the base commit it tested, and base-branch movement handled by
strict up-to-date branches or a merge queue (architecture §6.4), never by the steward revoking checks; `Source` names processes
§0.1 and architecture invariant 8. No option letters, question ids, or planning ids in the record.

Each ADR's More Information says "The project owner decided this on" followed by the gate approval date written as in the M03
records (for example "September 26, 2026."). `docs/adr/README.md` Records table gains one
row per new record (Prettier-aligned).

### Documentation change inventory (governing document first; persistence and deferred rules apply)

- `docs/architecture.md`: §6.2 Submission row (delivered scope); §6.3 GitHub row (reads delivered; REST via fetch; api.github.com),
  Git row (delivered: diffs, merge-base, merge identification; fetch and checkouts not yet); §6.5 preflight row plus syntax and
  exit-status paragraph for `steward preflight` (like `steward policy`), and the CLI authentication paragraph (D6 order); §6.7
  (template source paths in `templates/`, PR marker); §8 Trusted paths and Execution-sensitive paths rows (built-in lists named by
  group; full lists in the configuration reference; glob syntax), Submission row (attachment defaults; free-form behavior; field
  mapping); §9 Submission row (snapshot, template version, policy-change data, claim-scope hash) and the claim-scope paragraph (D5
  text); invariant 8 per "Q1 documentation changes"; §12.1 hard-only constants gain K13–K26 by name; §13 attachment-fetch threat row (SSRF, private
  addresses, credentials) if absent; "Status" line at top.
- `docs/processes.md`: §0.1 Snapshot per "Q1 documentation changes" and I11; SP01 step 2 (proposed-file validation delivered); SP05 CLI steps 1–2 and
  failure handling (syntax, upstream, default checklist, invalid published policy); SP06 steps 3–7 (mapping and marker, category
  classes and enforced ambiguity, contract codes and severity, attachment rules, path lists, linkage rules without stored-validation
  reuse); "Status" line at top. "Addresses" fields unchanged unless a mechanism changes.
- `docs/whitepaper.md` §4 (submission contract: mapping and marker, if wording needs it) and §9–§14 (§14 "Implemented so far",
  decisions list for the new ADRs, open-decision list synced with architecture §15).
- `README.md` Status; `CLAUDE.md` Project state, Commands (preflight source-run line; `pnpm test:live`), snapshot invariant per
  "Q1 documentation changes".
- User manual: `configuration.md` (resolve the `[NEEDS INPUT]` field-mapping callout: A-table, issue forms, PR template, marker;
  built-in TP, ES, PC lists and glob syntax; attachment defaults and rules; Vitest live runner); `commands.md` (new
  "`steward preflight` (Available)" section: syntax, options, output, JSON fields, exit statuses, auth, examples; remove preflight
  from "CLI commands (Proposed)" or mark only mandatory commands and self-review as proposed); `usage.md` ("Prepare a submission":
  preflight deterministic part available, resolve its callout; "Report a defect or propose a change": exact labels, resolve the
  issue-form callout; "Submit a pull request": template headings and marker); `troubleshooting.md` (submission-correction rows
  quoting the C-table codes; preflight exit 2 causes); `overview.md` Snapshot row per "Q1 documentation changes".
- `templates/README.md`, `fixtures/README.md`.
- Persistence rule: none of these files may cite M-ids, PD-ids, owner-decision numbers, D/I/K/Q/A/C/AT/PC/TP/ES row ids of this
  brief, phase or step numbers, `development-artifacts/`, or the plan. Deferred rule: no mention of deferred features outside
  `docs/deferred.md` (an ADR may name a rejected alternative by DF id with a link, one line); no length-cap wording anywhere.

### Q1 documentation changes (owner-added scope, 2026-09-26; sites read at 5a0e21f, line numbers shift — locate by quotation)

Rule to state everywhere the snapshot inputs are listed: the snapshot binds the target branch (base ref) and the head commit; the
base commit is recorded with the snapshot (and stated in the report) but, like the trusted-branch commit, does not enter snapshot
comparison, so base-branch movement never supersedes a run. Governing documents first (architecture, processes), then summaries.

| Site | Current text (quoted exactly; may wrap) | Required change |
| --- | --- | --- |
| `docs/architecture.md` §2 invariant 8 (line 78) | `Reports bind to a submission snapshot: repository, target branch, base and` / `head commits (or issue content hash),` | List `head commit` (not "base and head commits"); add one sentence: the base commit is recorded with the snapshot and stated in the report but does not enter snapshot comparison, so base-branch movement never supersedes a run (cite §6.4). |
| `docs/processes.md` §0.1 Snapshot row (line 30) | `Repository, head/base commits or issue content hash, target,` | `head commit or issue content hash, target branch (base ref)`; add that the base commit is recorded but not compared (cite architecture invariant 8). Table stays Prettier-aligned. |
| `docs/architecture.md` §6.4 publish recompute list (line 391) | `recomputes the live snapshot (head,` / `base ref, body hash, ...` | Already consistent (base ref, no base commit); verify only, no edit required. |
| `docs/architecture.md` §9 Submission row (line 758) | `Repository, type, number, snapshot hash, target branch and head (PRs)` | Already consistent; when this row is edited for the snapshot object, name `base commit (recorded, not hashed)` among the snapshot contents. |
| `CLAUDE.md` Invariants bullet (line 96) | `A run certifies a snapshot (head, base, body hash,` | `head, base ref, body hash, ...`, plus "the base commit is recorded but never enters snapshot comparison". |
| `docs/whitepaper.md` §8 (line 413) | `body/linked evidence, persistent author responses, target/base/head, sharing` | `target/head` (base ref = target), plus that the base commit is recorded but does not enter comparison. |
| `docs/whitepaper.md` §9–§14 | none restates snapshot inputs at 5a0e21f | §14 "Implemented so far" names delivered snapshot hashing; the whitepaper decisions list gains ADR-0055 like every new ADR. Re-grep before editing. |
| `docs/user-manual/overview.md` Snapshot row (line 48) | `The inputs certified by a run: commits or issue content, target,` | `head commit or issue content, target branch`; add that the base commit is recorded, not compared. Table Prettier-aligned. |

Any further persistent site restating the snapshot inputs with the base commit (re-run
`git grep -n -i -E 'head/base|base and head commit|head, base,|target/base' -- docs README.md CLAUDE.md` before Phase 5 edits)
is in scope under the same rule. SP06 "Inputs" (`head and base commits, diff paths`) and the §9 Run row (`Base/head or group
commit`) list screening inputs and run provenance, not snapshot inputs: unchanged. ADR-0055 records the decision; no persistent
file cites Q1, option letters, or planning ids.

## Constraints

- Branch: all commits on `milestone/4-submission-intake-and-contract-check`; worktrees base on its current local HEAD; no push; no
  GitHub writes of any kind (live access is read-only).
- OWNER GATE APPROVED 2026-09-26: gate items A–E, the I-list, the C-table, and Q1 option B are binding exactly as written in this
  brief. Any change to them needs a planner amendment with owner approval.
- Do NOT edit `docs/project-development-plan.md` or `docs/astra-plan.md`.
- No new dependencies (runtime or dev); `pnpm-lock.yaml` unchanged. Built-ins only: `fetch`, `node:https`, `node:dns`, `node:zlib`,
  `node:crypto`, `node:child_process` through the M03 process runner.
- Untrusted text (bodies, drafts, API data, diff paths, attachment bytes and names) reaches no shell, no `eval`, no dynamic
  `RegExp` built from untrusted or policy text, no prototype-polluting object (null-prototype maps or rejected `__proto__`,
  `constructor`, `prototype` keys), and no authorization decision; printed excerpts are bounded and escaped (reuse
  `policy/messages.ts` escaping).
- No contract rule reads authorship, account history, AI assistance, or presentation quality; severity language is ignored.
- The contract result type cannot express `pass`; every steward-side failure is typed with `outcome: 'inconclusive'`.
- No author-facing length cap (DF10); no deferred feature, reserved key, or setting.
- No model call, no LLM or runner module, no execution of repository or policy commands anywhere in M04.
- CI: unit and fixture tiers make no live GitHub call; live tests exist only as `*.live.test.ts` under the I19 runner.
- Every Prettier-checked file is Prettier-clean at commit; `pnpm lint`, `pnpm build`, `pnpm typecheck` clean; byte-exact
  fixtures use `.txt`; tests that need exact bytes build them in code; never run a formatter on `development-artifacts/`.
- Governing documents first; persistence and deferred rules as above; Prettier-aligned tables in docs.

## Assumptions

- The owner answered the gate on 2026-09-26 (recorded in "Owner gate"); the approved values are the ones written in place.
- GitHub's REST responses keep the shapes recorded in `fixtures/github/` during the milestone; live tests detect drift.
- Network access to api.github.com and the attachment hosts exists on the development machine for live tests and DoD live
  commands; CI needs none.
- The public test-bed `steady-orchard/patch-steward-testbed-public` keeps issues #29, #30 and PRs #26–#28 and has no
  `.github/patch-steward/` directory.

## Out of scope

- Merge-group branch of SP06 step 2; stored-validation reuse and linked-issue validation status (SP06 step 7 reuse); ownership,
  checks, gate job, caps, admission, dedup, evidence store, report rendering, decision table, metrics emission (M05, M06).
- Author-response ledger construction (SP14); M04 accepts responses as input only.
- Reference extraction and verification (SP07), claim classification (SP08), security-term escalation, reproduction, execution,
  sandbox, inert fetch and checkouts, mandatory-command preview (M07), self-review (M09), the browser assistant (M18).
- `steward init`, `screen`, `replay`, `report`; installing templates into target repositories.
- New policy keys (D2 forbids them); changes to policy validation rules.
- CI workflow changes; Vitest unit/fixture project changes; ESLint or Prettier configuration changes.
- Edits to plan documents; the 0.x release.

## Definition of Done (project)

Run in the main tree (`cd /c/Users/John/Projects/steady-orchard/patch-steward`), Git Bash, after the last phase. `S` =
`8ae8c6f9b6906205a3a4c74110c30462237f5860`. Items are binding as written (gate applied 2026-09-26; item 3 reflects Q1 option B;
items 11 and 14 reflect I19 accepted; item 19 is the owner-added Q1 documentation scope).

1. Toolchain: `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check`
   exits 0; `git diff --quiet S HEAD -- pnpm-lock.yaml` exits 0 and no `packages/*/package.json` gains a dependency.
2. Fixture corpus (exit criterion 1): the fixture-tier test over `fixtures/submissions/expectations.json` passes and fails if a
   fixture lacks an entry or an entry lacks a file; the expectations include, with the pinned C-table codes and dispositions:
   duplicated field → `submission.field-duplicate`, `needs-changes`; ambiguous category value → `submission.category-invalid`,
   `needs-changes`; unstructured with `free_form: false` → `submission.unstructured`, `needs-changes`, a request containing the
   template link; unstructured with `free_form: true` → no `submission.unstructured`; docs with a code path →
   `submission.category-mismatch`, `uncertain`; ambiguity with an enforced category → `submission.category-enforced-ambiguity`,
   `uncertain`, `enforced: true`; policy-directory change → `submission.policy-change` with proposed-file validation data and the
   active policy revision unchanged; execution-sensitive change → `submission.execution-sensitive-change`, `uncertain`.
3. Snapshot (exit criterion 2): `pnpm vitest run packages/core/src/conformance/invariant-8.test.ts --reporter=json` passes with
   the tests `snapshot hash is stable under title-only edits` and one `snapshot hash changes with <input>` per I11 input
   (PR: repository, number, target branch, head commit, body, linked issue content, attachment bytes, author response, shared-head
   set, policy revision; issue: content, attachment bytes, author response, policy revision), plus the tests `snapshot hash is
   unchanged by the base commit` and `snapshot hash is unchanged by the trusted commit`, none skipped. No test titled
   `snapshot hash changes with base commit` exists.
4. Severity and authorship (exit criterion 3): `pnpm vitest run packages/core/src/conformance/invariant-6.test.ts` passes,
   including a test titled `severity assertions are ignored` and one titled `contract ignores authorship`, none skipped.
5. Attachments (exit criterion 4): `pnpm vitest run -t 'attachment rule'` runs at least one test per AT7 violation kind and per
   AT5 rule (destination, scheme, userinfo, private address, redirect count, redirect to unapproved host, fetch time, file bytes,
   total bytes, decompressed bytes, archive structure, no credentials forwarded, hash before handoff), all passing; tests titled
   `required attachment fetch failure is inconclusive` and `optional attachment fetch failure is advisory` pass.
6. Zero model calls and executions (exit criterion 5): a test titled `zero model calls and zero executions` passes over every
   fixture and the preflight path.
7. Injected failures: `pnpm vitest run packages/core/src/conformance packages/core/src/github packages/core/src/net` passes; the
   never-pass tables include every new failure-code union (compile-time exhaustive).
8. Templates: the three template files exist at the A-table paths; the mapping drift tests pass;
   `node packages/cli/dist/main.js policy --file templates/policy/policy.yml; echo "exit=$?"` prints `exit=0`;
   `git show HEAD:templates/policy/policy.yml` shows the AT1 destinations and AT2 formats; `pnpm prettier --check templates` exits 0.
9. Preflight (live, read-only; requires network; `R` = repo root):

   ```bash
   R=/c/Users/John/Projects/steady-orchard/patch-steward; cd "$R"
   node packages/cli/dist/main.js preflight --issue defect --draft fixtures/submissions/<complete defect draft>.txt --repo steady-orchard/patch-steward-testbed-public; echo "exit=$?"
   node packages/cli/dist/main.js preflight --issue defect --draft fixtures/submissions/<defect draft missing a field>.txt --repo steady-orchard/patch-steward-testbed-public --json; echo "exit=$?"
   node packages/cli/dist/main.js preflight --issue defect --pr --draft x.txt; echo "exit=$?"
   node packages/cli/dist/main.js preflight --issue defect --draft does-not-exist.txt --repo steady-orchard/patch-steward-testbed-public; echo "exit=$?"
   ```

   Expected: first run prints the exact notice line, a policy line naming the default checklist, and `exit=0`; second prints JSON
   with `"unverified":true`, `submission.field-missing`, and `exit=1`; third and fourth print `exit=2`. Plus a temp-repository
   script (pinned by the decomposer) with remote `origin` = `https://github.com/steady-orchard/patch-steward-testbed-public.git`,
   a base commit and a head commit: a complete bugfix PR draft linking `#29` with a `src/` change → `exit=0`; the same with a
   `package.json` change → `submission.execution-sensitive-change`, `exit=1`; a docs draft with a `src/` change →
   `submission.category-mismatch`, `exit=1`; a `.github/patch-steward/policy.yml` change → `submission.policy-change` with proposed
   validation data.
10. CLI tests: `pnpm vitest run packages/cli` passes, covering preflight usage errors, exit mapping, auth order (`GH_TOKEN`,
    `GITHUB_TOKEN`, `gh auth token`, unauthenticated warning, 401 exit 2, missing-or-private exit 2), default checklist, invalid
    published policy exit 2, and JSON shape, all with recorded responses (no network).
11. Live tier (I19 accepted): `GH_TOKEN=$(gh auth token) pnpm test:live` passes; `pnpm test` runs no `*.live.test.ts` file;
    `git diff --quiet S HEAD -- .github/workflows` exits 0 (CI unchanged).
12. Conformance: `pnpm vitest run packages/core/src/conformance` passes with files `invariant-1`, `invariant-5` (unit and fixture),
    `invariant-6`, `invariant-8`, plus the M03 files.
13. Records: the submission record schema accepts records with and without every new optional key and still rejects unknown keys
    and a wrong `schema_version`; `schema_version` stays 1.
14. ADRs: `ls docs/adr/00{50..61}-*.md | wc -l` prints `12` and `ls docs/adr/0062-*.md` fails (no extra record); each has the
    MADR metadata and section order; `grep -c '^| \[ADR-' docs/adr/README.md` prints `61`; `git diff --quiet S HEAD -- $(ls docs/adr/00[0-4][0-9]-*.md)`
    exits 0 (no existing record changed).
15. Persistence: `git grep -c -P '(?<![A-Za-z0-9])M[0-2][0-9](?![0-9])|(?<![A-Za-z0-9])PD0[1-8](?![0-9])|development-artifacts|project-development-plan|astra-plan|patch-steward-m[0-9]' HEAD -- docs README.md CLAUDE.md fixtures templates ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
    prints exactly `HEAD:CLAUDE.md:2` and `HEAD:docs/user-manual/configuration.md:1` (the baseline at `S`, measured by the planner
    2026-09-26; configuration.md's line may disappear, nothing may be added), and
    `git grep -n -P 'owner decision|(?<![A-Za-z])(D|I|K|Q|AT|PC|TP|ES)[0-9]{1,2}(?![0-9])|[Oo]ption [AB](?![a-z])' HEAD -- docs/adr/00{50..61}-*.md` prints
    nothing (review any hit by hand).
16. Deferred: `git grep -c -E 'DF[0-9]{2}|deferred\.md' HEAD -- docs README.md CLAUDE.md templates fixtures ':!docs/deferred.md' ':!docs/adr' ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
    prints exactly `HEAD:CLAUDE.md:3` and `HEAD:README.md:1` (baseline at `S`); `git grep -c -i -E 'length cap|concise version' HEAD -- docs templates README.md CLAUDE.md ':!docs/deferred.md' ':!docs/project-development-plan.md' ':!docs/astra-plan.md'`
    prints exactly `HEAD:docs/architecture.md:1`, `HEAD:docs/processes.md:1`, `HEAD:docs/whitepaper.md:1` (baseline at `S`: the
    three report-length-cap sentences, which concern steward reports, not author text).
17. Documentation truth: `docs/user-manual/commands.md` marks `steward policy` and `steward preflight` Available and every other
    CLI command Proposed; README Status and CLAUDE.md Project state name the delivered M04 scope and nothing more (no screening
    stage, gate, publish, report, evidence store, or LLM adapter described as working); `git grep -n 'NEEDS INPUT' HEAD --
    docs/user-manual/configuration.md docs/user-manual/usage.md` no longer shows the field-mapping, issue-form, or preflight-format
    callouts.
18. Redaction of committed recordings: the test asserting no file under `fixtures/github/` matches a built-in credential detector
    passes.
19. Snapshot documentation (Q1 option B; whitespace-normalized so Prettier wraps do not matter):

    ```bash
    for f in docs/architecture.md docs/processes.md CLAUDE.md docs/whitepaper.md docs/user-manual/overview.md; do
      printf '%s ' "$f"; git show "HEAD:$f" | tr '\r\n' '  ' | tr -s ' ' | grep -o -i -E 'head/base commits|base and head commits|snapshot \(head, base,|target/base/head|certified by a run: commits or issue content' | wc -l
    done
    ```

    prints `0` for every file (baseline at 5a0e21f: `1` for each of the five). Each of the five sites in "Q1
    documentation changes" states, in its own words, that the base commit is recorded but does not enter snapshot comparison
    (reviewed by reading each site at HEAD); `docs/adr/0055-*.md` exists with Decision Outcome recording base ref hashed and base
    commit recorded but not hashed.
