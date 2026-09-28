# Step 1.8

- id: 1.8
- depends_on: [1.1]
- route: mechanical
- objective: Add pure newest-owner selection over an ownership artifact listing and effective-retention helpers to core/ownership.
- files_in_scope:
    - packages/core/src/ownership/artifacts.ts
    - packages/core/src/ownership/artifacts.test.ts
    - development-artifacts/patch-steward-m6-1.8-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest), commands run in Git Bash from the worktree root.
    packages/core/src/ownership/ holds PURE modules (no node:fs, no fetch, no network, no child processes, no clock reads).
    Domain: each committed hosted run uploads a GitHub Actions artifact named `steward-ownership-<pr|issue>-<n>`. A later adapter
    lists them (`GET /repos/{o}/{r}/actions/artifacts?name=<exact name>&per_page=100`, at most 10 pages) and passes the items here;
    it sets `complete: false` when the listing needed more pages than allowed or any page was inconsistent. Platform facts: artifact
    `created_at` has 1-second resolution and follows upload order; artifact ids do NOT follow upload order across re-run attempts, so
    ids never order owners; expired artifacts (`expired: true`) no longer count. The newest owner is the unexpired artifact with the
    greatest `created_at`; two or more sharing the greatest `created_at` are AMBIGUOUS (this blocks publication but must not block a
    replacement); an incomplete listing yields no owner. Retention: the gate requests 90 days and logs the effective value
    round((expires_at - created_at) / 1 day); a value below 90 is only a warning.

    Existing: packages/core/src/policy/bounds.ts exports OWNERSHIP_RETENTION_DAYS = 90 (step 1.1).

    Required API of packages/core/src/ownership/artifacts.ts (exact names; export nothing else):
      export interface OwnershipArtifactItem {
        readonly id: number; readonly name: string; readonly createdAt: string; readonly expiresAt: string | null;
        readonly expired: boolean; readonly workflowRunId: number | null;
      }
      export interface OwnershipListing { readonly items: readonly OwnershipArtifactItem[]; readonly complete: boolean }
      export type NewestOwnershipArtifact =
        | { readonly kind: 'none' }
        | { readonly kind: 'unique'; readonly artifact: OwnershipArtifactItem }
        | { readonly kind: 'ambiguous'; readonly artifacts: readonly OwnershipArtifactItem[] }
        | { readonly kind: 'incomplete' };
      export function newestOwnershipArtifact(listing: OwnershipListing, name: string): NewestOwnershipArtifact;
      export function artifactRetentionDays(createdAt: string, expiresAt: string): number | null;
      export function ownershipRetentionShort(days: number | null): boolean;
    Rules for newestOwnershipArtifact, in order: listing.complete false -> { kind: 'incomplete' }; consider only items whose name
    === name (exact) and expired === false; any considered item whose Date.parse(createdAt) is NaN -> { kind: 'incomplete' }; no
    considered item -> { kind: 'none' }; take the greatest Date.parse(createdAt); exactly one item with it -> unique; two or more ->
    ambiguous with those items sorted by id ascending. Never use id, array order, or workflowRunId to break or decide an order.
    artifactRetentionDays: Math.round((Date.parse(expiresAt) - Date.parse(createdAt)) / 86400000); null when either parse is NaN or
    the difference is negative. ownershipRetentionShort: true when days is null or days < OWNERSHIP_RETENTION_DAYS.

    Conventions: ESM relative imports end in '.js' (`import { OWNERSHIP_RETENTION_DAYS } from '../policy/bounds.js';`); tsconfig
    strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes; ESLint recommended. Prettier (single quotes, semicolons, trailing
    commas, printWidth 132) only on this step's .ts files. No comments except short WHY; no planning identifiers in source or titles.
    Tests pure. Do not edit packages/core/src/index.ts. Do not export any function whose name begins with load, validate, resolve,
    parse, capture, or check.
- actions: |
    1. FIRST, verify the base: `grep -c "export const OWNERSHIP_RETENTION_DAYS = 90;" packages/core/src/policy/bounds.ts` prints 1.
       If it prints 0, STOP and report status missing-base ("missing base: step 1.1") in the report file; do not fetch, merge, or
       improvise.
    2. Create packages/core/src/ownership/artifacts.ts exactly as specified.
    3. Create packages/core/src/ownership/artifacts.test.ts (describe 'ownership artifacts'); use name 'steward-ownership-pr-12' and
       created_at values like '2026-09-28T10:00:05Z'. Plain it() tests with exactly these titles:
       - 'the newest owner has the greatest created_at'
       - 'artifact ids never order owners' (the item with the larger id but earlier created_at is not chosen; reversing array order
         does not change the result)
       - 'a created_at tie at the top is ambiguous' (ambiguous artifacts sorted by id)
       - 'a tie below the top does not block a unique owner'
       - 'an incomplete listing has no newest owner'
       - 'expired artifacts are ignored' (an expired newer artifact does not win; only expired items -> none)
       - 'artifacts with another name are ignored'
       - 'an unparseable created_at makes the listing incomplete'
       - 'effective retention rounds to whole days' (90-day and 1-day spans; a span of 89 days 13 hours rounds to 90; unparseable
         or negative -> null)
       - 'retention below the requested days is short' (89 -> true, 90 -> false, null -> true)
    4. Run: pnpm exec prettier --write packages/core/src/ownership/artifacts.ts packages/core/src/ownership/artifacts.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/ownership/artifacts.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.8.json -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.8.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['the newest owner has the greatest created_at','artifact ids never order owners','a created_at tie at the top is ambiguous','a tie below the top does not block a unique owner','an incomplete listing has no newest owner','expired artifacts are ignored','artifacts with another name are ignored','an unparseable created_at makes the listing incomplete','effective retention rounds to whole days','retention below the requested days is short'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/ownership/artifacts.ts packages/core/src/ownership/artifacts.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/ownership/artifacts.ts packages/core/src/ownership/artifacts.test.ts -> exit 0
    7. grep -rnE "node:(fs|http|https|net|dns|tls|child_process)|from 'fs'|fetch\(" packages/core/src/ownership -> no output (exit 1)
    8. grep -c "export function newestOwnershipArtifact" packages/core/src/ownership/artifacts.ts -> prints 1
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/ownership/artifacts.ts packages/core/src/ownership/artifacts.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
