- status: pass
- base: 74361ed5823276f084cf58ea3e2e5215ad55f6cf
- changes: |
    scenarios/results/org-public.md: appended section "## S10 pull requests: close by the author, merge into a scenario
    base" recording pull request 36 (opened and closed by its author, both runs pass) and pull request 37 (opened and
    merged into branch scenario-s10-base, both runs pass, metrics for both closures, evidence check).
    development-artifacts/patch-steward-m6-5.20-report.md: this report.
    Test-bed effects (steady-orchard/patch-steward-testbed-public, outside files_in_scope, not committed here): branches
    scenario-s10-close, scenario-s10-base, scenario-s10-merge created; pull request 36 opened then closed by its author
    (closed-by-author); pull request 37 opened against scenario-s10-base then merged (merged); steward-evidence branch
    holds the new run/metrics commits.
- acceptance: |
    $ (base check) grep -q "^s10_app_close_run: [0-9]" development-artifacts/patch-steward-m6-5.19-report.md 2>/dev/null || echo "MISSING 5.19 report"; grep -q "^## S10 issue: close" scenarios/results/org-public.md || echo "MISSING S10 part two"; echo checked
    checked

    $ pnpm install --frozen-lockfile && pnpm build
    (build succeeded: core, cli, web, action all built)

    $ gh api rate_limit --jq .resources.core.remaining
    5000

    Action 3 (pull request closed by its author):
    deploy scenario-s10-close: DEPLOY commit=822d2be929692accce1ff3e22e7ca10f8ecfebef message=scenario: S10 pull request change
    gh pr create -> https://github.com/steady-orchard/patch-steward-testbed-public/pull/36 (Q=36)
    QOPEN=36421209248 (jobs all success; gate: dedup commit no-owner, disposition early-exit; publish: needs-changes, freshness current)
    gh pr close 36 -> closed
    QCLOSE=36421341796 (jobs all success; gate: disposition closure resolution closed-by-author; publish: closure)
    run-records metrics QCLOSE-1: kind=maintainer-resolution resolution=closed-by-author paired_run=36421209248-1 (count 1)

    Action 4 (pull request merged into a scenario base):
    deploy scenario-s10-base: DEPLOY commit=none reason=already-identical (as expected)
    deploy scenario-s10-merge: DEPLOY commit=881381836f34af84ff8f2838c1eac0128c797827 message=scenario: S10 merge change
    gh pr create --base scenario-s10-base --head scenario-s10-merge -> https://github.com/steady-orchard/patch-steward-testbed-public/pull/37 (M=37)
    MOPEN=36421552482; cls -> pass
    gh pr merge 37 --merge -> gh pr view: state=MERGED baseRefName=scenario-s10-base
    MCLOSE=36421707693; cls -> pass
    run-records metrics MCLOSE-1: kind=maintainer-resolution resolution=merged paired_run=36421552482-1 (count 1)
    gh pr view 37 --json state,baseRefName -> MERGED scenario-s10-base

    Action 5: bash scenarios/tools/evidence.sh ... pr 37
    EVIDENCE append_only=yes
    EVIDENCE run=36421552482-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
    EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=pr-37 runs=1 verified=1 result=ok

    Action 6: pnpm exec prettier --write scenarios/results/org-public.md -> unchanged
    bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01..S10 S17 -> result=pass

    Full acceptance commands (run after this report was written):
    1. merge base opened=pass closed=pass consistent
    2. 1
       1
       1
       1
    3. MERGED scenario-s10-base
    4. RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: none

s10_close_pr: 36
s10_close_pr_run: 36421341796
s10_merge_pr: 37
s10_merge_opened_run: 36421552482
s10_merge_closed_run: 36421707693
s10_merge_opened_case: pass
s10_merge_closed_case: pass
