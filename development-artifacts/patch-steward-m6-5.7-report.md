- status: pass
- base: 0c1be99dd8d5b2ff89f860a81d7f993ebbabb590
- changes: |
    Created scenarios/results/org-public.md with the required header and the S17 section (OA1 re-verification output,
    secret-scope run output filtered per context, run id 36409896857, Result: pass).
- acceptance: |
    (packet acceptance check 1: node one-liner reading this report file, asserting it matches /^s17_run: [0-9]+\s*$/m and
    does not contain the failure-path sentinel string that step 3 of actions would have inserted on an OA1 mismatch;
    command text omitted here verbatim since pasting it would embed that sentinel substring in this file and make the
    check's own string-search self-match)
    report ok

    bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-public | tail -n 1
    ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public result=ok

    run=$(grep -m1 -o '^s17_run: [0-9]*' development-artifacts/patch-steward-m6-5.7-report.md | cut -d' ' -f2); for j in outside inside; do bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public "$run" 1 $j; done | grep -c -x -E 'LOG job=outside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=true|LOG job=inside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=false'; gh run view "$run" -R steady-orchard/patch-steward-testbed-public --log | grep -c -e '-----BEGIN'
    4
    0

    node -e 'const s=require("fs").readFileSync("scenarios/results/org-public.md","utf8").replace(/\r/g,"").split("\n");const need=["# Scenario results: org-public","SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true","SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true","SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false","SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false","ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public result=ok"];const miss=need.filter(n=>!s.includes(n));const fin=s.some(l=>/^SECRET-SCOPE repo=steady-orchard\/patch-steward-testbed-public run=[0-9]+ url=\S+ result=pass$/.test(l));console.log(!miss.length&&fin&&s[0]===need[0]?"results ok":"results incomplete "+JSON.stringify(miss))'
    results ok

    bash scenarios/tools/results-check.sh scenarios/results/org-public.md S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: |
    Two, both non-substantive: (1) secret-scope.sh does not itself echo the dispatch.sh "DISPATCH run_id=..." line to stdout
    (it captures dispatch.sh's output internally and only echoes the check/DEPLOY/SECRET-SCOPE lines shown above); the run id
    was taken from the final `SECRET-SCOPE ... run=<id> ...` line, the only run-id-bearing line the tool prints. (2) This
    report's acceptance section omits the verbatim text of packet acceptance check 1's own node command, since that command's
    source text contains a substring that would make its own self-check on this file self-match; the check was still run
    exactly as specified and its output is recorded.

## OA1 verify (org-public)

```text
$ bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-public
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=environment-secrets expected=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] actual=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=deployment-branches expected=["master"] actual=["master"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=repository-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=organization-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public result=ok
```

## S17 run (secret-scope.sh)

```text
$ bash scenarios/tools/secret-scope.sh run steady-orchard/patch-steward-testbed-public
SECRET-SCOPE check=mapping identical
SECRET-SCOPE check=declarations identical
DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=master existed=yes
DEPLOY commit=39d3426736d1e497675c8884cf16e1fbe3858fc5 message=scenario: deploy secret-scope pair
DEPLOY push=ok attempt=1 head=39d3426736d1e497675c8884cf16e1fbe3858fc5
DEPLOY identical dest=.github/workflows/scenario-secret-scope.yml blob=3a488c17d9813f607bd810bf70be21a4c173d831
DEPLOY identical dest=.github/workflows/scenario-secret-scope-called.yml blob=9020f1a58702ee33bab4f83555a6e5ba9fb00168
SECRET-SCOPE job=inside line=^[[36;1mecho "PATCH_STEWARD_APP_ID length-zero=$id_empty"^[[0m
SECRET-SCOPE job=inside line=^[[36;1mecho "PATCH_STEWARD_APP_PRIVATE_KEY length-zero=$key_empty"^[[0m
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false
SECRET-SCOPE job=outside line=^[[36;1mecho "PATCH_STEWARD_APP_ID length-zero=$id_empty"^[[0m
SECRET-SCOPE job=outside line=^[[36;1mecho "PATCH_STEWARD_APP_PRIVATE_KEY length-zero=$key_empty"^[[0m
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true
SECRET-SCOPE repo=steady-orchard/patch-steward-testbed-public run=36409896857 url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36409896857 result=pass
```

s17_run: 36409896857
