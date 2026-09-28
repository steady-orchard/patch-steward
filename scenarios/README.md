# Test-bed scenarios

A suite that demonstrates GitHub-hosted screening (wrapper workflows calling the reusable workflow
`.github/workflows/steward-screening.yml` with jobs build, gate, publish, in observe mode at contract level) on
dedicated test-bed repositories. This is not product code, not a workspace package, and never runs in CI; steward
workflows run only on the three test-beds below, never in this repository and never on any other repository.

## Layout

- `README.md` — this document.
- `tools/*.sh` — bash scripts using `gh`; they reuse `probes/smoke/tools/deploy.sh`, `dispatch.sh`, and `wait-run.sh`
  by path.
- `workflows/steward-pr.yml` and `workflows/steward-issues.yml` — test-bed copies of `templates/workflows/*`: pinned
  to a pushed steward commit, with `steward_ref` equal to the pin, plus a sender guard `if:` on job `screen` allowing
  only user id 2095171 and the test App's bot user id 331019482, because the public test-beds accept events from
  anyone. The guard is not part of the templates.
- `workflows/scenario-secret-scope.yml` and `workflows/scenario-secret-scope-called.yml` — the secret-scope pair; the job inside `scenario-secret-scope-called.yml` declares the publication Environment as the mapping `name: steward-publication` plus `deployment: false`, the same declaration rule the reusable screening workflow's jobs gate and publish use (see Safety rules).
- `workflows/scenario-app-edit.yml` — the App-edit helper workflow, deployed and dispatched by `app-edit.sh`; its job
  `edit` declares the publication Environment the same way, as the mapping `name: steward-publication` plus
  `deployment: false`.
- `fixtures/policies/orphan-branch.yml` and `fixtures/policies/repository-store.yml` — test-bed policies (all
  observe, no `llm` section); `fixtures/policies/invalid-limit.yml`, `unwritable-store.yml`, `caps-daily.yml`, and
  `caps-author.yml` — scenario policy variants (an invalid daily cap, a separate store repository the App cannot
  write, and two run-cap combinations).
- `fixtures/pull-requests/steward-pr-modified.yml` — the wrapper with a changed name and run-name, committed as
  `.github/workflows/steward-pr.yml` by the policy-and-wrapper pull requests.
- `fixtures/submissions/*.txt` — submission bodies.
- `results/<test-bed key>.md` — one results file per test-bed, checked with `results-check.sh`; see Results.

## Test-beds

| Key         | Repository                                   | Visibility | Evidence store                                                                      |
| ----------- | -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| org-public  | steady-orchard/patch-steward-testbed-public  | public     | orphan branch `steward-evidence`                                                    |
| personal    | jambolo/patch-steward-testbed-personal       | public     | orphan branch `steward-evidence`                                                    |
| org-private | steady-orchard/patch-steward-testbed-private | private    | repository steady-orchard/patch-steward-testbed-evidence, branch `steward-evidence` |

Plus the fork jambolo/patch-steward-testbed-public: a pull-request-head fixture only (no workflow enabled, App not
installed, no policy); the live tests rely on it having no published policy.

## Prerequisites

Managed by the repository owner; the suite never changes them:

- the test App installed on each test-bed (and on the evidence repository);
- on each test-bed, the Environment `steward-publication` with deployment branches restricted to `master`, and the
  Environment secrets `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY` (never repository or organization
  secrets of those names);
- the private evidence repository with at least one commit.

Check with `bash scenarios/tools/environment-check.sh <owner/repo>` (prints secret names only). Nothing here reads
the probe suite's App secrets, and they stay untouched.

## Safety rules

- Steward and scenario workflows run only for the allowlisted senders.
- No pull request head is checked out or executed.
- No event text passes through `${{ }}` into `run:`.
- Only `actions/*` actions pinned by full commit SHA.
- Never print tokens or secrets (the secret-scope check prints only length-zero booleans).
- Never delete repositories or issues; never force-push.
- Test-bed `master` changes only through deploys (`probes/smoke/tools/deploy.sh`).
- Every test-bed write is a standalone `gh` command or a tool listed here.
- Naming: issue and pull request titles start `[scenario S<nn>]`; branches `scenario-s<nn>-*`.
- `app-edit.sh` edits or closes a submission only for the allowlisted user, takes the App credentials from the
  publication Environment, prints only HTTP status codes, and revokes its token.
- A policy variant stays deployed for one scenario only and is restored with `deploy-steward.sh` after every run of
  that scenario completed, because publish reads the default-branch policy again for its freshness check.
- The reusable screening workflow's jobs gate and publish, and every scenario workflow job that declares the
  publication Environment, declare it as the mapping `name: steward-publication` plus `deployment: false`. In the
  plain form `environment: steward-publication`, GitHub Actions records a Deployment for each Environment job of a
  run, which for a `pull_request_target` run sits on the pull request head; with `deployment: false` the Environment
  secrets and the Environment's branch restriction still apply and no Deployment is created.

## Budgets

- Poll no more often than every 20 s.
- Wait at most 15 min per run.
- Stop when the core rate limit remaining is below 500.
- org-private: at most 30 billed Actions minutes for the whole suite.

## Tools

Read each script's header comment for full detail.

- `bash scenarios/tools/deploy-steward.sh <org-public|personal|org-private> [<policy file>]` — deploys the pinned
  wrapper copies and a policy file to one test-bed's `master` branch, then verifies byte identity, delegating the
  copy-and-verify to `probes/smoke/tools/deploy.sh`.
- `bash scenarios/tools/environment-check.sh <owner/repo>` — read-only check of a test-bed's publication Environment
  and secret scope; prints secret names only, never values.
- `bash scenarios/tools/find-runs.sh <owner/repo> <workflow file name> <display title prefix>` — lists workflow runs
  of any status whose display title starts with the given prefix, oldest first.
- `bash scenarios/tools/artifacts.sh <owner/repo> <artifact name>` — lists artifacts matching a given name exactly,
  sorted by creation time.
- `bash scenarios/tools/evidence.sh <store owner/repo> <branch> <target owner/repo> <pr|issue> <number>` (and the
  `--local <store root directory>` form) — read-only verification of an evidence store: fetches a store branch (or
  reads a local store root), checks that every store commit only adds files, and verifies each run directory of one
  submission, including waiting run directories against their manifest. Needs `pnpm build` first (it verifies run
  directories with `steward report --json`).
- `bash scenarios/tools/audit.sh <owner/repo> [<title prefix>]` — observe-mode audit that checks scenario issues and
  pull requests carry no writes from the steward App; for each scenario pull request it also lists every deployment
  on the head commit as an `AUDIT-DEPLOYMENT` line (id, environment, ref, creator, created_at, class) and classifies
  each as `before-fix` when GitHub Actions created it for `steward-publication` for the allowlisted user or the test
  App's bot user before the current wrappers were deployed, otherwise `counted`. The wrappers' deployment time is the
  committer date of the newest `master` commit that changed `.github/workflows/steward-pr.yml` (first output line
  `wrappers_deployed_at=`), or the value of `AUDIT_WRAPPERS_DEPLOYED_AT` (UTC `YYYY-MM-DDTHH:MM:SSZ`) when set. The
  summary line carries `head_deployments` (counted only) and `before_fix_deployments`; only counted deployments, App
  comments, labels, App check runs, and review requests make the result `writes-found`.
- `bash scenarios/tools/secret-scope.sh check|run <owner/repo>` — verifies that the steward's two App secrets reach
  only jobs declaring the Environment `steward-publication`, by reproducing the product's secret path in a
  disposable caller/called workflow pair; `run` also deploys and dispatches it and inspects the log for the
  length-zero markers.
- `bash scenarios/tools/steady-state.sh <owner/repo> plan|apply` — puts one test-bed into the scenario suite's
  steady state: disables the steward and scenario workflows and closes open scenario submissions.
- `bash scenarios/tools/run-log.sh <owner/repo> <run id> <attempt> <job>` — prints the normalized log lines of one
  job of a run attempt, with echoed script lines dropped and credentials withheld, then a summary line.
- `bash scenarios/tools/await-runs.sh <owner/repo> <workflow file> <display title prefix> <after run id> <min count>` — waits, polling every 20 s up to a bounded deadline, until at least the given number of newer runs with that title prefix have completed.
- `bash scenarios/tools/run-records.sh runs|metrics ...` — read-only reader of key fields of run directories,
  supersession records, and metrics files (outcome, waiting state and reason, policy revision, snapshot, finding
  codes, closure resolutions), from a store branch or a local store root.
- `bash scenarios/tools/app-edit.sh <owner/repo> <issue|pr> <number> title <new title> | close` — deploys and
  dispatches the App-edit helper workflow, which edits the title or closes the submission with an installation
  token of the test App so the event sender is the App's bot user.
- `bash scenarios/tools/pins.sh <owner/repo> <ref>` — read-only static check of the deployed wrapper workflows and the pinned reusable workflow (blob identity, pin equality and reachability, environment and secret usage, no probe secret names, every `uses` pinned by a resolvable 40-hex SHA). `<ref>` is required (no default): the branch, tag, or commit of `steady-orchard/patch-steward` that must contain the pin, as GitHub names it (a branch name without `origin/`); the reachability check passes when GitHub's comparison of the pin with `<ref>` reports `ahead` or `identical`. A wrong argument count or a malformed `<ref>` exits 2 before any read. The environment check passes only when gate and publish declare `steward-publication` in the mapping form with `deployment: false` and no job declares an Environment in any other form (detail `jobs=... other_form=...`). `PINS_SCREENING_FILE=<path>` checks a local copy of the reusable workflow instead of the pinned one; the final line then carries `screening=local`.
- `bash scenarios/tools/results-check.sh <results file> <scenario id>...` — checks that every listed scenario has
  sections that all end `Result: pass`, that the file holds no forbidden text, and that it is Prettier-clean.

## Setup

1. Push the steward commit the test-beds will pin.
2. Create the test-bed wrapper copies from `templates/workflows/` by replacing both placeholder SHAs with that
   commit and adding the sender guard.
3. Validate the policies with `node packages/cli/dist/main.js policy --file <policy>`.
4. Deploy with `deploy-steward.sh` per test-bed.
5. Confirm the deployed blob ids equal `git rev-parse HEAD:<path>` (never compare working-tree bytes: line endings
   differ on Windows) and that the pin is reachable on GitHub.

After a steward fix: push the fix commit without force to the development branch, the `<ref>` that `pins.sh` checks the pin against; regenerate the wrapper copies with that commit as the pin; redeploy the wrappers with `deploy-steward.sh` and every changed helper workflow with `probes/smoke/tools/deploy.sh`; deploying a file does not change whether its workflow is enabled, so enable only the workflows a scenario needs with `gh workflow enable <file> -R <owner/repo>` and disable them again when it ends (the steady state keeps them disabled).

Ownership artifacts are named `steward-ownership-pr-<n>` or `steward-ownership-issue-<n>`. Run display titles read
`steward <pr|issue> <n> author <id> event <event> <action> sender <id> <type>`. In the run's job list the jobs
appear as `screen / build`, `screen / gate`, `screen / publish`. Each core step prints its job summary into the log
after the steward finishes.

## Procedures

### S00

org-public smoke: open an unstructured issue with `fixtures/submissions/unstructured.txt`.

Pass condition: build, gate, and publish succeed; one ownership artifact; one evidence commit whose run directory
verifies; the publish summary in the log names the evidence commit; audit clean.

### S01

org-public: open an unstructured pull request.

Pass condition: one ownership artifact; one run directory with outcome needs-changes; publish summary after
evidence.

### S02

org-public: edit the S01 pull request title only.

Pass condition: disposition duplicate; artifact count unchanged; no new run directory.

### S03

org-public: title edit by the test App (`app-edit.sh` title), so the event sender is the bot user.

Pass condition: disposition duplicate; nothing committed.

### S04

org-public: edit the pull request body twice within about 5 s, the second edit made right after the older run's
gate job completes, so the older run's publish sees a newer owner or a changed snapshot.

Pass condition: the newer run commits and publishes; the older run has a supersession record (newer-owner or
snapshot-changed); retry up to 3 times until the runs overlap.

### S05

org-public: three body edits back to back.

Pass condition: exactly one non-superseded outcome for the newest owner; every run whose gate captured an unchanged
snapshot ends duplicate; every other committed run superseded or its pending publish replaced; every evidence
commit since S01 only adds files.

### S06

org-public: deploy `invalid-limit.yml`, edit a body, restore the policy.

Pass condition: gate fails before commitment; listing unchanged; previous newest owner still newest; no evidence
for that run.

### S07

org-public: deploy `unwritable-store.yml`, edit a pull request that already has an owner (so the gate never reads
the separate store), restore the policy.

Pass condition: gate commits; publish fails at the evidence write; no run directory; no summary outcome.

### S08

org-public: inspect the S01 and S04 publish logs.

Pass condition: the evidence commit (its read-back) precedes the job summary.

### S09

org-public: a same-repository branch and a fork branch each commit `steward-pr-modified.yml` as
`.github/workflows/steward-pr.yml` and `caps-daily.yml` as `.github/patch-steward/policy.yml`, with the body
`fixtures/submissions/pr-chore.txt`.

Pass condition: runs used master's workflow; run record `policy_revision` equals master's tree id; findings include
`submission.policy-change` and `submission.trusted-path-change`.

### S10

org-public: open, title-edit, and body-edit an issue; close the issue by the author; reopen it; close it by the test
App (`app-edit.sh` close), which gives closed-by-maintainer. Pull requests: one opened and closed by the author, one
opened and merged into base branch `scenario-s10-base`.

Pass condition: body edit commits; reopen commits; closures produce metrics-only commits with merged,
closed-by-author, closed-by-maintainer as applicable.

### S11

org-public: deploy `caps-daily.yml`, then `caps-author.yml`, with contract-met issues.

Pass condition: the over-cap run is queued; waiting run directory with `waiting.json`; restore the policy.

### S12

org-public: re-run the S00 run (`gh run rerun`).

Pass condition: the new attempt commits a new owner (newest `created_at`).

### S13

all test-beds. On org-public, after the publication jobs declare `deployment: false` and the wrappers pinning that
version are deployed: enable `steward-pr.yml`, open one pull request `[scenario S13] post-fix deployment check` from
branch `scenario-s13-head` (created from `master` with `probes/smoke/tools/deploy.sh`) with
`fixtures/submissions/unstructured.txt` as body, wait for its run, edit the body once, wait for the second run,
disable `steward-pr.yml`. Then audit every scenario submission on every test-bed with `audit.sh`.

Pass condition: App-authored comments, labels, App check runs on head SHAs, requested reviewers, and counted
deployments all 0; the new pull request had exactly two wrapper runs, both calling the fixed reusable workflow
commit, with gate and publish successful, and its head has no deployment; the deployments GitHub Actions created on
the heads of org-public pull requests 32, 33, 34, 36, and 37 while the publication jobs used the plain form (2, 2,
28, 4, and 4) are listed as `before-fix`, all for `steward-publication` by the allowlisted user or the test App's bot
user, created before the fixed wrappers were deployed; none is deleted.

### S14

all test-beds: fetch the deployed wrappers and the pinned reusable workflow with `bash scenarios/tools/pins.sh <owner/repo> <ref>`, where `<ref>` is the branch, tag, or commit of `steady-orchard/patch-steward` that must contain the pin (the development branch the fix commits were pushed to).

Pass condition: only gate and publish declare `steward-publication`, both in the mapping form with `deployment: false` (no job in another form), and only they reference the two secrets; no probe suite secret name appears; every `uses` is pinned by 40-hex SHA reachable on GitHub; `steward_ref` equals the pin.

### S15

personal: one contract-met issue (`fixtures/submissions/defect-complete.txt`).

Pass condition: outcome run directory on the personal test-bed's `steward-evidence`; the secrets arrived through
the explicit mapping (gate minted a token).

### S16

org-private: one contract-met issue (`fixtures/submissions/defect-complete.txt`).

Pass condition: run directory committed to the private evidence repository, none in the target.

### S17

all test-beds: check the Environment (`environment-check.sh`), then `bash scenarios/tools/secret-scope.sh run <owner/repo>`.

Pass condition: job outside logs both `length-zero=true`; job inside both `length-zero=false`; no secret value,
length number, or `-----BEGIN` in either log; record the two log lines verbatim.

Repeated on every test-bed after the change: enable `scenario-secret-scope.yml` and `scenario-secret-scope-called.yml`
for the run, disable them after.

Pass condition: the job inside the deployed called workflow declares the mapping form with `deployment: false`; the
same four length-zero lines; and the test-bed shows no `steward-publication` deployment created at or after the
repeated run's creation time. The first S17 sections stay as recorded; the repeated run gets its own S17 section.

Ambiguous or unavailable ownership and snapshot reads cannot be forced live without platform manipulation; they are
proved by fixture-tier tests with recorded responses.

## Results

One results file per test-bed under `results/<test-bed key>.md`. Each scenario section is headed `## S<nn> <short title>` (a scenario may have several sections), holds commands and verbatim output in `text` fences, and ends with a line `Result: pass` or `Result: fail`. Check a file with `results-check.sh`.

## Steady state

After the scenarios: `steward-pr.yml`, `steward-issues.yml`, and `scenario-*.yml` disabled on every test-bed
(`bash scenarios/tools/steady-state.sh <owner/repo> apply`; `scenario-secret-scope-called.yml` has no trigger of
its own and may stay active); no open `[scenario` issue or pull request.

What stays: the evidence branches, the evidence repository, the policy, the Environment, the wrapper files
(disabled), closed scenario issues and pull requests (never deleted), every Deployment and deployment status on the
test-beds, including those GitHub Actions created on the heads of org-public pull requests 32, 33, 34, 36, and 37
while the publication jobs used the plain form (never deleted), and, on org-public, the one-off check workflow
`.github/workflows/scenario-deployment-probe.yml` (disabled; it showed that `deployment: false` keeps the Environment
secrets and the branch restriction and creates no Deployment) and its branch `scenario-deployment-probe`. The
`scenario-*` disable rule covers that workflow.
