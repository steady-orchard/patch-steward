- status: pass
- base: 6f1e50c137ccba2f354a7e7db852773309f88d04
- changes: |
    Created packages/core/src/net/zip-entry.ts: exports ZIP_ENTRY_VIOLATION_REASONS, ZipEntryViolationReason,
    ZipEntryLimits, ZipEntryRead, and readSingleZipEntry, implementing the ordered checks (archive-bytes bound,
    inspectZipArchive delegation, entry-count, entry-name, then re-parsing the EOCD/central/local headers directly
    from the input bytes to extract and validate the single entry's data via stored copy or inflateRawSync, with
    CRC-32 verification against the central directory CRC), wrapped in try/catch mapping to 'archive'/'malformed'
    (or 'decompressed-bytes' on the inflate size RangeError).
    Created packages/core/src/net/zip-entry.test.ts: an in-memory zip builder (local header + optional data
    descriptor, central directory, EOCD) supporting stored/deflated methods, a flags override, and a CRC override,
    plus the 11 required test cases with exact titles.
- acceptance: |
    pnpm vitest run packages/core/src/net/zip-entry.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.3.json
    -> JSON report written to C:/w/m6-1.3/node_modules/.m6-p1-1.3.json (exit 0)

    node -e "...titles check..."
    -> titles ok

    pnpm vitest run
    -> Test Files 142 passed (142); Tests 2684 passed (2684) (exit 0)

    pnpm typecheck
    -> no output, exit 0

    pnpm exec eslint packages/core/src/net/zip-entry.ts packages/core/src/net/zip-entry.test.ts
    -> no output, exit 0

    pnpm exec prettier --check packages/core/src/net/zip-entry.ts packages/core/src/net/zip-entry.test.ts
    -> Checking formatting...
       All matched files use Prettier code style! (exit 0)

    grep -c "export function readSingleZipEntry" packages/core/src/net/zip-entry.ts
    -> 1

    cat packages/core/src/net/zip-entry.test.ts | grep -cE "mkdtemp|tmpdir|writeFile"
    -> 0 (grep exit status 1, expected)

    node -e "...control/bidi/zero-width character scan..."
    -> clean
- deviations: none
