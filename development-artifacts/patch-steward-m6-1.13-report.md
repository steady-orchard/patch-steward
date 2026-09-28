- status: pass
- base: 9284f6fcdc85c6fd3ca4f6c3b19ceaabdf95e762
- changes: |
    Created packages/core/src/pipeline/job-summary.ts: exports JobSummaryJob, JobSummaryStatus, JobSummaryFreshness,
    JobSummaryInput, renderJobSummary(input), fitJobSummary(lines, maxLength) exactly per spec, importing only
    reportCodeSpan from ../report/escape.js, JOB_SUMMARY_MAX_LENGTH/OWNERSHIP_RETENTION_DAYS from ../policy/bounds.js,
    and GateDisposition/Outcome/SubmissionType/WaitingState types from ../vocabulary.js.
    Created packages/core/src/pipeline/job-summary.test.ts with describe('job summary') and the seven required it()
    titles, asserting exact rendered text, omission of null fields, code-span wrapping, hostile-character layout
    safety (backtick, newline, carriage return, @mention, #issue, <b>, RLO U+202E, ZWSP U+200B), retention flag
    threshold, and fitJobSummary truncation plus the JOB_SUMMARY_MAX_LENGTH bound.
    Ran pnpm exec prettier --write on both files (job-summary.ts unchanged, job-summary.test.ts reformatted).
- acceptance: |
    grep -c "export const JOB_SUMMARY_MAX_LENGTH = 65536;" packages/core/src/policy/bounds.ts
    1
    grep -c "export const GATE_DISPOSITIONS" packages/core/src/vocabulary.ts
    1

    pnpm vitest run packages/core/src/pipeline/job-summary.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.13.json
    JSON report written to C:/w/m6-1.13/node_modules/.m6-p1-1.13.json
    exit 0

    node -e "...titles check..."
    titles ok

    pnpm vitest run
    Test Files  145 passed (145)
    Tests  2766 passed (2766)
    exit 0

    pnpm typecheck
    (no output, exit 0)

    pnpm exec eslint packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
    ESLINT_OK (exit 0)

    pnpm exec prettier --check packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
    All matched files use Prettier code style!
    exit 0

    cat packages/core/src/pipeline/job-summary.test.ts | grep -cE "mkdtemp|tmpdir|writeFile"
    0

    node -e "...control/bidi/zero-width character scan..." packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
    clean
- deviations: none
