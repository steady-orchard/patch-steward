# Step 5.10

- id: 5.10
- depends_on: [5.7, 5.1, 5.2, 5.5]
- route: mechanical
- objective: Scenario S09 on org-public: a same-repository pull request and a fork pull request that both change .github/workflows/steward-pr.yml and .github/patch-steward/policy.yml are screened under the default-branch workflow definition and the trusted default-branch policy; record the evidence in scenarios/results/org-public.md.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.10-report.md
- context: |
    ENVIRONMENT. Git Bash; run every command from your tree root. jq is NOT installed (use `gh --jq` or node).
    core.autocrlf=true (strip CR before comparing text). gh is logged in as jambolo (user id 2095171). `gh api` endpoints
    never start with `/` (Git Bash rewrites them). The Bash tool call times out at 600 s: run every waiting tool with
    `PROBE_WAIT_SECONDS=540` in front and, when it exits 3 (still waiting), run the same call once more; a second exit 3 is
    a failure (at most 15 min per run). Poll no faster than every 20 s. Before every GitHub write check
    `gh api rate_limit --jq .resources.core.remaining` prints a number >= 500 (else STOP, status fail). Never print, log, or
    store a token, key, or secret (never `gh auth token`, never `set -x`). Never run a formatter on development-artifacts/.
    GitHub writes allowed in this step: ONLY the commands written in actions, on the named test-bed. Never write a
    test-bed's master except through the deploy tools named in actions; never delete an issue, pull request, branch, or
    repository; never touch org-public issue 29 or pull requests 26 and 27; never rerun a workflow unless actions say so.
    On any unexpected result: collect the evidence named in actions, record it, write the results section with
    `Result: fail`, set report status fail, and STOP (no improvised retries or repairs).

    TEST-BED R = steady-orchard/patch-steward-testbed-public (org-public; public; default branch master). Its master holds
    the wrappers `.github/workflows/steward-pr.yml` (name `steward-pr`) and `steward-issues.yml`, and the trusted policy
    `.github/patch-steward/policy.yml` (all observe; evidence store = orphan branch `steward-evidence` of R; daily run cap
    50, per-author concurrent cap 2). The policy revision M = the git tree id of `.github/patch-steward/` on master:
      gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
    FORK F = jambolo/patch-steward-testbed-public: your public fork of R, used only as a pull-request head; its master has no
    `.github` directory and must stay untouched (live tests read it); App not installed, no workflow runs there.

    Scenario S09 (a pull request that edits the wrapper and the policy is screened under the default-branch definitions and
    the trusted policy). Both pull requests commit two files on a scenario branch created from their repository's master by
    probes/smoke/tools/deploy.sh (it clones over SSH, creates the branch, commits once, pushes without force, and prints
    `DEPLOY identical dest=<path> blob=<id>` per file):
      scenarios/fixtures/pull-requests/steward-pr-modified.yml -> .github/workflows/steward-pr.yml (workflow name
        `steward-pr-modified-by-pull-request`, run-name `modified steward pr <n>`: a run using THIS definition would be named
        that way);
      scenarios/fixtures/policies/caps-daily.yml -> .github/patch-steward/policy.yml (daily cap 1: if it governed, the run
        would be queued).
    Body fixtures/submissions/pr-chore.txt: a structured chore pull request; with these changes its contract is met, with
    findings `submission.policy-change` and `submission.trusted-path-change`, so the run is runnable, caps are evaluated,
    and the outcome is `inconclusive` (no screening stage exists yet). Caps: the daily cap counts every non-bot steward
    wrapper run created today (UTC) on R and the per-author cap counts queued or in-progress runs by author 2095171 including
    this one: run the two pull requests strictly one after the other and trigger nothing else on R meanwhile.
    Pass condition, for EACH of the two runs: run name `steward-pr`, path `.github/workflows/steward-pr.yml`, event
    `pull_request_target`, display title `steward pr <n> author 2095171 event pull_request_target opened sender 2095171 User`;
    jobs build, gate, publish success; gate lines `policy trusted-branch revision <M>`, `caps within ...`,
    `disposition runnable`; publish `freshness current` and summary `- Status: `inconclusive``; the run's evidence record
    `RECORD run=<run>-1 kind=outcome outcome=inconclusive ... policy_revision=<M> ... findings=` listing both codes; and the
    head branch's policy tree id differs from M.

    HOSTED RUN SHAPE (observe mode, contract level). Every submission event on a test-bed starts one wrapper run with jobs
    `screen / build`, `screen / gate`, `screen / publish`; check with
    `gh run view <id> -R <repo> --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'`. Display title:
    `steward <pr|issue> <n> author <author id> event <pull_request_target|issues> <action> sender <sender id> <User|Bot>`.
    The wrappers run only when the event sender is 2095171 (you) or the test App's bot user 331019482.
    gate: loads the trusted policy of master, lists the submission's ownership artifacts (name
    `steward-ownership-<pr|issue>-<n>`), captures the submission LIVE (the title is not part of the snapshot; the body and the
    policy revision are), then either keeps the newest owner (duplicate: nothing committed, publish job skipped), commits a
    new owner (uploads an ownership artifact; disposition early-exit when the contract is not met, e.g. an unstructured
    body; runnable when met and within caps; queued when over a cap), or, for action closed, records a closure (nothing
    committed; publish writes one metrics file). Gate log lines (text after the timestamp):
      `event <event name> <action> <pr|issue> <n> sender <User|Bot>`; `policy trusted-branch revision <tree id>`;
      `listing none`, `listing unique owner <run>-<attempt>`, `listing ambiguous`, `listing incomplete`;
      `dedup duplicate <reason> owner <run>-<attempt>`; `dedup commit <reason>` (reasons no-owner, snapshot-changed, rerun,
      reopened, owner-ambiguous, listing-incomplete); `caps <within|daily-runs|per-author-concurrent-runs> daily <count> of
      <limit> author <count> of <limit>`; `disposition <runnable|early-exit|queued>`;
      `disposition closure resolution <merged|closed-by-author|closed-by-maintainer>`.
    publish (after a commit or closure): `policy revision <tree id>`, `ownership retention <n> days`, then the evidence commit
    `evidence commit <sha> rebuilds <n>` BEFORE anything else is published, then `freshness settle 10000 ms`,
    `freshness listing ok`, and one of `freshness current`, `freshness superseded newer-owner <run>-<attempt>`,
    `freshness superseded snapshot-changed` (a second commit then adds a supersession record), `freshness unknown <reason>`
    (publish fails). Runnable work ends outcome `inconclusive` (no screening stage exists yet); an unmet contract ends
    `needs-changes`.
    Each core step finally prints `steward job summary:` and the job summary lines: `## Patch Steward gate` or
    `## Patch Steward publish`, `- Submission: ...`, `- Run: `<run>-<attempt>``, `- Status: `<status>`` (gate: runnable,
    early-exit, queued, duplicate, closure, failed; publish: needs-changes, inconclusive, queued, superseded, closure,
    failed), optional `- Snapshot: ...`, `- Policy revision: ...`, `- Owner: kept `<run>-<attempt>`` or
    `- Owner: committed `<run>-<attempt>``, `- Caps: ...`, `- Evidence: commit `<sha>` at `<url>``,
    `- Freshness: `current`` or `- Freshness: `superseded` (`<reason>`)`, `- Ownership artifact retention: ...`,
    `- Failure: `<code>``. (The backticks are literal characters in the log.)
    Newest run id of a repository (record it BEFORE triggering an event; runs created later have larger ids):
      `gh api "repos/<repo>/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'`

    TOOLS (scenarios/tools/*.sh; read-only unless marked WRITE; read a tool's header comment only if unsure):
      find-runs.sh <repo> <workflow file> <title prefix>: `RUN id=<id> attempt=<a> event=<e> status=<s> conclusion=<c|none>
        created_at=<t> url=<u> title=<title>` lines oldest first, then `RUNS ... count=<n>`.
      await-runs.sh <repo> <workflow file> <title prefix> <after run id> <min count>: waits until at least <min count> runs
        newer than <after run id> with that title prefix exist and all completed; prints their RUN lines, then
        `AWAIT ... count=<n> completed=<k> result=complete` (exit 0) or `result=timeout` (exit 3).
      run-log.sh <repo> <run id> <attempt> <build|gate|publish>: `LOG job=<job> ts=<timestamp> text=<text>` per output line
        of that job (lines echoed from the step script are dropped), then `LOGS ... lines=<n> withheld=<w>`.
      artifacts.sh <repo> <artifact name>: `ARTIFACT id=<id> name=<n> created_at=<t> expires_at=<t> expired=<b> run_id=<id>
        size=<n>` lines sorted by created_at, then `ARTIFACTS ... count=<n> unexpired=<k>`.
      evidence.sh <store repo> steward-evidence <target repo> <pr|issue> <n> (needs pnpm build): one
        `EVIDENCE commit=<sha> parents=<p> added=<a> other=<o>` line per store commit, `EVIDENCE append_only=yes|no`, per run
        directory `EVIDENCE run=<run>-<attempt> kind=outcome outcome=<o> manifest=verified metrics=verified errors=0` or
        `EVIDENCE run=<dir> kind=waiting manifest=verified`, `EVIDENCE supersession=<file>` lines, and finally
        `EVIDENCE target=<t> subject=<pr|issue>-<n> runs=<n> verified=<v> result=ok|failed`.
      run-records.sh runs <store repo> steward-evidence <target repo> <pr|issue> <n>: `RECORD run=<dir> kind=outcome
        outcome=<o> run_id=<id> run_attempt=<a> policy_revision=<tree> snapshot=<hash> findings=<codes|none>` or
        `RECORD run=<dir> kind=waiting state=queued reason=<r> daily=<c>/<l> author=<c>/<l> arrival_at=<t>
        policy_revision=<tree> snapshot=<hash>`, `SUPERSESSION file=<f> run=<run>-<attempt> reason=<r>
        successor=<run>-<attempt>|null successor_created_at=<t>|null recorded_snapshot=<h> live_snapshot=<h>|null`, then
        `RECORDS ... runs=<n> supersessions=<m>`.
      run-records.sh metrics <store repo> steward-evidence <target repo> <run>-<attempt>: `METRIC file=<path> kind=<kind>
        subject=<run|submission>` (state-transition adds `from=<f> to=<t>`; maintainer-resolution adds
        `action_kind=resolution resolution=<r> paired_run=<run>-<attempt>|null paired_snapshot=<h>|null`), then
        `METRICS ... files=<n> events=<m>`.
      results-check.sh <results file> <scenario id>...: four RESULTS-CHECK lines, the last `... result=pass` (exit 0).

    RESULTS FILE scenarios/results/org-public.md (persistent, Prettier-checked; it already exists): APPEND your section(s) at the end; never change
    existing text. Section format:
      `## S<nn> <short title>`
      blank line; `Date (UTC): <YYYY-MM-DD>.` plus one to three sentences: what was done, the issue or pull request URL(s),
      the run URL(s) https://github.com/<repo>/actions/runs/<id>;
      one ```text fence per command group: a line `$ <command>` then the command's verbatim output (copy exactly; where
      actions allow, keep only the named lines of a long output);
      blank line; `Result: pass` (or `Result: fail`, with one sentence why just above it).
    Forbidden anywhere in the file: planning identifiers (milestone, phase, step, gate-item, owner-action or rule ids; the
    words "owner decision"; `development-artifacts`), the probe suite's App secret names (STEWARD_APP_ + ID, PRIVATE_KEY, or
    CLIENT_ID without the PATCH_ prefix), `ghs_`, `ghp_`, `-----BEGIN`, the two characters `^[` (script echo lines), raw
    control characters. After writing: `pnpm exec prettier --write scenarios/results/org-public.md` (never on development-artifacts/), then
    `bash scenarios/tools/results-check.sh scenarios/results/org-public.md <scenario ids named in actions>`.
- actions: |
    1. Base check (files changed in steps 5.1, 5.2, 5.5, 5.7): bash -c 'for f in scenarios/tools/run-log.sh scenarios/tools/await-runs.sh scenarios/tools/run-records.sh scenarios/tools/results-check.sh scenarios/fixtures/policies/caps-daily.yml scenarios/fixtures/pull-requests/steward-pr-modified.yml fixtures/submissions/pr-chore.txt; do [ -f "$f" ] || echo "MISSING $f"; done; grep -q "^## S17 " scenarios/results/org-public.md 2>/dev/null || echo "MISSING S17 section"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile && pnpm build
    3. Rate limit >= 500. M=$(gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'); echo "M=$M"
    4. Same-repository pull request:
       a. bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public scenario-s09-same "scenario: S09 change the wrapper and the policy" scenarios/fixtures/pull-requests/steward-pr-modified.yml:.github/workflows/steward-pr.yml scenarios/fixtures/policies/caps-daily.yml:.github/patch-steward/policy.yml
       b. gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=scenario-s09-same" --jq '.[] | select(.name=="patch-steward") | .sha'   (head policy tree; must differ from M)
       c. A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
       d. gh pr create -R steady-orchard/patch-steward-testbed-public --base master --head scenario-s09-same --title "[scenario S09] same-repository pull request changing the wrapper and the policy" --body-file fixtures/submissions/pr-chore.txt
          (exactly once; N1 = the number at the end of the printed URL)
       e. PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr N1 author 2095171 event pull_request_target opened sender 2095171 User" "$A" 1
          (repeat once on exit 3). RUN1 = the id in the RUN line.
       f. Checks (record each command and output): gh api repos/steady-orchard/patch-steward-testbed-public/actions/runs/RUN1 --jq '[.name, .path, .event, .display_title] | join(" | ")';
          gh run view RUN1 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")';
          bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public RUN1 1 gate | grep -E 'text=(event |policy |listing |dedup |caps |disposition |- )';
          bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public RUN1 1 publish | grep -E 'text=(policy |evidence commit |freshness |- )';
          bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr N1
    5. Fork pull request (only after step 4's run completed):
       a. bash probes/smoke/tools/deploy.sh jambolo/patch-steward-testbed-public scenario-s09-fork "scenario: S09 change the wrapper and the policy" scenarios/fixtures/pull-requests/steward-pr-modified.yml:.github/workflows/steward-pr.yml scenarios/fixtures/policies/caps-daily.yml:.github/patch-steward/policy.yml
       b. gh api "repos/jambolo/patch-steward-testbed-public/contents/.github?ref=scenario-s09-fork" --jq '.[] | select(.name=="patch-steward") | .sha'   (must differ from M)
       c. A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
       d. gh pr create -R steady-orchard/patch-steward-testbed-public --base master --head jambolo:scenario-s09-fork --title "[scenario S09] fork pull request changing the wrapper and the policy" --body-file fixtures/submissions/pr-chore.txt
          (exactly once; N2 = the number at the end of the printed URL)
       e. as 4e with N2 -> RUN2.   f. the checks of 4f for RUN2 and pr N2.
    6. bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr N2   (record the append_only line and the lines for runs and the final line; commit lines may be omitted except the last three)
    7. Append the section `## S09 pull requests that change the wrapper and the policy` per RESULTS FILE (M, both pull request
       URLs, both run URLs, commands and outputs of 4 and 5); then prettier and
       `bash scenarios/tools/results-check.sh scenarios/results/org-public.md S09 S17`.
    8. Leave both pull requests OPEN. Report: at column 0 the lines `s09_master_tree: <M>`, `s09_same_pr: <N1>`,
       `s09_same_run: <RUN1>`, `s09_fork_pr: <N2>`, `s09_fork_run: <RUN2>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.10-report.md","utf8");const ok=[/^s09_master_tree: [0-9a-f]{40}\s*$/m,/^s09_same_pr: [0-9]+\s*$/m,/^s09_same_run: [0-9]+\s*$/m,/^s09_fork_pr: [0-9]+\s*$/m,/^s09_fork_run: [0-9]+\s*$/m].every(r=>r.test(s));console.log(ok?"report ok":"report incomplete")'
       -> prints exactly: report ok
    2. f=development-artifacts/patch-steward-m6-5.10-report.md; R=steady-orchard/patch-steward-testbed-public; for k in same fork; do n=$(grep -m1 -o "^s09_${k}_pr: [0-9]*" $f | cut -d' ' -f2); run=$(grep -m1 -o "^s09_${k}_run: [0-9]*" $f | cut -d' ' -f2); t=$(gh api repos/$R/actions/runs/$run --jq '[.name, .path, .event, .display_title] | join(" | ")'); [ "$t" = "steward-pr | .github/workflows/steward-pr.yml | pull_request_target | steward pr $n author 2095171 event pull_request_target opened sender 2095171 User" ] && echo "$k definition ok" || echo "$k definition WRONG $t"; gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; done
       -> prints exactly four lines: same definition ok, screen / build=success,screen / gate=success,screen / publish=success, fork definition ok, screen / build=success,screen / gate=success,screen / publish=success
    3. f=development-artifacts/patch-steward-m6-5.10-report.md; R=steady-orchard/patch-steward-testbed-public; M=$(grep -m1 -o '^s09_master_tree: [0-9a-f]*' $f | cut -d' ' -f2); for k in same fork; do run=$(grep -m1 -o "^s09_${k}_run: [0-9]*" $f | cut -d' ' -f2); g=$(bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(policy trusted-branch revision $M|disposition runnable|caps within daily [0-9]+ of 50 author [0-9]+ of 2)\$"); p=$(bash scenarios/tools/run-log.sh $R $run 1 publish | grep -c -E "^LOG job=publish ts=[^ ]+ text=(freshness current|- Status: \`inconclusive\`)\$"); echo "$k gate=$g publish=$p"; done
       -> prints exactly two lines: same gate=3 publish=2, fork gate=3 publish=2
    4. f=development-artifacts/patch-steward-m6-5.10-report.md; R=steady-orchard/patch-steward-testbed-public; M=$(grep -m1 -o '^s09_master_tree: [0-9a-f]*' $f | cut -d' ' -f2); for k in same fork; do n=$(grep -m1 -o "^s09_${k}_pr: [0-9]*" $f | cut -d' ' -f2); run=$(grep -m1 -o "^s09_${k}_run: [0-9]*" $f | cut -d' ' -f2); bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $n | grep -c -E "^RECORD run=$run-1 kind=outcome outcome=inconclusive run_id=$run run_attempt=1 policy_revision=$M snapshot=sha256:[0-9a-f]{64} findings=([a-z.-]+,)*submission\.policy-change,([a-z.-]+,)*submission\.trusted-path-change(,[a-z.-]+)*\$"; done; s=$(gh api "repos/$R/contents/.github?ref=scenario-s09-same" --jq '.[] | select(.name=="patch-steward") | .sha'); k=$(gh api "repos/jambolo/patch-steward-testbed-public/contents/.github?ref=scenario-s09-fork" --jq '.[] | select(.name=="patch-steward") | .sha'); [ -n "$s" ] && [ -n "$k" ] && [ "$s" != "$M" ] && [ "$k" != "$M" ] && echo "head trees differ"
       -> prints exactly three lines: 1, 1, head trees differ
    5. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S09 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (results section only). Test-bed effects stay: branches scenario-s09-same on R and
    scenario-s09-fork on the fork, two open pull requests (closed later by the steady-state step without runs), evidence
    commits on the append-only store.
