# PA01 — Required checks — org-public

- assumption: PA01
- test-bed: steady-orchard/patch-steward-testbed-public
- probed: 2026-09-25T01:16:30Z to 2026-09-25T01:32:45Z
- step: 2.1
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
| PA01.7    | latency median   | 20                | s    | first 20-s poll after the write that showed the change: upper bound, 20 s resolution | 10      |
| PA01.7    | latency max      | 20                | s    | first 20-s poll after the write that showed the change: upper bound, 20 s resolution | 10      |

## Evidence

### E1 — ruleset read-back showing the required-checks rule on `refs/heads/probe-pa01-base` with the test App's integration id

`gh api repos/steady-orchard/patch-steward-testbed-public/rulesets/23972100 --jq '{id, name, enforcement, include: .conditions.ref_name.include, rules: [.rules[] | {type, parameters}]}'`

```text
{"enforcement":"active","id":23972100,"include":["refs/heads/probe-pa01-base"],"name":"probe-pa01-required","rules":[{"parameters":{"do_not_enforce_on_create":false,"required_status_checks":[{"context":"probe-pa01/required","integration_id":4993303}],"strict_required_status_checks_policy":false},"type":"required_status_checks"}]}
```

### E2 — `settled=` lines of every step in run 36081289133

`gh run view 36081289133 -R steady-orchard/patch-steward-testbed-public --log | grep -a "PROBE-PA01 " | grep "settled="`

```text
PROBE-PA01 step=S0 settled=blocked changed=yes latency_s=21 prev=start utc=2026-09-25T01:17:13Z
PROBE-PA01 step=S1a settled=blocked changed=no latency_s=none prev=blocked utc=2026-09-25T01:18:56Z
PROBE-PA01 step=S1b settled=clean changed=yes latency_s=20 prev=blocked utc=2026-09-25T01:19:17Z
PROBE-PA01 step=S2 settled=blocked changed=yes latency_s=20 prev=clean utc=2026-09-25T01:19:38Z
PROBE-PA01 step=S3 settled=blocked changed=no latency_s=none prev=blocked utc=2026-09-25T01:21:21Z
PROBE-PA01 step=S4 settled=clean changed=yes latency_s=20 prev=blocked utc=2026-09-25T01:21:42Z
PROBE-PA01 step=S5 settled=blocked changed=yes latency_s=20 prev=clean utc=2026-09-25T01:22:03Z
PROBE-PA01 step=S6 settled=clean changed=yes latency_s=20 prev=blocked utc=2026-09-25T01:22:24Z
PROBE-PA01 step=S7 settled=blocked changed=yes latency_s=20 prev=clean utc=2026-09-25T01:22:45Z
PROBE-PA01 step=S8a settled=blocked changed=no latency_s=none prev=blocked utc=2026-09-25T01:24:28Z
PROBE-PA01 step=S8b settled=clean changed=yes latency_s=20 prev=blocked utc=2026-09-25T01:24:49Z
PROBE-PA01 step=S8c settled=clean changed=no latency_s=none prev=clean utc=2026-09-25T01:26:32Z
PROBE-PA01 step=S9a settled=blocked changed=yes latency_s=20 prev=clean utc=2026-09-25T01:26:53Z
PROBE-PA01 step=S9b settled=blocked changed=no latency_s=none prev=blocked utc=2026-09-25T01:28:36Z
PROBE-PA01 step=S10a settled=clean changed=yes latency_s=20 prev=blocked utc=2026-09-25T01:28:57Z
PROBE-PA01 step=S10b settled=clean changed=no latency_s=none prev=clean utc=2026-09-25T01:30:40Z
PROBE-PA01 step=S11a settled=clean changed=no latency_s=none prev=clean utc=2026-09-25T01:32:23Z
PROBE-PA01 step=S11b settled=blocked changed=yes latency_s=20 prev=clean utc=2026-09-25T01:32:44Z
```

### E3 — `write=` lines of every step in run 36081289133

`gh run view 36081289133 -R steady-orchard/patch-steward-testbed-public --log | grep -a "PROBE-PA01 " | grep "write="`

```text
PROBE-PA01 step=S0 write="app token commit to probe-pa01-head-1" head_sha=71d4b98ae903cb401886c01f1449cfdf352dc32b utc=2026-09-25T01:16:32Z
PROBE-PA01 step=S1a write="app create in_progress (run A)" result="107903774685 patch-steward-testbed in_progress null" utc=2026-09-25T01:17:13Z
PROBE-PA01 step=S1b write="app complete run A success" result="107903774685 patch-steward-testbed completed success" utc=2026-09-25T01:18:57Z
PROBE-PA01 step=S2 write="app create in_progress (run B, same name, same commit)" result="107904235392 patch-steward-testbed in_progress null" utc=2026-09-25T01:19:18Z
PROBE-PA01 step=S3 write="app complete run B failure (A is an older success)" result="107904235392 patch-steward-testbed completed failure" utc=2026-09-25T01:19:38Z
PROBE-PA01 step=S4 write="app create completed neutral" result="107904696861 patch-steward-testbed completed neutral" utc=2026-09-25T01:21:22Z
PROBE-PA01 step=S5 write="app create completed action_required" result="107904779266 patch-steward-testbed completed action_required" utc=2026-09-25T01:21:43Z
PROBE-PA01 step=S6 write="app create completed success" result="107904856363 patch-steward-testbed completed success" utc=2026-09-25T01:22:04Z
PROBE-PA01 step=S7 write="app create completed cancelled" result="107904936306 patch-steward-testbed completed cancelled" utc=2026-09-25T01:22:25Z
PROBE-PA01 step=S8a write="app create in_progress (older run H1)" result="107905011615 patch-steward-testbed in_progress null" utc=2026-09-25T01:22:46Z
PROBE-PA01 step=S8b write="app create completed success (newer run H2)" result="107905383673 patch-steward-testbed completed success" utc=2026-09-25T01:24:29Z
PROBE-PA01 step=S8c write="app complete OLDER run H1 cancelled after newer H2 exists" result="107905011615 patch-steward-testbed completed cancelled" utc=2026-09-25T01:24:50Z
PROBE-PA01 step=S9a write="app create completed failure" result="107905846626 patch-steward-testbed completed failure" utc=2026-09-25T01:26:33Z
PROBE-PA01 step=S9b write="job GITHUB_TOKEN (app github-actions) create completed success" result="107905923889 github-actions completed success" utc=2026-09-25T01:26:54Z
PROBE-PA01 step=S10a write="app create completed success (reset)" result="107906301096 patch-steward-testbed completed success" utc=2026-09-25T01:28:37Z
PROBE-PA01 step=S10b write="app create completed skipped" result="107906378459 patch-steward-testbed completed skipped" utc=2026-09-25T01:28:58Z
PROBE-PA01 step=S11a write="app create completed success (reset)" result="107906768321 patch-steward-testbed completed success" utc=2026-09-25T01:30:41Z
PROBE-PA01 step=S11b write="app create completed timed_out" result="107907149604 patch-steward-testbed completed timed_out" utc=2026-09-25T01:32:24Z
```

### E4 — poll lines of the steps the decision rules cite (S0, S1b, S2, S3, S4, S5, S7, S8b, S8c, S9a, S9b, S10b, S11b); other steps elided

```text
PROBE-PA01 step=S0 poll=1 t_s=21 mergeable_state=blocked
PROBE-PA01 step=S1b poll=1 t_s=20 mergeable_state=clean
PROBE-PA01 step=S2 poll=1 t_s=20 mergeable_state=blocked
PROBE-PA01 step=S3 poll=1 t_s=21 mergeable_state=blocked
PROBE-PA01 step=S3 poll=2 t_s=42 mergeable_state=blocked
PROBE-PA01 step=S3 poll=3 t_s=62 mergeable_state=blocked
PROBE-PA01 step=S3 poll=4 t_s=83 mergeable_state=blocked
PROBE-PA01 step=S3 poll=5 t_s=103 mergeable_state=blocked
PROBE-PA01 step=S4 poll=1 t_s=20 mergeable_state=clean
PROBE-PA01 step=S5 poll=1 t_s=20 mergeable_state=blocked
PROBE-PA01 step=S7 poll=1 t_s=20 mergeable_state=blocked
PROBE-PA01 step=S8b poll=1 t_s=20 mergeable_state=clean
PROBE-PA01 step=S8c poll=1 t_s=20 mergeable_state=clean
PROBE-PA01 step=S8c poll=2 t_s=41 mergeable_state=clean
PROBE-PA01 step=S8c poll=3 t_s=61 mergeable_state=clean
PROBE-PA01 step=S8c poll=4 t_s=82 mergeable_state=clean
PROBE-PA01 step=S8c poll=5 t_s=102 mergeable_state=clean
PROBE-PA01 step=S9a poll=1 t_s=20 mergeable_state=blocked
PROBE-PA01 step=S9b poll=1 t_s=20 mergeable_state=blocked
PROBE-PA01 step=S9b poll=2 t_s=41 mergeable_state=blocked
PROBE-PA01 step=S9b poll=3 t_s=61 mergeable_state=blocked
PROBE-PA01 step=S9b poll=4 t_s=82 mergeable_state=blocked
PROBE-PA01 step=S9b poll=5 t_s=102 mergeable_state=blocked
PROBE-PA01 step=S10b poll=1 t_s=20 mergeable_state=clean
PROBE-PA01 step=S10b poll=2 t_s=41 mergeable_state=clean
PROBE-PA01 step=S10b poll=3 t_s=61 mergeable_state=clean
PROBE-PA01 step=S10b poll=4 t_s=82 mergeable_state=clean
PROBE-PA01 step=S10b poll=5 t_s=102 mergeable_state=clean
PROBE-PA01 step=S11b poll=1 t_s=20 mergeable_state=blocked
```

### E5 — `check_run`/`latest` lines and the two check-run app-id reads (App vs job `GITHUB_TOKEN`)

`gh run view 36081289133 -R steady-orchard/patch-steward-testbed-public --log | grep -a "PROBE-PA01 " | grep -E "check_run|latest"`

```text
PROBE-PA01 check_run id=107903774685 app=patch-steward-testbed status=completed conclusion=success started_at=2026-09-25T01:17:13Z completed_at=2026-09-25T01:18:56Z
PROBE-PA01 check_run id=107904235392 app=patch-steward-testbed status=completed conclusion=failure started_at=2026-09-25T01:19:17Z completed_at=2026-09-25T01:19:38Z
PROBE-PA01 check_run id=107904696861 app=patch-steward-testbed status=completed conclusion=neutral started_at=2026-09-25T01:21:21Z completed_at=2026-09-25T01:21:21Z
PROBE-PA01 check_run id=107904779266 app=patch-steward-testbed status=completed conclusion=action_required started_at=2026-09-25T01:21:42Z completed_at=2026-09-25T01:21:42Z
PROBE-PA01 check_run id=107904856363 app=patch-steward-testbed status=completed conclusion=success started_at=2026-09-25T01:22:03Z completed_at=2026-09-25T01:22:03Z
PROBE-PA01 check_run id=107904936306 app=patch-steward-testbed status=completed conclusion=cancelled started_at=2026-09-25T01:22:24Z completed_at=2026-09-25T01:22:24Z
PROBE-PA01 check_run id=107905011615 app=patch-steward-testbed status=completed conclusion=cancelled started_at=2026-09-25T01:22:45Z completed_at=2026-09-25T01:24:49Z
PROBE-PA01 check_run id=107905383673 app=patch-steward-testbed status=completed conclusion=success started_at=2026-09-25T01:24:29Z completed_at=2026-09-25T01:24:29Z
PROBE-PA01 check_run id=107905846626 app=patch-steward-testbed status=completed conclusion=failure started_at=2026-09-25T01:26:32Z completed_at=2026-09-25T01:26:32Z
PROBE-PA01 check_run id=107905923889 app=github-actions status=completed conclusion=success started_at=2026-09-25T01:26:53Z completed_at=2026-09-25T01:26:53Z
PROBE-PA01 check_run id=107906301096 app=patch-steward-testbed status=completed conclusion=success started_at=2026-09-25T01:28:36Z completed_at=2026-09-25T01:28:36Z
PROBE-PA01 check_run id=107906378459 app=patch-steward-testbed status=completed conclusion=skipped started_at=2026-09-25T01:28:57Z completed_at=2026-09-25T01:28:57Z
PROBE-PA01 check_run id=107906768321 app=patch-steward-testbed status=completed conclusion=success started_at=2026-09-25T01:30:40Z completed_at=2026-09-25T01:30:40Z
PROBE-PA01 check_run id=107907149604 app=patch-steward-testbed status=completed conclusion=timed_out started_at=2026-09-25T01:32:23Z completed_at=2026-09-25T01:32:23Z
PROBE-PA01 latest id=107907149604 app=patch-steward-testbed status=completed conclusion=timed_out
PROBE-PA01 latest id=107905923889 app=github-actions status=completed conclusion=success
```

`gh api repos/steady-orchard/patch-steward-testbed-public/check-runs/107903774685 --jq '{id, app_id: .app.id, conclusion}'`

```text
{"app_id":4993303,"conclusion":"success","id":107903774685}
```

`gh api repos/steady-orchard/patch-steward-testbed-public/check-runs/107905923889 --jq '{id, app_id: .app.id, conclusion}'`

```text
{"app_id":15368,"conclusion":"success","id":107905923889}
```

The App check run's `app_id` (4993303) differs from the job-token check run's `app_id` (15368, `github-actions`).

### E6 — run URL

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081289133

## Deviations from the design

None.

## Residue

- Branch `probe-pa01-base` (created; permitted probe fixture, left in place).
- Branch `probe-pa01-head-1` (created; final head commit `71d4b98ae903cb401886c01f1449cfdf352dc32b`; permitted probe fixture, left in place).
- Ruleset `probe-pa01-required` (id 23972100) on `steady-orchard/patch-steward-testbed-public`, targeting `refs/heads/probe-pa01-base`, active; left in place.
- PR #6 `[probe PA01] required-check target` (head `probe-pa01-head-1`, base `probe-pa01-base`); closed, never merged.
- Workflow `.github/workflows/probe-pa01-sequence.yml` on `master`; left in place.
- Fourteen check runs named `probe-pa01/required` on commit `71d4b98ae903cb401886c01f1449cfdf352dc32b` (ids listed in E5); cannot be deleted.
