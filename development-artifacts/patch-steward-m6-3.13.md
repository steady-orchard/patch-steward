# Step 3.13

- id: 3.13
- depends_on: [3.2, 3.3, 3.7, 3.10, 3.11]
- route: mechanical
- objective: Add the hosted gate orchestrator `runHostedGate` (authenticate, tokens and bot id, trusted policy, repository-gate refusal, ownership listing, closure branch, echo check, capture, deduplication, contract and caps, commit files and outputs, summary, token revocation) as packages/core/src/pipeline/hosted-gate.ts.
- files_in_scope:
    - packages/core/src/pipeline/hosted-gate.ts
    - packages/core/src/pipeline/hosted-gate.test.ts
    - development-artifacts/patch-steward-m6-3.13-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: the `gate` job of the hosted screening workflow runs this function once per issue or pull request event (observe mode,
    contract level). It decides whether the event commits a new owner of the submission, and if so returns the files the workflow
    uploads as same-run artifacts: `steward-handoff` (handoff.json + gate-context.json) BEFORE the ownership artifact
    `steward-ownership-<pr|issue>-<n>` (ownership.json); upload success, not this function, is the commitment point. It never writes
    to GitHub: its only non-GET requests are App token mints and revocations. Order (first failure or stop wins):
      1. authenticate the event; mint the target token; look up the App bot user id; load the trusted policy from the default
         branch; refuse an active repository gate (any mode other than observe).
      2. list the submission's ownership artifacts, pick the newest by created_at, download and validate its record when unique —
         for EVERY event kind (reruns, reopens, and closures included; never skipped).
      3. closure (action 'closed', or issue 'deleted'): record-only path paired from step 2; stop.
      4. verified echo (sender is the App bot AND the triggering object id is in the unique newest valid record's receipts): stop
         as duplicate reason echo (nothing captured).
      5. capture the submission (snapshot hash).
      6. deduplication decision over the step 2 listing (the published-evidence fallback read only when the listing is empty and
         the event is neither an explicit rerun nor 'reopened'); duplicate -> stop.
      7. contract; caps only for otherwise runnable work -> 'runnable', 'early-exit', or 'queued'.
      8. commit: build handoff.json, gate-context.json, ownership.json; outputs.

    Base check (files changed in steps 3.2, 3.3, 3.7, 3.10, 3.11): packages/core/src/pipeline/gate.ts exports
    gateCaptureSubmission, buildGateHandoff, gateContractLogLines, type GateCapture; packages/core/src/pipeline/gate-context.ts
    exports gateContextRecordSchema, closureContextRecordSchema, encodeGateContext, encodeClosureContext, classificationRecord,
    HANDOFF_FILE, GATE_CONTEXT_LOG_LINES_MAX; packages/core/src/pipeline/hosted-environment.ts exports readGateEnvironment,
    hostedEventEnvironment, type HostedGateEnvironment; packages/core/src/evidence/store-world.test.ts exports createStoreWorld;
    packages/core/src/pipeline/hosted-world.test.ts exports createHostedWorld, gateEnvironment, issuesEventPayload,
    pullRequestEventPayload, worldPolicyText, ownershipArtifactZip (read these files for their exact shapes).

    Existing APIs to use (read signatures in the files):
    - authenticateEvent(EventEnvironment, payload) -> AuthenticatedEvent { eventName, action, repository { fullName, id,
      defaultBranch }, subject { type, number }, objectId, objectUpdatedAt, authorId, senderId, senderType, merged, closure, runId,
      runAttempt } or err 'gate.event-invalid'; eventIdentity(event); stewardConcurrencyGroup(repositoryId, type, number);
      closureResolution(event) (packages/core/src/ownership/events.ts).
    - mintInstallationToken(credentials, repositoryRef, role, { budget, fetch, sleep }) -> InstallationToken { secret() };
      lookupAppBotUserId(credentials, token, deps); revokeInstallationToken(token, deps) (packages/core/src/github/app-auth.ts);
      roles 'gate-target' and 'store-read'.
    - githubBudgetForPreflight() (the bootstrap budget, 20 requests) and githubBudgetForPolicy(policy)
      (packages/core/src/github/budget.ts); createGitHubClient({ token, budget, fetch, sleep }) (client.ts);
      repositoryRefFromFullName (reader.ts).
    - loadPolicy({ kind: 'github', client, repository, branch }) (policy/loader.ts; revision kind 'git-tree' with id, commit, ref).
    - readOwnershipListing(client, repository, subject, { resolver, transport }) -> OwnershipListingRead ('unavailable' with
      failure, 'incomplete', 'none', 'ambiguous', 'unique' with artifact and record { kind: 'valid', record } | invalid |
      unavailable); dedupListingRead(read) (github/artifacts.ts).
    - decideDeduplication, appliesListingDeduplication, isVerifiedEcho (ownership/dedup.ts); readPublishedSnapshot
      (evidence/fallback-read.ts); evidenceStoreLocation(policy.evidence.store, targetRepository) (evidence/git-store.ts).
    - readCapRunLists(client, repository, now) (github/runs.ts); evaluateCaps (ownership/caps.ts).
    - encodeOwnershipRecord, ownershipArtifactName (ownership/record.ts); buildClosureMetricsEvent (evidence/metrics.ts).
    - initialBudget (pipeline/budget.ts); validateHandoff, handoffRecordSchema (pipeline/handoff.ts); canonicalJson.
    - redactEvidenceStrings (evidence/redact-records.ts); renderJobSummary, fitJobSummary (pipeline/job-summary.ts);
      reportCodeSpan (report/escape.ts); systemClock (clock.ts); systemAttachmentResolver, httpsAttachmentTransport
      (net/https-transport.ts).

    Required API (exact names; export nothing else; names verified unique across packages/core/src and packages/cli/src):
      export const HOSTED_GATE_FAILURE_CODES = ['gate.policy-missing', 'gate.policy-invalid', 'gate.repository-gate-unsupported'] as const;
      export type HostedGateFailureCode = (typeof HOSTED_GATE_FAILURE_CODES)[number];
      export const HOSTED_GATE_FAILURE_CAUSES: { readonly [K in HostedGateFailureCode]: FailureCause } = Object.freeze({
        'gate.policy-missing': 'policy-unavailable', 'gate.policy-invalid': 'policy-invalid',
        'gate.repository-gate-unsupported': 'policy-invalid' });
      export function hostedRepositoryGateActive(policy: ResolvedPolicy): boolean;
        // policy.modes.default !== 'observe' || any defined policy.modes.per_category value !== 'observe'
      export function repositoryGateRefusal(policy: ResolvedPolicy): Result<null, 'gate.repository-gate-unsupported'>;
        // active -> err('gate.repository-gate-unsupported', 'policy-invalid', 'The repository gate is not supported by this
        // steward version.'); else ok(null)
      export function mapHostedPolicyFailure(failure: StewardFailure): StewardFailure;
        // code 'policy-source.not-published' -> err('gate.policy-missing', 'policy-unavailable', 'The repository has no
        // published policy on its default branch.').failure; cause 'policy-invalid' -> err('gate.policy-invalid',
        // 'policy-invalid', 'The published policy on the default branch is invalid.', failure.details).failure; else unchanged
      export type HostedGateFileName = 'handoff' | 'gate-context' | 'ownership' | 'closure';
      export interface HostedGateFile { readonly name: HostedGateFileName; readonly bytes: Uint8Array }
      export interface HostedGateInput { readonly environment: HostedGateEnvironment; readonly payload: Uint8Array }
      export interface HostedGateDeps {
        readonly fetch?: GitHubAnyFetch; readonly sleep?: (ms: number) => Promise<void>; readonly clock?: Clock;
        readonly attachmentResolver?: AttachmentResolver; readonly attachmentTransport?: AttachmentTransport;
        readonly mask: (secret: string) => void;
        readonly writeSummary: (text: string) => Promise<void>;
        readonly receipts?: (record: OwnershipRecord) => readonly number[];   // default: () => [] (no receipts are recorded yet)
      }
      export type HostedGateResult =
        | { readonly ok: true; readonly disposition: GateDisposition; readonly outputs: Readonly<Record<string, string>>;
            readonly files: readonly HostedGateFile[]; readonly logLines: readonly string[] }
        | { readonly ok: false; readonly failure: StewardFailure; readonly logLines: readonly string[] };
      export async function runHostedGate(input: HostedGateInput, deps: HostedGateDeps): Promise<HostedGateResult>;

    runHostedGate rules (all network calls get deps.fetch, deps.sleep, the resolver/transport defaults when absent):
    - started = clock.now(). Event: authenticateEvent(hostedEventEnvironment(env), payload); failure -> return it (no request was
      made). Log `event <eventName> <action> <pr|issue> <number> sender <senderType>`.
    - bootstrap = githubBudgetForPreflight(). target = repositoryRefFromFullName(event.repository.fullName). token =
      mintInstallationToken(env.credentials, target, 'gate-target', { budget: bootstrap, fetch, sleep }); on success call
      deps.mask(token.secret()) IMMEDIATELY and remember the token for revocation; failure -> return it. botUserId =
      lookupAppBotUserId(env.credentials, token, { budget: bootstrap, fetch, sleep }); failure -> return it.
    - loaded = loadPolicy({ kind: 'github', client: createGitHubClient({ token: token.secret(), budget: bootstrap, fetch, sleep }),
      repository: target, branch: event.repository.defaultBranch }); failure -> return mapHostedPolicyFailure(failure);
      policyLoadedAt = clock.now().toISOString(); the revision is kind 'git-tree' (narrow; anything else -> 'gate.policy-invalid').
      Log `policy trusted-branch revision <id>`. repositoryGateRefusal(policy) failure -> return it.
    - runBudget = githubBudgetForPolicy(policy); client = createGitHubClient({ token: token.secret(), budget: runBudget, fetch,
      sleep }). listing = readOwnershipListing(client, target, event.subject, { resolver, transport }). Log `listing <kind>` plus
      ` owner <run_id>-<run_attempt>` for a unique valid record, or ` record invalid|unavailable`.
    - Listing failures (used by closures always and by the dedup decision): 'unavailable', or 'unique' with record 'unavailable'
      -> err('ownership.listing-unavailable', 'github-unavailable', 'The ownership listing could not be read.'); 'unique' with
      record 'invalid' -> err('ownership.record-invalid', 'github-unavailable', 'The newest ownership record is invalid.').
    - Closure (event.closure): a listing failure as above -> return it. paired = unique valid record ? { runId, runAttempt,
      snapshotHash } : null (none, ambiguous, and incomplete pair null). event record = buildClosureMetricsEvent({ repository,
      type, number, resolution: closureResolution(event), pairedRun, pairedSnapshotHash, recordedAt: clock.now().toISOString() }).
      store = evidenceStoreLocation(policy.evidence.store, fullName). closure record { schema_version: 1, record_type: 'closure',
      run: { run_id: event.runId, run_attempt: event.runAttempt }, repository: { full_name, id, default_branch }, subject, policy:
      { revision, commit, ref, loaded_at: policyLoadedAt }, store: { type: policy.evidence.store.type, repository: owner/name of
      store.repository, branch }, github_requests_remaining: max(0, policy.limits.github.requests_per_run -
      runBudget.requestsUsed()), event } -> redact (below) -> encodeClosureContext. Outputs { disposition: 'closure', commit:
      'false', record_only: 'true', concurrency_group: '', snapshot_hash: '', policy_revision: <id>, ownership_artifact: '' };
      files [{ name: 'closure', bytes }]. Log `disposition closure resolution <kind>`.
    - Echo: receipts = unique valid ? (deps.receipts ?? (() => []))(record) : []; isVerifiedEcho({ senderId, botUserId,
      triggeringResourceId: event.objectId, receipts }) -> ok duplicate: outputs { disposition: 'duplicate', commit: 'false',
      record_only: 'false', concurrency_group: '', snapshot_hash: '', policy_revision: <id>, ownership_artifact: '' }, files [],
      log `dedup duplicate echo`.
    - Capture: gateCaptureSubmission({ client, repository: target, policy, policyRevision: <id>, attachmentResolver,
      attachmentTransport, authorResponses: [] }, event.subject); failure -> return it.
    - Fallback: only when listing.kind === 'none' && appliesListingDeduplication(event.runAttempt, event.action): store location;
      when store.repository equals the target use `client`; otherwise mint a 'store-read' token for the store repository on the
      BOOTSTRAP budget (mask it, remember it; a mint failure makes the fallback { kind: 'unavailable' }) and a client with that
      token on runBudget; fallback = readPublishedSnapshot(storeClient, { store, targetRepository: fullName, subject }).
    - Dedup: decideDeduplication({ runAttempt, action, echo: false, listing: dedupListingRead(listing), fallback (or null),
      captured: { snapshotHash: capture.submission.snapshot_hash, policyRevision: <id> } }); failure -> return it; duplicate ->
      outputs as for echo but snapshot_hash = the captured hash, log `dedup duplicate <reason> owner <runId>-<runAttempt>` (owner
      part only when keptOwner); commit -> log `dedup commit <reason>`.
    - Disposition: capture.earlyExit !== null -> 'early-exit', cap null. Else lists = readCapRunLists(client, target, clock.now());
      caps = evaluateCaps({ ...lists, now, botUserId, authorId: event.authorId, currentRunId: event.runId, dailyLimit:
      policy.limits.caps.daily_runs, authorLimit: policy.limits.caps.per_author_concurrent_runs }); lists.failure !== null or caps
      failure -> err('caps.run-list-unavailable', 'github-unavailable', 'The run list could not be read completely.'); cap = {
      state, daily_count, daily_limit, author_count, author_limit }; 'within' -> 'runnable' else 'queued'. Log `caps <state> daily
      <n> of <limit> author <n> of <limit>`.
    - Commit: every timestamp written into a record is an ISO string (Date.toISOString()). handoff = buildGateHandoff(capture, {
      run: { run_id: event.runId, run_attempt: event.runAttempt }, policyRevision,
      budgetRemaining: initialBudget(policy, { githubRequests: runBudget.requestsUsed() }) }); validateHandoff(handoff, {
      previous: null, gate: null, maxRounds: policy.stages.challenge_rounds }) failure -> return it. ownership record {
      schema_version: 1, record_type: 'ownership', repository: fullName, subject, run_id, run_attempt, check_id: null, snapshot_hash,
      policy_revision, disposition, admission: 'not-required', cap, event: eventIdentity(event), author_id: event.authorId,
      created_at: clock.now().toISOString() } -> encodeOwnershipRecord (failure -> return it). gate context record: schema_version
      1, record_type 'gate-context', run, repository { full_name, id, default_branch }, subject, disposition, snapshot_hash,
      policy { revision, commit, ref, loaded_at }, store (as for closures), submission: capture.submission, base_commit:
      capture.baseCommit, mode: capture.mode, classification: classificationRecord(capture.classification), required_stages,
      cap, github_requests: bootstrap.requestsUsed() + runBudget.requestsUsed(), started_at: started.toISOString(), completed_at:
      clock.now().toISOString(),
      log_lines: the log lines so far plus `disposition <d>`, capped at GATE_CONTEXT_LOG_LINES_MAX.
      REDACT before encoding: redactEvidenceStrings([{ value: handoff, schema: handoffRecordSchema }, { value: context, schema:
      gateContextRecordSchema }], [], { credentials: [env.credentials.privateKey, ...minted token secrets], policyPatterns:
      policy.evidence.redaction_patterns mapped to { id, pattern } }) (closures: the closure record with its schema); failure ->
      return it. handoff bytes = UTF-8 of canonicalJson(redacted handoff).value; context bytes = encodeGateContext(redacted).
      Outputs { disposition, commit: 'true', record_only: 'false', concurrency_group: stewardConcurrencyGroup(repository id, type,
      number), snapshot_hash, policy_revision, ownership_artifact: ownershipArtifactName(type, number) }; files in this order:
      handoff, gate-context, ownership.
    - Output keys are always exactly these seven: disposition, commit, record_only, concurrency_group, snapshot_hash,
      policy_revision, ownership_artifact; values are single-line and never contain event text.
    - finally: revokeInstallationToken(t, { budget: bootstrap, fetch, sleep }) for every minted token (ignore results; never
      throw). Then write the summary exactly once via deps.writeSummary: renderJobSummary({ job: 'gate', repository, subjectType,
      subjectNumber, runId, runAttempt, status: disposition or 'failed', snapshotHash, policyRevision, owner: kept owner ->
      { action: 'kept', ... }, committed -> { action: 'committed', runId: event.runId, runAttempt: event.runAttempt }, else null,
      caps, evidence: null, freshness: null, retentionDays: null, failureCode }) — when the event itself failed, write
      fitJobSummary(['## Patch Steward gate', '', '- Status: ' + reportCodeSpan('failed'), '- Failure: ' +
      reportCodeSpan(code)], JOB_SUMMARY_MAX_LENGTH) instead.
    - A thrown exception anywhere -> err('steward.internal-error', 'steward-defect', 'An internal error stopped the run.'); tokens
      are still revoked and the summary still written.

    Tests (packages/core/src/pipeline/hosted-gate.test.ts): world = createHostedWorld({ handlers: [store.handler] }) with store =
    createStoreWorld(); environment = readGateEnvironment(gateEnvironment(world, overrides)) (must be ok); payload =
    issuesEventPayload(world, action, options) or pullRequestEventPayload (GITHUB_EVENT_NAME 'pull_request_target'); deps {
    fetch: world.fetch, sleep: async () => undefined, clock: fixedClock(WORLD_NOW) from '../clock.js', attachmentResolver:
    world.resolver, attachmentTransport: world.transport, mask: (s) => masks.push(s), writeSummary: async (t) => summaries.push(t)
    }. To simulate the workflow's upload of a committed run's ownership artifact: world.addArtifact({ name:
    outputs.ownership_artifact, createdAt, workflowRunId: <that run id>, recordBytes: <the 'ownership' file bytes> }).

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters. Never write the text STEWARD_APP_ID, STEWARD_APP_PRIVATE_KEY, or
    STEWARD_APP_CLIENT_ID unless immediately preceded by PATCH_. Import specifiers must not contain llm, model, copilot, openai,
    anthropic, sandbox, container, docker, or runner (a conformance scan). Do not use the text `method: 'POST'` or other non-GET
    method literals in this module (writes go only through the App token helpers). Do not edit packages/core/src/index.ts or any
    existing file. Tests: no temp files, no child processes, no real network (always pass world.fetch, world.resolver,
    world.transport, and a no-op sleep).
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const chk=[['packages/core/src/pipeline/gate.ts','export async function gateCaptureSubmission'],['packages/core/src/pipeline/gate.ts','export function buildGateHandoff'],['packages/core/src/pipeline/gate-context.ts','export function encodeGateContext'],['packages/core/src/pipeline/gate-context.ts','export function classificationRecord'],['packages/core/src/pipeline/hosted-environment.ts','export function readGateEnvironment'],['packages/core/src/evidence/store-world.test.ts','export function createStoreWorld'],['packages/core/src/pipeline/hosted-world.test.ts','export function createHostedWorld']];const miss=chk.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s)).map(c=>c.join(' '));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/pipeline/hosted-gate.ts per context.
    3. Create packages/core/src/pipeline/hosted-gate.test.ts (describe 'hosted gate'), plain it(...) with EXACTLY these titles:
       - 'the gate lists ownership before capture': issue 29 'opened' -> in world.requests the default-branch ref read precedes the
         first '/actions/artifacts?' request, which precedes the first '/issues/29' request; the first request is the installation
         lookup.
       - 'a runnable issue commits handoff, context, and ownership files': disposition 'runnable'; files names ['handoff',
         'gate-context', 'ownership']; outputs commit 'true', ownership_artifact 'steward-ownership-issue-29', concurrency_group
         'steward-1376317064-issue-29'; the ownership bytes decode (decodeOwnershipRecord) with run_id WORLD_RUN_ID and cap state
         'within'; the gate-context bytes decode (decodeGateContext with { runId: WORLD_RUN_ID, maxAttempt: 1, repository:
         WORLD_REPOSITORY, repositoryId: WORLD_REPOSITORY_ID }) with the same snapshot_hash as outputs.snapshot_hash.
       - 'an unstructured issue exits early without caps': issue 30 -> 'early-exit'; no '/actions/runs' request; the ownership
         record cap is null.
       - 'an over-cap run is queued': worldPolicyText([['daily_runs: 50', 'daily_runs: 1']]) policy and one createdToday run item
         (path '.github/workflows/steward-issues.yml', event 'issues', status 'completed', createdAt '2026-09-28T09:00:00Z',
         displayTitle 'steward issue 30 author 2095171 event issues opened sender 2095171 User', another id) -> 'queued'; ownership
         cap state 'daily-runs'.
       - 'an unchanged snapshot keeps the current owner': commit run A, add its ownership artifact, run again as run A+1 with action
         'edited' -> ok 'duplicate'; files []; outputs commit 'false'; the summary contains 'kept'.
       - 'a changed body commits a new owner': after the previous setup, change issues.get(29).body -> 'runnable' again.
       - 'an explicit rerun commits whatever the snapshot': same run id with GITHUB_RUN_ATTEMPT '2' and an unchanged snapshot ->
         'runnable'.
       - 'a verified echo stops before capture': with A's artifact present, a payload with senderId WORLD_BOT_ID, senderType 'Bot'
         and deps.receipts = () => [5578290556] -> 'duplicate'; no '/issues/29' request and no '/repos/<target>' repository read
         after the artifact listing; files [].
       - 'a bot event without receipts is captured': the same without receipts -> a '/issues/29' request happens; disposition
         'duplicate' (unchanged snapshot), not an echo.
       - 'a closure records a paired resolution': with A's artifact present, issue action 'closed' by the author -> 'closure';
         outputs record_only 'true', commit 'false'; files [closure]; decodeClosureContext(...) event payload resolution
         'closed-by-author' and paired_run { run_id: A, run_attempt: 1 }.
       - 'an invalid event mints no token': payload bytes of 'not json' -> failure.code 'gate.event-invalid'; world.requests is
         empty; masks empty; one summary containing 'gate.event-invalid'.
       - 'a missing trusted policy fails before the listing': world.setPolicy(null) -> 'gate.policy-missing'; no '/actions/artifacts'
         request.
       - 'an active repository gate is refused': worldPolicyText([['modes:\n  default: observe', 'modes:\n  default: advise']]) ->
         'gate.repository-gate-unsupported'; no '/actions/artifacts' request.
       - 'an unavailable listing fails before capture': override answering 500 for '/actions/artifacts' -> failure.code
         'ownership.listing-unavailable'; no '/issues/29' request.
       - 'minted tokens are masked and revoked': after a runnable run, masks equals world.tokens and the number of DELETE
         '/installation/token' requests equals world.tokens.length; no minted token appears in any output value or file bytes.
       - 'the gate summary is written once': exactly one summary per run, starting with '## Patch Steward gate'.
    4. Run: pnpm exec prettier --write packages/core/src/pipeline/hosted-gate.ts packages/core/src/pipeline/hosted-gate.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/hosted-gate.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.13.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.13.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['the gate lists ownership before capture','a runnable issue commits handoff, context, and ownership files','an unstructured issue exits early without caps','an over-cap run is queued','an unchanged snapshot keeps the current owner','a changed body commits a new owner','an explicit rerun commits whatever the snapshot','a verified echo stops before capture','a bot event without receipts is captured','a closure records a paired resolution','an invalid event mints no token','a missing trusted policy fails before the listing','an active repository gate is refused','an unavailable listing fails before capture','minted tokens are masked and revoked','the gate summary is written once'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. grep -cE "method: '(POST|PATCH|DELETE|PUT)'|fetch\(" packages/core/src/pipeline/hosted-gate.ts -> prints 0 (grep exit status 1 is expected)
    4. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- packages/core/src/pipeline/hosted-gate.ts packages/core/src/pipeline/hosted-gate.test.ts; echo "grep $?"
       -> prints exactly: grep 1
    5. pnpm vitest run -> exit 0
    6. pnpm typecheck -> exit 0
    7. pnpm exec eslint packages/core/src/pipeline/hosted-gate.ts packages/core/src/pipeline/hosted-gate.test.ts -> exit 0
    8. pnpm exec prettier --check packages/core/src/pipeline/hosted-gate.ts packages/core/src/pipeline/hosted-gate.test.ts -> exit 0
    9. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-gate.test.ts
       -> prints 0 (grep exit status 1 is expected)
    10. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/hosted-gate.ts packages/core/src/pipeline/hosted-gate.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
