# Step 3.6

- id: 3.6
- depends_on: []
- route: mechanical
- objective: Add the evidence-store group builders for hosted commits (run directory plus metrics file, the supersession record plus its metrics file, and the metrics-only closure file) as packages/core/src/evidence/prepare-records.ts.
- files_in_scope:
    - packages/core/src/evidence/prepare-records.ts
    - packages/core/src/evidence/prepare-records.test.ts
    - development-artifacts/patch-steward-m6-3.6-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: hosted publish commits evidence through writeEvidenceCommit (packages/core/src/evidence/store-readback.ts), which takes
    `groups: EvidenceStoreGroup[]` (type from packages/core/src/evidence/git-store.ts: { directory, mode: 'exact' | 'contains',
    files: { path, bytes }[] }). Its validator accepts only these directories: `runs/<pr|issue>-<n>/<runId>-<attempt>` (mode
    'exact', must equal the commit's run), `runs/<pr|issue>-<n>/supersessions` ('contains'), `metrics/<YYYY-MM>` ('contains');
    file paths match /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(\/[A-Za-z0-9][A-Za-z0-9._-]{0,127})?$/. Three commit shapes:
    - a committed run: its run directory (every prepared file plus `manifest.json`) and its metrics file;
    - a supersession (after a confirmed newer owner or changed snapshot): `runs/<kind>-<n>/supersessions/<runId>-<attempt>.json`
      holding a supersession record, and `metrics/<YYYY-MM>/<runId>-<attempt>-supersession.json` holding one state transition
      <published state> -> 'superseded'; the original run directory is never modified;
    - a closure: ONE file `metrics/<YYYY-MM>/<runId>-<attempt>.json` holding a JSON array with one 'maintainer-resolution' event
      (no run directory, no manifest).

    Existing code to use: layout.js: runStorePath, supersessionStorePath(type, number, runId, runAttempt),
    supersessionMetricsStorePath(recordedAt, runId, runAttempt), metricsStorePath(startedAt, runId, runAttempt),
    RUN_MANIFEST_FILE ('manifest.json'); git-store.js: type EvidenceStoreGroup; publish.js: type PreparedEvidenceFile ({ path, bytes
    }); prettyJson (pretty-json.js; returns Result<string>); redactEvidenceStrings (redact-records.js); supersessionRecordSchema,
    type SupersessionRecord (../records/supersession.js); metricsEventRecordSchema, type MetricsEventRecord
    (../records/metrics-event.js); buildSupersessionMetricsEvents (metrics.js; input { runId, runAttempt, from: Outcome |
    WaitingState, recordedAt }); types SubmissionType, SupersessionReason, Outcome, WaitingState (../vocabulary.js).

    Required API (exact names; export nothing else; names verified unique across packages/core/src and packages/cli/src):
      export type EvidenceGroupFailureCode = 'evidence.layout-invalid' | 'evidence.record-invalid' |
        'evidence.redaction-invalidated' | EvidenceRedactionFailureCode;
      export interface RunEvidenceGroupSource {
        readonly storePath: string;                        // runs/<pr|issue>-<n>/<runId>-<attempt>
        readonly files: readonly PreparedEvidenceFile[];   // run-relative, manifest excluded
        readonly manifestBytes: Uint8Array;
        readonly metrics: PreparedEvidenceFile;            // metrics/<YYYY-MM>/<file>.json
      }
      export function runEvidenceGroups(source: RunEvidenceGroupSource): Result<readonly EvidenceStoreGroup[], 'evidence.layout-invalid'>;
        // storePath must match /^runs\/(pr|issue)-[1-9][0-9]{0,9}\/[1-9][0-9]{0,19}-[1-9][0-9]{0,9}$/ and metrics.path
        // /^metrics\/[0-9]{4}-(0[1-9]|1[0-2])\/[A-Za-z0-9-]{1,80}\.json$/, else err('evidence.layout-invalid', 'steward-defect',
        // 'The evidence layout is invalid.'); returns [{ directory: storePath, mode: 'exact', files: [...files, { path:
        // 'manifest.json', bytes: manifestBytes }] }, { directory: <metrics dir>, mode: 'contains', files: [{ path: <metrics
        // file name>, bytes }] }]
      export interface SupersessionEvidenceInput {
        readonly runId: number;
        readonly runAttempt: number;
        readonly subject: { readonly repository: string; readonly type: SubmissionType; readonly number: number };
        readonly reason: SupersessionReason;
        readonly successor: { readonly run_id: number; readonly run_attempt: number; readonly artifact_created_at: string } | null;
        readonly recordedSnapshotHash: string;
        readonly liveSnapshotHash: string | null;
        readonly from: Outcome | WaitingState;             // the published outcome, or 'queued'
        readonly recordedAt: string;
        readonly credentials: readonly string[];
      }
      export interface PreparedRecordEvidence {
        readonly groups: readonly EvidenceStoreGroup[];
        readonly storePaths: readonly string[];            // store-relative file paths, e.g. runs/issue-29/supersessions/5-1.json
      }
      export async function prepareSupersessionEvidence(input: SupersessionEvidenceInput):
        Promise<Result<PreparedRecordEvidence & { readonly record: SupersessionRecord }, EvidenceGroupFailureCode>>;
      export interface ClosureEvidenceInput {
        readonly runId: number;
        readonly runAttempt: number;
        readonly event: MetricsEventRecord;
        readonly credentials: readonly string[];
      }
      export async function prepareClosureEvidence(input: ClosureEvidenceInput):
        Promise<Result<PreparedRecordEvidence, EvidenceGroupFailureCode>>;

    Rules:
    - Supersession record = { schema_version: 1, record_type: 'supersession', run_id, run_attempt, subject, reason, successor,
      recorded_snapshot_hash, live_snapshot_hash, recorded_at } validated with supersessionRecordSchema; metrics =
      buildSupersessionMetricsEvents({ runId, runAttempt, from, recordedAt }); a schema or builder failure ->
      err('evidence.record-invalid', 'steward-defect', 'An evidence record failed its schema.').
    - Closure event must parse with metricsEventRecordSchema AND have kind 'maintainer-resolution' and subject.kind 'submission',
      else 'evidence.record-invalid'. Its file path is metricsStorePath(event.recorded_at, runId, runAttempt).
    - Both: pass the records through redactEvidenceStrings(records, [], { credentials, policyPatterns: [] }) (schemas as above;
      metrics events with metricsEventRecordSchema); a redaction failure is returned as is; any replacement (counts non-empty) ->
      err('evidence.redaction-invalidated', 'steward-defect', 'A structural record changed under redaction.'). Serialize each file
      with prettyJson (supersession record: the object; metrics files: the array) as Buffer.from(text, 'utf8').
    - Directory/file split: a store path 'a/b/c.json' becomes group directory 'a/b' and file path 'c.json'. Supersession groups:
      [{ directory: 'runs/<kind>-<n>/supersessions', mode: 'contains', files: [{ path: '<runId>-<attempt>.json', bytes }] }, {
      directory: 'metrics/<YYYY-MM>', mode: 'contains', files: [{ path: '<runId>-<attempt>-supersession.json', bytes }] }].
      Closure groups: [{ directory: 'metrics/<YYYY-MM>', mode: 'contains', files: [{ path: '<runId>-<attempt>.json', bytes }] }].
    - Never throw (try/catch -> 'evidence.record-invalid').

    Test hint for 'store groups pass the commit layout check': call writeEvidenceCommit (from './store-readback.js') with store {
    repository: { owner: 'octo', name: 'demo' }, branch: 'steward-evidence' }, targetRepository 'octo/demo', the matching subject,
    runId, runAttempt, the groups, maxBytes 10485760, writeRetries 1, and deps { client: createGitHubClient({ token: 'test-token-' +
    'g'.repeat(12), budget: createGitHubBudget({ requests: 5, retriesPerRequest: 0 }), fetch }), writer: createGitHubWriter({
    token: <same>, scope: { kind: 'installation', store: { repository: { owner: 'octo', name: 'demo' }, branch: 'steward-evidence'
    } }, budget: <same budget>, fetch }), sleep: async () => undefined } where fetch always answers
    new Response('{"message":"boom"}', { status: 500 }): the result fails with code 'github.server-error' (not
    'evidence.layout-invalid'), which proves the layout was accepted before the first request.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters. Do not edit packages/core/src/index.ts or any existing file. Tests
    are pure: no temp files, no child processes, no network.
- actions: |
    1. Create packages/core/src/evidence/prepare-records.ts per context.
    2. Create packages/core/src/evidence/prepare-records.test.ts (describe 'evidence store groups'), plain it(...) with EXACTLY
       these titles:
       - 'run groups hold the run directory with its manifest and the metrics file': storePath 'runs/issue-29/36081628326-1',
         files [run.json, logs/steward.txt], metrics.path 'metrics/2026-09/36081628326-1.json' -> 2 groups; first directory the
         storePath, mode 'exact', last file path 'manifest.json'; second directory 'metrics/2026-09', mode 'contains', file
         '36081628326-1.json'.
       - 'invalid run group paths are layout errors': storePath 'runs/issue-29/local-x' and metrics path 'metrics/2026-13/a.json'
         -> 'evidence.layout-invalid'.
       - 'a newer-owner supersession records its successor': reason 'newer-owner', successor { run_id: 36081629000,
         run_attempt: 2, artifact_created_at: '2026-09-28T10:01:00Z' }, liveSnapshotHash null, from 'needs-changes', recordedAt
         '2026-09-28T10:02:00.000Z' -> groups directories 'runs/issue-29/supersessions' and 'metrics/2026-09', file paths
         '36081628326-1.json' and '36081628326-1-supersession.json'; storePaths ['runs/issue-29/supersessions/36081628326-1.json',
         'metrics/2026-09/36081628326-1-supersession.json']; the metrics file parses to one event with payload { from:
         'needs-changes', to: 'superseded' }.
       - 'a snapshot-changed supersession needs the live snapshot': reason 'snapshot-changed' with liveSnapshotHash null ->
         'evidence.record-invalid'; with a hash -> ok and record.live_snapshot_hash equals it.
       - 'a closure commits one metrics file': a maintainer-resolution event (subject { kind: 'submission', repository:
         'octo/demo', type: 'issue', number: 29 }, recorded_at '2026-09-28T10:00:03.000Z', payload { action_kind: 'resolution',
         dismissal_code: null, resolution: 'closed-by-author', paired_run: null, paired_snapshot_hash: null }) -> exactly one group
         'metrics/2026-09' with one file '36081628326-1.json' whose bytes parse to a one-element array equal to the event.
       - 'a closure needs a submission resolution event': a latency event -> 'evidence.record-invalid'.
       - 'store groups pass the commit layout check': run groups, supersession groups, and closure groups each pass through
         writeEvidenceCommit to a first request (see the context hint) -> failure.code 'github.server-error' for all three.
    3. Run: pnpm exec prettier --write packages/core/src/evidence/prepare-records.ts packages/core/src/evidence/prepare-records.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/evidence/prepare-records.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.6.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.6.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['run groups hold the run directory with its manifest and the metrics file','invalid run group paths are layout errors','a newer-owner supersession records its successor','a snapshot-changed supersession needs the live snapshot','a closure commits one metrics file','a closure needs a submission resolution event','store groups pass the commit layout check'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/evidence/prepare-records.ts packages/core/src/evidence/prepare-records.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/evidence/prepare-records.ts packages/core/src/evidence/prepare-records.test.ts -> exit 0
    7. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/evidence/prepare-records.test.ts
       -> prints 0 (grep exit status 1 is expected)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/evidence/prepare-records.ts packages/core/src/evidence/prepare-records.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
