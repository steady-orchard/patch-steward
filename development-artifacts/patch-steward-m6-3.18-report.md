- status: pass
- base: 15fae5af5981c0d9835675475dd89ffe1a8661c8
- changes: |
    packages/core/src/index.ts: appended 9 `export * from` lines (pipeline/gate-context.js, pipeline/hosted-environment.js,
    ownership/freshness.js, evidence/prepare-waiting.js, evidence/prepare-records.js, pipeline/hosted-evidence.js,
    pipeline/hosted-freshness.js, pipeline/hosted-gate.js, pipeline/hosted-publish.js) after the existing 105 lines, for 114 total.
    packages/core/src/exports.test.ts: added one test 'exports the hosted pipeline entry points' asserting typeof === 'function'
    for the 28 listed hosted function names and the listed constant values (HANDOFF_ARTIFACT, CLOSURE_ARTIFACT, HANDOFF_FILE,
    GATE_CONTEXT_FILE, CLOSURE_CONTEXT_FILE, GATE_CONTEXT_LOG_LINES_MAX, HOSTED_GATE_FAILURE_CODES, PUBLISH_FRESHNESS_FAILURE_CODES,
    HOSTED_ENVIRONMENT_FAILURE_CODES, FRESHNESS_UNKNOWN_REASONS length, HOSTED_APP_ID_VARIABLE, HOSTED_APP_KEY_VARIABLE). No other
    change to that file.
    packages/core/src/conformance/never-pass-hosted.test.ts: extended the HostedFailureCode union with HostedGateFailureCode,
    PublishFreshnessFailureCode, HostedEnvironmentFailureCode (imported as types from '../index.js'); added imports
    DEFAULT_CHECKLIST_POLICY, err, mapHostedPolicyFailure, repositoryGateRefusal, publishFreshnessFailure, readGateEnvironment from
    '../index.js'; added TRIGGERS entries for gate.policy-missing, gate.policy-invalid, gate.repository-gate-unsupported,
    publish.freshness-unknown, action.environment-invalid exactly as specified. Existing entries and the ownership-import test
    unchanged.
- acceptance: |
    grep -c "^export \* from" packages/core/src/index.ts
    114

    pnpm vitest run packages/core/src/exports.test.ts packages/core/src/conformance --reporter=json --outputFile=node_modules/.m6-p3-3.18.json
    JSON report written to C:/w/m6-3.18/node_modules/.m6-p3-3.18.json
    EXIT=0

    node -e "... titles check ..."
    titles ok

    pnpm build
    EXIT=0

    node --input-type=module -e "... dist exports check ..."
    dist exports ok

    pnpm typecheck
    (no output, exit 0)

    pnpm vitest run
    Test Files  179 passed (179)
    Tests  3273 passed (3273)
    EXIT=0

    pnpm exec eslint packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
    EXIT=0

    pnpm exec prettier --check packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
    All matched files use Prettier code style!
    EXIT=0

    node -e "... control character scan ..."
    clean
- deviations: none
