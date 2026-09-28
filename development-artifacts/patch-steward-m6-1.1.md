# Step 1.1

- id: 1.1
- depends_on: []
- route: mechanical
- objective: Add the approved hard-only hosted constants (18 exported names) to the policy bounds module, with value and relation tests.
- files_in_scope:
    - packages/core/src/policy/bounds.ts
    - packages/core/src/policy/bounds.test.ts
    - development-artifacts/patch-steward-m6-1.1-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest), commands run in Git Bash from the worktree root.
    packages/core/src/policy/bounds.ts holds the steward's hard-only constants as plain `export const NAME = <number>;` lines with no
    comments, after the POLICY_LIMITS table and findPolicyLimit. The file currently ends with `export const HANDOFF_MAX_BYTES = 8388608;`.
    The module is re-exported from the package root, so every new name must be unique across packages/core/src (verified unique).
    packages/core/src/policy/bounds.test.ts imports names from './bounds.js' and, inside `describe('policy limits', ...)`, has `it(...)`
    blocks asserting values (for example `it('hard-only report and evidence constants have the approved values', ...)`).

    New approved constants for the GitHub-hosted gate and publish jobs (exact names and values, in this order):
      OWNERSHIP_SETTLE_DELAY_MS = 10000            ownership settle delay before publish re-lists
      OWNERSHIP_RECORD_MAX_BYTES = 16384           ownership record maximum (canonical JSON bytes)
      OWNERSHIP_ARTIFACT_MAX_BYTES = 65536         ownership artifact zip download maximum
      OWNERSHIP_ARTIFACT_ENTRIES = 1               entries in the ownership artifact zip
      OWNERSHIP_LISTING_PAGES_MAX = 10             artifact listing pages (of 100) per submission
      RUN_LIST_PAGES_MAX = 10                      run-list pages (of 100) per cap query
      EVENT_PAYLOAD_MAX_BYTES = 26214400           event payload file maximum (25 MiB)
      RUN_DISPLAY_TITLE_MAX_LENGTH = 1024          run display title characters parsed
      EVIDENCE_CONFLICT_WAIT_STEP_MS = 1000        evidence non-fast-forward wait per attempt number
      EVIDENCE_CONFLICT_WAIT_MAX_MS = 10000        evidence non-fast-forward wait maximum
      EVIDENCE_FALLBACK_ENTRIES_MAX = 1000         gate evidence fallback directory listing entries
      EVIDENCE_FALLBACK_FILE_MAX_BYTES = 1048576   gate evidence fallback file bytes
      JOB_SUMMARY_MAX_LENGTH = 65536               job summary characters per job
      OWNERSHIP_RETENTION_DAYS = 90                ownership artifact retention requested (days)
      APP_JWT_LIFETIME_SECONDS = 540               App JWT lifetime
      APP_JWT_BACKDATE_SECONDS = 60                App JWT issued-at backdating
      RUNTIME_ARCHIVE_MAX_BYTES = 52428800         runtime archive maximum
      SAME_RUN_ARTIFACT_RETENTION_DAYS = 1         same-run artifact retention (handoff, closure, runtime)
    Existing names used by the relation test: GITHUB_PAGE_SIZE (100) and findPolicyLimit (its row for
    'limits.evidence.write_retries' has max 10), both in bounds.ts.

    Conventions: Prettier (single quotes, semicolons, trailing commas, printWidth 132); run Prettier only on this step's two .ts files,
    never on development-artifacts/. No comments and no planning identifiers (constant row ids, rule ids, step or phase numbers) in
    source or test titles. Tests are pure (no temp files). Do not edit packages/core/src/index.ts or any other file.
- actions: |
    1. Append to packages/core/src/policy/bounds.ts, directly after the HANDOFF_MAX_BYTES line, 18 lines
       `export const <NAME> = <value>;` with exactly the names, values, and order listed in context.
    2. In packages/core/src/policy/bounds.test.ts add the 18 names to the import from './bounds.js' and add two tests inside the
       existing describe block:
       a. it('hard-only hosted constants have the approved values', ...) asserting each of the 18 values with toBe.
       b. it('hosted constants agree with their related bounds', ...) asserting:
          OWNERSHIP_LISTING_PAGES_MAX * GITHUB_PAGE_SIZE equals 1000; RUN_LIST_PAGES_MAX * GITHUB_PAGE_SIZE equals 1000;
          OWNERSHIP_RECORD_MAX_BYTES < OWNERSHIP_ARTIFACT_MAX_BYTES; OWNERSHIP_ARTIFACT_ENTRIES equals 1;
          EVIDENCE_CONFLICT_WAIT_MAX_MS equals EVIDENCE_CONFLICT_WAIT_STEP_MS * findPolicyLimit('limits.evidence.write_retries')?.max;
          APP_JWT_LIFETIME_SECONDS <= 600; APP_JWT_BACKDATE_SECONDS < APP_JWT_LIFETIME_SECONDS; JOB_SUMMARY_MAX_LENGTH < 1048576;
          EVENT_PAYLOAD_MAX_BYTES equals 25 * 1024 * 1024; SAME_RUN_ARTIFACT_RETENTION_DAYS < OWNERSHIP_RETENTION_DAYS.
    3. Run: pnpm exec prettier --write packages/core/src/policy/bounds.ts packages/core/src/policy/bounds.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/policy/bounds.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.1.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.1.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['hard-only hosted constants have the approved values','hosted constants agree with their related bounds'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/policy/bounds.ts packages/core/src/policy/bounds.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/policy/bounds.ts packages/core/src/policy/bounds.test.ts -> exit 0
    7. grep -c "export const OWNERSHIP_RECORD_MAX_BYTES = 16384;" packages/core/src/policy/bounds.ts -> prints 1
    8. cat packages/core/src/policy/bounds.test.ts | grep -cE "mkdtemp|tmpdir|writeFile" -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/policy/bounds.ts packages/core/src/policy/bounds.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (restores bounds.ts and bounds.test.ts; nothing else depends on files outside the scope).
