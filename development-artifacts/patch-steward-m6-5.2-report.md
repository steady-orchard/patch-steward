- status: pass
- base: 690b55adbd802c43ae248f92f7c64c8cbcc8b4e5
- changes: |
    scenarios/tools/run-records.sh: new script. Validates arguments (mode runs|metrics, --local vs
    remote, owner/repo, pr|issue, number, run-directory shape) before any network call. Remote mode
    reads the branch tip via `gh api`, treats HTTP 404 as absent (prints only the final RECORDS or
    METRICS summary line, exit 0), other gh failures as `<PREFIX> error=read-failed` (exit 1),
    shallow-clones the branch (failure -> `<PREFIX> error=clone-failed`, exit 1). Local mode checks
    the given directory exists (missing -> `<PREFIX> error=store-root-missing`, exit 1; store=local,
    branch=none in output). Delegates the actual read/print logic to two inline `node -e` scripts
    (runs_js, metrics_js) passed via `--` argv: runs mode reads run.json/decision.json/waiting.json/
    findings/*.json per run directory (sorted numerically by run id then attempt) and
    supersessions/*.json (sorted by name); metrics mode reads each month's
    `<run>.json`/`<run>-supersession.json` event arrays in order and formats state-transition,
    maintainer-resolution, and other event kinds per spec. A thrown exception in either script ->
    `<PREFIX> error=parse-failed`, exit 1.

    scenarios/tools/evidence.sh: replaced the waiting-run branch. It now runs an inline `node -e`
    script that reads manifest.json, checks `run_kind === "waiting"`, recursively lists the run
    directory's files (excluding manifest.json), compares that sorted list against both the
    manifest's listed paths and the fixed expected set (logs/steward.txt, policy-revision.json,
    run.json, submission.json, waiting.json), then verifies every listed file's sha256 against its
    bytes; any exception yields "failed". Prints `EVIDENCE run=<name> kind=waiting
    manifest=verified|failed` and counts a verified waiting run toward `verified`. Updated the
    header comment's run-check bullet to describe outcome vs. waiting-manifest verification instead
    of only reporting kind=waiting. No other line format or behavior changed.
- acceptance: |
    (all run from tree root in Git Bash; pnpm install --frozen-lockfile && pnpm build already done)

    1. node -e '...local mock store round-trip for runs/metrics...'
       -> local ok

    2. bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 31 | grep -c -E '...'
       -> 2

    3. bash scenarios/tools/run-records.sh metrics steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public 36397673122-1 | grep -c -E '...'
       -> 6

    4. bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public no-such-branch steady-orchard/patch-steward-testbed-public issue 31; echo "exit $?"
       -> RECORDS store=steady-orchard/patch-steward-testbed-public branch=no-such-branch target=steady-orchard/patch-steward-testbed-public subject=issue-31 runs=0 supersessions=0
          exit 0

    5. for a in "" "runs" "runs x/y b x/y issue" "runs x/y b x/y bug 1" "metrics x/y b x/y 12" "runs --local /nonexistent x/y issue 0" "other x/y b x/y 1-1"; do bash scenarios/tools/run-records.sh $a > /dev/null 2>&1; echo "exit $?"; done
       -> exit 2 (x7)

    6. node -e '...evidence.sh waiting-manifest verify/tamper round-trip...'
       -> waiting ok

    7. bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 31 | grep -c -E '...'
       -> 3

    8. git grep --untracked -n -P '...' -- scenarios/tools/run-records.sh scenarios/tools/evidence.sh; echo "exit $?"; node -e "...control-char scan..." scenarios/tools/run-records.sh scenarios/tools/evidence.sh
       -> exit 1
          clean

    `bash -n` passed for both scripts before running acceptance.
- deviations: |
    None in behavior or scope. Implementation note: the record/metrics traversal and formatting
    logic for run-records.sh lives in two inline `node -e` heredoc-style strings inside
    run-records.sh itself (not separate files), since files_in_scope lists only
    scenarios/tools/run-records.sh and scenarios/tools/evidence.sh as script targets.
