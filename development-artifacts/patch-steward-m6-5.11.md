# Step 5.11

- id: 5.11
- depends_on: [5.10]
- route: mechanical
- objective: Scenarios S01 and S02 on org-public: open an unstructured pull request (one owner committed, outcome needs-changes, publish summary after the evidence commit), then edit only its title (duplicate: the owner is kept, nothing committed); record both in scenarios/results/org-public.md.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.11-report.md
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

    TEST-BED R = steady-orchard/patch-steward-testbed-public (org-public; default branch master; trusted policy: all observe,
    evidence store = orphan branch `steward-evidence` of R). Create the pull request head with
    probes/smoke/tools/deploy.sh (clones R over SSH, creates the branch from master, commits once, pushes without force;
    prints `DEPLOY identical dest=<path> blob=<id>`). The body scenarios/fixtures/submissions/unstructured.txt follows no
    pull request template, so the contract is not met: disposition early-exit, outcome needs-changes (finding
    `submission.unstructured`), no cap evaluation.
    Scenario S01 pass: exactly one ownership artifact `steward-ownership-pr-<n>` (run_id = the S01 run); one run directory
    with outcome needs-changes; in the publish log the line `evidence commit <C> rebuilds <k>` comes before
    `steward job summary:`, which comes before `- Evidence: commit `<C>` at ...` (the summary is written after the evidence
    commit and names it).
    Scenario S02 pass (a title-only edit keeps the owner): the edit's run has jobs build success, gate success, publish
    skipped; gate lines `listing unique owner <S01 run>-1` and `dedup duplicate owner-unchanged owner <S01 run>-1`; gate
    summary `- Status: `duplicate`` and `- Owner: kept `<S01 run>-1``; the ownership artifact listing and the run directories
    are unchanged (still one each).

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
    1. Base check (files changed in step 5.10): bash -c 'grep -q "^s09_fork_run: [0-9]" development-artifacts/patch-steward-m6-5.10-report.md 2>/dev/null || echo "MISSING 5.10 report"; grep -q "^## S09 " scenarios/results/org-public.md 2>/dev/null || echo "MISSING S09 section"; for f in scenarios/tools/run-log.sh scenarios/tools/await-runs.sh scenarios/tools/run-records.sh scenarios/tools/results-check.sh scenarios/fixtures/submissions/unstructured.txt; do [ -f "$f" ] || echo "MISSING $f"; done; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile && pnpm build; rate limit >= 500.
    3. S01:
       a. bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public scenario-s01-head "scenario: S01 pull request change" scenarios/fixtures/submissions/unstructured.txt:scenario-s01.txt
       b. A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
       c. gh pr create -R steady-orchard/patch-steward-testbed-public --base master --head scenario-s01-head --title "[scenario S01] unstructured pull request" --body-file scenarios/fixtures/submissions/unstructured.txt
          (exactly once; P = the number at the end of the printed URL)
       d. PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr P author 2095171 event pull_request_target opened sender 2095171 User" "$A" 1
          (repeat once on exit 3). S01RUN = its run id.
       e. gh run view S01RUN -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'   (expected all three success)
       f. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public S01RUN 1 gate | grep -E 'text=(event |policy |listing |dedup |disposition |- )'
       g. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public S01RUN 1 publish | grep -E 'text=(policy |ownership |evidence commit |freshness |steward job summary:|- )'
          C = the sha in `evidence commit <sha> rebuilds <k>`.
       h. bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-P
       i. bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr P
    4. S02 (only after S01's run completed):
       a. A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
       b. gh pr edit P -R steady-orchard/patch-steward-testbed-public --title "[scenario S01] unstructured pull request (title edited by the author)"
       c. PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr P author 2095171 event pull_request_target edited sender 2095171 User" "$A" 1
          (repeat once on exit 3). S02RUN = its run id.
       d. gh run view S02RUN -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'   (expected build success, gate success, publish skipped)
       e. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public S02RUN 1 gate | grep -E 'text=(event |policy |listing |dedup |disposition |- )'
       f. repeat 3h and 3i (unchanged: one artifact, one run directory).
    5. Append two sections: `## S01 unstructured pull request` (commands 3a-3i with outputs) and
       `## S02 title-only edit keeps the owner` (4a-4f); then prettier and
       `bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S09 S17`.
    6. Leave the pull request OPEN (later scenarios edit it). Report: at column 0 the lines `s01_pr: <P>`, `s01_run: <S01RUN>`,
       `s01_commit: <C>`, `s02_run: <S02RUN>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.11-report.md","utf8");const ok=[/^s01_pr: [0-9]+\s*$/m,/^s01_run: [0-9]+\s*$/m,/^s01_commit: [0-9a-f]{40}\s*$/m,/^s02_run: [0-9]+\s*$/m].every(r=>r.test(s));console.log(ok?"report ok":"report incomplete")'
       -> prints exactly: report ok
    2. f=development-artifacts/patch-steward-m6-5.11-report.md; R=steady-orchard/patch-steward-testbed-public; run=$(grep -m1 -o '^s01_run: [0-9]*' $f | cut -d' ' -f2); c=$(grep -m1 -o '^s01_commit: [0-9a-f]*' $f | cut -d' ' -f2); gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(listing none|dedup commit no-owner|disposition early-exit)$'; bash scenarios/tools/run-log.sh $R $run 1 publish | node -e 'const L=require("fs").readFileSync(0,"utf8").split("\n").map(l=>l.replace(/\r$/,"").replace(/^LOG job=publish ts=\S+ text=/,""));const c=process.argv[1];const B=String.fromCharCode(96);const iC=L.findIndex(l=>l.startsWith("evidence commit "+c+" rebuilds "));const iH=L.indexOf("steward job summary:");const iE=L.findIndex(l=>l.startsWith("- Evidence: commit "+B+c+B+" at "));const st=L.includes("- Status: "+B+"needs-changes"+B);console.log(c.length===40&&iC>=0&&iH>iC&&iE>iH&&st?"summary after evidence":"order wrong "+JSON.stringify({iC,iH,iE,st}))' "$c"
       -> prints exactly three lines: screen / build=success,screen / gate=success,screen / publish=success, 3, summary after evidence
    3. f=development-artifacts/patch-steward-m6-5.11-report.md; R=steady-orchard/patch-steward-testbed-public; p=$(grep -m1 -o '^s01_pr: [0-9]*' $f | cut -d' ' -f2); run=$(grep -m1 -o '^s01_run: [0-9]*' $f | cut -d' ' -f2); bash scenarios/tools/artifacts.sh $R steward-ownership-pr-$p | grep -c -E "^ARTIFACT id=[0-9]+ name=steward-ownership-pr-$p created_at=\S+ expires_at=\S+ expired=false run_id=$run size=|^ARTIFACTS repo=$R name=steward-ownership-pr-$p count=1 unexpired=1\$"; bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $p | grep -c -E "^RECORD run=$run-1 kind=outcome outcome=needs-changes run_id=$run run_attempt=1 .* findings=submission\.unstructured\$|^RECORDS .* subject=pr-$p runs=1 supersessions=0\$"
       -> prints exactly two lines: 2, 2
       (valid until the next scenario edits this pull request; the supervisor runs it right after the step)
    4. f=development-artifacts/patch-steward-m6-5.11-report.md; R=steady-orchard/patch-steward-testbed-public; run=$(grep -m1 -o '^s01_run: [0-9]*' $f | cut -d' ' -f2); r2=$(grep -m1 -o '^s02_run: [0-9]*' $f | cut -d' ' -f2); gh run view $r2 -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R $r2 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(listing unique owner $run-1|dedup duplicate owner-unchanged owner $run-1|- Status: \`duplicate\`|- Owner: kept \`$run-1\`)\$"
       -> prints exactly two lines: screen / build=success,screen / gate=success,screen / publish=skipped, 4
    5. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S09 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (results sections only). Test-bed effects stay (branch scenario-s01-head, open pull request,
    evidence commit on the append-only store).
