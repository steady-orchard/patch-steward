# PA07 — App-token writes — org-private

- assumption: PA07
- test-bed: steady-orchard/patch-steward-testbed-private
- probed: 2026-09-25T05:07:08Z to 2026-09-25T05:12:07Z
- step: 2.17
- workflows: probe-pa07-listen.yml 34ab42f011487398f8d455f6934d8587f1c318fa; probe-pa07-write.yml d9213024e7ad40345c712204fbb1642bfd74952e

## Results

| Sub-claim | Kind       | Result    | Cause | Evidence   |
| --------- | ---------- | --------- | ----- | ---------- |
| PA07.1    | assumption | confirmed | none  | E1, E2, E4 |
| PA07.2    | assumption | confirmed | none  | E3, E5     |

## Measurements

None (PA07.3 was measured only on org-public; see `results/org-public.md`).

## Evidence

### E1 — app-pass write lines (run 36097211695)

`gh run view 36097211695 -R steady-orchard/patch-steward-testbed-private --log` filtered to `PROBE-PA07 `. No `write-refused=` line: the deployed writer (contents write on both tokens) completed the full sequence. https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36097211695

```text
PROBE-PA07 token=app start run_id=36097211695 pr=5 utc=2026-09-25T05:07:15Z
PROBE-PA07 token=app write=issue-create target=7 utc=2026-09-25T05:07:16Z
PROBE-PA07 token=app write=issue-edit target=7 utc=2026-09-25T05:07:25Z
PROBE-PA07 token=app write=comment-create target=7/5827121817 utc=2026-09-25T05:07:34Z
PROBE-PA07 token=app write=comment-edit target=7/5827121817 utc=2026-09-25T05:07:43Z
PROBE-PA07 token=app write=comment-delete target=7/5827121817 utc=2026-09-25T05:07:52Z
PROBE-PA07 token=app write=issue-label-add target=7 utc=2026-09-25T05:08:01Z
PROBE-PA07 token=app write=issue-label-remove target=7 utc=2026-09-25T05:08:09Z
PROBE-PA07 token=app write=issue-reaction-add target=7 utc=2026-09-25T05:08:18Z
PROBE-PA07 token=app write=issue-close target=7 utc=2026-09-25T05:08:27Z
PROBE-PA07 token=app write=issue-reopen target=7 utc=2026-09-25T05:08:36Z
PROBE-PA07 token=app write=pr-ready-for-review target=5 utc=2026-09-25T05:08:46Z
PROBE-PA07 token=app write=pr-body-edit target=5 utc=2026-09-25T05:08:54Z
PROBE-PA07 token=app write=pr-label-add target=5 utc=2026-09-25T05:09:03Z
PROBE-PA07 token=app write=pr-reaction-add target=5 utc=2026-09-25T05:09:12Z
PROBE-PA07 token=app write=issue-close-final target=7 utc=2026-09-25T05:09:21Z
PROBE-PA07 token=app done issue=7 pr=5 utc=2026-09-25T05:09:29Z
```

### E2 — app-pass listener runs

`gh run list -R steady-orchard/patch-steward-testbed-private --workflow probe-pa07-listen.yml --limit 100 ...`, restricted to this attempt's issue 7 and PR 5. Every App write of the claim's kinds (issue create, edit, close, reopen; comment create, edit, delete; PR body edit; ready-for-review) matches a run within 10 min; label and reaction outcomes recorded but do not decide the row (issue-reaction-add and pr-reaction-add produced no run, matching the design's EXPECTED EVENT table).

```text
36097369582 2026-09-25T05:09:22Z issues success probe-pa07-listen issues closed 7
36097351787 2026-09-25T05:09:05Z pull_request_target success probe-pa07-listen pull_request_target labeled 5
36097343160 2026-09-25T05:08:57Z pull_request_target success probe-pa07-listen pull_request_target edited 5
36097332219 2026-09-25T05:08:47Z pull_request_target success probe-pa07-listen pull_request_target ready_for_review 5
36097319428 2026-09-25T05:08:37Z issues success probe-pa07-listen issues reopened 7
36097308477 2026-09-25T05:08:28Z issues success probe-pa07-listen issues closed 7
36097287646 2026-09-25T05:08:11Z issues success probe-pa07-listen issues unlabeled 7
36097277308 2026-09-25T05:08:02Z issues success probe-pa07-listen issues labeled 7
36097266358 2026-09-25T05:07:53Z issue_comment success probe-pa07-listen issue_comment deleted 7
36097257913 2026-09-25T05:07:46Z issue_comment success probe-pa07-listen issue_comment edited 7
36097246162 2026-09-25T05:07:37Z issue_comment success probe-pa07-listen issue_comment created 7
36097234978 2026-09-25T05:07:28Z issues success probe-pa07-listen issues edited 7
36097225510 2026-09-25T05:07:20Z issues success probe-pa07-listen issues opened 7
```

No `pr-convert-to-draft` write or `pull_request_target converted_to_draft` run appears: PR 5 was created as `draft=true`, so the writer's "convert to draft if needed" step found nothing to do.

### E3 — app-pass event/context lines

`gh run view <id> -R steady-orchard/patch-steward-testbed-private --log` for each run of E2, filtered to the `context event_name=...` and `event={...}` lines. Runs in the same order as E2 (newest first).

```text
-- 36097369582 (issues closed 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097369582 started_utc=2026-09-25T05:09:26Z
PROBE-PA07 event={"action":"closed","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36097351787 (pull_request_target labeled 5)
PROBE-PA07 context event_name=pull_request_target actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097351787 started_utc=2026-09-25T05:09:09Z
PROBE-PA07 event={"action":"labeled","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":null,"comment":null,"pull_request":{"number":5,"user":"jambolo","draft":false},"label":"probe-pa07:x","changes":null,"installation":null}
-- 36097343160 (pull_request_target edited 5)
PROBE-PA07 context event_name=pull_request_target actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097343160 started_utc=2026-09-25T05:09:01Z
PROBE-PA07 event={"action":"edited","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":null,"comment":null,"pull_request":{"number":5,"user":"jambolo","draft":false},"label":null,"changes":["body"],"installation":null}
-- 36097332219 (pull_request_target ready_for_review 5)
PROBE-PA07 context event_name=pull_request_target actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097332219 started_utc=2026-09-25T05:08:51Z
PROBE-PA07 event={"action":"ready_for_review","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":null,"comment":null,"pull_request":{"number":5,"user":"jambolo","draft":false},"label":null,"changes":null,"installation":null}
-- 36097319428 (issues reopened 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097319428 started_utc=2026-09-25T05:08:43Z
PROBE-PA07 event={"action":"reopened","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36097308477 (issues closed 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097308477 started_utc=2026-09-25T05:08:32Z
PROBE-PA07 event={"action":"closed","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36097287646 (issues unlabeled 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097287646 started_utc=2026-09-25T05:08:16Z
PROBE-PA07 event={"action":"unlabeled","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":"probe-pa07:x","changes":null,"installation":null}
-- 36097277308 (issues labeled 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097277308 started_utc=2026-09-25T05:08:06Z
PROBE-PA07 event={"action":"labeled","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":"probe-pa07:x","changes":null,"installation":null}
-- 36097266358 (issue_comment deleted 7)
PROBE-PA07 context event_name=issue_comment actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097266358 started_utc=2026-09-25T05:07:56Z
PROBE-PA07 event={"action":"deleted","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":{"id":5827121817,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":{"id":4993303,"slug":"patch-steward-testbed"}},"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36097257913 (issue_comment edited 7)
PROBE-PA07 context event_name=issue_comment actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097257913 started_utc=2026-09-25T05:07:50Z
PROBE-PA07 event={"action":"edited","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":{"id":5827121817,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":{"id":4993303,"slug":"patch-steward-testbed"}},"pull_request":null,"label":null,"changes":["body"],"installation":null}
-- 36097246162 (issue_comment created 7)
PROBE-PA07 context event_name=issue_comment actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097246162 started_utc=2026-09-25T05:07:41Z
PROBE-PA07 event={"action":"created","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":{"id":5827121817,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":{"id":4993303,"slug":"patch-steward-testbed"}},"pull_request":null,"label":null,"changes":null,"installation":null}
-- 36097234978 (issues edited 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097234978 started_utc=2026-09-25T05:07:32Z
PROBE-PA07 event={"action":"edited","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":["body"],"installation":null}
-- 36097225510 (issues opened 7)
PROBE-PA07 context event_name=issues actor=patch-steward-testbed[bot] actor_id=331019482 triggering_actor=patch-steward-testbed[bot] run_id=36097225510 started_utc=2026-09-25T05:07:23Z
PROBE-PA07 event={"action":"opened","sender":{"login":"patch-steward-testbed[bot]","id":331019482,"type":"Bot"},"issue":{"number":7,"user":"patch-steward-testbed[bot]","user_type":"Bot","performed_via_github_app":null},"comment":null,"pull_request":null,"label":null,"changes":null,"installation":null}
```

### E4 — github-pass write lines (run 36097398127) and listener runs (empty)

`gh run view 36097398127 -R steady-orchard/patch-steward-testbed-private --log` filtered to `PROBE-PA07 `. https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36097398127

```text
PROBE-PA07 token=github start run_id=36097398127 pr=6 utc=2026-09-25T05:09:52Z
PROBE-PA07 token=github write=issue-create target=8 utc=2026-09-25T05:09:54Z
PROBE-PA07 token=github write=issue-edit target=8 utc=2026-09-25T05:10:03Z
PROBE-PA07 token=github write=comment-create target=8/5827145661 utc=2026-09-25T05:10:12Z
PROBE-PA07 token=github write=comment-edit target=8/5827145661 utc=2026-09-25T05:10:20Z
PROBE-PA07 token=github write=comment-delete target=8/5827145661 utc=2026-09-25T05:10:29Z
PROBE-PA07 token=github write=issue-label-add target=8 utc=2026-09-25T05:10:38Z
PROBE-PA07 token=github write=issue-label-remove target=8 utc=2026-09-25T05:10:47Z
PROBE-PA07 token=github write=issue-reaction-add target=8 utc=2026-09-25T05:10:55Z
PROBE-PA07 token=github write=issue-close target=8 utc=2026-09-25T05:11:05Z
PROBE-PA07 token=github write=issue-reopen target=8 utc=2026-09-25T05:11:13Z
PROBE-PA07 token=github write=pr-ready-for-review target=6 utc=2026-09-25T05:11:23Z
PROBE-PA07 token=github write=pr-body-edit target=6 utc=2026-09-25T05:11:32Z
PROBE-PA07 token=github write=pr-label-add target=6 utc=2026-09-25T05:11:41Z
PROBE-PA07 token=github write=pr-reaction-add target=6 utc=2026-09-25T05:11:50Z
PROBE-PA07 token=github write=issue-close-final target=8 utc=2026-09-25T05:11:59Z
PROBE-PA07 token=github done issue=8 pr=6 utc=2026-09-25T05:12:07Z
```

Waited until 3 min after the github pass ended (05:12:07Z) and until no listener run was queued or in progress, then searched the full listener run list (E2's source, unfiltered) for issue 8 or PR 6.

```text
$ gh run list -R steady-orchard/patch-steward-testbed-private --workflow probe-pa07-listen.yml --limit 100 --json displayTitle --jq '.[] | select(.displayTitle | test(" 8$| 6$"))'
(no output)
```

### E5 — identity-field table as text

Field, value seen, platform-assigned or writer-chosen, names the installation (compare 162868612, the same installation id observed on org-public — `gh api orgs/steady-orchard/installations --jq '.installations[] | select(.app_id == 4993303) | {id, permissions}'` returned `{"id":162868612,"permissions":{"actions":"write","checks":"write","contents":"write","issues":"write","metadata":"read","pull_requests":"write","statuses":"write"}}`):

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

A non-App user cannot set `sender.login`, `sender.id`, `sender.type`, `performed_via_github_app`, `github.actor`, or `github.actor_id`: all are platform-assigned from the token used to make the write, not from any writer-supplied field. No field observed carries the installation id 162868612; the closest is `comment.performed_via_github_app.id` (4993303), which names the App, not the installation. Identical result shape to org-public (`results/org-public.md` E6): the same App installation, same field set, same absence of an installation-identifying field.

## Deviations from the design

None.

## Residue

- Branches: this attempt's probe-pa07-base, probe-pa07-head-1-app, probe-pa07-head-1-github.
- PRs: #5, #6 closed.
- Issues: #7, #8 closed.
- Label `probe-pa07:x` remains on the test-bed (used and removed per issue/PR, definition not deleted).
- Deployed workflows on master: probe-pa07-listen.yml (blob 34ab42f011487398f8d455f6934d8587f1c318fa) and probe-pa07-write.yml (blob d9213024e7ad40345c712204fbb1642bfd74952e), both identical to org-public's step-2.25 blobs (no push made; deploy.sh reported `identical`).
