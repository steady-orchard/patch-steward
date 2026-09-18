#!/usr/bin/env bash
# Create or reuse a GitHub Environment whose deployment-branch policy allows only master, and set
# one Environment secret to a DUMMY marker value. Never pass a real credential to this script.
#
# Usage:
#   bash probes/smoke/tools/environment.sh <owner/repo> <environment> <secret-name> <dummy-secret-value>
#
# Output: "ENVIRONMENT key=value ..." lines plus the verbatim API output of every call.
# Exit 0: the Environment is ready (policy custom, only branch "master", secret present).
# Exit 10: the platform refused a call; the refusal is printed verbatim ("ENVIRONMENT refused step=...").
# Exit 2: usage error.
set -uo pipefail

if [ "$#" -ne 4 ]; then
  echo "usage: environment.sh <owner/repo> <environment> <secret-name> <dummy-secret-value>" >&2
  exit 2
fi

repo="$1"
environment="$2"
secret_name="$3"
secret_value="$4"

# Run one gh call, print the call and its verbatim output, return gh's exit status.
call() {
  local label="$1"
  shift
  echo "ENVIRONMENT call=$label"
  local output
  local rc=0
  output="$("$@" 2>&1)" || rc=$?
  printf '%s\n' "$output"
  echo "ENVIRONMENT call=$label exit=$rc"
  return "$rc"
}

refuse() {
  echo "ENVIRONMENT refused step=$1 repo=$repo environment=$environment"
  exit 10
}

if gh api "repos/$repo/environments/$environment" --jq .name > /dev/null 2>&1; then
  echo "ENVIRONMENT repo=$repo environment=$environment existed=yes"
else
  echo "ENVIRONMENT repo=$repo environment=$environment existed=no"
fi

call create gh api -X PUT "repos/$repo/environments/$environment" --input - \
  --jq '{name, deployment_branch_policy}' << 'JSON' || refuse create
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON

policies="$(gh api "repos/$repo/environments/$environment/deployment-branch-policies" --jq '[.branch_policies[].name] | join(",")' 2>&1)" || {
  printf '%s\n' "$policies"
  refuse list-branch-policies
}
if [ "$policies" != "master" ]; then
  call add-branch-policy gh api -X POST "repos/$repo/environments/$environment/deployment-branch-policies" \
    -f name=master -f type=branch --jq '{id, name, type}' || refuse add-branch-policy
fi

call set-secret gh secret set "$secret_name" --env "$environment" -R "$repo" --body "$secret_value" || refuse set-secret

call read-environment gh api "repos/$repo/environments/$environment" --jq '{name, deployment_branch_policy}' || refuse read-environment
call read-branch-policies gh api "repos/$repo/environments/$environment/deployment-branch-policies" \
  --jq '[.branch_policies[] | {name, type}]' || refuse read-branch-policies
call read-secrets gh api "repos/$repo/environments/$environment/secrets" --jq '[.secrets[].name]' || refuse read-secrets

echo "ENVIRONMENT result=ready repo=$repo environment=$environment branch_policy=master secret=$secret_name"
