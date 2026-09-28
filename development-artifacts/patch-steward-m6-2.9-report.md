- status: pass
- base: ded94d936391ac61e872394f93f9a1651209ed8f
- changes: |
    packages/core/src/evidence/git-store.ts (new): exports githubGitObjectResponseSchema, githubGitCommitResponseSchema,
    EvidenceStoreLocation, EvidenceStoreFile, EvidenceStoreGroup, EvidenceCommitInput, EvidenceCommitDeps,
    EvidenceCommitReceipt, EvidenceStoreConflictFailureCode, EvidenceStoreFailureCode, evidenceStoreLocation,
    evidenceCommitMessage, hostedEvidenceLocation, commitEvidence. Implements the append-only evidence commit: layout
    validation (branch, store repo, target repository, run/subject/retry/byte bounds, directory and file path patterns,
    mode-per-directory, file-count/byte budget), blob/tree/commit creation via the GitHub writer, append-only compare
    verification, non-force ref update with bounded rebuild-on-conflict (evidence.store-conflict after writeRetries),
    and readback-mismatch detection for blob/commit/ref responses. Wrapped in try/catch returning
    evidence.layout-invalid/exception, never throws.
    packages/core/src/evidence/git-store.test.ts (new): describe 'evidence git store commit' with a shared fakeStore()
    fake fetch driving both createGitHubClient and createGitHubWriter over one createGitHubBudget, plus the 12 required
    it(...) titles covering the happy path, root commit, rebuild-on-conflict, exhausted retries, non-append-only compare,
    blob mismatch, layout validation (12 sub-cases), size/file limits, commit message, store location, hosted location,
    and budget exhaustion.
- acceptance: |
    1. pnpm vitest run packages/core/src/evidence/git-store.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.9.json
       -> exit 0 (JSON report written to C:/w/m6-2.9/node_modules/.m6-p2-2.9.json)
    2. node -e "...titles..." -> titles ok
    3. pnpm vitest run -> Test Files 158 passed (158), Tests 2973 passed (2973); exit 0
    4. pnpm typecheck -> exit 0, no output
    5. pnpm exec eslint packages/core/src/evidence/git-store.ts packages/core/src/evidence/git-store.test.ts -> exit 0, no output
    6. pnpm exec prettier --check packages/core/src/evidence/git-store.ts packages/core/src/evidence/git-store.test.ts
       -> "Checking formatting...\nAll matched files use Prettier code style!"; exit 0
    7. cat packages/core/src/evidence/git-store.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process" -> 0
    8. node -e "...control/bidi/zero-width scan..." packages/core/src/evidence/git-store.ts packages/core/src/evidence/git-store.test.ts
       -> clean
    Base assertion (action 1): node -e "...writer.ts symbol check..." -> base ok
- deviations: none
