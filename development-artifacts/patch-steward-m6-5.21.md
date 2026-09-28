# Step 5.21

- id: 5.21
- depends_on: [5.20, 5.5]
- route: mechanical
- objective: Scenario S11 (daily cap) on org-public: with a policy whose daily run cap is 1, contract-met issues end queued with a persisted waiting run directory (waiting.json, reason daily-runs); restore the policy; record in scenarios/results/org-public.md.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.21-report.md
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

    TEST-BED R = steady-orchard/patch-steward-testbed-public. WRITE tool `bash scenarios/tools/deploy-steward.sh org-public
    [<policy file>]` deploys the unchanged wrappers and the policy (default: the valid scenarios/fixtures/policies/orphan-branch.yml)
    to master; last line `SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-public pin=<sha> policy=<file> result=ok`.
    scenarios/fixtures/policies/caps-daily.yml = the valid policy with `limits.caps.daily_runs: 1` and
    `limits.caps.per_author_concurrent_runs: 20`. Master policy tree id:
      gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
    (d997b1e362c75af03942da0e7a1e8902ca5dbe51 for the valid policy).
    Caps (evaluated only for runnable work, i.e. a met contract): the daily count = steward wrapper runs created on the
    current UTC date on R whose display title does not name the App bot as sender, this run included; queued when the count
    is above the cap (first exceeded cap reported: daily before per-author). With cap 1, any issue whose run is not the only
    non-bot wrapper run of the UTC day is queued; the second issue below is always queued unless the UTC date changed
    between the two issues. The body fixtures/submissions/defect-complete.txt is a complete defect issue form (contract met).
    A queued run commits an owner (disposition queued) and publish writes a WAITING run directory: run.json, submission.json,
    policy-revision.json, waiting.json (state queued, reason, counts, arrival_at), logs/steward.txt, manifest.json (run_kind
    waiting), no decision; publish summary `- Status: `queued``; freshness is still checked (`freshness current`).
    Scenario S11 (daily) pass: at least one of the issues has gate lines `caps daily-runs daily <c> of 1 author <a> of 20` and
    `disposition queued`, publish `- Status: `queued``, a record `RECORD run=<run>-1 kind=waiting state=queued
    reason=daily-runs daily=<c>/1 author=<a>/20 ...`, and evidence.sh `EVIDENCE run=<run>-1 kind=waiting manifest=verified`
    with `result=ok`; the valid policy is restored afterwards. Restore ONLY after all runs completed (publish rereads the
    live default-branch policy for its freshness check); trigger nothing else on R while caps-daily.yml is deployed.

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
    1. Base check (files changed in steps 5.20 and 5.5): bash -c 'grep -q "^s10_merge_pr: [0-9]" development-artifacts/patch-steward-m6-5.20-report.md 2>/dev/null || echo "MISSING 5.20 report"; [ -f scenarios/fixtures/policies/caps-daily.yml ] || echo "MISSING caps-daily.yml"; grep -q "^## S10 pull requests" scenarios/results/org-public.md || echo "MISSING S10 pull request section"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile && pnpm build; rate limit >= 500; master policy tree id = d997b1e... (else STOP, status fail).
    3. bash scenarios/tools/deploy-steward.sh org-public scenarios/fixtures/policies/caps-daily.yml   (must end `result=ok`); record the new master policy tree id.
    4. First issue: A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); gh issue create -R steady-orchard/patch-steward-testbed-public --title "[scenario S11] daily cap, first issue" --body-file fixtures/submissions/defect-complete.txt   (N1);
       PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue N1 author 2095171 event issues opened sender 2095171 User" "$A" 1   -> RUN1
    5. Second issue (after RUN1 completed): same with title "[scenario S11] daily cap, second issue" -> N2, RUN2.
       If NEITHER run shows `disposition queued` in its gate log (only possible across a UTC date change), create one more
       issue "[scenario S11] daily cap, third issue" the same way (N3, RUN3); never more.
    6. For each run: jobs; bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public <run> 1 gate | grep -E 'text=(event |policy |listing |dedup |caps |disposition |- Status|- Caps)' ;
       bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public <run> 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence)' ;
       bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue <n> ;
       bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue <n>   (the run, and final lines)
    7. Restore (after every run completed): bash scenarios/tools/deploy-steward.sh org-public (must end `result=ok`); the
       master policy tree id must be d997b1e...; failure -> retry once; still failing -> STOP, status fail, line `POLICY NOT RESTORED`.
    8. Append `## S11 daily run cap: over-cap work waits` (commands 3-7 with outputs); prettier;
       `bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S17`.
    9. Leave the issues OPEN. Report: at column 0 the lines `s11_daily_issue: <number of a queued issue>` and
       `s11_daily_run: <its run id>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.21-report.md","utf8");console.log(/^s11_daily_issue: [0-9]+\s*$/m.test(s)&&/^s11_daily_run: [0-9]+\s*$/m.test(s)&&!s.includes("POLICY NOT RESTORED")?"report ok":"report incomplete")'
       -> prints exactly: report ok
    2. R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.21-report.md; n=$(grep -m1 -o '^s11_daily_issue: [0-9]*' $f | cut -d' ' -f2); run=$(grep -m1 -o '^s11_daily_run: [0-9]*' $f | cut -d' ' -f2); gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(caps daily-runs daily [0-9]+ of 1 author [0-9]+ of 20|disposition queued)$'; bash scenarios/tools/run-log.sh $R $run 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(- Status: `queued`|freshness current)$'
       -> prints exactly three lines: screen / build=success,screen / gate=success,screen / publish=success, 2, 2
    3. R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.21-report.md; n=$(grep -m1 -o '^s11_daily_issue: [0-9]*' $f | cut -d' ' -f2); run=$(grep -m1 -o '^s11_daily_run: [0-9]*' $f | cut -d' ' -f2); bash scenarios/tools/run-records.sh runs $R steward-evidence $R issue $n | grep -c -E "^RECORD run=$run-1 kind=waiting state=queued reason=daily-runs daily=[0-9]+/1 author=[0-9]+/20 arrival_at=\S+ policy_revision=[0-9a-f]{40} snapshot=sha256:[0-9a-f]{64}\$"; bash scenarios/tools/evidence.sh $R steward-evidence $R issue $n | grep -c -E "^EVIDENCE run=$run-1 kind=waiting manifest=verified\$|^EVIDENCE target=$R subject=issue-$n runs=1 verified=1 result=ok\$"; gh api "repos/$R/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
       -> prints exactly three lines: 1, 2, d997b1e362c75af03942da0e7a1e8902ca5dbe51
    4. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (results section only). On the test-bed, re-run `bash scenarios/tools/deploy-steward.sh
    org-public` if the valid policy is not on master.
