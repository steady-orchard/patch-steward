# Step 5.2

- id: 5.2
- depends_on: []
- route: mechanical
- objective: Add the read-only evidence reader scenarios/tools/run-records.sh (key fields of run directories, supersession records, and metrics files of one submission or run) and make scenarios/tools/evidence.sh verify waiting run directories against their manifest instead of counting them as unverified.
- files_in_scope:
    - scenarios/tools/run-records.sh
    - scenarios/tools/evidence.sh
    - development-artifacts/patch-steward-m6-5.2-report.md
- context: |
    Git Bash; run every command from your tree root. jq is NOT installed (use node). core.autocrlf=true. gh is logged in (user
    jambolo); SSH clones of the test-bed repositories work. `gh api` endpoints never start with `/`. Never print a token or
    secret; never `set -x`. Never run a formatter on development-artifacts/. Run `pnpm install --frozen-lockfile && pnpm build`
    once first (evidence.sh refuses to run without packages/cli/dist/main.js).

    scenarios/ is persistent: no planning identifiers (no milestone, phase, step, gate-item, or owner-action ids, no
    `development-artifacts`), never the probe suite's App secret names (STEWARD_APP_ followed by ID, PRIVATE_KEY, or
    CLIENT_ID without the PATCH_ prefix), no raw control, bidi, or zero-width characters. Style: header comment like
    scenarios/tools/evidence.sh (usage, behavior, output, exit codes); only bash, gh, git, node, coreutils; temp directories
    under `mktemp -d` outside the repository, removed on exit (trap).

    Evidence store layout (relative to the store root of branch `steward-evidence`; <target> = owner/name of the screened
    repository):
      <target>/runs/<pr|issue>-<n>/<run_id>-<run_attempt>/   one run directory; outcome runs hold run.json, submission.json,
          policy-revision.json, decision.json, report.json, report.md, findings/finding-NNNN.json (optional), logs/steward.txt,
          manifest.json; waiting runs hold run.json, submission.json, policy-revision.json, waiting.json, logs/steward.txt,
          manifest.json (no decision)
      <target>/runs/<pr|issue>-<n>/supersessions/<run_id>-<run_attempt>.json   supersession records
      <target>/metrics/<YYYY-MM>/<run_id>-<run_attempt>.json                    metrics file: a JSON array of events
      <target>/metrics/<YYYY-MM>/<run_id>-<run_attempt>-supersession.json       metrics of a supersession
    Record fields read: run.json `run_id`, `run_attempt`, `policy_revision`, `subject.snapshot_hash`; decision.json `outcome`;
    finding files `code`; waiting.json `state`, `reason`, `counts.daily_count`, `counts.daily_limit`, `counts.author_count`,
    `counts.author_limit`, `arrival_at`; supersession files `run_id`, `run_attempt`, `reason`, `successor` (null or
    {run_id, run_attempt, artifact_created_at}), `recorded_snapshot_hash`, `live_snapshot_hash` (null or hash); metrics events
    `kind`, `subject.kind`, `payload` (state-transition: `from` (may be null), `to`; maintainer-resolution: `action_kind`,
    `resolution` (optional), `paired_run` (optional; null or {run_id, run_attempt}), `paired_snapshot_hash` (optional)).
    manifest.json: `run_kind` (optional; `waiting` for waiting runs) and `files`: [{ path, sha256: "sha256:<64 hex>", ... }]
    listing every file of the run directory except manifest.json.

    TOOL: scenarios/tools/run-records.sh (output prefixes RECORD, SUPERSESSION, RECORDS, METRIC, METRICS)
      Usage (validate all arguments before any network call; otherwise print the four usage lines to stderr, exit 2):
        bash scenarios/tools/run-records.sh runs <store owner/repo> <branch> <target owner/repo> <pr|issue> <number>
        bash scenarios/tools/run-records.sh runs --local <store root> <target owner/repo> <pr|issue> <number>
        bash scenarios/tools/run-records.sh metrics <store owner/repo> <branch> <target owner/repo> <run_id>-<run_attempt>
        bash scenarios/tools/run-records.sh metrics --local <store root> <target owner/repo> <run_id>-<run_attempt>
      owner/repo values match ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$; number ^[1-9][0-9]*$; run directory ^[1-9][0-9]*-[1-9][0-9]*$.
      Remote mode: `gh api repos/<store>/git/ref/heads/<branch>`; HTTP 404 -> print only the final RECORDS (runs mode, runs=0
      supersessions=0) or METRICS (metrics mode, files=0 events=0) line and exit 0; any other failure -> `RECORDS error=read-failed`,
      exit 1. Else `git -c core.autocrlf=false clone --quiet --depth 1 --single-branch --branch <branch>
      git@github.com:<store>.git <tmp>/store` (failure -> `RECORDS error=clone-failed`, exit 1) and read from that root. Local
      mode reads the given directory (missing -> `RECORDS error=store-root-missing`, exit 1). In local mode store=`local` and
      branch=`none` in the output lines. A JSON parse failure -> exit 1.
      runs mode, directory D = <root>/<target>/runs/<kind>-<number> (absent -> no RECORD lines):
        run directories = entries of D named ^[0-9]+-[0-9]+$, sorted numerically by run id, then attempt. For each:
          waiting.json present:
            RECORD run=<dir> kind=waiting state=<state> reason=<reason> daily=<daily_count>/<daily_limit> author=<author_count>/<author_limit> arrival_at=<arrival_at> policy_revision=<run.json policy_revision> snapshot=<run.json subject.snapshot_hash>
          else:
            RECORD run=<dir> kind=outcome outcome=<decision.json outcome> run_id=<run_id> run_attempt=<run_attempt> policy_revision=<policy_revision> snapshot=<subject.snapshot_hash> findings=<codes>
            <codes> = the distinct `code` values of findings/*.json, sorted (JavaScript default sort), joined by `,`; `none`
            when there is no findings directory or no code.
        then for each file D/supersessions/*.json sorted by name:
          SUPERSESSION file=<name> run=<run_id>-<run_attempt> reason=<reason> successor=<run_id>-<run_attempt> or null successor_created_at=<artifact_created_at> or null recorded_snapshot=<recorded_snapshot_hash> live_snapshot=<live_snapshot_hash> or null
        final line: RECORDS store=<store> branch=<branch> target=<target> subject=<kind>-<number> runs=<run directory count> supersessions=<file count>
      metrics mode: for each month directory of <root>/<target>/metrics sorted by name, first `<run dir>.json` then
      `<run dir>-supersession.json` when present; for each event of that file's array, in order:
          state-transition:      METRIC file=<target>/metrics/<month>/<file name> kind=state-transition subject=<subject.kind> from=<from or null> to=<to>
          maintainer-resolution: METRIC file=<same> kind=maintainer-resolution subject=<subject.kind> action_kind=<action_kind> resolution=<resolution, or none when absent or null> paired_run=<run_id>-<run_attempt> or null paired_snapshot=<paired_snapshot_hash> or null
          any other kind:        METRIC file=<same> kind=<kind> subject=<subject.kind>
        final line: METRICS store=<store> branch=<branch> target=<target> run=<run dir> files=<files read> events=<events printed>
      Exit 0 on success.

    CHANGE: scenarios/tools/evidence.sh, the run check loop. Today a run directory containing waiting.json prints
    `EVIDENCE run=<name> kind=waiting` and is never counted as verified, so any submission with a waiting run ends
    `result=failed`. Replace that branch: verify the waiting run directory (node, reading files as bytes) and print
    `EVIDENCE run=<name> kind=waiting manifest=verified` (and increment `verified`) or `EVIDENCE run=<name> kind=waiting
    manifest=failed`. verified = manifest.json parses, `run_kind` is `waiting`, the sorted list of `files[].path` equals the
    sorted list of files present in the directory (recursive, `/`-separated, manifest.json excluded) and both equal exactly
    logs/steward.txt, policy-revision.json, run.json, submission.json, waiting.json, and every listed file's `sha256` equals
    `sha256:` plus the hex SHA-256 of its bytes; any exception -> failed. Keep every other line format and behavior, including
    the final line `EVIDENCE target=<t> subject=<s> runs=<n> verified=<v> result=ok|failed` (runs counts every run directory,
    ok requires verified == runs). The script uses `set -euo pipefail`: make the new code safe under it. Update its header
    comment to say waiting runs are verified against their manifest.

    Live read-only data used by the acceptance (org-public test-bed store, immutable run): store and target
    steady-orchard/patch-steward-testbed-public, branch steward-evidence, issue 31, run directory 36397673122-1: outcome
    needs-changes, run_id 36397673122, run_attempt 1, policy_revision d997b1e362c75af03942da0e7a1e8902ca5dbe51, snapshot
    sha256:b76304d018392689a4b010d378277f364e15cf9b4681e7a9935c8e6cebb958dc, one finding code submission.unstructured; metrics
    file metrics/2026-09/36397673122-1.json holds 5 events (state-transition null -> screening, latency, latency, cost,
    state-transition screening -> needs-changes).
- actions: |
    1. pnpm install --frozen-lockfile && pnpm build
    2. Write scenarios/tools/run-records.sh per context; `bash -n` it.
    3. Change scenarios/tools/evidence.sh per context (only the waiting branch and the header comment); `bash -n` it.
    4. Run acceptance 1-8 and record the verbatim outputs in the report (read-only GitHub calls only).
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. node -e 'const fs=require("fs"),os=require("os"),path=require("path"),cp=require("child_process");const t=fs.mkdtempSync(path.join(os.tmpdir(),"m6-rr-"));const w=(p,o)=>{const f=path.join(t,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(o))};const h1="sha256:"+"1".repeat(64),h2="sha256:"+"2".repeat(64),a="a".repeat(40),b="b".repeat(40);const R="o/r/runs/issue-7/";w(R+"100-1/run.json",{run_id:100,run_attempt:1,policy_revision:a,subject:{snapshot_hash:h1}});w(R+"100-1/decision.json",{outcome:"needs-changes"});w(R+"100-1/findings/finding-0001.json",{code:"submission.unstructured"});w(R+"100-1/findings/finding-0002.json",{code:"submission.policy-change"});w(R+"101-1/run.json",{run_id:101,run_attempt:1,policy_revision:b,subject:{snapshot_hash:h2}});w(R+"101-1/waiting.json",{state:"queued",reason:"daily-runs",counts:{daily_count:3,daily_limit:1,author_count:1,author_limit:20},arrival_at:"2026-09-28T10:00:00Z"});w(R+"supersessions/100-1.json",{run_id:100,run_attempt:1,reason:"newer-owner",successor:{run_id:101,run_attempt:1,artifact_created_at:"2026-09-28T10:00:01Z"},recorded_snapshot_hash:h1,live_snapshot_hash:null});w("o/r/metrics/2026-09/102-1.json",[{kind:"maintainer-resolution",subject:{kind:"submission"},payload:{action_kind:"resolution",dismissal_code:null,resolution:"closed-by-author",paired_run:{run_id:101,run_attempt:1},paired_snapshot_hash:h2}}]);w("o/r/metrics/2026-09/100-1-supersession.json",[{kind:"state-transition",subject:{kind:"run"},payload:{from:"needs-changes",to:"superseded"}}]);const run=(...x)=>cp.execFileSync("bash",["scenarios/tools/run-records.sh",...x],{encoding:"utf8"}).replace(/\r/g,"").trim().split("\n");const want=[[["runs","--local",t,"o/r","issue","7"],["RECORD run=100-1 kind=outcome outcome=needs-changes run_id=100 run_attempt=1 policy_revision="+a+" snapshot="+h1+" findings=submission.policy-change,submission.unstructured","RECORD run=101-1 kind=waiting state=queued reason=daily-runs daily=3/1 author=1/20 arrival_at=2026-09-28T10:00:00Z policy_revision="+b+" snapshot="+h2,"SUPERSESSION file=100-1.json run=100-1 reason=newer-owner successor=101-1 successor_created_at=2026-09-28T10:00:01Z recorded_snapshot="+h1+" live_snapshot=null","RECORDS store=local branch=none target=o/r subject=issue-7 runs=2 supersessions=1"]],[["metrics","--local",t,"o/r","102-1"],["METRIC file=o/r/metrics/2026-09/102-1.json kind=maintainer-resolution subject=submission action_kind=resolution resolution=closed-by-author paired_run=101-1 paired_snapshot="+h2,"METRICS store=local branch=none target=o/r run=102-1 files=1 events=1"]],[["metrics","--local",t,"o/r","100-1"],["METRIC file=o/r/metrics/2026-09/100-1-supersession.json kind=state-transition subject=run from=needs-changes to=superseded","METRICS store=local branch=none target=o/r run=100-1 files=1 events=1"]],[["runs","--local",t,"o/r","pr","9"],["RECORDS store=local branch=none target=o/r subject=pr-9 runs=0 supersessions=0"]]];const bad=want.filter(([x,e])=>JSON.stringify(run(...x))!==JSON.stringify(e)).map(([x])=>x.slice(0,1).concat(x.slice(3)).join(" "));fs.rmSync(t,{recursive:true,force:true});console.log(bad.length?"local mismatch "+JSON.stringify(bad):"local ok")'
       -> prints exactly: local ok
    2. bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 31 | grep -c -E '^RECORD run=36397673122-1 kind=outcome outcome=needs-changes run_id=36397673122 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:b76304d018392689a4b010d378277f364e15cf9b4681e7a9935c8e6cebb958dc findings=submission.unstructured$|^RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=issue-31 runs=[1-9][0-9]* supersessions=0$'
       -> prints exactly: 2
    3. bash scenarios/tools/run-records.sh metrics steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public 36397673122-1 | grep -c -E '^METRIC file=steady-orchard/patch-steward-testbed-public/metrics/2026-09/36397673122-1\.json kind=(state-transition subject=run from=null to=screening|latency subject=run|cost subject=run|state-transition subject=run from=screening to=needs-changes)$|^METRICS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public run=36397673122-1 files=1 events=5$'
       -> prints exactly: 6
    4. bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public no-such-branch steady-orchard/patch-steward-testbed-public issue 31; echo "exit $?"
       -> prints exactly two lines: RECORDS store=steady-orchard/patch-steward-testbed-public branch=no-such-branch target=steady-orchard/patch-steward-testbed-public subject=issue-31 runs=0 supersessions=0, then exit 0
    5. for a in "" "runs" "runs x/y b x/y issue" "runs x/y b x/y bug 1" "metrics x/y b x/y 12" "runs --local /nonexistent x/y issue 0" "other x/y b x/y 1-1"; do bash scenarios/tools/run-records.sh $a > /dev/null 2>&1; echo "exit $?"; done
       -> prints exactly seven lines, each: exit 2
    6. node -e 'const fs=require("fs"),os=require("os"),path=require("path"),cp=require("child_process"),crypto=require("crypto");const t=fs.mkdtempSync(path.join(os.tmpdir(),"m6-ev-"));const d=path.join(t,"o/r/runs/issue-7/101-1");const files={"run.json":"{\"run_id\":101}","submission.json":"{}","policy-revision.json":"{}","waiting.json":"{\"state\":\"queued\"}","logs/steward.txt":"log line\n"};const man={manifest_version:1,run_kind:"waiting",files:[]};for(const [p,c] of Object.entries(files)){const f=path.join(d,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c);man.files.push({path:p,sha256:"sha256:"+crypto.createHash("sha256").update(c).digest("hex")})}fs.writeFileSync(path.join(d,"manifest.json"),JSON.stringify(man));const run=()=>{try{return {code:0,out:cp.execFileSync("bash",["scenarios/tools/evidence.sh","--local",t,"o/r","issue","7"],{encoding:"utf8"})}}catch(e){return {code:e.status,out:String(e.stdout)}}};const a=run();fs.writeFileSync(path.join(d,"waiting.json"),"{\"state\":\"changed\"}");const b=run();fs.rmSync(t,{recursive:true,force:true});const has=(r,l)=>r.out.replace(/\r/g,"").split("\n").includes(l);const ok=a.code===0&&has(a,"EVIDENCE run=101-1 kind=waiting manifest=verified")&&has(a,"EVIDENCE target=o/r subject=issue-7 runs=1 verified=1 result=ok")&&b.code===1&&has(b,"EVIDENCE run=101-1 kind=waiting manifest=failed")&&has(b,"EVIDENCE target=o/r subject=issue-7 runs=1 verified=0 result=failed");console.log(ok?"waiting ok":"waiting mismatch "+JSON.stringify([a,b]))'
       -> prints exactly: waiting ok
    7. bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 31 | grep -c -E '^EVIDENCE append_only=yes$|^EVIDENCE run=36397673122-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0$|^EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=issue-31 runs=[0-9]+ verified=[0-9]+ result=ok$'
       -> prints exactly: 3
    8. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b|set -x|auth token' -- scenarios/tools/run-records.sh scenarios/tools/evidence.sh; echo "exit $?"; node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/tools/run-records.sh scenarios/tools/evidence.sh
       -> prints exactly two lines: exit 1, then clean
- rollback: |
    git revert <this step's commit> (tools only; nothing deployed).
