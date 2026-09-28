- status: pass
- base: 9284f6fcdc85c6fd3ca4f6c3b19ceaabdf95e762
- changes: |
    Created packages/core/src/records/waiting.ts (waitingRecordSchema, WaitingRecord) and
    packages/core/src/records/supersession.ts (supersessionRecordSchema, SupersessionRecord) exactly per spec, each with a
    superRefine cross-field check as specified. Created packages/core/src/records/waiting.test.ts and
    packages/core/src/records/supersession.test.ts with the exact required describe/it titles and fixtures. Ran prettier --write
    on all four files (waiting files were already formatted as written; supersession files were reformatted).
- acceptance: |
    grep -c "export const recordTreeIdSchema" packages/core/src/records/common.ts
    1

    grep -c "export const supersessionReasonSchema" packages/core/src/vocabulary.ts
    1

    pnpm vitest run packages/core/src/records/waiting.test.ts packages/core/src/records/supersession.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.6.json
    JSON report written to C:/w/m6-1.6/node_modules/.m6-p1-1.6.json
    EXIT:0

    node -e "...titles check..."
    titles ok

    pnpm vitest run
    Test Files  146 passed (146)
    Tests  2769 passed (2769)
    EXIT:0

    pnpm typecheck
    (no output, exit 0)
    EXIT:0

    pnpm exec eslint packages/core/src/records/waiting.ts packages/core/src/records/waiting.test.ts packages/core/src/records/supersession.ts packages/core/src/records/supersession.test.ts
    EXIT:0

    pnpm exec prettier --check packages/core/src/records/waiting.ts packages/core/src/records/waiting.test.ts packages/core/src/records/supersession.ts packages/core/src/records/supersession.test.ts
    Checking formatting...
    All matched files use Prettier code style!
    EXIT:0

    cat packages/core/src/records/waiting.test.ts packages/core/src/records/supersession.test.ts | grep -cE "mkdtemp|tmpdir|writeFile"
    0
    (grep exit status 1, as expected)

    node -e "...control/bidi character scan..."
    clean
- deviations: none
