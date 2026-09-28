# Step 2.1

- id: 2.1
- depends_on: []
- route: mechanical
- objective: Add two GET-only methods to the core GitHub client: paginated reads of object-wrapped lists with a total count and completeness, and a redirect read that returns the Location without following it.
- files_in_scope:
    - packages/core/src/github/client.ts
    - packages/core/src/github/client-lists.test.ts
    - development-artifacts/patch-steward-m6-2.1-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only;
    no new dependency.

    packages/core/src/github/client.ts holds createGitHubClient(options) returning GitHubClient { getJson, getPaginated }. It is the
    GET-only client of the local CLI: GitHubFetchInit.method is the literal 'GET' and MUST stay so; getJson and getPaginated MUST
    keep their exact behavior (packages/core/src/github/client.test.ts must pass unchanged; do not edit it). Internals you reuse:
    buildUrl(path, query) (rejects bad paths, returns null), buildHeaders(token), parseLinkHeader(linkHeader) (next-link parsing,
    origin check), readBoundedBody, attempt(url, retriesUsed) (one fetch with timeout, status mapping, retry/final outcome),
    requestOnce(url) (budget charge per attempt, retries up to budget.limits.retriesPerRequest, sleeps outcome.waitMs),
    tokenIsValid(). Failures use githubFailure(code, message, details?) with the existing 17 GITHUB_FAILURE_CODES only (do NOT add
    a code: packages/core/src/exports.test.ts pins the length 17). Bounds come from '../policy/bounds.js': GITHUB_PAGE_SIZE (100),
    GITHUB_PAGES_MAX (30), ATTACHMENT_URL_MAX_LENGTH (2048).

    Why: GitHub's artifact listing and workflow-run listing answer objects such as {"total_count": 4, "artifacts": [...]} (not bare
    arrays) paginated by Link headers (next links may use /repositories/<id>/... paths on https://api.github.com); a later adapter
    needs the items, the first page's total_count, and whether the listing was complete within a page bound. The artifact zip
    endpoint answers HTTP 302 with a Location header to a signed storage URL (for example
    https://productionresultssa9.blob.core.windows.net/...?...sig=...); a later adapter downloads it separately without the token,
    so the client must return the Location and never follow it. The Location is a credential-like signed URL: never put it (or any
    header value or response text) in a failure message or detail.

    Required additions (exact names):
      export interface GitHubListPage<T> {
        readonly items: readonly T[];
        readonly totalCount: number;
        readonly complete: boolean;
      }
    and two methods on the GitHubClient interface and the object createGitHubClient returns:
      getPaginatedList<T>(path: string, listKey: string, itemSchema: z.ZodType<T>, query?: GitHubQuery, maxPages?: number):
        Promise<Result<GitHubListPage<T>, GitHubFailureCode>>;
      getRedirectLocation(path: string, query?: GitHubQuery): Promise<Result<string, GitHubFailureCode>>;

    getPaginatedList rules:
    - token invalid -> github.invalid-request (same message as getPaginated); listKey not matching /^[a-z_]{1,64}$/ ->
      github.invalid-request; first URL = buildUrl(path, { ...(query ?? {}), per_page: String(GITHUB_PAGE_SIZE) }), null ->
      github.invalid-request. No request is made on these failures.
    - limit = Math.min(Math.max(maxPages ?? GITHUB_PAGES_MAX, 1), GITHUB_PAGES_MAX).
    - Each page: requestOnce(url) (JSON mode). The value must be a non-null, non-array object whose total_count is a safe integer
      >= 0 and whose [listKey] is an array; each element is parsed with z.array(itemSchema). Any violation -> github.schema-mismatch
      with details built exactly like getJson's (at most 10 zod issues: code 'github.schema-mismatch', path = issue path joined by
      '.', message = issue.message, line null, column null). totalCount = the FIRST page's total_count.
    - Link handling via parseLinkHeader (its failures are returned as is). No next link -> ok({ items, totalCount, complete: true }).
      A next link when pageNumber >= limit -> ok({ items read so far, totalCount, complete: false }) WITHOUT requesting it. Otherwise
      follow the next link (new URL(nextUrl)).

    getRedirectLocation rules:
    - token invalid or buildUrl(path, query) null -> github.invalid-request, no request.
    - Same headers, method 'GET', redirect 'manual', timeout, budget charge per attempt, and retry loop as getJson.
    - Status 301, 302, 303, 307, or 308: discard the body (response.body?.cancel()); header 'location' must be present, at most
      ATTACHMENT_URL_MAX_LENGTH characters, and parse with new URL(location) as an absolute URL whose protocol is 'https:' or
      'http:' (the caller rejects http later); otherwise github.malformed-response (message 'The redirect location is not valid.').
      Success -> ok(parsed.href).
    - Status 200-299 -> final github.unexpected-status, message 'The GitHub API did not answer with a redirect.'.
    - Every other status, network error, and timeout maps exactly as in JSON mode (401 unauthorized, 404 not-found, 403/429
      rate-limit rules, 5xx retry as server-error, else unexpected-status).
    Implementation hint: give attempt and requestOnce a mode parameter ('json' | 'redirect'); in redirect mode check the redirect
    statuses first; JSON mode must remain byte-for-byte equivalent in behavior.

    Conventions: ESM relative imports end in '.js'; strict tsconfig with noUncheckedIndexedAccess, exactOptionalPropertyTypes,
    noUnusedLocals, noUnusedParameters; Prettier (single quotes, semicolons, trailing commas, printWidth 132) only on this step's
    files; comments only for a non-obvious WHY; no planning identifiers (step, phase, milestone, or rule ids) in code or titles.
    Tests are pure: no temp files, no child processes, no real network (inject fetch and sleep). Do not edit
    packages/core/src/index.ts (client.ts is already root-exported, so GitHubListPage becomes a root export automatically; the name
    is unique across packages).
- actions: |
    1. Edit packages/core/src/github/client.ts: add GitHubListPage, extend the GitHubClient interface, implement getPaginatedList and
       getRedirectLocation per context, and return them from createGitHubClient. Import ATTACHMENT_URL_MAX_LENGTH from
       '../policy/bounds.js'. Do not change GitHubFetchInit, GITHUB_FAILURE_CODES, getJson, or getPaginated behavior.
    2. Create packages/core/src/github/client-lists.test.ts (describe 'github client lists and redirects'). Copy the makeFetch and
       makeSleep helpers from packages/core/src/github/client.test.ts (do not import from a test file). Use a token such as
       'test-token-' + 'l'.repeat(12) and createGitHubBudget from './budget.js'. Use plain it(...) with EXACTLY these titles:
       - 'list pages collect items and the first total count': page 1 body {"total_count":3,"items":[{"id":1},{"id":2}]} with header
         link '<https://api.github.com/repositories/9/things?per_page=100&page=2>; rel="next", <https://api.github.com/repositories/9/things?per_page=100&page=2>; rel="last"';
         page 2 body {"total_count":3,"items":[{"id":3}]} without link. getPaginatedList('/repos/octo/demo/things', 'items',
         z.object({ id: z.number() }), { name: 'x' }) -> ok { items ids [1,2,3], totalCount 3, complete true }; first URL
         'https://api.github.com/repos/octo/demo/things?name=x&per_page=100'; second URL equals the next link.
       - 'a list beyond the page limit is incomplete': maxPages 1, page 1 carries a next link -> ok, complete false, items of page
         1 only, totalCount from page 1, exactly 1 fetch call.
       - 'list pages validate every item': an item {"id":"x"} -> failure github.schema-mismatch, outcome 'inconclusive'.
       - 'a list page without the named array is a schema mismatch': bodies {"total_count":1}, [] and
         {"total_count":-1,"items":[]} each -> github.schema-mismatch; listKey 'Bad-Key' -> github.invalid-request with 0 fetch calls.
       - 'the redirect location is returned without following it': new Response(null, { status: 302, headers: { location:
         'https://storage.example.net/a/b.zip?sig=' + 'q'.repeat(20) } }) -> ok with that href; exactly 1 fetch call with method
         'GET', redirect 'manual', and authorization 'Bearer ' + token.
       - 'a response that does not redirect is an unexpected status': 200 with body '{}' -> github.unexpected-status.
       - 'a redirect without a valid location is malformed': 302 without location; location 'relative/path'; location
         'https://x.example/' + 'a'.repeat(2100); location 'ftp://x.example/a' -> each github.malformed-response.
       - 'redirect reads retry server errors within the budget': responses [500, 302 with a valid location], retriesPerRequest 1 ->
         ok, sleeps [1000], budget.requestsUsed() 2; responses [500, 500], retriesPerRequest 1 -> github.server-error.
       - 'redirect failures never echo the location': for the malformed and unexpected-status cases above,
         JSON.stringify(result) contains neither 'sig=' nor 'x.example' nor 'storage.example.net'.
    3. Run: pnpm exec prettier --write packages/core/src/github/client.ts packages/core/src/github/client-lists.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/github/client-lists.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.1.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p2-2.1.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['list pages collect items and the first total count','a list beyond the page limit is incomplete','list pages validate every item','a list page without the named array is a schema mismatch','the redirect location is returned without following it','a response that does not redirect is an unexpected status','a redirect without a valid location is malformed','redirect reads retry server errors within the budget','redirect failures never echo the location'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. git diff --quiet HEAD -- packages/core/src/github/client.test.ts -> exit 0
    4. grep -c "readonly method: 'GET';" packages/core/src/github/client.ts -> prints 1
    5. pnpm vitest run -> exit 0
    6. pnpm typecheck -> exit 0
    7. pnpm exec eslint packages/core/src/github/client.ts packages/core/src/github/client-lists.test.ts -> exit 0
    8. pnpm exec prettier --check packages/core/src/github/client.ts packages/core/src/github/client-lists.test.ts -> exit 0
    9. cat packages/core/src/github/client-lists.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
       -> prints 0 (grep exit status 1 is expected)
    10. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/github/client.ts packages/core/src/github/client-lists.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (restores client.ts and removes the new test file).
