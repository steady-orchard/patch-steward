# PA05 — Round expansion and concurrency — org-public

- assumption: PA05
- test-bed: steady-orchard/patch-steward-testbed-public
- probed: 2026-09-25T01:15:14Z to 2026-09-25T01:25:00Z
- step: 2.5
- workflows: probe-pa05-rounds.yml 2a5f81fda18694fa3fba81837312ac371f6c7adf; probe-pa05-run.yml 572fb04ba1fad987e0e5d447af1fd55a12b140e1; probe-pa05-concurrency.yml 6ca8b370f4bb409779bc47083c859e01feaa8b35

## Results

| Sub-claim | Kind        | Result    | Cause | Evidence |
| --------- | ----------- | --------- | ----- | -------- |
| PA05.1    | assumption  | confirmed | none  | E1, E2   |
| PA05.2    | assumption  | confirmed | none  | E3, E4   |
| PA05.3    | assumption  | confirmed | none  | E4, E5   |
| PA05.4    | measurement | confirmed | none  | E2       |

## Measurements

| Sub-claim | Quantity                                   | Value | Unit  | Method                                                                                                                       | Samples |
| --------- | ------------------------------------------ | ----- | ----- | ---------------------------------------------------------------------------------------------------------------------------- | ------- |
| PA05.4    | jobs per run (exercised)                   | 8     | count | exercised (run 36081261442)                                                                                                  | 1       |
| PA05.4    | matrix jobs per run                        | 256   | count | documented https://docs.github.com/en/actions/reference/limits                                                               | 0       |
| PA05.4    | reusable nesting depth                     | 2     | count | exercised (run 36081261442)                                                                                                  | 1       |
| PA05.4    | reusable nesting depth (documented max)    | 10    | count | documented https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations                | 0       |
| PA05.4    | reusable workflows per file                | 50    | count | documented https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations                | 0       |
| PA05.4    | needs fan-in                               | 7     | count | exercised (run 36081261442)                                                                                                  | 1       |
| PA05.4    | round pairs                                | 3     | count | exercised (run 36081261442)                                                                                                  | 1       |
| PA05.4    | pending per concurrency group (default)    | 1     | count | documented https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency | 0       |
| PA05.4    | pending per concurrency group (queue: max) | 100   | count | documented https://docs.github.com/en/actions/reference/limits                                                               | 0       |

## Evidence

### E1 — PA05.1 job graphs of the three rounds_needed runs

```text
gh api repos/steady-orchard/patch-steward-testbed-public/actions/runs/<id>/jobs --jq '.jobs[] | "\(.name) \(.status) \(.conclusion)"'
```

Run https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081199569 (rounds_needed=1):

```text
screen / gate completed success
screen / execute-1 completed success
screen / assess-1 completed success
screen / execute-2 completed skipped
screen / assess-2 completed skipped
screen / publish completed success
screen / execute-3 completed skipped
screen / assess-3 completed skipped
```

Run https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081261442 (rounds_needed=3):

```text
screen / gate completed success
screen / execute-1 completed success
screen / assess-1 completed success
screen / execute-2 completed success
screen / assess-2 completed success
screen / execute-3 completed success
screen / assess-3 completed success
screen / publish completed success
```

Run https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081343508 (rounds_needed=2):

```text
screen / gate completed success
screen / execute-1 completed success
screen / assess-1 completed success
screen / execute-2 completed success
screen / assess-2 completed success
screen / publish completed success
screen / execute-3 completed skipped
screen / assess-3 completed skipped
```

### E2 — PA05.1 and PA05.4 PROBE-PA05 log lines (round handoff, budgets, publish, job count)

```text
gh run view <id> -R steady-orchard/patch-steward-testbed-public --log | grep -a "PROBE-PA05 " | sed -E 's/^.*(PROBE-PA05 )/\1/'
```

Run 36081199569 (rounds_needed=1):

```text
PROBE-PA05 label=rounds-1 job=gate rounds_needed=1 budget=100 utc=2026-09-25T01:15:18Z
PROBE-PA05 label=rounds-1 job=execute-1 budget_in=100 spent=10
PROBE-PA05 label=rounds-1 job=assess-1 artifact_content="round=1 budget_in=100 run_id=36081199569" budget_left=90 more=false
PROBE-PA05 label=rounds-1 job=publish ran=yes e1=success a1=success e2=skipped a2=skipped e3=skipped a3=skipped b1=90 b2= b3= utc=2026-09-25T01:15:38Z
```

Run 36081261442 (rounds_needed=3; 8 jobs total, needs fan-in of publish = 7, reusable nesting depth 2 (run.yml -> rounds.yml)):

```text
PROBE-PA05 label=rounds-3 job=gate rounds_needed=3 budget=100 utc=2026-09-25T01:16:06Z
PROBE-PA05 label=rounds-3 job=execute-1 budget_in=100 spent=10
PROBE-PA05 label=rounds-3 job=assess-1 artifact_content="round=1 budget_in=100 run_id=36081261442" budget_left=90 more=true
PROBE-PA05 label=rounds-3 job=execute-2 budget_in=90 spent=10
PROBE-PA05 label=rounds-3 job=assess-2 artifact_content="round=2 budget_in=90 run_id=36081261442" budget_left=80 more=true
PROBE-PA05 label=rounds-3 job=execute-3 budget_in=80 spent=10
PROBE-PA05 label=rounds-3 job=assess-3 artifact_content="round=3 budget_in=80 run_id=36081261442" budget_left=70 more=false
PROBE-PA05 label=rounds-3 job=publish ran=yes e1=success a1=success e2=success a2=success e3=success a3=success b1=90 b2=80 b3=70 utc=2026-09-25T01:16:56Z
```

Run 36081343508 (rounds_needed=2):

```text
PROBE-PA05 label=rounds-2 job=gate rounds_needed=2 budget=100 utc=2026-09-25T01:17:15Z
PROBE-PA05 label=rounds-2 job=execute-1 budget_in=100 spent=10
PROBE-PA05 label=rounds-2 job=assess-1 artifact_content="round=1 budget_in=100 run_id=36081343508" budget_left=90 more=true
PROBE-PA05 label=rounds-2 job=execute-2 budget_in=90 spent=10
PROBE-PA05 label=rounds-2 job=assess-2 artifact_content="round=2 budget_in=90 run_id=36081343508" budget_left=80 more=false
PROBE-PA05 label=rounds-2 job=publish ran=yes e1=success a1=success e2=success a2=success e3=skipped a3=skipped b1=90 b2=80 b3= utc=2026-09-25T01:17:47Z
```

### E3 — S1 (cancel_in_progress false): job times for R1, R2, R3

```text
gh api repos/steady-orchard/patch-steward-testbed-public/actions/runs/<id>/jobs --jq '.jobs[] | "\(.name) \(.status) \(.conclusion) started=\(.started_at) completed=\(.completed_at)"'
```

R1 https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081437153 (label s1-r1-1, subs A,B, sleep 150):

```text
other completed success started=2026-09-25T01:18:33Z completed=2026-09-25T01:21:06Z
work-B completed success started=2026-09-25T01:18:34Z completed=2026-09-25T01:21:06Z
work-A completed success started=2026-09-25T01:18:34Z completed=2026-09-25T01:21:06Z
```

R2 https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081476494 (label s1-r2-1, subs A, sleep 30; dispatched while R1's work-A was in_progress):

```text
other completed success started=2026-09-25T01:19:14Z completed=2026-09-25T01:19:46Z
work-A completed cancelled started=2026-09-25T01:19:05Z completed=2026-09-25T01:19:36Z
```

R3 https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081511872 (label s1-r3-1, subs A, sleep 30; dispatched while R2's work-A was pending):

```text
other completed success started=2026-09-25T01:20:27Z completed=2026-09-25T01:21:00Z
work-A completed success started=2026-09-25T01:21:09Z completed=2026-09-25T01:21:42Z
```

### E4 — S1 PROBE-PA05 log lines (actual execution windows, showing R2's work-A never logged a start/end line)

```text
gh run view <id> -R steady-orchard/patch-steward-testbed-public --log | grep -a "PROBE-PA05 " | sed -E 's/^.*(PROBE-PA05 )/\1/'
```

R1 (work-A and work-B, actual log lines):

```text
PROBE-PA05 label=s1-r1-1 job=other start_utc=2026-09-25T01:18:34Z
PROBE-PA05 label=s1-r1-1 job=other end_utc=2026-09-25T01:21:04Z
PROBE-PA05 label=s1-r1-1 job=work-B group=probe-pa05-sub-B start_utc=2026-09-25T01:18:34Z
PROBE-PA05 label=s1-r1-1 job=work-B end_utc=2026-09-25T01:21:04Z
PROBE-PA05 label=s1-r1-1 job=work-A group=probe-pa05-sub-A start_utc=2026-09-25T01:18:35Z
PROBE-PA05 label=s1-r1-1 job=work-A end_utc=2026-09-25T01:21:05Z
```

R2 (only `other` ran; work-A produced no PROBE-PA05 lines at all — it was cancelled while pending in the
`probe-pa05-sub-A` group and never started its run step):

```text
PROBE-PA05 label=s1-r2-1 job=other start_utc=2026-09-25T01:19:14Z
PROBE-PA05 label=s1-r2-1 job=other end_utc=2026-09-25T01:19:44Z
```

R3 (work-A started only after R1's work-A ended at 01:21:05Z):

```text
PROBE-PA05 label=s1-r3-1 job=other start_utc=2026-09-25T01:20:28Z
PROBE-PA05 label=s1-r3-1 job=other end_utc=2026-09-25T01:20:58Z
PROBE-PA05 label=s1-r3-1 job=work-A group=probe-pa05-sub-A start_utc=2026-09-25T01:21:10Z
PROBE-PA05 label=s1-r3-1 job=work-A end_utc=2026-09-25T01:21:40Z
```

### E5 — S2 (cancel_in_progress true): job times, log lines, and run conclusions for R4 and R5

Jobs (`gh api .../runs/<id>/jobs`):

R4 https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081718590 (label s2-r4-1, subs A,B, sleep 150; run conclusion `cancelled`):

```text
other completed success started=2026-09-25T01:22:26Z completed=2026-09-25T01:25:00Z
work-B completed success started=2026-09-25T01:22:25Z completed=2026-09-25T01:24:57Z
work-A completed cancelled started=2026-09-25T01:22:25Z completed=2026-09-25T01:23:14Z
```

R5 https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081756516 (label s2-r5-1, subs A, sleep 30; dispatched while R4's work-A was in_progress; run conclusion `success`):

```text
other completed success started=2026-09-25T01:22:57Z completed=2026-09-25T01:23:30Z
work-A completed success started=2026-09-25T01:23:16Z completed=2026-09-25T01:23:48Z
```

R4's PROBE-PA05 log lines show work-A started running (unlike S1's R2, whose replacement never started) and was
cut off mid-execution, with no end_utc line, while work-B and other ran to completion:

```text
PROBE-PA05 label=s2-r4-1 job=other start_utc=2026-09-25T01:22:27Z
PROBE-PA05 label=s2-r4-1 job=other end_utc=2026-09-25T01:24:57Z
PROBE-PA05 label=s2-r4-1 job=work-B group=probe-pa05-sub-B start_utc=2026-09-25T01:22:26Z
PROBE-PA05 label=s2-r4-1 job=work-B end_utc=2026-09-25T01:24:56Z
PROBE-PA05 label=s2-r4-1 job=work-A group=probe-pa05-sub-A start_utc=2026-09-25T01:22:26Z
```

R5's PROBE-PA05 log lines (work-A ran to completion, joining the group after R4's work-A was cancelled):

```text
PROBE-PA05 label=s2-r5-1 job=other start_utc=2026-09-25T01:22:58Z
PROBE-PA05 label=s2-r5-1 job=other end_utc=2026-09-25T01:23:28Z
PROBE-PA05 label=s2-r5-1 job=work-A group=probe-pa05-sub-A start_utc=2026-09-25T01:23:17Z
PROBE-PA05 label=s2-r5-1 job=work-A end_utc=2026-09-25T01:23:47Z
```

Run-level status/conclusion:

```text
gh api repos/steady-orchard/patch-steward-testbed-public/actions/runs/36081718590 --jq '.status+" "+(.conclusion//"")'
gh api repos/steady-orchard/patch-steward-testbed-public/actions/runs/36081756516 --jq '.status+" "+(.conclusion//"")'
```

```text
completed cancelled
completed success
```

## Deviations from the design

None.

## Residue

- deployed `.github/workflows/probe-pa05-rounds.yml` (blob `2a5f81fda18694fa3fba81837312ac371f6c7adf`),
  `.github/workflows/probe-pa05-run.yml` (blob `572fb04ba1fad987e0e5d447af1fd55a12b140e1`), and
  `.github/workflows/probe-pa05-concurrency.yml` (blob `6ca8b370f4bb409779bc47083c859e01feaa8b35`) on branch
  `master` of steady-orchard/patch-steward-testbed-public.
- runs 36081199569, 36081261442, 36081343508 (`probe-pa05-run.yml`); 36081437153, 36081476494, 36081511872,
  36081718590, 36081756516 (`probe-pa05-concurrency.yml`).
- artifacts `probe-pa05-round-1`, `probe-pa05-round-2`, `probe-pa05-round-3` uploaded by run 36081261442,
  retention 1 day.
