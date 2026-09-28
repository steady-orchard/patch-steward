# Step 4.4

- id: 4.4
- depends_on: []
- route: mechanical
- objective: Add a fixture-tier test proving that a run directory committed by the hosted publish to the Git Data API store verifies with the same verifier `steward report` uses (verifyRunDirectory), for an issue and a pull request.
- files_in_scope:
    - packages/core/src/pipeline/hosted-verify.fixture.test.ts
    - development-artifacts/patch-steward-m6-4.4-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest); Git Bash; run every command from your tree root. core.autocrlf=true
    (never anchor a grep with `$`). jq is NOT installed (use node). Relative imports need the `.js` extension. Strict TS
    (noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals). Prettier: single quotes, printWidth 132.

    Why: the live smoke on a test-bed later verifies the committed run directory with `steward report --json` (which calls
    verifyRunDirectory from packages/core/src/evidence/verify.ts). This test proves the same property offline first, over the
    existing shared fakes, so a mismatch is found before anything is pushed. It only ADDS a test file; it changes no product code.
    If the property does not hold (the test fails for a reason other than your test code), STOP and report status fail with the
    verbatim assertion output: do not change any other file.

    Existing pieces to reuse (read them first):
    - packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts lines 1-125: imports and the helpers payload(name),
      eventNameFor, environmentFor, buildGateDeps, gate(world, name), upload(world, gateResult, runId, createdAt),
      gateFilesOf, publish(world, gateResult), requireOk. Copy the helpers you need into the new file (do not import from that
      test file; do not edit it).
    - createStoreWorld() from '../evidence/store-world.test.js' (its `.handler` is chained into the hosted world with
      createHostedWorld({ handlers: [store.handler] })); store.files(repository) returns a ReadonlyMap<string, Uint8Array> of
      the store branch tip's files keyed by FULL store path, e.g.
      'steady-orchard/patch-steward-testbed-public/runs/issue-29/36081628326-1/run.json' and
      'steady-orchard/patch-steward-testbed-public/metrics/2026-09/36081628326-1.json'. For the orphan-branch store the store
      repository is the target repository WORLD_REPOSITORY ('steady-orchard/patch-steward-testbed-public').
    - createHostedWorld, WORLD_REPOSITORY, WORLD_RUN_ID (36081628326) and the environment builders from './hosted-world.test.js'.
    - Event fixtures (fixtures/events/): issues-opened.json (issue 29, action opened) and pull-request-target-opened.json (PR 26,
      action opened); the world serves issue 29 and pull request 26.
    - runHostedPublish returns { ok: true, status, outputs, logLines } or { ok: false, failure, evidenceCommit, logLines };
      outputs.evidence_commit / evidenceCommit is the commit that holds the run directory.
    - verifyRunDirectory(directory) from '../evidence/verify.js' -> Result<VerifiedRun, ...>; VerifiedRun has decision.outcome,
      metrics ('verified' or 'missing'), files (count), warnings. It resolves the metrics file as
      <run directory>/../../../metrics/<YYYY-MM>/<run-dir>.json, which matches the store layout
      <owner>/<repo>/runs/<pr|issue>-<n>/<run_id>-<run_attempt>/ and <owner>/<repo>/metrics/<YYYY-MM>/.

    Test file packages/core/src/pipeline/hosted-verify.fixture.test.ts, describe 'hosted run directories', plain it(...) titles
    EXACTLY:
    - 'a hosted issue run directory verifies like a local run': store = createStoreWorld(); world = createHostedWorld({ handlers:
      [store.handler] }); first = requireOk(await gate(world, 'issues-opened.json')); upload(world, first, WORLD_RUN_ID,
      '2026-09-28T10:00:05Z'); { result } = await publish(world, first); expect(result.ok).toBe(true); write every entry of
      store.files(WORLD_REPOSITORY) under a fresh temp root (path segments split on '/', parent directories created); verify
      <root>/steady-orchard/patch-steward-testbed-public/runs/issue-29/36081628326-1 -> ok; metrics === 'verified';
      warnings.length === 0; decision.outcome === result.outputs.status (when result.ok).
    - 'a hosted pull request run directory verifies like a local run': the same with 'pull-request-target-opened.json' and run
      directory runs/pr-26/36081628326-1. Whatever freshness publish reaches (current, superseded, or a failure after the
      commit), the committed run directory must exist and verify: assert the evidence commit is non-null (result.ok ?
      result.outputs.evidence_commit : result.evidenceCommit), then verify -> ok with metrics 'verified'.
    - 'every committed store file is listed by a manifest or is a metrics file': for the issue case, every store path under
      '<WORLD_REPOSITORY>/runs/issue-29/36081628326-1/' is 'manifest.json' or appears in that run's manifest.json `files[].path`
      (read and JSON.parse the manifest bytes), and every other store path starts with '<WORLD_REPOSITORY>/metrics/'.
    Temp directories: only fs.mkdtempSync(path.join(os.tmpdir(), 'm6-verify-')), removed in afterEach with fs.rmSync(dir, {
    recursive: true, force: true, maxRetries: 5, retryDelay: 100 }). No network: every call goes through the world (the test file
    never calls fetch). Module and import names must not contain llm, model, copilot, openai, anthropic, sandbox, container,
    docker, or runner.
- actions: |
    1. Confirm the reused pieces exist: node -e "const fs=require('fs');const c=[['packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts','function gateFilesOf'],['packages/core/src/evidence/store-world.test.ts','export function createStoreWorld'],['packages/core/src/pipeline/hosted-world.test.ts','export function createHostedWorld'],['packages/core/src/evidence/verify.ts','export async function verifyRunDirectory']];const m=c.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s));console.log(m.length?'MISSING '+JSON.stringify(m):'base ok')"
       It must print `base ok`; otherwise STOP and report status missing-base with the output.
    2. Write packages/core/src/pipeline/hosted-verify.fixture.test.ts per context.
    3. Run: pnpm exec prettier --write packages/core/src/pipeline/hosted-verify.fixture.test.ts
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/hosted-verify.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p4-4.4.json -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p4-4.4.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['a hosted issue run directory verifies like a local run','a hosted pull request run directory verifies like a local run','every committed store file is listed by a manifest or is a metrics file'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const before=new Set(fs.readdirSync(T));const r=cp.spawnSync('pnpm vitest run packages/core/src/pipeline/hosted-verify.fixture.test.ts',{shell:true,stdio:'ignore'});const fresh=fs.readdirSync(T).filter(n=>!before.has(n)&&n.startsWith('m6-verify-'));console.log('exit '+r.status+' leaked '+fresh.length)"
       -> prints exactly: exit 0 leaked 0
    4. git grep --untracked -c "fetch(" -- packages/core/src/pipeline/hosted-verify.fixture.test.ts
       -> no output (exit 1)
    5. pnpm typecheck -> exit 0
    6. pnpm vitest run -> exit 0
    7. pnpm exec eslint packages/core/src/pipeline/hosted-verify.fixture.test.ts -> exit 0
    8. pnpm exec prettier --check packages/core/src/pipeline/hosted-verify.fixture.test.ts -> exit 0
    9. git status --porcelain -- packages/core/src packages/cli packages/action | grep -v "hosted-verify.fixture.test.ts" -> no output
    10. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/hosted-verify.fixture.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the test file).
