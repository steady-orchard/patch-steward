- status: pass
- base: 4f5d5ab996dfc0d09ef285e4251f13c2c8aafdd9
- changes: |
    packages/core/src/policy/loader.ts: extracted the tree/blob/validate/resolve/dockerfile-check part of loadFromGitHub into a
    private loadFromGitHubTree(client, repository, treeId, commit, ref) helper with identical checks, codes, and messages;
    loadFromGitHub now calls it with (client, repository, treeId, commit, branch) after its unchanged head/directory steps. Added
    exported GitHubPolicyRevisionSource interface and loadPolicyRevision(source), which validates treeId/commit against
    /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/ and ref as 1..255 chars in 33..126 before any request, returning githubFailure('github.invalid-
    request', ...) with zero requests on failure, else delegating to loadFromGitHubTree.
    packages/core/src/policy/loader-revision.test.ts: new file, describe 'policy load by revision', with the six it/test titles
    specified in actions, a synthetic fetch keyed by URL pathname+search, policy bytes from fixtures/policies/valid/minimal-no-
    llm.yml, and createGitHubClient/createGitHubBudget from the github package as specified.
    packages/core/src/conformance/invariant-5.test.ts: added 'loadPolicyRevision' after 'loadPolicy' in both expected sorted-name
    lists; pushed a loadPolicyRevision rejection (invalid treeId 'x' with a throwing fetch) into the first test's `results`, and
    added the same call via expectResultRejection(..., 'github.invalid-request') in the second test. No other lines changed.
    Ran `pnpm exec prettier --write` on all three files (loader.ts and invariant-5.test.ts were already formatted; the new test
    file was reformatted).
- acceptance: |
    1. pnpm vitest run packages/core/src/policy packages/core/src/conformance/invariant-5.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.1.json
       -> EXIT=0

    2. node -e "...titles ok check..."
       -> titles ok

    3. node -e "...loadPolicyRevision literal count check..."
       -> listed

    4. git diff --quiet 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/policy/loader-github.test.ts packages/core/src/policy/loader-github.fixture.test.ts packages/core/src/policy/loader.test.ts; echo "unchanged $?"
       -> unchanged 0

    5. pnpm vitest run
       -> Test Files  164 passed (164); Tests  3068 passed (3068); EXIT=0

    6. pnpm typecheck
       -> EXIT=0 (all four package tsconfig.test.json projects)

    7. pnpm exec eslint packages/core/src/policy/loader.ts packages/core/src/policy/loader-revision.test.ts packages/core/src/conformance/invariant-5.test.ts
       -> EXIT=0

    8. pnpm exec prettier --check packages/core/src/policy/loader.ts packages/core/src/policy/loader-revision.test.ts packages/core/src/conformance/invariant-5.test.ts
       -> "Checking formatting...\nAll matched files use Prettier code style!"; EXIT=0

    9. node -e "...forbidden-character scan..." packages/core/src/policy/loader.ts packages/core/src/policy/loader-revision.test.ts packages/core/src/conformance/invariant-5.test.ts
       -> clean
- deviations: none
