# PA04 — Job privilege separation — org-private

- assumption: PA04
- test-bed: steady-orchard/patch-steward-testbed-private
- probed: 2026-09-25T02:09:32Z to 2026-09-25T11:22:57Z
- step: 2.15, 4.3
- workflows: probe-pa04-callee.yml b925b8f4e43b0d23c071f260f630a0f0b789e3ba; probe-pa04-envs.yml 8b3721664ed5cd0feb3d5db58cab7a0af07c4f9e; probe-pa04-callee-perms.yml 7249ed976eec91ed295177e4c9f93e9c82c27958; probe-pa04-ceiling-omit-issues.yml 0f4d8deeff344d8d48ddc63936ffb90650a2c335; probe-pa04-ceiling-omit-copilot.yml 8da9a0726b2f255498f599503c8558287a2089df; probe-pa04-ceiling-grant.yml 33851887b47f2c25e627c312539d62ef22a08ce0; probe-pa04-w1-host-org-public.yml a1e6d844db83af22a72dc79b6bdc1db4ab306f17; probe-pa04-w2-host-org-public.yml 1736ba9f022fb91c01fcbc638320c1761c8791d4; probe-pa04-w1-host-personal.yml fa438e33532e805e278f1cf122e5b5925aababac; probe-pa04-w2-host-personal.yml 4afcce17c05ad233d203713c71272da933ea9e69

## Results

| Sub-claim | Kind       | Result  | Cause | Evidence       |
| --------- | ---------- | ------- | ----- | -------------- |
| PA04.1    | assumption | refuted | none  | E1,E5,E6,E7,E8 |
| PA04.2    | assumption | refuted | none  | E2,E3,E4       |

## Measurements

| Sub-claim | Quantity | Value | Unit | Method | Samples |
| --------- | -------- | ----- | ---- | ------ | ------- |

## Evidence

### E1 — PA04.1: envs run, every leg's callee/with-env got an empty secret

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085093481

```text
JOBS
caller-sibling completed success
xrepo-org-public / without-env completed success
caller-env completed success
local / without-env completed success
xrepo-org-public / with-env completed success
local / with-env completed success
xrepo-personal / without-env completed success
xrepo-personal / with-env completed success

FACTS
PROBE-PA04 leg=caller job=caller/with-env repository=steady-orchard/patch-steward-testbed-private secret_length=29 secret_origin=org-private
PROBE-PA04 leg=caller job=caller/sibling repository=steady-orchard/patch-steward-testbed-private secret_length=0
PROBE-PA04 leg=local job=callee/with-env repository=steady-orchard/patch-steward-testbed-private workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa04-envs.yml@refs/heads/master secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-org-public job=callee/with-env repository=steady-orchard/patch-steward-testbed-private workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa04-envs.yml@refs/heads/master secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-personal job=callee/with-env repository=steady-orchard/patch-steward-testbed-private workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa04-envs.yml@refs/heads/master secret_length=0 secret_origin=empty
PROBE-PA04 leg=local job=callee/without-env repository=steady-orchard/patch-steward-testbed-private secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-org-public job=callee/without-env repository=steady-orchard/patch-steward-testbed-private secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-personal job=callee/without-env repository=steady-orchard/patch-steward-testbed-private secret_length=0 secret_origin=empty
```

caller/with-env resolved org-private's own Environment secret (secret_length=29, secret_origin=org-private;
caller/sibling read empty), confirming the sibling-isolation half of PA04.1 on this Free-plan private repository.
But no secret was passed on any of the three `uses:` calls to probe-pa04-callee.yml, and every callee/with-env
leg — local, xrepo-org-public, and xrepo-personal alike — read an empty secret (secret_length=0,
secret_origin=empty) despite declaring `environment: probe-pa04-env` itself, matching org-public (step 2.4, E1).
Declaring an `environment` inside a called reusable workflow does not, by itself, resolve the caller repository's
Environment secret; the caller must still pass the secret explicitly (or `secrets: inherit`).

### E2 — PA04.2 omit-issues: run-level startup failure, no job ran

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085145726

```text
DISPATCH conclusion=startup_failure
JOBS: (none — jobs API returned an empty list)
gh api .../runs/36085145726 --jq '{status,conclusion,event}'
{"conclusion":"startup_failure","event":"workflow_dispatch","status":"completed"}
gh run view 36085145726: "This run likely failed because of a workflow file issue."
```

The caller granted `contents: read` + `copilot-requests: write` and omitted `issues`; the called
probe-pa04-callee-perms.yml requests `issues: write` in job wants-issues. The whole run failed at startup before
any job — including the sibling `control` job, which carries no permission conflict — was scheduled.

### E3 — PA04.2 omit-copilot: run-level startup failure, no job ran

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085187495

```text
DISPATCH conclusion=startup_failure
JOBS: (none — jobs API returned an empty list)
gh api .../runs/36085187495 --jq '{status,conclusion,event}'
{"conclusion":"startup_failure","event":"workflow_dispatch","status":"completed"}
```

The caller granted `contents: read` + `issues: write` and omitted `copilot-requests`; the called
probe-pa04-callee-perms.yml requests `copilot-requests: write` in job wants-copilot. Same run-level
startup_failure as E2: `control` did not run either.

### E4 — PA04.2 grant: positive control, both callee jobs hold the requested scopes

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085226934

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
runs (E2, E3) discriminate rather than being an artifact of a broken callee.

### E5 — Q4 re-probe: W1 explicit secrets mapping, callee hosted on org-public

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36128907572

```text
DISPATCH requested workflow=probe-pa04-w1-host-org-public.yml ref=master nonce=n20260925T112107Z-73949-20517 attempt=1 utc=2026-09-25T11:21:10Z
DISPATCH run_id=36128907572 url=https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36128907572
DISPATCH completed run_id=36128907572 conclusion=success utc=2026-09-25T11:21:31Z
Q4-OUTCOME key=org-private wiring=W1 host=org-public run=36128907572 conclusion=success caller_with_env=org-private caller_sibling=empty callee_with_env=org-private callee_without_env=empty

JOBS
caller-env completed success
caller-sibling completed success
call / with-env completed success
call / without-env completed success

FACTS
PROBE-PA04 leg=w1-host-org-public job=caller/with-env repository=steady-orchard/patch-steward-testbed-private secret_length=29 secret_origin=org-private
PROBE-PA04 leg=w1-host-org-public job=caller/sibling repository=steady-orchard/patch-steward-testbed-private secret_length=0 secret_origin=empty
PROBE-PA04 leg=w1-host-org-public job=callee/with-env repository=steady-orchard/patch-steward-testbed-private workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa04-w1-host-org-public.yml@refs/heads/master secret_length=29 secret_origin=org-private
PROBE-PA04 leg=w1-host-org-public job=callee/without-env repository=steady-orchard/patch-steward-testbed-private secret_length=0 secret_origin=empty
```

With an explicit `secrets:` mapping, the called job on the org-public-hosted callee resolved the CALLER's
(org-private) Environment secret, not the host repository's; sibling isolation held (caller/sibling and
callee/without-env both empty).

### E6 — Q4 re-probe: W2 secrets inherit, callee hosted on org-public

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36128949937

```text
DISPATCH requested workflow=probe-pa04-w2-host-org-public.yml ref=master nonce=n20260925T112136Z-74030-27314 attempt=1 utc=2026-09-25T11:21:39Z
DISPATCH run_id=36128949937 url=https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36128949937
DISPATCH completed run_id=36128949937 conclusion=success utc=2026-09-25T11:22:00Z
Q4-OUTCOME key=org-private wiring=W2 host=org-public run=36128949937 conclusion=success caller_with_env=org-private caller_sibling=empty callee_with_env=org-private callee_without_env=empty

JOBS
caller-sibling completed success
call / with-env completed success
caller-env completed success
call / without-env completed success

FACTS
PROBE-PA04 leg=w2-host-org-public job=caller/sibling repository=steady-orchard/patch-steward-testbed-private secret_length=0 secret_origin=empty
PROBE-PA04 leg=w2-host-org-public job=callee/with-env repository=steady-orchard/patch-steward-testbed-private workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa04-w2-host-org-public.yml@refs/heads/master secret_length=29 secret_origin=org-private
PROBE-PA04 leg=w2-host-org-public job=caller/with-env repository=steady-orchard/patch-steward-testbed-private secret_length=29 secret_origin=org-private
PROBE-PA04 leg=w2-host-org-public job=callee/without-env repository=steady-orchard/patch-steward-testbed-private secret_length=0 secret_origin=empty
```

With `secrets: inherit`, the called job on the org-public-hosted callee also resolved the CALLER's (org-private)
Environment secret, unlike the same wiring against the personal-owned host (E8); the two callee repositories
share the steady-orchard organization with the caller, while the personal host does not.

### E7 — Q4 re-probe: W1 explicit secrets mapping, callee hosted on personal

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36128992926

```text
DISPATCH requested workflow=probe-pa04-w1-host-personal.yml ref=master nonce=n20260925T112204Z-74056-5766 attempt=1 utc=2026-09-25T11:22:06Z
DISPATCH run_id=36128992926 url=https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36128992926
DISPATCH completed run_id=36128992926 conclusion=success utc=2026-09-25T11:22:28Z
Q4-OUTCOME key=org-private wiring=W1 host=personal run=36128992926 conclusion=success caller_with_env=org-private caller_sibling=empty callee_with_env=org-private callee_without_env=empty

JOBS
caller-sibling completed success
caller-env completed success
call / with-env completed success
call / without-env completed success

FACTS
PROBE-PA04 leg=w1-host-personal job=caller/sibling repository=steady-orchard/patch-steward-testbed-private secret_length=0 secret_origin=empty
PROBE-PA04 leg=w1-host-personal job=caller/with-env repository=steady-orchard/patch-steward-testbed-private secret_length=29 secret_origin=org-private
PROBE-PA04 leg=w1-host-personal job=callee/with-env repository=steady-orchard/patch-steward-testbed-private workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa04-w1-host-personal.yml@refs/heads/master secret_length=29 secret_origin=org-private
PROBE-PA04 leg=w1-host-personal job=callee/without-env repository=steady-orchard/patch-steward-testbed-private secret_length=0 secret_origin=empty
```

With an explicit `secrets:` mapping, the called job on the personal-hosted callee resolved the CALLER's
(org-private) Environment secret, not the host repository's; sibling isolation held (caller/sibling and
callee/without-env both empty).

### E8 — Q4 re-probe: W2 secrets inherit, callee hosted on personal

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36129037034

```text
DISPATCH requested workflow=probe-pa04-w2-host-personal.yml ref=master nonce=n20260925T112232Z-74087-22732 attempt=1 utc=2026-09-25T11:22:35Z
DISPATCH run_id=36129037034 url=https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36129037034
DISPATCH completed run_id=36129037034 conclusion=success utc=2026-09-25T11:22:57Z
Q4-OUTCOME key=org-private wiring=W2 host=personal run=36129037034 conclusion=success caller_with_env=org-private caller_sibling=empty callee_with_env=empty callee_without_env=empty

JOBS
caller-env completed success
caller-sibling completed success
call / without-env completed success
call / with-env completed success

FACTS
PROBE-PA04 leg=w2-host-personal job=caller/with-env repository=steady-orchard/patch-steward-testbed-private secret_length=29 secret_origin=org-private
PROBE-PA04 leg=w2-host-personal job=caller/sibling repository=steady-orchard/patch-steward-testbed-private secret_length=0 secret_origin=empty
PROBE-PA04 leg=w2-host-personal job=callee/without-env repository=steady-orchard/patch-steward-testbed-private secret_length=0 secret_origin=empty
PROBE-PA04 leg=w2-host-personal job=callee/with-env repository=steady-orchard/patch-steward-testbed-private workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa04-w2-host-personal.yml@refs/heads/master secret_length=0 secret_origin=empty
```

With `secrets: inherit` against the personal-owned host, the called job's Environment secret was not delivered
(secret_length=0, secret_origin=empty), matching the same wiring on org-public (step 4.1, E9); sibling isolation
still held (caller/sibling and callee/without-env both empty).

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

- Environment probe-pa04-env on steady-orchard/patch-steward-testbed-private (deployment-branch policy: master
  only; DUMMY secret PROBE_PA04_ENV_MARKER = probe-pa04-marker-org-private).
- Deployed workflows: .github/workflows/probe-pa04-callee.yml, probe-pa04-envs.yml, probe-pa04-callee-perms.yml,
  probe-pa04-ceiling-omit-issues.yml, probe-pa04-ceiling-omit-copilot.yml, probe-pa04-ceiling-grant.yml on
  steady-orchard/patch-steward-testbed-private master.
- Runs: 36085093481, 36085145726, 36085187495, 36085226934 on steady-orchard/patch-steward-testbed-private.
- Q4 re-probe (step 4.3): deployed .github/workflows/probe-pa04-w1-host-org-public.yml,
  probe-pa04-w2-host-org-public.yml, probe-pa04-w1-host-personal.yml, probe-pa04-w2-host-personal.yml on
  steady-orchard/patch-steward-testbed-private master. Runs: 36128907572, 36128949937, 36128992926, 36129037034.
