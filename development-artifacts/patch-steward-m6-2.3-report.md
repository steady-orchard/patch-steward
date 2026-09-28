- status: pass
- base: af7afd88a4e1500f7df85d4181fd7a0d063eb740
- changes: |
    packages/core/src/evidence/publish.ts: added `RunEvidencePreparation` (assembly, classification, defaultBranch, logLines,
    credentials, localRun, createdAt, optional evidenceLocation), `RunEvidenceInput extends RunEvidencePreparation` (+evidenceDir),
    `PreparedEvidenceFile`, and `PreparedRunEvidence extends Omit<PublishedRun, 'directory'>` (files, metrics, manifestBytes).
    Split the former `publishRunEvidence` body into `prepareRunEvidence(input: RunEvidencePreparation, options)`: computes
    storePath via runStorePath, validates the repository with `repositoryStorePath(submission.repository, storePath)` from
    layout.ts (no evidenceDir, no repositoryStoreRoot, no staging path, no writeRunDirectory), sets
    `sources.storePath = input.evidenceLocation ?? storePath`, and returns ok({ storePath, report, checkSummary, run, submission,
    policyRevision, findings, decision, reportRecord, manifest, files: [...files, log], metrics: { path, bytes }, manifestBytes }).
    Same try/catch -> 'evidence.write-failed' on throw. `publishRunEvidence` now: validates the store root with
    repositoryStoreRoot first (same failure order as before), calls prepareRunEvidence, calls writeRunDirectory with the prepared
    files/metrics/manifestBytes and a staging path from stagingStorePath, and returns PublishedRun copied field by field from the
    prepared value plus the written directory (no spread). report-input.ts already used sources.storePath only as the evidence
    location; no change was needed there (out of scope for this step anyway).
    packages/core/src/evidence/prepare.test.ts (new): describe 'prepared run evidence', { timeout: 30000 }, with the four
    required it(...) titles, using input builders copied from publish.test.ts (RUN_ID, trustedPolicy, makeSubmission,
    makeFindings, ScenarioOptions extended with runId/localRun/evidenceLocation, buildInput, listFiles), temp dirs prefixed
    'm6-p2-prep-' removed in finally with the required rmSync options. The runId override in the hosted-location test uses the
    numeric literal 36081628326 (RunAssemblyInput.runId is string | number; runStorePath only substitutes the numeric
    "id-attempt" form for a number, matching the packet's expected storePath 'runs/pr-12/36081628326-1'). The invalid-repository
    test overrides assembly.submission.repository with 'bad/../x' cast to SubmissionRecord, which fails recordRepositorySchema
    inside repositoryStorePath and yields failure.code 'evidence.layout-invalid'.
- acceptance: |
    1. pnpm vitest run packages/core/src/evidence/prepare.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.3.json
       -> exit 0 (verified via `echo exit=$?` -> exit=0; output file removed afterward, is not part of files_in_scope)
    2. node -e "...titles ok..." -> printed: titles ok
    3. pnpm vitest run packages/core/src/evidence packages/core/src/pipeline -> Test Files 25 passed (25), Tests 234 passed (234)
    4. git diff --quiet HEAD -- packages/core/src/evidence/publish.test.ts packages/core/src/evidence/publish-failures.test.ts
       packages/core/src/evidence/golden-reports.fixture.test.ts fixtures/reports -> exit=0 (no changes to those paths)
    5. grep -c "export async function prepareRunEvidence" packages/core/src/evidence/publish.ts -> 1
    6. grep -c "export async function publishRunEvidence" packages/core/src/evidence/publish.ts -> 1
    7. pnpm vitest run -> Test Files 154 passed (154), Tests 2932 passed (2932)
    8. pnpm typecheck -> exit 0, no output
    9. pnpm exec eslint packages/core/src/evidence/publish.ts packages/core/src/evidence/prepare.test.ts -> exit 0, no output
    10. pnpm exec prettier --check packages/core/src/evidence/publish.ts packages/core/src/evidence/prepare.test.ts ->
        "All matched files use Prettier code style!"
    11. leak-check script -> "exit 0 before 0 after 0" / "no leak"
    12. control/bidi/zero-width character scan over publish.ts and prepare.test.ts -> "clean"
- deviations: none
