# Step 5.24

- id: 5.24
- depends_on: [5.37, 5.35, 5.36, 5.28, 5.29]
- route: mechanical
- objective: On all three test-beds, after the publication Environment fix, run the observe-mode audit (S13, with the recorded before-fix Deployments listed separately) and the static pin and Environment check (S14, mapping form with `deployment: false`), record both in each results file, then put every test-bed into the documented steady state (steward and scenario workflows disabled, no open scenario submission, probe leftovers kept) and record it.
- files_in_scope:
    - scenarios/results/org-public.md
    - scenarios/results/personal.md
    - scenarios/results/org-private.md
    - development-artifacts/patch-steward-m6-5.24-report.md
- context: |
    ENVIRONMENT. Git Bash; run every command from your tree root. jq is NOT installed (use `gh --jq` or node).
    core.autocrlf=true (strip CR before comparing text). gh is logged in as jambolo (user id 2095171). `gh api` endpoints
    never start with `/` (Git Bash rewrites them). Before every GitHub write check
    `gh api rate_limit --jq .resources.core.remaining` prints a number >= 500 (else STOP, status fail). Never print, log, or
    store a token, key, or secret (never `gh auth token`, never `set -x`). Never run a formatter on development-artifacts/.
    The ONLY GitHub writes of this step are the ones `steady-state.sh <repo> apply` makes (disable in-scope workflows that
    are not disabled, then close open scenario issues and pull requests); everything else is read-only. Never enable a
    workflow; never delete an issue, pull request, branch, Deployment, deployment status, or file; never touch
    `.github/workflows/scenario-deployment-probe.yml` or branch `scenario-deployment-probe` (they stay); never touch
    org-public issue 29 or pull requests 26 and 27; never rerun a workflow.
    On any unexpected result: collect the evidence named in actions, record it, write the section with `Result: fail`,
    set report status fail, and STOP (no improvised retries or repairs).

    Test-beds and results files:
      org-public   steady-orchard/patch-steward-testbed-public   scenarios/results/org-public.md
      personal     jambolo/patch-steward-testbed-personal         scenarios/results/personal.md
      org-private  steady-orchard/patch-steward-testbed-private   scenarios/results/org-private.md
    State before this step: the reusable workflow's gate and publish declare `environment:` with
    `name: steward-publication` and `deployment: false` (pushed commit PIN = the SHA after `steward-screening.yml@` in
    scenarios/workflows/steward-pr.yml); the wrappers pinning PIN and the fixed helper workflows are deployed on the three
    test-beds (step 5.33); every steward and scenario workflow is `disabled_manually`; S17 was repeated on each test-bed
    (steps 5.34-5.36); on org-public the S13 post-fix pull request (number in the `s13_pr:` line of
    development-artifacts/patch-steward-m6-5.37-report.md) is OPEN, with exactly two runs at PIN and 0 head Deployments.
    Before PIN, GitHub Actions created one Deployment per Environment job of every pull_request_target run on the pull
    request head: org-public pull requests 32: 2, 33: 2, 34: 28, 36: 4, 37: 4 (40), environment steward-publication,
    creator jambolo or patch-steward-testbed[bot], all created before the fixed wrappers were deployed. They stay forever.

    Tools (read-only unless marked):
      audit.sh <repo>: first line `AUDIT repo=<r> wrappers_deployed_at=<T> source=history` (T = committer date of the newest
        master commit that changed .github/workflows/steward-pr.yml, i.e. the fixed wrappers' deploy); per issue
        `AUDIT repo=<r> kind=issue number=<n> app_comments=<a> labels=<l> app_check_runs=n/a requested_reviewers=n/a head_deployments=n/a before_fix_deployments=n/a`;
        per pull request `AUDIT repo=<r> kind=pr number=<n> app_comments=<a> labels=<l> app_check_runs=<c> requested_reviewers=<v> head_deployments=<counted> before_fix_deployments=<b>`
        followed by one `AUDIT-DEPLOYMENT repo=<r> pr=<n> id=<id> environment=<env> ref=<ref> creator=<login> created_at=<t> class=before-fix|counted`
        line per deployment on its head (before-fix = steward-publication, creator 2095171 or 331019482, created before T);
        last line `AUDIT repo=<r> submissions=<n> app_comments=<a> labels=<l> app_check_runs=<c> requested_reviewers=<v> head_deployments=<counted> before_fix_deployments=<b> result=clean|writes-found`.
      pins.sh <repo>: eight `PINS repo=<r> check=<name> ok|FAIL ...` lines (environment-jobs detail
        `jobs=<mapping-form jobs> other_form=<other-form jobs>`), then `PINS repo=<r> pin=<sha> result=pass|fail`.
      steady-state.sh <repo> plan|apply (apply = WRITE): disables every workflow whose path is steward-pr.yml,
        steward-issues.yml, or starts with scenario- (scenario-secret-scope-called.yml may stay active) that is not
        already disabled, then closes every open issue or pull request titled `[scenario S...` (with the workflows
        disabled, closing starts no run); prints SCENARIO-STEADY lines and finally
        `SCENARIO-STEADY <r> result=steady active_workflows=0 open_submissions=0` (apply) or `result=planned ...` (plan).
      results-check.sh <file> <ids...>: last line `RESULTS-CHECK file=<file> result=pass`.
    Scenario S13 pass on a test-bed: the audit's last line has app_comments, labels, app_check_runs, requested_reviewers,
    head_deployments all 0 and `result=clean`; on org-public additionally before_fix_deployments=40 with per pull request
    32: 2, 33: 2, 34: 28, 36: 4, 37: 4 and head_deployments=0 each, every AUDIT-DEPLOYMENT line `class=before-fix` with
    environment=steward-publication, creator jambolo or patch-steward-testbed[bot], created_at earlier than T, and the S13
    post-fix pull request line `head_deployments=0 before_fix_deployments=0`. personal and org-private have no scenario
    pull request (before_fix_deployments=0). Scenario S14 pass: `PINS ... pin=<PIN> result=pass` and
    `check=environment-jobs ok jobs=gate,publish other_form=none`.
    Steady state: apply ends `result=steady active_workflows=0 open_submissions=0`; the evidence branches, the evidence
    repository, the policies, the Environments, the wrapper and helper files (disabled), the closed scenario submissions,
    every Deployment, and on org-public `scenario-deployment-probe.yml` (disabled) and branch `scenario-deployment-probe`
    stay (nothing is deleted).

    Each results file (persistent, Prettier-checked; APPEND only, never change existing text) gets three new sections at
    the end, in this order:
      `## S13 observe mode writes nothing on submissions`: blank line; `Date (UTC): <YYYY-MM-DD>.` plus one to three
        sentences (org-public: the deployments listed `before-fix` are the ones GitHub Actions created on the heads of pull
        requests 32, 33, 34, 36, and 37 while the publication jobs declared the Environment without `deployment: false`,
        before the fixed wrappers were deployed at T; they are kept, never deleted; the pull request screened only after
        that has none. personal, org-private: this test-bed has no scenario pull request); a ```text fence with
        `$ bash scenarios/tools/audit.sh <repo>` and its COMPLETE verbatim output (every AUDIT and AUDIT-DEPLOYMENT line);
        blank line; `Result: pass` (or `Result: fail` with one sentence why).
      `## S14 only gate and publish use the publication Environment; everything is pinned`: Date line and one sentence; a
        ```text fence with `$ bash scenarios/tools/pins.sh <repo>` and its output; a ```text fence with the command of
        action 3c and its output; blank line; `Result: pass` (or fail).
      `## Steady state`: Date line and one sentence; ```text fences with the apply output, the plan output, the workflow
        list of action 4, and (org-public only) the three probe-leftover lines of action 4; NO Result line.
    Forbidden anywhere in the files: planning identifiers (milestone, phase, step, gate-item, owner-action or rule ids;
    "owner decision"; `development-artifacts`), the probe suite's App secret names (STEWARD_APP_ + ID, PRIVATE_KEY, or
    CLIENT_ID without the PATCH_ prefix), `ghs_`, `ghp_`, `-----BEGIN`, the characters `^[`, raw control characters.
- actions: |
    1. Base check (files changed in steps 5.28, 5.29, 5.34-5.37): bash -c 'grep -q "^s13_pr: [0-9]" development-artifacts/patch-steward-m6-5.37-report.md 2>/dev/null || echo "MISSING 5.37 report"; grep -q "^## S13 post-fix pull request leaves no deployment" scenarios/results/org-public.md || echo "MISSING S13 post-fix"; for f in org-public personal org-private; do [ "$(grep -c "^## S17 " scenarios/results/$f.md)" = 2 ] || echo "MISSING post-fix S17 $f"; done; grep -q "^## S15 " scenarios/results/personal.md || echo "MISSING S15"; grep -q "^## S16 " scenarios/results/org-private.md || echo "MISSING S16"; grep -q "other_form=" scenarios/tools/pins.sh || echo "MISSING pins"; grep -q "before_fix_deployments" scenarios/tools/audit.sh || echo "MISSING audit"; for f in scenarios/tools/steady-state.sh scenarios/tools/results-check.sh; do [ -f "$f" ] || echo "MISSING $f"; done; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge,
       or improvise).
    2. pnpm install --frozen-lockfile; rate limit >= 500. PIN = the SHA after `steward-screening.yml@` in
       scenarios/workflows/steward-pr.yml.
    3. For each test-bed r (org-public, personal, org-private), record:
       a. bash scenarios/tools/audit.sh r
       b. bash scenarios/tools/pins.sh r
       c. gh api -H 'Accept: application/vnd.github.raw+json' "repos/steady-orchard/patch-steward/contents/.github/workflows/steward-screening.yml?ref=PIN" | tr -d '\r' | grep -n -E '^  [a-z]+:$|^    environment|^      (name|deployment): '
          (expected nine lines: `  build:`, `  gate:`, `    environment:`, `      name: steward-publication`,
          `      deployment: false`, `  publish:`, and the same three environment lines, each with its line-number prefix)
       Check the S13 and S14 pass conditions of context against these outputs.
    4. For each test-bed r: bash scenarios/tools/steady-state.sh r apply (must end `result=steady active_workflows=0 open_submissions=0`;
       otherwise run it once more; still not steady -> record, status fail), then
       bash scenarios/tools/steady-state.sh r plan
       gh api "repos/r/actions/workflows?per_page=100" --paginate --jq '.workflows[] | select(.path == ".github/workflows/steward-pr.yml" or .path == ".github/workflows/steward-issues.yml" or (.path | startswith(".github/workflows/scenario-"))) | (.path | ltrimstr(".github/workflows/")) + " " + .state'
       org-public only, the probe leftovers (read-only):
       gh api repos/steady-orchard/patch-steward-testbed-public/branches/scenario-deployment-probe --jq .name
       gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github/workflows/scenario-deployment-probe.yml?ref=master" --jq .sha
       gh api repos/steady-orchard/patch-steward-testbed-public/actions/workflows/scenario-deployment-probe.yml --jq .state
       (expected: scenario-deployment-probe, 5e8c1ed1c01cbc8f219b188b291c3334d3fec229, disabled_manually)
    5. Append the three sections to each results file per context (each file gets ITS test-bed's outputs); run
       `pnpm exec prettier --write` on the three results files only; then:
       bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S13 S14 S17
       bash scenarios/tools/results-check.sh scenarios/results/personal.md S13 S14 S15 S17
       bash scenarios/tools/results-check.sh scenarios/results/org-private.md S13 S14 S16 S17
    6. Report: the outputs of 3 and 4 verbatim; at column 0 the line `pin: <PIN>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/audit.sh $r | tail -n 1; done | sed -E 's/ submissions=[1-9][0-9]* / submissions=N /'
       -> prints exactly three lines:
          AUDIT repo=steady-orchard/patch-steward-testbed-public submissions=N app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 before_fix_deployments=40 result=clean
          AUDIT repo=jambolo/patch-steward-testbed-personal submissions=N app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 before_fix_deployments=0 result=clean
          AUDIT repo=steady-orchard/patch-steward-testbed-private submissions=N app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 before_fix_deployments=0 result=clean
    2. P=$(grep -m1 -o '^s13_pr: [0-9]*' development-artifacts/patch-steward-m6-5.37-report.md | cut -d' ' -f2); bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public | node -e 'const L=require("fs").readFileSync(0,"utf8").replace(/\r/g,"").split("\n").filter(Boolean);const P=process.argv[1];const R="steady-orchard/patch-steward-testbed-public";const m=/^AUDIT repo=\S+ wrappers_deployed_at=([0-9TZ:-]{20}) source=history$/.exec(L[0]);const want={32:2,33:2,34:28,36:4,37:4};want[P]=0;const bad=[];if(!m)bad.push("first");for(const [n,c] of Object.entries(want)){if(!L.some(l=>new RegExp("^AUDIT repo="+R+" kind=pr number="+n+" app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 before_fix_deployments="+c+"$").test(l)))bad.push("pr"+n)}const D=L.filter(l=>l.startsWith("AUDIT-DEPLOYMENT "));const okD=D.filter(l=>{const x=/^AUDIT-DEPLOYMENT repo=\S+ pr=(32|33|34|36|37) id=[0-9]+ environment=steward-publication ref=\S+ creator=(jambolo|patch-steward-testbed\[bot\]) created_at=(\S+) class=before-fix$/.exec(l);return x&&m&&x[3]<m[1]});if(D.length!==40||okD.length!==40)bad.push("deployments "+D.length+"/"+okD.length);console.log(bad.length?"split wrong "+bad.join(","):"deployments split ok")' "$P"
       -> prints exactly: deployments split ok
    3. pin=$(tr -d '\r' < scenarios/workflows/steward-pr.yml | grep -oE 'steward-screening\.yml@[0-9a-f]{40}' | cut -d@ -f2); for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/pins.sh $r; done | grep -c -E "^PINS repo=\S+ pin=$pin result=pass\$|^PINS repo=\S+ check=environment-jobs ok jobs=gate,publish other_form=none\$"
       -> prints exactly: 6
    4. for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/steady-state.sh $r plan | tail -n 1; gh api "repos/$r/actions/workflows?per_page=100" --paginate --jq '.workflows[] | select(.path == ".github/workflows/steward-pr.yml" or .path == ".github/workflows/steward-issues.yml" or (.path | startswith(".github/workflows/scenario-"))) | (.path | ltrimstr(".github/workflows/")) + " " + .state' | grep -v -E '^scenario-secret-scope-called\.yml ' | grep -v -c ' disabled_manually$'; done
       -> prints exactly six lines: SCENARIO-STEADY steady-orchard/patch-steward-testbed-public result=planned active_workflows=0 open_submissions=0, 0, SCENARIO-STEADY jambolo/patch-steward-testbed-personal result=planned active_workflows=0 open_submissions=0, 0, SCENARIO-STEADY steady-orchard/patch-steward-testbed-private result=planned active_workflows=0 open_submissions=0, 0
    5. R=steady-orchard/patch-steward-testbed-public; gh api repos/$R/branches/scenario-deployment-probe --jq .name; gh api "repos/$R/contents/.github/workflows/scenario-deployment-probe.yml?ref=master" --jq .sha; gh api repos/$R/actions/workflows/scenario-deployment-probe.yml --jq .state
       -> prints exactly three lines: scenario-deployment-probe, 5e8c1ed1c01cbc8f219b188b291c3334d3fec229, disabled_manually
    6. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S13 S14 S17 | tail -n 1; bash scenarios/tools/results-check.sh scenarios/results/personal.md S13 S14 S15 S17 | tail -n 1; bash scenarios/tools/results-check.sh scenarios/results/org-private.md S13 S14 S16 S17 | tail -n 1
       -> prints exactly three lines: RESULTS-CHECK file=scenarios/results/org-public.md result=pass, RESULTS-CHECK file=scenarios/results/personal.md result=pass, RESULTS-CHECK file=scenarios/results/org-private.md result=pass
    7. for f in org-public personal org-private; do grep -c -E '^(## Steady state|AUDIT repo=\S+ submissions=[0-9]+ .*result=clean|PINS repo=\S+ pin=[0-9a-f]{40} result=pass|SCENARIO-STEADY \S+ result=steady active_workflows=0 open_submissions=0|[0-9]+:      deployment: false)' scenarios/results/$f.md; done; grep -c -E '^AUDIT-DEPLOYMENT .* class=before-fix' scenarios/results/org-public.md
       -> prints exactly four lines: 6, 6, 6, 40
- rollback: |
    git revert <this step's commit> (results sections only). To leave the steady state, re-enable workflows with
    `gh workflow enable <file> -R <repo>` (only if a later scenario must run). Closed submissions and Deployments stay.
