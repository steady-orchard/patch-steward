#!/usr/bin/env bash
# Deploy the pinned wrapper copies and a policy file to one test-bed's master branch, then verify byte identity.
#
# Usage (from the repository root):
#   bash scenarios/tools/deploy-steward.sh <org-public|personal|org-private> [<policy file>]
#     org-public    steady-orchard/patch-steward-testbed-public   default policy scenarios/fixtures/policies/orphan-branch.yml
#     personal      jambolo/patch-steward-testbed-personal        default policy scenarios/fixtures/policies/orphan-branch.yml
#     org-private   steady-orchard/patch-steward-testbed-private  default policy scenarios/fixtures/policies/repository-store.yml
#
# Behavior:
#   - validates, before any network call except the pin-reachability and rate-limit checks below, that both wrapper
#     copies and the policy file exist, and that both wrappers pin the same 40-hex commit on the same steward-screening.yml
#     reusable workflow (uses: pin and steward_ref: match, and match each other);
#   - confirms the pinned commit exists on github.com/steady-orchard/patch-steward;
#   - checks the GitHub API rate limit has at least 500 requests remaining;
#   - delegates the actual copy-and-verify to probes/smoke/tools/deploy.sh against the test-bed's master branch.
#
# Output: "SCENARIO-DEPLOY key=value ..." lines (plus DEPLOY lines from the delegated script).
# Exit 0: all three files identical on master. Exit 1: a check or the deploy failed. Exit 2: usage error.
set -uo pipefail

usage() {
  echo "usage: deploy-steward.sh <org-public|personal|org-private> [<policy file>]" >&2
  exit 2
}

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  usage
fi

key="$1"
case "$key" in
  org-public)
    repo="steady-orchard/patch-steward-testbed-public"
    default_policy="scenarios/fixtures/policies/orphan-branch.yml"
    ;;
  personal)
    repo="jambolo/patch-steward-testbed-personal"
    default_policy="scenarios/fixtures/policies/orphan-branch.yml"
    ;;
  org-private)
    repo="steady-orchard/patch-steward-testbed-private"
    default_policy="scenarios/fixtures/policies/repository-store.yml"
    ;;
  *)
    usage
    ;;
esac

policy="${2:-$default_policy}"

pr_wrapper="scenarios/workflows/steward-pr.yml"
issues_wrapper="scenarios/workflows/steward-issues.yml"

for f in "$pr_wrapper" "$issues_wrapper"; do
  if [ ! -f "$f" ]; then
    echo "SCENARIO-DEPLOY error=missing-wrapper file=$f"
    exit 1
  fi
done
if [ ! -f "$policy" ]; then
  echo "SCENARIO-DEPLOY error=missing-policy file=$policy"
  exit 1
fi

extract_pin() {
  local file="$1"
  tr -d '\r' < "$file" | grep -E 'steward-screening\.yml@[0-9a-f]{40}' | grep -oE '[0-9a-f]{40}'
}

extract_ref() {
  local file="$1"
  tr -d '\r' < "$file" | grep -E "steward_ref: '[0-9a-f]{40}'" | grep -oE '[0-9a-f]{40}'
}

pr_pin="$(extract_pin "$pr_wrapper")"
issues_pin="$(extract_pin "$issues_wrapper")"
pr_ref="$(extract_ref "$pr_wrapper")"
issues_ref="$(extract_ref "$issues_wrapper")"

pr_pin_count="$(printf '%s\n' "$pr_pin" | grep -c .)"
issues_pin_count="$(printf '%s\n' "$issues_pin" | grep -c .)"
pr_ref_count="$(printf '%s\n' "$pr_ref" | grep -c .)"
issues_ref_count="$(printf '%s\n' "$issues_ref" | grep -c .)"

if [ "$pr_pin_count" != 1 ] || [ "$issues_pin_count" != 1 ] || [ "$pr_ref_count" != 1 ] || [ "$issues_ref_count" != 1 ] \
  || [ "$pr_pin" != "$pr_ref" ] || [ "$issues_pin" != "$issues_ref" ] || [ "$pr_pin" != "$issues_pin" ]; then
  echo "SCENARIO-DEPLOY error=pin-mismatch"
  exit 1
fi

pin="$pr_pin"

remote_sha="$(gh api "repos/steady-orchard/patch-steward/commits/$pin" --jq .sha 2> /dev/null || true)"
if [ "$remote_sha" != "$pin" ]; then
  echo "SCENARIO-DEPLOY error=pin-unreachable pin=$pin"
  exit 1
fi

remaining="$(gh api rate_limit --jq .resources.core.remaining 2> /dev/null || echo 0)"
if [ "$remaining" -lt 500 ] 2> /dev/null; then
  echo "SCENARIO-DEPLOY error=rate-limit-low remaining=$remaining"
  exit 1
fi

if bash probes/smoke/tools/deploy.sh "$repo" master "scenario: deploy steward wrappers and policy" \
  "$pr_wrapper" "$issues_wrapper" "$policy:.github/patch-steward/policy.yml"; then
  echo "SCENARIO-DEPLOY repo=$repo pin=$pin policy=$policy result=ok"
  exit 0
else
  echo "SCENARIO-DEPLOY repo=$repo pin=$pin policy=$policy result=failed"
  exit 1
fi
