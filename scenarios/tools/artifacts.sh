#!/usr/bin/env bash
# List artifacts matching a given name exactly, sorted by creation time.
#
# Usage:
#   bash scenarios/tools/artifacts.sh <owner/repo> <artifact name>
#
# The artifact name must match ^[A-Za-z0-9._-]{1,100}$. Reads artifacts by name (paginated) and keeps
# items whose name equals the argument exactly, printing them sorted by created_at ascending (then id):
#   ARTIFACT id=<id> name=<name> created_at=<created_at> expires_at=<expires_at> expired=<true|false> run_id=<workflow_run.id> size=<size_in_bytes>
# then a summary line:
#   ARTIFACTS repo=<owner/repo> name=<name> count=<n> unexpired=<k>
# Read-only: only GET requests.
#
# Exit codes: 0 success (count may be 0); 2 usage error (including a malformed name); 3 the artifact list read failed.
set -uo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: artifacts.sh <owner/repo> <artifact name>" >&2
  exit 2
fi

repo="$1"
name="$2"

case "$name" in
  '') echo "usage: artifacts.sh <owner/repo> <artifact name>" >&2; exit 2 ;;
esac
if ! printf '%s' "$name" | grep -q -E '^[A-Za-z0-9._-]{1,100}$'; then
  echo "usage: artifacts.sh <owner/repo> <artifact name>" >&2
  exit 2
fi

raw="$(gh api "repos/$repo/actions/artifacts?name=$name&per_page=100" --paginate \
  --jq ".artifacts[] | select(.name == \"$name\") | [(.id|tostring),.name,.created_at,.expires_at,(.expired|tostring),(.workflow_run.id|tostring),(.size_in_bytes|tostring)] | @tsv" 2>/dev/null)"
if [ $? -ne 0 ]; then
  echo "ARTIFACTS repo=$repo name=$name error=list-failed"
  exit 3
fi

count=0
unexpired=0
if [ -n "$raw" ]; then
  sorted="$(printf '%s\n' "$raw" | sort -t $'\t' -k3,3 -k1,1)"
  while IFS=$'\t' read -r id aname created_at expires_at expired run_id size; do
    [ -n "$id" ] || continue
    count=$((count + 1))
    if [ "$expired" = "false" ]; then
      unexpired=$((unexpired + 1))
    fi
    echo "ARTIFACT id=$id name=$aname created_at=$created_at expires_at=$expires_at expired=$expired run_id=$run_id size=$size"
  done <<< "$sorted"
fi

echo "ARTIFACTS repo=$repo name=$name count=$count unexpired=$unexpired"
exit 0
