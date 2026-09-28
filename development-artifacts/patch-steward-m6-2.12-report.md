- status: pass
- base: 4ec9df302763d31c6eac636709f510e80b08b958
- changes: |
    packages/core/src/index.ts: appended 7 `export * from` lines for github/writer.js, github/app-auth.js,
    github/artifacts.js, github/runs.js, evidence/fallback-read.js, evidence/git-store.js, evidence/store-readback.js
    (line count 98 -> 105).
    packages/core/src/exports.test.ts: appended the 23 new function-export names to functionExports, 2 names
    (GITHUB_WRITE_FAILURE_CODES, APP_AUTH_FAILURE_CODES) to tupleExports, 9 schema names to schemaExports, 2 names
    (APP_TOKEN_PERMISSION_SETS, GITHUB_WRITE_FAILURE_CAUSES) to recordExports, and added
    it('exports the hosted adapter constants', ...) asserting GITHUB_WRITE_FAILURE_CODES, APP_AUTH_FAILURE_CODES,
    APP_TOKEN_PERMISSION_SETS['publish-store'], APP_TOKEN_PERMISSION_SETS['gate-target'], and
    GITHUB_FAILURE_CODES.length === 17.
    packages/core/src/conformance/never-pass-hosted.test.ts: extended HostedFailureCode with
    GitHubWriteOnlyFailureCode | AppAuthFailureCode | EvidenceStoreConflictFailureCode; changed TRIGGERS value type to
    allow a Promise; made the per-code it(...) callback async and awaited the trigger (title and assertions
    unchanged); added 5 triggers - github.write-not-allowed (createGitHubWriter with scope 'app', fetch throws,
    request path not matching the access-tokens pattern so the write is rejected before any fetch), github.write-conflict
    (installation-scoped writer, fetch returns 422), app-auth.credentials-invalid (createAppJwt with a non-PEM key),
    app-auth.token-scope-mismatch (mintInstallationToken with a real RSA key and a local fetch stub answering
    installation lookup, access-tokens mint with a permission mismatch, and token revocation), and
    evidence.store-conflict (commitEvidence with a shared client/writer/fetch stub answering ref lookup 404, blob/tree/commit
    creates 201, and the final git/refs create 422 "Reference already exists", with writeRetries: 1 so the retry is
    exhausted and evidence.store-conflict is returned).
- acceptance: |
    pnpm vitest run packages/core/src/exports.test.ts packages/core/src/conformance/invariant-5.test.ts packages/core/src/conformance/never-pass-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.12.json
    -> Test Files 3 passed (3); Tests 496 passed (496); exit 0

    node -e "...titles ok check..."
    -> titles ok

    pnpm vitest run
    -> Test Files 163 passed (163); Tests 3062 passed (3062); exit 0

    pnpm typecheck
    -> exit 0, no output

    pnpm build
    -> core, cli, action, web all built "Done"; exit 0

    node -e "...dist exports check..."
    -> dist exports ok

    grep -c "^export \* from" packages/core/src/index.ts
    -> 105

    pnpm exec eslint packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
    -> exit 0, no output

    pnpm exec prettier --check packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
    -> "Checking formatting...\nAll matched files use Prettier code style!"; exit 0

    git diff --quiet HEAD -- packages/core/src/conformance/invariant-5.test.ts
    -> exit 0 (file unchanged)

    node -e "...control/bidi/zero-width character check..."
    -> clean
- deviations: none (node_modules/.m6-p2-2.12.json is a scratch acceptance artifact under node_modules, not tracked
    by git and outside files_in_scope; it was removed after the check).
