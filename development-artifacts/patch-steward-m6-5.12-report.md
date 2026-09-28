- status: pass
- base: 6599dd9edbf1fcb1312c0a50ae24e56a13b036ac
- changes: |
    scenarios/results/org-public.md: appended one section, "## S03 title edit by the test App keeps the owner",
    recording pull request steady-orchard/patch-steward-testbed-public#34 having its title edited by the test App's
    bot user (331019482, type Bot) via the helper workflow scenarios/workflows/scenario-app-edit.yml (helper run
    36413596940), and the resulting wrapper run 36413617643 (build/gate success, publish skipped; gate keeps owner
    36412442107-1 as a duplicate owner-unchanged, nothing committed). Verbatim command/output for the artifacts
    check (before and after, unchanged), the newest-run-id capture, the app-edit dispatch, the await sequence, the
    jobs check, the gate log check, and the run-records check (still runs=1).
    Nothing else in the repository was changed. GitHub state created on steady-orchard/patch-steward-testbed-public:
    the helper workflow scenario-app-edit.yml (already deployed idempotently), the title of pull request #34 (now
    edited by the test App). No new ownership artifact, evidence commit, or run record was created.
- acceptance: |
    $ node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.12-report.md","utf8");console.log(/^s03_helper_run: [0-9]+\s*$/m.test(s)&&/^s03_run: [0-9]+\s*$/m.test(s)?"report ok":"report incomplete")'
    report ok

    $ R=steady-orchard/patch-steward-testbed-public; p=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); run=$(grep -m1 -o '^s01_run: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); r3=$(grep -m1 -o '^s03_run: [0-9]*' development-artifacts/patch-steward-m6-5.12-report.md | cut -d' ' -f2); gh run view $r3 -R $R --json jobs,displayTitle --jq '([.jobs[] | .name + "=" + .conclusion] | sort | join(",")) + " / " + .displayTitle'; bash scenarios/tools/run-log.sh $R $r3 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(event pull_request_target edited pr $p sender Bot|listing unique owner $run-1|dedup duplicate owner-unchanged owner $run-1|- Status: \`duplicate\`|- Owner: kept \`$run-1\`)\$"
    screen / build=success,screen / gate=success,screen / publish=skipped / steward pr 34 author 2095171 event pull_request_target edited sender 331019482 Bot
    5

    $ R=steady-orchard/patch-steward-testbed-public; h=$(grep -m1 -o '^s03_helper_run: [0-9]*' development-artifacts/patch-steward-m6-5.12-report.md | cut -d' ' -f2); gh run view $h -R $R --json conclusion,event --jq '.event + " " + .conclusion'; bash scenarios/tools/run-log.sh $R $h 1 edit | grep -c -E '^LOG job=edit ts=[^ ]+ text=app-edit (installation status=200|token status=201|title status=200|revoke status=204)$'
    workflow_dispatch success
    4

    $ bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S09 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: none
s03_helper_run: 36413596940
s03_run: 36413617643
