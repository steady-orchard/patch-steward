# Step 4.13

- id: 4.13
- depends_on: [4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11]
- route: mechanical
- objective: After every local static check passes on the current working-branch commit, push that commit (the step's base) to origin as branch milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish, never forcing, and record the pushed SHA.
- files_in_scope:
    - development-artifacts/patch-steward-m6-4.13-report.md
- context: |
    Repo: C:\Users\John\Projects\steady-orchard\patch-steward (Git Bash). Work in the tree you are given (a worktree on a short
    path whose HEAD is the working branch's current commit, or the main tree); run every command from its root. core.autocrlf=true.
    jq is NOT installed. Change NO file except this step's report.

    Owner authorization (binding): the pipeline MAY push `milestone/6-*` commits to origin (git@github.com:steady-orchard/
    patch-steward.git, a PUBLIC repository); it may NOT push develop or master, may NOT force-push, may NOT push any other ref,
    tag, or branch. The push is needed so test-bed wrappers can pin a reachable commit of the reusable workflow. Pushing a
    milestone branch runs no CI (ci.yml triggers only on master, develop, release/** and pull requests).
    The ONLY push command allowed (exactly this, from your tree):
      git push origin HEAD:refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish
    Remote ref name R = refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish.
    The pushed commit is HEAD of your tree BEFORE you commit your report (your report commit is never pushed). Everything the
    test-beds will run comes from that commit: .github/workflows/steward-screening.yml and packages/** (built at run time on the
    runner from the pinned commit).
    Starting commit of the plan S = 6418129c7b104fd93d9162efcda6fe08373287ee.

    Local static checks that MUST all pass before the push (P1-P9 in actions; stop at the first failure, push nothing, and report
    status fail with the verbatim output):
    toolchain; actionlint on the three product workflow files and on the scenario workflows; static workflow tests and the
    invariant-1 workflow scan by title; the probe secret-name grep; a credential-literal scan; the runtime pack dry run; CI and
    tool configs unchanged since S.
- actions: |
    1. Base check (files changed in steps 4.1 to 4.11): node -e "const fs=require('fs');const f=['.github/workflows/steward-screening.yml','packages/action/pack-runtime.sh','templates/workflows/steward-pr.yml','templates/workflows/steward-issues.yml','packages/core/src/pipeline/hosted-verify.fixture.test.ts','packages/core/src/conformance/workflows.fixture.test.ts','packages/core/src/conformance/invariant-1-workflows.fixture.test.ts','scenarios/fixtures/policies/orphan-branch.yml','scenarios/tools/evidence.sh','scenarios/tools/secret-scope.sh','scenarios/workflows/scenario-secret-scope.yml'];const m=f.filter(p=>!fs.existsSync(p));const t=fs.readFileSync('templates/policy/policy.yml','utf8');if(!t.includes('branch: steward-evidence'))m.push('template branch');console.log(m.length?'MISSING '+m.join(' '):'base ok')"
       It must print `base ok`; otherwise STOP and report status missing-base with the output.
    2. git status --porcelain must print nothing (clean tree); record `git rev-parse HEAD` as C.
    3. Run the checks, in order; each must give the stated result:
       P1. pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check -> exit 0
       P2. actionlint .github/workflows/steward-screening.yml templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml; echo "exit $?"
           -> prints exactly: exit 0
       P3. actionlint -ignore 'could not read reusable workflow file' scenarios/workflows/*.yml; echo "exit $?"
           -> prints exactly: exit 0
       P4. pnpm vitest run packages/core/src/conformance/workflows.fixture.test.ts packages/core/src/conformance/invariant-1-workflows.fixture.test.ts packages/core/src/pipeline/hosted-verify.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p4-push.json
           then node -e "const r=require('./node_modules/.m6-p4-push.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['only gate and publish declare the publication environment','every action and reusable workflow is pinned by full commit sha','wrappers pass secrets by explicit mapping','every job declares empty permissions','the credential-free build job holds no secret','workflows use only the steward secret names','no event text reaches a run step','run-name uses only numeric and enumerated values','a hosted issue run directory verifies like a local run'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
           -> the vitest run exits 0 and the node command prints exactly: titles ok
       P5. git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' HEAD -- .github/workflows/steward-screening.yml templates packages scenarios docs README.md CLAUDE.md ':!docs/project-development-plan.md' ':!docs/astra-plan.md'
           -> no output (exit 1)
       P6. git grep -I -n -E 'gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----' HEAD -- .
           -> no output (exit 1)
       P7. bash -c 'T=$(mktemp -d); bash packages/action/pack-runtime.sh "$T/rt.tar.gz" > /dev/null && mkdir "$T/x" && tar -xzf "$T/rt.tar.gz" -C "$T/x" && node "$T/x/packages/action/dist/main.js"; echo "exit $?"; rm -rf "$T"'
           -> prints exactly two lines: usage: main.js gate|publish, then exit 2
       P8. git diff --quiet 6418129c7b104fd93d9162efcda6fe08373287ee HEAD -- .github/workflows/ci.yml .github/workflows/cd.yml vitest.config.ts vitest.live.config.ts eslint.config.mjs .prettierrc.json .prettierignore .gitignore; echo "exit $?"
           -> prints exactly: exit 0
       P9. git status --porcelain -> no output (the checks changed no tracked file)
    4. Remote state: run `git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish`.
       If it prints a SHA X: run `git fetch origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish`
       and `git merge-base --is-ancestor X C`; if that exits non-zero STOP (the push would not be a fast-forward; never force)
       and report status fail. If it prints nothing, the branch does not exist yet on origin (normal first push).
    5. Push (exactly): git push origin HEAD:refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish
       A rejection -> STOP, report status fail with the verbatim output (no retry with other options).
    6. Verify: `git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish | cut -f1`
       prints C.
    7. Write the report. It MUST contain a line starting at column 0, exactly `pushed: <C>` (40 lowercase hex), plus the
       verbatim results of P1-P9 (last lines for long output), the ls-remote output before and after, and the push output.
- acceptance: |
    Run from the tree root in Git Bash after the report commit; it must give exactly the stated result.
    1. bash -c 'c=$(grep -m1 -o "^pushed: [0-9a-f]\{40\}" development-artifacts/patch-steward-m6-4.13-report.md | cut -d" " -f2); r=$(git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish | cut -f1); [ -n "$c" ] && [ "$c" = "$r" ] && git merge-base --is-ancestor "$c" HEAD && git cat-file -e "$c:.github/workflows/steward-screening.yml" && git cat-file -e "$c:packages/action/pack-runtime.sh" && echo push-ok'
       -> prints exactly: push-ok
    2. git ls-remote origin 'refs/heads/*' | cut -f2 | grep -v -E '^refs/heads/(develop|master|milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish)$' | grep -c -E 'milestone/6'
       -> prints exactly: 0
- rollback: |
    Nothing is rolled back automatically: the pushed commit stays on origin (never force-push to remove it). A defect found later is
    fixed by a new commit and a new fast-forward push; test-bed pins then move to the new commit.
