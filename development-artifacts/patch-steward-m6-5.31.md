# Step 5.31

- id: 5.31
- depends_on: [5.26, 5.27, 5.28, 5.29, 5.30]
- route: mechanical
- objective: After every local check passes on the current working-branch commit (which contains the publication Environment fix), push that commit to origin as branch milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish as a fast-forward, never forcing, and record the pushed SHA.
- files_in_scope:
    - development-artifacts/patch-steward-m6-5.31-report.md
- context: |
    Repo: C:\Users\John\Projects\steady-orchard\patch-steward (Git Bash). Work in the tree you are given (a worktree on a
    short path whose HEAD is the working branch's current commit, or the main tree); run every command from its root.
    core.autocrlf=true. jq is NOT installed. Change NO file except this step's report. Never run a formatter on
    development-artifacts/.

    Owner authorization (binding): the pipeline MAY push `milestone/6-*` commits to origin (git@github.com:steady-orchard/
    patch-steward.git, PUBLIC); it may NOT push develop or master, may NOT force-push, may NOT push any other ref, tag, or
    branch. This is the ONE push of the fix loop: the test-bed wrappers will pin the pushed commit so the test-beds run
    the fixed reusable workflow. A milestone-branch push runs no CI.
    The ONLY push command allowed (exactly this, from your tree):
      git push origin HEAD:refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish
    The pushed commit C is HEAD of your tree BEFORE you commit your report (the report commit is never pushed).
    The remote branch currently points at 7161cd20df662314d14cc7f2f4130102baee1e98 (the previous pin), an ancestor of C.
    Plan start S = 6418129c7b104fd93d9162efcda6fe08373287ee. Phase base PB = d1af5375321637fe8b1e9b325b6ababb62ee6b58.

    The fix being pushed (files changed in steps 5.26 and 5.27): .github/workflows/steward-screening.yml jobs gate and
    publish declare `environment:` as the mapping `name: steward-publication` plus `deployment: false` (the string form
    made GitHub Actions record a Deployment on pull request heads); the static workflow test asserts it; the scenario
    workflows' Environment jobs use the same form. Since PB the ONLY changes under packages/, templates/, .github/,
    package.json, pnpm-lock.yaml are .github/workflows/steward-screening.yml and
    packages/core/src/conformance/workflows.fixture.test.ts.

    Checks P1-P11 in actions MUST all pass before the push (stop at the first failure, push nothing, report status fail
    with the verbatim output).
- actions: |
    1. Base check (files changed in steps 5.26-5.30): bash -c 'tr -d "\r" < .github/workflows/steward-screening.yml | grep -c -x -E "    environment:|      name: steward-publication|      deployment: false" | grep -qx 6 || echo "MISSING screening fix"; grep -q "deployment: false" packages/core/src/conformance/workflows.fixture.test.ts || echo "MISSING test"; grep -q "      deployment: false" scenarios/workflows/scenario-secret-scope-called.yml || echo "MISSING called"; grep -q "      deployment: false" scenarios/workflows/scenario-app-edit.yml || echo "MISSING app-edit"; grep -q "other_form=" scenarios/tools/pins.sh || echo "MISSING pins"; grep -q "before_fix_deployments" scenarios/tools/audit.sh || echo "MISSING audit"; grep -q "scenario-deployment-probe" scenarios/README.md || echo "MISSING readme"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge,
       or improvise).
    2. git status --porcelain must print nothing (clean tree); record `git rev-parse HEAD` as C.
    3. Run the checks, in order; each must give the stated result:
       P1. pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check -> exit 0
       P2. actionlint .github/workflows/steward-screening.yml templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml; echo "exit $?"
           -> prints exactly: exit 0
       P3. actionlint -ignore 'could not read reusable workflow file' scenarios/workflows/*.yml; echo "exit $?"
           -> prints exactly: exit 0
       P4. pnpm vitest run packages/core/src/conformance/workflows.fixture.test.ts packages/core/src/conformance/invariant-1-workflows.fixture.test.ts packages/core/src/pipeline/hosted-verify.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p5-push.json
           then node -e "const r=require('./node_modules/.m6-p5-push.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['only gate and publish declare the publication environment','every action and reusable workflow is pinned by full commit sha','wrappers pass secrets by explicit mapping','every job declares empty permissions','the credential-free build job holds no secret','workflows use only the steward secret names','no event text reaches a run step','run-name uses only numeric and enumerated values','a hosted issue run directory verifies like a local run'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
           -> the vitest run exits 0 and the node command prints exactly: titles ok
       P5. git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' HEAD -- .github/workflows/steward-screening.yml templates packages scenarios docs README.md CLAUDE.md ':!docs/project-development-plan.md' ':!docs/astra-plan.md'
           -> no output (exit 1)
       P6. git grep -I -n -E 'gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----' HEAD -- .
           -> no output (exit 1)
       P7. node -e "const cp=require('child_process');const g=p=>cp.execSync('git show HEAD:'+p,{encoding:'utf8'}).replace(/\r/g,'');const k='\n    environment:\n      name: steward-publication\n      deployment: false\n';const n=p=>g(p).split(k).length-1;const s=g('.github/workflows/steward-screening.yml');const ok=n('.github/workflows/steward-screening.yml')===2&&s.indexOf(k)>s.indexOf('\n  gate:\n')&&s.indexOf(k)<s.indexOf('\n  publish:\n')&&s.lastIndexOf(k)>s.indexOf('\n  publish:\n')&&n('scenarios/workflows/scenario-secret-scope-called.yml')===1&&n('scenarios/workflows/scenario-app-edit.yml')===1;console.log(ok?'mapping form ok':'mapping form wrong')"; git grep -n -E 'environment: steward-publication' HEAD -- .github/workflows scenarios/workflows templates; echo "exit $?"
           -> prints exactly two lines: mapping form ok, exit 1
       P8. git diff --quiet 6418129c7b104fd93d9162efcda6fe08373287ee HEAD -- .github/workflows/ci.yml .github/workflows/cd.yml vitest.config.ts vitest.live.config.ts eslint.config.mjs .prettierrc.json .prettierignore .gitignore; echo "exit $?"
           -> prints exactly: exit 0
       P9. git diff --name-only d1af5375321637fe8b1e9b325b6ababb62ee6b58 HEAD -- packages templates .github package.json pnpm-lock.yaml
           -> prints exactly two lines: .github/workflows/steward-screening.yml, packages/core/src/conformance/workflows.fixture.test.ts
       P10. bash scenarios/tools/secret-scope.sh check
           -> prints exactly two lines: SECRET-SCOPE check=mapping identical, SECRET-SCOPE check=declarations identical
       P11. git status --porcelain -> no output (the checks changed no tracked file)
    4. Remote state: `git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish`
       prints a SHA X (expected 7161cd20df662314d14cc7f2f4130102baee1e98). Run
       `git fetch origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish` and
       `git merge-base --is-ancestor X C`; if that exits non-zero STOP (not a fast-forward; never force) and report status
       fail.
    5. Push (exactly): git push origin HEAD:refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish
       A rejection -> STOP, report status fail with the verbatim output (no retry with other options).
    6. Verify: `git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish | cut -f1`
       prints C.
    7. Write the report. It MUST contain a line starting at column 0, exactly `pushed: <C>` (40 lowercase hex), plus the
       verbatim results of P1-P11 (last lines for long output), the ls-remote output before and after, and the push output.
- acceptance: |
    Run from the tree root in Git Bash after the report commit; each must give exactly the stated result.
    1. bash -c 'c=$(grep -m1 -o "^pushed: [0-9a-f]\{40\}" development-artifacts/patch-steward-m6-5.31-report.md | cut -d" " -f2); r=$(git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish | cut -f1); [ -n "$c" ] && [ "$c" = "$r" ] && git merge-base --is-ancestor "$c" HEAD && git merge-base --is-ancestor 7161cd20df662314d14cc7f2f4130102baee1e98 "$c" && [ "$(git show "$c:.github/workflows/steward-screening.yml" | tr -d "\r" | grep -c -x "      deployment: false")" = 2 ] && echo push-ok'
       -> prints exactly: push-ok
    2. git ls-remote origin 'refs/heads/*' | cut -f2 | grep -v -E '^refs/heads/(develop|master|milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish)$' | grep -c -E 'milestone/6'
       -> prints exactly: 0
- rollback: |
    Nothing is rolled back automatically: the pushed commit stays on origin (never force-push to remove it). A defect found
    later is fixed by a new commit and a new fast-forward push; test-bed pins then move to the new commit.
