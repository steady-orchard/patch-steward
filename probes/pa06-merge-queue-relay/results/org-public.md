# PA06 — Merge-queue relay — org-public

- assumption: PA06
- test-bed: steady-orchard/patch-steward-testbed-public
- probed: 2026-09-25T03:40:31Z to 2026-09-25T03:57:30Z
- step: 2.24
- workflows: probe-pa06-relay.yml cfbf269eb514137c6db3c0b56579a96515ce3971; probe-pa06-steward.yml e63329c8998c85dda0303259c040164ef1c732c5; probe-pa06-control.yml f3c4f36d5e5fb5bbc44f2aaa5386bf46aed3c696

## Results

| Sub-claim | Kind        | Result    | Cause | Evidence           |
| --------- | ----------- | --------- | ----- | ------------------ |
| PA06.1    | assumption  | confirmed | none  | E3, E4             |
| PA06.2    | assumption  | confirmed | none  | E4, E5             |
| PA06.3    | assumption  | confirmed | none  | E2, E6, E7, E8     |
| PA06.4    | assumption  | confirmed | none  | E3, E6, E7, E8     |
| PA06.5    | measurement | confirmed | none  | E3, E4, E6, E7, E9 |

## Measurements

| Sub-claim | Quantity                               | Value                     | Unit | Method                                                                               | Samples |
| --------- | -------------------------------------- | ------------------------- | ---- | ------------------------------------------------------------------------------------ | ------- |
| PA06.5    | merge_group to relay completion        | 5 to 7 (6, 6, 5, 7, 6, 5) | s    | relay run createdAt to updatedAt                                                     | 6       |
| PA06.5    | relay completion to workflow_run start | 2 to 3 (2, 2, 2, 2, 2, 3) | s    | relay updatedAt to steward run createdAt                                             | 6       |
| PA06.5    | check completion to merge              | 31 (31, 31)               | s    | driver-written App check completed_at to PR merged_at (p1 PR 22, p5 PR 26)           | 2       |
| PA06.5    | configured check-response timeout      | 300                       | s    | ruleset read-back check_response_timeout_minutes 5; GraphQL checkResponseTimeout 300 | 1       |
| PA06.5    | observed timeout                       | 331                       | s    | p3 PR 24 added_to_merge_queue 03:46:33Z to removed_from_merge_queue 03:52:04Z        | 1       |
| PA06.5    | minimum check-response timeout         | not measured              | min  | no platform answer obtained                                                          | 0       |

## Evidence

### E1 — setup: settings, deployment, ruleset, heads, PRs

Settings read, deploy.sh outputs, ruleset read-back, compare, PR creation, required check on PR heads (control run https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36091313402).

```text
{"allow_auto_merge":true,"allow_merge_commit":true}
DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=master existed=yes
DEPLOY commit=56d4b0febb556b6b6a403cc50289836432782f29 message=probe(PA06): deploy PA06 workflows (attempt 2)
DEPLOY identical dest=.github/workflows/probe-pa06-relay.yml blob=cfbf269eb514137c6db3c0b56579a96515ce3971
DEPLOY identical dest=.github/workflows/probe-pa06-steward.yml blob=e63329c8998c85dda0303259c040164ef1c732c5
DEPLOY identical dest=.github/workflows/probe-pa06-control.yml blob=f3c4f36d5e5fb5bbc44f2aaa5386bf46aed3c696
DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=probe-pa06-base existed=yes
DEPLOY commit=none reason=already-identical
DEPLOY identical dest=.github/workflows/probe-pa06-relay.yml blob=cfbf269eb514137c6db3c0b56579a96515ce3971
DEPLOY identical dest=probe-pa06/base.txt blob=368c872816cd6458a82a8383162ad0788b787adb
23972114
{"enforcement":"active","id":23972114,"include":["refs/heads/probe-pa06-base"],"name":"probe-pa06-queue","rules":[{"parameters":{"do_not_enforce_on_create":false,"required_status_checks":[{"context":"probe-pa06/gate","integration_id":4993303}],"strict_required_status_checks_policy":false},"type":"required_status_checks"},{"parameters":{"check_response_timeout_minutes":5,"grouping_strategy":"ALLGREEN","max_entries_to_build":5,"max_entries_to_merge":5,"merge_method":"MERGE","min_entries_to_merge":1,"min_entries_to_merge_wait_minutes":0},"type":"merge_queue"}]}
B = 1c5c399b48a0ccca6a9989eacb6ebc2279e6a9c9 (refs probe-pa06-head-2-1..5 created from B)
1 0 probe-pa06/entry-2-1.txt
1 0 probe-pa06/entry-2-2.txt
1 0 probe-pa06/entry-2-3.txt
1 0 probe-pa06/entry-2-4.txt
1 0 probe-pa06/entry-2-5.txt
22 b9ae5e9c116e4cfbd59d197bd7307c6fb29a510c   (p1 mode=success)
23 7c9f97cea1708a8300510848abbf0c12961eeb4e   (p2 mode=failure)
24 6a0a3aa55f91df8620d24029cdfdc86080f37ce7   (p3 mode=none)
25 17813d6ae8919586024b8b779e9a1eaab594c90b   (p4 mode=none)
26 b46eef5018c202bcb2470bf62e3defd7496ec65b   (p5 mode=success)
PROBE-PA06 control action=check sha=b9ae5e9c116e4cfbd59d197bd7307c6fb29a510c exit=0 result=id=107934177168 app=patch-steward-testbed conclusion=success completed_at=2026-09-25T03:40:37Z utc=2026-09-25T03:40:37Z
[... 4 identical lines for the other heads elided ...]
22 open merged=false merged_at=null mergeable_state=clean
23 open merged=false merged_at=null mergeable_state=clean
24 open merged=false merged_at=null mergeable_state=clean
25 open merged=false merged_at=null mergeable_state=clean
26 open merged=false merged_at=null mergeable_state=clean
```

### E2 — App-token enqueue and dequeue responses

Control runs 36091357240, 36091501413, 36091716935, 36092130093, 36092159814, 36092201485 (https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/<id>).

```text
PROBE-PA06 control action=enqueue pr=22 token=app exit=0 response={"data":{"enqueuePullRequest":{"mergeQueueEntry":{"position":1,"state":"QUEUED","enqueuedAt":"2026-09-25T03:41:16Z","headCommit":null}}}} utc=2026-09-25T03:41:16Z
PROBE-PA06 control action=enqueue pr=23 token=app exit=0 response={"data":{"enqueuePullRequest":{"mergeQueueEntry":{"position":1,"state":"QUEUED","enqueuedAt":"2026-09-25T03:43:25Z","headCommit":null}}}} utc=2026-09-25T03:43:26Z
PROBE-PA06 control action=enqueue pr=24 token=app exit=0 response={"data":{"enqueuePullRequest":{"mergeQueueEntry":{"position":1,"state":"QUEUED","enqueuedAt":"2026-09-25T03:46:32Z","headCommit":null}}}} utc=2026-09-25T03:46:33Z
PROBE-PA06 control action=enqueue pr=25 token=app exit=0 response={"data":{"enqueuePullRequest":{"mergeQueueEntry":{"position":1,"state":"QUEUED","enqueuedAt":"2026-09-25T03:52:39Z","headCommit":null}}}} utc=2026-09-25T03:52:39Z
PROBE-PA06 control action=enqueue pr=26 token=app exit=0 response={"data":{"enqueuePullRequest":{"mergeQueueEntry":{"position":2,"state":"QUEUED","enqueuedAt":"2026-09-25T03:53:06Z","headCommit":null}}}} utc=2026-09-25T03:53:06Z
PROBE-PA06 control action=dequeue pr=25 token=app exit=0 response={"data":{"dequeuePullRequest":{"mergeQueueEntry":{"position":1,"state":"AWAITING_CHECKS"}}}} utc=2026-09-25T03:53:42Z
```

### E3 — relay runs (merge_group) per group

`gh run list ... --workflow probe-pa06-relay.yml` and relay facts. Groups: S1 fb69fdb (PR 22), S2 b3b15c2 (PR 23), S3 1491a8a (PR 24), S4 C1 a290161 (PR 25), C2 4caf16f (PR 26 behind 25), C3 4f43e5b (PR 26 alone).

```text
36092227694 gh-readonly-queue/probe-pa06-base/pr-26-fb69fdbfb93d2cdb5a48c298b02d025597930315 4f43e5b371f46576a26f0cbaa52f2145ae2bd5be completed success 2026-09-25T03:53:58Z 2026-09-25T03:54:03Z
36092189388 gh-readonly-queue/probe-pa06-base/pr-26-a29016145b0ec0842012a27805c30aefa28e1905 4caf16f1c38f66d8cf0995808ac66b1c9171c786 completed success 2026-09-25T03:53:25Z 2026-09-25T03:53:31Z
36092158994 gh-readonly-queue/probe-pa06-base/pr-25-fb69fdbfb93d2cdb5a48c298b02d025597930315 a29016145b0ec0842012a27805c30aefa28e1905 completed success 2026-09-25T03:52:58Z 2026-09-25T03:53:05Z
36091745462 gh-readonly-queue/probe-pa06-base/pr-24-fb69fdbfb93d2cdb5a48c298b02d025597930315 1491a8a2ecabd482d66571f13b56a295b2e90d64 completed success 2026-09-25T03:46:51Z 2026-09-25T03:46:56Z
36091529854 gh-readonly-queue/probe-pa06-base/pr-23-fb69fdbfb93d2cdb5a48c298b02d025597930315 b3b15c2f6a546a497be535db1ceb89d9bcc29ff5 completed success 2026-09-25T03:43:43Z 2026-09-25T03:43:49Z
36091384288 gh-readonly-queue/probe-pa06-base/pr-22-1c5c399b48a0ccca6a9989eacb6ebc2279e6a9c9 fb69fdbfb93d2cdb5a48c298b02d025597930315 completed success 2026-09-25T03:41:34Z 2026-09-25T03:41:40Z
-- 36091384288
PROBE-PA06 job=relay head_sha=fb69fdbfb93d2cdb5a48c298b02d025597930315 head_ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-22-1c5c399b48a0ccca6a9989eacb6ebc2279e6a9c9 base_sha=1c5c399b48a0ccca6a9989eacb6ebc2279e6a9c9 base_ref=refs/heads/probe-pa06-base
PROBE-PA06 job=relay ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-22-1c5c399b48a0ccca6a9989eacb6ebc2279e6a9c9 sha=fb69fdbfb93d2cdb5a48c298b02d025597930315 sender=patch-steward-testbed[bot] actor=patch-steward-testbed[bot] run_id=36091384288 utc=2026-09-25T03:41:38Z
-- 36091529854
PROBE-PA06 job=relay head_sha=b3b15c2f6a546a497be535db1ceb89d9bcc29ff5 head_ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-23-fb69fdbfb93d2cdb5a48c298b02d025597930315 base_sha=fb69fdbfb93d2cdb5a48c298b02d025597930315 base_ref=refs/heads/probe-pa06-base
PROBE-PA06 job=relay ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-23-fb69fdbfb93d2cdb5a48c298b02d025597930315 sha=b3b15c2f6a546a497be535db1ceb89d9bcc29ff5 sender=patch-steward-testbed[bot] actor=patch-steward-testbed[bot] run_id=36091529854 utc=2026-09-25T03:43:47Z
-- 36091745462
PROBE-PA06 job=relay head_sha=1491a8a2ecabd482d66571f13b56a295b2e90d64 head_ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-24-fb69fdbfb93d2cdb5a48c298b02d025597930315 base_sha=fb69fdbfb93d2cdb5a48c298b02d025597930315 base_ref=refs/heads/probe-pa06-base
PROBE-PA06 job=relay ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-24-fb69fdbfb93d2cdb5a48c298b02d025597930315 sha=1491a8a2ecabd482d66571f13b56a295b2e90d64 sender=patch-steward-testbed[bot] actor=patch-steward-testbed[bot] run_id=36091745462 utc=2026-09-25T03:46:54Z
-- 36092158994
PROBE-PA06 job=relay head_sha=a29016145b0ec0842012a27805c30aefa28e1905 head_ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-25-fb69fdbfb93d2cdb5a48c298b02d025597930315 base_sha=fb69fdbfb93d2cdb5a48c298b02d025597930315 base_ref=refs/heads/probe-pa06-base
PROBE-PA06 job=relay ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-25-fb69fdbfb93d2cdb5a48c298b02d025597930315 sha=a29016145b0ec0842012a27805c30aefa28e1905 sender=patch-steward-testbed[bot] actor=patch-steward-testbed[bot] run_id=36092158994 utc=2026-09-25T03:53:02Z
-- 36092189388
PROBE-PA06 job=relay head_sha=4caf16f1c38f66d8cf0995808ac66b1c9171c786 head_ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-26-a29016145b0ec0842012a27805c30aefa28e1905 base_sha=a29016145b0ec0842012a27805c30aefa28e1905 base_ref=refs/heads/probe-pa06-base
PROBE-PA06 job=relay ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-26-a29016145b0ec0842012a27805c30aefa28e1905 sha=4caf16f1c38f66d8cf0995808ac66b1c9171c786 sender=patch-steward-testbed[bot] actor=patch-steward-testbed[bot] run_id=36092189388 utc=2026-09-25T03:53:28Z
-- 36092227694
PROBE-PA06 job=relay head_sha=4f43e5b371f46576a26f0cbaa52f2145ae2bd5be head_ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-26-fb69fdbfb93d2cdb5a48c298b02d025597930315 base_sha=fb69fdbfb93d2cdb5a48c298b02d025597930315 base_ref=refs/heads/probe-pa06-base
PROBE-PA06 job=relay ref=refs/heads/gh-readonly-queue/probe-pa06-base/pr-26-fb69fdbfb93d2cdb5a48c298b02d025597930315 sha=4f43e5b371f46576a26f0cbaa52f2145ae2bd5be sender=patch-steward-testbed[bot] actor=patch-steward-testbed[bot] run_id=36092227694 utc=2026-09-25T03:54:01Z
```

### E4 — steward (workflow_run) runs and record facts

`gh run list ... --workflow probe-pa06-steward.yml` and record facts (sender fields). Runs 36091393031, 36091537903, 36091754701, 36092170468, 36092198902, 36092236780.

```text
36092236780 probe-pa06-steward 4f43e5b371f46576a26f0cbaa52f2145ae2bd5be completed success 2026-09-25T03:54:06Z 2026-09-25T03:54:13Z
36092198902 probe-pa06-steward 4caf16f1c38f66d8cf0995808ac66b1c9171c786 completed success 2026-09-25T03:53:33Z 2026-09-25T03:53:41Z
36092170468 probe-pa06-steward a29016145b0ec0842012a27805c30aefa28e1905 completed success 2026-09-25T03:53:07Z 2026-09-25T03:53:14Z
36091754701 probe-pa06-steward 1491a8a2ecabd482d66571f13b56a295b2e90d64 completed success 2026-09-25T03:46:58Z 2026-09-25T03:47:05Z
36091537903 probe-pa06-steward b3b15c2f6a546a497be535db1ceb89d9bcc29ff5 completed success 2026-09-25T03:43:51Z 2026-09-25T03:43:59Z
36091393031 probe-pa06-steward fb69fdbfb93d2cdb5a48c298b02d025597930315 completed success 2026-09-25T03:41:42Z 2026-09-25T03:41:48Z
-- 36091393031
PROBE-PA06 job=steward-record ref=refs/heads/master workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa06-steward.yml@refs/heads/master sender=patch-steward-testbed[bot] sender_type=Bot actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot] start_utc=2026-09-25T03:41:46Z
PROBE-PA06 job=steward-record workflow_run id=36091384288 event=merge_group conclusion=success head_sha=fb69fdbfb93d2cdb5a48c298b02d025597930315 head_branch=gh-readonly-queue/probe-pa06-base/pr-22-1c5c399b48a0ccca6a9989eacb6ebc2279e6a9c9 created_at=2026-09-25T03:41:34Z updated_at=2026-09-25T03:41:40Z actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot]
PROBE-PA06 job=steward-record workflow_run.pull_requests=[]
PROBE-PA06 job=steward-record pr=22 group_commit=fb69fdbfb93d2cdb5a48c298b02d025597930315
-- 36091537903
PROBE-PA06 job=steward-record ref=refs/heads/master workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa06-steward.yml@refs/heads/master sender=patch-steward-testbed[bot] sender_type=Bot actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot] start_utc=2026-09-25T03:43:55Z
PROBE-PA06 job=steward-record workflow_run id=36091529854 event=merge_group conclusion=success head_sha=b3b15c2f6a546a497be535db1ceb89d9bcc29ff5 head_branch=gh-readonly-queue/probe-pa06-base/pr-23-fb69fdbfb93d2cdb5a48c298b02d025597930315 created_at=2026-09-25T03:43:43Z updated_at=2026-09-25T03:43:49Z actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot]
PROBE-PA06 job=steward-record workflow_run.pull_requests=[]
PROBE-PA06 job=steward-record pr=23 group_commit=b3b15c2f6a546a497be535db1ceb89d9bcc29ff5
-- 36091754701
PROBE-PA06 job=steward-record ref=refs/heads/master workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa06-steward.yml@refs/heads/master sender=patch-steward-testbed[bot] sender_type=Bot actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot] start_utc=2026-09-25T03:47:02Z
PROBE-PA06 job=steward-record workflow_run id=36091745462 event=merge_group conclusion=success head_sha=1491a8a2ecabd482d66571f13b56a295b2e90d64 head_branch=gh-readonly-queue/probe-pa06-base/pr-24-fb69fdbfb93d2cdb5a48c298b02d025597930315 created_at=2026-09-25T03:46:51Z updated_at=2026-09-25T03:46:56Z actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot]
PROBE-PA06 job=steward-record workflow_run.pull_requests=[]
PROBE-PA06 job=steward-record pr=24 group_commit=1491a8a2ecabd482d66571f13b56a295b2e90d64
-- 36092170468
PROBE-PA06 job=steward-record ref=refs/heads/master workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa06-steward.yml@refs/heads/master sender=patch-steward-testbed[bot] sender_type=Bot actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot] start_utc=2026-09-25T03:53:11Z
PROBE-PA06 job=steward-record workflow_run id=36092158994 event=merge_group conclusion=success head_sha=a29016145b0ec0842012a27805c30aefa28e1905 head_branch=gh-readonly-queue/probe-pa06-base/pr-25-fb69fdbfb93d2cdb5a48c298b02d025597930315 created_at=2026-09-25T03:52:58Z updated_at=2026-09-25T03:53:05Z actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot]
PROBE-PA06 job=steward-record workflow_run.pull_requests=[]
PROBE-PA06 job=steward-record pr=25 group_commit=a29016145b0ec0842012a27805c30aefa28e1905
-- 36092198902
PROBE-PA06 job=steward-record ref=refs/heads/master workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa06-steward.yml@refs/heads/master sender=patch-steward-testbed[bot] sender_type=Bot actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot] start_utc=2026-09-25T03:53:37Z
PROBE-PA06 job=steward-record workflow_run id=36092189388 event=merge_group conclusion=success head_sha=4caf16f1c38f66d8cf0995808ac66b1c9171c786 head_branch=gh-readonly-queue/probe-pa06-base/pr-26-a29016145b0ec0842012a27805c30aefa28e1905 created_at=2026-09-25T03:53:25Z updated_at=2026-09-25T03:53:31Z actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot]
PROBE-PA06 job=steward-record workflow_run.pull_requests=[]
PROBE-PA06 job=steward-record pr=26 group_commit=4caf16f1c38f66d8cf0995808ac66b1c9171c786
-- 36092236780
PROBE-PA06 job=steward-record ref=refs/heads/master workflow_ref=steady-orchard/patch-steward-testbed-public/.github/workflows/probe-pa06-steward.yml@refs/heads/master sender=patch-steward-testbed[bot] sender_type=Bot actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot] start_utc=2026-09-25T03:54:10Z
PROBE-PA06 job=steward-record workflow_run id=36092227694 event=merge_group conclusion=success head_sha=4f43e5b371f46576a26f0cbaa52f2145ae2bd5be head_branch=gh-readonly-queue/probe-pa06-base/pr-26-fb69fdbfb93d2cdb5a48c298b02d025597930315 created_at=2026-09-25T03:53:58Z updated_at=2026-09-25T03:54:03Z actor=patch-steward-testbed[bot] triggering_actor=patch-steward-testbed[bot]
PROBE-PA06 job=steward-record workflow_run.pull_requests=[]
PROBE-PA06 job=steward-record pr=26 group_commit=4f43e5b371f46576a26f0cbaa52f2145ae2bd5be
```

### E5 — steward job conclusions

`gh api .../actions/runs/<id>/jobs` for each steward run of E4 (same order: 36091393031, 36091537903, 36091754701, 36092170468, 36092198902, 36092236780). Every write job skipped: the sender was patch-steward-testbed[bot], not jambolo, so the DRIVER RULE applied.

```text
record completed success
write completed skipped
[... the same two lines for each of the other 5 steward runs, 10 lines elided ...]
```

### E6 — driver check runs (control workflow, default branch)

Runs 36091436254 (S1 C=fb69fdb), 36091568095 (S2 b3b15c2), 36092268551 (S4 C3 4f43e5b), 36092336026 (orphan C1 a290161, after p5 merged). No check for S3 (mode none) or before the dequeue on C1/C2.

```text
PROBE-PA06 control action=check sha=fb69fdbfb93d2cdb5a48c298b02d025597930315 exit=0 result=id=107934548986 app=patch-steward-testbed conclusion=success completed_at=2026-09-25T03:42:28Z utc=2026-09-25T03:42:28Z
PROBE-PA06 control action=check sha=b3b15c2f6a546a497be535db1ceb89d9bcc29ff5 exit=0 result=id=107934946301 app=patch-steward-testbed conclusion=failure completed_at=2026-09-25T03:44:27Z utc=2026-09-25T03:44:27Z
PROBE-PA06 control action=check sha=4f43e5b371f46576a26f0cbaa52f2145ae2bd5be exit=0 result=id=107937022498 app=patch-steward-testbed conclusion=success completed_at=2026-09-25T03:54:44Z utc=2026-09-25T03:54:44Z
PROBE-PA06 control action=check sha=a29016145b0ec0842012a27805c30aefa28e1905 exit=0 result=id=107937208892 app=patch-steward-testbed conclusion=success completed_at=2026-09-25T03:55:40Z utc=2026-09-25T03:55:40Z
```

### E7 — queue events with removal reasons (this attempt)

TOOLS removal-reason query per PR.

```text
-- PR 22
AddedToMergeQueueEvent 2026-09-25T03:41:16Z actor=patch-steward-testbed reason= before=
RemovedFromMergeQueueEvent 2026-09-25T03:42:59Z actor=github-merge-queue reason=merged before=fb69fdbfb93d2cdb5a48c298b02d025597930315
-- PR 23
AddedToMergeQueueEvent 2026-09-25T03:43:26Z actor=patch-steward-testbed reason= before=
RemovedFromMergeQueueEvent 2026-09-25T03:44:58Z actor=github-merge-queue reason=failed_checks before=b3b15c2f6a546a497be535db1ceb89d9bcc29ff5
-- PR 24
AddedToMergeQueueEvent 2026-09-25T03:46:33Z actor=patch-steward-testbed reason= before=
RemovedFromMergeQueueEvent 2026-09-25T03:52:04Z actor=github-merge-queue reason=checks_timed_out before=1491a8a2ecabd482d66571f13b56a295b2e90d64
-- PR 25
AddedToMergeQueueEvent 2026-09-25T03:52:39Z actor=patch-steward-testbed reason= before=
RemovedFromMergeQueueEvent 2026-09-25T03:53:42Z actor=patch-steward-testbed reason=manual before=a29016145b0ec0842012a27805c30aefa28e1905
-- PR 26
AddedToMergeQueueEvent 2026-09-25T03:53:06Z actor=patch-steward-testbed reason= before=
RemovedFromMergeQueueEvent 2026-09-25T03:55:15Z actor=github-merge-queue reason=merged before=4f43e5b371f46576a26f0cbaa52f2145ae2bd5be
```

### E8 — PR states, queue, and checks on orphaned C1 (after the orphan check)

Read at 2026-09-25T03:56:40Z (more than 60 s after the orphan check; the collection ran immediately rather than after a full 2 min, see report). PRs https://github.com/steady-orchard/patch-steward-testbed-public/pull/22 to /pull/26; 23, 24, 25 then closed unmerged by action 16.

```text
22 closed merged=true merged_at=2026-09-25T03:42:59Z mergeable_state=unknown
23 open merged=false merged_at=null mergeable_state=unknown
24 open merged=false merged_at=null mergeable_state=unknown
25 open merged=false merged_at=null mergeable_state=unknown
26 closed merged=true merged_at=2026-09-25T03:55:15Z mergeable_state=unknown
{"data":{"repository":{"mergeQueue":{"configuration":{"checkResponseTimeout":300,"mergeMethod":"MERGE","maximumEntriesToBuild":5,"minimumEntriesToMerge":1},"entries":{"nodes":[]}}}}}
107937208892 probe-pa06/gate patch-steward-testbed success 2026-09-25T03:55:40Z
107936668915 relay github-actions success 2026-09-25T03:53:05Z
closed
closed
closed
```

### E9 — merge_group run counts per window

`gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?event=merge_group&created=<window>" --jq .total_count` for the attempt-1 window 2026-09-25T01:00:00Z..02:00:00Z, then this attempt's window 2026-09-25T03:38:00Z..03:58:00Z.

```text
0
6
```

### E10 — attempt 1 (step 2.6): job GITHUB_TOKEN enqueues, no merge_group run

PR 9 timeline, then the removal-reason query for PRs 9, 10, 11, 12, 15. Every enqueue actor is github-actions (the job GITHUB_TOKEN); E9 shows 0 merge_group runs in that window. This is a finding about the enqueuer, not the relay.

```text
added_to_merge_queue github-actions[bot] 2026-09-25T01:19:03Z
removed_from_merge_queue github-merge-queue[bot] 2026-09-25T01:24:34Z
added_to_merge_queue github-actions[bot] 2026-09-25T01:37:23Z
removed_from_merge_queue github-merge-queue[bot] 2026-09-25T01:42:55Z
-- PR 9
AddedToMergeQueueEvent 2026-09-25T01:19:03Z actor=github-actions reason= before=
RemovedFromMergeQueueEvent 2026-09-25T01:24:34Z actor=github-merge-queue reason=checks_timed_out before=9b88d44e6039bd937cd4bf517c354c5e542419c1
AddedToMergeQueueEvent 2026-09-25T01:37:23Z actor=github-actions reason= before=
RemovedFromMergeQueueEvent 2026-09-25T01:42:55Z actor=github-merge-queue reason=checks_timed_out before=90ed259fb76f60d782dbb1880d2f281c9b059444
-- PR 10
AddedToMergeQueueEvent 2026-09-25T01:31:19Z actor=github-actions reason= before=
RemovedFromMergeQueueEvent 2026-09-25T01:36:52Z actor=github-merge-queue reason=checks_timed_out before=7266f0667adc1e398bf323d7789b637d9526ee13
-- PR 11
AddedToMergeQueueEvent 2026-09-25T01:43:28Z actor=github-actions reason= before=
RemovedFromMergeQueueEvent 2026-09-25T01:48:59Z actor=github-merge-queue reason=checks_timed_out before=7e1d219d14b4fd207ff76eca2ba8179245409a94
-- PR 12
AddedToMergeQueueEvent 2026-09-25T01:49:21Z actor=github-actions reason= before=
RemovedFromMergeQueueEvent 2026-09-25T01:54:52Z actor=github-merge-queue reason=checks_timed_out before=5020afcd3f90605b95650a0dfd5e04961a8e85f5
-- PR 15
AddedToMergeQueueEvent 2026-09-25T01:49:48Z actor=github-actions reason= before=
RemovedFromMergeQueueEvent 2026-09-25T01:50:03Z actor=github-merge-queue reason=invalid_merge_commit before=
```

## Deviations from the design

None.

Observations the design relies on: the relay is triggered and the default-branch workflow_run follows only when the enqueuer's events can start workflows (App installation token yes, job GITHUB_TOKEN no, E10); workflow_run.pull_requests is empty for merge_group runs, so the member PR is resolved by parsing head_branch; the workflow_run sender is the enqueuing App bot, so a steward rule that forbids App writes reacting to the App bot would block its own check when the App enqueues.

## Residue

- Ruleset probe-pa06-queue, id 23972114, exact ref refs/heads/probe-pa06-base, active.
- Branch probe-pa06-base: now contains merged entries probe-pa06/entry-2-1.txt (PR 22) and probe-pa06/entry-2-5.txt (PR 26).
- Head branches: attempt 1 probe-pa06-head-1-1..5; attempt 2 probe-pa06-head-2-1..5.
- Master commit 56d4b0febb556b6b6a403cc50289836432782f29 deployed the new steward (blob e63329c…).
- PRs: attempt 1 9, 10, 11, 12, 15 closed unmerged; attempt 2 22 and 26 merged, 23, 24, 25 closed unmerged.
- Check runs probe-pa06/gate by patch-steward-testbed on the five PR heads, fb69fdb, b3b15c2 (failure), 4f43e5b, and orphaned a290161.
- allow_auto_merge=true (set by step 2.6, not reverted: no permitted command form).
