- status: pass
- base: 9284f6fcdc85c6fd3ca4f6c3b19ceaabdf95e762
- changes: |
    packages/core/src/evidence/layout.ts: added WAITING_RUN_FILES, SUPERSESSIONS_DIRECTORY, supersessionStorePath,
    supersessionMetricsStorePath, repositoryStorePath, latestRunDirectoryName; recordTypeForPath now maps 'waiting.json' -> 'waiting'.
    packages/core/src/evidence/manifest.ts: evidenceManifestSchema gains optional run_kind (runKindSchema); superRefine now
    derives runKind (default 'outcome'), requires WAITING_RUN_FILES for 'waiting' and RUN_FILES for 'outcome', flags 'waiting.json'
    in outcome runs and decision.json/report.json/report.md/findings/* in waiting runs; EvidenceManifestInput gains optional
    runKind; buildEvidenceManifest spreads run_kind into the candidate only when input.runKind is defined.
    packages/core/src/evidence/layout.test.ts: added tests 'supersession paths follow the approved layout',
    'repository store paths prefix the target repository', 'repository store paths reject unsafe input',
    'waiting.json maps to the waiting record type', 'the latest run directory is the greatest run id and attempt',
    'run directory selection ignores other names'.
    packages/core/src/evidence/manifest.test.ts: added WAITING_FILES fixture, waitingInput helper, and tests
    'waiting manifests require the waiting run files', 'waiting manifests reject decision, report, and findings files',
    'outcome manifests reject a waiting record file', 'manifests without run_kind stay valid',
    'run_kind is written only when given'.
    Ran prettier --write on all four .ts files (layout.ts unchanged; others reformatted).
- acceptance: |
    grep -c "'supersession'" packages/core/src/records/common.ts -> 1
    grep -c "export const RUN_KINDS" packages/core/src/vocabulary.ts -> 1

    pnpm vitest run packages/core/src/evidence/layout.test.ts packages/core/src/evidence/manifest.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.11.json
    -> Test Files 2 passed (2); Tests 25 passed (25); exit 0

    node -e "...titles check..." -> titles ok

    pnpm vitest run packages/core/src/evidence -> Test Files 15 passed (15); Tests 134 passed (134); exit 0

    pnpm vitest run -> Test Files 144 passed (144); Tests 2770 passed (2770); exit 0

    pnpm typecheck -> exit 0, no output

    pnpm exec eslint packages/core/src/evidence/layout.ts packages/core/src/evidence/layout.test.ts packages/core/src/evidence/manifest.ts packages/core/src/evidence/manifest.test.ts
    -> exit 0

    pnpm exec prettier --check <same four files> -> "All matched files use Prettier code style!"; exit 0

    cat packages/core/src/evidence/layout.test.ts packages/core/src/evidence/manifest.test.ts | grep -cE "mkdtemp|tmpdir|writeFile"
    -> prints 0, grep exit 1 (expected)

    node -e "...control/bidi character scan..." -> clean

    (the temp file node_modules/.m6-p1-1.11.json was removed after use; node_modules is not in files_in_scope)
- deviations: none
