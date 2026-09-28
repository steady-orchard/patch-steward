- status: pass
- base: 5de6a72c59871a35a2547ce95b4b049fd78d64d5
- changes: |
    scenarios/results/org-public.md: appended two sections, "## S01 unstructured pull request" and "## S02 title-only
    edit keeps the owner", recording pull request steady-orchard/patch-steward-testbed-public#34 (unstructured body,
    disposition early-exit, outcome needs-changes, one ownership artifact steward-ownership-pr-34, evidence commit
    214529eff25d9a5c82c307add55c281cbe05ae61 committed before the job summary in the publish log) and its title-only
    edit (run 36412957123: build/gate success, publish skipped, gate keeps owner 36412442107-1, ownership artifact
    listing and run records unchanged). Verbatim command/output for the deploy, pull request creation, both await
    sequences, both jobs checks, both gate log checks, the S01 publish log check, and the artifacts/run-records checks
    (run once after S01, once again after S02 to confirm no change).
    Nothing else in the repository was changed. GitHub state created on steady-orchard/patch-steward-testbed-public:
    branch scenario-s01-head, pull request #34 (left open per instructions), one evidence commit on orphan branch
    steward-evidence, one ownership artifact steward-ownership-pr-34.
- acceptance: |
    $ node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.11-report.md","utf8");const ok=[/^s01_pr: [0-9]+\s*$/m,/^s01_run: [0-9]+\s*$/m,/^s01_commit: [0-9a-f]{40}\s*$/m,/^s02_run: [0-9]+\s*$/m].every(r=>r.test(s));console.log(ok?"report ok":"report incomplete")'
    report ok

    $ f=development-artifacts/patch-steward-m6-5.11-report.md; R=steady-orchard/patch-steward-testbed-public; run=$(grep -m1 -o '^s01_run: [0-9]*' $f | cut -d' ' -f2); c=$(grep -m1 -o '^s01_commit: [0-9a-f]*' $f | cut -d' ' -f2); gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(listing none|dedup commit no-owner|disposition early-exit)$'; bash scenarios/tools/run-log.sh $R $run 1 publish | node -e '(the order-check one-liner from the step packet, verbatim)' "$c"
    screen / build=success,screen / gate=success,screen / publish=success
    3
    summary after evidence

    $ f=development-artifacts/patch-steward-m6-5.11-report.md; R=steady-orchard/patch-steward-testbed-public; p=$(grep -m1 -o '^s01_pr: [0-9]*' $f | cut -d' ' -f2); run=$(grep -m1 -o '^s01_run: [0-9]*' $f | cut -d' ' -f2); bash scenarios/tools/artifacts.sh $R steward-ownership-pr-$p | grep -c -E "^ARTIFACT id=[0-9]+ name=steward-ownership-pr-$p created_at=\S+ expires_at=\S+ expired=false run_id=$run size=|^ARTIFACTS repo=$R name=steward-ownership-pr-$p count=1 unexpired=1\$"; bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $p | grep -c -E "^RECORD run=$run-1 kind=outcome outcome=needs-changes run_id=$run run_attempt=1 .* findings=submission\.unstructured\$|^RECORDS .* subject=pr-$p runs=1 supersessions=0\$"
    2
    2

    $ f=development-artifacts/patch-steward-m6-5.11-report.md; R=steady-orchard/patch-steward-testbed-public; run=$(grep -m1 -o '^s01_run: [0-9]*' $f | cut -d' ' -f2); r2=$(grep -m1 -o '^s02_run: [0-9]*' $f | cut -d' ' -f2); gh run view $r2 -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R $r2 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(listing unique owner $run-1|dedup duplicate owner-unchanged owner $run-1|- Status: \`duplicate\`|- Owner: kept \`$run-1\`)\$"
    screen / build=success,screen / gate=success,screen / publish=skipped
    4

    $ bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S09 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: |
    None in method. One transient tool-level interruption occurred mid-step: the Bash tool briefly returned
    "server-side auto mode classifier gave no verdict" errors for several consecutive calls (including trivial
    read-only commands with no GitHub effect) after the S01 run had been observed as jobs=all success but before its
    gate/publish logs were read; no GitHub write was attempted during the interruption, and the tool resumed working
    on its own. No repair, retry-with-different-arguments, or workaround was applied; the exact same commands were
    simply re-issued once the tool started responding again.
s01_pr: 34
s01_run: 36412442107
s01_commit: 214529eff25d9a5c82c307add55c281cbe05ae61
s02_run: 36412957123
