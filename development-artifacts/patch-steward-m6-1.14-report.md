- status: pass
- base: 1027fd7c9fc187ace9a9fe1354d97630ab1eeabe
- changes: |
    packages/core/src/index.ts: appended 11 `export * from` lines for net/zip-entry, evidence/blob-id, evidence/store-checks,
    records/waiting, records/supersession, ownership/record, ownership/artifacts, ownership/dedup, ownership/events,
    ownership/caps, pipeline/job-summary (total export-star count now 98).
    packages/core/src/exports.test.ts: appended the listed names to functionExports, tupleExports, schemaExports, and
    recordExports; added it('exports the hosted contract constants') asserting OWNERSHIP_ARTIFACT_FILE, OWNERSHIP_ARTIFACT_PREFIX,
    SUPERSESSIONS_DIRECTORY, OWNERSHIP_SETTLE_DELAY_MS, JOB_SUMMARY_MAX_LENGTH, RECORD_TYPES length 12, STEWARD_WRAPPER_PATHS.
    packages/core/src/conformance/invariant-5.test.ts: inserted 'parseRunName' into the sorted function-name list between
    'parsePullRequestBody' and 'parseStewardVersion'; added a parseRunName(...).toBeNull() assertion next to the
    parseCategoryValue/parseLinkedIssueValue assertions; fixed the leaked mkdtempSync temp directory by wrapping the loadPolicy
    call in try/finally with rmSync(tmp, { recursive: true, force: true }) (rmSync imported from the same dynamic node:fs import).
    packages/core/src/conformance/never-pass-hosted.test.ts: created, importing only from '../index.js' (plus node:fs, node:url,
    vitest); defines HostedFailureCode union and a TRIGGERS table for the six specified codes; a for-loop over
    Object.keys(TRIGGERS) with plain it() titled `hosted failure code ${code} never yields pass` asserting ok false, failure.code,
    failure.outcome 'inconclusive', FAILURE_CAUSES contains failure.cause, and 'value' in result is false; and
    it('ownership modules import no file system or network module') listing .ts files under ../ownership/ (14 files) and
    asserting none import fs/http/https/net/dns/tls/child_process or call fetch(.
- acceptance: |
    1. pnpm vitest run packages/core/src/exports.test.ts packages/core/src/conformance/invariant-5.test.ts packages/core/src/conformance/never-pass-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.14.json
       -> exit 0 (JSON report written; output file removed after use, not in files_in_scope)
    2. node -e "...need titles check..." -> titles ok
    3. pnpm vitest run -> Test Files 153 passed (153), Tests 2928 passed (2928), exit 0
    4. pnpm typecheck -> exit 0 (no output, all four tsc -p invocations succeeded)
    5. pnpm build -> exit 0 (core, cli, action, web all "Done")
    6. node -e "...dist exports check..." -> dist exports ok
    7. grep -c "^export \* from" packages/core/src/index.ts -> 98
    8. pnpm exec eslint ... -> exit 0
    9. pnpm exec prettier --check ... -> All matched files use Prettier code style! exit 0
    10. node -e "...leak check..." -> exit 0 before 272 after 272 / no leak
    11. node -e "...control character scan..." -> clean
- deviations: |
    In never-pass-hosted.test.ts, evaluateCaps's caps.run-list-unavailable trigger required full RunListQueryResult shapes
    ({ items, totalCount, complete }) for createdToday/inProgress/queued and a Date for `now`, rather than the abbreviated
    `inProgress.complete false` / string `now` shown in the step's shorthand; used the complete typed shape with
    inProgress.complete: false to satisfy CapEvaluationInput while triggering the same failure code. No other deviations.
