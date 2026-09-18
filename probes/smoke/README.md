# Smoke probe

The smoke probe proves the machinery every other probe workflow depends on: that a probe
workflow can be deployed to a test-bed repository, dispatched, and watched to completion, and
that inside the run an App installation token can be minted, a check run created and completed
under the test App, and an artifact uploaded and found again in the repository-wide artifact
listing. It runs before any probe that assumes those things work.

## What the workflow proves

`workflows/probe-smoke-machinery.yml` is `workflow_dispatch`-only, with inputs `nonce`
(required), `retention_canary` (boolean), and `copilot` (boolean).

- Job `machinery` mints an App installation token with `actions/create-github-app-token@v3`,
  uses it to create and complete a check run (`probe-smoke/machinery`, conclusion `neutral`) on
  the run's commit, writes a run summary, uploads it as artifact
  `probe-smoke-<run_id>-<run_attempt>`, and confirms that upload by finding the same artifact id
  in the repository-wide artifact listing. When `retention_canary=true` it also uploads artifact
  `probe-canary-retention` with `retention-days: 1`, to observe short-lived artifact expiry.
- Job `copilot` runs only when `copilot=true`. It installs the Copilot CLI and sends one prompt
  from an empty working directory with a fresh `COPILOT_HOME`, authenticated by the job's own
  `GITHUB_TOKEN`. This spends one budgeted Copilot prompt and must not be dispatched casually —
  omit `copilot` (or leave it `false`) unless the step you are running explicitly owns that budget.

Every fact the workflow establishes is logged as a line starting `PROBE-SMOKE `.

## Tools

- `tools/deploy.sh <owner/repo> <branch> <commit-message> <src>[:<dest>] ...`
  Clones the test-bed over SSH into a temporary directory outside this repository, commits the
  given files once, and pushes with up to 5 fetch-rebase-retry attempts (never force-pushing).
  Verifies every file by git blob identity against the test-bed's contents API. Prints
  `DEPLOY ...` lines. Exit 0: every file identical on the test-bed. Exit 1: push or identity
  failure. Exit 2: usage error.

- `tools/dispatch.sh <owner/repo> <workflow-file> <ref> [<input>=<value> ...]`
  Dispatches the workflow with a generated `nonce` input, finds the run it started by matching
  the nonce in the run's display title, and polls every 20 seconds for completion. Prints
  `DISPATCH ...` lines. Exit 0: the run completed (any conclusion — the caller judges it).
  Exit 1: dispatch failed or the run was not found. Exit 2: usage error. Exit 3: still running
  after the wait bound (continue with `wait-run.sh`).

- `tools/wait-run.sh <owner/repo> <run-id>`
  Keeps waiting for a run already dispatched, with the same polling and time bounds. Prints
  `WAIT ...` lines. Exit 0: completed. Exit 2: usage error. Exit 3: still running.

- `tools/steady-state.sh <owner/repo> plan|apply`
  Puts one test-bed into the suite's steady state: `apply` disables every `.github/workflows/probe-*.yml`
  workflow that is not `disabled_manually` and deletes every `probe-pa0N-head-*` branch, then re-reads the
  state; `plan` is read-only and prints what `apply` would change. Touches nothing else. Prints `STEADY ...`
  lines. Exit 0: plan printed, or apply left the repository steady. Exit 1: not steady after apply. Exit 2:
  usage error. Exit 3: a read failed.

## Procedure

```sh
bash probes/smoke/tools/deploy.sh <owner/repo> master "probe(smoke): deploy probe-smoke-machinery.yml" probes/smoke/workflows/probe-smoke-machinery.yml
bash probes/smoke/tools/dispatch.sh <owner/repo> probe-smoke-machinery.yml master retention_canary=true
```

If `dispatch.sh` exits 3 (still running), continue with:

```sh
bash probes/smoke/tools/wait-run.sh <owner/repo> <run-id>
```

Once the run has completed, collect the evidence with the local token:

```sh
gh run view <run-id> -R <owner/repo> --log | grep -a "PROBE-SMOKE"
gh run download <run-id> -R <owner/repo> -n probe-smoke-<run-id>-1 -D <dir>
cat <dir>/summary.txt
gh api repos/<owner/repo>/check-runs/<check-run-id> --jq '{id, name, status, conclusion, app_id: .app.id, head_sha}'
gh api "repos/<owner/repo>/actions/artifacts?name=probe-smoke-<run-id>-1" --jq '.artifacts[] | {id, name, created_at, expires_at}'
gh api "repos/<owner/repo>/actions/artifacts?name=probe-canary-retention" --jq '.artifacts[] | {id, name, created_at, expires_at}'
```

## Contract for every dispatchable probe workflow

Every workflow dispatched with `dispatch.sh` must declare a required string input `nonce` and
include `${{ inputs.nonce }}` in its `run-name`, so that concurrent dispatches of the same
workflow are never confused with one another.
