- status: pass
- base: af7afd88a4e1500f7df85d4181fd7a0d063eb740
- changes: |
    Recorded 10 read-only `gh api` GET responses (per the reductions in context) from
    steady-orchard/patch-steward-testbed-public into fixtures/github/hosted/: artifacts-page.json,
    runs-page.json, runs-in-progress.json, ref-heads-master.json, git-commit-master.json,
    compare-parent-master.json, tree-master-github.json, contents-readme.json,
    contents-github-directory.json, user-app-bot.json. Recorded date: 2026-09-28.
    Inserted the specified bullet (with 2026-09-28) into fixtures/README.md right after the
    `github/policy-directory/` bullet. Ran `pnpm exec prettier --write` on the new fixture files
    and fixtures/README.md.
- acceptance: |
    ls fixtures/github/hosted | sort | paste -sd ' ' -
    artifacts-page.json compare-parent-master.json contents-github-directory.json contents-readme.json git-commit-master.json ref-heads-master.json runs-in-progress.json runs-page.json tree-master-github.json user-app-bot.json

    node -e "...recordings ok check..."
    recordings ok

    grep -rlE "[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+" fixtures/github/hosted
    (no output, exit 1)

    grep -rlE "ghs_|ghp_|BEGIN [A-Z ]*PRIVATE KEY|sig=|STEWARD_APP_" fixtures/github/hosted
    (no output, exit 1)

    pnpm vitest run packages/core/src/github/recorded-responses.fixture.test.ts
    Test Files  1 passed (1)
    Tests  10 passed (10)

    pnpm exec prettier --check fixtures/github/hosted fixtures/README.md
    All matched files use Prettier code style!

    grep -c "github/hosted/" fixtures/README.md
    1

    grep -cE "\bM0[0-9]\b|\bM1[0-9]\b|development-artifacts|\bPD0[1-8]\b" fixtures/README.md
    0 (grep exit 1)

    node -e "...control/bidi/zero-width scan..." fixtures/README.md fixtures/github/hosted/*.json
    clean
- deviations: none
