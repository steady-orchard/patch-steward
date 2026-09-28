- status: pass
- base: 9284f6fcdc85c6fd3ca4f6c3b19ceaabdf95e762
- changes: |
    Created packages/core/src/ownership/record.ts: OWNERSHIP_ARTIFACT_FILE, OWNERSHIP_ARTIFACT_PREFIX,
    ownershipArtifactName, ownershipEventSchema/OwnershipEventIdentity, ownershipCapSchema, ownershipRecordSchema
    (strictObject with superRefine enforcing disposition/cap consistency, event.name vs subject.type, valid
    event.action per event.name, and rejection of 'closed'/'deleted' actions)/OwnershipRecord,
    OwnershipRecordFailureCode, encodeOwnershipRecord (safeParse, canonicalJson, UTF-8 encode, size bound),
    decodeOwnershipRecord (size, encoding, json, schema, re-canonicalized size, name, subject, repository, run
    checks in order, wrapped in try/catch).
    Created packages/core/src/ownership/record.test.ts with the 15 required test titles under describe
    'ownership record', using the approved example record and the specified hashes/revision.
- acceptance: |
    pnpm vitest run packages/core/src/ownership/record.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.7.json
    -> JSON report written to C:/w/m6-1.7/node_modules/.m6-p1-1.7.json (exit 0)

    node -e "...titles check..."
    -> titles ok

    pnpm vitest run
    -> Test Files  145 passed (145)
       Tests  2774 passed (2774)
       (exit 0)

    pnpm typecheck
    -> no output (exit 0)

    pnpm exec eslint packages/core/src/ownership/record.ts packages/core/src/ownership/record.test.ts
    -> no output (exit 0)

    pnpm exec prettier --check packages/core/src/ownership/record.ts packages/core/src/ownership/record.test.ts
    -> Checking formatting...
       All matched files use Prettier code style!
       (exit 0)

    grep -rnE "node:(fs|http|https|net|dns|tls|child_process)|from 'fs'|fetch\(" packages/core/src/ownership
    -> no output (exit 1)

    grep -c "export function decodeOwnershipRecord" packages/core/src/ownership/record.ts
    -> 1

    node -e "...control/bidi character scan..." packages/core/src/ownership/record.ts packages/core/src/ownership/record.test.ts
    -> clean
- deviations: none
