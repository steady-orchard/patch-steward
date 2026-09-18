#!/usr/bin/env bash
# Capability canaries for one test-bed: try to create each fixture kind through the API, print the
# verbatim API output, then remove what was created. The outcome is recorded, never assumed.
#
# Usage (from the root of this repository):
#   bash probes/smoke/tools/capabilities.sh <owner/repo> <prefix>
#     <prefix>  fixture name prefix: probe-canary (recorded runs) or probe-scratch (trial runs)
#
# Canaries:
#   environment             Environment <prefix>-env: deployment-branch policy only "master", one dummy secret
#   ruleset-required-check  ruleset <prefix>-required-check on refs/heads/<prefix>-*: required status check
#                           "<prefix>/check" bound to integration id 4993303 (the test App)
#   ruleset-merge-queue     ruleset <prefix>-merge-queue on exactly refs/heads/<prefix>-merge-queue: merge_queue
#                           rule (never a wildcard: GitHub answers HTTP 422 "Wildcard ref names are not
#                           supported when merge queue is enabled")
#
# Output: verbatim API output between "CANARY ..." lines, then one summary line per canary:
#   CAPABILITY <id> outcome=created|refused
# "created" means: created, read back with the expected setting, and removed again.
# Exit 0 when the script ran to the end (a refusal is a result, not an error). Exit 2: usage error.
set -uo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: capabilities.sh <owner/repo> <prefix>" >&2
  exit 2
fi

repo="$1"
prefix="$2"
tools="$(cd "$(dirname "$0")" && pwd)"
app_integration_id=4993303
payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT

echo "CANARY repo=$repo prefix=$prefix utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# --- environment -------------------------------------------------------------------------------
echo "CANARY begin=environment"
env_outcome=refused
if bash "$tools/environment.sh" "$repo" "$prefix-env" PROBE_CANARY_MARKER "$prefix-marker-v1"; then
  env_outcome=created
fi
if gh api "repos/$repo/environments/$prefix-env" --jq .name > /dev/null 2>&1; then
  gh api -X DELETE "repos/$repo/environments/$prefix-env" 2>&1
  if gh api "repos/$repo/environments/$prefix-env" --jq .name > /dev/null 2>&1; then
    echo "CANARY cleanup=environment name=$prefix-env result=STILL-PRESENT"
  else
    echo "CANARY cleanup=environment name=$prefix-env result=removed"
  fi
fi
echo "CANARY end=environment"

# --- rulesets ----------------------------------------------------------------------------------
# Remove every ruleset of this name (also a leftover of an interrupted run), so creation is the test.
remove_ruleset_named() {
  local name="$1"
  local ids
  local id
  ids="$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name == \"$name\") | .id" 2> /dev/null)" || return 0
  for id in $ids; do
    gh api -X DELETE "repos/$repo/rulesets/$id" 2>&1
    echo "CANARY cleanup=ruleset name=$name id=$id result=removed"
  done
}

# Create the ruleset described by the JSON file "$payload", read it back, remove it.
# $1 = ruleset name, $2 = text the compact read-back must contain. Prints verbatim API output.
ruleset_canary() {
  local name="$1"
  local expect="$2"
  local created
  local readback
  local id
  local rc=0
  remove_ruleset_named "$name"
  echo "CANARY call=create-ruleset name=$name"
  created="$(gh api -X POST "repos/$repo/rulesets" --input "$payload" --jq '{id, name, enforcement}' 2>&1)" || rc=$?
  printf '%s\n' "$created"
  echo "CANARY call=create-ruleset exit=$rc"
  if [ "$rc" -ne 0 ]; then return 1; fi
  id="$(printf '%s' "$created" | sed -E 's/.*"id":([0-9]+).*/\1/')"
  echo "CANARY call=read-ruleset id=$id"
  readback="$(gh api "repos/$repo/rulesets/$id" \
    --jq '{id, name, target, enforcement, include: .conditions.ref_name.include, rules: [.rules[] | {type, parameters}]}' 2>&1)" || rc=$?
  printf '%s\n' "$readback"
  echo "CANARY call=read-ruleset exit=$rc"
  remove_ruleset_named "$name"
  if [ "$rc" -ne 0 ]; then return 1; fi
  case "$readback" in
    *"$expect"*) return 0 ;;
  esac
  echo "CANARY readback-missing expected=$expect"
  return 1
}

echo "CANARY begin=ruleset-required-check"
cat > "$payload" << JSON
{
  "name": "$prefix-required-check",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/$prefix-*"], "exclude": [] } },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "$prefix/check", "integration_id": $app_integration_id }]
      }
    }
  ]
}
JSON
check_outcome=refused
if ruleset_canary "$prefix-required-check" "\"integration_id\":$app_integration_id"; then
  check_outcome=created
fi
echo "CANARY end=ruleset-required-check"

echo "CANARY begin=ruleset-merge-queue"
cat > "$payload" << JSON
{
  "name": "$prefix-merge-queue",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/$prefix-merge-queue"], "exclude": [] } },
  "rules": [
    {
      "type": "merge_queue",
      "parameters": {
        "check_response_timeout_minutes": 5,
        "grouping_strategy": "ALLGREEN",
        "max_entries_to_build": 5,
        "max_entries_to_merge": 5,
        "merge_method": "MERGE",
        "min_entries_to_merge": 1,
        "min_entries_to_merge_wait_minutes": 1
      }
    }
  ]
}
JSON
queue_outcome=refused
if ruleset_canary "$prefix-merge-queue" '"type":"merge_queue"'; then
  queue_outcome=created
fi
echo "CANARY end=ruleset-merge-queue"

echo "CAPABILITY environment outcome=$env_outcome"
echo "CAPABILITY ruleset-required-check outcome=$check_outcome"
echo "CAPABILITY ruleset-merge-queue outcome=$queue_outcome"
