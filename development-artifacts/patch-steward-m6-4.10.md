# Step 4.10

- id: 4.10
- depends_on: [4.2, 4.3]
- route: mechanical
- objective: Add the fixture-tier static workflow tests packages/core/src/conformance/workflows.fixture.test.ts that prove the reusable screening workflow and both wrapper templates keep the approved security structure (Environment, secrets, permissions, pins, runtime build, jobs, publish condition, concurrency, outputs, events).
- files_in_scope:
    - packages/core/src/conformance/workflows.fixture.test.ts
    - development-artifacts/patch-steward-m6-4.10-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest); Git Bash; run every command from your tree root. core.autocrlf=true
    (never anchor a grep with `$`). jq is NOT installed (use node). Relative imports need `.js`. Strict TS
    (noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals). Prettier: single quotes, printWidth 132. `*.fixture.test.ts`
    files run in `pnpm test` (Vitest project `fixture`).

    Files under test (files changed in steps 4.2 and 4.3; read them first, they are the spec's concrete form):
    - W = .github/workflows/steward-screening.yml (reusable workflow; jobs build, gate, publish)
    - P = templates/workflows/steward-pr.yml, I = templates/workflows/steward-issues.yml (wrappers; one job `screen`)
    Load each with `new URL('../../../../<path>', import.meta.url)`; keep the raw text (CRLF -> LF) and parse the bytes with
    parseStrictYaml(bytes, { maxBytes: 1048576, maxDepth: 64, maxNodes: 100000 }) from '../strict-yaml.js' (expect ok; YAML 1.2
    core schema, so `on` is a plain string key). Also import PULL_REQUEST_EVENT_ACTIONS and ISSUE_EVENT_ACTIONS from
    '../vocabulary.js' and STEWARD_WRAPPER_PATHS from '../ownership/caps.js'. Treat parsed values as unknown and narrow with small
    local helpers (record/array/string guards); no `any`.

    Exact strings the tests pin (copy exactly):
    - SECRET_ENV = { PATCH_STEWARD_APP_ID: '${{ secrets.PATCH_STEWARD_APP_ID }}', PATCH_STEWARD_APP_PRIVATE_KEY:
      '${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}' } (the wrapper `secrets` mapping and the core step's secret env keys)
    - PUBLISH_IF = "${{ always() && needs.gate.result == 'success' && (needs.gate.outputs.committed == 'true' || needs.gate.outputs.record_only == 'true') }}"
    - PUBLISH_GROUP = "${{ needs.gate.outputs.concurrency_group || format('steward-{0}-run-{1}', github.repository_id, github.run_id) }}"
    - GATE_OUTPUTS = { committed: '${{ steps.commitment.outputs.committed }}', record_only: '${{ steps.core.outputs.record_only }}',
      disposition: '${{ steps.core.outputs.disposition }}', concurrency_group: '${{ steps.core.outputs.concurrency_group }}',
      snapshot_hash: '${{ steps.core.outputs.snapshot_hash }}', policy_revision: '${{ steps.core.outputs.policy_revision }}' }
    - WRAPPER_USES_PREFIX = 'steady-orchard/patch-steward/.github/workflows/steward-screening.yml@'
    - ALLOWED_ACTIONS = actions/checkout, actions/setup-node, actions/upload-artifact, actions/download-artifact
    - Probe secret-name pattern, built by concatenation so the source never holds a contiguous probe name:
      new RegExp('(?<!PATCH_)STEWARD_' + 'APP_(ID|PRIVATE_KEY|CLIENT_ID)')

    Test file packages/core/src/conformance/workflows.fixture.test.ts, describe 'steward workflows', plain it(...) titles EXACTLY
    (twelve tests; each asserts at least the listed facts):
    1. 'the reusable workflow is callable only': W.on has exactly the key workflow_call; its inputs have exactly steward_ref
       (required true, type 'string'); its secrets have exactly PATCH_STEWARD_APP_ID and PATCH_STEWARD_APP_PRIVATE_KEY, each
       required false; W has no top-level concurrency and no run-name.
    2. 'every job declares empty permissions': in W, P, and I the top-level permissions deep-equal {} and every job's
       permissions deep-equal {}.
    3. 'only gate and publish declare the publication environment': W job ids are exactly build, gate, publish (in that order);
       gate.environment and publish.environment are 'steward-publication'; build has no environment key; P and I jobs have no
       environment key; in W, the substring 'secrets.' occurs (searching every string value under `jobs`, recursively) only in
       the `env` of the step with id 'core' in gate and in publish; each of those two env maps contains the two SECRET_ENV
       entries exactly (key and value); no other step of any W job has an env value containing 'secrets.'.
    4. 'the credential-free build job holds no secret': JSON.stringify(build) contains neither 'secrets.' nor 'github.token';
       build has no environment; the first step's run matches /\^\[0-9a-f\]\{40\}\$/ (the steward_ref check, text
       `^[0-9a-f]{40}$`) and its env STEWARD_REF is '${{ inputs.steward_ref }}'; the next step uses actions/checkout@<sha> with
       with.repository 'steady-orchard/patch-steward', with.ref '${{ inputs.steward_ref }}', with.path 'steward',
       with['persist-credentials'] === false; a later run step contains 'corepack enable', 'pnpm install --frozen-lockfile
       --ignore-scripts', and 'pnpm build'; the step with id 'pack' runs 'packages/action/pack-runtime.sh'; an
       actions/upload-artifact step has with.name 'steward-runtime' and with['retention-days'] === 1; build.outputs deep-equals {
       runtime_sha256: '${{ steps.pack.outputs.runtime_sha256 }}' }.
    5. 'gate and publish run the verified runtime without installing': in gate and publish, no step uses actions/checkout and no
       run text contains 'pnpm', 'npm ', 'corepack', or 'yarn'; each has an actions/download-artifact step with with.name
       'steward-runtime'; after it a run step whose env RUNTIME_SHA256 is '${{ needs.build.outputs.runtime_sha256 }}' and whose
       run contains 'sha256sum' and '52428800' before 'tar -xzf' (string index order); that verify step comes before the step
       with id 'core', whose run contains `packages/action/dist/main.js" gate` (gate) or `packages/action/dist/main.js" publish`
       (publish) (note the closing double quote after main.js in the workflow text).
    6. 'every action and reusable workflow is pinned by full commit sha': every `uses` value in W steps and in P and I jobs
       matches /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.\/-]+)?@[0-9a-f]{40}$/; every W action name (text before '@')
       is in ALLOWED_ACTIONS; every raw line of W, P, I that contains 'uses: ' matches /uses: \S+@[0-9a-f]{40} # \S/; no raw text
       contains 'pnpm/action-setup' or 'actions/cache'.
    7. 'the wrapper pin equals its steward_ref input': for P and I, jobs has exactly the key screen; screen.uses starts with
       WRAPPER_USES_PREFIX; the 40 hex after '@' === screen.with.steward_ref, and typeof steward_ref === 'string'.
    8. 'wrappers pass secrets by explicit mapping': for P and I, screen.secrets deep-equals SECRET_ENV (an object, never the
       string 'inherit'); the raw text does not contain 'inherit'.
    9. 'wrappers accept only the screened events': P.on has exactly the key pull_request_target with types deep-equal to
       [...PULL_REQUEST_EVENT_ACTIONS]; I.on has exactly the key issues with types deep-equal to [...ISSUE_EVENT_ACTIONS];
       P.name 'steward-pr', I.name 'steward-issues'; the basenames of STEWARD_WRAPPER_PATHS are exactly 'steward-pr.yml' and
       'steward-issues.yml'.
    10. 'jobs, timeouts, publish condition, and concurrency match the design': runs-on 'ubuntu-latest' for build, gate, publish;
        timeout-minutes build 15, gate 10, publish 20; gate.needs is 'build' or ['build']; publish.needs deep-equals ['build',
        'gate']; publish.if === PUBLISH_IF; publish.concurrency deep-equals { group: PUBLISH_GROUP, 'cancel-in-progress': false };
        build and gate have no concurrency key.
    11. 'gate outputs come from the core step and the commitment step': gate.outputs deep-equals GATE_OUTPUTS; gate step ids
        include 'core' and 'commitment'; gate upload-artifact steps in order: with.name 'steward-handoff' (retention-days 1,
        if-no-files-found 'error', if "${{ steps.core.outputs.commit == 'true' }}"), 'steward-closure' (retention-days 1, if
        "${{ steps.core.outputs.record_only == 'true' }}"), '${{ steps.core.outputs.ownership_artifact }}' (retention-days 90,
        if-no-files-found 'error', path ending 'steward/ownership/ownership.json'); the handoff upload index < the ownership
        upload index < the commitment step index; the commitment step's if is "${{ steps.core.outputs.commit == 'true' }}" and
        its run contains 'committed=true' and 'GITHUB_OUTPUT'; publish passes STEWARD_GATE_DISPOSITION,
        STEWARD_GATE_RECORD_ONLY, STEWARD_GATE_SNAPSHOT_HASH, STEWARD_GATE_POLICY_REVISION in the core step env as
        '${{ needs.gate.outputs.disposition }}', '${{ needs.gate.outputs.record_only }}', '${{ needs.gate.outputs.snapshot_hash }}',
        '${{ needs.gate.outputs.policy_revision }}'.
    12. 'workflows use only the steward secret names': the probe secret-name pattern matches none of the raw texts of W, P, I;
        W's raw text contains 'secrets.PATCH_STEWARD_APP_PRIVATE_KEY'; every /secrets\.([A-Za-z0-9_]+)/g capture in W, P, I is
        PATCH_STEWARD_APP_ID or PATCH_STEWARD_APP_PRIVATE_KEY.
    If a test fails because a workflow file differs from what these facts require (not because of your test code), STOP and
    report status fail with the verbatim assertion output; never edit the workflow files. No temp directories, no network, no
    child processes. Module and import names must not contain llm, model, copilot, openai, anthropic, sandbox, container,
    docker, or runner.
- actions: |
    1. Base check (files changed in steps 4.2 and 4.3): node -e "const fs=require('fs');const f=['.github/workflows/steward-screening.yml','templates/workflows/steward-pr.yml','templates/workflows/steward-issues.yml'];const m=f.filter(p=>!fs.existsSync(p));console.log(m.length?'MISSING '+m.join(' '):'base ok')"
       It must print `base ok`; otherwise STOP and report status missing-base with the output.
    2. Write packages/core/src/conformance/workflows.fixture.test.ts per context.
    3. Run: pnpm exec prettier --write packages/core/src/conformance/workflows.fixture.test.ts
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/conformance/workflows.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p4-4.10.json -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p4-4.10.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['the reusable workflow is callable only','every job declares empty permissions','only gate and publish declare the publication environment','the credential-free build job holds no secret','gate and publish run the verified runtime without installing','every action and reusable workflow is pinned by full commit sha','the wrapper pin equals its steward_ref input','wrappers pass secrets by explicit mapping','wrappers accept only the screened events','jobs, timeouts, publish condition, and concurrency match the design','gate outputs come from the core step and the commitment step','workflows use only the steward secret names'];const miss=need.filter(t=>!got.has(t));console.log(need.length+' required; '+(miss.length?'MISSING '+JSON.stringify(miss):'titles ok'))"
       -> prints exactly: 12 required; titles ok
    3. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- packages/core/src/conformance/workflows.fixture.test.ts
       -> no output (exit 1)
    4. git grep --untracked -c -E "fetch\(|child_process|mkdtemp" -- packages/core/src/conformance/workflows.fixture.test.ts
       -> no output (exit 1)
    5. pnpm typecheck -> exit 0
    6. pnpm vitest run -> exit 0
    7. pnpm exec eslint packages/core/src/conformance/workflows.fixture.test.ts -> exit 0
    8. pnpm exec prettier --check packages/core/src/conformance/workflows.fixture.test.ts -> exit 0
    9. git status --porcelain -- .github templates packages/core/src/strict-yaml.ts packages/core/src/vocabulary.ts packages/core/src/ownership -> no output
    10. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/conformance/workflows.fixture.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the test file).
