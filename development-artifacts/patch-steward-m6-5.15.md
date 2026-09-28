# Step 5.15

- id: 5.15
- depends_on: [5.14]
- route: mechanical
- objective: Scenario S05 on org-public: three body edits of the S01 pull request in quick succession; only the newest committed owner publishes a current outcome, every other committed run is superseded or its pending publish was cancelled, and the evidence branch stays append-only; up to 3 tries; record in scenarios/results/org-public.md.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.15-report.md
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
    development-artifacts/patch-steward-m6-5.11-report.md) has committed owners from earlier scenarios; its body is
    unstructured (every committed run is early-exit, outcome needs-changes, no caps).

    What happens: three edits seconds apart start three runs. Each gate captures the LIVE body about 30 s later, so gates
    that run after the first ownership upload usually see an unchanged snapshot and end `dedup duplicate` (nothing committed,
    publish skipped); gates that ran concurrently all commit. Publishes of one pull request share one concurrency group
    (never cancelled in progress; GitHub keeps one pending member and a newer one replaces it, so a replaced pending publish
    ends `cancelled` with no evidence). The newest committed owner (greatest ownership artifact created_at) publishes
    `freshness current`; any other committed run that publishes sees the newer owner or a changed snapshot and ends
    `freshness superseded ...` with a supersession record. A tie of two artifacts at the greatest created_at makes publish
    fail with `freshness unknown` (a legitimate fail-closed outcome, but not a pass: retry).
    Scenario S05 pass: the check command in actions prints `S05 pass` (all new runs are committed or duplicate; the newest
    owner is one of them, committed, untied, and the ONLY run with `freshness current`; every other committed run is
    superseded with a supersession record or has a cancelled publish and no run directory; every duplicate's publish is
    skipped), AND evidence.sh reports `EVIDENCE append_only=yes` (every commit of the evidence branch, from the first one on,
    only adds files) and `result=ok`. Retry with three fresh edits up to 3 tries in total; record every try.

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
    1. Base check (files changed in steps 5.11 and 5.14): bash -c 'grep -q "^s01_pr: [0-9]" development-artifacts/patch-steward-m6-5.11-report.md 2>/dev/null || echo "MISSING 5.11 report"; grep -q "^## S08 " scenarios/results/org-public.md || echo "MISSING S08 section"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile && pnpm build; rate limit >= 500.
       P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); echo "P=$P"
    3. For try T = 1, 2, 3 (stop after the first pass):
       a. Edits (ONE Bash call; substitute P and T):
          R=steady-orchard/patch-steward-testbed-public; P=<P>; T=<T>; BASE="$(tr -d '\r' < scenarios/fixtures/submissions/unstructured.txt)"; A=$(gh api "repos/$R/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"; for E in 1 2 3; do gh pr edit "$P" -R "$R" --body "$(printf '%s\n\nScenario body edit: S05 try %s, edit %s.\n' "$BASE" "$T" "$E")" > /dev/null && echo "edit$E utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"; done
       b. PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr P author 2095171 event pull_request_target edited sender 2095171 User" A 3
          (repeat once on exit 3). RUNS = the ids of all its RUN lines, space-separated, oldest first.
       c. Check (substitute P and RUNS):
          R=steady-orchard/patch-steward-testbed-public; P=<P>; RUNS="<RUNS>"; T=$(mktemp -d); for r in $RUNS; do echo "RUNID $r $(gh run view $r -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")')"; bash scenarios/tools/run-log.sh $R $r 1 gate | sed "s/^/GATE $r /"; bash scenarios/tools/run-log.sh $R $r 1 publish | sed "s/^/PUB $r /"; done > "$T/runs.txt"; bash scenarios/tools/artifacts.sh $R steward-ownership-pr-$P > "$T/art.txt"; bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $P > "$T/rec.txt"; node -e 'const fs=require("fs"),path=require("path");const [T,runsArg]=process.argv.slice(1);const ids=runsArg.trim().split(/\s+/);const rd=f=>fs.readFileSync(path.join(T,f),"utf8").replace(/\r/g,"").split("\n").filter(Boolean);const R={};for(const id of ids)R[id]={jobs:"",gate:[],pub:[]};for(const l of rd("runs.txt")){const m=/^(RUNID|GATE|PUB) (\d+) (.*)$/.exec(l);if(!m||!R[m[2]])continue;const r=R[m[2]];if(m[1]==="RUNID")r.jobs=m[3];else{const t=m[3].replace(/^LOG job=\w+ ts=\S+ text=/,"");(m[1]==="GATE"?r.gate:r.pub).push(t)}}const art=rd("art.txt").filter(l=>l.startsWith("ARTIFACT ")).map(l=>({c:/created_at=(\S+)/.exec(l)[1],run:/run_id=(\d+)/.exec(l)[1]}));const top=art[art.length-1];const tie=art.length>1&&art[art.length-2].c===top.c;const rec=rd("rec.txt");const hasRec=id=>rec.some(l=>l.startsWith("RECORD run="+id+"-1 "));const hasSup=id=>rec.some(l=>l.startsWith("SUPERSESSION file="+id+"-1.json run="+id+"-1 "));const pubJob=id=>(/screen \/ publish=(\w+)/.exec(R[id].jobs)||[])[1]||"none";const committed=ids.filter(id=>R[id].gate.some(t=>t.startsWith("dedup commit ")));const dups=ids.filter(id=>R[id].gate.some(t=>t.startsWith("dedup duplicate ")));const current=ids.filter(id=>R[id].pub.includes("freshness current"));const sup=ids.filter(id=>R[id].pub.some(t=>t.startsWith("freshness superseded "))&&hasSup(id));const canc=ids.filter(id=>pubJob(id)==="cancelled"&&!hasRec(id));const W=top?top.run:"none";const others=committed.filter(id=>id!==W);const pass=ids.length>=3&&committed.length+dups.length===ids.length&&committed.includes(W)&&!tie&&current.length===1&&current[0]===W&&others.every(id=>sup.includes(id)||canc.includes(id))&&dups.every(id=>pubJob(id)==="skipped");console.log("S05 check runs="+ids.join(",")+" committed="+committed.join(",")+" duplicates="+dups.join(",")+" newest_owner="+W+" tie="+tie+" current="+current.join(",")+" superseded="+sup.join(",")+" cancelled="+canc.join(","));console.log(pass?"S05 pass":"S05 not met");' "$T" "$RUNS"; rm -rf "$T"
       d. Record for the try: the await output, the check output, and for each run in RUNS the lines
          `bash scenarios/tools/run-log.sh R <id> 1 gate | grep -E 'text=(listing |dedup |disposition |- Status|- Owner)'` and
          `... publish | grep -E 'text=(evidence commit |freshness |- Status|- Freshness|- Failure)'`, plus the last four
          ARTIFACT lines of `bash scenarios/tools/artifacts.sh R steward-ownership-pr-P`. `S05 not met` -> next try.
    4. After the passing try: bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr P
       Record ALL its `EVIDENCE commit=` lines (the per-commit additions-only proof), the append_only line, the run and
       supersession lines, and the final line. It must show `EVIDENCE append_only=yes` and `result=ok`.
       No pass after 3 tries -> write the section with `Result: fail`, status fail, STOP.
    5. Append `## S05 concurrent body edits: only the newest owner publishes` (every try, then step 4); prettier;
       `bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S08 S09 S17`.
    6. Report: at column 0 the lines `s05_try: <T>` and `s05_runs: <RUNS of the passing try, space-separated>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.15-report.md","utf8");console.log(/^s05_try: [1-3]\s*$/m.test(s)&&/^s05_runs: [0-9]+( [0-9]+){2,}\s*$/m.test(s)?"report ok":"report incomplete")'
       -> prints exactly: report ok
    2. R=steady-orchard/patch-steward-testbed-public; P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); RUNS=$(grep -m1 '^s05_runs: ' development-artifacts/patch-steward-m6-5.15-report.md | cut -d' ' -f2- | tr -d '\r'); T=$(mktemp -d); for r in $RUNS; do echo "RUNID $r $(gh run view $r -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")')"; bash scenarios/tools/run-log.sh $R $r 1 gate | sed "s/^/GATE $r /"; bash scenarios/tools/run-log.sh $R $r 1 publish | sed "s/^/PUB $r /"; done > "$T/runs.txt"; bash scenarios/tools/artifacts.sh $R steward-ownership-pr-$P > "$T/art.txt"; bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $P > "$T/rec.txt"; node -e 'const fs=require("fs"),path=require("path");const [T,runsArg]=process.argv.slice(1);const ids=runsArg.trim().split(/\s+/);const rd=f=>fs.readFileSync(path.join(T,f),"utf8").replace(/\r/g,"").split("\n").filter(Boolean);const R={};for(const id of ids)R[id]={jobs:"",gate:[],pub:[]};for(const l of rd("runs.txt")){const m=/^(RUNID|GATE|PUB) (\d+) (.*)$/.exec(l);if(!m||!R[m[2]])continue;const r=R[m[2]];if(m[1]==="RUNID")r.jobs=m[3];else{const t=m[3].replace(/^LOG job=\w+ ts=\S+ text=/,"");(m[1]==="GATE"?r.gate:r.pub).push(t)}}const art=rd("art.txt").filter(l=>l.startsWith("ARTIFACT ")).map(l=>({c:/created_at=(\S+)/.exec(l)[1],run:/run_id=(\d+)/.exec(l)[1]}));const top=art[art.length-1];const tie=art.length>1&&art[art.length-2].c===top.c;const rec=rd("rec.txt");const hasRec=id=>rec.some(l=>l.startsWith("RECORD run="+id+"-1 "));const hasSup=id=>rec.some(l=>l.startsWith("SUPERSESSION file="+id+"-1.json run="+id+"-1 "));const pubJob=id=>(/screen \/ publish=(\w+)/.exec(R[id].jobs)||[])[1]||"none";const committed=ids.filter(id=>R[id].gate.some(t=>t.startsWith("dedup commit ")));const dups=ids.filter(id=>R[id].gate.some(t=>t.startsWith("dedup duplicate ")));const current=ids.filter(id=>R[id].pub.includes("freshness current"));const sup=ids.filter(id=>R[id].pub.some(t=>t.startsWith("freshness superseded "))&&hasSup(id));const canc=ids.filter(id=>pubJob(id)==="cancelled"&&!hasRec(id));const W=top?top.run:"none";const others=committed.filter(id=>id!==W);const pass=ids.length>=3&&committed.length+dups.length===ids.length&&committed.includes(W)&&!tie&&current.length===1&&current[0]===W&&others.every(id=>sup.includes(id)||canc.includes(id))&&dups.every(id=>pubJob(id)==="skipped");console.log("S05 check runs="+ids.join(",")+" committed="+committed.join(",")+" duplicates="+dups.join(",")+" newest_owner="+W+" tie="+tie+" current="+current.join(",")+" superseded="+sup.join(",")+" cancelled="+canc.join(","));console.log(pass?"S05 pass":"S05 not met");' "$T" "$RUNS" | tail -n 1; rm -rf "$T"
       -> prints exactly: S05 pass
       (valid while no later scenario adds an ownership artifact to this pull request; the supervisor runs it right after the step)
    3. R=steady-orchard/patch-steward-testbed-public; P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); bash scenarios/tools/evidence.sh $R steward-evidence $R pr $P | grep -c -E "^EVIDENCE append_only=yes\$|^EVIDENCE target=$R subject=pr-$P runs=[0-9]+ verified=[0-9]+ result=ok\$"
       -> prints exactly: 2
    4. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S08 S09 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (results section only). Test-bed effects stay (edited body, append-only evidence).
