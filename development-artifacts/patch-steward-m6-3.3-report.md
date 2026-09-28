- status: pass
- base: 4f5d5ab996dfc0d09ef285e4251f13c2c8aafdd9
- changes: |
    Added packages/core/src/pipeline/gate-context.ts: HANDOFF_ARTIFACT, CLOSURE_ARTIFACT, HANDOFF_FILE, GATE_CONTEXT_FILE,
    CLOSURE_CONTEXT_FILE, GATE_CONTEXT_LOG_LINES_MAX constants; evidenceStoreRefSchema/EvidenceStoreRef; classificationRecordSchema/
    ClassificationRecord; gateContextRecordSchema/GateContextRecord with superRefine cross-field checks (snapshot_hash vs
    submission, submission repository/type/number vs repository/subject, disposition vs cap presence and cap.state, orphan-branch
    store repository, issue subjects forbidding base_commit); closureContextRecordSchema/ClosureContextRecord with superRefine
    checks (event.kind, event.subject.kind and identity, orphan-branch store repository); HostedRunExpectation;
    GateContextFailureCode; encodeGateContext/encodeClosureContext (safeParse, canonicalJson of parsed value, UTF-8 bytes, size
    bound -> 'pipeline.handoff-invalid'); decodeGateContext/decodeClosureContext (try/catch, size/encoding/json/schema token
    details, then run/attempt/repository binding -> 'pipeline.handoff-binding'); decodeHandoffBytes (size/encoding/json checks,
    returns parsed JSON); classificationRecord and gateContextClassification converters to/from report/templates.js's
    ClassificationInput.

    Added packages/core/src/pipeline/gate-context.test.ts: describe 'same-run records' with the 11 required it(...) titles,
    covering round-trip encode/decode, canonical-bytes equality, submission cross-field validation, cap/disposition coupling,
    orphan-branch store validation, decode failure tokens (size/encoding/json/schema), run/attempt/repository binding,
    closure record round-trip and event binding, closure event subject/kind mismatches, decodeHandoffBytes, and classification
    conversion round-trips. Test helpers build gate-context/closure-context objects as plain typed literals (not
    schema.parse) so intentionally-invalid variants can be passed to encode* for testing without throwing at construction.

    Ran pnpm exec prettier --write on both files (no changes needed after final edit).
- acceptance: |
    1. pnpm vitest run packages/core/src/pipeline/gate-context.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.3.json
       -> exit 0 (JSON report written to C:/w/m6-3.3/node_modules/.m6-p3-3.3.json)
    2. node -e "...titles ok check..."
       -> titles ok
    3. pnpm vitest run
       -> Test Files 164 passed (164); Tests 3073 passed (3073); exit 0
    4. pnpm typecheck
       -> no output; exit 0
    5. pnpm exec eslint packages/core/src/pipeline/gate-context.ts packages/core/src/pipeline/gate-context.test.ts
       -> no output; exit 0
    6. pnpm exec prettier --check packages/core/src/pipeline/gate-context.ts packages/core/src/pipeline/gate-context.test.ts
       -> "Checking formatting...\nAll matched files use Prettier code style!"; exit 0
    7. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process|fetch\(" packages/core/src/pipeline/gate-context.ts packages/core/src/pipeline/gate-context.test.ts
       -> packages/core/src/pipeline/gate-context.ts:0
          packages/core/src/pipeline/gate-context.test.ts:0
    8. node -e "...control/bidi/zero-width character scan..." packages/core/src/pipeline/gate-context.ts packages/core/src/pipeline/gate-context.test.ts
       -> clean
- deviations: |
    None from the required API, schemas, or test titles. The test-data helpers (makeGateContext/makeClosureContext) build
    plain object literals typed as GateContextRecord/ClosureContextRecord rather than calling schema.parse, so the
    "cap presence follows the disposition", "an orphan-branch store must be the target repository", "a gate context must
    match its submission record", and "a closure event for another submission is invalid" tests (which construct
    intentionally-invalid records to assert encode* rejects them) do not throw at helper-construction time; encode* itself
    still performs the real schema validation being tested. This is an implementation detail of the test file, not a
    deviation from any named export, schema shape, or required test title.
