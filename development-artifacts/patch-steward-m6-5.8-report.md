- status: pass
- base: 0c1be99dd8d5b2ff89f860a81d7f993ebbabb590
- changes: |
    Created scenarios/results/personal.md with the S17 (publication Environment secret delivery) and S15
    (contract-met issue screening) sections, verbatim tool output in text fences, filtered per context (dropped the
    two `^[` step-echo lines per job in the secret-scope output).
    On jambolo/patch-steward-testbed-personal: deployed the secret-scope helper pair to master (no functional change,
    files already identical), dispatched and ran the S17 scenario (run 36409893521, result pass), created issue #9
    (S15, defect-complete.txt body, left OPEN), which was screened by run 36409964372 (build/gate/publish all
    success), publishing evidence commit c5ae908e66ec9298048d6d0dbd54713930cb911e to steward-evidence (outcome
    inconclusive, verified).
- acceptance: |
    node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.8-report.md","utf8");const ok=[/^s17_run: [0-9]+\s*$/m,/^s15_issue: [0-9]+\s*$/m,/^s15_run: [0-9]+\s*$/m,/^s15_commit: [0-9a-f]{40}\s*$/m].every(r=>r.test(s))&&!/OA[14] not done/.test(s);console.log(ok?"report ok":"report incomplete")'
    -> report ok

    bash scenarios/tools/environment-check.sh jambolo/patch-steward-testbed-personal | tail -n 1
    -> ENVIRONMENT repo=jambolo/patch-steward-testbed-personal result=ok

    f=development-artifacts/patch-steward-m6-5.8-report.md; run=$(grep -m1 -o '^s17_run: [0-9]*' $f | cut -d' ' -f2); for j in outside inside; do bash scenarios/tools/run-log.sh jambolo/patch-steward-testbed-personal "$run" 1 $j; done | grep -c -x -E 'LOG job=outside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=true|LOG job=inside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=false'; gh run view "$run" -R jambolo/patch-steward-testbed-personal --log | grep -c -e '-----BEGIN'
    -> 4
    -> 0

    f=development-artifacts/patch-steward-m6-5.8-report.md; P=jambolo/patch-steward-testbed-personal; n=$(grep -m1 -o '^s15_issue: [0-9]*' $f | cut -d' ' -f2); run=$(grep -m1 -o '^s15_run: [0-9]*' $f | cut -d' ' -f2); c=$(grep -m1 -o '^s15_commit: [0-9a-f]*' $f | cut -d' ' -f2); gh run view "$run" -R $P --json jobs,displayTitle --jq '([.jobs[] | .name + "=" + .conclusion] | sort | join(",")) + " " + .displayTitle'; bash scenarios/tools/run-log.sh $P "$run" 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(listing none|dedup commit no-owner|disposition runnable|caps within daily [0-9]+ of 50 author [0-9]+ of 2)$'; bash scenarios/tools/run-log.sh $P "$run" 1 publish | grep -c -E "^LOG job=publish ts=[^ ]+ text=(evidence commit $c rebuilds [0-9]+|freshness current|- Status: \`inconclusive\`)\$"
    -> screen / build=success,screen / gate=success,screen / publish=success steward issue 9 author 2095171 event issues opened sender 2095171 User
    -> 4
    -> 3

    f=development-artifacts/patch-steward-m6-5.8-report.md; P=jambolo/patch-steward-testbed-personal; n=$(grep -m1 -o '^s15_issue: [0-9]*' $f | cut -d' ' -f2); run=$(grep -m1 -o '^s15_run: [0-9]*' $f | cut -d' ' -f2); c=$(grep -m1 -o '^s15_commit: [0-9a-f]*' $f | cut -d' ' -f2); bash scenarios/tools/evidence.sh $P steward-evidence $P issue "$n" | grep -c -E "^EVIDENCE append_only=yes\$|^EVIDENCE run=$run-1 kind=outcome outcome=inconclusive manifest=verified metrics=verified errors=0\$|^EVIDENCE target=$P subject=issue-$n runs=1 verified=1 result=ok\$"; gh api "repos/$P/commits?sha=steward-evidence&per_page=5" --jq '[.[].sha]' | grep -c "$c"
    -> 3
    -> 1

    node -e (results.md fixed-string + result=pass check); bash scenarios/tools/results-check.sh scenarios/results/personal.md S15 S17 | tail -n 1
    -> results ok
    -> RESULTS-CHECK file=scenarios/results/personal.md result=pass

    All six acceptance commands run and gave exactly the stated results.
- deviations: |
    S17 output did not contain explicit `DISPATCH run_id=`/`DISPATCH ... url=...` lines as the context described
    (only DEPLOY and SECRET-SCOPE lines appeared); S17_RUN was taken from the run id in the final
    `SECRET-SCOPE repo=... run=<id> ... result=pass` line, which the acceptance checks (2) confirm is the correct
    run. Everything else matched context/actions exactly.
s17_run: 36409893521
s15_issue: 9
s15_run: 36409964372
s15_commit: c5ae908e66ec9298048d6d0dbd54713930cb911e

## OA1 verify (personal)

```text
$ bash scenarios/tools/environment-check.sh jambolo/patch-steward-testbed-personal
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal check=environment-secrets expected=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] actual=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] ok
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal check=deployment-branches expected=["master"] actual=["master"] ok
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal check=repository-secrets expected=[] actual=[] ok
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal result=ok
```

## OA4 proof

S15 publish (run 36409964372-1) committed evidence commit c5ae908e66ec9298048d6d0dbd54713930cb911e to
jambolo/patch-steward-testbed-personal's steward-evidence branch (root commit, parents=0, added=9, other=0),
verified by evidence.sh as `EVIDENCE run=36409964372-1 kind=outcome outcome=inconclusive manifest=verified
metrics=verified errors=0` and `result=ok`, and the commit sha appears in the branch's commit list via the GitHub
API. No `- Failure:` line and no HTTP 403 appeared in the gate or publish logs. This proves the personal
installation accepted the App's current permissions (OA4 present).
