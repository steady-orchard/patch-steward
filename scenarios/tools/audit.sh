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
# teams), and head_deployments (deployments for the head SHA, excluding before-fix ones below); issues
# print n/a for these four.
#
# The first line reports the current wrappers' deployment time T used to classify deployments:
#   AUDIT repo=<owner/repo> wrappers_deployed_at=<T or none> source=history|override
# T is the committer date of the newest master commit that changed .github/workflows/steward-pr.yml
# (source=history), or the AUDIT_WRAPPERS_DEPLOYED_AT environment variable when set (a UTC time
# YYYY-MM-DDTHH:MM:SSZ; any other format is a usage error, exit 2; source=override). A deployment on a
# pull request head is before-fix when its environment is steward-publication, its creator id is
# 2095171 (jambolo) or 331019482 (the test App's bot), and its created_at is strictly earlier than T;
# otherwise it is counted. before-fix deployments are platform records from before the publication jobs
# stopped requesting an Environment and never change the result. For each pull request, right after its
# AUDIT line, one line per deployment on its head, in API order:
#   AUDIT-DEPLOYMENT repo=<owner/repo> pr=<n> id=<id> environment=<env> ref=<ref> creator=<login> created_at=<t> class=before-fix|counted
# Output, issues first by number then pull requests by number:
#   AUDIT repo=<owner/repo> kind=issue number=<n> app_comments=<a> labels=<l> app_check_runs=n/a requested_reviewers=n/a head_deployments=n/a before_fix_deployments=n/a
#   AUDIT repo=<owner/repo> kind=pr number=<n> app_comments=<a> labels=<l> app_check_runs=<c> requested_reviewers=<v> head_deployments=<d> before_fix_deployments=<b>
# then a summary line:
#   AUDIT repo=<owner/repo> submissions=<issues+prs> app_comments=<sum> labels=<sum> app_check_runs=<sum over prs> requested_reviewers=<sum> head_deployments=<sum> before_fix_deployments=<sum> result=clean|writes-found
# Read-only: only GET requests.
#
# Exit codes: 0 result=clean (every sum is 0, before-fix deployments excluded); 1 result=writes-found; 2 usage error; 3 a read failed.
set -uo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: audit.sh <owner/repo> [<title prefix>]" >&2
  exit 2
fi

repo="$1"
prefix="${2:-[scenario S}"

if [ -n "${AUDIT_WRAPPERS_DEPLOYED_AT:-}" ]; then
  if ! [[ "$AUDIT_WRAPPERS_DEPLOYED_AT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; then
    echo "usage: AUDIT_WRAPPERS_DEPLOYED_AT must be a UTC time YYYY-MM-DDTHH:MM:SSZ" >&2
    exit 2
  fi
  deployed_at="$AUDIT_WRAPPERS_DEPLOYED_AT"
  deployed_source=override
else
  deployed_at="$(gh api "repos/$repo/commits?sha=master&path=.github/workflows/steward-pr.yml&per_page=1" --jq '.[0].commit.committer.date // empty' 2>/dev/null)"
  if [ $? -ne 0 ]; then
    echo "AUDIT repo=$repo error=read-failed"
    exit 3
  fi
  [ -n "$deployed_at" ] || deployed_at=none
  deployed_source=history
fi

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
sum_before_fix=0

echo "AUDIT repo=$repo wrappers_deployed_at=$deployed_at source=$deployed_source"

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
  echo "AUDIT repo=$repo kind=issue number=$n app_comments=$comments labels=$labels app_check_runs=n/a requested_reviewers=n/a head_deployments=n/a before_fix_deployments=n/a"
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
  deployment_rows="$(gh api "repos/$repo/deployments?sha=$sha&per_page=100" --paginate \
    --jq '.[] | [(.id|tostring), .environment, .ref, (.creator.id|tostring), .creator.login, .created_at] | @tsv' 2>/dev/null)"
  if [ $? -ne 0 ]; then
    echo "AUDIT repo=$repo error=read-failed"
    exit 3
  fi
  deployments=0
  before_fix=0
  deployment_lines=""
  while IFS=$'\t' read -r d_id d_env d_ref d_creator_id d_creator d_created; do
    [ -n "$d_id" ] || continue
    d_num="${d_created//[!0-9]/}"
    f_num="${deployed_at//[!0-9]/}"
    class=counted
    if [ "$d_env" = steward-publication ] && { [ "$d_creator_id" = 2095171 ] || [ "$d_creator_id" = 331019482 ]; } \
      && [ "$deployed_at" != none ] && [[ "$d_num" =~ ^[0-9]{14}$ ]] && [ "$d_num" -lt "$f_num" ]; then
      class=before-fix
      before_fix=$((before_fix + 1))
    else
      deployments=$((deployments + 1))
    fi
    deployment_lines+="AUDIT-DEPLOYMENT repo=$repo pr=$n id=$d_id environment=$d_env ref=$d_ref creator=$d_creator created_at=$d_created class=$class"$'\n'
  done <<< "$deployment_rows"
  sum_comments=$((sum_comments + comments))
  sum_labels=$((sum_labels + labels))
  sum_checks=$((sum_checks + checks))
  sum_reviewers=$((sum_reviewers + reviewers))
  sum_deployments=$((sum_deployments + deployments))
  sum_before_fix=$((sum_before_fix + before_fix))
  echo "AUDIT repo=$repo kind=pr number=$n app_comments=$comments labels=$labels app_check_runs=$checks requested_reviewers=$reviewers head_deployments=$deployments before_fix_deployments=$before_fix"
  printf '%s' "$deployment_lines"
done

submissions=$(( ${#sorted_issue_numbers[@]} + ${#sorted_pr_idx[@]} ))

result=clean
if [ "$sum_comments" -ne 0 ] || [ "$sum_labels" -ne 0 ] || [ "$sum_checks" -ne 0 ] || [ "$sum_reviewers" -ne 0 ] || [ "$sum_deployments" -ne 0 ]; then
  result=writes-found
fi

echo "AUDIT repo=$repo submissions=$submissions app_comments=$sum_comments labels=$sum_labels app_check_runs=$sum_checks requested_reviewers=$sum_reviewers head_deployments=$sum_deployments before_fix_deployments=$sum_before_fix result=$result"

if [ "$result" = clean ]; then
  exit 0
else
  exit 1
fi
