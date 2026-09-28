#!/usr/bin/env bash
# Read-only check of a test-bed's publication Environment and secret scope. Makes no write of any kind.
#
# Usage: bash scenarios/tools/environment-check.sh <owner/repo>
#
# Behavior: runs four read-only gh invocations against <owner/repo> and compares each output literally against its
# expectation (organization-secrets is skipped unless the owner is steady-orchard). Prints secret NAMES only, never values.
#
# Output: one "ENVIRONMENT repo=<r> check=<name> expected=<e> actual=<a> ok|MISMATCH" line per check, then a final
# "ENVIRONMENT repo=<r> result=ok|incomplete" line.
# Exit 0: every check ok. Exit 1: at least one mismatch. Exit 2: usage error.
set -uo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: environment-check.sh <owner/repo>" >&2
  exit 2
fi

repo="$1"
owner="${repo%%/*}"

status=0

check() {
  local name="$1" expected="$2" out rc actual
  shift 2
  out="$("$@" 2>&1)"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    actual="$(printf '%s\n' "$out" | head -n1)"
  else
    actual="error:$(printf '%s\n' "$out" | head -n1)"
  fi
  if [ "$actual" = "$expected" ]; then
    echo "ENVIRONMENT repo=$repo check=$name expected=$expected actual=$actual ok"
  else
    echo "ENVIRONMENT repo=$repo check=$name expected=$expected actual=$actual MISMATCH"
    status=1
  fi
}

check environment-secrets '["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"]' \
  gh api "repos/$repo/environments/steward-publication/secrets" --jq '[.secrets[].name] | sort'

check deployment-branches '["master"]' \
  gh api "repos/$repo/environments/steward-publication/deployment-branch-policies" --jq '[.branch_policies[].name]'

check repository-secrets '[]' \
  gh api "repos/$repo/actions/secrets" --jq '[.secrets[].name | select(startswith("PATCH_STEWARD_"))]'

if [ "$owner" = "steady-orchard" ]; then
  check organization-secrets '[]' \
    gh api "repos/$repo/actions/organization-secrets" --jq '[.secrets[].name | select(startswith("PATCH_STEWARD_"))]'
fi

if [ "$status" -eq 0 ]; then
  echo "ENVIRONMENT repo=$repo result=ok"
  exit 0
else
  echo "ENVIRONMENT repo=$repo result=incomplete"
  exit 1
fi
