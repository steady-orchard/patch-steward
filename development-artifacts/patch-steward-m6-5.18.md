# Step 5.18

- id: 5.18
- depends_on: [5.17]
- route: mechanical
- objective: Scenario S10, issue part one, on org-public: open an unstructured issue (commits a first owner), edit only its title (duplicate), then edit its body (commits a new owner); record in scenarios/results/org-public.md.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.18-report.md
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

    TEST-BED R = steady-orchard/patch-steward-testbed-public; the valid trusted policy is on master (tree id
    d997b1e362c75af03942da0e7a1e8902ca5dbe51; check it before starting:
    `gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'`).
    Issue events run the wrapper `steward-issues.yml`. The body scenarios/fixtures/submissions/unstructured.txt follows no
    issue form: contract not met, disposition early-exit, outcome needs-changes, no caps. Run the three events strictly one
    after the other (wait for each run to complete before the next event).
    Expected: (1) open: gate `listing none`, `dedup commit no-owner`, `disposition early-exit`; publish `freshness current`,
    outcome needs-changes. (2) title-only edit: jobs build success, gate success, publish skipped; gate
    `listing unique owner <open run>-1`, `dedup duplicate owner-unchanged owner <open run>-1`, summary `- Status: `duplicate``.
    (3) body edit: gate `listing unique owner <open run>-1`, `dedup commit snapshot-changed`, `disposition early-exit`;
    publish `freshness current`. Evidence: two run directories (open and body runs), both outcome needs-changes.

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
    1. Base check (files changed in step 5.17): bash -c 'grep -q "^s07_run: [0-9]" development-artifacts/patch-steward-m6-5.17-report.md 2>/dev/null || echo "MISSING 5.17 report"; grep -q "^## S07 " scenarios/results/org-public.md || echo "MISSING S07 section"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile && pnpm build; rate limit >= 500; master policy tree id = d997b1e... (else STOP, status fail).
    3. Open: A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A";
       gh issue create -R steady-orchard/patch-steward-testbed-public --title "[scenario S10] issue lifecycle" --body-file scenarios/fixtures/submissions/unstructured.txt
       (exactly once; I = the number at the end of the printed URL);
       PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue I author 2095171 event issues opened sender 2095171 User" "$A" 1   -> OPENRUN
    4. Title edit: new A; gh issue edit I -R steady-orchard/patch-steward-testbed-public --title "[scenario S10] issue lifecycle (title edited)";
       await with title prefix "steward issue I author 2095171 event issues edited sender 2095171 User" -> TITLERUN
    5. Body edit: new A; R=steady-orchard/patch-steward-testbed-public; BASE="$(tr -d '\r' < scenarios/fixtures/submissions/unstructured.txt)"; gh issue edit I -R "$R" --body "$(printf '%s\n\nScenario body edit: S10.\n' "$BASE")";
       await with the same `edited` prefix and the new A -> BODYRUN
    6. For each of OPENRUN, TITLERUN, BODYRUN record: gh run view <id> -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")' ;
       bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public <id> 1 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)' ;
       and for OPENRUN and BODYRUN: bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public <id> 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Freshness)'
    7. bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-issue-I ;
       bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue I
    8. Append `## S10 issue: open, title edit, body edit` (all commands and outputs); prettier;
       `bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S17`.
    9. Leave the issue OPEN. Report: at column 0 the lines `s10_issue: <I>`, `s10_open_run: <OPENRUN>`,
       `s10_title_run: <TITLERUN>`, `s10_body_run: <BODYRUN>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.18-report.md","utf8");const ok=[/^s10_issue: [0-9]+\s*$/m,/^s10_open_run: [0-9]+\s*$/m,/^s10_title_run: [0-9]+\s*$/m,/^s10_body_run: [0-9]+\s*$/m].every(r=>r.test(s));console.log(ok?"report ok":"report incomplete")'
       -> prints exactly: report ok
    2. R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.18-report.md; o=$(grep -m1 -o '^s10_open_run: [0-9]*' $f | cut -d' ' -f2); t=$(grep -m1 -o '^s10_title_run: [0-9]*' $f | cut -d' ' -f2); b=$(grep -m1 -o '^s10_body_run: [0-9]*' $f | cut -d' ' -f2); for r in $o $t $b; do gh run view $r -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; done; bash scenarios/tools/run-log.sh $R $o 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(listing none|dedup commit no-owner|disposition early-exit)$'; bash scenarios/tools/run-log.sh $R $t 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(listing unique owner $o-1|dedup duplicate owner-unchanged owner $o-1|- Status: \`duplicate\`)\$"; bash scenarios/tools/run-log.sh $R $b 1 gate | grep -c -E "^LOG job=gate ts=[^ ]+ text=(listing unique owner $o-1|dedup commit snapshot-changed|disposition early-exit)\$"
       -> prints exactly six lines: screen / build=success,screen / gate=success,screen / publish=success, screen / build=success,screen / gate=success,screen / publish=skipped, screen / build=success,screen / gate=success,screen / publish=success, 3, 3, 3
    3. R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.18-report.md; i=$(grep -m1 -o '^s10_issue: [0-9]*' $f | cut -d' ' -f2); o=$(grep -m1 -o '^s10_open_run: [0-9]*' $f | cut -d' ' -f2); b=$(grep -m1 -o '^s10_body_run: [0-9]*' $f | cut -d' ' -f2); bash scenarios/tools/run-records.sh runs $R steward-evidence $R issue $i | grep -c -E "^RECORD run=($o|$b)-1 kind=outcome outcome=needs-changes "
       -> prints exactly: 2
    4. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (results section only). Test-bed effects stay (open issue, append-only evidence).
