#!/usr/bin/env bash
# Wait (bounded) for new runs of a workflow whose display title starts with a given prefix.
#
# Usage:
#   bash scenarios/tools/await-runs.sh <owner/repo> <workflow file name> <display title prefix> <after run id> <min count>
#
# Checks the core rate limit first, then polls scenarios/tools/find-runs.sh (immediately, then every
# 20 seconds) until a deadline of PROBE_WAIT_SECONDS seconds (default 540) after start. On each poll,
# selects the RUN lines whose id is numerically greater than <after run id>, in find-runs order. Stops
# successfully once the selected count is at least <min count> and every selected run has
# status=completed, printing the selected RUN lines followed by a summary line:
#   AWAIT repo=<owner/repo> workflow=<workflow file name> after=<after run id> count=<count> completed=<completed> result=complete
# On deadline, prints the selected RUN lines followed by the same summary line with result=timeout.
# Read-only: only GET requests.
#
# Exit codes: 0 result=complete; 1 rate limit low or the run list read failed; 2 usage error; 3 result=timeout.
set -uo pipefail

usage() {
  echo "usage: await-runs.sh <owner/repo> <workflow file name> <display title prefix> <after run id> <min count>" >&2
  exit 2
}

if [ "$#" -ne 5 ]; then
  usage
fi

repo="$1"
workflow="$2"
prefix="$3"
after="$4"
min_count="$5"

[ -n "$prefix" ] || usage
[[ "$after" =~ ^[0-9]{1,20}$ ]] || usage
[[ "$min_count" =~ ^[1-9][0-9]{0,2}$ ]] || usage

remaining="$(gh api rate_limit --jq .resources.core.remaining 2>/dev/null)"
if ! [[ "$remaining" =~ ^[0-9]+$ ]] || [ "$remaining" -lt 500 ]; then
  echo "AWAIT repo=$repo workflow=$workflow error=rate-limit-low"
  exit 1
fi

deadline_seconds="${PROBE_WAIT_SECONDS:-540}"
start="$(date +%s)"
first=1

while :; do
  if [ "$first" -eq 0 ]; then
    sleep 20
  fi
  first=0

  raw="$(bash scenarios/tools/find-runs.sh "$repo" "$workflow" "$prefix")"
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "AWAIT repo=$repo workflow=$workflow error=list-failed"
    exit 1
  fi

  selected=()
  completed=0
  while IFS= read -r line; do
    case "$line" in
      RUN\ id=*)
        id="${line#RUN id=}"
        id="${id%% *}"
        if awk -v a="$id" -v b="$after" 'BEGIN{exit !(a>b)}'; then
          selected+=("$line")
          case "$line" in
            *" status=completed "*)
              completed=$((completed + 1))
              ;;
          esac
        fi
        ;;
    esac
  done <<< "$raw"

  count="${#selected[@]}"

  now="$(date +%s)"
  elapsed=$((now - start))

  if [ "$count" -ge "$min_count" ] && [ "$completed" -eq "$count" ]; then
    if [ "$count" -gt 0 ]; then
      printf '%s\n' "${selected[@]}"
    fi
    echo "AWAIT repo=$repo workflow=$workflow after=$after count=$count completed=$completed result=complete"
    exit 0
  fi

  if [ "$elapsed" -ge "$deadline_seconds" ]; then
    if [ "$count" -gt 0 ]; then
      printf '%s\n' "${selected[@]}"
    fi
    echo "AWAIT repo=$repo workflow=$workflow after=$after count=$count completed=$completed result=timeout"
    exit 3
  fi
done
