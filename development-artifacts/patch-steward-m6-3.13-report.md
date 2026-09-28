- status: pass
- base: 32fec2c2a192c291a360a38107964b3b7585e521
- changes: |
    Started from the previous attempt's two source files (`git checkout fdf0b5d -- packages/core/src/pipeline/hosted-gate.ts
    packages/core/src/pipeline/hosted-gate.test.ts`), then applied the corrected rule and added the new test.
    - packages/core/src/pipeline/hosted-gate.ts: fixed the early listing-failure check so it only returns the listing failure
      for non-closure events when `appliesListingDeduplication(event.runAttempt, event.action)` is true (explicit reruns and
      `reopened` events now continue to capture with an empty receipt set, letting `decideDeduplication` commit with reason
      `rerun` or `reopened` even when the ownership listing is unavailable). Previously the listing failure was returned
      unconditionally right after the listing read for every non-closure event.
    - packages/core/src/pipeline/hosted-gate.test.ts: added the test 'a rerun or reopen commits despite an unavailable
      listing' (500 override on `/actions/artifacts`; run attempt 2 with action 'opened' -> ok, disposition 'runnable', a
      '/issues/29' request happens; then run attempt 1 with action 'reopened' -> ok, disposition 'runnable'). No other test
      titles changed.
    - Ran `pnpm exec prettier --write` on both files (hosted-gate.ts unchanged, test file reformatted).
- acceptance: |
    1. pnpm vitest run packages/core/src/pipeline/hosted-gate.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.13.json
       -> exit 0 (JSON report written)
    2. node -e "...titles check..." -> titles ok
    3. grep -cE "method: '(POST|PATCH|DELETE|PUT)'|fetch\(" packages/core/src/pipeline/hosted-gate.ts -> 0 (grep exit 1)
    4. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- packages/core/src/pipeline/hosted-gate.ts packages/core/src/pipeline/hosted-gate.test.ts; echo "grep $?"
       -> grep 1
    5. pnpm vitest run -> Test Files 177 passed (177), Tests 3208 passed (3208), exit 0
    6. pnpm typecheck -> exit 0, no output
    7. pnpm exec eslint packages/core/src/pipeline/hosted-gate.ts packages/core/src/pipeline/hosted-gate.test.ts -> exit 0 (LINTOK)
    8. pnpm exec prettier --check packages/core/src/pipeline/hosted-gate.ts packages/core/src/pipeline/hosted-gate.test.ts -> "All matched files use Prettier code style!" (FMTOK)
    9. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-gate.test.ts -> 0 (grep exit 1)
    10. node -e "...bad char scan..." packages/core/src/pipeline/hosted-gate.ts packages/core/src/pipeline/hosted-gate.test.ts
        -> clean
- deviations: none
