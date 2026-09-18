# PA02 — Ownership artifacts — org-public

- assumption: PA02
- test-bed: steady-orchard/patch-steward-testbed-public
- probed: 2026-09-25T01:15:15Z to 2026-09-25T01:27:05Z
- step: 2.2
- workflows: probe-pa02-upload.yml 10caaa1b5b0844e76d6e50388d6439773930de02; probe-pa02-list.yml 982782742b11a2dd9e9249977c59d2e21324e275

## Results

| Sub-claim | Kind        | Result    | Cause | Evidence    |
| --------- | ----------- | --------- | ----- | ----------- |
| PA02.1    | assumption  | confirmed | none  | E1          |
| PA02.2    | assumption  | confirmed | none  | E2          |
| PA02.3    | assumption  | refuted   | none  | E3,E4,E5,E6 |
| PA02.4    | assumption  | confirmed | none  | E7          |
| PA02.5    | measurement | confirmed | none  | E8,E9       |
| PA02.6    | measurement | confirmed | none  | E10,E11     |
| PA02.7    | measurement | confirmed | none  | E12,E13     |

## Measurements

| Sub-claim | Quantity                    | Value                                                                    | Unit      | Method                                                                                      | Samples |
| --------- | --------------------------- | ------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------- | ------- |
| PA02.5    | visibility delay min        | 0                                                                        | s         | first listing check after upload-step completion; immediate check then every 20 s           | 5       |
| PA02.5    | visibility delay median     | 1                                                                        | s         | first listing check after upload-step completion; immediate check then every 20 s           | 5       |
| PA02.5    | visibility delay max        | 2                                                                        | s         | first listing check after upload-step completion; immediate check then every 20 s           | 5       |
| PA02.5    | created_at resolution       | 1                                                                        | s         | from ISO 8601 timestamps of the 5 burst artifacts                                           | 5       |
| PA02.5    | created_at ties             | 0                                                                        | count     | equal created_at among the 5; none tied, so id order vs dispatch order not exercised        | 5       |
| PA02.6    | requested=0 accepted/days   | yes / 90                                                                 | days      | resulting days = round(expires_at − created_at)                                             | 1       |
| PA02.6    | requested=1 accepted/days   | yes / 1                                                                  | days      | resulting days = round(expires_at − created_at)                                             | 1       |
| PA02.6    | requested=90 accepted/days  | yes / 90                                                                 | days      | resulting days = round(expires_at − created_at)                                             | 1       |
| PA02.6    | requested=400 accepted/days | yes / 90 (capped)                                                        | days      | resulting days = round(expires_at − created_at)                                             | 1       |
| PA02.6    | repository cap              | 90                                                                       | days      | GET repos/.../actions/permissions/artifact-and-log-retention maximum_allowed_days           | 1       |
| PA02.6    | repository default          | 90                                                                       | days      | GET repos/.../actions/permissions/artifact-and-log-retention days                           | 1       |
| PA02.6    | organization cap            | 400                                                                      | days      | GET orgs/steady-orchard/actions/permissions/artifact-and-log-retention maximum_allowed_days | 1       |
| PA02.7    | per_page maximum            | 25 (all available; cap not reached)                                      | artifacts | per_page=101 request against a 25-artifact repository                                       | 1       |
| PA02.7    | pagination                  | yes                                                                      | bool      | Link header present with rel=next/last                                                      | 1       |
| PA02.7    | list with job token         | yes                                                                      | bool      | job GITHUB_TOKEN, actions:read, listing succeeded                                           | 1       |
| PA02.7    | list with App token         | yes                                                                      | bool      | App installation token, actions:read, listing succeeded                                     | 1       |
| PA02.7    | list with local user token  | yes                                                                      | bool      | gh api with local user token, listing succeeded                                             | 1       |
| PA02.7    | download with job token     | yes                                                                      | bool      | job GITHUB_TOKEN download exit=0                                                            | 1       |
| PA02.7    | download with App token     | yes                                                                      | bool      | App installation token download exit=0                                                      | 1       |
| PA02.7    | requests per query          | 1                                                                        | count     | one REST call per page; header x-ratelimit-resource=core                                    | 1       |
| PA02.7    | rate limit headers          | job limit=5000 used=75; app limit=5000 used=68; user limit=5000 used=871 | requests  | X-Ratelimit-Limit/Used headers as observed                                                  | 1       |

## Evidence

### E1 — PA02.1 names mode: four design-form names uploaded, each exact query returns only its own name, decoy query returns 0

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081201445

```text
PROBE-PA02 names uploaded pr-90=10841898490 pr-901=10841823491 issue-90=10841933228 group=10841743741 group_name=steward-ownership-group-e5ba8cee70513950b7d543145ff7f8b9aea4dc5e
PROBE-PA02 names query=steward-ownership-pr-90 total_count=1 returned_names=steward-ownership-pr-90 this_run_ids=10841898490
PROBE-PA02 names query=steward-ownership-pr-901 total_count=1 returned_names=steward-ownership-pr-901 this_run_ids=10841823491
PROBE-PA02 names query=steward-ownership-issue-90 total_count=1 returned_names=steward-ownership-issue-90 this_run_ids=10841933228
PROBE-PA02 names query=steward-ownership-group-e5ba8cee70513950b7d543145ff7f8b9aea4dc5e total_count=1 returned_names=steward-ownership-group-e5ba8cee70513950b7d543145ff7f8b9aea4dc5e this_run_ids=10841743741
PROBE-PA02 names query=steward-ownership-pr-9 total_count=0 returned_names= this_run_ids=
```

### E2 — PA02.2 immutability mode: u2 failed, u3 got a new id, id1 gone after u3, delete permissions

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081247457

```text
PROBE-PA02 immut u1 id=10841304141 name=probe-pa02-immut created_at=2026-09-25T01:16:00Z digest=sha256:673c5e2d0a345e3a5db1ecb807e8303460a0a4a4e019012dc3e567a3c62bf27e size=256
PROBE-PA02 immut u2 outcome=failure id=none
PROBE-PA02 immut u3 id=10840974481 created_at=2026-09-25T01:16:08Z digest=sha256:131fdf14482dee93fea9ed83a69de2bc5476265ba33ca16161b9a42985f5b640 size=179
PROBE-PA02 immut get-first-id id=10841304141 response={"message":"Not Found","documentation_url":"https://docs.github.com/rest/actions/artifacts#get-an-artifact","status":"404"}gh: Not Found (HTTP 404)
PROBE-PA02 immut u3 outcome=success id=10840974481
PROBE-PA02 immut listing this_run=10840974481@2026-09-25T01:16:08Z
PROBE-PA02 delete token=job permission=actions:read id=10841044393 exit=1 response={"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest/actions/artifacts#delete-an-artifact","status":"403"}gh: Resource not accessible by integration (HTTP 403)
PROBE-PA02 delete token=app permission=actions:write id=10841044393 exit=0 response=
PROBE-PA02 delete get-after id=10841044393 exit=1 response={"message":"Not Found","documentation_url":"https://docs.github.com/rest/actions/artifacts#get-an-artifact","status":"404"}gh: Not Found (HTTP 404)
```

id1 (10841304141) is gone (404) after u3; u3's id (10840974481) differs from id1; u2 produced no id (failure). The job
token (`actions:read`) could not delete (403); the App token (`actions:write`) deleted successfully (exit=0), and a
get-after confirmed the delete (404).

### E3 — PA02.3 run R1 attempt 1: upload of steward-ownership-pr-9003-1

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081318956/attempts/1

```text
PROBE-PA02 single name=steward-ownership-pr-9003-1 artifact_id=10841069536 upload_done_utc=2026-09-25T01:16:57Z run_id=36081318956 run_attempt=1
PROBE-PA02 single artifact_id=10841069536 first_visible_utc=2026-09-25T01:17:00Z delay_s=3 checks=1
PROBE-PA02 artifact id=10841069536 name=steward-ownership-pr-9003-1 created_at=2026-09-25T01:16:57Z expires_at=2026-09-26T01:16:57Z digest=sha256:1763e366a1bd49392b3177ad3b8819305e1368fe28ec422d61f97dc206a227a5 workflow_run=36081318956
```

### E4 — PA02.3 run R2: second upload of the same name from a different run

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081354075

```text
PROBE-PA02 single name=steward-ownership-pr-9003-1 artifact_id=10842251268 upload_done_utc=2026-09-25T01:17:26Z run_id=36081354075 run_attempt=1
PROBE-PA02 single artifact_id=10842251268 first_visible_utc=2026-09-25T01:17:26Z delay_s=0 checks=1
PROBE-PA02 artifact id=10842251268 name=steward-ownership-pr-9003-1 created_at=2026-09-25T01:17:26Z expires_at=2026-09-26T01:17:25Z digest=sha256:89d7fdf6ea572a1ee9a521fbd741dd168c873de44598e2e6a1e234fb7c7aac22 workflow_run=36081354075
```

### E5 — PA02.3 run R1 attempt 2 (rerun of R1): third upload of the same name

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081318956/attempts/2

```text
PROBE-PA02 single name=steward-ownership-pr-9003-1 artifact_id=10841479189 upload_done_utc=2026-09-25T01:17:56Z run_id=36081318956 run_attempt=2
PROBE-PA02 single artifact_id=10841479189 first_visible_utc=2026-09-25T01:17:57Z delay_s=1 checks=1
PROBE-PA02 artifact id=10841479189 name=steward-ownership-pr-9003-1 created_at=2026-09-25T01:17:56Z expires_at=2026-09-26T01:17:55Z digest=sha256:51ae570eee7fa4210d5c506ae70a92468f55c653184d603223f5584b8c14b656 workflow_run=36081318956
```

Upload order (by `upload_done_utc`) was R1a1 (01:16:57) < R2 (01:17:26) < R1a2 (01:17:56), which also matches
`created_at` order. But the artifact **ids** are R1a1=10841069536 < R1a2=10841479189 < R2=10842251268: R1a2's id is
smaller than R2's id even though R1a2 was created after R2. `created_at` order and id order disagree, so PA02.3 is
refuted per the decision rule (order must hold for both fields).

### E6 — PA02.3 find: repository-wide listing for steward-ownership-pr-9003-1 after the rerun

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081442570

```text
PROBE-PA02 find name=steward-ownership-pr-9003-1 total_count=2 waited_s=0 utc=2026-09-25T01:18:40Z
PROBE-PA02 find artifact id=10841479189 name=steward-ownership-pr-9003-1 created_at=2026-09-25T01:17:56Z expires_at=2026-09-26T01:17:55Z workflow_run=36081318956 uploader_now: status=completed conclusion=success run_attempt=2  observed_utc=2026-09-25T01:18:41Z
PROBE-PA02 find artifact id=10842251268 name=steward-ownership-pr-9003-1 created_at=2026-09-25T01:17:26Z expires_at=2026-09-26T01:17:25Z workflow_run=36081354075 uploader_now: status=completed conclusion=success run_attempt=1  observed_utc=2026-09-25T01:18:41Z
```

The listing shows only 2 of the 3 uploaded artifacts by this name (R1a1's artifact, id=10841069536, is absent —
apparently superseded within its own run by the rerun's upload of the same name). The listing does name the
uploading run's attempt: each entry's `uploader_now` carries `run_attempt` (2 for the R1 rerun, 1 for R2) alongside
`workflow_run`.

### E7 — PA02.4 find during the uploader's hold, then the uploader run

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081502325 (find, concurrent) and
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081495002 (uploader, `hold_seconds=240`)

```text
PROBE-PA02 find name=probe-pa02-live-1 total_count=1 waited_s=41 utc=2026-09-25T01:20:20Z
PROBE-PA02 find artifact id=10841873942 name=probe-pa02-live-1 created_at=2026-09-25T01:20:01Z expires_at=2026-09-26T01:20:00Z workflow_run=36081495002 uploader_now: status=in_progress conclusion=null run_attempt=1  observed_utc=2026-09-25T01:20:20Z
PROBE-PA02 single name=probe-pa02-live-1 artifact_id=10841873942 upload_done_utc=2026-09-25T01:20:01Z run_id=36081495002 run_attempt=1
PROBE-PA02 hold_start_utc=2026-09-25T01:20:01Z hold_s=240
PROBE-PA02 hold_end_utc=2026-09-25T01:24:01Z
```

The find run's listing shows `workflow_run=36081495002` (the uploader) with `uploader_now: status=in_progress`,
observed at 01:20:20Z, while the uploader's own hold did not end until 01:24:01Z — the artifact was listed
repository-wide well before the uploading run completed.

### E8 — PA02.5 five concurrent uploads: upload-done and first-visible timestamps

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081868624 (burst-1),
.../36081873284 (burst-2), .../36081877957 (burst-3), .../36081882009 (burst-4), .../36081885904 (burst-5)

```text
PROBE-PA02 single name=probe-pa02-burst-1-1 artifact_id=10842212330 upload_done_utc=2026-09-25T01:24:33Z run_id=36081868624 run_attempt=1
PROBE-PA02 single artifact_id=10842212330 first_visible_utc=2026-09-25T01:24:33Z delay_s=0 checks=1
PROBE-PA02 single name=probe-pa02-burst-1-2 artifact_id=10842800156 upload_done_utc=2026-09-25T01:24:37Z run_id=36081873284 run_attempt=1
PROBE-PA02 single artifact_id=10842800156 first_visible_utc=2026-09-25T01:24:38Z delay_s=1 checks=1
PROBE-PA02 single name=probe-pa02-burst-1-3 artifact_id=10841814755 upload_done_utc=2026-09-25T01:24:41Z run_id=36081877957 run_attempt=1
PROBE-PA02 single artifact_id=10841814755 first_visible_utc=2026-09-25T01:24:42Z delay_s=1 checks=1
PROBE-PA02 single name=probe-pa02-burst-1-4 artifact_id=10841894584 upload_done_utc=2026-09-25T01:24:42Z run_id=36081882009 run_attempt=1
PROBE-PA02 single artifact_id=10841894584 first_visible_utc=2026-09-25T01:24:44Z delay_s=2 checks=1
PROBE-PA02 single name=probe-pa02-burst-1-5 artifact_id=10842450346 upload_done_utc=2026-09-25T01:24:47Z run_id=36081885904 run_attempt=1
PROBE-PA02 single artifact_id=10842450346 first_visible_utc=2026-09-25T01:24:48Z delay_s=1 checks=1
```

delay_s samples: 0, 1, 1, 2, 1 → min 0, median 1, max 2. `created_at` values (01:24:33, 01:24:37, 01:24:41,
01:24:42, 01:24:47) are all distinct at 1-second resolution — no ties among the 5.

### E9 — PA02.5 find for all five burst names in one listing run

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081947799

```text
PROBE-PA02 find artifact id=10842212330 name=probe-pa02-burst-1-1 created_at=2026-09-25T01:24:33Z expires_at=2026-09-26T01:24:32Z workflow_run=36081868624 uploader_now: status=completed conclusion=success run_attempt=1  observed_utc=2026-09-25T01:25:37Z
PROBE-PA02 find artifact id=10842800156 name=probe-pa02-burst-1-2 created_at=2026-09-25T01:24:37Z expires_at=2026-09-26T01:24:36Z workflow_run=36081873284 uploader_now: status=completed conclusion=success run_attempt=1  observed_utc=2026-09-25T01:25:38Z
PROBE-PA02 find artifact id=10841814755 name=probe-pa02-burst-1-3 created_at=2026-09-25T01:24:41Z expires_at=2026-09-26T01:24:40Z workflow_run=36081877957 uploader_now: status=completed conclusion=success run_attempt=1  observed_utc=2026-09-25T01:25:39Z
PROBE-PA02 find artifact id=10841894584 name=probe-pa02-burst-1-4 created_at=2026-09-25T01:24:42Z expires_at=2026-09-26T01:24:41Z workflow_run=36081882009 uploader_now: status=completed conclusion=success run_attempt=1  observed_utc=2026-09-25T01:25:40Z
PROBE-PA02 find artifact id=10842450346 name=probe-pa02-burst-1-5 created_at=2026-09-25T01:24:47Z expires_at=2026-09-26T01:24:46Z workflow_run=36081885904 uploader_now: status=completed conclusion=success run_attempt=1  observed_utc=2026-09-25T01:25:41Z
```

### E10 — PA02.6 retention: requested 0, 1, 90, 400 days

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081988862

```text
PROBE-PA02 retention requested=0 outcome=success id=10842905286 created_at=2026-09-25T01:26:09Z expires_at=2026-12-24T01:26:05Z
PROBE-PA02 retention requested=1 outcome=success id=10842835377 created_at=2026-09-25T01:26:10Z expires_at=2026-09-26T01:26:10Z
PROBE-PA02 retention requested=90 outcome=success id=10841874867 created_at=2026-09-25T01:26:11Z expires_at=2026-12-24T01:26:05Z
PROBE-PA02 retention requested=400 outcome=success id=10842800390 created_at=2026-09-25T01:26:12Z expires_at=2026-12-24T01:26:05Z
PROBE-PA02 retention settings_read_with_job_token={"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest/actions/permissions#get-artifact-and-log-retention-settings-for-a-repository","status":"403"}gh: Resource not accessible by integration (HTTP 403)
```

requested=0, 90, and 400 all resolved to the same 90-day expiry (2026-09-25 → 2026-12-24); requested=1 resolved to
1 day. All four uploads reported `outcome=success` — the repository cap silently clamps out-of-range or default
requests rather than rejecting the upload. The job token (`actions:read`) cannot read the repository's retention
settings (403); this local (App/user) read (E11) supplied them instead.

### E11 — PA02.6 repository and organization retention settings

```text
$ gh api repos/steady-orchard/patch-steward-testbed-public/actions/permissions/artifact-and-log-retention
{"days":90,"maximum_allowed_days":90}
$ gh api orgs/steady-orchard/actions/permissions/artifact-and-log-retention
{"days":90,"maximum_allowed_days":400}
```

Repository default and cap are both 90 days; the organization's own cap is 400 days, but the repository's
`maximum_allowed_days` of 90 is the binding limit observed above.

### E12 — PA02.7 listing bounds and costs with job and App tokens

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36082038453

```text
PROBE-PA02 bounds token=job headers: HTTP/2.0 200 OK Link: <...?per_page=1&page=2>; rel="next", <...?per_page=1&page=25>; rel="last" X-Ratelimit-Limit: 5000 X-Ratelimit-Remaining: 4925 X-Ratelimit-Resource: core X-Ratelimit-Used: 75
PROBE-PA02 bounds token=job per_page=100 total_count=25 returned=25
PROBE-PA02 bounds token=job per_page=101 total_count=25 returned=25
PROBE-PA02 bounds token=job page=2&per_page=1 returned=1 id=10842835377
PROBE-PA02 bounds token=job name=probe-pa02-burst-1-1 total_count=1 returned=1
PROBE-PA02 bounds token=job download id=10842212330 exit=0 bytes=238 first_line=repository=steady-orchard/patch-steward-testbed-public error=
PROBE-PA02 bounds token=app headers: HTTP/2.0 200 OK Link: <...?per_page=1&page=2>; rel="next", <...?per_page=1&page=25>; rel="last" X-Ratelimit-Limit: 5000 X-Ratelimit-Remaining: 4932 X-Ratelimit-Resource: core X-Ratelimit-Used: 68
PROBE-PA02 bounds token=app per_page=100 total_count=25 returned=25
PROBE-PA02 bounds token=app per_page=101 total_count=25 returned=25
PROBE-PA02 bounds token=app page=2&per_page=1 returned=1 id=10842835377
PROBE-PA02 bounds token=app name=probe-pa02-burst-1-1 total_count=1 returned=1
PROBE-PA02 bounds token=app download id=10842212330 exit=0 bytes=238 first_line=repository=steady-orchard/patch-steward-testbed-public error=
```

Both `per_page=100` and `per_page=101` returned all 25 existing artifacts — the repository did not yet hold 100+
artifacts, so the true page-size cap was not exercised; 25 is the observed ceiling for this run, not a confirmed
API maximum. Pagination `Link` headers are present (`rel="next"`, `rel="last"`). Both tokens listed and downloaded
successfully.

### E13 — PA02.7 listing with the local user token

```text
$ gh api -i "repos/steady-orchard/patch-steward-testbed-public/actions/artifacts?per_page=1" | tr -d '\r' | grep -iE '^(HTTP/|x-ratelimit-|link:)'
HTTP/2.0 200 OK
Link: <https://api.github.com/repositories/1376317064/actions/artifacts?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1376317064/actions/artifacts?per_page=1&page=25>; rel="last"
X-Ratelimit-Limit: 5000
X-Ratelimit-Remaining: 4129
X-Ratelimit-Reset: 1790302466
X-Ratelimit-Resource: core
X-Ratelimit-Used: 871
```

The local user token also listed successfully with a pagination `Link` header, confirming a third working
credential for read access.

## Deviations from the design

docs/architecture.md §6.4: "The newest artifact by creation time wins, including a new attempt of an old run. An
ambiguous or incomplete listing cannot authorize publication."

Observation: across R1 attempt 1, R2, and R1 attempt 2 (all named `steward-ownership-pr-9003-1`), `created_at`
order agrees with real upload order (R1a1 < R2 < R1a2), but artifact **id** order does not (R1a1 < R1a2 < R2): the
rerun's id is smaller than R2's id despite being created later. A consumer that ordered by id instead of
`created_at` would pick R2 as "newest" when R1a2 is actually the latest. The design already specifies ordering "by
creation time", so an implementation that strictly compares `created_at` (not id) is unaffected; this row is
recorded as refuted because the sub-claim required both fields to agree, and they do not.

## Residue

- `steward-ownership-pr-90` (id 10841898490), `steward-ownership-pr-901` (id 10841823491),
  `steward-ownership-issue-90` (id 10841933228), `steward-ownership-group-e5ba8cee70513950b7d543145ff7f8b9aea4dc5e`
  (id 10841743741) — expire ~2026-09-26 (default retention).
- `probe-pa02-immut` id 10840974481 (u3, current) — expires ~2026-09-26; earlier ids 10841304141 (u1) and
  10841044393 (deleted by App token) no longer exist.
- `steward-ownership-pr-9003-1`: id 10841069536 (R1a1, no longer listed), id 10842251268 (R2), id 10841479189
  (R1a2) — all expire ~2026-09-26.
- `probe-pa02-live-1` id 10841873942 — expires ~2026-09-26.
- `probe-pa02-burst-1-1..5` ids 10842212330, 10842800156, 10841814755, 10841894584, 10842450346 — expire
  ~2026-09-26.
- retention probe artifacts: id 10842905286 (requested 0, expires 2026-12-24), id 10842835377 (requested 1,
  expires 2026-09-26), id 10841874867 (requested 90, expires 2026-12-24), id 10842800390 (requested 400, expires
  2026-12-24).
