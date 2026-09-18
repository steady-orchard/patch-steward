# PA09 — Run-list caps — org-public

- assumption: PA09
- test-bed: steady-orchard/patch-steward-testbed-public
- probed: 2026-09-25T01:16:19Z to 2026-09-25T01:21:51Z
- step: 2.9
- workflows: probe-pa09-listen.yml a6264b8964de28e0b527438b702bb8a003ce63d2; probe-pa09-follow.yml c6279839e0c2d800b3a043644e2d86439d31d9d6; probe-pa09-act.yml dc218fcd55bc423d252c84b8c57ced929beea87e; probe-pa09-count.yml 14b09611952bb6f03106c06c3b47182389c24382

## Results

| Sub-claim | Kind        | Result    | Cause | Evidence |
| --------- | ----------- | --------- | ----- | -------- |
| PA09.1    | assumption  | confirmed | none  | E1       |
| PA09.2    | assumption  | confirmed | none  | E2       |
| PA09.3    | measurement | confirmed | none  | E3       |

## Measurements

| Sub-claim | Quantity                                | Value | Unit          | Method                                                      | Samples |
| --------- | --------------------------------------- | ----- | ------------- | ----------------------------------------------------------- | ------- |
| PA09.3    | requests per cap evaluation (job token) | 3     | requests      | count workflow `requests=` line, per listed workflow        | 1       |
| PA09.3    | requests per cap evaluation (App token) | 3     | requests      | count workflow `requests=` line, per listed workflow        | 1       |
| PA09.3    | rate limit (job token)                  | 5000  | requests/hour | count workflow `headers` line, x-ratelimit-limit            | 1       |
| PA09.3    | rate limit (App token)                  | 5000  | requests/hour | count workflow `headers` line, x-ratelimit-limit            | 1       |
| PA09.3    | rate limit (user token)                 | 5000  | requests/hour | local `gh api -i` read, x-ratelimit-limit                   | 1       |
| PA09.3    | listing freshness                       | 22    | s             | App comment, then an immediate listing check and every 20 s | 1       |

## Evidence

### E4 — documented 1,000-result ceiling (not a Measurements row)

GitHub REST docs, `GET /repos/{owner}/{repo}/actions/workflow-runs` — https://docs.github.com/en/rest/actions/workflow-runs

```text
"This endpoint will return up to 1,000 results for each search when using the following parameters: actor,
branch, check_suite_id, created, event, head_sha, status."
```

### E1 — count workflow obtained today's total and in-progress/queued counts for both tokens with `created` filter and pagination

https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081628326

```text
PROBE-PA09 count wf=probe-pa09-listen.yml token=job today=2026-09-25 today_total_count=27 today_listed=27 in_progress=0 queued=0 requests=3 utc=2026-09-25T01:21:15Z
PROBE-PA09 headers wf=probe-pa09-listen.yml token=job: HTTP/2.0 200 OK X-Ratelimit-Limit: 5000 X-Ratelimit-Remaining: 4967 X-Ratelimit-Reset: 1790302526 X-Ratelimit-Resource: core X-Ratelimit-Used: 33
PROBE-PA09 count wf=probe-pa09-listen.yml token=app today=2026-09-25 today_total_count=27 today_listed=27 in_progress=0 queued=0 requests=3 utc=2026-09-25T01:21:17Z
PROBE-PA09 headers wf=probe-pa09-listen.yml token=app: HTTP/2.0 200 OK X-Ratelimit-Limit: 5000 X-Ratelimit-Remaining: 4957 X-Ratelimit-Reset: 1790302568 X-Ratelimit-Resource: core X-Ratelimit-Used: 43
PROBE-PA09 count wf=probe-pa09-follow.yml token=job today=2026-09-25 today_total_count=28 today_listed=28 in_progress=0 queued=0 requests=3 utc=2026-09-25T01:21:19Z
PROBE-PA09 headers wf=probe-pa09-follow.yml token=job: HTTP/2.0 200 OK X-Ratelimit-Limit: 5000 X-Ratelimit-Remaining: 4963 X-Ratelimit-Reset: 1790302526 X-Ratelimit-Resource: core X-Ratelimit-Used: 37
PROBE-PA09 count wf=probe-pa09-follow.yml token=app today=2026-09-25 today_total_count=28 today_listed=28 in_progress=0 queued=0 requests=3 utc=2026-09-25T01:21:20Z
PROBE-PA09 headers wf=probe-pa09-follow.yml token=app: HTTP/2.0 200 OK X-Ratelimit-Limit: 5000 X-Ratelimit-Remaining: 4953 X-Ratelimit-Reset: 1790302568 X-Ratelimit-Resource: core X-Ratelimit-Used: 47
```

Both tokens obtained the same today_total_count / today_listed with 3 requests each (paginated `created` filter query
plus in_progress and queued counts), for both listener and follower workflows: `today_total_count == today_listed`
with no truncation observed, well under the documented 1,000-result ceiling (see E4).

### E2 — actor/triggering_actor per event kind, and attribution mechanisms

PR opened by jambolo (run 36081282183, attempt 1 folded into attempt 2's context below is the same run id; the
original attempt 1 context is superseded by the re-run, see the re-run line):
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081282183

```text
PROBE-PA09 context event_name=pull_request_target actor=jambolo actor_id=2095171 triggering_actor=patch-steward-testbed[bot] run_id=36081282183 run_attempt=2 utc=2026-09-25T01:19:30Z
PROBE-PA09 event={"action":"opened","sender":"jambolo","sender_id":2095171,"pr":{"number":5,"author":"jambolo","author_id":2095171,"head_repo":"steady-orchard/patch-steward-testbed-public"},"issue":null,"comment_author":null}
```

PR edited by the bot (run 36081392249):
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081392249

```text
PROBE-PA09 context event_name=pull_request_target actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36081392249 run_attempt=1 utc=2026-09-25T01:17:56Z
PROBE-PA09 event={"action":"edited","sender":"patch-steward-testbed[bot]","sender_id":331019482,"pr":{"number":5,"author":"jambolo","author_id":2095171,"head_repo":"steady-orchard/patch-steward-testbed-public"},"issue":null,"comment_author":null}
```

Comment by the bot on the PR (run 36081427876):
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081427876

```text
PROBE-PA09 context event_name=issue_comment actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36081427876 run_attempt=1 utc=2026-09-25T01:18:26Z
PROBE-PA09 event={"action":"created","sender":"patch-steward-testbed[bot]","sender_id":331019482,"pr":null,"issue":{"number":5,"author":"jambolo","author_id":2095171,"is_pr":true},"comment_author":"patch-steward-testbed[bot]"}
```

Comment by the bot on the issue (run 36081455468):
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081455468

```text
PROBE-PA09 context event_name=issue_comment actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36081455468 run_attempt=1 utc=2026-09-25T01:18:49Z
PROBE-PA09 event={"action":"created","sender":"patch-steward-testbed[bot]","sender_id":331019482,"pr":null,"issue":{"number":8,"author":"jambolo","author_id":2095171,"is_pr":false},"comment_author":"patch-steward-testbed[bot]"}
```

Re-run of the PR-opened run by the bot (attempt 2, same run 36081282183 as above): actor stays jambolo (the
original author of attempt 1), triggering_actor becomes patch-steward-testbed[bot]. Confirmed via
`--attempt 2`:

```text
PROBE-PA09 context event_name=pull_request_target actor=jambolo actor_id=2095171 triggering_actor=patch-steward-testbed[bot] run_id=36081282183 run_attempt=2 utc=2026-09-25T01:19:30Z
PROBE-PA09 event={"action":"opened","sender":"jambolo","sender_id":2095171,"pr":{"number":5,"author":"jambolo","author_id":2095171,"head_repo":"steady-orchard/patch-steward-testbed-public"},"issue":null,"comment_author":null}
```

A follower (workflow_run) run copying the PR-opened run's title (run 36081345988, from attempt 1 of 36081282183):
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081345988

```text
PROBE-PA09 run wf=probe-pa09-follow.yml id=36081345988 attempt=1 event=workflow_run status=completed conclusion=success actor=jambolo triggering_actor=jambolo prs= head_repo=steady-orchard/patch-steward-testbed-public created_at=2026-09-25T01:17:13Z title=probe-pa09-follow from=36081282183 upstream=probe-pa09 pull_request_target sub=5 author=2095171
```

A schedule run of probe-pa03-schedule.yml (from the count run's run listing):

```text
PROBE-PA09 run wf=probe-pa03-schedule.yml id=36075348546 attempt=1 event=schedule status=completed conclusion=success actor=jambolo triggering_actor=jambolo prs= head_repo=steady-orchard/patch-steward-testbed-public created_at=2026-09-24T23:58:35Z title=probe-pa03-schedule schedule
```

Mechanisms tested:

- (m1) `display_title` `author=<id>` equal to jambolo's id (2095171) for every listener run above, including the
  bot-edited run, the bot's comments, and the re-run (attempt 2): confirmed for all six rows above — every
  `title=probe-pa09 ... sub=... author=2095171` regardless of `actor`.
- (m2) The follower's title copies the upstream's `display_title` (`upstream=probe-pa09 ... author=2095171`):
  confirmed, see run 36081345988 above.
- (m3) `pull_requests` in the runs list: populated (`prs=5`) for the same-repo PR (run 36081282183 attempt 2, see
  count-run evidence in E5), empty (`prs=`) for the fork PR (run 36081290296, PR 7).

### E5 — pull_requests field, same-repo vs. fork

From the count run's full listing (https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081628326):

```text
PROBE-PA09 run wf=probe-pa09-listen.yml id=36081282183 attempt=2 event=pull_request_target status=completed conclusion=success actor=jambolo triggering_actor=patch-steward-testbed[bot] prs=5 head_repo=steady-orchard/patch-steward-testbed-public created_at=2026-09-25T01:16:19Z title=probe-pa09 pull_request_target sub=5 author=2095171
PROBE-PA09 run wf=probe-pa09-listen.yml id=36081290296 attempt=1 event=pull_request_target status=completed conclusion=success actor=jambolo triggering_actor=jambolo prs= head_repo=jambolo/patch-steward-testbed-public created_at=2026-09-25T01:16:26Z title=probe-pa09 pull_request_target sub=7 author=2095171
```

`prs=5` for the same-repo submission (PR 5), `prs=` (empty) for the fork submission (PR 7, `head_repo` is the
fork). Confirms m3: the `pull_requests` field is empty for fork-head PRs and cannot substitute for m1 there, but
m1 (`display_title`) still attributes both to jambolo (author_id=2095171) within the bounded list queries, so
PA09.2 is confirmed on m1 alone.

### E3 — App comment and freshness poll

Dispatch of the count workflow:
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081628326

```text
DISPATCH requested workflow=probe-pa09-count.yml ref=master nonce=n20260925T012107Z-11461-13751 attempt=1 utc=2026-09-25T01:21:09Z
DISPATCH run_id=36081628326 url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36081628326
DISPATCH completed run_id=36081628326 conclusion=success utc=2026-09-25T01:21:51Z
```

Fresh comment and first-seen listing check (from the same run's log):

```text
PROBE-PA09 fresh comment_id=5825081588 created_at=2026-09-25T01:21:22Z
PROBE-PA09 fresh first_seen id=36081654867 status=completed created_at=2026-09-25T01:21:29Z after_s=22 checks=2 utc=2026-09-25T01:21:44Z
```

Local user-token rate limit read:

```text
$ gh api -i "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" | tr -d '\r' | grep -iE '^(HTTP/|x-ratelimit-)'
HTTP/2.0 200 OK
X-Ratelimit-Limit: 5000
X-Ratelimit-Remaining: 4847
X-Ratelimit-Reset: 1790302247
X-Ratelimit-Resource: core
X-Ratelimit-Used: 153
```

## Deviations from the design

None.

## Residue

- Branches: `probe-pa09-base`, `probe-pa09-head-1` on steady-orchard/patch-steward-testbed-public; `probe-pa09-head-fork-1`
  on jambolo/patch-steward-testbed-public (fixture branches, permitted to remain; Phase 3 deletes the head branches).
- PRs: #5 (same-repo submission, closed), #7 (fork submission, closed) on steady-orchard/patch-steward-testbed-public.
- Issue: #8 (issue submission, closed) on steady-orchard/patch-steward-testbed-public.
- App comments: comment on PR #5 (from `action=comment target=5`), comment on issue #8 (from `action=comment
target=8`, comment_id=5825081588), PR #5 edited by the App (from `action=edit-pr target=5`).
- Deployed workflows: `probe-pa09-listen.yml`, `probe-pa09-follow.yml`, `probe-pa09-act.yml`, `probe-pa09-count.yml`
  on steady-orchard/patch-steward-testbed-public master (`.github/workflows/`).
