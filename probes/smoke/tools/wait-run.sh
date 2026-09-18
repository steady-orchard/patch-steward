#!/usr/bin/env bash
# Wait, bounded, for a workflow run to complete.
#
# Usage:
#   bash probes/smoke/tools/wait-run.sh <owner/repo> <run-id>
#
# Bounds: polls every 20 seconds; refuses to start when fewer than 500 core API requests remain;
# waits at most PROBE_WAIT_SECONDS (default 540). Call it again to keep waiting, up to the limit the
# probe procedure sets (15 minutes for an ordinary run).
#
# Output: "WAIT key=value ..." lines. Exit 0: completed (any conclusion). Exit 2: usage. Exit 3: still running.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: wait-run.sh <owner/repo> <run-id>" >&2
  exit 2
fi

repo="$1"
run_id="$2"
wait_seconds="${PROBE_WAIT_SECONDS:-540}"

remaining="$(gh api rate_limit --jq .resources.core.remaining)"
if [ "$remaining" -lt 500 ]; then
  echo "WAIT error=rate-limit-low remaining=$remaining" >&2
  exit 1
fi

deadline=$(($(date +%s) + wait_seconds))
while :; do
  state="$(gh run view "$run_id" -R "$repo" --json status,conclusion --jq '.status + " " + (.conclusion // "")')"
  case "$state" in
    completed*) break ;;
  esac
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "WAIT waiting=timeout run_id=$run_id state=$state"
    exit 3
  fi
  sleep 20
done
echo "WAIT completed run_id=$run_id conclusion=${state#completed } utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
