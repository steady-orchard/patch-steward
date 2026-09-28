- status: pass
- base: 9284f6fcdc85c6fd3ca4f6c3b19ceaabdf95e762
- changes: |
    Created packages/core/src/ownership/artifacts.ts: OwnershipArtifactItem, OwnershipListing, NewestOwnershipArtifact types;
    newestOwnershipArtifact (incomplete on listing.complete=false or unparseable createdAt; filters by exact name and
    !expired; picks greatest Date.parse(createdAt); ties sorted by id ascending as ambiguous); artifactRetentionDays
    (Math.round((expires-created)/86400000), null on NaN or negative); ownershipRetentionShort (true when days is null or
    below OWNERSHIP_RETENTION_DAYS, imported from ../policy/bounds.js).
    Created packages/core/src/ownership/artifacts.test.ts with the ten required it() titles under describe('ownership
    artifacts'), covering newest-by-created_at, id-independence (including reversed array order), top tie ambiguity,
    below-top tie non-interference, incomplete listing, expired-artifact exclusion (including all-expired -> none),
    name filtering, unparseable created_at -> incomplete, retention rounding (90-day, 1-day, 89d13h -> 90, unparseable/
    negative -> null), and retention-short thresholds (89 true, 90 false, null true).
    Ran pnpm exec prettier --write on both files (no changes needed).
- acceptance: |
    pnpm vitest run packages/core/src/ownership/artifacts.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.8.json
    -> JSON report written; EXIT:0

    node -e "...titles check..."
    -> titles ok

    pnpm vitest run
    -> Test Files  145 passed (145); Tests  2769 passed (2769); EXIT:0

    pnpm typecheck
    -> tsc --noEmit across all four tsconfig.test.json projects; EXIT_TC:0

    pnpm exec eslint packages/core/src/ownership/artifacts.ts packages/core/src/ownership/artifacts.test.ts
    -> EXIT_LINT:0 (no output)

    pnpm exec prettier --check packages/core/src/ownership/artifacts.ts packages/core/src/ownership/artifacts.test.ts
    -> Checking formatting... All matched files use Prettier code style! EXIT_FMT:0

    grep -rnE "node:(fs|http|https|net|dns|tls|child_process)|from 'fs'|fetch\(" packages/core/src/ownership
    -> no output; EXIT_GREP1:1

    grep -c "export function newestOwnershipArtifact" packages/core/src/ownership/artifacts.ts
    -> 1

    node -e "...control/bidi/zero-width char scan..."
    -> clean
- deviations: none
