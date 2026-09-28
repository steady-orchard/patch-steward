# Step 5.5

- id: 5.5
- depends_on: []
- route: mechanical
- objective: Add the scenario fixture files derived from the existing test-bed policy and wrapper copy: four policy variants (invalid limit, unwritable separate store, daily-cap, per-author-cap) and a modified pull request wrapper used as the proposed change of a pull request.
- files_in_scope:
    - scenarios/fixtures/policies/invalid-limit.yml
    - scenarios/fixtures/policies/unwritable-store.yml
    - scenarios/fixtures/policies/caps-daily.yml
    - scenarios/fixtures/policies/caps-author.yml
    - scenarios/fixtures/pull-requests/steward-pr-modified.yml
    - development-artifacts/patch-steward-m6-5.5-report.md
- context: |
    Git Bash; run every command from your tree root. core.autocrlf=true (working-tree files may be CRLF; the generator strips
    CR and writes LF). Never run a formatter on development-artifacts/. No GitHub access in this step.

    Purpose of each file (all derived byte-for-byte from existing files, changing only the named lines):
      - invalid-limit.yml = scenarios/fixtures/policies/orphan-branch.yml with `    daily_runs: 50` changed to
        `    daily_runs: 1001` (above the hard bound 1000; the CLI reports `policy.limit-out-of-bounds`). Deployed briefly to a
        test-bed to prove a gate that cannot load a valid policy fails before commitment.
      - unwritable-store.yml = orphan-branch.yml with the evidence store line `    type: orphan-branch` replaced by the two
        lines `    type: repository` and `    repository: steady-orchard/patch-steward-testbed-unwritable` (a repository
        that does not exist and that the App cannot write; valid policy). Proves a failed publish publishes nothing.
      - caps-daily.yml = orphan-branch.yml with `    daily_runs: 50` -> `    daily_runs: 1` and
        `    per_author_concurrent_runs: 2` -> `    per_author_concurrent_runs: 20` (daily cap 1, per-author cap at its bound).
      - caps-author.yml = orphan-branch.yml with `    daily_runs: 50` -> `    daily_runs: 1000` and
        `    per_author_concurrent_runs: 2` -> `    per_author_concurrent_runs: 1`.
      - pull-requests/steward-pr-modified.yml = scenarios/workflows/steward-pr.yml with line 1 `name: steward-pr` ->
        `name: steward-pr-modified-by-pull-request` and the `run-name: ...` line -> `run-name: modified steward pr ${{
        github.event.pull_request.number }}` (on one line). A pull request commits it as `.github/workflows/steward-pr.yml` to
        show the default-branch definition, not this one, governs the run (a run named after it would reveal otherwise).
    All five are valid YAML and Prettier-clean when generated exactly this way (verified by the decomposer). scenarios/ is
    persistent: no planning identifiers; never the probe suite's App secret names.
- actions: |
    1. (No dependency.) Confirm the sources exist: `ls scenarios/fixtures/policies/orphan-branch.yml scenarios/workflows/steward-pr.yml`.
    2. Generate the five files (run exactly this from the tree root):
       node -e 'const fs=require("fs");const r=f=>fs.readFileSync(f,"utf8").replace(/\r/g,"");const o=r("scenarios/fixtures/policies/orphan-branch.yml");const w=r("scenarios/workflows/steward-pr.yml");const out={"scenarios/fixtures/policies/invalid-limit.yml":o.replace("    daily_runs: 50\n","    daily_runs: 1001\n"),"scenarios/fixtures/policies/caps-daily.yml":o.replace("    daily_runs: 50\n    per_author_concurrent_runs: 2\n","    daily_runs: 1\n    per_author_concurrent_runs: 20\n"),"scenarios/fixtures/policies/caps-author.yml":o.replace("    daily_runs: 50\n    per_author_concurrent_runs: 2\n","    daily_runs: 1000\n    per_author_concurrent_runs: 1\n"),"scenarios/fixtures/policies/unwritable-store.yml":o.replace("    type: orphan-branch\n","    type: repository\n    repository: steady-orchard/patch-steward-testbed-unwritable\n"),"scenarios/fixtures/pull-requests/steward-pr-modified.yml":w.replace(/^name: steward-pr\n/,"name: steward-pr-modified-by-pull-request\n").replace(/^run-name: .*\n/m,"run-name: modified steward pr ${{ github.event.pull_request.number }}\n")};fs.mkdirSync("scenarios/fixtures/pull-requests",{recursive:true});for(const [f,t] of Object.entries(out)){if(t===o||t===w)throw new Error("unchanged "+f);fs.writeFileSync(f,t);console.log("wrote "+f)}'
    3. pnpm install --frozen-lockfile && pnpm build (the CLI validates the policies in acceptance 2).
    4. Run acceptance 1-4 and record verbatim outputs in the report.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. node -e 'const fs=require("fs");const r=f=>fs.readFileSync(f,"utf8").replace(/\r/g,"");const o=r("scenarios/fixtures/policies/orphan-branch.yml");const w=r("scenarios/workflows/steward-pr.yml");const want={"scenarios/fixtures/policies/invalid-limit.yml":o.replace("    daily_runs: 50\n","    daily_runs: 1001\n"),"scenarios/fixtures/policies/caps-daily.yml":o.replace("    daily_runs: 50\n    per_author_concurrent_runs: 2\n","    daily_runs: 1\n    per_author_concurrent_runs: 20\n"),"scenarios/fixtures/policies/caps-author.yml":o.replace("    daily_runs: 50\n    per_author_concurrent_runs: 2\n","    daily_runs: 1000\n    per_author_concurrent_runs: 1\n"),"scenarios/fixtures/policies/unwritable-store.yml":o.replace("    type: orphan-branch\n","    type: repository\n    repository: steady-orchard/patch-steward-testbed-unwritable\n"),"scenarios/fixtures/pull-requests/steward-pr-modified.yml":w.replace(/^name: steward-pr\n/,"name: steward-pr-modified-by-pull-request\n").replace(/^run-name: .*\n/m,"run-name: modified steward pr ${{ github.event.pull_request.number }}\n")};const bad=Object.entries(want).filter(([f,t])=>!fs.existsSync(f)||r(f)!==t||t===o||t===w).map(([f])=>f);console.log(bad.length?"DIFFERENT "+bad.join(" "):"fixtures ok")'
       -> prints exactly: fixtures ok
    2. for p in caps-daily caps-author unwritable-store invalid-limit; do node packages/cli/dist/main.js policy --file scenarios/fixtures/policies/$p.yml > /dev/null 2>&1; echo "$p exit $?"; done; node packages/cli/dist/main.js policy --file scenarios/fixtures/policies/invalid-limit.yml 2>&1 | grep -c '^error policy.limit-out-of-bounds limits.caps.daily_runs'
       -> prints exactly five lines: caps-daily exit 0, caps-author exit 0, unwritable-store exit 0, invalid-limit exit 1, 1
    3. pnpm exec prettier --check scenarios/fixtures > /dev/null 2>&1; echo "prettier $?"; actionlint scenarios/fixtures/pull-requests/steward-pr-modified.yml; echo "actionlint $?"
       -> prints exactly two lines: prettier 0, actionlint 0
    4. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' -- scenarios/fixtures; echo "exit $?"
       -> prints exactly: exit 1
- rollback: |
    git revert <this step's commit> (fixtures only; nothing deployed).
