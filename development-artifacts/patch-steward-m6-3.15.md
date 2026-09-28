# Step 3.15

- id: 3.15
- depends_on: [3.4, 3.11]
- route: mechanical
- objective: Add the publish freshness verification `verifyPublishFreshness` (settle delay, re-list, successor record read, live recapture under the current trusted policy, ordered decision) and the typed `publish.freshness-unknown` failure as packages/core/src/pipeline/hosted-freshness.ts.
- files_in_scope:
    - packages/core/src/pipeline/hosted-freshness.ts
    - packages/core/src/pipeline/hosted-freshness.test.ts
    - development-artifacts/patch-steward-m6-3.15-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: after the hosted publish job has committed and read back its evidence, it must decide whether the run is still the newest
    committed owner of the submission and whether the submission is unchanged. Order: wait the settle delay
    (OWNERSHIP_SETTLE_DELAY_MS = 10000 from '../policy/bounds.js') so recent uploads are visible, re-list the submission's
    ownership artifacts, then apply the pure rules of packages/core/src/ownership/freshness.ts (step 3.4): freshnessTop, then
    only when the top is 'newer' download and validate that artifact's record (the successor), and only when this run's artifact
    is the unique newest recapture the submission under the LIVE default-branch trusted policy; then decidePublishFreshness.
    Unknown freshness fails publication with 'publish.freshness-unknown' (cause 'github-unavailable'); it never supersedes.

    Base check (files changed in steps 3.4 and 3.11): packages/core/src/ownership/freshness.ts exports freshnessTop,
    decidePublishFreshness, types PublishFreshness, FreshnessUnknownReason, OwnArtifactReference;
    packages/core/src/pipeline/hosted-world.test.ts exports createHostedWorld.

    Existing APIs (read signatures): listOwnershipArtifacts(client, repository, name) and downloadOwnershipRecord(client,
    repository, artifact, expected { repository, type, number, artifactName, workflowRunId }, { resolver, transport })
    (github/artifacts.ts); ownershipArtifactName(type, number) and type OwnershipRecord (ownership/record.ts); loadPolicy({ kind:
    'github', client, repository, branch }) (policy/loader.ts); captureIssue(ctx, number) and capturePullRequest(ctx, number) with
    CaptureContext { client, repository, policy, policyRevision, attachmentResolver, attachmentTransport, authorResponses: [] };
    their results carry snapshotHash (submission/intake.ts); types GitHubClient (github/client.ts), GitHubRepositoryRef
    (github/reader.ts), AttachmentResolver, AttachmentTransport (net/attachment-fetch.ts), SubmissionType; err, type Err.

    Required API (exact names; export nothing else; names verified unique across packages/core/src and packages/cli/src):
      export const PUBLISH_FRESHNESS_FAILURE_CODES = ['publish.freshness-unknown'] as const;
      export type PublishFreshnessFailureCode = (typeof PUBLISH_FRESHNESS_FAILURE_CODES)[number];
      export function publishFreshnessFailure(reason: FreshnessUnknownReason): Err<PublishFreshnessFailureCode>;
        // err('publish.freshness-unknown', 'github-unavailable', 'Publication freshness could not be confirmed.', [{ code:
        // 'publish.freshness-unknown', path: reason, message: <same>, line: null, column: null }])
      export interface PublishFreshnessInput {
        readonly client: GitHubClient;                 // target-repository token on the run budget
        readonly repository: GitHubRepositoryRef;
        readonly defaultBranch: string;
        readonly subject: { readonly type: SubmissionType; readonly number: number };
        readonly own: OwnArtifactReference;            // this run's artifact as read before the evidence commit
        readonly record: OwnershipRecord;              // this run's ownership record
      }
      export interface PublishFreshnessDeps {
        readonly resolver: AttachmentResolver; readonly transport: AttachmentTransport;
        readonly sleep: (ms: number) => Promise<void>; readonly settleMs?: number;   // default OWNERSHIP_SETTLE_DELAY_MS
      }
      export interface PublishFreshnessResult { readonly freshness: PublishFreshness; readonly logLines: readonly string[] }
      export async function verifyPublishFreshness(input: PublishFreshnessInput, deps: PublishFreshnessDeps):
        Promise<PublishFreshnessResult>;

    verifyPublishFreshness rules (never throws; any exception -> freshness { kind: 'unknown', reason: 'listing-unavailable' }):
    1. await deps.sleep(settleMs) exactly once, before any request.
    2. name = ownershipArtifactName(subject.type, subject.number); listing = listOwnershipArtifacts(client, repository, name);
       top = freshnessTop(listing.ok ? listing.value : null, name, own).
    3. top.kind 'newer': downloadOwnershipRecord(client, repository, top.artifact, { repository: owner/name, type, number,
       artifactName: name, workflowRunId: top.artifact.workflowRunId }, { resolver, transport }) -> ok ? { kind: 'valid', runId:
       record.run_id, runAttempt: record.run_attempt } : { kind: 'unavailable' }. No recapture request is made.
    4. top.kind 'own-newest': live = loadPolicy({ kind: 'github', client, repository, branch: defaultBranch }); failure ->
       { kind: 'unavailable' }; else capture (captureIssue for 'issue', capturePullRequest for 'pull_request') with { client,
       repository, policy: live.policy, policyRevision: live.revision.id, attachmentResolver: resolver, attachmentTransport:
       transport, authorResponses: [] }; failure -> { kind: 'unavailable' }; ok -> { kind: 'captured', snapshotHash:
       capture.snapshotHash, policyRevision: live.revision.id }.
    5. freshness = decidePublishFreshness({ top, successor (or null), live (or null), recorded: { snapshotHash:
       record.snapshot_hash, policyRevision: record.policy_revision } }).
    Log lines (derived values only): `freshness settle <ms> ms`, `freshness listing <ok|unavailable>`, and one of `freshness
    current`, `freshness superseded newer-owner <run_id>-<run_attempt>`, `freshness superseded snapshot-changed`, `freshness
    unknown <reason>`.

    Tests (packages/core/src/pipeline/hosted-freshness.test.ts): world = createHostedWorld(); client = createGitHubClient({ token:
    'test-token-' + 'f'.repeat(12), budget: createGitHubBudget({ requests: 100, retriesPerRequest: 0 }), fetch: world.fetch });
    deps { resolver: world.resolver, transport: world.transport, sleep: async (ms) => { world.requests.push({ method: 'SLEEP',
    host: '', path: String(ms) }) } }. The own record must carry the snapshot hash the world currently produces: compute it in
    the test with loadPolicy github + captureIssue(ctx, 29) against the same world, then build the record with
    ownershipRecordSchema.parse (repository WORLD_REPOSITORY, subject issue 29, run_id WORLD_RUN_ID, run_attempt 1, check_id null,
    that snapshot_hash, policy_revision world.policyTreeId(), disposition 'runnable', admission 'not-required', cap { state:
    'within', daily_count: 1, daily_limit: 50, author_count: 1, author_limit: 2 }, event { name: 'issues', action: 'opened',
    object_id: 5578290556, object_updated_at: '2026-09-28T09:59:00Z', sender_id: WORLD_AUTHOR_ID, sender_type: 'User' },
    author_id WORLD_AUTHOR_ID, created_at '2026-09-28T10:00:04.000Z'). own = world.addArtifact({ name:
    'steward-ownership-issue-29', createdAt: '2026-09-28T10:00:05Z', workflowRunId: WORLD_RUN_ID, recordBytes:
    encodeOwnershipRecord(record) bytes }) mapped to { id, createdAt, workflowRunId }. A newer owner: a record with run_id
    WORLD_RUN_ID + 1 and run_attempt 2 added with createdAt '2026-09-28T10:00:09Z'.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters. Import specifiers must not contain llm, model, copilot, openai,
    anthropic, sandbox, container, docker, or runner. Do not edit packages/core/src/index.ts or any existing file. Tests: no temp
    files, no child processes, no real network (world.fetch, world.resolver, world.transport; injected sleep).
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const chk=[['packages/core/src/ownership/freshness.ts','export function freshnessTop'],['packages/core/src/ownership/freshness.ts','export function decidePublishFreshness'],['packages/core/src/pipeline/hosted-world.test.ts','export function createHostedWorld']];const miss=chk.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s)).map(c=>c.join(' '));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/pipeline/hosted-freshness.ts per context.
    3. Create packages/core/src/pipeline/hosted-freshness.test.ts (describe 'publish freshness verification'), plain it(...) with
       EXACTLY these titles:
       - 'publish verification waits the settle delay before listing': the first entry recorded after the call starts is { method:
         'SLEEP', path: '10000' }, before the '/actions/artifacts' request.
       - 'an unchanged submission is current': freshness { kind: 'current' }.
       - 'a newer owner supersedes with its recorded attempt': superseded 'newer-owner' with successor { run_id: WORLD_RUN_ID + 1,
         run_attempt: 2, artifact_created_at: '2026-09-28T10:00:09Z' }.
       - 'a newer owner with an invalid record is unknown': the newer artifact added with zip bytes that are not a zip -> unknown
         'successor-unavailable'.
       - 'a tie with the own artifact is unknown': another run's artifact with createdAt '2026-09-28T10:00:05Z' -> unknown 'tie'.
       - 'a changed body supersedes with the live snapshot': issues.get(29).body changed -> superseded 'snapshot-changed' whose
         liveSnapshotHash differs from the record's.
       - 'a changed live policy supersedes': world.setPolicy(worldPolicyText([['daily_runs: 50', 'daily_runs: 49']])) ->
         superseded 'snapshot-changed'.
       - 'a failed listing is unknown': override answering 500 for '/actions/artifacts' -> unknown 'listing-unavailable'.
       - 'a failed recapture is unknown': override answering 500 for '/issues/29' -> unknown 'recapture-unavailable'.
       - 'a newer owner needs no recapture': in the newer-owner case no request path ends with '/git/ref/heads/master' or
         '/issues/29'.
       - 'unknown freshness is a typed failure': publishFreshnessFailure('tie') -> ok false, failure.code
         'publish.freshness-unknown', cause 'github-unavailable', outcome 'inconclusive', details[0].path 'tie'.
    4. Run: pnpm exec prettier --write packages/core/src/pipeline/hosted-freshness.ts packages/core/src/pipeline/hosted-freshness.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/hosted-freshness.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.15.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.15.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['publish verification waits the settle delay before listing','an unchanged submission is current','a newer owner supersedes with its recorded attempt','a newer owner with an invalid record is unknown','a tie with the own artifact is unknown','a changed body supersedes with the live snapshot','a changed live policy supersedes','a failed listing is unknown','a failed recapture is unknown','a newer owner needs no recapture','unknown freshness is a typed failure'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. grep -cE "method: '(POST|PATCH|DELETE|PUT)'|fetch\(" packages/core/src/pipeline/hosted-freshness.ts -> prints 0 (grep exit status 1 is expected)
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/pipeline/hosted-freshness.ts packages/core/src/pipeline/hosted-freshness.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/pipeline/hosted-freshness.ts packages/core/src/pipeline/hosted-freshness.test.ts -> exit 0
    8. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-freshness.test.ts
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/hosted-freshness.ts packages/core/src/pipeline/hosted-freshness.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
