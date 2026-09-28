- status: pass
- base: 6f1e50c137ccba2f354a7e7db852773309f88d04
- changes: |
    packages/core/src/policy/bounds.ts: appended 18 `export const NAME = value;` lines directly after HANDOFF_MAX_BYTES, in the
    approved order (OWNERSHIP_SETTLE_DELAY_MS through SAME_RUN_ARTIFACT_RETENTION_DAYS).
    packages/core/src/policy/bounds.test.ts: added the 18 names to the import from './bounds.js'; added
    `it('hard-only hosted constants have the approved values', ...)` asserting each value with toBe; added
    `it('hosted constants agree with their related bounds', ...)` asserting the page-size, ordering, entry-count, wait-max,
    JWT, job-summary, event-payload, and retention relations. In the wait-max assertion, guarded the possibly-undefined
    `findPolicyLimit(...)?.max` with `?? NaN` before multiplying, to satisfy strict typecheck (arithmetic on a possibly
    undefined operand is a TS2532 error; the existing direct-comparison pattern elsewhere in the file did not need this
    because it never performs arithmetic on the optional value).
    Ran `pnpm exec prettier --write` on both files (no changes; already formatted).
- acceptance: |
    pnpm vitest run packages/core/src/policy/bounds.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.1.json
    -> JSON report written to C:/w/m6-1.1/node_modules/.m6-p1-1.1.json ; exit 0

    node -e "...titles check..."
    -> titles ok

    pnpm vitest run
    -> Test Files  141 passed (141) ; Tests  2675 passed (2675) ; exit 0

    pnpm typecheck
    -> (no output, all tsc invocations succeeded) ; exit 0

    pnpm exec eslint packages/core/src/policy/bounds.ts packages/core/src/policy/bounds.test.ts
    -> exit 0, no output

    pnpm exec prettier --check packages/core/src/policy/bounds.ts packages/core/src/policy/bounds.test.ts
    -> Checking formatting... All matched files use Prettier code style! ; exit 0

    grep -c "export const OWNERSHIP_RECORD_MAX_BYTES = 16384;" packages/core/src/policy/bounds.ts
    -> 1

    cat packages/core/src/policy/bounds.test.ts | grep -cE "mkdtemp|tmpdir|writeFile"
    -> 0 (grep exit status 1, as expected)

    node -e "...control/bidi/zero-width scan..." packages/core/src/policy/bounds.ts packages/core/src/policy/bounds.test.ts
    -> clean
- deviations: |
    Added `?? NaN` fallback in the wait-max relation assertion (not specified verbatim in actions) to satisfy
    `pnpm typecheck` strictness on arithmetic with a possibly-undefined value; the assertion's semantics (equality to
    EVIDENCE_CONFLICT_WAIT_STEP_MS * findPolicyLimit(...)?.max) are unchanged since the referenced policy limit row exists.
