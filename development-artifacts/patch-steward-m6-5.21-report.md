- status: pass
- base: ba84a01c62c46b2f165756be4bc9f074379984b2
- changes: |
    scenarios/results/org-public.md: appended `## S11 daily run cap: over-cap work waits` section (results-check verified,
    prettier unchanged).
- acceptance: |
    node checked the report for the required s11_daily_issue and s11_daily_run lines and the absence of the policy-not-restored failure marker.
    report ok

    R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.21-report.md; n=$(grep -m1 -o '^s11_daily_issue: [0-9]*' $f | cut -d' ' -f2); run=$(grep -m1 -o '^s11_daily_run: [0-9]*' $f | cut -d' ' -f2); gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(caps daily-runs daily [0-9]+ of 1 author [0-9]+ of 20|disposition queued)$'; bash scenarios/tools/run-log.sh $R $run 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(- Status: `queued`|freshness current)$'
    screen / build=success,screen / gate=success,screen / publish=success
    2
    2

    R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.21-report.md; n=$(grep -m1 -o '^s11_daily_issue: [0-9]*' $f | cut -d' ' -f2); run=$(grep -m1 -o '^s11_daily_run: [0-9]*' $f | cut -d' ' -f2); bash scenarios/tools/run-records.sh runs $R steward-evidence $R issue $n | grep -c -E "^RECORD run=$run-1 kind=waiting state=queued reason=daily-runs daily=[0-9]+/1 author=[0-9]+/20 arrival_at=\S+ policy_revision=[0-9a-f]{40} snapshot=sha256:[0-9a-f]{64}\$"; bash scenarios/tools/evidence.sh $R steward-evidence $R issue $n | grep -c -E "^EVIDENCE run=$run-1 kind=waiting manifest=verified\$|^EVIDENCE target=$R subject=issue-$n runs=1 verified=1 result=ok\$"; gh api "repos/$R/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
    1
    2
    d997b1e362c75af03942da0e7a1e8902ca5dbe51

    bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: none
s11_daily_issue: 38
s11_daily_run: 36422412647
