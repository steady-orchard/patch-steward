# Step 5.37

- id: 5.37
- depends_on: [5.34, 5.33]
- route: mechanical
- objective: Scenario S13 post-fix pull request on org-public: with only steward-pr.yml enabled, open `[scenario S13] post-fix deployment check` from a new branch scenario-s13-head, wait for its run, edit the body once, wait for the second run, disable steward-pr.yml again, and prove both runs used the fixed pin with gate and publish successful and that the pull request head has no Deployment; record the section in scenarios/results/org-public.md.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.37-report.md
- context: |
    ENVIRONMENT. Git Bash; run every command from your tree root. jq is NOT installed (use `gh --jq` or node).
    core.autocrlf=true (strip CR before comparing text). gh is logged in as jambolo (user id 2095171). `gh api` endpoints
    never start with `/` (Git Bash rewrites them). The Bash tool call times out at 600 s: run every waiting tool with
    `PROBE_WAIT_SECONDS=540` in front and, when it exits 3 (still waiting), run the same call once more; a second exit 3 is
    a failure (at most 15 min per run). Poll no faster than every 20 s. Before every GitHub write check
    `gh api rate_limit --jq .resources.core.remaining` prints a number >= 500 (else STOP, status fail). Never print, log, or
    store a token, key, or secret (never `gh auth token`, never `set -x`). Never run a formatter on development-artifacts/.
    GitHub writes allowed in this step (R only): creating branch `scenario-s13-head` with probes/smoke/tools/deploy.sh (one
    commit adding `scenario-s13.txt`; never master), `gh workflow enable steward-pr.yml -R R`, ONE `gh pr create`, ONE
    `gh pr edit --body`, `gh workflow disable steward-pr.yml -R R`. Never enable any other workflow; never close, merge,
    or delete the pull request (the steady-state step closes it with every workflow disabled, so no third run starts);
    never delete a branch, issue, Deployment, or file; never touch `.github/workflows/scenario-deployment-probe.yml` or
    branch `scenario-deployment-probe`; never rerun a workflow; never touch issue 29 or pull requests 26 and 27.
    On any unexpected result: FIRST `gh workflow disable steward-pr.yml -R R` (if you enabled it), then collect the
    evidence named in actions, write the results section with `Result: fail`, set report status fail, and STOP (no
    improvised retries or repairs). If a pull request titled `[scenario S13] post-fix deployment check` or a branch
    `scenario-s13-head` already exists when you start, STOP with status fail and report its number or the branch (never
    open a second one).

    R = steady-orchard/patch-steward-testbed-public (org-public; default branch master; trusted policy all observe;
    evidence store = orphan branch `steward-evidence` of R). State before this step: every steward and scenario workflow
    on R is `disabled_manually`; master holds the wrappers pinned to PIN (files changed in step 5.32; PIN = the SHA after
    `steward-screening.yml@` in scenarios/workflows/steward-pr.yml), whose reusable workflow declares the publication
    Environment with `deployment: false` in gate and publish. Before PIN, every Environment job of a pull_request_target
    run left one Deployment on the pull request head (2 per run); the pass condition here is 0.
    The body scenarios/fixtures/submissions/unstructured.txt follows no template: disposition early-exit, outcome
    needs-changes, no cap evaluation. Run 1 (event `opened`): gate `listing none`, `dedup commit no-owner`,
    `disposition early-exit`; publish `evidence commit <sha> rebuilds <n>`, `freshness current`. Run 2 (event `edited`,
    body changed): gate `listing unique owner <run 1>-1`, `dedup commit snapshot-changed`, `disposition early-exit`;
    publish `freshness current`.
    Scenario S13 post-fix pass: the pull request has exactly two wrapper runs (display titles starting
    `steward pr <P> author `), each run's referenced reusable workflow is
    `steady-orchard/patch-steward/.github/workflows/steward-screening.yml@<PIN>` (runs API field `referenced_workflows`),
    each has jobs `screen / build`, `screen / gate`, `screen / publish` all `success`; the head SHA has 0 Deployments; and
    R has 0 steward-publication Deployments created at or after run 1's created_at.

    HOSTED RUN SHAPE. Display title: `steward pr <n> author <author id> event pull_request_target <action> sender <sender
    id> User`. Jobs check: `gh run view <id> -R R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'`.
    Newest run id of R (record it BEFORE triggering an event): `gh api "repos/R/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'`.
    TOOLS (scenarios/tools/*.sh; read-only): await-runs.sh <repo> <workflow file> <title prefix> <after run id> <min count>
    (prints RUN lines `RUN id=<id> attempt=<a> event=<e> status=<s> conclusion=<c> created_at=<t> url=<u> title=<t>`, then
    `AWAIT ... result=complete` exit 0 or `result=timeout` exit 3); find-runs.sh <repo> <workflow file> <title prefix>
    (RUN lines oldest first, then `RUNS ... count=<n>`); run-log.sh <repo> <run id> <attempt> <gate|publish>
    (`LOG job=<job> ts=<t> text=<text>` lines, then `LOGS ...`); run-records.sh runs <store repo> steward-evidence <target
    repo> pr <n> (`RECORD run=<run>-<attempt> kind=outcome outcome=<o> ...` lines, then `RECORDS ... runs=<n>
    supersessions=<m>`); results-check.sh <file> <ids...> (last line `RESULTS-CHECK file=<file> result=pass`).

    RESULTS FILE scenarios/results/org-public.md (persistent, Prettier-checked; exists): APPEND one section at the end;
    never change existing text:
      `## S13 post-fix pull request leaves no deployment`
      blank line; `Date (UTC): <YYYY-MM-DD>.` plus two or three sentences: the publication jobs now declare the
      Environment with `deployment: false` (reusable workflow commit PIN); the pull request URL
      https://github.com/R/pull/<P>; both run URLs https://github.com/R/actions/runs/<id>;
      one ```text fence per command group of actions 5-12 (a line `$ <command>` then its verbatim output; for run-log keep
      only the lines the grep in actions selects);
      blank line; `Result: pass` (or `Result: fail`, with one sentence why just above it).
    Forbidden anywhere in the file: planning identifiers (milestone, phase, step, gate-item, owner-action or rule ids; the
    words "owner decision"; `development-artifacts`), the probe suite's App secret names (STEWARD_APP_ + ID, PRIVATE_KEY,
    or CLIENT_ID without the PATCH_ prefix), `ghs_`, `ghp_`, `-----BEGIN`, the two characters `^[`, raw control
    characters.
- actions: |
    1. Base check (files changed in steps 5.33 and 5.34): bash -c 'grep -q "^s17_postfix_run: [0-9]" development-artifacts/patch-steward-m6-5.34-report.md 2>/dev/null || echo "MISSING 5.34 report"; [ "$(grep -c "^## S17 " scenarios/results/org-public.md)" = 2 ] || echo "MISSING post-fix S17"; p=$(tr -d "\r" < scenarios/workflows/steward-pr.yml | grep -oE "steward-screening\.yml@[0-9a-f]{40}" | cut -d@ -f2); d=$(gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github/workflows/steward-pr.yml?ref=master" --jq .sha 2>/dev/null); [ "$d" = "$(git rev-parse HEAD:scenarios/workflows/steward-pr.yml)" ] || echo "MISSING deployed wrapper"; [ "$(git show "$p:.github/workflows/steward-screening.yml" 2>/dev/null | tr -d "\r" | grep -c -x "      deployment: false")" = 2 ] || echo "MISSING fixed pin $p"; for f in scenarios/tools/await-runs.sh scenarios/tools/run-log.sh scenarios/tools/run-records.sh scenarios/fixtures/submissions/unstructured.txt; do [ -f "$f" ] || echo "MISSING $f"; done; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge,
       or improvise). (If `git show` of the pin fails locally, run `git fetch origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish` once and repeat the check.)
    2. pnpm install --frozen-lockfile && pnpm build. Then: bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-public
       Record the output verbatim in a report section `## OA1 verify (org-public)`. The last line must be
       `ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public result=ok` (else STOP before any write; status fail;
       report line `OA1 not done on steady-orchard/patch-steward-testbed-public: <first MISMATCH line>`).
       Rate limit >= 500. Pre-state (read-only; record): `gh api "repos/steady-orchard/patch-steward-testbed-public/actions/workflows/steward-pr.yml" --jq .state`
       (expected `disabled_manually`); `gh api repos/steady-orchard/patch-steward-testbed-public/branches/scenario-s13-head --jq .name`
       (expected an HTTP 404 error); `gh pr list -R steady-orchard/patch-steward-testbed-public --state all --search "post-fix deployment check in:title" --json number --jq length`
       (expected 0).
    3. bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public scenario-s13-head "scenario: S13 pull request change" scenarios/fixtures/submissions/unstructured.txt:scenario-s13.txt
    4. gh workflow enable steward-pr.yml -R steady-orchard/patch-steward-testbed-public; then
       `gh api "repos/steady-orchard/patch-steward-testbed-public/actions/workflows/steward-pr.yml" --jq .state` must print `active`.
    5. Run 1:
       a. A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
       b. gh pr create -R steady-orchard/patch-steward-testbed-public --base master --head scenario-s13-head --title "[scenario S13] post-fix deployment check" --body-file scenarios/fixtures/submissions/unstructured.txt
          (exactly once; P = the number at the end of the printed URL)
       c. PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr P author 2095171 event pull_request_target opened sender 2095171 User" "$A" 1
          (repeat once on exit 3). RUN1 = its run id.
       d. gh run view RUN1 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
       e. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public RUN1 1 gate | grep -E 'text=(event |policy |listing |dedup |disposition )'
       f. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public RUN1 1 publish | grep -E 'text=(policy |evidence commit |freshness )'
    6. Run 2 (only after RUN1 completed):
       a. A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
       b. BASE="$(tr -d '\r' < scenarios/fixtures/submissions/unstructured.txt)"; gh pr edit P -R steady-orchard/patch-steward-testbed-public --body "$(printf '%s\n\nScenario body edit: S13 post-fix check.\n' "$BASE")"
       c. PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr P author 2095171 event pull_request_target edited sender 2095171 User" "$A" 1
          (repeat once on exit 3). RUN2 = its run id.
       d, e, f: as 5d-5f for RUN2.
    7. Immediately: gh workflow disable steward-pr.yml -R steady-orchard/patch-steward-testbed-public; then
       `gh api "repos/steady-orchard/patch-steward-testbed-public/actions/workflows/steward-pr.yml" --jq .state` must print `disabled_manually`.
    8. bash scenarios/tools/find-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr P author "
       (expected exactly RUN1 and RUN2, `RUNS ... count=2`)
    9. for id in RUN1 RUN2; do gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs/$id" --jq '(.id|tostring) + " " + ([.referenced_workflows[].path] | join(","))'; done
       (expected each `<id> steady-orchard/patch-steward/.github/workflows/steward-screening.yml@<PIN>`)
    10. H=$(gh pr view P -R steady-orchard/patch-steward-testbed-public --json headRefOid --jq .headRefOid); echo "head $H"; gh api "repos/steady-orchard/patch-steward-testbed-public/deployments?sha=$H&per_page=100" --jq length
        (expected `0`)
    11. T=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs/RUN1" --jq .created_at); n=$(gh api "repos/steady-orchard/patch-steward-testbed-public/deployments?environment=steward-publication&per_page=100" --paginate --jq ".[] | select(.created_at >= \"$T\") | .id" | wc -l | tr -d ' '); echo "DEPLOYMENTS repo=steady-orchard/patch-steward-testbed-public environment=steward-publication since=$T count=$n"
        (expected `... count=0`)
    12. bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr P
        (expected two outcome run directories RUN1-1 and RUN2-1, needs-changes, `... runs=2 supersessions=0`)
    13. Append the section per context; `pnpm exec prettier --write scenarios/results/org-public.md`; then
        bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S13 S17
    14. Leave the pull request OPEN. Report: at column 0 the lines `s13_pr: <P>`, `s13_run1: <RUN1>`, `s13_run2: <RUN2>`,
        `s13_head: <H>`, `pin: <PIN>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.37-report.md","utf8");const ok=[/^s13_pr: [0-9]+\s*$/m,/^s13_run1: [0-9]+\s*$/m,/^s13_run2: [0-9]+\s*$/m,/^s13_head: [0-9a-f]{40}\s*$/m,/^pin: [0-9a-f]{40}\s*$/m].every(r=>r.test(s))&&!s.includes("OA1 not done");console.log(ok?"report ok":"report incomplete")'
       -> prints exactly: report ok
    2. R=steady-orchard/patch-steward-testbed-public; P=$(grep -m1 -o '^s13_pr: [0-9]*' development-artifacts/patch-steward-m6-5.37-report.md | cut -d' ' -f2); PIN=$(tr -d '\r' < scenarios/workflows/steward-pr.yml | grep -oE 'steward-screening\.yml@[0-9a-f]{40}' | cut -d@ -f2); ids=$(gh api "repos/$R/actions/workflows/steward-pr.yml/runs?per_page=100" --paginate --jq ".workflow_runs[] | select(.display_title | startswith(\"steward pr $P author \")) | .id"); runs=0; pinned=0; ok=0; for id in $ids; do runs=$((runs+1)); [ "$(gh api repos/$R/actions/runs/$id --jq '[.referenced_workflows[].path] | join(",")')" = "steady-orchard/patch-steward/.github/workflows/steward-screening.yml@$PIN" ] && pinned=$((pinned+1)); [ "$(gh run view $id -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")')" = "screen / build=success,screen / gate=success,screen / publish=success" ] && ok=$((ok+1)); done; H=$(gh pr view $P -R $R --json headRefOid --jq .headRefOid); d=$(gh api "repos/$R/deployments?sha=$H&per_page=100" --jq length); echo "s13 post-fix runs=$runs pinned=$pinned jobs-success=$ok head_deployments=$d"
       -> prints exactly: s13 post-fix runs=2 pinned=2 jobs-success=2 head_deployments=0
    3. f=development-artifacts/patch-steward-m6-5.37-report.md; R=steady-orchard/patch-steward-testbed-public; r1=$(grep -m1 -o '^s13_run1: [0-9]*' $f | cut -d' ' -f2); r2=$(grep -m1 -o '^s13_run2: [0-9]*' $f | cut -d' ' -f2); bash scenarios/tools/run-log.sh $R $r1 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(listing none|dedup commit no-owner|disposition early-exit)$'; bash scenarios/tools/run-log.sh $R $r2 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(listing unique owner $r1-1|dedup commit snapshot-changed|disposition early-exit)\$"; for r in $r1 $r2; do bash scenarios/tools/run-log.sh $R $r 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=freshness current$'; done
       -> prints exactly four lines: 3, 3, 1, 1
    4. R=steady-orchard/patch-steward-testbed-public; r1=$(grep -m1 -o '^s13_run1: [0-9]*' development-artifacts/patch-steward-m6-5.37-report.md | cut -d' ' -f2); T=$(gh api "repos/$R/actions/runs/$r1" --jq .created_at); gh api "repos/$R/deployments?environment=steward-publication&per_page=100" --paginate --jq ".[] | select(.created_at >= \"$T\") | .id" | wc -l | tr -d ' '; gh api "repos/$R/actions/workflows/steward-pr.yml" --jq .state
       -> prints exactly two lines: 0, disabled_manually
    5. f=development-artifacts/patch-steward-m6-5.37-report.md; R=steady-orchard/patch-steward-testbed-public; P=$(grep -m1 -o '^s13_pr: [0-9]*' $f | cut -d' ' -f2); bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $P | grep -c -E "^RECORD run=[0-9]+-1 kind=outcome outcome=needs-changes |^RECORDS .* subject=pr-$P runs=2 supersessions=0\$"
       -> prints exactly: 3
    6. node -e 'const t=require("fs").readFileSync("scenarios/results/org-public.md","utf8").replace(/\r/g,"");const secs=t.split(/^(?=## )/m).filter(s=>s.startsWith("## S13 post-fix pull request leaves no deployment\n"));const p=secs[0]||"";const L=p.split("\n");const ok=secs.length===1&&L.includes("Result: pass")&&L.some(l=>/^DEPLOYMENTS repo=steady-orchard\/patch-steward-testbed-public environment=steward-publication since=[^ ]+ count=0$/.test(l))&&L.some(l=>/^RUNS .* count=2$/.test(l))&&L.filter(l=>/^[0-9]+ steady-orchard\/patch-steward\/\.github\/workflows\/steward-screening\.yml@[0-9a-f]{40}$/.test(l)).length===2;console.log(ok?"s13 section ok":"s13 section incomplete")'
       -> prints exactly: s13 section ok
    7. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S13 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (results section only). Test-bed effects stay (branch scenario-s13-head, the open pull
    request, its two runs, two evidence commits on the append-only store); steward-pr.yml stays disabled.
