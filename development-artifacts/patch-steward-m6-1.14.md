# Step 1.14

- id: 1.14
- depends_on: [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13]
- route: mechanical
- objective: Export the new hosted-contract modules from the core package root and extend the export, invariant-5, and never-pass conformance tests.
- files_in_scope:
    - packages/core/src/index.ts
    - packages/core/src/exports.test.ts
    - packages/core/src/conformance/invariant-5.test.ts
    - packages/core/src/conformance/never-pass-hosted.test.ts
    - development-artifacts/patch-steward-m6-1.14-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest), commands run in Git Bash from the worktree root.
    Earlier steps added pure modules that are not yet exported from packages/core/src/index.ts (87 lines `export * from './...js';`,
    the last being `export * from './pipeline/screen.js';`). Every exported name was checked unique across core at decomposition; a
    TS2308 "already exported a member" error means a module exported an unplanned name: report fail, do not rename in other files.
    New modules and their exported values (types omitted):
      ./net/zip-entry.js: ZIP_ENTRY_VIOLATION_REASONS, readSingleZipEntry
      ./evidence/blob-id.js: gitBlobId
      ./evidence/store-checks.js: evidenceCompareSchema, verifyAppendOnlyCompare, readBackTipAccepted, verifyReadBackTree
        (types AppendOnlyFailureCode = 'evidence.store-not-append-only', ReadBackFailureCode = 'evidence.readback-mismatch')
      ./records/waiting.js: waitingRecordSchema
      ./records/supersession.js: supersessionRecordSchema
      ./ownership/record.js: OWNERSHIP_ARTIFACT_FILE ('ownership.json'), OWNERSHIP_ARTIFACT_PREFIX ('steward-ownership-'),
        ownershipArtifactName, ownershipEventSchema, ownershipCapSchema, ownershipRecordSchema, encodeOwnershipRecord,
        decodeOwnershipRecord(bytes, { repository, type, number, artifactName, workflowRunId }) (type OwnershipRecordFailureCode =
        'ownership.record-invalid')
      ./ownership/artifacts.js: newestOwnershipArtifact, artifactRetentionDays, ownershipRetentionShort
      ./ownership/dedup.js: DEDUP_COMMIT_REASONS, DEDUP_DUPLICATE_REASONS, decideDeduplication({ runAttempt, action, echo, listing,
        fallback, captured: { snapshotHash, policyRevision } }), needsOwnershipListing, isVerifiedEcho (type DedupFailureCode =
        'ownership.listing-unavailable' | 'ownership.record-invalid')
      ./ownership/events.js: authenticateEvent(environment: { eventName, repository, repositoryId, ref, serverUrl, apiUrl, runId,
        runAttempt } all strings, payload: Uint8Array), eventIdentity, stewardConcurrencyGroup, closureResolution (type
        EventAuthenticationFailureCode = 'gate.event-invalid')
      ./ownership/caps.js: STEWARD_WRAPPER_PATHS, buildRunName, parseRunName (returns fields or null), runListQueryDate,
        evaluateCaps({ createdToday, inProgress, queued: { items, totalCount, complete }, now, botUserId, authorId, currentRunId,
        dailyLimit, authorLimit }) (type CapsFailureCode = 'caps.run-list-unavailable')
      ./pipeline/job-summary.js: renderJobSummary, fitJobSummary
    Already root-exported modules that gained names in earlier steps (no index change needed): policy/bounds.js (18 constants, e.g.
    OWNERSHIP_SETTLE_DELAY_MS 10000, JOB_SUMMARY_MAX_LENGTH 65536), vocabulary.js (11 vocabularies), records/common.js
    (recordTreeIdSchema, RECORD_TYPES now 12), evidence/layout.js (WAITING_RUN_FILES, SUPERSESSIONS_DIRECTORY 'supersessions',
    supersessionStorePath, supersessionMetricsStorePath, repositoryStorePath, latestRunDirectoryName), evidence/metrics.js
    (buildWaitingMetricsEvents, buildSupersessionMetricsEvents, buildClosureMetricsEvent).
    Result shape: failures are { ok: false, failure: { code, cause, outcome: 'inconclusive', message, details } } and carry no
    `value` key; FAILURE_CAUSES (vocabulary) lists every allowed cause.

    packages/core/src/exports.test.ts: arrays functionExports (it.each 'exports %s as a function'), tupleExports, schemaExports,
    recordExports (objects), and constant tests. packages/core/src/conformance/invariant-5.test.ts: the test
    'invariant 5: every exported load, validate, resolve, parse, capture, and check function rejects invalid input' pins the sorted
    list of root functions matching /^(load|validate|resolve|parse|capture|check)/; the only new such function is parseRunName, which
    sorts between 'parsePullRequestBody' and 'parseStewardVersion'. The first test of that file creates a temp directory with
    mkdtempSync(join(dir, 'invariant5-')) inside an async IIFE and never removes it (one leaked directory per run): fix the leak.
    Existing never-pass tests (conformance/never-pass*.test.ts) use compile-time exhaustive tables `{ readonly [K in Code]: ... }`.

    Conventions: ESM relative imports end in '.js'; `import type` for types; tsconfig strict, noUncheckedIndexedAccess,
    exactOptionalPropertyTypes; ESLint recommended. Prettier (single quotes, semicolons, trailing commas, printWidth 132) only on this
    step's .ts files. No comments except short WHY; no planning identifiers in source or titles. Use plain it() with template-literal
    titles in a for loop (not it.each) for the new never-pass tests. Tests clean up any temp directory they create.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const P={'packages/core/src/net/zip-entry.ts':['ZIP_ENTRY_VIOLATION_REASONS','readSingleZipEntry'],'packages/core/src/evidence/blob-id.ts':['gitBlobId'],'packages/core/src/evidence/store-checks.ts':['evidenceCompareSchema','verifyAppendOnlyCompare','readBackTipAccepted','verifyReadBackTree'],'packages/core/src/records/waiting.ts':['waitingRecordSchema'],'packages/core/src/records/supersession.ts':['supersessionRecordSchema'],'packages/core/src/ownership/record.ts':['OWNERSHIP_ARTIFACT_FILE','OWNERSHIP_ARTIFACT_PREFIX','ownershipArtifactName','ownershipEventSchema','ownershipCapSchema','ownershipRecordSchema','encodeOwnershipRecord','decodeOwnershipRecord'],'packages/core/src/ownership/artifacts.ts':['newestOwnershipArtifact','artifactRetentionDays','ownershipRetentionShort'],'packages/core/src/ownership/dedup.ts':['DEDUP_COMMIT_REASONS','DEDUP_DUPLICATE_REASONS','decideDeduplication','needsOwnershipListing','isVerifiedEcho'],'packages/core/src/ownership/events.ts':['authenticateEvent','eventIdentity','stewardConcurrencyGroup','closureResolution'],'packages/core/src/ownership/caps.ts':['STEWARD_WRAPPER_PATHS','buildRunName','parseRunName','runListQueryDate','evaluateCaps'],'packages/core/src/evidence/layout.ts':['WAITING_RUN_FILES','SUPERSESSIONS_DIRECTORY','supersessionStorePath','supersessionMetricsStorePath','repositoryStorePath','latestRunDirectoryName'],'packages/core/src/evidence/metrics.ts':['buildWaitingMetricsEvents','buildSupersessionMetricsEvents','buildClosureMetricsEvent'],'packages/core/src/pipeline/job-summary.ts':['renderJobSummary','fitJobSummary'],'packages/core/src/policy/bounds.ts':['OWNERSHIP_SETTLE_DELAY_MS'],'packages/core/src/vocabulary.ts':['GATE_DISPOSITIONS'],'packages/core/src/records/common.ts':['recordTreeIdSchema']};const miss=[];for(const [f,names] of Object.entries(P)){const s=fs.existsSync(f)?fs.readFileSync(f,'utf8'):'';for(const n of names){if(!new RegExp('export (async )?(function|const) '+n+'[^A-Za-z0-9_]').test(s))miss.push(f+':'+n)}}console.log(miss.length?'MISSING '+miss.join(' '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base listing the printed MISSING items; do not fetch, merge,
       or improvise.
    2. Append to packages/core/src/index.ts, after the last line, exactly these 11 lines in this order:
       export * from './net/zip-entry.js';
       export * from './evidence/blob-id.js';
       export * from './evidence/store-checks.js';
       export * from './records/waiting.js';
       export * from './records/supersession.js';
       export * from './ownership/record.js';
       export * from './ownership/artifacts.js';
       export * from './ownership/dedup.js';
       export * from './ownership/events.js';
       export * from './ownership/caps.js';
       export * from './pipeline/job-summary.js';
    3. In packages/core/src/exports.test.ts append to functionExports: 'readSingleZipEntry', 'gitBlobId', 'verifyAppendOnlyCompare',
       'readBackTipAccepted', 'verifyReadBackTree', 'ownershipArtifactName', 'encodeOwnershipRecord', 'decodeOwnershipRecord',
       'newestOwnershipArtifact', 'artifactRetentionDays', 'ownershipRetentionShort', 'decideDeduplication', 'needsOwnershipListing',
       'isVerifiedEcho', 'authenticateEvent', 'eventIdentity', 'stewardConcurrencyGroup', 'closureResolution', 'buildRunName',
       'parseRunName', 'runListQueryDate', 'evaluateCaps', 'supersessionStorePath', 'supersessionMetricsStorePath',
       'repositoryStorePath', 'latestRunDirectoryName', 'buildWaitingMetricsEvents', 'buildSupersessionMetricsEvents',
       'buildClosureMetricsEvent', 'renderJobSummary', 'fitJobSummary'; to tupleExports: 'ZIP_ENTRY_VIOLATION_REASONS',
       'DEDUP_COMMIT_REASONS', 'DEDUP_DUPLICATE_REASONS', 'STEWARD_WRAPPER_PATHS'; to schemaExports: 'evidenceCompareSchema',
       'waitingRecordSchema', 'supersessionRecordSchema', 'ownershipRecordSchema', 'ownershipEventSchema', 'ownershipCapSchema'; to
       recordExports: 'WAITING_RUN_FILES'. Add it('exports the hosted contract constants', ...) asserting OWNERSHIP_ARTIFACT_FILE
       'ownership.json', OWNERSHIP_ARTIFACT_PREFIX 'steward-ownership-', SUPERSESSIONS_DIRECTORY 'supersessions',
       OWNERSHIP_SETTLE_DELAY_MS 10000, JOB_SUMMARY_MAX_LENGTH 65536, RECORD_TYPES length 12, and STEWARD_WRAPPER_PATHS equal to
       ['.github/workflows/steward-pr.yml', '.github/workflows/steward-issues.yml'].
    4. In packages/core/src/conformance/invariant-5.test.ts: insert 'parseRunName' into the expected sorted list of the
       load/validate/resolve/parse/capture/check test (between 'parsePullRequestBody' and 'parseStewardVersion'); in the same test,
       next to the parseCategoryValue assertions, add
       expect(core.parseRunName('steward pr 01 author 1 event issues opened sender 1 User')).toBeNull();
       and fix the temp-directory leak in the first test: wrap the loadPolicy call of the IIFE so the directory is removed with
       rmSync(tmp, { recursive: true, force: true }) in a finally block after the result is obtained (take rmSync from the same
       dynamic node:fs import). Change nothing else in that file.
    5. Create packages/core/src/conformance/never-pass-hosted.test.ts importing from '../index.js' only (plus node:fs, node:url,
       vitest):
       a. type HostedFailureCode = EventAuthenticationFailureCode | OwnershipRecordFailureCode | DedupFailureCode | CapsFailureCode
          | AppendOnlyFailureCode | ReadBackFailureCode; a table `const TRIGGERS: { readonly [K in HostedFailureCode]: () =>
          Result<unknown, string> }` with: 'gate.event-invalid' -> authenticateEvent(valid environment, Buffer.from('not json'));
          'ownership.record-invalid' -> decodeOwnershipRecord(Buffer.from('{}'), { repository: 'o/r', type: 'issue', number: 1,
          artifactName: 'steward-ownership-issue-1', workflowRunId: null }); 'ownership.listing-unavailable' ->
          decideDeduplication({ runAttempt: 1, action: 'edited', echo: false, listing: { kind: 'unavailable' }, fallback: null,
          captured: { snapshotHash: 'sha256:' + 'a'.repeat(64), policyRevision: 'b'.repeat(40) } }); 'caps.run-list-unavailable' ->
          evaluateCaps with inProgress.complete false; 'evidence.store-not-append-only' -> verifyAppendOnlyCompare({ status:
          'diverged', ahead_by: 1, behind_by: 1, files: [] }, ['run.json']); 'evidence.readback-mismatch' -> verifyReadBackTree([],
          [{ path: 'run.json', blobId: 'a'.repeat(40) }], 'exact').
       b. describe('never-pass conformance: hosted contracts'): for each code of Object.keys(TRIGGERS), it(`hosted failure code
          ${code} never yields pass`) asserting ok false, failure.code === code, failure.outcome 'inconclusive', FAILURE_CAUSES
          contains failure.cause, and 'value' in result is false.
       c. it('ownership modules import no file system or network module'): list every .ts file in
          fileURLToPath(new URL('../ownership/', import.meta.url)) (expect at least 10 files), and for each assert its text matches
          neither /from\s+['"](node:)?(fs|fs\/promises|http|https|net|dns|tls|child_process)['"]/ nor
          /import\(\s*['"](node:)?(fs|http|https|net|dns|tls|child_process)/ and does not include 'fetch('.
    6. Run: pnpm exec prettier --write packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/invariant-5.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/exports.test.ts packages/core/src/conformance/invariant-5.test.ts packages/core/src/conformance/never-pass-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.14.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.14.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['exports the hosted contract constants','hosted failure code gate.event-invalid never yields pass','hosted failure code ownership.record-invalid never yields pass','hosted failure code ownership.listing-unavailable never yields pass','hosted failure code caps.run-list-unavailable never yields pass','hosted failure code evidence.store-not-append-only never yields pass','hosted failure code evidence.readback-mismatch never yields pass','ownership modules import no file system or network module','invariant 5: every exported load, validate, resolve, parse, capture, and check function rejects invalid input'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm build -> exit 0
    6. node -e "import('./packages/core/dist/index.js').then(m=>{const need=['readSingleZipEntry','gitBlobId','verifyAppendOnlyCompare','readBackTipAccepted','verifyReadBackTree','ownershipArtifactName','encodeOwnershipRecord','decodeOwnershipRecord','newestOwnershipArtifact','artifactRetentionDays','ownershipRetentionShort','decideDeduplication','needsOwnershipListing','isVerifiedEcho','authenticateEvent','eventIdentity','stewardConcurrencyGroup','closureResolution','buildRunName','parseRunName','runListQueryDate','evaluateCaps','supersessionStorePath','supersessionMetricsStorePath','repositoryStorePath','latestRunDirectoryName','buildWaitingMetricsEvents','buildSupersessionMetricsEvents','buildClosureMetricsEvent','renderJobSummary','fitJobSummary','waitingRecordSchema','supersessionRecordSchema','ownershipRecordSchema','evidenceCompareSchema','OWNERSHIP_SETTLE_DELAY_MS','GATE_DISPOSITIONS'];const miss=need.filter(n=>typeof m[n]==='undefined');console.log(miss.length?'MISSING '+miss.join(','):'dist exports ok')})"
       -> prints exactly: dist exports ok
    7. grep -c "^export \* from" packages/core/src/index.ts -> prints 98
    8. pnpm exec eslint packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/invariant-5.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
       -> exit 0
    9. pnpm exec prettier --check packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/invariant-5.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
       -> exit 0
    10. node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const c=()=>fs.readdirSync(T).filter(n=>n.startsWith('invariant5-')).length;const a=c();const r=cp.spawnSync('pnpm vitest run packages/core/src/conformance/invariant-5.test.ts',{shell:true,stdio:'ignore'});const b=c();console.log('exit '+r.status+' before '+a+' after '+b);console.log(r.status===0&&a===b?'no leak':'LEAK')"
        -> last line prints exactly: no leak
    11. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/index.ts packages/core/src/exports.test.ts packages/core/src/conformance/invariant-5.test.ts packages/core/src/conformance/never-pass-hosted.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the root exports and test additions; the modules stay importable by relative path).
