s05_try: 1
s05_runs: 36417410111 36417413257 36417416630

- status: pass
- base: 7edc48fb9e2b8fb46cff86e1a675754ef3719e84
- changes: |
    scenarios/results/org-public.md: appended one section `## S05 concurrent body edits: only the newest owner publishes`
    recording try 1 (three quick body edits of pull request 34 on
    steady-orchard/patch-steward-testbed-public), the await-runs and S05-check outputs, per-run gate/publish log
    excerpts, the last three ARTIFACT lines, and the full evidence.sh output (append_only=yes, result=ok). Only one
    `## S05 ` heading exists; no existing text was changed.
    development-artifacts/patch-steward-m6-5.15-report.md: created this report with s05_try and s05_runs.
- acceptance: |
    $ node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.15-report.md","utf8");console.log(/^s05_try: [1-3]\s*$/m.test(s)&&/^s05_runs: [0-9]+( [0-9]+){2,}\s*$/m.test(s)?"report ok":"report incomplete")'
    report ok

    $ R=steady-orchard/patch-steward-testbed-public; P=34; RUNS="36417410111 36417413257 36417416630"; (S05 check script, tail -n 1)
    S05 pass

    $ bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 34 | grep -c -E "^EVIDENCE append_only=yes$|^EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=pr-34 runs=[0-9]+ verified=[0-9]+ result=ok$"
    2

    $ bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S08 S09 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: none
