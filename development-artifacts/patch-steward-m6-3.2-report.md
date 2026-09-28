- status: pass
- base: 4f5d5ab996dfc0d09ef285e4251f13c2c8aafdd9
- changes: |
    packages/core/src/pipeline/gate.ts: extracted `GateCapture`, `gateCaptureSubmission`, `GateHandoffInput`,
    `buildGateHandoff`, and `gateContractLogLines` from `runGate`'s inline capture/classification/findings/causes/
    stages/early-exit/handoff/log-line logic. `runGate` now calls `gateCaptureSubmission(captureContext,
    input.submission)`, builds the handoff via `buildGateHandoff(capture, { run, policyRevision, budgetRemaining })`,
    and prefixes `gateContractLogLines(capture)` with the policy log line, using the capture's fields for
    GateOutput (submission, baseCommit, mode, classification, requiredStages). Added imports for CaptureFailureCode,
    BudgetRemaining, RecordCause. Behavior and output shapes unchanged.
    packages/core/src/pipeline/gate-capture.test.ts: new file, describe 'gate capture', six tests exactly titled per
    the packet, exercising gateCaptureSubmission, buildGateHandoff, gateContractLogLines, and their equivalence with
    runGate, using fixtures/github/testbed/repository.json and issue-29.json, fixtures/submissions/defect-complete.txt,
    the template policy loaded via loadPolicy({ kind: 'file', ... }), and a CaptureContext built with
    createGitHubClient/createGitHubBudget (retriesPerRequest 0).
    Ran `pnpm exec prettier --write` on both files (gate.ts unchanged, test file reformatted).
- acceptance: |
    1. pnpm vitest run packages/core/src/pipeline/gate-capture.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.2.json
       -> "JSON report written to ..."; EXIT 0
    2. node -e "...titles check..." -> titles ok
    3. git diff --quiet 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/pipeline/gate.test.ts packages/core/src/pipeline/screen.test.ts packages/core/src/pipeline/screen-scenarios.fixture.test.ts packages/core/src/evidence/golden-reports.fixture.test.ts fixtures packages/cli; echo "unchanged $?"
       -> unchanged 0
    4. pnpm vitest run -> Test Files 164 passed (164); Tests 3068 passed (3068)
    5. pnpm typecheck -> exit 0 (no output)
    6. pnpm exec eslint packages/core/src/pipeline/gate.ts packages/core/src/pipeline/gate-capture.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/pipeline/gate.ts packages/core/src/pipeline/gate-capture.test.ts
       -> "All matched files use Prettier code style!"; exit 0
    8. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/gate-capture.test.ts -> 0 (grep exit 1)
    9. node -e "...control/bidi/zero-width char scan..." -> clean
- deviations: none
