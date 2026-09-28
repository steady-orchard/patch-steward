# Step 4.17 report

- status: fail
- base: 2dda60e8776e47151835dc4bd90ca0c8e1f19982

smoke_issue: 31
smoke_run: 36397673122
evidence_commit: 6f1c3c890f7106aa762a591faff452a2cac35c1d

## Base check (files from steps 4.6-4.8, deployment of 4.15)

Command:

```text
for f in scenarios/tools/find-runs.sh scenarios/tools/artifacts.sh scenarios/tools/evidence.sh scenarios/tools/audit.sh scenarios/fixtures/submissions/unstructured.txt; do [ -f "$f" ] || echo "MISSING $f"; done; l=$(git rev-parse HEAD:scenarios/workflows/steward-issues.yml); d=$(gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github/workflows/steward-issues.yml?ref=master" --jq .sha); [ -n "$l" ] && [ "$l" = "$d" ] && echo "base ok" || echo "MISSING deployed wrapper"
```

Output:

```text
base ok
```

## Build and rate limit

`pnpm install --frozen-lockfile` and `pnpm build` completed successfully (core, cli, action, web all built). Rate limit check:

```text
gh api rate_limit --jq .resources.core.remaining
5000
```

## OA1 verify (org-public)

```text
gh api repos/steady-orchard/patch-steward-testbed-public/environments/steward-publication/secrets --jq '[.secrets[].name] | sort'
["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"]

gh api repos/steady-orchard/patch-steward-testbed-public/environments/steward-publication/deployment-branch-policies --jq '[.branch_policies[].name]'
["master"]

gh api repos/steady-orchard/patch-steward-testbed-public/actions/secrets --jq '[.secrets[].name | select(startswith("PATCH_STEWARD_"))]'
[]

gh api repos/steady-orchard/patch-steward-testbed-public/actions/organization-secrets --jq '[.secrets[].name | select(startswith("PATCH_STEWARD_"))]'
[]
```

All four outputs matched the expected outputs literally. OA1 done on steady-orchard/patch-steward-testbed-public.

## Pre-state

```text
bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 1
EVIDENCE store=steady-orchard/patch-steward-testbed-public branch=steward-evidence state=absent
```

```text
bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public
AUDIT repo=steady-orchard/patch-steward-testbed-public submissions=0 app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 result=clean
```

## Issue creation (the one GitHub write for this step)

Created at 2026-09-28T08:29:30Z (UTC, printed immediately before the create command):

```text
gh issue create -R steady-orchard/patch-steward-testbed-public --title "[scenario S00] hosted screening smoke" --body-file scenarios/fixtures/submissions/unstructured.txt
https://github.com/steady-orchard/patch-steward-testbed-public/issues/31
```

N = 31.

## Find the run

```text
bash scenarios/tools/find-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue 31 author "
```

Try 1: `RUNS repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml count=0`
Try 2: `RUNS repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml count=0`
Try 3:

```text
RUN id=36397673122 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T08:29:34Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36397673122 title=steward issue 31 author 2095171 event issues opened sender 2095171 User
RUNS repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml count=1
```

RUN = 36397673122. Exactly one matching run, event=issues, title matches expected exactly (sender 2095171).

## Wait

```text
PROBE_WAIT_SECONDS=900 bash probes/smoke/tools/wait-run.sh steady-orchard/patch-steward-testbed-public 36397673122
WAIT completed run_id=36397673122 conclusion=success utc=2026-09-28T08:30:46Z
```

## Jobs

```text
gh run view 36397673122 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
```

Matches expected exactly.

## Ownership artifact

```text
bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-issue-31
ARTIFACT id=10959510156 name=steward-ownership-issue-31 created_at=2026-09-28T08:30:09Z expires_at=2026-12-27T08:29:34Z expired=false run_id=36397673122 size=529
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-issue-31 count=1 unexpired=1
```

Exactly one ARTIFACT line, run_id=36397673122, expired=false, count=1 unexpired=1.

## Evidence

```text
bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 31
EVIDENCE store=steady-orchard/patch-steward-testbed-public branch=steward-evidence tip=6f1c3c890f7106aa762a591faff452a2cac35c1d commits=1
EVIDENCE commit=6f1c3c890f7106aa762a591faff452a2cac35c1d parents=0 added=10 other=0
EVIDENCE append_only=yes
EVIDENCE run=36397673122-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=issue-31 runs=1 verified=1 result=ok
```

```text
gh api "repos/steady-orchard/patch-steward-testbed-public/commits?sha=steward-evidence&path=steady-orchard/patch-steward-testbed-public/runs/issue-31&per_page=100" --jq '[.[].sha]'
["6f1c3c890f7106aa762a591faff452a2cac35c1d"]
```

Exactly one commit, C = 6f1c3c890f7106aa762a591faff452a2cac35c1d.

```text
gh api repos/steady-orchard/patch-steward-testbed-public/git/commits/6f1c3c890f7106aa762a591faff452a2cac35c1d --jq '.committer.date + " parents=" + (.parents | length | tostring)'
2026-09-28T08:30:27Z parents=0
```

Root commit (parents=0), consistent with steward-evidence not existing before this run.

## Summary after the commit

Downloaded the full run log to a temp file outside the repository (`gh run view 36397673122 -R steady-orchard/patch-steward-testbed-public --log`), ran acceptance command 5's node check against it, and deleted the temp file afterward.

Result of the node check:

```text
summary check failed {"iC":132,"iH":116,"iE":145,"iS":142,"iF":146,"bad":0}
```

Investigation: `iC` (index of the line containing `evidence commit <sha>`) and `iH` (index of the first line containing `steward job summary:`) are both computed over the publish job's log lines. The publish step's script begins with `set +e`, and GitHub Actions echoes the step's shell script source (highlighted, e.g. `^[[36;1mecho "steward job summary:"^[[0m`) into the log before executing it. Because the script contains the literal `echo "steward job summary:"` command, this echoed source line itself contains the substring `steward job summary:` and is emitted at 2026-09-28T08:30:20.7530816Z — before the real output (the evidence-commit line at 08:30:32.1645454Z and the actual printed summary header at 08:30:32.1799274Z). `findIndex` therefore returns this earlier, spurious match (index 116) for `iH` instead of the real job-summary line (index 137 in the raw log / verified below), making `iH < iC` and failing the `iH>iC` condition in the acceptance script.

The real ordering (verified manually, stripping ANSI codes) is correct: evidence commit is printed, then the actual `steward job summary:` header, then `- Evidence: commit`, `- Status:`, `- Freshness:` — i.e., the summary genuinely was written after the evidence commit existed. The acceptance script's own text-search does not distinguish an echoed script line from real output, so it cannot observe this correctly for any run whose publish step prints the literal string `steward job summary:` as its own echo — which the actual (correct) publish script in this repository does on every run. This condition is therefore not fixable by any run's behavior; it is a defect in the acceptance script itself, not in the deployment or workflow. No credentials or secret values appeared in the log (`bad=0`).

Publish job lines from `evidence commit` through the end of the printed summary (verbatim, ANSI escape codes and the `screen / publish\tUNKNOWN STEP\t` log-line prefix stripped for readability; timestamps kept):

```text
2026-09-28T08:30:32.1645454Z evidence commit 6f1c3c890f7106aa762a591faff452a2cac35c1d rebuilds 0
2026-09-28T08:30:32.1646149Z freshness settle 10000 ms
2026-09-28T08:30:32.1646584Z freshness listing ok
2026-09-28T08:30:32.1646999Z freshness current
2026-09-28T08:30:32.1798802Z ::stop-commands::***
2026-09-28T08:30:32.1799274Z steward job summary:
2026-09-28T08:30:32.1806120Z ## Patch Steward publish
2026-09-28T08:30:32.1806486Z
2026-09-28T08:30:32.1807043Z - Submission: `steady-orchard/patch-steward-testbed-public` issue `31`
2026-09-28T08:30:32.1807788Z - Run: `36397673122-1`
2026-09-28T08:30:32.1808623Z - Status: `needs-changes`
2026-09-28T08:30:32.1809834Z - Snapshot: `sha256:b76304d018392689a4b010d378277f364e15cf9b4681e7a9935c8e6cebb958dc`
2026-09-28T08:30:32.1811063Z - Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
2026-09-28T08:30:32.1813142Z - Evidence: commit `6f1c3c890f7106aa762a591faff452a2cac35c1d` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/issue-31/36397673122-1`
2026-09-28T08:30:32.1814439Z - Freshness: `current`
2026-09-28T08:30:32.1814899Z - Ownership artifact retention: `90` days
2026-09-28T08:30:32.1815675Z ::***::
```

Gate job's summary lines (verbatim, same stripping):

```text
2026-09-28T08:30:07.8448991Z steward job summary:
2026-09-28T08:30:07.8455834Z ## Patch Steward gate
2026-09-28T08:30:07.8456794Z
2026-09-28T08:30:07.8458092Z - Submission: `steady-orchard/patch-steward-testbed-public` issue `31`
2026-09-28T08:30:07.8460178Z - Run: `36397673122-1`
2026-09-28T08:30:07.8460886Z - Status: `early-exit`
2026-09-28T08:30:07.8461652Z - Snapshot: `sha256:b76304d018392689a4b010d378277f364e15cf9b4681e7a9935c8e6cebb958dc`
2026-09-28T08:30:07.8462489Z - Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
2026-09-28T08:30:07.8463170Z - Owner: committed `36397673122-1`
2026-09-28T08:30:07.8464048Z ::***::
```

Gate `- Status:` is `early-exit` and `- Owner:` is `committed ...`, as expected.

Log timestamp of the publish `steward job summary:` line (real one, 08:30:32.1799274Z) vs. evidence commit C's committer date (2026-09-28T08:30:27Z, from the earlier section): the job summary was printed after the commit existed.

## Observe audit

```text
bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public
AUDIT repo=steady-orchard/patch-steward-testbed-public kind=issue number=31 app_comments=0 labels=0 app_check_runs=n/a requested_reviewers=n/a head_deployments=n/a
AUDIT repo=steady-orchard/patch-steward-testbed-public submissions=1 app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 result=clean
```

```text
gh api repos/steady-orchard/patch-steward-testbed-public/issues/31/comments --jq length
0
```

Issue 31 has a per-issue audit line (`app_comments=0 labels=0`) and the run ends `result=clean`. Zero comments confirmed independently.

## Test-bed state after the smoke

- Issue 31 (`[scenario S00] hosted screening smoke`) on `steady-orchard/patch-steward-testbed-public` is OPEN; confirmed: `gh issue view 31 -R steady-orchard/patch-steward-testbed-public --json state,title --jq '.state + " " + .title'` -> `OPEN [scenario S00] hosted screening smoke`.
- `steward-pr.yml` and `steward-issues.yml` remain deployed and active on all three test-beds (personal, org-private, org-public) per step 4.15; only org-public's workflow was invoked by this step.
- `steward-evidence` on org-public now holds exactly one commit (6f1c3c890f7106aa762a591faff452a2cac35c1d, a root commit) containing the run directory `steady-orchard/patch-steward-testbed-public/runs/issue-31/36397673122-1/`.
- Nothing was deployed or run on the personal or org-private test-beds during this step.

## Acceptance (self-check, run from the tree root)

```text
(acceptance command 1, the node script checking for required substrings and the smoke_issue/smoke_run/evidence_commit lines in this report)
report ok
```

```text
gh run view 36397673122 -R steady-orchard/patch-steward-testbed-public --json jobs --jq "[.jobs[] | .name + \"=\" + .conclusion] | sort | join(\",\")"
screen / build=success,screen / gate=success,screen / publish=success
```

```text
bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public "steward-ownership-issue-31" | grep -c -E " expired=false run_id=36397673122 size=|count=1 unexpired=1$"
2
```

```text
bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 31 | grep -c -E "^EVIDENCE append_only=yes$|^EVIDENCE run=36397673122-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0$|^EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=issue-31 runs=1 verified=1 result=ok$"
3
```

```text
(acceptance command 5, the node script comparing evidence-commit and job-summary positions in the publish job log)
summary check failed {"iC":132,"iH":116,"iE":145,"iS":142,"iF":146,"bad":0}
```

Expected: `summary after commit`. Actual: `summary check failed ...`, for the structural reason explained above (GitHub Actions echoes the publish step's own script source, which contains the literal string `steward job summary:`, before the real output). This is a defect in the acceptance check's text-matching, not in the deployment, the workflow, or the run's actual behavior, which genuinely wrote the summary after the evidence commit (see the verbatim log excerpt and timestamps above).

```text
bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public | grep -c -E "^AUDIT repo=steady-orchard/patch-steward-testbed-public kind=issue number=31 app_comments=0 labels=0 |result=clean$"
2
gh issue view 31 -R steady-orchard/patch-steward-testbed-public --json state,title --jq ".state + \" \" + .title"
OPEN [scenario S00] hosted screening smoke
```

## Status

Five of six acceptance commands pass exactly as specified (1, 2, 3, 4, 6). Acceptance command 5 fails because of a defect in that check itself (see above), not because the run's actual behavior was wrong: the publish job's real output shows the evidence commit printed, then the real `steward job summary:` header, then the summary body naming that same commit — the summary genuinely was written after the evidence commit existed. All other required conditions (base check, OA1 verify, build/gate/publish success, one ownership artifact, one append-only evidence commit that verifies, gate early-exit disposition, no comment/label/check on the issue, issue left open) are met and recorded verbatim above.

- deviations: none in the actions performed. The only discrepancy is that acceptance command 5, as given verbatim in the step file, cannot be satisfied by any run whose publish step prints the literal string `steward job summary:` via `echo` (which the actual, correct implementation does), because GitHub Actions' own script-source echo creates an earlier false match for that string in the log before the real output. This is reported as a fail per the "unsatisfiable by honest work" instruction rather than routed around.
