# Step 4.7

- id: 4.7
- depends_on: []
- route: mechanical
- objective: Add three read-only scenario tools: scenarios/tools/find-runs.sh (runs of a workflow by display-title prefix), scenarios/tools/artifacts.sh (artifacts of one name with creation times), and scenarios/tools/audit.sh (observe-mode audit of scenario issues and pull requests).
- files_in_scope:
    - scenarios/tools/find-runs.sh
    - scenarios/tools/artifacts.sh
    - scenarios/tools/audit.sh
    - development-artifacts/patch-steward-m6-4.7-report.md
- context: |
    Repo root in Git Bash; run every command from your tree root. core.autocrlf=true (never anchor a grep with `$`). jq is NOT
    installed: use `gh ... --jq '<filter>'` (gh's built-in jq) or node. Git Bash runs CRLF scripts fine; the committed blobs are LF.

    scenarios/ is a new persistent directory (test-bed scenario suite for the GitHub-hosted steward; never runs in CI). Its files
    never mention planning identifiers (no milestone, phase, step, gate-item, or owner-action ids, no development-artifacts/) and
    never contain the probe suite's App secret names (the three names made of STEWARD_APP_ plus ID, PRIVATE_KEY, or CLIENT_ID
    without the PATCH_ prefix).

    Conventions for every tool (model them on probes/smoke/tools/wait-run.sh and probes/smoke/tools/steady-state.sh; read both):
    - First line `#!/usr/bin/env bash`; then a header comment: one-line purpose, `Usage:` line exactly as below, behavior, output
      line formats, exit codes. Invoked as `bash scenarios/tools/<name>.sh ...` from the repository root.
    - Only bash, gh, node, and coreutils (awk, sed, sort, tr, cut, wc, head, tail, tac). Never `set -x`. All three tools are
      READ-ONLY: only GET requests (`gh api` without -X, `gh run list`, `gh issue list`, `gh pr list`).
    - Every output line starts with the tool's prefix and uses key=value pairs. Usage errors print `usage: <name>.sh ...` to
      stderr and exit 2. A failed read prints `<PREFIX> error=<what>-failed` and exits 3 (find-runs: exit 1, see below).
    - Never print an issue or pull request title or body, a comment body, a token, or a secret. Counts, ids, states, timestamps,
      URLs, and run display titles (built by the workflows from numeric ids and event names) only.
    - Fixed ids: the test App's bot user id 331019482; the test App id 4993303.

    Tool 1: scenarios/tools/find-runs.sh (prefix RUN / RUNS)
      Usage: bash scenarios/tools/find-runs.sh <owner/repo> <workflow file name> <display title prefix>
      Reads `gh run list -R <r> --workflow <file> --limit 100 --json databaseId,attempt,event,status,conclusion,createdAt,url,displayTitle`
      (use a --jq filter emitting tab-separated fields; an empty or null conclusion becomes `none`), keeps runs whose
      displayTitle starts with the prefix (plain string prefix match in bash, e.g. `case "$title" in "$prefix"*)`; never build a
      jq program from the prefix), and prints them OLDEST first:
        RUN id=<databaseId> attempt=<attempt> event=<event> status=<status> conclusion=<conclusion or none> created_at=<createdAt> url=<url> title=<displayTitle>
      then `RUNS repo=<r> workflow=<file> count=<n>` and exit 0. When `gh run list` fails (for example the workflow file does not
      exist): `RUNS repo=<r> workflow=<file> error=list-failed` and exit 1.

    Tool 2: scenarios/tools/artifacts.sh (prefix ARTIFACT / ARTIFACTS)
      Usage: bash scenarios/tools/artifacts.sh <owner/repo> <artifact name>
      The name must match ^[A-Za-z0-9._-]{1,100}$ (else usage, exit 2). Reads
      `gh api "repos/<r>/actions/artifacts?name=<name>&per_page=100" --paginate --jq ...` and keeps items whose name equals the
      argument exactly; prints them sorted by created_at ascending (then id):
        ARTIFACT id=<id> name=<name> created_at=<created_at> expires_at=<expires_at> expired=<true|false> run_id=<workflow_run.id> size=<size_in_bytes>
      then `ARTIFACTS repo=<r> name=<name> count=<n> unexpired=<k>` and exit 0; a failed read -> `ARTIFACTS repo=<r> name=<name>
      error=list-failed`, exit 3.

    Tool 3: scenarios/tools/audit.sh (prefix AUDIT)
      Usage: bash scenarios/tools/audit.sh <owner/repo> [<title prefix>]
      Default title prefix `[scenario S`. Audits every issue (`gh issue list -R <r> --state all --limit 500 --json number,title`)
      and every pull request (`gh pr list -R <r> --state all --limit 500 --json number,title,headRefOid`) whose title starts
      with the prefix (prefix match on the title inside the tool; the title itself is never printed). Per item:
        app_comments = number of issue comments with user.id 331019482 (`gh api repos/<r>/issues/<n>/comments --paginate`)
        labels       = number of labels on the item (`gh api repos/<r>/issues/<n> --jq '.labels | length'`)
        pull requests only (issues print n/a):
          app_check_runs      = check runs on the head SHA with app.id 4993303 (`gh api repos/<r>/commits/<sha>/check-runs --paginate`)
          requested_reviewers = users plus teams in `gh api repos/<r>/pulls/<n>/requested_reviewers`
          head_deployments    = number of deployments for the head SHA (`gh api "repos/<r>/deployments?sha=<sha>&per_page=100" --jq length`)
      Lines (issues first by number, then pull requests by number):
        AUDIT repo=<r> kind=issue number=<n> app_comments=<a> labels=<l> app_check_runs=n/a requested_reviewers=n/a head_deployments=n/a
        AUDIT repo=<r> kind=pr number=<n> app_comments=<a> labels=<l> app_check_runs=<c> requested_reviewers=<v> head_deployments=<d>
      Final line: `AUDIT repo=<r> submissions=<issues+prs> app_comments=<sum> labels=<sum> app_check_runs=<sum over prs>
      requested_reviewers=<sum> head_deployments=<sum> result=clean` (exit 0) when every sum is 0, else the same with
      `result=writes-found` (exit 1). Any failed read -> `AUDIT repo=<r> error=read-failed`, exit 3.
- actions: |
    1. Write the three scripts per context.
    2. Run `bash -n` on each and fix syntax errors. Run the acceptance commands (all read-only).
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. for f in find-runs artifacts audit; do bash -n scenarios/tools/$f.sh && echo "$f syntax ok"; done
       -> prints exactly three lines: find-runs syntax ok, artifacts syntax ok, audit syntax ok
    2. for c in "find-runs.sh" "find-runs.sh steady-orchard/patch-steward-testbed-public probe-pa09-listen.yml" "artifacts.sh steady-orchard/patch-steward-testbed-public" "artifacts.sh steady-orchard/patch-steward-testbed-public bad/name" "audit.sh"; do bash scenarios/tools/$c > /dev/null 2>&1; echo "exit $?"; done
       -> prints exactly five lines, each: exit 2
    3. bash scenarios/tools/find-runs.sh steady-orchard/patch-steward-testbed-public probe-pa09-listen.yml 'probe-pa09 issues sub=29 ' > "${TMPDIR:-/tmp}/m6-runs.txt"; echo "exit $?"; node -e "const L=require('fs').readFileSync(process.argv[1],'utf8').trim().split('\n');const last=L[L.length-1];const m=/^RUNS repo=steady-orchard\/patch-steward-testbed-public workflow=probe-pa09-listen.yml count=([0-9]+)$/.exec(last);const runs=L.slice(0,-1);const ok=m&&Number(m[1])>=1&&runs.length===Number(m[1])&&runs.every(l=>/^RUN id=[0-9]+ attempt=[0-9]+ event=issues status=completed conclusion=[a-z_]+ created_at=\S+ url=https:\/\/github\.com\/\S+ title=probe-pa09 issues sub=29 /.test(l));const t=runs.map(l=>/created_at=(\S+)/.exec(l)[1]);console.log(ok&&t.every((x,i)=>i===0||t[i-1]<=x)?'runs ok':'runs wrong')" "${TMPDIR:-/tmp}/m6-runs.txt"; rm -f "${TMPDIR:-/tmp}/m6-runs.txt"
       -> prints exactly two lines: exit 0, then runs ok
    4. bash scenarios/tools/find-runs.sh steady-orchard/patch-steward-testbed-public no-such-workflow.yml 'x'; echo "exit $?"
       -> prints exactly two lines: RUNS repo=steady-orchard/patch-steward-testbed-public workflow=no-such-workflow.yml error=list-failed, then exit 1
    5. bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public probe-pa02-retention-90; echo "exit $?"
       -> prints exactly three lines: a line starting `ARTIFACT id=` and containing ` name=probe-pa02-retention-90 created_at=2026-09-25T01:26:11Z ` and ` expired=false `, then `ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=probe-pa02-retention-90 count=1 unexpired=1`, then `exit 0`
    6. bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public; echo "exit $?"
       -> prints exactly two lines: AUDIT repo=steady-orchard/patch-steward-testbed-public submissions=0 app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 result=clean, then exit 0
    7. bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public '[probe PA07]' > "${TMPDIR:-/tmp}/m6-audit.txt"; echo "exit $?"; grep -c -E '^AUDIT repo=steady-orchard/patch-steward-testbed-public kind=(issue|pr) number=[0-9]+ ' "${TMPDIR:-/tmp}/m6-audit.txt"; tail -1 "${TMPDIR:-/tmp}/m6-audit.txt" | grep -c -E '^AUDIT repo=steady-orchard/patch-steward-testbed-public submissions=9 app_comments=[0-9]+ labels=[1-9][0-9]* app_check_runs=[0-9]+ requested_reviewers=[0-9]+ head_deployments=[0-9]+ result=writes-found'; rm -f "${TMPDIR:-/tmp}/m6-audit.txt"
       -> prints exactly three lines: exit 1, then 9, then 1
    8. git grep --untracked -n -E -e ' -X ' -e 'issue (close|delete|edit|create|comment)' -e 'pr (close|edit|create|comment|merge)' -e 'set -x' -e 'auth token' -e '\.body' -- scenarios/tools/find-runs.sh scenarios/tools/artifacts.sh scenarios/tools/audit.sh
       -> no output (exit 1)
    9. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' -- scenarios/tools/find-runs.sh scenarios/tools/artifacts.sh scenarios/tools/audit.sh
       -> no output (exit 1)
    10. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/tools/find-runs.sh scenarios/tools/artifacts.sh scenarios/tools/audit.sh
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the three scripts; they write nothing).
