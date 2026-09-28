# Step 3.16

- id: 3.16
- depends_on: [3.1, 3.3, 3.6, 3.7, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15]
- route: mechanical
- objective: Add the hosted publish orchestrator `runHostedPublish` (validate the same-run records against the runner, mint scoped tokens, load the gate's policy by tree id, read this run's own ownership artifact, prepare and commit evidence first, verify freshness, commit a supersession record when superseded, publish closures as one metrics file, write the summary last, revoke tokens) as packages/core/src/pipeline/hosted-publish.ts.
- files_in_scope:
    - packages/core/src/pipeline/hosted-publish.ts
    - packages/core/src/pipeline/hosted-publish.test.ts
    - development-artifacts/patch-steward-m6-3.16-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: the `publish` job of the hosted screening workflow runs this function after a successful `gate` job that committed an
    owner (dispositions runnable, early-exit, queued) or recorded a closure. Evidence is written BEFORE any other publication step:
    no summary outcome and no supersession record before the evidence commit and its read-back succeeded. Failures before the
    evidence commit leave no evidence (no store write request at all). Observe mode: the only GitHub writes are the evidence commit
    (Git Data API through the allowlisted writer) and App token mints and revocations.

    Base check (files changed in steps 3.1, 3.3, 3.6, 3.7, 3.10-3.15): loader.ts exports loadPolicyRevision; gate-context.ts exports
    decodeGateContext, decodeClosureContext, decodeHandoffBytes; prepare-records.ts exports prepareSupersessionEvidence,
    prepareClosureEvidence; hosted-environment.ts exports readPublishEnvironment and type HostedPublishEnvironment;
    store-world.test.ts exports createStoreWorld; hosted-world.test.ts exports publishEnvironment; job-summary.ts renders freshness
    { state }; hosted-gate.ts exports runHostedGate; hosted-evidence.ts exports prepareHostedRunEvidence; hosted-freshness.ts
    exports verifyPublishFreshness and publishFreshnessFailure. Read them for exact shapes.

    Other existing APIs: mintInstallationToken, revokeInstallationToken (github/app-auth.ts; roles 'publish-target',
    'publish-store', 'publish-target-and-store'); githubBudgetForPreflight, createGitHubBudget (github/budget.ts);
    createGitHubClient (client.ts); createGitHubWriter (writer.ts; scope { kind: 'installation', store: { repository, branch } });
    listOwnershipArtifacts, downloadOwnershipRecord (github/artifacts.ts); findOwnOwnershipArtifact (ownership/freshness.ts);
    artifactRetentionDays, ownershipRetentionShort (ownership/artifacts.ts); ownershipArtifactName (ownership/record.ts);
    evidenceStoreLocation, hostedEvidenceLocation (evidence/git-store.ts); writeEvidenceCommit (evidence/store-readback.ts; input {
    store, targetRepository, subject, runId, runAttempt, groups, maxBytes, writeRetries }, deps { client, writer, sleep });
    acceptGateHandoff(candidate, binding, maxRounds) (pipeline/sequence.ts); stewardVersion (version.ts); renderJobSummary,
    fitJobSummary (job-summary.ts); reportCodeSpan (report/escape.ts); metricsStorePath (evidence/layout.ts).

    Required API (exact names; export nothing else; names verified unique across packages/core/src and packages/cli/src):
      export interface HostedPublishFiles { readonly handoff: Uint8Array | null; readonly gateContext: Uint8Array | null;
        readonly closure: Uint8Array | null }
      export interface HostedPublishInput { readonly environment: HostedPublishEnvironment; readonly files: HostedPublishFiles }
      export interface HostedPublishDeps {
        readonly fetch?: GitHubAnyFetch; readonly sleep?: (ms: number) => Promise<void>; readonly clock?: Clock;
        readonly attachmentResolver?: AttachmentResolver; readonly attachmentTransport?: AttachmentTransport;
        readonly mask: (secret: string) => void; readonly writeSummary: (text: string) => Promise<void>;
        readonly version?: () => Result<string, StewardVersionFailureCode>; readonly settleMs?: number;
        readonly redact?: EvidenceRedactFn;
      }
      export type HostedPublishStatus = Outcome | 'queued' | 'closure';
      export type HostedPublishResult =
        | { readonly ok: true; readonly status: HostedPublishStatus; readonly outputs: Readonly<Record<string, string>>;
            readonly logLines: readonly string[] }
        | { readonly ok: false; readonly failure: StewardFailure; readonly evidenceCommit: string | null;
            readonly logLines: readonly string[] };
      export async function runHostedPublish(input: HostedPublishInput, deps: HostedPublishDeps): Promise<HostedPublishResult>;
    Outputs (exactly these keys, single-line values): status (the final status: outcome, 'queued', 'superseded', or 'closure'),
    freshness ('current', 'superseded', 'unknown', or '' for closures), evidence_commit, supersession_commit ('' when none).

    runHostedPublish rules (all network calls get deps.fetch and deps.sleep; resolver/transport default to
    systemAttachmentResolver/httpsAttachmentTransport; clock defaults to systemClock):
    1. started = clock.now(). version = (deps.version ?? stewardVersion)(); failure -> return it.
       expectation = { runId: Number(env.runId), maxAttempt: Number(env.runAttempt), repository: env.repository, repositoryId:
       Number(env.repositoryId) }.
    2. Records, BEFORE any request. Closure path when env.gate.recordOnly: env.gate.disposition must be 'closure' (else
       err('pipeline.handoff-binding', 'steward-defect', 'The same-run record is not bound to this run.')); files.closure null ->
       err('pipeline.handoff-invalid', 'steward-defect', 'The same-run record failed validation.'); ctx =
       decodeClosureContext(files.closure, expectation) (failure -> return it); ctx.policy.revision must equal
       env.gate.policyRevision (else binding). Committed path otherwise: env.gate.disposition must be 'runnable', 'early-exit', or
       'queued' (else binding); files.gateContext or files.handoff null -> invalid; ctx = decodeGateContext(files.gateContext,
       expectation); ctx.disposition === env.gate.disposition, ctx.snapshot_hash === env.gate.snapshotHash, and
       ctx.policy.revision === env.gate.policyRevision, else binding; candidate = decodeHandoffBytes(files.handoff) (failure ->
       return it).
    3. Tokens and policy on a FRESH bootstrap budget (githubBudgetForPreflight()): target = the context repository;
       role = ctx.store.type === 'orphan-branch' ? 'publish-target-and-store' : 'publish-target'; targetToken =
       mintInstallationToken(env.credentials, target, role, { budget: bootstrap, fetch, sleep }); mask it IMMEDIATELY; failure ->
       return it. loaded = loadPolicyRevision({ client: createGitHubClient({ token: targetToken.secret(), budget: bootstrap,
       fetch, sleep }), repository: target, treeId: ctx.policy.revision, commit: ctx.policy.commit, ref: ctx.policy.ref });
       failure -> return it. store = evidenceStoreLocation(loaded.policy.evidence.store, ctx.repository.full_name); its type,
       owner/name, and branch must equal ctx.store, else binding. Committed path: handoff = acceptGateHandoff(candidate, { run_id:
       ctx.run.run_id, run_attempt: ctx.run.run_attempt, snapshot_hash: ctx.snapshot_hash, policy_revision: ctx.policy.revision },
       loaded.policy.stages.challenge_rounds); failure -> return it. storeToken = targetToken for an orphan branch, else
       mintInstallationToken(env.credentials, store.repository, 'publish-store', { budget: bootstrap, ... }) (mask; failure ->
       return it).
    4. Run budget: createGitHubBudget({ requests: committed ? handoff.budget_remaining.github_requests :
       ctx.github_requests_remaining, retriesPerRequest: loaded.policy.limits.github.retries_per_request }). targetClient (target
       token), storeClient and storeWriter (store token; writer scope { kind: 'installation', store: { repository:
       store.repository, branch: store.branch } }) all on that one run budget.
    5. Closure path: prepared = prepareClosureEvidence({ runId: ctx.run.run_id, runAttempt: ctx.run.run_attempt, event:
       ctx.event, credentials }); commit (step 7); status 'closure'; location = hostedEvidenceLocation(store, full_name,
       metricsStorePath(ctx.event.recorded_at, runId, runAttempt)); skip steps 6 and 8.
    6. Committed path, own artifact (before any evidence request): name = ownershipArtifactName(type, number); listing =
       listOwnershipArtifacts(targetClient, target, name) failure, or findOwnOwnershipArtifact(listing, name, ctx.run.run_id) not
       'found' -> err('ownership.listing-unavailable', 'github-unavailable', 'The ownership listing could not be read.');
       downloadOwnershipRecord(targetClient, target, own, { repository: full_name, type, number, artifactName: name,
       workflowRunId: own.workflowRunId }, { resolver, transport }) failure (any code) -> err('ownership.record-invalid',
       'github-unavailable', 'The ownership record is invalid.'); the record's run_id, run_attempt, snapshot_hash,
       policy_revision, and disposition must equal ctx.run.run_id, ctx.run.run_attempt, ctx.snapshot_hash, ctx.policy.revision,
       ctx.disposition, else binding. retention = artifactRetentionDays(own.createdAt, own.expiresAt ?? ''); log `ownership
       retention <n> days` and, when ownershipRetentionShort(retention), `warning ownership.retention-short`. Then
       prepareHostedRunEvidence({ context: ctx, handoff, loadedPolicy: loaded, stewardVersion, store, arrivalAt: own.createdAt,
       publishStartedAt: started.toISOString(), finishedAt: clock.now().toISOString(), publishRequests:
       bootstrap.requestsUsed() + run.requestsUsed(),
       retries: 0, logLines: publish log lines so far, credentials }, { redact }); failure -> return it.
    7. Evidence commit: writeEvidenceCommit({ store, targetRepository: full_name, subject, runId: ctx.run.run_id, runAttempt:
       ctx.run.run_attempt, groups, maxBytes: loaded.policy.limits.evidence.run_bytes, writeRetries:
       loaded.policy.limits.evidence.write_retries }, { client: storeClient, writer: storeWriter, sleep }); failure -> return it
       with evidenceCommit null. Log `evidence commit <sha> rebuilds <n>`.
    8. Committed path, freshness: verifyPublishFreshness({ client: targetClient, repository: target, defaultBranch:
       ctx.repository.default_branch, subject, own: { id, createdAt, workflowRunId }, record }, { resolver, transport, sleep,
       settleMs: deps.settleMs }). current -> status = the outcome (kind 'outcome') or 'queued'. superseded ->
       prepareSupersessionEvidence({ runId, runAttempt, subject: { repository, type, number }, reason, successor (newer-owner) or
       null, recordedSnapshotHash: ctx.snapshot_hash, liveSnapshotHash (snapshot-changed) or null, from: outcome or 'queued',
       recordedAt: clock.now().toISOString(), credentials }) then writeEvidenceCommit with those groups; any failure -> return it with
       evidenceCommit = the first commit; status 'superseded'. unknown -> return publishFreshnessFailure(reason).failure with
       evidenceCommit = the first commit (no supersession record).
    9. credentials for redaction = [env.credentials.privateKey, ...every minted token secret].
    finally: revoke every minted token on the bootstrap budget (ignore results; never throw). Then write the summary exactly once
    (success AND failure) with deps.writeSummary: renderJobSummary({ job: 'publish', repository, subjectType, subjectNumber,
    runId: gate run id, runAttempt: gate attempt, status: final status or 'failed', snapshotHash (committed) or null,
    policyRevision, owner: null, caps: null, evidence: { commit, location } when a commit exists else null, freshness: { state:
    'current' } | { state: 'superseded', reason } | { state: 'unknown' } | null, retentionDays, failureCode }); when the records
    could not even be decoded, write fitJobSummary(['## Patch Steward publish', '', '- Status: ' + reportCodeSpan('failed'),
    '- Failure: ' + reportCodeSpan(code)], JOB_SUMMARY_MAX_LENGTH). A thrown exception -> err('steward.internal-error',
    'steward-defect', 'An internal error stopped the run.').

    Tests (packages/core/src/pipeline/hosted-publish.test.ts) run the real gate first, then simulate the uploads, then publish:
      store = createStoreWorld(); world = createHostedWorld({ handlers: [store.handler] });
      gate = await runHostedGate({ environment: readGateEnvironment(gateEnvironment(world)) value, payload:
        issuesEventPayload(world, 'opened') }, { fetch: world.fetch, sleep, clock: fixedClock(WORLD_NOW), attachmentResolver:
        world.resolver, attachmentTransport: world.transport, mask, writeSummary });
      world.addArtifact({ name: gate.outputs.ownership_artifact, createdAt: '2026-09-28T10:00:05Z', workflowRunId: WORLD_RUN_ID,
        recordBytes: <gate file 'ownership'> });
      publish = await runHostedPublish({ environment: readPublishEnvironment(publishEnvironment(world, gate.outputs)) value,
        files: { handoff: <'handoff' bytes>, gateContext: <'gate-context' bytes>, closure: null } }, { fetch: world.fetch, sleep:
        async () => undefined, clock: fixedClock('2026-09-28T10:00:30.000Z'), attachmentResolver: world.resolver,
        attachmentTransport: world.transport, mask, writeSummary: async (t) => { summaries.push(t); world.requests.push({ method:
        'SUMMARY', host: '', path: '' }); }, version: () => ok('0.0.2') }).
    store.files(WORLD_REPOSITORY) shows the committed evidence (paths such as
    'steady-orchard/patch-steward-testbed-public/runs/issue-29/36081628326-1/run.json').

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters. Never write the text STEWARD_APP_ID, STEWARD_APP_PRIVATE_KEY, or
    STEWARD_APP_CLIENT_ID unless immediately preceded by PATCH_. Import specifiers must not contain llm, model, copilot, openai,
    anthropic, sandbox, container, docker, or runner. No non-GET method literal (`method: 'POST'` etc.) and no `fetch(` in this
    module (writes go only through writeEvidenceCommit and the App token helpers). Do not edit packages/core/src/index.ts or any
    existing file. Tests: no temp files, no child processes, no real network (world fetch/resolver/transport, no-op sleep).
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const chk=[['packages/core/src/policy/loader.ts','export async function loadPolicyRevision'],['packages/core/src/pipeline/gate-context.ts','export function decodeGateContext'],['packages/core/src/evidence/prepare-records.ts','export async function prepareSupersessionEvidence'],['packages/core/src/pipeline/hosted-environment.ts','export function readPublishEnvironment'],['packages/core/src/evidence/store-world.test.ts','export function createStoreWorld'],['packages/core/src/pipeline/hosted-world.test.ts','export function publishEnvironment'],['packages/core/src/pipeline/job-summary.ts',\"state: 'current'\"],['packages/core/src/pipeline/hosted-gate.ts','export async function runHostedGate'],['packages/core/src/pipeline/hosted-evidence.ts','export async function prepareHostedRunEvidence'],['packages/core/src/pipeline/hosted-freshness.ts','export async function verifyPublishFreshness']];const miss=chk.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s)).map(c=>c.join(' '));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/pipeline/hosted-publish.ts per context.
    3. Create packages/core/src/pipeline/hosted-publish.test.ts (describe 'hosted publish'), plain it(...) with EXACTLY these
       titles:
       - 'a runnable issue publishes an inconclusive outcome with evidence first': ok, status 'inconclusive'; outputs freshness
         'current'; store files include '.../runs/issue-29/36081628326-1/manifest.json' and
         '.../metrics/2026-09/36081628326-1.json'; the 'SUMMARY' marker comes after the last '/git/refs' request in world.requests.
       - 'an early exit publishes the contract outcome': issue 30 -> status 'needs-changes'.
       - 'a queued run publishes a waiting run directory': policy with daily_runs 1 plus one counted run item (see the hosted gate
         test) -> status 'queued'; store files include '.../36081628326-1/waiting.json' and no decision.json in that directory.
       - 'a closure publishes one metrics file': gate with issue action 'closed' (after an owner artifact exists), publish with
         files { closure: <'closure' bytes>, handoff: null, gateContext: null } -> status 'closure'; exactly one new store path,
         under '.../metrics/2026-09/'; no '/actions/artifacts' request made by publish.
       - 'publish loads the gate policy by tree id before any evidence request': among publish's requests, one ends with
         '/git/trees/' + <gate policy_revision> + '?recursive=1'; no request path ends with '/git/ref/heads/master' before the
         first '/git/blobs' request.
       - 'a newer owner records a supersession': before publish, add a newer artifact (another run id, createdAt
         '2026-09-28T10:00:09Z') whose record is a valid gate commit of that run (run the gate again as run WORLD_RUN_ID + 1 after
         changing the issue body, and upload its ownership file) -> status 'superseded'; outputs supersession_commit non-empty;
         store files include '.../runs/issue-29/supersessions/36081628326-1.json'; the original run directory is unchanged.
       - 'unknown freshness fails after the evidence commit': a tie (another run's artifact with createdAt
         '2026-09-28T10:00:05Z') -> ok false, failure.code 'publish.freshness-unknown'; evidenceCommit non-null; no supersessions
         path in the store; the summary contains 'unknown'.
       - 'a snapshot mismatch fails before any evidence request': publish env override STEWARD_GATE_SNAPSHOT_HASH 'sha256:' +
         '0'.repeat(64) -> failure.code 'pipeline.handoff-binding'; publish made no request at all.
       - 'a missing own artifact fails before any evidence request': no upload simulated -> 'ownership.listing-unavailable'; no
         '/git/blobs' request; store head unchanged.
       - 'a separate evidence repository receives the commit': a policy with the store replacement [['type: orphan-branch',
         'type: repository\n    repository: steady-orchard/patch-steward-testbed-evidence']] -> status 'inconclusive';
         store.files('steady-orchard/patch-steward-testbed-evidence') holds the run directory and store.head(WORLD_REPOSITORY) is
         null.
       - 'publish tokens are masked and revoked': every token minted during publish is in the masks and is revoked (DELETE
         '/installation/token' count equals the number of publish tokens); no token appears in outputs, log lines, the summary, or
         any store file.
       - 'effective retention is logged': log lines include 'ownership retention 90 days'; the summary mentions the retention.
    4. Run: pnpm exec prettier --write packages/core/src/pipeline/hosted-publish.ts packages/core/src/pipeline/hosted-publish.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/hosted-publish.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.16.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.16.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['a runnable issue publishes an inconclusive outcome with evidence first','an early exit publishes the contract outcome','a queued run publishes a waiting run directory','a closure publishes one metrics file','publish loads the gate policy by tree id before any evidence request','a newer owner records a supersession','unknown freshness fails after the evidence commit','a snapshot mismatch fails before any evidence request','a missing own artifact fails before any evidence request','a separate evidence repository receives the commit','publish tokens are masked and revoked','effective retention is logged'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. grep -cE "method: '(POST|PATCH|DELETE|PUT)'|fetch\(" packages/core/src/pipeline/hosted-publish.ts -> prints 0 (grep exit status 1 is expected)
    4. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- packages/core/src/pipeline/hosted-publish.ts packages/core/src/pipeline/hosted-publish.test.ts; echo "grep $?"
       -> prints exactly: grep 1
    5. pnpm vitest run -> exit 0
    6. pnpm typecheck -> exit 0
    7. pnpm exec eslint packages/core/src/pipeline/hosted-publish.ts packages/core/src/pipeline/hosted-publish.test.ts -> exit 0
    8. pnpm exec prettier --check packages/core/src/pipeline/hosted-publish.ts packages/core/src/pipeline/hosted-publish.test.ts -> exit 0
    9. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-publish.test.ts
       -> prints 0 (grep exit status 1 is expected)
    10. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/hosted-publish.ts packages/core/src/pipeline/hosted-publish.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
