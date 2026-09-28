# Step 3.24

- id: 3.24
- depends_on: [3.9, 3.18]
- route: mechanical
- objective: Add the action entry point: `runAction(argv, deps)` in packages/action/src/dispatch.ts (masks first, environment reading, payload and same-run file reads, core gate or publish, staged files, single-line outputs, bounded summary, exit status) and the three-line script packages/action/src/main.ts that the workflow runs as `node packages/action/dist/main.js gate|publish`.
- files_in_scope:
    - packages/action/src/dispatch.ts
    - packages/action/src/dispatch.test.ts
    - packages/action/src/main.ts
    - development-artifacts/patch-steward-m6-3.24-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest); run commands in Git Bash from the worktree root. Built-ins only; the
    action depends only on '@patch-steward/core' (workspace link; Vitest and typecheck resolve it to packages/core/src/index.ts).

    Base check (files changed in steps 3.9 and 3.18): packages/action/package.json depends on '@patch-steward/core';
    packages/action/src/outputs.ts exports formatOutputs, maskCommands, boundedSummaryText; packages/action/src/files.ts exports
    stagingPath, writeStagingFile, readBoundedFile, appendTextFile, STAGING_PATHS; packages/core/src/index.ts exports
    './pipeline/hosted-publish.js' (so '@patch-steward/core' provides runHostedGate, runHostedPublish, readGateEnvironment,
    readPublishEnvironment, EVENT_PAYLOAD_MAX_BYTES, HANDOFF_MAX_BYTES, JOB_SUMMARY_MAX_LENGTH, types HostedGateResult,
    HostedPublishResult, HostedGateInput, HostedGateDeps, HostedPublishInput, HostedPublishDeps). Read those files first.

    Required API (exact names), packages/action/src/dispatch.ts:
      export interface ActionDeps {
        readonly env: Readonly<Record<string, string | undefined>>;
        readonly stdout: (text: string) => void;
        readonly runGate?: (input: HostedGateInput, deps: HostedGateDeps) => Promise<HostedGateResult>;         // default runHostedGate
        readonly runPublish?: (input: HostedPublishInput, deps: HostedPublishDeps) => Promise<HostedPublishResult>; // default runHostedPublish
      }
      export async function runAction(argv: readonly string[], deps: ActionDeps): Promise<number>;   // the process exit status
    packages/action/src/main.ts (exactly this behavior, no exports):
      import { runAction } from './dispatch.js';
      process.exitCode = await runAction(process.argv.slice(2), { env: process.env, stdout: (text) => { process.stdout.write(text); } });

    runAction rules (never throws; any unexpected exception -> stdout '::error::steward action failed\n' and return 1):
    1. FIRST output: if env.PATCH_STEWARD_APP_PRIVATE_KEY is a non-empty string, stdout(maskCommands(it)) before anything else is
       written (GitHub then hides every line of the key in the job log).
    2. argv must be exactly ['gate'] or ['publish']; otherwise stdout('usage: main.js gate|publish\n') and return 2.
    3. Environment: readGateEnvironment(env) or readPublishEnvironment(env); failure -> stdout('::error::' + failure.code + ' ' +
       (failure.details[0]?.path ?? '') + '\n') (a variable NAME, never a value) and return 1.
    4. Core callbacks: mask = (secret) => stdout(maskCommands(secret)); writeSummary = async (text) =>
       appendTextFile(environment.summaryPath, boundedSummaryText(text, JOB_SUMMARY_MAX_LENGTH)).
    5. gate: payload = readBoundedFile(environment.eventPath, EVENT_PAYLOAD_MAX_BYTES + 1): 'ok' -> its bytes; 'too-large' ->
       new Uint8Array(EVENT_PAYLOAD_MAX_BYTES + 1) (the core rejects it as an invalid event); 'missing' or 'unreadable' ->
       stdout('::error::action.environment-invalid GITHUB_EVENT_PATH\n') and return 1. result = runGate({ environment, payload },
       { mask, writeSummary }). ok -> write every result file with writeStagingFile(environment.runnerTemp, file.name, file.bytes)
       (file names 'handoff', 'gate-context', 'ownership', 'closure' map to STAGING_PATHS); if ANY staging write fails -> stdout(
       '::error::steward files could not be staged\n') and return 1 WITHOUT writing outputs; then text = formatOutputs(
       result.outputs); null -> stdout('::error::steward outputs are invalid\n') and return 1; else appendTextFile(
       environment.outputPath, text); then stdout each log line + '\n'; return 0. Not ok -> stdout each log line + '\n', then
       stdout('::error::gate failed ' + result.failure.code + '\n') and return 1 (no outputs).
    6. publish: files read from the staging paths with readBoundedFile(stagingPath(environment.runnerTemp, name),
       HANDOFF_MAX_BYTES): handoff and gate-context (null unless 'ok'), closure (null unless 'ok'); result = runPublish({
       environment, files: { handoff, gateContext, closure } }, { mask, writeSummary }); ok -> outputs as for gate, log lines,
       return 0; not ok -> log lines, stdout('::error::publish failed ' + code + '\n'), return 1.
    7. No other stdout text; never print an environment value, token, key, or file content.
    Module names must not contain llm, model, copilot, openai, anthropic, sandbox, container, docker, or runner (import specifiers
    are scanned). Leave index.ts, outputs.ts, files.ts, and their tests unchanged.

    Tests (packages/action/src/dispatch.test.ts, describe 'action entry'): temp dirs only via fs.mkdtempSync(path.join(os.tmpdir(),
    'm6-act-')), removed in afterEach with fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); env =
    the complete gate map (GITHUB_EVENT_NAME 'issues', GITHUB_EVENT_PATH <tmp>/event.json, GITHUB_REPOSITORY
    'steady-orchard/patch-steward-testbed-public', GITHUB_REPOSITORY_ID '1376317064', GITHUB_REF 'refs/heads/master',
    GITHUB_SERVER_URL 'https://github.com', GITHUB_API_URL 'https://api.github.com', GITHUB_RUN_ID '36081628326',
    GITHUB_RUN_ATTEMPT '1', RUNNER_TEMP <tmp>, GITHUB_OUTPUT <tmp>/output, GITHUB_STEP_SUMMARY <tmp>/summary, PATCH_STEWARD_APP_ID
    '4993303', PATCH_STEWARD_APP_PRIVATE_KEY KEY) where KEY = 'line-one-' + 'k'.repeat(20) + '\n' + 'line-two-' + 'k'.repeat(20)
    + '\n' (built by concatenation); publish adds STEWARD_GATE_DISPOSITION 'runnable', STEWARD_GATE_RECORD_ONLY 'false',
    STEWARD_GATE_SNAPSHOT_HASH 'sha256:' + 'a'.repeat(64), STEWARD_GATE_POLICY_REVISION 'b'.repeat(40). Inject fake runGate and
    runPublish that record their inputs and return canned results (e.g. { ok: true, disposition: 'runnable', outputs: {
    disposition: 'runnable', commit: 'true', ... }, files: [{ name: 'handoff', bytes }, ...], logLines: ['disposition runnable']
    }), and that call deps.writeSummary / deps.mask when a test needs it. Plain it(...) titles EXACTLY:
      - 'the action dispatches gate and publish': argv ['gate'] calls runGate once with the payload bytes from GITHUB_EVENT_PATH and
        returns 0; argv ['publish'] with staged handoff and gate-context files calls runPublish once with those bytes and returns 0.
      - 'an unknown job prints usage and exits 2': argv [], ['deploy'], ['gate', 'x'] -> 2 and the usage line.
      - 'masks are emitted before any other output': the first stdout text is exactly '::add-mask::line-one-' + 'k'.repeat(20) +
        '\n' + '::add-mask::line-two-' + 'k'.repeat(20) + '\n'; a token passed to deps.mask by the fake core is masked too.
      - 'environment failures name the variable, never its value': env without GITHUB_RUN_ID -> 1; stdout contains
        'action.environment-invalid GITHUB_RUN_ID'; no stdout text contains KEY's lines except inside the '::add-mask::' commands.
      - 'gate files are staged under the runner temp directory': the three files land at <tmp>/steward/handoff/handoff.json,
        <tmp>/steward/handoff/gate-context.json, <tmp>/steward/ownership/ownership.json with the returned bytes; GITHUB_OUTPUT
        holds 'disposition=runnable\n' and 'commit=true\n'.
      - 'multi-line outputs are refused': the fake gate returns an output value containing String.fromCharCode(10) -> 1 and
        GITHUB_OUTPUT is absent or empty.
      - 'the step summary is bounded': the fake gate writes a 70000-character summary -> the summary file length <= 65536.
      - 'invariant 4: hosted upload failure never yields pass': RUNNER_TEMP points at a regular file (so staging cannot write) ->
        exit 1; GITHUB_OUTPUT does not contain 'commit=true'; stdout contains 'could not be staged'.
      - 'a failed core run exits nonzero without outputs': the fake gate returns { ok: false, failure: { code:
        'gate.policy-missing', ... }, logLines: [] } -> 1; stdout contains 'gate failed gate.policy-missing'; no GITHUB_OUTPUT
        content.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('packages/action/package.json','utf8'));const chk=[['packages/action/src/outputs.ts','export function formatOutputs'],['packages/action/src/files.ts','export async function writeStagingFile'],['packages/core/src/index.ts',\"export * from './pipeline/hosted-publish.js';\"]];const miss=chk.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s)).map(c=>c.join(' '));if(!(p.dependencies&&p.dependencies['@patch-steward/core']))miss.push('core dependency');console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/action/src/dispatch.ts, packages/action/src/main.ts, and packages/action/src/dispatch.test.ts per context.
    3. Run: pnpm exec prettier --write packages/action/src/dispatch.ts packages/action/src/main.ts packages/action/src/dispatch.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/action --reporter=json --outputFile=node_modules/.m6-p3-3.24.json -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.24.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['the action dispatches gate and publish','an unknown job prints usage and exits 2','masks are emitted before any other output','environment failures name the variable, never its value','gate files are staged under the runner temp directory','multi-line outputs are refused','the step summary is bounded','invariant 4: hosted upload failure never yields pass','a failed core run exits nonzero without outputs','outputs are single-line name value pairs','staging paths live under the temp root'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const before=new Set(fs.readdirSync(T));const r=cp.spawnSync('pnpm vitest run packages/action',{shell:true,stdio:'ignore'});const fresh=fs.readdirSync(T).filter(n=>!before.has(n)&&n.startsWith('m6-act-'));console.log('exit '+r.status+' leaked '+fresh.length)"
       -> prints exactly: exit 0 leaked 0
    4. pnpm build -> exit 0
    5. node packages/action/dist/main.js; echo "exit $?" -> prints exactly two lines: usage: main.js gate|publish, then exit 2
    6. GITHUB_EVENT_NAME= node packages/action/dist/main.js gate; echo "exit $?" -> prints exactly two lines: ::error::action.environment-invalid GITHUB_EVENT_NAME, then exit 1
    7. pnpm typecheck -> exit 0
    8. pnpm vitest run -> exit 0
    9. pnpm exec eslint packages/action -> exit 0
    10. pnpm exec prettier --check packages/action -> exit 0
    11. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/action/src/dispatch.ts packages/action/src/main.ts packages/action/src/dispatch.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the three new files).
