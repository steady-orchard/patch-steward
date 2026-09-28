# Step 5.26

- id: 5.26
- depends_on: []
- route: mechanical
- objective: Product fix for the Deployment side effect: in .github/workflows/steward-screening.yml make jobs gate and publish declare the publication Environment as the mapping `name: steward-publication` plus `deployment: false`, and update the static workflow test assertion (title unchanged).
- files_in_scope:
    - .github/workflows/steward-screening.yml
    - packages/core/src/conformance/workflows.fixture.test.ts
    - development-artifacts/patch-steward-m6-5.26-report.md
- context: |
    Git Bash; run every command from your tree root. core.autocrlf=true: the working tree is CRLF; strip CR before comparing
    text and never anchor a grep with `$` on file contents. jq is NOT installed. actionlint 1.7.12 is installed. Never run a
    formatter on development-artifacts/. No network access is needed; make no GitHub request.

    Why: in the string form `environment: steward-publication`, every Environment-declaring job of a pull_request_target
    run makes GitHub Actions create a Deployment on the pull request head (measured on a test-bed: 40 Deployments on five
    pull request heads). The mapping form with `deployment: false` keeps the Environment secrets and the Environment's
    default-branch-only deployment branch policy (measured) and creates no Deployment. Binding rule: jobs `gate` and
    `publish` each declare exactly
        environment:
          name: steward-publication
          deployment: false
    at job level (4, 6, 6 spaces of indentation), in place of the single line `    environment: steward-publication`.
    No other job declares an Environment. Nothing else in the workflow changes except the header comment below.
    This is the ONLY product change: never edit templates/, packages/core/src (other than the one test file in scope),
    packages/action/, any package.json, or pnpm-lock.yaml.

    The static workflow test (packages/core/src/conformance/workflows.fixture.test.ts) parses the workflow with the strict
    YAML parser; `deployment: false` parses as the boolean false. Test titles stay EXACTLY as they are; the test
    `only gate and publish declare the publication environment` currently holds these two lines:
        expect(gate['environment']).toBe('steward-publication');
        expect(publish['environment']).toBe('steward-publication');
    The helper `record(value, label)` already exists in that file (it asserts a plain object and returns it).
- actions: |
    1. In .github/workflows/steward-screening.yml replace BOTH occurrences of the line `    environment: steward-publication`
       (one in job gate, one in job publish) with these three lines (exact indentation 4, 6, 6 spaces):
           environment:
             name: steward-publication
             deployment: false
    2. In the same file replace the two header comment lines
           # Only gate and publish declare the publication Environment and receive the App credentials, and only in the step that
           # runs the steward. The workflow has no other trigger, so it never runs in this repository.
       with these four lines (each starts at column 0 with `# `):
           # Only gate and publish declare the publication Environment and receive the App credentials, and only in the step that
           # runs the steward. Both declare it with deployment: false: a job that deploys to an Environment makes GitHub Actions
           # record a Deployment on the pull request head of every pull_request_target run; the Environment secrets and its
           # branch restriction still apply. The workflow has no other trigger, so it never runs in this repository.
    3. In packages/core/src/conformance/workflows.fixture.test.ts replace the two `toBe('steward-publication')` lines quoted in
       context with exactly (4-space indentation inside the test body, as the surrounding lines):
           for (const job of [gate, publish]) {
             expect(job['environment']).toEqual({ name: 'steward-publication', deployment: false });
             expect(Object.keys(record(job['environment'], 'environment')).sort()).toEqual(['deployment', 'name']);
           }
       Change nothing else in the test file (titles, other assertions, and the build and wrapper checks stay).
    4. pnpm install --frozen-lockfile; then `pnpm exec prettier --write .github/workflows/steward-screening.yml
       packages/core/src/conformance/workflows.fixture.test.ts` (only these two files) and run the acceptance commands.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. actionlint .github/workflows/steward-screening.yml templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml; echo "exit $?"
       -> prints exactly: exit 0
    2. tr -d '\r' < .github/workflows/steward-screening.yml | grep -c -x -E '    environment:|      name: steward-publication|      deployment: false'; tr -d '\r' < .github/workflows/steward-screening.yml | grep -c 'environment: steward-publication'; tr -d '\r' < .github/workflows/steward-screening.yml | grep -c -F 'Both declare it with deployment: false'
       -> prints exactly three lines: 6, 0, 1
    3. pnpm vitest run packages/core/src/conformance/workflows.fixture.test.ts packages/core/src/conformance/invariant-1-workflows.fixture.test.ts packages/core/src/pipeline/hosted-verify.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p5-526.json > /dev/null 2>&1; echo "vitest $?"; node -e "const r=require('./node_modules/.m6-p5-526.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['only gate and publish declare the publication environment','every action and reusable workflow is pinned by full commit sha','wrappers pass secrets by explicit mapping','every job declares empty permissions','the credential-free build job holds no secret','workflows use only the steward secret names','no event text reaches a run step','run-name uses only numeric and enumerated values','a hosted issue run directory verifies like a local run'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok '+r.numFailedTests)"
       -> prints exactly two lines: vitest 0, titles ok 0
    4. grep -c -F "toEqual({ name: 'steward-publication', deployment: false })" packages/core/src/conformance/workflows.fixture.test.ts; grep -c -F "toBe('steward-publication')" packages/core/src/conformance/workflows.fixture.test.ts
       -> prints exactly two lines: 1, 0
    5. pnpm exec prettier --check .github/workflows/steward-screening.yml packages/core/src/conformance/workflows.fixture.test.ts > /dev/null 2>&1; echo "prettier $?"; pnpm exec eslint packages/core/src/conformance/workflows.fixture.test.ts > /dev/null 2>&1; echo "eslint $?"; pnpm exec tsc --noEmit -p packages/core/tsconfig.test.json > /dev/null 2>&1; echo "tsc $?"
       -> prints exactly three lines: prettier 0, eslint 0, tsc 0
    6. bash scenarios/tools/secret-scope.sh check
       -> prints exactly two lines: SECRET-SCOPE check=mapping identical, SECRET-SCOPE check=declarations identical
    7. git status --porcelain -- templates packages/action packages/cli pnpm-lock.yaml package.json
       -> no output
- rollback: |
    git revert <this step's commit> (restores the string form and the old assertion; nothing was pushed or deployed).
