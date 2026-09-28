# Step 4.6

- id: 4.6
- depends_on: []
- route: mechanical
- objective: Add three scenario tools: scenarios/tools/deploy-steward.sh (deploy the pinned wrapper copies and a policy to a test-bed), scenarios/tools/environment-check.sh (read-only check of the publication Environment), and scenarios/tools/steady-state.sh (disable steward and scenario workflows and close open scenario submissions).
- files_in_scope:
    - scenarios/tools/deploy-steward.sh
    - scenarios/tools/environment-check.sh
    - scenarios/tools/steady-state.sh
    - development-artifacts/patch-steward-m6-4.6-report.md
- context: |
    Repo root in Git Bash; run every command from your tree root. core.autocrlf=true (never anchor a grep with `$`). jq is NOT
    installed: use `gh ... --jq '<filter>'` (gh's built-in jq) or node. Git Bash runs CRLF scripts fine; the committed blobs are LF.

    scenarios/ is a new persistent directory (test-bed scenario suite for the GitHub-hosted steward; never runs in CI). Its files
    never mention planning identifiers (no milestone, phase, step, gate-item, or owner-action ids, no development-artifacts/) and
    never contain the probe suite's App secret names (the three names made of STEWARD_APP_ plus ID, PRIVATE_KEY, or CLIENT_ID
    without the PATCH_ prefix); the Environment secret names PATCH_STEWARD_APP_ID and PATCH_STEWARD_APP_PRIVATE_KEY are fine.

    Conventions for every tool (model them on probes/smoke/tools/deploy.sh and probes/smoke/tools/steady-state.sh; read both):
    - First line `#!/usr/bin/env bash`; then a header comment: one-line purpose, `Usage:` lines exactly as below, behavior,
      output line formats, exit codes. Invoked as `bash scenarios/tools/<name>.sh ...` from the repository root.
    - Only bash, gh, git, node, and coreutils (awk, sed, sort, tr, cut, wc, head, tail, mktemp, sleep, date). Never `set -x`.
    - Every output line starts with the tool's prefix and uses key=value pairs. Usage errors print `usage: <name>.sh ...` to
      stderr and exit 2.
    - Never print or read a token, key, or secret value (names and the booleans below only). Never delete anything (no
      `-X DELETE`, no `gh issue delete`, no `gh repo delete`), never force-push, never write anything but what is described.
    - Test-bed keys: org-public = steady-orchard/patch-steward-testbed-public; personal = jambolo/patch-steward-testbed-personal;
      org-private = steady-orchard/patch-steward-testbed-private. Default branch `master` on all three.
    - Before issuing GitHub writes, check `gh api rate_limit --jq .resources.core.remaining` >= 500, else print
      `<PREFIX> error=rate-limit-low remaining=<n>` and exit 1.

    Tool 1: scenarios/tools/deploy-steward.sh (prefix SCENARIO-DEPLOY)
      Usage: bash scenarios/tools/deploy-steward.sh <org-public|personal|org-private> [<policy file>]
      Default policy file: scenarios/fixtures/policies/orphan-branch.yml for org-public and personal,
      scenarios/fixtures/policies/repository-store.yml for org-private. Unknown key or wrong argument count -> usage, exit 2.
      Checks, in order, before any network call except the ones named:
      a. Both wrapper copies scenarios/workflows/steward-pr.yml and scenarios/workflows/steward-issues.yml exist, else print
         `SCENARIO-DEPLOY error=missing-wrapper file=<path>` (first missing) and exit 1. The policy file exists, else
         `SCENARIO-DEPLOY error=missing-policy file=<path>` and exit 1.
      b. Pin extraction per wrapper (CR stripped): pin = the 40 hex characters after `steward-screening.yml@` on the `uses:`
         line; ref = the 40 hex characters of the `steward_ref: '<40 hex>'` line. Each file must have exactly one of each, pin
         == ref, and both files the same pin, else `SCENARIO-DEPLOY error=pin-mismatch` and exit 1.
      c. `gh api repos/steady-orchard/patch-steward/commits/<pin> --jq .sha` prints the pin (the pinned commit is on GitHub),
         else `SCENARIO-DEPLOY error=pin-unreachable pin=<pin>` and exit 1.
      d. Rate limit check (>= 500).
      Then run:
        bash probes/smoke/tools/deploy.sh <repo> master "scenario: deploy steward wrappers and policy" scenarios/workflows/steward-pr.yml scenarios/workflows/steward-issues.yml <policy file>:.github/patch-steward/policy.yml
      (it prints DEPLOY lines, verifies blob ids, exit 0 only when all three files are identical on master). Finally print
      `SCENARIO-DEPLOY repo=<repo> pin=<pin> policy=<policy file> result=ok` and exit 0, or `... result=failed` and exit 1 when
      deploy.sh failed.

    Tool 2: scenarios/tools/environment-check.sh (prefix ENVIRONMENT; read-only)
      Usage: bash scenarios/tools/environment-check.sh <owner/repo>
      Runs these read-only commands (exactly these gh invocations) and compares each output literally with its expectation:
        environment-secrets:   gh api repos/<r>/environments/steward-publication/secrets --jq '[.secrets[].name] | sort'
                               expected ["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"]
        deployment-branches:   gh api repos/<r>/environments/steward-publication/deployment-branch-policies --jq '[.branch_policies[].name]'
                               expected ["master"]
        repository-secrets:    gh api repos/<r>/actions/secrets --jq '[.secrets[].name | select(startswith("PATCH_STEWARD_"))]'
                               expected []
        organization-secrets:  only when the owner is steady-orchard:
                               gh api repos/<r>/actions/organization-secrets --jq '[.secrets[].name | select(startswith("PATCH_STEWARD_"))]'
                               expected []
      Per check one line: `ENVIRONMENT repo=<r> check=<name> expected=<expected> actual=<actual> ok` or `... MISMATCH`, where
      actual is the command's stdout (one line) or `error:<first stderr line>` when gh fails. Final line `ENVIRONMENT repo=<r>
      result=ok` (exit 0) when every check is ok, else `ENVIRONMENT repo=<r> result=incomplete` (exit 1). These print secret
      NAMES only, never values.

    Tool 3: scenarios/tools/steady-state.sh (prefix SCENARIO-STEADY)
      Usage: bash scenarios/tools/steady-state.sh <owner/repo> plan|apply
      Workflows in scope: those whose path is .github/workflows/steward-pr.yml, .github/workflows/steward-issues.yml, or starts
      with .github/workflows/scenario- (read with `gh api "repos/<r>/actions/workflows?per_page=100" --paginate --jq ...`).
      Submissions in scope: open issues and open pull requests whose title starts with `[scenario S` (read with `gh issue list
      -R <r> --state open --limit 500 --json number,title` and `gh pr list ...` plus a --jq filter).
      plan: read-only; prints `SCENARIO-STEADY <r> workflow <file> <state> keep` (state disabled_manually) or `... would-disable`,
      and `SCENARIO-STEADY <r> issue <n> would-close` / `SCENARIO-STEADY <r> pr <n> would-close`.
      apply: FIRST disables every in-scope workflow not in state disabled_manually (`gh api -X PUT
      repos/<r>/actions/workflows/<file>/disable`; line `... disabled` or `... FAILED <one-line detail>`; a failure for
      scenario-secret-scope-called.yml, which has no trigger of its own, prints `... keep-called` and does not count as active),
      THEN closes each in-scope open issue or PR (`gh issue close <n> -R <r>` / `gh pr close <n> -R <r>`; lines `... closed` or
      `... FAILED`), sleeping 1 s between writes, then re-reads both sets. Workflows are disabled before submissions are closed
      so closing triggers no run.
      Final line: `SCENARIO-STEADY <r> result=planned|steady|not-steady active_workflows=<n> open_submissions=<m>` (active
      excludes scenario-secret-scope-called.yml). Exit 0 for plan, or apply that ends with 0 active and 0 open; 1 not steady;
      2 usage; 3 a read failed (line `SCENARIO-STEADY <r> result=read-failed what=<workflows or submissions>`).
- actions: |
    1. Write the three scripts per context.
    2. Run `bash -n` on each and fix syntax errors. Do not run deploy-steward.sh against a test-bed except as in acceptance 3
       (which stops before any write because the wrapper copies do not exist yet), and never run steady-state.sh apply.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. for f in deploy-steward environment-check steady-state; do bash -n scenarios/tools/$f.sh && echo "$f syntax ok"; done
       -> prints exactly three lines: deploy-steward syntax ok, environment-check syntax ok, steady-state syntax ok
    2. for c in "deploy-steward.sh" "deploy-steward.sh nowhere" "environment-check.sh" "steady-state.sh steady-orchard/patch-steward-testbed-public" "steady-state.sh steady-orchard/patch-steward-testbed-public destroy"; do bash scenarios/tools/$c > /dev/null 2>&1; echo "exit $?"; done
       -> prints exactly five lines, each: exit 2
    3. ls scenarios/workflows/steward-pr.yml 2> /dev/null; bash scenarios/tools/deploy-steward.sh org-public; echo "exit $?"
       -> prints exactly two lines: SCENARIO-DEPLOY error=missing-wrapper file=scenarios/workflows/steward-pr.yml, then exit 1
    4. bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-public; echo "exit $?"
       -> prints exactly six lines: four `ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=<name> expected=<e> actual=<e> ok` lines for environment-secrets, deployment-branches, repository-secrets, organization-secrets (in that order), then `ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public result=ok`, then `exit 0`
    5. bash scenarios/tools/environment-check.sh jambolo/patch-steward-testbed-personal | grep -c "check=organization-secrets"
       -> prints exactly: 0
    6. bash scenarios/tools/steady-state.sh steady-orchard/patch-steward-testbed-public plan > "${TMPDIR:-/tmp}/m6-steady.txt"; echo "exit $?"; tail -1 "${TMPDIR:-/tmp}/m6-steady.txt" | grep -c -E '^SCENARIO-STEADY steady-orchard/patch-steward-testbed-public result=planned active_workflows=[0-9]+ open_submissions=[0-9]+'; rm -f "${TMPDIR:-/tmp}/m6-steady.txt"
       -> prints exactly two lines: exit 0, then 1
    7. git grep --untracked -n -E -e '-X DELETE' -e 'issue delete' -e 'repo delete' -e '--force' -e 'set -x' -e 'auth token' -- scenarios/tools/deploy-steward.sh scenarios/tools/environment-check.sh scenarios/tools/steady-state.sh
       -> no output (exit 1)
    8. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- scenarios
       -> no output (exit 1)
    9. git grep --untracked -n -P 'development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' -- scenarios/tools
       -> no output (exit 1)
    10. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/tools/deploy-steward.sh scenarios/tools/environment-check.sh scenarios/tools/steady-state.sh
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the three scripts; nothing was written to any test-bed).
