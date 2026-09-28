- status: pass
- base: 4c1a2d8ff527cbeffeb16c940f42901f2f2709c3
- changes: |
    Extracted .github/workflows/steward-screening.yml and packages/action/pack-runtime.sh byte-exact from the FILE BLOCKS
    in development-artifacts/patch-steward-m6-4.2.md using the node extraction command from actions step 2. No manual edits.
- acceptance: |
    1. node -e "...verbatim check..." .github/workflows/steward-screening.yml packages/action/pack-runtime.sh
       -> verbatim ok
    2. actionlint .github/workflows/steward-screening.yml; echo "exit $?"
       -> exit 0
    3. pnpm exec prettier --check .github/workflows/steward-screening.yml; echo "exit $?"
       -> Checking formatting...
          All matched files use Prettier code style!
          exit 0
    4. pnpm build > /dev/null; echo "exit $?"
       -> exit 0
    5. bash -c 'T=$(mktemp -d); bash packages/action/pack-runtime.sh "$T/rt.tar.gz" > /dev/null && mkdir "$T/x" && tar -xzf "$T/rt.tar.gz" -C "$T/x" && node "$T/x/packages/action/dist/main.js"; echo "exit $?"; rm -rf "$T"'
       -> usage: main.js gate|publish
          exit 2
    6. bash -c '... tar -tzf listing of node_modules top level and top level ...'
       -> @patch-steward yaml zod 
          node_modules packages 
    7. bash packages/action/pack-runtime.sh; echo "exit $?"
       -> usage: pack-runtime.sh <archive path> (stderr)
          exit 2
    8. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- .github/workflows/steward-screening.yml packages/action/pack-runtime.sh
       -> (no output), exit 1
    9. git grep --untracked -c 'PATCH_STEWARD_APP_PRIVATE_KEY' -- .github/workflows/steward-screening.yml
       -> .github/workflows/steward-screening.yml:3
    10. git status --porcelain -- .github/workflows/ci.yml .github/workflows/cd.yml packages/action/src packages/action/package.json pnpm-lock.yaml
        -> (no output)
    11. node -e "...control/bidi/zero-width char scan..." .github/workflows/steward-screening.yml packages/action/pack-runtime.sh
        -> clean
- deviations: none
