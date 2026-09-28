#!/usr/bin/env bash
# Read-only verification of an evidence store: fetches a store branch (or reads a local store
# root), checks that every store commit only adds files, and verifies each run directory of one
# submission with `steward report --json`.
#
# Usage:
#   bash scenarios/tools/evidence.sh <store owner/repo> <branch> <target owner/repo> <pr|issue> <number>
#   bash scenarios/tools/evidence.sh --local <store root directory> <target owner/repo> <pr|issue> <number>
#
# Behavior:
#   - remote mode: reads the branch tip via `gh api`, clones it read-only into a temporary
#     directory outside this repository (removed at exit), checks that every commit only adds
#     files (append-only), then runs the run check against the clone;
#   - local mode: skips git and network entirely; the given directory is the store root;
#   - run check: for each run directory of <target>/runs/<kind>-<number>, verifies an outcome run
#     with `node packages/cli/dist/main.js report --json` or a waiting run against its manifest
#     (files present match manifest, every listed file's sha256 matches its bytes), then lists
#     supersession records.
#   - never pushes, never writes via gh, never prints file contents, tokens, or secrets.
#
# Output: "EVIDENCE key=value ..." lines.
# Exit 0: result=ok (every outcome run verified and, in remote mode, append_only=yes), or the
#         branch is absent. Exit 1: result=failed. Exit 2: usage error. Exit 3: environment error
#         (CLI not built, ref read failed, clone failed, local store root missing).
set -euo pipefail

usage() {
  echo "usage: evidence.sh <store owner/repo> <branch> <target owner/repo> <pr|issue> <number>" >&2
  echo "       evidence.sh --local <store root directory> <target owner/repo> <pr|issue> <number>" >&2
  exit 2
}

repo_re='^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$'
num_re='^[1-9][0-9]*$'

local_mode=no
if [ "${1:-}" = "--local" ]; then
  local_mode=yes
  if [ "$#" -ne 5 ]; then usage; fi
  store_root="$2"
  target="$3"
  kind="$4"
  number="$5"
else
  if [ "$#" -ne 5 ]; then usage; fi
  store="$1"
  branch="$2"
  target="$3"
  kind="$4"
  number="$5"
fi

if [ "$kind" != "pr" ] && [ "$kind" != "issue" ]; then usage; fi
if ! [[ "$number" =~ $num_re ]]; then usage; fi
if ! [[ "$target" =~ $repo_re ]]; then usage; fi
if [ "$local_mode" = no ] && ! [[ "$store" =~ $repo_re ]]; then usage; fi

if [ ! -f packages/cli/dist/main.js ]; then
  echo "EVIDENCE error=cli-not-built"
  exit 3
fi

append_only_known=no
append_only=yes

if [ "$local_mode" = yes ]; then
  if [ ! -d "$store_root" ]; then
    echo "EVIDENCE error=store-root-missing"
    exit 3
  fi
else
  if ! sha="$(gh api "repos/$store/git/ref/heads/$branch" --jq .object.sha 2> /tmp/evidence-ref-err.$$)"; then
    if grep -q '404' /tmp/evidence-ref-err.$$ 2> /dev/null; then
      rm -f /tmp/evidence-ref-err.$$
      echo "EVIDENCE store=$store branch=$branch state=absent"
      exit 0
    fi
    rm -f /tmp/evidence-ref-err.$$
    echo "EVIDENCE error=ref-read-failed"
    exit 3
  fi
  rm -f /tmp/evidence-ref-err.$$

  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT

  if ! git -c core.autocrlf=false clone --quiet --single-branch --branch "$branch" "git@github.com:$store.git" "$work/store" > /dev/null 2>&1; then
    echo "EVIDENCE error=clone-failed"
    exit 3
  fi
  git -C "$work/store" config core.autocrlf false

  tip="$(git -C "$work/store" rev-parse HEAD)"
  commits="$(git -C "$work/store" rev-list --count HEAD)"
  echo "EVIDENCE store=$store branch=$branch tip=$tip commits=$commits"

  append_only_known=yes
  while IFS= read -r c; do
    parents="$(git -C "$work/store" rev-list --parents -n 1 "$c" | wc -w)"
    parents=$((parents - 1))
    a=0
    o=0
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      status="${line%%$'\t'*}"
      if [ "$status" = "A" ]; then
        a=$((a + 1))
      else
        o=$((o + 1))
      fi
    done < <(git -C "$work/store" diff-tree --root --no-commit-id -r --name-status "$c")
    echo "EVIDENCE commit=$c parents=$parents added=$a other=$o"
    if [ "$o" -ne 0 ] || [ "$parents" -gt 1 ]; then
      append_only=no
    fi
  done < <(git -C "$work/store" rev-list --reverse HEAD)

  if [ "$append_only" = yes ]; then
    echo "EVIDENCE append_only=yes"
  else
    echo "EVIDENCE append_only=no"
  fi

  store_root="$work/store"
fi

run_dir="$store_root/$target/runs/$kind-$number"

runs=0
verified=0
if [ ! -d "$run_dir" ]; then
  echo "EVIDENCE runs=0"
else
  names=()
  while IFS= read -r n; do
    names+=("$n")
  done < <(find "$run_dir" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)

  for name in "${names[@]}"; do
    if [ "$name" = "supersessions" ]; then continue; fi
    runs=$((runs + 1))
    if [ -f "$run_dir/$name/waiting.json" ]; then
      status="$(node -e '
        const fs = require("fs");
        const path = require("path");
        const crypto = require("crypto");
        const dir = process.argv[1];
        try {
          const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
          if (manifest.run_kind !== "waiting") throw new Error("not waiting");
          const listPaths = (base) => {
            let out = [];
            for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
              if (base === dir && entry.name === "manifest.json") continue;
              const full = path.join(base, entry.name);
              if (entry.isDirectory()) {
                out = out.concat(listPaths(full));
              } else {
                out.push(path.relative(dir, full).split(path.sep).join("/"));
              }
            }
            return out;
          };
          const present = listPaths(dir).sort();
          const listed = manifest.files.map((f) => f.path).sort();
          const expected = ["logs/steward.txt", "policy-revision.json", "run.json", "submission.json", "waiting.json"].sort();
          const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
          if (!eq(present, listed) || !eq(present, expected)) throw new Error("mismatch");
          for (const f of manifest.files) {
            const bytes = fs.readFileSync(path.join(dir, f.path));
            const hash = "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
            if (hash !== f.sha256) throw new Error("hash mismatch");
          }
          console.log("verified");
        } catch (e) {
          console.log("failed");
        }
      ' "$run_dir/$name")"
      echo "EVIDENCE run=$name kind=waiting manifest=$status"
      if [ "$status" = "verified" ]; then
        verified=$((verified + 1))
      fi
    else
      json="$(node packages/cli/dist/main.js report --json "$run_dir/$name" 2> /dev/null || true)"
      result="$(node -e '
        let raw = process.argv[1];
        let outcome = "none";
        let manifest = "failed";
        let metrics = "failed";
        let errCount = 0;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.outcome) outcome = parsed.outcome;
          if (parsed && parsed.integrity) {
            manifest = parsed.integrity.manifest || "failed";
            metrics = parsed.integrity.metrics || "failed";
          }
          if (parsed && Array.isArray(parsed.errors)) errCount = parsed.errors.length;
        } catch (e) {
          // leave defaults
        }
        console.log(outcome + " " + manifest + " " + metrics + " " + errCount);
      ' "$json")"
      outcome="$(echo "$result" | cut -d' ' -f1)"
      manifest="$(echo "$result" | cut -d' ' -f2)"
      metrics="$(echo "$result" | cut -d' ' -f3)"
      errcount="$(echo "$result" | cut -d' ' -f4)"
      echo "EVIDENCE run=$name kind=outcome outcome=$outcome manifest=$manifest metrics=$metrics errors=$errcount"
      if [ "$manifest" = "verified" ] && [ "$metrics" = "verified" ] && [ "$errcount" = "0" ]; then
        verified=$((verified + 1))
      fi
    fi
  done

  if [ -d "$run_dir/supersessions" ]; then
    while IFS= read -r f; do
      echo "EVIDENCE supersession=$f"
    done < <(find "$run_dir/supersessions" -mindepth 1 -maxdepth 1 -printf '%f\n' | sort)
  fi
fi

result=ok
if [ "$verified" -ne "$runs" ]; then result=failed; fi
if [ "$local_mode" = no ] && [ "$append_only_known" = yes ] && [ "$append_only" != yes ]; then result=failed; fi

echo "EVIDENCE target=$target subject=$kind-$number runs=$runs verified=$verified result=$result"

if [ "$result" = ok ]; then exit 0; else exit 1; fi
