- status: pass
- base: 56ad92a172efa4f496163eacbc77183e784d9d87
pin: 7161cd20df662314d14cc7f2f4130102baee1e98
- changes: |
    Created scenarios/workflows/steward-pr.yml and scenarios/workflows/steward-issues.yml from
    templates/workflows/steward-pr.yml and templates/workflows/steward-issues.yml via the node command in actions step 2,
    replacing both placeholder SHAs with the pinned commit 7161cd20df662314d14cc7f2f4130102baee1e98, replacing the
    trailing comment " # replace with a steward release commit" with " # pushed steward commit", and inserting the
    test-bed sender guard line after "    name: screen". No other edits made.
- acceptance: |
    1. node -e "const fs=require('fs');const pin=(/^pin: ([0-9a-f]{40})/m.exec(fs.readFileSync('development-artifacts/patch-steward-m6-4.14-report.md','utf8'))||[])[1];let ok=!!pin;for(const f of ['steward-pr.yml','steward-issues.yml']){const t=fs.readFileSync('templates/workflows/'+f,'utf8').replace(/\r\n/g,'\n').replace(/0{40}/g,pin).replace(' # replace with a steward release commit\n',' # pushed steward commit\n').replace('    name: screen\n','    name: screen\n    if: '+String.fromCharCode(36)+'{{ github.event.sender.id == 2095171 || github.event.sender.id == 331019482 }}\n');const c=fs.readFileSync('scenarios/workflows/'+f,'utf8').replace(/\r\n/g,'\n');if(c!==t)ok=false}console.log(ok?'derived ok':'derived differs')"
       derived ok
    2. bash -c 'p=$(grep -m1 -o "^pin: [0-9a-f]\{40\}" development-artifacts/patch-steward-m6-4.14-report.md | cut -d" " -f2); r=$(git ls-remote origin refs/heads/milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish | cut -f1); [ -n "$p" ] && git merge-base --is-ancestor "$p" "$r" && [ "$(grep -c "$p" scenarios/workflows/steward-pr.yml)" = 2 ] && [ "$(grep -c "$p" scenarios/workflows/steward-issues.yml)" = 2 ] && echo pin-ok'
       pin-ok
    3. actionlint scenarios/workflows/steward-pr.yml scenarios/workflows/steward-issues.yml; echo "exit $?"
       exit 0
    4. pnpm exec prettier --check scenarios
       exit 0 (Checking formatting... All matched files use Prettier code style!)
    5. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|[Mm]ilestone' -- scenarios/workflows/steward-pr.yml scenarios/workflows/steward-issues.yml
       (no output, exit 1)
    6. git status --porcelain -- templates .github packages
       (no output)
- deviations: none
