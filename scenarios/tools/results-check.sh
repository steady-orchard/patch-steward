#!/usr/bin/env bash
# Checks a scenario results file for passing sections, forbidden text, and Prettier formatting.
#
# Usage:
#   bash scenarios/tools/results-check.sh <results file> <scenario id> [<scenario id> ...]
#
# Behavior:
#   - sections: the file (CR-stripped) is split into sections starting at a line matching
#     `^## (S[0-9]{2})( |$)`; every given scenario id must have at least one section, and every
#     section with that id must contain a line exactly `Result: pass`;
#   - hygiene: scans the whole file for forbidden names (leaked-token markers, escape markers,
#     literal probe secret names, planning-identifier references, raw control/bidi/zero-width
#     characters), in a fixed order, each reported at most once;
#   - prettier: `pnpm exec prettier --check <file>` must exit 0;
#   - read-only: no writes to the results file.
#
# Output: exactly four "RESULTS-CHECK file=<file> ..." lines (sections, hygiene, prettier, result).
# Exit 0: result=pass (all three checks ok). Exit 1: result=fail. Exit 2: usage error.
set -uo pipefail

usage() {
  echo "usage: results-check.sh <results file> <scenario id> [<scenario id> ...]" >&2
  exit 2
}

if [ "$#" -lt 2 ]; then usage; fi
file="$1"
shift
if [ ! -f "$file" ]; then usage; fi
for id in "$@"; do
  if ! [[ "$id" =~ ^S[0-9]{2}$ ]]; then usage; fi
done

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cat > "$work/check.js" << 'NODESCRIPT'
const fs = require('fs');

const file = process.argv[2];
const ids = process.argv.slice(3);
const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
const lines = text.split('\n');

const sections = [];
let cur = null;
for (const line of lines) {
  const m = line.match(/^## (S[0-9]{2})( |$)/);
  if (m) {
    cur = { id: m[1], lines: [line] };
    sections.push(cur);
  } else if (/^## /.test(line)) {
    cur = null;
  } else if (cur) {
    cur.lines.push(line);
  }
}

const missing = [];
const failed = [];
for (const id of ids) {
  const secs = sections.filter((s) => s.id === id);
  if (secs.length === 0) {
    missing.push(id);
    continue;
  }
  const allPass = secs.every((s) => s.lines.includes('Result: pass'));
  if (!allPass) failed.push(id);
}

let sectionsResult;
if (missing.length) sectionsResult = 'missing=' + missing.join(',');
else if (failed.length) sectionsResult = 'failed=' + failed.join(',');
else sectionsResult = 'ok';

const forbidden = [];
if (text.includes('ghs_')) forbidden.push('ghs_');
if (text.includes('ghp_')) forbidden.push('ghp_');
if (text.includes('-----BEGIN')) forbidden.push('begin-key');
if (text.includes('^[')) forbidden.push('echo-marker');
if (new RegExp('(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)').test(text)) forbidden.push('probe-secret-name');

const planningCaseSensitive =
  /development-art[i]facts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner[ ]decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA)[0-9]{1,2}\b/;
const planningCaseInsensitive = /\bphase [0-9]|\bstep [0-9]+\.[0-9]+/i;
if (planningCaseSensitive.test(text) || planningCaseInsensitive.test(text)) forbidden.push('planning-reference');

const ranges = [
  [0, 8],
  [11, 12],
  [14, 31],
  [127, 159],
  [8203, 8207],
  [8232, 8238],
  [8288, 8292],
  [8294, 8297],
  [65279, 65279],
];
let hasControl = false;
for (let i = 0; i < text.length; i++) {
  const c = text.charCodeAt(i);
  if (ranges.some(([a, b]) => c >= a && c <= b)) {
    hasControl = true;
    break;
  }
}
if (hasControl) forbidden.push('control-character');

const hygieneResult = forbidden.length ? 'forbidden=' + forbidden.join(',') : 'ok';

console.log('SECTIONS ' + sectionsResult);
console.log('HYGIENE ' + hygieneResult);
NODESCRIPT

node_out="$(node "$work/check.js" "$file" "$@")"
sections_result="$(printf '%s\n' "$node_out" | sed -n 's/^SECTIONS //p')"
hygiene_result="$(printf '%s\n' "$node_out" | sed -n 's/^HYGIENE //p')"

if pnpm exec prettier --check "$file" > /dev/null 2>&1; then
  prettier_result=ok
else
  prettier_result=fail
fi

echo "RESULTS-CHECK file=$file check=sections $sections_result"
echo "RESULTS-CHECK file=$file check=hygiene $hygiene_result"
echo "RESULTS-CHECK file=$file check=prettier $prettier_result"

if [ "$sections_result" = ok ] && [ "$hygiene_result" = ok ] && [ "$prettier_result" = ok ]; then
  echo "RESULTS-CHECK file=$file result=pass"
  exit 0
else
  echo "RESULTS-CHECK file=$file result=fail"
  exit 1
fi
