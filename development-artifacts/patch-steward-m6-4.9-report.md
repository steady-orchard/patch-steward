- status: pass
- base: eaada422b4371829712a41a87a78e441cc62c519
- changes: |
    Added scenarios/workflows/scenario-secret-scope.yml and scenarios/workflows/scenario-secret-scope-called.yml, extracted
    byte-exact from the FILE BLOCKS in development-artifacts/patch-steward-m6-4.9.md via the node extraction command in
    actions step 2.
    Added scenarios/tools/secret-scope.sh: header comment in the style of probes/smoke/tools/deploy.sh; `block()` helper
    implementing the awk extraction over CR-stripped input; `check` compares the secrets: block of the scenario caller
    against templates/workflows/steward-pr.yml (mapping) and the scenario called workflow against
    .github/workflows/steward-screening.yml (declarations), printing SECRET-SCOPE check=... lines and exiting 0 only when
    both are identical, else printing SECRET-SCOPE error=missing-file file=<path> and exiting 1 for a missing input; `run
    <owner/repo>` runs check, checks the GitHub API rate limit, deploys the pair via probes/smoke/tools/deploy.sh, dispatches
    via probes/smoke/tools/dispatch.sh, parses `gh run view --log` tab-separated output for length-zero markers per job
    (outside/inside) and the BEGIN count, and reports pass/fail; not run in this step per instruction. Usage errors print to
    stderr and exit 2. No `set -x`, no secret values printed.
- acceptance: |
    node -e "...verbatim ok check..." scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml
    verbatim ok

    actionlint -ignore 'could not read reusable workflow file' scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml; echo "exit $?"
    exit 0

    pnpm exec prettier --check scenarios
    Checking formatting...
    All matched files use Prettier code style!
    exit 0

    bash -n scenarios/tools/secret-scope.sh && bash scenarios/tools/secret-scope.sh check; echo "exit $?"
    SECRET-SCOPE check=mapping identical
    SECRET-SCOPE check=declarations identical
    exit 0

    for c in "" "run" "deploy x/y" "check extra"; do bash scenarios/tools/secret-scope.sh $c > /dev/null 2>&1; echo "exit $?"; done
    exit 2
    exit 2
    exit 2
    exit 2

    git grep --untracked -n -E -e 'set -x' -e 'auth token' -e '--force' -- scenarios/tools/secret-scope.sh
    (no output, exit 1)

    git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' -- scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml scenarios/tools/secret-scope.sh
    (no output, exit 1)

    node -e "...clean-character-check..." scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml scenarios/tools/secret-scope.sh
    clean

    Base check (actions step 1): node -e "...base check..."
    base ok
- deviations: none
