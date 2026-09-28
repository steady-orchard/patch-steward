- status: pass
- base: ded94d936391ac61e872394f93f9a1651209ed8f
- changes: |
    Added packages/core/src/github/runs.ts: githubWorkflowRunSchema, RunListFilter, readRunList (validates repository via
    repositoryRefFromFullName and created-since date/status filter, builds query, calls client.getPaginatedList against
    /repos/{owner}/{name}/actions/runs with RUN_LIST_PAGES_MAX, maps items to RunListItem shape, status null -> ''), CapRunLists,
    readCapRunLists (sequential createdToday/inProgress/queued reads; on first failure returns that failure and marks the
    unread remainder { items: [], totalCount: 0, complete: false } without requesting them).
    Added packages/core/src/github/runs.test.ts covering the six required scenarios with a recording fake fetch, including
    the evaluateCaps integration check for 'caps.run-list-unavailable'.
    Ran prettier --write on both files (runs.ts unchanged, runs.test.ts reformatted).
- acceptance: |
    pnpm vitest run packages/core/src/github/runs.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.8.json
    -> exit 0, "JSON report written to ...node_modules/.m6-p2-2.8.json"

    node -e "...titles..." -> titles ok

    pnpm vitest run -> Test Files 158 passed (158); Tests 2967 passed (2967); exit 0

    pnpm typecheck -> exit 0 (no output, all four tsc -p invocations succeeded)

    pnpm exec eslint packages/core/src/github/runs.ts packages/core/src/github/runs.test.ts -> exit 0, no output

    pnpm exec prettier --check packages/core/src/github/runs.ts packages/core/src/github/runs.test.ts -> "Checking
    formatting...\nAll matched files use Prettier code style!", exit 0

    cat packages/core/src/github/runs.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process" -> 0

    node -e "...control/bidi char scan..." packages/core/src/github/runs.ts packages/core/src/github/runs.test.ts -> clean
- deviations: none
