- status: pass
- base: 4f5d5ab996dfc0d09ef285e4251f13c2c8aafdd9
- changes: |
    Created packages/core/src/evidence/prepare-waiting.ts: exports WaitingEvidenceInput, PreparedWaitingEvidence,
    WaitingEvidenceFailureCode, prepareWaitingEvidence, following prepareRunEvidence in publish.ts as the model but
    building only the waiting-run files (run.json, submission.json, policy-revision.json, waiting.json,
    logs/steward.txt), the waiting record, and buildWaitingMetricsEvents-based metrics, with three redaction passes,
    manifest built with runKind 'waiting', and the same log-truncation/byte-budget/too-large logic.
    Created packages/core/src/evidence/prepare-waiting.test.ts with the 7 required it() titles under
    describe('waiting evidence'), covering file order/paths, the waiting record fields, metrics event sequence,
    run record budget/times, credential redaction, over-limit rejection, and inconsistent waiting-reason rejection.
    Ran pnpm exec prettier --write on both files.
- acceptance: |
    pnpm vitest run packages/core/src/evidence/prepare-waiting.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.5.json
    -> EXIT 0

    node -e "...titles ok check..."
    -> titles ok

    pnpm vitest run
    -> Test Files 164 passed (164); Tests 3069 passed (3069); EXIT 0

    pnpm typecheck
    -> EXIT 0 (no output beyond the four tsc invocations)

    pnpm exec eslint packages/core/src/evidence/prepare-waiting.ts packages/core/src/evidence/prepare-waiting.test.ts
    -> EXIT 0

    pnpm exec prettier --check packages/core/src/evidence/prepare-waiting.ts packages/core/src/evidence/prepare-waiting.test.ts
    -> All matched files use Prettier code style! EXIT 0

    grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/evidence/prepare-waiting.test.ts
    -> 0 (grep exit 1)

    node -e "...control/bidi/zero-width character scan..." prepare-waiting.ts prepare-waiting.test.ts
    -> clean
- deviations: none
