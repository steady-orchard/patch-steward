- status: pass
- base: c7b65e5d2900cadf1c7aa48e458faf5ab8d434e3
- changes: |
    scenarios/results/org-public.md: appended `## S12 explicit rerun commits a new owner` section (commands 3-6 with
    outputs, evidence.sh trimmed to run and final lines per actions), formatted with prettier (no changes needed).
- acceptance: |
    $ R=steady-orchard/patch-steward-testbed-public; gh run view 36397673122 -R $R --json attempt --jq .attempt; gh run view 36397673122 -R $R --attempt 2 --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R 36397673122 2 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(dedup commit rerun|disposition early-exit|- Owner: committed `36397673122-2`)$'; bash scenarios/tools/run-log.sh $R 36397673122 2 publish | grep -c -x -E 'LOG job=publish ts=[^ ]+ text=freshness current'
    2
    screen / build=success,screen / gate=success,screen / publish=success
    3
    1

    $ R=steady-orchard/patch-steward-testbed-public; bash scenarios/tools/artifacts.sh $R steward-ownership-issue-31 | grep '^ARTIFACT ' | tail -n 1 | node -e '...'
    newest owner is attempt 2

    $ R=steady-orchard/patch-steward-testbed-public; bash scenarios/tools/run-records.sh runs $R steward-evidence $R issue 31 | grep -c -E '^RECORD run=36397673122-2 kind=outcome outcome=needs-changes run_id=36397673122 run_attempt=2 '; bash scenarios/tools/evidence.sh $R steward-evidence $R issue 31 | grep -c -x -E "EVIDENCE target=$R subject=issue-31 runs=2 verified=2 result=ok"
    1
    1

    $ bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: |
    evidence.sh output in the results section trimmed to the run and final lines only (omitted the 30 per-commit
    EVIDENCE lines), as permitted by actions step 6 ("run and final lines").
s12_newest_artifact_created_at: 2026-09-28T12:49:34Z
