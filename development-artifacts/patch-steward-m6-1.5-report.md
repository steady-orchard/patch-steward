- status: pass
- base: 9284f6fcdc85c6fd3ca4f6c3b19ceaabdf95e762
- changes: |
    Created packages/core/src/ownership/dedup.ts: pure module exporting DEDUP_COMMIT_REASONS, DedupCommitReason,
    DEDUP_DUPLICATE_REASONS, DedupDuplicateReason, DedupFailureCode, DedupRunRef, DedupSnapshot, DedupOwnerRecordRead,
    DedupListingRead, DedupFallbackRead, DedupInput, DedupDecision, decideDeduplication, appliesListingDeduplication,
    EchoInput, isVerifiedEcho, implementing the precedence rules exactly as specified (echo, rerun, reopened, listing
    unavailable/incomplete/ambiguous/unique/none with fallback, snapshot/policy comparison). No exports beyond the
    required API; no node:fs/http/child_process/fetch usage.
    Created packages/core/src/ownership/dedup.test.ts: describe 'ownership deduplication' with the 19 required it()
    titles, using 'sha256:' + 'a'.repeat(64) / 'c'.repeat(64) hashes and 'b'.repeat(40) / 'd'.repeat(40) revisions.
    Ran pnpm exec prettier --write on both files.
- acceptance: |
    1. pnpm vitest run packages/core/src/ownership/dedup.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.5.json
       JSON report written to C:/w/m6-1.5/node_modules/.m6-p1-1.5.json
       EXIT:0

    2. node -e "...titles ok check..."
       titles ok

    3. pnpm vitest run
       Test Files  145 passed (145)
       Tests  2778 passed (2778)
       EXIT:0

    4. pnpm typecheck
       (tsc --noEmit across all package tsconfig.test.json, no output)
       EXIT:0

    5. pnpm exec eslint packages/core/src/ownership/dedup.ts packages/core/src/ownership/dedup.test.ts
       EXIT:0

    6. pnpm exec prettier --check packages/core/src/ownership/dedup.ts packages/core/src/ownership/dedup.test.ts
       Checking formatting...
       All matched files use Prettier code style!
       EXIT:0

    7. grep -rnE "node:(fs|http|https|net|dns|tls|child_process)|from 'fs'|fetch\(" packages/core/src/ownership
       (no output)
       EXIT:1

    8. grep -c "export function decideDeduplication" packages/core/src/ownership/dedup.ts
       1

    9. node -e "...control/bidi/zero-width char scan..." packages/core/src/ownership/dedup.ts packages/core/src/ownership/dedup.test.ts
       clean
- deviations: none
