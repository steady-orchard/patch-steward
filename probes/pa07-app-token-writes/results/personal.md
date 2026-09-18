# PA07 — App-token writes — personal

- assumption: PA07
- test-bed: jambolo/patch-steward-testbed-personal
- probed: 2026-09-25T05:07:32Z to 2026-09-25T05:15:23Z
- step: 2.18
- workflows: probe-pa07-listen.yml 34ab42f011487398f8d455f6934d8587f1c318fa; probe-pa07-write.yml d9213024e7ad40345c712204fbb1642bfd74952e

## Results

| Sub-claim | Kind       | Result    | Cause | Evidence   |
| --------- | ---------- | --------- | ----- | ---------- |
| PA07.1    | assumption | confirmed | none  | E1, E2, E3 |
| PA07.2    | assumption | confirmed | none  | E2, E4     |

## Measurements

None taken (PA07.3's latency and recursion-guard measurements were taken only on org-public per the README).

## Evidence

### E1 — app-pass write lines (run 36097230397)

`gh run view 36097230397 -R jambolo/patch-steward-testbed-personal --log` filtered to `PROBE-PA07 `. No `write-refused=` line: the deployed writer (contents write on both tokens, per step 2.25) completed the full sequence. https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36097230397

```text
PROBE-PA07 token=app start run_id=36097230397 pr=5 utc=2026-09-25T05:07:32Z
PROBE-PA07 token=app write=issue-create target=7 utc=2026-09-25T05:07:33Z
PROBE-PA07 token=app write=issue-edit target=7 utc=2026-09-25T05:07:42Z
PROBE-PA07 token=app write=comment-create target=7/5827124117 utc=2026-09-25T05:07:51Z
PROBE-PA07 token=app write=comment-edit target=7/5827124117 utc=2026-09-25T05:07:59Z
PROBE-PA07 token=app write=comment-delete target=7/5827124117 utc=2026-09-25T05:08:09Z
PROBE-PA07 token=app write=issue-label-add target=7 utc=2026-09-25T05:08:18Z
PROBE-PA07 token=app write=issue-label-remove target=7 utc=2026-09-25T05:08:26Z
PROBE-PA07 token=app write=issue-reaction-add target=7 utc=2026-09-25T05:08:35Z
PROBE-PA07 token=app write=issue-close target=7 utc=2026-09-25T05:08:43Z
PROBE-PA07 token=app write=issue-reopen target=7 utc=2026-09-25T05:08:52Z
PROBE-PA07 token=app write=pr-ready-for-review target=5 utc=2026-09-25T05:09:02Z
PROBE-PA07 token=app write=pr-body-edit target=5 utc=2026-09-25T05:09:10Z
PROBE-PA07 token=app write=pr-label-add target=5 utc=2026-09-25T05:09:19Z
PROBE-PA07 token=app write=pr-reaction-add target=5 utc=2026-09-25T05:09:28Z
PROBE-PA07 token=app write=issue-close-final target=7 utc=2026-09-25T05:09:36Z
PROBE-PA07 token=app done issue=7 pr=5 utc=2026-09-25T05:09:44Z
```

### E2 — app-pass listener runs and their event/context lines

`gh run list -R jambolo/patch-steward-testbed-personal --workflow probe-pa07-listen.yml --limit 100 ...`, restricted to this attempt's issue 7 and PR 5. Every App write of the claim's kinds (issue create, edit, close, reopen; comment create, edit, delete; PR body edit; ready-for-review) matches a run within 10 min; label and reaction outcomes recorded but do not decide the row (issue-reaction-add and pr-reaction-add produced no run, matching the design's EXPECTED EVENT table). No `pr-convert-to-draft` write or `converted_to_draft` run appears: PR 5 was created as `draft=true`, so the writer's "convert to draft" step found nothing to do.

```text
36097388494 2026-09-25T05:09:38Z issues success probe-pa07-listen issues closed 7
36097368585 2026-09-25T05:09:21Z pull_request_target success probe-pa07-listen pull_request_target labeled 5
36097360473 2026-09-25T05:09:13Z pull_request_target success probe-pa07-listen pull_request_target edited 5
36097350581 2026-09-25T05:09:04Z pull_request_target success probe-pa07-listen pull_request_target ready_for_review 5
36097339513 2026-09-25T05:08:54Z issues success probe-pa07-listen issues reopened 7
36097329306 2026-09-25T05:08:45Z issues success probe-pa07-listen issues closed 7
36097307917 2026-09-25T05:08:28Z issues success probe-pa07-listen issues unlabeled 7
36097297340 2026-09-25T05:08:19Z issues success probe-pa07-listen issues labeled 7
36097286423 2026-09-25T05:08:10Z issue_comment success probe-pa07-listen issue_comment deleted 7
36097275906 2026-09-25T05:08:01Z issue_comment success probe-pa07-listen issue_comment edited 7
36097266793 2026-09-25T05:07:53Z issue_comment success probe-pa07-listen issue_comment created 7
36097256603 2026-09-25T05:07:45Z issues success probe-pa07-listen issues edited 7
36097245222 2026-09-25T05:07:36Z issues success probe-pa07-listen issues opened 7
```

Event/context lines per run, filtered to `PROBE-PA07 context` and `PROBE-PA07 event={...}` (newest first, matching the list above):

```text
-- 36097388494 (issues closed 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097388494 started_utc=2026-09-25T05:09:42Z
PROBE-PA07 event={"action":"closed","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36097368585 (pull_request_target labeled 5)
PROBE-PA07 context event_name=pull_request_target actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097368585 started_utc=2026-09-25T05:09:24Z
PROBE-PA07 event={"action":"labeled","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":null,"comment":null,"pull_request":{"number":5,"user":"jambolo","draft":false},"label":"probe-pa07:x","changes":null,"installation":null}
-- 36097360473 (pull_request_target edited 5)
PROBE-PA07 context event_name=pull_request_target actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097360473 started_utc=2026-09-25T05:09:18Z
PROBE-PA07 event={"action":"edited","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":null,"comment":null,"pull_request":{"number":5,"user":"jambolo","draft":false},"label":null,"changes":["body"],"installation":null}
-- 36097350581 (pull_request_target ready_for_review 5)
PROBE-PA07 context event_name=pull_request_target actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097350581 started_utc=2026-09-25T05:09:07Z
PROBE-PA07 event={"action":"ready_for_review","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":null,"comment":null,"pull_request":{"number":5,"user":"jambolo","draft":false},"label":null,"changes":null,"installation":null}
-- 36097339513 (issues reopened 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097339513 started_utc=2026-09-25T05:08:57Z
PROBE-PA07 event={"action":"reopened","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36097329306 (issues closed 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097329306 started_utc=2026-09-25T05:08:48Z
PROBE-PA07 event={"action":"closed","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36097307917 (issues unlabeled 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097307917 started_utc=2026-09-25T05:08:31Z
PROBE-PA07 event={"action":"unlabeled","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":"probe-pa07:x","changes":null,"installation":null}
-- 36097297340 (issues labeled 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097297340 started_utc=2026-09-25T05:08:22Z
PROBE-PA07 event={"action":"labeled","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":"probe-pa07:x","changes":null,"installation":null}
-- 36097286423 (issue_comment deleted 7)
PROBE-PA07 context event_name=issue_comment actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097286423 started_utc=2026-09-25T05:08:15Z
PROBE-PA07 event={"action":"deleted","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":{"id":5827124117,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":{"id":4993303,"slug":"patch-steward-testbed"}},"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36097275906 (issue_comment edited 7)
PROBE-PA07 context event_name=issue_comment actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097275906 started_utc=2026-09-25T05:08:06Z
PROBE-PA07 event={"action":"edited","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":{"id":5827124117,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":{"id":4993303,"slug":"patch-steward-testbed"}},"pull_request":null,"label":null,"changes":["body"],"installation":null}
-- 36097266793 (issue_comment created 7)
PROBE-PA07 context event_name=issue_comment actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097266793 started_utc=2026-09-25T05:07:57Z
PROBE-PA07 event={"action":"created","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":{"id":5827124117,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":{"id":4993303,"slug":"patch-steward-testbed"}},"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36097256603 (issues edited 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097256603 started_utc=2026-09-25T05:07:49Z
PROBE-PA07 event={"action":"edited","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":["body"],"installation":null}
-- 36097245222 (issues opened 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097245222 started_utc=2026-09-25T05:07:39Z
PROBE-PA07 event={"action":"opened","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
```

### E3 — github-pass write lines (run 36097417893) and listener search (empty)

`gh run view 36097417893 -R jambolo/patch-steward-testbed-personal --log` filtered to `PROBE-PA07 `. https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36097417893

```text
PROBE-PA07 token=github start run_id=36097417893 pr=6 utc=2026-09-25T05:10:09Z
PROBE-PA07 token=github write=issue-create target=8 utc=2026-09-25T05:10:10Z
PROBE-PA07 token=github write=issue-edit target=8 utc=2026-09-25T05:10:19Z
PROBE-PA07 token=github write=comment-create target=8/5827148085 utc=2026-09-25T05:10:28Z
PROBE-PA07 token=github write=comment-edit target=8/5827148085 utc=2026-09-25T05:10:36Z
PROBE-PA07 token=github write=comment-delete target=8/5827148085 utc=2026-09-25T05:10:45Z
PROBE-PA07 token=github write=issue-label-add target=8 utc=2026-09-25T05:10:54Z
PROBE-PA07 token=github write=issue-label-remove target=8 utc=2026-09-25T05:11:03Z
PROBE-PA07 token=github write=issue-reaction-add target=8 utc=2026-09-25T05:11:12Z
PROBE-PA07 token=github write=issue-close target=8 utc=2026-09-25T05:11:20Z
PROBE-PA07 token=github write=issue-reopen target=8 utc=2026-09-25T05:11:29Z
PROBE-PA07 token=github write=pr-ready-for-review target=6 utc=2026-09-25T05:11:39Z
PROBE-PA07 token=github write=pr-body-edit target=6 utc=2026-09-25T05:11:48Z
PROBE-PA07 token=github write=pr-label-add target=6 utc=2026-09-25T05:11:57Z
PROBE-PA07 token=github write=pr-reaction-add target=6 utc=2026-09-25T05:12:05Z
PROBE-PA07 token=github write=issue-close-final target=8 utc=2026-09-25T05:12:14Z
PROBE-PA07 token=github done issue=8 pr=6 utc=2026-09-25T05:12:22Z
```

Waited until 3 min after the github pass ended (05:12:22Z) and until no listener run was queued or in progress, then searched the full listener run list (E2's source, unfiltered) for issue 8 or PR 6.

```text
$ gh run list -R jambolo/patch-steward-testbed-personal --workflow probe-pa07-listen.yml --limit 100 --json displayTitle --jq '.[] | select(.displayTitle | test(" 8$| 6$"))'
(no output)
```

### E4 — identity-field table as text

Field, value seen, platform-assigned or writer-chosen, names the installation (compare 162875728):

```text
sender.login = patch-steward-testbed[bot] | platform-assigned (App bot identity from the token) | no (identifies the App account, not the installation)
sender.id = 331019482 | platform-assigned | no
sender.type = Bot | platform-assigned | no
issue.performed_via_github_app = null on every issues/issue_comment "issue" object | platform-assigned (absence is itself platform-assigned; GitHub does not populate this sub-field on the issue object) | no
comment.performed_via_github_app = {"id":4993303,"slug":"patch-steward-testbed"} | platform-assigned; the only field naming the App id | no (names the App, 4993303, not the installation, 162875728)
github.actor = patch-steward-testbed[bot] | platform-assigned (Actions context, matches sender.login) | no
github.actor_id = 331019482 | platform-assigned | no
github.triggering_actor = patch-steward-testbed[bot] | platform-assigned | no
installation (event JSON top level) = null on every event observed | not populated for these trigger types | n/a -- no field in this attempt names the installation (162875728) at all
```

A non-App user cannot set `sender.login`, `sender.id`, `sender.type`, `performed_via_github_app`, `github.actor`, or `github.actor_id`: all are platform-assigned from the token used to make the write, not from any writer-supplied field. No field observed carries the installation id 162875728; the closest is `comment.performed_via_github_app.id` (4993303), which names the App, not the installation. This matches org-public (results/org-public.md E6).

## Deviations from the design

None.

## Residue

- Branches: probe-pa07-base, probe-pa07-head-1-app, probe-pa07-head-1-github (new to this test-bed).
- PRs: #5, #6 closed.
- Issues: #7, #8 closed.
- Label `probe-pa07:x` remains on the test-bed (used and removed per issue/PR, definition not deleted).
- Deployed workflows on master: probe-pa07-listen.yml (blob 34ab42f011487398f8d455f6934d8587f1c318fa) and probe-pa07-write.yml (blob d9213024e7ad40345c712204fbb1642bfd74952e), both already identical to step 2.25's deployment (deploy.sh reported `DEPLOY identical`).
