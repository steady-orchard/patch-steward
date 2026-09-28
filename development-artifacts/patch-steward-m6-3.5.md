# Step 3.5

- id: 3.5
- depends_on: []
- route: mechanical
- objective: Add waiting-run evidence preparation (run, submission, policy-revision, and waiting records, the steward log, a waiting manifest, and the queued metrics file, all redacted and bounded like an outcome run) as packages/core/src/evidence/prepare-waiting.ts.
- files_in_scope:
    - packages/core/src/evidence/prepare-waiting.ts
    - packages/core/src/evidence/prepare-waiting.test.ts
    - development-artifacts/patch-steward-m6-3.5-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: a hosted run that is over a cap is committed with disposition `queued` and publishes a WAITING run directory instead of an
    outcome: `run.json`, `submission.json`, `policy-revision.json`, `waiting.json`, `logs/steward.txt`, and `manifest.json` with
    `run_kind: 'waiting'`; no decision, report, or findings. Its metrics file holds a state transition null -> 'queued', one
    latency event per phase, and a cost event (builder already exists). The waiting record is the restart record.

    Model to follow: prepareRunEvidence in packages/core/src/evidence/publish.ts (read it): store path and metrics path, three
    redaction passes (records plus log text; nothing to re-render here; pass 3 checks the manifest is unchanged by redaction and
    fails 'evidence.redaction-invalidated' if any replacement happens), prettyJson serialization (Buffer.from(text, 'utf8')), the
    log truncation to fit limits.evidence.run_bytes (upper manifest first, then logBudget, then the final manifest), and the final
    total check -> 'evidence.too-large' (cause 'budget-exhausted'). Reuse its imports: RUN_FILES/WAITING_RUN_FILES,
    runStorePath, repositoryStorePath, metricsStorePath (layout.js); renderLogText, truncateLogText (logs.js);
    redactEvidenceStrings, mergeRedactionCounts, types (redact-records.js); buildEvidenceManifest, evidenceManifestSchema, type
    EvidenceManifest, type EvidenceManifestFailureCode (manifest.js; the input takes `runKind`); prettyJson (pretty-json.js);
    buildWaitingMetricsEvents, type RunPhaseLatency (metrics.js); BUILT_IN_DETECTORS (../redaction/detectors.js);
    EVIDENCE_LOG_FILE_MAX_BYTES (../policy/bounds.js); runRecordSchema, type RunRecord (../records/run.js); submissionRecordSchema,
    type SubmissionRecord (../records/submission.js); waitingRecordSchema, type WaitingRecord (../records/waiting.js);
    policyRevisionRecordSchema, policyRevisionRecord (../policy/revision-record.js); metricsEventRecordSchema; types LoadedPolicy,
    PreparedEvidenceFile (from './publish.js'), Mode, WaitingReason.

    Required API (exact names; export nothing else; names verified unique across packages/core/src and packages/cli/src):
      export interface WaitingEvidenceInput {
        readonly runId: number;
        readonly runAttempt: number;
        readonly startedAt: string;       // gate start; also picks the metrics month (metricsStorePath)
        readonly queuedAt: string;        // recorded_at of the null -> 'queued' transition (gate completion)
        readonly finishedAt: string;      // run.json finished_at, cost event time, manifest created_at
        readonly phases: readonly RunPhaseLatency[];
        readonly stewardVersion: string;
        readonly loadedPolicy: LoadedPolicy;
        readonly policyLoadedAt: string;
        readonly submission: SubmissionRecord;
        readonly baseCommit: string | null;
        readonly mode: Mode;
        readonly githubRequests: number;
        readonly retries: number;
        readonly waiting: {
          readonly reason: WaitingReason;
          readonly counts: { readonly daily_count: number; readonly daily_limit: number; readonly author_count: number;
            readonly author_limit: number };
          readonly arrivalAt: string;
        };
        readonly logLines: readonly string[];
        readonly credentials: readonly string[];
      }
      export interface PreparedWaitingEvidence {
        readonly storePath: string;                        // runs/<pr|issue>-<n>/<runId>-<runAttempt>
        readonly files: readonly PreparedEvidenceFile[];   // run.json, submission.json, policy-revision.json, waiting.json,
                                                           // logs/steward.txt in exactly this order; manifest excluded
        readonly metrics: PreparedEvidenceFile;            // metrics/<YYYY-MM>/<runId>-<runAttempt>.json
        readonly manifestBytes: Uint8Array;
        readonly run: RunRecord;
        readonly waiting: WaitingRecord;
        readonly manifest: EvidenceManifest;
      }
      export type WaitingEvidenceFailureCode = EvidenceLayoutFailureCode | EvidenceRedactionFailureCode |
        EvidenceManifestFailureCode | 'evidence.record-invalid' | 'evidence.too-large' | 'evidence.write-failed';
      export async function prepareWaitingEvidence(input: WaitingEvidenceInput, options?: { readonly redact?: EvidenceRedactFn }):
        Promise<Result<PreparedWaitingEvidence, WaitingEvidenceFailureCode>>;

    Records (validate each with its schema; a failure -> err('evidence.record-invalid', 'steward-defect', 'An evidence record
    failed its schema.')):
    - run.json: exactly the candidate object that assembleRunRecords in packages/core/src/evidence/assemble.ts builds (same keys and
      order: subject from the submission, commits { base: baseCommit, head: submission.head_commit, group: null },
      owned_check_id null, policy_revision loadedPolicy.revision.id, steward_version, provider/requested_model from
      loadedPolicy.policy.llm or null, reported_model/adapter_version/generation/runner_identity null, mode, started_at,
      finished_at: finishedAt, budget { model_calls: 0, tokens: null, ai_credits: null, container_seconds: 0, executions: 0,
      github_requests, retries }).
    - submission.json: the submission (submissionRecordSchema). policy-revision.json: policyRevisionRecord(loadedPolicy, {
      stewardVersion, loadedAt: policyLoadedAt }) (its failure -> 'evidence.record-invalid').
    - waiting.json: { schema_version: 1, record_type: 'waiting', run_id, run_attempt, subject: { repository:
      submission.repository, type: submission.type, number: submission.number }, state: 'queued', reason, counts,
      snapshot_hash: submission.snapshot_hash, policy_revision: loadedPolicy.revision.id, arrival_at: waiting.arrivalAt,
      recorded_at: finishedAt }.
    - metrics: buildWaitingMetricsEvents({ runId, runAttempt, queuedAt, phases, finishedAt }); serialized as prettyJson(array).
    - Redaction pass 1 over [run, submission, policy-revision, waiting, ...metrics events] records plus [renderLogText(logLines)]
      with { credentials, policyPatterns: policy.evidence.redaction_patterns mapped to { id, pattern }, redact }; the manifest
      redaction block lists BUILT_IN_DETECTORS ids, policy pattern ids, exactValues, and mergeRedactionCounts([pass1.counts],
      ['known-secret', ...detectorIds, ...patternIds]).
    - The whole function is wrapped in try/catch -> err('evidence.write-failed', 'steward-defect', 'The evidence write failed.').

    Test data (copy the patterns at the top of packages/core/src/evidence/prepare.test.ts): trustedPolicy = { revision: { kind:
    'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' }, policy: DEFAULT_CHECKLIST_POLICY, authoritative: true }
    (DEFAULT_CHECKLIST_POLICY from '../submission/default-checklist.js'); makeSubmission() via submissionRecordSchema.parse (repository
    'octo/demo', pull_request 12). Input: runId 36081628326, runAttempt 1, startedAt '2026-09-28T10:00:00.000Z', queuedAt
    '2026-09-28T10:00:04.000Z', finishedAt '2026-09-28T10:00:20.000Z', phases [{ phase: 'gate', seconds: 4, recordedAt:
    '2026-09-28T10:00:04.000Z' }, { phase: 'publish', seconds: 6, recordedAt: '2026-09-28T10:00:20.000Z' }], stewardVersion '0.0.2',
    mode 'observe', githubRequests 20, retries 0, waiting { reason: 'daily-runs', counts: { daily_count: 51, daily_limit: 50,
    author_count: 1, author_limit: 2 }, arrivalAt: '2026-09-28T10:00:05Z' }, logLines ['disposition queued'], credentials [].

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters (build them with String.fromCharCode). Credential samples are built by
    concatenation. Do not edit packages/core/src/index.ts or any existing file. Tests are pure: no temp files, no child processes,
    no network.
- actions: |
    1. Create packages/core/src/evidence/prepare-waiting.ts per context.
    2. Create packages/core/src/evidence/prepare-waiting.test.ts (describe 'waiting evidence'), plain it(...) with EXACTLY these
       titles:
       - 'waiting evidence holds the waiting run files': files paths in order ['run.json', 'submission.json',
         'policy-revision.json', 'waiting.json', 'logs/steward.txt']; storePath 'runs/pr-12/36081628326-1'; metrics.path
         'metrics/2026-09/36081628326-1.json'; manifest.run_kind 'waiting'; evidenceManifestSchema accepts the parsed
         manifestBytes; no file named decision.json, report.json, or report.md.
       - 'the waiting record carries reason, counts, and arrival': waitingRecordSchema parses waiting.json bytes; reason
         'daily-runs', counts as input, arrival_at '2026-09-28T10:00:05Z', snapshot_hash equals the submission's, policy_revision
         'b'.repeat(40).
       - 'waiting metrics record the queued transition': the metrics bytes parse to an array whose first event is kind
         'state-transition' with payload { from: null, to: 'queued' }, then 2 latency events (stages 'gate', 'publish'), then one
         cost event; no event has payload.to other than 'queued'.
       - 'the waiting run record carries the budget and times': run.json run_id 36081628326, run_attempt 1, finished_at
         '2026-09-28T10:00:20.000Z', budget.github_requests 20.
       - 'waiting evidence redacts credentials': sentinel = 'ghp' + '_' + 'W'.repeat(36) added to logLines and credentials ->
         the sentinel appears in no file bytes, metrics bytes, or manifest bytes; manifest.redaction.exact_values >= 1.
       - 'waiting evidence over the byte limit is rejected': a loadedPolicy whose policy.limits.evidence.run_bytes is 65536 (the
         policy minimum; nested object spread copy of DEFAULT_CHECKLIST_POLICY, which keeps the policy valid) and a submission
         built with makeSubmission({ problem: 'x'.repeat(60000) }) -> failure.code 'evidence.too-large'. (Do not use a value below
         65536: the policy-revision record validates the policy and would fail first with 'evidence.record-invalid'.)
       - 'an inconsistent waiting reason fails the record': reason 'daily-runs' with daily_count 3 -> failure.code
         'evidence.record-invalid'.
    3. Run: pnpm exec prettier --write packages/core/src/evidence/prepare-waiting.ts packages/core/src/evidence/prepare-waiting.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/evidence/prepare-waiting.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.5.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.5.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['waiting evidence holds the waiting run files','the waiting record carries reason, counts, and arrival','waiting metrics record the queued transition','the waiting run record carries the budget and times','waiting evidence redacts credentials','waiting evidence over the byte limit is rejected','an inconsistent waiting reason fails the record'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/evidence/prepare-waiting.ts packages/core/src/evidence/prepare-waiting.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/evidence/prepare-waiting.ts packages/core/src/evidence/prepare-waiting.test.ts -> exit 0
    7. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/evidence/prepare-waiting.test.ts
       -> prints 0 (grep exit status 1 is expected)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/evidence/prepare-waiting.ts packages/core/src/evidence/prepare-waiting.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
