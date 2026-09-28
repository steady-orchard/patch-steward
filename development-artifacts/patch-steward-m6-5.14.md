# Step 5.14

- id: 5.14
- depends_on: [5.13]
- route: mechanical
- objective: Scenario S08 on org-public (read-only): from the publish logs of the S01 run and the S04 newer run, show that each evidence commit (written and read back) precedes the job summary that names it; record in scenarios/results/org-public.md.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.14-report.md
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
    This step makes NO GitHub write (read-only calls only).

    TEST-BED R = steady-orchard/patch-steward-testbed-public. Inputs: S01 run and its evidence commit (lines `s01_run:` and
    `s01_commit:` of development-artifacts/patch-steward-m6-5.11-report.md); S04 newer run and its evidence commit (lines
    `s04_new_run:` and `s04_new_commit:` of development-artifacts/patch-steward-m6-5.13-report.md).
    Publish writes the evidence commit and reads it back before any other publication step; it logs
    `evidence commit <sha> rebuilds <n>` at that point, and only afterwards writes the job summary, which the log shows as
    `steward job summary:` followed by lines including `- Evidence: commit `<sha>` at `<url>``. The commit's committer date
    (`gh api repos/<R>/git/commits/<sha> --jq .committer.date`, second resolution) is not later than the log timestamp of the
    summary line. Scenario S08 pass: for BOTH runs the check command in actions prints `order=ok`.

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
    1. Base check (files changed in steps 5.11 and 5.13): bash -c 'grep -q "^s01_commit: [0-9a-f]" development-artifacts/patch-steward-m6-5.11-report.md 2>/dev/null || echo "MISSING 5.11 report"; grep -q "^s04_new_commit: [0-9a-f]" development-artifacts/patch-steward-m6-5.13-report.md 2>/dev/null || echo "MISSING 5.13 report"; grep -q "^## S04 " scenarios/results/org-public.md || echo "MISSING S04 section"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile
    3. For (run, commit) = (s01_run, s01_commit) and (s04_new_run, s04_new_commit), run and record:
       a. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public <run> 1 publish | grep -E 'text=(evidence commit |freshness |steward job summary:|- )'
       b. gh api repos/steady-orchard/patch-steward-testbed-public/git/commits/<commit> --jq '.committer.date'
       c. R=steady-orchard/patch-steward-testbed-public; run=<run>; c=<commit>; d=$(gh api repos/$R/git/commits/$c --jq .committer.date); bash scenarios/tools/run-log.sh $R $run 1 publish | node -e 'const L=require("fs").readFileSync(0,"utf8").split("\n").map(l=>l.replace(/\r$/,"")).filter(l=>l.startsWith("LOG job=publish ")).map(l=>{const m=/^LOG job=publish ts=(\S+) text=(.*)$/.exec(l);return m?{ts:m[1],t:m[2]}:{ts:"",t:""}});const [c,d,run]=process.argv.slice(1);const B=String.fromCharCode(96);const iC=L.findIndex(x=>x.t.startsWith("evidence commit "+c+" rebuilds "));const iH=L.findIndex(x=>x.t==="steward job summary:");const iE=L.findIndex(x=>x.t.startsWith("- Evidence: commit "+B+c+B+" at "));const ok=c.length===40&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(d)&&iC>=0&&iH>iC&&iE>iH&&d.slice(0,19)<=L[iH].ts.slice(0,19);console.log("S08 run="+run+" commit="+c+" committed_at="+d+" summary_at="+(iH>=0?L[iH].ts:"none")+" order="+(ok?"ok":"wrong"))' "$c" "$d" "$run"
    4. Append `## S08 evidence is written before the job summary` (both runs: commands a-c and outputs); prettier;
       `bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S08 S09 S17`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. R=steady-orchard/patch-steward-testbed-public; a=development-artifacts/patch-steward-m6-5.11-report.md; b=development-artifacts/patch-steward-m6-5.13-report.md; for pair in "$(grep -m1 -o '^s01_run: [0-9]*' $a | cut -d' ' -f2) $(grep -m1 -o '^s01_commit: [0-9a-f]*' $a | cut -d' ' -f2)" "$(grep -m1 -o '^s04_new_run: [0-9]*' $b | cut -d' ' -f2) $(grep -m1 -o '^s04_new_commit: [0-9a-f]*' $b | cut -d' ' -f2)"; do set -- $pair; run=$1; c=$2; d=$(gh api repos/$R/git/commits/$c --jq .committer.date); bash scenarios/tools/run-log.sh $R $run 1 publish | node -e 'const L=require("fs").readFileSync(0,"utf8").split("\n").map(l=>l.replace(/\r$/,"")).filter(l=>l.startsWith("LOG job=publish ")).map(l=>{const m=/^LOG job=publish ts=(\S+) text=(.*)$/.exec(l);return m?{ts:m[1],t:m[2]}:{ts:"",t:""}});const [c,d,run]=process.argv.slice(1);const B=String.fromCharCode(96);const iC=L.findIndex(x=>x.t.startsWith("evidence commit "+c+" rebuilds "));const iH=L.findIndex(x=>x.t==="steward job summary:");const iE=L.findIndex(x=>x.t.startsWith("- Evidence: commit "+B+c+B+" at "));const ok=c.length===40&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(d)&&iC>=0&&iH>iC&&iE>iH&&d.slice(0,19)<=L[iH].ts.slice(0,19);console.log(ok?"order ok":"order wrong "+run)' "$c" "$d" "$run"; done
       -> prints exactly two lines, each: order ok
    2. grep -c -E '^S08 run=[0-9]+ commit=[0-9a-f]{40} committed_at=\S+ summary_at=\S+ order=ok' scenarios/results/org-public.md
       -> prints exactly: 2
    3. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S08 S09 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (results section only; nothing on GitHub changed).
