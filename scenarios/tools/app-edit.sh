#!/usr/bin/env bash
# Deploys and dispatches the scenario-app-edit helper workflow, which edits a scenario
# issue or pull request title, or closes it, using an installation token of the test App
# so the event's sender is the App's bot user, then checks the run's logs for the edit's
# HTTP status.
#
# Usage:
#   bash scenarios/tools/app-edit.sh <owner/repo> <issue or pr> <number> title <new title>
#   bash scenarios/tools/app-edit.sh <owner/repo> <issue or pr> <number> close
#
# Output: "APP-EDIT key=value ..." lines. Exit 0 pass, 1 fail, 2 usage error, 3 still running.
set -uo pipefail

usage() {
  echo "Usage: bash scenarios/tools/app-edit.sh <owner/repo> <issue or pr> <number> title <new title>" >&2
  echo "       bash scenarios/tools/app-edit.sh <owner/repo> <issue or pr> <number> close" >&2
}

if [ "$#" -lt 4 ]; then
  usage
  exit 2
fi

repo="$1"
kind="$2"
number="$3"
operation="$4"

if ! [[ "$repo" =~ ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$ ]]; then
  usage
  exit 2
fi

if [ "$kind" != "issue" ] && [ "$kind" != "pr" ]; then
  usage
  exit 2
fi

if ! [[ "$number" =~ ^[1-9][0-9]{0,9}$ ]]; then
  usage
  exit 2
fi

if [ "$operation" = "title" ]; then
  if [ "$#" -ne 5 ]; then
    usage
    exit 2
  fi
  title="$5"
  if [[ "$title" != "[scenario S"* ]]; then
    usage
    exit 2
  fi
  if [ "${#title}" -gt 200 ]; then
    usage
    exit 2
  fi
  printable=1
  for ((i = 0; i < ${#title}; i++)); do
    c=$(printf '%d' "'${title:$i:1}")
    if [ "$c" -lt 32 ] || [ "$c" -eq 127 ]; then
      printable=0
      break
    fi
  done
  if [ "$printable" -ne 1 ]; then
    usage
    exit 2
  fi
elif [ "$operation" = "close" ]; then
  if [ "$#" -ne 4 ]; then
    usage
    exit 2
  fi
else
  usage
  exit 2
fi

remaining=$(gh api rate_limit --jq .resources.core.remaining 2> /dev/null)
if ! [[ "$remaining" =~ ^[0-9]+$ ]] || [ "$remaining" -lt 500 ]; then
  echo "APP-EDIT error=rate-limit-low"
  exit 1
fi

if ! bash probes/smoke/tools/deploy.sh "$repo" master "scenario: deploy App edit helper" scenarios/workflows/scenario-app-edit.yml; then
  echo "APP-EDIT error=deploy-failed"
  exit 1
fi

if [ "$operation" = "title" ]; then
  dispatch_out=$(bash probes/smoke/tools/dispatch.sh "$repo" scenario-app-edit.yml master "kind=$kind" "number=$number" "operation=$operation" "title=$title")
else
  dispatch_out=$(bash probes/smoke/tools/dispatch.sh "$repo" scenario-app-edit.yml master "kind=$kind" "number=$number" "operation=$operation")
fi
dispatch_status=$?
echo "$dispatch_out"

run_id=$(printf '%s\n' "$dispatch_out" | grep -o 'DISPATCH run_id=[0-9]*' | head -n1 | cut -d= -f2)

if [ "$dispatch_status" -eq 3 ]; then
  echo "APP-EDIT repo=$repo run=$run_id result=still-running"
  exit 3
fi

if [ -z "$run_id" ] || [ "$dispatch_status" -ne 0 ]; then
  echo "APP-EDIT error=dispatch-failed"
  exit 1
fi

pass=0
while IFS= read -r line; do
  field=$(printf '%s' "$line" | cut -f3)
  remainder=$(node -e "const bom=String.fromCharCode(65279);let s=process.argv[1];if(s.startsWith(bom))s=s.slice(1);const i=s.indexOf(' ');console.log(i>=0?s.slice(i+1):'')" "$field")
  if [[ "$remainder" == "app-edit "* ]]; then
    echo "APP-EDIT log=$remainder"
    if [ "$remainder" = "app-edit $operation status=200" ]; then
      pass=1
    fi
  fi
done < <(gh run view "$run_id" -R "$repo" --log)

if [ "$pass" -eq 1 ]; then
  echo "APP-EDIT repo=$repo kind=$kind number=$number operation=$operation run=$run_id url=https://github.com/$repo/actions/runs/$run_id result=ok"
  exit 0
else
  echo "APP-EDIT repo=$repo kind=$kind number=$number operation=$operation run=$run_id url=https://github.com/$repo/actions/runs/$run_id result=failed"
  exit 1
fi
