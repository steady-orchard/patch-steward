- status: pass
- base: 29ab649b50c02d1b91b6169ecf1ce14024aed510
- changes: |
    scenarios/results/org-public.md: appended `## S11 per-author concurrent cap: over-cap work waits` section
    (command groups for policy deploy, the two back-to-back issue creations, the await, per-run gate/publish log
    checks, run-records and evidence checks for the queued run, and the policy restore), then ran
    `pnpm exec prettier --write` (no change) and `results-check.sh` (pass).
    development-artifacts/patch-steward-m6-5.22-report.md: this report.
- acceptance: |
    node -e (acceptance command 1: verifies both marker lines are present and the not-restored sentinel is absent)
    report ok

    R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.22-report.md; run=$(grep -m1 -o '^s11_author_run: [0-9]*' $f | cut -d' ' -f2); gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(caps per-author-concurrent-runs daily [0-9]+ of 1000 author [0-9]+ of 1|disposition queued)$'; bash scenarios/tools/run-log.sh $R $run 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=- Status: `queued`$'
    screen / build=success,screen / gate=success,screen / publish=success
    2
    1

    R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.22-report.md; n=$(grep -m1 -o '^s11_author_issue: [0-9]*' $f | cut -d' ' -f2); run=$(grep -m1 -o '^s11_author_run: [0-9]*' $f | cut -d' ' -f2); bash scenarios/tools/run-records.sh runs $R steward-evidence $R issue $n | grep -c -E "^RECORD run=$run-1 kind=waiting state=queued reason=per-author-concurrent-runs daily=[0-9]+/1000 author=[0-9]+/1 arrival_at=\S+ policy_revision=[0-9a-f]{40} snapshot=sha256:[0-9a-f]{64}\$"; bash scenarios/tools/evidence.sh $R steward-evidence $R issue $n | grep -c -E "^EVIDENCE run=$run-1 kind=waiting manifest=verified\$|^EVIDENCE target=$R subject=issue-$n runs=1 verified=1 result=ok\$"; gh api "repos/$R/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
    1
    2
    d997b1e362c75af03942da0e7a1e8902ca5dbe51

    bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: |
    Only one of the two runs was queued (issue 41's run was runnable, not queued); per the step's own success
    criterion ("at least one run is required" queued), one queued run was sufficient and the repeat with a third
    and fourth issue was not needed.

s11_author_issue: 40
s11_author_run: 36423270119
