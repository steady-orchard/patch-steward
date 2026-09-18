# PA01 — Required checks — personal

- assumption: PA01
- test-bed: jambolo/patch-steward-testbed-personal
- probed: 2026-09-25T02:10:00Z to 2026-09-25T02:26:20Z
- step: 2.11
- workflows: probe-pa01-sequence.yml 729009528d41dcddf5b414100198349e36a41686

## Results

| Sub-claim | Kind        | Result    | Cause | Evidence |
| --------- | ----------- | --------- | ----- | -------- |
| PA01.1    | assumption  | confirmed | none  | E1, E2   |
| PA01.2    | assumption  | confirmed | none  | E2       |
| PA01.3    | assumption  | confirmed | none  | E2       |
| PA01.4    | assumption  | confirmed | none  | E2       |
| PA01.5    | assumption  | confirmed | none  | E2, E5   |
| PA01.6    | assumption  | confirmed | none  | E2, E5   |
| PA01.7    | measurement | confirmed | none  | E2, E3   |

## Measurements

| Sub-claim | Quantity         | Value             | Unit | Method                                                                               | Samples |
| --------- | ---------------- | ----------------- | ---- | ------------------------------------------------------------------------------------ | ------- |
| PA01.7    | failure effect   | blocked (blocked) | -    | first 20-s poll after the write that showed the change: upper bound, 20 s resolution | 0       |
| PA01.7    | skipped effect   | satisfied (clean) | -    | first 20-s poll after the write that showed the change: upper bound, 20 s resolution | 0       |
| PA01.7    | timed_out effect | blocked (blocked) | -    | first 20-s poll after the write that showed the change: upper bound, 20 s resolution | 1       |
| PA01.7    | latency min      | 20                | s    | first 20-s poll after the write that showed the change: upper bound, 20 s resolution | 10      |
| PA01.7    | latency median   | 21                | s    | first 20-s poll after the write that showed the change: upper bound, 20 s resolution | 10      |
| PA01.7    | latency max      | 21                | s    | first 20-s poll after the write that showed the change: upper bound, 20 s resolution | 10      |

## Evidence

### E1 — ruleset read-back showing the required-checks rule on `refs/heads/probe-pa01-base` with the test App's integration id

`gh api repos/jambolo/patch-steward-testbed-personal/rulesets/23974157 --jq '{id, name, enforcement, include: .conditions.ref_name.include, rules: [.rules[] | {type, parameters}]}'`

```text
{"enforcement":"active","id":23974157,"include":["refs/heads/probe-pa01-base"],"name":"probe-pa01-required","rules":[{"parameters":{"do_not_enforce_on_create":false,"required_status_checks":[{"context":"probe-pa01/required","integration_id":4993303}],"strict_required_status_checks_policy":false},"type":"required_status_checks"}]}
```

### E2 — `settled=` lines of every step in run 36085111935

`gh run view 36085111935 -R jambolo/patch-steward-testbed-personal --log | grep -a "PROBE-PA01 " | grep "settled="`

```text
PROBE-PA01 step=S0 settled=blocked changed=yes latency_s=20 prev=start utc=2026-09-25T02:10:41Z
PROBE-PA01 step=S1a settled=blocked changed=no latency_s=none prev=blocked utc=2026-09-25T02:12:25Z
PROBE-PA01 step=S1b settled=clean changed=yes latency_s=20 prev=blocked utc=2026-09-25T02:12:46Z
PROBE-PA01 step=S2 settled=blocked changed=yes latency_s=20 prev=clean utc=2026-09-25T02:13:07Z
PROBE-PA01 step=S3 settled=blocked changed=no latency_s=none prev=blocked utc=2026-09-25T02:14:51Z
PROBE-PA01 step=S4 settled=clean changed=yes latency_s=20 prev=blocked utc=2026-09-25T02:15:12Z
PROBE-PA01 step=S5 settled=blocked changed=yes latency_s=21 prev=clean utc=2026-09-25T02:15:34Z
PROBE-PA01 step=S6 settled=clean changed=yes latency_s=21 prev=blocked utc=2026-09-25T02:15:55Z
PROBE-PA01 step=S7 settled=blocked changed=yes latency_s=21 prev=clean utc=2026-09-25T02:16:16Z
PROBE-PA01 step=S8a settled=blocked changed=no latency_s=none prev=blocked utc=2026-09-25T02:18:00Z
PROBE-PA01 step=S8b settled=clean changed=yes latency_s=21 prev=blocked utc=2026-09-25T02:18:21Z
PROBE-PA01 step=S8c settled=clean changed=no latency_s=none prev=clean utc=2026-09-25T02:20:04Z
PROBE-PA01 step=S9a settled=blocked changed=yes latency_s=21 prev=clean utc=2026-09-25T02:20:26Z
PROBE-PA01 step=S9b settled=blocked changed=no latency_s=none prev=blocked utc=2026-09-25T02:22:10Z
PROBE-PA01 step=S10a settled=clean changed=yes latency_s=21 prev=blocked utc=2026-09-25T02:22:31Z
PROBE-PA01 step=S10b settled=clean changed=no latency_s=none prev=clean utc=2026-09-25T02:24:15Z
PROBE-PA01 step=S11a settled=clean changed=no latency_s=none prev=clean utc=2026-09-25T02:25:59Z
PROBE-PA01 step=S11b settled=blocked changed=yes latency_s=21 prev=clean utc=2026-09-25T02:26:20Z
```

### E3 — `write=` lines of every step in run 36085111935

`gh run view 36085111935 -R jambolo/patch-steward-testbed-personal --log | grep -a "PROBE-PA01 " | grep "write="`

```text
PROBE-PA01 step=S0 write="app token commit to probe-pa01-head-1" head_sha=73c6ad5393f33ae10055afd1f9d009cd5d90670e utc=2026-09-25T02:10:00Z
PROBE-PA01 step=S1a write="app create in_progress (run A)" result="107915335197 patch-steward-testbed in_progress null" utc=2026-09-25T02:10:42Z
PROBE-PA01 step=S1b write="app complete run A success" result="107915335197 patch-steward-testbed completed success" utc=2026-09-25T02:12:26Z
PROBE-PA01 step=S2 write="app create in_progress (run B, same name, same commit)" result="107915794235 patch-steward-testbed in_progress null" utc=2026-09-25T02:12:47Z
PROBE-PA01 step=S3 write="app complete run B failure (A is an older success)" result="107915794235 patch-steward-testbed completed failure" utc=2026-09-25T02:13:08Z
PROBE-PA01 step=S4 write="app create completed neutral" result="107916245654 patch-steward-testbed completed neutral" utc=2026-09-25T02:14:52Z
PROBE-PA01 step=S5 write="app create completed action_required" result="107916327470 patch-steward-testbed completed action_required" utc=2026-09-25T02:15:13Z
PROBE-PA01 step=S6 write="app create completed success" result="107916407648 patch-steward-testbed completed success" utc=2026-09-25T02:15:34Z
PROBE-PA01 step=S7 write="app create completed cancelled" result="107916487079 patch-steward-testbed completed cancelled" utc=2026-09-25T02:15:55Z
PROBE-PA01 step=S8a write="app create in_progress (older run H1)" result="107916570113 patch-steward-testbed in_progress null" utc=2026-09-25T02:16:17Z
PROBE-PA01 step=S8b write="app create completed success (newer run H2)" result="107916942926 patch-steward-testbed completed success" utc=2026-09-25T02:18:00Z
PROBE-PA01 step=S8c write="app complete OLDER run H1 cancelled after newer H2 exists" result="107916570113 patch-steward-testbed completed cancelled" utc=2026-09-25T02:18:21Z
PROBE-PA01 step=S9a write="app create completed failure" result="107917380661 patch-steward-testbed completed failure" utc=2026-09-25T02:20:05Z
PROBE-PA01 step=S9b write="job GITHUB_TOKEN (app github-actions) create completed success" result="107917461379 github-actions completed success" utc=2026-09-25T02:20:26Z
PROBE-PA01 step=S10a write="app create completed success (reset)" result="107917815734 patch-steward-testbed completed success" utc=2026-09-25T02:22:10Z
PROBE-PA01 step=S10b write="app create completed skipped" result="107917889493 patch-steward-testbed completed skipped" utc=2026-09-25T02:22:32Z
PROBE-PA01 step=S11a write="app create completed success (reset)" result="107918264398 patch-steward-testbed completed success" utc=2026-09-25T02:24:15Z
PROBE-PA01 step=S11b write="app create completed timed_out" result="107918624490 patch-steward-testbed completed timed_out" utc=2026-09-25T02:25:59Z
```

### E4 — poll lines of the steps the decision rules cite (S0, S1b, S2, S3, S4, S5, S7, S8b, S8c, S9a, S9b, S10b, S11b); other steps elided

```text
PROBE-PA01 step=S0 poll=1 t_s=20 mergeable_state=blocked
PROBE-PA01 step=S1b poll=1 t_s=20 mergeable_state=clean
PROBE-PA01 step=S2 poll=1 t_s=20 mergeable_state=blocked
PROBE-PA01 step=S3 poll=1 t_s=21 mergeable_state=blocked
PROBE-PA01 step=S3 poll=2 t_s=41 mergeable_state=blocked
PROBE-PA01 step=S3 poll=3 t_s=62 mergeable_state=blocked
PROBE-PA01 step=S3 poll=4 t_s=83 mergeable_state=blocked
PROBE-PA01 step=S3 poll=5 t_s=103 mergeable_state=blocked
PROBE-PA01 step=S4 poll=1 t_s=20 mergeable_state=clean
PROBE-PA01 step=S5 poll=1 t_s=21 mergeable_state=blocked
PROBE-PA01 step=S7 poll=1 t_s=21 mergeable_state=blocked
PROBE-PA01 step=S8b poll=1 t_s=21 mergeable_state=clean
PROBE-PA01 step=S8c poll=1 t_s=21 mergeable_state=clean
PROBE-PA01 step=S8c poll=2 t_s=42 mergeable_state=clean
PROBE-PA01 step=S8c poll=3 t_s=62 mergeable_state=clean
PROBE-PA01 step=S8c poll=4 t_s=83 mergeable_state=clean
PROBE-PA01 step=S8c poll=5 t_s=103 mergeable_state=clean
PROBE-PA01 step=S9a poll=1 t_s=21 mergeable_state=blocked
PROBE-PA01 step=S9b poll=1 t_s=22 mergeable_state=blocked
PROBE-PA01 step=S9b poll=2 t_s=42 mergeable_state=blocked
PROBE-PA01 step=S9b poll=3 t_s=63 mergeable_state=blocked
PROBE-PA01 step=S9b poll=4 t_s=83 mergeable_state=blocked
PROBE-PA01 step=S9b poll=5 t_s=104 mergeable_state=blocked
PROBE-PA01 step=S10b poll=1 t_s=20 mergeable_state=clean
PROBE-PA01 step=S10b poll=2 t_s=41 mergeable_state=clean
PROBE-PA01 step=S10b poll=3 t_s=61 mergeable_state=clean
PROBE-PA01 step=S10b poll=4 t_s=82 mergeable_state=clean
PROBE-PA01 step=S10b poll=5 t_s=103 mergeable_state=clean
PROBE-PA01 step=S11b poll=1 t_s=21 mergeable_state=blocked
```

### E5 — `check_run`/`latest` lines and the two check-run app-id reads (App vs job `GITHUB_TOKEN`)

`gh run view 36085111935 -R jambolo/patch-steward-testbed-personal --log | grep -a "PROBE-PA01 " | grep -E "check_run|latest"`

```text
PROBE-PA01 check_run id=107915335197 app=patch-steward-testbed status=completed conclusion=success started_at=2026-09-25T02:10:42Z completed_at=2026-09-25T02:12:25Z
PROBE-PA01 check_run id=107915794235 app=patch-steward-testbed status=completed conclusion=failure started_at=2026-09-25T02:12:46Z completed_at=2026-09-25T02:13:08Z
PROBE-PA01 check_run id=107916245654 app=patch-steward-testbed status=completed conclusion=neutral started_at=2026-09-25T02:14:52Z completed_at=2026-09-25T02:14:52Z
PROBE-PA01 check_run id=107916327470 app=patch-steward-testbed status=completed conclusion=action_required started_at=2026-09-25T02:15:13Z completed_at=2026-09-25T02:15:13Z
PROBE-PA01 check_run id=107916407648 app=patch-steward-testbed status=completed conclusion=success started_at=2026-09-25T02:15:34Z completed_at=2026-09-25T02:15:34Z
PROBE-PA01 check_run id=107916487079 app=patch-steward-testbed status=completed conclusion=cancelled started_at=2026-09-25T02:15:55Z completed_at=2026-09-25T02:15:55Z
PROBE-PA01 check_run id=107916570113 app=patch-steward-testbed status=completed conclusion=cancelled started_at=2026-09-25T02:16:16Z completed_at=2026-09-25T02:18:21Z
PROBE-PA01 check_run id=107916942926 app=patch-steward-testbed status=completed conclusion=success started_at=2026-09-25T02:18:00Z completed_at=2026-09-25T02:18:00Z
PROBE-PA01 check_run id=107917380661 app=patch-steward-testbed status=completed conclusion=failure started_at=2026-09-25T02:20:05Z completed_at=2026-09-25T02:20:05Z
PROBE-PA01 check_run id=107917461379 app=github-actions status=completed conclusion=success started_at=2026-09-25T02:20:26Z completed_at=2026-09-25T02:20:26Z
PROBE-PA01 check_run id=107917815734 app=patch-steward-testbed status=completed conclusion=success started_at=2026-09-25T02:22:10Z completed_at=2026-09-25T02:22:10Z
PROBE-PA01 check_run id=107917889493 app=patch-steward-testbed status=completed conclusion=skipped started_at=2026-09-25T02:22:31Z completed_at=2026-09-25T02:22:31Z
PROBE-PA01 check_run id=107918264398 app=patch-steward-testbed status=completed conclusion=success started_at=2026-09-25T02:24:15Z completed_at=2026-09-25T02:24:15Z
PROBE-PA01 check_run id=107918624490 app=patch-steward-testbed status=completed conclusion=timed_out started_at=2026-09-25T02:25:59Z completed_at=2026-09-25T02:25:59Z
PROBE-PA01 latest id=107918624490 app=patch-steward-testbed status=completed conclusion=timed_out
PROBE-PA01 latest id=107917461379 app=github-actions status=completed conclusion=success
```

`gh api repos/jambolo/patch-steward-testbed-personal/check-runs/107915335197 --jq '{id, app_id: .app.id, conclusion}'`

```text
{"app_id":4993303,"conclusion":"success","id":107915335197}
```

`gh api repos/jambolo/patch-steward-testbed-personal/check-runs/107917461379 --jq '{id, app_id: .app.id, conclusion}'`

```text
{"app_id":15368,"conclusion":"success","id":107917461379}
```

The App check run's `app_id` (4993303) differs from the job-token check run's `app_id` (15368, `github-actions`).

### E6 — run URL

https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36085111935

## Deviations from the design

None.

## Residue

- Branch `probe-pa01-base` (created; permitted probe fixture, left in place).
- Branch `probe-pa01-head-1` (created; final head commit `73c6ad5393f33ae10055afd1f9d009cd5d90670e`; permitted probe fixture, left in place).
- Ruleset `probe-pa01-required` (id 23974157) on `jambolo/patch-steward-testbed-personal`, targeting `refs/heads/probe-pa01-base`, active; left in place.
- PR #1 `[probe PA01] required-check target` (head `probe-pa01-head-1`, base `probe-pa01-base`); closed, never merged.
- Workflow `.github/workflows/probe-pa01-sequence.yml` on `master`; left in place.
- Fourteen check runs named `probe-pa01/required` on commit `73c6ad5393f33ae10055afd1f9d009cd5d90670e` (ids listed in E5); cannot be deleted.
