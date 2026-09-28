# Step 3.17

- id: 3.17
- depends_on: [3.8, 3.10, 3.11, 3.13]
- route: mechanical
- objective: Add the fixture-tier hosted gate scenarios that drive `runHostedGate` with the recorded-identity event payloads in fixtures/events/ against the shared fake GitHub, as packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts.
- files_in_scope:
    - packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts
    - development-artifacts/patch-steward-m6-3.17-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.
    Fixture tier: the file name ends in `.fixture.test.ts`; it reads files from the repository's fixtures/ directory and never
    reaches the network (the phase gate runs every test with global fetch replaced by a throwing function).

    What the gate must show (observable, in order of the gate's rules): it authenticates the event; mints a target token and looks
    up the App bot user; loads the trusted policy from the default branch; lists the submission's ownership artifacts BEFORE any
    capture (for every event kind); stops on a closure (record-only, paired from the listing) or on a verified echo (sender is the
    App bot and the triggering object id is in the newest valid owner's receipts: nothing captured, nothing to upload); otherwise
    captures, deduplicates (an unchanged snapshot and policy revision keep the current owner; a body change, an explicit rerun, or a
    reopen commits a new owner; a tie or incomplete listing does not block a new commit; an unavailable or invalid read fails the
    gate before commitment), then contract and caps. A failure before commitment returns no files at all. Event text (titles,
    bodies) never reaches outputs, logs, or files.

    Base check (files changed in steps 3.8, 3.10, 3.11, 3.13): fixtures/events/issues-edited-by-bot.json exists;
    packages/core/src/evidence/store-world.test.ts exports createStoreWorld; packages/core/src/pipeline/hosted-world.test.ts
    exports createHostedWorld, gateEnvironment, worldPolicyText; packages/core/src/pipeline/hosted-gate.ts exports runHostedGate.
    Read hosted-gate.ts (outputs keys disposition, commit, record_only, concurrency_group, snapshot_hash, policy_revision,
    ownership_artifact; file names handoff, gate-context, ownership, closure) and the two world files before writing tests.

    Harness (write it once at the top of the test file):
    - payload(name) = readFileSync(fileURLToPath(new URL('../../../../fixtures/events/' + name, import.meta.url))) as bytes (used
      unchanged; CRLF whitespace is valid JSON).
    - runGate(world, name, env overrides, extra deps) = runHostedGate({ environment: readGateEnvironment(gateEnvironment(world, {
      GITHUB_EVENT_NAME: name.startsWith('pull-request-target') ? 'pull_request_target' : 'issues', ...overrides })) value,
      payload: payload(name) }, { fetch: world.fetch, sleep: async () => undefined, clock: fixedClock(WORLD_NOW),
      attachmentResolver: world.resolver, attachmentTransport: world.transport, mask, writeSummary, ...extra }).
    - upload(world, result, runId, createdAt) = world.addArtifact({ name: result.outputs.ownership_artifact, createdAt,
      workflowRunId: runId, recordBytes: the 'ownership' file bytes }) (simulates the workflow's upload after a committed gate).
    - world = createHostedWorld({ handlers: [createStoreWorld().handler], policyText? }), a new one per test.
    - All payloads target issue 29 or pull request 26 of the world (their ids match the world's).

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's file; no planning identifiers in code, comments, or test titles; never write raw control, bidi, or
    zero-width characters. Do not edit any other file. No temp files, no child processes, no real network.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const chk=[['fixtures/events/issues-edited-by-bot.json','331019482'],['packages/core/src/evidence/store-world.test.ts','export function createStoreWorld'],['packages/core/src/pipeline/hosted-world.test.ts','export function createHostedWorld'],['packages/core/src/pipeline/hosted-gate.ts','export async function runHostedGate']];const miss=chk.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s)).map(c=>c.join(' '));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts (describe 'hosted gate scenarios'), plain it(...)
       with EXACTLY these titles:
       - 'fixture events authenticate against the test-bed environment': for every file in fixtures/events, authenticateEvent
         (hostedEventEnvironment(<read gate environment with the matching event name>), bytes) is ok, except
         issues-opened-pull-request.json, which fails with 'gate.event-invalid'.
       - 'the hosted gate lists ownership before capture': issues-opened.json -> the first '/actions/artifacts?' request precedes
         the first '/issues/29' request, and the '/git/ref/heads/master' policy read precedes both.
       - 'a verified echo with synthetic receipts captures and uploads nothing': commit and upload run A with issues-opened.json;
         then issues-edited-by-bot.json as run A+1 with extra dep receipts: () => [5578290556] -> ok, disposition 'duplicate',
         files [], outputs commit 'false'; no request path equals '/repos/steady-orchard/patch-steward-testbed-public' and none
         ends with '/issues/29' among run A+1's requests.
       - 'a title-only edit keeps the owner': run A committed and uploaded; change only issues.get(29).title; issues-edited.json as
         run A+1 -> 'duplicate'; the summary names the kept owner run A.
       - 'a body edit commits a new owner': run A uploaded; change issues.get(29).body; issues-edited.json as run A+1 -> 'runnable'
         with a snapshot_hash different from run A's.
       - 'a reopened issue commits whatever the snapshot': run A uploaded; issues-reopened.json as run A+1 with no change ->
         'runnable'.
       - 'a tie or incomplete listing still commits': two uploaded artifacts of different runs with the same createdAt ->
         issues-edited.json commits ('runnable'); separately, one artifact with createdAt 'not-a-date' (expiresAt
         '2026-12-27T10:00:05Z') -> also 'runnable'.
       - 'an unavailable ownership read fails the gate': an override answering 500 for '/actions/artifacts' ->
         'ownership.listing-unavailable'; separately, a unique newest artifact whose zip bytes are not a zip ->
         'ownership.record-invalid'; both return no files.
       - 'a failure before commitment commits nothing': world.setPolicy('version: 1\n') -> 'gate.policy-invalid'; separately, an
         override answering 500 for '/actions/runs' -> 'caps.run-list-unavailable'; in both, ok false and world.artifacts() is
         unchanged.
       - 'an over-cap submission is queued with its counts': policy worldPolicyText([['per_author_concurrent_runs: 2',
         'per_author_concurrent_runs: 1']]) and one inProgress run item { id: 36081620000, path:
         '.github/workflows/steward-issues.yml', event: 'issues', status: 'in_progress', createdAt: '2026-09-28T09:58:00Z',
         displayTitle: 'steward issue 30 author 2095171 event issues opened sender 2095171 User' } -> 'queued'; the ownership record
         cap { state: 'per-author-concurrent-runs', author_count: 2, author_limit: 1 }.
       - 'closures pair the newest owner and attribute the resolution': with run A uploaded for issue 29: issues-closed.json ->
         'closure' with resolution 'closed-by-author' and paired_run { run_id: A, run_attempt: 1 }; issues-closed-by-maintainer.json
         -> 'closed-by-maintainer'; issues-deleted.json -> 'deleted'; pull-request-target-closed-merged.json -> 'merged' with
         paired_run null (no pull request owner); each returns exactly one 'closure' file and record_only 'true'.
       - 'a fork pull request is screened under the trusted policy': pull-request-target-opened-fork.json -> ok; outputs
         policy_revision equals world.policyTreeId(); disposition is one of 'runnable', 'early-exit', 'queued'.
       - 'hostile event text never reaches outputs or files': issues-edited-hostile.json -> ok; neither its issue title nor its
         issue body (read from the fixture) appears in any output value, log line, summary, or decoded file text.
    3. Run: pnpm exec prettier --write packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.17.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.17.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['fixture events authenticate against the test-bed environment','the hosted gate lists ownership before capture','a verified echo with synthetic receipts captures and uploads nothing','a title-only edit keeps the owner','a body edit commits a new owner','a reopened issue commits whatever the snapshot','a tie or incomplete listing still commits','an unavailable ownership read fails the gate','a failure before commitment commits nothing','an over-cap submission is queued with its counts','closures pair the newest owner and attribute the resolution','a fork pull request is screened under the trusted policy','hostile event text never reaches outputs or files'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. NODE_OPTIONS='--import=data:text/javascript,globalThis.fetch=async()=>{throw(0)}' pnpm vitest run packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts -> exit 0
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts -> exit 0
    8. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the new file).
