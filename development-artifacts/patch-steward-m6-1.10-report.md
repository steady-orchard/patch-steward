- status: pass
- base: 9284f6fcdc85c6fd3ca4f6c3b19ceaabdf95e762
- changes: |
    Created packages/core/src/ownership/caps.ts: STEWARD_WRAPPER_PATHS, RunNameFields, buildRunName (throws RangeError if the
    built title would not parse), a static RUN_NAME_PATTERN regex and parseRunName (length-bounded before matching, rejects
    unsafe-integer id substrings via Number.isSafeInteger), RunListItem, RunListQueryResult, CapEvaluationInput, CapEvaluation,
    CapsFailureCode, runListQueryDate, and evaluateCaps implementing the cap rules in the specified order (run-list-unavailable
    on incomplete inProgress/queued always, or incomplete createdToday unless totalCount already exceeds 1000; daily count
    excludes bot-sent counted runs and always adds unparseable titles; per-author count unions distinct ids from inProgress and
    queued with status queued/in_progress and matching authorId; state precedence daily-runs before per-author-concurrent-runs).
    Only the specified names are exported.
    Created packages/core/src/ownership/caps.test.ts (describe 'run-name tags and caps') covering all 21 required it() titles,
    using String.fromCharCode to build hostile control/bidi/zero-width/non-ASCII-digit characters.
    Ran pnpm exec prettier --write on both files (caps.ts unchanged, caps.test.ts reformatted).
- acceptance: |
    1. pnpm vitest run packages/core/src/ownership/caps.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.10.json
       -> EXIT=0; Test Files 1 passed (1), Tests 21 passed (21)
    2. node -e "...titles check..." -> titles ok
    3. pnpm vitest run -> EXIT=0; Test Files 145 passed (145), Tests 2780 passed (2780)
    4. pnpm typecheck -> EXIT=0 (all four package tsconfigs)
    5. pnpm exec eslint packages/core/src/ownership/caps.ts packages/core/src/ownership/caps.test.ts -> EXIT=0, no output
    6. pnpm exec prettier --check packages/core/src/ownership/caps.ts packages/core/src/ownership/caps.test.ts -> EXIT=0,
       "All matched files use Prettier code style!"
    7. grep -rnE "node:(fs|http|https|net|dns|tls|child_process)|from 'fs'|fetch\(|new RegExp" packages/core/src/ownership/caps.ts
       -> no output, exit 1
    8. grep -c "export function parseRunName" packages/core/src/ownership/caps.ts -> 1
    9. node -e "...control/bidi character scan..." caps.ts caps.test.ts -> clean
- deviations: none
