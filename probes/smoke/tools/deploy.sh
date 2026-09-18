#!/usr/bin/env bash
# Deploy canonical probe files to a branch of a test-bed over SSH, then verify byte identity.
#
# Usage (from the root of this repository, relative paths only):
#   bash probes/smoke/tools/deploy.sh <owner/repo> <branch> <commit-message> <src>[:<dest>] [<src>[:<dest>] ...]
#     <src>   file in this repository
#     <dest>  path in the test-bed; default: .github/workflows/<basename of src>
#
# Behavior:
#   - clones the test-bed over SSH into a temporary directory outside this repository and removes it at exit;
#   - creates <branch> from master when it does not exist yet; never force-pushes; never rewrites history;
#   - makes at most one commit; makes none when every file is already identical on the branch (idempotent);
#   - retries a rejected push at most 5 times (fetch, rebase, push), because other steps deploy concurrently;
#   - verifies every file by git blob id: `git hash-object <src>` against the contents API of the test-bed.
#
# Output: "DEPLOY key=value ..." lines. Exit 0 only when every file is identical on the test-bed branch.
# Exit 1: push or identity failure. Exit 2: usage error.
set -euo pipefail

if [ "$#" -lt 4 ]; then
  echo "usage: deploy.sh <owner/repo> <branch> <commit-message> <src>[:<dest>] [<src>[:<dest>] ...]" >&2
  exit 2
fi

repo="$1"
branch="$2"
message="$3"
shift 3

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

clone="$work/clone"
# PROBE_REMOTE_BASE exists only to test this script offline against a directory of local bare
# repositories (clone URL = $PROBE_REMOTE_BASE<owner/repo>.git). Leave it unset for real deployments.
remote_base="${PROBE_REMOTE_BASE:-git@github.com:}"
git clone --quiet "$remote_base$repo.git" "$clone"

if git -C "$clone" rev-parse --verify --quiet "refs/remotes/origin/$branch" > /dev/null; then
  git -C "$clone" checkout --quiet -B "$branch" "origin/$branch"
  existed=yes
else
  git -C "$clone" checkout --quiet -b "$branch" origin/master
  existed=no
fi
echo "DEPLOY repo=$repo branch=$branch existed=$existed"

for spec in "$@"; do
  src="${spec%%:*}"
  if [ "$spec" = "$src" ]; then
    dest=".github/workflows/$(basename "$src")"
  else
    dest="${spec#*:}"
  fi
  if [ ! -f "$src" ]; then
    echo "DEPLOY error=missing-source src=$src" >&2
    exit 2
  fi
  mkdir -p "$clone/$(dirname "$dest")"
  cp "$src" "$clone/$dest"
  git -C "$clone" add -- "$dest"
done

if git -C "$clone" diff --cached --quiet; then
  echo "DEPLOY commit=none reason=already-identical"
  changed=no
else
  git -C "$clone" commit --quiet -m "$message"
  echo "DEPLOY commit=$(git -C "$clone" rev-parse HEAD) message=$message"
  changed=yes
fi

if [ "$changed" = yes ] || [ "$existed" = no ]; then
  pushed=no
  for attempt in 1 2 3 4 5; do
    if git -C "$clone" push --quiet origin "HEAD:refs/heads/$branch"; then
      pushed=yes
      echo "DEPLOY push=ok attempt=$attempt head=$(git -C "$clone" rev-parse HEAD)"
      break
    fi
    echo "DEPLOY push=rejected attempt=$attempt"
    sleep $((attempt * 3))
    git -C "$clone" fetch --quiet origin "$branch"
    if ! git -C "$clone" rebase --quiet "origin/$branch"; then
      git -C "$clone" rebase --abort || true
      echo "DEPLOY error=rebase-conflict" >&2
      exit 1
    fi
  done
  if [ "$pushed" != yes ]; then
    echo "DEPLOY error=push-failed-after-5-attempts" >&2
    exit 1
  fi
else
  echo "DEPLOY push=none reason=nothing-to-push"
fi

status=0
for spec in "$@"; do
  src="${spec%%:*}"
  if [ "$spec" = "$src" ]; then
    dest=".github/workflows/$(basename "$src")"
  else
    dest="${spec#*:}"
  fi
  local_blob="$(git hash-object -- "$src")"
  remote_blob=''
  if [ -n "${PROBE_REMOTE_BASE:-}" ]; then
    # offline test: no contents API; read the blob id from the freshly fetched branch instead
    git -C "$clone" fetch --quiet origin "$branch"
    remote_blob="$(git -C "$clone" rev-parse "FETCH_HEAD:$dest" 2> /dev/null || true)"
  else
    for attempt in 1 2 3 4; do
      remote_blob="$(gh api "repos/$repo/contents/$dest?ref=$branch" --jq .sha 2> /dev/null || true)"
      if [ "$remote_blob" = "$local_blob" ]; then break; fi
      sleep 5
    done
  fi
  if [ "$remote_blob" = "$local_blob" ]; then
    echo "DEPLOY identical dest=$dest blob=$local_blob"
  else
    echo "DEPLOY MISMATCH dest=$dest local=$local_blob remote=$remote_blob"
    status=1
  fi
done
exit "$status"
