- status: pass
- base: a47a9dfb5fe1f9b319df0bd420413298ef83e669
- changes: |
    scenarios/results/org-public.md: appended section "## S10 issue: close by the author, reopen, close by the App"
    recording the author-close, reopen, and App-close events on issue 35 of
    steady-orchard/patch-steward-testbed-public, with jobs, gate/publish log lines, metrics records, run records,
    evidence verification, and final issue state (CLOSED). No existing text changed. Ran
    `pnpm exec prettier --write scenarios/results/org-public.md` after appending (no changes needed).
    development-artifacts/patch-steward-m6-5.19-report.md: this report, including the required
    s10_close_run/s10_reopen_run/s10_app_close_run lines.
- acceptance: |
    $ node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.19-report.md","utf8");const ok=[/^s10_close_run: [0-9]+\s*$/m,/^s10_reopen_run: [0-9]+\s*$/m,/^s10_app_close_run: [0-9]+\s*$/m].every(r=>r.test(s));console.log(ok?"report ok":"report incomplete")'
    report ok

    $ R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.19-report.md; c=$(grep -m1 -o '^s10_close_run: [0-9]*' $f | cut -d' ' -f2); o=$(grep -m1 -o '^s10_reopen_run: [0-9]*' $f | cut -d' ' -f2); a=$(grep -m1 -o '^s10_app_close_run: [0-9]*' $f | cut -d' ' -f2); for r in $c $o $a; do gh run view $r -R $R --json jobs,displayTitle --jq '([.jobs[] | .name + "=" + .conclusion] | sort | join(",")) + " / " + (.displayTitle | split(" event ")[1])'; done; bash scenarios/tools/run-log.sh $R $c 1 gate | grep -c -x -E 'LOG job=gate ts=[^ ]+ text=disposition closure resolution closed-by-author'; bash scenarios/tools/run-log.sh $R $o 1 gate | grep -c -x -E 'LOG job=gate ts=[^ ]+ text=(dedup commit reopened|disposition early-exit)'; bash scenarios/tools/run-log.sh $R $a 1 gate | grep -c -x -E 'LOG job=gate ts=[^ ]+ text=disposition closure resolution closed-by-maintainer'
    screen / build=success,screen / gate=success,screen / publish=success / issues closed sender 2095171 User
    screen / build=success,screen / gate=success,screen / publish=success / issues reopened sender 2095171 User
    screen / build=success,screen / gate=success,screen / publish=success / issues closed sender 331019482 Bot
    1
    2
    1

    $ R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.19-report.md; b=$(grep -m1 -o '^s10_body_run: [0-9]*' development-artifacts/patch-steward-m6-5.18-report.md | cut -d' ' -f2); c=$(grep -m1 -o '^s10_close_run: [0-9]*' $f | cut -d' ' -f2); o=$(grep -m1 -o '^s10_reopen_run: [0-9]*' $f | cut -d' ' -f2); a=$(grep -m1 -o '^s10_app_close_run: [0-9]*' $f | cut -d' ' -f2); bash scenarios/tools/run-records.sh metrics $R steward-evidence $R $c-1 | grep -c -E "^METRIC file=\S+/$c-1\.json kind=maintainer-resolution subject=submission action_kind=resolution resolution=closed-by-author paired_run=$b-1 paired_snapshot=sha256:[0-9a-f]{64}\$"; bash scenarios/tools/run-records.sh metrics $R steward-evidence $R $a-1 | grep -c -E "^METRIC file=\S+/$a-1\.json kind=maintainer-resolution subject=submission action_kind=resolution resolution=closed-by-maintainer paired_run=$o-1 paired_snapshot=sha256:[0-9a-f]{64}\$"; i=$(grep -m1 -o '^s10_issue: [0-9]*' development-artifacts/patch-steward-m6-5.18-report.md | cut -d' ' -f2); bash scenarios/tools/run-records.sh runs $R steward-evidence $R issue $i | grep -c -E "^RECORD run=($c|$a)-1 |^RECORD run=$o-1 kind=outcome "; gh issue view $i -R $R --json state --jq .state
    1
    1
    1
    CLOSED

    $ bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: none

s10_close_run: 36420190205
s10_reopen_run: 36420321847
s10_app_close_run: 36420516188
