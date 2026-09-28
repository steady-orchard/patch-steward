# Step 5.17

- id: 5.17
- depends_on: [5.16]
- route: mechanical
- objective: Scenario S07 on org-public: with the evidence store pointed at a repository the App cannot write, a body edit of the S01 pull request commits a new owner at the gate but publish fails before any evidence is written (no run directory, no summary outcome); restore the policy; record in scenarios/results/org-public.md.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.17-report.md
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
    development-artifacts/patch-steward-m6-5.11-report.md) already has committed owners, so the gate never needs to read a
    separate store (it reads published evidence only when no ownership artifact exists). WRITE tool
    `bash scenarios/tools/deploy-steward.sh org-public [<policy file>]` deploys the unchanged wrappers and the given policy
    (default: the valid scenarios/fixtures/policies/orphan-branch.yml) to R's master; last line
    `SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-public pin=<sha> policy=<file> result=ok`.
    scenarios/fixtures/policies/unwritable-store.yml = the valid policy with evidence store type `repository`, repository
    steady-orchard/patch-steward-testbed-unwritable (does not exist; `gh api repos/steady-orchard/patch-steward-testbed-unwritable`
    fails with HTTP 404), branch steward-evidence. Master policy tree id command:
      gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
    (d997b1e362c75af03942da0e7a1e8902ca5dbe51 for the valid policy).
    Scenario S07 pass (a failed publish publishes nothing): the edit's run has jobs build success, gate success, publish
    failure; gate lines `dedup commit <reason>` and `disposition early-exit`, gate summary `- Owner: committed `<run>-1``; a
    new ownership artifact of P with run_id = this run (count one higher than before); publish log has NO
    `evidence commit` line, its summary shows `- Status: `failed`` and a `- Failure: `<code>`` line (expected code
    `github.not-found`: the App installation lookup for the store repository fails) and no `- Evidence:` line; no run
    directory for this run in R's store; after the restore the master policy tree id is d997b1e... again.
    Restore ONLY after the run completed; trigger nothing else on R meanwhile.

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
    1. Base check (files changed in steps 5.16 and 5.5): bash -c 'grep -q "^s06_run: [0-9]" development-artifacts/patch-steward-m6-5.16-report.md 2>/dev/null || echo "MISSING 5.16 report"; [ -f scenarios/fixtures/policies/unwritable-store.yml ] || echo "MISSING unwritable-store.yml"; grep -q "^## S06 " scenarios/results/org-public.md || echo "MISSING S06 section"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile && pnpm build; rate limit >= 500.
       P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); echo "P=$P"
       Confirm the master policy tree id is d997b1e362c75af03942da0e7a1e8902ca5dbe51 (else STOP, status fail: the previous
       scenario did not restore the policy).
    3. Before: bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-P | tail -n 2 ; gh api repos/steady-orchard/patch-steward-testbed-unwritable --jq .full_name 2>&1 | head -n 1
    4. bash scenarios/tools/deploy-steward.sh org-public scenarios/fixtures/policies/unwritable-store.yml   (must end `result=ok`); record the new master policy tree id.
    5. A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
       R=steady-orchard/patch-steward-testbed-public; BASE="$(tr -d '\r' < scenarios/fixtures/submissions/unstructured.txt)"; gh pr edit P -R "$R" --body "$(printf '%s\n\nScenario body edit: S07 while the evidence store is unwritable.\n' "$BASE")" > /dev/null && echo "edit utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    6. PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr P author 2095171 event pull_request_target edited sender 2095171 User" "$A" 1
       (repeat once on exit 3). S07RUN = its run id.
    7. gh run view S07RUN -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
       bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public S07RUN 1 gate | grep -E 'text=(event |policy |listing |dedup |disposition |- )'
       bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public S07RUN 1 publish | grep -E 'text=(policy |ownership |evidence commit |freshness |steward job summary:|- |##\[error\])'
    8. After: bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-P | tail -n 2 ;
       bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr P | grep -c "^RECORD run=S07RUN-1 "   (expected 0)
    9. Restore: bash scenarios/tools/deploy-steward.sh org-public (must end `result=ok`), then the master policy tree id
       (expected d997b1e...). Restore failure: retry once; still failing -> STOP, status fail, line `POLICY NOT RESTORED` in the report.
    10. Append `## S07 unwritable evidence store: publish fails and publishes nothing` (commands 3-9 with outputs; DEPLOY
        output may be reduced to its SCENARIO-DEPLOY line); prettier;
        `bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S17`.
    11. Report: at column 0 the lines `s07_run: <S07RUN>` and `s07_failure: <the code in the publish summary Failure line>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.17-report.md","utf8");console.log(/^s07_run: [0-9]+\s*$/m.test(s)&&/^s07_failure: [a-z][a-z0-9.-]+\s*$/m.test(s)&&!s.includes("POLICY NOT RESTORED")?"report ok":"report incomplete")'
       -> prints exactly: report ok
    2. R=steady-orchard/patch-steward-testbed-public; run=$(grep -m1 -o '^s07_run: [0-9]*' development-artifacts/patch-steward-m6-5.17-report.md | cut -d' ' -f2); gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(dedup commit [a-z-]+|disposition early-exit|- Owner: committed \`$run-1\`)\$"; bash scenarios/tools/run-log.sh $R $run 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(evidence commit |- Evidence: )'; bash scenarios/tools/run-log.sh $R $run 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(- Status: `failed`|- Failure: `[a-z][a-z0-9.-]+`)$'
       -> prints exactly four lines: screen / build=success,screen / gate=success,screen / publish=failure, 3, 0, 2
    3. R=steady-orchard/patch-steward-testbed-public; P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); run=$(grep -m1 -o '^s07_run: [0-9]*' development-artifacts/patch-steward-m6-5.17-report.md | cut -d' ' -f2); bash scenarios/tools/artifacts.sh $R steward-ownership-pr-$P | grep -c "run_id=$run "; bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $P | grep -c "^RECORD run=$run-1 "; gh api "repos/$R/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
       -> prints exactly three lines: 1, 0, d997b1e362c75af03942da0e7a1e8902ca5dbe51
    4. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (results section only). On the test-bed, re-run `bash scenarios/tools/deploy-steward.sh
    org-public` if the valid policy is not on master.
