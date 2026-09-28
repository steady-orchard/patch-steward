# Step 5.35

- id: 5.35
- depends_on: [5.33]
- route: mechanical
- objective: On the personal test-bed, re-verify the publication Environment, repeat the Environment-only secret delivery check (S17) with the fixed helper pair (job inside declares `deployment: false`), prove that no publication Deployment was created since that run started, and append a post-fix S17 section to scenarios/results/personal.md.
- files_in_scope:
    - scenarios/results/personal.md
    - development-artifacts/patch-steward-m6-5.35-report.md
- context: |
    ENVIRONMENT. Git Bash; run every command from your tree root. jq is NOT installed (use `gh --jq` or node).
    core.autocrlf=true (strip CR before comparing text). gh is logged in as jambolo (user id 2095171). `gh api` endpoints
    never start with `/`. The Bash tool call times out at 600 s: pass the Bash tool timeout 600000 for secret-scope.sh.
    Poll no faster than every 20 s. Before every GitHub write check `gh api rate_limit --jq .resources.core.remaining`
    prints a number >= 500 (else STOP, status fail). Never print, log, or store a token, key, or secret (never
    `gh auth token`, never `set -x`). Never run a formatter on development-artifacts/.
    GitHub writes allowed in this step: ONLY `gh workflow enable` and `gh workflow disable` of
    scenario-secret-scope.yml and scenario-secret-scope-called.yml on R, and what `secret-scope.sh run R` does (deploy of
    the helper pair to R's master, which is a no-op because the previous step deployed identical files, and one
    workflow_dispatch). Never delete anything (issues, pull requests, branches, Deployments, files); never rerun a workflow.
    On any unexpected result: FIRST disable the two workflows again (commands in action 8), then record the evidence,
    write the results section with `Result: fail`, set report status fail, and STOP (no improvised retries or repairs).

    R = jambolo/patch-steward-testbed-personal (personal). Publication Environment check (owner action OA1; must
    hold before any run that uses the Environment): `bash scenarios/tools/environment-check.sh R` prints
    `ENVIRONMENT repo=R check=<name> expected=<e> actual=<a> ok|MISMATCH` lines and `ENVIRONMENT repo=R result=ok|incomplete`.
    Secret names only.
    State before this step: every steward and scenario workflow on R is `disabled_manually`; master holds the fixed helper
    pair (scenario-secret-scope-called.yml job inside declares `environment:` with `name: steward-publication` and
    `deployment: false`; files changed in steps 5.27 and 5.33). A disabled workflow cannot be dispatched, so this step
    enables the pair for its run and disables it afterwards (the called workflow has no trigger of its own; enabling it
    cannot start a run).
    S17 (Environment-only delivery): `bash scenarios/tools/secret-scope.sh run R` checks the pair against the product
    (`SECRET-SCOPE check=mapping identical`, `SECRET-SCOPE check=declarations identical`), deploys the pair (DEPLOY lines),
    dispatches the caller (DISPATCH lines incl. `DISPATCH run_id=<id> url=...`), waits, reads the log, prints
    `SECRET-SCOPE job=<outside|inside> line=<text>` for each log line containing `length-zero=` (this ALSO includes lines
    echoed from the step script, whose text starts with the two characters `^[`), then
    `SECRET-SCOPE repo=R run=<id> url=<url> result=pass|fail`. Pass: job outside prints
    `PATCH_STEWARD_APP_ID length-zero=true` and `PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true`; job inside both
    `length-zero=false`; no `-----BEGIN`.
    Post-fix condition (new): the test-bed shows 0 Deployments with environment steward-publication created at or after
    the run's `created_at` (an Environment job in the plain form would have created one on master), and the deployed
    called workflow declares the mapping form.
    scenarios/tools/run-log.sh R <run id> <attempt> <job> prints `LOG job=<job> ts=<timestamp> text=<text>` per output
    line of that job (echoed script lines dropped) and a final `LOGS ...` line.

    RESULTS FILE scenarios/results/personal.md (persistent, Prettier-checked; it exists and already holds an S17
    section): APPEND one section at the end; never change existing text:
      `## S17 repeated after the publication jobs declared deployment false`
      blank line; `Date (UTC): <YYYY-MM-DD>.` plus one or two sentences: the publication Environment is now declared with
      `deployment: false` in the called workflow's job inside, as in the reusable screening workflow; the run URL
      https://github.com/R/actions/runs/<id>;
      a ```text fence: `$ bash scenarios/tools/environment-check.sh jambolo/patch-steward-testbed-personal` + output;
      a ```text fence: `$ bash scenarios/tools/secret-scope.sh run jambolo/patch-steward-testbed-personal` + its
      output lines EXCEPT every `SECRET-SCOPE job=... line=...` line whose text after `line=` starts with `^[`;
      a ```text fence: the command of action 6 + its three output lines;
      a ```text fence: the command of action 7 + its one output line;
      blank line; `Result: pass` (or `Result: fail` with one sentence why just above it).
    Forbidden anywhere in the file: planning identifiers (milestone, phase, step, gate-item, owner-action or rule ids; the
    words "owner decision"; `development-artifacts`), the probe suite's App secret names (STEWARD_APP_ + ID, PRIVATE_KEY,
    or CLIENT_ID without the PATCH_ prefix), `ghs_`, `ghp_`, `-----BEGIN`, the two characters `^[`, raw control
    characters. Call the Environment check "the publication Environment check".
- actions: |
    1. Base check (files changed in step 5.33 and earlier): bash -c 'grep -q "^wrappers_deployed_at personal: " development-artifacts/patch-steward-m6-5.33-report.md 2>/dev/null || echo "MISSING 5.33 report"; d=$(gh api "repos/jambolo/patch-steward-testbed-personal/contents/.github/workflows/scenario-secret-scope-called.yml?ref=master" --jq .sha 2>/dev/null); [ "$d" = "$(git rev-parse HEAD:scenarios/workflows/scenario-secret-scope-called.yml)" ] || echo "MISSING deployed called workflow"; grep -q "      deployment: false" scenarios/workflows/scenario-secret-scope-called.yml || echo "MISSING called fix"; grep -q "^## S17 " scenarios/results/personal.md || echo "MISSING S17"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge,
       or improvise).
    2. pnpm install --frozen-lockfile
    3. Publication Environment check: bash scenarios/tools/environment-check.sh jambolo/patch-steward-testbed-personal
       Record the output verbatim in a report section `## OA1 verify (personal)`. If the last line is not
       `ENVIRONMENT repo=jambolo/patch-steward-testbed-personal result=ok`: STOP before any write; status fail; add the
       line `OA1 not done on jambolo/patch-steward-testbed-personal: <first MISMATCH line>`; append nothing.
    4. Rate limit >= 500. Enable (in this order):
       gh workflow enable scenario-secret-scope-called.yml -R jambolo/patch-steward-testbed-personal
       gh workflow enable scenario-secret-scope.yml -R jambolo/patch-steward-testbed-personal
       (If only the called workflow's enable fails, record the output and continue: the dispatch shows whether the call
       is refused.)
    5. bash scenarios/tools/secret-scope.sh run jambolo/patch-steward-testbed-personal   (Bash tool timeout 600000)
       Record the full output in the report. RUN = the id from `DISPATCH run_id=`. If the Bash call itself times out: list
       `gh run list -R jambolo/patch-steward-testbed-personal --workflow scenario-secret-scope.yml --limit 3`, wait for
       that run with `PROBE_WAIT_SECONDS=540 bash probes/smoke/tools/wait-run.sh jambolo/patch-steward-testbed-personal <run id>`,
       and read its two job logs with run-log.sh (outside, inside) instead of repeating the dispatch. A final
       `result=fail` -> action 8, record, `Result: fail`, status fail.
    6. gh api -H 'Accept: application/vnd.github.raw+json' "repos/jambolo/patch-steward-testbed-personal/contents/.github/workflows/scenario-secret-scope-called.yml?ref=master" | tr -d '\r' | grep -x -E '    environment:|      name: steward-publication|      deployment: false'
       (expected exactly three lines: `    environment:`, `      name: steward-publication`, `      deployment: false`)
    7. T=$(gh api "repos/jambolo/patch-steward-testbed-personal/actions/runs/RUN" --jq .created_at); n=$(gh api "repos/jambolo/patch-steward-testbed-personal/deployments?environment=steward-publication&per_page=100" --paginate --jq ".[] | select(.created_at >= \"$T\") | .id" | wc -l | tr -d ' '); echo "DEPLOYMENTS repo=jambolo/patch-steward-testbed-personal environment=steward-publication since=$T count=$n"
       (replace RUN; expected `... count=0`; anything else -> action 8, record, `Result: fail`, status fail)
    8. Disable (always, also after a failure once step 4 ran):
       gh workflow disable scenario-secret-scope.yml -R jambolo/patch-steward-testbed-personal
       gh workflow disable scenario-secret-scope-called.yml -R jambolo/patch-steward-testbed-personal
       then record: gh api "repos/jambolo/patch-steward-testbed-personal/actions/workflows?per_page=100" --paginate --jq '.workflows[] | select(.path | startswith(".github/workflows/scenario-secret-scope")) | (.path | ltrimstr(".github/workflows/")) + " " + .state'
    9. Append the section per context; `pnpm exec prettier --write scenarios/results/personal.md`; then
       bash scenarios/tools/results-check.sh scenarios/results/personal.md S15 S17
    10. Report: at column 0 the line `s17_postfix_run: <RUN>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.35-report.md","utf8");console.log(/^s17_postfix_run: [0-9]+\s*$/m.test(s)&&!s.includes("OA1 not done")?"report ok":"report incomplete")'
       -> prints exactly: report ok
    2. bash scenarios/tools/environment-check.sh jambolo/patch-steward-testbed-personal | tail -n 1
       -> prints exactly: ENVIRONMENT repo=jambolo/patch-steward-testbed-personal result=ok
    3. R=jambolo/patch-steward-testbed-personal; run=$(grep -m1 -o '^s17_postfix_run: [0-9]*' development-artifacts/patch-steward-m6-5.35-report.md | cut -d' ' -f2); for j in outside inside; do bash scenarios/tools/run-log.sh $R "$run" 1 $j; done | grep -c -x -E 'LOG job=outside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=true|LOG job=inside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=false'; gh run view "$run" -R $R --log | grep -c -e '-----BEGIN'; T=$(gh api "repos/$R/actions/runs/$run" --jq .created_at); gh api "repos/$R/deployments?environment=steward-publication&per_page=100" --paginate --jq ".[] | select(.created_at >= \"$T\") | .id" | wc -l | tr -d ' '
       -> prints exactly three lines: 4, 0, 0
    4. gh api -H 'Accept: application/vnd.github.raw+json' "repos/jambolo/patch-steward-testbed-personal/contents/.github/workflows/scenario-secret-scope-called.yml?ref=master" | tr -d '\r' | grep -c -x -E '    environment:|      name: steward-publication|      deployment: false'; gh api "repos/jambolo/patch-steward-testbed-personal/actions/workflows?per_page=100" --paginate --jq '.workflows[] | select(.path | startswith(".github/workflows/scenario-secret-scope")) | (.path | ltrimstr(".github/workflows/")) + " " + .state' | sort
       -> prints exactly three lines: 3, scenario-secret-scope-called.yml disabled_manually, scenario-secret-scope.yml disabled_manually
    5. node -e 'const R="jambolo/patch-steward-testbed-personal";const t=require("fs").readFileSync("scenarios/results/personal.md","utf8").replace(/\r/g,"");const secs=t.split(/^(?=## )/m).filter(s=>s.startsWith("## S17 "));const p=secs[secs.length-1]||"";const L=p.split("\n");const need=["## S17 repeated after the publication jobs declared deployment false","SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true","SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true","SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false","SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false","    environment:","      name: steward-publication","      deployment: false","Result: pass","ENVIRONMENT repo="+R+" result=ok"];const miss=need.filter(n=>!L.includes(n));const fin=L.some(l=>new RegExp("^SECRET-SCOPE repo="+R+" run=[0-9]+ url=[^ ]+ result=pass$").test(l));const dep=L.some(l=>new RegExp("^DEPLOYMENTS repo="+R+" environment=steward-publication since=[^ ]+ count=0$").test(l));console.log(secs.length===2&&!miss.length&&fin&&dep?"post-fix s17 ok":"post-fix s17 incomplete "+JSON.stringify({n:secs.length,miss,fin,dep}))'
       -> prints exactly: post-fix s17 ok
    6. bash scenarios/tools/results-check.sh scenarios/results/personal.md S15 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/personal.md result=pass
- rollback: |
    git revert <this step's commit> (results section only). The dispatched run is history; the helper pair stays deployed
    and disabled.
