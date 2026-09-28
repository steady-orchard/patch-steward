- status: pass
- base: 15fae5af5981c0d9835675475dd89ffe1a8661c8
- changes: |
    packages/core/src/conformance/write-allowlist.test.ts (new): describe 'write allowlist' with four it() blocks:
      - 'only the evidence store and token endpoints are writable': exercises isAllowedGitHubWrite from
        ../github/writer.js directly against the seven allowed request/scope combinations (access token POST under
        app scope; blob/tree/commit/refs-create/refs-update/token-delete under installation scope with STORE) and
        the listed disallowed requests (issue/label/check-run/review/status/reaction/dispatch writes, refs writes
        to a non-store branch or with force true or DELETE, a cross-repository blob POST, a PUT contents request
        cast `as unknown as GitHubWriteRequest`, the access token POST under installation scope, and a blob POST
        under app scope).
      - 'hosted runs send only allowlisted writes': runs a full gate+publish for an initial issue-29 'opened' event,
        then edits the issue body and runs a second gate+publish under a later GITHUB_RUN_ID (so freshness compares
        two distinct createdAt timestamps rather than tying), then asserts every non-GET/DOWNLOAD/SUMMARY entry in
        world.requests (as `method + ' ' + path`) matches one of the four allowed regexes from the packet.
      - 'the gate sends no write other than token requests': runs runHostedGate alone and asserts every non-GET
        request is the access-token POST or the token DELETE.
      - 'non-get requests are built only by the writer users': a static recursive scan (node:fs/node:path) of every
        non-test .ts file under packages/core/src, confirming `fetch(` appears only in github/client.ts and
        github/writer.ts and a `method: '(POST|PATCH|DELETE|PUT)'` literal appears only in github/app-auth.ts and
        evidence/git-store.ts (paths compared relative to packages/core/src with forward slashes), and confirming
        neither pattern appears in any non-test .ts file under packages/action/src.
    packages/core/src/conformance/zero-execution.fixture.test.ts: appended two entries to the `scanRoots` array
      (fileURLToPath(new URL('../ownership/', import.meta.url)) and
      fileURLToPath(new URL('../../../action/src/', import.meta.url))); no other line changed.
- acceptance: |
    1. pnpm vitest run packages/core/src/conformance/write-allowlist.test.ts packages/core/src/conformance/zero-execution.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.23.json
       -> exit 0 (JSON report written to C:/w/m6-3.23/node_modules/.m6-p3-3.23.json)
    2. node -e "...titles ok check..."
       -> titles ok
    3. node -e "...scan extended check..."
       -> scan extended
    4. git diff --numstat 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/conformance/zero-execution.fixture.test.ts | awk '{print $1" "$2}'
       -> 2 0
    5. pnpm vitest run
       -> Test Files 180 passed (180); Tests 3288 passed (3288); exit 0
    6. pnpm typecheck
       -> exit 0, no output (after removing an unused WORLD_REPOSITORY import caught by noUnusedLocals)
    7. pnpm exec eslint packages/core/src/conformance/write-allowlist.test.ts packages/core/src/conformance/zero-execution.fixture.test.ts
       -> exit 0, no output
    8. pnpm exec prettier --check packages/core/src/conformance/write-allowlist.test.ts packages/core/src/conformance/zero-execution.fixture.test.ts
       -> "All matched files use Prettier code style!"; exit 0
    9. node -e "...control/bidi/zero-width character scan..."
       -> clean
- deviations: |
    The packet's "hosted runs send only allowlisted writes" description did not specify the createdAt timestamps
    for the two ownership artifacts added during the scenario; using the same timestamp for both (as in the most
    literal reading) makes publish freshness resolve to a tie (publish.freshness-unknown) rather than a clean
    second publish, so the second artifact is given a later createdAt (matching the pattern already used by the
    "a newer owner records a supersession" test in hosted-publish.test.ts) so both gate+publish runs succeed and
    the write recording captures both. No other deviation from the packet.
