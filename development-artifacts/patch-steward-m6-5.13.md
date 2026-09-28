# Step 5.13

- id: 5.13
- depends_on: [5.12]
- route: mechanical
- objective: Scenario S04 on org-public: two body edits of the S01 pull request, the second made right after the first run's gate committed, so the newer run commits and publishes an outcome and the older run is superseded (supersession record); up to 3 tries; record in scenarios/results/org-public.md.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.13-report.md
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

    TEST-BED R = steady-orchard/patch-steward-testbed-public. The S01 pull request P (line `s01_pr: <P>` of
    development-artifacts/patch-steward-m6-5.11-report.md) has one committed owner (the S01 run); its body is
    scenarios/fixtures/submissions/unstructured.txt (contract not met: every committed run is early-exit, outcome
    needs-changes, no caps).

    Why the timing matters: the gate captures the body LIVE when its gate job runs (about 30 s after the event). Two edits
    seconds apart are usually captured identically by both runs, and the second run then ends duplicate. The procedure
    therefore makes the second edit right AFTER the first run's gate job completed (its ownership artifact then records the
    first body) and well BEFORE that run's publish re-checks freshness (publish runs about 25 s after the gate: it commits
    evidence, waits 10 s, re-lists ownership, and recaptures the live body). The older run's publish then sees either the
    newer run's ownership artifact (`freshness superseded newer-owner <new>-1`) or the changed live body
    (`freshness superseded snapshot-changed`) and commits a supersession record; the newer run commits
    (`dedup commit snapshot-changed`) and, being the newest owner with the live body, publishes `freshness current`.
    Scenario S04 pass: exactly as the check command in actions prints `S04 pass`. Retry (a fresh pair of edits) up to 3
    tries in total when a try prints `S04 not met`; record every try.

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
    1. Base check (files changed in steps 5.11 and 5.12): bash -c 'grep -q "^s01_pr: [0-9]" development-artifacts/patch-steward-m6-5.11-report.md 2>/dev/null || echo "MISSING 5.11 report"; grep -q "^s03_run: [0-9]" development-artifacts/patch-steward-m6-5.12-report.md 2>/dev/null || echo "MISSING 5.12 report"; grep -q "^## S03 " scenarios/results/org-public.md || echo "MISSING S03 section"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile && pnpm build; rate limit >= 500.
       P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); echo "P=$P"
    3. For try T = 1, 2, 3 (stop after the first `S04 pass`):
       a. Edits (ONE Bash call; substitute P and T; it takes at most about 8 minutes):
          R=steady-orchard/patch-steward-testbed-public; P=<P>; T=<T>; BASE="$(tr -d '\r' < scenarios/fixtures/submissions/unstructured.txt)"; PFX="steward pr $P author 2095171 event pull_request_target edited sender 2095171 User"; A=$(gh api "repos/$R/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"; gh pr edit "$P" -R "$R" --body "$(printf '%s\n\nScenario body edit: S04 try %s, first edit.\n' "$BASE" "$T")" > /dev/null && echo "edit1 utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"; OLD=""; G=""; for i in $(seq 1 24); do sleep 20; if [ -z "$OLD" ]; then OLD=$(bash scenarios/tools/find-runs.sh "$R" steward-pr.yml "$PFX" | awk -v a="$A" '/^RUN /{split($2,x,"="); if (x[2]+0 > a+0) {print x[2]; exit}}'); fi; if [ -n "$OLD" ]; then G=$(gh run view "$OLD" -R "$R" --json jobs --jq '[.jobs[] | select(.name == "screen / gate") | .status + "/" + (.conclusion // "")] | join(",")'); echo "poll $i old=$OLD gate=$G utc=$(date -u +%H:%M:%S)"; case "$G" in completed/*) break ;; esac; fi; done; gh pr edit "$P" -R "$R" --body "$(printf '%s\n\nScenario body edit: S04 try %s, second edit.\n' "$BASE" "$T")" > /dev/null && echo "edit2 utc=$(date -u +%Y-%m-%dT%H:%M:%SZ) old=$OLD gate=$G after=$A"
          Record the output. OLD = the old run id it printed; A = the printed after id.
       b. PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr P author 2095171 event pull_request_target edited sender 2095171 User" A 2
          (repeat once on exit 3). NEW = the id of the other RUN line (the one that is not OLD; if more than two lines
          appear, NEW = the newest). Record the output.
       c. Check (substitute OLD, NEW, P):
          R=steady-orchard/patch-steward-testbed-public; OLD=<OLD>; NEW=<NEW>; P=<P>; g1=$(bash scenarios/tools/run-log.sh $R $OLD 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=dedup commit '); g2=$(bash scenarios/tools/run-log.sh $R $NEW 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=dedup commit '); p1=$(bash scenarios/tools/run-log.sh $R $OLD 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(freshness superseded (newer-owner [0-9]+-[0-9]+|snapshot-changed)|- Status: `superseded`)$'); p2=$(bash scenarios/tools/run-log.sh $R $NEW 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(freshness current|- Status: `needs-changes`)$'); s=$(bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $P | grep -c "^SUPERSESSION file=$OLD-1.json run=$OLD-1 reason="); echo "S04 check old=$OLD new=$NEW gate_commits=$g1$g2 old_superseded=$p1 new_current=$p2 supersession_records=$s"; [ "$g1$g2$p1$p2$s" = "11221" ] && echo "S04 pass" || echo "S04 not met"
       d. Record for the try: the gate lines (`bash scenarios/tools/run-log.sh R <id> 1 gate | grep -E 'text=(listing |dedup |disposition |- Status|- Owner)'`)
          and publish lines (`... publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence|- Freshness)'`) of OLD
          and NEW. On `S04 not met` also record `gh run view <id> -R R --json jobs --jq ...` for both, then go to the next try.
    4. After the passing try: bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-P ;
       bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr P ;
       bash scenarios/tools/run-records.sh metrics steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public OLD-1 ;
       bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr P
       (record the append_only, run, supersession, and final lines; per-commit lines may be omitted).
       No pass after 3 tries -> write the section with `Result: fail`, status fail, STOP.
    5. Append `## S04 body edit commits a new owner and supersedes the older run` (every try: commands and outputs of a-d,
       then the step 4 outputs); prettier; `bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S09 S17`.
    6. Report: at column 0 the lines `s04_try: <T>`, `s04_old_run: <OLD>`, `s04_new_run: <NEW>` (of the passing try) and
       `s04_new_commit: <sha of NEW's evidence commit line>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.13-report.md","utf8");const ok=[/^s04_try: [1-3]\s*$/m,/^s04_old_run: [0-9]+\s*$/m,/^s04_new_run: [0-9]+\s*$/m,/^s04_new_commit: [0-9a-f]{40}\s*$/m].every(r=>r.test(s));console.log(ok?"report ok":"report incomplete")'
       -> prints exactly: report ok
    2. R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.13-report.md; P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); OLD=$(grep -m1 -o '^s04_old_run: [0-9]*' $f | cut -d' ' -f2); NEW=$(grep -m1 -o '^s04_new_run: [0-9]*' $f | cut -d' ' -f2); g1=$(bash scenarios/tools/run-log.sh $R $OLD 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=dedup commit '); g2=$(bash scenarios/tools/run-log.sh $R $NEW 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=dedup commit '); p1=$(bash scenarios/tools/run-log.sh $R $OLD 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(freshness superseded (newer-owner [0-9]+-[0-9]+|snapshot-changed)|- Status: `superseded`)$'); p2=$(bash scenarios/tools/run-log.sh $R $NEW 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(freshness current|- Status: `needs-changes`)$'); s=$(bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $P | grep -c "^SUPERSESSION file=$OLD-1.json run=$OLD-1 reason="); [ "$g1$g2$p1$p2$s" = "11221" ] && echo "S04 pass" || echo "S04 not met $g1$g2$p1$p2$s"
       -> prints exactly: S04 pass
    3. R=steady-orchard/patch-steward-testbed-public; P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); bash scenarios/tools/evidence.sh $R steward-evidence $R pr $P | grep -c -E "^EVIDENCE append_only=yes\$|^EVIDENCE target=$R subject=pr-$P runs=[0-9]+ verified=[0-9]+ result=ok\$"
       -> prints exactly: 2
    4. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S09 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (results section only). Test-bed effects stay (edited body, append-only evidence).
