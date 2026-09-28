# Step 5.23

- id: 5.23
- depends_on: [5.22]
- route: mechanical
- objective: Scenario S12 on org-public: re-run the completed hosted-screening smoke run (run 36397673122, issue 31); the new attempt commits a new owner (explicit rerun) whose ownership artifact is the newest, and publishes a run directory keyed by attempt 2; record in scenarios/results/org-public.md.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.23-report.md
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
    The ONLY rerun allowed: `gh run rerun 36397673122 -R steady-orchard/patch-steward-testbed-public` (all jobs), once.

    TEST-BED R = steady-orchard/patch-steward-testbed-public (valid trusted policy on master, tree id d997b1e...). Run
    36397673122 is the earlier smoke run for issue 31 (`[scenario S00] hosted screening smoke`, unstructured body, open):
    attempt 1 committed ownership artifact `steward-ownership-issue-31` (created_at 2026-09-28T08:30:09Z) and run directory
    `runs/issue-31/36397673122-1` (outcome needs-changes). A re-run keeps the run id and increments the attempt; the gate of
    attempt 2 treats it as an explicit rerun: `dedup commit rerun` (commits a new owner whatever the snapshot), disposition
    early-exit; its ownership upload REPLACES the attempt-1 artifact of the same name in the listing (GitHub behavior), so
    the listing shows an artifact with run_id 36397673122 and a created_at later than 2026-09-28T08:30:09Z; publish writes
    `runs/issue-31/36397673122-2` (outcome needs-changes) and reports `freshness current`.
    Right after `gh run rerun`, `gh run view` may still show attempt 1 as completed for a few seconds: first poll (every
    20 s, at most 15 times) `gh run view 36397673122 -R R --json attempt,status --jq '(.attempt|tostring) + " " + .status'`
    until it starts with `2 `, then wait with `PROBE_WAIT_SECONDS=540 bash probes/smoke/tools/wait-run.sh R 36397673122`
    (prints `WAIT completed run_id=... conclusion=...`; exit 3 = still running: call once more).
    Scenario S12 pass (explicit rerun replaces): attempt 2 jobs build, gate, publish success; attempt-2 gate lines
    `dedup commit rerun` and `disposition early-exit`, summary `- Owner: committed `36397673122-2``; attempt-2 publish
    `freshness current`; the newest ownership artifact of issue 31 has run_id 36397673122 and created_at later than
    2026-09-28T08:30:09Z; a record `RECORD run=36397673122-2 kind=outcome outcome=needs-changes ... run_attempt=2 ...`;
    evidence.sh for issue 31 `runs=2 verified=2 result=ok`.

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
    1. Base check (files changed in step 5.22): bash -c 'grep -q "^s11_author_run: [0-9]" development-artifacts/patch-steward-m6-5.22-report.md 2>/dev/null || echo "MISSING 5.22 report"; grep -q "^## S11 per-author" scenarios/results/org-public.md || echo "MISSING S11 per-author section"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile && pnpm build; rate limit >= 500; master policy tree id = d997b1e... (else STOP, status fail).
    3. Before: gh run view 36397673122 -R steady-orchard/patch-steward-testbed-public --json attempt,status,conclusion --jq '(.attempt|tostring) + " " + .status + " " + .conclusion' ;
       bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-issue-31
       (If the attempt is already 2 or higher, STOP: status fail, report that the run was already re-run; do not rerun again.)
    4. gh run rerun 36397673122 -R steady-orchard/patch-steward-testbed-public   (exactly once); then the attempt poll and wait-run.sh per context.
    5. gh run view 36397673122 -R steady-orchard/patch-steward-testbed-public --attempt 2 --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")' ;
       bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36397673122 2 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)' ;
       bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36397673122 2 publish | grep -E 'text=(ownership |evidence commit |freshness |- Status|- Evidence|- Freshness)'
    6. After: bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-issue-31 ;
       bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 31 ;
       bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 31   (run and final lines)
    7. Append `## S12 explicit rerun commits a new owner` (commands 3-6 with outputs); prettier;
       `bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S17`.
    8. Leave issue 31 OPEN. Report: at column 0 the line `s12_newest_artifact_created_at: <created_at of the newest ARTIFACT line after>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. R=steady-orchard/patch-steward-testbed-public; gh run view 36397673122 -R $R --json attempt --jq .attempt; gh run view 36397673122 -R $R --attempt 2 --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R 36397673122 2 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(dedup commit rerun|disposition early-exit|- Owner: committed `36397673122-2`)$'; bash scenarios/tools/run-log.sh $R 36397673122 2 publish | grep -c -x -E 'LOG job=publish ts=[^ ]+ text=freshness current'
       -> prints exactly four lines: 2, screen / build=success,screen / gate=success,screen / publish=success, 3, 1
    2. R=steady-orchard/patch-steward-testbed-public; bash scenarios/tools/artifacts.sh $R steward-ownership-issue-31 | grep '^ARTIFACT ' | tail -n 1 | node -e 'const l=require("fs").readFileSync(0,"utf8");const c=(/created_at=(\S+)/.exec(l)||[])[1]||"";console.log(/ run_id=36397673122 /.test(l)&&/ expired=false /.test(l)&&c>"2026-09-28T08:30:09Z"?"newest owner is attempt 2":"newest owner wrong "+l.trim())'
       -> prints exactly: newest owner is attempt 2
    3. R=steady-orchard/patch-steward-testbed-public; bash scenarios/tools/run-records.sh runs $R steward-evidence $R issue 31 | grep -c -E '^RECORD run=36397673122-2 kind=outcome outcome=needs-changes run_id=36397673122 run_attempt=2 '; bash scenarios/tools/evidence.sh $R steward-evidence $R issue 31 | grep -c -x -E "EVIDENCE target=$R subject=issue-31 runs=2 verified=2 result=ok"
       -> prints exactly two lines: 1, 1
    4. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (results section only). The rerun attempt, its ownership artifact, and its evidence stay
    (append-only).
