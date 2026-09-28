# Step 3.25

- id: 3.25
- depends_on: [3.17, 3.19, 3.20, 3.21, 3.22, 3.23, 3.24]
- route: mechanical
- objective: Verify the phase 3 Definition of Done in the main tree and record every check with its command, expected result, actual result, and verdict.
- files_in_scope:
    - development-artifacts/patch-steward-m6-3.25-report.md
- context: |
    Verification-only gate for phase 3 (hosted gate and publish, action package entry, conformance extensions) of plan
    patch-steward-m6. Run IN THE MAIN TREE (/c/Users/John/Projects/steady-orchard/patch-steward, Git Bash) on branch
    milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish after steps 3.1 to 3.24 are merged; long worktree paths break
    `pnpm test`. Change NO file except this step's report. An honest FAIL is a successful gate: record it; never fix code, never
    edit tests, never rerun a failing check with different options to make it pass.
    Phase base commit (before any phase 3 code change; the decomposition commit touches only development-artifacts/):
    13d99dc04943dca10e10ba9976b02ecdc90693fa.
    Phase 3 Definition of Done: toolchain passes; `pnpm vitest run packages/core/src/conformance packages/action
    packages/core/src/pipeline` passes with the hosted invariant titles (invariant 2, 4, 7, 8, the write allowlist, the never-pass
    table; the workflow scan and static workflow tests belong to a later phase); the fixture-tier hosted scenarios pass and assert
    the gate's request order (ownership listing before capture), a verified echo that captures and uploads nothing, duplicate keeps
    owner, body change commits, newer owner and changed snapshot supersede (the newer-owner record carries the successor's run
    attempt), a tie (including one with this run's artifact), an incomplete listing, or an unavailable read fails publication with
    no supersession, failure before commitment commits nothing, publish failure leaves no evidence, the evidence commit precedes the
    summary write, publish loads the policy by the gate context's tree id with no live default-branch policy read before the
    commit, a binding mismatch fails before any evidence request, an over-cap run publishes a waiting run directory, a closure
    publishes a metrics-only commit; the lockfile diff since the phase base is only the action -> core workspace link. Also
    checked: no live network in any test; packages/cli/, .github/, templates/, docs/, scenarios/, and the build and lint configs
    unchanged; no dependency added except the action's core link; temp-directory leak check clean; no raw control, bidi, or
    zero-width character in changed files; no probe secret name in packages/ or the new fixtures; the built action entry runs.
    Known pre-existing temp-directory leaks in packages/cli tests: prefixes policy-gitconfig-, policy-repo-, ps-cli-missing-
    (tolerated by D7; any other new test temp entry fails it).
- actions: |
    Run each check below from the repo root in Git Bash, in order, even if an earlier one fails. For each, capture the exit status
    and the verbatim relevant output (last lines for long output).
    D1. pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
        expected: exit 0
    D2. pnpm vitest run packages/core/src/conformance packages/action packages/core/src/pipeline --reporter=json --outputFile=node_modules/.m6-p3-gate.json
        then
        node -e "const r=require('./node_modules/.m6-p3-gate.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const steps=['event','token mint','policy','capture','listing','download','run list','upload','handoff','binding','closure record','publish policy','own artifact','store tip','blob','tree','commit','compare','ref update','read-back','settle re-list','successor record','recapture','freshness'];const need=[...steps.map(s=>'invariant 4: hosted '+s+' failure never yields pass'),'pull request policy changes never govern the hosted run','ownership ties block publication','newer owner supersedes','unknown freshness fails publication','an unchanged snapshot keeps the hosted owner','an explicit rerun replaces the hosted owner','the newest owner is chosen by creation time, never id','an incomplete listing blocks publication','a changed policy revision supersedes','invariant 7: the app key and tokens never reach hosted outputs or evidence','invariant 7: every minted token is masked before it is used','invariant 7: hosted constants keep their hard values','invariant 7: publish waits exactly the settle delay','invariant 7: hosted inputs are size bounded','invariant 7: hosted job summaries stay within the bound','invariant 7: store conflict waits are bounded','invariant 7: app jwts expire within the hard lifetime','only the evidence store and token endpoints are writable','hosted runs send only allowlisted writes','the gate sends no write other than token requests','non-get requests are built only by the writer users','zero model calls and zero executions','screen makes only GET requests','hosted failure code gate.policy-missing never yields pass','hosted failure code gate.policy-invalid never yields pass','hosted failure code gate.repository-gate-unsupported never yields pass','hosted failure code publish.freshness-unknown never yields pass','hosted failure code action.environment-invalid never yields pass','ownership modules import no file system or network module','invariant 5: every exported load, validate, resolve, parse, capture, and check function rejects invalid input','the action dispatches gate and publish','an unknown job prints usage and exits 2','masks are emitted before any other output','environment failures name the variable, never its value','gate files are staged under the runner temp directory','multi-line outputs are refused','the step summary is bounded','a failed core run exits nonzero without outputs','outputs are single-line name value pairs','bounded reads report missing, oversize, and unreadable files'];const miss=need.filter(t=>!got.has(t));console.log(need.length+' required; '+(miss.length?'MISSING '+JSON.stringify(miss):'titles ok'))"
        expected: the vitest run exits 0 and the node command prints exactly: 64 required; titles ok
    D3. pnpm vitest run packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts packages/core/src/pipeline/hosted-gate.test.ts packages/core/src/pipeline/hosted-publish.test.ts --reporter=json --outputFile=node_modules/.m6-p3-gate-scn.json
        then
        node -e "const r=require('./node_modules/.m6-p3-gate-scn.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['fixture events authenticate against the test-bed environment','the hosted gate lists ownership before capture','a verified echo with synthetic receipts captures and uploads nothing','a title-only edit keeps the owner','a body edit commits a new owner','a reopened issue commits whatever the snapshot','a tie or incomplete listing still commits','an unavailable ownership read fails the gate','a failure before commitment commits nothing','an over-cap submission is queued with its counts','closures pair the newest owner and attribute the resolution','a fork pull request is screened under the trusted policy','hostile event text never reaches outputs or files','evidence commit precedes the summary write','a newer owner supersedes and records the successor attempt','a changed snapshot supersedes','a tie that includes this run fails publication without supersession','an incomplete listing fails publication without supersession','an unavailable successor read fails publication without supersession','a publish failure before the commit leaves no evidence','publish reads the policy by tree id and not the live policy before the commit','a binding mismatch fails before any evidence request','an over-cap run publishes a waiting run directory','a closure publishes a metrics-only commit','the evidence store stays append-only across runs','the gate lists ownership before capture','a verified echo stops before capture','a closure records a paired resolution','a runnable issue publishes an inconclusive outcome with evidence first','publish loads the gate policy by tree id before any evidence request','unknown freshness fails after the evidence commit'];const miss=need.filter(t=>!got.has(t));console.log(need.length+' required; '+(miss.length?'MISSING '+JSON.stringify(miss):'titles ok'))"
        expected: the vitest run exits 0 and the node command prints exactly: 31 required; titles ok
    D4. node -e "const base=require('child_process').execSync('git show 13d99dc04943dca10e10ba9976b02ecdc90693fa:pnpm-lock.yaml').toString().replace(/\r/g,'');const now=require('child_process').execSync('git show HEAD:pnpm-lock.yaml').toString().replace(/\r/g,'');const block=\"  packages/action:\n    dependencies:\n      '@patch-steward/core':\n        specifier: workspace:*\n        version: link:../core\n\";console.log(now.includes(block)&&now.replace(block,'  packages/action: {}\n')===base?'lockfile link only':'lockfile differs')"
        expected: prints exactly: lockfile link only
    D5. NODE_OPTIONS='--import=data:text/javascript,globalThis.fetch=async()=>{throw(0)}' pnpm test
        expected: exit 0
    D6. git diff --name-only 13d99dc04943dca10e10ba9976b02ecdc90693fa HEAD -- packages/cli .github templates docs scenarios probes vitest.config.ts vitest.live.config.ts eslint.config.mjs .prettierrc.json .prettierignore .gitignore package.json packages/core/package.json packages/cli/package.json packages/web packages/core/tsconfig.json packages/core/tsconfig.test.json packages/action/tsconfig.json tsconfig.base.json
        then
        node -e "const p=require('./packages/action/package.json');console.log(JSON.stringify(p.dependencies))"
        expected: the git command prints nothing; the node command prints exactly: {"@patch-steward/core":"workspace:*"}
    D7. node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const before=new Set(fs.readdirSync(T));const r=cp.spawnSync('pnpm test',{shell:true,stdio:'ignore'});const fresh=fs.readdirSync(T).filter(n=>!before.has(n)&&/^(ps-|m5-|m6-|policy-|preflight-|invariant5-|repo-|no-such-)/.test(n));const bad=fresh.filter(n=>!/^(policy-gitconfig-|policy-repo-|ps-cli-missing-)/.test(n));console.log('test exit '+r.status+'; new test temp entries '+fresh.length+'; unexpected '+JSON.stringify(bad));console.log(r.status===0&&bad.length===0?'leak check clean':'leak check FAILED')"
        expected: last line prints exactly: leak check clean
    D8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" $(git diff --name-only --diff-filter=AM 13d99dc04943dca10e10ba9976b02ecdc90693fa HEAD -- packages fixtures)
        expected: prints exactly: clean
    D9. git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' HEAD -- packages fixtures/events fixtures/github/hosted
        expected: no output (exit 1)
    D10. node packages/action/dist/main.js; echo "exit $?"
         expected: prints exactly two lines: usage: main.js gate|publish, then exit 2
    D11. git grep -c "^export \* from" HEAD -- packages/core/src/index.ts; grep -c "new URL('../../../action/src/', import.meta.url)" packages/core/src/conformance/zero-execution.fixture.test.ts
         expected: prints exactly two lines: HEAD:packages/core/src/index.ts:114, then 1
    Write the report. In its changes field put a section `## Definition of Done` containing, for each check D1 to D11 in order, a
    block of exactly this shape (each line starting at column 0):
      ### D<n>
      - command: <the command as run>
      - expected: <the expected result above>
      - actual: <exit status and verbatim relevant output>
      - verdict: PASS or FAIL
    and after D11 one line `overall: PASS` when all eleven passed, else `overall: FAIL`. Set the report status to pass when the
    report is complete (even when overall is FAIL; the supervisor routes failures).
- acceptance: |
    Run from the repo root in Git Bash after writing the report; it must give exactly the stated result (it inspects only the
    `## Definition of Done` section, up to the next level-2 heading; an honest FAIL verdict satisfies it exactly like PASS).
    1. node -e "const s=require('fs').readFileSync('development-artifacts/patch-steward-m6-3.25-report.md','utf8').replace(/\r/g,'');const i=s.indexOf('## Definition of Done');const sec=i<0?'':s.slice(i).split(/\n(?=## )/)[0];const n=(re)=>(sec.match(re)||[]).length;const ok=n(/^### D([1-9]|1[01])$/gm)===11&&n(/^- verdict: (PASS|FAIL)$/gm)===11&&n(/^- command: /gm)===11&&n(/^- expected: /gm)===11&&n(/^- actual: /gm)===11&&n(/^overall: (PASS|FAIL)$/gm)===1;console.log(ok?'report complete':'report incomplete')"
       -> prints exactly: report complete
- rollback: |
    git revert <this step's commit> (removes the report only).
