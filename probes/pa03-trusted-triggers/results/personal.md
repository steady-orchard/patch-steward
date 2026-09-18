# PA03 — Trusted triggers — personal

- assumption: PA03
- test-bed: jambolo/patch-steward-testbed-personal
- probed: 2026-09-25T02:09:33Z to 2026-09-25T02:13:48Z
- step: 2.14
- workflows: probe-pa03-events.yml e5fe657eaa2ca165fdc159f2e6c290cd80a7de3f; probe-pa03-upstream.yml bbb6a0c3ad3cd37b5603bedadfd8dd9edfab97d3; probe-pa03-schedule-env.yml 3f46b6925272acb03dcf558d2010156e3c6bfe66

## Results

| Sub-claim | Kind       | Result    | Cause | Evidence          |
| --------- | ---------- | --------- | ----- | ----------------- |
| PA03.5    | assumption | confirmed | none  | E1,E2,E3,E4,E5,E6 |
| PA03.6    | assumption | confirmed | none  | E7,E8             |

## Measurements

| Sub-claim | Quantity | Value | Unit | Method | Samples |
| --------- | -------- | ----- | ---- | ------ | ------- |

## Evidence

No fork leg on this test-bed (the only permitted fork is of org-public); PA03.5 here is exercised only with the
same-repo legs P1 and P5, plus I, U, and S, per the README's personal scope (Environment and dispatch-guard legs
only).

### E1 — P1 same-repo head modifies the workflow (PR 2)

PR https://github.com/jambolo/patch-steward-testbed-personal/pull/2, run
https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085153125 (`mergeable_state=clean`).

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=pull_request_target action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=c98f8f2c70e0aa18ebdee87aaf081995e993caee
PROBE-PA03 job=record workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=c98f8f2c70e0aa18ebdee87aaf081995e993caee
PROBE-PA03 job=record base_ref=master head_ref=probe-pa03-head-modify
PROBE-PA03 job=record pr=2 pr_base=master pr_head_repo=jambolo/patch-steward-testbed-personal pr_head_sha=2c4468cfa55d6ab720cdc3a2dc94cbae12a728cd issue=
PROBE-PA03 job=record run_id=36085153125 run_attempt=1 utc=2026-09-25T02:10:28Z
PROBE-PA03 job=guard definition=default-branch event_name=pull_request_target ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=pull_request_target ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085153125 utc=2026-09-25T02:10:36Z
```

### E2 — P5 non-default base with a different workflow copy (PR 3)

PR https://github.com/jambolo/patch-steward-testbed-personal/pull/3 (base `probe-pa03-base`, whose own copy of
`probe-pa03-events.yml` has `PROBE_DEFINITION: probe-pa03-base`), run
https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085165684 (`mergeable_state=dirty`;
`pull_request_target` ran anyway, using the DEFAULT-BRANCH copy, not the base branch's copy).

```text
PROBE-PA03 job=guard definition=default-branch event_name=pull_request_target ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=pull_request_target action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=c98f8f2c70e0aa18ebdee87aaf081995e993caee
PROBE-PA03 job=record workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=c98f8f2c70e0aa18ebdee87aaf081995e993caee
PROBE-PA03 job=record base_ref=probe-pa03-base head_ref=probe-pa03-head-nd
PROBE-PA03 job=record pr=3 pr_base=probe-pa03-base pr_head_repo=jambolo/patch-steward-testbed-personal pr_head_sha=ce265f7c21e78cdbb3a46f4b988656ceb2ffbb84 issue=
PROBE-PA03 job=record run_id=36085165684 run_attempt=1 utc=2026-09-25T02:10:40Z
PROBE-PA03 job=environment definition=default-branch event_name=pull_request_target ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085165684 utc=2026-09-25T02:10:50Z
```

### E3 — issues and issue_comment triggers (issue 4)

Issue https://github.com/jambolo/patch-steward-testbed-personal/issues/4, comment id 5825532977 (body
`/probe-pa03 comment trigger`, posted with `MSYS_NO_PATHCONV=1` prefixed to the standalone `gh api` command).

`issues` run https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085170773:

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=issues action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=c98f8f2c70e0aa18ebdee87aaf081995e993caee
PROBE-PA03 job=record workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=c98f8f2c70e0aa18ebdee87aaf081995e993caee
PROBE-PA03 job=record pr= pr_base= pr_head_repo= pr_head_sha= issue=4
PROBE-PA03 job=record run_id=36085170773 run_attempt=1 utc=2026-09-25T02:10:43Z
PROBE-PA03 job=guard definition=default-branch event_name=issues ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=issues ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085170773 utc=2026-09-25T02:10:49Z
```

`issue_comment` run https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085175028:

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=issue_comment action=created sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=c98f8f2c70e0aa18ebdee87aaf081995e993caee
PROBE-PA03 job=record workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=c98f8f2c70e0aa18ebdee87aaf081995e993caee
PROBE-PA03 job=record pr= pr_base= pr_head_repo= pr_head_sha= issue=4
PROBE-PA03 job=record run_id=36085175028 run_attempt=1 utc=2026-09-25T02:10:47Z
PROBE-PA03 job=guard definition=default-branch event_name=issue_comment ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=issue_comment ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085175028 utc=2026-09-25T02:10:53Z
```

### E4 — workflow_run leg U

Upstream dispatch https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085179754 on ref
`probe-pa03-base`; downstream `workflow_run` run
https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085191133.

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=workflow_run action=completed sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=c98f8f2c70e0aa18ebdee87aaf081995e993caee
PROBE-PA03 job=record workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=c98f8f2c70e0aa18ebdee87aaf081995e993caee
PROBE-PA03 job=record workflow_run_id=36085179754 workflow_run_head_branch=probe-pa03-base workflow_run_event=workflow_dispatch
PROBE-PA03 job=record run_id=36085191133 run_attempt=1 utc=2026-09-25T02:11:01Z
PROBE-PA03 job=guard definition=default-branch event_name=workflow_run ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=workflow_run ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085191133 utc=2026-09-25T02:11:07Z
```

### E5 — scheduled leg S-env (probe-pa03-schedule-env.yml)

Completed scheduled run 36063493816 (2026-09-24, `success`), this test-bed's schedule leg per the packet context;
re-read here rather than re-run (schedule files remain disabled and were NOT re-enabled).
https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36063493816

```text
PROBE-PA03 definition=default-branch
PROBE-PA03 event_name=schedule
PROBE-PA03 repository=jambolo/patch-steward-testbed-personal
PROBE-PA03 ref=refs/heads/master
PROBE-PA03 sha=b06f66bf5c85defac63d1e2d29533a1fb1707e4d
PROBE-PA03 workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa03-schedule-env.yml@refs/heads/master
PROBE-PA03 environment=probe-pa03-default-branch
PROBE-PA03 secret_length=24
PROBE-PA03 secret_digest=match
PROBE-PA03 run_id=36063493816 run_attempt=1
PROBE-PA03 utc=2026-09-24T21:45:51Z
```

Post-run check (both schedule files remain `disabled_manually`, never re-enabled by this step):

```text
gh workflow list -R jambolo/patch-steward-testbed-personal --all --json path,state --jq '.[] | select(.path | test("probe-pa03-schedule")) | "\(.path) \(.state)"'
.github/workflows/probe-pa03-schedule-env.yml disabled_manually
.github/workflows/probe-pa03-schedule.yml disabled_manually
```

### E6 — dispatch control D0 (probe-pa03-events.yml on master)

Run https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085212093, conclusion=success.

```text
PROBE-PA03 job=guard definition=default-branch event_name=workflow_dispatch ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=workflow_dispatch action= sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=c98f8f2c70e0aa18ebdee87aaf081995e993caee
PROBE-PA03 job=record run_id=36085212093 run_attempt=1 utc=2026-09-25T02:11:20Z
PROBE-PA03 job=environment definition=default-branch event_name=workflow_dispatch ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085212093 utc=2026-09-25T02:11:28Z
```

### E7 — dispatch D1 (guard variant on probe-pa03-base)

Run https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085244200, conclusion=failure
(expected: the guard rejects the run). Job states: record=success, guard=failure, environment=skipped.

```text
PROBE-PA03 job=record definition=probe-pa03-base
PROBE-PA03 job=record event_name=workflow_dispatch action= sender=jambolo
PROBE-PA03 job=record ref=refs/heads/probe-pa03-base sha=0292bcede81c44a88e4e4c0cac91916294752c62
PROBE-PA03 job=record workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa03-events.yml@refs/heads/probe-pa03-base workflow_sha=0292bcede81c44a88e4e4c0cac91916294752c62
PROBE-PA03 job=record run_id=36085244200 run_attempt=1 utc=2026-09-25T02:11:50Z
PROBE-PA03 job=guard definition=probe-pa03-base event_name=workflow_dispatch ref=refs/heads/probe-pa03-base default_branch=master
PROBE-PA03 job=guard verdict=reject reason=non-default-ref
```

### E8 — dispatch D2 (no-guard variant on probe-pa03-base-noguard)

Run https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085277201, conclusion=failure. Job
states: record=success, guard=failure (rejects but is not `needs`-ed by environment), environment=failure (refused
before the script step ran — no `PROBE-PA03 job=environment` line was ever printed). Annotation:

```text
PROBE-PA03 job=record definition=probe-pa03-base-noguard
PROBE-PA03 job=record event_name=workflow_dispatch action= sender=jambolo
PROBE-PA03 job=record ref=refs/heads/probe-pa03-base-noguard sha=e53bf2c632f3da404509e03be2c8ddd9923e117e
PROBE-PA03 job=record workflow_ref=jambolo/patch-steward-testbed-personal/.github/workflows/probe-pa03-events.yml@refs/heads/probe-pa03-base-noguard workflow_sha=e53bf2c632f3da404509e03be2c8ddd9923e117e
PROBE-PA03 job=record run_id=36085277201 run_attempt=1 utc=2026-09-25T02:12:17Z
```

`gh run view 36085277201 -R jambolo/patch-steward-testbed-personal` annotations:

```text
X Branch "probe-pa03-base-noguard" is not allowed to deploy to probe-pa03-default-branch due to environment protection rules.
environment: .github#1

X The deployment was rejected or didn't satisfy other protection rules.
environment: .github#1
```

## Deviations from the design

None.

## Residue

- Branches on personal (jambolo/patch-steward-testbed-personal): `probe-pa03-base`, `probe-pa03-base-noguard`,
  `probe-pa03-head-modify`, `probe-pa03-head-nd` (deployed probe fixtures; no fork leg exists here).
- PRs (closed, never merged): #2, #3.
- Issue #4 (closed) with comment id 5825532977.
- Deployed workflows: `probe-pa03-events.yml` on `master`, `probe-pa03-base` (variant), `probe-pa03-base-noguard`
  (variant); `probe-pa03-upstream.yml` on `master` and `probe-pa03-base`.
- Schedule files `probe-pa03-schedule.yml` and `probe-pa03-schedule-env.yml`: both `disabled_manually`, not
  re-enabled by this step.
- Environment `probe-pa03-default-branch` (deployment-branch policy: only `master`) with secret
  `PROBE_PA03_ENV_MARKER`: unchanged, still in place.
