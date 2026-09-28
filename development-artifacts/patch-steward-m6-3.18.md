# Step 3.18

- id: 3.18
- depends_on: [3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.12, 3.13, 3.14, 3.15, 3.16]
- route: mechanical
- objective: Export the hosted pipeline modules from the core package root, extend the root export test, and add every new hosted failure code to the never-pass conformance table.
- files_in_scope:
    - packages/core/src/index.ts
    - packages/core/src/exports.test.ts
    - packages/core/src/conformance/never-pass-hosted.test.ts
    - development-artifacts/patch-steward-m6-3.18-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: the action package imports the hosted entry points from '@patch-steward/core' (the package root, packages/core/src/index.ts,
    which today ends with 105 `export *` lines, the last being `export * from './evidence/store-readback.js';`). Every failure code
    union a hosted path can return must appear in the compile-time exhaustive never-pass table in
    packages/core/src/conformance/never-pass-hosted.test.ts (a `TRIGGERS` object typed `{ readonly [K in HostedFailureCode]: () =>
    Result<unknown, string> | Promise<Result<unknown, string>> }`, iterated to generate titles `hosted failure code ${code} never
    yields pass`).

    Base check (files changed in steps 3.1-3.7 and 3.12-3.16): these files exist and are not yet root-exported:
    packages/core/src/pipeline/gate-context.ts, pipeline/hosted-environment.ts, ownership/freshness.ts, evidence/prepare-waiting.ts,
    evidence/prepare-records.ts, pipeline/hosted-evidence.ts, pipeline/hosted-freshness.ts, pipeline/hosted-gate.ts,
    pipeline/hosted-publish.ts; loader.ts exports loadPolicyRevision; gate.ts exports gateCaptureSubmission.

    Required changes:
    1. packages/core/src/index.ts: append exactly these 9 lines after the last existing line, in this order (106-114 `export *`
       lines in total, 114):
         export * from './pipeline/gate-context.js';
         export * from './pipeline/hosted-environment.js';
         export * from './ownership/freshness.js';
         export * from './evidence/prepare-waiting.js';
         export * from './evidence/prepare-records.js';
         export * from './pipeline/hosted-evidence.js';
         export * from './pipeline/hosted-freshness.js';
         export * from './pipeline/hosted-gate.js';
         export * from './pipeline/hosted-publish.js';
       If `pnpm typecheck` then reports TS2308 (a name exported by two modules), STOP and report it in deviations with the
       colliding name (do not rename anything yourself).
    2. packages/core/src/exports.test.ts: add ONE test at the end of the describe, titled exactly
       'exports the hosted pipeline entry points', asserting typeof === 'function' for: runHostedGate, runHostedPublish, readGateEnvironment,
       readPublishEnvironment, hostedEventEnvironment, prepareHostedRunEvidence, verifyPublishFreshness, publishFreshnessFailure,
       decidePublishFreshness, freshnessTop, findOwnOwnershipArtifact, encodeGateContext, decodeGateContext, encodeClosureContext,
       decodeClosureContext, decodeHandoffBytes, classificationRecord, gateContextClassification, prepareWaitingEvidence,
       prepareSupersessionEvidence, prepareClosureEvidence, runEvidenceGroups, loadPolicyRevision, gateCaptureSubmission,
       buildGateHandoff, gateContractLogLines, mapHostedPolicyFailure, repositoryGateRefusal, hostedRepositoryGateActive; and the
       values: HANDOFF_ARTIFACT 'steward-handoff', CLOSURE_ARTIFACT 'steward-closure', HANDOFF_FILE 'handoff.json',
       GATE_CONTEXT_FILE 'gate-context.json', CLOSURE_CONTEXT_FILE 'closure.json', GATE_CONTEXT_LOG_LINES_MAX 200,
       HOSTED_GATE_FAILURE_CODES ['gate.policy-missing', 'gate.policy-invalid', 'gate.repository-gate-unsupported'],
       PUBLISH_FRESHNESS_FAILURE_CODES ['publish.freshness-unknown'], HOSTED_ENVIRONMENT_FAILURE_CODES
       ['action.environment-invalid'], FRESHNESS_UNKNOWN_REASONS length 7, HOSTED_APP_ID_VARIABLE 'PATCH_STEWARD_APP_ID',
       HOSTED_APP_KEY_VARIABLE 'PATCH_STEWARD_APP_PRIVATE_KEY'. Change nothing else in that file.
    3. packages/core/src/conformance/never-pass-hosted.test.ts: extend the `HostedFailureCode` union with HostedGateFailureCode,
       PublishFreshnessFailureCode, and HostedEnvironmentFailureCode (types imported from '../index.js'), and add these TRIGGERS
       entries (imports from '../index.js'):
         'gate.policy-missing': () => ({ ok: false as const, failure: mapHostedPolicyFailure(err('policy-source.not-published',
           'policy-unavailable', 'x').failure) }),
         'gate.policy-invalid': () => ({ ok: false as const, failure: mapHostedPolicyFailure(err('policy.unknown-key',
           'policy-invalid', 'x').failure) }),
         'gate.repository-gate-unsupported': () => repositoryGateRefusal({ ...DEFAULT_CHECKLIST_POLICY, modes: { default:
           'advise', per_category: {} } }),
         'publish.freshness-unknown': () => publishFreshnessFailure('tie'),
         'action.environment-invalid': () => readGateEnvironment({}),
       Keep the existing entries and the existing 'ownership modules import no file system or network module' test unchanged.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig; Prettier (single quotes,
    semicolons, trailing commas, printWidth 132) only on this step's files; no planning identifiers in code, comments, or test
    titles; never write raw control, bidi, or zero-width characters. Names starting with load, validate, resolve, parse, capture,
    or check are pinned by packages/core/src/conformance/invariant-5.test.ts; the only such new root name is loadPolicyRevision,
    already listed there by an earlier step, so invariant-5 must pass unchanged.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const files=['packages/core/src/pipeline/gate-context.ts','packages/core/src/pipeline/hosted-environment.ts','packages/core/src/ownership/freshness.ts','packages/core/src/evidence/prepare-waiting.ts','packages/core/src/evidence/prepare-records.ts','packages/core/src/pipeline/hosted-evidence.ts','packages/core/src/pipeline/hosted-freshness.ts','packages/core/src/pipeline/hosted-gate.ts','packages/core/src/pipeline/hosted-publish.ts'];const miss=files.filter(f=>!fs.existsSync(f));const l=fs.readFileSync('packages/core/src/policy/loader.ts','utf8').includes('export async function loadPolicyRevision');const g=fs.readFileSync('packages/core/src/pipeline/gate.ts','utf8').includes('export async function gateCaptureSubmission');console.log(miss.length||!l||!g?'MISSING '+miss.join(' | ')+(l?'':' loadPolicyRevision')+(g?'':' gateCaptureSubmission'):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Edit the three files per context.
    3. Run: pnpm exec prettier --write packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. grep -c "^export \* from" packages/core/src/index.ts -> prints exactly: 114
    2. pnpm vitest run packages/core/src/exports.test.ts packages/core/src/conformance --reporter=json --outputFile=node_modules/.m6-p3-3.18.json
       -> exit 0
    3. node -e "const r=require('./node_modules/.m6-p3-3.18.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['exports the hosted pipeline entry points','hosted failure code gate.policy-missing never yields pass','hosted failure code gate.policy-invalid never yields pass','hosted failure code gate.repository-gate-unsupported never yields pass','hosted failure code publish.freshness-unknown never yields pass','hosted failure code action.environment-invalid never yields pass','hosted failure code gate.event-invalid never yields pass','ownership modules import no file system or network module','invariant 5: every exported load, validate, resolve, parse, capture, and check function rejects invalid input'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    4. pnpm build -> exit 0
    5. node --input-type=module -e "const c=await import('./packages/core/dist/index.js');console.log(['runHostedGate','runHostedPublish','readGateEnvironment','readPublishEnvironment'].every(n=>typeof c[n]==='function')?'dist exports ok':'dist exports missing')"
       -> prints exactly: dist exports ok
    6. pnpm typecheck -> exit 0
    7. pnpm vitest run -> exit 0
    8. pnpm exec eslint packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts -> exit 0
    9. pnpm exec prettier --check packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts -> exit 0
    10. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (restores the root exports and the two test files).
