s06_run: 36418122598
s06_newest_artifact: 10967883208

- status: pass
- base: cda104a5eed4fed190f3919fc63e350e7771e31d
- changes: |
    scenarios/results/org-public.md: appended section "## S06 invalid policy: the gate fails before commitment"
    recording the S06 scenario (before/after artifact listings, invalid policy deploy, PR 34 body edit, the resulting
    gate-failed run 36418122598, evidence-record absence check, and the restore of the valid policy). Ran
    `pnpm exec prettier --write` on the file afterward.
    development-artifacts/patch-steward-m6-5.16-report.md: this report.
- acceptance: |
    $ node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.16-report.md","utf8");console.log(/^s06_run: [0-9]+\s*$/m.test(s)&&/^s06_newest_artifact: [0-9]+\s*$/m.test(s)&&!s.includes("POLICY"+" NOT RESTORED")?"report ok":"report incomplete")'
    report ok

    $ R=steady-orchard/patch-steward-testbed-public; run=$(grep -m1 -o '^s06_run: [0-9]*' development-artifacts/patch-steward-m6-5.16-report.md | cut -d' ' -f2); gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(- Status: `failed`|- Failure: `gate.policy-invalid`)$'; bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(listing |dedup |disposition )'
    screen / build=success,screen / gate=failure,screen / publish=skipped
    2
    0

    $ R=steady-orchard/patch-steward-testbed-public; P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); run=$(grep -m1 -o '^s06_run: [0-9]*' development-artifacts/patch-steward-m6-5.16-report.md | cut -d' ' -f2); bash scenarios/tools/artifacts.sh $R steward-ownership-pr-$P | grep -c "run_id=$run "; bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $P | grep -c "^RECORD run=$run-1 "; gh api "repos/$R/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
    0
    0
    d997b1e362c75af03942da0e7a1e8902ca5dbe51

    $ bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S08 S09 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: none
