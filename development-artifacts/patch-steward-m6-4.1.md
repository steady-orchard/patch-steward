# Step 4.1

- id: 4.1
- depends_on: []
- route: mechanical
- objective: Rename the policy template's evidence branch from `patch-steward-evidence` to `steward-evidence` in templates/policy/policy.yml and in its embedded copy packages/core/src/submission/default-checklist.ts.
- files_in_scope:
    - templates/policy/policy.yml
    - packages/core/src/submission/default-checklist.ts
    - development-artifacts/patch-steward-m6-4.1-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest); Git Bash; run every command from your tree root. core.autocrlf=true
    (working tree is CRLF: never anchor a grep with `$`). jq is NOT installed (use node). Prettier: single quotes, printWidth 132.
    Never run a formatter on development-artifacts/.

    Decision being implemented (binding): the policy template's `evidence.store.branch` value changes from
    `patch-steward-evidence` to `steward-evidence` (the orphan evidence branch the hosted steward commits to). The same value is
    embedded in packages/core/src/submission/default-checklist.ts (DEFAULT_CHECKLIST_POLICY), and
    packages/core/src/submission/default-checklist.test.ts asserts DEFAULT_CHECKLIST_POLICY deep-equals the resolved template, so
    both change together. The fixture policies under fixtures/ (fixtures/policies/**, fixtures/submissions/proposed-policy-*) KEEP
    `patch-steward-evidence` (both values are valid; packages/core/src/pipeline/hosted-world.test.ts depends on the fixture's
    value): do NOT touch anything under fixtures/ or any test file. No other file changes.

    Exact edits:
    - templates/policy/policy.yml: under `evidence:` / `store:` the line `    branch: patch-steward-evidence` becomes
      `    branch: steward-evidence` (4 leading spaces kept; the only occurrence in the file).
    - packages/core/src/submission/default-checklist.ts: under `evidence: { store: {` the line
      `      branch: 'patch-steward-evidence',` becomes `      branch: 'steward-evidence',` (indentation kept; the only
      occurrence in the file).
- actions: |
    1. Apply the two one-line edits in context (edit in place; keep every other byte, including line endings).
    2. Run: pnpm exec prettier --check templates/policy/policy.yml packages/core/src/submission/default-checklist.ts
       (must pass; if it does not, you changed more than the one line: restore and redo).
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. git grep -n "patch-steward-evidence" -- templates packages/core/src/submission/default-checklist.ts
       -> no output (exit 1)
    2. git grep -c "branch: steward-evidence" -- templates/policy/policy.yml
       -> prints exactly: templates/policy/policy.yml:1
    3. git grep -c "branch: 'steward-evidence'," -- packages/core/src/submission/default-checklist.ts
       -> prints exactly: packages/core/src/submission/default-checklist.ts:1
    4. git grep -c "patch-steward-evidence" -- fixtures/policies/valid/minimal-no-llm.yml
       -> prints exactly: fixtures/policies/valid/minimal-no-llm.yml:1
    5. pnpm vitest run packages/core/src/submission/default-checklist.test.ts -> exit 0
    6. pnpm build > /dev/null && node packages/cli/dist/main.js policy --file templates/policy/policy.yml > /dev/null; echo "exit $?"
       -> prints exactly: exit 0
    7. pnpm typecheck -> exit 0
    8. pnpm vitest run -> exit 0
    9. pnpm exec prettier --check templates/policy/policy.yml packages/core/src/submission/default-checklist.ts -> exit 0
    10. git status --porcelain -- fixtures -> no output
- rollback: |
    git revert <this step's commit> (restores both lines).
