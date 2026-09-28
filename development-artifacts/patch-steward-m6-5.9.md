# Step 5.9

- id: 5.9
- depends_on: [5.1, 5.2, 5.4]
- route: mechanical
- objective: On the org-private test-bed, re-verify the publication Environment (OA1) and the private evidence repository (OA2), run the Environment-only secret delivery check (S17) and one contract-met issue screening into the separate evidence repository (S16, which also proves OA3), and create scenarios/results/org-private.md.
- files_in_scope:
    - scenarios/results/org-private.md
    - development-artifacts/patch-steward-m6-5.9-report.md
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
    Keep org-private runs minimal (Actions minutes are limited): exactly one S17 dispatch and one S15-style issue unless a
    retry is written in actions.

    TEST-BED Q = steady-orchard/patch-steward-testbed-private (private; default branch master). Its master holds the two
    steward wrappers (run only for senders 2095171 and 331019482) and `.github/patch-steward/policy.yml` (all observe;
    evidence store = type repository, repository E = steady-orchard/patch-steward-testbed-evidence (private), branch
    `steward-evidence`, absent until the first publish creates it with a root commit; daily run cap 50, per-author cap 2).
    Store paths inside E are prefixed with Q's full name (steady-orchard/patch-steward-testbed-private/runs/...). Q itself
    must NOT get a `steward-evidence` branch.

    Owner actions: OA1 = Environment `steward-publication` on Q with secrets PATCH_STEWARD_APP_ID and
    PATCH_STEWARD_APP_PRIVATE_KEY, deployment branch policy `master`, no repository or organization secret named
    PATCH_STEWARD_* (`bash scenarios/tools/environment-check.sh Q`: four checks, last line
    `ENVIRONMENT repo=<r> result=ok|incomplete`). OA2 = E exists, is private, and has at least one commit; verify commands and
    expected outputs:
      gh api repos/steady-orchard/patch-steward-testbed-evidence --jq '[.private, .size >= 0]'      -> [true,true]
      gh api repos/steady-orchard/patch-steward-testbed-evidence/commits --jq length                -> a number >= 1
    OA3 = E is among the selected repositories of the organization App installation; proved only by the S16 run:
      (a) gate: first attempt of the new issue's `opened` event logs `listing none`, mints a read token for E for the
      published-snapshot fallback read, logs `dedup commit no-owner`, and the gate job succeeds; (b) publish mints a write
      token for E and commits there: log `evidence commit <sha> rebuilds <n>`, and
      `gh api "repos/steady-orchard/patch-steward-testbed-evidence/commits?sha=steward-evidence&per_page=5" --jq '[.[].sha]'`
      includes <sha>. OA3 MISSING: after `listing none` the gate fails with summary `- Failure: `ownership.listing-unavailable``,
      or publish fails (summary `- Failure: ...` such as `github.not-found`, `github.unauthorized`, `app-auth.token-scope-mismatch`)
      before any `evidence commit` line. No product log line names token repositories; never expect one.

    Scenario S17: `bash scenarios/tools/secret-scope.sh run <r>` checks the helper pair against the product files (lines
    `SECRET-SCOPE check=mapping identical`, `SECRET-SCOPE check=declarations identical`), deploys
    scenarios/workflows/scenario-secret-scope.yml and scenario-secret-scope-called.yml to Q's master (DEPLOY lines),
    dispatches the caller (DISPATCH lines incl. `DISPATCH run_id=<id> url=...`), waits, and prints
    `SECRET-SCOPE job=<outside|inside> line=<text>` for every log line containing `length-zero=` (this ALSO includes lines
    echoed from the step script, whose text starts with `^[`), then `SECRET-SCOPE repo=<r> run=<id> url=<url> result=pass|fail`.
    Pass: job outside prints `PATCH_STEWARD_APP_ID length-zero=true` and `PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true`;
    job inside prints both `length-zero=false`; no `-----BEGIN` in the log.

    Scenario S16: one contract-met issue (body fixtures/submissions/defect-complete.txt). Expected: jobs all success; gate
    lines `listing none`, `dedup commit no-owner`, `caps within daily <c> of 50 author <a> of 2`, `disposition runnable`;
    publish `evidence commit <sha> rebuilds <n>`, `freshness current`, summary `- Status: `inconclusive``; the run directory
    is in E (evidence.sh on E shows one verified outcome run), and Q has no `steward-evidence` branch.

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

    RESULTS FILE scenarios/results/org-private.md (new, persistent, Prettier-checked). Create it with:
      line 1 `# Scenario results: org-private`; blank line; one paragraph: Test-bed `steady-orchard/patch-steward-testbed-private`
      with the separate evidence repository `steady-orchard/patch-steward-testbed-evidence`. Verbatim evidence from the
      test-bed scenario suite described in `../README.md`; command output is copied unchanged inside `text` fences. Sections
      appear in the order the scenarios ran.
    then `## S17 publication Environment delivers the App secrets only to Environment jobs` and
    `## S16 contract-met issue published to the separate evidence repository`, each: blank line; `Date (UTC): <YYYY-MM-DD>.`
    plus one to three sentences (issue URL, run URL); ```text fences each holding `$ <command>` and its verbatim output;
    blank line; `Result: pass` (or `Result: fail` with one sentence why). In the S17 section copy the secret-scope output
    EXCEPT every `SECRET-SCOPE job=... line=...` line whose text after `line=` starts with `^[`. Put the evidence repository
    check (OA2 commands and outputs) in the S16 section as "the evidence repository check". Forbidden anywhere in the file:
    planning identifiers (milestone, phase, step, gate-item, owner-action or rule ids; "owner decision";
    `development-artifacts`), the probe suite's App secret names, `ghs_`, `ghp_`, `-----BEGIN`, the characters `^[`, raw
    control characters. Call the Environment check "the publication Environment check".
- actions: |
    1. Base check (files changed in steps 5.1, 5.2, 5.4, plus phase 4 tools): bash -c 'for f in scenarios/tools/run-log.sh scenarios/tools/await-runs.sh scenarios/tools/run-records.sh scenarios/tools/results-check.sh scenarios/tools/environment-check.sh scenarios/tools/secret-scope.sh scenarios/tools/evidence.sh fixtures/submissions/defect-complete.txt; do [ -f "$f" ] || echo "MISSING $f"; done; grep -q "kind=waiting manifest=" scenarios/tools/evidence.sh || echo "MISSING evidence.sh waiting check"; [ -e scenarios/results/org-private.md ] && echo "UNEXPECTED scenarios/results/org-private.md"; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile && pnpm build
    3. OA1 verify: bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-private
       Record verbatim in a report section `## OA1 verify (org-private)`. Last line not
       `ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private result=ok` -> STOP before any write; status fail; line
       `OA1 not done on steady-orchard/patch-steward-testbed-private: <first MISMATCH line>`; no results file.
    4. OA2 verify: run the two OA2 commands from context; record commands and outputs in a report section `## OA2 verify`.
       Not `[true,true]` and a number >= 1 -> STOP before any write; status fail; line
       `OA2 not done on steady-orchard/patch-steward-testbed-evidence: <command> printed <output>`; no results file.
    5. S17: bash scenarios/tools/secret-scope.sh run steady-orchard/patch-steward-testbed-private   (Bash tool timeout 600000)
       Record the full output in the report. If the Bash call itself times out, list
       `gh run list -R steady-orchard/patch-steward-testbed-private --workflow scenario-secret-scope.yml --limit 3`, wait until
       that run completes, and run the same command once more. S17_RUN = the id from `DISPATCH run_id=`.
    6. S16 (Q=steady-orchard/patch-steward-testbed-private, E=steady-orchard/patch-steward-testbed-evidence):
       a. gh api repos/steady-orchard/patch-steward-testbed-private/git/ref/heads/steward-evidence > /dev/null 2>&1; echo "target store branch exit $?"   (expected exit 1: absent)
       b. A=$(gh api "repos/steady-orchard/patch-steward-testbed-private/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
       c. gh issue create -R steady-orchard/patch-steward-testbed-private --title "[scenario S16] contract-met issue" --body-file fixtures/submissions/defect-complete.txt
          (exactly once; N = the number at the end of the printed URL; record URL and `date -u +%Y-%m-%dT%H:%M:%SZ`)
       d. PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-private steward-issues.yml "steward issue N author 2095171 event issues opened sender 2095171 User" "$A" 1
          (repeat once on exit 3). RUN = the id in its RUN line.
       e. gh run view RUN -R steady-orchard/patch-steward-testbed-private --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
          Expected: screen / build=success,screen / gate=success,screen / publish=success. Otherwise record the gate and
          publish run-log lines (f) and check the OA3-missing signals (report line
          `OA3 not done on steady-orchard/patch-steward-testbed-evidence: <failure line>`), status fail.
       f. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-private RUN 1 gate | grep -E 'text=(event |policy |listing |dedup |caps |disposition |steward job summary:|- )'
          and the same for `publish` with `text=(policy |ownership |evidence commit |freshness |steward job summary:|- )`.
          C = the sha in `evidence commit <sha> rebuilds <n>`.
       g. gh api "repos/steady-orchard/patch-steward-testbed-evidence/commits?sha=steward-evidence&per_page=5" --jq '[.[].sha]'   (must include C)
       h. bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-evidence steward-evidence steady-orchard/patch-steward-testbed-private issue N
       i. bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-evidence steward-evidence steady-orchard/patch-steward-testbed-private issue N
       j. repeat a. (expected again: target store branch exit 1)
    7. Write scenarios/results/org-private.md per context (S17 then S16; S16 holds OA2 check, commands a-j and outputs).
    8. pnpm exec prettier --write scenarios/results/org-private.md; bash scenarios/tools/results-check.sh scenarios/results/org-private.md S16 S17
    9. Leave issue N OPEN. Report: include at column 0 the lines `s17_run: <S17_RUN>`, `s16_issue: <N>`, `s16_run: <RUN>`,
       `s16_commit: <C>` and a section `## OA3 proof` stating signals (a) and (b) with the log lines that show them.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.9-report.md","utf8");const ok=[/^s17_run: [0-9]+\s*$/m,/^s16_issue: [0-9]+\s*$/m,/^s16_run: [0-9]+\s*$/m,/^s16_commit: [0-9a-f]{40}\s*$/m].every(r=>r.test(s))&&!/OA[123] not done/.test(s);console.log(ok?"report ok":"report incomplete")'
       -> prints exactly: report ok
    2. bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-private | tail -n 1; gh api repos/steady-orchard/patch-steward-testbed-evidence --jq '[.private, .size >= 0]'
       -> prints exactly two lines: ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private result=ok, [true,true]
    3. f=development-artifacts/patch-steward-m6-5.9-report.md; run=$(grep -m1 -o '^s17_run: [0-9]*' $f | cut -d' ' -f2); for j in outside inside; do bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-private "$run" 1 $j; done | grep -c -x -E 'LOG job=outside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=true|LOG job=inside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=false'; gh run view "$run" -R steady-orchard/patch-steward-testbed-private --log | grep -c -e '-----BEGIN'
       -> prints exactly two lines: 4, 0
    4. f=development-artifacts/patch-steward-m6-5.9-report.md; Q=steady-orchard/patch-steward-testbed-private; run=$(grep -m1 -o '^s16_run: [0-9]*' $f | cut -d' ' -f2); c=$(grep -m1 -o '^s16_commit: [0-9a-f]*' $f | cut -d' ' -f2); gh run view "$run" -R $Q --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $Q "$run" 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(listing none|dedup commit no-owner|disposition runnable|caps within daily [0-9]+ of 50 author [0-9]+ of 2)$'; bash scenarios/tools/run-log.sh $Q "$run" 1 publish | grep -c -E "^LOG job=publish ts=[^ ]+ text=(evidence commit $c rebuilds [0-9]+|freshness current|- Status: \`inconclusive\`)\$"
       -> prints exactly three lines: screen / build=success,screen / gate=success,screen / publish=success, 4, 3
    5. f=development-artifacts/patch-steward-m6-5.9-report.md; Q=steady-orchard/patch-steward-testbed-private; E=steady-orchard/patch-steward-testbed-evidence; n=$(grep -m1 -o '^s16_issue: [0-9]*' $f | cut -d' ' -f2); run=$(grep -m1 -o '^s16_run: [0-9]*' $f | cut -d' ' -f2); c=$(grep -m1 -o '^s16_commit: [0-9a-f]*' $f | cut -d' ' -f2); bash scenarios/tools/evidence.sh $E steward-evidence $Q issue "$n" | grep -c -E "^EVIDENCE append_only=yes\$|^EVIDENCE run=$run-1 kind=outcome outcome=inconclusive manifest=verified metrics=verified errors=0\$|^EVIDENCE target=$Q subject=issue-$n runs=1 verified=1 result=ok\$"; gh api "repos/$E/commits?sha=steward-evidence&per_page=5" --jq '[.[].sha]' | grep -c "$c"; gh api repos/$Q/git/ref/heads/steward-evidence > /dev/null 2>&1; echo "target store branch exit $?"
       -> prints exactly three lines: 3, 1, target store branch exit 1
    6. node -e 'const s=require("fs").readFileSync("scenarios/results/org-private.md","utf8").replace(/\r/g,"").split("\n");const need=["# Scenario results: org-private","SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true","SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true","SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false","SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false","ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private result=ok"];const miss=need.filter(n=>!s.includes(n));const fin=s.some(l=>/^SECRET-SCOPE repo=steady-orchard\/patch-steward-testbed-private run=[0-9]+ url=\S+ result=pass$/.test(l));console.log(!miss.length&&fin&&s[0]===need[0]?"results ok":"results incomplete "+JSON.stringify(miss))'; bash scenarios/tools/results-check.sh scenarios/results/org-private.md S16 S17 | tail -n 1
       -> prints exactly two lines: results ok, RESULTS-CHECK file=scenarios/results/org-private.md result=pass
- rollback: |
    git revert <this step's commit> (removes the results file). Test-bed effects stay (issue left open, evidence commit in the
    append-only evidence repository, helper pair deployed); the final steady-state step disables workflows and closes the issue.
