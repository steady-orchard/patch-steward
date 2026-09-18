# PA03 — Trusted triggers — org-private

- assumption: PA03
- test-bed: steady-orchard/patch-steward-testbed-private
- probed: 2026-09-25T02:09:16Z to 2026-09-25T14:09:20Z
- step: 2.13, 4.6
- workflows: probe-pa03-events.yml e5fe657eaa2ca165fdc159f2e6c290cd80a7de3f; probe-pa03-upstream.yml bbb6a0c3ad3cd37b5603bedadfd8dd9edfab97d3; probe-pa03-schedule.yml 6d2dfcbdbf2a64a1aebeaf60d19e32b35b111e85; probe-pa03-schedule-env.yml 3f46b6925272acb03dcf558d2010156e3c6bfe66

## Results

| Sub-claim | Kind       | Result    | Cause | Evidence                  |
| --------- | ---------- | --------- | ----- | ------------------------- |
| PA03.1    | assumption | confirmed | none  | E1,E2,E3                  |
| PA03.2    | assumption | confirmed | none  | E4                        |
| PA03.3    | assumption | confirmed | none  | E5                        |
| PA03.4    | assumption | confirmed | none  | E6,E10,E11                |
| PA03.5    | assumption | confirmed | none  | E1,E2,E3,E4,E5,E6,E10,E12 |
| PA03.6    | assumption | confirmed | none  | E7,E8,E9                  |

## Measurements

| Sub-claim | Quantity | Value | Unit | Method | Samples |
| --------- | -------- | ----- | ---- | ------ | ------- |

## Evidence

### E1 — P1 same-repo head modifies the workflow (PR 1)

PR https://github.com/steady-orchard/patch-steward-testbed-private/pull/1, run
https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085181125
(`mergeable_state=clean`).

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=pull_request_target action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record base_ref=master head_ref=probe-pa03-head-modify
PROBE-PA03 job=record pr=1 pr_base=master pr_head_repo=steady-orchard/patch-steward-testbed-private pr_head_sha=fceccce3ff004e7dceb9c4e0cab12c409c9fd35c issue=
PROBE-PA03 job=record run_id=36085181125 run_attempt=1 utc=2026-09-25T02:10:52Z
PROBE-PA03 job=guard definition=default-branch event_name=pull_request_target ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=pull_request_target ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085181125 utc=2026-09-25T02:11:01Z
```

### E2 — P2 same-repo head lacks the workflow (PR 2)

PR https://github.com/steady-orchard/patch-steward-testbed-private/pull/2, run
https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085186513
(`mergeable_state=clean`). Head branch `probe-pa03-head-absent` was created from the initial commit
(2b4fc8ebbe96973365da712f411478d16c855db0), which holds no workflow file; the permitted tooling can add files but
not delete them, so "deletes" is exercised as a head whose tree lacks `.github/workflows/probe-pa03-events.yml`:
`gh api repos/steady-orchard/patch-steward-testbed-private/contents/.github/workflows/probe-pa03-events.yml?ref=probe-pa03-head-absent`
returned HTTP 404.

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=pull_request_target action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record base_ref=master head_ref=probe-pa03-head-absent
PROBE-PA03 job=record pr=2 pr_base=master pr_head_repo=steady-orchard/patch-steward-testbed-private pr_head_sha=85229bd569b38dd6c74bbcb4e8c7d3174f2069eb issue=
PROBE-PA03 job=record run_id=36085186513 run_attempt=1 utc=2026-09-25T02:10:57Z
PROBE-PA03 job=guard definition=default-branch event_name=pull_request_target ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=pull_request_target ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085186513 utc=2026-09-25T02:11:06Z
```

### E3 — P5 non-default base with a different workflow copy (PR 3)

PR https://github.com/steady-orchard/patch-steward-testbed-private/pull/3 (base `probe-pa03-base`, whose own copy
of `probe-pa03-events.yml` has `PROBE_DEFINITION: probe-pa03-base`), run
https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085192849
(`mergeable_state=dirty`; pull_request_target ran anyway, using the DEFAULT-BRANCH copy, not the base branch's
copy).

```text
PROBE-PA03 job=guard definition=default-branch event_name=pull_request_target ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=pull_request_target action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record base_ref=probe-pa03-base head_ref=probe-pa03-head-nd
PROBE-PA03 job=record pr=3 pr_base=probe-pa03-base pr_head_repo=steady-orchard/patch-steward-testbed-private pr_head_sha=cd2d734d11a1a924c93ba3039bc7e41fb433432c issue=
PROBE-PA03 job=record run_id=36085192849 run_attempt=1 utc=2026-09-25T02:11:02Z
PROBE-PA03 job=environment definition=default-branch event_name=pull_request_target ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085192849 utc=2026-09-25T02:11:10Z
```

### E4 — issues and issue_comment triggers (issue 4)

Issue https://github.com/steady-orchard/patch-steward-testbed-private/issues/4. Comment id 5825536558 (body
`/probe-pa03 comment trigger`, posted with `MSYS_NO_PATHCONV=1` prefixed to the standalone `gh api` command,
matching the README note on POSIX-path autoconversion) produced a fresh `issue_comment` event.

`issues` run https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085197301:

```text
PROBE-PA03 job=guard definition=default-branch event_name=issues ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=issues action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record pr= pr_base= pr_head_repo= pr_head_sha= issue=4
PROBE-PA03 job=record run_id=36085197301 run_attempt=1 utc=2026-09-25T02:11:07Z
PROBE-PA03 job=environment definition=default-branch event_name=issues ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085197301 utc=2026-09-25T02:11:14Z
```

`issue_comment` run https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085202233:

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=issue_comment action=created sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record pr= pr_base= pr_head_repo= pr_head_sha= issue=4
PROBE-PA03 job=record run_id=36085202233 run_attempt=1 utc=2026-09-25T02:11:11Z
PROBE-PA03 job=guard definition=default-branch event_name=issue_comment ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=issue_comment ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085202233 utc=2026-09-25T02:11:17Z
```

### E5 — workflow_run leg U

Upstream dispatch https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085206654 on ref
`probe-pa03-base`; downstream `workflow_run` run
https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085217410.

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=workflow_run action=completed sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record workflow_run_id=36085206654 workflow_run_head_branch=probe-pa03-base workflow_run_event=workflow_dispatch
PROBE-PA03 job=record run_id=36085217410 run_attempt=1 utc=2026-09-25T02:11:23Z
PROBE-PA03 job=guard definition=default-branch event_name=workflow_run ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=workflow_run ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085217410 utc=2026-09-25T02:11:31Z
```

### E6 — scheduled legs S (probe-pa03-schedule.yml) and S-env (probe-pa03-schedule-env.yml): no capture

Both schedule files were re-enabled at T0 = 2026-09-25T02:09:16Z (cron `7,22,37,52` for `probe-pa03-schedule.yml`,
`12,27,42,57` for `probe-pa03-schedule-env.yml`). Polling every 120 s for 60 minutes found zero `schedule`-event
runs of either file; only pre-existing `workflow_dispatch` runs (36062454791, 36062512792, both from step 2.3's
capture window on 2026-09-24) were listed:

```text
2026-09-25T02:16:18Z c1=0 c2=0
2026-09-25T02:26:45Z c1=0 c2=0
2026-09-25T02:37:05Z c1=0 c2=0
2026-09-25T02:47:15Z c1=0 c2=0
2026-09-25T02:57:26Z c1=0 c2=0
2026-09-25T03:09:39Z c1=0 c2=0 elapsed=3623
```

At T0 + 60 min both files were disabled in any case:

```text
gh workflow list -R steady-orchard/patch-steward-testbed-private --all --json path,state --jq '.[] | select(.path | test("probe-pa03-schedule")) | "\(.path) \(.state)"'
.github/workflows/probe-pa03-schedule-env.yml disabled_manually
.github/workflows/probe-pa03-schedule.yml disabled_manually
```

Settle check (no scheduled run queued or in_progress for either file): both counts 0. Leg S is MISSING; only the S
legs are missing (PA03.1–PA03.3 and the event legs of PA03.5 all have runs), so PA03.4 is undetermined (cause
blocked) and PA03.5 is undetermined (cause blocked, per the decision rule "blocked if only S is missing").

### E7 — dispatch control D0 (probe-pa03-events.yml on master)

Run https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085237690, conclusion=success.

```text
PROBE-PA03 job=guard definition=default-branch event_name=workflow_dispatch ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=workflow_dispatch action= sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471
PROBE-PA03 job=record run_id=36085237690 run_attempt=1 utc=2026-09-25T02:11:44Z
PROBE-PA03 job=environment definition=default-branch event_name=workflow_dispatch ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36085237690 utc=2026-09-25T02:11:52Z
```

### E8 — dispatch D1 (guard variant on probe-pa03-base)

Run https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085269810, conclusion=failure
(expected: the guard rejects the run). Job states: record=success, guard=failure, environment=skipped.

```text
PROBE-PA03 job=record definition=probe-pa03-base
PROBE-PA03 job=record event_name=workflow_dispatch action= sender=jambolo
PROBE-PA03 job=record ref=refs/heads/probe-pa03-base sha=f30eeb38ba855a9b1b620287203ea2ccf5c1a61f
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa03-events.yml@refs/heads/probe-pa03-base workflow_sha=f30eeb38ba855a9b1b620287203ea2ccf5c1a61f
PROBE-PA03 job=record run_id=36085269810 run_attempt=1 utc=2026-09-25T02:12:11Z
PROBE-PA03 job=guard definition=probe-pa03-base event_name=workflow_dispatch ref=refs/heads/probe-pa03-base default_branch=master
PROBE-PA03 job=guard verdict=reject reason=non-default-ref
```

### E9 — dispatch D2 (no-guard variant on probe-pa03-base-noguard)

Run https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085303713, conclusion=failure.
Job states: record=success, guard=failure (rejects but is not `needs`-ed by environment), environment=failure
(refused before the script step ran — no `PROBE-PA03 job=environment` line was ever printed). Annotation:

```text
PROBE-PA03 job=record definition=probe-pa03-base-noguard
PROBE-PA03 job=record event_name=workflow_dispatch action= sender=jambolo
PROBE-PA03 job=record ref=refs/heads/probe-pa03-base-noguard sha=daf05634baef119122d459ccee4474e9a72402a4
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa03-events.yml@refs/heads/probe-pa03-base-noguard workflow_sha=daf05634baef119122d459ccee4474e9a72402a4
PROBE-PA03 job=record run_id=36085303713 run_attempt=1 utc=2026-09-25T02:12:39Z
PROBE-PA03 job=guard definition=probe-pa03-base-noguard event_name=workflow_dispatch ref=refs/heads/probe-pa03-base-noguard default_branch=master
PROBE-PA03 job=guard verdict=reject reason=non-default-ref
```

`gh run view 36085303713 -R steady-orchard/patch-steward-testbed-private` annotations:

```text
X Branch "probe-pa03-base-noguard" is not allowed to deploy to probe-pa03-default-branch due to environment protection rules.
environment: .github#1

X The deployment was rejected or didn't satisfy other protection rules.
environment: .github#1
```

### E10 — Q3 re-probe: enable and disable of the two schedule files (owner decision Q3 A, bound 6 h, steps 4.2 and 4.5)

```text
Q3-ENABLE file=probe-pa03-schedule.yml enable_utc=2026-09-25T08:24:55Z source=pre-put
Q3-ENABLE file=probe-pa03-schedule-env.yml enable_utc=2026-09-25T08:24:55Z source=pre-put
Q3-DISABLE file=probe-pa03-schedule-env.yml disable_utc=2026-09-25T14:03:58Z reason=captured
Q3-DISABLE file=probe-pa03-schedule.yml disable_utc=2026-09-25T14:09:20Z reason=captured
Q3-STATE utc=2026-09-25T11:15:48Z file=probe-pa03-schedule.yml state=active updated_at_utc=2026-09-25T08:25:00Z
Q3-STATE utc=2026-09-25T11:15:48Z file=probe-pa03-schedule-env.yml state=active updated_at_utc=2026-09-25T08:25:05Z
```

```text
Q3-POLL utc=2026-09-25T08:27:52Z file=probe-pa03-schedule.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T08:27:52Z file=probe-pa03-schedule-env.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T08:30:24Z file=probe-pa03-schedule.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T08:30:24Z file=probe-pa03-schedule-env.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T08:32:57Z file=probe-pa03-schedule.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T08:32:57Z file=probe-pa03-schedule-env.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T08:35:36Z file=probe-pa03-schedule.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T08:35:36Z file=probe-pa03-schedule-env.yml state=active completed=0 open=0 first=none
[... 120 lines elided ...]
Q3-POLL utc=2026-09-25T11:13:06Z file=probe-pa03-schedule.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T11:13:06Z file=probe-pa03-schedule-env.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T11:15:39Z file=probe-pa03-schedule.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T11:15:39Z file=probe-pa03-schedule-env.yml state=active completed=0 open=0 first=none
Q3-WINDOW-END window=A end_utc=2026-09-25T11:14:55Z utc=2026-09-25T11:15:39Z
[... 122 lines elided ...]
Q3-POLL utc=2026-09-25T14:01:13Z file=probe-pa03-schedule.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T14:01:13Z file=probe-pa03-schedule-env.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T14:03:46Z file=probe-pa03-schedule.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T14:03:46Z file=probe-pa03-schedule-env.yml state=active completed=1 open=0 first=36144833081
Q3-HIT file=probe-pa03-schedule-env.yml run=36144833081 created=2026-09-25T14:02:25Z conclusion=success
Q3-POLL utc=2026-09-25T14:06:35Z file=probe-pa03-schedule.yml state=active completed=0 open=0 first=none
Q3-POLL utc=2026-09-25T14:06:35Z file=probe-pa03-schedule-env.yml state=disabled_manually completed=1 open=0 first=36144833081
Q3-POLL utc=2026-09-25T14:09:08Z file=probe-pa03-schedule.yml state=active completed=1 open=0 first=36145289811
Q3-POLL utc=2026-09-25T14:09:08Z file=probe-pa03-schedule-env.yml state=disabled_manually completed=1 open=0 first=36144833081
Q3-HIT file=probe-pa03-schedule.yml run=36145289811 created=2026-09-25T14:06:36Z conclusion=success
```

### E11 — Q3 re-probe: first completed scheduled run of probe-pa03-schedule.yml

```text
Q3-RUN file=probe-pa03-schedule.yml run=36145289811 created=2026-09-25T14:06:36Z status=completed conclusion=success
Q3-RUNS file=probe-pa03-schedule.yml ids=36145289811 open=0
```

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36145289811

```text
Q3-FIRST file=probe-pa03-schedule.yml run=36145289811 conclusion=success
record completed success
PROBE-PA03 definition=default-branch
PROBE-PA03 event_name=schedule
PROBE-PA03 repository=steady-orchard/patch-steward-testbed-private
PROBE-PA03 ref=refs/heads/master
PROBE-PA03 sha=3ceaaf6eef58f09494b4eee1097ecbda96e5b38f
PROBE-PA03 workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa03-schedule.yml@refs/heads/master
PROBE-PA03 workflow_sha=3ceaaf6eef58f09494b4eee1097ecbda96e5b38f
PROBE-PA03 run_id=36145289811 run_attempt=1
PROBE-PA03 utc=2026-09-25T14:06:41Z
```

### E12 — Q3 re-probe: first completed scheduled run of probe-pa03-schedule-env.yml

```text
Q3-RUN file=probe-pa03-schedule-env.yml run=36144833081 created=2026-09-25T14:02:25Z status=completed conclusion=success
Q3-RUNS file=probe-pa03-schedule-env.yml ids=36144833081 open=0
```

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36144833081

```text
Q3-FIRST file=probe-pa03-schedule-env.yml run=36144833081 conclusion=success
environment completed success
PROBE-PA03 definition=default-branch
PROBE-PA03 event_name=schedule
PROBE-PA03 repository=steady-orchard/patch-steward-testbed-private
PROBE-PA03 ref=refs/heads/master
PROBE-PA03 sha=3ceaaf6eef58f09494b4eee1097ecbda96e5b38f
PROBE-PA03 workflow_ref=steady-orchard/patch-steward-testbed-private/.github/workflows/probe-pa03-schedule-env.yml@refs/heads/master
PROBE-PA03 environment=probe-pa03-default-branch
PROBE-PA03 secret_length=24
PROBE-PA03 secret_digest=match
PROBE-PA03 run_id=36144833081 run_attempt=1
PROBE-PA03 utc=2026-09-25T14:02:32Z
```

## Deviations from the design

None.

## Residue

- Branches on org-private (steady-orchard/patch-steward-testbed-private): `probe-pa03-base`,
  `probe-pa03-base-noguard`, `probe-pa03-head-modify`, `probe-pa03-head-absent`, `probe-pa03-head-nd` (the
  `probe-pa03-head-*` branches are candidates for Phase 3 deletion; the rest remain deployed probe fixtures).
- PRs (closed, never merged): #1, #2, #3.
- Issue #4 (closed) with comment (id 5825536558, valid trigger).
- Deployed workflows: `probe-pa03-events.yml` on `master`, `probe-pa03-base` (variant), `probe-pa03-base-noguard`
  (variant); `probe-pa03-upstream.yml` on `master` and `probe-pa03-base`.
- Schedule files `probe-pa03-schedule.yml` and `probe-pa03-schedule-env.yml`: Q3 re-probe (steps 4.2/4.5) enabled
  both once at E = 2026-09-25T08:24:55Z and disabled each at its own disable_utc with reason `captured`
  (`probe-pa03-schedule-env.yml` at 2026-09-25T14:03:58Z, `probe-pa03-schedule.yml` at 2026-09-25T14:09:20Z); both
  are `disabled_manually`. Scheduled run ids captured: `probe-pa03-schedule.yml` 36145289811,
  `probe-pa03-schedule-env.yml` 36144833081.
- Environment `probe-pa03-default-branch` (deployment-branch policy: only `master`) with secret
  `PROBE_PA03_ENV_MARKER`: unchanged, still in place.
- Runs triggered this step: 9 completed `probe-pa03-events.yml` runs (P1, P2, P5, issues, issue_comment,
  workflow_run, D0, D1, D2) plus 1 `probe-pa03-upstream.yml` dispatch (U); no scheduled runs.
