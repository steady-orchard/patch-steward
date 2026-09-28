- status: pass
- base: 7161cd20df662314d14cc7f2f4130102baee1e98
- changes: |
    Created scenarios/README.md: persistent guide to the test-bed scenario suite with sections Layout, Test-beds,
    Prerequisites, Safety rules, Budgets, Tools, Setup, Procedures (S00-S17), and Steady state, per the step's
    context facts. Ran `pnpm exec prettier --write scenarios/README.md` after writing (table alignment).
- acceptance: |
    1. node -e "...structure..." -> structure ok
    2. node -e "...content..." -> content ok (after fixing capitalization of "the probe suite's App secrets" to
       avoid a spurious case mismatch against the required substring)
    3. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA|DF)[0-9]{1,2}\b|deferred\.md|[Mm]ilestone|\b[Pp]hase [0-9]|\b[Ss]tep [0-9]' -- scenarios/README.md
       -> no output, exit 1
    4. pnpm exec prettier --check scenarios -> exit 0, "All matched files use Prettier code style!"
    5. node -e "...control/bidi/zero-width scan..." scenarios/README.md -> clean
- deviations: none
