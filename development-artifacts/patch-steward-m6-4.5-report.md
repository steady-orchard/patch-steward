- status: pass
- base: 4c1a2d8ff527cbeffeb16c940f42901f2f2709c3
- changes: |
    Created scenarios/fixtures/policies/orphan-branch.yml, scenarios/fixtures/policies/repository-store.yml, and
    scenarios/fixtures/submissions/unstructured.txt via the exact generator command in actions, derived from
    fixtures/policies/valid/minimal-no-llm.yml (unmodified). orphan-branch.yml changes only the evidence store
    branch name; repository-store.yml changes the store type to `repository`, adds `repository:
    steady-orchard/patch-steward-testbed-evidence`, and sets `branch: steward-evidence`. unstructured.txt is one
    line of plain text (plus trailing newline) with no issue-form headings.
- acceptance: |
    1. pnpm build > /dev/null; for f in orphan-branch repository-store; do node packages/cli/dist/main.js policy --file scenarios/fixtures/policies/$f.yml > /dev/null; echo "$f exit $?"; done
       orphan-branch exit 0
       repository-store exit 0
    2. node -e "...derived ok check..."
       derived ok
    3. node -e "...body ok check..."
       body ok
    4. pnpm exec prettier --check scenarios
       Checking formatting...
       All matched files use Prettier code style!
       (exit 0)
    5. git grep --untracked -n -E 'llm:|mode: (advise|enforce)' -- scenarios/fixtures/policies
       (no output, exit 1)
    6. git status --porcelain -- fixtures
       (no output)
    7. node -e "...control/bidi/zero-width scan..." scenarios/fixtures/policies/orphan-branch.yml scenarios/fixtures/policies/repository-store.yml scenarios/fixtures/submissions/unstructured.txt
       clean
- deviations: none
