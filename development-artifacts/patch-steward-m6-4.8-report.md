- status: pass
- base: 4c1a2d8ff527cbeffeb16c940f42901f2f2709c3
- changes: |
    Added scenarios/tools/evidence.sh: read-only tool that verifies an evidence store branch
    (remote mode via gh api + a temp clone with core.autocrlf=false, removed by an EXIT trap;
    or local mode reading a given store root directly), checks every store commit only adds
    files (EVIDENCE append_only=yes|no), then walks the run directory of one submission
    (<store root>/<target>/runs/<kind>-<number>), printing EVIDENCE lines per run (waiting vs.
    outcome, the latter verified via `node packages/cli/dist/main.js report --json`), per
    supersession record, and a final EVIDENCE summary line with exit 0/1/2/3 per spec.
- acceptance: |
    1. bash -n scenarios/tools/evidence.sh && echo "syntax ok"
       -> syntax ok

    2. for c in "" "a/b steward-evidence a/b issue" "a/b steward-evidence a/b bug 1" "a/b steward-evidence a/b issue 01" "--local /tmp a/b pr"; do bash scenarios/tools/evidence.sh $c > /dev/null 2>&1; echo "exit $?"; done
       -> exit 2
       exit 2
       exit 2
       exit 2
       exit 2

    3. pnpm build > /dev/null; bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 29; echo "exit $?"
       -> EVIDENCE store=steady-orchard/patch-steward-testbed-public branch=steward-evidence state=absent
       exit 0

    4. bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-evidence develop steady-orchard/patch-steward-testbed-private issue 1 > "${TMPDIR:-/tmp}/m6-ev.txt"; echo "exit $?"; node -e "..." "${TMPDIR:-/tmp}/m6-ev.txt"; rm -f "${TMPDIR:-/tmp}/m6-ev.txt"
       -> exit 0
       remote ok

    5. bash -c 'T=$(mktemp -d); GH_TOKEN=$(gh auth token) node packages/cli/dist/main.js screen --issue 29 --repo steady-orchard/patch-steward-testbed-public --policy-file templates/policy/policy.yml --evidence-dir "$T" > /dev/null 2>&1; bash scenarios/tools/evidence.sh --local "$T" steady-orchard/patch-steward-testbed-public issue 29; echo "exit $?"; rm -rf "$T"' | sed -E 's/^EVIDENCE run=[^ ]+ /EVIDENCE run=X /'
       -> EVIDENCE run=X kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
       EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=issue-29 runs=1 verified=1 result=ok
       exit 0

    6. git grep --untracked -n -E -e 'git push' -e ' -X ' -e 'set -x' -e 'auth token' -- scenarios/tools/evidence.sh
       -> (no output, exit 1)

    7. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' -- scenarios/tools/evidence.sh
       -> (no output, exit 1)

    8. node -e "...control/bidi/zero-width scan..." scenarios/tools/evidence.sh
       -> clean
- deviations: none
