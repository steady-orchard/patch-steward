# Step 5.7

- id: 5.7
- depends_on: [5.1, 5.4]
- route: mechanical
- objective: On the org-public test-bed, re-verify the publication Environment (owner action OA1), run the live Environment-only secret delivery check (scenario S17), and create scenarios/results/org-public.md with its header and the S17 section.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.7-report.md
- context: |
    ENVIRONMENT. Git Bash; run every command from your tree root. jq is NOT installed (use `gh --jq` or node).
    core.autocrlf=true. gh is logged in as jambolo (user id 2095171). `gh api` endpoints never start with `/`. The Bash tool
    call times out at 600 s: pass the Bash tool timeout 600000 for secret-scope.sh. Never print, log, or store a token, key,
    or secret (never `gh auth token`, never `set -x`). Never run a formatter on development-artifacts/.

    R = steady-orchard/patch-steward-testbed-public (org-public test-bed; default branch master). Owner action OA1 (must hold
    before any run that uses the Environment): Environment `steward-publication` on R with secrets PATCH_STEWARD_APP_ID and
    PATCH_STEWARD_APP_PRIVATE_KEY, deployment branch policy `master` only, no repository or organization secret named
    PATCH_STEWARD_*. `bash scenarios/tools/environment-check.sh <r>` runs exactly these read-only checks and prints
    `ENVIRONMENT repo=<r> check=<name> expected=<e> actual=<a> ok|MISMATCH` per check (environment-secrets,
    deployment-branches, repository-secrets, organization-secrets) and `ENVIRONMENT repo=<r> result=ok|incomplete` (exit 0 or 1).
    Secret NAMES only; never values.

    Scenario S17 (Environment-only delivery): `bash scenarios/tools/secret-scope.sh run <r>` first checks that the helper pair
    reproduces the product's secret path byte for byte (lines `SECRET-SCOPE check=mapping identical`, `SECRET-SCOPE
    check=declarations identical`), deploys scenarios/workflows/scenario-secret-scope.yml and scenario-secret-scope-called.yml
    to R's master (probes/smoke/tools/deploy.sh; lines starting DEPLOY), dispatches the caller (probes/smoke/tools/dispatch.sh;
    lines starting DISPATCH, including `DISPATCH run_id=<id> url=...`), waits for it, and reads its log. Called job `outside`
    (no Environment) must print `PATCH_STEWARD_APP_ID length-zero=true` and `PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true`;
    job `inside` (Environment steward-publication) both with `length-zero=false`; the log must contain no `-----BEGIN`. The
    tool prints `SECRET-SCOPE job=<outside|inside> line=<text>` for every log line containing `length-zero=`, which ALSO
    includes lines echoed from the step script (their text starts with the two characters `^[`, e.g. `^[[36;1mecho ...`), and
    finally `SECRET-SCOPE repo=<r> run=<id> url=<url> result=pass|fail` (exit 0 or 1). The run is a workflow_dispatch run of
    the helper, not a steward wrapper run (it never counts toward the steward's caps).
    scenarios/tools/run-log.sh <r> <run id> <attempt> <job> prints `LOG job=<job> ts=<timestamp> text=<text>` for one job's
    output lines (echoed script lines dropped) and a final `LOGS ...` line.

    RESULTS FILE scenarios/results/org-public.md (new, persistent, Prettier-checked). Create it with exactly this header:
      line 1: `# Scenario results: org-public`
      blank line
      one paragraph: Test-bed `steady-orchard/patch-steward-testbed-public`. Verbatim evidence from the test-bed scenario
      suite described in `../README.md`; command output is copied unchanged inside `text` fences. Sections appear in the
      order the scenarios ran.
    then the S17 section:
      `## S17 publication Environment delivers the App secrets only to Environment jobs`
      blank line; `Date (UTC): <YYYY-MM-DD>.` plus one sentence naming the run URL;
      a ```text fence with `$ bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-public` and its
      verbatim output;
      a ```text fence with `$ bash scenarios/tools/secret-scope.sh run steady-orchard/patch-steward-testbed-public` and its
      output lines EXCEPT every `SECRET-SCOPE job=... line=...` line whose text after `line=` starts with `^[` (keep the
      four exact length-zero lines, the check, DEPLOY, DISPATCH, and final lines);
      blank line; `Result: pass` (or `Result: fail` with one sentence why).
    Forbidden anywhere in the file: planning identifiers (milestone, phase, step, gate-item, owner-action or rule ids; the
    words "owner decision"; `development-artifacts`), the probe suite's App secret names (STEWARD_APP_ + ID, PRIVATE_KEY, or
    CLIENT_ID without the PATCH_ prefix), `ghs_`, `ghp_`, `-----BEGIN`, the characters `^[`, raw control characters. Call the
    Environment check "the publication Environment check".
- actions: |
    1. Base check (files changed in steps 5.1 and 5.4, plus phase 4 tools): bash -c 'for f in scenarios/tools/run-log.sh scenarios/tools/results-check.sh scenarios/tools/environment-check.sh scenarios/tools/secret-scope.sh; do [ -f "$f" ] || echo "MISSING $f"; done; [ -e scenarios/results/org-public.md ] && echo "UNEXPECTED scenarios/results/org-public.md"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile
    3. OA1 verify: bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-public
       Record the output verbatim in a report section `## OA1 verify (org-public)`. If the last line is not
       `ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public result=ok`: STOP before any write; set report status fail;
       add the line `OA1 not done on steady-orchard/patch-steward-testbed-public: <first MISMATCH line>`; create no results file.
    4. `gh api rate_limit --jq .resources.core.remaining` must print a number >= 500 (else STOP, status fail).
    5. bash scenarios/tools/secret-scope.sh run steady-orchard/patch-steward-testbed-public   (Bash tool timeout 600000)
       Record the full output in the report. If the Bash call itself times out, list `gh run list -R steady-orchard/patch-steward-testbed-public --workflow scenario-secret-scope.yml --limit 3`
       and run the same command once more (a fresh dispatch). A final `result=fail` -> record, write the results section with
       `Result: fail`, report status fail.
    6. Create scenarios/results/org-public.md per context (header + S17 section).
    7. pnpm exec prettier --write scenarios/results/org-public.md; then bash scenarios/tools/results-check.sh scenarios/results/org-public.md S17
    8. Report: include, at column 0, the line `s17_run: <the run id from DISPATCH run_id>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.7-report.md","utf8");console.log(/^s17_run: [0-9]+\s*$/m.test(s)&&!s.includes("OA1 not done")?"report ok":"report incomplete")'
       -> prints exactly: report ok
    2. bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-public | tail -n 1
       -> prints exactly: ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public result=ok
    3. run=$(grep -m1 -o '^s17_run: [0-9]*' development-artifacts/patch-steward-m6-5.7-report.md | cut -d' ' -f2); for j in outside inside; do bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public "$run" 1 $j; done | grep -c -x -E 'LOG job=outside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=true|LOG job=inside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=false'; gh run view "$run" -R steady-orchard/patch-steward-testbed-public --log | grep -c -e '-----BEGIN'
       -> prints exactly two lines: 4, 0
    4. node -e 'const s=require("fs").readFileSync("scenarios/results/org-public.md","utf8").replace(/\r/g,"").split("\n");const need=["# Scenario results: org-public","SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true","SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true","SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false","SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false","ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public result=ok"];const miss=need.filter(n=>!s.includes(n));const fin=s.some(l=>/^SECRET-SCOPE repo=steady-orchard\/patch-steward-testbed-public run=[0-9]+ url=\S+ result=pass$/.test(l));console.log(!miss.length&&fin&&s[0]===need[0]?"results ok":"results incomplete "+JSON.stringify(miss))'
       -> prints exactly: results ok
    5. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (removes the results file). The deployed helper pair stays on the test-bed's master and is
    disabled by the final steady-state step; the dispatched run is history.
