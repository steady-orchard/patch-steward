# Step 3.3

- id: 3.3
- depends_on: []
- route: mechanical
- objective: Add the same-run gate context record and closure record (strict zod schemas, canonical-bytes encoders, bounded decoders with run and repository binding, a handoff-bytes decoder, and classification converters) as packages/core/src/pipeline/gate-context.ts.
- files_in_scope:
    - packages/core/src/pipeline/gate-context.ts
    - packages/core/src/pipeline/gate-context.test.ts
    - development-artifacts/patch-steward-m6-3.3-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: the hosted `gate` and `publish` jobs run on different runners. The gate uploads a same-run artifact `steward-handoff`
    holding `handoff.json` (the existing handoff record, schema unchanged) and `gate-context.json` (this step's gate context
    record), or for closures an artifact `steward-closure` holding `closure.json` (this step's closure record). Publish downloads
    them and validates them before any evidence request: schema (else `pipeline.handoff-invalid`), then run id equal to the
    runner's run id, attempt not above the runner's attempt, and repository name and id equal to the runner's (else
    `pipeline.handoff-binding`). Both codes already exist in packages/core/src/pipeline/sequence.ts (PIPELINE_FAILURE_CODES).
    Canonical JSON bytes are bounded by HANDOFF_MAX_BYTES (8388608) from '../policy/bounds.js'.

    Imports to use: z from 'zod'; from '../records/common.js': recordSchemaVersionSchema, recordPositiveIntSchema,
    recordRepositorySchema, recordContentHashSchema, recordTreeIdSchema, recordCommitIdSchema, recordIdentifierSchema,
    recordTimestampSchema, recordCountSchema, recordTextSchema; submissionRecordSchema from '../records/submission.js';
    metricsEventRecordSchema from '../records/metrics-event.js'; ownershipCapSchema from '../ownership/record.js';
    submissionTypeSchema, ownershipDispositionSchema, modeSchema, pipelineStageSchema, issueKindSchema, categorySchema, CATEGORIES,
    PIPELINE_STAGES from '../vocabulary.js'; canonicalJson from '../canonical-json.js' (returns Result<string>); err, ok, type Result
    from '../result.js'; type ClassificationInput from '../report/templates.js'.

    Required API (exact names and keys; export nothing else; names verified unique across packages/core/src and packages/cli/src):
      export const HANDOFF_ARTIFACT = 'steward-handoff';
      export const CLOSURE_ARTIFACT = 'steward-closure';
      export const HANDOFF_FILE = 'handoff.json';
      export const GATE_CONTEXT_FILE = 'gate-context.json';
      export const CLOSURE_CONTEXT_FILE = 'closure.json';
      export const GATE_CONTEXT_LOG_LINES_MAX = 200;
      export const evidenceStoreRefSchema = z.strictObject({
        type: z.enum(['orphan-branch', 'repository']), repository: recordRepositorySchema, branch: z.string().min(1).max(255) });
      export type EvidenceStoreRef = z.output<typeof evidenceStoreRefSchema>;
      export const classificationRecordSchema = z.discriminatedUnion('type', [
        z.strictObject({ type: z.literal('issue'), issue_kind: issueKindSchema.nullable() }),
        z.strictObject({ type: z.literal('pull_request'), category: categorySchema.nullable(), consistent: z.boolean(),
          plausible: z.array(categorySchema).max(CATEGORIES.length) }) ]);
      export type ClassificationRecord = z.output<typeof classificationRecordSchema>;
      (private) run = z.strictObject({ run_id: recordPositiveIntSchema, run_attempt: recordPositiveIntSchema });
      (private) repository = z.strictObject({ full_name: recordRepositorySchema, id: recordPositiveIntSchema,
        default_branch: z.string().min(1).max(255) });
      (private) subject = z.strictObject({ type: submissionTypeSchema, number: recordPositiveIntSchema });
      (private) policy = z.strictObject({ revision: recordTreeIdSchema, commit: recordCommitIdSchema, ref: recordIdentifierSchema,
        loaded_at: recordTimestampSchema });
      export const gateContextRecordSchema = z.strictObject({
        schema_version: recordSchemaVersionSchema, record_type: z.literal('gate-context'), run, repository, subject,
        disposition: ownershipDispositionSchema, snapshot_hash: recordContentHashSchema, policy, store: evidenceStoreRefSchema,
        submission: submissionRecordSchema, base_commit: recordCommitIdSchema.nullable(), mode: modeSchema,
        classification: classificationRecordSchema, required_stages: z.array(pipelineStageSchema).max(PIPELINE_STAGES.length),
        cap: ownershipCapSchema.nullable(), github_requests: recordCountSchema, started_at: recordTimestampSchema,
        completed_at: recordTimestampSchema, log_lines: z.array(recordTextSchema).max(GATE_CONTEXT_LOG_LINES_MAX),
      }).superRefine(...) with issues when: snapshot_hash !== submission.snapshot_hash; submission.repository !==
        repository.full_name; submission.type !== subject.type or submission.number !== subject.number; (disposition ===
        'early-exit') !== (cap === null); disposition 'runnable' with cap.state !== 'within'; disposition 'queued' with
        cap.state === 'within'; store.type 'orphan-branch' with store.repository !== repository.full_name; subject.type 'issue'
        with base_commit !== null.
      export type GateContextRecord = z.output<typeof gateContextRecordSchema>;
      export const closureContextRecordSchema = z.strictObject({
        schema_version: recordSchemaVersionSchema, record_type: z.literal('closure'), run, repository, subject, policy,
        store: evidenceStoreRefSchema, github_requests_remaining: recordCountSchema, event: metricsEventRecordSchema,
      }).superRefine(...) with issues when: event.kind !== 'maintainer-resolution'; event.subject.kind !== 'submission'; the
        event subject repository, type, or number differs from repository.full_name and subject; store.type 'orphan-branch' with
        store.repository !== repository.full_name.
      export type ClosureContextRecord = z.output<typeof closureContextRecordSchema>;
      export interface HostedRunExpectation { readonly runId: number; readonly maxAttempt: number; readonly repository: string;
        readonly repositoryId: number }
      export type GateContextFailureCode = 'pipeline.handoff-invalid' | 'pipeline.handoff-binding';
      export function encodeGateContext(record: GateContextRecord): Result<Uint8Array, 'pipeline.handoff-invalid'>;
      export function encodeClosureContext(record: ClosureContextRecord): Result<Uint8Array, 'pipeline.handoff-invalid'>;
      export function decodeGateContext(bytes: Uint8Array, expected: HostedRunExpectation):
        Result<GateContextRecord, GateContextFailureCode>;
      export function decodeClosureContext(bytes: Uint8Array, expected: HostedRunExpectation):
        Result<ClosureContextRecord, GateContextFailureCode>;
      export function decodeHandoffBytes(bytes: Uint8Array): Result<unknown, 'pipeline.handoff-invalid'>;
      export function classificationRecord(input: ClassificationInput): ClassificationRecord;
      export function gateContextClassification(record: GateContextRecord): ClassificationInput;

    Rules:
    - encode*: safeParse the record with its schema; canonicalJson of the PARSED value; UTF-8 bytes; failure of any of these, or
      byte length > HANDOFF_MAX_BYTES -> err('pipeline.handoff-invalid', 'steward-defect', 'The same-run record failed
      validation.').
    - decode* and decodeHandoffBytes (never throw; wrap in try/catch): byte length > HANDOFF_MAX_BYTES -> invalid with detail token
      'size'; fatal UTF-8 decode failure -> 'encoding'; JSON.parse failure -> 'json'; schema failure (decode* only) -> 'schema'.
      Invalid = err('pipeline.handoff-invalid', 'steward-defect', 'The same-run record failed validation.', [{ code:
      'pipeline.handoff-invalid', path: <token>, message: 'The same-run record failed validation.', line: null, column: null }]).
      decodeHandoffBytes returns ok(parsed JSON value) (its schema is checked later by the existing handoff validator).
    - decode* binding after the schema passes, in this order: run.run_id !== expected.runId -> token 'run'; run.run_attempt >
      expected.maxAttempt -> 'attempt'; repository.full_name !== expected.repository or repository.id !== expected.repositoryId
      -> 'repository'. Binding = err('pipeline.handoff-binding', 'steward-defect', 'The same-run record is not bound to this
      run.', [{ code: 'pipeline.handoff-binding', path: <token>, message: 'The same-run record is not bound to this run.', line:
      null, column: null }]).
    - classificationRecord: issue -> { type: 'issue', issue_kind: input.issueKind }; pull request -> { type: 'pull_request',
      category, consistent, plausible: [...plausible] }. gateContextClassification is the inverse ({ type: 'issue', issueKind }).

    Test data: build a valid SubmissionRecord with submissionRecordSchema.parse like makeSubmission() at the top of
    packages/core/src/evidence/prepare.test.ts (repository 'octo/demo', type 'pull_request', number 12, snapshot_hash 'sha256:' +
    '5'.repeat(64), head_commit 'c'.repeat(40), target_branch 'main'). A valid gate context: run { run_id: 36081628326,
    run_attempt: 1 }, repository { full_name: 'octo/demo', id: 700001, default_branch: 'main' }, subject { type: 'pull_request',
    number: 12 }, disposition 'runnable', snapshot_hash = the submission's, policy { revision: 'b'.repeat(40), commit:
    'a'.repeat(40), ref: 'main', loaded_at: '2026-09-28T10:00:01.000Z' }, store { type: 'orphan-branch', repository: 'octo/demo',
    branch: 'steward-evidence' }, base_commit 'd'.repeat(40), mode 'observe', classification { type: 'pull_request', category:
    'bugfix', consistent: true, plausible: ['bugfix'] }, required_stages ['references', 'claim'], cap { state: 'within',
    daily_count: 3, daily_limit: 50, author_count: 1, author_limit: 2 }, github_requests 12, started_at
    '2026-09-28T10:00:00.000Z', completed_at '2026-09-28T10:00:04.000Z', log_lines ['disposition runnable']. A valid closure event:
    { schema_version: 1, record_type: 'metrics-event', subject: { kind: 'submission', repository: 'octo/demo', type:
    'pull_request', number: 12 }, recorded_at: '2026-09-28T10:00:03.000Z', kind: 'maintainer-resolution', payload: {
    action_kind: 'resolution', dismissal_code: null, resolution: 'merged', paired_run: { run_id: 36081628000, run_attempt: 1 },
    paired_snapshot_hash: 'sha256:' + '5'.repeat(64) } }.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters (build them with String.fromCharCode). Do not edit
    packages/core/src/index.ts. No temp files, no child processes, no network in tests.
- actions: |
    1. Create packages/core/src/pipeline/gate-context.ts per context.
    2. Create packages/core/src/pipeline/gate-context.test.ts (describe 'same-run records'), plain it(...) with EXACTLY these titles:
       - 'a gate context round-trips through canonical bytes': encode then decode with { runId: 36081628326, maxAttempt: 1,
         repository: 'octo/demo', repositoryId: 700001 } -> ok and deep-equal to the input.
       - 'gate context bytes are canonical json': the encoded text equals canonicalJson(parsed input).value and ends without a
         newline.
       - 'a gate context must match its submission record': snapshot_hash 'sha256:' + '6'.repeat(64) -> encode fails
         'pipeline.handoff-invalid'.
       - 'cap presence follows the disposition': 'early-exit' with a cap, 'runnable' with cap null, 'queued' with state 'within',
         'runnable' with state 'daily-runs' -> each fails to encode; 'early-exit' with cap null and 'queued' with { state:
         'daily-runs', daily_count: 51, daily_limit: 50, author_count: 1, author_limit: 2 } encode ok.
       - 'an orphan-branch store must be the target repository': store { type: 'orphan-branch', repository: 'octo/other', ... }
         fails; { type: 'repository', repository: 'octo/evidence', branch: 'steward-evidence' } encodes ok.
       - 'decoding rejects oversize, malformed, and invalid bytes': Buffer.alloc(8388609) -> details[0].path 'size'; bytes [0xff,
         0xfe] -> 'encoding'; '{' -> 'json'; '{}' -> 'schema'; every failure code 'pipeline.handoff-invalid'.
       - 'decoding binds run, attempt, and repository': expected runId 1 -> 'pipeline.handoff-binding' path 'run'; a record with
         run_attempt 2 and maxAttempt 1 -> 'attempt'; the same record with maxAttempt 3 -> ok; repositoryId 700002 ->
         'repository'.
       - 'a closure record round-trips and binds its event': a closure record (run, repository, subject, policy, store as above,
         github_requests_remaining 280, event as in context) encodes and decodes ok; decoding with runId 1 -> 'run'.
       - 'a closure event for another submission is invalid': event subject number 13 -> encode fails 'pipeline.handoff-invalid';
         an event of kind 'latency' -> encode fails.
       - 'handoff bytes decode to json or fail as invalid': '{"a":1}' -> ok { a: 1 }; 'x' -> 'pipeline.handoff-invalid' path
         'json'.
       - 'classification converts between record and report input': both kinds round-trip through classificationRecord and
         gateContextClassification.
    3. Run: pnpm exec prettier --write packages/core/src/pipeline/gate-context.ts packages/core/src/pipeline/gate-context.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/gate-context.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.3.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.3.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['a gate context round-trips through canonical bytes','gate context bytes are canonical json','a gate context must match its submission record','cap presence follows the disposition','an orphan-branch store must be the target repository','decoding rejects oversize, malformed, and invalid bytes','decoding binds run, attempt, and repository','a closure record round-trips and binds its event','a closure event for another submission is invalid','handoff bytes decode to json or fail as invalid','classification converts between record and report input'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/pipeline/gate-context.ts packages/core/src/pipeline/gate-context.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/pipeline/gate-context.ts packages/core/src/pipeline/gate-context.test.ts -> exit 0
    7. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process|fetch\(" packages/core/src/pipeline/gate-context.ts packages/core/src/pipeline/gate-context.test.ts
       -> prints two lines ending in :0 (grep exit status 1 is expected)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/gate-context.ts packages/core/src/pipeline/gate-context.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
