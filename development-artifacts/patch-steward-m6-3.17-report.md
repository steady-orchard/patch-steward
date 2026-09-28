- status: pass
- base: f45ee79adf559782672cb5781526c2faa66ed8fe
- changes: |
    Added packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts: a fixture-tier suite (describe 'hosted gate
    scenarios') driving runHostedGate against fixtures/events/ payloads and the shared hosted world / store world fakes.
    Implements the 13 required it(...) titles exactly:
    - authenticates every fixtures/events/ file against a matching test-bed environment, expecting
      issues-opened-pull-request.json to fail 'gate.event-invalid'.
    - asserts the ownership listing (/actions/artifacts?) precedes /issues/29, and the policy ref read precedes both.
    - a verified echo (issues-edited-by-bot.json with synthetic receipts) captures and uploads nothing.
    - a title-only edit (issues-edited.json after mutating world.issues.get(29).title) keeps the owner ('duplicate',
      summary mentions 'kept').
    - a body edit (issues-edited.json after mutating the issue body) commits a new owner ('runnable', changed
      snapshot_hash).
    - a reopened issue (issues-reopened.json) commits whatever the snapshot ('runnable').
    - a tie (two same-createdAt artifacts) and an incomplete listing (createdAt 'not-a-date') both still commit
      ('runnable').
    - an unavailable listing (500 override) fails 'ownership.listing-unavailable'; a unique newest artifact with
      non-zip bytes fails 'ownership.record-invalid'; both leave no 'files' property on the result.
    - a failure before commitment (invalid policy -> 'gate.policy-invalid'; 500 on /actions/runs ->
      'caps.run-list-unavailable') leaves world.artifacts() unchanged in both cases.
    - an over-cap submission (per_author_concurrent_runs: 1, one in-progress run for the same author) is 'queued' with
      an ownership record cap of author_count 2 / author_limit 1.
    - closures (issues-closed.json, issues-closed-by-maintainer.json, issues-deleted.json,
      pull-request-target-closed-merged.json) each return exactly one 'closure' file, record_only 'true', and decode
      to the expected resolution ('closed-by-author', 'merged') with the expected paired_run (or null for the PR,
      which has no uploaded pull-request ownership artifact).
    - a fork pull request (pull-request-target-opened-fork.json) is ok, with outputs.policy_revision equal to
      world.policyTreeId() and disposition one of 'runnable'/'early-exit'/'queued'.
    - hostile event text (issues-edited-hostile.json title and body) never appears in decoded file bytes, output
      values, log lines, or summaries.
    Ran `pnpm exec prettier --write` on the new file only (reported unchanged on the final run).
- acceptance: |
    1. pnpm vitest run packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.17.json
       -> exit 0; "Test Files 1 passed (1)"; "Tests 30 passed (30)"

    2. node -e "...titles ok check..."
       -> titles ok

    3. NODE_OPTIONS='--import=data:text/javascript,globalThis.fetch=async()=>{throw(0)}' pnpm vitest run packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts
       -> exit 0; "Test Files 1 passed (1)"; "Tests 30 passed (30)"

    4. pnpm vitest run
       -> exit 0; "Test Files 178 passed (178)"; "Tests 3238 passed (3238)"

    5. pnpm typecheck
       -> exit 0 (no diagnostics printed)

    6. pnpm exec eslint packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts
       -> exit 0, no output

    7. pnpm exec prettier --check packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts
       -> exit 0; "Checking formatting...\nAll matched files use Prettier code style!"

    8. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts
       -> prints 0 (grep exit 1)

    9. node -e "...control/bidi/zero-width char scan..." packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts
       -> clean
- deviations: |
    Two of the required assertions ("both return no files at all") were implemented as `expect('files' in result).toBe(false)`
    rather than `expect(result.files).toEqual([])`, because HostedGateResult's ok:false branch has no `files` property at all
    (only ok:true results carry `files`); asserting an empty array on a value that does not exist would be a TypeScript error
    under the strict tsconfig used by pnpm typecheck. This still verifies "no files at all" for the failure path.
    Uploaded ownership artifacts always use workflowRunId equal to the originating run's actual run_id (WORLD_RUN_ID), since
    decodeOwnershipRecord's caller passes the artifact's workflow_run.id as the expected run id and rejects a mismatch with
    'ownership.record-invalid'; using an arbitrary workflowRunId (as first attempted) is not compatible with a valid unique
    record read.
