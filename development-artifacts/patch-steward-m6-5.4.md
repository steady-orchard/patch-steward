# Step 5.4

- id: 5.4
- depends_on: []
- route: mechanical
- objective: Add scenarios/tools/pins.sh (read-only static check of a test-bed's deployed wrappers and the pinned reusable workflow) and scenarios/tools/results-check.sh (checks a scenario results file for passing sections, forbidden text, and Prettier formatting).
- files_in_scope:
    - scenarios/tools/pins.sh
    - scenarios/tools/results-check.sh
    - development-artifacts/patch-steward-m6-5.4-report.md
- context: |
    Git Bash; run every command from your tree root. jq is NOT installed (use node). core.autocrlf=true (strip CR before
    comparing text). gh is logged in (user jambolo). `gh api` endpoints never start with `/`. Never print a token or secret;
    never `set -x`. Never run a formatter on development-artifacts/. Run `pnpm install --frozen-lockfile` once first
    (results-check.sh calls `pnpm exec prettier`).

    scenarios/ is persistent: no planning identifiers in any file you write (no milestone, phase, step, gate-item, or
    owner-action ids, no `development-artifacts` spelled contiguously), never the probe suite's App secret names
    (STEWARD_APP_ followed by ID, PRIVATE_KEY, or CLIENT_ID without the PATCH_ prefix) as literal text: write detection
    patterns so the forbidden strings never appear contiguously (e.g. `(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)`,
    `development-art[i]facts`, `owner[ ]decision`). No raw control, bidi, or zero-width characters. Style: header comment
    like scenarios/tools/evidence.sh (usage, behavior, output, exit codes); `set -uo pipefail`; only bash, gh, git, node,
    coreutils, pnpm; temp directories under `mktemp -d` outside the repository, removed on exit (trap).

    Facts (verified): each test-bed's master holds `.github/workflows/steward-pr.yml` and `steward-issues.yml`, byte-equal to
    this repository's scenarios/workflows/steward-pr.yml and steward-issues.yml (compare git blob ids), each with one line
    `    uses: steady-orchard/patch-steward/.github/workflows/steward-screening.yml@<40 hex> # pushed steward commit`, one line
    `      steward_ref: '<same 40 hex>'`, and the secrets mapping lines `    secrets:`,
    `      PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}`,
    `      PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}`. The pinned
    .github/workflows/steward-screening.yml has a line `jobs:`, job header lines `  build:`, `  gate:`, `  publish:`, lines
    `    environment: steward-publication` in gate and publish only, `secrets.PATCH_STEWARD_APP_*` references only in gate and
    publish, `secrets:` declarations (no `secrets.` text) before `jobs:`, and 12 `uses: actions/<name>@<40 hex> # <tag>` lines.
    Raw file bytes: `gh api -H 'Accept: application/vnd.github.raw+json' "repos/<r>/contents/<path>?ref=<ref>"`; blob id:
    `gh api "repos/<r>/contents/<path>?ref=<ref>" --jq .sha`. The fork jambolo/patch-steward-testbed-public has no workflows.

    TOOL 1: scenarios/tools/pins.sh (output prefix PINS)
      Usage: bash scenarios/tools/pins.sh <owner/repo>  (exactly one argument matching ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$; else
      `usage: pins.sh <owner/repo>` on stderr, exit 2). Read-only. Reads, in order; any failure prints
      `PINS repo=<r> error=read-failed what=<item>` and exits 3 (item in parentheses):
        a. raw bytes and blob ids of <r>'s master `.github/workflows/steward-pr.yml` (steward-pr.yml), then
           `.github/workflows/steward-issues.yml` (steward-issues.yml);
        b. local blob ids `git rev-parse HEAD:scenarios/workflows/steward-pr.yml` and `...steward-issues.yml` (local);
        c. PIN = the 40 hex after `steward-screening.yml@` in the deployed steward-pr.yml (pin);
        d. raw bytes of .github/workflows/steward-screening.yml of steady-orchard/patch-steward at ref PIN (screening);
        e. `gh api "repos/steady-orchard/patch-steward/compare/<PIN>...milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish" --jq .status` (compare);
      then f. for each distinct `<owner>/<repo>[/<path>]@<40 hex>` value of a `uses:` line in the three files:
        `gh api repos/<owner>/<repo>/commits/<sha> --jq .sha` must print that sha (else the ref is unresolved; not exit 3).
      Checks (texts CR-stripped); print one line each, in this order, exactly `PINS repo=<r> check=<name> ok` or
      `PINS repo=<r> check=<name> FAIL`, followed by ` <detail>` where a detail is given:
        1. wrapper-blobs: both deployed blob ids equal the local ones.
        2. pin-equal, detail `pin=<PIN>`: each wrapper has exactly one `steward-screening.yml@<40 hex>` and exactly one
           `steward_ref: '<40 hex>'` (single quotes), all four equal PIN.
        3. pin-reachable, detail `status=<status from e>`: ok when status is `ahead` or `identical`.
        4. environment-jobs, detail `jobs=<list>`: jobs of the reusable workflow = the lines after the line `jobs:`; a job
           starts at a line matching ^  ([a-z][a-z0-9_-]*):$ and ends before the next such line; list = sorted names of
           jobs whose block has a line exactly `    environment: steward-publication`, joined by `,`; ok when list is
           `gate,publish` and neither wrapper contains `environment:`.
        5. secret-jobs, detail `jobs=<list>`: sorted names of jobs whose block contains `secrets.PATCH_STEWARD_APP_ID` or
           `secrets.PATCH_STEWARD_APP_PRIVATE_KEY`; ok when `gate,publish` and the text before the `jobs:` line has no `secrets.`.
        6. wrapper-mapping: each wrapper contains the three secrets mapping lines above consecutively, exactly two
           occurrences of `secrets.`, and no `inherit`.
        7. probe-names: none of the three texts matches /(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)/.
        8. uses-pinned, detail `count=<number of uses: lines in the three files>`: uses lines are lines matching
           ^\s*(-\s+)?uses: ; the value is the first token after `uses:`; ok when every value matches
           ^[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+@[0-9a-f]{40}$ and every distinct value resolved in f.
      Final line `PINS repo=<r> pin=<PIN> result=pass` (exit 0) when all eight are ok, else `... result=fail` (exit 1).

    TOOL 2: scenarios/tools/results-check.sh (output prefix RESULTS-CHECK)
      Usage: bash scenarios/tools/results-check.sh <results file> <scenario id> [<scenario id> ...]; at least 2 arguments,
      the file exists, every id matches ^S[0-9]{2}$; else `usage: results-check.sh <results file> <scenario id> [<scenario
      id> ...]` on stderr, exit 2.
      Sections (text CR-stripped, split into lines): a section starts at a line matching ^## (S[0-9]{2})( |$) and ends
      before the next line starting `## `. Several sections may share one id. sections = `ok` when every given id has at
      least one section and EVERY section with that id contains a line exactly `Result: pass`; else `missing=<ids without a
      section, comma-joined in argument order>`, or (when none is missing) `failed=<ids with a section lacking that line>`.
      Hygiene over the whole file: forbidden names in this order, each at most once: `ghs_` (text ghs_), `ghp_` (text ghp_),
      `begin-key` (text -----BEGIN), `echo-marker` (the two characters ^ and [), `probe-secret-name`
      (/(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)/), `planning-reference` (case-sensitive
      /development-art[i]facts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner[ ]decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b/
      or case-insensitive /\bphase [0-9]|\bstep [0-9]+\.[0-9]+/), `control-character` (any character code in 0-8, 11, 12,
      14-31, 127-159, 8203-8207, 8232-8238, 8288-8292, 8294-8297, 65279). hygiene = `ok` or `forbidden=<names comma-joined>`.
      prettier = `ok` when `pnpm exec prettier --check <file>` exits 0, else `fail`.
      Output exactly four lines:
        RESULTS-CHECK file=<file> check=sections <sections>
        RESULTS-CHECK file=<file> check=hygiene <hygiene>
        RESULTS-CHECK file=<file> check=prettier <prettier>
        RESULTS-CHECK file=<file> result=pass   (exit 0; all three ok)   or   RESULTS-CHECK file=<file> result=fail (exit 1)
- actions: |
    1. pnpm install --frozen-lockfile
    2. Write scenarios/tools/pins.sh and scenarios/tools/results-check.sh per context; `bash -n` each.
    3. Run acceptance 1-6 and record verbatim outputs in the report (read-only GitHub calls only).
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. pin=$(tr -d '\r' < scenarios/workflows/steward-pr.yml | grep -oE 'steward-screening\.yml@[0-9a-f]{40}' | cut -d@ -f2); T=$(mktemp -d); for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/pins.sh $r; echo "exit $?"; done > "$T/o.txt"; grep -c -E '^PINS repo=[^ ]+ check=(wrapper-blobs|pin-equal|pin-reachable|environment-jobs|secret-jobs|wrapper-mapping|probe-names|uses-pinned) ok' "$T/o.txt"; grep -c -E "^PINS repo=[^ ]+ pin=$pin result=pass" "$T/o.txt"; grep -c '^exit 0' "$T/o.txt"; rm -rf "$T"
       -> prints exactly three lines: 24, 3, 3
    2. bash scenarios/tools/pins.sh jambolo/patch-steward-testbed-public; echo "exit $?"; for a in "" "x" "a/b c/d"; do bash scenarios/tools/pins.sh $a > /dev/null 2>&1; echo "exit $?"; done
       -> prints exactly five lines: PINS repo=jambolo/patch-steward-testbed-public error=read-failed what=steward-pr.yml, exit 3, exit 2, exit 2, exit 2
    3. node -e 'const fs=require("fs"),os=require("os"),path=require("path"),cp=require("child_process");const t=fs.mkdtempSync(path.join(os.tmpdir(),"m6-rc-"));const F=String.fromCharCode(96).repeat(3);const good="# Scenario results: test\n\n## S01 first\n\n"+F+"text\n$ echo hi\nhi\n"+F+"\n\nResult: pass\n\n## S10 part one\n\nResult: pass\n\n## S10 part two\n\nResult: pass\n\n## Steady state\n\nResult: fail\n";const cases={good:[good,["S01","S10"]],missing:[good,["S01","S02"]],failed:[good.replace("## S10 part two\n\nResult: pass","## S10 part two\n\nResult: fail"),["S10"]],planning:[good.replace("hi\n"+F,"OA"+"1 hi\n"+F),["S01"]],probe:[good.replace("hi\n"+F,"STEWARD_"+"APP_ID\n"+F),["S01"]],prettier:[good.replace("## S01 first\n\n","## S01 first\n"),["S01"]]};const want={good:"0 check=sections ok; check=hygiene ok; check=prettier ok; result=pass",missing:"1 check=sections missing=S02; check=hygiene ok; check=prettier ok; result=fail",failed:"1 check=sections failed=S10; check=hygiene ok; check=prettier ok; result=fail",planning:"1 check=sections ok; check=hygiene forbidden=planning-reference; check=prettier ok; result=fail",probe:"1 check=sections ok; check=hygiene forbidden=probe-secret-name; check=prettier ok; result=fail",prettier:"1 check=sections ok; check=hygiene ok; check=prettier fail; result=fail"};const bad=[];for(const [k,[txt,ids]] of Object.entries(cases)){const f=path.join(t,k+".md");fs.writeFileSync(f,txt);let code=0,out="";try{out=cp.execFileSync("bash",["scenarios/tools/results-check.sh",f,...ids],{encoding:"utf8"})}catch(e){code=e.status;out=String(e.stdout)}const got=code+" "+out.replace(/\r/g,"").split("\n").filter(Boolean).map(l=>l.replace(/^RESULTS-CHECK file=\S+ /,"")).join("; ");if(got!==want[k])bad.push(k+": "+got)}fs.rmSync(t,{recursive:true,force:true});console.log(bad.length?"results-check mismatch "+JSON.stringify(bad):"results-check ok")'
       -> prints exactly: results-check ok
    4. for a in "" "scenarios/README.md" "scenarios/no-such.md S01" "scenarios/README.md S1" "scenarios/README.md s01"; do bash scenarios/tools/results-check.sh $a > /dev/null 2>&1; echo "exit $?"; done
       -> prints exactly five lines, each: exit 2
    5. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b|set -x|auth token' -- scenarios/tools/pins.sh scenarios/tools/results-check.sh; echo "exit $?"
       -> prints exactly: exit 1
    6. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/tools/pins.sh scenarios/tools/results-check.sh
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (tools only; nothing deployed).
