#!/usr/bin/env bash
# Read-only static check of a test-bed's deployed wrapper workflows and the pinned reusable
# screening workflow.
#
# Usage:
#   bash scenarios/tools/pins.sh <owner/repo>
#
# Behavior:
#   - fetches raw bytes and blob ids of <owner/repo>'s master .github/workflows/steward-pr.yml and
#     steward-issues.yml, compares blob ids to this repository's scenarios/workflows copies;
#   - extracts the pinned reusable-workflow commit (PIN) from the deployed steward-pr.yml, fetches
#     that commit's .github/workflows/steward-screening.yml from steady-orchard/patch-steward, and
#     checks it is reachable ahead of or identical to this branch;
#   - statically checks job structure (environment gating, secret usage), the secrets mapping in
#     each wrapper, absence of literal probe secret names, and that every `uses:` reference across
#     the three files is pinned to a 40-hex sha that resolves on GitHub;
#   - read-only: no writes, no checkout, no clone.
#
# Environment gating (check 4, environment-jobs) requires exactly the jobs gate and publish to
# declare the Environment steward-publication as the job-level mapping form
#   environment:
#     name: steward-publication
#     deployment: false
# and requires no job (in either wrapper or the reusable workflow) to declare an Environment in any
# other form (the plain string form `environment: steward-publication` makes GitHub Actions record a
# Deployment on pull request heads).
#
# PINS_SCREENING_FILE=<path>: when set, reads the reusable screening workflow text from that local
# file (CR-stripped) instead of fetching it at the pin; a missing file is a read failure. All other
# checks are unchanged, and the final result line carries " screening=local" before " result=".
#
# Output: "PINS repo=<r> check=<name> ok|FAIL [<detail>]" lines, then a final
#   "PINS repo=<r> pin=<PIN> [screening=local ]result=pass|fail" line.
# Exit 0: result=pass. Exit 1: result=fail. Exit 2: usage error. Exit 3: a required read failed.
set -uo pipefail

usage() {
  echo "usage: pins.sh <owner/repo>" >&2
  exit 2
}

if [ "$#" -ne 1 ]; then usage; fi
repo="$1"
if ! [[ "$repo" =~ ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$ ]]; then
  usage
fi

fail_read() {
  echo "PINS repo=$repo error=read-failed what=$1"
  exit 3
}

strip_cr() { tr -d '\r'; }

raw_pr="$(gh api -H 'Accept: application/vnd.github.raw+json' "repos/$repo/contents/.github/workflows/steward-pr.yml?ref=master" 2> /dev/null)"
rc=$?
[ "$rc" -eq 0 ] && [ -n "$raw_pr" ] || fail_read "steward-pr.yml"
raw_pr="$(printf '%s' "$raw_pr" | strip_cr)"

blob_pr="$(gh api "repos/$repo/contents/.github/workflows/steward-pr.yml?ref=master" --jq .sha 2> /dev/null)"
rc=$?
[ "$rc" -eq 0 ] && [ -n "$blob_pr" ] || fail_read "steward-pr.yml"

raw_issues="$(gh api -H 'Accept: application/vnd.github.raw+json' "repos/$repo/contents/.github/workflows/steward-issues.yml?ref=master" 2> /dev/null)"
rc=$?
[ "$rc" -eq 0 ] && [ -n "$raw_issues" ] || fail_read "steward-issues.yml"
raw_issues="$(printf '%s' "$raw_issues" | strip_cr)"

blob_issues="$(gh api "repos/$repo/contents/.github/workflows/steward-issues.yml?ref=master" --jq .sha 2> /dev/null)"
rc=$?
[ "$rc" -eq 0 ] && [ -n "$blob_issues" ] || fail_read "steward-issues.yml"

local_blob_pr="$(git rev-parse HEAD:scenarios/workflows/steward-pr.yml 2> /dev/null)"
[ -n "$local_blob_pr" ] || fail_read "local"
local_blob_issues="$(git rev-parse HEAD:scenarios/workflows/steward-issues.yml 2> /dev/null)"
[ -n "$local_blob_issues" ] || fail_read "local"

pin="$(printf '%s\n' "$raw_pr" | grep -oE 'steward-screening\.yml@[0-9a-f]{40}' | head -n1 | cut -d@ -f2)"
[ -n "$pin" ] || fail_read "pin"

screening_source=pinned
if [ -n "${PINS_SCREENING_FILE:-}" ]; then
  [ -f "$PINS_SCREENING_FILE" ] || fail_read "screening-file"
  raw_screening="$(strip_cr < "$PINS_SCREENING_FILE")"
  screening_source=local
else
  raw_screening="$(gh api -H 'Accept: application/vnd.github.raw+json' "repos/steady-orchard/patch-steward/contents/.github/workflows/steward-screening.yml?ref=$pin" 2> /dev/null)"
  rc=$?
  [ "$rc" -eq 0 ] && [ -n "$raw_screening" ] || fail_read "screening"
  raw_screening="$(printf '%s' "$raw_screening" | strip_cr)"
fi

compare_status="$(gh api "repos/steady-orchard/patch-steward/compare/$pin...milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish" --jq .status 2> /dev/null)"
rc=$?
[ "$rc" -eq 0 ] && [ -n "$compare_status" ] || fail_read "compare"

# f. every distinct `<owner>/<repo>[/<path>]@<40 hex>` value of a `uses:` line across the three
# files must resolve on GitHub (unresolved is a check-8 failure, not a read failure).
all_text="$raw_pr
$raw_issues
$raw_screening"

uses_values="$(printf '%s\n' "$all_text" | grep -E '^[[:space:]]*(-[[:space:]]+)?uses:[[:space:]]' \
  | sed -E 's/^[[:space:]]*(-[[:space:]]+)?uses:[[:space:]]*//' | awk '{print $1}')"
uses_count="$(printf '%s\n' "$uses_values" | grep -c . || true)"

uses_all_valid=yes
while IFS= read -r v; do
  [ -n "$v" ] || continue
  if ! [[ "$v" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+@[0-9a-f]{40}$ ]]; then
    uses_all_valid=no
  fi
done <<< "$uses_values"

resolve_ok=yes
if [ "$uses_all_valid" = yes ]; then
  distinct_values="$(printf '%s\n' "$uses_values" | sort -u)"
  while IFS= read -r v; do
    [ -n "$v" ] || continue
    owner_repo="${v%@*}"
    sha="${v##*@}"
    owner="${owner_repo%%/*}"
    rest="${owner_repo#*/}"
    repo2="${rest%%/*}"
    resolved="$(gh api "repos/$owner/$repo2/commits/$sha" --jq .sha 2> /dev/null)"
    if [ "$resolved" != "$sha" ]; then
      resolve_ok=no
    fi
  done <<< "$distinct_values"
fi
uses_pinned_ok=yes
if [ "$uses_all_valid" != yes ] || [ "$resolve_ok" != yes ]; then
  uses_pinned_ok=no
fi

print_check() {
  local name="$1" ok="$2" detail="${3:-}"
  local status
  if [ "$ok" = yes ]; then status=ok; else status=FAIL; fi
  if [ -n "$detail" ]; then
    echo "PINS repo=$repo check=$name $status $detail"
  else
    echo "PINS repo=$repo check=$name $status"
  fi
}

overall=yes

# 1. wrapper-blobs
if [ "$blob_pr" = "$local_blob_pr" ] && [ "$blob_issues" = "$local_blob_issues" ]; then
  c1=yes
else
  c1=no
fi
print_check wrapper-blobs "$c1"
[ "$c1" = yes ] || overall=no

# 2. pin-equal
pr_use_matches="$(printf '%s\n' "$raw_pr" | grep -oE 'steward-screening\.yml@[0-9a-f]{40}')"
pr_use_count="$(printf '%s\n' "$pr_use_matches" | grep -c . || true)"
pr_ref_matches="$(printf '%s\n' "$raw_pr" | grep -oE "steward_ref: '[0-9a-f]{40}'")"
pr_ref_count="$(printf '%s\n' "$pr_ref_matches" | grep -c . || true)"
issues_use_matches="$(printf '%s\n' "$raw_issues" | grep -oE 'steward-screening\.yml@[0-9a-f]{40}')"
issues_use_count="$(printf '%s\n' "$issues_use_matches" | grep -c . || true)"
issues_ref_matches="$(printf '%s\n' "$raw_issues" | grep -oE "steward_ref: '[0-9a-f]{40}'")"
issues_ref_count="$(printf '%s\n' "$issues_ref_matches" | grep -c . || true)"

c2=yes
if [ "$pr_use_count" -ne 1 ] || [ "$pr_ref_count" -ne 1 ] || [ "$issues_use_count" -ne 1 ] || [ "$issues_ref_count" -ne 1 ]; then
  c2=no
else
  pr_use_val="$(printf '%s\n' "$pr_use_matches" | head -n1 | cut -d@ -f2)"
  pr_ref_val="$(printf '%s\n' "$pr_ref_matches" | head -n1 | grep -oE '[0-9a-f]{40}')"
  issues_use_val="$(printf '%s\n' "$issues_use_matches" | head -n1 | cut -d@ -f2)"
  issues_ref_val="$(printf '%s\n' "$issues_ref_matches" | head -n1 | grep -oE '[0-9a-f]{40}')"
  if [ "$pr_use_val" != "$pin" ] || [ "$pr_ref_val" != "$pin" ] || [ "$issues_use_val" != "$pin" ] || [ "$issues_ref_val" != "$pin" ]; then
    c2=no
  fi
fi
print_check pin-equal "$c2" "pin=$pin"
[ "$c2" = yes ] || overall=no

# 3. pin-reachable
if [ "$compare_status" = "ahead" ] || [ "$compare_status" = "identical" ]; then
  c3=yes
else
  c3=no
fi
print_check pin-reachable "$c3" "status=$compare_status"
[ "$c3" = yes ] || overall=no

# 4/5. job structure from the reusable workflow
job_info="$(printf '%s\n' "$raw_screening" | awk '
  BEGIN { seen_jobs = 0; job = ""; inenv = 0 }
  /^jobs:$/ { seen_jobs = 1; next }
  seen_jobs && /^  [a-z][a-z0-9_-]*:$/ {
    job = $0
    sub(/^  /, "", job)
    sub(/:$/, "", job)
    decl[job] = 0; name[job] = 0; dep[job] = 0; extra[job] = 0; strf[job] = 0
    sec[job] = 0
    inenv = 0
    next
  }
  seen_jobs && job != "" {
    if (inenv && $0 ~ /^      /) {
      if ($0 == "      name: steward-publication") name[job] = 1
      else if ($0 == "      deployment: false") dep[job] = 1
      else extra[job] = 1
      next
    }
    inenv = 0
    if ($0 == "    environment:") { decl[job] = 1; inenv = 1; next }
    if ($0 ~ /^    environment:/) strf[job] = 1
    if ($0 ~ /secrets\.PATCH_STEWARD_APP_ID/ || $0 ~ /secrets\.PATCH_STEWARD_APP_PRIVATE_KEY/) sec[job] = 1
  }
  END {
    for (j in decl) {
      m = (decl[j] && name[j] && dep[j] && !extra[j] && !strf[j]) ? 1 : 0
      o = ((decl[j] || strf[j]) && !m) ? 1 : 0
      print "MAP|" j "|" m
      print "OTHER|" j "|" o
    }
    for (j in sec) print "SEC|" j "|" sec[j]
  }
')"

env_list="$(printf '%s\n' "$job_info" | awk -F'|' '$1 == "MAP" && $3 == 1 { print $2 }' | sort | paste -sd, -)"
other_list="$(printf '%s\n' "$job_info" | awk -F'|' '$1 == "OTHER" && $3 == 1 { print $2 }' | sort | paste -sd, -)"
sec_list="$(printf '%s\n' "$job_info" | awk -F'|' '$1 == "SEC" && $3 == 1 { print $2 }' | sort | paste -sd, -)"
before_jobs="$(printf '%s\n' "$raw_screening" | awk '/^jobs:$/ { exit } { print }')"
before_jobs_has_secrets="$(printf '%s\n' "$before_jobs" | grep -c 'secrets\.' || true)"

wrappers_have_environment=no
if printf '%s' "$raw_pr" | grep -q 'environment:'; then wrappers_have_environment=yes; fi
if printf '%s' "$raw_issues" | grep -q 'environment:'; then wrappers_have_environment=yes; fi

if [ "$env_list" = "gate,publish" ] && [ -z "$other_list" ] && [ "$wrappers_have_environment" = no ]; then
  c4=yes
else
  c4=no
fi
print_check environment-jobs "$c4" "jobs=${env_list:-none} other_form=${other_list:-none}"
[ "$c4" = yes ] || overall=no

if [ "$sec_list" = "gate,publish" ] && [ "$before_jobs_has_secrets" -eq 0 ]; then
  c5=yes
else
  c5=no
fi
print_check secret-jobs "$c5" "jobs=$sec_list"
[ "$c5" = yes ] || overall=no

# 6. wrapper-mapping
mapping_block=$'    secrets:\n      PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}\n      PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}'

pr_has_block=no
case "$raw_pr" in *"$mapping_block"*) pr_has_block=yes ;; esac
issues_has_block=no
case "$raw_issues" in *"$mapping_block"*) issues_has_block=yes ;; esac

pr_secrets_count="$(printf '%s' "$raw_pr" | grep -o 'secrets\.' | wc -l | tr -d ' ')"
issues_secrets_count="$(printf '%s' "$raw_issues" | grep -o 'secrets\.' | wc -l | tr -d ' ')"

has_inherit=no
if printf '%s' "$raw_pr" | grep -q 'inherit'; then has_inherit=yes; fi
if printf '%s' "$raw_issues" | grep -q 'inherit'; then has_inherit=yes; fi

if [ "$pr_has_block" = yes ] && [ "$issues_has_block" = yes ] && [ "$pr_secrets_count" -eq 2 ] \
  && [ "$issues_secrets_count" -eq 2 ] && [ "$has_inherit" = no ]; then
  c6=yes
else
  c6=no
fi
print_check wrapper-mapping "$c6"
[ "$c6" = yes ] || overall=no

# 7. probe-names
probe_pattern='(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)'
c7=yes
if printf '%s' "$raw_pr" | grep -Pq "$probe_pattern"; then c7=no; fi
if printf '%s' "$raw_issues" | grep -Pq "$probe_pattern"; then c7=no; fi
if printf '%s' "$raw_screening" | grep -Pq "$probe_pattern"; then c7=no; fi
print_check probe-names "$c7"
[ "$c7" = yes ] || overall=no

# 8. uses-pinned
print_check uses-pinned "$uses_pinned_ok" "count=$uses_count"
[ "$uses_pinned_ok" = yes ] || overall=no

suffix=""
if [ "$screening_source" = local ]; then suffix=" screening=local"; fi
if [ "$overall" = yes ]; then
  echo "PINS repo=$repo pin=$pin$suffix result=pass"
  exit 0
else
  echo "PINS repo=$repo pin=$pin$suffix result=fail"
  exit 1
fi
