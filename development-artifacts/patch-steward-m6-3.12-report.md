- status: pass
- base: 4f5d5ab996dfc0d09ef285e4251f13c2c8aafdd9
- changes: |
    packages/core/src/pipeline/job-summary.ts: changed `JobSummaryFreshness` from a string union
    ('confirmed' | 'superseded' | 'unknown') to a discriminated union ({state:'current'} |
    {state:'superseded', reason: SupersessionReason} | {state:'unknown'}); imported SupersessionReason
    from '../vocabulary.js'; updated the freshness rendering branch in renderJobSummary to render
    'current'/'unknown' as '- Freshness: `<state>`' and 'superseded' as
    '- Freshness: `superseded` (`<reason>`)'. Every other line, order, bound, and fitJobSummary unchanged.

    packages/core/src/pipeline/job-summary.test.ts: updated 'publish summaries list outcome, evidence,
    and freshness' to use freshness { state: 'current' } and expect '- Freshness: `current`'; added new
    test 'superseded freshness names its reason' asserting { state: 'superseded', reason: 'newer-owner' }
    renders '- Freshness: `superseded` (`newer-owner`)' and { state: 'unknown' } renders
    '- Freshness: `unknown`'. All other tests unchanged.
- acceptance: |
    $ pnpm vitest run packages/core/src/pipeline/job-summary.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.12.json
    JSON report written to C:/w/m6-3.12/node_modules/.m6-p3-3.12.json
    exit 0

    $ node -e "...titles check..."
    titles ok

    $ grep -c "confirmed" packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
    packages/core/src/pipeline/job-summary.ts:0
    packages/core/src/pipeline/job-summary.test.ts:0

    $ pnpm vitest run
    Test Files  163 passed (163)
    Tests  3063 passed (3063)
    exit 0

    $ pnpm typecheck
    (tsc --noEmit across all package tsconfig.test.json, no output)
    exit 0

    $ pnpm exec eslint packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
    exit 0

    $ pnpm exec prettier --check packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
    Checking formatting...
    All matched files use Prettier code style!
    exit 0

    $ node -e "...character sweep..." packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
    clean
- deviations: none
