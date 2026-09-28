# Step 4.9

- id: 4.9
- depends_on: [4.2, 4.3]
- route: mechanical
- objective: Add the secret-scope helper pair scenarios/workflows/scenario-secret-scope.yml and scenario-secret-scope-called.yml (byte-exact from the FILE BLOCKS) and the tool scenarios/tools/secret-scope.sh that checks their byte identity with the product files and runs the live check.
- files_in_scope:
    - scenarios/workflows/scenario-secret-scope.yml
    - scenarios/workflows/scenario-secret-scope-called.yml
    - scenarios/tools/secret-scope.sh
    - development-artifacts/patch-steward-m6-4.9-report.md
- context: |
    Repo root in Git Bash; run every command from your tree root. core.autocrlf=true (never anchor a grep with `$`). jq is NOT
    installed (use `gh --jq` or node). actionlint 1.7.12 is installed. Never run a formatter on development-artifacts/.

    Purpose (binding design): a live check, run later on each test-bed, that the steward's two App secrets reach ONLY jobs that
    declare the Environment `steward-publication`. It reproduces the product's secret path exactly: the caller maps the secrets
    by name with the same `secrets:` block as the wrapper templates (files changed in step 4.3:
    templates/workflows/steward-pr.yml), and the called workflow declares them exactly as the reusable screening workflow does
    (file changed in step 4.2: .github/workflows/steward-screening.yml). Job `outside` (no Environment) must see both empty;
    job `inside` (Environment steward-publication) must see both non-empty. Each job prints only
    `PATCH_STEWARD_APP_ID length-zero=<true|false>` and `PATCH_STEWARD_APP_PRIVATE_KEY length-zero=<true|false>`, never a
    value, length number, prefix, or digest. The caller runs only on workflow_dispatch, only for sender id 2095171, and carries
    the dispatch nonce in its run-name (probes/smoke/tools/dispatch.sh finds the run by it).

    The two workflow files are designed and verified (actionlint with `-ignore 'could not read reusable workflow file'`, since
    the local `uses: ./.github/workflows/...` path resolves only once deployed to a test-bed; Prettier clean). Produce them by
    extracting the FILE BLOCKS at the end of this context with the node command in actions step 2; do not retype or edit them.

    scenarios/ is persistent: no planning identifiers (no milestone, phase, step, gate-item, or owner-action ids, no
    development-artifacts/), never the probe suite's App secret names (STEWARD_APP_ plus ID, PRIVATE_KEY, or CLIENT_ID
    without the PATCH_ prefix).

    Tool: scenarios/tools/secret-scope.sh (prefix SECRET-SCOPE). Header comment in the style of probes/smoke/tools/deploy.sh.
    Only bash, gh, git, node, coreutils; never `set -x`; never print a secret value.
      Usage: bash scenarios/tools/secret-scope.sh check
             bash scenarios/tools/secret-scope.sh run <owner/repo>
      Block extraction (CR stripped): the block of a file = the first line exactly equal to `    secrets:` (4 spaces) plus every
      immediately following line that starts with 6 spaces. (awk: `f==0 && $0=="    secrets:" {f=1; print; next} f==1 { if
      (substr($0,1,6)=="      ") print; else exit }` on `tr -d '\r' < file`.)
      check (local, no network):
        mapping: block of scenarios/workflows/scenario-secret-scope.yml == block of templates/workflows/steward-pr.yml (3 lines)
          -> `SECRET-SCOPE check=mapping identical` or `SECRET-SCOPE check=mapping different`
        declarations: block of scenarios/workflows/scenario-secret-scope-called.yml == block of
          .github/workflows/steward-screening.yml (7 lines) -> `SECRET-SCOPE check=declarations identical` or `... different`
        exit 0 when both identical, else 1. A missing file -> `SECRET-SCOPE error=missing-file file=<path>`, exit 1.
      run <owner/repo>:
        1. the check above (abort with exit 1 when not identical);
        2. rate limit >= 500 (`gh api rate_limit --jq .resources.core.remaining`), else `SECRET-SCOPE error=rate-limit-low`, exit 1;
        3. `bash probes/smoke/tools/deploy.sh <r> master "scenario: deploy secret-scope pair" scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml`
           (exit non-zero -> `SECRET-SCOPE error=deploy-failed`, exit 1);
        4. `PROBE_WAIT_SECONDS=900 bash probes/smoke/tools/dispatch.sh <r> scenario-secret-scope.yml master`, capturing its
           output; take the run id from the `DISPATCH run_id=<id>` line (none, or dispatch exit non-zero ->
           `SECRET-SCOPE error=dispatch-failed`, exit 1);
        5. `gh run view <id> -R <r> --log` (tab-separated: job name, step name, timestamped text); for every line whose text
           contains `length-zero=`, print `SECRET-SCOPE job=<outside|inside> line=<text after the leading timestamp>` (job from
           the job-name column, which reads `call / outside` or `call / inside`); count log lines containing `-----BEGIN`;
        6. pass when job outside printed exactly `PATCH_STEWARD_APP_ID length-zero=true` and
           `PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true`, job inside printed exactly both with `length-zero=false`, and the
           BEGIN count is 0: `SECRET-SCOPE repo=<r> run=<id> url=https://github.com/<r>/actions/runs/<id> result=pass` (exit 0),
           else `... result=fail` (exit 1).
      Usage errors -> `usage: secret-scope.sh check|run <owner/repo>` on stderr, exit 2. Do NOT run `run` in this step.

    FILE BLOCKS
    ===== BEGIN FILE scenarios/workflows/scenario-secret-scope.yml =====
    # Caller half of the secret-scope check: dispatched on the default branch, it calls the called half with the same
    # explicit secrets mapping as the wrapper templates.
    name: scenario-secret-scope
    run-name: scenario-secret-scope ${{ inputs.nonce }}

    on:
      workflow_dispatch:
        inputs:
          nonce:
            description: Unique marker that lets the dispatching script find this run
            required: true
            type: string

    permissions: {}

    jobs:
      call:
        name: call
        if: ${{ github.event.sender.id == 2095171 }}
        permissions: {}
        uses: ./.github/workflows/scenario-secret-scope-called.yml
        secrets:
          PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}
          PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}
    ===== END FILE scenarios/workflows/scenario-secret-scope.yml =====
    ===== BEGIN FILE scenarios/workflows/scenario-secret-scope-called.yml =====
    # Called half of the secret-scope check. Declares the steward's two secrets exactly as the reusable screening workflow
    # does. Job outside declares no Environment; job inside declares the publication Environment. Each prints only whether
    # each secret is empty, never a value, a length, or a digest.
    name: scenario-secret-scope-called

    on:
      workflow_call:
        secrets:
          PATCH_STEWARD_APP_ID:
            description: GitHub App id, delivered from the caller's publication Environment
            required: false
          PATCH_STEWARD_APP_PRIVATE_KEY:
            description: GitHub App private key, delivered from the caller's publication Environment
            required: false

    permissions: {}

    jobs:
      outside:
        name: outside
        runs-on: ubuntu-latest
        timeout-minutes: 5
        permissions: {}
        steps:
          - name: Report whether the secrets are empty without the Environment
            env:
              PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}
              PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}
            run: |
              if [ "${#PATCH_STEWARD_APP_ID}" -eq 0 ]; then id_empty=true; else id_empty=false; fi
              if [ "${#PATCH_STEWARD_APP_PRIVATE_KEY}" -eq 0 ]; then key_empty=true; else key_empty=false; fi
              echo "PATCH_STEWARD_APP_ID length-zero=$id_empty"
              echo "PATCH_STEWARD_APP_PRIVATE_KEY length-zero=$key_empty"

      inside:
        name: inside
        runs-on: ubuntu-latest
        timeout-minutes: 5
        environment: steward-publication
        permissions: {}
        steps:
          - name: Report whether the secrets are empty with the Environment
            env:
              PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}
              PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}
            run: |
              if [ "${#PATCH_STEWARD_APP_ID}" -eq 0 ]; then id_empty=true; else id_empty=false; fi
              if [ "${#PATCH_STEWARD_APP_PRIVATE_KEY}" -eq 0 ]; then key_empty=true; else key_empty=false; fi
              echo "PATCH_STEWARD_APP_ID length-zero=$id_empty"
              echo "PATCH_STEWARD_APP_PRIVATE_KEY length-zero=$key_empty"
    ===== END FILE scenarios/workflows/scenario-secret-scope-called.yml =====
- actions: |
    1. Base check (files changed in steps 4.2 and 4.3): node -e "const fs=require('fs');const c=[['.github/workflows/steward-screening.yml','      PATCH_STEWARD_APP_PRIVATE_KEY:'],['templates/workflows/steward-pr.yml','      PATCH_STEWARD_APP_PRIVATE_KEY: \${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}']];const m=c.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s));console.log(m.length?'MISSING '+JSON.stringify(m):'base ok')"
       It must print `base ok`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. Extract the two workflow files (run exactly this from the tree root):
       node -e "const fs=require('fs'),path=require('path');const L=fs.readFileSync('development-artifacts/patch-steward-m6-4.9.md','utf8').replace(/\r\n/g,'\n').split('\n');for(const n of process.argv.slice(1)){const b=L.indexOf('    ===== BEGIN FILE '+n+' =====');const e=L.indexOf('    ===== END FILE '+n+' =====');if(b<0||e<b)throw new Error('markers '+n);const out=L.slice(b+1,e).map(l=>{if(l.trim()==='')return '';if(!l.startsWith('    '))throw new Error('indent '+n);return l.slice(4)});fs.mkdirSync(path.dirname(n),{recursive:true});fs.writeFileSync(n,out.join('\n')+'\n');console.log('wrote '+n)}" scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml
    3. Write scenarios/tools/secret-scope.sh per context; `bash -n` it. Run only its `check` mode.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. node -e "const fs=require('fs');const L=fs.readFileSync('development-artifacts/patch-steward-m6-4.9.md','utf8').replace(/\r\n/g,'\n').split('\n');let bad=[];for(const n of process.argv.slice(1)){const b=L.indexOf('    ===== BEGIN FILE '+n+' =====');const e=L.indexOf('    ===== END FILE '+n+' =====');const want=L.slice(b+1,e).map(l=>l.trim()===''?'':l.slice(4)).join('\n')+'\n';const got=fs.existsSync(n)?fs.readFileSync(n,'utf8').replace(/\r\n/g,'\n'):null;if(b<0||e<b||got!==want)bad.push(n)}console.log(bad.length?'DIFFERENT '+bad.join(' '):'verbatim ok')" scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml
       -> prints exactly: verbatim ok
    2. actionlint -ignore 'could not read reusable workflow file' scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml; echo "exit $?"
       -> prints exactly: exit 0
    3. pnpm exec prettier --check scenarios -> exit 0
    4. bash -n scenarios/tools/secret-scope.sh && bash scenarios/tools/secret-scope.sh check; echo "exit $?"
       -> prints exactly three lines: SECRET-SCOPE check=mapping identical, SECRET-SCOPE check=declarations identical, exit 0
    5. for c in "" "run" "deploy x/y" "check extra"; do bash scenarios/tools/secret-scope.sh $c > /dev/null 2>&1; echo "exit $?"; done
       -> prints exactly four lines, each: exit 2
    6. git grep --untracked -n -E -e 'set -x' -e 'auth token' -e '--force' -- scenarios/tools/secret-scope.sh
       -> no output (exit 1)
    7. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' -- scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml scenarios/tools/secret-scope.sh
       -> no output (exit 1)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml scenarios/tools/secret-scope.sh
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the three files; nothing is deployed by this step).
