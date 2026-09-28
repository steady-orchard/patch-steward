# Step 5.27

- id: 5.27
- depends_on: []
- route: mechanical
- objective: Put the two scenario workflow jobs that declare the publication Environment (job inside of scenario-secret-scope-called.yml, job edit of scenario-app-edit.yml) into the mapping form `name: steward-publication` plus `deployment: false`.
- files_in_scope:
    - scenarios/workflows/scenario-secret-scope-called.yml
    - scenarios/workflows/scenario-app-edit.yml
    - development-artifacts/patch-steward-m6-5.27-report.md
- context: |
    Git Bash; run every command from your tree root. core.autocrlf=true: strip CR before comparing text; never anchor a
    grep with `$` on file contents. jq is NOT installed. actionlint 1.7.12 is installed. Never run a formatter on
    development-artifacts/. No network access; make no GitHub request; deploy nothing (a later step deploys).

    Why: in the string form `environment: steward-publication`, GitHub Actions records a Deployment for the job. The
    scenario suite reproduces the product exactly, and the product's reusable workflow now declares the Environment in the
    mapping form, so every scenario workflow job that declares the publication Environment uses exactly (job level;
    indentation 4, 6, 6 spaces):
        environment:
          name: steward-publication
          deployment: false
    in place of the single line `    environment: steward-publication`. In scenario-secret-scope-called.yml that is job
    `inside` (job `outside` declares no Environment and must stay so); in scenario-app-edit.yml it is job `edit`. The
    Environment secrets and the Environment's default-branch-only branch policy still apply in this form (measured).
    Everything else in both files stays byte-identical (comments included), in particular the `secrets:` declaration
    block of scenario-secret-scope-called.yml (scenarios/tools/secret-scope.sh check compares it byte for byte with the
    reusable screening workflow's block). Acceptance 3 re-derives both files from their content at commit
    ce9d9791687795f3fc330dd5e0132a056207453a (an ancestor of your tree) by exactly this one replacement.
- actions: |
    1. In scenarios/workflows/scenario-secret-scope-called.yml replace the one line `    environment: steward-publication`
       (job inside) with the three lines from context. Change nothing else.
    2. In scenarios/workflows/scenario-app-edit.yml replace the one line `    environment: steward-publication` (job edit) with
       the three lines from context. Change nothing else.
    3. pnpm install --frozen-lockfile; `pnpm exec prettier --check scenarios/workflows` must exit 0 (do not run --write on
       anything else); run the acceptance commands.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. actionlint -ignore 'could not read reusable workflow file' scenarios/workflows/*.yml; echo "exit $?"
       -> prints exactly: exit 0
    2. for f in scenarios/workflows/scenario-secret-scope-called.yml scenarios/workflows/scenario-app-edit.yml; do tr -d '\r' < $f | grep -c -x -E '    environment:|      name: steward-publication|      deployment: false'; tr -d '\r' < $f | grep -c 'environment: steward-publication'; done
       -> prints exactly four lines: 3, 0, 3, 0
    3. node -e 'const fs=require("fs");const cp=require("child_process");let ok=true;for(const f of ["scenarios/workflows/scenario-secret-scope-called.yml","scenarios/workflows/scenario-app-edit.yml"]){const old=cp.execSync("git show ce9d9791687795f3fc330dd5e0132a056207453a:"+f,{encoding:"utf8"}).replace(/\r/g,"");const k="    environment: steward-publication\n";if(old.split(k).length!==2){ok=false;continue}const want=old.replace(k,"    environment:\n      name: steward-publication\n      deployment: false\n");const got=fs.readFileSync(f,"utf8").replace(/\r/g,"");if(got!==want)ok=false}console.log(ok?"derived ok":"derived differs")'
       -> prints exactly: derived ok
    4. node -e 'const fs=require("fs");const t=fs.readFileSync("scenarios/workflows/scenario-secret-scope-called.yml","utf8").replace(/\r/g,"");const out=t.slice(t.indexOf("\n  outside:\n"),t.indexOf("\n  inside:\n"));const ins=t.slice(t.indexOf("\n  inside:\n"));console.log(!out.includes("environment")&&ins.includes("\n    environment:\n      name: steward-publication\n      deployment: false\n")?"jobs ok":"jobs wrong")'
       -> prints exactly: jobs ok
    5. bash scenarios/tools/secret-scope.sh check
       -> prints exactly two lines: SECRET-SCOPE check=mapping identical, SECRET-SCOPE check=declarations identical
    6. pnpm exec prettier --check scenarios/workflows > /dev/null 2>&1; echo "prettier $?"
       -> prints exactly: prettier 0
- rollback: |
    git revert <this step's commit> (nothing was deployed).
