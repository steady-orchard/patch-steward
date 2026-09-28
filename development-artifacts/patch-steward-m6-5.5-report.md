- status: pass
- base: 690b55adbd802c43ae248f92f7c64c8cbcc8b4e5
- changes: |
    Generated five scenario fixture files exactly per the packet's node one-liner (action 2), derived byte-for-byte from
    scenarios/fixtures/policies/orphan-branch.yml and scenarios/workflows/steward-pr.yml, changing only the named lines:
      - scenarios/fixtures/policies/invalid-limit.yml: daily_runs 50 -> 1001.
      - scenarios/fixtures/policies/caps-daily.yml: daily_runs 50 -> 1, per_author_concurrent_runs 2 -> 20.
      - scenarios/fixtures/policies/caps-author.yml: daily_runs 50 -> 1000, per_author_concurrent_runs 2 -> 1.
      - scenarios/fixtures/policies/unwritable-store.yml: `type: orphan-branch` -> `type: repository` plus
        `repository: steady-orchard/patch-steward-testbed-unwritable`.
      - scenarios/fixtures/pull-requests/steward-pr-modified.yml (new directory): name -> steward-pr-modified-by-pull-request,
        run-name -> `modified steward pr ${{ github.event.pull_request.number }}`.
    pnpm install --frozen-lockfile && pnpm build had already been run in the worktree before this step (action 3 was a no-op
    to re-verify); action 4 ran acceptance checks 1-4 below.
- acceptance: |
    $ node -e '...(acceptance check 1 script)...'
    fixtures ok

    $ for p in caps-daily caps-author unwritable-store invalid-limit; do node packages/cli/dist/main.js policy --file scenarios/fixtures/policies/$p.yml > /dev/null 2>&1; echo "$p exit $?"; done; node packages/cli/dist/main.js policy --file scenarios/fixtures/policies/invalid-limit.yml 2>&1 | grep -c '^error policy.limit-out-of-bounds limits.caps.daily_runs'
    caps-daily exit 0
    caps-author exit 0
    unwritable-store exit 0
    invalid-limit exit 1
    1

    $ pnpm exec prettier --check scenarios/fixtures > /dev/null 2>&1; echo "prettier $?"; actionlint scenarios/fixtures/pull-requests/steward-pr-modified.yml; echo "actionlint $?"
    prettier 0
    actionlint 0

    $ git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b' -- scenarios/fixtures; echo "exit $?"
    exit 1
- deviations: none
