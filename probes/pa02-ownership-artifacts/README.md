# PA02 — Ownership artifacts

## Sub-claims

- PA02.1 assumption — Names of the forms `steward-ownership-pr-<number>`, `steward-ownership-issue-<number>`, and
  `steward-ownership-group-<40-hex commit>` are accepted at upload and can be listed repository-wide by exact name
  (`GET /repos/{owner}/{repo}/actions/artifacts?name=...`).
- PA02.2 assumption — Immutability: content cannot change under an artifact id; a second upload of the same name in
  the same run attempt fails or yields a new id and creation time; record which token permissions can delete an
  artifact (deletion is the residual mutation).
- PA02.3 assumption — Creation-time ordering: across different runs and across a re-run attempt of an older run,
  `created_at` and artifact id order match real upload order; record whether a listing identifies the run attempt
  that uploaded an artifact.
- PA02.4 assumption — Cross-run listing: an artifact uploaded by a job of a still-running run is visible to another
  run's repository-wide listing before the uploading run completes.
- PA02.5 measurement — Consistency window: delay from upload-step completion to visibility in the repository-wide
  listing under concurrent runs (at least 5 uploads; min, median, max); `created_at` resolution and tie behavior for
  near-simultaneous uploads.
- PA02.6 measurement — Retention bounds: accepted `retention-days` range, resulting `expires_at`, and the cap from
  repository or organization settings, per visibility. Actual deletion at expiry is an optional observation and never
  makes this cell `undetermined`.
- PA02.7 measurement — Listing bounds: `per_page` maximum and pagination; which tokens can list and download across
  runs (job `GITHUB_TOKEN` with `actions: read`; App installation token); rate-limit cost per query.

## Fixtures

- `steward-ownership-pr-90`, `steward-ownership-pr-901` (prefix decoy), `steward-ownership-issue-90`,
  `steward-ownership-group-<40-hex master sha>` — PA02.1 names probe.
- `probe-pa02-immut` — PA02.2 immutability probe.
- `steward-ownership-pr-9003-<k>` — PA02.3 creation-time ordering probe.
- `probe-pa02-live-<k>` — PA02.4 cross-run listing probe.
- `probe-pa02-burst-<k>-1` .. `probe-pa02-burst-<k>-5` — PA02.5 consistency-window burst.
- retention-days 0, 1, 90, 400 uploads (unnamed default artifact name) — PA02.6 retention probe.

## Deployment list

- probe-pa02-upload.yml: org-public, org-private
- probe-pa02-list.yml: org-public, org-private

## Procedure

Placeholders: `<tb>` = test-bed `owner/repo`; `<W>` = worktree root (Git-Bash form); `<k>` = attempt number (1 on the
first attempt); `<id>` = a run id read from a previous command's output.

1. Deploy both workflows:
   `bash probes/smoke/tools/deploy.sh <tb> master "probe(PA02): deploy probe-pa02-upload.yml probe-pa02-list.yml" <W>/probes/pa02-ownership-artifacts/workflows/probe-pa02-upload.yml <W>/probes/pa02-ownership-artifacts/workflows/probe-pa02-list.yml`
2. PA02.1: `bash probes/smoke/tools/dispatch.sh <tb> probe-pa02-upload.yml master mode=names`; collect.
3. PA02.2: `bash probes/smoke/tools/dispatch.sh <tb> probe-pa02-upload.yml master mode=immutability`; collect.
4. PA02.3 (name N3 = `steward-ownership-pr-9003-<k>`):
   a. `bash probes/smoke/tools/dispatch.sh <tb> probe-pa02-upload.yml master mode=single name=<N3>` → R1.
   b. the same command again → R2.
   c. `gh api repos/<tb>/actions/runs/<id>/rerun -X POST` (rerun R1).
   d. wait: `for i in $(seq 1 27); do s=$(gh api repos/<tb>/actions/runs/<id> --jq '"\(.run_attempt) \(.status) \(.conclusion)"'); echo "$s"; case "$s" in "2 completed"*) break ;; esac; sleep 20; done`
   e. collect R1 attempt 1, R2, and R1 `--attempt 2`; then
   `bash probes/smoke/tools/dispatch.sh <tb> probe-pa02-list.yml master mode=find names=<N3> wait_seconds=60`; collect.
5. PA02.4 (name L = `probe-pa02-live-<k>`): non-blocking
   `gh api repos/<tb>/actions/workflows/probe-pa02-upload.yml/dispatches -X POST -f ref=master -f 'inputs[nonce]=pa02-live-<k>' -f 'inputs[mode]=single' -f 'inputs[name]=<L>' -f 'inputs[hold_seconds]=240'`
   then at once `bash probes/smoke/tools/dispatch.sh <tb> probe-pa02-list.yml master mode=find names=<L> wait_seconds=240`;
   find the uploader run (nonce `pa02-live-<k>`), `wait-run.sh` until it completes, collect both runs.
6. PA02.5: five non-blocking dispatches issued back to back, j = 1..5:
   `gh api repos/<tb>/actions/workflows/probe-pa02-upload.yml/dispatches -X POST -f ref=master -f 'inputs[nonce]=pa02-burst-<k>-<j>' -f 'inputs[mode]=single' -f 'inputs[name]=probe-pa02-burst-<k>-<j>'`
   Wait until all five runs (displayTitle contains `pa02-burst-<k>-`) are completed, collect each run's `single`
   lines, then
   `bash probes/smoke/tools/dispatch.sh <tb> probe-pa02-list.yml master mode=find "names=probe-pa02-burst-<k>-1 probe-pa02-burst-<k>-2 probe-pa02-burst-<k>-3 probe-pa02-burst-<k>-4 probe-pa02-burst-<k>-5" wait_seconds=60`; collect.
7. PA02.6: `bash probes/smoke/tools/dispatch.sh <tb> probe-pa02-upload.yml master mode=retention`; collect;
   reads: `gh api repos/<tb>/actions/permissions/artifact-and-log-retention` and
   `gh api orgs/steady-orchard/actions/permissions/artifact-and-log-retention`.
8. PA02.7: `bash probes/smoke/tools/dispatch.sh <tb> probe-pa02-list.yml master mode=bounds names=probe-pa02-burst-<k>-1`; collect;
   read with the local user token: `gh api -i "repos/<tb>/actions/artifacts?per_page=1" | tr -d '\r' | grep -iE '^(HTTP/|x-ratelimit-|link:)'`.

org-private runs only PA02.1, PA02.4, PA02.6, PA02.7 with the same commands, `hold_seconds=150`.

## Decision rules

- PA02.1 confirmed iff all four uploads have ids AND each exact query returns only its own name and includes this
  run's id AND query `steward-ownership-pr-9` returns `total_count 0`; refuted if a design-form name is rejected at
  upload or any query returns another name (prefix/partial matching).
- PA02.2 confirmed iff u2 failed OR produced an id different from u1 (with its own `created_at`), AND no id ever
  served changed content (after u3, id1 is gone or unchanged; id3 differs from id1); refuted if content under one id
  changed. Record in the row's evidence which DELETE succeeded (job `actions:read` vs App `actions:write`).
- PA02.3 confirmed iff the three `steward-ownership-pr-9003-<k>` artifacts (run R1 attempt 1, run R2, run R1 attempt 2) exist and both `created_at` and id order equal upload order R1a1 < R2 < R1a2; refuted if the order differs, or
  if the re-run attempt could not upload the same name (then the design's "including a new attempt of an old run"
  cannot hold — quote it). State in the evidence whether the listing names the attempt (it shows `workflow_run` id;
  say whether any field gives the attempt).
- PA02.4 confirmed iff the find line for `probe-pa02-live-<k>` whose `workflow_run` is the uploader run shows
  `uploader_now: status=in_progress`; refuted iff the uploader had logged `upload_done_utc`, was still in progress,
  and the listing did not show the artifact before the uploader completed; if the find line shows status completed
  (timing), retry once with `<k>+1` and `hold_seconds=420`, then `undetermined` / `ambiguous`.
- PA02.5 confirmed when at least 5 `delay_s` samples exist. Measurements rows: `visibility delay min`, `median`,
  `max` (Unit s, Method "first listing check after upload-step completion; immediate check then every 20 s",
  Samples 5), `created_at resolution` (Value 1, Unit s, from the ISO timestamps), `created_at ties` (count of equal
  `created_at` among the 5 and whether id order still matched dispatch order).
- PA02.6 confirmed when `expires_at` was recorded for the accepted requests. Measurements rows per requested value
  (0, 1, 90, 400): accepted yes/no and resulting days (`expires_at` − `created_at`, rounded); `repository cap` and
  `repository default` from the local read of `repos/.../artifact-and-log-retention` (`maximum_allowed_days`,
  `days`); `organization cap` from `orgs/steady-orchard/actions/permissions/artifact-and-log-retention`. Visibility:
  public (org-private is probed by a later step).
- PA02.7 confirmed when the bounds lines were recorded. Measurements rows: `per_page maximum` (returned count at
  `per_page=101`), `pagination` (Link header present yes/no), `list with job token`, `list with App token`, `list
with local user token`, `download with job token`, `download with App token` (yes/no each), `requests per query`
  (1, Method: one REST call per page; header `x-ratelimit-resource`), `rate limit headers` (limit values per token
  as seen).
