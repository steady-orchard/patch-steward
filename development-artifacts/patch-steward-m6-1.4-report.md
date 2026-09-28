- status: pass
- base: 6f1e50c137ccba2f354a7e7db852773309f88d04
- changes: |
    Created packages/core/src/evidence/blob-id.ts: gitBlobId(bytes) computes sha1 of
    'blob <len>' header + zero byte + content bytes using node:crypto createHash.
    Created packages/core/src/evidence/blob-id.test.ts: vectors match git hash-object
    for empty, 'hello\n', 'test content\n'; LF vs CRLF differ; Uint8Array view with
    non-zero byteOffset hashes same as copied Buffer.
    Created packages/core/src/evidence/store-checks.ts: evidenceCompareSchema (zod),
    verifyAppendOnlyCompare (ordered checks: status, ahead_by, behind_by, files
    defined, file status, duplicate/mismatched paths), readBackTipAccepted, and
    verifyReadBackTree (ordered checks: duplicate expected, entry-type in exact mode,
    duplicate blob paths, missing/blob-id/mode per expected blob, extra in exact mode).
    Created packages/core/src/evidence/store-checks.test.ts covering all specified
    titles and failure paths.
    Ran pnpm exec prettier --write on all four files (no changes needed).
- acceptance: |
    1. pnpm vitest run packages/core/src/evidence/blob-id.test.ts packages/core/src/evidence/store-checks.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.4.json
       -> JSON report written; exit 0
    2. node -e (title check script)
       -> titles ok
    3. printf 'test content\n' | git hash-object --stdin
       -> d670460b4b4aece5915caf5c68d12f560a9fe3e4
    4. pnpm vitest run
       -> Test Files 143 passed (143); Tests 2687 passed (2687); exit 0
    5. pnpm typecheck
       -> exit 0, no output errors
    6. pnpm exec eslint packages/core/src/evidence/blob-id.ts packages/core/src/evidence/blob-id.test.ts packages/core/src/evidence/store-checks.ts packages/core/src/evidence/store-checks.test.ts
       -> exit 0
    7. pnpm exec prettier --check ... same four files
       -> "All matched files use Prettier code style!"; exit 0
    8. cat blob-id.test.ts store-checks.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
       -> 0
    9. node -e (control/bidi/zero-width character scan) on all four files
       -> clean
- deviations: none
