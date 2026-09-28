# Step 4.15

- id: 4.15
- depends_on: [4.14, 4.5, 4.6]
- route: mechanical
- objective: Deploy the pinned wrapper copies and the test-bed policy to master of the three test-beds with scenarios/tools/deploy-steward.sh, and verify every deployed file by git blob id and every pin as reachable on the pushed milestone branch.
- files_in_scope:
    - development-artifacts/patch-steward-m6-4.15-report.md
- context: |
    Repo root in Git Bash (run every command from your tree root). core.autocrlf=true: compare deployed files ONLY by git blob id
    (`git rev-parse HEAD:<path>`, the LF content) against the contents API `.sha`, never working-tree bytes. jq is NOT installed
    (use `gh --jq`). Change NO file except this step's report.

    Owner authorization (binding): the pipeline MAY write test-bed workflows and policies through the probe tooling. This step
    writes ONLY `.github/workflows/steward-pr.yml`, `.github/workflows/steward-issues.yml`, and `.github/patch-steward/policy.yml`
    on `master` of these three repositories, each through `bash scenarios/tools/deploy-steward.sh <key>` (which calls
    probes/smoke/tools/deploy.sh: SSH clone to a temp dir, one commit, push with fetch-rebase retries, blob-id verification):
      org-public  = steady-orchard/patch-steward-testbed-public  (policy scenarios/fixtures/policies/orphan-branch.yml)
      personal    = jambolo/patch-steward-testbed-personal       (policy scenarios/fixtures/policies/orphan-branch.yml)
      org-private = steady-orchard/patch-steward-testbed-private (policy scenarios/fixtures/policies/repository-store.yml)
    Never write anything else to any repository; never create issues, PRs, branches, secrets, Environments, or settings; never
    force-push; never print a token or secret. Deploying creates no GitHub event the wrappers react to (they trigger only on
    issues and pull_request_target events, and only for the allowlisted senders). The deployed wrappers stay ENABLED afterwards
    (later steps and scenarios use them). The org-private policy names the private evidence repository
    steady-orchard/patch-steward-testbed-evidence; deploying it needs nothing from that repository.
    Safety: before any write check `gh api rate_limit --jq .resources.core.remaining` >= 500.
- actions: |
    1. Base check (files changed in steps 4.5, 4.6, 4.14): node -e "const fs=require('fs');const f=['scenarios/workflows/steward-pr.yml','scenarios/workflows/steward-issues.yml','scenarios/fixtures/policies/orphan-branch.yml','scenarios/fixtures/policies/repository-store.yml','scenarios/tools/deploy-steward.sh','probes/smoke/tools/deploy.sh'];const m=f.filter(p=>!fs.existsSync(p));console.log(m.length?'MISSING '+m.join(' '):'base ok')"
       It must print `base ok`; otherwise STOP and report status missing-base with the output.
    2. Pin check: bash -c 'p=$(grep -m1 -o "steward-screening\.yml@[0-9a-f]\{40\}" scenarios/workflows/steward-pr.yml | cut -d@ -f2); git fetch --quiet origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish && git merge-base --is-ancestor "$p" FETCH_HEAD && echo "pin ok $p"'
       It must print `pin ok <40 hex>` (record it as PIN); otherwise STOP and report status fail.
    3. pnpm install --frozen-lockfile && pnpm build, then validate both policies:
       for f in orphan-branch repository-store; do node packages/cli/dist/main.js policy --file scenarios/fixtures/policies/$f.yml > /dev/null; echo "$f exit $?"; done
       -> both `exit 0`; otherwise STOP (report fail). Also `actionlint scenarios/workflows/steward-pr.yml scenarios/workflows/steward-issues.yml` must exit 0.
    4. Deploy, one standalone command per test-bed, in this order, recording the full output of each:
       bash scenarios/tools/deploy-steward.sh org-public
       bash scenarios/tools/deploy-steward.sh personal
       bash scenarios/tools/deploy-steward.sh org-private
       Each must end with `SCENARIO-DEPLOY repo=<repo> pin=<PIN> policy=<file> result=ok` and exit 0. On a failure STOP (do not
       continue with the next test-bed) and report status fail with the verbatim output.
    5. Verify (the acceptance commands 1-2) and record their output. Wait up to 3 x 20 s for the two workflows to be listed
       (a freshly pushed workflow can take a few seconds to register).
    6. Write the report with the deploy outputs, PIN, and the verification output. Record the resulting test-bed state as a
       section `## Test-bed state after deployment`: for each test-bed the three deployed paths and blob ids, both wrappers
       `active`, and that no scenario-* workflow was deployed.
- acceptance: |
    Run from the tree root in Git Bash; each must give exactly the stated result.
    1. bash -c 'for r in steady-orchard/patch-steward-testbed-public:orphan-branch jambolo/patch-steward-testbed-personal:orphan-branch steady-orchard/patch-steward-testbed-private:repository-store; do repo=${r%%:*}; pol=${r#*:}; for pair in "scenarios/workflows/steward-pr.yml:.github/workflows/steward-pr.yml" "scenarios/workflows/steward-issues.yml:.github/workflows/steward-issues.yml" "scenarios/fixtures/policies/$pol.yml:.github/patch-steward/policy.yml"; do src=${pair%%:*}; dest=${pair#*:}; l=$(git rev-parse "HEAD:$src"); d=$(gh api "repos/$repo/contents/$dest?ref=master" --jq .sha); [ -n "$l" ] && [ "$l" = "$d" ] && echo "same $repo $dest" || echo "DIFF $repo $dest"; done; done' | cut -d' ' -f1 | sort | uniq -c
       -> prints exactly one line: `      9 same` (nine files identical; leading spaces as printed by uniq -c)
    2. bash -c 'for repo in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do gh workflow list -R "$repo" --all --json path,state --jq ".[] | select(.path == \".github/workflows/steward-pr.yml\" or .path == \".github/workflows/steward-issues.yml\") | .path + \" \" + .state"; done' | sort | uniq -c
       -> prints exactly two lines: `      3 .github/workflows/steward-issues.yml active` and `      3 .github/workflows/steward-pr.yml active`
    3. bash -c 'p=$(grep -m1 -o "steward-screening\.yml@[0-9a-f]\{40\}" scenarios/workflows/steward-pr.yml | cut -d@ -f2); git fetch --quiet origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish && git merge-base --is-ancestor "$p" FETCH_HEAD && grep -c "result=ok" development-artifacts/patch-steward-m6-4.15-report.md'
       -> prints a number >= 3 and exits 0
- rollback: |
    Redeploy the previous content through probes/smoke/tools/deploy.sh (never force-push master), or disable the two wrappers with
    `gh workflow disable steward-pr.yml -R <repo>` and `gh workflow disable steward-issues.yml -R <repo>`; the policy file stays.
