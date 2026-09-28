# Step 3.9

- id: 3.9
- depends_on: []
- route: mechanical
- objective: Wire the action package to core (workspace dependency, typecheck path mapping, lockfile link) and add its runner-file helpers: output formatting, mask commands, bounded summaries (outputs.ts) and staging and bounded file access under the runner temp directory (files.ts).
- files_in_scope:
    - packages/action/package.json
    - packages/action/tsconfig.test.json
    - pnpm-lock.yaml
    - packages/action/src/outputs.ts
    - packages/action/src/outputs.test.ts
    - packages/action/src/files.ts
    - packages/action/src/files.test.ts
    - development-artifacts/patch-steward-m6-3.9-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest; pnpm 10.20.0); run commands in Git Bash from the worktree root.
    Built-ins only; NO new external dependency: the ONLY lockfile change allowed is the action -> core workspace link.

    Why: `node packages/action/dist/main.js gate|publish` (entry added by a later step) runs the core inside GitHub Actions jobs. It
    writes step outputs to the file named by GITHUB_OUTPUT (lines `name=value`), appends the job summary to GITHUB_STEP_SUMMARY,
    masks secrets by printing `::add-mask::<value>` lines to stdout (GitHub masks per line, so a multi-line PEM key needs one command
    per line), and stages artifact files under RUNNER_TEMP for later `actions/upload-artifact` steps; publish reads the files
    `actions/download-artifact` put there. Staging layout (a binding contract for the workflow written later):
      <RUNNER_TEMP>/steward/handoff/handoff.json         (artifact steward-handoff)
      <RUNNER_TEMP>/steward/handoff/gate-context.json    (artifact steward-handoff)
      <RUNNER_TEMP>/steward/ownership/ownership.json     (artifact steward-ownership-<pr|issue>-<n>)
      <RUNNER_TEMP>/steward/closure/closure.json         (artifact steward-closure)

    Package wiring (exact):
    - packages/action/package.json gains, after "scripts", `"dependencies": { "@patch-steward/core": "workspace:*" }` (formatted
      like packages/cli/package.json). Nothing else changes (no engines, no bin).
    - packages/action/tsconfig.test.json becomes exactly the shape of packages/cli/tsconfig.test.json: { "extends":
      "./tsconfig.json", "compilerOptions": { "noEmit": true, "rootDir": "..", "paths": { "@patch-steward/core":
      ["../core/src/index.ts"] } }, "exclude": [] }.
    - Run `pnpm install` (NOT frozen) once so pnpm-lock.yaml records the link: the `packages/action: {}` importer becomes
        packages/action:
          dependencies:
            '@patch-steward/core':
              specifier: workspace:*
              version: link:../core
      and nothing else in the lockfile changes. Then `pnpm install --frozen-lockfile` must pass.
    Vitest already aliases '@patch-steward/core' to packages/core/src/index.ts for every package; these two helper modules do not
    need to import core.

    Required API, packages/action/src/outputs.ts (exact names; export nothing else):
      export const OUTPUT_VALUE_MAX_LENGTH = 1024;
      export function formatOutputs(outputs: Readonly<Record<string, string>>): string | null;
        // one `${name}=${value}\n` per entry in insertion order ('' for no entries); null when any name does not match
        // /^[a-z][a-z0-9_]{0,63}$/ or any value is longer than OUTPUT_VALUE_MAX_LENGTH or contains a char code < 32 or === 127
      export function maskCommands(secret: string): string;
        // for each line of secret.split(/\r?\n/) that is non-empty: `::add-mask::${line}\n`; '' when there is none
      export function boundedSummaryText(text: string, maxLength: number): string;
        // text when text.length <= maxLength; otherwise the longest prefix that ends at a '\n' and has length <= maxLength - 21,
        // followed by '- Summary truncated.\n' (21 characters); the result length never exceeds maxLength
    Required API, packages/action/src/files.ts (exact names; export nothing else; node:fs/promises and node:path only):
      export const STAGING_ROOT = 'steward';
      export const STAGING_PATHS = Object.freeze({ handoff: 'handoff/handoff.json', 'gate-context': 'handoff/gate-context.json',
        ownership: 'ownership/ownership.json', closure: 'closure/closure.json' });
      export type StagingFileName = keyof typeof STAGING_PATHS;
      export function stagingPath(tempRoot: string, name: StagingFileName): string;
        // path.join(tempRoot, STAGING_ROOT, ...STAGING_PATHS[name].split('/')); throws RangeError when tempRoot is not absolute
      export async function writeStagingFile(tempRoot: string, name: StagingFileName, bytes: Uint8Array): Promise<void>;
        // mkdir -p the parent, then writeFile with flag 'wx' (an existing file is an error); rejects on any failure
      export type BoundedRead =
        | { readonly kind: 'ok'; readonly bytes: Uint8Array } | { readonly kind: 'missing' }
        | { readonly kind: 'too-large' } | { readonly kind: 'unreadable' };
      export async function readBoundedFile(filePath: string, maxBytes: number): Promise<BoundedRead>;
        // stat first: ENOENT -> 'missing'; not a regular file or any other error -> 'unreadable'; size > maxBytes ->
        // 'too-large' without reading; else read and re-check the length (> maxBytes -> 'too-large'); never throws
      export async function appendTextFile(filePath: string, text: string): Promise<void>;  // fs appendFile, utf8

    Module names must not contain the words llm, model, copilot, openai, anthropic, sandbox, container, docker, or runner (a
    conformance scan checks import specifiers); `files.ts` and `outputs.ts` are fine.

    Tests: temporary directories ONLY via fs.mkdtempSync(path.join(os.tmpdir(), 'm6-act-')), removed in afterEach with
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); no child processes; no network.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters (build them with String.fromCharCode). Credential-like samples are
    built by concatenation. Leave packages/action/src/index.ts and index.test.ts unchanged.
- actions: |
    1. Edit packages/action/package.json and packages/action/tsconfig.test.json per context.
    2. Run: pnpm install   (then: pnpm install --frozen-lockfile — must exit 0)
    3. Create packages/action/src/outputs.ts and packages/action/src/outputs.test.ts (describe 'action outputs'), plain it(...)
       titles EXACTLY:
       - 'outputs are single-line name value pairs': { disposition: 'runnable', commit: 'true', snapshot_hash: '' } ->
         'disposition=runnable\ncommit=true\nsnapshot_hash=\n'.
       - 'multi-line or oversize outputs are refused': a value containing String.fromCharCode(10), a value containing
         String.fromCharCode(13), a 1025-character value, a name 'Bad-Name' -> null each.
       - 'masks cover every line of a secret': a two-line secret built by concatenation plus a trailing newline -> exactly two
         '::add-mask::' lines, one per non-empty line; '' for an empty secret.
       - 'summaries stay within the bound': a 70000-character text of 70-character lines with maxLength 65536 -> length <= 65536,
         ends with '- Summary truncated.\n'; a short text is returned unchanged.
    4. Create packages/action/src/files.ts and packages/action/src/files.test.ts (describe 'action files'), plain it(...) titles
       EXACTLY:
       - 'staging paths live under the temp root': stagingPath(root, 'gate-context') equals path.join(root, 'steward', 'handoff',
         'gate-context.json'); a relative root throws RangeError.
       - 'staging files are written once': writeStagingFile twice for 'ownership' -> the second rejects; the file holds the first
         bytes.
       - 'bounded reads report missing, oversize, and unreadable files': a missing path -> 'missing'; a 10-byte file with maxBytes 9
         -> 'too-large'; a directory -> 'unreadable'; a 10-byte file with maxBytes 10 -> 'ok' with the bytes.
       - 'text is appended to runner files': appendTextFile twice -> the file holds both texts in order.
    5. Run: pnpm exec prettier --write packages/action/package.json packages/action/tsconfig.test.json packages/action/src/outputs.ts packages/action/src/outputs.test.ts packages/action/src/files.ts packages/action/src/files.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm install --frozen-lockfile -> exit 0
    2. node -e "const base=require('child_process').execSync('git show 13d99dc04943dca10e10ba9976b02ecdc90693fa:pnpm-lock.yaml').toString().replace(/\r/g,'');const now=require('fs').readFileSync('pnpm-lock.yaml','utf8').replace(/\r/g,'');const block=\"  packages/action:\n    dependencies:\n      '@patch-steward/core':\n        specifier: workspace:*\n        version: link:../core\n\";console.log(now.includes(block)&&now.replace(block,'  packages/action: {}\n')===base?'lockfile link only':'lockfile differs')"
       -> prints exactly: lockfile link only
    3. node -e "const p=require('./packages/action/package.json');console.log(JSON.stringify(p.dependencies))" -> prints exactly: {"@patch-steward/core":"workspace:*"}
    4. pnpm vitest run packages/action --reporter=json --outputFile=node_modules/.m6-p3-3.9.json -> exit 0
    5. node -e "const r=require('./node_modules/.m6-p3-3.9.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['outputs are single-line name value pairs','multi-line or oversize outputs are refused','masks cover every line of a secret','summaries stay within the bound','staging paths live under the temp root','staging files are written once','bounded reads report missing, oversize, and unreadable files','text is appended to runner files'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    6. node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const before=new Set(fs.readdirSync(T));const r=cp.spawnSync('pnpm vitest run packages/action',{shell:true,stdio:'ignore'});const fresh=fs.readdirSync(T).filter(n=>!before.has(n)&&n.startsWith('m6-act-'));console.log('exit '+r.status+' leaked '+fresh.length)"
       -> prints exactly: exit 0 leaked 0
    7. pnpm build && pnpm typecheck -> exit 0
    8. pnpm vitest run -> exit 0
    9. pnpm exec eslint packages/action -> exit 0
    10. pnpm exec prettier --check packages/action -> exit 0 (pnpm-lock.yaml is Prettier-ignored by the repository)
    11. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/action/package.json packages/action/tsconfig.test.json packages/action/src/outputs.ts packages/action/src/outputs.test.ts packages/action/src/files.ts packages/action/src/files.test.ts
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit>, then `pnpm install --frozen-lockfile` (restores the unlinked action package and lockfile).
