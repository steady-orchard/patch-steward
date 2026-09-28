# Step 4.2

- id: 4.2
- depends_on: []
- route: mechanical
- objective: Add the reusable screening workflow .github/workflows/steward-screening.yml (jobs build, gate, publish) and the runtime pack script packages/action/pack-runtime.sh, both byte-exact from the FILE BLOCKS below.
- files_in_scope:
    - .github/workflows/steward-screening.yml
    - packages/action/pack-runtime.sh
    - development-artifacts/patch-steward-m6-4.2-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest); Git Bash; run every command from your tree root. core.autocrlf=true
    (working tree is CRLF: never anchor a grep with `$`). jq is NOT installed (use node). actionlint 1.7.12 is installed
    (`actionlint` on PATH; shellcheck is not installed, so actionlint skips script linting). Never run a formatter on
    development-artifacts/.

    What the two files are (already designed and verified with actionlint and Prettier; you copy them, never edit them):
    - .github/workflows/steward-screening.yml: `on: workflow_call` only (never runs in this repository), input `steward_ref`
      (40-hex commit SHA), secrets PATCH_STEWARD_APP_ID and PATCH_STEWARD_APP_PRIVATE_KEY (required: false). Jobs:
      build (credential-free: validates steward_ref through env, checks out steady-orchard/patch-steward at it into steward/
      with persist-credentials false, Node 24 via actions/setup-node, `corepack enable`, `pnpm install --frozen-lockfile
      --ignore-scripts`, `pnpm build`, packs the runtime with packages/action/pack-runtime.sh, uploads it as same-run artifact
      `steward-runtime` (retention 1 day), outputs its SHA-256 as `runtime_sha256`); gate (environment steward-publication;
      downloads the runtime, verifies size and SHA-256 BEFORE `tar -x`, runs `node .../packages/action/dist/main.js gate` with
      the two App secrets as step env, prints its job summary into the log between stop-commands markers, uploads
      `steward-handoff` and `steward-closure` (retention 1) before the ownership artifact (retention 90), then sets
      committed=true in a later step); publish (runs when the gate succeeded and committed or is record-only; per-submission
      concurrency group from the gate with a per-run fallback; downloads the runtime and the same-run records; runs
      `main.js publish` with the App secrets and the gate outputs as env). Every job `permissions: {}`; every action is an
      actions/* action pinned by full commit SHA with a trailing tag comment.
    - packages/action/pack-runtime.sh: run from the repository root after `pnpm build`; writes a tar.gz whose root holds
      packages/core/{package.json,dist}, packages/action/{package.json,dist}, node_modules/zod, node_modules/yaml (dereferenced
      copies) and node_modules/@patch-steward/core (symlink to ../../packages/core); fails above 52428800 bytes. On Windows Git
      Bash `ln -s` makes a copy instead of a symlink; module resolution works either way.

    The files are produced by extracting the FILE BLOCKS at the end of this context with the node command in actions step 2
    (it strips exactly the 4-space block indentation; blank lines stay empty). Do not retype them.

    FILE BLOCKS
    ===== BEGIN FILE .github/workflows/steward-screening.yml =====
    # Reusable screening workflow. Target repositories call it from the wrapper workflows in templates/workflows/, pinned by
    # commit SHA, and pass the same SHA as steward_ref. Jobs: build (credential-free: checks out and builds the steward, then
    # uploads the runtime), gate (ownership, deduplication, caps, commitment), publish (evidence first, then freshness).
    # Only gate and publish declare the publication Environment and receive the App credentials, and only in the step that
    # runs the steward. The workflow has no other trigger, so it never runs in this repository.
    name: steward-screening

    on:
      workflow_call:
        inputs:
          steward_ref:
            description: Full 40-character commit SHA of the steward, equal to the SHA that pins this workflow
            required: true
            type: string
        secrets:
          PATCH_STEWARD_APP_ID:
            description: GitHub App id, delivered from the caller's publication Environment
            required: false
          PATCH_STEWARD_APP_PRIVATE_KEY:
            description: GitHub App private key, delivered from the caller's publication Environment
            required: false

    permissions: {}

    jobs:
      build:
        name: build
        runs-on: ubuntu-latest
        timeout-minutes: 15
        permissions: {}
        outputs:
          runtime_sha256: ${{ steps.pack.outputs.runtime_sha256 }}
        steps:
          - name: Check the steward reference
            env:
              STEWARD_REF: ${{ inputs.steward_ref }}
            run: |
              if [[ ! "$STEWARD_REF" =~ ^[0-9a-f]{40}$ ]]; then
                echo "::error::steward_ref must be a full 40-character lowercase commit SHA"
                exit 1
              fi

          - name: Check out the steward
            uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
            with:
              repository: steady-orchard/patch-steward
              ref: ${{ inputs.steward_ref }}
              path: steward
              persist-credentials: false

          - name: Set up Node
            uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
            with:
              node-version: 24
              package-manager-cache: false

          - name: Install and build
            working-directory: steward
            env:
              COREPACK_ENABLE_DOWNLOAD_PROMPT: '0'
            run: |
              corepack enable
              pnpm install --frozen-lockfile --ignore-scripts
              pnpm build

          - name: Pack the runtime
            id: pack
            working-directory: steward
            run: |
              bash packages/action/pack-runtime.sh "$RUNNER_TEMP/steward-runtime.tar.gz"
              echo "runtime_sha256=$(sha256sum "$RUNNER_TEMP/steward-runtime.tar.gz" | cut -d ' ' -f 1)" >> "$GITHUB_OUTPUT"

          - name: Upload the runtime
            uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
            with:
              name: steward-runtime
              path: ${{ runner.temp }}/steward-runtime.tar.gz
              retention-days: 1
              if-no-files-found: error

      gate:
        name: gate
        needs: build
        runs-on: ubuntu-latest
        timeout-minutes: 10
        environment: steward-publication
        permissions: {}
        outputs:
          committed: ${{ steps.commitment.outputs.committed }}
          record_only: ${{ steps.core.outputs.record_only }}
          disposition: ${{ steps.core.outputs.disposition }}
          concurrency_group: ${{ steps.core.outputs.concurrency_group }}
          snapshot_hash: ${{ steps.core.outputs.snapshot_hash }}
          policy_revision: ${{ steps.core.outputs.policy_revision }}
        steps:
          - name: Set up Node
            uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
            with:
              node-version: 24
              package-manager-cache: false

          - name: Download the runtime
            uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
            with:
              name: steward-runtime
              path: ${{ runner.temp }}/steward-download

          - name: Verify and extract the runtime
            env:
              RUNTIME_SHA256: ${{ needs.build.outputs.runtime_sha256 }}
            run: |
              archive="$RUNNER_TEMP/steward-download/steward-runtime.tar.gz"
              if [[ ! "$RUNTIME_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
                echo "::error::the runtime digest is missing"
                exit 1
              fi
              if [ "$(stat -c %s "$archive")" -gt 52428800 ]; then
                echo "::error::the runtime archive is too large"
                exit 1
              fi
              if [ "$(sha256sum "$archive" | cut -d ' ' -f 1)" != "$RUNTIME_SHA256" ]; then
                echo "::error::the runtime digest does not match"
                exit 1
              fi
              mkdir "$RUNNER_TEMP/steward-runtime"
              tar -xzf "$archive" -C "$RUNNER_TEMP/steward-runtime"

          - name: Run the gate
            id: core
            env:
              PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}
              PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}
            run: |
              set +e
              node "$RUNNER_TEMP/steward-runtime/packages/action/dist/main.js" gate
              status=$?
              stop="steward-summary-$RANDOM$RANDOM$RANDOM"
              echo "::stop-commands::$stop"
              echo "steward job summary:"
              cat "$GITHUB_STEP_SUMMARY" 2> /dev/null
              echo "::$stop::"
              exit "$status"

          - name: Upload the handoff
            if: ${{ steps.core.outputs.commit == 'true' }}
            uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
            with:
              name: steward-handoff
              path: ${{ runner.temp }}/steward/handoff/
              retention-days: 1
              if-no-files-found: error

          - name: Upload the closure record
            if: ${{ steps.core.outputs.record_only == 'true' }}
            uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
            with:
              name: steward-closure
              path: ${{ runner.temp }}/steward/closure/
              retention-days: 1
              if-no-files-found: error

          - name: Upload the ownership record
            if: ${{ steps.core.outputs.commit == 'true' }}
            uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
            with:
              name: ${{ steps.core.outputs.ownership_artifact }}
              path: ${{ runner.temp }}/steward/ownership/ownership.json
              retention-days: 90
              if-no-files-found: error

          - name: Record the commitment
            id: commitment
            if: ${{ steps.core.outputs.commit == 'true' }}
            run: echo "committed=true" >> "$GITHUB_OUTPUT"

      publish:
        name: publish
        needs: [build, gate]
        if: ${{ always() && needs.gate.result == 'success' && (needs.gate.outputs.committed == 'true' || needs.gate.outputs.record_only == 'true') }}
        runs-on: ubuntu-latest
        timeout-minutes: 20
        environment: steward-publication
        permissions: {}
        concurrency:
          group: ${{ needs.gate.outputs.concurrency_group || format('steward-{0}-run-{1}', github.repository_id, github.run_id) }}
          cancel-in-progress: false
        steps:
          - name: Set up Node
            uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
            with:
              node-version: 24
              package-manager-cache: false

          - name: Download the runtime
            uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
            with:
              name: steward-runtime
              path: ${{ runner.temp }}/steward-download

          - name: Verify and extract the runtime
            env:
              RUNTIME_SHA256: ${{ needs.build.outputs.runtime_sha256 }}
            run: |
              archive="$RUNNER_TEMP/steward-download/steward-runtime.tar.gz"
              if [[ ! "$RUNTIME_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
                echo "::error::the runtime digest is missing"
                exit 1
              fi
              if [ "$(stat -c %s "$archive")" -gt 52428800 ]; then
                echo "::error::the runtime archive is too large"
                exit 1
              fi
              if [ "$(sha256sum "$archive" | cut -d ' ' -f 1)" != "$RUNTIME_SHA256" ]; then
                echo "::error::the runtime digest does not match"
                exit 1
              fi
              mkdir "$RUNNER_TEMP/steward-runtime"
              tar -xzf "$archive" -C "$RUNNER_TEMP/steward-runtime"

          - name: Download the handoff
            if: ${{ needs.gate.outputs.committed == 'true' }}
            uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
            with:
              name: steward-handoff
              path: ${{ runner.temp }}/steward/handoff

          - name: Download the closure record
            if: ${{ needs.gate.outputs.record_only == 'true' }}
            uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
            with:
              name: steward-closure
              path: ${{ runner.temp }}/steward/closure

          - name: Run publish
            id: core
            env:
              PATCH_STEWARD_APP_ID: ${{ secrets.PATCH_STEWARD_APP_ID }}
              PATCH_STEWARD_APP_PRIVATE_KEY: ${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}
              STEWARD_GATE_DISPOSITION: ${{ needs.gate.outputs.disposition }}
              STEWARD_GATE_RECORD_ONLY: ${{ needs.gate.outputs.record_only }}
              STEWARD_GATE_SNAPSHOT_HASH: ${{ needs.gate.outputs.snapshot_hash }}
              STEWARD_GATE_POLICY_REVISION: ${{ needs.gate.outputs.policy_revision }}
            run: |
              set +e
              node "$RUNNER_TEMP/steward-runtime/packages/action/dist/main.js" publish
              status=$?
              stop="steward-summary-$RANDOM$RANDOM$RANDOM"
              echo "::stop-commands::$stop"
              echo "steward job summary:"
              cat "$GITHUB_STEP_SUMMARY" 2> /dev/null
              echo "::$stop::"
              exit "$status"
    ===== END FILE .github/workflows/steward-screening.yml =====
    ===== BEGIN FILE packages/action/pack-runtime.sh =====
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
    ===== END FILE packages/action/pack-runtime.sh =====
- actions: |
    1. Confirm neither target file exists yet: `ls .github/workflows/steward-screening.yml packages/action/pack-runtime.sh`
       must fail for both (if either exists, STOP and report status fail with the listing).
    2. Extract both files (run exactly this from the tree root):
       node -e "const fs=require('fs'),path=require('path');const L=fs.readFileSync('development-artifacts/patch-steward-m6-4.2.md','utf8').replace(/\r\n/g,'\n').split('\n');for(const n of process.argv.slice(1)){const b=L.indexOf('    ===== BEGIN FILE '+n+' =====');const e=L.indexOf('    ===== END FILE '+n+' =====');if(b<0||e<b)throw new Error('markers '+n);const out=L.slice(b+1,e).map(l=>{if(l.trim()==='')return '';if(!l.startsWith('    '))throw new Error('indent '+n);return l.slice(4)});fs.mkdirSync(path.dirname(n),{recursive:true});fs.writeFileSync(n,out.join('\n')+'\n');console.log('wrote '+n)}" .github/workflows/steward-screening.yml packages/action/pack-runtime.sh
       It prints `wrote .github/workflows/steward-screening.yml` and `wrote packages/action/pack-runtime.sh`.
    3. Do not edit either file afterwards. Run the acceptance checks; if actionlint or Prettier reports anything, STOP and report
       status fail with the verbatim output (do not "fix" the workflow).
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. node -e "const fs=require('fs');const L=fs.readFileSync('development-artifacts/patch-steward-m6-4.2.md','utf8').replace(/\r\n/g,'\n').split('\n');let bad=[];for(const n of process.argv.slice(1)){const b=L.indexOf('    ===== BEGIN FILE '+n+' =====');const e=L.indexOf('    ===== END FILE '+n+' =====');const want=L.slice(b+1,e).map(l=>l.trim()===''?'':l.slice(4)).join('\n')+'\n';const got=fs.existsSync(n)?fs.readFileSync(n,'utf8').replace(/\r\n/g,'\n'):null;if(b<0||e<b||got!==want)bad.push(n)}console.log(bad.length?'DIFFERENT '+bad.join(' '):'verbatim ok')" .github/workflows/steward-screening.yml packages/action/pack-runtime.sh
       -> prints exactly: verbatim ok
    2. actionlint .github/workflows/steward-screening.yml; echo "exit $?"
       -> prints exactly: exit 0
    3. pnpm exec prettier --check .github/workflows/steward-screening.yml -> exit 0
    4. pnpm build > /dev/null; echo "exit $?"
       -> prints exactly: exit 0
    5. bash -c 'T=$(mktemp -d); bash packages/action/pack-runtime.sh "$T/rt.tar.gz" > /dev/null && mkdir "$T/x" && tar -xzf "$T/rt.tar.gz" -C "$T/x" && node "$T/x/packages/action/dist/main.js"; echo "exit $?"; rm -rf "$T"'
       -> prints exactly two lines: usage: main.js gate|publish, then exit 2
    6. bash -c 'T=$(mktemp -d); bash packages/action/pack-runtime.sh "$T/rt.tar.gz" > /dev/null && tar -tzf "$T/rt.tar.gz" | awk -F/ '"'"'$1=="node_modules" && $2!="" {print $2}'"'"' | sort -u | tr "\n" " "; echo; tar -tzf "$T/rt.tar.gz" | cut -d/ -f1 | sort -u | tr "\n" " "; echo; rm -rf "$T"'
       -> prints exactly two lines: `@patch-steward yaml zod ` then `node_modules packages ` (each with one trailing space)
    7. bash packages/action/pack-runtime.sh; echo "exit $?"
       -> prints `usage: pack-runtime.sh <archive path>` (stderr) and exactly: exit 2
    8. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- .github/workflows/steward-screening.yml packages/action/pack-runtime.sh
       -> no output (exit 1)
    9. git grep --untracked -c 'PATCH_STEWARD_APP_PRIVATE_KEY' -- .github/workflows/steward-screening.yml
       -> prints exactly: .github/workflows/steward-screening.yml:3
    10. git status --porcelain -- .github/workflows/ci.yml .github/workflows/cd.yml packages/action/src packages/action/package.json pnpm-lock.yaml
        -> no output
    11. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" .github/workflows/steward-screening.yml packages/action/pack-runtime.sh
        -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes both new files).
