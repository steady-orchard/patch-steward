# Step 3.14

- id: 3.14
- depends_on: [3.3, 3.5, 3.6]
- route: mechanical
- objective: Add `prepareHostedRunEvidence`, which turns a validated gate context, its handoff record, and the gate's loaded policy into the decision (for runnable and early-exit runs) or the waiting state (for queued runs) and the evidence-store groups to commit, with no network access, as packages/core/src/pipeline/hosted-evidence.ts.
- files_in_scope:
    - packages/core/src/pipeline/hosted-evidence.ts
    - packages/core/src/pipeline/hosted-evidence.test.ts
    - development-artifacts/patch-steward-m6-3.14-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: the hosted publish job applies the existing decision to the GATE's handoff record (no stage jobs exist yet, so a runnable
    run ends 'inconclusive' with cause 'stage-incomplete', exactly as the local runner's pass-through phases do; an early exit
    publishes its contract outcome 'needs-changes' or 'inconclusive'; freshness input is 'current'); a queued run publishes a
    waiting run directory instead. The run directory bytes must equal what the local store would write for the same inputs, except
    that the report's evidence location is the hosted store URL and there is no local-run notice.

    Base check (files changed in steps 3.3, 3.5, 3.6): packages/core/src/pipeline/gate-context.ts exports
    gateContextClassification and type GateContextRecord; packages/core/src/evidence/prepare-waiting.ts exports
    prepareWaitingEvidence; packages/core/src/evidence/prepare-records.ts exports runEvidenceGroups.

    Existing code to reuse (read it): packages/core/src/pipeline/publish-phase.ts publishLocalRun (prepareFindings(handoff.findings,
    findingTemplateContext(submission, policy, defaultBranch)), localDecisionInput(handoff, runnerCauses, requiredStages,
    decisionFindings(prepared)), decideOutcome with try/catch and kind !== 'outcome' -> err('pipeline.decision-invalid',
    'steward-defect', 'The decision could not be made.'), the extra log lines `decision row ${row} outcome ${outcome}` and
    `decision cause ${cause} ${code}`), packages/core/src/evidence/publish.ts prepareRunEvidence(RunEvidencePreparation) with
    `localRun: false` and `evidenceLocation`, packages/core/src/evidence/git-store.ts hostedEvidenceLocation(store,
    targetRepository, storePath) and types EvidenceStoreLocation, EvidenceStoreGroup, packages/core/src/evidence/layout.ts
    runStorePath(type, number, runId, runAttempt), types RunPhaseLatency (evidence/metrics.ts), LoadedPolicy, HandoffRecord,
    Outcome, RunEvidenceFailureCode (publish.ts), WaitingEvidenceFailureCode (prepare-waiting.ts), EvidenceGroupFailureCode
    (prepare-records.ts), EvidenceRedactFn (evidence/redact-records.ts).

    Required API (exact names; export nothing else; names verified unique across packages/core/src and packages/cli/src):
      export interface HostedEvidenceInput {
        readonly context: GateContextRecord;
        readonly handoff: HandoffRecord;
        readonly loadedPolicy: LoadedPolicy;
        readonly stewardVersion: string;
        readonly store: EvidenceStoreLocation;
        readonly arrivalAt: string;          // this run's own ownership artifact API created_at
        readonly publishStartedAt: string;
        readonly finishedAt: string;
        readonly publishRequests: number;    // GitHub requests publish made so far
        readonly retries: number;
        readonly logLines: readonly string[];   // publish lines, written after context.log_lines
        readonly credentials: readonly string[];
      }
      export type HostedRunEvidence =
        | { readonly kind: 'outcome'; readonly outcome: Outcome; readonly decisionRow: number; readonly storePath: string;
            readonly location: string; readonly groups: readonly EvidenceStoreGroup[] }
        | { readonly kind: 'waiting'; readonly storePath: string; readonly location: string;
            readonly groups: readonly EvidenceStoreGroup[] };
      export type HostedEvidenceFailureCode = RunEvidenceFailureCode | WaitingEvidenceFailureCode | EvidenceGroupFailureCode |
        'pipeline.decision-invalid';
      export async function prepareHostedRunEvidence(input: HostedEvidenceInput, options?: { readonly redact?: EvidenceRedactFn;
        readonly decide?: (input: DecisionInput) => DecisionResult }): Promise<Result<HostedRunEvidence, HostedEvidenceFailureCode>>;

    Rules:
    - runId = context.run.run_id, runAttempt = context.run.run_attempt (the GATE attempt, even when publish is a later attempt).
      storePath = runStorePath(context.subject.type, context.subject.number, runId, runAttempt); location =
      hostedEvidenceLocation(store, context.repository.full_name, storePath).
    - phases = [{ phase: 'gate', seconds: (completed_at - started_at) / 1000 (never negative), recordedAt: context.completed_at },
      { phase: 'publish', seconds: (finishedAt - publishStartedAt) / 1000 (never negative), recordedAt: finishedAt }].
    - githubRequests = context.github_requests + input.publishRequests; logLines = [...context.log_lines, ...input.logLines].
    - disposition 'runnable' or 'early-exit': decide as publishLocalRun does with runnerCauses [] and requiredStages
      context.required_stages; then prepareRunEvidence({ assembly: { runId, runAttempt, startedAt: context.started_at,
      gateCompletedAt: context.completed_at, finishedAt, phases, stewardVersion, loadedPolicy, policyLoadedAt:
      context.policy.loaded_at, submission: context.submission, baseCommit: context.base_commit, mode: context.mode, findings:
      prepared, decision, githubRequests, retries }, classification: gateContextClassification(context), defaultBranch:
      context.repository.default_branch, logLines: [...logLines, decision lines], credentials, localRun: false, createdAt:
      finishedAt, evidenceLocation: location }, { redact }); groups = runEvidenceGroups({ storePath: prepared.storePath, files,
      manifestBytes, metrics }). Result kind 'outcome' with outcome and decisionRow = decision.row.
    - disposition 'queued': context.cap must be non-null with state 'daily-runs' or 'per-author-concurrent-runs' (else
      err('evidence.record-invalid', 'steward-defect', 'An evidence record failed its schema.')); prepareWaitingEvidence({ runId,
      runAttempt, startedAt: context.started_at, queuedAt: context.completed_at, finishedAt, phases, stewardVersion, loadedPolicy,
      policyLoadedAt: context.policy.loaded_at, submission: context.submission, baseCommit: context.base_commit, mode:
      context.mode, githubRequests, retries, waiting: { reason: cap.state, counts: { daily_count, daily_limit, author_count,
      author_limit }, arrivalAt }, logLines, credentials }, { redact }); groups via runEvidenceGroups. Result kind 'waiting'.
    - Never throw (try/catch -> err('evidence.write-failed', 'steward-defect', 'The evidence write failed.')).

    Test data: build the context and handoff by hand. Submission: copy makeSubmission() from the top of
    packages/core/src/evidence/prepare.test.ts but with repository 'octo/demo', type 'issue', number 29, issue_kind 'defect',
    category null, template { form: 'defect', version: 1 }, head_commit null, target_branch null, fields { 'expected-behavior':
    'x' } (adjust to whatever submissionRecordSchema requires for an issue; parse it). loadedPolicy = { revision: { kind:
    'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' }, policy: DEFAULT_CHECKLIST_POLICY, authoritative: true }.
    context: gateContextRecordSchema.parse({ schema_version: 1, record_type: 'gate-context', run: { run_id: 36081628326,
    run_attempt: 1 }, repository: { full_name: 'octo/demo', id: 700001, default_branch: 'main' }, subject: { type: 'issue', number:
    29 }, disposition, snapshot_hash: submission.snapshot_hash, policy: { revision: 'b'.repeat(40), commit: 'a'.repeat(40), ref:
    'main', loaded_at: '2026-09-28T10:00:01.000Z' }, store: { type: 'orphan-branch', repository: 'octo/demo', branch:
    'steward-evidence' }, submission, base_commit: null, mode: 'observe', classification: { type: 'issue', issue_kind: 'defect' },
    required_stages: ['references', 'claim', 'reproduction'], cap, github_requests: 12, started_at: '2026-09-28T10:00:00.000Z',
    completed_at: '2026-09-28T10:00:04.000Z', log_lines: ['disposition ' + disposition] }). handoff: handoffRecordSchema.parse({
    handoff_version: 1, phase: 'gate', run: { run_id: 36081628326, run_attempt: 1 }, snapshot_hash, policy_revision: 'b'.repeat(40),
    round: 0, budget_remaining: initialBudget(DEFAULT_CHECKLIST_POLICY, { githubRequests: 12 }), early_exit, findings, causes: [],
    stage_results: [], next_round_plan: null }) where the early exit case uses early_exit 'contract-needs-changes' and one blocking
    finding like makeFindings()[0] in prepare.test.ts (adapt field to an issue field). store = { repository: { owner: 'octo', name:
    'demo' }, branch: 'steward-evidence' }; arrivalAt '2026-09-28T10:00:05Z'; publishStartedAt '2026-09-28T10:00:10.000Z';
    finishedAt '2026-09-28T10:00:20.000Z'; publishRequests 8; retries 0; logLines ['publish line']; credentials [].

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters. Import specifiers must not contain llm, model, copilot, openai,
    anthropic, sandbox, container, docker, or runner. Do not edit packages/core/src/index.ts or any existing file. Tests are pure: no
    temp files, no child processes, no network.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const chk=[['packages/core/src/pipeline/gate-context.ts','export function gateContextClassification'],['packages/core/src/evidence/prepare-waiting.ts','export async function prepareWaitingEvidence'],['packages/core/src/evidence/prepare-records.ts','export function runEvidenceGroups']];const miss=chk.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s)).map(c=>c.join(' '));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/pipeline/hosted-evidence.ts per context.
    3. Create packages/core/src/pipeline/hosted-evidence.test.ts (describe 'hosted run evidence'), plain it(...) with EXACTLY these
       titles:
       - 'a runnable run ends inconclusive with incomplete stages': kind 'outcome', outcome 'inconclusive'; groups[0].directory
         'runs/issue-29/36081628326-1', mode 'exact', files include decision.json, report.json, report.md, run.json,
         submission.json, policy-revision.json, logs/steward.txt, manifest.json; groups[1].directory 'metrics/2026-09' with file
         '36081628326-1.json'; the decision.json causes include cause 'stage-incomplete'.
       - 'an early exit publishes the contract outcome': outcome 'needs-changes'.
       - 'a queued run prepares a waiting run directory': disposition 'queued', cap { state: 'daily-runs', daily_count: 51,
         daily_limit: 50, author_count: 1, author_limit: 2 } -> kind 'waiting'; waiting.json present with arrival_at
         '2026-09-28T10:00:05Z'; no decision.json.
       - 'the report points at the hosted evidence location': report.md bytes contain
         'https://github.com/octo/demo/tree/steward-evidence/octo/demo/runs/issue-29/36081628326-1' and do not contain
         REPORT_LOCAL_RUN_NOTICE (from '../report/templates.js'); location equals that URL.
       - 'gate and publish latencies are recorded': the metrics file holds latency events with stages 'gate' (seconds 4) and
         'publish' (seconds 10).
       - 'gate log lines precede publish log lines': logs/steward.txt has 'disposition runnable' before 'publish line'.
       - 'run records carry the gate attempt and request count': run.json run_attempt 1 and budget.github_requests 20.
    4. Run: pnpm exec prettier --write packages/core/src/pipeline/hosted-evidence.ts packages/core/src/pipeline/hosted-evidence.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/hosted-evidence.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.14.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.14.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['a runnable run ends inconclusive with incomplete stages','an early exit publishes the contract outcome','a queued run prepares a waiting run directory','the report points at the hosted evidence location','gate and publish latencies are recorded','gate log lines precede publish log lines','run records carry the gate attempt and request count'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/pipeline/hosted-evidence.ts packages/core/src/pipeline/hosted-evidence.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/pipeline/hosted-evidence.ts packages/core/src/pipeline/hosted-evidence.test.ts -> exit 0
    7. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process|fetch\(" packages/core/src/pipeline/hosted-evidence.ts packages/core/src/pipeline/hosted-evidence.test.ts
       -> prints two lines ending in :0 (grep exit status 1 is expected)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/hosted-evidence.ts packages/core/src/pipeline/hosted-evidence.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
