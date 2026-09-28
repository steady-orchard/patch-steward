- status: pass
- base: 4c1a2d8ff527cbeffeb16c940f42901f2f2709c3
- changes: |
    Added packages/core/src/pipeline/hosted-verify.fixture.test.ts (new file only; no product code changed). It copies the
    payload/eventNameFor/environmentFor/buildGateDeps/gate/upload/gateFilesOf/publish/requireOk helpers from
    hosted-publish-scenarios.fixture.test.ts (not imported from it), imports createStoreWorld, createHostedWorld,
    WORLD_REPOSITORY, WORLD_RUN_ID from the shared test fakes, and verifyRunDirectory from ../evidence/verify.js. describe
    'hosted run directories' has three it(...) cases with the exact required titles:
    - 'a hosted issue run directory verifies like a local run': gates and publishes the issues-opened.json fixture, writes
      every entry of store.files(WORLD_REPOSITORY) to a fresh mkdtempSync('m6-verify-') root (segments split on '/', parent
      dirs created), verifies runs/issue-29/36081628326-1, asserts ok, metrics 'verified', warnings.length 0, and
      decision.outcome === result.outputs.status when result.ok.
    - 'a hosted pull request run directory verifies like a local run': same with pull-request-target-opened.json and
      runs/pr-26/36081628326-1; asserts the evidence commit (result.outputs.evidence_commit or result.evidenceCommit) is
      non-null, then verifies -> ok, metrics 'verified'.
    - 'every committed store file is listed by a manifest or is a metrics file': for the issue run, reads and JSON.parses
      manifest.json, and checks every other store path under the run prefix appears in manifest.json files[].path while
      every store path outside the run prefix starts with '<WORLD_REPOSITORY>/metrics/'.
    Temp roots are tracked in an array and removed in afterEach via fs.rmSync(dir, { recursive: true, force: true,
    maxRetries: 5, retryDelay: 100 }). No fetch() call anywhere in the file; only world.fetch is used through the deps
    objects. Ran pnpm exec prettier --write on the new file per action 3 (reformatted quoting/wrapping only).
- acceptance: |
    1. pnpm vitest run packages/core/src/pipeline/hosted-verify.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p4-4.4.json
       Test Files 1 passed (1); Tests 3 passed (3). exit 0.
    2. node -e "...titles..." -> titles ok
    3. node -e "...tmp leak check..." -> exit 0 leaked 0
    4. git grep --untracked -c "fetch(" -- packages/core/src/pipeline/hosted-verify.fixture.test.ts -> no output, grep exit 1
    5. pnpm typecheck -> exit 0 (no diagnostics printed)
    6. pnpm vitest run -> Test Files 187 passed (187); Tests 3460 passed (3460); exit 0
    7. pnpm exec eslint packages/core/src/pipeline/hosted-verify.fixture.test.ts -> exit 0, no output
    8. pnpm exec prettier --check packages/core/src/pipeline/hosted-verify.fixture.test.ts -> "Checking formatting...\nAll matched files use Prettier code style!", exit 0
    9. git status --porcelain -- packages/core/src packages/cli packages/action | grep -v "hosted-verify.fixture.test.ts" -> no output
    10. node -e "...control/bidi/zero-width scan..." packages/core/src/pipeline/hosted-verify.fixture.test.ts -> clean
- deviations: none
