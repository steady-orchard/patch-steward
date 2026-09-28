- status: pass
- base: 4c1a2d8ff527cbeffeb16c940f42901f2f2709c3
- changes: |
    Created scenarios/tools/find-runs.sh (lists completed runs of a workflow by display-title prefix,
    oldest first, prefix RUN/RUNS), scenarios/tools/artifacts.sh (lists artifacts matching a name exactly
    with creation/expiry info, prefix ARTIFACT/ARTIFACTS), and scenarios/tools/audit.sh (observe-mode
    audit of scenario issues and pull requests for App writes: comments, labels, check runs, requested
    reviewers, deployments; prefix AUDIT). All three are read-only (GET only via gh run list/issue
    list/pr list/api without -X), use only bash/gh/node/coreutils, never print titles/bodies/tokens, and
    follow the header-comment convention modeled on probes/smoke/tools/wait-run.sh and steady-state.sh.
- acceptance: |
    for f in find-runs artifacts audit; do bash -n scenarios/tools/$f.sh && echo "$f syntax ok"; done
    find-runs syntax ok
    artifacts syntax ok
    audit syntax ok

    for c in "find-runs.sh" "find-runs.sh steady-orchard/patch-steward-testbed-public probe-pa09-listen.yml" "artifacts.sh steady-orchard/patch-steward-testbed-public" "artifacts.sh steady-orchard/patch-steward-testbed-public bad/name" "audit.sh"; do bash scenarios/tools/$c > /dev/null 2>&1; echo "exit $?"; done
    exit 2
    exit 2
    exit 2
    exit 2
    exit 2

    bash scenarios/tools/find-runs.sh steady-orchard/patch-steward-testbed-public probe-pa09-listen.yml 'probe-pa09 issues sub=29 ' > "${TMPDIR:-/tmp}/m6-runs.txt"; echo "exit $?"; node -e "..." "${TMPDIR:-/tmp}/m6-runs.txt"; rm -f "${TMPDIR:-/tmp}/m6-runs.txt"
    exit 0
    runs ok

    bash scenarios/tools/find-runs.sh steady-orchard/patch-steward-testbed-public no-such-workflow.yml 'x'; echo "exit $?"
    RUNS repo=steady-orchard/patch-steward-testbed-public workflow=no-such-workflow.yml error=list-failed
    exit 1

    bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public probe-pa02-retention-90; echo "exit $?"
    ARTIFACT id=10841874867 name=probe-pa02-retention-90 created_at=2026-09-25T01:26:11Z expires_at=2026-12-24T01:26:05Z expired=false run_id=36081988862 size=254
    ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=probe-pa02-retention-90 count=1 unexpired=1
    exit 0

    bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public; echo "exit $?"
    AUDIT repo=steady-orchard/patch-steward-testbed-public submissions=0 app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 result=clean
    exit 0

    bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public '[probe PA07]' > "${TMPDIR:-/tmp}/m6-audit.txt"; echo "exit $?"; grep -c ...; tail -1 ... | grep -c ...; rm -f ...
    exit 1
    9
    1

    git grep --untracked -n -E -e ' -X ' -e 'issue (close|delete|edit|create|comment)' -e 'pr (close|edit|create|comment|merge)' -e 'set -x' -e 'auth token' -e '\.body' -- scenarios/tools/find-runs.sh scenarios/tools/artifacts.sh scenarios/tools/audit.sh
    (no output, exit 1)

    git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' -- scenarios/tools/find-runs.sh scenarios/tools/artifacts.sh scenarios/tools/audit.sh
    (no output, exit 1)

    node -e "... control/bidi/zero-width char scan ..." scenarios/tools/find-runs.sh scenarios/tools/artifacts.sh scenarios/tools/audit.sh
    clean
- deviations: |
    artifacts.sh: gh api does not support a --arg flag (jq's own --arg, distinct from gh's --jq passthrough
    options), so the validated artifact name (already constrained to ^[A-Za-z0-9._-]{1,100}$ before use) is
    interpolated directly into the --jq select expression instead of being passed as a jq variable; no
    injection risk given the prior validation.
