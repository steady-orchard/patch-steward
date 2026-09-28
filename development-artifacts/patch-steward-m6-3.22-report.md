- status: pass
- base: 15fae5af5981c0d9835675475dd89ffe1a8661c8
- changes: |
    Added packages/core/src/conformance/invariant-7-hosted.test.ts with a new describe block
    'invariant 7: hosted credentials and bounds' containing the eight required titles:
    - 'invariant 7: the app key and tokens never reach hosted outputs or evidence'
    - 'invariant 7: every minted token is masked before it is used'
    - 'invariant 7: hosted constants keep their hard values'
    - 'invariant 7: publish waits exactly the settle delay'
    - 'invariant 7: hosted inputs are size bounded'
    - 'invariant 7: hosted job summaries stay within the bound'
    - 'invariant 7: store conflict waits are bounded'
    - 'invariant 7: app jwts expire within the hard lifetime'
    Built local gate/upload/publish harness helpers (gateDeps, publishDeps, runGate,
    runPublishAfterGate, collectHaystacks) modeled on hosted-publish.test.ts, using
    createStoreWorld and createHostedWorld from the base steps. Did not modify any other file.
- acceptance: |
    1. pnpm vitest run packages/core/src/conformance/invariant-7-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.22.json
       -> exit 0 (JSON report written to node_modules/.m6-p3-3.22.json)
    2. node -e "..." (title check script)
       -> titles ok
    3. git diff --quiet 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/conformance/invariant-7.test.ts; echo "unchanged $?"
       -> unchanged 0
    4. git grep --untracked -n -E 'ghp_[A-Za-z0-9]{10}|ghs_[A-Za-z0-9]{10}|-----BEGIN' -- packages/core/src/conformance/invariant-7-hosted.test.ts; echo "grep $?"
       -> grep 1
    5. pnpm vitest run
       -> Test Files 180 passed (180); Tests 3292 passed (3292); exit 0
    6. pnpm typecheck
       -> exit 0, no output
    7. pnpm exec eslint packages/core/src/conformance/invariant-7-hosted.test.ts
       -> exit 0, no output
    8. pnpm exec prettier --check packages/core/src/conformance/invariant-7-hosted.test.ts
       -> "Checking formatting...\nAll matched files use Prettier code style!"
    9. node -e "..." (control/bidi/zero-width character scan)
       -> clean
- deviations: none
