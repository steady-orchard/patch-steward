# PA07 — App-token writes — org-public

- assumption: PA07
- test-bed: steady-orchard/patch-steward-testbed-public
- probed: 2026-09-25T04:45:32Z to 2026-09-25T05:00:27Z
- step: 2.25
- workflows: probe-pa07-listen.yml 34ab42f011487398f8d455f6934d8587f1c318fa; probe-pa07-write.yml d9213024e7ad40345c712204fbb1642bfd74952e

## Results

| Sub-claim | Kind        | Result    | Cause | Evidence       |
| --------- | ----------- | --------- | ----- | -------------- |
| PA07.1    | assumption  | confirmed | none  | E1, E2, E4, E5 |
| PA07.2    | assumption  | confirmed | none  | E3, E6         |
| PA07.3    | measurement | confirmed | none  | E1, E2, E7     |

## Measurements

| Sub-claim | Quantity                    | Value                                     | Unit | Method                                                   | Samples |
| --------- | --------------------------- | ----------------------------------------- | ---- | -------------------------------------------------------- | ------- |
| PA07.3    | recursion guard             | none observed                             | -    | the writer is itself a workflow run (E1)                 | 1       |
| PA07.3    | write to run latency min    | 1 (1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 4) | s    | matched listener run createdAt (E2) minus write utc (E1) | 13      |
| PA07.3    | write to run latency median | 2                                         | s    | same as above                                            | 13      |
| PA07.3    | write to run latency max    | 4                                         | s    | same as above                                            | 13      |

## Evidence

### E1 — app-pass write lines (run 36096007426)

`gh run view 36096007426 -R steady-orchard/patch-steward-testbed-public --log` filtered to `PROBE-PA07 `. No `write-refused=` line: the corrected writer (contents write on both tokens) completed the full sequence. https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36096007426

```text
PROBE-PA07 token=app start run_id=36096007426 pr=27 utc=2026-09-25T04:49:41Z
PROBE-PA07 token=app write=issue-create target=29 utc=2026-09-25T04:49:42Z
PROBE-PA07 token=app write=issue-edit target=29 utc=2026-09-25T04:49:51Z
PROBE-PA07 token=app write=comment-create target=29/5826933239 utc=2026-09-25T04:49:59Z
PROBE-PA07 token=app write=comment-edit target=29/5826933239 utc=2026-09-25T04:50:08Z
PROBE-PA07 token=app write=comment-delete target=29/5826933239 utc=2026-09-25T04:50:17Z
PROBE-PA07 token=app write=issue-label-add target=29 utc=2026-09-25T04:50:26Z
PROBE-PA07 token=app write=issue-label-remove target=29 utc=2026-09-25T04:50:34Z
PROBE-PA07 token=app write=issue-reaction-add target=29 utc=2026-09-25T04:50:43Z
PROBE-PA07 token=app write=issue-close target=29 utc=2026-09-25T04:50:51Z
PROBE-PA07 token=app write=issue-reopen target=29 utc=2026-09-25T04:51:00Z
PROBE-PA07 token=app write=pr-ready-for-review target=27 utc=2026-09-25T04:51:10Z
PROBE-PA07 token=app write=pr-body-edit target=27 utc=2026-09-25T04:51:18Z
PROBE-PA07 token=app write=pr-label-add target=27 utc=2026-09-25T04:51:27Z
PROBE-PA07 token=app write=pr-reaction-add target=27 utc=2026-09-25T04:51:36Z
PROBE-PA07 token=app write=issue-close-final target=29 utc=2026-09-25T04:51:44Z
PROBE-PA07 token=app done issue=29 pr=27 utc=2026-09-25T04:51:52Z
```

### E2 — app-pass listener runs

`gh run list -R steady-orchard/patch-steward-testbed-public --workflow probe-pa07-listen.yml --limit 100 ...`, restricted to this attempt's issue 29 and PR 27. Every App write of the claim's kinds (issue create, edit, close, reopen; comment create, edit, delete; PR body edit; ready-for-review) matches a run within 10 min; label and reaction outcomes recorded but do not decide the row (issue-reaction-add and pr-reaction-add produced no run, matching the design's EXPECTED EVENT table).

```text
36096157298 2026-09-25T04:51:46Z issues success probe-pa07-listen issues closed 29
36096138145 2026-09-25T04:51:29Z pull_request_target success probe-pa07-listen pull_request_target labeled 27
36096128346 2026-09-25T04:51:21Z pull_request_target success probe-pa07-listen pull_request_target edited 27
36096117392 2026-09-25T04:51:12Z pull_request_target success probe-pa07-listen pull_request_target ready_for_review 27
36096107025 2026-09-25T04:51:02Z issues success probe-pa07-listen issues reopened 29
36096097353 2026-09-25T04:50:53Z issues success probe-pa07-listen issues closed 29
36096080842 2026-09-25T04:50:38Z issues success probe-pa07-listen issues unlabeled 29
36096067295 2026-09-25T04:50:27Z issues success probe-pa07-listen issues labeled 29
36096056972 2026-09-25T04:50:18Z issue_comment success probe-pa07-listen issue_comment deleted 29
36096046198 2026-09-25T04:50:09Z issue_comment success probe-pa07-listen issue_comment edited 29
36096037824 2026-09-25T04:50:02Z issue_comment success probe-pa07-listen issue_comment created 29
36096027118 2026-09-25T04:49:53Z issues success probe-pa07-listen issues edited 29
36096017790 2026-09-25T04:49:45Z issues success probe-pa07-listen issues opened 29
```

No `pr-convert-to-draft` write or `pull_request_target converted_to_draft` run appears: PR 27 was created as `draft=true`, so the writer's "converts to draft if needed" step found nothing to do.

### E3 — app-pass event/context lines

`gh run view <id> -R steady-orchard/patch-steward-testbed-public --log` for each run of E2, filtered to the `context event_name=...` and `event={...}` lines. Runs in the same order as E2 (newest first).

```text
-- 36096157298 (issues closed 29)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096157298 started_utc=2026-09-25T04:51:51Z
PROBE-PA07 event={"action":"closed","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":29,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36096138145 (pull_request_target labeled 27)
PROBE-PA07 context event_name=pull_request_target actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096138145 started_utc=2026-09-25T04:51:34Z
PROBE-PA07 event={"action":"labeled","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":null,"comment":null,"pull_request":{"number":27,"user":"jambolo","draft":false},"label":"probe-pa07:x","changes":null,"installation":null}
-- 36096128346 (pull_request_target edited 27)
PROBE-PA07 context event_name=pull_request_target actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096128346 started_utc=2026-09-25T04:51:25Z
PROBE-PA07 event={"action":"edited","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":null,"comment":null,"pull_request":{"number":27,"user":"jambolo","draft":false},"label":null,"changes":["body"],"installation":null}
-- 36096117392 (pull_request_target ready_for_review 27)
PROBE-PA07 context event_name=pull_request_target actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096117392 started_utc=2026-09-25T04:51:17Z
PROBE-PA07 event={"action":"ready_for_review","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":null,"comment":null,"pull_request":{"number":27,"user":"jambolo","draft":false},"label":null,"changes":null,"installation":null}
-- 36096107025 (issues reopened 29)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096107025 started_utc=2026-09-25T04:51:06Z
PROBE-PA07 event={"action":"reopened","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":29,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36096097353 (issues closed 29)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096097353 started_utc=2026-09-25T04:50:57Z
PROBE-PA07 event={"action":"closed","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":29,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36096080842 (issues unlabeled 29)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096080842 started_utc=2026-09-25T04:50:42Z
PROBE-PA07 event={"action":"unlabeled","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":29,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":"probe-pa07:x","changes":null,"installation":null}
-- 36096067295 (issues labeled 29)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096067295 started_utc=2026-09-25T04:50:30Z
PROBE-PA07 event={"action":"labeled","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":29,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":"probe-pa07:x","changes":null,"installation":null}
-- 36096056972 (issue_comment deleted 29)
PROBE-PA07 context event_name=issue_comment actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096056972 started_utc=2026-09-25T04:50:22Z
PROBE-PA07 event={"action":"deleted","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":29,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":{"id":5826933239,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":{"id":4993303,"slug":"patch-steward-testbed"}},"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36096046198 (issue_comment edited 29)
PROBE-PA07 context event_name=issue_comment actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096046198 started_utc=2026-09-25T04:50:13Z
PROBE-PA07 event={"action":"edited","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":29,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":{"id":5826933239,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":{"id":4993303,"slug":"patch-steward-testbed"}},"pull_request":null,"label":null,"changes":["body"],"installation":null}
-- 36096037824 (issue_comment created 29)
PROBE-PA07 context event_name=issue_comment actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096037824 started_utc=2026-09-25T04:50:05Z
PROBE-PA07 event={"action":"created","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":29,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":{"id":5826933239,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":{"id":4993303,"slug":"patch-steward-testbed"}},"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36096027118 (issues edited 29)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096027118 started_utc=2026-09-25T04:49:57Z
PROBE-PA07 event={"action":"edited","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":29,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":["body"],"installation":null}
-- 36096017790 (issues opened 29)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36096017790 started_utc=2026-09-25T04:49:48Z
PROBE-PA07 event={"action":"opened","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":29,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
```

### E4 — github-pass write lines (run 36096219776)

`gh run view 36096219776 -R steady-orchard/patch-steward-testbed-public --log` filtered to `PROBE-PA07 `. https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36096219776

```text
PROBE-PA07 token=github start run_id=36096219776 pr=28 utc=2026-09-25T04:52:44Z
PROBE-PA07 token=github write=issue-create target=30 utc=2026-09-25T04:52:45Z
PROBE-PA07 token=github write=issue-edit target=30 utc=2026-09-25T04:52:53Z
PROBE-PA07 token=github write=comment-create target=30/5826958282 utc=2026-09-25T04:53:02Z
PROBE-PA07 token=github write=comment-edit target=30/5826958282 utc=2026-09-25T04:53:10Z
PROBE-PA07 token=github write=comment-delete target=30/5826958282 utc=2026-09-25T04:53:19Z
PROBE-PA07 token=github write=issue-label-add target=30 utc=2026-09-25T04:53:28Z
PROBE-PA07 token=github write=issue-label-remove target=30 utc=2026-09-25T04:53:36Z
PROBE-PA07 token=github write=issue-reaction-add target=30 utc=2026-09-25T04:53:45Z
PROBE-PA07 token=github write=issue-close target=30 utc=2026-09-25T04:53:53Z
PROBE-PA07 token=github write=issue-reopen target=30 utc=2026-09-25T04:54:02Z
PROBE-PA07 token=github write=pr-ready-for-review target=28 utc=2026-09-25T04:54:12Z
PROBE-PA07 token=github write=pr-body-edit target=28 utc=2026-09-25T04:54:20Z
PROBE-PA07 token=github write=pr-label-add target=28 utc=2026-09-25T04:54:29Z
PROBE-PA07 token=github write=pr-reaction-add target=28 utc=2026-09-25T04:54:37Z
PROBE-PA07 token=github write=issue-close-final target=30 utc=2026-09-25T04:54:46Z
PROBE-PA07 token=github done issue=30 pr=28 utc=2026-09-25T04:54:54Z
```

### E5 — listener runs for the github-pass numbers (empty)

Waited until 3 min after the github pass ended (04:54:54Z) and until no listener run was queued or in progress, then searched the full listener run list (E2's source, unfiltered) for issue 30 or PR 28; also queried directly.

```text
$ gh run list -R steady-orchard/patch-steward-testbed-public --workflow probe-pa07-listen.yml --limit 100 --json displayTitle --jq '.[] | select(.displayTitle | test(" 30$| 28$"))'
(no output)
```

### E6 — identity-field table as text

Field, value seen, platform-assigned or writer-chosen, names the installation (compare 162868612):

```text
sender.login = patch-steward-testbed[bot] | platform-assigned (App bot identity from the token) | no (identifies the App account, not the installation)
sender.id = 331019482 | platform-assigned | no
sender.type = Bot | platform-assigned | no
issue.performed_via_github_app = null on every issues/issue_comment "issue" object | platform-assigned (absence is itself platform-assigned; GitHub does not populate this sub-field on the issue object) | no
comment.performed_via_github_app = {"id":4993303,"slug":"patch-steward-testbed"} | platform-assigned; the only field naming the App id | no (names the App, 4993303, not the installation, 162868612)
github.actor = patch-steward-testbed[bot] | platform-assigned (Actions context, matches sender.login) | no
github.actor_id = 331019482 | platform-assigned | no
github.triggering_actor = patch-steward-testbed[bot] | platform-assigned | no
installation (event JSON top level) = null on every event observed | not populated for these trigger types | n/a — no field in this attempt names the installation (162868612) at all
```

A non-App user cannot set `sender.login`, `sender.id`, `sender.type`, `performed_via_github_app`, `github.actor`, or `github.actor_id`: all are platform-assigned from the token used to make the write, not from any writer-supplied field. No field observed carries the installation id 162868612; the closest is `comment.performed_via_github_app.id` (4993303), which names the App, not the installation.

### E7 — installation permissions (read)

`gh api orgs/steady-orchard/installations --jq '.installations[] | select(.app_id == 4993303) | {id, permissions}'`

```text
{"id":162868612,"permissions":{"actions":"write","checks":"write","contents":"write","issues":"write","metadata":"read","pull_requests":"write","statuses":"write"}}
```

### E8 — attempt 1 (step 2.7): ready-for-review refused with issues and pull-requests write only

`gh run view 36081670744 -R steady-orchard/patch-steward-testbed-public --log` filtered to the mint block and the GraphQL failure. Attempt 1's writer minted the App token with only `permission-issues: write` and `permission-pull-requests: write` (no `permission-contents`); `markPullRequestReadyForReview` then failed. This attempt's writer adds `contents: write` to both the job permissions and the App-token mint and the draft mutation succeeded (E1, write=pr-ready-for-review target=27, no write-refused line).

```text
  permission-issues: write
  permission-pull-requests: write
mutation($id: ID!) { markPullRequestReadyForReview(input: {pullRequestId: $id}) { pullRequest { isDraft } } }
+ gh api graphql -f 'query=mutation($id: ID!) { markPullRequestReadyForReview(input: {pullRequestId: $id}) { pullRequest { isDraft } } }' -f id=PR_kwDOUgjuiM8AAAABFCPbSg
gh: Resource not accessible by integration
```

## Deviations from the design

None.

## Residue

- Branches: attempt 1 probe-pa07-base, probe-pa07-head-1-app, probe-pa07-head-1-github; attempt 2 (this attempt) reused probe-pa07-base and added probe-pa07-head-2-app, probe-pa07-head-2-github.
- PRs: attempt 1 #2, #3 closed; this attempt #27, #28 closed.
- Issues: attempt 1 #4, #20, #21 closed; this attempt #29, #30 closed.
- Label `probe-pa07:x` remains on the test-bed (used and removed per issue/PR, definition not deleted).
- Deployed workflows on master: probe-pa07-listen.yml (blob 34ab42f011487398f8d455f6934d8587f1c318fa, unchanged since attempt 1) and probe-pa07-write.yml (blob d9213024e7ad40345c712204fbb1642bfd74952e, the corrected writer, replacing attempt 1's a986234a6885e120b875137cdad1c85ae36c6ef8).
