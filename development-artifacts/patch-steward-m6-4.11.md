# Step 4.11

- id: 4.11
- depends_on: [4.2, 4.3]
- route: mechanical
- objective: Extend invariant 1 with a fixture-tier workflow scan packages/core/src/conformance/invariant-1-workflows.fixture.test.ts proving that no event text reaches a `run:` step and that the wrapper run-names use only numeric and enumerated values.
- files_in_scope:
    - packages/core/src/conformance/invariant-1-workflows.fixture.test.ts
    - development-artifacts/patch-steward-m6-4.11-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest); Git Bash; run every command from your tree root. core.autocrlf=true
    (never anchor a grep with `$`). jq is NOT installed (use node). Relative imports need `.js`. Strict TS
    (noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals). Prettier: single quotes, printWidth 132.
    `*.fixture.test.ts` files run in `pnpm test`.

    Invariant 1: submission content (titles, bodies, refs, comments) is untrusted data; it must never reach a shell. In the
    workflows that means: no `${{ ... }}` expression inside any `run:` value (data goes through `env:`), and event fields
    (`github.event.*`) appear only in the wrappers' `run-name`, which may carry only numeric ids and platform enums (the
    run-count caps parse it; packages/core/src/ownership/caps.ts buildRunName and parseRunName define the grammar
    `steward <pr|issue> <number> author <id> event <event_name> <action> sender <id> <User|Bot|Organization|Mannequin>`).
    The existing packages/core/src/conformance/invariant-1.test.ts stays unchanged; this is a new file.

    Files under test (files changed in steps 4.2 and 4.3; read them first):
    W = .github/workflows/steward-screening.yml, P = templates/workflows/steward-pr.yml, I = templates/workflows/steward-issues.yml.
    Load each with `new URL('../../../../<path>', import.meta.url)`; parse the bytes with parseStrictYaml(bytes, { maxBytes:
    1048576, maxDepth: 64, maxNodes: 100000 }) from '../strict-yaml.js' (expect ok). Import buildRunName and parseRunName from
    '../ownership/caps.js'. Narrow parsed values with small local guards; no `any`.

    Exact run-name strings (copy exactly):
    - RN_PR = 'steward pr ${{ github.event.pull_request.number }} author ${{ github.event.pull_request.user.id }} event ${{ github.event_name }} ${{ github.event.action }} sender ${{ github.event.sender.id }} ${{ github.event.sender.type }}'
    - RN_ISSUE = 'steward issue ${{ github.event.issue.number }} author ${{ github.event.issue.user.id }} event ${{ github.event_name }} ${{ github.event.action }} sender ${{ github.event.sender.id }} ${{ github.event.sender.type }}'

    Test file packages/core/src/conformance/invariant-1-workflows.fixture.test.ts, describe 'invariant 1: workflows', plain
    it(...) titles EXACTLY:
    - 'no event text reaches a run step': for W, P, and I: walk every job; for every step with a string `run`, the run contains
      no '${{'; walk the whole parsed document recursively keeping the key path, and every string value containing
      'github.event' has the path ['run-name'] (top level) and nothing else (so W, which has no run-name, contains none);
      no string value anywhere contains 'github.head_ref' or 'toJSON(github'. Also assert the walk visited at least one run
      step in W (guards against a vacuous pass).
    - 'run-name uses only numeric and enumerated values': P['run-name'] === RN_PR and I['run-name'] === RN_ISSUE; the set of
      expressions extracted with /\$\{\{\s*([^}]*?)\s*\}\}/g is exactly {github.event.pull_request.number,
      github.event.pull_request.user.id, github.event_name, github.event.action, github.event.sender.id,
      github.event.sender.type} for P and the same with issue.number and issue.user.id for I; substituting sample values
      (P: 12, 2095171, 'pull_request_target', 'edited', 331019482, 'Bot'; I: 29, 2095171, 'issues', 'opened', 2095171, 'User')
      for the six expressions in order gives a string for which parseRunName returns the fields { kind: 'pr' or 'issue',
      number, authorId, eventName, action, senderId, senderType } and which equals buildRunName(those fields); a hostile
      sample (title-like text such as 'x $(id)' in place of the action) makes parseRunName return null.
    If a test fails because a workflow file violates these facts (not because of your test code), STOP and report status fail
    with the verbatim assertion output; never edit the workflow files. No temp directories, no network, no child processes.
- actions: |
    1. Base check (files changed in steps 4.2 and 4.3): node -e "const fs=require('fs');const f=['.github/workflows/steward-screening.yml','templates/workflows/steward-pr.yml','templates/workflows/steward-issues.yml'];const m=f.filter(p=>!fs.existsSync(p));console.log(m.length?'MISSING '+m.join(' '):'base ok')"
       It must print `base ok`; otherwise STOP and report status missing-base with the output.
    2. Write packages/core/src/conformance/invariant-1-workflows.fixture.test.ts per context.
    3. Run: pnpm exec prettier --write packages/core/src/conformance/invariant-1-workflows.fixture.test.ts
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/conformance/invariant-1-workflows.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p4-4.11.json -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p4-4.11.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['no event text reaches a run step','run-name uses only numeric and enumerated values'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. git grep --untracked -c -E "fetch\(|child_process|mkdtemp" -- packages/core/src/conformance/invariant-1-workflows.fixture.test.ts
       -> no output (exit 1)
    4. pnpm typecheck -> exit 0
    5. pnpm vitest run -> exit 0
    6. pnpm exec eslint packages/core/src/conformance/invariant-1-workflows.fixture.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/conformance/invariant-1-workflows.fixture.test.ts -> exit 0
    8. git status --porcelain -- .github templates packages/core/src/conformance/invariant-1.test.ts packages/core/src/ownership -> no output
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/conformance/invariant-1-workflows.fixture.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the test file).
