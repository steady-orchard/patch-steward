- status: pass
- base: 843af80eb60f86caca3a4235f501b514075681f3
- changes: |
    No source files changed (files_in_scope contains only this report). Executed
    `bash scenarios/tools/deploy-steward.sh <key>` for org-public, personal, and org-private in that order, which wrote via SSH
    clone/commit/push to `master` of each test-bed repository:
      - .github/workflows/steward-pr.yml
      - .github/workflows/steward-issues.yml
      - .github/patch-steward/policy.yml (orphan-branch.yml for org-public/personal, repository-store.yml for org-private)
    No other repository or path was written. No scenario-* workflow was deployed.
- acceptance: |
    Prerequisite checks (actions steps 1-3):

    $ node -e "...base check..."
    base ok

    $ bash -c 'p=$(grep -m1 -o "steward-screening\.yml@[0-9a-f]\{40\}" scenarios/workflows/steward-pr.yml | cut -d@ -f2); git fetch --quiet origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish && git merge-base --is-ancestor "$p" FETCH_HEAD && echo "pin ok $p"'
    pin ok 7161cd20df662314d14cc7f2f4130102baee1e98

    PIN = 7161cd20df662314d14cc7f2f4130102baee1e98

    $ pnpm install --frozen-lockfile && pnpm build
    Scope: all 5 workspace projects
    Lockfile is up to date, resolution step is skipped
    Already up to date
    Done in 349ms using pnpm v10.20.0
    > patch-steward@0.0.2 build
    > pnpm -r build
    Scope: 4 of 5 workspace projects
    packages/web build: Done
    packages/core build: Done
    packages/action build: Done
    packages/cli build: Done

    $ for f in orphan-branch repository-store; do node packages/cli/dist/main.js policy --file scenarios/fixtures/policies/$f.yml > /dev/null; echo "$f exit $?"; done
    orphan-branch exit 0
    repository-store exit 0

    $ actionlint scenarios/workflows/steward-pr.yml scenarios/workflows/steward-issues.yml
    (no output, exit 0)

    Safety check: gh api rate_limit --jq .resources.core.remaining -> 5000 (>= 500 required)

    Deploy step (action 4), one standalone command per test-bed, in order:

    $ bash scenarios/tools/deploy-steward.sh org-public
    DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=master existed=yes
    warning: in the working copy of '.github/workflows/steward-pr.yml', LF will be replaced by CRLF the next time Git touches it
    warning: in the working copy of '.github/workflows/steward-issues.yml', LF will be replaced by CRLF the next time Git touches it
    DEPLOY commit=bb82507d4f06e23bfacdc669cdc886b6bd125c9c message=scenario: deploy steward wrappers and policy
    DEPLOY push=ok attempt=1 head=bb82507d4f06e23bfacdc669cdc886b6bd125c9c
    DEPLOY identical dest=.github/workflows/steward-pr.yml blob=6a2ded1721a593ece56863a31502232c02ce3e06
    DEPLOY identical dest=.github/workflows/steward-issues.yml blob=ecd5347c96097dce26f96a611a9bbf048b1d1fac
    DEPLOY identical dest=.github/patch-steward/policy.yml blob=eef9b9f340313b44865c6133ecb09941a9c9071f
    SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-public pin=7161cd20df662314d14cc7f2f4130102baee1e98 policy=scenarios/fixtures/policies/orphan-branch.yml result=ok
    EXIT_CODE=0

    $ bash scenarios/tools/deploy-steward.sh personal
    DEPLOY repo=jambolo/patch-steward-testbed-personal branch=master existed=yes
    warning: in the working copy of '.github/workflows/steward-pr.yml', LF will be replaced by CRLF the next time Git touches it
    warning: in the working copy of '.github/workflows/steward-issues.yml', LF will be replaced by CRLF the next time Git touches it
    DEPLOY commit=4bde4f69599598ca8697624b9baadc5fcdded19c message=scenario: deploy steward wrappers and policy
    DEPLOY push=ok attempt=1 head=4bde4f69599598ca8697624b9baadc5fcdded19c
    DEPLOY identical dest=.github/workflows/steward-pr.yml blob=6a2ded1721a593ece56863a31502232c02ce3e06
    DEPLOY identical dest=.github/workflows/steward-issues.yml blob=ecd5347c96097dce26f96a611a9bbf048b1d1fac
    DEPLOY identical dest=.github/patch-steward/policy.yml blob=eef9b9f340313b44865c6133ecb09941a9c9071f
    SCENARIO-DEPLOY repo=jambolo/patch-steward-testbed-personal pin=7161cd20df662314d14cc7f2f4130102baee1e98 policy=scenarios/fixtures/policies/orphan-branch.yml result=ok
    EXIT_CODE=0

    $ bash scenarios/tools/deploy-steward.sh org-private
    DEPLOY repo=steady-orchard/patch-steward-testbed-private branch=master existed=yes
    warning: in the working copy of '.github/workflows/steward-pr.yml', LF will be replaced by CRLF the next time Git touches it
    warning: in the working copy of '.github/workflows/steward-issues.yml', LF will be replaced by CRLF the next time Git touches it
    DEPLOY commit=5d3b2da821974e911b1d07d8c9bb05fe10b4c616 message=scenario: deploy steward wrappers and policy
    DEPLOY push=ok attempt=1 head=5d3b2da821974e911b1d07d8c9bb05fe10b4c616
    DEPLOY identical dest=.github/workflows/steward-pr.yml blob=6a2ded1721a593ece56863a31502232c02ce3e06
    DEPLOY identical dest=.github/workflows/steward-issues.yml blob=ecd5347c96097dce26f96a611a9bbf048b1d1fac
    DEPLOY identical dest=.github/patch-steward/policy.yml blob=16a4b46a480f70c905a1bc9d7964681cd5243a9a
    SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-private pin=7161cd20df662314d14cc7f2f4130102baee1e98 policy=scenarios/fixtures/policies/repository-store.yml result=ok
    EXIT_CODE=0

    Verification (acceptance commands 1-2, run after all three deploys):

    $ (acceptance check 1: blob-id comparison for all 9 deployed files across the 3 test-beds)
          9 same

    $ (acceptance check 2: workflow list state, first attempt, no retry needed)
          3 .github/workflows/steward-issues.yml active
          3 .github/workflows/steward-pr.yml active

    $ (acceptance check 3, run after this report was written)
    pin ok 7161cd20df662314d14cc7f2f4130102baee1e98
    3
- deviations: |
    None. All prerequisite checks passed on the first attempt; all three deploys succeeded on the first attempt (attempt=1); both
    workflows showed `active` on the first polling attempt, so the up-to-3x20s retry loop was not needed beyond attempt 1.

## Test-bed state after deployment

- steady-orchard/patch-steward-testbed-public (master):
    - .github/workflows/steward-pr.yml blob=6a2ded1721a593ece56863a31502232c02ce3e06
    - .github/workflows/steward-issues.yml blob=ecd5347c96097dce26f96a611a9bbf048b1d1fac
    - .github/patch-steward/policy.yml blob=eef9b9f340313b44865c6133ecb09941a9c9071f (orphan-branch.yml)
    - both wrappers `active`; no scenario-* workflow deployed
- jambolo/patch-steward-testbed-personal (master):
    - .github/workflows/steward-pr.yml blob=6a2ded1721a593ece56863a31502232c02ce3e06
    - .github/workflows/steward-issues.yml blob=ecd5347c96097dce26f96a611a9bbf048b1d1fac
    - .github/patch-steward/policy.yml blob=eef9b9f340313b44865c6133ecb09941a9c9071f (orphan-branch.yml)
    - both wrappers `active`; no scenario-* workflow deployed
- steady-orchard/patch-steward-testbed-private (master):
    - .github/workflows/steward-pr.yml blob=6a2ded1721a593ece56863a31502232c02ce3e06
    - .github/workflows/steward-issues.yml blob=ecd5347c96097dce26f96a611a9bbf048b1d1fac
    - .github/patch-steward/policy.yml blob=16a4b46a480f70c905a1bc9d7964681cd5243a9a (repository-store.yml)
    - both wrappers `active`; no scenario-* workflow deployed
