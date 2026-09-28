- status: pass
- base: 690b55adbd802c43ae248f92f7c64c8cbcc8b4e5
- changes: |
    Added scenarios/tools/run-log.sh: validates 4 args, reads `gh run view --attempt --log` into a temp
    file (mktemp -d, trap cleanup), filters/normalizes lines in an inline node script (strips CR, splits
    TAB fields, derives job name from the part after the last "/ ", strips leading BOM, drops lines
    echoed from a step's own script (text starting with literal `^[`) and lines containing `add-mask`,
    withholds lines containing `-----BEGIN` or matching a GitHub token pattern), prints `LOG job=... ts=...
    text=...` per kept line then a `LOGS ...` summary line.

    Added scenarios/tools/await-runs.sh: validates 5 args, checks `gh api rate_limit` core remaining >=
    500, then polls scenarios/tools/find-runs.sh immediately and every 20s until PROBE_WAIT_SECONDS
    (default 540) elapses, selecting RUN lines with id > after-run-id (awk numeric compare), printing
    them plus an `AWAIT ...` summary line with result=complete (exit 0, when count >= min and all
    selected are status=completed) or result=timeout (exit 3, at deadline).

    Edited only the header comment of scenarios/tools/find-runs.sh: replaced "List completed workflow
    runs" with "List workflow runs (any status)" and "Reads runs of the named workflow (up to 100..."
    with "Reads runs of the named workflow of any status (up to 100...". No non-comment line changed.
- acceptance: |
    1. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36397673122 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(policy revision d997b1e362c75af03942da0e7a1e8902ca5dbe51|ownership retention 90 days|evidence commit 6f1c3c890f7106aa762a591faff452a2cac35c1d rebuilds 0|freshness current|steward job summary:|- Freshness: `current`|- Status: `needs-changes`)$'
       -> 7

    2. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36397673122 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(event issues opened issue 31 sender User|listing none|dedup commit no-owner|disposition early-exit|- Owner: committed `36397673122-1`)$|^LOGS repo=steady-orchard/patch-steward-testbed-public run=36397673122 attempt=1 job=gate lines=[1-9][0-9]* withheld=0$'
       -> 6

    3. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36397673122 1 publish | grep -c -e 'steward job summary:' -e 'text=^\['
       -> 1

    4. for a in "" "x/y" "x/y 1 1" "x/y z 1 gate" "x/y 1 1 Gate"; do bash scenarios/tools/run-log.sh $a > /dev/null 2>&1; echo "exit $?"; done; for a in "" "x/y w.yml p 0" "x/y w.yml p z 1" "x/y w.yml p 0 0"; do bash scenarios/tools/await-runs.sh $a > /dev/null 2>&1; echo "exit $?"; done
       ->
       exit 2
       exit 2
       exit 2
       exit 2
       exit 2
       exit 2
       exit 2
       exit 2
       exit 2

    5. bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue 31 author " 0 1 | grep -c -E '^RUN id=36397673122 attempt=[0-9]+ event=issues status=completed |^AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml after=0 count=1 completed=1 result=complete$'; echo "exit ${PIPESTATUS[0]}"
       ->
       2
       exit 0

    6. PROBE_WAIT_SECONDS=1 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue 31 author " 36397673122 1; echo "exit $?"
       ->
       AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml after=36397673122 count=0 completed=0 result=timeout
       exit 3

    7. git diff --quiet d1af5375321637fe8b1e9b325b6ababb62ee6b58 -- scenarios/tools/find-runs.sh; echo "changed $?"; grep -c 'completed workflow runs' scenarios/tools/find-runs.sh; diff <(git show d1af5375321637fe8b1e9b325b6ababb62ee6b58:scenarios/tools/find-runs.sh | tr -d '\r' | grep -v '^#') <(tr -d '\r' < scenarios/tools/find-runs.sh | grep -v '^#') && echo "code unchanged"
       ->
       changed 1
       0
       code unchanged

    8. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b|set -x|auth token' -- scenarios/tools/run-log.sh scenarios/tools/await-runs.sh scenarios/tools/find-runs.sh; echo "exit $?"
       -> exit 1

    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/tools/run-log.sh scenarios/tools/await-runs.sh scenarios/tools/find-runs.sh
       -> clean
- deviations: none
