# Step 2.5

- id: 2.5
- depends_on: []
- route: mechanical
- objective: Add the gate's bounded fallback read of the latest published run's snapshot hash and policy revision from the evidence store through the GitHub contents API, returning the deduplication fallback input.
- files_in_scope:
    - packages/core/src/evidence/fallback-read.ts
    - packages/core/src/evidence/fallback-read.test.ts
    - development-artifacts/patch-steward-m6-2.5-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    When no unexpired ownership artifact exists for a submission, the hosted gate deduplicates against the latest PUBLISHED run in
    the evidence store. The store is a git branch (of the target repository or of a separate store repository) whose tree holds
    <owner>/<repo>/runs/<pr|issue>-<n>/<run_id>-<run_attempt>/run.json for the screened (target) repository <owner>/<repo>. The
    read uses only GET requests through the existing client and must be bounded and fail closed: anything unexpected is
    'unavailable' (the caller then fails before commitment); only a clean 404 of the submission directory, or a directory without
    run directories, means 'none'.

    Existing code to use:
    - '../github/client.js': type GitHubClient with getJson<T>(path, schema, query?) -> Result<T, GitHubFailureCode> (paths must be
      already URL-encoded; it rejects bad paths with github.invalid-request; 404 -> failure code 'github.not-found').
    - '../github/reader.js': type GitHubRepositoryRef ({ owner, name }).
    - '../github/schemas.js': githubContentsEntrySchema (z.object({ name, path, sha, type: 'file'|'dir'|'symlink'|'submodule', size })).
    - './layout.js': repositoryStorePath(repository: string, storePath: string) -> Result<string, 'evidence.layout-invalid'>
      (returns '<owner>/<name>/<storePath>', validating the repository); latestRunDirectoryName(names) -> { name, runId,
      runAttempt } or null (picks the greatest (runId, runAttempt) among names matching <digits>-<digits>, ignoring others such as
      'supersessions').
    - '../records/run.js': runRecordSchema (strict zod of run.json; subject is a discriminated union on kind 'submission' with
      repository, type, number, snapshot_hash, or 'merge-group'; run_id is a positive integer or a local id string; run_attempt;
      policy_revision).
    - '../ownership/dedup.js': type DedupFallbackRead = { kind: 'published', runId, runAttempt, snapshotHash, policyRevision } |
      { kind: 'none' } | { kind: 'unavailable' }.
    - '../vocabulary.js': type SubmissionType ('issue' | 'pull_request').
    - '../policy/bounds.js': EVIDENCE_FALLBACK_ENTRIES_MAX (1000), EVIDENCE_FALLBACK_FILE_MAX_BYTES (1048576).

    Required API (exact names; export nothing else):
      export const githubContentsFileSchema = z.object({
        type: z.literal('file'),
        encoding: z.literal('base64'),
        size: z.int().min(0),
        content: z.string(),
      });
      export interface PublishedSnapshotQuery {
        readonly store: { readonly repository: GitHubRepositoryRef; readonly branch: string };
        readonly targetRepository: string;
        readonly subject: { readonly type: SubmissionType; readonly number: number };
      }
      export async function readPublishedSnapshot(client: GitHubClient, query: PublishedSnapshotQuery): Promise<DedupFallbackRead>;

    Rules (in order; the whole body is wrapped in try/catch returning { kind: 'unavailable' }):
    1. Validate: subject.number positive safe integer; store.branch 1..255 characters with no char code below 33 and no 127;
       store owner and name non-empty. Else unavailable. kind = 'pr' for 'pull_request', 'issue' for 'issue'.
       prefix = repositoryStorePath(query.targetRepository, `runs/${kind}-${number}`); failure -> unavailable.
       repo = '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(name) of the STORE repository; enc(p) =
       p.split('/').map(encodeURIComponent).join('/'); every request passes query { ref: store.branch }.
    2. GET repo + '/contents/' + enc(prefix) with schema z.union([z.array(githubContentsEntrySchema), z.object({})]).
       Failure code 'github.not-found' -> { kind: 'none' }; any other failure -> unavailable; a non-array value -> unavailable; an
       array with length >= EVIDENCE_FALLBACK_ENTRIES_MAX -> unavailable (the contents API returns at most 1000 entries, so a
       listing at the bound may be truncated).
    3. latestRunDirectoryName(names of entries whose type is 'dir'); null -> { kind: 'none' }.
    4. GET repo + '/contents/' + enc(prefix + '/' + latest.name + '/run.json') with githubContentsFileSchema; any failure
       (including not-found) -> unavailable.
    5. size > EVIDENCE_FALLBACK_FILE_MAX_BYTES -> unavailable; content with every '\n' and '\r' removed must match
       /^[A-Za-z0-9+/]*={0,2}$/ with length % 4 === 0, and Buffer.from(it, 'base64').length === size, else unavailable.
    6. new TextDecoder('utf-8', { fatal: true }).decode(bytes) -> JSON.parse -> runRecordSchema.safeParse; any failure ->
       unavailable.
    7. The record must have subject.kind 'submission' with repository === targetRepository, type === subject.type, number ===
       subject.number; typeof run_id === 'number' with run_id === latest.runId and run_attempt === latest.runAttempt; else
       unavailable.
    8. Return { kind: 'published', runId: record.run_id, runAttempt: record.run_attempt, snapshotHash:
       record.subject.snapshot_hash, policyRevision: record.policy_revision }.
    The function never throws and never returns response text.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig with
    noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters; Prettier (single quotes, semicolons,
    trailing commas, printWidth 132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in
    code or titles. Tests are pure: no temp files, no child processes, no real network. Do not edit packages/core/src/index.ts.
    Export names are unique across packages; none starts with load, validate, resolve, parse, capture, or check.
- actions: |
    1. Create packages/core/src/evidence/fallback-read.ts per context.
    2. Create packages/core/src/evidence/fallback-read.test.ts (describe 'published snapshot fallback read'). Build clients with
       createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }), fetch }) from
       '../github/client.js' and '../github/budget.js', where fetch is a recording fake that answers by the request URL. Query used
       throughout: store { repository: { owner: 'octo', name: 'evidence' }, branch: 'steward-evidence' }, targetRepository
       'octo/demo', subject { type: 'issue', number: 7 }. A valid run record: copy the validRun object from
       packages/core/src/records/run.test.ts and override run_id 12, run_attempt 2, subject { kind: 'submission', repository:
       'octo/demo', type: 'issue', number: 7, snapshot_hash: 'sha256:' + '5'.repeat(64) }, policy_revision 'b'.repeat(40); check it
       with runRecordSchema.parse in the helper. A file response is { name: 'run.json', path: '<path>', sha: 'c'.repeat(40), size:
       bytes.length, type: 'file', encoding: 'base64', content: base64 with a '\n' inserted every 60 characters }. Directory entries
       are { name, path, sha: 'd'.repeat(40), type: 'dir', size: 0 }. Use plain it(...) with EXACTLY these titles:
       - 'no published run directory means no fallback': listing answered 404 -> { kind: 'none' }.
       - 'the latest run directory by run id and attempt is read': dirs '5-1', '12-1', '12-2', 'supersessions', '9-3' -> the second
         request reads '.../runs/issue-7/12-2/run.json'.
       - 'the published snapshot and policy revision are returned': -> { kind: 'published', runId: 12, runAttempt: 2,
         snapshotHash: 'sha256:' + '5'.repeat(64), policyRevision: 'b'.repeat(40) } (toEqual).
       - 'a listing without run directories means no fallback': only a 'supersessions' dir and a file entry -> { kind: 'none' }.
       - 'a listing at the entry bound is unavailable': 1000 dir entries -> { kind: 'unavailable' } and no second request.
       - 'an oversize run record is unavailable': size 1048577 -> unavailable.
       - 'a run record for another submission is unavailable': record subject number 8, and separately repository 'octo/other'
         -> unavailable.
       - 'a run record that fails its schema is unavailable': record with an extra key, and separately content that is not JSON
         -> unavailable.
       - 'a run record whose run differs from its directory is unavailable': record run_id 13 under directory '12-2' -> unavailable.
       - 'a failed read is unavailable': listing answered 500, and separately the listing ok but the file answered 404 ->
         unavailable.
       - 'the fallback read uses the store branch and target prefix': recorded URLs are exactly
         'https://api.github.com/repos/octo/evidence/contents/octo/demo/runs/issue-7?ref=steward-evidence' and
         'https://api.github.com/repos/octo/evidence/contents/octo/demo/runs/issue-7/12-2/run.json?ref=steward-evidence', and every
         recorded method is 'GET'.
    3. Run: pnpm exec prettier --write packages/core/src/evidence/fallback-read.ts packages/core/src/evidence/fallback-read.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/evidence/fallback-read.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.5.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p2-2.5.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['no published run directory means no fallback','the latest run directory by run id and attempt is read','the published snapshot and policy revision are returned','a listing without run directories means no fallback','a listing at the entry bound is unavailable','an oversize run record is unavailable','a run record for another submission is unavailable','a run record that fails its schema is unavailable','a run record whose run differs from its directory is unavailable','a failed read is unavailable','the fallback read uses the store branch and target prefix'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/evidence/fallback-read.ts packages/core/src/evidence/fallback-read.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/evidence/fallback-read.ts packages/core/src/evidence/fallback-read.test.ts -> exit 0
    7. cat packages/core/src/evidence/fallback-read.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
       -> prints 0 (grep exit status 1 is expected)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/evidence/fallback-read.ts packages/core/src/evidence/fallback-read.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
