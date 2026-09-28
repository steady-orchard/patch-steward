#!/usr/bin/env bash
# Read-only reader of evidence-store run records: key fields of run directories (outcome or
# waiting), supersession records, and metrics files of one submission or one run.
#
# Usage:
#   bash scenarios/tools/run-records.sh runs <store owner/repo> <branch> <target owner/repo> <pr|issue> <number>
#   bash scenarios/tools/run-records.sh runs --local <store root> <target owner/repo> <pr|issue> <number>
#   bash scenarios/tools/run-records.sh metrics <store owner/repo> <branch> <target owner/repo> <run_id>-<run_attempt>
#   bash scenarios/tools/run-records.sh metrics --local <store root> <target owner/repo> <run_id>-<run_attempt>
#
# Behavior:
#   - remote mode: reads the branch tip via `gh api`, clones it read-only into a temporary
#     directory outside this repository (removed at exit), then reads from that clone;
#   - local mode: skips git and network entirely; the given directory is the store root;
#   - runs mode: for each run directory of <target>/runs/<kind>-<number>, prints its key fields
#     (waiting state, or outcome plus finding codes), then its supersession records;
#   - metrics mode: for each month directory under <target>/metrics, prints the events of the
#     given run's metrics file and, if present, its supersession metrics file.
#   - never pushes, never writes via gh, never prints file contents, tokens, or secrets.
#
# Output: "RECORD ...", "SUPERSESSION ...", "RECORDS ..." lines (runs mode), or
#         "METRIC ...", "METRICS ..." lines (metrics mode).
# Exit 0: success, or the branch is absent (prints only the final summary line).
# Exit 1: read, clone, or parse failure. Exit 2: usage error.
set -euo pipefail

usage() {
  echo "usage: run-records.sh runs <store owner/repo> <branch> <target owner/repo> <pr|issue> <number>" >&2
  echo "       run-records.sh runs --local <store root> <target owner/repo> <pr|issue> <number>" >&2
  echo "       run-records.sh metrics <store owner/repo> <branch> <target owner/repo> <run_id>-<run_attempt>" >&2
  echo "       run-records.sh metrics --local <store root> <target owner/repo> <run_id>-<run_attempt>" >&2
  exit 2
}

repo_re='^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$'
num_re='^[1-9][0-9]*$'
rundir_re='^[1-9][0-9]*-[1-9][0-9]*$'

mode="${1:-}"
if [ "$mode" != "runs" ] && [ "$mode" != "metrics" ]; then usage; fi

local_mode=no
store_root=""
store=""
branch=""
target=""
kind=""
number=""
rundir=""

if [ "$mode" = "runs" ]; then
  if [ "${2:-}" = "--local" ]; then
    if [ "$#" -ne 6 ]; then usage; fi
    local_mode=yes
    store_root="$3"
    target="$4"
    kind="$5"
    number="$6"
  else
    if [ "$#" -ne 6 ]; then usage; fi
    store="$2"
    branch="$3"
    target="$4"
    kind="$5"
    number="$6"
  fi
  if [ "$kind" != "pr" ] && [ "$kind" != "issue" ]; then usage; fi
  if ! [[ "$number" =~ $num_re ]]; then usage; fi
else
  if [ "${2:-}" = "--local" ]; then
    if [ "$#" -ne 5 ]; then usage; fi
    local_mode=yes
    store_root="$3"
    target="$4"
    rundir="$5"
  else
    if [ "$#" -ne 5 ]; then usage; fi
    store="$2"
    branch="$3"
    target="$4"
    rundir="$5"
  fi
  if ! [[ "$rundir" =~ $rundir_re ]]; then usage; fi
fi

if ! [[ "$target" =~ $repo_re ]]; then usage; fi
if [ "$local_mode" = no ] && ! [[ "$store" =~ $repo_re ]]; then usage; fi

if [ "$mode" = "runs" ]; then
  prefix=RECORDS
else
  prefix=METRICS
fi

fail_final() {
  if [ "$mode" = "runs" ]; then
    echo "RECORDS store=$store branch=$branch target=$target subject=$kind-$number runs=0 supersessions=0"
  else
    echo "METRICS store=$store branch=$branch target=$target run=$rundir files=0 events=0"
  fi
}

store_label=""
branch_label=""
root=""

if [ "$local_mode" = yes ]; then
  if [ ! -d "$store_root" ]; then
    echo "$prefix error=store-root-missing"
    exit 1
  fi
  store_label=local
  branch_label=none
  root="$store_root"
else
  if ! sha="$(gh api "repos/$store/git/ref/heads/$branch" --jq .object.sha 2> /tmp/run-records-ref-err.$$)"; then
    if grep -q '404' /tmp/run-records-ref-err.$$ 2> /dev/null; then
      rm -f /tmp/run-records-ref-err.$$
      fail_final
      exit 0
    fi
    rm -f /tmp/run-records-ref-err.$$
    echo "$prefix error=read-failed"
    exit 1
  fi
  rm -f /tmp/run-records-ref-err.$$

  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT

  if ! git -c core.autocrlf=false clone --quiet --depth 1 --single-branch --branch "$branch" "git@github.com:$store.git" "$work/store" > /dev/null 2>&1; then
    echo "$prefix error=clone-failed"
    exit 1
  fi
  git -C "$work/store" config core.autocrlf false

  store_label="$store"
  branch_label="$branch"
  root="$work/store"
fi

runs_js='
const fs = require("fs");
const path = require("path");
const [root, storeLabel, branchLabel, target, kind, number] = process.argv.slice(1);
const D = path.join(root, target, "runs", `${kind}-${number}`);
let runsCount = 0;
let supersessionsCount = 0;
const recordLines = [];
const supersessionLines = [];
if (fs.existsSync(D) && fs.statSync(D).isDirectory()) {
  const entries = fs
    .readdirSync(D)
    .filter((n) => /^[0-9]+-[0-9]+$/.test(n))
    .sort((a, b) => {
      const [aid, aat] = a.split("-").map(Number);
      const [bid, bat] = b.split("-").map(Number);
      return aid - bid || aat - bat;
    });
  for (const name of entries) {
    const dir = path.join(D, name);
    const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(dir, p), "utf8"));
    const waitingPath = path.join(dir, "waiting.json");
    if (fs.existsSync(waitingPath)) {
      const waiting = readJSON("waiting.json");
      const runJson = readJSON("run.json");
      recordLines.push(
        `RECORD run=${name} kind=waiting state=${waiting.state} reason=${waiting.reason} daily=${waiting.counts.daily_count}/${waiting.counts.daily_limit} author=${waiting.counts.author_count}/${waiting.counts.author_limit} arrival_at=${waiting.arrival_at} policy_revision=${runJson.policy_revision} snapshot=${runJson.subject.snapshot_hash}`,
      );
    } else {
      const runJson = readJSON("run.json");
      const decision = readJSON("decision.json");
      let codes = [];
      const findingsDir = path.join(dir, "findings");
      if (fs.existsSync(findingsDir)) {
        for (const f of fs.readdirSync(findingsDir)) {
          if (!f.endsWith(".json")) continue;
          const fj = JSON.parse(fs.readFileSync(path.join(findingsDir, f), "utf8"));
          if (fj && fj.code) codes.push(fj.code);
        }
      }
      codes = [...new Set(codes)].sort();
      const codesStr = codes.length ? codes.join(",") : "none";
      recordLines.push(
        `RECORD run=${name} kind=outcome outcome=${decision.outcome} run_id=${runJson.run_id} run_attempt=${runJson.run_attempt} policy_revision=${runJson.policy_revision} snapshot=${runJson.subject.snapshot_hash} findings=${codesStr}`,
      );
    }
    runsCount++;
  }
  const supDir = path.join(D, "supersessions");
  if (fs.existsSync(supDir)) {
    const files = fs
      .readdirSync(supDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    for (const f of files) {
      const s = JSON.parse(fs.readFileSync(path.join(supDir, f), "utf8"));
      const successor = s.successor ? `${s.successor.run_id}-${s.successor.run_attempt}` : "null";
      const successorAt = s.successor ? s.successor.artifact_created_at : "null";
      const live = s.live_snapshot_hash === null || s.live_snapshot_hash === undefined ? "null" : s.live_snapshot_hash;
      supersessionLines.push(
        `SUPERSESSION file=${f} run=${s.run_id}-${s.run_attempt} reason=${s.reason} successor=${successor} successor_created_at=${successorAt} recorded_snapshot=${s.recorded_snapshot_hash} live_snapshot=${live}`,
      );
      supersessionsCount++;
    }
  }
}
for (const l of recordLines) console.log(l);
for (const l of supersessionLines) console.log(l);
console.log(
  `RECORDS store=${storeLabel} branch=${branchLabel} target=${target} subject=${kind}-${number} runs=${runsCount} supersessions=${supersessionsCount}`,
);
'

metrics_js='
const fs = require("fs");
const path = require("path");
const [root, storeLabel, branchLabel, target, rundir] = process.argv.slice(1);
const metricsRoot = path.join(root, target, "metrics");
let filesRead = 0;
let eventsPrinted = 0;
const lines = [];
if (fs.existsSync(metricsRoot)) {
  const months = fs
    .readdirSync(metricsRoot)
    .filter((m) => fs.statSync(path.join(metricsRoot, m)).isDirectory())
    .sort();
  for (const month of months) {
    for (const fname of [`${rundir}.json`, `${rundir}-supersession.json`]) {
      const fpath = path.join(metricsRoot, month, fname);
      if (!fs.existsSync(fpath)) continue;
      const events = JSON.parse(fs.readFileSync(fpath, "utf8"));
      filesRead++;
      const relFile = `${target}/metrics/${month}/${fname}`;
      for (const ev of events) {
        const subj = ev.subject && ev.subject.kind;
        if (ev.kind === "state-transition") {
          const from = ev.payload.from === null || ev.payload.from === undefined ? "null" : ev.payload.from;
          lines.push(`METRIC file=${relFile} kind=state-transition subject=${subj} from=${from} to=${ev.payload.to}`);
        } else if (ev.kind === "maintainer-resolution") {
          const resolution =
            ev.payload.resolution === undefined || ev.payload.resolution === null ? "none" : ev.payload.resolution;
          const pr = ev.payload.paired_run ? `${ev.payload.paired_run.run_id}-${ev.payload.paired_run.run_attempt}` : "null";
          const ps =
            ev.payload.paired_snapshot_hash === undefined || ev.payload.paired_snapshot_hash === null
              ? "null"
              : ev.payload.paired_snapshot_hash;
          lines.push(
            `METRIC file=${relFile} kind=maintainer-resolution subject=${subj} action_kind=${ev.payload.action_kind} resolution=${resolution} paired_run=${pr} paired_snapshot=${ps}`,
          );
        } else {
          lines.push(`METRIC file=${relFile} kind=${ev.kind} subject=${subj}`);
        }
        eventsPrinted++;
      }
    }
  }
}
for (const l of lines) console.log(l);
console.log(`METRICS store=${storeLabel} branch=${branchLabel} target=${target} run=${rundir} files=${filesRead} events=${eventsPrinted}`);
'

if [ "$mode" = "runs" ]; then
  if ! node -e "$runs_js" -- "$root" "$store_label" "$branch_label" "$target" "$kind" "$number"; then
    echo "$prefix error=parse-failed"
    exit 1
  fi
else
  if ! node -e "$metrics_js" -- "$root" "$store_label" "$branch_label" "$target" "$rundir"; then
    echo "$prefix error=parse-failed"
    exit 1
  fi
fi
