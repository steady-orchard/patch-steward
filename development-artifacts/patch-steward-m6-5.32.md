# Step 5.32

- id: 5.32
- depends_on: [5.31]
- route: mechanical
- objective: Regenerate the test-bed wrapper copies scenarios/workflows/steward-pr.yml and scenarios/workflows/steward-issues.yml from the wrapper templates, pinned to the commit pushed in step 5.31 (the publication Environment fix), with the test-bed sender guard.
- files_in_scope:
    - scenarios/workflows/steward-pr.yml
    - scenarios/workflows/steward-issues.yml
    - development-artifacts/patch-steward-m6-5.32-report.md
- context: |
    Repo root in Git Bash. core.autocrlf=true (never anchor a grep with `$` on file contents). jq is NOT installed (use
    node). actionlint 1.7.12 is installed. Never run a formatter on development-artifacts/. No GitHub write; deploy
    nothing (a later step deploys). Never edit templates/.

    The test-bed copies are the wrapper templates (templates/workflows/steward-pr.yml and templates/workflows/
    steward-issues.yml, unchanged) with exactly three changes, applied mechanically by the node command in actions:
    1. both occurrences of the placeholder SHA (forty zeros) -> PIN, the commit pushed to origin in step 5.31 (the
       `pushed:` line of development-artifacts/patch-steward-m6-5.31-report.md, which must equal the tip of origin
       refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish);
    2. the trailing comment ` # replace with a steward release commit` on the `uses:` line -> ` # pushed steward commit`;
    3. a new line `    if: ${{ github.event.sender.id == 2095171 || github.event.sender.id == 331019482 }}` right after
       the line `    name: screen` (test-bed sender guard; not part of the templates).
    The existing copies are exactly this derivation with the previous pin 7161cd20df662314d14cc7f2f4130102baee1e98; the
    regeneration overwrites them, so the only change is the pin (4 changed lines in total).
- actions: |
    1. Base check: bash -c 'c=$(grep -m1 -o "^pushed: [0-9a-f]\{40\}" development-artifacts/patch-steward-m6-5.31-report.md | cut -d" " -f2); r=$(git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish | cut -f1); if [ -n "$c" ] && [ "$c" = "$r" ] && [ "$(git show "$c:.github/workflows/steward-screening.yml" | tr -d "\r" | grep -c -x "      deployment: false")" = 2 ] && [ -f templates/workflows/steward-pr.yml ] && [ -f templates/workflows/steward-issues.yml ]; then echo "base ok $c"; else echo "MISSING pushed=$c remote=$r"; fi'
       It must print `base ok <40 hex>`; that SHA is PIN. Otherwise STOP and report status missing-base with the output (do
       not push, fetch into branches, or improvise).
    2. Generate both copies (replace <PIN> with the SHA from step 1):
       node -e "const fs=require('fs');const pin=process.argv[1];if(!/^[0-9a-f]{40}$/.test(pin))throw new Error('pin');for(const f of ['steward-pr.yml','steward-issues.yml']){let t=fs.readFileSync('templates/workflows/'+f,'utf8').replace(/\r\n/g,'\n');if((t.match(/0{40}/g)||[]).length!==2)throw new Error('placeholders '+f);if(t.split(' # replace with a steward release commit\n').length!==2)throw new Error('comment '+f);if(t.split('    name: screen\n').length!==2)throw new Error('name '+f);t=t.replace(/0{40}/g,pin).replace(' # replace with a steward release commit\n',' # pushed steward commit\n').replace('    name: screen\n','    name: screen\n    if: '+String.fromCharCode(36)+'{{ github.event.sender.id == 2095171 || github.event.sender.id == 331019482 }}\n');fs.mkdirSync('scenarios/workflows',{recursive:true});fs.writeFileSync('scenarios/workflows/'+f,t);console.log('wrote scenarios/workflows/'+f)}" <PIN>
    3. Do not edit the copies afterwards. Record PIN in the report as a line starting at column 0: `pin: <PIN>`.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. node -e "const fs=require('fs');const pin=(/^pin: ([0-9a-f]{40})/m.exec(fs.readFileSync('development-artifacts/patch-steward-m6-5.32-report.md','utf8'))||[])[1];let ok=!!pin;for(const f of ['steward-pr.yml','steward-issues.yml']){const t=fs.readFileSync('templates/workflows/'+f,'utf8').replace(/\r\n/g,'\n').replace(/0{40}/g,pin).replace(' # replace with a steward release commit\n',' # pushed steward commit\n').replace('    name: screen\n','    name: screen\n    if: '+String.fromCharCode(36)+'{{ github.event.sender.id == 2095171 || github.event.sender.id == 331019482 }}\n');const c=fs.readFileSync('scenarios/workflows/'+f,'utf8').replace(/\r\n/g,'\n');if(c!==t)ok=false}console.log(ok?'derived ok':'derived differs')"
       -> prints exactly: derived ok
    2. bash -c 'p=$(grep -m1 -o "^pin: [0-9a-f]\{40\}" development-artifacts/patch-steward-m6-5.32-report.md | cut -d" " -f2); c=$(grep -m1 -o "^pushed: [0-9a-f]\{40\}" development-artifacts/patch-steward-m6-5.31-report.md | cut -d" " -f2); r=$(git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish | cut -f1); [ -n "$p" ] && [ "$p" = "$c" ] && git merge-base --is-ancestor "$p" "$r" && [ "$(grep -c "$p" scenarios/workflows/steward-pr.yml)" = 2 ] && [ "$(grep -c "$p" scenarios/workflows/steward-issues.yml)" = 2 ] && echo pin-ok'
       -> prints exactly: pin-ok
    3. actionlint scenarios/workflows/steward-pr.yml scenarios/workflows/steward-issues.yml; echo "exit $?"
       -> prints exactly: exit 0
    4. pnpm exec prettier --check scenarios/workflows > /dev/null 2>&1; echo "prettier $?"
       -> prints exactly: prettier 0
    5. grep -c 7161cd20df662314d14cc7f2f4130102baee1e98 scenarios/workflows/steward-pr.yml scenarios/workflows/steward-issues.yml
       -> prints exactly two lines: scenarios/workflows/steward-pr.yml:0, scenarios/workflows/steward-issues.yml:0
    6. git status --porcelain -- templates .github packages -> no output
- rollback: |
    git revert <this step's commit> (restores the copies pinned to the previous commit; nothing was deployed).
