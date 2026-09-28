- status: pass
- base: 15fae5af5981c0d9835675475dd89ffe1a8661c8
- changes: |
    Added packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts: a `describe('hosted publish scenarios')`
    fixture-tier test with the 12 required `it(...)` titles, plus a private harness (payload/environmentFor/gate/upload/
    gateFilesOf/publish/requireOk) built on hosted-gate.ts, hosted-publish.ts, hosted-environment.ts, hosted-world.test.ts,
    and store-world.test.ts. Covers: evidence-before-summary ordering (last git/refs write and every readback
    `/git/trees/<commit>:` request precede the sole `SUMMARY` marker; the 10000 ms settle `SLEEP` marker follows the ref
    write); newer-owner supersession recording the successor's run/attempt/artifact_created_at while the run directory's
    files stay byte-identical across the supersession commit; snapshot-changed supersession with a non-null differing
    live_snapshot_hash; a tie including this run, an incomplete listing, and an unavailable successor read all failing
    with `publish.freshness-unknown` (with the right `details[0].path`) and writing no supersessions path; a pre-commit
    500 on POST `/git/blobs` leaving `store.head` null and a `` `failed` `` summary with no outcome word; publish reading
    the policy by tree id (`/git/trees/<policy_revision>?recursive=1`) before any `/git/blobs` request and never reading
    `/git/ref/heads/master` or `/contents/.github` first; three binding-mismatch subcases (mismatched `GITHUB_RUN_ID`,
    an edited handoff `run_attempt`, and an own artifact whose record belongs to a different gate run of the same
    submission) each failing before any evidence request; an over-cap gate producing a `waiting.json` (arrival_at
    matching the artifact's createdAt, no `decision.json`) under `queued` status; a closure-only publish producing
    exactly one new `metrics/2026-09/<runId>-1.json` holding one `maintainer-resolution` event with
    `payload.resolution === 'closed-by-author'`; and three sequential submissions (A, edited B, edited C) each
    gated/uploaded/published while every previously-committed file stays byte-identical and `store.commitCount` equals
    the number of evidence commits made. Ran `pnpm exec prettier --write` on the new file only.
- acceptance: |
    $ pnpm vitest run packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.19.json
    exit 0 (29 tests passed: the 12 hosted-publish-scenarios tests plus the 17 tests re-exercised from the imported
    store-world.test.ts / hosted-world.test.ts self-check suites via their .test.js re-exports)

    $ node -e "...titles check..."
    titles ok

    $ NODE_OPTIONS='--import=data:text/javascript,globalThis.fetch=async()=>{throw(0)}' pnpm vitest run packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts
    exit 0 (29 tests passed; no real network reached)

    $ pnpm vitest run
    exit 0 (180 files, 3296 tests passed)

    $ pnpm typecheck
    exit 0

    $ pnpm exec eslint packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts
    exit 0 (no output)

    $ pnpm exec prettier --check packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts
    "Checking formatting...\nAll matched files use Prettier code style!" exit 0

    $ grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts
    0 (grep exit 1, expected)

    $ node -e "...control/bidi/zero-width scan..." packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts
    clean
- deviations: |
    None in file scope. Note for the supervisor: importing hosted-gate-scenarios.fixture.test.ts's sibling helper
    modules (evidence/store-world.test.ts, pipeline/hosted-world.test.ts) via Vitest also re-runs their own internal
    `describe(...)` self-check suites as part of this file's run (29 tests total instead of 12), matching the existing
    pattern already used by hosted-gate-scenarios.fixture.test.ts; this is expected and all of them pass.
