# Step 5.3

- id: 5.3
- depends_on: []
- route: mechanical
- objective: Add the scenario helper workflow scenarios/workflows/scenario-app-edit.yml (byte-exact from the FILE BLOCK; edits a scenario issue or pull request title, or closes it, with an installation token of the test App so the event sender is the App's bot) and the tool scenarios/tools/app-edit.sh that deploys, dispatches, and checks it.
- files_in_scope:
    - scenarios/workflows/scenario-app-edit.yml
    - scenarios/tools/app-edit.sh
    - development-artifacts/patch-steward-m6-5.3-report.md
- context: |
    Git Bash; run every command from your tree root. jq is NOT installed (use `gh --jq` or node). core.autocrlf=true.
    actionlint 1.7.12 is installed. Never run a formatter on development-artifacts/. Never print a token or secret; never
    `set -x`. This step makes NO GitHub write: never run app-edit.sh with valid arguments here.

    Purpose: two live scenarios need an event whose sender is the test App's bot user (id 331019482): a pull request title
    edit by the App (expected: the steward treats it as a duplicate) and an issue close by the App (expected: closure
    resolution closed-by-maintainer, because the sender is not the author). The helper workflow runs on workflow_dispatch
    only, only for sender id 2095171 (the dispatching user), declares the publication Environment steward-publication to
    receive the App credentials PATCH_STEWARD_APP_ID and PATCH_STEWARD_APP_PRIVATE_KEY (Environment secrets), mints a
    repository-scoped installation token itself (JWT signed with node:crypto; issues write for issues, pull requests write
    for pull requests), performs exactly one PATCH (title, or state closed), revokes the token, and prints only lines
    `app-edit installation status=<code>`, `app-edit token status=<code>`, `app-edit <title or close> status=<code>`,
    `app-edit revoke status=<code>`, or `app-edit error=<reason>`. Inputs reach the script only through `env:` (never an
    expression inside `run:`). The file was designed and verified by the decomposer (actionlint clean, Prettier clean, script
    checked with node --check and with a mocked fetch). Produce it ONLY by extracting the FILE BLOCK below with the node
    command in actions step 2; never retype or edit it.

    scenarios/ is persistent: no planning identifiers (no milestone, phase, step, gate-item, or owner-action ids, no
    `development-artifacts`), never the probe suite's App secret names (STEWARD_APP_ followed by ID, PRIVATE_KEY, or
    CLIENT_ID without the PATCH_ prefix), no raw control, bidi, or zero-width characters.

    TOOL: scenarios/tools/app-edit.sh (output prefix APP-EDIT). Header comment in the style of scenarios/tools/secret-scope.sh.
    `set -uo pipefail`; only bash, gh, git, node, coreutils.
      Usage:
        bash scenarios/tools/app-edit.sh <owner/repo> <issue or pr> <number> title <new title>
        bash scenarios/tools/app-edit.sh <owner/repo> <issue or pr> <number> close
      Validate before any network call; on any violation print both usage lines to stderr and exit 2: owner/repo matches
      ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$; kind is issue or pr; number matches ^[1-9][0-9]{0,9}$; operation `title` takes exactly
      5 arguments and the title starts with `[scenario S`, has at most 200 characters, and contains no character with code
      below 32 or equal to 127; operation `close` takes exactly 4 arguments; any other operation is a usage error.
      Then, in order:
        1. `gh api rate_limit --jq .resources.core.remaining` below 500 (or unreadable) -> `APP-EDIT error=rate-limit-low`, exit 1.
        2. `bash probes/smoke/tools/deploy.sh <repo> master "scenario: deploy App edit helper" scenarios/workflows/scenario-app-edit.yml`
           (idempotent; prints DEPLOY lines); non-zero -> `APP-EDIT error=deploy-failed`, exit 1.
        3. `bash probes/smoke/tools/dispatch.sh <repo> scenario-app-edit.yml master kind=<kind> number=<number> operation=<op>`
           plus `title=<title>` (one argument) for the title operation; print its output; PROBE_WAIT_SECONDS passes through
           from the caller (dispatch.sh defaults to 540). Run id = the number in its `DISPATCH run_id=<id>` line. Exit 3 from
           dispatch.sh -> `APP-EDIT repo=<repo> run=<id> result=still-running`, exit 3; no run id or another non-zero exit ->
           `APP-EDIT error=dispatch-failed`, exit 1.
        4. `gh run view <id> -R <repo> --log`: for every line, take the third TAB-separated field, remove a leading byte
           order mark (character 65279; build it with String.fromCharCode(65279) if you use node) and the first
           space-separated token (the timestamp); when the remainder starts with `app-edit `, print `APP-EDIT log=<remainder>`
           (lines echoed from the step script start with `^[` and never match).
        5. Pass when one remainder equals exactly `app-edit <op> status=200`: print
           `APP-EDIT repo=<repo> kind=<kind> number=<number> operation=<op> run=<id> url=https://github.com/<repo>/actions/runs/<id> result=ok`,
           exit 0; else the same line with `result=failed`, exit 1.

    FILE BLOCKS
    ===== BEGIN FILE scenarios/workflows/scenario-app-edit.yml =====
    # Scenario helper: performs one edit on a scenario issue or pull request with an installation token of the test App, so
    # the event it causes has the App's bot user as its sender. Dispatched on the default branch, it runs only for the
    # allowlisted user; the App credentials come from the publication Environment. Prints HTTP status codes only, never a
    # credential, and revokes the token before it exits.
    name: scenario-app-edit
    run-name: scenario-app-edit ${{ inputs.nonce }}

    on:
      workflow_dispatch:
        inputs:
          nonce:
            description: Unique marker that lets the dispatching script find this run
            required: true
            type: string
          kind:
            description: issue or pr
            required: true
            type: string
          number:
            description: Issue or pull request number
            required: true
            type: string
          operation:
            description: title (set the title) or close (close the issue or pull request)
            required: true
            type: string
          title:
            description: New title for the title operation
            required: false
            type: string
            default: ''

    permissions: {}

    jobs:
      edit:
        name: edit
        if: ${{ github.event.sender.id == 2095171 }}
        runs-on: ubuntu-latest
        timeout-minutes: 5
        environment: steward-publication
        permissions: {}
        steps:
          - name: Edit with an App installation token
            env:
              PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}
              PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}
              EDIT_REPOSITORY: ${{ github.repository }}
              EDIT_KIND: ${{ inputs.kind }}
              EDIT_NUMBER: ${{ inputs.number }}
              EDIT_OPERATION: ${{ inputs.operation }}
              EDIT_TITLE: ${{ inputs.title }}
            run: |
              cat > "$RUNNER_TEMP/app-edit.mjs" << 'SCRIPT'
              import { createSign } from 'node:crypto';

              const env = process.env;
              const say = (line) => console.log('app-edit ' + line);
              const appId = env.PATCH_STEWARD_APP_ID ?? '';
              const key = env.PATCH_STEWARD_APP_PRIVATE_KEY ?? '';
              const repository = env.EDIT_REPOSITORY ?? '';
              const kind = env.EDIT_KIND ?? '';
              const number = env.EDIT_NUMBER ?? '';
              const operation = env.EDIT_OPERATION ?? '';
              const title = env.EDIT_TITLE ?? '';

              if (!/^[1-9][0-9]{0,19}$/.test(appId) || key.length === 0) {
                say('error=credentials-missing');
                process.exit(1);
              }
              const printable = [...title].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127);
              const titleOk = title.startsWith('[scenario S') && title.length <= 200 && printable;
              if (
                !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repository) ||
                !['issue', 'pr'].includes(kind) ||
                !/^[1-9][0-9]{0,9}$/.test(number) ||
                !['title', 'close'].includes(operation) ||
                (operation === 'title' && !titleOk)
              ) {
                say('error=invalid-input');
                process.exit(1);
              }

              let jwt;
              try {
                const b64url = (text) => Buffer.from(text).toString('base64url');
                const now = Math.floor(Date.now() / 1000);
                const claims = { iat: now - 60, exp: now + 480, iss: Number(appId) };
                const unsigned = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify(claims));
                const signer = createSign('RSA-SHA256');
                signer.update(unsigned);
                jwt = unsigned + '.' + signer.sign(key).toString('base64url');
              } catch {
                say('error=jwt');
                process.exit(1);
              }

              async function call(method, path, token, body) {
                const headers = {
                  accept: 'application/vnd.github+json',
                  authorization: 'Bearer ' + token,
                  'user-agent': 'patch-steward-scenario-app-edit',
                  'x-github-api-version': '2022-11-28',
                };
                if (body !== undefined) headers['content-type'] = 'application/json';
                const response = await fetch('https://api.github.com' + path, {
                  method,
                  headers,
                  body: body === undefined ? undefined : JSON.stringify(body),
                  redirect: 'error',
                });
                const text = await response.text();
                let json = null;
                try {
                  json = text.length > 0 ? JSON.parse(text) : null;
                } catch {
                  json = null;
                }
                return { status: response.status, json };
              }

              const installation = await call('GET', '/repos/' + repository + '/installation', jwt);
              say('installation status=' + installation.status);
              if (installation.status !== 200 || typeof installation.json?.id !== 'number') process.exit(1);

              const permissions = kind === 'pr' ? { pull_requests: 'write' } : { issues: 'write' };
              const minted = await call('POST', '/app/installations/' + installation.json.id + '/access_tokens', jwt, {
                repositories: [repository.split('/')[1]],
                permissions,
              });
              say('token status=' + minted.status);
              if (minted.status !== 201 || typeof minted.json?.token !== 'string') process.exit(1);
              const token = minted.json.token;
              console.log('::add-mask::' + token);

              let ok = false;
              try {
                const path = '/repos/' + repository + (kind === 'pr' ? '/pulls/' : '/issues/') + number;
                const edited = await call('PATCH', path, token, operation === 'title' ? { title } : { state: 'closed' });
                say(operation + ' status=' + edited.status);
                ok = edited.status === 200;
              } finally {
                const revoked = await call('DELETE', '/installation/token', token);
                say('revoke status=' + revoked.status);
              }
              process.exit(ok ? 0 : 1);
              SCRIPT
              node "$RUNNER_TEMP/app-edit.mjs"
    ===== END FILE scenarios/workflows/scenario-app-edit.yml =====
- actions: |
    1. (No dependency.) Confirm the tools the new tool calls exist: `ls probes/smoke/tools/deploy.sh probes/smoke/tools/dispatch.sh`.
    2. Extract the workflow (run exactly this from the tree root):
       node -e "const fs=require('fs'),path=require('path');const L=fs.readFileSync('development-artifacts/patch-steward-m6-5.3.md','utf8').replace(/\r\n/g,'\n').split('\n');for(const n of process.argv.slice(1)){const b=L.indexOf('    ===== BEGIN FILE '+n+' =====');const e=L.indexOf('    ===== END FILE '+n+' =====');if(b<0||e<b)throw new Error('markers '+n);const out=L.slice(b+1,e).map(l=>{if(l.trim()==='')return '';if(!l.startsWith('    '))throw new Error('indent '+n);return l.slice(4)});fs.mkdirSync(path.dirname(n),{recursive:true});fs.writeFileSync(n,out.join('\n')+'\n');console.log('wrote '+n)}" scenarios/workflows/scenario-app-edit.yml
    3. Write scenarios/tools/app-edit.sh per context; `bash -n` it. Do NOT run it with valid arguments (that writes to GitHub).
    4. Run acceptance 1-8 and record verbatim outputs in the report.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. node -e "const fs=require('fs');const L=fs.readFileSync('development-artifacts/patch-steward-m6-5.3.md','utf8').replace(/\r\n/g,'\n').split('\n');let bad=[];for(const n of process.argv.slice(1)){const b=L.indexOf('    ===== BEGIN FILE '+n+' =====');const e=L.indexOf('    ===== END FILE '+n+' =====');const want=L.slice(b+1,e).map(l=>l.trim()===''?'':l.slice(4)).join('\n')+'\n';const got=fs.existsSync(n)?fs.readFileSync(n,'utf8').replace(/\r\n/g,'\n'):null;if(b<0||e<b||got!==want)bad.push(n)}console.log(bad.length?'DIFFERENT '+bad.join(' '):'verbatim ok')" scenarios/workflows/scenario-app-edit.yml
       -> prints exactly: verbatim ok
    2. actionlint scenarios/workflows/scenario-app-edit.yml; echo "exit $?"
       -> prints exactly: exit 0
    3. pnpm exec prettier --check scenarios/workflows/scenario-app-edit.yml > /dev/null 2>&1; echo "exit $?"
       -> prints exactly: exit 0
    4. bash -n scenarios/tools/app-edit.sh; echo "exit $?"
       -> prints exactly: exit 0
    5. for a in "" "x/y issue 1" "x/y bug 1 close" "x/y issue 0 close" "x/y pr 1 title" "x/y pr 1 title untagged" "x/y pr 1 close extra" "x/y pr 1 rename t" "bad issue 1 close"; do bash scenarios/tools/app-edit.sh $a > /dev/null 2>&1; echo "exit $?"; done
       -> prints exactly nine lines, each: exit 2
    6. node -e "const s=require('fs').readFileSync('scenarios/workflows/scenario-app-edit.yml','utf8').replace(/\r/g,'').split('\n');const i=s.findIndex(l=>l.trim()==='run: |');const body=s.slice(i+1).filter(l=>l.startsWith('          ')||l.trim()==='');console.log(i>0&&body.length>50&&!body.some(l=>l.includes('\${{'))?'run block clean':'run block dirty')"; grep -c 'secrets\.' scenarios/workflows/scenario-app-edit.yml; grep -c '^    environment: steward-publication' scenarios/workflows/scenario-app-edit.yml
       -> prints exactly three lines: run block clean, 2, 1
    7. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b|set -x|auth token|--force' -- scenarios/workflows/scenario-app-edit.yml scenarios/tools/app-edit.sh; echo "exit $?"
       -> prints exactly: exit 1
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/workflows/scenario-app-edit.yml scenarios/tools/app-edit.sh
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes both files; nothing is deployed by this step).
