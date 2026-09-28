# Step 3.10

- id: 3.10
- depends_on: []
- route: mechanical
- objective: Add a shared in-memory Git Data API evidence store for tests (`createStoreWorld`), with self-check tests that drive the real evidence-store adapters through it, as packages/core/src/evidence/store-world.test.ts.
- files_in_scope:
    - packages/core/src/evidence/store-world.test.ts
    - development-artifacts/patch-steward-m6-3.10-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: many later tests (hosted gate, hosted publish, fixture scenarios, conformance) need one realistic fake of GitHub's Git
    Data API evidence store. This file is a TEST file (suffix .test.ts, so the build excludes it and Vitest runs its self-checks)
    that also EXPORTS the fake; other test files import it with `import { createStoreWorld } from '../evidence/store-world.test.js'`
    (importing it re-registers its self-check tests inside the importing file; that is expected and harmless). Keep the self-check
    tests few and fast.

    The adapters it must satisfy (read them): packages/core/src/evidence/git-store.ts (commitEvidence: GET
    /repos/{s}/git/ref/heads/<branch> (404 = branch absent), GET /repos/{s}/git/commits/<tip>, POST /repos/{s}/git/blobs
    { content (base64), encoding: 'base64' } expecting sha = git blob id, POST /repos/{s}/git/trees { base_tree?, tree: [{ path,
    mode: '100644', type: 'blob', sha }] }, POST /repos/{s}/git/commits { message, tree, parents }, GET
    /repos/{s}/compare/<tip>...<new> (must be status 'ahead', ahead_by 1, behind_by 0, every file status 'added', exact paths),
    then PATCH /repos/{s}/git/refs/heads/<branch> { sha, force: false } (HTTP 422 = non-fast-forward, rebuilt on the new tip) or,
    for an absent branch, POST /repos/{s}/git/refs { ref: 'refs/heads/<branch>', sha } (422 'Reference already exists' = conflict);
    packages/core/src/evidence/store-readback.ts (readBackEvidence: GET ref, GET compare/<commit>...<head> when the head moved,
    GET /repos/{s}/git/trees/<commit>:<url-encoded path segments>[?recursive=1] listing entries relative to that directory);
    packages/core/src/evidence/fallback-read.ts (readPublishedSnapshot: GET /repos/{s}/contents/<owner>/<repo>/runs/<kind>-<n>
    ?ref=<branch> directory listing, then GET .../<run-dir>/run.json?ref=<branch> file { type: 'file', encoding: 'base64', size,
    content }). Response shapes: packages/core/src/github/schemas.ts (githubRefResponseSchema { ref, object { sha, type } },
    githubTreeResponseSchema { sha, truncated, tree: [{ path, mode, type, sha, size? }] }, githubContentsEntrySchema { name, path,
    sha, type, size }) and git-store.ts (githubGitObjectResponseSchema { sha }, githubGitCommitResponseSchema { sha, tree { sha },
    parents [{ sha }] }), store-checks.ts (evidenceCompareSchema { status, ahead_by, behind_by, files? [{ filename, status }] }).
    gitBlobId(bytes) from './blob-id.js' gives the 40-hex git blob id.

    Required exports (exact names; the file may define private helpers):
      export const STORE_WORLD_BRANCH = 'steward-evidence';
      export interface StoreWorldRequest { readonly method: string; readonly url: URL; readonly body: unknown }
      export type StoreWorldHandler = (request: StoreWorldRequest) => Response | undefined;
      export interface StoreWorld {
        readonly handler: StoreWorldHandler;
        head(repository: string): string | null;                     // 'owner/name' -> branch tip commit or null
        files(repository: string): ReadonlyMap<string, Uint8Array>;  // full store paths -> bytes at the tip (empty when absent)
        commitCount(repository: string): number;                     // commits reachable from the tip (0 when absent)
        advance(repository: string, files: Readonly<Record<string, Uint8Array>>): string;  // commit on top of the tip (or a root
                                                                     // commit), move the branch, return the commit id
      }
      export function createStoreWorld(options?: { readonly branch?: string }): StoreWorld;
      export function storeWorldFetch(world: StoreWorld): (url: string, init: { readonly method: string; readonly body?: string })
        => Promise<Response>;   // parses url and JSON body, calls handler, falls back to 404 {"message":"Not Found"}

    Behavior (state per repository 'owner/name' taken from the URL; branch = options.branch ?? STORE_WORLD_BRANCH):
    - Objects: blobs Map<sha, bytes> (sha = gitBlobId(bytes)); trees Map<treeId, Map<path, blobSha>>; commits Map<id, { tree,
      parents, message }>. Tree id = gitBlobId(Buffer.from('tree\n' + sorted `${path} ${sha}` lines joined by '\n')); commit id =
      gitBlobId(Buffer.from('commit\n' + tree + '\n' + parents.join(',') + '\n' + message)). Use the JSON parsed `body` object.
    - handler returns undefined for anything it does not own, so it can be chained after other fakes: it owns only
      /repos/<o>/<r>/git/blobs (POST), git/trees (POST), git/commits (POST, and GET /git/commits/<sha>), git/refs (POST),
      git/refs/heads/<branch> (PATCH), git/ref/heads/<branch> (GET), compare/<a>...<b> (GET), git/trees/<commit>:<path> (GET;
      the path segment contains ':'), and contents/<path> (GET) ONLY when url.searchParams.get('ref') === branch.
    - POST blobs -> 201 { sha }. POST trees -> base_tree (if present) must exist else 422; new map = base map plus entries; 201 {
      sha, truncated: false, tree: [] }. POST commits -> 201 { sha, tree: { sha: tree }, parents: [{ sha }], message }. GET commits
      -> 200 same shape or 404.
    - GET ref -> 200 { ref: 'refs/heads/' + branch, object: { sha: tip, type: 'commit' } } or 404 { message: 'Not Found' }.
    - POST refs { ref, sha } -> ref must be 'refs/heads/' + branch; tip exists -> 422 { message: 'Reference already exists' };
      else tip = sha, 201 { ref, object: { sha, type: 'commit' } }.
    - PATCH ref { sha, force } -> tip absent, or the commit's first parent is not the current tip -> 422 { message: 'Update is not
      a fast forward' }; else tip = sha, 200 { ref, object: { sha, type: 'commit' } }.
    - GET compare/<base>...<head>: base === head -> { status: 'identical', ahead_by: 0, behind_by: 0, files: [] }; base reachable
      from head through first parents at distance n -> { status: 'ahead', ahead_by: n, behind_by: 0, files: diff } where diff lists
      every path of head's tree absent from base's ('added'), present with another sha ('modified'), and base-only paths
      ('removed'), as { filename, status }; head reachable from base -> { status: 'behind', ahead_by: 0, behind_by: n, files: [] };
      else { status: 'diverged', ahead_by: 1, behind_by: 1, files: [] }; unknown commit -> 404.
    - GET trees/<commit>:<path> (decodeURIComponent each segment): files of the commit's tree under `${path}/`; none -> 404.
      Non-recursive: direct children only (blob entries { path: name, mode: '100644', type: 'blob', sha, size } and one tree entry {
      path: dirName, mode: '040000', type: 'tree', sha: <any 40 hex> } per subdirectory). recursive=1: every blob with its path
      relative to the directory, plus a tree entry for every intermediate directory. Response { sha: <any 40 hex>, truncated:
      false, tree }.
    - GET contents/<path>?ref=<branch>: tip absent -> 404; <path> is a file -> { type: 'file', encoding: 'base64', size, name,
      path, sha, content } where content is the base64 text split into lines of 60 characters joined by '\n' (as GitHub serves
      it); <path> is a directory -> an array of { name, path, sha, size (0 for dirs), type: 'dir' | 'file' } for its direct
      children; else 404.
    - Responses are `new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })`.

    Self-check test setup: STORE = { repository: { owner: 'octo', name: 'demo' }, branch: 'steward-evidence' }; client =
    createGitHubClient({ token: 'test-token-' + 's'.repeat(12), budget, fetch }) and writer = createGitHubWriter({ token, scope: {
    kind: 'installation', store: STORE }, budget, fetch }) (budget createGitHubBudget({ requests: 200, retriesPerRequest: 0 }),
    fetch = storeWorldFetch(world) cast as needed); groups like standardGroups() in packages/core/src/evidence/store-readback.test.ts
    but with a VALID run.json built with runRecordSchema.parse (copy the run candidate shape from assembleRunRecords in
    packages/core/src/evidence/assemble.ts: run_id 36081628326, run_attempt 1, subject { kind: 'submission', repository:
    'octo/demo', type: 'pull_request', number: 12, snapshot_hash: 'sha256:' + '5'.repeat(64) }, policy_revision 'b'.repeat(40),
    ...). writeEvidenceCommit input { store: STORE, targetRepository: 'octo/demo', subject: { type: 'pull_request', number: 12 },
    runId, runAttempt, groups, maxBytes: 10485760, writeRetries: 3 } and deps { client, writer, sleep: async () => undefined }.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's file; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters. Do not edit any other file. No temp files, no child processes, no
    network.
- actions: |
    1. Create packages/core/src/evidence/store-world.test.ts with the exports per context and ONE describe 'store world' with
       EXACTLY these plain it(...) titles:
       - 'the store world commits evidence and reads it back': writeEvidenceCommit on an empty world -> ok; head('octo/demo')
         equals the receipt commit; files('octo/demo') has 'octo/demo/runs/pr-12/36081628326-1/run.json' with the same bytes;
         commitCount 1.
       - 'a second run appends to the store world': a second run (36081628327) commits ok with receipt.parent equal to the first
         commit; commitCount 2; both run directories present.
       - 'rewriting a committed path is not append-only': commitEvidence (from './git-store.js') of the first run again with
         changed run.json bytes -> failure.code 'evidence.store-not-append-only'; head unchanged.
       - 'a concurrent commit forces a rebuild': on a world that already holds one committed run (so the next commit ends in a
         PATCH, not a POST of the ref), commit a second run with the fetch wrapped so that just before the FIRST PATCH request it
         calls
         world.advance('octo/demo', { 'octo/demo/metrics/2026-09/1-1.json': bytes }) -> writeEvidenceCommit ok with rebuilds 1 and
         the advanced file still present.
       - 'the fallback read finds the latest published run': commit runs 36081628326-1 and 36081628327-1 for issue 29 (valid run
         records with type 'issue', number 29) -> readPublishedSnapshot(client, { store: STORE, targetRepository: 'octo/demo',
         subject: { type: 'issue', number: 29 } }) (from './fallback-read.js') returns kind 'published', runId 36081628327.
       - 'an absent store branch has no published run': readPublishedSnapshot on an empty world -> kind 'none'.
       - 'store world state is kept per repository': a commit to 'octo/evidence' leaves head('octo/demo') null.
    2. Run: pnpm exec prettier --write packages/core/src/evidence/store-world.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/evidence/store-world.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.10.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.10.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['the store world commits evidence and reads it back','a second run appends to the store world','rewriting a committed path is not append-only','a concurrent commit forces a rebuild','the fallback read finds the latest published run','an absent store branch has no published run','store world state is kept per repository'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. node -e "const s=require('fs').readFileSync('packages/core/src/evidence/store-world.test.ts','utf8');const need=['export const STORE_WORLD_BRANCH','export interface StoreWorldRequest','export type StoreWorldHandler','export interface StoreWorld ','export function createStoreWorld','export function storeWorldFetch'];const miss=need.filter(n=>!s.includes(n));console.log(miss.length?'MISSING '+miss.join(' | '):'exports ok')"
       -> prints exactly: exports ok
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/evidence/store-world.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/evidence/store-world.test.ts -> exit 0
    8. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/evidence/store-world.test.ts
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/evidence/store-world.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the new file).
