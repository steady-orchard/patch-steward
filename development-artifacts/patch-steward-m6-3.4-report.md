- status: pass
- base: 4f5d5ab996dfc0d09ef285e4251f13c2c8aafdd9
- changes: |
    Created packages/core/src/ownership/freshness.ts: FRESHNESS_UNKNOWN_REASONS, FreshnessUnknownReason,
    OwnArtifactLookup, findOwnOwnershipArtifact, OwnArtifactReference, FreshnessTop, freshnessTop,
    SuccessorRead, LiveSnapshotRead, FreshnessDecisionInput, PublishFreshness, decidePublishFreshness,
    per the exact API and fixed-order rules in context. Imports only from './artifacts.js'.
    Created packages/core/src/ownership/freshness.test.ts with the exact 13 required `it` titles under
    describe 'publish freshness', importing only 'vitest' and './freshness.js' / './artifacts.js'.
    Ran prettier --write on both files.
- acceptance: |
    1. pnpm vitest run packages/core/src/ownership/freshness.test.ts packages/core/src/conformance/never-pass-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.4.json
       -> exit 0
    2. node -e "...titles check..."
       -> titles ok
    3. grep -c "fetch(" packages/core/src/ownership/freshness.ts packages/core/src/ownership/freshness.test.ts
       -> packages/core/src/ownership/freshness.ts:0
          packages/core/src/ownership/freshness.test.ts:0
    4. pnpm vitest run
       -> Test Files 164 passed (164), Tests 3075 passed (3075), exit 0
    5. pnpm typecheck
       -> exit 0, no output beyond command echo
    6. pnpm exec eslint packages/core/src/ownership/freshness.ts packages/core/src/ownership/freshness.test.ts
       -> exit 0
    7. pnpm exec prettier --check packages/core/src/ownership/freshness.ts packages/core/src/ownership/freshness.test.ts
       -> "All matched files use Prettier code style!", exit 0
    8. node -e "...control/bidi/zero-width scan..." freshness.ts freshness.test.ts
       -> clean
- deviations: |
    Initial test draft had a bug (own item and "other" comparison artifacts shared the same default
    workflowRunId, so findOwnOwnershipArtifact saw duplicates instead of a single own match) affecting
    the "newer artifact", "tie" (both variants), and "unavailable or incomplete listing" test bodies;
    fixed by giving comparison/other artifacts distinct workflowRunId values before re-running
    acceptance. No change to freshness.ts logic was needed. Otherwise none.
