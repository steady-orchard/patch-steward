- status: pass
- base: 0c1be99dd8d5b2ff89f860a81d7f993ebbabb590
- changes: |
    scenarios/README.md:
      - Layout: added `workflows/scenario-app-edit.yml`, the four policy-variant fixtures, and
        `fixtures/pull-requests/steward-pr-modified.yml`; reworded the results-files line to point at Results.
      - Safety rules: added the App-edit helper rule and the policy-variant deploy/restore rule.
      - Tools: added run-log.sh, await-runs.sh, run-records.sh, app-edit.sh, pins.sh, results-check.sh entries;
        corrected find-runs.sh ("lists workflow runs of any status" instead of "completed"); updated evidence.sh
        to note it verifies waiting run directories against their manifest.
      - Procedures: S03 now names app-edit.sh (title); S04 describes the second edit timed right after the older
        run's gate job; S05 describes three back-to-back edits and the duplicate/newest-owner rule; S06 names
        invalid-limit.yml; S07 names unwritable-store.yml and the already-owned pull request; S09 names
        steward-pr-modified.yml, caps-daily.yml, and pr-chore.txt; S10 names app-edit.sh close and base branch
        scenario-s10-base; S11 names caps-daily.yml then caps-author.yml; S12 names the S00 run; S13/S14 name
        audit.sh/pins.sh; S15/S16 name defect-complete.txt.
      - Added a `## Results` section documenting the one-file-per-test-bed format, section heading, fences, the
        `Result: pass|fail` line, and results-check.sh.
      - Ran `pnpm exec prettier --write scenarios/README.md` afterward.
- acceptance: |
    pnpm exec prettier --check scenarios/README.md > /dev/null 2>&1; echo "exit $?"
    exit 0

    node -e 'const s=require("fs").readFileSync("scenarios/README.md","utf8");const need=["run-log.sh","await-runs.sh","run-records.sh","app-edit.sh","pins.sh","results-check.sh","scenario-app-edit.yml","invalid-limit.yml","unwritable-store.yml","caps-daily.yml","caps-author.yml","steward-pr-modified.yml","defect-complete.txt","pr-chore.txt","scenario-s10-base","closed-by-maintainer","find-runs.sh","evidence.sh","audit.sh","secret-scope.sh","steady-state.sh","deploy-steward.sh"];const miss=need.filter(n=>!s.includes(n));const res=/Result:\s+pass/.test(s)&&/^## Results\s*$/m.test(s);const bad=/lists completed|List completed/.test(s);console.log(!miss.length&&res&&!bad?"readme ok":"readme incomplete "+JSON.stringify({miss,res,bad}))'
    readme ok

    git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b|(?i:\bphase [0-9]|\bstep [0-9]+\.[0-9]+)' -- scenarios/README.md; echo "exit $?"
    exit 1

    node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/README.md
    clean
- deviations: none
