- status: pass
- base: 4c1a2d8ff527cbeffeb16c940f42901f2f2709c3
- changes: |
    Added scenarios/tools/deploy-steward.sh (prefix SCENARIO-DEPLOY): validates both wrapper copies and the policy
    file exist, extracts and cross-checks the 40-hex pin/ref on both wrappers, confirms the pin is reachable on
    steady-orchard/patch-steward, checks the rate limit >= 500, then delegates to probes/smoke/tools/deploy.sh.
    Added scenarios/tools/environment-check.sh (prefix ENVIRONMENT, read-only): runs the four specified gh api
    invocations against environment-secrets, deployment-branches, repository-secrets (always) and
    organization-secrets (only when owner is steady-orchard), comparing literal output to expectation.
    Added scenarios/tools/steady-state.sh (prefix SCENARIO-STEADY): plan/apply over workflows at
    .github/workflows/steward-pr.yml, .github/workflows/steward-issues.yml, and .github/workflows/scenario-*, and
    open issues/PRs titled "[scenario S...]"; apply disables workflows before closing submissions, sleeps 1s between
    writes, treats a disable failure on scenario-secret-scope-called.yml as keep-called (not counted active), and
    re-reads both sets afterward.
- acceptance: |
    1. for f in deploy-steward environment-check steady-state; do bash -n scenarios/tools/$f.sh && echo "$f syntax ok"; done
       deploy-steward syntax ok
       environment-check syntax ok
       steady-state syntax ok

    2. for c in "deploy-steward.sh" "deploy-steward.sh nowhere" "environment-check.sh" "steady-state.sh steady-orchard/patch-steward-testbed-public" "steady-state.sh steady-orchard/patch-steward-testbed-public destroy"; do bash scenarios/tools/$c > /dev/null 2>&1; echo "exit $?"; done
       exit 2
       exit 2
       exit 2
       exit 2
       exit 2

    3. ls scenarios/workflows/steward-pr.yml 2> /dev/null; bash scenarios/tools/deploy-steward.sh org-public; echo "exit $?"
       SCENARIO-DEPLOY error=missing-wrapper file=scenarios/workflows/steward-pr.yml
       exit 1

    4. bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-public; echo "exit $?"
       ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=environment-secrets expected=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] actual=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] ok
       ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=deployment-branches expected=["master"] actual=["master"] ok
       ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=repository-secrets expected=[] actual=[] ok
       ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=organization-secrets expected=[] actual=[] ok
       ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public result=ok
       exit 0

    5. bash scenarios/tools/environment-check.sh jambolo/patch-steward-testbed-personal | grep -c "check=organization-secrets"
       0

    6. bash scenarios/tools/steady-state.sh steady-orchard/patch-steward-testbed-public plan > /tmp/m6-steady.txt; echo "exit $?"; tail -1 /tmp/m6-steady.txt | grep -c -E '^SCENARIO-STEADY steady-orchard/patch-steward-testbed-public result=planned active_workflows=[0-9]+ open_submissions=[0-9]+'; rm -f /tmp/m6-steady.txt
       exit 0
       1

    7. git grep --untracked -n -E -e '-X DELETE' -e 'issue delete' -e 'repo delete' -e '--force' -e 'set -x' -e 'auth token' -- scenarios/tools/deploy-steward.sh scenarios/tools/environment-check.sh scenarios/tools/steady-state.sh
       (no output, rc=1)

    8. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- scenarios
       (no output, rc=1)

    9. git grep --untracked -n -P 'development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' -- scenarios/tools
       (no output, rc=1)

    10. node -e "..." scenarios/tools/deploy-steward.sh scenarios/tools/environment-check.sh scenarios/tools/steady-state.sh
        clean
- deviations: none
