- status: pass
- base: 15fae5af5981c0d9835675475dd89ffe1a8661c8
- changes: |
    Added packages/core/src/conformance/invariant-4-hosted.test.ts: 23 `it(...)` cases under `describe('invariant 4: hosted
    never pass')`, one per listed injection (7 gate, 11 publish-before-commit, 5 publish-after-commit). Each drives
    runHostedGate or runHostedPublish through createHostedWorld/createStoreWorld with a single injected failure (world.override
    for HTTP-level faults, world.setPolicy/world.addArtifact/store.advance for data-level faults), then asserts via a shared
    expectNeverPass helper that the result is ok:false, failure.outcome is 'inconclusive', failure.cause is in FAILURE_CAUSES,
    and no captured job-summary text contains the code span `` `pass` ``. Gate failures are checked structurally (the failure
    branch of HostedGateResult has no `files` field). Publish-before-commit cases assert store.head(WORLD_REPOSITORY) is
    unchanged (null, or the pre-existing tip for the compare/ref-update cases which call store.advance first per the packet's
    instruction). Publish-after-commit cases assert no stored path contains '/supersessions/'. The "only after the evidence
    commit" injections (settle re-list) gate the override on having seen a request path ending in '/git/refs' or
    '/git/refs/heads/steward-evidence', per the packet's guidance; successor-record, recapture, and freshness-tie cases need no
    such flag since the underlying calls (own-artifact listing before commit, artifact download, issue capture) don't collide
    with a pre-commit call to the same route in those scenarios.
- acceptance: |
    1. pnpm vitest run packages/core/src/conformance/invariant-4-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.21.json
       -> exit 0 (confirmed via `echo EXIT:$?`)
    2. node -e "...need.length+' required; '+(miss.length?...)" -> 23 required; titles ok
    3. git diff --quiet 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/conformance/invariant-4.test.ts; echo "unchanged $?"
       -> unchanged 0
    4. pnpm vitest run -> Test Files 180 passed (180); Tests 3307 passed (3307)
    5. pnpm typecheck -> exit 0, no output (all four tsc -p invocations succeeded)
    6. pnpm exec eslint packages/core/src/conformance/invariant-4-hosted.test.ts -> exit 0, no output
    7. pnpm exec prettier --check packages/core/src/conformance/invariant-4-hosted.test.ts -> "Checking formatting...\nAll matched
       files use Prettier code style!"
    8. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/conformance/invariant-4-hosted.test.ts -> 0 (grep
       exit status 1, as expected)
    9. node -e "...bad?'dirty':'clean'..." packages/core/src/conformance/invariant-4-hosted.test.ts -> clean
- deviations: none
