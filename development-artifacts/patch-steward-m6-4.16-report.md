- status: pass
- base: 2dda60e8776e47151835dc4bd90ca0c8e1f19982
- changes: |
    packages/core/src/github/github.live.test.ts:
    - Added `fork` GitHubRepositoryRef for jambolo/patch-steward-testbed-public.
    - Test 'live: test-bed branch head and directory listing validate': replaced the "no patch-steward entry" assertion
      with an assertion that the `.github` listing has a 'patch-steward' entry of type 'dir'.
    - Renamed 'live: test-bed has no published policy' to 'live: the unsynced fork has no published policy' and pointed
      it at the fork repository/branch 'master'; same failure-code/outcome expectations.
    - Added new test 'live: test-bed published policy loads and validates' asserting loadPolicy success against the
      org-public repo: revision.kind 'git-tree' (narrowed before reading revision.commit/ref, since PolicyRevision is a
      discriminated union and the local-file variant lacks those fields), revision.id/commit match 40-hex, revision.ref
      'master', authoritative true, policy.evidence.store deep-equals { type: 'orphan-branch', branch: 'steward-evidence' },
      policy.modes.default 'observe'.

    packages/cli/src/steward-commands.live.test.ts:
    - Added `FORK = 'jambolo/patch-steward-testbed-public'` constant next to REPO.
    - Test 'live: screen without a published policy exits 2 and writes no run' now runs against FORK instead of REPO.

    No other tests, helpers, or the REPO constant were changed in either file.
- acceptance: |
    1. GH_TOKEN=$(gh auth token) pnpm test:live --reporter=json --outputFile=node_modules/.m6-p4-4.16.json
       -> exit 0 (JSON report written to C:/w/m6-4.16/node_modules/.m6-p4-4.16.json)

    2. node -e "...assertionResults status check..."
       -> live ok

    3. node -e "...tmpdir leak check spawning pnpm test:live..."
       -> exit 0 leaked 0

    4. git status --porcelain -- packages/cli/src packages/core/src | grep -v -E 'github\.live\.test\.ts|steward-commands\.live\.test\.ts'
       -> (no output)

    5. pnpm typecheck
       -> tsc --noEmit across core/cli/action/web tsconfig.test.json, exit 0
          (initial run failed with TS2339 on revision.commit/revision.ref against the PolicyRevision union; fixed by
          narrowing on revision.kind === 'git-tree' before reading those fields, then re-ran to exit 0)

    6. pnpm vitest run
       -> Test Files 189 passed (189), Tests 3474 passed (3474), exit 0

    7. pnpm exec eslint packages/core/src/github/github.live.test.ts packages/cli/src/steward-commands.live.test.ts
       -> exit 0, no output

    8. pnpm exec prettier --check packages/core/src/github/github.live.test.ts packages/cli/src/steward-commands.live.test.ts
       -> "All matched files use Prettier code style!", exit 0

    Base check (action 1):
    gh api repos/steady-orchard/patch-steward-testbed-public/contents/.github/patch-steward/policy.yml?ref=master --jq .sha
       -> eef9b9f340313b44865c6133ecb09941a9c9071f
    git rev-parse HEAD:scenarios/fixtures/policies/orphan-branch.yml
       -> eef9b9f340313b44865c6133ecb09941a9c9071f (match)
    gh api repos/jambolo/patch-steward-testbed-public/contents/.github?ref=master
       -> HTTP 404 Not Found (as required)
- deviations: |
    Action 2 said "Edit both files per context; run `pnpm exec prettier --write` on both" with no mention of a type
    narrow; the initial straightforward implementation (reading revision.commit and revision.ref directly off
    result.value.revision) failed pnpm typecheck because PolicyRevision is a discriminated union and only the
    'git-tree' variant carries commit/ref. Added an explicit `if (revision.kind !== 'git-tree') return;` narrow, which
    is standard TypeScript practice for this kind of union and required to satisfy the packet's own acceptance check 5.
    No other deviation from the specified edits.
