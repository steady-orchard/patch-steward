- status: pass
- base: 6f1e50c137ccba2f354a7e7db852773309f88d04
- changes: |
    packages/core/src/vocabulary.ts: appended 11 vocabularies (GATE_DISPOSITIONS, OWNERSHIP_DISPOSITIONS, CAP_STATES,
    WAITING_REASONS, SUPERSESSION_REASONS, RESOLUTION_KINDS, RUN_KINDS, WRAPPER_EVENT_NAMES, PULL_REQUEST_EVENT_ACTIONS,
    ISSUE_EVENT_ACTIONS, SENDER_TYPES) with tuples, schemas, and types, in order.
    packages/core/src/vocabulary.test.ts: imported the 22 new names, added one vocabularies-array entry per new vocabulary
    with expected values, and added two standalone tests: 'committed dispositions are gate dispositions' and
    'waiting reasons are the exceeded cap states'.
    packages/core/src/records/common.ts: appended 'ownership', 'waiting', 'supersession' to RECORD_TYPES; added
    recordTreeIdSchema after policyRevisionIdSchema.
    packages/core/src/records/common.test.ts: imported recordTreeIdSchema; renamed 'record types list the nine records'
    to 'record types list the twelve records' with the extended expected array; added 'tree ids reject local revisions'.
    packages/core/src/exports.test.ts: changed RECORD_TYPES length expectation to 12; appended the 11 new tuple names to
    tupleExports and the 11 new schema names plus recordTreeIdSchema to schemaExports.
    Ran prettier --write on the five in-scope .ts files (only vocabulary.ts changed, whitespace/formatting only).
- acceptance: |
    pnpm vitest run packages/core/src/vocabulary.test.ts packages/core/src/records/common.test.ts packages/core/src/exports.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.2.json
    -> JSON report written to C:/w/m6-1.2/node_modules/.m6-p1-1.2.json; EXIT=0

    node -e "...title check..."
    -> titles ok

    pnpm vitest run
    -> Test Files  141 passed (141); Tests  2732 passed (2732); EXIT=0

    pnpm typecheck
    -> completes with no output; EXIT=0

    pnpm exec eslint packages/core/src/vocabulary.ts packages/core/src/vocabulary.test.ts packages/core/src/records/common.ts packages/core/src/records/common.test.ts packages/core/src/exports.test.ts
    -> no output; EXIT=0

    pnpm exec prettier --check packages/core/src/vocabulary.ts packages/core/src/vocabulary.test.ts packages/core/src/records/common.ts packages/core/src/records/common.test.ts packages/core/src/exports.test.ts
    -> Checking formatting...
       All matched files use Prettier code style!
       EXIT=0

    grep -c "export const OWNERSHIP_DISPOSITIONS" packages/core/src/vocabulary.ts
    -> 1

    grep -c "export const recordTreeIdSchema" packages/core/src/records/common.ts
    -> 1

    cat packages/core/src/vocabulary.test.ts packages/core/src/records/common.test.ts | grep -cE "mkdtemp|tmpdir|writeFile"
    -> 0 (grep exit status 1, as expected)

    node -e "...forbidden character scan..."
    -> clean
- deviations: none
