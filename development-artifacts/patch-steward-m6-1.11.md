# Step 1.11

- id: 1.11
- depends_on: [1.2]
- route: mechanical
- objective: Extend the evidence layout with waiting, supersession, repository-prefix, and latest-run-directory helpers, and the manifest with the optional run_kind key.
- files_in_scope:
    - packages/core/src/evidence/layout.ts
    - packages/core/src/evidence/layout.test.ts
    - packages/core/src/evidence/manifest.ts
    - packages/core/src/evidence/manifest.test.ts
    - development-artifacts/patch-steward-m6-1.11-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest), commands run in Git Bash from the worktree root.
    Domain: the evidence store layout under `<owner>/<repo>/` (of the target repository) is: run directories
    `runs/<pr|issue>-<n>/<run_id>-<run_attempt>/` with a manifest, and metrics files `metrics/<YYYY-MM>/<run_id>-<run_attempt>.json`.
    Hosted screening adds: (1) WAITING runs (over a cap): a run directory holding exactly run.json, submission.json,
    policy-revision.json, waiting.json, logs/steward.txt, and manifest.json, and NO decision.json, report.json, report.md, or
    findings; the manifest gains an OPTIONAL key `run_kind` ('outcome' or 'waiting'; absent means 'outcome', so every existing
    manifest stays valid and existing outcome manifests stay byte-identical; manifest_version stays 1); (2) SUPERSESSION records at
    `runs/<pr|issue>-<n>/supersessions/<run_id>-<run_attempt>.json` with metrics `metrics/<YYYY-MM>/<run_id>-<run_attempt>-supersession.json`
    (YYYY-MM of the record time); (3) a git store where every path is prefixed `<owner>/<repo>/` of the target repository; (4) a gate
    fallback that picks the latest published run directory: the greatest (run_id, run_attempt) numerically among directory names
    `<digits>-<digits>`.

    Existing code to read first: packages/core/src/evidence/layout.ts (RUN_FILES frozen object of the seven outcome run files;
    RUNS_DIRECTORY 'runs'; METRICS_DIRECTORY 'metrics'; runDirectoryName; runStorePath(type, number, runId, runAttempt);
    metricsStorePath(startedAt, runId, runAttempt); recordTypeForPath(path) returning a RecordType, null for non-record files, or
    undefined outside the layout; repositoryStoreRoot(evidenceDir, repository) validating with recordRepositorySchema and rejecting
    names '.' and '..'; EvidenceLayoutFailureCode = 'evidence.layout-invalid'). packages/core/src/evidence/manifest.ts
    (evidenceManifestSchema: strictObject with superRefine that requires every RUN_FILES path; EvidenceManifestInput;
    buildEvidenceManifest builds a candidate object and parses it). packages/core/src/evidence/golden-reports.fixture.test.ts and
    other evidence tests pin the existing bytes: they must keep passing unchanged.
    From step 1.2: RECORD_TYPES in packages/core/src/records/common.ts includes 'waiting'; packages/core/src/vocabulary.ts exports
    RUN_KINDS, runKindSchema, type RunKind ('outcome' | 'waiting').

    Required additions to packages/core/src/evidence/layout.ts (exact names):
      export const WAITING_RUN_FILES = Object.freeze({ run: 'run.json', submission: 'submission.json',
        policyRevision: 'policy-revision.json', waiting: 'waiting.json', log: 'logs/steward.txt' });
      export const SUPERSESSIONS_DIRECTORY = 'supersessions';
      export function supersessionStorePath(type: SubmissionType, number: number, runId: number, runAttempt: number): string;
        // 'runs/pr-12/supersessions/36081628326-1.json'
      export function supersessionMetricsStorePath(recordedAt: string, runId: number, runAttempt: number): string;
        // 'metrics/2026-09/36081628326-1-supersession.json' (month from new Date(recordedAt).toISOString().slice(0, 7))
      export function repositoryStorePath(repository: string, storePath: string): Result<string, EvidenceLayoutFailureCode>;
        // '<owner>/<name>/<storePath>'; same repository validation as repositoryStoreRoot; storePath must be non-empty, must not
        // start with '/', must not contain '\' (backslash), and no '/'-separated segment may be '', '.', or '..';
        // failure: err('evidence.layout-invalid', 'steward-defect', 'The repository name cannot form an evidence path.')
      export function latestRunDirectoryName(names: readonly string[]):
        { readonly name: string; readonly runId: number; readonly runAttempt: number } | null;
        // consider only names matching /^([1-9][0-9]{0,19})-([1-9][0-9]{0,9})$/ whose numbers are safe integers; greatest runId,
        // then greatest runAttempt; null when none
      recordTypeForPath: add the case WAITING_RUN_FILES.waiting ('waiting.json') -> 'waiting'.
    Required changes to packages/core/src/evidence/manifest.ts:
      - evidenceManifestSchema gains `run_kind: runKindSchema.optional()` (place it after run_attempt).
      - superRefine: runKind = manifest.run_kind ?? 'outcome'; the required run files are Object.values(RUN_FILES) for 'outcome'
        and Object.values(WAITING_RUN_FILES) for 'waiting' (replace the current RUN_FILES-only logic, keep the existing message
        format `manifest is missing the required run file "<path>"`); for 'outcome' a file path 'waiting.json' is an issue
        ('waiting record file in an outcome run'); for 'waiting' a file path 'decision.json', 'report.json', 'report.md', or one
        starting with 'findings/' is an issue ('outcome file in a waiting run'). All other checks unchanged.
      - EvidenceManifestInput gains `readonly runKind?: RunKind;` and buildEvidenceManifest adds `run_kind: input.runKind` to the
        candidate ONLY when input.runKind !== undefined (spread `...(input.runKind === undefined ? {} : { run_kind: input.runKind })`),
        so manifests built without runKind are byte-identical to today's.
    Result helpers: ok(value); err(code, cause, message, details = []).
    Conventions: ESM relative imports end in '.js'; `import type` for types; tsconfig strict, noUncheckedIndexedAccess,
    exactOptionalPropertyTypes (never assign undefined to an optional key); ESLint recommended. Prettier (single quotes, semicolons,
    trailing commas, printWidth 132) only on this step's .ts files. No comments except short WHY; no planning identifiers in source or
    titles. Tests pure (no temp files). Do not edit packages/core/src/index.ts (layout and manifest are already root-exported). Do not
    export any function whose name begins with load, validate, resolve, parse, capture, or check.
- actions: |
    1. FIRST, verify the base: `grep -c "'supersession'" packages/core/src/records/common.ts` prints 1 or more and
       `grep -c "export const RUN_KINDS" packages/core/src/vocabulary.ts` prints 1. If either prints 0, STOP and report status
       missing-base ("missing base: step 1.2") in the report file; do not fetch, merge, or improvise.
    2. Apply the layout.ts additions and the manifest.ts changes exactly as specified.
    3. In packages/core/src/evidence/layout.test.ts add plain it() tests with exactly these titles:
       - 'supersession paths follow the approved layout' (pr and issue paths; metrics month from the record time)
       - 'repository store paths prefix the target repository'
         ('steady-orchard/patch-steward-testbed-public' + 'runs/pr-12/36081628326-1')
       - 'repository store paths reject unsafe input' (repository 'bad', 'o/..'; storePath '', '/abs', 'a/../b', 'a//b', './a',
         and 'a' + '\\' + 'b')
       - 'waiting.json maps to the waiting record type'
       - 'the latest run directory is the greatest run id and attempt' ('9-1' vs '10-1' numerically; '36081628326-1' vs
         '36081628326-2')
       - 'run directory selection ignores other names' ('supersessions', '.staging', 'local-20260927T101500Z-3f9a1c2e', '0-1',
         '01-1', '1-0', '99999999999999999999-1'; only those -> null)
    4. In packages/core/src/evidence/manifest.test.ts add plain it() tests with exactly these titles:
       - 'waiting manifests require the waiting run files' (valid with the five files and runKind 'waiting'; missing waiting.json
         fails)
       - 'waiting manifests reject decision, report, and findings files'
       - 'outcome manifests reject a waiting record file'
       - 'manifests without run_kind stay valid' (the existing base manifest parses and has no run_kind key; an explicit
         run_kind 'outcome' also parses)
       - 'run_kind is written only when given' (prettyJson from './pretty-json.js' of the base manifest does not contain
         '"run_kind"'; with runKind 'waiting' it contains '"run_kind": "waiting"')
       Failures assert ok false and failure.code 'evidence.manifest-invalid' (builder) or safeParse success false (schema).
    5. Run: pnpm exec prettier --write packages/core/src/evidence/layout.ts packages/core/src/evidence/layout.test.ts packages/core/src/evidence/manifest.ts packages/core/src/evidence/manifest.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/evidence/layout.test.ts packages/core/src/evidence/manifest.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.11.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.11.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['supersession paths follow the approved layout','repository store paths prefix the target repository','repository store paths reject unsafe input','waiting.json maps to the waiting record type','the latest run directory is the greatest run id and attempt','run directory selection ignores other names','waiting manifests require the waiting run files','waiting manifests reject decision, report, and findings files','outcome manifests reject a waiting record file','manifests without run_kind stay valid','run_kind is written only when given'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run packages/core/src/evidence -> exit 0 (golden reports and every existing evidence test unchanged)
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/evidence/layout.ts packages/core/src/evidence/layout.test.ts packages/core/src/evidence/manifest.ts packages/core/src/evidence/manifest.test.ts
       -> exit 0
    7. pnpm exec prettier --check packages/core/src/evidence/layout.ts packages/core/src/evidence/layout.test.ts packages/core/src/evidence/manifest.ts packages/core/src/evidence/manifest.test.ts
       -> exit 0
    8. cat packages/core/src/evidence/layout.test.ts packages/core/src/evidence/manifest.test.ts | grep -cE "mkdtemp|tmpdir|writeFile"
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/evidence/layout.ts packages/core/src/evidence/layout.test.ts packages/core/src/evidence/manifest.ts packages/core/src/evidence/manifest.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (restores the four files; existing manifests never carried run_kind, so no stored data changes).
