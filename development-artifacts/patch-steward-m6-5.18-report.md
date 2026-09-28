- status: pass
- base: e8a818c6d3cec2a5bce0189c3416239c12a98cbe
- changes: |
    Opened issue 35 on steady-orchard/patch-steward-testbed-public with body scenarios/fixtures/submissions/unstructured.txt
    (unstructured, contract not met); edited only its title to add "(title edited)"; then edited only its body to append
    "Scenario body edit: S10.". Observed run 36419197068 (open: listing none, dedup commit no-owner, disposition
    early-exit, publish evidence commit acd9ce3b57277a637f2e979bcf4ad02b1ec1e459, freshness current, needs-changes), run
    36419328690 (title edit: listing unique owner 36419197068-1, dedup duplicate owner-unchanged, publish skipped,
    duplicate), run 36419421470 (body edit: listing unique owner 36419197068-1, dedup commit snapshot-changed,
    disposition early-exit, publish evidence commit 8ec860b8a43696d2a330a6724905c7aef291aced, freshness current,
    needs-changes). Confirmed two ownership artifacts steward-ownership-issue-35 (runs 36419197068, 36419421470) and two
    evidence outcome records (36419197068-1, 36419421470-1), both needs-changes. Appended section "## S10 issue: open,
    title edit, body edit" to scenarios/results/org-public.md (all commands and outputs verbatim); ran prettier --write
    on it (unchanged) and results-check.sh (pass). Issue left open per instructions.
- acceptance: |
    node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.18-report.md","utf8");const ok=[/^s10_issue: [0-9]+\s*$/m,/^s10_open_run: [0-9]+\s*$/m,/^s10_title_run: [0-9]+\s*$/m,/^s10_body_run: [0-9]+\s*$/m].every(r=>r.test(s));console.log(ok?"report ok":"report incomplete")'
    report ok

    R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.18-report.md; o=$(grep -m1 -o '^s10_open_run: [0-9]*' $f | cut -d' ' -f2); t=$(grep -m1 -o '^s10_title_run: [0-9]*' $f | cut -d' ' -f2); b=$(grep -m1 -o '^s10_body_run: [0-9]*' $f | cut -d' ' -f2); for r in $o $t $b; do gh run view $r -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; done; bash scenarios/tools/run-log.sh $R $o 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(listing none|dedup commit no-owner|disposition early-exit)$'; bash scenarios/tools/run-log.sh $R $t 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(listing unique owner $o-1|dedup duplicate owner-unchanged owner $o-1|- Status: \`duplicate\`)\$"; bash scenarios/tools/run-log.sh $R $b 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(listing unique owner $o-1|dedup commit snapshot-changed|disposition early-exit)\$"
    screen / build=success,screen / gate=success,screen / publish=success
    screen / build=success,screen / gate=success,screen / publish=skipped
    screen / build=success,screen / gate=success,screen / publish=success
    3
    3
    3

    R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.18-report.md; i=$(grep -m1 -o '^s10_issue: [0-9]*' $f | cut -d' ' -f2); o=$(grep -m1 -o '^s10_open_run: [0-9]*' $f | cut -d' ' -f2); b=$(grep -m1 -o '^s10_body_run: [0-9]*' $f | cut -d' ' -f2); bash scenarios/tools/run-records.sh runs $R steward-evidence $R issue $i | grep -c -E "^RECORD run=($o|$b)-1 kind=outcome outcome=needs-changes "
    2

    bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: |
    While appending the results section, a `cat` from a scratchpad file into the results file accidentally included a
    stray literal `</content>` line at end of file (an artifact of the file-writing tool call, not scenario data); it was
    detected immediately and removed before running prettier and results-check, leaving no trace in the committed file.
    No other deviation from actions.

s10_issue: 35
s10_open_run: 36419197068
s10_title_run: 36419328690
s10_body_run: 36419421470
