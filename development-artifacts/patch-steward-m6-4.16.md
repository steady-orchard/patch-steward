# Step 4.16

- id: 4.16
- depends_on: [4.15]
- route: mechanical
- objective: Switch the live-tier "no published policy" assertions to the unsynced fork jambolo/patch-steward-testbed-public and add a live assertion that the org-public test-bed's newly published policy loads and validates, so `GH_TOKEN=$(gh auth token) pnpm test:live` passes.
- files_in_scope:
    - packages/core/src/github/github.live.test.ts
    - packages/cli/src/steward-commands.live.test.ts
    - development-artifacts/patch-steward-m6-4.16-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest); Git Bash; run every command from your tree root. core.autocrlf=true.
    jq is NOT installed (use node). Strict TS; Prettier single quotes, printWidth 132. `*.live.test.ts` files run only under
    `pnpm test:live` (vitest.live.config.ts; read-only against public test-beds; never in CI); never add network access to any
    other test.

    Why: the previous step deployed a valid policy to `.github/patch-steward/policy.yml` on master of the org-public test-bed
    steady-orchard/patch-steward-testbed-public (store `type: orphan-branch`, `branch: steward-evidence`, modes default
    observe). Two existing live tests assumed org-public has no published policy and now fail. The fork
    jambolo/patch-steward-testbed-public (public, never synced, has NO `.github` directory on master, issues disabled) keeps no
    policy forever, so the "no published policy" assertions move there. packages/cli is otherwise unchanged in this milestone:
    change only the live test named below in it.

    Exact changes:
    packages/core/src/github/github.live.test.ts (describe 'github live reads'):
    - Test 'live: test-bed branch head and directory listing validate': keep the title and the branch-head and `workflows`
      assertions; REPLACE the last assertion (no `patch-steward` entry in `.github`) with: the `.github` listing has an entry
      named 'patch-steward' whose type is 'dir'.
    - Test 'live: test-bed has no published policy': rename to 'live: the unsynced fork has no published policy' and load from
      { owner: 'jambolo', name: 'patch-steward-testbed-public' } branch 'master'; same expectations (failure code
      'policy-source.not-published', outcome 'inconclusive').
    - New test 'live: test-bed published policy loads and validates': loadPolicy({ kind: 'github', client, repository: repo,
      branch: 'master' }) for org-public -> ok; value.revision.kind 'git-tree'; value.revision.id matches /^[0-9a-f]{40}$/;
      value.revision.commit matches /^[0-9a-f]{40}$/; value.revision.ref 'master'; value.authoritative true;
      value.policy.evidence.store deep-equals { type: 'orphan-branch', branch: 'steward-evidence' }; value.policy.modes.default
      'observe'. Same offline skip pattern as the other tests (ctx.skip() when offline).
    packages/cli/src/steward-commands.live.test.ts:
    - Test 'live: screen without a published policy exits 2 and writes no run': keep the title and expectations; run it against
      the fork: argv ['--issue', '29', '--repo', 'jambolo/patch-steward-testbed-public', '--evidence-dir', ev] (screen reads
      the repository, then loads the policy, and stops with screen.policy-missing before any issue read, so the fork's disabled
      issues do not matter). Add a constant FORK = 'jambolo/patch-steward-testbed-public' next to REPO.
    Nothing else changes in either file (other tests, helpers, and REPO stay as they are).
- actions: |
    1. Base check (org-public policy deployed by step 4.15): gh api repos/steady-orchard/patch-steward-testbed-public/contents/.github/patch-steward/policy.yml?ref=master --jq .sha
       must print a 40-hex blob id equal to `git rev-parse HEAD:scenarios/fixtures/policies/orphan-branch.yml`; and
       `gh api repos/jambolo/patch-steward-testbed-public/contents/.github?ref=master` must fail with HTTP 404. Otherwise STOP and
       report status missing-base with the output.
    2. Edit both files per context; run `pnpm exec prettier --write` on both.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. GH_TOKEN=$(gh auth token) pnpm test:live --reporter=json --outputFile=node_modules/.m6-p4-4.16.json -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p4-4.16.json');const st={};for(const f of r.testResults)for(const a of f.assertionResults)st[a.title]=a.status;const need=['live: test-bed published policy loads and validates','live: the unsynced fork has no published policy','live: test-bed branch head and directory listing validate','live: screen without a published policy exits 2 and writes no run','live: screen issue 29 under a local policy file needs changes'];const bad=need.filter(t=>st[t]!=='passed');const stale=Object.keys(st).filter(t=>t==='live: test-bed has no published policy');console.log(bad.length||stale.length?'NOT PASSED '+JSON.stringify(bad)+' '+JSON.stringify(stale):'live ok')"
       -> prints exactly: live ok
    3. node -e "const fs=require('fs'),os=require('os'),cp=require('child_process');const T=os.tmpdir();const before=new Set(fs.readdirSync(T));const r=cp.spawnSync('pnpm test:live',{shell:true,stdio:'ignore',env:{...process.env,GH_TOKEN:cp.execSync('gh auth token').toString().trim()}});const fresh=fs.readdirSync(T).filter(n=>!before.has(n)&&n.startsWith('m5-live-'));console.log('exit '+r.status+' leaked '+fresh.length)"
       -> prints exactly: exit 0 leaked 0
    4. git status --porcelain -- packages/cli/src packages/core/src | grep -v -E 'github\.live\.test\.ts|steward-commands\.live\.test\.ts'
       -> no output
    5. pnpm typecheck -> exit 0
    6. pnpm vitest run -> exit 0
    7. pnpm exec eslint packages/core/src/github/github.live.test.ts packages/cli/src/steward-commands.live.test.ts -> exit 0
    8. pnpm exec prettier --check packages/core/src/github/github.live.test.ts packages/cli/src/steward-commands.live.test.ts -> exit 0
- rollback: |
    git revert <this step's commit> (restores both live test files; they then fail against the published policy until it is removed).
