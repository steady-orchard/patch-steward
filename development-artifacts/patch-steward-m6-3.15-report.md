- status: pass
- base: 1d27f696a600bdc2faea567c8bda18477848ca5b
- changes: |
    Created packages/core/src/pipeline/hosted-freshness.ts exporting PUBLISH_FRESHNESS_FAILURE_CODES,
    PublishFreshnessFailureCode, publishFreshnessFailure, PublishFreshnessInput, PublishFreshnessDeps,
    PublishFreshnessResult, verifyPublishFreshness per the packet's exact API and rules (settle-delay sleep, list, freshnessTop,
    conditional successor download / live recapture via loadPolicy + captureIssue/capturePullRequest, decidePublishFreshness,
    derived-value log lines, never-throws with catch -> unknown 'listing-unavailable').
    Created packages/core/src/pipeline/hosted-freshness.test.ts with the 11 required test titles under describe 'publish
    freshness verification', built on createHostedWorld from hosted-world.test.ts, using injected sleep, world.resolver/transport,
    and world.override for failure scenarios; no temp files, no child processes, no real network.
    Ran pnpm exec prettier --write on both files.
- acceptance: |
    1. pnpm vitest run packages/core/src/pipeline/hosted-freshness.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.15.json
       -> exit 0 (JSON report written to C:/w/m6-3.15/node_modules/.m6-p3-3.15.json)
    2. node -e "...titles check..." -> titles ok
    3. grep -cE "method: '(POST|PATCH|DELETE|PUT)'|fetch\(" packages/core/src/pipeline/hosted-freshness.ts -> 0 (grep exit 1)
    4. pnpm vitest run -> Test Files 175 passed (175); Tests 3167 passed (3167); exit 0
    5. pnpm typecheck -> exit 0 (no output, all four tsc -p invocations succeeded)
    6. pnpm exec eslint packages/core/src/pipeline/hosted-freshness.ts packages/core/src/pipeline/hosted-freshness.test.ts -> exit 0, no output
    7. pnpm exec prettier --check packages/core/src/pipeline/hosted-freshness.ts packages/core/src/pipeline/hosted-freshness.test.ts
       -> "Checking formatting...\nAll matched files use Prettier code style!" exit 0
    8. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-freshness.test.ts -> 0 (grep exit 1)
    9. node -e "...control-char scan..." -> clean

    Note: node_modules/.m6-p3-3.15.json is a scratch file used only to run acceptance check 2; it was removed before committing
    (not in files_in_scope, and node_modules is not tracked).
- deviations: |
    Initial test draft for "publish verification waits the settle delay before listing" asserted world.requests[0] directly,
    but buildOwnRecord's own setup requests (policy load, issue capture) precede the call under test; fixed by slicing
    world.requests from the count recorded just before calling verifyPublishFreshness. No other deviations from the packet.
