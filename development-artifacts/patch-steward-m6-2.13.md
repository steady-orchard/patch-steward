# Step 2.13

- id: 2.13
- depends_on: [2.11, 2.12]
- route: mechanical
- objective: Verify the phase 2 Definition of Done in the main tree and record every check with its command, expected result, actual result, and verdict.
- files_in_scope:
    - development-artifacts/patch-steward-m6-2.13-report.md
- context: |
    Verification-only gate for phase 2 (GitHub and evidence-store adapters) of plan patch-steward-m6. Run IN THE MAIN TREE
    (/c/Users/John/Projects/steady-orchard/patch-steward, Git Bash) on branch
    milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish after steps 2.1 to 2.12 are merged; long worktree paths break
    `pnpm test`. Change NO file except this step's report. An honest FAIL is a successful gate: record it; never fix code, never edit
    tests, never rerun a failing check with different options to make it pass.
    Phase base commit (the commit before any phase 2 step): 78a6c7d0831c350da98aa89e783a7ef1e333cace.
    Phase 2 Definition of Done: toolchain passes; `pnpm vitest run packages/core/src/github packages/core/src/evidence` passes
    covering the evidence store commit (branch absent, non-fast-forward then success, retries exhausted, non-append-only compare,
    read-back mismatch) and the fallback read, the ownership download (redirect to non-HTTPS or a private address rejected, oversize
    zip, extra entry), App authentication (key and tokens redacted and never in outputs), and a test proving the writer rejects
    every non-allowlisted method and path; the `steward screen` path is still GET-only (existing tests pass unchanged); no live
    network in any unit or fixture test; packages/cli/ unchanged. Also checked: no file under packages/action/, .github/,
    templates/, docs/ changed; no dependency or lockfile change; temp-directory leak check clean; no raw control, bidi, or
    zero-width character in changed files; no probe secret name in packages/ or fixtures/github/hosted/.
    The no-live-network check runs the whole unit and fixture suite with global fetch replaced by a function that always throws
    (NODE_OPTIONS preloads a data: URL module; child test processes inherit it); a test that reached the network through fetch
    would fail.
    Known pre-existing temp-directory leaks in packages/cli tests (outside this phase; packages/cli must not change): prefixes
    policy-gitconfig-, policy-repo-, ps-cli-missing-. They are tolerated by the leak check; any other new test temp entry fails it.
- actions: |
    Run each check below from the repo root in Git Bash, in order, even if an earlier one fails. For each, capture the exit status
    and the verbatim relevant output (last lines for long output).
    D1. pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
        expected: exit 0
    D2. pnpm vitest run packages/core/src/github packages/core/src/evidence --reporter=json --outputFile=node_modules/.m6-p2-gate.json
        then
        node -e "const r=require('./node_modules/.m6-p2-gate.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['list pages collect items and the first total count','a list beyond the page limit is incomplete','list pages validate every item','a list page without the named array is a schema mismatch','the redirect location is returned without following it','a response that does not redirect is an unexpected status','a redirect without a valid location is malformed','redirect reads retry server errors within the budget','redirect failures never echo the location','the writer allows exactly the store and token endpoints','the writer rejects every non-allowlisted method and path','rejected writes send nothing and spend no budget','write bodies are checked against the allowlist','writes send json bodies with the pinned headers','a non-fast-forward update is a write conflict','writes retry server errors within the budget','token revocation expects no content','write failures never echo the response body','prepared run files equal the local store bytes','a hosted evidence location replaces the store path in the report','without an evidence location the report shows the store path','an invalid repository fails evidence preparation','no published run directory means no fallback','the latest run directory by run id and attempt is read','the published snapshot and policy revision are returned','a listing without run directories means no fallback','a listing at the entry bound is unavailable','an oversize run record is unavailable','a run record for another submission is unavailable','a run record that fails its schema is unavailable','a run record whose run differs from its directory is unavailable','a failed read is unavailable','the fallback read uses the store branch and target prefix','app jwts are signed with rs256 and backdated','app jwts accept pkcs1 and pkcs8 keys','invalid app credentials are rejected before any request','installation tokens name exactly one repository','every token role requests its permission set','a token granted beyond the requested scope is rejected','metadata read is accepted as an implicit grant','token revocation deletes the installation token','the app bot user id is looked up from the app slug','app auth requests count against the given budget','the private key and tokens never appear in results','redaction removes the private key and minted tokens','the ownership listing maps artifacts and completeness','an ownership listing beyond the page limit is incomplete','the ownership record downloads through one redirect','the storage download carries no authorization','a redirect to a non-https location is rejected','a redirect to a private address is rejected','an oversize artifact zip is rejected','an artifact zip with an extra entry is rejected','a record naming another submission is invalid','a failed redirect read is unavailable','a unique newest owner is downloaded and validated','an ambiguous or incomplete listing downloads nothing','dedup listing reads carry the owner identity','run list items map the fields caps use','the created filter starts at the UTC day','a run list beyond the page limit keeps its total','cap run lists read three listings in order','a failed run list read leaves later lists incomplete','an invalid run list filter is an invalid request','evidence commits add blobs, a tree, a commit, and a ref update','an absent branch gets a root commit','a non-fast-forward update rebuilds on the new tip','exhausted rebuilds end in a store conflict','a compare that is not append-only stops before the update','a created blob with another id is a mismatch','the commit layout is validated before any request','evidence over the byte or file limit is rejected','the commit message carries no submission text','the store location follows the trusted policy','hosted evidence locations point at the store tree','store requests count against the run budget','a committed run reads back with matching blob ids','a tip that moved ahead still reads back','a diverged tip fails the read-back','a changed blob id fails the read-back','a missing or extra run file fails the read-back','a truncated tree read fails the read-back','written evidence is read back after the ref update','a failed commit skips the read-back','recorded artifact listing maps to ownership artifacts','recorded run lists map to cap query results','recorded git commit and compare responses validate','a recorded subtree read supports the read-back check','recorded file contents decode for the fallback read','the recorded app bot user validates','recorded hosted responses contain no credential'];const miss=need.filter(t=>!got.has(t));console.log(need.length+' required; '+(miss.length?'MISSING '+JSON.stringify(miss):'titles ok'))"
        expected: the vitest run exits 0 and the node command prints exactly: 91 required; titles ok
    D3. pnpm vitest run packages/core/src/conformance packages/core/src/exports.test.ts --reporter=json --outputFile=node_modules/.m6-p2-gate-conf.json
        then
        node -e "const r=require('./node_modules/.m6-p2-gate-conf.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['hosted failure code github.write-not-allowed never yields pass','hosted failure code github.write-conflict never yields pass','hosted failure code app-auth.credentials-invalid never yields pass','hosted failure code app-auth.token-scope-mismatch never yields pass','hosted failure code evidence.store-conflict never yields pass','ownership modules import no file system or network module','exports the hosted adapter constants'];const miss=need.filter(t=>!got.has(t));console.log(need.length+' required; '+(miss.length?'MISSING '+JSON.stringify(miss):'titles ok'))"
        expected: the vitest run exits 0 and the node command prints exactly: 7 required; titles ok
    D4. git diff --quiet 78a6c7d0831c350da98aa89e783a7ef1e333cace HEAD -- packages/core/src/github/client.test.ts packages/core/src/conformance/zero-execution.fixture.test.ts packages/cli; echo "diff-exit $?"; grep -c "readonly method: 'GET';" packages/core/src/github/client.ts; grep -rlE "writer\.js|app-auth\.js|git-store\.js|store-readback\.js" packages/core/src/pipeline packages/core/src/submission packages/core/src/policy packages/core/src/github/client.ts packages/core/src/github/reader.ts packages/cli/src; echo "grep-exit $?"; pnpm vitest run packages/core/src/github/client.test.ts packages/core/src/conformance/zero-execution.fixture.test.ts packages/cli/src/steward-zero-execution.fixture.test.ts > /dev/null 2>&1; echo "vitest-exit $?"
        expected: prints exactly these four lines: diff-exit 0, 1, grep-exit 1, vitest-exit 0
    D5. NODE_OPTIONS='--import=data:text/javascript,globalThis.fetch=async()=>{throw(0)}' pnpm test
        expected: exit 0
    D6. git diff --name-only 78a6c7d0831c350da98aa89e783a7ef1e333cace HEAD -- packages/cli packages/action .github templates docs
        expected: no output
    D7. git diff --stat 78a6c7d0831c350da98aa89e783a7ef1e333cace HEAD -- pnpm-lock.yaml package.json packages/core/package.json packages/cli/package.json packages/action/package.json packages/web/package.json
        expected: no output
    D8. node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const before=new Set(fs.readdirSync(T));const r=cp.spawnSync('pnpm test',{shell:true,stdio:'ignore'});const fresh=fs.readdirSync(T).filter(n=>!before.has(n)&&/^(ps-|m5-|m6-|policy-|preflight-|invariant5-|repo-|no-such-)/.test(n));const bad=fresh.filter(n=>!/^(policy-gitconfig-|policy-repo-|ps-cli-missing-)/.test(n));console.log('test exit '+r.status+'; new test temp entries '+fresh.length+'; unexpected '+JSON.stringify(bad));console.log(r.status===0&&bad.length===0?'leak check clean':'leak check FAILED')"
        expected: last line prints exactly: leak check clean
    D9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" $(git diff --name-only --diff-filter=AM 78a6c7d0831c350da98aa89e783a7ef1e333cace HEAD -- packages fixtures)
        expected: prints exactly: clean
    D10. git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' HEAD -- packages fixtures/github/hosted
        expected: no output (exit 1)
        (fixtures/github/testbed/, recorded in an earlier milestone, holds probe workflow patch text that names the probe secrets;
        it is out of this check's scope.)
    Write the report. In its changes field put a section `## Definition of Done` containing, for each check D1 to D10 in order, a
    block of exactly this shape (each line starting at column 0):
      ### D<n>
      - command: <the command as run>
      - expected: <the expected result above>
      - actual: <exit status and verbatim relevant output>
      - verdict: PASS or FAIL
    and after D10 one line `overall: PASS` when all ten passed, else `overall: FAIL`. Set the report status to pass when the report
    is complete (even when overall is FAIL; the supervisor routes failures).
- acceptance: |
    Run from the repo root in Git Bash after writing the report; it must give exactly the stated result (it inspects only the
    `## Definition of Done` section, up to the next level-2 heading; an honest FAIL verdict satisfies it exactly like PASS).
    1. node -e "const s=require('fs').readFileSync('development-artifacts/patch-steward-m6-2.13-report.md','utf8').replace(/\r/g,'');const i=s.indexOf('## Definition of Done');const sec=i<0?'':s.slice(i).split(/\n(?=## )/)[0];const n=(re)=>(sec.match(re)||[]).length;const ok=n(/^### D([1-9]|10)$/gm)===10&&n(/^- verdict: (PASS|FAIL)$/gm)===10&&n(/^- command: /gm)===10&&n(/^- expected: /gm)===10&&n(/^- actual: /gm)===10&&n(/^overall: (PASS|FAIL)$/gm)===1;console.log(ok?'report complete':'report incomplete')"
       -> prints exactly: report complete
- rollback: |
    git revert <this step's commit> (removes the report only).
