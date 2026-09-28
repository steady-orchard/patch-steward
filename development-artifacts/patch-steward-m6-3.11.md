# Step 3.11

- id: 3.11
- depends_on: []
- route: mechanical
- objective: Add a shared in-memory GitHub for hosted tests (`createHostedWorld`: App and token endpoints, the trusted and proposed policy directories, issues and pull requests, ownership artifacts with zip downloads, tagged run lists, request log, overrides, chained extra handlers, runner environments, and event payload builders), with self-check tests through the real adapters, as packages/core/src/pipeline/hosted-world.test.ts.
- files_in_scope:
    - packages/core/src/pipeline/hosted-world.test.ts
    - development-artifacts/patch-steward-m6-3.11-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: the hosted gate and publish orchestrators, their fixture scenarios, and the conformance tests all need one realistic fake
    of the GitHub REST surface the steward reads. This file is a TEST file (suffix .test.ts, so the build excludes it and Vitest runs
    its self-checks) that also EXPORTS the fake; other test files import it with `from '../pipeline/hosted-world.test.js'` or
    `from './hosted-world.test.js'` (importing re-registers its self-check tests in the importer; expected and harmless). The
    evidence-store Git Data API is NOT in this file: another shared test file (packages/core/src/evidence/store-world.test.ts,
    `createStoreWorld().handler`) is chained in by callers through `options.handlers`; do not import it here.

    Identity (export these constants exactly):
      WORLD_REPOSITORY = 'steady-orchard/patch-steward-testbed-public'; WORLD_REPOSITORY_REF = { owner: 'steady-orchard', name:
      'patch-steward-testbed-public' } (type GitHubRepositoryRef); WORLD_REPOSITORY_ID = 1376317064; WORLD_DEFAULT_BRANCH =
      'master'; WORLD_EVIDENCE_REPOSITORY = 'steady-orchard/patch-steward-testbed-evidence'; WORLD_APP_ID = '4993303';
      WORLD_INSTALLATION_ID = 162868612; WORLD_BOT_ID = 331019482; WORLD_AUTHOR_ID = 2095171; WORLD_MAINTAINER_ID = 1000001;
      WORLD_RUN_ID = 36081628326; WORLD_NOW = '2026-09-28T10:00:00.000Z'; WORLD_ARTIFACT_HOST =
      'productionresultssa0.blob.core.windows.net'.

    Required exports (exact names and shapes):
      export interface WorldRequest { readonly method: string; readonly host: string; readonly path: string }  // path =
        // pathname + search; downloads through the transport are logged with method 'DOWNLOAD'
      export interface WorldHandlerRequest { readonly method: string; readonly url: URL; readonly body: unknown }
      export type WorldHandler = (request: WorldHandlerRequest) => Response | undefined;
      export interface WorldIssue { number: number; id: number; title: string; body: string | null; updatedAt: string; userId:
        number; state: 'open' | 'closed' }
      export interface WorldPull { number: number; id: number; title: string; body: string | null; updatedAt: string; userId:
        number; state: 'open' | 'closed'; merged: boolean; headSha: string; baseRef: string; baseSha: string; files: { filename:
        string; status: string }[] }
      export interface WorldArtifactInput { readonly name: string; readonly createdAt: string; readonly workflowRunId: number;
        readonly id?: number; readonly expiresAt?: string; readonly expired?: boolean; readonly recordBytes?: Uint8Array;
        readonly zip?: Uint8Array | null }
      export interface WorldArtifact { readonly id: number; readonly name: string; readonly createdAt: string; readonly
        expiresAt: string; readonly expired: boolean; readonly workflowRunId: number; readonly zip: Uint8Array | null }
      export interface WorldRunItem { readonly id: number; readonly path: string; readonly event: string; readonly status:
        string; readonly createdAt: string; readonly displayTitle: string }
      export interface HostedWorldOptions { readonly policyText?: string | null; readonly handlers?: readonly WorldHandler[] }
      export interface HostedWorld {
        readonly fetch: GitHubAnyFetch;                  // type from '../github/writer.js'
        readonly resolver: AttachmentResolver;           // types from '../net/attachment-fetch.js'
        readonly transport: AttachmentTransport;
        readonly requests: WorldRequest[];               // mutable; tests may push markers such as { method: 'SUMMARY', host:
                                                         // '', path: '' }
        readonly credentials: AppCredentials;            // { appId: WORLD_APP_ID, privateKey: RSA 2048 PEM (pkcs1) generated
                                                         // once per module with node:crypto generateKeyPairSync }
        readonly tokens: string[];                       // every installation token minted, in order
        readonly issues: Map<number, WorldIssue>;        // mutable state, read at request time
        readonly pulls: Map<number, WorldPull>;
        readonly runs: { readonly createdToday: WorldRunItem[]; readonly inProgress: WorldRunItem[]; readonly queued:
          WorldRunItem[] };
        policyTreeId(): string | null;                   // tree id of .github/patch-steward on the default branch
        policyCommit(): string;                          // current default-branch head commit
        setPolicy(text: string | null): void;            // null = no policy directory; old trees and blobs stay readable by id
        setHeadPolicy(headSha: string, text: string): void;   // policy directory served at a pull request head commit
        addArtifact(input: WorldArtifactInput): WorldArtifact;
        removeArtifact(id: number): void;                // models a re-run attempt's upload replacing the earlier attempt's
        artifacts(): readonly WorldArtifact[];
        override(handler: WorldHandler): void;           // consulted before everything else, in insertion order
      }
      export function createHostedWorld(options?: HostedWorldOptions): HostedWorld;
      export function worldPolicyText(replacements?: readonly (readonly [string, string])[]): string;
      export function ownershipArtifactZip(recordBytes: Uint8Array): Uint8Array;
      export interface WorldEventOptions { readonly number?: number; readonly senderId?: number; readonly senderType?: string;
        readonly fork?: boolean }
      export function issuesEventPayload(world: HostedWorld, action: string, options?: WorldEventOptions): Uint8Array;
      export function pullRequestEventPayload(world: HostedWorld, action: string, options?: WorldEventOptions): Uint8Array;
      export function gateEnvironment(world: HostedWorld, overrides?: Readonly<Record<string, string>>): Record<string, string>;
      export function publishEnvironment(world: HostedWorld, gateOutputs: Readonly<Record<string, string>>, overrides?:
        Readonly<Record<string, string>>): Record<string, string>;

    Policy: worldPolicyText reads fixtures/policies/valid/minimal-no-llm.yml (new URL('../../../../fixtures/...', import.meta.url);
    CRLF -> LF), replaces 'branch: patch-steward-evidence' with 'branch: steward-evidence' (throw if absent), then applies each
    [from, to] with String.replace (throw an Error if `from` is absent). Default options.policyText = worldPolicyText(). Ids: blobId
    = gitBlobId(utf8 bytes) ('../evidence/blob-id.js'); treeId = gitBlobId(Buffer.from('tree\npolicy.yml ' + blobId)); commit =
    gitBlobId(Buffer.from('commit\n' + treeId)) (no policy: gitBlobId(Buffer.from('commit\nno-policy'))).

    fetch(url, init): parse URL; parse init.body as JSON when present; push { method, host, path } to requests; then answer with
    the first defined Response from: overrides (insertion order), options.handlers (in order), built-in routes; else 404 { message:
    'Not Found' }. JSON responses: new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }).
    Built-in routes (T = '/repos/steady-orchard/patch-steward-testbed-public'; match on url.pathname and the query):
    - GET T -> fixtures/github/testbed/repository.json (recorded).
    - GET T + '/installation' and GET '/repos/steady-orchard/patch-steward-testbed-evidence/installation' -> { id:
      WORLD_INSTALLATION_ID }; any other repository's installation -> 404.
    - POST '/app/installations/162868612/access_tokens' -> 201 { token, expires_at: '2026-09-28T11:00:00Z', permissions:
      body.permissions, repositories: [{ full_name: 'steady-orchard/' + body.repositories[0] }] } where token = 'gh' + 's_' + 36
      alphanumeric characters unique per mint (for example 'W'.repeat(30) + a 6-digit zero-padded counter); push it to tokens.
    - DELETE '/installation/token' -> new Response(null, { status: 204 }).
    - GET '/app' -> { id: 4993303, slug: 'patch-steward-testbed', name: 'patch-steward-testbed' }; GET whose decoded pathname is
      '/users/patch-steward-testbed[bot]' -> { login: 'patch-steward-testbed[bot]', id: WORLD_BOT_ID, type: 'Bot' }.
    - GET T + '/git/ref/heads/master' -> { ref: 'refs/heads/master', object: { sha: policyCommit(), type: 'commit' } }.
    - GET T + '/contents/.github' with ref = policyCommit() -> [{ name: 'patch-steward', path: '.github/patch-steward', sha:
      treeId, type: 'dir', size: 0 }, { name: 'workflows', path: '.github/workflows', sha: 'e'.repeat(40), type: 'dir', size: 0 }]
      (no policy: only the workflows entry); with ref = a head sha given to setHeadPolicy -> the same shape with that head policy's
      tree id; any other ref -> the workflows entry only.
    - GET T + '/git/trees/<id>' (last segment without ':') for any policy tree ever created -> { sha: id, truncated: false, tree:
      [{ path: 'policy.yml', mode: '100644', type: 'blob', sha: blobId, size }] }; GET T + '/git/blobs/<blobId>' -> { sha, size,
      encoding: 'base64', content: base64 in 60-character lines joined by '\n' }; unknown ids -> 404.
    - GET T + '/issues/<n>' for n in issues -> fixtures/github/testbed/issue-29.json with number, id, title, body, state,
      updated_at, and user { login: 'jambolo', id: userId, type: 'User' } replaced from the WorldIssue (no pull_request key);
      unknown -> 404.
    - GET T + '/pulls/<n>' -> fixtures/github/testbed/pull-26.json with number, id, title, body, state, draft false, merged,
      updated_at, user, head { sha: headSha, ref: 'scenario-branch' }, base { sha: baseSha, ref: baseRef }, changed_files =
      files.length replaced; GET T + '/pulls/<n>/files' -> files as [{ filename, status }]; GET T + '/commits/<sha>/pulls' -> [{
      number, state, head: { sha } }] for every pull whose headSha is sha.
    - GET T + '/actions/artifacts' with query name -> { total_count, artifacts } over artifacts of that name, each { id, node_id:
      'A_' + id, name, size_in_bytes, url, archive_download_url, expired, created_at, updated_at: created_at, expires_at,
      workflow_run: { id: workflowRunId, repository_id: WORLD_REPOSITORY_ID, head_repository_id: WORLD_REPOSITORY_ID,
      head_branch: 'master', head_sha: 'f'.repeat(40) } }.
    - GET T + '/actions/artifacts/<id>/zip' for a known id -> new Response(null, { status: 302, headers: { location:
      'https://' + WORLD_ARTIFACT_HOST + '/actions-results/' + id + '/ownership.zip?sig=' + 'q'.repeat(16) } }); unknown -> 404.
    - GET T + '/actions/runs' -> { total_count, workflow_runs } from runs.createdToday when the query has `created`, from
      inProgress for status=in_progress, from queued for status=queued; items { id, name: 'steward', display_title, path, event,
      status, conclusion: null, created_at, run_attempt: 1, head_branch: 'master' }.
    resolver: async () => [{ address: '140.82.112.3', family: 4 }]. transport: logs { method: 'DOWNLOAD', host: url.hostname, path },
    answers { kind: 'response', status: 200, location: null, body: <async iterable of the zip bytes>, close: () => undefined } for
    '/actions-results/<id>/ownership.zip' of an artifact with zip bytes, else status 404 with an empty body (copy bodyFrom from
    packages/core/src/github/artifacts.test.ts).
    addArtifact: id defaults to 900 + count; expiresAt defaults to createdAt plus 90 days; expired false; zip = input.zip when given
    (null allowed), else ownershipArtifactZip(recordBytes) when recordBytes is given, else null.
    ownershipArtifactZip: a single stored (method 0) entry named 'ownership.json' with correct CRC-32, local header, central
    directory, and end record (copy buildZip from packages/core/src/net/zip-entry.test.ts or github/artifacts.test.ts).
    Default state: issues 29 { id: 5578290556, title: '[scenario] defect report', body: fixtures/submissions/defect-complete.txt
    (LF), updatedAt '2026-09-28T09:59:00Z', userId WORLD_AUTHOR_ID, state 'open' } and 30 { id: 5578312503, title: '[scenario]
    unstructured report', body: null, same updatedAt, userId, state 'open' }; pulls 26 { id: 4633746489, title: '[scenario] bug
    fix', body: fixtures/submissions/pr-bugfix-complete.txt (LF), updatedAt, userId WORLD_AUTHOR_ID, state 'open', merged false,
    headSha 'b46eef5018c202bcb2470bf62e3defd7496ec65b', baseRef 'probe-pa06-base', baseSha
    '1c5c399b48a0ccca6a9989eacb6ebc2279e6a9c9', files from fixtures/github/testbed/pull-26-files.json mapped to { filename,
    status } }; no artifacts; empty run lists.
    Payloads (JSON bytes): repository { id: WORLD_REPOSITORY_ID, name: 'patch-steward-testbed-public', full_name: WORLD_REPOSITORY,
    private: false, default_branch: 'master' }; sender { login: 'jambolo' or 'actor', id: options.senderId ?? WORLD_AUTHOR_ID,
    type: options.senderType ?? 'User' }; issues: { action, issue: { id, number, title, body, state, updated_at, user: { login:
    'jambolo', id } }, repository, sender } from issues.get(options.number ?? 29); pull requests: { action, number, pull_request: {
    id, number, title, body, state, merged, updated_at, user, head: { sha, ref: 'scenario-branch', repo: { full_name: fork ?
    'jambolo/patch-steward-testbed-public' : WORLD_REPOSITORY, fork: fork === true } }, base: { ref, sha, repo: { full_name:
    WORLD_REPOSITORY } } }, repository, sender } from pulls.get(options.number ?? 26).
    gateEnvironment: { GITHUB_EVENT_NAME: 'issues', GITHUB_EVENT_PATH: '/tmp/steward-world/event.json', GITHUB_REPOSITORY:
    WORLD_REPOSITORY, GITHUB_REPOSITORY_ID: '1376317064', GITHUB_REF: 'refs/heads/master', GITHUB_SERVER_URL:
    'https://github.com', GITHUB_API_URL: 'https://api.github.com', GITHUB_RUN_ID: String(WORLD_RUN_ID), GITHUB_RUN_ATTEMPT: '1',
    RUNNER_TEMP: '/tmp/steward-world', GITHUB_OUTPUT: '/tmp/steward-world/output', GITHUB_STEP_SUMMARY:
    '/tmp/steward-world/summary', PATCH_STEWARD_APP_ID: WORLD_APP_ID, PATCH_STEWARD_APP_PRIVATE_KEY: credentials.privateKey,
    ...overrides }. publishEnvironment: gateEnvironment(world) plus STEWARD_GATE_DISPOSITION = gateOutputs.disposition ?? '',
    STEWARD_GATE_RECORD_ONLY = gateOutputs.record_only ?? 'false', STEWARD_GATE_SNAPSHOT_HASH = gateOutputs.snapshot_hash ?? '',
    STEWARD_GATE_POLICY_REVISION = gateOutputs.policy_revision ?? '', then ...overrides.

    Adapters used by the self-checks (read their signatures): loadPolicy (../policy/loader.js), readGitTree and readRepository
    (../github/reader.js), createGitHubClient (../github/client.js), createGitHubBudget (../github/budget.js), mintInstallationToken
    and lookupAppBotUserId (../github/app-auth.js; deps { budget, fetch }), readOwnershipListing (../github/artifacts.js; deps {
    resolver, transport }), encodeOwnershipRecord and ownershipRecordSchema (../ownership/record.js), captureIssue and
    capturePullRequest (../submission/intake.js), readCapRunLists (../github/runs.js), authenticateEvent (../ownership/events.js).
    GitHubAnyFetch is assignable to the client's GitHubFetch parameter.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's file; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters. Tokens and keys are built by concatenation or generated with
    node:crypto, never committed as literals. Never write the text STEWARD_APP_ID, STEWARD_APP_PRIVATE_KEY, or
    STEWARD_APP_CLIENT_ID unless immediately preceded by PATCH_. Do not edit any other file. No temp files, no child processes, no
    real network (the world never calls global fetch or DNS).
- actions: |
    1. Create packages/core/src/pipeline/hosted-world.test.ts with the exports per context and ONE describe 'hosted world' with
       EXACTLY these plain it(...) titles (keep them fast):
       - 'the world serves the trusted policy from the default branch': loadPolicy({ kind: 'github', client, repository:
         WORLD_REPOSITORY_REF, branch: 'master' }) -> ok; revision.id === policyTreeId(); revision.commit === policyCommit().
       - 'the world serves any policy tree by id': keep the first tree id, setPolicy(worldPolicyText([['daily_runs: 50',
         'daily_runs: 1']])) -> a new tree id; readGitTree(client, repo, firstTreeId, true) still ok; setPolicy(null) -> loadPolicy
         fails with 'policy-source.not-published'.
       - 'the world mints tokens for the requested scope': mintInstallationToken(world.credentials, WORLD_REPOSITORY_REF,
         'gate-target', { budget, fetch: world.fetch }) ok and its secret() is in tokens; the same for { owner: 'steady-orchard',
         name: 'patch-steward-testbed-evidence' } with 'publish-store'.
       - 'the world answers the app bot user': lookupAppBotUserId(world.credentials, token, { budget, fetch }) -> WORLD_BOT_ID.
       - 'the world lists and serves ownership artifacts': addArtifact({ name: 'steward-ownership-issue-29', createdAt:
         '2026-09-28T10:00:05Z', workflowRunId: WORLD_RUN_ID, recordBytes }) with an encodeOwnershipRecord'ed valid record
         (repository WORLD_REPOSITORY, subject issue 29, run_id WORLD_RUN_ID, policy_revision policyTreeId(), disposition
         'runnable', cap { state: 'within', daily_count: 1, daily_limit: 50, author_count: 1, author_limit: 2 }, event { name:
         'issues', action: 'opened', object_id: 5578290556, object_updated_at: '2026-09-28T09:59:00Z', sender_id: WORLD_AUTHOR_ID,
         sender_type: 'User' }, ...) -> readOwnershipListing(client, WORLD_REPOSITORY_REF, { type: 'issue', number: 29 }, {
         resolver, transport }) is kind 'unique' with a valid record equal to it; requests contains a 'DOWNLOAD' entry; after
         removeArtifact(artifact.id) the same read is kind 'none'.
       - 'the world captures its issues and pull requests': with the loaded policy, captureIssue(ctx, 29) ok and its
         contract.disposition is neither 'needs-changes' nor 'inconclusive'; captureIssue(ctx, 30) ok with disposition
         'needs-changes'; capturePullRequest(ctx, 26) ok.
       - 'the world lists tagged runs': one createdToday item -> readCapRunLists(client, WORLD_REPOSITORY_REF, new
         Date(WORLD_NOW)) has createdToday.items length 1 and failure null.
       - 'the world records requests and applies overrides first': override answering 500 for pathnames ending
         '/actions/artifacts' -> readOwnershipListing kind 'unavailable'; requests contains { method: 'GET', host:
         'api.github.com' } for that path.
       - 'world payloads authenticate against the world environment': authenticateEvent with the EventEnvironment mapped from
         gateEnvironment(world) accepts issuesEventPayload(world, 'edited'); with GITHUB_EVENT_NAME 'pull_request_target' it
         accepts pullRequestEventPayload(world, 'opened') and, after pulls.get(26).merged = true, 'closed' gives merged true.
       - 'extra handlers answer before the built-in routes': createHostedWorld({ handlers: [a handler answering the repository
         path with a repository json whose default_branch is 'trunk'] }) -> readRepository returns defaultBranch 'trunk'.
    2. Run: pnpm exec prettier --write packages/core/src/pipeline/hosted-world.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/hosted-world.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.11.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.11.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['the world serves the trusted policy from the default branch','the world serves any policy tree by id','the world mints tokens for the requested scope','the world answers the app bot user','the world lists and serves ownership artifacts','the world captures its issues and pull requests','the world lists tagged runs','the world records requests and applies overrides first','world payloads authenticate against the world environment','extra handlers answer before the built-in routes'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. node -e "const s=require('fs').readFileSync('packages/core/src/pipeline/hosted-world.test.ts','utf8');const need=['removeArtifact(','export function createHostedWorld','export function worldPolicyText','export function ownershipArtifactZip','export function issuesEventPayload','export function pullRequestEventPayload','export function gateEnvironment','export function publishEnvironment','export const WORLD_REPOSITORY ','export const WORLD_RUN_ID','export const WORLD_BOT_ID','export const WORLD_MAINTAINER_ID','export type WorldHandler'];const miss=need.filter(n=>!s.includes(n));console.log(miss.length?'MISSING '+miss.join(' | '):'exports ok')"
       -> prints exactly: exports ok
    4. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|ghs_[A-Za-z0-9]{20}|-----BEGIN' -- packages/core/src/pipeline/hosted-world.test.ts; echo "grep $?"
       -> prints exactly: grep 1
    5. pnpm vitest run -> exit 0
    6. pnpm typecheck -> exit 0
    7. pnpm exec eslint packages/core/src/pipeline/hosted-world.test.ts -> exit 0
    8. pnpm exec prettier --check packages/core/src/pipeline/hosted-world.test.ts -> exit 0
    9. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-world.test.ts
       -> prints 0 (grep exit status 1 is expected)
    10. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/hosted-world.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the new file).
