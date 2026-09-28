#!/usr/bin/env bash
# Pack the steward runtime that the gate and publish jobs run: the built core and action packages with their
# package.json files, the production dependencies zod and yaml, and the core workspace link. Run from the
# repository root after `pnpm build`.
#
# Usage: bash packages/action/pack-runtime.sh <archive path>
# Writes a gzip-compressed tar archive whose root holds packages/ and node_modules/; fails when it exceeds 52428800 bytes.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: pack-runtime.sh <archive path>" >&2
  exit 2
fi
archive="$1"

for required in packages/core/dist/index.js packages/action/dist/main.js packages/core/node_modules/zod/package.json packages/core/node_modules/yaml/package.json; do
  if [ ! -f "$required" ]; then
    echo "pack-runtime: missing $required (run pnpm install and pnpm build first)" >&2
    exit 1
  fi
done

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

mkdir -p "$stage/packages/core" "$stage/packages/action" "$stage/node_modules/@patch-steward"
cp packages/core/package.json "$stage/packages/core/package.json"
cp -R packages/core/dist "$stage/packages/core/dist"
cp packages/action/package.json "$stage/packages/action/package.json"
cp -R packages/action/dist "$stage/packages/action/dist"
cp -R -L packages/core/node_modules/zod "$stage/node_modules/zod"
cp -R -L packages/core/node_modules/yaml "$stage/node_modules/yaml"
ln -s ../../packages/core "$stage/node_modules/@patch-steward/core"

tar -czf "$archive" -C "$stage" packages node_modules

size="$(wc -c < "$archive" | tr -d ' ')"
if [ "$size" -gt 52428800 ]; then
  echo "pack-runtime: archive is $size bytes, above 52428800" >&2
  exit 1
fi
echo "pack-runtime: archive=$archive bytes=$size"
