# Step 1.12

- id: 1.12
- depends_on: [1.2]
- route: mechanical
- objective: Add the optional closure-resolution keys to the maintainer-resolution metrics payload and builders for waiting, supersession, and closure metrics events.
- files_in_scope:
    - packages/core/src/records/metrics-event.ts
    - packages/core/src/records/metrics-event.test.ts
    - packages/core/src/evidence/metrics.ts
    - packages/core/src/evidence/metrics.test.ts
    - development-artifacts/patch-steward-m6-1.12-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest), commands run in Git Bash from the worktree root.
    Domain: hosted screening writes metrics files (JSON arrays of metrics-event records). New cases: (1) a WAITING run (over a cap)
    records a state transition null -> 'queued', one latency event per job phase, and a cost event; (2) a SUPERSEDED run gets a
    separate metrics file with one state transition '<its outcome or waiting state>' -> 'superseded'; (3) a CLOSURE (issue or pull
    request closed, or issue deleted) records one 'maintainer-resolution' event with subject kind 'submission', action_kind
    'resolution', dismissal_code null, and three new OPTIONAL payload keys: resolution ('merged' | 'closed-by-author' |
    'closed-by-maintainer' | 'deleted'), paired_run ({ run_id, run_attempt } of the newest committed owner, or null), and
    paired_snapshot_hash (that owner's snapshot hash, or null). The keys are optional so every existing record stays valid and
    unchanged (additive, schema_version stays 1).

    Existing code to read first: packages/core/src/records/metrics-event.ts (metricsEventRecordSchema = discriminated union on
    'kind' of base.extend({...}) entries; the 'maintainer-resolution' payload is currently z.strictObject({ action_kind:
    maintainerActionKindSchema, dismissal_code: <pattern>.nullable() })). packages/core/src/evidence/metrics.ts
    (RunPhaseLatency { phase, seconds, recordedAt }; buildRunMetricsEvents builds candidate objects, parses each with
    metricsEventRecordSchema, and returns err('evidence.record-invalid', 'steward-defect', 'A metrics event failed its schema.') on
    the first failure; RunMetricsFailureCode; metricsFileSchema). Its cost event payload is
    { model_calls: 0, tokens: null, ai_credits: null, container_seconds: 0 }.
    packages/core/src/records/common.ts: recordPositiveIntSchema, recordContentHashSchema. packages/core/src/vocabulary.ts:
    Outcome, WaitingState, SubmissionType, and (step 1.2) resolutionKindSchema / ResolutionKind.

    Required change in packages/core/src/records/metrics-event.ts: the 'maintainer-resolution' payload becomes
      z.strictObject({
        action_kind: maintainerActionKindSchema,
        dismissal_code: <unchanged>,
        resolution: resolutionKindSchema.optional(),
        paired_run: z.strictObject({ run_id: recordPositiveIntSchema, run_attempt: recordPositiveIntSchema }).nullable().optional(),
        paired_snapshot_hash: recordContentHashSchema.nullable().optional(),
      })
    Required additions to packages/core/src/evidence/metrics.ts (exact names):
      export interface WaitingMetricsInput {
        readonly runId: number; readonly runAttempt: number; readonly queuedAt: string;
        readonly phases: readonly RunPhaseLatency[]; readonly finishedAt: string;
      }
      export function buildWaitingMetricsEvents(input: WaitingMetricsInput): Result<readonly MetricsEventRecord[], RunMetricsFailureCode>;
        // [state-transition { from: null, to: 'queued' } at queuedAt, one latency { stage: phase.phase, seconds } per phase at
        //  phase.recordedAt, cost { model_calls: 0, tokens: null, ai_credits: null, container_seconds: 0 } at finishedAt];
        //  subject { kind: 'run', run_id, run_attempt }
      export interface SupersessionMetricsInput {
        readonly runId: number; readonly runAttempt: number; readonly from: Outcome | WaitingState; readonly recordedAt: string;
      }
      export function buildSupersessionMetricsEvents(input: SupersessionMetricsInput): Result<readonly MetricsEventRecord[], RunMetricsFailureCode>;
        // [state-transition { from, to: 'superseded' } at recordedAt]; subject kind 'run'
      export interface ClosureMetricsInput {
        readonly repository: string; readonly type: SubmissionType; readonly number: number; readonly resolution: ResolutionKind;
        readonly pairedRun: { readonly runId: number; readonly runAttempt: number } | null;
        readonly pairedSnapshotHash: string | null; readonly recordedAt: string;
      }
      export function buildClosureMetricsEvent(input: ClosureMetricsInput): Result<MetricsEventRecord, RunMetricsFailureCode>;
        // kind 'maintainer-resolution', subject { kind: 'submission', repository, type, number }, recorded_at recordedAt,
        // payload { action_kind: 'resolution', dismissal_code: null, resolution, paired_run: pairedRun === null ? null :
        // { run_id, run_attempt }, paired_snapshot_hash: pairedSnapshotHash }
    Every builder parses each candidate with metricsEventRecordSchema and returns the existing failure on the first schema failure.
    Do not change buildRunMetricsEvents or metricsFileSchema.

    Conventions: ESM relative imports end in '.js'; `import type` for types; tsconfig strict, noUncheckedIndexedAccess,
    exactOptionalPropertyTypes; ESLint recommended. Prettier (single quotes, semicolons, trailing commas, printWidth 132) only on this
    step's .ts files. No comments except short WHY; no planning identifiers in source or titles. Tests pure (no temp files). Do not
    edit packages/core/src/index.ts (both modules are already root-exported). Do not export any function whose name begins with load,
    validate, resolve, parse, capture, or check.
- actions: |
    1. FIRST, verify the base: `grep -c "export const RESOLUTION_KINDS" packages/core/src/vocabulary.ts` prints 1. If it prints 0,
       STOP and report status missing-base ("missing base: step 1.2") in the report file; do not fetch, merge, or improvise.
    2. Apply the metrics-event.ts change and the metrics.ts additions exactly as specified.
    3. In packages/core/src/records/metrics-event.test.ts add plain it() tests with exactly these titles:
       - 'resolution payload keys are optional' (the existing payload without new keys still parses unchanged)
       - 'resolution payload accepts every resolution kind' (each of the four, with paired_run object or null and
         paired_snapshot_hash hash or null)
       - 'resolution payload rejects an unknown resolution' ('reopened'; also an extra key inside paired_run)
    4. In packages/core/src/evidence/metrics.test.ts add plain it() tests with exactly these titles:
       - 'waiting metrics record the queued transition, latency, and cost' (phases gate and publish; kinds in order
         state-transition, latency, latency, cost; metricsFileSchema accepts the array)
       - 'supersession metrics record one transition to superseded' (from 'inconclusive' and from 'queued')
       - 'closure metrics carry the resolution and paired run'
       - 'closure metrics without a paired owner carry null'
       - 'hosted metrics builders reject invalid input' (recordedAt 'not-a-time'; closure repository 'bad'; each returns ok false
         with failure.code 'evidence.record-invalid')
    5. Run: pnpm exec prettier --write packages/core/src/records/metrics-event.ts packages/core/src/records/metrics-event.test.ts packages/core/src/evidence/metrics.ts packages/core/src/evidence/metrics.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/records/metrics-event.test.ts packages/core/src/evidence/metrics.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.12.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.12.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['resolution payload keys are optional','resolution payload accepts every resolution kind','resolution payload rejects an unknown resolution','waiting metrics record the queued transition, latency, and cost','supersession metrics record one transition to superseded','closure metrics carry the resolution and paired run','closure metrics without a paired owner carry null','hosted metrics builders reject invalid input'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run packages/core/src/evidence -> exit 0 (golden reports and every existing evidence test unchanged)
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/records/metrics-event.ts packages/core/src/records/metrics-event.test.ts packages/core/src/evidence/metrics.ts packages/core/src/evidence/metrics.test.ts
       -> exit 0
    7. pnpm exec prettier --check packages/core/src/records/metrics-event.ts packages/core/src/records/metrics-event.test.ts packages/core/src/evidence/metrics.ts packages/core/src/evidence/metrics.test.ts
       -> exit 0
    8. cat packages/core/src/records/metrics-event.test.ts packages/core/src/evidence/metrics.test.ts | grep -cE "mkdtemp|tmpdir|writeFile"
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/records/metrics-event.ts packages/core/src/records/metrics-event.test.ts packages/core/src/evidence/metrics.ts packages/core/src/evidence/metrics.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (the payload keys are optional, so no stored record depends on them yet).
