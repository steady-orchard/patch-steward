# PA03 — Trusted triggers

This probe checks whether `pull_request_target`, `issues`, `issue_comment`, `workflow_run`, `schedule`, and
`workflow_dispatch` run the default-branch workflow definition and ref, whether a default-branch-only Environment
admits jobs started by each trusted trigger and delivers its secret, and whether a ref guard placed before any
credential use stops a `workflow_dispatch` run on a non-default ref.

## Sub-claims

- PA03.1 (assumption) `pull_request_target` runs the default-branch definition with `GITHUB_REF` = default branch
  when the PR head modifies or deletes that workflow file (same-repository branch AND fork), and when the PR base is
  a non-default branch whose copy of the workflow differs.
- PA03.2 (assumption) `issues` and `issue_comment` runs use the default-branch definition and ref.
- PA03.3 (assumption) `workflow_run` runs use the default-branch definition and ref even when the triggering run
  executed on a non-default ref.
- PA03.4 (assumption) `schedule` runs use the default-branch definition and ref.
- PA03.5 (assumption) An Environment whose deployment-branch rule allows only the default branch admits jobs started
  by each of the five triggers above and delivers its secret, including `pull_request_target` from a fork and with a
  non-default base.
- PA03.6 (assumption) `workflow_dispatch` on a non-default ref runs that ref's definition; the default-branch-only
  Environment refuses its job; a ref guard placed before any credential use stops the run; a non-default ref's own
  definition can omit the guard, so the Environment rule is the enforcing control.

"Deletes" (legs P2, P4) is exercised as a PR head whose tree LACKS the workflow file: the permitted tooling can add
and change files but not delete them.

## Fixtures

- Environment `probe-pa03-default-branch` (deployment-branch policy: only `master`) with secret
  `PROBE_PA03_ENV_MARKER` = DUMMY `probe-pa03-env-marker-v1`.
- Branch `probe-pa03-base`: variant of `probe-pa03-events.yml` and `probe-pa03-schedule.yml` with
  `PROBE_DEFINITION: probe-pa03-base` (guard present).
- Branch `probe-pa03-base-noguard`: variant of `probe-pa03-events.yml` with `PROBE_DEFINITION:
probe-pa03-base-noguard` and the `environment` job missing `needs: guard`.
- Branch `probe-pa03-head-modify`: same-repo PR head that modifies the workflow (`PROBE_DEFINITION: pr-head`).
- Branch `probe-pa03-head-absent`: same-repo PR head created from the initial commit (no workflow file), plus a
  marker file only.
- Branch `probe-pa03-head-nd`: PR head for the non-default base leg (marker file only).
- Fork branches `probe-pa03-head-fork-modify` and `probe-pa03-head-fork-absent` (jambolo/patch-steward-testbed-public):
  same shapes as the same-repo heads above.
- PR titles `[probe PA03] P1 same-repo head modifies the workflow` .. `[probe PA03] P5 non-default base with a
different workflow copy`; issue title `[probe PA03] issues trigger <k>`.
- The schedule fixture: `probe-pa03-schedule.yml` (cron 7,22,37,52) and `probe-pa03-schedule-env.yml` (cron
  12,27,42,57), both already deployed on `master` before this step and captured/disabled by it.

## Deployment list

- probe-pa03-schedule.yml: org-public, org-private, personal
- probe-pa03-schedule-env.yml: org-public, org-private, personal
- probe-pa03-events.yml: org-public, org-private, personal
- probe-pa03-upstream.yml: org-public, org-private, personal

## Fixture deployments

| Fixture file                                             | Test-bed branch / path                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `fixtures/probe-pa03-base/probe-pa03-events.yml`         | org-public `probe-pa03-base` → `.github/workflows/probe-pa03-events.yml`                                                         |
| `fixtures/probe-pa03-base-noguard/probe-pa03-events.yml` | org-public `probe-pa03-base-noguard` → `.github/workflows/probe-pa03-events.yml`                                                 |
| `fixtures/probe-pa03-head/probe-pa03-events.yml`         | org-public `probe-pa03-head-modify` and fork `probe-pa03-head-fork-modify` → `.github/workflows/probe-pa03-events.yml`           |
| `fixtures/head-marker.txt`                               | org-public `probe-pa03-head-absent`, `probe-pa03-head-nd`, and fork `probe-pa03-head-fork-absent` → `probe-pa03/head-marker.txt` |

## Procedure

Placeholders: `<tb>` = a test-bed key (org-public, org-private, personal); `<W>` = the local worktree root; `<k>` =
an issue-trigger attempt number; `<N>` = a PR or issue number; `<id>` = a workflow-run id.

org-public repeats every leg below including the fork legs (P3, P4). org-private repeats P1, P2, P5, I, U, D0–D2, S
without the fork legs (no fork exists for org-private). personal repeats the same set for PA03.5 and PA03.6 only
(the Environment and dispatch-guard legs), since PA03.1–PA03.4 need only one confirming test-bed.

1. Lint the canonical files already in `probes/pa03-trusted-triggers/` ([ADR-0023](../../docs/adr/0023-probe-suite-location.md)):
   `actionlint -ignore 'unknown permission scope "copilot-requests"' <file>` for `probe-pa03-events.yml`,
   `probe-pa03-upstream.yml`, and the three fixture variants.
2. Deploy the base definitions (each a standalone `deploy.sh` call, exit 0 required):
   `bash probes/smoke/tools/deploy.sh <tb-repo> master "probe(PA03): deploy probe-pa03-events.yml probe-pa03-upstream.yml" <W>/probes/pa03-trusted-triggers/workflows/probe-pa03-events.yml <W>/probes/pa03-trusted-triggers/workflows/probe-pa03-upstream.yml`;
   `bash probes/smoke/tools/deploy.sh <tb-repo> probe-pa03-base "probe(PA03): deploy events variant and upstream" <W>/probes/pa03-trusted-triggers/fixtures/probe-pa03-base/probe-pa03-events.yml:.github/workflows/probe-pa03-events.yml <W>/probes/pa03-trusted-triggers/workflows/probe-pa03-upstream.yml:.github/workflows/probe-pa03-upstream.yml`;
   `bash probes/smoke/tools/deploy.sh <tb-repo> probe-pa03-base-noguard "probe(PA03): deploy no-guard variant" <W>/probes/pa03-trusted-triggers/fixtures/probe-pa03-base-noguard/probe-pa03-events.yml:.github/workflows/probe-pa03-events.yml`.
3. Deploy the same-repo PR heads (org-public and org-private only):
   `bash probes/smoke/tools/deploy.sh <tb-repo> probe-pa03-head-modify "probe(PA03): head modifies the workflow" <W>/probes/pa03-trusted-triggers/fixtures/probe-pa03-head/probe-pa03-events.yml:.github/workflows/probe-pa03-events.yml`;
   check `gh api repos/<tb-repo>/branches/probe-pa03-head-absent --jq .name` for HTTP 404, then create it from the
   test-bed's initial (workflow-less) commit: `gh api repos/<tb-repo>/git/refs -X POST -f ref=refs/heads/probe-pa03-head-absent -f sha=<initial-commit-sha> --jq .ref`;
   `bash probes/smoke/tools/deploy.sh <tb-repo> probe-pa03-head-absent "probe(PA03): head without the workflow file" <W>/probes/pa03-trusted-triggers/fixtures/head-marker.txt:probe-pa03/head-marker.txt`;
   `bash probes/smoke/tools/deploy.sh <tb-repo> probe-pa03-head-nd "probe(PA03): head for the non-default base" <W>/probes/pa03-trusted-triggers/fixtures/head-marker.txt:probe-pa03/head-marker.txt`.
   Evidence read: `gh api "repos/<tb-repo>/contents/.github/workflows/probe-pa03-events.yml?ref=probe-pa03-head-absent"` → HTTP 404.
4. Deploy the fork PR heads (org-public only; FORK-OK check first):
   `gh api repos/jambolo/patch-steward-testbed-public --jq '"\(.full_name) \(.fork) \(.parent.full_name)"'` must print
   `jambolo/patch-steward-testbed-public true steady-orchard/patch-steward-testbed-public`;
   `bash probes/smoke/tools/deploy.sh jambolo/patch-steward-testbed-public probe-pa03-head-fork-modify "probe(PA03): fork head modifies the workflow" <W>/probes/pa03-trusted-triggers/fixtures/probe-pa03-head/probe-pa03-events.yml:.github/workflows/probe-pa03-events.yml`;
   `bash probes/smoke/tools/deploy.sh jambolo/patch-steward-testbed-public probe-pa03-head-fork-absent "probe(PA03): fork head without the workflow file" <W>/probes/pa03-trusted-triggers/fixtures/head-marker.txt:probe-pa03/head-marker.txt`.
5. Open PRs P1–P5 with a fresh event each. Check for an existing PR:
   `gh api "repos/<tb-repo>/pulls?state=all&head=<owner>:<head branch>" --jq '.[] | "\(.number) \(.state)"'` (owner =
   the test-bed owner, or `jambolo` for fork legs). None → create:
   `gh api repos/<tb-repo>/pulls -X POST -f title='<title>' -f head=<head> -f base=<base> -f body='Probe PA03 fixture PR; never merged.' --jq .number`
   (fork head is `jambolo:<branch>`). An open one → close then reopen (`gh api repos/<tb-repo>/pulls/<N> -X PATCH -f state=closed --jq .state`, then `-f state=open`); a closed one → reopen it.
6. Issue and comment trigger:
   `gh api repos/<tb-repo>/issues -X POST -f title='[probe PA03] issues trigger <k>' -f body='Probe PA03 fixture issue.' --jq .number`;
   `gh api repos/<tb-repo>/issues/<N>/comments -X POST -f body='/probe-pa03 comment trigger' --jq .id`
   (a body argument starting with `/` needs `MSYS_NO_PATHCONV=1` prefixed to this same standalone command under
   Git Bash, or its POSIX-path autoconversion corrupts the trigger marker).
7. Dispatches: `bash probes/smoke/tools/dispatch.sh <tb-repo> probe-pa03-upstream.yml probe-pa03-base` (U); then
   `bash probes/smoke/tools/dispatch.sh <tb-repo> probe-pa03-events.yml master` (D0), the same with ref
   `probe-pa03-base` (D1) and `probe-pa03-base-noguard` (D2). A non-success conclusion of D1/D2 is expected.
8. Collect: `gh run list -R <tb-repo> --workflow probe-pa03-events.yml --limit 50 --json databaseId,event,headBranch,status,conclusion,displayTitle,createdAt --jq '.[] | "\(.databaseId) \(.event) \(.status) \(.conclusion) \(.displayTitle)"'`
   (repeat, ≤15 min, until every leg's run is completed). Per leg: facts via
   `gh run view <id> -R <tb-repo> --log | grep -a "PROBE-PA03 " | sed -E 's/^.*(PROBE-PA03 )/\1/'`; job states via
   `gh api repos/<tb-repo>/actions/runs/<id>/jobs --jq '.jobs[] | "\(.name) \(.status) \(.conclusion)"'`; for D2 the
   annotations via `gh run view <id> -R <tb-repo>`. Also per PR:
   `gh api repos/<tb-repo>/pulls/<N> --jq '"\(.number) \(.mergeable_state)"'`.
9. Finish the schedule fixture: poll (every 120 s) until each file has a completed scheduled run or 60 minutes have
   elapsed, then disable it in any case: `gh api repos/<tb-repo>/actions/workflows/<file>/disable -X PUT`. Settle
   (≤5 min) until no scheduled run of either file is queued or in_progress, then collect the first completed
   scheduled run's facts (leg S) and confirm both files are `disabled_manually`:
   `gh workflow list -R <tb-repo> --all --json path,state --jq '.[] | select(.path | test("probe-pa03-schedule")) | "\(.path) \(.state)"'`.
10. Close P1–P5 and the issue:
    `gh api repos/<tb-repo>/pulls/<N> -X PATCH -f state=closed --jq .state`;
    `gh api repos/<tb-repo>/issues/<N> -X PATCH -f state=closed --jq .state`.

### Decision rules

`record` = the `record` job's lines of that leg's run; a leg with no run of `probe-pa03-events` within 15 min of its
trigger = MISSING.

- PA03.1 legs P1–P5: confirmed iff every leg shows `definition=default-branch` AND `ref=refs/heads/master`; refuted
  iff any leg shows another definition or ref (quote it); else (a leg MISSING) undetermined / ambiguous naming the
  leg (settled by a run for that PR, e.g. a conflict-free head).
- PA03.2 leg I (issues, issue_comment): same test.
- PA03.3 leg U: the `workflow_run` run shows `workflow_run_head_branch=probe-pa03-base` AND
  `definition=default-branch` AND `ref=refs/heads/master` → confirmed; other definition/ref → refuted; MISSING →
  undetermined / ambiguous.
- PA03.4 leg S (`probe-pa03-schedule.yml`): `definition=default-branch` AND `ref=refs/heads/master` → confirmed;
  else refuted; no scheduled run within the bounded wait → undetermined / blocked (evidence: the polls).
- PA03.5 legs P1–P5, I (both events), U, and S (`probe-pa03-schedule-env.yml`): confirmed iff in every leg the
  `environment` job concluded success with `secret_digest=match`; refuted iff any leg's `environment` job was
  refused by the Environment rule (annotation) or printed `mismatch`; else undetermined (blocked if only S is
  missing, ambiguous if an event leg is missing).
- PA03.6 confirmed iff D1 shows `definition=probe-pa03-base`, guard `verdict=reject`, environment job skipped AND D2
  shows `definition=probe-pa03-base-noguard` with the environment job NOT delivering the secret (refused by the
  Environment rule — quote the annotation); refuted iff D1 shows `definition=default-branch`, or D2's environment
  job printed `secret_digest=match`; else undetermined / ambiguous. D0 is a control (expected: definition
  default-branch, guard pass, digest match) — record it.
