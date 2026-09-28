# Step 1.4

- id: 1.4
- depends_on: []
- route: mechanical
- objective: Add the pure evidence-store checks to core/evidence: git blob ids, the append-only compare check, and read-back comparators.
- files_in_scope:
    - packages/core/src/evidence/blob-id.ts
    - packages/core/src/evidence/blob-id.test.ts
    - packages/core/src/evidence/store-checks.ts
    - packages/core/src/evidence/store-checks.test.ts
    - development-artifacts/patch-steward-m6-1.4-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest), commands run in Git Bash from the worktree root. Built-ins only.
    Purpose: a later step commits evidence files to a git branch through the GitHub Git Data API (blobs, tree, commit, non-force ref
    update). Before the ref update it fetches `GET /repos/{s}/compare/<tip>...<new commit>` and must prove the change ONLY ADDS the
    expected paths; after the update it reads back the tip and the committed tree and compares blob ids computed locally, so no blob
    is downloaded. This step adds only the pure functions; no network.

    Git blob id: lowercase hex SHA-1 of the bytes of the ASCII header `blob <byteLength>`, then ONE zero byte, then the content bytes.
    Build the zero byte as Buffer.from([0]) (never a string escape). Known vectors (verified with `git hash-object --stdin`):
      empty content -> e69de29bb2d1d6434b8b29ae775ad8c2e48c5391
      'hello' + newline (0x0a) -> ce013625030ba8dba906f756967f9e9ca394464a
      'test content' + newline (0x0a) -> d670460b4b4aece5915caf5c68d12f560a9fe3e4

    Result helpers (packages/core/src/result.ts): ok(value); err(code, cause, message, details) returns
    { ok: false, failure: { code, cause, outcome: 'inconclusive', message, details } }; types Result<T, C>, FailureDetail
    = { code, path, message, line: number | null, column: number | null }. Use cause 'infrastructure' for both failure codes here.

    Required API (exact names; export nothing else from these two files):
    packages/core/src/evidence/blob-id.ts:
      export function gitBlobId(bytes: Uint8Array): string;   // node:crypto createHash('sha1')
    packages/core/src/evidence/store-checks.ts:
      export const evidenceCompareSchema = z.object({
        status: z.string().max(64),
        ahead_by: z.int().min(0),
        behind_by: z.int().min(0),
        files: z.array(z.object({ filename: z.string().min(1).max(4096), status: z.string().max(64) })).max(3000).optional(),
      });
      export type EvidenceCompare = z.output<typeof evidenceCompareSchema>;
      export type AppendOnlyFailureCode = 'evidence.store-not-append-only';
      export function verifyAppendOnlyCompare(compare: EvidenceCompare, expectedPaths: readonly string[]):
        Result<readonly string[], AppendOnlyFailureCode>;
      export function readBackTipAccepted(compare: EvidenceCompare): boolean;
      export type ReadBackFailureCode = 'evidence.readback-mismatch';
      export type ReadBackMode = 'exact' | 'contains';
      export interface ReadBackTreeEntry { readonly path: string; readonly type: string; readonly sha: string; readonly mode: string }
      export interface ExpectedBlob { readonly path: string; readonly blobId: string }
      export function verifyReadBackTree(entries: readonly ReadBackTreeEntry[], expected: readonly ExpectedBlob[], mode: ReadBackMode):
        Result<readonly ExpectedBlob[], ReadBackFailureCode>;

    Rules:
    verifyAppendOnlyCompare fails with err('evidence.store-not-append-only', 'infrastructure', 'The evidence store change is not
    append-only.', [one detail with the same code and message, line null, column null, and path = the first failed check token]) at
    the first failed check, in order: status !== 'ahead' (token 'status'); ahead_by !== 1 ('ahead_by'); behind_by !== 0
    ('behind_by'); files undefined ('files'); any file status !== 'added' ('file-status'); duplicate expected paths, duplicate
    filenames, or filename set !== expected path set ('paths'). Success: ok(sorted copy of expectedPaths, default string sort).
    readBackTipAccepted: true exactly when (status is 'ahead' or 'identical') and behind_by === 0 (compare of new commit...tip).
    verifyReadBackTree fails with err('evidence.readback-mismatch', 'infrastructure', 'The evidence read-back does not match the
    committed files.', [one detail, path = token]) at the first failed check, in order: duplicate expected paths ('expected'); in
    'exact' mode an entry whose type is neither 'blob' nor 'tree' ('entry-type'); duplicate blob paths among entries ('paths'); for
    each expected blob (in given order): no entry with type 'blob' and that path ('missing'), sha !== blobId ('blob-id'), mode !==
    '100644' ('mode'); in 'exact' mode a blob entry whose path is not expected ('extra'). Tree entries are always ignored except for
    the type check. Success: ok(expected sorted by path). Detail messages and paths are fixed tokens; never put response text in them.

    Conventions: ESM relative imports end in '.js' (`import { err, ok } from '../result.js'; import type { Result } from
    '../result.js';`, `import { z } from 'zod';`); tsconfig strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes; ESLint
    recommended. Prettier (single quotes, semicolons, trailing commas, printWidth 132) only on this step's .ts files. No comments except
    short WHY; no planning identifiers in source or titles. Tests pure (no temp files, no child processes); build newline bytes with
    String.fromCharCode(10) or Buffer.from([...]). Do not edit packages/core/src/index.ts.
- actions: |
    1. Create packages/core/src/evidence/blob-id.ts with gitBlobId as specified.
    2. Create packages/core/src/evidence/blob-id.test.ts (describe 'git blob id') with:
       - it('git blob ids match git hash-object') asserting the three vectors from context.
       - it('git blob ids hash exact bytes') asserting LF and CRLF contents give different ids and that a Uint8Array view with a
         non-zero byteOffset hashes the same as a copied Buffer of the same bytes.
    3. Create packages/core/src/evidence/store-checks.ts with the schema and functions as specified.
    4. Create packages/core/src/evidence/store-checks.test.ts (describe 'evidence store checks') with exact titles:
       - 'an added-only compare with the expected paths is append-only' (ok value is the sorted paths)
       - 'a compare with a modified file is not append-only' (detail path 'file-status')
       - 'a compare with a missing or extra path is not append-only' (detail path 'paths')
       - 'a compare that is not one commit ahead is not append-only' (status 'diverged', ahead_by 2, behind_by 1 cases)
       - 'a compare without a file list is not append-only' (detail path 'files')
       - 'a read-back tip that is ahead or identical is accepted'
       - 'a diverged or behind read-back tip is rejected'
       - 'an exact read-back tree with matching blob ids verifies' (entries include a 'tree' entry 'logs' and blob 'logs/steward.txt')
       - 'a read-back blob id mismatch fails' (detail path 'blob-id')
       - 'an exact read-back with an extra or missing blob fails' (detail paths 'extra' and 'missing')
       - 'a contains read-back ignores other entries'
       - 'a read-back blob with another mode fails' (mode '100755', detail path 'mode')
       Every failure assertion checks ok === false, failure.code, failure.outcome === 'inconclusive', and details[0].path.
    5. Run: pnpm exec prettier --write packages/core/src/evidence/blob-id.ts packages/core/src/evidence/blob-id.test.ts packages/core/src/evidence/store-checks.ts packages/core/src/evidence/store-checks.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/evidence/blob-id.test.ts packages/core/src/evidence/store-checks.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.4.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.4.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['git blob ids match git hash-object','git blob ids hash exact bytes','an added-only compare with the expected paths is append-only','a compare with a modified file is not append-only','a compare with a missing or extra path is not append-only','a compare that is not one commit ahead is not append-only','a compare without a file list is not append-only','a read-back tip that is ahead or identical is accepted','a diverged or behind read-back tip is rejected','an exact read-back tree with matching blob ids verifies','a read-back blob id mismatch fails','an exact read-back with an extra or missing blob fails','a contains read-back ignores other entries','a read-back blob with another mode fails'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. printf 'test content\n' | git hash-object --stdin -> prints d670460b4b4aece5915caf5c68d12f560a9fe3e4
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/evidence/blob-id.ts packages/core/src/evidence/blob-id.test.ts packages/core/src/evidence/store-checks.ts packages/core/src/evidence/store-checks.test.ts
       -> exit 0
    7. pnpm exec prettier --check packages/core/src/evidence/blob-id.ts packages/core/src/evidence/blob-id.test.ts packages/core/src/evidence/store-checks.ts packages/core/src/evidence/store-checks.test.ts
       -> exit 0
    8. cat packages/core/src/evidence/blob-id.test.ts packages/core/src/evidence/store-checks.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/evidence/blob-id.ts packages/core/src/evidence/blob-id.test.ts packages/core/src/evidence/store-checks.ts packages/core/src/evidence/store-checks.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the four new files).
