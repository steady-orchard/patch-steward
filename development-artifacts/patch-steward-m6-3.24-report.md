- status: pass
- base: 344e5d2ce8544aeb45af79b22036a955d967dd3e
- changes: |
    packages/action/src/dispatch.ts: new. Exports ActionDeps and async runAction(argv, deps): masks
    PATCH_STEWARD_APP_PRIVATE_KEY first via maskCommands; validates argv is exactly ['gate'] or
    ['publish'] else prints usage and returns 2; reads environment via readGateEnvironment /
    readPublishEnvironment (failure prints '::error::<code> <path>\n' and returns 1); builds mask
    and writeSummary callbacks (writeSummary bounds text with boundedSummaryText(JOB_SUMMARY_MAX_LENGTH)
    then appendTextFile); gate: reads the event payload with readBoundedFile(EVENT_PAYLOAD_MAX_BYTES+1)
    (too-large -> oversize buffer so the core rejects it; missing/unreadable -> error and return 1),
    calls runGate, on ok stages every result file with writeStagingFile (any failure -> 'could not be
    staged' and return 1 without writing outputs), formats outputs with formatOutputs (null -> error
    and return 1), else appends outputs and logs and returns 0; not ok -> logs, 'gate failed <code>',
    return 1. publish: reads staged handoff/gate-context/closure with readBoundedFile(HANDOFF_MAX_BYTES),
    calls runPublish, same outputs/logging pattern, error prefix 'publish failed <code>'. Any
    unexpected exception is caught at the top level -> '::error::steward action failed\n', return 1.
    No other stdout text; only maskCommands output and the specified literal lines are ever written.

    packages/action/src/main.ts: new three-line script `import { runAction } from './dispatch.js'` then
    `process.exitCode = await runAction(process.argv.slice(2), { env: process.env, stdout: (text) => {
    process.stdout.write(text); } })`. No exports.

    packages/action/src/dispatch.test.ts: new, describe 'action entry', temp dirs via
    fs.mkdtempSync(path.join(os.tmpdir(), 'm6-act-')) removed in afterEach with
    fs.rmSync(..., { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); full gate/publish
    environment maps built as specified; fake runGate/runPublish injected via ActionDeps to record
    inputs and return canned HostedGateResult/HostedPublishResult values, calling deps.mask /
    deps.writeSummary where a test needs it. it(...) titles exactly as specified in the packet:
    'the action dispatches gate and publish', 'an unknown job prints usage and exits 2', 'masks are
    emitted before any other output', 'environment failures name the variable, never its value',
    'gate files are staged under the runner temp directory', 'multi-line outputs are refused',
    'the step summary is bounded', 'invariant 4: hosted upload failure never yields pass', 'a failed
    core run exits nonzero without outputs'.

    Ran `pnpm exec prettier --write packages/action/src/dispatch.ts packages/action/src/main.ts
    packages/action/src/dispatch.test.ts` per action 3 (dispatch.ts and main.ts were already formatted
    as written; dispatch.test.ts was reformatted).

    index.ts, outputs.ts, files.ts, and their tests: unchanged.
- acceptance: |
    1. pnpm vitest run packages/action --reporter=json --outputFile=node_modules/.m6-p3-3.24.json
       -> "JSON report written to .../node_modules/.m6-p3-3.24.json", exit 0.

    2. node -e "...titles ok check..."
       -> titles ok

    3. node -e "...leak check spawning pnpm vitest run packages/action..."
       -> exit 0 leaked 0

    4. pnpm build
       -> all four workspace packages (web, core, action, cli) built successfully, exit 0.

    5. node packages/action/dist/main.js; echo "exit $?"
       -> usage: main.js gate|publish
          exit 2

    6. GITHUB_EVENT_NAME= node packages/action/dist/main.js gate; echo "exit $?"
       -> ::error::action.environment-invalid GITHUB_EVENT_NAME
          exit 1

    7. pnpm typecheck
       -> exit 0, no errors.

    8. pnpm vitest run
       -> Test Files  186 passed (186); Tests  3440 passed (3440); exit 0.

    9. pnpm exec eslint packages/action
       -> no output, exit 0.

    10. pnpm exec prettier --check packages/action
       -> All matched files use Prettier code style!

    11. node -e "...control/format-character scan over the three files..."
       -> clean
- deviations: |
    During development, before the final passing state: dispatch.test.ts initially wrote
    steward/handoff/handoff.json without first creating the steward/handoff directory (ENOENT), and
    compared a Node Buffer to a Uint8Array with toEqual (mismatched object shape); both fixed within
    the same file before the single commit. Three `let content = ''; try { ... } catch { content = '';
    }` blocks were replaced with a small `readTextOrEmpty` test helper to satisfy
    eslint's no-useless-assignment rule (packages/action was otherwise unaffected). None of this
    reached the committed working tree as a defect — final dispatch.test.ts passes lint, prettier,
    typecheck, and all acceptance commands. No other deviation from the packet.
