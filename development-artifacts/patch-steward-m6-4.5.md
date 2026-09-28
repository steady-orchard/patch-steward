# Step 4.5

- id: 4.5
- depends_on: []
- route: mechanical
- objective: Add the test-bed policies (orphan-branch store and separate-repository store, all observe, no llm section) and the unstructured smoke issue body under scenarios/fixtures/.
- files_in_scope:
    - scenarios/fixtures/policies/orphan-branch.yml
    - scenarios/fixtures/policies/repository-store.yml
    - scenarios/fixtures/submissions/unstructured.txt
    - development-artifacts/patch-steward-m6-4.5-report.md
- context: |
    Repo: pnpm monorepo; Git Bash; run every command from your tree root. core.autocrlf=true (never anchor a grep with `$`). jq is
    NOT installed (use node). scenarios/ is a new persistent top-level directory (test-bed scenario suite; not a workspace
    package; Prettier-checked): files there never mention planning identifiers or development-artifacts/.

    The test-bed policies are derived mechanically from the committed fixture fixtures/policies/valid/minimal-no-llm.yml (valid,
    no llm section, modes default observe, limits.github.requests_per_run 300, caps daily_runs 50 and per_author_concurrent_runs
    2), changing only its evidence store block:
    - orphan-branch.yml (deployed to the org-public and personal test-beds as .github/patch-steward/policy.yml): store
      `type: orphan-branch`, `branch: steward-evidence`.
    - repository-store.yml (deployed to the org-private test-bed): store `type: repository`, `repository:
      steady-orchard/patch-steward-testbed-evidence`, `branch: steward-evidence`.
    The smoke body unstructured.txt is one line of plain text (no issue-form headings), so contract screening asks for the
    missing fields (outcome needs-changes). `.txt` files are byte-exact (Prettier ignores them).
    Do not touch fixtures/ (the source fixture stays unchanged).
- actions: |
    1. Generate the three files (run exactly this from the tree root; it reads the committed fixture through git):
       node -e "const fs=require('fs');const src=require('child_process').execSync('git show HEAD:fixtures/policies/valid/minimal-no-llm.yml').toString().replace(/\r\n/g,'\n');const a='  store:\n    type: orphan-branch\n    branch: patch-steward-evidence\n';if(src.split(a).length!==2)throw new Error('store block count');fs.mkdirSync('scenarios/fixtures/policies',{recursive:true});fs.mkdirSync('scenarios/fixtures/submissions',{recursive:true});fs.writeFileSync('scenarios/fixtures/policies/orphan-branch.yml',src.replace(a,'  store:\n    type: orphan-branch\n    branch: steward-evidence\n'));fs.writeFileSync('scenarios/fixtures/policies/repository-store.yml',src.replace(a,'  store:\n    type: repository\n    repository: steady-orchard/patch-steward-testbed-evidence\n    branch: steward-evidence\n'));fs.writeFileSync('scenarios/fixtures/submissions/unstructured.txt','This test-bed issue exercises hosted screening end to end. It follows no issue form, so screening asks for the missing fields.\n');console.log('written')"
       It prints `written`.
    2. Do not edit the files afterwards.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. pnpm build > /dev/null; for f in orphan-branch repository-store; do node packages/cli/dist/main.js policy --file scenarios/fixtures/policies/$f.yml > /dev/null; echo "$f exit $?"; done
       -> prints exactly two lines: orphan-branch exit 0, then repository-store exit 0
    2. node -e "const fs=require('fs');const base=require('child_process').execSync('git show HEAD:fixtures/policies/valid/minimal-no-llm.yml').toString().replace(/\r\n/g,'\n');const rd=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');const o=rd('scenarios/fixtures/policies/orphan-branch.yml');const r=rd('scenarios/fixtures/policies/repository-store.yml');const ok1=o===base.replace('    branch: patch-steward-evidence\n','    branch: steward-evidence\n');const ok2=r===base.replace('    type: orphan-branch\n    branch: patch-steward-evidence\n','    type: repository\n    repository: steady-orchard/patch-steward-testbed-evidence\n    branch: steward-evidence\n');console.log(ok1&&ok2?'derived ok':'derived differs')"
       -> prints exactly: derived ok
    3. node -e "const s=require('fs').readFileSync('scenarios/fixtures/submissions/unstructured.txt','utf8').replace(/\r\n/g,'\n');console.log(s.split('\n').length===2&&!s.includes('#')&&s.startsWith('This test-bed issue')?'body ok':'body wrong')"
       -> prints exactly: body ok
    4. pnpm exec prettier --check scenarios -> exit 0
    5. git grep --untracked -n -E 'llm:|mode: (advise|enforce)' -- scenarios/fixtures/policies
       -> no output (exit 1)
    6. git status --porcelain -- fixtures -> no output
    7. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/fixtures/policies/orphan-branch.yml scenarios/fixtures/policies/repository-store.yml scenarios/fixtures/submissions/unstructured.txt
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the three files).
