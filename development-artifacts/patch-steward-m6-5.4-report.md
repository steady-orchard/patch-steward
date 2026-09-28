- status: pass
- base: 690b55adbd802c43ae248f92f7c64c8cbcc8b4e5
- changes: |
    Added scenarios/tools/pins.sh: read-only static check of a test-bed's deployed steward-pr.yml
    and steward-issues.yml against the local scenarios/workflows copies (blob-id equality),
    extraction and reachability of the pinned steward-screening.yml commit, job-structure checks
    (environment gating on gate/publish only, secret usage on gate/publish only), the wrapper
    secrets-mapping block, absence of literal probe secret names, and resolution of every pinned
    `uses:` reference. Prints eight PINS check lines plus a final PINS result line; exit 0/1/2/3
    per spec.
    Added scenarios/tools/results-check.sh: checks a scenario results file for per-id section
    pass/fail (CR-stripped, `## S##` headers), a fixed-order hygiene scan (leaked-token markers,
    escape marker, probe secret name pattern, planning-reference patterns, raw control/bidi/
    zero-width characters), and `pnpm exec prettier --check`. Section/hygiene logic implemented in
    a Node script written to a mktemp -d (removed on exit trap) and invoked from the shell wrapper;
    prints exactly four RESULTS-CHECK lines; exit 0/1/2 per spec.
- acceptance: |
    1. (three-repo PINS run + pin/result/exit counts)
       $ pin=$(tr -d '\r' < scenarios/workflows/steward-pr.yml | grep -oE 'steward-screening\.yml@[0-9a-f]{40}' | cut -d@ -f2); T=$(mktemp -d); for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/pins.sh $r; echo "exit $?"; done > "$T/o.txt"; grep -c -E '^PINS repo=[^ ]+ check=(wrapper-blobs|pin-equal|pin-reachable|environment-jobs|secret-jobs|wrapper-mapping|probe-names|uses-pinned) ok' "$T/o.txt"; grep -c -E "^PINS repo=[^ ]+ pin=$pin result=pass" "$T/o.txt"; grep -c '^exit 0' "$T/o.txt"; rm -rf "$T"
       24
       3
       3
       (matches expected exactly)

    2. (usage/read-failure cases)
       $ bash scenarios/tools/pins.sh jambolo/patch-steward-testbed-public; echo "exit $?"; for a in "" "x" "a/b c/d"; do bash scenarios/tools/pins.sh $a > /dev/null 2>&1; echo "exit $?"; done
       PINS repo=jambolo/patch-steward-testbed-public error=read-failed what=steward-pr.yml
       exit 3
       exit 2
       exit 2
       exit 2
       (matches expected exactly)

    3. (results-check.sh synthetic scenarios via node harness)
       $ node -e '...(six cases: good, missing, failed, planning, probe, prettier)...'
       results-check ok

    4. (results-check.sh usage errors)
       $ for a in "" "scenarios/README.md" "scenarios/no-such.md S01" "scenarios/README.md S1" "scenarios/README.md s01"; do bash scenarios/tools/results-check.sh $a > /dev/null 2>&1; echo "exit $?"; done
       exit 2
       exit 2
       exit 2
       exit 2
       exit 2
       (matches expected exactly)

    5. (forbidden-text / planning-identifier grep over the new tools)
       $ git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b|set -x|auth token' -- scenarios/tools/pins.sh scenarios/tools/results-check.sh; echo "exit $?"
       exit 1
       (matches expected exactly)

    6. (raw control/bidi/zero-width character scan of the two tool files)
       $ node -e "...control-character range scan..." scenarios/tools/pins.sh scenarios/tools/results-check.sh
       clean
       (matches expected exactly)
- deviations: |
    Step 1 (pnpm install --frozen-lockfile) was already run before this packet, per instructions;
    re-ran it implicitly via no-op (not re-invoked, already satisfied). All other actions performed
    as written. One implementation refinement not specified verbatim in context: the initial draft
    of pins.sh treated any non-empty stdout from `gh api` as success, which mis-scored a 404 error
    body (GitHub returns a JSON error body with `status: "404"` and a non-zero gh exit code) as a
    successful pin-extraction failure instead of a read failure; fixed by also checking the `gh`
    exit code for every fetch, which was necessary to satisfy acceptance 2's exact expected output
    (`error=read-failed what=steward-pr.yml`) for the workflow-less fork.
