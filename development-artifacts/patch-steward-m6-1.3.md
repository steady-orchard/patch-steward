# Step 1.3

- id: 1.3
- depends_on: []
- route: mechanical
- objective: Add a bounded single-entry zip reader to core/net that returns the bytes of exactly one named entry or a typed violation.
- files_in_scope:
    - packages/core/src/net/zip-entry.ts
    - packages/core/src/net/zip-entry.test.ts
    - development-artifacts/patch-steward-m6-1.3-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest), commands run in Git Bash from the worktree root. Built-ins only
    (node:zlib, node:buffer); no new dependency.
    Purpose: the hosted gate downloads a GitHub Actions artifact zip that must contain exactly one file `ownership.json`; callers will
    pass the entry name and two bounds (archive bytes and decompressed entry bytes). This step only adds the pure reader.

    Existing module packages/core/src/net/archive.ts (read it) exports:
      ARCHIVE_VIOLATION_REASONS = ['malformed','zip64','multi-disk','encrypted','unsupported-method','symlink','entry-name',
        'too-many-entries','size-mismatch','decompressed-bytes'] as const; type ArchiveViolationReason;
      inspectZipArchive(bytes: Uint8Array, maxDecompressedBytes: number): ArchiveInspection, where ArchiveInspection is
        { kind: 'ok'; entries: readonly { name: string; bytes: number }[]; decompressedBytes: number } or
        { kind: 'violation'; rule: 'archive' | 'decompressed-bytes'; reason: ArchiveViolationReason; message: string }.
      It validates the end-of-central-directory record, rejects zip64, multi-disk, encryption, methods other than 0 (stored) and 8
      (deflate), symlinks, unsafe names, more than 1000 entries, declared or actual decompressed size over the bound, and size
      mismatches, using central-directory sizes. It never returns entry bytes.
    Zip layout (little-endian):
      End of central directory (EOCD): signature 0x06054b50; total entries u16 at +10; central directory size u32 at +12; central
        directory offset u32 at +16; comment length u16 at +20; it is the last offset where the signature matches and
        offset + 22 + commentLength equals the buffer length.
      Central directory entry: signature 0x02014b50; general-purpose flags u16 at +8; method u16 at +10; CRC-32 u32 at +16;
        compressed size u32 at +20; uncompressed size u32 at +24; name length u16 at +28; extra length u16 at +30; comment length
        u16 at +32; local header offset u32 at +42; name bytes start at +46.
      Local file header: signature 0x04034b50; flags u16 at +6; method u16 at +8; CRC-32 u32 at +14; compressed u32 at +18;
        uncompressed u32 at +22; name length u16 at +26; extra length u16 at +28; data starts at +30 + nameLength + extraLength.
      When flag bit 3 (0x0008, data descriptor) is set, the local header CRC and sizes may be 0 and a 16-byte descriptor
      (0x08074b50, crc, compressed, uncompressed) follows the data. GitHub artifact zips use this: ALWAYS take CRC and sizes from
      the central directory entry, never from the local header.
    `crc32` is exported by node:zlib in Node 24 (`import { crc32, inflateRawSync } from 'node:zlib';`, returns an unsigned 32-bit
    number); `inflateRawSync(data, { maxOutputLength })` throws a RangeError with code 'ERR_BUFFER_TOO_LARGE' over the limit.

    Required API of packages/core/src/net/zip-entry.ts (exact names; export nothing else):
      export const ZIP_ENTRY_VIOLATION_REASONS = ['archive-bytes', 'archive', 'entry-count', 'entry-name', 'crc-mismatch'] as const;
      export type ZipEntryViolationReason = (typeof ZIP_ENTRY_VIOLATION_REASONS)[number];
      export interface ZipEntryLimits { readonly entryName: string; readonly maxArchiveBytes: number; readonly maxEntryBytes: number }
      export type ZipEntryRead =
        | { readonly kind: 'ok'; readonly bytes: Uint8Array }
        | { readonly kind: 'violation'; readonly reason: ZipEntryViolationReason;
            readonly archiveReason: ArchiveViolationReason | null; readonly message: string };
      export function readSingleZipEntry(bytes: Uint8Array, limits: ZipEntryLimits): ZipEntryRead;
    Fixed messages: archive-bytes 'The archive exceeds the allowed size.'; archive 'The archive failed inspection.'; entry-count
    'The archive must contain exactly one entry.'; entry-name 'The archive entry has an unexpected name.'; crc-mismatch
    'The archive entry failed its checksum.'

    Conventions: ESM relative imports end in '.js' (`import { inspectZipArchive } from './archive.js';`, `import type` for types);
    tsconfig strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals/Parameters; ESLint recommended rules
    (no-control-regex is on). Prettier (single quotes, semicolons, trailing commas, printWidth 132) only on this step's two .ts
    files. No comments except a short WHY; no planning identifiers in source or titles. Tests are pure: build zip bytes in memory,
    no temp files, no fs writes. Never write raw control, bidi, or zero-width characters into a file. Do not edit
    packages/core/src/index.ts.
- actions: |
    1. Create packages/core/src/net/zip-entry.ts implementing readSingleZipEntry in this order:
       a. bytes.length > limits.maxArchiveBytes -> violation 'archive-bytes' (archiveReason null).
       b. inspectZipArchive(bytes, limits.maxEntryBytes); a violation -> reason 'archive', archiveReason = inspection.reason.
       c. entries.length !== 1 -> 'entry-count'. d. entries[0].name !== limits.entryName -> 'entry-name'.
       e. Locate the EOCD and the single central directory entry; read method, CRC-32, compressed size and local header offset from
          the central entry; read name and extra lengths from the local header; slice the data. Method 0: data as is. Method 8:
          inflateRawSync(data, { maxOutputLength: Math.max(1, limits.maxEntryBytes) }); output longer than maxEntryBytes ->
          'archive' with archiveReason 'decompressed-bytes'.
       f. crc32(output) !== central CRC -> 'crc-mismatch'.
       g. Return { kind: 'ok', bytes: <a new Uint8Array copy of the output> }.
       h. Wrap steps e to g in try/catch: any exception -> 'archive' with archiveReason 'malformed' (the size-limit RangeError ->
          'decompressed-bytes').
    2. Create packages/core/src/net/zip-entry.test.ts with a local in-memory zip builder (local header + data [+ 16-byte data
       descriptor] per entry, central directory, EOCD) that writes the real crc32 of the uncompressed data into the central entry
       (and into the local header unless the data-descriptor option is set, in which case the local CRC and sizes are 0 and flag
       0x0008 is set in both headers), supports method 0 and 8 (deflateRawSync from node:zlib), a flags override, and a CRC
       override. Use limits { entryName: 'ownership.json', maxArchiveBytes: 65536, maxEntryBytes: 16384 } unless a test needs
       others. Tests (exact titles, plain it()):
       - 'reads a stored single entry' (returned bytes equal the input bytes)
       - 'reads a deflated single entry'
       - 'reads an entry written with a data descriptor'
       - 'rejects an archive over the byte bound' (maxArchiveBytes smaller than the zip)
       - 'rejects an archive with two entries' (entry-count)
       - 'rejects an empty archive' (EOCD only, zero entries: entry-count)
       - 'rejects an entry with another name' (both 'other.json' and 'dir/ownership.json': entry-name)
       - 'rejects an entry over the decompressed bound' (reason 'archive', archiveReason 'decompressed-bytes')
       - 'rejects a CRC mismatch'
       - 'rejects bytes that are not a zip archive' (reason 'archive', archiveReason 'malformed')
       - 'rejects an encrypted entry' (flag 0x0001: reason 'archive', archiveReason 'encrypted')
    3. Run: pnpm exec prettier --write packages/core/src/net/zip-entry.ts packages/core/src/net/zip-entry.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/net/zip-entry.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.3.json -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.3.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['reads a stored single entry','reads a deflated single entry','reads an entry written with a data descriptor','rejects an archive over the byte bound','rejects an archive with two entries','rejects an empty archive','rejects an entry with another name','rejects an entry over the decompressed bound','rejects a CRC mismatch','rejects bytes that are not a zip archive','rejects an encrypted entry'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/net/zip-entry.ts packages/core/src/net/zip-entry.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/net/zip-entry.ts packages/core/src/net/zip-entry.test.ts -> exit 0
    7. grep -c "export function readSingleZipEntry" packages/core/src/net/zip-entry.ts -> prints 1
    8. cat packages/core/src/net/zip-entry.test.ts | grep -cE "mkdtemp|tmpdir|writeFile" -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/net/zip-entry.ts packages/core/src/net/zip-entry.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
