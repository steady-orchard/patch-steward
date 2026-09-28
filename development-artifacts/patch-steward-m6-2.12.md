# Step 2.12

- id: 2.12
- depends_on: [2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10]
- route: mechanical
- objective: Export the hosted adapter modules from the core package root, pin their names in the exports test, and extend the hosted never-pass conformance table with every new adapter failure code.
- files_in_scope:
    - packages/core/src/index.ts
    - packages/core/src/exports.test.ts
    - packages/core/src/conformance/never-pass-hosted.test.ts
    - development-artifacts/patch-steward-m6-2.12-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    packages/core/src/index.ts is a list of `export * from './<module>.js';` lines (98 today); the action package will import the
    hosted adapters from '@patch-steward/core'. New modules merged before this step (reachable today only by relative import):
    packages/core/src/github/writer.ts, github/app-auth.ts, github/artifacts.ts, github/runs.ts, evidence/fallback-read.ts,
    evidence/git-store.ts, evidence/store-readback.ts. github/client.ts (GitHubListPage, new client methods) and
    evidence/publish.ts (prepareRunEvidence and its types) are already root-exported. Every name exported by the new modules was
    checked unique across packages/core and packages/cli (a duplicate `export *` name is error TS2308), and none starts with load,
    validate, resolve, parse, capture, or check, so packages/core/src/conformance/invariant-5.test.ts (which pins the exact root
    functions with those prefixes) stays unchanged and must keep passing.

    packages/core/src/exports.test.ts holds arrays functionExports (it.each: typeof === 'function'), tupleExports (Array.isArray),
    schemaExports and recordExports (typeof === 'object') plus constant tests; append to them. It asserts
    core.GITHUB_FAILURE_CODES has length 17, which must stay true.

    packages/core/src/conformance/never-pass-hosted.test.ts imports from '../index.js' and defines
      type HostedFailureCode = EventAuthenticationFailureCode | OwnershipRecordFailureCode | DedupFailureCode | CapsFailureCode |
        AppendOnlyFailureCode | ReadBackFailureCode;
      const TRIGGERS: { readonly [K in HostedFailureCode]: () => Result<unknown, string> } = { ... six entries ... };
    and, per code, it(`hosted failure code ${code} never yields pass`) asserting ok false, failure.code === code,
    failure.outcome 'inconclusive', FAILURE_CAUSES contains failure.cause, and 'value' in result is false; plus it('ownership modules
    import no file system or network module'). The new failure codes to add (with their root-exported union types):
    - 'github.write-not-allowed', 'github.write-conflict' (type GitHubWriteOnlyFailureCode, github/writer.ts)
    - 'app-auth.credentials-invalid', 'app-auth.token-scope-mismatch' (type AppAuthFailureCode, github/app-auth.ts)
    - 'evidence.store-conflict' (type EvidenceStoreConflictFailureCode, evidence/git-store.ts)
    Relevant signatures (read the modules to confirm): createGitHubWriter({ token, scope, budget, fetch }) with send(request, schema)
    and scopes { kind: 'app' } or { kind: 'installation', store: { repository: { owner, name }, branch } | null };
    createGitHubBudget({ requests, retriesPerRequest }); createGitHubClient({ token, budget, fetch }); createAppJwt(credentials,
    nowMs); mintInstallationToken(credentials, repository, role, deps: { budget, fetch }); commitEvidence(input, { client, writer,
    sleep }); gitBlobId(bytes); githubGitObjectResponseSchema; githubRefResponseSchema.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const P={'packages/core/src/github/writer.ts':['GITHUB_WRITE_FAILURE_CODES','GITHUB_WRITE_FAILURE_CAUSES','githubWriteFailure','githubRepositoryPath','githubBranchRefPath','isAllowedGitHubWrite','createGitHubWriter'],'packages/core/src/github/app-auth.ts':['APP_AUTH_FAILURE_CODES','APP_TOKEN_PERMISSION_SETS','githubInstallationResponseSchema','githubInstallationTokenResponseSchema','githubAppResponseSchema','githubBotUserSchema','createAppJwt','lookupInstallationId','mintInstallationToken','revokeInstallationToken','lookupAppBotUserId'],'packages/core/src/github/artifacts.ts':['githubArtifactSchema','listOwnershipArtifacts','downloadOwnershipRecord','readOwnershipListing','dedupListingRead'],'packages/core/src/github/runs.ts':['githubWorkflowRunSchema','readRunList','readCapRunLists'],'packages/core/src/evidence/fallback-read.ts':['githubContentsFileSchema','readPublishedSnapshot'],'packages/core/src/evidence/git-store.ts':['githubGitObjectResponseSchema','githubGitCommitResponseSchema','evidenceStoreLocation','evidenceCommitMessage','hostedEvidenceLocation','commitEvidence'],'packages/core/src/evidence/store-readback.ts':['readBackEvidence','writeEvidenceCommit'],'packages/core/src/evidence/publish.ts':['prepareRunEvidence'],'packages/core/src/github/client.ts':['getPaginatedList','getRedirectLocation']};const miss=[];for(const [f,names] of Object.entries(P)){const s=fs.existsSync(f)?fs.readFileSync(f,'utf8'):'';for(const n of names){if(!new RegExp('(export (async )?(function|const|interface|type) '+n+'[^A-Za-z0-9_])|('+n+'[<(])').test(s))miss.push(f+':'+n)}}console.log(miss.length?'MISSING '+miss.join(' '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base listing the printed MISSING items; do not fetch, merge,
       or improvise.
    2. Append to packages/core/src/index.ts, after the last line, exactly these 7 lines in this order:
       export * from './github/writer.js';
       export * from './github/app-auth.js';
       export * from './github/artifacts.js';
       export * from './github/runs.js';
       export * from './evidence/fallback-read.js';
       export * from './evidence/git-store.js';
       export * from './evidence/store-readback.js';
    3. In packages/core/src/exports.test.ts append to functionExports: 'githubWriteFailure', 'githubRepositoryPath',
       'githubBranchRefPath', 'isAllowedGitHubWrite', 'createGitHubWriter', 'createAppJwt', 'lookupInstallationId',
       'mintInstallationToken', 'revokeInstallationToken', 'lookupAppBotUserId', 'listOwnershipArtifacts',
       'downloadOwnershipRecord', 'readOwnershipListing', 'dedupListingRead', 'readRunList', 'readCapRunLists',
       'readPublishedSnapshot', 'evidenceStoreLocation', 'evidenceCommitMessage', 'hostedEvidenceLocation', 'commitEvidence',
       'readBackEvidence', 'writeEvidenceCommit', 'prepareRunEvidence'; to tupleExports: 'GITHUB_WRITE_FAILURE_CODES',
       'APP_AUTH_FAILURE_CODES'; to schemaExports: 'githubInstallationResponseSchema', 'githubInstallationTokenResponseSchema',
       'githubAppResponseSchema', 'githubBotUserSchema', 'githubArtifactSchema', 'githubWorkflowRunSchema',
       'githubContentsFileSchema', 'githubGitObjectResponseSchema', 'githubGitCommitResponseSchema'; to recordExports:
       'APP_TOKEN_PERMISSION_SETS', 'GITHUB_WRITE_FAILURE_CAUSES'. Add it('exports the hosted adapter constants', ...) asserting
       core.GITHUB_WRITE_FAILURE_CODES toEqual ['github.write-not-allowed', 'github.write-conflict'], core.APP_AUTH_FAILURE_CODES
       toEqual ['app-auth.credentials-invalid', 'app-auth.token-scope-mismatch'], core.APP_TOKEN_PERMISSION_SETS['publish-store']
       toEqual { contents: 'write' }, core.APP_TOKEN_PERMISSION_SETS['gate-target'] toEqual { actions: 'read', contents: 'read',
       issues: 'read', pull_requests: 'read' }, and core.GITHUB_FAILURE_CODES toHaveLength(17).
    4. In packages/core/src/conformance/never-pass-hosted.test.ts:
       a. Extend HostedFailureCode with | GitHubWriteOnlyFailureCode | AppAuthFailureCode | EvidenceStoreConflictFailureCode (type
          imports from '../index.js').
       b. Change the TRIGGERS value type to () => Result<unknown, string> | Promise<Result<unknown, string>>, make the per-code
          it(...) callback async and await the trigger; keep the title and every assertion unchanged.
       c. Add triggers (imports from '../index.js' only, plus generateKeyPairSync from 'node:crypto'; no network: every fake fetch
          is local):
          - 'github.write-not-allowed': createGitHubWriter({ token: 'test-token-' + 'n'.repeat(20), scope: { kind: 'app' }, budget:
            createGitHubBudget({ requests: 1, retriesPerRequest: 0 }), fetch: async () => { throw new Error('no network'); }
            }).send({ method: 'POST', path: '/repos/o/r/issues/1/comments', body: {} }, githubGitObjectResponseSchema).
          - 'github.write-conflict': a writer with scope { kind: 'installation', store: { repository: { owner: 'o', name: 'r' },
            branch: 'steward-evidence' } } and fetch async () => new Response('{"message":"conflict"}', { status: 422 }); send({
            method: 'PATCH', path: '/repos/o/r/git/refs/heads/steward-evidence', body: { sha: 'a'.repeat(40), force: false } },
            githubRefResponseSchema).
          - 'app-auth.credentials-invalid': createAppJwt({ appId: 'x', privateKey: 'y' }, 0).
          - 'app-auth.token-scope-mismatch': an RSA key from generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding:
            { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }); mintInstallationToken({ appId:
            '7', privateKey }, { owner: 'o', name: 'r' }, 'store-read', { budget: createGitHubBudget({ requests: 10,
            retriesPerRequest: 0 }), fetch }) where fetch answers GET .../repos/o/r/installation -> 200 {"id":7}, POST
            .../app/installations/7/access_tokens -> 201 { token: 'test-token-' + 't'.repeat(20), expires_at:
            '2026-09-28T00:00:00Z', permissions: { contents: 'write' }, repositories: [{ full_name: 'o/other' }] }, DELETE
            .../installation/token -> 204.
          - 'evidence.store-conflict': commitEvidence({ store: { repository: { owner: 'o', name: 'r' }, branch: 'steward-evidence' },
            targetRepository: 'o/r', subject: { type: 'issue', number: 1 }, runId: 5, runAttempt: 1, groups: [{ directory:
            'metrics/2026-09', mode: 'contains', files: [{ path: '5-1.json', bytes: Buffer.from('{}') }] }], maxBytes: 1000,
            writeRetries: 1 }, { client, writer, sleep: async () => undefined }) with a client and a writer (scope installation with
            that store) sharing one budget { requests: 50, retriesPerRequest: 0 } and one fetch that answers: GET
            .../git/ref/heads/steward-evidence -> 404; POST .../git/blobs -> 201 { sha: gitBlobId(Buffer.from(body.content,
            'base64')) }; POST .../git/trees -> 201 { sha: 'e'.repeat(40) }; POST .../git/commits -> 201 { sha: 'f'.repeat(40),
            tree: { sha: 'e'.repeat(40) }, parents: [] }; POST .../git/refs -> 422 {"message":"Reference already exists"}.
    5. Run: pnpm exec prettier --write packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/exports.test.ts packages/core/src/conformance/invariant-5.test.ts packages/core/src/conformance/never-pass-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.12.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p2-2.12.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['exports the hosted adapter constants','exports the hosted contract constants','hosted failure code gate.event-invalid never yields pass','hosted failure code evidence.readback-mismatch never yields pass','hosted failure code github.write-not-allowed never yields pass','hosted failure code github.write-conflict never yields pass','hosted failure code app-auth.credentials-invalid never yields pass','hosted failure code app-auth.token-scope-mismatch never yields pass','hosted failure code evidence.store-conflict never yields pass','ownership modules import no file system or network module','invariant 5: every exported load, validate, resolve, parse, capture, and check function rejects invalid input'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm build -> exit 0
    6. node -e "import('./packages/core/dist/index.js').then(m=>{const need=['createGitHubWriter','isAllowedGitHubWrite','githubRepositoryPath','githubBranchRefPath','createAppJwt','mintInstallationToken','revokeInstallationToken','lookupAppBotUserId','listOwnershipArtifacts','downloadOwnershipRecord','readOwnershipListing','dedupListingRead','readRunList','readCapRunLists','readPublishedSnapshot','evidenceStoreLocation','hostedEvidenceLocation','commitEvidence','readBackEvidence','writeEvidenceCommit','prepareRunEvidence','GITHUB_WRITE_FAILURE_CODES','APP_AUTH_FAILURE_CODES','APP_TOKEN_PERMISSION_SETS','githubArtifactSchema','githubWorkflowRunSchema'];const miss=need.filter(n=>typeof m[n]==='undefined');console.log(miss.length?'MISSING '+miss.join(','):'dist exports ok')})"
       -> prints exactly: dist exports ok
    7. grep -c "^export \* from" packages/core/src/index.ts -> prints 105
    8. pnpm exec eslint packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts -> exit 0
    9. pnpm exec prettier --check packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts -> exit 0
    10. git diff --quiet HEAD -- packages/core/src/conformance/invariant-5.test.ts -> exit 0
    11. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the root exports and test additions; the modules stay importable by relative path).
