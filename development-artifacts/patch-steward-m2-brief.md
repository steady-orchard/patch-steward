# patch-steward-m2 — Brief

## Goal

Execute milestone M02 ("Platform assumption probes") of `docs/project-development-plan.md`: verify on the three disposable
test-bed repositories, with the test GitHub App, the nine GitHub and Copilot platform assumptions that `docs/architecture.md`
depends on; record every assumption as `confirmed`, `refuted`, or `undetermined` with evidence; keep the probes as a re-runnable
regression suite against platform drift; record measured platform limits; route every refuted or undetermined result to the
project owner for an approved design change or an accepted limitation; then correct the governing documents, architecture
first. M02 delivers no package code and no product behavior.

Phase 7 (owner order of 2026-09-25, amendments 9 and 10; section "Phase 7 — Architecture decision records"): before the
squash merge, record every design decision made so far as a persistent MADR architecture decision record under `docs/adr/`
(ADR-0001–ADR-0033), remove the duplicated architecture decision record (the §1.2 table; plan §9 stays — decisions in the
planning document are not removed) after restating in the governing documents every §1.2 clause they did not already
state (amendment 12: RS1–RS10), rewrite every citation of an architecture decision number to its ADR id, leave no
persistent document citing a planning or implementation document or identifier (owner persistence rule; `probes/`
excepted for now), and leave no path under `development-artifacts/` cited outside that directory.

## Context

### Repository facts (read at commit 10fcaf2d575037be7c13e0ba0719feb53d51d71f, except the `.prettierignore` facts, read at 49ef1bf7bc408da7d2676f859cf144a9b950d3c6 — every line number in this brief was read at 10fcaf2 and shifts as files are edited; locate text by quotation and re-verify against live files; `docs/`, `README.md`, `CLAUDE.md` are still unchanged at 3bb74ba, so the line numbers hold until Phase 5 edits them)

- Repo root: `C:\Users\John\Projects\steady-orchard\patch-steward`. Remote `origin = git@github.com:steady-orchard/patch-steward.git`
  (PUBLIC repository — everything committed here is world-readable). Remote default branch `develop`; release branch `master`.
- Working branch for this plan: `milestone/2-platform-assumption-probes` (local, checked out, not pushed). Nothing in this plan
  pushes to `steady-orchard/patch-steward`, opens a PR there, or changes its settings.
- Environment: Windows 11; PowerShell is the owner's primary shell; Git Bash is available and all commands in this brief are
  bash. Local Node is v22.15.0 (project pins 24; pnpm prints `WARN Unsupported engine` for `packages/cli` — warning only). pnpm
  10.20.0. `gh` 2.93.0. git 2.55.0. `core.autocrlf=true` (compare committed content with `git show HEAD:<path>` or
  `git rev-parse HEAD:<path>`, never working-tree bytes). `jq` is NOT installed — use `gh ... --jq`. `actionlint` 1.7.12 is
  installed (`/c/ProgramData/chocolatey/bin/actionlint`); it reports a false positive `unknown permission scope "copilot-requests"`
  (verified 2026-09-18) — suppress exactly that message with `-ignore 'unknown permission scope "copilot-requests"'`.
- Toolchain commands (from repo root): `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format`,
  `pnpm format:check`. `pnpm format:check` and `pnpm lint` both pass at the starting commit and at `49ef1bf` (verified
  2026-09-18).
- Prettier 3.9.6 (`.prettierrc.json`: `semi`, `singleQuote`, `trailingComma: all`, `printWidth: 132`, `endOfLine: auto`) checks
  EVERY file not in `.prettierignore`: all Markdown (including `docs/`, `README.md`, `CLAUDE.md`, and the new `probes/`), all
  YAML, all JSON. Prettier reformats fenced code blocks whose language it knows (`json`, `yaml`, `js`, `ts`), and rewrites
  `*`/`_` in Markdown prose. Verbatim evidence in a format-checked file (everything under `probes/`) must therefore sit in
  fenced blocks with the language `text`.
- `.prettierignore` (owner decision 9) has exactly five entries, one per line, in this order: `pnpm-lock.yaml`, `dist/`,
  `coverage/`, `node_modules/`, `development-artifacts/`. At the starting commit it had the first four; the owner added
  `development-artifacts/` on 2026-09-18, committed on the working branch as `49ef1bf7bc408da7d2676f859cf144a9b950d3c6`
  ("Exclude development-artifacts/ from Prettier" — the only file that commit changes; resulting blob
  `ba4ec991e38365369abc094c855dc3e83f22e1f7`). No step edits the file again (Constraints; project DoD 10 pins it).
  Consequences: (a) NOTHING under `development-artifacts/` is format-checked — not this brief, the roadmap, the ledger, step
  files, worker reports, or the decision packet; (b) `pnpm format:check`, `pnpm format`, and an explicit
  `pnpm prettier --check <path under development-artifacts/>` all skip such a file silently — the explicit form still prints
  `All matched files use Prettier code style!` and exits 0 without reading the file (verified 2026-09-18 at `49ef1bf`), so
  Prettier output is never evidence about a pipeline artifact and no acceptance uses it that way; (c) `probes/`, `docs/`,
  `README.md`, and `CLAUDE.md` are still format-checked (`pnpm prettier --file-info <path>` printed `"ignored": true` for
  `development-artifacts/patch-steward-m2-brief.md` and `"ignored": false` for `probes/README.md`, `docs/architecture.md`, and
  `CLAUDE.md` — verified 2026-09-18 at `49ef1bf`); (d) two documents still state the four-entry list and are stale until
  Phase 5 corrects them ("Documentation rules for Phases 5 and 6"): `CLAUDE.md` "Documentation conventions" and
  `docs/user-manual/configuration.md`.
- ESLint (`eslint.config.mjs`, `eslint .`): ignores `**/dist/`, `docs/`, `coverage/`; lints every other `.js`/`.mjs`/`.cjs`/`.ts`
  file, with `@eslint/js` recommended rules and NO Node globals declared (`no-undef` flags bare `process` and `console` in
  `.mjs` files). Shell scripts, YAML, and Markdown are not linted.
- Vitest (`vitest.config.ts`) includes only `packages/*/src/**`; nothing under `probes/` is a test for Vitest. The
  `*.live.test.ts` tier (CLAUDE.md "Test tiers") is a Vitest tier for package code and is NOT what M02 builds.
- Existing pipeline artifacts in `development-artifacts/`: `patch-steward-m1-brief.md`, `patch-steward-m1-ledger.md`,
  `patch-steward-project-ledger.md` (lead-owned). Lessons recorded by M01 that bind this plan: (1) every file a step writes
  that Prettier checks must be Prettier-clean when the step commits — the step treats `pnpm format:check` as part of its own
  acceptance and fences verbatim command output in such a file with the language `text` (in M01 unfenced report output failed
  the gate, and `prettier --write` then corrupted it: `'packages/*'` became `'packages/_'`). In M01 that lesson covered worker
  reports, because Prettier then checked `development-artifacts/`. Since owner decision 9 it does not: the lesson binds the
  format-checked files (`probes/**`; in Phases 5 and 6 also `docs/`, `README.md`, `CLAUDE.md`), and reports follow "Worker report
  rules" instead; (2) the supervisor ran `pnpm install --frozen-lockfile` in every worktree sequentially before launching a
  wide wave, to avoid pnpm store contention on Windows; (3) acceptance checks that count diff hunks or grep for substrings that
  the mandated text itself contains are mis-specified.

### Milestone text (verbatim from `docs/project-development-plan.md` lines 212–294 — this is the goal)

```text
### M02. Platform assumption probes

Goal: confirm on disposable repositories the GitHub and Copilot behaviors that
the architecture depends on, before building on them, and correct the
governing documents where the platform differs.

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Design scope | §6.3, §6.4, §10, §12, §15; SP02 steps 7–8 |
| Addresses    | Prerequisite for M06, M09, M13, and M19   |
| Depends on   | — (parallel with M01–M05)                 |

Inputs:

- Administrator access to dedicated, disposable test-bed repositories (PD02):
  an organization-owned pair, public and private, and a personally owned
  public repository. The private repository is on the organization's Free
  plan, so behaviors that plan does not offer on private repositories are
  recorded undetermined. The organization has no Copilot seats, so M02
  verifies the personal billing path of §6.3 on the personally owned test-bed
  and assumes that inference on the organization-owned test-beds does not
  require Copilot billing to the organization (PD03). That assumption is a
  recorded risk (section 8). The organization billing path stays undetermined
  until the probes run in an organization with Copilot.
- A test GitHub App registration with the permissions in §6.4.
- A Copilot seat; optionally a key for an OpenAI-compatible endpoint.

Assumptions to verify:

1. Required checks (§10, §15): the latest check run per name from the
   expected App is the one evaluated; `neutral` satisfies the requirement; a
   fresh `in_progress` check on the same commit withdraws an earlier success;
   the effect of `action_required` and `cancelled`.
2. Ownership artifacts (§6.4, §15): per-submission naming, immutability,
   creation-time ordering across runs and re-run attempts, cross-run listing,
   the consistency window under concurrent runs, retention bounds.
3. Trusted triggers (§6.4): `pull_request_target`, `issues`, `issue_comment`,
   `workflow_run`, and `schedule` use default-branch definitions; Environment
   deployment-branch rules under each; the `workflow_dispatch` ref guard.
4. Job privilege separation (§6.4, §7): Environment secrets reach only the
   jobs that reference the Environment; the reusable-workflow permission
   ceiling, including `copilot-requests: write`; the `publish` condition after
   failed, skipped, and cancelled jobs.
5. Round expansion and concurrency (§15): fixed `execute-N`/`assess-N` pairs
   with unused rounds skipped; per-submission concurrency that never cancels
   unrelated jobs in a shared issues or maintenance run.
6. Merge-queue relay (§6.4): a credential-free `merge_group` run whose
   completion starts a default-branch `workflow_run` with a resolvable group
   commit; an App check on that commit gates the queue; removal and rebuild.
7. App-token writes (§6.4): which events they trigger and which identity
   fields let a run verify its own installation's echoes.
8. Copilot inference in Actions (§6.3): `GITHUB_TOKEN` authentication on the
   personal billing path (personally owned test-bed) and on the
   organization-owned test-beds without organization billing (PD03), the
   failure shape without a usable Copilot entitlement, usage and credit
   reporting, soft credit-cap behavior. The organization policy and its
   failure shape stay undetermined under PD03.
9. Run-list caps (§12): whether today's runs and in-progress runs can be
   attributed to the submission author, not the workflow actor, within
   bounded queries.

Outputs:

- Test-bed repositories, a test App, and probe workflows, kept as a
  regression suite against platform drift.
- A findings record: each assumption confirmed, refuted, or undetermined,
  with evidence.
- Governing-document changes for every deviation, architecture first, and
  closed or reworded §15 items.
- Measured platform limits that feed the numerical limits (§15).

Exit criteria:

- Every assumption has a recorded result.
- Each refuted or undetermined assumption has an owner-approved design change
  or an accepted, documented limitation before the dependent milestone
  starts: items 1–7 and 9 before M06; item 8 before M09.
- The organization billing path is an accepted limitation under PD03: it is
  documented as unverified wherever it is described, until the probes run in
  an organization with Copilot.
- PD03's assumption that the organization-owned test-beds need no
  organization billing has a recorded result under item 8; if refuted, it is
  handled as a refuted assumption above.
```

### Plan cross-references that bind M02 (same file)

- Principle 7 (§0.1): "Platform assumptions are verified before reliance (M02). Where the platform differs, the architecture
  changes first, then the processes, then the summaries."
- Principle 8 (§0.1): "Open decisions are asked, not assumed." Items are settled with the project owner and recorded in the
  governing document in the same change. No agent or worker in this plan decides a design change.
- Risks (§8): (a) "Platform behavior differs from the design" → "M02 before reliance; governing-document change before dependent
  work; probe workflows kept for drift". (b) "The organization billing path for Copilot is unverified at release (PD03)" →
  "Documented as unverified; the design in §6.3 is unchanged; the M02 probes are repeated when an organization with Copilot is
  available". (c) "Copilot inference on an organization-owned repository requires billing to the organization, contrary to PD03's
  assumption" → "M02 item 8 records the failure shape; inference probes and test-bed runs fall back to the personally owned
  test-bed; before M09 the owner enables organization Copilot, selects `openai-compatible`, or accepts the limitation".
- PD02: dedicated disposable repositories and a test App; not this repository. PD03 (revised 2026-09-18): M02 verifies the
  personal path on a personally owned test-bed and assumes the organization-owned test-beds need no Copilot billing to the
  organization; the organization billing path is documented as unverified until probes can run in an organization with Copilot.
- §7.2 rows that name M02: "Ownership artifact naming, retention, listing consistency window — M02 measures; M06 decides";
  "Fixed round expansion, budget handoff, job-level serialization — M02 probes; M13 decides"; "Capability probing at installation
  — M02 probes; M20 decides"; "Latest-check, neutral-check, and rerun semantics; ownership record schema — M02; M06 schema; M14
  self-test". M02 therefore measures and probes; it does NOT decide schemas, names, or numerical limits for the product.

### Applicability of the plan's §0.3 definition of done to M02 (no package code)

| §0.3 item                                                                    | Applies | How                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build, tests, lint, format pass on Ubuntu and Windows                        | yes     | Run on Windows locally. Ubuntu: no package, lockfile, or workflow of this repository changes; the only config change is the owner's `.prettierignore` entry (owner decision 9), which acts the same on every OS; Prettier results are OS-independent; no CI run is triggered |
| Runtime validation of new inputs crossing into the core                      | no      | No core code                                                                                                                                                                                                                                                                 |
| Injected-failure tests for new stages, adapters, handoffs                    | no      | None added                                                                                                                                                                                                                                                                   |
| Policy limit under a hard bound; redaction before persistence                | in part | Probes bound waits, API calls, Copilot prompts, sessions, and AI credits, and Actions minutes (see "Running, waiting, and budgets"); evidence is redacted before it is committed                                                                                             |
| No decision input from authorship                                            | no      | No decision logic                                                                                                                                                                                                                                                            |
| Delivered process steps record evidence and metrics                          | no      | None delivered                                                                                                                                                                                                                                                               |
| Fixture corpus grows                                                         | no      | `fixtures/` is unchanged; probe evidence stays under `probes/`; promotion into `fixtures/` belongs to the first consuming milestone (M06)                                                                                                                                    |
| Settled decisions recorded governing document first; §15 shrinks; §14 stable | yes     | Phases 5–6                                                                                                                                                                                                                                                                      |
| Documentation describes as working only what was delivered                   | yes     | Phases 5–6: README status and `CLAUDE.md` "Project state" stay scaffold-only; `probes/` is described as a probe suite, not product; Proposed markers and `[NEEDS INPUT]` intact                                                                                                 |
| The milestone merges into `develop`                                          | lead    | Outside this plan                                                                                                                                                                                                                                                            |

### Test-bed inventory (verified 2026-09-18 with `gh`; re-verify before relying on SHAs)

| Key           | Repository                                     | Owner type   | Visibility | Default branch | `master` HEAD at read time                 | Viewer permission |
| ------------- | ---------------------------------------------- | ------------ | ---------- | -------------- | ------------------------------------------ | ----------------- |
| `org-public`  | `steady-orchard/patch-steward-testbed-public`  | Organization | public     | `master`       | `e787442e06eeac9ea66130d2cf433842d5e6f459` | ADMIN             |
| `org-private` | `steady-orchard/patch-steward-testbed-private` | Organization | private    | `master`       | `2b4fc8ebbe96973365da712f411478d16c855db0` | ADMIN             |
| `personal`    | `jambolo/patch-steward-testbed-personal`       | User         | public     | `master`       | `994239f4c078815eb6e01dc826ffe03029e28cbb` | ADMIN             |

- Each test-bed currently contains only `LICENSE` and `README.md`; no workflows, no environments, no rulesets, no open issues or
  PRs. Issues enabled; merge commit, squash, and rebase merges all allowed.
- Each has Actions secrets `STEWARD_APP_ID` and `STEWARD_APP_PRIVATE_KEY` and Actions variable `STEWARD_APP_CLIENT_ID` =
  `Iv23lifZAsPAdNqwf2Pu` (repository level, not Environment level).
- Actions settings on all three: enabled, `allowed_actions: all`, `sha_pinning_required: false`,
  `default_workflow_permissions: read`, `can_approve_pull_request_reviews: false`.
- The organization `steady-orchard` is on the Free plan. Already observed on `org-private`:
  `gh api repos/steady-orchard/patch-steward-testbed-private/rulesets` → HTTP 403
  `Upgrade to GitHub Pro or make this repository public to enable this feature.` The same call returns `[]` on both public
  test-beds.
- Platform fact (observed 2026-09-24, step 1.7 attempt 1, identical on `org-public` and `personal`): the rulesets API rejects
  any ruleset carrying a `merge_queue` rule whose `conditions.ref_name.include` contains a wildcard. Request
  `POST repos/<r>/rulesets` with `"conditions": { "ref_name": { "include": ["refs/heads/probe-canary-*"], "exclude": [] } }`
  and a rule `"type": "merge_queue"` answered, verbatim:
  `{"message":"Validation Failed","errors":["Invalid rule 'merge_queue': Wildcard ref names are not supported when merge queue is enabled"],"documentation_url":"https://docs.github.com/rest/repos/rules#create-a-repository-ruleset","status":"422"}`
  GitHub's "Managing a merge queue" article states the same for branch protection: "A merge queue cannot be enabled with branch
  protection rules that use wildcard characters (`*`) in the branch name pattern." Consequence: every ruleset with a
  `merge_queue` rule targets exact, non-wildcard branch refs (rule under "Fixture naming and isolation on the test-beds"). The
  same request shape with a `required_status_checks` rule on `refs/heads/probe-canary-*` was accepted on both public test-beds
  (ruleset ids 23963328, 23963340, since removed). The 422 says nothing about whether merge queue is offered on a test-bed: that
  was not yet tested on any of them.
- The organization has no Copilot seats and its Copilot CLI billing policy is unconfigured. `jambolo` has Copilot Free. GitHub
  publishes no number for Copilot Free's monthly AI-credit allowance (see "Documented Copilot behavior"), and the pipeline cannot
  read how much of it `jambolo` has already used this month. The owner reported neither figure (answer of 2026-09-18): both are
  unknown to this plan, and no step asks for them.

### Test GitHub App (verified 2026-09-18: `gh api apps/patch-steward-testbed`, `gh api orgs/steady-orchard/installations`)

- App id `4993303`; client id `Iv23lifZAsPAdNqwf2Pu`; slug and name `patch-steward-testbed`; owner `steady-orchard`; bot login
  `patch-steward-testbed[bot]`.
- Registered permissions: `actions: write`, `checks: write`, `contents: write`, `issues: write`, `metadata: read`,
  `pull_requests: write`, `statuses: write`. Subscribed events: none. No webhook.
- Organization installation id `162868612`, `repository_selection: selected` (the two organization test-beds).
- Installation on `jambolo/patch-steward-testbed-personal` is owner-reported and NOT verifiable with the local token
  (`gh api user/installations` → 403). Phase 1 verifies it by minting an installation token inside a workflow.
- The App private key exists only as the test-bed Actions secret. The pipeline never asks for, reads, or handles the key;
  installation tokens are minted only inside probe workflows (for example with `actions/create-github-app-token`).
- Check runs can be created only by GitHub Apps (the test App's installation token, or the job `GITHUB_TOKEN` acting as the
  `github-actions` app with `checks: write`). The local `gh` user token cannot create check runs.

### Local credentials and what they allow (verified 2026-09-18)

- `gh` is authenticated as `jambolo`, token scopes `admin:org`, `gist`, `repo`. There is NO `workflow` scope: creating or updating
  any file under `.github/workflows/` through the REST contents API, merging a PR that changes workflow files through the API, and
  `gh repo sync` of workflow changes are refused. There is no `delete_repo` scope.
- Git protocol is SSH and works non-interactively from this machine for all three test-beds
  (`git ls-remote git@github.com:<owner>/<repo>.git` verified). Workflow files are deployed with `git push` over SSH.
- Verified read calls: `gh repo view`, `gh api repos/<r>/git/trees/...`, `gh secret list`, `gh variable list`,
  `gh api repos/<r>/environments`, `gh api repos/<r>/rulesets`, `gh api repos/<r>/actions/permissions`, `gh api rate_limit`
  (5000/hour, shared by every worker using this token).
- Not yet exercised (Phase 1 establishes them): `gh workflow run` (needs only `repo` scope per GitHub's REST documentation),
  creating Environments, deployment-branch policies, Environment secrets, rulesets (required status check bound to an
  integration id; merge queue), and a fork through the API.
- Obtaining the `workflow` scope (`gh auth refresh -s workflow`) is interactive and is an owner action; plan not to need it.

### Documented Copilot behavior (fetched 2026-09-18; GitHub serves each docs article as Markdown at `https://docs.github.com/api/article/body?pathname=/en/<path>`)

- `/en/copilot/concepts/agents/copilot-cli/copilot-cli-in-github-actions`: with `GITHUB_TOKEN`, "In a personally-owned
  repository, usage is billed to the repository owner's Copilot seat. In an organization-owned repository, usage is metered
  directly to the organization. This requires the "Allow use of Copilot CLI billed to the organization" policy to be enabled by
  an organization owner."
- `/en/copilot/how-tos/copilot-cli/use-copilot-cli-in-actions`: the policy "is enabled by default for organizations with Copilot
  CLI turned on". Example job: `permissions: { contents: read, copilot-requests: write }`; `npm install -g @github/copilot`;
  `copilot -p "<prompt>" -s --allow-tool='<tool>'` with `env: GITHUB_TOKEN: ${{ github.token }}`. "Non-interactive (`-p`) runs
  can't display an interactive approval prompt, so any action that isn't pre-approved is denied automatically." "You must be on a
  recent version of Copilot CLI to use `GITHUB_TOKEN` authentication."
- `/en/copilot/how-tos/copilot-sdk/features/session-limits`: `sessionLimits: { maxAiCredits: <n> }` on `createSession` and
  `resumeSession`; "Usage is checked after model calls return, so one response can exceed the configured value before the runtime
  blocks the next model call." Events: `session.usage_checkpoint` (`totalNanoAiu`, `totalPremiumRequests?`),
  `session_limits_exhausted.requested` (`requestId`, `maxAiCredits`, `usedAiCredits`), `session.session_limits_changed`,
  `session_limits_exhausted.completed`. The page states no minimum; every example uses `maxAiCredits: 30`; "The SDK forwards
  this value to the Copilot CLI when it creates or resumes the session."
- `/en/copilot/how-tos/copilot-cli/use-copilot-cli/set-session-limit`: "AI credit session limits are currently in public preview
  and subject to change." "These session limits are **soft limits**. If a response is in progress when the limit is reached, that
  response completes before the session stops, so actual usage may slightly exceed the configured number." "AI credit session
  limits must be set to at least 30 AI credits." Non-interactive form: `copilot -p "YOUR PROMPT" --max-ai-credits NUMBER`; "In
  non-interactive mode, the run ends when the limit is reached."
- `/en/copilot/how-tos/copilot-sdk/auth/server-to-server-tokens`: "In GitHub Actions, use the built-in GITHUB_TOKEN instead."
  "Do not pass an installation token through the SDK's `gitHubToken`, `github_token`, or equivalent option. That option is for
  user tokens. Installation tokens must use the runtime environment authentication path." Its GitHub Actions example grants
  `copilot-requests: write` and passes the token only as the step's environment variable `GITHUB_TOKEN`; its example for other
  services constructs
  `new CopilotClient({ connection: RuntimeConnection.forStdio(), env: { ...process.env, COPILOT_GITHUB_TOKEN: token }, useLoggedInUser: false })`.
  Planner inference (not documentation): the job `GITHUB_TOKEN` is an installation token, so SDK probes hand it to the runtime
  through the environment and never through the `gitHubToken` option.
- Billing model — `/en/copilot/concepts/billing-and-usage/individuals/billing`,
  `/en/copilot/reference/copilot-billing/request-based-billing-legacy/what-changed-with-billing`,
  `/en/copilot/reference/copilot-billing/models-and-pricing`: "As of June 1, 2026, GitHub replaced request-based billing with
  usage-based billing, where the cost of an interaction depends on two things: the **model** and the **number of tokens
  consumed**." Usage is metered in GitHub AI Credits ("1 AI credit = $0.01 USD"); Copilot CLI usage is billed in AI credits.
  Listed default-tier prices per 1 million tokens range from input $0.20 / output $1.20 (GPT-5.6 Luna, MAI-Code-1.1-Flash)
  through GPT-5 mini $0.25 / $2.00 and Claude Haiku 4.5 $1.00 / $5.00 to $10.00 / $50.00; cached input is cheaper (one tenth of
  the input price for most models). "Included AI credits do not carry over between months. Unused credits are forfeited, and
  your allowance resets to the full monthly amount at 00:00:00 UTC on the first day of each calendar month."
- Copilot Free allowance — same billing article: "All individual plans—Copilot Free, Copilot Pro, Copilot Pro+, and Copilot
  Max—include a monthly GitHub AI Credits allowance that varies by plan." Paid plans are quantified (Copilot Pro: 1,000 base + 500
  flex credits). Copilot Free is NOT quantified anywhere in the documentation: "Copilot Free and Copilot Student both have an
  allowance of AI credits and access to models through auto model selection only." The plans comparison at
  `https://github.com/features/copilot/plans` (fetched 2026-09-18) gives Free "Limited chat and agent usage", flex allotment
  "Not included", "Purchase additional GitHub AI Credits" "Not included", Copilot CLI and programmatic mode "Included". The FAQ
  sentence on that page, "GitHub Copilot Free users are limited to 2000 completions and 50 chat requests (including Copilot
  Edits).", predates usage-based billing and is not a usable figure. Consequences: (1) no prompt count can be shown from
  documentation to reach the Free allowance; (2) on Copilot Free an exhausted allowance costs no money, cannot be topped up, and
  lasts until the monthly reset; (3) observing a session limit at the documented minimum needs at least 30 AI credits spent
  inside one session.
- `/en/copilot/how-tos/manage-and-track-spending/monitor-ai-usage`: an individual sees included credits used at
  `https://github.com/settings/billing` → "AI usage", or under Copilot settings → "Usage". No REST endpoint for an individual's
  remaining allowance is documented (PA08.6 probes detectability).
- `/en/copilot/concepts/billing-and-usage/individuals/usage-limits`: rate limits are separate from the allowance ("Rate limits
  are temporary. Often, waiting a short period and trying again resolves the issue."), so a limit error is not by itself proof of
  an exhausted allowance.
- These are documentation, not evidence. The probes record what the platform actually does. The documentation predicts that
  PA08.2 (below) may be refuted; any observed result is acceptable.
- Architecture §6.3 also cites the SDK reference `https://github.com/github/copilot-sdk/blob/main/nodejs/README.md` and the CLI
  reference `https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-programmatic-reference`.

### Design claims under test

Identifiers (owner decision 7 — a stable identifier family, recorded in the design documents in Phase 5): assumption N of the
milestone is `PA0N` (`PA01`–`PA09`); its sub-claims are `PA0N.M`. Kinds: `assumption` (the
design relies on it; the result may be `confirmed`, `refuted`, or `undetermined`), `measurement` (no expectation; `confirmed`
means a value was measured, `undetermined` means it could not be measured, never `refuted`), `fixed` (result pre-set by this
brief). "A different identity" below means the App bot `patch-steward-testbed[bot]`, because `jambolo` is the only human account
available.

#### PA01 — Required checks

Design text: architecture §10 lines 651–688 ("Because GitHub evaluates the latest check run with that name from the App, the
earlier success stops counting the moment the new check exists."; "superseded runs may complete only their own still-pending
check as `cancelled`, never `neutral` or `skipped`"; "reconciliation completes it `action_required` after the stale timeout");
§6.4 lines 345–362; §7 rows "Checks API" and "Rulesets"; §13 row "Stale success on a re-screened commit"; §15 lines 902–905;
processes SP02 steps 7–8 lines 206–225 ("require the stable steward check with the steward App's integration id as the expected
source, never "any source"").

| ID     | Kind        | Claim under test                                                                                                                                                                                                                                                       |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA01.1 | assumption  | With a ruleset on the PR's target branch requiring a status check name with the test App (integration id 4993303) as expected source, GitHub evaluates the most recently created check run with that name from that App on the head commit; earlier ones stop counting |
| PA01.2 | assumption  | A latest check run concluded `neutral` satisfies the requirement (the PR becomes mergeable)                                                                                                                                                                            |
| PA01.3 | assumption  | After an earlier `success`, a new `in_progress` check run with the same name from the same App on the same commit withdraws mergeability until it completes                                                                                                            |
| PA01.4 | assumption  | A latest conclusion `action_required` does not satisfy the requirement                                                                                                                                                                                                 |
| PA01.5 | assumption  | A latest conclusion `cancelled` does not satisfy the requirement; completing an OLDER run as `cancelled` after a newer run exists does not change which run GitHub evaluates (the design's superseded-run cleanup happens in that order)                               |
| PA01.6 | assumption  | A check run with the required name from a different source (the job `GITHUB_TOKEN`, app `github-actions`) does not satisfy a requirement bound to the test App's integration id                                                                                        |
| PA01.7 | measurement | Effect of latest conclusions `failure`, `skipped`, and `timed_out`; latency from a check-run write to the PR's merge-state change                                                                                                                                      |

#### PA02 — Ownership artifacts

Design text: §6.4 lines 345–362 ("upload an immutable ownership artifact named for the submission
(`steward-ownership-pr-<number>`, `-issue-<number>`, or `-group-<commit>`). Upload is the commitment point."; "The newest
artifact by creation time wins, including a new attempt of an old run. An ambiguous or incomplete listing cannot authorize
publication."); §7 rows "Artifacts" and "Actions artifacts API"; §15 lines 883–884.

| ID     | Kind        | Claim under test                                                                                                                                                                                                                                                      |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA02.1 | assumption  | Names of the forms `steward-ownership-pr-<number>`, `steward-ownership-issue-<number>`, and `steward-ownership-group-<40-hex commit>` are accepted at upload and can be listed repository-wide by exact name (`GET /repos/{owner}/{repo}/actions/artifacts?name=...`) |
| PA02.2 | assumption  | Immutability: content cannot change under an artifact id; a second upload of the same name in the same run attempt fails or yields a new id and creation time; record which token permissions can delete an artifact (deletion is the residual mutation)              |
| PA02.3 | assumption  | Creation-time ordering: across different runs and across a re-run attempt of an older run, `created_at` and artifact id order match real upload order; record whether a listing identifies the run attempt that uploaded an artifact                                  |
| PA02.4 | assumption  | Cross-run listing: an artifact uploaded by a job of a still-running run is visible to another run's repository-wide listing before the uploading run completes                                                                                                        |
| PA02.5 | measurement | Consistency window: delay from upload-step completion to visibility in the repository-wide listing under concurrent runs (at least 5 uploads; min, median, max); `created_at` resolution and tie behavior for near-simultaneous uploads                               |
| PA02.6 | measurement | Retention bounds: accepted `retention-days` range, resulting `expires_at`, and the cap from repository or organization settings, per visibility. Actual deletion at expiry is an optional observation and never makes this cell `undetermined`                        |
| PA02.7 | measurement | Listing bounds: `per_page` maximum and pagination; which tokens can list and download across runs (job `GITHUB_TOKEN` with `actions: read`; App installation token); rate-limit cost per query                                                                        |

#### PA03 — Trusted triggers

Design text: §6.4 lines 427–436 ("`workflow_dispatch` uses the requested ref, so the maintenance wrapper rejects any ref other
than the default branch before using credentials or starting work."; `pull_request_target` "use default-branch workflow code,
`GITHUB_REF`, and environment evaluation regardless of the PR's base branch, effective December 8, 2025"; "`workflow_run`,
`issues`, `issue_comment`, and `schedule` also run on the default branch"); processes SP02 step 2 ("a GitHub Environment whose
deployment-branch rule allows only the default branch. Every privileged job runs on a default-branch ref ..., so no other
pattern is needed"); §13 rows "PR modifies workflow definitions or wrapper workflows".

| ID     | Kind       | Claim under test                                                                                                                                                                                                                                                                                          |
| ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA03.1 | assumption | `pull_request_target` runs the default-branch workflow definition with `GITHUB_REF` = default branch when the PR head modifies or deletes that workflow file (same-repository branch AND fork), and when the PR base is a non-default branch whose copy of the workflow differs                           |
| PA03.2 | assumption | `issues` and `issue_comment` runs use the default-branch definition and ref                                                                                                                                                                                                                               |
| PA03.3 | assumption | `workflow_run` runs use the default-branch definition and ref even when the triggering run executed on a non-default ref                                                                                                                                                                                  |
| PA03.4 | assumption | `schedule` runs use the default-branch definition and ref                                                                                                                                                                                                                                                 |
| PA03.5 | assumption | An Environment whose deployment-branch rule allows only the default branch admits jobs started by each of the five triggers above and delivers its secret, including `pull_request_target` from a fork and with a non-default base                                                                        |
| PA03.6 | assumption | `workflow_dispatch` on a non-default ref runs that ref's definition; the default-branch-only Environment refuses its job; a ref guard placed before any credential use stops the run; record that a non-default ref's own definition can omit the guard, so the Environment rule is the enforcing control |

#### PA04 — Job privilege separation

Design text: §6.4 lines 281–290 ("environment secrets reach only the jobs that reference the environment ... no job references
both") and lines 313–320 ("Reusable workflows cannot exceed the caller's permissions, so the wrapper templates grant
`copilot-requests: write` to `intake` and `assess`; a wrapper that drops it makes those jobs end `inconclusive`. `publish`
depends on all pipeline jobs and uses
`if: ${{ always() && needs.gate.result == 'success' && needs.gate.outputs.committed == 'true' }}`. It runs after failed or
skipped downstream jobs ... A workflow cancellation can still prevent publication."); §7 rows "Reusable workflows", "Job-level
`permissions`", "Environments with deployment-branch rules". In the design, wrappers in the target repository call reusable
workflows hosted in ANOTHER repository, pinned by commit SHA, and the called jobs reference the target repository's Environments.

| ID     | Kind       | Claim under test                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA04.1 | assumption | An Environment secret reaches only jobs that declare that `environment`; sibling jobs in the same run read an empty value; this holds for jobs inside a called reusable workflow, including one hosted in another repository, which resolve the CALLER repository's Environment                                                                                                                                             |
| PA04.2 | assumption | Permission ceiling: a called workflow's job cannot hold more `GITHUB_TOKEN` permissions than the caller grants. Record the exact behavior when the called job requests a permission the caller omits, for `copilot-requests: write` and for one ordinary scope: run-level startup failure, job-level failure, or silent downgrade. The design's "those jobs end `inconclusive`" presumes the rest of the run still executes |
| PA04.3 | assumption | A job that `needs` every pipeline job with the `publish` condition quoted above runs after failed and after skipped upstream jobs, and does not run when `gate` fails or `committed` is not `'true'`; job outputs cross `needs` inside a reusable workflow                                                                                                                                                                  |
| PA04.4 | assumption | Cancellation: record whether that `publish` job still runs when the run is cancelled while an upstream job executes, and the final states of the other jobs (design: "A workflow cancellation can still prevent publication")                                                                                                                                                                                               |

#### PA05 — Round expansion and concurrency

Design text: §6.4 lines 322–328 ("The pinned reusable workflow declares a fixed maximum number of round pairs and skips unused
rounds; policy can lower that maximum."); §6.4 lines 401–404 ("Per-submission concurrency serializes ownership commitment and
publication. Only a newly committed replacement may cancel earlier submission work; ignored events never enter a workflow-level
cancel-in-progress group that could kill useful work."); §12 lines 766–769 ("never unrelated jobs in a shared
issues/maintenance run"); §15 lines 885–886.

| ID     | Kind        | Claim under test                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA05.1 | assumption  | A reusable workflow declaring a fixed maximum of `execute-N`/`assess-N` job pairs (at least 3 in the probe) skips unused rounds through job-level `if` on the previous assess job's output; used rounds chain; the final `publish` (PA04.3 condition) still runs; outputs and artifacts hand off between rounds                                                                                                                    |
| PA05.2 | assumption  | Job-level `concurrency` keyed per submission serializes same-submission jobs across runs without cancelling jobs of other submissions inside the same shared run (one issues or maintenance run that screens several submissions)                                                                                                                                                                                                  |
| PA05.3 | assumption  | Replacement semantics: with `cancel-in-progress: false`, record what happens to an already-pending job when another job joins the same group (GitHub documents at most one pending member per group); with job-level `cancel-in-progress: true`, record whether only the group's job or the whole run is cancelled. Design expectation: only a committed replacement cancels earlier work; ignored events never cancel useful work |
| PA05.4 | measurement | Limits relevant to fixed expansion: jobs per run, reusable-workflow nesting depth and count per run, `needs` fan-in, practical maximum of rounds; cite GitHub documentation for limits not exercised and label them `documented`                                                                                                                                                                                                   |

#### PA06 — Merge-queue relay

Design text: §6.4 lines 413–425 ("the relay runs on the queue ref with no credentials and no checkout, and its completion
triggers `steward-pr.yml` on the default branch ... It keys ownership by group commit and completes an App check on it ... A
rebuilt group has a new commit and a new run; an orphaned check on a removed group commit is inert. Relay failure or removal
cannot create success: the queue times out without the required check."); processes SP02 step 7; §7 rows "Actions
`merge_group`", "Actions `workflow_run`", "Merge queue".

| ID     | Kind        | Claim under test                                                                                                                                                                                                                                                                          |
| ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA06.1 | assumption  | A `merge_group` (`checks_requested`) workflow with no secrets, no Environment, no checkout, and empty `permissions` runs to completion on the queue ref                                                                                                                                   |
| PA06.2 | assumption  | Its completion starts a `workflow_run` run from the default-branch definition, and that run can resolve the group commit and the member PRs within bounded queries (record `workflow_run.head_sha`, `head_branch`, `event`, and any PR references)                                        |
| PA06.3 | assumption  | A required check bound to the test App gates the queue: a `success` check run created by the App on the group commit from the default-branch run merges the group; `failure` removes the entry; with no check the entry leaves the queue at the check-response timeout and nothing merges |
| PA06.4 | assumption  | Removal and rebuild: removing an entry, or a failing entry ahead, produces a new group commit and a new `merge_group` event; a check written to the orphaned group commit has no effect                                                                                                   |
| PA06.5 | measurement | Timing: `merge_group` event to relay completion, relay completion to `workflow_run` start, check completion to merge; configured and minimum check-response timeout                                                                                                                       |

PA06 fixture constraint: the merge-queue ruleset targets exact base branch refs (for example `refs/heads/probe-pa06-base`),
never a `probe-*` wildcard — the platform rejects a `merge_queue` rule on a wildcard ref with HTTP 422 (platform fact under
"Test-bed inventory"; rule under "Fixture naming and isolation on the test-beds").

#### PA07 — App-token writes

Design text: §6.4 lines 438–448 ("Ignore verified echoes of this installation's report, follow-up, usage/acknowledgment
comments, labels, reactions, and ready-for-review writes. Maintenance issues carry an App-authored marker and stored issue id
..."); §13 row "Event loops from the App's own writes" ("Verify installation identity and recorded resource ids"); §7 row
"GitHub App" ("tokens that can trigger workflows").

| ID     | Kind        | Claim under test                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA07.1 | assumption  | Writes made with the App installation token trigger workflows: issue comment create, edit, delete (`issue_comment`); issue create, edit, close, reopen (`issues`); PR body edit and ready-for-review (`pull_request_target`); record which events label changes and reactions fire. Control: the same writes with the job `GITHUB_TOKEN` trigger nothing                                                                                 |
| PA07.2 | assumption  | Identity fields: for each event in PA07.1 record the payload and context fields that identify the writer as this App (for example `sender.login`, `sender.id`, `sender.type`, `comment.performed_via_github_app`, `issue.performed_via_github_app`, `github.actor`, `github.actor_id`, `github.triggering_actor`), whether any field identifies the installation rather than only the App, and which fields a non-App user could imitate |
| PA07.3 | measurement | Whether the platform applies any recursion guard to runs triggered by App-token writes (the design assumes none); latency from write to triggered run                                                                                                                                                                                                                                                                                    |

#### PA08 — Copilot inference in Actions

Design text: §6.3 line 271 (`copilot-sdk` row: "In T1, the job's `GITHUB_TOKEN` with `copilot-requests: write` ...
Organization-owned repositories bill the organization under the Copilot policy "Allow use of Copilot CLI billed to the
organization"; personally owned repositories bill the repository owner's Copilot seat."; "`sessionLimits.maxAiCredits` as a soft
cap (§12)"); §12 lines 752–759; §15 lines 894–895 ("Capability probing at installation: detecting the Copilot organization
policy and billing state other than by a bounded synthetic request").

| ID     | Kind        | Claim under test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA08.1 | assumption  | Personal billing path: on `personal`, a job with `permissions: copilot-requests: write` authenticates request-response Copilot inference with its own `GITHUB_TOKEN` (no PAT, no stored secret), billed to the repository owner's Copilot entitlement (Copilot Free on `jambolo`)                                                                                                                                                                                                                                                                                 |
| PA08.2 | assumption  | PD03's assumption: on the organization-owned test-beds, without Copilot seats or organization billing, the same job succeeds. A failure refutes PD03's assumption and is routed as a refuted assumption                                                                                                                                                                                                                                                                                                                                                           |
| PA08.3 | measurement | Failure shape without a usable entitlement: exit status, error class, and message (a) when `copilot-requests: write` is omitted, (b) wherever PA08.1 or PA08.2 fail, (c) on `personal` only: when the Copilot Free included allowance is exhausted — driven deliberately by the cap step, which runs last (owner decision 8; "Copilot cap step" rules below). Record whether each failure is distinguishable from a transient error, from a rate limit, and from the other parts. On `personal`, part (c) not observed makes this cell `undetermined` / `blocked` |
| PA08.4 | measurement | Usage and credit reporting: the usage fields the runtime and SDK report per call and per session (tokens, AI credits, premium requests, requested versus reported model id — Copilot Free offers auto model selection only, so record the model actually used); the observed CLI runtime and SDK versions                                                                                                                                                                                                                                                         |
| PA08.5 | assumption  | Soft credit cap: `sessionLimits.maxAiCredits` is checked after a model call returns, so one response can exceed it and the next call is blocked; record whether a value below the documented CLI minimum of 30 AI credits is accepted, the overshoot, and the exhausted-limit event shape. Observed in the cap step BEFORE the allowance is exhausted, because reaching a limit needs that many AI credits spent inside one session                                                                                                                               |
| PA08.6 | measurement | Detectability of entitlement and policy state without an inference request: what a job `GITHUB_TOKEN` and the local `admin:org` user token can read about Copilot enablement for the repository owner (feeds §15 "Capability probing at installation"; M20 decides)                                                                                                                                                                                                                                                                                               |
| PA08.7 | fixed       | The organization policy "Allow use of Copilot CLI billed to the organization" and its failure shape: result fixed `undetermined`, cause `pd03`; NOT probed; pre-accepted limitation (milestone exit criterion 3)                                                                                                                                                                                                                                                                                                                                                  |

#### PA09 — Run-list caps

Design text: §12 lines 760–765 ("`gate` counts today's runs and the in-progress runs attributed to the submission author from
the Actions run list. The counts are approximate under concurrent admissions and are documented as such"); §7 row "Actions runs
API"; §15 lines 873–875.

| ID     | Kind        | Claim under test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PA09.1 | assumption  | Today's runs and in-progress runs of a workflow can be listed within bounded queries (`GET /repos/{owner}/{repo}/actions/runs` with `created`, `status`, `event`, and workflow filters); record pagination and any ceiling on filtered results                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| PA09.2 | assumption  | Those runs can be attributed to the submission author rather than the workflow actor within bounded queries. Record `actor` and `triggering_actor` for: `pull_request_target` opened by the author; `pull_request_target` `edited` by a different identity; `issue_comment` by a different identity on the author's submission; a re-run by a different identity; `workflow_run` and `schedule` runs. Then record which mechanism restores author attribution without one API call per run (candidates: a `run-name` expression carrying author id and submission number, returned as `display_title`; the run's `pull_requests` field, including for fork PRs; ownership artifacts) |
| PA09.3 | measurement | Cost and freshness: requests and rate-limit units per cap evaluation for the job `GITHUB_TOKEN` and for the App token; delay before a just-started run appears in the listing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Coverage matrix (which sub-claims run on which test-bed)

`full` = every sub-claim of that assumption. `attempt` = try the setup; where the platform refuses it, every affected cell is
`undetermined` with cause `plan-unavailable` and the refusal as evidence. `none` = not probed there, no cell (ownership and
visibility are not expected to change the answer). Merge queue is expected not to be offered on user-owned repositories; Phase
1's `ruleset-merge-queue` canary on `personal` (exact-ref target, see "Test-bed record format") records the platform's actual
answer in `probes/testbeds.md`, and PA06 has no `personal` cells whatever that answer is.

| Assumption | `org-public`           | `org-private`                                                                           | `personal`                                                                     |
| ---------- | ---------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| PA01       | full                   | attempt (rulesets already observed HTTP 403 on this plan)                               | full                                                                           |
| PA02       | full                   | PA02.1, PA02.4, PA02.6, PA02.7                                                          | none                                                                           |
| PA03       | full                   | PA03.1–PA03.4 run; PA03.5 and PA03.6 attempt (Environments on a Free-plan private repo) | PA03.5, PA03.6                                                                 |
| PA04       | full                   | PA04.1 attempt; PA04.2                                                                  | PA04.1, PA04.2                                                                 |
| PA05       | full                   | none                                                                                    | none                                                                           |
| PA06       | full                   | attempt                                                                                 | none                                                                           |
| PA07       | full                   | PA07.1, PA07.2                                                                          | PA07.1, PA07.2                                                                 |
| PA08       | PA08.2, PA08.3, PA08.6 | PA08.2, PA08.3                                                                          | PA08.1, PA08.3, PA08.4, PA08.5, PA08.6, PA08.7 (PA08.7 is recorded once, here) |
| PA09       | full                   | none                                                                                    | none                                                                           |

If inference unexpectedly succeeds on an organization-owned test-bed, its usage fields are recorded there as additional
evidence under PA08.2; no extra cell is created.

PA08 ordering (owner decision 8): on `personal`, PA08.5 and part (c) of PA08.3 are recorded by the cap step, which also adds one
post-exhaustion repeat of the PA08.6 reads as extra evidence under PA08.6 (no extra cell). Every other PA08 cell on every
test-bed has its evidence recorded, verified, and merged first. Rules: "Copilot cap step" under "Running, waiting, and budgets".

### Where the organization billing path is described (exit criterion 3: "documented as unverified wherever it is described")

| File                                  | Location at 10fcaf2                                   | Text                                                                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture.md`                | §6.3 adapter table, `copilot-sdk` row (line 271)      | "Organization-owned repositories bill the organization under the Copilot policy "Allow use of Copilot CLI billed to the organization""                                                                |
| `docs/architecture.md`                | §6.5 `steward init` row (line 454)                    | "print the manual steps (App installation, Environments and secrets, Copilot organization policy, ..."                                                                                                |
| `docs/architecture.md`                | §7 row "Copilot SDK inference" (line 542)             | "billed to the organization for organization-owned repositories under the Copilot policy ..."                                                                                                         |
| `docs/architecture.md`                | §12 "Spending" bullet (lines 790–791)                 | "`steward init` prints provider-side spending limits and Copilot cost-center or session-limit setup" (cost centers apply only to organization-billed usage; location confirmed by C1 A)           |
| `docs/architecture.md`                | §15 (lines 894–895)                                   | "Capability probing at installation: detecting the Copilot organization policy and billing state ..."                                                                                                 |
| `docs/processes.md`                   | SP02 step 3 (lines 186–190)                           | "an organization owner enables the Copilot policy "Allow use of Copilot CLI billed to the organization" ..."                                                                                          |
| `docs/processes.md`                   | SP02 Controls (line 228), Failure handling (line 234) | "including the Copilot organization policy"; "a disabled Copilot policy"                                                                                                                              |
| `docs/processes.md`                   | SP19 Failure handling (lines 1376–1381)               | "disabled Copilot policy"                                                                                                                                                                             |
| `docs/user-manual/configuration.md`   | Credentials table (line 164); paragraph lines 171–176 | "Organization use requires the documented policy, ..."; "The design assigns Copilot usage in organization-owned repositories to the organization"                                                     |
| `docs/user-manual/troubleshooting.md` | Table rows (lines 79–80)                              | "disabled Copilot policy"; "required organization policy is disabled"                                                                                                                                 |

`docs/whitepaper.md`, `README.md`, and `CLAUDE.md` do not describe the organization billing path at 10fcaf2 (whitepaper line 577
only says provider limits "may apply per credential, account, organization, or model"). Phase 5 re-greps
(`billed to the organization|organization billing|Copilot organization policy|Copilot policy|organization policy|cost.center`)
before editing.

The design documents (`architecture.md`, `processes.md`, `whitepaper.md` except the single "(M01)" in §14, user manual) never
cite plan identifiers (`PDxx`, `Mxx`) or the plan file. Wording added to them must be self-contained and may cite
`probes/findings.md` and `PA` identifiers. Marker: the owner confirmed both default forms at every location in the table above,
§12 "Spending" included (C1 A, 2026-09-25); the byte-exact forms are in "Post-probe owner decisions" (C1 block).

### §15 items M02 touches (architecture lines 865–905)

| §15 item (quoted start)                                                             | M02's role                                                                                                                       | Who decides |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| "Ownership artifact naming, retention, and the consistency window ..."              | PA02 measures                                                                                                                    | M06         |
| "Fixed execution/assessment round expansion, cumulative budget handoff, ..."        | PA05 probes                                                                                                                      | M13         |
| "Numerical limits: budgets, retention, audit sample sizes, the stale-check ..."     | Measured limits feed it; M02 sets no product value                                                                               | M03 onward  |
| "Capability probing at installation: detecting the Copilot organization policy ..." | PA08.6 probes                                                                                                                    | M20         |
| "Confirmation during installation that GitHub evaluates the most recent check ..."  | PA01 verifies the platform semantics; the per-installation self-test (SP02 step 7) stays; the ownership record schema stays open | M06, M14    |
| "how the approximate daily inference aggregate is computed from the run list ..."   | PA09 informs                                                                                                                     | M03, M13    |

Rewording or closing any §15 item is a governing-document change and happens only in Phases 5 and 6, from recorded owner
decisions. Recorded: Q7 C rewords "Capability probing at installation" (Phase 5); no other §15 item is closed or reworded by
the recorded decisions (the packets' `changes:` lists name no other §15 item); F1 B (packet 2) closes or rewords none; Q1E
(amendment 7) closes, rewords, or adds none.
`docs/whitepaper.md` §14 (lines 771–785) restates the §15 list and must mirror every §15 change in the same phase. `CLAUDE.md`
"Invariants any implementation must preserve" must stay consistent with any changed architecture text.

## Owner decisions (immutable; do not reopen, do not invent alternatives)

Sources: decisions 1–4 were settled before planning (`development-artifacts/patch-steward-project-ledger.md`, "Owner decisions",
M02 rows, 2026-09-18). Decisions 5–8 were settled at plan review on 2026-09-18: they are the owner's answers to the planner's
decisions in the plan at commit `0154c1d`, relayed verbatim by the lead in planner amendment 1 (ledger "Revisions"). The session
ceiling in decision 8 (`S = 10`) is the owner's answer, also of 2026-09-18, to the question that amendment 1 (commit `657cae5`)
returned; the lead relayed it verbatim in planner amendment 2 (ledger "Revisions"). Decision 9 was settled on 2026-09-18, after
planning and before any decomposition: the owner changed `.prettierignore`, the lead asked how to resolve the conflict with this
plan, and the lead relayed the owner's chosen option verbatim in planner amendment 3 (ledger "Revisions"; gate-affecting, owner
approval recorded there). The lead records them in the project ledger; no step edits that file.

1. Test-beds (PD02): the three repositories in the inventory above, all created 2026-09-18, default branch `master`. The
   organization is on the Free plan; private-repository behaviors that plan does not offer are recorded `undetermined`.
2. Test App: id 4993303, client id `Iv23lifZAsPAdNqwf2Pu`, name `patch-steward-testbed`, owned by `steady-orchard`, installed on
   selected repositories (the test-beds). Secrets `STEWARD_APP_ID`, `STEWARD_APP_PRIVATE_KEY` and variable
   `STEWARD_APP_CLIENT_ID` are set on all three test-beds. Installation on `personal` is owner-reported.
3. Copilot: Copilot Free on `jambolo`; `steady-orchard` has no Copilot seats and its CLI billing policy is unconfigured.
   Assumption 8 is probed on the free tier on `personal` and on the organization-owned test-beds assuming organization billing is
   not required there (PD03). Cap behavior is recorded as found.
4. Probe execution: the pipeline runs probes live from this machine via `gh`. Steps that need browser UI (App installation or
   permissions, rulesets, Environments where the API does not suffice, merge queue setup) escalate to the owner as `needs-human`
   and are never guessed.
5. Fork ("Allow fork"): `jambolo/patch-steward-testbed-public`, a fork of `org-public`, is approved as a PR-head-only fixture.
   No workflow is enabled or run there and the App is not installed there. It is created in Phase 1 with `gh`.
6. Probe suite location: approved as planned — root directory `probes/` of this repository, not a workspace package; nothing is
   added to this repository's `.github/workflows/`; the test-beds hold deployed copies that are checked by blob SHA.
7. Identifier family ("Adopt PA ids"): `PA01`–`PA09` with sub-claims `PA0N.M` is adopted as a stable identifier family and is
   recorded in `docs/architecture.md` §6.1, `README.md`, and `CLAUDE.md` in Phase 5. This needs no further confirmation, so the
   decision packet has no confirmation item for it.
8. Budgets ("Raise Copilot budget"): the probes may exhaust the Copilot Free included allowance of `jambolo` in order to observe
   the real cap failure shapes of assumption 8 (PA08.5 and part (c) of PA08.3). The owner accepts that this burns `jambolo`'s
   Copilot allowance until the monthly reset. Architecture §2 invariant 7 still applies: the exhaustion is a separate, last,
   hard-bounded step ("Copilot cap step" under "Running, waiting, and budgets"). Session ceiling of that step (owner answer of
   2026-09-18, "Fixed S = 10"): `S = 10` cap sessions — a fixed number, not derived from the allowance, because the owner
   reported neither the allowance's size nor the credits already used this month. If the allowance is not exhausted at the
   ceiling, part (c) of PA08.3 is recorded `undetermined` / `blocked` and the Phase 3 decision packet asks the owner whether to
   continue. Every other budget stands as planned: at most 300 billed Actions minutes on `org-private`; scheduled probes no more
   often than every 15 minutes and disabled after one capture; polling no more often than every 20 seconds; at most 24 standard
   Copilot prompts.
9. Prettier scope ("Keep it, amend plan", 2026-09-18): the owner added the line `development-artifacts/` to `.prettierignore`;
   the lead committed it on the working branch as `49ef1bf7bc408da7d2676f859cf144a9b950d3c6`. The change stays and the plan
   yields. The option the owner chose, in the lead's words as offered and relayed verbatim (its "I" is the lead): "I commit it
   on milestone branch, then planner amendment (gate-affecting, your approval recorded): remove .prettierignore from
   untouched-files list, drop Prettier-fencing rule for reports, update CLAUDE.md statement in phase 4. Pipeline artifacts no
   longer format-checked." Applied as: (a) the untouched-files checks no longer compare `.prettierignore` with the starting
   commit; they pin it to its content at `49ef1bf` instead (exactly five entries), so it is still edited by no step
   (Constraints; project DoD 10; roadmap `HEALTH`); (b) nothing under `development-artifacts/` is format-checked — worker
   reports, step files, the decision packet, the brief, the roadmap, the ledger — and the Prettier rule for reports is dropped
   ("Worker report rules"); (c) Phase 5 corrects every document that states the ignore list — `CLAUDE.md` "Documentation
   conventions" and `docs/user-manual/configuration.md` ("Documentation rules for Phases 5 and 6"; project DoD 13) — unconditionally,
   whatever the post-probe owner decisions are. Everything under `probes/`, `docs/`, `README.md`, and `CLAUDE.md` stays
   format-checked.

## Post-probe owner decisions

Source: the owner's answers to `development-artifacts/patch-steward-m2-decision-packet.md` (packet source commit `7fc24f5`):
"all recommended", plus one clarification (the Q3 bound), relayed by the lead on 2026-09-25 in planner amendment 5 (ledger
"Revisions"). F1 and F2: the owner's answer to `development-artifacts/patch-steward-m2-decision-packet-2.md` (packet 2,
source commit `db39f19`) — "F1: B"; F2 was not raised — relayed by the lead on 2026-09-25 in planner amendment 6 (ledger
"Revisions"). Q1E: the owner's answer "Extend the Q1 accepted limitation" to a gap the decomposer found while decomposing
Phase 5 (ledger Phase 5 notes, "LEAD ITEM"), relayed by the lead on 2026-09-25 in planner amendment 7 (ledger "Revisions");
it has no packet option, so "Q1E content (Phase 6)" below is authoritative for both its locations and what it states. They
are owner decisions: no agent reopens them or invents alternatives. Authority: each chosen option's
`changes:` list in the packet (packet 2 for F1) is authoritative for WHICH governing documents and sections change ("governing locations"
below); the chosen option's text in the packet is authoritative for WHAT the change states ("must state" below restates it —
on any difference the packet wins and the discoverer sends an amendment note). Summaries follow "Documentation rules for
Phases 5 and 6". The design documents are unchanged since `<start>` (verified at `3bb74ba`:
`git diff --stat 10fcaf2 3bb74ba -- docs README.md CLAUDE.md` prints nothing), so the packet's line hints hold until Phase 5
edits the files; locate text by quotation.

### Decisions

| Item | Answer                            | Kind                                                          | Cells                                                    | Disposition (exact string written to `probes/findings.md`)                                                     | Applied in                                             |
| ---- | --------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Q1   | A                                 | accepted limitation                                           | PA01.1–PA01.7 org-private (7), PA06.1–PA06.5 org-private (5) | PA01 cells `accepted-limitation: docs/architecture.md §10`; PA06 cells `accepted-limitation: docs/architecture.md §7` | Phase 5                                                |
| Q1E  | extend Q1 A (amendment 7, 2026-09-25) | accepted limitation — extends Q1 A: where a repository's plan and visibility offer no rulesets, the evidence-store push restriction and required code-owner review of policy and wrapper paths are unavailable too; `steward init` and the SP02 preconditions (steps 4 and 8) detect and report it | none (no findings cell probed either control; the evidence is the rulesets refusal already cited by the PA01/PA06 org-private cells) | — (no string written; the Q1 disposition strings and the PA01, PA06 roll-ups are unchanged) | Phase 6                                                |
| Q2   | A                                 | design change (clarification)                                 | PA02.3 org-public                                        | `design-change: docs/architecture.md §6.4`                                                                     | Phase 5                                                |
| Q3   | A, bound 6 hours (clarification)  | re-probe once on org-private                                  | PA03.4 org-private, PA03.5 org-private                   | `none` (the Q3 re-probe made both cells `confirmed`; written in Phase 4; F2 not raised)                        | Phase 4 (re-probe; done)                               |
| Q4   | A                                 | re-probe PA04.1, then follow-up owner decision F1 (B or C)    | PA04.1 org-public, PA04.1 org-private, PA04.1 personal   | `design-change: docs/architecture.md §6.4` (by F1 B)                                                           | Phase 4 (re-probe; done); Phase 6 (F1 B)               |
| Q5   | A                                 | design change                                                 | PA04.2 org-public, PA04.2 org-private, PA04.2 personal   | `design-change: docs/architecture.md §6.4`                                                                     | Phase 5                                                |
| Q6   | A                                 | design change (keep `always()`; correct the cancellation text) | PA04.4 org-public                                        | `design-change: docs/architecture.md §6.4`                                                                     | Phase 5                                                |
| Q7   | C                                 | accepted limitation                                           | PA08.2 org-public, PA08.2 org-private                    | `accepted-limitation: docs/architecture.md §6.3`                                                               | Phase 5                                                |
| Q8   | A                                 | design change                                                 | none (PA05.3 stays `confirmed` / `none`)                 | —                                                                                                              | Phase 5                                                |
| Q9   | A                                 | design change                                                 | none (PA06.1–PA06.4 org-public stay `confirmed` / `none`) | —                                                                                                              | Phase 5                                                |
| C1   | A                                 | marker wording confirmed at every listed location, §12 "Spending" included | PA08.7 personal                                 | `accepted-limitation: docs/architecture.md §6.3` (replaces the bare `accepted-limitation`)                     | Phase 5                                                |
| F1   | B (packet 2, 2026-09-25)          | design change — explicit per-name `secrets:` mapping from the wrappers into the pinned reusable workflow; never `secrets: inherit` | PA04.1 org-public, PA04.1 org-private, PA04.1 personal | `design-change: docs/architecture.md §6.4`                                                    | Phase 6                                                |
| F2   | not raised                        | none — the Q3 re-probe made PA03.4 and PA03.5 on org-private `confirmed` / `none` | none (PA03.4, PA03.5 org-private stay `confirmed` / `none`) | —                                                                          | —                                                      |

- Roll-up dispositions (`probes/findings.md` `## Roll-up`): an assumption whose roll-up result is `confirmed` has `none`;
  otherwise its disposition is the distinct dispositions of its non-`confirmed` cells, in `## Cells` row order, joined with
  `; `. Resulting values: PA01 `accepted-limitation: docs/architecture.md §10`; PA02 `design-change: docs/architecture.md §6.4`;
  PA06 `accepted-limitation: docs/architecture.md §7`; PA08 `accepted-limitation: docs/architecture.md §6.3`; PA03 `none`
  (roll-up `confirmed` after the Q3 re-probe; written in Phase 4; F2 not raised); PA04
  `design-change: docs/architecture.md §6.4` (written in Phase 6: its non-`confirmed` cells PA04.1 ×3 (F1 B), PA04.2 ×3 (Q5),
  PA04.4 org-public (Q6) all carry that one string). PA05, PA07, PA09 stay `none`. Q1E changes no cell, disposition string,
  or roll-up: the PA01 and PA06 org-private cells keep `accepted-limitation: docs/architecture.md §10` and
  `accepted-limitation: docs/architecture.md §7` (both sections still hold the Q1 text), and `probes/findings.md` gets no
  Q1E edit (roadmap Phase 6 DoD 7 unchanged).
- F1 and F2 are recorded (amendment 6, 2026-09-25): F1 = B; F2 = not raised. No item of this table is unanswered. (The word
  for an unanswered item was `open`, never the findings marker.)
- Plan-level consequence of Q7 C, NOT written into any design document (design documents cite no milestone ids): M09 exercises
  the Copilot adapter on the personally owned test-bed `personal`; Q7 C decides nothing about how this project's own
  organization-owned repository runs inference later (packet Q7 recommendation). The lead records it for M09; no step edits
  the plan file.

### Governing locations and must-state content (Phase 5)

Each block: governing locations (from the chosen option's `changes:` list — authoritative), then what the text must state.
Architecture is edited first, then processes, then summaries and the user manual.

- Q1 A — locations: `docs/architecture.md` §7 rows "Rulesets" and "Merge queue", §10 (the paragraph starting "When any category
  enters `enforce`"); `docs/processes.md` SP02 step 8, SP03 step 7; `docs/user-manual/installation.md` step 8. Must state:
  (a) enforcement (a required App check through a ruleset) and the merge-queue relay are available only where GitHub offers
  rulesets and merge queue for the repository's plan and visibility; (b) on a Free-plan organization's private repository the
  steward runs `observe`/`advise` without a required check; (c) `steward init` and the SP02 step 8 precondition detect the
  refusal and keep `enforce` off; (d) the PA01/PA06 platform semantics confirmed on the public test-beds are relied on as plan-
  and visibility-independent (may cite `probes/findings.md`, PA01, PA06).
- Q2 A — locations: `docs/architecture.md` §6.4 (the bullet starting "Only committed artifacts count as ownership"), §7 row
  "Actions artifacts API"; `docs/processes.md` SP19 Failure handling (the owner-ordering sentence). Must state: (a) "creation
  time" means the artifact's `created_at`, never the artifact id (ids are not monotonic across a re-run attempt); (b)
  `created_at` has 1-second resolution, so equal values make the listing ambiguous (and an ambiguous listing cannot authorize
  publication — existing rule); (c) a re-run attempt's upload of the same name replaces the earlier attempt's artifact in the
  listing.
- Q5 A — locations: `docs/architecture.md` §6.4 (the sentence starting "Reusable workflows cannot exceed the caller's
  permissions"), §12 "Failure classes and outcomes"; `docs/processes.md` SP02 step 7 and Failure handling, SP19 Failure
  handling; `docs/user-manual/troubleshooting.md` row "Copilot inference cannot run in Actions". Must state: (a) replacing the
  "end `inconclusive`" clause: a wrapper that grants less than the pinned reusable workflow's jobs request fails the whole run
  at startup — no job, check, report, or evidence; (b) `steward init` writes wrapper permissions equal to the pinned reusable
  workflow's job permissions; (c) the installation self-test fails visibly when a wrapper's grant is short; (d) wrapper edits
  stay on the CODEOWNERS-reviewed path. Phase 5 applies (d) as written; Phase 6 qualifies it for repositories without
  rulesets (Q1E item (e), "Q1E content (Phase 6)").
- Q6 A — locations: `docs/architecture.md` §6.4 (the sentence "A workflow cancellation can still prevent publication." and the
  bullet starting "Failed `gate`/`publish` jobs or cancellation"), §12 "Failure classes and outcomes"; `docs/processes.md` SP13
  Failure handling, SP19 Failure handling. Must state: (a) the `publish` condition keeps `always()` (the quoted `if:` is
  unchanged); (b) `publish` also runs after a cancellation; (c) a run cancelled by a committed replacement finds the newer
  ownership artifact and abandons as `superseded`, completing only its own still-pending check `cancelled` (§10); (d) a run
  cancelled without a replacement records the cancelled required work as `inconclusive`; (e) only a cancellation that reaches
  `gate` or `publish` itself leaves the check pending for reconciliation.
- Q7 C — locations: `docs/architecture.md` §6.3 `copilot-sdk` row, §15 "Capability probing at installation"; `docs/processes.md`
  SP02 Failure handling, SP19 Failure handling; `docs/user-manual/troubleshooting.md` rows "Inference fails before execution"
  and "Copilot inference cannot run in Actions". Must state: (a) the design keeps requiring the organization policy for
  organization-owned repositories; (b) the policy-disabled failure shapes: the CLI's "Access denied by policy settings"; the
  SDK's HTTP 403 `authorization` error that reads like an expired credential while the runtime reports itself authenticated;
  (c) `intake` can tell a disabled policy from an unusable credential only by the synthetic request's failure, recorded as one
  `inconclusive` cause unless the CLI text is available; (d) what installation can read: an `admin:org` user token reads the
  organization's Copilot billing `cli` setting; the job token reads nothing (the §15 item is reworded to this). Cite
  `probes/findings.md` and PA08.2/PA08.6 where evidence is referenced.
- Q8 A — locations: `docs/architecture.md` §6.4 (the bullet starting "Per-submission concurrency serializes"), §12
  "Concurrency"; `docs/processes.md` SP19 step 3. Must state: (a) a job joins the per-submission concurrency group only after
  `gate` has decided the event is a committed replacement — deduplication and commitment happen outside the group; (b) the
  reason: the platform keeps one pending member per group and a newer member replaces it even with `cancel-in-progress: false`;
  (c) a job-level cancellation marks the whole run `cancelled`.
- Q9 A — locations: `docs/architecture.md` §6.4 (the paragraph starting "Merge queue:"); `docs/processes.md` SP12 step 6;
  `docs/user-manual/troubleshooting.md` (one new row). Must state: (a) group membership is resolved from the queue ref / group
  commit, not from `workflow_run.pull_requests` (empty for relay runs); (b) echo filtering never applies to relay completions
  (the `workflow_run` sender is the enqueuer — the App bot when the App enqueued); (c) troubleshooting: entries enqueued by
  automation using a job `GITHUB_TOKEN` get no relay run and time out.
- C1 A — locations: every row of "Where the organization billing path is described" (Context), §12 "Spending" included.
  Forms (the owner-confirmed defaults), each copied byte-for-byte from the block below — `S` = sentence form (prose
  locations), `T` = table-cell form (table cells), as that table assigns; each literal runs from after `S: ` / `T: ` to the
  end of its line:

```text
S: This organization billing path is unverified: no probe has run in an organization with Copilot (`probes/findings.md`, PA08.7).
T: (unverified; `probes/findings.md` PA08.7)
```

- F1-reserved text (NOT changed in Phase 5): `docs/architecture.md` §6.4 first
  paragraph ("One trusted workflow run per event. …"), the §6.4 wrapper model and job table, §7 rows "Reusable workflows
  (`workflow_call`)" and "Environments with deployment-branch rules", §13 row "Compromised steward release";
  `docs/processes.md` SP02 steps 1–3 (step 3 gains only the C1 sentence in Phase 5); `CLAUDE.md` "Intended architecture"
  paragraph. In Phase 6 the recorded F1 option B changes only the §6.4 first paragraph, the two §7 rows, and SP02 steps
  1–3; the rest of this list stays unchanged by F1 in Phase 6. In Phase 6 the §6.4 wrapper model and job table and `CLAUDE.md`
  "Intended architecture" stay unchanged (K35 under "Phase 6 content checks"); §13 row "Compromised steward release"
  changes only by the Q1E qualification of its clause "review updates through protected policy/wrapper paths" (amendment 8;
  "Q1E content (Phase 6)"; K53–K55), its other clauses byte-for-byte unchanged.

### Phase 5 content checks

Run from the repo root in bash. `<start>` = `10fcaf2d575037be7c13e0ba0719feb53d51d71f` (docs unchanged since, so it is the
baseline). Helpers (CRLF-safe: `J` joins lines and drops `\r`; `N` counts literal occurrences):

```bash
J() { awk -v s="$1" -v e="$2" 'f && $0 ~ e {exit} $0 ~ s {f=1} f' | tr '\r\n' '  ' | tr -s ' '; }
N() { grep -oF -- "$1" | wc -l | tr -d ' '; }
```

Forms: for extract `X` (a filter reading stdin, defined below) of file `F` and literal `L`: NEW = `X < F | N 'L'`;
OLD = `git show <start>:F | X | N 'L'`. "grows" = NEW > OLD; "gone" = NEW is `0`; "present" = NEW is at least `1`. In the blocks below
each line is `<id>  <file>  <filter>` or `<check>  <decision>  <expected>  <extract>` followed by a line `L: <literal>` whose
literal runs from after `L: ` to the end of the line, byte-exact. `J` patterns are awk ERE: `[.]` is a literal `.`.

```text
X63    docs/architecture.md                 grep '^| `copilot-sdk` '
X64    docs/architecture.md                 J '^### 6[.]4 ' '^##'
X64p1  docs/architecture.md                 J '^One trusted workflow run per event' '^[[:space:]]*$'
X65    docs/architecture.md                 grep '^| `steward init` '
X7r    docs/architecture.md                 grep '^| Rulesets '
X7m    docs/architecture.md                 grep '^| Merge queue '
X7a    docs/architecture.md                 grep '^| Actions artifacts API '
X7c    docs/architecture.md                 grep '^| Copilot SDK inference '
X7w    docs/architecture.md                 grep '^| Reusable workflows (`workflow_call`) '
X7e    docs/architecture.md                 grep '^| Environments with deployment-branch rules '
X10    docs/architecture.md                 J '^## 10[.] ' '^## '
X12f   docs/architecture.md                 J '^- Failure classes and outcomes:' '^(- |## )'
X12c   docs/architecture.md                 J '^- Concurrency:' '^(- |## )'
X12s   docs/architecture.md                 J '^- Spending:' '^(- |## )'
X13c   docs/architecture.md                 grep '^| Compromised steward release '
X15c   docs/architecture.md                 J '^- Capability probing at installation:' '^(- |## )'
X61    docs/architecture.md                 J '^### 6[.]1 ' '^###'
XP02   docs/processes.md                    J '^### SP02[.] ' '^### '
XP02a  docs/processes.md                    J '^1[.] Run `steward init`' '^3[.] Configure inference'
XP03   docs/processes.md                    J '^### SP03[.] ' '^### '
XP13   docs/processes.md                    J '^### SP13[.] ' '^### '
XP19   docs/processes.md                    J '^### SP19[.] ' '^### '
XTc    docs/user-manual/troubleshooting.md  grep '^| Copilot inference cannot run in Actions '
XTi    docs/user-manual/troubleshooting.md  grep '^| Inference fails before execution '
XTq    docs/user-manual/troubleshooting.md  grep '^| ' | grep -F 'GITHUB_TOKEN' | grep -i 'queue'
XCc    docs/user-manual/configuration.md    grep '^| Copilot inference '
XCL    CLAUDE.md                            J '^Intended architecture:' '^[[:space:]]*$'
XW     <named file>                         tr '\r\n' '  ' | tr -s ' '
```

The Symptom cells of the troubleshooting rows, the §7/§13 row labels, and the anchors above stay unchanged, so every extract
still finds its text.

```text
K1   Q1  grows    X7r
L: visibility
K2   Q1  grows    X7m
L: visibility
K3   Q1  grows    X10
L: visibility
K4   Q1  grows    XP02
L: visibility
K5   Q1  grows    XP03
L: visibility
K6   Q1  grows    XW docs/user-manual/installation.md
L: visibility
K7   Q2  grows    X64
L: created_at
K8   Q2  grows    X7a
L: created_at
K9   Q2  grows    XP19
L: created_at
K10  Q5  gone     XW docs/architecture.md
L: makes those jobs end `inconclusive`
K11  Q5  grows    X64
L: startup
K12  Q5  grows    X12f
L: startup
K13  Q5  grows    XP02
L: startup
K14  Q5  grows    XP19
L: startup
K15  Q5  grows    XTc
L: startup
K16  Q6  gone     XW docs/architecture.md
L: A workflow cancellation can still prevent publication.
K17  Q6  present  X64   (NEW >= 1: the quoted condition survives unchanged)
L: always() && needs.gate.result == 'success' && needs.gate.outputs.committed == 'true'
K18  Q7  grows    XW docs/architecture.md
L: Access denied by policy settings
K19  Q7  grows    XW docs/user-manual/troubleshooting.md
L: Access denied by policy settings
K20  Q7  grows    X15c
L: admin:org
K21  Q8  grows    X64
L: cancel-in-progress: false
K22  Q9  grows    X64
L: workflow_run.pull_requests
K23  Q9  grows    XTq
L: GITHUB_TOKEN
```

C1 marker counts (K24; `S` and `T` as in the C1 block above; NEW = `X < F | N '<literal>'`; exact values):

| File / extract                                                | `T` | `S` |
| ------------------------------------------------------------- | --- | --- |
| X63                                                           | 1   | 0   |
| X65                                                           | 1   | 0   |
| X7c                                                           | 1   | 0   |
| X12s                                                          | 0   | 1   |
| X15c                                                          | 0   | 1   |
| XW on `docs/architecture.md`                                  | 3   | 2   |
| XP02                                                          | 0   | 3   |
| XP19                                                          | 0   | 1   |
| XW on `docs/processes.md`                                     | 0   | 4   |
| XCc                                                           | 1   | 0   |
| XW on `docs/user-manual/configuration.md`                     | 1   | 1   |
| XTi                                                           | 1   | 0   |
| XTc                                                           | 1   | 0   |
| XW on `docs/user-manual/troubleshooting.md`                   | 2   | 0   |
| XW on each of `docs/whitepaper.md`, `README.md`, `CLAUDE.md`  | 0   | 0   |

F1-reserved text unchanged (K25): for each of X64p1, X7w, X7e, X13c (on `docs/architecture.md`), XP02a (on
`docs/processes.md`), XCL (on `CLAUDE.md`): `diff <(git show <start>:F | X | tr -d '\r') <(X < F | tr -d '\r')` prints nothing.

Unconditional (K26): `grep -c "PA01–PA09" docs/architecture.md README.md CLAUDE.md` prints at least 1 per file; §6.1 records
`probes/`: X61 with literal `probes/` grows; the two `.prettierignore` checks under
"Documentation rules for Phases 5 and 6" hold.

Dispositions (K27): in `probes/findings.md`, every cell of the decided rows above (Q1, Q2, Q5, Q6, Q7, C1) and the roll-ups of
PA01, PA02, PA06, PA08 carry exactly the disposition strings above; the number of lines of `probes/findings.md` holding the open-disposition
marker ("Findings record format"; command in roadmap Phase 5 DoD) is `4 + u + (1 if u > 0)`, where `u` is the number of
PA03.4/PA03.5 org-private cells not `confirmed` after Phase 4 (the 4 are the three PA04.1 cells and the PA04 roll-up; F1
and F2 clear them in Phase 6). Phase 4 result: `u = 0` (both cells `confirmed`), so the expected count is `4`. This section
never spells that marker, so the section-scoped check in roadmap Phase 6 DoD 1
stays exact.

Not mechanical (supervisor judgment, not delegated): every must-state item above is present at its governing locations,
architecture first; every summary that restates changed text agrees with it; no F1-reserved text changed beyond K25's reach
(the §6.4 wrapper model and job table; SP02 step 3 apart from the C1 sentence).

### F1 and F2 content (Phase 6)

Recorded by amendment 6 (2026-09-25). Phase 6 is decomposable once Phase 5 is done.

- F2: `not raised` (packet 2: "F2 not raised: the Q3 re-probe made PA03.4 and PA03.5 on org-private `confirmed` / `none`").
  The PA03 cells and the PA03 roll-up keep what Phase 4 wrote (`confirmed` / `none`). Phase 6 has no F2 work: architecture
  §6.4 trusted-triggers paragraph, the `steward-maintenance.yml` row, and SP02 step 7 get no F2 change.
- F1: answer `B` — design change. Owner's answer as relayed (verbatim): "the wrapper templates pass the App and provider
  secrets to the pinned reusable workflow by an explicit per-name `secrets:` mapping (the reusable workflow declares each
  secret under `on.workflow_call.secrets`; the called job declares the Environment and receives the caller's Environment
  value); the design names the explicit mapping and not `secrets: inherit` (which arrived silently empty across owners in
  all 3 cross-owner legs; organization-to-organization untested)." Packet 2 option B's text is authoritative for WHAT is
  stated; on any difference from "must state" below, the packet wins and the discoverer sends an amendment note.
- F1 disposition (exact string, `probes/findings.md`): the three PA04.1 cells (org-public, org-private, personal) →
  `design-change: docs/architecture.md §6.4`; PA04 roll-up → `design-change: docs/architecture.md §6.4` (roll-up rule under
  "Decisions": PA04.1 ×3, PA04.2 ×3, PA04.4 all carry that one string). Result, Cause, Evidence of every row unchanged.
- F1 governing locations (packet 2 option B `changes:` list, authoritative; architecture first):
  `docs/architecture.md` §6.4 first paragraph (the paragraph starting "One trusted workflow run per event"; the F1 text goes
  INSIDE that paragraph, which keeps that opening sentence and no blank line inside it); §7 rows
  "Reusable workflows (`workflow_call`)" and "Environments with deployment-branch rules" (row labels unchanged);
  `docs/processes.md` SP02 steps 1–3 (steps keep their opening words "1. Run `steward init`", "3. Configure inference", and
  step 4 still starts "4. Create the evidence store"; step 3 keeps its Phase 5 C1 sentence byte-for-byte). Nothing else is a
  governing location of F1: the §6.4 wrapper table and job table and `CLAUDE.md` "Intended architecture" stay unchanged
  (K35); §13 row "Compromised steward release" gets no F1 change (its only Phase 6 change is the Q1E qualification under
  "Q1E content (Phase 6)", K53–K55).
- F1 must state (each item at the locations in brackets; wording free unless a literal is required by K28–K34):
  - (a) [§6.4 first paragraph] An Environment secret reaches a job of a called reusable workflow only when the caller passes
    the secret and the called job declares the Environment (packet 2 option B: "an Environment secret reaches a called job
    only when the caller passes secrets and the called job declares the Environment").
  - (b) [§6.4 first paragraph; §7 row "Reusable workflows (`workflow_call`)"] The wiring: the pinned reusable workflow
    declares each secret its jobs use — the App id and private key, and the `env` provider key — under
    `on.workflow_call.secrets`, and the wrapper templates pass each by name in an explicit `secrets:` mapping. This holds for
    every wrapper call into a pinned reusable workflow whose jobs use those secrets, including the calls inside the issues and
    maintenance runs named in that §7 row.
  - (c) [§6.4 first paragraph; §7 row "Environments with deployment-branch rules"] `gate` and `publish` declare the
    publication Environment, and `intake` and `assess` jobs the model Environment; each receives the caller (target)
    repository's Environment value. Privilege separation is unchanged: a job that does not declare the Environment receives
    nothing, and no job references both Environments. The Copilot path is unchanged (job `GITHUB_TOKEN` permission, no
    Environment secret).
  - (d) [§6.4 first paragraph] The design names the explicit mapping, not `secrets: inherit`, because `secrets: inherit`
    into a reusable workflow owned by another account delivered the secret empty, silently, with no error.
  - (e) [SP02 step 1] `steward init` writes the wrappers with that explicit per-name `secrets:` mapping; the credential-free
    `steward-relay.yml` passes no secrets (it stays as the §6.4 wrapper table describes it).
  - (f) [SP02 step 2] The App id and private key stay secrets of the default-branch-only publication Environment; the wrapper
    passes them by name, and only `gate` and `publish` declare that Environment.
  - (g) [SP02 step 3] For `env`, the provider key stays the secret of the separate model Environment with the same
    default-branch rule; the wrapper passes it by name the same way, and only `intake` and `assess` declare that Environment.
- F1 evidence bounds (the text states no more than the Q4 re-probe showed; roadmap Phase 6 DoD 6): it does NOT state that
  `secrets: inherit` fails within one owner (it delivered on the same-owner leg, org-private → org-public); does NOT state
  that the called job receives the value of the caller's mapped expression or of a repository- or organization-level secret
  (in W1 the mapped expression was empty in the calling job; the value came from the caller's Environment, resolved by the
  called job that declares it); does NOT state that an organization-to-organization call was verified (neither wiring was
  tested organization → organization; every cross-owner leg was organization ↔ user account). It may cite
  `probes/findings.md` and PA04.1. It cites no `PDxx`, `Mxx`, or plan file.
- F1 ripple (rules under "Documentation rules for Phases 5 and 6"): planner reading at `78f215e` — no summary contradicts
  option B: whitepaper §10 paragraph starting "Only `gate`/`publish` hold App credentials through a default-branch-only
  Environment"; `CLAUDE.md` "Intended architecture" and invariants; `README.md`; `docs/user-manual/installation.md` steps
  1–3; `docs/user-manual/configuration.md` Credentials rows "GitHub App id and private key" and "OpenAI-compatible
  inference". No Phase 5 text is expected to become false (Q5's permission text in §6.4, §12, SP02 step 7, SP19; Q6; Q8;
  the C1 sentence in SP02 step 3). Also not contradicted, NOT changed (planner reading, amendment 8): `docs/architecture.md`
  §1.2 decision 14's closing clause "the trusted wrapper workflow decides which secrets enter which job." — under option B
  the trusted wrapper's explicit per-name mapping decides which secrets enter the pinned reusable workflow, and the trusted
  reusable workflow's Environment declarations decide which of its jobs receives each; the clause's claim (trusted workflow
  definitions, never the policy, route secrets to jobs) stands, and it is not an F1 governing location, so no step edits
  §1.2 (which would trigger the whitepaper §9–§14 / `CLAUDE.md` ripple rule). Each Phase 6 per-file step re-reads its file and changes a restatement only where it
  would otherwise contradict the F1 text; a contradiction found in a K35-pinned location goes back to the planner as an
  amendment note, never edited in the step.
- Plan-level note, NOT written into any design document: the explicit mapping's organization-to-organization case is
  untested (packet 2 F1 recommendation). The lead may record it for M06/M09; no step edits the plan file.

### Q1E content (Phase 6)

Recorded by amendment 7 (2026-09-25). Extends Q1 A; lands in Phase 6 only (the owner's instruction: Phase 5 and its
decomposed steps 5.1–5.6 stay unchanged).

- Gap (decomposer, Phase 5 decomposition; ledger Phase 5 notes "LEAD ITEM"): Q1 A covers only enforcement and the merge-queue
  relay. The same refusal on a Free-plan organization's private repository also removes two other ruleset-based controls the
  design relies on: (1) the evidence-store push restriction (`docs/architecture.md` §11; `docs/processes.md` SP02 step 4);
  (2) required code-owner review of policy and wrapper paths (`docs/processes.md` SP01 step 2, SP02 step 8;
  `docs/architecture.md` §7 row "Rulesets"), on which Q5 A's "wrapper edits stay on the CODEOWNERS-reviewed path" relies.
- Owner answer (as relayed, verbatim): "Extend the Q1 accepted limitation — on a repository whose plan and visibility offer no
  rulesets, both controls are unavailable as well; `steward init` and the SP02 preconditions detect this and report it."
- Disposition: none. No findings cell probed either control, so no cell, disposition string, or roll-up changes
  ("Decisions" row Q1E; roll-up bullet).
- Evidence (what was observed; brief "Test-bed inventory", `probes/testbeds.md` T8 and T9, cited by the PA01 and PA06
  org-private cells of `probes/findings.md` with cause `plan-unavailable`): on `org-private` (Free-plan organization, private)
  listing rulesets (`GET repos/<r>/rulesets`) and creating a ruleset with a required-status-check rule and one with a
  `merge_queue` rule each answered HTTP 403
  `Upgrade to GitHub Pro or make this repository public to enable this feature.`
- Q1E governing locations (architecture first, then processes; each item letter below says what lands where):
  - `docs/architecture.md`: §7 row "Rulesets" (row label unchanged; the Phase 5 clause "GitHub offers rulesets only for some
    plans and visibility settings, which limits enforcement (§10)" is extended); §11 (the paragraph starting "Default
    store:"); §6.4 (the Phase 5 sentence containing "wrapper edits stay on the CODEOWNERS-reviewed path", in the paragraph
    starting "Reusable workflows cannot exceed the caller's permissions").
  - `docs/processes.md`: SP01 step 2; SP02 step 4 (keeps its opening words "4. Create the evidence store"; step 5 still
    starts "5. Set the mode"); SP02 step 7 (the Phase 5 sentence "Wrapper edits stay on the CODEOWNERS-reviewed path (step
    8)."); SP02 step 8 (after the Phase 5 plan-and-visibility sentence).
- Q1E restatements that the Q1E text makes false and that therefore change in Phase 6 (planner reading at `83e8982`, on the
  Phase 5 end state simulated by applying every `patch-steward-m2-phase5-checks/edits-*.txt` to copies of the files):
  - `docs/processes.md` SP18 Controls ("a ruleset allowing pushes only by the App and repository maintainers").
  - `docs/architecture.md` §13 rows "PR modifies the policy or runner definition" ("CODEOWNERS review required for the
    change."), "Forged artifact or evidence identity" ("restrict evidence writes"), and "Compromised steward release"
    ("review updates through protected policy/wrapper paths" — added by amendment 8: it restates required code-owner review
    of wrapper and policy paths, the §7 "Rulesets" protection and SP02 step 8; suggested qualification, wording free
    except the K53 literal: "review updates through protected policy/wrapper paths where the repository's plan and
    visibility offer rulesets (§7 "Rulesets")"; the row's other two clauses "Pin reusable workflows/actions by immutable
    commit SHA;" and "the Copilot CLI runtime is the bundled, lockfile-pinned package with auto-update disabled and no path
    override in Actions." stay byte-for-byte, K54–K55). Width rule: each edited Control cell's text (without the single
    padding space on each side) stays at most 471 characters — the widest §13 Control cell at `<start>` ("Stale success
    after a linked issue or policy change") is 471, and the column with its padding is 473 — so Prettier does not re-pad
    the §13 table and X13s stays byte-identical (K35). Measure with
    `grep '^| <threat label> ' docs/architecture.md | awk -F'|' '{s=$3; sub(/^ /,"",s); sub(/ +$/,"",s); print length(s)}'`
    (at `<start>`: "Compromised steward release" 233; under a byte-counting locale a `§` counts 2, so a byte count at
    most 471 is also safe). Threat labels unchanged.
  - `docs/whitepaper.md` §12 ("Evidence writes are restricted to the App and maintainers").
  - `docs/user-manual/installation.md` step 4 ("Restrict evidence-store pushes to the App and repository maintainers.") and
    step 8 (after the Phase 5 plan-and-visibility sentences; keep "8. Before enabling" and "4. Create the evidence" openings).
  - `docs/user-manual/configuration.md`: "Maintainers own the policy through CODEOWNERS and required code-owner review." and,
    in `## Evidence and visibility (Proposed)`, "Both store types restrict pushes to the App and maintainers." (headings,
    `(Proposed)` and `NEEDS INPUT` counts unchanged).
  - Not contradicted, NOT changed: architecture §7 row "CODEOWNERS", §6.7 row "`CODEOWNERS` entries", §8 ("owned by
    maintainers through CODEOWNERS"), §10 Q1 text (A13, still true), §6.5 `steward init` row; processes SP02 step 8's
    Phase 5 enforce sentence, SP03 step 7, the CODEOWNERS review-request sentence in SP13 Controls; whitepaper §3 and §9;
    `README.md`; `CLAUDE.md` (invariants and "Intended architecture", K35); `docs/user-manual/troubleshooting.md`. A
    Phase 6 step that finds another restatement contradicting the Q1E text corrects it only if its file is in that step's
    scope and the location is not K35-pinned; otherwise it sends an amendment note.
- Q1E must state (wording free unless K37–K55 require a literal):
  - (a) [§7 row "Rulesets"; §11; SP01 step 2; SP02 steps 4 and 8] Where GitHub offers no rulesets for a repository's plan
    and visibility, two further ruleset-based controls are unavailable there as well: the evidence-store push restriction
    (pushes only by the App identity and maintainers) and required code-owner review of policy and wrapper-workflow paths.
    This is an accepted limitation, like enforcement and the merge-queue relay (§10). The §7 "Rulesets" row cites §11 for the
    evidence-store case (K37).
  - (b) [§11; SP02 step 4] The push restriction depends on the plan and visibility of the repository that holds the evidence
    store: the target repository for the orphan branch, the separate repository otherwise.
  - (c) [§11; SP02 steps 4 and 8] `steward init` and the SP02 preconditions detect that GitHub refuses rulesets and report
    that the control is unavailable: step 4 for the push restriction, step 8 for required code-owner review. §11 cites
    "SP02 step 4" (K39).
  - (d) [SP01 step 2] Required code-owner review of a policy-change PR exists only where the repository's plan and
    visibility offer rulesets (SP02 step 8 reports its absence). The rest of step 2 is unchanged and still holds everywhere:
    the PR is screened under the current trusted-branch policy and its proposed policy is reported as data, never applied.
  - (e) [§6.4 and SP02 step 7, the Phase 5 Q5 sentences] "Wrapper edits stay on the CODEOWNERS-reviewed path" is qualified:
    required code-owner review of wrapper paths exists only where rulesets are offered (§7 "Rulesets"; SP02 step 8); the
    rest of those Q5 sentences stays as Phase 5 wrote it (`steward init` writes wrapper permissions equal to the pinned
    reusable workflow's job permissions; the self-test fails visibly on a short grant; "startup" stays — K11, K13).
  - (f) [every location above] The observed case is a Free-plan organization's private repository, where GitHub refused
    rulesets; the text may quote the refusal message and may cite `probes/findings.md` with PA01 or PA06 (their org-private
    cells record the refusal).
  - (g) [restatements listed above] Each restatement of the push restriction or of required code-owner review is qualified
    the same way: available only where the repository's plan and visibility offer rulesets.
- Q1E evidence bounds (the text states no more than the probes showed; roadmap Phase 6 DoD 6): it does NOT state that
  classic branch protection, CODEOWNERS files, or CODEOWNERS review requests are available or unavailable on such a
  repository (none was probed), and does not offer branch protection as a substitute; it does NOT state that a ruleset with
  a push-restriction or code-owner-review rule was itself attempted (the attempts were a required-status-check ruleset, a
  `merge_queue` ruleset, and the listing — all refused), nor that either control was verified on a public repository; it
  adds no behavior the owner did not decide — no requirement or recommendation to upgrade the plan, make the repository
  public, or move the evidence store to a separate repository, and no change to modes, outcomes, admission, per-run
  reports, or `inconclusive` causes. It cites no `PDxx`, `Mxx`, `Q1E`, or plan file, and adds no C1 marker (K24 exact
  counts).
- Phase 5 cross-check (planner reading at `83e8982` of `edits-*.txt` and the ledger Phase 5 notes): no Phase 5 step needs a
  decomposer revision before it runs. Phase 5 text that Q1E makes false or incomplete, corrected in Phase 6 (routing: the
  owner's instruction; the Phase 6 per-file step owning the file):
  - FALSE on a repository without rulesets — block A03 (`docs/architecture.md` §6.4): "and wrapper edits stay on the
    CODEOWNERS-reviewed path."; block P02 (`docs/processes.md` SP02 step 7): "Wrapper edits stay on the CODEOWNERS-reviewed
    path (step 8)." → item (e).
  - INCOMPLETE, still true — block A09 (§7 "Rulesets": "which limits enforcement (§10)") → item (a); block P03 (SP02 step 8)
    and block U01 (installation step 8) → items (c) and (g). Blocks A11, A13, P06 stay as written (enforcement and relay
    only; still true).

### Phase 6 content checks

Run from the repo root in bash with the helpers `J` and `N`, the forms (NEW / OLD, "grows", "present"), and the extracts of
"Phase 5 content checks"; `<start>` = `10fcaf2d575037be7c13e0ba0719feb53d51d71f`. New extracts:

```text
XP02s3 docs/processes.md                    J '^3[.] Configure inference' '^4[.] Create the evidence store'
X64t   docs/architecture.md                 grep -E '^\| `(gate|intake|execute|assess|publish|steward-(pr|relay|issues|maintenance)[.]yml)`'
X13s   docs/architecture.md                 grep '^| Stale success after a linked issue or policy change '
```

OLD values, dry-run at `78f215e` (docs unchanged since `<start>`): K28, K29, K31, K32, K33, K34 = `0`; K30 = `1`.

```text
K28  F1  grows    X64p1
L: on.workflow_call.secrets
K29  F1  grows    X64p1
L: secrets: inherit
K30  F1  present  X64p1
L: no job references both
K31  F1  grows    X7w
L: on.workflow_call.secrets
K32  F1  grows    X7e
L: secrets:
K33  F1  grows    XP02a
L: secrets:
K34  F1  grows    XP02s3
L: secrets:
```

K35 (not F1 or Q1E locations; unchanged since `<start>`): for each of X13s, X64t (on `docs/architecture.md`) and XCL (on
`CLAUDE.md`): `diff <(git show <start>:F | X | tr -d '\r') <(X < F | tr -d '\r')` prints nothing. X13s is the §13 table's
re-padding canary (its Control cell is the widest, 471 characters; a wider edited cell re-pads every row). K25 is void in
Phase 6 for X64p1, X7w, X7e, XP02a (F1 B changes them) and for X13c (Q1E qualifies it, amendment 8; K53–K55 bound the
change); it holds for XCL through K35.

K36 (dispositions; `probes/findings.md`):
`grep -E '^\| PA04\.1 ' probes/findings.md | grep -c 'design-change: docs/architecture.md §6.4'` prints `3`;
`grep -E '^\| PA04 ' probes/findings.md | grep -c 'design-change: docs/architecture.md §6.4'` prints `1`; the count of lines
of `probes/findings.md` holding the open-disposition marker (roadmap Phase 6 DoD 1 command) prints `0`.

Q1E checks (amendment 7). New extracts (anchors stay unchanged, so every extract still finds its text):

```text
X11    docs/architecture.md                 J '^## 11[.] ' '^## '
X13p   docs/architecture.md                 grep '^| PR modifies the policy or runner definition '
X13f   docs/architecture.md                 grep '^| Forged artifact or evidence identity '
XP01   docs/processes.md                    J '^### SP01[.] ' '^### '
XP02s4 docs/processes.md                    J '^4[.] Create the evidence store' '^5[.] Set the mode'
XP02s7 docs/processes.md                    J '^7[.] Run the installation self-test' '^8[.] Before enabling'
XP02s8 docs/processes.md                    J '^8[.] Before enabling' '^Controls:'
XP18   docs/processes.md                    J '^### SP18[.] ' '^### '
XW12   docs/whitepaper.md                   J '^## 12[.] ' '^## '
XI4    docs/user-manual/installation.md     J '^4[.] Create the evidence' '^5[.] Configure the policy'
XI8    docs/user-manual/installation.md     J '^8[.] Before enabling' '^[[:space:]]*$'
XCo    docs/user-manual/configuration.md    J '^Maintainers own the policy through CODEOWNERS' '^[[:space:]]*$'
XCe    docs/user-manual/configuration.md    J '^The evidence store is append-only' '^[[:space:]]*$'
```

OLD values (at `<start>`; dry-run at `83e8982`, and identical on the simulated Phase 5 end state, so every "grows" below
needs Phase 6 text): K44 and K50 = `1`; every other K37–K52 = `0`. K53–K55 (amendment 8; OLD at `<start>`, dry-run at
`84f71e0`): K53 = `0`; K54 and K55 = `1`.

```text
K37  Q1E  grows    X7r
L: §11
K38  Q1E  grows    X11
L: visibility
K39  Q1E  grows    X11
L: SP02 step 4
K40  Q1E  grows    X64
L: required code-owner review
K41  Q1E  grows    XP01
L: visibility
K42  Q1E  grows    XP02s4
L: visibility
K43  Q1E  grows    XP02s7
L: visibility
K44  Q1E  grows    XP02s8
L: code-owner review
K45  Q1E  grows    XP18
L: visibility
K46  Q1E  grows    X13p
L: visibility
K47  Q1E  grows    X13f
L: §11
K48  Q1E  grows    XW12
L: visibility
K49  Q1E  grows    XI4
L: visibility
K50  Q1E  grows    XI8
L: code-owner review
K51  Q1E  grows    XCo
L: visibility
K52  Q1E  grows    XCe
L: visibility
K53  Q1E  grows    X13c
L: visibility
K54  Q1E  present  X13c
L: Pin reusable workflows/actions by immutable commit SHA;
K55  Q1E  present  X13c
L: the Copilot CLI runtime is the bundled, lockfile-pinned package with auto-update disabled and no path override in Actions.
```

K35 still holds with the §13 edits (width rule under "Q1E content (Phase 6)": each edited Control cell at most 471
characters, so X13s stays byte-identical).

K1–K24 and K26 still hold after Phase 6 (F1 B and Q1E add no marker and remove no Phase 5 literal; K1, K4, K6 keep their
`visibility` growth; K11 and K13 keep `startup`; K24's `XP02` `S` count stays `3`). K27's disposition strings still hold;
its marker count is superseded by K36.

Not mechanical (supervisor judgment, not delegated): every F1 must-state item (a)–(g) and every Q1E must-state item (a)–(g)
is present at its locations, architecture first; the F1 and Q1E evidence bounds hold; every occurrence of
`secrets: inherit` in `docs/`, `README.md`, `CLAUDE.md` presents it as the wiring the design does not use; no Phase 5
sentence is left false (by F1 B or by Q1E; the two Q5 sentences named under "Q1E content (Phase 6)" are qualified).

## Fixed conventions (planner-set; steps embed these verbatim — defects go back to the planner as amendment notes)

### Suite layout in this repository

Location (owner decision 6): canonical probe sources, procedures, results, the findings record, and measured limits live in
THIS repository under a new root directory `probes/`. The test-bed
repositories hold only deployed copies and live fixtures, because PD02 makes them disposable and recreatable from here.
`probes/` is a plain root directory, not a workspace package.

```text
probes/
├── README.md                      purpose, conventions, deploy / run / steady-state / drift re-run procedures
├── testbeds.md                    test-bed and fixture inventory, capability matrix with evidence, owner actions
├── findings.md                    findings record: roll-up, per-cell results, measured limits, dispositions
├── smoke/
│   ├── README.md
│   ├── workflows/*.yml
│   └── results/<testbed-key>.md
└── pa0N-<slug>/                   one directory per assumption
    ├── README.md                  sub-claims, fixtures, deployment list, exact procedure (the commands that were run)
    ├── workflows/*.yml            canonical source of every workflow file deployed for this probe
    ├── fixtures/**                optional: any other file deployed to a test-bed
    └── results/<testbed-key>.md   one result file per covered test-bed
```

- Directory slugs (fixed): `pa01-required-checks`, `pa02-ownership-artifacts`, `pa03-trusted-triggers`,
  `pa04-privilege-separation`, `pa05-rounds-concurrency`, `pa06-merge-queue-relay`, `pa07-app-token-writes`,
  `pa08-copilot-inference`, `pa09-run-list-caps`. Test-bed keys (fixed): `org-public`, `org-private`, `personal`.
- A workflow deployed to a test-bed lives there at `.github/workflows/<same file name>`. Every deployed workflow file name starts
  with `probe-` (`probe-smoke-*.yml`, `probe-pa0N-*.yml`) and is unique across the whole suite. Workflow files under `probes/`
  are inert in this repository (GitHub reads only the root `.github/workflows/`). Nothing is ever added to this repository's
  `.github/workflows/`.
- Allowed file types under `probes/`: Markdown, YAML, JSON, plain text, and shell scripts (`.sh`). `.mjs` files are allowed only
  if `pnpm lint` passes with the unmodified `eslint.config.mjs` (import `process` from `node:process` and `console` from
  `node:console`, or declare globals in a `/* global */` comment). No `.ts` files (no tsconfig covers them). No dependency is
  added to any `package.json`; whatever a probe needs at run time (for example `@github/copilot`, the Copilot SDK) is installed
  on the Actions runner at a version the result file records.
- A step that probes one assumption on its primary test-bed owns that assumption's `README.md`, `workflows/`, `fixtures/`, and
  its own `results/<key>.md`. A step that repeats the probe on another test-bed owns only its `results/<key>.md`; if the shared
  workflow needs a change there, it reports a deviation instead of editing out of scope. Exception: the PA08 cap step runs after
  the PA08 step on `personal`, adds its own `probe-pa08-cap*.yml` workflow, and edits `probes/pa08-copilot-inference/README.md`
  and `results/personal.md` (rows PA08.3 and PA08.5 with their evidence, extra PA08.6 evidence) — sequenced by `depends_on`,
  never in parallel with another writer of those files.

### Fixture naming and isolation on the test-beds

- Every fixture is attributable by name: branches `probe-pa0N-base[-x]` (PR targets) and `probe-pa0N-head-*` (PR heads); issue
  and PR titles start with `[probe PA0N]`; check-run names `probe-pa0N/<purpose>`; Environments `probe-pa0N-<purpose>`; rulesets
  `probe-pa0N-<purpose>`; labels `probe-pa0N:<x>`; concurrency groups `probe-pa0N-<x>`; artifacts `probe-pa0N-<x>`. Phase 1
  canaries use `probe-canary-<x>`; the smoke probe uses `probe-smoke-<x>`. Only PA02 may also use the design's literal artifact
  names (`steward-ownership-...`), because the names themselves are under test.
- Rulesets target ONLY `refs/heads/probe-*` patterns (a pattern or an exact ref, every `conditions.ref_name.include` entry
  starting with `refs/heads/probe-`). Never create a ruleset or branch protection whose conditions include
  `~DEFAULT_BRANCH`, `~ALL`, or `master`: it would block every other probe's deployment. PRs target a `probe-pa0N-base` branch,
  never `master`, except where a sub-claim is about the default branch itself.
- A ruleset carrying a `merge_queue` rule lists ONLY exact, non-wildcard refs in `conditions.ref_name.include`, each starting
  with `refs/heads/probe-` (the platform rejects wildcards with HTTP 422 — platform fact under "Test-bed inventory"): the Phase 1
  canary uses exactly `refs/heads/probe-canary-merge-queue`; PA06 uses its exact base branch refs (for example
  `refs/heads/probe-pa06-base`), never `refs/heads/probe-pa06-*` or any other `*` pattern.
- Trusted-trigger workflows (`pull_request_target`, `issues`, `issue_comment`, `workflow_run`, `schedule`) must be on `master` to
  run at all, so all probes share `master` for workflow files and nothing else.
- Every event-triggered probe workflow begins with a job-level `if` that matches only its own marker (title prefix, branch
  prefix, or comment prefix), so another probe's events produce only a skipped run.
- One fork is permitted as a fixture (owner decision 5): `jambolo/patch-steward-testbed-public` (fork of `org-public`, created in
  Phase 1, recorded in `probes/testbeds.md`). It is a PR head repository only: no workflows are enabled or run there, and the App
  is not installed there. No other fork is created.

### Deployment

- Clone a test-bed over SSH (`git@github.com:<owner>/<repo>.git`) into a per-step temporary directory OUTSIDE this repository's
  working tree; never add a test-bed clone, submodule, or subtree to this repository.
- Copy the canonical files, commit once per deployment with message `probe(PA0N): deploy <file names>`, push to `master` with a
  bounded fetch–rebase–retry loop (at most 5 attempts) because other steps deploy concurrently. Never force-push `master`; never
  rewrite test-bed history; force-push is allowed only on `probe-pa0N-head-*` branches.
- Never write workflow files through the REST contents API, never merge through the API a PR that changes workflow files, never
  run `gh repo sync` (no `workflow` scope). If the platform still refuses an operation for a missing `workflow` scope, record the
  refusal verbatim and raise an owner action; do not work around it.
- After every deployment verify byte identity by blob SHA:
  `test "$(git rev-parse HEAD:probes/<dir>/workflows/<file>)" = "$(gh api repos/<owner>/<repo>/contents/.github/workflows/<file> --jq .sha)"`
  (run in this repository after the canonical file is committed; `core.autocrlf=true` normalizes both sides to LF).
- Validate workflow syntax before pushing: `actionlint -ignore 'unknown permission scope "copilot-requests"' <file>`.

### Probe workflow safety rules (the public test-beds accept issues, comments, and PRs from any GitHub user)

- Never check out, build, or execute PR head content. Never pass event text through `${{ }}` into a `run:` script; pass it
  through `env:` and treat it as data.
- A job that uses a secret or mints an App token on an event trigger runs only when the event sender is allowlisted:
  `jambolo` or `patch-steward-testbed[bot]`.
- A workflow that writes with the App token in response to an event must not react to events sent by the App bot. The only
  workflow allowed to react to App-bot events is a listener that records the event and performs no writes. This prevents event
  loops (the platform suppresses recursion only for `GITHUB_TOKEN` writes).
- Never print tokens, keys, or secret values; verify secret delivery by length or by a SHA-256 digest of a known dummy value.
  Environment secrets used by probes are dummy marker values set with `gh secret set --env`, never real credentials; the real App
  key stays a repository-level secret.
- Use only GitHub-owned actions (`actions/*`), pinned to a major version tag or a full commit SHA. Every job declares explicit
  least-privilege `permissions`.
- Copilot probes follow the design's isolation: run the runtime in an empty working directory outside any checkout, with a fresh
  `COPILOT_HOME`, no MCP servers, no tool allowed; prompts contain no repository content and no secrets.

### Running, waiting, and budgets

- Poll no more often than every 20 seconds (`gh run watch --interval 20` or an explicit loop). Bound every wait: 15 minutes for
  an ordinary run, 60 minutes for a scheduled trigger (exception: the Phase 4 Q3 re-probe on `org-private` uses the owner-set
  bound of 6 hours per schedule file — owner decision Q3 A with the owner's clarification of 2026-09-25; "Re-probe rules"),
  30 minutes for a merge-queue transition, 50 minutes for a cap session run ("Copilot cap step" below). Before a polling loop
  check `gh api rate_limit --jq .resources.core.remaining` and stop below 500.
- A probe that does not run because its own workflow or commands are wrong is a STEP FAILURE, never an `undetermined` result.
  After 3 deploy–fix iterations on one workflow the step reports `status: fail` with the last error verbatim.
- Standard Copilot budget (everything except the cap step): at most 24 prompts submitted for the whole milestone (one
  `copilot -p` invocation or one SDK send each; Phase 1 smoke at most 2; the decomposer splits the rest across the PA08 steps
  other than the cap step). Each prompt is at most 200 characters and asks for a one-word answer. No retry beyond one on
  failure. Every Copilot request of the milestone is recorded with its UTC timestamp in the result file of the step that sent it.
- Early exhaustion: if a standard prompt fails with a failure shape that names the allowance, quota, credits, or a plan limit,
  the step records the failure verbatim (it is evidence for part (c) of PA08.3), sends no further Copilot request on that
  account, and records the cells it could not finish `undetermined` / `blocked`. No step works around an exhausted allowance.
- Cap budget: the deliberate exhaustion of the Copilot Free allowance has its own hard bounds — "Copilot cap step" below.
- `org-private` Actions usage stays under 300 billed minutes for the milestone (the Free plan grants 2,000 per month).
- Scheduled fixtures use a cron interval of at least 15 minutes on every test-bed, are disabled (`gh workflow disable`) as soon
  as one scheduled run is captured, are disabled on `org-private` before any `needs-human` return, and are never left enabled at
  the end of Phase 3.
- Record dates and times in UTC, ISO 8601.

#### Copilot cap step (owner decision 8)

- Purpose, on `personal` only, in this order: (1) observe the session soft cap (PA08.5); (2) exhaust the Copilot Free included
  allowance and record the failure shape (part (c) of PA08.3); (3) repeat the PA08.6 reads once while the allowance is
  exhausted (extra evidence under PA08.6).
- Ordering (hard rule): it is the LAST step of the milestone that may send a Copilot request. It `depends_on` every other step
  that sends a Copilot request or records a PA08 cell on any test-bed (the PA08 step on `personal`; the PA08 repeats on
  `org-public` and `org-private`). The supervisor launches it only after those steps are verified and merged and their `refuted`,
  `blocked`, and `ambiguous` cells have passed the Phase 2 judgment check, because after exhaustion no revision can obtain a
  Copilot reply on `jambolo` until the monthly reset (00:00:00 UTC on the first day of the next calendar month). The decomposer
  may split the cap step into a short sequential chain (PA08.5, then exhaustion); the chain shares the bounds below.
- Unit of work: a cap session is one workflow run on `personal` that holds one SDK session created with
  `sessionLimits: { maxAiCredits: 30 }` (30 is the documented minimum) and sends burn prompts until the runtime reports the
  session limit, a send fails, or a bound below is hit. Before the first cap session, one probe session requests
  `maxAiCredits: 1` to record whether a value below the documented minimum is accepted; if it is accepted, its burn sends (at
  most 5) observe PA08.5 at that value first.
- Burn prompt: synthetic filler generated inside the job — no repository content, no event content, no secrets, no tools — with
  a unique leading nonce so that cached-input pricing does not apply, asking for a one-word answer, and sized so that one send
  costs at least 0.75 AI credits (at the listed prices about 40,000 uncached input tokens on the cheapest model). The reported
  usage of the first burn send is recorded. If it shows less than 0.75 AI credits, or the runtime rejects the size, the step
  resizes at most twice and otherwise stops with a deviation. If the runtime reports no usage at all, the step continues on the
  send and time bounds alone and records that.
- Hard bounds (architecture §2 invariant 7), all binding at once:
  - cap sessions: at most `S`. `S = 10` — a fixed ceiling set by the owner on 2026-09-18 (owner decision 8), not derived from
    the allowance: the owner reported neither the size of `jambolo`'s monthly allowance nor the credits already used this
    month, and no step asks for them or reads the billing pages. The `maxAiCredits: 1` probe session is not a cap session and
    does not count toward `S`. Worst case at `S = 10`: 10 cap session runs of at most 45 minutes each (450 runner-minutes, 7.5
    hours) plus the one probe session run, and 405 sends in total; `personal` is public, so no Actions minutes are billed.
    While the session limit works, the cap sessions consume at most 10 × 30 = 300 AI credits plus one response of overshoot
    per session; where it fails to stop a session, the 40-send and 45-minute bounds stop it. At the ceiling without
    exhaustion the stop reason is `ceiling-reached`. No step raises `S` or runs an eleventh cap session: a continuation needs
    a new owner decision recorded by a planner amendment.
  - sends per cap session: at most 40; at most 5 sends in the `maxAiCredits: 1` probe session; total at most
    `40 × S + 5` = 405. Sends and sessions spent while debugging the cap workflow count against these bounds.
  - time: every job that holds a cap session or the `maxAiCredits: 1` probe session declares `timeout-minutes: 45`; the worker
    waits at most 50 minutes for one run; consecutive sessions start at least 60 seconds apart.
  - retries: after a failed send wait at least 5 minutes, retry once, then stop.
- Stop reasons (closed set; recorded in the Measurements table as quantity `cap stop reason`): `allowance-exhausted` (a send
  failed twice, at least 5 minutes apart, with a failure shape that names the allowance, quota, credits, or a plan limit);
  `ceiling-reached` (all `S` = 10 cap sessions ran and sends still succeed); `exhausted-before-start` (the step's very first
  send failed that way, twice, at least 5 minutes apart — typically because an earlier step already recorded the exhaustion;
  the step then sends nothing further); `blocked` (any other failure that survived the one retry, for example a persistent
  rate limit).
- Results: `allowance-exhausted` and `exhausted-before-start` provide the evidence for part (c). `ceiling-reached` and `blocked`
  make PA08.3 on `personal` `undetermined` / `blocked`, with the consumed totals as evidence; after `ceiling-reached` the Phase 3
  decision packet asks the owner whether to continue ("Decision packet format"). PA08.5 is `undetermined` / `blocked` when the
  allowance ran out before any session limit was reached. Further Measurements rows of the step: `cap sessions run`,
  `cap sends`, `cap AI credits reported` (the sum of the runtime's usage reports — a lower bound on what was left of the
  monthly allowance), and for PA08.5 the configured limit, the reported use at the stop, and the overshoot.
- Never: enable additional usage, set a Copilot spending budget, change `jambolo`'s Copilot plan, or continue with another
  account or a personal access token after exhaustion. These would be owner actions and are out of scope.
- Drift re-runs: the cap workflow stays deployed and disabled like every other probe, but it is NOT part of the routine drift
  re-run. `probes/README.md` `## Drift re-run` lists it separately as "owner approval required: consumes the repository owner's
  whole monthly Copilot allowance".

### Result file format (`probes/pa0N-<slug>/results/<testbed-key>.md` and `probes/smoke/results/<testbed-key>.md`)

```text
# PA0N — <assumption title> — <testbed-key>

- assumption: PA0N
- test-bed: <owner>/<repo>
- probed: <first UTC timestamp> to <last UTC timestamp>
- step: <pipeline step id>
- workflows: <deployed file name> <blob SHA>; ...

## Results

| Sub-claim | Kind       | Result    | Cause | Evidence |
| --------- | ---------- | --------- | ----- | -------- |
| PA0N.1    | assumption | confirmed | none  | E1, E2   |

## Measurements

| Sub-claim | Quantity | Value | Unit | Method | Samples |
| --------- | -------- | ----- | ---- | ------ | ------- |

## Evidence

### E1 — <what it shows>

<command or run URL, then the verbatim output in a fenced block with language text>

## Deviations from the design

<for each refuted cell: the design sentence quoted with its document and section, then what was observed>

## Residue

<fixtures this probe left on the test-bed and their state>
```

- One Results row per sub-claim the coverage matrix assigns to that test-bed; the `Sub-claim` cell is exactly the ID; the `Kind`
  cell is exactly `assumption`, `measurement`, or `fixed`, as the sub-claim tables above give it. Results rows are the lines
  matching `^\| PA0[1-9]\.[0-9]+ +\| (assumption|measurement|fixed) +\|` (Measurements rows do not match: their second cell
  is a quantity).
- `Result` is exactly one of `confirmed`, `refuted`, `undetermined`. `Cause` is `none` unless the result is `undetermined`, then
  exactly one of: `plan-unavailable` (the test-bed's plan or ownership does not offer the feature; evidence is the platform's
  refusal — never a validation error of the probe's own request, see "Test-bed record format"), `pd03` (organization Copilot billing path), `blocked` (an external blocker survived bounded attempts: declined owner
  action, exhausted quota, platform incident; evidence is the attempts), `ambiguous` (the probe ran but the evidence does not
  discriminate; the row's evidence must say which further observation would settle it).
- `undetermined` is never a substitute for a probe that was not attempted. Every `undetermined` row cites evidence of the
  attempt or the refusal. Where Phase 1's capability matrix already holds the refusal for that test-bed, the row cites
  `probes/testbeds.md` and the evidence id there.
- Dependent cells: when a sub-claim cannot be probed on a test-bed because another sub-claim there was refuted or undetermined
  (for example usage reporting when inference fails), record `undetermined` / `blocked` and cite the blocking cell's evidence
  ids; add one evidence section that names the blocking cell. The decision packet groups the dependent cell under the blocking
  cell's question.
- Evidence is verbatim and minimal: the fields that decide the sub-claim, not whole payloads. Each fenced block is at most 60
  lines; elide with a line `[... N lines elided ...]`. Always fence verbatim output with the language `text` (never `json` or
  `yaml`, which Prettier rewrites). Include run URLs and API paths so the evidence can be re-fetched.
- Redact before writing: tokens, keys, secret values, and email addresses other than `noreply` addresses. Everything committed is
  public, including evidence from `org-private`; record only names, ids, URLs, states, and timestamps from the private test-bed.

### Test-bed record format (`probes/testbeds.md`)

- Section `## Inventory`: the three test-beds and the fork (repository, key, owner type, visibility, default branch, App
  installation id as observed from inside a workflow).
- Section `## Capability matrix`: one row per capability, one column per test-bed key, plus an evidence column. Capabilities
  (fixed ids): `ssh-deploy` (push a workflow file to `master` over SSH); `dispatch` (`gh workflow run`, watch the run, download
  its logs and artifacts with the local token); `app-token` (mint an App installation token inside a workflow); `app-check-run`
  (create and complete a check run with that token); `artifact-list` (upload an artifact and see it in the repository-wide
  listing); `environment` (create through the API an Environment whose deployment-branch policy allows only `master`, and set an
  Environment secret); `ruleset-required-check` (create through the API a ruleset on `refs/heads/probe-canary-*` requiring a
  status check bound to integration id 4993303); `ruleset-merge-queue` (create through the API a ruleset whose
  `conditions.ref_name.include` is exactly the one non-wildcard ref `refs/heads/probe-canary-merge-queue`, with a merge-queue
  rule; a wildcard target is rejected by the platform — see "Test-bed inventory"); `fork-pr` (`org-public` only: the fork exists
  and a PR from it opens).
- Cell values (closed set): `available`, `unavailable` (the platform refused; the refusal is the evidence),
  `owner-action-pending`, `owner-action-done`, `owner-declined`, `not-applicable`.
- A refusal is an answer about the capability (plan or ownership, for example HTTP 403 "Upgrade to GitHub Pro ..."), or the API
  cannot express the setting. An error that faults the request's own parameters (for example HTTP 422 "Validation Failed" whose
  `errors` name a field, value, or rule of the request) is a defect of the probe's request, NOT a refusal: it never yields
  `unavailable`, `plan-unavailable`, or an owner-action entry. Fix the request within the step's bounds, or end the step
  `status: fail` with the response verbatim.
- `ssh-deploy`, `dispatch`, `app-token`, `app-check-run`, and `artifact-list` are milestone Inputs and must end `available` on
  all three test-beds. Every other cell may end with any value except `owner-action-pending`.
- Section `## Owner actions`: one entry per action (format under "Owner actions and escalation"), each marked `pending`, `done`
  (with the verifying command and its output), or `declined`.
- Section `## Fixtures`: every fixture left on a test-bed (branches, Environments, rulesets, labels, scheduled workflows and
  their enabled or disabled state, long-lived artifacts with `expires_at`), updated by the step that creates or removes one.
  Canary fixtures are removed once their result is recorded.
- Section `## Evidence`: headings `T1`, `T2`, … with verbatim fenced output, cited from the matrix and from result files.

### Findings record format (`probes/findings.md`)

- Section `## Roll-up`: one row per assumption PA01–PA09: ID, title, result, test-beds covered, link to the result files,
  disposition. Roll-up rule: `refuted` if any cell of the assumption is `refuted`; else `undetermined` if any cell is
  `undetermined`; else `confirmed`.
- Section `## Cells`: one row per Results row of every result file: sub-claim, test-bed key, kind, result, cause, disposition.
  Values are copied, never re-judged.
- Section `## Measured limits`: one row per measured quantity: sub-claim, quantity, value, unit, test-bed, method, date, the §15
  item or later milestone it feeds. A limit taken from GitHub documentation instead of measurement is labeled `documented` with
  its URL. M02 proposes no product value.
- Section `## Deviations`: every refuted cell with the quoted design text and the observation.
- Disposition values: `none` (confirmed), `PENDING` (refuted or undetermined, before the owner decides), then one of
  `design-change: <document §>`, `accepted-limitation: <document §>`, `owner-deferred: before M06` (PA01–PA07, PA09) or
  `owner-deferred: before M09` (PA08) — the last only when the owner explicitly chooses it. PA08.7 is
  `accepted-limitation` from the start (milestone exit criterion 3); its document reference is filled in Phase 5
  (`accepted-limitation: docs/architecture.md §6.3`). Recorded disposition strings: "Post-probe owner decisions".

### Decision packet format (`development-artifacts/patch-steward-m2-decision-packet.md`)

- Numbered questions `Q1`…`Qn`, one per ROOT CAUSE, not per cell (for example one question for every `plan-unavailable` cell on
  `org-private`). Every refuted or undetermined cell except PA08.7 appears in exactly one question.
- Each question states: the cells covered; the design text at stake, quoted with document and section; what was observed, with
  links into the result files; the dependent milestones (PA01–PA07 and PA09 block M06; PA08 blocks M09; PA05 feeds M13; PA06
  feeds M19; PA08.6 feeds M20); two or more options, each naming the document sections it would change; one recommendation with
  its reason.
- A question that covers cells left `undetermined` / `blocked` by an exhausted Copilot allowance (early exhaustion, or PA08.5
  in the cap step) must include the option "re-run those cells after the monthly reset" (00:00:00 UTC on the first day of the
  next calendar month).
- A question that covers PA08.3 on `personal` left `undetermined` / `blocked` by the cap stop reason `ceiling-reached` must
  state the consumed totals (`cap sessions run`, `cap sends`, `cap AI credits reported`) and include the option "continue the
  exhaustion under a new owner-approved session ceiling" (owner decision 8). The packet only asks: a continuation runs only
  after a planner amendment records the new ceiling.
- Confirmation item: `C1` the wording of the "unverified" marker for the organization billing path (answered: C1 A — the
  default forms, byte-exact in "Post-probe owner decisions").
  There is no `C2`: recording `probes/` and the `PA01`–`PA09` identifier family in architecture §6.1, `README.md`, and
  `CLAUDE.md` is settled by owner decisions 6 and 7 and is unconditional in Phase 5.
- Writing the packet requires design judgment over `docs/architecture.md` and `docs/processes.md`: route it as a `judgment` step,
  not to a cheap worker. The packet proposes; the owner decides. No agent applies a design change before the planner has
  recorded the owner's answer in this brief.
- The packet lives under `development-artifacts/`, so it is not format-checked (owner decision 9). Its acceptance is structural
  only — questions, cells covered, options, recommendation, `C1` — and never a Prettier command; design text and evidence it
  quotes are copied exactly.

### Re-probe rules (Phase 4; owner decisions Q3 A and Q4 A)

- Scope: Phase 4 is the only phase after Phase 3 that writes to the test-beds or the fork. Phase 2 rules apply unchanged:
  "Fixture naming and isolation on the test-beds", "Deployment", "Probe workflow safety rules", "Result file format", the
  refusal definition ("Test-bed record format"), "Acceptance-design rules for probe steps".
- Write forms (session in auto mode; ledger Phase 1 notes, emergent contract "GitHub write forms"): only
  `git push git@github.com:<test-bed or fork>.git …`, `gh api repos/<test-bed or fork>/… [-X METHOD …]` (path directly after
  `gh api`), and `bash probes/smoke/tools/<tool>.sh <literal args>` run from the MAIN-tree root — each ONE standalone command
  with literal values. Workflow enable/disable = `gh api repos/<owner>/<repo>/actions/workflows/<file>/enable -X PUT` (or
  `/disable`). A permission denial or prompt on one of these forms → the step ends `status: fail` with the refusal verbatim →
  the supervisor returns `RESULT: needs-human` (an owner decision; never a revision; no other route is tried).
- Execution: every spawned agent runs in the FOREGROUND (ledger Phase 1 notes, READ FIRST).
- New tools: a re-probe that needs a write no allow-listed form expresses (for example setting a repository-level dummy
  secret, which `gh api` cannot encrypt) may add a NEW script under `probes/smoke/tools/` (precedent: Phase 3's
  `steady-state.sh`); it is merged into the main tree before any step runs it; the five Phase 1 tools and `steady-state.sh`
  are not edited.
- Copilot: no Phase 4 request. `jambolo`'s allowance is exhausted until 2026-10-01T00:00:00Z and no re-probe depends on a
  Copilot reply. Check: `grep -rF 'copilot_request_utc=' probes/ | wc -l` prints the same number at the end of Phase 4 as at
  its start.
- Actions minutes on `org-private`: the milestone bound of 300 billed minutes stands. Reading of 2026-09-25 (month to date,
  all of the milestone's use so far):
  `gh api "organizations/steady-orchard/settings/billing/usage?year=2026&month=9" --jq '[.usageItems[] | select(.product=="actions" and .repositoryName=="patch-steward-testbed-private") | .quantity] | add'`
  → `69.000016819`. Q3 worst case about 48 billed minutes (2 files × 4 runs per hour × 6 h, about 1 minute each); the Q4
  re-probe adds a few runs. The step that ends Phase 4 records the same reading (plus October's if the phase crosses
  2026-10-01) and the sum stays at most 300.
- Recording: results go into the EXISTING result files — `probes/pa03-trusted-triggers/results/org-private.md` (Q3) and
  `probes/pa04-privilege-separation/results/{org-public,org-private,personal}.md` (Q4). New evidence sections continue the
  file's `E<n>` numbering and their headings name the re-probe (`### E<n> — Q3 re-probe: …`, `### E<n> — Q4 re-probe: …`);
  earlier evidence is never edited or deleted; `- probed:` is extended to the last re-probe timestamp; `- step:` gains the
  step id; `- workflows:` gains each newly deployed file with its blob SHA; `## Residue` is updated. Test-bed facts go to
  `probes/testbeds.md` (`## Fixtures`; evidence continues at `T30`).
- Q3 A — PA03.4 and PA03.5 on `org-private`, once. Fixtures already in place: `probe-pa03-schedule.yml` (cron `7,22,37,52`)
  and `probe-pa03-schedule-env.yml` (cron `12,27,42,57`) on `master`, both `disabled_manually` (`probes/testbeds.md` T20;
  result file E6); Environment `probe-pa03-default-branch` with dummy secret `PROBE_PA03_ENV_MARKER`. Procedure facts:
  enable both files and record each enable time (UTC); per file, disable it as soon as its first completed `schedule` run is
  captured; the bound is 6 hours from that file's enable time (owner's clarification, 2026-09-25) — a file still uncaptured is
  disabled no later than enable time + 6 h; no second enable window. Record every completed scheduled run id of each file
  (runs created just before a disable included — the Phase 1 step 1.11 settle pattern), each enable and disable time, and the
  facts the PA03 README decision rules read (definition, ref, Environment admission, secret delivery by length or digest).
  Re-judge the org-private PA03.4 and PA03.5 rows with those decision rules over ALL their evidence (Phase 2 legs plus the
  re-probe): a captured run decides the cell; no run within the bound leaves it `undetermined` / `blocked`, now citing the
  re-probe evidence. Poll no more often than every 120 seconds during the long wait; rate-limit guard as above.
- Q4 A — PA04.1 on every test-bed with a PA04.1 cell: `org-public`, `org-private`, `personal` (the chosen option says
  "re-probe PA04.1"; its cells are these three). Wirings, each with the callee hosted in ANOTHER repository than the caller
  (the design's shape: wrappers in the target repository call reusable workflows hosted elsewhere, pinned by commit SHA) and
  the called job declaring `environment: probe-pa04-env` (the CALLER repository's Environment): W1 — the callee declares the
  secret under `on.workflow_call.secrets` and the caller passes an explicit `secrets:` mapping; W2 — the same callee, the
  caller passes `secrets: inherit`. Under each wiring re-check sibling isolation: a caller job without the Environment and a
  callee job without `environment` read an empty value. Identify every delivered value's source by length or SHA-256 digest,
  never by printing it: the caller's Environment dummy (`probe-pa04-marker-<key>`), any repository-level dummy the probe sets
  (a different value), the callee host's marker, or empty. A wiring the platform refuses (for example `secrets: inherit`
  across owners — packet Q4 option B calls this unverified) is recorded with the refusal verbatim as a finding, unless the
  error faults the probe's own request. Existing hosts of `probe-pa04-callee.yml`: `org-public`, `personal`
  (`probes/pa04-privilege-separation/README.md` "Fixtures"). New workflow files get new names `probe-pa04-<x>.yml`; an edited
  existing canonical workflow is redeployed to every test-bed on its deployment-list line. The PA04 README gains the re-probe
  procedure, its decision notes, and deployment-list lines.
- Q4 A recording: the PA04.1 Results rows keep Result `refuted` and Cause `none` — the Phase 2 observation (no secrets passed:
  a called job declaring the caller's Environment reads an empty secret) is not withdrawn; each row's Evidence cell appends
  the re-probe evidence ids; `## Deviations from the design` is unchanged. The per-wiring outcome is stated in the new
  evidence sections and summarized in packet 2's F1.
- `probes/findings.md` in Phase 4: edited in place; `gen-findings.sh` is never re-run (it resets every disposition). Copy the
  re-probed rows' Result, Cause, and Evidence into `## Cells`; recompute the PA03 roll-up Result by the roll-up rule; a cell
  re-judged `confirmed` gets disposition `none`, and PA03's roll-up gets `none` if it becomes `confirmed`; a re-probed cell
  that became `refuted` gets its `## Deviations` sub-section copied from the result file. `## Measured limits` changes only if
  a re-probe measured a listed quantity. No other row changes.
- Steady state at the end of Phase 4: "Steady state of the test-beds" holds again on all three test-beds (roadmap Phase 3 DoD
  2 queries); `bash probes/smoke/tools/steady-state.sh <owner/repo> apply` is the allow-listed way (it disables every
  `probe-*` workflow found live, new ones included, and deletes `probe-pa0N-head-*` branches); `probes/testbeds.md`
  `## Fixtures` matches live state, including any new Environment, secret, or branch.

### Follow-up decision packet format (`development-artifacts/patch-steward-m2-decision-packet-2.md`)

- Written at the end of Phase 4, after the Q3 and Q4 re-probe results are merged; route `judgment` (as for the first
  packet). Not format-checked (owner decision 9); acceptance is structural.
- Items: `F1` always — PA04.1 after the Q4 re-probe; `F2` only if the Q3 re-probe leaves PA03.4 or PA03.5 on `org-private`
  not `confirmed`; no other item. Each item has the fields of a packet question ("Decision packet format"): cells; design text
  quoted with document and section (copied from packet 1 Q4 / Q3); what the re-probe observed, per test-bed and wiring, with
  links into the result files; dependent milestones (F1: M06, M09; F2: M06); at least two options, each naming the sections
  it changes; one recommendation with its reason.
- F1 options: packet 1 Q4 option B and option C, each with its `changes:` list copied from packet 1 and extended only where
  the evidence requires; each option states what the re-probe showed for it — for B: which wiring delivered the caller's
  Environment secret to the called job on which test-bed, whether `secrets: inherit` crossed owners, and whether B's two
  "unverified" caveats are now resolved. If no tested wiring delivered the secret, the packet says B is unsupported by the
  evidence and still lists it. The owner may answer with free text.
- F2 options: packet 1 Q3 option B (accepted limitation) and option C (`owner-deferred: before M06`), with the re-probe's
  enable times, bound, and runs observed.
- Answers return through a planner amendment of this brief (table "Decisions", rows F1/F2, and "F1 and F2 content"). No
  design document changes for F1 or F2 before that amendment. Answered: amendment 6 (2026-09-25) recorded F1 = B; F2 was not
  raised.

### Steady state of the test-beds (end of Phase 3, end of Phase 4, and after any drift re-run)

- Every `probe-*` workflow on every test-bed is disabled (`gh workflow disable`; state `disabled_manually`). The drift procedure
  in `probes/README.md` enables what it runs and disables it again. This keeps later milestones' test-bed work (M06 onward) free
  of probe runs. The routine drift procedure never enables the PA08 cap workflow; running it again needs the owner's approval
  each time ("Copilot cap step").
- No open issue or PR whose title contains `probe`. Probe issues and PRs are closed, not deleted. `probe-pa0N-head-*` branches
  are deleted; `probe-pa0N-base*` branches, Environments, rulesets (scoped to `refs/heads/probe-*`), labels, and the fork stay
  and are listed in `probes/testbeds.md`.

### Owner actions and escalation

- The pipeline never: changes the App's registration, permissions, or installations; rotates or reads real secrets; changes
  organization or account settings, billing, plans, or Copilot policies; deletes repositories or issues; enables a paid feature.
  Each of these is an owner action.
- Try the REST or GraphQL API first for rulesets, Environments, deployment-branch policies, Environment secrets, merge queue, and
  the fork. A validation error that faults the request's own parameters is not a refusal (definition under "Test-bed record
  format"): fix the request; never turn it into an owner action. When the API refuses or cannot express a setting, do not guess
  a UI path: record the refusal verbatim and write an
  owner-action entry in `probes/testbeds.md` with the settings page URL, the exact values to set, and the command with expected
  output by which the pipeline will verify it afterwards. Batch owner actions: Phase 1 exists to surface all of them at once.
- An owner action that is pending blocks only the steps that need it. If the owner declines one, the affected cells are
  `undetermined` / `blocked` with the declined request as evidence.
- A refuted or undetermined result is never resolved by an agent: it goes into the decision packet.

### Acceptance-design rules for probe steps (for the decomposer)

- A probe's OUTCOME is unpredictable, so acceptance never asserts a particular result. Acceptance asserts recorded structure:
  the result file exists; has one row per assigned sub-claim; each `Result` and `Cause` value is in its closed set; every cited
  evidence id exists as a heading; the deployed blob SHAs match; the step's own issues and PRs are closed; `pnpm format:check`
  passes; the secret-pattern grep prints nothing.
- What `pnpm format:check` proves (owner decision 9): it reads the step's files under `probes/` — and in Phases 5 and 6 under `docs/`,
  `README.md`, `CLAUDE.md` — and nothing under `development-artifacts/`. It stays in every step's acceptance as the repository
  gate, but it is never evidence about the step's report, a step file, or the decision packet. No acceptance command runs
  Prettier on a path under `development-artifacts/`: Prettier skips the file and still exits 0 with
  `All matched files use Prettier code style!` — a vacuous pass. Conditions on a report or on the decision packet are
  structural (`test`, `grep` with an exact expected output).
- No step edits `.prettierignore` or lists it in `files_in_scope`; `git diff --stat <pin> -- .prettierignore` prints nothing
  in every step's worktree (`<pin>` = `49ef1bf7bc408da7d2676f859cf144a9b950d3c6`; project DoD 10).
- Setup that the milestone's Inputs require (App installation token mints on all three test-beds; the smoke workflow succeeds)
  is NOT a probe and must succeed.
- The cap step's acceptance never asserts that exhaustion or a session limit happened. It asserts recorded structure:
  `cap stop reason` is in its closed set; `cap sessions run` is at most 10 (`S`); `cap sends` is at most 405 (`40 × S + 5`);
  every cap session's run id is recorded; the cap step's first Copilot request timestamp is later than the last Copilot request
  timestamp that any other step recorded (in `probes/smoke/results/personal.md` and
  `probes/pa08-copilot-inference/results/*.md`).
- Acceptance commands are deterministic: checks on files in this repository, or `gh` queries with an exact expected output
  (a count, a state string, a SHA). Never accept on the text of a live log line that the platform may reword.
- Do not grep for a substring that the mandated file content itself contains; do not count diff hunks (M01 revisions).
- Idempotency: test-bed state lives outside git, so a failed or revised step re-runs against fixtures that already exist. Every
  step creates-or-reuses its fixtures (branches, Environments, rulesets, labels, issues, PRs) and records what it found; no step
  assumes a clean test-bed, and no step's acceptance depends on a fixture being absent beforehand.
- The decomposer may validate workflow syntax and API request shapes against the test-beds with fixtures named
  `probe-scratch-*`, which it removes; every piece of recorded evidence must come from a worker-executed step.
- Wide waves: the supervisor runs `pnpm install --frozen-lockfile` sequentially in each worktree before launch (M01 pattern).
  All workers share one `gh` token (5000 requests per hour) and the test-beds' secondary rate limits; the supervisor may narrow
  a wave.

### Worker report rules

- Reports are `development-artifacts/patch-steward-m2-<id>-report.md`, written before the step's single commit. A report never
  contains its own commit SHA.
- Reports are not format-checked (owner decision 9: `development-artifacts/` is in `.prettierignore`). No step runs Prettier on
  its report, and no acceptance contains a Prettier check of a report: `pnpm prettier --check <report>` skips the file and exits
  0, so it proves nothing. M01's rule that a report be Prettier-clean is dropped for this plan; an unformatted report is never
  a failure or a revision cause.
- Evidence rule (kept; it does not depend on Prettier): the report's `acceptance` field records each command followed by its
  verbatim output inside a fenced code block, so that the supervisor can tell where the output begins and ends and so that
  Markdown-active characters in the output (`*`, `_`, `|`, `#`) stay literal. Use the fence language `text` — the same habit as
  in the format-checked files under `probes/`, where `text` is mandatory ("Result file format"). In a report the fence language
  is a convention, not an acceptance condition.
- The secret-pattern check, run from the repo root, prints nothing:
  `grep -rnE "gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----" probes/ development-artifacts/patch-steward-m2-*-report.md 2>/dev/null`

### Documentation rules for Phases 5 and 6

- Precedence: `docs/architecture.md` governs components and boundaries, `docs/processes.md` governs steps and behavior,
  `docs/whitepaper.md` defers to both. Record each change in the governing document first, then whitepaper §9–§14, `README.md`,
  `CLAUDE.md` (including "Invariants any implementation must preserve"), then the user manual. After changing §15 items, the
  §6.4 job table, a §1.2 decision, or an SP step, whitepaper §9–§14 and the `CLAUDE.md` invariants change in the same phase.
- Cite stable identifiers (decisions 1–16, invariants 1–8, § references, SP01–SP20, and the new PA01–PA09 with
  `probes/findings.md`) instead of restating behavior. Keep architecture §14 traceability and each process's "Addresses" field
  consistent. Do not cite `PDxx`, `Mxx`, or the plan file in the design documents.
- Deferred features live only in `docs/deferred.md`: no mention, reserved setting, state, label, permission, or interface for
  them anywhere else, and no new link to `docs/deferred.md`.
- No document may describe unimplemented behavior as working. `CLAUDE.md` "Project state" and README "Status" stay scaffold-only;
  they gain only a statement that `probes/` holds the platform-assumption probe suite and findings for the disposable test-beds,
  is not product code, and never runs in CI. Architecture §6.1's layout tree gains a `probes/` line.
- Identifier family (owner decisions 6 and 7; unconditional): the string `PA01–PA09` (en dash, as in `SP01–SP20`) is recorded in
  three places — `docs/architecture.md` §6.1 (on or directly below the new `probes/` line of the layout tree: platform-assumption
  probes PA01–PA09 with sub-claims `PA0N.M`, results in `probes/findings.md`; not a workspace package; never runs in CI);
  `README.md` "Development" (a `probes/` entry in the file list); `CLAUDE.md` "Documentation conventions" (the stable-identifier
  sentence gains `PA01–PA09` with sub-claims `PA0N.M`, owned by `probes/findings.md`). Check:
  `grep -c "PA01–PA09" docs/architecture.md README.md CLAUDE.md` prints a count of at least 1 for each file.
- `.prettierignore` statements (owner decision 9; unconditional — independent of the post-probe owner decisions). Two documents
  state the ignore list and have been stale since `49ef1bf`; both are corrected to the five entries `pnpm-lock.yaml`, `dist/`,
  `coverage/`, `node_modules/`, `development-artifacts/`:
  - Document A — `CLAUDE.md` "Documentation conventions", the bullet that begins "`pnpm format:check` covers `docs/*.md`,
    `README.md`, and this file" (Phase 5 history; superseded for the current line by owner order 13, which inserts
    "`docs/adr/*.md`, " in Phase 7 — current text = `LF`, "Citation moves"). Stale parenthesis, quoted exactly: "(`.prettierignore` excludes only the lockfile, `dist/`,
    `coverage/`, `node_modules/`)". The corrected parenthesis names all five entries and says that the pipeline artifacts under
    `development-artifacts/` are not format-checked. The rest of the bullet is still true and is unchanged; the bullet stays
    one physical line (the check below is per line).
  - Document B — `docs/user-manual/configuration.md`, `## Scaffold configuration (Available)` → `### Package and automation`,
    table `File | Current settings`, row `.prettierignore`. Stale cell, quoted exactly: "Excludes `pnpm-lock.yaml`, `dist/`,
    `coverage/`, and `node_modules/`." The corrected cell lists all five entries. The `NEEDS INPUT` and `(Proposed)` counts of
    the file do not change.
  - Not edited: `docs/user-manual/troubleshooting.md` row "Formatting check fails" ("its ignore list excludes only the documented
    paths" names no entry and is true again once document B is corrected); the link "[Prettier exclusions](../../.prettierignore)"
    in `configuration.md`; `development-artifacts/patch-steward-m1-brief.md` (the four-entry list as of M01; never edited).
  - Re-grep when Phase 5 is decomposed, from the repo root:
    `grep -rnE "prettierignore|ignore list" CLAUDE.md README.md docs --include=*.md --exclude=astra-plan.md --exclude=project-development-plan.md`
    printed exactly the four lines named above at `49ef1bf`. A further statement of the entries found then is corrected the same
    way, by the step that owns that file.
  - Check 1: `grep -c "prettierignore.*development-artifacts/" CLAUDE.md docs/user-manual/configuration.md` prints a count of at
    least 1 for each file (both print `0` at `49ef1bf`).
  - Check 2 (no line that lists the entries lacks the fifth; every statement keeps `node_modules/` and `development-artifacts/`
    on one physical line):
    `grep -rnE "prettierignore|ignore list" CLAUDE.md README.md docs --include=*.md --exclude=astra-plan.md --exclude=project-development-plan.md | grep "node_modules/" | grep -vc "development-artifacts/"`
    prints `0` (it prints `2` at `49ef1bf`).
- Governing locations are exactly those "Post-probe owner decisions" lists per decision. A summary or user-manual page not
  listed there (whitepaper §9–§14, `README.md`, `CLAUDE.md` including its invariants, other user-manual rows) changes only
  where it would otherwise contradict the changed governing text; each step report lists every restatement it checked and
  what it changed. Phase 6 repeats this ripple check against the F1 text (F1 = B; F2 not raised), including the Phase 5 text
  of §6.4, §12, SP02, SP13, SP19 that F1 B could make false ("F1 and F2 content (Phase 6)", F1 ripple), and against the Q1E
  text, whose restatements to change are listed under "Q1E content (Phase 6)".
- Tables are Prettier-aligned: run `pnpm prettier --write` on each edited file; whole-table realignment is expected and in scope.

## Phase 7 — Architecture decision records (owner order, 2026-09-25)

Recorded by amendment 9; answers and the persistence rule recorded by amendment 10 (owner input of 2026-09-25, relayed by
the lead); the `CLAUDE.md` persistence bullet ordered by amendment 11 (owner answer of 2026-09-25, owner order 11); the
restatement of six unrestated §1.2 clauses in governing text ordered by amendment 12 (owner answer of 2026-09-25, owner
order 12; "Restatements of §1.2 clauses"); three post-completion fixes ordered by amendment 13 (owner answer "Fix, then
merge" of 2026-09-25, relayed by the lead after the milestone evaluation, owner order 13; D1, "Citation moves" `LF`, K80).
Facts below were read at `5faf6f4189e1d25af9d744ddcc501e99dcb946f1` (working-branch HEAD after Phase 6) and
re-verified at `9bcc195` (amendment 9; `docs/`, `README.md`, `CLAUDE.md`, `fixtures/`, `probes/` unchanged since
`5faf6f4`). Line numbers are leads only: locate text by quotation. `<P7>` = `5faf6f4189e1d25af9d744ddcc501e99dcb946f1`
(source commit for every literal extracted below); `<phase-7 base>` = working-branch HEAD at Phase 7 decomposition (the
decomposer records it); `<R7>` = `128249625790799e02a03284844495cc6557d0de` (the Phase 7 completion commit, "supervise(patch-steward-m2):
phase 7 complete"; base of the owner-order-13 fixes, K80). Phase 7 is decomposable (amendment 10 recorded every answer; no
open question remains).

### Owner order (as relayed by the lead, 2026-09-25; verbatim where quoted)

1. "Track all decisions made so far as persistent ADRs in `docs/adr`." One ADR per decision, MADR format (context,
   considered options, decision outcome, consequences), keeping the considered options and evidence links. Evidence links
   point only to persistent files (item 8) and `probes/` (item 9), never into `development-artifacts/`.
2. Scope: "Do not include decisions that affect only the implementation execution and not the design." The owner confirmed
   the classification in "ADR set" below. EXCLUDED (execution-only; never an ADR, never re-cited): PD01, PD02, PD03, PD06,
   PD07, PD08; M02 owner decisions 1–5 (test-bed repositories, test App, Copilot entitlement, probe execution approach, fork
   approval); owner decision 8 (the Copilot cap step and `S = 10`); owner decision 9 (the `.prettierignore` entry); OA1; Q3
   (a re-probe that changed no design) and its 6-hour bound; Q4 A (superseded by F1). A deferred feature is not an ADR.
   "If that is not clear ask me to clarify": any further borderline item → `RESULT: needs-human`; no agent decides it.
3. Precedence, "record only": ADRs record why a decision was made; `docs/architecture.md`, `docs/processes.md`, and the
   user manual still govern; on a conflict the governing document wins and the ADR is superseded. `docs/adr` joins the
   design-source file lists in `CLAUDE.md` and `README.md`; `CLAUDE.md` "Documentation conventions" states this rule.
4. "remove the decisions from architecture.md so that duplicates do not have to be maintained. Update citations referring
   to the moved decisions." The §1.2 decision table becomes a pointer to `docs/adr`; every citation of an architecture
   decision number outside `development-artifacts/` is rewritten to the ADR id ("Citation moves"). Amendment 10 overturns
   amendment 9's extension of this order to the plan: the owner's earlier instruction still holds, "ensure that decisions
   in the planning document are not removed". Plan §9 (intro and every row PD01–PD08, PD04 and PD05 included) and every
   `PDxx` citation in the plan stay unchanged; the plan's citations of architecture decision numbers are rewritten to ADR
   ids (a planning document may cite a persistent one). Governing and summary text that states the resulting design stays
   and may cite the ADR.
5. Probe READMEs citing payload directories under `development-artifacts/`: "Update the citations to point to those ADRs."
   Answered by P7-Q3 A (item 10). After Phase 7 no file outside `development-artifacts/` contains a path under
   `development-artifacts/` (K69, no exception).
6. The owner's order authorizes Phase 7 edits to `docs/project-development-plan.md` (the lead-owned plan) only to rewrite
   its architecture decision-number citations and its line-18 sentence ("Citation moves"); nothing else in the plan
   changes (item 4). The project ledger (`development-artifacts/patch-steward-project-ledger.md`) is never edited.
7. Local only: no test-bed write, no GitHub API write, no Copilot request. GitHub GET reads by the gate's re-verification
   scripts are allowed. Every spawned agent runs in the FOREGROUND.
8. Persistence rule (amendment 10; governs all Phase 7 text). Owner, verbatim: "Eventually all planning and implementation
   documents will be removed. Milestone briefs and ledgers are saved only until a project post mortem is performed. So,
   persistent documents such as design documents, user manuals, and ADRs should not cite the planning and implementation
   documents."
   - Persistent documents: `docs/architecture.md`, `docs/processes.md`, `docs/whitepaper.md`, `docs/deferred.md`,
     `docs/problem-statement.md`, `docs/user-manual/**`, `docs/adr/**`, `README.md`, `CLAUDE.md`, `fixtures/**`.
   - Planning and implementation documents: `docs/project-development-plan.md`, `docs/astra-plan.md`, everything under
     `development-artifacts/`, and their identifiers — milestone ids (`Mxx`), plan decisions (`PDxx`), "owner decision N",
     decision-packet ids (`Q1`–`Q9`, `Q1E`, `C1`, `F1`, `F2`, `OA*`), step and phase numbers.
   - Direction: a planning document may cite a persistent one (e.g. the plan citing ADR ids); never the reverse.
   - Consequences (overturning amendment 9's readings): ADRs cite no `Mxx` or `PDxx` id; packet ids and decision numbers
     appear nowhere in an ADR, its `- Source:` line included; `docs/adr/README.md` has no mapping line from them; an ADR's
     sources are only persistent files, `probes/` files, and commits reachable from `develop`; each ADR states its own
     options, rationale, and evidence; ADR-0017–ADR-0022 (PD04, PD05, the M01 decisions) carry the decision and its date,
     with no plan id and no citation of the plan or the project ledger.
   - Fixes in persistent documents found by the sweep (K74 pattern at `<P7>`): `docs/whitepaper.md:760` "(M01)";
     `fixtures/README.md:3` "(owner decision 4)" (→ "(ADR-0022)", P7-Q4 A); `fixtures/README.md:12` "(plan §0.3)". Literals
     in K75.
   - Known false positives that stay: the domain term "ledger" (request/response/run ledger in architecture, processes,
     deferred; not matched by K74); `CLAUDE.md` bullet "- `pnpm format:check` covers …" (line 63; its
     text becomes `LF` by owner order 13, still identified by that prefix) and
     `docs/user-manual/configuration.md` row "| `.prettierignore` …" (line 261): both describe a live ignore entry, not
     cite a document, and stay until the post-mortem removes the directory and the entry.
   - Intentional exception (owner order 11): the `CLAUDE.md` persistence bullet (the line equal to `LP`, "Citation moves")
     names `docs/project-development-plan.md`, `docs/astra-plan.md`, and `development-artifacts/` because the rule must
     identify them; it names no planning identifier. K74 and NOCITE′ exclude that one line exactly as the two false
     positives above are excluded.
   - Not citations (no document or identifier; K74 does not match them; they stay): the common noun "milestone" in
     `README.md` "templates/: files that later milestones will install …" and in `fixtures/README.md` line 12 "Corpus entries
     grow per milestone".
9. `probes/` exception (amendment 10). Owner, verbatim: "`probes/` is an exception for now. Use it for implementation now,
   but repurpose it as a persistent regression suite later in the final steps of the project implementation."
   - `probes/` keeps its planning references; Phase 7 does not scrub it and K74 does not read it.
   - Because it will persist, persistent documents and ADRs MAY cite `probes/` files as evidence (the C1 marker's
     `probes/findings.md` citation stays valid).
   - Phase 7 changes in `probes/` only: the P7-Q3 rewrites (pa01, pa03, pa05, pa08 READMEs) and the pa04 README line citing
     ADR-0033 (K68). `probes/pa08-copilot-inference/workflows/probe-pa08-cap.yml` keeps its comment "owner decision 8"
     unchanged.
   - The later repurposing is NOT M02 work and is in no phase; the lead records it in the project ledger.
10. Answers to P7-Q1–P7-Q5 (amendment 10; "Phase 7 owner answers").
11. Persistence rule in `CLAUDE.md` (amendment 11; owner answer of 2026-09-25, relayed by the lead: "add the persistence
    rule to `CLAUDE.md`" "Documentation conventions" in Phase 7, as one bullet). The bullet is exactly `LP` ("Citation
    moves"): it states the rule and its reason (planning and implementation documents are eventually removed; milestone
    briefs and ledgers are kept only until the project post-mortem), the two document sets of item 8 (persistent =
    everything under `docs/` except the two plan files, plus `README.md`, `CLAUDE.md`, `fixtures/` — equal to item 8's list,
    since `docs/` holds exactly `architecture.md`, `processes.md`, `whitepaper.md`, `deferred.md`, `problem-statement.md`,
    `user-manual/`, the two plan files, and after Phase 7 `adr/`; planning = the two plan files and `development-artifacts/`,
    with their identifiers), the direction (a planning document may cite a persistent one, never the reverse), and the
    `probes/` exception of item 9. It obeys the rule: it names the paths the rule identifies and no milestone,
    plan-decision, owner-decision, or packet id; it does not name `docs/deferred.md` (NODEFER, P11′) and contains no
    `deferred`, `DFnn`, `prettierignore`, "ignore list", or `node_modules/` (PI2). It is the only persistent-document
    statement of the rule; no other persistent document gains it.
12. Restatement before removal (amendment 12; owner answer of 2026-09-25, relayed by the lead after the decomposer's
    coverage audit found six §1.2 Choice clauses that no governing section restates): "restate each clause in the
    governing documents before §1.2 is removed". Each clause goes in the section that owns its topic: architecture first,
    then processes where a process step carries it (e.g. SP08 for security reports). The ADRs keep recording the reason;
    the governing text states the rule. Summaries (whitepaper §9–§14, `README.md`, `CLAUDE.md`) change only if they would
    otherwise contradict the new text (checked: none does; no summary changes for this item). The owner's other rules stay
    intact: persistent documents cite no planning documents or their ids (item 8); the `probes/` exception (item 9); plan
    §9 stays (item 4); the table-width and byte-identity pins of this brief (K35 X13s/X64t/XCL, W13, ANCHOR, LP). Exact
    texts, locations, and checks: "Restatements of §1.2 clauses", K71, K79.
13. Post-completion fixes (amendment 13; owner answer "Fix, then merge", 2026-09-25, relayed by the lead after the lead's
    milestone evaluation passed; three minor defects found by the supervisor's Phase 7 report and the lead's review).
    Owner-approved scope addition after Phase 7 completion; it strengthens gates and weakens none. The three fixes,
    verbatim from the lead's revision note:
    1. "Date disagreement. `docs/adr/` ADR-0002 and ADR-0004 carry `Date: 2026-09-17` (commit date of `0da65aa`).
       `docs/whitepaper.md` §14 says they were "revised on September 16, 2026", and `docs/deferred.md` says "ADR-0002,
       as revised September 16, 2026". Owner's fix: make ADR-0002 and ADR-0004 carry the documents' stated date,
       2026-09-16, and adjust each ADR's More Information derivation to match. Whitepaper and deferred.md stay as they
       are."
    2. "ADR-0025 link placement. In its context, the `[PA01 results]` and `[PA06 results]` links point to the
       org-private result files (which record the refusal), but they are attached to the sentence about confirmation on
       the public test-beds. Fix: the confirmation sentence links the public test-bed result files that record the
       confirmations; the org-private files are linked only where the refusal is stated."
    3. "`CLAUDE.md` "Documentation conventions" `pnpm format:check` bullet says Prettier covers `docs/*.md`, which omits
       `docs/adr/`. Fix: make the coverage statement true for `docs/adr/*.md`. Keep the `.prettierignore` five-entry
       list exactly as it is."
    - Applied: fix 1 → D1 ("ADR set") and the ADR set table Date cells of ADR-0002/ADR-0004; fix 2 → "ADR content rules"
      (ADR-0025 link placement bullet); fix 3 → "Citation moves" literal `LF`; all three → K80 ("Phase 7 content
      checks"), Constraints (Phase 7 list), project DoD 15.
    - Lead constraints: every check that pins these lines (K74's allowed false-positive lines, P13's statement counts,
      the ADR content checks K56–K79, `LP`) comes out exact after the fix. `docs/whitepaper.md` and `docs/deferred.md` do
      not change (K80 (a)); `.prettierignore` does not change (project DoD 10).
    - The owner's other rules stay intact: persistent documents cite no planning documents or their ids (item 8); the
      `probes/` exception (item 9; no `probes/` file changes for item 13); plan §9 unchanged (item 4); ADRs record-only
      (item 3); `CLAUDE.md` bullet `LP` unchanged (item 11); 39/39 clause coverage (item 12, K79).
    - Completed steps 7.1–7.4 are not re-run and their step files stay untouched; the fixes land as new Phase 7 steps
      (decomposer revise operation), followed by a Phase 7 gate re-run.

### Phase 7 owner answers (amendment 10, 2026-09-25; status `answered`)

- P7-Q1 (deferred alternatives in ADRs; decisions 2, 4, 5, 10 excluded DF07, DF02, DF05, DF03): **A** — an ADR may name a
  rejected alternative in ONE line with its DF id and a link to its `docs/deferred.md` entry, never restating its design.
  The `CLAUDE.md` deferred-features bullet names `docs/adr` as the one other place this may appear (literal in "Citation
  moves"). Applied: "ADR content rules" (Deferred features), K76, project DoD 11, P11′.
- P7-Q2 (considered options where no alternative was recorded): **A, revised by the persistence rule** — list the
  alternatives that some repository source names (any source the author may read, planning sources included), stated in
  the ADR itself and without citing a planning or implementation source; otherwise list the chosen option alone and write
  "No other option was recorded." Applied: "ADR content rules" (Considered options); supervisor judgment.
- P7-Q3 (target of the payload citations): **A** — rewrite each of the five payload install steps to use the canonical
  files already in `probes/<dir>/`, and cite ADR-0023; no path under `development-artifacts/` remains. Applied:
  "`development-artifacts/` citations", K69, K72.
- P7-Q4 (`fixtures/README.md:3`): **A** — "(owner decision 4)" → "(ADR-0022)"; the freeze on `fixtures/` narrows by exactly
  `fixtures/README.md` (the persistence rule also requires the line-12 fix in the same file). Applied: Constraints, K75,
  project DoD 10, P10′.
- P7-Q5 (surviving pipeline records): **A** — `development-artifacts/patch-steward-m2-brief.md` and `…-ledger.md` stay
  unchanged as M02's execution record until the post-mortem (edited only by planner amendments and supervisor records);
  every Phase 7 citation search excludes `development-artifacts/`; no persistent document cites them. Applied: K67, K69,
  K74.

### ADR set (fixed; owner-confirmed classification; numbering, file names, and Source lines are final)

Numbering rule (owner): ADR-0001–ADR-0016 = architecture §1.2 decisions 1–16 in the same order ("decision N" ↔
"ADR-00NN"); the remaining ADRs follow in chronological order of decision date; the planner fixed the order within a date:
2026-09-17 — plan decisions (the plan was decided before M01 started) then M01 decisions in project-ledger row order;
2026-09-18 — owner decision 6 then 7; 2026-09-25 — packet order Q1 (with Q1E), Q2, Q5, Q6, Q7, Q8, Q9, C1, then F1
(amendment 6, later that day). Q1E (amendment 7) extends Q1 and is part of ADR-0025. The "Read from" column names the
planning record the author reads; it is NEVER written into `docs/adr/`. The "Source line" column is the exact text after
`- Source: ` in the ADR (persistent locations only; plain text, never a link).

| ADR      | File under `docs/adr/`                                | Title                                                               | Date                         | Read from (planning record; never written into the ADR) | Source line (exact)                                                                                                     |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| ADR-0001 | `0001-browser-code-role.md`                           | Browser code role                                                   | last change per sources (D1) | architecture §1.2 decision 1                            | S-ARCH                                                                                                                  |
| ADR-0002 | `0002-browser-secrets.md`                             | Browser secrets                                                     | 2026-09-16 (owner order 13)  | architecture §1.2 decision 2                            | S-ARCH                                                                                                                  |
| ADR-0003 | `0003-submission-types.md`                            | Submission types                                                    | D1                           | architecture §1.2 decision 3                            | S-ARCH                                                                                                                  |
| ADR-0004 | `0004-security-reports.md`                            | Security reports                                                    | 2026-09-16 (owner order 13)  | architecture §1.2 decision 4                            | S-ARCH                                                                                                                  |
| ADR-0005 | `0005-deployment-and-triggers.md`                     | Deployment and triggers                                             | D1                           | architecture §1.2 decision 5                            | S-ARCH                                                                                                                  |
| ADR-0006 | `0006-sandbox-model.md`                               | Sandbox model                                                       | D1                           | architecture §1.2 decision 6                            | S-ARCH                                                                                                                  |
| ADR-0007 | `0007-local-cli-scope.md`                             | Local CLI scope                                                     | D1                           | architecture §1.2 decision 7                            | S-ARCH                                                                                                                  |
| ADR-0008 | `0008-llm-provider.md`                                | LLM provider                                                        | D1                           | architecture §1.2 decision 8                            | S-ARCH                                                                                                                  |
| ADR-0009 | `0009-evidence-store.md`                              | Evidence store                                                      | D1                           | architecture §1.2 decision 9                            | S-ARCH                                                                                                                  |
| ADR-0010 | `0010-automated-participation.md`                     | Automated participation                                             | D1                           | architecture §1.2 decision 10                           | S-ARCH                                                                                                                  |
| ADR-0011 | `0011-distribution.md`                                | Distribution                                                        | D1                           | architecture §1.2 decision 11                           | S-ARCH                                                                                                                  |
| ADR-0012 | `0012-repository-layout.md`                           | Repository layout                                                   | D1                           | architecture §1.2 decision 12                           | S-ARCH                                                                                                                  |
| ADR-0013 | `0013-orchestration.md`                               | Orchestration                                                       | D1                           | architecture §1.2 decision 13                           | S-ARCH                                                                                                                  |
| ADR-0014 | `0014-llm-authentication.md`                          | LLM authentication                                                  | D1                           | architecture §1.2 decision 14                           | S-ARCH                                                                                                                  |
| ADR-0015 | `0015-preflight-inference.md`                         | Preflight inference                                                 | D1                           | architecture §1.2 decision 15                           | S-ARCH                                                                                                                  |
| ADR-0016 | `0016-inference-admission.md`                         | Inference admission                                                 | D1                           | architecture §1.2 decision 16                           | S-ARCH                                                                                                                  |
| ADR-0017 | `0017-first-ecosystems-for-result-parsing.md`         | First ecosystems for result parsing and anti-gaming fixtures        | 2026-09-17                   | project development plan §9, PD04                       | none outside this record                                                                                                |
| ADR-0018 | `0018-self-screening-of-this-repository.md`           | Self-screening of this repository                                   | 2026-09-17                   | project development plan §9, PD05                       | none outside this record                                                                                                |
| ADR-0019 | `0019-lockstep-versioning-and-cd-manifest.md`         | One lockstep version with root package.json as the CD manifest      | 2026-09-17                   | M01 owner decision "Versioning and CD manifest" (project ledger) | `docs/architecture.md` §6.1                                                                                    |
| ADR-0020 | `0020-node-24-only.md`                                | Node.js 24 only                                                     | 2026-09-17                   | M01 owner decision "Supported Node.js" (project ledger) | `docs/architecture.md` §6.1                                                                                             |
| ADR-0021 | `0021-test-tiers-and-ci-placement.md`                 | Test tiers and their CI placement                                   | 2026-09-17                   | M01 owner decision "Test tiers in CI" (project ledger)  | `docs/architecture.md` §6.1                                                                                             |
| ADR-0022 | `0022-shared-fixture-corpus-home.md`                  | Shared fixture corpus in root fixtures/                             | 2026-09-17                   | M01 owner decision "Home of the shared fixture corpus"  | `docs/architecture.md` §6.1; `fixtures/README.md`                                                                       |
| ADR-0023 | `0023-probe-suite-location.md`                        | Platform-assumption probe suite in root probes/                     | 2026-09-18                   | M02 owner decision 6                                    | `docs/architecture.md` §6.1; `probes/README.md`                                                                         |
| ADR-0024 | `0024-platform-assumption-identifiers.md`             | PA01–PA09 platform-assumption identifiers                           | 2026-09-18                   | M02 owner decision 7                                    | `docs/architecture.md` §6.1; `probes/findings.md`                                                                       |
| ADR-0025 | `0025-ruleset-dependent-controls-limitation.md`       | Ruleset-dependent controls where rulesets are not offered           | 2026-09-25                   | M02 post-probe owner decision Q1, extended by Q1E       | `docs/architecture.md` §7, §10, §11; `docs/processes.md` SP02; `probes/testbeds.md`; `probes/findings.md` PA01, PA06    |
| ADR-0026 | `0026-ownership-artifact-ordering.md`                 | Ownership artifact ordering by created_at                           | 2026-09-25                   | M02 post-probe owner decision Q2                        | `docs/architecture.md` §6.4, §7; `docs/processes.md` SP19; `probes/findings.md` PA02                                    |
| ADR-0027 | `0027-wrapper-permission-ceiling.md`                  | Wrapper permissions equal the pinned reusable workflow's            | 2026-09-25                   | M02 post-probe owner decision Q5                        | `docs/architecture.md` §6.4, §12; `docs/processes.md` SP02, SP19; `probes/findings.md` PA04                             |
| ADR-0028 | `0028-publish-after-cancellation.md`                  | Publication after cancellation                                      | 2026-09-25                   | M02 post-probe owner decision Q6                        | `docs/architecture.md` §6.4, §12; `docs/processes.md` SP13, SP19; `probes/findings.md` PA04                             |
| ADR-0029 | `0029-copilot-organization-policy-limitation.md`      | Copilot organization policy on organization-owned repositories      | 2026-09-25                   | M02 post-probe owner decision Q7                        | `docs/architecture.md` §6.3, §15; `docs/processes.md` SP02, SP19; `probes/findings.md` PA08                             |
| ADR-0030 | `0030-per-submission-concurrency-after-commitment.md` | Per-submission concurrency only after commitment                    | 2026-09-25                   | M02 post-probe owner decision Q8                        | `docs/architecture.md` §6.4, §12; `docs/processes.md` SP19; `probes/findings.md` PA05                                   |
| ADR-0031 | `0031-merge-queue-relay-membership.md`                | Merge-queue relay membership and echo filtering                     | 2026-09-25                   | M02 post-probe owner decision Q9                        | `docs/architecture.md` §6.4; `docs/processes.md` SP12; `probes/findings.md` PA06                                        |
| ADR-0032 | `0032-organization-billing-unverified-marker.md`      | Unverified marker for the organization billing path                 | 2026-09-25                   | M02 post-probe owner decision C1                        | `docs/architecture.md` §6.3, §12; `probes/findings.md` PA08                                                             |
| ADR-0033 | `0033-explicit-secrets-mapping.md`                    | Explicit per-name secrets mapping into the pinned reusable workflow | 2026-09-25                   | M02 post-probe owner decision F1 (packet 2 option B)    | `docs/architecture.md` §6.4, §7; `docs/processes.md` SP02; `probes/findings.md` PA04                                    |

- S-ARCH (ADR-0001–ADR-0016): the metadata line is exactly the line below, with `<Title>` replaced by the ADR's title
  (equal to the §1.2 "Decision" cell of that row):

```text
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "<Title>", commit `0da65aa`
```

  Verified: `0da65aa` is an ancestor of `develop` (`8857233`), and no commit after it changed a §1.2 row
  (`git diff 0da65aa 9bcc195 -- docs/architecture.md` touches no line starting `| <digit>`).
- D1 (dates of ADR-0001–ADR-0016): MADR's date is the date of the last change. Architecture Status line: "the
  architecture selected on September 15, 2026, with the LLM provider decisions revised on September 16, 2026". History
  reachable from `develop`: first architecture commit `f79de29` (2026-09-16); commit `0da65aa` (2026-09-17) changed
  decisions 2 and 4 (decision 2 lost "version 1 removes browser inference"; decision 4 changed from a deferral with a
  reserved setting to "Not a submission type. …"); no later commit changed §1.2 before Phase 7. The ADR author sets each
  date from these sources (value `2026-09-15`, `2026-09-16`, or `2026-09-17`) and records the history under
  `## More Information` by commit and date. ADR-0002 and ADR-0004 state their earlier alternative ONLY as the one P7-Q1
  line (DF07 for ADR-0002, DF02 for ADR-0004): the earlier text is never quoted, and the reserved setting is never named.
  Owner ruling (owner order 13, fix 1; overrides the last-change rule for these two ADRs): ADR-0002 and ADR-0004 carry
  `- Date: 2026-09-16`, the revision date the design documents state (`docs/whitepaper.md` §14 "revised on September 16,
  2026"; `docs/deferred.md` "ADR-0002, as revised September 16, 2026"), although commit `0da65aa`, which committed their
  present text, is dated 2026-09-17. Each of the two ADRs' `## More Information` states that derivation truthfully: it
  cites whitepaper §14 as the link `[Whitepaper §14](../whitepaper.md)` (never `docs/deferred.md`: K76 allows only the
  one DF line per ADR) and records both commits by commit and date, "commit `f79de29` (2026-09-16)" and "commit
  `0da65aa` (2026-09-17)". The `docs/adr/README.md` rows of ADR-0002 and ADR-0004 carry the same date (K65 index).
  `docs/whitepaper.md` and `docs/deferred.md` are unchanged. Every other ADR date stays as Phase 7 set it (ledger Phase 7
  notes). Check: K80 (a).
- Titles are fixed as listed; the file name and heading follow them exactly.

### ADR format (fixed template; every ADR file)

```text
# ADR-NNNN: <Title from the ADR set table>

- Status: accepted
- Date: YYYY-MM-DD
- Deciders: project owner
- Source: <Source line from the ADR set table, exact>

## Context and Problem Statement

## Considered Options

## Decision Outcome

Chosen option: "<option title>", because <reason as recorded in a source>.

### Consequences

## More Information
```

- Heading order is exactly as above. Optional sections, only at these positions: `## Decision Drivers` between
  `## Context and Problem Statement` and `## Considered Options`; `## Pros and Cons of the Options` between the end of
  `## Decision Outcome` (after `### Consequences`) and `## More Information`. No other `#`/`##`/`###` heading. No YAML front
  matter.
- `## Considered Options`: one bullet per option, `- <option title>` optionally followed by ` — <one-line description>`;
  the option title is the text before ` — ` (or the whole bullet text) and is descriptive (never a packet letter such as
  "A" or "B"). `Chosen option: "<title>"` quotes one of those titles exactly. If no source records a reason, the line
  ends after the closing quote with `.` (no `because` clause) and `## More Information` states that no rationale was
  recorded. If no other option was recorded (P7-Q2 A), the section has the chosen option's bullet and the sentence
  "No other option was recorded."
- Status values: `accepted`, or `superseded by <governing location or ADR-NNNN>` (the record-only rule). Every Phase 7
  ADR is `accepted`.
- Format-checked: Prettier-clean (`pnpm format:check`); any verbatim block is fenced with the language `text`.

### ADR content rules

- Sources the author may READ: `docs/*.md` and `docs/user-manual/*.md` at `<P7>` (NEVER `docs/astra-plan.md`); history
  reachable from `develop` (for example `bac2485`, `d0ed9df`, `f79de29`, `0da65aa`, `d2ff39f`); this brief ("Owner
  decisions" 6 and 7, "Post-probe owner decisions" incl. "F1 and F2 content (Phase 6)" and "Q1E content (Phase 6)");
  `development-artifacts/patch-steward-m2-decision-packet.md` and `…-decision-packet-2.md` (option texts, observations,
  `changes:` lists); the project ledger and `development-artifacts/patch-steward-m1-brief.md` / `…-m1-ledger.md`
  (read-only); `probes/**`; branch-only commits of `milestone/2-platform-assumption-probes` (read only — they vanish in the
  squash merge). Reading a planning source is allowed; citing it is not (owner order 8).
- What an ADR may LINK or CITE: only persistent documents (owner order 8 list) and `probes/` files, as relative Markdown
  links from `docs/adr/` to files that exist in the tree at the Phase 7 gate (for example `../architecture.md`,
  `../processes.md`, `../deferred.md#<DF anchor>` per P7-Q1 A, `../../probes/findings.md`,
  `../../probes/pa04-privilege-separation/results/org-public.md`, `../../probes/testbeds.md`); commits only as
  "commit `<7–40 hex>`" and only if `git merge-base --is-ancestor <sha> develop` exits 0 (never a working-branch commit).
  Never `docs/project-development-plan.md`, `docs/astra-plan.md`, or anything under `development-artifacts/`, by link,
  path, or name ("the plan", "the project ledger", "the decision packet", "the brief" included).
- Each ADR is self-contained: it restates what it needs from a planning source (option texts, observations, reasons,
  evidence) in its own words or verbatim, without naming the source. A statement no persistent file, `probes/` file, or
  `develop` commit supports is still recorded if a planning source records it; it is simply not attributed.
- Identifiers an ADR MAY contain: ADR ids; PA ids (`PA01`–`PA09`, `PA0N.M`); SP ids; P/N/O ids; invariant numbers;
  § references of persistent documents; DF ids (only in the P7-Q1 line); commit SHAs reachable from `develop`. An ADR
  NEVER contains: a planning identifier (K74 pattern: `Mxx`, `PDxx` in any letter case, "owner decision N", `Q1`–`Q9`,
  `Q1E`, `C1`, `F1`, `F2`, `OA*`, step or phase numbers, amendment numbers, planning file names); an architecture decision
  number (`decision N`, `decisions N`); a packet option letter as an option title. Where a recorded text contains such
  an identifier, the ADR states its content without it (for PD04/PD05 the exact replacement is fixed in K60). "§1.2"
  appears in an ADR only in its `- Source:` line (ADR-0001–ADR-0016; K67).
- Decision outcome content (checked by K59–K63): ADR-0001–ADR-0016 contain the §1.2 "Choice" cell of decision N at `<P7>`
  verbatim (compared after joining lines and squeezing spaces), inside `## Decision Outcome`; ADR-0017/ADR-0018 the
  literals L17/L18 under "Phase 7 content checks" (the plan §9 Decision cell of PD04/PD05 at `<P7>` with its milestone id
  replaced by that milestone's content: "chosen in M08" → "chosen when the deterministic verification stages are built"
  (plan M08 "Deterministic verification stages"); "from M13" → ", starting when the GitHub-hosted full pipeline runs in
  observe mode," (plan M13 "GitHub-hosted full pipeline in observe mode")); ADR-0019–ADR-0022 the project-ledger "Value"
  cell of their M01 row (literals under "Phase 7 content checks"); ADR-0023–ADR-0033 the owner's answer as this brief
  records it, with the chosen option's text, restated without planning identifiers.
- Considered options (P7-Q2 A, revised): list the alternatives that some repository source names — the planning sources
  of the "Read from" column included — stated in the ADR itself and without citing the source; otherwise the chosen option
  alone and "No other option was recorded." For ADR-0025–ADR-0033 the packet options of that question are the recorded
  options (ADR-0025: packet 1 Q1 options, plus the extension the owner chose later: "Extend the Q1 accepted limitation",
  stated by content; ADR-0033: packet 2 F1 options B and C — packet 1 Q4 option A, the re-probe, is not an option of this
  ADR); ADR-0017: the chosen pair and "TypeScript and Python" (L17's "Not chosen" clause); ADR-0023/ADR-0024 the options
  of the planner's plan-review questions that the owner answered on 2026-09-18 (brief history; amendment 1 row in the
  ledger Revisions). For ADR-0001–ADR-0016 the only recorded alternatives are the earlier versions of decisions 2 and 4
  (deferred features; P7-Q1 line) and the rejected alternatives the Choice cells themselves name (for example "No webhook
  server."). No option is reconstructed or invented.
- Deferred features (P7-Q1 A): an ADR may name a rejected alternative that is a deferred feature in ONE line containing its
  DF id and a link `../deferred.md#<anchor>` to its `## DFnn. …` heading (GitHub anchor: lowercase, characters other than
  `[a-z0-9 -]` removed, spaces → `-`; e.g. `## DF07. Browser inference` → `#df07-browser-inference`), never restating its
  design (no reserved setting, state, label, permission, interface, or behavior of the deferred feature). The line may be
  a `## Considered Options` bullet or a sentence in `## Context and Problem Statement` or `## More Information`. One such
  line per DF id per ADR. Expected (from `docs/deferred.md` "Deferred" rows): ADR-0002 → DF07; ADR-0004 → DF02;
  ADR-0005 → DF05; ADR-0010 → DF03; another ADR only if `docs/deferred.md` names that decision as the reason a DF was
  excluded. No other text in `docs/adr/` contains "deferred" or a DF id (K76).
- Consequences: bullets; each names the governing text that states the resulting design (persistent document and §/SP
  step, linked), and any recorded follow-up that a persistent document states. ADR-0025–ADR-0033: the governing locations
  the brief lists for that decision ("Governing locations and must-state content (Phase 5)", "F1 and F2 content (Phase
  6)", "Q1E content (Phase 6)"). ADR-0004, ADR-0005, ADR-0013, ADR-0014, ADR-0016: their Consequences also name the
  restatement locations of "Restatements of §1.2 clauses" for their clauses (ADR-0004: architecture §1.1 "Submission
  types" and processes SP08; ADR-0005: architecture §1.1 "Hosting" and §7 "GitHub App"; ADR-0013: architecture §6.4 and
  processes SP19; ADR-0014: architecture §8 "Inference" and processes SP02; ADR-0016: architecture §12 "Spending" and
  processes SP19); no other ADR changes for amendment 12. Plan-level consequences (e.g. which milestone exercises what) are
  never written.
- Evidence bounds: an ADR states no more than its sources. ADR-0033 obeys "F1 evidence bounds"; ADR-0025 obeys the Q1
  must-state items and "Q1E evidence bounds"; ADR-0029 and ADR-0032 contain the C1 `S` sentence byte-exact wherever they
  describe the organization billing path (exit criterion 3: "documented as unverified wherever it is described"); ADR-0032
  also contains the `T` form as the decided wording. GitHub Models may appear only as history (retired July 30, 2026),
  never as an available option.
- Evidence-link placement (owner order 13, fix 2): a link to a result file sits on the sentence whose claim that file
  records. ADR-0025 `## Context and Problem Statement`: the org-private result files
  (`../../probes/pa01-required-checks/results/org-private.md`, `../../probes/pa06-merge-queue-relay/results/org-private.md`)
  are linked only where the HTTP 403 refusal is stated (the text after "were each refused with HTTP 403" up to "No
  required-check (PA01)"), and nowhere else in the file (exactly 2 occurrences of `results/org-private.md`); the
  sentence "The same sub-claims were confirmed on the public test-beds: …" links the public result files that record
  the confirmations — `../../probes/pa01-required-checks/results/org-public.md`,
  `../../probes/pa01-required-checks/results/personal.md`, `../../probes/pa06-merge-queue-relay/results/org-public.md` —
  and no org-private file. Link texts are the author's; no other ADR text changes for fix 2. Check: K80 (b).
- No ADR decides anything: it records decided outcomes; a gap or contradiction found while writing one goes to the planner
  as an amendment note.

### `docs/adr/README.md` (index; format-checked)

- Title `# Architecture Decision Records`. States: the MADR format and heading list above; the record-only rule (owner
  order 3, in the owner's terms: ADRs record why; `docs/architecture.md`, `docs/processes.md`, and the user manual govern;
  on a conflict the governing document wins and the ADR is marked `superseded by <location>`); numbering without any
  decision number: ADR-0001–ADR-0016 record the decisions selected with the architecture, in the order the architecture
  listed them; later ADRs follow in chronological order of decision date. No mapping line (owner order 8); no mention of
  a planning document, a deferred feature, or a DF id.
- Table `| ADR | Title | Status | Date |`: 33 rows in id order, each id linked to its file.

### Citation moves (inventory at `<P7>`, unchanged at `9bcc195`; re-grep at decomposition)

Sweep command (K67): `git grep -nE '[Dd]ecisions? [0-9]+|§ ?1\.2|\bPD0[45]\b' -- . ':!development-artifacts' ':!docs/adr'`.
At `<P7>` it prints 37 lines:

- REWRITE (26): `CLAUDE.md` 52, 61, 64; `docs/architecture.md` 513 ("(decision 15)"); `docs/deferred.md` 63, 216, 255, 280,
  365, 418, 425, 432; `docs/processes.md` 8; `docs/project-development-plan.md` 8, 18, 176, 476, 494, 651, 712, 987, 1000,
  1149, 1228; `docs/whitepaper.md` 766; `fixtures/README.md` 3 (P7-Q4 A).
- STAY (11): `docs/project-development-plan.md` 88, 153, 552, 607, 626, 905, 1441, 1446, 1461, 1462 (`PD04`/`PD05`: plan
  decisions are not removed and PDxx citations in the plan stay — owner order 4; K77);
  `probes/pa08-copilot-inference/workflows/probe-pa08-cap.yml` 1 ("owner decision 8" — EXCLUDED decision; `probes/`
  exception; the workflow is deployed and blob-pinned, never edited).
- `docs/astra-plan.md` has no match (`git grep` count 0; it is never read or edited). Not matched by the sweep but in
  scope: `probes/pa04-privilege-separation/README.md` line 138 "The owner's follow-up decision F1 reads these lines" (F1 →
  ADR-0033); `docs/whitepaper.md` 760 "(M01)" and `fixtures/README.md` 12 "(plan §0.3)" (persistence rule, K74/K75). §1.2
  itself (lines 29–48: heading and a 16-row table) is replaced, not rewritten.

Rewrite rules (every rewrite keeps the surrounding text; ids are zero-padded to 4 digits):

| Old form (examples at `<P7>`)                                                   | New form                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| "decision 15", "decision 11", "decision 4", "decision 16"                       | "ADR-0015", "ADR-0011", "ADR-0004", "ADR-0016"                            |
| "decisions 11 and 12", "decisions 1 and 2", "decisions 2 and 15"                | "ADR-0011 and ADR-0012", "ADR-0001 and ADR-0002", "ADR-0002 and ADR-0015" |
| "decisions 5, 9, 13", "decisions 8, 14, 15"                                     | "ADR-0005, ADR-0009, ADR-0013", "ADR-0008, ADR-0014, ADR-0015"            |
| "decisions 1–16" (plan line 8; CLAUDE.md line 61)                               | "ADR-0001–ADR-0016" (plan); CLAUDE.md: see below                          |
| "Architecture decision N" (deferred.md "Deferred" cells)                        | "ADR-00NN" (dates and reasons in the cell unchanged)                      |
| "Architecture §1.2, decision N" (deferred.md "Restoring" Location cells)        | "ADR-00NN, Decision Outcome"                                              |
| "(architecture §1.2)" (deferred.md 63, whitepaper 766), "(§1.2)" (processes 8) | "(ADR-0001–ADR-0016)" or "(ADR-0001–ADR-0016 in `docs/adr`)"              |
| plan line 18: "\"decision\" with a bare number always means architecture §1.2." | "architecture decisions are cited by ADR id (ADR-0001–ADR-0016 in `docs/adr`)." (the preceding "PD01–PD08;" unchanged) |
| whitepaper 759–760: "The monorepo layout in §9 is implemented (M01); the packages contain only toolchain smoke code." | "The monorepo layout in §9 is implemented; the packages contain only toolchain smoke code." (K75) |
| fixtures/README.md 3: "(owner decision 4)"                                      | "(ADR-0022)" (K75)                                                        |
| fixtures/README.md 12: "Corpus entries grow per milestone (plan §0.3)."         | "Corpus entries grow per milestone." (K75)                                |

- Plan: the only plan edits are the REWRITE lines above (decision-number citations and the line-18 sentence). §9 (from
  `## 9. Plan decisions` to the end of the file) stays byte-for-byte, and every line containing a `PDxx` id keeps it
  (K77). Stale plan text S1–S15 of the Phase 6 gate report stays the lead's.
- `docs/architecture.md` §1.2: the heading `### 1.2 Decisions recorded` stays byte-for-byte (anchor); the table is replaced
  by a pointer paragraph: decisions and their rationale are recorded as ADRs in `docs/adr` (link `adr/README.md`),
  ADR-0001–ADR-0016 being the architecture's decisions; ADRs are record only and this document governs on a conflict. The
  pointer cites no decision number and contains no table and no occurrence of "deferred". `## 1. Scope and decisions`
  and §1.3 unchanged; §1.1 changes only by RS1 and RS2 ("Restatements of §1.2 clauses"), in the same step as the removal.
- `CLAUDE.md`: "Design source of truth" — the architecture bullet drops "selected decisions (§1.2), "; a new bullet names
  `docs/adr/` (architecture decision records ADR-NNNN in MADR format: why each design decision was made; record only).
  "Documentation conventions" — the stable-identifier bullet replaces "decisions 1–16, " with ADR ids (e.g. "invariants 1–8
  and § references (architecture); ADR-NNNN (`docs/adr`)") and keeps `PA01–PA09` with sub-claims `PA0N.M` (K26); the rule
  "After changing architecture §1.2 decisions, …" is triggered instead by adding or superseding an ADR (rest of the rule
  unchanged); the record-only precedence rule (owner order 3) is stated, with the word `superseded`. The deferred-features
  bullet (starts "- Deferred features live only in") is edited in place (P7-Q1 A): its sentence ending "and no links to
  `docs/deferred.md` outside the file lists here and in the README." becomes, exactly:
  "and no links to `docs/deferred.md` outside the file lists here and in the README, except that an ADR in `docs/adr` may name a rejected alternative in one line by its DF id, with a link to its entry, never restating its design."
  (no new occurrence of `deferred` or `DFnn`; K76, k6 NODEFER). "Documentation conventions" also gains the persistence
  bullet (owner order 11) as its LAST bullet (the last non-blank line before `## Invariants any implementation must
  preserve`), exactly the line `LP` below, one line, unwrapped (Prettier-clean as is — verified with
  `pnpm exec prettier --config .prettierrc.json --check <copy>` on a copy of `CLAUDE.md` at `3823259` with the line
  appended after the "After changing …" bullet). "Intended architecture" paragraph and "Invariants" unchanged (K35 XCL). No new text names a
  planning document or identifier (K74), except that `LP` names the three planning paths (owner order 11; K74, NOCITE′).
  Owner order 13 (fix 3; amendment 13, after Phase 7 completion): the "Documentation conventions" bullet starting
  "- `pnpm format:check` covers" becomes exactly the line `LF` below, one line, unwrapped, edited in place (position
  unchanged; `LP` stays the section's last bullet). `LF` differs from the line at `<R7>` only by the inserted
  "`docs/adr/*.md`, " after "`docs/*.md`, "; its `.prettierignore` five-entry list is unchanged. No other `CLAUDE.md`
  line changes for owner order 13.

`LF` (the corrected format-check bullet; the literal runs from after `LF: ` to the end of its line; it is the only line of
this brief starting `LF: `; K74, K80 (c), project DoD 13):

```text
LF: - `pnpm format:check` covers `docs/*.md`, `docs/adr/*.md`, `README.md`, and this file (`.prettierignore` excludes only `pnpm-lock.yaml`, `dist/`, `coverage/`, `node_modules/`, and `development-artifacts/`, so the pipeline artifacts under `development-artifacts/` are not format-checked). Tables are Prettier-aligned; run `pnpm format` after editing them. ESLint ignores `docs/`.
```

Verified for `LF` (decomposer dry-run at `<R7>`, amendment 13): `PAT` matches it only through `development-artifacts`
(K74 still prints exactly 3 lines, this one identified by its unchanged prefix "- `pnpm format:check` covers"); PI1
count 1; PI2 count 0; project-dod P13 counts unchanged (at least 1 per file; 0); NOCITE and NODEFER counts unchanged;
K67 sweep 0; Prettier-clean as one unwrapped line; ASCII only.

`LP` (the persistence bullet; the literal runs from after `LP: ` to the end of its line; K74, K78, NOCITE′):

```text
LP: - Persistence: planning and implementation documents are eventually removed (milestone briefs and ledgers are kept only until the project post-mortem), so persistent documents never cite them or their identifiers (milestone, plan-decision, owner-decision, and decision-packet ids; step and phase numbers). Persistent documents are everything under `docs/` except `docs/project-development-plan.md` and `docs/astra-plan.md`, plus `README.md`, this file, and `fixtures/`; planning and implementation documents are those two files and everything under `development-artifacts/`. A planning document may cite a persistent one, never the reverse. Exception: `probes/` may hold planning references while implementation uses it, persistent documents may cite its files, and it becomes a persistent regression suite later.
```

Verified for `LP` (planner, amendment 11): `PAT` matches exactly `project-development-plan`, `astra-plan`,
`development-artifacts` and nothing after removing those three strings; NOCITE pattern count 1 (the plan path); NODEFER
count 0; `prettierignore|ignore list|node_modules` 0; K67 sweep pattern 0; `deferred\.md` 0; ASCII only.

- `README.md` "Development" list: one new entry `docs/adr/` (architecture decision records ADR-NNNN: why each design
  decision was made; the design documents govern). Status, Goal, other entries unchanged.
- `docs/processes.md` line 8: citation rewrite (plus RS7–RS10, "Restatements of §1.2 clauses"); `docs/whitepaper.md` §14
  (lines 765–766): citation rewrite only; whitepaper line 760: "(M01)" removal only.
- Beyond the rewrites, the §1.2 pointer, the file lists, the precedence rule, the deferred-features bullet, and the
  persistence bullet `LP` (which cites no ADR), Phase 7 adds no ADR citation to any governing or summary document (owner order 4 permits it; Phase 7 keeps the change minimal). RS1–RS10 cite no ADR.
- Governing and summary documents keep citing no `PDxx`, `Mxx`, `Q1E`, or the plan file (k6 NOCITE; K74 is stricter);
  sole exception: the `CLAUDE.md` line `LP` names the plan file's path (owner order 11), so k6 NOCITE on `CLAUDE.md`
  FAILs by design and NOCITE′ replaces it ("Milestone re-verification after Phase 7"). Phase 7 text adds no occurrence of `deferred`/`DFnn` to `docs/architecture.md`, `docs/processes.md`,
  `docs/whitepaper.md`, the user manual, `README.md`, or `CLAUDE.md` (k6 NODEFER).

### `development-artifacts/` citations (owner order 5; P7-Q3 A)

- At `<P7>`: `git grep -nE 'development-artifacts/[A-Za-z0-9_.-]' -- . ':!development-artifacts'` prints exactly the five
  payload lines (pa01 README 39, pa03 README 72, pa05 README 35, pa08 README 43 and 63). Every other mention is the
  directory itself (`.prettierignore` line 5; `CLAUDE.md` line 63; `docs/user-manual/configuration.md` line 261).
- Rewrite (P7-Q3 A): in each of the five steps, the command that copies a payload into `probes/<dir>/` (`mkdir -p … && cp
  -r <W>/development-artifacts/…-payload/. <W>/probes/<dir>/` at pa01 39, pa03 72, pa05 35, pa08 43; `cp
  <W>/development-artifacts/patch-steward-m2-2.26-payload/workflows/probe-pa08-infer.yml …` at pa08 63) is removed; the
  step instead states that it uses the canonical files already in `probes/<dir>/` (ADR-0023). Each of the four READMEs
  (pa01, pa03, pa05, pa08) cites ADR-0023 at least once OUTSIDE any code fence as the relative link
  `[ADR-0023](../../docs/adr/0023-probe-suite-location.md)`. Every other command of those steps (`actionlint …`,
  `deploy.sh …`) stays byte-for-byte, in its original fence or inline code; step numbering may stay (a step whose only
  remaining command is `actionlint` is kept as a lint step). The planning references of the surrounding text (step
  numbers such as "step 2.26") stay (owner order 9).
- Each edited probe README keeps its headings `## Sub-claims`, `## Fixtures`, `## Deployment list`, `## Procedure` and
  its `## Deployment list` lines byte-for-byte (phase-2 `check-readme.sh`); every verbatim command stays in its
  ```` ```text ```` fence. No file under `probes/*/workflows/`, `probes/*/results/`, `probes/*/fixtures/`,
  `probes/findings.md`, `probes/testbeds.md`, or `probes/README.md` changes.
- `probes/pa04-privilege-separation/README.md` line 138: "The owner's follow-up decision F1 reads these lines; nothing in
  this README decides it." → the owner's decision on the wiring is recorded in ADR-0033 (relative link
  `../../docs/adr/0033-explicit-secrets-mapping.md`); nothing in this README decides it.

### Restatements of §1.2 clauses (owner order 12, amendment 12; texts read at `e60adde`, proposed and dry-run by the decomposer)

Coverage audit at `e60adde` (`development-artifacts/patch-steward-m2-phase7-checks/coverage-audit.sh`; ledger Phase 7
notes): 39 §1.2 Choice clauses; 33 already restated in a governing section; six restated nowhere. Clause → RS:

| Clause | §1.2 row (decision → ADR) | Clause text (quoted from the §1.2 Choice cell)                       | Restated by  |
| ------ | ------------------------- | -------------------------------------------------------------------- | ------------ |
| C4.1   | 4 → ADR-0004              | "Not a submission type."                                             | RS1, RS8     |
| C5.2   | 5 → ADR-0005              | "installation tokens are minted inside Actions"                      | RS4          |
| C5.3   | 5 → ADR-0005              | "No webhook server."                                                 | RS2          |
| C13.3  | 13 → ADR-0013             | "the Actions run list serves only the caps"                          | RS3, RS9     |
| C14.3  | 14 → ADR-0014             | "the trusted wrapper workflow decides which secrets enter which job" | RS5, RS7     |
| C16.3  | 16 → ADR-0016             | "it never changes an outcome"                                        | RS6, RS10    |

Edits (OLD = text replaced, located by quotation — line numbers at `e60adde` are leads only; NEW = its replacement;
`⏎` = a line break inside the NEW text, the following line starting with the indentation shown; every other character is
literal; K79 literal = the text K79 must find in the joined, space-squeezed file: CR removed, newlines → spaces, runs of
spaces → one). Each literal runs from after the first six characters of its `OLD:`/`NEW:`/`K79:` line (the label, the
colon, two spaces) to the end of the line; leading spaces after those six characters are part of the literal (the file's
indentation: RS6 two, RS7–RS9 three, RS10 four). OLD and NEW of RS3 and RS6–RS10 are whole lines; OLD of RS1, RS2, RS4,
RS5 is a substring of a table row, and the row's trailing cell padding shrinks by the added length (row width unchanged).

```text
RS1   docs/architecture.md §1.1 table, row "Submission types" (line 21), content cell; step: same as the §1.2 removal
OLD:  GitHub issues and pull requests in public or private repositories
NEW:  GitHub issues and pull requests in public or private repositories; security reports are not a submission type (SP08)
K79:  GitHub issues and pull requests in public or private repositories; security reports are not a submission type (SP08)

RS2   docs/architecture.md §1.1 table, row "Hosting" (line 23), content cell; step: same as the §1.2 removal
OLD:  GitHub Actions in the target repository, GitHub Pages, contributor machines, maintainer machines
NEW:  GitHub Actions in the target repository, GitHub Pages, contributor machines, maintainer machines; no webhook server
K79:  GitHub Actions in the target repository, GitHub Pages, contributor machines, maintainer machines; no webhook server

RS3   docs/architecture.md §6.4 first paragraph (X64p1), after its last line (line 306); a new line appended to the
      paragraph (no blank line before it; the blank line and the job table after it unchanged); step: same as the removal
OLD:  and the run list carry everything a later job or run needs to know.
NEW:  and the run list carry everything a later job or run needs to know.⏎The Actions run list serves only the caps (§12).
K79:  The Actions run list serves only the caps (§12).

RS4   docs/architecture.md §7 table, row "GitHub App" (line 587), second cell; step: same as the §1.2 removal
OLD:  Bot identity, fine-grained permissions, tokens that can trigger workflows
NEW:  Bot identity, fine-grained permissions, tokens that can trigger workflows; installation tokens are minted inside Actions
K79:  Bot identity, fine-grained permissions, tokens that can trigger workflows; installation tokens are minted inside Actions

RS5   docs/architecture.md §8 table, row "Inference" (line 632), inside the second cell; step: same as the §1.2 removal
OLD:  References only, never secret values.
NEW:  References only, never secret values; the trusted wrapper workflow decides which secrets enter which job.
K79:  References only, never secret values; the trusted wrapper workflow decides which secrets enter which job.

RS6   docs/architecture.md §12 bullet "- Spending:" (X12s), its line 8 (line 855); step: same as the §1.2 removal
OLD:    the submission (SP19); `steward init` prints provider-side spending limits
NEW:    the submission (SP19) and never changes an outcome; `steward init` prints⏎  provider-side spending limits
K79:  until a maintainer admits the submission (SP19) and never changes an outcome;

RS7   docs/processes.md SP02 step 3 (XP02s3), the line ending "The policy holds no secret values." (line 206); step: the
      processes step
OLD:     limit is set on the provider's side. The policy holds no secret values.
NEW:     limit is set on the provider's side. The policy holds no secret values;⏎   the trusted wrapper workflow decides which secrets enter which job.
K79:  The policy holds no secret values; the trusted wrapper workflow decides which secrets enter which job.

RS8   docs/processes.md SP08 step 4, a new sentence before "A security-claimed issue is one whose" (line 678); step: the
      processes step
OLD:     pointer. A security-claimed issue is one whose declared category is
NEW:     pointer. Security reports are not a submission type (architecture §1.1).⏎   A security-claimed issue is one whose declared category is
K79:  Security reports are not a submission type (architecture §1.1). A security-claimed issue is one whose

RS9   docs/processes.md SP19 step 1, a new last sentence after "bounds simultaneous work, not aggregate spend." (line
      1372); step: the processes step
OLD:     bounds simultaneous work, not aggregate spend.
NEW:     bounds simultaneous work, not aggregate spend. The Actions run list serves only the caps.
K79:  bounds simultaneous work, not aggregate spend. The Actions run list serves only the caps.

RS10  docs/processes.md SP19 step 10, a new sentence after "Default `all` admits every contract-compliant submission."
      (line 1429); step: the processes step
OLD:      the author. Default `all` admits every contract-compliant submission.
NEW:      the author. Default `all` admits every contract-compliant submission.⏎    Inference admission never changes an outcome.
K79:  Default `all` admits every contract-compliant submission. Inference admission never changes an outcome.
```

Rules (all RS):

- Placement: architecture first. RS1–RS6 land in the step that removes the §1.2 table (same commit), so no merged commit
  lacks a governing statement of any §1.2 clause; RS7–RS10 land in the step that edits `docs/processes.md`. C5.2 and C5.3
  get no processes restatement: no process step carries App-token minting or the absence of a webhook server (SP02 step 2
  installs the App and stores its key; minting happens at run time, which processes describe only by job).
- Line breaks: the decomposer may re-wrap the NEW text of RS3 and RS6–RS10 differently only if every K79 literal, K71, and
  the pins below still hold; table rows (RS1, RS2, RS4, RS5) are single lines by construction. OLD texts occur exactly
  once in their file at `e60adde` (verified: `grep -cF` = 1 each; whole-line OLDs also `grep -cxF` = 1).
- Table widths (no Prettier re-pad; the rows keep their padded width): §1.1 content column width 175 (RS1 NEW 116 chars,
  RS2 NEW 115); §7 second column width 462 (RS4 NEW 120); §8 second column width 590 (RS5 cell 453 → 521). Verified
  (decomposer dry-run with every Phase 7 payload; planner simulation of RS1–RS10 alone on the `e60adde` files):
  `prettier --check` passes with no write, and each K79 literal occurs exactly once.
- Content: RS text cites no ADR and no planning document or identifier (K74 pattern: 0 matches); contains no `deferred`,
  `DFnn` (k6 NODEFER), `prettierignore`, "ignore list", or `node_modules/` (PI2); no C1 marker literal (K24 counts
  unchanged); matches no K67 sweep pattern (`[Dd]ecisions? [0-9]+|§ ?1\.2|\bPD0[45]\b`).
- Pins untouched: K35 X13s, X64t, XCL; W13; k6 ANCHOR lines; `LP`. RS3 adds a line to the §6.4 first paragraph and edits
  no §6.4 job or wrapper table row.
- Faithfulness: each RS restates its §1.2 clause without widening or narrowing it; RS5 states C14.3 next to C14.2
  ("References only, never secret values"), which the §8 cell already states; the F1 wiring (explicit per-name `secrets:`
  mapping, §6.4) is the mechanism by which the wrapper decides, so RS5 and RS7 do not contradict it (amendment 8 F1 ripple).
- Summaries unchanged (owner order 12). Checked at `e60adde`, no contradiction: whitepaper §9 "run lists serve caps";
  whitepaper §11 "Its installation tokens are minted only in `gate` and `publish`; no webhook receiver exists" and "No
  hosted backend is required."; `README.md` "No hosted backend exists."; `CLAUDE.md` "Intended architecture" ("the run
  list serves caps", "GitHub App identity minted inside Actions; no webhook server, no hosted backend"; K35 XCL pinned);
  user manual overview "There is no hosted backend.", configuration "Inference admission controls spending, not quality."
  None states that a security report is a submission type or that inference admission changes an outcome.
- Effect on milestone re-verification: RS5 restates `milestone-verify.sh` R10's anchor ("the trusted wrapper workflow
  decides which secrets enter which job.", lowercase, period included) in `docs/architecture.md`, so R10 is no longer
  superseded ("Milestone re-verification after Phase 7").

### Phase 7 content checks

Run from the repo root in bash; helpers `J` and `N` as in "Phase 5 content checks"; normalized text = `tr -d '\r' | tr
'\n' ' ' | tr -s ' '`. New extracts:

```text
X12d   docs/architecture.md   awk '/^### 1[.]2 /{f=1;next} /^### /{f=0} f'
XCS    CLAUDE.md              J '^## Design source of truth' '^## Documentation conventions'
XCD    CLAUDE.md              J '^## Documentation conventions' '^## Invariants'
XRD    README.md              J '^## Development' '^## Automation'
```

`PAT` (planning citation pattern, owner order 8; one line):

```text
project-development-plan|astra-plan|development-artifacts|patch-steward-m[0-9]|[Dd]evelopment plan|\bplan §|[Dd]ecision packet|[Pp]roject ledger|\bM[0-9]{2}\b|\b[Pp][Dd][0-9]{2}\b|[Oo]wner decisions? [0-9]|\bQ[1-9]E?\b|\bC1\b|\bF[12]\b|\bOA[0-9]*\b|[Pp]hases? [0-9]|\b[Ss]teps? [0-9]+\.[0-9]+|[Aa]mendments? [0-9]
```

`PERSIST` (persistent paths, owner order 8; `probes/` excepted by owner order 9):
`docs/architecture.md docs/processes.md docs/whitepaper.md docs/deferred.md docs/problem-statement.md docs/user-manual docs/adr README.md CLAUDE.md fixtures`.
Dry-run at `9bcc195`: `git grep -nE "$PAT" -- $PERSIST` prints exactly 5 lines — `CLAUDE.md:63`, `docs/user-manual/configuration.md:261`
(false positives), `docs/whitepaper.md:760`, `fixtures/README.md:3`, `fixtures/README.md:12`.

```text
K56  ls docs/adr: exactly README.md plus the 33 file names of the ADR set table (sorted comparison with that list).
K57  every ADR file: line 1 is "# ADR-NNNN: <Title>" with NNNN = its file number and Title = the table's; the four
     metadata lines in order ("- Status: accepted", "- Date: <YYYY-MM-DD>", "- Deciders: project owner",
     "- Source: <Source line>"); Date = the table's (ADR-0001–ADR-0016: one of 2026-09-15, 2026-09-16, 2026-09-17);
     Source line = the table's exactly (S-ARCH expanded with the ADR's title for ADR-0001–ADR-0016); headings as
     "ADR format" fixes (order; optional sections only at their positions; nothing else).
K58  every ADR: exactly one line starting 'Chosen option: "' inside ## Decision Outcome; its quoted title equals one
     ## Considered Options bullet title.
K59  ADR-0001–ADR-0016: normalized ## Decision Outcome contains the normalized Choice cell of decision N:
     git show <P7>:docs/architecture.md | grep -E "^\| N +\| " | awk -F'|' '{print $4}' (trimmed) — 16 of 16.
K60  ADR-0017, ADR-0018: normalized ## Decision Outcome contains L17 / L18 below (normalized).
K61  ADR-0019–ADR-0022: normalized ## Decision Outcome contains, in order of the four ADRs, the literal L below.
K62  presence (N >= 1) in the whole normalized ADR file: ADR-0023 `probes/` and "platform drift"; ADR-0024 "PA01–PA09" and
     "PA0N.M"; ADR-0025 "visibility", "evidence-store push restriction" or "evidence store", and "code-owner review";
     ADR-0026 "created_at"; ADR-0027 "startup"; ADR-0028 "always()"; ADR-0029 "Access denied by policy settings";
     ADR-0030 "cancel-in-progress: false"; ADR-0031 "workflow_run.pull_requests"; ADR-0033 "on.workflow_call.secrets" and
     "secrets: inherit".
K63  C1 literals (block under "Governing locations and must-state content (Phase 5)"): S present in ADR-0029 and ADR-0032;
     T present in ADR-0032.
K64  docs/adr: grep -rc development-artifacts docs/adr → 0 for every file; every relative Markdown link target (path part,
     anchor dropped) exists and is neither docs/project-development-plan.md, docs/astra-plan.md, nor under
     development-artifacts/; every "commit `<hex>`" satisfies git merge-base --is-ancestor <hex> develop.
K65  docs/adr/README.md: each of the 33 ids appears in exactly one table row linking its file; the file contains
     "superseded"; no line matches '[Dd]ecisions? [0-9]+|§ ?1\.2'; no line matches (case-insensitive) 'deferred|DF[0-9]{2}'.
K66  X12d (architecture §1.2 body): no line starting with '|'; contains 'adr/README.md'; no match of '[Dd]ecisions? [0-9]';
     no match of (case-insensitive) 'deferred'; grep -c '^### 1.2 Decisions recorded$' docs/architecture.md → 1;
     grep -c '^## 1. Scope and decisions$' → 1.
K67  the sweep command's output, after dropping docs/project-development-plan.md lines that match '\bPD0[45]\b' and do not
     match '[Dd]ecisions? [0-9]+|§ ?1\.2', is exactly one line: probes/pa08-copilot-inference/workflows/probe-pa08-cap.yml
     line 1. docs/adr: no line matches '[Dd]ecisions? [0-9]+|\bPD0[45]\b'; the lines matching '§ ?1\.2' are exactly the 16
     "- Source:" lines of ADR-0001–ADR-0016.
K68  probes/pa04-privilege-separation/README.md contains "ADR-0033" and no "decision F1".
K69  git grep -nE 'development-artifacts/[A-Za-z0-9_.-]' -- . ':!development-artifacts' → prints nothing.
K70  XCS contains "docs/adr" and no "§1.2"; XCD contains "docs/adr", "ADR-", and "superseded", and no "decisions 1–16";
     XRD contains "docs/adr".
K71  changed-line rule for docs/architecture.md (outside §1.2), docs/processes.md, docs/whitepaper.md, docs/deferred.md,
     docs/project-development-plan.md: compare `git show <phase-7 base>:<file>` with the working file after removing '\r'
     and collapsing runs of spaces and of '-' (Prettier table re-padding); every differing line on the new side contains
     "ADR-00", and every differing line on the old side matches '[Dd]ecisions? [0-9]+|§ ?1\.2' or is its table row's
     re-padded twin; exception, docs/whitepaper.md only: the lines of the K75 sentence (old side contains "(M01)" or ends
     "The monorepo layout in §9 is implemented"; new side is part of the K75 new sentence); exception, docs/architecture.md
     (outside §1.2) and docs/processes.md only (amendment 12): a line belonging to an RS edit of "Restatements of §1.2
     clauses" — new side: a line that is part of an RS NEW text (for RS1, RS2, RS4, RS5 the whole table row carrying it);
     old side: a line that is part of the RS OLD text it replaces (for table rows, the whole row) — and no other line.
     (Exact implementation: decomposer.)
K72  git diff --name-only <phase-7 base> -- probes ⊆ {probes/pa01-required-checks/README.md,
     probes/pa03-trusted-triggers/README.md, probes/pa04-privilege-separation/README.md,
     probes/pa05-rounds-concurrency/README.md, probes/pa08-copilot-inference/README.md}; phase-2 check-readme.sh prints
     "… OK" for all nine probe directories; each of the pa01, pa03, pa05, pa08 READMEs contains
     "](../../docs/adr/0023-probe-suite-location.md)" outside code fences and no "development-artifacts"; every line of its
     <phase-7 base> version that contains "actionlint" or "deploy.sh" and not "development-artifacts" is present in the
     working file unchanged apart from leading whitespace.
K73  git diff --name-only <phase-7 base> -- . ':!development-artifacts' ⊆ {docs/adr/*, docs/architecture.md,
     docs/processes.md, docs/whitepaper.md, docs/deferred.md, docs/project-development-plan.md, CLAUDE.md, README.md,
     fixtures/README.md, the five probe READMEs of K72}.
K74  persistent documents cite no planning or implementation document or identifier (owner orders 8 and 11):
     git grep -nE "$PAT" -- $PERSIST prints exactly three lines — CLAUDE.md, the bullet starting "- `pnpm format:check`
     covers"; CLAUDE.md, the persistence bullet (the line equal to LP after removing '\r'); and
     docs/user-manual/configuration.md, the row starting "| `.prettierignore`" — and each of those three lines with every
     "development-artifacts", "project-development-plan", and "astra-plan" removed no longer matches PAT. (It covers
     docs/adr; probes/ is not read.)
K75  fixtures/README.md line 3 is exactly
     "Shared fixture corpus for patch-steward tests: a root directory, not a workspace package (ADR-0022)." and line 12 is
     exactly "Tests locate this corpus relative to the test file via `import.meta.url`. Corpus entries grow per milestone.";
     git diff --numstat <phase-7 base> -- fixtures prints exactly one line "2<TAB>2<TAB>fixtures/README.md".
     docs/whitepaper.md: normalized text contains "The monorepo layout in §9 is implemented; the packages contain only
     toolchain smoke code." and grep -c '(M01)' docs/whitepaper.md → 0.
K76  deferred alternatives (P7-Q1 A): in every docs/adr/0*.md, each line matching grep -iE 'deferred|DF[0-9]{2}' contains
     exactly one match of 'DF[0-9]{2}' and a link "](../deferred.md#<anchor>)" whose anchor is the GitHub anchor of that
     DF's "## DFnn. …" heading in docs/deferred.md; no DF id occurs on two lines of one ADR. CLAUDE.md: the line starting
     "- Deferred features live only in" contains the new sentence of "Citation moves" exactly, and its count of
     grep -oiE 'deferred|DF[0-9]{2}' equals that line's count at <phase-7 base>.
K77  docs/project-development-plan.md: the section from '## 9. Plan decisions' to the end of the file is byte-identical to
     <phase-7 base> (after removing '\r'); grep -oE '\bPD0[1-8]\b' counts per id equal those at <phase-7 base> (at <P7>:
     PD01 4, PD02 3, PD03 9, PD04 6, PD05 4, PD06 3, PD07 4, PD08 11).
K78  CLAUDE.md persistence bullet (owner order 11), with LP = the "Citation moves" literal (text after "LP: "):
     tr -d '\r' < CLAUDE.md | grep -cxF -- "$LP" prints 1;
     tr -d '\r' < CLAUDE.md | awk '/^## Invariants any implementation must preserve/{print p; exit} NF{p=$0}' prints
     exactly LP (it is the last bullet of "Documentation conventions");
     tr -d '\r' < CLAUDE.md | grep -c '^- Persistence:' prints 1;
     no other persistent file states the rule: git grep -lF 'planning and implementation documents' -- $PERSIST prints
     exactly CLAUDE.md.
K79  restatements of §1.2 clauses (owner order 12, amendment 12): for each of RS1–RS10, with its K79 literal from
     "Restatements of §1.2 clauses" (text after "K79:  ", the six-character prefix label, colon, two spaces), the
     normalized file (tr -d '\r' | tr '\n' ' ' | tr -s ' ') contains the literal exactly once, and the normalized extract
     of its owning section contains it: RS1, RS2 architecture §1.1 (from '^### 1[.]1 ' to the next '^### '); RS3 X64p1
     (§6.4 first paragraph); RS4 architecture §7 (from '^## 7[.] ' to the next '^## '); RS5 architecture §8 (from
     '^## 8[.] ' to the next '^## '); RS6 X12s (§12 "- Spending:" bullet); RS7 XP02s3 (SP02 step 3); RS8 processes SP08
     (from '^### SP08[.] ' to the next '^### '); RS9, RS10 processes SP19 (from '^### SP19[.] ' to the next '^### ');
     AND bash development-artifacts/patch-steward-m2-phase7-checks/coverage-audit.sh (as revised for amendment 12: each
     of the 39 §1.2 Choice clauses maps to a governing restatement found by anchor quote; C4.1, C5.2, C5.3, C13.3, C14.3,
     C16.3 map to their RS texts) prints the last line exactly
     "COVERAGE-AUDIT clauses=39 restated=39 not-restated=0 anchors-missing=0".
K80  owner order 13 (post-completion fixes):
     (a) line 4 of docs/adr/0002-browser-secrets.md and of docs/adr/0004-security-reports.md (CR removed) is exactly
         "- Date: 2026-09-16"; the ## More Information section of each contains "[Whitepaper §14](../whitepaper.md)",
         "commit `f79de29` (2026-09-16)", and "commit `0da65aa` (2026-09-17)"; the docs/adr/README.md rows of ADR-0002
         and ADR-0004 end "| accepted | 2026-09-16 |"; git diff --stat <R7> -- docs/whitepaper.md docs/deferred.md prints
         nothing; normalized docs/whitepaper.md contains "revised on September 16, 2026" and docs/deferred.md contains
         "ADR-0002, as revised September 16, 2026".
     (b) docs/adr/0025-ruleset-dependent-controls-limitation.md: the text after "were each refused with HTTP 403" up to
         "No required-check (PA01)" contains "](../../probes/pa01-required-checks/results/org-private.md)" and
         "](../../probes/pa06-merge-queue-relay/results/org-private.md)"; the text after "The same sub-claims were
         confirmed on the public test-beds" to the end of its line contains
         "](../../probes/pa01-required-checks/results/org-public.md)",
         "](../../probes/pa01-required-checks/results/personal.md)", and
         "](../../probes/pa06-merge-queue-relay/results/org-public.md)" and no "org-private.md"; the whole file
         contains "results/org-private.md" exactly 2 times.
     (c) tr -d '\r' < CLAUDE.md | grep -cxF -- "$LF" prints 1 (LF = the "Citation moves" literal, text after "LF: ");
         grep -c '^- `pnpm format:check` covers' CLAUDE.md prints 1.
     (d) git diff --name-only <R7> -- . ':!development-artifacts' ':!docs/project-development-plan.md' plus untracked
         files outside development-artifacts/ is exactly: CLAUDE.md, docs/adr/0002-browser-secrets.md,
         docs/adr/0004-security-reports.md, docs/adr/0025-ruleset-dependent-controls-limitation.md, docs/adr/README.md.
     Groups in k7-checks.sh (decomposer): (a), (b) in adr; (c) in summaries; (d) in all (gate7.sh G1 runs all).
```

K60 literals (each runs from after `L17: ` / `L18: ` to the end of its line):

```text
L17: TypeScript and one compiled ecosystem, Rust or C++, chosen when the deterministic verification stages are built: SP10 step 3 distinguishes compile failures from assertion failures, which a compiled ecosystem exercises. Not chosen: TypeScript and Python.
L18: Yes, in observe mode, starting when the GitHub-hosted full pipeline runs in observe mode, as continuous real traffic for calibration.
```

K61 literals (the project ledger "Value" cells of the M01 rows, identical on `develop` and at `<P7>`; each runs from after
`L: ` to the end of its line):

```text
L: One shared version; root `package.json` is the source the CD trigger reads; packages stay in lockstep
L: Node 24 only: CLI `engines` `>=24`; action runtime `node24`
L: Unit and fixture on Ubuntu and Windows; container on Ubuntu only; live probe never in CI
L: Root `fixtures/` directory, not a workspace package
```

Not mechanical (supervisor judgment, not delegated): each ADR's context, options, reasons, and consequences are faithful
to its sources (P7-Q2 A revised: no invented or reconstructed option or rationale; alternatives only as some repository
source names them; each ADR self-contained, citing no planning source); evidence bounds hold (F1, Q1/Q1E, C1 marker);
deferred alternatives appear only as P7-Q1 A one-liners that restate no design; L17/L18 are the only rewordings of a
recorded decision text; Consequences name governing locations that state the resulting design and no plan-level
consequence; the §1.2 pointer and the `CLAUDE.md` precedence rule state owner order 3; each of RS1–RS10 restates its
§1.2 clause faithfully (no widening or narrowing) in the section that owns the clause's topic, and states no new design
(owner order 12); owner order 13: the ADR-0002 and ADR-0004 `## More Information` derivation states the documents'
September 16, 2026 revision date and both commits (`f79de29` 2026-09-16, `0da65aa` 2026-09-17) truthfully, without
citing `docs/deferred.md`, and D1's last-change rule is not applied against their `2026-09-16` dates (owner ruling);
ADR-0025 links the org-private result files only where the refusal is stated and the public result files on the
confirmation sentence. Coverage audit (a gate check since amendment 12, K79; the gate report records its full output): every
clause of a §1.2 Choice cell is restated by a governing section (architecture outside §1.2, processes, user manual)
after the removal — zero unrestated clauses; any unrestated clause is a gate failure and goes to the planner as an
amendment note, never to a step-level workaround.

### Milestone re-verification after Phase 7 (which earlier checks still apply)

The Phase 7 gate re-runs, unchanged, from the repo root:
`bash development-artifacts/patch-steward-m2-phase6-checks/check-findings-final.sh`; `… /k6-checks.sh <group>` for `arch`,
`proc`, `whitepaper`, `manual`, `summaries`, `findings`, `all`; `… /project-dod.sh` (GitHub GET reads only; Bash timeout
600000); `… /milestone-verify.sh`. Exact expectations (re-baselined by amendment 10 for the P7-Q1–P7-Q5 answers, by amendment 11 for the `CLAUDE.md`
persistence bullet, and by amendment 12 for RS1–RS10, which change only the `milestone-verify.sh` expectation — every
other expectation below was re-run unchanged in the decomposer's dry-run with RS1–RS10 applied):

- `check-findings-final.sh`: still applies in full; last line `CHECK-FINDINGS-FINAL OK`.
- `k6-checks.sh arch`, `proc`, `whitepaper`, `manual`: still apply in full (K1–K24, K26, K28–K55, K35 X13s/X64t, W13,
  ANCHOR, COUNTS, PI1, PI2, NOCITE, NODEFER); each last line `K6-CHECKS <group> OK`.
- `k6-checks.sh summaries`: K24 ×2, K35 XCL, K26 ×2, PI1, PI2, TRUTH ×2, NOCITE `README.md`, NODEFER ×2 still apply
  (PASS). SUPERSEDED (amendment 11): NOCITE on `CLAUDE.md` — `LP` names `docs/project-development-plan.md` (owner order
  11), so its count grows from 0 to 1 → replacement NOCITE′ =
  `tr -d '\r' < CLAUDE.md | grep -vxF -- "$LP" | grep -oE '\bPD[0-9]{2}\b|\bM[0-9]{2}\b|project-development-plan|Q1E' | wc -l`
  prints `0` (the count at `<start>`), AND K78 holds. Exact: the only FAIL line is `NOCITE FAIL CLAUDE.md new=1 old=0`;
  last line `K6-CHECKS summaries FAIL 1`.
- `k6-checks.sh findings`: K27, K36, SCOPE6 still apply (PASS). SUPERSEDED: PROBES6 (Phase-6-scoped; Phase 7 edits five
  probe READMEs) → replacement K72. Exact: the only FAIL line is `PROBES6 FAIL …`; last line `K6-CHECKS findings FAIL 1`.
- `k6-checks.sh all`: everything above plus PI2 (whole tree, `docs/adr` included), K26 ×3, DOD1 ×2 still apply (PASS).
  SUPERSEDED: NOCITE on `CLAUDE.md` (→ NOCITE′ and K78, as under `summaries`), PROBES6 (→ K72) and FROZEN6
  (Phase-6-scoped; Phase 7 edits `docs/deferred.md` and the plan) → replacements K71, K73, K77, and
  `git diff --stat <start> -- docs/problem-statement.md docs/astra-plan.md` prints nothing. Exact: FAIL lines are exactly
  `NOCITE FAIL CLAUDE.md new=1 old=0`, `PROBES6 FAIL …`, and `FROZEN6 FAIL …`; last line `K6-CHECKS all FAIL 3`.
- `project-dod.sh`: P1, P2, P3, P4, P6, P7, P8, P9, P12, P13, P14 and the P10 `.prettierignore` pin line still apply
  (PASS). SUPERSEDED, each expected to FAIL:
  - P5 (requires `K6-CHECKS all OK`) → P5′ = the `k6-checks.sh all` expectation above AND NOCITE′ AND K56–K80 all hold
    (K80 added by amendment 13; no other expectation of this section changes for owner order 13).
  - P10, `<start>` diff line (`fixtures/README.md` changes: P7-Q4 A) → P10′a = the Phase 7 form of the `<start>` diff
    (project DoD 10) prints nothing.
  - P10, "no step or merge commit touches the lead-owned plan or project ledger" line (owner order 6: Phase 7 steps edit
    the plan) → P10′b = the project DoD 10 plan-commit command prints nothing AND
    `git log --format=%s <start>..HEAD -- development-artifacts/patch-steward-project-ledger.md | grep -cE '^(step|merge)\(patch-steward-m2'`
    prints `0`.
  - P11 (its added-`deferred.md`-line count is > 0: the ADR one-liners and the edited `CLAUDE.md` bullet, P7-Q1 A) →
    P11′ = from the `k6-checks.sh all` output, exactly 2 `TRUTH PASS` lines, 14 `COUNTS` lines with none `FAIL`, no
    `NODEFER` line `FAIL`; AND
    ``git diff <start> -- docs README.md CLAUDE.md ':(exclude)docs/adr' | grep '^+[^+]' | grep 'deferred\.md' | grep -vc '^+- Deferred features live only in `docs/deferred.md`\.'``
    prints `0`; AND K76 holds.
  - Exact: FAIL lines are exactly one `P5 FAIL`, two `P10 FAIL` (the `<start>` diff line and the plan/ledger commit
    line), one `P11 FAIL`; last line `PROJECT-DOD FAIL 4`. Any other FAIL (for example P7 or P12 from live test-bed
    state) is a real failure, not superseded.
- `milestone-verify.sh`: EC1–EC8, S1–S15 (all 15 quotes found: Phase 7 rewrites no quoted plan text), R1–R17 still apply,
  R10 included: its anchor "the trusted wrapper workflow decides which secrets enter which job." (lowercase, period
  included) was in the removed §1.2 row 14 and is restated in `docs/architecture.md` by RS5 (amendment 12; amendment 9's
  supersession of R10 and its replacement R10′ are withdrawn — the ADR-0014 anchor still holds through K59). Exact: every
  item ok; `STALE-PLAN-TEXT items=15 found=15 missing=0`; `RIPPLE-RECORD items=17 anchors-found=17`; last line
  `MILESTONE-VERIFY OK`.
- Phase 5 `k-checks.sh`: not run (FAILs by design since Phase 6).
- Roadmap Phase 1–6 DoDs: held at their gates (ledger); not re-run except through the scripts above. Their "Untouched in
  this phase" items are phase-scoped history; the Phase 7 DoD replaces them for Phase 7.
- Earlier readings withdrawn by amendment 10: K69's exception for the m2 brief/ledger; the K67 case "P7-Q4 = B"; the
  optional P10 `<start>` and P11 superseded cases (both now certain); the plan §9 intro and PD04/PD05 pointer edits and
  their K71 allowance; ADR ids in the plan for PD04/PD05; the `docs/adr/README.md` mapping line.
- `HEALTH` (Phase 7 form, roadmap) holds.
- The gate report records every script's full output, marks each superseded FAIL line with its replacement's verdict, and
  records the coverage audit's full output (K79: zero unrestated clauses) and lists any stale plan text Phase 7 did not
  touch.

## Constraints

- No package code: nothing under `packages/`, `fixtures/`, `templates/`, this repository's `.github/`, `package.json`,
  `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `eslint.config.mjs`, `.prettierrc.json`,
  `.gitignore`, or `LICENSE` changes in any phase. Single exception, Phase 7 (P7-Q4 A and the persistence rule,
  amendment 10): `fixtures/README.md` line 3 "(owner decision 4)" → "(ADR-0022)" and line 12 "(plan §0.3)" removed (K75).
- Phase 7 (owner order, amendments 9, 10, and 12) changes only: new `docs/adr/` (README.md and the 33 ADR files),
  `docs/architecture.md` (§1.2 body, the "(decision 15)" citation, and the RS1–RS6 restatements: §1.1 rows "Submission
  types" and "Hosting", §6.4 first paragraph, §7 row "GitHub App", §8 row "Inference", §12 bullet "Spending"),
  `docs/processes.md` (line 8 citation and the RS7–RS10 restatements: SP02 step 3, SP08 step 4, SP19 steps 1 and 10),
  `docs/whitepaper.md` (§14 citation; line 760 "(M01)" removal), `docs/deferred.md` (citation cells and line 63),
  `docs/project-development-plan.md` (architecture decision-number citations and the line-18 sentence only; §9 and every
  `PDxx` citation unchanged), `CLAUDE.md` ("Design source of truth", "Documentation conventions"), `README.md`
  ("Development" list), the five probe READMEs of K72, `fixtures/README.md` (lines 3 and 12), and
  `development-artifacts/patch-steward-m2-*` (step files, reports, checkers). Owner order 13 (amendment 13, after Phase 7
  completion) changes, relative to `<R7>`, only: `docs/adr/0002-browser-secrets.md` and `docs/adr/0004-security-reports.md`
  (Date line and `## More Information` derivation, D1), `docs/adr/0025-ruleset-dependent-controls-limitation.md` (evidence
  link placement), `docs/adr/README.md` (the ADR-0002 and ADR-0004 row dates), the `CLAUDE.md` "Documentation
  conventions" bullet starting "- `pnpm format:check` covers" (→ `LF`), and `development-artifacts/patch-steward-m2-*`
  (K80 (d)); `docs/whitepaper.md`, `docs/deferred.md`, and `.prettierignore` stay unchanged. Local only (owner order 7). Persistent
  documents (owner order 8) cite no planning or implementation document or identifier after Phase 7 (K74); the one
  exception is the `CLAUDE.md` persistence bullet `LP`, which names the planning paths to state the rule (owner order 11).
- `.prettierignore` changed exactly once since the starting commit: the owner's line `development-artifacts/`, commit
  `49ef1bf7bc408da7d2676f859cf144a9b950d3c6` (owner decision 9). No step edits it in any phase and it is in no step's
  `files_in_scope`; its content stays exactly the five entries of that commit (project DoD 10 pins it).
- Phases 1–4 change only `probes/**` and `development-artifacts/patch-steward-m2-*`. Phases 5 and 6 additionally change
  `docs/architecture.md`, `docs/processes.md`, `docs/whitepaper.md`, `README.md`, `CLAUDE.md`, and `docs/user-manual/*.md` as the
  recorded owner decisions require (owner decision 9 included: the `.prettierignore` statements in `CLAUDE.md` and
  `docs/user-manual/configuration.md`).
- Never edited by any step: `development-artifacts/patch-steward-project-ledger.md` (lead-owned),
  `docs/astra-plan.md` (do not read it either), `docs/problem-statement.md`, `development-artifacts/patch-steward-m1-*`.
  `docs/project-development-plan.md` (lead-owned) is edited only by Phase 7 steps and only as "Phase 7 — Architecture
  decision records" / "Citation moves" specifies (owner orders 4 and 6; §9 and `PDxx` citations never); other stale plan
  text is LISTED for the lead in the
  verification reports. `docs/deferred.md` changes only if a recorded post-probe owner decision defers a feature, and in
  Phase 7 for its citation rewrites.
- All work accumulates as local commits on `milestone/2-platform-assumption-probes`; nothing is pushed to
  `steady-orchard/patch-steward`. Pushes go only to the three test-beds and the fork.
- Invariants of `CLAUDE.md` hold for the probes themselves where they apply: event content is untrusted data; submitted code is
  never executed; tokens, runtime, retries, and captured output are bounded; credentials are redacted; GitHub Models and
  `models: read` are never used.
- Every step leaves `pnpm format:check` and `pnpm lint` passing (`pnpm format:check` reads nothing under
  `development-artifacts/` — owner decision 9).

## Assumptions

- The owner is reachable through `needs-human` for owner actions (Phase 1) and for decisions (after Phase 3; after Phase 4 for
  F1 and, if raised, F2 — relayed through the follow-up packet, not `needs-human`; answered in amendment 6: F1 B, F2 not
  raised). The cap session
  ceiling is settled (`S = 10`); nothing about it is asked again before the Phase 3 decision packet.
- GitHub-hosted runners and Actions minutes are available: unlimited on the public test-beds (which include `personal`, where
  the cap step runs), 2,000 per month on `org-private`.
- What is left of `jambolo`'s Copilot Free allowance when Phase 2 starts covers the 24 standard prompts. If it does not, the
  "Early exhaustion" rule applies; nothing is worked around.
- Copilot Free's monthly allowance is smaller than Copilot Pro's 1,000 base AI credits (undocumented but implied by the plan
  comparison). Its actual size and the credits already used this month are unknown (the owner reported neither), so whether
  `S = 10` cap sessions (about 300 AI credits) exhaust what is left is unknown too. Every case has a recorded outcome: nothing
  left when the cap step starts (`exhausted-before-start`); less than one session limit left (`allowance-exhausted`, with PA08.5
  `undetermined` / `blocked` unless the `maxAiCredits: 1` probe session reached its limit); more than 10 cap sessions' worth
  left (`ceiling-reached`).
- The SSH key stays loaded and `gh` stays authenticated for the duration; the token's scopes do not change unless the owner
  refreshes them.
- The design text under test does not change during the plan except through Phases 5 and 6 (Phase 7 moves decision
  records, rewrites citations, and restates six already-decided §1.2 clauses in governing text, RS1–RS10 (owner order
  12); it changes no design statement).
- The owner answered P7-Q1–P7-Q5 through the lead (amendment 10, 2026-09-25: Q1 A, Q2 A revised, Q3 A, Q4 A, Q5 A) and
  added the persistence rule and the `probes/` exception (owner orders 8 and 9); on the same day the owner ordered the
  rule stated as one `CLAUDE.md` bullet (amendment 11, owner order 11).
- `probes/` becomes a persistent regression suite later in the project (owner order 9); that repurposing is not M02 work
  and the lead records it in the project ledger.
- The lead's pre-merge cleanup of `development-artifacts/` runs after the Phase 7 gate and the milestone evaluation; every
  checker Phase 7 re-runs still exists until then.

## Out of scope

- Any product code, schema, policy key, workflow template, check name, artifact schema, or numerical product limit (M03, M06,
  M13, M14, M20 decide those; M02 only measures).
- The `openai-compatible` adapter and any third-party inference endpoint (no key was supplied); GitHub Models.
- The Copilot adapter's tool-permission question ("Whether read-only Copilot built-in tools consult the SDK permission handler",
  §15) and system-prompt mode — M09.
- Probing in an organization with Copilot (PD03); enabling Copilot, changing plans, or upgrading the organization.
- Vitest `*.live.test.ts` tests, CI jobs, or any automation that runs probes in this repository's CI.
- Promoting captured payloads into `fixtures/`.
- Editing the plan (except Phase 7's citation moves), the project ledger, or M01 artifacts; correcting unrelated
  documentation defects (for example README's
  `DF01–DF09`) — send an amendment note if one blocks a step. The stale `.prettierignore` statements are NOT in this category:
  owner decision 9 puts their correction in Phase 5.
- Editing `.prettierignore` again, or restoring Prettier coverage of `development-artifacts/` (owner decision 9).
- Merging the milestone into `develop`, releases, version bumps (lead and owner).
- Phase 7: ADRs for the excluded (execution-only) decisions of owner order 2; ADR citations added to governing or summary
  text beyond the "Citation moves" list; any new design statement (RS1–RS10 restate decided §1.2 text and are not new
  design statements; any other governing-text edit is out of scope); summary edits for RS1–RS10 (owner order 12: none
  contradicts); the cleanup of `development-artifacts/` (lead, after
  the milestone evaluation); editing plan §9 or any `PDxx` citation in the plan (owner order 4); scrubbing planning
  references from `probes/` or repurposing `probes/` (owner order 9); rewriting citations or decision records in the m2
  brief and ledger (P7-Q5 A); stating the persistence rule in any persistent document other than the one `CLAUDE.md`
  bullet `LP` (owner order 11; K78).

## Definition of Done (project)

All commands from the repo root in bash; `<start>` = `10fcaf2d575037be7c13e0ba0719feb53d51d71f`; `<pin>` =
`49ef1bf7bc408da7d2676f859cf144a9b950d3c6` (the owner's `.prettierignore` commit on the working branch — owner decision 9);
`<tb>` ranges over the three test-bed repositories.

1. Every assumption has a recorded result: `probes/findings.md` `## Roll-up` has exactly nine rows PA01–PA09, each with a result
   in the closed set; `## Cells` has one row for every cell the coverage matrix assigns, equal in count and value to the Results
   rows of the result files; every row cites evidence that exists.
2. PD03's assumption has a recorded result: PA08.2 rows exist for `org-public` and `org-private`; PA08.7 is `undetermined` /
   `pd03` / `accepted-limitation`.
3. Every refuted or undetermined cell has a disposition other than `PENDING`, each equal to the string recorded for it in this
   brief's "Post-probe owner decisions" (Q1–Q7, C1, F1; F2 not raised; Q1E has no cell); every `design-change` and `accepted-limitation`
   names a document section that contains the change.
4. The organization billing path carries the owner-confirmed "unverified" marker at every location in the table above, and a
   fresh grep with the pattern given there finds no unmarked description.
5. Governing documents changed architecture first; §15 closed or reworded per the recorded decisions; whitepaper §14 mirrors
   §15; `CLAUDE.md` invariants agree with the changed text; the Q1 extension (Q1E, amendment 7) is documented at its locations
   ("Q1E content (Phase 6)"; checks K37–K55); architecture §6.1, `README.md`, and `CLAUDE.md` record `probes/` and
   the identifier family (`grep -c "PA01–PA09" docs/architecture.md README.md CLAUDE.md` prints at least 1 for each file).
6. Regression suite kept: for every file under `probes/**/workflows/`, the blob-SHA identity check passes on every test-bed its
   probe README lists; `probes/README.md` documents the drift re-run procedure; each `probes/pa0N-*/README.md` holds the exact
   procedure.
7. Steady state: on every test-bed,
   `gh workflow list -R <tb> --all --json path,state --jq '.[] | select(.path | startswith(".github/workflows/probe-")) | select(.state != "disabled_manually") | .path'`
   prints nothing; `gh issue list -R <tb> --state open --search "probe in:title" --json number --jq length` and the same for
   `gh pr list` print `0`; on every test-bed where the rulesets API is available, every ruleset's
   `conditions.ref_name.include` entries start with `refs/heads/probe-`.
8. Measured limits: `probes/findings.md` `## Measured limits` has a row for every `measurement` sub-claim, each with a value or
   `not measured`.
9. Repository health: `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm lint && pnpm format:check` — every
   command exits 0 (`pnpm format:check` reads nothing under `development-artifacts/` — owner decision 9); the secret-pattern
   check prints nothing.
10. Untouched files:
    `git diff --stat <start> -- packages fixtures templates .github package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json vitest.config.ts eslint.config.mjs .prettierrc.json .gitignore LICENSE docs/astra-plan.md docs/problem-statement.md development-artifacts/patch-steward-m1-brief.md development-artifacts/patch-steward-m1-ledger.md`
    prints nothing. `.prettierignore` is not in that list because the owner changed it after `<start>` (owner decision 9); it is
    pinned to the owner's commit instead: `git diff --stat <pin> -- .prettierignore` prints nothing, and
    `git rev-parse HEAD:.prettierignore` prints `ba4ec991e38365369abc094c855dc3e83f22e1f7` (exactly the five entries
    `pnpm-lock.yaml`, `dist/`, `coverage/`, `node_modules/`, `development-artifacts/`). The lead may commit to
    `docs/project-development-plan.md` and `development-artifacts/patch-steward-project-ledger.md` on this branch while the plan
    runs, so they are excluded from these diffs; instead the project ledger appears in no step's `files_in_scope` and in no
    step commit, and the plan appears only in Phase 7 steps (owner order 6):
    `git log --format=%s <start>..HEAD -- docs/project-development-plan.md | grep -E '^(step|merge)\(patch-steward-m2' | grep -vE '^step\(patch-steward-m2/7\.|^merge\(patch-steward-m2\): step 7\.'`
    prints nothing. Phase 7 form of the `<start>` diff (amendments 9 and 10): the same list with `fixtures` narrowed to
    `fixtures ':(exclude)fixtures/README.md'` (that one file changes in Phase 7, lines 3 and 12 only — K75).
11. Truthful documentation: README "Status" and `CLAUDE.md` "Project state" still describe a scaffold with no screening
    behavior; user-manual `[NEEDS INPUT]` and "(Proposed)" counts are unchanged from `<start>` unless a recorded owner decision
    changes one; no new mention of a deferred feature or link to `docs/deferred.md`, except the P7-Q1 A one-line
    alternatives in `docs/adr/` and the edited `CLAUDE.md` deferred-features bullet (K76; P11′).
12. Budgets held: recorded standard Copilot prompts (smoke plus every PA08 step other than the cap step) total at most 24; the
    cap step's recorded `cap sessions run` is at most 10 and its `cap sends` at most 405 (`S = 10` and `40 × S + 5`, as recorded
    under "Copilot cap step"); the cap step's first Copilot request is later than every other recorded Copilot request; no
    scheduled probe workflow is enabled; `org-private` Actions usage for the milestone, read as in "Re-probe rules", is at most
    300 billed minutes.
13. `.prettierignore` statements corrected (owner decision 9):
    `grep -c "prettierignore.*development-artifacts/" CLAUDE.md docs/user-manual/configuration.md` prints a count of at least 1
    for each file; and no line that lists the entries lacks the fifth:
    `grep -rnE "prettierignore|ignore list" CLAUDE.md README.md docs --include=*.md --exclude=astra-plan.md --exclude=project-development-plan.md | grep "node_modules/" | grep -vc "development-artifacts/"`
    prints `0` (it prints `2` at `<pin>`).
14. Re-probes and follow-up recorded (owner decisions Q3 A, Q4 A): the org-private PA03.4 and PA03.5 rows cite Q3 re-probe
    evidence that records each schedule file's enable time, disable time (at most 6 hours later), and every completed scheduled
    run id; each PA04.1 row (org-public, org-private, personal) cites Q4 re-probe evidence covering wirings W1 and W2 or the
    platform's refusal of one; `development-artifacts/patch-steward-m2-decision-packet-2.md` exists with `F1`, and with `F2`
    exactly when a re-probed PA03 cell is not `confirmed`; "Post-probe owner decisions" records the owner's answer to every
    raised F-item.
15. Decision records (Phase 7, owner order of 2026-09-25, amendments 9, 10, 11, 12, and 13): `docs/adr/` holds `README.md` and
    ADR-0001–ADR-0033 as "Phase 7 — Architecture decision records" fixes them; the architecture §1.2 table is a pointer to
    `docs/adr`; every §1.2 Choice clause is restated in a governing document (RS1–RS10; coverage audit zero unrestated,
    K79); plan §9 and its `PDxx` citations are unchanged; no architecture decision number is cited outside
    `development-artifacts/` (ADR Source lines cite §1.2 by commit, no number); no file outside `development-artifacts/`
    cites a path under it; no persistent document cites a planning or implementation document or identifier (`probes/`
    excepted) other than the `CLAUDE.md` persistence bullet naming the planning paths; `CLAUDE.md` and `README.md` list
    `docs/adr`, and `CLAUDE.md` states the record-only rule and, as the last bullet of "Documentation conventions", the
    persistence rule exactly as `LP`; the owner-order-13 fixes hold (ADR-0002 and ADR-0004 dated 2026-09-16, ADR-0025
    evidence links placed by claim, the `CLAUDE.md` format-check bullet exactly `LF`) — brief K56–K80 and NOCITE′ hold, and the milestone re-verification under that section holds (superseded checks fail exactly as listed; every
    replacement passes).
