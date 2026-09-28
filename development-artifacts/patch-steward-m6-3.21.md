# Step 3.21

- id: 3.21
- depends_on: [3.10, 3.11, 3.13, 3.16]
- route: mechanical
- objective: Extend invariant 4 (never pass on failure) to the hosted gate and publish with one injected failure per step, as packages/core/src/conformance/invariant-4-hosted.test.ts.
- files_in_scope:
    - packages/core/src/conformance/invariant-4-hosted.test.ts
    - development-artifacts/patch-steward-m6-3.21-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Invariant 4: service failure, malformed input, or missing evidence never produces `pass`. Hosted form: every injected failure
    makes runHostedGate or runHostedPublish return ok false with failure.outcome 'inconclusive' and a cause from FAILURE_CAUSES
    ('../vocabulary.js'); no written summary contains the code span '`pass`'; a gate failure returns no files (nothing to upload,
    nothing committed); a publish failure before the evidence commit leaves the store untouched (store.head unchanged), and a
    publish failure after it writes no supersession record.

    Base check (files changed in steps 3.10, 3.11, 3.13, 3.16): createStoreWorld (packages/core/src/evidence/store-world.test.ts),
    createHostedWorld and helpers (packages/core/src/pipeline/hosted-world.test.ts), runHostedGate (hosted-gate.ts),
    runHostedPublish (hosted-publish.ts). Read them first.

    Harness: as in packages/core/src/pipeline/hosted-publish.test.ts: gate(world, payload, envOverrides, extraDeps),
    publish(world, gateResult, envOverrides, fileOverrides), upload(...); world = createHostedWorld({ handlers: [store.handler] })
    per test; the default successful setup is run A = WORLD_RUN_ID from issuesEventPayload(world, 'opened') uploaded at
    '2026-09-28T10:00:05Z'. Injection is by world.override(handler) (return a Response for the matching method and path, else
    undefined); install every publish injection AFTER the gate run and the upload, so the gate itself is unaffected; for "only after the evidence commit" injections keep a flag set when a request path ends with '/git/refs' or
    '/git/refs/heads/steward-evidence' has been seen. For the compare and ref-update injections, first give the store a tip with
    store.advance(WORLD_REPOSITORY, { 'steady-orchard/patch-steward-testbed-public/metrics/2026-09/1-1.json': bytes }) so publish
    takes the PATCH path. A shared helper expectNeverPass(result, summaries) asserts ok false, outcome 'inconclusive', cause in
    FAILURE_CAUSES, and that no summary contains '`pass`'.

    Titles (exact, plain it(...), describe 'invariant 4: hosted never pass'); each also asserts the listed code and side effects:
    gate (each: no files):
      - 'invariant 4: hosted event failure never yields pass': payload bytes 'not json' -> 'gate.event-invalid'.
      - 'invariant 4: hosted token mint failure never yields pass': POST '/app/installations/162868612/access_tokens' -> 500 ->
        'github.server-error'.
      - 'invariant 4: hosted policy failure never yields pass': world.setPolicy('version: 1\n') -> 'gate.policy-invalid'.
      - 'invariant 4: hosted capture failure never yields pass': '/issues/29' -> 500 -> 'github.server-error'.
      - 'invariant 4: hosted listing failure never yields pass': '/actions/artifacts' -> 500 -> 'ownership.listing-unavailable'.
      - 'invariant 4: hosted download failure never yields pass': the unique newest artifact has zip bytes that are not a zip ->
        'ownership.record-invalid'.
      - 'invariant 4: hosted run list failure never yields pass': '/actions/runs' -> 500 -> 'caps.run-list-unavailable'.
    publish before the evidence commit (each: store.head(WORLD_REPOSITORY) unchanged):
      - 'invariant 4: hosted handoff failure never yields pass': handoff bytes 'x' -> 'pipeline.handoff-invalid'.
      - 'invariant 4: hosted binding failure never yields pass': env STEWARD_GATE_POLICY_REVISION 'c'.repeat(40) ->
        'pipeline.handoff-binding'.
      - 'invariant 4: hosted closure record failure never yields pass': env STEWARD_GATE_RECORD_ONLY 'true',
        STEWARD_GATE_DISPOSITION 'closure', closure bytes '{}' -> 'pipeline.handoff-invalid'.
      - 'invariant 4: hosted publish policy failure never yields pass': the tree read '/git/trees/' + policy revision -> 404 ->
        failure (any code; ok false).
      - 'invariant 4: hosted own artifact failure never yields pass': no upload -> 'ownership.listing-unavailable'.
      - 'invariant 4: hosted store tip failure never yields pass': GET '/git/ref/heads/steward-evidence' -> 500 ->
        'github.server-error'.
      - 'invariant 4: hosted blob failure never yields pass': POST '/git/blobs' -> 500.
      - 'invariant 4: hosted tree failure never yields pass': POST '/git/trees' -> 500.
      - 'invariant 4: hosted commit failure never yields pass': POST '/git/commits' -> 500.
      - 'invariant 4: hosted compare failure never yields pass': GET '/compare/' -> 200 { status: 'ahead', ahead_by: 1, behind_by:
        0, files: [{ filename: 'x', status: 'modified' }] } -> 'evidence.store-not-append-only'.
      - 'invariant 4: hosted ref update failure never yields pass': PATCH '/git/refs/heads/steward-evidence' -> 422 always ->
        'evidence.store-conflict'.
    publish after the evidence commit (each: no store path contains '/supersessions/'):
      - 'invariant 4: hosted read-back failure never yields pass': GET tree reads containing ':' -> 200 with a listing whose blob
        shas are all 'f'.repeat(40) -> 'evidence.readback-mismatch'.
      - 'invariant 4: hosted settle re-list failure never yields pass': '/actions/artifacts' -> 500 only after the commit ->
        'publish.freshness-unknown'.
      - 'invariant 4: hosted successor record failure never yields pass': a newer artifact of another run with invalid zip bytes ->
        'publish.freshness-unknown'.
      - 'invariant 4: hosted recapture failure never yields pass': '/issues/29' -> 500 only after the commit ->
        'publish.freshness-unknown'.
      - 'invariant 4: hosted freshness failure never yields pass': a tie with another run's artifact at A's createdAt ->
        'publish.freshness-unknown'.
    The upload failure (the action cannot stage files) is covered by the action package's own test.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's file; no planning identifiers in code, comments, or test titles; never write raw control, bidi, or
    zero-width characters. Do not edit any other file (the existing invariant-4.test.ts stays unchanged). No temp files, no child
    processes, no real network.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const chk=[['packages/core/src/evidence/store-world.test.ts','advance('],['packages/core/src/pipeline/hosted-world.test.ts','export function createHostedWorld'],['packages/core/src/pipeline/hosted-gate.ts','export async function runHostedGate'],['packages/core/src/pipeline/hosted-publish.ts','export async function runHostedPublish']];const miss=chk.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s)).map(c=>c.join(' '));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/conformance/invariant-4-hosted.test.ts per context.
    3. Run: pnpm exec prettier --write packages/core/src/conformance/invariant-4-hosted.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/conformance/invariant-4-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.21.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.21.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const steps=['event','token mint','policy','capture','listing','download','run list','handoff','binding','closure record','publish policy','own artifact','store tip','blob','tree','commit','compare','ref update','read-back','settle re-list','successor record','recapture','freshness'];const need=steps.map(s=>'invariant 4: hosted '+s+' failure never yields pass');const miss=need.filter(t=>!got.has(t));console.log(need.length+' required; '+(miss.length?'MISSING '+JSON.stringify(miss):'titles ok'))"
       -> prints exactly: 23 required; titles ok
    3. git diff --quiet 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/conformance/invariant-4.test.ts; echo "unchanged $?"
       -> prints exactly: unchanged 0
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/conformance/invariant-4-hosted.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/conformance/invariant-4-hosted.test.ts -> exit 0
    8. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/conformance/invariant-4-hosted.test.ts
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/conformance/invariant-4-hosted.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the new file).
