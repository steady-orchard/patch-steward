- status: pass
- base: 9284f6fcdc85c6fd3ca4f6c3b19ceaabdf95e762
- changes: |
    packages/core/src/records/metrics-event.ts: imported resolutionKindSchema and recordContentHashSchema; added optional
    resolution, paired_run ({ run_id, run_attempt } nullable), and paired_snapshot_hash keys to the maintainer-resolution
    payload strictObject.
    packages/core/src/evidence/metrics.ts: imported WaitingState, SubmissionType, ResolutionKind types; added
    WaitingMetricsInput/buildWaitingMetricsEvents (state-transition null->queued, one latency per phase, cost event),
    SupersessionMetricsInput/buildSupersessionMetricsEvents (one state-transition from->superseded), and
    ClosureMetricsInput/buildClosureMetricsEvent (one maintainer-resolution event with resolution, paired_run, and
    paired_snapshot_hash). buildRunMetricsEvents and metricsFileSchema unchanged.
    packages/core/src/records/metrics-event.test.ts: added it() tests 'resolution payload keys are optional', 'resolution
    payload accepts every resolution kind', 'resolution payload rejects an unknown resolution'.
    packages/core/src/evidence/metrics.test.ts: added it() tests 'waiting metrics record the queued transition, latency, and
    cost', 'supersession metrics record one transition to superseded', 'closure metrics carry the resolution and paired
    run', 'closure metrics without a paired owner carry null', 'hosted metrics builders reject invalid input'.
    Ran pnpm exec prettier --write on all four non-report files_in_scope files.
- acceptance: |
    1. pnpm vitest run packages/core/src/records/metrics-event.test.ts packages/core/src/evidence/metrics.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.12.json
       -> JSON report written to C:/w/m6-1.12/node_modules/.m6-p1-1.12.json ; exit 0
    2. node -e "...titles ok check..."
       -> titles ok
    3. pnpm vitest run packages/core/src/evidence
       -> Test Files 15 passed (15); Tests 128 passed (128); exit 0
    4. pnpm vitest run
       -> Test Files 144 passed (144); Tests 2767 passed (2767); exit 0
    5. pnpm typecheck
       -> completed with no output; exit 0
    6. pnpm exec eslint packages/core/src/records/metrics-event.ts packages/core/src/records/metrics-event.test.ts packages/core/src/evidence/metrics.ts packages/core/src/evidence/metrics.test.ts
       -> no output; exit 0
    7. pnpm exec prettier --check packages/core/src/records/metrics-event.ts packages/core/src/records/metrics-event.test.ts packages/core/src/evidence/metrics.ts packages/core/src/evidence/metrics.test.ts
       -> All matched files use Prettier code style! ; exit 0
    8. cat packages/core/src/records/metrics-event.test.ts packages/core/src/evidence/metrics.test.ts | grep -cE "mkdtemp|tmpdir|writeFile"
       -> 0 (grep exit 1)
    9. node -e "...control/bidi/zero-width scan..." on all four source/test files
       -> clean
- deviations: none
