# Step 3.20

- id: 3.20
- depends_on: [3.10, 3.11, 3.13, 3.16]
- route: mechanical
- objective: Extend invariant 2 (trusted-branch policy) and invariant 8 (snapshot binding and ownership) to the hosted gate and publish with two new conformance test files.
- files_in_scope:
    - packages/core/src/conformance/invariant-2-hosted.test.ts
    - packages/core/src/conformance/invariant-8-hosted.test.ts
    - development-artifacts/patch-steward-m6-3.20-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Invariant 2: a pull request may propose policy changes but they never govern its own screening run; every run records the
    trusted default-branch policy revision (the git tree id of .github/patch-steward/). Hosted form: a `pull_request_target` gate
    for a pull request that changes `.github/patch-steward/policy.yml` loads the DEFAULT-BRANCH policy (the head's proposed policy is
    only read as data for the contract finding 'submission.policy-change'), and the matching publish loads that same tree id for its
    evidence, never the head's tree and never the live default-branch policy before the evidence commit.
    Invariant 8: publication binds to a snapshot and to ownership: the newest owner is chosen by artifact created_at, never by id; a
    tie at the top or an incomplete listing blocks publication; a newer artifact with a valid record supersedes; a changed snapshot
    or policy revision supersedes; unknown freshness never supersedes and never publishes a supersession record; a duplicate with an
    unchanged snapshot keeps the owner; an explicit rerun replaces it.

    Base check (files changed in steps 3.10, 3.11, 3.13, 3.16): packages/core/src/evidence/store-world.test.ts exports
    createStoreWorld; packages/core/src/pipeline/hosted-world.test.ts exports createHostedWorld, gateEnvironment,
    publishEnvironment, pullRequestEventPayload, issuesEventPayload, worldPolicyText; hosted-gate.ts exports runHostedGate;
    hosted-publish.ts exports runHostedPublish. Read them first (outputs, files, results, world API incl. setHeadPolicy,
    removeArtifact, addArtifact, pulls, issues).

    Harness (in each file, import from '../pipeline/hosted-world.test.js', '../evidence/store-world.test.js',
    '../pipeline/hosted-gate.js', '../pipeline/hosted-publish.js', '../pipeline/hosted-environment.js', '../pipeline/gate-context.js',
    '../clock.js', '../result.js'): gate(world, payloadBytes, envOverrides, extraDeps) and publish(world, gateResult, envOverrides)
    as in packages/core/src/pipeline/hosted-publish.test.ts (world fetch/resolver/transport, no-op sleep, fixed clocks
    WORLD_NOW and '2026-09-28T10:00:30.000Z', mask and summary recorders, version () => ok('0.0.2')); upload(world, gateResult,
    runId, createdAt) = world.addArtifact({ name: outputs.ownership_artifact, createdAt, workflowRunId: runId, recordBytes:
    'ownership' file bytes }). Run A = WORLD_RUN_ID from issue 29 'opened' uploaded at '2026-09-28T10:00:05Z'. A publish for a gate
    result must receive the same GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT overrides that produced it.

    Titles are pinned (exact, plain it(...)):
    invariant-2-hosted.test.ts, describe 'invariant 2: hosted trusted-branch policy':
      - 'pull request policy changes never govern the hosted run': pulls.get(26).files gets { filename:
        '.github/patch-steward/policy.yml', status: 'modified' }; world.setHeadPolicy(<pull 26 headSha>, worldPolicyText([[FROM,
        TO]])) with FROM = 'modes:\n  default: observe' and TO = 'modes:\n  default: enforce' (a newline then two spaces; a head
        policy that WOULD be refused if it governed); gate with
        pullRequestEventPayload(world, 'edited') and GITHUB_EVENT_NAME 'pull_request_target' -> ok (not
        'gate.repository-gate-unsupported'); outputs.policy_revision === world.policyTreeId(); the decoded gate context's
        policy.revision equals it; the handoff findings include code 'submission.policy-change'; after uploading, publish -> its
        requests include '/git/trees/' + world.policyTreeId() + '?recursive=1' and no '/git/trees/' + <head tree id> request; the
        committed run.json in the store has policy_revision === world.policyTreeId(). (The head tree id: read the head listing
        through the world, or record it from the contents request the gate made at the head sha.)
    invariant-8-hosted.test.ts, describe 'invariant 8: hosted ownership and freshness':
      - 'ownership ties block publication': (a) upload another run's artifact at A's createdAt -> publish A fails with
        'publish.freshness-unknown' and no '/supersessions/' store path; (b) two other runs' artifacts sharing a createdAt later than
        A's -> same result.
      - 'newer owner supersedes': a newer valid owner B (body changed, gate as run B, upload at '2026-09-28T10:00:09Z') -> publish A
        status 'superseded' with a supersession record whose reason is 'newer-owner' and successor.run_id B.
      - 'unknown freshness fails publication': an override that answers 500 for the SECOND '/actions/artifacts' request only (the
        freshness re-list) -> 'publish.freshness-unknown'; the evidence commit exists; no '/supersessions/' path; the summary says
        '`unknown`'.
      - 'an unchanged snapshot keeps the hosted owner': with A uploaded, gate 'edited' as run A+1 without change -> 'duplicate' and
        no files; the artifact listing still has one artifact.
      - 'an explicit rerun replaces the hosted owner': gate as run A with GITHUB_RUN_ATTEMPT '2' -> 'runnable'; remove A's first
        artifact (world.removeArtifact) and upload the attempt-2 record under run A at '2026-09-28T10:00:07Z' (a re-run's upload
        replaces the earlier attempt's); publish with GITHUB_RUN_ATTEMPT '2' -> ok; the store holds
        '.../runs/issue-29/36081628326-2/manifest.json'.
      - 'the newest owner is chosen by creation time, never id': a newer valid owner B (body changed, gate as run B) uploaded with
        id 5 (smaller than A's default id) and createdAt '2026-09-28T10:00:09Z' -> publish A is superseded by B ('newer-owner');
        conversely, in a fresh world with the issue unchanged, an artifact of another run with id 999999, any zip bytes, and an
        EARLIER createdAt ('2026-09-28T10:00:01Z') than A -> publish A is current (status 'inconclusive', freshness 'current').
      - 'an incomplete listing blocks publication': an extra artifact with createdAt 'not-a-date' -> 'publish.freshness-unknown'.
      - 'a changed policy revision supersedes': after gate A and its upload, world.setPolicy(worldPolicyText([['daily_runs: 50',
        'daily_runs: 49']])) -> publish A status 'superseded', reason 'snapshot-changed'.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; no planning identifiers in code, comments, or test titles; never write raw control, bidi, or
    zero-width characters. Do not edit any other file (the existing invariant-2.test.ts and invariant-8.test.ts stay unchanged). No
    temp files, no child processes, no real network.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const chk=[['packages/core/src/evidence/store-world.test.ts','export function createStoreWorld'],['packages/core/src/pipeline/hosted-world.test.ts','setHeadPolicy'],['packages/core/src/pipeline/hosted-world.test.ts','removeArtifact'],['packages/core/src/pipeline/hosted-gate.ts','export async function runHostedGate'],['packages/core/src/pipeline/hosted-publish.ts','export async function runHostedPublish']];const miss=chk.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s)).map(c=>c.join(' '));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create the two test files per context.
    3. Run: pnpm exec prettier --write packages/core/src/conformance/invariant-2-hosted.test.ts packages/core/src/conformance/invariant-8-hosted.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/conformance/invariant-2-hosted.test.ts packages/core/src/conformance/invariant-8-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.20.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.20.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['pull request policy changes never govern the hosted run','ownership ties block publication','newer owner supersedes','unknown freshness fails publication','an unchanged snapshot keeps the hosted owner','an explicit rerun replaces the hosted owner','the newest owner is chosen by creation time, never id','an incomplete listing blocks publication','a changed policy revision supersedes'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. git diff --quiet 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/conformance/invariant-2.test.ts packages/core/src/conformance/invariant-8.test.ts; echo "unchanged $?"
       -> prints exactly: unchanged 0
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/conformance/invariant-2-hosted.test.ts packages/core/src/conformance/invariant-8-hosted.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/conformance/invariant-2-hosted.test.ts packages/core/src/conformance/invariant-8-hosted.test.ts -> exit 0
    8. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/conformance/invariant-2-hosted.test.ts packages/core/src/conformance/invariant-8-hosted.test.ts
       -> prints two lines ending in :0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/conformance/invariant-2-hosted.test.ts packages/core/src/conformance/invariant-8-hosted.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
