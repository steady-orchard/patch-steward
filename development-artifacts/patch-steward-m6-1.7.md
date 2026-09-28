# Step 1.7

- id: 1.7
- depends_on: [1.1, 1.2]
- route: mechanical
- objective: Add the version-1 ownership record schema, the ownership artifact name, and bounded encode and decode functions to core/ownership.
- files_in_scope:
    - packages/core/src/ownership/record.ts
    - packages/core/src/ownership/record.test.ts
    - development-artifacts/patch-steward-m6-1.7-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest), commands run in Git Bash from the worktree root.
    packages/core/src/ownership/ holds PURE modules (no node:fs, no fetch, no network, no child processes).
    Domain: the hosted `gate` job commits ownership of a submission (issue or pull request) by uploading a GitHub Actions artifact
    named `steward-ownership-pr-<n>` or `steward-ownership-issue-<n>` (<n> decimal, no leading zero) that contains exactly one file
    `ownership.json`: the ownership record below, serialized as canonical JSON. Every download is validated before use; an invalid
    record, or one whose repository, subject, name, or workflow run does not match the artifact it came from, is
    'ownership.record-invalid' (treated like an unavailable read). Approved example record:
      { "schema_version": 1, "record_type": "ownership", "repository": "steady-orchard/patch-steward-testbed-public",
        "subject": { "type": "pull_request", "number": 12 }, "run_id": 36081628326, "run_attempt": 1, "check_id": null,
        "snapshot_hash": "sha256:<64 hex>", "policy_revision": "<40 or 64 hex git tree id>", "disposition": "runnable",
        "admission": "not-required",
        "cap": { "state": "within", "daily_count": 3, "daily_limit": 50, "author_count": 1, "author_limit": 2 },
        "event": { "name": "pull_request_target", "action": "edited", "object_id": 2345678901,
                   "object_updated_at": "2026-09-28T10:00:00Z", "sender_id": 2095171, "sender_type": "User" },
        "author_id": 2095171, "created_at": "2026-09-28T10:00:05.123Z" }
    Semantics: check_id is always null (no checks yet); admission is always 'not-required'; disposition 'runnable' (contract met or
    uncertain, within caps), 'early-exit' (contract needs-changes or inconclusive; caps not evaluated so cap is null), or 'queued'
    (over a cap); cap.state names the first exceeded cap ('daily-runs' before 'per-author-concurrent-runs') or 'within'; event is the
    triggering event identity (event name and action, the issue or pull request id and updated_at, sender id and type); closure
    actions ('closed', 'deleted') never commit ownership; created_at is informational.

    Existing building blocks (read them): packages/core/src/records/common.ts: recordSchemaVersionSchema, recordPositiveIntSchema,
    recordCountSchema, recordRepositorySchema, recordContentHashSchema, recordTimestampSchema, recordTreeIdSchema (step 1.2).
    packages/core/src/vocabulary.ts: submissionTypeSchema, type SubmissionType, and (step 1.2) ownershipDispositionSchema,
    capStateSchema, wrapperEventNameSchema, senderTypeSchema, PULL_REQUEST_EVENT_ACTIONS ['opened','synchronize','edited','reopened',
    'ready_for_review','closed'], ISSUE_EVENT_ACTIONS ['opened','edited','reopened','closed','deleted'].
    packages/core/src/policy/bounds.ts: OWNERSHIP_RECORD_MAX_BYTES = 16384 (step 1.1).
    packages/core/src/canonical-json.ts: canonicalJson(value): Result<string, ...> (sorted keys, no whitespace).
    packages/core/src/result.ts: ok(value); err(code, cause, message, details = []) -> { ok: false, failure: { code, cause, outcome:
    'inconclusive', message, details } }; FailureDetail = { code, path, message, line: number | null, column: number | null }.

    Required API of packages/core/src/ownership/record.ts (exact names; export nothing else):
      export const OWNERSHIP_ARTIFACT_FILE = 'ownership.json';
      export const OWNERSHIP_ARTIFACT_PREFIX = 'steward-ownership-';
      export function ownershipArtifactName(type: SubmissionType, number: number): string;
        // 'steward-ownership-pr-<n>' for 'pull_request', 'steward-ownership-issue-<n>' for 'issue';
        // throws RangeError unless Number.isSafeInteger(number) && number >= 1
      export const ownershipEventSchema = z.strictObject({
        name: wrapperEventNameSchema,
        action: z.enum(['opened', 'synchronize', 'edited', 'reopened', 'ready_for_review', 'closed', 'deleted']),
        object_id: recordPositiveIntSchema, object_updated_at: recordTimestampSchema,
        sender_id: recordPositiveIntSchema, sender_type: senderTypeSchema });
      export type OwnershipEventIdentity = z.output<typeof ownershipEventSchema>;
      export const ownershipCapSchema = z.strictObject({ state: capStateSchema, daily_count: recordCountSchema,
        daily_limit: recordPositiveIntSchema, author_count: recordCountSchema, author_limit: recordPositiveIntSchema });
      export const ownershipRecordSchema = z.strictObject({
        schema_version: recordSchemaVersionSchema, record_type: z.literal('ownership'), repository: recordRepositorySchema,
        subject: z.strictObject({ type: submissionTypeSchema, number: recordPositiveIntSchema }),
        run_id: recordPositiveIntSchema, run_attempt: recordPositiveIntSchema, check_id: z.null(),
        snapshot_hash: recordContentHashSchema, policy_revision: recordTreeIdSchema, disposition: ownershipDispositionSchema,
        admission: z.literal('not-required'), cap: ownershipCapSchema.nullable(), event: ownershipEventSchema,
        author_id: recordPositiveIntSchema, created_at: recordTimestampSchema }).superRefine(...);
      export type OwnershipRecord = z.output<typeof ownershipRecordSchema>;
      export type OwnershipRecordFailureCode = 'ownership.record-invalid';
      export function encodeOwnershipRecord(record: OwnershipRecord): Result<Uint8Array, OwnershipRecordFailureCode>;
      export interface OwnershipArtifactExpectation {
        readonly repository: string; readonly type: SubmissionType; readonly number: number;
        readonly artifactName: string; readonly workflowRunId: number | null;
      }
      export function decodeOwnershipRecord(bytes: Uint8Array, expected: OwnershipArtifactExpectation):
        Result<OwnershipRecord, OwnershipRecordFailureCode>;
    superRefine rules (custom issues): disposition 'early-exit' iff cap === null; 'runnable' requires cap.state 'within'; 'queued'
    requires cap.state !== 'within'; cap.state 'within' requires daily_count <= daily_limit and author_count <= author_limit;
    'daily-runs' requires daily_count > daily_limit; 'per-author-concurrent-runs' requires daily_count <= daily_limit and
    author_count > author_limit; event.name 'pull_request_target' iff subject.type 'pull_request' (and 'issues' iff 'issue');
    event.action must belong to PULL_REQUEST_EVENT_ACTIONS for 'pull_request_target' and to ISSUE_EVENT_ACTIONS for 'issues'; event.action
    must not be 'closed' or 'deleted'.
    encodeOwnershipRecord: safeParse with ownershipRecordSchema (fail -> err), canonicalJson of the parsed value, UTF-8 encode
    (TextEncoder); length > OWNERSHIP_RECORD_MAX_BYTES -> err. All encode errors: err('ownership.record-invalid', 'steward-defect',
    'The ownership record could not be encoded.').
    decodeOwnershipRecord, failing at the first failed check with err('ownership.record-invalid', 'github-unavailable', 'The
    ownership record is invalid.', [one detail: same code and message, line null, column null, path = token]): bytes.length >
    OWNERSHIP_RECORD_MAX_BYTES ('size'); UTF-8 decode with new TextDecoder('utf-8', { fatal: true }) throws ('encoding');
    JSON.parse throws ('json'); schema fails ('schema'); canonicalJson of the parsed value longer than OWNERSHIP_RECORD_MAX_BYTES
    UTF-8 bytes ('size'); expected.artifactName !== ownershipArtifactName(expected.type, expected.number) ('name');
    ownershipArtifactName(record.subject.type, record.subject.number) !== expected.artifactName ('name'); record.subject type or
    number differs from expected ('subject'); record.repository !== expected.repository, exact comparison ('repository');
    expected.workflowRunId !== null and record.run_id !== expected.workflowRunId ('run'). Wrap in try/catch so it never throws
    (ownershipArtifactName RangeError -> 'name'). Detail paths are fixed tokens; never include record or payload text.

    Conventions: ESM relative imports end in '.js'; `import type` for types; tsconfig strict, noUncheckedIndexedAccess,
    exactOptionalPropertyTypes; ESLint recommended. Prettier (single quotes, semicolons, trailing commas, printWidth 132) only on this
    step's .ts files. No comments except short WHY; no planning identifiers in source or titles. Tests pure (build bytes in memory).
    Do not edit packages/core/src/index.ts. Do not export any function whose name begins with load, validate, resolve, parse, capture,
    or check.
- actions: |
    1. FIRST, verify the base: `grep -c "export const OWNERSHIP_RECORD_MAX_BYTES = 16384;" packages/core/src/policy/bounds.ts`
       prints 1, `grep -c "export const OWNERSHIP_DISPOSITIONS" packages/core/src/vocabulary.ts` prints 1, and
       `grep -c "export const recordTreeIdSchema" packages/core/src/records/common.ts` prints 1. If any prints 0, STOP and report
       status missing-base naming the missing step (1.1 or 1.2) in the report file; do not fetch, merge, or improvise.
    2. Create packages/core/src/ownership/record.ts exactly as specified.
    3. Create packages/core/src/ownership/record.test.ts (describe 'ownership record') using the approved example (hashes
       'sha256:' + 'a'.repeat(64), revision 'b'.repeat(40)) and exact titles:
       - 'ownership record accepts the approved example'
       - 'ownership artifact names follow the approved pattern' (pr and issue names; RangeError for 0, -1, 1.5)
       - 'ownership records encode as canonical JSON within the bound' (bytes decode to text equal to canonicalJson of the record;
         decodeOwnershipRecord of those bytes round-trips)
       - 'ownership records decode after download'
       - 'decoding rejects oversized bytes' (OWNERSHIP_RECORD_MAX_BYTES + 1 bytes of spaces)
       - 'decoding rejects malformed JSON'
       - 'decoding rejects unknown keys'
       - 'decoding rejects a record for another repository'
       - 'decoding rejects a record for another subject' (other number; other type)
       - 'decoding rejects a record from another workflow run' (workflowRunId differs; null workflowRunId accepts)
       - 'early exits carry no cap evaluation'
       - 'queued records require an exceeded cap'
       - 'runnable records require a cap within limits'
       - 'closure actions are never committed' (action 'closed' and 'deleted' rejected)
       - 'event names match the subject type'
       Every rejection asserts ok false, failure.code 'ownership.record-invalid', outcome 'inconclusive', and for decode failures
       details[0].path equal to the token from context.
    4. Run: pnpm exec prettier --write packages/core/src/ownership/record.ts packages/core/src/ownership/record.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/ownership/record.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.7.json -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.7.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['ownership record accepts the approved example','ownership artifact names follow the approved pattern','ownership records encode as canonical JSON within the bound','ownership records decode after download','decoding rejects oversized bytes','decoding rejects malformed JSON','decoding rejects unknown keys','decoding rejects a record for another repository','decoding rejects a record for another subject','decoding rejects a record from another workflow run','early exits carry no cap evaluation','queued records require an exceeded cap','runnable records require a cap within limits','closure actions are never committed','event names match the subject type'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/ownership/record.ts packages/core/src/ownership/record.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/ownership/record.ts packages/core/src/ownership/record.test.ts -> exit 0
    7. grep -rnE "node:(fs|http|https|net|dns|tls|child_process)|from 'fs'|fetch\(" packages/core/src/ownership -> no output (exit 1)
    8. grep -c "export function decodeOwnershipRecord" packages/core/src/ownership/record.ts -> prints 1
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/ownership/record.ts packages/core/src/ownership/record.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
