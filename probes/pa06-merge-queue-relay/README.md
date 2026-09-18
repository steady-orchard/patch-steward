# PA06 — Merge-queue relay

Checks that a credential-free `merge_group` relay plus a default-branch `workflow_run` steward can gate a merge queue with an App check keyed by group commit.

## Sub-claims

- PA06.1 (assumption): a `merge_group` (`checks_requested`) workflow with no secrets, no Environment, no checkout, and empty `permissions` runs to completion on the queue ref.
- PA06.2 (assumption): its completion starts a `workflow_run` run from the default-branch definition, and that run can resolve the group commit and the member PRs within bounded queries.
- PA06.3 (assumption): a required check bound to the test App gates the queue: an App `success` check on the group commit merges the group; `failure` removes the entry; with no check the entry leaves at the check-response timeout and nothing merges.
- PA06.4 (assumption): removing an entry produces a new group commit and a new `merge_group` event; a check written to the orphaned group commit has no effect.
- PA06.5 (measurement): merge_group to relay completion, relay completion to workflow_run start, check completion to merge; configured and minimum check-response timeout.

## Fixtures

- Ruleset `probe-pa06-queue` (`fixtures/ruleset-queue.json`) on exactly `refs/heads/probe-pa06-base` (a wildcard ref with a `merge_queue` rule is rejected with HTTP 422): required check `probe-pa06/gate` from integration 4993303, merge queue with 5-minute check-response timeout, ALLGREEN, build 5, merge 1 to 5, wait 0, MERGE.
- Branches: `probe-pa06-base` (relay workflow plus `probe-pa06/base.txt`); heads `probe-pa06-head-<k>-<n>` branched from `probe-pa06-base`, each adding one file `probe-pa06/entry-<k>-<n>.txt` (`fixtures/entry.txt`).
- PR title scheme `[probe PA06] entry <k>-<n> mode=<mode>`, mode one of `success`, `failure`, `none`; the steward and the driver read the mode from the title as data.
- Check name `probe-pa06/gate`, written by the test App `patch-steward-testbed`.
- Enqueuer: the App installation token (`token=app` on `probe-pa06-control.yml`). The job GITHUB_TOKEN enqueues but its events start no workflow runs, so no `merge_group` run arrives (step 2.6).

## Deployment list

- probe-pa06-relay.yml: org-public
- probe-pa06-steward.yml: org-public
- probe-pa06-control.yml: org-public

## Fixture deployments

- `probe-pa06-relay.yml` also lives on `probe-pa06-base` (merge_group runs use the definition inside the group commit), byte-identical to master.
- `fixtures/base.txt` → `probe-pa06/base.txt` on `probe-pa06-base`; `fixtures/entry.txt` → `probe-pa06/entry-<k>-<n>.txt` on each head.
- `fixtures/ruleset-queue.json` is created through the rulesets API (create-or-reuse by name).
- org-private has no merge queue (Phase 1: refused) and is recorded without an attempt elsewhere.

## Procedure

`<tb>` = steady-orchard/patch-steward-testbed-public, `<W>` = worktree root, `<k>` = attempt number, `<n>` = entry number, `<id>` = ruleset or run id. Run tools from the main repository root.

1. Settings read (never write): `gh api repos/<tb> --jq '{allow_auto_merge, allow_merge_commit}'`.
2. `bash probes/smoke/tools/deploy.sh <tb> master "probe(PA06): deploy PA06 workflows" <W>/probes/pa06-merge-queue-relay/workflows/probe-pa06-relay.yml <W>/probes/pa06-merge-queue-relay/workflows/probe-pa06-steward.yml <W>/probes/pa06-merge-queue-relay/workflows/probe-pa06-control.yml`
3. `bash probes/smoke/tools/deploy.sh <tb> probe-pa06-base "probe(PA06): queue base branch" <W>/probes/pa06-merge-queue-relay/workflows/probe-pa06-relay.yml <W>/probes/pa06-merge-queue-relay/fixtures/base.txt:probe-pa06/base.txt`
4. Ruleset: `gh api repos/<tb>/rulesets --jq '.[] | select(.name == "probe-pa06-queue") | .id'`; if empty `gh api repos/<tb>/rulesets -X POST --input <W>/probes/pa06-merge-queue-relay/fixtures/ruleset-queue.json --jq '{id, name, enforcement}'`; read back `gh api repos/<tb>/rulesets/<id> --jq '{id, name, enforcement, include: .conditions.ref_name.include, rules: [.rules[] | {type, parameters}]}'`.
5. Heads: B = `gh api repos/<tb>/branches/probe-pa06-base --jq .commit.sha`; per n `gh api repos/<tb>/git/refs -X POST -f ref=refs/heads/probe-pa06-head-<k>-<n> -f sha=<B> --jq .ref`, then `bash probes/smoke/tools/deploy.sh <tb> probe-pa06-head-<k>-<n> "probe(PA06): entry <k>-<n>" <W>/probes/pa06-merge-queue-relay/fixtures/entry.txt:probe-pa06/entry-<k>-<n>.txt`; verify `gh api repos/<tb>/compare/probe-pa06-base...probe-pa06-head-<k>-<n> --jq '"\(.ahead_by) \(.behind_by) \([.files[].filename] | join(","))"'` → `1 0 probe-pa06/entry-<k>-<n>.txt`.
6. PRs: `gh api repos/<tb>/pulls -X POST -f title='[probe PA06] entry <k>-<n> mode=<mode>' -f head=probe-pa06-head-<k>-<n> -f base=probe-pa06-base -f body='Probe PA06 fixture PR.' --jq '"\(.number) \(.head.sha)"'` (p1 success, p2 failure, p3 none, p4 none, p5 success).
7. Required check on the PR heads: `bash probes/smoke/tools/dispatch.sh <tb> probe-pa06-control.yml master action=check "shas=<h1> ... <h5>" conclusion=success`; PR states must become `clean`.
8. S1: `bash probes/smoke/tools/dispatch.sh <tb> probe-pa06-control.yml master action=enqueue pr=<p1> token=app`; read loop (20 s, at most 30 min) with the DRIVER RULE until p1 merged or left.
9. S2: enqueue p2 the same way; loop with the DRIVER RULE until p2 is no longer an entry.
10. S3: enqueue p3; loop until it leaves the queue (timeout, no check).
11. S4: enqueue p4 then p5; when relay runs exist for `pr-<p4>-` (C1) and `pr-<p5>-` (C2), `bash probes/smoke/tools/dispatch.sh <tb> probe-pa06-control.yml master action=dequeue pr=<p4> token=app`; loop with the DRIVER RULE for the rebuilt group C3 until p5 merged; then `bash probes/smoke/tools/dispatch.sh <tb> probe-pa06-control.yml master action=check shas=<C1> conclusion=success`; after 2 min read p4 and the queue. Retry once with p6/p7 if the queue removed p5 before its first group formed.
12. Evidence reads: relay runs `gh run list -R <tb> --workflow probe-pa06-relay.yml ...`, steward runs `gh run list -R <tb> --workflow probe-pa06-steward.yml ...`, steward jobs `gh api repos/<tb>/actions/runs/<id>/jobs --jq '.jobs[] | "\(.name) \(.status) \(.conclusion)"'`, facts `gh run view <id> -R <tb> --log` filtered to `PROBE-PA06 `, the GraphQL `timelineItems` query for ADDED_TO_MERGE_QUEUE_EVENT and REMOVED_FROM_MERGE_QUEUE_EVENT per PR, and `gh api "repos/<tb>/actions/runs?event=merge_group&created=<window>" --jq .total_count`.
13. Close every still-open probe PA06 PR: `gh api repos/<tb>/pulls/<n> -X PATCH -f state=closed --jq .state`.

DRIVER RULE: for each relay run of a probe PR, once the steward run titled `probe-pa06-steward <relay headSha>` has completed, read its jobs. `write success` → nothing to do. `write skipped` → within 2 min write the check it would have written through `probe-pa06-control.yml` (`action=check shas=<relay headSha> conclusion=<success|failure>`; mode none → no check). `write failure` or a failed `record` → workflow defect. No steward run within 3 min of a relay completion → PA06.2 evidence. In S4 write no driver check on C1 or C2 before the dequeue.

DECISION RULES:

- PA06.1 confirmed iff this attempt's relay runs concluded success on `refs/heads/gh-readonly-queue/probe-pa06-base/...`; refuted iff the relay as written could not complete there; undetermined (blocked) iff no merge_group run arrived for App-token enqueues.
- PA06.2 confirmed iff after each relay completion a steward run logged `ref=refs/heads/master`, the group commit, and a parsed PR number; refuted iff no default-branch workflow_run followed within 10 min, or the group commit or member PR could not be resolved. A skipped `write` is the probe's safety rule and does not decide the row.
- PA06.3 confirmed iff p1 merged after an App success check on its group commit, p2 left unmerged after the App failure check, and p3 left unmerged at the timeout with no check; refuted iff any group merged without an App success check, or p2 or p3 merged; undetermined iff PA06.1 is blocked.
- PA06.4 confirmed iff the dequeue of p4 produced a new relay run for pr-p5 with C3 != C2, p5 merged, and the success check on orphaned C1 merged nothing; refuted iff the orphaned check merged or re-queued p4, or no rebuild happened; undetermined iff S4 and its retry both lost the second entry before a second group formed.
- PA06.5 confirmed when timings were measured.
