- status: pass
- base: 937e51a7a59e9e7237b19c29ced20f6592d0988c
- changes: |
    .github/workflows/steward-screening.yml: replaced both `    environment: steward-publication` lines (job gate, job
    publish) with the mapping form:
        environment:
          name: steward-publication
          deployment: false
    Replaced the header comment (lines 4-5) with the four-line version explaining deployment: false and the Deployment
    side effect, per actions.
    packages/core/src/conformance/workflows.fixture.test.ts: replaced the two `toBe('steward-publication')` assertions
    in the `only gate and publish declare the publication environment` test with a loop over [gate, publish] asserting
    `toEqual({ name: 'steward-publication', deployment: false })` and that the environment object's keys are exactly
    ['deployment', 'name'], using the existing `record` helper. No other lines in the test file changed.
- acceptance: |
    1. actionlint .github/workflows/steward-screening.yml templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml; echo "exit $?"
       -> exit 0
    2. tr -d '\r' < .github/workflows/steward-screening.yml | grep -c -x -E '    environment:|      name: steward-publication|      deployment: false'
       tr -d '\r' < .github/workflows/steward-screening.yml | grep -c 'environment: steward-publication'
       tr -d '\r' < .github/workflows/steward-screening.yml | grep -c -F 'Both declare it with deployment: false'
       -> 6
       -> 0
       -> 1
    3. pnpm vitest run packages/core/src/conformance/workflows.fixture.test.ts packages/core/src/conformance/invariant-1-workflows.fixture.test.ts packages/core/src/pipeline/hosted-verify.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p5-526.json > /dev/null 2>&1; echo "vitest $?"; node -e "..."
       -> vitest 0
       -> titles ok 0
    4. grep -c -F "toEqual({ name: 'steward-publication', deployment: false })" packages/core/src/conformance/workflows.fixture.test.ts
       grep -c -F "toBe('steward-publication')" packages/core/src/conformance/workflows.fixture.test.ts
       -> 1
       -> 0
    5. pnpm exec prettier --check ...; pnpm exec eslint ...; pnpm exec tsc --noEmit -p packages/core/tsconfig.test.json
       -> prettier 0
       -> eslint 0
       -> tsc 0
    6. bash scenarios/tools/secret-scope.sh check
       -> SECRET-SCOPE check=mapping identical
       -> SECRET-SCOPE check=declarations identical
    7. git status --porcelain -- templates packages/action packages/cli pnpm-lock.yaml package.json
       -> (no output)
- deviations: none
