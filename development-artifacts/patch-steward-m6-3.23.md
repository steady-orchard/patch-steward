# Step 3.23

- id: 3.23
- depends_on: [3.9, 3.10, 3.11, 3.13, 3.16]
- route: mechanical
- objective: Add the write-allowlist conformance test (the only possible GitHub writes are App token mints and revocations and the evidence-store Git Data API calls) and extend the zero-execution import scan to the ownership module and the action package.
- files_in_scope:
    - packages/core/src/conformance/write-allowlist.test.ts
    - packages/core/src/conformance/zero-execution.fixture.test.ts
    - development-artifacts/patch-steward-m6-3.23-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Rule: the only non-GET GitHub requests the core can make are POST /app/installations/{id}/access_tokens, DELETE
    /installation/token, POST /repos/{o}/{r}/git/blobs, POST .../git/trees, POST .../git/commits, POST .../git/refs (store branch
    only), and PATCH .../git/refs/heads/<store branch>; issues, comments, labels, checks, reviews, statuses, reactions, dispatches,
    and contents-API writes are all impossible. The check is isAllowedGitHubWrite(request, scope) in
    packages/core/src/github/writer.ts (scope { kind: 'app' } or { kind: 'installation', store: { repository: { owner, name },
    branch } | null }; request { method: 'POST' | 'PATCH' | 'DELETE', path, body }), enforced by createGitHubWriter before any
    request. Read writer.ts for the exact accepted body shapes (access token body { repositories: [name], permissions: { key:
    'read'|'write' } }; blobs { content, encoding: 'base64' }; trees { base_tree?, tree: [{ path, mode: '100644', type: 'blob', sha
    }] }; commits { message, tree, parents (at most one) }; refs create { ref: 'refs/heads/<store branch>', sha }; refs update {
    sha, force: false }).

    Base check (files changed in steps 3.9, 3.10, 3.11, 3.13, 3.16): packages/action/src/files.ts exists; createStoreWorld,
    createHostedWorld, runHostedGate, runHostedPublish exist (read the world files and hosted-publish.test.ts for the gate, upload,
    publish harness).

    New file packages/core/src/conformance/write-allowlist.test.ts, describe 'write allowlist', plain it(...) titles EXACTLY:
      - 'only the evidence store and token endpoints are writable': with STORE = { repository: { owner: 'o', name: 'r' }, branch:
        'steward-evidence' }, sha = 'a'.repeat(40): isAllowedGitHubWrite is true for the seven allowed requests with valid bodies
        (app scope for the access token POST to '/app/installations/7/access_tokens'; installation scope with STORE for the rest)
        and false for each of: POST '/repos/o/r/issues/1/comments', PATCH '/repos/o/r/issues/1', POST '/repos/o/r/issues/1/labels',
        DELETE '/repos/o/r/issues/1/labels/x', POST '/repos/o/r/check-runs', PATCH '/repos/o/r/check-runs/1', POST
        '/repos/o/r/pulls/1/reviews', POST '/repos/o/r/pulls/1/requested_reviewers', POST '/repos/o/r/statuses/' + sha, POST
        '/repos/o/r/issues/1/reactions', PATCH '/repos/o/r/pulls/1', POST '/repos/o/r/actions/workflows/x/dispatches', PATCH
        '/repos/o/r/git/refs/heads/master' (valid update body), POST '/repos/o/r/git/refs' with ref 'refs/heads/master', PATCH the
        store ref with force true, DELETE '/repos/o/r/git/refs/heads/steward-evidence', POST '/repos/other/r/git/blobs', a PUT
        '/repos/o/r/contents/x' (cast the request `as unknown as GitHubWriteRequest`), the access token POST under the
        installation scope, and a blob POST under the app scope.
      - 'hosted runs send only allowlisted writes': a runnable gate, upload, and publish, then a second submission state whose
        publish is superseded (so a supersession commit happens); every entry in world.requests whose method is not 'GET',
        'DOWNLOAD', or a test marker matches one of /^POST \/app\/installations\/\d+\/access_tokens$/,
        /^DELETE \/installation\/token$/, /^POST \/repos\/steady-orchard\/patch-steward-testbed-public\/git\/(blobs|trees|commits|refs)$/,
        /^PATCH \/repos\/steady-orchard\/patch-steward-testbed-public\/git\/refs\/heads\/steward-evidence$/ (tested as `method + ' ' +
        path`).
      - 'the gate sends no write other than token requests': the requests of a gate run alone contain no non-GET request other
        than the access token POST and the token DELETE.
      - 'non-get requests are built only by the writer users': a static scan of every non-test .ts file under packages/core/src
        (recursive; skip names ending '.test.ts') finds the text `fetch(` only in github/client.ts and github/writer.ts, and a
        match of /method: '(POST|PATCH|DELETE|PUT)'/ only in github/app-auth.ts and evidence/git-store.ts; a scan of every non-test
        .ts file under packages/action/src finds neither. (Paths compared with forward slashes, relative to packages/core/src.)
    Edit packages/core/src/conformance/zero-execution.fixture.test.ts: in the `scanRoots` array (it lists
    `fileURLToPath(new URL('../submission/', import.meta.url))` and others), append two entries:
      fileURLToPath(new URL('../ownership/', import.meta.url)),
      fileURLToPath(new URL('../../../action/src/', import.meta.url)),
    and change nothing else in that file (the forbidden specifier words and the `scannedCount >= 60` check stay).

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; no planning identifiers in code, comments, or test titles; never write raw control, bidi, or
    zero-width characters. The static scan may use node:fs and node:path (conformance tests are not scanned for imports). No temp
    files, no child processes, no real network.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const chk=[['packages/action/src/files.ts','export const STAGING_PATHS'],['packages/core/src/evidence/store-world.test.ts','export function createStoreWorld'],['packages/core/src/pipeline/hosted-world.test.ts','export function createHostedWorld'],['packages/core/src/pipeline/hosted-gate.ts','export async function runHostedGate'],['packages/core/src/pipeline/hosted-publish.ts','export async function runHostedPublish']];const miss=chk.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s)).map(c=>c.join(' '));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/conformance/write-allowlist.test.ts and edit zero-execution.fixture.test.ts per context.
    3. Run: pnpm exec prettier --write packages/core/src/conformance/write-allowlist.test.ts packages/core/src/conformance/zero-execution.fixture.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/conformance/write-allowlist.test.ts packages/core/src/conformance/zero-execution.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.23.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.23.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['only the evidence store and token endpoints are writable','hosted runs send only allowlisted writes','the gate sends no write other than token requests','non-get requests are built only by the writer users','zero model calls and zero executions','screen makes only GET requests'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. node -e "const s=require('fs').readFileSync('packages/core/src/conformance/zero-execution.fixture.test.ts','utf8');console.log(s.includes(\"new URL('../ownership/', import.meta.url)\")&&s.includes(\"new URL('../../../action/src/', import.meta.url)\")?'scan extended':'scan not extended')"
       -> prints exactly: scan extended
    4. git diff --numstat 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/conformance/zero-execution.fixture.test.ts | awk '{print $1" "$2}'
       -> prints exactly: 2 0
    5. pnpm vitest run -> exit 0
    6. pnpm typecheck -> exit 0
    7. pnpm exec eslint packages/core/src/conformance/write-allowlist.test.ts packages/core/src/conformance/zero-execution.fixture.test.ts -> exit 0
    8. pnpm exec prettier --check packages/core/src/conformance/write-allowlist.test.ts packages/core/src/conformance/zero-execution.fixture.test.ts -> exit 0
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/conformance/write-allowlist.test.ts packages/core/src/conformance/zero-execution.fixture.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the new test and the two scan roots).
