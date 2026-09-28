# Step 1.6

- id: 1.6
- depends_on: [1.2]
- route: mechanical
- objective: Add the version-1 waiting and supersession record schemas to core/records with tests.
- files_in_scope:
    - packages/core/src/records/waiting.ts
    - packages/core/src/records/waiting.test.ts
    - packages/core/src/records/supersession.ts
    - packages/core/src/records/supersession.test.ts
    - development-artifacts/patch-steward-m6-1.6-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest), commands run in Git Bash from the worktree root.
    Domain: a hosted screening run that exceeds a cap ends in the waiting state 'queued' and stores a `waiting.json` record (the
    restart record: later maintenance restarts waiting runs in arrival order). A committed run later found to be stale gets a
    separate `supersession` record (reason 'newer-owner' when a newer ownership artifact exists, 'snapshot-changed' when the live
    snapshot hash or policy revision differs from the recorded one); the successor may be unknown (null).

    Existing building blocks (read them): packages/core/src/records/common.ts exports recordSchemaVersionSchema (literal 1),
    recordPositiveIntSchema (z.int().min(1)), recordCountSchema (z.int().min(0)), recordRepositorySchema ('owner/name'),
    recordContentHashSchema ('sha256:' + 64 hex), recordTimestampSchema (UTC ISO with Z), and, added by step 1.2,
    recordTreeIdSchema (40 or 64 lowercase hex; never 'local:'). packages/core/src/vocabulary.ts exports submissionTypeSchema
    ('issue' | 'pull_request') and, added by step 1.2, waitingReasonSchema ('daily-runs' | 'per-author-concurrent-runs') and
    supersessionReasonSchema ('newer-owner' | 'snapshot-changed'). Existing record files (e.g. records/run.ts) use
    `z.strictObject({...})` and export `xRecordSchema` plus `type XRecord = z.output<typeof xRecordSchema>`.

    Required API (exact names; export nothing else):
    packages/core/src/records/waiting.ts:
      export const waitingRecordSchema = z.strictObject({
        schema_version: recordSchemaVersionSchema,
        record_type: z.literal('waiting'),
        run_id: recordPositiveIntSchema,
        run_attempt: recordPositiveIntSchema,
        subject: z.strictObject({ repository: recordRepositorySchema, type: submissionTypeSchema, number: recordPositiveIntSchema }),
        state: z.literal('queued'),
        reason: waitingReasonSchema,
        counts: z.strictObject({ daily_count: recordCountSchema, daily_limit: recordPositiveIntSchema,
                                 author_count: recordCountSchema, author_limit: recordPositiveIntSchema }),
        snapshot_hash: recordContentHashSchema,
        policy_revision: recordTreeIdSchema,
        arrival_at: recordTimestampSchema,
        recorded_at: recordTimestampSchema,
      }).superRefine(...);
      export type WaitingRecord = z.output<typeof waitingRecordSchema>;
      Refinement (custom issue on path ['reason'] when violated): reason 'daily-runs' requires counts.daily_count >
      counts.daily_limit; reason 'per-author-concurrent-runs' requires counts.daily_count <= counts.daily_limit AND
      counts.author_count > counts.author_limit (the daily cap is reported first).
    packages/core/src/records/supersession.ts:
      export const supersessionRecordSchema = z.strictObject({
        schema_version: recordSchemaVersionSchema,
        record_type: z.literal('supersession'),
        run_id: recordPositiveIntSchema,
        run_attempt: recordPositiveIntSchema,
        subject: z.strictObject({ repository: recordRepositorySchema, type: submissionTypeSchema, number: recordPositiveIntSchema }),
        reason: supersessionReasonSchema,
        successor: z.strictObject({ run_id: recordPositiveIntSchema, run_attempt: recordPositiveIntSchema,
                                    artifact_created_at: recordTimestampSchema }).nullable(),
        recorded_snapshot_hash: recordContentHashSchema,
        live_snapshot_hash: recordContentHashSchema.nullable(),
        recorded_at: recordTimestampSchema,
      }).superRefine(...);
      export type SupersessionRecord = z.output<typeof supersessionRecordSchema>;
      Refinements: reason 'snapshot-changed' requires live_snapshot_hash !== null (issue path ['live_snapshot_hash']); a non-null
      successor must not equal this run (same run_id AND run_attempt) (issue path ['successor']).

    Conventions: ESM relative imports end in '.js' (`import { z } from 'zod';`, `from './common.js'`, `from '../vocabulary.js'`);
    tsconfig strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes; ESLint recommended. Prettier (single quotes, semicolons,
    trailing commas, printWidth 132) only on this step's .ts files. No comments except short WHY; no planning identifiers in source
    or titles. Tests pure (no temp files). Do not edit packages/core/src/index.ts or records/common.ts.
- actions: |
    1. FIRST, verify the base: `grep -c "export const recordTreeIdSchema" packages/core/src/records/common.ts` prints 1 and
       `grep -c "export const supersessionReasonSchema" packages/core/src/vocabulary.ts` prints 1. If either prints 0, STOP and
       report status missing-base ("missing base: step 1.2") in the report file; do not fetch, merge, or improvise.
    2. Create packages/core/src/records/waiting.ts and packages/core/src/records/supersession.ts exactly as specified.
    3. Create packages/core/src/records/waiting.test.ts (describe 'record waiting') with a valid fixture (run_id 36081628326,
       run_attempt 1, subject { repository 'steady-orchard/patch-steward-testbed-public', type 'pull_request', number 12 },
       snapshot 'sha256:' + 'a'.repeat(64), policy_revision 'b'.repeat(40), timestamps like '2026-09-28T10:00:05Z') and exact titles:
       - 'waiting record accepts a queued run over the daily cap'
       - 'waiting record accepts a queued run over the per-author cap'
       - 'waiting record rejects a reason its counts do not show'
       - 'waiting record rejects unknown keys and other states' (extra key; state 'awaiting-approval')
       - 'waiting record rejects a local policy revision' ('local:' + 'a'.repeat(64))
       Also assert canonicalJsonHash(parsed).ok is true for a valid record (import from '../hash.js').
    4. Create packages/core/src/records/supersession.test.ts (describe 'record supersession') with exact titles:
       - 'supersession record accepts a newer-owner record with a successor'
       - 'supersession record accepts a missing successor'
       - 'supersession record requires the live hash for a changed snapshot'
       - 'supersession record rejects itself as successor'
       - 'supersession record rejects unknown keys'
    5. Run: pnpm exec prettier --write packages/core/src/records/waiting.ts packages/core/src/records/waiting.test.ts packages/core/src/records/supersession.ts packages/core/src/records/supersession.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/records/waiting.test.ts packages/core/src/records/supersession.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.6.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.6.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['waiting record accepts a queued run over the daily cap','waiting record accepts a queued run over the per-author cap','waiting record rejects a reason its counts do not show','waiting record rejects unknown keys and other states','waiting record rejects a local policy revision','supersession record accepts a newer-owner record with a successor','supersession record accepts a missing successor','supersession record requires the live hash for a changed snapshot','supersession record rejects itself as successor','supersession record rejects unknown keys'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/records/waiting.ts packages/core/src/records/waiting.test.ts packages/core/src/records/supersession.ts packages/core/src/records/supersession.test.ts
       -> exit 0
    6. pnpm exec prettier --check packages/core/src/records/waiting.ts packages/core/src/records/waiting.test.ts packages/core/src/records/supersession.ts packages/core/src/records/supersession.test.ts
       -> exit 0
    7. cat packages/core/src/records/waiting.test.ts packages/core/src/records/supersession.test.ts | grep -cE "mkdtemp|tmpdir|writeFile"
       -> prints 0 (grep exit status 1 is expected)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/records/waiting.ts packages/core/src/records/waiting.test.ts packages/core/src/records/supersession.ts packages/core/src/records/supersession.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the four new files).
