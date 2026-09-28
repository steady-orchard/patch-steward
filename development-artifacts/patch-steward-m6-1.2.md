# Step 1.2

- id: 1.2
- depends_on: []
- route: mechanical
- objective: Add the hosted-skeleton vocabularies, the three new record types, and a tree-id schema to core, with tests and export-list updates.
- files_in_scope:
    - packages/core/src/vocabulary.ts
    - packages/core/src/vocabulary.test.ts
    - packages/core/src/records/common.ts
    - packages/core/src/records/common.test.ts
    - packages/core/src/exports.test.ts
    - development-artifacts/patch-steward-m6-1.2-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest), commands run in Git Bash from the worktree root.
    packages/core/src/vocabulary.ts defines closed vocabularies in one pattern, e.g.:
      export const OUTCOMES = ['pass', 'needs-changes', ...] as const;
      export const outcomeSchema = z.enum(OUTCOMES);
      export type Outcome = z.infer<typeof outcomeSchema>;
    It is re-exported from the package root (every new name is unique across core; verified).
    packages/core/src/vocabulary.test.ts has a `vocabularies` array of { name, tuple, schema, expected } that a for-loop turns into
    three tests per entry (titles `${name} matches expected values in order`, `${name} schema accepts every member and rejects invalid
    values`, `${name} has no duplicate values`; the rejection test checks 'PASS', '' and 42 are rejected), plus standalone tests.

    Add these vocabularies (names, schema names, type names, and values exact; values in this order):
      GATE_DISPOSITIONS / gateDispositionSchema / GateDisposition = ['runnable', 'early-exit', 'queued', 'duplicate', 'closure']
      OWNERSHIP_DISPOSITIONS / ownershipDispositionSchema / OwnershipDisposition = ['runnable', 'early-exit', 'queued']
      CAP_STATES / capStateSchema / CapState = ['within', 'daily-runs', 'per-author-concurrent-runs']
      WAITING_REASONS / waitingReasonSchema / WaitingReason = ['daily-runs', 'per-author-concurrent-runs']
      SUPERSESSION_REASONS / supersessionReasonSchema / SupersessionReason = ['newer-owner', 'snapshot-changed']
      RESOLUTION_KINDS / resolutionKindSchema / ResolutionKind = ['merged', 'closed-by-author', 'closed-by-maintainer', 'deleted']
      RUN_KINDS / runKindSchema / RunKind = ['outcome', 'waiting']
      WRAPPER_EVENT_NAMES / wrapperEventNameSchema / WrapperEventName = ['pull_request_target', 'issues']
      PULL_REQUEST_EVENT_ACTIONS / pullRequestEventActionSchema / PullRequestEventAction =
        ['opened', 'synchronize', 'edited', 'reopened', 'ready_for_review', 'closed']
      ISSUE_EVENT_ACTIONS / issueEventActionSchema / IssueEventAction = ['opened', 'edited', 'reopened', 'closed', 'deleted']
      SENDER_TYPES / senderTypeSchema / SenderType = ['User', 'Bot', 'Organization', 'Mannequin']
    Meaning (for tests only): gate dispositions of a hosted run; the first three are committed ownership dispositions; cap states
    name the first exceeded cap; waiting reasons are the exceeded cap states; closure resolutions; evidence run kinds; the two
    wrapper events and the actions each wrapper accepts; GitHub sender types.

    packages/core/src/records/common.ts: RECORD_TYPES is a tuple of 9 record type names ending with 'policy-revision';
    recordTypeSchema = z.enum(RECORD_TYPES). Append 'ownership', 'waiting', 'supersession' (in that order) to RECORD_TYPES. Also add
      export const recordTreeIdSchema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
    (a git tree id; unlike policyRevisionIdSchema it never accepts 'local:<sha256>'). common.test.ts has
    it('record types list the nine records', ...) asserting the 9-element list.
    packages/core/src/exports.test.ts imports `* as core from './index.js'`; it has the arrays `tupleExports` and `schemaExports` fed to
    it.each, and in it('exports the policy constants', ...) the line `expect(core.RECORD_TYPES).toHaveLength(9);`.

    Conventions: ESM relative imports end in '.js'; tsconfig strict with noUncheckedIndexedAccess and exactOptionalPropertyTypes;
    Prettier (single quotes, semicolons, trailing commas, printWidth 132), run only on this step's .ts files, never on
    development-artifacts/. No comments, no planning identifiers in source or titles. Tests pure (no temp files).
    Do not edit packages/core/src/index.ts.
- actions: |
    1. Append the 11 vocabularies from context to the end of packages/core/src/vocabulary.ts in the listed order, each as tuple
       (`as const`), schema (`z.enum(tuple)`), and type (`z.infer`), exactly as the existing entries are written.
    2. In packages/core/src/vocabulary.test.ts import the 22 new values (tuples and schemas) and add one `vocabularies` array entry
       per new vocabulary with the expected values from context. Add two standalone tests in the describe block:
       it('committed dispositions are gate dispositions', ...): every OWNERSHIP_DISPOSITIONS value is in GATE_DISPOSITIONS.
       it('waiting reasons are the exceeded cap states', ...): WAITING_REASONS equals CAP_STATES without 'within', and
       WAITING_STATES contains 'queued'.
    3. In packages/core/src/records/common.ts append 'ownership', 'waiting', 'supersession' to RECORD_TYPES and add
       recordTreeIdSchema (exact code in context) after policyRevisionIdSchema.
    4. In packages/core/src/records/common.test.ts rename the test 'record types list the nine records' to
       'record types list the twelve records' and extend its expected array with the three new names. Add
       it('tree ids reject local revisions', ...): recordTreeIdSchema accepts 'a'.repeat(40) and 'a'.repeat(64); rejects
       'local:' + 'a'.repeat(64), 'A'.repeat(40), 'a'.repeat(39), and 'HEAD'.
    5. In packages/core/src/exports.test.ts change `expect(core.RECORD_TYPES).toHaveLength(9);` to `toHaveLength(12)`, append the 11
       new tuple names to `tupleExports`, and append the 11 new schema names plus 'recordTreeIdSchema' to `schemaExports`.
    6. Run: pnpm exec prettier --write packages/core/src/vocabulary.ts packages/core/src/vocabulary.test.ts packages/core/src/records/common.ts packages/core/src/records/common.test.ts packages/core/src/exports.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/vocabulary.test.ts packages/core/src/records/common.test.ts packages/core/src/exports.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.2.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.2.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['GATE_DISPOSITIONS matches expected values in order','SENDER_TYPES matches expected values in order','PULL_REQUEST_EVENT_ACTIONS matches expected values in order','ISSUE_EVENT_ACTIONS matches expected values in order','committed dispositions are gate dispositions','waiting reasons are the exceeded cap states','record types list the twelve records','tree ids reject local revisions'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/vocabulary.ts packages/core/src/vocabulary.test.ts packages/core/src/records/common.ts packages/core/src/records/common.test.ts packages/core/src/exports.test.ts
       -> exit 0
    6. pnpm exec prettier --check packages/core/src/vocabulary.ts packages/core/src/vocabulary.test.ts packages/core/src/records/common.ts packages/core/src/records/common.test.ts packages/core/src/exports.test.ts
       -> exit 0
    7. grep -c "export const OWNERSHIP_DISPOSITIONS" packages/core/src/vocabulary.ts -> prints 1
    8. grep -c "export const recordTreeIdSchema" packages/core/src/records/common.ts -> prints 1
    9. cat packages/core/src/vocabulary.test.ts packages/core/src/records/common.test.ts | grep -cE "mkdtemp|tmpdir|writeFile"
       -> prints 0 (grep exit status 1 is expected)
    10. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/vocabulary.ts packages/core/src/vocabulary.test.ts packages/core/src/records/common.ts packages/core/src/records/common.test.ts packages/core/src/exports.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit>. Steps 1.6 to 1.13 depend on these names; revert them first if already merged.
