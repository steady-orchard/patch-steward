# Step 1.10

- id: 1.10
- depends_on: [1.1, 1.2]
- route: mechanical
- objective: Add the wrapper run-name builder and parser and the pure daily and per-author cap evaluation over a tagged run list to core/ownership.
- files_in_scope:
    - packages/core/src/ownership/caps.ts
    - packages/core/src/ownership/caps.test.ts
    - development-artifacts/patch-steward-m6-1.10-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest), commands run in Git Bash from the worktree root.
    packages/core/src/ownership/ holds PURE modules (no node:fs, no fetch, no network, no child processes, no clock reads; the time
    is passed in).
    Domain: aggregate caps (policy limits.caps.daily_runs 1..1000 and limits.caps.per_author_concurrent_runs 1..20) are computed from
    the repository's Actions run list, not from stored state. The wrappers tag every run through `run-name` with numeric ids and
    platform enums only:
      steward-pr.yml:     steward pr <pr number> author <pr author id> event <event_name> <action> sender <sender id> <sender type>
      steward-issues.yml: steward issue <issue number> author <issue author id> event <event_name> <action> sender <sender id> <sender type>
    Grammar (the parser accepts nothing else; at most RUN_DISPLAY_TITLE_MAX_LENGTH = 1024 characters, checked before matching):
      /^steward (pr|issue) ([1-9][0-9]{0,9}) author ([1-9][0-9]{0,19}) event ([a-z_]{1,64}) ([a-z_]{1,64}) sender ([1-9][0-9]{0,19}) (User|Bot|Organization|Mannequin)$/
    (a static regex literal without flags; in JavaScript `$` without the m flag does not match before a trailing newline). Numbers
    that are not safe integers make the title unparseable. Display titles are untrusted text.
    Run list: a later adapter performs three queries and passes each result here: runs created today (UTC), runs with status
    in_progress, runs with status queued; each result has items, the API total_count, and `complete` (false when the adapter could
    not read every page within RUN_LIST_PAGES_MAX pages of 100 or a read failed). The API returns at most 1000 results per filtered
    query (RUN_LIST_PAGES_MAX * GITHUB_PAGE_SIZE).
    Cap rules, in this order:
      a. inProgress.complete false or queued.complete false -> err 'caps.run-list-unavailable' (never under-count).
      b. createdToday.totalCount > 1000 -> the daily count is createdToday.totalCount (over any daily limit; limits max 1000).
         Otherwise createdToday.complete false -> err 'caps.run-list-unavailable'. Otherwise the daily count is 1 (this run) plus
         the number of distinct items (by id) that are COUNTED, have id !== currentRunId, were created on today's UTC date (an
         unparseable createdAt counts), and are NOT sent by the installation bot (the title parses AND its sender id equals
         botUserId). Unparseable titles COUNT (cost-safe).
      c. The per-author count is 1 (this run) plus the number of distinct items (by id) across inProgress and queued that are
         COUNTED, have id !== currentRunId, have status 'queued' or 'in_progress', and whose title parses with author id equal to
         authorId.
      d. state: 'daily-runs' when dailyCount > dailyLimit; else 'per-author-concurrent-runs' when authorCount > authorLimit; else
         'within'.
    COUNTED: item.path is one of STEWARD_WRAPPER_PATHS, or starts with one of them followed by '@' (a ref suffix), AND item.event is
    'pull_request_target' or 'issues'. Runs of other workflows or other events (for example a `pull_request` run with a forged
    title) never count. Duplicate, early-exit, and closure runs of the wrappers still count (approximate overcount by design).

    Existing: packages/core/src/policy/bounds.ts RUN_DISPLAY_TITLE_MAX_LENGTH = 1024 and RUN_LIST_PAGES_MAX = 10 (step 1.1),
    GITHUB_PAGE_SIZE = 100. packages/core/src/vocabulary.ts (step 1.2): SENDER_TYPES, SenderType, CapState ('within' | 'daily-runs'
    | 'per-author-concurrent-runs'). packages/core/src/result.ts: ok(value); err(code, cause, message, details = []) ->
    { ok: false, failure: { code, cause, outcome: 'inconclusive', message, details } }.

    Required API of packages/core/src/ownership/caps.ts (exact names; export nothing else):
      export const STEWARD_WRAPPER_PATHS = ['.github/workflows/steward-pr.yml', '.github/workflows/steward-issues.yml'] as const;
      export interface RunNameFields {
        readonly kind: 'pr' | 'issue'; readonly number: number; readonly authorId: number; readonly eventName: string;
        readonly action: string; readonly senderId: number; readonly senderType: SenderType;
      }
      export function buildRunName(fields: RunNameFields): string;  // throws RangeError when the result would not parse
      export function parseRunName(title: string): RunNameFields | null;
      export interface RunListItem {
        readonly id: number; readonly path: string; readonly event: string; readonly status: string;
        readonly createdAt: string; readonly displayTitle: string;
      }
      export interface RunListQueryResult { readonly items: readonly RunListItem[]; readonly totalCount: number; readonly complete: boolean }
      export interface CapEvaluationInput {
        readonly createdToday: RunListQueryResult; readonly inProgress: RunListQueryResult; readonly queued: RunListQueryResult;
        readonly now: Date; readonly botUserId: number; readonly authorId: number; readonly currentRunId: number;
        readonly dailyLimit: number; readonly authorLimit: number;
      }
      export interface CapEvaluation {
        readonly state: CapState; readonly dailyCount: number; readonly dailyLimit: number;
        readonly authorCount: number; readonly authorLimit: number;
      }
      export type CapsFailureCode = 'caps.run-list-unavailable';
      export function runListQueryDate(now: Date): string;   // now.toISOString().slice(0, 10)
      export function evaluateCaps(input: CapEvaluationInput): Result<CapEvaluation, CapsFailureCode>;
    Failure: err('caps.run-list-unavailable', 'github-unavailable', 'The run list could not be read completely.'). Never throws.

    Conventions: ESM relative imports end in '.js'; `import type` for types; tsconfig strict, noUncheckedIndexedAccess,
    exactOptionalPropertyTypes; ESLint recommended (no-control-regex on). No dynamic RegExp. Prettier (single quotes, semicolons,
    trailing commas, printWidth 132) only on this step's .ts files. No comments except short WHY; no planning identifiers in source
    or titles. Tests pure; build hostile characters with String.fromCharCode (newline 10, U+202E 0x202e, U+200B 0x200b, fullwidth
    digit one 0xff11, Arabic-Indic digit one 0x0661). Do not edit packages/core/src/index.ts. parseRunName is the ONLY exported
    function whose name begins with load, validate, resolve, parse, capture, or check.
- actions: |
    1. FIRST, verify the base: `grep -c "export const RUN_DISPLAY_TITLE_MAX_LENGTH = 1024;" packages/core/src/policy/bounds.ts` prints
       1 and `grep -c "export const CAP_STATES" packages/core/src/vocabulary.ts` prints 1. If either prints 0, STOP and report status
       missing-base naming the missing step (1.1 or 1.2) in the report file; do not fetch, merge, or improvise.
    2. Create packages/core/src/ownership/caps.ts exactly as specified.
    3. Create packages/core/src/ownership/caps.test.ts (describe 'run-name tags and caps'); a helper builds RunListItem values with
       path '.github/workflows/steward-pr.yml', event 'pull_request_target', status 'in_progress', createdAt on the test's UTC day,
       and a title from buildRunName. Plain it() tests with exactly these titles:
       - 'run names round-trip through the parser' (pr and issue; example
         'steward pr 12 author 2095171 event pull_request_target edited sender 2095171 User')
       - 'hostile run name with a newline is rejected' (valid title + String.fromCharCode(10) + 'x'; and a newline between two valid
         titles)
       - 'hostile run name with leading zeros is rejected'
       - 'hostile run name with non-ASCII digits is rejected'
       - 'hostile run name over the length bound is rejected' (a valid prefix padded past 1024 characters)
       - 'hostile run name with an unknown sender type is rejected' ('user', 'App')
       - 'hostile run name with extra text is rejected' (leading or trailing space, double space, trailing ' x')
       - 'hostile run name with unsafe integer ids is rejected' ('99999999999999999999' as author id)
       - 'hostile run name with bidi or zero-width text is rejected'
       - 'only wrapper runs from accepted events count' (other path, event 'pull_request' on a wrapper path, and a
         '.github/workflows/steward-pr.yml@refs/heads/master' path that does count)
       - 'the daily count excludes runs sent by the installation bot'
       - 'unparseable titles count toward the daily cap'
       - 'this run counts once toward each cap' (current run id present in the lists is not double counted; absent it still counts 1)
       - 'runs created on another UTC day do not count'
       - 'a daily count over the limit is queued as daily-runs'
       - 'the per-author count uses queued and in-progress runs' (other authors and completed statuses excluded; an id present in
         both lists counts once)
       - 'a per-author count over the limit is queued'
       - 'the daily cap is reported before the per-author cap'
       - 'duplicate and early-exit runs still count'
       - 'an incomplete run listing fails before commitment' (each of the three results incomplete; failure code and outcome
         'inconclusive')
       - 'a total over the result ceiling is over the daily cap' (totalCount 1001 with complete false -> ok, state 'daily-runs',
         dailyCount 1001)
    4. Run: pnpm exec prettier --write packages/core/src/ownership/caps.ts packages/core/src/ownership/caps.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/ownership/caps.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.10.json -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.10.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['run names round-trip through the parser','hostile run name with a newline is rejected','hostile run name with leading zeros is rejected','hostile run name with non-ASCII digits is rejected','hostile run name over the length bound is rejected','hostile run name with an unknown sender type is rejected','hostile run name with extra text is rejected','hostile run name with unsafe integer ids is rejected','hostile run name with bidi or zero-width text is rejected','only wrapper runs from accepted events count','the daily count excludes runs sent by the installation bot','unparseable titles count toward the daily cap','this run counts once toward each cap','runs created on another UTC day do not count','a daily count over the limit is queued as daily-runs','the per-author count uses queued and in-progress runs','a per-author count over the limit is queued','the daily cap is reported before the per-author cap','duplicate and early-exit runs still count','an incomplete run listing fails before commitment','a total over the result ceiling is over the daily cap'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/ownership/caps.ts packages/core/src/ownership/caps.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/ownership/caps.ts packages/core/src/ownership/caps.test.ts -> exit 0
    7. grep -rnE "node:(fs|http|https|net|dns|tls|child_process)|from 'fs'|fetch\(|new RegExp" packages/core/src/ownership/caps.ts
       -> no output (exit 1)
    8. grep -c "export function parseRunName" packages/core/src/ownership/caps.ts -> prints 1
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/ownership/caps.ts packages/core/src/ownership/caps.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
