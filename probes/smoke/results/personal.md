# Smoke — Probe machinery — personal

- assumption: smoke (setup the probes depend on; no PA identifier)
- test-bed: jambolo/patch-steward-testbed-personal
- probed: 2026-09-24T21:05:31Z to 2026-09-24T21:06:48Z
- step: 1.6
- workflows: probe-smoke-machinery.yml 038e59c53b4b63b769f9116a9adbf84ad673d5a8

## Results

| Sub-claim     | Kind  | Result    | Cause | Evidence |
| ------------- | ----- | --------- | ----- | -------- |
| ssh-deploy    | setup | confirmed | none  | E1       |
| dispatch      | setup | confirmed | none  | E2, E3   |
| app-token     | setup | confirmed | none  | E3       |
| app-check-run | setup | confirmed | none  | E4       |
| artifact-list | setup | confirmed | none  | E5       |
| copilot-smoke | setup | confirmed | none  | E6       |

## Measurements

| Sub-claim     | Quantity               | Value | Unit    | Method                                 | Samples |
| ------------- | ---------------------- | ----- | ------- | -------------------------------------- | ------- |
| artifact-list | listing attempts       | 1     | count   | PROBE-SMOKE listing_attempts log field | 1       |
| dispatch      | dispatch to completion | 22    | seconds | dispatch request utc to completed utc  | 1       |
| copilot-smoke | prompts spent          | 1     | count   | runs whose log has copilot_request_utc | 1       |

## Evidence

### E1 — deploy.sh pushed the workflow and verified blob identity

```text
bash probes/smoke/tools/deploy.sh jambolo/patch-steward-testbed-personal master "probe(smoke): deploy probe-smoke-machinery.yml" probes/smoke/workflows/probe-smoke-machinery.yml
```

```text
DEPLOY repo=jambolo/patch-steward-testbed-personal branch=master existed=yes
DEPLOY commit=b420b4ce91c0dbfe816d7250d48b8ac02107b9b8 message=probe(smoke): deploy probe-smoke-machinery.yml
DEPLOY push=ok attempt=1 head=b420b4ce91c0dbfe816d7250d48b8ac02107b9b8
DEPLOY identical dest=.github/workflows/probe-smoke-machinery.yml blob=038e59c53b4b63b769f9116a9adbf84ad673d5a8
```

### E2 — dispatch.sh dispatched, watched, and PART A run completed

```text
bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-smoke-machinery.yml master
```

```text
DISPATCH requested workflow=probe-smoke-machinery.yml ref=master nonce=n20260924T210531Z-3438-2924 attempt=1 utc=2026-09-24T21:05:34Z
DISPATCH run_id=36059206514 url=https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36059206514
DISPATCH completed run_id=36059206514 conclusion=success utc=2026-09-24T21:05:56Z
```

### E3 — PROBE-SMOKE log lines of the PART A run, and the downloaded artifact contents (app id masked by gh's own secret redaction; confirmed unmasked in E4)

```text
gh run view 36059206514 -R jambolo/patch-steward-testbed-personal --log | grep -a "PROBE-SMOKE"
```

```text
PROBE-SMOKE check_run_id=107833788656 status=completed conclusion=neutral app_id=*** head_sha=b420b4ce91c0dbfe816d7250d48b8ac02107b9b8
PROBE-SMOKE repository=jambolo/patch-steward-testbed-personal
PROBE-SMOKE run_id=36059206514
PROBE-SMOKE run_attempt=1
PROBE-SMOKE event_name=workflow_dispatch
PROBE-SMOKE ref=refs/heads/master
PROBE-SMOKE sha=b420b4ce91c0dbfe816d7250d48b8ac02107b9b8
PROBE-SMOKE installation_id=162875728
PROBE-SMOKE app_slug=patch-steward-testbed
PROBE-SMOKE check_run_id=107833788656
PROBE-SMOKE utc=2026-09-24T21:05:45Z
PROBE-SMOKE artifact_name=probe-smoke-36059206514-1 uploaded_artifact_id=10833258806
PROBE-SMOKE listed_artifact_id=10833258806 listing_attempts=1
```

Downloaded artifact `probe-smoke-36059206514-1`, file `summary.txt`:

```text
gh run download 36059206514 -R jambolo/patch-steward-testbed-personal -n probe-smoke-36059206514-1 -D <dir>
cat <dir>/summary.txt
```

```text
repository=jambolo/patch-steward-testbed-personal
run_id=36059206514
run_attempt=1
event_name=workflow_dispatch
ref=refs/heads/master
sha=b420b4ce91c0dbfe816d7250d48b8ac02107b9b8
installation_id=162875728
app_slug=patch-steward-testbed
check_run_id=107833788656
utc=2026-09-24T21:05:45Z
```

### E4 — the check run exists under the test App

```text
gh api repos/jambolo/patch-steward-testbed-personal/check-runs/107833788656 --jq '{id, name, status, conclusion, app_id: .app.id, head_sha}'
```

```text
{"app_id":4993303,"conclusion":"neutral","head_sha":"b420b4ce91c0dbfe816d7250d48b8ac02107b9b8","id":107833788656,"name":"probe-smoke/machinery","status":"completed"}
```

### E5 — the uploaded artifact is found in the repository-wide listing

```text
gh api "repos/jambolo/patch-steward-testbed-personal/actions/artifacts?name=probe-smoke-36059206514-1" --jq '.artifacts[] | {id, name, created_at, expires_at}'
```

```text
{"created_at":"2026-09-24T21:05:46Z","expires_at":"2026-10-01T21:05:45Z","id":10833258806,"name":"probe-smoke-36059206514-1"}
```

### E6 — PROBE-SMOKE copilot_ lines of the PART B run

```text
bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-smoke-machinery.yml master copilot=true
gh run view 36059305382 -R jambolo/patch-steward-testbed-personal --log | grep -a "PROBE-SMOKE copilot_"
```

```text
PROBE-SMOKE copilot_cli_version=GitHub Copilot CLI 1.0.88.
PROBE-SMOKE copilot_request_utc=2026-09-24T21:06:37Z
PROBE-SMOKE copilot_exit=0
PROBE-SMOKE copilot_stdout: ready
PROBE-SMOKE copilot_stdout:
PROBE-SMOKE copilot_stderr:
PROBE-SMOKE copilot_stderr:
PROBE-SMOKE copilot_stderr: Changes    +0 -0
PROBE-SMOKE copilot_stderr: Requests   1 Premium (1s)
PROBE-SMOKE copilot_stderr: Tokens     ↑ 10.6k (10.6k written) • ↓ 5
PROBE-SMOKE copilot_stderr: Resume     copilot --resume=c6f68ebf-efb5-4278-83ad-343c7d5d1e89
PROBE-SMOKE copilot_done_utc=2026-09-24T21:06:39Z
```

## Deviations from the design

None: smoke tests no design claim.

## Residue

- deployed workflow `.github/workflows/probe-smoke-machinery.yml` at blob `038e59c53b4b63b769f9116a9adbf84ad673d5a8` on branch `master`.
- check run id `107833788656` (`probe-smoke/machinery`, conclusion `neutral`) on commit `b420b4ce91c0dbfe816d7250d48b8ac02107b9b8` (PART A); check runs cannot be deleted.
- check run id `107834095458` (`probe-smoke/machinery`, conclusion `neutral`) on commit `b420b4ce91c0dbfe816d7250d48b8ac02107b9b8` (PART B); check runs cannot be deleted.
- artifact id `10833258806` (`probe-smoke-36059206514-1`), expires `2026-10-01T21:05:45Z`.
- artifact id `10834295563` (`probe-smoke-36059305382-1`), expires `2026-10-01T21:06:34Z`.
