# Step 3.19

- id: 3.19
- depends_on: [3.8, 3.10, 3.11, 3.13, 3.16]
- route: mechanical
- objective: Add the fixture-tier hosted publish scenarios (gate, simulated uploads, publish) proving evidence-first ordering, supersession, fail-closed freshness, binding, waiting runs, closures, and an append-only store, as packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts.
- files_in_scope:
    - packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts
    - development-artifacts/patch-steward-m6-3.19-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.
    Fixture tier: the file name ends in `.fixture.test.ts`; it reads fixtures/events/ payloads and never reaches the network.

    What publish must show: it validates the same-run records and binds them to the runner (a mismatch fails with
    'pipeline.handoff-binding' before ANY request); loads the gate's policy by the recorded tree id and makes no live
    default-branch policy read before the evidence commit; reads this run's own ownership artifact; commits evidence (append-only)
    and reads it back BEFORE writing the summary; then waits the settle delay, re-lists, and decides freshness in order: listing
    unavailable or incomplete or own artifact changed -> unknown; a tie at the greatest created_at (even one that includes this
    run) -> unknown; a unique newer artifact with a valid record -> superseded 'newer-owner' with the successor's run attempt from
    that record; an invalid successor record -> unknown; own artifact newest -> recapture under the live policy: changed ->
    superseded 'snapshot-changed', unchanged -> current. Unknown fails with 'publish.freshness-unknown' and writes NO supersession
    record; superseded appends `runs/<kind>-<n>/supersessions/<run-dir>.json` and a metrics file, never touching the run
    directory. Queued runs publish a waiting run directory; closures publish one metrics file and nothing else.

    Base check (files changed in steps 3.8, 3.10, 3.11, 3.13, 3.16): fixtures/events/issues-opened.json exists;
    packages/core/src/evidence/store-world.test.ts exports createStoreWorld; packages/core/src/pipeline/hosted-world.test.ts
    exports createHostedWorld and publishEnvironment; packages/core/src/pipeline/hosted-gate.ts exports runHostedGate;
    packages/core/src/pipeline/hosted-publish.ts exports runHostedPublish. Read hosted-publish.ts (outputs status, freshness,
    evidence_commit, supersession_commit; result evidenceCommit) and the two world files first.

    Harness (write it once):
    - payload(name) reads fixtures/events/<name> bytes; gate(world, name, overrides) as in the hosted gate scenarios (event name
      from the file prefix; readGateEnvironment(gateEnvironment(world, overrides)); deps fetch/resolver/transport from the world,
      sleep no-op, clock fixedClock(WORLD_NOW), mask and writeSummary recorders).
    - upload(world, gateResult, runId, createdAt) = world.addArtifact({ name: outputs.ownership_artifact, createdAt, workflowRunId:
      runId, recordBytes: 'ownership' file bytes }).
    - publish(world, gateResult, overrides, fileOverrides) = runHostedPublish({ environment:
      readPublishEnvironment(publishEnvironment(world, gateResult.outputs, overrides)) value, files: { handoff, gateContext,
      closure } from the gate files (each null when absent) with fileOverrides applied }, { fetch: world.fetch, sleep: async (ms)
      => { world.requests.push({ method: 'SLEEP', host: '', path: String(ms) }) }, clock: fixedClock('2026-09-28T10:00:30.000Z'),
      attachmentResolver: world.resolver, attachmentTransport: world.transport, mask, writeSummary: async (t) => {
      summaries.push(t); world.requests.push({ method: 'SUMMARY', host: '', path: '' }) }, version: () => ok('0.0.2') }).
    - publish for a gate result must receive the SAME GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT overrides that produced that gate result
      (the same-run records are bound to the runner's run id and attempt).
    - store = createStoreWorld(); world = createHostedWorld({ handlers: [store.handler], policyText? }) per test; store paths start
      with 'steady-orchard/patch-steward-testbed-public/'. Remember `start = world.requests.length` before publish to isolate
      publish's requests.
    - Run A = WORLD_RUN_ID committed from issues-opened.json and uploaded with createdAt '2026-09-28T10:00:05Z'.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's file; no planning identifiers in code, comments, or test titles; never write raw control, bidi, or
    zero-width characters. Do not edit any other file. No temp files, no child processes, no real network.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const chk=[['fixtures/events/issues-opened.json','5578290556'],['packages/core/src/evidence/store-world.test.ts','export function createStoreWorld'],['packages/core/src/pipeline/hosted-world.test.ts','export function publishEnvironment'],['packages/core/src/pipeline/hosted-gate.ts','export async function runHostedGate'],['packages/core/src/pipeline/hosted-publish.ts','export async function runHostedPublish']];const miss=chk.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s)).map(c=>c.join(' '));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts (describe 'hosted publish scenarios'), plain
       it(...) with EXACTLY these titles:
       - 'evidence commit precedes the summary write': run A published -> ok; in world.requests after start, the last request whose
         path ends with '/git/refs' or '/git/refs/heads/steward-evidence', and every '/git/trees/<commit>:' read-back request,
         come before the only 'SUMMARY' marker; the 'SLEEP' marker '10000' comes after the ref update.
       - 'a newer owner supersedes and records the successor attempt': after gate A, change issues.get(29).body, gate
         issues-edited.json as run B = WORLD_RUN_ID + 5 with GITHUB_RUN_ATTEMPT '2', upload B with createdAt
         '2026-09-28T10:00:09Z'; publish A -> status 'superseded'; the store holds '.../runs/issue-29/supersessions/36081628326-1.json'
         whose record has reason 'newer-owner' and successor { run_id: B, run_attempt: 2, artifact_created_at:
         '2026-09-28T10:00:09Z' }; every file under '.../runs/issue-29/36081628326-1/' is byte-identical before and after the
         supersession commit.
       - 'a changed snapshot supersedes': after gate A and its upload, change issues.get(29).body; publish A -> 'superseded'; the
         supersession record reason 'snapshot-changed', successor null, live_snapshot_hash non-null and different from the
         recorded one.
       - 'a tie that includes this run fails publication without supersession': upload another run's artifact with createdAt
         '2026-09-28T10:00:05Z' (any zip) -> ok false, failure.code 'publish.freshness-unknown', evidenceCommit non-null; no store
         path contains '/supersessions/'; the summary contains '`unknown`' and 'publish.freshness-unknown'.
       - 'an incomplete listing fails publication without supersession': an extra artifact of the same name with createdAt
         'not-a-date' (expiresAt '2026-12-27T10:00:05Z') -> 'publish.freshness-unknown' with details[0].path
         'listing-incomplete'; no supersessions path.
       - 'an unavailable successor read fails publication without supersession': a newer artifact (createdAt
         '2026-09-28T10:00:09Z', another run) whose zip bytes are not a zip -> 'publish.freshness-unknown' with details[0].path
         'successor-unavailable'; no supersessions path.
       - 'a publish failure before the commit leaves no evidence': an override answering 500 for POST '/git/blobs' -> ok false;
         store.head(WORLD_REPOSITORY) is null; the summary contains '`failed`' and no outcome word ('`inconclusive`',
         '`needs-changes`', '`pass`').
       - 'publish reads the policy by tree id and not the live policy before the commit': among publish's requests before the first
         '/git/blobs' request, one path ends with '/git/trees/' + gate outputs.policy_revision + '?recursive=1' and none ends with
         '/git/ref/heads/master' or starts with '/repos/steady-orchard/patch-steward-testbed-public/contents/.github'.
       - 'a binding mismatch fails before any evidence request': (a) env override GITHUB_RUN_ID String(WORLD_RUN_ID + 1) ->
         'pipeline.handoff-binding' with no request at all; (b) a handoff.json whose run_attempt is changed to 2 (edit the decoded
         JSON and re-encode) -> 'pipeline.handoff-binding' or 'pipeline.handoff-invalid' and no '/git/blobs' request; (c) an own
         artifact whose record bytes come from a different gate run of the same submission uploaded under run A's id ->
         'ownership.record-invalid' or 'pipeline.handoff-binding' and no '/git/blobs' request.
       - 'an over-cap run publishes a waiting run directory': policy worldPolicyText([['daily_runs: 50', 'daily_runs: 1']]) and one
         counted createdToday run item -> gate 'queued'; publish -> status 'queued'; '.../runs/issue-29/36081628326-1/waiting.json'
         has arrival_at '2026-09-28T10:00:05Z'; no decision.json there.
       - 'a closure publishes a metrics-only commit': run A uploaded; gate issues-closed.json as run WORLD_RUN_ID + 9; publish with
         only the closure file -> status 'closure'; exactly one store path added by publish, matching
         /\/metrics\/2026-09\/36081628335-1\.json$/; its bytes parse to one 'maintainer-resolution' event with resolution
         'closed-by-author'.
       - 'the evidence store stays append-only across runs': three submissions states in sequence (A; body edit then B; body edit
         then C), each gate, upload, publish -> every file present after one publish is present with identical bytes after the next;
         store.commitCount(WORLD_REPOSITORY) equals the number of evidence commits made (supersession commits included).
    3. Run: pnpm exec prettier --write packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.19.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.19.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['evidence commit precedes the summary write','a newer owner supersedes and records the successor attempt','a changed snapshot supersedes','a tie that includes this run fails publication without supersession','an incomplete listing fails publication without supersession','an unavailable successor read fails publication without supersession','a publish failure before the commit leaves no evidence','publish reads the policy by tree id and not the live policy before the commit','a binding mismatch fails before any evidence request','an over-cap run publishes a waiting run directory','a closure publishes a metrics-only commit','the evidence store stays append-only across runs'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. NODE_OPTIONS='--import=data:text/javascript,globalThis.fetch=async()=>{throw(0)}' pnpm vitest run packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts -> exit 0
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts -> exit 0
    8. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the new file).
