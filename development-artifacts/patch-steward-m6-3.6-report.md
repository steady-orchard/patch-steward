- status: pass
- base: 4f5d5ab996dfc0d09ef285e4251f13c2c8aafdd9
- changes: |
    Created packages/core/src/evidence/prepare-records.ts: exports EvidenceGroupFailureCode, RunEvidenceGroupSource,
    runEvidenceGroups, PreparedRecordEvidence, SupersessionEvidenceInput, prepareSupersessionEvidence,
    ClosureEvidenceInput, prepareClosureEvidence, per the packet's exact API. Implements the three commit shapes
    (run directory + manifest + metrics; supersession record + its metrics event; closure metrics-only file) using
    layout.ts path builders, redactEvidenceStrings, prettyJson, buildSupersessionMetricsEvents, and the
    supersession/metrics-event record schemas. Never throws (try/catch -> 'evidence.record-invalid').

    Created packages/core/src/evidence/prepare-records.test.ts (describe 'evidence store groups') with the seven
    required it() titles, verified against writeEvidenceCommit for the layout-acceptance case using
    createGitHubClient/createGitHubWriter/createGitHubBudget against a 500-responding fetch.

    Ran pnpm exec prettier --write on both files (action 3).
- acceptance: |
    1. pnpm vitest run packages/core/src/evidence/prepare-records.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.6.json
       -> exit 0 (JSON report written; 7/7 tests passed)
    2. node -e "...titles ok check..."
       -> titles ok
    3. pnpm vitest run
       -> Test Files 164 passed (164); Tests 3069 passed (3069); exit 0
    4. pnpm typecheck
       -> exit 0, no output
    5. pnpm exec eslint packages/core/src/evidence/prepare-records.ts packages/core/src/evidence/prepare-records.test.ts
       -> exit 0, no output
    6. pnpm exec prettier --check packages/core/src/evidence/prepare-records.ts packages/core/src/evidence/prepare-records.test.ts
       -> "All matched files use Prettier code style!", exit 0
    7. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/evidence/prepare-records.test.ts
       -> prints 0, grep exit status 1
    8. node -e "...control/bidi/zero-width scan..." prepare-records.ts prepare-records.test.ts
       -> clean
- deviations: none
