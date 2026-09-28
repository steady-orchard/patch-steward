- status: pass
- base: 7c046bcde6964169a9c1c36019cb402d915526fe
- changes:

No source files changed. Verified the phase 4 Definition of Done in the main tree (branch
milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish at HEAD 7c046bcde6964169a9c1c36019cb402d915526fe) and,
read-only, against the three test-beds. Wrote this report only.

## Definition of Done

### D1
- command: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
- expected: exit 0
- actual: exit 0. Test Files 189 passed (189); Tests 3474 passed (3474); lint printed nothing; "Checking formatting... All matched files use Prettier code style!"
- verdict: PASS

### D2
- command: actionlint .github/workflows/steward-screening.yml templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml; echo "exit $?"; actionlint -ignore 'could not read reusable workflow file' scenarios/workflows/*.yml; echo "exit $?"
- expected: prints exactly two lines: exit 0, exit 0
- actual: exit 0 / exit 0
- verdict: PASS

### D3
- command: pnpm vitest run packages/core/src/conformance/workflows.fixture.test.ts packages/core/src/conformance/invariant-1-workflows.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p4-gate.json ; then the node -e title-check command from the step file
- expected: the vitest run exits 0 and the node command prints exactly: 14 required; titles ok
- actual: vitest run wrote "JSON report written to .../node_modules/.m6-p4-gate.json" (exit 0); node command printed exactly: 14 required; titles ok
- verdict: PASS

### D4
- command: git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' HEAD -- .github/workflows/steward-screening.yml templates packages scenarios docs README.md CLAUDE.md ':!docs/project-development-plan.md' ':!docs/astra-plan.md'; echo "exit $?"; git grep -c 'PATCH_STEWARD_APP_PRIVATE_KEY' HEAD -- .github/workflows/steward-screening.yml
- expected: prints exactly two lines: exit 1, then HEAD:.github/workflows/steward-screening.yml:3
- actual: exit 1 / HEAD:.github/workflows/steward-screening.yml:3
- verdict: PASS

### D5
- command: GH_TOKEN=$(gh auth token) pnpm test:live --reporter=json --outputFile=node_modules/.m6-p4-gate-live.json ; then the node -e passed/other count command
- expected: the live run exits 0 and the node command prints `passed <n> other 0` with n >= 1
- actual: live run exited 0 ("JSON report written to .../node_modules/.m6-p4-gate-live.json"); node command printed: passed 15 other 0
- verdict: PASS

### D6
- command: bash -c 'for r in steady-orchard/patch-steward-testbed-public:orphan-branch jambolo/patch-steward-testbed-personal:orphan-branch steady-orchard/patch-steward-testbed-private:repository-store; do repo=${r%%:*}; pol=${r#*:}; for pair in "scenarios/workflows/steward-pr.yml:.github/workflows/steward-pr.yml" "scenarios/workflows/steward-issues.yml:.github/workflows/steward-issues.yml" "scenarios/fixtures/policies/$pol.yml:.github/patch-steward/policy.yml"; do src=${pair%%:*}; dest=${pair#*:}; l=$(git rev-parse "HEAD:$src"); d=$(gh api "repos/$repo/contents/$dest?ref=master" --jq .sha); [ -n "$l" ] && [ "$l" = "$d" ] && echo "same $repo $dest" || echo "DIFF $repo $dest"; done; done' | cut -d' ' -f1 | sort | uniq -c ; then bash -c 'p=$(grep -m1 -o "steward-screening\.yml@[0-9a-f]\{40\}" scenarios/workflows/steward-pr.yml | cut -d@ -f2); q=$(grep -m1 -o "steward-screening\.yml@[0-9a-f]\{40\}" scenarios/workflows/steward-issues.yml | cut -d@ -f2); g=$(grep -c "steward_ref: '$p'" scenarios/workflows/steward-pr.yml scenarios/workflows/steward-issues.yml | cut -d: -f2 | tr "\n" " "); git fetch --quiet origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish && git merge-base --is-ancestor "$p" FETCH_HEAD && [ "$p" = "$q" ] && echo "pin ancestor ok refs=$g"'
- expected: the first prints exactly `      9 same`; the second prints exactly `pin ancestor ok refs=1 1 `
- actual: first: "      9 same"; second: "pin ancestor ok refs=1 1 " (trailing space confirmed with cat -A); pin SHA used: 7161cd20df662314d14cc7f2f4130102baee1e98
- verdict: PASS

### D7
- command: acceptance commands 1 to 6 of development-artifacts/patch-steward-m6-4.17.md, run exactly as written there (D7 note: acceptance 5 is the version corrected in commit e212b67, which is what is committed in that file now)
- expected: exactly the results stated there (report ok; the three success jobs; 2; 3; summary after commit; 2 and the OPEN issue line)
- actual: 1. report ok / 2. screen / build=success,screen / gate=success,screen / publish=success / 3. 2 / 4. 3 / 5. summary after commit / 6. 2 then OPEN [scenario S00] hosted screening smoke
- verdict: PASS

### D8
- command: git diff --quiet 6418129c7b104fd93d9162efcda6fe08373287ee HEAD -- .github/workflows/ci.yml .github/workflows/cd.yml vitest.config.ts vitest.live.config.ts eslint.config.mjs .prettierrc.json .prettierignore .gitignore; echo "exit $?"; ls .gitattributes 2> /dev/null; echo "attrs $?"; git diff --quiet 414ad77be6c63d4ccd5ea33d710285cc3a8c1014 HEAD -- pnpm-lock.yaml package.json packages/core/package.json packages/cli/package.json packages/action/package.json packages/web/package.json; echo "deps $?"
- expected: prints exactly three lines: exit 0, attrs 2, deps 0
- actual: exit 0 / attrs 2 / deps 0
- verdict: PASS

### D9
- command: git diff --name-only 414ad77be6c63d4ccd5ea33d710285cc3a8c1014 HEAD | grep -v -E '^(development-artifacts/|scenarios/|templates/workflows/(steward-pr|steward-issues)\.yml$|templates/README\.md$|templates/policy/policy\.yml$|\.github/workflows/steward-screening\.yml$|packages/action/pack-runtime\.sh$|packages/core/src/submission/default-checklist\.ts$|packages/core/src/pipeline/hosted-verify\.fixture\.test\.ts$|packages/core/src/conformance/(workflows|invariant-1-workflows)\.fixture\.test\.ts$|packages/core/src/github/github\.live\.test\.ts$|packages/cli/src/steward-commands\.live\.test\.ts$)'
- expected: no output
- actual: (no output)
- verdict: PASS

### D10
- command: node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const before=new Set(fs.readdirSync(T));const r=cp.spawnSync('pnpm test',{shell:true,stdio:'ignore'});const fresh=fs.readdirSync(T).filter(n=>!before.has(n)&&/^(ps-|m5-|m6-|policy-|preflight-|invariant5-|repo-|no-such-)/.test(n));const bad=fresh.filter(n=>!/^(policy-gitconfig-|policy-repo-|ps-cli-missing-)/.test(n));console.log('test exit '+r.status+'; new test temp entries '+fresh.length+'; unexpected '+JSON.stringify(bad));console.log(r.status===0&&bad.length===0?'leak check clean':'leak check FAILED')"
- expected: last line prints exactly: leak check clean
- actual: test exit 0; new test temp entries 17; unexpected [] / leak check clean
- verdict: PASS

### D11
- command: node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){if(!fs.existsSync(f))continue;const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" $(git diff --name-only --diff-filter=AM 414ad77be6c63d4ccd5ea33d710285cc3a8c1014 HEAD)
- expected: prints exactly: clean
- actual: clean
- verdict: PASS

### D12
- command: git grep -n -P 'development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' HEAD -- scenarios templates; echo "exit $?"; git grep -c -E 'DF[0-9]{2}|deferred\.md' HEAD -- scenarios templates; echo "exit $?"
- expected: prints exactly two lines: exit 1, exit 1
- actual: exit 1 / exit 1
- verdict: PASS

### D13
- command: bash -c 'for repo in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do gh workflow list -R "$repo" --all --json path,state --jq ".[] | select(.path == \".github/workflows/steward-pr.yml\" or .path == \".github/workflows/steward-issues.yml\") | .path + \" \" + .state"; echo "scenario-workflows $(gh api "repos/$repo/contents/.github/workflows?ref=master" --jq "[.[].name | select(startswith(\"scenario-\"))] | length")"; done' | sort | uniq -c
- expected: prints exactly three lines: `      3 .github/workflows/steward-issues.yml active`, `      3 .github/workflows/steward-pr.yml active`, `      3 scenario-workflows 0`
- actual:       3 .github/workflows/steward-issues.yml active /       3 .github/workflows/steward-pr.yml active /       3 scenario-workflows 0
- verdict: PASS

overall: PASS

## Test-bed state at phase end

- steady-orchard/patch-steward-testbed-public (orphan-branch policy): steward-pr.yml, steward-issues.yml, and
  .github/patch-steward/policy.yml deployed and byte-identical (blob sha) to the canonical scenarios/ copies (D6); wrapper
  pin steward-screening.yml@7161cd20df662314d14cc7f2f4130102baee1e98, an ancestor of origin's milestone branch (D6). Both
  workflows active (D13). No scenario-* helper workflow deployed (D13: scenario-workflows 0). Smoke issue #31
  ("[scenario S00] hosted screening smoke") is OPEN (D7 acceptance 6). Branch steward-evidence holds the smoke run's
  evidence commit 6f1c3c890f7106aa762a591faff452a2cac35c1d for issue-31, run 36397673122-1, verified (D7 acceptance 4);
  no other content added there in this phase.
- jambolo/patch-steward-testbed-personal (orphan-branch policy): steward-pr.yml, steward-issues.yml, and policy deployed
  and byte-identical to the canonical copies (D6); both workflows active, no scenario-* helper deployed (D13). Nothing run
  there in this phase (no issues, PRs, or workflow runs triggered).
- steady-orchard/patch-steward-testbed-private (repository-store policy): steward-pr.yml, steward-issues.yml, and policy
  deployed and byte-identical to the canonical copies (D6); both workflows active, no scenario-* helper deployed (D13).
  Nothing run there in this phase.

- acceptance:

node -e "const s=require('fs').readFileSync('development-artifacts/patch-steward-m6-4.18-report.md','utf8').replace(/\r/g,'');const i=s.indexOf('## Definition of Done');const sec=i<0?'':s.slice(i).split(/\n(?=## )/)[0];const n=(re)=>(sec.match(re)||[]).length;const ok=n(/^### D([1-9]|1[0-3])$/gm)===13&&n(/^- verdict: (PASS|FAIL)$/gm)===13&&n(/^- command: /gm)===13&&n(/^- expected: /gm)===13&&n(/^- actual: /gm)===13&&n(/^overall: (PASS|FAIL)$/gm)===1&&s.includes('## Test-bed state at phase end');console.log(ok?'report complete':'report incomplete')"
-> report complete

- deviations: The `## Definition of Done` and `## Test-bed state at phase end` sections are written at column 0 (not
  indented under the `changes` field) as literally required by the step's instructions ("each line starting at column 0");
  this makes the report's `changes` and `acceptance` fields plain trailing sections rather than YAML block scalars. No
  other deviation.
