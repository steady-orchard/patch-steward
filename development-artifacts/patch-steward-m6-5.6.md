# Step 5.6

- id: 5.6
- depends_on: [5.1, 5.2, 5.3, 5.4, 5.5]
- route: mechanical
- objective: Update scenarios/README.md so it documents the new scenario tools, helper workflow, and fixtures, the refined scenario procedures, and the results-file format, and corrects the find-runs.sh description.
- files_in_scope:
    - scenarios/README.md
    - development-artifacts/patch-steward-m6-5.6-report.md
- context: |
    Git Bash; run every command from your tree root. core.autocrlf=true. Never run a formatter on development-artifacts/.
    No GitHub access in this step.

    scenarios/README.md is a PERSISTENT, Prettier-checked document (printWidth 132, prose is not re-wrapped; blank line after
    every heading and around lists; fenced code blocks name a language, `text` when none applies). It must never contain
    planning identifiers: no milestone, phase, step, gate-item, owner-action, or rule ids (for example no letters-plus-digit
    ids such as the Environment-check or steady-state rule codes), no `development-artifacts`, no step or phase numbers, no
    "owner decision"; never the probe suite's App secret names (write "the probe suite's App secrets"); no raw control, bidi,
    or zero-width characters. Describe only what exists. Keep every existing section and all correct text; edit in place.

    Files added by steps 5.1-5.5 (read their header comments for exact usage; do not change them):
      - scenarios/tools/run-log.sh <owner/repo> <run id> <attempt> <job>: prints `LOG job=<job> ts=<timestamp> text=<text>`
        for one job of a run attempt (echoed script lines dropped, credentials withheld), then a `LOGS` summary line.
      - scenarios/tools/await-runs.sh <owner/repo> <workflow file> <display title prefix> <after run id> <min count>: waits
        (20 s polls, PROBE_WAIT_SECONDS, default 540) until at least <min count> newer runs with that title prefix completed.
      - scenarios/tools/run-records.sh runs|metrics ...: read-only key fields of run directories, supersession records, and
        metrics files (outcome, waiting state and reason, policy revision, snapshot, finding codes, closure resolutions), from
        a store branch or a local store root.
      - scenarios/tools/app-edit.sh <owner/repo> <issue|pr> <number> title <new title> | close: deploys and dispatches the
        helper workflow scenarios/workflows/scenario-app-edit.yml, which edits the title or closes the submission with an
        installation token of the test App (so the event sender is the App's bot user); it runs only for the allowlisted
        user, takes the App credentials from the publication Environment, prints only HTTP status codes, and revokes its token.
      - scenarios/tools/pins.sh <owner/repo>: read-only static check of the deployed wrappers and the pinned reusable
        workflow (blob identity, pin equality and reachability, only gate and publish declare the Environment and reference
        the two secrets, explicit secrets mapping, no probe secret names, every uses pinned by a resolvable 40-hex SHA).
      - scenarios/tools/results-check.sh <results file> <scenario id>...: every listed scenario has sections that all end
        `Result: pass`, the file holds no forbidden text, and it is Prettier-clean.
      - scenarios/tools/evidence.sh now verifies waiting run directories against their manifest (it no longer reports them
        unverified). scenarios/tools/find-runs.sh lists runs of any status (the README says "completed"; fix it).
      - scenarios/fixtures/policies/invalid-limit.yml (daily run cap above its hard bound: invalid), unwritable-store.yml
        (separate store repository steady-orchard/patch-steward-testbed-unwritable, which does not exist), caps-daily.yml
        (daily cap 1, per-author cap 20), caps-author.yml (daily cap 1000, per-author cap 1).
      - scenarios/fixtures/pull-requests/steward-pr-modified.yml: the wrapper with a changed name and run-name, committed by
        the policy-and-wrapper pull requests as their proposed .github/workflows/steward-pr.yml.
    Contract-met submission bodies come from the shared corpus: fixtures/submissions/defect-complete.txt (issue) and
    fixtures/submissions/pr-chore.txt (pull request); unstructured bodies from scenarios/fixtures/submissions/unstructured.txt.

    Required README content changes:
      1. Layout: list scenarios/workflows/scenario-app-edit.yml, the four policy variants, fixtures/pull-requests/, and the
         results files.
      2. Safety rules: add the App edit helper rule (allowlisted user only, Environment credentials, status codes only,
         token revoked) and: a policy variant stays deployed for one scenario only and is restored with deploy-steward.sh
         after every run of that scenario completed (publish reads the default-branch policy again for its freshness check).
      3. Tools: add the six new tools (usage line and one-sentence purpose each); update the find-runs.sh and evidence.sh
         entries as above.
      4. Procedures (edit each section's text; keep its pass condition meaning):
         S03 uses app-edit.sh (title). S04: the second body edit is made right after the older run's gate job completes, so
         the older run's publish sees a newer owner or a changed snapshot. S05: three body edits back to back; runs whose
         gate captured an unchanged snapshot end duplicate; the newest committed owner publishes. S06 deploys
         invalid-limit.yml. S07 deploys unwritable-store.yml and edits a pull request that already has an owner, so the gate
         never reads the separate store. S09: a same-repository branch and a fork branch each commit steward-pr-modified.yml
         as .github/workflows/steward-pr.yml and caps-daily.yml as .github/patch-steward/policy.yml, with the body
         fixtures/submissions/pr-chore.txt. S10: the close by the App (app-edit.sh close) gives closed-by-maintainer; the
         merged pull request targets base branch scenario-s10-base. S11: caps-daily.yml, then caps-author.yml, with
         contract-met issues. S12 re-runs the S00 run. S13 uses audit.sh, S14 pins.sh. S15 and S16 use
         fixtures/submissions/defect-complete.txt.
      5. A short section headed exactly `## Results`: one file per test-bed; each scenario section is headed `## S<nn> <short title>` (a
         scenario may have several sections), holds commands and verbatim output in `text` fences, and ends with a line
         `Result: pass` or `Result: fail`; check a file with results-check.sh.
- actions: |
    1. Base check (files changed in steps 5.1-5.5): bash -c 'for f in scenarios/tools/run-log.sh scenarios/tools/await-runs.sh scenarios/tools/run-records.sh scenarios/tools/app-edit.sh scenarios/workflows/scenario-app-edit.yml scenarios/tools/pins.sh scenarios/tools/results-check.sh scenarios/fixtures/policies/invalid-limit.yml scenarios/fixtures/policies/unwritable-store.yml scenarios/fixtures/policies/caps-daily.yml scenarios/fixtures/policies/caps-author.yml scenarios/fixtures/pull-requests/steward-pr-modified.yml; do [ -f "$f" ] || echo "MISSING $f"; done; grep -q "kind=waiting manifest=" scenarios/tools/evidence.sh || echo "MISSING evidence.sh waiting check"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile
    3. Edit scenarios/README.md per context.
    4. pnpm exec prettier --write scenarios/README.md (README only; never development-artifacts/), then run acceptance 1-4.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. pnpm exec prettier --check scenarios/README.md > /dev/null 2>&1; echo "exit $?"
       -> prints exactly: exit 0
    2. node -e 'const s=require("fs").readFileSync("scenarios/README.md","utf8");const need=["run-log.sh","await-runs.sh","run-records.sh","app-edit.sh","pins.sh","results-check.sh","scenario-app-edit.yml","invalid-limit.yml","unwritable-store.yml","caps-daily.yml","caps-author.yml","steward-pr-modified.yml","defect-complete.txt","pr-chore.txt","scenario-s10-base","closed-by-maintainer","find-runs.sh","evidence.sh","audit.sh","secret-scope.sh","steady-state.sh","deploy-steward.sh"];const miss=need.filter(n=>!s.includes(n));const res=/Result:\s+pass/.test(s)&&/^## Results\s*$/m.test(s);const bad=/lists completed|List completed/.test(s);console.log(!miss.length&&res&&!bad?"readme ok":"readme incomplete "+JSON.stringify({miss,res,bad}))'
       -> prints exactly: readme ok
    3. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b|(?i:\bphase [0-9]|\bstep [0-9]+\.[0-9]+)' -- scenarios/README.md; echo "exit $?"
       -> prints exactly: exit 1
    4. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/README.md
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (README only).
