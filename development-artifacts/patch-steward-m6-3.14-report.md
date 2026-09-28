- status: pass
- base: 1d27f696a600bdc2faea567c8bda18477848ca5b
- changes: |
    packages/core/src/pipeline/hosted-evidence.ts (new): exports HostedEvidenceInput, HostedRunEvidence, HostedEvidenceFailureCode,
    HostedEvidenceOptions, and prepareHostedRunEvidence, which computes storePath/location from the gate context, builds gate+publish
    RunPhaseLatency entries, merges github_requests and log_lines, and for 'queued' disposition validates cap.state and calls
    prepareWaitingEvidence then runEvidenceGroups (kind 'waiting'); for 'runnable'/'early-exit' calls prepareFindings +
    localDecisionInput (reused from publish-phase.ts) + decideOutcome (or options.decide), appends decision log lines, calls
    prepareRunEvidence with localRun:false and evidenceLocation set to the hosted URL, then runEvidenceGroups (kind 'outcome'). The
    whole body is wrapped in try/catch returning err('evidence.write-failed', ...) on unexpected throw, matching the "never throw" rule.
    packages/core/src/pipeline/hosted-evidence.test.ts (new): describe 'hosted run evidence' with the seven required it(...) titles,
    building GateContextRecord/HandoffRecord fixtures by hand per the packet's test-data instructions (issue submission
    'octo/demo'#29, defect template, DEFAULT_CHECKLIST_POLICY as loadedPolicy). Verifies: a runnable run with empty findings and
    empty stage_results ends 'inconclusive' with a decision.json containing 'stage-incomplete', the exact-mode runs/ group file set,
    and a metrics/2026-09 contains-mode group; an early-exit run with one blocking contract finding ends 'needs-changes'; a queued
    run (cap.state 'daily-runs') produces a 'waiting' result with waiting.json and no decision.json; the early-exit report.md
    contains the hosted evidence URL (via the blocker finding's evidence line) and omits REPORT_LOCAL_RUN_NOTICE, and
    result.location equals that URL; the metrics file's latency events record gate (4s) and publish (10s); logs/steward.txt has the
    gate log line before the publish log line; run.json has run_attempt 1 and budget.github_requests 20 (12 + 8).
    development-artifacts/patch-steward-m6-3.14-report.md (new): this report.
- acceptance: |
    pnpm vitest run packages/core/src/pipeline/hosted-evidence.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.14.json
    -> exit 0 (7 passed)

    node -e "...titles check..." -> titles ok

    pnpm vitest run -> 175 files passed, 3153 tests passed, exit 0

    pnpm typecheck -> exit 0 (no output)

    pnpm exec eslint packages/core/src/pipeline/hosted-evidence.ts packages/core/src/pipeline/hosted-evidence.test.ts -> exit 0
    (no output)

    pnpm exec prettier --check packages/core/src/pipeline/hosted-evidence.ts packages/core/src/pipeline/hosted-evidence.test.ts ->
    "Checking formatting...\nAll matched files use Prettier code style!"

    grep -cE "mkdtemp|tmpdir\(|writeFile|child_process|fetch\(" packages/core/src/pipeline/hosted-evidence.ts
    packages/core/src/pipeline/hosted-evidence.test.ts ->
    packages/core/src/pipeline/hosted-evidence.ts:0
    packages/core/src/pipeline/hosted-evidence.test.ts:0

    node -e "...control character scan..." packages/core/src/pipeline/hosted-evidence.ts
    packages/core/src/pipeline/hosted-evidence.test.ts -> clean
- deviations: |
    The "the report points at the hosted evidence location" test uses the early-exit/one-blocking-finding scenario rather than a
    bare runnable/empty-findings scenario: renderFindings only emits the evidence-location code span for shown blocker/uncertainty
    items (not for an empty findings list, and not in provenance or an unreached overflow line), so a scenario with at least one
    blocker finding is the only honest way to make report.md contain the URL without adding contrived content. This does not
    change any exported symbol or the packet's required test title.
