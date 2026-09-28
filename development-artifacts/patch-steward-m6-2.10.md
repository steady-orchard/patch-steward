# Step 2.10

- id: 2.10
- depends_on: [2.9]
- route: mechanical
- objective: Add the evidence store read-back to core (verify after the ref update that the branch tip contains the new commit and that every committed file has the locally computed git blob id) and the combined write that commits and then reads back before anything else is published.
- files_in_scope:
    - packages/core/src/evidence/store-readback.ts
    - packages/core/src/evidence/store-readback.test.ts
    - development-artifacts/patch-steward-m6-2.10-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    After the evidence commit (commitEvidence in packages/core/src/evidence/git-store.ts, merged before this step) updates the store
    branch, the publisher must read back, before any other publication step: the branch tip equals the new commit, or
    compare/<new commit>...<tip> reports 'ahead' or 'identical' with behind_by 0 (other runs may have appended since); and for each
    committed group the committed tree lists the expected files whose blob ids equal the locally computed git blob ids, so no blob
    is downloaded. A subtree is read in one request with the commit-and-path form GET
    /repos/{s}/git/trees/<commit>:<owner>/<repo>/<directory> (recursive=1 for a run directory, which has subdirectories logs/ and
    findings/); the response is { sha, url, tree: [{ path (relative to the subtree), mode, type, sha, size?, url }], truncated }.
    This form was verified against GitHub (GET .../git/trees/<commit>:.github?recursive=1 answers the .github subtree).

    Existing code to use:
    - './git-store.js': commitEvidence(input, deps) -> Result<EvidenceCommitReceipt ({ commit, tree, parent, rebuilds, paths }),
      EvidenceStoreFailureCode>; types EvidenceCommitInput ({ store, targetRepository, subject, runId, runAttempt, groups,
      maxBytes, writeRetries }), EvidenceCommitDeps ({ client, writer, sleep? }), EvidenceCommitReceipt, EvidenceStoreGroup
      ({ directory, mode: 'exact' | 'contains', files: { path, bytes }[] }), EvidenceStoreLocation ({ repository: { owner, name },
      branch }), EvidenceStoreFailureCode (a superset of GitHubFailureCode, ReadBackFailureCode, and 'evidence.layout-invalid').
      Read git-store.ts and git-store.test.ts first.
    - '../github/client.js': type GitHubClient (getJson), type GitHubFailureCode. '../github/reader.js': readBranchHead(client,
      repository, branch). '../github/schemas.js': githubTreeResponseSchema ({ sha, truncated, tree: [{ path, mode, type, sha,
      size? }] }). '../github/writer.js': githubRepositoryPath(repository).
    - './store-checks.js': evidenceCompareSchema; readBackTipAccepted(compare) (true when status is 'ahead' or 'identical' and
      behind_by is 0); verifyReadBackTree(entries: { path, type, sha, mode }[], expected: { path, blobId }[], mode) ->
      Result<sorted expected, 'evidence.readback-mismatch'> (exact: every blob expected and no extra blob; contains: expected blobs
      present, others ignored); type ReadBackFailureCode.
    - './blob-id.js': gitBlobId(bytes). './layout.js': repositoryStorePath(repository, storePath) -> Result<'<owner>/<name>/...'>,
      type EvidenceLayoutFailureCode. '../result.js': ok, err, type Result.

    Required API (exact names; export nothing else):
      export interface EvidenceReadBackInput {
        readonly store: EvidenceStoreLocation;
        readonly targetRepository: string;
        readonly groups: readonly EvidenceStoreGroup[];
      }
      export type EvidenceReadBackFailureCode = GitHubFailureCode | ReadBackFailureCode | EvidenceLayoutFailureCode;
      export interface EvidenceReadBackResult { readonly head: string; readonly files: number }
      export async function readBackEvidence(client: GitHubClient, input: EvidenceReadBackInput, commit: string):
        Promise<Result<EvidenceReadBackResult, EvidenceReadBackFailureCode>>;
      export interface EvidenceWriteReceipt extends EvidenceCommitReceipt { readonly head: string }
      export async function writeEvidenceCommit(input: EvidenceCommitInput, deps: EvidenceCommitDeps):
        Promise<Result<EvidenceWriteReceipt, EvidenceStoreFailureCode>>;

    readBackEvidence rules (in order; mismatches are err('evidence.readback-mismatch', 'infrastructure', 'The evidence read-back
    does not match the committed files.', [one detail { code: 'evidence.readback-mismatch', path: <token>, message: same, line:
    null, column: null }]); other failures are returned unchanged):
    1. commit must match /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/ -> else mismatch token 'commit'.
    2. head = readBranchHead(client, store.repository, store.branch) (failure returned).
    3. head !== commit -> GET repo + '/compare/' + commit + '...' + head with evidenceCompareSchema (failure returned);
       readBackTipAccepted false -> mismatch token 'tip'.
    4. For each group in order: prefix = repositoryStorePath(targetRepository, group.directory) (failure returned); GET repo +
       '/git/trees/' + commit + ':' + prefix.split('/').map(encodeURIComponent).join('/') with githubTreeResponseSchema and query
       { recursive: '1' } only when group.mode is 'exact' (no query for 'contains'); failure returned; truncated true -> mismatch
       token 'truncated'; verifyReadBackTree(tree entries mapped to { path, type, sha, mode }, group.files mapped to { path,
       blobId: gitBlobId(bytes) }, group.mode) -> failure returned.
    5. ok({ head, files: total number of files across groups }).
    repo = githubRepositoryPath(store.repository). The function never throws (try/catch -> mismatch token 'exception').
    writeEvidenceCommit: commitEvidence(input, deps) (failure returned; no read-back after a failed commit); then
    readBackEvidence(deps.client, { store: input.store, targetRepository: input.targetRepository, groups: input.groups },
    receipt.commit) (failure returned); ok({ ...receipt, head }).

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig with
    noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters; Prettier (single quotes, semicolons,
    trailing commas, printWidth 132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in
    code or titles. Tests are pure: no temp files, no child processes, no real network. Do not edit packages/core/src/index.ts or
    git-store.ts. Export names are unique across packages; none starts with load, validate, resolve, parse, capture, or check.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const s=require('fs').readFileSync('packages/core/src/evidence/git-store.ts','utf8');const need=['export async function commitEvidence','export interface EvidenceCommitInput','export interface EvidenceStoreGroup','export type EvidenceStoreFailureCode'];const miss=need.filter(n=>!s.includes(n));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. If the file is missing or anything is MISSING, STOP and report status missing-base with the output;
       do not fetch, merge, or improvise.
    2. Create packages/core/src/evidence/store-readback.ts per context.
    3. Create packages/core/src/evidence/store-readback.test.ts (describe 'evidence store read-back'). Copy the fakeStore helper and
       the standard input from packages/core/src/evidence/git-store.test.ts (do not import from a test file) and extend the fake:
       GET .../git/trees/<commit>:<path> answers { sha, url, truncated: false, tree } where tree lists the committed files of that
       directory relative to it (for the run directory also a { path: 'logs', mode: '040000', type: 'tree', sha } entry), each
       blob { path, mode: '100644', type: 'blob', sha: gitBlobId(bytes) }; overrides allow a moved tip, a compare answer, a changed
       blob id, a missing or extra blob, and truncated true. Use plain it(...) with EXACTLY these titles:
       - 'a committed run reads back with matching blob ids': readBackEvidence(client, input, commit) called directly with the
         fake's tip already at commit and its trees holding the standard files -> ok { head: commit, files: 4 }; the recorded
         requests are exactly GET '/repos/octo/demo/git/ref/heads/steward-evidence', GET
         '/repos/octo/demo/git/trees/<commit>:octo/demo/runs/pr-12/36081628326-1?recursive=1', and GET
         '/repos/octo/demo/git/trees/<commit>:octo/demo/metrics/2026-09' (no query), in that order; no compare request.
       - 'a tip that moved ahead still reads back': the ref answers another commit and compare <commit>...<head> answers { status:
         'ahead', ahead_by: 1, behind_by: 0, files: [] } -> ok with that head.
       - 'a diverged tip fails the read-back': compare answers { status: 'diverged', ahead_by: 1, behind_by: 1, files: [] } ->
         'evidence.readback-mismatch' with details[0].path 'tip'.
       - 'a changed blob id fails the read-back': one run file's tree sha differs -> 'evidence.readback-mismatch' with
         details[0].path 'blob-id'.
       - 'a missing or extra run file fails the read-back': a missing run.json -> details[0].path 'missing'; an extra blob in the run
         directory -> details[0].path 'extra'; an extra blob in the metrics directory is accepted (contains mode).
       - 'a truncated tree read fails the read-back': truncated true -> details[0].path 'truncated'.
       - 'written evidence is read back after the ref update': writeEvidenceCommit -> ok with head === commit and rebuilds 0; in the
         recorded calls the PATCH ref request comes before the first tree read request, and the ref is read again after the PATCH.
       - 'a failed commit skips the read-back': a compare answering a 'modified' file -> writeEvidenceCommit fails
         'evidence.store-not-append-only' and no tree read request is recorded.
    4. Run: pnpm exec prettier --write packages/core/src/evidence/store-readback.ts packages/core/src/evidence/store-readback.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/evidence/store-readback.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.10.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p2-2.10.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['a committed run reads back with matching blob ids','a tip that moved ahead still reads back','a diverged tip fails the read-back','a changed blob id fails the read-back','a missing or extra run file fails the read-back','a truncated tree read fails the read-back','written evidence is read back after the ref update','a failed commit skips the read-back'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. git diff --quiet HEAD -- packages/core/src/evidence/git-store.ts packages/core/src/evidence/git-store.test.ts -> exit 0
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/evidence/store-readback.ts packages/core/src/evidence/store-readback.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/evidence/store-readback.ts packages/core/src/evidence/store-readback.test.ts -> exit 0
    8. cat packages/core/src/evidence/store-readback.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/evidence/store-readback.ts packages/core/src/evidence/store-readback.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
