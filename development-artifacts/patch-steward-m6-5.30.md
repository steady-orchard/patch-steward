# Step 5.30

- id: 5.30
- depends_on: []
- route: mechanical
- objective: Update scenarios/README.md for the publication Environment declared with `deployment: false`: the declaration rule, the audit and pins tool changes, the procedure after a steward fix, the repeated S13 and S17 procedures, the S14 condition, the corrected S10 wording, and what stays on the test-beds.
- files_in_scope:
    - scenarios/README.md
    - development-artifacts/patch-steward-m6-5.30-report.md
- context: |
    Git Bash; run every command from your tree root. core.autocrlf=true. jq is NOT installed. No network; no GitHub
    request. Never run a formatter on development-artifacts/.

    scenarios/README.md is a PERSISTENT, Prettier-checked document (Prettier: printWidth 132; markdown prose is not
    re-wrapped by Prettier, so wrap your own lines at about 116 characters like the existing text). It must NEVER contain
    planning identifiers: no milestone, phase, or step numbers (`phase 5`, `step 5.24`), no ids such as D7, OW1, SC3, S-row
    gate names other than the scenario ids S00-S17, no words "owner decision", no `development-artifacts`, no `DF` ids or
    `deferred.md`. It refers to the probe suite's App secrets only as "the probe suite's App secrets" (never their names).
    Keep every existing section and heading; edit in place; no new top-level heading is required.

    Facts to document (all binding):
    F1 Declaration rule. The reusable screening workflow's jobs gate and publish, and every scenario workflow job that
       declares the publication Environment (job inside of scenario-secret-scope-called.yml, job edit of
       scenario-app-edit.yml), declare it as the mapping `name: steward-publication` plus `deployment: false`. In the plain
       form `environment: steward-publication`, GitHub Actions records a Deployment for each Environment job of a run; for a
       `pull_request_target` run that Deployment sits on the pull request head. With `deployment: false` the Environment
       secrets and the Environment's branch restriction (default branch only) still apply and no Deployment is created.
    F2 audit.sh (new behavior). For each scenario pull request it lists every deployment on the head commit as an
       `AUDIT-DEPLOYMENT` line (id, environment, ref, creator, created_at, class) and classifies it: `before-fix` when
       GitHub Actions created it for `steward-publication` for the allowlisted user (2095171) or the test App's bot user
       (331019482) before the current wrappers were deployed, otherwise `counted`. The wrappers' deployment time is the
       committer date of the newest `master` commit that changed `.github/workflows/steward-pr.yml` (first output line
       `wrappers_deployed_at=`), or the value of `AUDIT_WRAPPERS_DEPLOYED_AT` (UTC `YYYY-MM-DDTHH:MM:SSZ`). The summary line
       carries `head_deployments` (counted only) and `before_fix_deployments`; only counted deployments, App comments,
       labels, App check runs, and review requests make the result `writes-found`.
    F3 pins.sh (new behavior). The environment check passes only when gate and publish declare `steward-publication` in the
       mapping form with `deployment: false` and no job declares an Environment in any other form (detail
       `jobs=... other_form=...`). `PINS_SCREENING_FILE=<path>` checks a local copy of the reusable workflow instead of the
       pinned one; the final line then carries `screening=local`.
    F4 After a steward fix (add to Setup as a short paragraph or numbered items): push the fix commit to the milestone
       branch without force; regenerate the wrapper copies with that commit as the pin; redeploy the wrappers with
       `deploy-steward.sh` and every changed helper workflow with `probes/smoke/tools/deploy.sh`; deploying a file does
       not change whether its workflow is enabled; enable only the workflows a scenario needs with
       `gh workflow enable <file> -R <owner/repo>` and disable them again when it ends (the steady state keeps them
       disabled).
    F5 S10 wording fix: the scenario closes the S10 ISSUE with the test App (`app-edit.sh` close; closed-by-maintainer),
       not a pull request. Replace the current text "close a pull request by the test App (`app-edit.sh` close), which gives
       closed-by-maintainer" with wording that says the issue is closed by the author, reopened, then closed by the test App
       (`app-edit.sh` close), which gives closed-by-maintainer; pull requests: one closed by the author, one merged into
       `scenario-s10-base`. The phrase "close a pull request by the test App" must not remain.
    F6 S13 procedure (replace the current S13 text): all test-beds. On org-public, after the publication jobs declare
       `deployment: false` and the wrappers pinning that version are deployed: enable `steward-pr.yml`, open one pull
       request `[scenario S13] post-fix deployment check` from branch `scenario-s13-head` (created from `master` with
       `probes/smoke/tools/deploy.sh`) with `fixtures/submissions/unstructured.txt` as body, wait for its run, edit the body
       once, wait for the second run, disable `steward-pr.yml`. Then audit every scenario submission on every test-bed with
       `audit.sh`. Pass condition: App-authored comments, labels, App check runs on head SHAs, requested reviewers, and
       counted deployments all 0; the new pull request had exactly two wrapper runs, both calling the fixed reusable
       workflow commit, with gate and publish successful, and its head has no deployment; the deployments GitHub Actions
       created on the heads of org-public pull requests 32, 33, 34, 36, and 37 while the publication jobs used the plain
       form (2, 2, 28, 4, and 4) are listed as `before-fix`, all for `steward-publication` by the allowlisted user or the
       test App's bot user, created before the fixed wrappers were deployed; none is deleted.
    F7 S14 pass condition: only gate and publish declare `steward-publication`, both in the mapping form with
       `deployment: false` (no job in another form), and only they reference the two secrets; no probe suite secret name
       appears; every `uses` is pinned by a 40-hex SHA reachable on GitHub; `steward_ref` equals the pin.
    F8 S17 addition: repeated on every test-bed after the change (enable `scenario-secret-scope.yml` and
       `scenario-secret-scope-called.yml` for the run, disable them after): job inside of the deployed called workflow
       declares the mapping form with `deployment: false`; the same four length-zero lines; and the test-bed shows no
       `steward-publication` deployment created at or after the repeated run's creation time. The first S17 sections stay
       as recorded; the repeated run gets its own S17 section.
    F9 Steady state "What stays" (extend the existing paragraph): also every Deployment and deployment status on the
       test-beds, including those GitHub Actions created on the heads of org-public pull requests 32, 33, 34, 36, and 37
       while the publication jobs used the plain form (never deleted); and on org-public the one-off check workflow
       `.github/workflows/scenario-deployment-probe.yml` (disabled; it showed that `deployment: false` keeps the
       Environment secrets and the branch restriction and creates no Deployment) and its branch
       `scenario-deployment-probe`. The `scenario-*` disable rule covers that workflow.
    F10 Layout bullet for the secret-scope pair and the Tools bullets for `audit.sh` and `pins.sh`: extend them to say F1
       (pair job inside uses the mapping form), F2, and F3 in one or two sentences each.
- actions: |
    1. Read scenarios/README.md fully. Apply F1-F10 in place: F1 as a new bullet under "## Safety rules"; F10 and F2, F3 in
       "## Layout" and "## Tools"; F4 in "## Setup"; F5 in "### S10"; F6 replaces the body of "### S13"; F7 replaces the
       pass condition of "### S14"; F8 appended to "### S17"; F9 in "## Steady state". Use backticks for file names,
       workflow names, keys, and literal values, as the existing text does.
    2. pnpm install --frozen-lockfile; `pnpm exec prettier --write scenarios/README.md` (only this file); run the
       acceptance commands.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. pnpm exec prettier --check scenarios/README.md > /dev/null 2>&1; echo "prettier $?"
       -> prints exactly: prettier 0
    2. node -e 'const s=require("fs").readFileSync("scenarios/README.md","utf8").replace(/\r/g,"").replace(/\s+/g," ");const need=["deployment: false","name: steward-publication","before-fix","AUDIT-DEPLOYMENT","wrappers_deployed_at","AUDIT_WRAPPERS_DEPLOYED_AT","PINS_SCREENING_FILE","screening=local","other_form","gh workflow enable","[scenario S13] post-fix deployment check","scenario-s13-head","pull requests 32, 33, 34, 36, and 37","scenario-deployment-probe.yml","branch `scenario-deployment-probe`","scenario-secret-scope-called.yml","closed-by-maintainer"];const miss=need.filter(n=>!s.includes(n));const bad=["close a pull request by the test App"].filter(n=>s.includes(n));const heads=["## Layout","## Safety rules","## Tools","## Setup","### S10","### S13","### S14","### S17","## Results","## Steady state"].filter(h=>!s.includes(h));console.log(!miss.length&&!bad.length&&!heads.length?"readme ok":"readme incomplete "+JSON.stringify({miss,bad,heads}))'
       -> prints exactly: readme ok
    3. git grep -n -P 'development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA|D)[0-9]{1,2}\b|(?i)\bphase [0-9]|(?i)\bstep [0-9]+\.[0-9]+|(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|DF[0-9]{2}|deferred\.md' -- scenarios/README.md; echo "exit $?"
       -> prints exactly: exit 1
    4. node -e 'const s=require("fs").readFileSync("scenarios/README.md","utf8");const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c!==13&&R.some(([a,b])=>c>=a&&c<=b))bad++}console.log(bad?"dirty "+bad:"clean")'
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (documentation only).
