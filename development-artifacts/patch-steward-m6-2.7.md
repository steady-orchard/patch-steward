# Step 2.7

- id: 2.7
- depends_on: [2.1]
- route: mechanical
- objective: Add the ownership-artifact adapter to core: list a submission's ownership artifacts with completeness, download one artifact through exactly one redirect to a public HTTPS storage host without authorization, read its single bounded zip entry, validate the record, and compose the listing read the deduplication decision consumes.
- files_in_scope:
    - packages/core/src/github/artifacts.ts
    - packages/core/src/github/artifacts.test.ts
    - development-artifacts/patch-steward-m6-2.7-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Each committed hosted run uploads a workflow artifact named steward-ownership-<pr|issue>-<n> holding one file ownership.json.
    The listing is GET /repos/{o}/{r}/actions/artifacts?name=<exact name>&per_page=100 (object { total_count, artifacts: [...] },
    Link-paginated). A real item looks like: { "id": 10842905286, "node_id": "...", "name": "probe-pa02-retention-0",
    "size_in_bytes": 254, "url": "...", "archive_download_url": "...", "expired": false, "digest": "sha256:...", "created_at":
    "2026-09-25T01:26:09Z", "updated_at": "...", "expires_at": "2026-12-24T01:26:05Z", "workflow_run": { "id": 36081988862,
    "repository_id": 1376317064, "head_repository_id": 1376317064, "head_branch": "master", "head_sha": "..." } }. At most
    OWNERSHIP_LISTING_PAGES_MAX (10) pages; more is an incomplete listing. The download GET
    /repos/{o}/{r}/actions/artifacts/{id}/zip answers 302 with a Location to a signed storage URL (for example
    https://productionresultssa9.blob.core.windows.net/...); the steward follows exactly that one redirect itself, to an HTTPS URL
    whose host resolves only to public addresses, sending NO Authorization header; the zip is at most OWNERSHIP_ARTIFACT_MAX_BYTES
    (65536) with exactly one entry named ownership.json of at most OWNERSHIP_RECORD_MAX_BYTES (16384).

    Existing code to use (read their signatures before coding):
    - './client.js': type GitHubClient with getPaginatedList<T>(path, listKey, itemSchema, query?, maxPages?) ->
      Result<{ items, totalCount, complete }, GitHubFailureCode> (complete false when more pages exist beyond maxPages) and
      getRedirectLocation(path, query?) -> Result<string (absolute http or https href), GitHubFailureCode>; githubFailure(code,
      message); type GitHubFailureCode. GITHUB_FAILURE_CAUSES is not needed (failures carry failure.cause).
    - './reader.js': type GitHubRepositoryRef ({ owner, name }), repositoryRefFromFullName(fullName) (null when invalid).
    - '../net/attachment-fetch.js': fetchAttachment(url, { destinations, maxRedirects, timeoutMs, maxFileBytes,
      remainingTotalBytes, resolver, transport }) -> { kind: 'fetched', bytes, ... } | { kind: 'violation', rule, ... } |
      { kind: 'unavailable', reason, ... }. It requires https, no userinfo, default port, a host in destinations, resolves the host
      with resolver and returns unavailable reason 'private-address' if any address is non-public, sends only
      ATTACHMENT_REQUEST_HEADERS (no authorization; from '../net/https-transport.js'), counts redirects (maxRedirects 0 makes any
      further redirect a 'redirects' violation), and enforces maxFileBytes ('file-bytes' violation). Types AttachmentResolver,
      AttachmentTransport.
    - '../net/zip-entry.js': readSingleZipEntry(bytes, { entryName, maxArchiveBytes, maxEntryBytes }) -> { kind: 'ok', bytes } |
      { kind: 'violation', reason: 'archive-bytes' | 'archive' | 'entry-count' | 'entry-name' | 'crc-mismatch', ... }.
    - '../ownership/record.js': OWNERSHIP_ARTIFACT_FILE ('ownership.json'), ownershipArtifactName(type, number) (throws on an
      invalid number), decodeOwnershipRecord(bytes, { repository, type, number, artifactName, workflowRunId }) ->
      Result<OwnershipRecord, 'ownership.record-invalid'>, types OwnershipRecord, OwnershipArtifactExpectation.
    - '../ownership/artifacts.js': types OwnershipArtifactItem ({ id, name, createdAt, expiresAt: string | null, expired,
      workflowRunId: number | null }) and OwnershipListing ({ items, complete }); newestOwnershipArtifact(listing, name) ->
      { kind: 'none' } | { kind: 'unique', artifact } | { kind: 'ambiguous', artifacts } | { kind: 'incomplete' }.
    - '../ownership/dedup.js': type DedupListingRead ({ kind: 'unavailable' } | { kind: 'incomplete' } | { kind: 'ambiguous' } |
      { kind: 'none' } | { kind: 'unique', record: { kind: 'valid', runId, runAttempt, snapshotHash, policyRevision } |
      { kind: 'invalid' } | { kind: 'unavailable' } }).
    - '../policy/bounds.js': OWNERSHIP_LISTING_PAGES_MAX, OWNERSHIP_ARTIFACT_MAX_BYTES, OWNERSHIP_RECORD_MAX_BYTES,
      GITHUB_REQUEST_TIMEOUT_MS. '../result.js': ok, err, types Result, StewardFailure. '../vocabulary.js': type SubmissionType.

    Required API (exact names; export nothing else):
      export const githubArtifactSchema = z.object({
        id: z.int().positive(),
        name: z.string().min(1).max(256),
        expired: z.boolean(),
        created_at: z.string().max(64).nullable(),
        expires_at: z.string().max(64).nullable(),
        workflow_run: z.object({ id: z.int().positive().nullable().optional() }).nullable().optional(),
      });
      export async function listOwnershipArtifacts(client: GitHubClient, repository: GitHubRepositoryRef, name: string):
        Promise<Result<OwnershipListing, GitHubFailureCode>>;
      export interface OwnershipDownloadDeps {
        readonly resolver: AttachmentResolver;
        readonly transport: AttachmentTransport;
        readonly timeoutMs?: number;
      }
      export type OwnershipDownloadFailureCode = 'ownership.listing-unavailable' | 'ownership.record-invalid';
      export async function downloadOwnershipRecord(client: GitHubClient, repository: GitHubRepositoryRef,
        artifact: OwnershipArtifactItem, expected: OwnershipArtifactExpectation, deps: OwnershipDownloadDeps):
        Promise<Result<OwnershipRecord, OwnershipDownloadFailureCode>>;
      export type OwnershipRecordRead =
        | { readonly kind: 'valid'; readonly record: OwnershipRecord }
        | { readonly kind: 'invalid' }
        | { readonly kind: 'unavailable' };
      export type OwnershipListingRead =
        | { readonly kind: 'unavailable'; readonly failure: StewardFailure }
        | { readonly kind: 'incomplete' }
        | { readonly kind: 'none' }
        | { readonly kind: 'ambiguous'; readonly artifacts: readonly OwnershipArtifactItem[] }
        | { readonly kind: 'unique'; readonly artifact: OwnershipArtifactItem; readonly record: OwnershipRecordRead };
      export async function readOwnershipListing(client: GitHubClient, repository: GitHubRepositoryRef,
        subject: { readonly type: SubmissionType; readonly number: number }, deps: OwnershipDownloadDeps):
        Promise<OwnershipListingRead>;
      export function dedupListingRead(read: OwnershipListingRead): DedupListingRead;

    Rules:
    - repo path = '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(name); a repository failing
      repositoryRefFromFullName(owner + '/' + name) -> githubFailure('github.invalid-request', ...) with no request.
    - listOwnershipArtifacts: name must match /^steward-ownership-(pr|issue)-[1-9][0-9]{0,9}$/ else github.invalid-request with no
      request; client.getPaginatedList(repo + '/actions/artifacts', 'artifacts', githubArtifactSchema, { name },
      OWNERSHIP_LISTING_PAGES_MAX); failure returned as is; map each item to { id, name, createdAt: created_at ?? '', expiresAt:
      expires_at, expired, workflowRunId: workflow_run?.id ?? null } (a null or empty createdAt later makes the listing incomplete);
      ok({ items, complete }).
    - downloadOwnershipRecord (messages fixed; never include the location, a header, or response text):
      1. client.getRedirectLocation(repo + '/actions/artifacts/' + artifact.id + '/zip'); failure f -> err('ownership.listing-
         unavailable', f.failure.cause, 'The ownership artifact could not be downloaded.', [detail { code:
         'ownership.listing-unavailable', path: f.failure.code, message: same, line: null, column: null }]).
      2. fetchAttachment(location, { destinations: [new URL(location).hostname], maxRedirects: 0, timeoutMs: deps.timeoutMs ??
         GITHUB_REQUEST_TIMEOUT_MS, maxFileBytes: OWNERSHIP_ARTIFACT_MAX_BYTES, remainingTotalBytes: OWNERSHIP_ARTIFACT_MAX_BYTES,
         resolver: deps.resolver, transport: deps.transport }). 'unavailable' -> err('ownership.listing-unavailable',
         'github-unavailable', 'The ownership artifact could not be downloaded.', [detail path 'download-' + reason]);
         'violation' -> err('ownership.record-invalid', 'github-unavailable', 'The ownership artifact is invalid.', [detail path
         'download-' + rule]).
      3. readSingleZipEntry(bytes, { entryName: OWNERSHIP_ARTIFACT_FILE, maxArchiveBytes: OWNERSHIP_ARTIFACT_MAX_BYTES,
         maxEntryBytes: OWNERSHIP_RECORD_MAX_BYTES }); violation -> err('ownership.record-invalid', 'github-unavailable', 'The
         ownership artifact is invalid.', [detail path 'zip-' + reason]).
      4. return decodeOwnershipRecord(entry bytes, expected) unchanged.
    - readOwnershipListing: name = ownershipArtifactName(subject.type, subject.number) inside try/catch (throw -> { kind:
      'unavailable', failure: githubFailure('github.invalid-request', 'The submission is not valid.').failure }); listing failure ->
      { kind: 'unavailable', failure }; newest = newestOwnershipArtifact(listing, name); 'incomplete', 'none', 'ambiguous' (with its
      artifacts) are returned as such without any download; 'unique' -> downloadOwnershipRecord(client, repository,
      newest.artifact, { repository: owner + '/' + name, type: subject.type, number: subject.number, artifactName:
      newest.artifact.name, workflowRunId: newest.artifact.workflowRunId }, deps): ok -> record { kind: 'valid', record };
      'ownership.record-invalid' -> { kind: 'invalid' }; 'ownership.listing-unavailable' -> { kind: 'unavailable' }.
    - dedupListingRead: unavailable -> { kind: 'unavailable' }; incomplete, none -> same kind; ambiguous -> { kind: 'ambiguous' };
      unique -> { kind: 'unique', record: valid -> { kind: 'valid', runId: record.run_id, runAttempt: record.run_attempt,
      snapshotHash: record.snapshot_hash, policyRevision: record.policy_revision }, invalid -> { kind: 'invalid' }, unavailable ->
      { kind: 'unavailable' } }.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig with
    noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters; Prettier (single quotes, semicolons,
    trailing commas, printWidth 132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in
    code or titles. Tests are pure: no temp files, no child processes, no real network or DNS (inject fetch, resolver, transport).
    Do not edit packages/core/src/index.ts. Export names are unique across packages; none starts with load, validate, resolve,
    parse, capture, or check.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const s=require('fs').readFileSync('packages/core/src/github/client.ts','utf8');const need=['getPaginatedList','getRedirectLocation','export interface GitHubListPage'];const miss=need.filter(n=>!s.includes(n));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/github/artifacts.ts per context.
    3. Create packages/core/src/github/artifacts.test.ts (describe 'ownership artifact adapter'). Helpers (copy, do not import from
       test files): buildZip from packages/core/src/net/zip-entry.test.ts; fakeResolver, fakeTransport, and bodyFrom from
       packages/core/src/net/attachment-fetch.test.ts; a valid record from approvedRecord() in
       packages/core/src/ownership/record.test.ts (repository 'steady-orchard/patch-steward-testbed-public', subject pull_request
       12, run_id 36081628326) encoded with encodeOwnershipRecord from '../ownership/record.js'. Client:
       createGitHubClient({ token: 'test-token-' + 'a'.repeat(12), budget: createGitHubBudget({ requests: 20, retriesPerRequest:
       0 }), fetch }) with a recording fake fetch answering by URL; the zip endpoint answers new Response(null, { status: 302,
       headers: { location: 'https://storage.example.net/artifact.zip?sig=' + 'q'.repeat(16) } }); the resolver maps
       'storage.example.net' to [{ address: '140.82.112.3', family: 4 }]; the transport answers { kind: 'response', status: 200,
       location: null, body: bodyFrom([zip]), close() {} }. Listing items use name 'steward-ownership-pr-12' and workflow_run.id
       36081628326. Use plain it(...) with EXACTLY these titles:
       - 'the ownership listing maps artifacts and completeness': two items (one with workflow_run null, one with created_at null)
         -> ok, complete true, mapped fields (workflowRunId null, createdAt ''); request URL
         'https://api.github.com/repos/steady-orchard/patch-steward-testbed-public/actions/artifacts?name=steward-ownership-pr-12&per_page=100';
         an invalid name 'steward-ownership-pr-012' -> github.invalid-request with 0 fetch calls.
       - 'an ownership listing beyond the page limit is incomplete': every page carries a next link -> ok with complete false after
         exactly 10 fetch calls.
       - 'the ownership record downloads through one redirect': downloadOwnershipRecord -> ok record equal to approvedRecord();
         exactly 1 GitHub fetch call (the zip path, method GET, redirect 'manual') and exactly 1 transport request whose url is the
         Location.
       - 'the storage download carries no authorization': Object.keys(ATTACHMENT_REQUEST_HEADERS) (from
         '../net/https-transport.js') contains no key equal to 'authorization' in any case, and the transport request object has
         no headers property; the token string appears in the GitHub fetch headers only.
       - 'a redirect to a non-https location is rejected': location 'http://storage.example.net/a.zip' -> 'ownership.record-invalid'
         with details[0].path 'download-scheme'; resolver and transport never called.
       - 'a redirect to a private address is rejected': resolver maps the host to [{ address: '10.0.0.5', family: 4 }] ->
         'ownership.listing-unavailable' with details[0].path 'download-private-address'; transport never called.
       - 'an oversize artifact zip is rejected': transport body of 65537 bytes -> 'ownership.record-invalid' with details[0].path
         'download-file-bytes'.
       - 'an artifact zip with an extra entry is rejected': zip with ownership.json and extra.txt -> 'ownership.record-invalid' with
         details[0].path 'zip-entry-count'.
       - 'a record naming another submission is invalid': the record's subject number 13 zipped as ownership.json, expectation for
         pull_request 12 -> 'ownership.record-invalid'.
       - 'a failed redirect read is unavailable': zip endpoint answers 404 -> 'ownership.listing-unavailable' with details[0].path
         'github.not-found'; answers 200 '{}' -> 'ownership.listing-unavailable' with details[0].path 'github.unexpected-status'.
       - 'a unique newest owner is downloaded and validated': readOwnershipListing for pull_request 12 with two items (created_at
         '2026-09-28T10:00:00Z' and '2026-09-28T10:00:05Z'; the newer one has id 2) -> kind 'unique', artifact id 2, record kind
         'valid'; the zip request used artifact id 2.
       - 'an ambiguous or incomplete listing downloads nothing': two items sharing the greatest created_at -> kind 'ambiguous' with
         both artifacts; a listing with a next link at the page bound -> kind 'incomplete'; a listing answered 500 -> kind
         'unavailable' with failure.code 'github.server-error'; in all three no zip request and no transport request.
       - 'dedup listing reads carry the owner identity': dedupListingRead of a unique valid read -> { kind: 'unique', record:
         { kind: 'valid', runId: 36081628326, runAttempt: 1, snapshotHash: 'sha256:' + 'a'.repeat(64), policyRevision:
         'b'.repeat(40) } }; of unique invalid -> record { kind: 'invalid' }; of unavailable -> { kind: 'unavailable' }; of
         ambiguous -> { kind: 'ambiguous' }.
    4. Run: pnpm exec prettier --write packages/core/src/github/artifacts.ts packages/core/src/github/artifacts.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/github/artifacts.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.7.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p2-2.7.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['the ownership listing maps artifacts and completeness','an ownership listing beyond the page limit is incomplete','the ownership record downloads through one redirect','the storage download carries no authorization','a redirect to a non-https location is rejected','a redirect to a private address is rejected','an oversize artifact zip is rejected','an artifact zip with an extra entry is rejected','a record naming another submission is invalid','a failed redirect read is unavailable','a unique newest owner is downloaded and validated','an ambiguous or incomplete listing downloads nothing','dedup listing reads carry the owner identity'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/github/artifacts.ts packages/core/src/github/artifacts.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/github/artifacts.ts packages/core/src/github/artifacts.test.ts -> exit 0
    7. cat packages/core/src/github/artifacts.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
       -> prints 0 (grep exit status 1 is expected)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/github/artifacts.ts packages/core/src/github/artifacts.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
