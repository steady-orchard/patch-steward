# Platform-assumption probes

This directory holds a re-runnable suite that verifies nine GitHub/Copilot platform assumptions
(identifiers `PA01`-`PA09`, sub-claims `PA0N.M`) against three disposable test-bed repositories. It exists
as a regression suite against platform drift: it is not product code, is not a workspace package, and never
runs in this repository's CI.

## Layout

- `probes/README.md` — this file.
- `probes/testbeds.md` — test-bed and fixture inventory, capability matrix with evidence, owner actions.
- `probes/findings.md` — findings record: roll-up, per-cell results, measured limits, dispositions.
- `probes/smoke/` — `README.md`, `workflows/*.yml`, `tools/*.sh`, `results/<testbed-key>.md`.
- `probes/pa0N-<slug>/` — one per assumption: `README.md` (sub-claims, fixtures, deployment list, exact
  procedure), `workflows/*.yml` (canonical source of every deployed workflow), `fixtures/**` (any other
  deployed file), `results/<testbed-key>.md`.

Slugs: `pa01-required-checks`, `pa02-ownership-artifacts`, `pa03-trusted-triggers`,
`pa04-privilege-separation`, `pa05-rounds-concurrency`, `pa06-merge-queue-relay`, `pa07-app-token-writes`,
`pa08-copilot-inference`, `pa09-run-list-caps`.

Test-bed keys: `org-public` (`steady-orchard/patch-steward-testbed-public`), `org-private`
(`steady-orchard/patch-steward-testbed-private`), `personal` (`jambolo/patch-steward-testbed-personal`);
default branch `master` on all.

Allowed file types: Markdown, YAML, JSON, plain text, `.sh`; `.mjs` only if `pnpm lint` passes unmodified;
no `.ts`; no dependency added to any `package.json`.

Shared tools in `probes/smoke/tools/`: `deploy.sh`, `dispatch.sh`, `wait-run.sh`, `environment.sh`,
`capabilities.sh`, `steady-state.sh`.

## Naming and isolation

Every fixture is attributable by name: branches `probe-pa0N-base[-x]` (PR targets) and
`probe-pa0N-head-*` (PR heads); issue/PR titles start `[probe PA0N]`; check runs `probe-pa0N/<purpose>`;
Environments, rulesets `probe-pa0N-<purpose>`; labels `probe-pa0N:<x>`; concurrency groups and artifacts
`probe-pa0N-<x>`; capability canaries `probe-canary-<x>`; smoke `probe-smoke-<x>`. Only `PA02` may also use
the literal artifact names `steward-ownership-...`.

Deployed workflow file names start `probe-` and are unique suite-wide. Rulesets target ONLY
`refs/heads/probe-*`; never `~DEFAULT_BRANCH`, `~ALL`, or `master`. PRs target a `probe-pa0N-base` branch,
never `master`, unless a sub-claim is about the default branch. All probes share `master` for workflow
files and nothing else. Every event-triggered workflow starts with a job-level `if` matching only its own
marker.

One fork is permitted: `jambolo/patch-steward-testbed-public`, a PR-head-only fixture; no workflow enabled
there, App not installed there; no other fork.

## Deployment

Clone over SSH into a temp dir OUTSIDE this repository; never add a clone, submodule, or subtree here. One
commit per deployment, message `probe(PA0N): deploy <file names>`; push to `master` with at most 5
fetch-rebase-retry attempts; never force-push `master`, never rewrite history; force-push only on
`probe-pa0N-head-*`.

Never write workflow files through the REST contents API, never merge through the API a PR that changes
workflow files, never `gh repo sync` (the token has no `workflow` scope); on a refusal record it verbatim
and raise an owner action.

Validate first:

```text
actionlint -ignore 'unknown permission scope "copilot-requests"' <file>
```

Verify byte identity after:

```text
test "$(git rev-parse HEAD:probes/<dir>/workflows/<file>)" = "$(gh api repos/<owner>/<repo>/contents/.github/workflows/<file> --jq .sha)"
```

(`core.autocrlf=true`: compare blob ids, never working-tree bytes.)

Tool: `probes/smoke/tools/deploy.sh`.

## Workflow safety rules

The public test-beds accept issues, comments, PRs from anyone. Never check out, build, or execute PR head
content. Never pass event text through `${{ }}` into `run:`; pass via `env:` as data.

A job using a secret or minting an App token on an event trigger runs only for allowlisted senders
`jambolo` or `patch-steward-testbed[bot]`. A workflow that writes with the App token must not react to
App-bot events; only a write-free listener may.

Never print tokens or secrets; verify delivery by length or SHA-256 of a known dummy. Environment secrets
are dummy markers set with `gh secret set --env`; the real App key stays a repository secret.

Only `actions/*` actions, pinned to a major tag or full SHA; every job declares least-privilege
`permissions`.

Copilot probes: empty working directory outside any checkout, fresh `COPILOT_HOME`, no MCP servers, no
tool allowed, prompts without repository content or secrets.

## Running and budgets

Poll no more often than every 20 s. Bound every wait: 15 min for an ordinary run, 60 min for a scheduled
trigger, 30 min for a merge-queue transition, 50 min for a cap session run.

Before a polling loop, check `gh api rate_limit --jq .resources.core.remaining` and stop if it is below 500.

A probe that does not run because its own workflow or commands are wrong is a failure, never
`undetermined`; after 3 deploy-fix iterations on one workflow, stop with the last error verbatim.

Standard Copilot budget (everything except the cap step): at most 24 prompts per suite run — one
`copilot -p` invocation or one SDK send each; the smoke probe at most 2, each at most 200 characters,
asking for a one-word answer; no retry beyond one; every request logged as `copilot_request_utc=<UTC>`
immediately before it is sent and recorded in the result file.

Early exhaustion: a standard prompt failing with a shape that names the allowance, quota, credits, or a
plan limit is recorded verbatim; no further Copilot request on that account; unfinished cells
`undetermined`/`blocked`; nothing works around an exhausted allowance.

`org-private` stays under 300 billed Actions minutes per suite run (the Free plan grants 2,000 per month).

Scheduled fixtures: cron interval of at least 15 min; disabled as soon as one scheduled run is captured;
disabled on `org-private` before pausing for an owner action; never left enabled at the end of a run. Dates
and times are UTC, ISO 8601.

The Copilot cap step (personal only), in order: observe the session soft cap (PA08.5); exhaust the Copilot
Free included allowance and record the failure shape (PA08.3 part (c)); repeat the PA08.6 reads once while
exhausted. It is the last activity of a run that may send a Copilot request and starts only after every
other Copilot request of the run is recorded and verified: after exhaustion, no Copilot reply is obtainable
on the account until the monthly reset (00:00:00 UTC on the first day of the next calendar month).

A cap session is one workflow run holding one SDK session created with `sessionLimits: { maxAiCredits: 30 }`
(the documented minimum); before the first cap session, one probe session requests `maxAiCredits: 1` (at
most 5 sends, not counted in `S`).

Burn prompts: synthetic filler generated in the job with a unique leading nonce, no repository or event
content, no secrets, no tools, asking for a one-word answer, sized so one send costs at least 0.75 AI
credits (about 40,000 uncached input tokens on the cheapest model); if the first send reports less, or the
runtime rejects the size, resize at most twice, else stop with a deviation; if no usage is reported,
continue on the send and time bounds.

Hard bounds, all binding at once: at most `S = 10` cap sessions (a fixed owner ceiling; no eleventh
session; a continuation needs a new owner decision); at most 40 sends per cap session and 5 sends in the
probe session, at most 405 sends in total (`40 × S + 5`); every session job declares `timeout-minutes: 45`;
wait at most 50 min for one run; consecutive sessions start at least 60 s apart; after a failed send wait
at least 5 min, retry once, then stop.

Stop reasons (closed set): `allowance-exhausted` (a send failed twice, at least 5 min apart, naming the
allowance, quota, credits, or a plan limit); `ceiling-reached` (all `S = 10` cap sessions ran and sends
still succeed); `exhausted-before-start` (the very first send failed that way twice); `blocked` (any other
failure that survived the one retry).

Never enable additional usage, set a Copilot spending budget, change the account's Copilot plan, or
continue with another account or a personal access token after exhaustion.

## Results and evidence

Result file sections: header bullets (assumption, test-bed, probed, step, workflows with blob SHA),
`## Results` (`| Sub-claim | Kind | Result | Cause | Evidence |`), `## Measurements`, `## Evidence`
(`### E1 — ...`), `## Deviations from the design`, `## Residue`.

Kind: `assumption`, `measurement`, `fixed` (smoke rows use `setup`). Result: `confirmed`, `refuted`,
`undetermined`. Cause: `none`, or for `undetermined` one of `plan-unavailable`, `pd03`, `blocked`,
`ambiguous`. `undetermined` never replaces an unattempted probe.

Evidence is verbatim and minimal, fenced with language `text` (never json/yaml), `<=60` lines per block,
elided with `[... N lines elided ...]`, with run URLs/API paths. Redact tokens, keys, secrets, non-noreply
emails; from `org-private` record only names, ids, URLs, states, timestamps.

Capability matrix cell values (this legend lives HERE, never in `testbeds.md`): `available`,
`unavailable`, `owner-action-pending`, `owner-action-done`, `owner-declined`, `not-applicable`.

## Steady state

Every `probe-*` workflow on every test-bed disabled (`gh workflow disable`, state `disabled_manually`). No
open issue or PR with `probe` in the title (closed, not deleted). `probe-pa0N-head-*` branches deleted;
`probe-pa0N-base*` branches, Environments, rulesets, labels, and the fork stay, listed in `testbeds.md`. The
fork `jambolo/patch-steward-testbed-public` keeps its PR-head branches: the tool below runs on the three
test-beds only, never on the fork.

Per test-bed, from the repository root, run one standalone command each:

```text
bash probes/smoke/tools/steady-state.sh <owner/repo> plan
bash probes/smoke/tools/steady-state.sh <owner/repo> apply
```

`plan` is read-only and prints what `apply` would change. Verify with:

```text
gh workflow list -R <owner/repo> --all --json path,state --jq '.[] | select(.path | startswith(".github/workflows/probe-")) | select(.state != "disabled_manually") | .path'
gh issue list -R <owner/repo> --state open --search "probe in:title" --json number --jq length
gh pr list -R <owner/repo> --state open --search "probe in:title" --json number --jq length
gh api repos/<owner/repo>/branches --paginate --jq '.[].name'
```

Expected: nothing; `0`; `0`; no `probe-pa0N-head-` name. Kept fixtures are listed in `testbeds.md`
`## Fixtures`.

## Drift re-run

Detects platform drift against the recorded results. Preconditions: `gh` authenticated as a test-bed
administrator (`repo` scope); an SSH key configured for `git push`; every command run from the repository
root; every GitHub write issued as one standalone command with literal values.

| Probe                     | Workflow                            | Test-beds                         |
| ------------------------- | ----------------------------------- | --------------------------------- |
| pa01-required-checks      | probe-pa01-sequence.yml             | org-public, personal              |
| pa02-ownership-artifacts  | probe-pa02-upload.yml               | org-public, org-private           |
| pa02-ownership-artifacts  | probe-pa02-list.yml                 | org-public, org-private           |
| pa03-trusted-triggers     | probe-pa03-schedule.yml             | org-public, org-private, personal |
| pa03-trusted-triggers     | probe-pa03-schedule-env.yml         | org-public, org-private, personal |
| pa03-trusted-triggers     | probe-pa03-events.yml               | org-public, org-private, personal |
| pa03-trusted-triggers     | probe-pa03-upstream.yml             | org-public, org-private, personal |
| pa04-privilege-separation | probe-pa04-callee.yml               | org-public, org-private, personal |
| pa04-privilege-separation | probe-pa04-envs.yml                 | org-public, org-private, personal |
| pa04-privilege-separation | probe-pa04-callee-perms.yml         | org-public, org-private, personal |
| pa04-privilege-separation | probe-pa04-ceiling-omit-issues.yml  | org-public, org-private, personal |
| pa04-privilege-separation | probe-pa04-ceiling-omit-copilot.yml | org-public, org-private, personal |
| pa04-privilege-separation | probe-pa04-ceiling-grant.yml        | org-public, org-private, personal |
| pa04-privilege-separation | probe-pa04-pipeline.yml             | org-public                        |
| pa04-privilege-separation | probe-pa04-publish.yml              | org-public                        |
| pa04-privilege-separation | probe-pa04-callee-secrets.yml       | org-public, personal              |
| pa04-privilege-separation | probe-pa04-w1-host-org-public.yml   | org-private, personal             |
| pa04-privilege-separation | probe-pa04-w2-host-org-public.yml   | org-private, personal             |
| pa04-privilege-separation | probe-pa04-w1-host-personal.yml     | org-public, org-private           |
| pa04-privilege-separation | probe-pa04-w2-host-personal.yml     | org-public, org-private           |
| pa05-rounds-concurrency   | probe-pa05-rounds.yml               | org-public                        |
| pa05-rounds-concurrency   | probe-pa05-run.yml                  | org-public                        |
| pa05-rounds-concurrency   | probe-pa05-concurrency.yml          | org-public                        |
| pa06-merge-queue-relay    | probe-pa06-relay.yml                | org-public                        |
| pa06-merge-queue-relay    | probe-pa06-steward.yml              | org-public                        |
| pa06-merge-queue-relay    | probe-pa06-control.yml              | org-public                        |
| pa07-app-token-writes     | probe-pa07-listen.yml               | org-public, org-private, personal |
| pa07-app-token-writes     | probe-pa07-write.yml                | org-public, org-private, personal |
| pa08-copilot-inference    | probe-pa08-infer.yml                | org-public, org-private, personal |
| pa09-run-list-caps        | probe-pa09-listen.yml               | org-public                        |
| pa09-run-list-caps        | probe-pa09-follow.yml               | org-public                        |
| pa09-run-list-caps        | probe-pa09-act.yml                  | org-public                        |
| pa09-run-list-caps        | probe-pa09-count.yml                | org-public                        |
| smoke                     | probe-smoke-machinery.yml           | org-public, org-private, personal |

`probe-pa08-cap.yml` (personal) is not part of the routine re-run — owner approval required: consumes the repository owner's whole monthly Copilot allowance.

Numbered steps per probe, smoke first on each test-bed:

1. Enable each of its workflows on each listed test-bed:

   ```text
   gh api repos/<owner>/<repo>/actions/workflows/<file>/enable -X PUT
   ```

2. Deploy:

   ```text
   bash probes/smoke/tools/deploy.sh <owner/repo> master "probe(PA0N): deploy <files>" probes/<dir>/workflows/<file> ...
   ```

   (plus the probe's fixtures as its README says), then verify byte identity:

   ```text
   test "$(git rev-parse HEAD:probes/<dir>/workflows/<file>)" = "$(gh api repos/<owner>/<repo>/contents/.github/workflows/<file> --jq .sha)"
   ```

3. Run: exactly the probe README `## Procedure`, with fixtures created or reused, within the budgets of
   `## Running and budgets`; for PA03 scheduled workflows wait at most 60 min for one scheduled run, record
   it, then disable it; `probe-pa08-infer.yml` and the smoke workflow's `copilot=true` input spend standard
   Copilot prompts.

4. Compare: write the re-run's result file in the result format to a scratch path outside the repository,
   then:

   ```text
   diff <(grep -E '^\| PA0[1-9]\.[0-9]+ +\| (assumption|measurement|fixed) +\|' <recorded> | cut -d'|' -f2-5 | tr -d ' ') <(grep -E '^\| PA0[1-9]\.[0-9]+ +\| (assumption|measurement|fixed) +\|' <new> | cut -d'|' -f2-5 | tr -d ' ')
   ```

   No output means no drift. Any line means drift: replace the recorded file in one commit that says so,
   update `probes/findings.md`, and take the changed cells to the project owner as a decision.

5. Disable: per test-bed

   ```text
   bash probes/smoke/tools/steady-state.sh <owner/repo> apply
   ```

   then the verification commands of `## Steady state`.

## Owner actions

The suite never changes App registration/permissions/installations, reads or rotates real secrets, changes
org/account settings, billing, plans, or Copilot policies, deletes repositories or issues, or enables a
paid feature.

Try the API first; when it refuses or cannot express a setting, do not guess a UI path: record the refusal
verbatim and add an entry to `testbeds.md` `## Owner actions` with status, settings page URL, exact values,
and the verifying command with expected output. A declined action makes the affected cells
`undetermined`/`blocked`.
