- status: pass
- base: 4c1a2d8ff527cbeffeb16c940f42901f2f2709c3
- changes: |
    Created templates/workflows/steward-pr.yml and templates/workflows/steward-issues.yml via the node extraction command
    against development-artifacts/patch-steward-m6-4.3.md FILE BLOCKS. Overwrote templates/README.md with its full new content
    (existing content plus one appended bullet describing the wrapper workflows), per the same extraction command.
- acceptance: |
    1. node -e "...verbatim comparison..." templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml templates/README.md
       -> verbatim ok
    2. actionlint templates/workflows/steward-pr.yml templates/workflows/steward-issues.yml; echo "exit $?"
       -> exit 0
    3. pnpm exec prettier --check templates
       -> Checking formatting...
          All matched files use Prettier code style!
          exit 0
    4. node -e "...readme prefix check..."
       -> readme appended
    5. node -e "...zero-placeholder count..."
       -> steward-pr.yml 2 mapped
          steward-issues.yml 2 mapped
    6. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- templates
       -> (no output, exit 1)
    7. node -e "...control/bidi/zero-width char scan..."
       -> clean
- deviations: none
