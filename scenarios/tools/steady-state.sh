#!/usr/bin/env bash
# Put one test-bed into the scenario suite's steady state: disable the steward and scenario workflows and close open
# scenario submissions. Never deletes anything.
#
# Usage (from the repository root): bash scenarios/tools/steady-state.sh <owner/repo> plan|apply
#   plan   read-only: prints what apply would change
#   apply  disables every in-scope workflow not already disabled_manually, then closes every in-scope open issue or
#          pull request, sleeping 1 s between writes, then re-reads both sets
#
# In scope:
#   workflows    path is .github/workflows/steward-pr.yml, .github/workflows/steward-issues.yml, or starts with
#                .github/workflows/scenario-
#   submissions  open issues and open pull requests whose title starts with "[scenario S"
#
# Output lines:
#   SCENARIO-STEADY <repo> workflow <file> <state> keep|would-disable|disabled|FAILED <detail>|keep-called
#   SCENARIO-STEADY <repo> issue <n> would-close|closed|FAILED
#   SCENARIO-STEADY <repo> pr <n> would-close|closed|FAILED
#   SCENARIO-STEADY <repo> result=planned|steady|not-steady active_workflows=<n> open_submissions=<m>
# Exit: 0 plan printed, or apply left 0 active workflows and 0 open submissions; 1 apply left the repository not
# steady; 2 usage error; 3 a read failed (line "SCENARIO-STEADY <repo> result=read-failed what=<workflows or
# submissions>").
set -uo pipefail

if [ "$#" -ne 2 ] || { [ "$2" != plan ] && [ "$2" != apply ]; }; then
  echo "usage: steady-state.sh <owner/repo> plan|apply" >&2
  exit 2
fi
repo="$1"
mode="$2"

oneline() {
  printf '%s' "$1" | tr '\r\n' '  ' | cut -c1-300
}

read_workflows() {
  gh api "repos/$repo/actions/workflows?per_page=100" --paginate \
    --jq '.workflows[] | select(.path == ".github/workflows/steward-pr.yml" or .path == ".github/workflows/steward-issues.yml" or (.path | ltrimstr(".github/workflows/") | startswith("scenario-"))) | "\(.path | ltrimstr(".github/workflows/")) \(.state)"'
}

read_submissions() {
  gh issue list -R "$repo" --state open --limit 500 --json number,title \
    --jq '.[] | select(.title | startswith("[scenario S")) | "issue \(.number)"' || return 1
  gh pr list -R "$repo" --state open --limit 500 --json number,title \
    --jq '.[] | select(.title | startswith("[scenario S")) | "pr \(.number)"' || return 1
}

if ! wf="$(read_workflows)"; then
  echo "SCENARIO-STEADY $repo result=read-failed what=workflows"
  exit 3
fi
if ! sub="$(read_submissions)"; then
  echo "SCENARIO-STEADY $repo result=read-failed what=submissions"
  exit 3
fi

active=0
open=0

while read -r f s; do
  [ -n "$f" ] || continue
  if [ "$s" = disabled_manually ]; then
    echo "SCENARIO-STEADY $repo workflow $f $s keep"
    continue
  fi
  if [ "$mode" = plan ]; then
    if [ "$f" != scenario-secret-scope-called.yml ]; then
      active=$((active + 1))
    fi
    echo "SCENARIO-STEADY $repo workflow $f $s would-disable"
    continue
  fi
  if out="$(gh api -X PUT "repos/$repo/actions/workflows/$f/disable" 2>&1)"; then
    echo "SCENARIO-STEADY $repo workflow $f $s disabled"
  else
    if [ "$f" = scenario-secret-scope-called.yml ]; then
      echo "SCENARIO-STEADY $repo workflow $f $s keep-called"
    else
      active=$((active + 1))
      echo "SCENARIO-STEADY $repo workflow $f $s FAILED $(oneline "$out")"
    fi
  fi
  sleep 1
done <<< "$wf"

while read -r kind n; do
  [ -n "$kind" ] || continue
  open=$((open + 1))
  if [ "$mode" = plan ]; then
    echo "SCENARIO-STEADY $repo $kind $n would-close"
    continue
  fi
  if [ "$kind" = issue ]; then
    if gh issue close "$n" -R "$repo" > /dev/null 2>&1; then
      echo "SCENARIO-STEADY $repo issue $n closed"
    else
      echo "SCENARIO-STEADY $repo issue $n FAILED"
    fi
  else
    if gh pr close "$n" -R "$repo" > /dev/null 2>&1; then
      echo "SCENARIO-STEADY $repo pr $n closed"
    else
      echo "SCENARIO-STEADY $repo pr $n FAILED"
    fi
  fi
  sleep 1
done <<< "$sub"

if [ "$mode" = plan ]; then
  echo "SCENARIO-STEADY $repo result=planned active_workflows=$active open_submissions=$open"
  exit 0
fi

sleep 3
if ! wf="$(read_workflows)"; then
  echo "SCENARIO-STEADY $repo result=read-failed what=workflows"
  exit 3
fi
if ! sub="$(read_submissions)"; then
  echo "SCENARIO-STEADY $repo result=read-failed what=submissions"
  exit 3
fi
active="$(printf '%s\n' "$wf" | awk 'NF == 2 && $2 != "disabled_manually" && $1 != "scenario-secret-scope-called.yml"' | wc -l | tr -d ' ')"
open="$(printf '%s\n' "$sub" | awk 'NF > 0' | wc -l | tr -d ' ')"
if [ "$active" = 0 ] && [ "$open" = 0 ]; then
  echo "SCENARIO-STEADY $repo result=steady active_workflows=0 open_submissions=0"
  exit 0
fi
echo "SCENARIO-STEADY $repo result=not-steady active_workflows=$active open_submissions=$open"
exit 1
