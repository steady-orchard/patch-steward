# PA03 — Trusted triggers — org-public

- assumption: PA03
- test-bed: steady-orchard/patch-steward-testbed-public
- probed: 2026-09-24T23:58:28Z to 2026-09-25T01:24:03Z
- step: 2.3
- workflows: probe-pa03-events.yml e5fe657eaa2ca165fdc159f2e6c290cd80a7de3f; probe-pa03-upstream.yml bbb6a0c3ad3cd37b5603bedadfd8dd9edfab97d3; probe-pa03-schedule.yml 6d2dfcbdbf2a64a1aebeaf60d19e32b35b111e85; probe-pa03-schedule-env.yml 3f46b6925272acb03dcf558d2010156e3c6bfe66

## Results

| Sub-claim | Kind       | Result    | Cause | Evidence                |
| --------- | ---------- | --------- | ----- | ----------------------- |
| PA03.1    | assumption | confirmed | none  | E1,E2,E3,E4,E5          |
| PA03.2    | assumption | confirmed | none  | E6                      |
| PA03.3    | assumption | confirmed | none  | E7                      |
| PA03.4    | assumption | confirmed | none  | E8                      |
| PA03.5    | assumption | confirmed | none  | E1,E2,E3,E4,E5,E6,E7,E9 |
| PA03.6    | assumption | confirmed | none  | E10,E11,E12             |

## Measurements

| Sub-claim | Quantity | Value | Unit | Method | Samples |
| --------- | -------- | ----- | ---- | ------ | ------- |

## Evidence

### E1 — P1 same-repo head modifies the workflow (PR 13)

PR https://github.com/steady-orchard/patch-steward-testbed-public/pull/13, run
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081378045
(`mergeable_state=clean`).

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=pull_request_target action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record base_ref=master head_ref=probe-pa03-head-modify
PROBE-PA03 job=record pr=13 pr_base=master pr_head_repo=steady-orchard/patch-steward-testbed-public pr_head_sha=28cce6d6d7141c71929f45921f96f9dde69b5c4f issue=
PROBE-PA03 job=record run_id=36081378045 run_attempt=1 utc=2026-09-25T01:17:44Z
PROBE-PA03 job=guard definition=default-branch event_name=pull_request_target ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=pull_request_target ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36081378045 utc=2026-09-25T01:17:49Z
```

### E2 — P2 same-repo head lacks the workflow (PR 14)

PR https://github.com/steady-orchard/patch-steward-testbed-public/pull/14, run
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081381941
(`mergeable_state=clean`). Head branch `probe-pa03-head-absent` was created from the initial commit
(e787442e06eeac9ea66130d2cf433842d5e6f459), which holds no workflow file; the permitted tooling can add files but
not delete them, so "deletes" is exercised as a head whose tree lacks `.github/workflows/probe-pa03-events.yml`:
`gh api repos/steady-orchard/patch-steward-testbed-public/contents/.github/workflows/probe-pa03-events.yml?ref=probe-pa03-head-absent`
returned HTTP 404.

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=pull_request_target action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record base_ref=master head_ref=probe-pa03-head-absent
PROBE-PA03 job=record pr=14 pr_base=master pr_head_repo=steady-orchard/patch-steward-testbed-public pr_head_sha=5457944a0fa20e55335621a0a80d7c6f50771739 issue=
PROBE-PA03 job=record run_id=36081381941 run_attempt=1 utc=2026-09-25T01:17:47Z
PROBE-PA03 job=guard definition=default-branch event_name=pull_request_target ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=pull_request_target ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36081381941 utc=2026-09-25T01:17:55Z
```

### E3 — P3 fork head modifies the workflow (PR 17)

PR https://github.com/steady-orchard/patch-steward-testbed-public/pull/17, run
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081389018
(`mergeable_state=dirty`; pull_request_target ran anyway).

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=pull_request_target action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record base_ref=master head_ref=probe-pa03-head-fork-modify
PROBE-PA03 job=record pr=17 pr_base=master pr_head_repo=jambolo/patch-steward-testbed-public pr_head_sha=bb1ee0038f709634c8ca0abc85d60ec5f544f52b issue=
PROBE-PA03 job=record run_id=36081389018 run_attempt=1 utc=2026-09-25T01:17:54Z
PROBE-PA03 job=guard definition=default-branch event_name=pull_request_target ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=pull_request_target ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36081389018 utc=2026-09-25T01:18:00Z
```

### E4 — P4 fork head lacks the workflow (PR 18)

PR https://github.com/steady-orchard/patch-steward-testbed-public/pull/18, run
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081391335
(`mergeable_state=clean`). Fork head branch `probe-pa03-head-fork-absent` derives from the fork's master
(e787442e06eeac9ea66130d2cf433842d5e6f459), which holds no workflow file — "deletes" again exercised as an absent
tree, not an actual deletion, since the permitted tooling cannot delete files.

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=pull_request_target action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record base_ref=master head_ref=probe-pa03-head-fork-absent
PROBE-PA03 job=record pr=18 pr_base=master pr_head_repo=jambolo/patch-steward-testbed-public pr_head_sha=c48e4ba7b9b6df9a8e034da56bee39be6d167296 issue=
PROBE-PA03 job=record run_id=36081391335 run_attempt=1 utc=2026-09-25T01:17:57Z
PROBE-PA03 job=guard definition=default-branch event_name=pull_request_target ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=pull_request_target ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36081391335 utc=2026-09-25T01:18:02Z
```

### E5 — P5 non-default base with a different workflow copy (PR 16)

PR https://github.com/steady-orchard/patch-steward-testbed-public/pull/16 (base `probe-pa03-base`, whose own copy
of `probe-pa03-events.yml` has `PROBE_DEFINITION: probe-pa03-base`), run
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081385701
(`mergeable_state=dirty`; pull_request_target ran anyway, using the DEFAULT-BRANCH copy, not the base branch's
copy).

```text
PROBE-PA03 job=guard definition=default-branch event_name=pull_request_target ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=pull_request_target action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record base_ref=probe-pa03-base head_ref=probe-pa03-head-nd
PROBE-PA03 job=record pr=16 pr_base=probe-pa03-base pr_head_repo=steady-orchard/patch-steward-testbed-public pr_head_sha=978a2dee767779a5df8c475ff1566c7eb75a0fbf issue=
PROBE-PA03 job=record run_id=36081385701 run_attempt=1 utc=2026-09-25T01:17:51Z
PROBE-PA03 job=environment definition=default-branch event_name=pull_request_target ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36081385701 utc=2026-09-25T01:17:59Z
```

### E6 — issues and issue_comment triggers (issue 19)

Issue https://github.com/steady-orchard/patch-steward-testbed-public/issues/19. The first `issue_comment` attempt
(comment id 5825050006) was corrupted by Git-Bash POSIX-path autoconversion of the literal `/probe-pa03...` body
argument (its stored body began with a Windows path); its run (36081404659) was correctly skipped by the marker
check. A second comment (id 5825082395, body `/probe-pa03 comment trigger`, posted with `MSYS_NO_PATHCONV=1`
prefixed to the same standalone `gh api` command) produced a fresh `issue_comment` event.

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=issues action=opened sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record pr= pr_base= pr_head_repo= pr_head_sha= issue=19
PROBE-PA03 job=record run_id=36081398990 run_attempt=1 utc=2026-09-25T01:18:02Z
PROBE-PA03 job=guard definition=default-branch event_name=issues ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=issues ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36081398990 utc=2026-09-25T01:18:08Z
```

issue_comment run https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081654891:

```text
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=issue_comment action=created sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record pr= pr_base= pr_head_repo= pr_head_sha= issue=19
PROBE-PA03 job=record run_id=36081654891 run_attempt=1 utc=2026-09-25T01:21:33Z
PROBE-PA03 job=guard definition=default-branch event_name=issue_comment ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=issue_comment ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36081654891 utc=2026-09-25T01:21:39Z
```

### E7 — workflow_run leg U

Upstream dispatch https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081413206 on ref
`probe-pa03-base`; downstream `workflow_run` run
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081424168.

```text
PROBE-PA03 job=upstream ref=refs/heads/probe-pa03-base sha=048af236bf9170270f1e03639337311fb80a5fae run_id=36081413206 utc=2026-09-25T01:18:15Z
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=workflow_run action=completed sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-events.yml@refs/heads/master workflow_sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record workflow_run_id=36081413206 workflow_run_head_branch=probe-pa03-base workflow_run_event=workflow_dispatch
PROBE-PA03 job=record run_id=36081424168 run_attempt=1 utc=2026-09-25T01:18:23Z
PROBE-PA03 job=guard definition=default-branch event_name=workflow_run ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=environment definition=default-branch event_name=workflow_run ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36081424168 utc=2026-09-25T01:18:30Z
```

### E8 — scheduled leg S (probe-pa03-schedule.yml)

First (and only) completed scheduled run https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36075348546
(created 2026-09-24T23:58:35Z, conclusion=success; captured, never re-enabled by this step).

```text
PROBE-PA03 definition=default-branch
PROBE-PA03 event_name=schedule
PROBE-PA03 repository=steady-orchard/patch-steward-testbed-public
PROBE-PA03 ref=refs/heads/master
PROBE-PA03 sha=3b397a620413adf72a49a7eb62bc6fca1a0a1dfc
PROBE-PA03 workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-schedule.yml@refs/heads/master
PROBE-PA03 workflow_sha=3b397a620413adf72a49a7eb62bc6fca1a0a1dfc
PROBE-PA03 run_id=36075348546 run_attempt=1
PROBE-PA03 utc=2026-09-24T23:58:41Z
```

### E9 — scheduled leg S-env (probe-pa03-schedule-env.yml)

First (and only) completed scheduled run https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36075339713
(created 2026-09-24T23:58:28Z, conclusion=success; captured, never re-enabled by this step).

```text
PROBE-PA03 definition=default-branch
PROBE-PA03 event_name=schedule
PROBE-PA03 repository=steady-orchard/patch-steward-testbed-public
PROBE-PA03 ref=refs/heads/master
PROBE-PA03 sha=3b397a620413adf72a49a7eb62bc6fca1a0a1dfc
PROBE-PA03 workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-schedule-env.yml@refs/heads/master
PROBE-PA03 environment=probe-pa03-default-branch
PROBE-PA03 secret_length=24
PROBE-PA03 secret_digest=match
PROBE-PA03 run_id=36075339713 run_attempt=1
PROBE-PA03 utc=2026-09-24T23:58:34Z
```

Post-capture check (both files disabled_manually, no run queued/in_progress):

```text
gh workflow list -R steady-orchard/patch-steward-testbed-public --all --json path,state --jq '.[] | select(.path | test("probe-pa03-schedule")) | "\(.path) \(.state)"'
.github/workflows/probe-pa03-schedule-env.yml disabled_manually
.github/workflows/probe-pa03-schedule.yml disabled_manually
```

### E10 — dispatch control D0 (probe-pa03-events.yml on master)

Run https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081446722, conclusion=success.

```text
PROBE-PA03 job=guard definition=default-branch event_name=workflow_dispatch ref=refs/heads/master default_branch=master
PROBE-PA03 job=guard verdict=pass
PROBE-PA03 job=record definition=default-branch
PROBE-PA03 job=record event_name=workflow_dispatch action= sender=jambolo
PROBE-PA03 job=record ref=refs/heads/master sha=86654769298706dcf38402977461e7de0e4fa068
PROBE-PA03 job=record run_id=36081446722 run_attempt=1 utc=2026-09-25T01:18:45Z
PROBE-PA03 job=environment definition=default-branch event_name=workflow_dispatch ref=refs/heads/master
PROBE-PA03 job=environment environment=probe-pa03-default-branch secret_length=24
PROBE-PA03 job=environment secret_digest=match
PROBE-PA03 job=environment run_id=36081446722 utc=2026-09-25T01:18:53Z
```

### E11 — dispatch D1 (guard variant on probe-pa03-base)

Run https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081479448, conclusion=failure
(expected: the guard rejects the run). Job states: record=success, guard=failure, environment=skipped.

```text
PROBE-PA03 job=record definition=probe-pa03-base
PROBE-PA03 job=record event_name=workflow_dispatch action= sender=jambolo
PROBE-PA03 job=record ref=refs/heads/probe-pa03-base sha=048af236bf9170270f1e03639337311fb80a5fae
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-events.yml@refs/heads/probe-pa03-base workflow_sha=048af236bf9170270f1e03639337311fb80a5fae
PROBE-PA03 job=record run_id=36081479448 run_attempt=1 utc=2026-09-25T01:19:17Z
PROBE-PA03 job=guard definition=probe-pa03-base event_name=workflow_dispatch ref=refs/heads/probe-pa03-base default_branch=master
PROBE-PA03 job=guard verdict=reject reason=non-default-ref
```

### E12 — dispatch D2 (no-guard variant on probe-pa03-base-noguard)

Run https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081510416, conclusion=failure.
Job states: record=success, guard=failure (rejects but is not `needs`-ed by environment), environment=failure
(refused before the script step ran — no `PROBE-PA03 job=environment` line was ever printed). Annotation:

```text
PROBE-PA03 job=record definition=probe-pa03-base-noguard
PROBE-PA03 job=record event_name=workflow_dispatch action= sender=jambolo
PROBE-PA03 job=record ref=refs/heads/probe-pa03-base-noguard sha=303616e73eecae372b0bbfb0a27117d9290bbe9c
PROBE-PA03 job=record workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa03-events.yml@refs/heads/probe-pa03-base-noguard workflow_sha=303616e73eecae372b0bbfb0a27117d9290bbe9c
PROBE-PA03 job=record run_id=36081510416 run_attempt=1 utc=2026-09-25T01:19:48Z
```

`gh run view 36081510416 -R steady-orchard/patch-steward-testbed-public` annotations:

```text
X Branch "probe-pa03-base-noguard" is not allowed to deploy to probe-pa03-default-branch due to environment protection rules.
environment: .github#1

X The deployment was rejected or didn't satisfy other protection rules.
environment: .github#1
```

## Deviations from the design

None.

## Residue

- Branches on org-public (steady-orchard/patch-steward-testbed-public): `probe-pa03-base`, `probe-pa03-base-noguard`,
  `probe-pa03-head-modify`, `probe-pa03-head-absent`, `probe-pa03-head-nd` (Phase 3 deletes the `probe-pa03-head-*`
  branches; the rest remain deployed probe fixtures).
- Branches on the fork (jambolo/patch-steward-testbed-public): `probe-pa03-head-fork-modify`,
  `probe-pa03-head-fork-absent`.
- PRs (closed, never merged): #13, #14, #16, #17, #18.
- Issue #19 (closed) with comments (ids 5825050006 corrupted-attempt, 5825082395 valid trigger).
- Deployed workflows: `probe-pa03-events.yml` on `master`, `probe-pa03-base` (variant), `probe-pa03-base-noguard`
  (variant); `probe-pa03-upstream.yml` on `master` and `probe-pa03-base`.
- Schedule files `probe-pa03-schedule.yml` and `probe-pa03-schedule-env.yml`: both `disabled_manually`.
- Environment `probe-pa03-default-branch` (deployment-branch policy: only `master`) with secret
  `PROBE_PA03_ENV_MARKER`: unchanged, still in place.
