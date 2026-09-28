# Step 5.24

- id: 5.24
- depends_on: [5.23, 5.8, 5.9, 5.4]
- route: mechanical
- objective: On all three test-beds run the observe-mode audit (S13) and the static pin and Environment check (S14), record both in each results file, then put every test-bed into the documented steady state (steward and scenario workflows disabled, no open scenario submission) and record it.
- files_in_scope:
    - scenarios/results/org-public.md
    - scenarios/results/personal.md
    - scenarios/results/org-private.md
    - development-artifacts/patch-steward-m6-5.24-report.md
- context: |
    ENVIRONMENT. Git Bash; run every command from your tree root. jq is NOT installed (use `gh --jq` or node).
    core.autocrlf=true (strip CR before comparing text). gh is logged in as jambolo (user id 2095171). `gh api` endpoints
    never start with `/` (Git Bash rewrites them). The Bash tool call times out at 600 s: run every waiting tool with
    `PROBE_WAIT_SECONDS=540` in front and, when it exits 3 (still waiting), run the same call once more; a second exit 3 is
    a failure (at most 15 min per run). Poll no faster than every 20 s. Before every GitHub write check
    `gh api rate_limit --jq .resources.core.remaining` prints a number >= 500 (else STOP, status fail). Never print, log, or
    store a token, key, or secret (never `gh auth token`, never `set -x`). Never run a formatter on development-artifacts/.
    GitHub writes allowed in this step: ONLY the commands written in actions, on the named test-bed. Never write a
    test-bed's master except through the deploy tools named in actions; never delete an issue, pull request, branch, or
    repository; never touch org-public issue 29 or pull requests 26 and 27; never rerun a workflow unless actions say so.
    On any unexpected result: collect the evidence named in actions, record it, write the results section with
    `Result: fail`, set report status fail, and STOP (no improvised retries or repairs).
    The only GitHub writes of this step are the ones steady-state.sh apply makes (disable workflows, close open scenario
    issues and pull requests); everything else is read-only.

    Test-beds and results files:
      org-public   steady-orchard/patch-steward-testbed-public   scenarios/results/org-public.md
      personal     jambolo/patch-steward-testbed-personal         scenarios/results/personal.md
      org-private  steady-orchard/patch-steward-testbed-private   scenarios/results/org-private.md
    Tools (read-only unless marked):
      audit.sh <repo>: for every issue and pull request titled `[scenario S...`, counts comments by the test App's bot
        (331019482), labels, and for pull requests App check runs on the head commit, requested reviewers, and deployments of
        the head commit; prints one AUDIT line per submission and a final
        `AUDIT repo=<r> submissions=<n> app_comments=<a> labels=<l> app_check_runs=<c> requested_reviewers=<v> head_deployments=<d> result=clean|writes-found`.
      pins.sh <repo>: eight `PINS repo=<r> check=<name> ok|FAIL ...` lines (wrapper blob identity, pin equality, pin reachable
        on the pushed steward branch, only gate and publish declare the Environment steward-publication, only they reference
        the two App secrets, explicit secrets mapping, no probe secret names, every uses pinned by a resolvable 40-hex SHA),
        then `PINS repo=<r> pin=<sha> result=pass|fail`.
      steady-state.sh <repo> plan|apply (apply = WRITE): disables every workflow whose path is .github/workflows/steward-pr.yml,
        .github/workflows/steward-issues.yml, or starts with .github/workflows/scenario- (the called-only
        scenario-secret-scope-called.yml may stay active), then closes every open issue or pull request titled
        `[scenario S...` (with the workflows already disabled, closing starts no run); prints SCENARIO-STEADY lines and finally
        `SCENARIO-STEADY <r> result=steady active_workflows=0 open_submissions=0` (apply) or `result=planned ...` (plan).
      results-check.sh <file> <ids...>: last line `RESULTS-CHECK file=<file> result=pass`.
    Scenario S13 pass on a test-bed: the final AUDIT line has every count 0 and `result=clean`. Scenario S14 pass: `result=pass`.
    Steady state: steady-state.sh apply ends `result=steady active_workflows=0 open_submissions=0`; the evidence branches, the
    evidence repository, the policies, the Environments, the wrapper files (disabled), and the closed scenario submissions
    stay (nothing is deleted).
    Each results file (persistent, Prettier-checked; APPEND only, never change existing text) gets three new sections at the
    end: `## S13 observe mode writes nothing on submissions`, `## S14 only gate and publish use the publication Environment;
    everything is pinned`, and `## Steady state`. Each: blank line; `Date (UTC): <YYYY-MM-DD>.` and one sentence; a ```text
    fence with `$ <command>` and its verbatim output; blank line; for S13 and S14 a line `Result: pass` (or `Result: fail`).
    The Steady state section holds the apply output, the plan output, and the workflow list below, and no Result line.
    Forbidden anywhere in the files: planning identifiers (milestone, phase, step, gate-item, owner-action or rule ids;
    "owner decision"; `development-artifacts`), the probe suite's App secret names (STEWARD_APP_ + ID, PRIVATE_KEY, or
    CLIENT_ID without the PATCH_ prefix), `ghs_`, `ghp_`, `-----BEGIN`, the characters `^[`, raw control characters.
- actions: |
    1. Base check (files changed in steps 5.23, 5.8, 5.9, 5.4): bash -c 'grep -q "^s12_newest_artifact_created_at: " development-artifacts/patch-steward-m6-5.23-report.md 2>/dev/null || echo "MISSING 5.23 report"; grep -q "^## S12 " scenarios/results/org-public.md || echo "MISSING S12"; grep -q "^## S15 " scenarios/results/personal.md 2>/dev/null || echo "MISSING S15"; grep -q "^## S16 " scenarios/results/org-private.md 2>/dev/null || echo "MISSING S16"; for f in scenarios/tools/pins.sh scenarios/tools/audit.sh scenarios/tools/steady-state.sh scenarios/tools/results-check.sh; do [ -f "$f" ] || echo "MISSING $f"; done; echo checked'
       It must print exactly `checked`; otherwise STOP and report status missing-base with the output (do not fetch, merge, or improvise).
    2. pnpm install --frozen-lockfile; rate limit >= 500.
    3. For each test-bed r (org-public, personal, org-private), record:
       a. bash scenarios/tools/audit.sh r
       b. bash scenarios/tools/pins.sh r
    4. For each test-bed r: bash scenarios/tools/steady-state.sh r apply (must end `result=steady active_workflows=0 open_submissions=0`;
       otherwise run it once more; still not steady -> record, status fail), then
       bash scenarios/tools/steady-state.sh r plan
       gh api "repos/r/actions/workflows?per_page=100" --paginate --jq '.workflows[] | select(.path == ".github/workflows/steward-pr.yml" or .path == ".github/workflows/steward-issues.yml" or (.path | startswith(".github/workflows/scenario-"))) | (.path | ltrimstr(".github/workflows/")) + " " + .state'
    5. Append the three sections to each results file per context (each file gets ITS test-bed's outputs); prettier on the
       three files; then:
       bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S13 S14 S17
       bash scenarios/tools/results-check.sh scenarios/results/personal.md S13 S14 S15 S17
       bash scenarios/tools/results-check.sh scenarios/results/org-private.md S13 S14 S16 S17
    6. Report: the outputs of 3 and 4 verbatim.
- acceptance: |
    Run each from the tree root in Git Bash (read-only); each must give exactly the stated result.
    1. for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/audit.sh $r | tail -n 1; done | grep -c -E '^AUDIT repo=\S+ submissions=[1-9][0-9]* app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 result=clean$'
       -> prints exactly: 3
    2. pin=$(tr -d '\r' < scenarios/workflows/steward-pr.yml | grep -oE 'steward-screening\.yml@[0-9a-f]{40}' | cut -d@ -f2); for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/pins.sh $r | tail -n 1; done | grep -c -E "^PINS repo=\S+ pin=$pin result=pass\$"
       -> prints exactly: 3
    3. for r in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal steady-orchard/patch-steward-testbed-private; do bash scenarios/tools/steady-state.sh $r plan | tail -n 1; gh api "repos/$r/actions/workflows?per_page=100" --paginate --jq '.workflows[] | select(.path == ".github/workflows/steward-pr.yml" or .path == ".github/workflows/steward-issues.yml" or (.path | startswith(".github/workflows/scenario-"))) | (.path | ltrimstr(".github/workflows/")) + " " + .state' | grep -v -E '^scenario-secret-scope-called\.yml ' | grep -v -c ' disabled_manually$'; done
       -> prints exactly six lines: SCENARIO-STEADY steady-orchard/patch-steward-testbed-public result=planned active_workflows=0 open_submissions=0, 0, SCENARIO-STEADY jambolo/patch-steward-testbed-personal result=planned active_workflows=0 open_submissions=0, 0, SCENARIO-STEADY steady-orchard/patch-steward-testbed-private result=planned active_workflows=0 open_submissions=0, 0
    4. bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S13 S14 S17 | tail -n 1; bash scenarios/tools/results-check.sh scenarios/results/personal.md S13 S14 S15 S17 | tail -n 1; bash scenarios/tools/results-check.sh scenarios/results/org-private.md S13 S14 S16 S17 | tail -n 1
       -> prints exactly three lines: RESULTS-CHECK file=scenarios/results/org-public.md result=pass, RESULTS-CHECK file=scenarios/results/personal.md result=pass, RESULTS-CHECK file=scenarios/results/org-private.md result=pass
    5. for f in org-public personal org-private; do grep -c -E '^(## Steady state|AUDIT repo=\S+ submissions=[0-9]+ .*result=clean|PINS repo=\S+ pin=[0-9a-f]{40} result=pass|SCENARIO-STEADY \S+ result=steady active_workflows=0 open_submissions=0)' scenarios/results/$f.md; done
       -> prints exactly three lines, each: 4
- rollback: |
    git revert <this step's commit> (results sections only). To leave the steady state, re-enable workflows with
    `gh workflow enable <file> -R <repo>` (only if a later scenario must run).
