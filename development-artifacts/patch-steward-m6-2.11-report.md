- status: pass
- base: 2752d3bdceda1cd70b58321fc254f5c3cf273680
- changes: |
    Added packages/core/src/github/hosted-responses.fixture.test.ts: a new fixture-tier test
    (`describe('recorded hosted GitHub responses')`) that validates the hosted adapters and their
    response schemas against the recorded files under fixtures/github/hosted/, using a fake fetch
    that serves each recorded file verbatim (no network). It:
      - exercises listOwnershipArtifacts + newestOwnershipArtifact against artifacts-page.json,
        deriving every expectation from the file content;
      - exercises readRunList (created-since and in_progress status filters) against
        runs-page.json and runs-in-progress.json, checking totalCount, item mapping, and the
        workflow path pattern;
      - exercises readBranchHead against ref-heads-master.json, validates
        githubGitCommitResponseSchema against git-commit-master.json and evidenceCompareSchema
        against compare-parent-master.json, and checks verifyAppendOnlyCompare's result against
        the recorded compare shape;
      - validates githubTreeResponseSchema against tree-master-github.json and exercises
        verifyReadBackTree for a 'contains' match and mismatch on the first 100644 blob entry;
      - validates githubContentsFileSchema and decodes contents-readme.json's base64 content
        against its recorded size, and validates every entry of
        contents-github-directory.json against githubContentsEntrySchema;
      - validates githubBotUserSchema against user-app-bot.json;
      - asserts findCredentialDetector returns null for every *.json file under
        fixtures/github/hosted/ (10 files found).
    Ran `pnpm exec prettier --write` on the new test file only.
- acceptance: |
    1. pnpm vitest run packages/core/src/github/hosted-responses.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.11.json
       -> exit 0 (JSON report written to node_modules/.m6-p2-2.11.json)
    2. node -e "...verify titles..." -> printed exactly: titles ok
    3. pnpm vitest run -> Test Files 162 passed (162); Tests 3011 passed (3011); exit 0
    4. pnpm typecheck -> completed with no errors; exit 0
    5. pnpm exec eslint packages/core/src/github/hosted-responses.fixture.test.ts -> no output; exit 0
    6. pnpm exec prettier --check packages/core/src/github/hosted-responses.fixture.test.ts -> "Checking formatting...\nAll matched files use Prettier code style!"; exit 0
    7. cat packages/core/src/github/hosted-responses.fixture.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process" -> 0 (grep exit 1)
    8. node -e "...control/bidi/zero-width scan..." packages/core/src/github/hosted-responses.fixture.test.ts -> printed exactly: clean
- deviations: none
