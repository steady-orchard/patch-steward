# PA04 — Job privilege separation — org-public

- assumption: PA04
- test-bed: steady-orchard/patch-steward-testbed-public
- probed: 2026-09-25T01:15:53Z to 2026-09-25T08:27:20Z
- step: 2.4, 4.1
- workflows: probe-pa04-callee.yml b925b8f4e43b0d23c071f260f630a0f0b789e3ba; probe-pa04-envs.yml 8b3721664ed5cd0feb3d5db58cab7a0af07c4f9e; probe-pa04-callee-perms.yml 7249ed976eec91ed295177e4c9f93e9c82c27958; probe-pa04-ceiling-omit-issues.yml 0f4d8deeff344d8d48ddc63936ffb90650a2c335; probe-pa04-ceiling-omit-copilot.yml 8da9a0726b2f255498f599503c8558287a2089df; probe-pa04-ceiling-grant.yml 33851887b47f2c25e627c312539d62ef22a08ce0; probe-pa04-pipeline.yml 42d9bd1f3904afbaecd108257daf7c29c252a4cd; probe-pa04-publish.yml c7af91e4a361a082a6600726a0c8db66b8f5b127; probe-pa04-callee-secrets.yml ad9d31dd878300842e1f367f7df92b392b450f0f; probe-pa04-w1-host-personal.yml fa438e33532e805e278f1cf122e5b5925aababac; probe-pa04-w2-host-personal.yml 4afcce17c05ad233d203713c71272da933ea9e69

## Results

| Sub-claim | Kind       | Result    | Cause | Evidence |
| --------- | ---------- | --------- | ----- | -------- |
| PA04.1    | assumption | refuted   | none  | E1,E8,E9 |
| PA04.2    | assumption | refuted   | none  | E2,E3,E4 |
| PA04.3    | assumption | confirmed | none  | E5,E6    |
| PA04.4    | assumption | refuted   | none  | E7       |

## Measurements

| Sub-claim | Quantity | Value | Unit | Method | Samples |
| --------- | -------- | ----- | ---- | ------ | ------- |

## Evidence

### E1 — PA04.1: envs run, every leg's callee/with-env got an empty secret

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081250289

```text
JOBS
caller-env completed success
xrepo-personal / with-env completed success
caller-sibling completed success
xrepo-org-public / with-env completed success
local / with-env completed success
local / without-env completed success
xrepo-org-public / without-env completed success
xrepo-personal / without-env completed success

FACTS
PROBE-PA04 leg=caller job=caller/with-env repository=steady-orchard/patch-steward-testbed-public secret_length=28 secret_origin=org-public
PROBE-PA04 leg=caller job=caller/sibling repository=steady-orchard/patch-steward-testbed-public secret_length=0
PROBE-PA04 leg=local job=callee/with-env repository=steady-orchard/patch-steward-testbed-public workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa04-envs.yml@refs/heads/master secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-org-public job=callee/with-env repository=steady-orchard/patch-steward-testbed-public workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa04-envs.yml@refs/heads/master secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-personal job=callee/with-env repository=steady-orchard/patch-steward-testbed-public workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa04-envs.yml@refs/heads/master secret_length=0 secret_origin=empty
PROBE-PA04 leg=local job=callee/without-env repository=steady-orchard/patch-steward-testbed-public secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-org-public job=callee/without-env repository=steady-orchard/patch-steward-testbed-public secret_length=0 secret_origin=empty
PROBE-PA04 leg=xrepo-personal job=callee/without-env repository=steady-orchard/patch-steward-testbed-public secret_length=0 secret_origin=empty
```

caller/with-env resolved org-public's own Environment secret (secret_length=28, secret_origin=org-public;
caller/sibling read empty), confirming the sibling-isolation half of PA04.1. But no secret was passed on any of
the three `uses:` calls to probe-pa04-callee.yml, and every callee/with-env leg — local, xrepo-org-public, and
xrepo-personal alike — read an empty secret (secret_length=0, secret_origin=empty) despite declaring
`environment: probe-pa04-env` itself. Declaring an `environment` inside a called reusable workflow does not, by
itself, resolve the caller repository's Environment secret; the caller must still pass the secret explicitly (or
`secrets: inherit`).

### E2 — PA04.2 omit-issues: run-level startup failure, no job ran

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081332331

```text
DISPATCH conclusion=startup_failure
JOBS: (none — jobs API returned an empty list)
gh api .../runs/36081332331 --jq '{status,conclusion,event}'
{"conclusion":"startup_failure","event":"workflow_dispatch","status":"completed"}
gh run view 36081332331: "This run likely failed because of a workflow file issue."
```

The caller granted `contents: read` + `copilot-requests: write` and omitted `issues`; the called
probe-pa04-callee-perms.yml requests `issues: write` in job wants-issues. The whole run failed at startup before
any job — including the sibling `control` job, which carries no permission conflict — was scheduled.

### E3 — PA04.2 omit-copilot: run-level startup failure, no job ran

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081383233

```text
DISPATCH conclusion=startup_failure
JOBS: (none — jobs API returned an empty list)
gh api .../runs/36081383233 --jq '{status,conclusion,event}'
{"conclusion":"startup_failure","event":"workflow_dispatch","status":"completed"}
```

The caller granted `contents: read` + `issues: write` and omitted `copilot-requests`; the called
probe-pa04-callee-perms.yml requests `copilot-requests: write` in job wants-copilot. Same run-level
startup_failure as E2: `control` did not run either.

### E4 — PA04.2 grant: positive control, both callee jobs hold the requested scopes

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081422592

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

### E5 — PA04.3 scenarios A, B, C: publish runs after success, failure, and skip

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081469850
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081628271
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081688850

```text
SCENARIO A (36081469850): gate success, intake success, execute success, assess success, publish success
PROBE-PA04 scenario=A job=gate committed=true utc=2026-09-25T01:19:02Z
PROBE-PA04 scenario=A job=intake ran=yes gate_committed_seen=true
PROBE-PA04 scenario=A job=publish ran=yes gate=success intake=success execute=success assess=success committed=true utc=2026-09-25T01:20:57Z

SCENARIO B (36081628271): gate success, intake success, execute failure, assess skipped, publish success
PROBE-PA04 scenario=B job=execute failing=yes
PROBE-PA04 scenario=B job=gate committed=true utc=2026-09-25T01:21:13Z
PROBE-PA04 scenario=B job=publish ran=yes gate=success intake=success execute=failure assess=skipped committed=true utc=2026-09-25T01:21:28Z

SCENARIO C (36081688850): gate success, intake success, execute success, assess skipped (own if), publish success
PROBE-PA04 scenario=C job=execute ran=yes
PROBE-PA04 scenario=C job=gate committed=true utc=2026-09-25T01:22:01Z
PROBE-PA04 scenario=C job=publish ran=yes gate=success intake=success execute=success assess=skipped committed=true utc=2026-09-25T01:22:18Z
```

In A, B, and C, publish ran (`job=publish ran=yes`) with `committed=true` in its own line, and intake in A logged
`gate_committed_seen=true`, so a job output (`gate.outputs.committed`) crossed `needs` inside the reusable
pipeline workflow. Publish ran after a failed upstream job (B) and after a skipped upstream job (C).

### E6 — PA04.3 scenarios D, E: publish skipped when gate fails or committed is not 'true'

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081745919
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081780126

```text
SCENARIO D (36081745919): gate failure; intake, execute, assess, publish all skipped
PROBE-PA04 scenario=D job=gate committed=true utc=2026-09-25T01:22:50Z
PROBE-PA04 scenario=D job=gate failing=yes

SCENARIO E (36081780126): gate success but committed=false; intake, execute, assess, publish all skipped
PROBE-PA04 scenario=E job=gate committed=false utc=2026-09-25T01:23:18Z
```

publish did not run in either D (gate failed) or E (gate succeeded but `committed` was `'false'`), matching the
`if:` condition quoted in the design.

### E7 — PA04.4 scenario F: publish still ran to completion after a cancellation during execute

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081813865

```text
JOBS
pipeline / gate completed success
pipeline / intake completed success
pipeline / canceller completed cancelled
pipeline / execute completed cancelled
pipeline / publish completed success
pipeline / assess completed cancelled

FACTS
PROBE-PA04 scenario=F job=gate committed=true utc=2026-09-25T01:23:45Z
PROBE-PA04 scenario=F job=intake ran=yes gate_committed_seen=true
PROBE-PA04 scenario=F job=execute hold_start_utc=2026-09-25T01:23:55Z
PROBE-PA04 scenario=F job=canceller cancel_request_utc=2026-09-25T01:24:21Z
PROBE-PA04 scenario=F job=publish ran=yes gate=success intake=success execute=cancelled assess=cancelled committed=true utc=2026-09-25T01:24:39Z
```

The cancellation request (01:24:21) landed while execute was holding (started 01:23:55, later concluded
`cancelled`), and assess was also cancelled. Despite that, publish still ran to completion
(`pipeline / publish completed success`, `job=publish ran=yes ... committed=true`).

### E8 — Q4 re-probe: W1 explicit secrets mapping, callee hosted on personal

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36112857842

```text
DISPATCH requested workflow=probe-pa04-w1-host-personal.yml ref=master nonce=n20260925T082539Z-69072-27107 attempt=1 utc=2026-09-25T08:25:43Z
DISPATCH run_id=36112857842 url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36112857842
DISPATCH completed run_id=36112857842 conclusion=success utc=2026-09-25T08:26:04Z
Q4-OUTCOME key=org-public wiring=W1 host=personal run=36112857842 conclusion=success caller_with_env=org-public caller_sibling=empty callee_with_env=org-public callee_without_env=empty

JOBS
caller-sibling completed success
call / without-env completed success
caller-env completed success
call / with-env completed success

FACTS
PROBE-PA04 leg=w1-host-personal job=caller/sibling repository=steady-orchard/patch-steward-testbed-public secret_length=0 secret_origin=empty
PROBE-PA04 leg=w1-host-personal job=callee/without-env repository=steady-orchard/patch-steward-testbed-public secret_length=0 secret_origin=empty
PROBE-PA04 leg=w1-host-personal job=caller/with-env repository=steady-orchard/patch-steward-testbed-public secret_length=28 secret_origin=org-public
PROBE-PA04 leg=w1-host-personal job=callee/with-env repository=steady-orchard/patch-steward-testbed-public workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa04-w1-host-personal.yml@refs/heads/master secret_length=28 secret_origin=org-public
```

With an explicit `secrets:` mapping, the called job on the personal-hosted callee resolved the CALLER's
(org-public) Environment secret, not the host repository's; sibling isolation held (caller/sibling and
callee/without-env both empty).

### E9 — Q4 re-probe: W2 secrets inherit, callee hosted on personal

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36112899071

```text
DISPATCH requested workflow=probe-pa04-w2-host-personal.yml ref=master nonce=n20260925T082608Z-69085-957 attempt=1 utc=2026-09-25T08:26:10Z
DISPATCH run_id=36112899071 url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36112899071
DISPATCH completed run_id=36112899071 conclusion=success utc=2026-09-25T08:26:32Z
Q4-OUTCOME key=org-public wiring=W2 host=personal run=36112899071 conclusion=success caller_with_env=org-public caller_sibling=empty callee_with_env=empty callee_without_env=empty

JOBS
caller-sibling completed success
call / with-env completed success
call / without-env completed success
caller-env completed success

FACTS
PROBE-PA04 leg=w2-host-personal job=caller/sibling repository=steady-orchard/patch-steward-testbed-public secret_length=0 secret_origin=empty
PROBE-PA04 leg=w2-host-personal job=callee/with-env repository=steady-orchard/patch-steward-testbed-public workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa04-w2-host-personal.yml@refs/heads/master secret_length=0 secret_origin=empty
PROBE-PA04 leg=w2-host-personal job=callee/without-env repository=steady-orchard/patch-steward-testbed-public secret_length=0 secret_origin=empty
PROBE-PA04 leg=w2-host-personal job=caller/with-env repository=steady-orchard/patch-steward-testbed-public secret_length=28 secret_origin=org-public
```

With `secrets: inherit`, the called job on the personal-hosted callee read empty: inherit did not deliver the
caller's Environment secret because the calling ("call") job itself does not declare `environment`. Sibling
isolation held.

## Deviations from the design

- PA04.1 refuted: docs/architecture.md §6.4 states "environment secrets reach only the jobs that reference the
  environment ... no job references both", which this probe confirms for sibling jobs in the same run
  (caller/sibling read empty) but which does not extend to a called reusable workflow's job declaring the same
  Environment name without the secret being explicitly passed: every callee/with-env leg (E1) read an empty
  secret instead of resolving the caller's Environment.
- PA04.2 refuted: docs/architecture.md §6.4 states "Reusable workflows cannot exceed the caller's permissions,
  so the wrapper templates grant `copilot-requests: write` to `intake` and `assess`; a wrapper that drops it
  makes those jobs end `inconclusive`." Both omission scenarios (E2, E3) instead ended the whole run in
  `startup_failure` before any job — including the unrelated sibling `control` job — was scheduled; no job ever
  ran to reach an `inconclusive` outcome.
- PA04.4 refuted: docs/architecture.md §6.4 states "A workflow cancellation can still prevent publication." In
  scenario F (E7) the cancellation landed while execute was running and both execute and assess ended
  `cancelled`, but `pipeline / publish` still completed successfully with `committed=true`.

## Residue

- Environments: probe-pa04-env on steady-orchard/patch-steward-testbed-public and on
  jambolo/patch-steward-testbed-personal (deployment-branch policy: master only; DUMMY secret
  PROBE_PA04_ENV_MARKER).
- Deployed workflows: .github/workflows/probe-pa04-callee.yml on steady-orchard/patch-steward-testbed-public and
  jambolo/patch-steward-testbed-personal; .github/workflows/probe-pa04-envs.yml,
  probe-pa04-callee-perms.yml, probe-pa04-ceiling-omit-issues.yml, probe-pa04-ceiling-omit-copilot.yml,
  probe-pa04-ceiling-grant.yml, probe-pa04-pipeline.yml, probe-pa04-publish.yml on
  steady-orchard/patch-steward-testbed-public master.
- Runs: 36081250289, 36081332331, 36081383233, 36081422592, 36081469850, 36081628271, 36081688850, 36081745919,
  36081780126, 36081813865 on steady-orchard/patch-steward-testbed-public.
- Q4 re-probe: deployed probe-pa04-callee-secrets.yml to steady-orchard/patch-steward-testbed-public and
  jambolo/patch-steward-testbed-personal; deployed probe-pa04-w1-host-personal.yml and
  probe-pa04-w2-host-personal.yml to steady-orchard/patch-steward-testbed-public. Runs: 36112857842 (W1),
  36112899071 (W2) on steady-orchard/patch-steward-testbed-public.
