#!/usr/bin/env bash
# Put one test-bed into the probe suite's steady state: every .github/workflows/probe-*.yml workflow disabled (state
# disabled_manually) and every probe-pa0N-head-* branch deleted. Nothing else is touched: master, probe-pa0N-base*
# branches, Environments, rulesets, labels, issues, PRs, artifacts, and repository settings stay as they are.
#
# Usage (from the repository root): bash probes/smoke/tools/steady-state.sh <owner/repo> plan|apply
#   plan   read-only: prints what apply would change
#   apply  disables each workflow that is not disabled_manually (PUT repos/<r>/actions/workflows/<file>/disable),
#          deletes each probe-pa0N-head-* branch (DELETE repos/<r>/git/refs/heads/<branch>), then re-reads the state
#
# Output lines:
#   STEADY <repo> workflow <file> <state> keep|would-disable|disabled|FAILED <detail>
#   STEADY <repo> branch <name> would-delete|deleted|FAILED <detail>
#   STEADY <repo> result=planned|steady|not-steady active_workflows=<n> head_branches=<n>
# Exit: 0 plan printed, or apply left the repository steady; 1 apply left it not steady; 2 usage; 3 a read failed.
set -uo pipefail

if [ "$#" -ne 2 ] || { [ "$2" != plan ] && [ "$2" != apply ]; }; then
  echo "usage: steady-state.sh <owner/repo> plan|apply" >&2
  exit 2
fi
repo="$1"
mode="$2"

read_workflows() {
  gh api "repos/$repo/actions/workflows?per_page=100" --paginate \
    --jq '.workflows[] | select(.path | startswith(".github/workflows/probe-")) | "\(.path | ltrimstr(".github/workflows/")) \(.state)"'
}

read_head_branches() {
  gh api "repos/$repo/branches?per_page=100" --paginate --jq '.[].name' | awk '/^probe-pa0[1-9]-head-/'
}

oneline() {
  printf '%s' "$1" | tr '\r\n' '  ' | cut -c1-300
}

if ! wf="$(read_workflows)"; then
  echo "STEADY $repo result=read-failed what=workflows"
  exit 3
fi
if ! hb="$(read_head_branches)"; then
  echo "STEADY $repo result=read-failed what=branches"
  exit 3
fi

active=0
heads=0
while read -r f s; do
  [ -n "$f" ] || continue
  if [ "$s" = disabled_manually ]; then
    echo "STEADY $repo workflow $f $s keep"
    continue
  fi
  active=$((active + 1))
  if [ "$mode" = plan ]; then
    echo "STEADY $repo workflow $f $s would-disable"
    continue
  fi
  if out="$(gh api -X PUT "repos/$repo/actions/workflows/$f/disable" 2>&1)"; then
    echo "STEADY $repo workflow $f $s disabled"
  else
    echo "STEADY $repo workflow $f $s FAILED $(oneline "$out")"
  fi
  sleep 1
done <<< "$wf"

while read -r b; do
  [ -n "$b" ] || continue
  heads=$((heads + 1))
  if [ "$mode" = plan ]; then
    echo "STEADY $repo branch $b would-delete"
    continue
  fi
  if out="$(gh api -X DELETE "repos/$repo/git/refs/heads/$b" 2>&1)"; then
    echo "STEADY $repo branch $b deleted"
  else
    echo "STEADY $repo branch $b FAILED $(oneline "$out")"
  fi
  sleep 1
done <<< "$hb"

if [ "$mode" = plan ]; then
  echo "STEADY $repo result=planned active_workflows=$active head_branches=$heads"
  exit 0
fi

sleep 3
if ! wf="$(read_workflows)"; then
  echo "STEADY $repo result=read-failed what=workflows-after"
  exit 3
fi
if ! hb="$(read_head_branches)"; then
  echo "STEADY $repo result=read-failed what=branches-after"
  exit 3
fi
active="$(printf '%s\n' "$wf" | awk 'NF == 2 && $2 != "disabled_manually"' | wc -l | tr -d ' ')"
heads="$(printf '%s\n' "$hb" | awk 'NF > 0' | wc -l | tr -d ' ')"
if [ "$active" = 0 ] && [ "$heads" = 0 ]; then
  echo "STEADY $repo result=steady active_workflows=0 head_branches=0"
  exit 0
fi
echo "STEADY $repo result=not-steady active_workflows=$active head_branches=$heads"
exit 1
