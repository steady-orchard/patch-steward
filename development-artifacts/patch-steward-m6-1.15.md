# Step 1.15

- id: 1.15
- depends_on: [1.14]
- route: mechanical
- objective: Verify the phase 1 Definition of Done in the main tree and record every check with its command, expected result, actual result, and verdict.
- files_in_scope:
    - development-artifacts/patch-steward-m6-1.15-report.md
- context: |
    Verification-only gate for phase 1 (core contracts, pure) of plan patch-steward-m6. Run IN THE MAIN TREE
    (/c/Users/John/Projects/steady-orchard/patch-steward, Git Bash) on branch
    milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish after steps 1.1 to 1.14 are merged; long worktree paths break
    `pnpm test`. Change NO file except this step's report. An honest FAIL is a successful gate: record it; never fix code, never edit
    tests, never rerun a failing check with different options to make it pass.
    Phase base commit (the commit before any phase 1 step): 08035c4989861d20f428d21f770eb635bbcb6b3a.
    Phase 1 Definition of Done: toolchain passes; the ownership and records tests pass with tests for every deduplication, cap,
    and newest-owner rule and hostile run-name titles; no file under packages/cli/, packages/action/, .github/, templates/, docs/
    changed since the phase base; no fetch, node:fs, or network import in packages/core/src/ownership/; temp-dir leak check clean; no
    raw control, bidi, or zero-width character in changed files. Also checked here: no dependency or lockfile change, and no probe
    secret name in packages/.
    Known pre-existing temp-directory leaks in packages/cli tests (outside this phase's scope; packages/cli must not change): prefixes
    policy-gitconfig-, policy-repo-, ps-cli-missing-. They are tolerated by the leak check; any other new test temp entry fails it.
- actions: |
    Run each check below from the repo root in Git Bash, in order, even if an earlier one fails. For each, capture the exit status
    and the verbatim relevant output (last lines for long output).
    D1. pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
        expected: exit 0
    D2. pnpm vitest run packages/core/src/ownership packages/core/src/records --reporter=json --outputFile=node_modules/.m6-p1-gate.json
        then
        node -e "const r=require('./node_modules/.m6-p1-gate.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['an explicit rerun commits a new owner whatever the snapshot','a reopened event commits a new owner whatever the snapshot','an unchanged snapshot and policy revision keep the newest owner','a changed snapshot hash commits a new owner','a changed policy revision commits a new owner','an unchanged published snapshot without an owner is a duplicate','a changed published snapshot without an owner commits','no owner and no published run commits a new owner','an ambiguous newest owner commits a new owner','an incomplete listing commits a new owner','an unavailable listing fails before commitment','an unavailable owner record fails before commitment','an invalid owner record fails before commitment','an unavailable fallback read fails before commitment','a missing listing read fails closed','a verified echo is a duplicate','a bot sender without a recorded receipt is not an echo','a recorded receipt from another sender is not an echo','the listing is needed only for first attempts of non-reopen events','the newest owner has the greatest created_at','artifact ids never order owners','a created_at tie at the top is ambiguous','a tie below the top does not block a unique owner','an incomplete listing has no newest owner','expired artifacts are ignored','artifacts with another name are ignored','an unparseable created_at makes the listing incomplete','run names round-trip through the parser','hostile run name with a newline is rejected','hostile run name with leading zeros is rejected','hostile run name with non-ASCII digits is rejected','hostile run name over the length bound is rejected','hostile run name with an unknown sender type is rejected','hostile run name with extra text is rejected','hostile run name with unsafe integer ids is rejected','hostile run name with bidi or zero-width text is rejected','only wrapper runs from accepted events count','the daily count excludes runs sent by the installation bot','unparseable titles count toward the daily cap','this run counts once toward each cap','runs created on another UTC day do not count','a daily count over the limit is queued as daily-runs','the per-author count uses queued and in-progress runs','a per-author count over the limit is queued','the daily cap is reported before the per-author cap','duplicate and early-exit runs still count','an incomplete run listing fails before commitment','a total over the result ceiling is over the daily cap'];const miss=need.filter(t=>!got.has(t));console.log(need.length+' required; '+(miss.length?'MISSING '+JSON.stringify(miss):'titles ok'))"
        expected: the vitest run exits 0 and the node command prints exactly: 48 required; titles ok
    D3. git diff --name-only 08035c4989861d20f428d21f770eb635bbcb6b3a HEAD -- packages/cli packages/action .github templates docs
        expected: no output
    D4. grep -rnE "node:(fs|http|https|net|dns|tls|child_process)|from 'fs'|fetch\(" packages/core/src/ownership
        expected: no output (exit 1)
    D5. node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const before=new Set(fs.readdirSync(T));const r=cp.spawnSync('pnpm test',{shell:true,stdio:'ignore'});const fresh=fs.readdirSync(T).filter(n=>!before.has(n)&&/^(ps-|m5-|m6-|policy-|preflight-|invariant5-|repo-|no-such-)/.test(n));const bad=fresh.filter(n=>!/^(policy-gitconfig-|policy-repo-|ps-cli-missing-)/.test(n));console.log('test exit '+r.status+'; new test temp entries '+fresh.length+'; unexpected '+JSON.stringify(bad));console.log(r.status===0&&bad.length===0?'leak check clean':'leak check FAILED')"
        expected: last line prints exactly: leak check clean
    D6. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" $(git diff --name-only --diff-filter=AM 08035c4989861d20f428d21f770eb635bbcb6b3a HEAD -- packages)
        expected: prints exactly: clean
    D7. git diff --stat 08035c4989861d20f428d21f770eb635bbcb6b3a HEAD -- pnpm-lock.yaml package.json packages/core/package.json packages/cli/package.json packages/action/package.json packages/web/package.json
        expected: no output
    D8. git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' HEAD -- packages
        expected: no output (exit 1)
    Write the report. In its changes field put a section `## Definition of Done` containing, for each check D1 to D8 in order, a
    block of exactly this shape (each line starting at column 0):
      ### D<n>
      - command: <the command as run>
      - expected: <the expected result above>
      - actual: <exit status and verbatim relevant output>
      - verdict: PASS or FAIL
    and after D8 one line `overall: PASS` when all eight passed, else `overall: FAIL`. Set the report status to pass when the report
    is complete (even when overall is FAIL; the supervisor routes failures).
- acceptance: |
    Run from the repo root in Git Bash after writing the report; it must give exactly the stated result (it inspects only the
    `## Definition of Done` section, up to the next level-2 heading; an honest FAIL verdict satisfies it exactly like PASS).
    1. node -e "const s=require('fs').readFileSync('development-artifacts/patch-steward-m6-1.15-report.md','utf8').replace(/\r/g,'');const i=s.indexOf('## Definition of Done');const sec=i<0?'':s.slice(i).split(/\n(?=## )/)[0];const n=(re)=>(sec.match(re)||[]).length;const ok=n(/^### D[1-8]$/gm)===8&&n(/^- verdict: (PASS|FAIL)$/gm)===8&&n(/^- command: /gm)===8&&n(/^- expected: /gm)===8&&n(/^- actual: /gm)===8&&n(/^overall: (PASS|FAIL)$/gm)===1;console.log(ok?'report complete':'report incomplete')"
       -> prints exactly: report complete
- rollback: |
    git revert <this step's commit> (removes the report only).
