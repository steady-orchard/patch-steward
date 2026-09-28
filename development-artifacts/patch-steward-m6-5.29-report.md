- status: pass
- base: 937e51a7a59e9e7237b19c29ced20f6592d0988c
- changes: |
    scenarios/tools/audit.sh:
    - Added AUDIT_WRAPPERS_DEPLOYED_AT parsing (usage error exit 2 on bad format) with a fallback read of
      master's history of .github/workflows/steward-pr.yml via gh api commits, computing deployed_at/deployed_source.
    - Added sum_before_fix accumulator and an initial "AUDIT repo=... wrappers_deployed_at=... source=..." line
      printed before any item line.
    - Issue lines now append "before_fix_deployments=n/a".
    - Replaced the plain deployments count with a per-deployment gh api --paginate read returning
      id/environment/ref/creator id/creator login/created_at, classified per-row as before-fix (environment
      steward-publication, creator id 2095171 or 331019482, created_at strictly earlier than deployed_at,
      compared as 14-digit numeric timestamps) or counted, emitting one AUDIT-DEPLOYMENT line per deployment.
    - PR summary line appends "before_fix_deployments=$before_fix"; printed deployment_lines right after the PR line.
    - sum_before_fix accumulated per PR; final summary line appends "before_fix_deployments=$sum_before_fix"
      before result=. Result rule unchanged (still based on head_deployments/counted sums only).
    - Updated header comment: new first line, the four fields on issue/pr lines, AUDIT-DEPLOYMENT line format,
      the before-fix rule (publication Environment, allowlisted creator ids, cutoff from history or override),
      and that before-fix deployments never change the result.
- acceptance: |
    bash -n scenarios/tools/audit.sh; echo "syntax $?"
    syntax 0

    AUDIT_WRAPPERS_DEPLOYED_AT=2026-09-28T16:00:00Z bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public | node -e '...'
    late cutoff ok

    T=$(mktemp); AUDIT_WRAPPERS_DEPLOYED_AT=2026-09-28T08:00:00Z bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public > "$T"; echo "exit $?"; grep -c -E '^AUDIT-DEPLOYMENT .* environment=steward-publication .* class=counted$' "$T"; tail -n 1 "$T" | grep -c -E '^AUDIT repo=steady-orchard/patch-steward-testbed-public submissions=[0-9]+ app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=40 before_fix_deployments=0 result=writes-found$'; rm -f "$T"
    exit 1
    40
    1

    AUDIT_WRAPPERS_DEPLOYED_AT=2026-09-28 bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public > /dev/null 2>&1; echo "exit $?"
    exit 2

    bash scenarios/tools/audit.sh jambolo/patch-steward-testbed-personal | node -e '...'
    history cutoff ok

    git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|owner decision|\bD7\b' -- scenarios/tools/audit.sh; echo "exit $?"
    exit 1
- deviations: none
