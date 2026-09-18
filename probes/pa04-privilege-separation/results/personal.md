# PA04 — Job privilege separation — personal

- assumption: PA04
- test-bed: jambolo/patch-steward-testbed-personal
- probed: 2026-09-25T02:09:39Z to 2026-09-25T11:22:16Z
- step: 2.16, 3.1, 4.4
- workflows: probe-pa04-callee.yml b925b8f4e43b0d23c071f260f630a0f0b789e3ba; probe-pa04-envs.yml 8b3721664ed5cd0feb3d5db58cab7a0af07c4f9e; probe-pa04-callee-perms.yml 7249ed976eec91ed295177e4c9f93e9c82c27958; probe-pa04-ceiling-omit-issues.yml 0f4d8deeff344d8d48ddc63936ffb90650a2c335; probe-pa04-ceiling-omit-copilot.yml 8da9a0726b2f255498f599503c8558287a2089df; probe-pa04-ceiling-grant.yml 33851887b47f2c25e627c312539d62ef22a08ce0; probe-pa04-callee-secrets.yml ad9d31dd878300842e1f367f7df92b392b450f0f; probe-pa04-w1-host-org-public.yml a1e6d844db83af22a72dc79b6bdc1db4ab306f17; probe-pa04-w2-host-org-public.yml 1736ba9f022fb91c01fcbc638320c1761c8791d4

## Results

| Sub-claim | Kind       | Result  | Cause | Evidence |
| --------- | ---------- | ------- | ----- | -------- |
| PA04.1    | assumption | refuted | none  | E1,E5,E6 |
| PA04.2    | assumption | refuted | none  | E2,E3,E4 |

## Measurements

| Sub-claim | Quantity | Value | Unit | Method | Samples |
| --------- | -------- | ----- | ---- | ------ | ------- |

## Evidence

### E1 — PA04.1: envs run, every leg's callee/with-env got an empty secret

https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085098011

```text
JOBS
caller-sibling completed success
local / without-env completed success
xrepo-org-public / with-env completed success
xrepo-org-public / without-env completed success
xrepo-personal / with-env completed success
caller-env completed success
local / with-env completed success
xrepo-personal / without-env completed success

FACTS
PROBE-PA04 leg=caller job=caller/with-env repository=jambolo/patch-steward-testbed-personal secret_length=26 secret_origin=personal
PROBE-PA04 leg=caller job=caller/sibling repository=jambolo/patch-steward-testbed-personal secret_length=0
PROBE-PA04 leg=local job=callee/with-env repository=jambolo/patch-steward-testbed-personal workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa04-envs.yml@refs/heads/master secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-org-public job=callee/with-env repository=jambolo/patch-steward-testbed-personal workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa04-envs.yml@refs/heads/master secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-personal job=callee/with-env repository=jambolo/patch-steward-testbed-personal workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa04-envs.yml@refs/heads/master secret_length=0 secret_origin=empty
PROBE-PA04 leg=local job=callee/without-env repository=jambolo/patch-steward-testbed-personal secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-org-public job=callee/without-env repository=jambolo/patch-steward-testbed-personal secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-personal job=callee/without-env repository=jambolo/patch-steward-testbed-personal secret_length=0 secret_origin=empty
```

caller/with-env resolved personal's own Environment secret (secret_length=26, secret_origin=personal;
caller/sibling read empty), confirming the sibling-isolation half of PA04.1. But no secret was passed on any of
the three `uses:` calls to probe-pa04-callee.yml, and every callee/with-env leg — local, xrepo-org-public, and
xrepo-personal alike — read an empty secret (secret_length=0, secret_origin=empty) despite declaring
`environment: probe-pa04-env` itself. This reproduces the org-public finding (results/org-public.md E1):
declaring an `environment` inside a called reusable workflow does not, by itself, resolve the caller repository's
Environment secret; the caller must still pass the secret explicitly (or `secrets: inherit`).

### E2 — PA04.2 omit-issues: run-level startup failure, no job ran

https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085159972

```text
DISPATCH conclusion=startup_failure
JOBS: (none — jobs API returned an empty list)
gh api .../runs/36085159972 --jq '{status,conclusion,event}'
{"conclusion":"startup_failure","event":"workflow_dispatch","status":"completed"}
```

The caller granted `contents: read` + `copilot-requests: write` and omitted `issues`; the called
probe-pa04-callee-perms.yml requests `issues: write` in job wants-issues. The whole run failed at startup before
any job — including the sibling `control` job, which carries no permission conflict — was scheduled. Matches
org-public E2.

### E3 — PA04.2 omit-copilot: run-level startup failure, no job ran

https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085197692

```text
DISPATCH conclusion=startup_failure
JOBS: (none — jobs API returned an empty list)
gh api .../runs/36085197692 --jq '{status,conclusion,event}'
{"conclusion":"startup_failure","event":"workflow_dispatch","status":"completed"}
```

The caller granted `contents: read` + `issues: write` and omitted `copilot-requests`; the called
probe-pa04-callee-perms.yml requests `copilot-requests: write` in job wants-copilot. Same run-level
startup_failure as E2: `control` did not run either. Matches org-public E3.

### E4 — PA04.2 grant: positive control, both callee jobs hold the requested scopes

https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085235474

```text
JOBS
control completed success
call / wants-issues completed success
call / wants-copilot completed success

FACTS
PROBE-PA04 leg=grant job=control ran=yes
PROBE-PA04 leg=grant job=callee-perms/wants-issues ran=yes requested=contents:read,issues:write
PROBE-PA04 leg=grant job=callee-perms/wants-copilot ran=yes requested=contents:read,copilot-requests:write

GITHUB_TOKEN Permissions — call / wants-issues
Contents: read
Issues: write
Metadata: read

GITHUB_TOKEN Permissions — call / wants-copilot
Contents: read
CopilotRequests: write
Metadata: read
```

Granting every requested scope lets both callee jobs run and hold exactly the scopes they asked for, so the omit
runs (E2, E3) discriminate rather than being an artifact of a broken callee. Matches org-public E4.

### E5 — Q4 re-probe: W1 explicit secrets mapping, callee hosted on org-public

https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36128934079

```text
DISPATCH requested workflow=probe-pa04-w1-host-org-public.yml ref=master nonce=n20260925T112125Z-74017-5266 attempt=1 utc=2026-09-25T11:21:27Z
DISPATCH run_id=36128934079 url=https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36128934079
DISPATCH completed run_id=36128934079 conclusion=success utc=2026-09-25T11:21:49Z
Q4-OUTCOME key=personal wiring=W1 host=org-public run=36128934079 conclusion=success caller_with_env=personal caller_sibling=empty callee_with_env=personal callee_without_env=empty

JOBS
caller-env completed success
caller-sibling completed success
call / with-env completed success
call / without-env completed success

FACTS
PROBE-PA04 leg=w1-host-org-public job=caller/with-env repository=jambolo/patch-steward-testbed-personal secret_length=26 secret_origin=personal
PROBE-PA04 leg=w1-host-org-public job=caller/sibling repository=jambolo/patch-steward-testbed-personal secret_length=0 secret_origin=empty
PROBE-PA04 leg=w1-host-org-public job=callee/with-env repository=jambolo/patch-steward-testbed-personal workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa04-w1-host-org-public.yml@refs/heads/master secret_length=26 secret_origin=personal
PROBE-PA04 leg=w1-host-org-public job=callee/without-env repository=jambolo/patch-steward-testbed-personal secret_length=0 secret_origin=empty
```

With an explicit `secrets:` mapping, the called job on the org-public-hosted callee resolved the CALLER's
(personal) Environment secret, not the host repository's; sibling isolation held (caller/sibling and
callee/without-env both empty).

### E6 — Q4 re-probe: W2 secrets inherit, callee hosted on org-public

https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36128974266

```text
DISPATCH requested workflow=probe-pa04-w2-host-org-public.yml ref=master nonce=n20260925T112152Z-74043-12758 attempt=1 utc=2026-09-25T11:21:55Z
DISPATCH run_id=36128974266 url=https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36128974266
DISPATCH completed run_id=36128974266 conclusion=success utc=2026-09-25T11:22:16Z
Q4-OUTCOME key=personal wiring=W2 host=org-public run=36128974266 conclusion=success caller_with_env=personal caller_sibling=empty callee_with_env=empty callee_without_env=empty

JOBS
caller-sibling completed success
caller-env completed success
call / with-env completed success
call / without-env completed success

FACTS
PROBE-PA04 leg=w2-host-org-public job=caller/sibling repository=jambolo/patch-steward-testbed-personal secret_length=0 secret_origin=empty
PROBE-PA04 leg=w2-host-org-public job=caller/with-env repository=jambolo/patch-steward-testbed-personal secret_length=26 secret_origin=personal
PROBE-PA04 leg=w2-host-org-public job=callee/with-env repository=jambolo/patch-steward-testbed-personal workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa04-w2-host-org-public.yml@refs/heads/master secret_length=0 secret_origin=empty
PROBE-PA04 leg=w2-host-org-public job=callee/without-env repository=jambolo/patch-steward-testbed-personal secret_length=0 secret_origin=empty
```

With `secrets: inherit`, the called job on the org-public-hosted callee read empty: inherit did not deliver the
caller's Environment secret because the calling ("call") job itself does not declare `environment`. Sibling
isolation held.

## Deviations from the design

- PA04.1 refuted: docs/architecture.md §6.4 states "environment secrets reach only the jobs that reference the
  environment ... no job references both", which this probe confirms for sibling jobs in the same run
  (caller/sibling read empty) but which does not extend to a called reusable workflow's job declaring the same
  Environment name without the secret being explicitly passed: every callee/with-env leg (E1) read an empty
  secret instead of resolving the caller's Environment. Same result as org-public (step 2.4).
- PA04.2 refuted: docs/architecture.md §6.4 states "Reusable workflows cannot exceed the caller's permissions,
  so the wrapper templates grant `copilot-requests: write` to `intake` and `assess`; a wrapper that drops it
  makes those jobs end `inconclusive`." Both omission scenarios (E2, E3) instead ended the whole run in
  `startup_failure` before any job — including the unrelated sibling `control` job — was scheduled; no job ever
  ran to reach an `inconclusive` outcome. Same result as org-public (step 2.4).

## Residue

Environment `probe-pa04-env` on jambolo/patch-steward-testbed-personal (reused, holds DUMMY marker
`probe-pa04-marker-personal`); workflows probe-pa04-callee.yml, probe-pa04-envs.yml, probe-pa04-callee-perms.yml,
probe-pa04-ceiling-omit-issues.yml, probe-pa04-ceiling-omit-copilot.yml, probe-pa04-ceiling-grant.yml on
jambolo/patch-steward-testbed-personal `master` (already present from step 2.4; unchanged by this step).
Callers probe-pa04-w1-host-org-public.yml and probe-pa04-w2-host-org-public.yml deployed on
jambolo/patch-steward-testbed-personal `master` (step 4.4); callee probe-pa04-callee-secrets.yml hosted on
jambolo/patch-steward-testbed-personal `master` (deployed step 4.1, for other test-beds' legs; unchanged here).
Runs 36128934079 (W1) and 36128974266 (W2).
