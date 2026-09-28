# Step 4.3

- id: 4.3
- depends_on: []
- route: mechanical
- objective: Add the two wrapper workflow templates templates/workflows/steward-pr.yml and templates/workflows/steward-issues.yml and document them in templates/README.md, all byte-exact from the FILE BLOCKS below.
- files_in_scope:
    - templates/workflows/steward-pr.yml
    - templates/workflows/steward-issues.yml
    - templates/README.md
    - development-artifacts/patch-steward-m6-4.3-report.md
- context: |
    Repo: pnpm monorepo; Git Bash; run every command from your tree root. core.autocrlf=true (working tree is CRLF: never anchor a
    grep with `$`). jq is NOT installed (use node). actionlint 1.7.12 is installed. Never run a formatter on development-artifacts/.

    What the files are (designed and verified with actionlint and Prettier; you copy them, never edit them):
    - The wrappers are the target-repository workflows that call the reusable screening workflow
      `steady-orchard/patch-steward/.github/workflows/steward-screening.yml@<40-hex SHA>` (added by a sibling step; actionlint
      does not fetch remote reusable workflows, so it passes without it). Each: `name`, a `run-name` built only from numeric ids
      and event enums (`steward pr|issue <number> author <id> event <event_name> <action> sender <id> <type>`), `on` with the
      accepted event types (pull_request_target: opened, synchronize, edited, reopened, ready_for_review, closed; issues: opened,
      edited, reopened, closed, deleted), `permissions: {}`, one job `screen` (`name: screen`, `permissions: {}`, `uses:` pinned
      by the placeholder SHA of forty zeros with a trailing comment, `with: steward_ref:` the same placeholder as a quoted
      string, and a `secrets:` block mapping exactly PATCH_STEWARD_APP_ID and PATCH_STEWARD_APP_PRIVATE_KEY by name, never
      `inherit`).
    - The wrappers carry NO sender guard (`if:`); test-bed copies add one elsewhere. The line `    name: screen` is followed by
      `    permissions: {}` in both files, and each file contains the forty-zero placeholder exactly twice: later steps rely on
      both facts.
    - templates/README.md: the existing README with one new bullet appended at the end describing the wrappers (no other change).

    The files are produced by extracting the FILE BLOCKS at the end of this context with the node command in actions step 2 (it
    strips exactly the 4-space block indentation; blank lines stay empty). Do not retype them.

    FILE BLOCKS
    ===== BEGIN FILE templates/workflows/steward-pr.yml =====
    name: steward-pr
    run-name: steward pr ${{ github.event.pull_request.number }} author ${{ github.event.pull_request.user.id }} event ${{ github.event_name }} ${{ github.event.action }} sender ${{ github.event.sender.id }} ${{ github.event.sender.type }}

    on:
      pull_request_target:
        types: [opened, synchronize, edited, reopened, ready_for_review, closed]

    permissions: {}

    jobs:
      screen:
        name: screen
        permissions: {}
        uses: steady-orchard/patch-steward/.github/workflows/steward-screening.yml@0000000000000000000000000000000000000000 # replace with a steward release commit
        with:
          steward_ref: '0000000000000000000000000000000000000000'
        secrets:
          PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}
          PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}
    ===== END FILE templates/workflows/steward-pr.yml =====
    ===== BEGIN FILE templates/workflows/steward-issues.yml =====
    name: steward-issues
    run-name: steward issue ${{ github.event.issue.number }} author ${{ github.event.issue.user.id }} event ${{ github.event_name }} ${{ github.event.action }} sender ${{ github.event.sender.id }} ${{ github.event.sender.type }}

    on:
      issues:
        types: [opened, edited, reopened, closed, deleted]

    permissions: {}

    jobs:
      screen:
        name: screen
        permissions: {}
        uses: steady-orchard/patch-steward/.github/workflows/steward-screening.yml@0000000000000000000000000000000000000000 # replace with a steward release commit
        with:
          steward_ref: '0000000000000000000000000000000000000000'
        secrets:
          PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}
          PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}
    ===== END FILE templates/workflows/steward-issues.yml =====
    ===== BEGIN FILE templates/README.md =====
    # Templates

    Files here are meant to be copied into target repositories. This is a root directory, not a workspace package.

    - `policy/policy.yml` — the policy skeleton: copy it to `.github/patch-steward/policy.yml` on the default branch and edit
      it. Every key is written explicitly, including keys with documented defaults. `llm.model` holds the placeholder
      `replace-with-model-id`, which must be replaced with a real model id. The built-in dismissal codes appear as comments.
    - `policy/policy.schema.json` — JSON Schema generated from the steward's policy schema for editor completion and
      checking. Runtime validation in the steward governs; cross-field rules such as reference integrity and provider
      pairing are not expressible in it. It is not copied into `.github/patch-steward/`, because every file in that
      directory changes the policy revision.
    - `issue-forms/steward-defect.yml` — the defect issue form: copy it to `.github/ISSUE_TEMPLATE/steward-defect.yml`. Screening
      finds each field by its rendered label, so keep the labels unchanged; element ids equal the canonical field ids and serve
      only URL prefilling. The form has no `labels:` key and no severity field, and its `required` flags equal the policy
      template's `submission.issue_fields.defect` list; the policy governs screening.
    - `issue-forms/steward-proposal.yml` — the proposal issue form: copy it to `.github/ISSUE_TEMPLATE/steward-proposal.yml`. The
      same label rules apply; its `required` flags equal `submission.issue_fields.proposal`.
    - `pull-request/pull_request_template.md` — the pull request template: copy it to `.github/pull_request_template.md`. Its
      first line, `<!-- patch-steward:pr-template v1 -->`, names the template version; screening finds each field by its `##`
      heading, compared case-insensitively. Hint comments are ignored.
    - `workflows/steward-pr.yml` and `workflows/steward-issues.yml` — the wrapper workflows: copy them to `.github/workflows/` on
      the default branch. Each calls the reusable screening workflow `.github/workflows/steward-screening.yml` of this repository,
      pinned by a full commit SHA, and passes the same SHA as the `steward_ref` input; both placeholder SHAs (forty zeros) must be
      replaced by the commit of one steward release, and no release exists yet. The pull request wrapper runs on
      `pull_request_target` (opened, synchronize, edited, reopened, ready_for_review, closed) and the issue wrapper on `issues`
      (opened, edited, reopened, closed, deleted). The `run-name` carries only the submission number, the author and sender ids,
      the event and action names, and the sender type, which the run-count caps read. The job grants no token permissions and
      passes the App secrets `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY` by explicit name mapping, never with
      `secrets: inherit`; their values come from the Environment `steward-publication`, which only the reusable workflow's
      `gate` and `publish` jobs declare.
    ===== END FILE templates/README.md =====
- actions: |
    1. Confirm templates/workflows/ does not exist yet: `ls templates/workflows` must fail (if it exists, STOP and report status
       fail with the listing).
    2. Extract the three files (run exactly this from the tree root; it overwrites templates/README.md with the new full content):
       node -e "const fs=require('fs'),path=require('path');const L=fs.readFileSync('development-artifacts/patch-steward-m6-4.3.md','utf8').replace(/\r\n/g,'\n').split('\n');for(const n of process.argv.slice(1)){const b=L.indexOf('    ===== BEGIN FILE '+n+' =====');const e=L.indexOf('    ===== END FILE '+n+' =====');if(b<0||e<b)throw new Error('markers '+n);const out=L.slice(b+1,e).map(l=>{if(l.trim()==='')return '';if(!l.startsWith('    '))throw new Error('indent '+n);return l.slice(4)});fs.mkdirSync(path.dirname(n),{recursive:true});fs.writeFileSync(n,out.join('\n')+'\n');console.log('wrote '+n)}" templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml templates/README.md
    3. Do not edit the files afterwards. If actionlint or Prettier reports anything, STOP and report status fail with the verbatim
       output.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. node -e "const fs=require('fs');const L=fs.readFileSync('development-artifacts/patch-steward-m6-4.3.md','utf8').replace(/\r\n/g,'\n').split('\n');let bad=[];for(const n of process.argv.slice(1)){const b=L.indexOf('    ===== BEGIN FILE '+n+' =====');const e=L.indexOf('    ===== END FILE '+n+' =====');const want=L.slice(b+1,e).map(l=>l.trim()===''?'':l.slice(4)).join('\n')+'\n';const got=fs.existsSync(n)?fs.readFileSync(n,'utf8').replace(/\r\n/g,'\n'):null;if(b<0||e<b||got!==want)bad.push(n)}console.log(bad.length?'DIFFERENT '+bad.join(' '):'verbatim ok')" templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml templates/README.md
       -> prints exactly: verbatim ok
    2. actionlint templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml; echo "exit $?"
       -> prints exactly: exit 0
    3. pnpm exec prettier --check templates -> exit 0
    4. node -e "const fs=require('fs');const a=fs.readFileSync('templates/README.md','utf8').replace(/\r\n/g,'\n');const b=require('child_process').execSync('git show HEAD:templates/README.md').toString().replace(/\r\n/g,'\n');console.log(a.startsWith(b)&&a.length>b.length?'readme appended':'readme changed otherwise')"
       -> prints exactly: readme appended
    5. node -e "const fs=require('fs');for(const f of ['steward-pr.yml','steward-issues.yml']){const t=fs.readFileSync('templates/workflows/'+f,'utf8');console.log(f+' '+(t.match(/0{40}/g)||[]).length+' '+(t.includes('inherit')?'inherit':'mapped'))}"
       -> prints exactly two lines: steward-pr.yml 2 mapped, then steward-issues.yml 2 mapped
    6. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- templates
       -> no output (exit 1)
    7. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml templates/README.md
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes templates/workflows/ and restores templates/README.md).
