- status: pass
- base: 937e51a7a59e9e7237b19c29ced20f6592d0988c
- changes: |
    scenarios/tools/pins.sh:
    - Replaced the reusable-workflow fetch block with a PINS_SCREENING_FILE override: when the env
      var is set and non-empty, reads and CR-strips the local file instead of fetching at the pin
      (missing file -> fail_read "screening-file", exit 3); sets screening_source=pinned|local.
    - Rewrote the check-4 job_info awk program to classify each job's environment declaration as
      exactly the mapping form (name: steward-publication + deployment: false, no extra child line,
      no string form) vs any other form (string form, or a mapping missing/adding a child line);
      emits MAP|job|0-1 and OTHER|job|0-1 alongside the existing SEC|job|0-1 lines.
    - env_list now sourced from MAP rows; added other_list sourced from OTHER rows.
    - Check 4 condition now requires env_list == "gate,publish" AND other_list empty AND no
      wrapper environment: string; detail is now "jobs=<...|none> other_form=<...|none>".
    - Replaced the final result block to add a " screening=local" suffix before " result=" when
      screening_source=local.
    - Updated the header comment to document the mapping-form requirement and the
      PINS_SCREENING_FILE override/screening=local marker; removed no other comment lines.
    Checks 1-3, 5-8, exit codes, and all other output left unchanged.
- acceptance: |
    $ bash -n scenarios/tools/pins.sh; echo "syntax $?"
    syntax 0

    $ T=$(mktemp -d); git show 7161cd20df662314d14cc7f2f4130102baee1e98:.github/workflows/steward-screening.yml > "$T/string.yml"; node -e '...' "$T"; for v in string mapping name-only; do PINS_SCREENING_FILE="$T/$v.yml" bash scenarios/tools/pins.sh steady-orchard/patch-steward-testbed-public > "$T/$v.out"; grep ' check=environment-jobs ' "$T/$v.out"; done; cat "$T"/*.out | grep -c -E '^PINS repo=steady-orchard/patch-steward-testbed-public pin=[0-9a-f]{40} screening=local result=(pass|fail)$'; rm -rf "$T"
    PINS repo=steady-orchard/patch-steward-testbed-public check=environment-jobs FAIL jobs=none other_form=gate,publish
    PINS repo=steady-orchard/patch-steward-testbed-public check=environment-jobs ok jobs=gate,publish other_form=none
    PINS repo=steady-orchard/patch-steward-testbed-public check=environment-jobs FAIL jobs=none other_form=gate,publish
    3

    $ PINS_SCREENING_FILE=/nonexistent/steward-screening.yml bash scenarios/tools/pins.sh steady-orchard/patch-steward-testbed-public; echo "exit $?"
    PINS repo=steady-orchard/patch-steward-testbed-public error=read-failed what=screening-file
    exit 3

    $ bash scenarios/tools/pins.sh steady-orchard/patch-steward-testbed-public | grep -c -E '^PINS repo=steady-orchard/patch-steward-testbed-public check=(wrapper-blobs|pin-equal|pin-reachable|environment-jobs|secret-jobs|wrapper-mapping|probe-names|uses-pinned) (ok|FAIL)( |$)'
    8

    $ git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|owner decision' -- scenarios/tools/pins.sh; echo "exit $?"
    exit 1
- deviations: none
