- status: pass
- base: af7afd88a4e1500f7df85d4181fd7a0d063eb740
- changes: |
    Created packages/core/src/github/writer.ts: the allowlisted GitHub writer. Exports GITHUB_WRITE_FAILURE_CODES,
    GitHubWriteOnlyFailureCode, GitHubWriteFailureCode, GITHUB_WRITE_FAILURE_CAUSES, githubWriteFailure, GitHubWriteMethod,
    GitHubWriteRequest, GitHubStoreScope, GitHubWriteScope, GitHubWriteFetchInit, GitHubWriteFetch, GitHubAnyFetch,
    GitHubWriterOptions, GitHubWriter, githubRepositoryPath, githubBranchRefPath, isAllowedGitHubWrite, createGitHubWriter. Reuses
    githubFailure, GITHUB_API_BASE_URL, GITHUB_API_VERSION, GITHUB_USER_AGENT, GitHubFailureCode, GitHubFetchInit from client.ts
    (client.ts untouched), GitHubBudget from budget.ts, GitHubRepositoryRef from reader.ts, err/ok/Err/FailureDetail/Result from
    result.ts, FailureCause from vocabulary.ts, and the three bounds from policy/bounds.ts. isAllowedGitHubWrite implements the
    exact allowlist (app access-token mint, installation token revoke, and the five store git-data-API writes) with strict body
    shape checks (exact key sets, OBJECT_ID pattern, mode/type/force pins). createGitHubWriter duplicates client.ts's token/path
    validation, bounded body read, 401/404/422/403/429/5xx/timeout/network handling, and retry loop, adapted for
    POST/PATCH/DELETE with optional JSON bodies, precheck ordering (token -> path -> allowlist, all before any budget charge or
    fetch), and send/sendNoContent status semantics (200/201 vs 204).

    Created packages/core/src/github/writer.test.ts (describe 'github writer') with plain it(...) and the exact 9 titles
    specified in actions, covering: allowlist positives, the full scope x method x path rejection matrix (asserting exactly 8
    true results), zero-fetch/zero-budget rejection, body-shape allowlist rejections, pinned request headers and JSON body
    round-trip, 422 write-conflict, server-error retry/exhaustion/budget-exhaustion, sendNoContent 204/200 handling, and that
    failure results never contain sentinel response text or the token.
- acceptance: |
    pnpm vitest run packages/core/src/github/writer.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.2.json
    -> Test Files 1 passed (1), Tests 9 passed (9); exit 0

    node -e "...titles check..."
    -> titles ok

    git diff --quiet HEAD -- packages/core/src/github/client.ts packages/core/src/github/client.test.ts
    -> exit 0 (client diff exit: 0)

    pnpm vitest run
    -> Test Files 154 passed (154), Tests 2937 passed (2937); exit 0

    pnpm typecheck
    -> exit 0, no output

    pnpm exec eslint packages/core/src/github/writer.ts packages/core/src/github/writer.test.ts
    -> exit 0, no output

    pnpm exec prettier --check packages/core/src/github/writer.ts packages/core/src/github/writer.test.ts
    -> "Checking formatting...\nAll matched files use Prettier code style!"; exit 0

    cat packages/core/src/github/writer.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
    -> 0 (grep exit 1)

    node -e "...control/bidi/zero-width scan..." packages/core/src/github/writer.ts packages/core/src/github/writer.test.ts
    -> clean
- deviations: none
