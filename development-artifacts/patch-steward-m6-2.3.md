# Step 2.3

- id: 2.3
- depends_on: []
- route: mechanical
- objective: Split run-evidence publication into a pure preparation that returns the exact run-directory, metrics, and manifest bytes plus a local write, so a hosted store can commit the same bytes, and let a hosted run show a store URL as its evidence location.
- files_in_scope:
    - packages/core/src/evidence/publish.ts
    - packages/core/src/evidence/prepare.test.ts
    - development-artifacts/patch-steward-m6-2.3-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    packages/core/src/evidence/publish.ts exports publishRunEvidence(input: RunEvidenceInput, options: RunEvidenceOptions = {}):
    it validates the store root (repositoryStoreRoot(input.evidenceDir, submission.repository)), assembles and redacts the records,
    renders the report and check summary, serializes the run files, metrics, and manifest, enforces limits.evidence.run_bytes, and
    finally calls writeRunDirectory(...) from './local-store.js' (staging directory plus rename) and returns PublishedRun. A later
    hosted publisher must commit EXACTLY the same bytes to a git branch instead of the local disk, so the serialization moves into a
    new exported function and publishRunEvidence becomes preparation + local write. Local behavior and bytes must not change:
    publish.test.ts, publish-failures.test.ts, golden-reports.fixture.test.ts (golden reports under fixtures/reports/), and the
    pipeline tests must pass UNCHANGED (do not edit them).

    Hosted runs also show where evidence lives: the report and check summary render evidence locations from
    ReportRecordSources.storePath (packages/core/src/evidence/report-input.ts uses sources.storePath only as the evidence location:
    localEvidenceLocation(sources.storePath) for the report, sources.storePath for the check summary). A hosted run passes a full
    store URL such as https://github.com/octo/evidence/tree/steward-evidence/octo/demo/runs/pr-12/36081628326-1 and localRun false
    (renderReport adds REPORT_LOCAL_RUN_NOTICE from '../report/templates.js' only when localRun is true).

    Required API changes in publish.ts (exact names):
      export interface RunEvidencePreparation {
        readonly assembly: RunAssemblyInput;
        readonly classification: ClassificationInput;
        readonly defaultBranch: string;
        readonly logLines: readonly string[];
        readonly credentials: readonly string[];
        readonly localRun: boolean;
        readonly createdAt: string;
        readonly evidenceLocation?: string;
      }
      export interface RunEvidenceInput extends RunEvidencePreparation {
        readonly evidenceDir: string;
      }
      export interface PreparedEvidenceFile {
        readonly path: string;
        readonly bytes: Uint8Array;
      }
      export interface PreparedRunEvidence extends Omit<PublishedRun, 'directory'> {
        readonly files: readonly PreparedEvidenceFile[];   // run-directory-relative, manifest excluded, same order as written today (log last)
        readonly metrics: PreparedEvidenceFile;            // store-relative metrics path, e.g. metrics/2026-09/<run-dir>.json
        readonly manifestBytes: Uint8Array;
      }
      export async function prepareRunEvidence(
        input: RunEvidencePreparation,
        options: RunEvidenceOptions = {},
      ): Promise<Result<PreparedRunEvidence, RunEvidenceFailureCode>>;
    RunEvidenceOptions, PublishedRun, RunEvidenceFailureCode, and the publishRunEvidence signature stay as they are.

    prepareRunEvidence = today's publishRunEvidence body with these differences only:
    - no evidenceDir and no repositoryStoreRoot call: right after computing storePath = runStorePath(...), validate the repository
      with repositoryStorePath(submission.repository, storePath) from './layout.js' and return its failure unchanged;
    - no stagingPath and no writeRunDirectory call;
    - in the ReportRecordSources object, storePath: input.evidenceLocation ?? storePath (everything else unchanged);
    - it returns ok({ storePath, report, checkSummary, run, submission, policyRevision, findings, decision, reportRecord, manifest,
      files: [...files, { path: RUN_FILES.log, bytes: logFinal }], metrics: { path: metricsPath, bytes: metricsBytes },
      manifestBytes }) with the same values today's code computes;
    - same try/catch: any throw -> err('evidence.write-failed', 'steward-defect', 'The evidence write failed.').
    publishRunEvidence(input, options) becomes, inside the same try/catch as today:
      const storeRootResult = repositoryStoreRoot(input.evidenceDir, input.assembly.submission.repository); return it on failure;
      const prepared = await prepareRunEvidence(input, options); return it on failure;
      const written = await writeRunDirectory({ storeRoot, storePath: prepared.value.storePath,
        stagingPath: stagingStorePath(input.assembly.runId, input.assembly.runAttempt), files: prepared.value.files,
        metrics: prepared.value.metrics, manifest: prepared.value.manifestBytes }, options.fs ?? nodeEvidenceFs); return it on failure;
      return ok({ directory: written.value.directory, storePath, report, checkSummary, run, submission, policyRevision, findings,
        decision, reportRecord, manifest }) copied field by field from prepared.value (do not spread; PublishedRun has no files,
        metrics, or manifestBytes).
    The failure order of publishRunEvidence therefore stays identical (store root check first).

    Conventions: ESM relative imports end in '.js'; strict tsconfig with noUncheckedIndexedAccess, exactOptionalPropertyTypes,
    noUnusedLocals, noUnusedParameters; Prettier (single quotes, semicolons, trailing commas, printWidth 132) only on this step's
    files; comments only for a non-obvious WHY; no planning identifiers in code or titles. publish.ts is already root-exported, so
    the new names become root exports; they are unique across packages and none starts with load, validate, resolve, parse,
    capture, or check. Do not edit packages/core/src/index.ts. Tests clean their temp directories.
- actions: |
    1. Edit packages/core/src/evidence/publish.ts per context.
    2. Create packages/core/src/evidence/prepare.test.ts (describe 'prepared run evidence', { timeout: 30000 }). Copy the input
       builders from packages/core/src/evidence/publish.test.ts (its imports, RUN_ID, trustedPolicy, makeSubmission, makeFindings,
       ScenarioOptions, buildInput, listFiles) and change only: temp directories use the prefix 'm6-p2-prep-' via
       fs.mkdtempSync(path.join(os.tmpdir(), 'm6-p2-prep-')) and are removed in finally with fs.rmSync(dir, { recursive: true,
       force: true, maxRetries: 5, retryDelay: 100 }); buildInput may take extra optional overrides (runId, localRun,
       evidenceLocation). Use plain it(...) with EXACTLY these titles:
       - 'prepared run files equal the local store bytes': prepare with buildInput(dir) and publish with an identical input into a
         temp dir; for every prepared file compare bytes with the file at path.join(result.directory, ...file.path.split('/'));
         compare manifestBytes with path.join(result.directory, 'manifest.json'); compare metrics.bytes with the file at
         path.join(storeRoot, ...metrics.path.split('/')) where storeRoot = path.resolve(result.directory, '..', '..', '..');
         listFiles(result.directory) equals the sorted prepared paths plus 'manifest.json'; prepared.storePath equals the published
         storePath and prepared.report equals the published report.
       - 'a hosted evidence location replaces the store path in the report': runId 36081628326, localRun false, evidenceLocation
         'https://github.com/octo/evidence/tree/steward-evidence/octo/demo/runs/pr-12/36081628326-1'. Expect storePath
         'runs/pr-12/36081628326-1'; the report includes
         '`https://github.com/octo/evidence/tree/steward-evidence/octo/demo/runs/pr-12/36081628326-1/findings/finding-0001.json`';
         the report does not match /`runs\/pr-12\//; the report does not include REPORT_LOCAL_RUN_NOTICE (import from
         '../report/templates.js'); the checkSummary includes the evidenceLocation string; the metrics path equals
         'metrics/2026-09/36081628326-1.json'.
       - 'without an evidence location the report shows the store path': default input -> the report includes
         '`runs/pr-12/' + RUN_ID + '/findings/finding-0001.json`' and the checkSummary includes 'runs/pr-12/' + RUN_ID.
       - 'an invalid repository fails evidence preparation': a submission whose repository is 'not a repository' is rejected by
         submissionRecordSchema, so instead build a valid input and override assembly.submission with { ...submission, repository:
         'bad/../x' } cast to SubmissionRecord; expect ok false and failure.code 'evidence.layout-invalid'. If that value passes the
         layout check, use any repository string that repositoryStorePath rejects (check layout.ts) and keep the assertion.
    3. Run: pnpm exec prettier --write packages/core/src/evidence/publish.ts packages/core/src/evidence/prepare.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/evidence/prepare.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.3.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p2-2.3.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['prepared run files equal the local store bytes','a hosted evidence location replaces the store path in the report','without an evidence location the report shows the store path','an invalid repository fails evidence preparation'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run packages/core/src/evidence packages/core/src/pipeline -> exit 0
    4. git diff --quiet HEAD -- packages/core/src/evidence/publish.test.ts packages/core/src/evidence/publish-failures.test.ts packages/core/src/evidence/golden-reports.fixture.test.ts fixtures/reports
       -> exit 0
    5. grep -c "export async function prepareRunEvidence" packages/core/src/evidence/publish.ts -> prints 1
    6. grep -c "export async function publishRunEvidence" packages/core/src/evidence/publish.ts -> prints 1
    7. pnpm vitest run -> exit 0
    8. pnpm typecheck -> exit 0
    9. pnpm exec eslint packages/core/src/evidence/publish.ts packages/core/src/evidence/prepare.test.ts -> exit 0
    10. pnpm exec prettier --check packages/core/src/evidence/publish.ts packages/core/src/evidence/prepare.test.ts -> exit 0
    11. node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const c=()=>fs.readdirSync(T).filter(n=>n.startsWith('m6-p2-prep-')).length;const a=c();const r=cp.spawnSync('pnpm vitest run packages/core/src/evidence/prepare.test.ts',{shell:true,stdio:'ignore'});const b=c();console.log('exit '+r.status+' before '+a+' after '+b);console.log(r.status===0&&a===b?'no leak':'LEAK')"
        -> last line prints exactly: no leak
    12. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/evidence/publish.ts packages/core/src/evidence/prepare.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (restores publish.ts and removes prepare.test.ts).
