- status: pass
- base: 937e51a7a59e9e7237b19c29ced20f6592d0988c
- changes: |
    scenarios/README.md:
    - Layout: extended the secret-scope pair bullet and the `scenario-app-edit.yml` bullet to state the
      `name: steward-publication` + `deployment: false` mapping-form declaration in their jobs (F1, F10).
    - Safety rules: added a bullet stating the declaration rule for the reusable workflow's gate/publish jobs and
      every scenario job declaring the publication Environment, and what plain-form vs. `deployment: false`
      Environment jobs do (F1).
    - Tools: extended `audit.sh` bullet with the new AUDIT-DEPLOYMENT listing/classification behavior,
      `wrappers_deployed_at`/`AUDIT_WRAPPERS_DEPLOYED_AT`, and the `head_deployments`/`before_fix_deployments`
      summary fields (F2, F10); extended `pins.sh` bullet with the environment-check pass condition, the
      `other_form` detail, and `PINS_SCREENING_FILE`/`screening=local` (F3, F10).
    - Setup: added a paragraph on the post-fix procedure (push without force, regenerate pins, redeploy wrappers
      and changed helper workflows, enable/disable workflows per scenario) (F4).
    - S10: rewrote the sequence so the issue is closed by the author, reopened, then closed by the test App
      (closed-by-maintainer), and pull requests are described as one closed by the author and one merged into
      `scenario-s10-base`; removed "close a pull request by the test App" (F5).
    - S13: replaced body and pass condition with the full org-public post-fix pull request procedure and the
      combined audit/deployment pass condition, including the historical before-fix deployment counts for pull
      requests 32, 33, 34, 36, and 37 (F6).
    - S14: replaced pass condition to require the mapping form with `deployment: false` for gate and publish only,
      no job in another form (F7).
    - S17: appended a repeated-run subsection (enable/disable the secret-scope pair, mapping-form + no new
      deployment pass condition), keeping the original S17 sections as recorded (F8).
    - Steady state: extended "What stays" to include Deployments/deployment statuses (naming the historical
      before-fix ones), the disabled `scenario-deployment-probe.yml` workflow and its branch, and a note that the
      `scenario-*` disable rule covers it (F9).
    Ran `pnpm exec prettier --write scenarios/README.md` after editing.
- acceptance: |
    $ pnpm exec prettier --check scenarios/README.md > /dev/null 2>&1; echo "prettier $?"
    prettier 0

    $ node -e '...content-check script...'
    readme ok

    $ git grep -n -P 'development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA|D)[0-9]{1,2}\b|(?i)\bphase [0-9]|(?i)\bstep [0-9]+\.[0-9]+|(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|DF[0-9]{2}|deferred\.md' -- scenarios/README.md; echo "exit $?"
    exit 1

    $ node -e '...control-character-check script...'
    clean
- deviations: none
