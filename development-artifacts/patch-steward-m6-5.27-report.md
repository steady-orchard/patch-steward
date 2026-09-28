- status: pass
- base: 937e51a7a59e9e7237b19c29ced20f6592d0988c
- changes: |
    scenarios/workflows/scenario-secret-scope-called.yml: job `inside` `environment: steward-publication` replaced with
    mapping form `environment:` / `  name: steward-publication` / `  deployment: false` (indentation 4/6/6 spaces).
    scenarios/workflows/scenario-app-edit.yml: job `edit` same replacement, same indentation. No other lines changed in
    either file.
- acceptance: |
    actionlint -ignore 'could not read reusable workflow file' scenarios/workflows/*.yml; echo "exit $?"
    exit 0

    for f in scenarios/workflows/scenario-secret-scope-called.yml scenarios/workflows/scenario-app-edit.yml; do tr -d '\r' < $f | grep -c -x -E '    environment:|      name: steward-publication|      deployment: false'; tr -d '\r' < $f | grep -c 'environment: steward-publication'; done
    3
    0
    3
    0

    node -e '...derived-ok check...'
    derived ok

    node -e '...jobs check...'
    jobs ok

    bash scenarios/tools/secret-scope.sh check
    SECRET-SCOPE check=mapping identical
    SECRET-SCOPE check=declarations identical

    pnpm exec prettier --check scenarios/workflows > /dev/null 2>&1; echo "prettier $?"
    prettier 0
- deviations: none
