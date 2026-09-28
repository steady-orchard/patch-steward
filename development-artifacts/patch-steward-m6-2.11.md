# Step 2.11

- id: 2.11
- depends_on: [2.4, 2.5, 2.6, 2.7, 2.8, 2.9]
- route: mechanical
- objective: Add a fixture-tier test that validates the hosted adapters and their response schemas against the real GitHub responses recorded in fixtures/github/hosted/.
- files_in_scope:
    - packages/core/src/github/hosted-responses.fixture.test.ts
    - development-artifacts/patch-steward-m6-2.11-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Files named
    *.fixture.test.ts run in the Vitest 'fixture' project (part of `pnpm test`) and may read files from the root fixtures/
    directory, located relative to the test file with import.meta.url (from packages/core/src/github/ the corpus is
    new URL('../../../../fixtures/github/hosted/', import.meta.url)). No network: responses are served from the recorded files by a
    fake fetch.

    Recorded files (read-only gh api recordings of the public test-bed steady-orchard/patch-steward-testbed-public; their exact
    values are whatever was recorded, so derive every expectation from the file content, never hard-code recorded ids, counts,
    or timestamps except where stated):
    - artifacts-page.json: { total_count, artifacts: [{ id, name, expired, created_at, expires_at, workflow_run: { id, ... }, ... }] }
    - runs-page.json and runs-in-progress.json: { total_count, workflow_runs: [{ id, name, display_title, path, event, status,
      conclusion, created_at, updated_at, run_attempt, run_number, workflow_id, head_branch, head_sha }] } (in-progress may be empty)
    - ref-heads-master.json: { ref, node_id, url, object: { sha, type, url } }
    - git-commit-master.json: { parents: [{ sha, url, html_url }], sha, tree: { sha, url }, url }
    - compare-parent-master.json: { ahead_by, behind_by, files: [{ additions, changes, deletions, filename, sha, status }], status,
      total_commits }
    - tree-master-github.json: { sha, tree: [{ path, mode, type, sha, size?, url }], truncated, url } (a <commit>:.github subtree)
    - contents-readme.json: { name, path, sha, size, url, html_url, git_url, download_url, type: 'file', content (base64 with
      newlines), encoding: 'base64', _links }
    - contents-github-directory.json: an array of contents entries ({ name, path, sha, size, type, ... })
    - user-app-bot.json: { login: 'patch-steward-testbed[bot]', id: 331019482, type: 'Bot', ... }

    Code under test (all merged before this step; read their exports first):
    - './client.js': createGitHubClient({ token, budget, fetch }); './budget.js': createGitHubBudget({ requests, retriesPerRequest }).
    - './artifacts.js': listOwnershipArtifacts(client, repository, name) -> Result<{ items: { id, name, createdAt, expiresAt,
      expired, workflowRunId }[], complete }>. '../ownership/artifacts.js': newestOwnershipArtifact(listing, name).
    - './runs.js': readRunList(client, repository, { kind: 'created-since', date } | { kind: 'status', status }) ->
      Result<{ items: { id, path, event, status, createdAt, displayTitle }[], totalCount, complete }>.
    - './app-auth.js': githubBotUserSchema.
    - './reader.js': readBranchHead(client, repository, branch). './schemas.js': githubTreeResponseSchema, githubContentsEntrySchema.
    - '../evidence/git-store.js': githubGitCommitResponseSchema. '../evidence/store-checks.js': evidenceCompareSchema,
      verifyAppendOnlyCompare(compare, expectedPaths), verifyReadBackTree(entries, expected, mode).
    - '../evidence/fallback-read.js': githubContentsFileSchema.
    - '../redaction/detectors.js': findCredentialDetector(text) -> detector id or null.
    A fake fetch serving one file: () => Promise.resolve(new Response(<file text>, { status: 200 })) (no Link header, so listings
    are complete). Repository { owner: 'steady-orchard', name: 'patch-steward-testbed-public' }.

    Conventions: ESM relative imports end in '.js'; strict tsconfig; Prettier (single quotes, semicolons, trailing commas,
    printWidth 132) only on this step's file; no planning identifiers in code or titles; no temp files, no child processes, no
    network. Read fixtures with readFileSync only.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const P={'packages/core/src/github/artifacts.ts':['export async function listOwnershipArtifacts'],'packages/core/src/github/runs.ts':['export async function readRunList'],'packages/core/src/github/app-auth.ts':['export const githubBotUserSchema'],'packages/core/src/evidence/git-store.ts':['export const githubGitCommitResponseSchema'],'packages/core/src/evidence/fallback-read.ts':['export const githubContentsFileSchema'],'fixtures/github/hosted/artifacts-page.json':['total_count'],'fixtures/github/hosted/user-app-bot.json':['331019482']};const miss=[];for(const [f,ns] of Object.entries(P)){const s=fs.existsSync(f)?fs.readFileSync(f,'utf8'):'';for(const n of ns)if(!s.includes(n))miss.push(f+':'+n)}console.log(miss.length?'MISSING '+miss.join(' '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/github/hosted-responses.fixture.test.ts (describe 'recorded hosted GitHub responses'). Use plain
       it(...) with EXACTLY these titles:
       - 'recorded artifact listing maps to ownership artifacts': listOwnershipArtifacts(client over artifacts-page.json, repository,
         'steward-ownership-pr-1') -> ok, complete true, items.length === artifacts.length, and for each index id, name, expired,
         createdAt (=== created_at), expiresAt (=== expires_at), workflowRunId (=== workflow_run.id) equal the file's values;
         newestOwnershipArtifact(listing, first artifact name).kind is 'unique' or 'ambiguous'.
       - 'recorded run lists map to cap query results': readRunList over runs-page.json with { kind: 'created-since', date:
         '2026-09-27' } -> ok, complete true, totalCount === total_count, items.length === workflow_runs.length, each item's id,
         path, event, createdAt, displayTitle equal the file's, status equal the file's status or '' when null; every path matches
         /^\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml$/ (no suffix after the file name); readRunList over runs-in-progress.json
         with { kind: 'status', status: 'in_progress' } -> ok with totalCount === its total_count.
       - 'recorded git commit and compare responses validate': readBranchHead over ref-heads-master.json with branch 'master' ->
         ok 40-hex; githubGitCommitResponseSchema.safeParse(commit).success; evidenceCompareSchema.safeParse(compare).success;
         verifyAppendOnlyCompare(compare, compare.files.map((f) => f.filename)).ok equals (compare.status === 'ahead' &&
         compare.ahead_by === 1 && compare.behind_by === 0 && every file status === 'added').
       - 'a recorded subtree read supports the read-back check': githubTreeResponseSchema.safeParse(tree).success and truncated
         false; for the first entry with type 'blob' and mode '100644', verifyReadBackTree(entries mapped to { path, type, sha, mode }, [{ path:
         blob.path, blobId: blob.sha }], 'contains').ok is true, and with blobId '0'.repeat(40) it is false.
       - 'recorded file contents decode for the fallback read': githubContentsFileSchema.safeParse(readme).success;
         Buffer.from(content with '\n' and '\r' removed, 'base64').length === size; every element of contents-github-directory.json
         passes githubContentsEntrySchema.
       - 'the recorded app bot user validates': githubBotUserSchema.safeParse(user) succeeds with id 331019482 and login
         'patch-steward-testbed[bot]'.
       - 'recorded hosted responses contain no credential': every .json file in fixtures/github/hosted/ (at least 10) has
         findCredentialDetector(text) === null.
    3. Run: pnpm exec prettier --write packages/core/src/github/hosted-responses.fixture.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/github/hosted-responses.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.11.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p2-2.11.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['recorded artifact listing maps to ownership artifacts','recorded run lists map to cap query results','recorded git commit and compare responses validate','a recorded subtree read supports the read-back check','recorded file contents decode for the fallback read','the recorded app bot user validates','recorded hosted responses contain no credential'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/github/hosted-responses.fixture.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/github/hosted-responses.fixture.test.ts -> exit 0
    7. cat packages/core/src/github/hosted-responses.fixture.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
       -> prints 0 (grep exit status 1 is expected)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/github/hosted-responses.fixture.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the new test file).
