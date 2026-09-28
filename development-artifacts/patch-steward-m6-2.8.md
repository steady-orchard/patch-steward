# Step 2.8

- id: 2.8
- depends_on: [2.1]
- route: mechanical
- objective: Add the workflow-run list adapter to core that reads the three bounded run listings the cap evaluation needs (runs created since the start of the UTC day, in-progress runs, queued runs) and maps them to the cap evaluator's input shape.
- files_in_scope:
    - packages/core/src/github/runs.ts
    - packages/core/src/github/runs.test.ts
    - development-artifacts/patch-steward-m6-2.8-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Aggregate caps are computed from the repository's Actions run list, tagged by the wrapper run-name: GET
    /repos/{o}/{r}/actions/runs?created=>=<YYYY-MM-DD>&per_page=100, then ?status=in_progress and ?status=queued, each at most
    RUN_LIST_PAGES_MAX (10) pages; 3 requests when each fits one page. The response is an object { total_count, workflow_runs: [...]
    } (Link-paginated); a real item has keys including id, name, display_title, path (for example
    '.github/workflows/probe-pa04-w2-host-personal.yml'), event, status ('queued', 'in_progress', 'completed', ... possibly null),
    conclusion, created_at ('2026-09-25T08:26:10Z'), run_attempt, workflow_id. The pure evaluator already exists: evaluateCaps in
    packages/core/src/ownership/caps.ts takes three RunListQueryResult values and fails closed when inProgress or queued is
    incomplete, or createdToday is incomplete with totalCount <= 1000 (a total over 1000 counts as over the daily cap even when
    incomplete, because the API returns at most 1000 results). This adapter sets complete false when pages exceed the bound or a
    read fails.

    Existing code to use:
    - './client.js': type GitHubClient with getPaginatedList<T>(path, listKey, itemSchema, query?, maxPages?) ->
      Result<{ items, totalCount, complete }, GitHubFailureCode>; githubFailure(code, message); type GitHubFailureCode.
    - './reader.js': type GitHubRepositoryRef, repositoryRefFromFullName(fullName) (null when invalid).
    - '../ownership/caps.js': types RunListItem ({ id, path, event, status, createdAt, displayTitle }) and RunListQueryResult
      ({ items, totalCount, complete }); runListQueryDate(now: Date) -> 'YYYY-MM-DD' (UTC).
    - '../policy/bounds.js': RUN_LIST_PAGES_MAX. '../result.js': ok, types Result, StewardFailure.

    Required API (exact names; export nothing else):
      export const githubWorkflowRunSchema = z.object({
        id: z.int().positive(),
        path: z.string().max(1024),
        event: z.string().max(64),
        status: z.string().max(64).nullable(),
        created_at: z.string().max(64),
        display_title: z.string().max(65536),
      });
      export type RunListFilter =
        | { readonly kind: 'created-since'; readonly date: string }
        | { readonly kind: 'status'; readonly status: 'in_progress' | 'queued' };
      export async function readRunList(client: GitHubClient, repository: GitHubRepositoryRef, filter: RunListFilter):
        Promise<Result<RunListQueryResult, GitHubFailureCode>>;
      export interface CapRunLists {
        readonly createdToday: RunListQueryResult;
        readonly inProgress: RunListQueryResult;
        readonly queued: RunListQueryResult;
        readonly failure: StewardFailure | null;
      }
      export async function readCapRunLists(client: GitHubClient, repository: GitHubRepositoryRef, now: Date): Promise<CapRunLists>;

    Rules:
    - readRunList: repository must satisfy repositoryRefFromFullName(owner + '/' + name) !== null; created-since date must match
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/; status must be 'in_progress' or 'queued'; any violation -> githubFailure('github.invalid-
      request', ...) with no request. Query { created: '>=' + date } or { status }. client.getPaginatedList('/repos/' +
      encodeURIComponent(owner) + '/' + encodeURIComponent(name) + '/actions/runs', 'workflow_runs', githubWorkflowRunSchema,
      query, RUN_LIST_PAGES_MAX); failure returned as is; ok({ items: mapped { id, path, event, status: status ?? '', createdAt:
      created_at, displayTitle: display_title }, totalCount, complete }).
    - readCapRunLists: reads sequentially createdToday (created-since runListQueryDate(now)), then inProgress (status
      'in_progress'), then queued (status 'queued'). At the first failed read, that result and every later one are
      { items: [], totalCount: 0, complete: false }, later reads are NOT requested, and failure is that read's failure object
      (result.failure); otherwise failure null. It never throws.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig with
    noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters; Prettier (single quotes, semicolons,
    trailing commas, printWidth 132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in
    code or titles. Tests are pure: no temp files, no child processes, no real network. Do not edit packages/core/src/index.ts.
    Export names are unique across packages; none starts with load, validate, resolve, parse, capture, or check.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const s=require('fs').readFileSync('packages/core/src/github/client.ts','utf8');const need=['getPaginatedList','export interface GitHubListPage'];const miss=need.filter(n=>!s.includes(n));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/github/runs.ts per context.
    3. Create packages/core/src/github/runs.test.ts (describe 'run list adapter'). Client: createGitHubClient({ token:
       'test-token-' + 'r'.repeat(12), budget: createGitHubBudget({ requests: 20, retriesPerRequest: 0 }), fetch }) with a recording
       fake fetch; repository { owner: 'octo', name: 'demo' }; a run item such as { id: 5, name: 'x', display_title: 'steward pr 12
       author 2095171 event pull_request_target edited sender 2095171 User', path: '.github/workflows/steward-pr.yml', event:
       'pull_request_target', status: 'in_progress', conclusion: null, created_at: '2026-09-27T09:00:00Z', run_attempt: 1 }. Use
       plain it(...) with EXACTLY these titles:
       - 'run list items map the fields caps use': -> items [{ id: 5, path, event, status: 'in_progress', createdAt:
         '2026-09-27T09:00:00Z', displayTitle }], totalCount from total_count, complete true; an item with status null maps to ''.
       - 'the created filter starts at the UTC day': readCapRunLists with now new Date('2026-09-27T23:59:59Z') -> first URL exactly
         'https://api.github.com/repos/octo/demo/actions/runs?created=%3E%3D2026-09-27&per_page=100'.
       - 'a run list beyond the page limit keeps its total': every page has a next link and total_count 1500 -> ok, complete false,
         totalCount 1500, exactly 10 fetch calls.
       - 'cap run lists read three listings in order': readCapRunLists -> exactly 3 fetch calls with URLs ending
         'runs?created=%3E%3D2026-09-27&per_page=100', 'runs?status=in_progress&per_page=100', 'runs?status=queued&per_page=100';
         failure null; each result complete true.
       - 'a failed run list read leaves later lists incomplete': the in-progress read answers 500 -> 2 fetch calls; createdToday
         complete true; inProgress and queued { items: [], totalCount: 0, complete: false }; failure.code 'github.server-error';
         and evaluateCaps (from '../ownership/caps.js') on these lists with now, botUserId 1, authorId 2, currentRunId 3,
         dailyLimit 50, authorLimit 2 fails with code 'caps.run-list-unavailable'.
       - 'an invalid run list filter is an invalid request': created-since date '2026-9-27' and a cast status 'completed' ->
         'github.invalid-request' with 0 fetch calls.
    4. Run: pnpm exec prettier --write packages/core/src/github/runs.ts packages/core/src/github/runs.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/github/runs.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.8.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p2-2.8.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['run list items map the fields caps use','the created filter starts at the UTC day','a run list beyond the page limit keeps its total','cap run lists read three listings in order','a failed run list read leaves later lists incomplete','an invalid run list filter is an invalid request'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/github/runs.ts packages/core/src/github/runs.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/github/runs.ts packages/core/src/github/runs.test.ts -> exit 0
    7. cat packages/core/src/github/runs.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
       -> prints 0 (grep exit status 1 is expected)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/github/runs.ts packages/core/src/github/runs.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
