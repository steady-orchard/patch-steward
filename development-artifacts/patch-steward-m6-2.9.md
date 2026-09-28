# Step 2.9

- id: 2.9
- depends_on: [2.2]
- route: mechanical
- objective: Add the evidence git store commit to core: one append-only Git Data API commit per run on the store branch (blobs, tree, commit, compare check, non-force ref update) with bounded non-fast-forward rebuilds, plus the store location, commit message, and hosted evidence location helpers.
- files_in_scope:
    - packages/core/src/evidence/git-store.ts
    - packages/core/src/evidence/git-store.test.ts
    - development-artifacts/patch-steward-m6-2.9-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Hosted runs store evidence on a git branch through the GitHub Git Data API instead of a local directory. The store is either
    an orphan branch of the screened (target) repository or a branch of a separate store repository; in both, every path is
    prefixed '<owner>/<repo>/' of the TARGET repository. A run adds files under directories such as
    runs/pr-12/36081628326-1 (the run directory: run.json, submission.json, ..., logs/steward.txt, manifest.json),
    runs/pr-12/supersessions (a supersession record), and metrics/2026-09 (a metrics file). The commit is the commit point; it must
    only ADD paths (append-only); a concurrent writer causes HTTP 422 on the ref update, handled by rebuilding on the new tip at
    most writeRetries times. Read-back after the update is a separate later step (store-readback.ts); this step ends at the ref
    update.

    Existing code to use:
    - '../github/client.js': type GitHubClient with getJson(path, schema, query?) (404 -> failure code 'github.not-found'),
      type GitHubFailureCode.
    - '../github/reader.js': readBranchHead(client, repository, branch) -> Result<commit sha, GitHubFailureCode> (404 when the branch
      is absent); repositoryRefFromFullName(fullName) -> { owner, name } | null; type GitHubRepositoryRef.
    - '../github/schemas.js': githubRefResponseSchema (z.object({ ref, object: { sha, type } })).
    - '../github/writer.js' (merged before this step): type GitHubWriter (send(request, schema), sendNoContent(request)), type
      GitHubWriteFailureCode (includes 'github.write-conflict' for HTTP 422), githubRepositoryPath(repository) ->
      '/repos/<enc owner>/<enc name>', githubBranchRefPath(repository, branch) -> '<repo path>/git/refs/heads/<enc branch>'. The
      writer only allows, for its store scope: POST <repo>/git/blobs {content, encoding: 'base64'}; POST <repo>/git/trees {tree} or
      {base_tree, tree} with entries {path, mode: '100644', type: 'blob', sha}; POST <repo>/git/commits {message, tree, parents (at
      most 1)}; POST <repo>/git/refs {ref: 'refs/heads/<branch>', sha}; PATCH <branch ref path> {sha, force: false}.
    - './blob-id.js': gitBlobId(bytes) -> 40-hex git blob id.
    - './store-checks.js': evidenceCompareSchema; verifyAppendOnlyCompare(compare, expectedPaths) -> Result<sorted paths,
      'evidence.store-not-append-only'>; types ReadBackMode ('exact' | 'contains'), AppendOnlyFailureCode, ReadBackFailureCode
      ('evidence.readback-mismatch').
    - './layout.js': repositoryStorePath(repository, storePath) -> Result<'<owner>/<name>/<storePath>', 'evidence.layout-invalid'>;
      runDirectoryName(runId, runAttempt) -> '<runId>-<runAttempt>'; type EvidenceLayoutFailureCode.
    - '../report/escape.js': repositoryWebUrl(repository, segments) -> 'https://github.com/<repo>/<encoded segments joined by />'.
    - '../policy/schema.js': type ResolvedPolicy (ResolvedPolicy['evidence']['store'] is { type: 'orphan-branch', branch } |
      { type: 'repository', branch, repository }).
    - '../policy/bounds.js': EVIDENCE_RUN_FILES_MAX (4096), EVIDENCE_CONFLICT_WAIT_STEP_MS (1000), EVIDENCE_CONFLICT_WAIT_MAX_MS
      (10000). '../result.js': ok, err, type Result. '../vocabulary.js': type SubmissionType.

    Required API (exact names; export nothing else):
      export const githubGitObjectResponseSchema = z.object({ sha: OBJECT_ID });
      export const githubGitCommitResponseSchema = z.object({
        sha: OBJECT_ID,
        tree: z.object({ sha: OBJECT_ID }),
        parents: z.array(z.object({ sha: OBJECT_ID })),
      });
        // OBJECT_ID = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/)
      export interface EvidenceStoreLocation { readonly repository: GitHubRepositoryRef; readonly branch: string }
      export interface EvidenceStoreFile { readonly path: string; readonly bytes: Uint8Array }
      export interface EvidenceStoreGroup {
        readonly directory: string;
        readonly mode: ReadBackMode;
        readonly files: readonly EvidenceStoreFile[];
      }
      export interface EvidenceCommitInput {
        readonly store: EvidenceStoreLocation;
        readonly targetRepository: string;
        readonly subject: { readonly type: SubmissionType; readonly number: number };
        readonly runId: number;
        readonly runAttempt: number;
        readonly groups: readonly EvidenceStoreGroup[];
        readonly maxBytes: number;
        readonly writeRetries: number;
      }
      export interface EvidenceCommitDeps {
        readonly client: GitHubClient;
        readonly writer: GitHubWriter;
        readonly sleep?: (ms: number) => Promise<void>;
      }
      export interface EvidenceCommitReceipt {
        readonly commit: string;
        readonly tree: string;
        readonly parent: string | null;
        readonly rebuilds: number;
        readonly paths: readonly string[];
      }
      export type EvidenceStoreConflictFailureCode = 'evidence.store-conflict';
      export type EvidenceStoreFailureCode =
        | GitHubWriteFailureCode | AppendOnlyFailureCode | ReadBackFailureCode | EvidenceLayoutFailureCode
        | EvidenceStoreConflictFailureCode | 'evidence.too-large' | 'evidence.too-many-files';
      export function evidenceStoreLocation(store: ResolvedPolicy['evidence']['store'], targetRepository: string):
        Result<EvidenceStoreLocation, EvidenceLayoutFailureCode>;
      export function evidenceCommitMessage(targetRepository: string, subject: { readonly type: SubmissionType; readonly number:
        number }, runId: number, runAttempt: number): string;
      export function hostedEvidenceLocation(store: EvidenceStoreLocation, targetRepository: string, storePath: string): string;
      export async function commitEvidence(input: EvidenceCommitInput, deps: EvidenceCommitDeps):
        Promise<Result<EvidenceCommitReceipt, EvidenceStoreFailureCode>>;

    Helper rules:
    - evidenceStoreLocation: orphan-branch -> repository = repositoryRefFromFullName(targetRepository); repository ->
      repositoryRefFromFullName(store.repository); branch = store.branch; a null repository -> err('evidence.layout-invalid',
      'steward-defect', 'The evidence store location is invalid.').
    - evidenceCommitMessage -> 'evidence: ' + targetRepository + ' ' + (type === 'pull_request' ? 'pr' : 'issue') + '-' + number +
      ' run ' + runId + '-' + runAttempt (no submission text).
    - hostedEvidenceLocation -> repositoryWebUrl(owner + '/' + name of store.repository, ['tree', ...store.branch.split('/'),
      ...targetRepository.split('/'), ...storePath.split('/')]).

    commitEvidence rules, in order (failures are returned immediately unless stated):
    A. Validation, before any request. Layout failures are err('evidence.layout-invalid', 'steward-defect', 'The evidence commit
       layout is invalid.', [one detail { code: 'evidence.layout-invalid', path: <token>, message: same, line: null, column: null }]):
       - store.branch: 1..255 chars, no char code below 33 or 127, none of ~ ^ : ? * [ and backslash, no '..', no '//', not starting
         with '-' or '/', not ending with '/' or '.' -> token 'branch'; store owner and name must satisfy
         repositoryRefFromFullName(owner + '/' + name) !== null -> 'store'.
       - repositoryStorePath(targetRepository, 'runs') ok -> else 'repository'.
       - runId and runAttempt positive safe integers -> 'run'; subject.number positive safe integer -> 'subject'.
       - writeRetries integer 0..10 -> 'retries'; maxBytes positive safe integer -> 'max-bytes'.
       - groups non-empty with distinct directories -> 'groups'; each directory matches
         /^(runs\/(pr|issue)-[1-9][0-9]{0,9}\/([1-9][0-9]{0,19}-[1-9][0-9]{0,9}|supersessions)|metrics\/[0-9]{4}-(0[1-9]|1[0-2]))$/
         -> 'directory'; a runs/ directory's '<pr|issue>-<n>' must equal the subject's -> 'subject'; a run directory
         (runs/<kind>-<n>/<digits>-<digits>) must be named runDirectoryName(runId, runAttempt) -> 'run' and use mode 'exact'; every
         other directory uses mode 'contains' -> 'mode'; each group has at least 1 file -> 'files'; every file path matches
         /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(\/[A-Za-z0-9][A-Za-z0-9._-]{0,127})?$/ and is distinct within its group -> 'file'.
       - total file count > EVIDENCE_RUN_FILES_MAX + 2 -> err('evidence.too-many-files', 'budget-exhausted', 'The evidence has too
         many files.'); total bytes > maxBytes -> err('evidence.too-large', 'budget-exhausted', 'The evidence exceeds
         limits.evidence.run_bytes.').
    B. Entries: for each group in order and each file in order: fullPath = repositoryStorePath(targetRepository, directory + '/' +
       file.path) value, blobId = gitBlobId(file.bytes). paths = sorted fullPaths. repo = githubRepositoryPath(store.repository).
       message = evidenceCommitMessage(...). rebuilds = 0; blobs created = false.
    C. Loop:
       1. tip: readBranchHead(client, store.repository, store.branch); failure 'github.not-found' -> tip null; other failure ->
          return it. When tip is not null: GET repo + '/git/commits/' + tip with githubGitCommitResponseSchema -> tipTree =
          value.tree.sha.
       2. First pass only: for every entry, writer.send({ method: 'POST', path: repo + '/git/blobs', body: { content:
          Buffer.from(bytes).toString('base64'), encoding: 'base64' } }, githubGitObjectResponseSchema); a returned sha !== blobId
          -> err('evidence.readback-mismatch', 'infrastructure', 'The evidence store returned an unexpected object id.', [detail path
          'blob-create']). Blobs are never re-posted on rebuilds.
       3. tree: writer.send({ method: 'POST', path: repo + '/git/trees', body: tip ? { base_tree: tipTree, tree } : { tree } },
          githubGitObjectResponseSchema) with tree = entries in order as { path: fullPath, mode: '100644', type: 'blob', sha: blobId }.
       4. commit: writer.send({ method: 'POST', path: repo + '/git/commits', body: { message, tree: treeSha, parents: tip ? [tip] :
          [] } }, githubGitCommitResponseSchema); value.tree.sha !== treeSha or parent shas !== the sent parents ->
          err('evidence.readback-mismatch', 'infrastructure', same message, [detail path 'commit-create']).
       5. When tip is not null: GET repo + '/compare/' + tip + '...' + commitSha with evidenceCompareSchema, then
          verifyAppendOnlyCompare(compare, paths); its failure is returned (no ref update, no rebuild). A root commit (tip null) has
          nothing to compare.
       6. update: tip not null -> writer.send({ method: 'PATCH', path: githubBranchRefPath(store.repository, store.branch), body:
          { sha: commitSha, force: false } }, githubRefResponseSchema); tip null -> writer.send({ method: 'POST', path: repo +
          '/git/refs', body: { ref: 'refs/heads/' + store.branch, sha: commitSha } }, githubRefResponseSchema).
          ok with value.object.sha === commitSha -> return ok({ commit: commitSha, tree: treeSha, parent: tip, rebuilds, paths });
          ok with another sha -> err('evidence.readback-mismatch', 'infrastructure', same message, [detail path 'ref-update']).
          failure code 'github.write-conflict' (non-fast-forward, or the branch was created concurrently): if rebuilds <
          writeRetries: rebuilds += 1; await sleep(Math.min(EVIDENCE_CONFLICT_WAIT_STEP_MS * rebuilds,
          EVIDENCE_CONFLICT_WAIT_MAX_MS)); continue the loop at C1; else return err('evidence.store-conflict', 'infrastructure',
          'The evidence store stayed in conflict after the allowed retries.'). Any other failure -> return it.
    D. The function never throws (wrap in try/catch returning err('evidence.layout-invalid', 'steward-defect', 'The evidence commit
       layout is invalid.', [detail path 'exception'])). Messages never contain file content, response text, or tokens.
    Default sleep: setTimeout promise. The client and the writer share one budget (the caller's run budget).

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig with
    noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters; Prettier (single quotes, semicolons,
    trailing commas, printWidth 132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in
    code or titles. Tests are pure: no temp files, no child processes, no real network (inject fetch and sleep). Do not edit
    packages/core/src/index.ts. Export names are unique across packages; none starts with load, validate, resolve, parse, capture,
    or check.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const s=require('fs').readFileSync('packages/core/src/github/writer.ts','utf8');const need=['export function createGitHubWriter','export function githubRepositoryPath','export function githubBranchRefPath','export type GitHubWriteFailureCode'];const miss=need.filter(n=>!s.includes(n));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. If the file is missing or anything is MISSING, STOP and report status missing-base with the output;
       do not fetch, merge, or improvise.
    2. Create packages/core/src/evidence/git-store.ts per context.
    3. Create packages/core/src/evidence/git-store.test.ts (describe 'evidence git store commit'). Build a reusable in-file helper
       fakeStore(options) returning { fetch, calls, sleeps, sleep } where fetch is ONE fake used by both createGitHubClient (token
       'test-token-' + 's'.repeat(12)) and createGitHubWriter (same token, scope { kind: 'installation', store: STORE }) sharing
       one createGitHubBudget({ requests: 100, retriesPerRequest: 0 }); calls records { method, pathname + search, body parsed from
       JSON or null }. It answers by method and path: GET .../git/ref/heads/steward-evidence -> the current tip ({ ref, object: {
       sha, type: 'commit' } }) or 404 when absent; GET .../git/commits/<sha> -> { sha, tree: { sha: <tree of that tip> }, parents:
       [] }; POST .../git/blobs -> 201 { sha: gitBlobId(Buffer.from(body.content, 'base64')) } (or a forced wrong sha); POST
       .../git/trees -> 201 { sha: <next tree id> }; POST .../git/commits -> 201 { sha: <next commit id>, tree: { sha: body.tree },
       parents: body.parents.map((sha) => ({ sha })) }; GET .../compare/<a>...<b> -> 200 { status: 'ahead', ahead_by: 1, behind_by:
       0, files: <the posted tree paths, each status 'added'> } (or an override); PATCH .../git/refs/heads/steward-evidence and
       POST .../git/refs -> a queue of outcomes (200/201 { ref, object: { sha: body.sha, type: 'commit' } } moving the tip, or 422
       { message: 'Update is not a fast forward' } optionally moving the tip to another commit to simulate a concurrent writer).
       Use distinct 40-hex ids (for example '1'.repeat(40) for the first tip, '2'.repeat(40) for its tree, and counters for new
       objects). Standard input: STORE = { repository: { owner: 'octo', name: 'demo' }, branch: 'steward-evidence' },
       targetRepository 'octo/demo', subject { type: 'pull_request', number: 12 }, runId 36081628326, runAttempt 1, maxBytes 1048576,
       writeRetries 3, groups [{ directory: 'runs/pr-12/36081628326-1', mode: 'exact', files: run.json, logs/steward.txt,
       manifest.json with small byte contents }, { directory: 'metrics/2026-09', mode: 'contains', files: [36081628326-1.json] }].
       Use plain it(...) with EXACTLY these titles:
       - 'evidence commits add blobs, a tree, a commit, and a ref update': request sequence exactly GET ref, GET commits/<tip>, POST
         blobs x4, POST trees, POST commits, GET compare/<tip>...<new>, PATCH ref; tree body has base_tree = the tip's tree and 4
         entries with full paths 'octo/demo/runs/pr-12/36081628326-1/run.json' (etc.), mode '100644', type 'blob', sha =
         gitBlobId; commit body { message: 'evidence: octo/demo pr-12 run 36081628326-1', tree, parents: [tip] }; PATCH body { sha:
         new commit, force: false }; receipt { commit, parent: tip, rebuilds: 0, paths: the 4 full paths sorted }.
       - 'an absent branch gets a root commit': ref answers 404 -> no GET commits, tree body without base_tree, commit parents [],
         no compare request, POST '/repos/octo/demo/git/refs' with body { ref: 'refs/heads/steward-evidence', sha: new commit };
         receipt parent null.
       - 'a non-fast-forward update rebuilds on the new tip': first PATCH answers 422 and moves the tip to another commit; the loop
         re-reads the ref, builds a tree with base_tree = the new tip's tree and a commit with parents [new tip], compares new
         tip...second commit, and the second PATCH succeeds; exactly 4 blob POSTs overall; sleeps [1000]; rebuilds 1.
       - 'exhausted rebuilds end in a store conflict': writeRetries 2 and every PATCH answers 422 -> failure code
         'evidence.store-conflict', outcome 'inconclusive'; exactly 3 PATCH requests; sleeps [1000, 2000].
       - 'a compare that is not append-only stops before the update': compare answers one file with status 'modified' -> failure
         'evidence.store-not-append-only'; no PATCH or POST refs request.
       - 'a created blob with another id is a mismatch': blob POST answers sha 'a'.repeat(40) -> failure 'evidence.readback-mismatch'
         with details[0].path 'blob-create'; no tree request.
       - 'the commit layout is validated before any request': each of these fails 'evidence.layout-invalid' with 0 fetch calls:
         directory 'runs/pr-12/../x'; directory 'runs/pr-13/36081628326-1'; run directory 'runs/pr-12/36081628326-2'; file path
         '../run.json'; file path 'a/b/c.json'; a duplicate file path; mode 'contains' on the run directory; mode 'exact' on
         'metrics/2026-09'; directory 'metrics/2026-13'; groups []; branch 'bad..branch'; targetRepository 'not-a-repository'.
       - 'evidence over the byte or file limit is rejected': maxBytes 10 -> 'evidence.too-large' with cause 'budget-exhausted';
         4099 files in the metrics group -> 'evidence.too-many-files'; both with 0 fetch calls.
       - 'the commit message carries no submission text': evidenceCommitMessage('octo/demo', { type: 'issue', number: 7 }, 5, 2)
         === 'evidence: octo/demo issue-7 run 5-2'.
       - 'the store location follows the trusted policy': evidenceStoreLocation({ type: 'orphan-branch', branch:
         'steward-evidence' }, 'octo/demo') -> ok { repository: { owner: 'octo', name: 'demo' }, branch: 'steward-evidence' };
         { type: 'repository', branch: 'main', repository: 'octo/evidence' } -> ok { repository: { owner: 'octo', name: 'evidence'
         }, branch: 'main' }; orphan-branch with targetRepository 'x' -> 'evidence.layout-invalid'.
       - 'hosted evidence locations point at the store tree': hostedEvidenceLocation({ repository: { owner: 'octo', name:
         'evidence' }, branch: 'steward-evidence' }, 'octo/demo', 'runs/pr-12/36081628326-1') ===
         'https://github.com/octo/evidence/tree/steward-evidence/octo/demo/runs/pr-12/36081628326-1'.
       - 'store requests count against the run budget': a shared budget { requests: 5, retriesPerRequest: 0 } -> failure
         'github.budget-exhausted' and exactly 5 fetch calls.
    4. Run: pnpm exec prettier --write packages/core/src/evidence/git-store.ts packages/core/src/evidence/git-store.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/evidence/git-store.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.9.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p2-2.9.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['evidence commits add blobs, a tree, a commit, and a ref update','an absent branch gets a root commit','a non-fast-forward update rebuilds on the new tip','exhausted rebuilds end in a store conflict','a compare that is not append-only stops before the update','a created blob with another id is a mismatch','the commit layout is validated before any request','evidence over the byte or file limit is rejected','the commit message carries no submission text','the store location follows the trusted policy','hosted evidence locations point at the store tree','store requests count against the run budget'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/evidence/git-store.ts packages/core/src/evidence/git-store.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/evidence/git-store.ts packages/core/src/evidence/git-store.test.ts -> exit 0
    7. cat packages/core/src/evidence/git-store.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
       -> prints 0 (grep exit status 1 is expected)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/evidence/git-store.ts packages/core/src/evidence/git-store.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
