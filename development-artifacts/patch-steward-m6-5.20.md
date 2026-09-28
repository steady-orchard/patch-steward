# Step 5.20

- id: 5.20
- depends_on: [5.19]
- route: mechanical
- objective: Scenario S10, pull request part, on org-public: open and close a pull request by its author (resolution closed-by-author), and open a pull request against the base branch scenario-s10-base and merge it (resolution merged), recording which case the non-default-base runs show; record in scenarios/results/org-public.md.
- files_in_scope:
    - scenarios/results/org-public.md
    - development-artifacts/patch-steward-m6-5.20-report.md
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
    Merging is authorized ONLY into the scenario base branch `scenario-s10-base` created in this step; never merge into
    master or any other branch.

    TEST-BED R = steady-orchard/patch-steward-testbed-public (valid trusted policy on master). Create branches with
    probes/smoke/tools/deploy.sh (clones over SSH; creates the branch from R's master when absent; commits only when a file
    differs; pushes the new branch even without a commit; never forces; prints DEPLOY lines).
    Pull request events run the wrapper `steward-pr.yml` from R's master. For pull_request_target, GitHub runs the
    default-branch workflow definition with GITHUB_REF refs/heads/master and evaluates the default-branch-only Environment
    steward-publication for the default branch REGARDLESS of the pull request's base branch (measured earlier on this
    test-bed with a pull request into a non-default base). So a pull request into `scenario-s10-base` is expected to be
    screened normally: case `pass`. If GitHub has changed and the run is refused, that is a platform finding for the
    maintainers, not something to work around: record which case occurred and stop. Cases, decided for one run by the
    classifier `cls` (define it by running its one-line definition below, then call `cls steady-orchard/patch-steward-testbed-public <run id>`):
      pass                   jobs build, gate, publish all success;
      refused-event-invalid  the gate summary shows `- Failure: `gate.event-invalid`` (the steward's event check refused the ref);
      refused-environment    the gate job failed without running steps or with an annotation mentioning environment
                             protection rules (the Environment refused the deployment);
      other-failure          anything else.
    Classifier definition (one line; paste exactly into the same Bash call before using it):
      cls() { local R=$1 run=$2 j ei gid gs ann; j=$(gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'); if [ "$j" = "screen / build=success,screen / gate=success,screen / publish=success" ]; then echo pass; return; fi; ei=$(bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -F 'text=- Failure: `gate.event-invalid`'); if [ "$ei" -gt 0 ]; then echo refused-event-invalid; return; fi; gid=$(gh run view $run -R $R --json jobs --jq '.jobs[] | select(.name=="screen / gate") | .databaseId'); gs=$(gh run view $run -R $R --json jobs --jq '[.jobs[] | select(.name=="screen / gate") | (.steps | length)] | .[0] // 0'); ann=$(gh api repos/$R/check-runs/$gid/annotations --jq '[.[].message | select(test("protection rule"; "i"))] | length' 2>/dev/null || echo 0); if echo "$j" | grep -q 'screen / gate=failure' && { [ "$gs" = 0 ] || [ "$ann" -gt 0 ]; }; then echo refused-environment; return; fi; echo other-failure; }
    Closure facts: action `closed` never captures or commits; the gate logs `disposition closure resolution <r>`
    (merged when the pull request was merged; else closed-by-author when the sender is the author (you); else
    closed-by-maintainer); publish commits one metrics file with a `maintainer-resolution` event (paired with the newest
    committed owner) and no run directory; publish summary `- Status: `closure``.
    Body for both pull requests: scenarios/fixtures/submissions/unstructured.txt (contract not met: the opened runs commit
    with early-exit, outcome needs-changes).

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
    1. Base check (files changed in step 5.19): bash -c 'grep -q "^s10_app_close_run: [0-9]" development-artifacts/patch-steward-m6-5.19-report.md 2>/dev/null || echo "MISSING 5.19 report"; grep -q "^## S10 issue: close" scenarios/results/org-public.md || echo "MISSING S10 part two"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile && pnpm build; rate limit >= 500.
    3. Pull request closed by its author:
       a. bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public scenario-s10-close "scenario: S10 pull request change" scenarios/fixtures/submissions/unstructured.txt:scenario-s10-close.txt
       b. A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); gh pr create -R steady-orchard/patch-steward-testbed-public --base master --head scenario-s10-close --title "[scenario S10] pull request closed by its author" --body-file scenarios/fixtures/submissions/unstructured.txt   (Q = its number)
       c. PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr Q author 2095171 event pull_request_target opened sender 2095171 User" "$A" 1   -> QOPEN
       d. new A; gh pr close Q -R steady-orchard/patch-steward-testbed-public ; await with prefix "steward pr Q author 2095171 event pull_request_target closed sender 2095171 User" -> QCLOSE
       e. record for QOPEN and QCLOSE: jobs; gate lines (run-log gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'); publish lines (run-log publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence)');
          bash scenarios/tools/run-records.sh metrics steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public QCLOSE-1
    4. Pull request merged into a scenario base:
       a. bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public scenario-s10-base "scenario: S10 base branch" scenarios/workflows/steward-pr.yml
          (the file is identical to master's wrapper, so this only creates branch scenario-s10-base at master's commit; expect `DEPLOY commit=none reason=already-identical` and a push)
       b. bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public scenario-s10-merge "scenario: S10 merge change" scenarios/fixtures/submissions/unstructured.txt:scenario-s10-merge.txt
       c. new A; gh pr create -R steady-orchard/patch-steward-testbed-public --base scenario-s10-base --head scenario-s10-merge --title "[scenario S10] pull request merged into a scenario base" --body-file scenarios/fixtures/submissions/unstructured.txt   (M = its number)
       d. await with prefix "steward pr M author 2095171 event pull_request_target opened sender 2095171 User" -> MOPEN; then `cls steady-orchard/patch-steward-testbed-public MOPEN` (define cls first) -> OPENCASE.
          If OPENCASE is not `pass`: do NOT merge; record jobs, `gh run view MOPEN -R ... --log-failed | tail -n 60` (drop lines containing `^[`), the gate
          check-run annotations (`gh api repos/steady-orchard/patch-steward-testbed-public/check-runs/<gate job databaseId>/annotations --jq '.[].message'`);
          set CLOSECASE=not-run; write the section with `Result: fail` and the case; status fail; go to step 6.
       e. new A; gh pr merge M -R steady-orchard/patch-steward-testbed-public --merge ; await with prefix "steward pr M author 2095171 event pull_request_target closed sender 2095171 User" -> MCLOSE; `cls ... MCLOSE` -> CLOSECASE (same failure evidence when not pass).
       f. record for MOPEN and MCLOSE: jobs, gate and publish lines as in 3e; run-records metrics for MCLOSE-1;
          gh pr view M -R steady-orchard/patch-steward-testbed-public --json state,baseRefName --jq '.state + " " + .baseRefName'   (MERGED scenario-s10-base)
    5. bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr M   (append_only, run, and final lines)
    6. Append `## S10 pull requests: close by the author, merge into a scenario base` (commands and outputs; state the two
       cases in one sentence: "Runs of the pull request into scenario-s10-base: opened <OPENCASE>, closed <CLOSECASE>.");
       prettier; `bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S17`.
    7. Report: at column 0 the lines `s10_close_pr: <Q>`, `s10_close_pr_run: <QCLOSE>`, `s10_merge_pr: <M>`,
       `s10_merge_opened_run: <MOPEN>`, `s10_merge_closed_run: <MCLOSE or none>`, `s10_merge_opened_case: <OPENCASE>`,
       `s10_merge_closed_case: <CLOSECASE>`.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. f=development-artifacts/patch-steward-m6-5.20-report.md; R=steady-orchard/patch-steward-testbed-public; cls() { local R=$1 run=$2 j ei gid gs ann; j=$(gh run view $run -R $R --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'); if [ "$j" = "screen / build=success,screen / gate=success,screen / publish=success" ]; then echo pass; return; fi; ei=$(bash scenarios/tools/run-log.sh $R $run 1 gate | grep -c -F 'text=- Failure: `gate.event-invalid`'); if [ "$ei" -gt 0 ]; then echo refused-event-invalid; return; fi; gid=$(gh run view $run -R $R --json jobs --jq '.jobs[] | select(.name=="screen / gate") | .databaseId'); gs=$(gh run view $run -R $R --json jobs --jq '[.jobs[] | select(.name=="screen / gate") | (.steps | length)] | .[0] // 0'); ann=$(gh api repos/$R/check-runs/$gid/annotations --jq '[.[].message | select(test("protection rule"; "i"))] | length' 2>/dev/null || echo 0); if echo "$j" | grep -q 'screen / gate=failure' && { [ "$gs" = 0 ] || [ "$ann" -gt 0 ]; }; then echo refused-environment; return; fi; echo other-failure; }; o=$(grep -m1 -o '^s10_merge_opened_run: [0-9]*' $f | cut -d' ' -f2); c=$(grep -m1 -o '^s10_merge_closed_run: [0-9a-z]*' $f | cut -d' ' -f2); ro=$(grep -m1 -o '^s10_merge_opened_case: [a-z-]*' $f | cut -d' ' -f2); rc=$(grep -m1 -o '^s10_merge_closed_case: [a-z-]*' $f | cut -d' ' -f2); lo=$(cls $R $o); if [ "$c" = none ]; then lc=not-run; else lc=$(cls $R $c); fi; [ "$lo" = "$ro" ] && [ "$lc" = "$rc" ] && echo "merge base opened=$lo closed=$lc consistent" || echo "merge base report opened=$ro closed=$rc live opened=$lo closed=$lc inconsistent"
       -> prints exactly: merge base opened=pass closed=pass consistent
       (any other output distinguishes the case: a `refused-*` case is a platform change for the supervisor's revision loop)
    2. f=development-artifacts/patch-steward-m6-5.20-report.md; R=steady-orchard/patch-steward-testbed-public; q=$(grep -m1 -o '^s10_close_pr_run: [0-9]*' $f | cut -d' ' -f2); m=$(grep -m1 -o '^s10_merge_closed_run: [0-9]*' $f | cut -d' ' -f2); bash scenarios/tools/run-log.sh $R $q 1 gate | grep -c -x -E 'LOG job=gate ts=[^ ]+ text=disposition closure resolution closed-by-author'; bash scenarios/tools/run-log.sh $R $m 1 gate | grep -c -x -E 'LOG job=gate ts=[^ ]+ text=disposition closure resolution merged'; bash scenarios/tools/run-records.sh metrics $R steward-evidence $R $q-1 | grep -c -E ' kind=maintainer-resolution subject=submission action_kind=resolution resolution=closed-by-author paired_run=[0-9]+-[0-9]+ '; bash scenarios/tools/run-records.sh metrics $R steward-evidence $R $m-1 | grep -c -E ' kind=maintainer-resolution subject=submission action_kind=resolution resolution=merged paired_run=[0-9]+-[0-9]+ '
       -> prints exactly four lines: 1, 1, 1, 1
    3. R=steady-orchard/patch-steward-testbed-public; m=$(grep -m1 -o '^s10_merge_pr: [0-9]*' development-artifacts/patch-steward-m6-5.20-report.md | cut -d' ' -f2); gh pr view $m -R $R --json state,baseRefName --jq '.state + " " + .baseRefName'
       -> prints exactly: MERGED scenario-s10-base
    4. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S17 | tail -n 1
       -> prints exactly: RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- rollback: |
    git revert <this step's commit> (results section only). Test-bed effects stay: branches scenario-s10-close,
    scenario-s10-base (now holding the merge), scenario-s10-merge; closed and merged pull requests; append-only evidence.
