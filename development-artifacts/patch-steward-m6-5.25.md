# Step 5.25

- id: 5.25
- depends_on: [5.6, 5.24]
- route: mechanical
- objective: Phase gate (verification only): run the phase Definition of Done checks D1-D11 against the test-beds and the tree, and record command, expected, actual, and PASS or FAIL per item plus an overall verdict in the report.
- files_in_scope:
    - development-artifacts/patch-steward-m6-5.25-report.md
- context: |
    Git Bash, in the MAIN repository tree (the supervisor runs this step there; long worktree paths break tooling). jq is
    NOT installed. gh is logged in (user jambolo). Every command below is read-only; make NO GitHub write and change NO file
    except this step's report. Never print a token or secret. Never run a formatter on development-artifacts/.
    PB (phase base) = d1af5375321637fe8b1e9b325b6ababb62ee6b58. Test-beds: org-public steady-orchard/patch-steward-testbed-public,
    personal jambolo/patch-steward-testbed-personal, org-private steady-orchard/patch-steward-testbed-private.
    An honest FAIL is a successful gate step: record exactly what each command printed; never edit a scenario, a results
    file, or a test-bed to make an item pass. Items only check project state, never this report.
    Report format: for each item a section `### D<n>` with lines `- command: <the command>`, `- expected: <expected>`,
    `- actual: <verbatim output, in a text fence when it has several lines>`, `- verdict: PASS` or `- verdict: FAIL`; after the
    last item a line at column 0 `overall: PASS` (every item PASS) or `overall: FAIL`, and for FAIL a list of the failed items.
    Phase-5 exit-criterion map (for the report's closing paragraph, no check): title-only edit or unchanged echo keeps the
    owner (S02, S03); body edit commits and the older run ends superseded (S04); concurrent events and append-only store
    (S05); failure before commitment and failed gate (S06); failed publish (S07); evidence first (S08, S01); pull request
    editing wrappers or policy (S09); closures and own-input rescreens (S10); caps and waiting states (S11); explicit rerun
    (S12); observe writes nothing (S13); only gate and publish use the Environment, everything pinned (S14, S17);
    cross-owner and separate-store smoke (S15, S16).
- actions: |
    1. Base check (files changed in steps 5.6 and 5.24): bash -c 'for f in scenarios/results/org-public.md scenarios/results/personal.md scenarios/results/org-private.md scenarios/tools/results-check.sh scenarios/tools/pins.sh; do [ -f "$f" ] || echo "MISSING $f"; done; grep -q "^## Steady state" scenarios/results/org-private.md || echo "MISSING steady state"; grep -q "results-check.sh" scenarios/README.md || echo "MISSING README update"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile
    3. Run each item and record it per the report format:
       D1 (results sections): bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S13 S14 S17 | tail -n 1; bash scenarios/tools/results-check.sh scenarios/results/personal.md S13 S14 S15 S17 | tail -n 1; bash scenarios/tools/results-check.sh scenarios/results/org-private.md S13 S14 S16 S17 | tail -n 1
          expected three lines: RESULTS-CHECK file=scenarios/results/org-public.md result=pass, RESULTS-CHECK file=scenarios/results/personal.md result=pass, RESULTS-CHECK file=scenarios/results/org-private.md result=pass
       D2 (observe audit, all counts 0): for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/audit.sh $r | tail -n 1; done
          expected three lines, each matching `AUDIT repo=<r> submissions=<n >= 1> app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 result=clean`
       D3 (S17 recorded on each test-bed): node -e 'const fs=require("fs");const T={"org-public":"steady-orchard/patch-steward-testbed-public","personal":"jambolo/patch-steward-testbed-personal","org-private":"steady-orchard/patch-steward-testbed-private"};for(const [k,r] of Object.entries(T)){const L=fs.readFileSync("scenarios/results/"+k+".md","utf8").replace(/\r/g,"").split("\n");const need=["SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true","SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true","SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false","SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false"];const ok=need.every(n=>L.includes(n))&&L.some(l=>l.startsWith("SECRET-SCOPE repo="+r+" run=")&&l.endsWith(" result=pass"));console.log(k+" s17 "+(ok?"recorded":"MISSING"))}'
          expected three lines: org-public s17 recorded, personal s17 recorded, org-private s17 recorded
       D4 (steady state): for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/steady-state.sh $r plan | tail -n 1; gh api "repos/$r/actions/workflows?per_page=100" --paginate --jq '.workflows[] | select(.path == ".github/workflows/steward-pr.yml" or .path == ".github/workflows/steward-issues.yml" or (.path | startswith(".github/workflows/scenario-"))) | (.path | ltrimstr(".github/workflows/")) + " " + .state' | grep -v -E '^scenario-secret-scope-called\.yml ' | grep -v -c ' disabled_manually$'; done
          expected six lines: SCENARIO-STEADY <r> result=planned active_workflows=0 open_submissions=0 then 0, for each test-bed in that order
       D5 (Prettier): pnpm exec prettier --check scenarios > /dev/null 2>&1; echo "exit $?"      expected: exit 0
       D6 (no token or key text in results): git grep -n -E 'ghs_|ghp_|-----BEGIN' HEAD -- scenarios/results; echo "exit $?"      expected: exit 1 (no other output)
       D7 (secret names): git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' HEAD -- .github/workflows/steward-screening.yml templates packages scenarios docs README.md CLAUDE.md ':!docs/project-development-plan.md' ':!docs/astra-plan.md'; echo "exit $?"; git grep -c 'PATCH_STEWARD_APP_PRIVATE_KEY' HEAD -- .github/workflows/steward-screening.yml
          expected two lines: exit 1, then HEAD:.github/workflows/steward-screening.yml:<count >= 1>
       D8 (persistence): git grep -n -P 'development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' HEAD -- scenarios; echo "exit $?"      expected: exit 1 (no other output)
       D9 (pins, every test-bed): pin=$(tr -d '\r' < scenarios/workflows/steward-pr.yml | grep -oE 'steward-screening\.yml@[0-9a-f]{40}' | cut -d@ -f2); for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/pins.sh $r | tail -n 1; done | grep -c -E "^PINS repo=\S+ pin=$pin result=pass\$"      expected: 3
       D10 (characters): node -e 'const fs=require("fs");const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];const files=require("child_process").execSync("git diff --name-only d1af5375321637fe8b1e9b325b6ababb62ee6b58 HEAD -- scenarios",{encoding:"utf8"}).split("\n").filter(f=>f&&fs.existsSync(f));let bad=[];for(const f of files){const s=fs.readFileSync(f,"utf8");for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){bad.push(f);break}}}console.log(files.length>0&&!bad.length?"clean "+files.length+" files":"dirty "+JSON.stringify(bad))'
          expected: clean <n> files (n >= 1)
       D11 (owner-action proofs): node -e 'const fs=require("fs");const a=fs.readFileSync("development-artifacts/patch-steward-m6-5.8-report.md","utf8");const b=fs.readFileSync("development-artifacts/patch-steward-m6-5.9-report.md","utf8");const ok=/^## OA4 proof/m.test(a)&&/^s15_commit: [0-9a-f]{40}/m.test(a)&&!/OA[14] not done/.test(a)&&/^## OA3 proof/m.test(b)&&/^s16_commit: [0-9a-f]{40}/m.test(b)&&!/OA[123] not done/.test(b);console.log(ok?"owner actions proved":"owner action proof missing")'
          expected: owner actions proved
    4. Write the report (items D1-D11, the overall line, the exit-criterion map as a closing paragraph).
- acceptance: |
    Run from the tree root in Git Bash; it must give exactly the stated result (it checks the report's structure only, so an
    honest FAIL report satisfies it exactly like a PASS report).
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.25-report.md","utf8").replace(/\r/g,"");const parts=s.split(/^### /m);const miss=[];for(let n=1;n<=11;n++){const p=parts.find(x=>x.startsWith("D"+n+"\n")||x.startsWith("D"+n+" "));if(!p||!/^- command: /m.test(p)||!/^- expected: /m.test(p)||!/^- actual: /m.test(p)||!/^- verdict: (PASS|FAIL)\s*$/m.test(p))miss.push("D"+n)}console.log(!miss.length&&/^overall: (PASS|FAIL)\s*$/m.test(s)?"gate report complete":"gate report incomplete "+miss.join(","))'
       -> prints exactly: gate report complete
- rollback: |
    Nothing to revert beyond the report commit (verification only).
