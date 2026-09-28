#!/usr/bin/env bash
# List completed workflow runs whose display title starts with a given prefix, oldest first.
#
# Usage:
#   bash scenarios/tools/find-runs.sh <owner/repo> <workflow file name> <display title prefix>
#
# Reads runs of the named workflow (up to 100, most recent first from the API) and keeps those whose
# displayTitle starts with the given prefix (plain string prefix match, not a pattern). Prints them
# oldest first, one line per run:
#   RUN id=<databaseId> attempt=<attempt> event=<event> status=<status> conclusion=<conclusion or none> created_at=<createdAt> url=<url> title=<displayTitle>
# then a summary line:
#   RUNS repo=<owner/repo> workflow=<file> count=<n>
# Read-only: only GET requests.
#
# Exit codes: 0 success (count may be 0); 1 the run list read failed; 2 usage error.
set -uo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: find-runs.sh <owner/repo> <workflow file name> <display title prefix>" >&2
  exit 2
fi

repo="$1"
workflow="$2"
prefix="$3"

raw="$(gh run list -R "$repo" --workflow "$workflow" --limit 100 \
  --json databaseId,attempt,event,status,conclusion,createdAt,url,displayTitle \
  --jq '.[] | [(.databaseId|tostring),(.attempt|tostring),.event,.status,(.conclusion // "none"),.createdAt,.url,.displayTitle] | @tsv' 2>/dev/null)"
if [ $? -ne 0 ]; then
  echo "RUNS repo=$repo workflow=$workflow error=list-failed"
  exit 1
fi

lines=()
while IFS=$'\t' read -r id attempt event status conclusion created_at url title; do
  [ -n "$id" ] || continue
  case "$title" in
    "$prefix"*)
      lines+=("$id"$'\t'"$attempt"$'\t'"$event"$'\t'"$status"$'\t'"$conclusion"$'\t'"$created_at"$'\t'"$url"$'\t'"$title")
      ;;
  esac
done <<< "$raw"

count=0
if [ "${#lines[@]}" -gt 0 ]; then
  count="${#lines[@]}"
  printf '%s\n' "${lines[@]}" | sort -t $'\t' -k6,6 | while IFS=$'\t' read -r id attempt event status conclusion created_at url title; do
    echo "RUN id=$id attempt=$attempt event=$event status=$status conclusion=$conclusion created_at=$created_at url=$url title=$title"
  done
fi

echo "RUNS repo=$repo workflow=$workflow count=$count"
exit 0
