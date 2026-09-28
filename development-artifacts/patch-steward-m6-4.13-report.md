- status: pass
- base: 7161cd20df662314d14cc7f2f4130102baee1e98
- changes: |
    No files modified other than this report. Ran P1-P9 static checks, confirmed the branch did not yet exist on origin, then
    pushed the current HEAD commit to origin as milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish.
- acceptance: |
    Step 2 (base check, node -e ... base ok check):
    base ok

    Step 2 (git status --porcelain, clean tree):
    (no output)
    Recorded C via git rev-parse HEAD: 7161cd20df662314d14cc7f2f4130102baee1e98

    P1. pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
    (verbatim tail of output)
    > patch-steward@0.0.2 test C:\Users\John\Projects\steady-orchard\patch-steward
    > vitest run

     RUN  v5.0.1 C:/Users/John/Projects/steady-orchard/patch-steward

     Test Files  189 passed (189)
          Tests  3474 passed (3474)
       Start at  01:19:11
       Duration  20.24s (tests 67%, import 23%, transform 9%)

    > patch-steward@0.0.2 lint C:\Users\John\Projects\steady-orchard\patch-steward
    > eslint .

    > patch-steward@0.0.2 format:check C:\Users\John\Projects\steady-orchard\patch-steward
    > prettier --check .

    Checking formatting...
    All matched files use Prettier code style!
    (overall command exit 0)

    P2. actionlint .github/workflows/steward-screening.yml templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml; echo "exit $?"
    exit 0

    P3. actionlint -ignore 'could not read reusable workflow file' scenarios/workflows/*.yml; echo "exit $?"
    exit 0

    P4. pnpm vitest run packages/core/src/conformance/workflows.fixture.test.ts packages/core/src/conformance/invariant-1-workflows.fixture.test.ts packages/core/src/pipeline/hosted-verify.fixture.test.ts --reporter=json --outputFile=node_modules/.m6-p4-push.json
    JSON report written to C:/Users/John/Projects/steady-orchard/patch-steward/node_modules/.m6-p4-push.json
    vitest exit 0
    node -e "...titles..." output:
    titles ok

    P5. git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' HEAD -- .github/workflows/steward-screening.yml templates packages scenarios docs README.md CLAUDE.md ':!docs/project-development-plan.md' ':!docs/astra-plan.md'
    (no output, exit 1)

    P6. git grep -I -n -E 'gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----' HEAD -- .
    (no output, exit 1)

    P7. bash -c 'T=$(mktemp -d); bash packages/action/pack-runtime.sh "$T/rt.tar.gz" > /dev/null && mkdir "$T/x" && tar -xzf "$T/rt.tar.gz" -C "$T/x" && node "$T/x/packages/action/dist/main.js"; echo "exit $?"; rm -rf "$T"'
    usage: main.js gate|publish
    exit 2

    P8. git diff --quiet 6418129c7b104fd93d9162efcda6fe08373287ee HEAD -- .github/workflows/ci.yml .github/workflows/cd.yml vitest.config.ts vitest.live.config.ts eslint.config.mjs .prettierrc.json .prettierignore .gitignore; echo "exit $?"
    exit 0

    P9. git status --porcelain
    (no output)

    Remote state before push:
    git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish
    (no output - branch did not exist yet on origin)

    Push:
    git push origin HEAD:refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish
    remote:
    remote: Create a pull request for 'milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish' on GitHub by visiting:
    remote:      https://github.com/steady-orchard/patch-steward/pull/new/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish
    remote:
    To github.com:steady-orchard/patch-steward.git
     * [new branch]      HEAD -> milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish

    Remote state after push:
    git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish | cut -f1
    7161cd20df662314d14cc7f2f4130102baee1e98

    Matches C.
pushed: 7161cd20df662314d14cc7f2f4130102baee1e98
- deviations: none
