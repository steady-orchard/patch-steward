- status: pass
- base: 690b55adbd802c43ae248f92f7c64c8cbcc8b4e5
- changes: |
    - scenarios/workflows/scenario-app-edit.yml: created by extracting the FILE BLOCK from
      development-artifacts/patch-steward-m6-5.3.md verbatim with the node extraction command from
      actions step 2 (byte-exact, confirmed by acceptance 1).
    - scenarios/tools/app-edit.sh: created per context (header comment in the style of
      scenarios/tools/secret-scope.sh, `set -uo pipefail`, output prefix APP-EDIT). Validates
      owner/repo, kind, number, and the title/close operation shapes before any network call,
      checks `gh api rate_limit`, deploys via probes/smoke/tools/deploy.sh, dispatches via
      probes/smoke/tools/dispatch.sh, parses `gh run view --log` third-tab-separated field
      (stripping a leading BOM via String.fromCharCode(65279) and the leading timestamp token),
      and reports pass/failed/still-running per spec. Never run with valid arguments (no GitHub
      write made by this step).
- acceptance: |
    1. node -e "...verbatim check..." scenarios/workflows/scenario-app-edit.yml
       -> verbatim ok
    2. actionlint scenarios/workflows/scenario-app-edit.yml; echo "exit $?"
       -> exit 0
    3. pnpm exec prettier --check scenarios/workflows/scenario-app-edit.yml > /dev/null 2>&1; echo "exit $?"
       -> exit 0
    4. bash -n scenarios/tools/app-edit.sh; echo "exit $?"
       -> exit 0
    5. for a in "" "x/y issue 1" "x/y bug 1 close" "x/y issue 0 close" "x/y pr 1 title" "x/y pr 1 title untagged" "x/y pr 1 close extra" "x/y pr 1 rename t" "bad issue 1 close"; do bash scenarios/tools/app-edit.sh $a > /dev/null 2>&1; echo "exit $?"; done
       -> exit 2 (x9)
    6. node -e "...run block clean check..."; grep -c 'secrets\.' scenarios/workflows/scenario-app-edit.yml; grep -c '^    environment: steward-publication' scenarios/workflows/scenario-app-edit.yml
       -> run block clean
          2
          1
    7. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b|set -x|auth token|--force' -- scenarios/workflows/scenario-app-edit.yml scenarios/tools/app-edit.sh; echo "exit $?"
       -> exit 1 (no matches)
    8. node -e "...control/bidi/zero-width character scan..." scenarios/workflows/scenario-app-edit.yml scenarios/tools/app-edit.sh
       -> clean
- deviations: |
    First draft of the log-parsing node one-liner in app-edit.sh used a literal U+FEFF character
    embedded via the file-write tool instead of the String.fromCharCode(65279) construction named
    in context; acceptance check 8 caught it (BAD scenarios/tools/app-edit.sh). Rewrote the line to
    use String.fromCharCode(65279) as specified; re-ran acceptance 4 and 8, both now pass. No other
    deviations; app-edit.sh was never run with valid arguments, so no GitHub write occurred.
