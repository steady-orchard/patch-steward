# Step 5.29

- id: 5.29
- depends_on: []
- route: mechanical
- objective: Make scenarios/tools/audit.sh list every deployment on a scenario pull request head and classify it: deployments GitHub Actions created for the publication Environment for an allowlisted sender before the current wrappers were deployed are reported separately as before-fix (recorded, not counted); every other deployment is counted as a write.
- files_in_scope:
    - scenarios/tools/audit.sh
    - development-artifacts/patch-steward-m6-5.29-report.md
- context: |
    Git Bash; run every command from your tree root. core.autocrlf=true (Git Bash runs CRLF scripts). jq is NOT installed.
    gh is logged in as jambolo. `gh api` endpoints never start with `/`. Never print a token or secret. Never run a
    formatter on development-artifacts/. This step makes NO GitHub write; acceptance makes read-only requests to the
    test-beds (check `gh api rate_limit --jq .resources.core.remaining` >= 500 first).

    scenarios/tools/audit.sh <owner/repo> [<title prefix>] (read-only) audits every issue and pull request titled
    `[scenario S...`: per item an `AUDIT repo=<r> kind=issue|pr number=<n> app_comments=<a> labels=<l> app_check_runs=<c>
    requested_reviewers=<v> head_deployments=<d>` line (issues print n/a for the last three), then a summary
    `AUDIT repo=<r> submissions=<n> app_comments=... labels=... app_check_runs=... requested_reviewers=... head_deployments=<sum> result=clean|writes-found`
    (exit 0 clean, 1 writes-found, 2 usage, 3 read failure). Today head_deployments is the plain count of
    `gh api "repos/<r>/deployments?sha=<head sha>&per_page=100"`.

    Facts (org-public test-bed steady-orchard/patch-steward-testbed-public, measured): while the reusable workflow's
    publication jobs declared `environment: steward-publication` (plain form), GitHub Actions created one Deployment per
    Environment job of each pull_request_target run, on the pull request head: pull requests 32: 2, 33: 2, 34: 28, 36: 4,
    37: 4 (40 in total), environment steward-publication, creator jambolo (user id 2095171) or patch-steward-testbed[bot]
    (user id 331019482), all created on 2026-09-28 before 12:26 UTC. They are platform records, never deleted. The
    publication jobs now declare `deployment: false` and create none; the wrappers pinning that version are deployed later
    (a later step). The current wrappers' deployment time on a test-bed = committer date of the newest `master` commit that
    changed `.github/workflows/steward-pr.yml`
    (`gh api "repos/<r>/commits?sha=master&path=.github/workflows/steward-pr.yml&per_page=1" --jq '.[0].commit.committer.date'`;
    today on org-public 2026-09-28T08:25:46Z, which is before all 40, so today all 40 count).

    New rule (binding): a deployment on a scenario pull request head is `before-fix` when ALL hold: environment is
    `steward-publication`; creator id is 2095171 or 331019482; its created_at is strictly earlier than the wrappers'
    deployment time T. Otherwise it is `counted`. head_deployments counts only `counted`; a new
    `before_fix_deployments=<b>` field counts `before-fix`; result=clean ignores before-fix deployments. T comes from the
    commit history above (`source=history`; `none` when no such commit, then nothing is before-fix) or from the optional
    environment variable AUDIT_WRAPPERS_DEPLOYED_AT=<YYYY-MM-DDTHH:MM:SSZ> (`source=override`; any other format is a usage
    error, exit 2). Times compare as the 14 digits of the timestamp.
    New output (exact formats):
      first line:   AUDIT repo=<r> wrappers_deployed_at=<T or none> source=<history|override>
      issue lines:  ... head_deployments=n/a before_fix_deployments=n/a
      pr lines:     ... head_deployments=<counted> before_fix_deployments=<before-fix>
      right after each pr line, one line per deployment on its head (API order):
                    AUDIT-DEPLOYMENT repo=<r> pr=<n> id=<id> environment=<env> ref=<ref> creator=<login> created_at=<t> class=before-fix|counted
      summary (last line): AUDIT repo=<r> submissions=<n> app_comments=<a> labels=<l> app_check_runs=<c> requested_reviewers=<v> head_deployments=<counted sum> before_fix_deployments=<before-fix sum> result=clean|writes-found
- actions: |
    Verbatim blocks below sit between a line `BLOCK <name> BEGIN` and a line `BLOCK <name> END`; every line inside
    carries exactly 8 spaces of packet indentation that is NOT part of the code (remove exactly 8 spaces per line).
    1. Insert, right after the line `prefix="${2:-[scenario S}"` and one blank line:
    BLOCK cutoff BEGIN
        if [ -n "${AUDIT_WRAPPERS_DEPLOYED_AT:-}" ]; then
          if ! [[ "$AUDIT_WRAPPERS_DEPLOYED_AT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; then
            echo "usage: AUDIT_WRAPPERS_DEPLOYED_AT must be a UTC time YYYY-MM-DDTHH:MM:SSZ" >&2
            exit 2
          fi
          deployed_at="$AUDIT_WRAPPERS_DEPLOYED_AT"
          deployed_source=override
        else
          deployed_at="$(gh api "repos/$repo/commits?sha=master&path=.github/workflows/steward-pr.yml&per_page=1" --jq '.[0].commit.committer.date // empty' 2>/dev/null)"
          if [ $? -ne 0 ]; then
            echo "AUDIT repo=$repo error=read-failed"
            exit 3
          fi
          [ -n "$deployed_at" ] || deployed_at=none
          deployed_source=history
        fi
    BLOCK cutoff END
    2. After the line `sum_deployments=0` add the line `sum_before_fix=0`, then a blank line, then the line
       `echo "AUDIT repo=$repo wrappers_deployed_at=$deployed_at source=$deployed_source"` (so it prints before any item line).
    3. In the issue line (`echo "AUDIT repo=$repo kind=issue ...`) append ` before_fix_deployments=n/a` after
       `head_deployments=n/a`.
    4. In the pull request loop replace the `deployments="$(gh api "repos/$repo/deployments?sha=$sha&per_page=100" --jq 'length' 2>/dev/null)"`
       line and the `if [ $? -ne 0 ]; then ... fi` block right after it with:
    BLOCK deployments BEGIN
          deployment_rows="$(gh api "repos/$repo/deployments?sha=$sha&per_page=100" --paginate \
            --jq '.[] | [(.id|tostring), .environment, .ref, (.creator.id|tostring), .creator.login, .created_at] | @tsv' 2>/dev/null)"
          if [ $? -ne 0 ]; then
            echo "AUDIT repo=$repo error=read-failed"
            exit 3
          fi
          deployments=0
          before_fix=0
          deployment_lines=""
          while IFS=$'\t' read -r d_id d_env d_ref d_creator_id d_creator d_created; do
            [ -n "$d_id" ] || continue
            d_num="${d_created//[!0-9]/}"
            f_num="${deployed_at//[!0-9]/}"
            class=counted
            if [ "$d_env" = steward-publication ] && { [ "$d_creator_id" = 2095171 ] || [ "$d_creator_id" = 331019482 ]; } \
              && [ "$deployed_at" != none ] && [[ "$d_num" =~ ^[0-9]{14}$ ]] && [ "$d_num" -lt "$f_num" ]; then
              class=before-fix
              before_fix=$((before_fix + 1))
            else
              deployments=$((deployments + 1))
            fi
            deployment_lines+="AUDIT-DEPLOYMENT repo=$repo pr=$n id=$d_id environment=$d_env ref=$d_ref creator=$d_creator created_at=$d_created class=$class"$'\n'
          done <<< "$deployment_rows"
    BLOCK deployments END
    5. In the same loop: after `sum_deployments=$((sum_deployments + deployments))` add `  sum_before_fix=$((sum_before_fix + before_fix))`;
       append ` before_fix_deployments=$before_fix` after `head_deployments=$deployments` in the pull request echo line; right
       after that echo add the line `  printf '%s' "$deployment_lines"`.
    6. In the summary echo append ` before_fix_deployments=$sum_before_fix` after `head_deployments=$sum_deployments` (before
       ` result=`). The result rule stays: clean only when app_comments, labels, app_check_runs, requested_reviewers, and
       head_deployments sums are 0.
    7. Update the header comment (no planning ids, factual): the first line, the new field, the AUDIT-DEPLOYMENT lines, the
       before-fix rule (publication Environment, allowlisted creator 2095171 or the test App's bot 331019482, created before
       the current wrappers' deployment time from master's history of .github/workflows/steward-pr.yml or
       AUDIT_WRAPPERS_DEPLOYED_AT), and that before-fix deployments never change the result.
    8. bash -n scenarios/tools/audit.sh must print nothing; then run the acceptance commands.
- acceptance: |
    Run each from the tree root in Git Bash (read-only GitHub requests); each must give exactly the stated result.
    1. bash -n scenarios/tools/audit.sh; echo "syntax $?"
       -> prints exactly: syntax 0
    2. AUDIT_WRAPPERS_DEPLOYED_AT=2026-09-28T16:00:00Z bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public | node -e 'const L=require("fs").readFileSync(0,"utf8").replace(/\r/g,"").split("\n").filter(Boolean);const R="steady-orchard/patch-steward-testbed-public";const want={32:2,33:2,34:28,36:4,37:4};const bad=[];if(L[0]!=="AUDIT repo="+R+" wrappers_deployed_at=2026-09-28T16:00:00Z source=override")bad.push("first");for(const [n,c] of Object.entries(want)){if(!L.some(l=>new RegExp("^AUDIT repo="+R+" kind=pr number="+n+" app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 before_fix_deployments="+c+"$").test(l)))bad.push("pr"+n)}const D=L.filter(l=>l.startsWith("AUDIT-DEPLOYMENT "));const okD=D.filter(l=>/^AUDIT-DEPLOYMENT repo=\S+ pr=(32|33|34|36|37) id=[0-9]+ environment=steward-publication ref=\S+ creator=(jambolo|patch-steward-testbed\[bot\]) created_at=2026-09-28T(0[0-9]|1[0-5]):[0-9]{2}:[0-9]{2}Z class=before-fix$/.test(l));if(D.length!==40||okD.length!==40)bad.push("deployments "+D.length+"/"+okD.length);if(!/^AUDIT repo=\S+ submissions=[0-9]+ app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 before_fix_deployments=40 result=clean$/.test(L[L.length-1]))bad.push("summary");console.log(bad.length?"split wrong "+bad.join(","):"late cutoff ok")'
       -> prints exactly: late cutoff ok
    3. T=$(mktemp); AUDIT_WRAPPERS_DEPLOYED_AT=2026-09-28T08:00:00Z bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public > "$T"; echo "exit $?"; grep -c -E '^AUDIT-DEPLOYMENT .* environment=steward-publication .* class=counted$' "$T"; tail -n 1 "$T" | grep -c -E '^AUDIT repo=steady-orchard/patch-steward-testbed-public submissions=[0-9]+ app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=40 before_fix_deployments=0 result=writes-found$'; rm -f "$T"
       -> prints exactly three lines: exit 1, 40, 1
    4. AUDIT_WRAPPERS_DEPLOYED_AT=2026-09-28 bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public > /dev/null 2>&1; echo "exit $?"
       -> prints exactly: exit 2
    5. bash scenarios/tools/audit.sh jambolo/patch-steward-testbed-personal | node -e 'const L=require("fs").readFileSync(0,"utf8").replace(/\r/g,"").split("\n").filter(Boolean);const R="jambolo/patch-steward-testbed-personal";const ok=new RegExp("^AUDIT repo="+R+" wrappers_deployed_at=[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z source=history$").test(L[0])&&L.slice(1,-1).every(l=>/ kind=issue .* head_deployments=n\/a before_fix_deployments=n\/a$/.test(l))&&new RegExp("^AUDIT repo="+R+" submissions=[1-9][0-9]* app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 before_fix_deployments=0 result=clean$").test(L[L.length-1]);console.log(ok?"history cutoff ok":"history cutoff wrong")'
       -> prints exactly: history cutoff ok
    6. git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|owner decision|\bD7\b' -- scenarios/tools/audit.sh; echo "exit $?"
       -> prints exactly: exit 1
- rollback: |
    git revert <this step's commit> (tool only; nothing was written to GitHub).
