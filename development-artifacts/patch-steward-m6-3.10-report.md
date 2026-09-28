- status: pass
- base: 4f5d5ab996dfc0d09ef285e4251f13c2c8aafdd9
- changes: |
    Created packages/core/src/evidence/store-world.test.ts: an in-memory fake of GitHub's Git Data API
    (blobs, trees, commits, refs, compare, git/trees/<commit>:<path>, contents) keyed per repository
    'owner/name' taken from the request URL, exporting STORE_WORLD_BRANCH, StoreWorldRequest,
    StoreWorldHandler, StoreWorld (handler/head/files/commitCount/advance), createStoreWorld, and
    storeWorldFetch, plus a describe('store world') block with the seven required self-check tests
    driving commitEvidence/writeEvidenceCommit/readPublishedSnapshot from git-store.ts,
    store-readback.ts, and fallback-read.ts through the fake. Ran prettier --write on the file per
    actions step 2.
- acceptance: |
    pnpm vitest run packages/core/src/evidence/store-world.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.10.json
    -> exit 0 (JSON report written to C:/w/m6-3.10/node_modules/.m6-p3-3.10.json)

    node -e "...titles..." -> titles ok

    node -e "...exports..." -> exports ok

    pnpm vitest run
    -> Test Files 164 passed (164); Tests 3069 passed (3069); exit 0

    pnpm typecheck -> exit 0, no output (all four tsc -p invocations succeeded)

    pnpm exec eslint packages/core/src/evidence/store-world.test.ts -> exit 0, no output

    pnpm exec prettier --check packages/core/src/evidence/store-world.test.ts -> "Checking formatting...
    All matched files use Prettier code style!"

    grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/evidence/store-world.test.ts
    -> 0

    node -e "...control/bidi/zero-width scan..." packages/core/src/evidence/store-world.test.ts -> clean
- deviations: none
