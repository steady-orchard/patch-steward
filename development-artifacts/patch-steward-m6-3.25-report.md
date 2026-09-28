- status: pass
- base: 325b65254936fcf8490fe30219a1ce4e2126a796
- changes: |
    No source files changed; this step only verifies the phase 3 Definition of Done in the main tree and records the result.

## Definition of Done

### D1
- command: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
- expected: exit 0
- actual: Lockfile is up to date, resolution step is skipped; Already up to date; build: packages/web, packages/core, packages/action, packages/cli all "Done"; typecheck: no output (all four tsc --noEmit invocations succeeded); test: Test Files 186 passed (186); Tests 3440 passed (3440); lint: no output (eslint . succeeded); format:check: Checking formatting...  All matched files use Prettier code style!; overall exit 0
- verdict: PASS

### D2
- command: pnpm vitest run packages/core/src/conformance packages/action packages/core/src/pipeline --reporter=json --outputFile=node_modules/.m6-p3-gate.json then node -e "<titles check script from step packet>"
- expected: the vitest run exits 0 and the node command prints exactly: 64 required; titles ok
- actual: JSON report written to .../node_modules/.m6-p3-gate.json; vitest exit 0; node command printed: 64 required; titles ok
- verdict: PASS

### D3
- command: pnpm vitest run packages/core/src/pipeline/hosted-gate-scenarios.fixture.test.ts packages/core/src/pipeline/hosted-publish-scenarios.fixture.test.ts packages/core/src/pipeline/hosted-gate.test.ts packages/core/src/pipeline/hosted-publish.test.ts --reporter=json --outputFile=node_modules/.m6-p3-gate-scn.json then node -e "<titles check script from step packet>"
- expected: the vitest run exits 0 and the node command prints exactly: 31 required; titles ok
- actual: JSON report written to .../node_modules/.m6-p3-gate-scn.json; vitest exit 0; node command printed: 31 required; titles ok
- verdict: PASS

### D4
- command: node -e "const base=require('child_process').execSync('git show 13d99dc04943dca10e10ba9976b02ecdc90693fa:pnpm-lock.yaml')...console.log(now.includes(block)&&now.replace(block,'  packages/action: {}\n')===base?'lockfile link only':'lockfile differs')"
- expected: prints exactly: lockfile link only
- actual: lockfile link only
- verdict: PASS

### D5
- command: NODE_OPTIONS='--import=data:text/javascript,globalThis.fetch=async()=>{throw(0)}' pnpm test
- expected: exit 0
- actual: Test Files 186 passed (186); Tests 3440 passed (3440); exit 0
- verdict: PASS

### D6
- command: git diff --name-only 13d99dc04943dca10e10ba9976b02ecdc90693fa HEAD -- packages/cli .github templates docs scenarios probes vitest.config.ts vitest.live.config.ts eslint.config.mjs .prettierrc.json .prettierignore .gitignore package.json packages/core/package.json packages/cli/package.json packages/web packages/core/tsconfig.json packages/core/tsconfig.test.json packages/action/tsconfig.json tsconfig.base.json then node -e "const p=require('./packages/action/package.json');console.log(JSON.stringify(p.dependencies))"
- expected: the git command prints nothing; the node command prints exactly: {"@patch-steward/core":"workspace:*"}
- actual: git command printed nothing; node command printed {"@patch-steward/core":"workspace:*"}
- verdict: PASS

### D7
- command: node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const before=new Set(fs.readdirSync(T));const r=cp.spawnSync('pnpm test',{shell:true,stdio:'ignore'});const fresh=fs.readdirSync(T).filter(n=>!before.has(n)&&/^(ps-|m5-|m6-|policy-|preflight-|invariant5-|repo-|no-such-)/.test(n));const bad=fresh.filter(n=>!/^(policy-gitconfig-|policy-repo-|ps-cli-missing-)/.test(n));console.log('test exit '+r.status+'; new test temp entries '+fresh.length+'; unexpected '+JSON.stringify(bad));console.log(r.status===0&&bad.length===0?'leak check clean':'leak check FAILED')"
- expected: last line prints exactly: leak check clean
- actual: test exit 0; new test temp entries 17; unexpected []; leak check clean
- verdict: PASS

### D8
- command: node -e "<control/bidi/zero-width char scan script>" $(git diff --name-only --diff-filter=AM 13d99dc04943dca10e10ba9976b02ecdc90693fa HEAD -- packages fixtures)
- expected: prints exactly: clean
- actual: clean
- verdict: PASS

### D9
- command: git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' HEAD -- packages fixtures/events fixtures/github/hosted
- expected: no output (exit 1)
- actual: no output; exit 1
- verdict: PASS

### D10
- command: node packages/action/dist/main.js; echo "exit $?"
- expected: prints exactly two lines: usage: main.js gate|publish, then exit 2
- actual: usage: main.js gate|publish; exit 2
- verdict: PASS

### D11
- command: git grep -c "^export \* from" HEAD -- packages/core/src/index.ts; grep -c "new URL('../../../action/src/', import.meta.url)" packages/core/src/conformance/zero-execution.fixture.test.ts
- expected: prints exactly two lines: HEAD:packages/core/src/index.ts:114, then 1
- actual: HEAD:packages/core/src/index.ts:114; 1
- verdict: PASS

overall: PASS
- acceptance: |
    node -e "const s=require('fs').readFileSync('development-artifacts/patch-steward-m6-3.25-report.md','utf8').replace(/\r/g,'');const i=s.indexOf('## Definition of Done');const sec=i<0?'':s.slice(i).split(/\n(?=## )/)[0];const n=(re)=>(sec.match(re)||[]).length;const ok=n(/^### D([1-9]|1[01])$/gm)===11&&n(/^- verdict: (PASS|FAIL)$/gm)===11&&n(/^- command: /gm)===11&&n(/^- expected: /gm)===11&&n(/^- actual: /gm)===11&&n(/^overall: (PASS|FAIL)$/gm)===1;console.log(ok?'report complete':'report incomplete')"
    report complete
- deviations: none
