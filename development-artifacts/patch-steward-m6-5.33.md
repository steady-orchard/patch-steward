# Step 5.33

- id: 5.33
- depends_on: [5.32, 5.27, 5.28, 5.29]
- route: mechanical
- objective: Redeploy the re-pinned wrappers (with the unchanged test-bed policies) and the fixed scenario helper workflows to master of the three test-beds, keep every steward and scenario workflow disabled, and verify blob identity, pins, and the before-fix deployment split.
- files_in_scope:
    - development-artifacts/patch-steward-m6-5.33-report.md
- context: |
    Repo root in Git Bash (run every command from your tree root). core.autocrlf=true: compare deployed files ONLY by git
    blob id (`git rev-parse HEAD:<path>` against the contents API `.sha`), never working-tree bytes. jq is NOT installed
    (use `gh --jq` or node). `gh api` endpoints never start with `/`. Never print a token or secret (never
    `gh auth token`, never `set -x`). Never run a formatter on development-artifacts/. Change NO file except this
    step's report.

    Why: the reusable workflow's publication jobs now declare `environment: {name: steward-publication, deployment:
    false}` (pushed commit PIN, step 5.31); the wrapper copies pin PIN (files changed in step 5.32); the scenario helper
    workflows use the same form (files changed in step 5.27). The test-beds still run the previous pin
    7161cd20df662314d14cc7f2f4130102baee1e98, whose string-form Environment jobs left Deployments on pull request heads.

    Test-beds (key, repository, policy file deployed with the wrappers, helper workflows present on master):
      org-public   steady-orchard/patch-steward-testbed-public   scenarios/fixtures/policies/orphan-branch.yml     scenario-secret-scope.yml, scenario-secret-scope-called.yml, scenario-app-edit.yml
      personal     jambolo/patch-steward-testbed-personal         scenarios/fixtures/policies/orphan-branch.yml     scenario-secret-scope.yml, scenario-secret-scope-called.yml
      org-private  steady-orchard/patch-steward-testbed-private  scenarios/fixtures/policies/repository-store.yml  scenario-secret-scope.yml, scenario-secret-scope-called.yml
    Owner authorization (binding): the pipeline MAY write test-bed workflow and policy files on master ONLY through
    `bash scenarios/tools/deploy-steward.sh <key>` (wrappers + policy; ends `SCENARIO-DEPLOY repo=<r> pin=<PIN>
    policy=<file> result=ok`) and `bash probes/smoke/tools/deploy.sh <repo> master "<message>" <files...>` (helper
    workflows; SSH clone, at most one commit, push with fetch-rebase retries, never force; ends with DEPLOY lines and
    exit 0 when every file is identical). The policies are unchanged, so deploys change only the wrappers and
    scenario-secret-scope-called.yml (plus scenario-app-edit.yml on org-public). Never delete a file, a Deployment, a
    branch, or anything else; never touch `.github/workflows/scenario-deployment-probe.yml` or branch
    `scenario-deployment-probe` on org-public; create no issue, pull request, or branch; dispatch nothing.
    Workflow state: every `steward-pr.yml`, `steward-issues.yml`, and `scenario-*` workflow on the three test-beds is
    `disabled_manually` (steady state) and must stay disabled after this step; deploying a file does not change a
    workflow's state. The only state change this step may make is `gh workflow disable <file> -R <repo>` for an in-scope
    workflow that is found not disabled after the deploy.
    Pushing to master starts no steward run (the wrappers trigger only on pull_request_target and issues events, and they
    are disabled).
    audit.sh (files changed in step 5.29) derives the wrappers' deployment time T from the newest master commit that
    changed .github/workflows/steward-pr.yml, so after this deploy T on org-public is this deploy's commit time, and the
    40 Deployments GitHub Actions created on the heads of org-public pull requests 32, 33, 34, 36, 37 (2, 2, 28, 4, 4, all
    before 2026-09-28T12:26Z) classify as `before-fix`.
    pins.sh (files changed in step 5.28): eight checks and `PINS repo=<r> pin=<PIN> result=pass` when the deployed
    wrappers equal the copies, pin PIN is on the pushed branch, and PIN's reusable workflow declares the mapping form on
    exactly gate and publish (`check=environment-jobs ok jobs=gate,publish other_form=none`).
- actions: |
    1. Base check (files changed in steps 5.27-5.32): bash -c 'p=$(tr -d "\r" < scenarios/workflows/steward-pr.yml | grep -oE "steward-screening\.yml@[0-9a-f]{40}" | cut -d@ -f2); c=$(grep -m1 -o "^pushed: [0-9a-f]\{40\}" development-artifacts/patch-steward-m6-5.31-report.md 2>/dev/null | cut -d" " -f2); r=$(git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish | cut -f1); [ -n "$p" ] && [ "$p" = "$c" ] && [ "$c" = "$r" ] || echo "MISSING pin p=$p c=$c r=$r"; grep -q "      deployment: false" scenarios/workflows/scenario-secret-scope-called.yml || echo "MISSING called"; grep -q "      deployment: false" scenarios/workflows/scenario-app-edit.yml || echo "MISSING app-edit"; grep -q "other_form=" scenarios/tools/pins.sh || echo "MISSING pins"; grep -q "before_fix_deployments" scenarios/tools/audit.sh || echo "MISSING audit"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge,
       or improvise). PIN = the pinned SHA of scenarios/workflows/steward-pr.yml.
    2. pnpm install --frozen-lockfile && pnpm build; then
       for f in orphan-branch repository-store; do node packages/cli/dist/main.js policy --file scenarios/fixtures/policies/$f.yml > /dev/null; echo "$f exit $?"; done   (both exit 0)
       actionlint scenarios/workflows/steward-pr.yml scenarios/workflows/steward-issues.yml; echo "exit $?"   (exit 0)
       Otherwise STOP, status fail.
    3. `gh api rate_limit --jq .resources.core.remaining` >= 500 (else STOP, status fail). For each test-bed record
       `bash scenarios/tools/steady-state.sh <repo> plan | tail -n 1` (expected `... result=planned active_workflows=0 open_submissions=0`).
    4. Deploy, one standalone command each, in this order, recording the full output verbatim in the report (lines at
       column 0, e.g. inside ```text fences); each must exit 0 (STOP at the first failure, status fail, verbatim output):
       bash scenarios/tools/deploy-steward.sh org-public
       bash scenarios/tools/deploy-steward.sh personal
       bash scenarios/tools/deploy-steward.sh org-private
       bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public master "scenario: deploy helper workflows" scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml scenarios/workflows/scenario-app-edit.yml
       bash probes/smoke/tools/deploy.sh jambolo/patch-steward-testbed-personal master "scenario: deploy helper workflows" scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml
       bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-private master "scenario: deploy helper workflows" scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml
    5. Workflow states, per test-bed <repo>:
       gh api "repos/<repo>/actions/workflows?per_page=100" --paginate --jq '.workflows[] | select(.path == ".github/workflows/steward-pr.yml" or .path == ".github/workflows/steward-issues.yml" or (.path | startswith(".github/workflows/scenario-"))) | (.path | ltrimstr(".github/workflows/")) + " " + .state'
       For any line other than `scenario-secret-scope-called.yml ...` whose state is not `disabled_manually`, run
       `gh workflow disable <file> -R <repo>` and list again. Record both listings.
    6. For each test-bed record: gh api "repos/<repo>/commits?sha=master&path=.github/workflows/steward-pr.yml&per_page=1" --jq '.[0].sha + " " + .[0].commit.committer.date'
       Write it in the report at column 0 as `wrappers_deployed_at <key>: <sha> <date>`.
    7. Run acceptance 1-4 and record their output in the report; also record PIN at column 0 as `pin: <PIN>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. bash -c 'set -u; chk(){ l=$(git rev-parse "HEAD:$2"); d=$(gh api "repos/$1/contents/$3?ref=master" --jq .sha 2>/dev/null); [ -n "$l" ] && [ "$l" = "$d" ] && echo same || echo "DIFF $1 $3"; }; for r in steady-orchard/patch-steward-testbed-public:orphan-branch jambolo/patch-steward-testbed-personal:orphan-branch steady-orchard/patch-steward-testbed-private:repository-store; do repo=${r%%:*}; pol=${r#*:}; chk $repo scenarios/workflows/steward-pr.yml .github/workflows/steward-pr.yml; chk $repo scenarios/workflows/steward-issues.yml .github/workflows/steward-issues.yml; chk $repo scenarios/fixtures/policies/$pol.yml .github/patch-steward/policy.yml; chk $repo scenarios/workflows/scenario-secret-scope.yml .github/workflows/scenario-secret-scope.yml; chk $repo scenarios/workflows/scenario-secret-scope-called.yml .github/workflows/scenario-secret-scope-called.yml; done; chk steady-orchard/patch-steward-testbed-public scenarios/workflows/scenario-app-edit.yml .github/workflows/scenario-app-edit.yml' | sort | uniq -c
       -> prints exactly one line: `     16 same` (leading spaces as printed by uniq -c)
    2. pin=$(tr -d '\r' < scenarios/workflows/steward-pr.yml | grep -oE 'steward-screening\.yml@[0-9a-f]{40}' | cut -d@ -f2); for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/pins.sh $r; done > "${TMPDIR:-/tmp}/m6-533-pins.txt"; grep -c -E "^PINS repo=\S+ pin=$pin result=pass\$" "${TMPDIR:-/tmp}/m6-533-pins.txt"; grep -c -E '^PINS repo=\S+ check=environment-jobs ok jobs=gate,publish other_form=none$' "${TMPDIR:-/tmp}/m6-533-pins.txt"; rm -f "${TMPDIR:-/tmp}/m6-533-pins.txt"
       -> prints exactly two lines: 3, 3
    3. for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do gh api "repos/$r/actions/workflows?per_page=100" --paginate --jq '.workflows[] | select(.path == ".github/workflows/steward-pr.yml" or .path == ".github/workflows/steward-issues.yml" or (.path | startswith(".github/workflows/scenario-"))) | (.path | ltrimstr(".github/workflows/")) + " " + .state' | grep -v -E '^scenario-secret-scope-called\.yml ' | grep -v -c ' disabled_manually$'; done
       -> prints exactly three lines: 0, 0, 0
    4. bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public | node -e 'const L=require("fs").readFileSync(0,"utf8").replace(/\r/g,"").split("\n").filter(Boolean);const m=/^AUDIT repo=steady-orchard\/patch-steward-testbed-public wrappers_deployed_at=([0-9TZ:-]{20}) source=history$/.exec(L[0]);const D=L.filter(l=>l.startsWith("AUDIT-DEPLOYMENT "));const maxBefore=D.map(l=>/ created_at=(\S+) /.exec(l)[1]).sort().pop()||"";const ok=!!m&&m[1]>"2026-09-28T12:26:00Z"&&D.length===40&&D.every(l=>l.endsWith(" class=before-fix"))&&maxBefore<m[1]&&/ head_deployments=0 before_fix_deployments=40 result=clean$/.test(L[L.length-1]);console.log(ok?"split ok":"split wrong "+JSON.stringify({first:L[0],n:D.length,last:L[L.length-1]}))'
       -> prints exactly: split ok
    5. grep -c -E '^SCENARIO-DEPLOY repo=\S+ pin=[0-9a-f]{40} policy=\S+ result=ok' development-artifacts/patch-steward-m6-5.33-report.md; grep -c -E '^wrappers_deployed_at (org-public|personal|org-private): [0-9a-f]{40} [0-9TZ:-]{20}' development-artifacts/patch-steward-m6-5.33-report.md
       -> prints exactly two lines: 3, 3
- rollback: |
    Redeploy the previous copies (pin 7161cd20df662314d14cc7f2f4130102baee1e98, from git history) and helper workflows through
    the same deploy tools (never force-push master). Deployments are never deleted.
