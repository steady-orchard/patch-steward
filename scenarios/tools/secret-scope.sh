#!/usr/bin/env bash
# Verify that the steward's two App secrets reach only jobs declaring the Environment
# steward-publication, by reproducing the product's secret path (the wrapper templates'
# secrets: mapping into the reusable screening workflow's secrets: declaration) in a
# disposable caller/called workflow pair, then optionally deploying and dispatching it.
#
# Usage:
#   bash scenarios/tools/secret-scope.sh check
#   bash scenarios/tools/secret-scope.sh run <owner/repo>
#
# check (local, no network): compares, byte for byte, the secrets: block of
#   scenarios/workflows/scenario-secret-scope.yml against templates/workflows/steward-pr.yml
#   (the mapping), and the secrets: block of scenarios/workflows/scenario-secret-scope-called.yml
#   against .github/workflows/steward-screening.yml (the declarations). Exit 0 only when both
#   blocks are identical.
#
# run <owner/repo>: runs the check above, then deploys the scenario pair to the test-bed's
#   master branch, dispatches it, and inspects the run's logs for the printed length-zero
#   markers, never a secret value, length, or digest.
#
# Output: "SECRET-SCOPE key=value ..." lines. Exit 0 pass, 1 fail, 2 usage error.
set -euo pipefail

block() {
  tr -d '\r' < "$1" | awk 'f==0 && $0=="    secrets:" {f=1; print; next} f==1 { if (substr($0,1,6)=="      ") print; else exit }'
}

do_check() {
  for f in scenarios/workflows/scenario-secret-scope.yml templates/workflows/steward-pr.yml \
    scenarios/workflows/scenario-secret-scope-called.yml .github/workflows/steward-screening.yml; do
    if [ ! -f "$f" ]; then
      echo "SECRET-SCOPE error=missing-file file=$f"
      return 1
    fi
  done

  status=0

  if [ "$(block scenarios/workflows/scenario-secret-scope.yml)" = "$(block templates/workflows/steward-pr.yml)" ]; then
    echo "SECRET-SCOPE check=mapping identical"
  else
    echo "SECRET-SCOPE check=mapping different"
    status=1
  fi

  if [ "$(block scenarios/workflows/scenario-secret-scope-called.yml)" = "$(block .github/workflows/steward-screening.yml)" ]; then
    echo "SECRET-SCOPE check=declarations identical"
  else
    echo "SECRET-SCOPE check=declarations different"
    status=1
  fi

  return "$status"
}

do_run() {
  repo="$1"

  if ! do_check; then
    exit 1
  fi

  remaining="$(gh api rate_limit --jq .resources.core.remaining)"
  if [ "$remaining" -lt 500 ]; then
    echo "SECRET-SCOPE error=rate-limit-low"
    exit 1
  fi

  if ! bash probes/smoke/tools/deploy.sh "$repo" master "scenario: deploy secret-scope pair" \
    scenarios/workflows/scenario-secret-scope.yml scenarios/workflows/scenario-secret-scope-called.yml; then
    echo "SECRET-SCOPE error=deploy-failed"
    exit 1
  fi

  dispatch_out="$(PROBE_WAIT_SECONDS=900 bash probes/smoke/tools/dispatch.sh "$repo" scenario-secret-scope.yml master)"
  run_id="$(printf '%s\n' "$dispatch_out" | sed -n 's/^DISPATCH run_id=\([0-9]*\).*/\1/p' | head -n1)"
  if [ -z "$run_id" ]; then
    echo "SECRET-SCOPE error=dispatch-failed"
    exit 1
  fi

  log="$(gh run view "$run_id" -R "$repo" --log)"

  outside_id=""
  outside_key=""
  inside_id=""
  inside_key=""
  begin_count=0

  while IFS=$'\t' read -r job_col step_col text_col; do
    case "$text_col" in
      *'-----BEGIN'*) begin_count=$((begin_count + 1)) ;;
    esac
    case "$text_col" in
      *'length-zero='*)
        job=""
        case "$job_col" in
          *'/ outside') job="outside" ;;
          *'/ inside') job="inside" ;;
        esac
        after_ts="$(printf '%s\n' "$text_col" | sed -E 's/^[^ ]+ //')"
        if [ -n "$job" ]; then
          echo "SECRET-SCOPE job=$job line=$after_ts"
          case "$job:$after_ts" in
            'outside:PATCH_STEWARD_APP_ID length-zero=true') outside_id=true ;;
            'outside:PATCH_STEWARD_APP_ID length-zero=false') outside_id=false ;;
            'outside:PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true') outside_key=true ;;
            'outside:PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false') outside_key=false ;;
            'inside:PATCH_STEWARD_APP_ID length-zero=true') inside_id=true ;;
            'inside:PATCH_STEWARD_APP_ID length-zero=false') inside_id=false ;;
            'inside:PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true') inside_key=true ;;
            'inside:PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false') inside_key=false ;;
          esac
        fi
        ;;
    esac
  done <<< "$log"

  if [ "$outside_id" = true ] && [ "$outside_key" = true ] && [ "$inside_id" = false ] && [ "$inside_key" = false ] \
    && [ "$begin_count" -eq 0 ]; then
    echo "SECRET-SCOPE repo=$repo run=$run_id url=https://github.com/$repo/actions/runs/$run_id result=pass"
    exit 0
  else
    echo "SECRET-SCOPE repo=$repo run=$run_id url=https://github.com/$repo/actions/runs/$run_id result=fail"
    exit 1
  fi
}

case "${1:-}" in
  check)
    if [ "$#" -ne 1 ]; then
      echo "usage: secret-scope.sh check|run <owner/repo>" >&2
      exit 2
    fi
    if do_check; then
      exit 0
    else
      exit 1
    fi
    ;;
  run)
    if [ "$#" -ne 2 ]; then
      echo "usage: secret-scope.sh check|run <owner/repo>" >&2
      exit 2
    fi
    do_run "$2"
    ;;
  *)
    echo "usage: secret-scope.sh check|run <owner/repo>" >&2
    exit 2
    ;;
esac
