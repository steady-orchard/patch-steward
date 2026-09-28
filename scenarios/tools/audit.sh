#!/usr/bin/env bash
# Observe-mode audit: check that scenario issues and pull requests carry no writes from the steward App.
#
# Usage:
#   bash scenarios/tools/audit.sh <owner/repo> [<title prefix>]
#
# Default title prefix: "[scenario S". Audits every issue and pull request whose title starts with the
# prefix (checked inside the tool; titles are never printed). For each item, counts app_comments (issue
# comments by the test App's bot user id 331019482) and labels. For pull requests only, also counts
# app_check_runs (check runs on the head SHA with app.id 4993303), requested_reviewers (users plus
# teams), and head_deployments (deployments for the head SHA); issues print n/a for these three.
# Output, issues first by number then pull requests by number:
#   AUDIT repo=<owner/repo> kind=issue number=<n> app_comments=<a> labels=<l> app_check_runs=n/a requested_reviewers=n/a head_deployments=n/a
#   AUDIT repo=<owner/repo> kind=pr number=<n> app_comments=<a> labels=<l> app_check_runs=<c> requested_reviewers=<v> head_deployments=<d>
# then a summary line:
#   AUDIT repo=<owner/repo> submissions=<issues+prs> app_comments=<sum> labels=<sum> app_check_runs=<sum over prs> requested_reviewers=<sum> head_deployments=<sum> result=clean|writes-found
# Read-only: only GET requests.
#
# Exit codes: 0 result=clean (every sum is 0); 1 result=writes-found; 2 usage error; 3 a read failed.
set -uo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: audit.sh <owner/repo> [<title prefix>]" >&2
  exit 2
fi

repo="$1"
prefix="${2:-[scenario S}"

issues_raw="$(gh issue list -R "$repo" --state all --limit 500 --json number,title \
  --jq '.[] | [(.number|tostring),.title] | @tsv' 2>/dev/null)"
if [ $? -ne 0 ]; then
  echo "AUDIT repo=$repo error=read-failed"
  exit 3
fi

prs_raw="$(gh pr list -R "$repo" --state all --limit 500 --json number,title,headRefOid \
  --jq '.[] | [(.number|tostring),.title,.headRefOid] | @tsv' 2>/dev/null)"
if [ $? -ne 0 ]; then
  echo "AUDIT repo=$repo error=read-failed"
  exit 3
fi

issue_numbers=()
while IFS=$'\t' read -r number title; do
  [ -n "$number" ] || continue
  case "$title" in
    "$prefix"*) issue_numbers+=("$number") ;;
  esac
done <<< "$issues_raw"

pr_numbers=()
pr_shas=()
while IFS=$'\t' read -r number title sha; do
  [ -n "$number" ] || continue
  case "$title" in
    "$prefix"*) pr_numbers+=("$number"); pr_shas+=("$sha") ;;
  esac
done <<< "$prs_raw"

sum_comments=0
sum_labels=0
sum_checks=0
sum_reviewers=0
sum_deployments=0

sorted_issue_numbers=()
if [ "${#issue_numbers[@]}" -gt 0 ]; then
  while IFS= read -r n; do
    sorted_issue_numbers+=("$n")
  done < <(printf '%s\n' "${issue_numbers[@]}" | sort -n)
fi

for n in "${sorted_issue_numbers[@]}"; do
  comments="$(gh api "repos/$repo/issues/$n/comments" --paginate --jq '[.[] | select(.user.id == 331019482)] | length' 2>/dev/null)"
  if [ $? -ne 0 ]; then
    echo "AUDIT repo=$repo error=read-failed"
    exit 3
  fi
  labels="$(gh api "repos/$repo/issues/$n" --jq '.labels | length' 2>/dev/null)"
  if [ $? -ne 0 ]; then
    echo "AUDIT repo=$repo error=read-failed"
    exit 3
  fi
  sum_comments=$((sum_comments + comments))
  sum_labels=$((sum_labels + labels))
  echo "AUDIT repo=$repo kind=issue number=$n app_comments=$comments labels=$labels app_check_runs=n/a requested_reviewers=n/a head_deployments=n/a"
done

sorted_pr_idx=()
if [ "${#pr_numbers[@]}" -gt 0 ]; then
  paste_input=""
  for i in "${!pr_numbers[@]}"; do
    paste_input+="${pr_numbers[$i]}"$'\t'"$i"$'\n'
  done
  while IFS=$'\t' read -r n i; do
    [ -n "$n" ] || continue
    sorted_pr_idx+=("$i")
  done < <(printf '%s' "$paste_input" | sort -n)
fi

for i in "${sorted_pr_idx[@]}"; do
  n="${pr_numbers[$i]}"
  sha="${pr_shas[$i]}"
  comments="$(gh api "repos/$repo/issues/$n/comments" --paginate --jq '[.[] | select(.user.id == 331019482)] | length' 2>/dev/null)"
  if [ $? -ne 0 ]; then
    echo "AUDIT repo=$repo error=read-failed"
    exit 3
  fi
  labels="$(gh api "repos/$repo/issues/$n" --jq '.labels | length' 2>/dev/null)"
  if [ $? -ne 0 ]; then
    echo "AUDIT repo=$repo error=read-failed"
    exit 3
  fi
  checks="$(gh api "repos/$repo/commits/$sha/check-runs" --paginate --jq '[.check_runs[] | select(.app.id == 4993303)] | length' 2>/dev/null)"
  if [ $? -ne 0 ]; then
    echo "AUDIT repo=$repo error=read-failed"
    exit 3
  fi
  reviewers="$(gh api "repos/$repo/pulls/$n/requested_reviewers" --jq '(.users | length) + (.teams | length)' 2>/dev/null)"
  if [ $? -ne 0 ]; then
    echo "AUDIT repo=$repo error=read-failed"
    exit 3
  fi
  deployments="$(gh api "repos/$repo/deployments?sha=$sha&per_page=100" --jq 'length' 2>/dev/null)"
  if [ $? -ne 0 ]; then
    echo "AUDIT repo=$repo error=read-failed"
    exit 3
  fi
  sum_comments=$((sum_comments + comments))
  sum_labels=$((sum_labels + labels))
  sum_checks=$((sum_checks + checks))
  sum_reviewers=$((sum_reviewers + reviewers))
  sum_deployments=$((sum_deployments + deployments))
  echo "AUDIT repo=$repo kind=pr number=$n app_comments=$comments labels=$labels app_check_runs=$checks requested_reviewers=$reviewers head_deployments=$deployments"
done

submissions=$(( ${#sorted_issue_numbers[@]} + ${#sorted_pr_idx[@]} ))

result=clean
if [ "$sum_comments" -ne 0 ] || [ "$sum_labels" -ne 0 ] || [ "$sum_checks" -ne 0 ] || [ "$sum_reviewers" -ne 0 ] || [ "$sum_deployments" -ne 0 ]; then
  result=writes-found
fi

echo "AUDIT repo=$repo submissions=$submissions app_comments=$sum_comments labels=$sum_labels app_check_runs=$sum_checks requested_reviewers=$sum_reviewers head_deployments=$sum_deployments result=$result"

if [ "$result" = clean ]; then
  exit 0
else
  exit 1
fi
