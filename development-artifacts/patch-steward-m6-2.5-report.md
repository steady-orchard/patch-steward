- status: pass
- base: af7afd88a4e1500f7df85d4181fd7a0d063eb740
- changes: |
    Created packages/core/src/evidence/fallback-read.ts: exports githubContentsFileSchema, PublishedSnapshotQuery,
    readPublishedSnapshot(client, query) implementing the bounded, fail-closed fallback read of the latest published run's
    snapshot hash and policy revision from the evidence store (GitHub contents API), per the rules in the packet: validation
    of subject.number and store branch/owner/name; prefix via repositoryStorePath; GET listing with
    contentsListingSchema (z.union([array(githubContentsEntrySchema), object({})])), not-found -> none, non-array or
    length >= EVIDENCE_FALLBACK_ENTRIES_MAX -> unavailable; latestRunDirectoryName over dir entries, null -> none; GET
    run.json with githubContentsFileSchema, any failure -> unavailable; size and base64 validation against
    EVIDENCE_FALLBACK_FILE_MAX_BYTES; UTF-8 decode, JSON.parse, runRecordSchema.safeParse; subject/type/number/run_id/
    run_attempt cross-checks; returns DedupFallbackRead. Whole body wrapped in try/catch returning unavailable.
    Created packages/core/src/evidence/fallback-read.test.ts: describe 'published snapshot fallback read' with the 11
    required it titles, using createGitHubClient/createGitHubBudget with a recording fake fetch keyed by exact request URL,
    a validRun-derived record built via runRecordSchema.parse, and base64 content chunked every 60 characters.
    Ran pnpm exec prettier --write on both files (fallback-read.ts unchanged, test file reformatted by prettier itself).
- acceptance: |
    1. pnpm vitest run packages/core/src/evidence/fallback-read.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.5.json
       -> exit 0, "JSON report written to .../.m6-p2-2.5.json"
    2. node -e "...titles ok check..." -> printed exactly: titles ok
    3. pnpm vitest run -> Test Files 154 passed (154), Tests 2939 passed (2939), exit 0
    4. pnpm typecheck -> completed with no errors, exit 0
    5. pnpm exec eslint packages/core/src/evidence/fallback-read.ts packages/core/src/evidence/fallback-read.test.ts -> no output, exit 0
    6. pnpm exec prettier --check packages/core/src/evidence/fallback-read.ts packages/core/src/evidence/fallback-read.test.ts
       -> "All matched files use Prettier code style!", exit 0
    7. cat packages/core/src/evidence/fallback-read.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process" -> 0
    8. node -e "...control/bidi/zero-width scan..." fallback-read.ts fallback-read.test.ts -> printed exactly: clean
- deviations: |
    Initial implementation read the not-found failure code from `result.code` instead of `result.failure.code` (the
    Result/StewardFailure shape in src/result.ts nests `code` under `failure`), which the first test run caught; fixed
    before commit. No other deviations from the packet.
