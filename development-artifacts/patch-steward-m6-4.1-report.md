- status: pass
- base: 4c1a2d8ff527cbeffeb16c940f42901f2f2709c3
- changes: |
    templates/policy/policy.yml: line 214 `branch: patch-steward-evidence` -> `branch: steward-evidence`.
    packages/core/src/submission/default-checklist.ts: line 254 `branch: 'patch-steward-evidence',` -> `branch: 'steward-evidence',`.
- acceptance: |
    git grep -n "patch-steward-evidence" -- templates packages/core/src/submission/default-checklist.ts
    (no output, exit 1)

    git grep -c "branch: steward-evidence" -- templates/policy/policy.yml
    templates/policy/policy.yml:1

    git grep -c "branch: 'steward-evidence'," -- packages/core/src/submission/default-checklist.ts
    packages/core/src/submission/default-checklist.ts:1

    git grep -c "patch-steward-evidence" -- fixtures/policies/valid/minimal-no-llm.yml
    fixtures/policies/valid/minimal-no-llm.yml:1

    pnpm vitest run packages/core/src/submission/default-checklist.test.ts
    Test Files  1 passed (1)
    Tests  4 passed (4)
    exit 0

    pnpm build > /dev/null && node packages/cli/dist/main.js policy --file templates/policy/policy.yml > /dev/null; echo "exit $?"
    (warning printed to stderr: policy.llm-model-placeholder)
    exit 0

    pnpm typecheck
    exit 0

    pnpm vitest run
    Test Files  186 passed (186)
    Tests  3440 passed (3440)
    exit 0

    pnpm exec prettier --check templates/policy/policy.yml packages/core/src/submission/default-checklist.ts
    All matched files use Prettier code style!
    exit 0

    git status --porcelain -- fixtures
    (no output)
- deviations: none
