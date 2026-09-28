# Step 2.4

- id: 2.4
- depends_on: []
- route: mechanical
- objective: Record, read-only with gh api, the real GitHub REST response shapes the hosted adapters consume (artifact and run listings, branch ref, commit, compare, subtree read, contents file and directory, App bot user) into fixtures/github/hosted/ and document them in fixtures/README.md.
- files_in_scope:
    - fixtures/github/hosted/artifacts-page.json
    - fixtures/github/hosted/runs-page.json
    - fixtures/github/hosted/runs-in-progress.json
    - fixtures/github/hosted/ref-heads-master.json
    - fixtures/github/hosted/git-commit-master.json
    - fixtures/github/hosted/compare-parent-master.json
    - fixtures/github/hosted/tree-master-github.json
    - fixtures/github/hosted/contents-readme.json
    - fixtures/github/hosted/contents-github-directory.json
    - fixtures/github/hosted/user-app-bot.json
    - fixtures/README.md
    - development-artifacts/patch-steward-m6-2.4-report.md
- context: |
    Repo: pnpm monorepo; run commands in Git Bash from the worktree root. `gh` is installed and authenticated; `jq` is NOT installed
    (use gh's built-in --jq). All GitHub access in this step is READ-ONLY GET through `gh api` against the public test-bed
    repository steady-orchard/patch-steward-testbed-public and the public user endpoint. Never write to GitHub, never print or
    store a token (`gh auth token` must not be used), never record a signed download URL (do NOT call any /zip endpoint).

    Purpose: later tests validate the hosted adapters' zod schemas against real response shapes. Recorded files are fixtures under
    fixtures/ (persistent, Prettier-checked JSON; no planning identifiers anywhere in fixtures/). An existing fixture-tier test
    (packages/core/src/github/recorded-responses.fixture.test.ts) walks every .json file under fixtures/github/ and fails if any
    matches a built-in credential detector; the new files are covered by it automatically.

    Reductions (to keep personal data and diffs out): run-list items keep only id, name, display_title, path, event, status,
    conclusion, created_at, updated_at, run_attempt, run_number, workflow_id, head_branch, head_sha; the commit keeps only sha, url,
    tree, parents; the comparison keeps only status, ahead_by, behind_by, total_commits, and files reduced to sha, filename, status,
    additions, deletions, changes. Every other file is kept as served. gh's --jq prints compact JSON with sorted keys; Prettier then
    formats every file.

    fixtures/README.md lists corpus entries as bullets ("Current entries:"); the new bullet goes right after the bullet that starts
    with "- `github/policy-directory/`" (which ends "equals the git tree id."). Prettier keeps prose line breaks (proseWrap is not
    set); keep lines at most 132 characters, continuation lines indented two spaces, American spelling, no planning identifiers
    (no milestone, phase, step, or rule ids; no development-artifacts path).
- actions: |
    1. Record (Git Bash, from the worktree root; stop and report status fail if any command fails):
       R=steady-orchard/patch-steward-testbed-public
       D=fixtures/github/hosted
       mkdir -p "$D"
       RUNF='{total_count, workflow_runs: [.workflow_runs[] | {id, name, display_title, path, event, status, conclusion, created_at, updated_at, run_attempt, run_number, workflow_id, head_branch, head_sha}]}'
       gh api "repos/$R/actions/artifacts?per_page=3" > "$D/artifacts-page.json"
       gh api "repos/$R/actions/runs?per_page=3" --jq "$RUNF" > "$D/runs-page.json"
       gh api "repos/$R/actions/runs?status=in_progress&per_page=3" --jq "$RUNF" > "$D/runs-in-progress.json"
       gh api "repos/$R/git/ref/heads/master" > "$D/ref-heads-master.json"
       H=$(gh api "repos/$R/git/ref/heads/master" --jq .object.sha)
       gh api "repos/$R/git/commits/$H" --jq '{sha, url, tree, parents}' > "$D/git-commit-master.json"
       P=$(gh api "repos/$R/git/commits/$H" --jq '.parents[0].sha')
       gh api "repos/$R/compare/$P...$H" --jq '{status, ahead_by, behind_by, total_commits, files: [.files[] | {sha, filename, status, additions, deletions, changes}]}' > "$D/compare-parent-master.json"
       gh api "repos/$R/git/trees/$H:.github?recursive=1" > "$D/tree-master-github.json"
       gh api "repos/$R/contents/README.md?ref=master" > "$D/contents-readme.json"
       gh api "repos/$R/contents/.github?ref=master" > "$D/contents-github-directory.json"
       gh api "users/patch-steward-testbed%5Bbot%5D" > "$D/user-app-bot.json"
       date -u +%Y-%m-%d   (note the printed date for the README bullet)
    2. Insert this bullet into fixtures/README.md right after the `github/policy-directory/` bullet, replacing <DATE> with the date
       printed in action 1 (keep the line breaks as written):
       - `github/hosted/` — REST responses recorded read-only with `gh api` from the public test-bed repository
         `steady-orchard/patch-steward-testbed-public` on <DATE> for the hosted adapters: one page of the artifact listing, one
         page of the workflow run list and the in-progress run list (run items reduced to identifiers, name, display title, path,
         event, status, conclusion, timestamps, attempt, and head branch and commit), the `master` branch ref, its commit (reduced
         to the commit, tree, and parent ids and URLs), the comparison with its parent (reduced to status, counts, and per-file
         name, status, blob id, and line counts), the `.github` subtree read as `<commit>:.github`, the `README.md` contents
         response, the `.github` directory listing on the branch, and the App's bot user. Everything else is as served. Tests read
         them through the hosted adapters and check that no file matches a built-in credential detector; write responses, token
         responses, and artifact downloads are synthetic and built in test code.
       The em dash after the path is the same character the neighboring bullets use (copy it from the `github/policy-directory/`
       bullet line).
    3. Run: pnpm exec prettier --write fixtures/github/hosted fixtures/README.md
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. ls fixtures/github/hosted | sort | paste -sd ' ' -
       -> prints exactly: artifacts-page.json compare-parent-master.json contents-github-directory.json contents-readme.json git-commit-master.json ref-heads-master.json runs-in-progress.json runs-page.json tree-master-github.json user-app-bot.json
    2. node -e "const fs=require('fs');const d='fixtures/github/hosted/';const j=n=>JSON.parse(fs.readFileSync(d+n,'utf8'));const k=o=>Object.keys(o).sort().join();const bad=[];const a=j('artifacts-page.json');if(typeof a.total_count!=='number'||!Array.isArray(a.artifacts)||a.artifacts.length<1||!a.artifacts.every(x=>['id','name','created_at','expires_at','expired','workflow_run'].every(q=>q in x)))bad.push('artifacts');const RK='id,name,display_title,path,event,status,conclusion,created_at,updated_at,run_attempt,run_number,workflow_id,head_branch,head_sha'.split(',').sort().join();const r=j('runs-page.json');if(typeof r.total_count!=='number'||!Array.isArray(r.workflow_runs)||r.workflow_runs.length<1||!r.workflow_runs.every(x=>k(x)===RK))bad.push('runs');const p=j('runs-in-progress.json');if(typeof p.total_count!=='number'||!Array.isArray(p.workflow_runs)||!p.workflow_runs.every(x=>k(x)===RK))bad.push('in-progress');const f=j('ref-heads-master.json');if(!/^[0-9a-f]{40}$/.test(f.object&&f.object.sha))bad.push('ref');const c=j('git-commit-master.json');if(k(c)!=='parents,sha,tree,url')bad.push('commit');const m=j('compare-parent-master.json');if(k(m)!=='ahead_by,behind_by,files,status,total_commits'||!Array.isArray(m.files)||!m.files.every(x=>k(x)==='additions,changes,deletions,filename,sha,status'))bad.push('compare');const t=j('tree-master-github.json');if(!Array.isArray(t.tree)||t.truncated!==false)bad.push('tree');const e=j('contents-readme.json');if(e.type!=='file'||e.encoding!=='base64')bad.push('readme');const g=j('contents-github-directory.json');if(!Array.isArray(g)||g.length<1)bad.push('directory');const u=j('user-app-bot.json');if(u.id!==331019482||u.type!=='Bot'||u.login!=='patch-steward-testbed[bot]')bad.push('bot');console.log(bad.length?'BAD '+bad.join(','):'recordings ok')"
       -> prints exactly: recordings ok
    3. grep -rlE "[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+" fixtures/github/hosted
       -> prints nothing (grep exit status 1 is expected)
    4. grep -rlE "ghs_|ghp_|BEGIN [A-Z ]*PRIVATE KEY|sig=|STEWARD_APP_" fixtures/github/hosted
       -> prints nothing (grep exit status 1 is expected)
    5. pnpm vitest run packages/core/src/github/recorded-responses.fixture.test.ts -> exit 0
    6. pnpm exec prettier --check fixtures/github/hosted fixtures/README.md -> exit 0
    7. grep -c "github/hosted/" fixtures/README.md -> prints 1
    8. grep -cE "\bM0[0-9]\b|\bM1[0-9]\b|development-artifacts|\bPD0[1-8]\b" fixtures/README.md
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" fixtures/README.md fixtures/github/hosted/*.json
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes fixtures/github/hosted/ and the README bullet).
