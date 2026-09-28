# Step 1.5

- id: 1.5
- depends_on: []
- route: mechanical
- objective: Add the pure ownership deduplication decision and the verified-echo predicate to a new core/ownership module.
- files_in_scope:
    - packages/core/src/ownership/dedup.ts
    - packages/core/src/ownership/dedup.test.ts
    - development-artifacts/patch-steward-m6-1.5-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest), commands run in Git Bash from the worktree root. packages/core/src/ownership/
    is a NEW directory of pure modules: no node:fs, no fetch, no network, no child processes, no clock reads.
    Domain: each GitHub event on an issue or pull request starts one workflow run whose `gate` job captures the submission, computes a
    snapshot hash ('sha256:' + 64 hex) under a trusted policy revision (40 or 64 hex tree id), and decides whether to COMMIT a new
    ownership artifact (the run becomes the submission's newest owner and continues) or treat the event as a DUPLICATE (the newest
    owner is kept: no upload, no cancel, no cap evaluation, no evidence). The caller (a later step) lists the ownership artifacts,
    picks the newest by created_at (none, unique, ambiguous tie, or incomplete listing), downloads and validates the unique newest
    owner's record, and, when there is no unexpired owner, reads the latest published evidence run (fallback). This step decides
    from those already-read inputs. The caller lists ownership artifacts for EVERY event kind (reruns, reopens, closures included);
    nothing in this module decides whether to list.

    Required API of packages/core/src/ownership/dedup.ts (exact names; export nothing else):
      export const DEDUP_COMMIT_REASONS = ['rerun', 'reopened', 'no-owner', 'snapshot-changed', 'owner-ambiguous', 'listing-incomplete'] as const;
      export type DedupCommitReason = (typeof DEDUP_COMMIT_REASONS)[number];
      export const DEDUP_DUPLICATE_REASONS = ['echo', 'owner-unchanged', 'published-unchanged'] as const;
      export type DedupDuplicateReason = (typeof DEDUP_DUPLICATE_REASONS)[number];
      export type DedupFailureCode = 'ownership.listing-unavailable' | 'ownership.record-invalid';
      export interface DedupRunRef { readonly runId: number; readonly runAttempt: number }
      export interface DedupSnapshot { readonly snapshotHash: string; readonly policyRevision: string }
      export type DedupOwnerRecordRead =
        | ({ readonly kind: 'valid' } & DedupRunRef & DedupSnapshot)
        | { readonly kind: 'invalid' }
        | { readonly kind: 'unavailable' };
      export type DedupListingRead =
        | { readonly kind: 'unavailable' }
        | { readonly kind: 'incomplete' }
        | { readonly kind: 'ambiguous' }
        | { readonly kind: 'none' }
        | { readonly kind: 'unique'; readonly record: DedupOwnerRecordRead };
      export type DedupFallbackRead =
        | ({ readonly kind: 'published' } & DedupRunRef & DedupSnapshot)
        | { readonly kind: 'none' }
        | { readonly kind: 'unavailable' };
      export interface DedupInput {
        readonly runAttempt: number;        // GITHUB_RUN_ATTEMPT of this run
        readonly action: string;            // event action, e.g. 'opened', 'edited', 'reopened'
        readonly echo: boolean;             // result of isVerifiedEcho, computed by the caller
        readonly listing: DedupListingRead | null;   // null = not read
        readonly fallback: DedupFallbackRead | null; // consulted only when listing.kind is 'none'; null = not read
        readonly captured: DedupSnapshot;   // freshly captured snapshot hash and trusted policy revision
      }
      export type DedupDecision =
        | { readonly kind: 'duplicate'; readonly reason: DedupDuplicateReason; readonly keptOwner: DedupRunRef | null }
        | { readonly kind: 'commit'; readonly reason: DedupCommitReason };
      export function decideDeduplication(input: DedupInput): Result<DedupDecision, DedupFailureCode>;
      export function appliesListingDeduplication(runAttempt: number, action: string): boolean;
      export interface EchoInput {
        readonly senderId: number; readonly botUserId: number | null;
        readonly triggeringResourceId: number; readonly receipts: readonly number[];
      }
      export function isVerifiedEcho(input: EchoInput): boolean;

    decideDeduplication rules, applied in this exact order (first match wins):
      1. echo true -> ok duplicate, reason 'echo', keptOwner null.
      2. runAttempt > 1 (explicit rerun) -> ok commit 'rerun' (listing and fallback ignored).
      3. action === 'reopened' -> ok commit 'reopened' (listing and fallback ignored).
      4. listing null or listing.kind 'unavailable' -> err 'ownership.listing-unavailable'.
      5. listing.kind 'incomplete' -> ok commit 'listing-incomplete'; 'ambiguous' -> ok commit 'owner-ambiguous'
         (a tie or incomplete listing never blocks a replacement).
      6. listing.kind 'unique': record 'unavailable' -> err 'ownership.listing-unavailable'; record 'invalid' -> err
         'ownership.record-invalid'; record 'valid' with snapshotHash AND policyRevision both equal to captured -> ok duplicate
         'owner-unchanged', keptOwner { runId, runAttempt } of the record; otherwise -> ok commit 'snapshot-changed'.
      7. listing.kind 'none': fallback null or 'unavailable' -> err 'ownership.listing-unavailable'; fallback 'none' -> ok commit
         'no-owner'; fallback 'published' with both values equal to captured -> ok duplicate 'published-unchanged', keptOwner
         { runId, runAttempt } of the published run; otherwise -> ok commit 'snapshot-changed'.
    Errors: err(code, 'github-unavailable', message) with messages 'The ownership listing could not be read.' (listing-unavailable)
    and 'The newest ownership record is invalid.' (record-invalid). Never throw.
    appliesListingDeduplication: true exactly when runAttempt === 1 and action !== 'reopened' (neither rule 2 nor rule 3 fires, so
    the listing-based rules 4 to 7, including the fallback read of rule 7, decide). It never gates the listing itself.
    isVerifiedEcho: true exactly when botUserId !== null and senderId === botUserId and receipts includes triggeringResourceId.

    Result helpers (packages/core/src/result.ts): ok(value); err(code, cause, message, details = []) returns
    { ok: false, failure: { code, cause, outcome: 'inconclusive', message, details } }; `Result<T, C extends string>`.
    Conventions: ESM relative imports end in '.js' (`import { err, ok } from '../result.js'; import type { Result } from
    '../result.js';`); tsconfig strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes; ESLint recommended. Prettier (single
    quotes, semicolons, trailing commas, printWidth 132) only on this step's .ts files. No comments except short WHY; no planning
    identifiers in source or titles. Tests pure. Do not edit packages/core/src/index.ts. Do not export any function whose name begins
    with load, validate, resolve, parse, capture, or check.
- actions: |
    1. Create packages/core/src/ownership/dedup.ts implementing the API and rules exactly as specified.
    2. Create packages/core/src/ownership/dedup.test.ts (describe 'ownership deduplication') using hashes like 'sha256:' +
       'a'.repeat(64) and revisions like 'b'.repeat(40). Plain it() tests with exactly these titles (each asserts the full decision
       or the failure code and outcome 'inconclusive'):
       - 'an explicit rerun commits a new owner whatever the snapshot' (runAttempt 2 with an unchanged unique owner -> commit rerun)
       - 'a reopened event commits a new owner whatever the snapshot'
       - 'an unchanged snapshot and policy revision keep the newest owner' (duplicate owner-unchanged with keptOwner)
       - 'a changed snapshot hash commits a new owner'
       - 'a changed policy revision commits a new owner'
       - 'an unchanged published snapshot without an owner is a duplicate' (published-unchanged with keptOwner)
       - 'a changed published snapshot without an owner commits' (commit snapshot-changed)
       - 'no owner and no published run commits a new owner' (commit no-owner)
       - 'an ambiguous newest owner commits a new owner'
       - 'an incomplete listing commits a new owner'
       - 'an unavailable listing fails before commitment'
       - 'an unavailable owner record fails before commitment'
       - 'an invalid owner record fails before commitment' (code ownership.record-invalid)
       - 'an unavailable fallback read fails before commitment' (both fallback null and kind 'unavailable')
       - 'a missing listing read fails closed' (listing null, runAttempt 1, action 'edited')
       - 'a verified echo is a duplicate' (echo true beats an otherwise changed snapshot)
       - 'a bot sender without a recorded receipt is not an echo' (isVerifiedEcho with empty receipts -> false)
       - 'a recorded receipt from another sender is not an echo' (senderId differs from botUserId -> false; botUserId null -> false)
       - 'listing-based deduplication applies only to first attempts of non-reopen events' (appliesListingDeduplication truth
         table: (1, 'edited') true; (1, 'opened') true; (2, 'edited') false; (1, 'reopened') false; (3, 'reopened') false)
    3. Run: pnpm exec prettier --write packages/core/src/ownership/dedup.ts packages/core/src/ownership/dedup.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/ownership/dedup.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.5.json -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.5.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['an explicit rerun commits a new owner whatever the snapshot','a reopened event commits a new owner whatever the snapshot','an unchanged snapshot and policy revision keep the newest owner','a changed snapshot hash commits a new owner','a changed policy revision commits a new owner','an unchanged published snapshot without an owner is a duplicate','a changed published snapshot without an owner commits','no owner and no published run commits a new owner','an ambiguous newest owner commits a new owner','an incomplete listing commits a new owner','an unavailable listing fails before commitment','an unavailable owner record fails before commitment','an invalid owner record fails before commitment','an unavailable fallback read fails before commitment','a missing listing read fails closed','a verified echo is a duplicate','a bot sender without a recorded receipt is not an echo','a recorded receipt from another sender is not an echo','listing-based deduplication applies only to first attempts of non-reopen events'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/ownership/dedup.ts packages/core/src/ownership/dedup.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/ownership/dedup.ts packages/core/src/ownership/dedup.test.ts -> exit 0
    7. grep -rnE "node:(fs|http|https|net|dns|tls|child_process)|from 'fs'|fetch\(" packages/core/src/ownership -> no output (exit 1)
    8. grep -c "export function decideDeduplication" packages/core/src/ownership/dedup.ts -> prints 1
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/ownership/dedup.ts packages/core/src/ownership/dedup.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
