#!/usr/bin/env bash
# Print normalized job log lines of one workflow run attempt, filtered to a single job.
#
# Usage:
#   bash scenarios/tools/run-log.sh <owner/repo> <run id> <attempt> <job>
#
# Reads the log of the given run attempt (`gh run view --attempt --log`). Each raw log line is
# <job column> TAB <step column> TAB <timestamp> <text>; the job name is the part of the job column
# after the last "/ " (or the whole column when it has none). Keeps only lines whose job name equals
# <job>, drops lines echoed from a step's own script (text starting with the two literal characters
# caret and left-bracket followed by "[36;1m") and lines whose text contains "add-mask", and withholds
# (counts but does not print) lines whose text contains "-----BEGIN" or matches a GitHub token pattern.
# Prints one line per kept entry:
#   LOG job=<job> ts=<timestamp> text=<text>
# then a summary line:
#   LOGS repo=<owner/repo> run=<run id> attempt=<attempt> job=<job> lines=<printed count> withheld=<withheld count>
# Read-only: only GET requests.
#
# Exit codes: 0 success (lines may be 0); 1 the log read failed; 2 usage error.
set -uo pipefail

usage() {
  echo "usage: run-log.sh <owner/repo> <run id> <attempt> <job>" >&2
  exit 2
}

if [ "$#" -ne 4 ]; then
  usage
fi

repo="$1"
run_id="$2"
attempt="$3"
job="$4"

[[ "$repo" =~ ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$ ]] || usage
[[ "$run_id" =~ ^[1-9][0-9]{0,19}$ ]] || usage
[[ "$attempt" =~ ^[1-9][0-9]{0,2}$ ]] || usage
[[ "$job" =~ ^[a-z][a-z0-9_-]{0,39}$ ]] || usage

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

logfile="$tmpdir/log.tsv"
if ! gh run view "$run_id" -R "$repo" --attempt "$attempt" --log > "$logfile" 2>/dev/null; then
  echo "LOGS repo=$repo run=$run_id attempt=$attempt job=$job error=read-failed"
  exit 1
fi

RL_REPO="$repo" RL_RUN="$run_id" RL_ATTEMPT="$attempt" RL_JOB="$job" node -e '
const fs = require("fs");
const logfile = process.argv[1];
const wantJob = process.env.RL_JOB;
const BOM = String.fromCharCode(65279);
const data = fs.readFileSync(logfile, "utf8");
const lines = data.split("\n");
let printed = 0;
let withheld = 0;
const tokenRe = /gh[pousr]_[A-Za-z0-9]{20,}/;
for (let raw of lines) {
  if (raw.endsWith("\r")) raw = raw.slice(0, -1);
  if (raw === "") continue;
  const fields = raw.split("\t");
  if (fields.length < 3) continue;
  let jobCol = fields[0];
  if (jobCol.startsWith(BOM)) jobCol = jobCol.slice(1);
  const idx = jobCol.lastIndexOf("/ ");
  const jobName = idx === -1 ? jobCol : jobCol.slice(idx + 2);
  if (jobName !== wantJob) continue;
  let rest = fields.slice(2).join("\t");
  if (rest.startsWith(BOM)) rest = rest.slice(1);
  const spaceIdx = rest.indexOf(" ");
  const ts = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
  const text = spaceIdx === -1 ? "" : rest.slice(spaceIdx + 1);
  if (text.startsWith("^[")) continue;
  if (text.includes("add-mask")) continue;
  if (text.includes("-----BEGIN") || tokenRe.test(text)) {
    withheld++;
    continue;
  }
  console.log(`LOG job=${jobName} ts=${ts} text=${text}`);
  printed++;
}
console.log(`LOGS repo=${process.env.RL_REPO} run=${process.env.RL_RUN} attempt=${process.env.RL_ATTEMPT} job=${wantJob} lines=${printed} withheld=${withheld}`);
' "$logfile"
