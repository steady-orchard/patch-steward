- status: pass
- base: eaada422b4371829712a41a87a78e441cc62c519
- changes: |
    Added packages/core/src/conformance/workflows.fixture.test.ts: fixture-tier vitest suite (describe 'steward workflows',
    12 plain it(...) tests) that loads .github/workflows/steward-screening.yml, templates/workflows/steward-pr.yml, and
    templates/workflows/steward-issues.yml via `new URL('../../../../<path>', import.meta.url)`, normalizes CRLF to LF,
    and parses each with parseStrictYaml (from ../strict-yaml.js) using bounds {maxBytes: 1048576, maxDepth: 64,
    maxNodes: 100000}. Imports PULL_REQUEST_EVENT_ACTIONS/ISSUE_EVENT_ACTIONS from ../vocabulary.js and
    STEWARD_WRAPPER_PATHS from ../ownership/caps.js. Uses small local record/array/string type guards (no `any`) to
    narrow the parsed unknown values. Pins the exact strings from the step context (SECRET_ENV, PUBLISH_IF,
    PUBLISH_GROUP, GATE_OUTPUTS, WRAPPER_USES_PREFIX, ALLOWED_ACTIONS, and the probe secret-name pattern built by
    string concatenation). The 12 tests verify: workflow_call-only trigger and its inputs/secrets; empty permissions
    everywhere; environment restricted to gate/publish with 'secrets.' confined to the gate/publish core step env;
    the credential-free build job (steward_ref check, pinned checkout, install/build, pack step, runtime upload,
    outputs); gate/publish downloading and sha256-verifying the runtime before running the pinned core step without
    any install tooling; every `uses` pinned by full commit SHA with an inline `# comment` and restricted to the
    allowed action set; wrapper pin equals its steward_ref input; wrappers pass secrets by explicit mapping (never
    'inherit'); wrappers accept only the screened event types and names, matching STEWARD_WRAPPER_PATHS basenames;
    job/timeout/publish-if/concurrency shape; gate outputs and the ordered upload/commitment steps, plus the
    STEWARD_GATE_* env passed into publish's core step; and that only the two steward secret names appear anywhere
    in the three workflow texts. No temp directories, network, or child processes are used. Ran
    `pnpm exec prettier --write` on the test file per the step's actions.

    Added development-artifacts/patch-steward-m6-4.10-report.md (this report).
- acceptance: |
    1. pnpm vitest run packages/core/src/conformance/workflows.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p4-4.10.json
       -> exit 0

    2. node -e "...need 12 titles..." -> 12 required; titles ok

    3. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- packages/core/src/conformance/workflows.fixture.test.ts
       -> no output, exit 1

    4. git grep --untracked -c -E "fetch\(|child_process|mkdtemp" -- packages/core/src/conformance/workflows.fixture.test.ts
       -> no output, exit 1

    5. pnpm typecheck -> exit 0 (all four tsconfig.test.json projects passed with no errors)

    6. pnpm vitest run -> Test Files 188 passed (188), Tests 3472 passed (3472), exit 0

    7. pnpm exec eslint packages/core/src/conformance/workflows.fixture.test.ts
       -> first run failed with "Unnecessary escape character: \/  no-useless-escape" at the USES_PATTERN regex;
          fixed by removing the unneeded escape of '/' inside the character class ([A-Za-z0-9_./-] instead of
          [A-Za-z0-9_.\/-]), same matched set. Re-run -> exit 0, no problems.

    8. pnpm exec prettier --check packages/core/src/conformance/workflows.fixture.test.ts
       -> "All matched files use Prettier code style!", exit 0

    9. git status --porcelain -- .github templates packages/core/src/strict-yaml.ts packages/core/src/vocabulary.ts packages/core/src/ownership
       -> no output

    10. node -e "...control/bidi/zero-width scan..." packages/core/src/conformance/workflows.fixture.test.ts
        -> clean
- deviations: none
