# Step 4.18

- id: 4.18
- depends_on: [4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17]
- route: mechanical
- objective: Verify the phase 4 Definition of Done in the main tree and on the test-beds (read-only) and record every check with its command, expected result, actual result, and verdict.
- files_in_scope:
    - development-artifacts/patch-steward-m6-4.18-report.md
- context: |
    Verification-only gate for phase 4 (workflows, templates, test-bed deployment, org-public smoke) of plan patch-steward-m6.
    Run IN THE MAIN TREE (/c/Users/John/Projects/steady-orchard/patch-steward, Git Bash) on branch
    milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish after steps 4.1 to 4.17 are merged; long worktree paths
    break `pnpm test`. Change NO file except this step's report. Every GitHub access is READ-ONLY (gh api GETs, gh run view,
    gh workflow list, git fetch, git ls-remote); never create, edit, close, rerun, dispatch, deploy, or push anything. An honest
    FAIL is a successful gate: record it; never fix code, tests, or test-beds, and never rerun a failing check with different
    options to make it pass. jq is NOT installed (use `gh --jq` or node). core.autocrlf=true.
    Plan starting commit S = 6418129c7b104fd93d9162efcda6fe08373287ee. Phase base PB = 414ad77be6c63d4ccd5ea33d710285cc3a8c1014
    (the brief amendment before this phase; the decomposition commit after it touches only development-artifacts/).
    Remote milestone ref R = refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish.
    Smoke identifiers come from development-artifacts/patch-steward-m6-4.17-report.md lines `smoke_issue: N`, `smoke_run: RUN`,
    `evidence_commit: C`.
    Phase 4 Definition of Done: toolchain passes; actionlint on the reusable workflow and both templates exits 0; the static
    workflow test titles pass (including `workflows use only the steward secret names`); the project secret-name grep prints
    nothing; `GH_TOKEN=$(gh auth token) pnpm test:live` exits 0; the deployed wrapper blobs on each test-bed equal the canonical
    test-bed copies (blob ids) and pin a SHA that is an ancestor of origin's milestone branch; one org-public smoke (an
    unstructured `[scenario S00]` issue) produced a successful build, gate, publish, one `steward-ownership-issue-<n>` artifact,
    one evidence commit on `steward-evidence` whose run directory verifies, and a publish summary written after the commit; no
    App-authored comment, label, or check on the issue; the OA1 verify output for org-public recorded verbatim in the smoke
    report. Also checked: configs unchanged, no dependency or lockfile change in this phase, changed files limited to the phase
    scope, no raw control, bidi, or zero-width characters, temp-directory leak check, persistence and deferred greps clean on
    the new persistent files, and the documented test-bed state.
    Known pre-existing temp-directory leaks in packages/cli tests: prefixes policy-gitconfig-, policy-repo-, ps-cli-missing-
    (tolerated by D10).
- actions: |
    Run each check below from the repo root in Git Bash, in order, even if an earlier one fails. For each, capture the exit status
    and the verbatim relevant output (last lines for long output).
    D1. pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
        expected: exit 0
    D2. actionlint .github/workflows/steward-screening.yml templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml; echo "exit $?"; actionlint -ignore 'could not read reusable workflow file' scenarios/workflows/*.yml; echo "exit $?"
        expected: prints exactly two lines: exit 0, exit 0
    D3. pnpm vitest run packages/core/src/conformance/workflows.fixture.test.ts packages/core/src/conformance/invariant-1-workflows.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p4-gate.json
        then
        node -e "const r=require('./node_modules/.m6-p4-gate.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['the reusable workflow is callable only','every job declares empty permissions','only gate and publish declare the publication environment','the credential-free build job holds no secret','gate and publish run the verified runtime without installing','every action and reusable workflow is pinned by full commit sha','the wrapper pin equals its steward_ref input','wrappers pass secrets by explicit mapping','wrappers accept only the screened events','jobs, timeouts, publish condition, and concurrency match the design','gate outputs come from the core step and the commitment step','workflows use only the steward secret names','no event text reaches a run step','run-name uses only numeric and enumerated values'];const miss=need.filter(t=>!got.has(t));console.log(need.length+' required; '+(miss.length?'MISSING '+JSON.stringify(miss):'titles ok'))"
        expected: the vitest run exits 0 and the node command prints exactly: 14 required; titles ok
    D4. git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' HEAD -- .github/workflows/steward-screening.yml templates packages scenarios docs README.md CLAUDE.md ':!docs/project-development-plan.md' ':!docs/astra-plan.md'; echo "exit $?"; git grep -c 'PATCH_STEWARD_APP_PRIVATE_KEY' HEAD -- .github/workflows/steward-screening.yml
        expected: prints exactly two lines: exit 1, then HEAD:.github/workflows/steward-screening.yml:3
    D5. GH_TOKEN=$(gh auth token) pnpm test:live --reporter=json --outputFile=node_modules/.m6-p4-gate-live.json
        then
        node -e "const r=require('./node_modules/.m6-p4-gate-live.json');let p=0,o=0;for(const f of r.testResults)for(const a of f.assertionResults){if(a.status==='passed')p++;else o++}console.log('passed '+p+' other '+o)"
        expected: the live run exits 0 and the node command prints `passed <n> other 0` with n >= 1
    D6. bash -c 'for r in steady-orchard/patch-steward-testbed-public:orphan-branch jambolo/patch-steward-testbed-personal:orphan-branch steady-orchard/patch-steward-testbed-private:repository-store; do repo=${r%%:*}; pol=${r#*:}; for pair in "scenarios/workflows/steward-pr.yml:.github/workflows/steward-pr.yml" "scenarios/workflows/steward-issues.yml:.github/workflows/steward-issues.yml" "scenarios/fixtures/policies/$pol.yml:.github/patch-steward/policy.yml"; do src=${pair%%:*}; dest=${pair#*:}; l=$(git rev-parse "HEAD:$src"); d=$(gh api "repos/$repo/contents/$dest?ref=master" --jq .sha); [ -n "$l" ] && [ "$l" = "$d" ] && echo "same $repo $dest" || echo "DIFF $repo $dest"; done; done' | cut -d' ' -f1 | sort | uniq -c
        then
        bash -c 'p=$(grep -m1 -o "steward-screening\.yml@[0-9a-f]\{40\}" scenarios/workflows/steward-pr.yml | cut -d@ -f2); q=$(grep -m1 -o "steward-screening\.yml@[0-9a-f]\{40\}" scenarios/workflows/steward-issues.yml | cut -d@ -f2); g=$(grep -c "steward_ref: '"'"'$p'"'"'" scenarios/workflows/steward-pr.yml scenarios/workflows/steward-issues.yml | cut -d: -f2 | tr "\n" " "); git fetch --quiet origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish && git merge-base --is-ancestor "$p" FETCH_HEAD && [ "$p" = "$q" ] && echo "pin ancestor ok refs=$g"'
        expected: the first prints exactly `      9 same`; the second prints exactly `pin ancestor ok refs=1 1 `
    D7. Smoke re-verification: run acceptance commands 1 to 6 of development-artifacts/patch-steward-m6-4.17.md exactly as written
        there (they read N, RUN, C from the smoke report).
        expected: exactly the results stated there (report ok; the three success jobs; 2; 3; summary after commit; 2 and the
        OPEN issue line)
    D8. git diff --quiet 6418129c7b104fd93d9162efcda6fe08373287ee HEAD -- .github/workflows/ci.yml .github/workflows/cd.yml vitest.config.ts vitest.live.config.ts eslint.config.mjs .prettierrc.json .prettierignore .gitignore; echo "exit $?"; ls .gitattributes 2> /dev/null; echo "attrs $?"; git diff --quiet 414ad77be6c63d4ccd5ea33d710285cc3a8c1014 HEAD -- pnpm-lock.yaml package.json packages/core/package.json packages/cli/package.json packages/action/package.json packages/web/package.json; echo "deps $?"
        expected: prints exactly three lines: exit 0, attrs 2, deps 0
    D9. git diff --name-only 414ad77be6c63d4ccd5ea33d710285cc3a8c1014 HEAD | grep -v -E '^(development-artifacts/|scenarios/|templates/workflows/(steward-pr|steward-issues)\.yml$|templates/README\.md$|templates/policy/policy\.yml$|\.github/workflows/steward-screening\.yml$|packages/action/pack-runtime\.sh$|packages/core/src/submission/default-checklist\.ts$|packages/core/src/pipeline/hosted-verify\.fixture\.test\.ts$|packages/core/src/conformance/(workflows|invariant-1-workflows)\.fixture\.test\.ts$|packages/core/src/github/github\.live\.test\.ts$|packages/cli/src/steward-commands\.live\.test\.ts$)'
        expected: no output
    D10. node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const before=new Set(fs.readdirSync(T));const r=cp.spawnSync('pnpm test',{shell:true,stdio:'ignore'});const fresh=fs.readdirSync(T).filter(n=>!before.has(n)&&/^(ps-|m5-|m6-|policy-|preflight-|invariant5-|repo-|no-such-)/.test(n));const bad=fresh.filter(n=>!/^(policy-gitconfig-|policy-repo-|ps-cli-missing-)/.test(n));console.log('test exit '+r.status+'; new test temp entries '+fresh.length+'; unexpected '+JSON.stringify(bad));console.log(r.status===0&&bad.length===0?'leak check clean':'leak check FAILED')"
         expected: last line prints exactly: leak check clean
    D11. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){if(!fs.existsSync(f))continue;const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" $(git diff --name-only --diff-filter=AM 414ad77be6c63d4ccd5ea33d710285cc3a8c1014 HEAD)
         expected: prints exactly: clean
    D12. git grep -n -P 'development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' HEAD -- scenarios templates; echo "exit $?"; git grep -c -E 'DF[0-9]{2}|deferred\.md' HEAD -- scenarios templates; echo "exit $?"
         expected: prints exactly two lines: exit 1, exit 1
    D13. bash -c 'for repo in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do gh workflow list -R "$repo" --all --json path,state --jq ".[] | select(.path == \".github/workflows/steward-pr.yml\" or .path == \".github/workflows/steward-issues.yml\") | .path + \" \" + .state"; echo "scenario-workflows $(gh api "repos/$repo/contents/.github/workflows?ref=master" --jq "[.[].name | select(startswith(\"scenario-\"))] | length")"; done' | sort | uniq -c
         expected: prints exactly three lines: `      3 .github/workflows/steward-issues.yml active`, `      3 .github/workflows/steward-pr.yml active`, `      3 scenario-workflows 0`
    Write the report. In its changes field put a section `## Definition of Done` containing, for each check D1 to D13 in order, a
    block of exactly this shape (each line starting at column 0):
      ### D<n>
      - command: <the command as run>
      - expected: <the expected result above>
      - actual: <exit status and verbatim relevant output>
      - verdict: PASS or FAIL
    and after D13 one line `overall: PASS` when all thirteen passed, else `overall: FAIL`. Then a section `## Test-bed state at
    phase end` listing, from the D6, D7, D13 outputs: wrappers and policy deployed and active on the three test-beds (pin SHA);
    the smoke issue N open on org-public; `steward-evidence` on org-public with its commit(s); no scenario helper deployed;
    nothing run on personal and org-private. Set the report status to pass when the report is complete (even when overall is
    FAIL; the supervisor routes failures).
- acceptance: |
    Run from the repo root in Git Bash after writing the report; it must give exactly the stated result (it inspects only the
    `## Definition of Done` section, up to the next level-2 heading; an honest FAIL verdict satisfies it exactly like PASS).
    1. node -e "const s=require('fs').readFileSync('development-artifacts/patch-steward-m6-4.18-report.md','utf8').replace(/\r/g,'');const i=s.indexOf('## Definition of Done');const sec=i<0?'':s.slice(i).split(/\n(?=## )/)[0];const n=(re)=>(sec.match(re)||[]).length;const ok=n(/^### D([1-9]|1[0-3])$/gm)===13&&n(/^- verdict: (PASS|FAIL)$/gm)===13&&n(/^- command: /gm)===13&&n(/^- expected: /gm)===13&&n(/^- actual: /gm)===13&&n(/^overall: (PASS|FAIL)$/gm)===1&&s.includes('## Test-bed state at phase end');console.log(ok?'report complete':'report incomplete')"
       -> prints exactly: report complete
- rollback: |
    git revert <this step's commit> (removes the report only; nothing else was changed anywhere).
