- status: pass
- base: 2752d3bdceda1cd70b58321fc254f5c3cf273680
- changes: |
    Added packages/core/src/evidence/store-readback.ts: exports EvidenceReadBackInput, EvidenceReadBackFailureCode,
    EvidenceReadBackResult, readBackEvidence, EvidenceWriteReceipt, writeEvidenceCommit, exactly as specified.
    readBackEvidence validates the commit id, reads the branch head, compares commit...head when they differ
    (readBackTipAccepted), then for each group reads the commit:path subtree (recursive only for 'exact' mode),
    checks truncation, and verifies blob ids with verifyReadBackTree. writeEvidenceCommit calls commitEvidence then
    readBackEvidence on the resulting commit, returning the receipt plus head.
    Added packages/core/src/evidence/store-readback.test.ts (describe 'evidence store read-back') with the eight
    required it titles, a dedicated fakeReadBack fixture (ref, compare, and commit:path tree GET handlers) for direct
    readBackEvidence calls, and a fakeWriteStore fixture (git-store.test.ts's commit flow plus the tree-read
    endpoint) for the two writeEvidenceCommit tests.
    Fixed one eslint prefer-const finding in store-readback.test.ts (tipTree) after the first prettier pass.
- acceptance: |
    1. pnpm vitest run packages/core/src/evidence/store-readback.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.10.json
       -> exit 0, "JSON report written to ..."
    2. node -e "... titles check ..." -> titles ok
    3. git diff --quiet HEAD -- packages/core/src/evidence/git-store.ts packages/core/src/evidence/git-store.test.ts -> exit 0
    4. pnpm vitest run -> Test Files 162 passed (162), Tests 3012 passed (3012), exit 0
    5. pnpm typecheck -> exit 0, no output
    6. pnpm exec eslint packages/core/src/evidence/store-readback.ts packages/core/src/evidence/store-readback.test.ts
       -> exit 0, no output
    7. pnpm exec prettier --check packages/core/src/evidence/store-readback.ts packages/core/src/evidence/store-readback.test.ts
       -> "Checking formatting...\nAll matched files use Prettier code style!", exit 0
    8. cat packages/core/src/evidence/store-readback.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process" -> 0 (grep exit 1)
    9. node -e "... forbidden character scan ..." packages/core/src/evidence/store-readback.ts packages/core/src/evidence/store-readback.test.ts
       -> clean
- deviations: none
