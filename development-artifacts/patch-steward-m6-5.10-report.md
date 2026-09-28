- status: pass
- base: 3644d88485f01bc8efcb80da1fec36698cde56f4
- changes: |
    scenarios/results/org-public.md: appended section "## S09 pull requests that change the wrapper and the policy"
    recording the same-repository pull request (steady-orchard/patch-steward-testbed-public#32, run 36410834391) and
    the fork pull request (steady-orchard/patch-steward-testbed-public#33, run 36411709793), both screened under the
    default-branch workflow definition and trusted policy tree d997b1e362c75af03942da0e7a1e8902ca5dbe51, with
    verbatim command/output for the master policy tree lookup, both deploy/pr-create sequences, and both runs' name,
    workflowName, jobs, gate log, publish log, and run-records checks, plus the evidence.sh check for pr 33.
    Nothing else in the repository was changed. No new GitHub state was created for the same-repository pull request:
    per the RESUME note in action 4, branch scenario-s09-same, pull request #32, and run 36410834391 already existed
    from attempt 1; only the read-only action 4b and 4f checks were re-run against them. For the fork pull request
    (action 5), branch scenario-s09-fork was deployed to jambolo/patch-steward-testbed-public, pull request #33 was
    created, and its run 36411709793 completed; both pull requests were left open per action 8.
- acceptance: |
    $ node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.10-report.md","utf8");const ok=[/^s09_master_tree: [0-9a-f]{40}\s*$/m,/^s09_same_pr: [0-9]+\s*$/m,/^s09_same_run: [0-9]+\s*$/m,/^s09_fork_pr: [0-9]+\s*$/m,/^s09_fork_run: [0-9]+\s*$/m].every(r=>r.test(s));console.log(ok?"report ok":"report incomplete")'
    report ok

    $ f=development-artifacts/patch-steward-m6-5.10-report.md; R=steady-orchard/patch-steward-testbed-public; for k in same fork; do n=$(grep -m1 -o "^s09_${k}_pr: [0-9]*" $f | cut -d' ' -f2); run=$(grep -m1 -o "^s09_${k}_run: [0-9]*" $f | cut -d' ' -f2); t=$(gh api repos/$R/actions/runs/$run --jq '[.name, .path, .event, .display_title] | join(" | ")')" | "$(gh run view $run -R $R --json workflowName --jq .workflowName); d="steward pr $n author 2095171 event pull_request_target opened sender 2095171 User"; [ "$t" = "$d | .github/workflows/steward-pr.yml | pull_request_target | $d | steward-pr" ] && echo "$k definition ok" || echo "$k definition WRONG $t"; gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; done
    same definition ok
    screen / build=success,screen / gate=success,screen / publish=success
    fork definition ok
    screen / build=success,screen / gate=success,screen / publish=success

    $ f=development-artifacts/patch-steward-m6-5.10-report.md; R=steady-orchard/patch-steward-testbed-public; M=$(grep -m1 -o '^s09_master_tree: [0-9a-f]*' $f | cut -d' ' -f2); for k in same fork; do run=$(grep -m1 -o "^s09_${k}_run: [0-9]*" $f | cut -d' ' -f2); g=$(bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(policy trusted-branch revision $M|disposition runnable|caps within daily [0-9]+ of 50 author [0-9]+ of 2)\$"); p=$(bash scenarios/tools/run-log.sh $R $run 1 publish | grep -c -E "^LOG job=publish ts=[^ ]+ text=(freshness current|- Status: \`inconclusive\`)\$"); echo "$k gate=$g publish=$p"; done
    same gate=3 publish=2
    fork gate=3 publish=2

    $ f=development-artifacts/patch-steward-m6-5.10-report.md; R=steady-orchard/patch-steward-testbed-public; M=$(grep -m1 -o '^s09_master_tree: [0-9a-f]*' $f | cut -d' ' -f2); for k in same fork; do n=$(grep -m1 -o "^s09_${k}_pr: [0-9]*" $f | cut -d' ' -f2); run=$(grep -m1 -o "^s09_${k}_run: [0-9]*" $f | cut -d' ' -f2); bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $n | grep -c -E "^RECORD run=$run-1 kind=outcome outcome=inconclusive run_id=$run run_attempt=1 policy_revision=$M snapshot=sha256:[0-9a-f]{64} findings=([a-z.-]+,)*submission\.policy-change,([a-z.-]+,)*submission\.trusted-path-change(,[a-z.-]+)*\$"; done; s=$(gh api "repos/$R/contents/.github?ref=scenario-s09-same" --jq '.[] | select(.name=="patch-steward") | .sha'); k=$(gh api "repos/jambolo/patch-steward-testbed-public/contents/.github?ref=scenario-s09-fork" --jq '.[] | select(.name=="patch-steward") | .sha'); [ -n "$s" ] && [ -n "$k" ] && [ "$s" != "$M" ] && [ "$k" != "$M" ] && echo "head trees differ"
    1
    1
    head trees differ

    $ bash scenarios/tools/results-check.sh scenarios/results/org-public.md S09 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: |
    None from the step file's actions. Per the RESUME note, action 4's write sub-steps (4a branch push, 4c newest-run-id
    capture before triggering, 4d pull request creation) were not repeated; only 4b and 4f (both read-only) were run
    against the pre-existing branch scenario-s09-same, pull request 32, and run 36410834391, as directed.

s09_master_tree: d997b1e362c75af03942da0e7a1e8902ca5dbe51
s09_same_pr: 32
s09_same_run: 36410834391
s09_fork_pr: 33
s09_fork_run: 36411709793
