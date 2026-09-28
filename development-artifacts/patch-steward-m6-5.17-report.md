- status: pass
- base: 989dfdd2ccb1c6d257eb6c55286ea259f111ecea
- changes: |
    Ran scenario S07 on org-public: deployed scenarios/fixtures/policies/unwritable-store.yml (evidence store
    pointed at nonexistent repository steady-orchard/patch-steward-testbed-unwritable) to the test-bed master,
    edited pull request 34's body, awaited the run, confirmed gate committed a new owner but publish failed with
    `github.not-found` and published no evidence, then restored the valid orphan-branch.yml policy on master.
    Appended the `## S07 unwritable evidence store: publish fails and publishes nothing` section to
    scenarios/results/org-public.md with verbatim command output, then ran prettier and results-check.
- acceptance: |
    node -e (check for s07_run and s07_failure lines and absence of the not-restored marker)
    report ok

    R=steady-orchard/patch-steward-testbed-public; run=$(grep -m1 -o '^s07_run: [0-9]*' development-artifacts/patch-steward-m6-5.17-report.md | cut -d' ' -f2); gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(dedup commit [a-z-]+|disposition early-exit|- Owner: committed \`$run-1\`)\$"; bash scenarios/tools/run-log.sh $R $run 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(evidence commit |- Evidence: )'; bash scenarios/tools/run-log.sh $R $run 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(- Status: `failed`|- Failure: `[a-z][a-z0-9.-]+`)$'
    screen / build=success,screen / gate=success,screen / publish=failure
    3
    0
    2

    R=steady-orchard/patch-steward-testbed-public; P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); run=$(grep -m1 -o '^s07_run: [0-9]*' development-artifacts/patch-steward-m6-5.17-report.md | cut -d' ' -f2); bash scenarios/tools/artifacts.sh $R steward-ownership-pr-$P | grep -c "run_id=$run "; bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $P | grep -c "^RECORD run=$run-1 "; gh api "repos/$R/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
    1
    0
    d997b1e362c75af03942da0e7a1e8902ca5dbe51

    bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: none

s07_run: 36418649681
s07_failure: github.not-found
