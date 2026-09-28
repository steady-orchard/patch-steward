# Step 3.1

- id: 3.1
- depends_on: []
- route: mechanical
- objective: Add `loadPolicyRevision` to the policy loader (a GitHub load of a trusted policy by its recorded git tree id, sharing the existing GitHub source's tree, truncation, regular-file, and blob checks) and extend the invariant-5 name lists.
- files_in_scope:
    - packages/core/src/policy/loader.ts
    - packages/core/src/policy/loader-revision.test.ts
    - packages/core/src/conformance/invariant-5.test.ts
    - development-artifacts/patch-steward-m6-3.1-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: the hosted publish job must write evidence under exactly the policy the gate job used. The policy revision is the git
    tree id of `.github/patch-steward/` on the default branch, so publish re-reads that immutable tree by id instead of the current
    branch head: GET /repos/{o}/{r}/git/trees/<tree id>?recursive=1 (the returned tree sha must equal the id), then the
    `policy.yml` blob; validated and resolved exactly as the existing GitHub policy source does. The commit and ref recorded at the
    gate's load are passed in and copied into the revision.

    Existing code (packages/core/src/policy/loader.ts, read it first):
    - private `async function loadFromGitHub(source: GitHubPolicySource)`: readBranchHead -> readDirectoryEntries(client,
      repository, '.github', commit) -> find entry 'patch-steward' (dir) -> treeId = its sha -> then the TREE PART: `const
      treeResult = await readGitTree(client, repository, treeId, true);` ... tree.sha check (github.malformed-response),
      truncated (policy-source.tree-truncated), find 'policy.yml' (policy-source.not-published), regular-file check
      (policy-source.entry-not-regular), size check (policy-source.blob-too-large), readGitBlob, validatePolicyBytes,
      resolvePolicy, dockerfile check (dockerfileUndeclaredReference) -> `return ok({ revision: { kind: 'git-tree', id: treeId,
      commit, ref: branch }, policy: resolved, authoritative: true })`.
    - exported types: LoadedPolicy, PolicyRevision, GitHubPolicyLoadFailureCode, GitHubPolicySource; `loadPolicy` overloads.
    - '../github/client.js': type GitHubClient, githubFailure(code, message). '../github/reader.js': type GitHubRepositoryRef,
      readGitTree, readGitBlob.

    Required change (exact names; export nothing else new):
    - Move the TREE PART into a private helper `async function loadFromGitHubTree(client: GitHubClient, repository:
      GitHubRepositoryRef, treeId: string, commit: string, ref: string): Promise<Result<LoadedPolicy,
      GitHubPolicyLoadFailureCode>>` with identical checks, codes, and messages, returning revision { kind: 'git-tree', id: treeId,
      commit, ref }. loadFromGitHub calls it with (client, repository, treeId, commit, branch) and keeps its own head and
      directory steps unchanged. Behavior of loadPolicy must not change in any way.
    - Add:
        export interface GitHubPolicyRevisionSource {
          readonly client: GitHubClient;
          readonly repository: GitHubRepositoryRef;
          readonly treeId: string;
          readonly commit: string;
          readonly ref: string;
        }
        export async function loadPolicyRevision(source: GitHubPolicyRevisionSource):
          Promise<Result<LoadedPolicy, GitHubPolicyLoadFailureCode>>;
      Before any request: treeId and commit must match /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/ and ref must be 1..255 characters with
      every char code in 33..126; otherwise return githubFailure('github.invalid-request', 'The policy revision reference is not
      valid.') with no request. Then return loadFromGitHubTree(client, repository, treeId, commit, ref). Exactly 2 requests on
      success (the recursive tree read, then the blob read).
    - loader.ts is already exported from the package root, so both new names appear at the root now: extend
      packages/core/src/conformance/invariant-5.test.ts in this same step (see actions). Both names are unique across
      packages/core/src and packages/cli/src (verified at decomposition).

    Test conventions: plain it(...) titles exactly as listed; a synthetic fake fetch keyed by URL pathname (see the helpers at the
    top of packages/core/src/policy/loader-github.test.ts for the response shapes: tree { sha, truncated, tree: [{ path, mode,
    type, sha, size }] }, blob { sha, size, encoding: 'base64', content }). Policy bytes: the repo file
    fixtures/policies/valid/minimal-no-llm.yml read with fs and new URL('../../../../fixtures/policies/valid/minimal-no-llm.yml',
    import.meta.url). Client: createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 20, retriesPerRequest: 0 }),
    fetch }) from '../github/client.js' and '../github/budget.js'. No temp files, no child processes, no network.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers (step, phase, or brief rule ids) in
    code, comments, or test titles. Never write raw control, bidi, or zero-width characters (the existing '\u0000' escapes in
    invariant-5.test.ts are escape text; keep them as escapes). Do not edit packages/core/src/index.ts.
- actions: |
    1. Refactor packages/core/src/policy/loader.ts and add GitHubPolicyRevisionSource and loadPolicyRevision per context.
    2. Create packages/core/src/policy/loader-revision.test.ts (describe 'policy load by revision'), repository { owner: 'octo',
       name: 'demo' }, TREE = 'b'.repeat(40), BLOB = 'c'.repeat(40), COMMIT = 'a'.repeat(40); record every fetch URL. Titles:
       - 'a policy loads from its recorded tree id': tree lists policy.yml (mode '100644', type 'blob', sha BLOB, size = byte
         length) and the blob returns the minimal-no-llm bytes base64 -> ok; revision equals { kind: 'git-tree', id: TREE, commit:
         COMMIT, ref: 'main' }; authoritative true; exactly 2 fetch calls with pathname+search
         '/repos/octo/demo/git/trees/' + TREE + '?recursive=1' then '/repos/octo/demo/git/blobs/' + BLOB.
       - 'a tree answer with another id is malformed': tree response sha 'd'.repeat(40) -> failure.code
         'github.malformed-response'.
       - 'a truncated policy tree is refused': truncated true -> 'policy-source.tree-truncated'.
       - 'an invalid tree id, commit, or ref sends nothing': treeId 'x'; commit 'y'; ref '' ; ref 'a b' -> each
         'github.invalid-request' and 0 fetch calls in total.
       - 'an invalid policy at the recorded tree is policy-invalid': blob bytes 'version: 1\n' (tree size 11) -> ok false and
         failure.cause 'policy-invalid'.
       - 'the published policy source still loads by branch': loadPolicy({ kind: 'github', client, repository, branch: 'main' })
         with routes for '/repos/octo/demo/git/ref/heads/main' ({ ref: 'refs/heads/main', object: { sha: COMMIT, type: 'commit' }
         }), '/repos/octo/demo/contents/.github' ([{ name: 'patch-steward', path: '.github/patch-steward', sha: TREE, type: 'dir',
         size: 0 }]), the tree, and the blob -> ok with revision { kind: 'git-tree', id: TREE, commit: COMMIT, ref: 'main' }.
    3. Edit packages/core/src/conformance/invariant-5.test.ts:
       - In test 'invariant 5: every exported load, validate, and resolve function rejects invalid input': add 'loadPolicyRevision'
         right after 'loadPolicy' in the expected sorted names; push into `results` the value of
         `await core.loadPolicyRevision({ client: core.createGitHubClient({ token: null, budget: core.createGitHubBudget({
         requests: 1, retriesPerRequest: 0 }), fetch: async () => { throw new Error('no network'); } }), repository: { owner: 'o',
         name: 'r' }, treeId: 'x', commit: 'a'.repeat(40), ref: 'main' })`.
       - In test 'invariant 5: every exported load, validate, resolve, parse, capture, and check function rejects invalid input':
         add 'loadPolicyRevision' right after 'loadPolicy' in the expected list, and add
         `expectResultRejection(<the same call>, 'github.invalid-request');` next to the other load rejections.
       Change nothing else in that file.
    4. Run: pnpm exec prettier --write packages/core/src/policy/loader.ts packages/core/src/policy/loader-revision.test.ts packages/core/src/conformance/invariant-5.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/policy packages/core/src/conformance/invariant-5.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.1.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.1.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['a policy loads from its recorded tree id','a tree answer with another id is malformed','a truncated policy tree is refused','an invalid tree id, commit, or ref sends nothing','an invalid policy at the recorded tree is policy-invalid','the published policy source still loads by branch','invariant 5: every exported load, validate, and resolve function rejects invalid input','invariant 5: every exported load, validate, resolve, parse, capture, and check function rejects invalid input'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. node -e "const s=require('fs').readFileSync('packages/core/src/conformance/invariant-5.test.ts','utf8');const n=(s.match(/'loadPolicyRevision'/g)||[]).length;console.log(n>=2?'listed':'missing')"
       -> prints exactly: listed
    4. git diff --quiet 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/policy/loader-github.test.ts packages/core/src/policy/loader-github.fixture.test.ts packages/core/src/policy/loader.test.ts; echo "unchanged $?"
       -> prints exactly: unchanged 0
    5. pnpm vitest run -> exit 0
    6. pnpm typecheck -> exit 0
    7. pnpm exec eslint packages/core/src/policy/loader.ts packages/core/src/policy/loader-revision.test.ts packages/core/src/conformance/invariant-5.test.ts -> exit 0
    8. pnpm exec prettier --check packages/core/src/policy/loader.ts packages/core/src/policy/loader-revision.test.ts packages/core/src/conformance/invariant-5.test.ts -> exit 0
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/policy/loader.ts packages/core/src/policy/loader-revision.test.ts packages/core/src/conformance/invariant-5.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (restores loader.ts and invariant-5.test.ts, removes the new test file).
