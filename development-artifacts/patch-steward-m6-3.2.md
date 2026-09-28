# Step 3.2

- id: 3.2
- depends_on: []
- route: mechanical
- objective: Split the local gate's capture-and-handoff logic in packages/core/src/pipeline/gate.ts into exported building blocks (`gateCaptureSubmission`, `buildGateHandoff`, `gateContractLogLines`) that the hosted gate will reuse, with `runGate` behavior byte-for-byte unchanged.
- files_in_scope:
    - packages/core/src/pipeline/gate.ts
    - packages/core/src/pipeline/gate-capture.test.ts
    - development-artifacts/patch-steward-m6-3.2-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: the hosted gate job runs its steps in a different order than the local gate (trusted policy load, then the ownership
    listing, then capture, then caps) and builds the handoff record only after the caps read, so it needs the capture part and the
    handoff builder of `runGate` as separate functions. The local CLI path (`runGate`, `screenSubmission`) must not change at all:
    its tests, the golden reports, and the local screening scenarios must pass without edits.

    Read packages/core/src/pipeline/gate.ts first. `runGate` today: bootstrap client -> readRepository -> loadPolicy -> policy
    failure mapping -> run budget client -> CaptureContext -> issue branch (captureIssue, buildSubmissionRecord when
    capture.record is null, classification { type: 'issue', issueKind }, baseCommit null) or PR branch (capturePullRequest,
    classification { type: 'pull_request', category, consistent, plausible }, baseCommit = capture.snapshot.base_commit) ->
    findings (HandoffFinding list mapped from contract.findings) -> causes (contract.inconclusive mapped, subjects sliced to
    RECORD_LIST_MAX_ITEMS) -> requiredStages -> earlyExit -> handoff object literal -> logLines -> ok(GateOutput).

    Required API added to gate.ts (exact names; names verified unique across packages/core/src and packages/cli/src):
      export interface GateCapture {
        readonly submission: SubmissionRecord;
        readonly contract: ContractResult;
        readonly classification: ClassificationInput;
        readonly baseCommit: string | null;
        readonly issueKind: IssueKind | null;
        readonly findings: readonly HandoffFinding[];
        readonly causes: readonly RecordCause[];            // RecordCause from '../records/decision.js'
        readonly requiredStages: readonly PipelineStage[];
        readonly earlyExit: 'contract-needs-changes' | 'contract-inconclusive' | null;
        readonly mode: Mode;                                 // contract.effective_mode
      }
      export async function gateCaptureSubmission(
        context: CaptureContext,
        submission: { readonly type: SubmissionType; readonly number: number },
      ): Promise<Result<GateCapture, CaptureFailureCode>>;
        // exactly the current capture, record, classification, findings, causes, stages, and early-exit logic, using
        // context.policy for requiredStages(..., policy.stages.per_category); failures returned as the capture failure.
      export interface GateHandoffInput {
        readonly run: { readonly run_id: string | number; readonly run_attempt: number };
        readonly policyRevision: string;
        readonly budgetRemaining: BudgetRemaining;          // type from './budget.js'
      }
      export function buildGateHandoff(capture: GateCapture, input: GateHandoffInput): unknown;
        // returns exactly the object runGate builds today: { handoff_version: HANDOFF_VERSION, phase: 'gate', run: { run_id,
        // run_attempt }, snapshot_hash: capture.submission.snapshot_hash, policy_revision, round: 0, budget_remaining,
        // early_exit, findings, causes, stage_results: [], next_round_plan: null } (same key order)
      export function gateContractLogLines(capture: GateCapture): readonly string[];
        // [`contract disposition ${contract.disposition}`, ...contract.warnings.map((w) => `warning ${w.code}`),
        //  ...causes.map((c) => `cause ${c.cause} ${c.code} at gate`)]
    runGate must then use them: after the policy load and client creation, `gateCaptureSubmission(captureContext,
    input.submission)`; on failure return { ok: false, stage: 'capture', failure, repository: repo.fullName, loadedPolicy: loaded
    } as today; handoff = buildGateHandoff(capture, { run: input.run, policyRevision: loaded.revision.id, budgetRemaining:
    initialBudget(policy, { githubRequests: runBudget.requestsUsed() }) }); logLines = [`policy ${sourceLabel} revision
    ${loaded.revision.id}`, ...gateContractLogLines(capture)]; GateOutput fields from the capture (submission, baseCommit, mode,
    classification, requiredStages). GateInput, GateOutput, GateResult, GateFailureStage, ScreenPolicySource,
    SCREEN_POLICY_FAILURE_CODES keep their exact shapes. Keep the budget used by capture identical (initialBudget is computed after
    capture, as today).

    Test helpers: copy what you need from packages/core/src/pipeline/gate.test.ts (makeFetch route map keyed by pathname,
    fakeResolver, bodyFrom, fakeTransport, readJsonFixture, withBody, templatePolicyPath, TESTBED_REPO, T_BASE); recorded responses
    fixtures/github/testbed/repository.json and issue-29.json; body text fixtures/submissions/defect-complete.txt (LF-normalized);
    the policy via loadPolicy({ kind: 'file', path: templatePolicyPath() }) from '../policy/loader.js'; CaptureContext { client:
    createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }), fetch }), repository:
    TESTBED_REPO, policy, policyRevision: loaded.revision.id, attachmentResolver, attachmentTransport, authorResponses: [] }.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters. Do not edit packages/core/src/index.ts (gate.ts is already
    root-exported, so the new names appear at the root now). New names must not start with load, validate, resolve, parse,
    capture, or check. No temp files, no child processes, no network in the new test.
- actions: |
    1. Refactor packages/core/src/pipeline/gate.ts per context. Do not touch any other source or test file.
    2. Create packages/core/src/pipeline/gate-capture.test.ts (describe 'gate capture'), titles exactly:
       - 'gate capture returns the submission, contract, and plan': issue 29 with the defect-complete body -> ok; submission.type
         'issue', submission.number 29; classification { type: 'issue', issueKind: 'defect' }; baseCommit null; earlyExit null;
         mode equals contract.effective_mode.
       - 'gate capture reports an early exit for an unstructured issue': body null -> earlyExit 'contract-needs-changes';
         findings contain code 'submission.unstructured'.
       - 'the gate handoff binds a numeric run and the given budget': buildGateHandoff(capture, { run: { run_id: 36081628326,
         run_attempt: 2 }, policyRevision: 'b'.repeat(40), budgetRemaining: initialBudget(policy, { githubRequests: 7 }) }) passes
         validateHandoff(handoff, { previous: null, gate: null, maxRounds: 2 }) (from './handoff.js'); its run is { run_id:
         36081628326, run_attempt: 2 }, snapshot_hash equals capture.submission.snapshot_hash, budget_remaining equals the input.
       - 'gate capture matches the local gate': runGate (from './gate.js') with the same routes, the template policy as
         { kind: 'local-file', path }, token null, run { run_id: 'local-20260927T101500Z-3f9a1c2e', run_attempt: 1 },
         fixedClock('2026-09-27T10:15:00.000Z') -> its handoff early_exit, findings, causes and its submission snapshot_hash equal
         those of buildGateHandoff over gateCaptureSubmission for the same inputs.
       - 'gate contract log lines name the disposition and causes': the unstructured capture -> first line
         'contract disposition needs-changes'; every line matches /^(contract disposition|warning|cause) /.
       - 'gate capture passes through a capture failure': the issue route answers 500 on every call (policy retries 0 via the
         client budget) -> ok false with failure.code 'github.server-error'.
    3. Run: pnpm exec prettier --write packages/core/src/pipeline/gate.ts packages/core/src/pipeline/gate-capture.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/gate-capture.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.2.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.2.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['gate capture returns the submission, contract, and plan','gate capture reports an early exit for an unstructured issue','the gate handoff binds a numeric run and the given budget','gate capture matches the local gate','gate contract log lines name the disposition and causes','gate capture passes through a capture failure'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. git diff --quiet 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/pipeline/gate.test.ts packages/core/src/pipeline/screen.test.ts packages/core/src/pipeline/screen-scenarios.fixture.test.ts packages/core/src/evidence/golden-reports.fixture.test.ts fixtures packages/cli; echo "unchanged $?"
       -> prints exactly: unchanged 0
    4. pnpm vitest run -> exit 0 (includes the unchanged local gate tests, golden reports, and screening scenarios)
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/pipeline/gate.ts packages/core/src/pipeline/gate-capture.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/pipeline/gate.ts packages/core/src/pipeline/gate-capture.test.ts -> exit 0
    8. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/gate-capture.test.ts
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/gate.ts packages/core/src/pipeline/gate-capture.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (restores gate.ts, removes the new test file).
