# PA02 — Ownership artifacts — org-private

- assumption: PA02
- test-bed: steady-orchard/patch-steward-testbed-private
- probed: 2026-09-25T02:09:07Z to 2026-09-25T02:13:43Z
- step: 2.12
- workflows: probe-pa02-upload.yml 10caaa1b5b0844e76d6e50388d6439773930de02; probe-pa02-list.yml 982782742b11a2dd9e9249977c59d2e21324e275

## Results

| Sub-claim | Kind        | Result    | Cause | Evidence |
| --------- | ----------- | --------- | ----- | -------- |
| PA02.1    | assumption  | confirmed | none  | E1       |
| PA02.4    | assumption  | confirmed | none  | E2       |
| PA02.6    | measurement | confirmed | none  | E3,E4    |
| PA02.7    | measurement | confirmed | none  | E5,E6    |

## Measurements

| Sub-claim | Quantity                    | Value                                                                     | Unit      | Method                                                                            | Samples |
| --------- | --------------------------- | ------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------- | ------- |
| PA02.6    | requested=0 accepted/days   | yes / 90                                                                  | days      | resulting days = round(expires_at - created_at)                                   | 1       |
| PA02.6    | requested=1 accepted/days   | yes / 1                                                                   | days      | resulting days = round(expires_at - created_at)                                   | 1       |
| PA02.6    | requested=90 accepted/days  | yes / 90                                                                  | days      | resulting days = round(expires_at - created_at)                                   | 1       |
| PA02.6    | requested=400 accepted/days | yes / 90 (capped)                                                         | days      | resulting days = round(expires_at - created_at)                                   | 1       |
| PA02.6    | repository cap              | 90                                                                        | days      | GET repos/.../actions/permissions/artifact-and-log-retention maximum_allowed_days | 1       |
| PA02.6    | repository default          | 90                                                                        | days      | GET repos/.../actions/permissions/artifact-and-log-retention days                 | 1       |
| PA02.6    | organization cap            | 400                                                                       | days      | GET orgs/steady-orchard/actions/permissions/artifact-and-log-retention            | 1       |
| PA02.7    | per_page maximum            | 11 (all available; cap not reached)                                       | artifacts | per_page=101 request against an 11-artifact private repository                    | 1       |
| PA02.7    | pagination                  | yes                                                                       | bool      | Link header present with rel=next/last                                            | 1       |
| PA02.7    | list with job token         | yes                                                                       | bool      | job GITHUB_TOKEN, actions:read, listing succeeded                                 | 1       |
| PA02.7    | list with App token         | yes                                                                       | bool      | App installation token, actions:read, listing succeeded                           | 1       |
| PA02.7    | list with local user token  | yes                                                                       | bool      | gh api with local user token, listing succeeded                                   | 1       |
| PA02.7    | download with job token     | yes                                                                       | bool      | job GITHUB_TOKEN download exit=0                                                  | 1       |
| PA02.7    | download with App token     | yes                                                                       | bool      | App installation token download exit=0                                            | 1       |
| PA02.7    | requests per query          | 1                                                                         | count     | one REST call per page; header x-ratelimit-resource=core                          | 1       |
| PA02.7    | rate limit headers          | job limit=5000 used=16; app limit=5000 used=79; user limit=5000 used=1333 | requests  | X-Ratelimit-Limit/Used headers as observed                                        | 1       |

## Evidence

### E1 — PA02.1 names mode: four design-form names uploaded, each exact query returns only its own name, decoy query returns 0

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085064026

```text
PROBE-PA02 start mode=names run_id=36085064026 run_attempt=1 sha=8b65fa26fd5d45d98710fe16c2e55cac6364baf4 utc=2026-09-25T02:09:16Z
PROBE-PA02 names uploaded pr-90=10842424153 pr-901=10842953586 issue-90=10842584130 group=10842449308 group_name=steward-ownership-group-8b65fa26fd5d45d98710fe16c2e55cac6364baf4
PROBE-PA02 names query=steward-ownership-pr-90 total_count=1 returned_names=steward-ownership-pr-90 this_run_ids=10842424153
PROBE-PA02 names query=steward-ownership-pr-901 total_count=1 returned_names=steward-ownership-pr-901 this_run_ids=10842953586
PROBE-PA02 names query=steward-ownership-issue-90 total_count=1 returned_names=steward-ownership-issue-90 this_run_ids=10842584130
PROBE-PA02 names query=steward-ownership-group-8b65fa26fd5d45d98710fe16c2e55cac6364baf4 total_count=1 returned_names=steward-ownership-group-8b65fa26fd5d45d98710fe16c2e55cac6364baf4 this_run_ids=10842449308
PROBE-PA02 names query=steward-ownership-pr-9 total_count=0 returned_names= this_run_ids=
```

All four uploads succeeded with ids; each exact query returned only its own name and included this run's id; the
decoy prefix query `steward-ownership-pr-9` returned `total_count=0` (no partial/prefix matching).

### E2 — PA02.4 find during the uploader's hold, then the uploader run

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085109310 (find, concurrent) and
https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085102711 (uploader, `hold_seconds=150`)

```text
PROBE-PA02 find start run_id=36085109310 utc=2026-09-25T02:09:56Z
PROBE-PA02 find name=probe-pa02-live-1 total_count=1 waited_s=1 utc=2026-09-25T02:09:57Z
PROBE-PA02 find artifact id=10843740264 name=probe-pa02-live-1 created_at=2026-09-25T02:09:49Z expires_at=2026-09-26T02:09:49Z workflow_run=36085102711 uploader_now: status=in_progress conclusion=null run_attempt=1  observed_utc=2026-09-25T02:09:57Z
PROBE-PA02 single name=probe-pa02-live-1 artifact_id=10843740264 upload_done_utc=2026-09-25T02:09:49Z run_id=36085102711 run_attempt=1
PROBE-PA02 single artifact_id=10843740264 first_visible_utc=2026-09-25T02:09:50Z delay_s=1 checks=1
PROBE-PA02 hold_start_utc=2026-09-25T02:09:50Z hold_s=150
PROBE-PA02 hold_end_utc=2026-09-25T02:12:20Z
```

The find run's listing shows `workflow_run=36085102711` (the uploader) with `uploader_now: status=in_progress`,
observed at 02:09:57Z, while the uploader's own hold did not end until 02:12:20Z - the artifact was listed
repository-wide well before the uploading run completed.

### E3 — PA02.6 retention: requested 0, 1, 90, 400 days

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085316592

```text
PROBE-PA02 start mode=retention run_id=36085316592 run_attempt=1 sha=2d2beba175d734c8b3a0af4fe4788e8b6d1ba471 utc=2026-09-25T02:12:51Z
PROBE-PA02 retention requested=0 outcome=success id=10842594252 created_at=2026-09-25T02:12:52Z expires_at=2026-12-24T02:12:46Z
PROBE-PA02 retention requested=1 outcome=success id=10842629292 created_at=2026-09-25T02:12:53Z expires_at=2026-09-26T02:12:52Z
PROBE-PA02 retention requested=90 outcome=success id=10842514422 created_at=2026-09-25T02:12:54Z expires_at=2026-12-24T02:12:46Z
PROBE-PA02 retention requested=400 outcome=success id=10842599401 created_at=2026-09-25T02:12:55Z expires_at=2026-12-24T02:12:46Z
PROBE-PA02 retention settings_read_with_job_token={"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest/actions/permissions#get-artifact-and-log-retention-settings-for-a-repository","status":"403"}gh: Resource not accessible by integration (HTTP 403)
```

requested=0, 90, and 400 all resolved to the same 90-day expiry (2026-09-25 to 2026-12-24); requested=1 resolved
to 1 day. All four uploads reported `outcome=success` - the repository cap silently clamps out-of-range or default
requests rather than rejecting the upload. The job token (`actions:read`) cannot read the repository's retention
settings (403); this local (App/user) read (E4) supplied them instead.

### E4 — PA02.6 repository and organization retention settings (private repository)

```text
$ gh api repos/steady-orchard/patch-steward-testbed-private/actions/permissions/artifact-and-log-retention
{"days":90,"maximum_allowed_days":90}
$ gh api orgs/steady-orchard/actions/permissions/artifact-and-log-retention
{"days":90,"maximum_allowed_days":400}
```

Repository default and cap are both 90 days for this private repository; the organization's own cap is 400 days,
but the repository's `maximum_allowed_days` of 90 is the binding limit observed above - matching the org-public
result (step 2.2): visibility does not change the retention bounds within this organization.

### E5 — PA02.7 listing bounds and costs with job and App tokens

https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36085361146

```text
PROBE-PA02 bounds token=job headers: HTTP/2.0 200 OK Link: <...?per_page=1&page=2>; rel="next", <...?per_page=1&page=11>; rel="last" X-Ratelimit-Limit: 5000 X-Ratelimit-Remaining: 4984 X-Ratelimit-Resource: core X-Ratelimit-Used: 16
PROBE-PA02 bounds token=job per_page=100 total_count=11 returned=11
PROBE-PA02 bounds token=job per_page=101 total_count=11 returned=11
PROBE-PA02 bounds token=job page=2&per_page=1 returned=1 id=10842953586
PROBE-PA02 bounds token=job name=probe-pa02-live-1 total_count=1 returned=1
PROBE-PA02 bounds token=job download id=10843740264 exit=0 bytes=238 first_line=repository=steady-orchard/patch-steward-testbed-private error=
PROBE-PA02 bounds token=app headers: HTTP/2.0 200 OK Link: <...?per_page=1&page=2>; rel="next", <...?per_page=1&page=11>; rel="last" X-Ratelimit-Limit: 5000 X-Ratelimit-Remaining: 4921 X-Ratelimit-Resource: core X-Ratelimit-Used: 79
PROBE-PA02 bounds token=app per_page=100 total_count=11 returned=11
PROBE-PA02 bounds token=app per_page=101 total_count=11 returned=11
PROBE-PA02 bounds token=app page=2&per_page=1 returned=1 id=10842953586
PROBE-PA02 bounds token=app name=probe-pa02-live-1 total_count=1 returned=1
PROBE-PA02 bounds token=app download id=10843740264 exit=0 bytes=238 first_line=repository=steady-orchard/patch-steward-testbed-private error=
```

Both `per_page=100` and `per_page=101` returned all 11 existing artifacts - the private repository did not yet
hold 100+ artifacts, so the true page-size cap was not exercised; 11 is the observed ceiling for this run, not a
confirmed API maximum. Pagination `Link` headers are present (`rel="next"`, `rel="last"`). Both tokens listed and
downloaded successfully.

### E6 — PA02.7 listing with the local user token (private repository)

```text
$ gh api -i "repos/steady-orchard/patch-steward-testbed-private/actions/artifacts?per_page=1" | tr -d '\r' | grep -iE '^(HTTP/|x-ratelimit-|link:)'
HTTP/2.0 200 OK
Link: <https://api.github.com/repositories/1376517252/actions/artifacts?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1376517252/actions/artifacts?per_page=1&page=11>; rel="last"
X-Ratelimit-Limit: 5000
X-Ratelimit-Remaining: 3667
X-Ratelimit-Reset: 1790302466
X-Ratelimit-Resource: core
X-Ratelimit-Used: 1333
```

The local user token also listed successfully with a pagination `Link` header, confirming a third working
credential for read access on this private repository.

## Deviations from the design

None.

## Residue

- `steward-ownership-pr-90` (id 10842424153), `steward-ownership-pr-901` (id 10842953586),
  `steward-ownership-issue-90` (id 10842584130), `steward-ownership-group-8b65fa26fd5d45d98710fe16c2e55cac6364baf4`
  (id 10842449308) - expire ~2026-09-26 (default retention).
- `probe-pa02-live-1` id 10843740264 - expires ~2026-09-26.
- retention probe artifacts: id 10842594252 (requested 0, expires 2026-12-24), id 10842629292 (requested 1,
  expires 2026-09-26), id 10842514422 (requested 90, expires 2026-12-24), id 10842599401 (requested 400, expires
  2026-12-24).
- Runs dispatched: 4 (PA02.1 names, PA02.4 find, PA02.6 retention, PA02.7 bounds) plus 1 non-blocking uploader
  dispatch for PA02.4 (probe-pa02-live-1) = 5 workflow runs total, within the 8-run bound for this test-bed.
