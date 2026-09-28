# Step 3.7

- id: 3.7
- depends_on: []
- route: mechanical
- objective: Add runner-environment reading for the hosted gate and publish jobs (required GitHub runner variables, the App credential variables, and the gate outputs publish receives), with failures that name the variable and never its value, as packages/core/src/pipeline/hosted-environment.ts.
- files_in_scope:
    - packages/core/src/pipeline/hosted-environment.ts
    - packages/core/src/pipeline/hosted-environment.test.ts
    - development-artifacts/patch-steward-m6-3.7-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: the JavaScript action runs `node .../main.js gate` or `... publish` inside GitHub Actions jobs. Everything it knows comes
    from environment variables: the standard runner variables, the GitHub App credentials (delivered ONLY as the Environment
    secrets of the publication Environment, mapped by the one core step under the identical names `PATCH_STEWARD_APP_ID` and
    `PATCH_STEWARD_APP_PRIVATE_KEY`; an empty value means the job did not receive the secret), and, for publish, four values copied
    from the gate job's outputs. This module validates them; the event payload itself is authenticated elsewhere (authenticateEvent
    in packages/core/src/ownership/events.ts, whose EventEnvironment input is { eventName, repository, repositoryId, ref, serverUrl,
    apiUrl, runId, runAttempt }, all strings).

    Variables, checked in exactly this order (the first failure is returned):
      gate and publish: GITHUB_EVENT_NAME, GITHUB_EVENT_PATH, GITHUB_REPOSITORY, GITHUB_REPOSITORY_ID, GITHUB_REF,
        GITHUB_SERVER_URL, GITHUB_API_URL, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, RUNNER_TEMP, GITHUB_OUTPUT, GITHUB_STEP_SUMMARY;
      publish only, next: STEWARD_GATE_DISPOSITION, STEWARD_GATE_RECORD_ONLY, STEWARD_GATE_SNAPSHOT_HASH,
        STEWARD_GATE_POLICY_REVISION;
      last, both jobs: PATCH_STEWARD_APP_ID, PATCH_STEWARD_APP_PRIVATE_KEY.
    Rules:
    - Every runner variable (the first twelve): present, length 1..4096, and no char code < 32 or === 127. GITHUB_REPOSITORY_ID and
      GITHUB_RUN_ID also match /^[1-9][0-9]{0,19}$/ with Number.isSafeInteger(Number(value)); GITHUB_RUN_ATTEMPT matches
      /^[1-9][0-9]{0,4}$/. (Semantic checks such as the server URL or the ref belong to authenticateEvent, not here.)
    - STEWARD_GATE_DISPOSITION is one of GATE_DISPOSITIONS ('runnable', 'early-exit', 'queued', 'duplicate', 'closure') from
      '../vocabulary.js'; STEWARD_GATE_RECORD_ONLY is 'true' or 'false'; STEWARD_GATE_SNAPSHOT_HASH is '' or matches
      /^sha256:[0-9a-f]{64}$/; STEWARD_GATE_POLICY_REVISION is '' or matches /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/. Each must be
      PRESENT (undefined is invalid); '' maps to null.
    - Any runner or gate-output failure -> err('action.environment-invalid', 'infrastructure', 'The runner environment is
      incomplete or invalid.', [{ code: 'action.environment-invalid', path: <VARIABLE NAME>, message: <same message>, line: null,
      column: null }]).
    - PATCH_STEWARD_APP_ID must match /^[1-9][0-9]{0,19}$/; PATCH_STEWARD_APP_PRIVATE_KEY must be 1..16384 characters. A missing,
      empty, or invalid value -> err('app-auth.credentials-invalid', 'credential-unusable', 'The GitHub App credentials are not
      usable.', [{ code: 'app-auth.credentials-invalid', path: <VARIABLE NAME>, message: <same>, line: null, column: null }]).
    - A failure never contains any variable VALUE (only names and the fixed messages).
    Values are returned unchanged as strings (no trimming).

    Required API (exact names; export nothing else; names verified unique across packages/core/src and packages/cli/src; the
    constant names avoid the probe secret names on purpose):
      export const HOSTED_ENVIRONMENT_FAILURE_CODES = ['action.environment-invalid'] as const;
      export type HostedEnvironmentFailureCode = (typeof HOSTED_ENVIRONMENT_FAILURE_CODES)[number];
      export const HOSTED_APP_ID_VARIABLE = 'PATCH_STEWARD_APP_ID';
      export const HOSTED_APP_KEY_VARIABLE = 'PATCH_STEWARD_APP_PRIVATE_KEY';
      export interface HostedCommonEnvironment {
        readonly eventName: string; readonly eventPath: string; readonly repository: string; readonly repositoryId: string;
        readonly ref: string; readonly serverUrl: string; readonly apiUrl: string; readonly runId: string;
        readonly runAttempt: string; readonly runnerTemp: string; readonly outputPath: string; readonly summaryPath: string;
        readonly credentials: AppCredentials;              // { appId, privateKey } type from '../github/app-auth.js'
      }
      export interface HostedGateEnvironment extends HostedCommonEnvironment { readonly job: 'gate' }
      export interface HostedGateOutputValues {
        readonly disposition: GateDisposition; readonly recordOnly: boolean;
        readonly snapshotHash: string | null; readonly policyRevision: string | null;
      }
      export interface HostedPublishEnvironment extends HostedCommonEnvironment {
        readonly job: 'publish'; readonly gate: HostedGateOutputValues;
      }
      export type HostedEnvironmentVariables = Readonly<Record<string, string | undefined>>;
      export function readGateEnvironment(env: HostedEnvironmentVariables):
        Result<HostedGateEnvironment, HostedEnvironmentFailureCode | 'app-auth.credentials-invalid'>;
      export function readPublishEnvironment(env: HostedEnvironmentVariables):
        Result<HostedPublishEnvironment, HostedEnvironmentFailureCode | 'app-auth.credentials-invalid'>;
      export function hostedEventEnvironment(environment: HostedCommonEnvironment): EventEnvironment;  // type from
        // '../ownership/events.js': { eventName, repository, repositoryId, ref, serverUrl, apiUrl, runId, runAttempt }

    Test data: a complete gate map { GITHUB_EVENT_NAME: 'issues', GITHUB_EVENT_PATH: '/tmp/event.json', GITHUB_REPOSITORY:
    'steady-orchard/patch-steward-testbed-public', GITHUB_REPOSITORY_ID: '1376317064', GITHUB_REF: 'refs/heads/master',
    GITHUB_SERVER_URL: 'https://github.com', GITHUB_API_URL: 'https://api.github.com', GITHUB_RUN_ID: '36081628326',
    GITHUB_RUN_ATTEMPT: '1', RUNNER_TEMP: '/tmp/work', GITHUB_OUTPUT: '/tmp/work/output', GITHUB_STEP_SUMMARY: '/tmp/work/summary',
    PATCH_STEWARD_APP_ID: '4993303', PATCH_STEWARD_APP_PRIVATE_KEY: KEY } where KEY is built by concatenation, for example
    '-----' + 'BEGIN TEST KEY-----\n' + 'Q'.repeat(64) + '\n-----' + 'END TEST KEY-----\n'. Publish adds STEWARD_GATE_DISPOSITION
    'runnable', STEWARD_GATE_RECORD_ONLY 'false', STEWARD_GATE_SNAPSHOT_HASH 'sha256:' + 'a'.repeat(64),
    STEWARD_GATE_POLICY_REVISION 'b'.repeat(40).

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters (build them in tests with String.fromCharCode). Never write the text
    STEWARD_APP_ID, STEWARD_APP_PRIVATE_KEY, or STEWARD_APP_CLIENT_ID unless immediately preceded by PATCH_ (identifiers included).
    Do not edit packages/core/src/index.ts or any existing file. Tests are pure: no temp files, no child processes, no network, no
    reads of process.env.
- actions: |
    1. Create packages/core/src/pipeline/hosted-environment.ts per context.
    2. Create packages/core/src/pipeline/hosted-environment.test.ts (describe 'hosted environment'), plain it(...) with EXACTLY these
       titles:
       - 'a complete gate environment is read': ok; job 'gate'; every field equals its variable; credentials { appId: '4993303',
         privateKey: KEY }.
       - 'a publish environment carries the gate outputs': ok; job 'publish'; gate { disposition: 'runnable', recordOnly: false,
         snapshotHash, policyRevision }; with STEWARD_GATE_SNAPSHOT_HASH '' and STEWARD_GATE_RECORD_ONLY 'true' and disposition
         'closure' -> snapshotHash null and recordOnly true.
       - 'a missing runner variable names the variable': for each of the twelve runner variables, deleting it gives
         'action.environment-invalid' with details[0].path equal to its name.
       - 'malformed run identifiers are rejected': GITHUB_RUN_ID '0', '01', '1'.repeat(21), GITHUB_RUN_ATTEMPT '0',
         GITHUB_REPOSITORY_ID 'x', and a GITHUB_REF containing String.fromCharCode(10) -> each 'action.environment-invalid' with the
         right path.
       - 'invalid gate outputs are rejected': disposition 'passed', record_only 'yes', snapshot 'sha256:xyz', revision 'abc', and a
         missing STEWARD_GATE_POLICY_REVISION -> each 'action.environment-invalid' with the right path.
       - 'empty app credentials are unusable': PATCH_STEWARD_APP_ID '' , 'abc', missing; PATCH_STEWARD_APP_PRIVATE_KEY '' and 'k'
         .repeat(16385) -> each 'app-auth.credentials-invalid' with details[0].path the variable name; runner variables are checked
         first (a missing GITHUB_RUN_ID with an empty key gives 'action.environment-invalid').
       - 'environment failures never include a value': for a failure caused by each of KEY, an invalid app id '9x' + 'secretish',
         and a bad RUNNER_TEMP containing the text 'value-sentinel' plus String.fromCharCode(0), JSON.stringify(result) contains
         none of those values.
       - 'the event environment maps runner variables': hostedEventEnvironment(read.value) equals { eventName: 'issues',
         repository, repositoryId: '1376317064', ref: 'refs/heads/master', serverUrl, apiUrl, runId: '36081628326', runAttempt: '1'
         }.
    3. Run: pnpm exec prettier --write packages/core/src/pipeline/hosted-environment.ts packages/core/src/pipeline/hosted-environment.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/hosted-environment.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.7.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.7.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['a complete gate environment is read','a publish environment carries the gate outputs','a missing runner variable names the variable','malformed run identifiers are rejected','invalid gate outputs are rejected','empty app credentials are unusable','environment failures never include a value','the event environment maps runner variables'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- packages/core/src/pipeline/hosted-environment.ts packages/core/src/pipeline/hosted-environment.test.ts; echo "grep $?"
       -> prints exactly: grep 1
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/pipeline/hosted-environment.ts packages/core/src/pipeline/hosted-environment.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/pipeline/hosted-environment.ts packages/core/src/pipeline/hosted-environment.test.ts -> exit 0
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/hosted-environment.ts packages/core/src/pipeline/hosted-environment.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
