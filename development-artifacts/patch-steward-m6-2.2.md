# Step 2.2

- id: 2.2
- depends_on: []
- route: mechanical
- objective: Add the allowlisted GitHub writer to core: the only non-GET GitHub requests the steward can make (token minting and revocation, and Git Data API evidence writes to one store branch), rejected before any budget charge or network call when not allowlisted.
- files_in_scope:
    - packages/core/src/github/writer.ts
    - packages/core/src/github/writer.test.ts
    - development-artifacts/patch-steward-m6-2.2-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only;
    no new dependency.

    Security rule being implemented: the only non-GET GitHub requests the steward core can make are
      POST /app/installations/{id}/access_tokens   (App JWT; mint an installation token)
      DELETE /installation/token                    (installation token; revoke itself)
      POST /repos/{o}/{r}/git/blobs, POST .../git/trees, POST .../git/commits   (evidence store repository only)
      POST /repos/{o}/{r}/git/refs                  (create the store branch only)
      PATCH /repos/{o}/{r}/git/refs/heads/<store branch>   (non-force update of the store branch only)
    Issues, comments, labels, checks, reviews, statuses, reactions, dispatches, and contents-API writes must be impossible. The
    existing GET-only client (packages/core/src/github/client.ts, createGitHubClient) stays untouched; this new module is the
    separate writer interface. Do not edit client.ts.

    Reuse from './client.js': githubFailure, GITHUB_API_BASE_URL ('https://api.github.com'), GITHUB_API_VERSION ('2022-11-28'),
    GITHUB_USER_AGENT ('patch-steward'), types GitHubFailureCode and GitHubFetchInit. From './budget.js': type GitHubBudget
    (limits.retriesPerRequest, tryCharge(), requestsUsed()). From './reader.js': type GitHubRepositoryRef ({ owner, name }). From
    '../policy/bounds.js': GITHUB_REQUEST_TIMEOUT_MS, GITHUB_RESPONSE_MAX_BYTES, GITHUB_RETRY_WAIT_MAX_SECONDS. From '../result.js':
    err, ok, types Err, FailureDetail, Result. From '../vocabulary.js': type FailureCause. Read client.ts first and copy its
    patterns (readBoundedBody, the 403/429 rate-limit logic, the retry loop, the path checks of buildUrl, the token pattern); the
    writer duplicates them on purpose so the GET-only client never gains a write method.

    Required API (exact names; export nothing else):
      export const GITHUB_WRITE_FAILURE_CODES = ['github.write-not-allowed', 'github.write-conflict'] as const;
      export type GitHubWriteOnlyFailureCode = (typeof GITHUB_WRITE_FAILURE_CODES)[number];
      export type GitHubWriteFailureCode = GitHubFailureCode | GitHubWriteOnlyFailureCode;
      export const GITHUB_WRITE_FAILURE_CAUSES: { readonly [K in GitHubWriteOnlyFailureCode]: FailureCause } =
        Object.freeze({ 'github.write-not-allowed': 'steward-defect', 'github.write-conflict': 'github-unavailable' });
      export function githubWriteFailure<C extends GitHubWriteOnlyFailureCode>(code: C, message: string): Err<C>;
      export type GitHubWriteMethod = 'POST' | 'PATCH' | 'DELETE';
      export interface GitHubWriteRequest {
        readonly method: GitHubWriteMethod;
        readonly path: string;
        readonly body: Readonly<Record<string, unknown>> | null;
      }
      export interface GitHubStoreScope { readonly repository: GitHubRepositoryRef; readonly branch: string }
      export type GitHubWriteScope =
        | { readonly kind: 'app' }
        | { readonly kind: 'installation'; readonly store: GitHubStoreScope | null };
      export interface GitHubWriteFetchInit {
        readonly method: GitHubWriteMethod;
        readonly headers: Readonly<Record<string, string>>;
        readonly body?: string;
        readonly signal: AbortSignal;
        readonly redirect: 'manual';
      }
      export type GitHubWriteFetch = (url: string, init: GitHubWriteFetchInit) => Promise<Response>;
      export type GitHubAnyFetch = (url: string, init: GitHubFetchInit | GitHubWriteFetchInit) => Promise<Response>;
      export interface GitHubWriterOptions {
        readonly token: string;
        readonly scope: GitHubWriteScope;
        readonly budget: GitHubBudget;
        readonly fetch?: GitHubWriteFetch;
        readonly timeoutMs?: number;
        readonly sleep?: (ms: number) => Promise<void>;
        readonly now?: () => number;
      }
      export interface GitHubWriter {
        send<T>(request: GitHubWriteRequest, schema: z.ZodType<T>): Promise<Result<T, GitHubWriteFailureCode>>;
        sendNoContent(request: GitHubWriteRequest): Promise<Result<null, GitHubWriteFailureCode>>;
      }
      export function githubRepositoryPath(repository: GitHubRepositoryRef): string;
        // '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(name)
      export function githubBranchRefPath(repository: GitHubRepositoryRef, branch: string): string;
        // githubRepositoryPath(repository) + '/git/refs/heads/' + branch.split('/').map(encodeURIComponent).join('/')
      export function isAllowedGitHubWrite(request: GitHubWriteRequest, scope: GitHubWriteScope): boolean;
      export function createGitHubWriter(options: GitHubWriterOptions): GitHubWriter;
    githubWriteFailure(code, message) = err(code, GITHUB_WRITE_FAILURE_CAUSES[code], message).

    isAllowedGitHubWrite returns true ONLY for these; OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/; "body keys exactly {..}" means
    body is a non-null, non-array object and Object.keys(body).sort() equals the listed sorted keys:
    - scope app: method 'POST', path matching /^\/app\/installations\/[1-9][0-9]{0,19}\/access_tokens$/, body keys exactly
      {permissions, repositories}; repositories is an array of exactly 1 string of length 1..100; permissions is a non-null,
      non-array object with at least 1 key, every key matching /^[a-z_]{1,64}$/ and every value 'read' or 'write'.
    - scope installation (store null or not): method 'DELETE', path '/installation/token', body null.
    - scope installation with store S (R = githubRepositoryPath(S.repository), B = S.branch):
      - 'POST' R + '/git/blobs': body keys exactly {content, encoding}; content a string; encoding === 'base64'.
      - 'POST' R + '/git/trees': body keys exactly {tree} or {base_tree, tree}; base_tree (when present) matches OBJECT_ID; tree is
        an array of at least 1 entry, each entry keys exactly {mode, path, sha, type} with mode '100644', type 'blob', path a
        non-empty string, sha matching OBJECT_ID.
      - 'POST' R + '/git/commits': body keys exactly {message, parents, tree}; message a string; tree matches OBJECT_ID; parents an
        array of at most 1 string matching OBJECT_ID.
      - 'POST' R + '/git/refs': body keys exactly {ref, sha}; ref === 'refs/heads/' + B; sha matches OBJECT_ID.
      - 'PATCH' githubBranchRefPath(S.repository, B): body keys exactly {force, sha}; force === false; sha matches OBJECT_ID.
    - Anything else (any other method including 'GET' and 'PUT' passed through a cast, path, scope, or body) -> false.

    send / sendNoContent, in this order:
    1. token must be 1..4096 characters, every char code 33..126 (check with a loop, not a regex) -> else
       githubFailure('github.invalid-request', 'The GitHub token is not a valid header value.').
    2. path syntax exactly as client.ts buildUrl: starts with '/', not '//', no '?', '#', backslash, whitespace, or control
       character, no '.' or '..' segment, and new URL(GITHUB_API_BASE_URL + path) has origin GITHUB_API_BASE_URL and pathname ===
       path -> else github.invalid-request.
    3. isAllowedGitHubWrite(request, scope) false -> githubWriteFailure('github.write-not-allowed', 'The GitHub write is not
       allowed.').
       Steps 1-3 happen before any budget charge and any fetch.
    4. Attempt loop exactly like client.ts requestOnce: budget.tryCharge() false -> github.budget-exhausted; fetch(url, init) with
       init { method, headers, signal, redirect: 'manual' } plus body: JSON.stringify(request.body) only when body is non-null (omit
       the key otherwise); headers exactly: accept 'application/vnd.github+json', 'x-github-api-version' GITHUB_API_VERSION,
       'user-agent' GITHUB_USER_AGENT, authorization 'Bearer ' + token, plus 'content-type': 'application/json' only when a body is
       sent. Timeout via AbortController and setTimeout(timeoutMs ?? GITHUB_REQUEST_TIMEOUT_MS).
    5. Status handling:
       - send: 200 or 201 -> bounded body read (content-length pre-check and streamed count against GITHUB_RESPONSE_MAX_BYTES ->
         github.response-too-large), UTF-8 fatal decode and non-empty and JSON.parse (else github.malformed-response),
         schema.safeParse (else github.schema-mismatch with at most 10 details {code 'github.schema-mismatch', path joined by '.',
         message = zod issue message, line null, column null}) -> ok(data). 204 -> github.unexpected-status.
       - sendNoContent: 204 -> cancel any body, ok(null). 200/201 -> github.unexpected-status.
       - 401 -> github.unauthorized; 404 -> github.not-found; 422 -> githubWriteFailure('github.write-conflict', 'The GitHub API
         rejected the write as conflicting.'), final, never retried; 403 and 429 -> the client's rate-limit logic unchanged
         (retry-after seconds, x-ratelimit-remaining '0' with x-ratelimit-reset, 429 without headers waits
         GITHUB_RETRY_WAIT_MAX_SECONDS, plain 403 -> github.unauthorized, a wait over the maximum -> github.rate-limited final);
         500-599 -> retry as github.server-error waiting 1000 * (retriesUsed + 1); network throw -> retry as github.network; abort
         -> github.timeout final; any other status -> github.unexpected-status with the status number in the message.
       - Retries: at most budget.limits.retriesPerRequest per request; every attempt charges the budget; sleep between attempts.
    6. Messages and details never contain response bodies, header values, the token, or request bodies.
    Default fetch: (url, init) => fetch(url, init). Default sleep: setTimeout promise. Default now: Date.now.

    Conventions: ESM relative imports end in '.js'; strict tsconfig with noUncheckedIndexedAccess, exactOptionalPropertyTypes,
    noUnusedLocals, noUnusedParameters; Prettier (single quotes, semicolons, trailing commas, printWidth 132) only on this step's
    files; comments only for a non-obvious WHY; no planning identifiers in code or titles. Tests are pure: no temp files, no child
    processes, no real network (inject fetch and sleep). Do not edit packages/core/src/index.ts. All export names above are unique
    across packages/core and packages/cli (checked); none starts with load, validate, resolve, parse, capture, or check.
- actions: |
    1. Create packages/core/src/github/writer.ts per context.
    2. Create packages/core/src/github/writer.test.ts (describe 'github writer'). Shared constants: SHA = 'a'.repeat(40); STORE =
       { repository: { owner: 'octo', name: 'evidence' }, branch: 'steward-evidence' }; scopes APP = { kind: 'app' }, WITH_STORE =
       { kind: 'installation', store: STORE }, NO_STORE = { kind: 'installation', store: null }; token 'test-token-' +
       'w'.repeat(20); a recording fake fetch (records url and init, answers from a queue of Responses) and a recording sleep; budgets
       from createGitHubBudget in './budget.js'. Use plain it(...) with EXACTLY these titles:
       - 'the writer allows exactly the store and token endpoints': each of these is allowed: APP POST
         '/app/installations/162868612/access_tokens' {repositories:['demo'], permissions:{contents:'read'}}; NO_STORE and WITH_STORE
         DELETE '/installation/token' null; WITH_STORE POST '/repos/octo/evidence/git/blobs' {content:'aGk=', encoding:'base64'};
         WITH_STORE POST '/repos/octo/evidence/git/trees' with and without base_tree SHA, tree [{path:'octo/demo/runs/pr-1/5-1/run.json',
         mode:'100644', type:'blob', sha:SHA}]; WITH_STORE POST '/repos/octo/evidence/git/commits' {message:'evidence: octo/demo pr-1
         run 5-1', tree:SHA, parents:[SHA]} and with parents []; WITH_STORE POST '/repos/octo/evidence/git/refs'
         {ref:'refs/heads/steward-evidence', sha:SHA}; WITH_STORE PATCH '/repos/octo/evidence/git/refs/heads/steward-evidence'
         {sha:SHA, force:false}.
       - 'the writer rejects every non-allowlisted method and path': iterate scopes {app: APP, store: WITH_STORE, nostore: NO_STORE}
         x methods ['GET','POST','PUT','PATCH','DELETE'] x these paths: '/app/installations/162868612/access_tokens',
         '/installation/token', '/repos/octo/evidence/git/blobs', '/repos/octo/evidence/git/trees', '/repos/octo/evidence/git/commits',
         '/repos/octo/evidence/git/refs', '/repos/octo/evidence/git/refs/heads/steward-evidence',
         '/repos/octo/evidence/git/refs/heads/main', '/repos/octo/evidence/git/refs/tags/v1', '/repos/octo/other/git/blobs',
         '/repos/octo/evidence/contents/run.json', '/repos/octo/evidence/issues/1/comments', '/repos/octo/evidence/issues/1/labels',
         '/repos/octo/evidence/issues/1', '/repos/octo/evidence/pulls/1', '/repos/octo/evidence/pulls/1/reviews',
         '/repos/octo/evidence/pulls/1/requested_reviewers', '/repos/octo/evidence/check-runs',
         '/repos/octo/evidence/statuses/' + SHA, '/repos/octo/evidence/issues/comments/1/reactions',
         '/repos/octo/evidence/dispatches', '/app/installations/162868612', '/user/installations'. The body for each path is the
         valid body from the previous test for the allowlisted endpoints (null for '/installation/token') and {} for every other
         path. Cast the request to GitHubWriteRequest. Expect isAllowedGitHubWrite to be true EXACTLY for these 8 keys (scope name,
         method, path) and false for all others: 'app POST /app/installations/162868612/access_tokens', 'store DELETE
         /installation/token', 'nostore DELETE /installation/token', 'store POST /repos/octo/evidence/git/blobs', 'store POST
         /repos/octo/evidence/git/trees', 'store POST /repos/octo/evidence/git/commits', 'store POST /repos/octo/evidence/git/refs',
         'store PATCH /repos/octo/evidence/git/refs/heads/steward-evidence'; also assert the count of true results is 8.
       - 'rejected writes send nothing and spend no budget': through createGitHubWriter with WITH_STORE send POST
         '/repos/octo/evidence/issues/1/comments' {body:'x'}, PATCH '/repos/octo/evidence/git/refs/heads/main' {sha:SHA, force:false},
         POST '/repos/octo/evidence/check-runs' {}, and a cast PUT '/repos/octo/evidence/contents/run.json' {}; sendNoContent DELETE
         '/repos/octo/evidence/git/refs/heads/steward-evidence' null. Each fails with code 'github.write-not-allowed', cause
         'steward-defect', outcome 'inconclusive'; the fake fetch has 0 calls and budget.requestsUsed() is 0.
       - 'write bodies are checked against the allowlist': each is false: PATCH ref with force true; PATCH ref with an extra key;
         POST refs with ref 'refs/heads/main'; POST trees with an entry mode '100755'; POST trees with an entry type 'commit'; POST
         trees with tree []; POST commits with 2 parents; POST blobs with encoding 'utf-8'; access_tokens with 2 repositories;
         access_tokens with a permission value 'admin'; DELETE '/installation/token' with body {}.
       - 'writes send json bodies with the pinned headers': send POST blobs (WITH_STORE) with schema z.object({ sha: z.string() });
         fake answers new Response(JSON.stringify({ sha: SHA, url: 'https://api.github.com/x' }), { status: 201 }) -> ok { sha: SHA };
         recorded url 'https://api.github.com/repos/octo/evidence/git/blobs', method 'POST', redirect 'manual', headers exactly
         { accept, 'x-github-api-version', 'user-agent', authorization: 'Bearer ' + token, 'content-type': 'application/json' },
         JSON.parse(body) equal to the request body.
       - 'a non-fast-forward update is a write conflict': PATCH ref answered 422 {"message":"Update is not a fast forward"} ->
         code 'github.write-conflict', cause 'github-unavailable'; exactly 1 fetch call.
       - 'writes retry server errors within the budget': [502, 201 json] with retriesPerRequest 1 -> ok, sleeps [1000],
         requestsUsed 2; [502, 502] with retriesPerRequest 1 -> 'github.server-error'; budget { requests: 1, retriesPerRequest: 3 }
         with [502, 502] -> 'github.budget-exhausted' after 1 fetch call.
       - 'token revocation expects no content': sendNoContent DELETE '/installation/token' (NO_STORE) answered 204 -> ok(null);
         recorded headers have no 'content-type' and init has no 'body' key; answered 200 '{}' -> 'github.unexpected-status'.
       - 'write failures never echo the response body': bodies containing 'SENTINEL-' + 'x'.repeat(10) answered with 422, with 500
         (retries 0), and as a malformed 201 body 'SENTINEL-' + 'x'.repeat(10) + '{' -> JSON.stringify(result) contains neither
         'SENTINEL-' nor the token.
    3. Run: pnpm exec prettier --write packages/core/src/github/writer.ts packages/core/src/github/writer.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/github/writer.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.2.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p2-2.2.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['the writer allows exactly the store and token endpoints','the writer rejects every non-allowlisted method and path','rejected writes send nothing and spend no budget','write bodies are checked against the allowlist','writes send json bodies with the pinned headers','a non-fast-forward update is a write conflict','writes retry server errors within the budget','token revocation expects no content','write failures never echo the response body'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. git diff --quiet HEAD -- packages/core/src/github/client.ts packages/core/src/github/client.test.ts -> exit 0
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/github/writer.ts packages/core/src/github/writer.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/github/writer.ts packages/core/src/github/writer.test.ts -> exit 0
    8. cat packages/core/src/github/writer.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/github/writer.ts packages/core/src/github/writer.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
