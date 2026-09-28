# Step 3.12

- id: 3.12
- depends_on: []
- route: mechanical
- objective: Change the job summary's freshness line to the published vocabulary (`current`, `superseded` with its reason, or `unknown`) in packages/core/src/pipeline/job-summary.ts.
- files_in_scope:
    - packages/core/src/pipeline/job-summary.ts
    - packages/core/src/pipeline/job-summary.test.ts
    - development-artifacts/patch-steward-m6-3.12-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: the hosted publish job summary must state freshness as `current`, `superseded` with its reason (`newer-owner` or
    `snapshot-changed`), or `unknown`. Today packages/core/src/pipeline/job-summary.ts declares `export type JobSummaryFreshness =
    'confirmed' | 'superseded' | 'unknown';` and renders `'- Freshness: ' + S(input.freshness)`. No production code uses the
    renderer yet (only job-summary.test.ts and the root export list), so the type can change.

    Required change (exact):
      export type JobSummaryFreshness =
        | { readonly state: 'current' }
        | { readonly state: 'superseded'; readonly reason: SupersessionReason }   // type from '../vocabulary.js'
        | { readonly state: 'unknown' };
    JobSummaryInput.freshness stays `JobSummaryFreshness | null`. Rendering: current -> '- Freshness: `current`'; superseded ->
    '- Freshness: `superseded` (`' + reason + '`)' built as '- Freshness: ' + S('superseded') + ' (' + S(reason) + ')'; unknown ->
    '- Freshness: `unknown`' (S is reportCodeSpan, as today). Every other line, the order, the bound, and fitJobSummary stay
    unchanged.

    Test update in packages/core/src/pipeline/job-summary.test.ts: in 'publish summaries list outcome, evidence, and freshness'
    use freshness { state: 'current' } and expect the line '- Freshness: `current`' where it expected '- Freshness: `confirmed`';
    add one plain it(...) titled exactly 'superseded freshness names its reason' asserting that { state: 'superseded', reason:
    'newer-owner' } renders the line '- Freshness: `superseded` (`newer-owner`)' and { state: 'unknown' } renders
    '- Freshness: `unknown`'. Keep every other test unchanged.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig; Prettier (single quotes,
    semicolons, trailing commas, printWidth 132) only on this step's files; no planning identifiers in code, comments, or test
    titles; never write raw control, bidi, or zero-width characters. Do not edit packages/core/src/index.ts.
- actions: |
    1. Edit packages/core/src/pipeline/job-summary.ts per context.
    2. Edit packages/core/src/pipeline/job-summary.test.ts per context.
    3. Run: pnpm exec prettier --write packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/job-summary.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.12.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.12.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['gate summaries list disposition, snapshot, owner, and caps','publish summaries list outcome, evidence, and freshness','absent fields are omitted','derived values render as code spans','hostile values cannot break the summary layout','short retention is flagged','summaries never exceed the bound','superseded freshness names its reason'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. grep -c "confirmed" packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
       -> prints two lines ending in :0 (grep exit status 1 is expected)
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts -> exit 0
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (restores the previous freshness type and test).
