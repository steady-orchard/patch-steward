# Smoke — Probe machinery — org-private

- assumption: smoke (setup the probes depend on; no PA identifier)
- test-bed: steady-orchard/patch-steward-testbed-private
- probed: 2026-09-24T21:01:36Z to 2026-09-24T21:01:58Z
- step: 1.5
- workflows: probe-smoke-machinery.yml 038e59c53b4b63b769f9116a9adbf84ad673d5a8

## Results

| Sub-claim     | Kind  | Result    | Cause | Evidence |
| ------------- | ----- | --------- | ----- | -------- |
| ssh-deploy    | setup | confirmed | none  | E1       |
| dispatch      | setup | confirmed | none  | E2, E3   |
| app-token     | setup | confirmed | none  | E3       |
| app-check-run | setup | confirmed | none  | E4       |
| artifact-list | setup | confirmed | none  | E5       |

## Measurements

| Sub-claim     | Quantity               | Value | Unit    | Method                                 | Samples |
| ------------- | ---------------------- | ----- | ------- | -------------------------------------- | ------- |
| artifact-list | listing attempts       | 1     | count   | PROBE-SMOKE listing_attempts log field | 1       |
| dispatch      | dispatch to completion | 22    | seconds | dispatch request utc to completed utc  | 1       |
| dispatch      | billed dispatches      | 1     | count   | count of dispatch.sh invocations       | 1       |

## Evidence

### E1 — deploy.sh pushed the workflow and verified blob identity

```text
bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-private master "probe(smoke): deploy probe-smoke-machinery.yml" probes/smoke/workflows/probe-smoke-machinery.yml
```

```text
DEPLOY repo=steady-orchard/patch-steward-testbed-private branch=master existed=yes
DEPLOY commit=c4e6506e5124c6a58bff36737bd672de8782fb72 message=probe(smoke): deploy probe-smoke-machinery.yml
DEPLOY push=ok attempt=1 head=c4e6506e5124c6a58bff36737bd672de8782fb72
DEPLOY identical dest=.github/workflows/probe-smoke-machinery.yml blob=038e59c53b4b63b769f9116a9adbf84ad673d5a8
```

### E2 — dispatch.sh dispatched, watched, and the run completed

```text
bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-private probe-smoke-machinery.yml master retention_canary=true
```

```text
DISPATCH requested workflow=probe-smoke-machinery.yml ref=master nonce=n20260924T210134Z-3221-19138 attempt=1 utc=2026-09-24T21:01:36Z
DISPATCH run_id=36058764257 url=https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36058764257
DISPATCH completed run_id=36058764257 conclusion=success utc=2026-09-24T21:01:58Z
```

### E3 — PROBE-SMOKE log lines of the run, and the downloaded artifact contents (app id masked by gh's own secret redaction; confirmed unmasked in E4)

```text
gh run view 36058764257 -R steady-orchard/patch-steward-testbed-private --log | grep -a "PROBE-SMOKE"
```

```text
PROBE-SMOKE check_run_id=107832339980 status=completed conclusion=neutral app_id=*** head_sha=c4e6506e5124c6a58bff36737bd672de8782fb72
PROBE-SMOKE repository=steady-orchard/patch-steward-testbed-private
PROBE-SMOKE run_id=36058764257
PROBE-SMOKE run_attempt=1
PROBE-SMOKE event_name=workflow_dispatch
PROBE-SMOKE ref=refs/heads/master
PROBE-SMOKE sha=c4e6506e5124c6a58bff36737bd672de8782fb72
PROBE-SMOKE installation_id=162868612
PROBE-SMOKE app_slug=patch-steward-testbed
PROBE-SMOKE check_run_id=107832339980
PROBE-SMOKE utc=2026-09-24T21:01:49Z
PROBE-SMOKE artifact_name=probe-smoke-36058764257-1 uploaded_artifact_id=10833188644
PROBE-SMOKE listed_artifact_id=10833188644 listing_attempts=1
PROBE-SMOKE retention_canary_artifact_name=probe-canary-retention retention_canary_artifact_id=10833138561
```

Downloaded artifact `probe-smoke-36058764257-1`, file `summary.txt`:

```text
gh run download 36058764257 -R steady-orchard/patch-steward-testbed-private -n probe-smoke-36058764257-1 -D <dir>
cat <dir>/summary.txt
```

```text
repository=steady-orchard/patch-steward-testbed-private
run_id=36058764257
run_attempt=1
event_name=workflow_dispatch
ref=refs/heads/master
sha=c4e6506e5124c6a58bff36737bd672de8782fb72
installation_id=162868612
app_slug=patch-steward-testbed
check_run_id=107832339980
utc=2026-09-24T21:01:49Z
```

### E4 — the check run exists under the test App

```text
gh api repos/steady-orchard/patch-steward-testbed-private/check-runs/107832339980 --jq '{id, name, status, conclusion, app_id: .app.id, head_sha}'
```

```text
{"app_id":4993303,"conclusion":"neutral","head_sha":"c4e6506e5124c6a58bff36737bd672de8782fb72","id":107832339980,"name":"probe-smoke/machinery","status":"completed"}
```

### E5 — the uploaded artifact is found in the repository-wide listing, and the retention canary artifact exists

```text
gh api "repos/steady-orchard/patch-steward-testbed-private/actions/artifacts?name=probe-smoke-36058764257-1" --jq '.artifacts[] | {id, name, created_at, expires_at}'
```

```text
{"created_at":"2026-09-24T21:01:51Z","expires_at":"2026-10-01T21:01:50Z","id":10833188644,"name":"probe-smoke-36058764257-1"}
```

```text
gh api "repos/steady-orchard/patch-steward-testbed-private/actions/artifacts?name=probe-canary-retention" --jq '.artifacts[] | {id, name, created_at, expires_at}'
```

```text
{"created_at":"2026-09-24T21:01:52Z","expires_at":"2026-09-25T21:01:51Z","id":10833138561,"name":"probe-canary-retention"}
```

## Deviations from the design

None: smoke tests no design claim.

## Residue

- deployed workflow `.github/workflows/probe-smoke-machinery.yml` at blob `038e59c53b4b63b769f9116a9adbf84ad673d5a8` on branch `master`.
- check run id `107832339980` (`probe-smoke/machinery`, conclusion `neutral`) on commit `c4e6506e5124c6a58bff36737bd672de8782fb72`; check runs cannot be deleted.
- artifact id `10833188644` (`probe-smoke-36058764257-1`), expires `2026-10-01T21:01:50Z`.
- artifact id `10833138561` (`probe-canary-retention`), expires `2026-09-25T21:01:51Z`.
