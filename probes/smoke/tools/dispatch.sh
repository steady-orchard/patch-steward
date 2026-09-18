#!/usr/bin/env bash
# Dispatch a probe workflow, find the run it started, and wait for that run to complete.
#
# Usage:
#   bash probes/smoke/tools/dispatch.sh <owner/repo> <workflow-file> <ref> [<input>=<value> ...]
#
# Contract with the workflow: it declares a string input "nonce" and its run-name contains
# ${{ inputs.nonce }}. This script generates the nonce and finds the run by it, so concurrent
# dispatches of the same workflow never get mixed up.
#
# Bounds: polls no more often than every 20 seconds; refuses to start when fewer than 500 core API
# requests remain; waits at most PROBE_WAIT_SECONDS (default 540) for completion. When the wait ends
# first, continue with: bash probes/smoke/tools/wait-run.sh <owner/repo> <run-id>
#
# Output: "DISPATCH key=value ..." lines. Exit 0: the run completed (any conclusion - the caller
# judges it). Exit 1: dispatch failed or the run was not found. Exit 2: usage. Exit 3: still running.
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "usage: dispatch.sh <owner/repo> <workflow-file> <ref> [<input>=<value> ...]" >&2
  exit 2
fi

repo="$1"
workflow="$2"
ref="$3"
shift 3

wait_seconds="${PROBE_WAIT_SECONDS:-540}"
nonce="n$(date -u +%Y%m%dT%H%M%SZ)-$$-$RANDOM"
fields=(-f "nonce=$nonce")
for kv in "$@"; do
  fields+=(-f "$kv")
done

remaining="$(gh api rate_limit --jq .resources.core.remaining)"
if [ "$remaining" -lt 500 ]; then
  echo "DISPATCH error=rate-limit-low remaining=$remaining" >&2
  exit 1
fi

# A workflow pushed seconds ago may not be registered yet: retry the dispatch itself, bounded.
dispatched=no
for attempt in 1 2 3 4 5 6; do
  if message="$(gh workflow run "$workflow" -R "$repo" --ref "$ref" "${fields[@]}" 2>&1)"; then
    dispatched=yes
    echo "DISPATCH requested workflow=$workflow ref=$ref nonce=$nonce attempt=$attempt utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    break
  fi
  echo "DISPATCH request-failed attempt=$attempt message=$(echo "$message" | tr '\n' ' ')"
  sleep 20
done
if [ "$dispatched" != yes ]; then
  echo "DISPATCH error=dispatch-failed-after-6-attempts" >&2
  exit 1
fi

run_id=''
for attempt in 1 2 3 4 5 6 7 8 9; do
  sleep 20
  run_id="$(gh run list -R "$repo" --workflow "$workflow" --event workflow_dispatch --limit 30 --json databaseId,displayTitle \
    --jq "[.[] | select(.displayTitle | contains(\"$nonce\"))][0].databaseId // empty")"
  if [ -n "$run_id" ]; then break; fi
done
if [ -z "$run_id" ]; then
  echo "DISPATCH error=run-not-found nonce=$nonce" >&2
  exit 1
fi
echo "DISPATCH run_id=$run_id url=https://github.com/$repo/actions/runs/$run_id"

deadline=$(($(date +%s) + wait_seconds))
while :; do
  state="$(gh run view "$run_id" -R "$repo" --json status,conclusion --jq '.status + " " + (.conclusion // "")')"
  case "$state" in
    completed*) break ;;
  esac
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "DISPATCH waiting=timeout run_id=$run_id state=$state"
    exit 3
  fi
  sleep 20
done
echo "DISPATCH completed run_id=$run_id conclusion=${state#completed } utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
