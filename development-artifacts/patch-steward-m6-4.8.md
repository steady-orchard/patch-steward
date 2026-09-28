# Step 4.8

- id: 4.8
- depends_on: []
- route: mechanical
- objective: Add the read-only scenario tool scenarios/tools/evidence.sh that fetches an evidence store branch (or reads a local store root), checks that every store commit only adds files, and verifies each run directory of one submission with `steward report --json`.
- files_in_scope:
    - scenarios/tools/evidence.sh
    - development-artifacts/patch-steward-m6-4.8-report.md
- context: |
    Repo root in Git Bash; run every command from your tree root. core.autocrlf=true (never anchor a grep with `$`). jq is NOT
    installed: use `gh ... --jq '<filter>'` or node. Git Bash runs CRLF scripts fine; the committed blobs are LF.

    scenarios/ is a new persistent directory (test-bed scenario suite for the GitHub-hosted steward; never runs in CI). Its files
    never mention planning identifiers (no milestone, phase, step, gate-item, or owner-action ids, no development-artifacts/) and
    never contain the probe suite's App secret names (the three names made of STEWARD_APP_ plus ID, PRIVATE_KEY, or CLIENT_ID
    without the PATCH_ prefix).

    Evidence store facts: the hosted steward commits evidence through the Git Data API to branch `steward-evidence` of the target
    repository (orphan-branch store) or of a separate store repository. Every run adds files under `<owner>/<repo>/` of the
    TARGET: run directories `<owner>/<repo>/runs/<pr|issue>-<n>/<run_id>-<run_attempt>/` (outcome runs hold manifest.json,
    run.json, submission.json, policy-revision.json, decision.json, report.json, report.md, logs/steward.txt, findings; waiting
    runs hold waiting.json instead of decision/report), supersession records `<owner>/<repo>/runs/<pr|issue>-<n>/supersessions/*.json`,
    and metrics `<owner>/<repo>/metrics/<YYYY-MM>/*.json`. The first commit of a new branch is a root commit (no parent); every
    commit must only ADD paths. `node packages/cli/dist/main.js report --json <run directory>` verifies an OUTCOME run directory
    (manifest hashes, record schemas, metrics file) and prints one JSON line with keys outcome, integrity ({ manifest:
    'verified', files, metrics: 'verified' or 'missing' } or null on failure), errors (array); its exit code is 0 pass, 1
    needs-changes or uncertain or evidence invalid, 2 unreadable, 3 inconclusive, so judge by the JSON, not the exit code. It
    cannot verify waiting run directories. On Windows the store must be checked out WITHOUT line-ending conversion
    (`git -c core.autocrlf=false clone ...`), or the manifest hashes will not match.

    Tool: scenarios/tools/evidence.sh (prefix EVIDENCE). Header comment in the style of probes/smoke/tools/deploy.sh (purpose,
    usage, behavior, output lines, exit codes). Only bash, gh, git, node, coreutils; never `set -x`; READ-ONLY (no push, no gh
    write); never print file contents, tokens, or secrets.
      Usage: bash scenarios/tools/evidence.sh <store owner/repo> <branch> <target owner/repo> <pr|issue> <number>
             bash scenarios/tools/evidence.sh --local <store root directory> <target owner/repo> <pr|issue> <number>
      Arguments: kind must be pr or issue, number must match ^[1-9][0-9]*$, repositories must match
      ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$; else usage (stderr) and exit 2. packages/cli/dist/main.js must exist, else
      `EVIDENCE error=cli-not-built` and exit 3 (run `pnpm build` first).
      Remote mode:
      1. `gh api repos/<store>/git/ref/heads/<branch> --jq .object.sha`; when it fails with HTTP 404, print
         `EVIDENCE store=<store> branch=<branch> state=absent` and exit 0; any other failure `EVIDENCE error=ref-read-failed`,
         exit 3.
      2. Clone into a fresh `mktemp -d` directory OUTSIDE the repository (removed by an EXIT trap):
         `git -c core.autocrlf=false clone --quiet --single-branch --branch <branch> git@github.com:<store>.git <tmp>/store`
         (then `git -C <tmp>/store config core.autocrlf false`); failure -> `EVIDENCE error=clone-failed`, exit 3.
      3. Print `EVIDENCE store=<store> branch=<branch> tip=<HEAD sha> commits=<count>`; then for each commit oldest first
         (`git rev-list --reverse HEAD`): `EVIDENCE commit=<sha> parents=<n> added=<a> other=<o>` where a and o count the lines
         of `git diff-tree --root --no-commit-id -r --name-status <sha>` whose status is `A` versus anything else; then
         `EVIDENCE append_only=yes` when every commit has other=0 and at most one parent, else `EVIDENCE append_only=no`.
      4. Continue with the run check on <tmp>/store as the store root.
      Local mode: skip steps 1-3 (no git, no network); the given directory is the store root (must exist, else
      `EVIDENCE error=store-root-missing`, exit 3).
      Run check (both modes): dir = <store root>/<target>/runs/<kind>-<number>. If dir does not exist print
      `EVIDENCE runs=0`. Else for each subdirectory name in sorted order except `supersessions`:
        - if <name>/waiting.json exists: `EVIDENCE run=<name> kind=waiting`
        - else run `node packages/cli/dist/main.js report --json <dir>/<name>` (from the repository root; ignore its exit code),
          parse the JSON line with node and print
          `EVIDENCE run=<name> kind=outcome outcome=<outcome or none> manifest=<integrity.manifest or failed> metrics=<integrity.metrics or failed> errors=<errors.length>`
        - for each file in <dir>/supersessions (if present), sorted: `EVIDENCE supersession=<file name>`
      Final line: `EVIDENCE target=<target> subject=<kind>-<number> runs=<run directories> verified=<outcome runs with
      manifest=verified, metrics=verified, errors=0> result=ok|failed`. result=ok (exit 0) when every outcome run verified and,
      in remote mode, append_only=yes; else result=failed (exit 1).
- actions: |
    1. Write scenarios/tools/evidence.sh per context; run `bash -n` on it.
    2. `pnpm build` (the acceptance uses the built CLI), then run the acceptance commands (read-only; acceptance 5 performs one
       live read-only `steward screen` run of the public test-bed issue 29 into a temporary evidence directory).
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. bash -n scenarios/tools/evidence.sh && echo "syntax ok"
       -> prints exactly: syntax ok
    2. for c in "" "a/b steward-evidence a/b issue" "a/b steward-evidence a/b bug 1" "a/b steward-evidence a/b issue 01" "--local /tmp a/b pr"; do bash scenarios/tools/evidence.sh $c > /dev/null 2>&1; echo "exit $?"; done
       -> prints exactly five lines, each: exit 2
    3. pnpm build > /dev/null; bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 29; echo "exit $?"
       -> prints exactly two lines: EVIDENCE store=steady-orchard/patch-steward-testbed-public branch=steward-evidence state=absent, then exit 0
    4. bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-evidence develop steady-orchard/patch-steward-testbed-private issue 1 > "${TMPDIR:-/tmp}/m6-ev.txt"; echo "exit $?"; node -e "const L=require('fs').readFileSync(process.argv[1],'utf8').trim().split('\n');const ok=L.length===5&&/^EVIDENCE store=steady-orchard\/patch-steward-testbed-evidence branch=develop tip=[0-9a-f]{40} commits=1$/.test(L[0])&&/^EVIDENCE commit=[0-9a-f]{40} parents=0 added=[1-9][0-9]* other=0$/.test(L[1])&&L[2]==='EVIDENCE append_only=yes'&&L[3]==='EVIDENCE runs=0'&&L[4]==='EVIDENCE target=steady-orchard/patch-steward-testbed-private subject=issue-1 runs=0 verified=0 result=ok';console.log(ok?'remote ok':'remote wrong: '+JSON.stringify(L))" "${TMPDIR:-/tmp}/m6-ev.txt"; rm -f "${TMPDIR:-/tmp}/m6-ev.txt"
       -> prints exactly two lines: exit 0, then remote ok
    5. bash -c 'T=$(mktemp -d); GH_TOKEN=$(gh auth token) node packages/cli/dist/main.js screen --issue 29 --repo steady-orchard/patch-steward-testbed-public --policy-file templates/policy/policy.yml --evidence-dir "$T" > /dev/null 2>&1; bash scenarios/tools/evidence.sh --local "$T" steady-orchard/patch-steward-testbed-public issue 29; echo "exit $?"; rm -rf "$T"' | sed -E 's/^EVIDENCE run=[^ ]+ /EVIDENCE run=X /'
       -> prints exactly three lines: EVIDENCE run=X kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0, then EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=issue-29 runs=1 verified=1 result=ok, then exit 0
    6. git grep --untracked -n -E -e 'git push' -e ' -X ' -e 'set -x' -e 'auth token' -- scenarios/tools/evidence.sh
       -> no output (exit 1)
    7. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' -- scenarios/tools/evidence.sh
       -> no output (exit 1)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/tools/evidence.sh
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the script; it writes nothing).
