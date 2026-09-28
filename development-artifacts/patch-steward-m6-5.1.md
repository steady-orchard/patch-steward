# Step 5.1

- id: 5.1
- depends_on: []
- route: mechanical
- objective: Add the scenario tools scenarios/tools/run-log.sh (normalized job log lines of a workflow run attempt) and scenarios/tools/await-runs.sh (bounded wait for new runs of a workflow), and correct the header comment of scenarios/tools/find-runs.sh (it lists runs of any status).
- files_in_scope:
    - scenarios/tools/run-log.sh
    - scenarios/tools/await-runs.sh
    - scenarios/tools/find-runs.sh
    - development-artifacts/patch-steward-m6-5.1-report.md
- context: |
    Git Bash; run every command from your tree root. jq is NOT installed (use `gh --jq` or node). core.autocrlf=true: working-tree
    files may be CRLF; strip CR before comparing. gh is logged in (user jambolo). `gh api` endpoints never start with `/`.
    Never print a token or secret; never `set -x`. Never run a formatter on development-artifacts/.

    scenarios/ is a persistent directory: no planning identifiers in any file (no milestone, phase, step, gate-item, or
    owner-action ids, no `development-artifacts`), never the probe suite's App secret names (STEWARD_APP_ followed by ID,
    PRIVATE_KEY, or CLIENT_ID without the PATCH_ prefix). Never write a raw control, bidi, or zero-width character; build a
    byte order mark in code with String.fromCharCode(65279), never with a backslash-u escape.

    Existing style: header comment like scenarios/tools/find-runs.sh (usage, behavior, output lines, exit codes); `set -uo
    pipefail`; only bash, gh, git, node, coreutils; temporary files only under `mktemp -d` outside the repository, removed on
    exit (trap). Existing tool scenarios/tools/find-runs.sh <owner/repo> <workflow file name> <display title prefix> prints
    `RUN id=<databaseId> attempt=<a> event=<e> status=<s> conclusion=<c or none> created_at=<t> url=<u> title=<displayTitle>`
    lines oldest first, then `RUNS repo=<r> workflow=<w> count=<n>`; exit 0, 1 on list failure, 2 usage. It lists runs of ANY
    status (gh run list --limit 100); its header wrongly says "completed".

    Log format of `gh run view <run id> -R <owner/repo> --attempt <attempt> --log` (verified on a real run): each line is
    `<job column>` TAB `<step column>` TAB `<timestamp> <text>`. The job column reads e.g. `screen / gate` for a job of a
    called workflow or `edit` for a plain job; the job name is the part after the LAST `/ ` (or the whole column when it has
    none). The first line of each job has a byte order mark (character 65279) at the start of the third field, before the
    timestamp. Lines echoed from a step's own script have text starting with the two literal characters `^[` (caret, left
    bracket) followed by `[36;1m`; they are the step source, not output, and must be dropped. There is no CR.

    TOOL 1: scenarios/tools/run-log.sh (output prefix LOG/LOGS)
      Usage: bash scenarios/tools/run-log.sh <owner/repo> <run id> <attempt> <job>
      Validate BEFORE any network call, else print `usage: run-log.sh <owner/repo> <run id> <attempt> <job>` to stderr and
      exit 2: exactly 4 arguments; owner/repo matches ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$; run id ^[1-9][0-9]{0,19}$; attempt
      ^[1-9][0-9]{0,2}$; job ^[a-z][a-z0-9_-]{0,39}$.
      Read the log with the gh command above into a temp file. gh failure -> print
      `LOGS repo=<r> run=<id> attempt=<a> job=<job> error=read-failed`, exit 1.
      Per line (node): strip a trailing CR; split on TAB; skip lines with fewer than 3 fields; job name as above (remove any
      byte order mark first); keep only lines whose job name equals <job>; rest = fields 3.. joined with TAB, minus a leading
      byte order mark; timestamp = rest up to the first space (whole rest when no space); text = after the first space ('' when
      none). Drop lines whose text starts with `^[`, and lines whose text contains `add-mask`. Withhold (do not print; count)
      lines whose text contains `-----BEGIN` or matches /gh[pousr]_[A-Za-z0-9]{20,}/. Print every kept line as
        LOG job=<job> ts=<timestamp> text=<text>
      then one final line
        LOGS repo=<owner/repo> run=<run id> attempt=<attempt> job=<job> lines=<printed count> withheld=<withheld count>
      Exit 0 (also when lines=0, e.g. a skipped job).

    TOOL 2: scenarios/tools/await-runs.sh (output prefix AWAIT, plus RUN lines)
      Usage: bash scenarios/tools/await-runs.sh <owner/repo> <workflow file name> <display title prefix> <after run id> <min count>
      Validate before any network call (exactly 5 arguments; non-empty prefix; after run id ^[0-9]{1,20}$; min count
      ^[1-9][0-9]{0,2}$), else print `usage: await-runs.sh <owner/repo> <workflow file name> <display title prefix> <after run
      id> <min count>` to stderr and exit 2.
      Rate limit first: `gh api rate_limit --jq .resources.core.remaining` below 500 (or unreadable) -> print
      `AWAIT repo=<r> workflow=<w> error=rate-limit-low`, exit 1.
      Loop, polling immediately and then every 20 s (sleep 20), until a deadline of PROBE_WAIT_SECONDS seconds (default 540)
      after start: run `bash scenarios/tools/find-runs.sh <r> <w> <prefix>` (exit non-zero -> print
      `AWAIT repo=<r> workflow=<w> error=list-failed`, exit 1); SELECTED = its RUN lines whose id (the value after `id=`) is
      numerically greater than <after run id> (awk numeric compare is exact for these ids), kept in find-runs order;
      count = number of SELECTED; completed = number of SELECTED containing ` status=completed `.
        - count >= min count and completed == count: print the SELECTED lines unchanged, then
          `AWAIT repo=<r> workflow=<w> after=<after> count=<count> completed=<completed> result=complete`; exit 0.
        - deadline reached: print the SELECTED lines, then
          `AWAIT repo=<r> workflow=<w> after=<after> count=<count> completed=<completed> result=timeout`; exit 3.

    FIX: in the header comment of scenarios/tools/find-runs.sh replace the wording "List completed workflow runs" with "List
    workflow runs (any status)" and any other claim that it lists only completed runs. Change NO non-comment line of that file.

    Live read-only data used by the acceptance (immutable run on the org-public test-bed): run 36397673122 attempt 1 of
    steady-orchard/patch-steward-testbed-public, workflow steward-issues.yml, title `steward issue 31 author 2095171 event
    issues opened sender 2095171 User`; its gate job printed `event issues opened issue 31 sender User`, `listing none`,
    `dedup commit no-owner`, `disposition early-exit`, and summary line `- Owner: committed <backtick>36397673122-1<backtick>`;
    its publish job printed `policy revision d997b1e362c75af03942da0e7a1e8902ca5dbe51`, `ownership retention 90 days`,
    `evidence commit 6f1c3c890f7106aa762a591faff452a2cac35c1d rebuilds 0`, `freshness current`, `steward job summary:`,
    `- Status: <backtick>needs-changes<backtick>`, `- Freshness: <backtick>current<backtick>`; the publish step's script (echoed,
    must be dropped) contains `echo "steward job summary:"`.
- actions: |
    1. Write scenarios/tools/run-log.sh and scenarios/tools/await-runs.sh per context (header comments in the style of
       find-runs.sh; `bash -n` each).
    2. Edit only the header comment of scenarios/tools/find-runs.sh per context.
    3. Run acceptance 1-7 and record the verbatim outputs in the report. These make only read-only GitHub calls.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36397673122 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(policy revision d997b1e362c75af03942da0e7a1e8902ca5dbe51|ownership retention 90 days|evidence commit 6f1c3c890f7106aa762a591faff452a2cac35c1d rebuilds 0|freshness current|steward job summary:|- Freshness: `current`|- Status: `needs-changes`)$'
       -> prints exactly: 7
    2. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36397673122 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(event issues opened issue 31 sender User|listing none|dedup commit no-owner|disposition early-exit|- Owner: committed `36397673122-1`)$|^LOGS repo=steady-orchard/patch-steward-testbed-public run=36397673122 attempt=1 job=gate lines=[1-9][0-9]* withheld=0$'
       -> prints exactly: 6
    3. bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36397673122 1 publish | grep -c -e 'steward job summary:' -e 'text=^\['
       -> prints exactly: 1
    4. for a in "" "x/y" "x/y 1 1" "x/y z 1 gate" "x/y 1 1 Gate"; do bash scenarios/tools/run-log.sh $a > /dev/null 2>&1; echo "exit $?"; done; for a in "" "x/y w.yml p 0" "x/y w.yml p z 1" "x/y w.yml p 0 0"; do bash scenarios/tools/await-runs.sh $a > /dev/null 2>&1; echo "exit $?"; done
       -> prints exactly nine lines, each: exit 2
    5. bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue 31 author " 0 1 | grep -c -E '^RUN id=36397673122 attempt=[0-9]+ event=issues status=completed |^AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml after=0 count=1 completed=1 result=complete$'; echo "exit ${PIPESTATUS[0]}"
       -> prints exactly two lines: 2, then exit 0
    6. PROBE_WAIT_SECONDS=1 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue 31 author " 36397673122 1; echo "exit $?"
       -> prints exactly two lines: AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml after=36397673122 count=0 completed=0 result=timeout, then exit 3
    7. git diff --quiet d1af5375321637fe8b1e9b325b6ababb62ee6b58 -- scenarios/tools/find-runs.sh; echo "changed $?"; grep -c 'completed workflow runs' scenarios/tools/find-runs.sh; diff <(git show d1af5375321637fe8b1e9b325b6ababb62ee6b58:scenarios/tools/find-runs.sh | tr -d '\r' | grep -v '^#') <(tr -d '\r' < scenarios/tools/find-runs.sh | grep -v '^#') && echo "code unchanged"
       -> prints exactly three lines: changed 1, 0, code unchanged
    8. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b|set -x|auth token' -- scenarios/tools/run-log.sh scenarios/tools/await-runs.sh scenarios/tools/find-runs.sh; echo "exit $?"
       -> prints exactly: exit 1
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/tools/run-log.sh scenarios/tools/await-runs.sh scenarios/tools/find-runs.sh
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (tools only; nothing deployed).
