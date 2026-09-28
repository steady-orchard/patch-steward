- status: pass
- base: 4f5d5ab996dfc0d09ef285e4251f13c2c8aafdd9
- changes: |
    Created fixtures/events/ with 14 hand-built webhook payload fixtures (issues-opened.json,
    issues-edited.json, issues-edited-by-bot.json, issues-edited-hostile.json, issues-reopened.json,
    issues-closed.json, issues-closed-by-maintainer.json, issues-deleted.json,
    issues-opened-pull-request.json, pull-request-target-opened.json, pull-request-target-edited.json,
    pull-request-target-synchronize.json, pull-request-target-closed-merged.json,
    pull-request-target-opened-fork.json) per the packet's field-by-field spec, using the recorded
    test-bed identity (repository id 1376317064, issue 29, pull request 26, author jambolo, App bot
    patch-steward-testbed[bot], maintainer-example). Added one "events/" bullet to fixtures/README.md's
    "Current entries" list directly after the github/hosted/ bullet, wrapped like neighbouring bullets;
    no other README changes. Ran `pnpm exec prettier --write fixtures/events fixtures/README.md`
    (files were already Prettier-clean; no diffs).
- acceptance: |
    node -e "console.log(require('fs').readdirSync('fixtures/events').length)"
    14

    node -e "...payloads ok check..."
    payloads ok

    node -e "...variants ok check..."
    variants ok

    node -e "...readme ok check..."
    readme ok

    pnpm exec prettier --check fixtures/events fixtures/README.md
    Checking formatting...
    All matched files use Prettier code style!

    node -e "...control/format character scan..." fixtures/README.md fixtures/events/*.json
    clean

    git grep --untracked -n -E 'ghp_|ghs_|github_pat_|-----BEGIN' -- fixtures/events; echo "grep $?"
    grep 1
- deviations: none
